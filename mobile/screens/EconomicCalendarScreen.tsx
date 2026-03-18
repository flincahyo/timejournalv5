import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Animated, Easing, Dimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Calendar, BrainCircuit, Filter, ChevronLeft, ChevronRight, X, Sparkles, Brain, RefreshCw, Clock, Globe } from 'lucide-react-native';
import { AILoadingAnimation } from '../components/AILoadingAnimation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BACKEND_URL } from '../Constants';

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
          backgroundColor: '#6366f1', 
          paddingHorizontal: 16, 
          paddingVertical: 10, 
          borderRadius: 20, 
          flexDirection: 'row', 
          alignItems: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.2)',
          shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5
        }}
      >
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateX }] }}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
        <Sparkles size={14} color="#ffffff" style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 11, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Audit</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface FFEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

export default function EconomicCalendarScreen({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [events, setEvents] = useState<FFEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  // AI Modal State
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiInsights, setAiInsights] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/news`);
      const data: FFEvent[] = await res.json();
      
      if (Array.isArray(data)) {
        const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setEvents(sorted);

        const todayKey = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const uniqueDays = Array.from(new Set(sorted.map(e => new Date(e.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))));
        const tIdx = uniqueDays.indexOf(todayKey);
        if (tIdx !== -1) setActiveDayIdx(tIdx);
      }
    } catch (e) {
      console.error("Error fetching news:", e);
    } finally {
      setLoading(false);
    }
  };

  const dayGroups = useMemo(() => {
    const groups: Record<string, FFEvent[]> = {};
    events.forEach(e => {
        const d = new Date(e.date);
        const dateKey = d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(e);
    });
    return groups;
  }, [events]);

  const dayKeys = Object.keys(dayGroups);
  const activeDayKey = dayKeys[activeDayIdx] || "";
  const activeEvents = dayGroups[activeDayKey] || [];
  const isToday = activeDayKey === new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const getImpactColor = (impact: string) => {
    switch (impact) {
        case "High": return '#ef4444';
        case "Medium": return '#f59e0b';
        case "Low": return '#64748b';
        default: return '#64748b';
    }
  };

  const getFlagEmoji = (country: string) => {
    const code = country.toUpperCase();
    switch (code) {
      case 'USD': return '🇺🇸';
      case 'EUR': return '🇪🇺';
      case 'GBP': return '🇬🇧';
      case 'JPY': return '🇯🇵';
      case 'AUD': return '🇦🇺';
      case 'CAD': return '🇨🇦';
      case 'NZD': return '🇳🇿';
      case 'CHF': return '🇨🇭';
      case 'CNY': return '🇨🇳';
      case 'ALL': return '🌐';
      default: return '🏳️';
    }
  };

  const generateAI = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsGeneratingAI(true);
    setAiInsights("");

    try {
        const jwt = await AsyncStorage.getItem('userToken');
        const res = await fetch(`${BACKEND_URL}/api/ai/analyze-news`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ target_events: activeEvents, context_events: events })
        });
        const data = await res.json();
        if (data.success) {
            setAiInsights(data.insight);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
            setAiInsights("AI Agent failed to provide audit.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    } catch {
        setAiInsights("Connection error.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
        setIsGeneratingAI(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={{ marginBottom: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
           <View>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Global Macro Pulse
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -1 }}>
                News
              </Text>
           </View>
           <SparklingButton 
             onPress={() => { Haptics.selectionAsync(); setAiModalVisible(true); }} 
             loading={isGeneratingAI} 
           />
        </View>

        {/* Minimalist Day Selector */}
        <View style={{ 
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
          padding: 8, borderRadius: 24, marginBottom: 24,
          borderWidth: 1, borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9'
        }}>
           <TouchableOpacity 
             disabled={activeDayIdx === 0}
             onPress={() => { Haptics.selectionAsync(); setActiveDayIdx(Math.max(0, activeDayIdx - 1)); }}
             style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1e293b' : '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 }}
           >
              <ChevronLeft color={isDark ? '#e2e8f0' : '#475569'} size={20} />
           </TouchableOpacity>
           
           <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>{activeDayKey || 'End of Data'}</Text>
              {isToday && <Text style={{ fontSize: 8, fontWeight: '900', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Journal Day (Today)</Text>}
           </View>

           <TouchableOpacity 
             disabled={activeDayIdx === dayKeys.length - 1 || dayKeys.length === 0}
             onPress={() => { Haptics.selectionAsync(); setActiveDayIdx(Math.min(dayKeys.length - 1, activeDayIdx + 1)); }}
             style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? '#1e293b' : '#ffffff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 }}
           >
              <ChevronRight color={isDark ? '#e2e8f0' : '#475569'} size={20} />
           </TouchableOpacity>
        </View>

        {/* Event List - Minimalist Rework */}
        <View>
           {loading ? (
              <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
           ) : activeEvents.length === 0 ? (
              <View style={{ padding: 60, alignItems: 'center', opacity: 0.5 }}>
                 <Calendar color={isDark ? '#334155' : '#cbd5e1'} size={48} />
                 <Text style={{ marginTop: 16, fontSize: 13, fontWeight: 'bold', color: isDark ? '#64748b' : '#94a3b8' }}>Inactive Market Period</Text>
              </View>
           ) : (
              activeEvents.map((e, i) => {
                 const d = new Date(e.date);
                 const isPast = d.getTime() < Date.now();
                 const impactColor = getImpactColor(e.impact);

                 return (
                   <View key={i} style={{ 
                     flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18,
                     borderBottomWidth: i === activeEvents.length - 1 ? 0 : 1, 
                     borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.3)' : '#f1f5f9',
                     opacity: isPast ? 0.4 : 1
                   }}>
                      <View style={{ width: 45, paddingTop: 2 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>
                          {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </Text>
                      </View>

                      <View style={{ flex: 1, paddingHorizontal: 12 }}>
                         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: impactColor }} />
                            <Text style={{ fontSize: 13, marginRight: 2 }}>{getFlagEmoji(e.country)}</Text>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase' }}>{e.country}</Text>
                         </View>
                         <Text style={{ fontSize: 14, fontWeight: '900', color: isDark ? '#ffffff' : '#1e293b', marginBottom: 6, letterSpacing: -0.2, fontFamily: 'Montserrat_700Bold' }}>
                           {e.title}
                         </Text>
                      </View>

                      <View style={{ width: 70, alignItems: 'flex-end', paddingTop: 2 }}>
                         <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8' }}>F:</Text>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#cbd5e1' : '#475569' }}>{e.forecast || '-'}</Text>
                         </View>
                         <View style={{ flexDirection: 'row', gap: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8' }}>P:</Text>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#cbd5e1' : '#475569' }}>{e.previous || '-'}</Text>
                         </View>
                      </View>
                   </View>
                 );
              })
           )}
        </View>
      </ScrollView>

      {/* AI Modal - Premium DNA Alignment */}
      <Modal visible={aiModalVisible} animationType="slide" transparent={true}>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
            <View style={{ 
              height: '85%', backgroundColor: isDark ? '#020617' : '#ffffff',
              borderTopLeftRadius: 40, borderTopRightRadius: 40,
              padding: 24, paddingBottom: 40
            }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                     <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                        <Brain size={24} color="#ffffff" />
                     </View>
                     <View>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>Market Intelligence</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Deep Fundamental Correlation</Text>
                     </View>
                  </View>
                  <TouchableOpacity onPress={() => setAiModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                     <X color={isDark ? '#94a3b8' : '#64748b'} size={20} />
                  </TouchableOpacity>
               </View>

               <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {!aiInsights && !isGeneratingAI && (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                       <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(99, 102, 241, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                          <Globe color="#6366f1" size={32} />
                       </View>
                       <Text style={{ fontSize: 20, fontWeight: '900', color: isDark ? '#f8fafc' : '#0f172a', marginBottom: 16, textAlign: 'center', fontFamily: 'Montserrat_700Bold' }}>
                         Macro Sentiment Audit
                       </Text>
                       <Text style={{ fontSize: 14, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'center', marginBottom: 40, lineHeight: 24, paddingHorizontal: 20, fontFamily: 'Montserrat_400Regular' }}>
                         Synchronize high-impact fundamental triggers with technical bias to extract high-probability execution zones.
                       </Text>
                       <TouchableOpacity onPress={generateAI} style={{ backgroundColor: '#6366f1', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 24, shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Begin Core Audit</Text>
                       </TouchableOpacity>
                    </View>
                  )}

                  {isGeneratingAI && (
                    <AILoadingAnimation isDark={isDark} message="Correlating Macro Highs..." subMessage="Scanning high-impact releases for XAUUSD structural alignment." />
                  )}

                  {aiInsights && !isGeneratingAI && (
                    <View>
                       <View style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc', padding: 24, borderRadius: 28, borderLeftWidth: 4, borderLeftColor: '#6366f1' }}>
                          {aiInsights.split('\n').map((line, idx) => {
                             const isBold = line.startsWith('**') || (line.includes('**') && line.trim().endsWith('**'));
                             const cleanLine = line.replace(/\*\*/g, '').replace(/^- /, '• ');
                             if (!cleanLine.trim()) return <View key={idx} style={{ height: 12 }} />;
                             return (
                               <Text key={idx} style={{ 
                                 fontSize: isBold ? 14 : 13, fontWeight: isBold ? '900' : '500', 
                                 color: isBold ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#cbd5e1' : '#475569'),
                                 lineHeight: 24, marginBottom: isBold ? 8 : 4, marginTop: isBold ? 12 : 0, fontFamily: isBold ? 'Montserrat_700Bold' : 'Montserrat_400Regular'
                               }}>{cleanLine}</Text>
                             );
                          })}
                       </View>
                       
                       <TouchableOpacity onPress={generateAI} style={{ marginTop: 32, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f1f5f9', paddingVertical: 18, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <RefreshCw size={16} color={isDark ? '#cbd5e1' : '#475569' } />
                          <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#cbd5e1' : '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>Sync Fresh Analysis</Text>
                       </TouchableOpacity>
                    </View>
                  )}
               </ScrollView>
            </View>
         </View>
      </Modal>
    </View>
  );
}
