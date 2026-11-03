import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar, Linking } from 'react-native';
import TicketFiles from '@/components/TicketFiles';
import WarrantyPanel from '@/components/WarrantyPanel';
import GoogleReviewCard from '@/components/GoogleReviewCard';
import DeviceArtwork from '@/components/DeviceArtwork';
import { MODE_LABELS, getCategory, OFFICE_ADDRESS } from '@/catalog/services';
import RequestProgress from '@/components/RequestProgress';
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
import { formatDateOnly, formatDateTime, formatTimeSlot } from '@/utils/dateTime';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164, supportWhatsAppUrl } from '@/config/contact';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'RequestDetail'>;
  route: { params: { id: string } };
};

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
    return formatDateTime(item.createdAt);
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

  const { data: sr, isLoading, isError, refetch } = useQuery<ServiceRequest>({
    queryKey: ['sr', id],
    queryFn: () => srApi.get(id),
    refetchInterval: 30_000,
  });

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
        <Text style={{ color: Colors.inkTertiary }}>{isError ? 'Could not load this request' : 'Request not found'}</Text>
        <TouchableOpacity onPress={() => refetch()} style={{ padding: 16 }}><Text>Retry</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 16 }}><Text>Back</Text></TouchableOpacity>
      </View>
    );
  }

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
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Track request</Text>
        <Text style={styles.pageSubtitle}>Stay updated on your repair journey.</Text>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}><Text style={styles.heroTicket}>{sr.serviceRequestNumber ?? sr.ticketNumber}</Text><StatusBadge status={sr.status} /></View>
          <View style={styles.heroDevice}><DeviceArtwork category={sr.serviceCategory} size={82} /><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.deviceName} numberOfLines={2}>{formatDeviceName(sr.device)}</Text><Text style={styles.heroIssue} numberOfLines={2}>{sr.issues?.map(issue => issue.category).join(' · ') || 'Service request'}</Text></View></View>
        </View>
        {sr.quoteApproved && <View style={{backgroundColor:Colors.successLight,padding:16,borderRadius:8,marginBottom:16}}><Text style={{color:Colors.success,fontWeight:'700'}}>Quotation approved</Text></View>}
        {sr.quoteRejectedReason && <Text style={{color:Colors.error,marginBottom:16}}>Return requested. Our team will contact you.</Text>}
        {sr.status === 'QUOTATION_SHARED' && !sr.quoteApproved && !sr.quoteRejectedReason && (
          <TouchableOpacity
            style={styles.quoteCta}
            onPress={() => navigation.navigate('QuoteApproval', { srId: sr.id })}
            activeOpacity={0.9}
          >
            <View style={styles.quoteCtaIcon}>
              <Ionicons name="receipt-outline" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quoteCtaTitle}>Quote ready for review</Text>
              <Text style={styles.quoteCtaSub}>Tap to view and approve your repair quote</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Request summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}><View style={styles.summaryIcon}><Ionicons name="document-text-outline" size={19} color={Colors.accentInk} /></View><Text style={styles.summaryLabel}>Issue</Text><Text style={styles.summaryValue} numberOfLines={2}>{sr.issues?.[0]?.category || 'Service request'}</Text></View>
            <View style={styles.summaryRule} />
            <View style={styles.summaryItem}><View style={styles.summaryIcon}><Ionicons name="calendar-outline" size={19} color={Colors.accentInk} /></View><Text style={styles.summaryLabel}>Appointment</Text><Text style={styles.summaryValue}>{formatDateOnly(sr.pickupSlotDate ?? sr.pickupDate)}</Text></View>
            <View style={styles.summaryRule} />
            <View style={styles.summaryItem}><View style={styles.summaryIcon}><Ionicons name="car-outline" size={19} color={Colors.accentInk} /></View><Text style={styles.summaryLabel}>Service mode</Text><Text style={styles.summaryValue} numberOfLines={2}>{MODE_LABELS[sr.serviceMode ?? 'PICKUP']}</Text></View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Repair details</Text>
          {sr.booking && <InfoRow label="Pickup & delivery (whole booking)" value={sr.booking.transportBase ? `₹${sr.booking.transportBase} + ₹${sr.booking.transportTax} GST = ₹${sr.booking.transportBase + sr.booking.transportTax}, charged once` : 'Not applicable'} />}
          {sr.booking?.referralDiscountPercent === 10 && <InfoRow label="First-booking referral benefit" value="10% off repair quotation" />}
          {!!sr.rejectionFeeTotal && <InfoRow label="Diagnosis fee" value="₹500 + ₹90 GST = ₹590" />}
          {!!sr.returnDeliveryFeeTotal && <InfoRow label="Return delivery" value="₹500 + ₹90 GST = ₹590" />}
          <InfoRow label="Service" value={getCategory(sr.serviceCategory)?.label ?? sr.serviceCategory} />
          {sr.handoverMethod === 'CUSTOMER_COLLECTION' && <InfoRow label="Handover" value="Collected by customer" />}
          <InfoRow label="Service option" value={MODE_LABELS[sr.serviceMode??"PICKUP"]} />
          <InfoRow label={sr.serviceMode === 'CARRY_IN' ? 'Workshop location' : sr.serviceMode === 'ON_SITE' ? 'Visit location' : 'Pickup address'} value={sr.serviceMode === 'CARRY_IN' ? OFFICE_ADDRESS : ['CONSULTATION', 'REMOTE'].includes(sr.serviceMode ?? '') ? undefined : sr.pickupAddress} />
          <InfoRow label="Appointment date" value={formatDateOnly(sr.pickupSlotDate ?? sr.pickupDate)} />
          <InfoRow label="Time slot" value={formatTimeSlot(sr.pickupSlotTime)} last={!sr.issues?.length} />
          {Object.entries(sr.bookingAnswers ?? {}).filter(([key, value]) => !['dataRecoveryConsent', 'feePolicyAccepted'].includes(key) && String(value)).map(([key, value]) => <InfoRow key={key} label={key === 'requestedUpgrades' ? 'Requested upgrades' : getCategory(sr.serviceCategory)?.fields.find(field => field.id === key)?.label ?? key} value={Array.isArray(value) ? value.join(', ') : value} />)}
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
                <Text style={styles.quoteDesc} numberOfLines={2}>{qi.itemName || qi.description}</Text>
                <Text style={styles.quoteAmt}>₹{Number(qi.totalPrice ?? 0).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.quoteDivider} />
            <View style={styles.quoteRow}><Text style={styles.quoteDesc}>Subtotal</Text><Text style={styles.quoteAmt}>₹{sr.quoteItems.reduce((sum, qi) => sum + Number(qi.totalPrice), 0).toFixed(2)}</Text></View>
            <View style={styles.quoteRow}><Text style={styles.quoteDesc}>GST</Text><Text style={styles.quoteAmt}>₹{sr.quoteItems.reduce((sum, qi) => sum + Number(qi.totalPrice) * Number(qi.taxRate ?? 18) / 100, 0).toFixed(2)}</Text></View>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteTotal}>Total</Text>
              <Text style={styles.quoteTotalAmt}>₹{sr.quotedTotal != null ? Number(sr.quotedTotal).toFixed(2) : '—'}</Text>
            </View>
          </View>
        )}

        <RequestProgress request={sr} />
        {sr.relatedRequests && sr.relatedRequests.length > 1 && <View style={styles.card}><Text style={styles.sectionTitle}>Devices in this booking</Text>{sr.relatedRequests.map(r => <TouchableOpacity key={r.id} disabled={r.id === id} onPress={() => navigation.push('RequestDetail', { id: r.id })} style={{ paddingVertical: 14 }}><Text style={{ color: Colors.accentInk, fontWeight: '600' }}>{r.serviceRequestNumber} · {formatDeviceName(r.device)}</Text><Text>{r.id === id ? 'Current request' : STATUS_CONFIG[r.status]?.label ?? r.status}</Text></TouchableOpacity>)}</View>}
        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Status timeline</Text>
            {history.map((h, i) => (
              <TimelineItem key={h.id} item={h} isFirst={i === 0} isLast={i === history.length - 1} />
            ))}
          </View>
        )}
        <WarrantyPanel id={id} />
        {sr.status === 'DELIVERED' && <GoogleReviewCard />}
        <TicketFiles id={id} />
        <View style={styles.helpCard}>
          <View style={styles.helpHead}><Text style={styles.helpTitle}>Need help?</Text><Text style={styles.helpMeta}>Our team is here for you.</Text></View>
          <View style={styles.helpRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.helpAction} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE_E164}`)}><View style={styles.callIcon}><Ionicons name="call" size={20} color={Colors.accentInk} /></View><View style={{ flex: 1 }}><Text style={styles.helpActionTitle}>Call support</Text><Text style={styles.helpActionSub}>{SUPPORT_PHONE_DISPLAY}</Text></View></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.helpAction} onPress={() => Linking.openURL(supportWhatsAppUrl('Help with ticket ' + (sr.ticketNumber ?? sr.id)))}><View style={styles.whatsappIcon}><Ionicons name="logo-whatsapp" size={20} color="#fff" /></View><View style={{ flex: 1 }}><Text style={styles.helpActionTitle}>WhatsApp</Text><Text style={styles.helpActionSub}>Chat with our team</Text></View></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bgApp },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },

  header:    { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.line },
  backBtn:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface, marginBottom: Spacing.md },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  ticketNum: { fontSize: 12, fontWeight: '700', color: Colors.accentInk, letterSpacing: 0.4 },
  deviceName:{ fontSize: 18, lineHeight: 22, fontWeight: '900', color: Colors.white, letterSpacing: 0 },
  createdAt: { fontSize: 12, color: Colors.inkTertiary, marginTop: 4 },

  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack:{ flex: 1, height: 5, borderRadius: 3, backgroundColor: Colors.surfaceStrong },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  progressTxt:  { fontSize: 11, color: Colors.inkTertiary, fontWeight: '700', width: 36, textAlign: 'right' },

  scroll:      { padding: Spacing.md, paddingBottom: 60 },
  pageTitle: { color: Colors.ink, fontSize: 27, fontWeight: '800' },
  pageSubtitle: { color: Colors.inkSecondary, fontSize: 14, marginTop: 3, marginBottom: 16 },
  heroCard: { gap: 12, backgroundColor: Colors.brandNavy, borderRadius: 8, padding: 16, marginBottom: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroDevice: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTicket: { color: '#D2E1F4', fontWeight: '700', fontSize: 12, marginTop: 4 },
  heroIssue: { color: '#D2E1F4', fontSize: 12, lineHeight: 17, marginTop: 8 },

  quoteCta: {
    backgroundColor: Colors.accent, borderRadius: 8, padding: Spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md,
  },
  quoteCtaIcon:  { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(11,18,32,0.12)', alignItems: 'center', justifyContent: 'center' },
  quoteCtaTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  quoteCtaSub:   { fontSize: 12, color: '#fff', marginTop: 2 },

  card:         { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.md },
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

  summaryCard: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 14, marginBottom: 16 },
  summaryTitle: { color: Colors.ink, fontSize: 17, fontWeight: '900', marginBottom: 13 },
  summaryGrid: { flexDirection: 'row', alignItems: 'stretch' }, summaryItem: { flex: 1, minWidth: 0 }, summaryRule: { width: 1, backgroundColor: Colors.line, marginHorizontal: 8 },
  summaryIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  summaryLabel: { color: Colors.inkSecondary, fontSize: 9.5, fontWeight: '700' }, summaryValue: { color: Colors.ink, fontSize: 11, lineHeight: 15, fontWeight: '800', marginTop: 3 },
  helpCard: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 14, marginBottom: 16 },
  helpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }, helpTitle: { color: Colors.ink, fontSize: 17, fontWeight: '900' }, helpMeta: { color: Colors.inkSecondary, fontSize: 10.5 },
  helpRow: { flexDirection: 'row', gap: 9 }, helpAction: { flex: 1, minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bgApp, borderRadius: 8, padding: 10 },
  callIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' }, whatsappIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#20B95A', alignItems: 'center', justifyContent: 'center' },
  helpActionTitle: { color: Colors.ink, fontSize: 11.5, fontWeight: '800' }, helpActionSub: { color: Colors.inkSecondary, fontSize: 9.5, lineHeight: 13, marginTop: 2 },

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
