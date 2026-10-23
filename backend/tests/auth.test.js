const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

process.env.NODE_ENV = "test";
process.env.PORT = "0"; // Ephemeral port
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "super_secure_test_jwt_secret_key_with_at_least_32_characters_123!";
}

const app = require("../src/app.js");
const UserModel = require("../src/models/auth.models.js");
const { hashOtp, getOtpExpiry } = require("../src/utils/otp.utils.js");
const { getAuthCookieOptions, getResetCookieOptions } = require("../src/config/jwt.config.js");

let server;
let baseUrl;

// Test DB URI (isolated test database)
const testDbUri =
  process.env.TEST_MONGO_URI ||
  (process.env.MONGO_URI
    ? process.env.MONGO_URI.replace(/\/[^/?]+(\?|$)/, "/nyayastack_test$1")
    : "mongodb://localhost:27017/nyayastack_test");

const cleanTestUsers = async () => {
  await UserModel.deleteMany({ email: { $regex: /@nyayastack-test\.com$/ } });
};

before(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testDbUri);
  }
  await cleanTestUsers();

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

after(async () => {
  await cleanTestUsers();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.close();
});

describe("NyayaStack Authentication & Security Test Suite", () => {
  const uniqueId = Date.now();
  const testUser = {
    username: `user_${uniqueId}`,
    email: `user_${uniqueId}@nyayastack-test.com`,
    password: "Password123!",
  };

  // 1. Successful registration
  it("1. Successful registration creates unverified user with role 'user' and sends OTP without issuing token cookie", async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.success, true);
    assert.equal(data.user.role, "user");
    assert.equal(data.user.isVerified, false);
    assert.equal(data.user.email, testUser.email.toLowerCase());

    // Security check: No authentication token cookie should be set before verification
    const setCookie = res.headers.get("set-cookie");
    assert.equal(setCookie, null, "Registration should not set an auth token cookie before email verification");
  });

  // 2. Rejection of attempts to register as admin (Privilege Escalation Prevention)
  it("2. Rejection of attempts to register as admin (Forces role: 'user')", async () => {
    const adminAttempt = {
      username: `admin_hack_${Date.now()}`,
      email: `admin_hack_${Date.now()}@nyayastack-test.com`,
      password: "Password123!",
      role: "admin", // Malicious attempt to escalate
    };

    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminAttempt),
    });

    const data = await res.json();
    assert.equal(res.status, 201);
    assert.equal(data.user.role, "user", "Role must be forced to 'user' regardless of request payload");

    const savedUser = await UserModel.findOne({ email: adminAttempt.email.toLowerCase() });
    assert.equal(savedUser.role, "user", "Database must store role as 'user'");
  });

  // 3. Duplicate username/email handling
  it("3. Duplicate username/email handling rejects duplicates when verified", async () => {
    // Manually mark our test user as verified
    await UserModel.updateOne({ email: testUser.email.toLowerCase() }, { isVerified: true });

    // Attempt duplicate email
    const resDuplicateEmail = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `different_user_${Date.now()}`,
        email: testUser.email,
        password: "Password123!",
      }),
    });
    const dataEmail = await resDuplicateEmail.json();
    assert.equal(resDuplicateEmail.status, 409);
    assert.match(dataEmail.message, /already exists/i);

    // Attempt duplicate username
    const resDuplicateUsername = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUser.username,
        email: `different_email_${Date.now()}@nyayastack-test.com`,
        password: "Password123!",
      }),
    });
    const dataUser = await resDuplicateUsername.json();
    assert.equal(resDuplicateUsername.status, 409);
    assert.match(dataUser.message, /already taken/i);
  });

  // 4. Registration retry with an existing unverified account
  it("4. Registration retry with an existing unverified account updates credentials securely without overwriting role", async () => {
    const unverifiedEmail = `unverified_${Date.now()}@nyayastack-test.com`;
    const initialUser = {
      username: `unverified_${Date.now()}`,
      email: unverifiedEmail,
      password: "OldPassword123!",
    };

    // First registration
    const res1 = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initialUser),
    });
    assert.equal(res1.status, 201);

    // Second registration retry with new password and attempting role escalation
    const res2 = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: initialUser.username,
        email: unverifiedEmail,
        password: "NewPassword123!",
        role: "officer",
      }),
    });
    const data2 = await res2.json();
    assert.equal(res2.status, 201);
    assert.equal(data2.user.role, "user", "Role must remain 'user' on registration retry");

    // Verify password was updated to NewPassword123!
    const updatedUser = await UserModel.findOne({ email: unverifiedEmail.toLowerCase() }).select("+password");
    const isNewPasswordMatch = await bcrypt.compare("NewPassword123!", updatedUser.password);
    assert.equal(isNewPasswordMatch, true);
  });

  // 5. OTP verification with a correct OTP
  it("5. OTP verification with a correct OTP verifies account and issues auth token and cookie", async () => {
    const email = `verify_otp_${Date.now()}@nyayastack-test.com`;
    await UserModel.create({
      username: `verify_user_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("Password123!", 10),
      isVerified: false,
      role: "user",
      otp: hashOtp("123456"),
      otpExpires: getOtpExpiry(10),
    });

    const res = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: "123456" }),
    });

    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.user.isVerified, true);
    assert.ok(data.token, "Must return JWT authentication token");

    // Check Set-Cookie
    const cookieHeader = res.headers.get("set-cookie");
    assert.ok(cookieHeader, "Must set cookie header");
    assert.match(cookieHeader, /token=/);
    assert.match(cookieHeader, /HttpOnly/i);

    const dbUser = await UserModel.findOne({ email: email.toLowerCase() });
    assert.equal(dbUser.isVerified, true);
  });

  // 6. OTP rejection when incorrect or expired
  it("6. OTP rejection when incorrect or expired", async () => {
    const email = `fail_otp_${Date.now()}@nyayastack-test.com`;
    await UserModel.create({
      username: `fail_user_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("Password123!", 10),
      isVerified: false,
      role: "user",
      otp: hashOtp("112233"),
      otpExpires: new Date(Date.now() - 5000), // Expired 5 seconds ago
    });

    // Test expired OTP
    const resExpired = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: "112233" }),
    });
    assert.equal(resExpired.status, 400);
    const dataExpired = await resExpired.json();
    assert.match(dataExpired.message, /expired/i);

    // Update expiry to future, test incorrect OTP
    await UserModel.updateOne({ email: email.toLowerCase() }, { otpExpires: getOtpExpiry(10) });

    const resWrong = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: "999999" }),
    });
    assert.equal(resWrong.status, 400);
    const dataWrong = await resWrong.json();
    assert.match(dataWrong.message, /invalid otp/i);
  });

  // 7. OTP invalidation after successful verification
  it("7. OTP invalidation after successful verification clears OTP fields and rejects reuse", async () => {
    const email = `reuse_otp_${Date.now()}@nyayastack-test.com`;
    await UserModel.create({
      username: `reuse_user_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("Password123!", 10),
      isVerified: false,
      role: "user",
      otp: hashOtp("445566"),
      otpExpires: getOtpExpiry(10),
    });

    // First attempt succeeds
    const res1 = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: "445566" }),
    });
    assert.equal(res1.status, 200);

    // Check database to ensure OTP is cleared
    const dbUser = await UserModel.findOne({ email: email.toLowerCase() }).select("+otp");
    assert.equal(dbUser.otp, undefined, "OTP must be cleared after verification");
    assert.equal(dbUser.otpExpires, undefined, "OTP expiry must be cleared");

    // Second attempt should fail
    const res2 = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: "445566" }),
    });
    assert.equal(res2.status, 400);
  });

  // 8. Resend OTP invalidating the previous OTP
  it("8. Resend OTP invalidates the previous OTP", async () => {
    const email = `resend_${Date.now()}@nyayastack-test.com`;
    const user = await UserModel.create({
      username: `resend_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("Password123!", 10),
      isVerified: false,
      role: "user",
      otp: hashOtp("111111"),
      otpExpires: getOtpExpiry(10),
      otpLastSentAt: new Date(Date.now() - 70000), // Past cooldown
    });

    const res = await fetch(`${baseUrl}/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert.equal(res.status, 200);

    // Old OTP should no longer be valid
    const resVerifyOld = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: "111111" }),
    });
    assert.equal(resVerifyOld.status, 400);
  });

  // 9. Login with correct and incorrect credentials
  it("9. Login with correct and incorrect credentials (generic errors to prevent enumeration)", async () => {
    const email = `login_${Date.now()}@nyayastack-test.com`;
    const password = "CorrectPassword123!";
    await UserModel.create({
      username: `login_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      isVerified: true,
      role: "user",
    });

    // Correct credentials
    const resCorrect = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
    });
    assert.equal(resCorrect.status, 200);
    const dataCorrect = await resCorrect.json();
    assert.ok(dataCorrect.token);
    assert.equal(dataCorrect.user.email, email.toLowerCase());

    // Incorrect password
    const resWrongPass = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password: "WrongPassword!" }),
    });
    assert.equal(resWrongPass.status, 401);
    const dataWrongPass = await resWrongPass.json();
    assert.equal(dataWrongPass.message, "Invalid email/username or password");

    // Non-existent user
    const resNonExistent = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "nonexistent@nyayastack-test.com", password }),
    });
    assert.equal(resNonExistent.status, 401);
    const dataNonExistent = await resNonExistent.json();
    // Must return the exact same generic error to prevent account enumeration
    assert.equal(dataNonExistent.message, "Invalid email/username or password");
  });

  // 10. Login attempts by unverified users
  it("10. Login attempts by unverified users are rejected with 403 Forbidden", async () => {
    const email = `unverified_login_${Date.now()}@nyayastack-test.com`;
    const password = "Password123!";
    await UserModel.create({
      username: `unv_log_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      isVerified: false,
      role: "user",
    });

    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /verify your email/i);
  });

  // 11. Rejection of missing, malformed, and expired JWTs
  it("11. Rejection of missing, malformed, and expired JWTs", async () => {
    // Missing token
    const resMissing = await fetch(`${baseUrl}/auth/me`, { method: "GET" });
    assert.equal(resMissing.status, 401);

    // Malformed token
    const resMalformed = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: "Bearer this.is.malformed" },
    });
    assert.equal(resMalformed.status, 401);

    // Expired token
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId() },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "-1s" }
    );
    const resExpired = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(resExpired.status, 401);
  });

  // 12. Rejection of unauthorized protected-route requests
  it("12. Rejection of unauthorized protected-route requests (Standard user accessing admin dashboard)", async () => {
    const user = await UserModel.create({
      username: `std_user_${Date.now()}`,
      email: `std_${Date.now()}@nyayastack-test.com`,
      password: await bcrypt.hash("Password123!", 10),
      isVerified: true,
      role: "user",
    });

    const userToken = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const res = await fetch(`${baseUrl}/auth/admin/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /Forbidden/i);
  });

  // 13. Prevention of access to protected routes by unverified users
  it("13. Prevention of access to protected routes by unverified users", async () => {
    const unverifiedUser = await UserModel.create({
      username: `unv_prot_${Date.now()}`,
      email: `unv_prot_${Date.now()}@nyayastack-test.com`,
      password: await bcrypt.hash("Password123!", 10),
      isVerified: false,
      role: "user",
    });

    const token = jwt.sign(
      { id: unverifiedUser._id, role: unverifiedUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const res = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.message, /verification required/i);
  });

  // 14. Forgot-password behavior for existing and nonexistent accounts
  it("14. Forgot-password returns identical generic responses without leaking account existence or email", async () => {
    const existingEmail = `forgot_exist_${Date.now()}@nyayastack-test.com`;
    await UserModel.create({
      username: `forgot_exist_${Date.now()}`,
      email: existingEmail.toLowerCase(),
      password: await bcrypt.hash("Password123!", 10),
      isVerified: true,
      role: "user",
    });

    // Existing account
    const resExisting = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: existingEmail }),
    });
    assert.equal(resExisting.status, 200);
    const dataExisting = await resExisting.json();
    assert.equal(dataExisting.email, undefined, "Email must not be leaked in forgot password response");
    assert.match(dataExisting.message, /If an account with that email or username exists/i);

    // Non-existent account
    const resNonExistent = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "doesnotexist@nyayastack-test.com" }),
    });
    assert.equal(resNonExistent.status, 200);
    const dataNonExistent = await resNonExistent.json();
    assert.equal(dataNonExistent.message, dataExisting.message, "Responses must match to prevent enumeration");
  });

  // 15. Rejection of incorrect or expired reset OTPs
  it("15. Rejection of incorrect or expired reset OTPs", async () => {
    const email = `reset_otp_${Date.now()}@nyayastack-test.com`;
    await UserModel.create({
      username: `reset_otp_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("Password123!", 10),
      isVerified: true,
      role: "user",
      resetPasswordOtp: hashOtp("778899"),
      resetPasswordExpires: new Date(Date.now() - 1000), // Expired
    });

    // Expired OTP
    const resExpired = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, otp: "778899" }),
    });
    assert.equal(resExpired.status, 400);

    // Wrong OTP
    await UserModel.updateOne({ email: email.toLowerCase() }, { resetPasswordExpires: getOtpExpiry(10) });
    const resWrong = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, otp: "123123" }),
    });
    assert.equal(resWrong.status, 400);
  });

  // 16. Password-reset token purpose validation
  it("16. Password-reset token purpose validation isolates reset tokens from auth tokens", async () => {
    const user = await UserModel.create({
      username: `purpose_user_${Date.now()}`,
      email: `purpose_${Date.now()}@nyayastack-test.com`,
      password: await bcrypt.hash("Password123!", 10),
      isVerified: true,
      role: "user",
    });

    // Regular auth token attempted at reset-password endpoint
    const regularAuthToken = jwt.sign(
      { id: user._id, role: "user" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );
    const resReset = await fetch(`${baseUrl}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${regularAuthToken}`,
      },
      body: JSON.stringify({ newPassword: "NewSecretPassword123!" }),
    });
    assert.equal(resReset.status, 403);
    const dataReset = await resReset.json();
    assert.match(dataReset.message, /invalid token purpose/i);

    // Reset token attempted at normal protected endpoint (/me)
    const resetToken = jwt.sign(
      { id: user._id, purpose: "password_reset", jti: "dummy" },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" }
    );
    const resMe = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${resetToken}` },
    });
    assert.equal(resMe.status, 401);
    const dataMe = await resMe.json();
    assert.match(dataMe.message, /invalid token type/i);
  });

  // 17. Prevention of repeated use of a reset token (One-Time-Use)
  it("17. Prevention of repeated use of a reset token (One-Time-Use)", async () => {
    const email = `onetime_${Date.now()}@nyayastack-test.com`;
    const user = await UserModel.create({
      username: `onetime_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("InitialPassword123!", 10),
      isVerified: true,
      role: "user",
      resetPasswordOtp: hashOtp("998877"),
      resetPasswordExpires: getOtpExpiry(10),
    });

    // Step 2: Verify reset OTP to get reset token
    const resVerify = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, otp: "998877" }),
    });
    assert.equal(resVerify.status, 200);
    const { resetToken } = await resVerify.json();
    assert.ok(resetToken);

    // Step 3 (First use): Reset password
    const resUse1 = await fetch(`${baseUrl}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resetToken}`,
      },
      body: JSON.stringify({ newPassword: "UpdatedPassword123!" }),
    });
    assert.equal(resUse1.status, 200);

    // Step 3 (Second use): Attempt reuse of the exact same reset token
    const resUse2 = await fetch(`${baseUrl}/auth/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resetToken}`,
      },
      body: JSON.stringify({ newPassword: "HackedPassword123!" }),
    });
    assert.equal(resUse2.status, 401, "Reusing a reset token must be rejected with 401");
    const dataUse2 = await resUse2.json();
    assert.match(dataUse2.message, /already been used/i);
  });

  // 18. Prevention of unauthenticated password changes
  it("18. Prevention of unauthenticated password changes (Requires authenticated JWT session)", async () => {
    const email = `unauth_change_${Date.now()}@nyayastack-test.com`;
    await UserModel.create({
      username: `unauth_change_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("CurrentPassword123!", 10),
      isVerified: true,
      role: "user",
    });

    // Attempting change-password without token but providing username/email in body
    const res = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        oldPassword: "CurrentPassword123!",
        newPassword: "NewSecretPassword123!",
      }),
    });
    assert.equal(res.status, 401, "Must reject unauthenticated password change attempts");
    const data = await res.json();
    assert.match(data.message, /Authentication token required/i);
  });

  // 19. Successful password change after verifying current password
  it("19. Successful password change after verifying current password", async () => {
    const email = `change_pass_${Date.now()}@nyayastack-test.com`;
    const user = await UserModel.create({
      username: `change_user_${Date.now()}`,
      email: email.toLowerCase(),
      password: await bcrypt.hash("OldPassword123!", 10),
      isVerified: true,
      role: "user",
      tokenVersion: 0,
    });

    const authToken = jwt.sign(
      { id: user._id, role: user.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    // Wrong current password
    const resWrong = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        oldPassword: "IncorrectPassword123!",
        newPassword: "BrandNewPassword123!",
      }),
    });
    assert.equal(resWrong.status, 401);
    const dataWrong = await resWrong.json();
    assert.match(dataWrong.message, /Current password is incorrect/i);

    // Correct current password
    const resSuccess = await fetch(`${baseUrl}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        oldPassword: "OldPassword123!",
        newPassword: "BrandNewPassword123!",
      }),
    });
    assert.equal(resSuccess.status, 200);

    // Check tokenVersion incremented (session revocation)
    const updatedUser = await UserModel.findById(user._id).select("+password");
    assert.equal(updatedUser.tokenVersion, 1);
    const isNewValid = await bcrypt.compare("BrandNewPassword123!", updatedUser.password);
    assert.equal(isNewValid, true);

    // Old token should now be rejected due to tokenVersion mismatch
    const resOldToken = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    assert.equal(resOldToken.status, 401);
  });

  // 20. Correct password hashing and absence of password hashes in API responses
  it("20. Correct password hashing (bcrypt) and absence of password hashes in API responses", async () => {
    const email = `hash_check_${Date.now()}@nyayastack-test.com`;
    const resReg = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `hash_check_${Date.now()}`,
        email,
        password: "MySecretPassword123!",
      }),
    });
    const dataReg = await resReg.json();
    assert.equal(dataReg.user.password, undefined);
    assert.equal(dataReg.user.otp, undefined);

    const savedUser = await UserModel.findOne({ email: email.toLowerCase() }).select("+password");
    assert.match(savedUser.password, /^\$2[aby]\$\d+\$/, "Password must be a valid bcrypt hash");
  });

  // 21. Rate-limit enforcement
  it("21. Rate-limit enforcement is wired into the application", async () => {
    // Check that health or register routes include standard rate-limiting headers
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    // Draft-8 standard headers
    assert.ok(
      res.headers.has("ratelimit-limit") || res.headers.has("ratelimit"),
      "Must include RateLimit headers"
    );
  });

  // 22. Appropriate cookie configuration in development and production
  it("22. Appropriate cookie configuration options helper validates secure attributes", () => {
    const authOptions = getAuthCookieOptions();
    assert.equal(authOptions.httpOnly, true);
    assert.equal(authOptions.path, "/");
    assert.ok(authOptions.maxAge > 0);

    const resetOptions = getResetCookieOptions();
    assert.equal(resetOptions.httpOnly, true);
    assert.equal(resetOptions.maxAge, 15 * 60 * 1000);
  });

  // 23. Role-based access control for administrative routes
  it("23. Role-based access control grants admin access only to admin role", async () => {
    const adminUser = await UserModel.create({
      username: `real_admin_${Date.now()}`,
      email: `admin_${Date.now()}@nyayastack-test.com`,
      password: await bcrypt.hash("AdminPass123!", 10),
      isVerified: true,
      role: "admin",
    });

    const adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const resAdmin = await fetch(`${baseUrl}/auth/admin/dashboard`, {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resAdmin.status, 200);
    const dataAdmin = await resAdmin.json();
    assert.equal(dataAdmin.role, "admin");
    assert.equal(dataAdmin.success, true);
  });
});
