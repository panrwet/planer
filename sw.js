/* Service Worker: hält die App offline lauffähig.
   Strategie: eigene Dateien beim Installieren in den Cache, danach
   "stale-while-revalidate" – sofort aus dem Cache anzeigen und im Hintergrund
   aktualisieren. Nutzerdaten liegen in localStorage und sind hiervon
   vollständig unberührt. */

const VERSION = 'planer-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/ui.js',
  './js/util.js',
  './js/habits.js',
  './js/habitDetail.js',
  './js/todos.js',
  './js/drag.js',
  './js/emoji.js',
  './js/settings.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(VERSION).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      return cached || network;
    }),
  );
});
