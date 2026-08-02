/* v6.0.0 (B3 PWA): 离线缓存 service worker — 静态导出站点可安装为 APP */
/* eslint-disable */
const CACHE = 'frosthold-v6-0-0';
const BASE = self.__WB_BASE_PATH__ || '';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // 只缓存同源 GET（API 请求不缓存，保证云存档/裁决实时）
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  if (req.url.includes('/api/')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
