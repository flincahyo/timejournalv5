import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ScrollView, View, Text, TouchableOpacity, ActivityIndicator,
  RefreshControl, Animated, Easing, Modal, Dimensions, Image
} from 'react-native';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Eye, EyeOff, TrendingUp, TrendingDown, Zap, RefreshCw, X, Brain, Sparkles, ChevronRight, Activity } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../Constants';
import { useMT5Sync } from '../hooks/useMT5Sync';
import { AILoadingAnimation } from '../components/AILoadingAnimation';
import * as Haptics from 'expo-haptics';
import { Skeleton, SkeletonCircle, SkeletonRect } from '../components/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Color Tokens ──────────────────────────────────────────────────────────────
const C = {
  accent: '#6366f1',
  accentDark: '#4f46e5',
  accentGlow: 'rgba(99,102,241,0.25)',
  green: '#10b981',
  red: '#ef4444',
  bg: { dark: '#0b0e11', light: '#f5f7fa' },
  surface: { dark: '#13161f', light: '#ffffff' },
  surface2: { dark: '#1c2030', light: '#f1f5f9' },
  border: { dark: '#1e293b', light: '#e8edf5' },
  text: { dark: '#f1f5f9', light: '#0f172a' },
  text2: { dark: '#94a3b8', light: '#64748b' },
  text3: { dark: '#475569', light: '#94a3b8' },
};

// ── AI Sparkling Button ───────────────────────────────────────────────────────
function SparklingButton({ onPress, loading }: { onPress: () => void, loading: boolean }) {
  const shimmer = useRef(new Animated.Value(-1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const runShimmer = () => {
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: -1, duration: 0, useNativeDriver: true }),
        Animated.delay(2200),
      ]).start(runShimmer);
    };
    runShimmer();
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ])).start();
  }, []);

  const tx = shimmer.interpolate({ inputRange: [-1, 1], outputRange: [-100, 100] });

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        onPress={onPress} disabled={loading} activeOpacity={0.8}
        style={{
          backgroundColor: C.accentDark, paddingHorizontal: 14, paddingVertical: 8,
          borderRadius: 24, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
          shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
        }}
      >
        <Animated.View style={{ position: 'absolute', inset: 0, transform: [{ translateX: tx }] }}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.28)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
        <Sparkles size={13} color="#fff" style={{ marginRight: 5 }} />
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>AI Analyst</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Animated Bell Button ──────────────────────────────────────────────────────
function BellButton({ onPress, hasUnread, isDark }: { onPress: () => void; hasUnread: boolean; isDark: boolean }) {
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasUnread) { swing.setValue(0); return; }
    const animate = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1,   duration: 100, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1,  duration: 100, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0.7, duration: 80,  easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(swing, { toValue: -0.7,duration: 80,  easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0,   duration: 80,  easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(2800),
      ])
    );
    animate.start();
    return () => animate.stop();
  }, [hasUnread]);

  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: 38, height: 38, borderRadius: 14,
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Bell size={18} color={isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8'} />
      </Animated.View>
      {hasUnread && (
        <View style={{
          position: 'absolute', top: 7, right: 7,
          width: 7, height: 7, borderRadius: 3.5,
          backgroundColor: '#ef4444',
        }} />
      )}
    </TouchableOpacity>
  );
}

// ── Waving Hand ───────────────────────────────────────────────────
function WavingHand() {
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wave = Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rot, { toValue: -0.5, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rot, { toValue: -0.5, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        // Pause between waves
        Animated.delay(2800),
      ])
    );
    wave.start();
    return () => wave.stop();
  }, []);

  const rotate = rot.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-25deg', '20deg'],
  });

  return (
    <Animated.Text style={{
      fontSize: 13,
      // Rotate from the wrist (bottom of emoji) via translate offset trick
      transform: [
        { translateX: 4 },
        { translateY: 2 },
        { rotate },
        { translateX: -4 },
        { translateY: -2 },
      ],
      display: 'flex',
    }}>
      👋
    </Animated.Text>
  );
}

