import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api, getApiErrorMessage } from '@/api/client';
import { formatDateOnly, formatDateTime } from '@/utils/dateTime';
import { Colors } from '@/theme';
import Input from './Input';
import Button from './Button';

type Warranty = { coverage: { startsOn: string; endsOn: string; coverage: string } | null; active: boolean; canClaim: boolean;
  claims: { id: string; status: string; description: string; history: { status: string; note: string; at: string }[] }[] };
const labels: Record<string, string> = { REQUESTED: 'Awaiting review', IN_PROGRESS: 'In progress', DECLINED: 'Declined', RESOLVED: 'Resolved' };

export default function WarrantyPanel({ id }: { id: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const query = useQuery<Warranty>({ queryKey: ['warranty', id], queryFn: () => api.get(`/service-requests/${id}/warranty`).then(r => r.data), refetchInterval: 30000 });
  const request = useMutation({ mutationFn: () => api.post(`/service-requests/${id}/warranty/claims`, { description: description.trim() }),
    onSuccess: () => { setDescription(''); setOpen(false); setMessage('Your warranty follow-up has been received.'); qc.invalidateQueries({ queryKey: ['warranty', id] }); },
    onError: e => setMessage(getApiErrorMessage(e)) });
  if (query.isLoading) return <Text style={s.muted}>Loading warranty...</Text>;
  if (query.isError) return <TouchableOpacity onPress={() => query.refetch()}><Text style={s.error}>Could not load warranty. Retry</Text></TouchableOpacity>;
  const data = query.data;
  if (!data?.coverage && !data?.claims.length) return null;
  return <View style={s.section}>
    <View style={s.heading}><Ionicons name="shield-checkmark-outline" size={22} color={Colors.ink} /><Text style={s.title}>Repair warranty</Text></View>
    {data.coverage && <>
      <Text style={s.status}>{data.active ? 'Active coverage' : 'Outside coverage dates'}</Text>
      <Text style={s.text}>{formatDateOnly(data.coverage.startsOn)} - {formatDateOnly(data.coverage.endsOn)}</Text>
      <Text style={s.text}>{data.coverage.coverage}</Text>
    </>}
    {!!message && <Text accessibilityRole="alert" style={s.text}>{message}</Text>}
    {data.canClaim && !open && <Button label="Request warranty follow-up" onPress={() => { setMessage(''); setOpen(true); }} variant="outline" />}
    {data.canClaim && open && <View>
      <Input label="What issue has returned?" value={description} onChangeText={setDescription} multiline maxLength={2000} />
      <Button label="Submit follow-up" disabled={description.trim().length < 10} loading={request.isPending} onPress={() => request.mutate()} />
      <TouchableOpacity onPress={() => setOpen(false)} style={s.cancel}><Text style={s.text}>Cancel</Text></TouchableOpacity>
    </View>}
    {data.claims.map(claim => <View key={claim.id} style={s.claim}>
      <Text style={s.status}>{labels[claim.status]}</Text>
      <Text style={s.text}>{claim.description}</Text>
      {claim.history.map((event, index) => <View key={index} style={s.event}><Text style={s.status}>{labels[event.status]}</Text><Text style={s.text}>{event.note}</Text><Text style={s.muted}>{formatDateTime(event.at)}</Text></View>)}
    </View>)}
  </View>;
}
const s = StyleSheet.create({
  section: { borderTopWidth: 1, borderTopColor: Colors.line, paddingVertical: 20, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.ink },
  text: { fontSize: 14, lineHeight: 21, color: Colors.ink },
  status: { fontSize: 14, fontWeight: '600', color: Colors.ink },
  muted: { fontSize: 12, color: Colors.inkSecondary },
  error: { fontSize: 14, color: Colors.error, paddingVertical: 12 },
  claim: { borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 16, gap: 8 },
  event: { borderLeftWidth: 2, borderLeftColor: Colors.line, paddingLeft: 12, gap: 4, marginTop: 8 },
  cancel: { paddingVertical: 12, alignItems: 'center' },
});
