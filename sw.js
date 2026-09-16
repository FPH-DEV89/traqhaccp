/**
 * TraqHACCP Pro - Service Worker
 * Provides 100% offline cache for kitchen tablets and mobile devices.
 */

const CACHE_NAME = 'traqhaccp-v3-cache';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/domain/constants.js',
  './src/domain/entities.js',
  './src/application/usecases.js',
  './src/infrastructure/storage_repository.js',
  './src/infrastructure/audio_service.js',
  './src/infrastructure/barcode_service.js',
  './src/infrastructure/camera_service.js',
  './src/presentation/store.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn("Some static assets could not be cached immediately", err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback if not in cache
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
