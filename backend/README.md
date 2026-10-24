# NyayaStack Backend API Documentation

Backend REST API for NyayaStack — a legal technology and case management platform built with Node.js, Express, MongoDB, Brevo Email Service, and JWT authentication.

---

## 📌 Base URL

```text
http://localhost:3000/api
```

*(Default port is `3000` or the port configured in `.env`)*

---

## ⚙️ Environment Variables

Before starting the server, ensure your `.env` file in the `backend/` directory is configured:

| Variable | Type | Description |
| :--- | :--- | :--- |
| `PORT` | Number | Port on which Express server listens (e.g. `3000`) |
| `MONGO_URI` | String | MongoDB connection string for Authentication Database (e.g. `mongodb://localhost:27017/nyayastack`) |
| `STORAGE_MONGO_URI` | String | Separate MongoDB connection string for Complaints Storage Database |
| `JWT_SECRET` | String | Secret key for signing and verifying JSON Web Tokens |
| `BREVO_API_KEY` | String | Brevo (Sendinblue) API key for transactional emails |
| `MAIL_FROM` | String | Sender email address (must be a verified sender in Brevo) |
| `MAIL_FROM_NAME` | String | Display name for outgoing emails (e.g. `NyayaStack`) |
| `CLOUDINARY_CLOUD_NAME` | String | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | String | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | String | Cloudinary API secret (kept strictly server-side) |
| `CLOUDINARY_FOLDER` | String | *(Optional)* Target folder in Cloudinary (defaults to `nyayastack/complaints`) |
| `CLOUDINARY_DELIVERY_TYPE` | String | *(Optional)* Asset delivery access mode (`upload`, `authenticated`, or `private`; defaults to `upload`) |

---

## 🛡️ Security & Rate Limiting

The backend implements tiered rate limiting via `express-rate-limit`:

- **Global Limiter**: 300 requests per 15 minutes across all API endpoints.
- **Registration Limiter**: Max 10 attempts per 15 minutes on `POST /api/auth/register`.
- **Login Limiter**: Max 5 attempts per 15 minutes on `POST /api/auth/login` and `POST /api/auth/change-password`.
- **OTP Limiter**: Max 15 attempts per 10 minutes on OTP endpoints.
- **Password Reset Limiter**: Max 5 attempts per 15 minutes on `POST /api/auth/reset-password`.
- **Secure OTPs**: 6-digit numeric OTPs generated with Node's cryptographically secure `crypto.randomInt()`, hashed with SHA-256 before saving to the database, and compared using constant-time `crypto.timingSafeEqual()`.

---

## 📋 API Endpoints Summary

| Method | Endpoint | Description | Rate Limit |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check and uptime | Global |
| `POST` | `/auth/register` | Register a new user and dispatch OTP email | Register Limiter (10 / 15 min) |
| `POST` | `/auth/verify-otp` | Verify the 6-digit OTP code to verify email | OTP Limiter (15 / 10 min) |
| `POST` | `/auth/resend-otp` | Resend a fresh verification OTP code | OTP Limiter (15 / 10 min) |
| `POST` | `/auth/login` | Authenticate an existing user | Login Limiter (5 / 15 min) |
| `POST` | `/auth/forgot-password` | Request password reset OTP via email/username | OTP Limiter (15 / 10 min) |
| `POST` | `/auth/verify-reset-otp` | Verify reset OTP and obtain single-use JWT reset token | OTP Limiter (15 / 10 min) |
| `POST` | `/auth/reset-password` | Reset password using verified single-use JWT reset token | Password Reset Limiter (5 / 15 min) |
| `POST` | `/auth/change-password` | Change password for authenticated session | Login Limiter (5 / 15 min) |
| `GET` | `/auth/me` | Retrieve profile of authenticated & verified user | Global |
| `GET` | `/auth/admin/dashboard` | Administrative resource protected with RBAC (`admin` role) | Global |
| `POST` | `/complaints` | Submit a new complaint with up to 5 file attachments | Global |
| `GET` | `/complaints/my` | Retrieve authenticated user's submitted complaints with pagination | Global |

---

## 📖 Detailed API Reference

### 1. Health Check

#### `GET /api/health`
Checks the server status, system timestamp, and process uptime.

