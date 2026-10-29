const Notification = require('../models/notification.models.js');

// Doosre controllers se call karne ke liye helper
exports.createNotification = async ({ recipient, recipientRole, type, title, message, complaintId }) => {
  try {
    if (!recipient) return;
    await Notification.create({ recipient, recipientRole, type, title, message, complaintId });
  } catch (err) {
    // notification fail ho to complaint ka kaam na ruke
    console.error('createNotification error:', err.message);
  }
};

// GET /api/notifications
exports.getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const items = await Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, notifications: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateOne({ _id: req.params.id, recipient: userId }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};