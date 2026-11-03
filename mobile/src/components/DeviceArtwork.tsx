import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import ServiceArtwork from './ServiceArtwork';

export default function DeviceArtwork({ category, size = 76 }: { category?: string; size?: number }) {
  const isComputer = ['laptop', 'mac'].includes(category ?? '');
  return (
    <View style={[s.frame, { width: size, height: size }]}>
      {isComputer ? (
        <Image source={require('../../assets/device-laptop.png')} resizeMode="contain" style={{ width: size - 8, height: size - 8 }} />
      ) : <ServiceArtwork category={category} size={size - 4} />}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { borderRadius: 8, backgroundColor: '#F4F8FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
