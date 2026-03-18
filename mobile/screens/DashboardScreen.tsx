import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Animated, Easing, Modal, Dimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Sparkles, Brain, Zap, RefreshCw } from 'lucide-react-native';
import { AILoadingAnimation } from '../components/AILoadingAnimation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../Constants';

import { useMT5Sync } from '../hooks/useMT5Sync';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SparklingButton = ({ onPress, loading }: { onPress: () => void, loading: boolean }) => {
  const shimmerValue = useRef(new Animated.Value(-1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const startShimmer = () => {
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ]).start(() => startShimmer());
    };

    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startShimmer();
    startPulse();
  }, []);

  const translateX = shimmerValue.interpolate({
    inputRange: [-1, 1],
    outputRange: [-100, 100],
  });

  return (
    <Animated.View style={{ transform: [{ scale: pulseValue }] }}>
      <TouchableOpacity 
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.8}
        style={{ 
          backgroundColor: '#4f46e5', 
          paddingHorizontal: 16, 
          paddingVertical: 8, 
          borderRadius: 24, 
          flexDirection: 'row', 
          alignItems: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          shadowColor: '#4f46e5',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 5
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            transform: [{ translateX }],
          }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <Sparkles size={14} color="#ffffff" style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>AI Analyst</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const DashboardScreen = React.memo(({ onNavigate }: { onNavigate: (s: string) => void }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { 
    isConnected, account: accountInfo, trades, loading, syncing, refresh: fetchData 
  } = useMT5Sync();

  const [refreshing, setRefreshing] = useState(false);
  
  // AI Analyst State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  // ── Stats Calculations ─────────────────────────────────────────────────────
  // (Removed local session detection - using backend data now)

  const stats = useMemo(() => {
    // Calculate growth first so it works even with 0 trades
    let growth = '0.0';
    if (accountInfo) {
      if (accountInfo.deposit > 0) {
        growth = (((accountInfo.balance - accountInfo.deposit) / accountInfo.deposit) * 100).toFixed(1);
      }
    }

    const emptySessionMap = { 'London': 0, 'New York': 0, 'Tokyo': 0, 'Sydney': 0, 'London + NY Overlap': 0, 'Unknown': 0 };

    if (trades.length === 0) {
      return {
        totalPnl: 0, wins: 0, losses: 0, winRate: 0, profitFactor: 0,
        topSymbols: [], hourlyStats: [], sessionMap: emptySessionMap, growth
      };
    }

    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let totalWinProfit = 0;
    let totalLossProfit = 0;
    const symbolMap: Record<string, { pnl: number, wins: number, total: number }> = {};
    const hourlyMap: Record<string, { pnl: number, wins: number, total: number }> = {};
    const sessionMap: Record<string, number> = { 
      'London': 0, 
      'New York': 0, 
      'Tokyo': 0, 
      'Sydney': 0, 
      'Overlap LN+NY': 0
    };

    trades.forEach(t => {
      const pnl = Number(t.profit || 0) + Number(t.swap || 0) + Number(t.commission || 0);
      totalPnl += pnl;
      if (pnl > 0) {
        wins++;
        totalWinProfit += pnl;
      } else {
        losses++;
        totalLossProfit += Math.abs(pnl);
      }
      
      const session = t.session || 'Unknown';
      if (sessionMap.hasOwnProperty(session)) {
        sessionMap[session]++;
      }
      // "Unknown" and other sessions not in the map are ignored from the count

      // Symbol Stats
      const sym = t.symbol || 'Unknown';
      if (!symbolMap[sym]) symbolMap[sym] = { pnl: 0, wins: 0, total: 0 };
      symbolMap[sym].pnl += pnl;
      symbolMap[sym].total++;
      if (pnl > 0) symbolMap[sym].wins++;

      // Hourly Stats
      const timeStr = t.openTime || t.time;
      if (timeStr) {
        try {
          const normalized = timeStr.includes(' ') && !timeStr.includes('T') 
            ? timeStr.replace(' ', 'T') 
            : timeStr;
          const hr = new Date(normalized).getHours();
          const hourKey = `${hr.toString().padStart(2, '0')}:00`;
          if (!hourlyMap[hourKey]) hourlyMap[hourKey] = { pnl: 0, wins: 0, total: 0 };
          hourlyMap[hourKey].pnl += pnl;
          hourlyMap[hourKey].total++;
          if (pnl > 0) hourlyMap[hourKey].wins++;
        } catch(e) {}
      }
    });

    const winRate = (wins / (trades.length || 1)) * 100;
    const profitFactor = totalLossProfit === 0 ? totalWinProfit : totalWinProfit / totalLossProfit;

    const topSymbols = Object.entries(symbolMap)
      .map(([symbol, data]) => ({ symbol, pnl: data.pnl, winRate: (data.wins / data.total) * 100, pos: data.pnl >= 0 }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);

    const hourlyStats = Object.entries(hourlyMap)
      .map(([hour, data]) => ({ hour, pnl: data.pnl, percent: Math.round((data.wins / data.total) * 100), isWin: data.pnl >= 0 }))
      .sort((a, b) => b.hour.localeCompare(a.hour))
      .slice(0, 5);

    // Refine growth if deposit missing but trades exist
    if (growth === '0.0' && accountInfo && accountInfo.balance > 0 && totalPnl !== 0) {
      const startBalance = accountInfo.balance - totalPnl;
      if (startBalance > 0) {
        growth = ((totalPnl / startBalance) * 100).toFixed(1);
      }
    }

    return {
      totalPnl, wins, losses, winRate, profitFactor,
      topSymbols, hourlyStats, sessionMap, growth
    };
  }, [trades, accountInfo]);

  const handleAIAnalyze = async () => {
    if (trades.length === 0) {
      alert("No trades found to analyze. Please sync your MT5 account first.");
      return;
    }

    setShowAIModal(true);
    setIsGeneratingAI(true);
    setAiInsight(null);

    try {
      const token = await AsyncStorage.getItem('userToken');
      
      // Calculate derived stats for the AI
      const recentTrades = trades.slice(0, 10);
      const recentWins = recentTrades.filter(t => (t.profit || 0) > 0).length;
      const streakCtx = recentTrades.length ? `${recentWins} wins out of last ${recentTrades.length} trades.` : "No recent trades.";
      
      const payload = {
        totalTrades: trades.length,
        winRate: stats.winRate,
        totalPnl: stats.totalPnl,
        bestSymbol: stats.topSymbols[0]?.symbol || "N/A",
        worstSymbol: stats.topSymbols[stats.topSymbols.length - 1]?.symbol || "N/A",
        recentStreaks: streakCtx,
        notes: `Growth is ${stats.growth}%. Profit Factor is ${(stats.profitFactor ?? 0).toFixed(2)}.`
      };

      const res = await fetch(`${API_URL}/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setAiInsight(data.insight);
      } else {
        setAiInsight("AI Analyst failed to provide insights. Please check your backend configuration or API Key.");
      }
    } catch (error) {
      console.error("AI Error:", error);
      setAiInsight("An error occurred while contacting the AI Analyst. Please try again later.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  const s = stats || {
    totalPnl: 0, wins: 0, losses: 0, winRate: 0, profitFactor: 0,
    topSymbols: [], hourlyStats: [], growth: '0.0', 
    sessionMap: { 'London': 0, 'New York': 0, 'Tokyo': 0, 'Sydney': 0, 'Overlap LN+NY': 0 }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
             <View>
                <Text style={{ fontSize: 22, fontWeight: '900' as any, color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -0.5, fontFamily: 'Montserrat_700Bold' }}>
                  Market Overview
                </Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold' as any, color: isDark ? '#64748b' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>
                  {accountInfo ? `${accountInfo.name} (${accountInfo.login})` : 'Performance at a glance'}
                </Text>
             </View>
             
              <SparklingButton onPress={handleAIAnalyze} loading={isGeneratingAI} />
          </View>
        </View>

        {/* Row 1: KPI Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          {/* KPI 1: TOTAL PNL */}
          <View style={{ width: '48%', backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 18, borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8', letterSpacing: 1 }}>TOTAL PNL</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: s.totalPnl >= 0 ? (isDark ? '#34d399' : '#059669') : '#ef4444', letterSpacing: -1, marginBottom: 8 }}>
              {s.totalPnl >= 0 ? '+' : '-'}${Math.abs(s.totalPnl).toFixed(2)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b' }}>{s.wins}W / {s.losses}L</Text>
            </View>
          </View>

          {/* KPI 2: GROWTH */}
          <View style={{ width: '48%', backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8', letterSpacing: 1, marginBottom: 10 }}>ACCOUNT GROWTH</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: parseFloat(s.growth) >= 0 ? (isDark ? '#34d399' : '#059669') : '#ef4444', letterSpacing: -0.5, marginBottom: 6 }}>
              {parseFloat(s.growth) >= 0 ? '+' : ''}{s.growth}%
            </Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b' }}>since inception</Text>
          </View>

          {/* KPI 3: PROFIT FACTOR */}
          <View style={{ width: '48%', backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8', letterSpacing: 1, marginBottom: 12 }}>PROFIT FACTOR</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -0.5, marginBottom: 6 }}>{s.profitFactor.toFixed(2)}x</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: s.profitFactor >= 1.5 ? '#10b981' : '#f59e0b' }}>{s.profitFactor >= 1.5 ? 'Strong' : 'Healthy'}</Text>
          </View>

          {/* KPI 4: WIN RATE */}
          <View style={{ width: '48%', backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
            <Text style={{ fontSize: 8, fontWeight: '900', color: isDark ? '#64748b' : '#94a3b8', letterSpacing: 1, marginBottom: 12 }}>WIN RATE</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -0.5, marginBottom: 6 }}>{s.winRate.toFixed(1)}%</Text>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? '#94a3b8' : '#64748b' }}>{trades.length} total trades</Text>
          </View>
        </View>

        {/* Win Rate Donut */}
        <View style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>Win Rate</Text>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#64748b' : '#94a3b8' }}>Trade performance</Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
             <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 16, borderColor: '#2563eb', borderLeftColor: '#f97316', borderBottomColor: '#f97316', alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>{Math.round(s.winRate)}%</Text>
             </View>

             <View style={{ gap: 12 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                 <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' }} />
                 <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#475569' }}>Wins: {s.wins}</Text>
               </View>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                 <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316' }} />
                 <Text style={{ fontSize: 12, fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#475569' }}>Losses: {s.losses}</Text>
               </View>
             </View>
          </View>
        </View>

        {/* Top Symbols & Sessions */}
        <View style={{ flexDirection: 'column', gap: 24, marginBottom: 24 }}>
          <View style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', marginBottom: 16 }}>Top Symbols</Text>
            <View style={{ gap: 16 }}>
              {s.topSymbols.map((symbolStat: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#f1f5f9', paddingBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#cbd5e1' : '#334155' }}>{symbolStat.symbol}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: symbolStat.pos ? '#10b981' : '#ef4444' }}>
                    {symbolStat.pos ? '+' : '-'}${Math.abs(symbolStat.pnl).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          
          <View style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', marginBottom: 4, fontFamily: 'Montserrat_700Bold' }}>Trading Sessions</Text>
            <Text style={{ fontSize: 10, color: isDark ? '#475569' : '#94a3b8', marginBottom: 16 }}>{trades.length} closed trades analysed</Text>
            <View style={{ gap: 12 }}>
              {Object.entries(s.sessionMap).length === 0 ? (
                <Text style={{ fontSize: 12, color: isDark ? '#475569' : '#94a3b8', textAlign: 'center', paddingVertical: 8 }}>Sync MT5 to populate session data</Text>
              ) : (
                Object.entries(s.sessionMap)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([name, count]: any, i: number) => (
                    <View key={i} style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#e2e8f0' : '#1e293b' }}>{name}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>{count} trades · {Math.round((count / Math.max(trades.length, 1)) * 100)}%</Text>
                      </View>
                      <View style={{ height: 4, width: '100%', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ height: '100%', width: `${Math.min(100, (count / Math.max(trades.length, 1)) * 100)}%`, backgroundColor: '#6366f1', borderRadius: 2 }} />
                      </View>
                    </View>
                  ))
              )}
            </View>
          </View>
        </View>

        {/* Hourly Performance */}
        <View style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', padding: 24, borderRadius: 28, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9', marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', marginBottom: 20 }}>Hourly Performance</Text>
          <View style={{ gap: 12 }}>
            {s.hourlyStats.map((h: any, i: number) => (
              <View key={i}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#cbd5e1' : '#475569' }}>{h.hour}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>{h.pnl >= 0 ? '+' : '-'}${Math.abs(h.pnl).toFixed(2)}</Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8' }}>{h.percent}% Win</Text>
                  </View>
                </View>
                <View style={{ height: 4, width: '100%', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ width: `${h.percent}%`, height: '100%', backgroundColor: h.isWin ? '#10b981' : '#ef4444', borderRadius: 2 }} />
                </View>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>

      {/* AI Analyst Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ 
            height: '85%', 
            backgroundColor: isDark ? '#020617' : '#ffffff', 
            borderTopLeftRadius: 32, 
            borderTopRightRadius: 32,
            padding: 24,
            paddingBottom: 40
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' }}>
                    <Brain size={24} color="#ffffff" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>AI Trading Intelligence</Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Psychological & Technical Audit</Text>
                  </View>
               </View>
               <TouchableOpacity 
                 onPress={() => setShowAIModal(false)}
                 style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
               >
                 <X size={20} color={isDark ? '#94a3b8' : '#64748b'} />
               </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {isGeneratingAI ? (
                <AILoadingAnimation 
                  isDark={isDark} 
                  message="Dissecting Performance..." 
                  subMessage="We're evaluating your win rate, drawdown, and psychological streaks for objective insights."
                />
              ) : (
                <View>
                  {aiInsight ? (
                    <View style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: 20, borderRadius: 24, borderLeftWidth: 4, borderLeftColor: '#4f46e5' }}>
                      {aiInsight.split('\n').map((line, idx) => {
                        const isBold = line.startsWith('**') || (line.includes('**') && line.trim().endsWith('**'));
                        const cleanLine = line.replace(/\*\*/g, '').replace(/^- /, '• ');
                        
                        if (!cleanLine.trim()) return <View key={idx} style={{ height: 12 }} />;
                        
                        return (
                          <Text key={idx} style={{ 
                            fontSize: isBold ? 14 : 13, 
                            fontWeight: isBold ? '900' : '500', 
                            color: isBold ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#cbd5e1' : '#475569'),
                            lineHeight: 22,
                            marginBottom: isBold ? 8 : 4,
                            marginTop: isBold ? 12 : 0
                          }}>
                            {cleanLine}
                          </Text>
                        );
                      })}
                    </View>
                  ) : null}
                  
                  <TouchableOpacity 
                    onPress={handleAIAnalyze}
                    style={{ 
                      marginTop: 32, 
                      backgroundColor: isDark ? '#1e293b' : '#f1f5f9', 
                      paddingVertical: 16, 
                      borderRadius: 20, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: 8,
                      borderWidth: 1,
                      borderColor: isDark ? '#334155' : '#e2e8f0'
                    }}
                  >
                    <RefreshCw size={16} color={isDark ? '#cbd5e1' : '#475569'} />
                    <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#cbd5e1' : '#475569' }}>REFRESH ANALYSIS</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
});


export default DashboardScreen;
