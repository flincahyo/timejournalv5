import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, Modal, Animated, Easing, Dimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Bell, Zap, MoreVertical, Plus, Trash2, ArrowLeft, X, ChevronRight, Info, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../Constants';
import { useWebSocket } from '../hooks/useWebSocket';
import * as DocumentPicker from 'expo-document-picker';
import { Music, Upload, Check, Play, Pause } from 'lucide-react-native';
import { SkeletonRect, SkeletonCircle } from '../components/Skeleton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const AlertsScreen = React.memo(function AlertsScreen({ onBack }: { onBack?: () => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [activeTab, setActiveTab] = useState<'price' | 'candle'>('price');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);

  // Price Alert Form
  const [symbol, setSymbol] = useState('XAUUSD');
  const [targetPrice, setTargetPrice] = useState('');
  const [trigger, setTrigger] = useState<'Above' | 'Below' | 'Crosses'>('Above');

  // Momentum Form
  const [timeframe, setTimeframe] = useState('M5');
  const [minBodyPips, setMinBodyPips] = useState('50');
  const [maxWickPercent, setMaxWickPercent] = useState('25');

  // Sounds
  const [availableSounds, setAvailableSounds] = useState<any[]>([
    { id: 'default', name: 'Default Signal', url: 'https://timejournal.site/sounds/alert.mp3' },
    { id: 'classic', name: 'Classic Ping', url: 'https://timejournal.site/sounds/ping.mp3' },
    { id: 'momentum', name: 'Momentum Boom', url: 'https://timejournal.site/sounds/momentum.mp3' },
  ]);
  const [selectedSound, setSelectedSound] = useState('default');
  const [uploadingSound, setUploadingSound] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

  // Symbol Selection
  const [allSymbols, setAllSymbols] = useState<string[]>([]);
  const [isSymbolModalVisible, setSymbolModalVisible] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState('');

  const { prices } = useWebSocket();
  const rawPrice = prices[symbol.toUpperCase()];
  const currentPrice = rawPrice ? (typeof rawPrice === 'object' ? (rawPrice as any).bid : rawPrice) : null;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAlerts();
    fetchSounds();
    fetchSymbols();
    const hb = setInterval(heartbeat, 20000);
    heartbeat();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    return () => clearInterval(hb);
  }, [symbol]);

  const fetchSymbols = async () => {
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/mt5/symbols`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      const data = await res.json();
      if (data.symbols) setAllSymbols(data.symbols);
    } catch (_) {}
  };

  const heartbeat = async () => {
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      if (!jwt) return;
      await fetch(`${API_URL}/mt5/watch/${symbol}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` }
      });
    } catch (_) {}
  };

  const fetchSounds = async () => {
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/sounds`, { headers: { Authorization: `Bearer ${jwt}` } });
      const data = await res.json();
      if (data.custom_sounds) {
        setAvailableSounds([
          { id: 'default', name: 'Default Signal', url: 'https://timejournal.site/sounds/alert.mp3' },
          { id: 'classic', name: 'Classic Ping', url: 'https://timejournal.site/sounds/ping.mp3' },
          { id: 'momentum', name: 'Momentum Boom', url: 'https://timejournal.site/sounds/momentum.mp3' },
          ...data.custom_sounds
        ]);
      }
    } catch (_) {}
  };

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      if (!jwt) return;
      const res = await fetch(`${API_URL}/alerts`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createPriceAlert = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const priceNum = parseFloat(targetPrice);
    if (isNaN(priceNum)) return;
    
    const newAlert = {
      id: Math.random().toString(),
      type: 'price',
      symbol: symbol.toUpperCase(),
      trigger,
      targetPrice: priceNum,
      enabled: true,
      frequency: 'Once',
      sound: selectedSound
    };
    setAlerts([newAlert, ...alerts]);
    setTargetPrice('');
    setModalVisible(false);

    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ data: { ...newAlert, id: undefined } })
      });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const createCandleAlert = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const pips = parseFloat(minBodyPips);
    const wick = parseFloat(maxWickPercent);
    if (isNaN(pips) || isNaN(wick)) return;

    const newAlert = {
      id: Math.random().toString(),
      type: 'candle',
      symbol: symbol.toUpperCase(),
      timeframe,
      minBodyPips: pips,
      maxWickPercent: wick,
      enabled: true,
      frequency: 'Recurring',
      sound: selectedSound
    };
    setAlerts([newAlert, ...alerts]);
    setModalVisible(false);

    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ data: { ...newAlert, id: undefined } })
      });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const uploadSound = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      setUploadingSound(true);
      const file = result.assets[0];
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'audio/mpeg'
      });

      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/upload-sound`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
        body: formData
      });
      
      const data = await res.json();
      if (data.url) {
        await fetchSounds();
        setSelectedSound(data.url);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.error('Upload error:', e);
    } finally {
      setUploadingSound(false);
    }
  };

  const playPreview = async (soundUrl: string | null, id: string) => {
    try {
      if (isPlaying === id) {
        if (playerRef.current) playerRef.current.pause();
        setIsPlaying(null);
        return;
      }

      // Audibly play the sound if a URL is available (even for presets)
      if (soundUrl && soundUrl.startsWith('http')) {
        const { createAudioPlayer } = await import('expo-audio');
        
        if (!playerRef.current) {
          playerRef.current = createAudioPlayer(soundUrl);
        } else {
          playerRef.current.replace(soundUrl);
        }
        
        setIsPlaying(id);
        playerRef.current.play();
        
        // Simple listener for finishing
        const sub = playerRef.current.addListener('playbackStatusUpdate', (s: any) => {
          if (s.didJustFinish) {
            setIsPlaying(null);
            sub.remove();
          }
        });
      } else {
        // Fallback to haptics if no URL
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsPlaying(id);
        setTimeout(() => setIsPlaying(null), 1000);
      }
    } catch (e) {
      console.log('Playback error');
    }
  };

  const toggleAlert = async (alert: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = alerts.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a);
    setAlerts(updated);
    
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/alerts/${alert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ partial: { enabled: !alert.enabled } })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteAlert = async (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/alerts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const inp = {
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
    borderWidth: 1, borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    color: isDark ? '#ffffff' : '#0f172a', fontSize: 13, marginBottom: 16,
    fontFamily: 'Montserrat_400Regular'
  };

  const lbl = { fontSize: 10, fontWeight: '900' as const, color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 24, paddingBottom: 60, paddingTop: 16 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header */}
        <View style={{ marginBottom: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
           <View>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Signal Infrastructure
              </Text>
              <Text style={{ fontSize: 28, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -1 }}>
                Alerts
              </Text>
           </View>
           <TouchableOpacity 
             onPress={() => { Haptics.selectionAsync(); setModalVisible(true); }}
             style={{ 
               width: 52, height: 52, borderRadius: 18, backgroundColor: '#6366f1', 
               alignItems: 'center', justifyContent: 'center', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8
             }}
           >
             <Plus size={24} color="#ffffff" strokeWidth={3} />
           </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Dashboard Summary Mini Card */}
          <View style={{ 
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.05)' : '#f5f7ff', 
            borderRadius: 28, padding: 20, marginBottom: 32,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.1)'
          }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#6366f115', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} color="#6366f1" />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>{alerts.filter(a=>a.enabled).length} Active Watchers</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Precision monitoring via MT5 Bridge</Text>
            </View>
          </View>

          {/* Rules List */}
          <View>
            <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 20, paddingHorizontal: 4 }}>
              Execution Rules
            </Text>

            {loading ? (
              <View style={{ gap: 16 }}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={{ backgroundColor: isDark ? 'rgba(30, 41, 59, 0.2)' : '#ffffff', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <SkeletonRect width={48} height={48} borderRadius={16} isDark={isDark} />
                        <View style={{ gap: 6 }}>
                           <SkeletonRect width={80} height={16} isDark={isDark} />
                           <SkeletonRect width={120} height={12} isDark={isDark} />
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                         <SkeletonRect width={40} height={20} borderRadius={10} isDark={isDark} />
                         <SkeletonRect width={36} height={36} borderRadius={12} isDark={isDark} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : alerts.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', opacity: 0.5 }}>
                 <Bell size={48} color={isDark ? '#334155' : '#cbd5e1'} />
                 <Text style={{ marginTop: 16, fontSize: 13, fontWeight: 'bold', color: isDark ? '#64748b' : '#94a3b8' }}>Quiet Horizons</Text>
              </View>
            ) : (
              alerts.map(alert => (
                <View key={alert.id} style={{ 
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.2)' : '#ffffff', 
                  borderRadius: 28, padding: 20, marginBottom: 16,
                  borderWidth: 1, borderColor: alert.enabled ? 'rgba(99, 102, 241, 0.2)' : (isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9'),
                  opacity: alert.enabled ? 1 : 0.6,
                  shadowColor: '#000', shadowOpacity: alert.enabled ? 0.03 : 0, shadowRadius: 10
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: alert.type === 'price' ? '#6366f110' : '#f59e0b10', alignItems: 'center', justifyContent: 'center' }}>
                         {alert.type === 'price' ? <Bell size={20} color="#6366f1" /> : <Zap size={20} color="#f59e0b" />}
                      </View>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#ffffff' : '#1e293b', fontFamily: 'Montserrat_700Bold' }}>{alert.symbol}</Text>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
                          {alert.trigger} {alert.targetPrice || alert.minBodyPips}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                       <Switch 
                         value={alert.enabled} 
                         onValueChange={() => toggleAlert(alert)}
                         trackColor={{ false: isDark ? '#1e293b' : '#e2e8f0', true: '#6366f1' }}
                         ios_backgroundColor="#1e293b"
                       />
                       <TouchableOpacity onPress={() => deleteAlert(alert.id)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef444408', borderRadius: 12 }}>
                          <Trash2 size={16} color="#ef4444" opacity={0.6} />
                       </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Creation Modal - Premium Sheet */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
            <View style={{ 
              height: '75%', backgroundColor: isDark ? '#020617' : '#ffffff',
              borderTopLeftRadius: 40, borderTopRightRadius: 40,
              padding: 24, paddingBottom: 40
            }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                  <View>
                     <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', fontFamily: 'Montserrat_700Bold' }}>Watch Parameter</Text>
                     <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Initialize Execution Guard</Text>
                  </View>
                  <TouchableOpacity onPress={() => setModalVisible(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                     <X color={isDark ? '#94a3b8' : '#64748b'} size={20} />
                  </TouchableOpacity>
               </View>

               <View style={{ flexDirection: 'row', marginBottom: 24, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9', borderRadius: 18, padding: 6 }}>
                  <TouchableOpacity 
                    onPress={() => { Haptics.selectionAsync(); setActiveTab('price'); }}
                    style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: activeTab === 'price' ? (isDark ? '#334155' : '#ffffff') : 'transparent', shadowColor: '#000', shadowOpacity: activeTab === 'price' ? 0.05 : 0, shadowRadius: 5 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: activeTab === 'price' ? (isDark ? '#f8fafc' : '#0f172a') : '#64748b', textTransform: 'uppercase' }}>Price Alert</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => { Haptics.selectionAsync(); setActiveTab('candle'); }}
                    style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 14, backgroundColor: activeTab === 'candle' ? (isDark ? '#334155' : '#ffffff') : 'transparent', shadowColor: '#000', shadowOpacity: activeTab === 'candle' ? 0.05 : 0, shadowRadius: 5 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '900', color: activeTab === 'candle' ? (isDark ? '#f8fafc' : '#0f172a') : '#64748b', textTransform: 'uppercase' }}>Momentum</Text>
                  </TouchableOpacity>
               </View>

               {activeTab === 'price' ? (
                  <View>
                     <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                           <Text style={lbl}>Ticker</Text>
                           <TouchableOpacity 
                             onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSymbolModalVisible(true); }}
                             style={[inp, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                           >
                              <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '900', fontSize: 13 }}>{symbol || 'Select...'}</Text>
                              <ChevronRight size={16} color="#6366f1" />
                           </TouchableOpacity>
                        </View>
                        <View style={{ flex: 1 }}>
                           <Text style={lbl}>Method</Text>
                           <TouchableOpacity 
                             onPress={() => { Haptics.selectionAsync(); setTrigger(t => t === 'Above' ? 'Below' : (t === 'Below' ? 'Crosses' : 'Above')); }}
                             style={[inp, { alignItems: 'center', justifyContent: 'center' }]}
                           >
                              <Text style={{ color: trigger === 'Above' ? '#10b981' : (trigger === 'Below' ? '#ef4444' : '#6366f1'), fontWeight: '900', fontSize: 13, textTransform: 'uppercase' }}>{trigger}</Text>
                           </TouchableOpacity>
                        </View>
                     </View>

                     <TouchableOpacity 
                        activeOpacity={0.7}
                        onPress={() => {
                          if (currentPrice) {
                            Haptics.selectionAsync();
                            setTargetPrice(currentPrice.toString());
                          }
                        }}
                        style={{ marginBottom: 12, alignItems: 'center', backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)', paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)' }}
                      >
                        <Text style={[lbl, { color: isDark ? '#6366f1' : '#4f46e5', marginBottom: 2 }]}>Live Execution Price</Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>
                           {currentPrice ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Connecting...'}
                        </Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', marginTop: 4 }}>TAP TO USE AS TARGET</Text>
                     </TouchableOpacity>

                     <Text style={lbl}>Target Execution Price</Text>
                     <TextInput style={[inp, { fontSize: 28, fontWeight: '900', paddingVertical: 20, textAlign: 'center' }]} value={targetPrice} onChangeText={setTargetPrice} placeholder="0.00000" placeholderTextColor={isDark ? '#1e293b' : '#cbd5e1'} keyboardType="numeric" />

                     {/* Sound Selection UI */}
                     <Text style={lbl}>Alert Signature (Sound)</Text>
                     <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                           {availableSounds.map(s => (
                              <TouchableOpacity 
                                key={s.id}
                                onPress={() => { setSelectedSound(s.id); playPreview(s.url, s.id); }}
                                style={{ 
                                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, 
                                  backgroundColor: selectedSound === s.id ? '#6366f1' : (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9'),
                                  flexDirection: 'row', alignItems: 'center', gap: 8
                                }}
                              >
                                {isPlaying === s.id ? <Pause size={14} color="#fff" /> : <Music size={14} color={selectedSound === s.id ? '#fff' : '#64748b'} />}
                                <Text style={{ fontSize: 11, fontWeight: '700', color: selectedSound === s.id ? '#fff' : (isDark ? '#94a3b8' : '#64748b') }}>{s.name}</Text>
                              </TouchableOpacity>
                           ))}
                           <TouchableOpacity 
                             onPress={uploadSound}
                             style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#f5f7ff', borderStyle: 'dashed', borderWidth: 1, borderColor: '#6366f1' }}
                           >
                              {uploadingSound ? <ActivityIndicator size="small" color="#6366f1" /> : <Upload size={14} color="#6366f1" />}
                           </TouchableOpacity>
                        </ScrollView>
                     </View>

                     <TouchableOpacity 
                       onPress={createPriceAlert}
                       style={{ 
                         marginTop: 10, paddingVertical: 18, borderRadius: 24, backgroundColor: '#6366f1', 
                         alignItems: 'center', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10
                       }}
                     >
                       <Text style={{ fontSize: 14, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Engage Guard</Text>
                     </TouchableOpacity>
                  </View>
               ) : (
                 <View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                       <View style={{ flex: 1.5 }}>
                          <Text style={lbl}>Ticker</Text>
                          <TouchableOpacity 
                            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSymbolModalVisible(true); }}
                            style={[inp, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                          >
                             <Text style={{ color: isDark ? '#ffffff' : '#0f172a', fontWeight: '900', fontSize: 13 }}>{symbol || 'Select...'}</Text>
                             <ChevronRight size={16} color="#6366f1" />
                          </TouchableOpacity>
                       </View>
                       <View style={{ flex: 1 }}>
                          <Text style={lbl}>Period</Text>
                          <TouchableOpacity 
                            onPress={() => { Haptics.selectionAsync(); setTimeframe(t => t === 'M1' ? 'M5' : (t === 'M5' ? 'M15' : (t === 'M15' ? 'H1' : 'M1'))); }}
                            style={[inp, { alignItems: 'center', justifyContent: 'center' }]}
                          >
                             <Text style={{ color: '#6366f1', fontWeight: '900', fontSize: 13 }}>{timeframe}</Text>
                          </TouchableOpacity>
                       </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                       <View style={{ flex: 1 }}>
                          <Text style={lbl}>Min Body (Pips)</Text>
                          <TextInput style={[inp, { fontSize: 18, fontWeight: '900', textAlign: 'center' }]} value={minBodyPips} onChangeText={setMinBodyPips} keyboardType="numeric" />
                       </View>
                       <View style={{ flex: 1 }}>
                          <Text style={lbl}>Max Wick (%)</Text>
                          <TextInput style={[inp, { fontSize: 18, fontWeight: '900', textAlign: 'center' }]} value={maxWickPercent} onChangeText={setMaxWickPercent} keyboardType="numeric" />
                       </View>
                    </View>

                    <View style={{ marginBottom: 12, alignItems: 'center' }}>
                        <Text style={[lbl, { color: isDark ? '#6366f1' : '#4f46e5', marginBottom: 2 }]}>Live Momentum Feed</Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>
                           {currentPrice ? `$${currentPrice.toLocaleString()}` : 'Detecting...'}
                        </Text>
                    </View>

                    <Text style={lbl}>Momentum Signal Sound</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                          {availableSounds.map(s => (
                             <TouchableOpacity 
                               key={s.id}
                               onPress={() => { setSelectedSound(s.id); playPreview(s.url, s.id); }}
                               style={{ 
                                 paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, 
                                 backgroundColor: selectedSound === s.id ? '#6366f1' : (isDark ? 'rgba(30, 41, 59, 0.4)' : '#f1f5f9'),
                                 flexDirection: 'row', alignItems: 'center', gap: 8
                               }}
                             >
                               {isPlaying === s.id ? <Pause size={14} color="#fff" /> : <Music size={14} color={selectedSound === s.id ? '#fff' : '#64748b'} />}
                               <Text style={{ fontSize: 11, fontWeight: '700', color: selectedSound === s.id ? '#fff' : (isDark ? '#94a3b8' : '#64748b') }}>{s.name}</Text>
                             </TouchableOpacity>
                          ))}
                       </ScrollView>
                    </View>

                    <TouchableOpacity 
                      onPress={createCandleAlert}
                      style={{ 
                        marginTop: 10, paddingVertical: 18, borderRadius: 24, backgroundColor: '#6366f1', 
                        alignItems: 'center', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Activate Momentum Pulse</Text>
                    </TouchableOpacity>
                 </View>
               )}
            </View>
         </View>
      </Modal>

      {/* Symbol Picker Modal */}
      <Modal visible={isSymbolModalVisible} animationType="fade" transparent={true}>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', padding: 40, justifyContent: 'center' }}>
            <View style={{ 
               backgroundColor: isDark ? '#020617' : '#ffffff', borderRadius: 32, 
               maxHeight: '80%', padding: 24, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' 
            }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>Select Ticker</Text>
                  <TouchableOpacity onPress={() => setSymbolModalVisible(false)} style={{ padding: 8 }}>
                     <X color={isDark ? '#94a3b8' : '#64748b'} size={24} />
                  </TouchableOpacity>
               </View>

               <TextInput 
                 style={[inp, { marginBottom: 16 }]} 
                 placeholder="Search symbol..." 
                 placeholderTextColor="#64748b"
                 value={symbolSearch}
                 onChangeText={setSymbolSearch}
                 autoCapitalize="characters"
               />

               <ScrollView showsVerticalScrollIndicator={false}>
                  {(symbolSearch ? allSymbols.filter(s => s.includes(symbolSearch.toUpperCase())) : allSymbols).length === 0 ? (
                    <Text style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 12 }}>No symbols found</Text>
                  ) : (
                    (symbolSearch ? allSymbols.filter(s => s.includes(symbolSearch.toUpperCase())) : allSymbols).slice(0, 100).map(s => (
                      <TouchableOpacity 
                        key={s} 
                        onPress={() => { 
                          setSymbol(s); 
                          setSymbolModalVisible(false); 
                          setSymbolSearch('');
                          Haptics.selectionAsync();
                        }}
                        style={{ 
                          paddingVertical: 14, borderBottomWidth: 1, 
                          borderBottomColor: isDark ? '#1e293b' : '#f1f5f9',
                          flexDirection: 'row', justifyContent: 'space-between'
                        }}
                      >
                         <Text style={{ fontWeight: '700', color: isDark ? '#fff' : '#020617' }}>{s}</Text>
                         {symbol === s && <Check size={16} color="#6366f1" strokeWidth={3} />}
                      </TouchableOpacity>
                    ))
                  )}
               </ScrollView>
            </View>
         </View>
      </Modal>
    </View>
  );
});

export default AlertsScreen;
