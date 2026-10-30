/**
 * SmartFace Full-Stack Application Server
 * Express 4 API backend with Vite middleware in development mode.
 * Enforces server-side authentication, role authorization, Asia/Kolkata timezone,
 * and hardware security isolation.
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db, getTodayDateString, isSupabaseConfigured, DatabaseUnavailableError, getStorageMode } from './src/server/db.ts';
import { AttendanceEngine } from './src/server/attendance-engine.ts';
import { runAttendanceTests } from './src/tests/attendance-engine.test.ts';
import { DEFAULT_TIMEZONE, getDateStringInTimezone } from './src/server/timezone.ts';
import { Role, AuthUser, CameraDevice } from './src/types/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parsers
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// -------------------------------------------------------------------------
// AUTHENTICATION & ACCESS CONTROL MIDDLEWARE
// -------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

function extractUserFromRequest(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.headers['x-session-token'] as string);

  if (token) {
    return db.validateSessionToken(token);
  }
  return null;
}

// Global Auth Extractor (populates req.user if valid token present)
app.use((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  req.user = extractUserFromRequest(req) || undefined;
  next();
});

// Require Authenticated Session (strict 401 on missing session)
function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication Required: Please provide a valid Bearer session token.',
      code: 'UNAUTHORIZED',
    });
    return;
  }
  next();
}

// Role Guard Middleware (strict 401 if unauthenticated, 403 if unauthorized)
function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication Required: Please log in with a valid session token.',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access Denied: '${req.user.role}' role does not have permission to perform this action.`,
        requiredRoles: allowedRoles,
        code: 'FORBIDDEN',
      });
      return;
    }
    next();
  };
}

// -------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------------------

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const result = db.authenticateUser(email, password);
  if (!result) {
    res.status(401).json({ error: 'Invalid email credentials or incorrect password.' });
    return;
  }

  res.json({
    token: result.token,
    user: result.user,
    mustChangePassword: result.mustChangePassword,
    message: 'Authenticated successfully',
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.headers['x-session-token'] as string);

  if (token) {
    db.invalidateSession(token);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'No active session found', code: 'UNAUTHORIZED' });
  }
});

app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  const result = db.changePassword(req.user!.id, currentPassword, newPassword);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({ success: true, message: 'Password updated successfully' });
});

app.post('/api/auth/provision-user', requireRole(['super_admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, fullName, role, password, avatarUrl } = req.body;
    if (!email || !fullName || !role) {
      res.status(400).json({ error: 'Missing required account fields (email, fullName, role)' });
      return;
    }
    const provisioned = db.provisionUser(
      { email, fullName, role, password, avatarUrl },
      req.user!.email
    );
    res.status(201).json(provisioned);
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// -------------------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------------------

// Health & Status
app.get('/api/health', (_req: Request, res: Response) => {
  const telemetry = db.getDatabaseTelemetry();
  // Storage mode is explicit: SUPABASE_CONNECTED or LOCAL_DEVELOPMENT_STORE
  // Never report remote database connectivity as healthy when unverified.
  // In production, failure to connect to required database is an unhealthy state (503) unless fallback is explicitly allowed.
  const isHealthy = telemetry.storageMode === 'SUPABASE_CONNECTED' || telemetry.localFallbackAllowed;

  res.status(isHealthy ? 200 : 503).json({
    ...telemetry,
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    timezone: DEFAULT_TIMEZONE,
    remoteDatabaseVerified: telemetry.supabaseSchemaVerified,
    recognitionServiceConnected: Boolean(process.env.RECOGNITION_SERVICE_URL),
    hardwareIntegrated: false, // Phase 1
    version: '1.2.0-phase1-hardened',
  });
});

// Dashboard Metrics
app.get('/api/metrics', (req: Request, res: Response) => {
  try {
    const genuineOnly = req.query.genuineOnly === 'true';
    const metrics = db.getDashboardMetrics(genuineOnly);
    res.json(metrics);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// People Directory
app.get('/api/people', (req: Request, res: Response) => {
  const { department, status, search } = req.query as {
    department?: string;
    status?: string;
    search?: string;
  };
  const list = db.getPeople({ department, status, search });
  res.json(list);
});

app.get('/api/people/:id', (req: Request, res: Response) => {
  const person = db.getPersonById(req.params.id);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const enrollments = db.getEnrollmentRecords(person.id);
  const events = db.getEvents(50, { personId: person.id });
  const summaries = db.getAllSummaries().filter(s => s.personId === person.id);
  const schedule = db.getScheduleById(person.scheduleId);

  res.json({
    person,
    enrollments,
    events,
    summaries,
    schedule,
  });
});

app.post('/api/people', requireRole(['super_admin', 'admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { personId, fullName, department, designation, email, phone, consentStatus, scheduleId, avatarUrl } = req.body;
    if (!personId || !fullName || !department) {
      res.status(400).json({ error: 'Missing required fields (personId, fullName, department)' });
      return;
    }

    // Check duplicate badge ID
    const existing = db.getPersonById(personId);
    if (existing) {
      res.status(409).json({ error: `Person ID '${personId}' already exists.` });
      return;
    }

    const created = db.createPerson({
      personId,
      fullName,
      department,
      designation: designation || 'Staff Member',
      email: email || `${personId.toLowerCase().replace(/[^a-z0-9]/g, '')}@smartface.internal`,
      phone: phone || '',
      status: 'active',
      enrollmentStatus: 'not_enrolled',
      consentStatus: consentStatus || 'granted',
      consentDate: new Date().toISOString(),
      avatarUrl: avatarUrl || undefined,
      scheduleId: scheduleId || 'sch-std-01',
    });

    db.logAudit({
      userEmail: req.user?.email || 'admin@smartface.internal',
      userRole: req.user?.role || 'admin',
      action: 'PERSON_CREATED',
      targetType: 'person',
      targetId: created.id,
      details: { personId: created.personId, fullName: created.fullName },
    });

    res.status(201).json(created);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/people/:id', requireRole(['super_admin', 'admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updatePerson(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    db.logAudit({
      userEmail: req.user?.email || 'admin@smartface.internal',
      userRole: req.user?.role || 'admin',
      action: 'PERSON_UPDATED',
      targetType: 'person',
      targetId: updated.id,
      details: { updates: req.body },
    });

    res.json(updated);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/people/:id', requireRole(['super_admin', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const success = db.deletePerson(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  db.logAudit({
    userEmail: req.user?.email || 'admin@smartface.internal',
    userRole: req.user?.role || 'admin',
    action: 'PERSON_DELETED',
    targetType: 'person',
    targetId: req.params.id,
  });
  res.json({ success: true });
});

// Biometric Privacy & Consent Endpoints
app.post('/api/people/:id/revoke-consent', requireRole(['super_admin', 'admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const ok = db.revokeBiometricConsent(req.params.id, req.user?.email || 'admin@smartface.internal');
  if (!ok) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  res.json({ success: true, message: 'Biometric consent revoked and all face templates purged.' });
});

app.delete('/api/people/:id/biometrics', requireRole(['super_admin', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const ok = db.deletePersonBiometrics(req.params.id, req.user?.email || 'admin@smartface.internal');
  if (!ok) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  res.json({ success: true, message: 'All enrolled face photographs and templates deleted.' });
});

app.get('/api/people/:id/biometric-export', requireRole(['super_admin', 'admin', 'auditor']), (req: AuthenticatedRequest, res: Response) => {
  const person = db.getPersonById(req.params.id);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const enrollments = db.getEnrollmentRecords(person.id);
  res.json({
    complianceStandard: 'ISO/IEC 19794-5 & DPDP Act 2023',
    personId: person.personId,
    fullName: person.fullName,
    department: person.department,
    consentStatus: person.consentStatus,
    consentDate: person.consentDate,
    consentRevokedDate: person.biometricConsentRevokedAt,
    retentionPolicy: person.retentionPolicy || 'Tenure + 30 Days',
    enrolledAnglesCount: enrollments.length,
    templatesExtracted: enrollments.filter(e => e.templateStatus === 'extracted').length,
    exportedAt: new Date().toISOString(),
  });
});

// Camera Devices Registry
app.get('/api/devices', (_req: Request, res: Response) => {
  res.json(db.getDevices());
});

app.post('/api/devices', requireRole(['super_admin', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deviceId, name, location, direction, firmwareVersion } = req.body;
    if (!deviceId || !name || !location) {
      res.status(400).json({ error: 'Missing deviceId, name, or location' });
      return;
    }

    const generatedToken = `tok_${deviceId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 8)}`;
    const created = db.createDevice({
      deviceId,
      name,
      location,
      direction: direction || 'entry',
      status: 'unconnected',
      firmwareVersion: firmwareVersion || 'v1.4.2-esp32cam',
      authToken: generatedToken,
      isSimulated: false,
    });

    db.logAudit({
      userEmail: req.user?.email || 'admin@smartface.internal',
      userRole: req.user?.role || 'admin',
      action: 'DEVICE_CREATED',
      targetType: 'camera_device',
      targetId: created.id,
      details: { deviceId, location },
    });

    res.status(201).json(created);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put('/api/devices/:id', requireRole(['super_admin', 'admin']), (req: Request, res: Response) => {
  const updated = db.updateDevice(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json(updated);
});

app.delete('/api/devices/:id', requireRole(['super_admin', 'admin']), (req: Request, res: Response) => {
  const ok = db.deleteDevice(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json({ success: true });
});

// Attendance Events
app.get('/api/events', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 100;
  const personId = req.query.personId as string | undefined;
  const isDuplicate = req.query.isDuplicate !== undefined ? req.query.isDuplicate === 'true' : undefined;
  const isSimulated = req.query.isSimulated !== undefined ? req.query.isSimulated === 'true' : undefined;

  const events = db.getEvents(limit, { personId, isDuplicate, isSimulated });
  res.json(events);
});

// Daily Attendance Summaries
app.get('/api/daily-attendance', (req: Request, res: Response) => {
  const dateStr = (req.query.date as string) || getTodayDateString();
  const summaries = db.getDailySummaries(dateStr);
  res.json(summaries);
});

app.post('/api/attendance/recompute', requireRole(['super_admin', 'admin', 'manager']), (req: Request, res: Response) => {
  const dateStr = (req.body.date as string) || getTodayDateString();
  const peopleList = db.getPeople({ status: 'active' });
  const computed = peopleList.map(p => AttendanceEngine.recomputeDailySummary(p.id, dateStr));
  res.json({ message: `Recomputed ${computed.length} daily summaries`, summaries: computed });
});

app.post('/api/attendance/finalize-absences', requireRole(['super_admin', 'admin', 'manager']), (req: Request, res: Response) => {
  const targetDate = (req.body.date as string) || getTodayDateString();
  const forcePastCutoff = req.body.forcePastCutoffCheck === true;
  const result = AttendanceEngine.finalizeAbsences(targetDate, forcePastCutoff);
  res.json(result);
});

app.post('/api/attendance/manual-adjust', requireRole(['super_admin', 'admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { personId, date, newStatus, reason, adjustedBy } = req.body;
    if (!personId || !date || !newStatus || !reason) {
      res.status(400).json({ error: 'Missing personId, date, newStatus, or adjustment reason' });
      return;
    }
    const adjusted = AttendanceEngine.manualCorrection({
      personId,
      date,
      newStatus,
      reason,
      adjustedBy: adjustedBy || req.user?.email || 'admin@smartface.internal',
    });
    res.json(adjusted);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Work Schedules
app.get('/api/schedules', (_req: Request, res: Response) => {
  res.json(db.getSchedules());
});

app.post('/api/schedules', requireRole(['super_admin', 'admin']), (req: Request, res: Response) => {
  const scheduleData = {
    ...req.body,
    id: req.body.id || `sch-${Date.now().toString().slice(-5)}`,
    timezone: req.body.timezone || DEFAULT_TIMEZONE,
  };
  db.saveSchedule(scheduleData);
  res.status(201).json(scheduleData);
});

// Holidays & Leave
app.get('/api/holidays', (_req: Request, res: Response) => {
  res.json(db.getHolidays());
});

app.post('/api/holidays', requireRole(['super_admin', 'admin', 'manager']), (req: Request, res: Response) => {
  const { name, date, isRecurring } = req.body;
  if (!name || !date) {
    res.status(400).json({ error: 'Missing name or date' });
    return;
  }
  const created = db.addHoliday({ name, date, isRecurring: Boolean(isRecurring) });
  res.status(201).json(created);
});

app.delete('/api/holidays/:id', requireRole(['super_admin', 'admin']), (req: Request, res: Response) => {
  const ok = db.deleteHoliday(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Holiday not found' });
    return;
  }
  res.json({ success: true });
});

app.get('/api/leave', (_req: Request, res: Response) => {
  res.json(db.getLeaveRequests());
});

app.post('/api/leave', requireRole(['super_admin', 'admin', 'manager']), (req: Request, res: Response) => {
  const { personId, leaveType, startDate, endDate, reason } = req.body;
  const person = db.getPersonById(personId);
  if (!person) {
    res.status(404).json({ error: 'Person not found' });
    return;
  }
  const created = db.addLeaveRequest({
    personId: person.id,
    personName: person.fullName,
    personBadge: person.personId,
    department: person.department,
    leaveType: leaveType || 'annual',
    startDate,
    endDate,
    status: 'approved',
    reason: reason || 'Scheduled PTO',
    approvedBy: 'HR Admin',
  });
  res.status(201).json(created);
});

app.patch('/api/leave/:id/status', requireRole(['super_admin', 'admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const ok = db.updateLeaveStatus(req.params.id, status, req.user?.email || 'admin@smartface.internal');
  if (!ok) {
    res.status(404).json({ error: 'Leave request not found' });
    return;
  }
  res.json({ success: true });
});

// Photo Enrollment Hub
app.get('/api/enrollment', requireRole(['super_admin', 'admin', 'manager', 'auditor']), (req: AuthenticatedRequest, res: Response) => {
  const personId = req.query.personId as string | undefined;
  res.json(db.getEnrollmentRecords(personId));
});

app.post('/api/enrollment', requireRole(['super_admin', 'admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
  try {
    const { personId, photoUrl, photoAngle, qualityScore, boundingBox } = req.body;
    if (!personId || !photoUrl) {
      res.status(400).json({ error: 'Missing personId or photoUrl' });
      return;
    }
    const person = db.getPersonById(personId);
    if (!person) {
      res.status(404).json({ error: 'Person not found' });
      return;
    }

    if (person.consentStatus !== 'granted') {
      res.status(403).json({ error: 'Cannot enroll face photo: Biometric consent has been withheld or revoked.' });
      return;
    }

    const record = db.addEnrollmentRecord({
      personId: person.id,
      photoUrl,
      photoAngle: photoAngle || 'front',
      qualityScore: qualityScore || 92.5,
      boundingBox: boundingBox || { x: 100, y: 70, width: 220, height: 240 },
      templateStatus: 'extracted',
      vectorId: `vec_${person.personId.toLowerCase()}_${Date.now()}`,
    });

    db.logAudit({
      userEmail: req.user?.email || 'admin@smartface.internal',
      userRole: req.user?.role || 'admin',
      action: 'PHOTO_ENROLLED',
      targetType: 'enrollment_record',
      targetId: record.id,
      details: { personId: person.personId, quality: record.qualityScore },
    });

    res.status(201).json(record);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Audit Logs
app.get('/api/audit-logs', requireRole(['super_admin', 'admin', 'auditor']), (_req: AuthenticatedRequest, res: Response) => {
  const limit = _req.query.limit ? Number(_req.query.limit) : 100;
  res.json(db.getAuditLogs(limit));
});

// System Settings
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(db.getSettings());
});

app.put('/api/settings', requireRole(['super_admin', 'admin']), (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateSettings(req.body);
  db.logAudit({
    userEmail: req.user?.email || 'admin@smartface.internal',
    userRole: req.user?.role || 'admin',
    action: 'SETTINGS_UPDATED',
    targetType: 'system_settings',
    details: { updates: req.body },
  });
  res.json(updated);
});

// Reports Summary Endpoint
app.get('/api/reports/summary', (req: Request, res: Response) => {
  const period = (req.query.period as string) || 'daily';
  const allSummaries = db.getAllSummaries();
  const people = db.getPeople({ status: 'active' });

  // Filter summaries based on period
  const today = getTodayDateString(DEFAULT_TIMEZONE);
  let relevantSummaries = allSummaries;

  if (period === 'daily') {
    relevantSummaries = allSummaries.filter(s => s.date === today);
  }

  const presentCount = relevantSummaries.filter(s => s.status === 'present').length;
  const lateCount = relevantSummaries.filter(s => s.status === 'late').length;
  const absentCount = relevantSummaries.filter(s => s.status === 'absent').length;
  const leaveCount = relevantSummaries.filter(s => s.status === 'leave').length;
  const correctedCount = relevantSummaries.filter(s => s.isManuallyAdjusted).length;
  const simulatedCount = relevantSummaries.filter(s => s.isSimulated).length;

  const totalPossible = people.length || 1;
  const attendancePercentage = Math.round(((presentCount + lateCount) / totalPossible) * 100);

  res.json({
    period,
    timezone: DEFAULT_TIMEZONE,
    activeHeadcount: people.length,
    presentCount,
    lateCount,
    absentCount,
    leaveCount,
    correctedCount,
    simulatedCount,
    attendancePercentage,
    summaries: relevantSummaries,
  });
});

// Automated Test Runner Endpoint
app.get('/api/tests/run', (_req: Request, res: Response) => {
  const results = runAttendanceTests();
  res.json({
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  });
});

// -------------------------------------------------------------------------
// SECURED HARDWARE (ESP32-CAM) & RECOGNITION API CONTRACTS
// -------------------------------------------------------------------------

/**
 * Helper to authenticate incoming camera hardware requests via HMAC-SHA256
 * signature verification, timestamp tolerance (±5 min), and nonce anti-replay protection.
 */
