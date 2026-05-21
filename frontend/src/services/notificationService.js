/**
 * Notification Service
 *
 * Handles push notification permissions, Expo/FCM device token retrieval,
 * and syncing the token to the backend so the server can send alerts.
 *
 * Flow:
 *  1. Request OS permission to show notifications (required on iOS, auto-granted on Android).
 *  2. Get the native device push token (this is the FCM token the backend needs).
 *  3. Call userService.updateFCMToken() to save it in the database.
 *  4. Set a global notification handler so alerts show even when the app is open.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import userService from './userService';

/**
 * Configure how notifications appear when the app is in the foreground.
 * Without this, notifications are silent while the app is open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register device for push notifications.
 * Should be called after a successful login or on app startup (if already logged in).
 */
export const registerForPushNotificationsAsync = async () => {
  try {
    // 1. Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[NOTIF] User denied push notification permissions.');
      return null;
    }

    // 2. Set up Android notification channel (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('edutrack-alerts', {
        name: 'EduTrack Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E90FF',
        sound: true,
      });
    }

    // 3. Get the native device FCM token
    // Note: getDevicePushTokenAsync() returns the raw FCM token (string),
    // which is what our Firebase Admin SDK on the backend expects.
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData?.data;

    if (!token) {
      console.warn('[NOTIF] Could not retrieve device push token.');
      return null;
    }

    console.log('[NOTIF] FCM token obtained:', token);

    // 4. Sync token with the backend database
    await userService.updateFCMToken(token);
    console.log('[NOTIF] FCM token successfully synced with backend.');

    return token;
  } catch (error) {
    console.error('[NOTIF_REG_ERR]', error.message);
    return null;
  }
};
