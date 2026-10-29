/**
 * Automatic Time-Based Hierarchical Escalation Service
 * NyayaStack Grievance Redressal Engine
 */

const Complaint = require("../models/complaint.models");
const UserModel = require("../models/auth.models");
const { findNextHigherAuthority } = require("../utils/hierarchy.utils");

const DEFAULT_ESCALATION_HOURS = 48;

/**
 * Checks and escalates all unresolved complaints whose resolution deadline has expired.
 * Uses atomic conditional updates (optimistic concurrency lock on currentEscalationLevel and deadline)
 * to guarantee that concurrent workers or scheduler runs cannot escalate the same complaint twice.
 *
 * @param {Object} options
 * @param {Date} [options.now=new Date()] Mockable timestamp for testing
 * @param {number} [options.windowHours] Allotted hours for the next authority (defaults to env or 48h)
 * @returns {Promise<{ checked: number, escalated: number, results: Array, errors: Array }>}
 */
async function escalateDueComplaints({ now = new Date(), windowHours = null, complaintId = null } = {}) {
  const effectiveNow = now instanceof Date ? now : new Date(now);
  const allottedHours =
    typeof windowHours === "number" && windowHours > 0
      ? windowHours
      : parseInt(process.env.ESCALATION_WINDOW_HOURS || `${DEFAULT_ESCALATION_HOURS}`, 10);

  // 1. Query all unresolved complaints due for escalation
  // Unresolved = status not in ['Resolved', 'Rejected']
  // Expired = resolutionDeadline <= now (or fallback to slaDueAt <= now for older complaints)
  // Not already at top level = escalationStatus != 'admin_attention'
  const dueQuery = {
    status: { $nin: ["Resolved", "Rejected"] },
    escalationStatus: { $ne: "admin_attention" },
    $or: [
      { resolutionDeadline: { $lte: effectiveNow } },
      {
        resolutionDeadline: null,
        slaDueAt: { $lte: effectiveNow },
      },
    ],
  };

  if (complaintId) {
    dueQuery.complaintId = complaintId;
  }

  const dueComplaints = await Complaint.find(dueQuery).lean();

  const results = [];
  const errors = [];

  for (const complaint of dueComplaints) {
    try {
      const currentLevel = complaint.currentEscalationLevel || 1;
      const nextLevel = currentLevel + 1;
      const nextDeadline = new Date(effectiveNow.getTime() + allottedHours * 60 * 60 * 1000);

      // Determine next higher authority within the same department
      const nextAuthority = await findNextHigherAuthority({
        department: complaint.department,
        category: complaint.category,
        currentRank: complaint.assignedRank,
        currentOfficerId: complaint.assignedTo,
        UserModel,
      });

      const historyEntry = {
        previousAssignedTo: complaint.assignedTo || null,
        previousAssignedDesignation: complaint.assignedDesignation || "",
        newAssignedTo: nextAuthority.assignedTo || null,
        newAssignedDesignation: nextAuthority.assignedDesignation || "",
        previousLevel: currentLevel,
        newLevel: nextLevel,
        escalatedAt: effectiveNow,
        reason: nextAuthority.requiresAdminAttention
          ? "SLA resolution window expired; highest departmental authority reached, flagged for Admin attention"
          : `SLA resolution window expired (${allottedHours}h elapsed without resolution)`,
        previousDeadline: complaint.resolutionDeadline || complaint.slaDueAt || effectiveNow,
        newDeadline: nextDeadline,
      };

      // 2. Atomic conditional update to prevent duplicate or concurrent escalations
      // Re-verifies status, deadline, and level atomically in MongoDB
      const updateFilter = {
        _id: complaint._id,
        status: { $nin: ["Resolved", "Rejected"] },
        escalationStatus: { $ne: "admin_attention" },
        $and: [
          {
            $or: [
              { currentEscalationLevel: currentLevel },
              { currentEscalationLevel: { $exists: false } },
            ],
          },
        ],
      };
      if (complaint.resolutionDeadline) {
        updateFilter.resolutionDeadline = complaint.resolutionDeadline;
      } else {
        updateFilter.$and.push({
          $or: [{ resolutionDeadline: null }, { resolutionDeadline: { $exists: false } }],
        });
      }

      const updateFields = {
        currentEscalationLevel: nextLevel,
        assignedAt: effectiveNow,
        resolutionDeadline: nextDeadline,
        assignedTo: nextAuthority.assignedTo || null,
        assignedDesignation: nextAuthority.assignedDesignation || "",
        assignedRank: nextAuthority.assignedRank,
        status: "Escalated",
        escalationStatus: nextAuthority.requiresAdminAttention ? "admin_attention" : "escalated",
      };

      const updatedComplaint = await Complaint.findOneAndUpdate(
        updateFilter,
        {
          $set: updateFields,
          $push: { escalationHistory: historyEntry },
        },
        { returnDocument: "after" }
      );

      // If null, a concurrent worker already escalated or resolved this complaint
      if (!updatedComplaint) {
        continue;
      }

      results.push({
        complaintId: complaint.complaintId,
        previousLevel: currentLevel,
        newLevel: nextLevel,
        escalatedTo: nextAuthority.assignedDesignation,
        escalationStatus: updatedComplaint.escalationStatus,
        newDeadline: nextDeadline,
      });
    } catch (err) {
      errors.push({
        complaintId: complaint.complaintId,
        error: err.message,
      });
    }
  }

  return {
    checked: dueComplaints.length,
    escalated: results.length,
    results,
    errors,
  };
}

/**
 * Starts the automatic background escalation interval timer.
 * Designed for continuous background execution in production (e.g. Render Web Service).
 *
 * @param {Object} [options]
 * @param {number} [options.intervalMs] Interval in milliseconds (defaults to 5 minutes)
 * @returns {{ stop: Function, intervalId: any }}
 */
function startEscalationScheduler({ intervalMs = null } = {}) {
  const interval =
    typeof intervalMs === "number" && intervalMs > 0
      ? intervalMs
      : parseInt(process.env.ESCALATION_CHECK_INTERVAL_MS || "300000", 10); // 5 mins

  let isRunning = false;

  const timer = setInterval(async () => {
    if (isRunning) return; // Prevent overlapping runs
    isRunning = true;
    try {
      const summary = await escalateDueComplaints();
      if (summary.escalated > 0) {
        console.log(`[Escalation Scheduler] Successfully escalated ${summary.escalated} complaints.`);
      }
    } catch (err) {
      console.error("[Escalation Scheduler Error]:", err.message);
    } finally {
      isRunning = false;
    }
  }, interval);

  // Unref timer so it doesn't block graceful Node shutdown
  if (timer.unref) {
    timer.unref();
  }

  return {
    stop: () => clearInterval(timer),
    timer,
  };
}

module.exports = {
  DEFAULT_ESCALATION_HOURS,
  escalateDueComplaints,
  startEscalationScheduler,
};
