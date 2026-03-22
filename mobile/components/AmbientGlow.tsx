import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, View, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W, height: H } = Dimensions.get('window');

// ── Shared Hook for Settings ───────────────────────────────────────────────────
export function useAmbientGlowSetting() {
    const [enabled, setEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        let isMounted = true;
        AsyncStorage.getItem('glow_effect_enabled').then(v => {
            if (isMounted) {
                // Default to true if never set, otherwise use stored value
                setEnabled(v === null ? true : v !== 'false');
            }
        });

        const sub = DeviceEventEmitter.addListener('glow_changed', (val) => {
            if (isMounted) setEnabled(val);
        });

        return () => {
            isMounted = false;
            sub.remove();
        };
    }, []);

    const toggle = (val: boolean) => {
        AsyncStorage.setItem('glow_effect_enabled', String(val));
        DeviceEventEmitter.emit('glow_changed', val);
        setEnabled(val);
    };

    return { enabled, toggle };
}

// ── The Ambient Glow Component ──────────────────────────────────────────────────
export default function AmbientGlow({ isDark, status = 'normal' }: { isDark: boolean, status?: 'normal' | 'loss_limit' | 'profit_goal' }) {
    const { enabled } = useAmbientGlowSetting();
    const animScale = useRef(new Animated.Value(1)).current;
    const animTranslateX = useRef(new Animated.Value(0)).current;
    const animTranslateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (enabled !== true) {
            animScale.stopAnimation();
            animTranslateX.stopAnimation();
            animTranslateY.stopAnimation();
            return;
        }

        const isWarning = status === 'loss_limit';
        const duration = isWarning ? 3000 : 8000; // Much faster when in loss limit

        // 1. Breathing scale (pulse)
        Animated.loop(
            Animated.sequence([
                Animated.timing(animScale, { toValue: isWarning ? 1.6 : 1.4, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(animScale, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

        // 2. Drifting (Translate X and Y)
        Animated.loop(
            Animated.sequence([
                Animated.timing(animTranslateX, { toValue: isWarning ? 120 : 80, duration: duration * 0.7, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(animTranslateX, { toValue: isWarning ? -60 : -40, duration: duration * 0.8, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(animTranslateX, { toValue: 0, duration: duration * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(animTranslateY, { toValue: isWarning ? 150 : 100, duration: duration * 0.6, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(animTranslateY, { toValue: isWarning ? -90 : -60, duration: duration * 0.9, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(animTranslateY, { toValue: 0, duration: duration * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        ).start();

    }, [enabled, animScale, animTranslateX, animTranslateY, status]);

    if (enabled !== true) return null;

    // ── Dynamic Colors ────────────────────────────────────────────────────────────
    const getColors = () => {
        if (status === 'loss_limit') return isDark ? ['#ef4444', '#b91c1c'] : ['#f87171', '#ef4444'];
        if (status === 'profit_goal') return isDark ? ['#10b981', '#047857'] : ['#34d399', '#10b981'];
        return isDark ? ['#4f46e5', '#8b5cf6'] : ['#8b5cf6', '#6366f1'];
    };
    const [c1, c2] = getColors();

    return (
        <View pointerEvents="none" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <Animated.View style={{
                position: 'absolute',
                top: -50,
                left: -50,
                width: W * 1.0,
                height: W * 1.0,
                borderRadius: W,
                backgroundColor: c1,
                opacity: isDark ? (status === 'normal' ? 0.25 : 0.45) : (status === 'normal' ? 0.20 : 0.40),
                transform: [
                    { scale: animScale },
                    { translateX: animTranslateX },
                    { translateY: animTranslateY },
                ]
            }} />

            <Animated.View style={{
                position: 'absolute',
                top: '40%',
                left: '25%',
                width: W * 0.5,
                height: W * 0.5,
                borderRadius: W,
                backgroundColor: c2,
                opacity: isDark ? 0.20 : 0.15,
                transform: [
                    { scale: animScale },
                    { translateX: Animated.multiply(animTranslateX, 0.6) },
                    { translateY: Animated.multiply(animTranslateY, -0.4) },
                ]
            }} />
            
            <Animated.View style={{
                position: 'absolute',
                bottom: -80,
                right: -50,
                width: W * 0.8,
                height: W * 0.8,
                borderRadius: W,
                backgroundColor: c2,
                opacity: isDark ? 0.20 : 0.15,
                transform: [
                    { scale: animScale },
                    { translateX: Animated.multiply(animTranslateX, -0.5) },
                    { translateY: Animated.multiply(animTranslateY, -0.8) },
                ]
            }} />
        </View>
    );
}
