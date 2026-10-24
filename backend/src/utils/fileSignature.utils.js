const path = require("path");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".webm",
  ".pdf",
]);

/**
 * Inspects initial byte signatures (magic numbers) of a file buffer.
 *
 * @param {Buffer} buffer
 * @returns {{ mimeType: string, format: string, resourceType: 'image' | 'video' | 'raw' | 'auto' } | null}
 */
function detectFileSignature(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  // PDF: %PDF (25 50 44 46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mimeType: "application/pdf", format: "pdf", resourceType: "auto" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", format: "png", resourceType: "image" };
  }

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", format: "jpg", resourceType: "image" };
  }

  // WEBP: starts with "RIFF" (52 49 46 46) and bytes 8..11 are "WEBP" (57 45 42 50)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: "image/webp", format: "webp", resourceType: "image" };
  }

  // MP4: bytes 4..7 are "ftyp" (66 74 79 70)
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return { mimeType: "video/mp4", format: "mp4", resourceType: "video" };
  }

  // WEBM: starts with EBML ID 1A 45 DF A3
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mimeType: "video/webm", format: "webm", resourceType: "video" };
  }

  return null;
}

/**
 * Validates a file against declared MIME types, extension, and binary magic bytes.
 *
 * @param {Buffer} buffer
 * @param {string} declaredMimeType
 * @param {string} originalName
 * @returns {{ isValid: boolean, error?: string, signature?: { mimeType: string, format: string, resourceType: string } }}
 */
function validateFileBuffer(buffer, declaredMimeType, originalName) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { isValid: false, error: "Empty file or missing file buffer" };
  }

  const ext = path.extname(originalName || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Unsupported file extension (${ext || "none"}). Allowed: JPEG, JPG, PNG, WEBP, MP4, WEBM, PDF`,
    };
  }

  const normalizedDeclared = (declaredMimeType || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedDeclared)) {
    return {
      isValid: false,
      error: `Unsupported MIME type (${declaredMimeType}). Allowed: JPEG, JPG, PNG, WEBP, MP4, WEBM, PDF`,
    };
  }

  const signature = detectFileSignature(buffer);
  if (!signature) {
    return {
      isValid: false,
      error: `File contents do not match any supported file signature (corrupt or unsupported format)`,
    };
  }

  // Normalize JPEG variants
  const sigType = signature.mimeType === "image/jpg" ? "image/jpeg" : signature.mimeType;
  const decType = normalizedDeclared === "image/jpg" ? "image/jpeg" : normalizedDeclared;

  if (sigType !== decType) {
    return {
      isValid: false,
      error: `Declared MIME type (${declaredMimeType}) does not match detected file signature (${signature.mimeType})`,
    };
  }

  return { isValid: true, signature };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  detectFileSignature,
  validateFileBuffer,
};
