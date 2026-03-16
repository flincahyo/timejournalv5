"use client";
import React, { useMemo, useState } from "react";
import { useFilteredTrades } from "@/store";
import { fmtUSD, fmtPips, formatDuration } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine,
  LineChart, Line, AreaChart, Area, ComposedChart, PieChart, Pie
} from "recharts";
import {
  TrendingUp, TrendingDown, Target, Zap, Clock, Calendar,
  BarChart3, PieChart as PieIcon, Activity, Flame, Award, ShieldAlert,
  ChevronDown, Filter, Info, ArrowUpRight, ArrowDownRight
} from "lucide-react";

// --- Components ---

function MetricCard({ title, value, subValue, trend, icon: Icon, color, prefix = "" }: any) {
  return (
    <div className="card group hover:scale-[1.02] transition-all duration-300 p-4 bg-surface/30 border-border/10">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2 rounded-xl bg-surface2 border border-border/10 text-text3 group-hover:text-text group-hover:border-border transition-all`}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${trend >= 0 ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
            {trend >= 0 ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="text-[9px] font-bold text-text3 uppercase tracking-[0.1em] mb-0.5 opacity-60">{title}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-extrabold tracking-[-0.6px] text-text leading-none">{value}</span>
        {subValue && <span className="text-[10px] font-bold text-text3 opacity-40">{subValue}</span>}
      </div>
    </div>
  );
}

function AnalysisGrid({ title, icon: Icon, children }: any) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 px-1">
        <Icon size={16} className="text-accent opacity-70" />
        <h3 className="text-[13px] font-black uppercase tracking-widest text-text opacity-80">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  );
}

function MiniProgressBar({ value, max, color, label, icon: Icon }: any) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center px-0.5">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={10} className="text-text3 opacity-50" />}
          <span className="text-[10px] font-bold text-text3 uppercase tracking-wider">{label}</span>
        </div>
        <span className="text-[11px] font-black tracking-tight" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-surface3 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ background: color, width: `${percent}%` }} />
      </div>
    </div>
  );
}

// --- Main Page ---

export default function AnalyticsPage() {
  const { filtered: trades, stats } = useFilteredTrades();
  const [sortKey, setSortKey] = useState<"pnl" | "winRate" | "count">("pnl");

  const symData = useMemo(() => {
    return (stats.symbolStats || []).slice(0, 8);
  }, [stats.symbolStats]);

  const tooltipStyles = {
    contentStyle: { background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" },
    itemStyle: { padding: "2px 0" },
    cursor: { fill: "var(--surface3)", opacity: 0.4 }
  };

  const SESSION_COLORS: any = {
    "Tokyo": "#8b5cf6",
    "Sydney": "#6366f1",
    "London": "#3b82f6",
    "Overlap (LDN+NY)": "#f59e0b",
    "New York": "#10b981",
  };

  if (!trades.length) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center fade-in text-center p-10">
        <div className="w-20 h-20 bg-surface2 rounded-3xl flex items-center justify-center mb-6 border border-border/20">
          <Activity size={32} className="text-accent opacity-20" />
        </div>
        <h2 className="text-xl font-black text-text mb-2">No Trading DNA Found</h2>
        <p className="text-text3 text-[13px] max-w-sm opacity-60">Complete your first few trades to unlock deep behavioral analytics and edge performance insights.</p>
      </div>
    );
  }

  return (
    <div className="fade-in p-4 md:p-7 flex flex-col gap-10 max-w-7xl mx-auto pb-32">

      {/* 1. Hero Performance Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Profit Factor"
          value={stats.profitFactor.toFixed(2)}
          subValue="Ratio"
          icon={TrendingUp}
          color="#4f81c7"
        />
        <MetricCard
          title="Expectancy"
          value={fmtUSD(stats.expectedValue)}
          subValue="per Trade"
          icon={Target}
          color="#10b981"
        />
        <MetricCard
          title="Win Rate"
          value={`${stats.winRate}%`}
          subValue={`${stats.wins}W / ${stats.losses}L`}
          icon={Award}
          color="#f59e0b"
        />
        <MetricCard
          title="Max Drawdown"
          value={`${stats.maxDrawdown.percent.toFixed(1)}%`}
          subValue={fmtUSD(stats.maxDrawdown.amount)}
          icon={ShieldAlert}
          color="#ef4444"
        />
      </div>

      {/* 2. Temporal Analysis Section (Merged Time Metrics) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent opacity-70" />
            <h3 className="text-[13px] font-black uppercase tracking-widest text-text opacity-80">Chronos Analysis</h3>
          </div>
          <span className="text-[10px] font-bold text-text3 opacity-40 uppercase tracking-widest">WIB / UTC+7</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day of Week */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-text3 uppercase tracking-wider opacity-60">Day of Week</span>
              <span className="text-[13px] font-black text-text">Daily Performance Pulse</span>
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.byDow} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text3)' }} dy={10} />
                  <YAxis hide />
                  <Tooltip {...tooltipStyles} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={24}>
                    {stats.byDow.map((d: any, i: number) => <Cell key={i} fill={d.pnl >= 0 ? "var(--green)" : "var(--red)"} fillOpacity={0.8} />)}
                  </Bar>
                  <Line type="monotone" dataKey="wr" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--surface2)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sessions */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-text3 uppercase tracking-wider opacity-60">Market Sessions</span>
              <span className="text-[13px] font-black text-text">Global Liquidity Edge</span>
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bySession} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                  <XAxis dataKey="session" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: 'var(--text3)' }} dy={10}
                    tickFormatter={(val: string) => val === "Overlap (LDN+NY)" ? "OVERLAP" : val.toUpperCase()} />
                  <Tooltip {...tooltipStyles} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {stats.bySession.map((d: any, i: number) => <Cell key={i} fill={d.pnl >= 0 ? SESSION_COLORS[d.session] : "var(--red)"} fillOpacity={0.9} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Hours */}
          <div className="card p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-text3 uppercase tracking-wider opacity-60">Hour of Day</span>
              <span className="text-[13px] font-black text-text">Peak Performance Window</span>
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.byHour} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <XAxis dataKey="slot" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: 'var(--text3)' }} dy={10} />
                  <Tooltip {...tooltipStyles} />
                  <Area type="monotone" dataKey="pnl" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.1} strokeWidth={2} />
                  <Area type="monotone" dataKey="wr" stroke="rgba(255,255,255,0.05)" fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Asset & Behavior Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-4">

        {/* Symbol Performance */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <PieIcon size={16} className="text-accent opacity-70" />
            <h3 className="text-[13px] font-black uppercase tracking-widest text-text opacity-80">Asset DNA</h3>
          </div>
          <div className="card p-5 flex flex-col gap-6 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-black text-text">Top Symbols</span>
                <span className="text-[10px] font-bold text-text3 opacity-60 uppercase tracking-widest">By Cumulative PnL</span>
              </div>
              <Activity size={16} className="text-text3 opacity-20" />
            </div>
            <div className="flex-1 min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symData} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="symbol" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: 'var(--text)' }} width={80} />
                  <Tooltip {...tooltipStyles} />
                  <Bar dataKey="pnl" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {symData.map((s: any, i: number) => (
                      <Cell key={i} fill={s.pnl >= 0 ? `hsl(${210 + i * 15}, 60%, 55%)` : "var(--red)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Behavioral Metrics */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <Flame size={16} className="text-accent opacity-70" />
            <h3 className="text-[13px] font-black uppercase tracking-widest text-text opacity-80">Behavioral Pulse</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div className="card p-6 bg-surface/40 flex flex-col gap-6">
              <span className="text-[11px] font-black text-text uppercase tracking-widest border-b border-border/10 pb-3">Hold Dynamics</span>
              <div className="flex flex-col gap-5">
                <MiniProgressBar label="Scalping (<1h)" value={stats.scalpingWinRate} max={100} color="#4f81c7" icon={Clock} />
                <MiniProgressBar label="Intraday (<24h)" value={stats.intradayWinRate} max={100} color="#6366f1" icon={Zap} />
                <MiniProgressBar label="Multiday" value={stats.multidayWinRate} max={100} color="#8b5cf6" icon={Calendar} />
              </div>
            </div>
            <div className="card p-6 bg-surface/40 flex flex-col gap-4">
              <span className="text-[11px] font-black text-text uppercase tracking-widest border-b border-border/10 pb-3">Time Distribution</span>
              <div className="flex flex-col gap-2.5">
                {[
                  { lbl: "Avg Win Hold", val: formatDuration(stats.avgHoldWins).str, color: "var(--green)" },
                  { lbl: "Avg Loss Hold", val: formatDuration(stats.avgHoldLosses).str, color: "var(--red)" },
                  { lbl: "Avg Long Hold", val: formatDuration(stats.avgHoldLongs).str, color: "var(--text3)" },
                  { lbl: "Avg Short Hold", val: formatDuration(stats.avgHoldShorts).str, color: "var(--text3)" },
                ].map(item => (
                  <div key={item.lbl} className="flex items-center justify-between py-2 border-b border-border/5 last:border-0">
                    <span className="text-[11px] font-bold text-text3 uppercase tracking-tight">{item.lbl}</span>
                    <span className="text-[12px] font-black tabular-nums" style={{ color: item.color }}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6 col-span-1 md:col-span-2 bg-gradient-to-br from-accent/5 to-transparent flex items-center justify-between border-accent/10">
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-black text-text">Long / Short Dynamics</span>
                <span className="text-[10px] text-text3 font-bold uppercase tracking-widest opacity-60">Relative win rates & distribution</span>
              </div>
              <div className="flex items-center gap-10 pr-4">
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-black text-green">{(stats.longWins / Math.max(stats.longWins + stats.longLosses, 1) * 100).toFixed(0)}%</span>
                  <span className="text-[9px] font-bold text-text3 opacity-40 uppercase">BUY WR</span>
                </div>
                <div className="w-px h-8 bg-border/20" />
                <div className="flex flex-col items-center">
                  <span className="text-[18px] font-black text-blue">{(stats.shortWins / Math.max(stats.shortWins + stats.shortLosses, 1) * 100).toFixed(0)}%</span>
                  <span className="text-[9px] font-bold text-text3 opacity-40 uppercase">SELL WR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
