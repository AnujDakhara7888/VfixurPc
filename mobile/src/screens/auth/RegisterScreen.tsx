import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, type RegistrationChallenge } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { Colors, Spacing, Typography } from '@/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import Toast from 'react-native-toast-message';
import { birthdayToIso, formatBirthdayInput } from '@/utils/birthday';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props) {
  const { register, verifyRegistrationOtp, resendRegistrationOtp } = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', email: '', phone: '', username: '', password: '', birthday: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const update = (key: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [key]: val }));
  const updateBirthday = (value: string) => {
    setForm((current) => ({ ...current, birthday: formatBirthdayInput(value) }));
  };

  async function handleRegister() {
    if (!form.name || !form.email || !form.phone || !form.username || !form.password) {
      Toast.show({ type: 'error', text1: 'All fields are required' });
      return;
    }
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      Toast.show({ type: 'error', text1: 'Enter a valid 10-digit phone number' });
      return;
    }
    if (form.password.length < 8) {
      Toast.show({ type: 'error', text1: 'Password must be at least 8 characters' });
      return;
    }
    let dateOfBirth: string | undefined;
    if (form.birthday.trim()) {
      dateOfBirth = birthdayToIso(form.birthday.trim());
      if (!dateOfBirth) {
        Toast.show({ type: 'error', text1: 'Enter a valid birthday in DD-MM-YYYY format' });
        return;
      }
    }
    setLoading(true);
    try {
      const { birthday: _birthday, ...account } = form;
      const next = await register({ ...account, phone: `+91${digits}`, dateOfBirth });
      if (next) {
        setChallenge(next);
        setCode('');
        setCooldown(60);
      }
    } catch (e: unknown) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: getApiErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!challenge || !/^\d{6}$/.test(code)) {
      Toast.show({ type: 'error', text1: 'Enter the 6-digit email code' });
      return;
    }
    setLoading(true);
    try {
      await verifyRegistrationOtp(challenge.challengeId, code);
    } catch (error: unknown) {
      Toast.show({ type: 'error', text1: 'Verification failed', text2: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!challenge || cooldown) return;
    setLoading(true);
    try {
      await resendRegistrationOtp(challenge.challengeId);
      setCooldown(60);
      Toast.show({ type: 'success', text1: 'New email code sent' });
    } catch (error: unknown) {
      Toast.show({ type: 'error', text1: 'Could not resend code', text2: getApiErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => challenge ? setChallenge(null) : navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.ink} />
          </TouchableOpacity>

          <View style={styles.head}>
            <Text style={styles.title}>{challenge ? 'Verify your email' : 'Create account'}</Text>
            <Text style={styles.sub}>{challenge ? `Enter the code sent to ${challenge.maskedEmail}. Check your spam folder if needed.` : 'Book doorstep repair in minutes.'}</Text>
          </View>

          {!challenge ? <>
          <Input label="Full name" value={form.name} onChangeText={update('name')} placeholder="Raj Sharma" autoCapitalize="words" />
          <Input label="Email" value={form.email} onChangeText={update('email')} placeholder="raj@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone number" value={form.phone} onChangeText={update('phone')} placeholder="10-digit mobile (we add +91)" keyboardType="phone-pad" autoCapitalize="none" />
          <Input label="Username" value={form.username} onChangeText={update('username')} placeholder="Choose a username" autoCapitalize="none" />
          <Input label="Birthday (optional)" value={form.birthday} onChangeText={updateBirthday} placeholder="DD-MM-YYYY" keyboardType="number-pad" maxLength={10} />
          <Input
            label="Password"
            value={form.password}
            onChangeText={update('password')}
            placeholder="Minimum 8 characters"
            secureTextEntry={!showPass}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={<Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.gray400} />}
            onRightIconPress={() => setShowPass((v) => !v)}
          />

          <Button label="Create account" onPress={handleRegister} loading={loading} style={{ marginTop: Spacing.sm }} />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerTxt}>Already registered?</Text>
            <View style={styles.line} />
          </View>
          <Button label="Sign in" onPress={() => navigation.goBack()} variant="outline" />

          <Text style={styles.terms}>
            By registering you agree to our <Text style={{color:Colors.accentInk}} onPress={()=>navigation.navigate('Legal',{kind:'terms'})}>Terms of Service</Text> and acknowledge our <Text style={{color:Colors.accentInk}} onPress={()=>navigation.navigate('Legal',{kind:'privacy'})}>Privacy Policy</Text>.
          </Text>
          </> : <>
            <View style={styles.verificationIcon}>
              <Ionicons name="mail-outline" size={28} color={Colors.accentInk} />
            </View>
            <Input
              label="6-digit verification code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
            />
            <Button label="Verify and create account" onPress={handleVerify} loading={loading} style={{ marginTop: Spacing.sm }} />
            <TouchableOpacity disabled={!!cooldown || loading} onPress={resend} style={styles.resendButton}>
              <Text style={[styles.resendText, !!cooldown && styles.resendDisabled]}>
                {cooldown ? `Send a new code in ${cooldown}s` : 'Send a new email code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setChallenge(null); setCode(''); }} style={styles.editButton}>
              <Text style={styles.editText}>Change account details</Text>
            </TouchableOpacity>
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgApp },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },

  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface,
  },
  head:  { marginTop: Spacing.lg, marginBottom: Spacing.lg },
  title: { ...Typography.largeTitle },
  sub:   { fontSize: 15, color: Colors.inkSecondary, marginTop: 6 },

  divider:    { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg },
  line:       { flex: 1, height: 1, backgroundColor: Colors.line },
  dividerTxt: { fontSize: 12, color: Colors.inkTertiary, marginHorizontal: Spacing.sm, fontWeight: '500' },

  terms: { textAlign: 'center', color: Colors.gray400, fontSize: 11, lineHeight: 18, marginTop: Spacing.lg },
  verificationIcon: {
    width: 58, height: 58, borderRadius: 29, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSoft,
    marginBottom: Spacing.lg,
  },
  resendButton: { paddingVertical: 16 },
  resendText: { color: Colors.accentInk, textAlign: 'center', fontWeight: '700' },
  resendDisabled: { color: Colors.gray400 },
  editButton: { paddingVertical: 10 },
  editText: { color: Colors.inkSecondary, textAlign: 'center', fontWeight: '600' },
});
