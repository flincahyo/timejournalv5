import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../Constants';

export interface Trade {
  id: string;
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  lots: number;
  openPrice: number;
  closePrice: number;
  pnl: number;
  profit?: number;
  openTime: string;
  closeTime: string;
  status: 'live' | 'closed';
  [key: string]: any;
}

export function useMT5Sync() {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const fetchData = useCallback(async (showSyncing = false) => {
    if (showSyncing) setSyncing(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      const [statusRes, tradesRes] = await Promise.all([
        fetch(`${API_URL}/mt5/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/mt5/trades`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const statusData = await statusRes.json();
      const tradesData = await tradesRes.json();

      setIsConnected(statusData.connected || false);
      setAccount(statusData.account || null);
      if (statusData.lastSync) setLastSync(statusData.lastSync);
      
      if (tradesData.trades) {
        setTrades(tradesData.trades);
      }
    } catch (error) {
      console.error('Sync Error:', error);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  const triggerSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await fetchData(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  useEffect(() => {
    fetchData();
    // Poll every 10 seconds for responsive live updates
    const interval = setInterval(() => {
        fetchData();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return {
    isConnected,
    account,
    trades,
    loading,
    syncing,
    lastSync,
    triggerSync,
    refresh: fetchData
  };
}
