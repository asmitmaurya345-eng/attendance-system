import React, { useState } from 'react';
import {
  X,
  Play,
  Cpu,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Person, CameraDevice, EventDirection } from '../types/index.ts';
import { api } from '../utils/api.ts';

interface CameraSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  devices: CameraDevice[];
  onScanCompleted: () => void;
}

export const CameraSimulatorModal: React.FC<CameraSimulatorModalProps> = ({
  isOpen,
  onClose,
  people,
  devices,
  onScanCompleted,
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState(people[0]?.id || '');
  const [selectedDeviceId, setSelectedDeviceId] = useState(devices[0]?.id || '');
  const [direction, setDirection] = useState<EventDirection>('entry');
  const [confidence, setConfidence] = useState<number>(0.96);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const currentPerson = people.find(p => p.id === selectedPersonId);
  const currentDevice = devices.find(d => d.id === selectedDeviceId);

  const handleSimulate = async () => {
    if (!selectedPersonId) {
      setError('Please select an employee.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.simulateScan({
        personId: selectedPersonId,
        deviceId: selectedDeviceId || undefined,
        direction,
        confidenceScore: confidence,
      });

      setResult(res.result);
      onScanCompleted();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* Banner */}
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] font-medium flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>DEVELOPMENT-ONLY HARDWARE TESTBENCH • Isolated from Production</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              ESP32-CAM Scan Simulator
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Person (Emulated Face)
            </label>
            <select
              value={selectedPersonId}
              onChange={(e) => {
                setSelectedPersonId(e.target.value);
                setResult(null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.personId}) - {p.department}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hardware Camera Node
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.direction})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Punched Direction
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as EventDirection)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
              >
                <option value="entry">Entry (Check-In)</option>
                <option value="exit">Exit (Check-Out)</option>
                <option value="unspecified">Auto-Detect Alternation</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Face Recognition Confidence Score
              </label>
              <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.7}
              max={0.99}
              step={0.01}
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              className="w-full accent-indigo-600"
            />
          </div>

          <button
            onClick={handleSimulate}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer transition"
          >
            <Play className="w-3.5 h-3.5" />
            {loading ? 'Transmitting Scan Event...' : 'Fire Emulated Scan to Engine'}
          </button>

          {/* Result Feedback Banner */}
          {result && (
            <div
              className={`p-3 rounded-lg border text-xs space-y-1 ${
                result.isDuplicate
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {result.isDuplicate ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Duplicate Punch Prevented!</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Scan Processed & Shift Evaluated</span>
                  </>
                )}
              </div>

              {result.isDuplicate ? (
                <p className="text-[11px] leading-relaxed">{result.duplicateReason}</p>
              ) : (
                <div className="text-[11px] space-y-0.5">
                  <p>
                    Direction: <strong className="uppercase">{result.appliedDirection}</strong> • Daily Status:{' '}
                    <strong className="uppercase">{result.dailySummary?.status}</strong>
                  </p>
                  <p>
                    Work Shift: {result.dailySummary?.scheduleName}
                    {result.dailySummary?.lateMinutes > 0 && (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold ml-1">
                        (+{result.dailySummary.lateMinutes} min late)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
