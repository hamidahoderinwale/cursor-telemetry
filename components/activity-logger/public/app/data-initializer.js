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
    
    // Step 2: Check server version (non-blocking - don't wait for it)
    window.initProgress.update('server', 0);
    let serverHealth = null;
    let isConnected = false;
    
    // Start health check but don't block on it - render UI first
    const healthCheckPromise = (async () => {
      try {
        const health = await window.APIClient.get('/health', { timeout: 5000, retries: 0, silent: true });
        return health;
      } catch (error) {
        return null; // Return null on error, will be handled below
      }
    })();
    
    // Mark server check as complete immediately (optimistic)
    window.initProgress.update('server', 100);
    window.updateConnectionStatus(false, 'Checking connection...');
    
    // Update connection status when health check completes (non-blocking)
    healthCheckPromise.then(health => {
      serverHealth = health;
      if (health) {
        isConnected = health.status === 'running' || health.sequence !== undefined;
        if (window.state) {
          window.state.connected = isConnected;
          window.state.companionServiceOnline = isConnected;
        }
        if (isConnected) {
          window.updateConnectionStatus(true, 'Connected to companion service');
        } else {
          window.updateConnectionStatus(false, 'Companion service offline');
        }
      } else {
        isConnected = false;
        if (window.state) {
          window.state.connected = false;
          window.state.companionServiceOnline = false;
        }
        const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
        window.updateConnectionStatus(false, `Offline - using cached data`);
      }
      
      // Check cache staleness after health check completes
      if (serverHealth && window.persistentStorage) {
        window.persistentStorage.isCacheStale(serverHealth.sequence || 0).then(stale => {
          if (stale && isConnected) {
            // Fetch updates in background
            fetchRecentData().catch(err => {
              console.warn('[WARNING] Background sync failed:', err.message);
            });
          }
        });
      }
    }).catch(() => {
      // Health check failed, continue with cached data
      isConnected = false;
      if (window.state) {
        window.state.connected = false;
        window.state.companionServiceOnline = false;
      }
      window.updateConnectionStatus(false, 'Offline - using cached data');
    });
    
    // Assume cache is fresh initially (optimistic)
    const cacheStale = false;
    
    // Skip blocking data fetch - use cached data immediately, sync in background
    console.log('[SUCCESS] Using cached data, syncing in background...');
    window.initProgress.update('data', 100);
    
    // Background sync will happen when health check completes (see above)
    
    // Step 3: Render initial UI immediately (defer stats calculation)
    window.initProgress.update('render', 0);
    
    // Show UI first, then calculate stats in background
    if (window.renderCurrentView) {
      // Render immediately without waiting for stats
      await window.renderCurrentView();
    }
    
    // Calculate stats in background after UI is visible
    if (window.calculateStats) {
      // Defer stats to background - don't block UI
      setTimeout(() => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => {
            window.calculateStats().catch(err => console.warn('[STATS] Stats calculation error:', err));
          }, { timeout: 1000 });
        } else {
          setTimeout(() => {
            window.calculateStats().catch(err => console.warn('[STATS] Stats calculation error:', err));
          }, 1000);
        }
      }, 100); // Small delay to let UI render first
    }
    
    window.initProgress.update('render', 100);
    
    // Mark as complete with final status
    if (isConnected) {
      window.initProgress.complete('Connected');
    } else {
      window.initProgress.complete('Offline - using cached data');
    }
    
    // Step 4: Background: fetch more data after initial render (optimized with idle time)
    if (isConnected) {
        // Use requestIdleCallback for background loading (low priority)
        const loadBackgroundData = () => {
            fetchOlderHistory();
            // Load more recent data to fill in gaps (up to 200 total for better performance)
            if (window.APIClient && window.state?.data?.events?.length < 200) {
                const currentCount = window.state?.data?.events?.length || 0;
                const additionalLimit = 200 - currentCount; // Load exactly what's needed
                window.APIClient.get(`/api/activity?limit=${additionalLimit}&offset=${currentCount}`, {
                    timeout: 30000,
                    retries: 1,
                    silent: true
                }).then(response => {
                    if (response?.data && Array.isArray(response.data)) {
                        // Merge with existing events, avoiding duplicates
                        const existingIds = new Set((window.state.data.events || []).map(e => e.id));
                        const newEvents = response.data.filter(e => !existingIds.has(e.id));
                        if (newEvents.length > 0) {
                            window.state.data.events = [...(window.state.data.events || []), ...newEvents];
                            console.log(`[BACKGROUND] Loaded ${newEvents.length} additional events`);
                            // Update stats (debounced)
                            if (window.calculateStats) {
                                window.calculateStats();
                            }
                        }
                    }
                }).catch(err => {
                    // Silently handle background loading errors
                });
            }
        };
        
        // Use idle time if available, otherwise delay
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(loadBackgroundData, { timeout: 5000 });
        } else {
            setTimeout(loadBackgroundData, 3000);
        }
    }
    
    // Step 5: Preload file graph data in background (non-blocking)
    // This allows the file graph to render instantly when the view is opened
    if (isConnected) {
      preloadFileGraphData();
    }
    
    // Step 6: Heavy analytics will be loaded on-demand via analyticsManager
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
  
  // Ensure database is initialized before accessing it
  try {
    await window.persistentStorage.init();
  } catch (initError) {
    console.warn('[WARNING] Failed to initialize database:', initError.message);
    return;
  }
  
  // Load minimal recent data (last 1 hour) for fastest startup
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000; // Reduced to 1 hour for even faster load
  
  try {
    // Load only most recent events (limit to 20 for ultra-fast load)
    if (window.persistentStorage.getAllEvents) {
      // Use getAllEvents with limit for fastest query
      const lastEvents = await window.persistentStorage.getAllEvents(20);
      if (lastEvents && lastEvents.length > 0) {
        window.state.data.events = lastEvents;
        console.log(`[SUCCESS] Loaded ${lastEvents.length} events from cache`);
      }
    }
    
    // Load only most recent prompts (limit to 20 for ultra-fast load)
    if (window.persistentStorage.getAllPrompts) {
      // Use getAllPrompts with limit for fastest query
      const lastPrompts = await window.persistentStorage.getAllPrompts(20);
      if (lastPrompts && lastPrompts.length > 0) {
        window.state.data.prompts = lastPrompts;
        console.log(`[SUCCESS] Loaded ${lastPrompts.length} prompts from cache`);
      }
    }
    
    // Don't calculate stats or render here - let main initialization handle it
    // This makes cache loading faster and non-blocking
    
    // Load more data in background (non-blocking) - limit to 100 total for faster loading
    const loadMoreData = async () => {
      try {
        // Only load up to 100 more events/prompts (reduced from 200)
        const currentEventCount = (window.state.data.events || []).length;
        const currentPromptCount = (window.state.data.prompts || []).length;
        const neededEvents = Math.max(0, 100 - currentEventCount);
        const neededPrompts = Math.max(0, 100 - currentPromptCount);
        
        if (neededEvents > 0 || neededPrompts > 0) {
          const [allEvents, allPrompts] = await Promise.all([
            neededEvents > 0 ? window.persistentStorage.getAllEvents(neededEvents) : Promise.resolve([]),
            neededPrompts > 0 ? window.persistentStorage.getAllPrompts(neededPrompts) : Promise.resolve([])
          ]);
          
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
            // Recalculate stats with full dataset (debounced, will batch)
            if (window.calculateStats) {
              window.calculateStats(); // Debounced internally
            }
          }
        }
      } catch (error) {
        // Silently fail - this is background loading
      }
    };
    
    // Defer to idle time or after delay
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(loadMoreData, { timeout: 5000 });
    } else {
      setTimeout(loadMoreData, 3000);
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
  
  const pageSize = 20; // Ultra-minimal initial load for fastest startup (load more in background)
  
  try {
    // Fetch recent events in parallel for faster loading (cloud-optimized)
    // Use longer timeout for slow endpoints (cursor database queries)
    const [activityResult, promptsResult, workspacesResult] = await Promise.allSettled([
      window.APIClient.get(`/api/activity?limit=${pageSize}`, { 
        timeout: 30000,  // 30 seconds for database queries
        retries: 1,
        silent: true  // Suppress error logging for expected offline scenarios
      }),
      window.APIClient.get(`/entries?limit=${pageSize}`, { 
        timeout: 30000,  // 30 seconds for database queries
        retries: 1,
        silent: true  // Suppress error logging for expected offline scenarios
      }),
      window.APIClient.get('/api/workspaces', { 
        timeout: 30000,  // 30 seconds for workspace queries
        retries: 1,
        silent: true  // Suppress error logging for expected offline scenarios
      })
    ]);
    
    // Process results with fallbacks
    const activity = activityResult.status === 'fulfilled' 
      ? activityResult.value 
      : (() => {
          const err = activityResult.reason;
          const isNetworkError = err?.message?.includes('CORS') || 
                                 err?.message?.includes('NetworkError') || 
                                 err?.message?.includes('Failed to fetch');
          if (!isNetworkError) {
            console.warn('[WARNING] Activity fetch failed, using cache:', err?.message);
          }
          return { data: window.state.data.events || [] };
        })();
    
    const prompts = promptsResult.status === 'fulfilled'
      ? promptsResult.value
      : (() => {
          const err = promptsResult.reason;
          const isNetworkError = err?.message?.includes('CORS') || 
                                 err?.message?.includes('NetworkError') || 
                                 err?.message?.includes('Failed to fetch');
          if (!isNetworkError) {
            console.warn('[WARNING] Prompts fetch failed, using cache:', err?.message);
          }
          return { entries: window.state.data.prompts || [] };
        })();
    
    const workspaces = workspacesResult.status === 'fulfilled'
      ? workspacesResult.value
      : (() => {
          const err = workspacesResult.reason;
          const isNetworkError = err?.message?.includes('CORS') || 
                                 err?.message?.includes('NetworkError') || 
                                 err?.message?.includes('Failed to fetch');
          if (!isNetworkError) {
            console.warn('[WARNING] Workspaces fetch failed, using cache:', err?.message);
          }
          return window.state.data.workspaces || [];
        })();
    
    // Process activity
    if (activity && activity.data && Array.isArray(activity.data)) {
      // Store total count for all-time stats
      if (activity.pagination?.total) {
        if (!window.state.stats) window.state.stats = {};
        window.state.stats.totalEventCount = activity.pagination.total;
      }
      
      // No need to filter - API already returns recent data
      const recentEvents = activity.data;
      
      // Mark as online if we got data
      if (window.state && !isOffline) {
        window.state.companionServiceOnline = true;
      }
      
      window.state.data.events = recentEvents;
      
      // Store in cache
      if (window.persistentStorage) {
        await window.persistentStorage.storeEvents(recentEvents);
      }
    } else {
      window.state.data.events = [];
    }
    
    // Process prompts
    
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
      
      // Store in cache
      if (window.persistentStorage) {
        await window.persistentStorage.storePrompts(mappedPrompts);
      }
    } else {
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
    
    // Calculate stats after fetching data (debounced, will batch multiple calls)
    if (!isOffline) {
      // Only log if significant data change
      const eventCount = window.state.data.events.length;
      const promptCount = window.state.data.prompts.length;
      if (eventCount > 0 || promptCount > 0) {
        // Log less frequently - only on significant updates
        console.log(`[SYNC] Data updated. Events: ${eventCount}, Prompts: ${promptCount}`);
      }
    }
    if (window.calculateStats) {
      window.calculateStats(); // Debounced internally
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
 * Precompute file similarities in background
 * This allows the file graph to render instantly with precomputed similarities
 */
async function precomputeFileSimilarities(files) {
  if (!files || files.length === 0) return;
  
  // Limit to reasonable number for performance
  const MAX_FILES_FOR_PRECOMPUTE = 500;
  const filesToProcess = files.length > MAX_FILES_FOR_PRECOMPUTE 
    ? files.slice(0, MAX_FILES_FOR_PRECOMPUTE)
    : files;
  
  if (files.length > MAX_FILES_FOR_PRECOMPUTE) {
    console.log(`[GRAPH] Limiting similarity precomputation to ${MAX_FILES_FOR_PRECOMPUTE} files (of ${files.length})`);
  }
  
  // Check if we need to recompute (cache expiry: 10 minutes)
  const cacheKey = 'fileGraphSimilarities';
  const cacheExpiry = 10 * 60 * 1000; // 10 minutes
  
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const cachedData = JSON.parse(cached);
      if (Date.now() - cachedData.timestamp < cacheExpiry && 
          cachedData.fileCount === filesToProcess.length) {
        console.log('[GRAPH] Similarities already cached, skipping precomputation');
        return;
      }
    }
  } catch (e) {
    // Cache invalid, continue
  }
  
  console.log('[GRAPH] Precomputing file similarities in background...');
  
  // Use requestIdleCallback to compute when browser is idle
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(async () => {
      try {
        // Get events from state (needed for co-occurrence similarity)
        const events = window.state?.data?.events || [];
        
        // Build a simplified similarity computation
        // Focus on co-occurrence and path similarity (faster than full TF-IDF)
        const similarities = [];
        const MAX_SIMILARITIES = 2000; // Limit total similarities
        let computed = 0;
        
        // Build event lookup map
        const eventsByFilePath = new Map();
        events.forEach(event => {
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            const filePath = details?.file_path || event.file_path || '';
            if (filePath) {
              const normalized = filePath.toLowerCase();
              if (!eventsByFilePath.has(normalized)) {
                eventsByFilePath.set(normalized, []);
              }
              eventsByFilePath.get(normalized).push(event);
            }
          } catch (e) {
            // Skip invalid events
          }
        });
        
        // Compute similarities in chunks with yielding
        const CHUNK_SIZE = 50;
        for (let i = 0; i < filesToProcess.length && computed < MAX_SIMILARITIES; i += CHUNK_SIZE) {
          const chunk = filesToProcess.slice(i, Math.min(i + CHUNK_SIZE, filesToProcess.length));
          
          for (const file1 of chunk) {
            if (computed >= MAX_SIMILARITIES) break;
            
            const events1 = eventsByFilePath.get((file1.path || '').toLowerCase()) || [];
            const sessions1 = new Set(events1.map(e => e.session_id).filter(Boolean));
            const prompts1 = new Set(events1.map(e => {
              const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
              return details?.prompt_id || e.prompt_id;
            }).filter(Boolean));
            
            for (let j = i + 1; j < filesToProcess.length && computed < MAX_SIMILARITIES; j++) {
              const file2 = filesToProcess[j];
              
              // Quick path similarity (fast)
              const path1 = (file1.path || '').toLowerCase();
              const path2 = (file2.path || '').toLowerCase();
              let pathSim = 0;
              if (path1 && path2) {
                const parts1 = path1.split('/');
                const parts2 = path2.split('/');
                let common = 0;
                for (let k = 0; k < Math.min(parts1.length, parts2.length); k++) {
                  if (parts1[k] === parts2[k]) common++;
                  else break;
                }
                pathSim = common / Math.max(parts1.length, parts2.length);
              }
              
              // Quick co-occurrence check (only if path similarity is decent)
              let cooccurSim = 0;
              if (pathSim > 0.1) {
                const events2 = eventsByFilePath.get(path2) || [];
                const sessions2 = new Set(events2.map(e => e.session_id).filter(Boolean));
                const prompts2 = new Set(events2.map(e => {
                  const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
                  return details?.prompt_id || e.prompt_id;
                }).filter(Boolean));
                
                const sessionIntersection = new Set([...sessions1].filter(s => sessions2.has(s)));
                const sessionUnion = new Set([...sessions1, ...sessions2]);
                const promptIntersection = new Set([...prompts1].filter(p => prompts2.has(p)));
                const promptUnion = new Set([...prompts1, ...prompts2]);
                
                const sessionSim = sessionUnion.size > 0 ? sessionIntersection.size / sessionUnion.size : 0;
                const promptSim = promptUnion.size > 0 ? promptIntersection.size / promptUnion.size : 0;
                cooccurSim = (sessionSim * 0.5) + (promptSim * 0.5);
              }
              
              // Combined similarity
              const similarity = (pathSim * 0.3) + (cooccurSim * 0.7);
              
              if (similarity > 0.15) { // Only store meaningful similarities
                similarities.push({
                  file1: file1.path || file1.name,
                  file2: file2.path || file2.name,
                  similarity: similarity,
                  pathSim: pathSim,
                  cooccurSim: cooccurSim
                });
                computed++;
              }
            }
          }
          
          // Yield to event loop every chunk
          if (i + CHUNK_SIZE < filesToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        // Cache the similarities
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            similarities: similarities,
            fileCount: filesToProcess.length,
            timestamp: Date.now()
          }));
          console.log(`[GRAPH] Precomputed ${similarities.length} file similarities (cached)`);
        } catch (e) {
          console.warn('[GRAPH] Failed to cache similarities:', e.message);
        }
      } catch (error) {
        console.warn('[GRAPH] Similarity precomputation error:', error.message);
      }
    }, { timeout: 30000 }); // Wait up to 30 seconds for idle time
  } else {
    // Fallback: compute after a delay (for browsers without requestIdleCallback)
    setTimeout(async () => {
      try {
        // Get events from state (needed for co-occurrence similarity)
        const events = window.state?.data?.events || [];
        
        // Build a simplified similarity computation
        // Focus on co-occurrence and path similarity (faster than full TF-IDF)
        const similarities = [];
        const MAX_SIMILARITIES = 2000; // Limit total similarities
        let computed = 0;
        
        // Build event lookup map
        const eventsByFilePath = new Map();
        events.forEach(event => {
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            const filePath = details?.file_path || event.file_path || '';
            if (filePath) {
              const normalized = filePath.toLowerCase();
              if (!eventsByFilePath.has(normalized)) {
                eventsByFilePath.set(normalized, []);
              }
              eventsByFilePath.get(normalized).push(event);
            }
          } catch (e) {
            // Skip invalid events
          }
        });
        
        // Compute similarities in chunks with yielding
        const CHUNK_SIZE = 50;
        for (let i = 0; i < filesToProcess.length && computed < MAX_SIMILARITIES; i += CHUNK_SIZE) {
          const chunk = filesToProcess.slice(i, Math.min(i + CHUNK_SIZE, filesToProcess.length));
          
          for (const file1 of chunk) {
            if (computed >= MAX_SIMILARITIES) break;
            
            const events1 = eventsByFilePath.get((file1.path || '').toLowerCase()) || [];
            const sessions1 = new Set(events1.map(e => e.session_id).filter(Boolean));
            const prompts1 = new Set(events1.map(e => {
              const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
              return details?.prompt_id || e.prompt_id;
            }).filter(Boolean));
            
            for (let j = i + 1; j < filesToProcess.length && computed < MAX_SIMILARITIES; j++) {
              const file2 = filesToProcess[j];
              
              // Quick path similarity (fast)
              const path1 = (file1.path || '').toLowerCase();
              const path2 = (file2.path || '').toLowerCase();
              let pathSim = 0;
              if (path1 && path2) {
                const parts1 = path1.split('/');
                const parts2 = path2.split('/');
                let common = 0;
                for (let k = 0; k < Math.min(parts1.length, parts2.length); k++) {
                  if (parts1[k] === parts2[k]) common++;
                  else break;
                }
                pathSim = common / Math.max(parts1.length, parts2.length);
              }
              
              // Quick co-occurrence check (only if path similarity is decent)
              let cooccurSim = 0;
              if (pathSim > 0.1) {
                const events2 = eventsByFilePath.get(path2) || [];
                const sessions2 = new Set(events2.map(e => e.session_id).filter(Boolean));
                const prompts2 = new Set(events2.map(e => {
                  const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
                  return details?.prompt_id || e.prompt_id;
                }).filter(Boolean));
                
                const sessionIntersection = new Set([...sessions1].filter(s => sessions2.has(s)));
                const sessionUnion = new Set([...sessions1, ...sessions2]);
                const promptIntersection = new Set([...prompts1].filter(p => prompts2.has(p)));
                const promptUnion = new Set([...prompts1, ...prompts2]);
                
                const sessionSim = sessionUnion.size > 0 ? sessionIntersection.size / sessionUnion.size : 0;
                const promptSim = promptUnion.size > 0 ? promptIntersection.size / promptUnion.size : 0;
                cooccurSim = (sessionSim * 0.5) + (promptSim * 0.5);
              }
              
              // Combined similarity
              const similarity = (pathSim * 0.3) + (cooccurSim * 0.7);
              
              if (similarity > 0.15) { // Only store meaningful similarities
                similarities.push({
                  file1: file1.path || file1.name,
                  file2: file2.path || file2.name,
                  similarity: similarity,
                  pathSim: pathSim,
                  cooccurSim: cooccurSim
                });
                computed++;
              }
            }
          }
          
          // Yield to event loop every chunk
          if (i + CHUNK_SIZE < filesToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
        
        // Cache the similarities
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            similarities: similarities,
            fileCount: filesToProcess.length,
            timestamp: Date.now()
          }));
          console.log(`[GRAPH] Precomputed ${similarities.length} file similarities (cached)`);
        } catch (e) {
          console.warn('[GRAPH] Failed to cache similarities:', e.message);
        }
      } catch (error) {
        console.warn('[GRAPH] Similarity precomputation error:', error.message);
      }
    }, 5000);
  }
}

