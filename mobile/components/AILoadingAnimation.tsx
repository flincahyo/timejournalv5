import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { Sparkles, Brain } from 'lucide-react-native';

interface AILoadingAnimationProps {
  isDark: boolean;
  message?: string;
  subMessage?: string;
}

export const AILoadingAnimation = ({ isDark, message, subMessage }: AILoadingAnimationProps) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animateDot = (val: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: -15,
            duration: 500,
            easing: Easing.bezier(0.33, 1, 0.68, 1),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 500,
            easing: Easing.bezier(0.32, 0, 0.67, 0),
            useNativeDriver: true,
          }),
        ])
      );
    };

    const rotation = Animated.loop(
      Animated.timing(rotateValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.15,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
      rotation,
      pulse
    ]).start();
  }, []);

  const spin = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
      {/* Central Ring & Icon */}
      <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 30 }}>
        {/* Rotating Sparkle Ring */}
        <Animated.View style={{ 
          position: 'absolute', 
          width: '100%', 
          height: '100%', 
          transform: [{ rotate: spin }] 
        }}>
           <View style={{ position: 'absolute', top: 0, left: 45 }}>
              <Sparkles size={12} color="#4f46e5" />
           </View>
           <View style={{ position: 'absolute', bottom: 0, left: 45 }}>
              <Sparkles size={8} color="#6366f1" />
           </View>
           <View style={{ position: 'absolute', left: 0, top: 45 }}>
              <Sparkles size={6} color="#818cf8" />
           </View>
           <View style={{ position: 'absolute', right: 0, top: 45 }}>
              <Sparkles size={10} color="#4f46e5" />
           </View>
        </Animated.View>

        {/* Pulsing Brain */}
        <Animated.View style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 32, 
          backgroundColor: isDark ? 'rgba(79, 70, 229, 0.1)' : 'rgba(79, 70, 229, 0.05)',
          alignItems: 'center', 
          justifyContent: 'center',
          transform: [{ scale: pulseValue }],
          borderWidth: 1,
          borderColor: 'rgba(79, 70, 229, 0.1)'
        }}>
          <Brain size={32} color="#4f46e5" />
        </Animated.View>
      </View>

      {/* Bouncing Dots */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24, height: 20, alignItems: 'center' }}>
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4f46e5', transform: [{ translateY: dot1 }] }} />
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366f1', transform: [{ translateY: dot2 }] }} />
        <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#818cf8', transform: [{ translateY: dot3 }] }} />
      </View>

      {/* Message Labels */}
      <Text style={{ 
        fontSize: 16, 
        fontWeight: '900', 
        color: isDark ? '#ffffff' : '#0f172a', 
        marginBottom: 8, 
        textAlign: 'center',
        fontFamily: 'Montserrat_700Bold'
      }}>
        {message || "Dissecting Intelligence..."}
      </Text>
      <Text style={{ 
        fontSize: 12, 
        fontWeight: '600', 
        color: isDark ? '#94a3b8' : '#64748b', 
        textAlign: 'center', 
        paddingHorizontal: 50,
        lineHeight: 18
      }}>
        {subMessage || "Dissecting streaks and performance metadata for psychological insights."}
      </Text>
    </View>
  );
};
