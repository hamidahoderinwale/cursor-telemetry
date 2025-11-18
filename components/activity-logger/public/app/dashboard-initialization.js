/**
 * Dashboard Initialization Module
 * Handles dashboard startup, cache loading, and data fetching
 * Extracted from dashboard.js for better organization
 */

/**
 * Optimized initialization with warm-start and limited initial window
 */
async function initializeDashboard() {
  console.log('[LAUNCH] Initializing dashboard with warm-start...');
  
  try {
    // Step 1: Load from IndexedDB cache first (instant UI)
    if (window.initProgress) window.initProgress.update('cache', 0);
    
    // Update progress during cache loading
    const cacheProgressCallback = (progress) => {
      if (window.initProgress) window.initProgress.update('cache', progress);
    };
    
    if (window.loadFromCache) {
      await window.loadFromCache(cacheProgressCallback);
    }
    if (window.initProgress) window.initProgress.update('cache', 100);
    
    // Step 2: Check server version to see if we need to sync
    if (window.initProgress) window.initProgress.update('server', 0);
    let serverHealth = null;
    let isConnected = false;
    
    try {
      if (window.APIClient) {
        serverHealth = await window.APIClient.get('/health');
        const serverSequence = serverHealth.sequence || 0;
        isConnected = serverHealth.status === 'running' || serverHealth.sequence !== undefined;
        if (window.initProgress) window.initProgress.update('server', 100);
        
        // Update connection state
        if (window.state) {
          window.state.connected = isConnected;
        }
        
        if (isConnected) {
          if (window.updateConnectionStatus) {
            window.updateConnectionStatus(true, 'Connected to companion service');
          }
        } else {
          if (window.updateConnectionStatus) {
            window.updateConnectionStatus(false, 'Companion service offline');
          }
        }
      }
    } catch (error) {
      console.warn('[WARNING] Health check failed:', error.message);
      isConnected = false;
      if (window.state) {
        window.state.connected = false;
      }
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus(false, 'Cannot reach companion service');
      }
      if (window.initProgress) window.initProgress.update('server', 100);
    }
    
    const persistentStorage = window.persistentStorage;
    const cacheStale = serverHealth && persistentStorage ? 
      await persistentStorage.isCacheStale(serverHealth.sequence || 0) : false;
    
    if (cacheStale && isConnected) {
      console.log('Cache stale, fetching updates...');
      if (window.initProgress) window.initProgress.update('data', 0);
      try {
        if (window.fetchRecentData) {
          await window.fetchRecentData();
        }
        if (persistentStorage && serverHealth) {
          await persistentStorage.updateServerSequence(serverHealth.sequence || 0);
        }
        if (window.updateConnectionStatus) {
          window.updateConnectionStatus(true, 'Connected - data synced');
        }
        if (window.initProgress) window.initProgress.update('data', 100);
      } catch (error) {
        console.warn('[WARNING] Data fetch failed:', error.message);
        if (window.updateConnectionStatus) {
          window.updateConnectionStatus(false, 'Connected but sync failed');
        }
        if (window.initProgress) window.initProgress.update('data', 100);
      }
    } else {
      console.log('[SUCCESS] Cache up-to-date, using cached data');
      if (isConnected && window.updateConnectionStatus) {
        window.updateConnectionStatus(true, 'Connected - using cached data');
      }
      if (window.initProgress) window.initProgress.update('data', 100);
    }
    
    // Step 3: Render initial UI with cached/recent data
    if (window.initProgress) window.initProgress.update('render', 0);
    if (window.calculateStats) window.calculateStats();
    if (window.renderCurrentView) {
      await window.renderCurrentView();
    }
    if (window.initProgress) window.initProgress.update('render', 100);
    
    // Mark as complete with final status
    if (window.initProgress) {
      if (isConnected) {
        window.initProgress.complete('Connected');
      } else {
        window.initProgress.complete('Offline - using cached data');
      }
    }
    
    // Step 4: Background: fetch older history if needed
    if (isConnected && window.fetchOlderHistory) {
      setTimeout(() => {
        window.fetchOlderHistory();
      }, 3000);
    }
    
    // Step 5: Heavy analytics will be loaded on-demand via analyticsManager
    console.log('Heavy analytics deferred until idle/tab focus');
    
  } catch (error) {
    console.error('Initialization error:', error);
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus(false, 'Connection failed');
    }
    if (window.state) {
      window.state.connected = false;
    }
    // Fallback to old method
    if (window.fetchAllData) {
      await window.fetchAllData();
    }
  }
}

// Export to window
window.initializeDashboard = initializeDashboard;

