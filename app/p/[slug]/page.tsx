"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { fmtUSD, fmtPips, formatDuration } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { User, Calendar, Layout, TrendingUp, BarChart3, Clock, HelpCircle, AlertCircle, Globe, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function PublicSharePage() {
  const { slug } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPublicData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || ""}/api/public/share/${slug}`);
        if (!res.ok) throw new Error("Share link not found or expired");
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPublicData();
  }, [slug]);

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="w-10 h-10 rounded-full border-[3px] border-accent/10 border-t-accent animate-spin mb-4" />
      <p className="text-[13px] text-text3 font-black uppercase tracking-widest">Loading shared portfolio...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red/5 flex items-center justify-center text-red mb-4">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-[20px] font-black text-text mb-2">Portfolio Not Found</h2>
      <p className="text-[13px] text-text3">{error}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-32 animate-in fade-in duration-700">
      {/* Bio Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-12">
        <div className="w-24 h-24 rounded-3xl bg-surface2 relative overflow-hidden flex items-center justify-center text-accent/40 shadow-xl">
           {data.owner_image ? (
             <img src={data.owner_image} className="w-full h-full object-cover" alt={data.owner} />
           ) : (
             <User size={48} />
           )}
        </div>
        <div className="text-center md:text-left pt-2">
          <h1 className="text-[32px] font-black text-text tracking-tight mb-1">{data.owner}'s Portfolio</h1>
          <div className="flex items-center justify-center md:justify-start gap-4">
            <span className="flex items-center gap-1.5 text-[11px] font-black text-text3 uppercase tracking-widest">
              <Globe size={14} className="text-accent" /> {data.type === 'dashboard' ? 'Public Overview' : 'Trading Calendar'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-border" />
            <span className="flex items-center gap-1.5 text-[11px] font-black text-text3 uppercase tracking-widest">
              Verified MT5 Sync
            </span>
          </div>
        </div>
      </div>

      {data.type === 'calendar' ? <PublicCalendar trades={data.trades} /> : <PublicDashboard data={data} slug={slug as string} />}
    </div>
  );
}

function PublicDashboard({ data, slug }: { data: any, slug: string }) {
  const equityCurve = useMemo(() => {
    if (!data?.trades) return [];
    let run = 0;
    return [...data.trades].reverse().map((t, i) => {
      run += t.pnl;
      return { d: t.openTime?.slice(5, 10) ?? `#${i}`, v: parseFloat(run.toFixed(2)) };
    });
  }, [data]);

  const stats = useMemo(() => {
    if (!data?.trades) return null;
    const trades = data.trades;
    const closed = trades.filter((t: any) => t.status === "closed");
    const wins = closed.filter((t: any) => t.pnl > 0);
    const totalPips = closed.reduce((a: number, b: any) => a + (b.pips || 0), 0);
    const totalPnl = closed.reduce((a: number, b: any) => a + (b.pnl || 0), 0);
    
    return {
      total: closed.length,
      winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
      totalPips,
      totalPnl,
    };
  }, [data]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Win Rate", value: `${stats?.winRate.toFixed(1)}%`, icon: TrendingUp, color: "text-blue" },
          { label: "Total PnL", value: fmtUSD(stats?.totalPnl), icon: BarChart3, color: (stats?.totalPnl || 0) >= 0 ? "text-green" : "text-red" },
          { label: "Total Pips", value: `${(stats?.totalPips || 0).toFixed(1)} Pips`, icon: Clock, color: "text-accent" },
          { label: "Trades", value: stats?.total, icon: Calendar, color: "text-text" },
        ].map((k, i) => (
          <div key={i} className="bg-surface border border-border p-5 rounded-2xl shadow-sm">
            <div className="text-[10px] font-black text-text3 uppercase tracking-widest mb-3 opacity-40">{k.label}</div>
            <div className={`text-[24px] font-black tracking-tighter ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[16px] font-black text-text tracking-tight uppercase">Equity Curve</h3>
              <div className="text-[11px] font-bold text-text3 opacity-40 uppercase tracking-widest">Cumulative Growth</div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityCurve} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="pubG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={.2} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} dx={-4} tickFormatter={v => `$${v}`} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-bg/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl">
                        <div className="text-[14px] font-black text-text">${payload[0].value}</div>
                      </div>
                    );
                  }} />
                  <Area type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={3} fill="url(#pubG)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
             <div className="p-6 border-b border-border bg-surface2/30">
                <h3 className="text-[16px] font-black text-text tracking-tight uppercase">Recent Activity</h3>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-surface2/50 text-[10px] font-black uppercase text-text3 tracking-widest">
                    <tr>
                      <th className="px-6 py-4">Symbol</th>
                      <th className="px-6 py-4 text-center">Type</th>
                      <th className="px-6 py-4 text-center">Pips</th>
                      <th className="px-6 py-4 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.trades.slice(0, 10).map((t: any) => (
                      <tr key={t.ticket || t.id} className="border-b border-border hover:bg-surface2/30 transition-all">
                        <td className="px-6 py-4">
                          <div className="font-black text-[14px]">{t.symbol}</div>
                          <div className="text-[10px] text-text3 font-medium">{t.openTime?.slice(0, 10)}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${t.type.includes('BUY') ? 'bg-blue/10 text-blue' : 'bg-red/10 text-red'}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-center font-mono text-[11px] font-bold ${t.pips >= 0 ? "text-green" : "text-red"}`}>
                          {t.pips >= 0 ? "+" : ""}{t.pips?.toFixed(1)}
                        </td>
                        <td className={`px-6 py-4 text-right font-black text-[14px] ${t.pnl >= 0 ? "text-green" : "text-red"}`}>
                          {fmtUSD(t.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-surface border border-border rounded-2xl p-6">
              <h4 className="text-[11px] font-black text-text3 uppercase tracking-widest mb-4">Sharing Metadata</h4>
              <div className="space-y-4">
                 <div>
                    <div className="text-[10px] text-text3 uppercase font-bold opacity-40 mb-1">Link Slug</div>
                    <div className="text-[13px] font-bold">/p/{slug}</div>
                 </div>
                 <div>
                    <div className="text-[10px] text-text3 uppercase font-bold opacity-40 mb-1">Sync Version</div>
                    <div className="text-[13px] font-bold">MT5 Bridge v2.0</div>
                 </div>
                 <div>
                    <div className="text-[10px] text-text3 uppercase font-bold opacity-40 mb-1">Data Freshness</div>
                    <div className="text-[13px] font-bold">Live Synced</div>
                 </div>
              </div>
           </div>
           
           <CTA />
        </div>
      </div>
    </>
  );
}

function PublicCalendar({ trades }: { trades: any[] }) {
  const [yr, setYr] = useState(new Date().getFullYear());
  const [mo, setMo] = useState(new Date().getMonth());
  const [sel, setSel] = useState<string | null>(null);

  const pnlByDate = useMemo(() => {
    const m: Record<string, { pnl: number; count: number; wins: number }> = {};
    trades.forEach(t => {
      const d = (t.openTimeWIB || t.openTime)?.slice(0, 10);
      if (!d) return;
      if (!m[d]) m[d] = { pnl: 0, count: 0, wins: 0 };
      m[d].pnl += t.pnl;
      m[d].count++;
      if (t.pnl > 0) m[d].wins++;
    });
    return m;
  }, [trades]);

  const days = new Date(yr, mo + 1, 0).getDate();
  const first = new Date(yr, mo, 1).getDay();
  const today = new Date().toISOString().slice(0, 10);
  const selTrades = sel ? trades.filter(t => (t.openTimeWIB || t.openTime)?.slice(0, 10) === sel) : [];

  const nav = (dir: number) => {
    const d = new Date(yr, mo + dir);
    setYr(d.getFullYear()); setMo(d.getMonth());
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[20px] font-black text-text tracking-tight uppercase">
            {MONTHS[mo]} {yr}
          </h3>
          <div className="flex gap-2">
            <button onClick={() => nav(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface2 border border-border hover:bg-surface3 transition-all">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => nav(1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface2 border border-border hover:bg-surface3 transition-all">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-[11px] text-text3 font-black uppercase tracking-widest py-2 opacity-40">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} className="min-h-[60px] md:min-h-[100px]" />)}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const stats = pnlByDate[ds];
            const isToday = ds === today;
            const isSel = sel === ds;
            return (
              <div 
                key={day} 
                onClick={() => setSel(isSel ? null : ds)} 
                className={`rounded-lg md:rounded-2xl p-1 md:p-4 min-h-[65px] md:min-h-[110px] flex flex-col cursor-pointer transition-all border ${
                  isSel ? 'border-accent bg-accent/5 ring-2 md:ring-4 ring-accent/10 shadow-lg shadow-accent/20 scale-[1.02]' : 
                  `bg-surface border-border hover:border-accent/40 ${isToday ? 'border-accent/30 bg-surface2/50' : ''}`
                }`}
              >
                <div className={`text-[10px] md:text-[12px] font-black mb-auto ${isToday ? 'text-accent' : 'text-text3'}`}>{day}</div>
                {stats && (
                  <div className="mt-1 md:mt-2 text-right">
                    <div className={`text-[9px] md:text-[13px] font-black whitespace-nowrap overflow-hidden ${stats.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                      {stats.pnl >= 0 ? "+" : "-"}${Math.abs(stats.pnl) >= 1000 ? (Math.abs(stats.pnl)/1000).toFixed(1) + 'k' : Math.abs(stats.pnl).toFixed(0)}
                    </div>
                    <div className="hidden md:block text-[9px] font-bold text-text3 uppercase tracking-tighter opacity-60">
                      {stats.count} Trades • {stats.wins}W
                    </div>
                    <div className="md:hidden text-[7px] font-bold text-text3 uppercase opacity-60 leading-none mt-0.5">
                      {stats.wins}W
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {sel && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-border bg-surface2/30 flex justify-between items-center">
            <h3 className="text-[16px] font-black text-text tracking-tight uppercase">Trades on {sel}</h3>
            <div className={`text-[14px] font-black ${selTrades.reduce((a, t) => a + t.pnl, 0) >= 0 ? 'text-green' : 'text-red'}`}>
               Daily PnL: {fmtUSD(selTrades.reduce((a, t) => a + t.pnl, 0))}
            </div>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-surface2/50 text-[10px] font-black uppercase text-text3 tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Symbol</th>
                    <th className="px-6 py-4 text-center">Type</th>
                    <th className="px-6 py-4 text-center">Setup</th>
                    <th className="px-6 py-4 text-center">Pips</th>
                    <th className="px-6 py-4 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {selTrades.map((t: any) => (
                    <tr key={t.ticket || t.id} className="border-b border-border hover:bg-surface2/30 transition-all">
                      <td className="px-6 py-4 font-black text-[14px]">{t.symbol}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${t.type.includes('BUY') ? 'bg-blue/10 text-blue' : 'bg-red/10 text-red'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-[12px] font-bold text-text3">{t.setup || "-"}</td>
                      <td className={`px-6 py-4 text-center font-mono text-[11px] font-bold ${t.pips >= 0 ? "text-green" : "text-red"}`}>
                        {t.pips >= 0 ? "+" : ""}{t.pips?.toFixed(1)}
                      </td>
                      <td className={`px-6 py-4 text-right font-black text-[14px] ${t.pnl >= 0 ? "text-green" : "text-red"}`}>
                        {fmtUSD(t.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {!sel && (
        <div className="p-12 border border-dashed border-border rounded-3xl flex flex-col items-center justify-center text-center opacity-40">
           <Calendar size={48} className="mb-4 text-text3" />
           <p className="text-[13px] font-bold uppercase tracking-widest">Select a day to view trade details</p>
        </div>
      )}
      
      <div className="mt-8">
        <CTA />
      </div>
    </div>
  );
}

function CTA() {
  return (
    <div className="p-8 rounded-3xl bg-accent text-white shadow-2xl shadow-accent/20 relative overflow-hidden">
       <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
       <div className="relative z-10 max-w-lg">
          <h3 className="text-[28px] font-black leading-tight mb-4 tracking-tighter">Level Up Your Trading Journal</h3>
          <p className="text-[14px] opacity-80 leading-relaxed mb-8 font-medium">Capture insights, track every pips, and analyze your edge with AI. Join thousands of traders on TimeJournal today.</p>
          <button onClick={() => window.open('https://timejournal.site', '_blank')} className="px-8 py-4 bg-white text-accent rounded-2xl font-black text-[13px] uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all">
            Get Started Free
          </button>
       </div>
    </div>
  );
}
