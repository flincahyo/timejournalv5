import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Animated, Dimensions, Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useColorScheme } from 'nativewind';
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, ChartCandlestick,
  Newspaper, Wifi, WifiOff, AlertTriangle, Clock, Layers, X,
  Wallet, Briefcase, ArrowUpRight, ArrowDownRight, Target, ShieldAlert
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BACKEND_URL, WS_URL, API_URL } from '../Constants';
import { SkeletonRect, SkeletonCircle } from '../components/Skeleton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtUsd = (val: number | undefined | null) => {
  if (val == null) return '--';
  const abs = Math.abs(val).toFixed(2);
  return val < 0 ? `-$${abs}` : `$${abs}`;
};

const fmtDuration = (ms: number) => {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'High': return '#ef4444';
    case 'Medium': return '#f59e0b';
    case 'Low': return '#64748b';
    default: return '#64748b';
  }
};

// ─── Mini pulsing dot for connection status ──────────────────────────────────
const LiveDot = ({ connected }: { connected: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (connected) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [connected]);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 14, height: 14 }}>
      {connected && (
        <Animated.View style={{
          position: 'absolute', width: 14, height: 14, borderRadius: 7,
          backgroundColor: '#10b981', opacity: 0.35, transform: [{ scale: pulse }]
        }} />
      )}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connected ? '#10b981' : '#ef4444' }} />
    </View>
  );
};

// ─── Country flag emoji map ───────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦',
  CHF: '🇨🇭', CNY: '🇨🇳', NZD: '🇳🇿', SEK: '🇸🇪', NOK: '🇳🇴', DKK: '🇩🇰',
  SGD: '🇸🇬', HKD: '🇭🇰', MXN: '🇲🇽', INR: '🇮🇳', BRL: '🇧🇷', ZAR: '🇿🇦',
  RUB: '🇷🇺', KRW: '🇰🇷', TRY: '🇹🇷', PLN: '🇵🇱', HUF: '🇭🇺', CZK: '🇨🇿',
  US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', AU: '🇦🇺', CA: '🇨🇦',
  CH: '🇨🇭', CN: '🇨🇳', NZ: '🇳🇿', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹',
  ES: '🇪🇸', SE: '🇸🇪', NO: '🇳🇴',
};
const getFlag = (country: string) => {
  if (!country) return '🌍';
  const upper = country.toUpperCase().trim();
  // Try full match first, then 2-char code
  return COUNTRY_FLAGS[upper] || COUNTRY_FLAGS[upper.slice(0, 2)] || '🌍';
};

// ─── TradingView symbol mapping ───────────────────────────────────────────────
const toTVSymbol = (sym: string) => {
  const s = sym.replace('/', '').toUpperCase();
  // Metals / Commodities via OANDA
  if (['XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD'].includes(s)) return `OANDA:${s}`;
  // Crypto via Binance
  if (s.endsWith('USDT') || s.endsWith('BTC') || ['BTCUSD', 'ETHUSD'].includes(s)) {
    const base = s.endsWith('USD') ? s.replace('USD', 'USDT') : s;
    return `BINANCE:${base}`;
  }
  // Indices
  if (['US30', 'US500', 'NAS100', 'GER40', 'UK100', 'JPN225'].includes(s)) return `FOREXCOM:${s}`;
  // Forex default
  return `FX:${s}`;
};

// ─── Chart Tab using TradingView lightweight widget via WebView ──────────────
const ChartTab = ({ isDark, symbol }: { isDark: boolean; symbol: string }) => {
  const tvSymbol = toTVSymbol(symbol);
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${isDark ? '#020617' : '#ffffff'}; overflow: hidden; }
    #tv_chart { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="tv_chart"></div>
  <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
  <script type="text/javascript">
    new TradingView.widget({
      autosize: true,
      symbol: "${tvSymbol}",
      interval: "5",
      timezone: "Asia/Jakarta",
      theme: "${isDark ? 'dark' : 'light'}",
      style: "1",
      locale: "en",
      toolbar_bg: "${isDark ? '#0f172a' : '#f8fafc'}",
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      container_id: "tv_chart",
      hide_side_toolbar: true,
      withdateranges: true,
      studies: ["RSI@tv-basicstudies"],
      overrides: {
        "paneProperties.backgroundType": "solid",
        "paneProperties.background": "${isDark ? '#020617' : '#ffffff'}",
        "scalesProperties.lineColor": "${isDark ? '#1e293b' : '#e2e8f0'}",
        "scalesProperties.textColor": "${isDark ? '#64748b' : '#94a3b8'}",
      }
    });
  </script>
