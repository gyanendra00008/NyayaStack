const jwt = require("jsonwebtoken");
const UserModel = require("../models/auth.models.js");
const { JWT_CONFIG } = require("../config/jwt.config.js");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

/**
 * Validates user input for registration
 */
async function validateUser(req, res, next) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email, and password are required",
      });
    }

    if (
      typeof username !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid input types. Username, email, and password must be strings.",
      });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Username must be between 3 and 30 characters long",
      });
    }

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        message: "Username can only contain alphanumeric characters, underscores, hyphens, and dots",
      });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
      });
    }

    // Force normalized inputs
    req.body.username = trimmedUsername;
    req.body.email = trimmedEmail;

    // Optional fullName and rollNo sanitization
    const rawFullName = req.body.fullName || req.body.name;
    if (typeof rawFullName === "string") {
      req.body.fullName = rawFullName.trim().slice(0, 100);
    } else {
      req.body.fullName = "";
    }

    const rawRollNo = req.body.rollNo || req.body.rollNumber || req.body.roll_no;
    if (typeof rawRollNo === "string" || typeof rawRollNo === "number") {
      req.body.rollNo = String(rawRollNo).trim().slice(0, 50);
    } else {
      req.body.rollNo = "";
    }

    // PREVENT PRIVILEGE ESCALATION: Never trust role from req.body during registration
    req.body.role = "user";

    next();
  } catch (error) {
    console.error("Error validating user registration:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * Check if the user already exists in the database for Registration
 */
async function isExistingUser(req, res, next) {
  const { username, email } = req.body;

  try {
    const existingUsers = await UserModel.find({
      $or: [{ username: username }, { email: email }],
    });

    if (existingUsers.length > 0) {
      const verifiedUser = existingUsers.find((u) => u.isVerified);
      if (verifiedUser) {
        if (verifiedUser.email === email) {
          return res.status(409).json({
            success: false,
            message: "User already exists with this email",
          });
        }
        return res.status(409).json({
          success: false,
          message: "Username is already taken",
        });
      }

      // If matching unverified user exists
      const matchingEmailUser = existingUsers.find((u) => u.email === email);
      const matchingUsernameUser = existingUsers.find((u) => u.username === username);

      // If username matches an unverified user with a different email, reject conflict
      if (matchingUsernameUser && matchingUsernameUser.email !== email) {
        return res.status(409).json({
          success: false,
          message: "Username is already taken",
        });
      }

      // Safe retry for the same unverified email
      if (matchingEmailUser) {
        // If the unverified user is changing username, ensure new username isn't taken
        if (matchingEmailUser.username !== username) {
          const usernameTaken = await UserModel.findOne({ username });
          if (usernameTaken && usernameTaken._id.toString() !== matchingEmailUser._id.toString()) {
            return res.status(409).json({
              success: false,
              message: "Username is already taken",
            });
          }
        }
        req.existingUnverifiedUser = matchingEmailUser;
        return next();
      }
    }

    next();
  } catch (error) {
    console.error("Error checking existing user:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * Validates request payload and user existence for Login
 */
async function isUser(req, res, next) {
  try {
    const rawIdentifier = req.body.identifier || req.body.email || req.body.username;
    const { password } = req.body;

    if (!rawIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username/email and password are required",
      });
    }

    if (typeof rawIdentifier !== "string" || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials format",
      });
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const identifier = rawIdentifier.trim().toLowerCase();

    // Query user and explicitly select password (which is excluded by default)
    const user = await UserModel.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { rollNo: rawIdentifier.trim() },
      ],
    }).select("+password");

    // Generic error message to prevent user enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/username or password",
      });
    }

    // Check authority verification status before regular verification
    if (user.role === "officer") {
      if (user.verificationStatus === "pending") {
        return res.status(403).json({
          success: false,
          message: "Your authority registration is pending administrator verification. Please wait for approval.",
        });
      }
      if (user.verificationStatus === "rejected") {
        return res.status(403).json({
          success: false,
          message: user.rejectionReason
            ? `Your authority registration was rejected by the administrator. Reason: ${user.rejectionReason}`
            : "Your authority registration was rejected by the administrator.",
        });
      }
      if (user.verificationStatus !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Your authority registration is pending administrator verification. Please wait for approval.",
        });
      }
    }

    // Reject unverified users (e.g. students who have not verified email OTP)
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Account not verified. Please verify your email before logging in.",
      });
    }

    req.user = user;
    req.loginPassword = password;
    next();
  } catch (error) {
    console.error("Error checking user for login:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

/**
 * Validates request payload for forgot password endpoint
 */
function validateForgotPassword(req, res, next) {
  const identifier = req.body.email || req.body.username || req.body.identifier;

  if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
    return res.status(400).json({
      success: false,
      message: "Username or email is required",
    });
  }

  req.identifier = identifier.trim().toLowerCase();
  next();
}

/**
 * Validates request payload for verify reset OTP endpoint
 */
function validateVerifyResetOtp(req, res, next) {
  const identifier = req.body.email || req.body.username || req.body.identifier;
  const { otp } = req.body;

  if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
    return res.status(400).json({
      success: false,
      message: "Username or email is required",
    });
  }

  if (!otp || typeof otp !== "string" && typeof otp !== "number") {
    return res.status(400).json({
      success: false,
      message: "OTP is required",
    });
  }

  const otpString = String(otp).trim();
  if (!/^\d{6}$/.test(otpString)) {
    return res.status(400).json({
      success: false,
      message: "OTP must be a valid 6-digit code",
    });
  }

  req.identifier = identifier.trim().toLowerCase();
  req.otp = otpString;
  next();
}

