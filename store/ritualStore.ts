
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RitualItem {
    id: string;
    label: string;
    completed: boolean;
    icon: string;
}

interface RitualStore {
    items: RitualItem[];
    lastReset: string | null;
    toggleItem: (id: string) => void;
    resetRitual: () => void;
    checkReset: () => void;
    getProgress: () => number;
    isAllCompleted: () => boolean;
}

const DEFAULT_ITEMS: RitualItem[] = [
    { id: 'mindset', label: 'Mindset Check', completed: false, icon: 'Brain' },
    { id: 'news', label: 'Economic Calendar', completed: false, icon: 'Calendar' },
    { id: 'bias', label: 'Daily Market Bias', completed: false, icon: 'Compass' },
    { id: 'risk', label: 'Risk Defined', completed: false, icon: 'ShieldCheck' },
    { id: 'plan', label: 'Execution Plan', completed: false, icon: 'Map' },
];

export const useRitualStore = create<RitualStore>()(
    persist(
        (set, get) => ({
            items: DEFAULT_ITEMS,
            lastReset: null,
            toggleItem: (id) => {
                set((state) => ({
                    items: state.items.map((item) =>
                        item.id === id ? { ...item, completed: !item.completed } : item
                    ),
                }));
            },
            resetRitual: () => {
                set({ items: DEFAULT_ITEMS, lastReset: new Date().toISOString() });
            },
            checkReset: () => {
                const { lastReset } = get();
                if (!lastReset) return;

                const lastDate = new Date(lastReset).toDateString();
                const today = new Date().toDateString();

                if (lastDate !== today) {
                    set({ items: DEFAULT_ITEMS, lastReset: new Date().toISOString() });
                }
            },
            getProgress: () => {
                const { items } = get();
                const completedCount = items.filter((i) => i.completed).length;
                return (completedCount / items.length) * 100;
            },
            isAllCompleted: () => {
                return get().items.every((i) => i.completed);
            }
        }),
        {
            name: "pilot-ritual-storage",
        }
    )
);
