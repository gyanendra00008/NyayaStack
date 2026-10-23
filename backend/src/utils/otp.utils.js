const crypto = require('crypto');

/**
 * Generates a cryptographically secure numeric OTP
 * @param {number} [length=6] - Number of digits for the OTP (default: 6)
 * @returns {string} - The generated OTP string
 */
const generateOtp = (length = 6) => {
  if (typeof length !== 'number' || length <= 0) {
    throw new Error('OTP length must be a positive integer');
  }

  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length);
  const otpNumber = crypto.randomInt(min, max);

  return otpNumber.toString();
};

/**
 * Hashes an OTP using SHA-256 for secure storage in the database
 * @param {string|number} otp - The plain text OTP
 * @returns {string} - Hex-encoded SHA-256 hash of the OTP
 */
const hashOtp = (otp) => {
  if (!otp) {
    throw new Error('OTP is required to generate a hash');
  }

  return crypto
    .createHash('sha256')
    .update(String(otp).trim())
    .digest('hex');
};

/**
 * Verifies a plain OTP against a stored hashed OTP in constant time
 * @param {string|number} enteredOtp - The OTP entered by the user
 * @param {string} storedHash - The stored SHA-256 hash
 * @returns {boolean} - True if valid and matching, false otherwise
 */
const verifyOtpHash = (enteredOtp, storedHash) => {
  if (!enteredOtp || !storedHash) {
    return false;
  }

  const computedHash = hashOtp(enteredOtp);
  const hashBuffer = Buffer.from(computedHash, 'utf8');
  const storedBuffer = Buffer.from(storedHash, 'utf8');

  if (hashBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
};

/**
 * Calculates an expiration Date object from the current time
 * @param {number} [minutes=10] - Number of minutes until expiration (default: 10)
 * @returns {Date} - Expiration Date
 */
const getOtpExpiry = (minutes = 10) => {
  const duration = typeof minutes === 'number' && minutes > 0 ? minutes : 10;
  return new Date(Date.now() + duration * 60 * 1000);
};

/**
 * Checks whether the given expiration timestamp is in the past
 * @param {Date|string|number} expiresAt - Expiration timestamp or Date
 * @returns {boolean} - True if expired, false otherwise
 */
const isOtpExpired = (expiresAt) => {
  if (!expiresAt) {
    return true;
  }

  return Date.now() > new Date(expiresAt).getTime();
};

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  getOtpExpiry,
  isOtpExpired,
};
