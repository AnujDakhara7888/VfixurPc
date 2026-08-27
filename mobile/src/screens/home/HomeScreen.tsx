import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, StatusBar, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { srApi } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import { BrandMark } from '@/components/Brand';
import { PressableScale, FadeIn } from '@/components/Motion';
import { Colors, Spacing, Radius, Shadow, Gradients, STATUS_CONFIG } from '@/theme';
import { SERVICE_CATEGORIES, formatDeviceName, type IconName } from '@/catalog/services';
import type { ServiceRequest } from '@/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList, AppTabParamList } from '@/types';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { format, parseISO } from 'date-fns';

type Props = { navigation: NativeStackNavigationProp<HomeStackParamList, 'Home'> };

const W = Dimensions.get('window').width;

const TRUST_METRICS: { icon: IconName; value: string; label: string }[] = [
  { icon: 'star',           value: '4.9',     label: 'Avg. rating' },
  { icon: 'flash',          value: '60 min',  label: 'Pickup ETA' },
  { icon: 'shield-checkmark', value: '6-month', label: 'Warranty' },
];

const WHY: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'bag-handle-outline',        title: 'Free doorstep pickup & drop', sub: 'A certified agent collects and returns your device — you never leave home.' },
  { icon: 'receipt-outline',           title: 'Transparent quote, first',    sub: 'We diagnose, then share a fixed price. No surprises, no pressure.' },
  { icon: 'ribbon-outline',            title: 'Certified Windows & Mac pros', sub: 'Trained technicians, genuine parts, and a 6-month repair warranty.' },
];

const STEPS: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'calendar-outline',   title: 'Book online',      sub: 'Pick your service, date and time slot' },
  { icon: 'bag-handle-outline', title: 'We pick it up',    sub: 'A certified technician collects at your door' },
  { icon: 'search-outline',     title: 'Diagnose & quote', sub: 'A transparent quote before any repair' },
  { icon: 'home-outline',       title: 'Repair & deliver', sub: 'Fixed and returned the same or next day' },
];

const STATUS_STEP: Record<string, number> = {
  PICKUP_SCHEDULED: 1, PICKED_UP: 2, RECEIVED_AT_WORKSHOP: 3,
  DIAGNOSED: 4, QUOTATION_SHARED: 5, PAYMENT_RECEIVED: 6,
  UNDER_REPAIR: 7, REPAIR_COMPLETE: 8, OUT_FOR_DELIVERY: 9, DELIVERED: 10,
};

