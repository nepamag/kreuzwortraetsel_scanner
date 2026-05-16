const CACHE = 'crossword-pwa-v3';

// Everything required for the app to work fully offline.
// Tesseract.js v5 chooses a CPU-specific core variant at runtime
// (relaxedsimd-lstm / simd-lstm / lstm), so we cache all of them
// plus the matching .wasm binaries.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',

  // OpenCV
  './libs/opencv.js',

  // Tesseract.js core dispatcher + worker
  './libs/tesseract.min.js',
  './libs/worker.min.js',

  // Tesseract core variants (JS loaders)
  './libs/tesseract-core-relaxedsimd-lstm.wasm.js',
  './libs/tesseract-core-simd-lstm.wasm.js',
  './libs/tesseract-core-lstm.wasm.js',

  // Tesseract core variants (wasm binaries — the big ones)
  './libs/tesseract-core-relaxedsimd-lstm.wasm',
  './libs/tesseract-core-simd-lstm.wasm',
  './libs/tesseract-core-lstm.wasm',

  // Language data
  './libs/lang-data/deu.traineddata'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      // addAll is atomic: if any single file fails, the whole install fails.
      // We use individual adds so a missing optional file doesn't break the SW.
      await Promise.all(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only handle GETs; let everything else pass through.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Opportunistically cache successful same-origin responses.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // If everything fails (offline + not in cache), at least surface
        // a useful error rather than a generic network failure.
        return new Response('Offline and resource not cached.', {
          status: 503,
          statusText: 'Offline'
        });
      });
    })
  );
});
