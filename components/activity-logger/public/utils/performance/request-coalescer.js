/**
 * Request Coalescer - Prevents duplicate API requests
 * Coalesces multiple simultaneous requests to the same endpoint
 */

class RequestCoalescer {
  constructor() {
    // Map of pending requests: endpoint -> Promise
    this.pendingRequests = new Map();
    
    // Request metadata for analytics
    this.stats = {
      total: 0,
      coalesced: 0,
      saved: 0
    };
  }

  /**
   * Coalesce a request - returns existing promise if one is pending
   * @param {string} key - Unique identifier for the request
   * @param {Function} requestFn - Function that returns a promise
   * @returns {Promise} - The coalesced or new request promise
   */
  async request(key, requestFn) {
    this.stats.total++;
    
    // Check if request is already in flight
    if (this.pendingRequests.has(key)) {
      this.stats.coalesced++;
      console.log(`[COALESCE] Reusing pending request: ${key}`);
      return this.pendingRequests.get(key);
    }
    
    // Create new request
    const requestPromise = (async () => {
      try {
        const result = await requestFn();
        // Remove from pending after successful completion
        this.pendingRequests.delete(key);
        return result;
      } catch (error) {
        // Remove from pending on error too
        this.pendingRequests.delete(key);
        throw error;
      }
    })();
    
    // Store pending request
    this.pendingRequests.set(key, requestPromise);
    
    return requestPromise;
  }

  /**
   * Clear all pending requests (useful for cleanup)
   */
  clear() {
    this.pendingRequests.clear();
  }

  /**
   * Get statistics about request coalescing
   */
  getStats() {
    const savedPercentage = this.stats.total > 0 
      ? ((this.stats.coalesced / this.stats.total) * 100).toFixed(1)
      : 0;
    
    return {
      ...this.stats,
      savedPercentage: `${savedPercentage}%`
    };
  }
}

// Create global instance
window.requestCoalescer = window.requestCoalescer || new RequestCoalescer();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RequestCoalescer;
}



