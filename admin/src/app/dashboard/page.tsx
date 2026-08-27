'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, srApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import type { ServiceRequest, DashboardStats } from '@/types';
import { ClipboardList, Wrench, CheckCircle, IndianRupee, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

function StatCard({ label, value, icon: Icon, tint, sub }: {
  label: string; value: string | number; icon: React.ElementType; tint: string; sub?: string;
}) {
  return (
    <div className="card card-hover p-6">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tint}`}>
          <Icon className="w-[22px] h-[22px]" />
        </div>
      </div>
      <p className="text-[34px] leading-none font-extrabold mt-5 text-ink tracking-tight">{value}</p>
      <p className="text-sm text-ink-soft mt-2 font-medium">{label}</p>
      {sub && <p className="text-xs text-accent-ink font-bold mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: adminApi.dashboard,
    refetchInterval: 60_000,
  });

  const { data: recent } = useQuery<ServiceRequest[]>({
    queryKey: ['recent-sr'],
    queryFn: () => srApi.list({ limit: 8 }).then((d) => d.data ?? d),
  });

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <p className="text-xs font-bold text-accent-ink tracking-[0.18em] uppercase mb-2">Operations</p>
        <h1 className="text-[28px] font-extrabold text-ink tracking-tight">Overview</h1>
        <p className="text-sm text-ink-soft mt-1.5">A real-time snapshot of your repair pipeline.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <StatCard label="Open tickets"   value={stats?.openTickets ?? '—'}                       icon={ClipboardList} tint="bg-blue-50 text-blue-600" />
        <StatCard label="Under repair"   value={stats?.inRepair ?? '—'}                           icon={Wrench}        tint="bg-accent-soft text-accent-ink" />
        <StatCard label="Delivered"      value={stats?.delivered ?? '—'}                          icon={CheckCircle}   tint="bg-emerald-50 text-emerald-600" />
        <StatCard
          label="Revenue (paid repairs)"
          value={stats ? formatCurrency(stats.totalRevenue) : '—'}
          icon={IndianRupee}
          tint="bg-indigo-50 text-indigo-600"
          sub={stats && stats.todayRevenue > 0 ? `${formatCurrency(stats.todayRevenue)} today` : undefined}
        />
      </div>

      {/* Pipeline breakdown */}
      {stats?.pipeline && stats.pipeline.length > 0 && (
        <div className="card p-6 mb-8">
          <h2 className="text-base font-bold text-ink mb-4">Pipeline breakdown</h2>
          <div className="flex flex-wrap gap-2.5">
            {stats.pipeline.map((p) => (
              <div key={p.status} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl pl-2.5 pr-3 py-2">
                <StatusBadge status={p.status as Parameters<typeof StatusBadge>[0]['status']} />
                <span className="text-sm font-extrabold text-ink">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent requests */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-ink">Recent service requests</h2>
          <Link href="/dashboard/service-requests" className="group flex items-center gap-1 text-sm text-accent-ink hover:text-brand-700 font-bold">
            View all
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recent?.map((sr) => (
            <Link
              key={sr.id}
              href={`/dashboard/service-requests/${sr.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/70 transition group"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink group-hover:text-accent-ink transition-colors">{sr.ticketNumber}</p>
                <p className="text-xs text-ink-faint mt-0.5 truncate">
                  {sr.customer?.name} · {sr.device?.brand} {sr.device?.model}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <StatusBadge status={sr.status} />
                <span className="text-xs text-ink-faint w-20 text-right">{formatDate(sr.createdAt)}</span>
              </div>
            </Link>
          ))}
          {!recent?.length && (
            <p className="text-sm text-ink-faint text-center py-12">No service requests yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
