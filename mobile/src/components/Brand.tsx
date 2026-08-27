import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Shadow } from '@/theme';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { box: number; radius: number; icon: number; word: number; gap: number }> = {
  sm: { box: 32, radius: 10, icon: 18, word: 18, gap: 9 },
  md: { box: 42, radius: 13, icon: 24, word: 22, gap: 11 },
  lg: { box: 64, radius: 19, icon: 36, word: 30, gap: 15 },
};

/**
 * The VfixurPC mark: a gradient navy chip with an azure-blue circuit glyph and a
 * fine azure edge-light. Premium, ownable, and crisp at every size.
 */
export function BrandMark({ size = 'md', onDark = false }: { size?: Size; onDark?: boolean }) {
  const s = SIZES[size];
  return (
    <View
      style={[
        styles.mark,
        {
          width: s.box,
          height: s.box,
          borderRadius: s.radius,
          borderColor: onDark ? 'rgba(79,179,255,0.55)' : 'rgba(79,179,255,0.30)',
        },
        !onDark && Shadow.sm,
      ]}
    >
      <LinearGradient
        colors={Gradients.ink}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: s.radius }]}
      />
      {/* edge highlight */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: s.radius,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.14)',
          },
        ]}
      />
      <Ionicons name="hardware-chip" size={s.icon} color={Colors.brandBright} />
    </View>
  );
}

/**
 * Full lockup: gradient mark + "VfixurPC" wordmark (PC in azure blue).
 */
export default function Brand({
  size = 'md',
  onDark = false,
  showWord = true,
}: {
  size?: Size;
  onDark?: boolean;
  showWord?: boolean;
}) {
  const s = SIZES[size];
  const wordColor = onDark ? Colors.white : Colors.ink;
  return (
    <View style={[styles.row, { gap: s.gap }]}>
      <BrandMark size={size} onDark={onDark} />
      {showWord && (
        <Text style={[styles.word, { fontSize: s.word, color: wordColor }]}>
          Vfixur<Text style={{ color: Colors.brand }}>PC</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  word: { fontWeight: '800', letterSpacing: -0.6 },
});
