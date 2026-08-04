/* v7.0.0 (v1.0 release fix): network-first 缓存 — 在线永远最新，离线降级缓存（修复 F5 命中旧缓存） */
/* eslint-disable */
const CACHE = 'tang-v7-0-0';
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
  // 只处理同源 GET（API 请求不缓存，保证云存档/裁决实时）
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  if (req.url.includes('/api/')) return;

  // network-first：先取网络（在线时永远是服务器最新版，F5 不再命中旧缓存），
  // 网络失败（离线）时降级到缓存；成功后回填缓存。
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
