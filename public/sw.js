// Ultreia service worker: web push + offline shell.
// Network first, always; the cache only answers when the network fails.
const CACHE_V = 'ultreia-v1'
const NAV_TIMEOUT_MS = 6000

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys()
  await Promise.all(keys.filter(k => k !== CACHE_V).map(k => caches.delete(k)))
  await self.clients.claim()
})()))

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }, e => { clearTimeout(t); reject(e) })
  })
}

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  const isNav = req.mode === 'navigate'
  const isStatic = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')
  const isApi = url.pathname.startsWith('/api/walk/')
  if (!isNav && !isStatic && !isApi) return
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_V)
    try {
      const res = await withTimeout(fetch(req), isNav ? NAV_TIMEOUT_MS : 15000)
      if (res && res.ok) cache.put(req, res.clone())
      return res
    } catch {
      const hit = await cache.match(req, { ignoreSearch: isNav })
      if (hit) return hit
      if (isNav) return new Response('<meta charset=utf-8><title>Ultreia</title><p style="font:16px system-ui;padding:24px">No signal yet. Try again in a moment.</p>', { headers: { 'Content-Type': 'text/html' } })
      throw new Error('offline')
    }
  })())
})

self.addEventListener('push', e => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch {}
  e.waitUntil(self.registration.showNotification(data.title || 'Ultreia', {
    body: data.body || '', tag: data.tag || 'ultreia', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus() }
    return self.clients.openWindow(url)
  }))
})
