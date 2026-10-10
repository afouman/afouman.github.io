// Keep the cache name deliberately versioned. A new release clears the old
// HTML shell, so GitHub Pages never leaves a host looking at an older UI.
const CACHE_NAME = 'nights-v40';
const APP_SHELL = ['./', './manifest.webmanifest', './manifest-guest.webmanifest', './manifest-host.webmanifest', './icons/nights-favicon-48.png', './icons/nights-app-icon-180.png', './icons/nights-app-icon-192.png', './icons/nights-app-icon-512.png'];
const BADGE_CACHE_NAME = 'nights-chat-badge-v1';
const BADGE_STATE_URL = new URL('/__nights_chat_badge_state__', self.location.origin).href;

async function readBadgeState() {
  try {
    const cache = await caches.open(BADGE_CACHE_NAME);
    const response = await cache.match(BADGE_STATE_URL);
    return response ? await response.json() : { events: {} };
  } catch {
    return { events: {} };
  }
}

async function incrementEventBadge(eventId) {
  if (!eventId) return;
  const state = await readBadgeState();
  state.events[eventId] = (state.events[eventId] || 0) + 1;
  const cache = await caches.open(BADGE_CACHE_NAME);
  await cache.put(BADGE_STATE_URL, new Response(JSON.stringify(state), {
    headers: { 'content-type': 'application/json' },
  }));
  const count = Object.values(state.events).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if ('setAppBadge' in self.navigator) await self.navigator.setAppBadge(count);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME && key !== BADGE_CACHE_NAME).map(key => caches.delete(key)),
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  // Navigations must come from the network. The shell references hashed JS
  // chunks, and serving an old cached HTML page was enough to keep a prior
  // version of the host dashboard alive after deployment.
  const request = event.request.mode === 'navigate'
    ? new Request(event.request, { cache: 'no-store' })
    : event.request;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./'))));
});

self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { body: event.data?.text() || 'A new message was posted.' };
  }
  const title = message.title || 'New Nights message';
  event.waitUntil((async () => {
    let eventId = message.eventId || '';
    try {
      eventId ||= new URL(message.url || './', self.location.origin).searchParams.get('event') || '';
    } catch {
      // The notification still displays if its destination cannot be parsed.
    }
    await incrementEventBadge(eventId);
    await self.registration.showNotification(title, {
      body: message.body || 'Open Nights to read it.',
      icon: './icons/nights-app-icon-192.png',
      badge: './icons/nights-app-icon-180.png',
      tag: message.tag || 'gather-chat',
      renotify: true,
      data: { url: message.url || './', eventId },
    });
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    windows.forEach(client => client.postMessage({ type: 'nights-chat-push', eventId }));
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    const sameEvent = windows.find(windowClient => {
      try {
        const open = new URL(windowClient.url);
        const target = new URL(destination);
        return open.origin === target.origin && open.pathname === target.pathname
          && open.searchParams.get('event') === target.searchParams.get('event');
      } catch {
        return false;
      }
    });
    if (sameEvent) {
      if ('navigate' in sameEvent) await sameEvent.navigate(destination);
      return sameEvent.focus();
    }
    return self.clients.openWindow(destination);
  }));
});
