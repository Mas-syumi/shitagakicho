/* 同じ mas-syumi.github.io の別アプリと控え(キャッシュ)の置き場を共有しているので、
   消す・探すのは必ずこのアプリの名前が付いたものだけにする */
const CACHE_PREFIX = 'shitagaki-cho-';
const CACHE_NAME = CACHE_PREFIX + 'v2';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      if (res.ok) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy)));
      }
      return res;
    }).catch(() => caches.open(CACHE_NAME).then(cache => cache.match(e.request)))
  );
});
