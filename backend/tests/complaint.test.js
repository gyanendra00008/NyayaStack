require("dotenv").config();
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super_secure_test_jwt_secret_key_with_at_least_32_characters_123!";
}

// Ensure isolated test databases for both auth and storage
const testAuthDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

process.env.TEST_STORAGE_MONGO_URI =
  process.env.TEST_STORAGE_MONGO_URI ||
  (process.env.STORAGE_MONGO_URI
    ? process.env.STORAGE_MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_storage_test$1")
    : "mongodb://localhost:27017/nyayastack_storage_test");

const app = require("../src/app.js");
const UserModel = require("../src/models/auth.models.js");
const Complaint = require("../src/models/complaint.models.js");
const { getStorageConnection, closeConnections } = require("../src/config/db.js");
const cloudinaryService = require("../src/services/cloudinary.service.js");
const { detectFileSignature, validateFileBuffer } = require("../src/utils/fileSignature.utils.js");

let server;
let baseUrl;

// Sample valid file binary buffers
const VALID_JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const VALID_PDF_BUFFER = Buffer.from("%PDF-1.4 sample pdf content for testing");

let userTokenA;
let userTokenB;
let userA;
let userB;

const cleanTestData = async () => {
  await UserModel.deleteMany({ email: { $regex: /@complaint-test\.com$/ } });
  await Complaint.deleteMany({});
};

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testAuthDbUri);
  }

  // Ensure storage connection is established
  getStorageConnection();

  await cleanTestData();

  // Create two verified test users
  userA = await UserModel.create({
    username: `user_a_${Date.now()}`,
    email: `user_a_${Date.now()}@complaint-test.com`,
    password: await bcrypt.hash("Password123!", 10),
    isVerified: true,
    role: "user",
    tokenVersion: 0,
  });

  userB = await UserModel.create({
    username: `user_b_${Date.now()}`,
    email: `user_b_${Date.now()}@complaint-test.com`,
    password: await bcrypt.hash("Password123!", 10),
    isVerified: true,
    role: "user",
    tokenVersion: 0,
  });

  userTokenA = jwt.sign(
    { id: userA._id, role: userA.role, tokenVersion: 0 },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  userTokenB = jwt.sign(
    { id: userB._id, role: userB.role, tokenVersion: 0 },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" }
  );

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

after(async () => {
  await cleanTestData();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeConnections();
});

describe("Vishanti Petition (NyayaStack) Complaint Module Test Suite", () => {
  // 1. Database separation test
  it("1. Storage database separation: Complaint model is registered exclusively on storage connection", async () => {
    const storageConn = getStorageConnection();
    assert.ok(storageConn, "Storage connection must exist");
    assert.notEqual(
      storageConn,
      mongoose.connection,
      "Storage connection must be distinct from primary auth connection"
    );

    assert.ok(
      storageConn.models["Complaint"],
      "Complaint model must be registered on storage connection"
    );
    assert.equal(
      mongoose.connection.models["Complaint"],
      undefined,
      "Complaint model must NOT be registered on the default auth connection"
    );
  });

  // 2. Unauthenticated requests rejected
  it("2. POST /api/complaints requires authentication (401 Unauthorized)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Broken tap in bathroom");
    formData.append("description", "Water has been leaking for two days continuously.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 401);
    assert.equal(data.success, false);
    assert.match(data.message, /Authentication token required/i);
  });

  // 3. Validation: Missing required fields
  it("3. POST /api/complaints rejects missing required fields (400 Bad Request)", async () => {
    const formData = new FormData();
    formData.append("title", "Missing category and description");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /Missing required fields/i);
  });

  // 4. Validation: Empty or whitespace-only fields
  it("4. POST /api/complaints rejects empty or whitespace-only title and description (400 Bad Request)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "   ");
    formData.append("description", "Valid description that meets length requirements.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /Title cannot be empty/i);
  });

  // 5. Validation: Length constraints
  it("5. POST /api/complaints enforces min and max length constraints on title and description", async () => {
    // Title too short (< 3 chars)
    const formDataShortTitle = new FormData();
    formDataShortTitle.append("category", "Hostel");
    formDataShortTitle.append("title", "No");
    formDataShortTitle.append("description", "This is a valid complaint description.");

    const resShortTitle = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formDataShortTitle,
    });
    assert.equal(resShortTitle.status, 400);
    const dataShort = await resShortTitle.json();
    assert.match(dataShort.message, /between 3 and 200 characters/i);

    // Description too short (< 10 chars)
    const formDataShortDesc = new FormData();
    formDataShortDesc.append("category", "Hostel");
    formDataShortDesc.append("title", "Valid Title");
    formDataShortDesc.append("description", "Too short");

    const resShortDesc = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formDataShortDesc,
    });
    assert.equal(resShortDesc.status, 400);
    const dataShortDesc = await resShortDesc.json();
    assert.match(dataShortDesc.message, /between 10 and 5000 characters/i);
  });

  // 6. Validation: Invalid complaint category
  it("6. POST /api/complaints rejects invalid complaint category (400 Bad Request)", async () => {
    const formData = new FormData();
    formData.append("category", "NonExistentCategory123");
    formData.append("title", "Broken furniture");
    formData.append("description", "Chair is broken and needs replacement in room 102.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /Invalid category/i);
  });

  // 7. Successful complaint creation without files
  it("7. POST /api/complaints creates a complaint successfully without attachments (201 Created)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Water supply issue in Block B");
    formData.append("description", "There has been no water supply since this morning.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, "Complaint submitted successfully");
    assert.ok(body.data);
    assert.match(body.data.complaintId, /^VSP-[A-Z0-9]+-[A-Z0-9]+$/);
    assert.equal(body.data.category, "Hostel");
    assert.equal(body.data.title, "Water supply issue in Block B");
    assert.equal(body.data.description, "There has been no water supply since this morning.");
    assert.equal(body.data.status, "Filed");
    assert.deepEqual(body.data.attachments, []);
    assert.ok(body.data.createdAt);
    assert.ok(body.data.updatedAt);
    assert.equal(body.data._id, undefined, "_id must not be exposed");
    assert.equal(body.data.__v, undefined, "__v must not be exposed");

    // Verify document was persisted in storage DB, not auth DB
    const storageConn = getStorageConnection();
    const storedComplaint = await storageConn.models["Complaint"].findOne({
      complaintId: body.data.complaintId,
    });
    assert.ok(storedComplaint, "Must be found in storage DB");
    assert.equal(storedComplaint.userId.toString(), userA._id.toString());
  });

  // 8. File upload validation: Empty file rejection
  it("8. POST /api/complaints rejects empty (0 bytes) file attachments (400 Bad Request)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Empty file test");
    formData.append("description", "Testing that 0 byte empty files are rejected.");
    formData.append("attachments", new Blob([], { type: "image/jpeg" }), "empty.jpg");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /Empty file/i);
  });

  // 9. File upload validation: Unsupported extension / MIME type
  it("9. POST /api/complaints rejects unsupported file types (e.g. .exe or .sh)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Malicious file upload attempt");
    formData.append("description", "Attempting to upload an unsupported executable.");
    formData.append(
      "attachments",
      new Blob(["echo hello"], { type: "application/x-sh" }),
      "script.sh"
    );

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /Unsupported/i);
  });

  // 10. File upload validation: Binary signature / magic byte spoofing detection
  it("10. POST /api/complaints rejects files with spoofed extension failing magic byte verification", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Spoofed file extension test");
    formData.append("description", "File named photo.jpg contains plain text instead of JPEG bytes.");
    formData.append(
      "attachments",
      new Blob(["THIS IS NOT A VALID JPEG FILE AT ALL"], { type: "image/jpeg" }),
      "photo.jpg"
    );

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /signature/i);
  });

  // 11. File count limit: Rejection when > 5 files
  it("11. POST /api/complaints rejects requests with more than 5 attachments (400 Bad Request)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Too many files test");
    formData.append("description", "Uploading 6 files when max limit is 5.");

    for (let i = 1; i <= 6; i++) {
      formData.append(
        "attachments",
        new Blob([VALID_JPEG_BUFFER], { type: "image/jpeg" }),
        `image_${i}.jpg`
      );
    }

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.equal(data.success, false);
    assert.match(data.message, /maximum of 5/i);
  });

  // 12. Total upload size limit enforcement
  it("12. POST /api/complaints rejects uploads exceeding 10 MB total size limit (413 Payload Too Large)", async () => {
    // Generate a payload exceeding 10MB
    const oversizedBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "application/pdf" });

    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "Oversized upload test");
    formData.append("description", "Testing 11MB payload rejection.");
    formData.append("attachments", oversizedBlob, "large.pdf");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userTokenA}` },
      body: formData,
    });

    assert.equal(res.status, 413);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /10 MB/i);
  });

  // 13. File upload and Cloudinary metadata persistence
  it("13. POST /api/complaints successfully uploads supporting attachments and persists metadata", async () => {
    // Mock uploadMultipleAttachments to verify metadata flow without hitting external rate limits
    const originalUpload = cloudinaryService.uploadMultipleAttachments;
    cloudinaryService.uploadMultipleAttachments = async (files) => {
      return files.map((file, idx) => ({
        url: `https://res.cloudinary.com/test-cloud/image/upload/v12345/complaints/test_${idx}.jpg`,
        publicId: `nyayastack/complaints/test_${Date.now()}_${idx}`,
        resourceType: file.detectedSignature?.resourceType || "image",
        format: file.detectedSignature?.format || "jpg",
        size: file.buffer.length,
        originalName: file.originalname,
      }));
    };

    try {
      const formData = new FormData();
      formData.append("category", "Infrastructure");
      formData.append("title", "Broken library desk");
      formData.append("description", "Desk #42 on second floor has a broken leg and is unusable.");
      formData.append(
        "attachments",
        new Blob([VALID_JPEG_BUFFER], { type: "image/jpeg" }),
        "desk_photo.jpg"
      );
      formData.append(
        "attachments",
        new Blob([VALID_PDF_BUFFER], { type: "application/pdf" }),
        "inspection_report.pdf"
      );

      const res = await fetch(`${baseUrl}/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userTokenA}` },
        body: formData,
      });

      const body = await res.json();
      assert.equal(res.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.data.attachments.length, 2);

      const att1 = body.data.attachments[0];
      assert.equal(att1.originalName, "desk_photo.jpg");
      assert.equal(att1.format, "jpg");
      assert.equal(att1.resourceType, "image");
      assert.ok(att1.url);
      assert.ok(att1.publicId);

      const att2 = body.data.attachments[1];
      assert.equal(att2.originalName, "inspection_report.pdf");
      assert.equal(att2.format, "pdf");
      assert.ok(att2.url);
      assert.ok(att2.publicId);
    } finally {
      cloudinaryService.uploadMultipleAttachments = originalUpload;
    }
  });

  // 14. Rollback mechanism: Cloudinary cleanup on persistence failure
  it("14. Cloudinary cleanup is triggered if MongoDB persistence fails after upload", async () => {
    let cleanedUpAssets = null;
    const originalUpload = cloudinaryService.uploadMultipleAttachments;
    const originalCleanup = cloudinaryService.cleanupAttachments;

    const mockUploaded = [
      {
        url: "https://res.cloudinary.com/mock/image/upload/file1.jpg",
        publicId: "mock_public_id_123",
        resourceType: "image",
        format: "jpg",
        size: 1024,
        originalName: "file1.jpg",
      },
    ];

    cloudinaryService.uploadMultipleAttachments = async () => mockUploaded;
    cloudinaryService.cleanupAttachments = async (attachments) => {
      cleanedUpAssets = attachments;
    };

    // Force Complaint.create to throw an unexpected database error
    const originalCreate = Complaint.create;
    Complaint.create = async () => {
      const err = new Error("Simulated storage database failure");
      err.code = 99999;
      throw err;
    };

    try {
      const formData = new FormData();
      formData.append("category", "Mess");
      formData.append("title", "Food quality feedback");
      formData.append("description", "Detailed feedback on breakfast quality in North mess.");
      formData.append(
        "attachments",
        new Blob([VALID_JPEG_BUFFER], { type: "image/jpeg" }),
        "food.jpg"
      );

      const res = await fetch(`${baseUrl}/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userTokenA}` },
        body: formData,
      });

      assert.equal(res.status, 500);
      assert.ok(cleanedUpAssets, "Cleanup must be called on persistence failure");
      assert.equal(cleanedUpAssets[0].publicId, "mock_public_id_123");
    } finally {
      cloudinaryService.uploadMultipleAttachments = originalUpload;
      cloudinaryService.cleanupAttachments = originalCleanup;
      Complaint.create = originalCreate;
    }
  });

  // 15. GET /api/complaints/my requires authentication
  it("15. GET /api/complaints/my requires authentication (401 Unauthorized)", async () => {
    const res = await fetch(`${baseUrl}/complaints/my`, {
      method: "GET",
    });
    assert.equal(res.status, 401);
  });

  // 16. GET /api/complaints/my retrieves only authenticated user's complaints
  it("16. GET /api/complaints/my retrieves only complaints belonging to authenticated user", async () => {
    // User A creates 2 complaints
    await Complaint.create({
      complaintId: `VSP-TEST-A1-${Date.now()}`,
      userId: userA._id,
      category: "Academic",
      title: "User A Complaint 1",
      description: "User A description content for first complaint.",
      status: "Filed",
      attachments: [],
    });

    await Complaint.create({
      complaintId: `VSP-TEST-A2-${Date.now()}`,
      userId: userA._id,
      category: "Academic",
      title: "User A Complaint 2",
      description: "User A description content for second complaint.",
      status: "Filed",
      attachments: [],
    });

    // User B creates 1 complaint
    await Complaint.create({
      complaintId: `VSP-TEST-B1-${Date.now()}`,
      userId: userB._id,
      category: "Finance",
      title: "User B Complaint",
      description: "User B fee receipt issue description.",
      status: "Filed",
      attachments: [],
    });

    // Request from User A
    const resA = await fetch(`${baseUrl}/complaints/my`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenA}` },
    });

    const dataA = await resA.json();
    assert.equal(resA.status, 200);
    assert.equal(dataA.success, true);
    // User A should see only User A's complaints (at least 2 created here)
    const allBelongToA = dataA.data.every((c) => !c.title.includes("User B"));
    assert.equal(allBelongToA, true, "User A must not receive User B complaints");

    // Request from User B
    const resB = await fetch(`${baseUrl}/complaints/my`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenB}` },
    });

    const dataB = await resB.json();
    assert.equal(resB.status, 200);
    assert.equal(dataB.success, true);
    assert.equal(dataB.data.length, 1);
    assert.equal(dataB.data[0].title, "User B Complaint");
    assert.equal(dataB.pagination.total, 1);
  });

  // 17. Pagination on GET /api/complaints/my
  it("17. GET /api/complaints/my supports page and limit pagination query parameters", async () => {
    const res = await fetch(`${baseUrl}/complaints/my?page=1&limit=2`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenA}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.pagination.page, 1);
    assert.equal(body.pagination.limit, 2);
    assert.ok(body.pagination.total >= 2);
    assert.ok(body.pagination.totalPages >= 1);
    assert.ok(body.data.length <= 2);
  });

  // 18. Invalid pagination parameters rejected
  it("18. GET /api/complaints/my rejects invalid pagination parameters (400 Bad Request)", async () => {
    // Negative page
    const resBadPage = await fetch(`${baseUrl}/complaints/my?page=0`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenA}` },
    });
    assert.equal(resBadPage.status, 400);

    // Limit exceeding 50
    const resBadLimit = await fetch(`${baseUrl}/complaints/my?limit=999`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenA}` },
    });
    assert.equal(resBadLimit.status, 400);
  });

  // 19. Results sorted descending by createdAt
  it("19. GET /api/complaints/my results are sorted by createdAt descending", async () => {
    const res = await fetch(`${baseUrl}/complaints/my?limit=10`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenA}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    for (let i = 0; i < body.data.length - 1; i++) {
      const current = new Date(body.data[i].createdAt).getTime();
      const next = new Date(body.data[i + 1].createdAt).getTime();
      assert.ok(
        current >= next,
        `Complaints must be sorted descending by createdAt: ${current} >= ${next}`
      );
    }
  });

  // 20. Sensitive internal fields are not exposed in responses
  it("20. Complaint responses do not leak _id, __v, userId, or internal database metadata", async () => {
    const res = await fetch(`${baseUrl}/complaints/my`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userTokenA}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    for (const complaint of body.data) {
      assert.equal(complaint._id, undefined, "_id must not be exposed");
      assert.equal(complaint.__v, undefined, "__v must not be exposed");
      assert.equal(complaint.userId, undefined, "userId must not be exposed to user");
      assert.ok(complaint.complaintId);
      assert.ok(complaint.category);
      assert.ok(complaint.title);
      assert.ok(complaint.description);
      assert.ok(complaint.status);
    }
  });

  // 21. Anonymous complaint submission (isAnonymous: true)
  it("21. POST /api/complaints supports filing anonymously (isAnonymous: true)", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userTokenA}`,
      },
      body: JSON.stringify({
        category: "Hostel",
        title: "Confidential hostel grievance",
        description: "Anonymous safety report with sensitive details.",
        isAnonymous: true,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.isAnonymous, true);
    assert.equal(body.data.userId, undefined);

    // Verify it is persisted with isAnonymous: true
    const saved = await Complaint.findOne({ complaintId: body.data.complaintId }).lean();
    assert.ok(saved);
    assert.equal(saved.isAnonymous, true);
  });

  // 22. Auto category resolution when category is set to 'Auto'
  it("22. POST /api/complaints accepts 'Auto' category and resolves to a valid category", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userTokenA}`,
      },
      body: JSON.stringify({
        category: "Auto",
        title: "Broken fan in hostel bedroom",
        description: "The ceiling fan in hostel room 302 makes screeching noise and stops spinning.",
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(Complaint.COMPLAINT_CATEGORIES.includes(body.data.category));
  });
});
