/**
 * Data Synchronizer
 * Syncs data from Cursor databases (static) and companion service (live)
 */

class DataSynchronizer {
  constructor(storage, aggregator) {
    this.storage = storage;
    this.aggregator = aggregator;
    this.companionUrl = 'http://localhost:43917';
    
    // Load lastSync from localStorage to persist across page refreshes
    this.lastSync = (window.LocalStorageHelper?.get('dataSync_lastSync')) || {
      events: 0,
      prompts: 0,
      cursorDb: 0
    };
    
    this.syncInterval = null;
    this.isInitialized = false;
  }
  
  /**
   * Save lastSync to localStorage
   */
  _saveLastSync() {
    if (window.LocalStorageHelper) {
      window.LocalStorageHelper.set('dataSync_lastSync', this.lastSync);
    } else {
      // Fallback for compatibility
      try {
        localStorage.setItem('dataSync_lastSync', JSON.stringify(this.lastSync));
      } catch (e) {
        // Ignore localStorage errors (quota exceeded, etc.)
      }
    }
  }

  /**
   * Initialize and perform full sync
   */
  async initialize() {
    console.log('[SYNC] Initializing data synchronizer...');
    
    // Initialize storage
    await this.storage.init();
    
    // Load from static Cursor databases (one-time historical data) - DO IN BACKGROUND
    // This endpoint is VERY SLOW (18+ seconds) so we run it asynchronously
    // Only sync if not already synced recently (optimization)
    setTimeout(() => {
      this.syncCursorDatabases(false).catch(err => {
        // Suppress expected errors (offline, aborted, etc.)
        const isExpectedError = err.name === 'AbortError' || 
                                err.message.includes('aborted') ||
                                err.message.includes('Failed to fetch');
        if (!isExpectedError) {
          console.warn('[WARNING] Cursor database sync failed:', err.message);
        }
      });
    }, 2000); // Delay 2 seconds to let UI render first
    
    // Load from companion service (fast endpoints)
    await this.syncCompanionService();
    
    // Run initial aggregation
    await this.aggregator.aggregateAll();
    
    // Start periodic sync for live updates
    this.startPeriodicSync();
    
    this.isInitialized = true;
    console.log('[SUCCESS] Data synchronizer initialized');
    
    // Return stats
    return await this.storage.getStats();
  }

  /**
   * Sync from Cursor databases (historical data)
   * Optimized: Only syncs if not already synced recently, or if forced
   */
  async syncCursorDatabases(force = false) {
    const startTime = Date.now();
    const isOffline = window.state?.companionServiceOnline === false;
    
    // Check if we've synced recently (within last hour) - skip if so
    const timeSinceLastSync = Date.now() - this.lastSync.cursorDb;
    const RECENT_SYNC_THRESHOLD = 60 * 60 * 1000; // 1 hour
    
    if (!force && timeSinceLastSync < RECENT_SYNC_THRESHOLD && this.lastSync.cursorDb > 0) {
      if (!isOffline) {
        const minutesAgo = Math.floor(timeSinceLastSync / 60000);
        console.log(`[ARCHIVE] Skipping sync - already synced ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`);
      }
      return;
    }
    
    // Only log if not in offline mode
    if (!isOffline) {
      console.log('[ARCHIVE] Syncing from Cursor databases (background)...');
      
      // Update UI with progress indicator (non-blocking)
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus(false, 'Syncing history (background)...');
      }
    }
    
