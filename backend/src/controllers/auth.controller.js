const crypto = require("crypto");
const UserModel = require("../models/auth.models.js");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
  isOtpExpired,
} = require("../utils/otp.utils.js");
const { sendOtpEmail, sendPasswordResetOtpEmail } = require("../services/mail.service.js");
const {
  JWT_CONFIG,
  getAuthCookieOptions,
  getResetCookieOptions,
  getClearCookieOptions,
} = require("../config/jwt.config.js");

const BCRYPT_SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

/**
 * Public User Registration
 * Forces role: 'user' regardless of request payload
 */
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate cryptographically secure OTP
    const otp = generateOtp(6);
    const hashedOtp = hashOtp(otp);
    const otpExpires = getOtpExpiry(10);

    let userRecord;
    if (req.existingUnverifiedUser) {
      userRecord = req.existingUnverifiedUser;
      userRecord.username = username;
      userRecord.password = hashedPassword;
      // PREVENT PRIVILEGE ESCALATION: Never allow unverified retries to alter role
      userRecord.role = "user";
      userRecord.otp = hashedOtp;
      userRecord.otpExpires = otpExpires;
      userRecord.otpAttempts = 0;
      userRecord.otpLastSentAt = new Date();
      await userRecord.save();
    } else {
      userRecord = await UserModel.create({
        username,
        email,
        password: hashedPassword,
        role: "user", // Strictly user role
        isVerified: false,
        otp: hashedOtp,
        otpExpires,
        otpAttempts: 0,
        otpLastSentAt: new Date(),
      });
    }

    // Dispatch verification email
    try {
      await sendOtpEmail({
        to: email,
        otp,
        name: username,
      });
    } catch (mailError) {
      console.error("Failed to send OTP email during registration:", mailError?.message || mailError);
      return res.status(500).json({
        success: false,
        message: "Account registered, but verification email could not be delivered. Please try requesting a new OTP.",
      });
    }

    // DO NOT issue authentication token or cookie before email verification
    res.status(201).json({
      success: true,
      message: "User registered successfully. Verification OTP sent to email.",
      user: {
        id: userRecord._id,
        username: userRecord.username,
        email: userRecord.email,
        role: userRecord.role,
        isVerified: userRecord.isVerified,
      },
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Verify Registration OTP
 * Issues normal auth token and cookie only upon successful verification
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedOtp = String(otp).trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      return res.status(400).json({ success: false, message: "OTP must be a valid 6-digit code" });
    }

    const user = await UserModel.findOne({ email: normalizedEmail }).select("+otp");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ success: false, message: "No OTP request found for this user" });
    }

    if (isOtpExpired(user.otpExpires)) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one" });
    }

    // Failed-attempts lock
    if ((user.otpAttempts || 0) >= MAX_FAILED_ATTEMPTS) {
      user.otp = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    const isOtpValid = verifyOtpHash(normalizedOtp, user.otp);
    if (!isOtpValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Mark verified and clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    // Issue session JWT token and secure cookie
    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: JWT_CONFIG.expiresIn }
    );

    res.cookie("token", token, getAuthCookieOptions());

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Resend Verification OTP
 * Enforces cooldown and invalidates previous OTP
 */
