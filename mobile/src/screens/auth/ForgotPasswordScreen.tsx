import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { api, getApiErrorMessage } from '@/api/client';
import LargeHeader from '@/components/LargeHeader';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { Colors } from '@/theme';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(v => v - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  async function request() {
    setBusy(true); setMessage('');
    try {
      const { data } = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setMessage(data.message); setSent(true); setCooldown(60);
    } catch (error) { setMessage(getApiErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (password !== confirm) { setMessage('Passwords do not match.'); return; }
    setBusy(true); setMessage('');
    try {
      const { data } = await api.post('/auth/reset-password', { identifier: identifier.trim(), code: code.trim(), password });
      setSent(false); setCode(''); setPassword(''); setConfirm(''); setMessage(data.message);
    } catch (error) { setMessage(getApiErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <LargeHeader title="Reset password" onBack={() => navigation.goBack()} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: Colors.inkSecondary, lineHeight: 21 }}>We will send a six-digit code to the email address registered with your account.</Text>
        <Input label="Username, email or phone" value={identifier} onChangeText={v => { setIdentifier(v); setSent(false); setCode(''); }} placeholder="Username or +91 phone number" autoCapitalize="none" autoCorrect={false} />
        {!!message && <Text accessibilityRole="alert" style={{ color: Colors.inkSecondary, lineHeight: 22 }}>{message}</Text>}
        {sent && <>
          <Input label="6-digit email code" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" />
          <Input label="New password (8-64 characters)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={64} />
          <Input label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={64} />
          <Button label="Change password" loading={busy} onPress={reset} />
        </>}
        <Button label={cooldown ? `Resend in ${cooldown}s` : sent ? 'Resend code' : 'Send reset code'} disabled={busy || cooldown > 0 || !identifier.trim()} loading={busy && !sent} onPress={request} variant={sent ? 'outline' : 'primary'} />
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ paddingVertical: 16 }}><Text style={{ color: Colors.accentInk, textAlign: 'center', fontWeight: '600' }}>Back to sign in</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