- **Authentication**: None
- **Request Headers**: None
- **Request Body**: None

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "timestamp": "2026-10-23T16:45:00.000Z",
  "uptime": 128.45
}
```

---

### 2. User Registration

#### `POST /api/auth/register`
Registers a new user, hashes their password, generates a cryptographically secure 6-digit OTP valid for 10 minutes, stores its SHA-256 hash in MongoDB, and sends the plain OTP to the user's email via Brevo.

- **Authentication**: None
- **Request Headers**: `Content-Type: application/json`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "johndoe@example.com",
  "password": "SecurePassword123!",
  "role": "user"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `username` | String | Yes | Unique username |
| `email` | String | Yes | Valid email address |
| `password` | String | Yes | User password |
| `role` | String | No | `'user'`, `'officer'`, or `'admin'` (default: `'user'`) |

**Response (`201 Created`):**
*Sets `token` cookie with signed JWT.*
```json
{
  "message": "User registered successfully. Verification OTP sent to email.",
  "user": {
    "id": "6718d721f4a9b0123456789a",
    "username": "johndoe",
    "email": "johndoe@example.com",
    "role": "user",
    "isVerified": false
  }
}
```

**Error Responses:**
- `400 Bad Request`:
  ```json
  { "success": false, "message": "Username, email, and password are required" }
  ```
- `409 Conflict`:
  ```json
  { "message": "User already exists with this username or email" }
  ```
- `500 Internal Server Error`:
  ```json
  {
    "message": "Account created, but verification email could not be sent: ...",
    "error": "..."
  }
  ```

---

### 3. Verify OTP

#### `POST /api/auth/verify-otp`
Verifies the 6-digit OTP code entered by the user. If valid and not expired, marks `isVerified = true`, clears the OTP fields, issues a JWT token cookie, and activates the user account.

- **Authentication**: None
- **Rate Limit**: 15 requests per 10 minutes
- **Request Headers**: `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "johndoe@example.com",
  "otp": "734497"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String | Yes | Registered user email |
| `otp` | String / Number | Yes | 6-digit verification code received on email |

**Response (`200 OK`):**
*Sets `token` cookie with signed JWT.*
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "6718d721f4a9b0123456789a",
    "username": "johndoe",
    "email": "johndoe@example.com",
    "role": "user",
    "isVerified": true
  }
}
```

**Error Responses:**
- `400 Bad Request` (Missing fields):
  ```json
  { "message": "Email and OTP are required" }
  ```
- `400 Bad Request` (Already verified):
  ```json
  { "message": "Email is already verified" }
  ```
- `400 Bad Request` (Expired code):
  ```json
  { "message": "OTP has expired. Please request a new one" }
  ```
- `400 Bad Request` (Wrong code):
  ```json
  { "message": "Invalid OTP" }
  ```
- `404 Not Found`:
  ```json
  { "message": "User not found" }
  ```
- `429 Too Many Requests`:
  ```json
  { "success": false, "message": "Too many OTP attempts. Please try again after 10 minutes." }
  ```

---

### 4. Resend OTP

#### `POST /api/auth/resend-otp`
Generates a new 6-digit OTP, updates the hashed OTP and expiration timestamp in MongoDB, and sends a fresh verification email via Brevo.

- **Authentication**: None
- **Rate Limit**: 15 requests per 10 minutes
- **Request Headers**: `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "johndoe@example.com"
}
```

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String | Yes | Registered user email address |

**Response (`200 OK`):**
```json
{
  "message": "New OTP sent successfully to your email"
}
```

**Error Responses:**
- `400 Bad Request`:
  ```json
  { "message": "Email is required" }
  ```
  or
  ```json
  { "message": "Email is already verified" }
  ```
- `404 Not Found`:
  ```json
  { "message": "User not found" }
  ```

---

### 5. User Login

#### `POST /api/auth/login`
Authenticates an existing user via username or email and password, returning user details and setting an HTTP-only JWT auth cookie.

- **Authentication**: None
- **Rate Limit**: 5 attempts per 15 minutes
- **Request Headers**: `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "johndoe@example.com",
  "password": "SecurePassword123!"
}
```
*(You can supply either `"email"` or `"username"` along with `"password"`)*

**Response (`200 OK`):**
*Sets `token` cookie with signed JWT.*
```json
{
  "message": "Login successful",
  "user": {
    "id": "6718d721f4a9b0123456789a",
    "username": "johndoe",
    "email": "johndoe@example.com",
    "role": "user",
    "isVerified": true
  }
}
```

**Error Responses:**
- `401 Unauthorized`:
  ```json
  { "message": "Invalid password" }
  ```
- `404 Not Found`:
  ```json
  { "message": "User not found" }
  ```
- `429 Too Many Requests`:
  ```json
  { "success": false, "message": "Too many login attempts. Try again after 15 minutes." }
  ```

---

### 6. Forgot Password (Request OTP)

#### `POST /api/auth/forgot-password`
*(Also available at alias `POST /api/auth/forget-password`)*

Initiates the password reset workflow. Accepts either the user's username or email, generates a cryptographically secure 6-digit numeric OTP valid for 10 minutes, securely hashes it with SHA-256 in MongoDB, and dispatches an OTP email to the user's registered email address.

- **Authentication**: None
- **Rate Limit**: 15 requests per 10 minutes
- **Request Headers**: `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "johndoe@example.com"
}
```
*(You can supply `"email"`, `"username"`, or `"identifier"`)*

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Password reset OTP sent successfully to your registered email",
  "email": "johndoe@example.com"
}
```