function RepairCard({ sr, onPress }: { sr: ServiceRequest; onPress: () => void }) {
  const step = STATUS_STEP[sr.status] ?? 1;
  const pct  = (step / 10) * 100;
  const cfg  = STATUS_CONFIG[sr.status] ?? { dot: Colors.accent };
  const needsAction = sr.status === 'QUOTATION_SHARED';
  const dateStr = (() => {
    try { return format(parseISO(sr.createdAt), 'dd MMM yyyy'); } catch { return ''; }
  })();

  return (
    <PressableScale style={s.repairCard} onPress={onPress}>
      {needsAction && (
        <View style={s.urgentStrip}>
          <Ionicons name="alert-circle" size={14} color={Colors.warning} />
          <Text style={s.urgentTxt}>Action required — review your quote</Text>
        </View>
      )}
      <View style={s.repairRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.repairNum}>{sr.serviceRequestNumber ?? sr.ticketNumber}</Text>
          <Text style={s.repairDevice} numberOfLines={1}>{formatDeviceName(sr.device)}</Text>
        </View>
        <StatusBadge status={sr.status} size="sm" />
      </View>
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: cfg.dot }]} />
        </View>
        <Text style={s.progressTxt}>Step {step}/10</Text>
      </View>
      <View style={s.repairFooter}>
        <Text style={s.repairDate}>Booked {dateStr}</Text>
        <View style={s.repairLink}>
          <Text style={s.repairLinkTxt}>Track</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.accentInk} />
        </View>
      </View>
    </PressableScale>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const tabNav   = useNavigation<BottomTabNavigationProp<AppTabParamList>>();

  const { data, isRefetching, refetch } = useQuery<ServiceRequest[]>({
    queryKey: ['my-requests'],
    queryFn: srApi.list,
    refetchInterval: 60_000,
  });

  const requests = Array.isArray(data) ? data : [];
  const active   = requests.filter(r => r.status !== 'DELIVERED');

  const startBooking = (categoryId?: string) =>
    tabNav.navigate('BookTab', { screen: 'Step1Device', params: { preselectCategory: categoryId } });

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ─── TOP BAR ─────────────────────────────────────────── */}
        <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
          <View>
            <Text style={s.greeting}>Good {tod()},</Text>
            <Text style={s.name}>{user?.name?.split(' ')[0] ?? 'there'}</Text>
          </View>
          {active.length > 0 ? (
            <View style={s.activePill}>
              <View style={s.activeDot} />
              <Text style={s.activeTxt}>{active.length} active</Text>
            </View>
          ) : (
            <BrandMark size="sm" />
          )}
        </View>

        {/* ─── HERO CARD ───────────────────────────────────────── */}
        <FadeIn style={s.heroWrap}>
          <View style={s.hero}>
            <LinearGradient
              colors={Gradients.ink}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {/* cyan glow accent */}
            <View style={s.heroGlow} />
            <View style={s.heroEyebrowRow}>
              <View style={s.heroEyebrowDot} />
              <Text style={s.heroEyebrow}>DOORSTEP PC &amp; MAC REPAIR · MUMBAI</Text>
            </View>
            <Text style={s.heroHeadline}>We fix your PC.{'\n'}Without you leaving home.</Text>
            <Text style={s.heroSub}>
              Book in 60 seconds. We pick up, diagnose, and return your device — repaired, tested and under warranty.
            </Text>

            <PressableScale style={s.heroCtaWrap} onPress={() => startBooking()}>
              <LinearGradient
                colors={Gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[s.heroCta, Shadow.brand]}
              >
                <Text style={s.heroCtaTxt}>Book a repair</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.brandDeep} />
              </LinearGradient>
            </PressableScale>

            <View style={s.trustStrip}>
              {['Free pickup', 'Same-day slots', 'Pay after quote'].map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 && <View style={s.trustDivider} />}
                  <View style={s.trustItem}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.brandBright} />
                    <Text style={s.trustTxt}>{t}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        </FadeIn>

        {/* ─── TRUST METRICS ───────────────────────────────────── */}
        <FadeIn delay={80} style={s.metricsRow}>
          {TRUST_METRICS.map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 && <View style={s.metricDivider} />}
              <View style={s.metric}>
                <View style={s.metricValRow}>
                  <Ionicons name={m.icon} size={14} color={Colors.accentInk} />
                  <Text style={s.metricVal}>{m.value}</Text>
                </View>
                <Text style={s.metricLbl}>{m.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </FadeIn>

        {/* ─── ACTIVE REPAIRS ──────────────────────────────────── */}
        {active.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>Your repairs</Text>
              <View style={s.liveBadge}>
                <View style={s.liveDot} />
                <Text style={s.liveTxt}>Live</Text>
              </View>
            </View>
            {active.map(sr => (
              <RepairCard
                key={sr.id}
                sr={sr}
                onPress={() => navigation.navigate('RequestDetail', { id: sr.id })}
              />
            ))}
          </View>
        )}

        {/* ─── WHAT WE FIX ─────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>What we fix</Text>
          <Text style={s.sectionSub}>Tap a service to start your booking.</Text>
          <View style={s.serviceGrid}>
            {SERVICE_CATEGORIES.map(svc => (
              <PressableScale
                key={svc.id}
                style={s.serviceCard}
                onPress={() => startBooking(svc.id)}
              >
                <View style={s.serviceIconBox}>
                  <Ionicons name={svc.icon} size={24} color={Colors.brandNavy} />
                  {svc.popular && <View style={s.popDot} />}
                </View>
                <Text style={s.serviceLabel} numberOfLines={2}>{svc.short}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* ─── WHY VFIXURPC ────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Why VfixurPC</Text>
          <View style={s.whyCard}>
            {WHY.map((w, i) => (
              <View key={w.title} style={[s.whyRow, i < WHY.length - 1 && s.whyRowBorder]}>
                <View style={s.whyIconBox}>
                  <Ionicons name={w.icon} size={20} color={Colors.accentInk} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.whyTitle}>{w.title}</Text>
                  <Text style={s.whySub}>{w.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ─── HOW IT WORKS ────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>How it works</Text>
          <View style={s.stepsCard}>
            {STEPS.map((step, i) => (
              <View key={step.title} style={s.stepRow}>
                <View style={s.stepLeft}>
                  <View style={s.stepIconBox}>
                    <Ionicons name={step.icon} size={18} color={Colors.brandNavy} />
                  </View>
                  {i < STEPS.length - 1 && <View style={s.stepConnector} />}
                </View>
                <View style={{ flex: 1, paddingBottom: i < STEPS.length - 1 ? 22 : 0 }}>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepSub}>{step.sub}</Text>
                </View>
                <Text style={s.stepNum}>0{i + 1}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ─── BOTTOM CTA ──────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.bottomCta}>
            <LinearGradient
              colors={Gradients.inkSoft}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.bottomCtaTitle}>Ready to fix it?</Text>
              <Text style={s.bottomCtaSub}>Pickup slots available today</Text>
            </View>
            <PressableScale onPress={() => startBooking()}>
              <LinearGradient
                colors={Gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.bottomCtaBtn}
              >
                <Text style={s.bottomCtaBtnTxt}>Book now</Text>
              </LinearGradient>
            </PressableScale>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerTxt}>VfixurPC · GSTIN 27FXQPB4377D1Z8</Text>
          <Text style={s.footerTxt}>contact@vfixurpc.com</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function tod() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

const CARD_W = (W - Spacing.md * 2 - 12 * 3) / 4;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },

  // Top bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: 16,
  },
  greeting: { fontSize: 14, color: Colors.inkTertiary, fontWeight: '600' },
  name:     { fontSize: 27, fontWeight: '800', color: Colors.ink, letterSpacing: -0.7, marginTop: 1 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.brandSoft, borderRadius: 20,
    paddingHorizontal: 13, paddingVertical: 8,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accentInk },
  activeTxt: { fontSize: 12, color: Colors.accentInk, fontWeight: '800' },

  // Hero card
  heroWrap: { paddingHorizontal: Spacing.md },
  hero: {
    borderRadius: Radius.xxl,
    padding: 24,
    overflow: 'hidden',
    ...Shadow.ink,
  },
  heroGlow: {
    position: 'absolute', top: -70, right: -50,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(30,136,229,0.20)',
  },
  heroEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  heroEyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brandBright },
  heroEyebrow: { fontSize: 10.5, fontWeight: '800', color: Colors.brandBright, letterSpacing: 1 },
  heroHeadline: { fontSize: 28, fontWeight: '800', color: '#fff', lineHeight: 34, letterSpacing: -0.7, marginBottom: 10 },
  heroSub:      { fontSize: 13.5, color: Colors.onDarkDim, lineHeight: 20, marginBottom: 22 },
  heroCtaWrap:  { marginBottom: 20 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderRadius: Radius.md, paddingVertical: 16,
  },
  heroCtaTxt:   { fontSize: 16, fontWeight: '800', color: Colors.brandDeep, letterSpacing: -0.2 },
  trustStrip:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trustItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustDivider: { width: 1, height: 13, backgroundColor: 'rgba(255,255,255,0.14)' },
  trustTxt:     { fontSize: 11.5, color: 'rgba(255,255,255,0.72)', fontWeight: '700' },

  // Trust metrics
  metricsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.md, marginTop: 14,
    backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg,
    paddingVertical: 16,
    borderWidth: 1, borderColor: Colors.line,
  },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricValRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricVal: { fontSize: 17, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  metricLbl: { fontSize: 11, color: Colors.inkTertiary, fontWeight: '600' },
  metricDivider: { width: 1, height: 30, backgroundColor: Colors.line },

  // Sections
  section:      { paddingHorizontal: Spacing.md, paddingTop: 32 },
  sectionHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: Colors.ink, letterSpacing: -0.5, marginBottom: 4 },
  sectionSub:   { fontSize: 13.5, color: Colors.inkTertiary, marginBottom: 16 },
  liveBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.successLight, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 4 },
  liveDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveTxt:      { fontSize: 11, fontWeight: '800', color: '#157A37' },

  // Repair cards
  repairCard:   { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.md, marginTop: 14, borderWidth: 1, borderColor: Colors.line, ...Shadow.xs },
  urgentStrip:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.warningLight, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12, alignSelf: 'flex-start' },
  urgentTxt:    { fontSize: 11, fontWeight: '800', color: '#9A5B00' },
  repairRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  repairNum:    { fontSize: 11, fontWeight: '800', color: Colors.accentInk, letterSpacing: 0.3 },
  repairDevice: { fontSize: 16, fontWeight: '800', color: Colors.ink, marginTop: 3, letterSpacing: -0.2 },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack:{ flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surfaceStrong, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressTxt:  { fontSize: 11, color: Colors.inkTertiary, fontWeight: '700' },
  repairFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.line },
  repairDate:   { fontSize: 12, color: Colors.inkTertiary, fontWeight: '500' },
  repairLink:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  repairLinkTxt:{ fontSize: 13, fontWeight: '800', color: Colors.accentInk },

  // Services
  serviceGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceCard:  { width: CARD_W, alignItems: 'center', gap: 8 },
  serviceIconBox:{
    width: CARD_W, height: CARD_W, borderRadius: Radius.lg,
    backgroundColor: Colors.bgGrouped, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.line,
  },
  popDot: { position: 'absolute', top: 9, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.accent },
  serviceLabel: { fontSize: 11, fontWeight: '700', color: Colors.inkSecondary, textAlign: 'center', lineHeight: 14 },

  // Why
  whyCard:  { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: 4, borderWidth: 1, borderColor: Colors.line },
  whyRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  whyRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.line },
  whyIconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  whyTitle: { fontSize: 15, fontWeight: '800', color: Colors.ink, letterSpacing: -0.2 },
  whySub:   { fontSize: 12.5, color: Colors.inkTertiary, marginTop: 3, lineHeight: 18 },

  // How it works
  stepsCard:    { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.line },
  stepRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepLeft:     { alignItems: 'center', width: 40 },
  stepIconBox:  { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...Shadow.xs },
  stepConnector:{ width: 2, flex: 1, minHeight: 18, backgroundColor: Colors.lineStrong, marginTop: 4 },
  stepTitle:    { fontSize: 15, fontWeight: '800', color: Colors.ink, letterSpacing: -0.2, marginTop: 9 },
  stepSub:      { fontSize: 12.5, color: Colors.inkTertiary, marginTop: 2, lineHeight: 17 },
  stepNum:      { fontSize: 14, fontWeight: '800', color: Colors.gray300, marginTop: 11 },

  // Bottom CTA
  bottomCta:    { borderRadius: Radius.xl, padding: 22, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...Shadow.md },
  bottomCtaTitle:{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  bottomCtaSub: { fontSize: 13, color: Colors.onDarkDim, marginTop: 3 },
  bottomCtaBtn: { borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 14 },
  bottomCtaBtnTxt:{ color: Colors.brandDeep, fontWeight: '800', fontSize: 14, letterSpacing: -0.2 },

  // Footer
  footer:       { alignItems: 'center', gap: 4, paddingTop: 32 },
  footerTxt:    { fontSize: 11, color: Colors.gray400, fontWeight: '500' },
});
