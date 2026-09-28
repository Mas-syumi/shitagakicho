const CACHE_NAME = 'shitagaki-cho-v2';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE_NAME).then(cache => cache.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
