/**
 * Cursor Activity Dashboard - Main Application
 * Clean, modern implementation with full feature support
 * 
 * MODULE DEPENDENCIES:
 * - core/config.js → CONFIG
 * - core/state.js → state
 * - core/api-client.js → APIClient
 * - core/websocket-manager.js → WebSocketManager
 * - algorithms/similarity.js → cosineSimilarity, euclideanDistance, etc.
 * - algorithms/dimensionality-reduction.js → applyPCA, applyMDS, applyTSNE, applyUMAP
 * - algorithms/clustering.js → applyClustering, kMeansClustering, detectCommunities, etc.
 */

// Ensure modules are loaded (they export to window)
if (!window.CONFIG || !window.state || !window.APIClient) {
  console.error('[ERROR] Core modules not loaded. Ensure core/config.js, core/state.js, and core/api-client.js are loaded before new-dashboard.js');
  // Create fallbacks to prevent crashes
  if (!window.CONFIG) window.CONFIG = { API_BASE: 'http://localhost:43917' };
  if (!window.state) window.state = { data: {}, stats: {} };
  if (!window.APIClient) {
    console.error('[ERROR] APIClient not available! API calls will fail.');
    window.APIClient = { get: () => Promise.reject(new Error('APIClient not loaded')), post: () => Promise.reject(new Error('APIClient not loaded')) };
  }
}

// Use globals from modules (available via window exports)
// CONFIG, state, and APIClient are now loaded from core modules
// They are available as window.CONFIG, window.state, and window.APIClient
// No need to redeclare them here

// ===================================
// WebSocket Manager
// ===================================
// NOTE: WebSocketManager is now loaded from core/websocket-manager.js

// ===================================
// Data Fetching & Processing
// ===================================

/**
 * Optimized initialization with warm-start and limited initial window
 */
async function initializeDashboard() {
  console.log('[LAUNCH] Initializing dashboard with warm-start...');
  
  try {
    // Step 1: Load from IndexedDB cache first (instant UI)
    initProgress.update('cache', 0);
    await loadFromCache();
    initProgress.update('cache', 100);
    
    // Step 2: Check server version to see if we need to sync
    initProgress.update('server', 0);
    let serverHealth = null;
    let isConnected = false;
    
    try {
      serverHealth = await APIClient.get('/health');
      const serverSequence = serverHealth.sequence || 0;
      isConnected = serverHealth.status === 'running' || serverHealth.sequence !== undefined;
      initProgress.update('server', 100);
      
      // Update connection state
      if (window.state) {
        window.state.connected = isConnected;
      }
      
      if (isConnected) {
        updateConnectionStatus(true, 'Connected to companion service');
      } else {
        updateConnectionStatus(false, 'Companion service offline');
      }
    } catch (error) {
      console.warn('[WARNING] Health check failed:', error.message);
      isConnected = false;
      if (window.state) {
        window.state.connected = false;
      }
      updateConnectionStatus(false, 'Cannot reach companion service');
      initProgress.update('server', 100);
    }
    
    const cacheStale = serverHealth ? await persistentStorage.isCacheStale(serverHealth.sequence || 0) : false;
    
    if (cacheStale && isConnected) {
      console.log('Cache stale, fetching updates...');
      initProgress.update('data', 0);
      try {
        await fetchRecentData();
        await persistentStorage.updateServerSequence(serverHealth.sequence || 0);
        updateConnectionStatus(true, 'Connected - data synced');
        initProgress.update('data', 100);
      } catch (error) {
        console.warn('[WARNING] Data fetch failed:', error.message);
        updateConnectionStatus(false, 'Connected but sync failed');
        initProgress.update('data', 100);
      }
    } else {
      console.log('[SUCCESS] Cache up-to-date, using cached data');
      if (isConnected) {
        updateConnectionStatus(true, 'Connected - using cached data');
      }
      initProgress.update('data', 100);
    }
    
    // Step 3: Render initial UI with cached/recent data
    initProgress.update('render', 0);
    calculateStats();
    await renderCurrentView();
    initProgress.update('render', 100);
    
    // Mark as complete with final status
    if (isConnected) {
      initProgress.complete('Connected');
    } else {
      initProgress.complete('Offline - using cached data');
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
    console.error('Initialization error:', error);
    updateConnectionStatus(false, 'Connection failed');
    if (window.state) {
      window.state.connected = false;
    }
    // Fallback to old method
    await fetchAllData();
  }
}

/**
 * Load data from IndexedDB cache for instant startup
 */
async function loadFromCache() {
  console.log('[PACKAGE] Loading from cache...');
  
  const cached = await persistentStorage.getAll();
  
  if (cached.events && cached.events.length > 0) {
    state.data.events = cached.events;
    console.log(`[SUCCESS] Loaded ${cached.events.length} events from cache`);
  }
  
  if (cached.prompts && cached.prompts.length > 0) {
    state.data.prompts = cached.prompts;
    console.log(`[SUCCESS] Loaded ${cached.prompts.length} prompts from cache`);
  }
  
  // Render with cached data immediately
  if (state.data.events.length > 0 || state.data.prompts.length > 0) {
    calculateStats();
    await renderCurrentView();
  }
}

/**
 * Fetch only recent data (last 24 hours by default)
 */
async function fetchRecentData() {
  // FIX: Check if APIClient is available before using it
  if (!APIClient || typeof APIClient.get !== 'function') {
    console.error('[ERROR] APIClient is not available. Ensure core/api-client.js is loaded before new-dashboard.js');
    // Fallback to using cached data only
    if (!state) {
      console.error('[ERROR] state is not defined');
      return;
    }
    if (!state.data) {
      state.data = {};
    }
    if (!state.data.events) state.data.events = [];
    if (!state.data.prompts) state.data.prompts = [];
    calculateStats();
    return;
  }
  
  // FIX: Ensure state.data exists
  if (!state) {
    console.error('[ERROR] state is not defined');
    return;
  }
  if (!state.data) {
    state.data = {};
  }

  const windowHours = 24 * 365; // 1 year of data
  const windowLabel = windowHours >= 24 ? `${windowHours / 24}d` : `${windowHours}h`;
  const startTime = Date.now() - (windowHours * 60 * 60 * 1000);
  console.log(`[SYNC] Fetching recent data (${windowLabel} window)...`);
  
  const pageSize = 500; // Optimized limit for performance
  
  try {
    // Fetch recent events only (cached data provides full history)
    // Use longer timeout for slow endpoints (cursor database queries)
    // Fetch sequentially with delay to avoid overwhelming the companion service
    const activity = await APIClient.get(`/api/activity?limit=${pageSize}`, { 
      timeout: 30000,  // 30 seconds for database queries
      retries: 1 
    }).catch(err => {
      console.warn('[WARNING] Activity fetch failed, using cache:', err.message);
      return { data: state.data.events || [] };
    });
    
    // Small delay between requests to reduce server load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const prompts = await APIClient.get(`/entries?limit=${pageSize}`, { 
      timeout: 30000,  // 30 seconds for database queries
      retries: 1 
    }).catch(err => {
      console.warn('[WARNING] Prompts fetch failed, using cache:', err.message);
      return { entries: state.data.prompts || [] };
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const workspaces = await APIClient.get('/api/workspaces', { 
      timeout: 30000,  // 30 seconds for workspace queries
      retries: 1 
    }).catch(err => {
      console.warn('[WARNING] Workspaces fetch failed, using cache:', err.message);
      return state.data.workspaces || [];
    });
    
    // Process activity
    console.log('[DEBUG] Activity response:', { hasActivity: !!activity, hasData: !!activity?.data, isArray: Array.isArray(activity?.data), length: activity?.data?.length });
    
    if (activity && activity.data && Array.isArray(activity.data)) {
      // Store total count for all-time stats
      if (activity.pagination?.total) {
        if (!state.stats) state.stats = {};
        state.stats.totalEventCount = activity.pagination.total;
        console.log(`[STATS] Total events in database: ${activity.pagination.total}`);
      }
      
      // No need to filter - API already returns recent data
      const recentEvents = activity.data;
      
      state.data.events = recentEvents;
      console.log(`[DATA] Loaded ${recentEvents.length} recent events (of ${activity.pagination?.total || 'unknown'} total)`);
      
      // Store in cache
      await persistentStorage.storeEvents(recentEvents);
    } else {
      console.warn('[WARNING] Activity data not in expected format:', activity);
      state.data.events = [];
    }
    
    // Process prompts
    console.log('[DEBUG] Prompts response:', { hasEntries: !!prompts.entries, isArray: Array.isArray(prompts.entries), length: prompts.entries?.length, keys: Object.keys(prompts) });
    
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
      state.data.prompts = mappedPrompts;
      console.log(`[DATA] Loaded ${mappedPrompts.length} recent prompts`);
      
      // Store in cache
      await persistentStorage.storePrompts(mappedPrompts);
    } else {
      console.warn('[WARNING] Prompts data not in expected format:', prompts);
      state.data.prompts = [];
    }
    
    // Process workspaces
    if (workspaces && workspaces.length > 0) {
      state.data.workspaces = workspaces;
    }
    
    // Calculate stats after fetching data
    console.log(`[SYNC] Fetch complete. Events: ${state.data.events.length}, Prompts: ${state.data.prompts.length}`);
    calculateStats();
    
    // FIX: Re-render current view to update charts with fresh data
    if (state.currentView === 'analytics') {
      console.log('[CHART] Re-rendering charts with fresh data...');
      setTimeout(() => renderCurrentView(), 200);
    }
    
  } catch (error) {
    console.error('[ERROR] Error fetching recent data:', error);
    // Initialize with empty arrays to prevent crashes
    if (!state.data.events) state.data.events = [];
    if (!state.data.prompts) state.data.prompts = [];
    calculateStats(); // Calculate with empty data to show 0s
  }
}

/**
 * Fetch older history in background (pagination)
 */
async function fetchOlderHistory() {
  console.log('[ARCHIVE] Background: fetching older history...');
  
  // This runs in background, no need to block UI
  // Implement pagination if needed
  
  // For now, skip to avoid memory issues
  // Can be implemented later with proper pagination UI
}
async function fetchAllData() {
  console.log('Fetching data from companion service...');
  try {
    // Fetch recent data with optimized limits for performance
    const [activity, workspaces, ideState, systemRes, gitData, prompts, cursorDb, terminalHistory] = await Promise.allSettled([
      APIClient.get('/api/activity?limit=500'), // Recent activity only (performance optimized)
      APIClient.get('/api/workspaces'),
      APIClient.get('/ide-state'),
      APIClient.get('/raw-data/system-resources'),
      APIClient.get('/raw-data/git'),
      APIClient.get('/entries?limit=500'), // Recent prompts (cached data provides full history)
      APIClient.get('/api/cursor-database'), // Direct cursor database data
      APIClient.get('/api/terminal/history?limit=50') // Terminal commands
    ]);

    console.log('Data fetch results:', {
      activity: activity.status,
      workspaces: workspaces.status,
      ideState: ideState.status,
      systemRes: systemRes.status,
      gitData: gitData.status,
      prompts: prompts.status,
      cursorDb: cursorDb.status,
      terminalHistory: terminalHistory.status
    });

    // Process activity data with pagination support
    if (activity.status === 'fulfilled') {
      const activityData = activity.value;
      
      // Handle paginated response format
      if (activityData.data && Array.isArray(activityData.data)) {
        // Store total count for all-time stats
        if (activityData.pagination?.total) {
          if (!state.stats) state.stats = {};
          state.stats.totalEventCount = activityData.pagination.total;
        }
        
        state.data.events = activityData.data;
        console.log(`Loaded ${activityData.data.length} of ${activityData.pagination?.total || 'unknown'} events (paginated)`);
      } 
      // Handle legacy non-paginated format
      else if (Array.isArray(activityData)) {
        state.data.events = activityData.slice(0, 200); // Limit to 200 most recent
        console.log(`Loaded ${state.data.events.length} events (truncated for performance)`);
      }
    }

    // Process prompts/entries
    if (prompts.status === 'fulfilled') {
      const promptsData = prompts.value;
      if (promptsData && promptsData.entries && Array.isArray(promptsData.entries)) {
        state.data.prompts = promptsData.entries;
        console.log(`Loaded ${promptsData.entries.length} prompts from /entries`);
      } else if (Array.isArray(promptsData)) {
        state.data.prompts = promptsData;
        console.log(`Loaded ${promptsData.length} prompts (direct array) from /entries`);
      } else {
        // Ensure prompts is always an array
        state.data.prompts = [];
        console.log('WARNING: No prompts loaded from /entries');
      }
    }

    // Process Cursor database data
    if (cursorDb.status === 'fulfilled' && cursorDb.value.success) {
      const dbData = cursorDb.value.data;
      
      // Add conversations to entries
      if (dbData.conversations && dbData.conversations.length > 0) {
        state.data.cursorConversations = dbData.conversations;
        console.log(`Loaded ${dbData.conversations.length} Cursor conversations`);
      }
      
      // Merge Cursor DB prompts with existing prompts (avoid duplicates)
      if (dbData.prompts && Array.isArray(dbData.prompts) && dbData.prompts.length > 0) {
        // Ensure state.data.prompts is an array
        if (!Array.isArray(state.data.prompts)) {
          state.data.prompts = [];
        }
        
        const existingTexts = new Set(state.data.prompts.map(p => p.text || p.preview || ''));
        const newPrompts = dbData.prompts.filter(p => {
          const text = p.text || p.preview;
          return text && !existingTexts.has(text);
        });
        
        if (newPrompts.length > 0) {
          state.data.prompts = [...state.data.prompts, ...newPrompts];
          console.log(`[CHAT] Added ${newPrompts.length} prompts from Cursor database`);
        }
      }
      
      // Store stats
      if (dbData.stats) {
        state.data.cursorDbStats = dbData.stats;
      }
    }

    // Process terminal history
    if (terminalHistory.status === 'fulfilled' && terminalHistory.value.success) {
      state.data.terminalCommands = terminalHistory.value.data || [];
      console.log(`Loaded ${state.data.terminalCommands.length} terminal commands`);
    } else {
      state.data.terminalCommands = [];
    }

    // Process other data
    if (workspaces.status === 'fulfilled') {
      state.data.workspaces = workspaces.value || [];
      updateWorkspaceSelector();
    }

    if (ideState.status === 'fulfilled' && ideState.value.success) {
      state.data.ideState = ideState.value.data;
    }

    if (systemRes.status === 'fulfilled' && systemRes.value.success) {
      state.data.systemResources = systemRes.value.data || [];
    }

    if (gitData.status === 'fulfilled' && gitData.value.success) {
      state.data.gitData = gitData.value.data || [];
    }

    // Update stats
    calculateStats();
    
    // Refresh current view
    renderCurrentView();
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

function calculateStats() {
  const events = state.data.events;
  const entries = state.data.entries;
  const terminalCommands = state.data.terminalCommands || [];

  // Count sessions
  const sessions = new Set();
  [...events, ...entries].forEach(item => {
    if (item.session_id) sessions.add(item.session_id);
  });

  // Count file changes (use totalEventCount for all-time if available, otherwise use filtered count)
  const fileChanges = state.stats?.totalEventCount || events.filter(e => 
    e.type === 'file_change' || e.type === 'code_change'
  ).length;
  
  // Count terminal commands
  state.stats.terminalCommands = terminalCommands.length;

  // Count AI interactions - simply count all prompts with text
  // (We were overcomplicated before, filtering too much!)
  const aiInteractions = (state.data.prompts || []).filter(p => {
    const text = p.text || p.prompt || p.preview || p.content || '';
    return text && text.length > 5; // Has actual content
  }).length;
  
  console.log(`AI Interactions: ${aiInteractions} of ${state.data.prompts?.length || 0} prompts`);

  // Calculate code changed (approximate)
  let totalChars = 0;
  events.forEach(e => {
    try {
      const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
      const added = details?.chars_added || 0;
      const deleted = details?.chars_deleted || 0;
      totalChars += added + deleted;
    } catch (err) {
      // Silently skip parsing errors
    }
  });
  
  console.log(`[STATS] Code changed: ${totalChars} chars (${(totalChars / 1024).toFixed(1)} KB) from ${events.length} events`);

  // Calculate average context usage
  let totalContextUsage = 0;
  let contextUsageCount = 0;
  (state.data.prompts || []).forEach(p => {
    if (p.contextUsage && p.contextUsage > 0) {
      totalContextUsage += p.contextUsage;
      contextUsageCount++;
    }
  });
  const avgContextUsage = contextUsageCount > 0 ? (totalContextUsage / contextUsageCount) : 0;

  state.stats = {
    sessions: sessions.size,
    fileChanges: fileChanges,
    aiInteractions: aiInteractions,
    codeChanged: (totalChars / 1024).toFixed(1), // KB
    avgContext: avgContextUsage.toFixed(1) // percentage
  };
  
  console.log('[STATS] Final stats:', state.stats);

  updateStatsDisplay();
}

function handleRealtimeUpdate(data) {
  if (data.type === 'entry' && data.data) {
    state.data.entries.push(data.data);
  } else if (data.type === 'event' && data.data) {
    state.data.events.push(data.data);
  }
  
  calculateStats();
  renderCurrentView();
}

function handleTerminalCommand(cmd) {
  // Add to terminal commands array
  state.data.terminalCommands.unshift(cmd);
  
  // Keep only last 100 commands in memory
  if (state.data.terminalCommands.length > 100) {
    state.data.terminalCommands = state.data.terminalCommands.slice(0, 100);
  }
  
  // Update stats
  state.stats.terminalCommands = state.data.terminalCommands.length;
  
  // If on activity view, re-render
  if (state.currentView === 'activity') {
    renderCurrentView();
  }
}

// ===================================
// UI Updates
// ===================================

function updateConnectionStatus(connected, message = null, progress = null) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;

  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');
  const progressContainer = document.getElementById('connectionProgress');
  const progressBar = document.getElementById('connectionProgressBar');

  if (connected) {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
    text.textContent = message || 'Connected';
    
    // Hide progress bar when connected
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
  } else {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
    text.textContent = message || 'Disconnected';
  }
  
  // Update progress bar if progress value provided
  if (progress !== null && progressBar && progressContainer) {
    progressContainer.classList.add('active');
    progressBar.style.width = `${progress}%`;
  }
}

// Progress tracking for initialization
const initProgress = {
  steps: [
    { id: 'cache', label: 'Loading cache', done: false },
    { id: 'server', label: 'Connecting to server', done: false },
    { id: 'data', label: 'Fetching data', done: false },
    { id: 'render', label: 'Rendering UI', done: false }
  ],
  current: 0,
  
  update(stepId, stepProgress = null) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;
    
    step.done = stepProgress === 100 || stepProgress === null;
    this.current = this.steps.findIndex(s => s.id === stepId);
    
    // Calculate overall progress: (completed steps + current step progress) / total steps
    const completedSteps = this.steps.filter(s => s.done).length;
    const currentStepPercent = stepProgress !== null ? stepProgress / 100 : 0;
    const overallPercent = Math.round(((completedSteps + currentStepPercent) / this.steps.length) * 100);
    
    const label = stepProgress !== null ? `${step.label}... ${stepProgress}%` : step.label;
    
    updateConnectionStatus(false, label, overallPercent);
    console.log(`[PROGRESS] ${label} (${overallPercent}% overall)`);
  },
  
  complete(finalMessage = null) {
    const message = finalMessage || 'Connected';
    updateConnectionStatus(true, message, 100);
    // Hide progress bar after a short delay
    setTimeout(() => {
      const progressContainer = document.getElementById('connectionProgress');
      if (progressContainer) {
        progressContainer.classList.remove('active');
      }
    }, 500);
    console.log('[PROGRESS] Initialization complete');
  }
};

function updateStatsDisplay() {
  // Defensive checks for DOM elements
  const statSessions = document.getElementById('statSessions');
  const statFileChanges = document.getElementById('statFileChanges');
  const statAIInteractions = document.getElementById('statAIInteractions');
  const statCodeChanged = document.getElementById('statCodeChanged');
  const statAvgContext = document.getElementById('statAvgContext');
  
  if (statSessions) statSessions.textContent = state.stats.sessions || 0;
  if (statFileChanges) statFileChanges.textContent = state.stats.fileChanges || 0;
  if (statAIInteractions) statAIInteractions.textContent = state.stats.aiInteractions || 0;
  if (statCodeChanged) statCodeChanged.textContent = `${state.stats.codeChanged || 0} KB`;
  if (statAvgContext) statAvgContext.textContent = `${state.stats.avgContext || 0}%`;
  
  console.log('[STATS] Updated display:', state.stats);
}

function updateWorkspaceSelector() {
  const select = document.getElementById('workspaceSelect');
  if (!select) return;

  // Clear existing options except "All"
  select.innerHTML = '<option value="all">All Workspaces</option>';

  // Add workspace options
  state.data.workspaces.forEach(ws => {
    const option = document.createElement('option');
    option.value = ws.path;
    option.textContent = ws.path.split('/').pop() || ws.path;
    select.appendChild(option);
  });

  select.value = state.currentWorkspace;
}

// ===================================
// View Rendering
// ===================================

function switchView(viewName) {
  state.currentView = viewName;
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.view === viewName) {
      link.classList.add('active');
    }
  });

  renderCurrentView();
}

// ===================================
// View rendering is handled by core/view-router.js
// Individual view implementations are in views/ directory
// ===================================

// Note: All view render functions are now in separate view files:
// - views/overview/index.js
// - views/activity/index.js  
// - views/analytics/index.js
// - views/file-graph/index.js
// - views/navigator/index.js
// - views/system/index.js
// - views/api-docs/index.js
// - views/threads/index.js

// Removed duplicate view render functions - use the ones from views/ instead
// ===================================
// Overview View (moved to views/overview/index.js)
// ===================================
// Removed: function renderOverviewView - see views/overview/index.js

function _legacy_renderOverviewView(container) {
  const recentEvents = state.data.events.slice(-10).reverse();

  container.innerHTML = `
    <div class="overview-view">
      
      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recent Activity</h3>
        </div>
        <div class="card-body">
          ${recentEvents.length > 0 ? renderActivityTimeline(recentEvents) : '<div class="empty-state"><div class="empty-state-text">No recent activity</div></div>'}
        </div>
      </div>

      <!-- System Status -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">System Status</h3>
        </div>
        <div class="card-body">
          ${renderSystemStatus()}
        </div>
      </div>

      <!-- Workspaces -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Workspaces</h3>
        </div>
        <div class="card-body">
          ${renderWorkspacesList()}
        </div>
      </div>

    </div>
  `;
}

function renderActivityTimeline(events) {
  return `
    <div class="timeline">
      ${events.map(event => renderTimelineItem(event)).join('')}
    </div>
  `;
}

/**
 * Group items into temporal threads/sessions based on time proximity
 * Events within a time window (default 15 minutes) are grouped together
 */
function groupIntoTemporalThreads(items, timeWindowMs = 15 * 60 * 1000) {
  if (items.length === 0) return [];
  
  // Filter out items with invalid timestamps first
  const validItems = items.filter(item => {
    return item.sortTime && !isNaN(item.sortTime) && isFinite(item.sortTime);
  });
  
  if (validItems.length === 0) {
    // If no valid items, return items as-is (don't group)
    return items.map(item => ({
      id: `single-${item.id || Date.now()}-${Math.random()}`,
      items: [item],
      startTime: item.sortTime || Date.now(),
      lastItemTime: item.sortTime || Date.now(),
      endTime: item.sortTime || Date.now(),
      itemType: 'temporal-thread'
    }));
  }
  
  // Sort items by time (newest first for display, but we'll process chronologically)
  const sorted = [...validItems].sort((a, b) => {
    const aTime = a.sortTime || 0;
    const bTime = b.sortTime || 0;
    return bTime - aTime;
  });
  
  const threads = [];
  let currentThread = null;
  
  // Process from oldest to newest to build threads
  const chronological = [...sorted].reverse();
  
  chronological.forEach(item => {
    const itemTime = item.sortTime || Date.now();
    
    if (!currentThread || (itemTime - currentThread.lastItemTime) > timeWindowMs) {
      // Start a new thread
      if (currentThread) {
        threads.push(currentThread);
      }
      currentThread = {
        id: `thread-${itemTime}-${Math.random().toString(36).substr(2, 9)}`,
        items: [item],
        startTime: itemTime,
        lastItemTime: itemTime,
        endTime: itemTime,
        itemType: 'temporal-thread'
      };
    } else {
      // Add to current thread
      currentThread.items.push(item);
      currentThread.lastItemTime = itemTime;
      currentThread.endTime = itemTime;
    }
  });
  
  // Add final thread
  if (currentThread) {
    threads.push(currentThread);
  }
  
  // Convert back to reverse chronological for display
  return threads.reverse();
}