/**
 * Preload file graph data in background (non-blocking)
 * This allows the file graph to render instantly when opened
 */
async function preloadFileGraphData() {
  // Use requestIdleCallback to defer until browser is idle
  const loadFileGraphData = async () => {
    try {
      const cacheKey = 'fileGraphData';
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      
      // Check if we already have valid cached data
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (Date.now() - cachedData.timestamp < cacheExpiry) {
            console.log('[GRAPH] File graph data already cached, skipping preload');
            return;
          }
        } catch (e) {
          // Cache invalid, continue to fetch
        }
      }
      
      // Fetch file graph data in background
      const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
      console.log('[GRAPH] Preloading file graph data in background...');
      
      // Use AbortController for timeout (more compatible than AbortSignal.timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${apiBase}/api/file-contents?limit=500`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache the data for instant loading when view opens
      if (data.files && data.files.length > 0) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: data,
            timestamp: Date.now()
          }));
          console.log(`[GRAPH] Preloaded ${data.files.length} files for file graph (cached)`);
          
          // Precompute similarities in background (non-blocking)
          // This allows the file graph to render instantly with precomputed similarities
          precomputeFileSimilarities(data.files).catch(err => {
            // Silently fail - this is background computation
            if (!err.message?.includes('NetworkError') && !err.message?.includes('CORS')) {
              console.warn('[GRAPH] Similarity precomputation failed:', err.message);
            }
          });
        } catch (e) {
          // Cache storage failed (quota exceeded), continue anyway
          console.warn('[GRAPH] Failed to cache file graph data:', e.message);
        }
      }
    } catch (error) {
      // Silently fail - this is background preloading, don't spam console
      // Only log if it's not a network error (expected when offline)
      const isNetworkError = error.message?.includes('CORS') || 
                             error.message?.includes('NetworkError') || 
                             error.message?.includes('Failed to fetch') ||
                             error.name === 'NetworkError' ||
                             error.name === 'TypeError' ||
                             error.name === 'AbortError';
      if (!isNetworkError) {
        console.warn('[GRAPH] File graph preload failed:', error.message);
      }
    }
  };
  
  // Defer until after critical operations complete
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadFileGraphData, { timeout: 5000 });
  } else {
    // Fallback: wait 3 seconds after initialization
    setTimeout(loadFileGraphData, 3000);
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
window.preloadFileGraphData = preloadFileGraphData;
window.checkForShareLink = checkForShareLink;

// Check for share link after a short delay to ensure sharing handler is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkForShareLink, 1000);
  });
} else {
  setTimeout(checkForShareLink, 1000);
}

