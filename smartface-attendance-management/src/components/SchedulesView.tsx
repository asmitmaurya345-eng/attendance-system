import React, { useState } from 'react';
import {
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Save,
} from 'lucide-react';
import { WorkSchedule } from '../types/index.ts';

interface SchedulesViewProps {
  schedules: WorkSchedule[];
  onSaveSchedule: (sched: Partial<WorkSchedule>) => Promise<void>;
}

export const SchedulesView: React.FC<SchedulesViewProps> = ({ schedules, onSaveSchedule }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(15);
  const [halfDayThresholdMinutes, setHalfDayThresholdMinutes] = useState(240);
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSaveSchedule({
        name: name.trim(),
        workStartTime,
        workEndTime,
        gracePeriodMinutes: Number(gracePeriodMinutes),
        halfDayThresholdMinutes: Number(halfDayThresholdMinutes),
        workDays: [1, 2, 3, 4, 5],
        isDefault,
      });
      setShowAddModal(false);
      setName('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Work Shifts & Attendance Policies
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define daily operating hours, grace period allowances before late status, and minimum half-day thresholds.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create New Shift
        </button>
      </div>

      {/* Shifts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.map((s) => (
          <div
            key={s.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    {s.name}
                  </h3>
                  {s.isDefault && (
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      Default Policy
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Working Hours: {s.workStartTime} to {s.workEndTime}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">Grace Period Allowance</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {s.gracePeriodMinutes} minutes
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Cutoff: {s.workStartTime} + {s.gracePeriodMinutes}m
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 text-[11px] block">Half-Day Threshold</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {(s.halfDayThresholdMinutes / 60).toFixed(1)} hours
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Minimum work time
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">
                Active Days: <strong>Monday — Friday</strong>
              </span>
              {!s.isDefault && (
                <button
                  onClick={() => onSaveSchedule({ ...s, isDefault: true })}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                >
                  Make Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal to add shift */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Configure Work Shift Policy
            </h2>
            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Shift Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Evening Technical Shift"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={gracePeriodMinutes}
                    onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Half-Day (Minutes)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={480}
                    value={halfDayThresholdMinutes}
                    onChange={(e) => setHalfDayThresholdMinutes(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDef"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <label htmlFor="isDef" className="text-slate-800 dark:text-slate-200">
                  Set as system default shift policy
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-indigo-600 text-white font-semibold cursor-pointer"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
