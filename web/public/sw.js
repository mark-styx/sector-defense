// Sector Defense shell cache: the game is a handful of static files, so
// cache-first makes the PWA launch instantly and play fully offline. The
// cloud API is never cached; fonts are runtime-cached on first success.
const CACHE = 'sd-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/v1/')) return; // API calls go straight to the network
  if (url.hostname.includes('fonts.g')) {    // google fonts: fill cache on first hit
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return r;
        })
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))
  );
});
