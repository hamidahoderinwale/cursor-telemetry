/**
 * View State Manager
 * Persists and restores view state (scroll positions, filters, selections)
 */

class ViewStateManager {
  constructor() {
    this.storageKey = 'view-states';
    this.stateCache = new Map();
    this.loadState();
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.stateCache = new Map(Object.entries(parsed));
      }
    } catch (error) {
      // Ignore parse errors
      this.stateCache = new Map();
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const obj = Object.fromEntries(this.stateCache);
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch (error) {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }

  /**
   * Save state for a view
   */
  saveViewState(viewName, state) {
    if (!viewName) return;

    const currentState = this.stateCache.get(viewName) || {};
    const mergedState = { ...currentState, ...state, lastUpdated: Date.now() };
    
    this.stateCache.set(viewName, mergedState);
    this.saveState();
  }

  /**
   * Get state for a view
   */
  getViewState(viewName) {
    if (!viewName) return null;
    return this.stateCache.get(viewName) || null;
  }

  /**
   * Save scroll position for a view
   */
  saveScrollPosition(viewName, scrollX, scrollY) {
    this.saveViewState(viewName, {
      scrollX: scrollX || 0,
      scrollY: scrollY || 0
    });
  }

  /**
   * Restore scroll position for a view
   */
  restoreScrollPosition(viewName, container) {
    const state = this.getViewState(viewName);
    if (state && container) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (state.scrollX !== undefined) {
          container.scrollLeft = state.scrollX;
        }
        if (state.scrollY !== undefined) {
          container.scrollTop = state.scrollY;
        }
      });
    }
  }

  /**
   * Save filter state
   */
  saveFilters(viewName, filters) {
    this.saveViewState(viewName, { filters });
  }

  /**
   * Get filter state
   */
  getFilters(viewName) {
    const state = this.getViewState(viewName);
    return state?.filters || null;
  }

  /**
   * Save selection state
   */
  saveSelection(viewName, selection) {
    this.saveViewState(viewName, { selection });
  }

  /**
   * Get selection state
   */
  getSelection(viewName) {
    const state = this.getViewState(viewName);
    return state?.selection || null;
  }

  /**
   * Clear state for a view
   */
  clearViewState(viewName) {
    if (viewName) {
      this.stateCache.delete(viewName);
      this.saveState();
    }
  }

  /**
   * Clear all states
   */
  clearAllStates() {
    this.stateCache.clear();
    this.saveState();
  }

  /**
   * Setup automatic scroll position tracking for a view
   */
  setupScrollTracking(viewName, container) {
    if (!container || !viewName) return;

    let scrollTimeout = null;
    const saveScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.saveScrollPosition(viewName, container.scrollLeft, container.scrollTop);
      }, 300); // Debounce scroll saves
    };

    container.addEventListener('scroll', saveScroll, { passive: true });
    
    // Restore scroll position
    this.restoreScrollPosition(viewName, container);

    // Return cleanup function
    return () => {
      container.removeEventListener('scroll', saveScroll);
      clearTimeout(scrollTimeout);
    };
  }
}

// Export singleton
const viewStateManager = new ViewStateManager();

if (typeof window !== 'undefined') {
  window.viewStateManager = viewStateManager;
  window.ViewStateManager = ViewStateManager;
}


