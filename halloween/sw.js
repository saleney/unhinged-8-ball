'use strict';
// Change this version for every release; each version installs atomically.
const CACHE = 'unhinged-halloween-v9-private-import';
const FILES = ['index.html','halloween.css','pwa.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','voice-store.js'];
const urls = FILES.map(file => new URL(file,self.registration.scope).href);
self.addEventListener('install',event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)));
  // Updates wait for all old windows to close, avoiding mixed versions.
});
self.addEventListener('activate',event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('unhinged-halloween-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const isEntry = event.request.mode === 'navigate' && (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL('index.html',self.registration.scope).pathname);
  const canonical = isEntry ? urls[0] : url.href;
  if (!urls.includes(canonical)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(canonical);
    if (saved) return saved;
    const response = await fetch(canonical);
    if (response.ok) await cache.put(canonical,response.clone());
    return response;
  })());
});
self.addEventListener('message',event => {
  if (event.data && event.data.type === 'CHECK_OFFLINE') event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const saved = await Promise.all(urls.map(url => cache.match(url)));
    if (event.ports[0]) event.ports[0].postMessage({ready:saved.every(Boolean),version:CACHE});
  })());
});
