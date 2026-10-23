const rateLimit = require("express-rate-limit");

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    limit: 50,               
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many login attempts. Try again after 15 minutes."
    }
});

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 15,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many OTP attempts. Please try again after 10 minutes."
    }
});

module.exports = {
    generalLimiter,
    loginLimiter,
    otpLimiter
};