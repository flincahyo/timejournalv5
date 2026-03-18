import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL } from '../Constants';

export interface PriceData {
  [symbol: string]: number;
}

export interface CandleData {
  [symbol_tf: string]: any[];
}

export function useWebSocket() {
  const [prices, setPrices] = useState<PriceData>({});
  const [candles, setCandles] = useState<CandleData>({});
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<any>(null);

  const connect = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;

      // Close existing if any
      if (ws.current) {
        ws.current.close();
      }

      const url = `${WS_URL}/ws/mt5?token=${token}`;
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        console.log('WS_OPEN');
        setIsConnected(true);
      };

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'prices') {
            if (data.prices) setPrices(p => ({ ...p, ...data.prices }));
            if (data.candles) setCandles(c => ({ ...c, ...data.candles }));
          }
        } catch (err) {
          console.log('WS_PARSE_ERR');
        }
      };

      socket.onclose = () => {
        console.log('WS_CLOSE');
        setIsConnected(false);
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, 5000);
      };

      socket.onerror = () => {
        console.log('WS_ERR');
      };
    } catch (err) {
      console.error('Mobile WS connect error:', err);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [connect]);

  return {
    prices,
    candles,
    isConnected,
    socket: ws.current
  };
}