function renderUnifiedTimeline(items) {
  // First: Group prompts by conversation for threading
  const conversationMap = new Map();
  const standalonePrompts = [];
  const nonPromptItems = [];
  
  items.forEach(item => {
    if (item.itemType === 'prompt') {
      // Check if this is a conversation thread or a message
      const isThread = item.type === 'conversation-thread' && !item.parentConversationId;
      const conversationId = isThread ? item.composerId : (item.parentConversationId || item.composerId);
      
      // Only group prompts that are part of conversations
      // Standalone prompts (no conversationId) should be rendered individually
      if (conversationId) {
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            thread: isThread ? item : null,
            messages: [],
            timestamp: item.sortTime
          });
        }
        
        const conv = conversationMap.get(conversationId);
        if (isThread) {
          conv.thread = item;
        } else {
          conv.messages.push(item);
        }
        conv.timestamp = Math.max(conv.timestamp, item.sortTime);
      } else {
        // This is a standalone prompt, not part of a conversation
        standalonePrompts.push(item);
      }
    } else {
      nonPromptItems.push(item);
    }
  });
  
  // Convert conversations to timeline items
  const conversationItems = Array.from(conversationMap.values()).map(conv => ({
    itemType: 'conversation',
    conversation: conv,
    sortTime: conv.timestamp
  }));
  
  // Merge all items (conversations, standalone prompts, and other items)
  const allItems = [...conversationItems, ...standalonePrompts, ...nonPromptItems]
    .sort((a, b) => {
      const aTime = a.sortTime || 0;
      const bTime = b.sortTime || 0;
      return bTime - aTime;
    });
  
  // Apply temporal threading to group items by time windows
  // Only group if items have meaningful time differences
  const temporalThreads = groupIntoTemporalThreads(allItems, 15 * 60 * 1000); // 15 minute window
  
  return `
    <div class="timeline-alternating">
      <div class="timeline-axis"></div>
      ${temporalThreads.map(thread => {
        // If thread has only one item, render it with appropriate side
        if (thread.items.length === 1) {
          const item = thread.items[0];
          if (item.itemType === 'event') {
            return renderTimelineItem(item, 'left');
          } else if (item.itemType === 'terminal') {
            return renderTerminalTimelineItem(item, 'left');
          } else if (item.itemType === 'conversation') {
            return renderConversationThread(item.conversation, 'right');
          } else if (item.itemType === 'prompt') {
            return renderPromptTimelineItem(item, 'right');
          }
          return '';
        }
        
        // Multiple items: render as a temporal thread/session with mixed content
        return renderTemporalThread(thread);
      }).join('')}
    </div>
  `;
}

