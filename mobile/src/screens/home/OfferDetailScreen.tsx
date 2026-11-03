import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { offersApi } from '@/api/client';
import { useBooking } from '@/context/BookingContext';
import LargeHeader from '@/components/LargeHeader';
import { Colors, Spacing } from '@/theme';
import type { Offer } from '@/types';

export default function OfferDetailScreen({ navigation, route }: any) {
  const booking = useBooking();
  const offer = useQuery<Offer>({ queryKey: ['offer', route.params.id], queryFn: () => offersApi.get(route.params.id) });
  const value = offer.data;
  const useOffer = () => {
    if (!value) return;
    booking.suggestDiscountCode(value.promoCode ?? undefined);
    navigation.getParent()?.navigate('BookTab', { screen: 'Step1Device', params: { preselectCategory: value.eligibleServiceCategories[0] } });
  };
  return <View style={s.root}>
    <LargeHeader title="Offer details" onBack={() => navigation.goBack()} />
    {offer.isLoading ? <ActivityIndicator style={{ marginTop: 40 }} /> : offer.isError || !value ? <View style={s.empty}><Text style={s.title}>This offer is unavailable</Text><Text style={s.body}>It may have expired or already been used.</Text></View> :
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.hero}><View style={s.icon}><Ionicons name="pricetag" size={27} color="#fff" /></View><Text style={s.kicker}>APP EXCLUSIVE</Text><Text style={s.heroTitle}>{value.title}</Text><Text style={s.heroBody}>{value.shortDescription}</Text></View>
        <View style={s.card}>
          <Text style={s.sectionTitle}>Offer summary</Text>
          {value.maximumDiscountCap > 0 && <Row label="Maximum benefit" value={`Up to ₹${value.maximumDiscountCap}`} />}
          {value.minimumBillingAmount > 0 && <Row label="Minimum repair bill" value={`₹${value.minimumBillingAmount}`} />}
          <Row label="Valid until" value={new Date(value.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          {!!value.promoCode && <Row label="Promo code" value={value.promoCode} />}
          <Row label="Uses remaining" value={String(value.remainingUses)} last />
        </View>
        <View style={s.note}><Ionicons name="information-circle-outline" size={21} color={Colors.accentInk} /><Text style={s.noteText}>Final eligibility is checked when you book. Discounts apply to eligible repair charges and are shown on the quotation. Free add-ons and consultations follow the terms above.</Text></View>
        <TouchableOpacity style={s.cta} onPress={useOffer}><Text style={s.ctaText}>{value.promoCode ? 'Use this code' : value.ctaLabel || 'Book Now'}</Text><Ionicons name="arrow-forward" size={21} color="#fff" /></TouchableOpacity>
      </ScrollView>}
  </View>;
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[s.row, last && { borderBottomWidth: 0 }]}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp }, content: { padding: Spacing.md, paddingBottom: 40, gap: 14 },
  hero: { backgroundColor: Colors.brandNavy, borderRadius: 8, padding: 20 }, icon: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  kicker: { color: '#AFC9E8', fontSize: 10, fontWeight: '900' }, heroTitle: { color: '#fff', fontSize: 26, lineHeight: 32, fontWeight: '900', marginTop: 5 }, heroBody: { color: '#D5E3F3', fontSize: 14, lineHeight: 21, marginTop: 9 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.line, borderRadius: 8, paddingHorizontal: 16 }, sectionTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800', paddingTop: 16, paddingBottom: 8 },
  row: { minHeight: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.line }, label: { color: Colors.inkSecondary, fontSize: 13, flex: 1 }, value: { color: Colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  note: { flexDirection: 'row', gap: 10, backgroundColor: '#EAF4FF', borderRadius: 8, padding: 14 }, noteText: { flex: 1, color: Colors.inkSecondary, fontSize: 12, lineHeight: 18 },
  cta: { minHeight: 56, borderRadius: 8, backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, ctaText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  empty: { padding: 28 }, title: { color: Colors.ink, fontSize: 22, fontWeight: '800' }, body: { color: Colors.inkSecondary, marginTop: 8 },
});
