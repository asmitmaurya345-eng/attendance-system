import React from 'react';
import {
  Sun,
  Moon,
  ShieldCheck,
  Cpu,
  Database,
  Radio,
  CheckCircle2,
  AlertCircle,
  Globe,
  LogIn,
  LogOut,
} from 'lucide-react';
import { Role, AuthUser } from '../types/index.ts';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  currentUser: AuthUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  dbMode?: string;
  storageMode?: 'SUPABASE_CONNECTED' | 'LOCAL_DEVELOPMENT_STORE';
  onOpenSimulator: () => void;
  onRefresh: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  setDarkMode,
  currentUser,
  onOpenLogin,
  onLogout,
  dbMode,
  storageMode,
  onOpenSimulator,
  onRefresh,
}) => {
  const isSupabase = storageMode === 'SUPABASE_CONNECTED' || dbMode === 'SUPABASE_CONNECTED' || dbMode === 'supabase';

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-white">
                SmartFace
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-semibold">
                Phase 1 Core
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-none">
              Hardware Biometric Attendance Gateway
            </p>
          </div>
        </div>

        {/* Database Storage Mode Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          <Database className="w-3.5 h-3.5 text-indigo-500" />
          <span>Storage:</span>
          {isSupabase ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold font-mono text-[11px]">
              <CheckCircle2 className="w-3 h-3" /> SUPABASE_CONNECTED
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold font-mono text-[11px]" title="Isolated local store (not synchronized with Supabase)">
              <AlertCircle className="w-3 h-3" /> LOCAL_DEVELOPMENT_STORE
            </span>
          )}
        </div>

        {/* Timezone Badge */}
        <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
          <Globe className="w-3 h-3 text-indigo-500" />
          <span>Asia/Kolkata (IST +05:30)</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick Simulator Trigger */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
          title="Open ESP32-CAM Simulation Modal"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Camera Simulator</span>
        </button>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Toggle theme"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Identity Profile Indicator & Login/Logout */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-bold border border-indigo-200 dark:border-indigo-800">
              {currentUser.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {currentUser.fullName}
              </p>
              <p className="text-[10px] uppercase font-mono text-indigo-600 dark:text-indigo-400 font-bold leading-tight">
                {currentUser.role.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={onLogout}
              title="Logout Session"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};
