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
} = require("../controllers/complaint.controller.js");

const router = express.Router();

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

module.exports = router;
