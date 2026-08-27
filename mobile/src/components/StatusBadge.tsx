import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_CONFIG, Colors } from '@/theme';

interface StatusBadgeProps { status: string; size?: 'sm' | 'md' }

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: Colors.gray100, text: Colors.gray600, dot: Colors.gray400 };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, size === 'sm' && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.text, { color: cfg.text }, size === 'sm' && styles.textSm]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, alignSelf: 'flex-start',
  },
  badgeSm: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  text: { fontSize: 12, fontWeight: '700' },
  textSm: { fontSize: 11 },
});
