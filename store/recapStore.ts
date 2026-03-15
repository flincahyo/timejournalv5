import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RecapSettings, RecapSettingsUpdate } from "@/types";
import { apiGet, apiPatch, apiPostFormData } from "@/lib/api";

interface RecapStore {
    settings: RecapSettings;
    isLoading: boolean;
    updateSettings: (partial: RecapSettingsUpdate) => Promise<void>;
    loadSettings: () => Promise<void>;
    uploadSound: (file: File) => Promise<string>;
    clear: () => void;
}

const DEFAULT_SETTINGS: RecapSettings = {
    enabled: true,
    emotion_choices: ["Confident", "Anxious", "Neutral", "Revengeful", "Greedy", "Fearful"],
    setup_choices: ["A+ Setup", "Followed Plan", "FOMO Entry", "Early Exit", "Poor R:R", "Chasing Price"],
    profit_sound: "default_profit",
    loss_sound: "default_loss"
};

export const useRecapStore = create<RecapStore>()(
    persist(
        (set, get) => ({
            settings: DEFAULT_SETTINGS,
            isLoading: false,
            updateSettings: async (partial) => {
                try {
                    const res = await apiPatch<any>("/api/auth/settings/recap", partial);
                    if (res.ok) {
                        set({ settings: { ...get().settings, ...partial } });
                    }
                } catch (err) {
                    console.error("Failed to update recap settings:", err);
                }
            },
            loadSettings: async () => {
                set({ isLoading: true });
                try {
                    const res = await apiGet<any>("/api/auth/settings");
                    if (res.recap_settings) {
                        set({ settings: { ...DEFAULT_SETTINGS, ...res.recap_settings } });
                    }
                } catch (err) {
                    console.error("Failed to load recap settings:", err);
                } finally {
                    set({ isLoading: false });
                }
            },
            uploadSound: async (file) => {
                const formData = new FormData();
                formData.append("file", file);
                
                const data = await apiPostFormData<{ url: string }>("/api/auth/upload-sound", formData);
                return data.url;
            },
            clear: () => set({ settings: DEFAULT_SETTINGS }),
        }),
        { name: "recap-store" }
    )
);
