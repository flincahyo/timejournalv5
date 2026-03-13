
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TerminalWidget, WidgetType } from "@/types/terminal";
import { apiPut, apiGet } from "@/lib/api";

interface TerminalStore {
    version: number;
    widgets: TerminalWidget[];
    isEditMode: boolean;
    isLoaded: boolean; // Added to prevent sync before server data is loaded
    setWidgets: (widgets: TerminalWidget[]) => void;
    toggleEditMode: () => void;
    addWidget: (type: WidgetType, title?: string, content?: string) => void;
    removeWidget: (id: string) => void;
    resetLayout: () => void;
    clearLayout: () => void;
    syncWithServer: () => void;
    loadLayoutFromServer: () => Promise<void>;
}

const CURRENT_VERSION = 9; // Force reset for Topbar stats integration

const DEFAULT_WIDGETS: TerminalWidget[] = [
    { id: "chart-1", type: "chart", layout: { x: 0, y: 0, w: 9, h: 14, minW: 3, minH: 4 }, isVisible: true },
    { id: "market-1", type: "market_hours", layout: { x: 9, y: 0, w: 3, h: 5, minW: 1, minH: 2 }, isVisible: true },
    { id: "news-1", type: "news_economic", layout: { x: 9, y: 5, w: 3, h: 9, minW: 1, minH: 2 }, isVisible: true },
    { id: "live-1", type: "live_trades", layout: { x: 0, y: 14, w: 12, h: 7, minW: 3, minH: 2 }, isVisible: true },
];

export const useTerminalStore = create<TerminalStore>()(
    persist(
        (set, get) => ({
            version: CURRENT_VERSION,
            widgets: DEFAULT_WIDGETS,
            isEditMode: false,
            isLoaded: false,
            setWidgets: (widgets) => {
                set({ widgets });
                get().syncWithServer();
            },
            toggleEditMode: () => {
                const next = !get().isEditMode;
                set({ isEditMode: next });
                if (!next) get().syncWithServer();
            },
            addWidget: (type, title, content) => {
                const { widgets } = get();
                const id = `${type}-${Date.now()}`;
                set({
                    widgets: [
                        ...widgets,
                        {
                            id,
                            type,
                            title: title || type.replace('_', ' ').toUpperCase(),
                            content,
                            layout: { x: 0, y: Infinity, w: 3, h: 4, minW: 1, minH: 2 },
                            isVisible: true
                        }
                    ]
                });
                get().syncWithServer();
            },
            removeWidget: (id) => {
                set({ widgets: get().widgets.filter(w => w.id !== id) });
                get().syncWithServer();
            },
            resetLayout: () => {
                set({ widgets: DEFAULT_WIDGETS, isEditMode: false });
                get().syncWithServer();
            },
            clearLayout: () => {
                set({ widgets: DEFAULT_WIDGETS, isEditMode: false, isLoaded: false });
                localStorage.removeItem("terminal-storage");
                localStorage.removeItem("terminal-layout-store-v2");
            },
            syncWithServer: () => {
                const { widgets, isLoaded } = get();
                // CRITICAL: Never sync if we haven't successfully loaded from server yet
                if (!isLoaded) return;

                apiPut("/api/settings", { terminalLayout: { widgets } })
                    .catch((e) => {
                        console.error("Failed to sync terminal layout:", e);
                    });
            },
            loadLayoutFromServer: async () => {
                try {
                    const res = await apiGet<{ terminalLayout: { widgets: TerminalWidget[] } | null }>("/api/settings");
                    console.log("[TerminalStore] Loaded from server:", res?.terminalLayout?.widgets?.length, "widgets");
                    if (res?.terminalLayout?.widgets && res.terminalLayout.widgets.length > 0) {
                        set({ widgets: res.terminalLayout.widgets, isLoaded: true });
                    } else {
                        // If server has no layout, we mark as loaded so user can start fresh
                        set({ widgets: DEFAULT_WIDGETS, isLoaded: true });
                    }
                } catch (err) {
                    console.error("[TerminalStore] Failed to load layout from server:", err);
                    // DO NOT set isLoaded to true here. 
                    // This prevents local defaults from overwriting server data if it was just a transient error.
                }
            },
        }),
        {
            name: "terminal-layout-store-v2",
            onRehydrateStorage: (state) => {
                return (rehydratedState) => {
                    if (rehydratedState && rehydratedState.version !== CURRENT_VERSION) {
                        rehydratedState.resetLayout();
                        rehydratedState.version = CURRENT_VERSION;
                    }
                };
            }
        }
    )
);
