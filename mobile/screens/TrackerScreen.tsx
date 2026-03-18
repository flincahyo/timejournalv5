import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Dimensions, ScrollView
} from 'react-native';
import { useColorScheme } from 'nativewind';
import HistoryScreen from './HistoryScreen';
import StatsScreen from './StatsScreen';

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

const SUB_TABS = ['Journal', 'Analytics'];

const TrackerScreen = React.memo(({ onNavigate }: { onNavigate: (s: string) => void }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [activeTab, setActiveTab] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const indicatorAnim = useRef(new Animated.Value(0)).current;

  // onNavigate kept in scope for potential future use
  // HistoryScreen and StatsScreen manage their own data — no props needed

  const switchTab = (idx: number) => {
    setActiveTab(idx);
    Animated.spring(indicatorAnim, {
      toValue: idx,
      damping: 20, stiffness: 200, mass: 0.7, useNativeDriver: true,
    }).start();
    scrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false });
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeTab) {
      setActiveTab(idx);
      Animated.spring(indicatorAnim, {
        toValue: idx, damping: 20, stiffness: 200, useNativeDriver: true,
      }).start();
    }
  };

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
        <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? C.text.dark : C.text.light, letterSpacing: -0.5, marginBottom: 16 }}>Tracker</Text>

        <View style={{ position: 'relative' }}>
          <View style={{ flexDirection: 'row' }}>
            {SUB_TABS.map((tab, idx) => (
              <TouchableOpacity
                key={tab} onPress={() => switchTab(idx)} activeOpacity={0.7}
                style={{ width: tabWidth, paddingBottom: 12, alignItems: 'center' }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: activeTab === idx ? '900' : '600',
                  color: activeTab === idx ? (isDark ? C.text.dark : C.text.light) : (isDark ? C.text3.dark : C.text3.light),
                  letterSpacing: -0.2,
                }}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sliding indicator */}
          <View style={{ height: 2, backgroundColor: isDark ? C.border.dark : C.border.light, borderRadius: 1 }}>
            <Animated.View
              style={{
                height: 2, width: tabWidth - 24, borderRadius: 1,
                backgroundColor: C.accent,
                marginHorizontal: 12,
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
        {/* Tab 0: Journal (HistoryScreen) */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <HistoryScreen />
        </View>

        {/* Tab 1: Analytics (StatsScreen) */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          <StatsScreen />
        </View>
      </ScrollView>
    </View>
  );
});

export default TrackerScreen;
