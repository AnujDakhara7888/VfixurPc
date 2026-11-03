'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerCollection({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [receivedBy, setReceivedBy] = useState('');
  const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => api.post('/service-requests/' + id + '/customer-collection', { receivedBy: receivedBy.trim() }),
    onSuccess: () => { setOpen(false); setReceivedBy(''); qc.invalidateQueries({ queryKey: ['sr', id] }); qc.invalidateQueries({ queryKey: ['service-requests'] }); qc.invalidateQueries({ queryKey: ['warranty', id] }); toast.success('Customer collection recorded'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Could not record collection') });
  return <div className="border-t border-gray-200 pt-3 mt-3">
    <button onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex justify-center items-center gap-2 py-2 px-3 bg-brand-800 text-white rounded-lg text-sm font-semibold"><PackageCheck size={18} />Collected by customer</button>
    {open && <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="mt-3 space-y-3">
      <label className="block text-sm">Received by<input required maxLength={120} value={receivedBy} onChange={e => setReceivedBy(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2" /></label>
      <button disabled={!receivedBy.trim() || mutation.isPending} className="w-full border border-brand-800 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">{mutation.isPending ? 'Recording...' : 'Confirm handover'}</button>
    </form>}
  </div>;
}
