/* Monarch Language Suite - service worker
   Always looks for the newest app first: app files and the small data files (meta, index, spelling, basics)
   are fetched from the network with revalidation, and the saved copy is used only when you are offline.
   Word data (dict/, forms/, rev/) is cached and requested as ...?v=<data version>, so a rebuilt data pack is
   picked up automatically and the old copy is discarded. */
const SHELL = 'monarch-shell-v2';
const DATA = 'monarch-data-v2';   // also written by js/app.js (Download for offline)
const CORE = ['./', 'index.html', 'css/monarch.css', 'js/engine.js', 'js/app.js', 'manifest.json', 'icon.png', 'small-icon.png',
  'data/meta.json', 'data/index.txt', 'data/spelling.json', 'data/basics.json'];
const NETWORK_FIRST = ['index.html', 'monarch.css', 'engine.js', 'app.js', 'manifest.json', 'sw.js',
  'meta.json', 'index.txt', 'spelling.json', 'basics.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function isNetworkFirst(url) {
  const p = url.pathname.replace(/^.*\/(?=[^/]*$)/, '');
  return url.pathname.endsWith('/') || NETWORK_FIRST.includes(p);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isNetworkFirst(url)) {
    // 'no-cache' = ask the server whether the file changed (cheap 304 when it did not), never trust the browser's HTTP cache
    e.respondWith(fetch(req.url, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  // word data and icons: saved copy first. The ?v=<version> in the URL keeps each data version separate.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); }
    return res;
  })));
});
