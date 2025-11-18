/**
 * Debounce and Throttle utilities for performance optimization
 */

/**
 * Debounce function - delays execution until after wait time has passed
 */
function debounce(func, wait, immediate = false) {
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
 * Throttle function - limits execution to once per wait time
 */
function throttle(func, wait, options = {}) {
  let timeout;
  let previous = 0;
  const { leading = true, trailing = true } = options;

  return function executedFunction(...args) {
    const now = Date.now();
    if (!previous && leading === false) previous = now;
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func(...args);
    } else if (!timeout && trailing !== false) {
      timeout = setTimeout(() => {
        previous = leading === false ? 0 : Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
}

/**
 * Request animation frame throttle - for smooth animations
 */
function rafThrottle(func) {
  let rafId = null;
  let lastArgs = null;

  return function executedFunction(...args) {
    lastArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func(...lastArgs);
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * Idle callback debounce - executes when browser is idle
 */
function idleDebounce(func, timeout = 2000) {
  let idleId = null;
  let lastArgs = null;

  return function executedFunction(...args) {
    lastArgs = args;
    if (idleId === null) {
      idleId = requestIdleCallback(
        () => {
          func(...lastArgs);
          idleId = null;
          lastArgs = null;
        },
        { timeout }
      );
    }
  };
}

// Export to window
window.debounce = debounce;
window.throttle = throttle;
window.rafThrottle = rafThrottle;
window.idleDebounce = idleDebounce;