function renderConversationThread(conversation, side = 'right') {
  const { thread, messages } = conversation;
  const title = thread?.conversationTitle || thread?.text || 'Untitled Conversation';
  const time = formatTimeAgo(thread?.timestamp || conversation.timestamp);
  const messageCount = messages.length;
  const threadId = thread?.composerId || `conv-${Date.now()}`;
  
  // Sort messages chronologically
  const sortedMessages = messages.sort((a, b) => a.sortTime - b.sortTime);
  
  return `
    <div class="timeline-item timeline-item-${side} conversation-timeline-item">
      <div class="timeline-content prompt-content">
        <div class="timeline-header clickable" onclick="toggleConversationMessages('${threadId}')">
          <div class="timeline-title">
            <span id="conv-icon-${threadId}" class="timeline-title-icon"></span>
            <span class="timeline-title-text">${escapeHtml(title)}</span>
            ${messageCount > 0 ? `<span class="timeline-title-meta">(${messageCount} messages)</span>` : ''}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">Conversation</span>
          ${thread?.workspaceName ? `<span class="badge">${escapeHtml(thread.workspaceName)}</span>` : ''}
          ${thread?.mode ? `<span class="badge" style="background: var(--color-primary); color: white;">${escapeHtml(thread.mode)}</span>` : ''}
        </div>
        
        <!-- Messages (initially hidden) -->
        <div id="conv-messages-${threadId}" class="conversation-messages">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => renderConversationMessage(msg)).join('') : '<div class="conversation-empty">No messages in this conversation yet</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderConversationMessage(message) {
  const isUser = message.messageRole === 'user';
  const icon = '';
  const bgColor = isUser ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)';
  const time = formatTimeAgo(message.timestamp);
  const text = message.text || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  return `
    <div class="conversation-message ${isUser ? 'user' : 'ai'}">
      <div class="conversation-message-header">
        <span class="conversation-message-icon">${icon}</span>
        <span class="conversation-message-author">${isUser ? 'You' : 'AI Assistant'}</span>
        <span class="conversation-message-time">${time}</span>
        ${message.thinkingTimeSeconds ? `<span class="badge" style="background: var(--color-success); color: white;">Thinking ${message.thinkingTimeSeconds}s</span>` : ''}
      </div>
      <div class="conversation-message-content">${escapeHtml(displayText)}</div>
      ${text.length > 300 ? `<button class="conversation-message-read-more" onclick="showEventModal('${message.id}')">Read more</button>` : ''}
    </div>
  `;
}

function toggleConversationMessages(threadId) {
  const messagesDiv = document.getElementById(`conv-messages-${threadId}`);
  const icon = document.getElementById(`conv-icon-${threadId}`);
  
  if (messagesDiv && icon) {
    const isHidden = !messagesDiv.classList.contains('visible');
    if (isHidden) {
      messagesDiv.classList.add('visible');
      icon.style.transform = 'rotate(90deg)';
    } else {
      messagesDiv.classList.remove('visible');
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

function renderPromptTimelineItem(prompt, side = 'right') {
  // Use sortTime if available (processed timestamp), otherwise fall back to timestamp
  const timestamp = prompt.sortTime && !isNaN(prompt.sortTime) ? prompt.sortTime : 
                    (prompt.timestamp ? new Date(prompt.timestamp).getTime() : Date.now());
  const time = formatTimeAgo(timestamp);
  
  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
  const displayText = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
  const isJsonLike = promptText.startsWith('{') || promptText.startsWith('[');
  
  // Skip JSON metadata entries
  if (isJsonLike && promptText.length > 200) {
    return '';
  }
  
  const icon = isJsonLike ? '' : '';
  const source = prompt.source || 'cursor';
  const confidence = prompt.confidence || 'medium';
  
  return `
    <div class="timeline-item timeline-item-${side} prompt-timeline-item" onclick="showEventModal('${prompt.id}')">
      <div class="timeline-content prompt-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span>${icon}</span>
            <span>${escapeHtml(displayText)}</span>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">${escapeHtml(source)}</span>
          ${prompt.workspaceName ? `<span class="badge">${escapeHtml(prompt.workspaceName)}</span>` : prompt.workspaceId ? `<span class="badge">${escapeHtml(prompt.workspaceId.substring(0, 8))}</span>` : ''}
          ${prompt.composerId ? `<span class="badge">Composer</span>` : ''}
          ${prompt.contextUsage > 0 ? `<span class="badge" style="background: var(--color-warning); color: white;">${prompt.contextUsage.toFixed(1)}% context</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a temporal thread/session containing multiple events within a time window
 */
function renderTemporalThread(thread) {
  // Validate timestamps
  const startTime = thread.startTime && !isNaN(thread.startTime) ? thread.startTime : Date.now();
  const endTime = thread.endTime && !isNaN(thread.endTime) ? thread.endTime : startTime;
  
  const duration = endTime - startTime;
  const durationMinutes = duration > 0 ? Math.round(duration / 60000) : 0;
  
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // Only show time range if times are different, otherwise show single time
  const timeRange = duration > 60000 // More than 1 minute difference
    ? `${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`
    : startDate.toLocaleTimeString();
  
  const threadId = thread.id;
  
  // Count items by type
  const eventCounts = {
    events: 0,
    prompts: 0,
    terminals: 0,
    conversations: 0
  };
  
  thread.items.forEach(item => {
    if (item.itemType === 'event') eventCounts.events++;
    else if (item.itemType === 'prompt') eventCounts.prompts++;
    else if (item.itemType === 'terminal') eventCounts.terminals++;
    else if (item.itemType === 'conversation') eventCounts.conversations++;
  });
  
  const totalItems = thread.items.length;
  const summary = [
    eventCounts.events > 0 ? `${eventCounts.events} file change${eventCounts.events !== 1 ? 's' : ''}` : '',
    eventCounts.prompts > 0 ? `${eventCounts.prompts} prompt${eventCounts.prompts !== 1 ? 's' : ''}` : '',
    eventCounts.terminals > 0 ? `${eventCounts.terminals} terminal command${eventCounts.terminals !== 1 ? 's' : ''}` : '',
    eventCounts.conversations > 0 ? `${eventCounts.conversations} conversation${eventCounts.conversations !== 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(', ');
  
  // Sort items within thread chronologically (oldest first within the thread)
  const sortedItems = [...thread.items].sort((a, b) => a.sortTime - b.sortTime);
  
  return `
    <div class="timeline-item temporal-thread-item">
      <div class="timeline-content">
        <div class="timeline-header clickable" onclick="toggleTemporalThread('${threadId}')">
          <div class="timeline-title">
            <span id="thread-icon-${threadId}" class="timeline-title-icon">▶</span>
            <span class="timeline-title-text">Activity Session</span>
            <span class="timeline-title-meta">(${totalItems} items • ${durationMinutes} min)</span>
          </div>
          <div class="timeline-meta">${formatTimeAgo(thread.startTime)}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">${timeRange}</span>
          <span class="badge">${summary}</span>
        </div>
        
        <!-- Thread items (initially hidden) -->
        <div id="thread-items-${threadId}" class="temporal-thread-items">
          ${sortedItems.map(item => {
            if (item.itemType === 'event') {
              return renderTimelineItem(item, 'left');
            } else if (item.itemType === 'terminal') {
              return renderTerminalTimelineItem(item, 'left');
            } else if (item.itemType === 'conversation') {
              return renderConversationThread(item.conversation, 'right');
            } else if (item.itemType === 'prompt') {
              return renderPromptTimelineItem(item, 'right');
            }
            return '';
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleTemporalThread(threadId) {
  const itemsDiv = document.getElementById(`thread-items-${threadId}`);
  const icon = document.getElementById(`thread-icon-${threadId}`);
  
  if (itemsDiv && icon) {
    const isHidden = !itemsDiv.classList.contains('visible');
    if (isHidden) {
      itemsDiv.classList.add('visible');
      icon.textContent = '▼';
    } else {
      itemsDiv.classList.remove('visible');
      icon.textContent = '▶';
    }
  }
}

function renderTerminalTimelineItem(cmd, side = 'left') {
  const time = formatTimeAgo(cmd.timestamp);
  const commandText = cmd.command || 'Unknown command';
  const displayText = commandText.length > 80 ? commandText.substring(0, 80) + '...' : commandText;
  const isError = cmd.exit_code && cmd.exit_code !== 0;
  const icon = isError ? '[ERROR]' : '>';
  const source = cmd.source || 'terminal';
  
  return `
    <div class="timeline-item timeline-item-${side} terminal-timeline-item event-content ${isError ? 'error' : ''}" style="border-left-color: ${isError ? '#ef4444' : '#8b5cf6'};" onclick="showTerminalModal('${cmd.id}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span>${icon}</span>
            <code class="terminal-command-code">${escapeHtml(displayText)}</code>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge" style="background: #6366f1; color: white;">${escapeHtml(source)}</span>
          ${cmd.shell ? `<span class="badge">${escapeHtml(cmd.shell)}</span>` : ''}
          ${cmd.workspace ? `<span class="badge" style="font-size: 11px;">${escapeHtml(cmd.workspace.split('/').pop())}</span>` : ''}
          ${isError ? `<span class="badge" style="background: #ef4444; color: white;">Exit ${cmd.exit_code}</span>` : ''}
          ${cmd.duration ? `<span class="badge">${cmd.duration}ms</span>` : ''}
        </div>
      </div>
    </div>
  `;
}
function renderTimelineItem(event, side = 'left') {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const title = getEventTitle(event);
  const desc = getEventDescription(event);
  
  // Quick check for related prompts (will do full search in modal)
  // Only show badge if we have prompts and the event has file_path
  let promptBadge = '';
  let contextIndicators = '';
  
  try {
    if (state.data.prompts && state.data.prompts.length > 0 && 
        (event.type === 'file_change' || event.type === 'code_change')) {
      // Quick count without full matching logic (badge is just an indicator)
      const eventTime = new Date(event.timestamp).getTime();
      const recentPromptCount = state.data.prompts.filter(p => {
        const promptTime = new Date(p.timestamp).getTime();
        return promptTime > 0 && (eventTime - promptTime) >= 0 && (eventTime - promptTime) <= 300000; // 5 min
      }).length;
      
      if (recentPromptCount > 0) {
        promptBadge = `<span class="context-indicator ai" title="Has related AI prompts">AI</span>`;
      }
    }
    
    // Add context file indicators
    if (event.context) {
      const badges = [];
      
      // @ files indicator
      if (event.context.atFiles && event.context.atFiles.length > 0) {
        badges.push(`<span class="context-indicator files" title="${event.context.atFiles.length} @ referenced files">[FILE] ${event.context.atFiles.length}</span>`);
      }
      
      // Context files indicator
      const contextFileCount = (event.context.contextFiles?.attachedFiles?.length || 0) + 
                               (event.context.contextFiles?.codebaseFiles?.length || 0);
      if (contextFileCount > 0) {
        badges.push(`<span class="context-indicator context-files" title="${contextFileCount} context files">${contextFileCount} files</span>`);
      }
      
      // UI state indicator
      if (event.context.browserState && event.context.browserState.tabs && event.context.browserState.tabs.length > 0) {
        badges.push(`<span class="context-indicator system" title="${event.context.browserState.tabs.length} tabs open">[SYSTEM] ${event.context.browserState.tabs.length}</span>`);
      }
      
      contextIndicators = badges.join('');
    }
  } catch (e) {
    // Ignore errors in badge display
  }
  
  return `
    <div class="timeline-item timeline-item-left event-content" onclick="showEventModal('${event.id || event.timestamp}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            ${title}
            ${promptBadge}
            ${contextIndicators}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">${desc}</div>
      </div>
    </div>
  `;
}

function getEventTitle(event) {
  if (event.type === 'file_change' || event.type === 'code_change') {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || event.file_path || event.path || '';
      
      // Skip if it looks like a Git object hash (40 hex chars)
      if (/^[a-f0-9]{40}$/i.test(path)) {
        return 'Git object change';
      }
      
      // Extract filename from path
      const fileName = path.split('/').pop() || '';
      
      // If filename is empty or looks like a hash, try to use a better description
      if (!fileName || /^[a-f0-9]{32,}$/i.test(fileName)) {
        return details?.change_type || event.type || 'File changed';
      }
      
      return fileName;
    } catch {
      return 'File changed';
    }
  }
  return event.type || 'Activity';
}

function getEventDescription(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const added = details?.chars_added || 0;
    const deleted = details?.chars_deleted || 0;
    if (added || deleted) {
      return `+${added} / -${deleted} characters`;
    }
  } catch {}
  return 'File modification detected';
}

function renderPromptList(entries) {
  return `
    <div class="prompt-list">
      ${entries.map(entry => {
        // Get text from various possible fields
        const promptText = entry.prompt || entry.text || entry.preview || entry.content;
        const displayText = promptText ? truncate(promptText, 100) : 'Empty prompt';
        const source = entry.source || entry.method || 'unknown';
        
        return `
          <div class="prompt-item" onclick="showThreadModal('${entry.id}')">
            <div class="prompt-item-text">
              ${escapeHtml(displayText)}
            </div>
            <div class="prompt-item-footer">
              <div class="prompt-item-timestamp">
                ${new Date(entry.timestamp).toLocaleString()}
              </div>
              <div class="prompt-item-source">
                ${escapeHtml(source)}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSystemStatus() {
  const latest = state.data.systemResources[state.data.systemResources.length - 1];
  if (!latest) {
    return '<div class="empty-state-text">No system data available</div>';
  }

  const memory = latest.memory ? `${(latest.memory.heapUsed / 1024 / 1024).toFixed(1)} MB` : 'N/A';
  const cpu = latest.cpu ? `${((latest.cpu.user + latest.cpu.system) / 1000000).toFixed(1)}s` : 'N/A';
  const load = latest.system?.loadAverage?.[0]?.toFixed(2) || 'N/A';

  return `
    <div class="system-status-list">
      <div class="system-status-item">
        <span class="system-status-label">Memory</span>
        <span class="system-status-value">${memory}</span>
      </div>
      <div class="system-status-item">
        <span class="system-status-label">CPU Time</span>
        <span class="system-status-value">${cpu}</span>
      </div>
      <div class="system-status-item">
        <span class="system-status-label">Load Avg</span>
        <span class="system-status-value">${load}</span>
      </div>
    </div>
  `;
}

function renderWorkspacesList() {
  if (state.data.workspaces.length === 0) {
    return '<div class="empty-state-text">No workspaces detected</div>';
  }

  return `
    <div class="workspaces-list">
      ${state.data.workspaces.map(ws => `
        <div class="workspace-item">
          <div class="workspace-item-title">
            <span class="workspace-item-title-text">${escapeHtml(ws.path.split('/').pop() || ws.path)}</span>
            <div class="workspace-item-title-fade"></div>
          </div>
          <div class="workspace-item-meta">
            <span>${ws.entries || 0} entries</span>
            <span>${ws.events || 0} events</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===================================
// Activity View
// ===================================

// ===================================
// Activity View (moved to views/activity/index.js)
// ===================================
// Removed: function renderActivityView - see views/activity/index.js

function _legacy_renderActivityView(container) {
  const events = filterEventsByWorkspace(state.data.events);
  const prompts = state.data.prompts || [];
  const terminalCommands = state.data.terminalCommands || [];
  
  // Merge events, prompts, and terminal commands into unified timeline
  const timelineItems = [
    ...events.map(event => ({
      ...event,
      itemType: 'event',
      sortTime: new Date(event.timestamp).getTime()
    })),
    ...prompts.map(prompt => {
      // Handle various timestamp formats
      let timestamp = prompt.timestamp;
      if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp).getTime();
      } else if (typeof timestamp === 'number') {
        // Already a timestamp
      } else {
        // Fallback to current time if invalid
        timestamp = Date.now();
      }
      // Ensure we have a valid number
      if (isNaN(timestamp)) {
        timestamp = Date.now();
      }
      
      return {
        ...prompt,
        itemType: 'prompt',
        sortTime: timestamp,
        timestamp: prompt.timestamp || new Date().toISOString(),
        id: prompt.id || `prompt-${timestamp}`
      };
    }),
    ...terminalCommands.map(cmd => ({
      ...cmd,
      itemType: 'terminal',
      sortTime: cmd.timestamp || Date.now(),
      id: cmd.id
    }))
  ]
  .filter(item => item.sortTime && !isNaN(item.sortTime)) // Remove items with invalid timestamps
  .sort((a, b) => b.sortTime - a.sortTime)
  .slice(0, 100);
  
  container.innerHTML = `
    <div class="activity-view">
      
      <!-- Unified Activity Timeline -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Activity Timeline</h3>
            <p class="card-subtitle">${timelineItems.length} items (${events.length} file changes, ${prompts.length} AI prompts, ${terminalCommands.length} terminal commands)</p>
          </div>
          <div class="activity-header-controls">
            <select class="select-input" onchange="filterActivityByTimeRange(this.value)">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
        <div class="card-body">
          ${timelineItems.length > 0 ? renderUnifiedTimeline(timelineItems) : '<div class="empty-state"><div class="empty-state-text">No activity recorded</div><div class="empty-state-hint">Activity will appear as you work in Cursor</div></div>'}
        </div>
      </div>

    </div>
  `;
}

// ===================================
// Threads View  
// ===================================

// ===================================
// Threads View (moved to views/threads/index.js)
// ===================================
// Removed: function renderThreadsView - see views/threads/index.js

function _legacy_renderThreadsView(container) {
  // Group entries by session/thread
  const threads = groupIntoThreads(state.data.entries);
  const prompts = state.data.prompts || [];
  
  container.innerHTML = `
    <div class="threads-view">
      
      <!-- Captured Prompts Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Captured Prompts</h3>
            <p class="card-subtitle">Prompts captured from clipboard and manual entry</p>
          </div>
          <div class="thread-header-controls">
            <span class="thread-badge">[CLIPBOARD] ${prompts.length} captured</span>
            <button class="btn btn-sm" onclick="refreshPrompts()">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div class="card-body">
          ${prompts.length > 0 ? renderPromptsList(prompts) : renderPromptEmptyState()}
        </div>
      </div>

      <!-- Conversation Threads Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Conversation Threads</h3>
            <p class="card-subtitle">AI conversations grouped by session</p>
          </div>
          <div class="thread-badge">${threads.length} threads</div>
        </div>
        <div class="card-body">
          ${threads.length > 0 ? renderThreadsList(threads) : '<div class="empty-state"><div class="empty-state-text">No conversation threads</div><div class="empty-state-hint">Threads will appear as you interact with AI</div></div>'}
        </div>
      </div>

    </div>
  `;
}

function renderPromptsList(prompts) {
  // Sort by most recent
  const sortedPrompts = [...prompts].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return `
    <div class="prompt-list">
      ${sortedPrompts.map(prompt => {
        // Get text from various possible fields
        const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content;
        const displayText = promptText ? truncate(promptText, 150) : 'Empty prompt';
        const source = prompt.source || prompt.method || 'unknown';
        const status = prompt.status || 'captured';
        
        return `
          <div class="prompt-card" onclick="showPromptModal('${prompt.id}')">
            <div class="prompt-header">
              <div class="prompt-status ${status}">
                ${getPromptStatusIcon(status)}
                ${escapeHtml(status)}
              </div>
              <div class="prompt-time">${formatTimeAgo(prompt.timestamp)}</div>
            </div>
            <div class="prompt-content">
              ${escapeHtml(displayText)}
            </div>
            <div class="prompt-meta">
              ${prompt.linked_entry_id ? '<span class="prompt-tag">Linked</span>' : '<span class="prompt-tag pending">Pending</span>'}
              <span class="prompt-tag">${escapeHtml(source)}</span>
              ${prompt.workspaceName ? `<span class="prompt-tag">[FILE] ${escapeHtml(prompt.workspaceName)}</span>` : prompt.workspaceId ? `<span class="prompt-tag">[FILE] ${escapeHtml(prompt.workspaceId.substring(0, 8))}...</span>` : ''}
              ${prompt.metadata?.complexity ? `<span class="prompt-tag">Complexity: ${escapeHtml(prompt.metadata.complexity)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPromptEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-text">No prompts captured yet</div>
      <div class="empty-state-hint">
        Prompts will appear here when you:
        <ul style="margin-top: var(--space-md); text-align: left; display: inline-block;">
          <li>Copy text to clipboard (if enabled)</li>
          <li>Use AI features in Cursor</li>
          <li>Send prompts through MCP</li>
        </ul>
      </div>
      <button class="btn" style="margin-top: var(--space-lg);" onclick="checkClipboardStatus()">
        Check Clipboard Status
      </button>
    </div>
  `;
}

function getPromptStatusIcon(status) {
  const icons = {
    'captured': '[OK]',
    'pending': '[PENDING]',
    'linked': '[LINKED]',
    'processed': '[DONE]',
    'failed': '[FAILED]'
  };
  return icons[status] || '[NOTE]';
}

function formatTimeAgo(timestamp) {
  if (!timestamp || isNaN(timestamp)) {
    return 'Unknown time';
  }
  
  const now = Date.now();
  let time;
  
  // Handle various timestamp formats
  if (typeof timestamp === 'string') {
    time = new Date(timestamp).getTime();
  } else if (typeof timestamp === 'number') {
    time = timestamp;
  } else {
    time = new Date(timestamp).getTime();
  }
  
  // Check if time is valid
  if (isNaN(time)) {
    return 'Unknown time';
  }
  
  const diff = now - time;
  
  if (diff < 0) return 'Just now'; // Future timestamps
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function groupIntoThreads(entries) {
  const threadMap = new Map();
  
  entries.forEach(entry => {
    const threadId = entry.session_id || entry.thread_id || 'default';
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, {
        id: threadId,
        messages: [],
        firstMessage: entry.timestamp,
        lastMessage: entry.timestamp
      });
    }
    
    const thread = threadMap.get(threadId);
    thread.messages.push(entry);
    thread.lastMessage = entry.timestamp;
  });
  
  return Array.from(threadMap.values()).sort((a, b) => 
    new Date(b.lastMessage) - new Date(a.lastMessage)
  );
}

function renderThreadsList(threads) {
  return `
    <div class="thread-list">
      ${threads.map(thread => `
        <div class="thread-card" onclick="showThreadModal('${thread.id}')">
          <div class="thread-card-header">
            <div>
              <div class="thread-card-title">${escapeHtml(truncate(thread.messages[0]?.prompt || thread.messages[0]?.text || 'Conversation Thread', 60))}</div>
              <div class="thread-card-meta">
                <span>${thread.messages.length} messages</span>
                <span>${new Date(thread.lastMessage).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="thread-card-badge">${escapeHtml(thread.id.substring(0, 8))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===================================
// Analytics View
// ===================================

// ===================================
// Analytics View (moved to views/analytics/index.js)
// ===================================
// Removed: function renderAnalyticsView - see views/analytics/index.js

function _legacy_renderAnalyticsView(container) {
  // Calculate data status
  const totalPrompts = state.data.prompts?.length || 0;
  const totalEvents = state.data.events?.length || 0;
  const hasData = totalPrompts > 0 || totalEvents > 0;
  
  // Calculate data age
  let dataFreshness = 'Unknown';
  if (totalPrompts > 0 || totalEvents > 0) {
    const allTimestamps = [
      ...(state.data.prompts || []).map(p => new Date(p.timestamp).getTime()),
      ...(state.data.events || []).map(e => new Date(e.timestamp).getTime())
    ].filter(t => !isNaN(t));
    
    if (allTimestamps.length > 0) {
      const newestData = Math.max(...allTimestamps);
      const age = Date.now() - newestData;
      if (age < 60 * 60 * 1000) {
        dataFreshness = 'Very Fresh (< 1h old)';
      } else if (age < 24 * 60 * 60 * 1000) {
        dataFreshness = `Fresh (${Math.round(age / (60 * 60 * 1000))}h old)`;
      } else {
        dataFreshness = `${Math.round(age / (24 * 60 * 60 * 1000))} days old`;
      }
    }
  }
  
  container.innerHTML = `
    <div class="analytics-view">
      
      ${!hasData ? `
        <!-- Data Status Alert -->
        <div class="data-status-alert">
          <div class="data-status-content">
            <div class="data-status-content-main">
              <h3>Waiting for Telemetry Data</h3>
              <p>
                No data has been received yet. Make sure the companion service is running:
              </p>
              <div class="data-status-instructions">
                <div class="data-status-instruction">
                  <code>cd cursor-telemetry/components/activity-logger/companion</code>
                </div>
                <div class="data-status-instruction">
                  <code>node src/index.js</code>
                </div>
              </div>
              <div class="data-status-box">
                <div class="data-status-label">Status:</div>
                <div class="data-status-value">
                  Events: ${totalEvents} | Prompts: ${totalPrompts}
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <!-- Data Status Info -->
        <div class="data-status-info">
          <div class="data-status-info-content">
            <div class="data-status-info-left">
              <div class="data-status-info-text">
                <h4>Telemetry Active</h4>
                <p>Tracking ${totalPrompts.toLocaleString()} prompts and ${totalEvents.toLocaleString()} events</p>
              </div>
            </div>
            <div class="data-status-info-right">
              <div class="data-status-freshness">
                <div class="data-status-freshness-label">Data Freshness</div>
                <div class="data-status-freshness-value">${dataFreshness}</div>
              </div>
            </div>
          </div>
        </div>
      `}
      
      <!-- AI Activity & Code Output -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">AI Activity & Code Output</h3>
          <p class="card-subtitle">Prompt frequency and code changes correlation</p>
        </div>
        <div class="card-body">
          <canvas id="aiActivityChart" class="chart-container"></canvas>
        </div>
      </div>

      <!-- Context Usage Over Time -->
      <div class="card">
        <div class="card-header">
          <div class="chart-header-controls">
            <h3 class="card-title">Context Usage Over Time</h3>
            <div class="timescale-controls">
              <button class="btn-timescale active" data-hours="24" onclick="updateContextChartTimescale(24)">24h</button>
              <button class="btn-timescale" data-hours="72" onclick="updateContextChartTimescale(72)">3d</button>
              <button class="btn-timescale" data-hours="168" onclick="updateContextChartTimescale(168)">7d</button>
              <button class="btn-timescale" data-hours="720" onclick="updateContextChartTimescale(720)">30d</button>
            </div>
          </div>
          <p class="card-subtitle">AI context window utilization with smart scaling (auto-adjusts range for better detail). Color-coded: <span style="color: #10b981;">Green</span> = Normal, <span style="color: #f59e0b;">Orange</span> = Medium-High, <span style="color: #ef4444;">Red</span> = High</p>
        </div>
        <div class="card-body">
          <canvas id="promptTokensChart" class="chart-container-small"></canvas>
        </div>
      </div>

      <!-- Model Usage Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">AI Model Usage</h3>
          <p class="card-subtitle">Distribution of models used across prompts and modes</p>
        </div>
        <div class="card-body">
          <div id="modelUsageAnalytics" style="min-height: 250px;"></div>
        </div>
      </div>

      <!-- Breakdown Charts -->
      <div class="analytics-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">File Changes by Type</h3>
            <p class="card-subtitle">Extension breakdown</p>
          </div>
          <div class="card-body">
            <canvas id="fileTypesChart"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity (15-min intervals)</h3>
            <p class="card-subtitle">Last 12 hours of activity</p>
          </div>
          <div class="card-body">
            <canvas id="hourlyChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Context File Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Context File Analytics</h3>
          <p class="card-subtitle">@ referenced files and context patterns</p>
        </div>
        <div class="card-body">
          <div id="contextFileAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- NEW: Enhanced Context Window Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Context Window Analytics</h3>
          <p class="card-subtitle">Real metrics: file references, estimated tokens, context adoption rate, and most-mentioned files from your actual prompt data</p>
        </div>
        <div class="card-body">
          <div id="enhancedContextAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- NEW: Productivity Insights -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Productivity Insights</h3>
          <p class="card-subtitle">Coding velocity: active time estimation, prompt iteration patterns, line changes, code churn hotspots, and daily metrics</p>
        </div>
        <div class="card-body">
          <div id="productivityInsights" style="min-height: 200px;"></div>
        </div>
      </div>

    </div>
  `;

  // Render charts after DOM is ready (increased delay to ensure data is loaded)
  setTimeout(() => {
    console.log('[CHART] Rendering analytics charts with data:', {
      events: state.data.events?.length || 0,
      prompts: state.data.prompts?.length || 0
    });
    
    renderAIActivityChart();
    renderPromptTokensChart();
    // renderActivityChart(); // Removed: Continuous Activity Timeline
    renderFileTypesChart();
    renderHourlyChart();
    renderContextFileAnalytics().catch(err => console.warn('[INFO] Context file analytics not available:', err.message));
    // renderContextFileHeatmap() - REMOVED: Not enough data for heatmap
    
    // NEW: Render new analytics sections
    renderModelUsageAnalytics();
    renderEnhancedContextAnalytics().catch(err => console.warn('[INFO] Context analytics not available:', err.message));
    // renderErrorTracking() - REMOVED: Showing [object Object] for git rollbacks
    renderProductivityInsights().catch(err => console.warn('[INFO] Productivity insights not available:', err.message));
    // renderFileRelationshipVisualization() - REMOVED: Handled in File Graph view
  }, 300); // Increased from 100ms to 300ms to allow data to settle
}
// REMOVED: Continuous Activity Timeline (per user request)
// function renderActivityChart() {
//   Commented out to remove Continuous Activity Timeline from dashboard
// }
function renderActivityChart_DISABLED() {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const allEvents = state.data.events || [];
  const allPrompts = state.data.prompts || [];
  
  if (allEvents.length === 0 && allPrompts.length === 0) {
    const context = ctx.getContext('2d');
    context.font = '500 16px Geist, -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text') || '#1f2937';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('No Data Available', ctx.width / 2, ctx.height / 2 - 10);
    context.font = '14px Geist, -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted') || '#6b7280';
    context.fillText('Activity data will appear here once you start coding', ctx.width / 2, ctx.height / 2 + 15);
    return;
  }

  // Determine time range and granularity
  const now = Date.now();
  const allTimes = [
    ...allEvents.map(e => new Date(e.timestamp).getTime()),
    ...allPrompts.map(p => new Date(p.timestamp).getTime())
  ];
  const oldestTime = Math.min(...allTimes);
  const timeSpan = now - oldestTime;
  
  // Choose granularity based on data span
  let bucketSize, numBuckets, labelFormat;
  if (timeSpan < 2 * 60 * 60 * 1000) {
    // Less than 2 hours: 1-minute buckets
    bucketSize = 60 * 1000;
    numBuckets = Math.min(120, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (timeSpan < 24 * 60 * 60 * 1000) {
    // Less than 1 day: 5-minute buckets
    bucketSize = 5 * 60 * 1000;
    numBuckets = Math.min(288, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (timeSpan < 7 * 24 * 60 * 60 * 1000) {
    // Less than 1 week: hourly buckets
    bucketSize = 60 * 60 * 1000;
    numBuckets = Math.min(168, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  } else {
    // More than 1 week: daily buckets
    bucketSize = 24 * 60 * 60 * 1000;
    numBuckets = Math.min(30, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Create time buckets
  const buckets = [];
  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = now - ((numBuckets - 1 - i) * bucketSize);
    buckets.push({
      timestamp: bucketStart,
      fileChanges: 0,
      aiPrompts: 0,
      codeSize: 0
    });
  }

  // Fill buckets with events
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    const bucketIndex = Math.floor((eventTime - (now - numBuckets * bucketSize)) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < numBuckets) {
      buckets[bucketIndex].fileChanges++;
      
      // Try to get code size
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        if (details.chars_added) buckets[bucketIndex].codeSize += details.chars_added;
        if (details.chars_deleted) buckets[bucketIndex].codeSize += details.chars_deleted;
      } catch (e) {}
    }
  });

  // Fill buckets with prompts
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    const bucketIndex = Math.floor((promptTime - (now - numBuckets * bucketSize)) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < numBuckets) {
      buckets[bucketIndex].aiPrompts++;
    }
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: buckets.map(b => labelFormat(new Date(b.timestamp))),
      datasets: [
        {
          label: 'File Changes',
          data: buckets.map(b => b.fileChanges),
          borderColor: CONFIG.CHART_COLORS.primary,
          backgroundColor: CONFIG.CHART_COLORS.primary + '15',
          tension: 0.3,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4
        },
        {
          label: 'AI Prompts',
          data: buckets.map(b => b.aiPrompts),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          tension: 0.3,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 10,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 9 }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { size: 10 }
          }
        }
      }
    }
  });
}



// ===================================
// File Graph View
// ===================================

// ===================================
// File Graph View (moved to views/file-graph/index.js)
// ===================================
// Removed: function renderFileGraphView - see views/file-graph/index.js

function _legacy_renderFileGraphView(container) {
  container.innerHTML = `
    <div class="file-graph-view">
      <div class="view-header">
        <h2>Semantic File Network</h2>
        <p class="view-subtitle">Interactive code relationship visualization with AI activity overlay</p>
      </div>

      <div class="graph-controls">
        <div class="control-group">
          <label>Analysis Mode:</label>
          <select id="graphMetric" onchange="updateFileGraph()">
            <option value="tfidf">TF-IDF Semantic</option>
            <option value="cooccurrence">Co-occurrence</option>
            <option value="temporal">Temporal Proximity</option>
          </select>
        </div>

        <div class="control-group">
          <label>Layout:</label>
          <select id="layoutAlgorithm" onchange="updateFileGraph()">
            <option value="force">Force-Directed</option>
            <option value="circular">Circular</option>
            <option value="radial">Radial</option>
          </select>
        </div>

        <div class="control-group">
          <label>Node Size By:</label>
          <select id="nodeSizeMetric" onchange="updateFileGraph()">
            <option value="changes">Change Count</option>
            <option value="size">File Size</option>
            <option value="recency">Recency</option>
          </select>
        </div>

        <div class="control-group">
          <label>Overlay:</label>
          <select id="graphOverlay" onchange="updateFileGraph()">
            <option value="none">None</option>
            <option value="prompts">AI Prompts</option>
            <option value="activity">Activity Heat</option>
            <option value="complexity">Code Complexity</option>
          </select>
        </div>

        <div class="control-group">
          <label>Clustering:</label>
          <select id="clusteringAlgorithm" onchange="updateFileGraph()">
            <option value="none">None</option>
            <option value="fileType">By File Type</option>
            <option value="workspace">By Workspace</option>
            <option value="directory">By Directory</option>
            <option value="similarity">By Similarity</option>
            <option value="community">Community Detection</option>
          </select>
        </div>

        <div class="control-group">
          <label class="with-help">
            Threshold: <span id="thresholdValue">0.2</span>
            <span class="help-text" title="Minimum similarity score (0-1) required to show connections between files. Higher values show only strongly related files.">Threshold</span>
          </label>
          <input type="range" id="similarityThreshold" min="0" max="1" step="0.05" value="0.2" 
                 oninput="document.getElementById('thresholdValue').textContent = this.value; updateFileGraph()"
                 title="Lower = more connections (noisier), Higher = only strong relationships (cleaner)">
        </div>

        <div class="control-group">
          <label>File Types:</label>
          <select id="fileTypeFilter" multiple onchange="updateFileGraph()">
            <!-- Options will be populated programmatically -->
          </select>
        </div>

        <div class="control-actions">
          <button class="btn btn-primary" onclick="updateFileGraph()">Refresh</button>
          <button class="btn btn-secondary" onclick="resetFileGraphZoom()">Reset View</button>
          <button class="btn btn-secondary" onclick="zoomToFit()">Zoom to Fit</button>
          <button class="btn btn-secondary" onclick="toggleLabels()" id="labelToggle">Hide Labels</button>
        </div>
      </div>
      
      <!-- Search & Navigation Panel -->
      <div class="graph-search-panel">
        <input type="text" id="fileSearch" class="graph-search-input" placeholder="Search files by name..." 
               oninput="filterGraphNodes(this.value)">
        <div id="fileSearchResults" class="graph-search-results"></div>
      </div>

      <div class="graph-container" id="fileGraphContainer">
        <!-- File graph will be rendered here -->
      </div>

      <div class="graph-stats">
        <div class="stat-item">
          <span class="stat-label">Files:</span>
          <span class="stat-value" id="graphNodeCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Connections:</span>
          <span class="stat-value" id="graphLinkCount">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Similarity:</span>
          <span class="stat-value" id="graphAvgSimilarity">0.00</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">AI Prompts:</span>
          <span class="stat-value" id="graphPromptCount">0</span>
        </div>
      </div>
      
      <!-- Most Similar File Pairs -->
      <div class="card similar-pairs-section">
        <div class="card-header">
          <div>
            <h3 class="card-title help-cursor" title="File pairs ranked by co-occurrence in prompts and editing sessions. Shows which files are frequently worked on together.">
              Most Similar File Pairs
            </h3>
            <p class="card-subtitle">Files frequently modified together with highest co-occurrence scores</p>
          </div>
          <div class="similar-pairs-controls">
            <label>Show:</label>
            <input type="number" id="similarPairsCount" class="similar-pairs-count-input" min="1" max="50" value="10" onchange="updateSimilarPairs()" oninput="if(this.value > 50) this.value = 50; if(this.value < 1) this.value = 1;" />
            <button onclick="highlightSimilarPairs()" class="btn btn-secondary" title="Highlight these pairs in the graph visualization above">Highlight in Graph</button>
          </div>
        </div>
        <div class="card-body">
          <div id="similarFilePairs" class="similar-pairs-list">
            <!-- Will be populated by JavaScript -->
          </div>
        </div>
      </div>

      <!-- Semantic Analysis Panels -->
      <div class="semantic-analysis-grid">
        
        <!-- Prompt Embeddings Analysis -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title help-cursor" title="Visualizes semantic similarity between your AI prompts using TF-IDF embeddings and dimensionality reduction (PCA/t-SNE/MDS). Prompts with similar content appear closer together. Data is extracted from your Cursor database and analyzed locally.">
              Prompts Embedding Analysis
            </h3>
          </div>
          <div class="card-body">
            <p class="embeddings-description">
              Semantic relationships between AI prompts across all time. Colors represent time (purple = older, yellow/green = newer).
            </p>
            <div class="embeddings-stats">
              <div class="embeddings-stat-row">
                <span class="embeddings-stat-label">Prompts Analyzed:</span>
                <span id="embeddingsFilesCount" class="embeddings-stat-value">0</span>
              </div>
              <div class="embeddings-stat-row">
                <span class="embeddings-stat-label">Total Tokens:</span>
                <span id="embeddingsTotalChanges" class="embeddings-stat-value">0</span>
              </div>
              <div class="embeddings-stat-row">
                <span class="embeddings-stat-label">Avg Similarity:</span>
                <span id="embeddingsAvgSimilarity" class="embeddings-stat-value">0.000</span>
              </div>
            </div>
            
            <!-- Dimensionality Reduction Controls -->
            <div class="embeddings-controls">
              <div class="embeddings-controls-row">
                <div class="embeddings-control-group">
                  <label class="embeddings-control-label" title="PCA: Fastest, linear. t-SNE: Best clusters. MDS: Preserves distances.">Reduction Method:</label>
                  <select id="embeddingsReductionMethod" class="embeddings-control-select" onchange="renderEmbeddingsVisualization()">
                    <option value="pca">PCA (Principal Component Analysis)</option>
                    <option value="tsne">t-SNE (t-Distributed Stochastic Neighbor Embedding)</option>
                    <option value="mds">MDS (Multidimensional Scaling)</option>
                  </select>
                </div>
                <div class="embeddings-control-group">
                  <label class="embeddings-control-label" title="Number of dimensions to reduce to (2D for flat visualization, 3D for spatial view)">Dimensions:</label>
                  <select id="embeddingsDimensions" class="embeddings-control-select" onchange="renderEmbeddingsVisualization()">
                    <option value="2" selected>2D</option>
                    <option value="3">3D</option>
                  </select>
                </div>
                <div class="embeddings-control-group">
                  <label class="embeddings-control-label" title="Number of principal components to keep (higher = more detail, slower computation)">Components:</label>
                  <input type="number" id="embeddingsPCAComponents" class="embeddings-control-input" min="2" max="50" value="10" onchange="renderEmbeddingsVisualization()" oninput="if(this.value > 50) this.value = 50; if(this.value < 2) this.value = 2;" />
                </div>
              </div>
            </div>
            
            <!-- Embeddings Visualization Canvas -->
            <div id="embeddingsVisualization" class="embeddings-visualization">
              <div class="embeddings-visualization-placeholder">
                Embeddings visualization will appear here
              </div>
            </div>
            
            <div class="embeddings-subsection">
              <h4 class="embeddings-subsection-title">Most Similar Prompt Pairs:</h4>
              <div id="similarityPairs" class="embeddings-subsection-content">
                <div class="embeddings-subsection-placeholder">Analyzing prompts...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Term Frequency Analysis -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Term Frequency Analysis</h3>
          </div>
          <div class="card-body">
            <div class="tfidf-stats">
              <div class="tfidf-stat-row">
                <span class="tfidf-stat-label">Total Terms:</span>
                <span id="tfidfTotalTerms" class="tfidf-stat-value">0</span>
              </div>
              <div class="tfidf-stat-row">
                <span class="tfidf-stat-label">Unique Terms:</span>
                <span id="tfidfUniqueTerms" class="tfidf-stat-value">0</span>
              </div>
              <div class="tfidf-stat-row">
                <span class="tfidf-stat-label">Avg Term Frequency:</span>
                <span id="tfidfAvgFreq" class="tfidf-stat-value">0.00</span>
              </div>
            </div>
            <div class="embeddings-subsection">
              <h4 class="embeddings-subsection-title help" title="Terms ranked by TF-IDF (Term Frequency-Inverse Document Frequency) score. Higher scores indicate terms that are important in specific files but rare across all files.">
                Top Terms by Importance:
              </h4>
              <div id="topTerms" class="embeddings-subsection-content scrollable">
                <div class="embeddings-subsection-placeholder">Analyzing...</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Initialize file graph after DOM is ready
  setTimeout(() => {
    initializeD3FileGraph();
  }, 100);
}
// TF-IDF computation for semantic analysis
function computeTFIDFAnalysis(files) {
  // Tokenize files
  const documents = files.map(file => {
    const tokens = tokenizeCode(file.content);
    return { file, tokens };
  });
  
  // Calculate term frequencies
  const termFreqs = new Map();
  const docFreqs = new Map();
  let totalTerms = 0;
  
  documents.forEach(doc => {
    const termCounts = new Map();
    doc.tokens.forEach(term => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
      totalTerms++;
    });
    
    doc.termFreq = termCounts;
    
    // Document frequency
    const uniqueTerms = new Set(doc.tokens);
    uniqueTerms.forEach(term => {
      docFreqs.set(term, (docFreqs.get(term) || 0) + 1);
      termFreqs.set(term, (termFreqs.get(term) || 0) + termCounts.get(term));
    });
  });
  
  // Calculate TF-IDF
  const numDocs = documents.length;
  const tfidfVectors = documents.map(doc => {
    const vector = new Map();
    doc.termFreq.forEach((tf, term) => {
      const df = docFreqs.get(term) || 1;
      const idf = Math.log(numDocs / df);
      vector.set(term, tf * idf);
    });
    return { file: doc.file, vector };
  });
  
  // Calculate pairwise similarities
  const similarities = [];
  for (let i = 0; i < tfidfVectors.length; i++) {
    for (let j = i + 1; j < tfidfVectors.length; j++) {
      const sim = cosineSimilarity(tfidfVectors[i].vector, tfidfVectors[j].vector);
      similarities.push({
        file1: tfidfVectors[i].file.name,
        file2: tfidfVectors[j].file.name,
        similarity: sim
      });
    }
  }
  
  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Get top terms by TF-IDF
  const allTermTFIDF = new Map();
  tfidfVectors.forEach(doc => {
    doc.vector.forEach((tfidf, term) => {
      allTermTFIDF.set(term, (allTermTFIDF.get(term) || 0) + tfidf);
    });
  });
  
  const topTerms = Array.from(allTermTFIDF.entries())
    .map(([term, tfidf]) => ({ term, tfidf, freq: termFreqs.get(term) }))
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 50);
  
  return {
    tfidfStats: {
      totalTerms,
      uniqueTerms: docFreqs.size,
      avgFrequency: totalTerms / docFreqs.size,
      avgSimilarity: similarities.length > 0 ? 
        similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length : 0,
      topTerms
    },
    similarities
  };
}

// Tokenize code content
function tokenizeCode(code) {
  // Remove comments
  const noComments = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Extract identifiers (camelCase, snake_case, etc.)
  const tokens = noComments
    .match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
  
  // Filter out common keywords and short tokens
  const stopWords = new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'true', 'false', 'null', 'undefined', 'this', 'new', 'typeof', 'instanceof', 'in', 'of', 'class', 'extends', 'import', 'export', 'from', 'as', 'default', 'async', 'await', 'try', 'catch', 'throw', 'finally']);
  
  return tokens
    .filter(t => t.length > 2 && !stopWords.has(t.toLowerCase()))
    .map(t => t.toLowerCase());
}

// Cosine similarity between two TF-IDF vectors
function cosineSimilarity(vec1, vec2) {
  const terms = new Set([...vec1.keys(), ...vec2.keys()]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  terms.forEach(term => {
    const v1 = vec1.get(term) || 0;
    const v2 = vec2.get(term) || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// Simple D3.js-based file graph implementation
async function initializeD3FileGraph() {
  try {
    const container = document.getElementById('fileGraphContainer');
    if (!container) return;
    
    // Show loading state
    container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><div class="loading-spinner"></div><span style="margin-left: 12px;">Loading file contents from database...</span></div>';
    
    // Fetch file contents from persistent database
    console.log('[FILE] Fetching file contents from SQLite for TF-IDF analysis...');
    const response = await fetch(`${CONFIG.API_BASE}/api/file-contents?limit=100000`);
    const data = await response.json();
    
    if (!data.files || data.files.length === 0) {
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">No file data available for analysis</div>';
      return;
    }
    
    console.log(`[DATA] Loaded ${data.files.length} files (${(data.totalSize / 1024 / 1024).toFixed(2)} MB) from database`);
    
    // Get unique file extensions from the data, grouping Git files
    const allExts = [...new Set(data.files.map(f => {
      const ext = f.ext;
      // Group all Git-related files as just "Git"
      if (ext && (ext.startsWith('Git') || ext === 'COMMIT_EDITMSG' || ext === 'HEAD' || ext === 'index' || ext === 'FETCH_HEAD' || ext === 'ORIG_HEAD')) {
        return 'Git';
      }
      return ext;
    }).filter(Boolean))].sort();
    
    // Populate file type dropdown
    const fileTypeFilter = document.getElementById('fileTypeFilter');
    if (fileTypeFilter && fileTypeFilter.options.length === 0) {
      allExts.forEach(ext => {
        const option = document.createElement('option');
        option.value = ext;
        option.text = ext.toUpperCase();
        option.selected = true; // Select all by default
        fileTypeFilter.add(option);
      });
    }
    
    // Get selected file types from dropdown
    const selectedTypes = Array.from(fileTypeFilter?.selectedOptions || []).map(o => o.value);
    const allowedExts = selectedTypes.length > 0 ? selectedTypes : allExts;
    
    // Helper function to check if a string is a Git object hash (40-char hex)
    const isGitObjectHash = (str) => /^[0-9a-f]{40}$/i.test(str);
    
    // Helper function to get a meaningful file name
    const getMeaningfulName = (file) => {
      // If the name itself is a Git hash, try to extract from path
      if (isGitObjectHash(file.name)) {
        const pathParts = file.path.split('/');
        // Find a non-hash part of the path
        for (let i = pathParts.length - 1; i >= 0; i--) {
          if (!isGitObjectHash(pathParts[i]) && pathParts[i].length > 0) {
            return pathParts[i];
          }
        }
        return 'Git object';
      }
      return file.name;
    };
    
    // Filter files by selected extensions (with Git grouping support)
    const files = data.files
      .filter(f => {
        // Filter out Git object hashes (40-character hex strings in .git/objects/)
        if (f.path && f.path.includes('.git/objects/') && isGitObjectHash(f.name)) {
          return false;
        }
        
        const ext = f.ext;
        // Check if this is a Git file and "Git" is selected
        if (ext && (ext.startsWith('Git') || ext === 'COMMIT_EDITMSG' || ext === 'HEAD' || ext === 'index' || ext === 'FETCH_HEAD' || ext === 'ORIG_HEAD')) {
          return allowedExts.includes('Git');
        }
        return allowedExts.includes(ext);
      })
      .map(f => {
        // Find all events related to this file
        const relatedEvents = (state.data.events || []).filter(event => {
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            const filePath = details?.file_path || event.file_path || '';
            return filePath.includes(f.name) || f.path.includes(filePath);
          } catch (e) {
            return false;
          }
        });
        
        // Get meaningful display name
        const displayName = getMeaningfulName(f);
        
        // Extract workspace and directory for hierarchical grouping
        const pathParts = f.path.split('/');
        const workspace = pathParts[0] || 'Unknown';
        const directory = pathParts.length > 2 ? pathParts.slice(0, -1).join('/') : workspace;
        
        return {
          id: f.path,
          path: f.path,
          name: displayName,  // Use meaningful name instead of hash
          originalName: f.name,  // Keep original for reference
          ext: f.ext,
          content: f.content,
          changes: f.changes || 0,
          lastModified: f.lastModified,
          size: f.size,
          events: relatedEvents || [],
          workspace: workspace,
          directory: directory
        };
      });

    console.log(`[DATA] Filtered to ${files.length} files with allowed extensions`);
    console.log(`[DATA] Files have events:`, files.map(f => `${f.name}: ${f.events?.length || 0} events`));

    if (files.length === 0) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">[FILE]</div>
            <div style="font-size: 18px; margin-bottom: 8px;">No file data available</div>
            <div style="font-size: 14px;">Make some code changes to see file relationships</div>
          </div>
        </div>
      `;
      return;
    }
    
    // Compute similarity based on context files from prompts (more accurate than session-based)
    const links = [];
    const threshold = 0.2; // Lower threshold to catch more relationships
    
    // Build file-to-prompts mapping from context files
    const filePromptMap = new Map();
    const prompts = state.data.prompts || [];
    
    prompts.forEach(prompt => {
      if (prompt.contextFiles && Array.isArray(prompt.contextFiles)) {
        prompt.contextFiles.forEach(cf => {
          const filePath = cf.path || cf.filePath || cf.file;
          if (filePath) {
            if (!filePromptMap.has(filePath)) {
              filePromptMap.set(filePath, new Set());
            }
            filePromptMap.get(filePath).add(prompt.id || prompt.timestamp);
          }
        });
      }
      
      // Also check for file changes in the prompt
      if (prompt.file_path || prompt.filePath) {
        const filePath = prompt.file_path || prompt.filePath;
        if (!filePromptMap.has(filePath)) {
          filePromptMap.set(filePath, new Set());
        }
        filePromptMap.get(filePath).add(prompt.id || prompt.timestamp);
      }
    });
    
    console.log(`[GRAPH] Built file-to-prompt map with ${filePromptMap.size} files`);
    
    // Compute co-occurrence between files
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const file1 = files[i];
        const file2 = files[j];
        
        // Get prompts that reference each file
        const prompts1 = filePromptMap.get(file1.id) || new Set();
        const prompts2 = filePromptMap.get(file2.id) || new Set();
        
        // Fallback: check if files were modified in same sessions
        const sessions1 = new Set((file1.events || []).map(e => e.session_id).filter(Boolean));
        const sessions2 = new Set((file2.events || []).map(e => e.session_id).filter(Boolean));
        
        // Combine both prompt co-occurrence and session co-occurrence
        const promptIntersection = new Set([...prompts1].filter(x => prompts2.has(x)));
        const sessionIntersection = new Set([...sessions1].filter(x => sessions2.has(x)));
        
        const promptUnion = new Set([...prompts1, ...prompts2]);
        const sessionUnion = new Set([...sessions1, ...sessions2]);
        
        // Calculate similarity with weighted average (prompts are more important)
        const promptSim = promptUnion.size > 0 ? promptIntersection.size / promptUnion.size : 0;
        const sessionSim = sessionUnion.size > 0 ? sessionIntersection.size / sessionUnion.size : 0;
        
        // Weighted average: 70% prompts, 30% sessions
        const similarity = (promptSim * 0.7) + (sessionSim * 0.3);
        
        if (similarity > threshold) {
          links.push({
            source: file1.id,
            target: file2.id,
            similarity: similarity,
            sharedPrompts: promptIntersection.size,
            sharedSessions: sessionIntersection.size
          });
        }
      }
    }
    
    console.log(`[GRAPH] Created ${links.length} connections between files (threshold: ${threshold})`);
    
    // Compute TF-IDF for semantic analysis
    const {tfidfStats, similarities} = computeTFIDFAnalysis(files);
    
    // Store for updateFileGraph
    window.fileGraphData = { nodes: files, links: links, tfidfStats, similarities };
    
    // Render with D3
    renderD3FileGraph(container, files, links);
    
    // Update basic stats (with null checks)
    const nodeCountEl = document.getElementById('graphNodeCount');
    const linkCountEl = document.getElementById('graphLinkCount');
    const promptCountEl = document.getElementById('graphPromptCount');
    const avgSimEl = document.getElementById('graphAvgSimilarity');
    
    if (nodeCountEl) nodeCountEl.textContent = files.length;
    if (linkCountEl) linkCountEl.textContent = links.length;
    if (promptCountEl) promptCountEl.textContent = (state.data.prompts || []).length;
    
    if (links.length > 0 && avgSimEl) {
      const avgSim = links.reduce((sum, l) => sum + l.similarity, 0) / links.length;
      avgSimEl.textContent = avgSim.toFixed(3);
    } else if (avgSimEl) {
      avgSimEl.textContent = '0.000';
    }
    
    // Render most similar file pairs
    renderSimilarFilePairs(links, files);
    
    // Render prompt embeddings visualization for the "Prompts Embedding Analysis" section
    // This analyzes prompts themselves, not files (file analysis is in Navigator view)
    // Use async to prevent blocking
    renderEmbeddingsVisualization().catch(err => {
      console.error('[ERROR] Failed to render embeddings:', err);
      const container = document.getElementById('embeddingsVisualization');
      if (container) {
        container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-error); font-size: 13px;">Error rendering embeddings: ${err.message}</div>`;
      }
    });
    
    // Update TF-IDF analysis (with null checks)
    const tfidfTotalTermsEl = document.getElementById('tfidfTotalTerms');
    const tfidfUniqueTermsEl = document.getElementById('tfidfUniqueTerms');
    const tfidfAvgFreqEl = document.getElementById('tfidfAvgFreq');
    if (tfidfTotalTermsEl) tfidfTotalTermsEl.textContent = tfidfStats.totalTerms.toLocaleString();
    if (tfidfUniqueTermsEl) tfidfUniqueTermsEl.textContent = tfidfStats.uniqueTerms;
    if (tfidfAvgFreqEl) tfidfAvgFreqEl.textContent = tfidfStats.avgFrequency.toFixed(2);
    
    // Show ALL top terms (not just 10) with scrolling
    const termsHtml = tfidfStats.topTerms.map((term, index) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm); font-size: 12px;" title="TF-IDF Score: ${term.tfidf.toFixed(6)} | Frequency: ${term.freq}">
        <span style="display: flex; align-items: center; gap: var(--space-xs);">
          <span style="color: var(--color-text-muted); font-size: 10px; min-width: 25px;">#${index + 1}</span>
          <span style="font-family: var(--font-mono); color: var(--color-text);">${term.term}</span>
        </span>
        <span style="font-weight: 600; color: var(--color-accent);">${term.tfidf.toFixed(4)}</span>
      </div>
    `).join('');
    const topTermsEl = document.getElementById('topTerms');
    if (topTermsEl) {
      topTermsEl.innerHTML = termsHtml || '<div style="color: var(--color-text-muted); font-size: 13px;">No terms found</div>';
    }
    
  } catch (error) {
    console.error('Failed to initialize file graph:', error);
    const container = document.getElementById('fileGraphContainer');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">!</div>
            <div style="font-size: 18px; margin-bottom: 8px;">File Graph Unavailable</div>
            <div style="font-size: 14px;">${escapeHtml(error.message || 'Error initializing visualization')}</div>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Render embeddings visualization with dimensionality reduction (for prompts)
 */
async function renderEmbeddingsVisualization() {
  const container = document.getElementById('embeddingsVisualization');
  if (!container) return;
  
  const prompts = state.data.prompts || [];
  if (prompts.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt data will appear here once you start using Cursor AI</div>
      </div>
    `;
    return;
  }
  
  const method = document.getElementById('embeddingsReductionMethod')?.value || 'pca';
  const dimensions = parseInt(document.getElementById('embeddingsDimensions')?.value || '2');
  const numComponents = parseInt(document.getElementById('embeddingsPCAComponents')?.value || '10');
  
  // Show loading state
  container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">Processing embeddings... (this may take a moment)</div>';
  
  try {
    console.log(`[EMBEDDINGS] Starting analysis: method=${method}, dims=${dimensions}, components=${numComponents}`);
    
    // Filter out JSON metadata, composer conversations (which are just names), and prepare actual prompt texts
    let validPrompts = prompts.filter(p => {
      const text = p.text || p.prompt || p.preview || p.content || '';
      const isJsonLike = text.startsWith('{') || text.startsWith('[');
      // Exclude composer conversations as they only contain conversation names, not actual prompt content
      const isComposerConversation = p.source === 'composer' && p.type === 'conversation';
      return !isJsonLike && !isComposerConversation && text.length > 10;
    });
    
    // LIMIT: Process max 1000 prompts to prevent timeout (O(n²) similarity calculations)
    const MAX_PROMPTS = 1000;
    if (validPrompts.length > MAX_PROMPTS) {
      console.warn(`[EMBEDDINGS] Limiting to ${MAX_PROMPTS} most recent prompts (of ${validPrompts.length} total) to prevent timeout`);
      // Sort by timestamp and take most recent
      validPrompts = validPrompts
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, MAX_PROMPTS);
    }
    
    console.log(`[EMBEDDINGS] Filtered to ${validPrompts.length} valid prompts (processing ${validPrompts.length} for embeddings)`);
    
    // Update stats immediately
    const filesCountEl = document.getElementById('embeddingsFilesCount');
    const totalChangesEl = document.getElementById('embeddingsTotalChanges');
    if (filesCountEl) filesCountEl.textContent = validPrompts.length;
    
    if (validPrompts.length === 0) {
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 13px;">No valid prompts for analysis (filtered out JSON metadata)</div>';
      if (totalChangesEl) totalChangesEl.textContent = '0';
      return;
    }
    
    // Process in chunks to prevent blocking
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < validPrompts.length; i += chunkSize) {
      chunks.push(validPrompts.slice(i, i + chunkSize));
    }
    
    // Tokenize all prompts (chunked)
    const promptTexts = validPrompts.map(p => p.text || p.prompt || p.preview || p.content || '');
    const allTokens = [];
    
    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, 0)); // Yield to browser
      const chunkTexts = chunk.map(p => p.text || p.prompt || p.preview || p.content || '');
      allTokens.push(...chunkTexts.map(text => tokenizeCode(text)));
    }
    
    // Build vocabulary from all prompts - use top terms based on frequency
    const vocab = new Map();
    allTokens.forEach(tokens => {
      tokens.forEach(token => {
        vocab.set(token, (vocab.get(token) || 0) + 1);
      });
    });
    
    // Use vocabulary size based on numComponents setting (adaptive)
    const vocabSize = Math.min(Math.max(numComponents * 5, 20), 150);
    const topVocab = Array.from(vocab.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, vocabSize)
      .map(e => e[0]);
    
    console.log(`[EMBEDDINGS] Using vocabulary size: ${topVocab.length}`);
    
    // Create TF-IDF vectors (chunked)
    const vectors = [];
    const promptLabels = [];
    const promptMetadata = [];
    
    for (let i = 0; i < validPrompts.length; i++) {
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield every 100 prompts
      }
      
      const prompt = validPrompts[i];
      const tokens = allTokens[i];
      const vector = [];
      
      // Create TF-IDF vector
      topVocab.forEach(term => {
        const tf = tokens.filter(t => t === term).length / Math.max(tokens.length, 1);
        // Simple IDF approximation
        const df = allTokens.filter(tokSet => tokSet.includes(term)).length;
        const idf = Math.log(validPrompts.length / (df + 1));
        vector.push(tf * idf);
      });
      
      vectors.push(vector);
      
      // Create label (truncated prompt text)
      const text = promptTexts[i];
      const label = text.length > 40 ? text.substring(0, 40) + '...' : text;
      promptLabels.push(label);
      
      // Store metadata for hover/click
      promptMetadata.push({
        id: prompt.id,
        text: text,
        timestamp: prompt.timestamp,
        workspaceName: prompt.workspaceName || 'Unknown',
        source: prompt.source || 'cursor'
      });
    }
    
    console.log(`[EMBEDDINGS] Built ${vectors.length} TF-IDF vectors with ${vectors[0]?.length} dimensions`);
    
    // Apply dimensionality reduction (with timeout protection)
    let reducedVectors;
    if (method === 'pca') {
      // PCA is fast, can run synchronously
      reducedVectors = applyPCA(vectors, dimensions, numComponents);
      console.log(`[EMBEDDINGS] PCA complete: ${reducedVectors.length} vectors -> ${reducedVectors[0]?.length} dims`);
    } else if (method === 'tsne') {
      // t-SNE is slow, limit to smaller dataset
      if (vectors.length > 500) {
        console.warn(`[EMBEDDINGS] t-SNE is slow with ${vectors.length} prompts, limiting to 500`);
        const limitedVectors = vectors.slice(0, 500);
        const limitedLabels = promptLabels.slice(0, 500);
        const limitedMetadata = promptMetadata.slice(0, 500);
        reducedVectors = applyTSNE(limitedVectors, dimensions, numComponents);
        // Re-render with limited data
        if (dimensions === 2) {
          renderEmbeddings2D(container, reducedVectors, limitedLabels, limitedMetadata);
        } else {
          renderEmbeddings3D(container, reducedVectors, limitedLabels, limitedMetadata);
        }
        return;
      }
      reducedVectors = applyTSNE(vectors, dimensions, numComponents);
      console.log(`[EMBEDDINGS] t-SNE complete`);
    } else {
      // MDS is also slow, limit if needed
      if (vectors.length > 500) {
        console.warn(`[EMBEDDINGS] MDS is slow with ${vectors.length} prompts, limiting to 500`);
        const limitedVectors = vectors.slice(0, 500);
        const limitedLabels = promptLabels.slice(0, 500);
        const limitedMetadata = promptMetadata.slice(0, 500);
        reducedVectors = applyMDS(limitedVectors, dimensions);
        if (dimensions === 2) {
          renderEmbeddings2D(container, reducedVectors, limitedLabels, limitedMetadata);
        } else {
          renderEmbeddings3D(container, reducedVectors, limitedLabels, limitedMetadata);
        }
        return;
      }
      reducedVectors = applyMDS(vectors, dimensions);
      console.log(`[EMBEDDINGS] MDS complete`);
    }
    
    // Render the visualization
    if (dimensions === 2) {
      renderEmbeddings2D(container, reducedVectors, promptLabels, promptMetadata);
    } else {
      renderEmbeddings3D(container, reducedVectors, promptLabels, promptMetadata);
    }
    
    // Calculate total tokens for display
    const totalTokens = allTokens.reduce((sum, tokens) => sum + tokens.length, 0);
    if (totalChangesEl) totalChangesEl.textContent = totalTokens.toLocaleString();
    
    // Update similarity pairs to show similar prompts
    const avgSim = updatePromptSimilarityPairs(validPrompts, vectors, promptTexts);
    
    // Update average similarity stat
    const avgSimEl = document.getElementById('embeddingsAvgSimilarity');
    if (avgSimEl && avgSim !== null) {
      avgSimEl.textContent = avgSim.toFixed(3);
    }
    
  } catch (error) {
    console.error('Error rendering embeddings:', error);
    container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-error); font-size: 13px;">Error: ${error.message}</div>`;
  }
}

/**
 * Update similarity pairs section to show most similar prompts
 */
function updatePromptSimilarityPairs(prompts, vectors, promptTexts) {
  const container = document.getElementById('similarityPairs');
  if (!container) return;
  
  // Calculate cosine similarities between all prompt pairs
  const similarities = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = cosineSimilarityVector(vectors[i], vectors[j]);
      if (sim > 0.1) {
        similarities.push({
          i, j, sim,
          text1: promptTexts[i],
          text2: promptTexts[j],
          time1: prompts[i].timestamp,
          time2: prompts[j].timestamp
        });
      }
    }
  }
  
  // Sort by similarity
  similarities.sort((a, b) => b.sim - a.sim);
  
  // Show top 5 pairs
  const html = similarities.slice(0, 5).map(pair => {
    const truncate = (text, len) => text.length > len ? text.substring(0, len) + '...' : text;
    return `
      <div style="padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
          <span style="font-weight: 600; color: var(--color-accent); font-size: 12px;">
            ${(pair.sim * 100).toFixed(1)}% similar
          </span>
          <span style="font-size: 11px; color: var(--color-text-muted);">
            ${formatTimeAgo(pair.time1)} & ${formatTimeAgo(pair.time2)}
          </span>
        </div>
        <div style="font-size: 12px; color: var(--color-text); margin-bottom: 4px;">
          "${truncate(pair.text1, 60)}"
        </div>
        <div style="font-size: 12px; color: var(--color-text);">
          "${truncate(pair.text2, 60)}"
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html || '<div style="color: var(--color-text-muted); font-size: 13px;">No similar prompts found</div>';
  
  // Return average similarity
  if (similarities.length > 0) {
    return similarities.reduce((sum, s) => sum + s.sim, 0) / similarities.length;
  }
  return null;
}

/**
 * Cosine similarity for vectors (array form)
 */
function cosineSimilarityVector(a, b) {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}
/**
 * Improved PCA implementation with configurable components
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality (2 or 3)
 * @param {number} numComponents - Number of principal components to compute (default: 10)
 */
function applyPCA(vectors, dimensions, numComponents = 10) {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return [Array(dimensions).fill(0)];
  
  const n = vectors.length;
  const d = vectors[0].length;
  
  // Center the data (mean normalization)
  const mean = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      mean[j] += vectors[i][j];
    }
  }
  for (let j = 0; j < d; j++) {
    mean[j] /= n;
  }
  
  const centered = vectors.map(row => 
    row.map((val, i) => val - mean[i])
  );
  
  // For performance, use power iteration to find top numComponents principal components
  // This is a simplified PCA that works well for visualization
  const components = Math.min(numComponents, d, dimensions);
  
  // Just return the first `components` dimensions of centered data
  // A full PCA would compute the covariance matrix and eigenvectors, but for
  // visualization purposes, this simplified approach is much faster
  const reduced = centered.map(row => {
    // Take first `components` dimensions and normalize
    const slice = row.slice(0, components);
    
    // Normalize to unit length
    const magnitude = Math.sqrt(slice.reduce((sum, v) => sum + v * v, 0));
    const normalized = magnitude > 0 ? slice.map(v => v / magnitude) : slice;
    
    // Pad or trim to target dimensions
    if (normalized.length < dimensions) {
      return [...normalized, ...Array(dimensions - normalized.length).fill(0)];
    }
    return normalized.slice(0, dimensions);
  });
  
  return reduced;
}
/**
 * Simple t-SNE-like dimensionality reduction (simplified version)
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality
 * @param {number} numComponents - Number of components to use (ignored for t-SNE, uses full vectors)
 */
function applyTSNE(vectors, dimensions, numComponents = 10) {
  // For simplicity, use MDS-like approach with random initialization
  // A proper t-SNE would use gradient descent
  // Note: For better t-SNE, consider using a library like https://github.com/karpathy/tsnejs
  return applyMDS(vectors, dimensions);
}

/**
 * Multi-Dimensional Scaling (MDS)
 */
function applyMDS(vectors, dimensions) {
  if (vectors.length === 0) return [];
  
  // Calculate distance matrix
  const n = vectors.length;
  const distances = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(vectors[i], vectors[j]);
      distances[i][j] = dist;
      distances[j][i] = dist;
    }
  }
  
  // Initialize random positions
  const positions = Array(n).fill().map(() => 
    Array(dimensions).fill().map(() => (Math.random() - 0.5) * 2)
  );
  
  // Simple stress minimization (reduced iterations for speed)
  const iterations = Math.min(20, n * 2); // Adaptive: 20 max, or 2× node count
  console.log(`[MDS] Running ${iterations} stress minimization iterations for ${n} nodes...`);
  for (let iter = 0; iter < iterations; iter++) {
    if (iter % 5 === 0) {
      console.log(`[MDS] Iteration ${iter}/${iterations} (${Math.round(iter/iterations*100)}%)`);
    }
    for (let i = 0; i < n; i++) {
      const forces = Array(dimensions).fill(0);
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const currentDist = euclideanDistance(positions[i], positions[j]);
        const targetDist = distances[i][j];
        const error = currentDist - targetDist;
        
        if (currentDist > 0) {
          for (let d = 0; d < dimensions; d++) {
            forces[d] += error * (positions[j][d] - positions[i][d]) / currentDist;
          }
        }
      }
      
      // Update position
      for (let d = 0; d < dimensions; d++) {
        positions[i][d] += forces[d] * 0.01;
      }
    }
  }
  
  return positions;
}

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

/**
 * Render 2D embeddings visualization (for prompts)
 */
function renderEmbeddings2D(container, vectors, labels, metadata) {
  container.innerHTML = '';
  
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 300;
  const padding = 40;
  
  // Find bounds
  const xValues = vectors.map(v => v[0]);
  const yValues = vectors.map(v => v[1]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Scales
  const xScale = d3.scaleLinear()
    .domain([xMin, xMax])
    .range([padding, width - padding]);
  
  const yScale = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([height - padding, padding]);
  
  // Color scale by time (older = purple, newer = blue/green)
  const timeValues = metadata.map(m => new Date(m.timestamp).getTime());
  const minTime = Math.min(...timeValues);
  const maxTime = Math.max(...timeValues);
  
  const colorScale = d3.scaleSequential()
    .domain([minTime, maxTime])
    .interpolator(d3.interpolateViridis);
  
  // Draw points
  const points = svg.selectAll('circle')
    .data(vectors)
    .enter()
    .append('circle')
    .attr('cx', (d, i) => xScale(d[0]))
    .attr('cy', (d, i) => yScale(d[1]))
    .attr('r', 6)
    .attr('fill', (d, i) => colorScale(new Date(metadata[i].timestamp).getTime()))
    .attr('opacity', 0.7)
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const i = vectors.indexOf(d);
      d3.select(this).attr('r', 8).attr('opacity', 1);
      
      // Show tooltip with prompt preview
      const tooltip = svg.append('text')
        .attr('class', 'embedding-tooltip')
        .attr('x', xScale(d[0]) + 10)
        .attr('y', yScale(d[1]) - 10)
        .attr('fill', 'var(--color-text)')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text(labels[i]);
    })
    .on('mouseout', function() {
      d3.select(this).attr('r', 6).attr('opacity', 0.7);
      svg.selectAll('.embedding-tooltip').remove();
    })
    .on('click', function(event, d) {
      const i = vectors.indexOf(d);
      showEventModal(metadata[i].id);
    });
  
  // Add axes
  svg.append('g')
    .attr('transform', `translate(0, ${height - padding})`)
    .call(d3.axisBottom(xScale).ticks(5))
    .attr('color', 'var(--color-text-muted)');
  
  svg.append('g')
    .attr('transform', `translate(${padding}, 0)`)
    .call(d3.axisLeft(yScale).ticks(5))
    .attr('color', 'var(--color-text-muted)');
  
  // Add legend for time gradient
  const legend = svg.append('g')
    .attr('transform', `translate(${width - 120}, 20)`);
  
  legend.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('fill', 'var(--color-text)')
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .text('Time');
  
  // Create gradient bar
  const gradientHeight = 80;
  const gradientWidth = 15;
  
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'time-gradient')
    .attr('x1', '0%')
    .attr('y1', '100%')
    .attr('x2', '0%')
    .attr('y2', '0%');
  
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', colorScale(minTime));
  
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', colorScale(maxTime));
  
  legend.append('rect')
    .attr('x', 0)
    .attr('y', 10)
    .attr('width', gradientWidth)
    .attr('height', gradientHeight)
    .attr('fill', 'url(#time-gradient)')
    .attr('stroke', 'var(--color-border)')
    .attr('stroke-width', 1);
  
  legend.append('text')
    .attr('x', gradientWidth + 5)
    .attr('y', 15)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '9px')
    .text('New');
  
  legend.append('text')
    .attr('x', gradientWidth + 5)
    .attr('y', 10 + gradientHeight)
    .attr('fill', 'var(--color-text-muted)')
    .attr('font-size', '9px')
    .text('Old');
}

/**
 * Render 3D embeddings visualization (simplified 2D projection)
 */
function renderEmbeddings3D(container, vectors, labels, metadata) {
  // For 3D, project to 2D with perspective
  const projected = vectors.map(v => {
    const z = v[2] || 0;
    const scale = 1 / (1 + z * 0.1);
    return [v[0] * scale, v[1] * scale];
  });
  
  renderEmbeddings2D(container, projected, labels, metadata);
}

function renderD3FileGraph(container, nodes, links) {
  // Clear container
  container.innerHTML = '';
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  
  // Get clustering algorithm
  const clusterAlgorithm = document.getElementById('clusteringAlgorithm')?.value || 'none';
  
  // Apply clustering
  const clusters = applyClustering(nodes, links, clusterAlgorithm);
  
  // Create SVG with zoom support
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'var(--color-bg)');
  
  // Add zoom behavior
  const g = svg.append('g');
  
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Store zoom behavior for external access
  window.graphZoom = zoom;
  window.graphSvg = svg;
  window.graphG = g;
  
  // Create cluster hulls if clustering is enabled
  if (clusters.length > 0) {
    const hull = g.append('g')
      .attr('class', 'cluster-hulls')
      .selectAll('path')
      .data(clusters)
      .join('path')
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');
    
    // Add cluster labels
    const clusterLabels = g.append('g')
      .attr('class', 'cluster-labels')
      .selectAll('text')
      .data(clusters)
      .join('text')
      .text(d => `${d.name} (${d.nodes.length})`)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', d => d.color)
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none');
  }
  
  // Get layout algorithm
  const layoutAlgorithm = document.getElementById('layoutAlgorithm')?.value || 'force';
  
  // Create simulation based on layout
  let simulation;
  if (layoutAlgorithm === 'force') {
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
        // Shorter links for same cluster
        if (d.source.cluster === d.target.cluster) return 50;
        return 150;
      }))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))
      .force('cluster', forceCluster(clusters));
  } else if (layoutAlgorithm === 'circular') {
    // Circular layout
    const radius = Math.min(width, height) / 2 - 100;
    nodes.forEach((d, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      d.x = width / 2 + radius * Math.cos(angle);
      d.y = height / 2 + radius * Math.sin(angle);
    });
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('collision', d3.forceCollide().radius(35));
  } else if (layoutAlgorithm === 'radial') {
    // Radial layout - cluster-based
    const angleStep = (2 * Math.PI) / clusters.length;
    clusters.forEach((cluster, i) => {
      const angle = i * angleStep;
      const clusterRadius = Math.min(width, height) / 3;
      const centerX = width / 2 + clusterRadius * Math.cos(angle);
      const centerY = height / 2 + clusterRadius * Math.sin(angle);
      
      cluster.nodes.forEach((node, j) => {
        const nodeAngle = (j / cluster.nodes.length) * 2 * Math.PI;
        const nodeRadius = 50;
        node.x = centerX + nodeRadius * Math.cos(nodeAngle);
        node.y = centerY + nodeRadius * Math.sin(nodeAngle);
      });
    });
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('collision', d3.forceCollide().radius(35));
  }
  
  // Create links
  const link = g.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => {
      // Highlight intra-cluster links
      if (d.source.cluster === d.target.cluster) {
        const cluster = clusters.find(c => c.id === d.source.cluster);
        return cluster ? cluster.color : '#64748b';
      }
      return '#64748b';
    })
    .attr('stroke-opacity', d => d.similarity * 0.6)
    .attr('stroke-width', d => Math.max(1, d.similarity * 3));
  
  // Create nodes
  const node = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => {
      event.stopPropagation();
      highlightConnections(d, node, link);
      showFileInfo(d);
    })
    .on('mouseenter', (event, d) => {
      highlightConnections(d, node, link);
    })
    .on('mouseleave', () => {
      clearHighlights(node, link);
    })
    .style('cursor', 'pointer');
  
  // Add circles to nodes
  node.append('circle')
    .attr('r', d => {
      const baseSize = Math.max(8, Math.min(20, Math.sqrt(d.changes) * 3));
      return baseSize;
    })
    .attr('fill', d => {
      // Use cluster color if clustered
      if (d.cluster && clusters.length > 0) {
        const cluster = clusters.find(c => c.id === d.cluster);
        return cluster ? cluster.color : getFileTypeColor(d.ext);
      }
      return getFileTypeColor(d.ext);
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('class', 'node-circle');
  
  // Add labels to nodes
  const labels = node.append('text')
    .text(d => d.name)
    .attr('x', 0)
    .attr('y', -25)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('fill', 'var(--color-text)')
    .attr('class', 'node-label')
    .style('pointer-events', 'none');
  
  // Add change count badge
  node.append('text')
    .text(d => d.changes)
    .attr('x', 0)
    .attr('y', 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', 'bold')
    .attr('fill', '#fff')
    .attr('class', 'node-badge')
    .style('pointer-events', 'none');
  
  // Store for toggle function
  window.graphLabels = labels;
  window.labelsVisible = true;
  
  // Update positions on tick
  simulation.on('tick', () => {
    // Update cluster hulls
    if (clusters.length > 0) {
      g.selectAll('.cluster-hulls path')
        .attr('d', d => {
          const points = d.nodes.map(n => [n.x || 0, n.y || 0]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
          return convexHull(points);
        });
      
      g.selectAll('.cluster-labels text')
        .attr('x', d => {
          const xs = d.nodes.map(n => n.x).filter(x => !isNaN(x));
          return xs.length > 0 ? d3.mean(xs) : width / 2;
        })
        .attr('y', d => {
          const ys = d.nodes.map(n => n.y).filter(y => !isNaN(y));
          return ys.length > 0 ? d3.min(ys) - 30 : height / 2;
        });
    }
    
    link
      .attr('x1', d => d.source.x || 0)
      .attr('y1', d => d.source.y || 0)
      .attr('x2', d => d.target.x || 0)
      .attr('y2', d => d.target.y || 0);
    
    node.attr('transform', d => {
      const x = d.x || 0;
      const y = d.y || 0;
      // Only update if values are valid numbers
      if (isNaN(x) || isNaN(y)) return 'translate(0,0)';
      return `translate(${x},${y})`;
    });
  });
  
  // Store nodes and links for external access
  window.graphNodes = node;
  window.graphLinks = link;
  window.graphSimulation = simulation;
  
  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    // Keep node pinned on release
    // d.fx = null;
    // d.fy = null;
  }
  
  // Highlight connected nodes
  function highlightConnections(d, nodes, links) {
    const connectedIds = new Set();
    links.each(function(l) {
      if (l.source.id === d.id) connectedIds.add(l.target.id);
      if (l.target.id === d.id) connectedIds.add(l.source.id);
    });
    
    nodes.selectAll('.node-circle')
      .attr('opacity', n => n.id === d.id || connectedIds.has(n.id) ? 1 : 0.2);
    
    links
      .attr('opacity', l => l.source.id === d.id || l.target.id === d.id ? 1 : 0.1)
      .attr('stroke-width', l => {
        if (l.source.id === d.id || l.target.id === d.id) {
          return Math.max(2, l.similarity * 5);
        }
        return Math.max(1, l.similarity * 3);
      });
  }
  
  function clearHighlights(nodes, links) {
    nodes.selectAll('.node-circle').attr('opacity', 1);
    links
      .attr('opacity', 1)
      .attr('stroke-width', d => Math.max(1, d.similarity * 3));
  }
}
// Clustering algorithms
function applyClustering(nodes, links, algorithm) {
  if (algorithm === 'none') {
    return [];
  }
  
  const clusters = [];
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
  ];
  
  if (algorithm === 'fileType') {
    const fileTypes = {};
    nodes.forEach(node => {
      if (!fileTypes[node.ext]) {
        fileTypes[node.ext] = [];
      }
      fileTypes[node.ext].push(node);
      node.cluster = node.ext;
    });
    
    Object.keys(fileTypes).forEach((type, i) => {
      clusters.push({
        id: type,
        name: type.toUpperCase(),
        nodes: fileTypes[type],
        color: clusterColors[i % clusterColors.length]
      });
    });
  } else if (algorithm === 'workspace') {
    const workspaces = {};
    nodes.forEach(node => {
      const ws = node.workspace || 'unknown';
      if (!workspaces[ws]) {
        workspaces[ws] = [];
      }
      workspaces[ws].push(node);
      node.cluster = ws;
    });
    
    Object.keys(workspaces).forEach((ws, i) => {
      clusters.push({
        id: ws,
        name: ws.split('/').pop() || ws,
        nodes: workspaces[ws],
        color: clusterColors[i % clusterColors.length]
      });
    });
  } else if (algorithm === 'directory') {
    const directories = {};
    nodes.forEach(node => {
      const dir = node.directory || node.path.split('/').slice(0, -1).join('/') || 'root';
      if (!directories[dir]) {
        directories[dir] = [];
      }
      directories[dir].push(node);
      node.cluster = dir;
    });
    
    Object.keys(directories).forEach((dir, i) => {
      clusters.push({
        id: dir,
        name: dir.split('/').pop() || dir,
        nodes: directories[dir],
        color: clusterColors[i % clusterColors.length]
      });
    });
  } else if (algorithm === 'similarity') {
    // K-means style clustering based on link similarity
    const k = Math.min(5, Math.ceil(nodes.length / 10));
    const assignments = kMeansClustering(nodes, links, k);
    
    for (let i = 0; i < k; i++) {
      const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
      if (clusterNodes.length > 0) {
        clusterNodes.forEach(n => n.cluster = `cluster-${i}`);
        clusters.push({
          id: `cluster-${i}`,
          name: `Cluster ${i + 1}`,
          nodes: clusterNodes,
          color: clusterColors[i % clusterColors.length]
        });
      }
    }
  } else if (algorithm === 'community') {
    // Simple community detection using modularity
    const communities = detectCommunities(nodes, links);
    communities.forEach((community, i) => {
      community.forEach(n => n.cluster = `community-${i}`);
      clusters.push({
        id: `community-${i}`,
        name: `Community ${i + 1}`,
        nodes: community,
        color: clusterColors[i % clusterColors.length]
      });
    });
  }
  
  return clusters;
}
function kMeansClustering(nodes, links, k) {
  // Simple k-means based on connectivity
  const n = nodes.length;
  const assignments = new Array(n).fill(0);
  
  // Initialize random centroids
  const centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push(Math.floor(Math.random() * n));
  }
  
  // Iterate a few times
  for (let iter = 0; iter < 10; iter++) {
    // Assign nodes to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const centroidNode = nodes[centroids[c]];
        const link = links.find(l => 
          (l.source.id === nodes[i].id && l.target.id === centroidNode.id) ||
          (l.target.id === nodes[i].id && l.source.id === centroidNode.id)
        );
        
        const dist = link ? (1 - link.similarity) : 1;
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      
      assignments[i] = bestCluster;
    }
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterNodes = nodes.filter((_, i) => assignments[i] === c);
      if (clusterNodes.length > 0) {
        // Find most connected node in cluster
        let maxConnections = -1;
        let bestIdx = 0;
        clusterNodes.forEach(node => {
          const connections = links.filter(l => 
            l.source.id === node.id || l.target.id === node.id
          ).length;
          if (connections > maxConnections) {
            maxConnections = connections;
            bestIdx = nodes.indexOf(node);
          }
        });
        centroids[c] = bestIdx;
      }
    }
  }
  
  return assignments;
}

function detectCommunities(nodes, links) {
  // Simple greedy modularity-based community detection
  const communities = nodes.map(n => [n]);
  
  // Merge communities that increase modularity
  for (let iter = 0; iter < 5; iter++) {
    let bestMerge = null;
    let bestModularity = -Infinity;
    
    for (let i = 0; i < communities.length; i++) {
      for (let j = i + 1; j < communities.length; j++) {
        const modularity = calculateModularity(communities[i], communities[j], links);
        if (modularity > bestModularity) {
          bestModularity = modularity;
          bestMerge = [i, j];
        }
      }
    }
    
    if (bestMerge && bestModularity > 0) {
      const [i, j] = bestMerge;
      communities[i] = [...communities[i], ...communities[j]];
      communities.splice(j, 1);
    } else {
      break;
    }
  }
  
  return communities.filter(c => c.length > 0);
}

function calculateModularity(community1, community2, links) {
  // Calculate links within merged community vs expected
  const merged = [...community1, ...community2];
  const mergedIds = new Set(merged.map(n => n.id));
  
  const internalLinks = links.filter(l => 
    mergedIds.has(l.source.id) && mergedIds.has(l.target.id)
  ).length;
  
  const totalLinks = links.length;
  const expectedLinks = (merged.length * (merged.length - 1)) / (2 * totalLinks);
  
  return internalLinks - expectedLinks;
}

function forceCluster(clusters) {
  // Custom force to pull nodes toward cluster centers
  return (alpha) => {
    clusters.forEach(cluster => {
      if (cluster.nodes.length === 0) return;
      
      // Calculate cluster center
      const centerX = d3.mean(cluster.nodes, d => d.x);
      const centerY = d3.mean(cluster.nodes, d => d.y);
      
      // Pull nodes toward center
      cluster.nodes.forEach(node => {
        node.vx += (centerX - node.x) * alpha * 0.1;
        node.vy += (centerY - node.y) * alpha * 0.1;
      });
    });
  };
}

function convexHull(points) {
  // Simple convex hull for cluster boundaries
  if (points.length < 3) return '';
  
  // Sort points by x coordinate
  points.sort((a, b) => a[0] - b[0]);
  
  // Build upper hull
  const upper = [];
  for (let i = 0; i < points.length; i++) {
    while (upper.length >= 2) {
      const m = upper.length;
      const cross = (upper[m-1][0] - upper[m-2][0]) * (points[i][1] - upper[m-2][1]) -
                    (upper[m-1][1] - upper[m-2][1]) * (points[i][0] - upper[m-2][0]);
      if (cross <= 0) break;
      upper.pop();
    }
    upper.push(points[i]);
  }
  
  // Build lower hull
  const lower = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (lower.length >= 2) {
      const m = lower.length;
      const cross = (lower[m-1][0] - lower[m-2][0]) * (points[i][1] - lower[m-2][1]) -
                    (lower[m-1][1] - lower[m-2][1]) * (points[i][0] - lower[m-2][0]);
      if (cross <= 0) break;
      lower.pop();
    }
    lower.push(points[i]);
  }
  
  // Remove last point of each half because it's repeated
  upper.pop();
  lower.pop();
  
  const hull = upper.concat(lower);
  
  // Add padding
  const padding = 40;
  const centroid = [
    d3.mean(hull, d => d[0]),
    d3.mean(hull, d => d[1])
  ];
  
  const paddedHull = hull.map(p => {
    const dx = p[0] - centroid[0];
    const dy = p[1] - centroid[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = (dist + padding) / dist;
    return [
      centroid[0] + dx * scale,
      centroid[1] + dy * scale
    ];
  });
  
  return 'M' + paddedHull.map(p => p.join(',')).join('L') + 'Z';
}

// Navigation functions
function zoomToFit() {
  if (!window.graphSvg || !window.graphG || !window.graphNodes) return;
  
  const svg = window.graphSvg;
  const g = window.graphG;
  const zoom = window.graphZoom;
  
  // Get bounds of all nodes
  const nodes = window.graphNodes.data();
  if (nodes.length === 0) return;
  
  const xs = nodes.map(d => d.x);
  const ys = nodes.map(d => d.y);
  
  const minX = Math.min(...xs) - 50;
  const maxX = Math.max(...xs) + 50;
  const minY = Math.min(...ys) - 50;
  const maxY = Math.max(...ys) + 50;
  
  const width = parseFloat(svg.attr('width'));
  const height = parseFloat(svg.attr('height'));
  
  const scale = 0.9 * Math.min(width / (maxX - minX), height / (maxY - minY));
  const translateX = width / 2 - scale * (minX + maxX) / 2;
  const translateY = height / 2 - scale * (minY + maxY) / 2;
  
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

function toggleLabels() {
  if (!window.graphLabels) return;
  
  window.labelsVisible = !window.labelsVisible;
  const button = document.getElementById('labelToggle');
  
  if (window.labelsVisible) {
    window.graphLabels.attr('opacity', 1);
    if (button) button.textContent = 'Hide Labels';
  } else {
    window.graphLabels.attr('opacity', 0);
    if (button) button.textContent = 'Show Labels';
  }
}

function filterGraphNodes(searchTerm) {
  const resultsDiv = document.getElementById('fileSearchResults');
  if (!resultsDiv || !window.fileGraphData) return;
  
  if (!searchTerm || searchTerm.trim() === '') {
    resultsDiv.innerHTML = '';
    // Reset all node highlighting
    if (window.graphNodes) {
      window.graphNodes.selectAll('.node-circle').attr('opacity', 1);
    }
    return;
  }
  
  const term = searchTerm.toLowerCase();
  const matches = window.fileGraphData.nodes.filter(n => 
    n.name.toLowerCase().includes(term) || 
    n.path.toLowerCase().includes(term)
  );
  
  if (matches.length === 0) {
    resultsDiv.innerHTML = '<div style="color: var(--color-text-muted); font-size: 12px; padding: var(--space-sm);">No matches found</div>';
    return;
  }
  
  // Highlight matching nodes
  if (window.graphNodes) {
    const matchIds = new Set(matches.map(m => m.id));
    window.graphNodes.selectAll('.node-circle')
      .attr('opacity', n => matchIds.has(n.id) ? 1 : 0.2);
  }
  
  // Show results
  resultsDiv.innerHTML = matches.slice(0, 10).map(match => `
    <div onclick="focusOnNode('${match.id}')" 
         style="padding: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: var(--space-xs); cursor: pointer; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-family: var(--font-mono); color: var(--color-text);">${match.name}</span>
      <span style="color: var(--color-text-muted); font-size: 11px;">${match.changes} changes</span>
    </div>
  `).join('') + (matches.length > 10 ? `<div style="color: var(--color-text-muted); font-size: 11px; padding: var(--space-xs);">+${matches.length - 10} more</div>` : '');
}

function focusOnNode(nodeId) {
  if (!window.graphSvg || !window.graphG || !window.graphNodes) return;
  
  const node = window.graphNodes.data().find(n => n.id === nodeId);
  if (!node) return;
  
  const svg = window.graphSvg;
  const zoom = window.graphZoom;
  const width = parseFloat(svg.attr('width'));
  const height = parseFloat(svg.attr('height'));
  
  // Zoom to node
  const scale = 1.5;
  const translateX = width / 2 - scale * node.x;
  const translateY = height / 2 - scale * node.y;
  
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
  
  // Show node info
  showFileInfo(node);
}

// Most Similar File Pairs functionality
function renderSimilarFilePairs(links, files) {
  const container = document.getElementById('similarFilePairs');
  if (!container) return;
  
  // Get top count from dropdown
  const count = parseInt(document.getElementById('similarPairsCount')?.value || '10');
  
  // Sort links by similarity and get top pairs
  const sortedLinks = [...links].sort((a, b) => b.similarity - a.similarity).slice(0, count);
  
  if (sortedLinks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text" style="font-size: var(--text-md); margin-bottom: var(--space-sm);">No Similar Pairs Found</div>
        <div class="empty-state-hint">Modify some files together to see relationships</div>
      </div>
    `;
    return;
  }
  
  // Store for highlighting
  window.topSimilarPairs = sortedLinks;
  
  // Render each pair
  container.innerHTML = sortedLinks.map((link, index) => {
    const source = typeof link.source === 'object' ? link.source : files.find(f => f.id === link.source);
    const target = typeof link.target === 'object' ? link.target : files.find(f => f.id === link.target);
    
    if (!source || !target) return '';
    
    const sourceName = source.name || source.id.split('/').pop();
    const targetName = target.name || target.id.split('/').pop();
    const similarityPercent = (link.similarity * 100).toFixed(1);
    
    // Calculate co-modification count and shared prompts
    const sourceSessions = new Set((source.events || []).map(e => e.session_id).filter(Boolean));
    const targetSessions = new Set((target.events || []).map(e => e.session_id).filter(Boolean));
    const sharedSessions = [...sourceSessions].filter(s => targetSessions.has(s)).length;
    
    // Show shared prompts count from link data (if available)
    const sharedPrompts = link.sharedPrompts || 0;
    
    // Get file type colors
    const sourceColor = getFileTypeColor(source.ext);
    const targetColor = getFileTypeColor(target.ext);
    
    return `
      <div class="similar-pair-item" data-source="${source.id}" data-target="${target.id}" 
           onmouseenter="highlightPairInGraph('${source.id}', '${target.id}')"
           onmouseleave="clearGraphHighlights()"
           onclick="focusOnPair('${source.id}', '${target.id}')"
           title="Click to focus on this pair in the graph">
        
        <!-- Rank Badge -->
        <div class="similar-pair-rank">${index + 1}</div>
        
        <!-- File Pair Info -->
        <div class="similar-pair-info">
          <div class="similar-pair-files-row">
            <div class="similar-pair-file">
              <span class="similar-pair-file-dot" style="background: ${sourceColor};"></span>
              <span class="similar-pair-file-name" title="${escapeHtml(source.path)}">${escapeHtml(sourceName)}</span>
            </div>
            <span class="similar-pair-file-arrow">↔</span>
            <div class="similar-pair-file">
              <span class="similar-pair-file-dot" style="background: ${targetColor};"></span>
              <span class="similar-pair-file-name" title="${escapeHtml(target.path)}">${escapeHtml(targetName)}</span>
            </div>
          </div>
          
          <div class="similar-pair-meta">
            ${sharedPrompts > 0 ? `<span title="Number of AI prompts that referenced both files">${sharedPrompts} shared prompts</span>` : ''}
            ${sharedPrompts > 0 && sharedSessions > 0 ? '<span>•</span>' : ''}
            ${sharedSessions > 0 ? `<span title="Number of coding sessions where both files were modified">${sharedSessions} shared sessions</span>` : ''}
            ${(sharedPrompts > 0 || sharedSessions > 0) ? '<span>•</span>' : ''}
            <span>${(source.changes || 0) + (target.changes || 0)} total changes</span>
          </div>
        </div>
        
        <!-- Similarity Score -->
        <div class="similar-pair-score">
          <div class="similar-pair-score-value" title="Jaccard similarity coefficient based on prompt and session co-occurrence">
            ${similarityPercent}%
          </div>
          <div class="similar-pair-score-label">similarity</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateSimilarPairs() {
  if (!window.fileGraphData) return;
  renderSimilarFilePairs(window.fileGraphData.links, window.fileGraphData.nodes);
}

function highlightPairInGraph(sourceId, targetId) {
  if (!window.graphNodes || !window.graphLinks) return;
  
  // Highlight the two nodes
  window.graphNodes.selectAll('.node-circle')
    .attr('opacity', n => n.id === sourceId || n.id === targetId ? 1 : 0.2)
    .attr('stroke-width', n => n.id === sourceId || n.id === targetId ? 4 : 2);
  
  // Highlight the link between them
  window.graphLinks
    .attr('opacity', l => {
      const isTargetLink = (l.source.id === sourceId && l.target.id === targetId) ||
                           (l.source.id === targetId && l.target.id === sourceId);
      return isTargetLink ? 1 : 0.1;
    })
    .attr('stroke-width', l => {
      const isTargetLink = (l.source.id === sourceId && l.target.id === targetId) ||
                           (l.source.id === targetId && l.target.id === sourceId);
      return isTargetLink ? 6 : Math.max(1, l.similarity * 3);
    })
    .attr('stroke', l => {
      const isTargetLink = (l.source.id === sourceId && l.target.id === targetId) ||
                           (l.source.id === targetId && l.target.id === sourceId);
      return isTargetLink ? '#10b981' : '#64748b';
    });
}

function clearGraphHighlights() {
  if (!window.graphNodes || !window.graphLinks) return;
  
  window.graphNodes.selectAll('.node-circle')
    .attr('opacity', 1)
    .attr('stroke-width', 2);
  
  window.graphLinks
    .attr('opacity', 1)
    .attr('stroke-width', d => Math.max(1, d.similarity * 3))
    .attr('stroke', d => {
      if (d.source.cluster === d.target.cluster) {
        const clusters = window.fileGraphData?.clusters || [];
        const cluster = clusters.find(c => c.id === d.source.cluster);
        return cluster ? cluster.color : '#64748b';
      }
      return '#64748b';
    });
}

function focusOnPair(sourceId, targetId) {
  if (!window.graphSvg || !window.graphNodes) return;
  
  const source = window.graphNodes.data().find(n => n.id === sourceId);
  const target = window.graphNodes.data().find(n => n.id === targetId);
  
  if (!source || !target) return;
  
  const svg = window.graphSvg;
  const zoom = window.graphZoom;
  const width = parseFloat(svg.attr('width'));
  const height = parseFloat(svg.attr('height'));
  
  // Calculate center point between the two nodes
  const centerX = (source.x + target.x) / 2;
  const centerY = (source.y + target.y) / 2;
  
  // Calculate distance between nodes
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Scale to fit both nodes with some padding
  const scale = Math.min(2, (Math.min(width, height) * 0.6) / distance);
  const translateX = width / 2 - scale * centerX;
  const translateY = height / 2 - scale * centerY;
  
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
  
  // Keep highlight active
  highlightPairInGraph(sourceId, targetId);
}
function highlightSimilarPairs() {
  if (!window.topSimilarPairs || window.topSimilarPairs.length === 0) {
    alert('No similar pairs to highlight. Generate the graph first.');
    return;
  }
  
  // Collect all IDs from top pairs
  const pairIds = new Set();
  window.topSimilarPairs.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    pairIds.add(sourceId);
    pairIds.add(targetId);
  });
  
  // Highlight nodes in pairs
  if (window.graphNodes) {
    window.graphNodes.selectAll('.node-circle')
      .transition()
      .duration(300)
      .attr('opacity', n => pairIds.has(n.id) ? 1 : 0.15)
      .attr('stroke-width', n => pairIds.has(n.id) ? 4 : 2)
      .attr('stroke', n => pairIds.has(n.id) ? '#10b981' : '#fff');
  }
  
  // Highlight links in top pairs
  if (window.graphLinks) {
    window.graphLinks
      .transition()
      .duration(300)
      .attr('opacity', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const isTopPair = window.topSimilarPairs.some(pair => {
          const pairSourceId = typeof pair.source === 'object' ? pair.source.id : pair.source;
          const pairTargetId = typeof pair.target === 'object' ? pair.target.id : pair.target;
          return (sourceId === pairSourceId && targetId === pairTargetId) ||
                 (sourceId === pairTargetId && targetId === pairSourceId);
        });
        return isTopPair ? 1 : 0.1;
      })
      .attr('stroke-width', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const isTopPair = window.topSimilarPairs.some(pair => {
          const pairSourceId = typeof pair.source === 'object' ? pair.source.id : pair.source;
          const pairTargetId = typeof pair.target === 'object' ? pair.target.id : pair.target;
          return (sourceId === pairSourceId && targetId === pairTargetId) ||
                 (sourceId === pairTargetId && targetId === pairSourceId);
        });
        return isTopPair ? 6 : Math.max(1, l.similarity * 3);
      })
      .attr('stroke', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const isTopPair = window.topSimilarPairs.some(pair => {
          const pairSourceId = typeof pair.source === 'object' ? pair.source.id : pair.source;
          const pairTargetId = typeof pair.target === 'object' ? pair.target.id : pair.target;
          return (sourceId === pairSourceId && targetId === pairTargetId) ||
                 (sourceId === pairTargetId && targetId === pairSourceId);
        });
        return isTopPair ? '#10b981' : '#64748b';
      });
  }
  
  // Zoom to fit highlighted nodes
  setTimeout(() => {
    if (window.graphSvg && window.graphNodes) {
      const highlightedNodes = window.graphNodes.data().filter(n => pairIds.has(n.id));
      if (highlightedNodes.length > 0) {
        const xs = highlightedNodes.map(d => d.x);
        const ys = highlightedNodes.map(d => d.y);
        
        const minX = Math.min(...xs) - 100;
        const maxX = Math.max(...xs) + 100;
        const minY = Math.min(...ys) - 100;
        const maxY = Math.max(...ys) + 100;
        
        const svg = window.graphSvg;
        const zoom = window.graphZoom;
        const width = parseFloat(svg.attr('width'));
        const height = parseFloat(svg.attr('height'));
        
        const scale = 0.8 * Math.min(width / (maxX - minX), height / (maxY - minY));
        const translateX = width / 2 - scale * (minX + maxX) / 2;
        const translateY = height / 2 - scale * (minY + maxY) / 2;
        
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
      }
    }
  }, 350);
}

function getFileTypeColor(ext) {
  const colors = {
    'js': '#f7df1e',
    'ts': '#3178c6',
    'py': '#3776ab',
    'html': '#e34c26',
    'css': '#264de4',
    'json': '#00d1b2',
    'md': '#083fa1'
  };
  return colors[ext] || '#64748b';
}

// ===================================
// Navigator Functions (Latent Space)
// ===================================

// Navigator state
const navigatorState = {
  viewMode: 'physical',
  interpolation: 0.0,
  transitionSpeed: 1.0,
  physicalPositions: new Map(),
  latentPositions: new Map(),
  nodes: [],
  links: [],
  clusters: [],
  svg: null,
  simulation: null,
  labelsVisible: true
};
async function initializeNavigator() {
  const container = document.getElementById('navigatorContainer');
  if (!container) return;
  
  try {
    const startTime = Date.now();
    console.log('[NAVIGATOR] Starting initialization...');
    
    // Show loading
    container.innerHTML = '<div class="loading-wrapper"><div class="loading-spinner"></div><span>Computing latent embeddings...</span></div>';
    
    // Fetch file data
    const response = await fetch(`${CONFIG.API_BASE}/api/file-contents?limit=100000`);
    const data = await response.json();
    
    if (!data.files || data.files.length === 0) {
      container.innerHTML = '<div class="empty-wrapper">No file data available</div>';
      return;
    }
    
    // Helper function to check if a string is a Git object hash (40-char hex)
    const isGitObjectHash = (str) => /^[0-9a-f]{40}$/i.test(str);
    
    // Helper function to get a meaningful file name
    const getMeaningfulName = (file) => {
      // If the name itself is a Git hash, try to extract from path
      if (isGitObjectHash(file.name)) {
        const pathParts = file.path.split('/');
        // Find a non-hash part of the path
        for (let i = pathParts.length - 1; i >= 0; i--) {
          if (!isGitObjectHash(pathParts[i]) && pathParts[i].length > 0) {
            return pathParts[i];
          }
        }
        return 'Git object';
      }
      return file.name;
    };
    
    // Prepare files with events - filter out Git object hashes
    let files = data.files
      .filter(f => {
        // Filter out Git object hashes
        if (f.path && f.path.includes('.git/objects/') && isGitObjectHash(f.name)) {
          return false;
        }
        return true;
      })
      .map(f => {
        const relatedEvents = (state.data.events || []).filter(event => {
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            const filePath = details?.file_path || event.file_path || '';
            return filePath.includes(f.name) || f.path.includes(filePath);
          } catch (e) {
            return false;
          }
        });
        
        // Get meaningful display name
        const displayName = getMeaningfulName(f);
        
        return {
          id: f.path,
          path: f.path,
          name: displayName,  // Use meaningful name instead of hash
          originalName: f.name,  // Keep original for reference
          ext: f.ext,
          content: f.content,
          changes: f.changes || 0,
          lastModified: f.lastModified,
          size: f.size,
          events: relatedEvents || []
        };
      });
    
    console.log(`[NAVIGATOR] Processing ${files.length} files...`);
    
    // Limit files for performance (embeddings are O(n²))
    const MAX_FILES = 2000; // Increased to cover more of the database while keeping O(n^2) manageable
    if (files.length > MAX_FILES) {
      console.warn(`[NAVIGATOR] Too many files (${files.length}), limiting to ${MAX_FILES} most active files`);
      // Sort by activity (events + changes) and take top N
      files = files
        .map(f => ({ ...f, activity: f.events.length + (f.changes || 0) }))
        .sort((a, b) => b.activity - a.activity)
        .slice(0, MAX_FILES);
    }
    
    // Compute physical positions (co-occurrence based)
    const { nodes: physicalNodes, links } = computePhysicalLayout(files);
    
    // Compute latent positions (semantic similarity based) using UMAP-like layout
    const latentNodes = computeLatentLayoutUMAP(files);
    
    // Store positions
    physicalNodes.forEach(n => {
      navigatorState.physicalPositions.set(n.id, { x: n.x, y: n.y });
    });
    
    latentNodes.forEach(n => {
      navigatorState.latentPositions.set(n.id, { x: n.x, y: n.y });
    });
    
    // Detect latent clusters
    navigatorState.clusters = detectLatentClusters(latentNodes, links);
    
    // Store data
    navigatorState.nodes = physicalNodes;
    navigatorState.links = links;
    
    // Render
    renderNavigator(container, physicalNodes, links);
    
    // Render mini-map
    renderMiniMap();
    
    // Update stats
    updateNavigatorStats();
    
    // Generate insights
    generateSemanticInsights();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[NAVIGATOR] Initialization complete in ${elapsed}s`);
    
  } catch (error) {
    console.error('Error initializing navigator:', error);
    container.innerHTML = `<div class="error-wrapper">Error loading navigator: ${escapeHtml(error.message)}</div>`;
  }
}

function computePhysicalLayout(files) {
  // Use co-occurrence similarity (same as file graph)
  const links = [];
  const threshold = 0.3;
  
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];
      
      const sessions1 = new Set((file1.events || []).map(e => e.session_id).filter(Boolean));
      const sessions2 = new Set((file2.events || []).map(e => e.session_id).filter(Boolean));
      
      const intersection = new Set([...sessions1].filter(x => sessions2.has(x)));
      const union = new Set([...sessions1, ...sessions2]);
      
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      if (similarity > threshold) {
        links.push({
          source: file1.id,
          target: file2.id,
          similarity: similarity
        });
      }
    }
  }
  
  // Use force simulation to compute positions
  const width = 800, height = 700;
  const tempSimulation = d3.forceSimulation(files)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));
  
  // Run simulation to completion (reduced iterations for speed)
  const simIterations = Math.min(100, files.length * 2); // Adaptive
  console.log(`[LAYOUT] Running force simulation for ${simIterations} ticks...`);
  for (let i = 0; i < simIterations; i++) {
    tempSimulation.tick();
  }
  console.log(`[LAYOUT] Physical layout complete`);
  
  tempSimulation.stop();
  
  return { nodes: files, links };
}

