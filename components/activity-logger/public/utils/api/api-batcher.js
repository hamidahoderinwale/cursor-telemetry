/**
 * API Request Batching Utility
 * Batches multiple API requests to reduce network overhead
 */

class APIBatcher {
  constructor(options = {}) {
    this.batchDelay = options.batchDelay || 50; // ms to wait before batching
    this.maxBatchSize = options.maxBatchSize || 10;
    this.pendingRequests = [];
    this.batchTimeout = null;
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
  }
  
  /**
   * Add request to batch
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise}
   */
  async batchRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        endpoint,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Clear existing timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      // If batch is full, execute immediately
      if (this.pendingRequests.length >= this.maxBatchSize) {
        this.executeBatch();
      } else {
        // Otherwise, wait for batch delay
        this.batchTimeout = setTimeout(() => {
          this.executeBatch();
        }, this.batchDelay);
      }
    });
  }
  
  /**
   * Execute pending batch
   */
  async executeBatch() {
    if (this.pendingRequests.length === 0) return;
    
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    // Group requests by endpoint for better batching
    const grouped = this.groupRequests(requests);
    
    // Execute batches
    const results = await Promise.allSettled(
      Object.entries(grouped).map(([endpoint, reqs]) => 
        this.executeBatchGroup(endpoint, reqs)
      )
    );
    
    // Resolve/reject individual promises
    requests.forEach((req, index) => {
      const result = results.find(r => 
        r.status === 'fulfilled' && 
        r.value.some(v => v.endpoint === req.endpoint)
      );
      
      if (result && result.status === 'fulfilled') {
        const match = result.value.find(v => v.endpoint === req.endpoint);
        if (match && match.success) {
          req.resolve(match.data);
        } else {
          req.reject(new Error(match?.error || 'Batch request failed'));
        }
      } else {
        req.reject(new Error('Batch execution failed'));
      }
    });
  }
  
  /**
   * Group requests by endpoint
   */
  groupRequests(requests) {
    const grouped = {};
    requests.forEach(req => {
      if (!grouped[req.endpoint]) {
        grouped[req.endpoint] = [];
      }
      grouped[req.endpoint].push(req);
    });
    return grouped;
  }
  
  /**
   * Execute a group of requests for the same endpoint
   */
  async executeBatchGroup(endpoint, requests) {
    // For now, execute in parallel (can be optimized with actual batching endpoint)
    return Promise.all(
      requests.map(async (req) => {
        try {
          const response = await fetch(`${this.apiBase}${req.endpoint}`, {
            ...req.options,
            signal: req.options.signal || (() => {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), req.options.timeout || 20000);
              return { signal: controller.signal, timeout };
            })()
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          return { endpoint: req.endpoint, success: true, data };
        } catch (error) {
          return { endpoint: req.endpoint, success: false, error: error.message };
        }
      })
    );
  }
  
  /**
   * Flush pending requests immediately
   */
  flush() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    return this.executeBatch();
  }
}

// Create global instance
window.apiBatcher = new APIBatcher();

/**
 * Enhanced API Client with batching support
 */
class BatchedAPIClient {
  static async get(endpoint, options = {}) {
    // Use batching for non-critical requests
    if (options.batch !== false && !options.urgent) {
      return window.apiBatcher.batchRequest(endpoint, options);
    }
    
    // Use regular API client for urgent requests
    if (window.APIClient) {
      return window.APIClient.get(endpoint, options);
    }
    
    // Fallback
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}${endpoint}`, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  
  static async post(endpoint, data, options = {}) {
    // POST requests are usually not batched
    if (window.APIClient) {
      return window.APIClient.post(endpoint, data, options);
    }
    
    // Fallback
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      ...options
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}

window.BatchedAPIClient = BatchedAPIClient;

