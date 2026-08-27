'use client';

import { useQuery } from '@tanstack/react-query';
import { invoicesApi } from '@/lib/api';
import { formatDateShort, formatCurrency } from '@/lib/utils';
import type { Invoice } from '@/types';
import { Download } from 'lucide-react';

export default function InvoicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.list({ limit: 50 }),
  });

  const invoices: Invoice[] = data?.data ?? data ?? [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">GST-compliant invoices for all completed repairs</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Invoice #', 'Ticket', 'Customer', 'Subtotal', 'CGST 9%', 'SGST 9%', 'Total', 'Date', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={9} className="text-center py-10 text-gray-400">Loading…</td></tr>}
            {!isLoading && invoices.length === 0 && (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">No invoices yet. Generate one from a delivered service request.</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 font-mono text-xs">{inv.serviceRequest?.ticketNumber}</td>
                <td className="px-4 py-3 text-gray-800">{inv.customer?.name}</td>
                <td className="px-4 py-3 text-gray-600">{formatCurrency(inv.subtotal)}</td>
                <td className="px-4 py-3 text-gray-600">{formatCurrency(inv.cgst)}</td>
                <td className="px-4 py-3 text-gray-600">{formatCurrency(inv.sgst)}</td>
                <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(inv.total)}</td>
                <td className="px-4 py-3 text-gray-400">{formatDateShort(inv.createdAt)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => invoicesApi.openPdf(inv.id)}
                    className="inline-flex items-center gap-1.5 text-accent-ink hover:text-brand-700 text-xs font-bold">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
