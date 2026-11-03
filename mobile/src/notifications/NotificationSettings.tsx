import React, { useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { api, authApi, getApiErrorMessage, notificationsApi, session } from '@/api/client';
import { registerForPushNotificationsAsync } from './push';
import { Colors } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationSettings() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const personal = !!Constants.expoConfig?.extra?.personalPreview;
  const status = useQuery({
    queryKey: ['device-notifications'],
    queryFn: async () => {
      const permissions = await Notifications.getPermissionsAsync();
      const { data } = await api.get('/notifications/native-settings');
      return { ...data, allowed: permissions.granted, canAskAgain: permissions.canAskAgain };
    },
  });

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') status.refetch();
    });
    return () => sub.remove();
  }, [status.refetch]);

  async function enable() {
    setBusy(true);
    setMessage('');
    const revision = session.revision;
    try {
      const before = await Notifications.getPermissionsAsync();
      if (!before.granted && !before.canAskAgain) {
        await Linking.openSettings();
        return;
      }
      const token = await registerForPushNotificationsAsync();
      if (revision !== session.revision) return;
      const after = await Notifications.getPermissionsAsync();
      if (!after.granted) {
        await status.refetch();
        setMessage(after.canAskAgain
          ? 'Notifications were not enabled. Tap Enable notifications to try again.'
          : 'Notifications are blocked. Open phone settings to allow them.');
        return;
      }
      if (token) await authApi.updateFcmToken(token);
      await status.refetch();
      setMessage(token
        ? 'Notifications are enabled and linked to this phone.'
        : personal
          ? 'Notifications are allowed. Remote alerts require the App Store build.'
          : 'Notifications are allowed, but this device could not be registered for remote alerts yet.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Could not enable notifications. Please retry.'));
    } finally {
      setBusy(false);
    }
  }

  async function setPromotional(enabled: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await notificationsApi.promotionalPreference(enabled);
      await status.refetch();
      setMessage(enabled ? 'Offer alerts enabled.' : 'Offer alerts turned off.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Could not update offer alerts.'));
    } finally {
      setBusy(false);
    }
  }

  async function setWhatsApp(enabled: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await notificationsApi.whatsappPreference(enabled);
      await status.refetch();
      setMessage(enabled ? 'WhatsApp offers enabled.' : 'WhatsApp offers turned off.');
    } catch (error) {
      setMessage(getApiErrorMessage(error, 'Could not update WhatsApp offers.'));
    } finally {
      setBusy(false);
    }
  }

  const allowed = !!status.data?.allowed;
  const registered = !!status.data?.registered;
  const permissionLabel = status.isLoading
    ? 'Checking phone permission...'
    : allowed
      ? registered
        ? 'On and linked to this phone'
        : 'Allowed on this phone'
      : 'Off on this phone';

  return (
    <View style={s.root}>
      <View style={s.permissionRow}>
        <View style={[s.permissionIcon, allowed && s.permissionIconOn]}>
          <Ionicons name={allowed ? 'notifications' : 'notifications-outline'} size={21} color={allowed ? '#fff' : Colors.accentInk} />
        </View>
        <View style={s.permissionCopy}>
          <Text style={s.permissionTitle}>App notifications</Text>
          <Text style={[s.permissionStatus, allowed && s.permissionStatusOn]}>{permissionLabel}</Text>
          {allowed && !registered && !personal ? <Text style={s.registrationNote}>Phone permission is on. Device registration will retry automatically.</Text> : null}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy || status.isLoading}
          onPress={allowed ? () => Linking.openSettings() : enable}
          style={[s.action, allowed && s.actionSecondary]}
        >
          <Text style={[s.actionText, allowed && s.actionTextSecondary]}>{busy ? 'Please wait' : allowed ? 'Manage' : status.data?.canAskAgain === false ? 'Settings' : 'Enable'}</Text>
        </TouchableOpacity>
      </View>

      {allowed && registered ? (
        <View style={s.preferenceRow}>
          <View style={s.preferenceIcon}><Ionicons name="sparkles-outline" size={20} color={Colors.accentInk} /></View>
          <View style={s.preferenceCopy}>
            <Text style={s.preferenceTitle}>App-exclusive offers</Text>
            <Text style={s.preferenceBody}>Up to two promotional alerts in seven days. Repair updates are always unaffected.</Text>
          </View>
          <Switch disabled={busy} value={!!status.data?.promotionalPushOptIn} onValueChange={setPromotional} />
        </View>
      ) : null}

      <View style={s.preferenceRow}>
        <View style={[s.preferenceIcon, s.whatsappIcon]}><Ionicons name="logo-whatsapp" size={21} color="#087A47" /></View>
        <View style={s.preferenceCopy}>
          <Text style={s.preferenceTitle}>WhatsApp offers</Text>
          <Text style={s.preferenceBody}>Occasional offers on your registered number. Service updates are unaffected.</Text>
        </View>
        <Switch disabled={busy} value={!!status.data?.promotionalWhatsappOptIn} onValueChange={setWhatsApp} />
      </View>

      {status.isError ? <Text accessibilityRole="alert" style={s.error}>Could not check notification preferences. Pull down to retry.</Text> : null}
      {!!message ? <Text accessibilityRole="alert" style={s.message}>{message}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingHorizontal: 20, paddingBottom: 14, gap: 0 },
  permissionRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.line },
  permissionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FF' },
  permissionIconOn: { backgroundColor: Colors.success },
  permissionCopy: { flex: 1, minWidth: 0 },
  permissionTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  permissionStatus: { color: Colors.error, fontSize: 12, lineHeight: 17, marginTop: 3 },
  permissionStatusOn: { color: '#16794A', fontWeight: '700' },
  registrationNote: { color: Colors.inkSecondary, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  action: { minHeight: 40, minWidth: 72, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent },
  actionSecondary: { backgroundColor: Colors.brandSoft },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  actionTextSecondary: { color: Colors.accentInk },
  preferenceRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.line },
  preferenceIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F1FF' },
  whatsappIcon: { backgroundColor: '#E2F7EC' },
  preferenceCopy: { flex: 1, minWidth: 0 },
  preferenceTitle: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  preferenceBody: { color: Colors.inkSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  message: { color: Colors.inkSecondary, fontSize: 12, lineHeight: 17, paddingTop: 12 },
  error: { color: Colors.error, fontSize: 12, lineHeight: 17, paddingTop: 12 },
});
