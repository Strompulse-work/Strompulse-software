import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Tell the app how to handle notifications received while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, 
    shouldShowList: true,   
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Accept an explicit userId so we can call this immediately AFTER login
export async function registerForPushNotificationsAsync(explicitUserId?: string) {
  if (!Device.isDevice) {
    console.log('Must use a physical device for push notifications');
    return;
  }

  // 1. Request Permission from the user
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return;
  }

  try {
    // 2. Fetch the Expo Push Token using your project ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? 
      Constants?.easConfig?.projectId;
      
    const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = pushTokenData.data;

    // 3. Use the explicit ID, or fallback to checking the session
    let userId = explicitUserId;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    if (!userId) {
        console.log("No user logged in yet, skipping token save. Will save upon login.");
        return;
    }

    // 4. Save or update the token in the Supabase user_tokens table
    const { error } = await supabase
      .from('user_tokens')
      .upsert(
        { 
          user_id: userId, 
          push_token: pushToken, 
          platform: Platform.OS 
        }, 
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving push token to Supabase:', error);
    } else {
      console.log('Push token successfully saved for user:', userId);
    }

  } catch (error) {
    console.error('Error getting push token:', error);
  }

  // 5. Configure Android notification channels
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C48A',
    });
  }
}