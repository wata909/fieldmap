/* Service Worker: アプリ本体と保存済みタイルをオフラインで返す */
const SHELL = 'fm-shell-v4';
const TILE_CACHE = 'fm-tiles-v1';
const DATA_CACHE = 'fm-data-v1';
const SHELL_FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'lib/leaflet.min.js', 'lib/leaflet.min.css', 'lib/topojson-client.min.js', 'lib/fflate.min.js', 'lib/flatgeobuf-geojson.min.js',
  'lib/images/layers.png', 'lib/images/layers-2x.png', 'lib/images/marker-icon.png', 'lib/images/marker-icon-2x.png', 'lib/images/marker-shadow.png',
];
const TILE_HOSTS = ['cyberjapandata.gsi.go.jp', 'www.biodic.go.jp', 'gbank.gsj.jp'];
const DATA_HOSTS = ['geoshape.ex.nii.ac.jp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('fm-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // タイル: 保存済みならそれを返す。無ければネットワーク（自動保存はしない）
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req.url, { cacheName: TILE_CACHE, ignoreVary: true });
      if (hit) return hit;
      try { return await fetch(req); } catch { return new Response('', { status: 504 }); }
    })());
    return;
  }
  // 旧市町村界など: キャッシュ優先
  if (DATA_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(DATA_CACHE);
      const hit = await c.match(req.url); if (hit) return hit;
      const r = await fetch(req); if (r.ok) c.put(req.url, r.clone()); return r;
    })());
    return;
  }
  // アプリ本体: ネットワーク優先、失敗したらキャッシュ
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok && !url.pathname.includes('/local/') && !url.pathname.includes('/data/')) (await caches.open(SHELL)).put(req, r.clone());
        return r;
      } catch {
        return (await caches.match(req, { cacheName: SHELL, ignoreSearch: true })) || (await caches.match('index.html', { cacheName: SHELL }));
      }
    })());
  }
});
