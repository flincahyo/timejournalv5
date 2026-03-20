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
import AlertsScreen from './AlertsScreen';
import EconomicCalendarScreen from './EconomicCalendarScreen';
import TerminalScreen from './TerminalScreen';
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

const SUB_TABS = ['Terminal', 'Alerts', 'News'];

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
  // Notification state moved to SettingsModal

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

      </ScrollView>
    </View>
  );
});

export default PortfolioScreen;
