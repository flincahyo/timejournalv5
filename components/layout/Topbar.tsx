"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMT5Store, useFilterStore, useFilteredTrades, useThemeStore, useUIStore, useAuthStore } from "@/store";
import MT5ConnectModal from "@/components/modals/MT5ConnectModal";
import FilterModal from "@/components/filters/FilterModal";
import DateRangeModal from "@/components/filters/DateRangeModal";
import AddTradeModal from "@/components/modals/AddTradeModal";



const IcSearch = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
const IcFilter = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>;
const IcCal = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const IcPlus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();
  const { user } = useAuthStore();
  const { isConnected, account } = useMT5Store();
  const { filter } = useFilterStore();
  const { all } = useFilteredTrades();
  const { activeDrawer, openDrawer, closeDrawer } = useUIStore();

  const filterCount = [
    filter.symbols.length, filter.side !== "all", filter.closeType !== "all",
    filter.setups.length, filter.sessions.length, filter.dateFrom, filter.dateTo,
    filter.minPnl !== null, filter.maxPnl !== null,
  ].filter(Boolean).length;

  return (
    <>
      <header className="h-[var(--topbar-h)] bg-surface/80 backdrop-blur-md sticky top-0 border-b border-border flex items-center px-4 md:px-6 gap-8 shrink-0 z-[60]">
        {/* Logo Section */}
        <div
          className="flex items-center gap-3 cursor-pointer shrink-0"
          onClick={() => router.push('/dashboard')}
        >
          <div className="w-9 h-9 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Circular Background */}
              <circle cx="50" cy="50" r="48" className="fill-text" />

              {/* Hourglass Path - Precisely Centered (y: 20-80) */}
              <path
                d="M32 20C32 20 32 30 40 40C48 50 48 50 48 50C48 50 48 50 40 60C32 70 32 80 32 80H68C68 80 68 70 60 60C52 50 52 50 52 50C52 50 52 50 60 40C68 30 68 20 68 20H32Z"
                className="fill-surface stroke-surface"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Candlesticks in Top Bulb (y shifted -5) */}
              <rect x="42" y="27" width="3" height="8" className="fill-text opacity-40" />
              <rect x="48" y="25" width="3" height="12" className="fill-text opacity-60" />
              <rect x="54" y="29" width="3" height="6" className="fill-text opacity-30" />

              {/* Sand in Bottom Bulb (y shifted -5, points: 65, 70, 70, 65, 60, 80, 80, 80, 60, 65) */}
              <path d="M40 65C45 70 55 70 60 65C65 60 65 80 65 80H35C35 80 35 60 40 65Z" className="fill-text opacity-10" />
            </svg>
          </div>
          <span className="font-bold text-[19px] tracking-tight hidden lg:block text-text">TimeJournal</span>
        </div>

        {/* Main Modules Navigation */}
        <nav className="hidden md:flex items-center h-full gap-2">
          {[
            { label: 'Overview', href: '/dashboard' },
            { label: 'Terminal', href: '/dashboard/terminal' },
          ].map((item) => {
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`px-4 h-full flex items-center text-[13.5px] font-semibold transition-all relative group ${active ? "text-accent" : "text-text3 hover:text-text2"
                  }`}
              >
                {item.label}
                {active && (
                  <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-accent rounded-t-full shadow-[0_-2px_6px_rgba(37,99,235,0.4)]" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Account Stats (Terminal Only) */}
          {pathname === '/dashboard/terminal' && isConnected && account && (
            <div className="hidden xl:flex items-center gap-5 mr-3 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-bold text-text3 uppercase tracking-[0.12em] opacity-60">Balance</span>
                <span className="text-[14px] font-bold text-text tabular-nums tracking-tight">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.balance)}
                </span>
              </div>
              <div className="w-[1px] h-5 bg-border opacity-40" />
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full ${account.profit >= 0 ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                    {account.profit >= 0 ? "+" : ""}{((account.profit / (account.balance - account.profit)) * 100).toFixed(2)}%
                  </span>
                  <span className="text-[9px] font-bold text-text3 uppercase tracking-[0.12em] opacity-60">Equity</span>
                </div>
                <span className={`text-[14px] font-bold tabular-nums tracking-tight ${account.profit >= 0 ? "text-green" : "text-red"}`}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: account.currency }).format(account.equity)}
                </span>
              </div>
            </div>
          )}

          {/* Contextual Page Actions (Show only on non-terminal) */}
          {pathname !== '/dashboard/terminal' && (
            <div className="flex items-center gap-2 mr-2">
              <button
                onClick={() => openDrawer('filter')}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface2 text-text3 hover:text-text transition-all relative"
                title="Filter Trades"
              >
                {IcFilter}
                {filterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[#0b0e11] text-[9px] font-black flex items-center justify-center border-2 border-bg">
                    {filterCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => openDrawer('add_trade')}
                className="bg-accent text-[#0b0e11] h-9 px-3.5 md:px-4 rounded-lg text-[13px] font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
              >
                {IcPlus} <span className="hidden sm:inline">Add Trade</span>
              </button>
            </div>
          )}

          <div className="w-[1px] h-5 bg-border mx-1" />

          {/* MT5 Status Bar */}
          <button
            onClick={() => openDrawer('mt5_connect')}
            className={`flex items-center gap-2.5 px-3 h-9 rounded-lg transition-all ${isConnected ? "hover:bg-green/5 text-green" : "hover:bg-surface2 text-text3"
              }`}
          >
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green shadow-[0_0_8px_rgba(14,203,129,0.5)]" : "bg-text3 opacity-40"}`} />
            <span className="text-[13px] font-mono font-bold hidden md:inline">
              {isConnected ? (account ? `#${account.login}` : "Connected") : "Connect MT5"}
            </span>
          </button>

          {/* Theme Toggle - Hidden on Mobile (in Menu) */}
          <button
            onClick={() => toggleTheme()}
            className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-surface2 text-text3 hover:text-text transition-all"
            title="Toggle Theme"
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
            )}
          </button>

          {/* User Icon - Hidden on Mobile (in Menu) */}
          <div
            onClick={() => openDrawer('account')}
            className="hidden md:flex w-8 h-8 rounded-full bg-surface3 border border-border items-center justify-center cursor-pointer hover:border-accent group transition-all overflow-hidden"
          >
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if image fails to load
                  (e.target as any).style.display = 'none';
                  (e.target as any).nextSibling.style.display = 'block';
                }}
              />
            ) : null}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className={`text-text3 group-hover:text-accent ${user?.image ? 'hidden' : ''}`}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </header>

      {/* Drawers are handled globally in Layout or conditionally here if preferred */}
      {/* For simplicity while refactoring, I'll keep them here for now but wrapped in Drawer */}
    </>
  );
}
