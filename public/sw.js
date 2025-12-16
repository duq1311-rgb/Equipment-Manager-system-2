// نسخة ثابتة لوقف تحديث الـ cache في كل زيارة (حدّثها يدوياً عند النشر)
const CACHE_VERSION = 'v2025-12-17-1'
const CACHE_NAME = 'equipment-manager-' + CACHE_VERSION
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.png'
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
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
