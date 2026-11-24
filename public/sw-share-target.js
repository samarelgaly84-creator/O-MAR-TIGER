// Service Worker extension for Web Share Target & OS Notification Click handling

const SHARE_DB_NAME = 'tiger-share-target-db';
const SHARE_STORE_NAME = 'pending-shares';

function openShareDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
        db.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveIncomingShare(payload) {
  const db = await openShareDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
    tx.objectStore(SHARE_STORE_NAME).put({ id: 'latest', ...payload, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = String(formData.get('title') || '');
          const text = String(formData.get('text') || '');
          const sharedUrl = String(formData.get('url') || '');
          const rawFiles = formData.getAll('files');
          const files = [];
          for (const item of rawFiles) {
            if (item && typeof item === 'object' && typeof item.arrayBuffer === 'function' && item.size > 0) {
              const buffer = await item.arrayBuffer();
              files.push({
                name: item.name || `shared-${Date.now()}`,
                type: item.type || 'application/octet-stream',
                size: item.size,
                buffer,
              });
            }
          }
          await saveIncomingShare({ title, text, url: sharedUrl, files });
        } catch (err) {
          console.error('SW share-target error:', err);
        }
        return Response.redirect('/?incoming_share=1', 303);
      })()
    );
  }
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data ? event.data.json() : {};
      } catch {
        const text = event.data ? event.data.text() : '';
        payload = { title: 'TIGER', body: text || 'إشعار جديد' };
      }

      const tag = payload.tag || `tiger-push-${Date.now()}`;

      if (payload.type === 'call:cancelled') {
        try {
          const existing = await self.registration.getNotifications({ tag });
          existing.forEach((n) => n.close());
        } catch {
          // ignore
        }
        return;
      }

      // Skip duplicate Web Push popup only when TIGER is visible & focused in foreground (since CallContext shows live OS status-bar alert directly), except for call/missed/test
      try {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const hasFocusedVisibleClient = clientList.some(
          (c) => c.visibilityState === 'visible' && c.focused
        );
        if (hasFocusedVisibleClient && payload.type !== 'test' && payload.type !== 'call:invite') {
          return;
        }
      } catch {
        // ignore client matching issues
      }

      const isCall = payload.type === 'call:invite';
      const isMissed = payload.type === 'call:missed';
      const title = payload.title || 'TIGER';
      const options = {
        body: payload.body || '',
        icon: payload.fromAvatarUrl || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag,
        renotify: true,
        requireInteraction: isCall || isMissed,
        vibrate: isCall ? [500, 200, 500, 200, 500, 200, 500] : [200, 100, 200],
        actions: isCall
          ? [
              { action: 'answer', title: '📞 الرد / Answer' },
              { action: 'decline', title: '✖ رفض / Decline' },
            ]
          : [],
        data: {
          url: payload.url || '/',
          type: payload.type || 'notification',
          callId: payload.callId || null,
          fromUserId: payload.fromUserId || null,
        },
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || '/';
  const action = event.action || '';

  if ((action === 'answer' || action === 'decline') && notifData.callId) {
    const sep = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${sep}call_action=${encodeURIComponent(action)}&call_id=${encodeURIComponent(notifData.callId)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (action === 'decline' && clientList.length > 0) {
        for (const client of clientList) {
          client.postMessage({
            type: 'TIGER_CALL_ACTION',
            action: 'decline',
            data: notifData,
          });
        }
        return;
      }

      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: action === 'answer' ? 'TIGER_CALL_ACTION' : 'TIGER_NOTIFICATION_CLICK',
            action: action || 'open',
            data: notifData,
          });
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
