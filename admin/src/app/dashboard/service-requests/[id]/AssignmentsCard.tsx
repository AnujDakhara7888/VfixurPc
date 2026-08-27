'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryApi, usersApi } from '@/lib/api';
import type { User } from '@/types';
import AuthImage from '@/components/AuthImage';
import toast from 'react-hot-toast';
import { Truck, Package, Camera, CircleCheckBig, Clock } from 'lucide-react';

interface Photo { id: string; type: 'PICKUP' | 'WAREHOUSE' | 'DELIVERY'; }
interface Assignment {
  id: string; type: 'PICKUP' | 'DELIVERY'; status: string;
  scheduledDate: string; scheduledSlot: string;
  agent?: { id: string; name: string; phone: string } | null;
  photos: Photo[];
}

const PHOTO_LABEL: Record<string, string> = { PICKUP: 'Pickup proof', WAREHOUSE: 'Warehouse intake', DELIVERY: 'Delivery proof' };

export default function AssignmentsCard({ srId, defaultDate, defaultSlot }: { srId: string; defaultDate?: string; defaultSlot?: string }) {
  const qc = useQueryClient();
  const { data: assignments } = useQuery<Assignment[]>({
    queryKey: ['assignments', srId],
    queryFn: () => deliveryApi.listForSr(srId),
  });
  const { data: techData } = useQuery({
    queryKey: ['users', 'TECHNICIAN'],
    queryFn: () => usersApi.list({ role: 'TECHNICIAN', limit: 100 }),
  });
  const techs: User[] = techData?.data ?? techData ?? [];

  const pickup = assignments?.find((a) => a.type === 'PICKUP');
  const delivery = assignments?.find((a) => a.type === 'DELIVERY');

  return (
    <div className="card p-6">
      <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Pickup &amp; Delivery</h2>
      <div className="space-y-4">
        <Leg type="PICKUP" icon={Package} title="Pickup — from customer" assignment={pickup} techs={techs}
          srId={srId} defaultDate={defaultDate} defaultSlot={defaultSlot} onChange={() => qc.invalidateQueries({ queryKey: ['assignments', srId] })} />
        <Leg type="DELIVERY" icon={Truck} title="Delivery — back to customer" assignment={delivery} techs={techs}
          srId={srId} defaultDate={defaultDate} defaultSlot={defaultSlot} onChange={() => qc.invalidateQueries({ queryKey: ['assignments', srId] })} />
      </div>
    </div>
  );
}

function Leg({ type, icon: Icon, title, assignment, techs, srId, defaultDate, defaultSlot, onChange }: {
  type: 'PICKUP' | 'DELIVERY'; icon: React.ElementType; title: string;
  assignment?: Assignment; techs: User[]; srId: string; defaultDate?: string; defaultSlot?: string; onChange: () => void;
}) {
  const [agentId, setAgentId] = useState('');
  const [date, setDate] = useState(defaultDate ?? '');
  const [slot, setSlot] = useState(defaultSlot ?? '');

  const assign = useMutation({
    mutationFn: () => deliveryApi.create({ serviceRequestId: srId, agentId, type, scheduledDate: date, scheduledSlot: slot }),
    onSuccess: () => { toast.success(`${title.split(' ')[0]} technician assigned`); onChange(); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to assign'),
  });

  const done = assignment?.status === 'COMPLETED';

  return (
    <div className="border border-gray-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center"><Icon className="w-4 h-4 text-accent-ink" /></span>
        <p className="text-sm font-bold text-ink">{title}</p>
        {assignment && (
          <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {done ? <CircleCheckBig className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{assignment.status}
          </span>
        )}
      </div>

      {assignment ? (
        <div>
          <p className="text-sm text-ink-soft">
            <span className="font-semibold text-ink">{assignment.agent?.name ?? 'Technician'}</span>
            {assignment.agent?.phone ? ` · ${assignment.agent.phone}` : ''}
          </p>
          <p className="text-xs text-ink-faint mt-0.5">{assignment.scheduledDate} · {assignment.scheduledSlot}</p>
          {assignment.photos?.length > 0 ? (
            <div className="flex flex-wrap gap-3 mt-3">
              {assignment.photos.map((p) => (
                <div key={p.id} className="text-center">
                  <AuthImage photoId={p.id} className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
                  <p className="text-[10px] text-ink-faint mt-1 font-semibold">{PHOTO_LABEL[p.type]}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-ink-faint mt-2"><Camera className="w-3.5 h-3.5" /> Awaiting proof photos from the technician.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-5">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Technician</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent">
              <option value="">Select…</option>
              {techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Slot</label>
            <input value={slot} placeholder="AM" onChange={(e) => setSlot(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" />
          </div>
          <div className="col-span-2">
            <button onClick={() => { if (!agentId || !date) { toast.error('Pick technician & date'); return; } assign.mutate(); }}
              disabled={assign.isPending}
              className="w-full py-2 bg-brand-800 hover:bg-brand-900 text-white text-sm font-bold rounded-lg disabled:opacity-50">
              Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