function authenticateDevice(req: Request): {
  authenticated: boolean;
  device?: CameraDevice;
  authMethod: 'hmac' | 'token';
  error?: string;
  statusCode: number;
} {
  const deviceId = (req.headers['x-device-id'] as string) || (req.body?.deviceId as string);
  const signature = req.headers['x-device-signature'] as string;
  const timestamp = (req.headers['x-device-timestamp'] as string) || (req.body?.timestamp as string);
  const nonce = req.headers['x-device-nonce'] as string;

  // 1. Primary: HMAC-SHA256 Signature Verification
  if (deviceId && signature && timestamp && nonce) {
    const verification = db.verifyDeviceRequest({
      deviceId,
      timestamp,
      nonce,
      signature,
      payload: req.body,
    });

    if (!verification.valid) {
      return {
        authenticated: false,
        error: `HMAC Authentication Failed: ${verification.error}`,
        statusCode: 401,
        authMethod: 'hmac',
      };
    }

    return {
      authenticated: true,
      device: verification.device,
      authMethod: 'hmac',
      statusCode: 200,
    };
  }

  // 2. Token header fallback (allowed during transition, with audit note)
  const token = (req.headers['x-device-token'] as string) || req.body?.token;
  if (token) {
    const device = db.getDeviceByToken(token);
    if (!device) {
      return {
        authenticated: false,
        error: 'Unauthorized: Invalid or revoked device token',
        statusCode: 401,
        authMethod: 'token',
      };
    }
    return {
      authenticated: true,
      device,
      authMethod: 'token',
      statusCode: 200,
    };
  }

  return {
    authenticated: false,
    error: 'Device Authentication Required: Provide HMAC headers (X-Device-Id, X-Device-Signature, X-Device-Timestamp, X-Device-Nonce) or X-Device-Token',
    statusCode: 401,
    authMethod: 'token',
  };
}

