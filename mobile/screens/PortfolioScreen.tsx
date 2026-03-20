import React, { useState, useRef, useTransition, useCallback, startTransition } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions, ScrollView, Modal, Image, 
  ActivityIndicator, KeyboardAvoidingView, Platform, TextInput, Switch
} from 'react-native';
import { useColorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, BACKEND_URL } from '../Constants';
import { Zap, LogOut, ChevronRight, CheckCircle, ShieldCheck, CreditCard, PieChart, Activity, Bell, Info, Shield, Moon, Sun, Monitor, AlertTriangle, Check, Upload, Music, X, Send, Mail, Lock, Link2, BarChart2, Camera, Save } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import MT5SettingsScreen from './MT5SettingsScreen';
import TerminalScreen from './TerminalScreen';
import AlertsScreen from './AlertsScreen';
import EconomicCalendarScreen from './EconomicCalendarScreen';
import { AvatarPickerModal } from '../components/AvatarPickerModal';
import { Skeleton, SkeletonCircle, SkeletonRect } from '../components/Skeleton';

// ── Portfolio Tab Skeleton ─────────────────────────────────────────────────────
function PortfolioTabSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar header */}
      <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 28 }}>
        <SkeletonCircle size={80} isDark={isDark} style={{ marginBottom: 14 }} />
        <SkeletonRect width={140} height={16} isDark={isDark} style={{ marginBottom: 8 }} />
        <SkeletonRect width={100} height={10} isDark={isDark} />
      </View>

      {/* Section rows */}
      {[1, 2, 3].map(s => (
        <View key={s} style={{
          backgroundColor: isDark ? '#13161f' : '#ffffff',
          borderRadius: 20, padding: 16, marginBottom: 20,
          borderWidth: 1, borderColor: isDark ? '#1e293b' : '#e8edf5',
        }}>
          <SkeletonRect width={80} height={8} isDark={isDark} style={{ marginBottom: 14 }} />
          {[1, 2].map(r => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
              <SkeletonCircle size={32} isDark={isDark} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonRect width={60} height={8} isDark={isDark} />
                <SkeletonRect width={120} height={12} isDark={isDark} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  accent: '#6366f1',
  bg: { dark: '#0b0e11', light: '#f5f7fa' },
  surface: { dark: '#13161f', light: '#ffffff' },
  border: { dark: '#1e293b', light: '#e8edf5' },
  text: { dark: '#f1f5f9', light: '#0f172a' },
  text2: { dark: '#94a3b8', light: '#64748b' },
  text3: { dark: '#475569', light: '#94a3b8' },
};

const SUB_TABS = ['Terminal', 'Alerts', 'News', 'Settings'];

const PortfolioScreen = React.memo(({ onLogout, initialTab = 0, onUserUpdated }: {
  onLogout: () => void,
  initialTab?: number,
  onUserUpdated?: (patch: Partial<any>) => void,
}) => {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isPending, startTransition] = useTransition();
  const [loadedTabs, setLoadedTabs] = useState<Record<number, boolean>>({ [initialTab]: true });
  const scrollRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(initialTab)).current;
  
  // Notification & Sound State (Centralized) — synced with AlertsScreen
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

  // Settings Load
  React.useEffect(() => {
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        
        // Load custom sounds list — append after built-ins
        const resSounds = await fetch(`${API_URL}/auth/sounds`, { headers: { Authorization: `Bearer ${token}` } });
        const dataSounds = await resSounds.json();
        if (dataSounds.custom_sounds && dataSounds.custom_sounds.length > 0) {
          setAvailableSounds([...BUILTIN_SOUNDS, ...dataSounds.custom_sounds]);
        }

        // Load persisted audio/news settings
        const resMe = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const dataMe = await resMe.json();
        if (dataMe.settings) {
          const s = dataMe.settings;
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
  }, [isNotifModalVisible]);

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

  // Scroll to initialTab on mount if needed
  React.useEffect(() => {
    if (initialTab > 0) {
      scrollRef.current?.scrollTo({ x: initialTab * SCREEN_WIDTH, animated: false });
    }
  }, []);

  const switchTab = (idx: number) => {
    startTransition(() => {
      setActiveTab(idx);
      setLoadedTabs(prev => ({ ...prev, [idx]: true }));
    });
    Animated.spring(indicatorAnim, {
      toValue: idx, damping: 20, stiffness: 200, mass: 0.7, useNativeDriver: true,
    }).start();
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: true });
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeTab) {
      startTransition(() => {
        setActiveTab(idx);
        setLoadedTabs(prev => ({ ...prev, [idx]: true }));
      });
      Animated.spring(indicatorAnim, {
        toValue: idx, damping: 20, stiffness: 200, useNativeDriver: true,
      }).start();
    }
  };

  const handleAlertsBack = useCallback(() => {
    Haptics.selectionAsync();
  }, []);

  const tabWidth = (SCREEN_WIDTH - 40) / SUB_TABS.length;

  const indicatorX = indicatorAnim.interpolate({
    inputRange: SUB_TABS.map((_, i) => i),
    outputRange: SUB_TABS.map((_, i) => i * tabWidth),
  });

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? C.bg.dark : C.bg.light }}>
      {/* ── Sub-Tab Bar ──────────────────────────────────────────────────────── */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0,
        backgroundColor: isDark ? C.bg.dark : C.bg.light,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.5, marginBottom: 16 }}>Portfolio</Text>

        <View style={{ position: 'relative' }}>
          <View style={{ flexDirection: 'row' }}>
            {SUB_TABS.map((tab, idx) => (
              <TouchableOpacity
                key={tab} onPress={() => switchTab(idx)} activeOpacity={0.7}
                style={{ width: tabWidth, paddingBottom: 12, alignItems: 'center' }}
              >
                <Text style={{
                  fontSize: 12, fontWeight: activeTab === idx ? '900' : '600',
                  color: activeTab === idx ? (isDark ? C.text.dark : C.text.light) : (isDark ? C.text3.dark : C.text3.light),
                  letterSpacing: -0.1,
                }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sliding underline indicator */}
          <View style={{ height: 2, backgroundColor: isDark ? C.border.dark : C.border.light, borderRadius: 1 }}>
            <Animated.View
              style={{
                height: 2, width: tabWidth - 24, borderRadius: 1,
                backgroundColor: C.accent, marginHorizontal: 12,
                transform: [{ translateX: indicatorX }],
              }}
            />
          </View>
        </View>
      </View>

      {/* ── Content Pages (swipeable) ─────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        style={{ flex: 1 }}
      >
        {/* Tab 0: Terminal */}
        <View style={{ width: SCREEN_WIDTH }}>
          {loadedTabs[0] ? <TerminalScreen /> : <PortfolioTabSkeleton isDark={isDark} />}
        </View>

        {/* Tab 1: Alerts */}
        <View style={{ width: SCREEN_WIDTH }}>
          {loadedTabs[1] ? <AlertsScreen onBack={handleAlertsBack} /> : <PortfolioTabSkeleton isDark={isDark} />}
        </View>

        {/* Tab 2: News (Economic Calendar) */}
        <View style={{ width: SCREEN_WIDTH }}>
          {loadedTabs[2] ? <EconomicCalendarScreen /> : <PortfolioTabSkeleton isDark={isDark} />}
        </View>

        {/* Tab 3: Settings */}
        <View style={{ width: SCREEN_WIDTH }}>
          {loadedTabs[3] ? (
            <FlatSettingsPage 
              isDark={isDark} 
              onLogout={onLogout} 
              onUserUpdated={onUserUpdated || (() => {})} 
              onOpenNotifs={() => setNotifModalVisible(true)}
            />
          ) : (
            <PortfolioTabSkeleton isDark={isDark} />
          )}
        </View>
      </ScrollView>

      <NotificationSettingsModal 
        visible={isNotifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        isDark={isDark}
        enabled={notifEnabled}
        setEnabled={(val: boolean) => { setNotifEnabled(val); saveSettings('news', { enabled: val }); }}
        priceSound={defaultPriceSound}
        setPriceSound={(id: string) => { setDefaultPriceSound(id); saveSettings('audio', { price_sound: id }); }}
        momentumSound={defaultMomentumSound}
        setMomentumSound={(id: string) => { setDefaultMomentumSound(id); saveSettings('audio', { momentum_sound: id }); }}
        newsSound={defaultNewsSound}
        setNewsSound={(id: string) => { setDefaultNewsSound(id); saveSettings('news', { sound: id }); }}
        availableSounds={availableSounds}
        setAvailableSounds={setAvailableSounds}
      />
    </View>
  );
});

// ── Flat Settings Page ─────────────────────────────────────────────────────────
const FlatSettingsPage = React.memo(function FlatSettingsPage({ 
  onLogout, 
  isDark, 
  onUserUpdated,
  onOpenNotifs
}: { 
  onLogout: () => void, 
  isDark: boolean, 
  onUserUpdated?: (patch: Partial<any>) => void,
  onOpenNotifs: () => void
}) {
  const [user, setUser] = React.useState<any>(null);
  const { toggleColorScheme, colorScheme } = useColorScheme();
  const [mt5ModalVisible, setMt5ModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Edit States
  const [editMode, setEditMode] = useState<'none' | 'profile' | 'password'>('none');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    const load = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setUser(data);
        setEditName(data.name || '');
        setEditEmail(data.email || '');
        if (data.image) setAvatarUrl(data.image);
      } catch (_) {}
    };
    load();
  }, []);

  const handleUpdateProfile = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      setError('Name and Email cannot be empty');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ name: editName, email: editEmail.toLowerCase().trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        onUserUpdated?.(data);
        setEditMode('none');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(data.detail || 'Failed to update profile');
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currPass || !newPass) {
      setError('Please fill all password fields');
      return;
    }
    if (newPass.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ current_password: currPass, new_password: newPass })
      });
      const data = await res.json();
      if (res.ok) {
        setEditMode('none');
        setCurrPass('');
        setNewPass('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(data.detail || 'Failed to change password');
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (user?.name || 'TR').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const displayName = user?.name || 'Trader';
  const bg = isDark ? '#0b0e11' : '#f5f7fa';
  const card = isDark ? '#13161f' : '#ffffff';
  const border = isDark ? '#1e293b' : '#e8edf5';
  const textP = isDark ? '#f1f5f9' : '#0f172a';
  const textM = isDark ? '#64748b' : '#94a3b8';
  const iconColor = isDark ? '#64748b' : '#94a3b8';

  const Row = ({ icon: IconComp, label, value, accent = false, last = false, onPress }: {
    icon: any, label: string, value: string, accent?: boolean, last?: boolean, onPress?: () => void
  }) => (
    <TouchableOpacity 
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
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
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: bg }}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar header — tappable */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28, paddingHorizontal: 24 }}>
          <TouchableOpacity
            onPress={() => setAvatarModalVisible(true)}
            style={{ marginBottom: 14 }}
            activeOpacity={0.85}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#6366f1' }}
              />
            ) : (
              <View style={{
                width: 80, height: 80, borderRadius: 40, backgroundColor: '#6366f1',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: isDark ? '#1e293b' : '#e0e7ff',
                shadowColor: '#6366f1', shadowOpacity: 0.28, shadowRadius: 14, elevation: 6,
              }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>{initials}</Text>
              </View>
            )}
            {/* Camera edit badge */}
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: bg,
            }}>
              <Camera size={12} color="#fff" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
              onPress={() => { Haptics.selectionAsync(); setEditMode('profile'); setError(''); }}
              style={{ alignItems: 'center' }}
          >
              <Text style={{ fontSize: 20, fontWeight: '900', color: textP, letterSpacing: -0.5, marginBottom: 4 }}>{displayName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981', letterSpacing: 0.8 }}>PRO INSTITUTIONAL</Text>
              </View>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Account section */}
          <Text style={{ fontSize: 9, fontWeight: '900', color: textM, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>ACCOUNT</Text>
          <View style={{ backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1, borderColor: border }}>
            <Row 
              icon={Mail} 
              label="Email" 
              value={user?.email || '—'} 
              onPress={() => { Haptics.selectionAsync(); setEditMode('profile'); setError(''); }}
            />
            <Row 
              icon={Lock} 
              label="Security" 
              value="Password Protected" 
              onPress={() => { Haptics.selectionAsync(); setEditMode('password'); setError(''); }}
            />
            <Row icon={Shield} label="Plan" value="Pro Institutional" accent last />
          </View>

          {/* MT5 section */}
          <Text style={{ fontSize: 9, fontWeight: '900', color: textM, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>MT5 CONNECTION</Text>
          <View style={{ backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1, borderColor: border }}>
            <TouchableOpacity
              onPress={() => setMt5ModalVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Link2 size={16} color='#6366f1' strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.5, marginBottom: 1 }}>BROKER CONNECTION</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#6366f1' }}>Manage MT5 Accounts</Text>
              </View>
              <ChevronRight size={16} color={textM} strokeWidth={2} />
            </TouchableOpacity>
            <Row icon={BarChart2} label="Sync Mode" value="Auto · Live" last />
          </View>

          {/* Preferences section */}
          <Text style={{ fontSize: 9, fontWeight: '900', color: textM, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 }}>PREFERENCES</Text>
          <View style={{ backgroundColor: card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 28, borderWidth: 1, borderColor: border }}>
            <TouchableOpacity
              onPress={() => startTransition(() => { toggleColorScheme(); })}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: border }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                {colorScheme === 'dark'
                  ? <Moon size={16} color={iconColor} strokeWidth={2} />
                  : <Sun size={16} color={iconColor} strokeWidth={2} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.5, marginBottom: 1 }}>APPEARANCE</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: textP }}>{colorScheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</Text>
              </View>
              {/* Toggle switch */}
              <View style={{
                backgroundColor: colorScheme === 'dark' ? '#6366f1' : '#e2e8f0',
                width: 44, height: 26, borderRadius: 13,
                justifyContent: 'center', paddingHorizontal: 2,
                alignItems: colorScheme === 'dark' ? 'flex-end' : 'flex-start'
              }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2 }} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => { Haptics.selectionAsync(); onOpenNotifs(); }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
            >
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <Bell size={16} color={iconColor} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: textM, letterSpacing: 0.5, marginBottom: 1 }}>NOTIFICATIONS</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: textP }}>Configure</Text>
              </View>
              <ChevronRight size={16} color={textM} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Sign out */}
          <TouchableOpacity
            onPress={onLogout}
            style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}
          >
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
                    <TextInput 
                        style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }}
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Your Nickname"
                        placeholderTextColor="#64748b"
                    />
                </View>
                <View>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Email Address</Text>
                    <TextInput 
                        style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }}
                        value={editEmail}
                        onChangeText={setEditEmail}
                        placeholder="email@example.com"
                        placeholderTextColor="#64748b"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>
            </View>

            <TouchableOpacity 
                onPress={handleUpdateProfile}
                disabled={submitting}
                style={{ backgroundColor: '#6366f1', paddingVertical: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
                {submitting ? <ActivityIndicator color="#ffffff" /> : (
                    <>
                        <Save size={20} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>Save Identity</Text>
                    </>
                )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
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
                    <TextInput 
                        style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }}
                        value={currPass}
                        onChangeText={setCurrPass}
                        secureTextEntry
                        placeholder="••••••••"
                        placeholderTextColor="#64748b"
                    />
                </View>
                <View>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>New Password</Text>
                    <TextInput 
                        style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', padding: 16, borderRadius: 16, color: isDark ? '#ffffff' : '#0f172a', fontWeight: 'bold' }}
                        value={newPass}
                        onChangeText={setNewPass}
                        secureTextEntry
                        placeholder="Min 6 characters"
                        placeholderTextColor="#64748b"
                    />
                </View>
            </View>

            <TouchableOpacity 
                onPress={handleChangePassword}
                disabled={submitting}
                style={{ backgroundColor: '#10b981', paddingVertical: 18, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
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
      <Modal
        visible={mt5ModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMt5ModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
          {/* Modal Header */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            paddingHorizontal: 20, paddingVertical: 16, paddingTop: 52,
            borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e8edf5',
          }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#f1f5f9' : '#0f172a', letterSpacing: -0.5 }}>MT5 Connection</Text>
            <TouchableOpacity
              onPress={() => setMt5ModalVisible(false)}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} color={isDark ? '#94a3b8' : '#64748b'} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <MT5SettingsScreen />
        </View>
      </Modal>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        visible={avatarModalVisible}
        currentImage={avatarUrl}
        isDark={isDark}
        onClose={() => setAvatarModalVisible(false)}
        onAvatarUpdated={(url) => {
          setAvatarUrl(url);
          setAvatarModalVisible(false);
          // Propagate to App.tsx — updates sharedUser → HomeScreen instantly
          onUserUpdated?.({ image: url });
        }}
      />
    </>
  );
});

