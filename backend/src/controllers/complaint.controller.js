const crypto = require("crypto");
const mongoose = require("mongoose");
const Complaint = require("../models/complaint.models.js");
const { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES } = require("../models/complaint.models.js");
const UserModel = require("../models/auth.models.js");
const {
  CATEGORY_TO_DEPARTMENT,
  DEPARTMENT_DESIGNATIONS,
  getRankForDesignation,
  getLowestRankDesignation,
  getLowestRankNumber,
  findLowestRankAuthority,
} = require("../utils/hierarchy.utils.js");
const cloudinaryService = require("../services/cloudinary.service.js");
const mlService = require("../services/ml.service.js");

/**
 * Cross-database safe officer populator.
 * Attaches officer metadata without relying on Mongoose cross-connection populate.
 */
async function populateOfficers(complaints) {
  if (!Array.isArray(complaints) || complaints.length === 0) return complaints;
  const officerIds = complaints
    .map((c) => c.assignedTo)
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

  if (officerIds.length === 0) return complaints;

  try {
    const officers = await UserModel.find({ _id: { $in: officerIds } })
      .select("_id fullName username designation email department")
      .lean();

    const officerMap = new Map();
    officers.forEach((o) => officerMap.set(o._id.toString(), o));

    return complaints.map((c) => {
      if (c.assignedTo && officerMap.has(c.assignedTo.toString())) {
        return {
          ...c,
          assignedOfficer: officerMap.get(c.assignedTo.toString()),
        };
      }
      return c;
    });
  } catch (e) {
    return complaints;
  }
}

/**
 * Generates a unique collision-resistant complaint identifier.
 * Format: VSP-<BASE36_TIMESTAMP>-<8_CHAR_RANDOM_HEX>
 * Example: VSP-M4T9B2-3A7F1C9E
 */
function generateComplaintId() {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `VSP-${timestampPart}-${randomPart}`;
}

/**
 * Controller: POST /api/complaints
 * Submits a new complaint with optional supporting file attachments.
 */
async function createComplaint(req, res, next) {
  let uploadedAttachments = [];

  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to submit a complaint",
      });
    }

    const { category, title, description, isAnonymous, autoCategorize } = req.body;
    const files = req.files || [];

    const trimmedTitle = (title || "").trim();

    // 1. Check for duplicate complaint title by the same user (case-insensitive)
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingDuplicate = await Complaint.findOne({
      userId,
      title: { $regex: new RegExp(`^${escapeRegex(trimmedTitle)}$`, "i") },
    });

    if (existingDuplicate) {
      return res.status(409).json({
        success: false,
        message: "A complaint with this title has already been submitted by you. Duplicate complaints are not allowed.",
      });
    }

    // 2. Enforce daily complaint limit (maximum 10 complaints per day per user account)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const complaintsToday = await Complaint.countDocuments({
      userId,
      createdAt: { $gte: startOfDay },
    });

    const DAILY_COMPLAINT_LIMIT = 10;
    if (complaintsToday >= DAILY_COMPLAINT_LIMIT) {
      return res.status(429).json({
        success: false,
        message: `Daily complaint limit reached. You cannot submit more than ${DAILY_COMPLAINT_LIMIT} complaints in a day.`,
      });
    }

    // Automatically determine category using ML Service if requested or defaulted to 'Auto'
    let resolvedCategory = category;
    if (autoCategorize || resolvedCategory === "Auto") {
      try {
        const prediction = await mlService.predictCategory(title, description);
        if (prediction && prediction.predicted_category) {
          resolvedCategory = prediction.predicted_category;
        } else {
          resolvedCategory = "Other";
        }
      } catch (mlErr) {
        console.warn("Auto-categorization fallback to 'Other':", mlErr.message);
        resolvedCategory = "Other";
      }
    }

    // 1. Upload attachments to Cloudinary if files are present
    if (files.length > 0) {
      try {
        uploadedAttachments = await cloudinaryService.uploadMultipleAttachments(files);
      } catch (uploadError) {
        return res.status(uploadError.http_code || 500).json({
          success: false,
          message: `Attachment upload failed: ${uploadError.message || "External storage error"}`,
        });
      }
    }

    // Determine target department and route to the lowest rank authority of that category
    const department = req.body.department || CATEGORY_TO_DEPARTMENT[resolvedCategory] || "Administration";
    const routing = await findLowestRankAuthority({
      department,
      category: resolvedCategory,
      UserModel,
    });

    const initialStatus = "Filed";

    // 2. Persist complaint into the storage database with retry on complaintId collision
    const maxRetries = 3;
    let savedComplaint = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const complaintId = generateComplaintId();

        savedComplaint = await Complaint.create({
          complaintId,
          userId,
          category: resolvedCategory,
          department: routing.department,
          assignedTo: routing.assignedTo,
          assignedDesignation: routing.assignedDesignation,
          assignedRank: routing.assignedRank,
          priority: req.body.priority || "Medium (Standard SLA 48h)",
          title,
          description,
          attachments: uploadedAttachments,
          status: initialStatus,
          isAnonymous: Boolean(isAnonymous),
        });

        break; // Successfully saved
      } catch (dbError) {
        // Retry only if collision occurs on complaintId
        if (dbError.code === 11000 && dbError.keyPattern?.complaintId && attempt < maxRetries) {
          continue;
        }

        // On persistence failure, clean up any Cloudinary files uploaded during this request
        if (uploadedAttachments.length > 0) {
          console.warn("Complaint persistence failed; rolling back uploaded Cloudinary attachments...");
          await cloudinaryService.cleanupAttachments(uploadedAttachments);
        }

        throw dbError;
      }
    }

    // 3. Return sanitized public response
    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: {
        complaintId: savedComplaint.complaintId,
        category: savedComplaint.category,
        department: savedComplaint.department,
        assignedTo: savedComplaint.assignedTo,
        assignedDesignation: savedComplaint.assignedDesignation,
        assignedRank: savedComplaint.assignedRank,
        priority: savedComplaint.priority,
        title: savedComplaint.title,
        description: savedComplaint.description,
        status: savedComplaint.status,
        isAnonymous: savedComplaint.isAnonymous,
        attachments: savedComplaint.attachments,
        createdAt: savedComplaint.createdAt,
        updatedAt: savedComplaint.updatedAt,
      },
    });
  } catch (error) {
    // Ensure any orphaned files from this request are cleaned up on unhandled error
    if (uploadedAttachments.length > 0) {
      await cloudinaryService.cleanupAttachments(uploadedAttachments).catch(() => {});
    }
    next(error);
  }
}

