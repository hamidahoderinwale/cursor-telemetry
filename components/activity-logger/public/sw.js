/**
 * Service Worker for Cursor Telemetry Dashboard
 * Provides offline support and caching for better performance
 */

const CACHE_NAME = 'cursor-telemetry-v4';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Assets to cache immediately (critical path only)
const PRECACHE_ASSETS = [
  '/dashboard.html',
  '/dashboard.css',
  '/core/config.js',
  '/core/state.js',
  '/core/api-client.js',
  '/utils/core/helpers.js',
  '/utils/dom/templates.js',
  '/utils/formatting/time-formatting.js',
  '/views/activity/timeline-helpers.js',
  '/app/status-popup.js',
  '/dashboard.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      // Cache assets individually to prevent one failure from blocking installation
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => {
          return fetch(new Request(url, {cache: 'reload'}))
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              } else {
                console.warn(`[SW] Failed to cache ${url}: ${response.status} ${response.statusText}`);
              }
            })
            .catch(err => {
              console.warn(`[SW] Failed to fetch ${url}:`, err.message);
              // Don't throw - allow other assets to cache
            });
        })
      ).then(() => {
        console.log('[SW] Asset caching complete');
      });
    }).catch(err => {
      console.warn('[SW] Failed to open cache:', err);
      // Don't fail installation if cache fails
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
  
  // Always fetch templates.js fresh (don't cache)
  if (url.pathname.includes('templates.js')) {
    event.respondWith(
      fetch(request).then(response => {
        // Return fresh response, don't cache
        return response;
      }).catch(() => {
        // Fallback to cache only if network fails
        return caches.match(request);
      })
    );
    return;
  }
  
  // CRITICAL: Don't intercept cross-origin requests (different hostname or port)
  // This prevents CORS/OpaqueResponseBlocking errors
  const isCrossOrigin = url.hostname !== self.location.hostname || 
                        url.port !== self.location.port;
  
  // Also don't intercept API requests (even same-origin) - they need fresh data
  const isAPIRequest = url.pathname.startsWith('/api/') || 
                       url.pathname.startsWith('/health') ||
                       url.pathname.startsWith('/entries');
  
  if (isCrossOrigin || isAPIRequest) {
    // For cross-origin and API requests, don't intercept - let browser handle CORS directly
    // This prevents opaque response blocking errors
    return; // Let the request pass through without ServiceWorker interception
  }
  
  // Only cache GET requests for same-origin static assets
  if (request.method !== 'GET') {
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
  
  // Background sync request
  if (event.data && event.data.type === 'SYNC_DATA') {
    event.waitUntil(syncDataInBackground());
  }
});

/**
 * Background sync function - fetches data even when tab is closed
 */
async function syncDataInBackground() {
  try {
    // Get API base URL from stored config or use default
    const clients = await self.clients.matchAll();
    if (clients.length === 0) return;
    
    // Try to get config from first client
    const client = clients[0];
    const apiBase = client.url.includes('localhost') ? 'http://localhost:43917' : 
                    (client.url.match(/https?:\/\/[^\/]+/) || [])[0] || 'http://localhost:43917';
    
    // Fetch latest data
    const response = await fetch(`${apiBase}/queue?since=0`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Store in IndexedDB via postMessage to client
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_SYNC_DATA',
          data: data
        });
      });
    }
  } catch (error) {
    // Silently handle errors in background sync
  }
}

// Background sync event (when browser decides to sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data' || event.tag === 'sync-analytics') {
    event.waitUntil(syncDataInBackground());
  }
});

// Periodic background sync (Chrome/Edge)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-data' || event.tag === 'sync-analytics') {
    event.waitUntil(syncDataInBackground());
  }
});

console.log('[SW] Service worker loaded');

