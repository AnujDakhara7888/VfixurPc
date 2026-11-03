import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { Colors } from '@/theme';

type Suggestion = { id: string; title: string; subtitle: string; address: string };
export default function AddressInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  const [manual, setManual] = useState(false);
  const [selected, setSelected] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const input = value.trim();
    setSuggestions([]);
    setState('idle');
    if (manual || !focused || input.length < 3 || value === selected) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState('loading');
      try {
        const { data } = await api.post('/places/autocomplete', { input }, { signal: controller.signal, timeout: 8000 });
        if (generation.current !== current || controller.signal.aborted) return;
        setSuggestions(data.suggestions);
        setState(data.suggestions.length ? 'idle' : 'empty');
      } catch {
        if (generation.current === current && !controller.signal.aborted) setState('error');
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, selected, focused, manual]);
  return <View style={s.wrap}>
    <Text style={s.label}>{label}</Text>
    <View style={[s.field, focused && s.focused]}>
      <Ionicons name="location-outline" size={21} color={Colors.accentInk} />
      <TextInput accessibilityLabel={label} value={value} onChangeText={text => { ++generation.current; setSuggestions([]); setState('idle'); setSelected(''); onChangeText(text); }}
        onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); const trimmed = value.trim(); if (trimmed) onChangeText(trimmed.charAt(0).toUpperCase() + trimmed.slice(1)); }}
        placeholder={manual ? 'Building, street, landmark and pincode' : 'Building, street or area'} placeholderTextColor={Colors.gray400}
        style={s.input} multiline maxLength={200} autoCorrect={false} />
      {state === 'loading' && <ActivityIndicator size="small" color={Colors.accentInk} accessibilityLabel="Searching addresses" />}
    </View>
    <TouchableOpacity accessibilityRole="button" onPress={() => { ++generation.current; setManual(!manual); setSuggestions([]); setState('idle'); }} style={s.modeButton}>
      <Text style={s.link}>{manual ? 'Search addresses' : 'Enter manually'}</Text>
    </TouchableOpacity>
    {!!suggestions.length && focused && <View style={s.results}>
      {suggestions.map(item => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={item.address}
        style={s.result} onPress={() => { ++generation.current; setSelected(item.address); onChangeText(item.address); setSuggestions([]); setState('idle'); }}>
        <Ionicons name="location-outline" size={18} color={Colors.inkSecondary} />
        <View style={s.resultText}><Text style={s.title}>{item.title}</Text>{!!item.subtitle && <Text style={s.subtitle}>{item.subtitle}</Text>}</View>
      </TouchableOpacity>)}
      <View style={s.attribution}>
        <Text style={s.google}>Google Maps</Text>
        <View style={s.links}>
          <TouchableOpacity onPress={() => Linking.openURL('https://maps.google.com/help/terms_maps/')}><Text style={s.link}>Terms</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL('https://policies.google.com/privacy')}><Text style={s.link}>Privacy</Text></TouchableOpacity>
        </View>
      </View>
    </View>}
    {focused && state === 'error' && <Text style={s.hint}>Suggestions unavailable. You can enter the complete address manually.</Text>}
    {focused && state === 'empty' && <Text style={s.hint}>No matching addresses. Try a nearby street or enter your address manually.</Text>}
  </View>;
}
const s = StyleSheet.create({
  wrap: { marginBottom: 16 }, label: { fontSize: 13, fontWeight: '700', color: Colors.inkSecondary, marginBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.lineStrong, borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#F4F7F9' },
  focused: { borderColor: Colors.accent, backgroundColor: '#fff' }, input: { flex: 1, minHeight: 54, paddingVertical: 14, fontSize: 15, color: Colors.ink },
  results: { borderWidth: 1, borderColor: Colors.line, borderRadius: 8, marginTop: 6, backgroundColor: '#fff', overflow: 'hidden' },
  result: { flexDirection: 'row', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.line, alignItems: 'center' },
  resultText: { flex: 1 }, title: { fontSize: 14, fontWeight: '600', color: Colors.ink }, subtitle: { fontSize: 12, lineHeight: 18, color: Colors.inkSecondary, marginTop: 3 },
  attribution: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  google: { fontSize: 12, fontWeight: '400', color: '#5E5E5E', letterSpacing: 0 }, links: { flexDirection: 'row', gap: 14 },
  link: { color: Colors.accentInk, fontSize: 12 }, hint: { marginTop: 8, fontSize: 12, lineHeight: 18, color: Colors.inkSecondary },
  modeButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingLeft: 16 },
});
