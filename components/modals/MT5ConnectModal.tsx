"use client";
import { useState, useEffect } from "react";
import { useMT5Store } from "@/store";
import { normalizeTrade } from "@/hooks/useMT5Sync";
import { apiPost } from "@/lib/api";
import { Trash2, Plus, ExternalLink, ShieldCheck, RefreshCw, X } from "lucide-react";

export default function MT5ConnectModal({ onClose }: { onClose: () => void }) {
  const { 
    setTrades, setLiveTrades, setAccount, setConnected, 
    setConnectionParams, setLastSync, isConnected, account, 
    lastSync, disconnectMT5, accounts, fetchAccounts, toggleAccount, 
    deleteAccount, isLoading 
  } = useMT5Store();

  const [view, setView] = useState<"list" | "form" | "connecting">("list");
  const [form, setForm] = useState({ login: "", password: "", server: "", port: "443" });
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // If connected but no accounts list yet, or user just opened modal
  useEffect(() => {
    if (accounts.length === 0 && !isLoading && view === "list") {
      // Keep in list view, it will show "No accounts"
    }
  }, [accounts, isLoading, view]);

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleConnect = async () => {
    if (!form.login || !form.password || !form.server) { setErrMsg("Isi semua field yang wajib."); return; }
    setErrMsg(""); setView("connecting"); setProgress(0);

    const prog = setInterval(() => setProgress(p => Math.min(p + Math.random() * 12, 90)), 300);

    try {
      const data = await apiPost<any>("/api/mt5/connect", {
        login: parseInt(form.login),
        password: form.password,
        server: form.server,
        port: parseInt(form.port)
      });

      clearInterval(prog); setProgress(100);
      const normalizedTrades = ((data.trades || []) as Record<string, unknown>[]).map(normalizeTrade);
      const normalizedLive = ((data.live_trades || []) as Record<string, unknown>[]).map(normalizeTrade);

      setTrades(normalizedTrades);
      setLiveTrades(normalizedLive);
      if (data.account) setAccount(data.account);
      setConnected(true);
      setConnectionParams({ login: parseInt(form.login), server: form.server });
      setLastSync(new Date().toISOString());
      
      await fetchAccounts();
      setTimeout(() => setView("list"), 400);
    } catch (err: unknown) {
      clearInterval(prog);
      setErrMsg(err instanceof Error ? err.message : String(err));
      setView("form");
    }
  };

  const handleToggle = async (accId: number) => {
    await toggleAccount(accId);
  };

  const handleDelete = async (e: React.MouseEvent, accId: number) => {
    e.stopPropagation();
    await deleteAccount(accId);
  };

  const inp = "bg-surface2 border border-border rounded-xl py-3 px-4 text-text text-[13px] w-full outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all placeholder:text-text3/30";
  const lbl = "text-[10px] font-black text-text3 uppercase tracking-widest block mb-2 px-1";

  return (
    <div className="flex flex-col h-full bg-surface" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-surface2/30 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-[16px] font-black text-text tracking-tight uppercase">MT5 Account Manager</h3>
          <p className="text-[10px] text-text3 font-bold uppercase tracking-widest mt-0.5">Multi-Account Persistence</p>
        </div>
        {view !== "list" && (
          <button onClick={() => setView("list")} className="p-2 hover:bg-surface3 rounded-xl transition-all text-text3 hover:text-text">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        {view === "list" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Active Account Banner */}
            {isConnected && account ? (
              <div className="p-5 rounded-2xl bg-accent/5 border border-accent/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldCheck size={80} strokeWidth={1} />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-green animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-accent">Active Session</span>
                </div>
                <div className="flex justify-between items-end relative z-10">
                  <div>
                    <div className="text-[20px] font-black text-text tracking-tight">#{account.login}</div>
                    <div className="text-[11px] font-bold text-text3 opacity-60 uppercase tracking-tighter">{account.server}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-black text-text tabular-nums tracking-tighter">${account.balance?.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-green uppercase tracking-widest">Equity: ${account.equity?.toLocaleString()}</div>
                  </div>
                </div>
                <button 
                  onClick={disconnectMT5}
                  className="w-full mt-5 py-2.5 rounded-xl border border-red/20 text-red text-[11px] font-black uppercase tracking-widest hover:bg-red/5 transition-all"
                >
                  Disconnect Session
                </button>
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-border bg-surface2/20 text-center">
                <div className="w-12 h-12 rounded-full bg-surface3 flex items-center justify-center mx-auto mb-3 text-text3">
                  <RefreshCw size={20} className="opacity-40" />
                </div>
                <div className="text-[13px] font-bold text-text mb-1">No Active Connection</div>
                <p className="text-[11px] text-text3 px-4 leading-relaxed">Connect to an existing account or add a new one to start syncing trades.</p>
              </div>
            )}

            {/* Account List */}
            <div className="space-y-3 pt-4">
              <div className="flex justify-between items-center px-1">
                <h4 className="text-[10px] font-black text-text3 uppercase tracking-widest">Saved Accounts ({accounts.length})</h4>
                <button 
                  onClick={() => setView("form")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
                >
                  <Plus size={12} strokeWidth={3} /> Add New
                </button>
              </div>

              {accounts.map((acc) => (
                <div 
                  key={acc.id}
                  onClick={() => !acc.isActive && handleToggle(acc.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${
                    acc.isActive 
                      ? "bg-surface3 border-accent/50 shadow-inner" 
                      : "bg-surface2/30 border-border/50 hover:bg-surface2 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      acc.isActive ? "bg-accent/10 text-accent" : "bg-surface text-text3 opacity-40"
                    }`}>
                      <ExternalLink size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-black text-text">#{acc.login}</span>
                        {acc.isActive && <span className="bg-green/10 text-green text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest">Active</span>}
                      </div>
                      <div className="text-[10px] font-bold text-text3 opacity-50 uppercase tracking-tighter truncate max-w-[150px]">{acc.server}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDelete(e, acc.id)}
                      className="p-2.5 rounded-lg text-text3 hover:text-red hover:bg-red/5 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                    {!acc.isActive && (
                      <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-accent group-hover:bg-accent/5 transition-all">
                        <RefreshCw size={14} className="opacity-40 group-hover:opacity-100" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "form" && (
          <div className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
             <div className="p-4 rounded-xl bg-blue/5 border border-blue/20 flex gap-4 items-start">
               <div className="p-2 bg-blue/10 rounded-lg text-blue"><ShieldCheck size={20} /></div>
               <p className="text-[11px] text-text3 leading-relaxed font-medium">Use your <span className="text-text font-black uppercase">Investor Password</span> for secure, read-only access. Your trades will be permanently saved to your private database.</p>
            </div>

            {errMsg && <div className="bg-red/5 border border-red/20 rounded-xl p-4 text-[12px] text-red font-bold animate-in shake-1 underline-offset-4">{errMsg}</div>}

            <div className="space-y-4">
              <div>
                <label className={lbl}>MT5 Login ID</label>
                <input className={inp} value={form.login} onChange={e => set("login", e.target.value)} placeholder="e.g. 8831022" />
              </div>
              <div>
                <label className={lbl}>Investor Password</label>
                <input type="password" className={inp} value={form.password} onChange={e => set("password", e.target.value)} placeholder="••••••••" />
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-3">
                  <label className={lbl}>Broker Server</label>
                  <input className={inp} value={form.server} onChange={e => set("server", e.target.value)} placeholder="ICMarkets-Demo" />
                </div>
                <div className="col-span-2">
                  <label className={lbl}>Port</label>
                  <input className={inp} value={form.port} onChange={e => set("port", e.target.value)} placeholder="443" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setView("list")} 
                className="flex-1 py-4 rounded-2xl border border-border text-text3 font-black text-[12px] uppercase tracking-widest hover:bg-surface2 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleConnect} 
                className="flex-[2] py-4 rounded-2xl bg-accent text-white font-black text-[12px] uppercase tracking-widest shadow-xl shadow-accent/20 hover:opacity-90 active:scale-95 transition-all"
              >
                Connect & Setup
              </button>
            </div>
          </div>
        )}

        {view === "connecting" && (
          <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-500">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 rounded-full border-[3px] border-accent/10 border-t-accent animate-spin" />
              <div className="absolute inset-4 rounded-full border-[3px] border-blue/10 border-b-blue animate-spin-slow" />
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw size={24} className="text-accent animate-pulse" />
              </div>
            </div>
            <div className="text-[18px] font-black text-text tracking-tight uppercase mb-2">Syncing Data</div>
            <div className="text-[11px] font-bold text-text3 uppercase tracking-[0.2em] mb-8">Establishing Bridge</div>
            
            <div className="w-full max-w-[240px] h-1.5 bg-surface2 rounded-full overflow-hidden border border-border">
              <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-4 text-[14px] font-black text-text tabular-nums">{Math.round(progress)}%</div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-6 py-4 bg-surface2/30 border-t border-border flex items-center justify-center gap-2 opacity-40 shrink-0">
        <RefreshCw size={10} className="animate-spin-slow" />
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Secure Multi-User Bridge v2.0</span>
      </div>
    </div>
  );
}
