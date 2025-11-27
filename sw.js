self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('music-player-store').then((cache) => cache.addAll([
      './',
      './index.html',
      './style.css',
      './script.js',
      './logo.png',
      // Add your Bootstrap paths here if downloaded locally
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});