"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore, useMT5Store, useJournalStore, useAlertStore, useNewsStore, useTerminalStore, useUIStore, useFilteredTrades, useRecapStore } from "@/store";
import SideDrawer from "@/components/ui/SideDrawer";
import MT5ConnectModal from "@/components/modals/MT5ConnectModal";
import FilterModal from "@/components/filters/FilterModal";
import DateRangeModal from "@/components/filters/DateRangeModal";
import AddTradeModal from "@/components/modals/AddTradeModal";
import AIAnalystContent from "@/components/modals/AIAnalystContent";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import MobileTabBar from "@/components/layout/MobileTabBar";
import AccountModal from "@/components/modals/AccountModal";
import ShareModal from "@/components/modals/ShareModal";
import TradeRecapModal from "@/components/modals/TradeRecapModal";
import RecapSettingsDrawer from "@/components/settings/RecapSettingsDrawer";
import { useMT5Sync } from "@/hooks/useMT5Sync";
import { authGetMe } from "@/lib/auth";
import { getToken } from "@/lib/api";

function DataLoader({ children }: { children: React.ReactNode }) {
  useMT5Sync();
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuthStore();
  const { loadStatus } = useMT5Store();
  const { fetchJournal } = useJournalStore();
  const { fetchAlerts } = useAlertStore();
  const { loadFromServer: loadNewsSettings } = useNewsStore();
  const { loadLayoutFromServer } = useTerminalStore();
  const { loadSettings: loadRecapSettings } = useRecapStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { activeDrawer, closeDrawer, openDrawer } = useUIStore();
  const { all, stats } = useFilteredTrades();

  useEffect(() => {
    // Clear any stale meta theme-color set by login page, so the
    // React Native status bar defaults back to the dashboard theme
    const staleMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (staleMeta) staleMeta.remove();

    async function bootstrap() {
      if (user) {
        // Already have user in memory — load server data
        await Promise.all([loadStatus(), fetchJournal(), fetchAlerts(), loadNewsSettings(), loadLayoutFromServer(), loadRecapSettings()]);
        setReady(true);
        return;
      }
      const token = getToken();
      if (!token) {
        // Clear local settings to prevent seeing previous user's layout/theme
        loadLayoutFromServer();
        loadNewsSettings();
        router.replace("/login");
        return;
      }
      // Validate token against server and restore session
      const me = await authGetMe();
      if (!me) {
        loadLayoutFromServer();
        loadNewsSettings();
        router.replace("/login");
        return;
      }
      setUser({ id: me.id, email: me.email, name: me.name, image: me.image, provider: "credentials", createdAt: me.createdAt });
      // Load all server data in parallel after auth confirmed
      await Promise.all([loadStatus(), fetchJournal(), fetchAlerts(), loadNewsSettings(), loadLayoutFromServer(), loadRecapSettings()]);
      setReady(true);
    }
    bootstrap();
  }, []);

  const pathname = usePathname();
  const isTerminal = pathname === "/dashboard/terminal";

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3.5">
        <div className="w-9 h-9 rounded-full border-[3px] border-border border-t-accent animate-[spin_1s_linear_infinite]" />
        <p className="text-[13px] text-text3 font-medium">Memuat…</p>
      </div>
    </div>
  );

  return (
    <DataLoader>
      <div className="flex flex-col h-screen overflow-hidden bg-bg">
        {/* Global Top Header */}
        <Topbar />

        <div className="flex flex-1 overflow-hidden relative">
          {/* Contextual Sidebar - fixed below Topbar */}
          <div className="hidden md:block shrink-0">
            <Sidebar />
          </div>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden md:pb-0 pb-[calc(4rem+env(safe-area-inset-bottom))] relative">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <MobileTabBar />
      </div>

      <SideDrawer
        isOpen={activeDrawer === 'account'}
        onClose={closeDrawer}
        title="Account Settings"
        subtitle="Manage your profile and security"
        noPadding
      >
        <AccountModal isOpen={activeDrawer === 'account'} onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'add_trade'}
        onClose={closeDrawer}
        title="Add Trade Manual"
        subtitle="Log a new trade record manually"
      >
        <AddTradeModal onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'mt5_connect'}
        onClose={closeDrawer}
        title="Broker Connection"
        subtitle="Sync with MetaTrader 5"
      >
        <MT5ConnectModal onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'filter'}
        onClose={closeDrawer}
        title="Filter Trades"
        subtitle="Refine your trade list"
      >
        <FilterModal trades={all} onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'date_range'}
        onClose={closeDrawer}
        title="Date Range"
        subtitle="Select a specific time period"
      >
        <DateRangeModal onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'ai_analyst'}
        onClose={closeDrawer}
        title="AI Market Analyst"
        subtitle="Objective performance insights"
      >
        <AIAnalystContent stats={stats} closedTrades={all.filter(t => t.status === 'closed')} onClose={closeDrawer} />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'share'}
        onClose={closeDrawer}
        title="Share Portfolio"
        subtitle="Manage public sharing links"
        noPadding
      >
        <ShareModal />
      </SideDrawer>

      <SideDrawer
        isOpen={activeDrawer === 'recap_settings'}
        onClose={closeDrawer}
        title="Trade Recap Settings"
        subtitle="Customize your post-trade experience"
      >
        <RecapSettingsDrawer />
      </SideDrawer>

      <TradeRecapModal />
    </DataLoader>
  );
}
