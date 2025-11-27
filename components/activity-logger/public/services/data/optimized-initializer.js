/**
 * Optimized Dashboard Initializer
 * Fast, progressive loading with intelligent caching
 */

class OptimizedInitializer {
  constructor() {
    this.initialized = false;
    this.initStartTime = null;
    this.metrics = {
      cacheLoadTime: 0,
      apiLoadTime: 0,
      renderTime: 0,
      totalTime: 0
    };
  }

  /**
   * Main initialization sequence - optimized for speed
   */
  async initialize() {
    if (this.initialized) {
      console.warn('[INIT] Already initialized');
      return;
    }

    this.initStartTime = performance.now();
    console.log('[INIT] Starting optimized initialization...');

    try {
      // Phase 1: Critical path - Get UI ready ASAP
      await this.phase1_CriticalPath();
      
      // Phase 2: Progressive data loading
      await this.phase2_ProgressiveLoad();
      
      // Phase 3: Background enhancements
      this.phase3_BackgroundTasks();
      
      this.initialized = true;
      this.logMetrics();
      
    } catch (error) {
      console.error('[INIT] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Critical path - fastest possible first render
   */
  async phase1_CriticalPath() {
    const phaseStart = performance.now();
    console.log('[INIT] Phase 1: Critical path...');
    
    // 1.1: Load minimal UI state from cache (< 50ms)
    if (window.persistentStorage) {
      try {
        const cachedState = await window.persistentStorage.getCachedState();
        if (cachedState) {
          // Apply minimal state for UI
          if (cachedState.stats) window.state.stats = cachedState.stats;
          if (cachedState.workspaces) window.state.data.workspaces = cachedState.workspaces;
          
          console.log('[INIT] Applied cached state');
        }
      } catch (error) {
        console.warn('[INIT] Cache load failed, continuing...', error);
      }
    }
    
    // 1.2: Render initial UI frame (show loading state)
    this.renderInitialFrame();
    
    this.metrics.cacheLoadTime = performance.now() - phaseStart;
    console.log(`[INIT] Phase 1 complete in ${this.metrics.cacheLoadTime.toFixed(2)}ms`);
  }

  /**
   * Phase 2: Progressive data loading
   */
  async phase2_ProgressiveLoad() {
    const phaseStart = performance.now();
    console.log('[INIT] Phase 2: Progressive loading...');
    
    // 2.1: Check if companion service is available
    const healthCheck = this.checkHealth();
    
    // 2.2: Load initial window of data (limit=50 for speed)
    const dataPromise = this.loadInitialData();
    
    // 2.3: Wait for both in parallel
    const [health, initialData] = await Promise.all([
      healthCheck,
      dataPromise
    ]);
    
    // 2.4: Update connection status
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus(!!health, health ? 'Connected' : 'Offline');
    }
    
    // 2.5: Render initial data
    if (initialData && initialData.length > 0) {
      this.renderInitialData(initialData);
    }
    
    this.metrics.apiLoadTime = performance.now() - phaseStart;
    console.log(`[INIT] Phase 2 complete in ${this.metrics.apiLoadTime.toFixed(2)}ms`);
  }

  /**
   * Phase 3: Background tasks (non-blocking)
   */
  phase3_BackgroundTasks() {
    console.log('[INIT] Phase 3: Background tasks...');
    
    // Use requestIdleCallback for non-critical tasks
    const scheduleTask = (task, timeout = 2000) => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(task, { timeout });
      } else {
        setTimeout(task, 0);
      }
    };
    
    // 3.1: Initialize progressive loader
    scheduleTask(() => {
      if (window.dataAccessService && !window.progressiveLoader) {
        window.progressiveLoader = new window.ProgressiveDataLoader(
          window.dataAccessService,
          {
            windowSize: 50,
            prefetchThreshold: 0.75,
            maxCachedWindows: 5
          }
        );
        console.log('[INIT] Progressive loader initialized');
      }
    });
    
    // 3.2: Initialize WebSocket connection
    scheduleTask(() => {
      if (window.WebSocketManager && !window.wsManager) {
        window.wsManager = new window.WebSocketManager();
        window.wsManager.connect();
        console.log('[INIT] WebSocket initialized');
      }
    }, 1000);
    
    // 3.3: Prefetch likely next data
    scheduleTask(() => {
      this.prefetchNextData();
    }, 1500);
    
    // 3.4: Start background sync
    scheduleTask(() => {
      this.startBackgroundSync();
    }, 2000);
    
    // 3.5: Initialize analytics (lowest priority)
    scheduleTask(() => {
      if (window.initializeAnalytics) {
        window.initializeAnalytics();
      }
    }, 3000);
  }

  /**
   * Check companion service health
   */
  async checkHealth() {
    try {
      const health = await window.APIClient.get('/health', {
        timeout: 3000,
        retries: 0,
        silent: true
      });
      return health;
    } catch (error) {
      console.warn('[INIT] Health check failed:', error.message);
      return null;
    }
  }

