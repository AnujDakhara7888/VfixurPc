'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { srApi, quotesApi, invoicesApi, type QuoteLineInput } from '@/lib/api';
import { formatDate, formatCurrency, NEXT_STATUSES, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import TicketDocuments from '@/components/TicketDocuments';
import { calendarLink } from '@/lib/calendar';
import { formatDateOnly, formatTimeSlot } from '@/lib/dateTime';
import { useAuth } from '@/context/AuthContext';
import AssignmentsCard from './AssignmentsCard';
import CustomerCollection from '@/components/CustomerCollection';
import BookingTransport from '@/components/BookingTransport';
import WarrantyPanel from '@/components/WarrantyPanel';
import type { ServiceRequest } from '@/types';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, FileText, Download } from 'lucide-react';
import Link from 'next/link';

type Line = QuoteLineInput;
const BLANK: Line = { itemName: '', description: '', hsnSac: '', unit: 'PC', quantity: 1, unitPrice: 0 };

export default function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { user } = useAuth();
  const [notesInput, setNotesInput] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteItems, setQuoteItems] = useState<Line[]>([{ ...BLANK }]);

  const { data: sr, isLoading, isError, refetch } = useQuery<ServiceRequest>({
    queryKey: ['sr', id],
    queryFn: () => srApi.get(id),
  });

  const { data: invoices } = useQuery({
    queryKey: ['sr-invoices', id],
    queryFn: () => invoicesApi.listForSr(id),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      srApi.updateStatus(id, status, notes),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['sr', id] });
      qc.invalidateQueries({ queryKey: ['service-requests'] });
      setNotesInput('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'Failed to update status'),
  });

  const quoteMutation = useMutation({
    mutationFn: () => quotesApi.upsert(id, quoteItems),
    onSuccess: () => {
      toast.success('Quote saved');
      qc.invalidateQueries({ queryKey: ['sr', id] });
      setShowQuoteForm(false);
    },
    onError: () => toast.error('Failed to save quote'),
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!sr) return <div className="p-8 text-ink-soft">{isError ? 'Could not load this request.' : 'Service request not found.'}<button className="ml-4 underline" onClick={() => refetch()}>Retry</button></div>;

  const nextStatuses = (NEXT_STATUSES[sr.status] ?? []).filter(status =>
    (!(sr.serviceMode && sr.serviceMode !== 'PICKUP') || !['PICKUP_SCHEDULED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(status)) &&
    (!['ON_SITE', 'REMOTE', 'CONSULTATION'].includes(sr.serviceMode ?? '') || status !== 'RECEIVED_AT_WORKSHOP'));
  const hasQuote = !!sr.quoteItems?.length;
  const subtotal = (sr.quoteItems ?? []).reduce((sum, item) => sum + item.totalPrice, 0);
  const gst = (sr.quoteItems ?? []).reduce((sum, item) => sum + item.totalPrice * Number(item.taxRate ?? 18) / 100, 0);
  const set = (i: number, patch: Partial<Line>) =>
    setQuoteItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {sr.booking && <section className="border-b pb-4 mb-5"><h2 className="font-bold break-all">Booking {sr.booking.reference}</h2><p>Pickup &amp; delivery: {formatCurrency(sr.booking.transportBase)} + {formatCurrency(sr.booking.transportTax)} GST, once per booking.</p><div className="flex flex-wrap gap-4 mt-3">{sr.relatedRequests?.map(r => <Link key={r.id} className="text-accent-ink underline" href={'/dashboard/service-requests/' + r.id}>{r.serviceRequestNumber} · {r.device?.brand} {r.device?.model}</Link>)}</div></section>}
      {!!sr.rejectionFeeTotal && <p className="mb-4">Diagnosis fee on rejection: ₹500 + ₹90 GST = ₹590. Payment not collected automatically.</p>}
      {sr.quoteApproved && <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 mb-5 font-bold">Quote V{sr.quoteVersion ?? 1} approved by customer</div>}
      {sr.quoteRejectedReason && <div className="bg-red-50 text-red-800 rounded-lg p-4 mb-5">Return requested: {sr.quoteRejectedReason}</div>}
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/service-requests" className="text-ink-faint hover:text-ink">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-ink font-mono tracking-tight">{sr.ticketNumber}</h1>
          <p className="text-sm text-ink-faint mt-0.5">Created {formatDate(sr.createdAt)}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={sr.status} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0 space-y-6">
          {sr.bookingId && sr.serviceMode === 'PICKUP' && <BookingTransport bookingId={sr.bookingId} requestIds={(sr.relatedRequests ?? []).map(r => r.id)} defaultDate={sr.pickupSlotDate} defaultSlot={sr.pickupSlotTime} />}
          {/* Customer + Device */}
          <div className="card p-6">
            <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Customer &amp; Device</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={sr.customer?.name} />
              <Field label="Phone" value={sr.customer?.phone} />
              <Field label="Email" value={sr.customer?.email} />
              {!['CONSULTATION', 'REMOTE'].includes(sr.serviceMode ?? '') && <Field label={sr.serviceMode === 'CARRY_IN' ? 'Workshop location' : sr.serviceMode === 'ON_SITE' ? 'Visit address' : 'Pickup address'} value={sr.pickupAddress} />}
              <Field label="Device" value={`${sr.device?.brand ?? ''} ${sr.device?.model ?? ''}`} />
              {sr.handoverMethod === 'CUSTOMER_COLLECTION' && <Field label="Handover" value="Collected by customer" />}
              {sr.device?.serialNumber && <Field label="Serial" value={sr.device.serialNumber} />}
              <Field label="Appointment date" value={formatDateOnly(sr.pickupSlotDate ?? sr.pickupDate)} />
              <Field label="Time slot" value={formatTimeSlot(sr.pickupSlotTime ?? sr.pickupSlot?.label)} />
            </div>
            <div className="mt-4 text-sm"><p className="font-semibold">{sr.serviceCategory} · {sr.serviceMode}</p>{Object.entries(sr.bookingAnswers ?? {}).filter(([,v])=>String(v)).map(([key,value])=><p key={key} className="mt-1 break-words"><span className="font-medium">{key}: </span>{Array.isArray(value)?value.join(', '):String(value)}</p>)}</div>
            {calendarLink(sr.pickupSlotDate, sr.pickupSlotTime) && <a target="_blank" rel="noreferrer" className="inline-block text-accent-ink font-semibold mt-4" href={calendarLink(sr.pickupSlotDate, sr.pickupSlotTime, 'VfixurPC '+sr.ticketNumber, sr.pickupAddress, sr.customer?.name+' '+sr.customer?.phone) ?? '#'}>Add appointment to Google Calendar</a>}
            {sr.issues?.length > 0 && (
              <div className="mt-4">
                <p className="text-ink-faint text-sm mb-2">Reported Issues</p>
                <div className="flex flex-wrap gap-2">
                  {sr.issues.map((iss) => (
                    <span key={iss.id} className="bg-gray-100 text-ink-soft text-xs px-2.5 py-1 rounded-full">{iss.category}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quote display */}
          {hasQuote && (
            <div className="card p-6">
              <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Quotation</h2>
              <div className="text-sm mb-4 space-y-2"><div className="flex justify-between gap-4"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div><div className="flex justify-between gap-4"><span>GST</span><span>{formatCurrency(gst)}</span></div></div>
              <div className="sm:hidden space-y-4">{sr.quoteItems!.map(item=><div key={item.id} className="border-b pb-3 text-sm"><p className="font-semibold">{item.itemName || item.description}</p><div className="flex justify-between gap-4 mt-2"><span>{item.quantity} x {formatCurrency(item.unitPrice)}</span><span className="font-bold whitespace-nowrap">{formatCurrency(item.totalPrice)}</span></div></div>)}<div className="flex justify-between gap-4 font-bold"><span>Total incl. GST</span><span className="whitespace-nowrap">{formatCurrency(sr.quotedTotal??0)}</span></div></div>
              <div className="hidden sm:block overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-ink-faint">
                    <th className="text-left pb-2 font-semibold">Item</th>
                    <th className="text-left pb-2 font-semibold">HSN/SAC</th>
                    <th className="text-right pb-2 font-semibold">Qty</th>
                    <th className="text-right pb-2 font-semibold">Rate</th>
                    <th className="text-right pb-2 font-semibold">Taxable</th>
                  </tr>
                </thead>
                <tbody>
                  {sr.quoteItems!.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2">
                        <p className="font-semibold text-ink">{item.itemName || item.description}</p>
                        {item.itemName && <p className="text-xs text-ink-faint">{item.description}</p>}
                      </td>
                      <td className="py-2 text-ink-soft font-mono text-xs">{item.hsnSac ?? '—'}</td>
                      <td className="py-2 text-right">{item.quantity} {item.unit ?? 'PC'}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-semibold">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-3 text-right font-semibold text-ink-soft">Total (incl. GST)</td>
                    <td className="pt-3 text-right font-extrabold text-ink">{formatCurrency(sr.quotedTotal ?? 0)}</td>
                  </tr>
                </tfoot>
              </table></div>
            </div>
          )}

          {/* Quote entry */}
          {showQuoteForm && (
            <div className="card p-6">
              <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Add / edit quote</h2>
              <div className="space-y-3">
                {quoteItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input className="sm:col-span-2 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Item name" value={item.itemName} onChange={(e) => set(i, { itemName: e.target.value })} />
                    <input className="sm:col-span-4 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Description" value={item.description} onChange={(e) => set(i, { description: e.target.value })} />
                    <input className="sm:col-span-2 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="HSN/SAC" value={item.hsnSac} onChange={(e) => set(i, { hsnSac: e.target.value })} />
                    <input type="number" min={1} className="sm:col-span-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Qty" value={item.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
                    <input type="number" min={0} className="sm:col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Rate ₹ (pre-GST)" value={item.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
                    <button onClick={() => setQuoteItems(quoteItems.filter((_, j) => j !== i))} className="sm:col-span-1 text-red-400 hover:text-red-600 flex justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setQuoteItems([...quoteItems, { ...BLANK }])} className="flex items-center gap-1 text-sm text-accent-ink font-semibold hover:underline">
                  <Plus className="w-4 h-4" /> Add line
                </button>
              </div>
              <p className="text-xs text-ink-faint mt-2">Rate is the pre-GST unit price. 18% GST (9% CGST + 9% SGST) is included in the quotation total.</p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => quoteMutation.mutate()} disabled={quoteMutation.isPending} className="px-4 py-2 bg-brand-800 text-white rounded-xl text-sm font-bold hover:bg-brand-900 disabled:opacity-50">
                  {quoteMutation.isPending ? 'Saving…' : 'Save quote'}
                </button>
                <button onClick={() => setShowQuoteForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          <TicketDocuments id={id} canInvoice={user?.role === 'SUPER_ADMIN' || user?.role === 'OPERATIONS'} />
          <WarrantyPanel id={id} canManage={user?.role === 'SUPER_ADMIN' || user?.role === 'OPERATIONS'} canIssue={!!sr.quoteApproved && ['REPAIR_COMPLETE', 'READY_FOR_HANDOVER', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(sr.status)} />

          {/* Pickup & delivery assignments */}
          {(!sr.serviceMode || sr.serviceMode === 'PICKUP') && <AssignmentsCard srId={id} defaultDate={sr.pickupSlotDate ?? sr.pickupDate} defaultSlot={sr.pickupSlot?.label ?? sr.pickupSlotTime} />}

          {/* Status timeline */}
          <div className="card p-6">
            <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Status timeline</h2>
            {sr.statusHistory && sr.statusHistory.length > 0 ? (
              <ol className="relative border-l border-gray-200 ml-3 space-y-4">
                {[...sr.statusHistory].reverse().map((h) => (
                  <li key={h.id} className="ml-5">
                    <span className="absolute -left-2 w-4 h-4 rounded-full bg-accent border-2 border-white" />
                    <p className="text-sm font-semibold text-ink">
                      {h.fromStatus ? `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}` : `Created as ${STATUS_LABELS[h.toStatus]}`}
                    </p>
                    {h.notes && <p className="text-xs text-ink-soft mt-0.5">{h.notes}</p>}
                    <p className="text-xs text-ink-faint mt-0.5">{h.changedBy?.name ?? 'System'} · {formatDate(h.createdAt)}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-ink-faint">No history yet.</p>}
          </div>
        </div>

        {/* Right column — actions */}
        <div className="space-y-5">
          {nextStatuses.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-bold text-ink mb-3">Advance status</h3>
              <textarea value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Optional notes…" rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent mb-3" />
              <div className="space-y-2">
                {nextStatuses.map((ns) => (
                  <button key={ns} onClick={() => statusMutation.mutate({ status: ns, notes: notesInput })} disabled={statusMutation.isPending}
                    className="w-full py-2 px-4 bg-brand-800 hover:bg-brand-900 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                    → {STATUS_LABELS[ns]}
                  </button>
                ))}
              </div>
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'OPERATIONS') && ['PICKUP', 'CARRY_IN'].includes(sr.serviceMode ?? 'PICKUP') && ['REPAIR_COMPLETE', 'READY_FOR_HANDOVER'].includes(sr.status) && <CustomerCollection id={id} />}
            </div>
          )}

          <div className="card p-5 space-y-2">
            <h3 className="text-sm font-bold text-ink mb-1">Billing</h3>
            {!showQuoteForm && (
              <button onClick={() => { if (hasQuote && sr.quoteItems) { setQuoteItems(sr.quoteItems.map((q) => ({ itemName: q.itemName ?? '', description: q.description, hsnSac: q.hsnSac ?? '', unit: q.unit ?? 'PC', quantity: q.quantity, unitPrice: q.unitPrice }))); } setShowQuoteForm(true); }}
                className="w-full py-2 px-4 border border-brand-700 text-brand-800 hover:bg-accent-soft text-sm font-bold rounded-xl transition">
                {hasQuote ? 'Edit quote' : 'Add quote'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-ink-faint">{label}</p>
      <p className="font-semibold text-ink">{value || '—'}</p>
    </div>
  );
}

function Inp({ label, v, on, type = 'text' }: { label: string; v?: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input type={type} value={v ?? ''} onChange={(e) => on(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" />
    </div>
  );
}
