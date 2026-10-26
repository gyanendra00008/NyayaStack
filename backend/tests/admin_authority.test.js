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

const app = require("../src/app.js");
const UserModel = require("../src/models/auth.models.js");
const Complaint = require("../src/models/complaint.models.js");
const { getStorageConnection } = require("../src/config/db.js");

let server;
let baseUrl;

const testDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

const cleanTestData = async () => {
  await UserModel.deleteMany({ email: { $regex: /@authority-test\.com$/ } });
  try {
    const storageConn = getStorageConnection();
    if (storageConn && storageConn.readyState === 1) {
      const ComplaintM = storageConn.model("Complaint");
      await ComplaintM.deleteMany({ title: { $regex: /\[Test Authority\]/ } });
    }
  } catch (e) {
    // optional storage cleanup
  }
};

describe("Authority Verification & Admin Approval Test Suite", () => {
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
    } catch (e) {
      // quiet
    }
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  // 1. Normal user registration still works exactly as before
  it("1. Normal user registration creates unverified user with verificationStatus 'none' and role 'user'", async () => {
    const student = {
      username: `student_${Date.now()}`,
      email: `student_${Date.now()}@authority-test.com`,
      password: "StudentPassword123!",
      fullName: "Test Student",
      rollNo: "CS202601",
    };

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(student),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.user.role, "user");

    const inDb = await UserModel.findOne({ email: student.email.toLowerCase() });
    assert.ok(inDb);
    assert.equal(inDb.role, "user");
    assert.equal(inDb.isVerified, false);
    assert.equal(inDb.verificationStatus, "none");
  });

  // 2. Normal user login still works exactly as before
  it("2. Normal user login works properly when verified", async () => {
    const verifiedStudent = await UserModel.create({
      username: `ver_stud_${Date.now()}`,
      email: `ver_stud_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("StudentPass123!", 10),
      isVerified: true,
      role: "user",
      verificationStatus: "none",
    });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: verifiedStudent.email,
        password: "StudentPass123!",
      }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.ok(data.token);
    assert.equal(data.user.role, "user");
  });

  // 3. Authority registration creates a pending application
  it("3. Authority registration creates a pending application with role 'officer' and verificationStatus 'pending'", async () => {
    const authorityPayload = {
      name: "Dr. Ramesh Sharma",
      email: `officer_sharma_${Date.now()}@authority-test.com`,
      employeeId: "EMP9876",
      department: "Anti-Ragging Committee",
      designation: "Committee Member",
      password: "OfficerPass123!",
      role: "admin", // Malicious attempt to escalate role
      verificationStatus: "approved", // Malicious attempt to self-approve
    };

    const res = await fetch(`${baseUrl}/auth/authority/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authorityPayload),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.match(data.message, /Pending institutional administrator review/i);

    // Verify in database that backend strictly enforced pending status and officer role
    const inDb = await UserModel.findOne({ email: authorityPayload.email.toLowerCase() });
    assert.ok(inDb);
    assert.equal(inDb.role, "officer", "Role must be 'officer', never 'admin'");
    assert.equal(inDb.verificationStatus, "pending", "Status must be 'pending', ignoring request body");
    assert.equal(inDb.isVerified, false, "Must be unverified until admin review");
    assert.equal(inDb.department, "Anti-Ragging Committee");
    assert.equal(inDb.designation, "Committee Member");
    assert.equal(inDb.rollNo, "EMP9876");
  });

  // 4. A pending authority cannot log in
  it("4. A pending authority cannot log in (rejected with 403 Forbidden explaining pending verification)", async () => {
    const pendingOfficer = await UserModel.create({
      username: `pending_off_${Date.now()}`,
      email: `pending_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("OfficerSecret123!", 10),
      role: "officer",
      verificationStatus: "pending",
      isVerified: false,
    });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: pendingOfficer.email,
        password: "OfficerSecret123!",
      }),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.message, /pending administrator verification/i);
  });

  // 5. A pending authority cannot access authority-only APIs even with a forged or stale JWT
  it("5. A pending authority cannot access authority-protected endpoints", async () => {
    const pendingOfficer = await UserModel.create({
      username: `pending_api_${Date.now()}`,
      email: `pending_api_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("OfficerSecret123!", 10),
      role: "officer",
      verificationStatus: "pending",
      isVerified: true, // Suppose isVerified was set but verificationStatus is pending
      tokenVersion: 0,
    });

    const token = jwt.sign(
      { id: pendingOfficer._id, role: pendingOfficer.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    // Call admin/dashboard (only admin)
    const resAdmin = await fetch(`${baseUrl}/admin/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resAdmin.status, 403);

    // Call authority-requests (only admin)
    const resReqs = await fetch(`${baseUrl}/admin/authority-requests`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(resReqs.status, 403);
  });

  // 6. Only an authorized admin can view authority applications
  it("6. Only an authorized admin can view authority applications (Normal users and unauthenticated users rejected)", async () => {
    // 6a. Unauthenticated visitor -> 401
    const resUnauth = await fetch(`${baseUrl}/admin/authority-requests`);
    assert.equal(resUnauth.status, 401);

    // 6b. Standard user -> 403
    const stdUser = await UserModel.create({
      username: `std_unauth_${Date.now()}`,
      email: `std_unauth_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("UserPass123!", 10),
      role: "user",
      isVerified: true,
      tokenVersion: 0,
    });
    const stdToken = jwt.sign(
      { id: stdUser._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const resStd = await fetch(`${baseUrl}/admin/authority-requests`, {
      headers: { Authorization: `Bearer ${stdToken}` },
    });
    assert.equal(resStd.status, 403);

    // 6c. Authorized Administrator -> 200
    const adminUser = await UserModel.create({
      username: `admin_user_${Date.now()}`,
      email: `admin_user_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("AdminPass123!", 10),
      role: "admin",
      isVerified: true,
      tokenVersion: 0,
    });
    const adminToken = jwt.sign(
      { id: adminUser._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const resAdmin = await fetch(`${baseUrl}/admin/authority-requests`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resAdmin.status, 200);
    const dataAdmin = await resAdmin.json();
    assert.equal(dataAdmin.success, true);
    assert.ok(Array.isArray(dataAdmin.data));
    assert.ok(dataAdmin.counts);
    assert.ok(typeof dataAdmin.counts.pending === "number");
  });

  // 7. Only an authorized admin can approve an application
  it("7. Authorized admin can approve an application, enabling authority login and access", async () => {
    const adminUser = await UserModel.create({
      username: `admin_approver_${Date.now()}`,
      email: `admin_appr_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("AdminPass123!", 10),
      role: "admin",
      isVerified: true,
      tokenVersion: 0,
    });
    const adminToken = jwt.sign(
      { id: adminUser._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const applicant = await UserModel.create({
      username: `applicant_appr_${Date.now()}`,
      email: `applicant_appr_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("OfficerSecret123!", 10),
      role: "officer",
      verificationStatus: "pending",
      isVerified: false,
      department: "Hostel & Mess",
      designation: "Warden",
    });

    // Approve the applicant
    const resApprove = await fetch(`${baseUrl}/admin/authority-requests/${applicant._id}/approve`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
    });

    assert.equal(resApprove.status, 200);
    const dataApprove = await resApprove.json();
    assert.equal(dataApprove.success, true);
    assert.equal(dataApprove.data.verificationStatus, "approved");
    assert.equal(dataApprove.data.isVerified, true);

    // Verify DB record
    const updatedApplicant = await UserModel.findById(applicant._id);
    assert.equal(updatedApplicant.verificationStatus, "approved");
    assert.equal(updatedApplicant.isVerified, true);
    assert.equal(updatedApplicant.reviewedBy.toString(), adminUser._id.toString());
    assert.ok(updatedApplicant.reviewedAt);

    // Now approved authority can log in
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: applicant.email,
        password: "OfficerSecret123!",
      }),
    });

    assert.equal(resLogin.status, 200);
    const dataLogin = await resLogin.json();
    assert.equal(dataLogin.success, true);
    assert.ok(dataLogin.token);
    assert.equal(dataLogin.user.verificationStatus, "approved");
  });

  // 8. Authorized admin can reject an application with a reason
  it("8. Authorized admin can reject an application with reason, denying access and reporting reason on login", async () => {
    const adminUser = await UserModel.create({
      username: `admin_rejecter_${Date.now()}`,
      email: `admin_rej_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("AdminPass123!", 10),
      role: "admin",
      isVerified: true,
      tokenVersion: 0,
    });
    const adminToken = jwt.sign(
      { id: adminUser._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const applicant = await UserModel.create({
      username: `applicant_rej_${Date.now()}`,
      email: `applicant_rej_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("OfficerSecret123!", 10),
      role: "officer",
      verificationStatus: "pending",
      isVerified: false,
    });

    const rejectionReason = "Invalid employee ID provided. Institutional verification failed.";

    // Reject the applicant
    const resReject = await fetch(`${baseUrl}/admin/authority-requests/${applicant._id}/reject`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: rejectionReason }),
    });

    assert.equal(resReject.status, 200);
    const dataReject = await resReject.json();
    assert.equal(dataReject.success, true);
    assert.equal(dataReject.data.verificationStatus, "rejected");
    assert.equal(dataReject.data.isVerified, false);
    assert.equal(dataReject.data.rejectionReason, rejectionReason);

    // Verify DB record
    const updatedApplicant = await UserModel.findById(applicant._id);
    assert.equal(updatedApplicant.verificationStatus, "rejected");
    assert.equal(updatedApplicant.isVerified, false);
    assert.equal(updatedApplicant.rejectionReason, rejectionReason);

    // Rejected authority cannot log in
    const resLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: applicant.email,
        password: "OfficerSecret123!",
      }),
    });

    assert.equal(resLogin.status, 403);
    const dataLogin = await resLogin.json();
    assert.equal(dataLogin.success, false);
    assert.match(dataLogin.message, /rejected by the administrator/i);
    assert.match(dataLogin.message, /Invalid employee ID provided/i);
  });

  // 9. Rejection invalidates any active sessions (stale tokens) via tokenVersion
  it("9. Rejection revokes active JWT sessions immediately by incrementing tokenVersion", async () => {
    const adminUser = await UserModel.create({
      username: `admin_revoker_${Date.now()}`,
      email: `admin_rev_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("AdminPass123!", 10),
      role: "admin",
      isVerified: true,
      tokenVersion: 0,
    });
    const adminToken = jwt.sign(
      { id: adminUser._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    // Create initially approved officer
    const officer = await UserModel.create({
      username: `active_officer_${Date.now()}`,
      email: `active_off_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("OfficerSecret123!", 10),
      role: "officer",
      verificationStatus: "approved",
      isVerified: true,
      tokenVersion: 0,
    });

    // Officer obtains valid session token
    const officerToken = jwt.sign(
      { id: officer._id, role: officer.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    // Officer profile request works
    const resBefore = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.equal(resBefore.status, 200);

    // Admin rejects the officer
    await fetch(`${baseUrl}/admin/authority-requests/${officer._id}/reject`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Revoked due to security audit" }),
    });

    // Old token is immediately rejected due to tokenVersion increment and isVerified: false
    const resAfter = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.ok(resAfter.status === 401 || resAfter.status === 403);
  });

  // 10. Admin can inspect single applicant details and filter by status
  it("10. Admin can filter requests by status ('pending', 'approved', 'rejected') and retrieve request by ID", async () => {
    const adminUser = await UserModel.create({
      username: `admin_filter_${Date.now()}`,
      email: `admin_filt_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("AdminPass123!", 10),
      role: "admin",
      isVerified: true,
      tokenVersion: 0,
    });
    const adminToken = jwt.sign(
      { id: adminUser._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const pendingApplicant = await UserModel.create({
      username: `filter_pend_${Date.now()}`,
      email: `filt_pend_${Date.now()}@authority-test.com`,
      password: await bcrypt.hash("Pass123!", 10),
      role: "officer",
      verificationStatus: "pending",
      isVerified: false,
      department: "Examination Cell",
      designation: "Head of Department",
    });

    // Filter pending
    const resPending = await fetch(`${baseUrl}/admin/authority-requests?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resPending.status, 200);
    const dataPending = await resPending.json();
    assert.ok(dataPending.data.some((r) => r.id.toString() === pendingApplicant._id.toString()));

    // Get single applicant by ID
    const resSingle = await fetch(`${baseUrl}/admin/authority-requests/${pendingApplicant._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resSingle.status, 200);
    const dataSingle = await resSingle.json();
    assert.equal(dataSingle.data.email, pendingApplicant.email);
    assert.equal(dataSingle.data.department, "Examination Cell");
    assert.equal(dataSingle.data.designation, "Head of Department");
  });
});
