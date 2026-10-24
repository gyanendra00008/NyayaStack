/**
 * JWT and Cookie Security Configuration
 */

const validateJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  if (secret.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long for cryptographic security.');
  }
};

const JWT_CONFIG = {
  algorithm: 'HS256',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  resetExpiresIn: '15m',
};

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Generates secure cookie options for session auth tokens
 */
const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours (aligned with JWT expiration)
  path: '/',
});

/**
 * Generates secure cookie options for password reset tokens
 */
const getResetCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
});

/**
 * Generates options to clear cookies matching creation options
 */
const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/',
});

module.exports = {
  validateJwtSecret,
  JWT_CONFIG,
  getAuthCookieOptions,
  getResetCookieOptions,
  getClearCookieOptions,
};
