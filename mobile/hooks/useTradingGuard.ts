import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { isSameDay, parseISO } from 'date-fns';

export type GuardStatus = 'normal' | 'loss_limit' | 'profit_goal';

interface GuardSettings {
  enabled: boolean;
  visualsEnabled: boolean;
  lossLimit: number; // Positive number, e.g. 500
  profitGoal: number; // Positive number, e.g. 1000
  testMode: 'none' | 'loss' | 'profit';
}

export function useTradingGuard(trades: any[]) {
  const [settings, setSettings] = useState<GuardSettings>({
    enabled: true,
    visualsEnabled: true,
    lossLimit: 500,
    profitGoal: 1000,
    testMode: 'none'
  });

  const [status, setStatus] = useState<GuardStatus>('normal');
  const [dailyPnL, setDailyPnL] = useState(0);

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('trading_guard_settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load guard settings', e);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    const sub = DeviceEventEmitter.addListener('trading_guard_changed', loadSettings);
    return () => sub.remove();
  }, [loadSettings]);

  // Save settings helper
  const saveSettings = async (newSettings: GuardSettings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem('trading_guard_settings', JSON.stringify(newSettings));
    DeviceEventEmitter.emit('trading_guard_changed');
  };

  // Calculate Daily PnL
  useEffect(() => {
    const today = new Date();
    const pnl = trades.reduce((acc, trade) => {
      const tradeDate = parseISO(trade.closeTime || trade.openTime || trade.time || '');
      if (isSameDay(tradeDate, today)) {
        return acc + (trade.profit || 0);
      }
      return acc;
    }, 0);
    setDailyPnL(pnl);
  }, [trades]);

  // Determine Status
  useEffect(() => {
    if (!settings.enabled) {
      setStatus('normal');
      return;
    }

    // Test Mode Override
    if (settings.testMode === 'loss') {
      setStatus('loss_limit');
      return;
    }
    if (settings.testMode === 'profit') {
      setStatus('profit_goal');
      return;
    }

    if (dailyPnL <= -settings.lossLimit) {
      setStatus('loss_limit');
    } else if (dailyPnL >= settings.profitGoal) {
      setStatus('profit_goal');
    } else {
      setStatus('normal');
    }
  }, [dailyPnL, settings]);

  return {
    status,
    dailyPnL,
    settings,
    saveSettings,
    visualsEnabled: settings.visualsEnabled && settings.enabled
  };
}
