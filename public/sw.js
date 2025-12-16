// استخدم timestamp عشوائي لضمان تحديث الـ cache مع كل deployment
const CACHE_VERSION = 'v' + Math.floor(Date.now() / 1000)
const CACHE_NAME = 'equipment-manager-' + CACHE_VERSION
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png'
]

self.addEventListener('install', event => {
  console.log('[SW] Installing:', CACHE_NAME)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets')
        return cache.addAll(ASSETS_TO_CACHE)
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install error:', err))
  )
})

self.addEventListener('activate', event => {
  console.log('[SW] Activating:', CACHE_NAME)
  event.waitUntil(
    caches.keys()
      .then(keys => {
        console.log('[SW] Deleting old caches:', keys)
        return Promise.all(keys.map(key => caches.delete(key)))
      })
      .then(() => {
        console.log('[SW] All old caches deleted')
        return self.clients.claim()
      })
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) {
    return
  }

  // للـ index.html والـ JS/CSS: استخدم network first (الخادم أولاً)
  if (request.url.includes('index.html') || request.url.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => caches.match(request))
    )
    return
  }

  // للأصول الأخرى: استخدم cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        return response
      }).catch(() => cached)
    })
  )
})
