const express = require("express");
const { authenticateUser, authorizeRoles } = require("../middleware/auth.middleware.js");
const {
  getAuthorityRequests,
  getAuthorityRequestById,
  approveAuthorityRequest,
  rejectAuthorityRequest,
  getAdminStats,
  triggerEscalationProcess,
} = require("../controllers/admin.controller.js");

const router = express.Router();

// Strict RBAC: All administrator routes require authentication and 'admin' role
router.use(authenticateUser, authorizeRoles("admin"));

// Dashboard statistics
router.get("/dashboard", getAdminStats);
router.get("/stats", getAdminStats);

// Authority applications management
router.get("/authority-requests", getAuthorityRequests);
router.get("/authority-requests/:id", getAuthorityRequestById);
router.patch("/authority-requests/:id/approve", approveAuthorityRequest);
router.patch("/authority-requests/:id/reject", rejectAuthorityRequest);

// Time-based Hierarchical Escalation: Admin on-demand trigger
router.post("/escalate-now", triggerEscalationProcess);

module.exports = router;
