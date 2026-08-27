import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '@/theme';

interface Props {
  title: string;
  subtitle?: string;
  eyebrow?: string;            // small uppercase kicker above the title
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Light, iOS large-title header. Replaces the old dark navy header bands so
 * every screen shares one calm, consistent top treatment.
 */
export default function LargeHeader({ title, subtitle, eyebrow, onBack, right, style }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }, style]}>
      {(onBack || right) && (
        <View style={styles.bar}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.ink} />
            </TouchableOpacity>
          ) : <View style={{ width: 38 }} />}
          <View style={{ flex: 1 }} />
          {right ?? <View style={{ width: 38 }} />}
        </View>
      )}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.bgApp,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 14,
  },
  bar: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: {
    width: 40, height: 40, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.line,
  },
  eyebrow: {
    fontSize: 12, fontWeight: '800', color: Colors.accentInk,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7,
  },
  title: { fontSize: 33, fontWeight: '800', color: Colors.ink, letterSpacing: -0.9, lineHeight: 39 },
  subtitle: { fontSize: 15, color: Colors.inkSecondary, marginTop: 7, lineHeight: 21 },
});
