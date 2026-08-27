import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  dark?: boolean;
}

export default function ScreenHeader({ title, subtitle, onBack, rightElement, style, dark }: ScreenHeaderProps) {
  const textColor = dark ? Colors.white : Colors.gray900;
  const subColor  = dark ? 'rgba(255,255,255,0.7)' : Colors.gray500;
  return (
    <View style={[styles.header, dark && styles.headerDark, style]}>
      <View style={styles.left}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backBtn, dark && styles.backBtnDark]}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color={dark ? Colors.white : Colors.gray800} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.center}>
        <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subColor }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.line,
    minHeight: 56,
  },
  headerDark: { backgroundColor: Colors.brandNavy, borderBottomColor: 'transparent' },
  left:  { width: 44, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 44, alignItems: 'flex-end' },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  backBtnDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
  title: { ...Typography.h4 },
  subtitle: { fontSize: 11, marginTop: 1 },
});
