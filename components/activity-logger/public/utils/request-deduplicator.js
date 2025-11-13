/**
 * Request Deduplicator
 * Prevents duplicate API calls and implements intelligent caching
 */

class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
    this.responseCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes default TTL
  }

  /**
   * Get cached response or make request
   */
  async request(key, requestFn, ttl = null) {
    const cacheKey = typeof key === 'string' ? key : JSON.stringify(key);
    const effectiveTTL = ttl || this.cacheTTL;

    // Check cache first
    if (this.responseCache.has(cacheKey)) {
      const cached = this.responseCache.get(cacheKey);
      if (Date.now() - cached.timestamp < effectiveTTL) {
        return cached.data;
      }
      this.responseCache.delete(cacheKey);
    }

    // Check if request is already pending
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Make new request
    const requestPromise = requestFn()
      .then(data => {
        // Cache successful response
        this.responseCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
        this.pendingRequests.delete(cacheKey);
        return data;
      })
      .catch(error => {
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.responseCache.clear();
      return;
    }

    for (const key of this.responseCache.keys()) {
      if (key.includes(pattern)) {
        this.responseCache.delete(key);
      }
    }
  }

  /**
   * Invalidate cache for specific key
   */
  invalidate(key) {
    const cacheKey = typeof key === 'string' ? key : JSON.stringify(key);
    this.responseCache.delete(cacheKey);
    this.pendingRequests.delete(cacheKey);
  }
}

window.RequestDeduplicator = RequestDeduplicator;
window.requestDeduplicator = new RequestDeduplicator();






