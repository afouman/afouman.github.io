// Keep the cache name deliberately versioned. A new release clears the old
// HTML shell, so GitHub Pages never leaves a host looking at an older UI.
const CACHE_NAME = 'gather-host-v4';
const APP_SHELL = ['./', './manifest.webmanifest', './icons/gather-host-180.png', './icons/gather-host-192.png', './icons/gather-host-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
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
