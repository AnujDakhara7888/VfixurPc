import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const VISUALS: Record<string, { icon: IconName; accent: string; soft: string; detail?: IconName }> = {
  desktop: { icon: 'desktop-outline', accent: '#0756B6', soft: '#E5F0FF', detail: 'hardware-chip-outline' },
  data: { icon: 'server-outline', accent: '#7146D8', soft: '#F0EAFE', detail: 'document-text-outline' },
  upgrade: { icon: 'hardware-chip-outline', accent: '#E88D00', soft: '#FFF1D8', detail: 'arrow-up-circle' },
  virus: { icon: 'shield-checkmark-outline', accent: '#159A68', soft: '#E4F6ED', detail: 'sparkles' },
  cctv: { icon: 'videocam-outline', accent: '#DA376D', soft: '#FDE8EF', detail: 'eye-outline' },
  network: { icon: 'wifi-outline', accent: '#007CA8', soft: '#E2F5FB', detail: 'git-network-outline' },
  backup: { icon: 'cloud-upload-outline', accent: '#3769C8', soft: '#E7EFFF', detail: 'server-outline' },
  custom: { icon: 'desktop-outline', accent: '#B43D87', soft: '#F9E8F3', detail: 'construct-outline' },
  business: { icon: 'briefcase-outline', accent: '#236B58', soft: '#E5F5EF', detail: 'shield-checkmark-outline' },
};

export default function ServiceArtwork({ category, size = 56 }: { category?: string; size?: number }) {
  if (category === 'laptop') {
    return (
      <View style={[styles.frame, { width: size, height: size, backgroundColor: '#EAF3FF' }]}>
        <Image source={require('../../assets/device-laptop.png')} resizeMode="contain" style={{ width: size - 5, height: size - 5 }} />
      </View>
    );
  }
  if (category === 'mac') {
    return (
      <View style={[styles.frame, styles.macFrame, { width: size, height: size }]}>
        <View style={[styles.macHalo, { width: size * .72, height: size * .72 }]}><Ionicons name="logo-apple" size={Math.round(size * .48)} color="#0756B6" /></View>
        <View style={styles.macBadge}><Ionicons name="sparkles" size={Math.round(size * .17)} color="#fff" /></View>
      </View>
    );
  }
  const visual = VISUALS[category ?? ''] ?? { icon: 'construct-outline' as IconName, accent: Colors.accent, soft: Colors.brandSoft, detail: 'sparkles' as IconName };
  return (
    <View style={[styles.frame, { width: size, height: size, backgroundColor: visual.soft }]}>
      <View style={[styles.platform, { width: size * .68, height: size * .5, borderColor: visual.accent }]}>
        <Ionicons name={visual.icon} size={Math.round(size * .39)} color={visual.accent} />
      </View>
      {visual.detail ? <View style={[styles.detail, { backgroundColor: visual.accent, right: size * .06, bottom: size * .06 }]}><Ionicons name={visual.detail} size={Math.round(size * .19)} color="#fff" /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  platform: { borderWidth: 1.5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.78)', alignItems: 'center', justifyContent: 'center' },
  detail: { position: 'absolute', width: '35%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  macFrame: { backgroundColor: '#E8F2FF' },
  macHalo: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,.88)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C9DDF8' },
  macBadge: { position: 'absolute', right: 2, bottom: 2, width: '34%', aspectRatio: 1, borderRadius: 999, backgroundColor: '#1477E8', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
});
