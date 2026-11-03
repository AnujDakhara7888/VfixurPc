import React from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadow } from '@/theme';

import { openGoogleReviewComposer, openGoogleReviews } from '@/utils/googleReviews';

export default function GoogleReviewCard() {
  const reveal = React.useRef(new Animated.Value(0)).current;
  const glow = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reduced) { reveal.setValue(1); return; }
      Animated.sequence([
        Animated.spring(reveal, { toValue: 1, damping: 12, stiffness: 120, useNativeDriver: true }),
        Animated.loop(Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]), { iterations: 2 }),
      ]).start();
    });
  }, [glow, reveal]);

  return <Animated.View style={[s.card, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [.97, 1] }) }] }]}>
    <Animated.View style={[s.icon, { transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) }] }]}><Ionicons name="star" size={24} color="#F7B500" /></Animated.View>
    <View style={s.copy}><Text style={s.title}>How did we do?</Text><Text style={s.body}>Your honest Google review helps local customers choose VfixurPC with confidence.</Text></View>
    <TouchableOpacity accessibilityRole="link" style={s.button} onPress={() => openGoogleReviewComposer()}><Ionicons name="logo-google" size={17} color={Colors.white} /><Text style={s.buttonText}>Write a review</Text></TouchableOpacity>
    <TouchableOpacity accessibilityRole="link" onPress={() => openGoogleReviews()}><Text style={s.link}>See current Google reviews</Text></TouchableOpacity>
  </Animated.View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 18, alignItems: 'center', marginBottom: 16, ...Shadow.sm },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF7D8', marginBottom: 10 },
  copy: { alignItems: 'center', maxWidth: 310 },
  title: { color: Colors.ink, fontSize: 19, fontWeight: '900' },
  body: { color: Colors.inkSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  button: { minHeight: 46, alignSelf: 'stretch', marginTop: 15, borderRadius: 8, backgroundColor: Colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  link: { color: Colors.accentInk, fontWeight: '700', fontSize: 12, paddingTop: 13, paddingBottom: 2 },
});
