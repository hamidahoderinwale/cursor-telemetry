/**
 * Performance Optimization Utilities
 * Provides caching, debouncing, throttling, and memoization
 */

class PerformanceOptimizer {
  constructor() {
    this.cache = new Map();
    this.debounceTimers = new Map();
    this.throttleTimers = new Map();
    this.requestQueue = [];
    this.processingQueue = false;
  }

  /**
   * Memoize function results with cache
   */
  memoize(fn, keyGenerator = null, ttl = null) {
    return (...args) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      const cacheKey = `${fn.name || 'anonymous'}_${key}`;
      
      // Check cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (!ttl || (Date.now() - cached.timestamp) < ttl) {
          return cached.value;
        }
        this.cache.delete(cacheKey);
      }
      
      // Execute and cache
      const result = fn(...args);
      this.cache.set(cacheKey, {
        value: result,
        timestamp: Date.now()
      });
      
      return result;
    };
  }

  /**
   * Debounce function calls
   */
  debounce(fn, delay = 300) {
    return (...args) => {
      const key = fn.name || 'anonymous';
      
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }
      
      const timer = setTimeout(() => {
        fn(...args);
        this.debounceTimers.delete(key);
      }, delay);
      
      this.debounceTimers.set(key, timer);
    };
  }

  /**
   * Throttle function calls
   */
  throttle(fn, delay = 300) {
    return (...args) => {
      const key = fn.name || 'anonymous';
      
      if (this.throttleTimers.has(key)) {
        return;
      }
      
      fn(...args);
      
      const timer = setTimeout(() => {
        this.throttleTimers.delete(key);
      }, delay);
      
      this.throttleTimers.set(key, timer);
    };
  }

  /**
   * Batch DOM updates using requestAnimationFrame
   */
  batchDOMUpdates(updates) {
    if (typeof requestAnimationFrame === 'undefined') {
      // Fallback for non-browser environments
      updates.forEach(update => update());
      return;
    }
    
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  }

  /**
   * Batch API requests
   */
  async batchRequests(requests, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(req => req())
      );
      results.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming server
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return results;
  }

  /**
   * Clear cache
   */
  clearCache(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Optimize array operations
   */
  optimizeArrayOperation(array, operation, chunkSize = 1000) {
    if (array.length <= chunkSize) {
      return operation(array);
    }
    
    const results = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      results.push(...operation(chunk));
      
      // Yield to event loop periodically
      if (i + chunkSize < array.length) {
        // Use setTimeout(0) to yield
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(this.optimizeArrayOperation(
              array.slice(i + chunkSize),
              operation,
              chunkSize
            ));
          }, 0);
        });
      }
    }
    
    return results;
  }

  /**
   * Lazy load data with intersection observer
   */
  lazyLoad(selector, callback, options = {}) {
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: load immediately
      const elements = document.querySelectorAll(selector);
      elements.forEach(callback);
      return;
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          callback(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px',
      ...options
    });
    
    document.querySelectorAll(selector).forEach(el => observer.observe(el));
  }
}

// Create global instance
window.PerformanceOptimizer = PerformanceOptimizer;
window.performanceOptimizer = new PerformanceOptimizer();

// Export utility functions
window.memoize = (fn, keyGen, ttl) => window.performanceOptimizer.memoize(fn, keyGen, ttl);
window.debounce = (fn, delay) => window.performanceOptimizer.debounce(fn, delay);
window.throttle = (fn, delay) => window.performanceOptimizer.throttle(fn, delay);
window.batchDOMUpdates = (updates) => window.performanceOptimizer.batchDOMUpdates(updates);
window.batchRequests = (requests, batchSize) => window.performanceOptimizer.batchRequests(requests, batchSize);