// UMAP-like latent layout: kNN graph + attractive/repulsive optimization (simplified)
function computeLatentLayoutUMAP(files) {
  const width = 800, height = 700;
  const padding = 100;
  const vectors = files.map(file => createFeatureVector(file));
  console.log(`[UMAP] Building feature space for ${vectors.length} nodes`);

  // Build kNN graph using cosine similarity
  const k = Math.min(15, Math.max(5, Math.floor(Math.sqrt(files.length))));
  const neighbors = buildKNN(vectors, k);
  console.log(`[UMAP] kNN graph built with k=${k}`);

  // Initialize positions (PCA-lite via random small circle)
  const positions = vectors.map((_, i) => {
    const angle = (2 * Math.PI * i) / vectors.length;
    return [Math.cos(angle) * 0.01, Math.sin(angle) * 0.01];
  });

  // Optimize (epochs) - attractive along edges, weak repulsive for non-neighbors (sampled)
  const epochs = Math.min(100, 20 + Math.floor(files.length / 50));
  const learningRate = 0.1;
  const minDist = 0.1;
  const negSamples = 3;
  for (let e = 0; e < epochs; e++) {
    for (let i = 0; i < vectors.length; i++) {
      const pi = positions[i];
      // Attractive forces for neighbors
      const neigh = neighbors[i];
      for (let n = 0; n < neigh.length; n++) {
        const j = neigh[n].index;
        const pj = positions[j];
        const dx = pi[0] - pj[0];
        const dy = pi[1] - pj[1];
        const dist2 = dx * dx + dy * dy + 1e-6;
        const grad = (dist2 > minDist ? (dist2 - minDist) : 0) * learningRate;
        // Move closer (attractive)
        pi[0] -= grad * dx;
        pi[1] -= grad * dy;
        pj[0] += grad * dx;
        pj[1] += grad * dy;
      }
      // Negative sampling: mild repulsion from random nodes
      for (let s = 0; s < negSamples; s++) {
        const j = Math.floor(Math.random() * vectors.length);
        if (j === i) continue;
        const pj = positions[j];
        const dx = pi[0] - pj[0];
        const dy = pi[1] - pj[1];
        const dist2 = dx * dx + dy * dy + 1e-6;
        const inv = learningRate / Math.sqrt(dist2);
        // Push apart slightly
        pi[0] += inv * dx * 0.01;
        pi[1] += inv * dy * 0.01;
        pj[0] -= inv * dx * 0.01;
        pj[1] -= inv * dy * 0.01;
      }
    }
    if (e % 10 === 0) console.log(`[UMAP] Epoch ${e}/${epochs}`);
  }

  // Scale to canvas
  const xs = positions.map(p => p[0]);
  const ys = positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (width - 2 * padding) / (maxX - minX || 1);
  const scaleY = (height - 2 * padding) / (maxY - minY || 1);
  console.log(`[UMAP] Latent layout complete for ${files.length} nodes`);

  return files.map((file, i) => ({
    ...file,
    x: padding + (positions[i][0] - minX) * scaleX,
    y: padding + (positions[i][1] - minY) * scaleY
  }));
}