export default PortfolioScreen;

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
      // Support new format where id IS the url, and old format with separate .url field
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

  const testPushNotification = async () => {
    import('expo-haptics').then(Haptics => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    // Play the currently selected price sound (which uses full URL in built-in sounds)
    const soundUrl = priceSound && priceSound.startsWith('http') ? priceSound : null;
    if (soundUrl) {
      try {
        const { createAudioPlayer } = await import('expo-audio');
        const player = createAudioPlayer(soundUrl);
        player.play();
      } catch (_) {}
    }
    try {
      const Notifications = await import('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Signal Detected 🎯",
          body: "Push notifications are active and working flawlessly on your device.",
          sound: true,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn("Test notification failed:", e);
      alert("Failed to send test notification. Ensure permissions are granted.");
    }
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
        
        // Auto-select for the category
        if (category === 'price') setPriceSound(ns.id);
        else if (category === 'momentum') setMomentumSound(ns.id);
        else if (category === 'news') setNewsSound(ns.id);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) { console.error(e); } finally { setUploading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
        <View style={{ height: '75%', backgroundColor: isDark ? '#020617' : '#ffffff', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: textP }}>Notification & Audio</Text>
                <Text style={{ fontSize: 10, fontWeight: 'bold', color: textM, textTransform: 'uppercase' }}>Central Signal Management</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} color={textM} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
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

            <View style={{ marginBottom: 32 }}>
               <TouchableOpacity 
                 onPress={testPushNotification}
                 style={{ 
                   flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                   backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 20,
                   shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }
                 }}
               >
                 <Send size={18} color="#fff" />
                 <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>Send Test Notification</Text>
               </TouchableOpacity>
            </View>

            <View style={{ padding: 24, borderRadius: 28, backgroundColor: isDark ? 'rgba(30, 41, 59, 0.3)' : '#f8fafc', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1' }}>
               <Text style={{ color: textM, fontSize: 11, textAlign: 'center' }}>Upload custom .mp3 files using the upload icon next to each category title. Each category maintains its own signature sound for instant identification.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


