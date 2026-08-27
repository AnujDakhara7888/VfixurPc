import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { srApi } from '@/api/client';
import StatusBadge from '@/components/StatusBadge';
import { Colors, Spacing, Radius } from '@/theme';
import { STATUS_CONFIG } from '@/theme';
import { formatDeviceName } from '@/catalog/services';
import type { ServiceRequest } from '@/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@/types';
import { format, parseISO } from 'date-fns';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'RequestDetail'>;
  route: { params: { id: string } };
};

const STATUS_ORDER = [
  'PICKUP_SCHEDULED','PICKED_UP','RECEIVED_AT_WORKSHOP','DIAGNOSED',
  'QUOTATION_SHARED','PAYMENT_RECEIVED','UNDER_REPAIR','REPAIR_COMPLETE',
  'OUT_FOR_DELIVERY','DELIVERED',
];

function InfoRow({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  if (!value) return null;
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function TimelineItem({ item, isFirst, isLast }: { item: any; isFirst: boolean; isLast: boolean }) {
  const cfg = STATUS_CONFIG[item.toStatus] ?? { dot: Colors.gray300, label: item.toStatus };
  const dateStr = (() => {
    try { return format(parseISO(item.createdAt), 'dd MMM yy · h:mm a'); } catch { return ''; }
  })();
  return (
    <View style={styles.tlItem}>
      <View style={styles.tlLeft}>
        <View style={[styles.tlDot, { backgroundColor: cfg.dot }, isFirst && styles.tlDotFirst]} />
        {!isLast && <View style={styles.tlLine} />}
      </View>
      <View style={styles.tlContent}>
        <Text style={styles.tlStatus}>{cfg.label}</Text>
        {item.notes ? <Text style={styles.tlNotes}>{item.notes}</Text> : null}
        <Text style={styles.tlDate}>{dateStr}</Text>
      </View>
    </View>
  );
}

export default function RequestDetailScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();

  const { data: sr, isLoading } = useQuery<ServiceRequest>({
    queryKey: ['sr', id],
    queryFn: () => srApi.get(id),
    refetchInterval: 30_000,
  });

  const currentStep = STATUS_ORDER.indexOf(sr?.status ?? '') + 1;

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }
  if (!sr) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.inkTertiary }}>Request not found</Text>
      </View>
    );
  }

  const dateStr = (() => {
    try { return format(parseISO(sr.createdAt), 'dd MMMM yyyy'); } catch { return ''; }
  })();
  const history = sr.statusHistory ? [...sr.statusHistory].reverse() : [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ticketNum}>{sr.serviceRequestNumber ?? sr.ticketNumber}</Text>
            <Text style={styles.deviceName} numberOfLines={1}>{formatDeviceName(sr.device)}</Text>
            <Text style={styles.createdAt}>Booked on {dateStr}</Text>
          </View>
          <StatusBadge status={sr.status} />
        </View>
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(currentStep / 10) * 100}%` as any }]} />
          </View>
          <Text style={styles.progressTxt}>{currentStep}/10</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {sr.status === 'QUOTATION_SHARED' && (
          <TouchableOpacity
            style={styles.quoteCta}
            onPress={() => navigation.navigate('QuoteApproval', { srId: sr.id })}
            activeOpacity={0.9}
          >
            <View style={styles.quoteCtaIcon}>
              <Ionicons name="receipt-outline" size={22} color={Colors.brandDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quoteCtaTitle}>Quote ready for review</Text>
              <Text style={styles.quoteCtaSub}>Tap to view and approve your repair quote</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.brandDeep} />
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Repair details</Text>
          <InfoRow label="Pickup address" value={sr.pickupAddress} />
          <InfoRow label="Pickup date" value={sr.pickupSlotDate ?? sr.pickupDate} />
          <InfoRow label="Time slot" value={sr.pickupSlotTime} last={!sr.issues?.length} />
          {sr.issues?.length > 0 && (
            <View style={styles.issuesWrap}>
              <Text style={styles.infoLabel}>Reported issues</Text>
              <View style={styles.issuePillRow}>
                {sr.issues.map((iss) => (
                  <View key={iss.id} style={styles.issuePill}>
                    <Text style={styles.issuePillTxt}>{iss.category}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {sr.quoteItems && sr.quoteItems.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Repair quote</Text>
            {sr.quoteItems.map((qi) => (
              <View key={qi.id} style={styles.quoteRow}>
                <Text style={styles.quoteDesc} numberOfLines={2}>{qi.description}</Text>
                <Text style={styles.quoteAmt}>₹{Number(qi.totalPrice ?? 0).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.quoteDivider} />
            <View style={styles.quoteRow}>
              <Text style={styles.quoteTotal}>Total</Text>
              <Text style={styles.quoteTotalAmt}>₹{sr.quotedTotal != null ? Number(sr.quotedTotal).toFixed(2) : '—'}</Text>
            </View>
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Status timeline</Text>
            {history.map((h, i) => (
              <TimelineItem key={h.id} item={h} isFirst={i === 0} isLast={i === history.length - 1} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bgApp },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },

  header:    { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, marginBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  ticketNum: { fontSize: 12, fontWeight: '700', color: Colors.accentInk, letterSpacing: 0.4 },
  deviceName:{ fontSize: 24, fontWeight: '800', color: Colors.ink, marginTop: 3, maxWidth: 240, letterSpacing: -0.5 },
  createdAt: { fontSize: 12, color: Colors.inkTertiary, marginTop: 4 },

  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack:{ flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.surfaceStrong },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  progressTxt:  { fontSize: 11, color: Colors.inkTertiary, fontWeight: '700', width: 36, textAlign: 'right' },

  scroll:      { padding: Spacing.md, paddingBottom: 60 },

  quoteCta: {
    backgroundColor: Colors.accent, borderRadius: Radius.lg, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md,
  },
  quoteCtaIcon:  { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(11,18,32,0.12)', alignItems: 'center', justifyContent: 'center' },
  quoteCtaTitle: { fontSize: 15, fontWeight: '800', color: Colors.brandDeep },
  quoteCtaSub:   { fontSize: 12, color: 'rgba(11,18,32,0.7)', marginTop: 2 },

  card:         { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: Colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },

  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.line },
  infoLabel: { fontSize: 13, color: Colors.inkSecondary, fontWeight: '500', flex: 0.4 },
  infoValue: { fontSize: 13.5, color: Colors.ink, fontWeight: '500', flex: 0.6, textAlign: 'right' },

  issuesWrap: { paddingTop: 12 },
  issuePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  issuePill:  { backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 6, borderRadius: Radius.full },
  issuePillTxt: { fontSize: 12, color: Colors.inkSecondary, fontWeight: '600' },

  quoteRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  quoteDesc:   { flex: 1, fontSize: 13.5, color: Colors.inkSecondary, marginRight: 8 },
  quoteAmt:    { fontSize: 13.5, fontWeight: '700', color: Colors.ink },
  quoteDivider:{ height: 1, backgroundColor: Colors.lineStrong, marginVertical: 4 },
  quoteTotal:  { fontSize: 14, fontWeight: '800', color: Colors.ink },
  quoteTotalAmt:{ fontSize: 16, fontWeight: '900', color: Colors.brandNavy },

  tlItem:    { flexDirection: 'row', minHeight: 56 },
  tlLeft:    { alignItems: 'center', marginRight: 14, width: 14 },
  tlDot:     { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.gray300, marginTop: 2 },
  tlDotFirst:{ backgroundColor: Colors.accent, width: 14, height: 14, borderRadius: 7 },
  tlLine:    { flex: 1, width: 2, backgroundColor: Colors.lineStrong, marginTop: 4 },
  tlContent: { flex: 1, paddingBottom: 16 },
  tlStatus:  { fontSize: 14, fontWeight: '700', color: Colors.ink },
  tlNotes:   { fontSize: 12.5, color: Colors.inkTertiary, marginTop: 2, lineHeight: 18 },
  tlDate:    { fontSize: 11, color: Colors.inkQuat, marginTop: 4 },
});