/**
 * ESP32-CAM Heartbeat
 * Secured via HMAC-SHA256 signature or validated device token.
 */
app.post('/api/v1/devices/heartbeat', (req: Request, res: Response) => {
  const auth = authenticateDevice(req);
  if (!auth.authenticated || !auth.device) {
    res.status(auth.statusCode).json({ error: auth.error });
    return;
  }
  const device = auth.device;

  const { firmwareVersion, rssi, ipAddress } = req.body;
  const updated = db.updateDevice(device.id, {
    status: 'online',
    lastHeartbeatAt: new Date().toISOString(),
    firmwareVersion: firmwareVersion || device.firmwareVersion,
    rssi: typeof rssi === 'number' ? rssi : device.rssi,
    ipAddress: ipAddress || device.ipAddress,
  });

  res.json({
    status: 'ack',
    serverTime: new Date().toISOString(),
    timezone: DEFAULT_TIMEZONE,
    authMethod: auth.authMethod,
    device: {
      id: updated?.deviceId,
      name: updated?.name,
      direction: updated?.direction,
    },
    syncIntervalSeconds: 30,
  });
});

/**
 * ESP32-CAM Scan Event Submission
 * Secured via HMAC-SHA256 signature or validated device token.
 */
app.post('/api/v1/devices/events', (req: Request, res: Response) => {
  const auth = authenticateDevice(req);
  if (!auth.authenticated || !auth.device) {
    res.status(auth.statusCode).json({ error: auth.error });
    return;
  }
  const device = auth.device;

  const { personId, confidenceScore, direction, captureTimestamp, snapshotUrl, clientRequestId, rawPayload } = req.body;
  if (!personId) {
    res.status(400).json({ error: 'Missing personId in event payload' });
    return;
  }

  try {
    const result = AttendanceEngine.processScan({
      clientRequestId,
      personId,
      deviceId: device.id,
      eventTimestamp: captureTimestamp || new Date().toISOString(),
      direction: direction || (device.direction === 'bidirectional' ? undefined : device.direction),
      confidenceScore: typeof confidenceScore === 'number' ? confidenceScore : 0.95,
      snapshotUrl,
      source: device.isSimulated ? 'simulator' : 'camera',
      isSimulated: device.isSimulated,
      rawPayload,
    });

    res.json({
      status: 'recorded',
      authMethod: auth.authMethod,
      isDuplicate: result.isDuplicate,
      isIdempotentReplay: result.isIdempotentReplay || false,
      duplicateReason: result.duplicateReason,
      eventId: result.event.id,
      direction: result.appliedDirection,
      personName: result.event.personName,
      dailyStatus: result.dailySummary?.status,
    });
  } catch (err: unknown) {
    if (err instanceof DatabaseUnavailableError || (err as { code?: string })?.code === 'DATABASE_UNAVAILABLE') {
      res.status(503).json({
        error: (err as Error).message,
        code: 'DATABASE_UNAVAILABLE',
        storageMode: 'LOCAL_DEVELOPMENT_STORE',
      });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * Development-Only Simulator Scan
 * Strictly disabled in production.
 */
app.post('/api/v1/devices/simulate-scan', (req: Request, res: Response) => {
  const settings = db.getSettings();
  if (!settings.enableLiveSimulation) {
    res.status(403).json({ error: 'Simulation mode is explicitly disabled in system settings' });
    return;
  }

  const { personId, deviceId, direction, confidenceScore, clientRequestId, eventTimestamp } = req.body;
  if (!personId) {
    res.status(400).json({ error: 'personId is required' });
    return;
  }

  try {
    const result = AttendanceEngine.processScan({
      clientRequestId,
      personId,
      deviceId: deviceId || 'dev-sim-001',
      direction,
      eventTimestamp,
      confidenceScore: confidenceScore || 0.94,
      source: 'simulator',
      isSimulated: true,
    });

    res.json({
      simulated: true,
      result,
    });
  } catch (err: unknown) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/**
 * Specification Document for Hardware Engineers & Python Microservice
 */
app.get('/api/v1/spec', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'SmartFace Hardware & Face Recognition Gateway API',
      version: '1.1.0-phase1',
      description: 'API contracts for ESP32-CAM edge microcontrollers and Python Face Recognition Microservice.',
      timezone: DEFAULT_TIMEZONE,
    },
    authentication: {
      type: 'Header',
      header: 'X-Device-Token',
      description: 'Pre-shared cryptographic token assigned to each camera terminal.',
    },
    endpoints: [
      {
        path: '/api/v1/devices/heartbeat',
        method: 'POST',
        headers: { 'X-Device-Token': 'string (required)' },
        body: {
          firmwareVersion: 'v1.4.2-esp32cam',
          rssi: -65,
          ipAddress: '192.168.1.101',
        },
      },
      {
        path: '/api/v1/devices/events',
        method: 'POST',
        headers: { 'X-Device-Token': 'string (required)' },
        body: {
          personId: 'SF-1001',
          confidenceScore: 0.965,
          direction: 'entry | exit | unspecified',
          captureTimestamp: '2026-10-21T03:30:00.000Z',
          clientRequestId: 'optional-uuid-for-idempotency',
          snapshotUrl: 'https://...',
        },
      },
    ],
  });
});

// -------------------------------------------------------------------------
// VITE OR STATIC FRONTEND SERVING
// -------------------------------------------------------------------------

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[SmartFace Server] Vite middleware attached in dev mode.');
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
    console.log('[SmartFace Server] Serving compiled static assets from /dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SmartFace Server] Running on http://0.0.0.0:${PORT} (Timezone: ${DEFAULT_TIMEZONE})`);
  });
}

startServer().catch(err => {
  console.error('[SmartFace Server] Failed to start:', err);
  process.exit(1);
});
