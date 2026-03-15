"use client";
import { useState } from "react";
import { useFilterStore } from "@/store";
import { Trade } from "@/types";
import { SESSIONS_LIST, SETUPS_LIST } from "@/lib/constants";

const CLOSE_TYPES = ["All", "Target Hit", "Stopped Out", "Manually Closed"];

export default function FilterModal({ onClose, trades }: { onClose: () => void; trades: Trade[] }) {
  const { filter, setFilter, resetFilter } = useFilterStore();
  const [tab, setTab] = useState<"general" | "time" | "journal">("general");
  const [local, setLocal] = useState({ ...filter });
  const [symInput, setSymInput] = useState("");

  const allSymbols = [...new Set(trades.map(t => t.symbol))].sort();
  const set = (k: string, v: unknown) => setLocal(p => ({ ...p, [k]: v }));

  const addSymbol = (s: string) => {
    const clean = s.toUpperCase().trim();
    if (clean && !local.symbols.includes(clean)) set("symbols", [...local.symbols, clean]);
    setSymInput("");
  };

  const apply = () => { setFilter(local); onClose(); };
  const reset = () => { resetFilter(); setLocal({ ...filter }); onClose(); };

  const tabBtn = (id: "general" | "time" | "journal", label: string) => (
    <button onClick={() => setTab(id)} className={`py-2 px-4 text-[13px] border-b-2 transition-all duration-150 ${tab === id ? 'font-semibold text-accent2 border-accent' : 'font-normal text-text3 border-transparent'}`}>
      {label}
    </button>
  );

  const lbl = "text-[11px] font-semibold text-text3 uppercase tracking-[.05em] block mb-2";
  const inp = "bg-surface2 border border-border rounded-lg py-2.5 px-3 text-text text-[13px] w-full outline-none focus:border-accent focus:ring-2 focus:ring-accent-r transition-all duration-200";

  return (
    <div className="flex flex-col h-full bg-bg" onClick={e => e.stopPropagation()}>
      {/* Tabs */}
      <div className="flex border-b border-border bg-surface2/10">
        {tabBtn("general", "General")}
        {tabBtn("time", "Time")}
        {tabBtn("journal", "Journal")}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-5 px-6">
        {tab === "general" && (
          <div className="fade-in flex flex-col gap-4.5">
            {/* Symbol */}
            <div>
              <label className={lbl}>Symbol <span className="text-text3 font-normal normal-case tracking-normal text-[10px]">(tekan Enter atau koma setelah ketik)</span></label>
              <input className={inp} value={symInput}
                onChange={e => setSymInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSymbol(symInput); } }}
                placeholder="Symbol"
              />
              {local.symbols.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {local.symbols.map(s => (
                    <span key={s} className="flex items-center gap-1 bg-accent3 border border-accent-border text-accent2 text-[11px] font-semibold py-0.5 px-2 rounded-md">
                      {s}
                      <button onClick={() => set("symbols", local.symbols.filter(x => x !== s))} className="text-accent2 leading-none text-[13px] hover:opacity-70">×</button>
                    </span>
                  ))}
                </div>
              )}
              {/* Quick select from actual symbols */}
              {allSymbols.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {allSymbols.slice(0, 12).map(s => (
                    <button key={s} onClick={() => { if (!local.symbols.includes(s)) set("symbols", [...local.symbols, s]); }} className={`py-0.5 px-1.5 text-[10px] font-semibold rounded ${local.symbols.includes(s) ? 'bg-accent3 border border-accent-border text-accent2' : 'bg-surface2 border border-border text-text3 hover:border-border2'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Side */}
            <div>
              <label className={lbl}>Side</label>
              <div className="grid grid-cols-2 gap-2">
                {(["all", "buy", "sell"] as const).map(s => (
                  <button key={s} onClick={() => set("side", s)} className={`p-2.5 rounded-lg text-xs font-semibold capitalize border transition-colors ${local.side === s ? 'bg-accent3 border-accent-border text-accent2' : 'bg-surface2 border-border text-text3 hover:border-border2'}`}>
                    {s === "all" ? "All" : s === "buy" ? "Buy (Long)" : "Sell (Short)"}
                  </button>
                ))}
              </div>
            </div>

            {/* Close Type */}
            <div>
              <label className={lbl}>Close Type</label>
              <div className="bg-surface2 border border-border rounded-lg overflow-hidden">
                {(["all", "target_hit", "stopped_out", "manually_closed"] as const).map((ct, i) => (
                  <div key={ct} onClick={() => set("closeType", ct)} className={`flex items-center gap-2.5 py-3 px-3.5 cursor-pointer border-border transition-colors hover:bg-surface3 ${i < 3 ? 'border-b' : ''} ${local.closeType === ct ? 'bg-accent3 hover:bg-accent3' : ''}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${local.closeType === ct ? 'border-accent' : 'border-border'}`}>
                      {local.closeType === ct && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </div>
                    <span className={`text-[13px] font-medium ${local.closeType === ct ? 'text-text' : 'text-text2'}`}>
                      {ct === "all" ? "All" : ct === "target_hit" ? "Target Hit" : ct === "stopped_out" ? "Stopped Out" : "Manually Closed"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* PnL Range */}
            <div>
              <label className={lbl}>PnL Range ($)</label>
              <div className="grid grid-cols-2 gap-2">
                <input className={inp} type="number" placeholder="Min PnL" value={local.minPnl ?? ""} onChange={e => set("minPnl", e.target.value ? parseFloat(e.target.value) : null)} />
                <input className={inp} type="number" placeholder="Max PnL" value={local.maxPnl ?? ""} onChange={e => set("maxPnl", e.target.value ? parseFloat(e.target.value) : null)} />
              </div>
            </div>
          </div>
        )}

        {tab === "time" && (
          <div className="fade-in flex flex-col gap-4.5">
            <div>
              <label className={lbl}>Quick Presets</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: "Hari Ini", days: 0 },
                  { label: "7 Hari Terakhir", days: 7 },
                  { label: "30 Hari Terakhir", days: 30 },
                  { label: "1 Tahun Terakhir", days: 365 },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => {
                      const now = new Date();
                      const from = new Date();
                      from.setDate(now.getDate() - p.days);
                      set("dateFrom", from.toISOString().split('T')[0]);
                      set("dateTo", now.toISOString().split('T')[0]);
                    }}
                    className="py-2 px-3 rounded-lg bg-surface2 border border-border text-[11px] font-bold text-text2 hover:border-accent hover:text-accent transition-all uppercase tracking-tight"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label className={lbl}>Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-text3 mb-1 font-medium">From</div>
                  <input className={inp} type="date" value={local.dateFrom || ""} onChange={e => set("dateFrom", e.target.value || null)} />
                </div>
                <div>
                  <div className="text-[11px] text-text3 mb-1 font-medium">To</div>
                  <input className={inp} type="date" value={local.dateTo || ""} onChange={e => set("dateTo", e.target.value || null)} />
                </div>
              </div>
            </div>
            <div>
              <label className={lbl}>Time of Day (WIB)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[11px] text-text3 mb-1 font-medium">From</div>
                  <input className={inp} type="time" value={local.timeFrom || ""} onChange={e => set("timeFrom", e.target.value || null)} />
                </div>
                <div>
                  <div className="text-[11px] text-text3 mb-1 font-medium">To</div>
                  <input className={inp} type="time" value={local.timeTo || ""} onChange={e => set("timeTo", e.target.value || null)} />
                </div>
              </div>
            </div>
            <div>
              <label className={lbl}>Session</label>
              <div className="flex flex-wrap gap-1.5">
                {SESSIONS_LIST.map(s => (
                  <button key={s} onClick={() => set("sessions", local.sessions.includes(s) ? local.sessions.filter(x => x !== s) : [...local.sessions, s])} className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${local.sessions.includes(s) ? 'bg-accent3 border-accent-border text-accent2' : 'bg-surface2 border-border text-text3 hover:border-border2'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "journal" && (
          <div className="fade-in flex flex-col gap-4.5">
            <div>
              <label className={lbl}>Setup</label>
              <div className="flex flex-wrap gap-1.5">
                {SETUPS_LIST.map(s => (
                  <button key={s} onClick={() => set("setups", local.setups.includes(s) ? local.setups.filter(x => x !== s) : [...local.setups, s])} className={`py-1.5 px-3 rounded-md text-xs font-medium border transition-colors ${local.setups.includes(s) ? 'bg-accent3 border-accent-border text-accent2' : 'bg-surface2 border-border text-text3 hover:border-border2'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Min R:R</label>
              <input className={inp} type="number" step="0.1" placeholder="e.g. 1.5" value={local.minRR ?? ""} onChange={e => set("minRR", e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-4 mt-auto border-t border-border flex gap-2.5 bg-surface">
        <button onClick={reset} className="flex-1 btn-outline">Reset</button>
        <button onClick={apply} className="flex-[2] btn-dark">Terapkan Filter</button>
      </div>
    </div>
  );
}
