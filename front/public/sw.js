// Basic PWA service worker for GreenSeam AI
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Network-first for navigation requests; SWR for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req)
        return fresh
      } catch (e) {
        const cache = await caches.open('gs-cache')
        const cached = await cache.match('/')
        if (cached) return cached
        throw e
      }
    })())
    return
  }

  if (req.method === 'GET' && /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open('gs-cache')
      const cached = await cache.match(req)
      const network = fetch(req).then((res) => {
        cache.put(req, res.clone()).catch(() => {})
        return res
      }).catch(() => cached)
      return cached || network
    })())
  }
})
