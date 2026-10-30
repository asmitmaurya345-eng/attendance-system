/**
 * SmartFace API Client
 * Clean REST abstraction for frontend components with session token attachment.
 */

import {
  Person,
  CameraDevice,
  AttendanceEvent,
  DailyAttendanceSummary,
  WorkSchedule,
  Holiday,
  LeaveRequest,
  AuditLog,
  SystemSettings,
  DashboardMetrics,
  EnrollmentRecord,
  AuthUser,
} from '../types/index.ts';

const TOKEN_KEY = 'smartface_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export const api = {
  // Authentication
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser; mustChangePassword?: boolean; message: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () =>
    request<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: AuthUser }>('/api/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  provisionUser: (accountData: { email: string; fullName: string; role: string; password?: string }) =>
    request<{ user: AuthUser; initialPassword?: string }>('/api/auth/provision-user', {
      method: 'POST',
      body: JSON.stringify(accountData),
    }),

  // Metrics & Health
  getMetrics: (genuineOnly = false) =>
    request<DashboardMetrics>(`/api/metrics?genuineOnly=${genuineOnly}`),
  getHealth: () =>
    request<{
      status: string;
      dbMode: string;
      supabaseConnected: boolean;
      timezone: string;
      recognitionServiceConnected: boolean;
    }>('/api/health'),

  // People
  getPeople: (params?: { department?: string; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.department) q.append('department', params.department);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    return request<Person[]>(`/api/people?${q.toString()}`);
  },
  getPersonById: (id: string) =>
    request<{
      person: Person;
      enrollments: EnrollmentRecord[];
      events: AttendanceEvent[];
      summaries: DailyAttendanceSummary[];
      schedule: WorkSchedule;
    }>(`/api/people/${id}`),
  createPerson: (person: Partial<Person>) =>
    request<Person>('/api/people', { method: 'POST', body: JSON.stringify(person) }),
  updatePerson: (id: string, updates: Partial<Person>) =>
    request<Person>(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deletePerson: (id: string) =>
    request<{ success: boolean }>(`/api/people/${id}`, { method: 'DELETE' }),

  // Biometrics & Consent Management
  revokeConsent: (personId: string) =>
    request<{ success: boolean; message: string }>(`/api/people/${personId}/revoke-consent`, {
      method: 'POST',
    }),
  deleteBiometrics: (personId: string) =>
    request<{ success: boolean; message: string }>(`/api/people/${personId}/biometrics`, {
      method: 'DELETE',
    }),
  exportBiometrics: (personId: string) =>
    request<Record<string, unknown>>(`/api/people/${personId}/biometric-export`),

  // Devices
  getDevices: () => request<CameraDevice[]>('/api/devices'),
  createDevice: (dev: Partial<CameraDevice>) =>
    request<CameraDevice>('/api/devices', { method: 'POST', body: JSON.stringify(dev) }),
  updateDevice: (id: string, updates: Partial<CameraDevice>) =>
    request<CameraDevice>(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteDevice: (id: string) =>
    request<{ success: boolean }>(`/api/devices/${id}`, { method: 'DELETE' }),

  // Attendance Events
  getEvents: (params?: { limit?: number; personId?: string; isDuplicate?: boolean; isSimulated?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.personId) q.append('personId', params.personId);
    if (params?.isDuplicate !== undefined) q.append('isDuplicate', String(params.isDuplicate));
    if (params?.isSimulated !== undefined) q.append('isSimulated', String(params.isSimulated));
    return request<AttendanceEvent[]>(`/api/events?${q.toString()}`);
  },

  // Daily Summaries
  getDailyAttendance: (date?: string) => {
    const q = date ? `?date=${date}` : '';
    return request<DailyAttendanceSummary[]>(`/api/daily-attendance${q}`);
  },
  recomputeAttendance: (date?: string) =>
    request<{ message: string; summaries: DailyAttendanceSummary[] }>('/api/attendance/recompute', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
  finalizeAbsences: (date?: string, forcePastCutoffCheck = false) =>
    request<{
      finalizedCount: number;
      absentCount: number;
      holidayCount: number;
      leaveCount: number;
      skippedPrematureCount: number;
    }>('/api/attendance/finalize-absences', {
      method: 'POST',
      body: JSON.stringify({ date, forcePastCutoffCheck }),
    }),
  manualAdjust: (payload: { personId: string; date: string; newStatus: string; reason: string; adjustedBy?: string }) =>
    request<DailyAttendanceSummary>('/api/attendance/manual-adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Schedules
  getSchedules: () => request<WorkSchedule[]>('/api/schedules'),
  saveSchedule: (schedule: Partial<WorkSchedule>) =>
    request<WorkSchedule>('/api/schedules', { method: 'POST', body: JSON.stringify(schedule) }),

  // Holidays & Leave
  getHolidays: () => request<Holiday[]>('/api/holidays'),
  addHoliday: (holiday: { name: string; date: string; isRecurring?: boolean }) =>
    request<Holiday>('/api/holidays', { method: 'POST', body: JSON.stringify(holiday) }),
  deleteHoliday: (id: string) =>
    request<{ success: boolean }>(`/api/holidays/${id}`, { method: 'DELETE' }),
  getLeaveRequests: () => request<LeaveRequest[]>('/api/leave'),
  addLeaveRequest: (req: Partial<LeaveRequest>) =>
    request<LeaveRequest>('/api/leave', { method: 'POST', body: JSON.stringify(req) }),
  updateLeaveStatus: (id: string, status: 'approved' | 'rejected') =>
    request<{ success: boolean }>(`/api/leave/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Enrollment
  getEnrollments: (personId?: string) => {
    const q = personId ? `?personId=${personId}` : '';
    return request<EnrollmentRecord[]>(`/api/enrollment${q}`);
  },
  addEnrollment: (record: Partial<EnrollmentRecord>) =>
    request<EnrollmentRecord>('/api/enrollment', { method: 'POST', body: JSON.stringify(record) }),

  // Audit Logs
  getAuditLogs: (limit = 100) => request<AuditLog[]>(`/api/audit-logs?limit=${limit}`),

  // Settings
  getSettings: () => request<SystemSettings>('/api/settings'),
  updateSettings: (updates: Partial<SystemSettings>) =>
    request<SystemSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(updates) }),

  // Reports
  getReportsSummary: (period: 'daily' | 'weekly' | 'monthly') =>
    request<{
      period: string;
      timezone: string;
      activeHeadcount: number;
      presentCount: number;
      lateCount: number;
      absentCount: number;
      leaveCount: number;
      correctedCount: number;
      simulatedCount: number;
      attendancePercentage: number;
      summaries: DailyAttendanceSummary[];
    }>(`/api/reports/summary?period=${period}`),

  // Test Runner
  runTests: () =>
    request<{
      timestamp: string;
      total: number;
      passed: number;
      failed: number;
      results: { title: string; passed: boolean; message?: string; durationMs: number }[];
    }>('/api/tests/run'),

  // Hardware Simulation
  simulateScan: (payload: {
    clientRequestId?: string;
    personId: string;
    deviceId?: string;
    direction?: string;
    confidenceScore?: number;
    eventTimestamp?: string;
  }) =>
    request<{ simulated: boolean; result: unknown }>('/api/v1/devices/simulate-scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
