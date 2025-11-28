/**
 * Optimized API Client Wrapper
 * Adds request coalescing, caching, and performance tracking to API calls
 */

class OptimizedAPIClient {
  constructor(baseClient) {
    this.baseClient = baseClient || window.APIClient;
    this.requestCoalescer = window.requestCoalescer;
    this.performanceMonitor = window.performanceMonitor;
    
    // Simple in-memory cache
    this.cache = new Map();
    this.defaultCacheTTL = 2 * 60 * 1000; // 2 minutes
    
    // Request queue for batch processing
    this.requestQueue = new Map();
    this.queueTimeout = null;
    this.queueDelay = 50; // ms
  }

  /**
   * Get data with caching and coalescing
   */
  async get(endpoint, options = {}) {
    const {
      cacheTTL = this.defaultCacheTTL,
      skipCache = false,
      skipCoalesce = false,
      ...restOptions
    } = options;
    
    // Generate cache key
    const cacheKey = this.getCacheKey(endpoint, restOptions);
    
    // Check cache first (if not skipped)
    if (!skipCache && cacheTTL > 0) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`[OPT-API] Cache hit: ${endpoint}`);
        return cached;
      }
    }
    
    // Use request coalescer (if not skipped)
    const requestFn = async () => {
      const startTime = performance.now();
      
      try {
        const response = await this.baseClient.get(endpoint, restOptions);
        
        const duration = performance.now() - startTime;
        
        // Track performance
        if (this.performanceMonitor) {
          this.performanceMonitor.trackAPICall(endpoint, duration, true);
        }
        
        // Cache response
        if (!skipCache && cacheTTL > 0) {
          this.setCache(cacheKey, response, cacheTTL);
        }
        
        return response;
        
      } catch (error) {
        const duration = performance.now() - startTime;
        
        // Track failed request
        if (this.performanceMonitor) {
          this.performanceMonitor.trackAPICall(endpoint, duration, false);
        }
        
        throw error;
      }
    };
    
    // Coalesce request
    if (!skipCoalesce && this.requestCoalescer) {
      return this.requestCoalescer.request(cacheKey, requestFn);
    }
    
    return requestFn();
  }

  /**
   * Batch multiple GET requests
   */
  async batchGet(requests) {
    const startTime = performance.now();
    
    const results = await Promise.allSettled(
      requests.map(req => this.get(req.endpoint, req.options))
    );
    
    const duration = performance.now() - startTime;
    console.log(`[OPT-API] Batch request completed in ${duration.toFixed(2)}ms`);
    
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    );
  }

  /**
   * POST request (no caching)
   */
  async post(endpoint, data, options = {}) {
    const startTime = performance.now();
    
    try {
      const response = await this.baseClient.post(endpoint, data, options);
      
      const duration = performance.now() - startTime;
      
      if (this.performanceMonitor) {
        this.performanceMonitor.trackAPICall(endpoint, duration, true);
      }
      
      // Invalidate related cache entries
      this.invalidateCache(endpoint);
      
      return response;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      if (this.performanceMonitor) {
        this.performanceMonitor.trackAPICall(endpoint, duration, false);
      }
      
      throw error;
    }
  }

  /**
   * Generate cache key from endpoint and options
   */
  getCacheKey(endpoint, options) {
    const sortedOptions = Object.keys(options).sort().reduce((acc, key) => {
      acc[key] = options[key];
      return acc;
    }, {});
    
    return `${endpoint}:${JSON.stringify(sortedOptions)}`;
  }

  /**
   * Get from cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set cache
   */
  setCache(key, data, ttl) {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidateCache(pattern) {
    const keysToDelete = [];
    
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`[OPT-API] Invalidated ${keysToDelete.length} cache entries`);
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, value] of this.cache) {
      if (now > value.expires) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // Limit cache size
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      // Remove oldest 20 entries
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 20)
        .forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[OPT-API] Cache cleared');
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      coalescerStats: this.requestCoalescer?.getStats()
    };
  }

  /**
   * Preload endpoints (cache warming)
   */
  async preload(endpoints) {
    console.log(`[OPT-API] Preloading ${endpoints.length} endpoints...`);
    
    const requests = endpoints.map(endpoint => ({
      endpoint,
      options: { cacheTTL: 5 * 60 * 1000 } // 5 minute cache
    }));
    
    await this.batchGet(requests);
    
    console.log('[OPT-API] Preload complete');
  }
}

// Create global instance when APIClient is available
if (typeof window !== 'undefined') {
  window.OptimizedAPIClient = OptimizedAPIClient;
  
  // Auto-replace APIClient when it's available
  const initOptimizedClient = () => {
    if (window.APIClient && !window.APIClient._optimized) {
      const optimizedClient = new OptimizedAPIClient(window.APIClient);
      
      // Preserve original methods
      const originalClient = window.APIClient;
      
      // Replace with optimized version
      window.APIClient = {
        ...originalClient,
        get: optimizedClient.get.bind(optimizedClient),
        post: optimizedClient.post.bind(optimizedClient),
        batchGet: optimizedClient.batchGet.bind(optimizedClient),
        clearCache: optimizedClient.clearCache.bind(optimizedClient),
        getCacheStats: optimizedClient.getCacheStats.bind(optimizedClient),
        preload: optimizedClient.preload.bind(optimizedClient),
        _optimized: true,
        _optimizedClient: optimizedClient
      };
      
      console.log('[OPT-API] APIClient optimized');
    }
  };
  
  // Try to initialize immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptimizedClient);
  } else {
    initOptimizedClient();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedAPIClient;
}
















