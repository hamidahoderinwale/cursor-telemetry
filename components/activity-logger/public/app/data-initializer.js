/**
 * Data Initialization Module
 * Handles dashboard initialization, cache loading, and data fetching
 */

// Dependencies: window.CONFIG, window.state, window.APIClient, window.initProgress, window.updateConnectionStatus, window.persistentStorage

/**
 * Optimized initialization with warm-start and limited initial window
 */
async function initializeDashboard() {
  console.log('[LAUNCH] Initializing dashboard with warm-start...');
  
  try {
    // Step 1: Load from IndexedDB cache first (instant UI)
    window.initProgress.update('cache', 0);
    await loadFromCache();
    window.initProgress.update('cache', 100);
    
    // Step 2: Check server version to see if we need to sync
    window.initProgress.update('server', 0);
    let serverHealth = null;
    let isConnected = false;
    
    try {
      serverHealth = await window.APIClient.get('/health');
      const serverSequence = serverHealth.sequence || 0;
      isConnected = serverHealth.status === 'running' || serverHealth.sequence !== undefined;
      window.initProgress.update('server', 100);
      
      // Update connection state
      if (window.state) {
        window.state.connected = isConnected;
      }
      
      if (isConnected) {
        window.updateConnectionStatus(true, 'Connected to companion service');
      } else {
        window.updateConnectionStatus(false, 'Companion service offline');
      }
    } catch (error) {
      const isNetworkError = window.APIClient?.isOfflineError(error) || 
                             error.message?.includes('CORS') || 
                             error.message?.includes('NetworkError') || 
                             error.message?.includes('Failed to fetch') ||
                             error.name === 'NetworkError' ||
                             error.name === 'TypeError';
      
      // Only log health check failures if not a network error (expected when offline)
      if (!isNetworkError) {
        console.warn('[WARNING] Health check failed:', error.message);
      }
      
      isConnected = false;
      if (window.state) {
        window.state.connected = false;
        window.state.companionServiceOnline = false;
      }
      
      // Provide more helpful error message
      const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
      const errorMessage = isNetworkError 
        ? `Offline - using cached data (service at ${apiBase} not reachable)`
        : `Connection failed - ${error.message || 'Unknown error'}`;
      
      window.updateConnectionStatus(false, errorMessage);
      window.initProgress.update('server', 100);
    }
    
    const cacheStale = serverHealth && window.persistentStorage ? await window.persistentStorage.isCacheStale(serverHealth.sequence || 0) : false;
    
    if (cacheStale && isConnected) {
      console.log('Cache stale, fetching updates...');
      window.initProgress.update('data', 0);
      try {
        await fetchRecentData();
        if (window.persistentStorage) {
          await window.persistentStorage.updateServerSequence(serverHealth.sequence || 0);
        }
        window.updateConnectionStatus(true, 'Connected - data synced');
        window.initProgress.update('data', 100);
      } catch (error) {
        console.warn('[WARNING] Data fetch failed:', error.message);
        window.updateConnectionStatus(false, 'Connected but sync failed');
        window.initProgress.update('data', 100);
      }
    } else {
      console.log('[SUCCESS] Cache up-to-date, using cached data');
      if (isConnected) {
        window.updateConnectionStatus(true, 'Connected - using cached data');
      }
      window.initProgress.update('data', 100);
    }
    
    // Step 3: Render initial UI with cached/recent data (defer heavy rendering)
    window.initProgress.update('render', 0);
    if (window.calculateStats) {
      // Use requestIdleCallback for stats calculation if available
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          window.calculateStats();
        }, { timeout: 100 });
      } else {
        // Yield to event loop before calculating stats
        await new Promise(resolve => setTimeout(resolve, 0));
        window.calculateStats();
      }
    }
    if (window.renderCurrentView) {
      // Yield to browser for initial render
      await new Promise(resolve => requestAnimationFrame(resolve));
      await window.renderCurrentView();
    }
    window.initProgress.update('render', 100);
    
    // Mark as complete with final status
    if (isConnected) {
      window.initProgress.complete('Connected');
    } else {
      window.initProgress.complete('Offline - using cached data');
    }
    
    // Step 4: Background: fetch older history if needed
    if (isConnected) {
      setTimeout(() => {
        fetchOlderHistory();
      }, 3000);
    }
    
    // Step 5: Heavy analytics will be loaded on-demand via analyticsManager
    console.log('Heavy analytics deferred until idle/tab focus');
    
  } catch (error) {
    console.error('[ERROR] Initialization error:', error);
    
    const isNetworkError = window.APIClient?.isOfflineError(error) || 
                           error.message?.includes('CORS') || 
                           error.message?.includes('NetworkError') || 
                           error.message?.includes('Failed to fetch');
    
    const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
    const errorMessage = isNetworkError
      ? `Offline - using cached data (service at ${apiBase} not reachable)`
      : `Initialization error: ${error.message || 'Unknown error'}`;
    
    window.updateConnectionStatus(false, errorMessage);
    if (window.state) {
      window.state.connected = false;
      window.state.companionServiceOnline = false;
    }
    
    // Fallback to old method
    if (window.fetchAllData) {
      try {
        await window.fetchAllData();
      } catch (fallbackError) {
        console.error('[ERROR] Fallback data fetch also failed:', fallbackError);
      }
    }
  }
}

