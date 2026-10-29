const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const app = require("../src/app");
const UserModel = require("../src/models/auth.models");
const Complaint = require("../src/models/complaint.models");
const {
  escalateDueComplaints,
  DEFAULT_ESCALATION_HOURS,
} = require("../src/services/escalation.service");

let server;
let baseUrl;

const testDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

const timestamp = Date.now();
const studentEmail = `student_${timestamp}@escalation-test.com`;
const juniorOfficerEmail = `caretaker_${timestamp}@escalation-test.com`;
const seniorOfficerEmail = `warden_${timestamp}@escalation-test.com`;
const chiefOfficerEmail = `chiefwarden_${timestamp}@escalation-test.com`;
const password = "ValidPass123!";

let studentToken;
let studentId;
let juniorOfficerId;
let seniorOfficerId;
let chiefOfficerId;

let complaint1Id;
let complaint2Id;
let complaint3Id;

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testDbUri);
  }
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;

  // 1. Create verified Student
  const student = await UserModel.create({
    username: `stud_${timestamp}`.slice(0, 20),
    fullName: "Escalation Student",
    email: studentEmail,
    password: await bcrypt.hash(password, 10),
    role: "user",
    isVerified: true,
    verificationStatus: "approved",
    department: "Computer Science",
  });
  studentId = student._id;

  // Login student
  const loginRes = await fetch(`${baseUrl}/auth/user/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: studentEmail, password }),
  });
  const loginData = await loginRes.json();
  studentToken = loginData.token;

  // 2. Create Junior Officer (Caretaker, Rank 6 in Hostel & Mess)
  const junior = await UserModel.create({
    username: `jr_${timestamp}`.slice(0, 20),
    fullName: "Hostel Caretaker",
    email: juniorOfficerEmail,
    password: await bcrypt.hash(password, 10),
    role: "officer",
    isVerified: true,
    verificationStatus: "approved",
    department: "Hostel & Mess",
    designation: "Caretaker",
    rank: 6,
  });
  juniorOfficerId = junior._id;

  // 3. Create Senior Officer (Warden, Rank 2 in Hostel & Mess)
  const senior = await UserModel.create({
    username: `sr_${timestamp}`.slice(0, 20),
    fullName: "Hostel Warden",
    email: seniorOfficerEmail,
    password: await bcrypt.hash(password, 10),
    role: "officer",
    isVerified: true,
    verificationStatus: "approved",
    department: "Hostel & Mess",
    designation: "Warden",
    rank: 2,
  });
  seniorOfficerId = senior._id;

  // 4. Create Chief Officer (Chief Warden, Rank 1 in Hostel & Mess)
  const chief = await UserModel.create({
    username: `cw_${timestamp}`.slice(0, 20),
    fullName: "Chief Warden",
    email: chiefOfficerEmail,
    password: await bcrypt.hash(password, 10),
    role: "officer",
    isVerified: true,
    verificationStatus: "approved",
    department: "Hostel & Mess",
    designation: "Chief Warden",
    rank: 1,
  });
  chiefOfficerId = chief._id;
});

after(async () => {
  await UserModel.deleteMany({ email: { $regex: /@escalation-test\.com$/ } });
  if (complaint1Id || complaint2Id || complaint3Id) {
    await Complaint.deleteMany({
      complaintId: { $in: [complaint1Id, complaint2Id, complaint3Id].filter(Boolean) },
    });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

describe("Automatic Time-Based Hierarchical Escalation Test Suite", () => {
  it("1. Complaint is assigned through the existing workflow with 48h resolution deadline", async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Broken geyser in Block C hostel washroom",
        description: "Water geyser has completely stopped working since yesterday morning.",
        category: "Hostel",
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    complaint1Id = body.complaint?.complaintId || body.data?.complaintId;
    assert.ok(complaint1Id);

    const doc = await Complaint.findOne({ complaintId: complaint1Id }).lean();
    assert.ok(doc);
    assert.equal(doc.currentEscalationLevel, 1);
    assert.equal(doc.status, "Filed");
    assert.equal(doc.department, "Hostel & Mess");
    assert.equal(doc.assignedRank, 6); // Caretaker is lowest rank (6)
    assert.equal(String(doc.assignedTo), String(juniorOfficerId));
    assert.ok(doc.assignedAt);
    assert.ok(doc.resolutionDeadline);
    assert.equal(Array.isArray(doc.escalationHistory), true);
    assert.equal(doc.escalationHistory.length, 0);

    // Verify 48-hour default deadline
    const diffHours =
      (new Date(doc.resolutionDeadline).getTime() - new Date(doc.assignedAt).getTime()) /
      (60 * 60 * 1000);
    assert.ok(Math.abs(diffHours - DEFAULT_ESCALATION_HOURS) < 0.1);
  });

  it("2. Complaint is NOT escalated before its deadline has elapsed", async () => {
    const doc = await Complaint.findOne({ complaintId: complaint1Id });
    // Check at 24 hours after assignment (halfway before deadline)
    const mockTime24h = new Date(doc.assignedAt.getTime() + 24 * 60 * 60 * 1000);

    const summary = await escalateDueComplaints({ now: mockTime24h });
    assert.equal(summary.escalated, 0);

    const unchanged = await Complaint.findOne({ complaintId: complaint1Id });
    assert.equal(unchanged.currentEscalationLevel, 1);
    assert.equal(unchanged.status, "Filed");
    assert.equal(unchanged.escalationHistory.length, 0);
  });

  it("3. Complaint IS automatically escalated after its 48h deadline expires", async () => {
    const doc = await Complaint.findOne({ complaintId: complaint1Id });
    // 49 hours after assignment (1 hour after deadline expired)
    const mockTime49h = new Date(doc.assignedAt.getTime() + 49 * 60 * 60 * 1000);

    const summary = await escalateDueComplaints({ now: mockTime49h });
    assert.ok(summary.escalated >= 1);

    const escalated = await Complaint.findOne({ complaintId: complaint1Id });
    assert.equal(escalated.currentEscalationLevel, 2);
    assert.equal(escalated.status, "Escalated");
    assert.equal(escalated.escalationStatus, "escalated");
    // Next higher authority above Caretaker (rank 6) in Hostel & Mess is Warden (rank 2)
    assert.equal(String(escalated.assignedTo), String(seniorOfficerId));
    assert.equal(escalated.assignedRank, 2);
    assert.equal(escalated.escalationHistory.length, 1);

    const entry = escalated.escalationHistory[0];
    assert.equal(entry.previousLevel, 1);
    assert.equal(entry.newLevel, 2);
    assert.equal(String(entry.previousAssignedTo), String(juniorOfficerId));
    assert.equal(String(entry.newAssignedTo), String(seniorOfficerId));
    assert.match(entry.reason, /48h elapsed/);
  });

  it("4. Complaint is NOT escalated if already marked as Resolved", async () => {
    // Create complaint 2 and immediately resolve it
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Mess food quality feedback and resolved issue",
        description: "Resolved issue regarding mess salt container hygiene.",
        category: "Mess",
      }),
    });
    const body = await res.json();
    complaint2Id = body.complaint?.complaintId || body.data?.complaintId;
    assert.ok(complaint2Id);

    // Resolve complaint in database
    await Complaint.updateOne({ complaintId: complaint2Id }, { $set: { status: "Resolved" } });

    // Try to escalate 100 hours later (scoped to complaint2Id)
    const futureTime = new Date(Date.now() + 100 * 60 * 60 * 1000);
    const summary = await escalateDueComplaints({ now: futureTime, complaintId: complaint2Id });

    const resolvedDoc = await Complaint.findOne({ complaintId: complaint2Id });
    assert.equal(resolvedDoc.status, "Resolved");
    assert.equal(resolvedDoc.currentEscalationLevel, 1);
    assert.equal(resolvedDoc.escalationHistory.length, 0);
  });

  it("5. Multiple escalation levels work step-by-step up to Rank 1", async () => {
    const doc = await Complaint.findOne({ complaintId: complaint1Id });
    // Fast forward another 49 hours past Level 2 deadline
    const mockTimeLevel2Expired = new Date(doc.resolutionDeadline.getTime() + 1 * 60 * 60 * 1000);

    const summary = await escalateDueComplaints({ now: mockTimeLevel2Expired });
    assert.ok(summary.escalated >= 1);

    const level3Doc = await Complaint.findOne({ complaintId: complaint1Id });
    assert.equal(level3Doc.currentEscalationLevel, 3);
    assert.equal(level3Doc.assignedRank, 1); // Chief Warden is Rank 1
    assert.equal(String(level3Doc.assignedTo), String(chiefOfficerId));
    assert.equal(level3Doc.escalationHistory.length, 2);

    const entry2 = level3Doc.escalationHistory[1];
    assert.equal(entry2.previousLevel, 2);
    assert.equal(entry2.newLevel, 3);
    assert.equal(String(entry2.previousAssignedTo), String(seniorOfficerId));
    assert.equal(String(entry2.newAssignedTo), String(chiefOfficerId));
  });

  it("6. No higher authority exists: flags complaint for Admin attention", async () => {
    const doc = await Complaint.findOne({ complaintId: complaint1Id });
    assert.equal(doc.assignedRank, 1); // Currently at top rank

    // Fast forward 49 hours past Chief Warden's deadline
    const mockTimeTopExpired = new Date(doc.resolutionDeadline.getTime() + 1 * 60 * 60 * 1000);

    const summary = await escalateDueComplaints({ now: mockTimeTopExpired });
    assert.ok(summary.escalated >= 1);

    const topEscalated = await Complaint.findOne({ complaintId: complaint1Id });
    assert.equal(topEscalated.currentEscalationLevel, 4);
    assert.equal(topEscalated.escalationStatus, "admin_attention");
    assert.equal(topEscalated.assignedDesignation, "Office of the Ombudsman / Executive Admin");
    assert.equal(topEscalated.escalationHistory.length, 3);

    const entry3 = topEscalated.escalationHistory[2];
    assert.match(entry3.reason, /Admin attention/);
  });

  it("7. Duplicate or concurrent scheduler runs do NOT create duplicate escalations", async () => {
    // Create complaint 3
    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Network outage in Hostel B wing",
        description: "Wi-Fi access point in corridor 4 has lost signal completely.",
        category: "Infrastructure",
      }),
    });
    const body = await res.json();
    complaint3Id = body.complaint?.complaintId || body.data?.complaintId;
    assert.ok(complaint3Id);

    const c3 = await Complaint.findOne({ complaintId: complaint3Id });
    const expiredTime = new Date(c3.resolutionDeadline.getTime() + 2 * 60 * 60 * 1000);

    // Simulate 3 concurrent workers running at the exact same millisecond
    const [worker1, worker2, worker3] = await Promise.all([
      escalateDueComplaints({ now: expiredTime }),
      escalateDueComplaints({ now: expiredTime }),
      escalateDueComplaints({ now: expiredTime }),
    ]);

    const totalEscalationsForC3 = [worker1, worker2, worker3].reduce((acc, w) => {
      return acc + w.results.filter((r) => r.complaintId === complaint3Id).length;
    }, 0);

    assert.equal(totalEscalationsForC3, 1);

    const verifiedC3 = await Complaint.findOne({ complaintId: complaint3Id });
    assert.equal(verifiedC3.currentEscalationLevel, 2);
    assert.equal(verifiedC3.escalationHistory.length, 1);
  });

  it("8. Notifications reflect escalated status and level for user and admin", async () => {
    // 1. Student notifications endpoint
    const notifRes = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    assert.equal(notifData.success, true);
    assert.ok(Array.isArray(notifData.data));

    // Student should have notifications for their complaints
    const hasEscalatedNotif = notifData.data.some((n) => n.complaintId === complaint1Id);
    assert.ok(hasEscalatedNotif);
  });

  it("9. Users cannot manipulate escalation deadlines, levels, or assignments through frontend requests", async () => {
    const maliciousPayload = {
      title: "Malicious attempt to bypass escalation levels",
      description: "User attempting to supply internal escalation fields directly.",
      category: "Hostel",
      currentEscalationLevel: 99,
      resolutionDeadline: new Date(Date.now() + 1000000000),
      assignedTo: studentId,
      assignedRank: 1,
      escalationStatus: "admin_attention",
    };

    const res = await fetch(`${baseUrl}/complaints`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${studentToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(maliciousPayload),
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    const cid = data.complaint?.complaintId || data.data?.complaintId;
    assert.ok(cid);

    const doc = await Complaint.findOne({ complaintId: cid });
    // Must be forced by server, ignoring malicious body values
    assert.equal(doc.currentEscalationLevel, 1);
    assert.notEqual(String(doc.assignedTo), String(studentId));
    assert.equal(doc.escalationStatus, "normal");

    // Clean up
    await Complaint.deleteOne({ complaintId: cid });
  });

  it("10. External Cron Webhook (/api/escalate-cron) executes with valid cron key and rejects invalid keys", async () => {
    // 1. Without key
    const resNoKey = await fetch(`${baseUrl}/escalate-cron`, { method: "POST" });
    assert.equal(resNoKey.status, 401);

    // 2. With wrong key
    const resWrongKey = await fetch(`${baseUrl}/escalate-cron`, {
      method: "POST",
      headers: { "x-cron-key": "invalid-secret" },
    });
    assert.equal(resWrongKey.status, 401);

    // 3. With valid key
    const resValid = await fetch(`${baseUrl}/escalate-cron`, {
      method: "POST",
      headers: { "x-cron-key": "nyayastack-escalation-cron-secret" },
    });
    assert.equal(resValid.status, 200);
    const dataValid = await resValid.json();
    assert.equal(dataValid.success, true);
    assert.ok(typeof dataValid.summary.checked === "number");
  });
});
