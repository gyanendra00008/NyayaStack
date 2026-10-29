const express = require("express");
const { authenticateUser } = require("../middleware/auth.middleware.js");
const {
  getMyNotifications,
  markRead,
  markAllRead,
} = require("../controllers/notification.controller.js");

const router = express.Router();

// GET /api/notifications - logged-in user ke notifications
router.get("/", authenticateUser, getMyNotifications);

// PATCH /api/notifications/read-all - sab read mark karo
// NOTE: "/:id/read" se upar rehna chahiye
router.patch("/read-all", authenticateUser, markAllRead);

// PATCH /api/notifications/:id/read - ek notification read mark karo
router.patch("/:id/read", authenticateUser, markRead);

module.exports = router;