import React, { useState } from 'react';
import {
  CalendarCheck,
  Calendar,
  RefreshCw,
  Zap,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  HelpCircle,
  FileCheck,
} from 'lucide-react';
import { DailyAttendanceSummary, DailyStatus } from '../types/index.ts';

interface DailyAttendanceViewProps {
  summaries: DailyAttendanceSummary[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onRecompute: (date: string) => void;
  onFinalizeAbsences: (date: string) => void;
  onOpenManualCorrection: (summary: DailyAttendanceSummary) => void;
}

export const DailyAttendanceView: React.FC<DailyAttendanceViewProps> = ({
  summaries,
  selectedDate,
  setSelectedDate,
  onRecompute,
  onFinalizeAbsences,
  onOpenManualCorrection,
}) => {
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter
  const filtered = summaries.filter((s) => {
    const matchesDept =
      departmentFilter === 'all' || s.department.toLowerCase() === departmentFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesDept && matchesStatus;
  });

  const presentCount = summaries.filter(s => s.status === 'present').length;
  const lateCount = summaries.filter(s => s.status === 'late').length;
  const halfDayCount = summaries.filter(s => s.status === 'half_day').length;
  const absentCount = summaries.filter(s => s.status === 'absent').length;
  const leaveCount = summaries.filter(s => s.status === 'leave').length;
  const holidayCount = summaries.filter(s => s.status === 'holiday').length;

  const exportDailyCSV = () => {
    const headers = ['Date', 'Badge ID', 'Full Name', 'Department', 'First In', 'Last Out', 'Hours Worked', 'Late Minutes', 'Status', 'Manual Override', 'Reason'];
    const rows = filtered.map(s => [
      s.date,
      s.personBadge,
      `"${s.personName}"`,
      `"${s.department}"`,
      s.firstIn ? new Date(s.firstIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) : '-',
      s.lastOut ? new Date(s.lastOut).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true }) : '-',
      (s.totalWorkMinutes / 60).toFixed(1),
      s.lateMinutes,
      s.status,
      s.isManuallyAdjusted ? 'Yes' : 'No',
      `"${s.adjustmentReason || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartface_daily_attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatMinutes = (totalMin: number) => {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h ${m}m`;
  };

  const getStatusBadge = (status: DailyStatus) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Present
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Late
          </span>
        );
      case 'half_day':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-3 h-3" /> Half Day
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            Absent
          </span>
        );
      case 'leave':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            Approved Leave
          </span>
        );
      case 'holiday':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10px] uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            Official Holiday
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Daily Attendance Summaries
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Derived shift evaluations, first/last punch collation, grace period math, and audited corrections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => onRecompute(selectedDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Recalculate shift attendance from immutable event stream"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
            Recompute
          </button>

          <button
            onClick={() => onFinalizeAbsences(selectedDate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Mark remaining active people as absent unless approved on leave or holiday"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Finalize Day
          </button>

          <button
            onClick={exportDailyCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Metrics Pill Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-slate-400 text-[11px]">Present On-Time</span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{presentCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-slate-400 text-[11px]">Late Arrivals</span>
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">{lateCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-slate-400 text-[11px]">Half-Day</span>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400 mt-0.5">{halfDayCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-slate-400 text-[11px]">Absent</span>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">{absentCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-slate-400 text-[11px]">Approved Leave</span>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">{leaveCount}</p>
        </div>
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-slate-400 text-[11px]">Holiday</span>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{holidayCount}</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Department:</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
          >
            <option value="all">All Departments</option>
            <option value="engineering">Engineering</option>
            <option value="operations">Operations</option>
            <option value="human resources">Human Resources</option>
            <option value="product & design">Product & Design</option>
            <option value="quality assurance">Quality Assurance</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="half_day">Half Day</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
            <option value="holiday">Holiday</option>
          </select>
        </div>
      </div>

      {/* Daily Summaries Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">First In</th>
                <th className="py-3 px-4">Last Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Late Arrival</th>
                <th className="py-3 px-4">Daily Status</th>
                <th className="py-3 px-4">Audit Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                >
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {item.personName}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                      {item.personBadge}
                    </p>
                  </td>

                  <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-300">
                    {item.department}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.firstIn ? (
                      <span title={`UTC: ${item.firstIn}`}>
                        {new Date(item.firstIn).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.lastOut ? (
                      <span title={`UTC: ${item.lastOut}`}>
                        {new Date(item.lastOut).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    <div>{item.totalWorkMinutes > 0 ? formatMinutes(item.totalWorkMinutes) : '—'}</div>
                    {item.punchSessions && item.punchSessions.length > 1 && (
                      <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-sans" title={item.punchSessions.map((s, idx) => `Session ${idx+1}: ${s.minutesWorked}m`).join(', ')}>
                        {item.punchSessions.length} sessions
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.lateMinutes > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        +{item.lateMinutes} min
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>

                  <td className="py-3 px-4">{getStatusBadge(item.status)}</td>

                  <td className="py-3 px-4">
                    {item.isManuallyAdjusted ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium"
                        title={item.adjustmentReason}
                      >
                        <FileCheck className="w-3 h-3 text-amber-500" /> Manually Corrected
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Automated</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onOpenManualCorrection(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition text-[11px] font-medium cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-indigo-500" />
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No attendance records found for {selectedDate}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
