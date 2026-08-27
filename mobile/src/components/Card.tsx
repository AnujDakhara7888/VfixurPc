import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Shadow } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
  style?: ViewStyle;
  radius?: number;
  bordered?: boolean;
}

export default function Card({
  children, shadow = 'sm', padding = 16, style, radius, bordered = true,
}: CardProps) {
  const shadowStyle = shadow !== 'none' ? Shadow[shadow] : {};
  return (
    <View
      style={[
        styles.card,
        shadowStyle,
        bordered && styles.bordered,
        { padding, borderRadius: radius ?? Radius.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, overflow: 'hidden' },
  bordered: { borderWidth: 1, borderColor: Colors.line },
});
