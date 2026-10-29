const express = require("express");
const {
  registerUser,
  registerAuthority,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
  getCurrentUser,
  adminDashboard,
} = require("../controllers/auth.controller.js");
const {
  isExistingUser,
  isUser,
  setExpectedRole,
  validateUser,
  validateForgotPassword,
  validateVerifyResetOtp,
  validateResetPassword,
  validateChangePassword,
  authenticateUser,
  authorizeRoles,
} = require("../middleware/auth.middleware.js");
const {
  loginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetLimiter,
} = require("../middleware/rateLimit.middleware.js");

const router = express.Router();

// Registration & Verification
router.post("/register", registerLimiter, validateUser, isExistingUser, registerUser);
router.post("/authority/register", registerLimiter, registerAuthority);
router.post("/verify-otp", otpLimiter, verifyOtp);
router.post("/resend-otp", otpLimiter, resendOtp);

// Login
router.post("/login", loginLimiter, isUser, login);
router.post("/user/login", loginLimiter, setExpectedRole("user"), isUser, login);
router.post("/authority/login", loginLimiter, setExpectedRole("officer"), isUser, login);
router.post("/admin/login", loginLimiter, setExpectedRole("admin"), isUser, login);

// Forgot Password Flow
// Step 1: Request OTP by providing username or email
router.post("/forgot-password", otpLimiter, validateForgotPassword, forgotPassword);
router.post("/forget-password", otpLimiter, validateForgotPassword, forgotPassword); // Alias for compatibility

// Step 2: Verify OTP and receive short-lived single-use JWT reset token
router.post("/verify-reset-otp", otpLimiter, validateVerifyResetOtp, verifyResetOtp);
router.post("/verify-forget-otp", otpLimiter, validateVerifyResetOtp, verifyResetOtp); // Alias for compatibility

// Step 3: Enter new password with single-use JWT reset token
router.post("/reset-password", passwordResetLimiter, validateResetPassword, resetPassword);

// Change Password (strictly requires authenticated session)
router.post("/change-password", loginLimiter, authenticateUser, validateChangePassword, changePassword);

// Protected routes to inspect profile and RBAC
router.get("/me", authenticateUser, getCurrentUser);
router.get("/admin/dashboard", authenticateUser, authorizeRoles("admin"), adminDashboard);

module.exports = router;
