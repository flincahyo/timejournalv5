"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTerminalStore, useThemeStore, useNewsStore, useMT5Store } from "@/store";
import {
  BarChart2,
  Calendar,
  Settings,
  Layout,
  Home,
  BookOpen,
  PieChart,
  Activity,
  Eye,
  ChevronRight,
  ChevronDown,
  LogOut,
  User,
  Plus,
  Terminal,
  Bell
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isEditMode, toggleEditMode, resetLayout, clearLayout } = useTerminalStore();
  const { clear: clearTheme } = useThemeStore();
  const { clear: clearNews } = useNewsStore();
  const { disconnectMT5 } = useMT5Store();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    overview: true,
    activity: true,
    tools: true
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isTerminal = pathname === "/dashboard/terminal";

  const MenuItem = ({ icon: Icon, label, href, active, onClick, badge, color }: any) => (
    <div
      onClick={onClick || (() => router.push(href))}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${active
        ? "bg-accent-bg text-accent"
        : "text-text2 hover:bg-surface2 hover:text-text"
        }`}
    >
      <Icon size={18} className={active ? "text-accent" : "text-text3 group-hover:text-text"} style={color ? { color } : {}} />
      <span className={`text-[13px] font-semibold flex-1 ${active ? "opacity-100" : "opacity-90 group-hover:opacity-100"}`}>{label}</span>
      {badge && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface3 text-text3 font-bold">{badge}</span>
      )}
    </div>
  );

  const GroupHeader = ({ id, label }: any) => (
    <div
      onClick={() => toggleGroup(id)}
      className="flex items-center gap-2 px-2 mt-5 mb-1 cursor-pointer group select-none"
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text3 opacity-40 flex-1 group-hover:opacity-80 transition-opacity">
        {label}
      </span>
      <div className="opacity-0 group-hover:opacity-40 transition-opacity">
        {expandedGroups[id] ? <ChevronDown size={12} className="text-text3" /> : <ChevronRight size={12} className="text-text3" />}
      </div>
    </div>
  );

  return (
    <aside className="w-[var(--sidebar-w)] h-full bg-bg flex flex-col p-3 overflow-y-auto no-scrollbar shadow-sm">
      <div className="flex flex-col gap-0.5">
        {/* Module Specific Navigation */}
        {isTerminal ? (
          <>
            <GroupHeader id="overview" label="Terminal" />
            {expandedGroups.overview && (
              <div className="flex flex-col gap-0.5">
                <MenuItem
                  icon={Terminal}
                  label="Open Terminal"
                  href="/dashboard/terminal"
                  active={pathname === "/dashboard/terminal" && !isEditMode}
                />
                <MenuItem
                  icon={Layout}
                  label={isEditMode ? "Save Layout" : "Edit Layout"}
                  active={isEditMode}
                  onClick={() => toggleEditMode()}
                  color={isEditMode ? "#f0b90b" : undefined}
                />
                <MenuItem
                  icon={Activity}
                  label="Reset Layout"
                  onClick={resetLayout}
                />
              </div>
            )}

            <GroupHeader id="tools" label="Help" />
            {expandedGroups.tools && (
              <div className="flex flex-col gap-0.5 p-2">
                <p className="text-[11px] text-text3 leading-relaxed opacity-60">
                  You can drag and resize widgets when Edit Mode is active.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <GroupHeader id="overview" label="Main" />
            {expandedGroups.overview && (
              <div className="flex flex-col gap-0.5">
                <MenuItem
                  icon={Home}
                  label="Dashboard"
                  href="/dashboard"
                  active={pathname === "/dashboard"}
                />
                <MenuItem
                  icon={PieChart}
                  label="Analytics"
                  href="/dashboard/analytics"
                  active={pathname === "/dashboard/analytics"}
                />
              </div>
            )}

            <GroupHeader id="activity" label="Activity" />
            {expandedGroups.activity && (
              <div className="flex flex-col gap-0.5">
                <MenuItem
                  icon={BookOpen}
                  label="Journaling"
                  href="/dashboard/journal"
                  active={pathname === "/dashboard/journal"}
                />
                <MenuItem
                  icon={Calendar}
                  label="Trading Calendar"
                  href="/dashboard/calendar"
                  active={pathname === "/dashboard/calendar"}
                />
              </div>
            )}

            <GroupHeader id="tools" label="Tools" />
            {expandedGroups.tools && (
              <div className="flex flex-col gap-0.5">
                <MenuItem
                  icon={Bell}
                  label="Price Alerts"
                  href="/dashboard/alerts"
                  active={pathname === "/dashboard/alerts"}
                />
                <MenuItem
                  icon={Activity}
                  label="Trade Terminal"
                  href="/dashboard/terminal"
                  active={pathname === "/dashboard/terminal"}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-auto pt-4 flex flex-col gap-0.5 border-t border-border">
        <MenuItem
          icon={Settings}
          label="Settings"
          href="/dashboard/settings"
          active={pathname === "/dashboard/settings"}
        />
        <div className="h-2" />
        <button
          onClick={async () => {
            try {
              // Parallel cleanup to be fast, but wait for completion
              await Promise.allSettled([
                disconnectMT5(),
                Promise.resolve(clearLayout()),
                Promise.resolve(clearTheme()),
                Promise.resolve(clearNews())
              ]);
            } catch (err) {
              console.error("Logout cleanup error:", err);
            } finally {
              // Standardize on the key used in lib/api.ts (uj_token)
              localStorage.removeItem('uj_token');
              localStorage.removeItem('token'); // Backup for safety

              // Use window.location for a hard reset to ensure all stores are wiped
              window.location.href = '/login';
            }
          }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-red/80 hover:bg-red-bg hover:text-red transition-all font-bold text-[13px]"
        >
          <LogOut size={18} />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