  /**
   * Load initial window of data (optimized)
   */
  async loadInitialData() {
    try {
      // Load only first 50 items for speed
      const limit = 50;
      
      // Try cache first for instant load
      if (window.persistentStorage) {
        const cached = await window.persistentStorage.getCachedEvents(limit);
        if (cached && cached.length > 0) {
          console.log(`[INIT] Loaded ${cached.length} events from cache`);
          
          // Fetch fresh data in background
          this.fetchFreshDataInBackground(limit);
          
          return cached;
        }
      }
      
      // No cache, fetch from API
      if (window.dataAccessService) {
        const data = await window.dataAccessService.getData('events', {
          limit,
          offset: 0,
          timeout: 5000
        });
        
        // Cache for next time
        if (window.persistentStorage && data) {
          window.persistentStorage.cacheEvents(data).catch(e => 
            console.warn('[INIT] Failed to cache data:', e)
          );
        }
        
        return data;
      }
      
      return [];
      
    } catch (error) {
      console.error('[INIT] Failed to load initial data:', error);
      return [];
    }
  }

  /**
   * Fetch fresh data in background (non-blocking)
   */
  fetchFreshDataInBackground(limit) {
    if (!window.dataAccessService) return;
    
    // Use requestIdleCallback to avoid blocking
    const fetch = async () => {
      try {
        const fresh = await window.dataAccessService.getDataFromAPI('events', {
          limit,
          offset: 0,
          silent: true
        });
        
        if (fresh && fresh.length > 0) {
          // Update cache
          if (window.persistentStorage) {
            await window.persistentStorage.cacheEvents(fresh);
          }
          
          // Update UI if data changed
          if (window.updateDataView) {
            window.updateDataView(fresh);
          }
          
          console.log('[INIT] Background refresh complete');
        }
      } catch (error) {
        // Silent failure for background task
        console.warn('[INIT] Background fetch failed:', error.message);
      }
    };
    
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(fetch, { timeout: 2000 });
    } else {
      setTimeout(fetch, 1000);
    }
  }

  /**
   * Render initial frame with loading state
   */
  renderInitialFrame() {
    // Show loading skeleton
    const mainView = document.getElementById('mainView');
    if (mainView && !mainView.querySelector('.content-loaded')) {
      // Keep existing loading UI if present
      console.log('[INIT] Initial frame rendered');
    }
    
    // Update progress indicator
    if (window.initProgress) {
      window.initProgress.update('ui', 100);
    }
  }

  /**
   * Render initial data to UI
   */
  renderInitialData(data) {
    const renderStart = performance.now();
    
    // Update global state
    if (window.state && window.state.data) {
      window.state.data.events = data;
    }
    
    // Calculate stats from initial data
    if (window.calculateStats) {
      window.calculateStats();
    }
    
    // Trigger view refresh
    if (window.currentView && window.renderView) {
      window.renderView(window.currentView);
    }
    
    this.metrics.renderTime = performance.now() - renderStart;
    console.log(`[INIT] Initial render in ${this.metrics.renderTime.toFixed(2)}ms`);
  }

  /**
   * Prefetch next likely data
   */
  async prefetchNextData() {
    if (!window.progressiveLoader) return;
    
    try {
      // Prefetch next window
      await window.progressiveLoader.prefetchNextWindow(0);
      console.log('[INIT] Prefetch complete');
    } catch (error) {
      console.warn('[INIT] Prefetch failed:', error);
    }
  }

  /**
   * Start background sync
   */
  startBackgroundSync() {
    if (!window.dataAccessService) return;
    
    // Sync every 30 seconds
    const syncInterval = 30000;
    
    const sync = async () => {
      try {
        const health = await window.dataAccessService.checkCompanionOnline(true);
        if (health && window.syncData) {
          await window.syncData();
        }
      } catch (error) {
        console.warn('[INIT] Background sync failed:', error);
      }
    };
    
    // Initial sync after 5 seconds
    setTimeout(sync, 5000);
    
    // Periodic sync
    setInterval(sync, syncInterval);
    
    console.log('[INIT] Background sync started');
  }

  /**
   * Log performance metrics
   */
  logMetrics() {
    this.metrics.totalTime = performance.now() - this.initStartTime;
    
    console.log('[INIT] Initialization complete!');
    console.log('[INIT] Performance Metrics:');
    console.log(`  - Cache Load: ${this.metrics.cacheLoadTime.toFixed(2)}ms`);
    console.log(`  - API Load: ${this.metrics.apiLoadTime.toFixed(2)}ms`);
    console.log(`  - Render: ${this.metrics.renderTime.toFixed(2)}ms`);
    console.log(`  - Total: ${this.metrics.totalTime.toFixed(2)}ms`);
    
    // Add to status messages
    if (window.addStatusMessage) {
      window.addStatusMessage(`[INIT] Dashboard ready in ${this.metrics.totalTime.toFixed(0)}ms`);
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.OptimizedInitializer = OptimizedInitializer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedInitializer;
}



