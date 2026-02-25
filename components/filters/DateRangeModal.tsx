"use client";
import { useState } from "react";
import { useFilterStore } from "@/store";

const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 Hari", days: 7 },
  { label: "30 Hari", days: 30 },
  { label: "3 Bulan", days: 90 },
  { label: "6 Bulan", days: 180 },
  { label: "1 Tahun", days: 365 },
];

export default function DateRangeModal({ onClose }: { onClose: () => void }) {
  const { filter, setFilter } = useFilterStore();
  const [from, setFrom] = useState(filter.dateFrom || "");
  const [to, setTo] = useState(filter.dateTo || "");

  const applyPreset = (days: number) => {
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - days);
    setFrom(from.toISOString().slice(0, 10));
    setTo(now.toISOString().slice(0, 10));
  };

  const apply = () => {
    setFilter({ dateFrom: from || null, dateTo: to || null });
    onClose();
  };

  const clear = () => {
    setFilter({ dateFrom: null, dateTo: null });
    setFrom(""); setTo("");
    onClose();
  };

  const inp = "bg-surface2 border border-border rounded-lg py-2.5 px-3 text-text text-[13px] w-full outline-none focus:border-accent focus:ring-2 focus:ring-accent-r transition-all duration-200";
  const lbl = "text-[11px] font-semibold text-text3 uppercase tracking-[.05em] block mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 z-[2000] flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="fade-in bg-surface border border-border rounded-[20px] p-7 w-[380px] shadow-s4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-7">
          <div className="text-base font-bold text-text">Date Range</div>
          <button onClick={onClose} className="text-text3 text-[22px] leading-none hover:text-text transition-colors">×</button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-1.5 mb-5">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p.days)} className="p-2 rounded-lg text-xs font-medium bg-surface2 border border-border text-text2 hover:border-accent hover:text-accent2 transition-all duration-150">
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className={lbl}>Dari</label>
            <input type="date" className={inp} value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Sampai</label>
            <input type="date" className={inp} value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={clear} className="flex-1 p-2.5 bg-surface2 border border-border rounded-lg text-text3 text-[13px] font-medium hover:border-border2 transition-colors">Reset</button>
          <button onClick={apply} className="flex-[2] justify-center p-2.5 btn-dark">Terapkan</button>
        </div>
      </div>
    </div>
  );
}
