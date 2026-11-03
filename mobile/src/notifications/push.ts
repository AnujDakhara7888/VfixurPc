import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Show alerts while the app is in the foreground too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests notification permission and returns the device's native push
 * Expo token, routing to APNs on iOS and FCM on Android.
 *
 * Returns null on simulators/emulators, in Expo Go (which can't receive
 * real push notifications), or if the user declines permission — callers
 * should treat null as "nothing to register" rather than an error.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = requested.status;
  }
  if (status !== 'granted') return null;
  // Personal Team builds can use local badges, but cannot register with APNs.
  if (Constants.expoConfig?.extra?.personalPreview) return null;

  if (Platform.OS === 'android') {
    // Use the existing Firebase server credentials directly, without an EAS relay credential.
    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === 'string' ? data : null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return typeof data === 'string' ? data : null;
  } catch {
    // Not available (e.g. Expo Go, or Firebase not configured in this build)
    return null;
  }
}
