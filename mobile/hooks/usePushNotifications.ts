import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_URL } from '../Constants';

// Hardcoded fallback - safe to expose (it's in app.json already)
const EXPO_PROJECT_ID = 'bbe7e363-2fca-4820-88c6-06f988ceb456';

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<any | undefined>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  async function registerForPushNotificationsAsync(): Promise<string | undefined> {
    try {
      const Notifications = await import('expo-notifications');

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      console.log('[PUSH] permission status:', finalStatus);
      if (finalStatus !== 'granted') {
        console.warn('[PUSH] Permission not granted:', finalStatus);
        return undefined;
      }

      // Get project ID — prefer app.json, fallback to hardcoded
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId 
        ?? Constants?.easConfig?.projectId 
        ?? EXPO_PROJECT_ID;
      
      console.log('[PUSH] using projectId:', projectId);

      const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResult.data;
      console.log('[PUSH] token obtained:', token ? token.substring(0, 40) + '...' : 'null');
      return token;
    } catch (e: any) {
      console.error('[PUSH] registerForPushNotificationsAsync error:', e?.message || e);
      return undefined;
    }
  }

  useEffect(() => {
    const initNotifications = async () => {
      try {
        const Notifications = await import('expo-notifications');
        
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        const token = await registerForPushNotificationsAsync();
        console.log('[PUSH] Final token:', token ? token.substring(0, 40) + '...' : 'NONE');
        
        if (token) {
          setExpoPushToken(token);
          const jwt = await AsyncStorage.getItem('userToken');
          console.log('[PUSH] JWT present:', !!jwt, '| API_URL:', API_URL);
          
          if (jwt) {
            try {
              const res = await fetch(`${API_URL}/push-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${jwt}`
                },
                body: JSON.stringify({ token }),
              });
              const data = await res.json();
              console.log('[PUSH] Registration result:', JSON.stringify(data));
            } catch (regErr: any) {
              console.error('[PUSH] Registration network error:', regErr?.message || regErr);
            }
          } else {
            console.warn('[PUSH] No JWT — unable to register token with backend');
          }
        } else {
          console.warn('[PUSH] No token — check permissions or projectId');
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(note => {
          setNotification(note);
          
          // Play foreground sound — check soundUrl (new) then sound (fallback)
          const data = note.request.content.data || {};
          const soundUrl = (data.soundUrl || data.sound) as string | undefined;
          if (soundUrl && soundUrl.startsWith('http')) {
            import('expo-audio').then(({ createAudioPlayer }) => {
              const player = createAudioPlayer(soundUrl);
              player.play();
            }).catch(() => {});
          }
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(resp => {
          console.log('[PUSH] Notification tapped:', resp.notification.request.content.title);
        });
      } catch (e: any) {
        console.error('[PUSH] initNotifications error:', e?.message || e);
      }
    };

    initNotifications();

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  return { expoPushToken, notification };
};



