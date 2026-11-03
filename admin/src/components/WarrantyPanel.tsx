'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateOnly, formatDateTime } from '@/lib/dateTime';
import { ShieldCheck, Save } from 'lucide-react';
import toast from 'react-hot-toast';

type Coverage = { startsOn: string; endsOn: string; coverage: string };
type Claim = { id: string; description: string; status: string; createdAt: string; coverageSnapshot: Coverage; history: { status: string; note: string; at: string }[] };
type Warranty = { coverage: Coverage | null; claims: Claim[]; active: boolean; canClaim: boolean };
const labels: Record<string, string> = { REQUESTED: 'Awaiting review', IN_PROGRESS: 'In progress', DECLINED: 'Declined', RESOLVED: 'Resolved' };
const input = 'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100';
const dateISO = (text: string) => text.trim().split('/').reverse().join('-');

function ReviewClaim({ id, claim }: { id: string; claim: Claim }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState(claim.status === 'REQUESTED' ? 'IN_PROGRESS' : 'RESOLVED');
  const [note, setNote] = useState('');
  const update = useMutation({ mutationFn: () => api.patch(`/service-requests/${id}/warranty/claims/${claim.id}`, { status, note: note.trim() }),
    onSuccess: () => { setNote(''); qc.invalidateQueries({ queryKey: ['warranty', id] }); toast.success('Warranty follow-up updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Could not update warranty follow-up') });
  if (!['REQUESTED', 'IN_PROGRESS'].includes(claim.status)) return null;
  return <form className="mt-3 grid gap-3" onSubmit={e => { e.preventDefault(); update.mutate(); }}>
    <label className="text-sm">Decision<select value={status} onChange={e => setStatus(e.target.value)} className={input}>{(claim.status === 'REQUESTED' ? ['IN_PROGRESS', 'DECLINED'] : ['RESOLVED']).map(s => <option key={s} value={s}>{s === 'IN_PROGRESS' ? 'Accept for follow-up' : labels[s]}</option>)}</select></label>
    <label className="text-sm">Update for customer<textarea required minLength={5} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} rows={3} className={input} /></label>
    <button disabled={update.isPending || note.trim().length < 5} className="flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{update.isPending ? 'Saving...' : 'Save update'}</button>
  </form>;
}

export default function WarrantyPanel({ id, canManage, canIssue }: { id: string; canManage: boolean; canIssue: boolean }) {
  const qc = useQueryClient();
  const query = useQuery<Warranty>({ queryKey: ['warranty', id], queryFn: () => api.get(`/service-requests/${id}/warranty`).then(r => r.data), refetchInterval: 30000 });
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [coverage, setCoverage] = useState('');
  const save = useMutation({ mutationFn: () => api.put(`/service-requests/${id}/warranty`, { startsOn: dateISO(start), endsOn: dateISO(end), coverage: coverage.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warranty', id] }); setEditing(false); toast.success('Warranty saved'); },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Could not save warranty') });
  if (query.isLoading) return <p className="text-sm text-gray-500">Loading warranty...</p>;
  if (query.isError) return <button onClick={() => query.refetch()} className="text-sm text-red-700">Could not load warranty. Retry</button>;
  const data = query.data!;
  const current = data.coverage;
  return <section className="border-t border-gray-200 py-5 min-w-0">
    <h2 className="flex items-center gap-2 text-base font-bold"><ShieldCheck size={20} />Repair warranty</h2>
    {current ? <div className="mt-3 space-y-2 text-sm">
      <p className="font-semibold">{formatDateOnly(current.startsOn)} - {formatDateOnly(current.endsOn)} <span className="text-gray-500">({data.active ? 'Active' : 'Outside coverage dates'})</span></p>
      <p className="whitespace-pre-wrap break-words">{current.coverage}</p>
    </div> : <p className="mt-3 text-sm text-gray-500">No warranty issued for this repair.</p>}
    {canManage && canIssue && !editing && <button onClick={() => { setStart(current ? formatDateOnly(current.startsOn) : formatDateOnly(new Date().toISOString())); setEnd(current ? formatDateOnly(current.endsOn) : ''); setCoverage(current?.coverage ?? ''); setEditing(true); }} className="mt-3 flex items-center gap-2 text-sm font-semibold text-brand-800"><ShieldCheck size={16} />{current ? 'Extend warranty' : 'Add warranty'}</button>}
    {editing && <form onSubmit={e => { e.preventDefault(); save.mutate(); }} className="mt-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-sm">Starts on<input required pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" placeholder="dd/mm/yyyy" value={start} disabled={!!current} onChange={e => setStart(e.target.value)} className={input} /></label>
        <label className="text-sm">Covered through<input required pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" placeholder="dd/mm/yyyy" value={end} onChange={e => setEnd(e.target.value)} className={input} /></label>
      </div>
      <label className="block text-sm">Coverage and exclusions<textarea required minLength={5} maxLength={4000} rows={4} disabled={!!current} value={coverage} onChange={e => setCoverage(e.target.value)} className={input} /></label>
      <div className="flex gap-3"><button disabled={save.isPending} className="flex items-center gap-2 bg-brand-800 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"><Save size={16} />{save.isPending ? 'Saving...' : 'Issue warranty'}</button><button type="button" onClick={() => setEditing(false)} className="text-sm">Cancel</button></div>
    </form>}
    {data.claims.length > 0 && <h3 className="mt-6 font-semibold">Warranty follow-ups</h3>}
    {data.claims.map(claim => <article key={claim.id} className="border-b border-gray-200 py-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{labels[claim.status]}</strong><span className="text-gray-500">{formatDateTime(claim.createdAt)}</span></div>
      <p className="mt-2 text-sm whitespace-pre-wrap break-words">{claim.description}</p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer text-gray-600">Coverage at request</summary><p className="mt-1">{formatDateOnly(claim.coverageSnapshot.startsOn)} - {formatDateOnly(claim.coverageSnapshot.endsOn)}</p><p className="whitespace-pre-wrap">{claim.coverageSnapshot.coverage}</p></details>
      <ol className="mt-3 space-y-2">{claim.history.map((event, index) => <li key={index} className="text-sm border-l-2 border-gray-200 pl-3"><p className="font-semibold">{labels[event.status]} <span className="font-normal text-gray-500">{formatDateTime(event.at)}</span></p><p className="whitespace-pre-wrap break-words">{event.note}</p></li>)}</ol>
      {canManage && <ReviewClaim key={claim.id + claim.status} id={id} claim={claim} />}
    </article>)}
  </section>;
}
