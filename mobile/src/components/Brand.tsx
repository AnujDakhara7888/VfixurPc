import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { width: number; height: number }> = {
  sm: { width: 72, height: 53 },
  md: { width: 118, height: 87 },
  lg: { width: 230, height: 170 },
};

/** The official VfixurPC repair mark, paired with the product wordmark. */
export function BrandMark({ size = 'md' }: { size?: Size; onDark?: boolean }) {
  return <Image source={require('../../assets/brand-logo.png')} resizeMode="contain" style={SIZES[size]} />;
}

export default function Brand({
  size = 'md',
  onDark = false,
  showWord = true,
}: {
  size?: Size;
  onDark?: boolean;
  showWord?: boolean;
}) {
  void onDark;
  void showWord;
  return <View style={styles.row}><BrandMark size={size} /></View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