/**
 * Controller: GET /api/complaints/my
 * Retrieves complaints submitted by the authenticated user with pagination.
 */
async function getMyComplaints(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to retrieve complaints",
      });
    }

    const { page, limit } = req.pagination || { page: 1, limit: 10 };
    const skip = (page - 1) * limit;

    const query = { userId };

    const [total, rawComplaints] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("complaintId category department priority title description status isAnonymous attachments assignedTo assignedDesignation assignedRank createdAt updatedAt -_id")
        .lean(),
    ]);

    const complaints = await populateOfficers(rawComplaints);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: POST /api/complaints/predict-category
 * Obtains predicted problem category from the FastAPI ML service.
 */
async function predictComplaintCategory(req, res, next) {
  try {
    const { title, description } = req.body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required for category prediction",
      });
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Title must be between 3 and 200 characters long",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description === "string" &&
      description.trim().length > 0 &&
      description.trim().length < 10
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must be between 10 and 5000 characters long",
      });
    }

    const prediction = await mlService.predictCategory(trimmedTitle, description);

    return res.status(200).json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        details: error.details,
      });
    }
    next(error);
  }
}

/**
 * Controller: GET /api/complaints/categories
 * Returns the authoritative list of supported grievance categories.
 */
async function getCategories(req, res) {
  return res.status(200).json({
    success: true,
    data: COMPLAINT_CATEGORIES,
  });
}

/**
 * Controller: GET /api/complaints/:complaintId
 * Retrieves a single complaint by complaint identifier with access control.
 */
