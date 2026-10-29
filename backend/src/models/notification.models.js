const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // student ya officer ki user _id
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    recipientRole: { type: String, enum: ['student', 'officer'], required: true },
    type: {
      type: String,
      enum: ['NEW_COMPLAINT', 'RESOLVED', 'ESCALATED'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    // complaint ka public ID, e.g. "VSP-M4T9B2-3A7F1C9E" (ObjectId nahi, String)
    complaintId: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);