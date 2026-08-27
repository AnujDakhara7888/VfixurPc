import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/api/client';
import LargeHeader from '@/components/LargeHeader';
import { Colors, Spacing, Radius } from '@/theme';
import type { Notification } from '@/types';
import { format, parseISO } from 'date-fns';

function NotifCard({ item }: { item: Notification }) {
  const dateStr = (() => {
    try { return format(parseISO(item.createdAt), 'dd MMM · h:mm a'); } catch { return ''; }
  })();
  const sent = item.status === 'SENT';
  const failed = item.status === 'FAILED';
  const statusColor = sent ? Colors.success : failed ? Colors.error : Colors.gray400;

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: sent ? Colors.successLight : Colors.surface }]}>
        <Ionicons
          name={item.type === 'PUSH' ? 'notifications-outline' : 'chatbox-ellipses-outline'}
          size={19}
          color={sent ? Colors.success : Colors.brandNavy}
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.message}>{item.message}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.date}>{dateStr}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusTxt, { color: statusColor }]}>{item.status}</Text>
        </View>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 60_000,
  });

  const notifs = Array.isArray(data) ? data : [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader
        title="Notifications"
        subtitle={notifs.length > 0 ? `${notifs.length} update${notifs.length > 1 ? 's' : ''}` : undefined}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={30} color={Colors.gray400} />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySub}>Updates about your repair will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotifCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },

  loadingWrap:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, paddingBottom: 80 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  emptySub:   { fontSize: 14, color: Colors.inkTertiary, textAlign: 'center', marginTop: 6, lineHeight: 22 },

  list:       { padding: Spacing.md, paddingBottom: 40 },
  card: {
    flexDirection: 'row', backgroundColor: Colors.bgGrouped, gap: 12,
    borderRadius: Radius.lg, padding: Spacing.md,
  },
  iconCircle: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody:   { flex: 1 },
  message:    { fontSize: 14, color: Colors.ink, fontWeight: '500', lineHeight: 20 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 7, gap: 7 },
  date:       { fontSize: 11, color: Colors.inkTertiary, fontWeight: '500' },
  statusDot:  { width: 5, height: 5, borderRadius: 2.5 },
  statusTxt:  { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
});