// ── Avatar chip — shows photo or initials ────────────────────────────────────
function AvatarBadge({ name, image, size = 44, onPress }: { name: string, image?: string | null, size?: number, onPress?: () => void }) {
  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TR';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{
              width: size, height: size, borderRadius: size / 2,
              borderWidth: 2, borderColor: C.accent,
            }}
          />
        ) : (
          <LinearGradient
            colors={['#6366f1', '#8b5cf6']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: size, height: size, borderRadius: size / 2,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
              shadowColor: C.accent, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
            }}
          >
            <Text style={{ fontSize: size * 0.36, fontWeight: '900', color: '#fff' }}>{initials}</Text>
          </LinearGradient>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, positive, isDark }: any) {
  return (
    <View style={{
      flex: 1, backgroundColor: isDark ? C.surface.dark : C.surface.light,
      padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? C.border.dark : C.border.light,
    }}>
      <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? C.text3.dark : C.text3.light, letterSpacing: 1.2, marginBottom: 8 }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '900', color: positive === undefined ? (isDark ? C.text.dark : C.text.light) : positive ? C.green : C.red, letterSpacing: -0.5, marginBottom: 4 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light }}>{sub}</Text> : null}
    </View>
  );
}

// ── Hourly Performance ────────────────────────────────────────────────────────
function HourlyPerformance({ trades, isDark }: { trades: any[], isDark: boolean }) {
  const hourlyStats = React.useMemo(() => {
    const map: Record<string, { pnl: number, wins: number, total: number }> = {};
    trades.forEach(t => {
      const pnl = Number(t.profit || 0) + Number(t.swap || 0) + Number(t.commission || 0);
      const timeStr = t.openTime || t.time;
      if (!timeStr) return;
      try {
        const normalized = timeStr.includes(' ') && !timeStr.includes('T') ? timeStr.replace(' ', 'T') : timeStr;
        const hr = new Date(normalized).getHours();
        const key = `${hr.toString().padStart(2, '0')}:00`;
        if (!map[key]) map[key] = { pnl: 0, wins: 0, total: 0 };
        map[key].pnl += pnl;
        map[key].total++;
        if (pnl > 0) map[key].wins++;
      } catch (_) {}
    });
    return Object.entries(map)
      .map(([hour, d]) => ({ hour, pnl: d.pnl, winPct: Math.round((d.wins / d.total) * 100), isWin: d.pnl >= 0 }))
      .sort((a, b) => b.hour.localeCompare(a.hour))
      .slice(0, 8);
  }, [trades]);

  if (hourlyStats.length === 0) return null;

  return (
    <View style={{ backgroundColor: isDark ? C.surface.dark : C.surface.light, borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: isDark ? C.border.dark : C.border.light }}>
      <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, marginBottom: 14 }}>Hourly Performance</Text>
      {hourlyStats.map((h, i) => (
        <View key={h.hour} style={{ marginBottom: i < hourlyStats.length - 1 ? 12 : 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light }}>{h.hour}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: h.isWin ? C.green : C.red }}>
                {h.isWin ? '+' : '-'}${Math.abs(h.pnl).toFixed(2)}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? C.text3.dark : C.text3.light }}>{h.winPct}% Win</Text>
            </View>
          </View>
          <View style={{ height: 4, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${h.winPct}%`, backgroundColor: h.isWin ? C.green : C.red, borderRadius: 2 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Skeleton Loader for HomeScreen ───────────────────────────────────────────
function HomeScreenSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? C.bg.dark : C.bg.light }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header Skeleton */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SkeletonCircle size={46} isDark={isDark} />
              <View style={{ gap: 4 }}>
                <SkeletonRect width={80} height={10} isDark={isDark} />
                <SkeletonRect width={120} height={16} isDark={isDark} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SkeletonRect width={90} height={34} borderRadius={24} isDark={isDark} />
              <SkeletonCircle size={38} isDark={isDark} />
            </View>
          </View>

          {/* Balance Card Skeleton */}
          <View style={{
            backgroundColor: isDark ? C.surface.dark : '#ffffff',
            borderRadius: 24, padding: 22,
            borderWidth: 1, borderColor: isDark ? C.border.dark : '#e8edf5',
          }}>
            <SkeletonRect width={100} height={10} style={{ marginBottom: 12 }} isDark={isDark} />
            <SkeletonRect width={200} height={40} style={{ marginBottom: 12 }} isDark={isDark} />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <SkeletonRect width={60} height={10} isDark={isDark} />
              <SkeletonRect width={60} height={10} isDark={isDark} />
            </View>
          </View>
        </View>

        {/* Content Area Skeleton */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <SkeletonRect width="48%" height={80} borderRadius={20} isDark={isDark} />
            <SkeletonRect width="48%" height={80} borderRadius={20} isDark={isDark} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            <SkeletonRect width="48%" height={80} borderRadius={20} isDark={isDark} />
            <SkeletonRect width="48%" height={80} borderRadius={20} isDark={isDark} />
          </View>

          <SkeletonRect width={120} height={14} style={{ marginBottom: 12 }} isDark={isDark} />
          <View style={{ backgroundColor: isDark ? C.surface.dark : '#ffffff', borderRadius: 24, borderWidth: 1, borderColor: isDark ? C.border.dark : '#e8edf5', padding: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i < 4 ? 16 : 0 }}>
                <SkeletonCircle size={36} isDark={isDark} style={{ marginRight: 12 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <SkeletonRect width={100} height={12} isDark={isDark} />
                  <SkeletonRect width={80} height={8} isDark={isDark} />
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <SkeletonRect width={60} height={12} isDark={isDark} />
                  <SkeletonRect width={40} height={8} isDark={isDark} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Main HomeScreen ───────────────────────────────────────────────────────────
const HomeScreen = React.memo(({ onNavigate, onOpenSettings, user: userProp, unreadNotifications = 0 }: {
  onNavigate: (s: string) => void,
  onOpenSettings: () => void,
  user?: any,
  unreadNotifications?: number,
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const D = (k: keyof typeof C.bg) => k;
  const mode = isDark ? 'dark' : 'light';

  const { isConnected, account: accountInfo, trades, loading, refresh } = useMT5Sync();
  const [refreshing, setRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  // Use shared user from parent (App.tsx) — falls back to local fetch if not provided yet
  const [localUser, setLocalUser] = useState<any>(null);
  const user = userProp ?? localUser;
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);

  useEffect(() => {
    // Only fetch locally if parent hasn't provided user yet
    if (!userProp) fetchUser();
  }, [userProp]);

  const fetchUser = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLocalUser(data);
    } catch (e) {
      console.error('Fetch user error:', e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }, [refresh]);

  const stats = useMemo(() => {
    let growth = '0.0';
    if (accountInfo?.deposit && accountInfo.deposit > 0) {
      growth = (((accountInfo.balance - accountInfo.deposit) / accountInfo.deposit) * 100).toFixed(1);
    }
    if (trades.length === 0) return { totalPnl: 0, wins: 0, losses: 0, winRate: 0, profitFactor: 0, growth, todayPnl: 0, todayTrades: 0 };

    let totalPnl = 0, wins = 0, losses = 0, totalWinP = 0, totalLossP = 0, todayPnl = 0, todayTrades = 0;
    const todayStr = new Date().toDateString();

    trades.forEach(t => {
      const pnl = Number(t.profit || 0) + Number(t.swap || 0) + Number(t.commission || 0);
      totalPnl += pnl;
      pnl > 0 ? (wins++, totalWinP += pnl) : (losses++, totalLossP += Math.abs(pnl));

      const closeTime = t.closeTime || t.time;
      if (closeTime) {
        try {
          const normalized = closeTime.includes(' ') && !closeTime.includes('T') ? closeTime.replace(' ', 'T') : closeTime;
          if (new Date(normalized).toDateString() === todayStr) { todayPnl += pnl; todayTrades++; }
        } catch (e) { }
      }
    });

    const winRate = (wins / (trades.length || 1)) * 100;
    const profitFactor = totalLossP === 0 ? totalWinP : totalWinP / totalLossP;

    if (growth === '0.0' && accountInfo && totalPnl !== 0) {
      const startBal = (accountInfo.balance || 0) - totalPnl;
      if (startBal > 0) growth = ((totalPnl / startBal) * 100).toFixed(1);
    }

    return { totalPnl, wins, losses, winRate, profitFactor, growth, todayPnl, todayTrades };
  }, [trades, accountInfo]);

  const handleAIAnalyze = useCallback(async () => {
    if (trades.length === 0) { setShowAIModal(true); setAiInsight("No trade data found. Sync your MT5 account first."); return; }
    setShowAIModal(true); setIsGeneratingAI(true); setAiInsight(null);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const recent = trades.slice(0, 10);
      const recentWins = recent.filter(t => (t.profit || 0) > 0).length;
      const payload = {
        totalTrades: trades.length, winRate: stats.winRate, totalPnl: stats.totalPnl,
        bestSymbol: 'N/A', worstSymbol: 'N/A',
        recentStreaks: `${recentWins} wins out of last ${recent.length} trades.`,
        notes: `Growth: ${stats.growth}%. PF: ${stats.profitFactor.toFixed(2)}.`
      };
      const res = await fetch(`${API_URL}/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setAiInsight(data.success ? data.insight : "AI Analyst unavailable. Check backend API key.");
    } catch (err) {
      setAiInsight("Connection error. Please try again.");
    } finally {
      setIsGeneratingAI(false);
    }
  }, [trades, stats]);

  if (loading) {
    return <HomeScreenSkeleton isDark={isDark} />;
  }

  const balance = accountInfo?.balance ?? 0;
  const equity = accountInfo?.equity ?? 0;
  const formattedBalance = hideBalance ? '••••••••' : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formattedEquity = hideBalance ? '••••' : `$${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const growthNum = parseFloat(stats.growth);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? C.bg.dark : C.bg.light }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 }}>
          {/* Row: avatar + greeting + actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <AvatarBadge name={user?.name || 'Trader'} image={user?.image} size={46} onPress={onOpenSettings} />
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light, letterSpacing: 0.5 }}>{(() => { const h = new Date().getHours(); return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night'; })()}</Text>
                  <WavingHand />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.3 }}>{(user?.name || 'Trader').split(' ')[0]}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SparklingButton onPress={handleAIAnalyze} loading={isGeneratingAI} />
              <BellButton
                onPress={() => onNavigate('notifications')}
                hasUnread={unreadNotifications > 0}
                isDark={isDark}
              />
            </View>
          </View>

          {/* Account Balance Card */}
          <View style={{
            backgroundColor: isDark ? C.surface.dark : '#ffffff',
            borderRadius: 24, padding: 22,
            borderWidth: 1, borderColor: isDark ? C.border.dark : '#e8edf5',
            shadowColor: C.accent, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light, letterSpacing: 1 }}>ACCOUNT BALANCE</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isConnected ? '#10b981' : '#f59e0b' }} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: isConnected ? '#10b981' : '#f59e0b' }}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 34, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -1, flex: 1 }}>{formattedBalance}</Text>
              <TouchableOpacity onPress={() => setHideBalance(!hideBalance)} style={{ padding: 6 }}>
                {hideBalance ? <Eye size={20} color={isDark ? C.text2.dark : C.text2.light} /> : <EyeOff size={20} color={isDark ? C.text2.dark : C.text2.light} />}
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light }}>Equity</Text>
                <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? C.text.dark : C.text.light }}>{formattedEquity}</Text>
              </View>
              <View style={{ width: 1, height: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {growthNum >= 0 ? <TrendingUp size={13} color="#10b981" /> : <TrendingDown size={13} color="#ef4444" />}
                <Text style={{ fontSize: 11, fontWeight: '900', color: growthNum >= 0 ? '#10b981' : '#ef4444' }}>
                  {growthNum >= 0 ? '+' : ''}{stats.growth}%
                </Text>
              </View>
              {accountInfo?.name && (
                <>
                  <View style={{ width: 1, height: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0' }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light }}>{accountInfo.name}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Content Area ─────────────────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20 }}>

          {/* Quick Stats Row */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            <StatCard label="TODAY'S P&L" value={`${stats.todayPnl >= 0 ? '+' : '-'}$${Math.abs(stats.todayPnl).toFixed(2)}`} sub={`${stats.todayTrades} trades`} positive={stats.todayPnl >= 0} isDark={isDark} />
            <StatCard label="TOTAL P&L" value={`${stats.totalPnl >= 0 ? '+' : '-'}$${Math.abs(stats.totalPnl).toFixed(2)}`} sub={`${stats.wins}W / ${stats.losses}L`} positive={stats.totalPnl >= 0} isDark={isDark} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            <StatCard label="WIN RATE" value={`${stats.winRate.toFixed(1)}%`} sub={`${trades.length} total trades`} isDark={isDark} />
            <StatCard label="PROFIT FACTOR" value={`${stats.profitFactor.toFixed(2)}x`} sub={stats.profitFactor >= 1.5 ? '🟢 Strong' : '🟡 Healthy'} isDark={isDark} />
          </View>

          {/* ── My Journals shortcut ────────────────────────────────────────────── */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.3 }}>Recent Trades</Text>
              <TouchableOpacity onPress={() => onNavigate('tracker')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.accent }}>See all</Text>
                <ChevronRight size={14} color={C.accent} />
              </TouchableOpacity>
            </View>

            {trades.length === 0 ? (
              <View style={{ backgroundColor: isDark ? C.surface.dark : C.surface.light, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: isDark ? C.border.dark : C.border.light }}>
                <Activity size={28} color={isDark ? C.text3.dark : C.text3.light} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light, marginTop: 10, textAlign: 'center' }}>No trades yet</Text>
                <Text style={{ fontSize: 11, fontWeight: '500', color: isDark ? C.text3.dark : C.text3.light, marginTop: 4, textAlign: 'center' }}>Connect your MT5 account to see your trades here</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: isDark ? C.surface.dark : C.surface.light, borderRadius: 24, borderWidth: 1, borderColor: isDark ? C.border.dark : C.border.light, overflow: 'hidden' }}>
                {trades.slice(0, 6).map((trade: any, i: number) => {
                  const pnl = Number(trade.profit || 0) + Number(trade.swap || 0) + Number(trade.commission || 0);
                  const isPos = pnl >= 0;
                  const timeStr = trade.closeTime || trade.time || '';
                  let timeLabel = '';
                  try {
                    const normalized = timeStr.includes(' ') && !timeStr.includes('T') ? timeStr.replace(' ', 'T') : timeStr;
                    const d = new Date(normalized);
                    timeLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  } catch (e) { }

                  return (
                    <View key={`${trade.ticket}-${i}`} style={{
                      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14,
                      borderBottomWidth: i < Math.min(trades.length, 6) - 1 ? 1 : 0,
                      borderBottomColor: isDark ? C.border.dark : C.border.light
                    }}>
                      <View style={{
                        width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isPos ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                        marginRight: 12,
                      }}>
                        {isPos ? <TrendingUp size={16} color={C.green} /> : <TrendingDown size={16} color={C.red} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? C.text.dark : C.text.light }}>{trade.symbol}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: isDark ? C.text3.dark : C.text3.light, marginTop: 1 }}>
                          {timeLabel}{trade.openPrice ? ` · @${Number(trade.openPrice).toFixed(trade.symbol?.includes('JPY') ? 3 : 5)}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: isPos ? C.green : C.red }}>{isPos ? '+' : '-'}${Math.abs(pnl).toFixed(2)}</Text>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? C.text3.dark : C.text3.light, marginTop: 1 }}>{(trade.type || 'BUY').toUpperCase()} · {trade.lots ?? trade.volume ?? '—'} lot</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ── Session & Hourly Overview ──────────────────────────────────── */}
          {trades.length > 0 && (
            <>
              <View style={{ backgroundColor: isDark ? C.surface.dark : C.surface.light, borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: isDark ? C.border.dark : C.border.light }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, marginBottom: 14 }}>Session Overview</Text>
                {['London', 'New York', 'Overlap LN+NY', 'Tokyo', 'Sydney'].map((session) => {
                  // Match stored session names (case-insensitive contains)
                  const count = trades.filter((t: any) => {
                    const s = (t.session || '').toLowerCase();
                    if (session === 'Overlap LN+NY') return s.includes('overlap') || s === 'overlap ln+ny';
                    return s === session.toLowerCase();
                  }).length;
                  const pct = trades.length > 0 ? Math.round((count / trades.length) * 100) : 0;
                  const colors: Record<string, string> = {
                    'London': '#3b82f6',
                    'New York': '#f59e0b',
                    'Overlap LN+NY': '#8b5cf6',
                    'Tokyo': '#10b981',
                    'Sydney': '#f97316',
                  };
                  return (
                    <View key={session} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors[session] }} />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? C.text2.dark : C.text2.light }}>{session}</Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? C.text.dark : C.text.light }}>{count} · {pct}%</Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors[session], borderRadius: 2 }} />
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* ── Hourly Performance ──────────────────────────────────────── */}
              <HourlyPerformance trades={trades} isDark={isDark} />
            </>
          )}
        </View>
      </ScrollView>

      {/* ── AI Modal ──────────────────────────────────────────────────────────── */}
      <Modal visible={showAIModal} animationType="slide" transparent onRequestClose={() => setShowAIModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
          <View style={{ height: '85%', backgroundColor: isDark ? '#0b0e11' : '#fff', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={22} color="#fff" />
                </LinearGradient>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: isDark ? C.text.dark : C.text.light }}>AI Trading Intelligence</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Psychological & Technical Audit</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAIModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color={isDark ? C.text2.dark : C.text2.light} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {isGeneratingAI ? (
                <AILoadingAnimation isDark={isDark} message="Dissecting Performance..." subMessage="Evaluating win rate, drawdown, and psychological streaks." />
              ) : aiInsight ? (
                <View>
                  <View style={{ backgroundColor: isDark ? C.surface.dark : '#f8fafc', padding: 20, borderRadius: 24, borderLeftWidth: 4, borderLeftColor: C.accent }}>
                    {aiInsight.split('\n').map((line, idx) => {
                      const isBold = line.startsWith('**') || line.trim().endsWith('**');
                      const clean = line.replace(/\*\*/g, '').replace(/^- /, '• ');
                      if (!clean.trim()) return <View key={idx} style={{ height: 10 }} />;
                      return (
                        <Text key={idx} style={{ fontSize: isBold ? 14 : 13, fontWeight: isBold ? '900' : '500', color: isBold ? (isDark ? '#fff' : '#0f172a') : (isDark ? '#cbd5e1' : '#475569'), lineHeight: 22, marginBottom: isBold ? 8 : 4, marginTop: isBold ? 12 : 0 }}>{clean}</Text>
                      );
                    })}
                  </View>
                  <TouchableOpacity onPress={handleAIAnalyze} style={{ marginTop: 24, backgroundColor: isDark ? C.surface2.dark : C.surface2.light, paddingVertical: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <RefreshCw size={16} color={isDark ? C.text2.dark : C.text2.light} />
                    <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? C.text2.dark : C.text2.light }}>REFRESH ANALYSIS</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
});

export default HomeScreen;
