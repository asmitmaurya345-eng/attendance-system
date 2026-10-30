import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  Activity,
  History,
  BarChart3,
  Users,
  Camera,
  Cpu,
  Clock,
  CalendarOff,
  FileText,
  Settings,
  CheckCircle,
} from 'lucide-react';

export type NavigationTab =
  | 'dashboard'
  | 'daily_attendance'
  | 'attendance_events'
  | 'attendance_history'
  | 'reports'
  | 'people'
  | 'enrollment'
  | 'devices'
  | 'schedules'
  | 'holidays_leave'
  | 'audit_logs'
  | 'settings'
  | 'tests';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface SidebarProps {
  currentTab: NavigationTab;
  setCurrentTab: (tab: NavigationTab) => void;
  onlineDeviceCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  onlineDeviceCount,
}) => {
  const navSections: NavSection[] = [
    {
      label: 'Main',
      items: [
        { id: 'dashboard' as NavigationTab, label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Attendance Engine',
      items: [
        { id: 'daily_attendance' as NavigationTab, label: 'Daily Attendance', icon: CalendarCheck },
        { id: 'attendance_events' as NavigationTab, label: 'Raw Event Stream', icon: Activity },
        { id: 'attendance_history' as NavigationTab, label: 'History & Logs', icon: History },
        { id: 'reports' as NavigationTab, label: 'Reports & Punctuality', icon: BarChart3 },
      ],
    },
    {
      label: 'Personnel & Biometrics',
      items: [
        { id: 'people' as NavigationTab, label: 'People Directory', icon: Users },
        { id: 'enrollment' as NavigationTab, label: 'Face Enrollment Hub', icon: Camera },
      ],
    },
    {
      label: 'Hardware & Edge',
      items: [
        {
          id: 'devices' as NavigationTab,
          label: 'Camera Devices',
          icon: Cpu,
          badge: `${onlineDeviceCount} Online`,
        },
      ],
    },
    {
      label: 'Organization',
      items: [
        { id: 'schedules' as NavigationTab, label: 'Work Shifts & Grace', icon: Clock },
        { id: 'holidays_leave' as NavigationTab, label: 'Holidays & Leave', icon: CalendarOff },
      ],
    },
    {
      label: 'System & Governance',
      items: [
        { id: 'audit_logs' as NavigationTab, label: 'Audit Logs', icon: FileText },
        { id: 'settings' as NavigationTab, label: 'Settings & Supabase', icon: Settings },
        { id: 'tests' as NavigationTab, label: 'Engine Test Suite', icon: CheckCircle },
      ],
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col flex-shrink-0 min-h-[calc(100vh-4rem)] transition-colors">
      <div className="p-3 space-y-5 flex-1 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              {section.label}
            </p>
            <nav className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Hardware Status Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ESP32 Gateway
          </span>
          <span className="font-mono text-[11px]">v1.4.2</span>
        </div>
      </div>
    </aside>
  );
};
