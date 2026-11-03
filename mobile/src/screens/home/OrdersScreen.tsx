import React, { Fragment, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { srApi } from '@/api/client';
import { Colors, Shadow } from '@/theme';
import LargeHeader from '@/components/LargeHeader';
import StatusBadge from '@/components/StatusBadge';
import DeviceArtwork from '@/components/DeviceArtwork';
import { formatDeviceName, getCategory, MODE_LABELS } from '@/catalog/services';
import type { ServiceRequest } from '@/types';
import { formatDateOnly, formatTimeSlot } from '@/utils/dateTime';
import NotificationBell from '@/components/NotificationBell';

export default function OrdersScreen({ navigation }: any) {
  const [history, setHistory] = useState(false);
  const reveal = React.useRef(new Animated.Value(0)).current;
  const query = useQuery<ServiceRequest[]>({ queryKey: ['my-requests'], queryFn: srApi.list, refetchInterval: 30000 });
  const allGroups = Object.values((query.data ?? []).reduce<Record<string, ServiceRequest[]>>((groups, row) => {
    (groups[row.bookingId ?? row.id] ??= []).push(row);
    return groups;
  }, {}));
  const groups = allGroups.filter(rows => rows.every(r => ['DELIVERED', 'CANCELLED'].includes(r.status)) === history);
  React.useEffect(() => {
    reveal.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => reduced ? reveal.setValue(1) : Animated.timing(reveal, { toValue: 1, duration: 430, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start());
  }, [history, query.data]);

  return <View style={s.root}>
    <LargeHeader title="Requests" subtitle="Track every device and service" right={<NotificationBell />} />
    <View style={s.tabs}>{['Active', 'History'].map((title, index) => <TouchableOpacity key={title} accessibilityRole="tab" accessibilityState={{ selected: history === !!index }} onPress={() => setHistory(!!index)} style={[s.tab, history === !!index && s.selected]}><Text style={[s.tabText, history === !!index && s.selectedText]}>{title}</Text></TouchableOpacity>)}</View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} />} showsVerticalScrollIndicator={false}>
      {query.isError ? <TouchableOpacity onPress={() => query.refetch()}><Text style={s.error}>Could not load requests. Tap to retry.</Text></TouchableOpacity> : query.isLoading ? <Text style={s.muted}>Loading requests...</Text> : !groups.length ? <View style={s.empty}><Ionicons name={history ? 'archive-outline' : 'receipt-outline'} size={34} color={Colors.inkTertiary} /><Text style={s.emptyTitle}>{history ? 'No completed requests yet' : 'No active requests'}</Text><Text style={s.muted}>Your service requests will appear here.</Text></View> : null}
      {groups.map((rows, groupIndex) => <Fragment key={rows[0].bookingId ?? rows[0].id}>
        {rows.length > 1 && <View style={s.bookingHead}><Text style={s.bookingLabel}>BOOKED TOGETHER</Text><Text style={s.bookingCount}>{rows.length} service requests</Text></View>}
        {rows.sort((a,b) => (a.bookingPosition ?? 0) - (b.bookingPosition ?? 0)).map((row, index) => {
          const progress = requestProgress(row.status);
          return <Animated.View key={row.id} style={{ opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18 + (groupIndex + index) * 3, 0] }) }] }}>
            <TouchableOpacity activeOpacity={.86} style={s.card} onPress={() => navigation.navigate('RequestDetail', { id: row.id })}>
              <View style={s.cardTop}><DeviceArtwork category={row.serviceCategory} size={70} /><View style={s.cardCopy}><Text style={s.ticket}>{row.serviceRequestNumber ?? row.ticketNumber}</Text><Text style={s.name} numberOfLines={1}>{formatDeviceName(row.device)}</Text><Text style={s.service} numberOfLines={1}>{getCategory(row.serviceCategory)?.label ?? 'Service request'}</Text></View><StatusBadge status={row.status} size="sm" /></View>
              <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress}%` }]} /></View>
              <View style={s.metaRow}><View style={s.meta}><Ionicons name="calendar-outline" size={16} color={Colors.accentInk} /><Text style={s.metaText}>{formatDateOnly(row.pickupSlotDate ?? row.createdAt)}</Text></View><View style={s.meta}><Ionicons name="location-outline" size={16} color={Colors.accentInk} /><Text style={s.metaText} numberOfLines={1}>{MODE_LABELS[row.serviceMode ?? 'PICKUP']}</Text></View></View>
              {!!row.pickupSlotTime && <Text style={s.slot}>{formatTimeSlot(row.pickupSlotTime)}</Text>}
              <View style={s.viewRow}><Text style={s.viewText}>View progress and details</Text><Ionicons name="arrow-forward" size={17} color={Colors.accentInk} /></View>
            </TouchableOpacity>
          </Animated.View>;
        })}
      </Fragment>)}
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: Colors.surface, borderRadius: 8, padding: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6 }, selected: { backgroundColor: Colors.brandNavy },
  tabText: { color: Colors.inkSecondary, fontWeight: '700' }, selectedText: { color: '#fff' },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  bookingHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 1 },
  bookingLabel: { color: Colors.inkTertiary, fontSize: 9, fontWeight: '900' }, bookingCount: { color: Colors.inkSecondary, fontSize: 11 },
  card: { backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1, borderColor: Colors.line, padding: 14, ...Shadow.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 11 }, cardCopy: { flex: 1, minWidth: 0 },
  ticket: { color: Colors.accentInk, fontWeight: '800', fontSize: 11 }, name: { color: Colors.ink, fontWeight: '900', fontSize: 17, marginTop: 3 }, service: { color: Colors.inkSecondary, fontSize: 11.5, marginTop: 3 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.surfaceStrong, overflow: 'hidden', marginTop: 14 }, progressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  metaRow: { flexDirection: 'row', gap: 14, marginTop: 13 }, meta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }, metaText: { color: Colors.inkSecondary, fontSize: 11, flexShrink: 1 }, slot: { color: Colors.inkTertiary, fontSize: 10.5, marginTop: 7 },
  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 12, marginTop: 12 }, viewText: { color: Colors.accentInk, fontSize: 12, fontWeight: '800' },
  muted: { color: Colors.inkSecondary, fontSize: 13, textAlign: 'center' }, error: { color: Colors.error, fontWeight: '700', padding: 14 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 }, emptyTitle: { color: Colors.ink, fontSize: 17, fontWeight: '800' },
});

function requestProgress(status: string) {
  const index: Record<string, number> = { REQUEST_RECEIVED: 8, PICKUP_SCHEDULED: 15, PICKED_UP: 25, RECEIVED_AT_WORKSHOP: 32, DIAGNOSING: 42, DIAGNOSED: 50, QUOTATION_SHARED: 58, QUOTE_APPROVED: 65, PAYMENT_RECEIVED: 70, AWAITING_PARTS: 74, UNDER_REPAIR: 80, TESTING: 88, REPAIR_COMPLETE: 93, READY_FOR_HANDOVER: 96, OUT_FOR_DELIVERY: 97, DELIVERED: 100, CANCELLED: 100 };
  return index[status] ?? 8;
}
