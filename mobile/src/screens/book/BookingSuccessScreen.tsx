import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '@/theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BookStackParamList } from '@/types';
import type { IconName } from '@/catalog/services';

type Props = {
  navigation: NativeStackNavigationProp<BookStackParamList, 'BookingSuccess'>;
  route: { params: { ticketNumber: string; count?: number } };
};

const STEPS: { icon: IconName; text: string }[] = [
  { icon: 'call-outline',        text: 'Our team confirms your chosen service appointment' },
  { icon: 'bag-handle-outline',  text: 'Pickup, visit or consultation as requested' },
  { icon: 'search-outline',      text: 'For workshop repairs, a quotation within 48 hours of receipt' },
  { icon: 'construct-outline',   text: 'Professional repair by certified technicians' },
  { icon: 'home-outline',        text: 'Completion and handover updates in your ticket' },
];

export default function BookingSuccessScreen({ navigation, route }: Props) {
  const { ticketNumber, count = 1 } = route.params;
  const insets = useSafeAreaInsets();
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity }}
      >
        <Animated.View style={[styles.successRing, { transform: [{ scale }] }]}>
          <View style={styles.successInner}>
            <Ionicons name="checkmark-sharp" size={42} color={Colors.white} />
          </View>
        </Animated.View>

        <Text style={styles.title}>All set!</Text>
        <Text style={styles.subtitle}>{count > 1 ? `${count} separate device requests are confirmed under one booking.` : 'Your service request is confirmed.'}</Text>

        <View style={styles.ticketBox}>
          <Text style={styles.ticketLbl}>{count > 1 ? 'Your booking reference' : 'Your ticket number'}</Text>
          <Text style={styles.ticketNum}>{ticketNumber}</Text>
          <View style={styles.ticketHintRow}>
            <Ionicons name="camera-outline" size={13} color={Colors.inkTertiary} />
            <Text style={styles.ticketHint}>Screenshot this for quick reference</Text>
          </View>
        </View>

        <View style={styles.stepsBox}>
          <Text style={styles.stepsTitle}>What happens next</Text>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={styles.stepIconBox}>
                  <Ionicons name={s.icon} size={17} color={Colors.brandNavy} />
                </View>
                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
              </View>
              <Text style={styles.stepTxt}>{s.text}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => { navigation.reset({ index: 0, routes: [{ name: 'Step1Device' }] }); navigation.getParent()?.navigate('HomeTab'); }}
          activeOpacity={0.88}
        >
          <Text style={styles.doneTxt}>Done</Text>
        </TouchableOpacity>

        <Text style={styles.note}>Your booking and future updates are saved in your account.</Text>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bgApp },
  scroll: { padding: Spacing.lg, alignItems: 'center', paddingBottom: 60 },

  successRing: {
    width: 104, height: 104, borderRadius: 52,
    backgroundColor: Colors.successLight,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xxl, marginBottom: Spacing.lg,
  },
  successInner: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
  },

  title:    { fontSize: 30, fontWeight: '800', color: Colors.ink, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, color: Colors.inkSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 300 },

  ticketBox: {
    backgroundColor: Colors.bgGrouped, borderRadius: Radius.xl, padding: Spacing.lg,
    alignItems: 'center', marginTop: Spacing.xl, width: '100%',
  },
  ticketLbl:  { fontSize: 11, fontWeight: '700', color: Colors.inkTertiary, textTransform: 'uppercase', letterSpacing: 1 },
  ticketNum:  { fontSize: 30, fontWeight: '800', color: Colors.brandNavy, marginVertical: 8, letterSpacing: 1 },
  ticketHintRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ticketHint: { fontSize: 11, color: Colors.inkTertiary },

  stepsBox:   { backgroundColor: Colors.bgGrouped, borderRadius: Radius.xl, padding: Spacing.lg, marginTop: Spacing.md, width: '100%' },
  stepsTitle: { fontSize: 15, fontWeight: '800', color: Colors.ink, marginBottom: Spacing.md, letterSpacing: -0.2 },

  stepRow:  { flexDirection: 'row', marginBottom: 0 },
  stepLeft: { alignItems: 'center', marginRight: 14, width: 36 },
  stepIconBox: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, backgroundColor: Colors.lineStrong, marginTop: 4, marginBottom: 4, minHeight: 14 },
  stepTxt:  { flex: 1, fontSize: 13.5, color: Colors.inkSecondary, lineHeight: 20, paddingTop: 9, paddingBottom: 16 },

  doneBtn: { width: '100%', borderRadius: Radius.md, marginTop: Spacing.xl, backgroundColor: Colors.brandNavy, padding: 16, alignItems: 'center' },
  doneTxt: { fontSize: 16, fontWeight: '700', color: Colors.white, letterSpacing: -0.2 },

  note: { fontSize: 12, color: Colors.inkTertiary, textAlign: 'center', marginTop: Spacing.lg, lineHeight: 18 },
});
