'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slotsApi } from '@/lib/api';
import type { PickupSlot } from '@/types';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil, Wand2 } from 'lucide-react';

export default function PickupSlotsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', startTime: '', endTime: '' });

  const { data: slots, isLoading } = useQuery<PickupSlot[]>({
    queryKey: ['slots'],
    queryFn: slotsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: () => slotsApi.create(form),
    onSuccess: () => { toast.success('Slot created'); qc.invalidateQueries({ queryKey: ['slots'] }); setShowForm(false); setForm({ label: '', startTime: '', endTime: '' }); },
    onError: () => toast.error('Failed to create slot'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<PickupSlot>) => slotsApi.update(id, body),
    onSuccess: () => { toast.success('Slot updated'); qc.invalidateQueries({ queryKey: ['slots'] }); setEditId(null); },
    onError: () => toast.error('Failed to update slot'),
  });

  const deleteMutation = useMutation({
    mutationFn: slotsApi.delete,
    onSuccess: () => { toast.success('Slot deleted'); qc.invalidateQueries({ queryKey: ['slots'] }); },
    onError: () => toast.error('Failed to delete slot'),
  });

  const generateMutation = useMutation({
    mutationFn: slotsApi.generate,
    onSuccess: () => { toast.success('30-minute slots generated (9 AM – 9 PM)'); qc.invalidateQueries({ queryKey: ['slots'] }); },
    onError: () => toast.error('Failed to generate slots'),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pickup Slots</h1>
          <p className="text-sm text-gray-500 mt-1">Customers choose one of these windows when booking a pickup.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (confirm('Replace all slots with 30-minute windows from 9 AM to 9 PM?')) generateMutation.mutate(); }}
            disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent-grad text-brand-900 text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50 shadow-glow transition"
          >
            <Wand2 className="w-4 h-4" /> {generateMutation.isPending ? 'Generating…' : 'Generate 30-min slots'}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-800 text-white text-sm font-bold rounded-xl hover:bg-brand-900 transition"
          >
            <Plus className="w-4 h-4" /> New slot
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Pickup Slot</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Morning (9am–12pm)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
              {createMutation.isPending ? 'Creating…' : 'Create Slot'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p className="text-gray-400 col-span-3 text-center py-10">Loading…</p>}
        {slots?.map((slot) => (
          <div key={slot.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {editId === slot.id ? (
              <div className="space-y-3">
                <input defaultValue={slot.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <div className="flex gap-2">
                  <input type="time" defaultValue={slot.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <input type="time" defaultValue={slot.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateMutation.mutate({ id: slot.id, ...form })}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700">Save</button>
                  <button onClick={() => setEditId(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{slot.label}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{slot.startTime} – {slot.endTime}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${slot.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {slot.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => { setEditId(slot.id); setForm({ label: slot.label, startTime: slot.startTime, endTime: slot.endTime }); }}
                    className="text-gray-400 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => updateMutation.mutate({ id: slot.id, isActive: !slot.isActive })}
                    className="text-xs text-gray-500 hover:text-gray-800 underline">
                    {slot.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => deleteMutation.mutate(slot.id)}
                    className="text-gray-400 hover:text-red-500 ml-auto"><Trash2 className="w-4 h-4" /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
