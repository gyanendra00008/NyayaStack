const multer = require("multer");
const { validateFileBuffer } = require("../utils/fileSignature.utils.js");
const { COMPLAINT_CATEGORIES } = require("../models/complaint.models.js");

const MAX_TOTAL_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILE_COUNT = 5;
const FORM_OVERHEAD_BYTES = 100 * 1024; // 100 KB margin for form text fields & boundary headers

// In-memory storage to prevent writing uploaded files to the local disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_TOTAL_SIZE_BYTES, // Individual file cannot exceed total quota
    files: MAX_FILE_COUNT,
  },
});

/**
 * Pre-parsing middleware: rejects oversized requests immediately based on Content-Length
 * before buffering unlimited request bodies in memory.
 */
function preCheckRequestSize(req, res, next) {
  const contentLength = req.headers["content-length"];
  if (contentLength) {
    const lengthBytes = parseInt(contentLength, 10);
    if (!isNaN(lengthBytes) && lengthBytes > MAX_TOTAL_SIZE_BYTES + FORM_OVERHEAD_BYTES) {
      return res.status(413).json({
        success: false,
        message: "Total upload size exceeds the maximum limit of 10 MB",
      });
    }
  }
  next();
}

/**
 * Multer execution wrapper with graceful error handling for multipart uploads.
 */
function handleMulterUpload(req, res, next) {
  const multerMiddleware = upload.array("attachments", MAX_FILE_COUNT);

  multerMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            success: false,
            message: "File size exceeds the maximum limit of 10 MB",
          });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            success: false,
            message: `A maximum of ${MAX_FILE_COUNT} attachments are allowed per complaint`,
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            success: false,
            message: `Unexpected file field '${err.field || "unknown"}'. Upload attachments using field name 'attachments'`,
          });
        }
        return res.status(400).json({
          success: false,
          message: `File upload error: ${err.message}`,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Malformed multipart request: ${err.message}`,
      });
    }
    next();
  });
}

/**
 * Validates uploaded files:
 * - Total cumulative size <= 10 MB
 * - No empty files (size > 0)
 * - Binary magic byte signatures match declared format
 */
function validateUploadedFiles(req, res, next) {
  const files = req.files || [];

  if (files.length > MAX_FILE_COUNT) {
    return res.status(400).json({
      success: false,
      message: `Maximum of ${MAX_FILE_COUNT} files allowed. Received ${files.length}.`,
    });
  }

  // Calculate cumulative size
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes > MAX_TOTAL_SIZE_BYTES) {
    return res.status(413).json({
      success: false,
      message: `Total upload size of ${Math.round(totalBytes / 1024 / 1024)}MB exceeds the maximum 10 MB limit`,
    });
  }

  // Verify each file individually
  for (const file of files) {
    if (!file.buffer || file.size === 0 || file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Empty file '${file.originalname || "unknown"}' is not allowed`,
      });
    }

    const validation = validateFileBuffer(file.buffer, file.mimetype, file.originalname);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: `Invalid attachment '${file.originalname || "unknown"}': ${validation.error}`,
      });
    }

    file.detectedSignature = validation.signature;
  }

  next();
}

/**
 * Validates text fields of the complaint request (category, title, description).
 */
function validateComplaintFields(req, res, next) {
  const { category, title, description } = req.body;

  if (category === undefined || title === undefined || description === undefined) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields. 'category', 'title', and 'description' are all required.",
    });
  }

  if (
    typeof category !== "string" ||
    typeof title !== "string" ||
    typeof description !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "Fields 'category', 'title', and 'description' must be strings.",
    });
  }

  const trimmedCategory = category.trim();
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (!trimmedCategory) {
    return res.status(400).json({
      success: false,
      message: "Category cannot be empty",
    });
  }

  if (!trimmedTitle) {
    return res.status(400).json({
      success: false,
      message: "Title cannot be empty",
    });
  }

  if (!trimmedDescription) {
    return res.status(400).json({
      success: false,
      message: "Description cannot be empty",
    });
  }

  if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
    return res.status(400).json({
      success: false,
      message: "Title must be between 3 and 200 characters long",
    });
  }

  if (trimmedDescription.length < 10 || trimmedDescription.length > 5000) {
    return res.status(400).json({
      success: false,
      message: "Description must be between 10 and 5000 characters long",
    });
  }

  // Validate category against supported categories (case-insensitive normalization)
  // Or support "Auto" / "AI" for automatic ML categorization
  let matchedCategory = null;
  let autoCategorize = false;

  if (trimmedCategory.toLowerCase() === "auto" || trimmedCategory.toLowerCase() === "ai") {
    autoCategorize = true;
    matchedCategory = "Auto";
  } else {
    matchedCategory = COMPLAINT_CATEGORIES.find(
      (c) => c.toLowerCase() === trimmedCategory.toLowerCase()
    );
  }

  if (!matchedCategory) {
    return res.status(400).json({
      success: false,
      message: `Invalid category '${trimmedCategory}'. Supported categories: ${COMPLAINT_CATEGORIES.join(", ")}`,
    });
  }

  // Parse and normalize isAnonymous flag (supports boolean, string 'true'/'false' from FormData)
  const rawAnon = req.body.isAnonymous ?? req.body.isAnon;
  req.body.isAnonymous = rawAnon === true || rawAnon === "true" || rawAnon === 1 || rawAnon === "1";

  req.body.category = matchedCategory;
  req.body.autoCategorize = autoCategorize;
  req.body.title = trimmedTitle;
  req.body.description = trimmedDescription;

  next();
}

/**
 * Validates pagination query parameters for complaint retrieval.
 */
function validatePaginationQuery(req, res, next) {
  const pageRaw = req.query.page;
  const limitRaw = req.query.limit;

  let page = 1;
  let limit = 10;

  if (pageRaw !== undefined) {
    const parsedPage = parseInt(pageRaw, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameter 'page'. Must be a positive integer greater than or equal to 1.",
      });
    }
    page = parsedPage;
  }

  if (limitRaw !== undefined) {
    const parsedLimit = parseInt(limitRaw, 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameter 'limit'. Must be an integer between 1 and 50.",
      });
    }
    limit = parsedLimit;
  }

  req.pagination = { page, limit };
  next();
}

module.exports = {
  preCheckRequestSize,
  handleMulterUpload,
  validateUploadedFiles,
  validateComplaintFields,
  validatePaginationQuery,
};
