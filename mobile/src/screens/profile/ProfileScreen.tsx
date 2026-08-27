import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors, Spacing, Radius } from '@/theme';
import type { IconName } from '@/catalog/services';

const SUPPORT_PHONE = '+919999999999';
const WHATSAPP_URL  = 'https://wa.me/919999999999';
const WEBSITE_URL   = 'https://vfixurpc.com';

function InfoRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '—'}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger, subtitle, last }: {
  icon: IconName; label: string; onPress: () => void; danger?: boolean; subtitle?: string; last?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.menuItem, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.6}>
      <View style={[styles.menuIconBox, danger && styles.menuIconBoxDanger]}>
        <Ionicons name={icon} size={19} color={danger ? Colors.error : Colors.brandNavy} />
      </View>
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 12 }}>

        {/* Identity */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{user?.name ?? 'User'}</Text>
            <Text style={styles.heroUsername}>@{user?.username}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color={Colors.accentInk} />
              <Text style={styles.roleText}>{user?.role === 'CUSTOMER' ? 'Customer' : user?.role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account details</Text>
          <View style={styles.card}>
            <InfoRow label="Full name" value={user?.name} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Phone" value={user?.phone} />
            <InfoRow label="Username" value={user?.username} last />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <MenuItem icon="call-outline" label="Call us" subtitle="+91 99999 99999" onPress={() => open(`tel:${SUPPORT_PHONE}`)} />
            <MenuItem icon="logo-whatsapp" label="WhatsApp support" subtitle="Chat with our team" onPress={() => open(WHATSAPP_URL)} />
            <MenuItem icon="globe-outline" label="Visit website" subtitle="vfixurpc.com" onPress={() => open(WEBSITE_URL)} last />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.card}>
            <MenuItem icon="document-text-outline" label="Terms of Service" onPress={() => open(`${WEBSITE_URL}/terms`)} />
            <MenuItem icon="lock-closed-outline" label="Privacy Policy" onPress={() => open(`${WEBSITE_URL}/privacy`)} last />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.card}>
            <MenuItem icon="log-out-outline" label="Sign out" danger onPress={handleLogout} last />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLine}>VfixurPC · GSTIN 27FXQPB4377D1Z8</Text>
          <Text style={styles.footerLine}>vfixurpc.com · Mumbai, India</Text>
          <Text style={styles.footerVersion}>App v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  avatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.brandNavy,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 25, fontWeight: '800', color: Colors.white },
  heroName:    { fontSize: 24, fontWeight: '800', color: Colors.ink, letterSpacing: -0.5 },
  heroUsername:{ fontSize: 14, color: Colors.inkTertiary, marginTop: 2 },
  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.brandSoft, borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start' },
  roleText:    { fontSize: 12, fontWeight: '700', color: Colors.accentInk },

  section:     { paddingHorizontal: Spacing.md, marginTop: Spacing.lg },
  sectionTitle:{ fontSize: 12, fontWeight: '700', color: Colors.inkTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginLeft: 4 },

  card: { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, overflow: 'hidden', paddingHorizontal: Spacing.md },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.line },
  infoLabel: { fontSize: 13, color: Colors.inkSecondary, fontWeight: '500', flex: 0.4 },
  infoValue: { fontSize: 14, color: Colors.ink, fontWeight: '600', flex: 0.6, textAlign: 'right' },

  menuItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.line },
  menuIconBox: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuIconBoxDanger: { backgroundColor: Colors.errorLight },
  menuText:    { flex: 1 },
  menuLabel:   { fontSize: 15, fontWeight: '600', color: Colors.ink, letterSpacing: -0.2 },
  menuLabelDanger: { color: Colors.error },
  menuSub:     { fontSize: 12, color: Colors.inkTertiary, marginTop: 1 },

  footer:      { alignItems: 'center', padding: Spacing.xl, paddingBottom: Spacing.lg },
  footerLine:  { fontSize: 11, color: Colors.gray400, lineHeight: 18 },
  footerVersion:{ fontSize: 10, color: Colors.gray300, marginTop: 4 },
});
