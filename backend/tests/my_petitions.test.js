const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const app = require("../src/app");
const UserModel = require("../src/models/auth.models");
const Complaint = require("../src/models/complaint.models");

let server;
let baseUrl;

const testDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

const timestamp = Date.now();
const user1Email = `student1_${timestamp}@mypetitions.com`;
const user2Email = `student2_${timestamp}@mypetitions.com`;
const officerEmail = `warden_${timestamp}@mypetitions.com`;
const password = "ValidPass123!";

let user1Token;
let user2Token;
let officerToken;
let petition1Id;
let petition2Id;
let petition3Id;

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testDbUri);
  }
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
});

after(async () => {
  await UserModel.deleteMany({ email: { $regex: /@mypetitions\.com$/ } });
  if (petition1Id || petition2Id || petition3Id) {
    await Complaint.deleteMany({
      complaintId: { $in: [petition1Id, petition2Id, petition3Id].filter(Boolean) },
    });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe("My Petitions Complete Functional & Integration Suite", () => {
  it("1. Setup: Register and authenticate Student 1", async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `st1_${timestamp}`.slice(0, 20),
        fullName: "Student One",
        email: user1Email,
        password,
        phone: "9876543210",
        college: "VSP Institute",
        department: "Computer Science",
        rollNo: "CS2026-001",
      }),
    });
    assert.equal(regRes.status, 201);
    const user = await UserModel.findOne({ email: user1Email });
    assert.ok(user);
    user.isVerified = true;
    user.verificationStatus = "approved";
    await user.save();

    const loginRes = await fetch(`${baseUrl}/auth/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: user1Email, password }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    user1Token = loginData.token;
    assert.ok(user1Token);
  });

  it("2. Initial State: Empty petitions list with zero summary metrics", async () => {
    const res = await fetch(`${baseUrl}/complaints/my`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.equal(body.data.length, 0);
    assert.equal(body.summary.total, 0);
    assert.equal(body.summary.pending, 0);
    assert.equal(body.summary.inProgress, 0);
    assert.equal(body.summary.resolved, 0);
  });

  it("3. File 3 petitions with different categories, titles, and statuses", async () => {
    // Petition 1: Hostel (Filed)
    const p1Res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user1Token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Broken hostel geyser in Block B floor 2",
        description: "Hot water geyser has been leaking and cold water is running for 3 days.",
        category: "Hostel",
        priority: "High",
      }),
    });
    assert.equal(p1Res.status, 201);
    const p1Data = await p1Res.json();
    petition1Id = p1Data.complaint?.complaintId || p1Data.data?.complaintId;
    assert.ok(petition1Id);

    // Petition 2: Academic (Set to In Progress)
    const p2Res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user1Token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Exam schedule clash in semester 5 core subjects",
        description: "Operating Systems and Computer Networks exams scheduled on the same slot.",
        category: "Academic",
        priority: "Urgent",
      }),
    });
    assert.equal(p2Res.status, 201);
    const p2Data = await p2Res.json();
    petition2Id = p2Data.complaint?.complaintId || p2Data.data?.complaintId;
    assert.ok(petition2Id);

    // Petition 3: Infrastructure (Set to Resolved)
    const p3Res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${user1Token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Flickering overhead light in Lab 302",
        description: "The LED tube light above terminal 14 keeps flickering violently.",
        category: "Infrastructure",
        priority: "Medium",
      }),
    });
    assert.equal(p3Res.status, 201);
    const p3Data = await p3Res.json();
    petition3Id = p3Data.complaint?.complaintId || p3Data.data?.complaintId;
    assert.ok(petition3Id);

    // Directly update status of Petition 2 to "In Progress" and Petition 3 to "Resolved" in MongoDB
    await Complaint.updateOne({ complaintId: petition2Id }, { $set: { status: "In Progress" } });
    await Complaint.updateOne({ complaintId: petition3Id }, { $set: { status: "Resolved" } });
  });

  it("4. Fetch all petitions and verify accurate Summary Cards metrics", async () => {
    const res = await fetch(`${baseUrl}/complaints/my`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.data.length, 3);
    assert.equal(body.summary.total, 3);
    assert.equal(body.summary.pending, 1); // 1 Filed
    assert.equal(body.summary.inProgress, 1); // 1 In Progress
    assert.equal(body.summary.resolved, 1); // 1 Resolved
  });

  it("5. Search filtering by Title or Petition ID", async () => {
    // Search by title keyword
    const searchRes = await fetch(`${baseUrl}/complaints/my?search=geyser`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.equal(searchBody.data.length, 1);
    assert.equal(searchBody.data[0].complaintId, petition1Id);

    // Search by exact Petition ID
    const idRes = await fetch(`${baseUrl}/complaints/my?search=${petition2Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(idRes.status, 200);
    const idBody = await idRes.json();
    assert.equal(idBody.data.length, 1);
    assert.equal(idBody.data[0].complaintId, petition2Id);
  });

  it("6. Status Filtering (Pending, In Progress, Resolved)", async () => {
    // Filter Pending
    const pendingRes = await fetch(`${baseUrl}/complaints/my?status=Pending`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(pendingRes.status, 200);
    const pendingBody = await pendingRes.json();
    assert.equal(pendingBody.data.length, 1);
    assert.equal(pendingBody.data[0].complaintId, petition1Id);

    // Filter In Progress
    const inProgRes = await fetch(`${baseUrl}/complaints/my?status=In Progress`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(inProgRes.status, 200);
    const inProgBody = await inProgRes.json();
    assert.equal(inProgBody.data.length, 1);
    assert.equal(inProgBody.data[0].complaintId, petition2Id);

    // Filter Resolved
    const resRes = await fetch(`${baseUrl}/complaints/my?status=Resolved`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(resRes.status, 200);
    const resBody = await resRes.json();
    assert.equal(resBody.data.length, 1);
    assert.equal(resBody.data[0].complaintId, petition3Id);
  });

  it("7. Category Filtering", async () => {
    const catRes = await fetch(`${baseUrl}/complaints/my?category=Academic`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(catRes.status, 200);
    const catBody = await catRes.json();
    assert.equal(catBody.data.length, 1);
    assert.equal(catBody.data[0].category, "Academic");
    assert.equal(catBody.data[0].complaintId, petition2Id);
  });

  it("8. Sorting by newest and oldest submission date", async () => {
    const newestRes = await fetch(`${baseUrl}/complaints/my?sort=newest`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const newestBody = await newestRes.json();

    const oldestRes = await fetch(`${baseUrl}/complaints/my?sort=oldest`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const oldestBody = await oldestRes.json();

    assert.equal(newestBody.data[0].complaintId, petition3Id);
    assert.equal(oldestBody.data[0].complaintId, petition1Id);
  });

  it("9. Pagination support (page and limit)", async () => {
    const page1Res = await fetch(`${baseUrl}/complaints/my?page=1&limit=2`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(page1Res.status, 200);
    const page1Body = await page1Res.json();
    assert.equal(page1Body.data.length, 2);
    assert.equal(page1Body.pagination.page, 1);
    assert.equal(page1Body.pagination.limit, 2);
    assert.equal(page1Body.pagination.total, 3);
    assert.equal(page1Body.pagination.totalPages, 2);

    const page2Res = await fetch(`${baseUrl}/complaints/my?page=2&limit=2`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(page2Res.status, 200);
    const page2Body = await page2Res.json();
    assert.equal(page2Body.data.length, 1);
    assert.equal(page2Body.pagination.page, 2);
  });

  it("10. Petition Details: Owner can inspect full details including attachments", async () => {
    const detailRes = await fetch(`${baseUrl}/complaints/${petition1Id}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(detailRes.status, 200);
    const detailBody = await detailRes.json();
    assert.equal(detailBody.success, true);
    assert.equal(detailBody.data.complaintId, petition1Id);
    assert.equal(detailBody.data.category, "Hostel");
    assert.ok(detailBody.data.title);
    assert.ok(detailBody.data.description);
    assert.ok(detailBody.data.createdAt);
  });

  it("11. Security & Data Isolation: User 2 cannot see or access User 1's petitions", async () => {
    // Register User 2
    await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `st2_${timestamp}`.slice(0, 20),
        fullName: "Student Two",
        email: user2Email,
        password,
        phone: "9876543211",
        college: "VSP Institute",
        department: "Mechanical",
        rollNo: "ME2026-002",
      }),
    });
    const user2 = await UserModel.findOne({ email: user2Email });
    assert.ok(user2);
    user2.isVerified = true;
    user2.verificationStatus = "approved";
    await user2.save();

    const loginRes2 = await fetch(`${baseUrl}/auth/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: user2Email, password }),
    });
    const loginData2 = await loginRes2.json();
    user2Token = loginData2.token;
    assert.ok(user2Token);

    // User 2's My Petitions must be empty
    const res2 = await fetch(`${baseUrl}/complaints/my`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const body2 = await res2.json();
    assert.equal(body2.data.length, 0);
    assert.equal(body2.summary.total, 0);

    // User 2 attempting to access User 1's petition detail is rejected with 403 Forbidden
    const unauthDetailRes = await fetch(`${baseUrl}/complaints/${petition1Id}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.equal(unauthDetailRes.status, 403);
    const unauthBody = await unauthDetailRes.json();
    assert.match(unauthBody.message, /not authorized/i);
  });

  it("12. Role Isolation: Officer and Unauthenticated tokens are rejected from /complaints/my", async () => {
    // Unauthenticated
    const unauthRes = await fetch(`${baseUrl}/complaints/my`);
    assert.equal(unauthRes.status, 401);

    // Register officer
    await fetch(`${baseUrl}/auth/authority/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Officer Authority",
        email: officerEmail,
        password: "OfficerPass123!",
        phone: "9876543212",
        designation: "Warden",
        department: "Hostel & Mess",
        employeeId: "EMP-9999",
      }),
    });
    const officerUser = await UserModel.findOne({ email: officerEmail });
    assert.ok(officerUser);
    officerUser.isVerified = true;
    officerUser.verificationStatus = "approved";
    await officerUser.save();

    const officerLoginRes = await fetch(`${baseUrl}/auth/authority/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: officerEmail, password: "OfficerPass123!", role: "officer" }),
    });
    assert.equal(officerLoginRes.status, 200);
    const officerLoginData = await officerLoginRes.json();
    officerToken = officerLoginData.token;
    assert.ok(officerToken);

    // Officer attempting to call /complaints/my (student endpoint) must be rejected with 403 Forbidden
    const officerMyRes = await fetch(`${baseUrl}/complaints/my`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.equal(officerMyRes.status, 403);
  });
});
