const express = require("express");
const { authenticateUser } = require("../middleware/auth.middleware.js");
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
  predictComplaintCategory,
  getCategories,
  getComplaintById,
} = require("../controllers/complaint.controller.js");

const router = express.Router();

// GET /api/complaints/categories - Retrieve authoritative supported complaint categories
router.get("/categories", getCategories);

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

// GET /api/complaints/:complaintId - Retrieve a single complaint by ID
router.get(
  "/:complaintId",
  authenticateUser,
  getComplaintById
);

module.exports = router;
