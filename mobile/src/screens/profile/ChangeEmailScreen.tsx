import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import LargeHeader from '@/components/LargeHeader';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { useAuth, type EmailChangeChallenge } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import { Colors, Spacing } from '@/theme';

export default function ChangeEmailScreen({ navigation }: any) {
  const { user, requestEmailChange, verifyEmailChange } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<EmailChangeChallenge | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Enter your new email and password' });
      return;
    }
    setBusy(true);
    try {
      const next = await requestEmailChange(email, password);
      setNewEmail(email);
      setChallenge(next);
      setCode('');
      setCooldown(60);
      Toast.show({ type: 'success', text1: 'Verification code sent', text2: `Check ${next.maskedEmail}` });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Could not send code', text2: getApiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!challenge || !/^\d{6}$/.test(code)) {
      Toast.show({ type: 'error', text1: 'Enter the 6-digit email code' });
      return;
    }
    setBusy(true);
    try {
      await verifyEmailChange(challenge.challengeId, code);
      Toast.show({ type: 'success', text1: 'Email updated', text2: 'Future sign-in codes will go to your new address.' });
      navigation.goBack();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: getApiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgApp }}>
      <LargeHeader
        title={challenge ? 'Verify new email' : 'Change email'}
        subtitle={challenge ? `Enter the code sent to ${challenge.maskedEmail}.` : `Current email: ${user?.email ?? ''}`}
        onBack={() => challenge ? setChallenge(null) : navigation.goBack()}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 60 }}>
          {!challenge ? <>
            <Text style={{ color: Colors.inkSecondary, fontSize: 14, lineHeight: 21, marginBottom: 18 }}>
              We will send a verification code to the new address. Your email changes only after that code is accepted.
            </Text>
            <Input label="New email" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="new@example.com" editable={!busy} />
            <Input label="Confirm your password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} />
            <Button label="Send verification code" onPress={sendCode} loading={busy} disabled={busy || !newEmail.trim() || !password} />
          </> : <>
            <Input label="6-digit verification code" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} editable={!busy} placeholder="000000" />
            <Button label="Verify and change email" onPress={verify} loading={busy} disabled={busy || code.length !== 6} />
            <Button label={cooldown ? `Send another code in ${cooldown}s` : 'Send another code'} onPress={sendCode} variant="ghost" disabled={busy || !!cooldown} style={{ marginTop: 10 }} />
            <Text style={{ color: Colors.inkSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12 }}>
              The code expires after 10 minutes. Changing your email signs out other sessions for account safety.
            </Text>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
