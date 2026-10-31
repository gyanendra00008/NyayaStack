const mongoose = require("mongoose");
const { getStorageConnection } = require("../config/db.js");

const COMPLAINT_CATEGORIES = [
  "Hostel",
  "Academic",
  "Infrastructure",
  "Administration",
  "Finance",
  "Harassment",
  "Ragging",
  "Discipline",
  "Mess",
  "Transport",
  "Medical",
  "Other",
];

const COMPLAINT_STATUSES = [
  "Filed",
  "Assigned",
  "In Review",
  "In Progress",
  "Resolved",
  "Rejected",
  "Escalated",
];

// SLA (in days) per category. Change values here as per college policy.
const SLA_DAYS = {
  Harassment: 2,
  Ragging: 2,
  Medical: 2,
  Hostel: 3,
  Mess: 3,
  Transport: 3,
  Infrastructure: 5,
  Discipline: 5,
  Academic: 7,
  Administration: 7,
  Finance: 7,
  Other: 7,
};

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Attachment URL is required"],
      trim: true,
    },
    publicId: {
      type: String,
      required: [true, "Attachment public ID is required"],
      trim: true,
    },
    resourceType: {
      type: String,
      required: [true, "Attachment resource type is required"],
      trim: true,
    },
    format: {
      type: String,
      required: [true, "Attachment format is required"],
      trim: true,
    },
    size: {
      type: Number,
      required: [true, "Attachment file size is required"],
      min: [1, "Attachment file size must be greater than 0"],
    },
    originalName: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
    },
  },
  { _id: false }
);

const escalationHistorySchema = new mongoose.Schema(
  {
    previousAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    previousAssignedDesignation: {
      type: String,
      trim: true,
      default: "",
    },
    newAssignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    newAssignedDesignation: {
      type: String,
      trim: true,
      default: "",
    },
    previousLevel: {
      type: Number,
      required: true,
    },
    newLevel: {
      type: Number,
      required: true,
    },
    escalatedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      trim: true,
      default: "SLA resolution window expired (48h elapsed without resolution)",
    },
    previousDeadline: {
      type: Date,
      default: null,
    },
    newDeadline: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: [true, "Complaint ID is required"],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "User ID is required"],
      index: true,
    },
    category: {
      type: String,
      required: [true, "Complaint category is required"],
      enum: {
        values: COMPLAINT_CATEGORIES,
        message: "Invalid complaint category. Supported categories: " + COMPLAINT_CATEGORIES.join(", "),
      },
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Complaint title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters long"],
      maxlength: [200, "Title must not exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Complaint description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters long"],
      maxlength: [5000, "Description must not exceed 5000 characters"],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: "Filed",
    },
    // SLA fields
    slaDueAt: {
      type: Date,
      index: true,
    },
    resolvedAt: {
      type: Date,
    },
    department: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    assignedDesignation: {
      type: String,
      trim: true,
      default: "",
    },
    assignedRank: {
      type: Number,
      default: null,
    },
    priority: {
      type: String,
      trim: true,
      default: "Medium (Standard SLA 48h)",
    },
    isAnonymous: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ── Time-based Hierarchical Escalation Fields ──────────────────────────────
    currentEscalationLevel: {
      type: Number,
      default: 1,
      min: 1,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    resolutionDeadline: {
      type: Date,
      index: true,
    },
    escalationStatus: {
      type: String,
      enum: ["normal", "escalated", "admin_attention"],
      default: "normal",
      index: true,
    },
    escalationHistory: {
      type: [escalationHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// New complaint: set slaDueAt and time-based escalation resolutionDeadline
complaintSchema.pre("validate", function () {
  if (this.isNew && !this.slaDueAt) {
    const days = SLA_DAYS[this.category] ?? 7;
    this.slaDueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  if (this.isNew) {
    if (!this.assignedAt) {
      this.assignedAt = new Date();
    }
    if (!this.resolutionDeadline) {
      const parsedHours = parseInt(process.env.ESCALATION_WINDOW_HOURS, 10);
      const hours = !isNaN(parsedHours) && parsedHours > 0 ? parsedHours : 48;
      this.resolutionDeadline = new Date(this.assignedAt.getTime() + hours * 60 * 60 * 1000);
    }
  }
});

// Status changed: set / clear resolvedAt
// NOTE: works only with doc.save(), not findOneAndUpdate / updateOne
complaintSchema.pre("save", function () {
  if (!this.isNew && this.isModified("status")) {
    if (this.status === "Resolved") {
      this.resolvedAt = new Date();
    } else {
      this.resolvedAt = undefined; // reopened
    }
  }
});

complaintSchema.index({ userId: 1, createdAt: -1 });

/**
 * Returns the Complaint model registered strictly on the storage connection.
 * Avoids registering the model on the primary authentication database.
 */
function getComplaintModel() {
  const connection = getStorageConnection();
  if (connection.models && connection.models["Complaint"]) {
    return connection.models["Complaint"];
  }
  return connection.model("Complaint", complaintSchema);
}

// Transparent Proxy so callers can use Complaint.find(), Complaint.create(), new Complaint() etc.
const Complaint = new Proxy(function () {}, {
  get(target, prop) {
    if (prop === "getComplaintModel") return getComplaintModel;
    if (prop === "COMPLAINT_CATEGORIES") return COMPLAINT_CATEGORIES;
    if (prop === "COMPLAINT_STATUSES") return COMPLAINT_STATUSES;
    if (prop === "SLA_DAYS") return SLA_DAYS;
    if (prop === "schema") return complaintSchema;

    const model = getComplaintModel();
    const value = model[prop];
    if (typeof value === "function") {
      return value.bind(model);
    }
    return value;
  },
  set(target, prop, value) {
    const model = getComplaintModel();
    model[prop] = value;
    return true;
  },
  construct(target, args) {
    const model = getComplaintModel();
    return new model(...args);
  },
  apply(target, thisArg, args) {
    const model = getComplaintModel();
    return model.apply(thisArg, args);
  },
});

module.exports = Complaint;