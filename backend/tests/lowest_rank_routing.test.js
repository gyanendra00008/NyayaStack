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
const {
  DEPARTMENT_DESIGNATIONS,
  getRankForDesignation,
} = require("../src/utils/hierarchy.utils.js");

let server;
let baseUrl;

const cleanTestData = async () => {
  await UserModel.deleteMany({ email: { $regex: /@lowest-rank-test\.com$/ } });
  try {
    const storageConn = getStorageConnection();
    if (storageConn && storageConn.readyState === 1) {
      const ComplaintM = storageConn.model("Complaint");
      await ComplaintM.deleteMany({ title: { $regex: /\[Lowest Rank Test\]/ } });
    }
  } catch (e) {
    // quiet
  }
};

describe("Lowest Rank Authority Routing & Visibility Test Suite", () => {
  let studentUser;
  let studentToken;

  let chiefWarden; // Rank 1 (Highest)
  let chiefWardenToken;

  let caretaker; // Rank 6 (Lowest)
  let caretakerToken;

  let deanAcademic; // Academic Affairs Rank 1
  let deanToken;

  let programCoordinator; // Academic Affairs Rank 5 (Lowest)
  let coordinatorToken;

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

    // 1. Create Student
    studentUser = await UserModel.create({
      username: `student_${Date.now()}`,
      email: `student_${Date.now()}@lowest-rank-test.com`,
      password: passHash,
      role: "user",
      isVerified: true,
      verificationStatus: "none",
    });
    studentToken = jwt.sign(
      { id: studentUser._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Create Chief Warden (Hostel & Mess, Rank 1)
    chiefWarden = await UserModel.create({
      username: `warden_chief_${Date.now()}`,
      email: `chief_warden_${Date.now()}@lowest-rank-test.com`,
      password: passHash,
      role: "officer",
      department: "Hostel & Mess",
      designation: "Chief Warden",
      rank: 1,
      isVerified: true,
      verificationStatus: "approved",
    });
    chiefWardenToken = jwt.sign(
      { id: chiefWarden._id, role: "officer", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. Create Caretaker (Hostel & Mess, Rank 6 - Lowest Rank)
    caretaker = await UserModel.create({
      username: `caretaker_${Date.now()}`,
      email: `caretaker_${Date.now()}@lowest-rank-test.com`,
      password: passHash,
      role: "officer",
      department: "Hostel & Mess",
      designation: "Caretaker",
      rank: 6,
      isVerified: true,
      verificationStatus: "approved",
    });
    caretakerToken = jwt.sign(
      { id: caretaker._id, role: "officer", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 4. Create Dean (Academic Affairs, Rank 1)
    deanAcademic = await UserModel.create({
      username: `dean_${Date.now()}`,
      email: `dean_${Date.now()}@lowest-rank-test.com`,
      password: passHash,
      role: "officer",
      department: "Academic Affairs",
      designation: "Dean (Academic Affairs)",
      rank: 1,
      isVerified: true,
      verificationStatus: "approved",
    });
    deanToken = jwt.sign(
      { id: deanAcademic._id, role: "officer", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 5. Create Program Coordinator (Academic Affairs, Rank 5 - Lowest Rank)
    programCoordinator = await UserModel.create({
      username: `coordinator_${Date.now()}`,
      email: `coordinator_${Date.now()}@lowest-rank-test.com`,
      password: passHash,
      role: "officer",
      department: "Academic Affairs",
      designation: "Program Coordinator",
      rank: 5,
      isVerified: true,
      verificationStatus: "approved",
    });
    coordinatorToken = jwt.sign(
      { id: programCoordinator._id, role: "officer", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  after(async () => {
    await cleanTestData();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      const storageConn = getStorageConnection();
      if (storageConn && storageConn.readyState !== 0) {
        await storageConn.close();
      }
    } catch (e) {}
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  it("1. Submitting a 'Hostel' complaint routes directly to Caretaker (lowest rank in Hostel & Mess)", async () => {
    const payload = {
      category: "Hostel",
      title: "[Lowest Rank Test] Water issue in Room 101",
      description: "Hot water geyser in Room 101 has not been heating for two days.",
    };

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.data.department, "Hostel & Mess");
    assert.equal(data.data.assignedDesignation, "Caretaker");
    assert.equal(data.data.assignedRank, 6);
    assert.equal(data.data.assignedTo.toString(), caretaker._id.toString());
    assert.equal(data.data.status, "Filed");
  });

  it("2. The complaint IS visible on Caretaker's assigned workqueue", async () => {
    const res = await fetch(`${baseUrl}/complaints/assigned`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${caretakerToken}`,
      },
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.data.length >= 1);

    const found = data.data.find(
      (c) => c.title === "[Lowest Rank Test] Water issue in Room 101"
    );
    assert.ok(found, "Complaint must appear in Caretaker's assigned queue");
    assert.equal(found.department, "Hostel & Mess");
    assert.equal(found.assignedDesignation, "Caretaker");
  });

  it("3. The complaint is NOT visible to Chief Warden (higher rank in same department)", async () => {
    const res = await fetch(`${baseUrl}/complaints/assigned`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${chiefWardenToken}`,
      },
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);

    const found = data.data.find(
      (c) => c.title === "[Lowest Rank Test] Water issue in Room 101"
    );
    assert.equal(
      found,
      undefined,
      "Complaint must NOT be visible to Chief Warden (must route only to lowest rank authority)"
    );
  });

  it("4. Submitting an 'Academic' complaint routes to Program Coordinator (lowest rank in Academic Affairs)", async () => {
    const payload = {
      category: "Academic",
      title: "[Lowest Rank Test] Course syllabus query",
      description: "CS402 syllabus details need clarification for lab requirements.",
    };

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.data.department, "Academic Affairs");
    assert.equal(data.data.assignedDesignation, "Program Coordinator");
    assert.equal(data.data.assignedRank, 5);
    assert.equal(data.data.assignedTo.toString(), programCoordinator._id.toString());
  });

  it("5. Academic complaint is visible to Program Coordinator but NOT to Dean", async () => {
    // Check Program Coordinator
    const resCoord = await fetch(`${baseUrl}/complaints/assigned`, {
      method: "GET",
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    const dataCoord = await resCoord.json();
    assert.equal(resCoord.status, 200);
    const foundCoord = dataCoord.data.find(
      (c) => c.title === "[Lowest Rank Test] Course syllabus query"
    );
    assert.ok(foundCoord, "Must be visible to Program Coordinator");

    // Check Dean
    const resDean = await fetch(`${baseUrl}/complaints/assigned`, {
      method: "GET",
      headers: { Authorization: `Bearer ${deanToken}` },
    });
    const dataDean = await resDean.json();
    assert.equal(resDean.status, 200);
    const foundDean = dataDean.data.find(
      (c) => c.title === "[Lowest Rank Test] Course syllabus query"
    );
    assert.equal(
      foundDean,
      undefined,
      "Must NOT be visible to Dean of Academic Affairs"
    );
  });

  it("6. Lowest rank authority can update the status of their assigned complaint", async () => {
    // 1. Create a complaint
    const payload = {
      category: "Hostel",
      title: "[Lowest Rank Test] Window latch repair",
      description: "Window latch is loose in room 205 and rattles in high wind.",
    };

    const resCreate = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify(payload),
    });
    const created = await resCreate.json();
    const complaintId = created.data.complaintId;

    // 2. Caretaker updates status to 'In Progress'
    const resUpdate = await fetch(`${baseUrl}/complaints/${complaintId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${caretakerToken}`,
      },
      body: JSON.stringify({ status: "In Progress" }),
    });

    const dataUpdate = await resUpdate.json();
    assert.equal(resUpdate.status, 200);
    assert.equal(dataUpdate.success, true);
    assert.equal(dataUpdate.data.status, "In Progress");

    // 3. Chief Warden (not assigned) is rejected if attempting to update
    const resUnauthorized = await fetch(`${baseUrl}/complaints/${complaintId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chiefWardenToken}`,
      },
      body: JSON.stringify({ status: "Resolved" }),
    });
    assert.equal(resUnauthorized.status, 403);
  });
});
