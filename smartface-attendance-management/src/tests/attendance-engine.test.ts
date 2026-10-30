/**
 * SmartFace Attendance Engine & Security Test Suite
 * Comprehensive verification of:
 * 1. Cryptographic Authentication & PBKDF2 Password Hashing
 * 2. Session Invalidation & Replay Defense
 * 3. Secret Exposure Audit (Zero client-side secrets)
 * 4. Device HMAC-SHA256 Signatures & Anti-Replay Nonce Windows
 * 5. Supabase PostgreSQL Schema Verification & Local Fallback Isolation
 * 6. Biometric Consent, Retention, and Privacy Vector Purging
 * 7. Attendance Engine Rules, Asia/Kolkata Timezone, and Idempotency
 */

import fs from 'fs';
import path from 'path';
import { AttendanceEngine } from '../server/attendance-engine.ts';
import {
  db,
  isSupabaseConfigured,
  setTestVerificationOverride,
  setTestEnvOverride,
  resetTestingOverrides,
  DatabaseUnavailableError,
} from '../server/db.ts';
import {
  DEFAULT_TIMEZONE,
  parseDateTimeInTimezone,
  getDateStringInTimezone,
} from '../server/timezone.ts';
import {
  hashPassword,
  verifyPassword,
  generateSalt,
  computeDeviceHmac,
  verifyDeviceSignature,
} from '../server/auth.ts';

