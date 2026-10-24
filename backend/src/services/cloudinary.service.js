const cloudinary = require("cloudinary").v2;

/**
 * Validates presence of required Cloudinary environment variables without exposing secrets.
 */
function validateCloudinaryConfig() {
  const missing = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) missing.push("CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET) missing.push("CLOUDINARY_API_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary configuration: ${missing.join(", ")}`);
  }
}

/**
 * Initializes Cloudinary configuration safely.
 */
function getCloudinaryClient() {
  validateCloudinaryConfig();

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
}

/**
 * Uploads a single file buffer to Cloudinary using stream.
 *
 * @param {Buffer} buffer
 * @param {Object} fileMetadata
 * @param {string} fileMetadata.originalName
 * @param {string} [fileMetadata.resourceType] - 'image' | 'video' | 'raw' | 'auto'
 * @param {string} [fileMetadata.format]
 * @returns {Promise<{ url: string, publicId: string, resourceType: string, format: string, size: number, originalName: string }>}
 */
function uploadBufferToCloudinary(buffer, fileMetadata = {}) {
  return new Promise((resolve, reject) => {
    try {
      const client = getCloudinaryClient();
      const folder = process.env.CLOUDINARY_FOLDER || "nyayastack/complaints";
      const deliveryType = process.env.CLOUDINARY_DELIVERY_TYPE || "upload";

      const uploadOptions = {
        folder,
        type: deliveryType,
        resource_type: fileMetadata.resourceType || "auto",
        unique_filename: true,
        overwrite: false,
      };

      if (fileMetadata.format) {
        uploadOptions.format = fileMetadata.format;
      }

      const stream = client.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) {
          // Sanitize error message to avoid secret leakage
          const safeMessage = error.message
            ? error.message.replace(new RegExp(process.env.CLOUDINARY_API_SECRET || "---", "gi"), "[REDACTED]")
            : "Cloudinary upload failed";
          const err = new Error(safeMessage);
          err.http_code = error.http_code || 500;
          return reject(err);
        }

        resolve({
          url: result.secure_url || result.url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format || fileMetadata.format || "bin",
          size: result.bytes || buffer.length,
          originalName: fileMetadata.originalName || "attachment",
        });
      });

      stream.end(buffer);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Deletes a previously uploaded attachment from Cloudinary.
 *
 * @param {string} publicId
 * @param {string} [resourceType='image']
 * @returns {Promise<any>}
 */
async function deleteFromCloudinary(publicId, resourceType = "image") {
  if (!publicId) return;
  try {
    const client = getCloudinaryClient();
    const deliveryType = process.env.CLOUDINARY_DELIVERY_TYPE || "upload";
    return await client.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: deliveryType,
    });
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset (${publicId}):`, err.message);
  }
}

/**
 * Cleans up a list of uploaded attachments to avoid orphaned Cloudinary resources.
 *
 * @param {Array<{ publicId: string, resourceType: string }>} attachments
 */
async function cleanupAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return;

  await Promise.allSettled(
    attachments.map((item) => {
      if (item && item.publicId) {
        return deleteFromCloudinary(item.publicId, item.resourceType || "image");
      }
      return Promise.resolve();
    })
  );
}

/**
 * Uploads multiple files sequentially with automatic rollback on partial failure.
 *
 * @param {Array<{ buffer: Buffer, originalname: string, detectedSignature?: Object }>} files
 * @returns {Promise<Array<{ url: string, publicId: string, resourceType: string, format: string, size: number, originalName: string }>>}
 */
async function uploadMultipleAttachments(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploaded = [];
  try {
    for (const file of files) {
      const resourceType = file.detectedSignature?.resourceType || "auto";
      const format = file.detectedSignature?.format;

      const result = await uploadBufferToCloudinary(file.buffer, {
        originalName: file.originalname,
        resourceType,
        format,
      });
      uploaded.push(result);
    }
    return uploaded;
  } catch (error) {
    // Attempt rollback of any files uploaded during this request
    if (uploaded.length > 0) {
      console.warn(`Upload failed partway; rolling back ${uploaded.length} uploaded attachment(s)...`);
      await cleanupAttachments(uploaded);
    }
    throw error;
  }
}

module.exports = {
  validateCloudinaryConfig,
  getCloudinaryClient,
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  cleanupAttachments,
  uploadMultipleAttachments,
};
