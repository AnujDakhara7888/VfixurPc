import React from "react";
import { FlatList, Text, View, StyleSheet } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import LargeHeader from "@/components/LargeHeader";
import legal from "@/content/legal.json";
import { Colors } from '@/theme';
export default function LegalScreen({ navigation, route }: any) {
  const kind: "terms" | "privacy" =
    route.params?.kind === "terms" ? "terms" : "privacy";
  return (
    <View style={styles.root}>
      <LargeHeader
        title={kind === "terms" ? "Terms of Service" : "Privacy Policy"}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={legal[kind]}
        keyExtractor={(_, index) => String(index)}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        ListHeaderComponent={<View style={styles.hero}><View style={styles.heroIcon}><Ionicons name={kind === 'terms' ? 'document-text-outline' : 'lock-closed-outline'} size={25} color={Colors.accentInk} /></View><View style={{ flex: 1 }}><Text style={styles.heroTitle}>{kind === 'terms' ? 'Clear service terms' : 'Your data, handled carefully'}</Text><Text style={styles.heroCopy}>{kind === 'terms' ? 'What to expect before, during and after a service.' : 'How information is collected, used and protected.'}</Text></View></View>}
        renderItem={({ item: p, index: i }) => {
          const heading = /^\d+\.\d+/.test(p);
          const effective = /^Effective Date:/i.test(p);
          return <View style={[styles.readingItem, i === 0 && styles.readingItemFirst, i === legal[kind].length - 1 && styles.readingItemLast]}>{heading ? <View style={styles.headingRow}><View style={styles.headingIcon}><Ionicons name="checkmark" size={14} color="#fff" /></View><Text style={styles.heading}>{p}</Text></View> : effective ? <View style={styles.effective}><Ionicons name="calendar-outline" size={16} color={Colors.accentInk} /><Text style={styles.effectiveText}>{p}</Text></View> : <Text style={styles.paragraph}>{p}</Text>}</View>;
        }}
        ListFooterComponent={<View style={styles.supportNote}><Ionicons name="help-circle-outline" size={20} color={Colors.accentInk} /><Text style={styles.supportText}>Questions about this policy? Contact VfixurPC support from your Profile.</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: Colors.bgApp }, scroll: { flex: 1, minHeight: 0 }, content: { padding: 18, paddingBottom: 120 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.brandNavy, borderRadius: 8, padding: 16, marginBottom: 14 }, heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: Colors.white, fontSize: 17, fontWeight: '800' }, heroCopy: { color: '#BCD0E7', fontSize: 12, lineHeight: 17, marginTop: 3 },
  readingItem: { backgroundColor: Colors.white, borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.line, paddingHorizontal: 16 }, readingItemFirst: { borderTopWidth: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8, paddingTop: 16 }, readingItemLast: { borderBottomWidth: 1, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingBottom: 12 }, effective: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: Colors.brandSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginBottom: 16 }, effectiveText: { color: Colors.accentInk, fontSize: 11.5, fontWeight: '700' },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderTopWidth: 1, borderTopColor: Colors.line, paddingTop: 18, marginTop: 8, marginBottom: 10 }, headingIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' }, heading: { flex: 1, color: Colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  paragraph: { color: Colors.inkSecondary, fontSize: 13.5, lineHeight: 21, marginBottom: 12 }, supportNote: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, backgroundColor: Colors.brandSoft, borderRadius: 8, padding: 13 }, supportText: { flex: 1, color: Colors.accentInk, fontSize: 12, lineHeight: 17, fontWeight: '600' },
});
