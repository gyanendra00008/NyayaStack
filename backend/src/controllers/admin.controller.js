const mongoose = require("mongoose");
const UserModel = require("../models/auth.models.js");
const Complaint = require("../models/complaint.models.js");
const { getRankForDesignation } = require("../utils/hierarchy.utils.js");

/**
 * Retrieve list of authority registration applications with optional status and search filtering
 * Query parameters:
 *  - status: 'pending' | 'approved' | 'rejected' | 'all'
 *  - department: string (optional)
 *  - search: string (optional)
 */
const getAuthorityRequests = async (req, res) => {
  try {
    const { status, department, search } = req.query;

    const query = { role: "officer" };

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.verificationStatus = status;
    }

    if (department && typeof department === "string" && department.trim()) {
      query.department = department.trim();
    }

    if (search && typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { fullName: regex },
        { email: regex },
        { username: regex },
        { rollNo: regex },
      ];
    }

    const [requests, pendingCount, approvedCount, rejectedCount, totalCount] = await Promise.all([
      UserModel.find(query)
        .select(
          "username email fullName rollNo department designation category rank role verificationStatus isVerified reviewedBy reviewedAt rejectionReason createdAt updatedAt"
        )
        .populate("reviewedBy", "username email fullName")
        .sort({ createdAt: -1 }),
      UserModel.countDocuments({ role: "officer", verificationStatus: "pending" }),
      UserModel.countDocuments({ role: "officer", verificationStatus: "approved" }),
      UserModel.countDocuments({ role: "officer", verificationStatus: "rejected" }),
      UserModel.countDocuments({ role: "officer" }),
    ]);

    const formattedRequests = requests.map((item) => ({
      id: item._id,
      _id: item._id,
      username: item.username,
      fullName: item.fullName || item.username,
      email: item.email,
      employeeId: item.rollNo || "",
      department: item.department || "General",
      designation: item.designation || "Officer",
      category: item.category || "",
      rank: item.rank || 999,
      role: item.role,
      verificationStatus: item.verificationStatus,
      isVerified: item.isVerified,
      reviewedBy: item.reviewedBy
        ? {
            id: item.reviewedBy._id,
            fullName: item.reviewedBy.fullName || item.reviewedBy.username,
            email: item.reviewedBy.email,
          }
        : null,
      reviewedAt: item.reviewedAt,
      rejectionReason: item.rejectionReason || "",
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      counts: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      data: formattedRequests,
    });
  } catch (error) {
    console.error("Error fetching authority requests:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching authority requests",
    });
  }
};

/**
 * Retrieve single authority application by ID
 */
const getAuthorityRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID format",
      });
    }

    const applicant = await UserModel.findOne({ _id: id, role: "officer" })
      .select(
        "username email fullName rollNo department designation category rank role verificationStatus isVerified reviewedBy reviewedAt rejectionReason createdAt updatedAt"
      )
      .populate("reviewedBy", "username email fullName");

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Authority request application not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: applicant._id,
        _id: applicant._id,
        username: applicant.username,
        fullName: applicant.fullName || applicant.username,
        email: applicant.email,
        employeeId: applicant.rollNo || "",
        department: applicant.department || "General",
        designation: applicant.designation || "Officer",
        category: applicant.category || "",
        rank: applicant.rank || 999,
        role: applicant.role,
        verificationStatus: applicant.verificationStatus,
        isVerified: applicant.isVerified,
        reviewedBy: applicant.reviewedBy
          ? {
              id: applicant.reviewedBy._id,
              fullName: applicant.reviewedBy.fullName || applicant.reviewedBy.username,
              email: applicant.reviewedBy.email,
            }
          : null,
        reviewedAt: applicant.reviewedAt,
        rejectionReason: applicant.rejectionReason || "",
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error retrieving authority request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error retrieving authority request",
    });
  }
};

/**
 * Approve an authority application
 * Sets verificationStatus to 'approved', isVerified to true, and logs reviewer & timestamp
 */
const approveAuthorityRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID format",
      });
    }

    const officer = await UserModel.findOne({ _id: id, role: "officer" });
    if (!officer) {
      return res.status(404).json({
        success: false,
        message: "Authority request not found",
      });
    }

    officer.verificationStatus = "approved";
    officer.isVerified = true;
    officer.reviewedBy = req.user._id;
    officer.reviewedAt = new Date();
    officer.rejectionReason = "";
    if (!officer.rank || officer.rank === 999) {
      officer.rank = getRankForDesignation(officer.department, officer.designation);
    }
    await officer.save();

    // Auto-link any previously unassigned complaints in this department matching this officer's designation.
    // This also covers complaints filed when no officer existed yet (empty department / assignedDesignation).
    try {
      const { DEPARTMENT_TO_CATEGORIES, getLowestRankDesignation, getLowestRankNumber } = require("../utils/hierarchy.utils.js");

      // Determine categories handled by this officer's department
      const handledCategories = DEPARTMENT_TO_CATEGORIES[officer.department] || [];

      // Compute the officer's effective rank
      const officerRank = officer.rank && officer.rank !== 999
        ? officer.rank
        : getRankForDesignation(officer.department, officer.designation);

      // Determine the lowest rank number for this department to check if this officer IS the lowest
      const lowestRankNumber = getLowestRankNumber(officer.department);
      const lowestDesignation = getLowestRankDesignation(officer.department);
      const isLowestRank = officerRank === lowestRankNumber;

      // Build the $or conditions for matching unassigned complaints that should route to this officer:
      // 1. Complaints already tagged with this officer's designation (normal case)
      // 2. Complaints with empty/no department field AND category belonging to this officer's department
      //    (filed when no officer was approved yet — fallback routing)
      // 3. If this officer IS the lowest rank in the department, also pick up complaints assigned to
      //    the canonical lowest designation
      const orConditions = [
        // Previously matched by designation
        { assignedDesignation: officer.designation },
        // Complaints with no department (filed before any officer existed) whose category maps to this dept
        ...(handledCategories.length > 0
          ? [{ department: { $in: ["", null] }, category: { $in: handledCategories } }]
          : []),
      ];

      if (isLowestRank && lowestDesignation && lowestDesignation !== officer.designation) {
        orConditions.push({ assignedDesignation: lowestDesignation });
      }

      // Restrict to unassigned complaints in this department (or with empty department for fallback)
      const baseMatch = {
        assignedTo: null,
        $or: orConditions,
      };

      if (officer.category && officer.category !== "All") {
        baseMatch.category = officer.category;
      }

      // Unset-department complaints: update department + designation + rank + assignedTo
      const unsetDeptUpdate = {
        $set: {
          assignedTo: officer._id,
          assignedDesignation: officer.designation,
          assignedRank: officerRank,
          department: officer.department,
          status: "Assigned",
        },
      };

      await Complaint.updateMany(baseMatch, unsetDeptUpdate);
    } catch (e) {
      console.warn("Auto-assignment on officer approval warning:", e.message);
    }

    return res.status(200).json({
      success: true,
      message: "Authority application approved successfully",
      data: {
        id: officer._id,
        username: officer.username,
        fullName: officer.fullName || officer.username,
        email: officer.email,
        role: officer.role,
        verificationStatus: officer.verificationStatus,
        isVerified: officer.isVerified,
        reviewedAt: officer.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Error approving authority request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error approving authority application",
    });
  }
};

/**
 * Reject an authority application
 * Sets verificationStatus to 'rejected', isVerified to false, logs reviewer, timestamp, and optional reason.
 * Increments tokenVersion to instantly invalidate any stale sessions.
 */
const rejectAuthorityRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application ID format",
      });
    }

    const officer = await UserModel.findOne({ _id: id, role: "officer" });
    if (!officer) {
      return res.status(404).json({
        success: false,
        message: "Authority request not found",
      });
    }

    const reason =
      req.body?.reason && typeof req.body.reason === "string" && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, 500)
        : "Application not approved by institutional administrator";

    officer.verificationStatus = "rejected";
    officer.isVerified = false;
    officer.reviewedBy = req.user._id;
    officer.reviewedAt = new Date();
    officer.rejectionReason = reason;
    officer.tokenVersion = (officer.tokenVersion || 0) + 1;
    await officer.save();

    return res.status(200).json({
      success: true,
      message: "Authority application rejected",
      data: {
        id: officer._id,
        username: officer.username,
        fullName: officer.fullName || officer.username,
        email: officer.email,
        role: officer.role,
        verificationStatus: officer.verificationStatus,
        isVerified: officer.isVerified,
        rejectionReason: officer.rejectionReason,
        reviewedAt: officer.reviewedAt,
      },
    });
  } catch (error) {
    console.error("Error rejecting authority request:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error rejecting authority application",
    });
  }
};

/**
 * Administrative Overview / Dashboard Statistics
 */
const getAdminStats = async (req, res) => {
  try {
    const [pendingCount, approvedCount, rejectedCount, totalOfficers, totalStudents] =
      await Promise.all([
        UserModel.countDocuments({ role: "officer", verificationStatus: "pending" }),
        UserModel.countDocuments({ role: "officer", verificationStatus: "approved" }),
        UserModel.countDocuments({ role: "officer", verificationStatus: "rejected" }),
        UserModel.countDocuments({ role: "officer" }),
        UserModel.countDocuments({ role: "user" }),
      ]);

    let totalComplaints = 0;
    try {
      totalComplaints = await Complaint.countDocuments();
    } catch (e) {
      // Storage db might be separate or quiet
    }

    return res.status(200).json({
      success: true,
      stats: {
        authorityRequests: {
          total: totalOfficers,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        },
        users: {
          students: totalStudents,
          officers: approvedCount,
        },
        complaints: {
          total: totalComplaints,
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving admin stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error retrieving admin stats",
    });
  }
};

const { escalateDueComplaints } = require("../services/escalation.service.js");

const triggerEscalationProcess = async (req, res) => {
  try {
    const summary = await escalateDueComplaints();
    return res.status(200).json({
      success: true,
      message: `Escalation check completed. ${summary.escalated} complaints escalated.`,
      summary,
    });
  } catch (error) {
    console.error("Error triggering escalation process:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error triggering escalation process",
    });
  }
};

module.exports = {
  getAuthorityRequests,
  getAuthorityRequestById,
  approveAuthorityRequest,
  rejectAuthorityRequest,
  getAdminStats,
  triggerEscalationProcess,
};
