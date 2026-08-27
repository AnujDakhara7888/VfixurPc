import React from 'react';
import { Text, ActivityIndicator, StyleSheet, ViewStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Gradients, Shadow } from '@/theme';
import { PressableScale } from '@/components/Motion';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'brand' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const PAD: Record<string, { v: number; h: number; f: number }> = {
  sm: { v: 12, h: 20, f: 14 },
  md: { v: 16, h: 24, f: 16 },
  lg: { v: 18, h: 32, f: 17 },
};

export default function Button({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, fullWidth = true, style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const p = PAD[size];
  const gradient = variant === 'primary' || variant === 'brand' || variant === 'danger';

  const gradColors =
    variant === 'brand'  ? Gradients.brand :
    variant === 'danger' ? (['#FF6A60', '#FF453A'] as const) :
    Gradients.ink;

  const textColor =
    variant === 'outline' ? Colors.ink :
    variant === 'ghost'   ? Colors.accentInk :
    variant === 'brand'   ? Colors.brandDeep :
    Colors.white;

  const container: ViewStyle[] = [
    styles.base,
    { paddingVertical: p.v, paddingHorizontal: p.h },
    fullWidth && styles.fullWidth,
    variant === 'outline' && styles.outline,
    variant === 'ghost' && styles.ghost,
    !isDisabled && variant === 'brand' && Shadow.brand,
    !isDisabled && variant === 'primary' && Shadow.sm,
    isDisabled && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const inner = (
    <Text style={[styles.text, { fontSize: p.f, color: textColor }]}>{label}</Text>
  );

  if (gradient) {
    return (
      <PressableScale onPress={onPress} disabled={isDisabled} style={[fullWidth && styles.fullWidth, style]}>
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            { paddingVertical: p.v, paddingHorizontal: p.h },
            !isDisabled && variant === 'brand' && Shadow.brand,
            !isDisabled && variant !== 'brand' && Shadow.sm,
            isDisabled && styles.disabled,
          ].filter(Boolean) as ViewStyle[]}
        >
          {loading ? <ActivityIndicator color={textColor} size="small" /> : inner}
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale onPress={onPress} disabled={isDisabled} style={container}>
      <View style={styles.center}>
        {loading ? <ActivityIndicator color={Colors.ink} size="small" /> : inner}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  outline: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.lineStrong },
  ghost: { backgroundColor: 'transparent' },
  text: { fontWeight: '700', letterSpacing: -0.2 },
  disabled: { opacity: 0.45 },
});
