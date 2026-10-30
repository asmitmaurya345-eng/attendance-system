import React, { useState } from 'react';
import {
  Settings,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Save,
  Play,
  Clock,
  Radio,
  FileCode,
} from 'lucide-react';
import { SystemSettings } from '../types/index.ts';
import { api } from '../utils/api.ts';

interface SettingsViewProps {
  settings: SystemSettings | null;
  onSaveSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  onRunTests: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onRunTests,
}) => {
  const [cooldown, setCooldown] = useState(settings?.cooldownWindowMinutes || 5);
  const [timezone, setTimezone] = useState(settings?.timezone || 'UTC');
  const [demoMode, setDemoMode] = useState(settings?.demoMode ?? true);
  const [enableSim, setEnableSim] = useState(settings?.enableLiveSimulation ?? true);
  const [recognitionUrl, setRecognitionUrl] = useState(
    settings?.recognitionServiceUrl || 'http://localhost:8000'
  );
  const [copiedSql, setCopiedSql] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Migration SQL snippet preview
  const migrationSql = `-- SmartFace Supabase PostgreSQL Initial Migration
-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    enrollment_status TEXT NOT NULL DEFAULT 'not_enrolled',
    consent_status TEXT NOT NULL DEFAULT 'granted',
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.camera_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'entry',
    status TEXT NOT NULL DEFAULT 'offline',
    auth_token_hash TEXT NOT NULL,
    last_heartbeat_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.attendance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.camera_devices(id),
    event_timestamp TIMESTAMPTZ NOT NULL,
    direction TEXT NOT NULL,
    confidence_score NUMERIC(5,4),
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT 'camera'
);

CREATE TABLE IF NOT EXISTS public.daily_attendance_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    first_in TIMESTAMPTZ,
    last_out TIMESTAMPTZ,
    total_work_minutes INTEGER NOT NULL DEFAULT 0,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    is_manually_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT unique_person_date UNIQUE (person_id, date)
);`;

  const copySql = () => {
    navigator.clipboard.writeText(migrationSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await onSaveSettings({
        cooldownWindowMinutes: Number(cooldown),
        timezone,
        demoMode,
        enableLiveSimulation: enableSim,
        recognitionServiceUrl: recognitionUrl,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            System Configuration & Database Setup
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hardware cooldown rules, recognition service gateway endpoints, and Supabase PostgreSQL migration assistant.
          </p>
        </div>

        <button
          onClick={onRunTests}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5" />
          Run Attendance Engine Tests
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: General Settings Form */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs text-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Attendance Engine Parameters
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duplicate Scan Cooldown Window (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Scans within this window for the same person & direction are flagged as duplicates and excluded from work hour math.
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phase 2 Python Recognition Service Endpoint
              </label>
              <input
                type="url"
                value={recognitionUrl}
                onChange={(e) => setRecognitionUrl(e.target.value)}
                placeholder="http://localhost:8000"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                FastAPI / Triton vector comparison server.
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Application Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">Eastern Time (US / Canada)</option>
                <option value="America/Chicago">Central Time (US / Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US / Canada)</option>
                <option value="Europe/London">London (GMT / BST)</option>
                <option value="Europe/Paris">Central European Time (CET)</option>
                <option value="Asia/Tokyo">Tokyo / Seoul (JST)</option>
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(e) => setDemoMode(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Demonstration & Testbench Mode
                </span>
              </label>
              <p className="text-[11px] text-slate-400 pl-5">
                Displays testbench banner on dashboard to clearly identify simulated records.
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSim}
                  onChange={(e) => setEnableSim(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Enable Development Hardware Simulator API
                </span>
              </label>
              <p className="text-[11px] text-slate-400 pl-5">
                Allows testing scans without a physical camera connected. Strictly disabled in production deployments.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Settings saved!
                </span>
              ) : (
                <span></span>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Supabase Connection & SQL Migration Assistant */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs text-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              Database Diagnostics & Storage Mode
            </h2>
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded border ${
                settings?.storageMode === 'SUPABASE_CONNECTED' || settings?.supabaseConnected
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
              }`}
            >
              {settings?.storageMode === 'SUPABASE_CONNECTED' || settings?.supabaseConnected
                ? 'SUPABASE_CONNECTED'
                : 'LOCAL_DEVELOPMENT_STORE'}
            </span>
          </div>

          {/* Backup & Recovery Limitations Notice */}
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-1.5 text-[11px]">
            <p className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              Storage Mode & Recovery Limitations:
            </p>
            <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300/90 leading-relaxed pl-1">
              <li><strong>Zero Remote Sync:</strong> Local JSON storage is strictly isolated and never synchronized with remote Supabase PostgreSQL.</li>
              <li><strong>Persistence:</strong> Single-node file store (<code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">data/smartface-store.json</code>).</li>
              <li><strong>Recovery:</strong> No automated multi-region replication, WAL, or point-in-time recovery (PITR).</li>
              <li><strong>Production Restriction:</strong> Local store is blocked in production unless <code className="font-mono bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">ALLOW_LOCAL_FALLBACK=true</code>.</li>
            </ul>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Connecting to your Supabase Project:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              <li>Open your project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">supabase.com</a>.</li>
              <li>Navigate to the <strong>SQL Editor</strong> tab.</li>
              <li>Paste the migration script below and click <strong>Run</strong>.</li>
              <li>Provide your <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.2 rounded">SUPABASE_URL</code> and <code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.2 rounded">SUPABASE_SERVICE_ROLE_KEY</code> in server environment.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                DDL Migration Script (PostgreSQL / RLS / Indexes)
              </span>
              <button
                type="button"
                onClick={copySql}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition text-[11px] font-medium cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Copied SQL' : 'Copy Full Migration SQL'}
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56 leading-relaxed border border-slate-800">
              {migrationSql}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
