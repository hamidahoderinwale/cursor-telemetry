/**
 * Service Worker for Cursor Telemetry Dashboard
 * Provides offline support and caching for better performance
 */

const CACHE_NAME = 'cursor-telemetry-v1';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Assets to cache immediately
const PRECACHE_ASSETS = [
  '/new-dashboard.html',
  '/new-dashboard.js',
  '/new-dashboard.css',
  '/persistent-storage.js',
  '/data-synchronizer.js',
  '/analytics-aggregator.js',
  '/search-engine.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, {cache: 'reload'})));
    }).catch(err => {
      console.warn('[SW] Failed to cache some assets:', err);
    })
  );
  
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  return self.clients.claim(); // Take control immediately
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only cache GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Don't cache API calls - they need to be fresh
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/health')) {
    event.respondWith(
      fetch(request).then((response) => {
        // Cache API responses for 30 seconds
        if (response.ok && shouldCacheAPIResponse(url.pathname)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
            // Set expiry metadata
            setTimeout(() => {
              cache.delete(request);
            }, CACHE_DURATION);
          });
        }
        return response;
      }).catch(() => {
        // Try to serve stale cache on network failure
        return caches.match(request).then((cached) => {
          if (cached) {
            console.log('[SW] Serving stale API cache:', url.pathname);
            return cached;
          }
          return new Response(JSON.stringify({ error: 'Network unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }
  
  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached version and update in background
        fetchAndCache(request);
        return cached;
      }
      
      // Not in cache, fetch from network
      return fetchAndCache(request);
    })
  );
});

// Helper: Fetch and cache
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.warn('[SW] Fetch failed:', request.url, error);
    throw error;
  }
}

// Helper: Should cache API response
function shouldCacheAPIResponse(pathname) {
  // Cache these API endpoints
  const cacheableEndpoints = [
    '/api/activity',
    '/api/analytics/',
    '/api/database/stats',
    '/api/workspaces'
  ];
  
  return cacheableEndpoints.some(endpoint => pathname.startsWith(endpoint));
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

console.log('[SW] Service worker loaded');

