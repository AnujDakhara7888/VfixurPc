import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import Toast from 'react-native-toast-message';
import { notificationsApi } from '@/api/client';
import type { Notification } from '@/types';

export default function ActivitySync({ userId, onOpen }: { userId: string; onOpen: (data: Record<string, any>) => void }) {
  const qc = useQueryClient();
  const seen = useRef<Set<string> | null>(null);
  const { data, isSuccess } = useQuery<Notification[]>({
    queryKey: ['notifications'], queryFn: notificationsApi.list, refetchInterval: 15000,
  });
  useEffect(() => { seen.current = null; }, [userId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['unread'] });
        qc.invalidateQueries({ queryKey: ['my-requests'] });
        qc.invalidateQueries({ queryKey: ['sr'] });
      }
    });
    return () => sub.remove();
  }, [qc]);
  useEffect(() => {
    if (!isSuccess || !data) return;
    const incoming = data.filter(row => !row.readAt && seen.current && !seen.current.has(row.id));
    seen.current = new Set(data.map(row => row.id));
    if (!incoming.length) return;
    qc.invalidateQueries({ queryKey: ['unread'] });
    qc.invalidateQueries({ queryKey: ['my-requests'] });
    qc.invalidateQueries({ queryKey: ['sr'] });
    // Foreground fallback only. This is not background or lock-screen push.
    if (Constants.expoConfig?.extra?.personalPreview && AppState.currentState === 'active') {
      Toast.show({ type: 'info', text1: 'New service update', text2: incoming[0].message,
        onPress: () => { Toast.hide(); onOpen(incoming[0]); }, visibilityTime: 6000 });
    }
  }, [data, isSuccess, qc, onOpen]);
  return null;
}