    try {
      // This endpoint is SLOW (18+ seconds), so we add a longer timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // Increased to 60s for large databases
      
      // Add query param to request incremental sync if available
      const syncSince = this.lastSync.cursorDb > 0 ? `?since=${this.lastSync.cursorDb}` : '';
      
      let response;
      try {
        response = await fetch(`${this.companionUrl}/api/cursor-database${syncSince}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn('[SYNC] Cursor database fetch timed out after 60s');
        } else {
          console.warn('[SYNC] Failed to fetch Cursor database:', error.message);
        }
        return; // Gracefully skip this sync
      }
      
      const data = await response.json();
      
      // Store conversations
      if (data.data && data.data.conversations) {
        await this.storage.storePrompts(data.data.conversations);
        if (!isOffline) {
          console.log(`  Stored ${data.data.conversations.length} conversations`);
        }
      }
      
      // Store prompts
      if (data.data && data.data.prompts) {
        const stored = await this.storage.storePrompts(data.data.prompts);
        if (!isOffline) {
          console.log(`  Stored ${stored} new prompts from Cursor DB`);
        }
      }
      
      this.lastSync.cursorDb = Date.now();
      this._saveLastSync(); // Persist to localStorage
      
      // Mark as online if we got a response
      if (window.state) window.state.companionServiceOnline = true;
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (!isOffline) {
        const newItems = data.incremental ? data.newItems : 'all';
        console.log(`[ARCHIVE] Background sync complete in ${elapsed}s (${newItems} new items)`);
      }
      
      // Restore connection status if still connected
      if (window.updateConnectionStatus && window.state && window.state.connected) {
        window.updateConnectionStatus(true, 'Connected');
      }
      
      // If incremental sync returned no new items, we can extend the skip threshold
      if (data.incremental && data.newItems === 0) {
        // Extend last sync time to prevent frequent checks (set to 30 min ago)
        const RECENT_SYNC_THRESHOLD = 60 * 60 * 1000; // 1 hour
        this.lastSync.cursorDb = Date.now() - (RECENT_SYNC_THRESHOLD * 0.5); // Half the threshold
      }
    } catch (error) {
      const errorMessage = error.message || error.toString();
      const isNetworkError = errorMessage.includes('CORS') || 
                             errorMessage.includes('NetworkError') || 
                             errorMessage.includes('Failed to fetch') ||
                             error.name === 'NetworkError' ||
                             error.name === 'TypeError';
      
      // Mark as offline on network errors
      if (isNetworkError && window.state) {
        window.state.companionServiceOnline = false;
      }
      
      // Only log if not a network error (expected when offline) or if we haven't detected offline yet
      // Also suppress "aborted" errors as they're expected (timeout or navigation)
      const isAborted = error.name === 'AbortError' || errorMessage.includes('aborted');
      if (!isNetworkError && !isAborted && !isOffline) {
        console.warn('Could not sync Cursor databases:', error.message);
      }
      
      // Restore connection status on error if still connected
      if (window.updateConnectionStatus && window.state && window.state.connected) {
        window.updateConnectionStatus(true, 'Connected');
      }
    }
  }

  /**
   * Sync from companion service (live data)
   */
  async syncCompanionService() {
    // Only log if we haven't detected offline mode yet, or if we're coming back online
    const isOffline = window.state?.companionServiceOnline === false;
    if (!isOffline) {
      // Don't log this - it's too verbose when working normally
      // console.log('[SYNC] Syncing from companion service...');
    }
    
    try {
      // Get events
      let eventsResponse;
      try {
        eventsResponse = await fetch(`${this.companionUrl}/queue?since=${this.lastSync.events}`);
        if (!eventsResponse.ok) {
          throw new Error(`HTTP ${eventsResponse.status}: ${eventsResponse.statusText}`);
        }
      } catch (error) {
        console.warn('[SYNC] Failed to fetch queue events:', error.message);
        return; // Gracefully skip this sync
      }
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        
        if (eventsData.events && eventsData.events.length > 0) {
          const stored = await this.storage.storeEvents(eventsData.events);
          if (!isOffline) {
            console.log(`  Stored ${stored} new events`);
          }
          this.lastSync.events = eventsData.cursor || this.lastSync.events;
          this._saveLastSync(); // Persist to localStorage
        }
        
        // Mark as online if we got a response
        if (window.state) window.state.companionServiceOnline = true;
      }
      
      // Get entries (prompts from companion)
      const entriesResponse = await fetch(`${this.companionUrl}/entries`);
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        
        if (entriesData.entries && entriesData.entries.length > 0) {
          const stored = await this.storage.storePrompts(entriesData.entries);
          if (!isOffline) {
            console.log(`  Stored ${stored} new entries`);
          }
        }
        
        // Mark as online if we got a response
        if (window.state) window.state.companionServiceOnline = true;
      }
      
      // Get system resources (optional, don't fail if unavailable)
      try {
        const systemResResponse = await fetch(`${this.companionUrl}/raw-data/system-resources?limit=100`);
        if (systemResResponse.ok) {
          const systemResData = await systemResResponse.json();
          if (systemResData.success && systemResData.data && Array.isArray(systemResData.data)) {
            if (window.state && window.state.data) {
              window.state.data.systemResources = systemResData.data;
              // Trigger chart re-render if system view is active
              if (window.renderSystemResourcesChart && document.getElementById('systemResourcesChart')) {
                setTimeout(() => {
                  window.renderSystemResourcesChart();
                }, 100);
              }
            }
          }
        }
      } catch (systemResError) {
        // System resources are optional, silently ignore errors
      }
      
    } catch (error) {
      const errorMessage = error.message || error.toString();
      const isNetworkError = errorMessage.includes('CORS') || 
                             errorMessage.includes('NetworkError') || 
                             errorMessage.includes('Failed to fetch') ||
                             error.name === 'NetworkError' ||
                             error.name === 'TypeError';
      
      // Mark as offline on network errors
      if (isNetworkError && window.state) {
        window.state.companionServiceOnline = false;
      }
      
      // Only log if we haven't already detected offline mode, or if it's a different error
      if (!isNetworkError || !isOffline) {
        // Suppress CORS/network errors - they're expected when service is offline
        if (!isNetworkError) {
          console.warn('[SYNC] Could not sync companion service:', error.message);
        }
      }
    }
  }

  /**
   * Start periodic sync (every 2 minutes for live feed)
   */
  startPeriodicSync() {
    console.log('[TIME] Starting periodic sync (every 2min)...');
    
    this.syncInterval = setInterval(async () => {
      // Only log periodic sync if not in offline mode (to reduce spam)
      const isOffline = window.state?.companionServiceOnline === false;
      if (!isOffline) {
        // Don't log every periodic sync - too verbose
        // console.log('[SYNC] Periodic sync...');
      }
      
      // Sync from companion service only (live updates)
      await this.syncCompanionService();
      
      // Aggregate new data every 5 minutes
      const timeSinceLastAggregation = Date.now() - this.aggregator.lastAggregation;
      if (timeSinceLastAggregation > 5 * 60 * 1000) {
        if (!isOffline) {
          console.log('[DATA] Running periodic aggregation...');
        }
        await this.aggregator.aggregateAll();
      }
      
    }, 120000); // 2 minutes (reduced request frequency to prevent overload)
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Periodic sync stopped');
    }
  }

  /**
   * Force full re-sync
   */
  async forceSync() {
    console.log('[SYNC] Force sync requested...');
    
    await this.syncCursorDatabases();
    await this.syncCompanionService();
    await this.aggregator.aggregateAll();
    
    return await this.storage.getStats();
  }

  /**
   * Get all data for dashboard
   */
  async getAllData() {
    const [events, prompts, stats] = await Promise.all([
      this.storage.getAllEvents(1000), // Last 1000 events
      this.storage.getAllPrompts(1000), // Last 1000 prompts
      this.storage.getStats()
    ]);
    
    return {
      events,
      prompts,
      stats,
      lastSync: this.lastSync
    };
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeriesData(metric, hours = 24) {
    const startTime = Date.now() - (hours * 60 * 60 * 1000);
    return await this.storage.getTimeSeries(metric, startTime);
  }

  /**
   * Get time series for all key metrics
   */
  async getAllTimeSeriesData(hours = 24) {
    const metrics = [
      'fileActivity',
      'promptActivity',
      'productivity',
      'complexity',
      'languageDistribution',
      'sessionMetrics',
      'workspaceMetrics'
    ];
    
    const data = {};
    for (const metric of metrics) {
      data[metric] = await this.getTimeSeriesData(metric, hours);
    }
    
    return data;
  }

  /**
   * Export all data as JSON
   */
  async exportData() {
    const [events, prompts, timeSeries] = await Promise.all([
      this.storage.getAllEvents(),
      this.storage.getAllPrompts(),
      this.getAllTimeSeriesData(24 * 30) // Last 30 days
    ]);
    
    return {
      export_date: new Date().toISOString(),
      events,
      prompts,
      time_series: timeSeries,
      stats: await this.storage.getStats()
    };
  }

  /**
   * Check companion service health
   */
  async checkCompanionHealth() {
    try {
      const response = await fetch(`${this.companionUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'connected',
          ...data
        };
      }
    } catch (error) {
      return {
        status: 'disconnected',
        error: error.message
      };
    }
  }
}

// Initialize global synchronizer
let synchronizer = null;

async function initializeDataSync() {
  if (!synchronizer) {
    const storage = new PersistentStorage();
    const aggregator = new AnalyticsAggregator(storage);
    synchronizer = new DataSynchronizer(storage, aggregator);
    
    const stats = await synchronizer.initialize();
    console.log('[DATA] Initial data stats:', stats);
    
    return synchronizer;
  }
  return synchronizer;
}

// Export
window.initializeDataSync = initializeDataSync;
window.getSynchronizer = () => synchronizer;


