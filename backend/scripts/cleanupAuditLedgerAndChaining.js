/**
 * Safe Migration & Cleanup Script: Audit Ledger & Complaint Chaining Removal
 * NyayaStack Grievance Redressal Engine
 *
 * This script safely unsets all chaining and ledger fields from the complaints collection
 * in the storage database and removes any remaining indexes associated with those fields.
 *
 * It preserves all complaint records, user accounts, escalation histories, attachments,
 * and status histories intact.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const storageUri =
  process.env.STORAGE_MONGO_URI ||
  process.env.TEST_STORAGE_MONGO_URI ||
  "mongodb://localhost:27017/nyayastack_storage";

async function runCleanup() {
  console.log("=== NyayaStack Audit Ledger & Chaining Cleanup ===");
  console.log(`Connecting to Storage Database: ${storageUri.replace(/:([^:@]{3,})@/, ":***@")}...`);

  let conn = null;
  try {
    conn = await mongoose.createConnection(storageUri).asPromise();
    console.log("Connected successfully to storage database.");

    const db = conn.db;
    const collections = await db.listCollections({ name: "complaints" }).toArray();

    if (collections.length === 0) {
      console.log("No 'complaints' collection found. Nothing to clean up.");
      return;
    }

    const complaintsCol = db.collection("complaints");

    // 1. Count documents with chaining or ledger fields
    const countWithChaining = await complaintsCol.countDocuments({
      $or: [
        { parentComplaintId: { $exists: true } },
        { chainId: { $exists: true } },
        { chainRoot: { $exists: true } },
        { ledgerHash: { $exists: true } },
        { previousHash: { $exists: true } },
      ],
    });

    console.log(`Found ${countWithChaining} complaint(s) with chaining/ledger metadata.`);

    if (countWithChaining > 0) {
      // 2. Unset the fields across all documents
      const updateResult = await complaintsCol.updateMany(
        {},
        {
          $unset: {
            parentComplaintId: "",
            chainId: "",
            chainRoot: "",
            ledgerHash: "",
            previousHash: "",
          },
        }
      );
      console.log(`Unset operation modified ${updateResult.modifiedCount} document(s).`);
    } else {
      console.log("All documents are already clean of chaining/ledger fields.");
    }

    // 3. Inspect and remove any legacy indexes
    const indexes = await complaintsCol.indexes();
    const indexesToDrop = ["chainId_1", "parentComplaintId_1"];

    for (const indexName of indexesToDrop) {
      const exists = indexes.some((idx) => idx.name === indexName);
      if (exists) {
        console.log(`Dropping legacy index: ${indexName}...`);
        await complaintsCol.dropIndex(indexName);
        console.log(`Dropped index ${indexName} successfully.`);
      }
    }

    console.log("Migration cleanup completed successfully.");
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.close();
      console.log("Database connection closed.");
    }
  }
}

runCleanup();
