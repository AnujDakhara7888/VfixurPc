'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AdminAlerts from '@/components/AdminAlerts';
import { useAuth } from '@/context/AuthContext';
import type { Role } from '@/types';

// Which roles may open which sections. Anything not listed is admin/ops only.
const ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: '/dashboard/my-tasks',         roles: ['TECHNICIAN', 'DELIVERY_AGENT'] },
  { prefix: '/dashboard/service-requests', roles: ['SUPER_ADMIN', 'OPERATIONS', 'TECHNICIAN'] },
  { prefix: '/dashboard/pickup-slots',     roles: ['SUPER_ADMIN'] },
  { prefix: '/dashboard/users',            roles: ['SUPER_ADMIN', 'OPERATIONS'] },
  { prefix: '/dashboard/technicians',      roles: ['SUPER_ADMIN', 'OPERATIONS'] },
  { prefix: '/dashboard/invoices',         roles: ['SUPER_ADMIN', 'OPERATIONS'] },
  { prefix: '/dashboard/offers',           roles: ['SUPER_ADMIN', 'OPERATIONS'] },
  { prefix: '/dashboard/faq',              roles: ['SUPER_ADMIN', 'OPERATIONS'] },
  { prefix: '/dashboard',                  roles: ['SUPER_ADMIN', 'OPERATIONS'] }, // Overview (keep last)
];

function landingFor(role: Role) {
  if (role === 'SUPER_ADMIN' || role === 'OPERATIONS') return '/dashboard';
  if (role === 'TECHNICIAN' || role === 'DELIVERY_AGENT') return '/dashboard/my-tasks';
  return '/dashboard/service-requests';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }

    const role = user.role as Role;
    const rule = ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'));
    if (rule && !rule.roles.includes(role)) {
      router.replace(landingFor(role));
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <header className="flex justify-end px-4 py-2 bg-white border-b"><AdminAlerts /></header>
        {children}
      </main>
    </div>
  );
}
