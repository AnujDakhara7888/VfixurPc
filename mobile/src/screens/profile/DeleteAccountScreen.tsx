import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import LargeHeader from '@/components/LargeHeader';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { authApi, clearTokens, getApiErrorMessage } from '@/api/client';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
export default function DeleteAccountScreen({ navigation }: any) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const inFlight = useRef(false);
  async function remove() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      if (!deleted) {
        await authApi.deleteAccount(password);
        setDeleted(true);
        setPassword('');
      }
    } catch (e) {
      setError(getApiErrorMessage(e));
      inFlight.current = false; setBusy(false);
      return;
    }
    try {
      await clearTokens();
      await Notifications.setBadgeCountAsync(0).catch(() => {});
      Toast.show({ type: 'success', text1: 'Account deleted', text2: 'You have been signed out.' });
    } catch {
      setError('Your account was deleted, but this device could not clear its saved session. Retry signing out.');
      inFlight.current = false; setBusy(false);
    }
  }
  return <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <LargeHeader title="Delete account" onBack={() => !busy && navigation.goBack()} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
      <Text style={{ fontSize: 16, lineHeight: 24, color: '#17252c' }}>This permanently disables your account and anonymises your profile, saved device details and booking contact details. Request attachments and account notification preferences are removed. Your sessions are revoked and this account cannot be restored.</Text>
      <Text style={{ fontSize: 15, lineHeight: 23, color: '#475569' }}>Invoice, tax, quote and warranty records remain separate and may still identify you. Condition photos are retained as warranty or dispute evidence, not as general request uploads. Previously sent messages and backup copies are not erased by this action. Contact contact@vfixurpc.com to request review of retained data. Your ongoing repair is not cancelled. Keep your request number and arrange any outstanding handover with support before deleting.</Text>
      <TouchableOpacity onPress={() => navigation.navigate('Legal', { kind: 'privacy' })}><Text style={{ color: '#1764ac' }}>Privacy policy and retained records</Text></TouchableOpacity>
      {!deleted && <Input label="Confirm your password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={64} />}
      {!!error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>}
      <Button label={deleted ? 'Retry signing out' : 'Delete my account'} variant="danger" loading={busy} disabled={busy || (!deleted && !password)} onPress={() => deleted ? remove() : Alert.alert('Permanently delete your account?', 'Account access cannot be restored. The retained records described above are not erased.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete account', style: 'destructive', onPress: remove }])} />
    </ScrollView>
  </View>;
}
