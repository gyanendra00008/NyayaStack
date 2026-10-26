require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const UserModel = require("../src/models/auth.models.js");

const BCRYPT_SALT_ROUNDS = 12;

async function run() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: node scripts/createAdmin.js <email> <password> [username]");
    console.log("Example: node scripts/createAdmin.js admin@nyayastack.gov.in Admin@1234 nyaya_admin");
    process.exit(1);
  }

  const email = args[0].trim().toLowerCase();
  const password = args[1];
  const username = (args[2] || email.split("@")[0]).trim().toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, "_");

  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.TEST_MONGO_URI;

  if (!mongoUri) {
    console.error("Error: MONGODB_URI or MONGO_URI is missing in .env file.");
    process.exit(1);
  }

  try {
    console.log("Connecting to database...");
    await mongoose.connect(mongoUri);

    let user = await UserModel.findOne({
      $or: [{ email }, { username }],
    });

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    if (user) {
      console.log(`Found existing user with identifier: ${user.email} (${user.username})`);
      user.role = "admin";
      user.isVerified = true;
      user.verificationStatus = "approved";
      user.password = hashedPassword;
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
      console.log(`Successfully upgraded user "${user.username}" (${user.email}) to Administrator role!`);
    } else {
      user = await UserModel.create({
        username,
        email,
        password: hashedPassword,
        fullName: "System Administrator",
        role: "admin",
        isVerified: true,
        verificationStatus: "approved",
      });
      console.log(`Successfully created new Administrator account: "${user.username}" (${user.email})`);
    }

    console.log("\n--- Admin Login Instructions ---");
    console.log("1. Open the frontend portal in your browser.");
    console.log("2. Navigate to: /authority/login (or /authority-login)");
    console.log(`3. Login using Identifier: ${user.email} (or ${user.username})`);
    console.log("4. You will be automatically redirected to: /admin/dashboard");
    console.log("--------------------------------\n");
  } catch (err) {
    console.error("Operation failed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
