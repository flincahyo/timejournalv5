"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMT5Store, useJournalStore } from "@/store";
import { Trade } from "@/types";
import { toWIB, calcPips } from "@/lib/utils";
import { PAIRS_LIST, SESSIONS_LIST, SETUPS_LIST, EMOTIONS_LIST } from "@/lib/constants";

export default function EditTradeModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
    const { updateTrade, trades } = useMT5Store();
    const { tags: availableTags } = useJournalStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const isManual = String(trade.id).startsWith("manual_") || String(trade.ticket).startsWith("manual_");

    const [form, setForm] = useState({
        symbol: trade.symbol, type: trade.type, lots: String(trade.lots),
        openPrice: String(trade.openPrice), closePrice: String(trade.closePrice),
        sl: String(trade.sl), tp: String(trade.tp), pnl: String(trade.pnl),
        openTime: trade.openTime.slice(0, 16),
        closeTime: trade.closeTime.slice(0, 16),
        session: trade.session,
        setup: trade.setup === "MT5 Import" ? "" : (trade.setup || ""),
        emotion: trade.emotion || "",
        note: trade.note || "",
        tags: trade.tags || [],
    });
    const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

    const toggleTag = (tag: string) => {
        setForm(p => ({
            ...p,
            tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag]
        }));
    };

    const inp = "bg-surface2 border border-border rounded-lg py-2.5 px-3 text-text text-xs w-full outline-none focus:border-accent focus:ring-2 focus:ring-accent-r transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
    const lbl = "text-[10px] text-text3 uppercase tracking-[.05em] block mb-1 font-bold";
    const sel = `${inp} cursor-pointer`;

    const handleSave = () => {
        if (isManual) {
            const openPrice = parseFloat(form.openPrice) || 0;
            const closePrice = parseFloat(form.closePrice) || 0;
            const type = form.type as "BUY" | "SELL";
            const pips = calcPips(form.symbol, openPrice, closePrice, type);
            const openT = new Date(form.openTime).toISOString();
            const closeT = new Date(form.closeTime).toISOString();
            const dur = new Date(closeT).getTime() - new Date(openT).getTime();

            updateTrade(trade.id, {
                symbol: form.symbol, type, lots: parseFloat(form.lots) || 0,
                openTime: openT, openTimeWIB: toWIB(openT),
                closeTime: closeT, closeTimeWIB: toWIB(closeT),
                openPrice, closePrice,
                sl: parseFloat(form.sl) || 0, tp: parseFloat(form.tp) || 0,
                pnl: parseFloat(form.pnl) || 0, pips, avgPipsPerTrade: pips,
                session: form.session, setup: form.setup, emotion: form.emotion,
                note: form.note, tags: form.tags,
                durationMs: dur, isIntraday: dur < 86400000,
            });
        } else {
            updateTrade(trade.id, { setup: form.setup, emotion: form.emotion, note: form.note, tags: form.tags });
        }
        onClose();
    };

    const field = (label: string, key: string, type: string = "text", opts?: string[], allowCustom = false) => {
        const disabled = !isManual && key !== "setup" && key !== "emotion";
        return (
            <div key={key}>
                <label className={lbl}>{label}</label>
                {opts && !allowCustom ? (
                    <select value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)} className={sel} disabled={disabled}>
                        <option value="">-- Pilihan --</option>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : opts && allowCustom ? (
                    <>
                        <input
                            type={type}
                            list={`${key}-list`}
                            value={form[key as keyof typeof form]}
                            onChange={e => set(key, e.target.value)}
                            className={inp}
                            disabled={disabled}
                            placeholder={`Ketik atau pilih ${label.toLowerCase()}...`}
                        />
                        <datalist id={`${key}-list`}>
                            {opts.map(o => <option key={o} value={o} />)}
                        </datalist>
                    </>
                ) : (
                    <input type={type} value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)} className={inp} disabled={disabled} />
                )}
            </div>
        );
    };

    if (!mounted) return null;

    const dynamicSetups = Array.from(new Set([...SETUPS_LIST, ...trades.map(t => t.setup).filter(Boolean)])).filter(s => s !== "MT5 Import");

    return createPortal(
        <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center backdrop-blur-md transition-all duration-300" onClick={onClose}>
            <div className="fade-in bg-surface rounded-2xl p-8 w-[560px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-8">
                    <div className="text-base font-bold text-text">Edit Trade {trade.ticket !== 0 ? `#${trade.ticket}` : "(Manual)"}</div>
                    <button onClick={onClose} className="text-text3 text-[22px] hover:text-text transition-colors">×</button>
                </div>

                {!isManual && (
                    <div className="mb-4 p-3 bg-surface3 border border-border rounded-lg text-xs leading-relaxed text-text2">
                        This trade was imported from MT5. Only the <b>Setup</b> and <b>Emotion</b> fields can be edited locally.
                    </div>
                )}

                <div className="flex flex-col gap-3.5">
                    <div className="grid grid-cols-2 gap-3">
                        {field("Symbol", "symbol", "text", PAIRS_LIST)}
                        {field("Arah", "type", "text", ["BUY", "SELL"])}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {field("Lots", "lots", "number")}
                        {field("Open (WIB)", "openTime", "datetime-local")}
                        {field("Close (WIB)", "closeTime", "datetime-local")}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                        {field("Entry Price", "openPrice", "number")}
                        {field("Exit Price", "closePrice", "number")}
                        {field("SL (price)", "sl", "number")}
                        {field("TP (price)", "tp", "number")}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {field("PnL ($)", "pnl", "number")}
                        {field("Session", "session", "text", SESSIONS_LIST, true)}
                        {field("Setup", "setup", "text", dynamicSetups, true)}
                    </div>
                    <div className="mb-3">{field("Emotion", "emotion", "text", EMOTIONS_LIST, true)}</div>
                    <div className="mb-3">
                        <label className={lbl}>Tags</label>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map(t => {
                                const active = form.tags.includes(t);
                                return (
                                    <button
                                        key={t}
                                        onClick={() => toggleTag(t)}
                                        className={`px-3 py-1.5 rounded-full text-[10.5px] font-bold border transition-colors ${active ? "bg-accent/10 border-accent/40 text-accent shadow-sm" : "bg-surface border-border text-text3 hover:text-text hover:bg-surface2"}`}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className={lbl}>Note</label>
                        <textarea
                            value={form.note}
                            onChange={(e) => set("note", e.target.value)}
                            className={`${inp} min-h-[80px] resize-y placeholder:text-text3/60`}
                            placeholder="Catatan evaluasi untuk trade ini..."
                        />
                    </div>
                </div>
                <div className="flex gap-2.5 mt-5 justify-end">
                    <button onClick={onClose} className="btn-outline">Cancel</button>
                    <button onClick={handleSave} className="btn-dark">Simpan Perubahan</button>
                </div>
            </div>
        </div>,
        document.body
    );
}
