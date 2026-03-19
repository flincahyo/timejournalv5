import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Animated, Easing, Dimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { 
  Calendar, BrainCircuit, Filter, ChevronLeft, ChevronRight, X, Sparkles, Brain, 
  RefreshCw, Clock, Globe, Bell, BellRing, Settings, Sliders, Check, Music
} from 'lucide-react-native';
import { AILoadingAnimation } from '../components/AILoadingAnimation';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonRect, SkeletonCircle } from '../components/Skeleton';

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

const EconomicCalendarScreen = React.memo(function EconomicCalendarScreen({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [events, setEvents] = useState<FFEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  // News Alerts State
  const [newsSettings, setNewsSettings] = useState<any>({
    enabled: true,
    minutesBefore: 5,
    selectedEvents: [],
    autoHighImpact: false
  });
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // AI Modal State
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiInsights, setAiInsights] = useState("");

  useEffect(() => {
    fetchEvents();
    fetchNewsSettings();
  }, []);

  const fetchNewsSettings = async () => {
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${BACKEND_URL}/api/auth/news-settings`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      const data = await res.json();
      if (data) setNewsSettings(data);
    } catch (e) {
      console.error("Error fetching news settings:", e);
    }
  };

  const updateNewsSettings = async (patch: any) => {
    const updated = { ...newsSettings, ...patch };
    setNewsSettings(updated);
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${BACKEND_URL}/api/auth/news-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(patch)
      });
    } catch (e) {
      console.error("Error updating news settings:", e);
    }
  };

  const toggleEventAlert = (ev: FFEvent) => {
    const evKey = `${ev.title}_${ev.country}_${ev.date}`;
    const current = [...(newsSettings.selectedEvents || [])];
    const idx = current.indexOf(evKey);
    
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(evKey);
    }
    
    updateNewsSettings({ selectedEvents: current });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity 
                onPress={() => { Haptics.selectionAsync(); setSettingsModalVisible(true); }}
                style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: isDark ? '#1e293b' : '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}
              >
                 <Sliders size={20} color={isDark ? '#cbd5e1' : '#475569'} />
              </TouchableOpacity>
              <SparklingButton 
                onPress={() => { Haptics.selectionAsync(); setAiModalVisible(true); }} 
                loading={isGeneratingAI} 
              />
           </View>
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
              <View style={{ gap: 16, marginTop: 10 }}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18, borderBottomWidth: i === 4 ? 0 : 1, borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.3)' : '#f1f5f9' }}>
                    <View style={{ width: 45, paddingTop: 2 }}>
                       <SkeletonRect width={34} height={14} isDark={isDark} />
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 12, gap: 8 }}>
                       <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                         <SkeletonCircle size={10} isDark={isDark} />
                         <SkeletonRect width={24} height={10} isDark={isDark} />
                       </View>
                       <SkeletonRect width="80%" height={16} isDark={isDark} />
                    </View>
                    <View style={{ width: 70, alignItems: 'flex-end', gap: 6 }}>
                       <SkeletonRect width={40} height={10} isDark={isDark} />
                       <SkeletonRect width={40} height={10} isDark={isDark} />
                    </View>
                  </View>
                ))}
              </View>
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
                         <View style={{ flexDirection: 'row', gap: 4, marginBottom: 8 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8' }}>P:</Text>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: isDark ? '#cbd5e1' : '#475569' }}>{e.previous || '-'}</Text>
                         </View>
                         
                         {/* Alert Toggle Bell */}
                         {!isPast && (
                            <TouchableOpacity 
                              onPress={() => toggleEventAlert(e)}
                              style={{ 
                                width: 32, height: 32, borderRadius: 10, 
                                backgroundColor: (newsSettings.selectedEvents?.includes(`${e.title}_${e.country}_${e.date}`) || (newsSettings.autoHighImpact && e.impact === 'High')) ? (isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)') : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
                                alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                               {(newsSettings.selectedEvents?.includes(`${e.title}_${e.country}_${e.date}`) || (newsSettings.autoHighImpact && e.impact === 'High')) 
                                 ? <BellRing size={14} color="#6366f1" strokeWidth={2.5} />
                                 : <Bell size={14} color={isDark ? '#475569' : '#94a3b8'} strokeWidth={2} />
                               }
                            </TouchableOpacity>
                         )}
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
      {/* News Alerts Settings Modal */}
      <Modal visible={settingsModalVisible} animationType="slide" transparent={true}>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
            <View style={{ 
              height: '50%', backgroundColor: isDark ? '#020617' : '#ffffff',
              borderTopLeftRadius: 40, borderTopRightRadius: 40,
              padding: 24, paddingBottom: 40
            }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                     <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                        <Sliders size={20} color="#ffffff" />
                     </View>
                     <View>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>News Notification</Text>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Configure Alert Signals</Text>
                     </View>
                  </View>
                  <TouchableOpacity onPress={() => setSettingsModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                     <X color={isDark ? '#94a3b8' : '#64748b'} size={20} />
                  </TouchableOpacity>
               </View>

               <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Auto High Impact Toggle */}
                  <TouchableOpacity 
                    onPress={() => updateNewsSettings({ autoHighImpact: !newsSettings.autoHighImpact })}
                    style={{ 
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc',
                      padding: 20, borderRadius: 24, marginBottom: 20,
                      borderWidth: 1, borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9'
                    }}
                  >
                     <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', marginBottom: 4 }}>Auto-Alert High Impact</Text>
                        <Text style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b', lineHeight: 16 }}>Automatically notify for all RED (High Impact) news without manual selection.</Text>
                     </View>
                     <View style={{ 
                       width: 48, height: 26, borderRadius: 13, backgroundColor: newsSettings.autoHighImpact ? '#6366f1' : (isDark ? '#1e293b' : '#e2e8f0'),
                       justifyContent: 'center', paddingHorizontal: 2, alignItems: newsSettings.autoHighImpact ? 'flex-end' : 'flex-start'
                     }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff' }} />
                     </View>
                  </TouchableOpacity>

                  {/* Lead Time Selection */}
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 }}>Alert Lead Time</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
                     {[1, 5, 15, 30, 60].map(mins => (
                        <TouchableOpacity 
                          key={mins}
                          onPress={() => updateNewsSettings({ minutesBefore: mins })}
                          style={{ 
                            paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
                            backgroundColor: newsSettings.minutesBefore === mins ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'),
                            borderWidth: 1, borderColor: newsSettings.minutesBefore === mins ? '#6366f1' : (isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9')
                          }}
                        >
                           <Text style={{ fontSize: 12, fontWeight: '900', color: newsSettings.minutesBefore === mins ? '#ffffff' : (isDark ? '#cbd5e1' : '#475569') }}>
                             {mins < 60 ? `${mins}m Before` : '1h Before'}
                           </Text>
                        </TouchableOpacity>
                     ))}
                  </View>

                  <TouchableOpacity 
                    onPress={() => setSettingsModalVisible(false)}
                    style={{ backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#f5f7ff', paddingVertical: 18, borderRadius: 24, alignItems: 'center' }}
                  >
                     <Text style={{ color: '#6366f1', fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Done</Text>
                  </TouchableOpacity>
               </ScrollView>
            </View>
         </View>
      </Modal>
    </View>
  );
});

export default EconomicCalendarScreen;
