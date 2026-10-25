const crypto = require("crypto");
const Complaint = require("../models/complaint.models.js");
const { COMPLAINT_CATEGORIES } = require("../models/complaint.models.js");
const cloudinaryService = require("../services/cloudinary.service.js");
const mlService = require("../services/ml.service.js");

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
          title,
          description,
          attachments: uploadedAttachments,
          status: "Filed",
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

    const [total, complaints] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("complaintId category title description status isAnonymous attachments createdAt updatedAt -_id")
        .lean(),
    ]);

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

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Both 'title' and 'description' are required for category prediction",
      });
    }

    const prediction = await mlService.predictCategory(title, description);

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
      .select("complaintId userId category title description status isAnonymous attachments createdAt updatedAt -_id")
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: `Complaint with ID '${complaintId}' was not found`,
      });
    }

    // Access control: User can only view their own complaint unless they are an officer or admin
    if (
      complaint.userId &&
      complaint.userId.toString() !== userId?.toString() &&
      userRole !== "admin" &&
      userRole !== "officer"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this complaint",
      });
    }

    // Sanitize response so userId is not leaked
    const sanitizedComplaint = { ...complaint };
    delete sanitizedComplaint.userId;

    return res.status(200).json({
      success: true,
      data: sanitizedComplaint,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createComplaint,
  getMyComplaints,
  predictComplaintCategory,
  getCategories,
  getComplaintById,
};
