import React, { useState, useEffect, useMemo } from 'react';
import {
  ScrollView, View, Text, ActivityIndicator, TouchableOpacity, Dimensions
} from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TrendingUp, TrendingDown, Target, Zap, Award, AlertTriangle,
  BarChart2, Calendar, Clock, Layers, ArrowUpRight, ArrowDownRight,
  RefreshCw, Activity
} from 'lucide-react-native';
import { API_URL } from '../Constants';
import { Skeleton, SkeletonCircle, SkeletonRect } from '../components/Skeleton';

const { width: W } = Dimensions.get('window');
const ACCENT = '#6366f1';

// ── Color tokens ───────────────────────────────────────────────────────────────
const C = {
  bg:      { dark: '#0b0e11', light: '#f5f7fa' },
  surface: { dark: '#13161f', light: '#ffffff' },
  surface2:{ dark: '#1a1f2e', light: '#f1f5f9' },
  border:  { dark: '#1e293b', light: '#e8edf5' },
  text:    { dark: '#f1f5f9', light: '#0f172a' },
  text2:   { dark: '#94a3b8', light: '#64748b' },
  text3:   { dark: '#475569', light: '#94a3b8' },
};

// ── Mini KPI card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, isDark }: any) {
  return (
    <View style={{
      flex: 1, backgroundColor: isDark ? C.surface.dark : C.surface.light,
      borderRadius: 20, padding: 16, borderWidth: 1,
      borderColor: isDark ? C.border.dark : C.border.light,
      shadowColor: color, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? C.text3.dark : C.text3.light, letterSpacing: 1 }}>
          {label.toUpperCase()}
        </Text>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={color} strokeWidth={2.5} />
        </View>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.5, marginBottom: 2 }}>
        {value}
      </Text>
      {sub ? <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? C.text3.dark : C.text3.light }}>{sub}</Text> : null}
    </View>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
function SectionHeader({ title, icon: Icon, isDark }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ACCENT + '15', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={13} color={ACCENT} strokeWidth={2.5} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.3 }}>
        {title}
      </Text>
    </View>
  );
}

// ── Bar (used in many charts) ──────────────────────────────────────────────────
function Bar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: color + '20', borderRadius: height / 2, overflow: 'hidden', flex: 1 }}>
      <View style={{ height, width: `${Math.max(pct, 0)}%`, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

// ── Equity Curve (mini bars, cumulative) ───────────────────────────────────────
function EquityCurve({ trades, isDark }: { trades: any[]; isDark: boolean }) {
  const sorted = [...trades].sort((a, b) => {
    const ta = new Date(a.closeTime || a.openTime || 0).getTime();
    const tb = new Date(b.closeTime || b.openTime || 0).getTime();
    return ta - tb;
  });

  // cumulative P&L
  let cum = 0;
  const points = sorted.map(t => {
    cum += t.profit || 0;
    return cum;
  });

  if (points.length < 2) {
    return <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: isDark ? C.text3.dark : C.text3.light, fontSize: 12 }}>Not enough data</Text>
    </View>;
  }

  const minP = Math.min(...points);
  const maxP = Math.max(...points);
  const range = maxP - minP || 1;
  const barW = Math.max(2, (W - 80) / points.length - 1);
  const H = 80;

  return (
    <View style={{ overflow: 'hidden', borderRadius: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: H, gap: 1 }}>
        {points.map((p, i) => {
          const isPos = p >= 0;
          const h = Math.max(2, ((p - minP) / range) * H);
          return (
            <View key={i} style={{
              width: barW, height: h, borderRadius: 2,
              backgroundColor: isPos ? '#10b981' : '#ef4444',
              opacity: 0.8,
            }} />
          );
        })}
      </View>
    </View>
  );
}

