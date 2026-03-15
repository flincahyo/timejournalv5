"use client";
import React, { useState, useRef } from "react";
import { useRecapStore } from "@/store";
import { Plus, Trash2, Volume2, Music, Upload, Check, X, Play, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RecapSettingsDrawer() {
    const { settings, updateSettings, uploadSound, isLoading } = useRecapStore();
    const [newEmotion, setNewEmotion] = useState("");
    const [newSetup, setNewSetup] = useState("");
    const [isUploading, setIsUploading] = useState<"profit" | "loss" | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddEmotion = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmotion.trim()) return;
        if (settings.emotion_choices.includes(newEmotion)) return;
        updateSettings({ emotion_choices: [...settings.emotion_choices, newEmotion.trim()] });
        setNewEmotion("");
    };

    const handleAddSetup = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSetup.trim()) return;
        if (settings.setup_choices.includes(newSetup)) return;
        updateSettings({ setup_choices: [...settings.setup_choices, newSetup.trim()] });
        setNewSetup("");
    };

    const removeEmotion = (val: string) => {
        updateSettings({ emotion_choices: settings.emotion_choices.filter(c => c !== val) });
    };

    const removeSetup = (val: string) => {
        updateSettings({ setup_choices: settings.setup_choices.filter(c => c !== val) });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "profit" | "loss") => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploading(type);
        try {
            const url = await uploadSound(file);
            updateSettings({ [type === 'profit' ? 'profit_sound' : 'loss_sound']: url });
        } catch (err) {
            console.error(err);
            alert("Gagal mengunggah file audio");
        } finally {
            setIsUploading(null);
        }
    };

    const playPreview = (url: string) => {
        if (!url || url.startsWith('default')) return;
        const audio = new Audio(url);
        audio.play().catch(e => console.log(e));
    };

    return (
        <div className="flex flex-col gap-10 pb-20">
            {/* Master Toggle */}
            <div className="p-6 bg-surface2 rounded-3xl border border-border flex items-center justify-between">
                <div>
                    <h4 className="text-[14px] font-black text-text uppercase tracking-tight">Recap Activity</h4>
                    <p className="text-[11px] text-text3 mt-1 font-medium opacity-70">Show pop-up immediately when a trade is closed</p>
                </div>
                <button 
                    onClick={() => updateSettings({ enabled: !settings.enabled })}
                    className={`w-14 h-8 rounded-full transition-all relative ${settings.enabled ? 'bg-accent shadow-lg shadow-accent/20' : 'bg-surface3 border border-border'}`}
                >
                    <motion.div 
                        animate={{ x: settings.enabled ? 24 : 4 }}
                        className={`w-6 h-6 rounded-full top-1 absolute shadow-sm ${settings.enabled ? 'bg-white' : 'bg-text3'}`}
                    />
                </button>
            </div>

            {/* Template Management */}
            <div className="flex flex-col gap-8">
                {/* Setup Qualities */}
                <section>
                    <div className="flex items-baseline justify-between mb-4 px-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text3 opacity-60">Setup Templates</label>
                        <span className="text-[9px] font-bold text-accent px-2 py-0.5 bg-accent/10 rounded-full">{settings.setup_choices.length} Total</span>
                    </div>
                    
                    <form onSubmit={handleAddSetup} className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={newSetup}
                            onChange={(e) => setNewSetup(e.target.value)}
                            placeholder="Add new setup type..."
                            className="flex-1 bg-surface2 border border-border rounded-2xl px-4 py-3 text-[13px] font-bold text-text focus:border-accent outline-none transition-all placeholder:text-text3/30"
                        />
                        <button type="submit" className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all">
                            <Plus size={18} strokeWidth={2.5} />
                        </button>
                    </form>

                    <div className="flex flex-wrap gap-2">
                        {settings.setup_choices.map(choice => (
                            <div key={choice} className="group flex items-center gap-2 px-4 py-2 bg-surface2 border border-border rounded-xl text-[12px] font-bold text-text2 hover:border-accent/30 transition-all">
                                <span>{choice}</span>
                                <button onClick={() => removeSetup(choice)} className="text-text3 hover:text-red opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Emotions */}
                <section>
                    <div className="flex items-baseline justify-between mb-4 px-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text3 opacity-60">Emotion Templates</label>
                        <span className="text-[9px] font-bold text-blue px-2 py-0.5 bg-blue/10 rounded-full">{settings.emotion_choices.length} Total</span>
                    </div>
                    
                    <form onSubmit={handleAddEmotion} className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={newEmotion}
                            onChange={(e) => setNewEmotion(e.target.value)}
                            placeholder="Add trading emotion..."
                            className="flex-1 bg-surface2 border border-border rounded-2xl px-4 py-3 text-[13px] font-bold text-text focus:border-blue outline-none transition-all placeholder:text-text3/30"
                        />
                        <button type="submit" className="p-3 bg-blue text-white rounded-2xl shadow-lg shadow-blue/20 hover:scale-105 active:scale-95 transition-all">
                            <Plus size={18} strokeWidth={2.5} />
                        </button>
                    </form>

                    <div className="flex flex-wrap gap-2">
                        {settings.emotion_choices.map(choice => (
                            <div key={choice} className="group flex items-center gap-2 px-4 py-2 bg-surface2 border border-border rounded-xl text-[12px] font-bold text-text2 hover:border-blue/30 transition-all">
                                <span>{choice}</span>
                                <button onClick={() => removeEmotion(choice)} className="text-text3 hover:text-red opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Sound Management */}
            <section className="bg-surface2/50 rounded-3xl p-6 border border-border border-dashed">
                <div className="flex items-center gap-2 mb-6 opacity-60">
                    <Volume2 size={16} className="text-accent" />
                    <label className="text-[11px] font-black uppercase tracking-[0.15em] text-text3">Audio Feedback</label>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Profit Sound */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[13px] font-bold text-text">Profit Notification</div>
                            <div className="text-[11px] text-text3 mt-0.5 truncate max-w-[150px]">{settings.profit_sound === 'default_profit' ? 'Default Chime' : 'Custom Sound'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            {settings.profit_sound !== 'default_profit' && (
                                <button onClick={() => playPreview(settings.profit_sound)} className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors">
                                    <Play size={16} fill="currentColor" />
                                </button>
                            )}
                            <label className="cursor-pointer p-2 px-3 bg-surface3 border border-border rounded-xl text-[11px] font-extrabold text-text2 hover:text-text transition-all flex items-center gap-2 shadow-sm">
                                <Music size={14} />
                                <span>{isUploading === 'profit' ? 'Uploading...' : 'Custom'}</span>
                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'profit')} />
                            </label>
                            {settings.profit_sound !== 'default_profit' && (
                                <button onClick={() => updateSettings({ profit_sound: 'default_profit' })} className="p-2 text-text3 hover:text-red rounded-lg">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Loss Sound */}
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[13px] font-bold text-text">Loss Notification</div>
                            <div className="text-[11px] text-text3 mt-0.5 truncate max-w-[150px]">{settings.loss_sound === 'default_loss' ? 'Default Chime' : 'Custom Sound'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            {settings.loss_sound !== 'default_loss' && (
                                <button onClick={() => playPreview(settings.loss_sound)} className="p-2 text-red hover:bg-red/10 rounded-lg transition-colors">
                                    <Play size={16} fill="currentColor" />
                                </button>
                            )}
                            <label className="cursor-pointer p-2 px-3 bg-surface3 border border-border rounded-xl text-[11px] font-extrabold text-text2 hover:text-text transition-all flex items-center gap-2 shadow-sm">
                                <Music size={14} />
                                <span>{isUploading === 'loss' ? 'Uploading...' : 'Custom'}</span>
                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, 'loss')} />
                            </label>
                            {settings.loss_sound !== 'default_loss' && (
                                <button onClick={() => updateSettings({ loss_sound: 'default_loss' })} className="p-2 text-text3 hover:text-red rounded-lg">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <div className="p-6 bg-blue/5 rounded-3xl border border-blue/10 flex gap-4">
                <Info size={20} className="text-blue shrink-0 mt-0.5" />
                <p className="text-[12px] text-text3 font-medium leading-relaxed">
                    Personalized templates and audio cues are synchronized with your account and will be stored for all future sessions.
                </p>
            </div>
        </div>
    );
}
