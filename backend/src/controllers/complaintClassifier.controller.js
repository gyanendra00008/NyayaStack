const {
  classifyComplaint,
} = require("../services/complaintClassifier.service.js");

/**
 * Controller to classify college complaints using Google Gemini API.
 * Accepts title and description in req.body.
 */
async function classifyComplaintController(req, res) {
  const { title, description } = req.body || {};

  // Input validation
  if (typeof title !== "string" || typeof description !== "string") {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Both 'title' and 'description' are required and must be strings.",
    });
  }

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (!trimmedTitle || !trimmedDescription) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "'title' and 'description' cannot be empty or whitespace-only.",
    });
  }

  if (trimmedTitle.length > 300) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Title cannot exceed 300 characters.",
    });
  }

  if (trimmedDescription.length > 5000) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Description cannot exceed 5000 characters.",
    });
  }

  try {
    const classification = await classifyComplaint(trimmedTitle, trimmedDescription);

    return res.status(200).json({
      success: true,
      category: classification.category,
      department: classification.department,
      classification: {
        department: classification.department,
        category: classification.category,
        explanation: classification.explanation,
        needsHumanReview: classification.needsHumanReview,
      },
    });
  } catch (err) {
    // Diagnostic log without secrets, API keys, or complaint content
    console.error("[Complaint Classifier Error]:", {
      code: err.code || "UNKNOWN",
      status: err.status || 500,
      message: err.message,
    });

    if (err.code === "VALIDATION_ERROR") {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: err.message,
      });
    }

    if (err.code === "CONFIG_ERROR") {
      return res.status(500).json({
        success: false,
        code: "CONFIG_ERROR",
        message: "AI classification service is not properly configured.",
      });
    }

    if (err.code === "AI_QUOTA_EXHAUSTED" || err.status === 429) {
      return res.status(429).json({
        success: false,
        code: "AI_QUOTA_EXHAUSTED",
        message: "AI classification is temporarily unavailable due to quota limits. Please try again later or select a category manually.",
      });
    }

    if (
      err.code === "AI_SERVICE_UNAVAILABLE" ||
      err.status === 503 ||
      /high demand|UNAVAILABLE/i.test(err.message || "")
    ) {
      return res.status(503).json({
        success: false,
        code: "AI_SERVICE_UNAVAILABLE",
        message: "AI classification is temporarily unavailable. Please try again shortly.",
      });
    }

    if (err.code === "AI_TIMEOUT" || err.name === "AbortError" || /timeout/i.test(err.message || "")) {
      return res.status(504).json({
        success: false,
        code: "AI_TIMEOUT",
        message: "AI classification request timed out.",
      });
    }

    if (err.code === "INVALID_MODEL_OUTPUT" || err.code === "EMPTY_MODEL_RESPONSE") {
      return res.status(502).json({
        success: false,
        code: "INVALID_MODEL_OUTPUT",
        message: "Failed to receive a valid response from the AI model.",
      });
    }

    return res.status(500).json({
      success: false,
      code: "AI_INTERNAL_ERROR",
      message: "An internal error occurred while classifying the complaint.",
    });
  }
}

module.exports = {
  classifyComplaintController,
};
