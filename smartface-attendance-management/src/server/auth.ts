/**
 * SmartFace Enterprise Security & Cryptographic Authentication Module
 * Provides PBKDF2 password hashing, cryptographically secure session tokens,
 * device HMAC-SHA256 signature verification, and anti-replay protection.
 */

import crypto from 'crypto';

// -------------------------------------------------------------------------
// 1. PASSWORD HASHING (PBKDF2 with SHA-512)
// -------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

/**
 * Generate a random cryptographic salt.
 */
export function generateSalt(length = 16): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password using PBKDF2-HMAC-SHA512 with a salt.
 */
export function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString('hex');
}

/**
 * Verify a candidate password against stored salt and hash using timing-safe comparison.
 */
export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  if (!password || !salt || !storedHash) return false;
  const computedHash = hashPassword(password, salt);
  
  // Timing-safe buffer comparison to prevent timing attacks
  const computedBuf = Buffer.from(computedHash, 'hex');
  const storedBuf = Buffer.from(storedHash, 'hex');
  if (computedBuf.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, storedBuf);
}

/**
 * Validates password complexity: minimum 8 characters with letters and numbers.
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Password must contain both uppercase and lowercase letters.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one numerical digit.' };
  }
  return { valid: true };
}

// -------------------------------------------------------------------------
// 2. CRYPTOGRAPHICALLY SECURE SESSION TOKENS
// -------------------------------------------------------------------------

/**
 * Generates a 256-bit cryptographically secure pseudorandom session token.
 */
export function generateSecureSessionToken(): string {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `sf_sess_${randomBytes}_${Date.now()}`;
}

// -------------------------------------------------------------------------
// 3. HARDWARE DEVICE HMAC-SHA256 & REPLAY PROTECTION
// -------------------------------------------------------------------------

// In-memory sliding window nonce store for replay protection (max 10 minutes)
interface NonceEntry {
  nonce: string;
  deviceId: string;
  timestamp: number;
}
const seenNonces: NonceEntry[] = [];
const NONCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes window

/**
 * Compute HMAC-SHA256 for device requests.
 * Canonical string: `${deviceId}:${timestamp}:${nonce}:${payloadString}`
 */
export function computeDeviceHmac(
  secret: string,
  deviceId: string,
  timestamp: string | number,
  nonce: string,
  payload: unknown
): string {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const canonicalString = `${deviceId}:${timestamp}:${nonce}:${payloadStr}`;
  return crypto.createHmac('sha256', secret).update(canonicalString).digest('hex');
}

/**
 * Verify an incoming device request HMAC signature with timestamp window & replay checks.
 */
export function verifyDeviceSignature(params: {
  deviceId: string;
  timestamp: string | number;
  nonce: string;
  signature: string;
  secret: string;
  payload: unknown;
}): { valid: boolean; error?: string } {
  const { deviceId, timestamp, nonce, signature, secret, payload } = params;

  if (!deviceId || !timestamp || !nonce || !signature || !secret) {
    return { valid: false, error: 'Missing required HMAC signature headers or device secret' };
  }

  // 1. Verify Timestamp Window (prevent stale packets)
  const reqTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const now = Date.now();
  if (isNaN(reqTime) || Math.abs(now - reqTime) > NONCE_WINDOW_MS) {
    return {
      valid: false,
      error: `Timestamp out of acceptable bounds (drift > ${NONCE_WINDOW_MS / 1000}s). Server: ${new Date(now).toISOString()}, Client: ${new Date(reqTime).toISOString()}`,
    };
  }

  // 2. Replay Protection: Check if nonce was previously used for this device
  const isReplay = seenNonces.some(n => n.deviceId === deviceId && n.nonce === nonce);
  if (isReplay) {
    return { valid: false, error: 'Replay attack detected: Nonce has already been consumed' };
  }

  // 3. Compute and Timing-Safe Compare HMAC
  const expectedSig = computeDeviceHmac(secret, deviceId, timestamp, nonce, payload);
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const receivedBuf = Buffer.from(signature, 'hex');

  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return { valid: false, error: 'Invalid HMAC signature: Payload or secret mismatch' };
  }

  // 4. Register Nonce in sliding window and prune expired entries
  seenNonces.push({ nonce, deviceId, timestamp: now });
  const cutoff = now - NONCE_WINDOW_MS;
  const expiredIdx = seenNonces.findIndex(n => n.timestamp < cutoff);
  if (expiredIdx >= 0) {
    seenNonces.splice(0, expiredIdx + 1);
  }

  return { valid: true };
}
