"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import NotificationDelivery from './NotificationDelivery';
import { formatDateTime } from '@/lib/dateTime';
export default function AdminAlerts() {
  const { user } = useAuth();
  const previous = useRef<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const router = useRouter();
  const { data: count } = useQuery({
    queryKey: ["admin-unread", user?.id],
    queryFn: () =>
      api.get("/notifications/unread-count").then((r) => r.data.count),
    refetchInterval: 15000,
  });
  const { data: rows = [], isError, isSuccess } = useQuery({
    queryKey: ["admin-alerts", user?.id],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    refetchInterval: 15000,
    enabled: !!user,
  });
  useEffect(() => { previous.current = null; }, [user?.id]);
  useEffect(() => {
    if (!isSuccess) return;
    const incoming = rows.filter((row: any) => !row.readAt && previous.current && !previous.current.has(row.id));
    if (incoming.length) toast('New customer activity in your notifications', { id: 'admin-activity', icon: <Bell size={18} /> });
    previous.current = new Set(rows.map((row: any) => row.id));
  }, [rows, isSuccess]);
  async function read(id?: string, srId?: string) {
    try {
      await api.patch(
        id ? "/notifications/" + id + "/read" : "/notifications/read-all",
      );
      qc.invalidateQueries({ queryKey: ["admin-unread"] });
      qc.invalidateQueries({ queryKey: ["admin-alerts"] });
      if (srId) {
        setOpen(false);
        router.push("/dashboard/service-requests/" + srId);
      }
    } catch {
      toast.error("Could not mark notification read");
    }
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative p-3"
      >
        <Bell size={22} />
        {count > 0 && (
          <span className="absolute right-0 top-0 min-w-5 px-1 bg-red-600 text-white text-xs rounded-full">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 top-12 bg-white border shadow-lg rounded-lg w-[min(360px,calc(100vw-32px))] max-h-[70vh] overflow-auto z-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Notifications</h2>
            <button
              onClick={() => read()}
              aria-label="Mark all as read"
              title="Mark all as read"
            >
              <CheckCheck size={20} />
            </button>
          </div>
          {user && ['SUPER_ADMIN', 'OPERATIONS'].includes(user.role) && <NotificationDelivery userId={user.id} />}
          {isError ? (
            <p>Could not load notifications.</p>
          ) : !rows.length ? (
            <p className="text-sm text-gray-500">No updates yet.</p>
          ) : (
            rows.map((r: any) => (
              <button
                key={r.id}
                onClick={() => read(r.id, r.serviceRequestId)}
                className={
                  "w-full text-left border-b py-3 text-sm " +
                  (!r.readAt ? "font-semibold" : "text-gray-500")
                }
              >
                <span className="flex gap-2">
                  {!r.readAt && (
                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 mt-1.5" />
                  )}
                  {r.message}
                </span>
                <time className="block mt-1 text-xs text-gray-500">
                  {formatDateTime(r.sentAt)}
                </time>
              </button>
            ))
          )}
        </section>
      )}
    </div>
  );
}
