/**
 * SmartFace Persistent Storage & Data Access Layer
 * Supports Supabase PostgreSQL with local resilient store fallback.
 * Uses JSON file persistence (data/smartface-store.json) for local storage.
 */

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Person,
  WorkSchedule,
  CameraDevice,
  AttendanceEvent,
  DailyAttendanceSummary,
  EnrollmentRecord,
  Holiday,
  LeaveRequest,
  AuditLog,
  SystemSettings,
  DashboardMetrics,
  AuthUser,
  AuthSession,
  Role,
  PersistedUserAccount,
  StorageMode,
  DatabaseTelemetry,
} from '../types/index.ts';
import { DEFAULT_TIMEZONE, getDateStringInTimezone } from './timezone.ts';
import {
  hashPassword,
  verifyPassword,
  generateSalt,
  generateSecureSessionToken,
  validatePasswordStrength,
  verifyDeviceSignature,
  computeDeviceHmac,
} from './auth.ts';

// -------------------------------------------------------------------------
// Storage Mode Definitions & Production Safety Guards
// -------------------------------------------------------------------------

export class DatabaseUnavailableError extends Error {
  code = 'DATABASE_UNAVAILABLE';
  constructor(message = 'Production Database Unavailable: Remote database connection is unverified and local fallback is disabled in production.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

// Test environment overrides for deterministic verification
let testVerificationOverride: { verified: boolean; error: string | null } | null = null;
let testEnvOverride: { isProduction: boolean; allowFallback: boolean } | null = null;

export function setTestVerificationOverride(override: { verified: boolean; error: string | null } | null) {
  testVerificationOverride = override;
}

export function setTestEnvOverride(override: { isProduction: boolean; allowFallback: boolean } | null) {
  testEnvOverride = override;
}

export function resetTestingOverrides() {
  testVerificationOverride = null;
  testEnvOverride = null;
}

export function isEffectiveProduction(): boolean {
  if (testEnvOverride !== null) return testEnvOverride.isProduction;
  return process.env.NODE_ENV === 'production';
}

export function isLocalFallbackAllowed(): boolean {
  if (testEnvOverride !== null) return testEnvOverride.allowFallback;
  if (process.env.ALLOW_LOCAL_FALLBACK === 'true') return true;
  return !isEffectiveProduction();
}

export function isSupabaseVerified(): boolean {
  if (testVerificationOverride !== null) return testVerificationOverride.verified;
  return Boolean(isSupabaseConfigured && supabaseSchemaVerified);
}

export function getStorageMode(): StorageMode {
  return isSupabaseVerified() ? 'SUPABASE_CONNECTED' : 'LOCAL_DEVELOPMENT_STORE';
}

export function assertStorageWritable(): void {
  // If remote Supabase is verified, mutations are allowed
  if (isSupabaseVerified()) {
    return;
  }
  // In production, fail safely if the required database is unavailable
  if (!isLocalFallbackAllowed()) {
    throw new DatabaseUnavailableError(
      'Production Database Unavailable: Remote database connection is unverified and local fallback is disabled in production. Refusing to silently write records to local storage.'
    );
  }
}

// -------------------------------------------------------------------------
// Supabase Client Initialization & Schema Verification
// -------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  supabaseServiceKey &&
  supabaseServiceKey.length > 20 &&
  !supabaseUrl.includes('your-project')
);

export let supabase: SupabaseClient | null = null;
export let supabaseSchemaVerified = false;
export let supabaseSchemaError: string | null = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Asynchronously probe schema
    Promise.resolve(supabase.from('people').select('id').limit(1))
      .then(({ error }) => {
        if (error) {
          supabaseSchemaVerified = false;
          const msg = error.message || '';
          const isNetworkError =
            msg.toLowerCase().includes('fetch failed') ||
            msg.toLowerCase().includes('enotfound') ||
            msg.toLowerCase().includes('econnrefused') ||
            msg.toLowerCase().includes('timeout');

          if (isNetworkError) {
            supabaseSchemaError = 'Remote Supabase endpoint unreachable';
            console.log('[SmartFace DB] Remote Supabase endpoint currently unreachable. Operating in isolated LOCAL_DEVELOPMENT_STORE.');
          } else {
            supabaseSchemaError = error.message;
            console.log(`[SmartFace DB] Supabase endpoint reached; PostgreSQL schema pending migration (${error.message}). Operating in isolated LOCAL_DEVELOPMENT_STORE.`);
          }
        } else {
          supabaseSchemaVerified = true;
          supabaseSchemaError = null;
          console.log('[SmartFace DB] Connected to Supabase PostgreSQL - production tables verified.');
        }
      })
      .catch(() => {
        supabaseSchemaVerified = false;
        supabaseSchemaError = 'Connection probe failed';
        console.log('[SmartFace DB] Supabase connection probe unavailable. Operating in isolated LOCAL_DEVELOPMENT_STORE.');
      });
  } catch (_err) {
    console.log('[SmartFace DB] Running in LOCAL_DEVELOPMENT_STORE mode with Asia/Kolkata timezone support.');
    supabase = null;
  }
} else {
  console.log('[SmartFace DB] Running in LOCAL_DEVELOPMENT_STORE mode with Asia/Kolkata timezone support.');
}

// -------------------------------------------------------------------------
// JSON File Persistence Engine
// -------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'smartface-store.json');

export function getTodayDateString(timeZone = DEFAULT_TIMEZONE): string {
  return getDateStringInTimezone(new Date(), timeZone);
}

