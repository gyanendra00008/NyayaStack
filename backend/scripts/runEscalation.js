#!/usr/bin/env node

/**
 * Standalone Escalation Runner CLI
 * Intended for Render Cron Jobs, external schedulers, or CI/CD testing.
 *
 * Usage:
 *   node scripts/runEscalation.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const { escalateDueComplaints } = require("../src/services/escalation.service");

async function main() {
  console.log("==================================================");
  console.log("⏰ [NyayaStack] Starting Time-Based Complaint Escalation");
  console.log("==================================================");

  try {
    await connectDB();

    const summary = await escalateDueComplaints();

    console.log(`\nChecked complaints: ${summary.checked}`);
    console.log(`Escalated:          ${summary.escalated}`);

    if (summary.results.length > 0) {
      console.log("\nEscalation Details:");
      summary.results.forEach((r, idx) => {
        console.log(
          `  ${idx + 1}. [${r.complaintId}] Level ${r.previousLevel} -> Level ${r.newLevel} | To: ${r.escalatedTo} | Status: ${r.escalationStatus}`
        );
      });
    }

    if (summary.errors.length > 0) {
      console.warn("\nErrors encountered:");
      summary.errors.forEach((e) => console.warn(`  - [${e.complaintId}] ${e.error}`));
    }

    console.log("\nEscalation run completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Fatal error during escalation run:", err);
    process.exit(1);
  } finally {
    try {
      const { getStorageConnection } = require("../src/config/db");
      const storageConn = getStorageConnection();
      if (storageConn && storageConn.readyState !== 0) {
        await storageConn.close();
      }
    } catch (_) {}
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
