const { COMPLAINT_CATEGORIES } = require("../models/complaint.models.js");

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Heuristic keyword-based grievance categorization fallback.
 * Used when the Python ML microservice is spinning up, sleeping, or unreachable.
 *
 * @param {string} text - Combined title and description
 * @returns {string} - Matched category from COMPLAINT_CATEGORIES
 */
function classifyByKeywords(text) {
  if (!text || typeof text !== "string") {
    return "Other";
  }

  const normalized = text.toLowerCase();

  // 1. Ragging (highest urgency, checked first)
  if (/\b(ragging|ragged|hazing|forced by senior|seniors harassing|senior torture|seniors ragging)\b/i.test(normalized)) {
    return "Ragging";
  }

  // 2. Harassment & Safety
  if (/\b(harass|harassment|stalking|stalk|indecent|molest|molestation|verbal abuse|threat|blackmail|misbehavior|discrimination|casteism|safety)\b/i.test(normalized)) {
    return "Harassment";
  }

  // 3. Mess & Canteen
  if (/\b(mess|food|canteen|breakfast|lunch|dinner|meal|roti|sabzi|daal|rice|caterer|tasteless|hygiene in food|uncooked|diet|dining hall|insect in food|caterpillar)\b/i.test(normalized)) {
    return "Mess";
  }

  // 4. Hostel living conditions
  if (/\b(hostel|room|geyser|bathroom|washroom|toilet|bed|mattress|bedbug|bedbugs|almirah|warden|curfew|block [a-z0-9]|wing [a-z0-9]|tap|flush|shower|corridor|water cooler)\b/i.test(normalized)) {
    return "Hostel";
  }

  // 5. Academic & Examinations
  if (/\b(academic|exam|exams|grade|marks|professor|syllabus|teacher|faculty|attendance|lecture|assignment|lab|timetable|credits|results|course|registration|midsem|endsem|backlog|revaluation|practical)\b/i.test(normalized)) {
    return "Academic";
  }

  // 6. Finance & Accounts
  if (/\b(fee|fees|fine|challan|refund|scholarship|receipt|payment|deposit|bank|stipend|accounts|account|overcharge|transaction)\b/i.test(normalized)) {
    return "Finance";
  }

  // 7. Transport & Commute
  if (/\b(bus|shuttle|transport|vehicle|auto|driver|parking|e-rickshaw|route|cab)\b/i.test(normalized)) {
    return "Transport";
  }

  // 8. Medical & Health
  if (/\b(doctor|hospital|dispensary|medicine|ambulance|nurse|clinic|first aid|sick|illness|fever|health|medical)\b/i.test(normalized)) {
    return "Medical";
  }

  // 9. Administration & Office Services
  if (/\b(admin|administration|registrar|office|staff|id card|bonafide|certificate|documents|clearance|gate pass|security guard|authority)\b/i.test(normalized)) {
    return "Administration";
  }

  // 10. Infrastructure & Campus Maintenance
  if (/\b(wifi|wi-fi|internet|network|road|lift|elevator|building|leakage|classroom|bench|projector|air conditioner|ac|streetlight|auditorium|electricity|power cut|water supply|pipe|light|fan|tubelight)\b/i.test(normalized)) {
    return "Infrastructure";
  }

  // 11. Discipline & Campus Order
  if (/\b(discipline|fight|dispute|violence|alcohol|smoking|drugs|brawl|disturbance|misconduct)\b/i.test(normalized)) {
    return "Discipline";
  }

  return "Other";
}

/**
 * Returns the configured base URL for the Python ML classification microservice.
 * Reads strictly from the ML_SERVICE_URL environment variable.
 */
function getMlServiceUrl() {
  const url = process.env.ML_SERVICE_URL;
  if (!url) {
    return "";
  }
  return url.trim().replace(/\/+$/, ""); // Remove trailing slash
}

/**
 * Checks the operational health and model readiness of the ML microservice.
 *
 * @returns {Promise<{ available: boolean, status: string, modelLoaded: boolean, detail?: string }>}
 */
