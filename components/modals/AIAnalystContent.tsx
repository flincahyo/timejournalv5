"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { apiPost } from "@/lib/api";
import { Trade, TradeStats } from "@/types";

interface AIAnalystContentProps {
    stats: TradeStats;
    closedTrades: Trade[];
    onClose: () => void;
}

export default function AIAnalystContent({ stats, closedTrades, onClose }: AIAnalystContentProps) {
    const [aiInsights, setAiInsights] = useState("");
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    const generateAIInsights = async () => {
        if (!stats || stats.totalTrades === 0) {
            alert("Belum ada data trading yang cukup untuk dianalisis oleh AI.");
            return;
        }

        setIsGeneratingAI(true);
        setAiInsights("");

        // Determine recent streak roughly
        const recentTrades = closedTrades.slice(0, 10);
        const recentWins = recentTrades.filter(t => t.pnl > 0).length;
        const streakCtx = recentTrades.length ? `${recentWins} wins out of last ${recentTrades.length} trades.` : "No recent trades.";

        try {
            const payload = {
                totalTrades: stats.totalTrades,
                winRate: stats.winRate,
                totalPnl: stats.totalPnl,
                bestSymbol: stats.bestSymbol,
                worstSymbol: stats.worstSymbol,
                recentStreaks: streakCtx,
                notes: `Avg RR is ${stats.avgRR.toFixed(2)}, Longs: ${stats.longWins}/${stats.longWins + stats.longLosses || 0} wins, Shorts: ${stats.shortWins}/${stats.shortWins + stats.shortLosses || 0} wins.`
            };

            const data = await apiPost<any>("/api/ai/analyze", payload);
            if (data.success) {
                setAiInsights(data.insight);
            } else {
                setAiInsights("[ERROR] AI Agent gagal memberikan analisis. Cek koneksi backend/API Key Gemini.");
            }
        } catch (err) {
            console.error("AI Error:", err);
            setAiInsights("[ERROR] Terjadi kesalahan saat menghubungi API AI Analyst.");
        } finally {
            setIsGeneratingAI(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-bg" onClick={e => e.stopPropagation()}>
            <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col items-center">
                {!aiInsights && !isGeneratingAI && (
                    <div className="flex flex-col items-center justify-center text-center py-12 px-4 flex-1">
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4 text-accent">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M12 12 2.1 12" /><path d="M12 12 21.9 12" /><path d="M12 12 12 21.9" /><path d="M12 12 12 2.1" /></svg>
                        </div>
                        <h3 className="text-[15px] font-bold text-text mb-2">Evaluasi Performa Terkini</h3>
                        <p className="text-[13px] text-text3 mb-6 max-w-sm">
                            AI Analyst akan membaca rasio kemenangan, PnL per instrumen, streak, dan histori psikologismu untuk memberikan _insights_ objektif secara *real-time*.
                        </p>
                        <button
                            onClick={generateAIInsights}
                            disabled={closedTrades.length === 0}
                            className="btn-dark px-8 py-3 rounded-full"
                        >
                            Mulai Auto-Analisis
                        </button>
                        {closedTrades.length === 0 && <span className="text-[11px] text-red mt-3">Belum ada riwayat profit/loss terekam.</span>}
                    </div>
                )}

                {isGeneratingAI && (
                    <div className="flex flex-col items-center justify-center py-20 flex-1 gap-6">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[13px] font-bold text-text tracking-wide animate-pulse">Mengevaluasi Emosi & Performa...</span>
                            <span className="text-[11px] text-text3 font-medium">Ini hanya membutuhkan beberapa detik</span>
                        </div>
                    </div>
                )}

                {aiInsights && !isGeneratingAI && (
                    <div className="w-full bg-surface2 border border-border rounded-xl p-6 text-[13.5px] text-text2 leading-relaxed prose prose-sm prose-p:my-2 prose-ul:my-2 prose-li:my-1 max-w-none animate-in slide-in-from-bottom-2 fade-in">
                        <ReactMarkdown>{aiInsights}</ReactMarkdown>
                    </div>
                )}
            </div>

            {aiInsights && !isGeneratingAI && (
                <div className="p-4 mt-auto border-t border-border bg-surface flex justify-end shrink-0">
                    <button onClick={generateAIInsights} className="btn-outline px-4 py-2 flex items-center gap-2 rounded-full cursor-pointer transition-colors text-xs font-bold">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                        Refresh
                    </button>
                </div>
            )}
        </div>
    );
}
