import React from 'react';
import { AppState, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, session } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/theme';
import { registerForPushNotificationsAsync } from './push';

const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function PushPermissionGate() {
  const { user } = useAuth();
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [mode, setMode] = React.useState<'request' | 'settings'>('request');
  const checking = React.useRef(false);
  const queryClient = useQueryClient();
  const storageKey = `push-permission-v2-reminder:${user?.id ?? 'anonymous'}`;

  const inspectAndSync = React.useCallback(async () => {
    if (!user || checking.current) return;
    checking.current = true;
    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.granted) {
        const revision = session.revision;
        const token = await registerForPushNotificationsAsync();
        if (token && revision === session.revision) await authApi.updateFcmToken(token);
        await queryClient.invalidateQueries({ queryKey: ['device-notifications'] });
        setVisible(false);
        return;
      }
      const lastDismissed = Number(await SecureStore.getItemAsync(storageKey)) || 0;
      if (Date.now() - lastDismissed >= REMIND_AFTER_MS) {
        setMode(permissions.canAskAgain ? 'request' : 'settings');
        setVisible(true);
      }
    } finally {
      checking.current = false;
    }
  }, [queryClient, storageKey, user]);

  React.useEffect(() => {
    const timer = setTimeout(inspectAndSync, 900);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') inspectAndSync();
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [inspectAndSync]);

  async function allow() {
    setBusy(true);
    setError('');
    const revision = session.revision;
    try {
      if (mode === 'settings') {
        await Linking.openSettings();
        setVisible(false);
        return;
      }
      const token = await registerForPushNotificationsAsync();
      if (revision !== session.revision) return;
      const permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted) {
        setMode(permissions.canAskAgain ? 'request' : 'settings');
        setError(permissions.canAskAgain
          ? 'Notifications were not enabled. You can try again.'
          : 'Notifications are blocked for VfixurPC. Open phone settings to allow them.');
        return;
      }
      if (token) await authApi.updateFcmToken(token);
      await queryClient.invalidateQueries({ queryKey: ['device-notifications'] });
      setVisible(false);
    } catch {
      setError('Notifications could not be enabled. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function later() {
    await SecureStore.setItemAsync(storageKey, String(Date.now()));
    setVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={later} statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity accessibilityLabel="Not now" style={StyleSheet.absoluteFill} onPress={later} />
        <View style={styles.sheet} accessibilityRole="alert" accessibilityLabel="Enable VfixurPC notifications">
          <View style={styles.handle} />
          <View style={styles.iconWrap}>
            <View style={styles.icon}><Ionicons name="notifications" size={31} color="#fff" /></View>
            <View style={styles.statusDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>
          </View>
          <Text style={styles.kicker}>VFIXURPC UPDATES</Text>
          <Text style={styles.title}>{mode === 'settings' ? 'Turn notifications back on' : 'Know what happens next'}</Text>
          <Text style={styles.body}>{mode === 'settings'
            ? `Allow VfixurPC notifications in your ${Platform.OS === 'ios' ? 'iPhone' : 'phone'} settings, then return to the app.`
            : 'Get pickup, diagnosis, quotation and completion alerts even when your phone is locked.'}</Text>
          <View style={styles.preview}>
            <View style={styles.previewIcon}><Ionicons name="construct-outline" size={22} color={Colors.accentInk} /></View>
            <View style={styles.previewCopy}><Text style={styles.previewApp}>VfixurPC</Text><Text style={styles.previewText}>Your repair status has been updated.</Text></View>
            <Text style={styles.previewTime}>now</Text>
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity disabled={busy} onPress={allow} style={styles.primary}>
            <Ionicons name={mode === 'settings' ? 'settings-outline' : 'notifications-outline'} size={20} color="#fff" />
            <Text style={styles.primaryText}>{busy ? 'Please wait...' : mode === 'settings' ? 'Open phone settings' : 'Continue'}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={later} style={styles.secondary}><Text style={styles.secondaryText}>Not now</Text></TouchableOpacity>
          <Text style={styles.footnote}>Promotional alerts are controlled separately in Notifications.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(7, 22, 42, 0.58)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24, alignItems: 'center', shadowColor: '#00152F', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 18 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: Colors.gray300, marginBottom: 20 },
  iconWrap: { width: 74, height: 74, marginBottom: 14 },
  icon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandNavy },
  statusDot: { position: 'absolute', right: 0, bottom: 2, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#fff', backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: Colors.accentInk, fontSize: 10, fontWeight: '900', letterSpacing: 0 },
  title: { color: Colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  body: { color: Colors.inkSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 9, maxWidth: 350 },
  preview: { alignSelf: 'stretch', minHeight: 72, borderRadius: 14, backgroundColor: '#F2F6FB', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 20, borderWidth: 1, borderColor: Colors.line },
  previewIcon: { width: 42, height: 42, borderRadius: 11, backgroundColor: '#E1EEFF', alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1 },
  previewApp: { color: Colors.ink, fontSize: 13, fontWeight: '800' },
  previewText: { color: Colors.inkSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  previewTime: { color: Colors.inkTertiary, fontSize: 10, alignSelf: 'flex-start', marginTop: 2 },
  error: { color: Colors.error, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  primary: { alignSelf: 'stretch', minHeight: 54, borderRadius: 10, backgroundColor: Colors.accent, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20, marginTop: 4 },
  secondaryText: { color: Colors.inkSecondary, fontSize: 14, fontWeight: '700' },
  footnote: { color: Colors.inkTertiary, fontSize: 10.5, lineHeight: 15, textAlign: 'center', marginTop: 3 },
});
