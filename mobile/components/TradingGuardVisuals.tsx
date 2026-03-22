import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { GuardStatus } from '../hooks/useTradingGuard';

const { width: W } = Dimensions.get('window');

// ── Burning Flame Particle ───────────────────────────────────────────────────
function FlameParticle({ delay, speed, offset }: { delay: number, speed: number, offset: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: speed,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, [delay, speed]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1.2, 0] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.4, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: offset,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#ef4444',
        opacity,
        transform: [{ translateY }, { scale }],
        shadowColor: '#ef4444',
        shadowRadius: 10,
        shadowOpacity: 0.8,
      }}
    />
  );
}

// ── Growing Leaf Component ────────────────────────────────────────────────────
function GrowingLeaf({ delay, angle, scaleFactor }: { delay: number, angle: number, scaleFactor: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [delay]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0, scaleFactor] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.7, 0.7, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 20,
        height: 30,
        opacity,
        transform: [
          { rotate: `${angle}deg` },
          { translateY: -15 },
          { scale },
        ],
      }}
    >
      <Svg height="30" width="20" viewBox="0 0 20 30">
        <Path
          d="M10,0 C15,10 20,20 10,30 C0,20 5,10 10,0 Z"
          fill="#10b981"
        />
      </Svg>
    </Animated.View>
  );
}

// ── Main Visuals Wrapper ──────────────────────────────────────────────────────
export function TradingGuardVisuals({ status, children, visualsEnabled }: { status: GuardStatus, children: React.ReactNode, visualsEnabled: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'normal' || !visualsEnabled) {
      pulse.setValue(1);
      shake.setValue(0);
      return;
    }

    // Pulse animation (for both profit and loss)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    // Shake animation (only for loss)
    let shakeLoop: Animated.CompositeAnimation | null = null;
    if (status === 'loss_limit') {
      shakeLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shake, { toValue: 2, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -2, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
          Animated.delay(1000),
        ])
      );
      shakeLoop.start();
    }

    return () => {
      pulseLoop.stop();
      if (shakeLoop) shakeLoop.stop();
    };
  }, [status, visualsEnabled]);

  const isLoss = status === 'loss_limit';
  const isProfit = status === 'profit_goal';

  return (
    <View style={{ position: 'relative', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      
      {/* Visual Effects Layer (Bottom) */}
      {visualsEnabled && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Flame Effect */}
          {isLoss && (
            <View style={{ position: 'absolute', bottom: 10, left: 20, right: 20, height: 40, overflow: 'visible' }}>
              {[...Array(12)].map((_, i) => (
                <FlameParticle key={i} delay={i * 150} speed={1200 + Math.random() * 800} offset={(i / 11) * (W - 80)} />
              ))}
            </View>
          )}

          {/* Growth Effect */}
          {isProfit && (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
               {[...Array(8)].map((_, i) => (
                 <GrowingLeaf key={i} delay={i * 200} angle={i * 45} scaleFactor={1 + Math.random() * 0.5} />
               ))}
            </View>
          )}
        </View>
      )}

      {/* Main Card */}
      <Animated.View style={{ 
        width: '100%', 
        transform: [
          { scale: pulse },
          { translateX: shake }
        ] 
      }}>
        {children}
      </Animated.View>

    </View>
  );
}
