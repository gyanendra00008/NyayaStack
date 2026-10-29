const express = require("express");
const router = express.Router();
const {
  classifyComplaintController,
} = require("../controllers/complaintClassifier.controller.js");

// POST /api/classify-complaint
router.post("/", classifyComplaintController);

module.exports = router;