</body>
</html>`;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ html }}
        style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#020617' : '#ffffff' }}>
            <ActivityIndicator color="#6366f1" size="large" />
            <Text style={{ marginTop: 12, fontSize: 12, color: '#64748b', fontFamily: 'Montserrat_400Regular' }}>Loading Chart...</Text>
          </View>
        )}
      />
    </View>
  );
};

// ─── Position Card (Minimalist) ────────────────────────────────────────────────
const PositionCard = ({ t, isDark }: { t: any; isDark: boolean }) => {
  const pnl = t.pnl ?? t.profit ?? 0;
  const isProfit = pnl >= 0;
  const isBuy = (t.type || '').toUpperCase().includes('BUY');
  const isPending = t.status === 'pending';
  
  const pnlColor = isPending ? '#f59e0b' : (isProfit ? '#10b981' : '#ef4444');
  const sideColor = isBuy ? '#3b82f6' : '#ef4444';
  const SideIcon = isBuy ? ArrowUpRight : ArrowDownRight;

  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
      borderRadius: 24, padding: 18, marginBottom: 14,
      borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.03, shadowRadius: 10, elevation: 2
    }}>
      {/* Top Row: Symbol & PnL */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: isBuy ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
            alignItems: 'center', justifyContent: 'center'
          }}>
             <SideIcon size={18} color={sideColor} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold', letterSpacing: -0.3 }}>
              {t.symbol}
            </Text>
            <Text style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {isBuy ? 'Buy ' : 'Sell '} <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{t.lots ?? t.volume ?? '--'}</Text>
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{
            fontSize: 18, fontWeight: '800',
            color: pnlColor,
            fontFamily: 'Montserrat_700Bold', letterSpacing: -0.5
          }}>
            {isPending ? 'Pending' : fmtUsd(pnl)}
          </Text>
          {!isPending && t.pips != null && (
            <Text style={{ fontSize: 11, fontWeight: '700', color: (t.pips >= 0) ? '#10b981' : '#ef4444' }}>
              {t.pips >= 0 ? '+' : ''}{t.pips?.toFixed(1)} pips
            </Text>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', marginBottom: 14 }} />

      {/* Middle & Bottom Info */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Price Match</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#94a3b8' : '#64748b', fontVariant: ['tabular-nums'] }}>
              {t.openPrice?.toFixed(5) ?? '--'}
            </Text>
            <Text style={{ fontSize: 12, color: isDark ? '#475569' : '#cbd5e1' }}>→</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a', fontVariant: ['tabular-nums'] }}>
              {(t.closePrice ?? t.currentPrice ?? 0)?.toFixed(5)}
            </Text>
          </View>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
               <ShieldAlert size={10} color={isDark ? '#ef4444' : '#ef4444'} />
               <Text style={{ fontSize: 11, color: isDark ? '#cbd5e1' : '#475569', fontWeight: '700', fontVariant: ['tabular-nums'] }}>{t.sl || '--'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
               <Target size={10} color={isDark ? '#10b981' : '#10b981'} />
               <Text style={{ fontSize: 11, color: isDark ? '#cbd5e1' : '#475569', fontWeight: '700', fontVariant: ['tabular-nums'] }}>{t.tp || '--'}</Text>
            </View>
          </View>
          
          {!isPending && t.durationMs != null && (
            <View style={{ width: 1, height: 24, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0' }} />
          )}
          
          {!isPending && t.durationMs != null && (
            <View style={{ alignItems: 'center' }}>
               <Clock size={12} color={isDark ? '#64748b' : '#94a3b8'} style={{ marginBottom: 4 }} />
               <Text style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', fontWeight: '700' }}>
                 {fmtDuration(t.durationMs)}
               </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TerminalScreen = React.memo(function TerminalScreen({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [chartVisible, setChartVisible] = useState(false);
  const [chartSymbol, setChartSymbol] = useState('XAUUSD');
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [liveTrades, setLiveTrades] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Animate the Chart Modal
  useEffect(() => {
    Animated.spring(slideY, { 
      toValue: chartVisible ? 0 : SCREEN_HEIGHT, 
      damping: 24, stiffness: 220, useNativeDriver: true 
    }).start();
  }, [chartVisible]);

  const SYMBOLS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD', 'USDCHF', 'AUDUSD', 'USDCAD'];

  // ── Data fetch helpers ─────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      if (!jwt) return;
      const res = await fetch(`${API_URL}/mt5/status`, { headers: { Authorization: `Bearer ${jwt}` } });
      const data = await res.json();
      setConnected(data.connected);
      setAccount(data.account);
    } catch (e) {
      console.error('Status error:', e);
    }
  }, []);

  const connectWS = useCallback(async () => {
    if (wsRef.current) wsRef.current.close();
    const jwt = await AsyncStorage.getItem('userToken');
    if (!jwt) return;

    wsRef.current = new WebSocket(`${WS_URL}/ws/mt5?token=${jwt}`);
    wsRef.current.onopen = () => setConnected(true);
    wsRef.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'account_update') setAccount(msg.account);
        else if (msg.type === 'live_trades') setLiveTrades(msg.trades || []);
        else if (msg.type === 'new_trade' && msg.trade) {
          setLiveTrades(prev => {
            const idx = prev.findIndex(t => t.ticket === msg.trade.ticket);
            if (idx >= 0) { const u = [...prev]; u[idx] = msg.trade; return u; }
            return [...prev, msg.trade];
          });
        }
      } catch (_) {}
    };
    wsRef.current.onclose = () => {
      setConnected(false);
      setTimeout(connectWS, 3000);
    };
  }, []);

  useEffect(() => {
    loadStatus();
    connectWS();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadStatus();
    setRefreshing(false);
  };

  const totalPnL = liveTrades.reduce((acc, t) => acc + (t.pnl ?? t.profit ?? 0), 0);
  const liveCount = liveTrades.filter(t => t.status !== 'pending').length;
  const pendingCount = liveTrades.filter(t => t.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>



      {/* ── Elegant Centered Header ────────────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28,
        backgroundColor: isDark ? '#020617' : '#ffffff',
      }}>
        {/* Top Actions Row: Connection dot + Refresh */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, paddingHorizontal: 0, position: 'relative' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, position: 'absolute', right: 0 }}>
            <LiveDot connected={connected} />
            <TouchableOpacity onPress={() => { Haptics.impactAsync(); loadStatus(); }} style={{ padding: 4 }}>
              <RefreshCw size={14} color={isDark ? '#475569' : '#94a3b8'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Huge Centered PNL */}
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {totalPnL >= 0 ? <TrendingUp size={14} color="#10b981" /> : <TrendingDown size={14} color="#ef4444" />}
            <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>
              Unrealized Float
            </Text>
          </View>
          <Text style={{ 
            fontSize: 44, fontWeight: '900', 
            color: totalPnL >= 0 ? '#10b981' : '#ef4444', 
            fontFamily: 'Montserrat_700Bold', letterSpacing: -2 
          }}>
            {fmtUsd(totalPnL)}
          </Text>
        </View>

        {/* Subtle Bottom Row: Balance & Equity */}
        {account && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Wallet size={12} color={isDark ? '#475569' : '#94a3b8'} />
                <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Balance</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold', letterSpacing: -0.2 }}>{fmtUsd(account.balance)}</Text>
            </View>
            <View style={{ width: 1, height: 24, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }} />
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Briefcase size={12} color={isDark ? '#475569' : '#94a3b8'} />
                <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>Equity</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold', letterSpacing: -0.2 }}>{fmtUsd(account.equity)}</Text>
            </View>
          </View>
        )}
      </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        >

          {!connected && liveTrades.length === 0 ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map(i => (
                <View key={i} style={{ backgroundColor: isDark ? 'rgba(15,23,42,0.8)' : '#ffffff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: isDark ? 'rgba(30,41,59,0.8)' : '#f1f5f9' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <SkeletonRect width={40} height={20} borderRadius={8} isDark={isDark} />
                      <SkeletonRect width={70} height={20} isDark={isDark} />
                    </View>
                    <SkeletonRect width={60} height={24} isDark={isDark} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(30,41,59,0.8)' : '#f1f5f9' }}>
                    <SkeletonRect width={50} height={24} isDark={isDark} />
                    <SkeletonRect width={60} height={24} isDark={isDark} />
                    <SkeletonRect width={80} height={24} isDark={isDark} />
                  </View>
                </View>
              ))}
            </View>
          ) : liveTrades.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 50, gap: 12 }}>
              <Layers size={36} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8' }}>No Active Positions</Text>
              <Text style={{ fontSize: 12, color: isDark ? '#475569' : '#94a3b8' }}>Market is idle</Text>
            </View>
          ) : (
            [...liveTrades]
              .sort((a, b) => (b.ticket || 0) - (a.ticket || 0))
              .map((t, idx) => <PositionCard key={t.ticket || t.id || idx} t={t} isDark={isDark} />)
          )}
        </ScrollView>

      {/* ── Floating Action Button (FAB) for Chart ──────────────────────── */}
      <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); setChartVisible(true); }}
        style={{
          position: 'absolute', bottom: 32, right: 24,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
          shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6
        }}
        activeOpacity={0.8}
      >
        <ChartCandlestick color="#ffffff" size={24} />
      </TouchableOpacity>

      {/* ── Chart Modal (Slide Up) ────────────────────────────────────────── */}
      <Modal visible={chartVisible} transparent animationType="none" onRequestClose={() => setChartVisible(false)}>
        <Animated.View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff', transform: [{ translateY: slideY }] }}>
          {/* Modal Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 56, paddingBottom: 16, paddingHorizontal: 24,
            borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9',
            backgroundColor: isDark ? '#020617' : '#ffffff',
          }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>
              Advanced Chart
            </Text>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setChartVisible(false); }} style={{ padding: 4 }}>
              <X size={24} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
          </View>

          {/* Symbol Selector */}
          <View style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SYMBOLS.map(sym => (
                <TouchableOpacity
                  key={sym}
                  onPress={() => { Haptics.selectionAsync(); setChartSymbol(sym); }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: chartSymbol === sym ? '#6366f1' : (isDark ? '#0f172a' : '#f1f5f9'),
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: chartSymbol === sym ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b') }}>
                    {sym}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Chart View */}
          <View style={{ flex: 1 }}>
            {chartVisible && <ChartTab key={chartSymbol} isDark={isDark} symbol={chartSymbol} />}
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
});

export default TerminalScreen;
