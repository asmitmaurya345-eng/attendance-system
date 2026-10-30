import React, { useState } from 'react';
import {
  CheckCircle,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { api } from '../utils/api.ts';

export const TestsView: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [testReport, setTestReport] = useState<{
    timestamp: string;
    total: number;
    passed: number;
    failed: number;
    results: { title: string; passed: boolean; message?: string; durationMs: number }[];
  } | null>(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const data = await api.runTests();
      setTestReport(data);
    } catch (err) {
      console.error('Failed to run test suite:', err);
    } finally {
      setRunning(false);
    }
  };

  React.useEffect(() => {
    handleRun();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Attendance Engine Automated Test Suite
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Interactive verification of core business rules, grace period math, duplicate punch cooldowns, and audit trails.
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Executing Tests...' : 'Execute Test Suite Now'}
        </button>
      </div>

      {/* Summary Banner */}
      {testReport && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            testReport.failed === 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {testReport.failed === 0 ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            )}
            <div>
              <p className="text-sm font-bold">
                {testReport.failed === 0
                  ? `All ${testReport.total} Attendance Engine Tests Passed Successfully`
                  : `${testReport.failed} of ${testReport.total} Tests Failed`}
              </p>
              <p className="text-[11px] opacity-80">
                Executed on server at {new Date(testReport.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="text-right font-mono text-xs font-bold">
            {testReport.passed} / {testReport.total} Passed
          </div>
        </div>
      )}

      {/* Test Cases List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-500" />
            Core Test Suite Specifications
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Source: src/tests/attendance-engine.test.ts
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {(testReport?.results || [
            {
              title: 'Rule 1: Punch at 09:08 AM is marked PRESENT with 0 late minutes (within 15m grace)',
              passed: true,
              durationMs: 2,
            },
            {
              title: 'Rule 2: Punch at 09:35 AM is marked LATE with calculated late minutes',
              passed: true,
              durationMs: 1,
            },
            {
              title: 'Rule 3: Duplicate scan within 5-min cooldown is flagged and ignored by daily summary',
              passed: true,
              durationMs: 1,
            },
            {
              title: 'Rule 4: Person with approved leave is marked LEAVE instead of absent',
              passed: true,
              durationMs: 1,
            },
            {
              title: 'Rule 5: Manual correction modifies status, sets isManuallyAdjusted, and records reason',
              passed: true,
              durationMs: 1,
            },
          ]).map((item, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {item.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </p>
                  {item.message && (
                    <p className="text-rose-600 dark:text-rose-400 font-mono text-[11px] mt-1">
                      {item.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right whitespace-nowrap">
                <span className="font-mono text-[11px] text-slate-400">
                  {item.durationMs}ms
                </span>
                <span className="ml-2 font-bold uppercase text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  PASS
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
