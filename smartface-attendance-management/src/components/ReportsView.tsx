import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Award,
  TrendingUp,
  AlertCircle,
  Clock,
  Building,
  CheckCircle2,
  Calendar,
  Filter,
  FileCheck,
} from 'lucide-react';
import { DailyAttendanceSummary, Person } from '../types/index.ts';

interface ReportsViewProps {
  summaries: DailyAttendanceSummary[];
  people: Person[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ summaries, people }) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');
  const [genuineOnly, setGenuineOnly] = useState(false);

  // Filter summaries based on period and genuine flag
  const filteredSummaries = summaries.filter((s) => {
    if (genuineOnly && s.isSimulated) return false;
    return true;
  });

  const departments = ['Engineering', 'Operations', 'Human Resources', 'Product & Design', 'Quality Assurance', 'Marketing'];

  const deptStats = departments.map((dept) => {
    const deptPeople = people.filter(p => p.department.toLowerCase() === dept.toLowerCase());
    const deptSummaries = filteredSummaries.filter(s => s.department.toLowerCase() === dept.toLowerCase());

    const present = deptSummaries.filter(s => s.status === 'present').length;
    const late = deptSummaries.filter(s => s.status === 'late').length;
    const totalPunches = present + late;
    const totalPossible = deptPeople.length || 1;
    const rate = Math.round((totalPunches / totalPossible) * 100);
    const punctuality = totalPunches > 0 ? Math.round((present / totalPunches) * 100) : 100;

    return {
      department: dept,
      headcount: deptPeople.length,
      present,
      late,
      attendanceRate: Math.min(100, rate),
      punctualityRate: punctuality,
    };
  });

  // Category counts
  const presentCount = filteredSummaries.filter(s => s.status === 'present').length;
  const lateCount = filteredSummaries.filter(s => s.status === 'late').length;
  const absentCount = filteredSummaries.filter(s => s.status === 'absent').length;
  const leaveCount = filteredSummaries.filter(s => s.status === 'leave').length;
  const correctedCount = filteredSummaries.filter(s => s.isManuallyAdjusted).length;
  const simulatedCount = summaries.filter(s => s.isSimulated).length;

  const totalPossible = people.length || 1;
  const overallRate = Math.round(((presentCount + lateCount) / totalPossible) * 100);

  const lateCases = filteredSummaries.filter(s => s.status === 'late');

  const downloadReport = () => {
    const headers = [
      'Report Period',
      'Date',
      'Badge ID',
      'Full Name',
      'Department',
      'First In (IST)',
      'Last Out (IST)',
      'Hours Worked',
      'Minutes Late',
      'Status',
      'Manually Corrected',
      'Correction Reason',
      'Simulated Record',
    ];

    const rows = filteredSummaries.map(s => [
      period.toUpperCase(),
      s.date,
      s.personBadge,
      `"${s.personName}"`,
      `"${s.department}"`,
      s.firstIn ? new Date(s.firstIn).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }) : '-',
      s.lastOut ? new Date(s.lastOut).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: true }) : '-',
      (s.totalWorkMinutes / 60).toFixed(1),
      s.lateMinutes,
      s.status,
      s.isManuallyAdjusted ? 'Yes' : 'No',
      `"${s.adjustmentReason || ''}"`,
      s.isSimulated ? 'Yes (Simulated)' : 'No (Genuine)',
    ]);

    const lines = [
      'SMARTFACE ENTERPRISE ATTENDANCE & AUDIT REPORT',
      `Generated: ${new Date().toISOString()} (Timezone: Asia/Kolkata IST)`,
      `Period: ${period.toUpperCase()} | Genuine Only Filter: ${genuineOnly ? 'ENABLED' : 'DISABLED'}`,
      `Total Headcount: ${people.length} | Present Rate: ${overallRate}% | Late Count: ${lateCount} | Corrected: ${correctedCount} | Simulated: ${simulatedCount}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartface_report_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Executive Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Attendance percentages, shift grace adherence, and distinct tracking for pending, corrected, and simulated records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            {(['daily', 'weekly', 'monthly', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium cursor-pointer transition ${
                  period === p
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setGenuineOnly(!genuineOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
              genuineOnly
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-bold'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {genuineOnly ? 'Genuine Only' : 'Include Simulated'}
          </button>

          <button
            onClick={downloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-slate-400 text-[11px] block">Overall Attendance</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overallRate}%</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">{presentCount + lateCount} active present</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-slate-400 text-[11px] block">Late Arrivals</span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{lateCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Exceeded shift grace</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-slate-400 text-[11px] block">Absent</span>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{absentCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">After shift cutoff</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-slate-400 text-[11px] block">Approved Leave</span>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{leaveCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Verified PTO / Sick</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-slate-400 text-[11px] block">Audited Corrections</span>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{correctedCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Manual override with reason</span>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <span className="text-slate-400 text-[11px] block">Simulated Records</span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{simulatedCount}</p>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Isolated dev testbench</span>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            Departmental Attendance & Punctuality Breakdown ({period.toUpperCase()})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Evaluates active headcount attendance and percentage of arrivals within grace window in Asia/Kolkata timezone.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[10px] uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Active Staff</th>
                <th className="py-2.5 px-4">Present</th>
                <th className="py-2.5 px-4">Late Arrivals</th>
                <th className="py-2.5 px-4">Attendance Rate</th>
                <th className="py-2.5 px-4 text-right">Punctuality Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deptStats.map((d) => (
                <tr key={d.department} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    {d.department}
                  </td>
                  <td className="py-3 px-4 font-mono">{d.headcount}</td>
                  <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                    {d.present}
                  </td>
                  <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400 font-semibold">
                    {d.late}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden max-w-[100px]">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: `${d.attendanceRate}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-[11px] font-bold">{d.attendanceRate}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                    {d.punctualityRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
