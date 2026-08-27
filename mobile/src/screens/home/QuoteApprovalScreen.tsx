import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar, Alert } from 'react-native';
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

type Props = {
  navigation: NativeStackNavigationProp<HomeStackParamList, 'QuoteApproval'>;
  route: { params: { srId: string } };
};

export default function QuoteApprovalScreen({ navigation, route }: Props) {
  const { srId } = route.params;
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: sr, isLoading } = useQuery<ServiceRequest>({
    queryKey: ['sr', srId],
    queryFn: () => srApi.get(srId),
  });

  const approve = useMutation({
    mutationFn: () => srApi.approveQuote(srId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['sr', srId] });
      Toast.show({ type: 'success', text1: 'Quote Approved!', text2: 'Repair will begin shortly.' });
      navigation.goBack();
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Failed to approve', text2: getApiErrorMessage(e) }),
  });

  const reject = useMutation({
    mutationFn: () => srApi.rejectQuote(srId, 'Customer rejected quote via app'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: ['sr', srId] });
      Toast.show({ type: 'info', text1: 'Quote Rejected', text2: 'A ₹500 diagnosis fee applies.' });
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
    Alert.alert(
      'Reject Quote',
      'Are you sure? A diagnosis fee of ₹500 (incl. GST) will be charged if you reject the quote.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => reject.mutate() },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const busy = approve.isPending || reject.isPending;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader
        title="Repair quote"
        subtitle={sr?.serviceRequestNumber ?? sr?.ticketNumber}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.quoteCard}>
          <Text style={styles.sectionTitle}>Itemised quote</Text>
          {sr?.quoteItems?.length === 0 && (
            <Text style={styles.noItems}>Quote items not yet added.</Text>
          )}
          {sr?.quoteItems?.map((qi) => (
            <View key={qi.id} style={styles.quoteRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.quoteDesc}>{qi.description}</Text>
                <Text style={styles.quoteQty}>Qty: {qi.quantity}</Text>
              </View>
              <Text style={styles.quoteAmt}>₹{Number(qi.totalPrice ?? 0).toFixed(2)}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLbl}>Grand total</Text>
              <Text style={styles.gstNote}>Inclusive of 18% GST</Text>
            </View>
            <Text style={styles.totalAmt}>₹{sr?.quotedTotal != null ? Number(sr.quotedTotal).toFixed(2) : '—'}</Text>
          </View>
        </View>

        <View style={styles.feeNote}>
          <Ionicons name="information-circle" size={18} color={Colors.warning} style={{ marginTop: 1 }} />
          <Text style={styles.feeTxt}>
            If you reject this quote, a diagnosis fee of ₹500 (incl. GST) applies.
          </Text>
        </View>

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
            : (<><Ionicons name="checkmark-circle" size={19} color={Colors.white} /><Text style={styles.approveTxt}>Approve & proceed</Text></>)}
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} disabled={busy} activeOpacity={0.85}>
          {reject.isPending
            ? <ActivityIndicator color={Colors.error} />
            : <Text style={styles.rejectTxt}>Reject quote</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bgApp },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgApp },

  scroll:      { padding: Spacing.md, paddingBottom: 24 },

  quoteCard:   { backgroundColor: Colors.bgGrouped, borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle:{ fontSize: 13, fontWeight: '800', color: Colors.inkSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  noItems:     { color: Colors.inkTertiary, fontSize: 13, textAlign: 'center', paddingVertical: Spacing.md },
  quoteRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.line },
  quoteDesc:   { fontSize: 14, color: Colors.ink, fontWeight: '600' },
  quoteQty:    { fontSize: 11, color: Colors.inkTertiary, marginTop: 2 },
  quoteAmt:    { fontSize: 14, fontWeight: '800', color: Colors.ink },
  divider:     { height: 1, backgroundColor: Colors.lineStrong, marginVertical: Spacing.sm },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLbl:    { fontSize: 15, fontWeight: '800', color: Colors.ink },
  gstNote:     { fontSize: 11, color: Colors.inkTertiary, marginTop: 2 },
  totalAmt:    { fontSize: 27, fontWeight: '900', color: Colors.brandNavy },

  feeNote:     { flexDirection: 'row', gap: 10, backgroundColor: Colors.warningLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  feeTxt:      { flex: 1, fontSize: 12.5, color: '#9A5B00', lineHeight: 18 },

  deviceCard:  { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  deviceLbl:   { fontSize: 11, fontWeight: '700', color: Colors.inkTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  deviceVal:   { fontSize: 16, fontWeight: '700', color: Colors.ink, marginTop: 3 },
  issuePills:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pill:        { backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 6, borderRadius: Radius.full },
  pillTxt:     { fontSize: 11.5, fontWeight: '600', color: Colors.inkSecondary },

  actions:     { gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.line, backgroundColor: Colors.bgApp },
  approveBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: Radius.md, backgroundColor: Colors.success, padding: 16, ...Shadow.sm },
  approveTxt:  { fontSize: 16, fontWeight: '800', color: Colors.white },
  rejectBtn:   { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.lineStrong, padding: 15, alignItems: 'center', borderRadius: Radius.md },
  rejectTxt:   { fontSize: 15, fontWeight: '700', color: Colors.error },
});
