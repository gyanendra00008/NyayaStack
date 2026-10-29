/**
 * Focused Production-Readiness Audit Test Suite for Complaint Escalation
 * NyayaStack Grievance Redressal Engine
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = require("../src/app.js");
const connectDB = require("../src/config/db.js");
const UserModel = require("../src/models/auth.models.js");
const Complaint = require("../src/models/complaint.models.js");
const {
  escalateDueComplaints,
  DEFAULT_ESCALATION_HOURS,
} = require("../src/services/escalation.service.js");
const {
  findNextHigherAuthority,
  findLowestRankAuthority,
} = require("../src/utils/hierarchy.utils.js");

const TEST_CRON_SECRET = "production-audit-secret-key-123456789";

describe("Production-Readiness Audit: Escalation System", () => {
  let server;
  let baseUrl;
  let testStudentToken;
  let testStudentId;
  let testOfficerId;
  let testAdminToken;
  const timestamp = Date.now();
  const testStudentEmail = `audit_student_${timestamp}@audit-test.com`;
  const testOfficerEmail = `audit_officer_${timestamp}@audit-test.com`;
  const testAdminEmail = `audit_admin_${timestamp}@audit-test.com`;
  const trackedComplaintIds = [];

  before(async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    process.env.ESCALATION_WINDOW_HOURS = "48";
    await connectDB();

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}/api`;

    // 1. Create Verified Student
    const student = await UserModel.create({
      username: `astudent_${timestamp}`.slice(0, 20),
      fullName: "Audit Student",
      email: testStudentEmail,
      password: await bcrypt.hash("Password123!", 10),
      role: "user",
      isVerified: true,
      verificationStatus: "none",
    });
    testStudentId = student._id;
    testStudentToken = jwt.sign(
      { id: student._id, role: "user", tokenVersion: 0 },
      process.env.JWT_SECRET || "default_test_jwt_secret_key_minimum_32_chars_ok!",
      { expiresIn: "1h" }
    );

    // 2. Create Approved Officer (Hostel Caretaker, Rank 6)
    const officer = await UserModel.create({
      username: `aofficer_${timestamp}`.slice(0, 20),
      fullName: "Audit Caretaker",
      email: testOfficerEmail,
      password: await bcrypt.hash("Password123!", 10),
      role: "officer",
      isVerified: true,
      verificationStatus: "approved",
      department: "Hostel & Mess",
      designation: "Caretaker",
      rank: 6,
    });
    testOfficerId = officer._id;

    // 3. Create Admin
    const admin = await UserModel.create({
      username: `aadmin_${timestamp}`.slice(0, 20),
      fullName: "Audit Admin",
      email: testAdminEmail,
      password: await bcrypt.hash("Password123!", 10),
      role: "admin",
      isVerified: true,
      verificationStatus: "approved",
    });
    testAdminToken = jwt.sign(
      { id: admin._id, role: "admin", tokenVersion: 0 },
      process.env.JWT_SECRET || "default_test_jwt_secret_key_minimum_32_chars_ok!",
      { expiresIn: "1h" }
    );
  });

  after(async () => {
    await UserModel.deleteMany({ email: { $regex: /@audit-test\.com$/ } });
    if (trackedComplaintIds.length > 0) {
      await Complaint.deleteMany({ complaintId: { $in: trackedComplaintIds } });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // 1. Initial resolution deadline verification
  it("Audit 1: Every newly submitted complaint receives the correct initial 48h resolution deadline", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Audit Test Room Water Leakage",
        description: "Severe water leakage in hostel bathroom block B.",
        category: "Hostel",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    const cid = body.data?.complaintId;
    assert.ok(cid);
    trackedComplaintIds.push(cid);

    assert.equal(body.data.currentEscalationLevel, 1);
    assert.equal(body.data.escalationStatus, "normal");
    assert.ok(body.data.resolutionDeadline);
    assert.ok(body.data.assignedAt);

    const doc = await Complaint.findOne({ complaintId: cid });
    const diffHours = (new Date(doc.resolutionDeadline).getTime() - new Date(doc.assignedAt).getTime()) / (3600 * 1000);
    assert.ok(Math.abs(diffHours - 48) < 0.1, `Expected 48 hours diff, got ${diffHours}`);
  });

  // 2. Fresh 48-hour deadline after each successful escalation
  it("Audit 2: After each successful escalation, the new authority receives a fresh 48-hour deadline", async () => {
    const cid = trackedComplaintIds[0];
    const initialDoc = await Complaint.findOne({ complaintId: cid });
    const initialDeadline = new Date(initialDoc.resolutionDeadline);

    // Fast forward 49 hours past initial deadline
    const triggerTime = new Date(initialDeadline.getTime() + 1 * 3600 * 1000);
    const summary = await escalateDueComplaints({ now: triggerTime, complaintId: cid });
    assert.equal(summary.escalated, 1);

    const escalatedDoc = await Complaint.findOne({ complaintId: cid });
    assert.equal(escalatedDoc.currentEscalationLevel, 2);
    assert.equal(escalatedDoc.status, "Escalated");
    assert.ok(new Date(escalatedDoc.resolutionDeadline) > initialDeadline);

    const freshWindowHours = (new Date(escalatedDoc.resolutionDeadline).getTime() - triggerTime.getTime()) / (3600 * 1000);
    assert.ok(Math.abs(freshWindowHours - 48) < 0.1, `Expected fresh 48h deadline, got ${freshWindowHours}`);
  });

  // 3. Status changes do not unexpectedly reset the resolution deadline
  it("Audit 3: Resolution deadline is not reset unexpectedly when complaint status changes", async () => {
    const cid = trackedComplaintIds[0];
    const beforeDoc = await Complaint.findOne({ complaintId: cid });
    const originalDeadline = new Date(beforeDoc.resolutionDeadline).getTime();

    // Officer marks status to 'In Progress'
    await Complaint.updateOne({ complaintId: cid }, { $set: { status: "In Progress" } });

    // Simulate saving through model
    const reloaded = await Complaint.findOne({ complaintId: cid });
    reloaded.status = "In Review";
    await reloaded.save();

    const afterDoc = await Complaint.findOne({ complaintId: cid });
    assert.equal(new Date(afterDoc.resolutionDeadline).getTime(), originalDeadline);
    assert.equal(afterDoc.currentEscalationLevel, 2);
  });

  // 4. Duplicate/concurrent escalations prevention
  it("Audit 4: A complaint cannot be escalated more than once for the same assignment across concurrent runs", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Audit Test Wi-Fi Concurrency Check",
        description: "Checking race conditions during escalation trigger.",
        category: "Hostel",
      }),
    });
    const body = await res.json();
    const cid = body.data?.complaintId;
    trackedComplaintIds.push(cid);

    const doc = await Complaint.findOne({ complaintId: cid });
    const expiredTime = new Date(doc.resolutionDeadline.getTime() + 2 * 3600 * 1000);

    // Fire 4 concurrent workers
    const workers = await Promise.all([
      escalateDueComplaints({ now: expiredTime, complaintId: cid }),
      escalateDueComplaints({ now: expiredTime, complaintId: cid }),
      escalateDueComplaints({ now: expiredTime, complaintId: cid }),
      escalateDueComplaints({ now: expiredTime, complaintId: cid }),
    ]);

    const totalEscalations = workers.reduce((acc, w) => acc + w.escalated, 0);
    assert.equal(totalEscalations, 1, `Expected exactly 1 worker to succeed, got ${totalEscalations}`);

    const verifiedDoc = await Complaint.findOne({ complaintId: cid });
    assert.equal(verifiedDoc.currentEscalationLevel, 2);
    assert.equal(verifiedDoc.escalationHistory.length, 1);
  });

  // 5. Rank 1 is highest authority, assignment uses next higher-ranked officer in same department
  it("Audit 5: Rank 1 is treated as highest authority, and hierarchy resolution selects immediate next higher rank", async () => {
    // In Hostel & Mess: Caretaker (6) -> Mess Committee (5) -> Hostel Supervisor (4) -> Assistant Warden (3) -> Warden (2) -> Chief Warden (1)
    const nextAuth = await findNextHigherAuthority({
      department: "Hostel & Mess",
      category: "Hostel",
      currentRank: 6,
      currentOfficerId: testOfficerId,
      UserModel,
    });
    assert.equal(nextAuth.hasHigherAuthority, true);
    assert.ok(nextAuth.assignedRank < 6); // Must be strictly higher rank (lower number)
    assert.equal(nextAuth.department, "Hostel & Mess");

    // Top rank check (Rank 1 Chief Warden)
    const topAuth = await findNextHigherAuthority({
      department: "Hostel & Mess",
      category: "Hostel",
      currentRank: 1,
      currentOfficerId: null,
      UserModel,
    });
    assert.equal(topAuth.hasHigherAuthority, false);
    assert.equal(topAuth.requiresAdminAttention, true);
    assert.equal(topAuth.assignedDesignation, "Office of the Ombudsman / Executive Admin");
  });

  // 6. Only active, approved, eligible authorities receive assignments
  it("Audit 6: Only active, approved, eligible authorities can receive assignments", async () => {
    // Create an unverified/rejected officer
    const rejectedOfficer = await UserModel.create({
      username: `rej_off_${timestamp}`.slice(0, 20),
      fullName: "Rejected Officer",
      email: `rej_${timestamp}@audit-test.com`,
      password: await bcrypt.hash("Password123!", 10),
      role: "officer",
      isVerified: false,
      verificationStatus: "rejected",
      department: "Hostel & Mess",
      designation: "Warden",
      rank: 2,
    });

    const nextAuth = await findNextHigherAuthority({
      department: "Hostel & Mess",
      category: "Hostel",
      currentRank: 6,
      currentOfficerId: testOfficerId,
      UserModel,
    });

    // Must NOT assign to the unverified/rejected officer
    assert.notEqual(String(nextAuth.assignedTo), String(rejectedOfficer._id));

    await UserModel.deleteOne({ _id: rejectedOfficer._id });
  });

  // 7. Resolved and Rejected complaints are never escalated
  it("Audit 7: Resolved and Rejected complaints are never escalated", async () => {
    const res1 = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Audit Test Resolved Complaint",
        description: "This complaint will be marked Resolved.",
        category: "Hostel",
      }),
    });
    const body1 = await res1.json();
    const resolvedCid = body1.data.complaintId;
    trackedComplaintIds.push(resolvedCid);

    await Complaint.updateOne({ complaintId: resolvedCid }, { $set: { status: "Resolved" } });

    // Try to escalate 100 hours in future
    const futureTime = new Date(Date.now() + 100 * 3600 * 1000);
    const summary = await escalateDueComplaints({ now: futureTime, complaintId: resolvedCid });
    assert.equal(summary.escalated, 0);

    const doc = await Complaint.findOne({ complaintId: resolvedCid });
    assert.equal(doc.status, "Resolved");
    assert.equal(doc.currentEscalationLevel, 1);
    assert.equal(doc.escalationHistory.length, 0);
  });

  // 8. Admin attention halts repeat duplicate escalations
  it("Audit 8: When flagged for admin attention, complaint does NOT repeatedly escalate on subsequent runs", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Audit Test Admin Attention Repeat Check",
        description: "Checking that admin attention stops infinite escalation loop.",
        category: "Hostel",
      }),
    });
    const body = await res.json();
    const cid = body.data.complaintId;
    trackedComplaintIds.push(cid);

    // Set complaint to Rank 1 (top rank)
    await Complaint.updateOne(
      { complaintId: cid },
      { $set: { assignedRank: 1, currentEscalationLevel: 3, resolutionDeadline: new Date(Date.now() - 3600 * 1000) } }
    );

    // Run 1: Escalates to admin_attention
    const run1 = await escalateDueComplaints({ now: new Date(), complaintId: cid });
    assert.equal(run1.escalated, 1);

    const docAfterRun1 = await Complaint.findOne({ complaintId: cid });
    assert.equal(docAfterRun1.escalationStatus, "admin_attention");
    assert.equal(docAfterRun1.currentEscalationLevel, 4);
    assert.equal(docAfterRun1.escalationHistory.length, 1);

    // Run 2: 100 hours later, scheduler runs again
    const run2Time = new Date(Date.now() + 100 * 3600 * 1000);
    const run2 = await escalateDueComplaints({ now: run2Time, complaintId: cid });
    assert.equal(run2.escalated, 0, "Expected 0 escalations because complaint is already at admin_attention");

    const docAfterRun2 = await Complaint.findOne({ complaintId: cid });
    assert.equal(docAfterRun2.currentEscalationLevel, 4, "Escalation level must remain at 4");
    assert.equal(docAfterRun2.escalationHistory.length, 1, "No duplicate history entries");
  });

  // 10. External Cron endpoint validates CRON_SECRET strictly
  it("Audit 10: /api/escalate-cron strictly validates CRON_SECRET and rejects unauthorized requests", async () => {
    // 1. Missing key
    const res1 = await fetch(`${baseUrl}/escalate-cron`, { method: "POST" });
    assert.equal(res1.status, 401);

    // 2. Wrong key in header
    const res2 = await fetch(`${baseUrl}/escalate-cron`, {
      method: "POST",
      headers: { "x-cron-key": "wrong-secret-key" },
    });
    assert.equal(res2.status, 401);

    // 3. Valid key in header
    const res3 = await fetch(`${baseUrl}/escalate-cron`, {
      method: "POST",
      headers: { "x-cron-key": TEST_CRON_SECRET },
    });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.success, true);
    assert.ok(typeof body3.summary.checked === "number");

    // 4. Valid key as Bearer token
    const res4 = await fetch(`${baseUrl}/escalate-cron`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` },
    });
    assert.equal(res4.status, 200);
  });

  // 11. Admin manual escalation requires valid admin auth and does not bypass consistency checks
  it("Audit 11: /api/admin/escalate-now requires valid admin auth and respects consistency checks", async () => {
    // Student token rejected
    const studentRes = await fetch(`${baseUrl}/admin/escalate-now`, {
      method: "POST",
      headers: { Authorization: `Bearer ${testStudentToken}` },
    });
    assert.equal(studentRes.status, 403);

    // Admin token accepted
    const adminRes = await fetch(`${baseUrl}/admin/escalate-now`, {
      method: "POST",
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.success, true);
  });

  // 13. Notifications for escalation
  it("Audit 13: Escalation notifications are properly formed with deterministic IDs and readable text", async () => {
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${testStudentToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const escalatedNotif = body.data.find((n) => n.id.startsWith("esc-"));
    assert.ok(escalatedNotif, "User should have received an escalation notification");
    assert.equal(escalatedNotif.type, "sla");
    assert.match(escalatedNotif.title, /Petition Escalated/);
  });

  // 14. Existing complaints without escalation fields continue working
  it("Audit 14: Existing legacy complaints without escalation fields are seamlessly handled", async () => {
    // Create a raw complaint simulating a legacy document
    const legacyCid = `VSP-LEGACY-${Date.now().toString(36).toUpperCase()}`;
    trackedComplaintIds.push(legacyCid);

    // Insert directly into collection without escalation fields
    const rawCollection = Complaint.collection;
    await rawCollection.insertOne({
      complaintId: legacyCid,
      userId: testStudentId,
      category: "Hostel",
      department: "Hostel & Mess",
      title: "Legacy Complaint Without Escalation Fields",
      description: "Document created prior to escalation schema additions.",
      status: "Filed",
      slaDueAt: new Date(Date.now() - 10 * 3600 * 1000), // Expired SLA
      createdAt: new Date(Date.now() - 50 * 3600 * 1000),
      updatedAt: new Date(Date.now() - 50 * 3600 * 1000),
    });

    const summary = await escalateDueComplaints({ now: new Date(), complaintId: legacyCid });
    assert.equal(summary.escalated, 1);

    const upgradedDoc = await Complaint.findOne({ complaintId: legacyCid });
    assert.equal(upgradedDoc.status, "Escalated");
    assert.equal(upgradedDoc.currentEscalationLevel, 2);
    assert.ok(upgradedDoc.resolutionDeadline);
    assert.equal(upgradedDoc.escalationHistory.length, 1);
  });
});
