/* Monarch Language Suite - service worker
   App files: network first (so updates arrive), cache fallback.
   Word data and icons: cache first, filled by the "Download for offline" button or as you browse. */
const SHELL = 'monarch-shell-v1';
const DATA = 'monarch-data-v1';   // also written by js/app.js (Download for offline)
const CORE = ['./', 'index.html', 'css/monarch.css', 'js/engine.js', 'js/app.js', 'manifest.json', 'icon.png', 'small-icon.png',
  'data/meta.json', 'data/index.txt', 'data/spelling.json', 'data/basics.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function isCore(url) {
  const p = url.pathname.replace(/^.*\/(?=[^/]*$)/, '');
  return url.pathname.endsWith('/') || ['index.html', 'monarch.css', 'engine.js', 'app.js', 'manifest.json', 'sw.js'].includes(p);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isCore(url)) {
    e.respondWith(fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(DATA).then((c) => c.put(req, copy)); }
    return res;
  })));
});
