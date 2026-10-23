const express = require("express");
const {
  registerUser,
  login,
  verifyOtp,
  resendOtp,
} = require("../controllers/auth.controller.js");
const { isExistingUser, isUser } = require("../middleware/auth.middleware.js");
const { generalLimiter, loginLimiter, otpLimiter } = require("../middleware/rateLimit.middleware.js");
const { validateUser } = require("../middleware/auth.middleware.js");

const router = express.Router();

// Register a new user
router.post("/register", validateUser, isExistingUser, registerUser);
router.post("/login", loginLimiter, isUser, login);
router.post("/verify-otp", otpLimiter, verifyOtp);
router.post("/resend-otp", otpLimiter, resendOtp);

module.exports = router;