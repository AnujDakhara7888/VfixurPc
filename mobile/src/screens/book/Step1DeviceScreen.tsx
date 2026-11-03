import React from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LargeHeader from '@/components/LargeHeader';
import { useServiceCatalog } from '@/catalog/services';
import { Colors, Gradients, Shadow } from '@/theme';
import { useBooking } from '@/context/BookingContext';
import NotificationBell from '@/components/NotificationBell';
import StepIndicator from './StepIndicator';
import ServiceArtwork from '@/components/ServiceArtwork';

export default function Step1DeviceScreen({ navigation, route }: any) {
  const booking = useBooking();
  const { width } = useWindowDimensions();
  const { data, isLoading, isError, refetch } = useServiceCatalog();
  const reveal = React.useRef(new Animated.Value(0)).current;
  const cardWidth = (width - 50) / 2;

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reduced) reveal.setValue(1);
      else Animated.timing(reveal, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }, [reveal]);
  React.useEffect(() => {
    const id = route.params?.preselectCategory;
    if (id && data?.some(c => c.id === id)) {
      navigation.setParams({ preselectCategory: undefined });
      navigation.push('Step2Issues', { categoryId: id });
    }
  }, [route.params?.preselectCategory, data]);

  const open = (id: string, needsDevice: boolean) => {
    navigation.push('Step2Issues', { categoryId: id, deviceId: needsDevice ? route.params?.savedDeviceId : undefined });
    navigation.setParams({ savedDeviceId: undefined });
  };
  const primary = data?.filter(c => ['laptop', 'desktop', 'mac', 'data', 'upgrade', 'virus'].includes(c.id)) ?? [];
  const more = data?.filter(c => !primary.some(p => p.id === c.id)) ?? [];
  const group = (title: string, subtitle: string, rows: typeof primary) => <View style={s.group}>
    <Text style={s.groupTitle}>{title}</Text><Text style={s.groupSub}>{subtitle}</Text>
    <View style={s.grid}>{rows.map((c, index) => <Animated.View key={c.id} style={{ width: cardWidth, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [14 + index * 2, 0] }) }] }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={c.label} activeOpacity={.82} style={s.card} onPress={() => open(c.id, c.needsDevice)}>
        <ServiceArtwork category={c.id} size={54} />
        <Text style={s.title} numberOfLines={2}>{c.label}</Text>
        <Text style={s.sub} numberOfLines={2}>{c.tagline}</Text>
      </TouchableOpacity>
    </Animated.View>)}</View>
  </View>;

  return <View style={s.root}>
    <LargeHeader title="Book a service" subtitle="Tell us what needs attention" right={<NotificationBell />} />
      <StepIndicator current={0} total={4} labels={['Service', 'Details', 'Arrange', 'Confirm']} />
    {isLoading ? <ActivityIndicator color={Colors.accentInk} /> : null}
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      {isError ? <TouchableOpacity onPress={() => refetch()} style={s.error}><Text style={s.errorText}>Services could not load. Tap to retry.</Text></TouchableOpacity> : null}
      {booking.drafts.length > 0 && <View style={s.saved}><View style={{ flex: 1 }}><Text style={s.savedTitle}>{booking.drafts.length} saved in this booking</Text><Text style={s.savedSub}>Add another device or continue with your combined booking.</Text></View><TouchableOpacity accessibilityLabel="Discard saved booking" onPress={() => booking.clear()} style={s.trash}><Ionicons name="trash-outline" size={20} color={Colors.error} /></TouchableOpacity></View>}
      <LinearGradient colors={Gradients.ink} style={s.hero}>
        <View style={s.heroIcon}><Ionicons name="sparkles-outline" size={24} color="#7EC8FF" /></View>
        <View style={{ flex: 1 }}><Text style={s.heroTitle}>One request, clear next steps</Text><Text style={s.heroText}>Choose a service now. We will guide the device, issue, service option and appointment.</Text></View>
      </LinearGradient>
      {group('What we fix', 'Repairs, recovery and performance', primary)}
      {group('Our services', 'Setup, protection and business support', more)}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { paddingHorizontal: 20, paddingBottom: 44 },
  hero: { borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24, ...Shadow.ink },
  heroIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.1)' },
  heroTitle: { color: '#fff', fontSize: 16, fontWeight: '900' }, heroText: { color: '#C8DAEF', fontSize: 12, lineHeight: 17, marginTop: 4 },
  group: { marginBottom: 25 }, groupTitle: { fontSize: 21, color: Colors.ink, fontWeight: '900' }, groupSub: { color: Colors.inkSecondary, fontSize: 12.5, marginTop: 3, marginBottom: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { minHeight: 142, backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1, borderColor: Colors.line, padding: 13, ...Shadow.xs },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: Colors.ink, marginTop: 10 }, sub: { fontSize: 11, lineHeight: 15, color: Colors.inkSecondary, marginTop: 4 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, marginBottom: 14, borderRadius: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line },
  savedTitle: { color: Colors.ink, fontWeight: '800', fontSize: 13 }, savedSub: { color: Colors.inkSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 }, trash: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  error: { backgroundColor: Colors.errorLight, padding: 14, borderRadius: 8, marginBottom: 14 }, errorText: { color: Colors.error, fontWeight: '700' },
});