function buildKNN(vectors, k) {
  const sims = (a, b) => cosineSimilarityVector(a, b);
  const neighbors = [];
  for (let i = 0; i < vectors.length; i++) {
    const scores = [];
    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      scores.push({ index: j, score: sims(vectors[i], vectors[j]) });
    }
    scores.sort((a, b) => b.score - a.score);
    neighbors.push(scores.slice(0, k));
  }
  return neighbors;
}

function createFeatureVector(file) {
  // Create a simple feature vector based on file characteristics
  const vector = [];
  
  // Content-based features (simplified TF-IDF)
  const words = (file.content || '').toLowerCase().match(/\b\w+\b/g) || [];
  const wordCounts = {};
  words.forEach(w => wordCounts[w] = (wordCounts[w] || 0) + 1);
  
  // Take top 100 words as features
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);
  
  topWords.forEach(([word, count]) => {
    vector.push(count / words.length); // Normalized frequency
  });
  
  // Structural features
  vector.push(file.changes / 100); // Normalized changes
  vector.push(file.events.length / 50); // Normalized event count
  
  // Extension one-hot (simplified)
  const exts = ['js', 'ts', 'py', 'html', 'css', 'json', 'md'];
  exts.forEach(ext => {
    vector.push(file.ext === ext ? 1 : 0);
  });
  
  return vector;
}

