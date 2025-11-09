/**
 * View Helpers - Utilities for building reactive views
 */

/**
 * Create a reactive view that automatically updates when state changes
 * @param {string} viewName - Name of the view
 * @param {Function} renderFn - Render function that takes (container, state)
 * @param {Array<string>} dependencies - State paths to watch (e.g., ['data.events', 'data.prompts'])
 * @returns {Function} Enhanced render function
 */
function createReactiveView(viewName, renderFn, dependencies = []) {
  let unsubscribeFunctions = [];
  let isRendering = false;
  
  const reactiveRender = (container) => {
    if (isRendering) return;
    isRendering = true;
    
    try {
      renderFn(container, window.state);
    } catch (error) {
      console.error(`[VIEW] Error in reactive view ${viewName}:`, error);
      if (container) {
        container.innerHTML = `<div class="empty-state">
          <h3>Error rendering view</h3>
          <p>${error.message}</p>
        </div>`;
      }
    } finally {
      isRendering = false;
    }
  };
  
  // Subscribe to state changes
  if (window.subscribeState && dependencies.length > 0) {
    // Subscribe to data changes
    if (dependencies.some(dep => dep.startsWith('data.'))) {
      const unsubscribe = window.subscribeState('data', () => {
        const container = document.getElementById('viewContainer');
        if (container && window.state.currentView === viewName) {
          reactiveRender(container);
        }
      });
      unsubscribeFunctions.push(unsubscribe);
    }
    
    // Subscribe to stats changes
    if (dependencies.some(dep => dep.startsWith('stats.'))) {
      const unsubscribe = window.subscribeState('stats', () => {
        const container = document.getElementById('viewContainer');
        if (container && window.state.currentView === viewName) {
          reactiveRender(container);
        }
      });
      unsubscribeFunctions.push(unsubscribe);
    }
  }
  
  // Store unsubscribe functions for cleanup
  reactiveRender._unsubscribe = () => {
    unsubscribeFunctions.forEach(fn => fn());
    unsubscribeFunctions = [];
  };
  
  return reactiveRender;
}

/**
 * Get view data safely with fallbacks
 * @param {string} path - State path (e.g., 'data.events')
 * @param {*} defaultValue - Default value
 * @returns {*} State value
 */
function getViewData(path, defaultValue = []) {
  if (window.getState) {
    return window.getState(path, defaultValue);
  }
  
  // Fallback implementation
  const keys = path.split('.');
  let value = window.state;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
}

/**
 * Show loading indicator in view
 * @param {HTMLElement} container - Container element
 * @param {string} message - Loading message
 */
function showViewLoading(container, message = 'Loading...') {
  if (!container) return;
  
  container.innerHTML = `
    <div class="empty-state" style="text-align: center; padding: var(--space-xl);">
      <div class="loading-spinner" style="width: 40px; height: 40px; border: 4px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto var(--space-md);"></div>
      <p style="color: var(--color-text-muted);">${message}</p>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

/**
 * Show error in view
 * @param {HTMLElement} container - Container element
 * @param {Error|string} error - Error object or message
 * @param {Function} onRetry - Optional retry function
 */
function showViewError(container, error, onRetry = null) {
  if (!container) return;
  
  const message = error instanceof Error ? error.message : error;
  const retryButton = onRetry ? `
    <button class="btn btn-primary" onclick="(${onRetry.toString()})()" style="margin-top: var(--space-md);">
      Retry
    </button>
  ` : '';
  
  container.innerHTML = `
    <div class="empty-state" style="text-align: center; padding: var(--space-xl);">
      <h3 style="color: var(--color-error); margin-bottom: var(--space-sm);">Error</h3>
      <p style="color: var(--color-text-muted);">${message}</p>
      ${retryButton}
    </div>
  `;
}

/**
 * Debounce view updates
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounceViewUpdate(fn, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Export to window
window.createReactiveView = createReactiveView;
window.getViewData = getViewData;
window.showViewLoading = showViewLoading;
window.showViewError = showViewError;
window.debounceViewUpdate = debounceViewUpdate;

