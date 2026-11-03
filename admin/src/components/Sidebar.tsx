'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';
import {
  LayoutDashboard, ClipboardList, Users, Wrench, Clock, FileText, CircleQuestionMark, LogOut, Cpu, Truck, Menu, X, Megaphone,
} from 'lucide-react';

const ADMIN_OPS: Role[] = ['SUPER_ADMIN', 'OPERATIONS'];

// Each item declares which roles may see it. Technicians get a focused console.
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[] }[] = [
  { href: '/dashboard/services', label: 'Service catalogue', icon: Wrench, roles: ADMIN_OPS },
  { href: '/dashboard',                  label: 'Overview',         icon: LayoutDashboard, roles: ADMIN_OPS },
  { href: '/dashboard/my-tasks',         label: 'My Tasks',         icon: Truck,           roles: ['TECHNICIAN', 'DELIVERY_AGENT'] },
  { href: '/dashboard/service-requests', label: 'Service Requests', icon: ClipboardList,   roles: ['SUPER_ADMIN', 'OPERATIONS', 'TECHNICIAN'] },
  { href: '/dashboard/users',            label: 'Customers',        icon: Users,           roles: ADMIN_OPS },
  { href: '/dashboard/technicians',      label: 'Technicians',      icon: Wrench,          roles: ADMIN_OPS },
  { href: '/dashboard/pickup-slots',     label: 'Pickup Slots',     icon: Clock,           roles: ['SUPER_ADMIN'] },
  { href: '/dashboard/invoices',         label: 'Invoices',         icon: FileText,        roles: ADMIN_OPS },
  { href: '/dashboard/offers',           label: 'Offers & campaigns', icon: Megaphone,     roles: ADMIN_OPS },
  { href: '/dashboard/faq',             label: 'FAQ',               icon: CircleQuestionMark,      roles: ADMIN_OPS },
];

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Administrator',
  OPERATIONS: 'Operations',
  TECHNICIAN: 'Technician',
  DELIVERY_AGENT: 'Delivery agent',
  CUSTOMER: 'Customer',
};

export default function Sidebar() {
  const [open,setOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = (user?.role ?? 'TECHNICIAN') as Role;
  const nav = NAV.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex flex-col w-full md:w-64 shrink-0 bg-brand-900 text-white md:sticky md:top-0 md:h-screen">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-6">
        <button className="md:hidden" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
        <div className="w-10 h-10 rounded-xl bg-accent-grad flex items-center justify-center shadow-glow">
          <Cpu className="w-5 h-5 text-brand-900" strokeWidth={2.4} />
        </div>
        <div>
          <p className="font-extrabold text-[15px] leading-tight tracking-tight">
            Vfixur<span className="text-accent">PC</span>
          </p>
          <p className="text-[11px] text-white/45 font-medium tracking-wide">Operations Console</p>
        </div>
      </div>

      <div className="mx-6 h-px bg-white/10" />

      {/* Nav */}
      <nav className={`${open?'block':'hidden'} md:block flex-1 px-3 py-5 space-y-1 overflow-auto`}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={()=>setOpen(false)}
              className={cn(
                'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
                active
                  ? 'bg-white/[0.07] text-white'
                  : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
              )}
            >
              <span
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full transition-all',
                  active ? 'bg-accent' : 'bg-transparent',
                )}
              />
              <Icon className={cn('w-[18px] h-[18px] flex-shrink-0 transition-colors', active ? 'text-accent' : 'text-white/55 group-hover:text-white')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className={`${open?'block':'hidden'} md:block px-3 py-4 mx-3 mb-2 rounded-xl bg-white/[0.04]`}>
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-9 h-9 rounded-full bg-accent-grad flex items-center justify-center text-xs font-extrabold uppercase text-brand-900">
            {user?.name?.[0] ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name ?? 'Admin'}</p>
            <p className="text-[11px] text-accent/80 truncate font-semibold">{ROLE_LABEL[role] ?? role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-white/55 hover:text-white hover:bg-white/[0.06] rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