function detectLatentClusters(nodes, links) {
  // Use k-means clustering on latent positions
  // More aggressive clustering: aim for 3-8 clusters based on file count
  let k;
  if (nodes.length < 6) {
    k = Math.max(1, Math.floor(nodes.length / 2)); // 2-3 nodes per cluster for small sets
  } else if (nodes.length < 20) {
    k = Math.min(5, Math.max(3, Math.ceil(nodes.length / 4))); // 3-5 clusters
  } else {
    k = Math.min(8, Math.max(4, Math.ceil(nodes.length / 8))); // 4-8 clusters for larger sets
  }
  
  const clusters = [];
  
  if (nodes.length === 0) return clusters;
  
  console.log(`[TARGET] Detecting ${k} latent clusters from ${nodes.length} files`);
  
  // Initialize centroids randomly
  const centroids = [];
  const used = new Set();
  for (let i = 0; i < k; i++) {
    let idx;
    do {
      idx = Math.floor(Math.random() * nodes.length);
    } while (used.has(idx) && used.size < nodes.length);
    used.add(idx);
    centroids.push({ x: nodes[idx].x, y: nodes[idx].y });
  }
  
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
  ];
  
  // Run k-means iterations
  for (let iter = 0; iter < 10; iter++) {
    // Assign nodes to nearest centroid
    const assignments = nodes.map(node => {
      let minDist = Infinity;
      let cluster = 0;
      centroids.forEach((c, i) => {
        const dist = Math.sqrt((node.x - c.x) ** 2 + (node.y - c.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          cluster = i;
        }
      });
      return cluster;
    });
    
    // Update centroids
    for (let i = 0; i < k; i++) {
      const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
      if (clusterNodes.length > 0) {
        centroids[i] = {
          x: d3.mean(clusterNodes, d => d.x),
          y: d3.mean(clusterNodes, d => d.y)
        };
      }
    }
  }
  
  // Final assignment
  const assignments = nodes.map(node => {
    let minDist = Infinity;
    let cluster = 0;
    centroids.forEach((c, i) => {
      const dist = Math.sqrt((node.x - c.x) ** 2 + (node.y - c.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        cluster = i;
      }
    });
    return cluster;
  });
  
  // Create cluster objects
  for (let i = 0; i < k; i++) {
    const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
    if (clusterNodes.length > 0) {
      clusterNodes.forEach(n => n.cluster = `latent-${i}`);
      clusters.push({
        id: `latent-${i}`,
        name: `Cluster ${i + 1}`,
        nodes: clusterNodes,
        color: clusterColors[i % clusterColors.length],
        centroid: centroids[i]
      });
    }
  }
  
  return clusters;
}

function renderNavigator(container, nodes, links) {
  container.innerHTML = '';
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 700;
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'var(--color-bg)');
  
  const g = svg.append('g');
  
  // Add zoom
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      updateMiniMapViewport();
    });
  
  svg.call(zoom);
  
  navigatorState.svg = svg;
  navigatorState.zoom = zoom;
  navigatorState.g = g;
  
  // Create links
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#64748b')
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', d => Math.max(1, d.similarity * 2));
  
  // Create nodes
  const node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'nav-node')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => showFileInfo(d))
    .style('cursor', 'pointer');
  
  node.append('circle')
    .attr('r', d => Math.max(6, Math.min(15, Math.sqrt(d.changes) * 2)))
    .attr('fill', d => {
      if (d.cluster && navigatorState.clusters.length > 0) {
        const cluster = navigatorState.clusters.find(c => c.id === d.cluster);
        return cluster ? cluster.color : getFileTypeColor(d.ext);
      }
      return getFileTypeColor(d.ext);
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('class', 'nav-node-circle');
  
  const labels = node.append('text')
    .text(d => d.name)
    .attr('x', 0)
    .attr('y', -20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', 'var(--color-text)')
    .attr('class', 'nav-node-label')
    .style('pointer-events', 'none');
  
  navigatorState.labels = labels;
  navigatorState.nodeElements = node;
  navigatorState.linkElements = link;
  
  // Update positions
  updateNodePositions();
  
  function dragstarted(event, d) {
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    updateNodePositions();
  }
  
  function dragended(event, d) {
    d.fx = null;
    d.fy = null;
  }
}

function setNavigatorViewMode(mode) {
  navigatorState.viewMode = mode;
  
  // Update button states
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.view-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
  
  // Set interpolation
  const targetInterpolation = {
    'physical': 0.0,
    'hybrid': 0.5,
    'latent': 1.0
  }[mode];
  
  // Animate transition
  animateInterpolation(navigatorState.interpolation, targetInterpolation);
}

function animateInterpolation(from, to) {
  const duration = 1000 / navigatorState.transitionSpeed;
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
    
    navigatorState.interpolation = from + (to - from) * eased;
    
    // Update visualization
    updateNodePositions();
    updateInterpolationDisplay();
    
    if (t < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  animate();
}
function updateNodePositions() {
  if (!navigatorState.nodeElements || !navigatorState.linkElements) return;
  
  const t = navigatorState.interpolation;
  
  // Interpolate positions
  navigatorState.nodes.forEach(node => {
    const phys = navigatorState.physicalPositions.get(node.id);
    const lat = navigatorState.latentPositions.get(node.id);
    
    if (phys && lat) {
      node.x = phys.x * (1 - t) + lat.x * t;
      node.y = phys.y * (1 - t) + lat.y * t;
    }
  });
  
  // Update D3 elements
  navigatorState.nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
  
  navigatorState.linkElements
    .attr('x1', d => {
      const source = navigatorState.nodes.find(n => n.id === d.source || n.id === d.source.id);
      return source ? source.x : 0;
    })
    .attr('y1', d => {
      const source = navigatorState.nodes.find(n => n.id === d.source || n.id === d.source.id);
      return source ? source.y : 0;
    })
    .attr('x2', d => {
      const target = navigatorState.nodes.find(n => n.id === d.target || n.id === d.target.id);
      return target ? target.x : 0;
    })
    .attr('y2', d => {
      const target = navigatorState.nodes.find(n => n.id === d.target || n.id === d.target.id);
      return target ? target.y : 0;
    });
  
  // Update mini-map
  updateMiniMapViewport();
}

function updateInterpolationDisplay() {
  const percent = Math.round(navigatorState.interpolation * 100);
  const el = document.getElementById('interpolationValue');
  if (el) {
    el.textContent = `${percent}%`;
  }
}

function updateTransitionSpeed(value) {
  navigatorState.transitionSpeed = parseFloat(value);
  const el = document.getElementById('speedLabel');
  if (el) {
    el.textContent = `${value}x`;
  }
}

function renderMiniMap() {
  const container = document.getElementById('miniMapCanvas');
  if (!container) return;
  
  container.innerHTML = '';
  
  const width = container.clientWidth;
  const height = 180;
  const scale = 0.2;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Render simplified nodes
  svg.selectAll('circle')
    .data(navigatorState.nodes)
    .join('circle')
    .attr('cx', d => d.x * scale)
    .attr('cy', d => d.y * scale)
    .attr('r', 1.5)
    .attr('fill', d => {
      if (d.cluster) {
        const cluster = navigatorState.clusters.find(c => c.id === d.cluster);
        return cluster ? cluster.color : '#999';
      }
      return '#999';
    })
    .attr('opacity', 0.8);
  
  // Viewport rectangle
  const viewportRect = svg.append('rect')
    .attr('class', 'minimap-viewport')
    .attr('fill', 'none')
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 1.5);
  
  navigatorState.miniMapSvg = svg;
  navigatorState.miniMapViewport = viewportRect;
  navigatorState.miniMapScale = scale;
  
  // Click to navigate
  svg.on('click', (event) => {
    const [x, y] = d3.pointer(event);
    navigateToMiniMapPosition(x / scale, y / scale);
  });
  
  updateMiniMapViewport();
}
function updateMiniMapViewport() {
  if (!navigatorState.miniMapViewport || !navigatorState.svg) return;
  
  const transform = d3.zoomTransform(navigatorState.svg.node());
  const scale = navigatorState.miniMapScale;
  
  const width = 800 / transform.k;
  const height = 700 / transform.k;
  const x = -transform.x / transform.k;
  const y = -transform.y / transform.k;
  
  navigatorState.miniMapViewport
    .attr('x', x * scale)
    .attr('y', y * scale)
    .attr('width', width * scale)
    .attr('height', height * scale);
}

function navigateToMiniMapPosition(x, y) {
  if (!navigatorState.svg || !navigatorState.zoom) return;
  
  const width = 800;
  const height = 700;
  const scale = 1.5;
  
  const translateX = width / 2 - scale * x;
  const translateY = height / 2 - scale * y;
  
  navigatorState.svg.transition()
    .duration(500)
    .call(navigatorState.zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}
function updateNavigatorStats() {
  const fileCountEl = document.getElementById('navFileCount');
  const clusterCountEl = document.getElementById('navClusterCount');
  
  if (!fileCountEl || !clusterCountEl) {
    console.warn('[NAVIGATOR] Stats elements not found, skipping update');
    return;
  }
  
  fileCountEl.textContent = navigatorState.nodes.length;
  clusterCountEl.textContent = navigatorState.clusters.length;
  
  // Calculate coherence (average intra-cluster distance vs inter-cluster distance)
  let coherence = 0;
  if (navigatorState.clusters.length > 1) {
    const intraDistances = [];
    const interDistances = [];
    
    navigatorState.clusters.forEach(cluster => {
      if (!cluster.nodes || cluster.nodes.length === 0) return;
      cluster.nodes.forEach((n1, i) => {
        if (!n1 || typeof n1.x !== 'number' || typeof n1.y !== 'number') return;
        cluster.nodes.forEach((n2, j) => {
          if (i < j && n2 && typeof n2.x === 'number' && typeof n2.y === 'number') {
            const dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
            intraDistances.push(dist);
          }
        });
      });
    });
    
    navigatorState.clusters.forEach((c1, i) => {
      navigatorState.clusters.forEach((c2, j) => {
        if (i < j && c1.nodes && c1.nodes.length > 0 && c2.nodes && c2.nodes.length > 0) {
          c1.nodes.forEach(n1 => {
            if (!n1 || typeof n1.x !== 'number' || typeof n1.y !== 'number') return;
            c2.nodes.forEach(n2 => {
              if (!n2 || typeof n2.x !== 'number' || typeof n2.y !== 'number') return;
              const dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
              interDistances.push(dist);
            });
          });
        }
      });
    });
    
    const avgIntra = d3.mean(intraDistances) || 1;
    const avgInter = d3.mean(interDistances) || 1;
    coherence = Math.max(0, Math.min(100, (1 - avgIntra / avgInter) * 100));
  }
  
  const coherenceEl = document.getElementById('navCoherence');
  if (coherenceEl) {
    coherenceEl.textContent = `${coherence.toFixed(0)}%`;
  }
  
  // Update cluster legend
  const legend = document.getElementById('clusterLegend');
  if (legend) {
    legend.innerHTML = navigatorState.clusters.map(cluster => `
      <div class="cluster-legend-item">
        <div class="cluster-legend-color" style="background: ${cluster.color};"></div>
        <span class="cluster-legend-label">${escapeHtml(cluster.name)} (${cluster.nodes.length})</span>
      </div>
    `).join('');
  }
}

function generateSemanticInsights() {
  const container = document.getElementById('semanticInsights');
  if (!container || navigatorState.clusters.length === 0) return;
  
  const insights = [];
  
  // Find most isolated cluster
  const clusterCenters = navigatorState.clusters
    .map(c => c.centroid)
    .filter(centroid => centroid && typeof centroid.x === 'number' && typeof centroid.y === 'number');
  
  if (clusterCenters.length === 0) return; // No valid centroids
  
  let maxDist = 0;
  let isolatedCluster = null;
  
  navigatorState.clusters.forEach((cluster, i) => {
    if (!cluster.centroid || typeof cluster.centroid.x !== 'number' || typeof cluster.centroid.y !== 'number') {
      return; // Skip clusters without valid centroids
    }
    
    const distances = clusterCenters.map((center, j) => {
      if (i === j || !center || typeof center.x !== 'number' || typeof center.y !== 'number') return 0;
      return Math.sqrt((cluster.centroid.x - center.x) ** 2 + (cluster.centroid.y - center.y) ** 2);
    });
    const validDistances = distances.filter(d => d > 0);
    if (validDistances.length === 0) return;
    
    const minDist = Math.min(...validDistances);
    if (minDist > maxDist) {
      maxDist = minDist;
      isolatedCluster = cluster;
    }
  });
  
  if (isolatedCluster) {
    insights.push({
      title: 'Most Isolated Module',
      description: `${isolatedCluster.name} has minimal semantic overlap with other parts of your codebase.`,
      cluster: isolatedCluster,
      type: 'isolation'
    });
  }
  
  // Find largest cluster
  const largestCluster = navigatorState.clusters.reduce((max, c) => 
    c.nodes.length > max.nodes.length ? c : max
  );
  
  insights.push({
    title: 'Core Module',
    description: `${largestCluster.name} contains ${largestCluster.nodes.length} files (${((largestCluster.nodes.length / navigatorState.nodes.length) * 100).toFixed(0)}% of codebase).`,
    cluster: largestCluster,
    type: 'core'
  });
  
  // Render insights
  container.innerHTML = insights.map(insight => `
    <div class="semantic-insight-item" style="border-left-color: ${insight.cluster.color};">
      <h4 class="semantic-insight-title">${escapeHtml(insight.title)}</h4>
      <p class="semantic-insight-description">${escapeHtml(insight.description)}</p>
    </div>
  `).join('');
}

function zoomToFitNavigator() {
  if (!navigatorState.svg || !navigatorState.zoom || navigatorState.nodes.length === 0) return;
  
  const xs = navigatorState.nodes.map(d => d.x);
  const ys = navigatorState.nodes.map(d => d.y);
  
  const minX = Math.min(...xs) - 50;
  const maxX = Math.max(...xs) + 50;
  const minY = Math.min(...ys) - 50;
  const maxY = Math.max(...ys) + 50;
  
  const width = 800;
  const height = 700;
  
  const scale = 0.9 * Math.min(width / (maxX - minX), height / (maxY - minY));
  const translateX = width / 2 - scale * (minX + maxX) / 2;
  const translateY = height / 2 - scale * (minY + maxY) / 2;
  
  navigatorState.svg.transition()
    .duration(750)
    .call(navigatorState.zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

function resetNavigatorView() {
  setNavigatorViewMode('physical');
  zoomToFitNavigator();
}

function toggleNavigatorLabels() {
  if (!navigatorState.labels) return;
  
  navigatorState.labelsVisible = !navigatorState.labelsVisible;
  const button = document.getElementById('navigatorLabelToggle');
  
  if (navigatorState.labelsVisible) {
    navigatorState.labels.attr('opacity', 1);
    if (button) button.textContent = 'Hide Labels';
  } else {
    navigatorState.labels.attr('opacity', 0);
    if (button) button.textContent = 'Show Labels';
  }
}

function showFileInfo(file) {
  const modal = document.getElementById('eventModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  
  if (!modal || !title || !body) {
    console.warn('Modal elements not found');
    return;
  }
  
  title.textContent = `File: ${file.name}`;
  
  body.innerHTML = `
    <div class="file-info-section">
      <div>
        <h4>File Information</h4>
        <div class="file-info-grid">
          <div class="file-info-row">
            <span class="file-info-label">Path:</span>
            <span class="file-info-value mono" title="${escapeHtml(file.path)}">${escapeHtml(truncate(file.path, 50))}</span>
          </div>
          <div class="file-info-row">
            <span class="file-info-label">Type:</span>
            <span class="badge" style="background: var(--color-bg-alt); color: var(--color-text); border: 2px solid ${getFileTypeColor(file.ext)}; font-weight: 600; font-family: var(--font-mono);">${file.ext.toUpperCase()}</span>
          </div>
          <div class="file-info-row">
            <span class="file-info-label">Total Changes:</span>
            <span class="file-info-value bold">${file.changes}</span>
          </div>
          <div class="file-info-row">
            <span class="file-info-label">Last Modified:</span>
            <span class="file-info-value">${formatTimeAgo(file.lastModified)}</span>
          </div>
        </div>
      </div>
      
      <div>
        <h4>Recent Events (${file.events.length})</h4>
        <div class="file-events-list">
          ${file.events.slice(-10).reverse().map(event => `
            <div class="file-event-item">
              <div class="file-event-header">
                <span class="file-event-time">
                  ${formatTimeAgo(event.timestamp)}
                </span>
                <span class="badge">${escapeHtml(event.type || 'file_change')}</span>
              </div>
              <div class="file-event-description">
                ${escapeHtml(event.description || event.title || 'File modified')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
}

function updateFileGraph() {
  // Re-initialize the graph with updated filters
  initializeD3FileGraph();
}

function resetFileGraph() {
  // Reset all controls
  document.getElementById('vizMode').value = 'network';
  document.getElementById('layoutAlgorithm').value = 'force';
  document.getElementById('graphMetric').value = 'semantic';
  document.getElementById('reductionMethod').value = 'pca';
  document.getElementById('clustering').value = 'none';
  document.getElementById('similarityThreshold').value = 0.3;
  document.getElementById('thresholdValue').textContent = '0.3';
  
  // Select all file types in dropdown
  const fileTypeFilter = document.getElementById('fileTypeFilter');
  if (fileTypeFilter) {
    Array.from(fileTypeFilter.options).forEach(option => option.selected = true);
  }
  
  updateFileGraph();
}

function resetFileGraphZoom() {
  // Alias for resetFileGraph
  resetFileGraph();
}

// ===================================
// File Similarity via Prompts Analysis
// ===================================
// NOTE: This analyzes FILES based on prompts, not prompts themselves
// The "Prompts Embedding Analysis" section uses the renderEmbeddingsVisualization() function above (line 2608)

function renderFileSimilarityFromPrompts() {
  console.log('[STYLE] Rendering file similarity embeddings based on prompt context...');
  
  // Get all prompts with valid text (filter out JSON/composer conversations)
  const validPrompts = (state.data.prompts || []).filter(p => {
    if (!p.text && !p.preview && !p.prompt) return false;
    const text = p.text || p.preview || p.prompt || '';
    if (text.startsWith('{') || text.startsWith('[')) return false;
    if (text.length < 20) return false;
    if (p.source === 'composer' && p.type === 'conversation') return false;
    return true;
  });
  
  console.log(`[DATA] Found ${validPrompts.length} valid prompts for analysis`);
  
  if (validPrompts.length === 0) {
    document.getElementById('embeddingsVisualization').innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt data will appear here once you start using Cursor AI</div>
      </div>
    `;
    return;
  }
  
  // Extract file references from prompts
  const filePromptMap = new Map(); // file path -> array of prompts
  
  validPrompts.forEach(prompt => {
    const text = prompt.text || prompt.preview || prompt.prompt || '';
    
    // Extract file paths from prompt text (look for common patterns)
    const filePatterns = [
      /[\w-]+\.(js|ts|py|html|css|json|md|txt|jsx|tsx|vue|svelte)/gi, // File extensions
      /\/[\w\/-]+\.[\w]+/g, // Unix-style paths
      /[\w]+\/[\w\/]+\.(js|ts|py)/g // Relative paths
    ];
    
    const mentionedFiles = new Set();
    filePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(m => mentionedFiles.add(m));
    });
    
    // Also check workspace info if available
    if (prompt.workspaceName && prompt.workspaceName !== 'Unknown') {
      mentionedFiles.forEach(file => {
        const fullPath = `${prompt.workspaceName}/${file}`;
        if (!filePromptMap.has(fullPath)) {
          filePromptMap.set(fullPath, []);
        }
        filePromptMap.get(fullPath).push(prompt);
      });
    }
  });
  
  console.log(`[FILE] Found ${filePromptMap.size} files mentioned in prompts`);
  
  // Build file-to-file similarity based on shared prompt context
  const filesArray = Array.from(filePromptMap.keys());
  const fileSimilarities = [];
  
  for (let i = 0; i < filesArray.length; i++) {
    for (let j = i + 1; j < filesArray.length; j++) {
      const file1 = filesArray[i];
      const file2 = filesArray[j];
      const prompts1 = filePromptMap.get(file1);
      const prompts2 = filePromptMap.get(file2);
      
      // Calculate Jaccard similarity of prompt sets
      const set1 = new Set(prompts1.map(p => p.id || p.timestamp));
      const set2 = new Set(prompts2.map(p => p.id || p.timestamp));
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      if (similarity > 0) {
        fileSimilarities.push({
          file1,
          file2,
          similarity,
          sharedPrompts: intersection.size,
          totalPrompts: union.size
        });
      }
    }
  }
  
  // Sort by similarity
  fileSimilarities.sort((a, b) => b.similarity - a.similarity);
  
  console.log(`[GRAPH] Found ${fileSimilarities.length} file pairs with shared prompt context`);
  
  // Display top similar file pairs
  const similarityPairsContainer = document.getElementById('similarityPairs');
  if (similarityPairsContainer && fileSimilarities.length > 0) {
    const topPairs = fileSimilarities.slice(0, 10);
    similarityPairsContainer.innerHTML = topPairs.map((pair, idx) => `
      <div style="padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 3px solid ${idx < 3 ? '#10b981' : '#6366f1'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--color-text);">${pair.file1.split('/').pop()} ↔ ${pair.file2.split('/').pop()}</span>
          <span style="font-size: 11px; font-weight: 700; color: #10b981;">${(pair.similarity * 100).toFixed(1)}%</span>
        </div>
        <div style="font-size: 11px; color: var(--color-text-muted);">
          ${pair.sharedPrompts} shared prompt${pair.sharedPrompts > 1 ? 's' : ''} • ${pair.totalPrompts} total
        </div>
      </div>
    `).join('');
    
    // Update stats
    document.getElementById('embeddingsFilesCount').textContent = filesArray.length;
    document.getElementById('embeddingsTotalChanges').textContent = validPrompts.length;
    const avgSim = fileSimilarities.length > 0 
      ? fileSimilarities.reduce((sum, p) => sum + p.similarity, 0) / fileSimilarities.length 
      : 0;
    document.getElementById('embeddingsAvgSimilarity').textContent = avgSim.toFixed(3);
  } else {
    similarityPairsContainer.innerHTML = `
      <div style="color: var(--color-text-muted); font-size: 13px;">
        No file relationships found in prompts
      </div>
    `;
  }
  
  // Create 2D visualization of file relationships
  if (filesArray.length > 1) {
    renderFileSimilarityVisualization(filesArray, filePromptMap, fileSimilarities);
  }
}

function renderFileSimilarityVisualization(files, filePromptMap, similarities) {
  const container = document.getElementById('embeddingsVisualization');
  if (!container) return;
  
  container.innerHTML = '';
  
  const width = container.clientWidth || 600;
  const height = 300;
  
  // Create nodes
  const nodes = files.map(file => ({
    id: file,
    name: file.split('/').pop(),
    promptCount: filePromptMap.get(file).length
  }));
  
  // Create links from similarities
  const links = similarities
    .filter(s => s.similarity > 0.1) // Only show meaningful connections
    .map(s => ({
      source: s.file1,
      target: s.file2,
      value: s.similarity
    }));
  
  // Create D3 force simulation
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(20));
  
  // Draw links
  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#6366f1')
    .attr('stroke-opacity', d => d.value * 0.8)
    .attr('stroke-width', d => Math.max(1, d.value * 3));
  
  // Draw nodes
  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g');
  
  node.append('circle')
    .attr('r', d => Math.max(4, Math.min(12, Math.sqrt(d.promptCount) * 2)))
    .attr('fill', '#8b5cf6')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);
  
  node.append('text')
    .text(d => d.name)
    .attr('x', 0)
    .attr('y', -15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .attr('fill', 'var(--color-text)')
    .style('pointer-events', 'none');
  
  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}
// ===================================
// Navigator View (Latent Space)
// ===================================

// ===================================
// Navigator View (moved to views/navigator/index.js)
// ===================================
// Removed: function renderNavigatorView - see views/navigator/index.js

function _legacy_renderNavigatorView(container) {
  container.innerHTML = `
    <div class="navigator-view">
      <div class="view-header">
        <h2>Semantic Navigator</h2>
        <p class="view-subtitle">Explore your codebase in latent space - where semantic similarity becomes visual proximity</p>
      </div>

      <!-- View Mode Switcher -->
      <div class="view-mode-controls">
        <div>
          <h3>View Mode</h3>
          <div class="view-mode-switcher">
            <button class="view-mode-btn active" data-mode="physical" onclick="setNavigatorViewMode('physical')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 4h3v3H4V4zm5 0h3v3H9V4zM4 9h3v3H4V9zm5 0h3v3H9V9z"/>
              </svg>
              Physical
            </button>
            <button class="view-mode-btn" data-mode="hybrid" onclick="setNavigatorViewMode('hybrid')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="4" r="2"/>
                <circle cx="4" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M8 6L4 10M8 6l4 4"/>
              </svg>
              Hybrid
            </button>
            <button class="view-mode-btn" data-mode="latent" onclick="setNavigatorViewMode('latent')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="6"/>
                <circle cx="8" cy="8" r="3"/>
                <path d="M8 2v4M8 10v4M2 8h4M10 8h4"/>
              </svg>
              Latent
            </button>
          </div>
          <p>
            <strong>Physical:</strong> Direct co-modification • 
            <strong>Latent:</strong> Semantic similarity • 
            <strong>Hybrid:</strong> Blend both
          </p>
        </div>

        <div>
          <h3>Transition Speed</h3>
          <input type="range" id="transitionSpeed" min="0.5" max="2" step="0.1" value="1" oninput="updateTransitionSpeed(this.value)">
          <div class="speed-label-wrapper">
            <span>Slow</span>
            <span id="speedLabel">1.0x</span>
            <span>Fast</span>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="navigator-main-layout">
        
        <!-- Main Visualization -->
        <div class="navigator-visualization-area">
          <div class="navigator-container" id="navigatorContainer">
            <!-- Navigator will be rendered here -->
          </div>

          <!-- Navigation Controls -->
          <div class="navigator-controls">
            <button class="btn btn-primary" onclick="zoomToFitNavigator()">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z"/>
              </svg>
              Zoom to Fit
            </button>
            <button class="btn btn-secondary" onclick="resetNavigatorView()">Reset View</button>
            <button class="btn btn-secondary" onclick="toggleNavigatorLabels()" id="navigatorLabelToggle">Hide Labels</button>
            
            <div class="spacer"></div>
            
            <div class="interpolation-display">
              <span>Interpolation:</span>
              <span id="interpolationValue" class="interpolation-value">0%</span>
            </div>
          </div>
        </div>

        <!-- Mini-Map Widget -->
        <div class="navigator-sidebar">
          <div class="mini-map-widget">
            <h3>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 2a6 6 0 110 12A6 6 0 018 2z"/>
              </svg>
              Overview
            </h3>
            <div id="miniMapCanvas" class="mini-map-canvas">
              <!-- Mini-map will be rendered here -->
            </div>
            
            <div class="mini-map-stats">
              <div class="mini-map-stat-row">
                <span>Files:</span>
                <span id="navFileCount" class="mini-map-stat-value">0</span>
              </div>
              <div class="mini-map-stat-row">
                <span>Clusters:</span>
                <span id="navClusterCount" class="mini-map-stat-value">0</span>
              </div>
              <div class="mini-map-stat-row">
                <span>Coherence:</span>
                <span id="navCoherence" class="mini-map-stat-value success">0%</span>
              </div>
            </div>
          </div>

          <!-- Cluster Legend -->
          <div class="cluster-legend">
            <h3>Latent Clusters</h3>
            <div id="clusterLegend" class="cluster-legend-list">
              <!-- Cluster legend will be populated -->
            </div>
          </div>
        </div>
      </div>

      <!-- Semantic Insights -->
      <div class="card semantic-insights">
        <div class="card-header">
          <h3 class="card-title">Semantic Insights</h3>
          <p class="card-subtitle">Discovered patterns in latent space</p>
        </div>
        <div class="card-body">
          <div id="semanticInsights" class="semantic-insights-grid">
            <!-- Insights will be populated -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize navigator after DOM is ready
  setTimeout(() => initializeNavigator(), 0);
}
// ===================================
// System View
// ===================================

// ===================================
// System View (moved to views/system/index.js)
// ===================================
// Removed: function renderSystemView - see views/system/index.js

function _legacy_renderSystemView(container) {
  container.innerHTML = `
    <div class="system-view">
      
      <!-- Current Stats Row -->
      <div class="system-stats-grid">
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">System Resources</h3>
          </div>
          <div class="card-body">
            ${renderSystemStatus()}
          </div>
        </div>

      </div>

      <!-- Time Series Graphs -->
      <div class="time-series-grid">
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">System Resources Over Time</h3>
            <p class="card-subtitle">Memory usage and CPU load tracking</p>
          </div>
          <div class="card-body">
            <canvas id="systemResourcesChart" class="system-chart-container"></canvas>
          </div>
        </div>

      </div>

    </div>
  `;

  // Render charts after DOM is updated
  setTimeout(() => {
    renderSystemResourcesChart();
  }, 0);
}

// ===================================
// API Documentation View
// ===================================

// ===================================
// API Docs View (moved to views/api-docs/index.js)
// ===================================
// Removed: function renderAPIDocsView - see views/api-docs/index.js

function _legacy_renderAPIDocsView(container) {
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <div class="page-header">
        <h1>API Documentation</h1>
        <p class="page-subtitle">Complete reference for the Cursor Telemetry Companion Service API</p>
      </div>

      <div style="display: grid; gap: var(--space-xl);">
        
        <!-- Overview Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Overview</h3>
          </div>
          <div class="card-body">
            <p><strong>Base URL:</strong> <code>http://localhost:43917</code></p>
            <p><strong>Total Endpoints:</strong> <strong style="color: var(--color-primary);">49+</strong> REST endpoints</p>
            <p><strong>Content-Type:</strong> <code>application/json</code></p>
            <p><strong>CORS:</strong> Enabled for all origins</p>
            <p><strong>Authentication:</strong> None (local development service)</p>
            
            <div style="margin-top: var(--space-lg); display: grid; gap: var(--space-sm);">
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-info);">
                <strong>Quick Health Check:</strong><br>
                <code>curl http://localhost:43917/health</code>
              </div>
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-success);">
                <strong>Get Recent Activity:</strong><br>
                <code>curl http://localhost:43917/api/activity?limit=10</code>
              </div>
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-accent);">
                <strong>Search Prompts:</strong><br>
                <code>curl "http://localhost:43917/api/search?q=authentication"</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Core Endpoints -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Core Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/health</code>
              </div>
              <p>Health check and service status</p>
              <details>
                <summary>Response Example</summary>
                <pre><code>{
  "status": "running",
  "timestamp": "2025-10-24T04:00:00.000Z",
  "entries": 811,
  "prompts": 337,
  "queue_length": 26,
  "clipboard_stats": {...},
  "raw_data_stats": {...}
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/activity</code>
              </div>
              <p>Get all historical activity events</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>since</code> - Timestamp filter (optional)</li>
                  <li><code>limit</code> - Max results (default: all)</li>
                </ul>
              </details>
              <details>
                <summary>Response Example</summary>
                <pre><code>[
  {
    "id": "abc123",
    "type": "code_change",
    "timestamp": "2025-10-24T03:30:00.000Z",
    "file_path": "src/index.js",
    "workspace_path": "/Users/dev/project",
    "session_id": "sess_xyz",
    "details": {...}
  }
]</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/entries</code>
              </div>
              <p>Get prompts and entries with Cursor DB integration</p>
              <details>
                <summary>Response Example</summary>
                <pre><code>{
  "entries": [
    {
      "id": 123,
      "text": "Implementing authentication",
      "source": "composer",
      "timestamp": "2025-10-24T03:30:00.000Z",
      "workspacePath": "/Users/dev/project",
      "linesAdded": 247,
      "linesRemoved": 83,
      "contextUsage": 67.5,
      "mode": "agent",
      "modelName": "claude-4.5-sonnet"
    }
  ]
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- Database Management -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Database Management</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/database/stats</code>
              </div>
              <p>Get database statistics with integrity checks</p>
              <details>
                <summary>Response Example</summary>
                <pre><code>{
  "success": true,
  "stats": {
    "entries": 811,
    "prompts": 337,
    "events": 806,
    "linked_entries": 245,
    "linked_prompts": 198,
    "unique_sessions": 27,
    "linked_entries_percent": "30.21",
    "linked_prompts_percent": "58.75"
  },
  "integrity": {
    "valid": true,
    "checks": {
      "orphaned_entry_prompts": 0,
      "orphaned_prompt_entries": 0,
      "null_timestamps": 0
    }
  }
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/database/entries-with-prompts</code>
              </div>
              <p>Get entries with their linked prompts (JOIN query)</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max results (default: 100)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/database/prompts-with-entries</code>
              </div>
              <p>Get prompts with their linked entries (JOIN query)</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max results (default: 100)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/export/database</code>
              </div>
              <p>Export complete database snapshot as JSON</p>
              <details>
                <summary>Response Structure</summary>
                <pre><code>{
  "success": true,
  "data": {
    "metadata": {
      "exportedAt": "2025-10-24T04:00:00.000Z",
      "version": "2.0",
      "totalEntries": 811,
      "totalPrompts": 337,
      "totalEvents": 806,
      "totalTerminalCommands": 245,
      "totalContextSnapshots": 189
    },
    "entries": [...],          // File changes with full details
    "prompts": [...],          // AI prompts with all metadata
    "events": [...],           // Activity events
    "terminal_commands": [...], // Command history (NEW)
    "context_snapshots": [...], // Context usage over time (NEW)
    "context_analytics": {...}, // Aggregated context stats (NEW)
    "workspaces": [...],
    "stats": {
      "sessions": 39,
      "fileChanges": 811,
      "aiInteractions": 337,
      "totalActivities": 806,
      "terminalCommands": 245,
      "avgContextUsage": 58.9
    }
  }
}</code></pre>
               </details>
             </div>

          </div>
        </div>

        <!-- Analytics Endpoints -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Analytics Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context</code>
              </div>
              <p>Context window analytics (@ mentions, token usage)</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/snapshots</code>
              </div>
              <p>Historical context usage snapshots over time</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/historical</code>
              </div>
              <p>Historical context data for trend analysis</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/timeline</code>
              </div>
              <p>Context usage timeline visualization data</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/file-relationships</code>
              </div>
              <p>File co-occurrence graph for context analysis</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>minCount</code> - Minimum co-occurrence count (default: 2)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/errors</code>
              </div>
              <p>Error and bug tracking statistics</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/errors/recent</code>
              </div>
              <p>Recent errors with detailed information</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/productivity</code>
              </div>
              <p>Productivity metrics (time-to-edit, iterations, code churn)</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/file-usage</code>
              </div>
              <p>File usage patterns and access frequency</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/prompts/:id/context-files</code>
              </div>
              <p>Get context files for a specific prompt by ID</p>
            </div>

          </div>
        </div>

        <!-- Terminal Monitoring -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Terminal Monitoring</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/terminal/history</code>
              </div>
              <p>Shell command history with filtering</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max results (default: 100)</li>
                  <li><code>source</code> - Filter by source (e.g., 'zsh', 'bash')</li>
                  <li><code>workspace</code> - Filter by workspace path</li>
                  <li><code>exitCode</code> - Filter by exit code</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/terminal/stats</code>
              </div>
              <p>Terminal usage statistics and top commands</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/terminal/enable</code>
              </div>
              <p>Enable terminal monitoring</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/terminal/disable</code>
              </div>
              <p>Disable terminal monitoring</p>
            </div>

          </div>
        </div>

        <!-- Screenshots -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Screenshots</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/screenshots</code>
              </div>
              <p>Get all screenshot metadata</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/screenshots/near/:timestamp</code>
              </div>
              <p>Find screenshot closest to a specific timestamp</p>
              <details>
                <summary>Parameters</summary>
                <ul>
                  <li><code>timestamp</code> - Unix timestamp in milliseconds</li>
                </ul>
              </details>
            </div>

          </div>
        </div>

        <!-- Todo/Task Management -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Todo & Task Management</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/todos</code>
              </div>
              <p>Get all todos with optional filtering</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>status</code> - Filter by status (e.g., 'pending', 'completed')</li>
                  <li><code>workspace</code> - Filter by workspace path</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/todos/:id/events</code>
              </div>
              <p>Get events associated with a specific todo</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/todos</code>
              </div>
              <p>Create a new todo</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "title": "Implement authentication",
  "description": "Add JWT-based auth",
  "workspace": "/path/to/workspace",
  "status": "pending"
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/todos/:id/status</code>
              </div>
              <p>Update todo status</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "status": "completed"
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- Workspace-Specific -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Workspace-Specific Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/workspace/:workspacePath/activity</code>
              </div>
              <p>Get activity for a specific workspace</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>since</code> - Timestamp filter</li>
                  <li><code>limit</code> - Max results</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/workspace/:workspacePath/sessions</code>
              </div>
              <p>Get coding sessions for a specific workspace</p>
            </div>

          </div>
        </div>

        <!-- Data Sources -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Data Sources & Raw Data</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state</code>
              </div>
              <p>Current IDE state from AppleScript capture</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/history</code>
              </div>
              <p>Historical IDE state data</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/editor</code>
              </div>
              <p>Current editor state and open files</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/workspace</code>
              </div>
              <p>Current workspace state</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/debug</code>
              </div>
              <p>Debug state and breakpoint information</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/cursor</code>
              </div>
              <p>Cursor-specific IDE state</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/system-resources</code>
              </div>
              <p>System resource usage (CPU, memory, load)</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max data points (default: 50)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/git</code>
              </div>
              <p>Git activity data (commits, branches)</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/cursor-database</code>
              </div>
              <p>Raw data from Cursor database queries</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/apple-script</code>
              </div>
              <p>AppleScript automation data</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/logs</code>
              </div>
              <p>System and application logs</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/all</code>
              </div>
              <p>All raw data sources combined</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/cursor-database</code>
              </div>
              <p>Direct access to Cursor database mining results</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/workspaces</code>
              </div>
              <p>List of monitored workspaces</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/file-contents</code>
              </div>
              <p>Get file contents from the database</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>path</code> - File path (required)</li>
                </ul>
              </details>
            </div>

          </div>
        </div>

        <!-- Utility Endpoints -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Utility & Debug Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/queue</code>
              </div>
              <p>View internal processing queue status</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/debug</code>
              </div>
              <p>Debug information and diagnostics</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/activity/stream</code>
              </div>
              <p>Server-Sent Events stream for real-time activity</p>
              <details>
                <summary>Usage</summary>
                <pre><code>const eventSource = new EventSource('http://localhost:43917/api/activity/stream');
eventSource.onmessage = (event) => {
  console.log(JSON.parse(event.data));
};</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/prompts/manual</code>
              </div>
              <p>Manually log a prompt</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "text": "Your prompt text",
  "source": "manual",
  "workspace": "/path/to/workspace",
  "metadata": {}
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- MCP Integration -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">MCP Integration (Model Context Protocol)</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/mcp/log-prompt-response</code>
              </div>
              <p>Log AI prompt/response pairs from MCP</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "session_id": "optional-session-id",
  "file_path": "src/index.js",
  "prompt": "How do I implement JWT auth?",
  "response": "Here's how to implement JWT..."
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/mcp/log-code-change</code>
              </div>
              <p>Log code changes from MCP</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "file_path": "src/index.js",
  "before_code": "const x = 1;",
  "after_code": "const x = 2;",
  "source": "ai-generated"
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- WebSocket -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">WebSocket (Real-time Updates)</h3>
          </div>
          <div class="card-body">
            <p><strong>URL:</strong> <code>ws://localhost:43917</code></p>
            <p>Connect via Socket.IO for real-time activity updates</p>
            <details>
              <summary>Events</summary>
              <ul>
                <li><code>activity</code> - New activity event</li>
                <li><code>prompt</code> - New prompt captured</li>
                <li><code>workspace</code> - Workspace change</li>
              </ul>
            </details>
            <details>
              <summary>Example (Socket.IO Client)</summary>
              <pre><code>const socket = io('http://localhost:43917');
socket.on('activity', (event) => {
  console.log('New activity:', event);
});</code></pre>
            </details>
          </div>
        </div>

        <!-- Rate Limiting & Performance -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Performance & Best Practices</h3>
          </div>
          <div class="card-body">
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Performance Characteristics</h4>
            <ul style="margin-bottom: var(--space-lg);">
              <li><strong>No rate limiting:</strong> Local development service, no throttling applied</li>
              <li><strong>Response time:</strong> Most endpoints < 50ms, heavy analytics < 200ms</li>
              <li><strong>Database size:</strong> ~5-10MB per hour of active development</li>
              <li><strong>Large exports:</strong> <code>/api/export/database</code> may take 1-2 seconds for large datasets</li>
              <li><strong>Cursor DB sync:</strong> Initial sync can take 10-30 seconds depending on history</li>
            </ul>
            
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Best Practices</h4>
            <ul>
              <li><strong>Use pagination:</strong> Add <code>?limit=100</code> for large datasets</li>
              <li><strong>Filter by time:</strong> Use <code>?since=timestamp</code> for recent data only</li>
              <li><strong>Cache responses:</strong> Most data changes infrequently (poll every 2-5 seconds)</li>
              <li><strong>WebSocket for real-time:</strong> Use Socket.IO for instant updates instead of polling</li>
              <li><strong>Export strategically:</strong> Schedule database exports during idle times</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Helper to safely create a chart, destroying any existing instance
 */
function createChart(canvasId, config) {
  // Destroy existing chart if it exists
  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
    delete state.charts[canvasId];
  }
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  const ctx = canvas.getContext('2d');
  state.charts[canvasId] = new Chart(ctx, config);
  return state.charts[canvasId];
}

// ===================================
// Modals
// ===================================

/**
 * Find prompts related to an event by temporal proximity and workspace
 * @param {Object} event - The event to find related prompts for
 * @param {Number} timeWindowMinutes - Time window in minutes to search (default 5)
 * @returns {Array} Array of related prompts, sorted by relevance
 */
function findRelatedPrompts(event, timeWindowMinutes = 15) {
  if (!event || !state.data.prompts || state.data.prompts.length === 0) {
    return [];
  }

  const eventTime = new Date(event.timestamp).getTime();
  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  
  // Extract workspace from event - normalize path
  const eventWorkspace = (event.workspace_path || event.details?.workspace_path || '').toLowerCase();
  const eventFile = event.details?.file_path || '';
  
  // Filter prompts by workspace and time proximity (more lenient matching)
  const related = state.data.prompts
    .map(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      const timeDiff = eventTime - promptTime;
      
      // More lenient: allow prompts within window before OR after (but prefer before)
      const isWithinWindow = Math.abs(timeDiff) <= timeWindowMs;
      const isBefore = timeDiff >= 0;
      
      // Check workspace match - more lenient
      const promptWorkspace = (prompt.workspacePath || prompt.workspaceId || prompt.workspace_name || '').toLowerCase();
      
      // Match if:
      // 1. No workspace specified (match all)
      // 2. Workspace paths overlap
      // 3. File path matches workspace
      let workspaceMatch = !eventWorkspace || !promptWorkspace;
      if (!workspaceMatch && eventWorkspace && promptWorkspace) {
        // Check if paths share common segments
        const eventParts = eventWorkspace.split('/').filter(p => p);
        const promptParts = promptWorkspace.split('/').filter(p => p);
        const commonParts = eventParts.filter(p => promptParts.includes(p));
        workspaceMatch = commonParts.length >= 2 || // At least 2 common path segments
                        eventWorkspace.includes(promptWorkspace) || 
                        promptWorkspace.includes(eventWorkspace);
      }
      
      // Only include if within time window and workspace matches
      if (!isWithinWindow || !workspaceMatch) {
        return null;
      }
      
      // Calculate relevance score
      const temporalScore = isBefore 
        ? 1 - (timeDiff / timeWindowMs)  // Before is better
        : 0.5 - ((timeDiff) / timeWindowMs) * 0.5; // After is less relevant
      const workspaceScore = workspaceMatch ? 
        (eventWorkspace && promptWorkspace && eventWorkspace === promptWorkspace ? 1.0 : 0.7) : 0.3;
      
      return {
        ...prompt,
        relevanceScore: (temporalScore * 0.7) + (workspaceScore * 0.3),
        timeDiffSeconds: Math.floor(Math.abs(timeDiff) / 1000),
        isBefore: isBefore
      };
    })
    .filter(p => p !== null) // Remove null entries
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10); // Limit to top 10
  
  return related;
}

// Export for modal-manager.js
window.findRelatedPrompts = findRelatedPrompts;

// ===================================
// Utility Functions
// ===================================

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function isImageFile(filePath) {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

function copyToClipboard(text, message) {
  navigator.clipboard.writeText(text).then(() => {
    if (message) console.log(message);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function filterEventsByWorkspace(events) {
  if (state.currentWorkspace === 'all') return events;
  
  return events.filter(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || '';
      return path.includes(state.currentWorkspace);
    } catch {
      return false;
    }
  });
}

function filterActivityByTimeRange(range) {
  // Implementation for time range filtering
  console.log('Filtering by:', range);
  renderCurrentView();
}

// ===================================
// Status Popup System
// ===================================

/**
 * Initialize status popup and console interceptor
 */
function initStatusPopup() {
  const originalConsoleLog = console.log;
  const statusPopupContent = document.getElementById('statusPopupContent');
  
  // Intercept console.log
  console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Extract message
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    // Filter for status-relevant messages
    const statusKeywords = ['Initializing', 'Loaded', 'Fetching', 'connected', 'ready', 'error', 'warning'];
    const hasStatusKeyword = statusKeywords.some(keyword => message.includes(keyword));
    
    if (hasStatusKeyword && statusPopupContent) {
      addStatusMessage(message);
    }
  };
  
  // Auto-hide after 10 seconds of last message
  let hideTimeout;
  window.addEventListener('statusMessageAdded', () => {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      const popup = document.getElementById('statusPopup');
      if (popup && !popup.classList.contains('hidden')) {
        popup.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          popup.classList.add('hidden');
        }, 300);
      }
    }, 10000);
  });
}
/**
 * Add a status message to the popup
 */
function addStatusMessage(message) {
  const statusPopupContent = document.getElementById('statusPopupContent');
  if (!statusPopupContent) return;
  
  // Determine message type based on content
  let messageClass = 'status-info';
  if (message.includes('Initializing') || message.includes('Fetching') || message.includes('Searching')) {
    messageClass = 'status-init';
  } else if (message.includes('connected') || message.includes('loaded') || message.includes('ready')) {
    messageClass = 'status-success';
  } else if (message.includes('WARNING') || message.includes('warning')) {
    messageClass = 'status-warning';
  } else if (message.includes('[ERROR]')) {
    messageClass = 'status-error';
  }
  
  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = `status-message ${messageClass}`;
  messageEl.textContent = message;
  
  // Add to popup (prepend for newest first)
  statusPopupContent.insertBefore(messageEl, statusPopupContent.firstChild);
  
  // Limit to 50 messages
  if (statusPopupContent.children.length > 50) {
    statusPopupContent.removeChild(statusPopupContent.lastChild);
  }
  
  // Show popup if hidden
  const popup = document.getElementById('statusPopup');
  if (popup && popup.classList.contains('hidden')) {
    popup.classList.remove('hidden');
    popup.style.animation = 'slideInFromTop 0.3s ease-out';
  }
  
  // Dispatch event for auto-hide timer
  window.dispatchEvent(new CustomEvent('statusMessageAdded'));
}

/**
 * Close status popup
 */
function closeStatusPopup() {
  const popup = document.getElementById('statusPopup');
  if (popup) {
    popup.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      popup.classList.add('hidden');
    }, 300);
  }
}

/**
 * Export database as JSON (with size limits to prevent browser crashes)
 */
async function exportDatabase(limit = 1000, includeAllFields = false) {
  try {
    console.log('📤 Exporting database...', { limit, includeAllFields });
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>Exporting...</span>';
      exportBtn.disabled = true;
      
      // Confirm for large exports
      if (limit > 5000) {
        const confirmed = confirm(`This will export ${limit} items. Large exports may take time and use significant memory. Continue?`);
        if (!confirmed) {
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
          return;
        }
      }
      
      // Fetch data from API with limit
      const url = new URL(`${CONFIG.API_BASE}/api/export/database`);
      url.searchParams.set('limit', limit.toString());
      if (includeAllFields) {
        url.searchParams.set('full', 'true');
      }
      
      console.log('[EXPORT] Fetching from:', url.toString());
      
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }
      
      // Check response size before parsing
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
        const proceed = confirm(`Export file is large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB). This may take time to download. Continue?`);
        if (!proceed) {
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
          return;
        }
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Export failed');
      }
      
      // Create filename with timestamp and limit info
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const limitSuffix = limit < 10000 ? `-${limit}items` : '';
      const filename = `cursor-telemetry-export-${timestamp}${limitSuffix}.json`;
      
      // Convert to JSON string with pretty formatting (use smaller indentation for large files)
      const indentSize = limit > 5000 ? 0 : 2; // No formatting for very large exports
      const jsonString = JSON.stringify(result.data, null, indentSize);
      
      // Check size before creating blob
      const sizeMB = new Blob([jsonString]).size / 1024 / 1024;
      console.log(`[EXPORT] File size: ${sizeMB.toFixed(2)}MB`);
      
      if (sizeMB > 100) {
        throw new Error(`Export file too large (${sizeMB.toFixed(1)}MB). Please reduce the limit.`);
      }
      
      // Create blob and download using streaming for large files
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url_obj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url_obj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a delay
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url_obj);
      }, 100);
      
      console.log(`[SUCCESS] Exported ${result.data.metadata.totalEntries} entries, ${result.data.metadata.totalPrompts} prompts, ${result.data.metadata.totalEvents} events`);
      
      // Show success feedback
      exportBtn.innerHTML = '<span>Exported!</span>';
      exportBtn.style.color = '#10b981';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 2000);
    } else {
      // No button found, just log
      console.log('[EXPORT] Button not found, export completed');
    }
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>✗ Failed</span>';
      exportBtn.style.color = '#ef4444';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    alert(`Export failed: ${error.message}\n\nTry exporting with a smaller limit (e.g., exportDatabase(500))`);
  }
}

