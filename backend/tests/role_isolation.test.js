const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app.js");
const UserModel = require("../src/models/auth.models.js");
const Complaint = require("../src/models/complaint.models.js");
const { getStorageConnection, closeConnections } = require("../src/config/db.js");
const { JWT_CONFIG } = require("../src/config/jwt.config.js");

describe("Strict Role Isolation and Notification Scoping Test Suite", () => {
  let server;
  let baseUrl;

  let userToken;
  let userId;
  let userEmail;

  let officerToken;
  let officerId;
  let officerEmail;

  let pendingOfficerToken;
  let pendingOfficerId;

  let adminToken;
  let adminId;
  let adminEmail;

  let testComplaintId;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nyayastack_auth_test");
    }
    getStorageConnection();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    const timestamp = Date.now();

    // 1. Create a verified student/user
    userEmail = `user_iso_${timestamp}@test.com`;
    const userDoc = await UserModel.create({
      username: `user_iso_${timestamp}`,
      email: userEmail,
      password: "HashedPassword123!",
      role: "user",
      isVerified: true,
      verificationStatus: "none",
    });
    userId = userDoc._id;
    userToken = jwt.sign(
      { id: userDoc._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: "1h" }
    );

    // 2. Create an approved authority officer
    officerEmail = `officer_iso_${timestamp}@test.com`;
    const officerDoc = await UserModel.create({
      username: `officer_iso_${timestamp}`,
      email: officerEmail,
      password: "HashedPassword123!",
      fullName: "Officer Iso",
      department: "Hostel & Mess",
      designation: "Hostel Warden",
      rank: 4,
      role: "officer",
      isVerified: true,
      verificationStatus: "approved",
    });
    officerId = officerDoc._id;
    officerToken = jwt.sign(
      { id: officerDoc._id, role: "officer", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: "1h" }
    );

    // 3. Create a pending authority officer
    const pendingOfficerDoc = await UserModel.create({
      username: `pending_iso_${timestamp}`,
      email: `pending_${timestamp}@test.com`,
      password: "HashedPassword123!",
      department: "Hostel & Mess",
      designation: "Hostel Warden",
      rank: 4,
      role: "officer",
      isVerified: true,
      verificationStatus: "pending",
    });
    pendingOfficerId = pendingOfficerDoc._id;
    pendingOfficerToken = jwt.sign(
      { id: pendingOfficerDoc._id, role: "officer", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: "1h" }
    );

    // 4. Create an institutional admin
    adminEmail = `admin_iso_${timestamp}@test.com`;
    const adminDoc = await UserModel.create({
      username: `admin_iso_${timestamp}`,
      email: adminEmail,
      password: "HashedPassword123!",
      role: "admin",
      isVerified: true,
      verificationStatus: "approved",
    });
    adminId = adminDoc._id;
    adminToken = jwt.sign(
      { id: adminDoc._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: JWT_CONFIG.algorithm, expiresIn: "1h" }
    );

    // 5. Create a test complaint belonging to user, assigned to officer
    testComplaintId = `VSP-ISO-${timestamp.toString().slice(-4)}`;
    await Complaint.create({
      complaintId: testComplaintId,
      userId: userDoc._id,
      category: "Hostel",
      department: "Hostel & Mess",
      priority: "Medium",
      title: "Broken window latch in room 204",
      description: "The window latch is broken and needs urgent repair.",
      status: "Assigned",
      assignedTo: officerDoc._id,
      assignedDesignation: "Hostel Warden",
      assignedRank: 4,
      slaDueAt: new Date(Date.now() + 48 * 3600 * 1000),
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await UserModel.deleteMany({
      _id: { $in: [userId, officerId, pendingOfficerId, adminId] },
    });
    await Complaint.deleteMany({ complaintId: testComplaintId });
    await closeConnections();
  });

  it("1. User cannot access officer-only endpoints (GET /api/complaints/assigned)", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/assigned`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(res.status, 403, "User must receive 403 Forbidden accessing officer endpoint");
  });

  it("2. User cannot access admin-only endpoints (GET /api/admin/dashboard)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(res.status, 403, "User must receive 403 Forbidden accessing admin endpoint");
  });

  it("3. User cannot access admin authority requests (GET /api/admin/authority-requests)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/authority-requests`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(res.status, 403, "User must receive 403 Forbidden accessing authority requests");
  });

  it("4. Officer cannot access admin-only endpoints (GET /api/admin/dashboard)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.status, 403, "Officer must receive 403 Forbidden accessing admin dashboard");
  });

  it("5. Officer cannot access user petition submission (POST /api/complaints)", async () => {
    const boundary = "---------------------------iso97476729985249";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="category"',
      "",
      "Hostel",
      `--${boundary}`,
      'Content-Disposition: form-data; name="title"',
      "",
      "Officer trying to submit petition",
      `--${boundary}`,
      'Content-Disposition: form-data; name="description"',
      "",
      "This request must be rejected because officers cannot file student complaints.",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const res = await fetch(`${baseUrl}/api/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${officerToken}`,
      },
      body,
    });
    assert.strictEqual(res.status, 403, "Officer must receive 403 Forbidden when trying to file a student complaint");
  });

  it("6. Officer cannot access user's personal complaints endpoint (GET /api/complaints/my)", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/my`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.status, 403, "Officer must receive 403 Forbidden accessing /api/complaints/my");
  });

  it("7. Pending officer cannot access officer endpoints (blocked by verificationStatus check)", async () => {
    const res = await fetch(`${baseUrl}/api/complaints/assigned`, {
      headers: { Authorization: `Bearer ${pendingOfficerToken}` },
    });
    assert.strictEqual(res.status, 403, "Pending officer must receive 403 Forbidden");
  });

  it("8. User notifications are strictly scoped to user's complaints", async () => {
    const res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    // User should only see their own complaint notifications
    for (const notif of body.data) {
      if (notif.complaintId) {
        assert.strictEqual(notif.complaintId, testComplaintId);
      }
    }
  });

  it("9. Officer notifications are strictly scoped to officer's assigned duties", async () => {
    const res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    // Officer should see notifications for complaints assigned to them
    const found = body.data.find((n) => n.complaintId === testComplaintId);
    assert.ok(found, "Officer must see notification for assigned complaint");
  });

  it("10. Admin notifications contain pending authority requests and escalations", async () => {
    const res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    // Admin should see authority requests
    const foundReq = body.data.find((n) => n.id && n.id.startsWith("req-"));
    assert.ok(foundReq, "Admin notifications must include authority registration requests");
  });

  it("11. Mark single notification as read updates recipient state", async () => {
    const notifId = `asg-${testComplaintId}`;
    const res = await fetch(`${baseUrl}/api/notifications/${notifId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    // Verify in UserModel
    const updatedUser = await UserModel.findById(userId).lean();
    assert.ok(updatedUser.readNotifications.includes(notifId), "Notification ID must be persisted in readNotifications");
  });

  it("12. Mark all notifications as read updates allNotificationsReadAt timestamp", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const updatedUser = await UserModel.findById(userId).lean();
    assert.ok(updatedUser.allNotificationsReadAt, "allNotificationsReadAt must be set");
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      if (testComplaintId) {
        const storageConn = getStorageConnection();
        if (storageConn && storageConn.readyState === 1) {
          const ComplaintM = storageConn.model("Complaint");
          await ComplaintM.deleteOne({ complaintId: testComplaintId });
        }
      }
      if (userId) await UserModel.deleteOne({ _id: userId });
      if (officerId) await UserModel.deleteOne({ _id: officerId });
      if (pendingOfficerId) await UserModel.deleteOne({ _id: pendingOfficerId });
      if (adminId) await UserModel.deleteOne({ _id: adminId });
    } catch (e) {}

    try {
      await closeConnections();
    } catch (e) {}
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
});
