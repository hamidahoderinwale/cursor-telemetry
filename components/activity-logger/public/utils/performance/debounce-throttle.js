/**
 * Debounce and Throttle Utilities
 * Optimizes event handlers and frequent function calls
 */

/**
 * Debounce - Delays function execution until after wait time has elapsed
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Trigger on leading edge instead of trailing
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 300, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const context = this;
    
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle - Limits function execution to once per specified time period
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(func, limit = 300) {
  let inThrottle;
  let lastResult;
  
  return function executedFunction(...args) {
    const context = this;
    
    if (!inThrottle) {
      lastResult = func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
}

/**
 * Advanced throttle with trailing edge call
 * Ensures the function is called both immediately and after the limit
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttleWithTrailing(func, limit = 300) {
  let timeout;
  let lastRan;
  let context;
  let args;
  
  return function executedFunction(...callArgs) {
    context = this;
    args = callArgs;
    
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(timeout);
      
      timeout = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Request Animation Frame throttle
 * Limits function execution to browser's animation frame rate (~60fps)
 * @param {Function} func - Function to throttle
 * @returns {Function} - RAF throttled function
 */
function rafThrottle(func) {
  let rafId = null;
  
  return function executedFunction(...args) {
    const context = this;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(context, args);
        rafId = null;
      });
    }
  };
}

/**
 * Debounce with cancellation
 * Returns debounced function with cancel method
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Object} - Object with call and cancel methods
 */
function debounceWithCancel(func, wait = 300) {
  let timeout;
  
  const debounced = function executedFunction(...args) {
    const context = this;
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
  
  debounced.cancel = function() {
    clearTimeout(timeout);
  };
  
  debounced.flush = function(...args) {
    clearTimeout(timeout);
    const context = this;
    func.apply(context, args);
  };
  
  return debounced;
}

/**
 * Batch function calls - Collects calls and executes them in batches
 * @param {Function} func - Function to batch
 * @param {number} delay - Batch delay in milliseconds
 * @returns {Function} - Batched function
 */
function batch(func, delay = 100) {
  let items = [];
  let timeout;
  
  return function addToBatch(item) {
    items.push(item);
    
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (items.length > 0) {
        func(items);
        items = [];
      }
    }, delay);
  };
}

// Export utilities
if (typeof window !== 'undefined') {
  window.debounce = debounce;
  window.throttle = throttle;
  window.throttleWithTrailing = throttleWithTrailing;
  window.rafThrottle = rafThrottle;
  window.debounceWithCancel = debounceWithCancel;
  window.batch = batch;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debounce,
    throttle,
    throttleWithTrailing,
    rafThrottle,
    debounceWithCancel,
    batch
  };
}
















