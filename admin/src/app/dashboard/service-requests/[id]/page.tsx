'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { srApi, quotesApi, invoicesApi, type QuoteLineInput, type GenerateInvoiceInput } from '@/lib/api';
import { formatDate, formatCurrency, NEXT_STATUSES, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import AssignmentsCard from './AssignmentsCard';
import type { ServiceRequest } from '@/types';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, FileText, Download } from 'lucide-react';
import Link from 'next/link';

type Line = QuoteLineInput;
const BLANK: Line = { itemName: '', description: '', hsnSac: '', unit: 'PC', quantity: 1, unitPrice: 0 };

export default function ServiceRequestDetailPage({ params }: { params: { id: string } }) {
  const qc = useQueryClient();
  const [notesInput, setNotesInput] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteItems, setQuoteItems] = useState<Line[]>([{ ...BLANK }]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [buyer, setBuyer] = useState<GenerateInvoiceInput>({});

  const { data: sr, isLoading } = useQuery<ServiceRequest>({
    queryKey: ['sr', params.id],
    queryFn: () => srApi.get(params.id),
  });

  const { data: invoices } = useQuery({
    queryKey: ['sr-invoices', params.id],
    queryFn: () => invoicesApi.listForSr(params.id),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: string; notes?: string }) =>
      srApi.updateStatus(params.id, status, notes),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['sr', params.id] });
      qc.invalidateQueries({ queryKey: ['service-requests'] });
      setNotesInput('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'Failed to update status'),
  });

  const quoteMutation = useMutation({
    mutationFn: () => quotesApi.upsert(params.id, quoteItems),
    onSuccess: () => {
      toast.success('Quote saved');
      qc.invalidateQueries({ queryKey: ['sr', params.id] });
      setShowQuoteForm(false);
    },
    onError: () => toast.error('Failed to save quote'),
  });

  const invoiceMutation = useMutation({
    mutationFn: () => invoicesApi.generate(params.id, buyer),
    onSuccess: async (inv: { id: string }) => {
      toast.success('Invoice generated');
      setShowInvoiceForm(false);
      qc.invalidateQueries({ queryKey: ['sr-invoices', params.id] });
      if (inv?.id) await invoicesApi.openPdf(inv.id);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'Failed to generate invoice'),
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!sr) return <div className="p-8 text-ink-soft">Service request not found.</div>;

  const nextStatuses = NEXT_STATUSES[sr.status] ?? [];
  const hasQuote = !!sr.quoteItems?.length;
  const set = (i: number, patch: Partial<Line>) =>
    setQuoteItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const startInvoice = () => {
    setBuyer({
      buyerName: sr.customer?.name,
      buyerContact: sr.customer?.name,
      buyerPhone: sr.customer?.phone,
      buyerEmail: sr.customer?.email,
      billingAddress: sr.pickupAddress,
      shippingAddress: sr.pickupAddress,
    });
    setShowInvoiceForm(true);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Customer + Device */}
          <div className="card p-6">
            <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Customer &amp; Device</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Name" value={sr.customer?.name} />
              <Field label="Phone" value={sr.customer?.phone} />
              <Field label="Email" value={sr.customer?.email} />
              <Field label="Pickup Address" value={sr.pickupAddress} />
              <Field label="Device" value={`${sr.device?.brand ?? ''} ${sr.device?.model ?? ''}`} />
              {sr.device?.serialNumber && <Field label="Serial" value={sr.device.serialNumber} />}
              {sr.pickupSlot && <Field label="Slot" value={sr.pickupSlot.label} />}
            </div>
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
              <table className="w-full text-sm">
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
              </table>
            </div>
          )}

          {/* Quote entry */}
          {showQuoteForm && (
            <div className="card p-6">
              <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Add / edit quote</h2>
              <div className="space-y-3">
                {quoteItems.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className="col-span-2 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Item name" value={item.itemName} onChange={(e) => set(i, { itemName: e.target.value })} />
                    <input className="col-span-4 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Description" value={item.description} onChange={(e) => set(i, { description: e.target.value })} />
                    <input className="col-span-2 border border-gray-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="HSN/SAC" value={item.hsnSac} onChange={(e) => set(i, { hsnSac: e.target.value })} />
                    <input type="number" min={1} className="col-span-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Qty" value={item.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} />
                    <input type="number" min={0} className="col-span-2 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent" placeholder="Rate ₹ (pre-GST)" value={item.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
                    <button onClick={() => setQuoteItems(quoteItems.filter((_, j) => j !== i))} className="col-span-1 text-red-400 hover:text-red-600 flex justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={() => setQuoteItems([...quoteItems, { ...BLANK }])} className="flex items-center gap-1 text-sm text-accent-ink font-semibold hover:underline">
                  <Plus className="w-4 h-4" /> Add line
                </button>
              </div>
              <p className="text-xs text-ink-faint mt-2">Rate is the pre-GST unit price. 18% GST (9% CGST + 9% SGST) is added automatically on the invoice.</p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => quoteMutation.mutate()} disabled={quoteMutation.isPending} className="px-4 py-2 bg-brand-800 text-white rounded-xl text-sm font-bold hover:bg-brand-900 disabled:opacity-50">
                  {quoteMutation.isPending ? 'Saving…' : 'Save quote'}
                </button>
                <button onClick={() => setShowQuoteForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Invoice buyer form */}
          {showInvoiceForm && (
            <div className="card p-6">
              <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">Generate tax invoice</h2>
              <p className="text-sm text-ink-soft mb-4">Confirm the buyer's billing details. Leave business fields blank for an individual customer.</p>
              <div className="grid grid-cols-2 gap-3">
                <Inp label="Company (optional)" v={buyer.buyerCompany} on={(v) => setBuyer({ ...buyer, buyerCompany: v })} />
                <Inp label="Contact name" v={buyer.buyerContact} on={(v) => setBuyer({ ...buyer, buyerContact: v })} />
                <Inp label="GSTIN (optional)" v={buyer.buyerGstin} on={(v) => setBuyer({ ...buyer, buyerGstin: v })} />
                <Inp label="PAN (optional)" v={buyer.buyerPan} on={(v) => setBuyer({ ...buyer, buyerPan: v })} />
                <Inp label="Phone" v={buyer.buyerPhone} on={(v) => setBuyer({ ...buyer, buyerPhone: v })} />
                <Inp label="Invoice date" type="date" v={buyer.invoiceDate} on={(v) => setBuyer({ ...buyer, invoiceDate: v })} />
                <div className="col-span-2"><Inp label="Billing address" v={buyer.billingAddress} on={(v) => setBuyer({ ...buyer, billingAddress: v })} /></div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending} className="px-4 py-2 bg-accent-grad text-brand-900 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-glow">
                  {invoiceMutation.isPending ? 'Generating…' : 'Generate & open PDF'}
                </button>
                <button onClick={() => setShowInvoiceForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Existing invoices */}
          {Array.isArray(invoices) && invoices.length > 0 && (
            <div className="card p-6">
              <h2 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-4">Invoices</h2>
              <div className="space-y-2">
                {invoices.map((inv: { id: string; invoiceNumber: string; totalAmount?: number }) => (
                  <div key={inv.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-accent-ink" />
                      <span className="font-mono font-bold text-ink text-sm">{inv.invoiceNumber}</span>
                    </div>
                    <button onClick={() => invoicesApi.openPdf(inv.id)} className="flex items-center gap-1.5 text-sm font-bold text-accent-ink hover:text-brand-700">
                      <Download className="w-4 h-4" /> PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pickup & delivery assignments */}
          <AssignmentsCard srId={params.id} defaultDate={sr.pickupSlotDate ?? sr.pickupDate} defaultSlot={sr.pickupSlot?.label ?? sr.pickupSlotTime} />

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
            {hasQuote && !showInvoiceForm && (
              <button onClick={startInvoice}
                className="w-full py-2 px-4 bg-accent-grad text-brand-900 text-sm font-bold rounded-xl transition shadow-glow hover:opacity-90">
                Generate invoice
              </button>
            )}
            {!hasQuote && <p className="text-xs text-ink-faint">Add a quote to enable invoicing.</p>}
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
