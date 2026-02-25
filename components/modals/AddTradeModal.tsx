"use client";
import { useState } from "react";
import { useMT5Store } from "@/store";
import { Trade } from "@/types";
import { toWIB, calcPips } from "@/lib/utils";
import { PAIRS_LIST, SESSIONS_LIST, SETUPS_LIST, EMOTIONS_LIST } from "@/lib/constants";

export default function AddTradeModal({ onClose }: { onClose: () => void }) {
  const { trades, setTrades } = useMT5Store();
  const [form, setForm] = useState({
    symbol: "EURUSD", type: "BUY", lots: "0.10",
    openPrice: "", closePrice: "", sl: "", tp: "", pnl: "",
    openTime: new Date().toISOString().slice(0, 16),
    closeTime: new Date().toISOString().slice(0, 16),
    session: "London", setup: "Breakout", emotion: "Neutral", note: "",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const inp = "bg-surface2 border border-border rounded-lg py-2.5 px-3 text-text text-xs w-full outline-none focus:border-accent focus:ring-2 focus:ring-accent-r transition-all duration-200";
  const lbl = "text-[10px] text-text3 uppercase tracking-[.05em] block mb-1 font-bold";
  const sel = `${inp} cursor-pointer`;

  const handleSave = () => {
    const openPrice = parseFloat(form.openPrice) || 0;
    const closePrice = parseFloat(form.closePrice) || 0;
    const type = form.type as "BUY" | "SELL";
    const pips = calcPips(form.symbol, openPrice, closePrice, type);
    const openT = new Date(form.openTime).toISOString();
    const closeT = new Date(form.closeTime).toISOString();
    const dur = new Date(closeT).getTime() - new Date(openT).getTime();

    const t: Trade = {
      id: `manual_${Date.now()}`, ticket: Date.now(),
      symbol: form.symbol, type, lots: parseFloat(form.lots) || 0.1,
      openTime: openT, openTimeWIB: toWIB(openT),
      closeTime: closeT, closeTimeWIB: toWIB(closeT),
      openPrice, closePrice,
      sl: parseFloat(form.sl) || 0, tp: parseFloat(form.tp) || 0,
      pnl: parseFloat(form.pnl) || 0, pips, avgPipsPerTrade: pips,
      swap: 0, commission: 0, rr: 0,
      session: form.session, setup: form.setup, emotion: form.emotion,
      status: "closed", closeType: "manually_closed",
      durationMs: dur, isIntraday: dur < 86400000,
    };
    setTrades([t, ...trades]);
    onClose();
  };

  const field = (label: string, key: string, type: string = "text", opts?: string[]) => (
    <div key={key}>
      <label className={lbl}>{label}</label>
      {opts ? (
        <select value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)} className={sel}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key as keyof typeof form]} onChange={e => set(key, e.target.value)} className={inp} />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-[2000] flex items-center justify-center backdrop-blur-md transition-all duration-300" onClick={onClose}>
      <div className="fade-in bg-surface rounded-2xl p-8 w-[560px] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <div className="text-base font-bold text-text">Tambah Trade Manual</div>
          <button onClick={onClose} className="text-text3 text-[22px] hover:text-text transition-colors">×</button>
        </div>
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
            {field("Session", "session", "text", SESSIONS_LIST)}
            {field("Setup", "setup", "text", SETUPS_LIST)}
          </div>
          <div className="mb-3">{field("Emotion", "emotion", "text", EMOTIONS_LIST)}</div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={form.note} onChange={e => set("note", e.target.value)} className={`${inp} h-16 resize-y`} />
          </div>
        </div>
        <div className="flex gap-2.5 mt-5 justify-end">
          <button onClick={onClose} className="btn-outline">Cancel</button>
          <button onClick={handleSave} className="btn-dark">Simpan Trade</button>
        </div>
      </div>
    </div>
  );
}