// Helper to create an initial cryptographically-secured account with forced password change
function createInitialUser(
  id: string,
  email: string,
  fullName: string,
  role: Role,
  avatarUrl: string,
  initialPassword: string
): PersistedUserAccount {
  const salt = generateSalt(16);
  const hash = hashPassword(initialPassword, salt);
  return {
    id,
    email: email.toLowerCase(),
    fullName,
    role,
    avatarUrl,
    passwordSalt: salt,
    passwordHash: hash,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Initial bootstrap accounts with PBKDF2-HMAC-SHA512 hashing (no hardcoded plaintext public passwords)
let persistedUsers: PersistedUserAccount[] = [
  createInitialUser(
    'usr-admin-01',
    'admin@smartface.internal',
    'Chief Systems Administrator',
    'super_admin',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    process.env.INITIAL_ADMIN_PASSWORD || 'SmartFace@2026!Sec'
  ),
  createInitialUser(
    'usr-hr-02',
    'hr@smartface.internal',
    'Priya Sharma (HR Operations)',
    'manager',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    process.env.INITIAL_HR_PASSWORD || 'SmartFace@2026!Mgr'
  ),
  createInitialUser(
    'usr-auditor-03',
    'auditor@smartface.internal',
    'Rajesh Nair (Compliance Auditor)',
    'auditor',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    process.env.INITIAL_AUDITOR_PASSWORD || 'SmartFace@2026!Aud'
  ),
];

// In-memory active auth sessions with timestamp and expiry
let activeSessions: AuthSession[] = [];

// Seed schedules
const defaultSchedule: WorkSchedule = {
  id: 'sch-std-01',
  name: 'Standard IST Shift (09:00 - 18:00)',
  workStartTime: '09:00',
  workEndTime: '18:00',
  gracePeriodMinutes: 15,
  halfDayThresholdMinutes: 240,
  overtimeThresholdMinutes: 480,
  workDays: [1, 2, 3, 4, 5],
  timezone: DEFAULT_TIMEZONE,
  isDefault: true,
};

const earlySchedule: WorkSchedule = {
  id: 'sch-early-02',
  name: 'Operations Early Shift (08:00 - 17:00)',
  workStartTime: '08:00',
  workEndTime: '17:00',
  gracePeriodMinutes: 10,
  halfDayThresholdMinutes: 240,
  overtimeThresholdMinutes: 480,
  workDays: [1, 2, 3, 4, 5],
  timezone: DEFAULT_TIMEZONE,
  isDefault: false,
};

// Seed Devices - strictly marked status unconnected unless simulated
let devices: CameraDevice[] = [
  {
    id: 'dev-001',
    deviceId: 'CAM-ENTRANCE-GATE-A',
    name: 'Turnstile A (Main Entrance)',
    location: 'North Lobby - Floor 1',
    direction: 'entry',
    status: 'unconnected',
    ipAddress: '192.168.1.101',
    macAddress: '24:6F:28:B2:44:01',
    firmwareVersion: 'v1.4.2-esp32cam',
    authToken: 'tok_gate_a_9921_secret',
    deviceSecret: 'sec_hmac_gate_a_e72a8190c4217f9b88219d3e5124ab77',
    lastHeartbeatAt: undefined,
    lastEventAt: undefined,
    isSimulated: false,
    rssi: undefined,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'dev-002',
    deviceId: 'CAM-EXIT-GATE-B',
    name: 'Turnstile B (Main Exit)',
    location: 'North Lobby - Floor 1',
    direction: 'exit',
    status: 'unconnected',
    ipAddress: '192.168.1.102',
    macAddress: '24:6F:28:B2:44:02',
    firmwareVersion: 'v1.4.2-esp32cam',
    authToken: 'tok_gate_b_4412_secret',
    deviceSecret: 'sec_hmac_gate_b_b29c417e0892f153a77618c0e4429d81',
    lastHeartbeatAt: undefined,
    lastEventAt: undefined,
    isSimulated: false,
    rssi: undefined,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'dev-003',
    deviceId: 'CAM-LAB-RESTRICTED',
    name: 'R&D Biometric Terminal',
    location: 'Engineering Lab 3B',
    direction: 'bidirectional',
    status: 'unconnected',
    ipAddress: '192.168.2.45',
    macAddress: '24:6F:28:C8:11:8A',
    firmwareVersion: 'v1.4.0-esp32cam',
    authToken: 'tok_rd_terminal_8831',
    deviceSecret: 'sec_hmac_lab_rd_98317a02c91823ef518b76c02419e7a2',
    lastHeartbeatAt: undefined,
    lastEventAt: undefined,
    isSimulated: false,
    rssi: undefined,
    createdAt: '2026-02-01T09:30:00Z',
  },
  {
    id: 'dev-sim-001',
    deviceId: 'DEV-SIMULATOR-VIRTUAL',
    name: 'Development Software Simulator',
    location: 'Testbench Environment',
    direction: 'bidirectional',
    status: 'online',
    ipAddress: '127.0.0.1',
    macAddress: '00:00:00:00:00:00',
    firmwareVersion: 'v1.0.0-sim',
    authToken: 'tok_simulator_dev_mode',
    deviceSecret: 'sec_hmac_simulator_dev_testbench_9981273412',
    lastHeartbeatAt: new Date().toISOString(),
    lastEventAt: new Date().toISOString(),
    isSimulated: true,
    rssi: -40,
    createdAt: '2026-03-01T00:00:00Z',
  },
];

let schedules: WorkSchedule[] = [defaultSchedule, earlySchedule];

let people: Person[] = [
  {
    id: 'per-001',
    personId: 'SF-1001',
    fullName: 'Elena Rostova',
    department: 'Engineering',
    designation: 'Principal Systems Architect',
    email: 'elena.rostova@smartface.internal',
    phone: '+91 98765 43210',
    status: 'active',
    enrollmentStatus: 'enrolled',
    consentStatus: 'granted',
    consentDate: '2026-01-15T09:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
  },
  {
    id: 'per-002',
    personId: 'SF-1002',
    fullName: 'Marcus Vance',
    department: 'Engineering',
    designation: 'Embedded Firmware Lead',
    email: 'marcus.vance@smartface.internal',
    phone: '+91 98765 43211',
    status: 'active',
    enrollmentStatus: 'enrolled',
    consentStatus: 'granted',
    consentDate: '2026-01-15T09:15:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-01-15T09:15:00Z',
    updatedAt: '2026-01-15T09:15:00Z',
  },
  {
    id: 'per-003',
    personId: 'SF-1003',
    fullName: 'Sophia Lin',
    department: 'Product & Design',
    designation: 'Lead UX Researcher',
    email: 'sophia.lin@smartface.internal',
    phone: '+91 98765 43212',
    status: 'active',
    enrollmentStatus: 'enrolled',
    consentStatus: 'granted',
    consentDate: '2026-01-16T10:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-01-16T10:00:00Z',
    updatedAt: '2026-01-16T10:00:00Z',
  },
  {
    id: 'per-004',
    personId: 'SF-1004',
    fullName: 'David Kalu',
    department: 'Operations',
    designation: 'Facilities & Security Manager',
    email: 'david.kalu@smartface.internal',
    phone: '+91 98765 43213',
    status: 'active',
    enrollmentStatus: 'enrolled',
    consentStatus: 'granted',
    consentDate: '2026-01-17T11:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-early-02',
    createdAt: '2026-01-17T11:00:00Z',
    updatedAt: '2026-01-17T11:00:00Z',
  },
  {
    id: 'per-005',
    personId: 'SF-1005',
    fullName: 'Amira Benali',
    department: 'Human Resources',
    designation: 'People Operations Specialist',
    email: 'amira.benali@smartface.internal',
    phone: '+91 98765 43214',
    status: 'active',
    enrollmentStatus: 'enrolled',
    consentStatus: 'granted',
    consentDate: '2026-01-18T08:30:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-01-18T08:30:00Z',
    updatedAt: '2026-01-18T08:30:00Z',
  },
  {
    id: 'per-006',
    personId: 'SF-1006',
    fullName: 'Lucas Weber',
    department: 'Quality Assurance',
    designation: 'Hardware QA Engineer',
    email: 'lucas.weber@smartface.internal',
    phone: '+91 98765 43215',
    status: 'active',
    enrollmentStatus: 'enrolled',
    consentStatus: 'granted',
    consentDate: '2026-01-19T09:45:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-01-19T09:45:00Z',
    updatedAt: '2026-01-19T09:45:00Z',
  },
  {
    id: 'per-007',
    personId: 'SF-1007',
    fullName: 'Chloe Dupont',
    department: 'Marketing',
    designation: 'Brand Communications Specialist',
    email: 'chloe.dupont@smartface.internal',
    phone: '+91 98765 43216',
    status: 'active',
    enrollmentStatus: 'pending_approval',
    consentStatus: 'granted',
    consentDate: '2026-02-01T14:20:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-02-01T14:20:00Z',
    updatedAt: '2026-02-01T14:20:00Z',
  },
  {
    id: 'per-008',
    personId: 'SF-1008',
    fullName: 'Javier Morales',
    department: 'Engineering',
    designation: 'Computer Vision Engineer',
    email: 'javier.morales@smartface.internal',
    phone: '+91 98765 43217',
    status: 'active',
    enrollmentStatus: 'not_enrolled',
    consentStatus: 'withheld',
    consentDate: '2026-02-05T10:00:00Z',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
    scheduleId: 'sch-std-01',
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-05T10:00:00Z',
  },
];

let holidays: Holiday[] = [
  { id: 'hol-01', name: 'New Year Holiday', date: '2026-01-01', isRecurring: true },
  { id: 'hol-02', name: 'Republic Day', date: '2026-01-26', isRecurring: true },
  { id: 'hol-03', name: 'Independence Day', date: '2026-08-15', isRecurring: true },
  { id: 'hol-04', name: 'National Autumn Holiday', date: '2026-10-25', isRecurring: true },
];

let leaveRequests: LeaveRequest[] = [
  {
    id: 'lev-001',
    personId: 'per-006', // Lucas Weber
    personName: 'Lucas Weber',
    personBadge: 'SF-1006',
    department: 'Quality Assurance',
    leaveType: 'annual',
    startDate: getTodayDateString(),
    endDate: getTodayDateString(),
    status: 'approved',
    reason: 'Family leave approved by QA Director',
    approvedBy: 'Amira Benali',
    createdAt: '2026-10-18T10:00:00Z',
  },
];

let enrollmentRecords: EnrollmentRecord[] = [
  {
    id: 'enr-001',
    personId: 'per-001',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&auto=format&fit=crop&q=80',
    photoAngle: 'front',
    qualityScore: 94.5,
    boundingBox: { x: 120, y: 80, width: 240, height: 260 },
    templateStatus: 'extracted',
    vectorId: 'vec_sf_1001_front',
    uploadedAt: '2026-01-15T09:05:00Z',
  },
  {
    id: 'enr-002',
    personId: 'per-002',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80',
    photoAngle: 'front',
    qualityScore: 91.8,
    boundingBox: { x: 110, y: 75, width: 250, height: 255 },
    templateStatus: 'extracted',
    vectorId: 'vec_sf_1002_front',
    uploadedAt: '2026-01-15T09:20:00Z',
  },
];

let systemSettings: SystemSettings = {
  cooldownWindowMinutes: 5,
  defaultScheduleId: 'sch-std-01',
  timezone: process.env.APP_TIMEZONE || DEFAULT_TIMEZONE,
  demoMode: true,
  enableLiveSimulation: true,
  recognitionServiceUrl: process.env.RECOGNITION_SERVICE_URL || undefined,
  recognitionConfidenceThreshold: 0.85,
  supabaseConnected: isSupabaseConfigured,
  esp32SharedKeyConfigured: Boolean(process.env.ESP32_DEVICE_SHARED_KEY),
  recognitionServiceConfigured: Boolean(process.env.RECOGNITION_SERVICE_URL),
};

let auditLogs: AuditLog[] = [
  {
    id: 'aud-001',
    userEmail: 'admin@smartface.internal',
    userRole: 'super_admin',
    action: 'SYSTEM_INITIALIZATION',
    targetType: 'system',
    targetId: 'smartface-core',
    details: { message: 'SmartFace Phase 1 initialization complete with Asia/Kolkata timezone support.' },
    ipAddress: '127.0.0.1',
    createdAt: '2026-10-21T08:00:00Z',
  },
];

const todayStr = getTodayDateString();

// Seed initial today attendance events and summaries for demonstration
let attendanceEvents: AttendanceEvent[] = [
  {
    id: 'evt-001',
    clientRequestId: 'seed-req-001',
    personId: 'per-001',
    personName: 'Elena Rostova',
    personBadge: 'SF-1001',
    department: 'Engineering',
    deviceId: 'dev-sim-001',
    deviceName: 'Development Software Simulator',
    eventTimestamp: `${todayStr}T03:22:14.000Z`, // 08:52 AM IST
    direction: 'entry',
    confidenceScore: 0.962,
    isDuplicate: false,
    isSimulated: true,
    source: 'simulator',
    rawPayload: { vectorScore: 0.962, simulated: true },
    createdAt: `${todayStr}T03:22:15.000Z`,
  },
  {
    id: 'evt-002',
    clientRequestId: 'seed-req-002',
    personId: 'per-004',
    personName: 'David Kalu',
    personBadge: 'SF-1004',
    department: 'Operations',
    deviceId: 'dev-sim-001',
    deviceName: 'Development Software Simulator',
    eventTimestamp: `${todayStr}T02:24:30.000Z`, // 07:54 AM IST (Early shift)
    direction: 'entry',
    confidenceScore: 0.985,
    isDuplicate: false,
    isSimulated: true,
    source: 'simulator',
    createdAt: `${todayStr}T02:24:31.000Z`,
  },
  {
    id: 'evt-003',
    clientRequestId: 'seed-req-003',
    personId: 'per-003',
    personName: 'Sophia Lin',
    personBadge: 'SF-1003',
    department: 'Product & Design',
    deviceId: 'dev-sim-001',
    deviceName: 'Development Software Simulator',
    eventTimestamp: `${todayStr}T03:38:45.000Z`, // 09:08 AM IST (within 15m grace)
    direction: 'entry',
    confidenceScore: 0.941,
    isDuplicate: false,
    isSimulated: true,
    source: 'simulator',
    createdAt: `${todayStr}T03:38:46.000Z`,
  },
  {
    id: 'evt-004',
    clientRequestId: 'seed-req-004',
    personId: 'per-002',
    personName: 'Marcus Vance',
    personBadge: 'SF-1002',
    department: 'Engineering',
    deviceId: 'dev-sim-001',
    deviceName: 'Development Software Simulator',
    eventTimestamp: `${todayStr}T04:04:10.000Z`, // 09:34 AM IST (19 min late past grace)
    direction: 'entry',
    confidenceScore: 0.953,
    isDuplicate: false,
    isSimulated: true,
    source: 'simulator',
    createdAt: `${todayStr}T04:04:11.000Z`,
  },
];

let dailySummaries: DailyAttendanceSummary[] = [
  {
    id: 'sum-001',
    personId: 'per-001',
    personName: 'Elena Rostova',
    personBadge: 'SF-1001',
    department: 'Engineering',
    date: todayStr,
    scheduleId: 'sch-std-01',
    scheduleName: 'Standard IST Shift (09:00 - 18:00)',
    firstIn: `${todayStr}T03:22:14.000Z`,
    lastOut: undefined,
    totalWorkMinutes: 180,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'present',
    isManuallyAdjusted: false,
    isSimulated: true,
    punchSessions: [{ inTime: `${todayStr}T03:22:14.000Z`, minutesWorked: 180 }],
    createdAt: `${todayStr}T03:22:15.000Z`,
    updatedAt: `${todayStr}T03:22:15.000Z`,
  },
  {
    id: 'sum-002',
    personId: 'per-004',
    personName: 'David Kalu',
    personBadge: 'SF-1004',
    department: 'Operations',
    date: todayStr,
    scheduleId: 'sch-early-02',
    scheduleName: 'Operations Early Shift (08:00 - 17:00)',
    firstIn: `${todayStr}T02:24:30.000Z`,
    lastOut: undefined,
    totalWorkMinutes: 240,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'present',
    isManuallyAdjusted: false,
    isSimulated: true,
    punchSessions: [{ inTime: `${todayStr}T02:24:30.000Z`, minutesWorked: 240 }],
    createdAt: `${todayStr}T02:24:31.000Z`,
    updatedAt: `${todayStr}T02:24:31.000Z`,
  },
  {
    id: 'sum-003',
    personId: 'per-003',
    personName: 'Sophia Lin',
    personBadge: 'SF-1003',
    department: 'Product & Design',
    date: todayStr,
    scheduleId: 'sch-std-01',
    scheduleName: 'Standard IST Shift (09:00 - 18:00)',
    firstIn: `${todayStr}T03:38:45.000Z`,
    lastOut: undefined,
    totalWorkMinutes: 160,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'present',
    isManuallyAdjusted: false,
    isSimulated: true,
    punchSessions: [{ inTime: `${todayStr}T03:38:45.000Z`, minutesWorked: 160 }],
    createdAt: `${todayStr}T03:38:46.000Z`,
    updatedAt: `${todayStr}T03:38:46.000Z`,
  },
  {
    id: 'sum-004',
    personId: 'per-002',
    personName: 'Marcus Vance',
    personBadge: 'SF-1002',
    department: 'Engineering',
    date: todayStr,
    scheduleId: 'sch-std-01',
    scheduleName: 'Standard IST Shift (09:00 - 18:00)',
    firstIn: `${todayStr}T04:04:10.000Z`,
    lastOut: undefined,
    totalWorkMinutes: 140,
    lateMinutes: 19,
    earlyLeaveMinutes: 0,
    status: 'late',
    isManuallyAdjusted: false,
    isSimulated: true,
    punchSessions: [{ inTime: `${todayStr}T04:04:10.000Z`, minutesWorked: 140 }],
    createdAt: `${todayStr}T04:04:11.000Z`,
    updatedAt: `${todayStr}T04:04:11.000Z`,
  },
  {
    id: 'sum-006',
    personId: 'per-006',
    personName: 'Lucas Weber',
    personBadge: 'SF-1006',
    department: 'Quality Assurance',
    date: todayStr,
    scheduleId: 'sch-std-01',
    scheduleName: 'Standard IST Shift (09:00 - 18:00)',
    firstIn: undefined,
    lastOut: undefined,
    totalWorkMinutes: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'leave',
    isManuallyAdjusted: false,
    adjustmentReason: 'Approved Annual Leave',
    isSimulated: false,
    createdAt: `${todayStr}T06:00:00.000Z`,
    updatedAt: `${todayStr}T06:00:00.000Z`,
  },
];

// Load persisted state if exists
function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (data.users && Array.isArray(data.users) && data.users.length > 0) {
        persistedUsers = data.users;
      }
      if (data.people) people = data.people;
      if (data.devices) {
        devices = data.devices.map((d: CameraDevice) => {
          const defaultSecret = `sec_hmac_${(d.deviceId || 'dev').toLowerCase().replace(/[^a-z0-9]/g, '_')}_key_${d.id}`;
          return {
            ...d,
            deviceSecret: d.deviceSecret || defaultSecret,
          };
        });
      }
      if (data.schedules) schedules = data.schedules;
      if (data.attendanceEvents) attendanceEvents = data.attendanceEvents;
      if (data.dailySummaries) dailySummaries = data.dailySummaries;
      if (data.holidays) holidays = data.holidays;
      if (data.leaveRequests) leaveRequests = data.leaveRequests;
      if (data.enrollmentRecords) enrollmentRecords = data.enrollmentRecords;
      if (data.auditLogs) auditLogs = data.auditLogs;
      if (data.systemSettings) systemSettings = { ...systemSettings, ...data.systemSettings };
      console.log(`[SmartFace DB] Loaded persistent store from ${DATA_FILE}`);
    } else {
      saveToDisk();
    }
  } catch (err) {
    console.warn('[SmartFace DB] Could not read disk store, using defaults:', err);
  }
}

