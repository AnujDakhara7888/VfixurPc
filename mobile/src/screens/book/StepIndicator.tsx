import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, Motion } from '@/theme';

interface Props { current: number; total: number; labels?: string[] }

/**
 * Slim segmented progress bar. A single cyan fill animates across the track as
 * the user advances; the caption reads "Step X of N · <label>".
 */
export default function StepIndicator({ current, total, labels }: Props) {
  const progress = useRef(new Animated.Value((current + 1) / total)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: (current + 1) / total,
      duration: Motion.base,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width }]} />
        <View style={styles.segments} pointerEvents="none">
          {Array.from({ length: total - 1 }).map((_, i) => (
            <View key={i} style={styles.notch} />
          ))}
        </View>
      </View>
      <Text style={styles.caption}>
        Step {current + 1} of {total}
        {labels?.[current] ? <Text style={styles.captionStrong}>{`   ·   ${labels[current]}`}</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.lg, paddingTop: 4, paddingBottom: 16 },
  track: {
    height: 5, borderRadius: 3, backgroundColor: Colors.surfaceStrong, overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3, backgroundColor: Colors.accent },
  segments: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  notch: { width: 2.5, height: 5, backgroundColor: Colors.bgApp },
  caption: { fontSize: 12, fontWeight: '600', color: Colors.inkTertiary, marginTop: 11 },
  captionStrong: { color: Colors.ink, fontWeight: '800' },
});
