'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deliveryApi } from '@/lib/api';
import AuthImage from '@/components/AuthImage';
import { calendarLink } from '@/lib/calendar';
import { formatDateOnly, formatTimeSlot } from '@/lib/dateTime';
import toast from 'react-hot-toast';
import { Package, Truck, Camera, CircleCheckBig, MapPin, Warehouse } from 'lucide-react';

interface Photo { id: string; type: 'PICKUP' | 'WAREHOUSE' | 'DELIVERY'; }
interface Task {
  id: string; type: 'PICKUP' | 'DELIVERY'; status: string;
  scheduledDate: string; scheduledSlot: string;
  serviceRequest?: {
    serviceRequestNumber?: string; ticketNumber?: string; pickupAddress?: string;
    customer?: { name?: string; phone?: string };
    device?: { brand?: string; model?: string };
  };
}
interface GroupPlan {
  id: string; direction: 'PICKUP' | 'RETURN'; status: 'ASSIGNED'; version: number;
  scheduledDate: string; scheduledSlot: string;
  booking?: { reference?: string };
  requests: Array<NonNullable<Task['serviceRequest']> & { id: string }>;
}

export default function MyTasksPage() {
  const { data, isLoading } = useQuery<Task[]>({
    queryKey: ['my-tasks'],
    queryFn: deliveryApi.myTasks,
    refetchInterval: 30_000,
  });
  const grouped = useQuery<GroupPlan[]>({
    queryKey: ['my-booking-transport'],
    queryFn: deliveryApi.myBookingPlans,
    refetchInterval: 30_000,
  });
  const tasks = data ?? [];
  const groupTasks = grouped.data ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-bold text-accent-ink tracking-[0.18em] uppercase mb-2">Field work</p>
        <h1 className="text-[26px] font-extrabold text-ink tracking-tight">My tasks</h1>
        <p className="text-sm text-ink-soft mt-1.5">Your assigned pickups and deliveries. Confirm every device before completing a shared booking.</p>
      </div>

      {(isLoading || grouped.isLoading) && <p className="text-ink-faint text-sm py-10 text-center">Loading…</p>}
      {!isLoading && !grouped.isLoading && tasks.length === 0 && groupTasks.length === 0 && (
        <div className="card p-10 text-center text-ink-faint">You&apos;re all caught up — no tasks assigned right now.</div>
      )}
      <div className="space-y-4">
        {groupTasks.map((task) => <GroupTaskCard key={task.id} task={task} />)}
        {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function GroupTaskCard({ task }: { task: GroupPlan }) {
  const qc = useQueryClient();
  const [receivedBy, setReceivedBy] = useState('');
  const first = task.requests[0];
  const isPickup = task.direction === 'PICKUP';
  const complete = useMutation({
    mutationFn: () => deliveryApi.completeBookingPlan(task.id, {
      expectedVersion: task.version,
      receivedBy,
      confirmedRequestIds: task.requests.map(request => request.id),
    }),
    onSuccess: () => {
      toast.success(isPickup ? 'All devices collected' : 'All devices delivered');
      qc.invalidateQueries({ queryKey: ['my-booking-transport'] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onError: (error: unknown) => toast.error((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not complete this booking'),
  });
  const Icon = isPickup ? Package : Truck;
  return <div className="card p-5 border-l-4 border-l-accent">
    <div className="flex items-center gap-3 mb-3">
      <span className="w-10 h-10 rounded-xl bg-ink-grad flex items-center justify-center"><Icon className="w-5 h-5 text-accent" /></span>
      <div>
        <p className="text-sm font-extrabold text-ink">{isPickup ? 'Shared pickup' : 'Shared return'} · {task.booking?.reference ?? 'Booking'}</p>
        <p className="text-xs text-ink-faint">{formatDateOnly(task.scheduledDate)} · {formatTimeSlot(task.scheduledSlot)}</p>
      </div>
      <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{task.requests.length} devices</span>
    </div>
    <div className="text-sm text-ink-soft space-y-1 mb-4">
      <p><span className="font-semibold text-ink">{first?.customer?.name}</span>{first?.customer?.phone ? ` · ${first.customer.phone}` : ''}</p>
      {first?.pickupAddress && <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent-ink" />{first.pickupAddress}</p>}
      <ul className="mt-3 divide-y">{task.requests.map(request => <li key={request.id} className="py-2 flex justify-between gap-3"><span>{request.serviceRequestNumber ?? request.ticketNumber}</span><span className="text-ink-faint">{request.device?.brand} {request.device?.model}</span></li>)}</ul>
    </div>
    <label className="block text-xs font-bold text-ink-soft mb-1" htmlFor={`received-${task.id}`}>{isPickup ? 'Collected from' : 'Received by'}</label>
    <div className="flex flex-col sm:flex-row gap-2">
      <input id={`received-${task.id}`} className="border rounded-lg p-2 flex-1" value={receivedBy} onChange={event => setReceivedBy(event.target.value)} placeholder="Enter the person’s name" />
      <button onClick={() => complete.mutate()} disabled={complete.isPending || !receivedBy.trim() || task.requests.length === 0}
        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-800 text-white text-sm font-bold rounded-lg disabled:opacity-50">
        <CircleCheckBig className="w-4 h-4" /> Confirm all {task.requests.length} devices
      </button>
    </div>
  </div>;
}

function TaskCard({ task }: { task: Task }) {
  const qc = useQueryClient();
  const sr = task.serviceRequest;
  const isPickup = task.type === 'PICKUP';
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'PICKUP' | 'WAREHOUSE' | 'DELIVERY'>(isPickup ? 'PICKUP' : 'DELIVERY');

  const { data: photos } = useQuery<Photo[]>({
    queryKey: ['task-photos', task.id],
    queryFn: () => deliveryApi.photos(task.id),
  });

  const upload = useMutation({
    mutationFn: (file: File) => deliveryApi.uploadPhoto(task.id, file, uploadType),
    onSuccess: () => { toast.success('Photo uploaded'); qc.invalidateQueries({ queryKey: ['task-photos', task.id] }); qc.invalidateQueries({ queryKey: ['my-tasks'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed'),
  });

  const complete = useMutation({
    mutationFn: () => deliveryApi.complete(task.id),
    onSuccess: () => { toast.success(isPickup ? 'Pickup completed' : 'Delivery completed'); qc.invalidateQueries({ queryKey: ['my-tasks'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not complete'),
  });

  const pick = (type: 'PICKUP' | 'WAREHOUSE' | 'DELIVERY') => { setUploadType(type); setTimeout(() => fileRef.current?.click(), 0); };

  const Icon = isPickup ? Package : Truck;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl bg-ink-grad flex items-center justify-center"><Icon className="w-5 h-5 text-accent" /></span>
        <div>
          <p className="text-sm font-extrabold text-ink">{isPickup ? 'Pickup' : 'Delivery'} · {sr?.serviceRequestNumber ?? sr?.ticketNumber}</p>
          <p className="text-xs text-ink-faint">{formatDateOnly(task.scheduledDate)} · {formatTimeSlot(task.scheduledSlot)}</p>
        </div>
        <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{task.status}</span>
      </div>

      <div className="text-sm text-ink-soft space-y-1 mb-3">
        {calendarLink(task.scheduledDate,task.scheduledSlot) && <a className="block text-blue-700 font-semibold py-2" href={calendarLink(task.scheduledDate,task.scheduledSlot,'VfixurPC '+task.type+' '+(sr?.serviceRequestNumber??''),sr?.pickupAddress,sr?.customer?.phone)??'#'} target="_blank" rel="noreferrer">Add to Google Calendar</a>}
        <p><span className="font-semibold text-ink">{sr?.customer?.name}</span>{sr?.customer?.phone ? ` · ${sr.customer.phone}` : ''}</p>
        {sr?.device?.brand && <p className="text-ink-faint">{sr.device.brand} {sr.device.model}</p>}
        {sr?.pickupAddress && <p className="flex items-start gap-1.5 text-ink-soft"><MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent-ink" />{sr.pickupAddress}</p>}
      </div>

      {photos && photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {photos.map((p) => (
            <AuthImage key={p.id} photoId={p.id} className="w-16 h-16 rounded-lg object-cover border border-gray-100" />
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => pick(isPickup ? 'PICKUP' : 'DELIVERY')} disabled={upload.isPending}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent-soft text-accent-ink text-sm font-bold rounded-xl hover:bg-accent/15 disabled:opacity-50">
          <Camera className="w-4 h-4" /> {isPickup ? 'Pickup photo' : 'Delivery photo'}
        </button>
        {isPickup && (
          <button onClick={() => pick('WAREHOUSE')} disabled={upload.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-ink-soft text-sm font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50">
            <Warehouse className="w-4 h-4" /> Warehouse photo
          </button>
        )}
        <button onClick={() => complete.mutate()} disabled={complete.isPending}
          className="flex items-center gap-1.5 px-3 py-2 ml-auto bg-brand-800 text-white text-sm font-bold rounded-xl hover:bg-brand-900 disabled:opacity-50">
          <CircleCheckBig className="w-4 h-4" /> {isPickup ? 'Mark picked up' : 'Mark delivered'}
        </button>
      </div>
    </div>
  );
}