**Error Responses:**
- `400 Bad Request`:
  ```json
  { "success": false, "message": "Username or email is required" }
  ```
- `404 Not Found`:
  ```json
  { "success": false, "message": "User not found with this username or email" }
  ```
- `500 Internal Server Error`:
  ```json
  { "success": false, "message": "OTP generated, but failed to send email: ...", "error": "..." }
  ```

---

### 7. Verify Password Reset OTP

#### `POST /api/auth/verify-reset-otp`
*(Also available at alias `POST /api/auth/verify-forget-otp`)*

Verifies the 6-digit OTP code received via email. Upon successful verification, invalidates the OTP (to prevent replay attacks) and issues a short-lived JSON Web Token (`resetToken`) valid for 15 minutes with `purpose: "password_reset"`.

- **Authentication**: None
- **Rate Limit**: 15 requests per 10 minutes
- **Request Headers**: `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "johndoe@example.com",
  "otp": "481920"
}
```
*(You can supply `"email"`, `"username"`, or `"identifier"` along with `"otp"`)*

**Response (`200 OK`):**
*Also sets `resetToken` cookie.*
```json
{
  "success": true,
  "message": "OTP verified successfully. You can now reset your password.",
  "resetToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` (Missing fields):
  ```json
  { "success": false, "message": "Username or email and OTP are required" }
  ```
- `400 Bad Request` (No request found):
  ```json
  { "success": false, "message": "No password reset request found for this user. Please request an OTP first." }
  ```
- `400 Bad Request` (Expired OTP):
  ```json
  { "success": false, "message": "OTP has expired. Please request a new one" }
  ```
- `400 Bad Request` (Invalid code):
  ```json
  { "success": false, "message": "Invalid OTP" }
  ```
- `404 Not Found`:
  ```json
  { "success": false, "message": "User not found" }
  ```

---

### 8. Reset Password

#### `POST /api/auth/reset-password`
Completes the Forgot Password process by accepting the new password and verifying the JWT `resetToken`. Hashes the new password with bcrypt (salt rounds = 10) and updates the database.

- **Authentication**: JWT Reset Token (via `Authorization: Bearer <resetToken>`, request body `resetToken`, or `resetToken` cookie)
- **Rate Limit**: 15 requests per 10 minutes
- **Request Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <resetToken>` *(or provide in body)*

**Request Body:**
```json
{
  "newPassword": "MyNewSecurePassword123!"
}
```
*(Or optionally: `{ "resetToken": "...", "newPassword": "..." }`)*

**Response (`200 OK`):**
*Clears `resetToken` cookie.*
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

**Error Responses:**
- `400 Bad Request` (Missing token):
  ```json
  { "success": false, "message": "Reset token is required" }
  ```
- `400 Bad Request` (Password too short):
  ```json
  { "success": false, "message": "New password is required and must be at least 6 characters long" }
  ```
- `401 Unauthorized` (Invalid/expired token):
  ```json
  { "success": false, "message": "Invalid or expired reset token. Please request a new OTP." }
  ```

---

### 9. Change Password

#### `POST /api/auth/change-password`
Allows an authenticated user (via JWT Bearer token or cookie) to change their password by verifying their current password.

- **Authentication**: JWT Auth Token (`Authorization: Bearer <token>` or cookie `token`)
- **Rate Limit**: 5 attempts per 15 minutes
- **Request Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewStrongPassword456!"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Password changed successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400 Bad Request` (Missing fields or short password):
  ```json
  { "success": false, "message": "Both oldPassword and newPassword are required" }
  ```
