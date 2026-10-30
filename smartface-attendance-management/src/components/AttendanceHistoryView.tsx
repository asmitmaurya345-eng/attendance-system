import React, { useState } from 'react';
import {
  History,
  Calendar,
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserX,
} from 'lucide-react';
import { DailyAttendanceSummary } from '../types/index.ts';

interface AttendanceHistoryViewProps {
  allSummaries: DailyAttendanceSummary[];
}

export const AttendanceHistoryView: React.FC<AttendanceHistoryViewProps> = ({ allSummaries }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = allSummaries.filter((s) => {
    const matchesSearch =
      s.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.personBadge.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.date.includes(searchTerm);
    const matchesDept =
      departmentFilter === 'all' || s.department.toLowerCase() === departmentFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const exportCSV = () => {
    const headers = ['Date', 'Badge ID', 'Full Name', 'Department', 'First In', 'Last Out', 'Hours', 'Late Min', 'Status', 'Adjusted', 'Reason'];
    const rows = filtered.map(s => [
      s.date,
      s.personBadge,
      `"${s.personName}"`,
      `"${s.department}"`,
      s.firstIn ? new Date(s.firstIn).toLocaleTimeString() : '-',
      s.lastOut ? new Date(s.lastOut).toLocaleTimeString() : '-',
      (s.totalWorkMinutes / 60).toFixed(1),
      s.lateMinutes,
      s.status,
      s.isManuallyAdjusted ? 'Yes' : 'No',
      `"${s.adjustmentReason || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartface_attendance_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Attendance History & Archives
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Historical shift records, cumulative time worked, and punctuality audit records across all personnel.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export Historical CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3 text-xs shadow-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, badge ID, or date (YYYY-MM-DD)..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
          />
        </div>

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

      {/* History Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">First In</th>
                <th className="py-3 px-4">Last Out</th>
                <th className="py-3 px-4">Work Time</th>
                <th className="py-3 px-4">Late Arrival</th>
                <th className="py-3 px-4">Final Status</th>
                <th className="py-3 px-4 text-right">Adjustment Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                  <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                    {item.date}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 dark:text-white">{item.personName}</p>
                    <p className="font-mono text-[10px] text-slate-400">{item.personBadge}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{item.department}</td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.firstIn ? new Date(item.firstIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.lastOut ? new Date(item.lastOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.totalWorkMinutes > 0 ? `${(item.totalWorkMinutes / 60).toFixed(1)} hrs` : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px]">
                    {item.lateMinutes > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        +{item.lateMinutes} min
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="capitalize font-semibold text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] text-slate-500 max-w-xs truncate">
                    {item.adjustmentReason || '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No historical records matching filter.
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
