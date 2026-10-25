const { COMPLAINT_CATEGORIES } = require("../models/complaint.models.js");

const DEFAULT_ML_SERVICE_URL = "http://127.0.0.1:8001";
const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Returns the configured base URL for the Python ML classification microservice.
 */
function getMlServiceUrl() {
  const url = process.env.ML_SERVICE_URL || DEFAULT_ML_SERVICE_URL;
  return url.replace(/\/+$/, ""); // Remove trailing slash
}

/**
 * Checks the operational health and model readiness of the ML microservice.
 *
 * @returns {Promise<{ available: boolean, status: string, modelLoaded: boolean, detail?: string }>}
 */
async function checkMLHealth() {
  const mlUrl = getMlServiceUrl();
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
  if (!description || typeof description !== "string" || !description.trim()) {
    throw new Error("Description is required for category prediction");
  }

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
    const err = new Error("Title must be between 3 and 200 characters long");
    err.statusCode = 400;
    throw err;
  }

  if (trimmedDescription.length < 10 || trimmedDescription.length > 5000) {
    const err = new Error("Description must be between 10 and 5000 characters long");
    err.statusCode = 400;
    throw err;
  }

  const mlUrl = getMlServiceUrl();
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

    if (error.statusCode) {
      throw error;
    }

    if (error.name === "AbortError") {
      const timeoutError = new Error("ML classification service timed out");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    const networkError = new Error("Unable to connect to ML classification service");
    networkError.statusCode = 503;
    throw networkError;
  }
}

/**
 * Invokes and warms up the ML microservice during backend initialization.
 * Logs service connectivity and model readiness without blocking server startup.
 */
async function invokeMlServiceOnStartup() {
  const mlUrl = getMlServiceUrl();
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
  checkMLHealth,
  getMlServiceUrl,
  invokeMlServiceOnStartup,
};
