"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMT5Store, useRecapStore, useJournalStore } from "@/store";
import { Trade } from "@/types";
import { fmtUSD, fmtPips } from "@/lib/utils";
import { Save, MessageSquare, Zap, Activity } from "lucide-react";
import confetti from "canvas-confetti";
import { apiPatch } from "@/lib/api";
import { createPortal } from "react-dom";

export default function TradeRecapModal() {
    const { recapQueue, removeFromRecapQueue, updateTrade } = useMT5Store();
    const { settings } = useRecapStore();
    const { fetchJournal } = useJournalStore();
    
    const [currentTrade, setCurrentTrade] = useState<Trade | null>(null);
    const [selectedSetup, setSelectedSetup] = useState("");
    const [selectedEmotion, setSelectedEmotion] = useState("");
    const [note, setNote] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => { document.body.style.overflow = ""; };
    }, []);

    // Get the next trade in queue
    useEffect(() => {
        if (!currentTrade && recapQueue.length > 0) {
            const next = recapQueue[0];
            setCurrentTrade(next);
            setSelectedSetup(next.setup || "");
            setSelectedEmotion(next.emotion || "");
            setNote(next.note || "");
            document.body.style.overflow = "hidden";
            
            // Trigger feedback
            if (next.pnl > 0) {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#10b981', '#3b82f6', '#ffffff']
                });
                playAudio(settings.profit_sound);
            } else {
                playAudio(settings.loss_sound);
            }
        } else if (!recapQueue.length) {
            document.body.style.overflow = "";
        }
    }, [recapQueue, currentTrade, settings]);

    const playAudio = (soundUrl: string) => {
        if (!soundUrl || soundUrl === 'default_profit' || soundUrl === 'default_loss') return;
        const audio = new Audio(soundUrl);
        audio.play().catch(e => console.log("Audio play failed:", e));
    };

    const handleSave = async () => {
        if (!currentTrade || !selectedSetup || !selectedEmotion) return;
        setIsSaving(true);
        try {
            await apiPatch(`/api/trades/${currentTrade.ticket || (currentTrade as any).id}`, {
                setup: selectedSetup,
                emotion: selectedEmotion,
                notes: note
            });
            
            // Synchronize with local store immediately
            updateTrade(currentTrade.id, {
                setup: selectedSetup,
                emotion: selectedEmotion,
                note: note
            });

            removeFromRecapQueue(currentTrade.id);
            setCurrentTrade(null);
            setSelectedSetup("");
            setSelectedEmotion("");
            setNote("");
            fetchJournal();
        } catch (err) {
            console.error("Failed to save recap:", err);
        } finally {
            setIsSaving(false);
        }
    };

    if (!currentTrade || !mounted) return null;

    const isProfit = currentTrade.pnl > 0;
    const canSave = selectedSetup && selectedEmotion;

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/80 transition-all duration-300">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-surface border border-border rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
                >
                    {/* Header with Result */}
                    <div className={`p-8 pb-6 relative overflow-hidden ${isProfit ? 'bg-green/5' : 'bg-red/5'}`}>
                        <div className={`absolute -top-24 -left-24 w-64 h-64 rounded-full blur-[100px] opacity-20 ${isProfit ? 'bg-green' : 'bg-red'}`} />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text3 opacity-60">Trade Result</span>
                                <h2 className={`text-5xl font-black tabular-nums tracking-tighter mt-1 ${isProfit ? 'text-green' : 'text-red'}`}>
                                    {isProfit ? '+' : ''}{fmtUSD(currentTrade.pnl)}
                                </h2>
                                <div className="flex gap-4 mt-2">
                                    <div className="flex items-center gap-1.5 grayscale opacity-70">
                                        <Zap size={14} className="text-yellow-500" />
                                        <span className="text-[13px] font-bold text-text">{fmtPips(currentTrade.pips)} Pips</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 grayscale opacity-70">
                                        <Activity size={14} className="text-blue" />
                                        <span className="text-[13px] font-bold text-text">{currentTrade.symbol} • {currentTrade.type}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 pt-2 flex flex-col gap-8">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text3 opacity-60 block mb-4">Setup Quality</label>
                            <div className="flex flex-wrap gap-2">
                                {settings.setup_choices.map(choice => (
                                    <button
                                        key={choice}
                                        onClick={() => setSelectedSetup(choice)}
                                        className={`px-5 py-3 rounded-2xl text-[13px] font-bold transition-all border ${
                                            selectedSetup === choice 
                                            ? "bg-accent border-accent text-white shadow-lg shadow-accent/20 scale-105" 
                                            : "bg-surface2 border-border text-text2 hover:border-accent/40 hover:text-text"
                                        }`}
                                    >
                                        {choice}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text3 opacity-60 block mb-4">How did you feel?</label>
                            <div className="flex flex-wrap gap-2">
                                {settings.emotion_choices.map(choice => (
                                    <button
                                        key={choice}
                                        onClick={() => setSelectedEmotion(choice)}
                                        className={`px-5 py-3 rounded-2xl text-[13px] font-bold transition-all border ${
                                            selectedEmotion === choice 
                                            ? "bg-blue border-blue text-white shadow-lg shadow-blue/20 scale-105" 
                                            : "bg-surface2 border-border text-text2 hover:border-blue/40 hover:text-text"
                                        }`}
                                    >
                                        {choice}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                             <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text3 opacity-60 block">Journal Entry (Optional)</label>
                             <div className="relative">
                                 <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Write your thoughts about this trade..."
                                    className="w-full bg-surface2 border border-border rounded-[1.5rem] p-5 pt-6 text-[14px] font-semibold text-text focus:border-accent outline-none transition-all h-32 resize-none placeholder:text-text3/30"
                                 />
                                 <MessageSquare size={16} className="absolute top-4 right-5 text-text3 opacity-20" />
                             </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !canSave}
                                className="w-full bg-accent text-white px-6 py-5 rounded-[1.25rem] text-[13px] font-black uppercase tracking-widest shadow-xl shadow-accent/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} strokeWidth={2.5} />
                                )}
                                {canSave ? "Log Trade Recap" : "Select Setup & Emotion"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
