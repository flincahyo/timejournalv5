
"use client";
import React, { useState } from "react";
import { useTerminalStore } from "@/store";
import { Plus, RotateCcw, Code2, Layout, X } from "lucide-react";
import { WidgetType } from "@/types/terminal";

const WIDGET_OPTIONS: { type: WidgetType; label: string; description: string }[] = [
    { type: "chart", label: "Advanced Chart", description: "TradingView advanced charting library" },
    { type: "market_hours", label: "Market Sessions", description: "Myfxbook market hours widget" },
    { type: "news_economic", label: "Economic Calendar", description: "TradingView economic calendar" },
    { type: "news_timeline", label: "News Timeline", description: "TradingView real-time news feed" },
    { type: "live_trades", label: "Live Positions", description: "Monitor your active MT5 trades" },
    { type: "trading_ritual", label: "The Pilot's Ritual", description: "Pre-flight professional trader checklist" },
    { type: "price_alerts", label: "Price Alerts", description: "Track your active and triggered alerts" },
];

export default function TerminalToolbar() {
    const { isEditMode, addWidget, resetLayout } = useTerminalStore();
    const [showPicker, setShowPicker] = useState(false);
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customTitle, setCustomTitle] = useState("");
    const [customCode, setCustomCode] = useState("");

    if (!isEditMode) return null;

    const handleAddCustom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customTitle || !customCode) return;
        addWidget("custom_html", customTitle, customCode);
        setCustomTitle("");
        setCustomCode("");
        setShowCustomForm(false);
    };

    return (
        <>
            {/* Floating Customization Bar */}
            <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
                <div className="flex items-center gap-2 p-2 bg-surface/90 backdrop-blur-md border border-border rounded-3xl shadow-2xl">
                    <div className="flex items-center gap-2 px-4 border-r border-border mr-1">
                        <Layout size={14} className="text-accent" />
                        <span className="text-[11px] font-bold text-text3 uppercase tracking-wider">Layout Edit</span>
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowPicker(!showPicker)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-bold bg-accent text-white shadow-lg shadow-accent/10 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Plus size={15} strokeWidth={2.5} />
                            Add Widget
                        </button>

                        {showPicker && (
                            <div className="absolute bottom-full left-0 mb-4 w-72 bg-surface border border-border rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-3 py-2 border-b border-border/50 mb-1">
                                    <div className="text-[10px] font-black text-text3 uppercase tracking-widest">Widget Library</div>
                                </div>
                                <div className="max-h-80 overflow-y-auto no-scrollbar grid grid-cols-1 gap-1">
                                    {WIDGET_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.type}
                                            onClick={() => {
                                                addWidget(opt.type);
                                                setShowPicker(false);
                                            }}
                                            className="w-full text-left p-3 rounded-xl hover:bg-blue/5 group transition-all border border-transparent hover:border-blue/10"
                                        >
                                            <div className="text-[11px] font-bold text-text group-hover:text-blue transition-colors">{opt.label}</div>
                                            <div className="text-[9px] text-text3 leading-tight mt-0.5 line-clamp-1">{opt.description}</div>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            setShowCustomForm(true);
                                            setShowPicker(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 mt-1 rounded-xl bg-blue text-white shadow-md hover:opacity-90 transition-all text-left"
                                    >
                                        <Code2 size={16} strokeWidth={2.5} />
                                        <div>
                                            <div className="text-[11px] font-black uppercase leading-none">Hot-Plug Embed</div>
                                            <div className="text-[9px] opacity-70 mt-1">Paste HTML/React Code</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={resetLayout}
                        className="p-2.5 rounded-xl bg-surface2 text-text3 hover:text-red hover:bg-red/5 border border-transparent hover:border-red/20 transition-all active:scale-90"
                        title="Reset to default layout"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>
            </div>

            {/* Custom Widget Modal */}
            {showCustomForm && (
                <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-surface border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-6 py-5 border-b border-border bg-surface2 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue/10 rounded-xl text-blue">
                                    <Code2 size={20} />
                                </div>
                                <h3 className="text-[16px] font-black text-text tracking-tight uppercase">Hot-Plug Custom Widget</h3>
                            </div>
                            <button onClick={() => setShowCustomForm(false)} className="text-text3 hover:text-text p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleAddCustom} className="p-8 flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-widest px-1">Widget Name</label>
                                <input
                                    type="text"
                                    value={customTitle}
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    placeholder="e.g., Fear & Greed Index"
                                    className="w-full bg-surface2 border border-border rounded-2xl px-5 py-4 text-sm font-bold text-text focus:border-blue outline-none transition-all placeholder:text-text3/40 shadow-inner"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-widest px-1">Embed Code (HTML/Script)</label>
                                <textarea
                                    value={customCode}
                                    onChange={(e) => setCustomCode(e.target.value)}
                                    placeholder="Paste your <iframe> or <script> code here..."
                                    className="w-full bg-surface2 border border-border rounded-2xl px-5 py-4 text-xs font-mono text-text focus:border-blue outline-none transition-all h-44 resize-none no-scrollbar placeholder:text-text3/40 shadow-inner"
                                    required
                                />
                            </div>
                            <div className="flex gap-4 mt-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue text-white px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-blue/20 hover:bg-blue/90 active:scale-95 transition-all outline-none"
                                >
                                    Add to Terminal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
