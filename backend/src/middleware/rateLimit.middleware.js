const rateLimit = require("express-rate-limit");

const isTest = process.env.NODE_ENV === "test";

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10000 : 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10000 : 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again after 15 minutes.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10000 : 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Try again after 15 minutes.",
  },
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: isTest ? 10000 : 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP attempts. Please try again after 10 minutes.",
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10000 : 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again after 15 minutes.",
  },
});

module.exports = {
  generalLimiter,
  loginLimiter,
  registerLimiter,
  otpLimiter,
  passwordResetLimiter,
};
