'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface FaqNode {
  id: string;
  question: string;
  answer?: string;
  parentId?: string;
  children?: FaqNode[];
}

export default function FaqPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', parentId: '' });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: nodes, isLoading } = useQuery<FaqNode[]>({
    queryKey: ['faq'],
    queryFn: () => api.get('/faq').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/faq', { ...form, parentId: form.parentId || null }),
    onSuccess: () => { toast.success('FAQ node created'); qc.invalidateQueries({ queryKey: ['faq'] }); setShowForm(false); setForm({ question: '', answer: '', parentId: '' }); },
    onError: () => toast.error('Failed to create FAQ node'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/faq/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['faq'] }); },
    onError: () => toast.error('Failed to delete'),
  });

  const toggle = (id: string) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const renderNode = (node: FaqNode, depth = 0) => (
    <div key={node.id} className={depth > 0 ? 'ml-6 border-l-2 border-gray-100 pl-4' : ''}>
      <div className="flex items-start gap-3 py-3 group">
        <button onClick={() => toggle(node.id)} className="mt-0.5 text-gray-400">
          {node.children?.length
            ? (expanded.has(node.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
            : <span className="w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{node.question}</p>
          {node.answer && <p className="text-sm text-gray-500 mt-0.5">{node.answer}</p>}
        </div>
        <button onClick={() => deleteMutation.mutate(node.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {expanded.has(node.id) && node.children?.map((child) => renderNode(child, depth + 1))}
    </div>
  );

  const allNodes = nodes ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">FAQ</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the FAQ tree shown to customers</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition">
          <Plus className="w-4 h-4" /> Add Node
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New FAQ Node</h2>
          <div className="space-y-3">
            <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder="Question"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="Answer (leave blank for category nodes)"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
            <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Root node (no parent)</option>
              {allNodes.map((n) => <option key={n.id} value={n.id}>{n.question}</option>)}
            </select>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {createMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 px-4">
        {isLoading && <p className="text-center py-10 text-gray-400">Loading…</p>}
        {!isLoading && allNodes.length === 0 && <p className="text-center py-10 text-gray-400">No FAQ nodes yet.</p>}
        {allNodes.filter((n) => !n.parentId).map((n) => renderNode(n))}
      </div>
    </div>
  );
}
