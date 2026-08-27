'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { formatDateShort } from '@/lib/utils';
import type { User } from '@/types';
import toast from 'react-hot-toast';
import { UserPlus, ShieldCheck, Wrench, Power, Trash2, Info } from 'lucide-react';

const EMPTY = { name: '', email: '', phone: '', username: '', password: '' };

export default function TechniciansPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['users', 'TECHNICIAN'],
    queryFn: () => usersApi.list({ role: 'TECHNICIAN', limit: 100 }),
  });
  const techs: User[] = data?.data ?? data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users', 'TECHNICIAN'] });
  const apiError = (e: unknown) => {
    const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
    return Array.isArray(m) ? m[0] : m;
  };

  const createMutation = useMutation({
    mutationFn: () => usersApi.createStaff({ ...form, role: 'TECHNICIAN' }),
    onSuccess: () => {
      toast.success('Technician added');
      invalidate();
      setShowForm(false);
      setForm(EMPTY);
    },
    onError: (e) => toast.error(apiError(e) ?? 'Failed to add technician'),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.setActive(id, isActive),
    onSuccess: (_d, v) => { toast.success(v.isActive ? 'Technician activated' : 'Technician deactivated'); invalidate(); },
    onError: (e) => toast.error(apiError(e) ?? 'Failed to update'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => { toast.success('Technician removed'); invalidate(); },
    onError: (e) => toast.error(apiError(e) ?? 'Failed to remove'),
  });

  function submit() {
    if (!form.name || !form.email || !form.phone || !form.username || !form.password) {
      toast.error('Please fill in every field');
      return;
    }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Enter a valid 10-digit mobile number'); return; }
    createMutation.mutate();
  }

  const active = techs.filter((t) => t.isActive !== false).length;

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold text-accent-ink tracking-[0.18em] uppercase mb-2">Team</p>
          <h1 className="text-[28px] font-extrabold text-ink tracking-tight">Technicians</h1>
          <p className="text-sm text-ink-soft mt-1.5">{active} active · {techs.length} total on the team</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-800 hover:bg-brand-900 text-white text-sm font-bold rounded-xl transition shadow-card"
        >
          <UserPlus className="w-4 h-4" /> Add technician
        </button>
      </div>

      {/* Access explainer */}
      <div className="card p-5 mb-6 flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-[18px] h-[18px] text-accent-ink" />
        </div>
        <div className="text-sm text-ink-soft leading-relaxed">
          <span className="font-bold text-ink">What technicians can access.</span>{' '}
          Technicians sign in with their own username and password. They can view the <span className="font-semibold text-ink">Service Requests</span> queue,
          update a job&apos;s <span className="font-semibold text-ink">status</span>, and add repair <span className="font-semibold text-ink">notes</span>.
          They <span className="font-semibold text-ink">cannot</span> see customers, invoices, revenue, manage pickup slots, or add other staff — those stay with admins and operations.
          Deactivate a technician to instantly block their sign-in without deleting their history.
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-accent-ink" /> New technician
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([
              ['name', 'Full name', 'text', 'Raj Sharma'],
              ['username', 'Username', 'text', 'raj.tech'],
              ['email', 'Email', 'email', 'raj@vfixurpc.com'],
              ['phone', 'Mobile (10-digit)', 'tel', '9876543210'],
              ['password', 'Temporary password', 'password', 'Min. 8 characters'],
            ] as const).map(([field, label, type, ph]) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={form[field]}
                  placeholder={ph}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent transition"
                />
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-faint mt-3">
            <Info className="w-3.5 h-3.5" /> Share the username and temporary password with the technician so they can sign in.
          </p>
          <div className="flex gap-3 mt-5">
            <button
              onClick={submit}
              disabled={createMutation.isPending}
              className="px-5 py-2.5 bg-accent-grad text-brand-900 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 shadow-glow transition"
            >
              {createMutation.isPending ? 'Adding…' : 'Add technician'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY); }} className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/70 border-b border-gray-100">
            <tr>
              {['Technician', 'Username', 'Contact', 'Status', 'Joined', ''].map((h) => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-faint uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && <tr><td colSpan={6} className="text-center py-12 text-ink-faint">Loading…</td></tr>}
            {!isLoading && techs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-ink-faint">No technicians yet — add your first one above.</td></tr>
            )}
            {techs.map((t) => {
              const isActive = t.isActive !== false;
              return (
                <tr key={t.id} className="hover:bg-gray-50/60 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-ink-grad flex items-center justify-center text-xs font-extrabold text-accent uppercase">
                        {t.name?.[0] ?? 'T'}
                      </div>
                      <div>
                        <p className="font-bold text-ink">{t.name}</p>
                        <p className="text-xs text-ink-faint">Technician</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-ink-soft">{t.username}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    <p>{t.phone}</p>
                    <p className="text-xs text-ink-faint">{t.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-faint">{formatDateShort(t.createdAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => activeMutation.mutate({ id: t.id, isActive: !isActive })}
                        title={isActive ? 'Deactivate' : 'Activate'}
                        className={`p-2 rounded-lg transition ${isActive ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove ${t.name}? This deletes the account.`)) removeMutation.mutate(t.id); }}
                        title="Remove"
                        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
