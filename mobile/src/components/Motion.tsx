import React, { useEffect, useRef } from 'react';
import {
  Animated, Pressable, ViewStyle, StyleProp, PressableProps, View,
} from 'react-native';
import { Motion } from '@/theme';

/**
 * PressableScale — a touch target that subtly scales/dims on press.
 * Gives every interactive surface a consistent, tactile, premium response.
 */
export function PressableScale({
  children, style, onPress, disabled, scaleTo = Motion.pressScale, hitSlop, ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  return (
    <Pressable
      onPressIn={() => !disabled && animate(scaleTo)}
      onPressOut={() => animate(1)}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * FadeIn — soft entrance (fade + small rise). `delay` lets you stagger a list.
 */
export function FadeIn({
  children, delay = 0, distance = 12, style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: Motion.slow,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Tiny spacer for readable layout code. */
export function Gap({ h = 0, w = 0 }: { h?: number; w?: number }) {
  return <View style={{ height: h, width: w }} />;
}
