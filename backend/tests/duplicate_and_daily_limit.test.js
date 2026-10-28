require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super_secure_test_jwt_secret_key_with_at_least_32_characters_123!";
}

const testDbUri =
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
const { getStorageConnection } = require("../src/config/db.js");

let server;
let baseUrl;

const cleanTestData = async () => {
  await UserModel.deleteMany({ email: { $regex: /@dup-limit-test\.com$/ } });
  try {
    const storageConn = getStorageConnection();
    if (storageConn && storageConn.readyState === 1) {
      const ComplaintM = storageConn.model("Complaint");
      await ComplaintM.deleteMany({ title: { $regex: /\[Dup-Limit Test\]/ } });
    }
  } catch (e) {
    // quiet
  }
};

describe("Duplicate Complaint Prevention & Daily Limit Test Suite", () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await cleanTestData();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash("Password123!", salt);

    userA = await UserModel.create({
      username: `usera_${Date.now()}`,
      email: `usera_${Date.now()}@dup-limit-test.com`,
      password: passHash,
      role: "user",
      isVerified: true,
    });

    tokenA = jwt.sign(
      { id: userA._id.toString(), role: "user" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    userB = await UserModel.create({
      username: `userb_${Date.now()}`,
      email: `userb_${Date.now()}@dup-limit-test.com`,
      password: passHash,
      role: "user",
      isVerified: true,
    });

    tokenB = jwt.sign(
      { id: userB._id.toString(), role: "user" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );
  });

  after(async () => {
    await cleanTestData();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // 1. Initial complaint submission succeeds
  it("1. User can successfully submit an initial complaint (201 Created)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "[Dup-Limit Test] Water supply failure in Block A");
    formData.append("description", "There has been no water supply in Block A washrooms since this morning.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.title, "[Dup-Limit Test] Water supply failure in Block A");
  });

  // 2. Reject exact duplicate title by same user
  it("2. Submitting complaint with exact same title by same user is rejected (409 Conflict)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "[Dup-Limit Test] Water supply failure in Block A");
    formData.append("description", "Trying to upload the same problem again.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.success, false);
    assert.match(body.message, /already submitted a complaint with this title|duplicate/i);
  });

  // 3. Reject duplicate title with different casing (case-insensitive)
  it("3. Submitting duplicate title with different casing is rejected (409 Conflict)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "[dup-limit test] water supply failure in block a");
    formData.append("description", "Trying to submit the same problem in lowercase.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.success, false);
    assert.match(body.message, /already submitted a complaint with this title|duplicate/i);
  });

  // 4. Reject duplicate title with leading/trailing whitespace
  it("4. Submitting duplicate title with leading/trailing spaces is rejected (409 Conflict)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "   [Dup-Limit Test] Water supply failure in Block A   ");
    formData.append("description", "Trying to submit the same problem with extra whitespace.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.success, false);
    assert.match(body.message, /already submitted a complaint with this title|duplicate/i);
  });

  // 5. Another user CAN submit complaint with same title (scoped per user)
  it("5. A different user can submit a complaint with the same title (scoped per user account)", async () => {
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "[Dup-Limit Test] Water supply failure in Block A");
    formData.append("description", "User B is experiencing the same water issue in Block A.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.title, "[Dup-Limit Test] Water supply failure in Block A");
  });

  // 6. User A can submit up to 10 complaints in a day
  it("6. User A can submit up to 10 complaints in a day (submissions 2 through 10 succeed)", async () => {
    // User A currently has 1 complaint from test 1
    for (let i = 2; i <= 10; i++) {
      const formData = new FormData();
      formData.append("category", "Academic");
      formData.append("title", `[Dup-Limit Test] Problem issue number ${i}`);
      formData.append("description", `Detailed description for complaint issue number ${i} with sufficient text.`);

      const res = await fetch(`${baseUrl}/complaints`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}` },
        body: formData,
      });

      const body = await res.json();
      assert.equal(res.status, 201, `Complaint #${i} should be created successfully`);
      assert.equal(body.success, true);
    }
  });

  // 7. Submitting 11th complaint in a day is rejected
  it("7. Submitting more than 10 complaints in a day by same user is rejected (429 Too Many Requests)", async () => {
    const formData = new FormData();
    formData.append("category", "Administration");
    formData.append("title", "[Dup-Limit Test] Problem issue number 11 - exceeding quota");
    formData.append("description", "Attempting to file an 11th complaint on the same day.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 429);
    assert.equal(body.success, false);
    assert.match(body.message, /Daily complaint limit reached/i);
    assert.match(body.message, /10 complaints in a day/i);
  });

  // 8. User B is not blocked by User A reaching their daily limit
  it("8. User B can still submit complaints when User A has reached daily limit (per-account isolation)", async () => {
    const formData = new FormData();
    formData.append("category", "Infrastructure");
    formData.append("title", "[Dup-Limit Test] Streetlight broken near academic block");
    formData.append("description", "User B filing an infrastructure grievance independently.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenB}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
  });

  // 9. Complaints from previous days do not count towards today's daily limit
  it("9. Complaints from a previous day do not count towards today's 10-complaint limit", async () => {
    // Create a new fresh user
    const salt = await bcrypt.genSalt(10);
    const passHash = await bcrypt.hash("Password123!", salt);

    const userC = await UserModel.create({
      username: `userc_${Date.now()}`,
      email: `userc_${Date.now()}@dup-limit-test.com`,
      password: passHash,
      role: "user",
      isVerified: true,
    });

    const tokenC = jwt.sign(
      { id: userC._id.toString(), role: "user" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    // Seed 10 complaints created yesterday for user C directly in DB
    const storageConn = getStorageConnection();
    const ComplaintM = storageConn.model("Complaint");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2); // 2 days ago

    for (let i = 1; i <= 10; i++) {
      await ComplaintM.create({
        complaintId: `VSP-TEST-YEST-${Date.now()}-${i}`,
        userId: userC._id,
        category: "Hostel",
        title: `[Dup-Limit Test] Yesterday issue ${i}`,
        description: `Description of yesterday issue ${i} with long description.`,
        status: "Filed",
        createdAt: yesterday,
        updatedAt: yesterday,
      });
    }

    // User C submits a complaint TODAY - it should succeed because yesterday's complaints don't count towards today
    const formData = new FormData();
    formData.append("category", "Hostel");
    formData.append("title", "[Dup-Limit Test] Fresh issue submitted today");
    formData.append("description", "Today is a new day and User C should have a fresh quota of 10 complaints.");

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenC}` },
      body: formData,
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.title, "[Dup-Limit Test] Fresh issue submitted today");
  });
});
