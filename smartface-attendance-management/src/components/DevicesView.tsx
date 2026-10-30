import React, { useState } from 'react';
import {
  Cpu,
  Plus,
  Radio,
  Wifi,
  Key,
  Code2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { CameraDevice } from '../types/index.ts';

interface DevicesViewProps {
  devices: CameraDevice[];
  onAddDevice: () => void;
  onOpenDocs: (token?: string) => void;
  onOpenSimulator: (deviceId?: string) => void;
  onDeleteDevice: (id: string) => void;
}

export const DevicesView: React.FC<DevicesViewProps> = ({
  devices,
  onAddDevice,
  onOpenDocs,
  onOpenSimulator,
  onDeleteDevice,
}) => {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Camera Devices & Turnstile Terminals
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registry of ESP32-CAM optical terminals, direction routing, and token-authenticated hardware endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenDocs()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-500" />
            ESP32 C++ Integration Guide
          </button>

          <button
            onClick={onAddDevice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Device
          </button>
        </div>
      </div>

      {/* Hardware Readiness Notice */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed text-slate-600 dark:text-slate-300">
          <strong>Hardware Integration Status (Phase 1):</strong> Physical ESP32-CAM microcontrollers are not currently attached. Backend endpoints enforce strict header authentication (<code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.2 rounded">X-Device-Token</code>). Use the testbench simulator below to verify flow routing and duplicate checks without physical devices.
        </div>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((dev) => (
          <div
            key={dev.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                      dev.isSimulated
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                        : dev.status === 'online'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {dev.name}
                    </h3>
                    <p className="font-mono text-[11px] text-slate-400">{dev.deviceId}</p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                    dev.isSimulated
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                      : dev.status === 'online'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {dev.isSimulated ? 'Software Sim' : dev.status === 'unconnected' ? 'Awaiting Device' : dev.status}
                </span>
              </div>

              {/* Specs & Location */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Location:</span>
                  <span className="font-medium text-slate-900 dark:text-white">{dev.location}</span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Configured Flow:</span>
                  <span className="font-semibold uppercase font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                    {dev.direction}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Firmware:</span>
                  <span className="font-mono text-[11px]">{dev.firmwareVersion}</span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Signal Strength:</span>
                  <span className="font-mono text-[11px] flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-slate-400" />
                    {dev.rssi ? `${dev.rssi} dBm` : 'Unconnected'}
                  </span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>IP Address:</span>
                  <span className="font-mono text-[11px]">{dev.ipAddress || 'Awaiting DHCP'}</span>
                </div>

                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Last Heartbeat:</span>
                  <span className="text-[11px]">
                    {dev.lastHeartbeatAt ? new Date(dev.lastHeartbeatAt).toLocaleTimeString() : 'No physical heartbeat yet'}
                  </span>
                </div>
              </div>

              {/* Hardware Token Box */}
              <div className="mt-4 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Key className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-mono text-[11px] truncate text-slate-600 dark:text-slate-300">
                    {dev.authToken}
                  </span>
                </div>
                <button
                  onClick={() => copyToken(dev.authToken)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
                  title="Copy token"
                >
                  {copiedToken === dev.authToken ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => onOpenSimulator(dev.id)}
                className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                <Play className="w-3 h-3" /> Test Scan
              </button>

              <button
                onClick={() => {
                  if (confirm(`Remove device ${dev.name}?`)) {
                    onDeleteDevice(dev.id);
                  }
                }}
                className="text-slate-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                title="Delete device"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
