import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar, Linking, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { Colors, Spacing, Radius } from '@/theme';
import type { IconName } from '@/catalog/services';
import { SUPPORT_PHONE_E164, supportWhatsAppUrl } from '@/config/contact';

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

export default function ProfileScreen({ navigation }: any) {
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

  async function shareReferral() {
    if (!user?.username) return;
    try {
      await Share.share({
        title: 'Try VfixurPC',
        message: `Need a device repaired? Join VfixurPC and enter my referral code ${user.username} during your first booking to receive 10% off your first repair quotation.\n\nhttps://vfixurpc.com`,
      });
    } catch {
      Alert.alert('Could not share', 'Please try again in a moment.');
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 12 }}>

        <View style={styles.pageHead}><View><Text style={styles.pageEyebrow}>YOUR ACCOUNT</Text><Text style={styles.pageTitle}>Profile</Text></View><View style={styles.secureMark}><Ionicons name="shield-checkmark" size={22} color={Colors.accentInk} /></View></View>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{user?.name ?? 'User'}</Text>
            <Text style={styles.heroUsername}>@{user?.username}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#fff" />
              <Text style={styles.roleText}>{user?.role === 'CUSTOMER' ? 'Verified customer' : user?.role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickAction} onPress={() => open(`tel:${SUPPORT_PHONE_E164}`)}><View style={styles.quickIcon}><Ionicons name="call" size={19} color={Colors.accentInk} /></View><Text style={styles.quickLabel}>Call</Text></TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => open(supportWhatsAppUrl())}><View style={[styles.quickIcon, { backgroundColor: '#E1F8EA' }]}><Ionicons name="logo-whatsapp" size={20} color="#139B4D" /></View><Text style={styles.quickLabel}>WhatsApp</Text></TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('MyDevices')}><View style={styles.quickIcon}><Ionicons name="laptop-outline" size={20} color={Colors.accentInk} /></View><Text style={styles.quickLabel}>Devices</Text></TouchableOpacity>
        </View>

        {user?.role === 'CUSTOMER' && user.username ? (
          <View style={styles.referralCard}>
            <View style={styles.referralIcon}>
              <Ionicons name="gift" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.referralCopy}>
              <Text style={styles.referralEyebrow}>REFER A FRIEND</Text>
              <Text style={styles.referralTitle}>Share 10% off</Text>
              <Text style={styles.referralBody}>Your friend enters <Text style={styles.referralUsername}>{user.username}</Text> during their first booking.</Text>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={shareReferral} accessibilityRole="button" accessibilityLabel="Share your referral username">
              <Ionicons name="share-outline" size={20} color={Colors.brandNavy} />
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account details</Text>
          <View style={styles.card}>
            <InfoRow label="Full name" value={user?.name} />
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label="Phone" value={user?.phone} />
            <InfoRow label="Username" value={user?.username} last />
          </View>
          <View style={[styles.card, { marginTop: 10 }]}>
            <MenuItem icon="mail-outline" label="Change email" subtitle="Verify a new email address" onPress={() => navigation.navigate('ChangeEmail')} last />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.card}>
            <MenuItem icon="help-circle-outline" label="Help & FAQ" subtitle="Common questions answered" onPress={() => navigation.navigate('Faq')} />
            <MenuItem icon="globe-outline" label="Visit website" subtitle="vfixurpc.com" onPress={() => open(WEBSITE_URL)} last />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.card}>
            <MenuItem icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate('Legal',{kind:'terms'})} />
            <MenuItem icon="lock-closed-outline" label="Privacy Policy" onPress={() => navigation.navigate('Legal',{kind:'privacy'})} />
            <MenuItem icon="trash-outline" label="Delete account" danger onPress={() => navigation.navigate('DeleteAccount')} last />
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

  pageHead: { paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pageEyebrow: { color: Colors.accentInk, fontSize: 10, fontWeight: '900' },
  pageTitle: { color: Colors.ink, fontSize: 29, fontWeight: '900', marginTop: 2 },
  secureMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    marginHorizontal: Spacing.md, padding: 18, borderRadius: 8, backgroundColor: Colors.brandNavy,
  },
  avatar: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: 25, fontWeight: '800', color: Colors.brandNavy },
  heroName:    { fontSize: 23, fontWeight: '800', color: Colors.white },
  heroUsername:{ fontSize: 13, color: '#B8CCE4', marginTop: 2 },
  roleBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,.16)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start' },
  roleText:    { fontSize: 11, fontWeight: '700', color: Colors.white },

  quickRow: { flexDirection: 'row', gap: 9, paddingHorizontal: Spacing.md, marginTop: 12 },
  quickAction: { flex: 1, minHeight: 76, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { color: Colors.ink, fontSize: 11.5, fontWeight: '800' },

  referralCard: { marginHorizontal: Spacing.md, marginTop: 12, minHeight: 122, padding: 16, borderRadius: 8, backgroundColor: '#E8F3FF', borderWidth: 1, borderColor: '#C8DEF7', flexDirection: 'row', alignItems: 'center', gap: 12 },
  referralIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.brandNavy, alignItems: 'center', justifyContent: 'center' },
  referralCopy: { flex: 1 },
  referralEyebrow: { color: Colors.accentInk, fontSize: 10, fontWeight: '900' },
  referralTitle: { color: Colors.ink, fontSize: 18, fontWeight: '900', marginTop: 2 },
  referralBody: { color: Colors.inkSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  referralUsername: { color: Colors.brandNavy, fontWeight: '900' },
  shareButton: { minWidth: 62, minHeight: 58, paddingHorizontal: 8, borderRadius: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#BDD5EF', alignItems: 'center', justifyContent: 'center', gap: 3 },
  shareButtonText: { color: Colors.brandNavy, fontSize: 11, fontWeight: '800' },

  section:     { paddingHorizontal: Spacing.md, marginTop: Spacing.lg },
  sectionTitle:{ fontSize: 12, fontWeight: '700', color: Colors.inkTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm, marginLeft: 4 },

  card: { backgroundColor: Colors.white, borderRadius: 8, overflow: 'hidden', paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.line },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.line },
  infoLabel: { fontSize: 13, color: Colors.inkSecondary, fontWeight: '500', flex: 0.4 },
  infoValue: { fontSize: 14, color: Colors.ink, fontWeight: '600', flex: 0.6, textAlign: 'right' },

  menuItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.line },
  menuIconBox: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuIconBoxDanger: { backgroundColor: Colors.errorLight },
  menuText:    { flex: 1 },
  menuLabel:   { fontSize: 15, fontWeight: '600', color: Colors.ink, letterSpacing: -0.2 },
  menuLabelDanger: { color: Colors.error },
  menuSub:     { fontSize: 12, color: Colors.inkTertiary, marginTop: 1 },

  footer:      { alignItems: 'center', padding: Spacing.xl, paddingBottom: Spacing.lg },
  footerLine:  { fontSize: 11, color: Colors.gray400, lineHeight: 18 },
  footerVersion:{ fontSize: 10, color: Colors.gray300, marginTop: 4 },
});
