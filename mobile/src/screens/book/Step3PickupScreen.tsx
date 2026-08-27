import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { slotsApi, srApi, getApiErrorMessage } from '@/api/client';
import Input from '@/components/Input';
import LargeHeader from '@/components/LargeHeader';
import BookingBar from '@/components/BookingBar';
import StepIndicator from './StepIndicator';
import { Colors, Spacing, Radius, Shadow } from '@/theme';
import { BOOKING_STEPS } from '@/catalog/services';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BookStackParamList, PickupSlot } from '@/types';
import Toast from 'react-native-toast-message';

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? 'YOUR_GOOGLE_PLACES_API_KEY';

type Props = {
  navigation: NativeStackNavigationProp<BookStackParamList, 'Step3Pickup'>;
  route: { params: {
    deviceId: string;
    categoryId: string;
    deviceName: string;
    issues: { category: string; description?: string }[];
    issueLabels: string[];
  }};
};

function getNext7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function groupSlots(slots: PickupSlot[]) {
  const am = slots.filter((s) => { const [h] = s.startTime.split(':').map(Number); return h < 12; });
  const pm = slots.filter((s) => { const [h] = s.startTime.split(':').map(Number); return h >= 12; });
  return { am, pm };
}

export default function Step3PickupScreen({ navigation, route }: Props) {
  const { deviceId, deviceName, issues, issueLabels } = route.params;
  const qc = useQueryClient();

  const [address, setAddress]   = useState('');
  const [selectedDate, setDate] = useState<Date | null>(null);
  const [selectedSlot, setSlot] = useState<PickupSlot | null>(null);
  const [notes, setNotes]       = useState('');
  const [ampm, setAmPm]         = useState<'am' | 'pm'>('am');

  const next7 = getNext7Days();

  const { data: slots = [], isLoading: slotsLoading } = useQuery<PickupSlot[]>({
    queryKey: ['pickup-slots'],
    queryFn: slotsApi.list,
  });

  const { am: amSlots, pm: pmSlots } = groupSlots(slots);
  const visibleSlots = ampm === 'am' ? amSlots : pmSlots;

  const createSR = useMutation({
    mutationFn: () => srApi.create({
      deviceId,
      issues,
      pickupSlotDate: selectedDate!.toISOString().split('T')[0],
      pickupSlotTime: selectedSlot!.label,
      pickupAddress:  address.trim(),
    }),
    onSuccess: (sr) => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      navigation.navigate('BookingSuccess', { ticketNumber: sr.serviceRequestNumber ?? sr.ticketNumber });
    },
    onError: (e) => Toast.show({ type: 'error', text1: 'Booking failed', text2: getApiErrorMessage(e) }),
  });

  function handleBook() {
    if (!address.trim()) { Toast.show({ type: 'error', text1: 'Enter your pickup address' }); return; }
    if (!selectedDate)   { Toast.show({ type: 'error', text1: 'Select a pickup date' }); return; }
    if (!selectedSlot)   { Toast.show({ type: 'error', text1: 'Select a time slot' }); return; }
    createSR.mutate();
  }

  const ready = !!address.trim() && !!selectedDate && !!selectedSlot;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader
        title="Schedule pickup"
        subtitle="Pick a doorstep slot that works for you."
        onBack={() => navigation.goBack()}
      />
      <StepIndicator current={2} total={3} labels={[...BOOKING_STEPS]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryHead}>
            <Ionicons name="cube-outline" size={16} color={Colors.brandNavy} />
            <Text style={styles.summaryDevice} numberOfLines={1}>{deviceName}</Text>
          </View>
          <View style={styles.pillRow}>
            {issueLabels.slice(0, 4).map((lbl) => (
              <View key={lbl} style={styles.pill}><Text style={styles.pillTxt}>{lbl}</Text></View>
            ))}
            {issueLabels.length > 4 && (
              <View style={styles.pill}><Text style={styles.pillTxt}>+{issueLabels.length - 4} more</Text></View>
            )}
          </View>
        </View>

        {/* Address */}
        <Text style={styles.label}>Pickup address</Text>
        <View style={styles.placesWrapper}>
          <GooglePlacesAutocomplete
            placeholder="Search building, street or area in Mumbai…"
            onPress={(data, details = null) => {
              const formatted = details?.formatted_address ?? data.description;
              setAddress(formatted);
            }}
            query={{
              key: PLACES_API_KEY, language: 'en', components: 'country:in',
              location: '19.0760,72.8777', radius: 50000, strictbounds: false,
            }}
            fetchDetails
            enablePoweredByContainer={false}
            minLength={2}
            debounce={300}
            textInputProps={{
              onChangeText: setAddress,
              placeholderTextColor: Colors.gray400, clearButtonMode: 'while-editing',
            }}
            styles={{
              container: placeSty.container, textInput: placeSty.input,
              listView: placeSty.list, row: placeSty.row, description: placeSty.description,
              poweredContainer: { display: 'none' }, separator: { height: 0 },
            }}
            renderRow={(data) => (
              <View style={placeSty.rowInner}>
                <Ionicons name="location-outline" size={17} color={Colors.accentInk} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={placeSty.mainText} numberOfLines={1}>{data.structured_formatting?.main_text ?? data.description}</Text>
                  {!!data.structured_formatting?.secondary_text && (
                    <Text style={placeSty.subText} numberOfLines={1}>{data.structured_formatting.secondary_text}</Text>
                  )}
                </View>
              </View>
            )}
          />
        </View>

        {address.length > 5 && (
          <View style={styles.addrChip}>
            <Ionicons name="location" size={15} color={Colors.accentInk} style={{ marginTop: 1 }} />
            <Text style={styles.addrChipTxt} numberOfLines={2}>{address}</Text>
            <TouchableOpacity onPress={() => setAddress('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={Colors.gray400} />
            </TouchableOpacity>
          </View>
        )}

        {/* Date */}
        <Text style={styles.label}>Pickup date</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.dateScroll}
          contentContainerStyle={{ paddingRight: Spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {next7.map((d, i) => {
            const isSel = selectedDate?.toDateString() === d.toDateString();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dateChip, isSel && styles.dateChipActive]}
                onPress={() => { setDate(d); setSlot(null); }}
                activeOpacity={0.88}
              >
                <Text style={[styles.dateDay, isSel && styles.dateTxtActive]}>{DAYS[d.getDay()]}</Text>
                <Text style={[styles.dateNum, isSel && styles.dateTxtActive]}>{d.getDate()}</Text>
                <Text style={[styles.dateMon, isSel && styles.dateTxtActive]}>{MONTHS[d.getMonth()]}</Text>
                {isWeekend && <View style={[styles.weekendDot, isSel && { backgroundColor: Colors.accent }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time slot */}
        {selectedDate && (
          <>
            <Text style={styles.label}>Time slot</Text>
            <View style={styles.ampmRow}>
              {(['am', 'pm'] as const).map((period) => {
                const isSel = ampm === period;
                return (
                  <TouchableOpacity
                    key={period}
                    style={[styles.ampmBtn, isSel && styles.ampmBtnActive]}
                    onPress={() => { setAmPm(period); setSlot(null); }}
                    activeOpacity={0.88}
                  >
                    <Ionicons
                      name={period === 'am' ? 'sunny-outline' : 'partly-sunny-outline'}
                      size={16}
                      color={isSel ? '#fff' : Colors.inkSecondary}
                    />
                    <Text style={[styles.ampmTxt, isSel && styles.ampmTxtActive]}>
                      {period === 'am' ? 'Morning' : 'Afternoon / Evening'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {slotsLoading ? (
              <ActivityIndicator color={Colors.accent} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.slotsGrid}>
                {visibleSlots.map((slot) => {
                  const isSel = selectedSlot?.id === slot.id;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotChip, isSel && styles.slotChipActive]}
                      onPress={() => setSlot(slot)}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.slotTxt, isSel && styles.slotTxtActive]}>{slot.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Notes */}
        <View style={{ marginTop: Spacing.sm }}>
          <Input
            label="Special instructions (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Gate code, building name, instructions for the agent…"
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Diagnosis fee notice */}
        <View style={styles.confirmBox}>
          <Ionicons name="information-circle" size={18} color={Colors.info} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.confirmTitle}>Diagnosis fee</Text>
            <Text style={styles.confirmText}>
              If you reject the repair quote after diagnosis, a ₹500 (incl. GST) diagnosis fee applies.
            </Text>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <BookingBar label="Confirm booking" onPress={handleBook} loading={createSR.isPending} disabled={!ready} />
    </View>
  );
}

const placeSty = StyleSheet.create({
  container: { flex: 0, zIndex: 99 },
  input: {
    height: 50, fontSize: 15, color: Colors.ink,
    backgroundColor: Colors.bgGrouped, borderWidth: 1, borderColor: 'transparent',
    borderRadius: Radius.md, paddingHorizontal: 14, fontWeight: '500',
  },
  list: {
    backgroundColor: Colors.white, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.line, marginTop: 4, ...Shadow.md, zIndex: 100,
  },
  row: { backgroundColor: 'transparent', paddingVertical: 0, paddingHorizontal: 0 },
  description: { display: 'none' },
  rowInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.line },
  mainText: { fontSize: 13.5, fontWeight: '700', color: Colors.ink },
  subText:  { fontSize: 11, color: Colors.inkTertiary, marginTop: 1 },
});

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgApp },
  scroll: { paddingHorizontal: Spacing.md, paddingTop: 4 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.inkSecondary, marginBottom: 10, marginTop: Spacing.md },

  placesWrapper: { zIndex: 99 },
  addrChip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.brandSoft, borderRadius: Radius.md, padding: 12, marginTop: Spacing.sm },
  addrChipTxt: { flex: 1, fontSize: 12.5, color: Colors.accentInk, fontWeight: '600', lineHeight: 18 },

  summaryBox:   { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.xs },
  summaryHead:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  summaryDevice:{ flex: 1, fontSize: 15, fontWeight: '700', color: Colors.ink, letterSpacing: -0.2 },
  pillRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:         { backgroundColor: '#fff', paddingHorizontal: 11, paddingVertical: 6, borderRadius: Radius.full },
  pillTxt:      { fontSize: 11.5, fontWeight: '600', color: Colors.inkSecondary },

  dateScroll: { marginTop: 2 },
  dateChip: {
    width: 64, marginRight: 10, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: 'transparent', backgroundColor: Colors.bgGrouped,
    alignItems: 'center', paddingVertical: 12,
  },
  dateChipActive: { borderColor: Colors.accent, backgroundColor: Colors.brandNavy },
  dateDay:  { fontSize: 11, color: Colors.inkTertiary, fontWeight: '700' },
  dateNum:  { fontSize: 22, fontWeight: '800', color: Colors.ink, marginVertical: 2 },
  dateMon:  { fontSize: 10, color: Colors.inkTertiary, fontWeight: '600' },
  dateTxtActive: { color: '#fff' },
  weekendDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.accentInk, marginTop: 4 },

  ampmRow:      { flexDirection: 'row', gap: 10 },
  ampmBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: Colors.bgGrouped, borderRadius: Radius.md, paddingVertical: 13, borderWidth: 1.5, borderColor: 'transparent' },
  ampmBtnActive:{ borderColor: Colors.accent, backgroundColor: Colors.brandNavy },
  ampmTxt:      { fontSize: 12.5, fontWeight: '700', color: Colors.inkSecondary },
  ampmTxtActive:{ color: '#fff' },

  slotsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.md },
  slotChip:     { paddingHorizontal: 16, paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: Colors.bgGrouped },
  slotChipActive:{ borderColor: Colors.accent, backgroundColor: Colors.brandSoft },
  slotTxt:      { fontSize: 13, fontWeight: '700', color: Colors.inkSecondary },
  slotTxtActive:{ color: Colors.accentInk },

  confirmBox:   { flexDirection: 'row', gap: 10, backgroundColor: Colors.infoLight, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.lg },
  confirmTitle: { fontSize: 12.5, fontWeight: '800', color: '#0A5BD3', marginBottom: 3 },
  confirmText:  { fontSize: 12.5, color: Colors.inkSecondary, lineHeight: 18 },
});
