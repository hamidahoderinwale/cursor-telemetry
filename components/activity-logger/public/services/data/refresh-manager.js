/**
 * Refresh Manager
 * Unified, optimized refresh and loading scheduler
 * - Low friction: Non-blocking, respects user activity
 * - Timely: Data stays fresh without overwhelming the system
 * - Efficient: Batches operations, deduplicates requests, uses idle time
 */

class RefreshManager {
  constructor() {
    // Refresh intervals (in milliseconds)
    this.intervals = {
      fast: 30000,      // 30s - Quick updates when active
      normal: 120000,   // 2min - Standard refresh
      slow: 300000,     // 5min - Background sync
      aggregation: 300000 // 5min - Analytics aggregation
    };
    
    // State
    this.isActive = false;
    this.isTabVisible = true;
    this.lastFastRefresh = 0;
    this.lastNormalRefresh = 0;
    this.lastSlowRefresh = 0;
    this.lastAggregation = 0;
    this.pendingRequests = new Map(); // Request deduplication
    this.refreshTimeout = null;
    this.aggregationTimeout = null;
    
    // Exponential backoff state
    this.consecutiveFailures = 0;
    this.backoffMultiplier = 1;
    this.maxBackoff = 600000; // 10 minutes max
    
    // Setup visibility API
    this.setupVisibilityAPI();
    
    // Setup focus/blur handlers
    this.setupActivityHandlers();
  }
  
