import React, { useState, useRef, useEffect, useCallback, useTransition, startTransition } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View, ScrollView, Dimensions, Text, TouchableOpacity,
  BackHandler, ToastAndroid, Animated, Platform, UIManager,
  Image, Easing
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Montserrat_400Regular, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BookOpen, Home, Briefcase } from 'lucide-react-native';
import Reanimated, { 
  FadeIn, FadeOut, 
  SlideInRight, SlideOutLeft, 
  SlideInLeft, SlideOutRight,
  useSharedValue, useAnimatedStyle, withSpring
} from 'react-native-reanimated';
import './global.css';

// Screens
import HomeScreen from './screens/HomeScreen';
import TrackerScreen from './screens/TrackerScreen';
import PortfolioScreen from './screens/PortfolioScreen';
import SettingsModal from './screens/SettingsModal';
import { AIChatScreen } from './screens/AIChatScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import NotificationCenterScreen from './screens/NotificationCenterScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useMT5Sync } from './hooks/useMT5Sync';
import { API_URL } from './Constants';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Color palette ─────────────────────────────────────────────────────────────
const ACCENT = '#6366f1';
const ACCENT2 = '#8b5cf6';

// ── Tab definitions ───────────────────────────────────────────────────────────
// Tab order matches BLU ref: Tracker(0) | Home(1) | Portfolio(2)
// Default active = 1 (Home)
const TABS = [
  { id: 'tracker',   label: 'Tracker',   Icon: BookOpen  },
  { id: 'home',      label: 'Home',      Icon: Home      },
  { id: 'portfolio', label: 'Portfolio', Icon: Briefcase },
];
const DEFAULT_TAB = 1;

// ── Top Navigation Bar — pill driven by scrollX in real-time ────────────────
const TopNavBar = React.memo(({
  scrollX, onTabPress, isDark,
}: {
  scrollX: Animated.Value;
  onTabPress: (i: number) => void;
  isDark: boolean;
}) => {
  return (
    <View style={{
      flexDirection: 'row',
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      {TABS.map((tab, i) => {
        const { Icon } = tab;

        // ── Pill: opacity fades in steeply as you center on this tab ──────────
        const pillOpacity = scrollX.interpolate({
          inputRange: [(i - 0.55) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 0.55) * SCREEN_WIDTH],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });
        // Pill scale: grows from 0.82 → 1 as it appears (smooth materialize)
        const pillScale = scrollX.interpolate({
          inputRange: [(i - 0.55) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 0.55) * SCREEN_WIDTH],
          outputRange: [0.82, 1, 0.82],
          extrapolate: 'clamp',
        });
        // Pill floats up slightly as it materializes
        const pillTranslateY = scrollX.interpolate({
          inputRange: [(i - 0.55) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 0.55) * SCREEN_WIDTH],
          outputRange: [3, 0, 3],
          extrapolate: 'clamp',
        });
        // Icon scale pulses from 0.88 → 1.0
        const iconScale = scrollX.interpolate({
          inputRange: [(i - 0.55) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 0.55) * SCREEN_WIDTH],
          outputRange: [0.88, 1, 0.88],
          extrapolate: 'clamp',
        });
        // Label fades in fast only near center
        const labelOpacity = scrollX.interpolate({
          inputRange: [(i - 0.35) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 0.35) * SCREEN_WIDTH],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });

        // Label container maxWidth: 0 (no space) → 80 (full label visible)
        const labelMaxWidth = scrollX.interpolate({
          inputRange: [(i - 0.45) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 0.45) * SCREEN_WIDTH],
          outputRange: [0, 80, 0],
          extrapolate: 'clamp',
        });

        return (
          <View key={tab.id} style={{ width: 105, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => onTabPress(i)}
              activeOpacity={0.75}
              style={{ alignItems: 'center', justifyContent: 'center', width: 105 }}
            >
              {/* Animated pill background — scales + floats up as it materializes */}
              <Animated.View style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 24,
                backgroundColor: '#ffffff',
                opacity: pillOpacity,
                shadowColor: '#000',
                shadowOpacity: 0.10,
                shadowRadius: 8,
                elevation: 3,
                transform: [{ scale: pillScale }, { translateY: pillTranslateY }],
              }} />

              {/* Icon + Label in a centered flex row.
                  Label container has maxWidth 0→80 so when collapsed it takes
                  no space — icon stays centered. When expanded, row grows and
                  the icon naturally shifts left. */}
              <Animated.View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 9,
                paddingHorizontal: 14,
                alignSelf: 'center',
                transform: [{ scale: iconScale }],
              }}>
                {/* Dual-icon for color crossfade */}
                <View style={{ width: 16, height: 16 }}>
                  <Animated.View style={{ position: 'absolute', opacity: Animated.subtract(1, pillOpacity) }}>
                    <Icon size={16} strokeWidth={2} color="rgba(255,255,255,0.70)" />
                  </Animated.View>
                  <Animated.View style={{ position: 'absolute', opacity: pillOpacity }}>
                    <Icon size={16} strokeWidth={2.5} color="#6366f1" />
                  </Animated.View>
                </View>

                {/* Label: maxWidth collapses to 0 so zero layout space when inactive */}
                <Animated.View style={{ maxWidth: labelMaxWidth, overflow: 'hidden' }}>
                  <Animated.Text style={{
                    fontSize: 13, fontWeight: '800', letterSpacing: -0.2,
                    color: '#6366f1',
                    opacity: labelOpacity,
                  }}>
                    {tab.label}
                  </Animated.Text>
                </Animated.View>
              </Animated.View>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
});

