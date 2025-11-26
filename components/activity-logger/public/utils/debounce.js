/**
 * Debounce utility for frontend
 * Delays function execution until after a period of inactivity
 */

/**
 * Creates a debounced function
 * @param {function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {function} Debounced function
 */
function debounce(func, wait = 300, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Creates a throttled function (executes at most once per wait period)
 * @param {function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @returns {function} Throttled function
 */
function throttle(func, wait = 300) {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, wait);
    }
  };
}

/**
 * Creates a debounced function that returns a promise
 * Useful for async operations like API calls
 * @param {function} func - Async function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {function} Debounced async function
 */
function debounceAsync(func, wait = 300) {
  let timeout;
  let pendingPromise = null;
  let resolvePending = null;
  
  return function executedFunction(...args) {
    return new Promise((resolve, reject) => {
      // Cancel previous timeout
      if (timeout) {
        clearTimeout(timeout);
      }
      
      // If there's a pending promise, resolve it with cancellation
      if (pendingPromise && resolvePending) {
        resolvePending({ cancelled: true });
      }
      
      // Create new pending promise
      pendingPromise = new Promise((res) => {
        resolvePending = res;
      });
      
      // Set timeout
      timeout = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
          resolvePending = null;
          pendingPromise = null;
        } catch (error) {
          reject(error);
          resolvePending = null;
          pendingPromise = null;
        }
      }, wait);
    });
  };
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debounce, throttle, debounceAsync };
}

// Also make available globally for browser use
if (typeof window !== 'undefined') {
  window.debounce = debounce;
  window.throttle = throttle;
  window.debounceAsync = debounceAsync;
}

