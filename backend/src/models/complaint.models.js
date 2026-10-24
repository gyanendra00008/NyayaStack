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
  "In Review",
  "In Progress",
  "Resolved",
  "Rejected",
];

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
