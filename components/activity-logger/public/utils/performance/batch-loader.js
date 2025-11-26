/**
 * Batch Loader - Optimizes API requests by batching multiple requests together
 * 
 * Benefits:
 * - Reduces number of HTTP requests
 * - Improves network efficiency
 * - Decreases server load
 * - Faster overall page load times
 */

class BatchLoader {
  constructor(options = {}) {
    this.options = {
      batchDelay: options.batchDelay || 50, // ms to wait before sending batch
      maxBatchSize: options.maxBatchSize || 10, // max requests per batch
      baseUrl: options.baseUrl || '',
      ...options
    };
    
    this.pendingRequests = new Map();
    this.batchTimeout = null;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 60000; // 1 minute default
  }

  /**
   * Load a single resource, automatically batched with other concurrent requests
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise} Response data
   */
  async load(endpoint, params = {}) {
    const cacheKey = this._getCacheKey(endpoint, params);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    // Return existing pending request if available
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Create new request promise
    const promise = new Promise((resolve, reject) => {
      this._addToBatch({ endpoint, params, resolve, reject, cacheKey });
    });

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  /**
   * Load multiple resources in parallel (still batched)
   * @param {Array} requests - Array of {endpoint, params} objects
   * @returns {Promise<Array>} Array of responses
   */
  async loadMany(requests) {
    return Promise.all(requests.map(req => this.load(req.endpoint, req.params)));
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Prefetch data for later use
   * @param {string} endpoint 
   * @param {Object} params 
   */
  prefetch(endpoint, params = {}) {
    this.load(endpoint, params).catch(() => {
      // Ignore prefetch errors
    });
  }

  _addToBatch(request) {
    if (!this.currentBatch) {
      this.currentBatch = [];
    }

    this.currentBatch.push(request);

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Send batch immediately if max size reached
    if (this.currentBatch.length >= this.options.maxBatchSize) {
      this._sendBatch();
    } else {
      // Otherwise wait for more requests
      this.batchTimeout = setTimeout(() => this._sendBatch(), this.options.batchDelay);
    }
  }

  async _sendBatch() {
    if (!this.currentBatch || this.currentBatch.length === 0) {
      return;
    }

    const batch = this.currentBatch;
    this.currentBatch = [];
    this.batchTimeout = null;

    try {
      // Group requests by endpoint
      const grouped = {};
      batch.forEach(req => {
        if (!grouped[req.endpoint]) {
          grouped[req.endpoint] = [];
        }
        grouped[req.endpoint].push(req);
      });

      // Send batched requests
      const promises = Object.entries(grouped).map(async ([endpoint, requests]) => {
        try {
          // If multiple requests to same endpoint, batch them
          if (requests.length === 1) {
            const req = requests[0];
            const url = this._buildUrl(endpoint, req.params);
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache and resolve
            this._cacheResponse(req.cacheKey, data);
            req.resolve(data);
            this.pendingRequests.delete(req.cacheKey);
          } else {
            // Batch multiple requests to same endpoint
            const batchUrl = this._buildBatchUrl(endpoint, requests);
            const response = await fetch(batchUrl);
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Distribute responses to individual requests
            if (Array.isArray(data) && data.length === requests.length) {
              requests.forEach((req, i) => {
                this._cacheResponse(req.cacheKey, data[i]);
                req.resolve(data[i]);
                this.pendingRequests.delete(req.cacheKey);
              });
            } else {
              // Fallback: send individual requests
              for (const req of requests) {
                const url = this._buildUrl(endpoint, req.params);
                const individualResponse = await fetch(url);
                const individualData = await individualResponse.json();
                this._cacheResponse(req.cacheKey, individualData);
                req.resolve(individualData);
                this.pendingRequests.delete(req.cacheKey);
              }
            }
          }
        } catch (error) {
          // Reject all requests in this group
          requests.forEach(req => {
            req.reject(error);
            this.pendingRequests.delete(req.cacheKey);
          });
        }
      });

      await Promise.all(promises);
    } catch (error) {
      // Reject all requests on batch failure
      batch.forEach(req => {
        req.reject(error);
        this.pendingRequests.delete(req.cacheKey);
      });
    }
  }

  _buildUrl(endpoint, params) {
    const url = new URL(endpoint, this.options.baseUrl || window.location.origin);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    return url.toString();
  }

  _buildBatchUrl(endpoint, requests) {
    const url = new URL(endpoint, this.options.baseUrl || window.location.origin);
    url.searchParams.append('batch', 'true');
    url.searchParams.append('count', requests.length);
    
    // Add all parameter sets
    requests.forEach((req, i) => {
      Object.entries(req.params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(`${i}_${key}`, value);
        }
      });
    });
    
    return url.toString();
  }

  _getCacheKey(endpoint, params) {
    return `${endpoint}?${JSON.stringify(params || {})}`;
  }

  _cacheResponse(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(key);
        }
      }
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.BatchLoader = BatchLoader;
  window.batchLoader = new BatchLoader({
    baseUrl: window.location.origin,
    batchDelay: 50,
    maxBatchSize: 10,
    cacheTimeout: 60000
  });
}

export default BatchLoader;




