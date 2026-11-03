self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a generic update for malformed payloads. */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'VfixurPC update', {
    body: payload.body || 'Open your admin inbox for the latest activity.',
    icon: '/app-icon.png',
    tag: payload.notificationId || 'vfixurpc-update',
    data: { url: payload.url || '/dashboard' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const candidate = new URL(event.notification.data?.url || '/dashboard', self.location.origin);
    const url = candidate.origin === self.location.origin && candidate.pathname.startsWith('/dashboard')
      ? candidate.href : self.location.origin + '/dashboard';
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
