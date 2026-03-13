"use client";
import { useMT5Store } from "@/store";
import { fmtUSD } from "@/lib/utils";

export default function LiveTerminalTrades({ hideHeader = false }: { hideHeader?: boolean }) {
    const { liveTrades } = useMT5Store();

    return (
        <div className={`flex flex-col overflow-hidden h-full ${hideHeader ? "bg-transparent" : "bg-surface border border-border rounded-xl shadow-sm"}`}>
            {!hideHeader && (
                <div className="px-4 py-2.5 border-b border-border bg-surface2 flex justify-between items-center shrink-0">
                    <div className="font-bold text-[12px] text-text uppercase tracking-wider flex items-center gap-2">
                        Live Positions & Orders
                        <span className="bg-green/10 text-green text-[10px] px-1.5 py-0.5 rounded-full">
                            {liveTrades.filter(t => t.status === 'live').length} Active
                        </span>
                        {liveTrades.some(t => t.status === 'pending') && (
                            <span className="bg-amber-500/10 text-amber-500 text-[10px] px-1.5 py-0.5 rounded-full">
                                {liveTrades.filter(t => t.status === 'pending').length} Pending
                            </span>
                        )}
                    </div>
                </div>
            )}
            <div className="flex-1 overflow-auto no-scrollbar min-h-0">
                <table className="w-full text-left text-[11px] border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 bg-surface border-b border-border z-10">
                        <tr className="text-text3 uppercase text-[9px] font-extrabold tracking-widest bg-surface2/50">
                            <th className="py-2.5 px-4">Ticket</th>
                            <th className="py-2.5 px-3">Symbol</th>
                            <th className="py-2.5 px-2 text-center">Type</th>
                            <th className="py-2.5 px-2 text-center">Lots</th>
                            <th className="py-2.5 px-2 text-center">Entry/Target</th>
                            <th className="py-2.5 px-2 text-center">Market</th>
                            <th className="py-2.5 px-2 text-center">Pips</th>
                            <th className="py-2.5 px-3 text-right">PnL</th>
                            <th className="py-2.5 px-2 text-center">SL</th>
                            <th className="py-2.5 px-2 text-center">TP</th>
                            <th className="py-2.5 px-2 text-center">Duration</th>
                            <th className="py-2.5 px-4 text-right">Time (WIB)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {liveTrades.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="py-20 text-center">
                                    <div className="flex flex-col items-center justify-center text-text3 text-[11px] font-medium gap-2 opacity-50">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
                                        No active positions or orders
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            [...liveTrades]
                                .sort((a, b) => (b.ticket || 0) - (a.ticket || 0))
                                .map((t) => {
                                    const isPending = t.status === 'pending';
                                    const isBuy = t.type.toUpperCase().includes("BUY");
                                    return (
                                        <tr key={t.id} className={`border-b border-border/40 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-all ${isPending ? 'opacity-80' : ''}`}>
                                            <td className="py-2.5 px-4 text-text3 font-medium tabular-nums opacity-70">#{t.ticket}</td>
                                            <td className="py-2.5 px-3 font-bold text-text tabular-nums">{t.symbol}</td>
                                            <td className="py-2.5 px-2 text-center">
                                                <span className={`px-1.5 py-0.5 rounded-[3px] font-black uppercase text-[9px] tracking-tighter shadow-sm 
                                                ${isBuy ? "bg-blue-bg text-blue" : "bg-red-bg text-red"} 
                                                ${isPending ? 'opacity-80' : ''}`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-2 text-center font-bold tabular-nums text-text2">{t.lots}</td>
                                            <td className="py-2.5 px-2 text-center tabular-nums opacity-80">{t.openPrice?.toFixed(5)}</td>
                                            <td className="py-2.5 px-2 text-center tabular-nums opacity-80">{(t.closePrice || t.currentPrice)?.toFixed(5)}</td>
                                            <td className={`py-2.5 px-2 text-center font-bold tabular-nums ${isPending ? 'text-text3' : (t.pips ?? 0) >= 0 ? "text-green" : "text-red"}`}>
                                                {isPending ? "0.0" : (<>{(t.pips ?? 0) >= 0 ? "+" : ""}{(t.pips ?? 0).toFixed(1)}</>)}
                                            </td>
                                            <td className={`py-2.5 px-3 text-right font-black tabular-nums text-[13px] ${isPending ? 'text-text3' : t.pnl >= 0 ? "text-green" : "text-red"}`}>
                                                {isPending ? fmtUSD(0) : fmtUSD(t.pnl)}
                                            </td>
                                            <td className="py-2.5 px-2 text-center tabular-nums text-red font-medium opacity-80">{t.sl || "--"}</td>
                                            <td className="py-2.5 px-2 text-center tabular-nums text-green font-medium opacity-80">{t.tp || "--"}</td>
                                            <td className="py-2.5 px-2 text-center text-text3 tabular-nums opacity-70">
                                                {isPending ? "Wait" : t.durationMs ? (() => {
                                                    const m = Math.floor(t.durationMs / 60000);
                                                    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
                                                })() : "-"}
                                            </td>
                                            <td className="py-2.5 px-4 text-right text-text3 tabular-nums opacity-70 whitespace-nowrap">{t.openTimeWIB?.slice(0, 16)}</td>
                                        </tr>
                                    );
                                })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
