import React, { useState } from 'react';
import {
  Activity,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Code2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { AttendanceEvent } from '../types/index.ts';

interface AttendanceEventsViewProps {
  events: AttendanceEvent[];
}

export const AttendanceEventsView: React.FC<AttendanceEventsViewProps> = ({ events }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [duplicateFilter, setDuplicateFilter] = useState<'all' | 'duplicates_only' | 'valid_only'>('all');
  const [provenanceFilter, setProvenanceFilter] = useState<'all' | 'genuine_only' | 'simulated_only'>('all');
  const [selectedEvent, setSelectedEvent] = useState<AttendanceEvent | null>(null);

  const filtered = events.filter((e) => {
    const matchesSearch =
      (e.personName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.personBadge || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.deviceName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.clientRequestId || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDup =
      duplicateFilter === 'all'
        ? true
        : duplicateFilter === 'duplicates_only'
        ? e.isDuplicate
        : !e.isDuplicate;

    const matchesProvenance =
      provenanceFilter === 'all'
        ? true
        : provenanceFilter === 'genuine_only'
        ? !e.isSimulated
        : Boolean(e.isSimulated);

    return matchesSearch && matchesDup && matchesProvenance;
  });

  const exportCSV = () => {
    const headers = ['Event ID', 'Timestamp', 'Badge ID', 'Full Name', 'Device', 'Direction', 'Confidence', 'Duplicate', 'Duplicate Reason', 'Source'];
    const rows = filtered.map(e => [
      e.id,
      e.eventTimestamp,
      e.personBadge || '',
      `"${e.personName || ''}"`,
      `"${e.deviceName || ''}"`,
      e.direction,
      e.confidenceScore,
      e.isDuplicate ? 'Yes' : 'No',
      `"${e.duplicateReason || ''}"`,
      e.source,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartface_attendance_events_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Raw Attendance Event Stream
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable log of every scan arriving from hardware ESP32-CAM nodes and facial recognition gateways.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export Event Log
        </button>
      </div>

      {/* Filter Row */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-3 text-xs shadow-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by badge, name, device, or event ID..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Validation:</span>
          <select
            value={duplicateFilter}
            onChange={(e) => setDuplicateFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
          >
            <option value="all">All Validation States</option>
            <option value="valid_only">Valid Punches Only</option>
            <option value="duplicates_only">Blocked Duplicates Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Provenance:</span>
          <select
            value={provenanceFilter}
            onChange={(e) => setProvenanceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none"
          >
            <option value="all">All Sources</option>
            <option value="genuine_only">Genuine Records Only</option>
            <option value="simulated_only">Simulation Records Only</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="py-3 px-4">Event ID / Client Key</th>
                <th className="py-3 px-4">Scan Time (IST)</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Camera Terminal</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Duplicate Check</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filtered.map((evt) => (
                <tr
                  key={evt.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                >
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    <div>{evt.id}</div>
                    {evt.clientRequestId && (
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]" title={`Idempotency Key: ${evt.clientRequestId}`}>
                        🔑 {evt.clientRequestId}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    <div className="text-slate-800 dark:text-slate-200 font-medium">
                      {new Date(evt.eventTimestamp).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      })} IST
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(evt.eventTimestamp).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        evt.direction === 'entry'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {evt.direction}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {evt.personName || evt.personBadge || evt.personId}
                    </p>
                    {evt.personBadge && (
                      <p className="font-mono text-[10px] text-slate-400">{evt.personBadge}</p>
                    )}
                  </td>

                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                    {evt.deviceName || 'Camera Node'}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    <span className="font-semibold">
                      {(evt.confidenceScore * 100).toFixed(1)}%
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    {evt.isDuplicate ? (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900"
                        title={evt.duplicateReason}
                      >
                        <AlertTriangle className="w-3 h-3" /> Blocked Duplicate
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Passed
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {evt.isSimulated ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        🧪 Simulated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        🛡️ Genuine
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedEvent(evt)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Inspect Raw Event JSON"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No events match criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs font-mono">
                Event Payload Inspector: {selectedEvent.id}
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-80">
              {JSON.stringify(selectedEvent, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
