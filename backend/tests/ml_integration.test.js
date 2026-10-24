require("dotenv").config();
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super_secure_test_jwt_secret_key_with_at_least_32_characters_123!";
}

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
const mlService = require("../src/services/ml.service.js");
const { COMPLAINT_CATEGORIES } = require("../src/models/complaint.models.js");
const Complaint = require("../src/models/complaint.models.js");
const UserModel = require("../src/models/auth.models.js");
const { getStorageConnection, closeConnections } = require("../src/config/db.js");

describe("Vishanti Petition ML Integration & Extended Endpoints Test Suite", () => {
  let server;
  let baseUrl;
  let mockMlServer;
  let mockMlPort;
  let originalMlUrl;
  let testUserToken;
  let testUser;
  let otherUserToken;
  let otherUser;
  let testComplaintId;

  before(async () => {
    // 0. Ensure mongoose connections
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testAuthDbUri);
    }
    getStorageConnection();

    // 1. Start a mock Python FastAPI ML microservice
    mockMlServer = http.createServer((req, res) => {
      if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "healthy",
            model_loaded: true,
            model_version: "1.0.0",
            supported_categories_count: 12,
            confidence_threshold: 0.45,
          })
        );
      }

      if (req.url === "/predict" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed.title === "Simulate Timeout") {
              return;
            }
            if (parsed.title === "Simulate 503") {
              res.writeHead(503, { "Content-Type": "application/json" });
              return res.end(JSON.stringify({ detail: "Model not loaded" }));
            }

            const isHostel = /hostel|room|mess|water/i.test(parsed.title + " " + parsed.description);
            const category = isHostel ? "Hostel" : "Academic";

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                predicted_category: category,
                confidence: 0.88,
                top_predictions: [
                  { category: category, confidence: 0.88 },
                  { category: "Infrastructure", confidence: 0.08 },
                ],
                needs_review: false,
                message: null,
              })
            );
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ detail: "Bad request" }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "Not found" }));
    });

    await new Promise((resolve) => mockMlServer.listen(0, "127.0.0.1", resolve));
    mockMlPort = mockMlServer.address().port;
    originalMlUrl = process.env.ML_SERVICE_URL;
    process.env.ML_SERVICE_URL = `http://127.0.0.1:${mockMlPort}`;

    // 2. Start Express app server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // 3. Create test users in DB
    testUser = await UserModel.create({
      username: `ml_user_${Date.now()}`,
      email: `ml_user_${Date.now()}@ml-test.com`,
      password: await bcrypt.hash("Password123!", 10),
      isVerified: true,
      role: "user",
      tokenVersion: 0,
    });
    testUserToken = jwt.sign(
      { id: testUser._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    otherUser = await UserModel.create({
      username: `other_user_${Date.now()}`,
      email: `other_user_${Date.now()}@ml-test.com`,
      password: await bcrypt.hash("Password123!", 10),
      isVerified: true,
      role: "user",
      tokenVersion: 0,
    });
    otherUserToken = jwt.sign(
      { id: otherUser._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    // 4. Create a test complaint in the storage database
    testComplaintId = "VSP-MLTEST-123456";
    await Complaint.create({
      complaintId: testComplaintId,
      userId: testUser._id,
      category: "Hostel",
      title: "Broken window in hostel block B",
      description: "Cold draft entering room 302 through damaged latch.",
      attachments: [],
      status: "Filed",
    });
  });

  after(async () => {
    process.env.ML_SERVICE_URL = originalMlUrl;
    if (mockMlServer) {
      await new Promise((resolve) => mockMlServer.close(resolve));
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await Complaint.deleteOne({ complaintId: testComplaintId });
    if (testUser) await UserModel.deleteOne({ _id: testUser._id });
    if (otherUser) await UserModel.deleteOne({ _id: otherUser._id });
    await closeConnections();
  });

  it("1. GET /api/complaints/categories returns authoritative category list", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/categories`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.strictEqual(body.data.length, COMPLAINT_CATEGORIES.length);
    assert.ok(body.data.includes("Hostel"));
    assert.ok(body.data.includes("Academic"));
  });

  it("2. POST /api/complaints/predict-category returns predicted category from ML service", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/predict-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hostel bathroom water issue",
        description: "Taps on the second floor have stopped flowing since morning.",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.predicted_category, "Hostel");
    assert.strictEqual(body.data.confidence, 0.88);
    assert.strictEqual(body.data.needs_review, false);
    assert.ok(Array.isArray(body.data.top_predictions));
  });

  it("3. POST /api/petitions/predict-category (route alias) works identically", async () => {
    const res = await fetch(`${baseUrl}/api/petitions/predict-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Mid-term exam syllabus dispute",
        description: "Topics not covered in lectures were included in the test.",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.predicted_category, "Academic");
  });

  it("4. POST /api/complaints/predict-category rejects missing or too short fields (400)", async () => {
    const resShortTitle = await fetch(`${baseUrl}/api/complaints/predict-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "ab",
        description: "Valid description exceeding ten chars.",
      }),
    });
    assert.strictEqual(resShortTitle.status, 400);

    const resShortDesc = await fetch(`${baseUrl}/api/complaints/predict-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Valid title",
        description: "short",
      }),
    });
    assert.strictEqual(resShortDesc.status, 400);
  });

  it("5. POST /api/complaints/predict-category handles ML service 503 gracefully (503)", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/predict-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Simulate 503",
        description: "This should trigger a 503 status simulation.",
      }),
    });

    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes("unavailable"));
  });

  it("6. GET /api/complaints/:complaintId requires authentication (401)", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}`);
    assert.strictEqual(res.status, 401);
  });

  it("7. GET /api/complaints/:complaintId returns complaint for authorized owner", async () => {
    // Ensure complaint exists even if other parallel tests cleaned collections
    await Complaint.findOneAndUpdate(
      { complaintId: testComplaintId },
      {
        complaintId: testComplaintId,
        userId: testUser._id,
        category: "Hostel",
        title: "Broken window in hostel block B",
        description: "Cold draft entering room 302 through damaged latch.",
        attachments: [],
        status: "Filed",
      },
      { upsert: true, new: true }
    );

    const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.complaintId, testComplaintId);
    assert.strictEqual(body.data.title, "Broken window in hostel block B");
    assert.strictEqual(body.data.userId, undefined); // Sanitized
  });

  it("8. GET /api/complaints/:complaintId forbids access to other users (403)", async () => {
    // Ensure complaint exists even if other parallel tests cleaned collections
    await Complaint.findOneAndUpdate(
      { complaintId: testComplaintId },
      {
        complaintId: testComplaintId,
        userId: testUser._id,
        category: "Hostel",
        title: "Broken window in hostel block B",
        description: "Cold draft entering room 302 through damaged latch.",
        attachments: [],
        status: "Filed",
      },
      { upsert: true, new: true }
    );

    const res = await fetch(`${baseUrl}/api/complaints/${testComplaintId}`, {
      headers: { Authorization: `Bearer ${otherUserToken}` },
    });

    assert.strictEqual(res.status, 403);
  });

  it("9. GET /api/complaints/:complaintId returns 404 for non-existent complaint", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/VSP-NONEXISTENT-999`, {
      headers: { Authorization: `Bearer ${testUserToken}` },
    });

    assert.strictEqual(res.status, 404);
  });
});