// ── Main StatsScreen ───────────────────────────────────────────────────────────
const StatsScreen = React.memo(() => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/mt5/trades`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.trades) setTrades(data.trades);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrades(); }, []);

  const stats = useMemo(() => {
    if (trades.length === 0) return null;

    let grossProfit = 0, grossLoss = 0, wins = 0, losses = 0;
    let totalWin = 0, totalLoss = 0;
    let maxWin = -Infinity, maxLoss = Infinity;
    let maxWinTrade: any = null, maxLossTrade: any = null;
    let streak = 0, curStreak = 0, curType = '';

    // Symbol map
    const symbolMap: Record<string, { pnl: number; count: number }> = {};
    // Session map
    const sessionMap: Record<string, { pnl: number; count: number }> = {};
    // Day of week
    const dayMap: Record<string, { pnl: number; count: number }> = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(d => { dayMap[d] = { pnl: 0, count: 0 }; });
    // Monthly
    const monthMap: Record<string, number> = {};

    trades.forEach(t => {
      const profit = (t.profit || 0) + (t.swap || 0) + (t.commission || 0);
      if (profit > 0) {
        grossProfit += profit; wins++; totalWin += profit;
        if (profit > maxWin) { maxWin = profit; maxWinTrade = t; }
      } else {
        grossLoss += Math.abs(profit); losses++;
        if (losses > 0) totalLoss += profit;
        if (profit < maxLoss) { maxLoss = profit; maxLossTrade = t; }
      }

      // Symbol
      const sym = t.symbol || 'Other';
      if (!symbolMap[sym]) symbolMap[sym] = { pnl: 0, count: 0 };
      symbolMap[sym].pnl += profit;
      symbolMap[sym].count++;

      // Session
      const sess = t.session || 'Unknown';
      if (!sessionMap[sess]) sessionMap[sess] = { pnl: 0, count: 0 };
      sessionMap[sess].pnl += profit;
      sessionMap[sess].count++;

      // Day of week
      try {
        const d = new Date((t.closeTime || t.openTime || '').replace(' ', 'T'));
        const day = dayNames[d.getDay()];
        dayMap[day].pnl += profit;
        dayMap[day].count++;
      } catch (_) {}

      // Month
      try {
        const d = new Date((t.closeTime || t.openTime || '').replace(' ', 'T'));
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[mk]) monthMap[mk] = 0;
        monthMap[mk] += profit;
      } catch (_) {}
    });

    // Streak
    const sorted = [...trades].sort((a, b) =>
      new Date((b.closeTime || b.openTime || '')).getTime() - new Date((a.closeTime || a.openTime || '')).getTime()
    );
    for (let i = 0; i < sorted.length; i++) {
      const p = (sorted[i].profit || 0);
      const t2 = p > 0 ? 'W' : 'L';
      if (i === 0) { curType = t2; curStreak = 1; }
      else if (t2 === curType) curStreak++;
      else break;
    }

    const pf = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;
    const winRate = (wins / trades.length) * 100;
    const avgWin = wins > 0 ? totalWin / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(totalLoss) / losses : 0;
    const rrRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin;
    const totalPnl = grossProfit - grossLoss;
    const expectancy = (winRate / 100) * avgWin - ((1 - winRate / 100) * avgLoss);

    // Top symbols
    const topSymbols = Object.entries(symbolMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);

    // Sessions
    const sessions = Object.entries(sessionMap)
      .sort((a, b) => b[1].count - a[1].count);

    // Month bars — last 6 months
    const months = Object.entries(monthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);

    // Day of week
    const days = dayNames.map(d => ({ day: d, ...dayMap[d] }));

    return {
      totalPnl, wins, losses, winRate, pf, avgWin, avgLoss, rrRatio, expectancy,
      maxWinTrade, maxLossTrade, maxWin, maxLoss,
      topSymbols, sessions, months, days,
      curStreak, curType, totalTrades: trades.length,
    };
  }, [trades]);

  const bg = isDark ? C.bg.dark : C.bg.light;
  const card = isDark ? C.surface.dark : C.surface.light;
  const border = isDark ? C.border.dark : C.border.light;

  if (loading) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {/* KPI Cards Skeleton */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <SkeletonRect width="48%" height={100} borderRadius={20} isDark={isDark} />
          <SkeletonRect width="48%" height={100} borderRadius={20} isDark={isDark} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <SkeletonRect width="48%" height={100} borderRadius={20} isDark={isDark} />
          <SkeletonRect width="48%" height={100} borderRadius={20} isDark={isDark} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <SkeletonRect width="48%" height={100} borderRadius={20} isDark={isDark} />
          <SkeletonRect width="48%" height={100} borderRadius={20} isDark={isDark} />
        </View>

        {/* Section skeletons */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <SkeletonRect width="48%" height={80} borderRadius={20} isDark={isDark} />
          <SkeletonRect width="48%" height={80} borderRadius={20} isDark={isDark} />
        </View>

        <SkeletonRect width="100%" height={150} borderRadius={22} style={{ marginBottom: 16 }} isDark={isDark} />
        <SkeletonRect width="100%" height={120} borderRadius={22} style={{ marginBottom: 16 }} isDark={isDark} />
        <SkeletonRect width="100%" height={100} borderRadius={22} style={{ marginBottom: 16 }} isDark={isDark} />
      </ScrollView>
    );
  }

  if (!stats || trades.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <BarChart2 size={48} color={isDark ? C.text3.dark : C.text3.light} />
        <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, marginTop: 16, textAlign: 'center' }}>
          No analytics yet
        </Text>
        <Text style={{ fontSize: 13, color: isDark ? C.text3.dark : C.text3.light, textAlign: 'center', marginTop: 6 }}>
          Connect your MT5 account and sync trades to see rich analytics here
        </Text>
        <TouchableOpacity onPress={fetchTrades} style={{ marginTop: 24, backgroundColor: ACCENT, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} color="#fff" strokeWidth={2.5} />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { totalPnl, wins, losses, winRate, pf, avgWin, avgLoss, rrRatio, expectancy,
    maxWinTrade, maxLossTrade, maxWin, maxLoss, topSymbols, sessions, months, days,
    curStreak, curType, totalTrades } = stats;

  const maxMonthVal = Math.max(...months.map(([, v]) => Math.abs(v)), 1);
  const maxDayPnl = Math.max(...days.map(d => Math.abs(d.pnl)), 1);
  const maxSymCount = Math.max(...topSymbols.map(([, v]) => v.count), 1);

  const SYMBOL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
  const SESSION_COLORS: Record<string, string> = {
    London: '#3b82f6', 'New York': '#f59e0b', 'Overlap LN+NY': '#8b5cf6',
    Tokyo: '#10b981', Sydney: '#f97316', Unknown: '#64748b',
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Refresh button ───────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
        <TouchableOpacity onPress={fetchTrades} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, borderWidth: 1, borderColor: border }}>
          <RefreshCw size={12} color={isDark ? C.text2.dark : C.text2.light} strokeWidth={2.5} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* ── Row 1: Total P&L + Win Rate ────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <KpiCard
          label="Total P&L" isDark={isDark}
          value={`${totalPnl >= 0 ? '+' : '-'}$${Math.abs(totalPnl).toFixed(2)}`}
          sub={`${wins}W · ${losses}L · ${totalTrades} trades`}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          color={totalPnl >= 0 ? '#10b981' : '#ef4444'}
        />
        <KpiCard
          label="Win Rate" isDark={isDark}
          value={`${winRate.toFixed(1)}%`}
          sub={`${wins} winners`}
          icon={Target}
          color={winRate >= 50 ? '#10b981' : '#f59e0b'}
        />
      </View>

      {/* ── Row 2: Profit Factor + R:R Ratio ───────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <KpiCard
          label="Profit Factor" isDark={isDark}
          value={parseFloat(pf.toString()).toFixed(2)}
          sub={pf >= 1.5 ? '🟢 Strong' : pf >= 1 ? '🟡 Positive' : '🔴 Negative'}
          icon={Zap}
          color={pf >= 1.5 ? '#10b981' : pf >= 1 ? '#f59e0b' : '#ef4444'}
        />
        <KpiCard
          label="Risk:Reward" isDark={isDark}
          value={`1 : ${rrRatio.toFixed(2)}`}
          sub={`Avg win $${avgWin.toFixed(2)}`}
          icon={Award}
          color={rrRatio >= 1.5 ? '#10b981' : '#f59e0b'}
        />
      </View>

      {/* ── Row 3: Avg Win + Avg Loss ────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        <KpiCard
          label="Avg Win" isDark={isDark}
          value={`+$${avgWin.toFixed(2)}`}
          sub="per winning trade"
          icon={ArrowUpRight}
          color="#10b981"
        />
        <KpiCard
          label="Avg Loss" isDark={isDark}
          value={`-$${avgLoss.toFixed(2)}`}
          sub="per losing trade"
          icon={ArrowDownRight}
          color="#ef4444"
        />
      </View>

      {/* ── Streak + Expectancy row ───────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        {/* Current streak */}
        <View style={{
          flex: 1, backgroundColor: card, borderRadius: 20, padding: 16,
          borderWidth: 1, borderColor: border,
          borderLeftWidth: 3, borderLeftColor: curType === 'W' ? '#10b981' : '#ef4444',
        }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? C.text3.dark : C.text3.light, letterSpacing: 1, marginBottom: 6 }}>CURRENT STREAK</Text>
          <Text style={{ fontSize: 26, fontWeight: '900', color: curType === 'W' ? '#10b981' : '#ef4444' }}>
            {curStreak}{curType === 'W' ? 'W' : 'L'}
          </Text>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light, marginTop: 2 }}>
            {curStreak} consecutive {curType === 'W' ? 'wins' : 'losses'}
          </Text>
        </View>
        {/* Expectancy */}
        <View style={{
          flex: 1, backgroundColor: card, borderRadius: 20, padding: 16,
          borderWidth: 1, borderColor: border,
          borderLeftWidth: 3, borderLeftColor: expectancy >= 0 ? '#10b981' : '#ef4444',
        }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? C.text3.dark : C.text3.light, letterSpacing: 1, marginBottom: 6 }}>EXPECTANCY</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: expectancy >= 0 ? '#10b981' : '#ef4444' }}>
            {expectancy >= 0 ? '+' : ''}{expectancy.toFixed(2)}
          </Text>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light, marginTop: 2 }}>
            Expected $ per trade
          </Text>
        </View>
      </View>

      {/* ── Equity Curve ──────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <SectionHeader title="Equity Curve" icon={Activity} isDark={isDark} />
        <EquityCurve trades={trades} isDark={isDark} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>Oldest trade</Text>
          <Text style={{ fontSize: 10, fontWeight: '900', color: totalPnl >= 0 ? '#10b981' : '#ef4444' }}>
            {totalPnl >= 0 ? '+' : '-'}${Math.abs(totalPnl).toFixed(2)} cumulative
          </Text>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>Latest</Text>
        </View>
      </View>

      {/* ── Monthly P&L ────────────────────────────────────────────────────────── */}
      {months.length > 0 && (
        <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border }}>
          <SectionHeader title="Monthly P&L" icon={Calendar} isDark={isDark} />
          {/* Value labels row — above bars */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
            {months.map(([mk, val]) => {
              const isPos = val >= 0;
              return (
                <View key={mk} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, fontWeight: '700', color: isPos ? '#10b981' : '#ef4444' }} numberOfLines={1}>
                    {isPos ? '+' : ''}{Math.abs(val) > 999 ? `${(val/1000).toFixed(1)}k` : val.toFixed(0)}
                  </Text>
                </View>
              );
            })}
          </View>
          {/* Bars row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 60 }}>
            {months.map(([mk, val]) => {
              const isPos = val >= 0;
              const h = Math.max(4, (Math.abs(val) / maxMonthVal) * 56);
              const label = mk.slice(5);
              const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const mLabel = monthNames[parseInt(label)] || label;
              return (
                <View key={mk} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 60 }}>
                  <View style={{ width: '70%', height: h, borderRadius: 4, backgroundColor: isPos ? '#10b981' : '#ef4444', opacity: 0.85 }} />
                  <Text style={{ fontSize: 9, color: isDark ? C.text3.dark : C.text3.light, marginTop: 5 }}>{mLabel}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Win Rate Ring (visual) ────────────────────────────────────────────── */}
      <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <SectionHeader title="Win / Loss Breakdown" icon={Target} isDark={isDark} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
          {/* Stacked bar as ratio visual */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
              <View style={{ flex: winRate / 100, backgroundColor: '#10b981' }} />
              <View style={{ flex: (100 - winRate) / 100, backgroundColor: '#ef4444' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text.dark : C.text.light }}>{wins} Wins</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text.dark : C.text.light }}>{losses} Losses</Text>
              </View>
            </View>
          </View>
          {/* Big number */}
          <View style={{ alignItems: 'center', minWidth: 72 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: winRate >= 50 ? '#10b981' : '#f59e0b', letterSpacing: -1 }}>
              {winRate.toFixed(0)}%
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? C.text3.dark : C.text3.light }}>Win rate</Text>
          </View>
        </View>
      </View>

      {/* ── Symbol Breakdown ──────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <SectionHeader title="Symbol Breakdown" icon={Layers} isDark={isDark} />
        {topSymbols.map(([sym, data], i) => {
          const pct = (data.count / maxSymCount) * 100;
          const isPos = data.pnl >= 0;
          return (
            <View key={sym} style={{ marginBottom: i < topSymbols.length - 1 ? 12 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: SYMBOL_COLORS[i % SYMBOL_COLORS.length] }} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: isDark ? C.text.dark : C.text.light }}>{sym}</Text>
                  <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>{data.count} trades</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '800', color: isPos ? '#10b981' : '#ef4444' }}>
                  {isPos ? '+' : '-'}${Math.abs(data.pnl).toFixed(2)}
                </Text>
              </View>
              <Bar pct={pct} color={SYMBOL_COLORS[i % SYMBOL_COLORS.length]} height={6} />
            </View>
          );
        })}
      </View>

      {/* ── Day of Week ────────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border }}>
        <SectionHeader title="Day of Week Performance" icon={Clock} isDark={isDark} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 70 }}>
          {days.map(({ day, pnl: dp, count }) => {
            const isPos = dp >= 0;
            const h = count === 0 ? 3 : Math.max(4, (Math.abs(dp) / maxDayPnl) * 62);
            return (
              <View key={day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                <View style={{ width: '75%', height: h, borderRadius: 4, backgroundColor: count === 0 ? (isDark ? '#1e293b' : '#e2e8f0') : (isPos ? '#10b981' : '#ef4444'), opacity: count === 0 ? 0.4 : 0.85 }} />
                <Text style={{ fontSize: 9, color: isDark ? C.text3.dark : C.text3.light, marginTop: 5 }}>{day}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>
            Best: {days.sort((a, b) => b.pnl - a.pnl)[0]?.day || '—'}
          </Text>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>
            Worst: {days.sort((a, b) => a.pnl - b.pnl)[0]?.day || '—'}
          </Text>
        </View>
      </View>

      {/* ── Session Performance ────────────────────────────────────────────────── */}
      {sessions.length > 0 && (
        <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border }}>
          <SectionHeader title="Session Performance" icon={BarChart2} isDark={isDark} />
          {sessions.map(([sess, data]) => {
            const color = SESSION_COLORS[sess] || '#64748b';
            const pct = (data.count / totalTrades) * 100;
            const isPos = data.pnl >= 0;
            return (
              <View key={sess} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? C.text.dark : C.text.light }}>{sess}</Text>
                    <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>{data.count} trades · {pct.toFixed(0)}%</Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: isPos ? '#10b981' : '#ef4444' }}>
                    {isPos ? '+' : '-'}${Math.abs(data.pnl).toFixed(2)}
                  </Text>
                </View>
                <Bar pct={pct} color={color} height={5} />
              </View>
            );
          })}
        </View>
      )}

      {/* ── Best & Worst Trade ────────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {maxWinTrade && (
          <View style={{ flex: 1, backgroundColor: 'rgba(16,185,129,0.07)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Award size={13} color="#10b981" strokeWidth={2.5} />
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#10b981', letterSpacing: 1 }}>BEST TRADE</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#10b981', letterSpacing: -0.5 }}>+${maxWin.toFixed(2)}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text.dark : C.text.light, marginTop: 4 }}>{maxWinTrade.symbol}</Text>
            <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>{(maxWinTrade.type || '').toUpperCase()} · {maxWinTrade.lots ?? '—'} lot</Text>
          </View>
        )}
        {maxLossTrade && (
          <View style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertTriangle size={13} color="#ef4444" strokeWidth={2.5} />
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#ef4444', letterSpacing: 1 }}>WORST TRADE</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#ef4444', letterSpacing: -0.5 }}>{maxLoss.toFixed(2)}</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text.dark : C.text.light, marginTop: 4 }}>{maxLossTrade.symbol}</Text>
            <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>{(maxLossTrade.type || '').toUpperCase()} · {maxLossTrade.lots ?? '—'} lot</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
});

export default StatsScreen;
