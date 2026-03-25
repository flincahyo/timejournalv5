import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, Animated, Easing, Text, StyleSheet } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface AIChatFABProps {
  onPress: () => void;
  showProactiveBubble?: boolean;
  proactiveMessage?: string;
}

export const AIChatFAB: React.FC<AIChatFABProps> = ({ 
  onPress, 
  showProactiveBubble = false,
  proactiveMessage = "Need trade insights?"
}) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation Values
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(-1)).current;

  // Internal state to manage bubble visibility after fade out
  const [isBubbleVisible, setIsBubbleVisible] = useState(showProactiveBubble);

  // Breathing & Hover Animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.8, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Icon Shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    // Background Sweep
    const runSweep = () => {
      Animated.sequence([
        Animated.timing(sweepAnim, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(sweepAnim, { toValue: -1, duration: 0, useNativeDriver: true }),
        Animated.delay(2200),
      ]).start(runSweep);
    };
    runSweep();

  }, [scale, glowOpacity, shimmer, sweepAnim]);

  // Proactive Bubble Animation
  useEffect(() => {
    if (showProactiveBubble && proactiveMessage) {
      setIsBubbleVisible(true);
      bubbleScale.setValue(0);
      bubbleOpacity.setValue(0);
      
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();

      // Auto hide bubble after 8 seconds
      const timeout = setTimeout(() => {
        hideBubble();
      }, 8000);

      return () => clearTimeout(timeout);
    } else {
      hideBubble();
    }
  }, [showProactiveBubble, proactiveMessage, bubbleScale, bubbleOpacity]);

  const hideBubble = () => {
    Animated.parallel([
      Animated.timing(bubbleScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(bubbleOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => setIsBubbleVisible(false));
  };

  const rotate = shimmer.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '15deg'] });
  const tx = sweepAnim.interpolate({ inputRange: [-1, 1], outputRange: [-80, 80] });

  return (
    <View style={styles.container}>
      {/* Proactive Bubble */}
      {isBubbleVisible && (
        <Animated.View 
          style={[
            styles.bubbleContainer,
            {
              opacity: bubbleOpacity,
              transform: [{ scale: bubbleScale }, { translateY: 10 }],
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
              shadowColor: isDark ? '#000' : '#4f46e5',
            }
          ]}
        >
          <Text style={[styles.bubbleText, { color: isDark ? '#e2e8f0' : '#334155' }]}>
            {proactiveMessage}
          </Text>
          <TouchableOpacity onPress={hideBubble} style={styles.closeButton}>
            <X size={12} color={isDark ? '#94a3b8' : '#64748b'} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        activeOpacity={1}
        onPressIn={() => {
          Animated.spring(scale, { toValue: 1.2, friction: 4, tension: 120, useNativeDriver: true }).start();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
        }}
        onPress={() => {
          hideBubble();
          onPress();
        }}
      >
        {/* Glow Layer */}
        <Animated.View 
          style={[
            styles.glow,
            {
              opacity: glowOpacity,
              transform: [{ scale: scale }],
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.3)',
            }
          ]} 
        />
        
        {/* Main Button */}
        <Animated.View style={[styles.button, { transform: [{ scale: scale }] }]}>
           <LinearGradient
              colors={isDark ? ['#4f46e5', '#3b82f6'] : ['#6366f1', '#4f46e5']}
              style={[styles.gradient, { overflow: 'hidden' }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
             <Animated.View style={{ position: 'absolute', inset: 0, transform: [{ translateX: tx }] }}>
               <LinearGradient colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
             </Animated.View>
             
             <Animated.View style={{ transform: [{ rotate: rotate }, { scale: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.1] }) }] }}>
               <Sparkles size={24} color="#ffffff" />
             </Animated.View>
           </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 999,
    alignItems: 'flex-end'
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden'
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    top: -5,
    left: -5,
    filter: 'blur(10px)',
  },
  bubbleContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4, // Chat tail effect
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 220,
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 10,
    flexShrink: 1,
  },
  closeButton: {
    padding: 2,
  }
});
