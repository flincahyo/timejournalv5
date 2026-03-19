import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Animated, Dimensions
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useColorScheme } from 'nativewind';
import {
  TrendingUp, TrendingDown, Activity, RefreshCw, ChartCandlestick,
  Newspaper, Wifi, WifiOff, AlertTriangle, Clock, Layers
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BACKEND_URL, WS_URL, API_URL } from '../Constants';

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

// ─── Position Card ────────────────────────────────────────────────────────────
const PositionCard = ({ t, isDark }: { t: any; isDark: boolean }) => {
  const pnl = t.pnl ?? t.profit ?? 0;
  const isProfit = pnl >= 0;
  const isBuy = (t.type || '').toUpperCase().includes('BUY');
  const isPending = t.status === 'pending';

  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(15,23,42,0.8)' : '#ffffff',
      borderRadius: 24, padding: 20, marginBottom: 12,
      borderWidth: 1,
      borderColor: isPending
        ? 'rgba(245,158,11,0.15)'
        : (isProfit ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'),
      shadowColor: isProfit ? '#10b981' : '#ef4444',
      shadowOpacity: isPending ? 0 : 0.05, shadowRadius: 10,
    }}>
      {/* Row 1: Symbol + PnL */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
            backgroundColor: isBuy ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '900', color: isBuy ? '#3b82f6' : '#ef4444', letterSpacing: 1 }}>
              {isBuy ? 'BUY' : 'SELL'}
            </Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>
            {t.symbol}
          </Text>
          <Text style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8', fontWeight: 'bold' }}>
            {t.lots ?? t.volume ?? '--'} lots
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{
            fontSize: 16, fontWeight: '900',
            color: isPending ? '#f59e0b' : (isProfit ? '#10b981' : '#ef4444'),
            fontFamily: 'Montserrat_700Bold'
          }}>
            {isPending ? 'PENDING' : fmtUsd(pnl)}
          </Text>
          {!isPending && t.pips != null && (
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: (t.pips >= 0) ? '#10b981' : '#ef4444' }}>
              {t.pips >= 0 ? '+' : ''}{t.pips?.toFixed(1)} pips
            </Text>
          )}
        </View>
      </View>

      {/* Row 2: Prices */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between',
        paddingTop: 12, borderTopWidth: 1,
        borderTopColor: isDark ? 'rgba(30,41,59,0.8)' : '#f1f5f9'
      }}>
        <View>
          <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Entry</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#cbd5e1' : '#334155', fontVariant: ['tabular-nums'] }}>
            {t.openPrice?.toFixed(5) ?? '--'}
          </Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Market</Text>
          <Text style={{ fontSize: 13, fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a', fontVariant: ['tabular-nums'] }}>
            {(t.closePrice ?? t.currentPrice ?? 0)?.toFixed(5)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>SL</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#475569' }}>{t.sl || '--'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>TP</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#475569' }}>{t.tp || '--'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Duration row */}
      {!isPending && t.durationMs != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}>
          <Clock size={10} color={isDark ? '#475569' : '#94a3b8'} />
          <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8' }}>
            {fmtDuration(t.durationMs)} open · #{t.ticket}
          </Text>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TerminalScreen = React.memo(function TerminalScreen({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [tab, setTab] = useState<'chart' | 'positions' | 'news'>('positions');
  const [chartSymbol, setChartSymbol] = useState('XAUUSD');
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [liveTrades, setLiveTrades] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

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

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/news`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const todayStr = new Date().toDateString();
        const sorted = data
          .filter(e => e.impact !== 'Low' && new Date(e.date).toDateString() === todayStr)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setNews(sorted);
      }
    } catch (e) {
      console.error('News error:', e);
    } finally {
      setNewsLoading(false);
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
    fetchNews();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([loadStatus(), tab === 'news' ? fetchNews() : Promise.resolve()]);
    setRefreshing(false);
  };

  const totalPnL = liveTrades.reduce((acc, t) => acc + (t.pnl ?? t.profit ?? 0), 0);
  const liveCount = liveTrades.filter(t => t.status !== 'pending').length;
  const pendingCount = liveTrades.filter(t => t.status === 'pending').length;

  // ── Tab indicator ──────────────────────────────────────────────────────────
  const tabs = [
    { key: 'chart', label: 'Chart', icon: ChartCandlestick },
    { key: 'positions', label: 'Positions', icon: Layers, badge: liveCount > 0 ? liveCount : null },
    { key: 'news', label: 'News', icon: Newspaper },
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9',
        backgroundColor: isDark ? '#020617' : '#ffffff',
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 10, fontWeight: '900', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
              MT5 Bridge
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -0.5, fontFamily: 'Montserrat_700Bold' }}>
              Live Terminal
            </Text>
          </View>

          {/* Connection + refresh */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(); loadStatus(); }}
              style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: isDark ? '#0f172a' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={16} color={isDark ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              backgroundColor: connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              borderWidth: 1, borderColor: connected ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            }}>
              <LiveDot connected={connected} />
              <Text style={{ fontSize: 10, fontWeight: '900', color: connected ? '#10b981' : '#ef4444', letterSpacing: 1 }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Account Mini Stats */}
        {account && (
          <View style={{
            flexDirection: 'row', gap: 10,
          }}>
            {[
              { label: 'Balance', value: fmtUsd(account.balance), color: isDark ? '#f8fafc' : '#0f172a' },
              { label: 'Equity', value: fmtUsd(account.equity), color: isDark ? '#f8fafc' : '#0f172a' },
              { label: 'Float PnL', value: fmtUsd(totalPnL), color: totalPnL >= 0 ? '#10b981' : '#ef4444' },
            ].map(item => (
              <View key={item.label} style={{
                flex: 1, backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc',
                borderRadius: 16, padding: 12,
                borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e2e8f0',
              }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '900', color: item.color, fontFamily: 'Montserrat_700Bold' }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: isDark ? '#020617' : '#ffffff',
        paddingHorizontal: 20, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9',
        gap: 8,
      }}>
        {tabs.map(({ key, label, icon: Icon, badge }: any) => {
          const isActive = tab === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => { Haptics.selectionAsync(); setTab(key); }}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
                paddingVertical: 9, borderRadius: 16,
                backgroundColor: isActive ? '#6366f1' : (isDark ? 'rgba(15,23,42,0.6)' : '#f8fafc'),
                borderWidth: 1, borderColor: isActive ? '#6366f1' : (isDark ? '#1e293b' : '#e2e8f0'),
              }}
              activeOpacity={0.8}
            >
              <Icon size={13} color={isActive ? '#ffffff' : (isDark ? '#64748b' : '#94a3b8')} />
              <Text style={{ fontSize: 11, fontWeight: '900', color: isActive ? '#ffffff' : (isDark ? '#64748b' : '#94a3b8'), letterSpacing: 0.5 }}>
                {label}
              </Text>
              {badge != null && (
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#ffffff' }}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Chart Symbol selector (only on chart tab) ─────────────────────── */}
      {tab === 'chart' && (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SYMBOLS.map(sym => (
              <TouchableOpacity
                key={sym}
                onPress={() => { Haptics.selectionAsync(); setChartSymbol(sym); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
                  backgroundColor: chartSymbol === sym ? '#6366f1' : (isDark ? '#0f172a' : '#f1f5f9'),
                  borderWidth: 1, borderColor: chartSymbol === sym ? '#6366f1' : (isDark ? '#1e293b' : '#e2e8f0'),
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: chartSymbol === sym ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b') }}>
                  {sym}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      {tab === 'chart' && (
        <ChartTab key={chartSymbol} isDark={isDark} symbol={chartSymbol} />
      )}

      {tab === 'positions' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        >
          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'Active', value: liveCount, color: '#10b981' },
              { label: 'Pending', value: pendingCount, color: '#f59e0b' },
              { label: 'Float P&L', value: fmtUsd(totalPnL), color: totalPnL >= 0 ? '#10b981' : '#ef4444' },
            ].map(item => (
              <View key={item.label} style={{
                flex: 1, backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : '#ffffff',
                borderRadius: 18, padding: 14, borderWidth: 1,
                borderColor: isDark ? '#1e293b' : '#f1f5f9',
              }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '900', color: item.color }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {!connected && liveTrades.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 50, gap: 12 }}>
              <WifiOff size={36} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8' }}>Connecting to MT5 Bridge</Text>
              <ActivityIndicator color="#6366f1" />
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
      )}

      {tab === 'news' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>
            Today's High / Medium Impact Events
          </Text>

          {newsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator color="#6366f1" />
            </View>
          ) : news.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 50, gap: 12 }}>
              <Newspaper size={36} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8' }}>No Events Found</Text>
            </View>
          ) : (
            news.map((event, idx) => {
              const impactColor = getImpactColor(event.impact);
              const dt = new Date(event.date);
              const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
              const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const isToday = dt.toDateString() === new Date().toDateString();

              return (
                <View key={idx} style={{
                  backgroundColor: isDark ? 'rgba(15,23,42,0.7)' : '#ffffff',
                  borderRadius: 20, padding: 16, marginBottom: 10,
                  borderWidth: 1,
                  borderColor: event.impact === 'High'
                    ? 'rgba(239,68,68,0.15)'
                    : (isDark ? '#1e293b' : '#f1f5f9'),
                  flexDirection: 'row', gap: 12, alignItems: 'flex-start',
                }}>
                  {/* Impact bar */}
                  <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: impactColor, opacity: 0.7 }} />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', lineHeight: 18 }}>
                          {event.title}
                        </Text>
                      </View>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                        backgroundColor: impactColor + '20',
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: impactColor, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {event.impact}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 14 }}>{getFlag(event.country)}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#94a3b8' : '#64748b' }}>
                        {event.country}
                      </Text>
                      <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8' }}>
                        {isToday ? `Today ${timeStr}` : `${dateStr} ${timeStr}`}
                      </Text>
                      {event.forecast && (
                        <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8' }}>
                          F: {event.forecast}
                        </Text>
                      )}
                      {event.previous && (
                        <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8' }}>
                          P: {event.previous}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
});

export default TerminalScreen;
