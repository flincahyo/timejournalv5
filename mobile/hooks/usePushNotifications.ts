import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { API_URL } from '../Constants';

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const usePushNotifications = () => {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<any | undefined>(undefined);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  async function registerForPushNotificationsAsync() {
    if (IS_EXPO_GO) return undefined;

    try {
      const Notifications = await import('expo-notifications');
      let token;
      
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;
        
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
      return token;
    } catch (e) {
      console.log('PUSH_REG_ERR');
      return undefined;
    }
  }

  useEffect(() => {
    if (IS_EXPO_GO) {
      console.log('PUSH_INACTIVE_EXPO_GO');
      return;
    }

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
        if (token) {
          setExpoPushToken(token);
          const jwt = await AsyncStorage.getItem('userToken');
          if (jwt) {
            await fetch(`${API_URL}/push-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`
              },
              body: JSON.stringify({ token }),
            });
          }
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(note => {
          setNotification(note);
          
          // Play foreground sound if provided in data
          const soundUrl = note.request.content.data?.sound;
          if (soundUrl && typeof soundUrl === 'string' && soundUrl.startsWith('http')) {
            import('expo-audio').then(({ createAudioPlayer }) => {
              const player = createAudioPlayer(soundUrl);
              player.play();
            }).catch(() => {});
          }
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener(resp => {
          console.log('PUSH_RESPONSE');
        });
      } catch (e) {
        console.log('PUSH_INIT_ERR');
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
