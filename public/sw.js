/* 天时 Service Worker
   策略：应用外壳 cache-first（离线可用）；天气/存档接口 network-only（数据必须新鲜） */
const VERSION = '@VERSION@';
const CACHE   = 'meridian-' + VERSION;
const ASSETS  = @ASSETS@;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      /* 连旧的 tianshi- 前缀一起清。改名之前装过 PWA 的人，
         浏览器里还留着老缓存，不清就会一直占着空间。 */
      .then(ks => Promise.all(ks
        .filter(k => (k.startsWith('meridian-') || k.startsWith('tianshi-')) && k !== CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  /* 接口一律走网络，不缓存 —— 天气数据缓存了反而有害 */
  if (/open-meteo\.com$/.test(url.hostname)) return;
  /* 同源资源：cache-first，后台更新 */
  if (url.origin !== location.origin) return;

  /* 导航请求：network-first，保证用户不会长期停在旧版本 */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => { const c = res.clone();
          caches.open(CACHE).then(x => x.put(e.request, c)).catch(()=>{});
          return res; })
        .catch(() => caches.match(e.request).then(h => h || caches.match('./index.html')))
    );
    return;
  }
  /* 其他同源资源：cache-first + 后台更新（用 waitUntil 保证写得完） */
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const c = res.clone();
          e.waitUntil(caches.open(CACHE).then(x => x.put(e.request, c)).catch(()=>{}));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