/**
 * Validates request payload for reset password endpoint
 */
function validateResetPassword(req, res, next) {
  const token =
    (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null) ||
    req.body.resetToken ||
    (req.cookies && req.cookies.resetToken);

  const newPassword = req.body.newPassword || req.body.password;

  if (!token || typeof token !== "string") {
    return res.status(400).json({
      success: false,
      message: "Reset token is required (provide in Authorization header, resetToken field, or cookie)",
    });
  }

  if (!newPassword || typeof newPassword !== "string") {
    return res.status(400).json({
      success: false,
      message: "New password is required and must be a string",
    });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    });
  }

  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `New password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
    });
  }

  req.resetToken = token;
  req.newPassword = newPassword;
  next();
}

/**
 * Validates request payload for change password endpoint
 */
function validateChangePassword(req, res, next) {
  const oldPassword = req.body.oldPassword || req.body.currentPassword;
  const newPassword = req.body.newPassword;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Both oldPassword and newPassword are required",
    });
  }

  if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({
      success: false,
      message: "Both passwords must be strings",
    });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    });
  }

  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `New password must not exceed ${MAX_PASSWORD_LENGTH} characters`,
    });
  }

  req.oldPassword = oldPassword;
  req.newPassword = newPassword;
  next();
}

/**
 * Strict JWT authentication middleware for protected routes
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token required. Please log in.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: [JWT_CONFIG.algorithm],
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token",
      });
    }

    // Prevent password reset token from being used as session authentication
    if (decoded.purpose === "password_reset") {
      return res.status(401).json({
        success: false,
        message: "Invalid token type for session authentication",
      });
    }

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Malformed authentication token",
      });
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    // Enforce email verification requirement on protected resources
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Email verification required. Please verify your email first.",
      });
    }

    // Session revocation check via tokenVersion
    if (
      user.tokenVersion !== undefined &&
      decoded.tokenVersion !== undefined &&
      decoded.tokenVersion !== user.tokenVersion
    ) {
      return res.status(401).json({
        success: false,
        message: "Session expired or revoked. Please log in again.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ success: false, message: "Internal server error during authentication" });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware
 * Enforces that authenticated user possesses one of the authorized roles
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You do not have permission to access this resource",
      });
    }

    // If an officer is accessing, verify that their account has been approved by admin
    if (req.user.role === "officer" && req.user.verificationStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Authority account is not approved by administrator",
      });
    }

    next();
  };
}

/**
 * Backward compatibility: authenticateOrIdentifyUser now strictly enforces authentication
 */
async function authenticateOrIdentifyUser(req, res, next) {
  return authenticateUser(req, res, next);
}

module.exports = {
  isExistingUser,
  isUser,
  validateUser,
  validateForgotPassword,
  validateVerifyResetOtp,
  validateResetPassword,
  validateChangePassword,
  authenticateUser,
  authorizeRoles,
  authenticateOrIdentifyUser,
};
