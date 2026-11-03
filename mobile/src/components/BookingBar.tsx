import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Radius, Gradients, Shadow } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  hint?: string;        // small text shown on the left (e.g. "2 issues selected")
  subhint?: string;     // secondary text under the hint
}

/**
 * Fixed bottom action bar used on every booking step, so the primary action
 * always lives in the same place with the same premium shape.
 */
export default function BookingBar({ label, onPress, disabled, loading, hint, subhint }: Props) {
  const insets = useSafeAreaInsets();
  const isDisabled = disabled || loading;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      {hint ? (
        <View style={styles.hintCol}>
          <Text style={styles.hint} numberOfLines={1}>{hint}</Text>
          {subhint ? <Text style={styles.subhint} numberOfLines={1}>{subhint}</Text> : null}
        </View>
      ) : null}
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[hint ? styles.btnCompact : styles.btnFull, isDisabled && styles.dim]}
      >
        <LinearGradient
          colors={isDisabled ? (['#CBD3DD', '#B7C0CC'] as const) : Gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.btn, !isDisabled && Shadow.brand]}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={styles.btnTxt}>{label}</Text>
              <Ionicons name="arrow-forward" size={19} color={Colors.white} />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.md, paddingTop: 12,
    backgroundColor: Colors.bgApp,
    borderTopWidth: 1, borderTopColor: Colors.line,
  },
  hintCol: { flex: 1 },
  hint: { fontSize: 14, fontWeight: '800', color: Colors.ink, letterSpacing: -0.2 },
  subhint: { fontSize: 12, color: Colors.inkTertiary, marginTop: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: Radius.md, paddingVertical: 17, paddingHorizontal: 24,
  },
  btnFull: { flex: 1 },
  btnCompact: { minWidth: 168 },
  dim: { opacity: 0.6 },
  btnTxt: { fontSize: 16.5, fontWeight: '800', color: Colors.white, letterSpacing: 0 },
});
