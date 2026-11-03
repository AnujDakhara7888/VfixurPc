import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { faqApi } from '@/api/client';
import LargeHeader from '@/components/LargeHeader';
import { Colors, Spacing, Radius } from '@/theme';
import legal from '@/content/legal.json';

interface FaqNode {
  id: string;
  question: string;
  answer?: string | null;
  parentId?: string | null;
}

type Crumb = { id: string | null; title: string };

export default function FaqScreen({ navigation }: any) {
  const [stack, setStack] = useState<Crumb[]>([{ id: null, title: 'Help & FAQ' }]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const current = stack[stack.length - 1];

  const { data, isLoading } = useQuery<FaqNode[]>({
    queryKey: ['faq', current.id],
    queryFn: () => (current.id ? faqApi.children(current.id) : faqApi.list()),
  });

  const supplied = legal.faq.map((f,i)=>({id:'supplied-'+i,question:f.question,answer:f.answer}));
  const nodes = current.id ? (Array.isArray(data)?data:[]) : [...supplied,...(Array.isArray(data)?data:[]).filter(n=>!supplied.some(s=>s.question===n.question))];

  function handlePress(node: FaqNode) {
    const hasAnswer = !!node.answer && node.answer.trim().length > 0;
    if (hasAnswer) {
      setExpandedId((prev) => (prev === node.id ? null : node.id));
    } else {
      setStack((prev) => [...prev, { id: node.id, title: node.question }]);
      setExpandedId(null);
    }
  }

  function handleBack() {
    if (stack.length > 1) {
      setStack((prev) => prev.slice(0, -1));
      setExpandedId(null);
    } else {
      navigation.goBack();
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgApp} />
      <LargeHeader
        title={current.title}
        subtitle={stack.length === 1 ? 'Answers to common questions' : undefined}
        onBack={handleBack}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : nodes.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="help-circle-outline" size={30} color={Colors.gray400} />
          </View>
          <Text style={styles.emptyTitle}>No FAQs yet</Text>
          <Text style={styles.emptySub}>Check back soon, or reach us on WhatsApp from your Profile tab.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {nodes.map((node) => {
            const isLeaf = !!node.answer && node.answer.trim().length > 0;
            const isExpanded = expandedId === node.id;
            return (
              <TouchableOpacity
                key={node.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => handlePress(node)}
              >
                <View style={styles.cardRow}>
                  <Text style={styles.question}>{node.question}</Text>
                  <Ionicons
                    name={isLeaf ? (isExpanded ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
                    size={18}
                    color={Colors.inkTertiary}
                  />
                </View>
                {isLeaf && isExpanded ? <Text style={styles.answer}>{node.answer}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, paddingBottom: 80 },
  emptyIcon:   { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: Colors.ink, letterSpacing: -0.3 },
  emptySub:    { fontSize: 14, color: Colors.inkTertiary, textAlign: 'center', marginTop: 6, lineHeight: 22 },

  list: { padding: Spacing.md, paddingBottom: 40 },
  card: { backgroundColor: Colors.bgGrouped, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  question: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.ink, lineHeight: 20 },
  answer:   { fontSize: 13.5, color: Colors.inkSecondary, lineHeight: 21, marginTop: 10 },
});
