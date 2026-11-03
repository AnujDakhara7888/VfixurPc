import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { api, authApi, notificationsApi, session } from '@/api/client';
import { registerForPushNotificationsAsync } from './push';
import { Colors } from '@/theme';

export default function PromoPushNudge() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const personal = !!Constants.expoConfig?.extra?.personalPreview;
  const status = useQuery({ queryKey: ['device-notifications'], queryFn: async () => {
    const permissions = await Notifications.getPermissionsAsync();
    const { data } = await api.get('/notifications/native-settings');
    return { ...data, allowed: permissions.granted };
  } });
  if (personal || status.isLoading || (status.data?.registered && status.data?.promotionalPushOptIn)) return null;
  async function enable() {
    setBusy(true); setError(''); const revision = session.revision;
    try {
      const token = await registerForPushNotificationsAsync();
      if (revision !== session.revision) return;
      if (!token) { setError('Notifications are blocked. You can enable them from your phone settings.'); return; }
      await authApi.updateFcmToken(token);
      await notificationsApi.promotionalPreference(true);
      await status.refetch();
    } catch { setError('Could not enable offer alerts. Please try again.'); }
    finally { setBusy(false); }
  }
  return <View style={s.card}><View style={s.icon}><Ionicons name="notifications" size={21} color="#fff" /></View><View style={s.copy}><Text style={s.title}>Never miss a repair update</Text><Text style={s.body}>Enable lock-screen updates for pickup, diagnosis, quotes and completion. You can also receive up to two app-exclusive offer alerts per week.</Text>{!!error && <Text style={s.error}>{error}</Text>}</View><TouchableOpacity disabled={busy} onPress={enable} style={s.button}><Text style={s.buttonText}>{busy ? 'Enabling...' : 'Enable'}</Text></TouchableOpacity></View>;
}
const s = StyleSheet.create({
  card: { marginBottom: 18, backgroundColor: '#EAF4FF', borderWidth: 1, borderColor: '#C7DDF5', borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.brandNavy, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 },
  title: { color: Colors.ink, fontSize: 13, fontWeight: '900' }, body: { color: Colors.inkSecondary, fontSize: 10.5, lineHeight: 15, marginTop: 2 }, error: { color: Colors.error, fontSize: 10, lineHeight: 14, marginTop: 3 },
  button: { minHeight: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontSize: 11, fontWeight: '900' },
});
