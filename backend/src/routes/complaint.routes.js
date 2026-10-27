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
  getAssignedComplaints,
  updateComplaintStatus,
  predictComplaintCategory,
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

// POST /api/complaints/predict-category - Get ML predicted category for title & description
router.post("/predict-category", predictComplaintCategory);

// POST /api/complaints - Submit a complaint with optional file attachments
router.post(
  "/",
  authenticateUser,
  preCheckRequestSize,
  handleMulterUpload,
  validateComplaintFields,
  validateUploadedFiles,
  createComplaint
);

// GET /api/complaints/my - Retrieve authenticated user's complaints with pagination
router.get(
  "/my",
  authenticateUser,
  validatePaginationQuery,
  getMyComplaints
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

// GET /api/complaints/:complaintId - Retrieve a single complaint by ID
router.get(
  "/:complaintId",
  authenticateUser,
  getComplaintById
);

module.exports = router;