  /**
   * Setup Page Visibility API to pause when tab is hidden
   */
  setupVisibilityAPI() {
    if (typeof document === 'undefined') return;
    
    const handleVisibilityChange = () => {
      const wasVisible = this.isTabVisible;
      this.isTabVisible = !document.hidden;
      
      if (this.isTabVisible && !wasVisible) {
        // Tab became visible - refresh immediately
        this.scheduleFastRefresh();
        // Resume normal refresh intervals
        this.schedulePeriodicRefresh();
      } else if (!this.isTabVisible && wasVisible) {
        // Tab hidden - pause fast refreshes, reduce polling frequency
        this.clearFastRefresh();
        // Continue slow background sync
        this.scheduleSlowRefresh();
        // Pause current view if any
        if (window.pauseView && window.state?.currentView) {
          window.pauseView(window.state.currentView);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.isTabVisible = !document.hidden;
    
    // Allow initial loading even if tab starts hidden
    // This ensures data loads when the page is opened in a background tab
    if (document.hidden) {
      console.log('[REFRESH] Tab initially hidden - allowing background loading');
    }
  }
  
  /**
   * Setup activity handlers (focus/blur, mouse/keyboard activity)
   */
  setupActivityHandlers() {
    if (typeof window === 'undefined') return;
    
    let activityTimeout = null;
    const markActivity = () => {
      // User is active - use fast refresh
      if (this.isTabVisible) {
        this.scheduleFastRefresh();
      }
      
      // Clear existing timeout
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      
      // After 5 minutes of inactivity, switch to slow refresh
      activityTimeout = setTimeout(() => {
        console.log('[REFRESH] User inactive - switching to slow refresh');
      }, 300000);
    };
    
    // Track user activity
    window.addEventListener('focus', markActivity);
    window.addEventListener('mousemove', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('scroll', markActivity, { passive: true });
    
    // Initial activity
    markActivity();
  }
  
  /**
   * Start refresh manager
   */
  start(synchronizer, aggregator) {
    if (this.isActive) {
      console.warn('[REFRESH] Already started');
      return;
    }
    
    this.synchronizer = synchronizer;
    this.aggregator = aggregator;
    this.isActive = true;
    
    console.log('[REFRESH] Starting optimized refresh manager...');
    
    // Initial refresh after short delay
    setTimeout(() => {
      this.performNormalRefresh();
    }, 2000);
    
    // Start periodic refresh
    this.schedulePeriodicRefresh();
    
    // Start periodic aggregation
    this.scheduleAggregation();
  }
  
  /**
   * Stop refresh manager
   */
  stop() {
    this.isActive = false;
    this.clearFastRefresh();
    this.clearNormalRefresh();
    this.clearSlowRefresh();
    this.clearAggregation();
    console.log('[REFRESH] Refresh manager stopped');
  }
  
  /**
   * Schedule fast refresh (when user is active)
   */
  scheduleFastRefresh() {
    if (!this.isActive || !this.isTabVisible) return;
    
    const now = Date.now();
    const timeSinceLastRefresh = now - this.lastFastRefresh;
    const minInterval = this.intervals.fast;
    
    if (timeSinceLastRefresh < minInterval) {
      // Too soon - schedule for later
      const delay = minInterval - timeSinceLastRefresh;
      this.clearFastRefresh();
      this.fastRefreshTimeout = setTimeout(() => {
        this.performFastRefresh();
      }, delay);
      return;
    }
    
    // Perform immediately
    this.performFastRefresh();
  }
  
  /**
   * Perform fast refresh (lightweight, quick updates)
   */
  async performFastRefresh() {
    if (!this.isActive || !this.isTabVisible) return;
    
    this.lastFastRefresh = Date.now();
    
    try {
      // Only sync companion service (fast endpoint)
      if (this.synchronizer) {
        await this.deduplicatedRequest('fast-refresh', () => {
          return this.synchronizer.syncCompanionService();
        });
        
        // Update stats if available (debounced internally)
        if (window.calculateStats) {
          window.calculateStats();
        }
      }
      
      this.consecutiveFailures = 0;
      this.backoffMultiplier = 1;
    } catch (error) {
      this.handleRefreshError(error, 'fast');
    }
  }
  
  /**
   * Schedule periodic refresh (normal speed)
   */
  schedulePeriodicRefresh() {
    if (!this.isActive) return;
    
    this.clearNormalRefresh();
    
    // Calculate next refresh time with backoff
    const baseInterval = this.intervals.normal;
    const interval = baseInterval * this.backoffMultiplier;
    const clampedInterval = Math.min(interval, this.maxBackoff);
    
    this.normalRefreshTimeout = setTimeout(() => {
      this.performNormalRefresh();
      this.schedulePeriodicRefresh(); // Schedule next
    }, clampedInterval);
  }
  
  /**
   * Perform normal refresh (full sync)
   */
  async performNormalRefresh() {
    if (!this.isActive) return;
    
    this.lastNormalRefresh = Date.now();
    
    try {
      if (this.synchronizer) {
        // Use idle time if available
        const performSync = async () => {
          await this.deduplicatedRequest('normal-refresh', () => {
            return this.synchronizer.syncCompanionService();
          });
          
          // Update stats (debounced)
          if (window.calculateStats) {
            window.calculateStats();
          }
          
          // Optionally update UI if on analytics view (removed - causes excessive re-renders)
          // Analytics view will update automatically when data changes via event listeners
          // Full view re-render is too expensive and causes performance issues
        };
        
        if (typeof requestIdleCallback !== 'undefined' && this.isTabVisible) {
          requestIdleCallback(performSync, { timeout: 2000 });
        } else {
          await performSync();
        }
      }
      
      this.consecutiveFailures = 0;
      this.backoffMultiplier = 1;
      
      // Schedule next refresh
      this.schedulePeriodicRefresh();
    } catch (error) {
      this.handleRefreshError(error, 'normal');
      this.schedulePeriodicRefresh(); // Schedule next even on error
    }
  }
  
  /**
   * Schedule slow refresh (background sync when inactive)
   */
  scheduleSlowRefresh() {
    if (!this.isActive || this.isTabVisible) return; // Only when tab hidden
    
    this.clearSlowRefresh();
    
    this.slowRefreshTimeout = setTimeout(() => {
      this.performSlowRefresh();
      this.scheduleSlowRefresh(); // Schedule next
    }, this.intervals.slow);
  }
  
  /**
   * Perform slow refresh (background, non-blocking)
   */
  async performSlowRefresh() {
    if (!this.isActive || this.isTabVisible) return;
    
    this.lastSlowRefresh = Date.now();
    
    try {
      if (this.synchronizer) {
        // Background sync - don't block
        this.synchronizer.syncCompanionService().catch(err => {
          // Silently handle errors in background
          console.debug('[REFRESH] Background sync error:', err.message);
        });
      }
      
      this.scheduleSlowRefresh();
    } catch (error) {
      // Silently handle - this is background
      this.scheduleSlowRefresh();
    }
  }
  
  /**
   * Schedule aggregation (analytics processing)
   */
  scheduleAggregation() {
    if (!this.isActive) return;
    
    this.clearAggregation();
    
    this.aggregationTimeout = setTimeout(() => {
      this.performAggregation();
      this.scheduleAggregation(); // Schedule next
    }, this.intervals.aggregation);
  }
  
  /**
   * Perform aggregation (heavy processing)
   */
  async performAggregation() {
    if (!this.isActive) return;
    
    this.lastAggregation = Date.now();
    
    try {
      if (this.aggregator) {
        // Use idle time for heavy aggregation
        const performAggregation = async () => {
          await this.aggregator.aggregateAll();
        };
        
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(performAggregation, { timeout: 5000 });
        } else {
          // Fallback: delay aggregation if tab is visible
          if (this.isTabVisible) {
            setTimeout(performAggregation, 2000);
          } else {
            await performAggregation();
          }
        }
      }
      
      this.scheduleAggregation();
    } catch (error) {
      console.warn('[REFRESH] Aggregation error:', error.message);
      this.scheduleAggregation();
    }
  }
  
  /**
   * Request deduplication - prevent duplicate simultaneous requests
   */
  async deduplicatedRequest(key, requestFn) {
    if (this.pendingRequests.has(key)) {
      // Request already in progress - return existing promise
      return this.pendingRequests.get(key);
    }
    
    // Create new request
    const promise = requestFn().finally(() => {
      // Clean up after request completes
      this.pendingRequests.delete(key);
    });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
  
  /**
   * Handle refresh errors with exponential backoff
   */
  handleRefreshError(error, type) {
    this.consecutiveFailures++;
    
    // Exponential backoff
    this.backoffMultiplier = Math.min(
      Math.pow(2, this.consecutiveFailures),
      this.maxBackoff / this.intervals.normal
    );
    
    const isExpectedError = 
      error.name === 'AbortError' ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('NetworkError') ||
      error.message?.includes('CORS');
    
    if (!isExpectedError) {
      console.warn(`[REFRESH] ${type} refresh error (${this.consecutiveFailures} failures):`, error.message);
    }
    
    // Reset backoff after successful refresh
    // (handled in performNormalRefresh)
  }
  
  /**
   * Clear all refresh timeouts
   */
  clearFastRefresh() {
    if (this.fastRefreshTimeout) {
      clearTimeout(this.fastRefreshTimeout);
      this.fastRefreshTimeout = null;
    }
  }
  
  clearNormalRefresh() {
    if (this.normalRefreshTimeout) {
      clearTimeout(this.normalRefreshTimeout);
      this.normalRefreshTimeout = null;
    }
  }
  
  clearSlowRefresh() {
    if (this.slowRefreshTimeout) {
      clearTimeout(this.slowRefreshTimeout);
      this.slowRefreshTimeout = null;
    }
  }
  
  clearAggregation() {
    if (this.aggregationTimeout) {
      clearTimeout(this.aggregationTimeout);
      this.aggregationTimeout = null;
    }
  }
  
  /**
   * Force immediate refresh (user-triggered)
   */
  async forceRefresh() {
    console.log('[REFRESH] Force refresh requested');
    this.consecutiveFailures = 0;
    this.backoffMultiplier = 1;
    await this.performNormalRefresh();
  }
  
  /**
   * Get refresh status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isTabVisible: this.isTabVisible,
      lastFastRefresh: this.lastFastRefresh,
      lastNormalRefresh: this.lastNormalRefresh,
      lastSlowRefresh: this.lastSlowRefresh,
      lastAggregation: this.lastAggregation,
      consecutiveFailures: this.consecutiveFailures,
      backoffMultiplier: this.backoffMultiplier,
      pendingRequests: this.pendingRequests.size
    };
  }
}

// Export singleton
const refreshManager = new RefreshManager();

if (typeof window !== 'undefined') {
  window.refreshManager = refreshManager;
  window.RefreshManager = RefreshManager;
}



