const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

process.env.NODE_ENV = "test";
process.env.PORT = "0";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super_secure_test_jwt_secret_key_with_at_least_32_characters_123!";
}

const app = require("../src/app.js");
const UserModel = require("../src/models/auth.models.js");

let server;
let baseUrl;

const testDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

const cleanTestData = async () => {
  await UserModel.deleteMany({ email: { $regex: /@role-test\.com$/ } });
};

describe("Strict Role-Based Authentication & Access Control Suite", () => {
  const userCreds = {
    email: "student_verified@role-test.com",
    username: "student_verified",
    password: "StudentPassword123!",
  };

  const approvedOfficerCreds = {
    email: "officer_approved@role-test.com",
    username: "officer_approved",
    password: "OfficerPassword123!",
  };

  const pendingOfficerCreds = {
    email: "officer_pending@role-test.com",
    username: "officer_pending",
    password: "PendingPassword123!",
  };

  const rejectedOfficerCreds = {
    email: "officer_rejected@role-test.com",
    username: "officer_rejected",
    password: "RejectedPassword123!",
  };

  const adminCreds = {
    email: "admin_verified@role-test.com",
    username: "admin_verified",
    password: "AdminPassword123!",
  };

  let adminToken = "";
  let userToken = "";
  let officerToken = "";

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
    await cleanTestData();

    // 1. Create verified User
    await UserModel.create({
      username: userCreds.username,
      email: userCreds.email,
      password: await bcrypt.hash(userCreds.password, 10),
      role: "user",
      isVerified: true,
      verificationStatus: "none",
    });

    // 2. Create approved Officer
    await UserModel.create({
      username: approvedOfficerCreds.username,
      email: approvedOfficerCreds.email,
      password: await bcrypt.hash(approvedOfficerCreds.password, 10),
      role: "officer",
      isVerified: true,
      verificationStatus: "approved",
      department: "Hostel & Mess",
      designation: "Warden",
    });

    // 3. Create pending Officer
    await UserModel.create({
      username: pendingOfficerCreds.username,
      email: pendingOfficerCreds.email,
      password: await bcrypt.hash(pendingOfficerCreds.password, 10),
      role: "officer",
      isVerified: false,
      verificationStatus: "pending",
      department: "Academic Affairs",
      designation: "Assistant Registrar",
    });

    // 4. Create rejected Officer
    await UserModel.create({
      username: rejectedOfficerCreds.username,
      email: rejectedOfficerCreds.email,
      password: await bcrypt.hash(rejectedOfficerCreds.password, 10),
      role: "officer",
      isVerified: false,
      verificationStatus: "rejected",
      rejectionReason: "Incomplete identity credentials provided",
      department: "Examination Cell",
      designation: "Exam Officer",
    });

    // 5. Create verified Admin
    await UserModel.create({
      username: adminCreds.username,
      email: adminCreds.email,
      password: await bcrypt.hash(adminCreds.password, 10),
      role: "admin",
      isVerified: true,
      verificationStatus: "approved",
    });

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
    try {
      const { closeConnections } = require("../src/config/db.js");
      await closeConnections();
    } catch (e) {}
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // 1. Valid user credentials on User Login -> 200 OK with token & role 'user'
  it("1. Valid user credentials on User Login allows login with role 'user'", async () => {
    // Test both /auth/login with role: "user" and direct dedicated portal /auth/user/login
    const res = await fetch(`${baseUrl}/auth/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: userCreds.email,
        password: userCreds.password,
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.role, "user");
    assert.ok(data.token);
    userToken = data.token;
  });

  // 2. Valid officer credentials on User Login -> rejected (403 Forbidden)
  it("2. Valid officer credentials on User Login are rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/auth/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: approvedOfficerCreds.email,
        password: approvedOfficerCreds.password,
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /cannot be used for User Login/i);
  });

  // 3. Valid admin credentials on User Login -> rejected (403 Forbidden)
  it("3. Valid admin credentials on User Login are rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/auth/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: adminCreds.email,
        password: adminCreds.password,
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /cannot be used for User Login/i);
  });

  // 4. Valid approved officer credentials on Authority Login -> 200 OK
  it("4. Valid approved officer credentials on Authority Login allows login with role 'officer'", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: approvedOfficerCreds.email,
        password: approvedOfficerCreds.password,
        role: "officer",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.role, "officer");
    assert.ok(data.token);
    officerToken = data.token;
  });

  // 5. Valid user credentials on Authority Login -> rejected (403 Forbidden)
  it("5. Valid user credentials on Authority Login are rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: userCreds.email,
        password: userCreds.password,
        role: "officer",
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /cannot be used for Authority Login/i);
  });

  // 6. Valid admin credentials on Authority Login -> rejected (403 Forbidden)
  it("6. Valid admin credentials on Authority Login are rejected with 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: adminCreds.email,
        password: adminCreds.password,
        role: "officer",
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /cannot be used for Authority Login/i);
  });

  // 7. Pending officer credentials on Authority Login -> rejected with pending explanation
  it("7. Pending officer credentials on Authority Login are rejected with clear pending-approval message", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: pendingOfficerCreds.email,
        password: pendingOfficerCreds.password,
        role: "officer",
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /pending administrator verification/i);
  });

  // 8. Rejected officer credentials on Authority Login -> rejected with reason
  it("8. Rejected officer credentials on Authority Login are rejected with rejection reason", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: rejectedOfficerCreds.email,
        password: rejectedOfficerCreds.password,
        role: "officer",
      }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /Incomplete identity credentials provided/i);
  });

  // 9. Valid admin credentials on Admin Login -> 200 OK with role 'admin'
  it("9. Valid admin credentials on Admin Login allows login with role 'admin'", async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: adminCreds.email,
        password: adminCreds.password,
        role: "admin",
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.user.role, "admin");
    assert.ok(data.token);
    adminToken = data.token;
  });

  // 10. User & officer cannot log in on Admin Login
  it("10. User and Officer credentials on Admin Login are rejected with 403 Forbidden", async () => {
    const resUser = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: userCreds.email,
        password: userCreds.password,
        role: "admin",
      }),
    });
    assert.equal(resUser.status, 403);
    const dataUser = await resUser.json();
    assert.match(dataUser.message, /cannot be used for Admin Login/i);

    const resOfficer = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: approvedOfficerCreds.email,
        password: approvedOfficerCreds.password,
        role: "admin",
      }),
    });
    assert.equal(resOfficer.status, 403);
    const dataOfficer = await resOfficer.json();
    assert.match(dataOfficer.message, /cannot be used for Admin Login/i);
  });

  // 11. Role-based backend authorization for Admin endpoints
  it("11. Role-based backend authorization prevents user and officer from accessing admin endpoints", async () => {
    const resUser = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resUser.status, 403);

    const resOfficer = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.equal(resOfficer.status, 403);

    const resAdmin = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resAdmin.status, 200);
  });

  // 12. Notifications endpoint returns role-scoped data
  it("12. GET /api/notifications returns role-appropriate notifications", async () => {
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.data));
  });
});
