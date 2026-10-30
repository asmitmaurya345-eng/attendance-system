import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  ShieldCheck,
  ShieldAlert,
  Camera,
  CalendarCheck,
  Clock,
  Activity,
  CheckCircle2,
  Trash2,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Person, AttendanceEvent, DailyAttendanceSummary, EnrollmentRecord, WorkSchedule } from '../types/index.ts';
import { api } from '../utils/api.ts';

interface PersonProfileModalProps {
  person: Person | null;
  isOpen: boolean;
  onClose: () => void;
  onEnrollPhoto: (person: Person) => void;
  onDataChanged?: () => void;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  person,
  isOpen,
  onClose,
  onEnrollPhoto,
  onDataChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [summaries, setSummaries] = useState<DailyAttendanceSummary[]>([]);
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadData = () => {
    if (person && isOpen) {
      setLoading(true);
      api.getPersonById(person.id)
        .then((res) => {
          setEnrollments(res.enrollments);
          setEvents(res.events);
          setSummaries(res.summaries);
          setSchedule(res.schedule);
        })
        .catch((err) => console.error('Failed to load person profile:', err))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    loadData();
    setActionMsg('');
  }, [person, isOpen]);

  if (!isOpen || !person) return null;

  const presentCount = summaries.filter(s => s.status === 'present' || s.status === 'late').length;
  const lateCount = summaries.filter(s => s.status === 'late').length;
  const onTimeRate = presentCount > 0 ? Math.round(((presentCount - lateCount) / presentCount) * 100) : 100;

  const handleRevokeConsent = async () => {
    if (confirm(`Revoke biometric consent for ${person.fullName}? This will purge all enrolled face templates from active recognition.`)) {
      try {
        await api.revokeConsent(person.id);
        setActionMsg('Biometric consent revoked and all facial templates purged.');
        loadData();
        onDataChanged?.();
      } catch (err: unknown) {
        alert((err as Error).message);
      }
    }
  };

  const handleDeleteBiometrics = async () => {
    if (confirm(`Permanently delete all face photos and vector data for ${person.fullName}?`)) {
      try {
        await api.deleteBiometrics(person.id);
        setActionMsg('All enrolled face photos and vector embeddings permanently deleted.');
        loadData();
        onDataChanged?.();
      } catch (err: unknown) {
        alert((err as Error).message);
      }
    }
  };

  const handleExportBiometrics = async () => {
    try {
      const data = await api.exportBiometrics(person.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `biometric_dossier_${person.personId}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Employee Biometric & Attendance Dossier
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {actionMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{actionMsg}</span>
            </div>
          )}

          {/* Top Banner Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {person.avatarUrl ? (
                <img
                  src={person.avatarUrl}
                  alt={person.fullName}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-indigo-500/20 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 text-xl font-bold flex items-center justify-center">
                  {person.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {person.fullName}
                  </h3>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                    {person.personId}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {person.designation} • {person.department}
                </p>
                <p className="text-slate-400 dark:text-slate-500 text-[11px] mt-1">
                  {person.email} • {person.phone || 'No phone recorded'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <button
                onClick={() => {
                  onClose();
                  onEnrollPhoto(person);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                Enroll / Stage Photo
              </button>
              <div className="flex items-center gap-1.5 text-[11px]">
                {person.consentStatus === 'granted' ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5" /> Biometric Consent Granted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5" /> Consent Withheld / Revoked
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-slate-400 text-[11px]">On-Time Punctuality</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{onTimeRate}%</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-slate-400 text-[11px]">Recorded Shifts</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{summaries.length}</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-slate-400 text-[11px]">Late Arrivals</span>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lateCount}</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-slate-400 text-[11px]">Staged Photo Angles</span>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{enrollments.length}</p>
            </div>
          </div>

          {/* Biometric Privacy & Data Governance Controls */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Biometric Privacy & Compliance Controls
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Data retention: {person.retentionPolicy || 'Tenure + 30 Days'} • DPDP Act 2023 compliant
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportBiometrics}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Export Audit Dossier
                </button>

                {person.consentStatus === 'granted' && (
                  <button
                    onClick={handleRevokeConsent}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-[11px] font-medium hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Revoke Consent
                  </button>
                )}

                {enrollments.length > 0 && (
                  <button
                    onClick={handleDeleteBiometrics}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-rose-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-medium cursor-pointer transition"
                    title="Delete face photos and vector data"
                  >
                    <Trash2 className="w-3 h-3" />
                    Purge Biometrics
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Biometric Enrollment Images */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Staged Face Photos (Phase 2 Vector Pipeline)
            </h4>
            {enrollments.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {enrollments.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                  >
                    <div className="aspect-square rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 relative group">
                      <img
                        src={rec.photoUrl}
                        alt="Enrolled face"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[11px]">
                        Quality Score: {rec.qualityScore}%
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="capitalize font-medium text-slate-700 dark:text-slate-300">
                        {rec.photoAngle.replace('_', ' ')}
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Staged
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-400 text-xs">
                No biometric face photographs registered for this employee yet.
              </div>
            )}
          </div>

          {/* Assigned Work Schedule */}
          {schedule && (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Assigned Schedule: {schedule.name}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                  Working hours {schedule.workStartTime} to {schedule.workEndTime} (IST) • Grace period: {schedule.gracePeriodMinutes} mins
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 font-semibold">
                Active Policy
              </span>
            </div>
          )}

          {/* Recent Individual Scans */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Recent Hardware Scan Events
            </h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 text-[10px] font-semibold uppercase">
                  <tr>
                    <th className="py-2 px-3">Timestamp (IST)</th>
                    <th className="py-2 px-3">Direction</th>
                    <th className="py-2 px-3">Terminal</th>
                    <th className="py-2 px-3">Confidence</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {events.slice(0, 5).map((evt) => (
                    <tr key={evt.id}>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {new Date(evt.eventTimestamp).toLocaleString('en-US', {
                          timeZone: 'Asia/Kolkata',
                          hour12: true,
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          evt.direction === 'entry' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        }`}>
                          {evt.direction}
                        </span>
                      </td>
                      <td className="py-2 px-3">{evt.deviceName || 'Camera Gate'}</td>
                      <td className="py-2 px-3 font-mono">{Math.round(evt.confidenceScore * 100)}%</td>
                      <td className="py-2 px-3">
                        {evt.isDuplicate ? (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold text-[10px]">
                            Duplicate Ignored
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                            Processed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        No scan records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
