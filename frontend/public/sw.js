// HYPD Games Service Worker
// Handles caching strategies for optimal performance

const CACHE_NAME = 'hypd-games-v1';
const STATIC_CACHE = 'hypd-static-v1';
const GAME_CACHE = 'hypd-games-cache-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/explore',
  '/pro',
  '/profile',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== GAME_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) return;

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Game assets - cache first for performance
  if (url.pathname.includes('/games/') && url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirstStrategy(request, GAME_CACHE));
    return;
  }

  // Static assets - stale while revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// Network first strategy (for API)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    
    throw error;
  }
}

// Cache first strategy (for game assets)
async function cacheFirstStrategy(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      caches.open(cacheName).then((cache) => {
        cache.put(request, networkResponse.clone());
      });
    }
    return networkResponse;
  });

  return cachedResponse || fetchPromise;
}

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_GAME') {
    const gameId = event.data.gameId;
    precacheGame(gameId);
  }
});

// Pre-cache a specific game's assets
async function precacheGame(gameId) {
  console.log(`[SW] Pre-caching game: ${gameId}`);
  
  try {
    const cache = await caches.open(GAME_CACHE);
    const apiUrl = self.registration.scope.replace(/\/$/, '');
    
    // Pre-fetch game metadata
    const metaUrl = `${apiUrl}/api/games/${gameId}/meta`;
    const metaResponse = await fetch(metaUrl);
    if (metaResponse.ok) {
      cache.put(metaUrl, metaResponse);
    }
    
    // Note: We don't pre-fetch the actual game file as it may be large
    // The game will load normally when the user clicks play
    
    console.log(`[SW] Game ${gameId} pre-cached`);
  } catch (error) {
    console.error(`[SW] Failed to pre-cache game ${gameId}:`, error);
  }
}
