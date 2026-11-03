import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, type LoginChallenge } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Brand from '@/components/Brand';
import { Colors, Spacing, Typography } from '@/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import Toast from 'react-native-toast-message';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

const TRUST = [
  { icon: 'shield-checkmark-outline' as const, label: 'Certified' },
  { icon: 'home-outline' as const,             label: 'Doorstep' },
  { icon: 'card-outline' as const,             label: 'Fair pricing' },
];

export default function LoginScreen({ navigation }: Props) {
  const { login, verifyLoginOtp, resendLoginOtp } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(v => v - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Fill in all fields' });
      return;
    }
    setLoading(true);
    try {
      const next = await login(username.trim(), password);
      if (next) { setChallenge(next); setCode(''); setCooldown(60); }
    } catch (e: unknown) {
      Toast.show({ type: 'error', text1: 'Login failed', text2: getApiErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!challenge || !/^\d{6}$/.test(code)) { Toast.show({ type: 'error', text1: 'Enter the 6-digit code' }); return; }
    setLoading(true);
    try { await verifyLoginOtp(challenge.challengeId, code); }
    catch (e: unknown) { Toast.show({ type: 'error', text1: 'Verification failed', text2: getApiErrorMessage(e) }); }
    finally { setLoading(false); }
  }

  async function resend() {
    if (!challenge || cooldown) return;
    setLoading(true);
    try { await resendLoginOtp(challenge.challengeId); setCooldown(60); Toast.show({ type: 'success', text1: 'New code sent' }); }
    catch (e: unknown) { Toast.show({ type: 'error', text1: 'Could not resend code', text2: getApiErrorMessage(e) }); }
    finally { setLoading(false); }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 36 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <Brand size="md" />
            <View style={styles.cityChip}>
              <Ionicons name="location" size={12} color={Colors.accentInk} />
              <Text style={styles.cityTxt}>Mumbai</Text>
            </View>
          </View>

          <View style={styles.head}>
            <Text style={styles.title}>{challenge ? 'Verify it is you' : 'Welcome back'}</Text>
            <Text style={styles.sub}>{challenge ? `Enter the email code sent to ${challenge.maskedEmail}. Check your spam folder if it is not in your inbox.` : 'Sign in to book and track doorstep repairs.'}</Text>
          </View>

          {!challenge ? <><Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.gray400} />
            }
            onRightIconPress={() => setShowPassword((v) => !v)}
          />

          <Button label="Sign in" onPress={handleLogin} loading={loading} style={{ marginTop: Spacing.sm }} />
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={{ paddingVertical: 16, alignSelf: 'flex-end' }}><Text style={{ color: Colors.accentInk, fontWeight: '600' }}>Forgot password?</Text></TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerTxt}>New to VfixurPC?</Text>
            <View style={styles.line} />
          </View>

          <Button label="Create an account" onPress={() => navigation.navigate('Register')} variant="outline" />
          </> : <>
            <Input label="6-digit verification code" value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} />
            <Button label="Verify and sign in" onPress={handleVerify} loading={loading} style={{ marginTop: Spacing.sm }} />
            <TouchableOpacity disabled={!!cooldown || loading} onPress={resend} style={{ paddingVertical: 16 }}><Text style={{ color: cooldown ? Colors.gray400 : Colors.accentInk, textAlign: 'center', fontWeight: '700' }}>{cooldown ? `Send a new code in ${cooldown}s` : 'Send a new code'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setChallenge(null); setCode(''); }} style={{ paddingVertical: 10 }}><Text style={{ color: Colors.inkSecondary, textAlign: 'center', fontWeight: '600' }}>Use different sign-in details</Text></TouchableOpacity>
          </>}

          <View style={styles.trustRow}>
            {TRUST.map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <Ionicons name={t.icon} size={15} color={Colors.accentInk} />
                <Text style={styles.trustTxt}>{t.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>GSTIN 27FXQPB4377D1Z8  ·  vfixurpc.com</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgApp },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.brandSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  cityTxt:  { fontSize: 12, fontWeight: '800', color: Colors.accentInk },

  head:   { marginTop: Spacing.xl, marginBottom: Spacing.lg },
  title:  { ...Typography.largeTitle },
  sub:    { fontSize: 15, color: Colors.inkSecondary, marginTop: 6 },

  divider:    { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg },
  line:       { flex: 1, height: 1, backgroundColor: Colors.line },
  dividerTxt: { fontSize: 12, color: Colors.inkTertiary, marginHorizontal: Spacing.sm, fontWeight: '500' },

  trustRow:  { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: Spacing.xl },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trustTxt:  { fontSize: 12.5, color: Colors.inkSecondary, fontWeight: '600' },

  footer: { textAlign: 'center', color: Colors.gray400, fontSize: 11, marginTop: Spacing.xl },
});
