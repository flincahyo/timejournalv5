import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions, StyleSheet, Keyboard
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { BrandLogo } from '../components/BrandLogo';
import { User, Mail, Lock, ArrowRight, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../Constants';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
  withRepeat, useAnimatedKeyboard, interpolate, Extrapolation
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SignupScreen({ onBack, onRegisterSuccess }: { onBack: () => void, onRegisterSuccess: () => void }) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const shakeOffset = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SCREEN_HEIGHT * 0.4); // Start even lower

  const keyboard = useAnimatedKeyboard();

  useEffect(() => {
    // Initial entry - Peek position (lower than before)
    sheetTranslateY.value = withTiming(SCREEN_HEIGHT * 0.28, { duration: 800 });
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));

  const sheetStyle = useAnimatedStyle(() => {
    // Same interpolation as LoginScreen for consistency
    const keyboardOffset = interpolate(
      keyboard.height.value,
      [0, 300],
      [SCREEN_HEIGHT * 0.28, SCREEN_HEIGHT * 0.06],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY: keyboardOffset }]
    };
  });

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeOffset.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withRepeat(withTiming(10, { duration: 100 }), 3, true),
      withTiming(0, { duration: 50 })
    );
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError("Please fill all fields.");
      triggerShake();
      return;
    }
    setError("");
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (res.ok && data.token) {
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.removeItem('logged_out');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRegisterSuccess();
      } else {
        setError(data.detail || "Registration Failed");
        triggerShake();
      }
    } catch (err) {
      setError("Could not connect to server.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const headerBg = isDark ? '#12101f' : '#6366f1';
  const contentBg = isDark ? '#0b0e11' : '#f5f7fa';
  const border = isDark ? '#1e293b' : '#e8edf5';
  const textP = isDark ? '#f1f5f9' : '#0f172a';
  const textS = isDark ? '#94a3b8' : '#64748b';

  const inpStyle = {
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    borderWidth: 1, borderColor: border,
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 48,
    color: textP, fontSize: 14, marginBottom: 12,
    fontFamily: 'Montserrat_400Regular'
  };

  return (
    <View style={{ flex: 1, backgroundColor: headerBg }}>
      {/* Background Section (Splash + Logo) */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.7 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          marginTop: insets.top + 18,
          zIndex: 100,
        }}>
          {/* Logo with better visibility (whiteJournal style) */}
          <BrandLogo size={23} whiteJournal={true} />

          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={24} color="#ffffff" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 0, marginTop: -310 }}>
          <LottieView
            source={require('../assets/business-team.json')}
            autoPlay
            loop
            style={{ width: SCREEN_WIDTH * 1.0, height: SCREEN_HEIGHT * 0.45 }}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={false}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Animated.View style={[{
            width: SCREEN_WIDTH,
            height: SCREEN_HEIGHT * 0.85,
            backgroundColor: contentBg,
            borderTopLeftRadius: 36,
            borderTopRightRadius: 36,
            paddingHorizontal: 28,
            paddingTop: 36,
            paddingBottom: insets.bottom + 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 20,
          }, sheetStyle]}>
            <Animated.View style={shakeStyle}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: isDark ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 24, opacity: 0.5 }} />

              <Text style={{ fontSize: 28, fontWeight: '900', color: textP, letterSpacing: -0.8, marginBottom: 8, fontFamily: 'Montserrat_700Bold' }}>
                Create Account
              </Text>
              <Text style={{ fontSize: 13, color: textS, marginBottom: 32, fontFamily: 'Montserrat_400Regular', lineHeight: 20 }}>
                Join the elite journaling platform and master your edges.
              </Text>

              {error ? (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingVertical: 10, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' as any, textAlign: 'center' }}>{error}</Text>
                </View>
              ) : null}

              <View style={{ position: 'relative', marginBottom: 6 }}>
                <View style={{ position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 14 : 16, zIndex: 10 }}>
                  <User size={18} color={textS} strokeWidth={2} />
                </View>
                <TextInput
                  style={inpStyle}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full Name"
                  placeholderTextColor={textS}
                />
              </View>

              <View style={{ position: 'relative', marginBottom: 6 }}>
                <View style={{ position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 14 : 16, zIndex: 10 }}>
                  <Mail size={18} color={textS} strokeWidth={2} />
                </View>
                <TextInput
                  style={inpStyle}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email Address"
                  placeholderTextColor={textS}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={{ position: 'relative', marginBottom: 16 }}>
                <View style={{ position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 14 : 16, zIndex: 10 }}>
                  <Lock size={18} color={textS} strokeWidth={2} />
                </View>
                <TextInput
                  style={inpStyle}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={textS}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#6366f1', paddingVertical: 18, borderRadius: 20,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
                  shadowColor: '#6366f1', shadowOpacity: 0.35, shadowRadius: 15, shadowOffset: { width: 0, height: 8 },
                  elevation: 8,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#ffffff', letterSpacing: 0.3 }}>Get Started</Text>
                    <ArrowRight size={18} color="#ffffff" strokeWidth={3} />
                  </>
                )}
              </TouchableOpacity>

              <View style={{ marginTop: 24, alignItems: 'center' }}>
                <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
                  <Text style={{ fontSize: 13, color: textS, fontFamily: 'Montserrat_400Regular' }}>
                    Already have an account? <Text style={{ color: '#6366f1', fontWeight: '900' }}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
