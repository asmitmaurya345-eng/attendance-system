/**
 * SmartFace Core Enterprise Domain Types
 */

export type Role = 'super_admin' | 'admin' | 'manager' | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl?: string;
  mustChangePassword?: boolean;
}

export interface PersistedUserAccount {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl?: string;
  passwordSalt: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export type PersonStatus = 'active' | 'inactive' | 'suspended';
export type EnrollmentStatus = 'not_enrolled' | 'pending_approval' | 'enrolled' | 'rejected';
export type ConsentStatus = 'granted' | 'withheld' | 'revoked';

export interface Person {
  id: string;
  personId: string; // Employee ID / Badge ID e.g. "EMP-1042"
  fullName: string;
  department: string;
  designation: string;
  email: string;
  phone: string;
  status: PersonStatus;
  enrollmentStatus: EnrollmentStatus;
  consentStatus: ConsentStatus;
  consentDate: string; // ISO string
  biometricConsentRevokedAt?: string;
  retentionPolicy?: string;
  avatarUrl?: string;
  scheduleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSchedule {
  id: string;
  name: string;
  workStartTime: string; // "09:00" in shift timezone
  workEndTime: string;   // "18:00" in shift timezone
  gracePeriodMinutes: number; // e.g. 15
  halfDayThresholdMinutes: number; // e.g. 240
  overtimeThresholdMinutes: number; // e.g. 480
  workDays: number[]; // 1 = Monday, 5 = Friday
  timezone: string; // e.g. "Asia/Kolkata"
  isDefault: boolean;
}

export type DeviceDirection = 'entry' | 'exit' | 'bidirectional';
export type DeviceStatus = 'online' | 'offline' | 'warning' | 'maintenance' | 'unconnected';

export interface CameraDevice {
  id: string;
  deviceId: string; // e.g. "ESP32-GATE-NORTH"
  name: string;
  location: string;
  direction: DeviceDirection;
  status: DeviceStatus;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion: string;
  authToken: string;
  deviceSecret?: string; // Secret key for HMAC-SHA256 signature verification
  lastHeartbeatAt?: string;
  lastEventAt?: string;
  isSimulated: boolean;
  rssi?: number; // signal strength dBm
  createdAt: string;
}

export type EventDirection = 'entry' | 'exit' | 'unspecified';
export type EventSource = 'camera' | 'manual_entry' | 'simulator' | 'api';

export interface AttendanceEvent {
  id: string;
  clientRequestId?: string; // Idempotency key
  personId: string;
  personName?: string;
  personBadge?: string;
  department?: string;
  deviceId?: string;
  deviceName?: string;
  eventTimestamp: string; // ISO UTC
  direction: EventDirection;
  confidenceScore: number; // 0.0 - 1.0
  snapshotUrl?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  isSimulated: boolean;
  source: EventSource;
  rawPayload?: Record<string, unknown>;
  createdAt: string;
}

export type DailyStatus = 'present' | 'late' | 'half_day' | 'absent' | 'holiday' | 'leave';

export interface PunchSession {
  inTime: string;
  outTime?: string;
  minutesWorked: number;
}

export interface DailyAttendanceSummary {
  id: string;
  personId: string;
  personName: string;
  personBadge: string;
  department: string;
  date: string; // "YYYY-MM-DD" in Asia/Kolkata
  scheduleId?: string;
  scheduleName?: string;
  firstIn?: string; // ISO
  lastOut?: string; // ISO
  totalWorkMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: DailyStatus;
  isManuallyAdjusted: boolean;
  adjustmentReason?: string;
  adjustedBy?: string;
  isSimulated?: boolean;
  punchSessions?: PunchSession[];
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentRecord {
  id: string;
  personId: string;
  photoUrl: string;
  photoAngle: 'front' | 'left_30' | 'right_30';
  qualityScore: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  templateStatus: 'pending' | 'extracted' | 'failed';
  vectorId?: string;
  uploadedAt: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // "YYYY-MM-DD" in Asia/Kolkata
  isRecurring: boolean;
}

export type LeaveType = 'annual' | 'sick' | 'casual' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  personId: string;
  personName?: string;
  personBadge?: string;
  department?: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: LeaveStatus;
  reason: string;
  approvedBy?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userEmail: string;
  userRole: Role;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export type StorageMode = 'SUPABASE_CONNECTED' | 'LOCAL_DEVELOPMENT_STORE';

export interface DatabaseTelemetry {
  storageMode: StorageMode;
  dbMode: StorageMode | 'supabase' | 'local_persistent_store';
  supabaseConfigured: boolean;
  supabaseUrl?: string;
  supabaseSchemaVerified: boolean;
  supabaseSchemaError: string | null;
  localFallbackActive: boolean;
  localFallbackAllowed: boolean;
  isSynchronizedWithRemote: boolean;
  syncNotice: string;
  backupAndRecoveryLimitations: string[];
  isolationNotice: string;
}

export interface SystemSettings {
  cooldownWindowMinutes: number;
  defaultScheduleId: string;
  timezone: string; // "Asia/Kolkata"
  demoMode: boolean;
  enableLiveSimulation: boolean;
  recognitionServiceUrl?: string;
  recognitionConfidenceThreshold: number;
  supabaseConnected: boolean;
  storageMode?: StorageMode;
  esp32SharedKeyConfigured: boolean;
  recognitionServiceConfigured: boolean;
}

export interface DashboardMetrics {
  totalPeople: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeaveToday: number;
  attendanceRate: number;
  onlineDevices: number;
  totalDevices: number;
  duplicatePreventedCount: number;
  simulatedEventsCount: number;
  lastEventTimestamp?: string;
  isDemoData: boolean;
  storageMode?: StorageMode;
  dbMode: StorageMode | 'supabase' | 'local_persistent_store';
  recognitionServiceStatus: 'unconfigured' | 'connected' | 'error';
  hardwareStatus: 'unconnected' | 'connected' | 'simulated';
}