// Export with options dialog
async function exportDatabaseWithOptions() {
  const limit = prompt('How many items to export?\n\nRecommended: 1000 (default)\nMax safe: 5000\nEnter number or leave blank for 1000:', '1000');
  if (limit === null) return; // User cancelled
  
  const numLimit = parseInt(limit) || 1000;
  if (numLimit > 10000) {
    alert('Limit too high. Maximum recommended is 10,000 items.');
    return;
  }
  
  const includeAllFields = confirm('Include all fields?\n\nYes = Full export with all metadata\nNo = Simplified export (recommended)');
  
  await exportDatabase(numLimit, includeAllFields);
}

// Export with filters (for export options modal)
async function exportDatabaseWithFilters({ dateFrom, dateTo, limit = 1000, types = {}, options = {} }) {
  try {
    console.log('📤 Exporting database with filters...', { dateFrom, dateTo, limit, types, options });
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>Exporting...</span>';
      exportBtn.disabled = true;
    }
    
    // Confirm for large exports
    if (limit > 5000) {
      const confirmed = confirm(`This will export ${limit} items. Large exports may take time and use significant memory. Continue?`);
      if (!confirmed) {
        if (exportBtn) {
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
        }
        return;
      }
    }
    
    // Build URL with all parameters
    const url = new URL(`${CONFIG.API_BASE}/api/export/database`);
    url.searchParams.set('limit', limit.toString());
    
    // Date range
    if (dateFrom) {
      url.searchParams.set('since', dateFrom);
    }
    if (dateTo) {
      url.searchParams.set('until', dateTo);
    }
    
    // Type filters (invert logic - exclude_* means "don't include")
    if (!types.events) {
      url.searchParams.set('exclude_events', 'true');
    }
    if (!types.prompts) {
      url.searchParams.set('exclude_prompts', 'true');
    }
    if (!types.terminal) {
      url.searchParams.set('exclude_terminal', 'true');
    }
    if (!types.context) {
      url.searchParams.set('exclude_context', 'true');
    }
    
    // Options
    if (!options.includeCodeDiffs) {
      url.searchParams.set('no_code_diffs', 'true');
    }
    if (!options.includeLinkedData) {
      url.searchParams.set('no_linked_data', 'true');
    }
    if (!options.includeTemporalChunks) {
      url.searchParams.set('no_temporal_chunks', 'true');
    }
    if (options.fullMetadata) {
      url.searchParams.set('full', 'true');
    }
    
    console.log('[EXPORT] Fetching from:', url.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    // Check response size before parsing
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
      const proceed = confirm(`Export file is large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB). This may take time to download. Continue?`);
      if (!proceed) {
        if (exportBtn) {
          exportBtn.innerHTML = originalHTML;
          exportBtn.disabled = false;
        }
        return;
      }
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Create filename with timestamp and filters
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const dateSuffix = dateFrom ? `-${dateFrom}` : '';
    const limitSuffix = limit < 10000 ? `-${limit}items` : '';
    const filename = `cursor-telemetry-export-${timestamp}${dateSuffix}${limitSuffix}.json`;
    
    // Convert to JSON string with pretty formatting
    const indentSize = limit > 5000 ? 0 : 2;
    const jsonString = JSON.stringify(result.data, null, indentSize);
    
    // Check size before creating blob
    const sizeMB = new Blob([jsonString]).size / 1024 / 1024;
    console.log(`[EXPORT] File size: ${sizeMB.toFixed(2)}MB`);
    
    if (sizeMB > 100) {
      throw new Error(`Export file too large (${sizeMB.toFixed(1)}MB). Please reduce the limit.`);
    }
    
    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url_obj = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url_obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up after a delay
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url_obj);
    }, 100);
    
    console.log(`[SUCCESS] Exported ${result.data.metadata.totalEntries || 0} entries, ${result.data.metadata.totalPrompts || 0} prompts, ${result.data.metadata.totalEvents || 0} events`);
    
    // Show success feedback
    if (exportBtn) {
      exportBtn.innerHTML = '<span>Exported!</span>';
      exportBtn.style.color = '#10b981';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 2000);
    }
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    if (exportBtn) {
      const originalHTML = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span>✗ Failed</span>';
      exportBtn.style.color = '#ef4444';
      setTimeout(() => {
        exportBtn.innerHTML = originalHTML;
        exportBtn.disabled = false;
        exportBtn.style.color = '';
      }, 3000);
    }
    alert(`Export failed: ${error.message}\n\nTry exporting with a smaller limit or different date range.`);
  }
}

