import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, lastDayOfMonth, isSameMonth, isSameDay, addMonths, startOfYear, endOfYear, startOfWeek, endOfWeek } from 'date-fns';
import { 
  View, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, 
  LayoutAnimation, useColorScheme, Platform, PanResponder, Animated, Text, 
  RefreshControl, Modal, Share
} from 'react-native';
import {
  ChevronLeft, ChevronRight, Search, Calendar, Filter, X,
  FileText, Hash, TrendingUp, TrendingDown, Clock, Tag,
  Smile, Meh, Frown, Zap, PenTool, Edit3, MessageSquare, ChevronDown,
  Plus, ArrowUp, ArrowDown, Trash2, ChevronUp, Share2, BarChart2, Crosshair
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../Constants';
import { MainLayout } from '../layouts/MainLayout';
import { Skeleton, SkeletonCircle, SkeletonRect } from '../components/Skeleton';
import Svg, { Path, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

// Gluestack Shim or local components
import { Box } from '../components/ui/box';
import { VStack } from '../components/ui/vstack';
import { HStack } from '../components/ui/hstack';

// ── PnL Card Share Component ──────────────────────────────────────────────────
import { BrandLogo } from '../components/BrandLogo';
import { useWindowDimensions } from 'react-native';

type PeriodKey = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ModeKey = 'growth' | 'detail';
type ThemeKey = 'dark' | 'aurora' | 'ocean' | 'indigo';

function filterTradesByPeriod(trades: any[], period: PeriodKey) {
  const now = new Date();
  let from: Date, to: Date;
  if (period === 'daily') { from = startOfDay(now); to = endOfDay(now); }
  else if (period === 'weekly') { from = startOfWeek(now, { weekStartsOn: 1 }); to = endOfWeek(now, { weekStartsOn: 1 }); }
  else if (period === 'monthly') { from = startOfMonth(now); to = endOfMonth(now); }
  else { from = startOfYear(now); to = endOfYear(now); }
  return trades.filter(t => {
    const d = parseISO(t.closeTime || t.openTime || t.time || '');
    return isWithinInterval(d, { start: from, end: to });
  });
}

function computePnlStats(trades: any[]) {
  const sorted = [...trades].sort((a, b) =>
    (a.closeTime || a.openTime || '').localeCompare(b.closeTime || b.openTime || '')
  );
  const totalPnl = sorted.reduce((s, t) => s + (t.profit || 0), 0);
  const wins = sorted.filter(t => (t.profit || 0) > 0).length;
  const winRate = sorted.length > 0 ? Math.round((wins / sorted.length) * 100) : 0;
  const dayMap: Record<string, number> = {};
  sorted.forEach(t => {
    const d = (t.closeTime || t.openTime || t.time || '').substring(0, 10);
    dayMap[d] = (dayMap[d] || 0) + (t.profit || 0);
  });
  const days = Object.keys(dayMap).length;
  const avgDaily = days > 0 ? totalPnl / days : 0;
  const cumulative: number[] = [0];
  let running = 0;
  sorted.forEach(t => { running += (t.profit || 0); cumulative.push(running); });
  return { totalPnl, winRate, tradeCount: sorted.length, avgDaily, cumulative };
}

// Equity curve SVG path helper
function buildSvgPath(cumulative: number[], W: number, H: number) {
  if (cumulative.length < 2) return '';
  const minV = Math.min(...cumulative), maxV = Math.max(...cumulative);
  const range = maxV - minV || 1;
  const pts = cumulative.map((v, i) => ({
    x: (i / (cumulative.length - 1)) * W,
    y: H - 6 - ((v - minV) / range) * (H - 12)
  }));
  return pts.reduce((d, pt, i) => i === 0 ? `M${pt.x},${pt.y}` : `${d} L${pt.x},${pt.y}`, '');
}

// ── Card theme configs ────────────────────────────────────────────────────────
const CARD_THEMES: Record<ThemeKey, {
  bg: string; gradientPos: [string, string]; gradientNeg: [string, string];
  accentPos: string; accentNeg: string;
  labelColor: string; subColor: string; divider: string; watermarkColor: string;
  glowColor?: string; glowPos?: 'tl' | 'tr' | 'bl' | 'br';
}> = {
  dark: {
    bg: '#0a0b0e',
    gradientPos: ['#0d1f12', '#0a0b0e'], gradientNeg: ['#1f0d0d', '#0a0b0e'],
    accentPos: '#10b981', accentNeg: '#ef4444',
    labelColor: 'rgba(255,255,255,0.32)', subColor: 'rgba(255,255,255,0.28)',
    divider: 'rgba(255,255,255,0.07)', watermarkColor: 'rgba(255,255,255,0.18)',
  },
  aurora: {
    bg: '#0c0a1e',
    gradientPos: ['#1a0a2e', '#0c0a1e'], gradientNeg: ['#1f0a1a', '#0c0a1e'],
    accentPos: '#a78bfa', accentNeg: '#f472b6',
    labelColor: 'rgba(255,255,255,0.32)', subColor: 'rgba(255,255,255,0.28)',
    divider: 'rgba(167,139,250,0.12)', watermarkColor: 'rgba(255,255,255,0.18)',
    glowColor: '#7c3aed', glowPos: 'tr',
  },
  ocean: {
    bg: '#061822',
    gradientPos: ['#0a2a3e', '#061822'], gradientNeg: ['#1a0a0a', '#061822'],
    accentPos: '#38bdf8', accentNeg: '#f87171',
    labelColor: 'rgba(255,255,255,0.32)', subColor: 'rgba(255,255,255,0.28)',
    divider: 'rgba(56,189,248,0.1)', watermarkColor: 'rgba(255,255,255,0.18)',
    glowColor: '#0284c7', glowPos: 'bl',
  },
  indigo: {
    bg: '#1e1b4b',
    gradientPos: ['#312e81', '#1e1b4b'], gradientNeg: ['#2d1b4b', '#1e1b4b'],
    accentPos: '#10b981', accentNeg: '#ef4444',
    labelColor: 'rgba(255,255,255,0.4)', subColor: 'rgba(255,255,255,0.3)',
    divider: 'rgba(99,102,241,0.2)', watermarkColor: 'rgba(255,255,255,0.22)',
    glowColor: '#6366f1', glowPos: 'tr',
  },
};

const THEME_NAMES: Record<ThemeKey, string> = { dark: 'Dark', aurora: 'Aurora', ocean: 'Ocean', indigo: 'Indigo' };
const THEME_KEYS: ThemeKey[] = ['dark', 'aurora', 'ocean', 'indigo'];

// ── Single PnLCard (one theme) ────────────────────────────────────────────────
const PnLCardSingle = React.forwardRef<ViewShot, {
  trades: any[]; period: PeriodKey; mode: ModeKey; theme: ThemeKey;
  accountBalance: number; userName: string;
}>(({ trades, period, mode, theme, accountBalance, userName }, ref) => {
  const filtered = useMemo(() => filterTradesByPeriod(trades, period), [trades, period]);
  const { totalPnl, winRate, tradeCount, avgDaily, cumulative } = useMemo(() => computePnlStats(filtered), [filtered]);
  // Growth %: (periodPnl / balanceAtPeriodStart) * 100
  // balanceAtPeriodStart = currentAccountBalance - totalPnlForEntireHistory... approximation:
  // If we only have periodPnl, use: startBal = accountBalance - totalPnl (approx start of period balance)
  const startBal = accountBalance > 0 ? accountBalance - totalPnl : 0;
  const growthPct = startBal > 0 ? (totalPnl / startBal) * 100 : 0;
  const tc = CARD_THEMES[theme];
  const isPos = totalPnl >= 0;
  const accentColor = isPos ? tc.accentPos : tc.accentNeg;
  const periodLabels: Record<PeriodKey, string> = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
  const periodSubLabels: Record<PeriodKey, string> = {
    daily: format(new Date(), 'MMM d, yyyy'),
    weekly: `${format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d')}`,
    monthly: format(new Date(), 'MMMM yyyy'),
    yearly: format(new Date(), 'yyyy'),
  };
  const CARD_WIDTH = 300;
  const svgPath = useMemo(() => buildSvgPath(cumulative, CARD_WIDTH, 60), [cumulative]);
  const gradColors: [string, string] = isPos ? tc.gradientPos : tc.gradientNeg;

  return (
    <ViewShot ref={ref as any} options={{ format: 'png', quality: 1 }}>
      <View style={{ width: CARD_WIDTH, borderRadius: 24, overflow: 'hidden', backgroundColor: tc.bg }}>
        <ExpoLinearGradient colors={gradColors} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {/* Subtle horizontal lines */}
        {(theme === 'aurora' || theme === 'ocean' || theme === 'indigo') && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 }}>
            {[0,1,2,3].map(i => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${25 * i}%`, height: 1, backgroundColor: accentColor }} />)}
          </View>
        )}
        {/* Equity curve bg */}
        {svgPath !== '' && (
          <View style={{ position: 'absolute', bottom: 32, left: 0, right: 0, opacity: 0.1 }}>
            <Svg width={CARD_WIDTH} height={60}>
              <Path d={svgPath} stroke={accentColor} strokeWidth={2} fill="none" />
            </Svg>
          </View>
        )}
        {/* Glow orb */}
        {tc.glowColor && (
          <View style={[
            { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: tc.glowColor, opacity: 0.14 },
            tc.glowPos === 'tr' ? { top: -35, right: -35 } :
            tc.glowPos === 'bl' ? { bottom: -35, left: -35 } :
            tc.glowPos === 'tl' ? { top: -35, left: -35 } : { bottom: -35, right: -35 }
          ]} />
        )}

        <View style={{ padding: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <BrandLogo size={14} whiteJournal />
            <View style={{ backgroundColor: `${accentColor}22`, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, borderWidth: 1, borderColor: `${accentColor}35` }}>
              <Text style={{ color: accentColor, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 }}>{periodLabels[period]}</Text>
            </View>
          </View>

          {/* Growth-only mode */}
          {mode === 'growth' ? (
            <View style={{ alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: tc.labelColor, fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>Account Growth</Text>
              <Text style={{ color: accentColor, fontSize: 48, fontWeight: '900', letterSpacing: -2, lineHeight: 52 }}>
                {growthPct >= 0 ? '+' : ''}{growthPct.toFixed(2)}%
              </Text>
              <Text style={{ color: tc.subColor, fontSize: 9, fontWeight: '600', marginTop: 4 }}>{periodSubLabels[period]}</Text>
            </View>
          ) : (
            <>
              <Text style={{ color: tc.labelColor, fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Net P&L</Text>
              <Text style={{ color: accentColor, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 4 }}>
                {isPos ? '+' : ''}${totalPnl.toFixed(2)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                <View style={{ backgroundColor: `${accentColor}18`, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  {isPos ? <ArrowUp size={8} color={accentColor} /> : <ArrowDown size={8} color={accentColor} />}
                  <Text style={{ color: accentColor, fontSize: 9, fontWeight: '900' }}>{growthPct >= 0 ? '+' : ''}{growthPct.toFixed(2)}%</Text>
                </View>
                <Text style={{ color: tc.subColor, fontSize: 9, fontWeight: '600' }}>{periodSubLabels[period]}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: tc.divider, marginBottom: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[
                  { label: 'Win Rate', value: `${winRate}%` },
                  { label: 'Trades', value: `${tradeCount}` },
                  { label: 'Avg/Day', value: `${avgDaily >= 0 ? '+' : ''}$${Math.abs(avgDaily).toFixed(0)}` },
                ].map((s, i) => (
                  <View key={i} style={{ alignItems: 'center' }}>
                    <Text style={{ color: tc.labelColor, fontSize: 7, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{s.label}</Text>
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '900' }}>{s.value}</Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: tc.divider, marginTop: 12, marginBottom: 8 }} />
            </>
          )}

          {/* Watermark */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: mode === 'growth' ? 6 : 0 }}>
            <Text style={{ color: tc.watermarkColor, fontSize: 8, fontWeight: '600' }}>@{userName || 'trader'}</Text>
            <Text style={{ color: tc.watermarkColor, fontSize: 8, fontWeight: '700', letterSpacing: 0.4 }}>TimeJournal App</Text>
          </View>
        </View>
      </View>
    </ViewShot>
  );
});

// ── Carousel wrapper (swipeable, full-width paging) ───────────────────────────
const PnLCardCarousel = React.forwardRef<any, {
  trades: any[]; period: PeriodKey; mode: ModeKey;
  activeTheme: ThemeKey; onThemeChange: (t: ThemeKey) => void;
  accountBalance: number; userName: string;
}>(({ trades, period, mode, activeTheme, onThemeChange, accountBalance, userName }, ref) => {
  const { width: winW } = useWindowDimensions();
  // Modal has 24px padding each side, so content width = winW - 48
  // We use winW as the page width (ScrollView is full-width via negative margin)
  const pageW = winW;
  const CARD_W = Math.min(winW - 64, 320); // card is at most 320, with 32px margin each side
  const scrollRef = useRef<ScrollView>(null);
  const [currentIdx, setCurrentIdx] = useState(Math.max(0, THEME_KEYS.indexOf(activeTheme)));
  const cardRefs = useRef<any[]>(THEME_KEYS.map(() => null));

  React.useImperativeHandle(ref, () => ({
    capture: () => {
      const r = cardRefs.current[currentIdx];
      if (r?.capture) return r.capture();
      return Promise.reject('no ref');
    }
  }));

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageW}
        snapToAlignment="center"
        contentContainerStyle={{ paddingHorizontal: 0 }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
          const clamped = Math.max(0, Math.min(idx, THEME_KEYS.length - 1));
          setCurrentIdx(clamped);
          onThemeChange(THEME_KEYS[clamped]);
        }}
      >
        {THEME_KEYS.map((tk, i) => (
          <View key={tk} style={{ width: pageW, alignItems: 'center', justifyContent: 'center' }}>
            <PnLCardSingle
              ref={el => { cardRefs.current[i] = el; }}
              trades={trades} period={period} mode={mode} theme={tk}
              accountBalance={accountBalance} userName={userName}
            />
          </View>
        ))}
      </ScrollView>
      {/* Indicator dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {THEME_KEYS.map((tk, i) => (
          <View key={tk} style={{ width: currentIdx === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: currentIdx === i ? '#6366f1' : 'rgba(99,102,241,0.3)' }} />
        ))}
      </View>
      <Text style={{ textAlign: 'center', fontSize: 9, fontWeight: '700', color: '#6366f1', marginTop: 4, letterSpacing: 0.5 }}>{THEME_NAMES[activeTheme]}</Text>
    </View>
  );
});

// ── Trade Duration Helper ─────────────────────────────────────────────────────
function tradeDuration(openTime: string, closeTime: string): string {
  try {
    const open = new Date(openTime), close = new Date(closeTime);
    const diffMs = close.getTime() - open.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
  } catch { return '–'; }
}

// ── Single Trade Card (one theme) ─────────────────────────────────────────────
const TradeCardSingle = React.forwardRef<ViewShot, {
  trade: any; theme: ThemeKey; userName: string;
}>(({ trade, theme, userName }, ref) => {
  const tc = CARD_THEMES[theme];
  const profit = trade.profit || 0;
  const isPos = profit >= 0;
  const accentColor = isPos ? tc.accentPos : tc.accentNeg;
  const isLong = (trade.type || '').toLowerCase() === 'buy';
  const openTime = trade.openTime || trade.time || '';
  const closeTime = trade.closeTime || trade.time || '';
  const duration = tradeDuration(openTime, closeTime);
  const CARD_WIDTH = 300;
  const CH = 80; // chart height

  // Bezier curve background: profit = rises left→right, loss = falls left→right
  const bgChartPath = useMemo(() => {
    if (isPos) {
      // S-curve rising: starts bottom-left, rises to top-right
      return `M0,${CH} C${CARD_WIDTH * 0.3},${CH} ${CARD_WIDTH * 0.5},0 ${CARD_WIDTH},0`;
    } else {
      // S-curve falling: starts top-left, falls to bottom-right
      return `M0,0 C${CARD_WIDTH * 0.3},0 ${CARD_WIDTH * 0.5},${CH} ${CARD_WIDTH},${CH}`;
    }
  }, [isPos]);

  const gradColors: [string, string] = isPos ? tc.gradientPos : tc.gradientNeg;

  return (
    <ViewShot ref={ref as any} options={{ format: 'png', quality: 1 }}>
      <View style={{ width: CARD_WIDTH, borderRadius: 24, overflow: 'hidden', backgroundColor: tc.bg }}>
        <ExpoLinearGradient colors={gradColors} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

        {/* Background chart — behind P&L area */}
        <View style={{ position: 'absolute', top: 50, left: 0, right: 0, opacity: 0.13 }}>
          <Svg width={CARD_WIDTH} height={CH}>
            <Path d={bgChartPath} stroke={accentColor} strokeWidth={2.5} fill="none" />
            {/* Fill area under the chart */}
            <Path
              d={isPos
                ? `M0,${CH} C${CARD_WIDTH * 0.3},${CH} ${CARD_WIDTH * 0.5},0 ${CARD_WIDTH},0 L${CARD_WIDTH},${CH} Z`
                : `M0,0 C${CARD_WIDTH * 0.3},0 ${CARD_WIDTH * 0.5},${CH} ${CARD_WIDTH},${CH} L${CARD_WIDTH},0 Z`}
              fill={accentColor}
              opacity={0.15}
            />
          </Svg>
        </View>

        {/* Glow orb */}
        {tc.glowColor && (
          <View style={[
            { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: tc.glowColor, opacity: 0.13 },
            tc.glowPos === 'tr' ? { top: -30, right: -30 } :
            tc.glowPos === 'bl' ? { bottom: -30, left: -30 } :
            { top: -30, left: -30 }
          ]} />
        )}

        <View style={{ padding: 20 }}>
          {/* Header: BrandLogo + badges */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <BrandLogo size={13} whiteJournal />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ backgroundColor: isLong ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: isLong ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.28)' }}>
                <Text style={{ color: isLong ? '#10b981' : '#ef4444', fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>{isLong ? 'LONG' : 'SHORT'}</Text>
              </View>
              <View style={{ backgroundColor: `${accentColor}18`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: `${accentColor}28` }}>
                <Text style={{ color: accentColor, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>{(trade.volume || trade.lots || 0).toFixed(2)} LOTS</Text>
              </View>
            </View>
          </View>

          {/* Main row: P&L (left, big, highlighted) + Symbol (right, small, dim) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tc.labelColor, fontSize: 8, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>P&L</Text>
              <Text style={{ color: accentColor, fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>
                {isPos ? '+' : ''}${profit.toFixed(2)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Symbol</Text>
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}>{trade.symbol || '–'}</Text>
            </View>
          </View>

          {/* Price stats */}
          <View style={{ height: 1, backgroundColor: tc.divider, marginBottom: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            {[
              { label: 'Entry', value: (trade.openPrice || trade.open_price || 'N/A').toString() },
              { label: 'Exit', value: (trade.closePrice || trade.close_price || 'N/A').toString() },
              { label: 'Duration', value: duration },
            ].map((s, i) => (
              <View key={i} style={{ alignItems: i === 2 ? 'flex-end' : i === 0 ? 'flex-start' : 'center' }}>
                <Text style={{ color: tc.labelColor, fontSize: 7, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{s.label}</Text>
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Watermark */}
          <View style={{ height: 1, backgroundColor: tc.divider, marginBottom: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: tc.watermarkColor, fontSize: 8, fontWeight: '600' }}>
              @{userName || 'trader'} · {closeTime ? format(new Date(closeTime), 'MMM d, yyyy') : ''}
            </Text>
            <Text style={{ color: tc.watermarkColor, fontSize: 8, fontWeight: '700', letterSpacing: 0.4 }}>TimeJournal App</Text>
          </View>
        </View>
      </View>
    </ViewShot>
  );
});

// ── Trade Card Carousel ────────────────────────────────────────────────────────
const TradeCardCarousel = React.forwardRef<any, {
  trade: any; activeTheme: ThemeKey; onThemeChange: (t: ThemeKey) => void; userName: string;
}>(({ trade, activeTheme, onThemeChange, userName }, ref) => {
  const { width: winW } = useWindowDimensions();
  const pageW = winW;
  const [currentIdx, setCurrentIdx] = useState(Math.max(0, THEME_KEYS.indexOf(activeTheme)));
  const cardRefs = useRef<any[]>(THEME_KEYS.map(() => null));

  React.useImperativeHandle(ref, () => ({
    capture: () => {
      const r = cardRefs.current[currentIdx];
      if (r?.capture) return r.capture();
      return Promise.reject('no ref');
    }
  }));

  return (
    <View>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        decelerationRate="fast" snapToInterval={pageW} snapToAlignment="center"
        onMomentumScrollEnd={e => {
          const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / pageW), THEME_KEYS.length - 1));
          setCurrentIdx(idx);
          onThemeChange(THEME_KEYS[idx]);
        }}
      >
        {THEME_KEYS.map((tk, i) => (
          <View key={tk} style={{ width: pageW, alignItems: 'center', justifyContent: 'center' }}>
            <TradeCardSingle ref={el => { cardRefs.current[i] = el; }} trade={trade} theme={tk} userName={userName} />
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {THEME_KEYS.map((_, i) => (
          <View key={i} style={{ width: currentIdx === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: currentIdx === i ? '#6366f1' : 'rgba(99,102,241,0.3)' }} />
        ))}
      </View>
      <Text style={{ textAlign: 'center', fontSize: 9, fontWeight: '700', color: '#6366f1', marginTop: 4, letterSpacing: 0.5 }}>{THEME_NAMES[activeTheme]}</Text>
    </View>
  );
});

// ── Daily group card (extracted for memoization) ──────────────────────────────────
const DailyGroupCard = React.memo(({
  group, isDark, isExp, date, onToggleDay, journalData, saveNote, toggleDailyTag, addTag, deleteTag, onOpenRecap
}: {
  group: any; isDark: boolean; isExp: boolean; date: string;
  onToggleDay: (day: string) => void;
  journalData: any; saveNote: (day: string, text: string) => void;
  toggleDailyTag: (day: string, tag: string) => void;
  addTag: (name: string) => void;
  deleteTag: (name: string) => void;
  onOpenRecap: (trade: any) => void;
}) => {
  const [addingTag, setAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [deletingTag, setDeletingTag] = useState<string | null>(null);
  // Call parent stable callback
  const handleToggle = useCallback(() => onToggleDay(date), [date, onToggleDay]);
  const displayDate = new Date(group.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const isPos = group.totalPnl >= 0;

  return (
    <Box className="mb-4 bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden border border-slate-100 dark:border-slate-800">
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleToggle}
        style={{ padding: 16 }}
      >
        {/* Top row: chevron + date + P&L */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <HStack space="xs" className="items-center">
            <Box className={`w-7 h-7 rounded-lg items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              {isExp ? <ChevronDown size={14} color={isDark ? '#cbd5e1' : '#475569'} /> : <ChevronRight size={14} color={isDark ? '#64748b' : '#94a3b8'} />}
            </Box>
            <VStack>
              <Text className="text-sm font-black text-slate-900 dark:text-white">{displayDate}</Text>
              <Text className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{group.trades.length} Trades</Text>
            </VStack>
          </HStack>
          <Text className={`text-sm font-black tracking-tighter ${isPos ? 'text-emerald-500' : 'text-rose-500'}`}>
            P&L:{'  '}{isPos ? '' : '-'}${Math.abs(group.totalPnl).toFixed(2)}
          </Text>
        </View>

        {/* Mini chart + stats row — always visible */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <MiniPnLChart trades={group.trades} isDark={isDark} />
          <View style={{ flex: 1 }}>
            <DailyStats trades={group.trades} isDark={isDark} />
          </View>
        </View>
      </TouchableOpacity>

      {isExp && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{ height: 1, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', marginBottom: 20 }} />

          {/* Daily Reflection */}
          <Box className="mb-6">
            <HStack space="xs" className="items-center mb-3">
              <FileText size={12} color={isDark ? '#64748b' : '#94a3b8'} />
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daily Reflection</Text>
            </HStack>
            <TextInput
              multiline
              placeholder="Click to write about today's session..."
              placeholderTextColor={isDark ? '#334155' : '#cbd5e1'}
              defaultValue={journalData.notes[group.date] || ""}
              onEndEditing={(e) => saveNote(group.date, e.nativeEvent.text)}
              style={{
                backgroundColor: isDark ? '#020617' : '#fcfcfc',
                borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0',
                borderRadius: 16, padding: 12, minHeight: 80,
                color: isDark ? '#f8fafc' : '#0f172a', fontSize: 12,
                textAlignVertical: 'top'
              }}
            />
          </Box>

          {/* Psychology Tags */}
          <Box className="mb-6">
            <HStack space="xs" className="items-center mb-3">
              <Hash size={12} color="#f59e0b" />
              <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Psychology Tags</Text>
              {deletingTag && (
                <TouchableOpacity onPress={() => setDeletingTag(null)} style={{ marginLeft: 6 }}>
                  <Text style={{ fontSize: 9, color: '#64748b', fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              )}
            </HStack>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {journalData.tags.map((tag: string, tidx: number) => {
                const isActive = (journalData.dailyTags[group.date] || []).includes(tag);
                const isDeleting = deletingTag === tag;
                return (
                  <TouchableOpacity
                    key={tidx}
                    onPress={() => {
                      if (deletingTag) { setDeletingTag(null); return; }
                      toggleDailyTag(group.date, tag);
                    }}
                    onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setDeletingTag(tag); }}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
                      backgroundColor: isDeleting ? '#fee2e2' : (isActive ? '#3b82f6' : (isDark ? '#1e293b' : '#f1f5f9')),
                      borderWidth: 1, borderColor: isDeleting ? '#fca5a5' : (isActive ? '#3b82f6' : (isDark ? '#334155' : '#e2e8f0'))
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDeleting ? '#ef4444' : (isActive ? '#ffffff' : (isDark ? '#cbd5e1' : '#1e293b')) }}>{tag}</Text>
                    {isDeleting && (
                      <TouchableOpacity onPress={() => { deleteTag(tag); setDeletingTag(null); }} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                        <X size={10} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Add Tag Button / Input */}
              {addingTag ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TextInput
                    autoFocus
                    value={newTagText}
                    onChangeText={setNewTagText}
                    placeholder="Tag name"
                    placeholderTextColor="#94a3b8"
                    style={{
                      fontSize: 10, fontWeight: 'bold', color: isDark ? '#f8fafc' : '#0f172a',
                      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                      borderWidth: 1, borderColor: '#6366f1', borderRadius: 10,
                      paddingHorizontal: 10, paddingVertical: 6, minWidth: 80
                    }}
                    onSubmitEditing={() => {
                      if (newTagText.trim()) { addTag(newTagText.trim()); }
                      setNewTagText(''); setAddingTag(false);
                    }}
                    onBlur={() => { setNewTagText(''); setAddingTag(false); }}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setAddingTag(true)}
                  style={{
                    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
                    borderWidth: 1, borderStyle: 'dashed', borderColor: isDark ? '#334155' : '#cbd5e1'
                  }}
                >
                  <Plus size={10} color="#6366f1" />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#6366f1' }}>Add tag</Text>
                </TouchableOpacity>
              )}
            </View>
          </Box>

          {/* Trade List */}
          <VStack space="sm">
            {group.trades.map((trade: any) => (
               <Box key={trade.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-[20px] border border-slate-100 dark:border-slate-800">
                 <HStack className="justify-between items-center">
                   <HStack space="md" className="items-center">
                     <Box className={`w-8 h-8 rounded-xl items-center justify-center ${trade.type === 'BUY' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-rose-50 dark:bg-rose-950/30'}`}>
                        <Box className={`w-2 h-2 rounded-full ${trade.type === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                     </Box>
                     <VStack>
                       <Text className="text-xs font-black text-slate-900 dark:text-white">{trade.symbol}</Text>
                       <Text className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                         {(trade.time || trade.openTime || "").split('T')[1]?.substring(0, 5) || "00:00"} • {trade.type}
                       </Text>
                     </VStack>
                   </HStack>
                   <VStack className="items-end gap-1">
                     <HStack space="xs" className="items-center">
                        <Text className={`text-xs font-black tracking-tighter ${trade.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                           {trade.profit >= 0 ? '+' : '-'}${Math.abs(trade.profit).toFixed(2)}
                        </Text>
                        <TouchableOpacity 
                           onPress={() => onOpenRecap(trade)}
                           style={{ padding: 4, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 8 }}
                        >
                           <Edit3 size={10} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                     </HStack>
                     <Text className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                        {trade.volume || trade.lots || '0.00'} Lots • {trade.setup || 'Auto'}
                     </Text>
                     <Text className="text-[7px] font-bold text-slate-400 uppercase">
                        {trade.session || 'Unknown'} • {formatDuration(trade.openTime, trade.closeTime, trade.duration)}
                     </Text>
                   </VStack>
                 </HStack>
               </Box>
            ))}
          </VStack>
        </View>
      )}
    </Box>
  );
});

// ── Mini cumulative PnL chart ─────────────────────────────────────────────────
const MiniPnLChart = React.memo(({ trades, isDark }: { trades: any[]; isDark: boolean }) => {
  const W = 110, H = 56, PAD = 4;

  const { d, fillPts, color, isPositive } = useMemo(() => {
    // Build cumulative PnL points sorted by time
    const sorted = [...trades].sort((a, b) => {
      const ta = a.openTime || a.time || '';
      const tb = b.openTime || b.time || '';
      return ta.localeCompare(tb);
    });

    const cumulative: number[] = [];
    let running = 0;
    cumulative.push(0); // start at 0
    sorted.forEach(t => { running += (t.profit || 0); cumulative.push(running); });

    if (cumulative.length < 2) return { d: '', fillPts: '', color: '#10b981', isPositive: true };

    const minV = Math.min(...cumulative);
    const maxV = Math.max(...cumulative);
    const range = maxV - minV || 1;
    const isPositive = cumulative[cumulative.length - 1] >= 0;
    const color = isPositive ? '#10b981' : '#ef4444';

    const toX = (i: number) => PAD + (i / (cumulative.length - 1)) * (W - PAD * 2);
    const toY = (v: number) => PAD + (1 - (v - minV) / range) * (H - PAD * 2);

    // Build smooth path using simple cubic bezier
    const points = cumulative.map((v, i) => ({ x: toX(i), y: toY(v) }));
    let dStr = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      dStr += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    // Filled area polygon (go down to bottom, back to start)
    const lastPt = points[points.length - 1];
    const fillPtsStr = [...points.map(p => `${p.x},${p.y}`), `${lastPt.x},${H}`, `${points[0].x},${H}`].join(' ');
    
    return { d: dStr, fillPts: fillPtsStr, color, isPositive };
  }, [trades]);

  if (!d) return null;

  return (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id={`grad_${isPositive ? 'g' : 'r'}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0.01" />
        </LinearGradient>
      </Defs>
      <Polygon points={fillPts} fill={`url(#grad_${isPositive ? 'g' : 'r'})`} />
      <Path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
});

// ── Daily stats grid (matching web screenshot) ────────────────────────────────
const DailyStats = React.memo(({ trades, isDark }: { trades: any[]; isDark: boolean }) => {
  const stats = useMemo(() => {
    const profits = trades.map(t => t.profit || 0);
    const wins = profits.filter(p => p > 0);
    const losses = profits.filter(p => p < 0);
    const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
    const bestTrade = profits.length > 0 ? Math.max(...profits) : 0;
    const worstTrade = profits.length > 0 ? Math.min(...profits) : 0;
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    return { winRate, bestTrade, worstTrade, avgWin, avgLoss };
  }, [trades]);

  const lbl = { fontSize: 9, fontWeight: '700' as const, color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 3 };
  const valFormatter = (v: number, signed = true) => {
    const abs = `$${Math.abs(v).toFixed(2)}`;
    return signed && v !== 0 ? (v > 0 ? abs : `-${abs}`) : abs;
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 }}>
      {[
        { label: 'Trades', value: String(trades.length), color: isDark ? '#ffffff' : '#0f172a' },
        { label: 'Winrate', value: `${stats.winRate.toFixed(1)}%`, color: isDark ? '#ffffff' : '#0f172a' },
        { label: 'Best Trade', value: valFormatter(stats.bestTrade), color: '#10b981' },
        { label: 'Worst Trade', value: valFormatter(stats.worstTrade), color: stats.worstTrade < 0 ? '#ef4444' : '#10b981' },
        { label: 'Avg Win', value: valFormatter(stats.avgWin), color: '#10b981' },
        { label: 'Avg Loss', value: valFormatter(stats.avgLoss), color: stats.avgLoss < 0 ? '#ef4444' : '#94a3b8' },
      ].map((item, i) => (
        <View key={i} style={{ width: '33.33%', paddingVertical: 6, paddingHorizontal: 4 }}>
          <Text style={lbl}>{item.label}</Text>
          <Text style={{ fontSize: 13, fontWeight: '900', color: item.color, fontFamily: 'Montserrat_700Bold' }}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
});

const formatDuration = (open: string, close: string, existing?: string) => {
  if (existing && existing !== 'N/A' && existing !== '') return existing;
  if (!open || !close) return 'N/A';
  try {
    const start = new Date(open).getTime();
    const end = new Date(close).getTime();
    const diff = end - start;
    if (diff <= 0) return 'N/A';
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  } catch (e) { return 'N/A'; }
};

// ── Calendar View ─────────────────────────────────────────────────────────────
const CalendarView = ({ calendarDate, setCalendarDate, trades, isDark, onDayPress, onOpenRecap }: any) => {
  const days = useMemo(() => {
    const start = startOfMonth(calendarDate);
    const end = lastDayOfMonth(calendarDate);
    const dateInterval = eachDayOfInterval({ start, end });
    
    // Add padding for start of month
    const startIdx = start.getDay(); // 0 is Sunday
    const paddingStart = Array(startIdx).fill(null);
    
    return [...paddingStart, ...dateInterval];
  }, [calendarDate]);

  const dailyPnL = useMemo(() => {
    const pnlMap: Record<string, number> = {};
    trades.forEach((t: any) => {
      const d = (t.time || t.openTime || "").split('T')[0];
      if (d) pnlMap[d] = (pnlMap[d] || 0) + (t.profit || 0);
    });
    return pnlMap;
  }, [trades]);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const selectedDayTrades = useMemo(() => {
    if (!selectedDay) return [];
    const dKey = format(selectedDay, 'yyyy-MM-dd');
    return trades.filter((t: any) => (t.time || t.openTime || "").split('T')[0] === dKey);
  }, [selectedDay, trades]);

  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <View style={{ flex: 1 }}>
      {/* Calendar Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}>
        <VStack>
          <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>
            {format(calendarDate, 'MMMM yyyy')}
          </Text>
          <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Monthly Performance Grid</Text>
        </VStack>
        <HStack space="sm">
          <TouchableOpacity 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCalendarDate(addMonths(calendarDate, -1)); setSelectedDay(null); }}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={18} color={isDark ? '#cbd5e1' : '#475569'} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCalendarDate(addMonths(calendarDate, 1)); setSelectedDay(null); }}
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={18} color={isDark ? '#cbd5e1' : '#475569'} />
          </TouchableOpacity>
        </HStack>
      </View>

      {/* WeekDays Header */}
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {weekDays.map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '900', color: '#64748b', letterSpacing: 0.5 }}>{d}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day, i) => {
          if (!day) return <View key={`pad-${i}`} style={{ width: `${100/7}%`, aspectRatio: 1, padding: 2 }} />;
          
          const dKey = format(day, 'yyyy-MM-dd');
          const pnl = dailyPnL[dKey];
          const hasTrades = pnl !== undefined;
          const isPos = pnl !== undefined && pnl >= 0;
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          return (
            <TouchableOpacity 
              key={dKey} 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedDay(day); }}
              style={{ width: `${100/7}%`, aspectRatio: 1, padding: 2 }}
            >
              <View style={{ 
                flex: 1, borderRadius: 12, padding: 4, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected
                  ? '#6366f1'
                  : (hasTrades 
                    ? (isPos ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)') 
                    : (isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc')),
                borderWidth: 1,
                borderColor: isToday ? '#6366f1' : (hasTrades ? (isPos ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)') : 'transparent')
              }}>
                <Text style={{ 
                  fontSize: 10, fontWeight: '900', 
                  color: isSelected ? '#ffffff' : (isToday ? '#6366f1' : (isDark ? '#cbd5e1' : '#475569')),
                  marginBottom: hasTrades ? 2 : 0
                }}>
                  {format(day, 'd')}
                </Text>
                {hasTrades && (
                  <Text 
                    numberOfLines={1} 
                    adjustsFontSizeToFit 
                    style={{ 
                      fontSize: 8, fontWeight: '900', 
                      color: isSelected ? 'rgba(255,255,255,0.8)' : (isPos ? '#10b981' : '#ef4444') 
                    }}
                  >
                    {pnl > 0 ? '+' : ''}{pnl.toFixed(0)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Daily Trade Detail List */}
      {selectedDay && (
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
             <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', textTransform: 'uppercase', letterSpacing: 1 }}>
                {format(selectedDay, 'MMM d, yyyy')} Details
             </Text>
             <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#64748b' }}>{selectedDayTrades.length} Trades</Text>
          </View>
          
          {selectedDayTrades.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center', backgroundColor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc', borderRadius: 16 }}>
               <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 'bold' }}>No trades recorded for this day.</Text>
            </View>
          ) : (
            <VStack space="sm">
              {selectedDayTrades.map((t: any) => (
                <View key={t.id} style={{ 
                  backgroundColor: isDark ? '#1e293b' : '#ffffff', 
                  borderRadius: 16, padding: 12, 
                  borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' 
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <VStack>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>{t.symbol}</Text>
                      <HStack space="xs" className="items-center">
                        <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{t.type} • {t.volume || t.lots || '0.00'} Lots</Text>
                        <TouchableOpacity 
                            onPress={() => onOpenRecap(t)}
                            style={{ padding: 4, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 6 }}
                        >
                            <Edit3 size={10} color={isDark ? '#cbd5e1' : '#64748b'} />
                        </TouchableOpacity>
                      </HStack>
                    </VStack>
                    <VStack style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: (t.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                        {(t.profit || 0) >= 0 ? '+' : ''}${(t.profit || 0).toFixed(2)}
                      </Text>
                      <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>{t.setup || 'Auto'}</Text>
                    </VStack>
                  </View>
                  <View style={{ height: 1, backgroundColor: isDark ? '#334155' : '#f1f5f9', marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <VStack>
                      <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#64748b' }}>Session: {t.session || 'Unknown'}</Text>
                      <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#64748b' }}>Duration: {formatDuration(t.openTime || t.time, t.closeTime, t.duration)}</Text>
                    </VStack>
                    <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#64748b' }}>Time: {(t.time || t.openTime || "").split('T')[1]?.substring(0, 5)}</Text>
                  </View>
                </View>
              ))}
            </VStack>
          )}
        </View>
      )}
    </View>
  );
};

const HistoryScreen = React.memo(() => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [activeTab, setActiveTab] = useState<'JOURNAL' | 'CALENDAR'>('JOURNAL');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [journalData, setJournalData] = useState<{ notes: Record<string, string>, tags: string[], dailyTags: Record<string, string[]> }>({
    notes: {},
    tags: [],
    dailyTags: {}
  });
  
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false); // For manual journal entry
  const [isEditing, setIsEditing] = useState(false); // For manual journal entry
  const [form, setForm] = useState({ id: "", symbol: "EURUSD", type: "BUY", pnl: "", setup: "Breakout" }); // For manual journal entry

  // Share PnL Card State
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePeriod, setSharePeriod] = useState<PeriodKey>('monthly');
  const [shareMode, setShareMode] = useState<ModeKey>('detail');
  const [shareTheme, setShareTheme] = useState<ThemeKey>('dark');
  const [isSharing, setIsSharing] = useState(false);
  const [accountBalance, setAccountBalance] = useState(0);
  const [userName, setUserName] = useState('');
  const [shareTab, setShareTab] = useState<'period' | 'trade'>('period');
  const [selectedTrade, setSelectedTrade] = useState<any | null>(null);
  const cardRef = useRef<any>(null);
  const tradeCardRef = useRef<any>(null);

  const shareCard = async () => {
    const isTradeTab = shareTab === 'trade';
    const ref = isTradeTab ? tradeCardRef.current : cardRef.current;
    if (!ref) return;
    setIsSharing(true);
    try {
      const uri = await ref.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: isTradeTab ? 'Share Trade Card' : 'Share PnL Card' });
      }
    } catch (e) { console.error('Share error:', e); }
    finally { setIsSharing(false); }
  };

  // Trade Recap State
  const [recapModalVisible, setRecapModalVisible] = useState(false);
  const [selectedTradeForRecap, setSelectedTradeForRecap] = useState<any>(null);
  const [recapForm, setRecapForm] = useState({ setup: '', emotion: '', notes: '' });
  const [savingRecap, setSavingRecap] = useState(false);

  // Recap Settings State

  // Recap Settings State
  const [recapSettings, setRecapSettings] = useState({
    emotion_choices: ['Happy', 'Neutral', 'Anxious', 'FOMO', 'Calm'],
    setup_choices: ['Breakout', 'Retest', 'Reversal', 'News', 'Scalp', 'Systematic']
  });
  const [addingOption, setAddingOption] = useState<{ type: 'emotion' | 'setup', val: string } | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: 'emotion' | 'setup', index: number } | null>(null);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      
      // Fetch Trades
      const tradesRes = await fetch(`${API_URL}/mt5/trades`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tradesData = await tradesRes.json();
      if (tradesData.trades) setTrades(tradesData.trades);

      // Fetch user name and account balance for PnL card
      try {
        const [meRes, accRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/accounts`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const meData = await meRes.json();
        if (meData.name) setUserName(meData.name.split(' ')[0].toLowerCase());
        const accData = await accRes.json();
        const activeAcc = (accData.accounts || []).find((a: any) => a.isActive);
        if (activeAcc?.accountInfo?.balance) setAccountBalance(activeAcc.accountInfo.balance);
      } catch (_) {}

      // Fetch Journal
      const journalRes = await fetch(`${API_URL}/journal`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const jData = await journalRes.json();
      setJournalData(jData);

      // Fetch Settings (Recap Options)
      const settingsRes = await fetch(`${API_URL}/auth/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sData = await settingsRes.json();
      if (sData.recap_settings?.emotion_choices) {
        setRecapSettings({
          emotion_choices: sData.recap_settings.emotion_choices,
          setup_choices: sData.recap_settings.setup_choices || recapSettings.setup_choices
        });
      }

    } catch (e) {
      console.error("Error fetching history data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleDay = useCallback((day: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedDays(p => ({ ...p, [day]: !p[day] }));
  }, []);

  const saveNote = useCallback(async (day: string, text: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/journal/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day, text })
      });
      setJournalData((prev: any) => ({ ...prev, notes: { ...prev.notes, [day]: text } }));
    } catch (e) { console.error('Save note error:', e); }
  }, []);

  const toggleDailyTag = useCallback(async (day: string, tagName: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/journal/daily-tag/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ day, tag: tagName })
      });
      setJournalData((prev: any) => {
        const cur = prev.dailyTags[day] || [];
        const next = cur.includes(tagName) ? cur.filter((t: string) => t !== tagName) : [...cur, tagName];
        return { ...prev, dailyTags: { ...prev.dailyTags, [day]: next } };
      });
    } catch (e) { console.error('Toggle tag error:', e); }
  }, []);

  const addTag = useCallback(async (name: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/journal/tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      setJournalData((prev: any) => {
        if (prev.tags.includes(name)) return prev;
        return { ...prev, tags: [...prev.tags, name] };
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { console.error('Add tag error:', e); }
  }, []);

  const deleteTag = useCallback(async (name: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/journal/tag`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name })
      });
      setJournalData((prev: any) => ({
        ...prev,
        tags: prev.tags.filter((t: string) => t !== name),
        dailyTags: Object.fromEntries(
          Object.entries(prev.dailyTags).map(([day, tags]) => [day, (tags as string[]).filter(t => t !== name)])
        )
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { console.error('Delete tag error:', e); }
  }, []);

  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setRecapF = (k: string, v: any) => setRecapForm((p: any) => ({ ...p, [k]: v }));
  const lastSwapY = React.useRef(0);
  const activeDragIndex = React.useRef(-1);


  const handleOpenRecap = useCallback((trade: any) => {
    setSelectedTradeForRecap(trade);
    setRecapForm({
      setup: trade.setup || '',
      emotion: trade.emotion || '',
      notes: trade.notes || ''
    });
    setRecapModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSaveRecap = async () => {
    if (!selectedTradeForRecap) return;
    setSavingRecap(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const ticket = selectedTradeForRecap.ticket || selectedTradeForRecap.id;
      const res = await fetch(`${API_URL}/mt5/trades/${ticket}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(recapForm)
      });
      const data = await res.json();
      if (data.ok) {
        setTrades(prev => prev.map(t => (t.ticket === ticket || t.id === ticket) ? { 
          ...t, 
          ...recapForm,
          note: recapForm.notes, // Ensure local state 'note' matches 'notes'
          notes: recapForm.notes
        } : t));
        setRecapModalVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error("Recap error:", e);
    } finally {
      setSavingRecap(false);
    }
  };

  const saveRecapSettings = async (newSettings: any) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/auth/settings/recap`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });
    } catch (e) {
      console.error("Save settings error:", e);
    }
  };

  const addRecapOption = (type: 'emotion' | 'setup', val: string) => {
    if (!val.trim()) return;
    const key = type === 'emotion' ? 'emotion_choices' : 'setup_choices';
    const newList = [...(recapSettings as any)[key], val.trim()];
    const upd = { ...recapSettings, [key]: newList };
    setRecapSettings(upd);
    saveRecapSettings(upd);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const moveOption = (type: 'emotion' | 'setup', index: number, dir: 'up' | 'down') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    handleSwap(type, index, dir === 'up' ? index - 1 : index + 1);
  };

  const removeOption = (type: 'emotion' | 'setup', index: number) => {
    const key = type === 'emotion' ? 'emotion_choices' : 'setup_choices';
    const list = [...(recapSettings as any)[key]];
    list.splice(index, 1);
    const upd = { ...recapSettings, [key]: list };
    setRecapSettings(upd);
    saveRecapSettings(upd);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Simple Drag Logic via Swipe/Move
  const handleSwap = (type: 'emotion' | 'setup', from: number, to: number) => {
    if (to < 0 || to >= (recapSettings as any)[type === 'emotion' ? 'emotion_choices' : 'setup_choices'].length) return;
    const key = type === 'emotion' ? 'emotion_choices' : 'setup_choices';
    const list = [...(recapSettings as any)[key]];
    [list[from], list[to]] = [list[to], list[from]];
    const upd = { ...recapSettings, [key]: list };
    setRecapSettings(upd);
    saveRecapSettings(upd);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const [isEditingOptions, setIsEditingOptions] = useState(false);

  // Grouping logic
  const dailyGroups = useMemo(() => {
    const groups: Record<string, any> = {};
    const filtered = trades.filter((t: any) => {
      const matchesSearch = t.symbol?.toLowerCase().includes(search.toLowerCase()) || 
                           t.setup?.toLowerCase().includes(search.toLowerCase());
      
      if (!matchesSearch) return false;

      if (startDate || endDate) {
        const tradeDate = parseISO(t.time || t.openTime || "");
        const start = startDate ? startOfDay(startDate) : new Date(0);
        const end = endDate ? endOfDay(endDate) : new Date(8640000000000000);
        return isWithinInterval(tradeDate, { start, end });
      }

      return true;
    });

    filtered.forEach((trade: any) => {
      const dateKey = (trade.time || trade.openTime || "").split('T')[0];
      if (!dateKey) return;
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          trades: [],
          totalPnl: 0,
          wins: 0,
        };
      }
      groups[dateKey].trades.push(trade);
      groups[dateKey].totalPnl += (trade.profit || 0);
      if ((trade.profit || 0) > 0) groups[dateKey].wins++;
    });

    return Object.values(groups).sort((a: any, b: any) => b.date.localeCompare(a.date));
  }, [trades, search, startDate, endDate]);

  if (loading) {
    return (
      <MainLayout>
        <VStack className="flex-1 px-6 pt-6" space="md">
          {/* Tabs Skeleton */}
          <SkeletonRect width="100%" height={40} borderRadius={20} isDark={isDark} style={{ marginBottom: 20 }} />
          
          {/* Quick Filters Skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <SkeletonRect width={80} height={32} borderRadius={99} isDark={isDark} />
            <SkeletonRect width={80} height={32} borderRadius={99} isDark={isDark} />
            <SkeletonRect width={80} height={32} borderRadius={99} isDark={isDark} />
          </View>

          {/* List Scroll Skeleton */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ marginBottom: 16, backgroundColor: isDark ? '#0f172a' : '#fff', borderRadius: 28, padding: 16, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <SkeletonRect width={28} height={28} borderRadius={8} isDark={isDark} />
                    <View style={{ gap: 4 }}>
                      <SkeletonRect width={120} height={14} isDark={isDark} />
                      <SkeletonRect width={60} height={8} isDark={isDark} />
                    </View>
                  </View>
                  <SkeletonRect width={80} height={14} isDark={isDark} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <SkeletonRect width={110} height={56} borderRadius={8} isDark={isDark} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      {[1, 2, 3, 4, 5, 6].map(j => (
                        <View key={j} style={{ width: '33.33%', padding: 4 }}>
                          <SkeletonRect width={30} height={8} style={{ marginBottom: 4 }} isDark={isDark} />
                          <SkeletonRect width={40} height={12} isDark={isDark} />
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </VStack>
      </MainLayout>
    );
  }

  const inpStyle = {
    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
    borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13, marginBottom: 16
  };
  const lblStyle = { fontSize: 10, fontWeight: '900' as const, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 };

  return (
    <MainLayout>
      <VStack className="flex-1 px-6 pt-6" space="md">
        {/* Navigation Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 20, padding: 4, marginBottom: 20 }}>
          {(['JOURNAL', 'CALENDAR'] as const).map(t => {
            const isActive = activeTab === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(t); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 16, alignItems: 'center',
                  backgroundColor: isActive ? (isDark ? '#334155' : '#ffffff') : 'transparent',
                  shadowColor: '#000', shadowOpacity: isActive ? 0.05 : 0, shadowRadius: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: isActive ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#64748b' : '#94a3b8'), letterSpacing: 0.5 }}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Quick Date Filters + Share button */}
        {activeTab === 'JOURNAL' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
              style={{ flex: 1 }}
            >
              {[
                { label: 'All Time', action: () => { setStartDate(null); setEndDate(null); }, active: !startDate && !endDate },
                { label: 'Today', action: () => { setStartDate(new Date()); setEndDate(new Date()); }, active: (startDate && format(startDate, 'yyyyMMdd') === format(new Date(), 'yyyyMMdd')) },
                { label: 'Last 7 Days', action: () => { setStartDate(subDays(new Date(), 7)); setEndDate(new Date()); }, active: (startDate && format(startDate, 'yyyyMMdd') === format(subDays(new Date(), 7), 'yyyyMMdd')) },
                { label: 'This Month', action: () => { setStartDate(startOfMonth(new Date())); setEndDate(new Date()); }, active: (startDate && format(startDate, 'yyyyMMdd') === format(startOfMonth(new Date()), 'yyyyMMdd')) },
              ].map((item, i) => (
                <TouchableOpacity 
                  key={i}
                  onPress={() => { Haptics.selectionAsync(); item.action(); }}
                  style={{ 
                    paddingHorizontal: 16, 
                    height: 32,
                    borderRadius: 99, 
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.active ? '#6366f1' : (isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.06)'), 
                    borderWidth: 1, 
                    borderColor: item.active ? '#6366f1' : (isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)') 
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '900', color: item.active ? '#ffffff' : '#6366f1', letterSpacing: 0.3 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowShareModal(true); }}
              style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', borderWidth: 1, borderColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)', flexShrink: 0 }}
            >
              <Share2 size={14} color="#6366f1" />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'JOURNAL' && (startDate || endDate) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 6 }}>
            <HStack space="xs" className="items-center">
              <Calendar size={12} color="#6366f1" />
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#6366f1', letterSpacing: 0.2 }}>
                {startDate ? format(startDate, 'MMM d') : '...'} - {endDate ? format(endDate, 'MMM d, yyyy') : '...'}
              </Text>
            </HStack>
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStartDate(null); setEndDate(null); }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>Clear Filter</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'CALENDAR' ? (
          <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <CalendarView 
              calendarDate={calendarDate} 
              setCalendarDate={setCalendarDate} 
              trades={trades} 
              isDark={isDark} 
              onDayPress={(d: Date) => { setActiveTab('JOURNAL'); setSearch(""); setStartDate(d); setEndDate(d); }}
              onOpenRecap={handleOpenRecap}
            />
          </ScrollView>
        ) : (
          <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {dailyGroups.map((group: any, idx: number) => (
              <DailyGroupCard 
                key={group.date}
                group={group}
                isDark={isDark}
                isExp={expandedDays[group.date] ?? (idx === 0)}
                date={group.date}
                onToggleDay={toggleDay}
                journalData={journalData}
                saveNote={saveNote}
                toggleDailyTag={toggleDailyTag}
                addTag={addTag}
                deleteTag={deleteTag}
                onOpenRecap={handleOpenRecap}
              />
            ))}
          </ScrollView>
        )}
      </VStack>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
         <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
               <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>{isEditing ? 'Edit Trade' : 'Manual Journal'}</Text>
               <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 20 }}>
                  <X color={isDark ? '#94a3b8' : '#64748b'} size={20} />
               </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
               <Text style={lblStyle}>Symbol</Text>
               <TextInput style={inpStyle} value={form.symbol} onChangeText={t => setF("symbol", t)} placeholder="XAUUSD" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} />
               
               <Text style={lblStyle}>PnL ($)</Text>
               <TextInput style={inpStyle} value={form.pnl} onChangeText={t => setF("pnl", t)} placeholder="150.50" keyboardType="numeric" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} />
               
               <Text style={lblStyle}>Setup</Text>
               <TextInput style={inpStyle} value={form.setup} onChangeText={t => setF("setup", t)} placeholder="Breakout" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} />
               
               <TouchableOpacity activeOpacity={0.8} style={{ backgroundColor: '#3b82f6', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '900', textTransform: 'uppercase' }}>Save Trade</Text>
               </TouchableOpacity>
            </ScrollView>
         </View>
      </Modal>

      {/* Trade Recap Modal */}
      <Modal 
        visible={recapModalVisible} 
        animationType="slide" 
        presentationStyle="pageSheet" 
        onRequestClose={() => setRecapModalVisible(false)}
      >
         <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
               <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>Trade Recap</Text>
               <TouchableOpacity onPress={() => setRecapModalVisible(false)} style={{ padding: 4, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 20 }}>
                  <X color={isDark ? '#94a3b8' : '#64748b'} size={20} />
               </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
               {/* Customization Toggle */}
               <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
                 <TouchableOpacity 
                   onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsEditingOptions(!isEditingOptions); }}
                   style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: isEditingOptions ? '#6366f1' : 'transparent', borderRadius: 20, borderWidth: 1, borderColor: '#6366f1' }}
                 >
                   <PenTool size={12} color={isEditingOptions ? '#fff' : '#6366f1'} />
                   <Text style={{ fontSize: 10, fontWeight: '900', color: isEditingOptions ? '#fff' : '#6366f1' }}>{isEditingOptions ? 'DONE CUSTOMIZING' : 'CUSTOMIZE LIST'}</Text>
                 </TouchableOpacity>
               </View>

               {/* Trade Header Info */}
               <Box className="mb-6 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                  <HStack className="justify-between items-center">
                    <VStack>
                      <Text className="text-xl font-black text-slate-900 dark:text-white">{selectedTradeForRecap?.symbol}</Text>
                      <HStack space="xs" className="items-center">
                        <Box style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: selectedTradeForRecap?.type === 'BUY' ? '#10b981' : '#ef4444' }} />
                        <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {selectedTradeForRecap?.type} • {selectedTradeForRecap?.session || 'Unknown'}
                        </Text>
                      </HStack>
                    </VStack>
                    <VStack className="items-end">
                      <Text className={`text-xl font-black ${(selectedTradeForRecap?.profit || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {(selectedTradeForRecap?.profit || 0) >= 0 ? '+' : '-'}${Math.abs(selectedTradeForRecap?.profit || 0).toFixed(2)}
                      </Text>
                      <Text className="text-[10px] font-bold text-slate-400">{(selectedTradeForRecap?.time || selectedTradeForRecap?.openTime || "").split('T')[0]}</Text>
                    </VStack>
                  </HStack>
                </Box>

                {/* Emotion Selector */}
                <Text style={lblStyle}>Emotion</Text>
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: isEditingOptions ? 'column' : 'row', flexWrap: isEditingOptions ? 'nowrap' : 'wrap', gap: 10 }}>
                    {recapSettings.emotion_choices.map((emotion, idx) => (
                      <View key={`emotion-val-${emotion}`} style={{ width: isEditingOptions ? '100%' : 'auto' }}>
                          <TouchableOpacity
                            onLongPress={() => { if (!isEditingOptions) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsEditingOptions(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } }}
                            onPress={() => { if (!isEditingOptions) { Haptics.selectionAsync(); setRecapF('emotion', emotion); } }}
                            activeOpacity={0.8}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16,
                              backgroundColor: recapForm.emotion === emotion ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'),
                              flexDirection: 'row', alignItems: 'center', gap: 8,
                              borderWidth: 1, borderColor: recapForm.emotion === emotion ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0'),
                            }}
                          >
                            {isEditingOptions && idx > 0 && (
                              <TouchableOpacity onPress={() => moveOption('emotion', idx, 'up')} style={{ paddingHorizontal: 4 }}>
                                <ChevronUp size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                              </TouchableOpacity>
                            )}
                            <Smile size={16} color={recapForm.emotion === emotion ? '#fff' : (isDark ? '#94a3b8' : '#64748b')} />
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: recapForm.emotion === emotion ? '#fff' : (isDark ? '#cbd5e1' : '#1e293b') }}>{emotion}</Text>
                            
                            {isEditingOptions && (
                              <>
                                {idx < recapSettings.emotion_choices.length - 1 && (
                                  <TouchableOpacity onPress={() => moveOption('emotion', idx, 'down')} style={{ paddingHorizontal: 4 }}>
                                    <ChevronDown size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                                  </TouchableOpacity>
                                )}
                                <View style={{ width: 1, height: 16, backgroundColor: isDark ? '#334155' : '#cbd5e1', marginHorizontal: 4 }} />
                                <TouchableOpacity onPress={() => removeOption('emotion', idx)} style={{ backgroundColor: '#ef4444', borderRadius: 10, padding: 4 }}>
                                  <X size={10} color="#fff" />
                                </TouchableOpacity>
                              </>
                            )}
                          </TouchableOpacity>
                      </View>
                    ))}
                    
                    {!isEditingOptions && (
                      addingOption?.type === 'emotion' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#6366f1' }}>
                          <TextInput 
                            autoFocus
                            placeholder="Emotion..."
                            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                            style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#fff' : '#1e293b', width: 90, padding: 2 }}
                            value={addingOption.val}
                            onChangeText={(t) => setAddingOption({ ...addingOption, val: t })}
                            onSubmitEditing={() => { if (addingOption.val.trim()) { addRecapOption('emotion', addingOption.val.trim()); } setAddingOption(null); }}
                          />
                          <TouchableOpacity onPress={() => { if (addingOption.val.trim()) { addRecapOption('emotion', addingOption.val.trim()); } setAddingOption(null); }} style={{ padding: 4 }}>
                            <Plus size={14} color="#10b981" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setAddingOption(null)} style={{ padding: 4 }}>
                            <X size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => { setAddingOption({ type: 'emotion', val: '' }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          style={{
                            width: 44, height: 44, borderRadius: 22,
                            borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? '#334155' : '#cbd5e1',
                            alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Plus size={20} color={isDark ? '#475569' : '#94a3b8'} />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

                {/* Setup Selector */}
                <Text style={lblStyle}>Setup</Text>
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: isEditingOptions ? 'column' : 'row', flexWrap: isEditingOptions ? 'nowrap' : 'wrap', gap: 10 }}>
                    {recapSettings.setup_choices.map((s, idx) => (
                      <View key={`setup-val-${s}`} style={{ width: isEditingOptions ? '100%' : 'auto' }}>
                          <TouchableOpacity
                            onLongPress={() => { if (!isEditingOptions) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsEditingOptions(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } }}
                            onPress={() => { if (!isEditingOptions) { Haptics.selectionAsync(); setRecapF('setup', s); } }}
                            activeOpacity={0.8}
                            style={{
                              paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                              backgroundColor: recapForm.setup === s ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f0'),
                              borderWidth: 1, borderColor: recapForm.setup === s ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0'),
                              flexDirection: 'row', alignItems: 'center', gap: 8
                            }}
                          >
                            {isEditingOptions && idx > 0 && (
                              <TouchableOpacity onPress={() => moveOption('setup', idx, 'up')} style={{ paddingHorizontal: 4 }}>
                                <ChevronUp size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                              </TouchableOpacity>
                            )}
                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: recapForm.setup === s ? '#fff' : (isDark ? '#cbd5e1' : '#1e293b') }}>{s}</Text>
                            
                            {isEditingOptions && (
                              <>
                                {idx < recapSettings.setup_choices.length - 1 && (
                                  <TouchableOpacity onPress={() => moveOption('setup', idx, 'down')} style={{ paddingHorizontal: 4 }}>
                                    <ChevronDown size={14} color={isDark ? '#94a3b8' : '#64748b'} />
                                  </TouchableOpacity>
                                )}
                                <View style={{ width: 1, height: 16, backgroundColor: isDark ? '#334155' : '#cbd5e1', marginHorizontal: 4 }} />
                                <TouchableOpacity onPress={() => removeOption('setup', idx)} style={{ backgroundColor: '#ef4444', borderRadius: 10, padding: 4 }}>
                                  <X size={10} color="#fff" />
                                </TouchableOpacity>
                              </>
                            )}
                          </TouchableOpacity>
                      </View>
                    ))}

                    {!isEditingOptions && (
                      addingOption?.type === 'setup' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#6366f1' }}>
                          <TextInput 
                            autoFocus
                            placeholder="Setup..."
                            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                            style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#fff' : '#1e293b', width: 100, padding: 2 }}
                            value={addingOption.val}
                            onChangeText={(t) => setAddingOption({ ...addingOption, val: t })}
                            onSubmitEditing={() => { if (addingOption.val.trim()) { addRecapOption('setup', addingOption.val.trim()); } setAddingOption(null); }}
                          />
                          <TouchableOpacity onPress={() => { if (addingOption.val.trim()) { addRecapOption('setup', addingOption.val.trim()); } setAddingOption(null); }} style={{ padding: 4 }}>
                            <Plus size={14} color="#10b981" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setAddingOption(null)} style={{ padding: 4 }}>
                            <X size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => { setAddingOption({ type: 'setup', val: '' }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                          style={{
                            width: 44, height: 44, borderRadius: 12,
                            borderWidth: 2, borderStyle: 'dashed', borderColor: isDark ? '#334155' : '#cbd5e1',
                            alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Plus size={20} color={isDark ? '#475569' : '#94a3b8'} />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                </View>

               {/* Notes */}
               <HStack space="xs" className="items-center mb-2">
                 <MessageSquare size={12} color={isDark ? '#64748b' : '#94a3b8'} />
                 <Text style={[lblStyle, { marginBottom: 0 }]}>Trade Journal / Notes</Text>
               </HStack>
               <TextInput
                 multiline
                 placeholder="Share your thoughts on this execution..."
                 placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                 value={recapForm.notes}
                 onChangeText={(t) => setRecapF('notes', t)}
                 style={{
                   backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                   borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0',
                   borderRadius: 20, padding: 16, minHeight: 140,
                   color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13,
                   textAlignVertical: 'top', marginBottom: 40
                 }}
               />

               <TouchableOpacity 
                 disabled={savingRecap}
                 onPress={handleSaveRecap}
                 activeOpacity={0.8} 
                 style={{ 
                   backgroundColor: '#6366f1', 
                   paddingVertical: 20, 
                   borderRadius: 24, 
                   alignItems: 'center',
                   shadowColor: '#6366f1',
                   shadowOffset: { width: 0, height: 6 },
                   shadowOpacity: 0.4,
                   shadowRadius: 12,
                   elevation: 8,
                   marginBottom: 40
                 }}
               >
                  {savingRecap ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>Save Trade Recap</Text>}
               </TouchableOpacity>
            </ScrollView>
         </View>
      </Modal>

      {/* ── Share PnL Card Modal ─────────────────────────────────────────── */}
      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 }}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a' }}>Share Card</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}><X size={20} color={isDark ? '#64748b' : '#94a3b8'} /></TouchableOpacity>
            </View>

            {/* Tab Toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 14, padding: 4, marginHorizontal: 24, marginBottom: 20 }}>
              {[
                { key: 'period' as const, label: 'Period', icon: <BarChart2 size={13} color={shareTab === 'period' ? (isDark ? '#f8fafc' : '#0f172a') : '#64748b'} /> },
                { key: 'trade' as const, label: 'Single Trade', icon: <Crosshair size={13} color={shareTab === 'trade' ? (isDark ? '#f8fafc' : '#0f172a') : '#64748b'} /> },
              ].map(tab => (
                <TouchableOpacity key={tab.key} onPress={() => { Haptics.selectionAsync(); setShareTab(tab.key); setSelectedTrade(null); }}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, backgroundColor: shareTab === tab.key ? (isDark ? '#334155' : '#ffffff') : 'transparent' }}>
                  {tab.icon}
                  <Text style={{ fontSize: 12, fontWeight: '800', color: shareTab === tab.key ? (isDark ? '#f8fafc' : '#0f172a') : '#64748b' }}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              {shareTab === 'period' ? (
                <View style={{ paddingHorizontal: 24 }}>
                  {/* Period picker */}
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Period</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodKey[]).map(p => (
                      <TouchableOpacity key={p} onPress={() => { Haptics.selectionAsync(); setSharePeriod(p); }}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: sharePeriod === p ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'), borderWidth: 1, borderColor: sharePeriod === p ? '#6366f1' : (isDark ? '#334155' : '#e2e8f0') }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: sharePeriod === p ? '#fff' : (isDark ? '#94a3b8' : '#64748b'), textTransform: 'uppercase', letterSpacing: 0.5 }}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Content mode */}
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 }}>Content</Text>
                  <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 20 }}>
                    {([{ key: 'growth' as ModeKey, label: 'Growth Only' }, { key: 'detail' as ModeKey, label: 'Full Detail' }]).map(m => (
                      <TouchableOpacity key={m.key} onPress={() => { Haptics.selectionAsync(); setShareMode(m.key); }}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: shareMode === m.key ? (isDark ? '#334155' : '#ffffff') : 'transparent' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: shareMode === m.key ? (isDark ? '#f8fafc' : '#0f172a') : '#64748b' }}>{m.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* PnL Card carousel */}
                  <View style={{ marginHorizontal: -24, marginBottom: 24 }}>
                    <PnLCardCarousel ref={cardRef} trades={trades} period={sharePeriod} mode={shareMode} activeTheme={shareTheme} onThemeChange={t => setShareTheme(t)} accountBalance={accountBalance} userName={userName} />
                  </View>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 24 }}>
                  {/* Trade picker */}
                  {!selectedTrade ? (
                    <>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Select Trade (10 Recent)</Text>
                      {[...trades]
                        .sort((a, b) => (b.closeTime || b.openTime || '').localeCompare(a.closeTime || a.openTime || ''))
                        .slice(0, 10)
                        .map((t, i) => {
                          const tp = t.profit || 0;
                          const isP = tp >= 0;
                          const isL = (t.type || '').toLowerCase() === 'buy';
                          return (
                            <TouchableOpacity key={t.ticket || i} onPress={() => { Haptics.impactAsync(); setSelectedTrade(t); }}
                              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }}>
                              {/* Direction badge */}
                              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: isL ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                {isL ? <TrendingUp size={16} color="#10b981" /> : <TrendingDown size={16} color="#ef4444" />}
                              </View>
                              {/* Symbol + type */}
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a' }}>{t.symbol || '–'}</Text>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748b', marginTop: 1 }}>
                                  {isL ? 'Long' : 'Short'} · {(t.volume || t.lots || 0).toFixed(2)} lots · {t.closeTime ? format(new Date(t.closeTime), 'MMM d') : ''}
                                </Text>
                              </View>
                              {/* P&L */}
                              <Text style={{ fontSize: 14, fontWeight: '900', color: isP ? '#10b981' : '#ef4444' }}>
                                {isP ? '+' : ''}${tp.toFixed(2)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </>
                  ) : (
                    <>
                      {/* Back button */}
                      <TouchableOpacity onPress={() => setSelectedTrade(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <ChevronLeft size={14} color="#6366f1" />
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#6366f1' }}>Change Trade</Text>
                      </TouchableOpacity>
                      {/* Selected trade badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 12, padding: 10, marginBottom: 16, gap: 10 }}>
                        {(selectedTrade.type || '').toLowerCase() === 'buy'
                          ? <TrendingUp size={14} color="#10b981" />
                          : <TrendingDown size={14} color="#ef4444" />}
                        <Text style={{ fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13 }}>{selectedTrade.symbol}</Text>
                        <Text style={{ color: '#64748b', fontSize: 11, flex: 1 }}>
                          {selectedTrade.closeTime ? format(new Date(selectedTrade.closeTime), 'MMM d, yyyy') : ''}
                        </Text>
                        <Text style={{ fontWeight: '900', fontSize: 13, color: (selectedTrade.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                          {(selectedTrade.profit || 0) >= 0 ? '+' : ''}${(selectedTrade.profit || 0).toFixed(2)}
                        </Text>
                      </View>
                      {/* Trade card carousel */}
                      <View style={{ marginHorizontal: -24, marginBottom: 24 }}>
                        <TradeCardCarousel ref={tradeCardRef} trade={selectedTrade} activeTheme={shareTheme} onThemeChange={t => setShareTheme(t)} userName={userName} />
                      </View>
                    </>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Share button (always visible outside scroll) */}
            {(shareTab === 'period' || (shareTab === 'trade' && selectedTrade)) && (
              <View style={{ paddingHorizontal: 24 }}>
                <TouchableOpacity onPress={shareCard} disabled={isSharing}
                  style={{ backgroundColor: '#6366f1', borderRadius: 16, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  {isSharing ? <ActivityIndicator color="#fff" size="small" /> : <Share2 size={16} color="#fff" />}
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>{isSharing ? 'Preparing...' : 'Share Card'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </MainLayout>
  );
});

export default HistoryScreen;