const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await UserModel.findOne({ email: normalizedEmail }).select("+otp");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "Email is already verified" });
    }

    // Cooldown check to prevent email bombing
    if (user.otpLastSentAt && Date.now() - new Date(user.otpLastSentAt).getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(user.otpLastSentAt).getTime())) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting another verification code.`,
      });
    }

    // Generate fresh OTP (invalidates previous OTP)
    const otp = generateOtp(6);
    user.otp = hashOtp(otp);
    user.otpExpires = getOtpExpiry(10);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    try {
      await sendOtpEmail({
        to: user.email,
        otp,
        name: user.username,
      });
    } catch (mailError) {
      console.error("Failed to resend OTP email:", mailError?.message || mailError);
      return res.status(500).json({
        success: false,
        message: "Failed to dispatch verification email. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * User Login
 * Compares password hash, rejects unverified users, issues secure JWT
 */
const login = async (req, res) => {
  try {
    const user = req.user;
    const password = req.loginPassword;

    // Verify password against stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password",
      });
    }

    // Issue JWT with explicit expiration and algorithm
    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: JWT_CONFIG.expiresIn }
    );

    res.cookie("token", token, getAuthCookieOptions());

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Step 1 of Forgot Password flow:
 * Generates OTP and sends to registered email.
 * Avoids user enumeration by returning generic response.
 */
const forgotPassword = async (req, res) => {
  try {
    const identifier = req.identifier;

    const user = await UserModel.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    // Prevent user enumeration: return generic message even if user does not exist
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account with that email or username exists, a password reset code has been sent.",
      });
    }

    // Cooldown check to prevent email flooding
    if (
      user.resetPasswordLastSentAt &&
      Date.now() - new Date(user.resetPasswordLastSentAt).getTime() < RESEND_COOLDOWN_MS
    ) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - new Date(user.resetPasswordLastSentAt).getTime())) / 1000
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting another reset code.`,
      });
    }

    const otp = generateOtp(6);
    user.resetPasswordOtp = hashOtp(otp);
    user.resetPasswordExpires = getOtpExpiry(10);
    user.resetPasswordAttempts = 0;
    user.resetPasswordLastSentAt = new Date();
    await user.save();

    try {
      await sendPasswordResetOtpEmail({
        to: user.email,
        otp,
        name: user.username,
        expiryMinutes: 10,
      });
    } catch (mailError) {
      console.error("Failed to send password reset OTP email:", mailError?.message || mailError);
      return res.status(500).json({
        success: false,
        message: "Unable to dispatch password reset email. Please try again later.",
      });
    }

    // Return generic response without leaking personal email
    res.status(200).json({
      success: true,
      message: "If an account with that email or username exists, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Step 2 of Forgot Password flow:
 * Verifies OTP and issues a short-lived, single-use JWT reset token.
 */
const verifyResetOtp = async (req, res) => {
  try {
    const identifier = req.identifier;
    const otp = req.otp;

    const user = await UserModel.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+resetPasswordOtp");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset request",
      });
    }

    if (!user.resetPasswordOtp || !user.resetPasswordExpires) {
      return res.status(400).json({
        success: false,
        message: "No password reset request found for this user. Please request an OTP first.",
      });
    }

    if (isOtpExpired(user.resetPasswordExpires)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one",
      });
    }

    // Failed-attempt limits
    if ((user.resetPasswordAttempts || 0) >= MAX_FAILED_ATTEMPTS) {
      user.resetPasswordOtp = undefined;
      user.resetPasswordExpires = undefined;
      user.resetPasswordAttempts = 0;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP.",
      });
    }

    const isMatch = verifyOtpHash(otp, user.resetPasswordOtp);
    if (!isMatch) {
      user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Invalidate the reset OTP immediately upon successful verification
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordAttempts = 0;

    // Single-use token tracking via jti & server-side hash
    const jti = crypto.randomUUID();
    user.resetPasswordTokenHash = hashOtp(jti);
    user.resetPasswordTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // Issue short-lived JWT reset token valid for 15 minutes
    const resetToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        purpose: "password_reset",
        jti,
      },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: JWT_CONFIG.resetExpiresIn }
    );

    res.cookie("resetToken", resetToken, getResetCookieOptions());

    res.status(200).json({
      success: true,
      message: "OTP verified successfully. You can now reset your password.",
      resetToken,
    });
  } catch (error) {
    console.error("Error in verifyResetOtp:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Step 3 of Forgot Password flow:
 * Receives JWT resetToken and newPassword.
 * Verifies single-use state, updates password, and revokes all active sessions.
 */
const resetPassword = async (req, res) => {
  try {
    const token = req.resetToken;
    const newPassword = req.newPassword;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: [JWT_CONFIG.algorithm],
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired reset token. Please request a new OTP.",
      });
    }

    if (decoded.purpose !== "password_reset" || !decoded.jti) {
      return res.status(403).json({
        success: false,
        message: "Invalid token purpose",
      });
    }

    const user = await UserModel.findById(decoded.id).select("+resetPasswordTokenHash");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // Verify single-use token validity in database
    if (!user.resetPasswordTokenHash || !user.resetPasswordTokenExpires) {
      return res.status(401).json({
        success: false,
        message: "Reset token has already been used or has expired. Please request a new password reset.",
      });
    }

    if (Date.now() > new Date(user.resetPasswordTokenExpires).getTime()) {
      return res.status(401).json({
        success: false,
        message: "Reset token has expired. Please request a new password reset.",
      });
    }

    const isJtiMatch = verifyOtpHash(decoded.jti, user.resetPasswordTokenHash);
    if (!isJtiMatch) {
      return res.status(401).json({
        success: false,
        message: "Reset token has already been used or is invalid.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.password = hashedPassword;

    // Immediately invalidate the reset token state to prevent reuse
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordTokenExpires = undefined;

    // Increment tokenVersion to invalidate any existing login sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.clearCookie("resetToken", getClearCookieOptions());

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Change Password API:
 * Strictly requires authenticated identity.
 * Verifies current password and updates to new password.
 */
const changePassword = async (req, res) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const oldPassword = req.oldPassword;
    const newPassword = req.newPassword;

    // Fetch user with password hash
    const user = await UserModel.findById(authUser._id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Prevent reusing identical password
    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    user.password = hashedPassword;

    // Increment tokenVersion to revoke old sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Issue updated token for current user session
    const token = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: JWT_CONFIG.expiresIn }
    );

    res.cookie("token", token, getAuthCookieOptions());

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      token,
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Returns current authenticated user profile
 */
const getCurrentUser = async (req, res) => {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      isVerified: req.user.isVerified,
    },
  });
};

/**
 * Administrative resource endpoint for RBAC verification
 */
const adminDashboard = async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin access granted",
    role: req.user.role,
  });
};

module.exports = {
  registerUser,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
  getCurrentUser,
  adminDashboard,
};
