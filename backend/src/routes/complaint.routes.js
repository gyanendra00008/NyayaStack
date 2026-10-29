const express = require("express");
const { authenticateUser, authorizeRoles } = require("../middleware/auth.middleware.js");
const {
  preCheckRequestSize,
  handleMulterUpload,
  validateUploadedFiles,
  validateComplaintFields,
  validatePaginationQuery,
} = require("../middleware/complaint.middleware.js");
const {
  createComplaint,
  getMyComplaints,
  getMySlaSummary,
  getAssignedComplaints,
  updateComplaintStatus,
  getComplaintChain,
  resolveComplaintChain,
  getCategories,
  getComplaintById,
  getPublicComplaints,
  getPublicStats,
} = require("../controllers/complaint.controller.js");

const router = express.Router();

// GET /api/complaints/categories - Retrieve authoritative supported complaint categories
router.get("/categories", getCategories);

// GET /api/complaints/public/stats - Retrieve aggregated transparency statistics (public)
router.get("/public/stats", getPublicStats);

// GET /api/complaints/public - Retrieve public complaint feed (sanitized, public)
router.get("/public", getPublicComplaints);

// POST /api/complaints - Submit a complaint with optional file attachments (Students/Users only)
router.post(
  "/",
  authenticateUser,
  authorizeRoles("user"),
  preCheckRequestSize,
  handleMulterUpload,
  validateComplaintFields,
  validateUploadedFiles,
  createComplaint
);

// GET /api/complaints/my - Retrieve authenticated user's complaints with pagination (Students/Users only)
router.get(
  "/my",
  authenticateUser,
  authorizeRoles("user"),
  validatePaginationQuery,
  getMyComplaints
);

// GET /api/complaints/sla-summary - Dynamic SLA compliance for the logged-in user (Students/Users only)
// NOTE: must stay above "/:complaintId" so "sla-summary" is not read as an ID
router.get(
  "/sla-summary",
  authenticateUser,
  authorizeRoles("user"),
  getMySlaSummary
);

// GET /api/complaints/assigned - Retrieve complaints assigned to lowest rank authority desk / officer
router.get(
  "/assigned",
  authenticateUser,
  authorizeRoles("officer", "admin"),
  getAssignedComplaints
);

// PATCH /api/complaints/:complaintId/status - Update complaint resolution status
router.patch(
  "/:complaintId/status",
  authenticateUser,
  authorizeRoles("officer", "admin"),
  updateComplaintStatus
);

// GET /api/complaints/:complaintId/chain - Retrieve the full hash-chain for a complaint
router.get(
  "/:complaintId/chain",
  authenticateUser,
  getComplaintChain
);

// PATCH /api/complaints/:complaintId/resolve-chain - Resolve all complaints in a chain (authority/admin)
router.patch(
  "/:complaintId/resolve-chain",
  authenticateUser,
  authorizeRoles("officer", "admin"),
  resolveComplaintChain
);

// GET /api/complaints/:complaintId - Retrieve a single complaint by ID
router.get(
  "/:complaintId",
  authenticateUser,
  getComplaintById
);

module.exports = router;