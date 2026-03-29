/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';

// Injected at build time by vite-plugin-pwa (injectManifest).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
self.addEventListener('activate', () => {
  clientsClaim();
});

const scopeUrl = self.registration.scope;
const indexUrl = new URL('index.html', scopeUrl).href;
try {
  const navigationHandler = createHandlerBoundToURL(indexUrl);
  registerRoute(
    new NavigationRoute(navigationHandler, {
      denylist: [/^\/api(?:\/|$)/],
    })
  );
} catch {
  /* Precache may omit index in unusual builds; static assets still cached. */
}

setCatchHandler(async ({ event }) => {
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    const indexCached = await matchPrecache(indexUrl);
    if (indexCached) return indexCached;
    const offlineUrl = new URL('offline.html', scopeUrl).href;
    const off =
      (await matchPrecache(offlineUrl)) || (await caches.match(offlineUrl, { ignoreSearch: true }));
    if (off) return off;
  }
  return Response.error();
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'IronLog', body: event.data?.text() || '' };
  }
  const title = data.title || 'IronLog';
  const body = data.body || '';
  const iconUrl = new URL('iron-logger-logo.jpg', scopeUrl).href;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: iconUrl,
      badge: iconUrl,
      tag: 'ironlog-reminder',
    })
  );
});
