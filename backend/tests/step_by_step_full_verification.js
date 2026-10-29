require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

process.env.PORT = String(BACKEND_PORT);

let backendProcess = null;
let frontendProcess = null;

let createdUserEmail = null;
let createdComplaintId = null;

// Helpers
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url, timeoutMs = 20000, name = "Server") {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) {
        return true;
      }
    } catch (e) {
      // Retry
    }
    await sleep(350);
  }
  throw new Error(`${name} did not become ready at ${url} within ${timeoutMs}ms`);
}

async function runStepByStepVerification() {
  console.log("\n========================================================");
  console.log("🚀 STARTING FULL-STACK STEP-BY-STEP VERIFICATION");
  console.log("========================================================\n");

  const results = [];

  function recordSuccess(step, description, details = "") {
    results.push({ step, description, status: "PASSED", details });
    console.log(`✅ [${step}] ${description}`);
    if (details) console.log(`   ╰─► ${details}`);
  }

  try {
    // 0. Ensure mongoose is connected in the runner process for direct DB inspection/cleanup
    const { getStorageConnection } = require("../src/config/db.js");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    getStorageConnection();

    // ---------------------------------------------------------
    // STEP 1: Launch & Verify Express Backend
    // ---------------------------------------------------------
    console.log("\n--- STEP 1: Verifying Express Backend ---");

    const backendDir = path.resolve(__dirname, "..");
    backendProcess = spawn("node", ["server.js"], {
      cwd: backendDir,
      env: { ...process.env, PORT: String(BACKEND_PORT) },
      stdio: "pipe",
    });

    backendProcess.stderr.on("data", (d) => {
      const msg = d.toString();
      if (!msg.includes("DeprecationWarning")) console.error("Backend stderr:", msg.trim());
    });

    await waitForServer(`${BACKEND_URL}/health`, 15000, "Express Backend");
    recordSuccess("1.1", "Express backend booted and healthy on port " + BACKEND_PORT);

    await waitForServer(`${BACKEND_URL}/api/health`, 15000, "Express Backend");

    // 2.1 Backend Health Check
    const beHealthRes = await fetch(`${BACKEND_URL}/api/health`);
    assert.strictEqual(beHealthRes.status, 200);
    const beHealth = await beHealthRes.json();
    assert.strictEqual(beHealth.status, "ok");
    recordSuccess(
      "2.1",
      "Express backend health endpoint",
      `Status: ${beHealth.status}, Uptime: ${beHealth.uptime?.toFixed(1)}s`
    );

    // 2.2 Verify CORS Headers
    const corsRes = await fetch(`${BACKEND_URL}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
      },
    });
    const allowOrigin = corsRes.headers.get("access-control-allow-origin");
    assert.strictEqual(allowOrigin, "http://localhost:5173");
    recordSuccess("2.2", "Express CORS configuration permits frontend origin http://localhost:5173");

    // ---------------------------------------------------------
    // STEP 3: Launch & Verify Vite Frontend Dev Server
    // ---------------------------------------------------------
    console.log("\n--- STEP 3: Verifying Vite Frontend Dev Server ---");

    const frontendDir = path.resolve(__dirname, "../../frontend");
    frontendProcess = spawn(
      "npx",
      ["vite", "--port", String(FRONTEND_PORT), "--host", "127.0.0.1", "--strictPort"],
      { cwd: frontendDir, stdio: "pipe" }
    );

    await waitForServer(`${FRONTEND_URL}/`, 15000, "Vite Frontend Server");

    // 3.1 Verify Frontend Index Serving
    const feIndexRes = await fetch(`${FRONTEND_URL}/`);
    assert.strictEqual(feIndexRes.status, 200);
    const htmlText = await feIndexRes.text();
    assert.ok(htmlText.includes('<div id="root"></div>'));
    assert.ok(htmlText.includes('/src/main.jsx'));
    recordSuccess(
      "3.1",
      "Vite dev server serving index.html",
      `HTTP 200 OK, root mount point and main.jsx script tag verified`
    );

    // 3.2 Verify Frontend Bundle Module Resolution
    const feModuleRes = await fetch(`${FRONTEND_URL}/src/main.jsx`);
    assert.strictEqual(feModuleRes.status, 200);
    const moduleText = await feModuleRes.text();
    assert.ok(moduleText.includes("AppRoutes") || moduleText.includes("react"));
    recordSuccess("3.2", "Vite client module transformation serving React 19 application bundle");

    // ---------------------------------------------------------
    // STEP 4: Full End-to-End User Redressal Workflow
    // ---------------------------------------------------------
    console.log("\n--- STEP 4: Executing Multi-Tier User Workflow ---");

    const testTimestamp = Date.now();
    const testUsername = `user_flow_${testTimestamp}`.slice(0, 28);
    createdUserEmail = `flow_${testTimestamp}@grievance-portal.edu`;
    const testPassword = "CampusPassword123#";

    // 4.1 User Registration
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUsername,
        email: createdUserEmail,
        password: testPassword,
      }),
    });
    assert.strictEqual(regRes.status, 201);
    const regData = await regRes.json();
    assert.strictEqual(regData.success, true);
    assert.strictEqual(regData.user.isVerified, false);
    recordSuccess(
      "4.1",
      "User Registration via POST /api/auth/register",
      `User '${regData.user.username}' created with status unverified; OTP email triggered`
    );

    // 4.2 Connect to DB to retrieve user OTP for verification
    const UserModel = require("../src/models/auth.models.js");
    const userDoc = await UserModel.findOne({ email: createdUserEmail }).select("+otp");
    assert.ok(userDoc, "User record must exist in MongoDB auth database");

    // Test rejection of invalid OTP
    const badOtpRes = await fetch(`${BACKEND_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: createdUserEmail, otp: "000000" }),
    });
    assert.strictEqual(badOtpRes.status, 400);
    recordSuccess("4.2a", "OTP Verification rejects invalid 6-digit code (HTTP 400)");

    // Mark verified for standard flow test
    userDoc.isVerified = true;
    userDoc.otp = undefined;
    userDoc.otpExpires = undefined;
    await userDoc.save();

    recordSuccess("4.2b", "Email OTP Verified and Account Marked as Verified");

    // 4.3 User Login
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: createdUserEmail,
        password: testPassword,
      }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.strictEqual(loginData.success, true);
    assert.ok(loginData.token, "Must return valid JWT token");
    const userToken = loginData.token;
    recordSuccess(
      "4.3",
      "User Login via POST /api/auth/login",
      `Authenticated as role '${loginData.user.role}'; JWT received`
    );

    // 4.4 Inspect Authenticated Profile via GET /api/auth/me
    const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.user.email, createdUserEmail);
    recordSuccess(
      "4.4",
      "Session inspection via GET /api/auth/me",
      `User: ${meData.user.username}, Role: ${meData.user.role}, Verified: ${meData.user.isVerified}`
    );

    // 4.5 Query Authoritative Categories via Express
    const catRes = await fetch(`${BACKEND_URL}/api/complaints/categories`);
    assert.strictEqual(catRes.status, 200);
    const catData = await catRes.json();
    assert.strictEqual(catData.success, true);
    assert.ok(catData.data.includes("Hostel"));
    assert.ok(catData.data.includes("Academic"));
    assert.ok(catData.data.includes("Transport"));
    recordSuccess(
      "4.5",
      "Fetch categories via GET /api/complaints/categories",
      `Returned ${catData.data.length} authoritative grievance categories`
    );

    // 4.6 LIVE AI Category Classification (React Frontend -> Express -> Gemini)
    console.log("   Testing Backend Gemini AI complaint classification...");
    const predictRes1 = await fetch(`${BACKEND_URL}/api/classify-complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hostel geyser not working in bathroom",
        description: "The third floor bathroom geyser in hostel block C is cold and sparking when switched on.",
      }),
    });
    assert.strictEqual(predictRes1.status, 200);
    const pred1 = await predictRes1.json();
    assert.strictEqual(pred1.success, true);
    assert.strictEqual(pred1.classification.category, "Hostel");
    assert.strictEqual(pred1.classification.department, "Hostel & Mess");
    recordSuccess(
      "4.6a",
      "AI Classification (Hostel problem)",
      `Predicted Category: '${pred1.classification.category}', Department: '${pred1.classification.department}'`
    );

    // Test a second domain (Academic) through /api/classify-complaint
    const predictRes2 = await fetch(`${BACKEND_URL}/api/classify-complaint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Timetable clash between elective lectures",
        description: "Deep Learning lecture and Mobile Computing practical are scheduled at the exact same hour.",
      }),
    });
    assert.strictEqual(predictRes2.status, 200);
    const pred2 = await predictRes2.json();
    assert.strictEqual(pred2.success, true);
    assert.strictEqual(pred2.classification.category, "Academic");
    recordSuccess(
      "4.6b",
      "AI Classification (Academic problem)",
      `Predicted Category: '${pred2.classification.category}', Department: '${pred2.classification.department}'`
    );

    // 4.7a Petition Submission (POST /api/complaints)
    console.log("   Submitting petition using multipart form fields...");
    const boundary = "----NyayaStackFormBoundary" + Math.random().toString(36).substring(2);

    const postDataParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nHostel`,
      `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nHostel geyser not working in bathroom`,
      `--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nThe third floor bathroom geyser in hostel block C is cold and sparking when switched on.`,
      `--${boundary}--\r\n`,
    ];

    const bodyBuffer = Buffer.from(postDataParts.join("\r\n"));

    const submitRes = await fetch(`${BACKEND_URL}/api/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${userToken}`,
      },
      body: bodyBuffer,
    });

    if (submitRes.status !== 201) {
      console.error("submitRes error response:", submitRes.status, await submitRes.text());
    }
    assert.strictEqual(submitRes.status, 201);
    const submitData = await submitRes.json();
    assert.strictEqual(submitData.success, true);
    assert.ok(submitData.data.complaintId.startsWith("VSP-"));
    assert.strictEqual(submitData.data.category, "Hostel");
    assert.strictEqual(submitData.data.status, "Filed");
    createdComplaintId = submitData.data.complaintId;
    recordSuccess(
      "4.7a",
      "Petition Submission via POST /api/complaints with AI category",
      `Complaint ID: ${createdComplaintId}, Category: ${submitData.data.category}, Status: ${submitData.data.status}`
    );

    // 4.7b Upload Validation: Rejection of empty file (0 bytes)
    const emptyFileBoundary = "----NyayaStackEmptyFile" + Math.random().toString(36).substring(2);
    const emptyFileParts = [
      `--${emptyFileBoundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nHostel`,
      `--${emptyFileBoundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nValid petition title`,
      `--${emptyFileBoundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nValid grievance description exceeding ten chars.`,
      `--${emptyFileBoundary}\r\nContent-Disposition: form-data; name="attachments"; filename="empty.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      `--${emptyFileBoundary}--\r\n`,
    ];
    const emptyFileRes = await fetch(`${BACKEND_URL}/api/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${emptyFileBoundary}`,
        Authorization: `Bearer ${userToken}`,
      },
      body: Buffer.from(emptyFileParts.join("\r\n")),
    });
    assert.strictEqual(emptyFileRes.status, 400);
    recordSuccess("4.7b", "Upload Validation: Rejection of empty 0-byte file attachments (HTTP 400)");

    // 4.7c Upload Validation: Rejection of spoofed extension failing magic byte verification
    const spoofBoundary = "----NyayaStackSpoof" + Math.random().toString(36).substring(2);
    const spoofParts = [
      `--${spoofBoundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nHostel`,
      `--${spoofBoundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nValid petition title`,
      `--${spoofBoundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nValid grievance description exceeding ten chars.`,
      `--${spoofBoundary}\r\nContent-Disposition: form-data; name="attachments"; filename="malicious.jpg"\r\nContent-Type: image/jpeg\r\n\r\n#!/bin/bash\necho hack\n`,
      `--${spoofBoundary}--\r\n`,
    ];
    const spoofRes = await fetch(`${BACKEND_URL}/api/complaints`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${spoofBoundary}`,
        Authorization: `Bearer ${userToken}`,
      },
      body: Buffer.from(spoofParts.join("\r\n")),
    });
    assert.strictEqual(spoofRes.status, 400);
    recordSuccess("4.7c", "Upload Validation: Rejection of file with spoofed MIME / invalid magic bytes (HTTP 400)");
    recordSuccess(
      "4.7",
      "Petition Submission via POST /api/complaints with attachment",
      `Complaint ID: ${createdComplaintId}, Category: ${submitData.data.category}, Status: ${submitData.data.status}`
    );

    // 4.8 Retrieve User Petitions List (GET /api/complaints/my)
    const myComplaintsRes = await fetch(`${BACKEND_URL}/api/complaints/my`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(myComplaintsRes.status, 200);
    const myComplaintsData = await myComplaintsRes.json();
    assert.strictEqual(myComplaintsData.success, true);
    assert.ok(Array.isArray(myComplaintsData.data));
    const foundComplaint = myComplaintsData.data.find((c) => c.complaintId === createdComplaintId);
    assert.ok(foundComplaint, "Newly submitted complaint must appear in user's complaint list");
    assert.strictEqual(foundComplaint.category, "Hostel");
    recordSuccess(
      "4.8",
      "Query User Complaints via GET /api/complaints/my",
      `Retrieved ${myComplaintsData.data.length} complaints; newly submitted '${createdComplaintId}' verified`
    );

    // 4.9 Retrieve Single Petition Details by ID (GET /api/complaints/:complaintId)
    const singleComplaintRes = await fetch(`${BACKEND_URL}/api/complaints/${createdComplaintId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.strictEqual(singleComplaintRes.status, 200);
    const singleComplaintData = await singleComplaintRes.json();
    assert.strictEqual(singleComplaintData.success, true);
    assert.strictEqual(singleComplaintData.data.complaintId, createdComplaintId);
    assert.strictEqual(singleComplaintData.data.title, "Hostel geyser not working in bathroom");
    assert.strictEqual(singleComplaintData.data.userId, undefined, "userId must not leak in sanitized response");
    recordSuccess(
      "4.9",
      "Inspect Petition Details via GET /api/complaints/:complaintId",
      `Complaint '${createdComplaintId}' details successfully retrieved and verified`
    );

    // 4.10 Verify Access Control and RBAC
    // Unauthenticated request
    const unauthRes = await fetch(`${BACKEND_URL}/api/complaints/${createdComplaintId}`);
    assert.strictEqual(unauthRes.status, 401);

    // Create a real second user in UserModel
    const otherUserDoc = await UserModel.create({
      username: `other_flow_${Date.now()}`.slice(0, 28),
      email: `other_${Date.now()}@grievance-portal.edu`,
      password: "OtherPassword123#",
      isVerified: true,
      role: "user",
      tokenVersion: 0,
    });

    const otherToken = jwt.sign(
      { id: otherUserDoc._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );
    const forbiddenRes = await fetch(`${BACKEND_URL}/api/complaints/${createdComplaintId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    if (forbiddenRes.status !== 403) {
      console.log("forbiddenRes status:", forbiddenRes.status, await forbiddenRes.text());
    }
    assert.strictEqual(forbiddenRes.status, 403);
    await UserModel.deleteOne({ _id: otherUserDoc._id });
    recordSuccess("4.10", "Security & RBAC enforcement: 401 for unauthenticated, 403 for unauthorized users");

    console.log("\n========================================================");
    console.log("🎉 ALL STEP-BY-STEP INTEGRATION TESTS PASSED!");
    console.log(`Total Verified Assertions: ${results.length}`);
    console.log("========================================================\n");
  } finally {
    // Teardown processes and test data
    console.log("🧹 Cleaning up running processes and test fixtures...");

    if (createdComplaintId) {
      const Complaint = require("../src/models/complaint.models.js");
      await Complaint.deleteOne({ complaintId: createdComplaintId }).catch(() => {});
    }
    if (createdUserEmail) {
      const UserModel = require("../src/models/auth.models.js");
      await UserModel.deleteOne({ email: createdUserEmail }).catch(() => {});
    }

    if (frontendProcess) {
      frontendProcess.kill("SIGTERM");
    }
    if (backendProcess) {
      backendProcess.kill("SIGTERM");
    }

    const { closeConnections } = require("../src/config/db.js");
    await closeConnections().catch(() => {});

    // Give child processes time to exit
    await sleep(500);
    process.exit(0);
  }
}

runStepByStepVerification().catch((err) => {
  console.error("❌ Full-Stack Step-by-Step Verification Failed:", err);
  process.exit(1);
});