- `401 Unauthorized` (Wrong old password):
  ```json
  { "success": false, "message": "Current password is incorrect" }
  ```
- `401 Unauthorized` (No authentication):
  ```json
  { "success": false, "message": "Authentication token required. Please log in." }
  ```

---

### 10. Submit Complaint

#### `POST /api/complaints`
Submits a new formal grievance / petition with optional supporting file attachments uploaded directly to Cloudinary. Complaints are persisted to a physically isolated storage database configured via `STORAGE_MONGO_URI`.

- **Authentication**: JWT Auth Token (`Authorization: Bearer <token>` or cookie `token`)
- **Request Format**: `multipart/form-data`
- **Rate Limit**: Global Limiter (300 requests per 15 min)

**Form Fields:**

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `category` | String | Yes | Complaint category. Supported: `Hostel`, `Academic`, `Infrastructure`, `Administration`, `Finance`, `Harassment`, `Ragging`, `Discipline`, `Mess`, `Transport`, `Medical`, `Other` |
| `title` | String | Yes | Short problem title (3 to 200 characters) |
| `description` | String | Yes | Detailed problem description (10 to 5000 characters) |
| `attachments` | File(s) | No | Up to 5 files (field name: `attachments`). Supported formats: JPEG, PNG, WEBP, MP4, WEBM, PDF |