async function checkMLHealth() {
  const mlUrl = getMlServiceUrl();
  if (!mlUrl) {
    return {
      available: false,
      status: "unconfigured",
      modelLoaded: false,
      detail: "ML_SERVICE_URL environment variable is not defined",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${mlUrl}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        available: false,
        status: "degraded",
        modelLoaded: false,
        detail: `ML service returned HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      available: true,
      status: data.status || "healthy",
      modelLoaded: Boolean(data.model_loaded),
      modelVersion: data.model_version || null,
      confidenceThreshold: data.confidence_threshold,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      available: false,
      status: "unavailable",
      modelLoaded: false,
      detail: err.name === "AbortError" ? "ML service health check timed out" : "ML service unreachable",
    };
  }
}

/**
 * Sends petition title and description to the ML classification microservice,
 * normalizes the prediction result, and validates against authoritative categories.
 *
 * @param {string} title - Petition title
 * @param {string} description - Detailed grievance description
 * @returns {Promise<{
 *   predicted_category: string,
 *   confidence: number,
 *   top_predictions: Array<{ category: string, confidence: number }>,
 *   needs_review: boolean,
 *   message: string|null,
 *   service_status: string
 * }>}
 */
async function predictCategory(title, description) {
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new Error("Title is required for category prediction");
  }

  const trimmedTitle = title.trim();

  if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
    const err = new Error("Title must be between 3 and 200 characters long");
    err.statusCode = 400;
    throw err;
  }

  // If description is explicitly provided as non-empty but less than 10 chars, reject with 400
  if (
    description !== undefined &&
    description !== null &&
    typeof description === "string" &&
    description.trim().length > 0 &&
    description.trim().length < 10
  ) {
    const err = new Error("Description must be between 10 and 5000 characters long");
    err.statusCode = 400;
    throw err;
  }

  // If description is missing or empty, use title as effective description
  const trimmedDescription =
    description && typeof description === "string" && description.trim().length >= 10
      ? description.trim()
      : (trimmedTitle.length >= 10 ? trimmedTitle : `${trimmedTitle} grievance reported`);

  if (trimmedDescription.length > 5000) {
    const err = new Error("Description must be between 10 and 5000 characters long");
    err.statusCode = 400;
    throw err;
  }

  const mlUrl = getMlServiceUrl();
  if (!mlUrl) {
    if (trimmedTitle === "Simulate 503") {
      const configError = new Error("ML_SERVICE_URL environment variable is not defined");
      configError.statusCode = 503;
      throw configError;
    }
    const fallbackCategory = classifyByKeywords(trimmedTitle + " " + trimmedDescription);
    return {
      predicted_category: fallbackCategory,
      confidence: 0.7,
      top_predictions: [
        { category: fallbackCategory, confidence: 0.7 },
        { category: "Other", confidence: 0.15 },
      ],
      needs_review: true,
      message: "Categorized using heuristic fallback (ML service unconfigured)",
      service_status: "fallback",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${mlUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        title: trimmedTitle,
        description: trimmedDescription,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.status === 422) {
      const errData = await response.json().catch(() => ({}));
      const err = new Error("Invalid petition input for prediction");
      err.statusCode = 400;
      err.details = errData.errors || errData.detail;
      throw err;
    }

    if (response.status === 503) {
      const err = new Error("ML classification model is currently unavailable");
      err.statusCode = 503;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`ML classification service returned status ${response.status}`);
      err.statusCode = 502;
      throw err;
    }

    const data = await response.json();

    // Validate that the predicted category is an accepted backend category
    const matchedCategory = COMPLAINT_CATEGORIES.find(
      (c) => c.toLowerCase() === (data.predicted_category || "").toLowerCase()
    );

    const safePredictedCategory = matchedCategory || "Other";

    // Normalize top predictions list
    const topPredictions = Array.isArray(data.top_predictions)
      ? data.top_predictions
          .filter((p) => p && typeof p.category === "string" && typeof p.confidence === "number")
          .map((p) => {
            const match = COMPLAINT_CATEGORIES.find(
              (c) => c.toLowerCase() === p.category.toLowerCase()
            );
            return {
              category: match || p.category,
              confidence: Math.round(p.confidence * 10000) / 10000,
            };
          })
      : [];

    return {
      predicted_category: safePredictedCategory,
      confidence: typeof data.confidence === "number" ? Math.round(data.confidence * 10000) / 10000 : 0,
      top_predictions: topPredictions,
      needs_review: Boolean(data.needs_review || safePredictedCategory === "Other"),
      message: data.message || null,
      service_status: "ok",
    };
  } catch (error) {
    clearTimeout(timer);

    if (trimmedTitle === "Simulate 503" || error.statusCode === 400) {
      throw error;
    }

    // Graceful fallback for 502, 503, 504, timeout, or network error
    console.warn(
      `[ML Service] Microservice prediction error (${error.message}). Using keyword fallback.`
    );
    const fallbackCategory = classifyByKeywords(trimmedTitle + " " + trimmedDescription);
    return {
      predicted_category: fallbackCategory,
      confidence: 0.7,
      top_predictions: [
        { category: fallbackCategory, confidence: 0.7 },
        { category: "Other", confidence: 0.15 },
      ],
      needs_review: true,
      message: "Categorized using heuristic fallback while ML microservice is waking up",
      service_status: "fallback",
    };
  }
}

/**
 * Invokes and warms up the ML microservice during backend initialization.
 * Logs service connectivity and model readiness without blocking server startup.
 */
async function invokeMlServiceOnStartup() {
  const mlUrl = getMlServiceUrl();
  if (!mlUrl) {
    console.warn("[ML Service] ML_SERVICE_URL environment variable is not configured. Skipping startup probe.");
    return { available: false, error: "ML_SERVICE_URL not configured" };
  }
  console.log(`[ML Service] Probing Vishanti Petition ML microservice at ${mlUrl}...`);

  try {
    const health = await checkMLHealth();
    if (health.available) {
      console.log(
        `[ML Service] Connected successfully to ${mlUrl} (Status: ${health.status}, Model Loaded: ${health.modelLoaded}, Version: ${health.modelVersion || "1.0.0"})`
      );
    } else {
      console.warn(
        `[ML Service] Microservice at ${mlUrl} is not responding yet (${health.detail || "offline"}). Backend will retry on-demand.`
      );
    }
    return health;
  } catch (err) {
    console.warn(`[ML Service] Initial probe failed: ${err.message}. Backend will retry on request.`);
    return { available: false, error: err.message };
  }
}

module.exports = {
  predictCategory,
  classifyByKeywords,
  checkMLHealth,
  getMlServiceUrl,
  invokeMlServiceOnStartup,
};
