const express = require("express");
const { registerUser } = require("../controllers/auth.controller.js");
const { isExistingUser } = require("../middleware/auth.middleware.js");

const router = express.Router();

// Register a new user
router.post("/register", isExistingUser, registerUser);

module.exports = router;