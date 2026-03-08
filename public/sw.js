self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();
  const href = payload.href || '/settings/notifications';

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Vector', {
      body: payload.body || '',
      icon: '/icons/vector-app-icon.svg',
      badge: '/icons/vector-app-icon.svg',
      data: {
        href,
        recipientId: payload.recipientId,
      },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const href = event.notification.data?.href || '/settings/notifications';
  const targetUrl = new URL(href, self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      }),
  );
});
