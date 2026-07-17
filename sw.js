/* ===== SW.JS - Service Worker for Notifications ===== */

const CACHE_NAME = 'lemburku-v3';
const ASSETS = [
    '/overtime-app/',
    '/overtime-app/index.html',
    '/overtime-app/style.css',
    '/overtime-app/app.js',
    '/overtime-app/calc.js',
    '/overtime-app/data.js',
    '/overtime-app/utils.js',
    '/overtime-app/cloud.js',
    '/overtime-app/notification.js',
    '/overtime-app/manifest.json',
    '/overtime-app/icon-192.png',
    '/overtime-app/icon-512.png'
];

// Install
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS).catch(e => {
                console.log('Some assets failed to cache:', e);
            });
        })
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request);
        })
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Focus existing window or open new
            for (const client of clientList) {
                if (client.url.includes('overtime-app') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data?.url || '/overtime-app/');
            }
        })
    );
});
