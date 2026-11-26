/* 同じ mas-syumi.github.io の別アプリと控え(キャッシュ)の置き場を共有しているので、
   消す・探すのは必ずこのアプリの名前が付いたものだけにする */
const CACHE_PREFIX = 'shitagaki-cho-';
const CACHE_NAME = CACHE_PREFIX + 'v3';

/* 電波がなくても開けるよう、入るときに取っておくファイルの一覧。
   ビルドが無く、ファイル名に指紋も付かないので、ここに直接書く。ファイルを足したらここにも足す */
const SHELL_FILES = ['./index.html', './manifest.json', './icon-512.png'];
const SHELL_URL = new URL('./index.html', self.registration.scope).href;
const NAV_TIMEOUT = 4000;   // 画面を開くとき、これ以上サーバーの応答を待たずに取っておいた画面を出す

/* 取っておいた分を照合するときは、必ず ignoreVary を付ける
   （サーバーが Vary を付けて返すと、付けないと照合できない） */
const match = (cache, req, opts) => cache.match(req, { ignoreVary: true, ...opts });

/* 一覧のファイルを取り直す（skip は取り直さない）。一覧に無くなった古いファイルは消す */
async function refreshShell(skip) {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(SHELL_FILES.filter(f => new URL(f, self.registration.scope).href !== skip).map(async f => {
    const res = await fetch(f, { cache: 'no-cache' });
    if (res.ok) await cache.put(new URL(f, self.registration.scope).href, res);
  }));
  const keep = new Set(SHELL_FILES.map(f => new URL(f, self.registration.scope).href));
  for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
}

self.addEventListener('install', e => {
  e.waitUntil(refreshShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* 画面を開くとき：まずサーバーに取りに行き、受け取れたら index.html として取っておく。
   失敗したとき、または4秒待っても応答がないときだけ、取っておいた index.html を出す */
function openPage(e) {
  let saved = null;
  const fromNet = fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res.ok) {
      const copy = res.clone();
      /* 最新版を受け取れたら、ほかの一覧のファイルも取り直す（失敗しても画面は出す） */
      saved = caches.open(CACHE_NAME).then(c => c.put(SHELL_URL, copy)).then(() => refreshShell(SHELL_URL)).catch(() => {});
    }
    return res;
  });
  /* 4秒で取っておいた画面を出したあとも、サーバーの応答を受け取って取っておくまで動き続ける */
  e.waitUntil(fromNet.then(() => saved, () => {}));
  const fromCache = () => caches.open(CACHE_NAME).then(c => match(c, SHELL_URL));
  return new Promise(resolve => {
    let done = false;
    const finish = res => { if (!done && res) { done = true; resolve(res); } };
    /* 4秒たったら、取っておいた画面があればそれを出す（無ければサーバーを待ち続ける） */
    const timer = setTimeout(() => fromCache().then(finish), NAV_TIMEOUT);
    fromNet.then(res => { clearTimeout(timer); finish(res); })
      .catch(() => { clearTimeout(timer); fromCache().then(r => finish(r || Response.error())); });
  });
}

/* そのほかのファイル（manifest・アイコン）：サーバー優先、届かなければ取っておいた分 */
function getFile(e) {
  return fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res.ok && SHELL_FILES.some(f => new URL(f, self.registration.scope).href === e.request.url)) {
      const copy = res.clone();
      e.waitUntil(caches.open(CACHE_NAME).then(c => c.put(e.request.url, copy)));
    }
    return res;
  }).catch(() => caches.open(CACHE_NAME).then(c => match(c, e.request, { ignoreSearch: true })).then(r => r || Response.error()));
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* GET 以外・よそのサーバー（Firebase など）・配信先の予約パスには手を出さない */
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/__/')) return;
  if (!url.href.startsWith(self.registration.scope)) return;
  e.respondWith(e.request.mode === 'navigate' ? openPage(e) : getFile(e));
});
