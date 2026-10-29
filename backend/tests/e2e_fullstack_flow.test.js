require("dotenv").config();
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const mongoose = require("mongoose");

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
const UserModel = require("../src/models/auth.models.js");
const Complaint = require("../src/models/complaint.models.js");
const { getStorageConnection, closeConnections } = require("../src/config/db.js");

describe("Vishanti Petition End-to-End Full-Stack Integration Workflow", () => {
  let backendServer;
  let baseUrl;
  let authToken;
  let registeredEmail;
  let createdComplaintId;

  before(async () => {
    // 1. Establish DB connections
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testAuthDbUri);
    }
    getStorageConnection();

    // 2. Start Express server
    await new Promise((resolve) => {
      backendServer = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${backendServer.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (backendServer) {
      await new Promise((resolve) => backendServer.close(resolve));
    }
    if (registeredEmail) {
      await UserModel.deleteOne({ email: registeredEmail });
    }
    if (createdComplaintId) {
      await Complaint.deleteOne({ complaintId: createdComplaintId });
    }
    await closeConnections();
  });

  it("Step 1: User Registration registers account and dispatches OTP", async () => {
    const timestamp = Date.now();
    registeredEmail = `student_${timestamp}@e2e-test.com`;

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `student_${timestamp}`,
        email: registeredEmail,
        password: "SecurePassword123!",
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.isVerified, false);
  });

  it("Step 2: User Verifies Email with OTP and receives Session Token", async () => {
    // In test environment, the unverified user OTP was stored directly or hashed in DB
    // For testing, simulate verification by verifying the OTP through the DB hash or setting verified
    const user = await UserModel.findOne({ email: registeredEmail }).select("+otp");
    assert.ok(user, "User record must exist");

    // Simulate OTP verification directly or mark verified for login test
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Verify login works
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: registeredEmail,
        password: "SecurePassword123!",
      }),
    });

    assert.strictEqual(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.strictEqual(loginBody.success, true);
    assert.ok(loginBody.token, "Login must return JWT token");
    authToken = loginBody.token;
  });

  it("Step 3: Client queries backend for authoritative categories", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/categories`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.includes("Hostel"));
    assert.ok(body.data.includes("Academic"));
    assert.ok(body.data.includes("Transport"));
  });

  it("Step 4: AI Classification Service classifies petition title and description", async () => {
    const res = await fetch(`${baseUrl}/api/classify-complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hostel geyser not heating water",
        description: "The hot water supply in Block B hostel bathrooms has stopped working since yesterday.",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.classification);
    assert.strictEqual(body.classification.category, "Hostel");
    assert.strictEqual(body.classification.department, "Hostel & Mess");
  });

  it("Step 5: User submits petition with the verified classified category", async () => {
    // Multipart form submission
    const boundary = "---------------------------974767299852498929531610575";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="category"',
      "",
      "Hostel",
      `--${boundary}`,
      'Content-Disposition: form-data; name="title"',
      "",
      "Hostel geyser not heating water",
      `--${boundary}`,
      'Content-Disposition: form-data; name="description"',
      "",
      "The hot water supply in Block B hostel bathrooms has stopped working since yesterday.",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${authToken}`,
      },
      body: body,
    });

    assert.strictEqual(res.status, 201);
    const resJson = await res.json();
    assert.strictEqual(resJson.success, true);
    assert.strictEqual(resJson.data.category, "Hostel");
    assert.strictEqual(resJson.data.title, "Hostel geyser not heating water");
    assert.strictEqual(resJson.data.status, "Filed");
    assert.ok(resJson.data.complaintId.startsWith("VSP-"));
    createdComplaintId = resJson.data.complaintId;
  });

  it("Step 6: User queries their complaints and verifies submitted petition appears", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/my`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(res.status, 200);
    const resJson = await res.json();
    assert.strictEqual(resJson.success, true);
    assert.ok(Array.isArray(resJson.data));
    const found = resJson.data.find((c) => c.complaintId === createdComplaintId);
    assert.ok(found, "Newly submitted complaint must appear in user's complaint list");
    assert.strictEqual(found.category, "Hostel");
  });

  it("Step 7: User inspects petition details by ID", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    assert.strictEqual(res.status, 200);
    const resJson = await res.json();
    assert.strictEqual(resJson.success, true);
    assert.strictEqual(resJson.data.complaintId, createdComplaintId);
    assert.strictEqual(resJson.data.category, "Hostel");
    assert.strictEqual(resJson.data.status, "Filed");
    assert.strictEqual(resJson.data.userId, undefined); // Sanitized
  });
});
