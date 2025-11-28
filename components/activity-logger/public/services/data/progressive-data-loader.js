/**
 * Progressive Data Loader
 * Implements efficient windowed data loading with prefetching
 */

class ProgressiveDataLoader {
  constructor(dataAccessService, options = {}) {
    this.dataAccessService = dataAccessService;
    this.windowSize = options.windowSize || 50; // Items per window
    this.prefetchThreshold = options.prefetchThreshold || 0.75; // Start prefetch at 75% scroll
    this.maxCachedWindows = options.maxCachedWindows || 5; // Keep 5 windows in memory
    
    this.windows = new Map(); // windowId -> data
    this.loadingWindows = new Set(); // Track in-progress loads
    this.currentWindow = 0;
    this.totalItems = null;
    this.dataType = options.dataType || 'events';
  }

  /**
   * Load initial window of data
   */
  async loadInitial(options = {}) {
    const startTime = performance.now();
    console.log(`[PROGRESSIVE-LOADER] Loading initial window...`);
    
    try {
      const data = await this.loadWindow(0, {
        ...options,
        cache: true // Aggressively cache first window
      });
      
      const loadTime = performance.now() - startTime;
      console.log(`[PROGRESSIVE-LOADER] Initial window loaded in ${loadTime.toFixed(2)}ms`);
      
      // Prefetch next window in background
      this.prefetchNextWindow(0);
      
      return data;
    } catch (error) {
      console.error('[PROGRESSIVE-LOADER] Failed to load initial window:', error);
      throw error;
    }
  }

  /**
   * Load a specific window of data
   */
  async loadWindow(windowId, options = {}) {
    // Check cache first
    if (this.windows.has(windowId)) {
      console.log(`[PROGRESSIVE-LOADER] Returning cached window ${windowId}`);
      return this.windows.get(windowId);
    }
    
    // Check if already loading
    if (this.loadingWindows.has(windowId)) {
      console.log(`[PROGRESSIVE-LOADER] Window ${windowId} already loading, waiting...`);
      // Wait for it to finish
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.windows.has(windowId)) {
            clearInterval(checkInterval);
            resolve(this.windows.get(windowId));
          }
        }, 100);
      });
    }
    
    this.loadingWindows.add(windowId);
    
    try {
      const offset = windowId * this.windowSize;
      const data = await this.dataAccessService.getData(this.dataType, {
        limit: this.windowSize,
        offset: offset,
        ...options
      });
      
      // Cache the window
      this.cacheWindow(windowId, data);
      this.loadingWindows.delete(windowId);
      
      return data;
    } catch (error) {
      this.loadingWindows.delete(windowId);
      throw error;
    }
  }

  /**
   * Prefetch next window in background
   */
  async prefetchNextWindow(currentWindowId) {
    const nextWindowId = currentWindowId + 1;
    
    if (this.loadingWindows.has(nextWindowId) || this.windows.has(nextWindowId)) {
      return; // Already loading or cached
    }
    
    console.log(`[PROGRESSIVE-LOADER] Prefetching window ${nextWindowId}`);
    
    try {
      await this.loadWindow(nextWindowId, { silent: true });
    } catch (error) {
      // Silent failure for prefetch
      console.warn(`[PROGRESSIVE-LOADER] Prefetch failed for window ${nextWindowId}`);
    }
  }

  /**
   * Get data for scrolling
   */
  async getDataForScroll(scrollPosition, viewportSize) {
    // Calculate which window we need
    const approximateItemHeight = 100; // Estimate
    const itemsVisible = Math.ceil(viewportSize / approximateItemHeight);
    const itemsScrolled = Math.floor(scrollPosition / approximateItemHeight);
    const currentWindowId = Math.floor(itemsScrolled / this.windowSize);
    
    // Check if we need to prefetch
    const scrollProgress = (itemsScrolled % this.windowSize) / this.windowSize;
    if (scrollProgress >= this.prefetchThreshold) {
      this.prefetchNextWindow(currentWindowId);
    }
    
    // Return current window
    return this.loadWindow(currentWindowId);
  }

  /**
   * Cache window data with LRU eviction
   */
  cacheWindow(windowId, data) {
    this.windows.set(windowId, data);
    
    // Evict old windows if we exceed max
    if (this.windows.size > this.maxCachedWindows) {
      const oldestWindowId = Math.min(...this.windows.keys());
      console.log(`[PROGRESSIVE-LOADER] Evicting window ${oldestWindowId}`);
      this.windows.delete(oldestWindowId);
    }
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.windows.clear();
    this.loadingWindows.clear();
    this.currentWindow = 0;
    this.totalItems = null;
  }

  /**
   * Get aggregated data from multiple windows
   */
  async getAggregatedData(startWindow, endWindow) {
    const promises = [];
    for (let i = startWindow; i <= endWindow; i++) {
      promises.push(this.loadWindow(i));
    }
    
    const windows = await Promise.all(promises);
    return windows.flat();
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ProgressiveDataLoader = ProgressiveDataLoader;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressiveDataLoader;
}







