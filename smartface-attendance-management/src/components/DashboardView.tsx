import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  ClockAlert,
  UserX,
  Palmtree,
  Cpu,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Globe,
  Radio,
  Filter,
} from 'lucide-react';
import { DashboardMetrics, AttendanceEvent, CameraDevice } from '../types/index.ts';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  recentEvents: AttendanceEvent[];
  devices: CameraDevice[];
  onOpenSimulator: () => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
  onFinalizeAbsences: () => void;
  genuineOnly: boolean;
  setGenuineOnly: (val: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  recentEvents,
  devices,
  onOpenSimulator,
  onNavigate,
  onRefresh,
  onFinalizeAbsences,
  genuineOnly,
  setGenuineOnly,
}) => {
  if (!metrics) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading dashboard analytics...
      </div>
    );
  }

  const statCards = [
    {
      label: 'Registered Active People',
      value: metrics.totalPeople,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      tab: 'people',
    },
    {
      label: 'Present Today (IST)',
      value: metrics.presentToday,
      sub: `${metrics.attendanceRate}% on-site`,
      icon: UserCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      tab: 'daily_attendance',
    },
    {
      label: 'Late Arrivals',
      value: metrics.lateToday,
      sub: 'Exceeded shift grace',
      icon: ClockAlert,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      tab: 'daily_attendance',
    },
    {
      label: 'Unaccounted / Absent',
      value: metrics.absentToday,
      sub: 'After shift cutoff',
      icon: UserX,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      tab: 'daily_attendance',
    },
    {
      label: 'Approved Leave',
      value: metrics.onLeaveToday,
      sub: 'Documented PTO/Sick',
      icon: Palmtree,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      tab: 'holidays_leave',
    },
    {
      label: 'Hardware Status',
      value: `${devices.filter(d => !d.isSimulated && d.status === 'online').length} Physical`,
      sub: `${devices.filter(d => d.isSimulated).length} Test Simulator`,
      icon: Cpu,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      tab: 'devices',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hardware & Recognition Status Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-start gap-2.5">
          <Cpu className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <span>Physical Hardware Terminals:</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-900">
                Awaiting ESP32-CAM Connection
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Physical cameras are unconfigured in Phase 1. Development software testbench is active.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-start gap-2.5">
          <Radio className="w-4 h-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              <span>Python Recognition Service:</span>
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                Phase 2 Vector Microservice
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
              Images are staged in DB. Real vector extraction and matching will run in Phase 2.
            </p>
          </div>
        </div>
      </div>

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Attendance Operations Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time biometric aggregation, Asia/Kolkata shift evaluations, and camera edge status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Production vs Simulation Toggle */}
          <button
            onClick={() => setGenuineOnly(!genuineOnly)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
              genuineOnly
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-bold'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Filter statistics to production genuine events only"
          >
            <Filter className="w-3.5 h-3.5" />
            {genuineOnly ? 'Genuine Records Only' : 'All (Include Simulated)'}
          </button>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <button
            onClick={onFinalizeAbsences}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Evaluate active employees with 0 scans today and mark absent after shift cutoff"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
            Finalize Day
          </button>

          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Simulate Camera Punch
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={() => onNavigate(card.tab)}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer shadow-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {card.value}
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {card.label}
              </p>
              {card.sub && (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">
                  {card.sub}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Camera Terminal Health & Live Punch Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Scans Ticker */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Live Attendance Scans
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Recent capture events with Asia/Kolkata timestamps
              </p>
            </div>
            <button
              onClick={() => onNavigate('attendance_events')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              All Events <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentEvents.slice(0, 6).map((evt) => (
              <div key={evt.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      evt.direction === 'entry'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {evt.direction === 'entry' ? 'IN' : 'OUT'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {evt.personName || evt.personBadge || evt.personId}
                      </span>
                      {evt.personBadge && (
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                          ({evt.personBadge})
                        </span>
                      )}
                      {evt.isSimulated && (
                        <span className="text-[9px] uppercase px-1 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900">
                          Simulated
                        </span>
                      )}
                      {evt.isDuplicate && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-semibold border border-rose-200 dark:border-rose-900">
                          Duplicate Ignored
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[11px] mt-0.5">
                      <span>{evt.deviceName || 'Camera Terminal'}</span>
                      <span>•</span>
                      <span>Confidence: {Math.round(evt.confidenceScore * 100)}%</span>
                      <span>•</span>
                      <span className="uppercase text-[10px]">{evt.source}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {new Date(evt.eventTimestamp).toLocaleTimeString('en-US', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })} IST
                </div>
              </div>
            ))}

            {recentEvents.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                No attendance scans recorded today yet.
              </div>
            )}
          </div>
        </div>

        {/* Camera Devices Registry Overview */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Hardware Camera Terminals
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ESP32-CAM nodes and biometric turnstiles
              </p>
            </div>
            <button
              onClick={() => onNavigate('devices')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
            >
              Registry <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {devices.map((dev) => (
              <div
                key={dev.id}
                className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {dev.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {dev.direction}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {dev.location} • <span className="font-mono">{dev.deviceId}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      dev.status === 'online'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : dev.status === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {dev.status === 'online' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <AlertTriangle className="w-3 h-3" />
                    )}
                    <span className="capitalize">{dev.status}</span>
                  </span>
                  {dev.isSimulated && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      (Software Sim)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Duplicate Protection Stat Card */}
          <div className="mt-4 p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                Duplicate Scan Protection
              </p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                Cooldown window preventing double punch
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                {metrics.duplicatePreventedCount}
              </span>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400">Blocked</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