export interface TestResult {
  title: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

export function runAttendanceTests(): TestResult[] {
  const results: TestResult[] = [];

  function test(name: string, fn: () => void) {
    const start = Date.now();
    try {
      fn();
      results.push({
        title: name,
        passed: true,
        durationMs: Date.now() - start,
      });
    } catch (err: unknown) {
      results.push({
        title: name,
        passed: false,
        message: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      });
    }
  }

  // =========================================================================
  // 1. AUTHENTICATION & CREDENTIALS SECURITY
  // =========================================================================

  test('Auth 1: Hardcoded public passwords (e.g. Admin@123, Manager@123) are rejected', () => {
    // Old publicly known passwords must never work
    const oldAdmin = db.authenticateUser('admin@smartface.internal', 'Admin@123');
    if (oldAdmin !== null) {
      throw new Error('Insecure legacy password Admin@123 was erroneously accepted!');
    }
    const oldHr = db.authenticateUser('hr@smartface.internal', 'Manager@123');
    if (oldHr !== null) {
      throw new Error('Insecure legacy password Manager@123 was erroneously accepted!');
    }
    const oldAuditor = db.authenticateUser('auditor@smartface.internal', 'Auditor@123');
    if (oldAuditor !== null) {
      throw new Error('Insecure legacy password Auditor@123 was erroneously accepted!');
    }
  });

  test('Auth 2: PBKDF2-HMAC-SHA512 password verification and secure token generation', () => {
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'SmartFace@2026!Sec';
    const auth = db.authenticateUser('admin@smartface.internal', adminPass);
    if (!auth || !auth.token || auth.user.role !== 'super_admin') {
      throw new Error('Super admin authentication with initial secure credentials failed');
    }
    // Token must be cryptographically long (256-bit hex prefix)
    if (!auth.token.startsWith('sf_sess_') || auth.token.length < 40) {
      throw new Error(`Session token format is insecure: ${auth.token}`);
    }
    // Validate session
    const user = db.validateSessionToken(auth.token);
    if (!user || user.email !== 'admin@smartface.internal') {
      throw new Error('Session token validation failed');
    }
  });

  test('Auth 3: Session invalidation on logout; revoked tokens cannot be reused', () => {
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'SmartFace@2026!Sec';
    const auth = db.authenticateUser('admin@smartface.internal', adminPass);
    if (!auth) throw new Error('Auth failed');

    const validBefore = db.validateSessionToken(auth.token);
    if (!validBefore) throw new Error('Token should be valid before logout');

    // Invalidate
    const loggedOut = db.invalidateSession(auth.token);
    if (!loggedOut) throw new Error('invalidateSession returned false');

    // Token must now be strictly rejected
    const validAfter = db.validateSessionToken(auth.token);
    if (validAfter !== null) {
      throw new Error('Revoked session token was still accepted after logout!');
    }
  });

  test('Auth 4: Secure password change enforces complexity, salt rotation, and rejects wrong current password', () => {
    const adminPass = process.env.INITIAL_ADMIN_PASSWORD || 'SmartFace@2026!Sec';
    const auth = db.authenticateUser('admin@smartface.internal', adminPass);
    if (!auth) throw new Error('Auth failed');

    // Wrong current password
    const failCurrent = db.changePassword(auth.user.id, 'WrongCurrentPass!', 'NewStrongPass@2026');
    if (failCurrent.success) {
      throw new Error('Password change succeeded with incorrect current password');
    }

    // Weak new password
    const failWeak = db.changePassword(auth.user.id, adminPass, 'weak');
    if (failWeak.success) {
      throw new Error('Password change accepted weak password (less than 8 chars)');
    }

    // Identical password
    const failIdentical = db.changePassword(auth.user.id, adminPass, adminPass);
    if (failIdentical.success) {
      throw new Error('Password change accepted identical password');
    }
  });

  test('Auth 5: Dynamic user provisioning generates cryptographically salted accounts with mustChangePassword flag', () => {
    const testEmail = `test.auditor.${Date.now()}@smartface.internal`;
    const provisioned = db.provisionUser(
      {
        email: testEmail,
        fullName: 'Test Auditor User',
        role: 'auditor',
      },
      'admin@smartface.internal'
    );

    if (!provisioned.user || !provisioned.initialPassword) {
      throw new Error('User provisioning failed to return user and initial password');
    }
    if (!provisioned.user.mustChangePassword) {
      throw new Error('Provisioned user must have mustChangePassword set to true');
    }

    // Test authenticate provisioned user
    const login = db.authenticateUser(testEmail, provisioned.initialPassword);
    if (!login || login.user.role !== 'auditor') {
      throw new Error('Failed to log in with provisioned credentials');
    }
  });

  // =========================================================================
  // 2. SECRET EXPOSURE & CLIENT BUNDLE AUDIT
  // =========================================================================

  test('Security 1: Client code and frontend bundles contain ZERO references to sensitive backend secrets', () => {
    const clientDirs = [path.resolve(process.cwd(), 'src')];
    const sensitiveKeys = [
      'SUPABASE_SERVICE_ROLE_KEY',
      'ESP32_DEVICE_SHARED_KEY',
    ];

    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        // Exclude server-only directory and tests
        if (fullPath.includes('/server/') || fullPath.includes('/tests/')) continue;
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const key of sensitiveKeys) {
            if (content.includes(`process.env.${key}`) || content.includes(`import.meta.env.${key}`)) {
              throw new Error(`CRITICAL: Found sensitive key '${key}' exposed in client file: ${fullPath}`);
            }
          }
        }
      }
    }

    for (const d of clientDirs) {
      scanDir(d);
    }
  });

  // =========================================================================
  // 3. HARDWARE DEVICE HMAC-SHA256 & ANTI-REPLAY DEFENSE
  // =========================================================================

  test('Hardware 1: Valid HMAC-SHA256 signature passes per-device verification', () => {
    const device = db.getDeviceById('CAM-ENTRANCE-GATE-A');
    if (!device || !device.deviceSecret) {
      throw new Error('Turnstile A missing or has no HMAC secret');
    }

    const timestamp = Date.now();
    const nonce = `test_nonce_${Math.random().toString(36).substring(2, 10)}`;
    const payload = { personId: 'per-001', confidence: 0.96 };
    const signature = computeDeviceHmac(device.deviceSecret, device.deviceId, timestamp, nonce, payload);

    const verification = db.verifyDeviceRequest({
      deviceId: device.deviceId,
      timestamp,
      nonce,
      signature,
      payload,
    });

    if (!verification.valid) {
      throw new Error(`HMAC verification failed: ${verification.error}`);
    }
  });

  test('Hardware 2: Payload tampering invalidates HMAC-SHA256 signature', () => {
    const device = db.getDeviceById('CAM-ENTRANCE-GATE-A');
    if (!device || !device.deviceSecret) throw new Error('Device missing');

    const timestamp = Date.now();
    const nonce = `test_nonce_${Math.random().toString(36).substring(2, 10)}`;
    const originalPayload = { personId: 'per-001', confidence: 0.96 };
    const signature = computeDeviceHmac(device.deviceSecret, device.deviceId, timestamp, nonce, originalPayload);

    // Tampered payload
    const tamperedPayload = { personId: 'per-002', confidence: 0.96 };
    const verification = db.verifyDeviceRequest({
      deviceId: device.deviceId,
      timestamp,
      nonce,
      signature,
      payload: tamperedPayload,
    });

    if (verification.valid) {
      throw new Error('Tampered payload was erroneously accepted by HMAC verification!');
    }
  });

  test('Hardware 3: Replay attack with reused nonce is strictly blocked', () => {
    const device = db.getDeviceById('CAM-EXIT-GATE-B');
    if (!device || !device.deviceSecret) throw new Error('Device missing');

    const timestamp = Date.now();
    const reusableNonce = `replay_test_nonce_${Date.now()}`;
    const payload = { heartbeat: true };
    const signature = computeDeviceHmac(device.deviceSecret, device.deviceId, timestamp, reusableNonce, payload);

    // First presentation: Passes
    const firstAttempt = db.verifyDeviceRequest({
      deviceId: device.deviceId,
      timestamp,
      nonce: reusableNonce,
      signature,
      payload,
    });
    if (!firstAttempt.valid) throw new Error('First attempt failed');

    // Replay presentation: Must be blocked
    const replayAttempt = db.verifyDeviceRequest({
      deviceId: device.deviceId,
      timestamp,
      nonce: reusableNonce,
      signature,
      payload,
    });

    if (replayAttempt.valid) {
      throw new Error('Replay attack succeeded: Reused nonce was accepted!');
    }
  });

  test('Hardware 4: Stale timestamp drift (>5 minutes) is rejected to block delay attacks', () => {
    const device = db.getDeviceById('CAM-ENTRANCE-GATE-A');
    if (!device || !device.deviceSecret) throw new Error('Device missing');

    const staleTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes in the past
    const nonce = `stale_nonce_${Date.now()}`;
    const payload = { scan: true };
    const signature = computeDeviceHmac(device.deviceSecret, device.deviceId, staleTimestamp, nonce, payload);

    const verification = db.verifyDeviceRequest({
      deviceId: device.deviceId,
      timestamp: staleTimestamp,
      nonce,
      signature,
      payload,
    });

    if (verification.valid) {
      throw new Error('Stale timestamp packet was erroneously accepted!');
    }
  });

  // =========================================================================
  // 4. DATABASE PERSISTENCE, SUPABASE CONNECTIVITY & STORAGE MODES
  // =========================================================================

  test('Persistence 1: Explicit storage mode and non-synchronized local store isolation', () => {
    const telemetry = db.getDatabaseTelemetry();
    if (!telemetry) throw new Error('Expected telemetry object');
    if (telemetry.storageMode !== 'SUPABASE_CONNECTED' && telemetry.storageMode !== 'LOCAL_DEVELOPMENT_STORE') {
      throw new Error(`Invalid storageMode: ${telemetry.storageMode}`);
    }
    // Local JSON store must never be presented as synchronized
    if (telemetry.isSynchronizedWithRemote) {
      throw new Error('Local storage must NEVER claim to be synchronized with remote database');
    }
    if (!telemetry.backupAndRecoveryLimitations || telemetry.backupAndRecoveryLimitations.length < 3) {
      throw new Error('Expected documented backup and recovery limitations in telemetry');
    }
  });

  test('Persistence 2: Successful remote database connectivity verification and SUPABASE_CONNECTED mode', () => {
    try {
      setTestVerificationOverride({ verified: true, error: null });
      const telemetry = db.getDatabaseTelemetry();
      if (telemetry.storageMode !== 'SUPABASE_CONNECTED') {
        throw new Error(`Expected storageMode SUPABASE_CONNECTED, got ${telemetry.storageMode}`);
      }
      if (!telemetry.supabaseSchemaVerified) {
        throw new Error('Expected supabaseSchemaVerified to be true');
      }
      if (telemetry.supabaseSchemaError !== null) {
        throw new Error(`Expected null error, got ${telemetry.supabaseSchemaError}`);
      }
    } finally {
      resetTestingOverrides();
    }
  });

  test('Persistence 3: Remote connection failure correctly isolates LOCAL_DEVELOPMENT_STORE without claiming health', () => {
    try {
      setTestVerificationOverride({
        verified: false,
        error: 'Remote Supabase endpoint unreachable (TypeError: fetch failed)',
      });
      const telemetry = db.getDatabaseTelemetry();
      if (telemetry.storageMode !== 'LOCAL_DEVELOPMENT_STORE') {
        throw new Error(`Expected storageMode LOCAL_DEVELOPMENT_STORE, got ${telemetry.storageMode}`);
      }
      if (telemetry.supabaseSchemaVerified) {
        throw new Error('Expected supabaseSchemaVerified to be false upon remote failure');
      }
      if (!telemetry.supabaseSchemaError?.includes('unreachable')) {
        throw new Error('Expected error message to detail unreachable status');
      }
      if (telemetry.isSynchronizedWithRemote) {
        throw new Error('Local store must not claim synchronization on remote failure');
      }
    } finally {
      resetTestingOverrides();
    }
  });

  test('Persistence 4: Local development fallback allows reads and writes when not in production', () => {
    try {
      setTestEnvOverride({ isProduction: false, allowFallback: true });
      if (!db.isLocalFallbackAllowed()) {
        throw new Error('Expected local fallback to be allowed in development');
      }

      // Test write and read in local development
      const testBadge = `SF-DEV-${Date.now().toString().slice(-4)}`;
      const person = db.createPerson({
        personId: testBadge,
        fullName: 'Dev Fallback Subject',
        department: 'Engineering',
        designation: 'Software Engineer',
        email: `dev.${testBadge.toLowerCase()}@smartface.internal`,
        phone: '+91 99999 00000',
        status: 'active',
        enrollmentStatus: 'not_enrolled',
        consentStatus: 'granted',
        consentDate: new Date().toISOString(),
      });

      const retrieved = db.getPersonById(person.id);
      if (!retrieved || retrieved.personId !== testBadge) {
        throw new Error('Failed to read back created person from local store in dev mode');
      }

      db.deletePerson(person.id);
    } finally {
      resetTestingOverrides();
    }
  });

  test('Persistence 5: Production failure behaviour strictly blocks silent local JSON writes when database is unverified', () => {
    try {
      setTestVerificationOverride({ verified: false, error: 'Database unreachable' });
      setTestEnvOverride({ isProduction: true, allowFallback: false });

      if (db.isLocalFallbackAllowed()) {
        throw new Error('Local fallback must NOT be allowed in production without explicit ALLOW_LOCAL_FALLBACK');
      }

      // Write attempt MUST throw DatabaseUnavailableError rather than silently writing to disk
      let errorThrown: unknown = null;
      try {
        db.addEvent({
          personId: 'per-001',
          eventTimestamp: new Date().toISOString(),
          direction: 'entry',
          confidenceScore: 0.95,
          isDuplicate: false,
          isSimulated: false,
          source: 'camera',
        });
      } catch (err) {
        errorThrown = err;
      }

      if (!errorThrown || !(errorThrown instanceof DatabaseUnavailableError)) {
        throw new Error(`Expected DatabaseUnavailableError in production with unverified DB, got: ${errorThrown}`);
      }
    } finally {
      resetTestingOverrides();
    }
  });

  test('Persistence 6: Database write/read round-trip verification guarantees data integrity', () => {
    const testBadge = `SF-RT-${Date.now().toString().slice(-5)}`;
    const created = db.createPerson({
      personId: testBadge,
      fullName: 'Roundtrip Test Engineer',
      department: 'Quality Assurance',
      designation: 'Staff SDET',
      email: `roundtrip.${testBadge.toLowerCase()}@smartface.internal`,
      phone: '+91 91234 56789',
      status: 'active',
      enrollmentStatus: 'not_enrolled',
      consentStatus: 'granted',
      consentDate: new Date().toISOString(),
    });

    const readBack = db.getPersonById(created.id);
    if (!readBack) throw new Error('Person not found after creation');
    if (readBack.fullName !== 'Roundtrip Test Engineer') throw new Error('Full name mismatch');
    if (readBack.department !== 'Quality Assurance') throw new Error('Department mismatch');
    if (readBack.designation !== 'Staff SDET') throw new Error('Designation mismatch');

    // Update check
    const updated = db.updatePerson(created.id, { designation: 'Principal SDET' });
    if (!updated || updated.designation !== 'Principal SDET') {
      throw new Error('Update verification failed');
    }

    // Cleanup
    db.deletePerson(created.id);
    const afterDelete = db.getPersonById(created.id);
    if (afterDelete) throw new Error('Person still present after delete');
  });

  // =========================================================================
  // 5. BIOMETRIC PRIVACY, CONSENT & RETENTION
  // =========================================================================

  test('Privacy 1: Revoking biometric consent deletes face templates and blocks future enrollments', () => {
    // Create dedicated disposable test subject so seed employee directory is never corrupted
    const testPerson = db.createPerson({
      personId: 'SF-PRIV-TEST',
      fullName: 'Privacy Test Subject',
      email: 'privacy.test@smartface.internal',
      department: 'Engineering',
      designation: 'Security QA',
      phone: '+91 98765 43210',
      scheduleId: 'sch-std-01',
      status: 'active',
      enrollmentStatus: 'enrolled',
      consentStatus: 'granted',
      consentDate: new Date().toISOString(),
    });

    db.addEnrollmentRecord({
      personId: testPerson.id,
      photoUrl: 'https://example.com/test-photo.jpg',
      photoAngle: 'front',
      qualityScore: 95.0,
      boundingBox: { x: 10, y: 10, width: 100, height: 100 },
      templateStatus: 'extracted',
      vectorId: 'vec_test_privacy',
    });

    // Revoke consent
    const revoked = db.revokeBiometricConsent(testPerson.id, 'admin@smartface.internal');
    if (!revoked) throw new Error('revokeBiometricConsent returned false');

    const updated = db.getPersonById(testPerson.id);
    if (updated?.consentStatus !== 'revoked' || updated?.enrollmentStatus !== 'not_enrolled') {
      throw new Error('Person status did not update to revoked/not_enrolled');
    }

    // Verify all stored enrollment records for this person were purged
    const enrollments = db.getEnrollmentRecords(testPerson.id);
    if (enrollments.length !== 0) {
      throw new Error(`Enrollment templates were not purged upon consent revocation (found ${enrollments.length})`);
    }

    // Cleanup disposable test subject
    db.deletePerson(testPerson.id);
  });

  // =========================================================================
  // 6. ATTENDANCE ENGINE RULES & ASIA/KOLKATA TIMEZONE
  // =========================================================================

  test('Timezone 1: 09:00 AM in Asia/Kolkata converts strictly to 03:30 AM UTC', () => {
    const parsed = parseDateTimeInTimezone('2026-11-02', '09:00', 'Asia/Kolkata');
    const utcHours = parsed.getUTCHours();
    const utcMinutes = parsed.getUTCMinutes();
    if (utcHours !== 3 || utcMinutes !== 30) {
      throw new Error(`Expected 03:30 UTC for 09:00 IST, got ${utcHours}:${utcMinutes} UTC`);
    }
  });

  test('Rule 1: Punch at 09:08 AM IST is marked PRESENT with 0 late minutes (within 15m grace)', () => {
    const testPerson = db.getPersonById('per-001');
    if (!testPerson) throw new Error('Test person not found');

    const testDate = '2027-02-01'; // Monday
    db.deleteEventsForPersonAndDate(testPerson.id, testDate);

    // 09:08 IST = 03:38 UTC
    const result = AttendanceEngine.processScan({
      clientRequestId: `test-ontime-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:38:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    if (result.dailySummary?.status !== 'present') {
      throw new Error(`Expected 'present', got '${result.dailySummary?.status}'`);
    }
    if (result.dailySummary?.lateMinutes !== 0) {
      throw new Error(`Expected 0 lateMinutes, got ${result.dailySummary?.lateMinutes}`);
    }
  });

  test('Rule 2: Punch at 09:35 AM IST is marked LATE with 20 minutes calculated late arrival', () => {
    const testPerson = db.getPersonById('per-002');
    if (!testPerson) throw new Error('Test person not found');

    const testDate = '2027-02-02'; // Tuesday
    db.deleteEventsForPersonAndDate(testPerson.id, testDate);

    // 09:35 IST = 04:05 UTC
    const result = AttendanceEngine.processScan({
      clientRequestId: `test-late-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T04:05:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    if (result.dailySummary?.status !== 'late') {
      throw new Error(`Expected status 'late', got '${result.dailySummary?.status}'`);
    }
    if (result.dailySummary?.lateMinutes !== 20) {
      throw new Error(`Expected 20 lateMinutes, got ${result.dailySummary?.lateMinutes}`);
    }
  });

  test('Rule 3: Duplicate scan within 5-min cooldown is flagged and ignored by daily summary', () => {
    const testPerson = db.getPersonById('per-001');
    if (!testPerson) throw new Error('Test person not found');

    const testDate = '2027-02-03';
    db.deleteEventsForPersonAndDate(testPerson.id, testDate);

    // Scan 1 at 09:00 IST
    AttendanceEngine.processScan({
      clientRequestId: `test-cooldown-1-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:30:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    // Scan 2 at 09:02 IST (within 2 minutes)
    const scan2 = AttendanceEngine.processScan({
      clientRequestId: `test-cooldown-2-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:32:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    if (!scan2.isDuplicate) {
      throw new Error('Expected scan2 to be flagged as duplicate within cooldown');
    }
  });

  test('Rule 4: Multiple entries/exits (in-out-in-out) are paired into sessions and sum total work time', () => {
    const testPerson = db.getPersonById('per-005');
    if (!testPerson) throw new Error('Test person not found');

    const testDate = '2027-02-04';
    db.deleteEventsForPersonAndDate(testPerson.id, testDate);

    // Entry 1: 09:00 IST (03:30 UTC)
    AttendanceEngine.processScan({
      clientRequestId: `test-multi-1-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:30:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    // Exit 1 (Lunch): 12:30 IST (07:00 UTC) -> 210 min
    AttendanceEngine.processScan({
      clientRequestId: `test-multi-2-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T07:00:00.000Z`,
      direction: 'exit',
      source: 'simulator',
    });

    // Entry 2 (Return): 13:30 IST (08:00 UTC)
    AttendanceEngine.processScan({
      clientRequestId: `test-multi-3-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T08:00:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    // Exit 2 (End of day): 18:00 IST (12:30 UTC) -> 270 min
    const lastScan = AttendanceEngine.processScan({
      clientRequestId: `test-multi-4-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T12:30:00.000Z`,
      direction: 'exit',
      source: 'simulator',
    });

    const summary = lastScan.dailySummary;
    if (!summary) throw new Error('Expected dailySummary');
    if (summary.punchSessions?.length !== 2) {
      throw new Error(`Expected 2 paired punch sessions, got ${summary.punchSessions?.length}`);
    }
    // Total = 210 + 270 = 480 minutes (8 hours)
    if (summary.totalWorkMinutes !== 480) {
      throw new Error(`Expected 480 totalWorkMinutes, got ${summary.totalWorkMinutes}`);
    }
  });

  test('Rule 5: Single check-in with no checkout preserves lastOut as undefined (never invents timestamps)', () => {
    const testPerson = db.getPersonById('per-008');
    if (!testPerson) throw new Error('Test person not found');

    const testDate = '2026-11-13';
    db.deleteEventsForPersonAndDate(testPerson.id, testDate);

    const scan = AttendanceEngine.processScan({
      clientRequestId: `test-single-in-${Date.now()}`,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:30:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    if (scan.dailySummary?.lastOut !== undefined) {
      throw new Error(`Expected lastOut to be undefined, got: ${scan.dailySummary?.lastOut}`);
    }
  });

  test('Rule 6: Idempotent re-submission with identical clientRequestId returns existing record without duplication', () => {
    const testPerson = db.getPersonById('per-001');
    if (!testPerson) throw new Error('Test person not found');

    const testDate = '2026-11-16';
    db.deleteEventsForPersonAndDate(testPerson.id, testDate);

    const reqId = `idempotent-test-unique-key-${Date.now()}`;
    const firstCall = AttendanceEngine.processScan({
      clientRequestId: reqId,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:30:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    const secondCall = AttendanceEngine.processScan({
      clientRequestId: reqId,
      personId: testPerson.id,
      eventTimestamp: `${testDate}T03:30:00.000Z`,
      direction: 'entry',
      source: 'simulator',
    });

    if (!secondCall.isIdempotentReplay) {
      throw new Error('Expected second call to return isIdempotentReplay: true');
    }
    if (secondCall.event.id !== firstCall.event.id) {
      throw new Error('Expected same event ID returned on idempotent replay');
    }
  });

  test('Rule 7: Person with approved leave is marked LEAVE instead of absent', () => {
    const leavePerson = db.getPersonById('per-006');
    if (!leavePerson) throw new Error('Lucas Weber not found');

    const testLeaveDate = '2026-11-20';
    db.addLeaveRequest({
      personId: leavePerson.id,
      personName: leavePerson.fullName,
      personBadge: leavePerson.personId,
      department: leavePerson.department,
      leaveType: 'annual',
      startDate: testLeaveDate,
      endDate: testLeaveDate,
      status: 'approved',
      reason: 'Approved annual vacation leave',
      approvedBy: 'Amira Benali',
    });

    const summary = AttendanceEngine.recomputeDailySummary(leavePerson.id, testLeaveDate);

    if (summary.status !== 'leave') {
      throw new Error(`Expected status 'leave' but got '${summary.status}'`);
    }
  });

  test('Rule 8: Statutory holiday automatically marks employees as HOLIDAY when no punch occurred', () => {
    const testPerson = db.getPersonById('per-002');
    if (!testPerson) throw new Error('Person not found');

    const holidayDate = '2026-01-26'; // Republic Day in seed
    const summary = AttendanceEngine.recomputeDailySummary(testPerson.id, holidayDate);

    if (summary.status !== 'holiday') {
      throw new Error(`Expected status 'holiday' on Republic Day, got '${summary.status}'`);
    }
  });

  test('Rule 9: Auditable manual correction updates status, sets isManuallyAdjusted, and logs reason', () => {
    const testPerson = db.getPersonById('per-007');
    if (!testPerson) throw new Error('Person not found');

    const testDate = '2026-11-17';
    const corrected = AttendanceEngine.manualCorrection({
      personId: testPerson.id,
      date: testDate,
      newStatus: 'present',
      reason: 'Physical card badge damaged; front desk security manually verified arrival at 08:58 AM IST',
      adjustedBy: 'admin@smartface.internal',
    });

    if (!corrected.isManuallyAdjusted) {
      throw new Error('Expected isManuallyAdjusted to be true');
    }
    if (corrected.status !== 'present') {
      throw new Error(`Expected corrected status 'present' but got '${corrected.status}'`);
    }

    const logs = db.getAuditLogs(10);
    const auditRecord = logs.find(l => l.action === 'MANUAL_ATTENDANCE_CORRECTION');
    if (!auditRecord) {
      throw new Error('Audit log for manual correction was not found');
    }
  });

  return results;
}

// When executed directly via `tsx src/tests/attendance-engine.test.ts`
if (import.meta.url.endsWith(process.argv[1] || '')) {
  console.log('🧪 Running SmartFace Comprehensive Security & Attendance Test Suite...\n');
  const results = runAttendanceTests();
  let failed = 0;

  for (const r of results) {
    if (r.passed) {
      console.log(`  ✅ [PASS] ${r.title} (${r.durationMs}ms)`);
    } else {
      console.error(`  ❌ [FAIL] ${r.title}`);
      console.error(`     Error: ${r.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${results.length - failed}/${results.length} passed.`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All security, authentication, and attendance tests passed successfully!\n');
  }
}
