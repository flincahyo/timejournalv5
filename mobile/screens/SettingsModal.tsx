import React, { useState, useRef, useTransition, useCallback, startTransition } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, Image, 
  ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, Switch,
  Animated, Dimensions
} from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, BACKEND_URL } from '../Constants';
import { 
  LogOut, ChevronRight, Bell, Moon, Sun, X, Lock, Link2, BarChart2, 
  Upload, Music, Send, Camera, ArrowLeft
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import MT5SettingsScreen from './MT5SettingsScreen';
import { AvatarPickerModal } from '../components/AvatarPickerModal';

// ── Notification Settings Modal ───────────────────────────────────────────────
function NotificationSettingsModal({ 
  visible, onClose, isDark, enabled, setEnabled, 
  priceSound, setPriceSound, momentumSound, setMomentumSound,
  newsSound, setNewsSound,
  availableSounds, setAvailableSounds
}: any) {
  const [uploading, setUploading] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

  const card = isDark ? '#13161f' : '#ffffff';
  const textP = isDark ? '#f1f5f9' : '#0f172a';
  const textM = isDark ? '#64748b' : '#94a3b8';

  const playPreview = async (soundUrl: string | null, id: string) => {
    try {
      const resolvedUrl = soundUrl || (id && id.startsWith('http') ? id : null);
      if (isPlaying === id) { if (playerRef.current) playerRef.current.pause(); setIsPlaying(null); return; }
      if (resolvedUrl) {
        const { createAudioPlayer } = await import('expo-audio');
        if (!playerRef.current) playerRef.current = createAudioPlayer(resolvedUrl);
        else playerRef.current.replace(resolvedUrl);
        setIsPlaying(id);
        playerRef.current.play();
        const sub = playerRef.current.addListener('playbackStatusUpdate', (s: any) => {
          if (s.didJustFinish) { setIsPlaying(null); sub.remove(); }
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsPlaying(id);
        setTimeout(() => setIsPlaying(null), 1000);
      }
    } catch (e) { console.log('Playback error'); }
  };

  const registerAndShowPushToken = async () => {
    import('expo-haptics').then(H => H.impactAsync(H.ImpactFeedbackStyle.Medium));
    const { Alert: RNAlert } = await import('react-native');
    try {
      const Notifications = await import('expo-notifications');
      const Constants = (await import('expo-constants')).default;

      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        RNAlert.alert('❌ Permission Denied', `Push permission status: ${status}`);
        return;
      }

      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? 'bbe7e363-2fca-4820-88c6-06f988ceb456';
      RNAlert.alert('⏳ Getting Token...', `projectId: ${projectId}`);
      
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = result.data;

      const jwt = await AsyncStorage.getItem('userToken');
      let backendMsg = 'No JWT — not registered';
      if (jwt) {
        const res = await fetch(`${API_URL}/push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        backendMsg = data.ok ? '✅ Registered to backend!' : `❌ Backend error: ${JSON.stringify(data)}`;
      }

      RNAlert.alert('✅ Push Token', `${token}\n\n${backendMsg}`);
    } catch (e: any) {
      const { Alert: RNAlert2 } = await import('react-native');
      RNAlert2.alert('❌ Push Token Error', e?.message || String(e));
    }
  };

  const testLocalNotification = async () => {
    import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    const soundUrl = priceSound && priceSound.startsWith('http') ? priceSound : null;
    if (soundUrl) {
      try { const { createAudioPlayer } = await import('expo-audio'); createAudioPlayer(soundUrl).play(); } catch (_) {}
    }
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: { title: "Test Signal Detected 🎯", body: "Local notification is working correctly.", sound: true },
        trigger: null,
      });
    } catch (e) { alert("Failed to send test notification."); }
  };

  const uploadToCategory = async (category: 'price' | 'momentum' | 'news') => {
    try {
      const result: any = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      setUploading(true);
      const file = result.assets[0];
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'audio/mpeg' });
      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/upload-sound`, {
        method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: formData
      });
      const data = await res.json();
      if (data.url) {
        const ns = { id: data.url, name: data.name || file.name, url: data.url };
        setAvailableSounds([...availableSounds, ns]);
        if (category === 'price') setPriceSound(ns.id);
        else if (category === 'momentum') setMomentumSound(ns.id);
        else if (category === 'news') setNewsSound(ns.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) { console.error(e); } finally { setUploading(false); }
  };

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideN = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  React.useEffect(() => {
    Animated.spring(slideN, {
      toValue: visible ? 0 : SCREEN_HEIGHT,
      damping: 24, stiffness: 220, useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View 
      style={{ position: 'absolute', inset: 0, zIndex: 110, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa', transform: [{ translateY: slideN }] }}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={{ flex: 1, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
          backgroundColor: card, borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e8edf5',
        }}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.75}
            style={{
              width: 38, height: 38, borderRadius: 13,
              backgroundColor: isDark ? '#1c2030' : '#f1f5f9',
              alignItems: 'center', justifyContent: 'center', marginRight: 14,
            }}
          >
            <ArrowLeft size={20} color={textM} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: textP, letterSpacing: -0.5 }}>
              Notification & Audio
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.8 }}>
              CENTRAL SIGNAL MANAGEMENT
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }}>
            {/* Global Switch */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: card, padding: 20, borderRadius: 24, marginBottom: 32, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
               <View>
                  <Text style={{ color: textP, fontWeight: '900', fontSize: 15 }}>Master Alerts</Text>
                  <Text style={{ color: textM, fontSize: 11 }}>Enable all push notifications</Text>
               </View>
               <Switch value={enabled} onValueChange={setEnabled} trackColor={{ false: '#1e293b', true: '#6366f1' }} />
            </View>

            <Text style={{ fontSize: 10, fontWeight: '900', color: textM, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }}>Default Audio Signatures</Text>
            
            <View style={{ gap: 12, marginBottom: 32 }}>
               {/* Price Alerts */}
               <View style={{ backgroundColor: card, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: textM }}>PRICE ALERTS</Text>
                    <TouchableOpacity onPress={() => uploadToCategory('price')} disabled={uploading}>
                       <Upload size={14} color="#6366f1" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
               {availableSounds.map((s: any) => (
                  <TouchableOpacity key={s.id} onPress={() => { setPriceSound(s.id); playPreview(s.url, s.id); }} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: priceSound === s.id ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                     <Music size={12} color={priceSound === s.id ? '#fff' : textM} />
                     <Text style={{ fontSize: 11, fontWeight: '700', color: priceSound === s.id ? '#fff' : textM }}>{s.name}</Text>
                  </TouchableOpacity>
               ))}
                  </ScrollView>
               </View>

               {/* Momentum Pulse */}
               <View style={{ backgroundColor: card, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: textM }}>MOMENTUM PULSE</Text>
                    <TouchableOpacity onPress={() => uploadToCategory('momentum')} disabled={uploading}>
                       <Upload size={14} color="#6366f1" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                     {availableSounds.map((s: any) => (
                        <TouchableOpacity key={s.id} onPress={() => { setMomentumSound(s.id); playPreview(s.url, s.id); }} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: momentumSound === s.id ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Music size={12} color={momentumSound === s.id ? '#fff' : textM} />
                           <Text style={{ fontSize: 11, fontWeight: '700', color: momentumSound === s.id ? '#fff' : textM }}>{s.name}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>
               </View>

               {/* News Alerts */}
               <View style={{ backgroundColor: card, padding: 16, borderRadius: 24, borderWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: textM }}>NEWS ALERT SIGNATURE</Text>
                    <TouchableOpacity onPress={() => uploadToCategory('news')} disabled={uploading}>
                       <Upload size={14} color="#6366f1" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                     {availableSounds.map((s: any) => (
                        <TouchableOpacity key={s.id} onPress={() => { setNewsSound(s.id); playPreview(s.url, s.id); }} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: newsSound === s.id ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'), flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                           <Music size={12} color={newsSound === s.id ? '#fff' : textM} />
                           <Text style={{ fontSize: 11, fontWeight: '700', color: newsSound === s.id ? '#fff' : textM }}>{s.name}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>
               </View>
            </View>

            <View style={{ marginBottom: 16, gap: 10 }}>
               <TouchableOpacity 
                 onPress={registerAndShowPushToken}
                 style={{ 
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                   backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 20,
                   shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
                 }}
               >
                 <Bell size={18} color="#fff" />
                 <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>Register Push Token</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 onPress={testLocalNotification}
                 style={{ 
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                   backgroundColor: isDark ? '#1e293b' : '#f1f5f9', paddingVertical: 14, borderRadius: 20,
                   borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0'
                 }}
               >
                 <Send size={16} color={textM} />
                 <Text style={{ color: textM, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>Test Local Notification</Text>
               </TouchableOpacity>
            </View>
           </ScrollView>
      </View>
    </Animated.View>
  );
}

// ── Main Settings Modal ────────────────────────────────────────────────────────
export default function SettingsModal({ 
  visible,
  onClose,
  onLogout, 
  onUserUpdated,
}: { 
  visible: boolean;
  onClose: () => void;
  onLogout: () => void; 
  onUserUpdated?: (patch: Partial<any>) => void;
}) {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [user, setUser] = useState<any>(null);
  
  const [mt5ModalVisible, setMt5ModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Animation States
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const slideYMT5 = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeBg = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: visible ? 0 : SCREEN_HEIGHT,
        damping: 24,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeBg, {
        toValue: visible ? 1 : 0,
        duration: visible ? 250 : 200,
        useNativeDriver: true,
      })
    ]).start();
  }, [visible]);

  React.useEffect(() => {
    Animated.spring(slideYMT5, {
      toValue: mt5ModalVisible ? 0 : SCREEN_HEIGHT,
      damping: 24,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [mt5ModalVisible]);

  // Edit States
  const [editMode, setEditMode] = useState<'none' | 'profile' | 'password'>('none');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Notification states
  const WEB_URL = 'https://timejournal.site';
  const BUILTIN_SOUNDS = [
    { id: `${WEB_URL}/sounds/alert.mp3`,  name: 'Standard Alert' },
    { id: `${WEB_URL}/sounds/modern.mp3`, name: 'Modern notification' },
    { id: `${WEB_URL}/sounds/beep.mp3`,   name: 'Digital beep' },
    { id: `${WEB_URL}/sounds/chime.mp3`,  name: 'Success chime' },
  ];
  const [isNotifModalVisible, setNotifModalVisible] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [defaultPriceSound, setDefaultPriceSound] = useState(BUILTIN_SOUNDS[0].id);
  const [defaultMomentumSound, setDefaultMomentumSound] = useState(BUILTIN_SOUNDS[0].id);
  const [defaultNewsSound, setDefaultNewsSound] = useState(BUILTIN_SOUNDS[0].id);
  const [availableSounds, setAvailableSounds] = useState<any[]>(BUILTIN_SOUNDS);

  React.useEffect(() => {
    if (!visible) return;
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;
        
        // Load sounds
        const resSounds = await fetch(`${API_URL}/auth/sounds`, { headers: { Authorization: `Bearer ${token}` } });
        const dataSounds = await resSounds.json();
        if (dataSounds.custom_sounds && dataSounds.custom_sounds.length > 0) {
          setAvailableSounds([...BUILTIN_SOUNDS, ...dataSounds.custom_sounds]);
        }

        const resMe = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await resMe.json();
        setUser(data);
        setEditName(data.name || '');
        setEditEmail(data.email || '');
        if (data.image) setAvatarUrl(data.image);

        if (data.settings) {
          const s = data.settings;
          if (s.audio_settings) {
            if (s.audio_settings.price_sound) setDefaultPriceSound(s.audio_settings.price_sound);
            if (s.audio_settings.momentum_sound) setDefaultMomentumSound(s.audio_settings.momentum_sound);
          }
          if (s.news_settings) {
            setNotifEnabled(s.news_settings.enabled ?? true);
            if (s.news_settings.sound) setDefaultNewsSound(s.news_settings.sound);
          }
        }
      } catch (_) {}
    };
    load();
  }, [visible, isNotifModalVisible]);

  const saveSettings = async (type: 'audio' | 'news', patch: any) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const endpoint = type === 'audio' ? '/api/auth/audio-settings' : '/api/auth/news-settings';
      await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch)
      });
    } catch (e) { console.error("Error saving settings:", e); }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) { setError('Name and Email cannot be empty'); return; }
    setError(''); setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, email: editEmail.toLowerCase().trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data); onUserUpdated?.(data); setEditMode('none');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else { setError(data.detail || 'Failed to update profile'); }
    } catch (e) { setError('Connection error'); } finally { setSubmitting(false); }
  };

  const handleChangePassword = async () => {
    if (!currPass || !newPass) { setError('Please fill all password fields'); return; }
    if (newPass.length < 6) { setError('New password must be at least 6 characters'); return; }
    setError(''); setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: currPass, new_password: newPass })
      });
      const data = await res.json();
      if (res.ok) {
        setEditMode('none'); setCurrPass(''); setNewPass('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else { setError(data.detail || 'Failed to change password'); }
    } catch (e) { setError('Connection error'); } finally { setSubmitting(false); }
  };

  const initials = (user?.name || 'TR').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const displayName = user?.name || 'Trader';
  const bg = isDark ? '#0b0e11' : '#f5f7fa';
  const card = isDark ? '#13161f' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e8edf5';
  const textP = isDark ? '#f1f5f9' : '#0f172a';
  const textM = isDark ? '#64748b' : '#94a3b8';
  const iconColor = isDark ? '#64748b' : '#94a3b8';

  const Row = ({ icon: IconComp, label, value, accent = false, last = false, onPress }: any) => (
    <TouchableOpacity 
      activeOpacity={onPress ? 0.7 : 1} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: border }}
    >
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <IconComp size={16} color={accent ? '#6366f1' : iconColor} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.5, marginBottom: 1 }}>{label.toUpperCase()}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: accent ? '#6366f1' : textP }}>{value}</Text>
      </View>
      {onPress && <ChevronRight size={16} color={textM} strokeWidth={2} />}
    </TouchableOpacity>
  );

  return (
    <Animated.View 
      style={{ position: 'absolute', inset: 0, zIndex: 100, backgroundColor: bg, transform: [{ translateY: slideY }] }}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: bg }}>
          
          {/* Header (Matching NotificationCenterScreen precisely) */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
            backgroundColor: isDark ? '#13161f' : '#ffffff', borderBottomWidth: 1, borderBottomColor: border,
          }}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onClose(); }} activeOpacity={0.75}
              style={{
                width: 38, height: 38, borderRadius: 13,
                backgroundColor: isDark ? '#1c2030' : '#f1f5f9',
                alignItems: 'center', justifyContent: 'center', marginRight: 14,
              }}
            >
              <ArrowLeft size={20} color={textM} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: textP, letterSpacing: -0.5 }}>
                Settings & Profile
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.8 }}>
                ACCOUNT CONFIGURATION
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1, backgroundColor: bg }}
            contentContainerStyle={{ paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar header */}
            <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 28, paddingHorizontal: 24 }}>
              <TouchableOpacity onPress={() => setAvatarModalVisible(true)} style={{ marginBottom: 14 }} activeOpacity={0.85}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#6366f1' }} />
                ) : (
                  <View style={{
                    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1',
                    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: isDark ? '#1e293b' : '#e0e7ff',
                  }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff' }}>{initials}</Text>
                  </View>
                )}
                <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: isDark ? '#1e293b' : '#ffffff', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: bg }}>
                  <Camera size={14} color={isDark ? '#cbd5e1' : '#64748b'} />
                </View>
              </TouchableOpacity>
              <Text style={{ fontSize: 24, fontWeight: '900', color: textP, letterSpacing: -0.5, marginBottom: 4 }}>{displayName}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textM }}>{user?.email || 'user@example.com'}</Text>
            </View>

            {/* Profile fields */}
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: textM, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>ACCOUNT</Text>
              <View style={{ backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1, borderColor: border }}>
                <Row icon={Lock} label="Identity" value={user?.name || 'Set Identity'} onPress={() => { setEditName(user?.name || ''); setEditEmail(user?.email || ''); setError(''); setEditMode('profile'); }} />
                <Row icon={Lock} label="Security" value="Change Password" onPress={() => { setCurrPass(''); setNewPass(''); setError(''); setEditMode('password'); }} />
                <Row icon={Link2} label="Broker Connection" value="Manage MT5 Accounts" accent onPress={() => setMt5ModalVisible(true)} last />
              </View>

              {/* Preferences */}
              <Text style={{ fontSize: 9, fontWeight: '900', color: textM, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>PREFERENCES</Text>
              <View style={{ backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1, borderColor: border }}>
                <TouchableOpacity onPress={() => startTransition(() => { toggleColorScheme(); })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    {colorScheme === 'dark' ? <Moon size={16} color={iconColor} strokeWidth={2} /> : <Sun size={16} color={iconColor} strokeWidth={2} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.5, marginBottom: 1 }}>APPEARANCE</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: textP }}>{colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</Text>
                  </View>
                  <View style={{ backgroundColor: colorScheme === 'dark' ? '#6366f1' : '#e2e8f0', width: 44, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 2, alignItems: colorScheme === 'dark' ? 'flex-end' : 'flex-start' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2 }} />
                  </View>
                </TouchableOpacity>
                <Row icon={Bell} label="Notifications" value="Configure" onPress={() => { Haptics.selectionAsync(); setNotifModalVisible(true); }} last />
              </View>

              {/* Sign out */}
              <TouchableOpacity onPress={onLogout} style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                <LogOut size={18} color="#ef4444" strokeWidth={2} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#ef4444', letterSpacing: 0.5 }}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Edit Profile Modal */}
          <Modal visible={editMode === 'profile'} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
              <View style={{ backgroundColor: isDark ? '#13161f' : '#ffffff', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>Identity</Text>
                    <TouchableOpacity onPress={() => setEditMode('none')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
                    </TouchableOpacity>
                </View>

                {error ? <Text style={{ color: '#ef4444', marginBottom: 16, fontSize: 13, fontWeight: '600' }}>{error}</Text> : null}

                <View style={{ gap: 16, marginBottom: 32 }}>
                    <View>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Nickname</Text>
                        <TextInput style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }} value={editName} onChangeText={setEditName} placeholder="Your Nickname" placeholderTextColor="#64748b" />
                    </View>
                    <View>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Email Address</Text>
                        <TextInput style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }} value={editEmail} onChangeText={setEditEmail} placeholder="email@example.com" placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none" />
                    </View>
                </View>

                <TouchableOpacity onPress={handleUpdateProfile} disabled={submitting} style={{ backgroundColor: '#6366f1', paddingVertical: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    {submitting ? <ActivityIndicator color="#ffffff" /> : (
                        <>
                            <Lock size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Save Changes</Text>
                        </>
                    )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* Edit Password Modal */}
          <Modal visible={editMode === 'password'} transparent animationType="fade">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
              <View style={{ backgroundColor: isDark ? '#13161f' : '#ffffff', borderRadius: 32, padding: 32, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>Security</Text>
                    <TouchableOpacity onPress={() => setEditMode('none')} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={20} color={isDark ? '#cbd5e1' : '#64748b'} />
                    </TouchableOpacity>
                </View>

                {error ? <Text style={{ color: '#ef4444', marginBottom: 16, fontSize: 13, fontWeight: '600' }}>{error}</Text> : null}

                <View style={{ gap: 16, marginBottom: 32 }}>
                    <View>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Current Password</Text>
                        <TextInput style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }} value={currPass} onChangeText={setCurrPass} secureTextEntry placeholder="Enter current password" placeholderTextColor="#64748b" />
                    </View>
                    <View>
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>New Password</Text>
                        <TextInput style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }} value={newPass} onChangeText={setNewPass} secureTextEntry placeholder="Min 6 characters" placeholderTextColor="#64748b" />
                    </View>
                </View>

                <TouchableOpacity onPress={handleChangePassword} disabled={submitting} style={{ backgroundColor: '#10b981', paddingVertical: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    {submitting ? <ActivityIndicator color="#ffffff" /> : (
                        <>
                            <Lock size={20} color="#ffffff" />
                            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Apply Security</Text>
                        </>
                    )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* MT5 Settings Modal */}
          <Animated.View 
            style={{ position: 'absolute', inset: 0, zIndex: 110, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa', transform: [{ translateY: slideYMT5 }] }}
            pointerEvents={mt5ModalVisible ? 'auto' : 'none'}
          >
            <View style={{ flex: 1, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa' }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
                backgroundColor: isDark ? '#13161f' : '#ffffff', borderBottomWidth: 1, borderBottomColor: border,
              }}>
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMt5ModalVisible(false); }} activeOpacity={0.75}
                  style={{
                    width: 38, height: 38, borderRadius: 13,
                    backgroundColor: isDark ? '#1c2030' : '#f1f5f9',
                    alignItems: 'center', justifyContent: 'center', marginRight: 14,
                  }}
                >
                  <ArrowLeft size={20} color={textM} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: textP, letterSpacing: -0.5 }}>
                    MT5 Connection
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.8 }}>
                    BROKER MANAGEMENT
                  </Text>
                </View>
              </View>
              <MT5SettingsScreen />
            </View>
          </Animated.View>

          {/* Avatar Picker Modal */}
          <AvatarPickerModal visible={avatarModalVisible} currentImage={avatarUrl} isDark={isDark} onClose={() => setAvatarModalVisible(false)} onAvatarUpdated={(url) => { setAvatarUrl(url); setAvatarModalVisible(false); onUserUpdated?.({ image: url }); }} />
          <NotificationSettingsModal visible={isNotifModalVisible} onClose={() => setNotifModalVisible(false)} isDark={isDark} enabled={notifEnabled} setEnabled={(val: boolean) => { setNotifEnabled(val); saveSettings('news', { enabled: val }); }} priceSound={defaultPriceSound} setPriceSound={(id: string) => { setDefaultPriceSound(id); saveSettings('audio', { price_sound: id }); }} momentumSound={defaultMomentumSound} setMomentumSound={(id: string) => { setDefaultMomentumSound(id); saveSettings('audio', { momentum_sound: id }); }} newsSound={defaultNewsSound} setNewsSound={(id: string) => { setDefaultNewsSound(id); saveSettings('news', { sound: id }); }} availableSounds={availableSounds} setAvailableSounds={setAvailableSounds} />

        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
