import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar, Alert, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { srApi, getApiErrorMessage } from '@/api/client';
import LargeHeader from '@/components/LargeHeader';
import { Colors, Spacing, Radius, Shadow } from '@/theme';
import { formatDeviceName } from '@/catalog/services';
import type { ServiceRequest } from '@/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164, supportWhatsAppUrl } from '@/config/contact';
import { findServiceAreaLocality } from '@/config/serviceArea';

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'QuoteApproval'>;
  route: { params: { srId: string } };
};

export default function QuoteApprovalScreen({ navigation, route }: Props) {
  const { srId } = route.params;
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [returnChoiceOpen, setReturnChoiceOpen] = React.useState(false);
  const [returnAddress, setReturnAddress] = React.useState('');
  const returnLocality = findServiceAreaLocality(returnAddress);
  const returnAreaChecked = returnAddress.trim().length >= 8;

  const { data: sr, isLoading, isError, refetch } = useQuery<ServiceRequest>({
    queryKey: ['sr', srId],
    queryFn: () => srApi.get(srId),
  });

  const approve = useMutation({
    mutationFn: () => srApi.approveQuote(srId, sr?.quoteVersion),
    onSuccess: (updated) => {
      setReturnChoiceOpen(false);
      qc.setQueryData(['sr', srId], updated);
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['sr', srId] });
      Toast.show({ type: 'success', text1: 'Quotation Approved', text2: 'We will update you when work starts.' });
      navigation.goBack();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Failed to approve', text2: getApiErrorMessage(e) }),
  });

  const reject = useMutation({
    mutationFn: (returnMethod: 'ORIGINAL_DELIVERY' | 'CUSTOMER_COLLECTION' | 'PAID_RETURN_DELIVERY') => srApi.rejectQuote(srId, 'Customer requested return via app', sr?.quoteVersion, returnMethod, returnMethod === 'PAID_RETURN_DELIVERY' ? returnAddress.trim() : undefined),
    onSuccess: (updated) => {
      setReturnChoiceOpen(false);
      qc.setQueryData(['sr', srId], updated);
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['sr', srId] });
      Toast.show({ type: 'info', text1: 'Return requested', text2: 'Our team will contact you about returning your device.' });
      navigation.goBack();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Failed to reject', text2: getApiErrorMessage(e) }),
  });

  function handleApprove() {
    Alert.alert('Approve Quote', `Confirm approval for ₹${sr?.quotedTotal?.toFixed(2)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approve.mutate() },
    ]);
  }

  function handleReject() {
    if (sr?.serviceMode === 'CARRY_IN') {
      setReturnChoiceOpen(true);
      return;
    }
    Alert.alert(
      'Reject Quote',
      sr?.booking?.feePolicyVersion === '2026-09-14'
        ? 'Reject this quotation? The diagnosis fee is ₹500 + ₹90 GST = ₹590 for this device request, as accepted at booking. Any booking pickup/delivery fee is separate and charged only once.'
        : 'Request a return without this repair? Only previously disclosed diagnosis or visit charges may apply.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reject.mutate('ORIGINAL_DELIVERY') },
      ],
    );
  }

  function discuss() {
    const ticket = sr?.serviceRequestNumber ?? sr?.ticketNumber ?? srId;
    void Linking.openURL(supportWhatsAppUrl('I would like to discuss quotation ' + ticket));
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const busy = approve.isPending || reject.isPending || approve.isSuccess || reject.isSuccess || !!sr?.quoteApproved || sr?.status !== 'QUOTATION_SHARED' || !!sr?.quoteRejectedReason || !sr?.quoteItems?.length;
  const subtotal = (sr?.quoteItems ?? []).reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const taxes = (sr?.quoteItems ?? []).reduce<Record<string, number>>((totals, item) => {
    const rate = String(item.taxRate ?? 18);
    totals[rate] = (totals[rate] ?? 0) + Number(item.totalPrice || 0) * Number(rate) / 100;
    return totals;
  }, {});

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader
        title="Repair quote"
        subtitle={sr?.serviceRequestNumber ?? sr?.ticketNumber}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isError && <TouchableOpacity onPress={() => refetch()}><Text>Could not load your quotation. Tap to retry.</Text></TouchableOpacity>}
        {sr?.quoteApproved && <Text style={styles.quoteDesc}>Quotation Approved</Text>}

        <Text style={styles.reassurance}>No chargeable repair starts without your approval.</Text>

        <View style={styles.deviceHero}>
          <View style={styles.deviceHeroIcon}><Ionicons name="laptop-outline" size={34} color={Colors.accent} /></View>
          <View style={{ flex: 1 }}><Text style={styles.deviceHeroName}>{formatDeviceName(sr?.device)}</Text>{sr?.device?.serialNumber ? <Text style={styles.deviceHeroSerial}>Serial: {sr.device.serialNumber}</Text> : null}<View style={styles.heroChips}><Text style={styles.ticketChip}>{sr?.serviceRequestNumber ?? sr?.ticketNumber}</Text><Text style={styles.statusChip}>Diagnosed</Text></View></View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}><Ionicons name="search" size={23} color={Colors.accent} /></View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Diagnosis summary</Text><Text style={styles.cardBody}>{sr?.statusHistory?.find(item => item.toStatus === 'DIAGNOSED')?.notes || sr?.issues?.map(issue => issue.category).join(', ') || 'Our team has inspected the device and prepared this quotation.'}</Text></View>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: '#F1ECFF' }]}><Ionicons name="build-outline" size={23} color="#7047D7" /></View>
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Recommended work</Text><Text style={styles.cardBody}>{sr?.quoteItems?.map(item => item.itemName || item.description).join(', ') || 'Recommended repair details will appear here.'}</Text></View>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.sectionTitle}>Quotation breakdown</Text>
          {sr?.quoteItems?.length === 0 && (
            <Text style={styles.noItems}>Quote items not yet added.</Text>
          )}
          {sr?.quoteItems?.map((qi) => (
            <View key={qi.id} style={styles.quoteRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flex: 1 }}><Text style={styles.quoteDesc}>{qi.itemName || qi.description}</Text>{qi.itemName && qi.description && qi.itemName !== qi.description ? <Text style={styles.quoteDetail}>{qi.description}</Text> : null}{qi.hsnSac ? <Text style={styles.quoteMeta}>HSN/SAC {qi.hsnSac} · {qi.quantity} {qi.unit || 'PC'}</Text> : null}</View>
                <Text style={styles.quoteQty}>Qty: {qi.quantity}</Text>
              </View>
              <Text style={styles.quoteAmt}>₹{Number(qi.totalPrice ?? 0).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.quoteRow}><Text style={styles.quoteDesc}>Subtotal</Text><Text style={styles.quoteAmt}>₹{subtotal.toFixed(2)}</Text></View>
          {Object.entries(taxes).map(([rate, amount]) => <View key={rate} style={styles.quoteRow}><Text style={styles.quoteDesc}>GST ({rate}%)</Text><Text style={styles.quoteAmt}>₹{amount.toFixed(2)}</Text></View>)}

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLbl}>Grand total</Text>
              <Text style={styles.gstNote}>Including GST shown above</Text>
            </View>
            <Text style={styles.totalAmt}>₹{sr?.quotedTotal != null ? Number(sr.quotedTotal).toFixed(2) : '—'}</Text>
          </View>
        </View>

        <View style={styles.feeNote}>
          <Ionicons name="information-circle" size={18} color={Colors.warning} style={{ marginTop: 1 }} />
          <Text style={styles.feeTxt}>
            {sr?.booking?.feePolicyVersion === '2026-09-14' ? 'Diagnosis fee if this quotation is rejected: ₹500 + ₹90 GST = ₹590. Pickup & delivery, if selected, is ₹590 once for the whole booking, not for each device.' : 'Only previously disclosed diagnosis, pickup or visit charges may apply if you request a return.'}
          </Text>
        </View>

        <View style={styles.estimate}><View style={styles.estimateIcon}><Ionicons name="time-outline" size={22} color={Colors.accent} /></View><View style={{ flex: 1 }}><Text style={styles.estimateLabel}>Estimated completion after approval</Text><Text style={styles.estimateValue}>Confirmed by the workshop after approval</Text></View></View>

        <View style={styles.deviceCard}>
          <Text style={styles.deviceLbl}>Device</Text>
          <Text style={styles.deviceVal}>{formatDeviceName(sr?.device)}</Text>
          <Text style={[styles.deviceLbl, { marginTop: 14 }]}>Reported issues</Text>
          <View style={styles.issuePills}>
            {sr?.issues?.map((iss) => (
              <View key={iss.id} style={styles.pill}>
                <Text style={styles.pillTxt}>{iss.category}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky actions */}
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.approveBtn} onPress={handleApprove} disabled={busy} activeOpacity={0.88}>
          {approve.isPending
            ? <ActivityIndicator color={Colors.white} />
            : (<><Ionicons name="checkmark-circle" size={19} color={Colors.white} /><Text style={styles.approveTxt}>Approve quote</Text></>)}
        </TouchableOpacity>
        <TouchableOpacity style={styles.discussBtn} onPress={discuss} activeOpacity={0.85}><Ionicons name="chatbubble-outline" size={18} color={Colors.accent} /><Text style={styles.discussTxt}>Discuss</Text></TouchableOpacity>
        <TouchableOpacity style={styles.declineBtn} onPress={handleReject} disabled={busy} activeOpacity={0.85}>
          {reject.isPending
            ? <ActivityIndicator color={Colors.error} />
            : <Text style={styles.rejectTxt}>Decline</Text>}
        </TouchableOpacity>
      </View>
      <Modal visible={returnChoiceOpen} transparent animationType="slide" onRequestClose={() => setReturnChoiceOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <View style={[styles.returnSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>How should we return your device?</Text>
            <Text style={styles.sheetCopy}>The diagnosis fee is ₹500 + ₹90 GST. Choose collection or delivery separately.</Text>
            <TouchableOpacity style={styles.returnOption} onPress={() => reject.mutate('CUSTOMER_COLLECTION')} disabled={reject.isPending}>
              <Ionicons name="business-outline" size={22} color={Colors.accent} />
              <View style={{ flex: 1 }}><Text style={styles.returnTitle}>Collect from workshop</Text><Text style={styles.returnMeta}>Free · We will notify you when it is ready</Text></View>
            </TouchableOpacity>
            <View style={styles.deliveryBox}>
              <View style={styles.deliveryHead}><Ionicons name="car-outline" size={22} color={Colors.accent} /><View style={{ flex: 1 }}><Text style={styles.returnTitle}>Return delivery</Text><Text style={styles.returnMeta}>₹500 + ₹90 GST = ₹590</Text></View></View>
              <TextInput value={returnAddress} onChangeText={setReturnAddress} multiline placeholder="Enter complete delivery address" placeholderTextColor={Colors.inkTertiary} style={styles.addressInput} />
              {returnLocality ? <View style={styles.deliveryEligible}><Ionicons name="checkmark-circle" size={18} color={Colors.success} /><Text style={styles.deliveryEligibleText}>Delivery available in {returnLocality}</Text></View> : returnAreaChecked ? <View style={styles.deliveryUnavailable}><Text style={styles.deliveryUnavailableTitle}>Delivery is unavailable at this address</Text><Text style={styles.deliveryUnavailableCopy}>Choose free workshop collection, or contact our team for help.</Text><View style={styles.deliveryContactRow}><TouchableOpacity onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE_E164}`)}><Text style={styles.deliveryContactLink}>Call {SUPPORT_PHONE_DISPLAY}</Text></TouchableOpacity><TouchableOpacity onPress={() => Linking.openURL(supportWhatsAppUrl('I need help with return delivery availability.'))}><Text style={styles.deliveryContactLink}>WhatsApp</Text></TouchableOpacity></View></View> : <Text style={styles.deliveryAreaHint}>Available only in listed Mumbai service areas.</Text>}
              <TouchableOpacity style={[styles.deliveryButton, (!returnLocality || reject.isPending) && { opacity: .45 }]} disabled={!returnLocality || reject.isPending} onPress={() => reject.mutate('PAID_RETURN_DELIVERY')}><Text style={styles.deliveryButtonText}>Confirm paid delivery</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelSheet} onPress={() => setReturnChoiceOpen(false)} disabled={reject.isPending}><Text style={styles.cancelSheetText}>Keep reviewing quote</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bgApp },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },

  scroll:      { padding: Spacing.md, paddingBottom: 24 },
  reassurance: { color: Colors.inkSecondary, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  deviceHero: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 14, marginBottom: 12 },
  deviceHeroIcon: { width: 74, height: 68, borderRadius: 8, backgroundColor: Colors.brandSofter, alignItems: 'center', justifyContent: 'center' },
  deviceHeroName: { color: Colors.ink, fontSize: 18, fontWeight: '800' }, deviceHeroSerial: { color: Colors.inkSecondary, fontSize: 12, marginTop: 3 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }, ticketChip: { color: Colors.accentInk, backgroundColor: Colors.brandSoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700' }, statusChip: { color: '#765900', backgroundColor: Colors.warningLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  summaryCard: { flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 15, marginBottom: 12 },
  summaryIcon: { width: 42, height: 42, borderRadius: 8, backgroundColor: Colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  cardBody: { color: Colors.inkSecondary, fontSize: 13, lineHeight: 19 },

  quoteCard:   { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle:{ fontSize: 13, fontWeight: '800', color: Colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  noItems:     { color: Colors.inkTertiary, fontSize: 13, textAlign: 'center', paddingVertical: Spacing.md },
  quoteRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.line },
  quoteDesc:   { fontSize: 14, color: Colors.ink, fontWeight: '600' },
  quoteDetail: { fontSize: 12.5, lineHeight: 18, color: Colors.inkSecondary, marginTop: 2 },
  quoteMeta: { fontSize: 11.5, color: Colors.inkTertiary, marginTop: 3 },
  quoteQty:    { fontSize: 11, color: Colors.inkTertiary, marginTop: 2 },
  quoteAmt:    { fontSize: 14, fontWeight: '800', color: Colors.ink },
  divider:     { height: 1, backgroundColor: Colors.lineStrong, marginVertical: Spacing.sm },
  totalRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLbl:    { fontSize: 15, fontWeight: '800', color: Colors.ink },
  gstNote:     { fontSize: 11, color: Colors.inkTertiary, marginTop: 2 },
  totalAmt:    { fontSize: 27, fontWeight: '900', color: Colors.brandNavy },

  feeNote:     { flexDirection: 'row', gap: 10, backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  feeTxt:      { flex: 1, fontSize: 12.5, color: '#9A5B00', lineHeight: 18 },
  estimate: { flexDirection: 'row', gap: 11, alignItems: 'center', backgroundColor: Colors.brandSoft, borderRadius: 8, padding: 13, marginBottom: 12 }, estimateIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D7E7FF', alignItems: 'center', justifyContent: 'center' }, estimateLabel: { color: Colors.ink, fontSize: 12, fontWeight: '800' }, estimateValue: { color: Colors.inkSecondary, fontSize: 11, marginTop: 3 },

  deviceCard:  { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  deviceLbl:   { fontSize: 11, fontWeight: '700', color: Colors.inkTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  deviceVal:   { fontSize: 16, fontWeight: '700', color: Colors.ink, marginTop: 3 },
  issuePills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill:        { backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 6, borderRadius: Radius.full },
  pillTxt:     { fontSize: 11.5, fontWeight: '600', color: Colors.inkSecondary },

  actions:     { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.line, backgroundColor: Colors.white },
  approveBtn:  { flex: 1.45, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8, backgroundColor: Colors.accent, paddingHorizontal: 10, ...Shadow.sm },
  approveTxt:  { fontSize: 16, fontWeight: '800', color: Colors.white },
  discussBtn: { flex: 1, minHeight: 48, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.accent, borderRadius: 8 },
  discussTxt: { color: Colors.accent, fontWeight: '800' },
  declineBtn: { flex: .75, minHeight: 48, justifyContent: 'center', backgroundColor: Colors.white, paddingHorizontal: 6, alignItems: 'center', borderRadius: 8 },
  rejectTxt:   { fontSize: 15, fontWeight: '700', color: Colors.error },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7, 18, 37, .45)' },
  returnSheet: { backgroundColor: Colors.white, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 14 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: Colors.lineStrong, alignSelf: 'center', marginBottom: 2 },
  sheetTitle: { color: Colors.ink, fontSize: 21, fontWeight: '900' },
  sheetCopy: { color: Colors.inkSecondary, fontSize: 13, lineHeight: 19 },
  returnOption: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 15 },
  returnTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  returnMeta: { color: Colors.inkSecondary, fontSize: 12, marginTop: 3 },
  deliveryBox: { borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 15, gap: 12 },
  deliveryHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  addressInput: { minHeight: 78, borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, padding: 12, color: Colors.ink, textAlignVertical: 'top', backgroundColor: Colors.bgApp },
  deliveryAreaHint: { color: Colors.inkSecondary, fontSize: 11.5, lineHeight: 17 },
  deliveryEligible: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.successLight, borderRadius: 8, padding: 10 },
  deliveryEligibleText: { flex: 1, color: Colors.success, fontSize: 12, fontWeight: '800' },
  deliveryUnavailable: { backgroundColor: Colors.warningLight, borderRadius: 8, padding: 11 },
  deliveryUnavailableTitle: { color: '#674900', fontSize: 12.5, fontWeight: '900' },
  deliveryUnavailableCopy: { color: '#795F22', fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  deliveryContactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  deliveryContactLink: { color: Colors.accentInk, fontSize: 12, fontWeight: '800' },
  deliveryButton: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent },
  deliveryButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  cancelSheet: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelSheetText: { color: Colors.inkSecondary, fontWeight: '700' },
});
