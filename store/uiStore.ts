import { create } from "zustand";

type DrawerType = "ai_analyst" | "add_trade" | "mt5_connect" | "filter" | "date_range" | "account" | "share" | null;

interface UIStore {
    activeDrawer: DrawerType;
    openDrawer: (type: DrawerType) => void;
    closeDrawer: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
    activeDrawer: null,
    openDrawer: (type) => set({ activeDrawer: type }),
    closeDrawer: () => set({ activeDrawer: null }),
}));