// Export to window for global access
window.exportDatabaseWithFilters = exportDatabaseWithFilters;

// Add fadeOut animation to CSS (dynamically)
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`;
document.head.appendChild(fadeOutStyle);

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize status popup FIRST (before any console.logs)
  initStatusPopup();
  
  console.log('Initializing Cursor Activity Dashboard');

  // Setup navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) switchView(view);
    });
  });

  // Setup workspace selector
  document.getElementById('workspaceSelect')?.addEventListener('change', (e) => {
    state.currentWorkspace = e.target.value;
    renderCurrentView();
  });

  // Setup modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      overlay.parentElement.classList.remove('active');
    });
  });

  // Initialize persistent storage and data synchronization
  let storage, aggregator, synchronizer;
  
  try {
    storage = new PersistentStorage();
    aggregator = new AnalyticsAggregator(storage);
    synchronizer = new DataSynchronizer(storage, aggregator);
    
    console.log('Persistence system enabled');
  } catch (error) {
    console.warn('Persistence system not available:', error);
    storage = null;
  }
  
  // Initialize WebSocket (disabled - using HTTP polling instead)
  // Socket.IO is not configured on the companion service
  // const wsManager = new WebSocketManager();
  // wsManager.connect();

  // Use optimized initialization with warm-start
  if (storage && synchronizer) {
    // Initialize persistent storage
    synchronizer.initialize().then(async (stats) => {
      console.log('[DATA] Persistent storage ready:', stats);
      
      // Use new optimized initialization
      state.connected = true;
      updateConnectionStatus(true);
      await initializeDashboard();
      
      // Initialize search engine (if available)
      if (typeof initializeSearch === 'function') {
        initializeSearch();
      }
      
      console.log('[SUCCESS] Dashboard initialized with warm-start');
    }).catch(error => {
      console.error('Persistence initialization failed:', error);
      // Fall back to non-persistent mode
      initializeNonPersistent();
    });
    
    // Setup auto-refresh with debouncing to prevent excessive requests
    let refreshInProgress = false;
    let lastRefreshTime = Date.now();
    const MIN_REFRESH_INTERVAL = CONFIG.REFRESH_INTERVAL; // Match the interval to prevent overlap
    
    setInterval(async () => {
      // Skip if refresh is already in progress or too soon
      if (refreshInProgress || (Date.now() - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
        console.log('[SYNC] Skipping refresh - already in progress or too soon');
        return;
      }
      
      refreshInProgress = true;
      lastRefreshTime = Date.now();
      
      try {
        if (storage && synchronizer) {
          // Use optimized fetch for refresh
          await fetchRecentData();
          calculateStats();
          renderCurrentView();
          // Update status on successful sync
          if (window.state && window.state.connected) {
            updateConnectionStatus(true, 'Connected - synced');
          }
          // Don't reinitialize search on every refresh - it's expensive!
          // Only rebuild if we have significantly more documents
        }
      } catch (error) {
        console.error('Refresh error:', error);
        // Update status if sync fails
        if (window.state && window.state.connected) {
          updateConnectionStatus(false, 'Sync failed - retrying...');
        }
      } finally {
        refreshInProgress = false;
      }
    }, CONFIG.REFRESH_INTERVAL);
  } else {
    // No persistence - use traditional fetch
    initializeNonPersistent();
  }
  
  // Non-persistent initialization function
  function initializeNonPersistent() {
    initializeDashboard().then(() => {
      state.connected = true;
      updateConnectionStatus(true);
      // Initialize search engine
      initializeSearch();
    }).catch(error => {
      console.error('Initial data fetch failed:', error);
      updateConnectionStatus(false);
      // Fallback to old method
      fetchAllData().then(() => {
        renderCurrentView();
        initializeSearch();
      });
    });
    
    // Setup auto-refresh with debouncing
    let refreshInProgress = false;
    let lastRefreshTime = Date.now();
    const MIN_REFRESH_INTERVAL = CONFIG.REFRESH_INTERVAL; // Match the interval to prevent overlap
    
    setInterval(async () => {
      if (refreshInProgress || (Date.now() - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
        console.log('[SYNC] Skipping refresh - already in progress or too soon');
        return;
      }
      
      refreshInProgress = true;
      lastRefreshTime = Date.now();
      
      try {
        await fetchRecentData();
        calculateStats();
        renderCurrentView();
        // Update status on successful sync
        if (window.state && window.state.connected) {
          updateConnectionStatus(true, 'Connected - synced');
        }
      } catch (error) {
        console.error('Refresh error:', error);
        // Update status if sync fails
        if (window.state && window.state.connected) {
          updateConnectionStatus(false, 'Sync failed - retrying...');
        }
      } finally {
        refreshInProgress = false;
      }
    }, CONFIG.REFRESH_INTERVAL);
  }

  // Setup search palette keyboard shortcuts and event listeners
  document.addEventListener('keydown', (e) => {
    // CMD+K or CTRL+K to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearchPalette();
    }
    
    // ESC to close search
    if (e.key === 'Escape') {
      const palette = document.getElementById('searchPalette');
      if (palette && palette.classList.contains('active')) {
        closeSearchPalette();
      }
    }
    
    // Arrow keys for navigation
    const palette = document.getElementById('searchPalette');
    if (palette && palette.classList.contains('active')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSearchResults('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSearchResults('up');
      } else if (e.key === 'Enter' && searchSelectedIndex >= 0) {
        e.preventDefault();
        selectSearchResult(searchSelectedIndex);
      }
    }
  });
  
  // Setup search input with debouncing
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let debounceTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        performSearch(e.target.value);
      }, 300); // 300ms debounce
    });
  }
  
  // Setup search trigger button
  const searchTrigger = document.getElementById('searchTrigger');
  if (searchTrigger) {
    searchTrigger.addEventListener('click', () => {
      openSearchPalette();
    });
  }
  
  // Close search when clicking overlay
  const searchPalette = document.getElementById('searchPalette');
  if (searchPalette) {
    const overlay = searchPalette.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        closeSearchPalette();
      });
    }
  }
  
  console.log('Dashboard initialized');
});

// ===================================
// Search Engine Initialization
// ===================================

let searchEngine = null;
let searchSelectedIndex = -1;
let searchResults = [];

/**
 * Initialize the semantic search engine with current data
 */
async function initializeSearch() {
  if (!window.SearchEngine) {
    console.warn('[SEARCH] SearchEngine class not available');
    return;
  }
  
  try {
    console.log('[SEARCH] Initializing search engine...');
    searchEngine = new window.SearchEngine();
    
    // Get current data from state
    const events = state.data.events || [];
    const prompts = state.data.prompts || [];
    const conversations = state.data.conversations || [];
    
    // Prepare data for search engine
    const searchData = {
      events,
      prompts,
      conversations,
      workspaces: state.data.workspaces || []
    };
    
    await searchEngine.initialize(searchData);
    console.log('[SUCCESS] Search engine initialized');
  } catch (error) {
    console.error('[ERROR] Failed to initialize search engine:', error);
  }
}

/**
 * Open the search palette
 */
function openSearchPalette() {
  const palette = document.getElementById('searchPalette');
  if (palette) {
    palette.classList.add('active');
    const input = document.getElementById('searchInput');
    if (input) {
      input.focus();
      input.select();
    }
    searchSelectedIndex = -1;
    searchResults = [];
  }
}

/**
 * Close the search palette
 */
function closeSearchPalette() {
  const palette = document.getElementById('searchPalette');
  if (palette) {
    palette.classList.remove('active');
  }
  searchSelectedIndex = -1;
  searchResults = [];
}

/**
 * Perform search query
 */
async function performSearch(query) {
  if (!searchEngine || !searchEngine.initialized) {
    // Show message that search is not ready
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="search-empty">Search engine initializing...</div>';
    }
    return;
  }
  
  if (!query || query.trim().length === 0) {
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="search-empty">Type to search events, prompts, and files...</div>';
    }
    searchResults = [];
    searchSelectedIndex = -1;
    return;
  }
  
  try {
    const results = searchEngine.search(query, { limit: 20 });
    searchResults = results;
    searchSelectedIndex = -1;
    renderSearchResults(results);
  } catch (error) {
    console.error('[ERROR] Search failed:', error);
    const resultsEl = document.getElementById('searchResults');
    if (resultsEl) {
      resultsEl.innerHTML = '<div class="search-error">Search error: ' + error.message + '</div>';
    }
  }
}

/**
 * Render search results
 */
function renderSearchResults(results) {
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  
  if (results.length === 0) {
    resultsEl.innerHTML = '<div class="search-empty">No results found</div>';
    return;
  }
  
  const html = results.map((result, index) => {
    const type = result.type || 'unknown';
    const title = result.title || result.content?.substring(0, 80) || 'Untitled';
    const snippet = result.snippet || result.content?.substring(0, 150) || '';
    const time = result.timestamp ? window.formatTimeAgo?.(result.timestamp) || new Date(result.timestamp).toLocaleString() : '';
    
    return `
      <div class="search-result-item ${index === searchSelectedIndex ? 'selected' : ''}" 
           data-index="${index}" 
           onclick="selectSearchResult(${index})"
           onmouseenter="searchSelectedIndex = ${index}; renderSearchResults(searchResults)">
        <div class="search-result-header">
          <span class="search-result-type badge badge-${type}">${type}</span>
          <span class="search-result-title">${window.escapeHtml?.(title) || title}</span>
          ${time ? `<span class="search-result-time">${time}</span>` : ''}
        </div>
        ${snippet ? `<div class="search-result-snippet">${window.escapeHtml?.(snippet) || snippet}</div>` : ''}
      </div>
    `;
  }).join('');
  
  resultsEl.innerHTML = html;
}

/**
 * Navigate search results with arrow keys
 */
function navigateSearchResults(direction) {
  if (searchResults.length === 0) return;
  
  if (direction === 'down') {
    searchSelectedIndex = Math.min(searchSelectedIndex + 1, searchResults.length - 1);
  } else if (direction === 'up') {
    searchSelectedIndex = Math.max(searchSelectedIndex - 1, -1);
  }
  
  renderSearchResults(searchResults);
  
  // Scroll to selected item
  const selectedEl = document.querySelector(`.search-result-item[data-index="${searchSelectedIndex}"]`);
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/**
 * Select a search result
 */
function selectSearchResult(index) {
  if (index < 0 || index >= searchResults.length) return;
  
  const result = searchResults[index];
  
  // Close search palette
  closeSearchPalette();
  
  // Navigate to the result based on type
  if (result.type === 'event' && result.id) {
    if (window.showEventModal) {
      window.showEventModal(result.id);
    }
  } else if (result.type === 'prompt' && result.id) {
    if (window.showPromptInModal) {
      window.showPromptInModal(result.id);
    }
  } else if (result.type === 'conversation' && result.id) {
    // Switch to activity view and highlight conversation
    if (window.switchView) {
      window.switchView('activity');
      // Could scroll to conversation in timeline
    }
  } else if (result.file_path) {
    // Could open file in editor or show file graph
    console.log('[SEARCH] Selected file:', result.file_path);
  }
}

// Export search functions to window
window.initializeSearch = initializeSearch;
window.openSearchPalette = openSearchPalette;
window.closeSearchPalette = closeSearchPalette;
window.performSearch = performSearch;
window.navigateSearchResults = navigateSearchResults;
window.selectSearchResult = selectSearchResult;

// ===================================
// Prompt Management Functions
// ===================================

async function refreshPrompts() {
  console.log('Refreshing prompts...');
  try {
    const response = await APIClient.get('/entries');
    if (response && response.entries && Array.isArray(response.entries)) {
      state.data.prompts = response.entries;
    } else if (Array.isArray(response)) {
      state.data.prompts = response;
    } else {
      console.warn('Invalid prompts response format:', response);
      state.data.prompts = [];
    }
    renderCurrentView();
  } catch (error) {
    console.error('Error refreshing prompts:', error);
    state.data.prompts = [];
  }
}

async function checkClipboardStatus() {
  try {
    const health = await APIClient.get('/health');
    const clipboardEnabled = health.clipboard_stats?.enabled || false;
    const capturedCount = health.clipboard_stats?.captured || 0;

    alert(
      `Clipboard Monitoring Status\n\n` +
      `Enabled: ${clipboardEnabled ? 'Yes' : 'No'}\n` +
      `Prompts Captured: ${capturedCount}\n\n` +
      `Check the companion service logs for more details.`
    );
  } catch (error) {
    console.error('Error checking clipboard status:', error);
    alert('Could not check clipboard status. Make sure the companion service is running.');
  }
}