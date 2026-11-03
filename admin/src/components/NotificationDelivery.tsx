"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, BellOff, Mail, Send } from "lucide-react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function NotificationDelivery({ userId }: { userId: string }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, isError } = useQuery({
    queryKey: ["notification-delivery", userId],
    queryFn: () => api.get("/notifications/delivery-settings").then(r => r.data),
  });
  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    navigator.serviceWorker.getRegistration('/').then(async registration => {
      const subscription = await registration?.pushManager?.getSubscription();
      const owned = !!subscription && localStorage.getItem('push-user') === userId;
      // Repair a browser subscription whose server record was removed by logout.
      if (owned && !cancelled && Notification.permission === 'granted') {
        await api.post('/notifications/web-push', subscription.toJSON());
      }
      if (!cancelled) setSubscribed(owned && Notification.permission === 'granted');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);
  async function toggle() {
    setBusy(true);
    try {
      if (!subscribed && await Notification.requestPermission() !== "granted") {
        toast.error("Notifications are blocked. Allow them in your browser or device settings.");
        return;
      }
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscribed && subscription) {
        await api.delete('/notifications/web-push', { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
        localStorage.removeItem('push-user');
        setSubscribed(false);
      } else {
        const encoded = data.webPush.publicKey.replace(/-/g, '+').replace(/_/g, '/');
        const key = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
        subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api.post('/notifications/web-push', subscription.toJSON());
        localStorage.setItem('push-user', userId);
        setSubscribed(true);
        toast.success('Device notifications enabled');
      }
    } catch {
      toast.error('Could not update device notifications. Please try again.');
    } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try {
      const { data: result } = await api.post('/notifications/web-push/test');
      if (result.accepted > 0) toast.success('Test accepted by the push service. Check your device.');
      else toast.error('No device accepted the test. Turn notifications off and enable them again.');
    } catch { toast.error('Could not send the test notification.'); }
    finally { setBusy(false); }
  }
  return <div className="border-b pb-3 mb-1 space-y-2 text-xs text-gray-600">
    {isError ? <p role="alert">Delivery settings unavailable.</p> : <>
      <div className="flex items-center gap-2"><Mail size={14} /><span>Email: {data ? (data.email.configured ? 'configured' : 'sender setup required') : 'checking...'}</span></div>
      {supported ? <button disabled={busy || !data?.webPush.enabled} onClick={toggle} className="flex items-center gap-2 text-sm text-sky-800 disabled:opacity-50 py-2">
        {subscribed ? <BellOff size={17} /> : <BellRing size={17} />}
        {busy ? 'Updating...' : subscribed ? 'Turn off device notifications' : 'Enable device notifications'}
      </button> : <p>On iPhone, add this admin site to your Home Screen, then open it there to enable notifications.</p>}
      {subscribed && <button disabled={busy} onClick={test} className="flex items-center gap-2 text-sm text-sky-800 py-2 disabled:opacity-50"><Send size={16} />Send test</button>}
      {data && !data.webPush.enabled && <p>Device notification setup required.</p>}
    </>}
  </div>;
}
