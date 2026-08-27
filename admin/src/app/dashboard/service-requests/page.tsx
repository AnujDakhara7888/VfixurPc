'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { srApi } from '@/lib/api';
import { formatDate, STATUS_LABELS } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import type { ServiceRequest, ServiceRequestStatus, PaginatedResponse } from '@/types';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const ALL_STATUSES: ServiceRequestStatus[] = [
  'PICKUP_SCHEDULED', 'PICKED_UP', 'RECEIVED_AT_WORKSHOP', 'DIAGNOSED',
  'QUOTATION_SHARED', 'PAYMENT_RECEIVED', 'UNDER_REPAIR', 'REPAIR_COMPLETE',
  'OUT_FOR_DELIVERY', 'DELIVERED',
];

const LIMIT = 25;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useState<ReturnType<typeof setTimeout> | null>(null);
  
  // Simple debounce via useCallback is harder; just use inline effect pattern
  const [dbVal, setDbVal] = useState(value);
  useState(() => {
    const t = setTimeout(() => setDbVal(value), delay);
    return () => clearTimeout(t);
  });
  return dbVal;
}

export default function ServiceRequestsPage() {
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchRaw, setSearchRaw] = useState('');
  const [page, setPage] = useState(1);

  // simple debounce state
  const [search, setSearch] = useState('');
  const [debTimer, setDebTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (v: string) => {
    setSearchRaw(v);
    setPage(1);
    if (debTimer) clearTimeout(debTimer);
    const t = setTimeout(() => setSearch(v), 350);
    setDebTimer(t);
  };

  const handleStatus = (v: string) => { setFilterStatus(v); setPage(1); };

  const { data, isLoading, isFetching, refetch } = useQuery<PaginatedResponse<ServiceRequest>>({
    queryKey: ['service-requests', filterStatus, search, page],
    queryFn: () => srApi.list({ status: filterStatus || undefined, search: search || undefined, page, limit: LIMIT }) as any,
    staleTime: 30_000,
  });

  const rows: ServiceRequest[] = (data as any)?.data ?? (Array.isArray(data) ? data : []);
  const total: number          = (data as any)?.total ?? rows.length;
  const pages: number          = (data as any)?.pages ?? 1;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total > 0 ? `${total} repair job${total !== 1 ? 's' : ''}` : 'All repair jobs across every stage'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchRaw}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Ticket / customer / phone…"
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => handleStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        {(filterStatus || searchRaw) && (
          <button
            onClick={() => { handleStatus(''); handleSearch(''); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Ticket', 'Customer', 'Device', 'Technician', 'Status', 'Created', ''].map((h) => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="inline-block w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  {searchRaw || filterStatus ? 'No results match your filters.' : 'No service requests yet.'}
                </td>
              </tr>
            )}
            {rows.map((sr) => (
              <tr key={sr.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-4 font-mono font-semibold text-brand-700 text-xs">
                  {sr.ticketNumber}
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-gray-900">{sr.customer?.name}</p>
                  <p className="text-xs text-gray-500">{sr.customer?.phone}</p>
                </td>
                <td className="px-5 py-4 text-gray-600">
                  {sr.device?.brand} {sr.device?.model}
                </td>
                <td className="px-5 py-4 text-xs">
                  {sr.assignedTechnician?.name
                    ? <span className="text-gray-700 font-medium">{sr.assignedTechnician.name}</span>
                    : <span className="text-gray-300 italic">Unassigned</span>}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={sr.status} />
                </td>
                <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(sr.createdAt)}</td>
                <td className="px-5 py-4">
                  <Link
                    href={`/dashboard/service-requests/${sr.id}`}
                    className="text-brand-600 hover:underline font-medium text-xs"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Page {page} of {pages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