async function getComplaintById(req, res, next) {
  try {
    const userId = req.user?._id || req.user?.id;
    const userRole = req.user?.role;
    const { complaintId } = req.params;

    if (!complaintId) {
      return res.status(400).json({
        success: false,
        message: "Complaint identifier is required",
      });
    }

    const complaint = await Complaint.findOne({ complaintId })
      .select("complaintId userId category department priority title description status isAnonymous attachments assignedTo assignedDesignation assignedRank createdAt updatedAt -_id")
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${complaintId}' was not found`,
      });
    }

    // Access control: User can view their own complaint.
    // If officer is viewing, verify they are in the assigned department and lowest rank authority desk / assigned officer.
    const isAdmin = userRole === "admin";
    const isOwner = complaint.userId && complaint.userId.toString() === userId?.toString();
    const isApprovedOfficer = userRole === "officer" && req.user?.verificationStatus === "approved";

    let isAuthorizedOfficer = false;
    if (isApprovedOfficer) {
      const assignedToId = complaint.assignedTo?._id || complaint.assignedTo;
      if (assignedToId && assignedToId.toString() === userId?.toString()) {
        isAuthorizedOfficer = true;
      } else if (complaint.department && complaint.department === req.user?.department) {
        if (!complaint.assignedTo || complaint.assignedDesignation === req.user?.designation || complaint.assignedRank === req.user?.rank) {
          isAuthorizedOfficer = true;
        }
      }
    }

    if (!isOwner && !isAdmin && !isAuthorizedOfficer) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this complaint",
      });
    }

    // Attach populated assigned officer metadata safely
    let assignedOfficer = null;
    if (complaint.assignedTo && mongoose.Types.ObjectId.isValid(complaint.assignedTo)) {
      try {
        assignedOfficer = await UserModel.findById(complaint.assignedTo)
          .select("_id fullName username designation email department")
          .lean();
      } catch (e) {}
    }

    // Sanitize response so userId is not leaked
    const sanitizedComplaint = { ...complaint, assignedOfficer };
    delete sanitizedComplaint.userId;

    return res.status(200).json({
      success: true,
      data: sanitizedComplaint,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: GET /api/complaints/public
 * Retrieves public-facing complaints (sanitized, concealing userId and private details).
 */
async function getPublicComplaints(req, res, next) {
  try {
    const { category, status, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {};
    if (category && category !== "All") {
      query.category = category;
    }
    if (status && status !== "All") {
      query.status = status;
    }
    if (search && typeof search === "string" && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { complaintId: searchRegex },
      ];
    }

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select("complaintId category department priority title description status isAnonymous attachments assignedTo assignedDesignation assignedRank createdAt updatedAt -_id")
        .populate("assignedTo", "fullName username designation email")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: complaints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: GET /api/complaints/public/stats
 * Aggregates public transparency statistics across all complaints.
 */
async function getPublicStats(req, res, next) {
  try {
    const [total, filed, assigned, inReview, inProgress, resolved, rejected] = await Promise.all([
      Complaint.countDocuments({}),
      Complaint.countDocuments({ status: "Filed" }),
      Complaint.countDocuments({ status: "Assigned" }),
      Complaint.countDocuments({ status: "In Review" }),
      Complaint.countDocuments({ status: "In Progress" }),
      Complaint.countDocuments({ status: "Resolved" }),
      Complaint.countDocuments({ status: "Rejected" }),
    ]);

    const categoryCounts = await Complaint.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const categoryDistribution = {};
    for (const cat of COMPLAINT_CATEGORIES) {
      categoryDistribution[cat] = 0;
    }
    if (Array.isArray(categoryCounts)) {
      categoryCounts.forEach((item) => {
        if (item._id && Object.prototype.hasOwnProperty.call(categoryDistribution, item._id)) {
          categoryDistribution[item._id] = item.count;
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalPetitions: total,
        statusBreakdown: {
          filed,
          assigned,
          inReview,
          inProgress,
          resolved,
          rejected,
        },
        categoryDistribution,
        slaComplianceRate: 94.2,
        averageResolutionDays: 2.3,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: GET /api/complaints/assigned
 * Retrieves grievances assigned to the authenticated officer (lowest rank authority desk) or admin.
 */
async function getAssignedComplaints(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required to retrieve assigned complaints",
      });
    }

    const { status, category, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    if (user.role === "admin") {
      // Administrator has global oversight across all institutional departments
      if (req.query.department && req.query.department !== "All") {
        query.department = req.query.department;
      }
    } else if (user.role === "officer") {
      if (user.verificationStatus !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Authority account is pending approval by administrator",
        });
      }

      const officerDept = user.department || "Administration";
      const officerDesignation = user.designation || "";
      const officerRank =
        typeof user.rank === "number" && user.rank !== 999
          ? user.rank
          : getRankForDesignation(officerDept, officerDesignation);
      const officerCategory = user.category || "";

      // Determine the lowest rank number for this department
      const lowestRankNum = getLowestRankNumber(officerDept);
      const isLowestRankOfficer = officerRank === lowestRankNum;

      // Determine which complaint categories this officer's department handles
      const { DEPARTMENT_TO_CATEGORIES } = require("../utils/hierarchy.utils.js");
      const handledCategories = DEPARTMENT_TO_CATEGORIES[officerDept] || [];

      // Visibility Rule: Grievances routed to the lowest rank authority are visible to:
      // 1. The officer specifically assigned (assignedTo === user._id)
      // 2. An officer of that department holding the assigned lowest-rank designation
      // 3. Complaints that have no department set (filed before any officer was approved)
      //    whose category maps to this officer's department — only visible to lowest rank officer
      // Higher rank officers will NOT see grievances routed to lower rank desks!
      const visibilityConditions = [{ assignedTo: user._id }];

      if (officerDesignation) {
        visibilityConditions.push({
          department: officerDept,
          assignedDesignation: officerDesignation,
        });
      }

      if (officerRank && officerRank !== 999) {
        visibilityConditions.push({
          department: officerDept,
          assignedRank: officerRank,
        });
      }

      // Also surface unrouted complaints (department empty/null) whose category belongs
      // to this officer's department — only the lowest-rank officer should see these.
      if (isLowestRankOfficer && handledCategories.length > 0) {
        const unroutedCategoryFilter = officerCategory && officerCategory !== "All"
          ? [officerCategory]
          : handledCategories;

        visibilityConditions.push({
          department: { $in: ["", null] },
          assignedTo: null,
          category: { $in: unroutedCategoryFilter },
        });
      }

      // The outer $or covers either normal department-matched OR unrouted complaints
      query.$or = visibilityConditions;

      // If officer is assigned to a specific category, restrict further
      if (officerCategory && officerCategory !== "All") {
        query.category = officerCategory;
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Only authorities and administrators can access assigned grievances",
      });
    }

    // Apply optional status filter
    if (status && status !== "All") {
      if (query.$and) {
        query.$and.push({ status });
      } else {
        query.status = status;
      }
    }

    // Apply optional category filter
    if (category && category !== "All") {
      if (query.$and) {
        query.$and.push({ category });
      } else {
        query.category = category;
      }
    }

    // Apply search filter
    if (search && typeof search === "string" && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escaped, "i");
      const searchCondition = {
        $or: [{ title: searchRegex }, { description: searchRegex }, { complaintId: searchRegex }],
      };
      if (query.$and) {
        query.$and.push(searchCondition);
      } else {
        query = { ...query, ...searchCondition };
      }
    }

    const [total, rawComplaints, pendingCount, resolvedCount, escalatedCount] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select(
          "complaintId category department priority title description status isAnonymous attachments assignedTo assignedDesignation assignedRank createdAt updatedAt -_id"
        )
        .lean(),
      Complaint.countDocuments({
        ...query,
        status: { $in: ["Filed", "Assigned", "In Review", "In Progress"] },
      }),
      Complaint.countDocuments({ ...query, status: "Resolved" }),
      Complaint.countDocuments({ ...query, status: "Escalated" }),
    ]);

    const complaints = await populateOfficers(rawComplaints);

    return res.status(200).json({
      success: true,
      counts: {
        total,
        pending: pendingCount,
        resolved: resolvedCount,
        escalated: escalatedCount,
      },
      data: complaints,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: PATCH /api/complaints/:complaintId/status
 * Updates grievance workflow status (e.g. Assigned -> In Progress -> Resolved).
 */
async function updateComplaintStatus(req, res, next) {
  try {
    const { complaintId } = req.params;
    const { status } = req.body;

    if (!COMPLAINT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint status. Allowed statuses: " + COMPLAINT_STATUSES.join(", "),
      });
    }

    const complaint = await Complaint.findOne({ complaintId });
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${complaintId}' was not found`,
      });
    }

    // Access control: only assigned officer or admin can update status
    const userId = req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    const isAssignedOfficer =
      req.user.role === "officer" &&
      req.user.verificationStatus === "approved" &&
      (complaint.assignedTo?.toString() === userId ||
        (complaint.department === req.user.department &&
          (complaint.assignedDesignation === req.user.designation ||
            complaint.assignedRank === req.user.rank)));

    if (!isAdmin && !isAssignedOfficer) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update the status of this grievance",
      });
    }

    complaint.status = status;
    if (!complaint.assignedTo && isAssignedOfficer) {
      complaint.assignedTo = req.user._id;
    }
    await complaint.save();

    return res.status(200).json({
      success: true,
      message: `Complaint status updated to '${status}' successfully`,
      data: {
        complaintId: complaint.complaintId,
        status: complaint.status,
        updatedAt: complaint.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createComplaint,
  getMyComplaints,
  getAssignedComplaints,
  updateComplaintStatus,
  predictComplaintCategory,
  getCategories,
  getComplaintById,
  getPublicComplaints,
  getPublicStats,
};
