const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username must be at most 30 characters long"],
      match: [/^[a-zA-Z0-9_.-]+$/, "Username can only contain alphanumeric characters, underscores, hyphens, and dots"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false, // Exclude password hash from queries by default
    },
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    rollNo: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "officer", "admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false,
    },
    otpExpires: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: {
      type: Date,
    },
    resetPasswordOtp: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
    },
    resetPasswordAttempts: {
      type: Number,
      default: 0,
    },
    resetPasswordLastSentAt: {
      type: Date,
    },
    resetPasswordTokenHash: {
      type: String,
      select: false,
    },
    resetPasswordTokenExpires: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.otp;
        delete ret.resetPasswordOtp;
        delete ret.resetPasswordTokenHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.otp;
        delete ret.resetPasswordOtp;
        delete ret.resetPasswordTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const UserModel = mongoose.model("User", userSchema);
module.exports = UserModel;
