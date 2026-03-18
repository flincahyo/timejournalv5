import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from 'nativewind';

export function BrandLogo({ size = 21, whiteJournal = false }: { size?: number, whiteJournal?: boolean }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', position: 'relative' }}>
      {/* Decorative Ring */}
      <View style={{
        position: 'absolute',
        left: size * 2.62,
        top: '50%',
        width: size * 0.66,
        height: size * 0.66,
        borderRadius: size * 0.33,
        borderWidth: 2.2,
        borderColor: (isDark || whiteJournal) ? '#ffffff' : '#0f172a',
        opacity: isDark ? 0.6 : 0.4,
        transform: [{ translateY: (size * 0.23) - (size * 0.33) }],
      }} />

      <Text style={{
        fontFamily: 'Montserrat_700Bold',
        fontSize: size,
        color: (isDark || whiteJournal) ? '#ffffff' : '#0f172a',
        letterSpacing: -0.5,
      }}>
        time
      </Text>
      <Text style={{
        fontFamily: 'Montserrat_400Regular',
        fontSize: size,
        color: (isDark || whiteJournal) ? 'rgba(255,255,255,0.85)' : '#64748b',
        letterSpacing: -0.5,
        marginLeft: 4,
      }}>
        journal
        <Text style={{ fontFamily: 'Montserrat_700Bold', color: '#6366f1' }}>.</Text>
      </Text>
    </View>
  );
}
