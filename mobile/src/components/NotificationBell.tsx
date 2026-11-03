import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '@/api/client';
import { Colors } from '@/theme';
export default function NotificationBell() {
  const navigation = useNavigation<any>();
  const { data } = useQuery({ queryKey: ['unread'], queryFn: notificationsApi.unread, refetchInterval: 15000 });
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Notifications${data?.count ? ', ' + data.count + ' unread' : ''}`} onPress={() => navigation.navigate('Notifications')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="notifications-outline" size={24} color={Colors.ink} />
    {!!data?.count && <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#dc2626', borderRadius: 10, minWidth: 18, padding: 2 }}><Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{data.count > 99 ? '99+' : data.count}</Text></View>}
  </TouchableOpacity>;
}