/**
 * Load data from IndexedDB cache for instant startup
 * Optimized: Loads recent data first, then older data in background
 */
async function loadFromCache() {
  console.log('[PACKAGE] Loading from cache...');
  
  // Check if persistentStorage is available
  if (!window.persistentStorage) {
    console.warn('[WARNING] PersistentStorage not available, skipping cache load');
    return;
  }
  
  // Load recent data first (last 24 hours) for instant UI
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  try {
    // Load recent events first (faster)
    if (window.persistentStorage.getEventsSince) {
      const recentEvents = await window.persistentStorage.getEventsSince(oneDayAgo);
      if (recentEvents && recentEvents.length > 0) {
        window.state.data.events = recentEvents;
        console.log(`[SUCCESS] Loaded ${recentEvents.length} recent events from cache`);
      }
    }
    
    // Load recent prompts first
    if (window.persistentStorage.getPromptsSince) {
      const recentPrompts = await window.persistentStorage.getPromptsSince(oneDayAgo);
      if (recentPrompts && recentPrompts.length > 0) {
        window.state.data.prompts = recentPrompts;
        console.log(`[SUCCESS] Loaded ${recentPrompts.length} recent prompts from cache`);
      }
    }
    
    // Render with recent cached data immediately
    if ((window.state.data.events && window.state.data.events.length > 0) || 
        (window.state.data.prompts && window.state.data.prompts.length > 0)) {
      if (window.calculateStats) {
        await window.calculateStats();
      }
      if (window.renderCurrentView) {
        // Use requestAnimationFrame to yield to browser for initial render
        await new Promise(resolve => requestAnimationFrame(resolve));
        await window.renderCurrentView();
      }
    }
    
    // Load older data in background (non-blocking)
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(async () => {
        try {
          const allEvents = await window.persistentStorage.getAllEvents();
          const allPrompts = await window.persistentStorage.getAllPrompts();
          
          // Merge with recent data (avoid duplicates)
          const existingEventIds = new Set((window.state.data.events || []).map(e => e.id));
          const existingPromptIds = new Set((window.state.data.prompts || []).map(p => p.id || p.prompt_id));
          
          const olderEvents = (allEvents || []).filter(e => !existingEventIds.has(e.id));
          const olderPrompts = (allPrompts || []).filter(p => {
            const id = p.id || p.prompt_id;
            return id && !existingPromptIds.has(id);
          });
          
          if (olderEvents.length > 0 || olderPrompts.length > 0) {
            window.state.data.events = [...(window.state.data.events || []), ...olderEvents];
            window.state.data.prompts = [...(window.state.data.prompts || []), ...olderPrompts];
            console.log(`[SUCCESS] Loaded ${olderEvents.length} older events and ${olderPrompts.length} older prompts`);
            
            // Recalculate stats with full dataset
            if (window.calculateStats) {
              window.calculateStats();
            }
          }
        } catch (error) {
          console.warn('[WARNING] Failed to load older cached data:', error.message);
        }
      }, { timeout: 3000 });
    } else {
      // Fallback: load older data after a delay
      setTimeout(async () => {
        try {
          const allEvents = await window.persistentStorage.getAllEvents();
          const allPrompts = await window.persistentStorage.getAllPrompts();
          
          const existingEventIds = new Set((window.state.data.events || []).map(e => e.id));
          const existingPromptIds = new Set((window.state.data.prompts || []).map(p => p.id || p.prompt_id));
          
          const olderEvents = (allEvents || []).filter(e => !existingEventIds.has(e.id));
          const olderPrompts = (allPrompts || []).filter(p => {
            const id = p.id || p.prompt_id;
            return id && !existingPromptIds.has(id);
          });
          
          if (olderEvents.length > 0 || olderPrompts.length > 0) {
            window.state.data.events = [...(window.state.data.events || []), ...olderEvents];
            window.state.data.prompts = [...(window.state.data.prompts || []), ...olderPrompts];
            console.log(`[SUCCESS] Loaded ${olderEvents.length} older events and ${olderPrompts.length} older prompts`);
            
            if (window.calculateStats) {
              window.calculateStats();
            }
          }
        } catch (error) {
          console.warn('[WARNING] Failed to load older cached data:', error.message);
        }
      }, 2000);
    }
  } catch (error) {
    console.warn('[WARNING] Cache load failed, trying fallback:', error.message);
    // Fallback to loading all data at once
    try {
      const cached = await window.persistentStorage.getAll();
      if (cached.events && cached.events.length > 0) {
        window.state.data.events = cached.events;
        console.log(`[SUCCESS] Loaded ${cached.events.length} events from cache (fallback)`);
      }
      if (cached.prompts && cached.prompts.length > 0) {
        window.state.data.prompts = cached.prompts;
        console.log(`[SUCCESS] Loaded ${cached.prompts.length} prompts from cache (fallback)`);
      }
    } catch (fallbackError) {
      console.error('[ERROR] Cache load fallback also failed:', fallbackError);
    }
  }
}

