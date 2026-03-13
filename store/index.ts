import { create } from "zustand";
import { persist } from "zustand/middleware";
export { useTerminalStore } from "./terminalStore";
export { useUIStore } from "./uiStore";
import { Trade, TradeFilter, MT5Account, User, Theme, DEFAULT_FILTER } from "@/types";
import { calcStats, applyFilter, toWIB, detectSession } from "@/lib/utils";
import { apiGet, apiPost, apiPut, apiDelete, buildWsUrl, getToken } from "@/lib/api";

// ── Auth Store ────────────────────────────────────────────────────────────────
interface AuthStore {
  user: User | null;
  token: string | null;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  updateProfile: (data: { name?: string; email?: string; image?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  updateProfile: async (data) => {
    const res = await apiPut<User>("/api/auth/profile", data);
    set({ user: res });
  },
  changePassword: async (currentPassword, newPassword) => {
    await apiPut("/api/auth/password", { current_password: currentPassword, new_password: newPassword });
  },
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    // apiPost might need adjustment for FormData, but many fetch wrappers handle it.
    // If apiPost doesn't, we might need a raw fetch or specialized helper.
    // Let's assume apiPost handles FormData or add a new helper.
    const token = getToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/auth/upload-avatar`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error("Gagal mengunggah foto");
    const data = await res.json();
    set({ user: { ...get().user!, image: data.url } });
    return data.url;
  },
}));

// ── MT5 Connection Store ──────────────────────────────────────────────────────
interface MT5Store {
  isConnected: boolean;
  account: MT5Account | null;
  lastSync: string | null;
  connectionParams: { login: number; server: string } | null;
  trades: Trade[];
  liveTrades: Trade[];
  mt5Symbols: string[];       
  isLoading: boolean;
  accounts: any[]; // MT5AccountSession[]

  setConnected: (v: boolean) => void;
  setAccount: (a: MT5Account | null) => void;
  setLastSync: (s: string) => void;
  setConnectionParams: (p: { login: number; server: string } | null) => void;
  setTrades: (t: Trade[]) => void;
  setLiveTrades: (t: Trade[]) => void;
  updateLiveTrade: (t: Trade) => void;
  updateTrade: (id: string, partial: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  reset: () => void;
  setLoading: (v: boolean) => void;

  /** Connect to MT5 via API and start WebSocket */
  connectMT5: (login: number, password: string, server: string) => Promise<{ success: boolean; message?: string }>;
  /** Disconnect from MT5 via API */
  disconnectMT5: () => Promise<void>;
  /** Load current MT5 status from API (for page refresh) */
  loadStatus: () => Promise<void>;
  /** Fetch all trades from DB cache */
  fetchTrades: (accountId?: number) => Promise<void>;
  /** Manage accounts */
  fetchAccounts: () => Promise<void>;
  toggleAccount: (accountId: number) => Promise<void>;
  deleteAccount: (accountId: number) => Promise<void>;
  /** Start WebSocket listener for live updates */
  startWebSocket: () => void;
}

let _ws: WebSocket | null = null;

export const useMT5Store = create<MT5Store>()((set, get) => ({
  isConnected: false,
  account: null,
  lastSync: null,
  connectionParams: null,
  trades: [],
  liveTrades: [],
  mt5Symbols: [],
  isLoading: false,
  accounts: [],

  setConnected: (isConnected) => set({ isConnected }),
  setAccount: (account) => set({ account }),
  setLastSync: (lastSync) => set({ lastSync }),
  setConnectionParams: (connectionParams) => set({ connectionParams }),
  setTrades: (trades) => set({ trades }),
  setLiveTrades: (liveTrades) => set({ liveTrades }),
  setLoading: (isLoading) => set({ isLoading }),

  updateLiveTrade: (trade) => {
    const { liveTrades } = get();
    const idx = liveTrades.findIndex((t) => t.id === trade.id);
    if (idx >= 0) {
      const updated = [...liveTrades];
      updated[idx] = trade;
      set({ liveTrades: updated });
    } else {
      set({ liveTrades: [...liveTrades, trade] });
    }
  },

  updateTrade: (id, partial) =>
    set((s) => ({ trades: s.trades.map((t) => (t.id === id ? { ...t, ...partial } : t)) })),

  deleteTrade: (id) =>
    set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),

  reset: () =>
    set({ isConnected: false, account: null, connectionParams: null, trades: [], liveTrades: [] }),

  connectMT5: async (login, password, server) => {
    set({ isLoading: true });
    try {
      const res = await apiPost<{
        success: boolean; message?: string; account?: MT5Account;
        trades?: Trade[]; live_trades?: Trade[];
      }>("/api/mt5/connect", { login, password, server });

      if (res.success) {
        set({
          isConnected: true,
          connectionParams: { login, server },
          account: res.account || null,
          trades: (res.trades || []).map(hydrateTrade),
          liveTrades: res.live_trades || [],
          isLoading: false,
        });
        // Refresh accounts list
        get().fetchAccounts();
        // Start WebSocket for live updates
        get().startWebSocket();
        return { success: true, message: res.message };
      }
      set({ isLoading: false });
      return { success: false, message: res.message };
    } catch (e: any) {
      set({ isLoading: false });
      return { success: false, message: e.message };
    }
  },

  disconnectMT5: async () => {
    try {
      await apiPost("/api/mt5/disconnect");
      get().fetchAccounts(); // Update status
    } catch { }
    if (_ws) { _ws.close(); _ws = null; }
    get().reset();
  },

  loadStatus: async () => {
    if (!getToken()) return;
    try {
      const status = await apiGet<{
        connected: boolean; account: MT5Account | null;
        lastSync: string | null; login: number | null; server: string | null;
      }>("/api/mt5/status");

      set({
        isConnected: status.connected,
        account: status.account,
        lastSync: status.lastSync,
        connectionParams: status.login ? { login: status.login, server: status.server || "" } : null,
      });

      if (status.connected) {
        get().fetchTrades();
        get().startWebSocket();
        // Fetch available symbols from backend cache
        try {
          const sym = await apiGet<{ symbols: string[] }>("/api/mt5/symbols");
          if (sym.symbols?.length) set({ mt5Symbols: sym.symbols });
        } catch { }
      }
    } catch { }
  },

  fetchTrades: async (accountId) => {
    try {
      const res = await apiGet<{ trades: Trade[] }>(accountId ? `/api/mt5/trades?account_id=${accountId}` : "/api/mt5/trades");
      set({ trades: (res.trades || []).map(hydrateTrade) });
    } catch { }
  },

  fetchAccounts: async () => {
    try {
      const res = await apiGet<{ accounts: any[] }>("/api/accounts");
      set({ accounts: res.accounts || [] });
    } catch { }
  },

  toggleAccount: async (accountId) => {
    set({ isLoading: true });
    try {
      await apiPost(`/api/accounts/${accountId}/toggle`);
      await get().loadStatus();
      await get().fetchAccounts();
    } catch { }
    set({ isLoading: false });
  },

  deleteAccount: async (accountId) => {
    if (!confirm("Are you sure? This will delete all trade history for this account.")) return;
    try {
      await apiDelete(`/api/accounts/${accountId}`);
      await get().fetchAccounts();
      // If deleted active one, reset
      if (get().account && get().connectionParams?.login) {
        // Logic to check if active was deleted
        await get().loadStatus();
      }
    } catch { }
  },

  startWebSocket: () => {
    if (_ws && _ws.readyState <= 1) return; // already open/connecting
    const url = buildWsUrl("/ws/mt5");
    _ws = new WebSocket(url);

    _ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const { type } = msg;
        if (type === "account_update") {
          set({ account: msg.account, lastSync: new Date().toISOString() });
        } else if (type === "live_trades") {
          set({ liveTrades: (msg.trades || []).map(hydrateTrade) });
        } else if (type === "symbols") {
          // Bridge pushed full symbol list for this account
          if (msg.symbols?.length) set({ mt5Symbols: msg.symbols });
        } else if (type === "all_trades" || type === "history_batch") {
          const incoming = (msg.trades || []).map(hydrateTrade);
          // WIPE and REPLACE to ensure 1:1 match with MT5
          incoming.sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime());
          set({ trades: incoming });
        } else if (type === "recent_trades") {
          const incoming = (msg.trades || []).map(hydrateTrade);
          const { trades: existing } = get();

          // Merge incoming into existing by ID
          const updated = [...existing];
          incoming.forEach(t => {
            const idx = updated.findIndex(m => m.id === t.id);
            if (idx > -1) updated[idx] = t;
            else updated.push(t);
          });

          updated.sort((a, b) => new Date(b.openTime).getTime() - new Date(a.openTime).getTime());
          set({ trades: updated });
        } else if (type === "new_trade") {
          const { trades } = get();
          const id = msg.trade.id;
          if (!trades.find((t) => t.id === id)) {
            set({ trades: [hydrateTrade(msg.trade), ...trades] });
          }
        } else if (type === "connected") {
          set({ isConnected: true, account: msg.account });
        }
      } catch { }
    };

    _ws.onclose = () => {
      _ws = null;
      // Auto-reconnect after 3s if still connected
      if (get().isConnected) {
        setTimeout(async () => {
          // Re-fetch full trade history from DB first (bridge may only push recent 24h after restart)
          // This ensures dashboard shows all trades immediately without needing manual MT5 reconnect
          try { await get().fetchTrades(); } catch { }
          get().startWebSocket();
        }, 3000);
      }
    };
  },
}));

// ── Filter Store ──────────────────────────────────────────────────────────────
interface FilterStore {
  filter: TradeFilter;
  setFilter: (f: Partial<TradeFilter>) => void;
  resetFilter: () => void;
}

export const useFilterStore = create<FilterStore>()((set) => ({
  filter: DEFAULT_FILTER,
  setFilter: (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  resetFilter: () => set({ filter: DEFAULT_FILTER }),
}));

// ── Theme Store ───────────────────────────────────────────────────────────────
interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  clear: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "light",
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        // Persist to server (non-blocking)
        apiPut("/api/settings", { theme: next }).catch(() => { });
      },
      setTheme: (theme) => {
        set({ theme });
        apiPut("/api/settings", { theme }).catch(() => { });
      },
      clear: () => {
        set({ theme: "light" });
        localStorage.removeItem("theme-store");
      },
    }),
    { name: "theme-store" } // keep localStorage fallback for theme (fast)
  )
);

// ── News Notification Store ───────────────────────────────────────────────────
export interface NewsSettings {
  enabled: boolean;
  currencies: string[];
  impacts: string[];
  minutesBefore: number;
}

interface NewsStore {
  settings: NewsSettings;
  updateSettings: (partial: Partial<NewsSettings>) => void;
  notifiedIds: string[];
  markNotified: (id: string) => void;
  clearOldNotified: () => void;
  loadFromServer: () => Promise<void>;
  clear: () => void;
}

export const useNewsStore = create<NewsStore>()(
  persist(
    (set, get) => ({
      settings: { enabled: false, currencies: ["USD"], impacts: ["High"], minutesBefore: 5 },
      updateSettings: (partial) => {
        const next = { ...get().settings, ...partial };
        set({ settings: next });
        apiPut("/api/settings", { newsSettings: next }).catch(() => { });
      },
      notifiedIds: [],
      markNotified: (id) =>
        set((s) => ({ notifiedIds: s.notifiedIds.includes(id) ? s.notifiedIds : [...s.notifiedIds, id].slice(-200) })),
      clearOldNotified: () => set({ notifiedIds: [] }),
      loadFromServer: async () => {
        try {
          const res = await apiGet<{ newsSettings: NewsSettings }>("/api/settings");
          if (res.newsSettings) set({ settings: res.newsSettings });
        } catch { }
      },
      clear: () => {
        set({ settings: { enabled: false, currencies: ["USD"], impacts: ["High"], minutesBefore: 5 } });
        localStorage.removeItem("news-store");
      },
    }),
    { name: "news-store" }
  )
);

// ── Alert Store ───────────────────────────────────────────────────────────────
export interface CandleAlert {
  id: string; type: "candle"; symbol: string; timeframe: string;
  minBodyPips: number; maxWickPercent: number; soundUri: string; enabled: boolean;
}

export interface PriceAlert {
  id: string; type: "price"; symbol: string; trigger: "Above" | "Below" | "Crosses";
  targetPrice: number; frequency: "Once" | "Everytime"; notes: string; enabled: boolean; soundUri: string;
}

export type AnyAlert = CandleAlert | PriceAlert;

export interface AlertToast {
  id: string; title: string; message: string; type: "bullish" | "bearish";
}

export interface AlertHistoryItem {
  id: string;
  triggeredAt: string;
  data: {
    title: string;
    body: string;
    symbol: string;
    type: string;
    alert_data: AnyAlert;
  };
}

interface AlertStore {
  alerts: AnyAlert[];
  history: AlertHistoryItem[];
  addAlert: (alert: Omit<CandleAlert, "id"> | Omit<PriceAlert, "id">) => Promise<void>;
  updateAlert: (id: string, partial: Partial<CandleAlert> | Partial<PriceAlert>) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  notifiedIds: string[];
  markNotified: (id: string) => void;
  clearOldNotified: () => void;
  activeToasts: AlertToast[];
  addToast: (toast: Omit<AlertToast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useAlertStore = create<AlertStore>()((set, get) => ({
  alerts: [],
  history: [],

  fetchAlerts: async () => {
    try {
      const res = await apiGet<{ alerts: AnyAlert[] }>("/api/alerts");
      set({ alerts: res.alerts || [] });
    } catch { }
  },

  fetchHistory: async () => {
    try {
      const res = await apiGet<{ history: AlertHistoryItem[] }>("/api/alerts/history");
      set({ history: res.history || [] });
    } catch { }
  },

  clearHistory: async () => {
    try {
      await apiDelete("/api/alerts/history");
      set({ history: [] });
    } catch { }
  },

  addAlert: async (alert) => {
    try {
      const res = await apiPost<{ ok: boolean; alert: AnyAlert }>("/api/alerts", { data: alert });
      if (res.ok) set((s) => ({ alerts: [...s.alerts, res.alert] }));
    } catch { }
  },

  updateAlert: async (id, partial) => {
    try {
      const res = await apiPut<{ ok: boolean; alert: AnyAlert }>(`/api/alerts/${id}`, { partial });
      if (res.ok) set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? res.alert : a)) }));
    } catch { }
  },

  deleteAlert: async (id) => {
    try {
      await apiDelete(`/api/alerts/${id}`);
      set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
    } catch { }
  },

  notifiedIds: [],
  markNotified: (id) =>
    set((s) => ({
      notifiedIds: s.notifiedIds.includes(id) ? s.notifiedIds : [...s.notifiedIds, id].slice(-500),
    })),
  clearOldNotified: () => set({ notifiedIds: [] }),

  activeToasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((s) => ({ activeToasts: [...s.activeToasts, { ...toast, id }] }));
    setTimeout(() => set((s) => ({ activeToasts: s.activeToasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ activeToasts: s.activeToasts.filter((t) => t.id !== id) })),
}));

// ── Journal Store ─────────────────────────────────────────────────────────────
interface JournalStore {
  notes: Record<string, string>;
  dailyTags: Record<string, string[]>;
  tags: string[];
  isLoaded: boolean;

  fetchJournal: () => Promise<void>;
  setNote: (day: string, text: string) => void;
  toggleDailyTag: (day: string, tag: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
}

export const useJournalStore = create<JournalStore>()((set, get) => ({
  notes: {},
  dailyTags: {},
  tags: ["Followed Plan", "FOMO", "Revenge Trading", "Impatient", "Good Setup", "News Event"],
  isLoaded: false,

  fetchJournal: async () => {
    try {
      const res = await apiGet<{ notes: Record<string, string>; tags: string[]; dailyTags: Record<string, string[]> }>("/api/journal");
      set({ notes: res.notes || {}, tags: res.tags || [], dailyTags: res.dailyTags || {}, isLoaded: true });
    } catch { }
  },

  setNote: (day, text) => {
    set((s) => ({ notes: { ...s.notes, [day]: text } }));
    apiPost("/api/journal/note", { day, text }).catch(() => { });
  },

  toggleDailyTag: (day, tag) => {
    const current = get().dailyTags[day] || [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    set((s) => ({ dailyTags: { ...s.dailyTags, [day]: next } }));
    apiPost("/api/journal/daily-tag/toggle", { day, tag }).catch(() => { });
  },

  addTag: (tag) => {
    set((s) => ({ tags: s.tags.includes(tag) ? s.tags : [...s.tags, tag] }));
    apiPost("/api/journal/tag", { name: tag }).catch(() => { });
  },

  removeTag: (tag) => {
    set((s) => ({ tags: s.tags.filter((t) => t !== tag) }));
    apiDelete("/api/journal/tag", { name: tag }).catch(() => { });
  },
}));

// ── Hydration helper ──────────────────────────────────────────────────────────
function hydrateTrade(t: Trade): Trade {
  const status = (typeof t.status === "string" ? t.status.toLowerCase() : "closed") as "closed" | "live" | "pending";

  // Ensure we have a valid openTimeWIB for calendar/journal sorting
  let openTimeWIB = t.openTimeWIB;
  if (!openTimeWIB && t.openTime) {
    openTimeWIB = toWIB(t.openTime);
  }

  const closeTimeWIB = t.closeTimeWIB || (t.closeTime ? toWIB(t.closeTime) : "");
  let session = t.session;
  if (!session || session === "Unknown") {
    session = openTimeWIB ? detectSession(openTimeWIB) : "Unknown";
  }
  const durationMs =
    t.durationMs ||
    (t.openTime && t.closeTime
      ? Math.max(new Date(t.closeTime).getTime() - new Date(t.openTime).getTime(), 0)
      : 0);
  return {
    ...t,
    status,
    openTimeWIB,
    closeTimeWIB,
    session,
    durationMs,
    pips: t.pips ?? 0,
    pnl: t.pnl ?? 0,
    lots: t.lots ?? 0
  };
}

// ── Computed hook ─────────────────────────────────────────────────────────────
export function useFilteredTrades() {
  const { trades, liveTrades } = useMT5Store();
  const { filter } = useFilterStore();
  const all = [...trades, ...liveTrades].map(hydrateTrade);
  const filtered = applyFilter(all, filter);
  const stats = calcStats(filtered);
  return { all, filtered, stats };
}
