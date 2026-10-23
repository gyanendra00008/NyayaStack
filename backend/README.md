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
| `MONGO_URI` | String | MongoDB connection string (e.g. `mongodb://localhost:27017/nyayastack`) |
| `JWT_SECRET` | String | Secret key for signing and verifying JSON Web Tokens |
| `BREVO_API_KEY` | String | Brevo (Sendinblue) API key for transactional emails |
| `MAIL_FROM` | String | Sender email address (must be a verified sender in Brevo) |
| `MAIL_FROM_NAME` | String | Display name for outgoing emails (e.g. `NyayaStack`) |

---

## 🛡️ Security & Rate Limiting

The backend implements tiered rate limiting via `express-rate-limit`:

- **Global Limiter**: 50 requests per 15 minutes across all API endpoints.
- **Login Limiter**: Max 5 attempts per 15 minutes on `POST /api/auth/login`.
- **OTP Limiter**: Max 15 attempts per 10 minutes on `POST /api/auth/verify-otp` and `POST /api/auth/resend-otp`.
- **Secure OTPs**: 6-digit numeric OTPs generated with Node's cryptographically secure `crypto.randomInt()`, hashed with SHA-256 before saving to the database, and compared using constant-time `crypto.timingSafeEqual()`.

---

## 📋 API Endpoints Summary

| Method | Endpoint | Description | Rate Limit |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check and uptime | Global |
| `POST` | `/auth/register` | Register a new user and dispatch OTP email | Global |
| `POST` | `/auth/verify-otp` | Verify the 6-digit OTP code to verify email | OTP Limiter (15 / 10 min) |
| `POST` | `/auth/resend-otp` | Resend a fresh verification OTP code | OTP Limiter (15 / 10 min) |
| `POST` | `/auth/login` | Authenticate an existing user | Login Limiter (5 / 15 min) |

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

## 💻 Development Commands

From the `backend/` directory:

```bash
# Install dependencies
npm install

# Start development server with live reload (nodemon)
npm run dev

# Start server in production mode
npm start
```

---

## 📁 Directory Structure

```text
backend/
├── src/
│   ├── config/
│   │   └── db.js                       # MongoDB connection setup
│   ├── controllers/
│   │   ├── auth.controller.js          # Register, login, verify-otp, resend-otp
│   │   └── health.controller.js        # Health check handler
│   ├── middleware/
│   │   ├── auth.middleware.js          # Input validations & user existence checks
│   │   ├── errorHandler.js             # 404 & centralized error handlers
│   │   └── rateLimit.middleware.js     # Rate limiting policies
│   ├── models/
│   │   └── auth.models.js              # User Mongoose schema (with OTP fields)
│   ├── routes/
│   │   ├── auth.routes.js              # Auth route definitions
│   │   └── health.routes.js            # Health route definitions
│   ├── services/
│   │   └── mail.service.js             # Brevo email dispatcher & OTP templates
│   ├── utils/
│   │   └── otp.utils.js                # Cryptographic OTP generator, hasher & validator
│   └── app.js                          # Express app configuration & middleware pipeline
├── server.js                           # Server entry point & database initializer
├── package.json
└── README.md                           # This documentation file
```