/**
 * Fetch only recent data (last 24 hours by default)
 */
async function fetchRecentData() {
  // FIX: Check if APIClient is available before using it
  if (!window.APIClient || typeof window.APIClient.get !== 'function') {
    console.error('[ERROR] APIClient is not available. Ensure core/api-client.js is loaded before dashboard.js');
    // Fallback to using cached data only
    if (!window.state) {
      console.error('[ERROR] state is not defined');
      return;
    }
    if (!window.state.data) {
      window.state.data = {};
    }
    if (!window.state.data.events) window.state.data.events = [];
    if (!window.state.data.prompts) window.state.data.prompts = [];
    if (window.calculateStats) {
      window.calculateStats();
    }
    return;
  }
  
  // FIX: Ensure state.data exists
  if (!window.state) {
    console.error('[ERROR] state is not defined');
    return;
  }
  if (!window.state.data) {
    window.state.data = {};
  }

  const windowHours = 24 * 365; // 1 year of data
  const windowLabel = windowHours >= 24 ? `${windowHours / 24}d` : `${windowHours}h`;
  const startTime = Date.now() - (windowHours * 60 * 60 * 1000);
  // Only log if not in offline mode (to reduce spam)
  const isOffline = window.state?.companionServiceOnline === false;
  if (!isOffline) {
    // Don't log every sync - too verbose
    // console.log(`[SYNC] Fetching recent data (${windowLabel} window)...`);
  }
  
  const pageSize = 500; // Optimized limit for performance
  
  try {
    // Fetch recent events only (cached data provides full history)
    // Use longer timeout for slow endpoints (cursor database queries)
    // Fetch sequentially with delay to avoid overwhelming the companion service
    const activity = await window.APIClient.get(`/api/activity?limit=${pageSize}`, { 
      timeout: 30000,  // 30 seconds for database queries
      retries: 1,
      silent: true  // Suppress error logging for expected offline scenarios
    }).catch(err => {
      // Only log if it's not a network/CORS error (expected when offline)
      const isNetworkError = err.message?.includes('CORS') || 
                             err.message?.includes('NetworkError') || 
                             err.message?.includes('Failed to fetch');
      if (!isNetworkError) {
        console.warn('[WARNING] Activity fetch failed, using cache:', err.message);
      }
      return { data: window.state.data.events || [] };
    });
    
    // Small delay between requests to reduce server load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const prompts = await window.APIClient.get(`/entries?limit=${pageSize}`, { 
      timeout: 30000,  // 30 seconds for database queries
      retries: 1,
      silent: true  // Suppress error logging for expected offline scenarios
    }).catch(err => {
      // Only log if it's not a network/CORS error (expected when offline)
      const isNetworkError = err.message?.includes('CORS') || 
                             err.message?.includes('NetworkError') || 
                             err.message?.includes('Failed to fetch');
      if (!isNetworkError) {
        console.warn('[WARNING] Prompts fetch failed, using cache:', err.message);
      }
      return { entries: window.state.data.prompts || [] };
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const workspaces = await window.APIClient.get('/api/workspaces', { 
      timeout: 30000,  // 30 seconds for workspace queries
      retries: 1,
      silent: true  // Suppress error logging for expected offline scenarios
    }).catch(err => {
      // Only log if it's not a network/CORS error (expected when offline)
      const isNetworkError = err.message?.includes('CORS') || 
                             err.message?.includes('NetworkError') || 
                             err.message?.includes('Failed to fetch');
      if (!isNetworkError) {
        console.warn('[WARNING] Workspaces fetch failed, using cache:', err.message);
      }
      return window.state.data.workspaces || [];
    });
    
    // Process activity
    // Only log debug info if not in offline mode (to reduce spam)
    if (!isOffline) {
      console.log('[DEBUG] Activity response:', { hasActivity: !!activity, hasData: !!activity?.data, isArray: Array.isArray(activity?.data), length: activity?.data?.length });
    }
    
    if (activity && activity.data && Array.isArray(activity.data)) {
      // Store total count for all-time stats
      if (activity.pagination?.total) {
        if (!window.state.stats) window.state.stats = {};
        window.state.stats.totalEventCount = activity.pagination.total;
        console.log(`[STATS] Total events in database: ${activity.pagination.total}`);
      }
      
      // No need to filter - API already returns recent data
      const recentEvents = activity.data;
      
      // Mark as online if we got data
      if (window.state && !isOffline) {
        window.state.companionServiceOnline = true;
      }
      
      window.state.data.events = recentEvents;
      if (!isOffline) {
        console.log(`[DATA] Loaded ${recentEvents.length} recent events (of ${activity.pagination?.total || 'unknown'} total)`);
      }
      
      // Store in cache
      if (window.persistentStorage) {
        await window.persistentStorage.storeEvents(recentEvents);
      }
    } else {
      console.warn('[WARNING] Activity data not in expected format:', activity);
      window.state.data.events = [];
    }
    
    // Process prompts
    // Only log debug info if not in offline mode (to reduce spam)
    if (!isOffline) {
      console.log('[DEBUG] Prompts response:', { hasEntries: !!prompts.entries, isArray: Array.isArray(prompts.entries), length: prompts.entries?.length, keys: Object.keys(prompts) });
    }
    
    if (prompts.entries && Array.isArray(prompts.entries)) {
      // Map API fields to match dashboard expectations
      const mappedPrompts = prompts.entries.map(p => ({
        ...p,
        // Map snake_case to camelCase
        contextUsage: p.context_usage || p.contextUsage || 0,
        workspaceId: p.workspace_id || p.workspaceId,
        workspaceName: p.workspace_name || p.workspaceName,
        workspacePath: p.workspace_path || p.workspacePath,
        composerId: p.composer_id || p.composerId,
        linkedEntryId: p.linked_entry_id || p.linkedEntryId,
        linesAdded: p.lines_added || p.linesAdded || 0,
        linesRemoved: p.lines_removed || p.linesRemoved || 0,
        forceMode: p.force_mode || p.forceMode,
        isAuto: p.is_auto || p.isAuto,
        modelType: p.model_type || p.modelType,
        modelName: p.model_name || p.modelName,
        addedFromDatabase: p.added_from_database || p.addedFromDatabase,
        // Keep original text field as prompt for compatibility
        prompt: p.text || p.prompt
      }));
      
      // No need to filter - API already returns recent data
      window.state.data.prompts = mappedPrompts;
      if (!isOffline) {
        console.log(`[DATA] Loaded ${mappedPrompts.length} recent prompts`);
      }
      
      // Store in cache
      if (window.persistentStorage) {
        await window.persistentStorage.storePrompts(mappedPrompts);
      }
    } else {
      console.warn('[WARNING] Prompts data not in expected format:', prompts);
      window.state.data.prompts = [];
    }
    
    // Process workspaces
    if (workspaces && workspaces.length > 0) {
      window.state.data.workspaces = workspaces;
    } else if (!workspaces || workspaces.length === 0) {
      // If no workspaces from API, try to extract from events and prompts
      const workspaceMap = new Map();
      
      // Extract from events
      (window.state.data.events || []).forEach(event => {
        const wsPath = event.workspace_path || event.workspacePath || event.workspace;
        if (wsPath) {
          if (!workspaceMap.has(wsPath)) {
            workspaceMap.set(wsPath, {
              path: wsPath,
              name: wsPath.split('/').pop() || 'Unknown',
              events: 0,
              entries: 0,
              promptCount: 0
            });
          }
          workspaceMap.get(wsPath).events++;
        }
      });
      
      // Extract from prompts
      (window.state.data.prompts || []).forEach(prompt => {
        const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId;
        if (wsPath) {
          if (!workspaceMap.has(wsPath)) {
            workspaceMap.set(wsPath, {
              path: wsPath,
              name: wsPath.split('/').pop() || 'Unknown',
              events: 0,
              entries: 0,
              promptCount: 0
            });
          }
          workspaceMap.get(wsPath).promptCount++;
        }
      });
      
      if (workspaceMap.size > 0) {
        window.state.data.workspaces = Array.from(workspaceMap.values());
      }
    }
    
    // Store workspace count in stats
    if (!window.state.stats) window.state.stats = {};
    window.state.stats.workspaces = window.state.data.workspaces?.length || 0;
    
    // Fetch system resources if available
    try {
      const systemRes = await window.APIClient.get('/raw-data/system-resources', { 
        timeout: 10000,
        retries: 1,
        silent: true
      }).catch(() => null);
      
      if (systemRes && systemRes.data && Array.isArray(systemRes.data)) {
        window.state.data.systemResources = systemRes.data;
      }
    } catch (err) {
      // System resources are optional, don't fail if unavailable
    }
    
    // Calculate stats after fetching data
    if (!isOffline) {
      console.log(`[SYNC] Fetch complete. Events: ${window.state.data.events.length}, Prompts: ${window.state.data.prompts.length}`);
    }
    if (window.calculateStats) {
      window.calculateStats();
    }
    
    // FIX: Re-render current view to update charts with fresh data
    if (window.state.currentView === 'analytics') {
      console.log('[CHART] Re-rendering charts with fresh data...');
      setTimeout(() => {
        if (window.renderCurrentView) {
          window.renderCurrentView();
        }
      }, 200);
    }
    
  } catch (error) {
    console.error('[ERROR] Error fetching recent data:', error);
    // Initialize with empty arrays to prevent crashes
    if (!window.state.data.events) window.state.data.events = [];
    if (!window.state.data.prompts) window.state.data.prompts = [];
    if (window.calculateStats) {
      window.calculateStats(); // Calculate with empty data to show 0s
    }
  }
}

