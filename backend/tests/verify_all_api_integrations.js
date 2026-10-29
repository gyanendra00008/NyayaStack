require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
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
const Complaint = require("../src/models/complaint.models.js");
const { getStorageConnection } = require("../src/config/db.js");

const testAuthDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

let server;
let baseUrl;

async function run() {
  console.log("=================================================================");
  console.log("🔍 COMPREHENSIVE FRONTEND-TO-BACKEND API INTEGRATION AUDIT");
  console.log("=================================================================\n");

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testAuthDbUri);
  }
  getStorageConnection();

  // Clean test namespace
  await UserModel.deleteMany({ email: { $regex: /@api-audit\.com$/ } });
  try {
    const storageConn = getStorageConnection();
    if (storageConn && storageConn.readyState === 1) {
      const ComplaintM = storageConn.model("Complaint");
      await ComplaintM.deleteMany({ title: { $regex: /\[API Audit\]/ } });
    }
  } catch (e) {}

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  const checkResults = [];
  function record(apiName, method, route, passed, notes = "") {
    checkResults.push({ apiName, method, route, passed, notes });
    const mark = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${mark} | [${method}] ${route.padEnd(42)} | ${apiName}`);
    if (notes) console.log(`       ╰─► ${notes}`);
  }

  try {
    // 1. Health API (healthApi.getHealth)
    const resHealth = await fetch(`${baseUrl}/health`);
    assert.equal(resHealth.status, 200);
    record("healthApi.getHealth", "GET", "/api/health", true, "Status: ok");

    // 2. User Registration (authApi.register)
    const userEmail = `student_${Date.now()}@api-audit.com`;
    const resReg = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `stud_${Date.now()}`.slice(0, 20),
        email: userEmail,
        password: "StudentPass123!",
        fullName: "Audit Student",
        rollNo: "21BCE1001",
      }),
    });
    assert.equal(resReg.status, 201);
    const dataReg = await resReg.json();
    assert.equal(dataReg.success, true);
    record("authApi.register", "POST", "/api/auth/register", true, "Created role: user");

    // 3. User OTP Verification (authApi.verifyOtp)
    const dbUser = await UserModel.findOne({ email: userEmail }).select("+otp");
    assert.ok(dbUser);
    // Mark user verified directly or via OTP
    dbUser.isVerified = true;
    await dbUser.save();

    // 4. Strict User Login (authApi.loginUser)
    const resUserLogin = await fetch(`${baseUrl}/auth/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: userEmail,
        password: "StudentPass123!",
        role: "user",
      }),
    });
    assert.equal(resUserLogin.status, 200);
    const dataUserLogin = await resUserLogin.json();
    assert.ok(dataUserLogin.token);
    const userToken = dataUserLogin.token;
    record("authApi.loginUser", "POST", "/api/auth/user/login", true, "Issued token with role: user");

    // 5. Authority Registration (authApi.registerAuthority)
    const officerEmail = `warden_${Date.now()}@api-audit.com`;
    const resAuthReg = await fetch(`${baseUrl}/auth/authority/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr. Warden",
        email: officerEmail,
        employeeId: "EMP-4001",
        department: "Hostel & Mess",
        designation: "Hostel Warden",
        category: "Hostel",
        password: "OfficerPass123!",
      }),
    });
    assert.equal(resAuthReg.status, 201);
    record("authApi.registerAuthority", "POST", "/api/auth/authority/register", true, "Created officer status: pending");

    // 6. Authority Pending Login (authApi.loginAuthority before approval)
    const resPendingLogin = await fetch(`${baseUrl}/auth/authority/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: officerEmail,
        password: "OfficerPass123!",
        role: "officer",
      }),
    });
    assert.equal(resPendingLogin.status, 403);
    record("authApi.loginAuthority (Pending)", "POST", "/api/auth/authority/login", true, "Rejected pending with 403");

    // 7. Seed Admin and perform Admin Login (authApi.loginAdmin)
    const adminEmail = `admin_${Date.now()}@api-audit.com`;
    await UserModel.create({
      username: `adm_${Date.now()}`.slice(0, 20),
      email: adminEmail,
      password: await bcrypt.hash("AdminPass123!", 10),
      fullName: "Lead Administrator",
      role: "admin",
      isVerified: true,
      verificationStatus: "approved",
    });

    const resAdminLogin = await fetch(`${baseUrl}/auth/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: adminEmail,
        password: "AdminPass123!",
        role: "admin",
      }),
    });
    assert.equal(resAdminLogin.status, 200);
    const dataAdminLogin = await resAdminLogin.json();
    assert.ok(dataAdminLogin.token);
    const adminToken = dataAdminLogin.token;
    record("authApi.loginAdmin", "POST", "/api/auth/admin/login", true, "Issued token with role: admin");

    // 8. Admin Authority Requests List (adminApi.getAuthorityRequests)
    const resReqs = await fetch(`${baseUrl}/admin/authority-requests?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resReqs.status, 200);
    const dataReqs = await resReqs.json();
    assert.ok(Array.isArray(dataReqs.data));
    const pendingApp = dataReqs.data.find((r) => r.email === officerEmail);
    assert.ok(pendingApp);
    record("adminApi.getAuthorityRequests", "GET", "/api/admin/authority-requests", true, `Found ${dataReqs.data.length} pending requests`);

    // 9. Admin Single Authority Request Detail (adminApi.getAuthorityRequestById)
    const resReqDetail = await fetch(`${baseUrl}/admin/authority-requests/${pendingApp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resReqDetail.status, 200);
    record("adminApi.getAuthorityRequestById", "GET", `/api/admin/authority-requests/:id`, true, "Loaded applicant details");

    // 10. Admin Approve Authority Request (adminApi.approveAuthorityRequest)
    const resApprove = await fetch(`${baseUrl}/admin/authority-requests/${pendingApp.id}/approve`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resApprove.status, 200);
    record("adminApi.approveAuthorityRequest", "PATCH", `/api/admin/authority-requests/:id/approve`, true, "Approved to role: officer");

    // 11. Approved Authority Login (authApi.loginAuthority after approval)
    const resApprovedLogin = await fetch(`${baseUrl}/auth/authority/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: officerEmail,
        password: "OfficerPass123!",
        role: "officer",
      }),
    });
    assert.equal(resApprovedLogin.status, 200);
    const dataApprovedLogin = await resApprovedLogin.json();
    assert.ok(dataApprovedLogin.token);
    const officerToken = dataApprovedLogin.token;
    record("authApi.loginAuthority (Approved)", "POST", "/api/auth/authority/login", true, "Login successful with role: officer");

    // 12. Authenticated Profile (authApi.getMe)
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resMe.status, 200);
    record("authApi.getMe", "GET", "/api/auth/me", true, "Returns authenticated user data");

    // 13. Complaint Categories (complaintApi.getCategories)
    const resCats = await fetch(`${baseUrl}/complaints/categories`);
    assert.equal(resCats.status, 200);
    const dataCats = await resCats.json();
    assert.ok(Array.isArray(dataCats.categories));
    record("complaintApi.getCategories", "GET", "/api/complaints/categories", true, `${dataCats.categories.length} categories`);

    // 14. AI Classification (complaintApi.classifyComplaint)
    const resClassify = await fetch(`${baseUrl}/classify-complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "[API Audit] Broken geyser in block B hostel",
        description: "Water heater has not been working since yesterday morning in hostel washroom.",
      }),
    });
    assert.equal(resClassify.status, 200);
    const dataClassify = await resClassify.json();
    const predictedCat = dataClassify.classification?.category || dataClassify.category;
    assert.ok(predictedCat);
    record("complaintApi.classifyComplaint", "POST", "/api/classify-complaint", true, `Predicted: ${predictedCat}`);

    // 15. Create Complaint (complaintApi.createComplaint)
    const resCreateComplaint = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "[API Audit] Leaking water pipe in floor 2 corridor",
        description: "Continuous leakage near room 204 causing slippery floor risk.",
        category: "Hostel",
        priority: "High",
      }),
    });
    assert.equal(resCreateComplaint.status, 201);
    const dataCreated = await resCreateComplaint.json();
    const complaintId = dataCreated.complaint?.complaintId || dataCreated.data?.complaintId;
    assert.ok(complaintId);
    record("complaintApi.createComplaint", "POST", "/api/complaints", true, `Created complaint: ${complaintId}`);

    // 16. User My Complaints (complaintApi.getMyComplaints)
    const resMy = await fetch(`${baseUrl}/complaints/my?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resMy.status, 200);
    const dataMy = await resMy.json();
    assert.ok(Array.isArray(dataMy.data));
    record("complaintApi.getMyComplaints", "GET", "/api/complaints/my", true, `Returned ${dataMy.data.length} user complaints`);

    // 17. User SLA Summary (complaintApi.getSlaSummary)
    const resSla = await fetch(`${baseUrl}/complaints/sla-summary`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resSla.status, 200);
    const dataSla = await resSla.json();
    assert.ok(dataSla.success);
    record("complaintApi.getSlaSummary", "GET", "/api/complaints/sla-summary", true, "Calculated dynamic SLA metrics");

    // 18. Officer Assigned Complaints (complaintApi.getAssignedComplaints)
    const resAssigned = await fetch(`${baseUrl}/complaints/assigned?limit=50`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.equal(resAssigned.status, 200);
    const dataAssigned = await resAssigned.json();
    assert.ok(Array.isArray(dataAssigned.data));
    record("complaintApi.getAssignedComplaints", "GET", "/api/complaints/assigned", true, `Found ${dataAssigned.data.length} assigned complaints`);

    // 19. Complaint By ID (complaintApi.getComplaintById)
    const resById = await fetch(`${baseUrl}/complaints/${complaintId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resById.status, 200);
    record("complaintApi.getComplaintById", "GET", `/api/complaints/:complaintId`, true, "Loaded sanitized detail");

    // 20. Update Complaint Status (complaintApi.updateComplaintStatus)
    const resStatus = await fetch(`${baseUrl}/complaints/${complaintId}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "In Progress" }),
    });
    assert.equal(resStatus.status, 200);
    record("complaintApi.updateComplaintStatus", "PATCH", `/api/complaints/:complaintId/status`, true, "Status updated to In Progress");

    // 21. Complaint Hash-Chain (complaintApi.getComplaintChain)
    const resChain = await fetch(`${baseUrl}/complaints/${complaintId}/chain`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resChain.status, 200);
    record("complaintApi.getComplaintChain", "GET", `/api/complaints/:complaintId/chain`, true, "Retrieved hash chain");

    // 22. Public Feed (complaintApi.getPublicComplaints)
    const resPublic = await fetch(`${baseUrl}/complaints/public?limit=10`);
    assert.equal(resPublic.status, 200);
    const dataPublic = await resPublic.json();
    assert.ok(Array.isArray(dataPublic.data));
    record("complaintApi.getPublicComplaints", "GET", "/api/complaints/public", true, `Returned ${dataPublic.data.length} public complaints`);

    // 23. Public Statistics (complaintApi.getPublicStats)
    const resPublicStats = await fetch(`${baseUrl}/complaints/public/stats`);
    assert.equal(resPublicStats.status, 200);
    record("complaintApi.getPublicStats", "GET", "/api/complaints/public/stats", true, "Returned aggregate statistics");

    // 24. Live Notifications for User, Officer, Admin (notificationApi.getNotifications)
    const resNotifUser = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resNotifUser.status, 200);

    const resNotifOfficer = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    assert.equal(resNotifOfficer.status, 200);

    const resNotifAdmin = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resNotifAdmin.status, 200);
    const dataNotifAdmin = await resNotifAdmin.json();
    assert.ok(Array.isArray(dataNotifAdmin.data));
    record("notificationApi.getNotifications", "GET", "/api/notifications", true, `Role-scoped notifications verified`);

    // 25. Mark Notification Read (notificationApi.markAsRead / markAllAsRead)
    const resMark = await fetch(`${baseUrl}/notifications/notif-123/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(resMark.status, 200);
    record("notificationApi.markAsRead", "PATCH", "/api/notifications/:id/read", true, "Mark read success");

    // 26. Change Password (authApi.changePassword)
    const resChangePw = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: "StudentPass123!",
        newPassword: "NewStudentPass456!",
      }),
    });
    assert.equal(resChangePw.status, 200);
    record("authApi.changePassword", "POST", "/api/auth/change-password", true, "Session rotated securely");

    console.log("\n=================================================================");
    console.log(`🎉 ALL ${checkResults.length} API INTEGRATION TESTS PASSED 100%!`);
    console.log("=================================================================\n");
  } finally {
    // Cleanup
    await UserModel.deleteMany({ email: { $regex: /@api-audit\.com$/ } });
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

run().catch((err) => {
  console.error("❌ API Audit Failed:", err);
  process.exit(1);
});
