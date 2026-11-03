'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryApi, usersApi } from '@/lib/api';
import toast from 'react-hot-toast';

type Plan = { id: string; direction: 'PICKUP' | 'RETURN'; status: 'PLANNED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'; version: number; agentId?: string | null; scheduledDate?: string | null; scheduledSlot?: string | null; receivedBy?: string | null };
export default function BookingTransport({ bookingId, requestIds, defaultDate, defaultSlot }: { bookingId: string; requestIds: string[]; defaultDate?: string; defaultSlot?: string }) {
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState('');
  const [date, setDate] = useState(defaultDate ?? '');
  const [slot, setSlot] = useState(defaultSlot ?? '');
  const [receivedBy, setReceivedBy] = useState('');
  const plans = useQuery<Plan[]>({ queryKey: ['booking-transport', bookingId], queryFn: () => deliveryApi.bookingPlans(bookingId) });
  const agents = useQuery<any>({ queryKey: ['field-staff'], queryFn: () => usersApi.list({ limit: 100 }) });
  const staff = useMemo(() => {
    const rows = Array.isArray(agents.data) ? agents.data : agents.data?.data ?? [];
    return rows.filter((u: any) => u.isActive !== false && ['DELIVERY_AGENT', 'TECHNICIAN'].includes(u.role));
  }, [agents.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['booking-transport', bookingId] }); qc.invalidateQueries({ queryKey: ['sr'] }); };
  const action = useMutation({ mutationFn: async ({ kind, plan }: { kind: string; plan: Plan }) => {
    if (kind === 'assign') return deliveryApi.assignBookingPlan(plan.id, { expectedVersion: plan.version, agentId, scheduledDate: date, scheduledSlot: slot });
    if (kind === 'complete') return deliveryApi.completeBookingPlan(plan.id, { expectedVersion: plan.version, receivedBy, confirmedRequestIds: requestIds });
    return deliveryApi.cancelBookingPlan(plan.id, { expectedVersion: plan.version, reason: receivedBy });
  }, onSuccess: () => { toast.success('Booking transport updated'); refresh(); }, onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Could not update transport') });
  if (plans.isLoading) return <p className="text-sm text-ink-soft">Loading pickup and return plans...</p>;
  if (plans.isError) return <button className="text-accent-ink underline" onClick={() => plans.refetch()}>Could not load transport. Retry</button>;
  return <section className="card p-6">
    <h2 className="font-bold mb-2">Pickup and return for this booking</h2>
    <p className="text-sm text-ink-soft mb-4">One shared pickup and one shared return cover every device listed in this booking.</p>
    <div className="grid sm:grid-cols-3 gap-3 mb-4">
      <select aria-label="Transport agent" className="border rounded-lg p-2" value={agentId} onChange={e => setAgentId(e.target.value)}><option value="">Choose field staff</option>{staff.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select>
      <input aria-label="Transport date" type="date" className="border rounded-lg p-2" value={date} onChange={e => setDate(e.target.value)} />
      <input aria-label="Transport time" className="border rounded-lg p-2" value={slot} onChange={e => setSlot(e.target.value)} placeholder="e.g. 1:00 PM – 2:00 PM" />
    </div>
    <input aria-label="Received by or cancellation reason" className="border rounded-lg p-2 w-full mb-4" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Received by (completion) or reason (cancellation)" />
    <div className="space-y-4">{plans.data?.map(plan => <div key={plan.id} className="border-t pt-4 flex flex-wrap gap-3 items-center">
      <strong>{plan.direction === 'PICKUP' ? 'Customer pickup' : 'Return delivery'}</strong><span>{plan.status}</span>
      {plan.scheduledDate && <span className="text-sm">{plan.scheduledDate} {plan.scheduledSlot}</span>}
      {['PLANNED', 'ASSIGNED'].includes(plan.status) && <button disabled={action.isPending || !agentId || !date || !slot} className="border rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => action.mutate({ kind: 'assign', plan })}>{plan.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}</button>}
      {plan.status === 'ASSIGNED' && <button disabled={action.isPending || !receivedBy.trim()} className="bg-brand-800 text-white rounded-lg px-3 py-2 disabled:opacity-50" onClick={() => action.mutate({ kind: 'complete', plan })}>Confirm all devices {plan.direction === 'PICKUP' ? 'collected' : 'delivered'}</button>}
      {['PLANNED', 'ASSIGNED'].includes(plan.status) && <button disabled={action.isPending || !receivedBy.trim()} className="text-red-700 underline disabled:opacity-50" onClick={() => action.mutate({ kind: 'cancel', plan })}>Cancel plan</button>}
    </div>)}</div>
  </section>;
}