/**
 * Fetch older history in the background (non-blocking)
 */
async function fetchOlderHistory() {
  // This can be implemented later if needed
  // For now, we rely on cached data for older history
  console.log('[SYNC] Older history fetch deferred (using cached data)');
}

/**
 * Fallback: Fetch all data (used when initialization fails)
 */
async function fetchAllData() {
  console.log('[SYNC] Fetching all data (fallback mode)...');
  // This is a simplified version - can be enhanced later
  await fetchRecentData();
}

// Check for share link in URL
function checkForShareLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const shareId = urlParams.get('share');
  
  // Also check if we're on a share route
  const pathMatch = window.location.pathname.match(/\/api\/share\/([^\/]+)/);
  const shareIdFromPath = pathMatch ? pathMatch[1] : null;
  
  const finalShareId = shareId || shareIdFromPath;
  
  if (finalShareId) {
    console.log('[SHARING] Share link detected:', finalShareId);
    // Wait for sharing handler to load, then import
    const checkSharingHandler = setInterval(() => {
      if (window.handleShareLinkImport) {
        clearInterval(checkSharingHandler);
        window.handleShareLinkImport(finalShareId).catch(err => {
          console.error('[SHARING] Error importing share link:', err);
        });
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkSharingHandler);
      if (!window.handleShareLinkImport) {
        console.warn('[SHARING] Sharing handler not loaded, cannot import share link');
      }
    }, 5000);
  }
}

// Export functions to window for global access
window.initializeDashboard = initializeDashboard;
window.loadFromCache = loadFromCache;
window.fetchRecentData = fetchRecentData;
window.fetchOlderHistory = fetchOlderHistory;
window.fetchAllData = fetchAllData;
window.checkForShareLink = checkForShareLink;

// Check for share link after a short delay to ensure sharing handler is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkForShareLink, 1000);
  });
} else {
  setTimeout(checkForShareLink, 1000);
}

