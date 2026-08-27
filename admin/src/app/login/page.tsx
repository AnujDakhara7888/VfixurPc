'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Cpu, ShieldCheck, Truck, BadgeIndianRupee } from 'lucide-react';

const HIGHLIGHTS = [
  { icon: Truck, label: 'Doorstep pickup & delivery' },
  { icon: ShieldCheck, label: 'Certified Windows & Mac technicians' },
  { icon: BadgeIndianRupee, label: 'Transparent quote before any repair' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      router.replace('/dashboard');
    } catch {
      toast.error('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-ink-grad text-white overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-accent-grad flex items-center justify-center shadow-glow">
            <Cpu className="w-6 h-6 text-brand-900" strokeWidth={2.4} />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Vfixur<span className="text-accent">PC</span></span>
        </div>

        <div className="relative">
          <p className="text-accent font-bold text-xs tracking-[0.2em] uppercase mb-4">Operations Console</p>
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Run every repair,<br />from pickup to delivery.
          </h2>
          <p className="mt-4 text-white/55 max-w-md leading-relaxed">
            Track tickets, manage technicians, schedule pickups and invoice customers — all in one premium console.
          </p>
          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-white/75">
                <span className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-accent" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/35">GSTIN 27FXQPB4377D1Z8 · vfixurpc.com</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-ink-grad flex items-center justify-center">
              <Cpu className="w-6 h-6 text-accent" strokeWidth={2.4} />
            </div>
            <span className="text-xl font-extrabold tracking-tight">Vfixur<span className="text-accent-ink">PC</span></span>
          </div>

          <h1 className="text-2xl font-extrabold text-ink tracking-tight">Welcome back</h1>
          <p className="text-sm text-ink-soft mt-1.5 mb-8">Sign in to manage your repair operations.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="superadmin"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-sm transition shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-sm transition shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-800 hover:bg-brand-900 text-white font-bold rounded-xl transition disabled:opacity-50 text-sm shadow-card"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            Protected console · Authorized staff only
          </p>
        </div>
      </div>
    </div>
  );
}
