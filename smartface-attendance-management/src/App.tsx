/**
 * SmartFace Attendance Management System - Main Application
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar, NavigationTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { PeopleDirectoryView } from './components/PeopleDirectoryView.tsx';
import { PersonModal } from './components/PersonModal.tsx';
import { PersonProfileModal } from './components/PersonProfileModal.tsx';
import { EnrollmentView } from './components/EnrollmentView.tsx';
import { DailyAttendanceView } from './components/DailyAttendanceView.tsx';
import { AttendanceEventsView } from './components/AttendanceEventsView.tsx';
import { AttendanceHistoryView } from './components/AttendanceHistoryView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { DevicesView } from './components/DevicesView.tsx';
import { DeviceModal } from './components/DeviceModal.tsx';
import { CameraSimulatorModal } from './components/CameraSimulatorModal.tsx';
import { Esp32DocsModal } from './components/Esp32DocsModal.tsx';
import { SchedulesView } from './components/SchedulesView.tsx';
import { HolidaysLeaveView } from './components/HolidaysLeaveView.tsx';
import { AuditLogsView } from './components/AuditLogsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { TestsView } from './components/TestsView.tsx';
import { ManualCorrectionModal } from './components/ManualCorrectionModal.tsx';
import { LoginModal } from './components/LoginModal.tsx';

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
  AuthUser,
  DailyStatus,
} from './types/index.ts';
import { api, setStoredToken } from './utils/api.ts';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('smartface_theme') === 'dark';
  });

  // Current session authentication state (verified via server session token)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [genuineOnly, setGenuineOnly] = useState(false);

  // Application Domain State
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyAttendanceSummary[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // Selected date for Daily Attendance view (YYYY-MM-DD in Asia/Kolkata)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modals state
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null);

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);
  const [isEspDocsModalOpen, setIsEspDocsModalOpen] = useState(false);

  const [isManualCorrectionOpen, setIsManualCorrectionOpen] = useState(false);
  const [correctingSummary, setCorrectingSummary] = useState<DailyAttendanceSummary | null>(null);

  // Person selected for direct enrollment from directory
  const [enrollingPerson, setEnrollingPerson] = useState<Person | null>(null);

  // Sync dark mode with root HTML class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('smartface_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('smartface_theme', 'light');
    }
  }, [darkMode]);

  // Load active session user if token is present
  useEffect(() => {
    api.getMe()
      .then((res) => {
        if (res?.user) setCurrentUser(res.user);
        else setCurrentUser(null);
      })
      .catch(() => {
        setCurrentUser(null);
      });
  }, []);

  // Master fetch function
  const loadAllData = useCallback(async () => {
    try {
      const [
        metricsData,
        peopleData,
        devicesData,
        eventsData,
        dailyData,
        schedulesData,
        holidaysData,
        leaveData,
        auditData,
        settingsData,
      ] = await Promise.all([
        api.getMetrics(genuineOnly).catch(() => null),
        api.getPeople().catch(() => []),
        api.getDevices().catch(() => []),
        api.getEvents({ limit: 100, isSimulated: genuineOnly ? false : undefined }).catch(() => []),
        api.getDailyAttendance(selectedDate).catch(() => []),
        api.getSchedules().catch(() => []),
        api.getHolidays().catch(() => []),
        api.getLeaveRequests().catch(() => []),
        api.getAuditLogs(100).catch(() => []),
        api.getSettings().catch(() => null),
      ]);

      if (metricsData) setMetrics(metricsData);
      setPeople(peopleData);
      setDevices(devicesData);
      setEvents(eventsData);
      setDailySummaries(dailyData);
      setSchedules(schedulesData);
      setHolidays(holidaysData);
      setLeaveRequests(leaveData);
      setAuditLogs(auditData);
      if (settingsData) setSettings(settingsData);
    } catch (err) {
      console.error('Error fetching SmartFace data:', err);
    }
  }, [selectedDate, genuineOnly]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Role authorization guard
  const canPerformMutation = (actionName: string): boolean => {
    if (!currentUser) {
      alert(`Authentication Required: Please sign in with an authorized account to ${actionName}.`);
      setIsLoginModalOpen(true);
      return false;
    }
    if (currentUser.role === 'auditor') {
      alert(`Access Denied: The Compliance Auditor role has strictly read-only permissions and cannot ${actionName}.`);
      return false;
    }
    return true;
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to end your SmartFace session?')) {
      await api.logout().catch(() => {});
      setStoredToken(null);
      setCurrentUser(null);
      setIsLoginModalOpen(true);
    }
  };

  // Handlers
  const handleSavePerson = async (personData: Partial<Person>) => {
    if (!canPerformMutation('register or edit personnel')) return;
    if (editingPerson) {
      await api.updatePerson(editingPerson.id, personData);
    } else {
      await api.createPerson(personData);
    }
    await loadAllData();
  };

  const handleDeletePerson = async (id: string) => {
    if (!canPerformMutation('delete employee profiles')) return;
    await api.deletePerson(id);
    await loadAllData();
  };

  const handleSaveDevice = async (deviceData: Partial<CameraDevice>) => {
    if (!canPerformMutation('provision hardware devices')) return;
    await api.createDevice(deviceData);
    await loadAllData();
  };

  const handleDeleteDevice = async (id: string) => {
    if (!canPerformMutation('remove hardware terminals')) return;
    await api.deleteDevice(id);
    await loadAllData();
  };

  const handleRecomputeAttendance = async (date: string) => {
    if (!canPerformMutation('recompute shift attendance records')) return;
    await api.recomputeAttendance(date);
    await loadAllData();
  };

  const handleFinalizeAbsences = async (date?: string) => {
    if (!canPerformMutation('finalize attendance absences')) return;
    const target = date || selectedDate;
    const res = await api.finalizeAbsences(target, true);
    alert(
      `Absence Finalization Complete for ${target}:\n` +
      `• Finalized: ${res.finalizedCount} records\n` +
      `• Marked Absent: ${res.absentCount}\n` +
      `• Approved Leave: ${res.leaveCount}\n` +
      `• Statutory Holidays: ${res.holidayCount}\n` +
      (res.skippedPrematureCount > 0 ? `• Protected Before Cutoff: ${res.skippedPrematureCount}` : '')
    );
    await loadAllData();
  };

  const handleManualCorrectionSave = async (payload: {
    personId: string;
    date: string;
    newStatus: DailyStatus;
    reason: string;
    adjustedBy: string;
  }) => {
    if (!canPerformMutation('perform manual attendance corrections')) return;
    await api.manualAdjust(payload);
    await loadAllData();
  };

  const handleSaveSchedule = async (sched: Partial<WorkSchedule>) => {
    if (!canPerformMutation('modify shift policies')) return;
    await api.saveSchedule(sched);
    await loadAllData();
  };

  const handleAddHoliday = async (h: { name: string; date: string; isRecurring?: boolean }) => {
    if (!canPerformMutation('add statutory holidays')) return;
    await api.addHoliday(h);
    await loadAllData();
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!canPerformMutation('delete holidays')) return;
    await api.deleteHoliday(id);
    await loadAllData();
  };

  const handleAddLeave = async (l: Partial<LeaveRequest>) => {
    if (!canPerformMutation('submit employee leave')) return;
    await api.addLeaveRequest(l);
    await loadAllData();
  };

  const handleUpdateLeaveStatus = async (id: string, status: 'approved' | 'rejected') => {
    if (!canPerformMutation('approve or reject leave requests')) return;
    await api.updateLeaveStatus(id, status);
    await loadAllData();
  };

  const handleSaveSettings = async (updates: Partial<SystemSettings>) => {
    if (!canPerformMutation('modify system settings')) return;
    await api.updateSettings(updates);
    await loadAllData();
  };

  const onlineDevicesCount = devices.filter(d => d.status === 'online').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        dbMode={metrics?.dbMode || 'LOCAL_DEVELOPMENT_STORE'}
        storageMode={metrics?.storageMode || (metrics?.dbMode === 'SUPABASE_CONNECTED' ? 'SUPABASE_CONNECTED' : 'LOCAL_DEVELOPMENT_STORE')}
        onOpenSimulator={() => setIsSimulatorModalOpen(true)}
        onRefresh={loadAllData}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Compact Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onlineDeviceCount={onlineDevicesCount}
        />

        {/* Main Content Workspace */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              recentEvents={events}
              devices={devices}
              onOpenSimulator={() => setIsSimulatorModalOpen(true)}
              onNavigate={(tab) => setCurrentTab(tab as NavigationTab)}
              onRefresh={loadAllData}
              onFinalizeAbsences={() => handleFinalizeAbsences()}
              genuineOnly={genuineOnly}
              setGenuineOnly={setGenuineOnly}
            />
          )}

          {currentTab === 'daily_attendance' && (
            <DailyAttendanceView
              summaries={dailySummaries}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onRecompute={handleRecomputeAttendance}
              onFinalizeAbsences={handleFinalizeAbsences}
              onOpenManualCorrection={(summary) => {
                setCorrectingSummary(summary);
                setIsManualCorrectionOpen(true);
              }}
            />
          )}

          {currentTab === 'attendance_events' && (
            <AttendanceEventsView events={events} />
          )}

          {currentTab === 'attendance_history' && (
            <AttendanceHistoryView allSummaries={dailySummaries} />
          )}

          {currentTab === 'reports' && (
            <ReportsView summaries={dailySummaries} people={people} />
          )}

          {currentTab === 'people' && (
            <PeopleDirectoryView
              people={people}
              onAddPerson={() => {
                setEditingPerson(null);
                setIsPersonModalOpen(true);
              }}
              onEditPerson={(p) => {
                setEditingPerson(p);
                setIsPersonModalOpen(true);
              }}
              onViewProfile={(p) => {
                setViewingPerson(p);
                setIsProfileModalOpen(true);
              }}
              onEnrollPhoto={(p) => {
                setEnrollingPerson(p);
                setCurrentTab('enrollment');
              }}
              onDeletePerson={handleDeletePerson}
            />
          )}

          {currentTab === 'enrollment' && (
            <EnrollmentView
              people={people}
              selectedPerson={enrollingPerson}
              onEnrollmentComplete={loadAllData}
            />
          )}

          {currentTab === 'devices' && (
            <DevicesView
              devices={devices}
              onAddDevice={() => setIsDeviceModalOpen(true)}
              onOpenDocs={() => setIsEspDocsModalOpen(true)}
              onOpenSimulator={() => setIsSimulatorModalOpen(true)}
              onDeleteDevice={handleDeleteDevice}
            />
          )}

          {currentTab === 'schedules' && (
            <SchedulesView
              schedules={schedules}
              onSaveSchedule={handleSaveSchedule}
            />
          )}

          {currentTab === 'holidays_leave' && (
            <HolidaysLeaveView
              holidays={holidays}
              leaveRequests={leaveRequests}
              people={people}
              onAddHoliday={handleAddHoliday}
              onDeleteHoliday={handleDeleteHoliday}
              onAddLeave={handleAddLeave}
              onUpdateLeaveStatus={handleUpdateLeaveStatus}
            />
          )}

          {currentTab === 'audit_logs' && (
            <AuditLogsView logs={auditLogs} />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onRunTests={() => setCurrentTab('tests')}
            />
          )}

          {currentTab === 'tests' && (
            <TestsView />
          )}
        </main>
      </div>

      {/* Modals Container */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          loadAllData();
        }}
      />

      <PersonModal
        isOpen={isPersonModalOpen}
        onClose={() => setIsPersonModalOpen(false)}
        onSave={handleSavePerson}
        editingPerson={editingPerson}
        schedules={schedules}
      />

      <PersonProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        person={viewingPerson}
        onEnrollPhoto={(p) => {
          setEnrollingPerson(p);
          setCurrentTab('enrollment');
        }}
        onDataChanged={loadAllData}
      />

      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        onSave={handleSaveDevice}
      />

      <CameraSimulatorModal
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        people={people}
        devices={devices}
        onScanCompleted={loadAllData}
      />

      <Esp32DocsModal
        isOpen={isEspDocsModalOpen}
        onClose={() => setIsEspDocsModalOpen(false)}
        deviceTokenExample={devices[0]?.authToken}
      />

      <ManualCorrectionModal
        isOpen={isManualCorrectionOpen}
        onClose={() => setIsManualCorrectionOpen(false)}
        summary={correctingSummary}
        onSave={handleManualCorrectionSave}
        currentUserEmail={currentUser?.email || 'admin@smartface.internal'}
      />
    </div>
  );
}
