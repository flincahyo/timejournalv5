import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ScrollView, View, Text, ActivityIndicator, TouchableOpacity, Dimensions, Animated, LayoutAnimation
} from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  TrendingUp, TrendingDown, Target, Zap, Award, AlertTriangle,
  BarChart2, Calendar, Clock, Layers, ArrowUpRight, ArrowDownRight,
  RefreshCw, Activity, PieChart
} from 'lucide-react-native';
import { API_URL } from '../Constants';
import Svg, { Path, Line as SvgLine, Text as SvgText, Circle as SvgCircle } from 'react-native-svg';
import { Skeleton, SkeletonCircle, SkeletonRect } from '../components/Skeleton';
import AmbientGlow from '../components/AmbientGlow';

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
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity 
        activeOpacity={1} 
        onPressIn={onPressIn} 
        onPressOut={onPressOut}
        style={{
          flex: 1, backgroundColor: isDark ? C.surface.dark : C.surface.light,
          borderRadius: 20, padding: 16, borderWidth: 1,
          borderColor: isDark ? C.border.dark : C.border.light,
          shadowColor: color, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? C.text3.dark : C.text3.light, letterSpacing: 1 }}>
            {label.toUpperCase()}
          </Text>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: color + '15', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={14} color={color} strokeWidth={2.5} />
          </View>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.5, marginBottom: 2 }}>
          {value}
        </Text>
        {sub ? <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? C.text3.dark : C.text3.light }}>{sub}</Text> : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
function SectionHeader({ title, icon: Icon, isDark }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 4 }}>
      <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ACCENT + '15', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={ACCENT} strokeWidth={2.5} />
      </View>
      <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.3 }}>
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

// ── Composition Donut Chart ──────────────────────────────────────────────────
const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
  const rad = (angle - 90) * Math.PI / 180.0;
  return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
};

const createArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  if (Math.abs(endAngle - startAngle) >= 359.9) {
     return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r}`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

function DonutChart({ trades, isDark }: { trades: any[]; isDark: boolean }) {
  const [viewMode, setViewMode] = useState<'Wins' | 'Losses' | 'Net'>('Net');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    const wins: Record<string, number> = {};
    const losses: Record<string, number> = {};
    const net: Record<string, number> = {};
    trades.forEach(t => {
      const pnl = (t.profit || 0) + (t.swap || 0) + (t.commission || 0);
      const sym = t.symbol || 'Unknown';
      if (pnl > 0) wins[sym] = (wins[sym] || 0) + pnl;
      else if (pnl < 0) losses[sym] = (losses[sym] || 0) + Math.abs(pnl);
      net[sym] = (net[sym] || 0) + pnl;
    });

    const processData = (dict: Record<string, number>) => {
      const sorted = Object.entries(dict).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, 4);
      const rest = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
      if (rest > 0) top.push(['Others', rest]);
      return top.map(x => ({ symbol: x[0], value: x[1] }));
    };

    const processNetData = (dict: Record<string, number>) => {
      const sorted = Object.entries(dict).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      const top = sorted.slice(0, 4);
      const rest = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
      if (rest !== 0) top.push(['Others', rest]);
      return top.map(x => ({ symbol: x[0], value: x[1] }));
    };

    return { Wins: processData(wins), Losses: processData(losses), Net: processNetData(net) };
  }, [trades]);

  const currentData = data[viewMode];
  const displayTotal = currentData.reduce((sum, item) => sum + item.value, 0);
  const sliceTotal = currentData.reduce((sum, item) => sum + Math.abs(item.value), 0);

  const winColors = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#e0e7ff'];
  const lossColors = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#ffe4e6'];
  const colors = viewMode === 'Wins' ? winColors : lossColors;

  const radius = 55;
  const strokeWidth = 25;

  let currentAngle = 0;
  const slices = currentData.map((item, idx) => {
     const mag = Math.abs(item.value);
     const angle = sliceTotal > 0 ? (mag / sliceTotal) * 360 : 0;
     const startAngle = currentAngle;
     const endAngle = currentAngle + angle;
     currentAngle += angle;
     
     let color = colors[idx % colors.length];
     if (viewMode === 'Net') {
        color = item.value >= 0 ? winColors[idx % winColors.length] : lossColors[idx % lossColors.length];
     }
     
     return { ...item, startAngle, endAngle, color, percent: sliceTotal > 0 ? (mag / sliceTotal) * 100 : 0 };
  });

  const activeData = activeIdx !== null && slices[activeIdx] ? slices[activeIdx] : null;
  const surface = isDark ? '#13161f' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e8edf5';
  const text3 = isDark ? '#475569' : '#94a3b8';

  const formatMoney = (val: number) => {
     return (val >= 0 ? '' : '-') + '$' + Math.abs(val).toFixed(2);
  };

  return (
    <View style={{ backgroundColor: surface, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border, zIndex: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
         <SectionHeader title="Composition" icon={PieChart} isDark={isDark} />
         <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 12, padding: 4 }}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setViewMode('Net'); setActiveIdx(null); }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: viewMode === 'Net' ? (isDark ? '#334155' : '#cbd5e1') : 'transparent' }}>
               <Text style={{ fontSize: 11, fontWeight: '700', color: viewMode === 'Net' ? (isDark ? '#fff' : '#0f172a') : text3 }}>Net</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setViewMode('Wins'); setActiveIdx(null); }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: viewMode === 'Wins' ? '#6366f1' : 'transparent' }}>
               <Text style={{ fontSize: 11, fontWeight: '700', color: viewMode === 'Wins' ? '#fff' : text3 }}>Winning</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setViewMode('Losses'); setActiveIdx(null); }} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: viewMode === 'Losses' ? '#f43f5e' : 'transparent' }}>
               <Text style={{ fontSize: 11, fontWeight: '700', color: viewMode === 'Losses' ? '#fff' : text3 }}>Losing</Text>
            </TouchableOpacity>
         </View>
      </View>

      {sliceTotal === 0 ? (
        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
           <Text style={{ color: text3, fontSize: 12, fontWeight: '600' }}>No {viewMode.toLowerCase()} recorded.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 160 }}>
           <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Svg width={160} height={160}>
                 {slices.map((slice, idx) => {
                    const isActive = activeIdx === idx;
                    const r = isActive ? radius + 4 : radius;
                    return (
                       <Path 
                          key={idx} 
                          d={createArc(80, 80, r, slice.startAngle, slice.endAngle)} 
                          stroke={slice.color} 
                          strokeWidth={isActive ? strokeWidth + 4 : strokeWidth} 
                          fill="none" 
                          onPress={() => { Haptics.selectionAsync(); setActiveIdx(isActive ? null : idx); }}
                       />
                    )
                 })}
                 <SvgCircle cx={80} cy={80} r={radius - (strokeWidth / 2) - 2} fill={surface} />
              </Svg>

              <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                 <Text style={{ fontSize: 10, fontWeight: '700', color: text3, marginBottom: 2 }}>
                    {activeData ? activeData.symbol : 'Total'}
                 </Text>
                 <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a' }}>
                    {formatMoney(activeData ? activeData.value : displayTotal)}
                 </Text>
                 {activeData && (
                    <Text style={{ fontSize: 10, fontWeight: '800', color: activeData.color, marginTop: 2 }}>
                       {activeData.percent.toFixed(1)}%
                    </Text>
                 )}
              </View>
           </View>

           <View style={{ flex: 1, paddingLeft: 16, justifyContent: 'center', gap: 10 }}>
              {slices.map((slice, idx) => {
                 const isActive = activeIdx === idx;
                 return (
                    <TouchableOpacity 
                       key={idx} 
                       activeOpacity={0.7}
                       onPress={() => { Haptics.selectionAsync(); setActiveIdx(isActive ? null : idx); }}
                       style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: activeIdx === null || isActive ? 1 : 0.3 }}
                    >
                       <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, paddingRight: 4 }}>
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: slice.color, marginRight: 8 }} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' }} numberOfLines={1}>{slice.symbol}</Text>
                       </View>
                       <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#94a3b8' : '#64748b' }}>
                          {formatMoney(slice.value)}
                       </Text>
                    </TouchableOpacity>
                 )
              })}
           </View>
        </View>
      )}
    </View>
  );
}

// ── Performance Line Chart ───────────────────────────────────────────────────
const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#3b82f6'];

function PerformanceChart({ trades, isDark }: { trades: any[]; isDark: boolean }) {
  const [period, setPeriod] = useState('Month');
  const [touchX, setTouchX] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const allSymbols = useMemo(() => {
    const s = new Set<string>();
    trades.forEach(t => { if (t.symbol) s.add(t.symbol); });
    return Array.from(s).sort();
  }, [trades]);

  const [activeSymbols, setActiveSymbols] = useState<string[]>(['Total', ...(allSymbols.length > 0 ? Object.entries(trades.reduce((acc, t) => { if (t.symbol) acc[t.symbol] = (acc[t.symbol]||0)+1; return acc; }, {} as any)).sort((a:any, b:any)=>b[1]-a[1]).map(x=>x[0]).slice(0, 1) : [])]);

  const { chartData, minTotal, maxTotal, dates } = useMemo(() => {
    let now = new Date();
    let start = new Date();
    if (period === 'Day') start.setDate(now.getDate() - 1);
    else if (period === 'Week') start.setDate(now.getDate() - 7);
    else if (period === 'Month') start.setMonth(now.getMonth() - 1);
    else if (period === 'Year') start.setFullYear(now.getFullYear() - 1);

    const filtered = trades.filter(t => {
      const d = new Date(t.closeTime || t.openTime || 0);
      return period === 'All' ? true : (d >= start && d <= now);
    }).sort((a, b) => new Date(a.closeTime || a.openTime || 0).getTime() - new Date(b.closeTime || b.openTime || 0).getTime());

    const isDay = period === 'Day';
    const seriesData: Record<string, { total: number, [sym: string]: number }> = {};
    const runningCum: Record<string, number> = { Total: 0 };
    activeSymbols.forEach(s => { if (s !== 'Total') runningCum[s] = 0; });

    filtered.forEach(t => {
      const dt = new Date(t.closeTime || t.openTime || 0);
      const key = isDay ? dt.toISOString().substring(0, 13) + ':00' : dt.toISOString().split('T')[0];
      const pnl = (t.profit || 0) + (t.commission || 0) + (t.swap || 0);
      
      runningCum['Total'] += pnl;
      if (t.symbol && activeSymbols.includes(t.symbol)) {
         runningCum[t.symbol] += pnl;
      }
      
      seriesData[key] = { total: runningCum['Total'] };
      activeSymbols.forEach(s => {
         if (s !== 'Total') seriesData[key][s] = runningCum[s];
      });
    });

    const dts = Object.keys(seriesData).sort();
    if (dts.length === 0) {
      const k = isDay ? now.toISOString().substring(0, 13) + ':00' : now.toISOString().split('T')[0];
      dts.push(k);
      seriesData[k] = { total: 0 };
      activeSymbols.forEach(s => { if (s !== 'Total') seriesData[k][s] = 0; });
    }
    if (dts.length === 1) {
       dts.unshift('Start');
       seriesData['Start'] = { total: 0 };
       activeSymbols.forEach(s => { if (s !== 'Total') seriesData['Start'][s] = 0; });
    }

    let min = 0, max = 0;
    const finalData = dts.map(d => {
       const row = seriesData[d];
       activeSymbols.forEach(s => {
          const val = row[s === 'Total' ? 'total' : s] || 0;
          if (val > max) max = val;
          if (val < min) min = val;
       });
       return row;
    });
    
    if (min === max) { max += 10; min -= 10; }
    return { chartData: finalData, minTotal: min, maxTotal: max, dates: dts };
  }, [period, activeSymbols, trades]);

  const H = 220;
  const W_chart = W - 36;
  const paddingX = 10;
  const usableW = W_chart - paddingX * 2;
  const paddingY = 20;
  const usableH = H - paddingY * 2;
  const rangeY = (maxTotal - minTotal) || 1;

  const getX = (i: number) => paddingX + (i / (dates.length - 1)) * usableW;
  const getY = (val: number) => paddingY + usableH - ((val - minTotal) / rangeY) * usableH;

  const paths = activeSymbols.map((s, idx) => {
     let d = '';
     chartData.forEach((row, i) => {
        const val = row[s === 'Total' ? 'total' : s] || 0;
        const x = getX(i);
        const y = getY(val);
        if (i === 0) d += `M ${x} ${y}`;
        else d += ` L ${x} ${y}`;
     });
     return { symbol: s, d, color: s === 'Total' ? '#6366f1' : COLORS[idx % COLORS.length] };
  });

  const getClosestIndex = (tx: number) => {
     let minD = 9999;
     let minI = 0;
     for (let i = 0; i < dates.length; i++) {
        const d = Math.abs(getX(i) - tx);
        if (d < minD) { minD = d; minI = i; }
     }
     return minI;
  };

  const closestIdx = touchX !== null ? getClosestIndex(touchX) : null;
  const cursorX = closestIdx !== null ? getX(closestIdx) : 0;
  const surface = isDark ? C.surface.dark : C.surface.light;

  return (
    <View style={{ backgroundColor: surface, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: isDark ? C.border.dark : C.border.light, zIndex: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
         <SectionHeader title="Portfolio Performance" icon={TrendingUp} isDark={isDark} />
         <View style={{ flexDirection: 'row', gap: 6 }}>
            {['Day', 'Week', 'Month', 'Year'].map(p => {
               const isActive = period === p;
               return (
                  <TouchableOpacity key={p} onPress={() => { Haptics.selectionAsync(); setTouchX(null); setPeriod(p); }} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: isActive ? '#6366f120' : 'transparent' }}>
                     <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#6366f1' : (isDark ? C.text3.dark : C.text3.light) }}>{p}</Text>
                  </TouchableOpacity>
               );
            })}
         </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, zIndex: 50, position: 'relative' }}>
         <TouchableOpacity 
           activeOpacity={0.7}
           onPress={() => { Haptics.selectionAsync(); setShowDropdown(!showDropdown); }}
           style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }}>
            <Layers size={12} color={isDark ? C.text2.dark : C.text2.light} style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' }}>
              Select Symbols ({activeSymbols.length})
            </Text>
         </TouchableOpacity>

         <View style={{ flexDirection: 'row', gap: -4, marginLeft: 12 }}>
            {activeSymbols.map((s) => {
               const c = s === 'Total' ? '#6366f1' : COLORS[Math.max(0, allSymbols.indexOf(s)) % COLORS.length];
               return <View key={s} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, borderWidth: 1, borderColor: isDark ? C.surface.dark : C.surface.light }} />
            })}
         </View>

         {showDropdown && (
            <View style={{ position: 'absolute', top: 32, left: 0, backgroundColor: isDark ? '#1e293b' : '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', padding: 8, paddingHorizontal: 10, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, minWidth: 160 }}>
               {['Total', ...allSymbols].map((s, idx) => {
                  const isActive = activeSymbols.includes(s);
                  const color = s === 'Total' ? '#6366f1' : COLORS[Math.max(0, allSymbols.indexOf(s)) % COLORS.length];
                  return (
                    <TouchableOpacity 
                       key={s}
                       activeOpacity={0.7}
                       onPress={() => {
                          Haptics.selectionAsync();
                          if (isActive && activeSymbols.length > 1) {
                             setActiveSymbols(activeSymbols.filter(a => a !== s));
                          } else if (!isActive) {
                             if (activeSymbols.length >= 6) return;
                             setActiveSymbols([...activeSymbols, s]);
                          }
                       }}
                       style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                       <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: isActive ? color : (isDark ? '#475569' : '#cbd5e1'), backgroundColor: isActive ? color : 'transparent', marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                          {isActive && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />}
                       </View>
                       <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#f8fafc' : '#0f172a' }}>{s === 'Total' ? 'Total Portfolio' : s}</Text>
                    </TouchableOpacity>
                  )
               })}
            </View>
         )}
      </View>

      <View 
         style={{ height: H, position: 'relative' }}
         onTouchStart={(e) => { Haptics.selectionAsync(); setTouchX(e.nativeEvent.locationX); }}
         onTouchMove={(e) => setTouchX(e.nativeEvent.locationX)}
      >
         <Svg width="100%" height="100%">
            <SvgLine x1={0} y1={getY(0)} x2="100%" y2={getY(0)} stroke={isDark ? '#334155' : '#cbd5e1'} strokeWidth="1" strokeDasharray="4 4" />
            
            {paths.map(p => (
               <Path key={p.symbol} d={p.d} stroke={p.color} strokeWidth="2.5" fill="none" opacity={closestIdx !== null ? 0.3 : 1} />
            ))}

            {closestIdx !== null && (
               <SvgLine x1={cursorX} y1={0} x2={cursorX} y2={H} stroke={isDark ? '#cbd5e1' : '#475569'} strokeWidth="1" strokeDasharray="3 3" />
            )}
            
            {closestIdx !== null && activeSymbols.map((s) => {
               const val = chartData[closestIdx][s === 'Total' ? 'total' : s] || 0;
               return (
                  <SvgCircle key={s} cx={cursorX} cy={getY(val)} r="4" fill={paths.find(p=>p.symbol===s)?.color} stroke={isDark ? '#0f172a' : '#fff'} strokeWidth="2" />
               );
            })}
         </Svg>

         {closestIdx !== null && (
            <View pointerEvents="none" style={{ 
               position: 'absolute', 
               left: cursorX > W_chart / 2 ? undefined : Math.max(0, cursorX + 10),
               right: cursorX > W_chart / 2 ? Math.max(0, W_chart - cursorX + 10) : undefined,
               top: 0,
               backgroundColor: isDark ? '#1e293b' : '#ffffff',
               padding: 12, borderRadius: 12,
               borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0',
               shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
               zIndex: 30
            }}>
               <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#64748b' : '#94a3b8', marginBottom: 6 }}>
                  {dates[closestIdx] === 'Start' ? 'Start of Period' : (period === 'Day' ? dates[closestIdx].replace('T', ' ') : dates[closestIdx])}
               </Text>
               {activeSymbols.map(s => {
                  const val = chartData[closestIdx][s === 'Total' ? 'total' : s] || 0;
                  const c = paths.find(p=>p.symbol===s)?.color;
                  return (
                     <View key={s} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
                           <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a' }}>{s}</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: val >= 0 ? '#10b981' : '#ef4444' }}>
                           {val >= 0 ? '+' : ''}${val.toFixed(2)}
                        </Text>
                     </View>
                  )
               })}
            </View>
         )}
      </View>
    </View>
  );
}

// ── Equity Curve (Heatmap) ─────────────────────────────────────────────────────
function EquityCurve({ trades, isDark }: { trades: any[]; isDark: boolean }) {
  const [selectedDay, setSelectedDay] = useState<{ date: string; pnl: number; count: number } | null>(null);

  // Group trades by date
  const dailyData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number }> = {};
    let minDateStr = '9999-12-31';

    trades.forEach(t => {
      const p = (t.profit || 0) + (t.swap || 0) + (t.commission || 0);
      const d = (t.closeTime || t.openTime || '').split('T')[0] || (t.closeTime || t.openTime || '').split(' ')[0];
      if (!d) return;
      if (!map[d]) map[d] = { pnl: 0, count: 0 };
      map[d].pnl += p;
      map[d].count++;
      if (d < minDateStr) minDateStr = d;
    });
    return { map, minDateStr };
  }, [trades]);

  if (trades.length === 0) {
    return <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: isDark ? C.text3.dark : C.text3.light }}>Not enough data</Text></View>;
  }

  // Build calendar grid for exactly 52 weeks (1 year) ending today
  const grid = useMemo(() => {
     const end = new Date();
     const start = new Date(end);
     start.setDate(end.getDate() - (52 * 7)); // Roughly 1 year
     start.setDate(start.getDate() - start.getDay()); // adjust to Sunday

     const weeks: { days: { dateStr: string; dt: any }[], monthLabel?: string }[] = [];
     let curr = new Date(start);
     let lastMonth = -1;

     while (curr <= end) {
        const week = [];
        let monthLabel = undefined;
        for (let i = 0; i < 7; i++) {
           const y = curr.getFullYear();
           const m = String(curr.getMonth() + 1).padStart(2, '0');
           const d = String(curr.getDate()).padStart(2, '0');
           const dateStr = `${y}-${m}-${d}`;
           
           if (curr.getDate() <= 7 && lastMonth !== curr.getMonth() && i === 0) {
               monthLabel = curr.toLocaleString('default', { month: 'short' });
               lastMonth = curr.getMonth();
           }
           week.push({ dateStr, dt: dailyData.map[dateStr] || null });
           curr.setDate(curr.getDate() + 1);
        }
        weeks.push({ days: week, monthLabel });
     }
     return weeks;
  }, [dailyData]);

  // Find max/min for coloring
  let maxPos = 1;
  let maxNeg = 1;
  Object.values(dailyData.map).forEach(d => {
     if (d.pnl > 0 && d.pnl > maxPos) maxPos = d.pnl;
     if (d.pnl < 0 && Math.abs(d.pnl) > maxNeg) maxNeg = Math.abs(d.pnl);
  });

  const getColor = (pnl: number) => {
    if (pnl > 0) {
      const intensity = pnl / maxPos;
      if (intensity > 0.75) return '#5b21b6'; 
      if (intensity > 0.5) return '#7c3aed';
      if (intensity > 0.25) return '#8b5cf6';
      return '#a78bfa';
    } else if (pnl < 0) {
      const intensity = Math.abs(pnl) / maxNeg;
      if (intensity > 0.75) return '#9f1239';
      if (intensity > 0.5) return '#e11d48';
      if (intensity > 0.25) return '#fb7185';
      return '#fda4af';
    }
    return isDark ? '#1e293b' : '#f1f5f9';
  };

  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={{ overflow: 'visible', borderRadius: 8, marginTop: selectedDay !== null ? 20 : 0 }}>
      {selectedDay && (
        <View style={{ position: 'absolute', top: -45, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
          <View style={{ 
            backgroundColor: isDark ? '#1e293b' : '#ffffff', 
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, 
            borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', 
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, 
            alignItems: 'center' 
          }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a' }}>
              {selectedDay.date}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '800', color: selectedDay.pnl >= 0 ? '#8b5cf6' : '#ef4444', marginTop: 2 }}>
              {selectedDay.pnl >= 0 ? '+' : ''}${Math.abs(selectedDay.pnl).toFixed(2)}
            </Text>
            <Text style={{ fontSize: 9, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
              {selectedDay.count} trades
            </Text>
          </View>
        </View>
      )}
      
      <ScrollView 
        ref={scrollRef}
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={{ paddingVertical: 5, paddingRight: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {grid.map((week, wi) => (
             <View key={wi} style={{ flexDirection: 'column' }}>
                <View style={{ height: 14, marginBottom: 4 }}>
                   {week.monthLabel ? (
                     <Text style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', fontWeight: 'bold' }}>{week.monthLabel}</Text>
                   ) : null}
                </View>
                <View style={{ gap: 4 }}>
                   {week.days.map((day, di) => {
                      const pnl = day.dt?.pnl || 0;
                      const hasTrades = !!day.dt;
                      const isSelected = selectedDay?.date === day.dateStr;
                      return (
                         <TouchableOpacity 
                            key={di}
                            activeOpacity={0.7}
                            onPress={() => {
                               if (!hasTrades) return;
                               Haptics.selectionAsync();
                               LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                               if (isSelected) setSelectedDay(null);
                               else setSelectedDay({ date: day.dateStr, pnl, count: day.dt?.count || 0 });
                            }}
                            style={{
                               width: 14, height: 14, borderRadius: 4,
                               backgroundColor: hasTrades ? getColor(pnl) : (isDark ? '#1e293b' : '#f1f5f9'),
                               borderWidth: isSelected ? 1.5 : 0,
                               borderColor: isDark ? '#f8fafc' : '#0f172a',
                               opacity: isSelected ? 1 : 0.9
                            }}
                         />
                      )
                   })}
                </View>
             </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

// ── Main StatsScreen ───────────────────────────────────────────────────────────
const StatsScreen = React.memo(() => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

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
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView
        style={{ flex: 1 }}
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

      {/* ── Composition Donut Chart ───────────────────────────────────────────── */}
      <DonutChart trades={trades} isDark={isDark} />

      {/* ── Performance Chart ─────────────────────────────────────────────────── */}
      <PerformanceChart trades={trades} isDark={isDark} />

      {/* ── Equity Curve ──────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border, zIndex: 10 }}>
        <SectionHeader title="Equity distribution" icon={Activity} isDark={isDark} />
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
                <TouchableOpacity activeOpacity={0.6} onPress={() => Haptics.selectionAsync()} key={mk} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 60 }}>
                  <View style={{ width: '80%', height: h, borderRadius: 6, backgroundColor: isPos ? '#10b981' : '#ef4444', opacity: 0.9 }} />
                  <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? C.text3.dark : C.text3.light, marginTop: 5 }}>{mLabel}</Text>
                </TouchableOpacity>
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
      <View style={{ backgroundColor: card, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: border, zIndex: 5 }}>
        <SectionHeader title="Day of Week Performance" icon={Clock} isDark={isDark} />
        
        {/* Floating Tooltip for Day of Week */}
        {selectedDayIdx !== null && (
          <View style={{ position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center', zIndex: 10 }} pointerEvents="none">
            <View style={{ 
              backgroundColor: isDark ? '#1e293b' : '#ffffff', 
              paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, 
              borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0', 
              shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5, 
              alignItems: 'center' 
            }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a' }}>
                {days[selectedDayIdx].day}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: days[selectedDayIdx].pnl >= 0 ? '#10b981' : '#ef4444', marginTop: 2 }}>
                {days[selectedDayIdx].pnl >= 0 ? '+' : ''}${Math.abs(days[selectedDayIdx].pnl).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                {days[selectedDayIdx].count} trades recorded
              </Text>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 70, marginTop: selectedDayIdx !== null ? 10 : 0 }}>
            {days.map(({ day, pnl: dp, count }, idx) => {
            const isPos = dp >= 0;
            const h = count === 0 ? 3 : Math.max(4, (Math.abs(dp) / maxDayPnl) * 62);
            const isSelected = selectedDayIdx === idx;
            return (
              <TouchableOpacity 
                activeOpacity={1} 
                onPressIn={() => { 
                  Haptics.selectionAsync(); 
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSelectedDayIdx(idx); 
                }}
                onPressOut={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setSelectedDayIdx(null);
                }}
                key={day} 
                style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}
              >
                <View style={{ 
                  width: '85%', height: h, borderRadius: 6, 
                  backgroundColor: count === 0 ? (isDark ? '#1e293b' : '#e2e8f0') : (isSelected ? (isPos ? '#34d399' : '#f87171') : (isPos ? '#10b981' : '#ef4444')), 
                  opacity: count === 0 ? 0.4 : (isSelected ? 1 : 0.85) 
                }} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: isDark ? C.text3.dark : C.text3.light, marginTop: 5 }}>{day.substring(0, 2)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>
            Best: {[...days].sort((a, b) => b.pnl - a.pnl)[0]?.day || '—'}
          </Text>
          <Text style={{ fontSize: 10, color: isDark ? C.text3.dark : C.text3.light }}>
            Worst: {[...days].sort((a, b) => a.pnl - b.pnl)[0]?.day || '—'}
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
    </View>
  );
});

export default StatsScreen;
