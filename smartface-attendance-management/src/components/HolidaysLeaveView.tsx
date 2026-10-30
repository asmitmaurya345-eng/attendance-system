import React, { useState } from 'react';
import {
  CalendarOff,
  Palmtree,
  Plus,
  CheckCircle2,
  XCircle,
  Calendar,
  Trash2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { Holiday, LeaveRequest, Person } from '../types/index.ts';

interface HolidaysLeaveViewProps {
  holidays: Holiday[];
  leaveRequests: LeaveRequest[];
  people: Person[];
  onAddHoliday: (h: { name: string; date: string; isRecurring?: boolean }) => Promise<void>;
  onDeleteHoliday: (id: string) => Promise<void>;
  onAddLeave: (l: Partial<LeaveRequest>) => Promise<void>;
  onUpdateLeaveStatus: (id: string, status: 'approved' | 'rejected') => Promise<void>;
}

export const HolidaysLeaveView: React.FC<HolidaysLeaveViewProps> = ({
  holidays,
  leaveRequests,
  people,
  onAddHoliday,
  onDeleteHoliday,
  onAddLeave,
  onUpdateLeaveStatus,
}) => {
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // New holiday state
  const [holName, setHolName] = useState('');
  const [holDate, setHolDate] = useState('');

  // New leave state
  const [leavePersonId, setLeavePersonId] = useState(people[0]?.id || '');
  const [leaveType, setLeaveType] = useState<'annual' | 'sick' | 'casual' | 'unpaid'>('annual');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holName || !holDate) return;
    await onAddHoliday({ name: holName, date: holDate, isRecurring: true });
    setShowHolidayModal(false);
    setHolName('');
    setHolDate('');
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leavePersonId || !startDate || !endDate) return;
    await onAddLeave({
      personId: leavePersonId,
      leaveType,
      startDate,
      endDate,
      reason: leaveReason || 'Personal PTO',
    });
    setShowLeaveModal(false);
    setLeaveReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Holidays & Leave Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define statutory corporate holidays and approve employee PTO requests to automatically prevent erroneous absence marks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHolidayModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Holiday
          </button>

          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Submit Leave Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Holidays List */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Statutory Holidays ({holidays.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {holidays.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{h.name}</p>
                  <p className="font-mono text-[11px] text-slate-400">{h.date}</p>
                </div>
                <button
                  onClick={() => onDeleteHoliday(h.id)}
                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                  title="Remove holiday"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Leave Requests */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-indigo-500" />
              Employee Leave Requests & Approvals
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 text-[10px] uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Dates</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaveRequests.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{l.personName}</p>
                      <p className="font-mono text-[10px] text-slate-400">{l.personBadge}</p>
                    </td>
                    <td className="py-3 px-3 uppercase font-semibold text-[10px] text-slate-600 dark:text-slate-400">
                      {l.leaveType}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px]">
                      {l.startDate} to {l.endDate}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                          l.status === 'approved'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : l.status === 'rejected'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {l.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onUpdateLeaveStatus(l.id, 'approved')}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 cursor-pointer"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onUpdateLeaveStatus(l.id, 'rejected')}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 cursor-pointer"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono">Audited</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Holiday Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Add Company Holiday</h2>
            <form onSubmit={handleCreateHoliday} className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Holiday Name
                </label>
                <input
                  type="text"
                  value={holName}
                  onChange={(e) => setHolName(e.target.value)}
                  placeholder="e.g. Founders Day"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={holDate}
                  onChange={(e) => setHolDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 text-white font-semibold cursor-pointer"
                >
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Record Approved Leave</h2>
            <form onSubmit={handleCreateLeave} className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Employee
                </label>
                <select
                  value={leavePersonId}
                  onChange={(e) => setLeavePersonId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ({p.personId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white uppercase"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Medical / Sick</option>
                  <option value="casual">Casual Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Doctor appointment verified"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLeaveModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-indigo-600 text-white font-semibold cursor-pointer"
                >
                  Save Leave Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
