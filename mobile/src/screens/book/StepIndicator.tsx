import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Motion } from '@/theme';

interface Props { current: number; total: number; labels?: string[] }

export default function StepIndicator({ current, total, labels }: Props) {
  const progress = useRef(new Animated.Value(total <= 1 ? 0 : current / (total - 1))).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: total <= 1 ? 0 : current / (total - 1),
      duration: Motion.base,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const icons: React.ComponentProps<typeof Ionicons>['name'][] = ['construct-outline', 'laptop-outline', 'location-outline', 'checkmark-circle-outline'];

  return (
    <View style={styles.wrap} accessibilityLabel={`Step ${current + 1} of ${total}: ${labels?.[current] ?? ''}`}>
      <View style={styles.railWrap}>
        <View style={styles.track}><Animated.View style={[styles.fill, { width }]} /></View>
        <View style={styles.steps}>
          {Array.from({ length: total }).map((_, index) => {
            const done = index < current;
            const active = index === current;
            return <View key={index} style={styles.step}>
              <View style={[styles.dot, (done || active) && styles.dotActive, active && styles.dotCurrent]}>
                <Ionicons name={done ? 'checkmark' : icons[index] ?? 'ellipse-outline'} size={active ? 18 : 15} color={done || active ? '#fff' : Colors.inkTertiary} />
              </View>
              <Text numberOfLines={2} style={[styles.stepLabel, active && styles.stepLabelActive]}>{labels?.[index] ?? `Step ${index + 1}`}</Text>
            </View>;
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: 14 },
  railWrap: { position: 'relative' },
  track: {
    position: 'absolute', left: '11%', right: '11%', top: 18,
    height: 3, borderRadius: 2, backgroundColor: Colors.surfaceStrong, overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: 2, backgroundColor: Colors.accent },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceStrong, borderWidth: 3, borderColor: Colors.bgApp },
  dotActive: { backgroundColor: Colors.accent },
  dotCurrent: { width: 42, height: 42, borderRadius: 21, marginTop: -3, borderColor: '#DDEBFF' },
  stepLabel: { color: Colors.inkTertiary, fontSize: 9.5, lineHeight: 12, fontWeight: '700', textAlign: 'center', minHeight: 24 },
  stepLabelActive: { color: Colors.ink, fontWeight: '900' },
});
