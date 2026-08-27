import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from '@/components/Input';
import LargeHeader from '@/components/LargeHeader';
import BookingBar from '@/components/BookingBar';
import StepIndicator from './StepIndicator';
import { Colors, Spacing, Radius, Shadow } from '@/theme';
import { BOOKING_STEPS, getCategory } from '@/catalog/services';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BookStackParamList } from '@/types';
import Toast from 'react-native-toast-message';

type Props = {
  navigation: NativeStackNavigationProp<BookStackParamList, 'Step2Issues'>;
  route: { params: { deviceId: string; categoryId: string; deviceName: string } };
};

export default function Step2IssuesScreen({ navigation, route }: Props) {
  const { deviceId, categoryId, deviceName } = route.params;
  const category = getCategory(categoryId);
  // Only ever show the issues relevant to the chosen service.
  const issuePool = category?.issues ?? [];

  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const toggle = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  function handleNext() {
    if (selected.length === 0) { Toast.show({ type: 'error', text1: 'Select at least one issue' }); return; }
    const chosen = issuePool.filter((c) => selected.includes(c.id));
    const issues = chosen.map((c) => ({ category: c.label, description: description.trim() || undefined }));
    const issueLabels = chosen.map((c) => c.label);
    navigation.navigate('Step3Pickup', { deviceId, categoryId, deviceName, issues, issueLabels });
  }

  const selPreview = issuePool
    .filter((c) => selected.includes(c.id))
    .slice(0, 2)
    .map((c) => c.label)
    .join(', ') + (selected.length > 2 ? ` +${selected.length - 2}` : '');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader
        title="What's wrong?"
        subtitle={deviceName}
        eyebrow={category?.label}
        onBack={() => navigation.goBack()}
      />
      <StepIndicator current={1} total={3} labels={[...BOOKING_STEPS]} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>Select all that apply.</Text>

        <View style={styles.grid}>
          {issuePool.map((cat) => {
            const isSel = selected.includes(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.card, isSel && styles.cardActive]}
                onPress={() => toggle(cat.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.cardIcon, isSel && styles.cardIconActive]}>
                  <Ionicons name={cat.icon} size={19} color={isSel ? '#fff' : Colors.brandNavy} />
                </View>
                <Text style={[styles.cardLabel, isSel && styles.cardLabelActive]} numberOfLines={2}>{cat.label}</Text>
                {isSel && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ marginTop: Spacing.lg }}>
          <Input
            label="Describe the issue (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="When did it start? Any error messages? Anything we should know?"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <BookingBar
        label="Continue"
        onPress={handleNext}
        disabled={selected.length === 0}
        hint={selected.length > 0 ? `${selected.length} issue${selected.length > 1 ? 's' : ''} selected` : undefined}
        subhint={selected.length > 0 ? selPreview : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgApp },
  scroll: { paddingHorizontal: Spacing.md, paddingTop: 4 },
  hint:   { fontSize: 13, color: Colors.inkTertiary, marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.6%', backgroundColor: '#fff', borderRadius: Radius.lg,
    padding: 14, borderWidth: 1.5, borderColor: Colors.line,
    flexDirection: 'row', alignItems: 'center', gap: 11, position: 'relative',
    ...Shadow.xs,
  },
  cardActive: { borderColor: Colors.accent, backgroundColor: Colors.brandSofter, ...Shadow.sm },
  cardIcon: {
    width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.bgGrouped,
    alignItems: 'center', justifyContent: 'center',
  },
  cardIconActive: { backgroundColor: Colors.brandNavy },
  cardLabel: { flex: 1, fontSize: 12.5, fontWeight: '600', color: Colors.ink, lineHeight: 16, letterSpacing: -0.1, paddingRight: 8 },
  cardLabelActive: { fontWeight: '700' },
  check: {
    position: 'absolute', top: 9, right: 9,
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accentInk,
    alignItems: 'center', justifyContent: 'center',
  },
});
