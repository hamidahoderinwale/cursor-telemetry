/**
 * API Client with Request Debouncing
 */

const debouncedRequests = new Map();

function debounce(fn, delay = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => resolve(fn.apply(this, args)), delay);
    });
  };
}

class APIClient {
  static getApiBase() {
    return window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
  }

  static isOfflineError(error) {
    // Check if error is a CORS/network error (expected when companion service is offline)
    const errorMessage = error.message || error.toString();
    return errorMessage.includes('CORS') || 
           errorMessage.includes('NetworkError') || 
           errorMessage.includes('Failed to fetch') ||
           errorMessage.includes('network error') ||
           error.name === 'NetworkError' ||
           error.name === 'TypeError';
  }

  static async get(endpoint, options = {}) {
    const timeout = options.timeout || 20000; // 20 second default timeout
    const retries = options.retries || 1;
    const silent = options.silent || false; // Option to suppress error logging
    
    // Debounce repeated requests to the same endpoint
    const cacheKey = endpoint + JSON.stringify(options);
    if (debouncedRequests.has(cacheKey)) {
      if (!silent) {
        console.log(`[DEBOUNCE] Skipping duplicate request to ${endpoint}`);
      }
      return debouncedRequests.get(cacheKey);
    }
    
    const requestPromise = (async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          const apiBase = this.getApiBase();
          const response = await fetch(`${apiBase}${endpoint}`, {
            signal: controller.signal,
            ...options
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          // Mark as online if we got a successful response
          if (window.state) window.state.companionServiceOnline = true;
          
          return await response.json();
        } catch (error) {
          const isOffline = this.isOfflineError(error);
          const isLastAttempt = attempt === retries;
          
          // Mark as offline on network errors
          if (isOffline && window.state) {
            window.state.companionServiceOnline = false;
          }
          
          if (isLastAttempt) {
            // Only log errors if not in silent mode and not expected offline errors
            if (!silent && !isOffline) {
              console.error(`[ERROR] API (${endpoint}) failed after ${retries + 1} attempts:`, error.message);
            }
            throw error;
          }
          
          // Suppress warnings for offline errors or in silent mode
          if (!silent && !isOffline) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
            console.warn(`[WARNING] API (${endpoint}) attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    })();
    
    // Cache the promise for deduplication
    debouncedRequests.set(cacheKey, requestPromise);
    setTimeout(() => debouncedRequests.delete(cacheKey), 1000);
    
    return requestPromise;
  }

  static async post(endpoint, data, options = {}) {
    const timeout = options.timeout || 10000;
    const silent = options.silent || false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const apiBase = this.getApiBase();
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
        signal: controller.signal,
        ...options
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      // Mark as online if we got a successful response
      if (window.state) window.state.companionServiceOnline = true;
      
      return await response.json();
    } catch (error) {
      const isOffline = this.isOfflineError(error);
      
      // Mark as offline on network errors
      if (isOffline && window.state) {
        window.state.companionServiceOnline = false;
      }
      
      // Only log errors if not in silent mode and not expected offline errors
      if (!silent && !isOffline) {
        console.error(`[ERROR] API POST (${endpoint}):`, error.message);
      }
      throw error;
    }
  }
}

// Export for use in other modules
window.APIClient = APIClient;
