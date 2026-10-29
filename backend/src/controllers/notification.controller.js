const UserModel = require("../models/auth.models.js");
const Complaint = require("../models/complaint.models.js");

/**
 * Retrieve notifications scoped to authenticated user's role
 */
const getNotifications = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const notifications = [];

    if (user.role === "user") {
      // Find recent complaints filed by this user
      const userComplaints = await Complaint.find({ userId: user._id })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select("complaintId title status department assignedDesignation currentEscalationLevel escalationStatus slaDueAt createdAt updatedAt")
        .lean();

      userComplaints.forEach((c) => {
        const timeStr = new Date(c.updatedAt || c.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        if (c.status === "Resolved") {
          notifications.push({
            id: `res-${c.complaintId}`,
            type: "ledger",
            icon: "fa-circle-check",
            title: `Petition Resolved: ${c.complaintId}`,
            text: `Your petition "${c.title}" has been successfully resolved.`,
            complaintId: c.complaintId,
            time: timeStr,
            read: false,
            createdAt: c.updatedAt || c.createdAt,
          });
        } else if (c.status === "Escalated") {
          notifications.push({
            id: `esc-${c.complaintId}-${c.currentEscalationLevel || 2}`,
            type: "sla",
            icon: "fa-triangle-exclamation",
            title: `Petition Escalated: ${c.complaintId}`,
            text: c.escalationStatus === "admin_attention"
              ? `Your petition "${c.title}" has reached executive ombudsman / admin review.`
              : `Your petition "${c.title}" was escalated to higher authority (${c.assignedDesignation || `Level ${c.currentEscalationLevel || 2}`}).`,
            complaintId: c.complaintId,
            time: timeStr,
            read: false,
            createdAt: c.updatedAt || c.createdAt,
          });
        } else if (c.status === "In Progress" || c.status === "In Review") {
          notifications.push({
            id: `prog-${c.complaintId}`,
            type: "status",
            icon: "fa-arrows-rotate",
            title: `Status Updated: ${c.complaintId}`,
            text: `Your petition "${c.title}" is currently marked as ${c.status}.`,
            complaintId: c.complaintId,
            time: timeStr,
            read: false,
            createdAt: c.updatedAt || c.createdAt,
          });
        } else if (c.status === "Assigned") {
          notifications.push({
            id: `asg-${c.complaintId}`,
            type: "message",
            icon: "fa-user-check",
            title: `Officer Assigned: ${c.complaintId}`,
            text: `Your petition has been routed to the ${c.department || "designated authority"} department desk.`,
            complaintId: c.complaintId,
            time: timeStr,
            read: false,
            createdAt: c.updatedAt || c.createdAt,
          });
        } else {
          notifications.push({
            id: `filed-${c.complaintId}`,
            type: "status",
            icon: "fa-circle-info",
            title: `Petition Filed: ${c.complaintId}`,
            text: `Your petition "${c.title}" was submitted and acknowledged.`,
            complaintId: c.complaintId,
            time: timeStr,
            read: true,
            createdAt: c.createdAt,
          });
        }

        // SLA deadline approaching check
        if (c.slaDueAt && c.status !== "Resolved" && c.status !== "Rejected") {
          const diffMs = new Date(c.slaDueAt).getTime() - Date.now();
          if (diffMs > 0 && diffMs < 48 * 60 * 60 * 1000) {
            notifications.push({
              id: `sla-${c.complaintId}`,
              type: "sla",
              icon: "fa-clock",
              title: `SLA Deadline Notice`,
              text: `Target resolution SLA for "${c.title}" is due soon.`,
              complaintId: c.complaintId,
              time: new Date(c.slaDueAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
              }),
              read: false,
              createdAt: new Date(c.slaDueAt),
            });
          }
        }
      });
    } else if (user.role === "officer") {
      // Find complaints assigned to this officer or officer's department
      const officerComplaints = await Complaint.find({
        $or: [{ assignedTo: user._id }, { department: user.department }],
      })
        .sort({ updatedAt: -1 })
        .limit(25)
        .select("complaintId title status department slaDueAt createdAt updatedAt")
        .lean();

      officerComplaints.forEach((c) => {
        const timeStr = new Date(c.updatedAt || c.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        if (c.status === "Assigned" || c.status === "Filed") {
          notifications.push({
            id: `off-asg-${c.complaintId}`,
            type: "message",
            icon: "fa-inbox",
            title: `New Assigned Grievance: ${c.complaintId}`,
            text: `Grievance "${c.title}" requires review and action by your department.`,
            complaintId: c.complaintId,
            time: timeStr,
            read: false,
            createdAt: c.createdAt,
          });
        } else if (c.status === "Escalated") {
          notifications.push({
            id: `off-esc-${c.complaintId}`,
            type: "sla",
            icon: "fa-triangle-exclamation",
            title: `Escalated Grievance: ${c.complaintId}`,
            text: `Grievance "${c.title}" was escalated due to elapsed SLA.`,
            complaintId: c.complaintId,
            time: timeStr,
            read: false,
            createdAt: c.updatedAt,
          });
        }

        if (c.slaDueAt && c.status !== "Resolved" && c.status !== "Rejected") {
          const diffMs = new Date(c.slaDueAt).getTime() - Date.now();
          if (diffMs < 24 * 60 * 60 * 1000) {
            notifications.push({
              id: `off-sla-${c.complaintId}`,
              type: "sla",
              icon: "fa-clock",
              title: `Urgent: SLA Action Required`,
              text: `Complaint ${c.complaintId} has reached or is nearing its SLA resolution window.`,
              complaintId: c.complaintId,
              time: new Date(c.slaDueAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
              }),
              read: false,
              createdAt: new Date(c.slaDueAt),
            });
          }
        }
      });
    } else if (user.role === "admin") {
      // 1. Pending authority requests
      const pendingOfficers = await UserModel.find({
        role: "officer",
        verificationStatus: "pending",
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("fullName username email department designation createdAt")
        .lean();

      pendingOfficers.forEach((o) => {
        notifications.push({
          id: `req-${o._id}`,
          type: "message",
          icon: "fa-user-clock",
          title: `Authority Request: ${o.fullName || o.username}`,
          text: `${o.fullName || o.username} (${o.department} - ${o.designation}) is awaiting approval.`,
          complaintId: `REQ-${String(o._id).slice(-4).toUpperCase()}`,
          time: new Date(o.createdAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          read: false,
          createdAt: o.createdAt,
        });
      });

      // 2. Escalated complaints across the institution (including admin_attention)
      const escalatedComplaints = await Complaint.find({
        $or: [{ status: "Escalated" }, { escalationStatus: "admin_attention" }],
      })
        .sort({ updatedAt: -1 })
        .limit(15)
        .select("complaintId title department assignedDesignation currentEscalationLevel escalationStatus updatedAt")
        .lean();

      escalatedComplaints.forEach((c) => {
        const isAdminAttention = c.escalationStatus === "admin_attention";
        notifications.push({
          id: `adm-esc-${c.complaintId}-${c.currentEscalationLevel || 2}`,
          type: "sla",
          icon: isAdminAttention ? "fa-bell" : "fa-triangle-exclamation",
          title: isAdminAttention
            ? `Admin Attention Required: ${c.complaintId}`
            : `Institutional Escalation: ${c.complaintId}`,
          text: isAdminAttention
            ? `Grievance "${c.title}" reached highest departmental rank and requires executive Ombudsman review.`
            : `Grievance in ${c.department || "General"} escalated to ${c.assignedDesignation || `Level ${c.currentEscalationLevel || 2}`}.`,
          complaintId: c.complaintId,
          time: new Date(c.updatedAt).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
          }),
          read: false,
          createdAt: c.updatedAt,
        });
      });
    }

    // Sort notifications by date descending
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Fetch user read states to properly mark read/unread
    const userDoc = await UserModel.findById(user._id).select("readNotifications allNotificationsReadAt").lean();
    const readSet = new Set(userDoc?.readNotifications || []);
    const allReadAt = userDoc?.allNotificationsReadAt ? new Date(userDoc.allNotificationsReadAt).getTime() : 0;

    notifications.forEach((n) => {
      const notifTime = new Date(n.createdAt).getTime();
      if (readSet.has(n.id) || (allReadAt && notifTime <= allReadAt)) {
        n.read = true;
      }
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching notifications",
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ success: false, message: "Notification ID is required" });
    }

    await UserModel.findByIdAndUpdate(user._id, {
      $addToSet: { readNotifications: id.trim() },
    });

    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (error) {
    console.error("Error marking notification read:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    await UserModel.findByIdAndUpdate(user._id, {
      $set: { allNotificationsReadAt: new Date() },
    });

    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
