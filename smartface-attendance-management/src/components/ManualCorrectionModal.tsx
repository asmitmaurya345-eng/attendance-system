import React, { useState } from 'react';
import { X, Edit3, Check, AlertCircle } from 'lucide-react';
import { DailyAttendanceSummary, DailyStatus } from '../types/index.ts';

interface ManualCorrectionModalProps {
  summary: DailyAttendanceSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    personId: string;
    date: string;
    newStatus: DailyStatus;
    reason: string;
    adjustedBy: string;
  }) => Promise<void>;
  currentUserEmail: string;
}

export const ManualCorrectionModal: React.FC<ManualCorrectionModalProps> = ({
  summary,
  isOpen,
  onClose,
  onSave,
  currentUserEmail,
}) => {
  const [newStatus, setNewStatus] = useState<DailyStatus>('present');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (summary) {
      setNewStatus(summary.status);
      setReason(summary.adjustmentReason || '');
      setError('');
    }
  }, [summary, isOpen]);

  if (!isOpen || !summary) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A verifiable reason is strictly required for auditable manual attendance corrections.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSave({
        personId: summary.personId,
        date: summary.date,
        newStatus,
        reason: reason.trim(),
        adjustedBy: currentUserEmail,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50 zoom-in-95">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Auditable Punch Correction
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-white">
              {summary.personName} ({summary.personBadge})
            </p>
            <p className="text-slate-500 text-[11px]">
              Date: <span className="font-mono">{summary.date}</span> • Current status: <span className="font-semibold uppercase">{summary.status}</span>
            </p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Corrected Status *
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as DailyStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs capitalize"
            >
              <option value="present">Present (On Time)</option>
              <option value="late">Late Arrival</option>
              <option value="half_day">Half Day Worked</option>
              <option value="absent">Absent</option>
              <option value="leave">Approved Leave</option>
              <option value="holiday">Official Holiday</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Required Audit Reason *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Employee badge was damaged during transit; arrival at 08:58 confirmed by front desk supervisor."
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Logged to the permanent audit trail with timestamp and your administrator ID.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {submitting ? 'Applying Correction...' : 'Save Audit Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
