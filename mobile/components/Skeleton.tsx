import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, ViewStyle, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  isDark?: boolean;
}

export const Skeleton = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8, 
  style, 
  isDark = false 
}: SkeletonProps) => {
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const startShimmer = () => {
      shimmerAnim.setValue(-1);
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    };

    startShimmer();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-300, 300], // Adjust based on common width or use container width
  });

  const baseColor = isDark ? '#1e293b' : '#e2e8f0';
  const highlightColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(255, 255, 255, 0.5)';

  return (
    <View 
      style={[
        { 
          width, 
          height, 
          borderRadius, 
          backgroundColor: baseColor, 
          overflow: 'hidden' 
        }, 
        style
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', highlightColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

export const SkeletonCircle = ({ size = 50, isDark, style }: { size?: number, isDark?: boolean, style?: ViewStyle }) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} isDark={isDark} style={style} />
);

export const SkeletonRect = ({ width, height, borderRadius = 12, isDark, style }: SkeletonProps) => (
  <Skeleton width={width} height={height} borderRadius={borderRadius} isDark={isDark} style={style} />
);