// ── Portfolio ref for jumping to Settings ─────────────────────────────────────
function MainApp() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const scrollX = useRef(new Animated.Value(DEFAULT_TAB * SCREEN_WIDTH)).current;
  const [activeTab, setActiveTab] = useState(DEFAULT_TAB);
  const [isPending, startTransitionLocal] = useTransition();
  const [loadedTabs, setLoadedTabs] = useState<Record<number, boolean>>({ [DEFAULT_TAB]: true });
  const [authLoaded, setAuthLoaded] = useState<Record<string, boolean>>({ login: true });
  const scrollRef = useRef<any>(null);
  const [backClickCount, setBackClickCount] = useState(0);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [appReady, setAppReady] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [portfolioInitialTab, setPortfolioInitialTab] = useState(0);
  // Shared user state — single source of truth for both Home + Settings
  const [sharedUser, setSharedUser] = useState<any>(null);

  // Settings Modal & AI Chat
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatData, setAIChatData] = useState<{ trades: any[]; stats: any; guardStatus?: 'normal' | 'loss_limit' | 'profit_goal'; dailyPnL?: number; guardSettings?: any }>({ trades: [], stats: undefined, guardStatus: 'normal', dailyPnL: 0 });

  // Notification Center
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifSlide = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const { trades: notifTrades } = useMT5Sync();

  const prevTradesCountRef = useRef<number>(-1); // -1 = not yet initialised

  // Detect new trades and instantly light up the dot
  useEffect(() => {
    if (notifTrades.length === 0) return;

    const prev = prevTradesCountRef.current;

    if (prev === -1) {
      // First load: compare timestamps against last-opened to restore badge on restart
      (async () => {
        const lastOpened = await AsyncStorage.getItem('notif_last_opened');
        const lastTs = lastOpened ? new Date(lastOpened).getTime() : 0;
        const newCount = notifTrades.filter((t: any) => {
          const ds = t.closeTime || t.openTime || '';
          if (!ds) return false;
          try {
            const normalized = ds.includes(' ') && !ds.includes('T') ? ds.replace(' ', 'T') : ds;
            return new Date(normalized).getTime() > lastTs;
          } catch { return false; }
        }).length;
        setUnreadCount(Math.min(newCount, 20));
        prevTradesCountRef.current = notifTrades.length;
      })();
    } else if (notifTrades.length > prev) {
      // New trades arrived — increment immediately, no async lookup needed
      setUnreadCount((c: number) => Math.min(c + (notifTrades.length - prev), 20));
      prevTradesCountRef.current = notifTrades.length;
    } else {
      prevTradesCountRef.current = notifTrades.length;
    }
  }, [notifTrades]);

  const openNotifications = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Slide in
    Animated.spring(notifSlide, {
      toValue: 0, damping: 22, stiffness: 200, useNativeDriver: true,
    }).start();
    setShowNotifications(true);
    // Mark as read
    AsyncStorage.setItem('notif_last_opened', new Date().toISOString());
    setUnreadCount(0);
  }, [notifSlide]);

  const closeNotifications = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(notifSlide, {
      toValue: SCREEN_WIDTH, damping: 22, stiffness: 200, useNativeDriver: true,
    }).start(() => setShowNotifications(false));
  }, [notifSlide]);

  usePushNotifications();

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const logoutFlag = await AsyncStorage.getItem('logged_out');
      setUserToken(token && logoutFlag !== 'true' ? token : null);
    } catch (e) {
      console.error(e);
    } finally {
      setAppReady(true);
      // If we just logged in (from null to token), reset to Home
      if (userToken === null) {
        setActiveTab(DEFAULT_TAB);
        setPortfolioInitialTab(0);
        scrollRef.current?.scrollTo({ x: DEFAULT_TAB * SCREEN_WIDTH, animated: false });
      }
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.setItem('logged_out', 'true');
      setUserToken(null);
      // Reset tab state on logout
      startTransition(() => {
        setActiveTab(DEFAULT_TAB);
        setPortfolioInitialTab(0);
        setLoadedTabs({ [DEFAULT_TAB]: true });
      });
      scrollRef.current?.scrollTo({ x: DEFAULT_TAB * SCREEN_WIDTH, animated: false });
      setSharedUser(null);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { checkToken(); }, []);

  // Fetch user once after login — shared across Home & Settings
  const fetchSharedUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSharedUser(await res.json());
    } catch (_) {}
  }, []);

  useEffect(() => { if (userToken) fetchSharedUser(); }, [userToken]);

  // Called by AvatarPickerModal when avatar changes — instantly updates both screens
  const handleUserUpdated = useCallback((patch: Partial<any>) => {
    setSharedUser((prev: any) => prev ? { ...prev, ...patch } : patch);
  }, []);

  const navigateTo = useCallback((index: number, portfolioTab?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (portfolioTab !== undefined) setPortfolioInitialTab(portfolioTab);
    setLoadedTabs(prev => ({ ...prev, [index]: true }));
    // Smooth animated scroll — no more jumping
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    startTransitionLocal(() => {
      setActiveTab(index);
    });
  }, []);

  const handleScrollEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx !== activeTab && idx >= 0 && idx < TABS.length) {
      setLoadedTabs(prev => ({ ...prev, [idx]: true }));
      startTransitionLocal(() => {
        setActiveTab(idx);
      });
    }
  }, [activeTab]);

  // Navigate to Settings (shows Settings Modal)
  const openSettings = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

  // Stable callbacks for tab screen props — avoids invalidating React.memo on every render
  const handleTrackerNavigate = useCallback((id: string) => {
    const idx = TABS.findIndex(t => t.id === id);
    if (idx >= 0) navigateTo(idx);
  }, [navigateTo]);

  const handleHomeNavigate = useCallback((id: string) => {
    if (id === 'notifications') { openNotifications(); return; }
    const idx = TABS.findIndex(t => t.id === id);
    if (idx >= 0) navigateTo(idx);
  }, [navigateTo, openNotifications]);

  const handleTabPress = useCallback((i: number) => navigateTo(i), [navigateTo]);

  useEffect(() => {
    const backAction = () => {
      if (showAIChat) { setShowAIChat(false); return true; }
      if (showSettingsModal) { setShowSettingsModal(false); return true; }
      if (showNotifications) { setShowNotifications(false); return true; }
      if (activeTab !== DEFAULT_TAB) { navigateTo(DEFAULT_TAB); return true; }
      if (backClickCount === 1) { BackHandler.exitApp(); return true; }
      setBackClickCount(1);
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
      setTimeout(() => setBackClickCount(0), 2000);
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => sub.remove();
  }, [backClickCount, activeTab, showAIChat, showSettingsModal, showNotifications]);

  const authOffset = useSharedValue(0);

  useEffect(() => {
    authOffset.value = withSpring(isRegistering ? -SCREEN_WIDTH : 0, {
      damping: 24,
      stiffness: 100,
    });
  }, [isRegistering]);

  const authStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: authOffset.value }]
  }));

  if (!appReady) return null;

  if (!userToken) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#12101f' : '#6366f1', overflow: 'hidden' }}>
        <Reanimated.View style={[{ flexDirection: 'row', width: SCREEN_WIDTH * 2, flex: 1 }, authStyle]}>
          <View style={{ width: SCREEN_WIDTH }}>
            {authLoaded['login'] ? <LoginScreen onLoginSuccess={() => checkToken()} onRegister={() => { setAuthLoaded(p => ({ ...p, signup: true })); setIsRegistering(true); }} /> : null}
          </View>
          <View style={{ width: SCREEN_WIDTH }}>
            {authLoaded['signup'] ? <SignupScreen onBack={() => setIsRegistering(false)} onRegisterSuccess={() => checkToken()} /> : null}
          </View>
        </Reanimated.View>
      </View>
    );
  }

  // Two-tone layout — both modes:
  //  Dark:  deep dark-indigo header (#12101f) ➜ standard dark content (#0b0e11)
  //  Light: bright indigo header (#6366f1) ➜ light content card (#f5f7fa)
  const headerBg = isDark ? '#12101f' : '#6366f1';
  const contentBg = isDark ? '#0b0e11' : '#f5f7fa';

  return (
    <View style={{ flex: 1, backgroundColor: headerBg }}>
      {/* ── Colored Header Area ─────────────────────────────────────────────── */}
      <View style={{ paddingTop: insets.top + 8, paddingBottom: 16 }}>
        <TopNavBar scrollX={scrollX} onTabPress={handleTabPress} isDark={isDark} />
      </View>

      {/* ── Content Card (rounded top, white in light mode) ───────────────── */}
      <View style={{
        flex: 1,
        backgroundColor: contentBg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
      }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          bounces={false}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          contentOffset={{ x: DEFAULT_TAB * SCREEN_WIDTH, y: 0 }}
          decelerationRate="fast"
        >
        {/* Tab 0: Tracker */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {loadedTabs[0] ? <TrackerScreen onNavigate={handleTrackerNavigate} /> : <View style={{ flex: 1, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa' }} />}
        </View>

        {/* Tab 1: Home */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {loadedTabs[1] ? (
            <HomeScreen
              onNavigate={handleHomeNavigate}
              onOpenSettings={openSettings}
              onOpenAIChat={(trades: any[], stats: any, guardStatus?: any, dailyPnL?: number, guardSettings?: any) => { setAIChatData({ trades, stats, guardStatus, dailyPnL, guardSettings }); setShowAIChat(true); }}
              user={sharedUser}
              unreadNotifications={unreadCount}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa' }} />
          )}
        </View>

        {/* Tab 2: Portfolio */}
        <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
          {loadedTabs[2] ? (
            <PortfolioScreen
              onLogout={handleLogout}
              initialTab={portfolioInitialTab}
              onUserUpdated={handleUserUpdated}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: isDark ? '#0b0e11' : '#f5f7fa' }} />
          )}
        </View>
        </Animated.ScrollView>

      {/* ── Notification Center Overlay ──────────────────────────────────── */}
      {showNotifications && (
        <Animated.View style={[
          { position: 'absolute', inset: 0, zIndex: 100 },
          { transform: [{ translateX: notifSlide }] }
        ]}>
          <NotificationCenterScreen
            trades={notifTrades}
            onClose={closeNotifications}
          />
        </Animated.View>
      )}
      
      {/* ── Settings Modal Overlay ───────────────────────────────────────── */}
      <SettingsModal 
        visible={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)}
        onLogout={handleLogout}
        onUserUpdated={handleUserUpdated}
      />
      
      {/* ── AI Chat Overlay ────────────────────────────────────────────── */}
      <AIChatScreen 
        visible={showAIChat} 
        onClose={() => setShowAIChat(false)}
        trades={aiChatData.trades}
        stats={aiChatData.stats}
        guardStatus={aiChatData.guardStatus}
        dailyPnL={aiChatData.dailyPnL}
        guardSettings={aiChatData.guardSettings}
      />
      </View>
    </View>
  );
}

export default function App() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_700Bold });
  
  const splashAnimY = useRef(new Animated.Value(0)).current;
  const [isSplashAnimationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Set light mode as default on first launch
    setColorScheme('light');
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      // Hide the native splash screen (which natively fades out the logo)
      SplashScreen.hideAsync().then(() => {
        // Wait 300ms for the native UI to completely fade out, leaving our solid Indigo curtain
        setTimeout(() => {
          // Trigger the smooth curtain slide-up animation
          Animated.timing(splashAnimY, {
            toValue: -Dimensions.get('window').height,
            duration: 1200, // Slightly slower, more luxurious 
            useNativeDriver: true,
            easing: Easing.bezier(0.25, 1, 0.5, 1),
          }).start(() => {
            setAnimationComplete(true);
          });
        }, 300);
      }).catch(() => {
         setAnimationComplete(true);
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: '#4f46e5' }}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <MainApp />

      {/* Solid Curtain Splash Screen Overlay */}
      {!isSplashAnimationComplete && (
        <Animated.View style={{
           position: 'absolute',
           inset: 0,
           backgroundColor: '#4f46e5', // Solid Indigo curtain
           transform: [{ translateY: splashAnimY }],
           zIndex: 999999,
        }} />
      )}
    </SafeAreaProvider>
  );
}