**Upload Rules & Security Limits:**
- **Maximum Files**: 5 attachments per complaint.
- **Maximum Request Size**: 10 MB total across all attachments.
- **Binary Signature Inspection**: Validates binary magic numbers (e.g. `%PDF`, `89 50 4E 47`, `FF D8 FF`) to block spoofed or renamed executables.
- **No Disk Buffering**: Uploads are processed in-memory (`memoryStorage`).
- **Atomic Rollback**: If Cloudinary upload succeeds but MongoDB persistence fails, or if a multi-file upload fails midway, already-uploaded Cloudinary assets are deleted immediately.

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Complaint submitted successfully",
  "data": {
    "complaintId": "VSP-M4T9B2-3A7F1C9E",
    "category": "Hostel",
    "title": "Water supply issue in Block B",
    "description": "There has been no water supply on the 3rd floor since morning.",
    "status": "Filed",
    "attachments": [
      {
        "url": "https://res.cloudinary.com/.../nyayastack/complaints/tap_photo.jpg",
        "publicId": "nyayastack/complaints/tap_photo_xyz",
        "resourceType": "image",
        "format": "jpg",
        "size": 104230,
        "originalName": "tap_photo.jpg"
      }
    ],
    "createdAt": "2026-10-24T10:40:00.000Z",
    "updatedAt": "2026-10-24T10:40:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` (Missing fields):
  ```json
  { "success": false, "message": "Missing required fields. 'category', 'title', and 'description' are all required." }
  ```
- `400 Bad Request` (Invalid category):
  ```json
  { "success": false, "message": "Invalid category 'WrongCategory'. Supported categories: Hostel, Academic, Infrastructure, Administration, Finance, Harassment, Ragging, Discipline, Mess, Transport, Medical, Other" }
  ```
- `400 Bad Request` (Empty file):
  ```json
  { "success": false, "message": "Empty file 'photo.jpg' is not allowed" }
  ```
- `400 Bad Request` (Unsupported format or magic byte mismatch):
  ```json
  { "success": false, "message": "Invalid attachment 'document.exe': Unsupported file extension (.exe). Allowed: JPEG, JPG, PNG, WEBP, MP4, WEBM, PDF" }
  ```
- `401 Unauthorized`:
  ```json
  { "success": false, "message": "Authentication token required. Please log in." }
  ```
- `413 Payload Too Large`:
  ```json
  { "success": false, "message": "Total upload size exceeds the maximum limit of 10 MB" }
  ```

---

### 11. Retrieve My Complaints

#### `GET /api/complaints/my`
Retrieves complaints submitted exclusively by the authenticated user from the separate storage database. Results are sorted in descending order of creation (`createdAt: -1`). Never exposes internal MongoDB IDs or another user's complaints.

- **Authentication**: JWT Auth Token (`Authorization: Bearer <token>` or cookie `token`)
- **Query Parameters**:
  - `page` (Number, Optional): Page number (positive integer, default: `1`).
  - `limit` (Number, Optional): Number of complaints per page (integer between `1` and `50`, default: `10`).

**Response (`200 OK`):**
```json
{
  "success": true,
  "data": [
    {
      "complaintId": "VSP-M4T9B2-3A7F1C9E",
      "category": "Hostel",
      "title": "Water supply issue in Block B",
      "description": "There has been no water supply on the 3rd floor since morning.",
      "status": "Filed",
      "attachments": [
        {
          "url": "https://res.cloudinary.com/.../nyayastack/complaints/tap_photo.jpg",
          "publicId": "nyayastack/complaints/tap_photo_xyz",
          "resourceType": "image",
          "format": "jpg",
          "size": 104230,
          "originalName": "tap_photo.jpg"
        }
      ],
      "createdAt": "2026-10-24T10:40:00.000Z",
      "updatedAt": "2026-10-24T10:40:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

**Error Responses:**
- `400 Bad Request` (Invalid query parameter):
  ```json
  { "success": false, "message": "Invalid query parameter 'limit'. Must be an integer between 1 and 50." }
  ```
- `401 Unauthorized`:
  ```json
  { "success": false, "message": "Authentication token required. Please log in." }
  ```

---

## 💻 Development Commands

From the `backend/` directory:

```bash
# Install dependencies
npm install

# Start development server with live reload (nodemon)
npm run dev

# Start server in production mode
npm start

# Run unit and integration tests (Auth & Complaint test suites)
npm test
```

---

## 📁 Directory Structure

```text
backend/
├── src/
│   ├── config/
│   │   ├── db.js                       # Primary (auth) & Storage (complaints) DB connections
│   │   └── jwt.config.js               # JWT algorithms & cookie options
│   ├── controllers/
│   │   ├── auth.controller.js          # Register, login, verify-otp, resend-otp, reset-password
│   │   ├── complaint.controller.js     # Create complaint & retrieve my complaints
│   │   └── health.controller.js        # Health check handler
│   ├── middleware/
│   │   ├── auth.middleware.js          # JWT authentication & RBAC middleware
│   │   ├── complaint.middleware.js     # Multer memory storage, 10MB quota & field validations
│   │   ├── errorHandler.js             # 404 & centralized error handlers
│   │   └── rateLimit.middleware.js     # Tiered rate limiting policies
│   ├── models/
│   │   ├── auth.models.js              # User Mongoose schema (Auth DB)
│   │   └── complaint.models.js         # Complaint Mongoose schema (Storage DB)
│   ├── routes/
│   │   ├── auth.routes.js              # Auth route definitions
│   │   ├── complaint.routes.js         # Complaint upload & retrieval route definitions
│   │   └── health.routes.js            # Health route definitions
│   ├── services/
│   │   ├── cloudinary.service.js       # Cloudinary buffer upload, destroy & atomic cleanup
│   │   └── mail.service.js             # Brevo email dispatcher & OTP templates
│   ├── utils/
│   │   ├── fileSignature.utils.js      # Binary magic number detection (PDF, PNG, JPG, WEBP, MP4, WEBM)
│   │   └── otp.utils.js                # Cryptographic OTP generator, hasher & validator
│   └── app.js                          # Express app configuration & middleware pipeline
├── tests/
│   ├── auth.test.js                    # 23 automated security & auth test cases
│   └── complaint.test.js               # 20 automated complaint upload, storage & retrieval test cases
├── server.js                           # Server entry point & database initializer
├── package.json
└── README.md                           # This documentation file
```