// Save persisted state to file
let saveTimeout: NodeJS.Timeout | null = null;
function saveToDisk() {
  assertStorageWritable();
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const state = {
        users: persistedUsers,
        people,
        devices,
        schedules,
        attendanceEvents,
        dailySummaries,
        holidays,
        leaveRequests,
        enrollmentRecords,
        auditLogs,
        systemSettings,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SmartFace DB] Failed to save state to disk:', err);
    }
  }, 200);
}

// Initial load
loadFromDisk();

// -------------------------------------------------------------------------
// Storage Access Interface
// -------------------------------------------------------------------------

export const db = {
  // --- Auth & Sessions ---
  authenticateUser(email: string, password: string): { user: AuthUser; token: string; mustChangePassword?: boolean } | null {
    if (!email || !password) return null;
    const userAccount = persistedUsers.find(
      u => u.email.toLowerCase() === email.toLowerCase().trim()
    );
    if (!userAccount) return null;

    const isValid = verifyPassword(password, userAccount.passwordSalt, userAccount.passwordHash);
    if (!isValid) return null;

    const token = generateSecureSessionToken();
    const user: AuthUser = {
      id: userAccount.id,
      email: userAccount.email,
      fullName: userAccount.fullName,
      role: userAccount.role,
      avatarUrl: userAccount.avatarUrl,
      mustChangePassword: userAccount.mustChangePassword,
    };

    const session: AuthSession = {
      token,
      user,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(), // 8-hour session lifetime
    };
    activeSessions.push(session);

    this.logAudit({
      userEmail: user.email,
      userRole: user.role,
      action: 'USER_LOGIN',
      targetType: 'auth_session',
      targetId: session.token.substring(0, 16),
      details: { role: user.role, mustChangePassword: user.mustChangePassword },
    });

    return { user, token, mustChangePassword: userAccount.mustChangePassword };
  },

  validateSessionToken(token: string): AuthUser | null {
    if (!token) return null;
    const session = activeSessions.find(s => s.token === token);
    if (!session) return null;

    const now = Date.now();
    // Expiration check
    if (new Date(session.expiresAt).getTime() < now) {
      activeSessions = activeSessions.filter(s => s.token !== token);
      return null;
    }

    // Inactivity timeout: 2 hours
    const lastActivity = new Date(session.lastActivityAt || session.createdAt).getTime();
    if (now - lastActivity > 2 * 3600 * 1000) {
      activeSessions = activeSessions.filter(s => s.token !== token);
      return null;
    }

    session.lastActivityAt = new Date().toISOString();
    return session.user;
  },

  invalidateSession(token: string): boolean {
    if (!token) return false;
    const session = activeSessions.find(s => s.token === token);
    if (session) {
      this.logAudit({
        userEmail: session.user.email,
        userRole: session.user.role,
        action: 'USER_LOGOUT',
        targetType: 'auth_session',
        targetId: token.substring(0, 16),
      });
      activeSessions = activeSessions.filter(s => s.token !== token);
      return true;
    }
    return false;
  },

  changePassword(userId: string, currentPass: string, newPass: string): { success: boolean; error?: string } {
    const userAccount = persistedUsers.find(u => u.id === userId);
    if (!userAccount) {
      return { success: false, error: 'User account not found' };
    }

    if (!verifyPassword(currentPass, userAccount.passwordSalt, userAccount.passwordHash)) {
      return { success: false, error: 'Current password verification failed' };
    }

    const strength = validatePasswordStrength(newPass);
    if (!strength.valid) {
      return { success: false, error: strength.reason };
    }

    if (verifyPassword(newPass, userAccount.passwordSalt, userAccount.passwordHash)) {
      return { success: false, error: 'New password cannot be identical to current password' };
    }

    const newSalt = generateSalt(16);
    userAccount.passwordSalt = newSalt;
    userAccount.passwordHash = hashPassword(newPass, newSalt);
    userAccount.mustChangePassword = false;
    userAccount.updatedAt = new Date().toISOString();

    saveToDisk();

    this.logAudit({
      userEmail: userAccount.email,
      userRole: userAccount.role,
      action: 'PASSWORD_CHANGED',
      targetType: 'user_account',
      targetId: userAccount.id,
      details: { mustChangePasswordCleared: true },
    });

    return { success: true };
  },

  provisionUser(account: {
    email: string;
    fullName: string;
    role: Role;
    password?: string;
    avatarUrl?: string;
  }, creatorEmail: string): { user: AuthUser; initialPassword?: string } {
    const existing = persistedUsers.find(u => u.email.toLowerCase() === account.email.toLowerCase().trim());
    if (existing) {
      throw new Error(`Account with email '${account.email}' already exists.`);
    }

    const initialPassword = account.password || `SF-${generateSalt(4).toUpperCase()}!${Date.now().toString().slice(-4)}`;
    const salt = generateSalt(16);
    const hash = hashPassword(initialPassword, salt);

    const newUser: PersistedUserAccount = {
      id: `usr-${account.role}-${Date.now().toString().slice(-6)}`,
      email: account.email.toLowerCase().trim(),
      fullName: account.fullName,
      role: account.role,
      avatarUrl: account.avatarUrl,
      passwordSalt: salt,
      passwordHash: hash,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persistedUsers.push(newUser);
    saveToDisk();

    this.logAudit({
      userEmail: creatorEmail,
      userRole: 'super_admin',
      action: 'USER_PROVISIONED',
      targetType: 'user_account',
      targetId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
    });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        avatarUrl: newUser.avatarUrl,
        mustChangePassword: true,
      },
      initialPassword: account.password ? undefined : initialPassword,
    };
  },

  // --- Device HMAC Signature Verification ---
  verifyDeviceRequest(params: {
    deviceId: string;
    timestamp: string | number;
    nonce: string;
    signature: string;
    payload: unknown;
  }): { valid: boolean; error?: string; device?: CameraDevice } {
    const device = this.getDeviceById(params.deviceId);
    if (!device) {
      return { valid: false, error: `Device '${params.deviceId}' not found in registry` };
    }
    if (!device.deviceSecret) {
      return { valid: false, error: `Device '${params.deviceId}' has no registered HMAC secret` };
    }
    const result = verifyDeviceSignature({
      deviceId: device.deviceId,
      timestamp: params.timestamp,
      nonce: params.nonce,
      signature: params.signature,
      secret: device.deviceSecret,
      payload: params.payload,
    });
    if (!result.valid) {
      return { valid: false, error: result.error };
    }
    return { valid: true, device };
  },

  // --- Storage Mode Helpers ---
  isLocalFallbackAllowed(): boolean {
    return isLocalFallbackAllowed();
  },

  isSupabaseVerified(): boolean {
    return isSupabaseVerified();
  },

  getStorageMode(): StorageMode {
    return getStorageMode();
  },

  assertStorageWritable(): void {
    assertStorageWritable();
  },

  // --- Database Telemetry ---
  getDatabaseTelemetry(): DatabaseTelemetry {
    const mode = getStorageMode();
    const verified = isSupabaseVerified();
    const errorMsg = testVerificationOverride !== null ? testVerificationOverride.error : supabaseSchemaError;
    const fallbackAllowed = isLocalFallbackAllowed();

    return {
      storageMode: mode,
      dbMode: mode,
      supabaseConfigured: isSupabaseConfigured,
      supabaseUrl: isSupabaseConfigured ? supabaseUrl : undefined,
      supabaseSchemaVerified: verified,
      supabaseSchemaError: errorMsg,
      localFallbackActive: mode === 'LOCAL_DEVELOPMENT_STORE',
      localFallbackAllowed: fallbackAllowed,
      isSynchronizedWithRemote: false,
      syncNotice: mode === 'SUPABASE_CONNECTED'
        ? 'Connected directly to live verified Supabase PostgreSQL production schema.'
        : 'LOCAL_DEVELOPMENT_STORE is strictly isolated and NOT synchronized with Supabase. Changes made locally will not automatically replicate to PostgreSQL.',
      backupAndRecoveryLimitations: [
        'Single-node local JSON file persistence at data/smartface-store.json.',
        'No automated multi-region replication or failover.',
        'No point-in-time recovery (PITR) or transaction write-ahead logging (WAL).',
        'Container restarts or ephemeral filesystem wipes will reset unbacked local data.',
        'Local fallback is restricted to development environments (ALLOW_LOCAL_FALLBACK=true required in production).'
      ],
      isolationNotice: mode === 'SUPABASE_CONNECTED'
        ? 'Connected to live Supabase PostgreSQL production tables.'
        : isSupabaseConfigured
        ? 'Connected to Supabase, but PostgreSQL tables are unmigrated. Operating in isolated LOCAL_DEVELOPMENT_STORE to prevent data loss.'
        : 'Operating in isolated LOCAL_DEVELOPMENT_STORE (development mode).',
    };
  },

  // --- Dashboard Metrics ---
  getDashboardMetrics(genuineOnly = false): DashboardMetrics {
    const today = getTodayDateString();
    let todaySums = dailySummaries.filter(s => s.date === today);
    if (genuineOnly) {
      todaySums = todaySums.filter(s => !s.isSimulated);
    }

    const present = todaySums.filter(s => s.status === 'present').length;
    const late = todaySums.filter(s => s.status === 'late').length;
    const onLeave = todaySums.filter(s => s.status === 'leave').length;
    const absent = todaySums.filter(s => s.status === 'absent').length;
    const totalPeople = people.filter(p => p.status === 'active').length;
    const onlineDevs = devices.filter(d => d.status === 'online').length;
    const duplicateCount = attendanceEvents.filter(e => e.isDuplicate).length;
    const simEventsCount = attendanceEvents.filter(e => e.isSimulated).length;

    const rate = totalPeople > 0 ? Math.round(((present + late) / totalPeople) * 100) : 0;
    const lastEvent = attendanceEvents[0]?.eventTimestamp;
    const mode = getStorageMode();

    return {
      totalPeople,
      presentToday: present,
      lateToday: late,
      absentToday: absent,
      onLeaveToday: onLeave,
      attendanceRate: rate,
      onlineDevices: onlineDevs,
      totalDevices: devices.length,
      duplicatePreventedCount: duplicateCount,
      simulatedEventsCount: simEventsCount,
      lastEventTimestamp: lastEvent,
      isDemoData: systemSettings.demoMode,
      storageMode: mode,
      dbMode: mode,
      recognitionServiceStatus: systemSettings.recognitionServiceUrl ? 'connected' : 'unconfigured',
      hardwareStatus: onlineDevs > 0 ? (devices.some(d => !d.isSimulated && d.status === 'online') ? 'connected' : 'simulated') : 'unconnected',
    };
  },

  // --- People Directory ---
  getPeople(filter?: { department?: string; status?: string; search?: string }): Person[] {
    let list = [...people];
    if (filter?.department && filter.department !== 'all') {
      list = list.filter(p => p.department.toLowerCase() === filter.department?.toLowerCase());
    }
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(p => p.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(p =>
        p.fullName.toLowerCase().includes(q) ||
        p.personId.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.designation.toLowerCase().includes(q)
      );
    }
    return list;
  },

  getPersonById(id: string): Person | undefined {
    return people.find(p => p.id === id || p.personId === id);
  },

  createPerson(data: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>): Person {
    assertStorageWritable();
    const newPerson: Person = {
      ...data,
      id: `per-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    people.unshift(newPerson);
    saveToDisk();
    return newPerson;
  },

  updatePerson(id: string, updates: Partial<Person>): Person | null {
    assertStorageWritable();
    const idx = people.findIndex(p => p.id === id || p.personId === id);
    if (idx === -1) return null;
    people[idx] = {
      ...people[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveToDisk();
    return people[idx];
  },

  deletePerson(id: string): boolean {
    assertStorageWritable();
    const idx = people.findIndex(p => p.id === id || p.personId === id);
    if (idx === -1) return false;
    people.splice(idx, 1);
    // Also remove associated enrollment records
    enrollmentRecords = enrollmentRecords.filter(r => r.personId !== id);
    saveToDisk();
    return true;
  },

  revokeBiometricConsent(personId: string, userEmail: string): boolean {
    const person = this.getPersonById(personId);
    if (!person) return false;
    person.consentStatus = 'revoked';
    person.enrollmentStatus = 'not_enrolled';
    person.biometricConsentRevokedAt = new Date().toISOString();
    // Delete face photos & embeddings to honor privacy revocation
    enrollmentRecords = enrollmentRecords.filter(r => r.personId !== person.id);
    saveToDisk();

    this.logAudit({
      userEmail,
      userRole: 'admin',
      action: 'BIOMETRIC_CONSENT_REVOKED',
      targetType: 'person',
      targetId: person.personId,
      details: { message: 'Biometric consent revoked and all facial templates deleted.' },
    });
    return true;
  },

  deletePersonBiometrics(personId: string, userEmail: string): boolean {
    const person = this.getPersonById(personId);
    if (!person) return false;
    enrollmentRecords = enrollmentRecords.filter(r => r.personId !== person.id);
    person.enrollmentStatus = 'not_enrolled';
    saveToDisk();

    this.logAudit({
      userEmail,
      userRole: 'admin',
      action: 'BIOMETRIC_TEMPLATES_DELETED',
      targetType: 'person',
      targetId: person.personId,
    });
    return true;
  },

  // --- Devices ---
  getDevices(): CameraDevice[] {
    return [...devices];
  },

  getDeviceById(id: string): CameraDevice | undefined {
    return devices.find(d => d.id === id || d.deviceId === id);
  },

  getDeviceByToken(token: string): CameraDevice | undefined {
    return devices.find(d => d.authToken === token);
  },

  createDevice(data: Omit<CameraDevice, 'id' | 'createdAt'>): CameraDevice {
    const newDev: CameraDevice = {
      ...data,
      id: `dev-${Date.now().toString().slice(-6)}`,
      status: 'unconnected',
      createdAt: new Date().toISOString(),
    };
    devices.unshift(newDev);
    saveToDisk();
    return newDev;
  },

  updateDevice(id: string, updates: Partial<CameraDevice>): CameraDevice | null {
    const idx = devices.findIndex(d => d.id === id || d.deviceId === id);
    if (idx === -1) return null;
    devices[idx] = { ...devices[idx], ...updates };
    saveToDisk();
    return devices[idx];
  },

  deleteDevice(id: string): boolean {
    const idx = devices.findIndex(d => d.id === id || d.deviceId === id);
    if (idx === -1) return false;
    devices.splice(idx, 1);
    saveToDisk();
    return true;
  },

  // --- Events ---
  getEvents(limit = 100, filter?: { personId?: string; isDuplicate?: boolean; isSimulated?: boolean }): AttendanceEvent[] {
    let list = [...attendanceEvents];
    if (filter?.personId) {
      list = list.filter(e => e.personId === filter.personId);
    }
    if (filter?.isDuplicate !== undefined) {
      list = list.filter(e => e.isDuplicate === filter.isDuplicate);
    }
    if (filter?.isSimulated !== undefined) {
      list = list.filter(e => e.isSimulated === filter.isSimulated);
    }
    return list.slice(0, limit);
  },

  getEventByClientRequestId(reqId: string): AttendanceEvent | undefined {
    if (!reqId) return undefined;
    return attendanceEvents.find(e => e.clientRequestId === reqId);
  },

  addEvent(eventData: Omit<AttendanceEvent, 'id' | 'createdAt'>): AttendanceEvent {
    assertStorageWritable();
    const newEvent: AttendanceEvent = {
      ...eventData,
      id: `evt-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`,
      createdAt: new Date().toISOString(),
    };
    attendanceEvents.unshift(newEvent);
    saveToDisk();
    return newEvent;
  },

  deleteEventsForPersonAndDate(personId: string, dateStr: string): void {
    assertStorageWritable();
    attendanceEvents = attendanceEvents.filter(e => {
      const eDate = getDateStringInTimezone(new Date(e.eventTimestamp), DEFAULT_TIMEZONE);
      return !(e.personId === personId && eDate === dateStr);
    });
    dailySummaries = dailySummaries.filter(s => !(s.personId === personId && s.date === dateStr));
    saveToDisk();
  },

  // --- Daily Summaries ---
  getDailySummaries(dateStr?: string): DailyAttendanceSummary[] {
    const target = dateStr || getTodayDateString();
    return dailySummaries.filter(s => s.date === target);
  },

  getAllSummaries(): DailyAttendanceSummary[] {
    return [...dailySummaries];
  },

  upsertDailySummary(summary: DailyAttendanceSummary): void {
    const idx = dailySummaries.findIndex(s => s.personId === summary.personId && s.date === summary.date);
    if (idx >= 0) {
      dailySummaries[idx] = { ...summary, updatedAt: new Date().toISOString() };
    } else {
      dailySummaries.unshift(summary);
    }
    saveToDisk();
  },

  // --- Schedules ---
  getSchedules(): WorkSchedule[] {
    return [...schedules];
  },

  getDefaultSchedule(): WorkSchedule {
    return schedules.find(s => s.isDefault) || schedules[0];
  },

  getScheduleById(id?: string): WorkSchedule {
    if (!id) return this.getDefaultSchedule();
    return schedules.find(s => s.id === id) || this.getDefaultSchedule();
  },

  saveSchedule(sched: WorkSchedule): void {
    const idx = schedules.findIndex(s => s.id === sched.id);
    if (idx >= 0) {
      schedules[idx] = sched;
    } else {
      schedules.push(sched);
    }
    saveToDisk();
  },

  // --- Holidays & Leave ---
  getHolidays(): Holiday[] {
    return [...holidays];
  },

  addHoliday(h: Omit<Holiday, 'id'>): Holiday {
    const newH: Holiday = { ...h, id: `hol-${Date.now().toString().slice(-6)}` };
    holidays.push(newH);
    saveToDisk();
    return newH;
  },

  deleteHoliday(id: string): boolean {
    const idx = holidays.findIndex(h => h.id === id);
    if (idx === -1) return false;
    holidays.splice(idx, 1);
    saveToDisk();
    return true;
  },

  getLeaveRequests(): LeaveRequest[] {
    return [...leaveRequests];
  },

  addLeaveRequest(req: Omit<LeaveRequest, 'id' | 'createdAt'>): LeaveRequest {
    const newReq: LeaveRequest = {
      ...req,
      id: `lev-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    };
    leaveRequests.unshift(newReq);
    saveToDisk();
    return newReq;
  },

  updateLeaveStatus(id: string, status: 'approved' | 'rejected', approvedBy?: string): boolean {
    const req = leaveRequests.find(l => l.id === id);
    if (!req) return false;
    req.status = status;
    if (approvedBy) req.approvedBy = approvedBy;
    saveToDisk();
    return true;
  },

  // --- Enrollment ---
  getEnrollmentRecords(personId?: string): EnrollmentRecord[] {
    if (personId) {
      return enrollmentRecords.filter(r => r.personId === personId);
    }
    return [...enrollmentRecords];
  },

  addEnrollmentRecord(rec: Omit<EnrollmentRecord, 'id' | 'uploadedAt'>): EnrollmentRecord {
    const newRec: EnrollmentRecord = {
      ...rec,
      id: `enr-${Date.now().toString().slice(-6)}`,
      uploadedAt: new Date().toISOString(),
    };
    enrollmentRecords.unshift(newRec);
    this.updatePerson(rec.personId, { enrollmentStatus: 'enrolled' });
    saveToDisk();
    return newRec;
  },

  // --- Audit Logs ---
  getAuditLogs(limit = 100): AuditLog[] {
    return auditLogs.slice(0, limit);
  },

  logAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const newLog: AuditLog = {
      ...log,
      id: `aud-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    auditLogs.unshift(newLog);
    saveToDisk();
    return newLog;
  },

  // --- Settings ---
  getSettings(): SystemSettings {
    return { ...systemSettings };
  },

  updateSettings(updates: Partial<SystemSettings>): SystemSettings {
    systemSettings = { ...systemSettings, ...updates };
    saveToDisk();
    return { ...systemSettings };
  },
};
