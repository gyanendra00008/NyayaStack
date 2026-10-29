const express = require("express");
const { authenticateUser } = require("../middleware/auth.middleware.js");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notification.controller.js");

const router = express.Router();

router.use(authenticateUser);

router.get("/", getNotifications);
router.patch("/:id/read", markNotificationRead);
router.patch("/read-all", markAllNotificationsRead);

module.exports = router;
