import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, StatusBar, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { Colors, Spacing, Typography } from '@/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types';
import Toast from 'react-native-toast-message';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({ name: '', email: '', phone: '', username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (val: string) => setForm((f) => ({ ...f, [key]: val }));

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
    setLoading(true);
    try {
      await register({ ...form, phone: `+91${digits}` });
    } catch (e: unknown) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: getApiErrorMessage(e) });
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
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={Colors.ink} />
          </TouchableOpacity>

          <View style={styles.head}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.sub}>Book doorstep repair in minutes.</Text>
          </View>

          <Input label="Full name" value={form.name} onChangeText={update('name')} placeholder="Raj Sharma" autoCapitalize="words" />
          <Input label="Email" value={form.email} onChangeText={update('email')} placeholder="raj@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Phone number" value={form.phone} onChangeText={update('phone')} placeholder="10-digit mobile (we add +91)" keyboardType="phone-pad" autoCapitalize="none" />
          <Input label="Username" value={form.username} onChangeText={update('username')} placeholder="Choose a username" autoCapitalize="none" />
          <Input
            label="Password"
            value={form.password}
            onChangeText={update('password')}
            placeholder="Minimum 8 characters"
            secureTextEntry={!showPass}
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
            By registering you agree to our Terms of Service.{'\n'}GSTIN 27FXQPB4377D1Z8  ·  vfixurpc.com
          </Text>
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
});
