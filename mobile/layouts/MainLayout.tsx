import * as React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';

// Gluestack UI Components
import { Box } from '../components/ui/box';
import { HStack } from '../components/ui/hstack';
import { VStack } from '../components/ui/vstack';
import { Heading } from '../components/ui/heading';

// Exporting Header separately for global use
export function CustomHeader({ title }: { title: string }) {
  const { colorScheme } = useColorScheme();

  return (
    <Box className="px-6 py-4 flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
      <VStack>
        <Heading size="lg" className="text-slate-900 dark:text-white font-black tracking-tight">
          {title}
        </Heading>
        <Text className="text-[9px] uppercase tracking-[.15em] font-bold text-slate-400 dark:text-slate-500">
          Professional Journaling
        </Text>
      </VStack>
      
      <TouchableOpacity className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-900 items-center justify-center border border-slate-100 dark:border-slate-800">
        <Box className="w-2 h-2 rounded-full bg-blue-600" />
      </TouchableOpacity>
    </Box>
  );
}

// Exporting BottomNav separately for global use
export function GlobalBottomNav({ 
  onNavigate, 
  activeTab = 'dashboard' 
}: { 
  onNavigate?: (screen: string) => void; 
  activeTab?: string;
}) {
  return (
    <Box className="flex-row items-center justify-around py-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 pb-10">
      <NavItem 
        label="FEED" 
        active={activeTab === 'dashboard'} 
        onPress={() => onNavigate?.('dashboard')}
        icon={<FeedIcon active={activeTab === 'dashboard'} />}
      />
      <NavItem 
        label="HISTORY" 
        active={activeTab === 'history'} 
        onPress={() => onNavigate?.('history')}
        icon={<HistoryIcon active={activeTab === 'history'} />}
      />
      <NavItem 
        label="STATS" 
        active={activeTab === 'stats'} 
        onPress={() => onNavigate?.('stats')}
        icon={<StatsIcon active={activeTab === 'stats'} />}
      />
      <NavItem 
        label="ACCOUNT" 
        active={activeTab === 'profile'} 
        onPress={() => onNavigate?.('profile')}
        icon={<ProfileIcon active={activeTab === 'profile'} />}
      />
    </Box>
  );
}

function NavItem({ label, active = false, onPress, icon }: { label: string, active?: boolean, onPress?: () => void, icon: React.ReactNode }) {
  return (
    <TouchableOpacity 
      className="items-center justify-center flex-1"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <VStack space="xs" className="items-center">
        <Box className="h-6 w-6 items-center justify-center mb-1">
          {icon}
        </Box>
        <Text 
          className={`text-[7.5px] font-black tracking-widest ${active ? 'text-blue-600' : 'text-slate-400 dark:text-slate-600'}`}
        >
          {label}
        </Text>
        {active && <Box className="h-0.5 w-0.5 rounded-full bg-blue-600 mt-0.5" />}
      </VStack>
    </TouchableOpacity>
  );
}

// Geometric Icons
function FeedIcon({ active }: { active: boolean }) {
  const color = active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700';
  return (
    <VStack space="xs">
      <HStack space="xs">
        <Box className={`w-2 h-2 rounded-[4px] ${color}`} />
        <Box className={`w-2 h-2 rounded-[4px] opacity-40 ${color}`} />
      </HStack>
      <HStack space="xs">
        <Box className={`w-2 h-2 rounded-[4px] opacity-40 ${color}`} />
        <Box className={`w-2 h-2 rounded-[4px] ${color}`} />
      </HStack>
    </VStack>
  );
}

function HistoryIcon({ active }: { active: boolean }) {
  const color = active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700';
  return (
    <VStack space="xs" className="items-start">
      <Box className={`w-5 h-1 rounded-full ${color}`} />
      <Box className={`w-3 h-1 rounded-full opacity-60 ${color}`} />
      <Box className={`w-4 h-1 rounded-full opacity-40 ${color}`} />
    </VStack>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  const color = active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700';
  return (
    <HStack space="xs" className="items-end">
      <Box className={`w-1 h-3 rounded-full opacity-40 ${color}`} />
      <Box className={`w-1 h-5 rounded-full ${color}`} />
      <Box className={`w-1 h-4 rounded-full opacity-60 ${color}`} />
    </HStack>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700';
  return (
    <Box className={`w-5 h-5 rounded-full border-2 ${active ? 'border-blue-600' : 'border-slate-300 dark:border-slate-700'} items-center justify-center`}>
      <Box className={`w-2 h-2 rounded-full ${color}`} />
    </Box>
  );
}

// MainLayout now just acts as a simple container
export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      {children}
    </View>
  );
}
