import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestProgressTitle, requestStages } from '@/utils/workflow';
import { formatDateTime } from '@/utils/dateTime';
import type { ServiceRequest } from '@/types';
import { Colors } from '@/theme';

export default function RequestProgress({ request }: { request: ServiceRequest }) {
  const stages = requestStages(request);
  return <View style={s.card}><Text style={s.title}>{requestProgressTitle(request)}</Text>{stages.map((stage, index) => {
    const color = stage.state === 'complete' ? Colors.success : stage.state === 'cancelled' ? Colors.error : stage.state === 'current' ? Colors.accent : '#B8C2D0';
    return <View key={stage.label} style={s.item}><View style={s.rail}><View style={[s.dot, { backgroundColor: color }, stage.state === 'current' && s.currentDot]}>{stage.state === 'complete' ? <Ionicons name="checkmark" size={14} color="#fff" /> : <View style={s.innerDot} />}</View>{index < stages.length - 1 ? <View style={[s.line, stage.state === 'complete' && { backgroundColor: Colors.success }]} /> : null}</View><View style={s.copy}><View style={s.headingRow}><Text style={[s.label, stage.state === 'future' && s.future]}>{stage.label}</Text><Text style={s.date}>{stage.at ? formatDateTime(stage.at) : stage.state === 'future' ? 'Pending' : ''}</Text></View><Text style={s.detail}>{stage.note || stage.detail}</Text></View></View>;
  })}</View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.line, borderRadius: 8, padding: 16, marginBottom: 16 }, title: { color: Colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 14 }, item: { flexDirection: 'row', minHeight: 66 }, rail: { width: 28, alignItems: 'center' }, dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 1 }, currentDot: { borderWidth: 5, borderColor: '#CDE1FF', width: 28, height: 28, borderRadius: 14 }, innerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }, line: { position: 'absolute', top: 24, bottom: -2, width: 2, backgroundColor: '#CBD3DF' }, copy: { flex: 1, paddingLeft: 10, paddingBottom: 16 }, headingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, label: { flex: 1, color: Colors.ink, fontSize: 14, fontWeight: '800' }, future: { color: Colors.inkSecondary }, date: { color: Colors.inkTertiary, fontSize: 10.5, maxWidth: '38%', textAlign: 'right' }, detail: { color: Colors.inkSecondary, fontSize: 11.5, lineHeight: 16, marginTop: 3 },
});
