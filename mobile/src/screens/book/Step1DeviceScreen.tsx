import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { devicesApi } from '@/api/client';
import Input from '@/components/Input';
import LargeHeader from '@/components/LargeHeader';
import BookingBar from '@/components/BookingBar';
import StepIndicator from './StepIndicator';
import { Colors, Spacing, Radius, Shadow } from '@/theme';
import {
  SERVICE_CATEGORIES, BRANDS, BOOKING_STEPS, getCategory, formatDeviceName,
} from '@/catalog/services';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BookStackParamList } from '@/types';
import Toast from 'react-native-toast-message';

type Props = {
  navigation: NativeStackNavigationProp<BookStackParamList, 'Step1Device'>;
  route: { params?: { preselectCategory?: string } };
};

export default function Step1DeviceScreen({ navigation, route }: Props) {
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');

  // Carry a pre-selected service from the Home screen into the flow.
  useEffect(() => {
    const pre = route.params?.preselectCategory;
    if (pre && getCategory(pre)) {
      setCategoryId(pre);
      if (pre === 'mac') setBrand('Apple');
    }
  }, [route.params?.preselectCategory]);

  const category = getCategory(categoryId);
  const needsDevice = !!category?.needsDevice;

  const createDevice = useMutation({
    mutationFn: () => {
      const payload = needsDevice
        ? { brand: brand.trim() || 'Not sure', model: model.trim() || 'Not sure', serialNumber: serial.trim() || undefined }
        // Non-hardware services store the service name in both fields; the UI
        // collapses identical brand/model to a single clean label.
        : { brand: category!.label, model: category!.label };
      return devicesApi.create(payload);
    },
    onSuccess: (device) =>
      navigation.navigate('Step2Issues', {
        deviceId: device.id,
        categoryId,
        deviceName: formatDeviceName(device),
      }),
    onError: () => Toast.show({ type: 'error', text1: 'Could not save your details. Try again.' }),
  });

  function handleNext() {
    // Keep the funnel open: only the service selection is required. Brand,
    // model and serial number stay optional everywhere, per the "never make
    // technical fields mandatory" rule — customers who don't know their
    // device can always continue with "Not sure".
    if (!categoryId) { Toast.show({ type: 'error', text1: 'Choose a service to continue' }); return; }
    createDevice.mutate();
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader title="Book a repair" subtitle="Choose the service you need." />
      <StepIndicator current={0} total={3} labels={[...BOOKING_STEPS]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>What do you need help with?</Text>
        <View style={styles.grid}>
          {SERVICE_CATEGORIES.map((sv) => {
            const isSel = categoryId === sv.id;
            return (
              <TouchableOpacity
                key={sv.id}
                style={[styles.card, isSel && styles.cardActive]}
                onPress={() => {
                  setCategoryId(sv.id);
                  if (!sv.needsDevice) { setBrand(''); setModel(''); setSerial(''); }
                  else if (sv.id === 'mac') setBrand('Apple');
                }}
                activeOpacity={0.85}
              >
                <View style={[styles.cardIcon, isSel && styles.cardIconActive]}>
                  <Ionicons name={sv.icon} size={22} color={isSel ? '#fff' : Colors.brandNavy} />
                </View>
                <Text style={[styles.cardLabel, isSel && styles.cardLabelActive]}>{sv.label}</Text>
                <Text style={styles.cardTagline} numberOfLines={2}>{sv.tagline}</Text>
                {isSel && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {needsDevice && (
          <>
            <View style={[styles.sectionHead, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionTitle}>Brand</Text>
              <Text style={styles.sectionOptional}>Optional</Text>
            </View>
            <View style={styles.brandGrid}>
              <TouchableOpacity
                style={[styles.brandChip, brand === 'Not sure' && styles.brandChipActive]}
                onPress={() => setBrand('Not sure')}
                activeOpacity={0.85}
              >
                <Text style={[styles.brandTxt, brand === 'Not sure' && styles.brandTxtActive]}>Not sure</Text>
              </TouchableOpacity>
              {BRANDS.map((b) => {
                const isSel = brand === b;
                return (
                  <TouchableOpacity
                    key={b}
                    style={[styles.brandChip, isSel && styles.brandChipActive]}
                    onPress={() => setBrand(b)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.brandTxt, isSel && styles.brandTxtActive]}>{b}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ marginTop: Spacing.lg }}>
              <Input label="Model name (optional)" value={model} onChangeText={setModel} placeholder="e.g. HP Pavilion 15, MacBook Air M2" />
              <TouchableOpacity onPress={() => setModel('Not sure')} activeOpacity={0.6}>
                <Text style={styles.dontKnow}>I don't know my model →</Text>
              </TouchableOpacity>
              <Input label="Serial number / service tag (optional)" value={serial} onChangeText={setSerial} placeholder="On the bottom sticker or in BIOS" autoCapitalize="characters" />
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <BookingBar label="Continue" onPress={handleNext} loading={createDevice.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bgApp },
  scroll:      { paddingHorizontal: Spacing.md, paddingTop: 4 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', color: Colors.ink, letterSpacing: -0.3, marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionOptional: { fontSize: 12, fontWeight: '700', color: Colors.inkTertiary, marginBottom: 14 },
  dontKnow:    { fontSize: 12.5, fontWeight: '700', color: Colors.accentInk, marginTop: -8, marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.6%', backgroundColor: '#fff', borderRadius: Radius.lg,
    padding: 16, borderWidth: 1.5, borderColor: Colors.line, position: 'relative',
    ...Shadow.xs,
  },
  cardActive: { borderColor: Colors.accent, backgroundColor: Colors.brandSofter, ...Shadow.sm },
  cardIcon: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: Colors.bgGrouped,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  cardIconActive: { backgroundColor: Colors.brandNavy },
  cardLabel:    { fontSize: 14, fontWeight: '700', color: Colors.ink, letterSpacing: -0.2 },
  cardLabelActive: { color: Colors.ink },
  cardTagline:  { fontSize: 11.5, color: Colors.inkTertiary, marginTop: 3, lineHeight: 15 },
  check: {
    position: 'absolute', top: 12, right: 12,
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accentInk,
    alignItems: 'center', justifyContent: 'center',
  },

  brandGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandChip:   {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.lineStrong, backgroundColor: Colors.white,
  },
  brandChipActive: { borderColor: Colors.brandNavy, backgroundColor: Colors.brandNavy },
  brandTxt:    { fontSize: 13.5, fontWeight: '600', color: Colors.gray700 },
  brandTxtActive: { color: Colors.white },
});
