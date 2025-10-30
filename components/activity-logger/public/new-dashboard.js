/**
 * Cursor Activity Dashboard - Main Application
 * Clean, modern implementation with full feature support
 */

// ===================================
// Configuration & Constants
// ===================================

// Use external config (from config.js) if available, otherwise use defaults
const EXTERNAL_CONFIG = window.CONFIG || {};
const DASHBOARD_CONFIG = {
  API_BASE: EXTERNAL_CONFIG.API_BASE_URL || 'http://localhost:43917',
  WS_URL: EXTERNAL_CONFIG.WS_URL || 'ws://localhost:43917',
  REFRESH_INTERVAL: 120000,  // 2 minutes to prevent request overload (down from 30s)
  ENABLE_TF_IDF: false, // Disable TF-IDF by default to save memory
  ENABLE_SEMANTIC_SEARCH: false, // Disable semantic analysis by default
  MAX_SEARCH_RESULTS: 50, // Limit search results to prevent memory issues
  CHART_COLORS: {
    primary: '#8B5CF6',
    secondary: '#6366F1',
    accent: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  }
};

// Use DASHBOARD_CONFIG as CONFIG for compatibility
const CONFIG = DASHBOARD_CONFIG;

// ===================================
// State Management
// ===================================

const state = {
  connected: false,
  currentView: 'overview',
  currentWorkspace: 'all',
  data: {
    events: [],
    entries: [],
    threads: [],
    prompts: [],
    terminalCommands: [],
    workspaces: [],
    systemResources: [],
    gitData: [],
    ideState: null
  },
  stats: {
    sessions: 0,
    fileChanges: 0,
    aiInteractions: 0,
    codeChanged: 0,
    avgContext: 0,
    terminalCommands: 0
  },
  sequence: 0,
  socket: null,
  charts: {} // Track active Chart.js instances
};

// ===================================
// API Client
// ===================================

// ===================================
// Performance: Request Debouncing
// ===================================

const debouncedRequests = new Map();

function debounce(fn, delay = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => resolve(fn.apply(this, args)), delay);
    });
  };
}

class APIClient {
  static async get(endpoint, options = {}) {
    const timeout = options.timeout || 20000; // 20 second default timeout (increased from 10s)
    const retries = options.retries || 1; // Retry up to 1 time (reduced to avoid long waits)
    
    // Debounce repeated requests to the same endpoint
    const cacheKey = endpoint + JSON.stringify(options);
    if (debouncedRequests.has(cacheKey)) {
      console.log(`[DEBOUNCE] Skipping duplicate request to ${endpoint}`);
      return debouncedRequests.get(cacheKey);
    }
    
    const requestPromise = (async () => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
            signal: controller.signal,
            ...options
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return await response.json();
        } catch (error) {
          const isLastAttempt = attempt === retries;
          
          if (isLastAttempt) {
            console.error(`[ERROR] API (${endpoint}) failed after ${retries + 1} attempts:`, error.message);
            throw error;
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.warn(`[WARNING] API (${endpoint}) attempt ${attempt + 1} failed, retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    })();
    
    // Cache the promise for deduplication
    debouncedRequests.set(cacheKey, requestPromise);
    setTimeout(() => debouncedRequests.delete(cacheKey), 1000);
    
    return requestPromise;
  }

  static async post(endpoint, data, options = {}) {
    const timeout = options.timeout || 10000;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
        signal: controller.signal,
        ...options
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[ERROR] API POST (${endpoint}):`, error.message);
      throw error;
    }
  }
}

// ===================================
// WebSocket Manager
// ===================================

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscriptions = new Set();
    this.lastMessageId = 0;
    
    // Restore connection state from localStorage
    this.restoreConnectionState();
  }

  restoreConnectionState() {
    try {
      const saved = localStorage.getItem('ws_connection_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.subscriptions = new Set(state.subscriptions || []);
        this.lastMessageId = state.lastMessageId || 0;
        console.log('[SYNC] Restored WebSocket state:', {
          subscriptions: this.subscriptions.size,
          lastMessageId: this.lastMessageId
        });
      }
    } catch (error) {
      console.warn('[WARNING] Failed to restore WebSocket state:', error);
    }
  }

  saveConnectionState() {
    try {
      const state = {
        subscriptions: Array.from(this.subscriptions),
        lastMessageId: this.lastMessageId,
        timestamp: Date.now()
      };
      localStorage.setItem('ws_connection_state', JSON.stringify(state));
    } catch (error) {
      console.warn('[WARNING] Failed to save WebSocket state:', error);
    }
  }

  connect() {
    try {
      this.socket = io(CONFIG.API_BASE, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        // Resume from last known state
        query: {
          lastMessageId: this.lastMessageId
        }
      });

      this.socket.on('connect', () => {
        console.log('[SUCCESS] WebSocket connected');
        state.connected = true;
        updateConnectionStatus(true);
        this.reconnectAttempts = 0;
        
        // Auto-restore subscriptions after reconnect
        this.restoreSubscriptions();
      });

      this.socket.on('disconnect', () => {
        console.log('[ERROR] WebSocket disconnected');
        state.connected = false;
        updateConnectionStatus(false);
        
        // Save state before disconnect
        this.saveConnectionState();
      });

      this.socket.on('activityUpdate', (data) => {
        console.log('Activity update:', data);
        if (data.id) this.lastMessageId = Math.max(this.lastMessageId, data.id);
        handleRealtimeUpdate(data);
        this.saveConnectionState();
      });

      this.socket.on('terminal-command', (cmd) => {
        console.log('Terminal command:', cmd);
        handleTerminalCommand(cmd);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[ERROR] WebSocket connection error:', error);
        this.reconnectAttempts++;
      });

      state.socket = this.socket;
    } catch (error) {
      console.error('[ERROR] Failed to initialize WebSocket:', error);
    }
  }

  restoreSubscriptions() {
    // Re-subscribe to all previously active subscriptions
    this.subscriptions.forEach(channel => {
      console.log(`[SYNC] Re-subscribing to: ${channel}`);
      this.socket.emit('subscribe', channel);
    });
  }

  subscribe(channel) {
    this.subscriptions.add(channel);
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe', channel);
    }
    this.saveConnectionState();
  }

  unsubscribe(channel) {
    this.subscriptions.delete(channel);
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe', channel);
    }
    this.saveConnectionState();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

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
    await loadFromCache();
    
    // Step 2: Check server version to see if we need to sync
    const serverHealth = await APIClient.get('/health');
    const serverSequence = serverHealth.sequence || 0;
    
    const cacheStale = await persistentStorage.isCacheStale(serverSequence);
    
    if (cacheStale) {
      console.log('📥 Cache stale, fetching updates...');
      await fetchRecentData();
      await persistentStorage.updateServerSequence(serverSequence);
    } else {
      console.log('[SUCCESS] Cache up-to-date, using cached data');
    }
    
    // Step 3: Render initial UI with cached/recent data
    calculateStats();
    await renderCurrentView();
    
    // Step 4: Background: fetch older history if needed
    setTimeout(() => {
      fetchOlderHistory();
    }, 3000);
    
    // Step 5: Heavy analytics will be loaded on-demand via analyticsManager
    console.log('⏳ Heavy analytics deferred until idle/tab focus');
    
  } catch (error) {
    console.error('Initialization error:', error);
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
  const windowHours = 24 * 365; // 1 year of data
  const windowLabel = windowHours >= 24 ? `${windowHours / 24}d` : `${windowHours}h`;
  const startTime = Date.now() - (windowHours * 60 * 60 * 1000); // ✅ FIX: Define startTime
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
    console.log('[DEBUG] Activity response:', { hasData: !!activity.data, isArray: Array.isArray(activity.data), length: activity.data?.length });
    
    if (activity.data && Array.isArray(activity.data)) {
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
    
    // ✅ Calculate stats after fetching data
    console.log(`[SYNC] Fetch complete. Events: ${state.data.events.length}, Prompts: ${state.data.prompts.length}`);
    calculateStats();
    
    // 🔧 FIX: Re-render current view to update charts with fresh data
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

function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;

  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');

  if (connected) {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
    text.textContent = 'Connected';
  } else {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
    text.textContent = 'Disconnected';
  }
}

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

function renderCurrentView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  switch (state.currentView) {
    case 'overview':
      renderOverviewView(container);
      break;
    case 'activity':
      renderActivityView(container);
      break;
    case 'analytics':
      renderAnalyticsView(container);
      break;
    case 'filegraph':
      renderFileGraphView(container);
      break;
    case 'navigator':
      renderNavigatorView(container);
      break;
    case 'todos':
      renderTodoView(container);
      break;
    case 'system':
      renderSystemView(container);
      break;
    case 'api-docs':
      renderAPIDocsView(container);
      break;
    default:
      container.innerHTML = '<div class="empty-state">View not found</div>';
  }
}

// ===================================
// Overview View
// ===================================

function renderOverviewView(container) {
  const recentEvents = state.data.events.slice(-10).reverse();

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-xl);">
      
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

function renderUnifiedTimeline(items) {
  // Group prompts by conversation for threading
  const conversationMap = new Map();
  const nonPromptItems = [];
  
  items.forEach(item => {
    if (item.itemType === 'prompt') {
      // Check if this is a conversation thread or a message
      const isThread = item.type === 'conversation-thread' && !item.parentConversationId;
      const conversationId = isThread ? item.composerId : (item.parentConversationId || item.composerId);
      
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
      nonPromptItems.push(item);
    }
  });
  
  // Convert conversations to timeline items
  const conversationItems = Array.from(conversationMap.values()).map(conv => ({
    itemType: 'conversation',
    conversation: conv,
    sortTime: conv.timestamp
  }));
  
  // Merge and sort all items
  const allItems = [...conversationItems, ...nonPromptItems]
    .sort((a, b) => b.sortTime - a.sortTime);
  
  return `
    <div class="timeline">
      ${allItems.map(item => {
        if (item.itemType === 'event') {
          return renderTimelineItem(item);
        } else if (item.itemType === 'terminal') {
          return renderTerminalTimelineItem(item);
        } else if (item.itemType === 'conversation') {
          return renderConversationThread(item.conversation);
        } else {
          return renderPromptTimelineItem(item);
        }
      }).join('')}
    </div>
  `;
}

function renderConversationThread(conversation) {
  const { thread, messages } = conversation;
  const title = thread?.conversationTitle || thread?.text || 'Untitled Conversation';
  const time = formatTimeAgo(thread?.timestamp || conversation.timestamp);
  const messageCount = messages.length;
  const threadId = thread?.composerId || `conv-${Date.now()}`;
  
  // Sort messages chronologically
  const sortedMessages = messages.sort((a, b) => a.sortTime - b.sortTime);
  
  return `
    <div class="timeline-item conversation-timeline-item" style="border-left: 3px solid var(--color-primary);">
      <div class="timeline-content">
        <div class="timeline-header" style="cursor: pointer;" onclick="toggleConversationMessages('${threadId}')">
          <div class="timeline-title" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span id="conv-icon-${threadId}" style="transition: transform 0.2s;">▶</span>
            <span style="font-weight: 600;">${escapeHtml(title)}</span>
            ${messageCount > 0 ? `<span style="color: var(--color-text-muted); font-size: var(--text-sm);">(${messageCount} messages)</span>` : ''}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
          <span class="badge badge-prompt">Conversation</span>
          ${thread?.workspaceName ? `<span class="badge">${thread.workspaceName}</span>` : ''}
          ${thread?.mode ? `<span class="badge" style="background: var(--color-primary); color: white;">${thread.mode}</span>` : ''}
        </div>
        
        <!-- Messages (initially hidden) -->
        <div id="conv-messages-${threadId}" style="display: none; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => renderConversationMessage(msg)).join('') : '<div style="color: var(--color-text-muted); font-size: var(--text-sm); padding: var(--space-sm);">No messages in this conversation yet</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderConversationMessage(message) {
  const isUser = message.messageRole === 'user';
  const icon = isUser ? '👤' : '🤖';
  const bgColor = isUser ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)';
  const time = formatTimeAgo(message.timestamp);
  const text = message.text || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  return `
    <div style="padding: var(--space-sm); margin-bottom: var(--space-xs); background: ${bgColor}; border-radius: var(--radius-sm); border-left: 3px solid ${isUser ? 'var(--color-primary)' : 'var(--color-accent)'};">
      <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs);">
        <span>${icon}</span>
        <span style="font-weight: 600; font-size: var(--text-sm);">${isUser ? 'You' : 'AI Assistant'}</span>
        <span style="color: var(--color-text-muted); font-size: var(--text-xs);">${time}</span>
        ${message.thinkingTimeSeconds ? `<span class="badge" style="background: var(--color-success); color: white;">⚡ ${message.thinkingTimeSeconds}s</span>` : ''}
      </div>
      <div style="font-size: var(--text-sm); color: var(--color-text); white-space: pre-wrap; word-break: break-word;">${escapeHtml(displayText)}</div>
      ${text.length > 300 ? `<button onclick="showEventModal('${message.id}')" style="margin-top: var(--space-xs); font-size: var(--text-xs); color: var(--color-primary); background: none; border: none; padding: 0; cursor: pointer; text-decoration: underline;">Read more</button>` : ''}
    </div>
  `;
}

function toggleConversationMessages(threadId) {
  const messagesDiv = document.getElementById(`conv-messages-${threadId}`);
  const icon = document.getElementById(`conv-icon-${threadId}`);
  
  if (messagesDiv && icon) {
    const isHidden = messagesDiv.style.display === 'none';
    messagesDiv.style.display = isHidden ? 'block' : 'none';
    icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
  }
}

function renderPromptTimelineItem(prompt) {
  const time = formatTimeAgo(prompt.timestamp);
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
    <div class="timeline-item prompt-timeline-item" onclick="showEventModal('${prompt.id}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span>${icon}</span>
            <span>${displayText}</span>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
          <span class="badge badge-prompt">${source}</span>
          ${prompt.workspaceName ? `<span class="badge">${prompt.workspaceName}</span>` : prompt.workspaceId ? `<span class="badge">${prompt.workspaceId.substring(0, 8)}</span>` : ''}
          ${prompt.composerId ? `<span class="badge">Composer</span>` : ''}
          ${prompt.contextUsage > 0 ? `<span class="badge" style="background: var(--color-warning); color: white;">${prompt.contextUsage.toFixed(1)}% context</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderTerminalTimelineItem(cmd) {
  const time = formatTimeAgo(cmd.timestamp);
  const commandText = cmd.command || 'Unknown command';
  const displayText = commandText.length > 80 ? commandText.substring(0, 80) + '...' : commandText;
  const isError = cmd.exit_code && cmd.exit_code !== 0;
  const icon = isError ? '[ERROR]' : '>';
  const source = cmd.source || 'terminal';
  
  return `
    <div class="timeline-item terminal-timeline-item ${isError ? 'error' : ''}" style="border-left-color: ${isError ? '#ef4444' : '#8b5cf6'}; cursor: pointer;" onclick="showTerminalModal('${cmd.id}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span>${icon}</span>
            <code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 3px; font-size: 13px;">${displayText}</code>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description" style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
          <span class="badge" style="background: #6366f1; color: white;">${source}</span>
          ${cmd.shell ? `<span class="badge">${cmd.shell}</span>` : ''}
          ${cmd.workspace ? `<span class="badge" style="font-size: 11px;">${cmd.workspace.split('/').pop()}</span>` : ''}
          ${isError ? `<span class="badge" style="background: #ef4444; color: white;">Exit ${cmd.exit_code}</span>` : ''}
          ${cmd.duration ? `<span class="badge">${cmd.duration}ms</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderTimelineItem(event) {
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
        promptBadge = `<span style="display: inline-flex; align-items: center; justify-content: center; background: var(--color-accent); color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; margin-left: 8px;" title="Has related AI prompts">AI</span>`;
      }
    }
    
    // Add context file indicators
    if (event.context) {
      const badges = [];
      
      // @ files indicator
      if (event.context.atFiles && event.context.atFiles.length > 0) {
        badges.push(`<span style="display: inline-flex; align-items: center; justify-content: center; background: #10b981; color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; margin-left: 4px;" title="${event.context.atFiles.length} @ referenced files">[FILE] ${event.context.atFiles.length}</span>`);
      }
      
      // Context files indicator
      const contextFileCount = (event.context.contextFiles?.attachedFiles?.length || 0) + 
                               (event.context.contextFiles?.codebaseFiles?.length || 0);
      if (contextFileCount > 0) {
        badges.push(`<span style="display: inline-flex; align-items: center; justify-content: center; background: #3b82f6; color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; margin-left: 4px;" title="${contextFileCount} context files">${contextFileCount} files</span>`);
      }
      
      // UI state indicator
      if (event.context.browserState && event.context.browserState.tabs && event.context.browserState.tabs.length > 0) {
        badges.push(`<span style="display: inline-flex; align-items: center; justify-content: center; background: #8b5cf6; color: white; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; margin-left: 4px;" title="${event.context.browserState.tabs.length} tabs open">[SYSTEM] ${event.context.browserState.tabs.length}</span>`);
      }
      
      contextIndicators = badges.join('');
    }
  } catch (e) {
    // Ignore errors in badge display
  }
  
  return `
    <div class="timeline-item" onclick="showEventModal('${event.id || event.timestamp}')">
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
    <div style="display: flex; flex-direction: column; gap: var(--space-md);">
      ${entries.map(entry => {
        // Get text from various possible fields
        const promptText = entry.prompt || entry.text || entry.preview || entry.content;
        const displayText = promptText ? truncate(promptText, 100) : 'Empty prompt';
        const source = entry.source || entry.method || 'unknown';
        
        return `
          <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); cursor: pointer; border-left: 3px solid var(--color-accent);" onclick="showThreadModal('${entry.id}')">
            <div style="font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-xs); line-height: 1.5;">
              ${escapeHtml(displayText)}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: var(--text-xs); color: var(--color-text-subtle);">
                ${new Date(entry.timestamp).toLocaleString()}
              </div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); padding: 2px var(--space-xs); background: var(--color-surface); border-radius: var(--radius-sm);">
                ${source}
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
    <div style="display: flex; flex-direction: column; gap: var(--space-md);">
      <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
        <span style="color: var(--color-text-muted);">Memory</span>
        <span style="color: var(--color-text); font-weight: 600;">${memory}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
        <span style="color: var(--color-text-muted);">CPU Time</span>
        <span style="color: var(--color-text); font-weight: 600;">${cpu}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0;">
        <span style="color: var(--color-text-muted);">Load Avg</span>
        <span style="color: var(--color-text); font-weight: 600;">${load}</span>
      </div>
    </div>
  `;
}

function renderWorkspacesList() {
  if (state.data.workspaces.length === 0) {
    return '<div class="empty-state-text">No workspaces detected</div>';
  }

  return `
    <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
      ${state.data.workspaces.map(ws => `
        <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: var(--text-sm); color: var(--color-text); font-weight: 500; margin-bottom: var(--space-xs); position: relative; overflow: hidden; white-space: nowrap; max-width: 100%;">
            <span style="display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis;">
              ${ws.path.split('/').pop() || ws.path}
            </span>
            <div style="position: absolute; top: 0; right: 0; width: 40px; height: 100%; background: linear-gradient(to right, transparent, var(--color-bg)); pointer-events: none;"></div>
          </div>
          <div style="display: flex; gap: var(--space-lg); font-size: var(--text-xs); color: var(--color-text-subtle);">
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

function renderActivityView(container) {
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
    ...prompts.map(prompt => ({
      ...prompt,
      itemType: 'prompt',
      sortTime: new Date(prompt.timestamp).getTime(),
      id: prompt.id || `prompt-${prompt.timestamp}`
    })),
    ...terminalCommands.map(cmd => ({
      ...cmd,
      itemType: 'terminal',
      sortTime: cmd.timestamp,
      id: cmd.id
    }))
  ].sort((a, b) => b.sortTime - a.sortTime).slice(0, 100);
  
  container.innerHTML = `
    <div style="display: grid; gap: var(--space-xl);">
      
      <!-- Unified Activity Timeline -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Activity Timeline</h3>
            <p class="card-subtitle">${timelineItems.length} items (${events.length} file changes, ${prompts.length} AI prompts, ${terminalCommands.length} terminal commands)</p>
          </div>
          <div style="display: flex; gap: var(--space-md);">
            <select class="select-input" style="width: auto;" onchange="filterActivityByTimeRange(this.value)">
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

function renderThreadsView(container) {
  // Group entries by session/thread
  const threads = groupIntoThreads(state.data.entries);
  const prompts = state.data.prompts || [];
  
  container.innerHTML = `
    <div style="display: grid; gap: var(--space-xl);">
      
      <!-- Captured Prompts Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Captured Prompts</h3>
            <p class="card-subtitle">Prompts captured from clipboard and manual entry</p>
          </div>
          <div style="display: flex; gap: var(--space-md); align-items: center;">
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
    <div style="display: grid; gap: var(--space-md);">
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
                ${status}
              </div>
              <div class="prompt-time">${formatTimeAgo(prompt.timestamp)}</div>
            </div>
            <div class="prompt-content">
              ${escapeHtml(displayText)}
            </div>
            <div class="prompt-meta">
              ${prompt.linked_entry_id ? '<span class="prompt-tag">Linked</span>' : '<span class="prompt-tag pending">Pending</span>'}
              <span class="prompt-tag">${source}</span>
              ${prompt.workspaceName ? `<span class="prompt-tag">[FILE] ${prompt.workspaceName}</span>` : prompt.workspaceId ? `<span class="prompt-tag">[FILE] ${prompt.workspaceId.substring(0, 8)}...</span>` : ''}
              ${prompt.metadata?.complexity ? `<span class="prompt-tag">Complexity: ${prompt.metadata.complexity}</span>` : ''}
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
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;
  
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
    <div style="display: grid; gap: var(--space-lg);">
      ${threads.map(thread => `
        <div class="thread-card" onclick="showThreadModal('${thread.id}')">
          <div class="thread-header">
            <div>
              <div class="thread-title">${truncate(thread.messages[0]?.prompt || thread.messages[0]?.text || 'Conversation Thread', 60)}</div>
              <div class="thread-meta">
                <span>${thread.messages.length} messages</span>
                <span>${new Date(thread.lastMessage).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="thread-badge">${thread.id.substring(0, 8)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===================================
// Analytics View
// ===================================

function renderAnalyticsView(container) {
  container.innerHTML = `
    <div style="display: grid; gap: var(--space-xl);">
      
      <!-- AI Activity & Code Output -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">AI Activity & Code Output</h3>
          <p class="card-subtitle">Prompt frequency and code changes correlation</p>
        </div>
        <div class="card-body">
          <canvas id="aiActivityChart" style="max-height: 300px;"></canvas>
        </div>
      </div>

      <!-- Context Usage Over Time -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Context Usage Over Time</h3>
          <p class="card-subtitle">AI context window utilization percentage (from Cursor's internal tracking)</p>
        </div>
        <div class="card-body">
          <canvas id="promptTokensChart" style="max-height: 250px;"></canvas>
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
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg);">
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
          <h3 class="card-title">Enhanced Context Window Analytics</h3>
          <p class="card-subtitle">Deep dive into @ mentions, token usage, and file relationships</p>
        </div>
        <div class="card-body">
          <div id="enhancedContextAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- NEW: Productivity Insights -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Productivity Insights</h3>
          <p class="card-subtitle">Time-to-edit, iterations, code churn, and debug frequency</p>
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

// ✅ REMOVED: Continuous Activity Timeline (per user request)
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

function renderFileTypesChart() {
  const ctx = document.getElementById('fileTypesChart');
  if (!ctx) return;

  // Count file types
  const typeCount = {};
  state.data.events.forEach(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || '';
      let ext = path.split('.').pop() || 'unknown';
      
      // Group all Git-related extensions under "Git"
      if (ext.startsWith('Git') || ext === 'COMMIT_EDITMSG' || ext === 'HEAD' || 
          ext === 'index' || ext === 'FETCH_HEAD' || ext === 'ORIG_HEAD' || 
          path.includes('.git/')) {
        ext = 'Git';
      }
      
      typeCount[ext] = (typeCount[ext] || 0) + 1;
    } catch {}
  });

  const labels = Object.keys(typeCount).slice(0, 5);
  const data = labels.map(label => typeCount[label]);

  createChart('fileTypesChart', {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          CONFIG.CHART_COLORS.primary,
          CONFIG.CHART_COLORS.secondary,
          CONFIG.CHART_COLORS.accent,
          CONFIG.CHART_COLORS.success,
          CONFIG.CHART_COLORS.warning
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {position: 'bottom'}
      }
    }
  });
}

function renderHourlyChart() {
  const ctx = document.getElementById('hourlyChart');
  if (!ctx) return;

  const allEvents = state.data.events || [];
  const allPrompts = state.data.prompts || [];
  
  if (allEvents.length === 0 && allPrompts.length === 0) {
    return;
  }

  // Create continuous timeline for the last 12 hours (by 15-minute intervals)
  const now = Date.now();
  const twelveHoursAgo = now - (12 * 60 * 60 * 1000);
  const intervalSize = 15 * 60 * 1000; // 15 minutes
  const numIntervals = 48; // 12 hours / 15 minutes = 48 intervals
  
  const intervals = [];
  for (let i = 0; i < numIntervals; i++) {
    const intervalStart = twelveHoursAgo + (i * intervalSize);
    intervals.push({
      timestamp: intervalStart,
      events: 0,
      prompts: 0
    });
  }
  
  // Fill intervals with events
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime >= twelveHoursAgo) {
      const intervalIndex = Math.floor((eventTime - twelveHoursAgo) / intervalSize);
      if (intervalIndex >= 0 && intervalIndex < numIntervals) {
        intervals[intervalIndex].events++;
      }
    }
  });
  
  // Fill intervals with prompts
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    if (promptTime >= twelveHoursAgo) {
      const intervalIndex = Math.floor((promptTime - twelveHoursAgo) / intervalSize);
      if (intervalIndex >= 0 && intervalIndex < numIntervals) {
        intervals[intervalIndex].prompts++;
      }
    }
  });

  createChart('hourlyChart', {
    type: 'bar',
    data: {
      labels: intervals.map(interval => {
        const date = new Date(interval.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }),
      datasets: [
        {
          label: 'File Changes',
          data: intervals.map(i => i.events),
          backgroundColor: CONFIG.CHART_COLORS.secondary,
          borderColor: CONFIG.CHART_COLORS.secondary,
          borderWidth: 1
        },
        {
          label: 'AI Prompts',
          data: intervals.map(i => i.prompts),
          backgroundColor: 'rgba(139, 92, 246, 0.7)',
          borderColor: '#8b5cf6',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
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
            font: { size: 10 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 8,
          titleFont: { size: 11 },
          bodyFont: { size: 10 }
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 8 }
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

function renderFileGraphView(container) {
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
          <label style="display: flex; align-items: center; gap: 4px;">
            Threshold: <span id="thresholdValue">0.2</span>
            <span title="Minimum similarity score (0-1) required to show connections between files. Higher values show only strongly related files." style="color: var(--color-text-muted); font-size: 12px; cursor: help;">ⓘ</span>
          </label>
          <input type="range" id="similarityThreshold" min="0" max="1" step="0.05" value="0.2" 
                 oninput="document.getElementById('thresholdValue').textContent = this.value; updateFileGraph()"
                 title="Lower = more connections (noisier), Higher = only strong relationships (cleaner)">
        </div>

        <div class="control-group">
          <label>File Types:</label>
          <select id="fileTypeFilter" multiple style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 13px; min-height: 80px; width: 100%;" onchange="updateFileGraph()">
            <!-- Options will be populated programmatically -->
          </select>
        </div>

        <div class="control-actions">
          <button class="btn btn-primary" onclick="updateFileGraph()" style="font-size: 13px; padding: 6px 12px;">Refresh</button>
          <button class="btn btn-secondary" onclick="resetFileGraphZoom()" style="font-size: 13px; padding: 6px 12px;">Reset View</button>
          <button class="btn btn-secondary" onclick="zoomToFit()" style="font-size: 13px; padding: 6px 12px;">Zoom to Fit</button>
          <button class="btn btn-secondary" onclick="toggleLabels()" style="font-size: 13px; padding: 6px 12px;" id="labelToggle">Hide Labels</button>
        </div>
      </div>
      
      <!-- Search & Navigation Panel -->
      <div style="padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-lg); margin-bottom: var(--space-md);">
        <input type="text" id="fileSearch" placeholder="Search files by name..." 
               style="width: 100%; padding: var(--space-sm); background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text); font-size: var(--text-sm);"
               oninput="filterGraphNodes(this.value)">
        <div id="fileSearchResults" style="margin-top: var(--space-sm); max-height: 120px; overflow-y: auto;"></div>
      </div>

      <div class="graph-container" id="fileGraphContainer" style="width: 100%; height: 600px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); position: relative;">
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
      <div class="card" style="margin-top: var(--space-lg);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h3 class="card-title" style="cursor: help;" title="File pairs ranked by co-occurrence in prompts and editing sessions. Shows which files are frequently worked on together.">
              Most Similar File Pairs
              <span style="font-size: 11px; color: var(--color-text-muted); font-weight: normal; margin-left: 4px;">ⓘ</span>
            </h3>
            <p class="card-subtitle">Files frequently modified together with highest co-occurrence scores</p>
          </div>
          <div style="display: flex; gap: var(--space-sm); align-items: center;">
            <label style="font-size: var(--text-sm); color: var(--color-text-muted);">Show:</label>
            <input type="number" id="similarPairsCount" min="1" max="50" value="10" onchange="updateSimilarPairs()" oninput="if(this.value > 50) this.value = 50; if(this.value < 1) this.value = 1;" style="width: 60px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 13px; text-align: center;" />
            <button onclick="highlightSimilarPairs()" class="btn-secondary" style="font-size: 13px; padding: 6px 12px;" title="Highlight these pairs in the graph visualization above">Highlight in Graph</button>
          </div>
        </div>
        <div class="card-body">
          <div id="similarFilePairs" style="display: grid; gap: var(--space-md);">
            <!-- Will be populated by JavaScript -->
          </div>
        </div>
      </div>

      <!-- Semantic Analysis Panels -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); margin-top: var(--space-xl);">
        
        <!-- Prompt Embeddings Analysis -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="cursor: help;" title="Visualizes semantic similarity between your AI prompts using TF-IDF embeddings and dimensionality reduction (PCA/t-SNE/MDS). Prompts with similar content appear closer together. Data is extracted from your Cursor database and analyzed locally.">
              Prompts Embedding Analysis
              <span style="font-size: 11px; color: var(--color-text-muted); font-weight: normal; margin-left: 4px;">ⓘ</span>
            </h3>
          </div>
          <div class="card-body">
            <p style="font-size: 13px; color: var(--color-text-muted); margin-bottom: var(--space-lg);">
              Semantic relationships between AI prompts across all time. Colors represent time (purple = older, yellow/green = newer).
            </p>
            <div style="display: grid; gap: var(--space-md); margin-bottom: var(--space-lg);">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--color-text-muted);">Prompts Analyzed:</span>
                <span id="embeddingsFilesCount" style="font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--color-text-muted);">Total Tokens:</span>
                <span id="embeddingsTotalChanges" style="font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--color-text-muted);">Avg Similarity:</span>
                <span id="embeddingsAvgSimilarity" style="font-weight: 600;">0.000</span>
              </div>
            </div>
            
            <!-- Dimensionality Reduction Controls -->
            <div style="margin-bottom: var(--space-md); padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  <label style="font-size: 13px; color: var(--color-text-muted);" title="PCA: Fastest, linear. t-SNE: Best clusters. MDS: Preserves distances.">Reduction Method:</label>
                  <select id="embeddingsReductionMethod" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 12px;" onchange="renderEmbeddingsVisualization()">
                    <option value="pca">PCA (Principal Component Analysis)</option>
                    <option value="tsne">t-SNE (t-Distributed Stochastic Neighbor Embedding)</option>
                    <option value="mds">MDS (Multidimensional Scaling)</option>
                  </select>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  <label style="font-size: 13px; color: var(--color-text-muted);" title="Number of dimensions to reduce to (2D for flat visualization, 3D for spatial view)">Dimensions:</label>
                  <select id="embeddingsDimensions" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 12px;" onchange="renderEmbeddingsVisualization()">
                    <option value="2" selected>2D</option>
                    <option value="3">3D</option>
                  </select>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                  <label style="font-size: 13px; color: var(--color-text-muted);" title="Number of principal components to keep (higher = more detail, slower computation)">Components:</label>
                  <input type="number" id="embeddingsPCAComponents" min="2" max="50" value="10" onchange="renderEmbeddingsVisualization()" oninput="if(this.value > 50) this.value = 50; if(this.value < 2) this.value = 2;" style="width: 55px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); font-size: 12px; text-align: center;" />
                </div>
              </div>
            </div>
            
            <!-- Embeddings Visualization Canvas -->
            <div id="embeddingsVisualization" style="width: 100%; height: 300px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); position: relative; margin-bottom: var(--space-md);">
              <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 13px;">
                Embeddings visualization will appear here
              </div>
            </div>
            
            <div>
              <h4 style="font-size: 14px; margin-bottom: var(--space-sm); color: var(--color-text-muted);">Most Similar Prompt Pairs:</h4>
              <div id="similarityPairs" style="display: flex; flex-direction: column; gap: var(--space-xs);">
                <div style="color: var(--color-text-muted); font-size: 13px;">Analyzing prompts...</div>
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
            <div style="display: grid; gap: var(--space-md); margin-bottom: var(--space-lg);">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--color-text-muted);">Total Terms:</span>
                <span id="tfidfTotalTerms" style="font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--color-text-muted);">Unique Terms:</span>
                <span id="tfidfUniqueTerms" style="font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--color-text-muted);">Avg Term Frequency:</span>
                <span id="tfidfAvgFreq" style="font-weight: 600;">0.00</span>
              </div>
            </div>
            <div>
              <h4 style="font-size: 14px; margin-bottom: var(--space-sm); color: var(--color-text-muted); cursor: help;" title="Terms ranked by TF-IDF (Term Frequency-Inverse Document Frequency) score. Higher scores indicate terms that are important in specific files but rare across all files.">
              Top Terms by Importance:
              <span style="font-size: 11px; color: var(--color-text-muted); font-weight: normal; margin-left: 4px;">ⓘ</span>
            </h4>
              <div id="topTerms" style="display: flex; flex-direction: column; gap: var(--space-xs); max-height: 300px; overflow-y: auto; overflow-x: hidden;">
                <div style="color: var(--color-text-muted); font-size: 13px;">Analyzing...</div>
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
    const response = await fetch(`${CONFIG.API_BASE}/api/file-contents`);
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
    
    // Update basic stats
    document.getElementById('graphNodeCount').textContent = files.length;
    document.getElementById('graphLinkCount').textContent = links.length;
    document.getElementById('graphPromptCount').textContent = state.data.prompts.length;
    
    if (links.length > 0) {
      const avgSim = links.reduce((sum, l) => sum + l.similarity, 0) / links.length;
      document.getElementById('graphAvgSimilarity').textContent = avgSim.toFixed(3);
    }
    
    // Render most similar file pairs
    renderSimilarFilePairs(links, files);
    
    // Render file similarity based on AI prompts
    renderEmbeddingsVisualization();
    
    // Update TF-IDF analysis
    document.getElementById('tfidfTotalTerms').textContent = tfidfStats.totalTerms.toLocaleString();
    document.getElementById('tfidfUniqueTerms').textContent = tfidfStats.uniqueTerms;
    document.getElementById('tfidfAvgFreq').textContent = tfidfStats.avgFrequency.toFixed(2);
    
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
    document.getElementById('topTerms').innerHTML = termsHtml || '<div style="color: var(--color-text-muted); font-size: 13px;">No terms found</div>';
    
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
function renderEmbeddingsVisualization() {
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
  
  try {
    console.log(`[EMBEDDINGS] Starting analysis: method=${method}, dims=${dimensions}, components=${numComponents}`);
    
    // Filter out JSON metadata, composer conversations (which are just names), and prepare actual prompt texts
    const validPrompts = prompts.filter(p => {
      const text = p.text || p.prompt || p.preview || p.content || '';
      const isJsonLike = text.startsWith('{') || text.startsWith('[');
      // Exclude composer conversations as they only contain conversation names, not actual prompt content
      const isComposerConversation = p.source === 'composer' && p.type === 'conversation';
      return !isJsonLike && !isComposerConversation && text.length > 10;
    });
    
    console.log(`[EMBEDDINGS] Filtered to ${validPrompts.length} valid prompts`);
    
    if (validPrompts.length === 0) {
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-size: 13px;">No valid prompts for analysis (filtered out JSON metadata)</div>';
      return;
    }
    
    // Tokenize all prompts
    const promptTexts = validPrompts.map(p => p.text || p.prompt || p.preview || p.content || '');
    const allTokens = promptTexts.map(text => tokenizeCode(text));
    
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
    
    // Create TF-IDF vectors
    const vectors = [];
    const promptLabels = [];
    const promptMetadata = [];
    
    validPrompts.forEach((prompt, i) => {
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
    });
    
    console.log(`[EMBEDDINGS] Built ${vectors.length} TF-IDF vectors with ${vectors[0]?.length} dimensions`);
    
    // Apply dimensionality reduction
    let reducedVectors;
    if (method === 'pca') {
      reducedVectors = applyPCA(vectors, dimensions, numComponents);
      console.log(`[EMBEDDINGS] PCA complete: ${reducedVectors.length} vectors -> ${reducedVectors[0]?.length} dims`);
    } else if (method === 'tsne') {
      reducedVectors = applyTSNE(vectors, dimensions, numComponents);
      console.log(`[EMBEDDINGS] t-SNE complete`);
    } else {
      reducedVectors = applyMDS(vectors, dimensions);
      console.log(`[EMBEDDINGS] MDS complete`);
    }
    
    // Render the visualization
    if (dimensions === 2) {
      renderEmbeddings2D(container, reducedVectors, promptLabels, promptMetadata);
    } else {
      renderEmbeddings3D(container, reducedVectors, promptLabels, promptMetadata);
    }
    
    // Update similarity pairs to show similar prompts
    const avgSim = updatePromptSimilarityPairs(validPrompts, vectors, promptTexts);
    
    // Update average similarity stat
    if (avgSim !== null) {
      document.getElementById('embeddingsAvgSimilarity').textContent = avgSim.toFixed(3);
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
      <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-muted);">
        <div style="font-size: 48px; margin-bottom: var(--space-md);">○━○</div>
        <div style="font-size: var(--text-md); margin-bottom: var(--space-sm);">No Similar Pairs Found</div>
        <div style="font-size: var(--text-sm);">Modify some files together to see relationships</div>
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
           style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); border: 2px solid transparent; transition: all 0.2s; cursor: pointer;"
           onmouseenter="highlightPairInGraph('${source.id}', '${target.id}')"
           onmouseleave="clearGraphHighlights()"
           onclick="focusOnPair('${source.id}', '${target.id}')"
           title="Click to focus on this pair in the graph">
        
        <!-- Rank Badge -->
        <div style="flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-primary); color: white; border-radius: 50%; font-weight: bold; font-size: 14px;">
          ${index + 1}
        </div>
        
        <!-- File Pair Info -->
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs);">
            <div style="display: flex; align-items: center; gap: var(--space-xs); flex: 1; min-width: 0;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${sourceColor}; flex-shrink: 0;"></span>
              <span style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${source.path}">${sourceName}</span>
            </div>
            <span style="color: var(--color-text-muted); font-size: var(--text-sm); flex-shrink: 0;">↔</span>
            <div style="display: flex; align-items: center; gap: var(--space-xs); flex: 1; min-width: 0;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${targetColor}; flex-shrink: 0;"></span>
              <span style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${target.path}">${targetName}</span>
            </div>
          </div>
          
          <div style="display: flex; gap: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
            ${sharedPrompts > 0 ? `<span title="Number of AI prompts that referenced both files">${sharedPrompts} shared prompts</span>` : ''}
            ${sharedPrompts > 0 && sharedSessions > 0 ? '<span>•</span>' : ''}
            ${sharedSessions > 0 ? `<span title="Number of coding sessions where both files were modified">${sharedSessions} shared sessions</span>` : ''}
            ${(sharedPrompts > 0 || sharedSessions > 0) ? '<span>•</span>' : ''}
            <span>${(source.changes || 0) + (target.changes || 0)} total changes</span>
          </div>
        </div>
        
        <!-- Similarity Score -->
        <div style="flex-shrink: 0; text-align: right;">
          <div style="font-size: var(--text-lg); font-weight: bold; color: var(--color-success);" title="Jaccard similarity coefficient based on prompt and session co-occurrence">
            ${similarityPercent}%
          </div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
            similarity
          </div>
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
    container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><div class="loading-spinner"></div><span style="margin-left: 12px;">Computing latent embeddings...</span></div>';
    
    // Fetch file data
    const response = await fetch(`${CONFIG.API_BASE}/api/file-contents`);
    const data = await response.json();
    
    if (!data.files || data.files.length === 0) {
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted);">No file data available</div>';
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
    const MAX_FILES = 500;
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
    
    // Compute latent positions (semantic similarity based)
    const latentNodes = computeLatentLayout(files);
    
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
    console.log(`[NAVIGATOR] ✅ Initialization complete in ${elapsed}s`);
    
  } catch (error) {
    console.error('Error initializing navigator:', error);
    container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-error);">Error loading navigator: ${error.message}</div>`;
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

function computeLatentLayout(files) {
  // Compute latent positions using simplified t-SNE/UMAP-like approach
  // Based on TF-IDF content similarity
  
  const width = 800, height = 700;
  
  // Create feature vectors
  const vectors = files.map(file => createFeatureVector(file));
  console.log(`[DATA] Created ${vectors.length} feature vectors, avg dimensions: ${vectors[0]?.length || 0}`);
  
  // Compute pairwise distances (with progress)
  console.log(`[EMBEDDINGS] Computing ${files.length}×${files.length} distance matrix...`);
  const distances = [];
  for (let i = 0; i < files.length; i++) {
    distances[i] = [];
    for (let j = 0; j < files.length; j++) {
      distances[i][j] = euclideanDistance(vectors[i], vectors[j]);
    }
    if (i % 50 === 0) {
      console.log(`[EMBEDDINGS] Distance computation: ${i}/${files.length} (${Math.round(i/files.length*100)}%)`);
    }
  }
  console.log(`[EMBEDDINGS] Distance matrix complete, applying MDS...`);
  
  // Apply MDS (Multidimensional Scaling) for 2D projection
  const positions = applyMDS(distances, 2);
  
  // Scale to canvas size
  const xs = positions.map(p => p[0]);
  const ys = positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  
  const padding = 100;
  const scaleX = (width - 2 * padding) / (maxX - minX || 1);
  const scaleY = (height - 2 * padding) / (maxY - minY || 1);
  
  console.log(`[EMBEDDINGS] Latent layout complete for ${files.length} files`);
  
  return files.map((file, i) => ({
    ...file,
    x: padding + (positions[i][0] - minX) * scaleX,
    y: padding + (positions[i][1] - minY) * scaleY
  }));
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
  document.getElementById('navFileCount').textContent = navigatorState.nodes.length;
  document.getElementById('navClusterCount').textContent = navigatorState.clusters.length;
  
  // Calculate coherence (average intra-cluster distance vs inter-cluster distance)
  let coherence = 0;
  if (navigatorState.clusters.length > 1) {
    const intraDistances = [];
    const interDistances = [];
    
    navigatorState.clusters.forEach(cluster => {
      cluster.nodes.forEach((n1, i) => {
        cluster.nodes.forEach((n2, j) => {
          if (i < j) {
            const dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
            intraDistances.push(dist);
          }
        });
      });
    });
    
    navigatorState.clusters.forEach((c1, i) => {
      navigatorState.clusters.forEach((c2, j) => {
        if (i < j) {
          c1.nodes.forEach(n1 => {
            c2.nodes.forEach(n2 => {
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
  
  document.getElementById('navCoherence').textContent = `${coherence.toFixed(0)}%`;
  
  // Update cluster legend
  const legend = document.getElementById('clusterLegend');
  if (legend) {
    legend.innerHTML = navigatorState.clusters.map(cluster => `
      <div style="display: flex; align-items: center; gap: var(--space-xs);">
        <div style="width: 12px; height: 12px; border-radius: 2px; background: ${cluster.color};"></div>
        <span style="color: var(--color-text);">${cluster.name} (${cluster.nodes.length})</span>
      </div>
    `).join('');
  }
}

function generateSemanticInsights() {
  const container = document.getElementById('semanticInsights');
  if (!container || navigatorState.clusters.length === 0) return;
  
  const insights = [];
  
  // Find most isolated cluster
  const clusterCenters = navigatorState.clusters.map(c => c.centroid);
  let maxDist = 0;
  let isolatedCluster = null;
  
  navigatorState.clusters.forEach((cluster, i) => {
    const distances = clusterCenters.map((center, j) => {
      if (i === j) return 0;
      return Math.sqrt((cluster.centroid.x - center.x) ** 2 + (cluster.centroid.y - center.y) ** 2);
    });
    const minDist = Math.min(...distances.filter(d => d > 0));
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
    <div style="padding: var(--space-md); background: var(--color-bg-alt); border-left: 4px solid ${insight.cluster.color}; border-radius: var(--radius-md);">
      <h4 style="margin: 0 0 var(--space-xs) 0; font-size: var(--text-sm); color: var(--color-text);">${insight.title}</h4>
      <p style="margin: 0; font-size: var(--text-xs); color: var(--color-text-muted);">${insight.description}</p>
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
    <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">File Information</h4>
        <div style="display: grid; gap: var(--space-sm);">
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Path:</span>
            <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);" title="${escapeHtml(file.path)}">${escapeHtml(truncate(file.path, 50))}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Type:</span>
            <span class="badge" style="background: var(--color-bg-alt); color: var(--color-text); border: 2px solid ${getFileTypeColor(file.ext)}; font-weight: 600; font-family: var(--font-mono);">${file.ext.toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Total Changes:</span>
            <span style="color: var(--color-text); font-weight: 600;">${file.changes}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Last Modified:</span>
            <span style="color: var(--color-text);">${formatTimeAgo(file.lastModified)}</span>
          </div>
        </div>
      </div>
      
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Recent Events (${file.events.length})</h4>
        <div style="display: flex; flex-direction: column; gap: var(--space-sm); max-height: 300px; overflow-y: auto;">
          ${file.events.slice(-10).reverse().map(event => `
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-accent);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
                <span style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-muted);">
                  ${formatTimeAgo(event.timestamp)}
                </span>
                <span class="badge">${event.type || 'file_change'}</span>
              </div>
              <div style="font-size: var(--text-sm); color: var(--color-text);">
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

function renderEmbeddingsVisualization() {
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

function renderNavigatorView(container) {
  container.innerHTML = `
    <div class="navigator-view">
      <div class="view-header">
        <h2>Semantic Navigator</h2>
        <p class="view-subtitle">Explore your codebase in latent space - where semantic similarity becomes visual proximity</p>
      </div>

      <!-- View Mode Switcher -->
      <div class="view-mode-controls" style="display: flex; gap: var(--space-lg); align-items: center; padding: var(--space-lg); background: var(--color-bg-alt); border-radius: var(--radius-lg); margin-bottom: var(--space-lg);">
        <div style="flex: 1;">
          <h3 style="margin: 0 0 var(--space-xs) 0; font-size: var(--text-md); color: var(--color-text);">View Mode</h3>
          <div class="view-mode-switcher" style="display: flex; gap: var(--space-sm);">
            <button class="view-mode-btn active" data-mode="physical" onclick="setNavigatorViewMode('physical')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                <path d="M4 4h3v3H4V4zm5 0h3v3H9V4zM4 9h3v3H4V9zm5 0h3v3H9V9z"/>
              </svg>
              Physical
            </button>
            <button class="view-mode-btn" data-mode="hybrid" onclick="setNavigatorViewMode('hybrid')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                <circle cx="8" cy="4" r="2"/>
                <circle cx="4" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <path d="M8 6L4 10M8 6l4 4"/>
              </svg>
              Hybrid
            </button>
            <button class="view-mode-btn" data-mode="latent" onclick="setNavigatorViewMode('latent')">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                <circle cx="8" cy="8" r="6"/>
                <circle cx="8" cy="8" r="3"/>
                <path d="M8 2v4M8 10v4M2 8h4M10 8h4"/>
              </svg>
              Latent
            </button>
          </div>
          <p style="margin: var(--space-xs) 0 0 0; font-size: var(--text-xs); color: var(--color-text-muted);">
            <strong>Physical:</strong> Direct co-modification • 
            <strong>Latent:</strong> Semantic similarity • 
            <strong>Hybrid:</strong> Blend both
          </p>
        </div>

        <div style="border-left: 1px solid var(--color-border); padding-left: var(--space-lg);">
          <h3 style="margin: 0 0 var(--space-xs) 0; font-size: var(--text-md); color: var(--color-text);">Transition Speed</h3>
          <input type="range" id="transitionSpeed" min="0.5" max="2" step="0.1" value="1" 
                 style="width: 200px;" oninput="updateTransitionSpeed(this.value)">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px;">
            <span>Slow</span>
            <span id="speedLabel">1.0x</span>
            <span>Fast</span>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div style="display: grid; grid-template-columns: 1fr 200px; gap: var(--space-lg);">
        
        <!-- Main Visualization -->
        <div>
          <div class="navigator-container" id="navigatorContainer" style="width: 100%; height: 700px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); position: relative;">
            <!-- Navigator will be rendered here -->
          </div>

          <!-- Navigation Controls -->
          <div style="display: flex; gap: var(--space-md); margin-top: var(--space-md); align-items: center;">
            <button class="btn btn-primary" onclick="zoomToFitNavigator()" style="font-size: 13px; padding: 8px 16px;">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
                <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z"/>
              </svg>
              Zoom to Fit
            </button>
            <button class="btn btn-secondary" onclick="resetNavigatorView()" style="font-size: 13px; padding: 8px 16px;">Reset View</button>
            <button class="btn btn-secondary" onclick="toggleNavigatorLabels()" id="navigatorLabelToggle" style="font-size: 13px; padding: 8px 16px;">Hide Labels</button>
            
            <div style="flex: 1;"></div>
            
            <div style="display: flex; gap: var(--space-sm); align-items: center; font-size: var(--text-sm); color: var(--color-text-muted);">
              <span>Interpolation:</span>
              <span id="interpolationValue" style="font-weight: bold; color: var(--color-primary);">0%</span>
            </div>
          </div>
        </div>

        <!-- Mini-Map Widget -->
        <div>
          <div class="mini-map-widget" style="background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md);">
            <h3 style="margin: 0 0 var(--space-sm) 0; font-size: var(--text-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 2a6 6 0 110 12A6 6 0 018 2z"/>
              </svg>
              Overview
            </h3>
            <div id="miniMapCanvas" style="width: 100%; height: 180px; background: var(--color-bg); border-radius: var(--radius-sm); border: 1px solid var(--color-border); position: relative; cursor: pointer;">
              <!-- Mini-map will be rendered here -->
            </div>
            
            <div style="margin-top: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Files:</span>
                <span id="navFileCount" style="color: var(--color-text); font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Clusters:</span>
                <span id="navClusterCount" style="color: var(--color-text); font-weight: 600;">0</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Coherence:</span>
                <span id="navCoherence" style="color: var(--color-success); font-weight: 600;">0%</span>
              </div>
            </div>
          </div>

          <!-- Cluster Legend -->
          <div style="margin-top: var(--space-md); background: var(--color-bg-alt); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-md);">
            <h3 style="margin: 0 0 var(--space-sm) 0; font-size: var(--text-sm); color: var(--color-text);">Latent Clusters</h3>
            <div id="clusterLegend" style="display: flex; flex-direction: column; gap: var(--space-xs); font-size: var(--text-xs);">
              <!-- Cluster legend will be populated -->
            </div>
          </div>
        </div>
      </div>

      <!-- Semantic Insights -->
      <div class="card" style="margin-top: var(--space-lg);">
        <div class="card-header">
          <h3 class="card-title">Semantic Insights</h3>
          <p class="card-subtitle">Discovered patterns in latent space</p>
        </div>
        <div class="card-body">
          <div id="semanticInsights" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-md);">
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

function renderSystemView(container) {
  const latestGit = state.data.gitData[state.data.gitData.length - 1];
  const latestIdeState = Array.isArray(state.data.ideState) && state.data.ideState.length > 0 
    ? state.data.ideState[state.data.ideState.length - 1] 
    : null;
  
  // Extract editor info from the nested structure
  const openTabs = latestIdeState?.editorState?.activeTabs?.length || 0;
  const currentFile = latestIdeState?.editorState?.editorLayout?.activeEditor || 'None';
  const currentFileName = currentFile !== 'None' ? currentFile.split('/').pop() : 'None';
  const languageMode = latestIdeState?.editorConfiguration?.languageMode || 'Unknown';
  const cursorPos = latestIdeState?.editorState?.activeTabs?.[0]?.lineNumber && latestIdeState?.editorState?.activeTabs?.[0]?.columnNumber
    ? `Ln ${latestIdeState.editorState.activeTabs[0].lineNumber}, Col ${latestIdeState.editorState.activeTabs[0].columnNumber}`
    : 'Unknown';

  container.innerHTML = `
    <div style="display: grid; gap: var(--space-xl);">
      
      <!-- Current Stats Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg);">
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">System Resources</h3>
          </div>
          <div class="card-body">
            ${renderSystemStatus()}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Git Repository</h3>
          </div>
          <div class="card-body">
            ${latestGit ? `
              <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
                  <span style="color: var(--color-text-muted);">Branch</span>
                  <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-sm);">${latestGit.branch || 'Unknown'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
                  <span style="color: var(--color-text-muted);">Modified Files</span>
                  <span style="color: var(--color-text); font-weight: 600;">${latestGit.status?.length || 0}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0;">
                  <span style="color: var(--color-text-muted);">Recent Commits</span>
                  <span style="color: var(--color-text); font-weight: 600;">${latestGit.recentCommits?.length || 0}</span>
                </div>
              </div>
            ` : '<div class="empty-state-text">No git data available</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Editor State</h3>
          </div>
          <div class="card-body">
            ${latestIdeState ? `
              <div style="display: flex; flex-direction: column; gap: var(--space-md);">
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
                  <span style="color: var(--color-text-muted);">Open Tabs</span>
                  <span style="color: var(--color-text); font-weight: 600;">${openTabs}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
                  <span style="color: var(--color-text-muted);">Current File</span>
                  <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);" title="${escapeHtml(currentFile)}">${escapeHtml(truncate(currentFileName, 25))}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border);">
                  <span style="color: var(--color-text-muted);">Language</span>
                  <span style="color: var(--color-text); font-weight: 600;">${languageMode || 'Unknown'}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: var(--space-sm) 0;">
                  <span style="color: var(--color-text-muted);">Position</span>
                  <span style="color: var(--color-text); font-weight: 600;">${cursorPos}</span>
                </div>
              </div>
            ` : '<div class="empty-state-text">No IDE state available</div>'}
          </div>
        </div>

      </div>

      <!-- Time Series Graphs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-lg);">
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">System Resources Over Time</h3>
            <p class="card-subtitle">Memory usage and CPU load tracking</p>
          </div>
          <div class="card-body">
            <canvas id="systemResourcesChart" style="max-height: 300px;"></canvas>
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

function renderAPIDocsView(container) {
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
            <p><strong>Content-Type:</strong> <code>application/json</code></p>
            <p><strong>CORS:</strong> Enabled for all origins</p>
            <div style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-info);">
              <strong>Quick Test:</strong> <code>curl http://localhost:43917/health</code>
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
                <code>/api/analytics/productivity</code>
              </div>
              <p>Productivity metrics (time-to-edit, iterations, code churn)</p>
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
            <h3 class="card-title">Performance Notes</h3>
          </div>
          <div class="card-body">
            <ul>
              <li><strong>No rate limiting:</strong> Local API, no throttling</li>
              <li><strong>Polling interval:</strong> Dashboard polls every 5 seconds</li>
              <li><strong>Database size:</strong> ~5-10MB per hour of active development</li>
              <li><strong>Max response time:</strong> Most endpoints <50ms</li>
              <li><strong>Large exports:</strong> /api/export/database may take 1-2 seconds for large datasets</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderSystemResourcesChart() {
  const canvas = document.getElementById('systemResourcesChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const data = state.data.systemResources.slice(-30); // Last 30 data points
  
  if (data.length === 0) {
    // ✅ Use HTML instead of canvas text to avoid blurriness on Retina displays
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">File type data will appear as you edit files</div>
      </div>
    `;
    return;
  }

  // Calculate max values for dual-axis scaling
  // Handle both old format (d.memory as number) and new format (d.memory.rss)
  const memoryData = data.map(d => {
    const memBytes = d.memory?.rss || d.memory?.heapUsed || d.memory || 0;
    return parseFloat((memBytes / 1024 / 1024).toFixed(1));
  });
  
  // Handle both d.loadAverage and d.system.loadAverage
  const cpuData = data.map(d => {
    const loadAvg = d.system?.loadAverage || d.loadAverage || [0];
    return loadAvg[0] || 0;
  });
  
  const maxMemory = Math.max(...memoryData);
  const maxCpu = Math.max(...cpuData);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((d, i) => {
        const date = new Date(d.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }),
      datasets: [
        {
          label: 'Memory Usage (MB)',
          data: memoryData,
          borderColor: CONFIG.CHART_COLORS.primary,
          backgroundColor: CONFIG.CHART_COLORS.primary + '15',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-memory',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4
        },
        {
          label: 'CPU Load Average',
          data: cpuData,
          borderColor: CONFIG.CHART_COLORS.accent,
          backgroundColor: CONFIG.CHART_COLORS.accent + '15',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-cpu',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 11,
              family: 'Inter'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 13
          },
          bodyFont: {
            size: 12
          },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.dataset.yAxisID === 'y-memory') {
                label += context.parsed.y.toFixed(1) + ' MB';
              } else {
                label += context.parsed.y.toFixed(2);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: {
              size: 10
            }
          }
        },
        'y-memory': {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Memory (MB)',
            font: {
              size: 11,
              weight: 'bold'
            }
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(0) + ' MB';
            },
            font: {
              size: 10
            }
          },
          grid: {
            color: 'rgba(99, 102, 241, 0.1)'
          }
        },
        'y-cpu': {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: 'CPU Load',
            font: {
              size: 11,
              weight: 'bold'
            }
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(1);
            },
            font: {
              size: 10
            }
          },
          grid: {
            drawOnChartArea: false,
            color: 'rgba(245, 158, 11, 0.1)'
          }
        }
      }
    }
  });
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

function renderAIActivityChart() {
  const canvas = document.getElementById('aiActivityChart');
  if (!canvas) return;
  
  // Combine events and prompts to create time-series data
  const allEvents = state.data.events || [];
  const allPrompts = state.data.prompts || [];
  
  // Group by hour for the last 24 hours or by day for longer periods
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  // Determine granularity based on data span
  const oldestEvent = allEvents.length > 0 ? Math.min(...allEvents.map(e => new Date(e.timestamp).getTime())) : now;
  const oldestPrompt = allPrompts.length > 0 ? Math.min(...allPrompts.map(p => new Date(p.timestamp).getTime())) : now;
  const oldestData = Math.min(oldestEvent, oldestPrompt);
  
  const useHourly = (now - oldestData) < (2 * 24 * 60 * 60 * 1000); // Less than 2 days
  const bucketSize = useHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1 hour or 1 day
  const numBuckets = useHourly ? 24 : 14; // Last 24 hours or 14 days
  
  // Create time buckets
  const buckets = [];
  for (let i = numBuckets - 1; i >= 0; i--) {
    const bucketTime = now - (i * bucketSize);
    buckets.push({
      timestamp: bucketTime,
      promptCount: 0,
      codeChanges: 0, // in KB
      fileCount: 0
    });
  }
  
  // Fill buckets with prompt data
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    const bucketIndex = Math.floor((now - promptTime) / bucketSize);
    const actualIndex = numBuckets - 1 - bucketIndex;
    if (actualIndex >= 0 && actualIndex < numBuckets) {
      buckets[actualIndex].promptCount++;
    }
  });
  
  // Fill buckets with code change data
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    const bucketIndex = Math.floor((now - eventTime) / bucketSize);
    const actualIndex = numBuckets - 1 - bucketIndex;
    if (actualIndex >= 0 && actualIndex < numBuckets) {
      buckets[actualIndex].fileCount++;
      
      // Try to extract code change size
      let changeSize = 0;
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        if (details.chars_added) changeSize += details.chars_added;
        if (details.chars_deleted) changeSize += details.chars_deleted;
      } catch (e) {
        // Use fallback
        changeSize = 100; // Assume 100 chars per change
      }
      buckets[actualIndex].codeChanges += changeSize / 1024; // Convert to KB
    }
  });
  
  if (buckets.every(b => b.promptCount === 0 && b.codeChanges === 0)) {
    // ✅ Use HTML instead of canvas text to avoid blurriness on Retina displays
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 300px; color: var(--color-text-muted); font-size: var(--text-sm);">
        No AI activity data available
      </div>
    `;
    return;
  }
  
  createChart('aiActivityChart', {
    type: 'line',
    data: {
      labels: buckets.map(b => {
        const date = new Date(b.timestamp);
        if (useHourly) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
          return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
      }),
      datasets: [
        {
          label: 'AI Prompts',
          data: buckets.map(b => b.promptCount),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-prompts',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#8b5cf6'
        },
        {
          label: 'Code Output (KB)',
          data: buckets.map(b => b.codeChanges),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-code',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 11,
              family: 'Inter'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: {
            size: 13
          },
          bodyFont: {
            size: 12
          },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.dataset.yAxisID === 'y-prompts') {
                label += context.parsed.y + ' prompts';
              } else {
                label += context.parsed.y.toFixed(2) + ' KB';
              }
              return label;
            },
            afterBody: function(tooltipItems) {
              const index = tooltipItems[0].dataIndex;
              const bucket = buckets[index];
              return [`Files changed: ${bucket.fileCount}`];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: {
              size: 10
            }
          }
        },
        'y-prompts': {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: {
            display: true,
            text: 'AI Prompts',
            font: {
              size: 11,
              weight: 'bold'
            }
          },
          ticks: {
            stepSize: 1,
            callback: function(value) {
              return Math.floor(value);
            },
            font: {
              size: 10
            }
          },
          grid: {
            color: 'rgba(139, 92, 246, 0.1)'
          }
        },
        'y-code': {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Code Output (KB)',
            font: {
              size: 11,
              weight: 'bold'
            }
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(1) + ' KB';
            },
            font: {
              size: 10
            }
          },
          grid: {
            drawOnChartArea: false,
            color: 'rgba(16, 185, 129, 0.1)'
          }
        }
      }
    }
  });
}

function renderPromptTokensChart() {
  const canvas = document.getElementById('promptTokensChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Extract prompt data with token estimates from Cursor database prompts
  const prompts = state.data.prompts || [];
  
  // Group prompts by time buckets (hourly for last 24 hours)
  const now = Date.now();
  const hours = 24;
  const buckets = Array.from({ length: hours }, (_, i) => {
    const time = now - (hours - i) * 60 * 60 * 1000;
    return {
      timestamp: time,
      charCount: 0,
      contextUsage: 0,
      contextCount: 0,
      count: 0
    };
  });
  
  // Aggregate prompts into buckets
  prompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    const bucketIndex = Math.floor((promptTime - (now - hours * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (bucketIndex >= 0 && bucketIndex < hours) {
      // Track character count (not actual tokens, which aren't available)
      const text = prompt.text || prompt.prompt || prompt.preview || '';
      const charCount = text.length;
      
      // Extract context usage percentage if available (from Cursor's tracking)
      const contextUsage = prompt.contextUsage || 0;
      
      buckets[bucketIndex].charCount += charCount;
      if (contextUsage > 0) {
        buckets[bucketIndex].contextUsage += contextUsage;
        buckets[bucketIndex].contextCount += 1;
      }
      buckets[bucketIndex].count += 1;
    }
  });
  
  if (buckets.every(b => b.count === 0)) {
    // ✅ Use HTML instead of canvas text to avoid blurriness on Retina displays
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 250px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt data will appear once you start using Cursor AI</div>
      </div>
    `;
    return;
  }

  // Calculate average context usage per bucket
  const avgContextUsage = buckets.map(b => 
    b.contextCount > 0 ? b.contextUsage / b.contextCount : 0
  );

  createChart('promptTokensChart', {
    type: 'line',
    data: {
      labels: buckets.map(b => {
        const date = new Date(b.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }),
      datasets: [
        {
          label: 'Prompt Length (chars)',
          data: buckets.map(b => b.charCount),
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148, 163, 184, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          yAxisID: 'y'
        },
        {
          label: 'Context Usage %',
          data: avgContextUsage,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
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
          padding: 10,
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              if (label === 'Prompt Length (chars)') {
                return `${label}: ${value.toLocaleString()} characters`;
              } else if (label === 'Context Usage %') {
                return `${label}: ${value.toFixed(1)}%`;
              } else {
                return `${label}: ${value.toLocaleString()}`;
              }
            },
            afterBody: function(context) {
              const index = context[0].dataIndex;
              const count = buckets[index].count;
              return count > 0 ? `\n${count} prompt${count !== 1 ? 's' : ''}` : '';
            }
          }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Characters',
            font: { size: 11 }
          },
          ticks: {
            callback: function(value) {
              return value >= 1000 ? (value/1000).toFixed(1) + 'k' : value;
            }
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Context %',
            font: { size: 11 }
          },
          ticks: {
            callback: function(value) {
              return value.toFixed(0) + '%';
            }
          },
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
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
function findRelatedPrompts(event, timeWindowMinutes = 5) {
  if (!event || !state.data.prompts || state.data.prompts.length === 0) {
    return [];
  }

  const eventTime = new Date(event.timestamp).getTime();
  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  
  // Extract workspace from event
  const eventWorkspace = event.workspace_path || event.details?.workspace_path || '';
  
  // Filter prompts by workspace and time proximity
  const related = state.data.prompts
    .filter(prompt => {
      // Check workspace match
      const promptWorkspace = prompt.workspacePath || prompt.workspaceId || '';
      const workspaceMatch = !eventWorkspace || !promptWorkspace || 
                            eventWorkspace.includes(promptWorkspace) || 
                            promptWorkspace.includes(eventWorkspace);
      
      if (!workspaceMatch) return false;
      
      // Check temporal proximity (prompts should be BEFORE the event)
      const promptTime = new Date(prompt.timestamp).getTime();
      const timeDiff = eventTime - promptTime;
      
      // Prompt should be within the time window BEFORE the event
      return timeDiff >= 0 && timeDiff <= timeWindowMs;
    })
    .map(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      const timeDiff = eventTime - promptTime;
      
      // Calculate relevance score (closer in time = higher score)
      const temporalScore = 1 - (timeDiff / timeWindowMs);
      const workspaceScore = eventWorkspace && prompt.workspacePath && 
                            eventWorkspace === prompt.workspacePath ? 1.0 : 0.5;
      
      return {
        ...prompt,
        relevanceScore: (temporalScore * 0.7) + (workspaceScore * 0.3),
        timeDiffSeconds: Math.floor(timeDiff / 1000)
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return related;
}

async function showEventModal(eventId) {
  // Check if it's an event or a prompt
  let event = state.data.events.find(e => e.id === eventId || e.timestamp === eventId);
  let prompt = state.data.prompts.find(p => p.id === eventId || p.timestamp === eventId);
  
  // If not in cache, try fetching from API
  if (!event && !prompt) {
    try {
      console.log(`[MODAL] Event/prompt ${eventId} not in cache, fetching from API...`);
      
      // Try fetching as prompt first
      const promptResponse = await fetch(`http://localhost:43917/api/prompts/${eventId}`);
      if (promptResponse.ok) {
        const data = await promptResponse.json();
        if (data.success && data.data) {
          prompt = data.data;
        }
      }
      
      // If not found as prompt, try as event
      if (!prompt) {
        const eventResponse = await fetch(`http://localhost:43917/api/activity/${eventId}`);
        if (eventResponse.ok) {
          const data = await eventResponse.json();
          if (data.success && data.data) {
            event = data.data;
          }
        }
      }
    } catch (error) {
      console.error('[MODAL] Error fetching event/prompt:', error);
    }
    
    // If still not found, show error
    if (!event && !prompt) {
      const modal = document.getElementById('eventModal');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');
      
      if (modal && title && body) {
        title.textContent = 'Not Found';
        body.innerHTML = `
          <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-muted);">
            <p>Event/Prompt #${eventId} could not be found.</p>
            <p style="font-size: var(--text-sm); margin-top: var(--space-md);">It may have been removed or is not yet loaded.</p>
          </div>
        `;
        modal.classList.add('active');
      }
      return;
    }
  }

  const modal = document.getElementById('eventModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  
  // Handle prompt display
  if (prompt && !event) {
    await showPromptInModal(prompt, modal, title, body);
    return;
  }

  title.textContent = getEventTitle(event);
  
  // Fetch related screenshots
  let relatedScreenshots = [];
  try {
    const screenshotsResponse = await fetch(`http://localhost:43917/api/screenshots/near/${event.timestamp}`);
    if (screenshotsResponse.ok) {
      const screenshotsData = await screenshotsResponse.json();
      if (screenshotsData.success) {
        relatedScreenshots = screenshotsData.screenshots;
      }
    }
  } catch (error) {
    console.warn('Could not fetch screenshots:', error);
  }
  
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    
    // Find related prompts by temporal proximity and workspace
    const relatedPrompts = findRelatedPrompts(event);
    const eventTime = new Date(event.timestamp).getTime();
    
    // Find related conversations (filter out unhelpful background composer state)
    const conversationsArray = Array.isArray(state.data.cursorConversations) ? state.data.cursorConversations : [];
    const relatedConversations = conversationsArray.filter(c => {
      if (!c || !c.timestamp) return false;
      
      // Filter out non-useful internal state mappings
      if (c.id && (
        c.id.includes('backgroundComposer.persistentData') ||
        c.id.includes('backgroundComposer.windowBcMapping') ||
        c.id.includes('workbench.backgroundComposer')
      )) {
        return false;
      }
      
      const convTime = new Date(c.timestamp).getTime();
      const diff = Math.abs(eventTime - convTime);
      return diff < 10 * 60 * 1000; // 10 minutes
    });
    
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        
        <!-- Event Details -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Event Details</h4>
          <div style="display: grid; gap: var(--space-sm);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Type:</span>
              <span style="color: var(--color-text);">${event.type || 'Unknown'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Time:</span>
              <span style="color: var(--color-text);">${new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Workspace:</span>
              <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${truncate(event.workspace_path || 'Unknown', 40)}</span>
            </div>
            ${details?.file_path ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">File:</span>
                <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-sm);">${details.file_path}</span>
              </div>
            ` : ''}
            ${details?.file_path && isImageFile(details.file_path) ? `
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-sm);">Screenshot Preview:</div>
                <div style="border-radius: var(--radius-md); overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; max-height: 400px;">
                  <img src="file://${details.file_path}" 
                       alt="Screenshot" 
                       style="max-width: 100%; max-height: 400px; object-fit: contain;"
                       onerror="this.parentElement.innerHTML = '<div style=\\'padding: var(--space-lg); color: var(--color-text-muted); text-align: center;\\'>Image not accessible<br><span style=\\'font-size: 0.85em; font-family: var(--font-mono);\\'>Path: ${details.file_path}</span></div>'">
                </div>
                <div style="margin-top: var(--space-sm); text-align: center;">
                  <a href="file://${details.file_path}" target="_blank" style="color: var(--color-accent); font-size: var(--text-sm); text-decoration: none;">
                    Open in Finder
                  </a>
                </div>
              </div>
            ` : ''}
            ${details?.lines_added !== undefined || details?.chars_added !== undefined ? `
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-lg); text-align: center;">
                  <div>
                    <div style="font-size: var(--text-xl); color: var(--color-success); font-weight: 600; margin-bottom: var(--space-xs);">
                      +${details.lines_added || 0}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Added</div>
                    <div style="font-size: var(--text-sm); color: var(--color-success); margin-top: var(--space-xs);">
                      +${details.chars_added || 0} chars
                    </div>
                  </div>
                  <div>
                    <div style="font-size: var(--text-xl); color: var(--color-error); font-weight: 600; margin-bottom: var(--space-xs);">
                      -${details.lines_removed || 0}
                    </div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Removed</div>
                    <div style="font-size: var(--text-sm); color: var(--color-error); margin-top: var(--space-xs);">
                      -${details.chars_deleted || 0} chars
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        ${event.context ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Context Information</h4>
            <div style="display: grid; gap: var(--space-md);">
              
              ${event.context.atFiles && event.context.atFiles.length > 0 ? `
                <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #10b981;">
                  <div style="font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
                    <span>[FILE] @ Referenced Files</span>
                    <span style="background: #10b981; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${event.context.atFiles.length}</span>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                    ${event.context.atFiles.map(file => `
                      <span style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 4px;">
                        ${file.reference || file.fileName || file.filePath}
                      </span>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              
              ${(event.context.contextFiles?.attachedFiles?.length || 0) + (event.context.contextFiles?.codebaseFiles?.length || 0) > 0 ? `
                <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #3b82f6;">
                  <div style="font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
                    <span>Context Files</span>
                    <span style="background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">
                      ${(event.context.contextFiles?.attachedFiles?.length || 0) + (event.context.contextFiles?.codebaseFiles?.length || 0)}
                    </span>
                  </div>
                  <div style="display: grid; gap: var(--space-xs);">
                    ${event.context.contextFiles?.attachedFiles?.map(file => `
                      <div style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${file.name || file.path}</span>
                        <span style="font-size: 10px; padding: 2px 4px; background: rgba(59, 130, 246, 0.2); border-radius: 3px;">attached</span>
                      </div>
                    `).join('') || ''}
                    ${event.context.contextFiles?.codebaseFiles?.slice(0, 5).map(file => `
                      <div style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(59, 130, 246, 0.05); color: #60a5fa; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${file.name || file.path}</span>
                        <span style="font-size: 10px; padding: 2px 4px; background: rgba(59, 130, 246, 0.1); border-radius: 3px;">codebase</span>
                      </div>
                    `).join('') || ''}
                    ${(event.context.contextFiles?.codebaseFiles?.length || 0) > 5 ? `
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted); padding: 4px 8px; text-align: center;">
                        +${event.context.contextFiles.codebaseFiles.length - 5} more files
                      </div>
                    ` : ''}
                  </div>
                </div>
              ` : ''}
              
              ${event.context.browserState && event.context.browserState.tabs && event.context.browserState.tabs.length > 0 ? `
                <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid #8b5cf6;">
                  <div style="font-weight: 600; margin-bottom: var(--space-sm); color: var(--color-text); display: flex; align-items: center; gap: var(--space-xs);">
                    <span>[SYSTEM] UI State</span>
                    <span style="background: #8b5cf6; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${event.context.browserState.tabs.length} tabs</span>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
                    ${event.context.browserState.tabs.map(tab => `
                      <span style="font-family: var(--font-mono); font-size: var(--text-xs); padding: 4px 8px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; border-radius: 4px; ${tab.isActive ? 'font-weight: 600; border: 1px solid #8b5cf6;' : ''}">
                        ${tab.name || tab.path}
                      </span>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              
            </div>
          </div>
        ` : ''}

        ${relatedScreenshots.length > 0 ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
              <span>Related Screenshots</span>
              <span style="background: #f59e0b; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px;">${relatedScreenshots.length}</span>
            </h4>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-md);">
              Screenshots captured within 5 minutes of this event
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--space-md);">
              ${relatedScreenshots.map(screenshot => {
                const timeDiff = Math.abs(new Date(event.timestamp).getTime() - new Date(screenshot.timestamp).getTime());
                const minutesAgo = Math.floor(timeDiff / 60000);
                const secondsAgo = Math.floor((timeDiff % 60000) / 1000);
                const timingText = minutesAgo > 0 ? `${minutesAgo}m ${secondsAgo}s` : `${secondsAgo}s`;
                const isBefore = new Date(screenshot.timestamp) < new Date(event.timestamp);
                
                return `
                  <div style="border: 2px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; background: var(--color-bg); transition: all 0.2s;" 
                       onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.15)';" 
                       onmouseout="this.style.transform=''; this.style.boxShadow='';">
                    <div style="position: relative; background: #000; aspect-ratio: 16/9; overflow: hidden;">
                      <img src="file://${screenshot.path}" 
                           alt="${screenshot.fileName}" 
                           style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;"
                           onclick="window.open('file://${screenshot.path}', '_blank')"
                           onerror="this.parentElement.innerHTML = '<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); padding: var(--space-md); text-align: center; flex-direction: column;\\'>Image<div style=\\'font-size: 0.75em; margin-top: 8px;\\'>Screenshot not accessible</div></div>'">
                      <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                        ${timingText} ${isBefore ? 'before' : 'after'}
                      </div>
                    </div>
                    <div style="padding: var(--space-sm);">
                      <div style="font-size: var(--text-xs); font-family: var(--font-mono); color: var(--color-text); margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${screenshot.fileName}">
                        ${screenshot.fileName}
                      </div>
                      <div style="font-size: 10px; color: var(--color-text-muted);">
                        ${new Date(screenshot.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${details?.before_content !== undefined && details?.after_content !== undefined && (details.before_content || details.after_content) ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Code Diff</h4>
            <div style="display: grid; gap: var(--space-md);">
              ${details.before_content ? `
                <div>
                  <div style="padding: var(--space-xs) var(--space-sm); background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--text-xs); color: var(--color-error); font-weight: 500;">
                    Before (${details.before_content.split('\\n').length} lines)
                  </div>
                  <div class="code-block" style="max-height: 250px; overflow-y: auto; border-radius: 0 0 var(--radius-sm) var(--radius-sm);">
                    <pre style="margin: 0; font-size: var(--text-xs); line-height: 1.5;">${escapeHtml(details.before_content)}</pre>
                  </div>
                </div>
              ` : ''}
              ${details.after_content ? `
                <div>
                  <div style="padding: var(--space-xs) var(--space-sm); background: rgba(34, 197, 94, 0.1); border-radius: var(--radius-sm) var(--radius-sm) 0 0; font-size: var(--text-xs); color: var(--color-success); font-weight: 500;">
                    After (${details.after_content.split('\\n').length} lines)
                  </div>
                  <div class="code-block" style="max-height: 250px; overflow-y: auto; border-radius: 0 0 var(--radius-sm) var(--radius-sm);">
                    <pre style="margin: 0; font-size: var(--text-xs); line-height: 1.5;">${escapeHtml(details.after_content)}</pre>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${relatedPrompts.length > 0 ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); display: flex; align-items: center; gap: var(--space-sm);">
              <span>Related AI Prompts</span>
              <span style="background: var(--color-accent); color: white; font-size: var(--text-xs); padding: 2px 8px; border-radius: 12px;">${relatedPrompts.length}</span>
            </h4>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md);">
              Prompts from the same workspace within 5 minutes before this event, ordered by relevance.
            </div>
            <div style="display: grid; gap: var(--space-sm);">
              ${relatedPrompts.slice(0, 5).map((prompt, idx) => {
                const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
                const displayText = promptText.length > 150 ? promptText.substring(0, 150) + '...' : promptText;
                const timeDiffText = prompt.timeDiffSeconds < 60 ? 
                  `${prompt.timeDiffSeconds}s before` : 
                  `${Math.floor(prompt.timeDiffSeconds / 60)}m ${prompt.timeDiffSeconds % 60}s before`;
                const relevancePercent = Math.round(prompt.relevanceScore * 100);
                
                return `
                <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid var(--color-accent); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s;" 
                     onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';" 
                     onmouseout="this.style.transform=''; this.style.boxShadow='';"
                     onclick="closeEventModal(); setTimeout(() => showEventModal('${prompt.id}'), 100)">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                    <div style="display: flex; align-items: center; gap: var(--space-xs);">
                      <span style="color: var(--color-primary); font-weight: 600; font-size: var(--text-xs);">
                        #${idx + 1}
                      </span>
                      <span style="font-size: var(--text-xs); color: var(--color-text-muted);">
                        ${timeDiffText}
                      </span>
                      <span style="font-size: var(--text-xs); color: var(--color-accent); font-weight: 500;">
                        ${relevancePercent}% match
                      </span>
                    </div>
                    <span class="badge badge-prompt" style="font-size: 10px; padding: 2px 6px;">
                      ${prompt.source || 'cursor'}
                    </span>
                  </div>
                  <div style="font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-xs); line-height: 1.5;">
                    ${escapeHtml(displayText)}
                  </div>
                  ${prompt.workspaceName || prompt.composerId ? `
                    <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-sm);">
                      ${prompt.workspaceName ? `
                        <span style="font-size: 10px; padding: 2px 6px; background: var(--color-bg-alt); color: var(--color-text-muted); border-radius: 4px; font-family: var(--font-mono);">
                          ${prompt.workspaceName}
                        </span>
                      ` : ''}
                      ${prompt.composerId ? `
                        <span style="font-size: 10px; padding: 2px 6px; background: var(--color-bg-alt); color: var(--color-text-muted); border-radius: 4px;">
                          Composer
                        </span>
                      ` : ''}
                      ${prompt.linesAdded > 0 || prompt.linesRemoved > 0 ? `
                        <span style="font-size: 10px; padding: 2px 6px; background: var(--color-bg-alt); color: var(--color-text-muted); border-radius: 4px;">
                          <span style="color: var(--color-success);">+${prompt.linesAdded || 0}</span>
                          /
                          <span style="color: var(--color-error);">-${prompt.linesRemoved || 0}</span>
                        </span>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              `}).join('')}
              ${relatedPrompts.length > 5 ? `
                <div style="text-align: center; padding: var(--space-md); color: var(--color-text-muted); font-size: var(--text-sm); background: var(--color-bg); border-radius: var(--radius-md); border: 1px dashed var(--color-border);">
                  + ${relatedPrompts.length - 5} more prompts (${Math.round(relatedPrompts.slice(5).reduce((sum, p) => sum + p.relevanceScore, 0) / (relatedPrompts.length - 5) * 100)}% avg match)
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${relatedConversations.length > 0 ? `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">
              Related Conversations (${relatedConversations.length})
            </h4>
            <div style="display: grid; gap: var(--space-sm);">
              ${relatedConversations.slice(0, 2).map(conv => `
                <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid var(--color-primary); border-radius: var(--radius-md);">
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
                    ${conv.type} • ${formatTimeAgo(conv.timestamp)}
                  </div>
                  <div style="font-size: var(--text-sm); color: var(--color-text);">
                    ID: ${conv.id}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${state.data.cursorDbStats ? `
          <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
              Cursor Database Stats
            </div>
            <div style="display: flex; gap: var(--space-lg); font-size: var(--text-sm);">
              <span>Conversations: <strong>${state.data.cursorDbStats.totalConversations || 0}</strong></span>
              <span>Prompts: <strong>${state.data.cursorDbStats.totalPrompts || 0}</strong></span>
              <span>Workspaces: <strong>${state.data.cursorDbStats.workspaces || 0}</strong></span>
            </div>
          </div>
        ` : ''}

      </div>
    `;
  } catch (error) {
    body.innerHTML = `<div class="empty-state-text">Error loading event details: ${error.message}</div>`;
  }

  modal.classList.add('active');
}

function showPromptInModal(prompt, modal, title, body) {
  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
  const isJsonLike = promptText.startsWith('{') || promptText.startsWith('[');
  
  // Parse prompt data to determine type and extract metadata
  let titleText = 'AI Conversation';
  let promptType = 'unknown';
  let metadata = {};
  let conversationDetails = null;
  
  if (isJsonLike) {
    try {
      const parsed = JSON.parse(promptText);
      
      // Detect composer data
      if (parsed.allComposers && Array.isArray(parsed.allComposers)) {
        promptType = 'composer';
        titleText = 'Composer Session';
        const composer = parsed.allComposers[0];
        if (composer) {
          metadata = {
            composerId: composer.composerId,
            name: composer.name || 'Unnamed conversation',
            mode: composer.unifiedMode || composer.forceMode || 'unknown',
            createdAt: composer.createdAt ? new Date(composer.createdAt).toLocaleString() : null,
            lastUpdated: composer.lastUpdatedAt ? new Date(composer.lastUpdatedAt).toLocaleString() : null,
            totalComposers: parsed.allComposers.length
          };
          conversationDetails = {
            name: composer.name,
            linesAdded: composer.totalLinesAdded,
            linesRemoved: composer.totalLinesRemoved,
            contextUsage: composer.contextUsagePercent
          };
        }
      }
      // Detect panel/view state
      else if (Object.keys(parsed).some(k => k.includes('workbench.panel'))) {
        promptType = 'panel-state';
        titleText = '[SYSTEM] AI Chat Panel State';
        const panels = Object.keys(parsed).filter(k => k.includes('workbench.panel'));
        metadata = {
          panelCount: panels.length,
          panels: panels.map(k => ({
            id: k.split('.').pop() || k,
            collapsed: parsed[k].collapsed,
            hidden: parsed[k].isHidden,
            size: parsed[k].size
          }))
        };
      }
      // Detect setup/terminal data
      else if (parsed.setupPath2 || parsed.terminals) {
        promptType = 'setup';
        titleText = '[CONFIG] Development Setup';
        metadata = {
          setupPath: parsed.setupPath2,
          terminals: parsed.terminals?.length || 0,
          commands: parsed.ranTerminalCommands?.length || 0,
          currentStep: parsed.currentSetupStep
        };
      }
      // Background composer mapping
      else if (parsed.composerIdToWindowId || prompt.type === 'background-composer') {
        promptType = 'background-composer';
        titleText = 'Background Composer Mapping';
        metadata = {
          mappings: Object.keys(parsed.composerIdToWindowId || {}).length
        };
      }
    } catch (e) {
      // Not valid JSON
      promptType = 'text';
    }
  } else {
    promptType = 'text';
    titleText = 'Conversation';
  }
  
  // Override with explicit prompt type if present
  if (prompt.type === 'conversation') {
    titleText = 'Composer Conversation';
    promptType = 'conversation';
  } else if (prompt.type === 'background-composer') {
    titleText = 'Background Composer';
    promptType = 'background-composer';
  }
  
  title.textContent = titleText;
  
  // Find related events (within 5 minutes of prompt)
  const promptTime = new Date(prompt.timestamp).getTime();
  const relatedEvents = state.data.events.filter(e => {
    const eventTime = new Date(e.timestamp).getTime();
    const diff = Math.abs(promptTime - eventTime);
    return diff < 5 * 60 * 1000; // 5 minutes
  });
  
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
      
      <!-- Basic Metadata -->
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Metadata</h4>
        <div style="display: grid; gap: var(--space-sm);">
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Type:</span>
            <span style="color: var(--color-text);"><span class="badge badge-prompt">${promptType}</span></span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Captured:</span>
            <span style="color: var(--color-text);">${new Date(prompt.timestamp).toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
            <span style="color: var(--color-text-muted);">Source:</span>
            <span style="color: var(--color-text);">${prompt.source || 'cursor-database'}</span>
          </div>
          ${prompt.modelName || prompt.modelType ? `
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Model:</span>
              <span style="color: var(--color-text);">
                <span class="badge" style="background: var(--color-accent); color: white;">
                  ${prompt.modelName || prompt.modelType}
                </span>
                ${prompt.isAuto ? '<span class="badge" style="margin-left: 4px; background: var(--color-info); color: white;">Auto</span>' : ''}
              </span>
            </div>
          ` : ''}
          ${prompt.forceMode ? `
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Mode:</span>
              <span style="color: var(--color-text);"><span class="badge">${prompt.forceMode}</span></span>
            </div>
          ` : ''}
          ${prompt.workspaceId ? `
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Workspace:</span>
              <span style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${prompt.workspaceName || prompt.workspaceId.substring(0, 16)}</span>
            </div>
          ` : ''}
          ${prompt.mode || prompt.modelType ? `
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">AI Mode:</span>
              <span class="badge" style="background: ${(prompt.mode === 'agent' || prompt.isAuto) ? 'var(--color-accent)' : prompt.mode === 'chat' ? 'var(--color-info)' : 'var(--color-secondary)'}; color: white; font-weight: 600;">
                ${(prompt.mode || prompt.modelType || 'unknown').toUpperCase()}${prompt.isAuto ? ' (AUTO)' : ''}
              </span>
            </div>
          ` : ''}
          ${prompt.contextUsage && prompt.contextUsage > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Context Usage:</span>
              <span style="color: var(--color-warning); font-weight: 600; font-size: var(--text-lg);">${prompt.contextUsage.toFixed(1)}%</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Type-specific details -->
      ${promptType === 'composer' && metadata.name ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Composer Session</h4>
          <div style="padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-accent);">
            <div style="font-size: var(--text-lg); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md);">
              ${escapeHtml(metadata.name)}
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-md);">
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Created</div>
                <div style="font-size: var(--text-sm); color: var(--color-text);">${metadata.createdAt || 'Unknown'}</div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Last Updated</div>
                <div style="font-size: var(--text-sm); color: var(--color-text);">${metadata.lastUpdated || 'Unknown'}</div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Model Mode</div>
                <div style="font-size: var(--text-sm); color: var(--color-text);">
                  <span class="badge" style="background: ${metadata.mode === 'agent' ? 'var(--color-accent)' : metadata.mode === 'chat' ? 'var(--color-info)' : 'var(--color-secondary)'}; color: white; font-weight: 600;">
                    ${metadata.mode.toUpperCase()}${metadata.mode === 'agent' ? ' (AUTO)' : ''}
                  </span>
                </div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Composer ID</div>
                <div style="font-size: var(--text-xs); color: var(--color-text); font-family: var(--font-mono);">${metadata.composerId?.substring(0, 12)}...</div>
              </div>
            </div>
            ${conversationDetails && (conversationDetails.linesAdded !== undefined || conversationDetails.linesRemoved !== undefined || conversationDetails.contextUsage !== undefined) ? `
              <div style="display: flex; gap: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
                ${conversationDetails.linesAdded !== undefined ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: var(--text-xl); color: var(--color-success); font-weight: 600;">+${conversationDetails.linesAdded}</div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Added</div>
                  </div>
                ` : ''}
                ${conversationDetails.linesRemoved !== undefined ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: var(--text-xl); color: var(--color-error); font-weight: 600;">-${conversationDetails.linesRemoved}</div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Lines Removed</div>
                  </div>
                ` : ''}
                ${conversationDetails.contextUsage !== undefined ? `
                  <div style="flex: 1; text-align: center;">
                    <div style="font-size: var(--text-xl); color: var(--color-accent); font-weight: 600;">${conversationDetails.contextUsage}%</div>
                    <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Context Used</div>
                  </div>
                ` : ''}
              </div>
            ` : ''}
            <div style="margin-top: var(--space-md); padding: var(--space-md); background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: var(--radius-md);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="flex: 1;">
                  <div style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
                    View Full Conversation
                  </div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                    Cursor stores conversation messages in memory. Open Composer to see the full chat history.
                  </div>
                </div>
                <button 
                  onclick="copyToClipboard('${metadata.composerId}', 'Composer ID copied!'); alert('Composer ID copied: ${metadata.composerId}\\n\\nTo find this conversation in Cursor:\\n1. Open Composer\\n2. Look for: ${escapeHtml(metadata.name).replace(/'/g, "\\'")}');" 
                  style="padding: var(--space-sm) var(--space-md); background: var(--color-primary); color: white; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); white-space: nowrap; margin-left: var(--space-md);">
                  [CLIPBOARD] Copy ID
                </button>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
      
      ${promptType === 'panel-state' && metadata.panels ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">[SYSTEM] AI Chat Panels (${metadata.panelCount})</h4>
          <div style="display: grid; gap: var(--space-sm);">
            ${metadata.panels.map(panel => `
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text);">
                    ${panel.id.substring(0, 16)}...
                  </div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px;">
                    ${panel.collapsed ? 'Collapsed' : 'Expanded'} • 
                    ${panel.hidden ? 'Hidden' : 'Visible'}
                    ${panel.size ? ` • ${Math.round(panel.size)}px` : ''}
                  </div>
                </div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background: ${panel.hidden ? '#94a3b8' : '#22c55e'};"></div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${promptType === 'setup' && metadata.setupPath ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">[CONFIG] Development Setup</h4>
          <div style="padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Setup Path</div>
                <div style="font-size: var(--text-sm); color: var(--color-text);"><code>${metadata.setupPath}</code></div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Current Step</div>
                <div style="font-size: var(--text-sm); color: var(--color-text);"><code>${metadata.currentStep}</code></div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Terminals</div>
                <div style="font-size: var(--text-lg); color: var(--color-text); font-weight: 600;">${metadata.terminals}</div>
              </div>
              <div>
                <div style="font-size: var(--text-xs); color: var(--color-text-muted);">Commands Run</div>
                <div style="font-size: var(--text-lg); color: var(--color-text); font-weight: 600;">${metadata.commands}</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}
      
      ${promptType === 'background-composer' && metadata.mappings ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Background Composer</h4>
          <div style="padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md); text-align: center;">
            <div style="font-size: var(--text-2xl); color: var(--color-text); font-weight: 600; margin-bottom: var(--space-xs);">
              ${metadata.mappings}
            </div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">
              Window Mappings
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Prompt Content -->
      ${!isJsonLike || promptText.length < 200 ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Conversation Title</h4>
          <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-accent);">
            <div style="font-size: var(--text-lg); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-sm);">
              ${escapeHtml(promptText)}
            </div>
            ${prompt.subtitle ? `
              <div style="font-size: var(--text-sm); color: var(--color-text-muted);">
                Files: ${escapeHtml(prompt.subtitle)}
              </div>
            ` : ''}
          </div>
          ${prompt.type === 'conversation' || prompt.composerId ? `
            <div style="margin-top: var(--space-sm); padding: var(--space-sm); background: rgba(99, 102, 241, 0.1); border-radius: var(--radius-sm);">
              <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                ℹ️ Note: Full conversation messages are stored in Cursor's internal cache and are not accessible via the database. 
                Only metadata (title, file list, statistics) is available.
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      ${relatedEvents.length > 0 ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">
            Related File Changes (${relatedEvents.length})
          </h4>
          <div style="display: grid; gap: var(--space-sm);">
            ${relatedEvents.slice(0, 5).map(event => `
              <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid var(--color-primary); border-radius: var(--radius-md); cursor: pointer;" onclick="closeEventModal(); setTimeout(() => showEventModal('${event.id || event.timestamp}'), 100)">
                <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
                  ${formatTimeAgo(event.timestamp)} • ${event.type || 'file_change'}
                </div>
                <div style="font-size: var(--text-sm); color: var(--color-text); font-family: var(--font-mono);">
                  ${getEventTitle(event)}
                </div>
              </div>
            `).join('')}
            ${relatedEvents.length > 5 ? `
              <div style="text-align: center; padding: var(--space-sm); color: var(--color-text-muted); font-size: var(--text-sm);">
                + ${relatedEvents.length - 5} more events
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

    </div>
  `;
  
  modal.classList.add('active');
}

function showThreadModal(threadId) {
  const thread = groupIntoThreads(state.data.entries).find(t => t.id === threadId);
  if (!thread) return;

  const modal = document.getElementById('threadModal');
  const title = document.getElementById('threadModalTitle');
  const body = document.getElementById('threadModalBody');

  title.textContent = `Thread ${threadId.substring(0, 8)}`;
  
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-lg);">
      ${thread.messages.map(msg => `
        <div style="padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-sm);">
            ${new Date(msg.timestamp).toLocaleString()}
          </div>
          ${msg.prompt ? `
            <div style="margin-bottom: var(--space-md);">
              <div style="font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">Prompt:</div>
              <div style="color: var(--color-text-muted);">${escapeHtml(msg.prompt)}</div>
            </div>
          ` : ''}
          ${msg.response ? `
            <div>
              <div style="font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">Response:</div>
              <div style="color: var(--color-text-muted);">${escapeHtml(msg.response)}</div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;

  modal.classList.add('active');
}

function closeThreadModal() {
  document.getElementById('threadModal').classList.remove('active');
}

function showTerminalModal(id) {
  // Find the terminal command by ID
  const cmd = state.data.terminalCommands.find(c => c.id === id);
  
  const modal = document.getElementById('eventModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  
  if (!modal || !title || !body) {
    console.error('Modal elements not found');
    return;
  }
  
  if (!cmd) {
    console.warn('Terminal command not found:', id);
    return;
  }
  
  try {
    const isError = cmd.exit_code && cmd.exit_code !== 0;
    const icon = isError ? '[ERROR]' : '>';
    
    title.innerHTML = `${icon} Terminal Command`;
    
    let html = `
      <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
        
        <!-- Command Details -->
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Command Details</h4>
          <div style="display: grid; gap: var(--space-sm);">
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Command:</span>
              <code style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-sm); max-width: 500px; overflow-x: auto;">${escapeHtml(cmd.command)}</code>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Source:</span>
              <span class="badge" style="background: #6366f1; color: white;">${cmd.source || 'unknown'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
              <span style="color: var(--color-text-muted);">Timestamp:</span>
              <span style="color: var(--color-text);">${new Date(cmd.timestamp).toLocaleString()}</span>
            </div>
            ${cmd.shell ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Shell:</span>
                <span class="badge">${cmd.shell}</span>
              </div>
            ` : ''}
            ${cmd.workspace ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Workspace:</span>
                <code style="color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-xs);">${escapeHtml(cmd.workspace)}</code>
              </div>
            ` : ''}
            ${cmd.exit_code !== null && cmd.exit_code !== undefined ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Exit Code:</span>
                <span class="badge" style="background: ${isError ? '#ef4444' : '#10b981'}; color: white;">${cmd.exit_code}</span>
              </div>
            ` : ''}
            ${cmd.duration ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Duration:</span>
                <span style="color: var(--color-text);">${cmd.duration}ms</span>
              </div>
            ` : ''}
          </div>
        </div>
    `;
    
    // Show command output if available
    if (cmd.output) {
      html += `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Output</h4>
          <pre style="padding: var(--space-md); background: #1e1e1e; color: #d4d4d4; border-radius: var(--radius-md); overflow-x: auto; max-height: 400px; font-size: 12px; line-height: 1.5;"><code>${escapeHtml(cmd.output)}</code></pre>
        </div>
      `;
    }
    
    // Show error message if available
    if (cmd.error) {
      html += `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-error);">Error</h4>
          <div style="padding: var(--space-md); background: #fee2e2; color: #dc2626; border-radius: var(--radius-md); font-family: var(--font-mono); font-size: var(--text-sm);">
            ${escapeHtml(cmd.error)}
          </div>
        </div>
      `;
    }
    
    // Show related file changes if linked
    if (cmd.linked_entry_id) {
      const relatedEntry = state.data.events.find(e => e.id === cmd.linked_entry_id);
      if (relatedEntry) {
        html += `
          <div>
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Related File Change</h4>
            <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
              <div style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); margin-bottom: var(--space-xs);">
                ${escapeHtml(relatedEntry.file_path || 'Unknown file')}
              </div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                ${new Date(relatedEntry.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        `;
      }
    }
    
    html += `</div>`;
    
    body.innerHTML = html;
    modal.classList.add('active');
    
  } catch (error) {
    console.error('Error showing terminal modal:', error);
    title.textContent = 'Error';
    body.innerHTML = `<div style="color: var(--color-error);">Error loading terminal command details: ${error.message}</div>`;
    modal.classList.add('active');
  }
}

function closeEventModal() {
  const modal = document.getElementById('eventModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// Make modal functions globally accessible
window.showEventModal = showEventModal;
window.showTerminalModal = showTerminalModal;
window.closeEventModal = closeEventModal;
window.closeThreadModal = closeThreadModal;

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
 * Export database as JSON
 */
async function exportDatabase() {
  try {
    console.log('📤 Exporting database...');
    
    // Show loading state
    const exportBtn = document.querySelector('.export-btn');
    const originalHTML = exportBtn.innerHTML;
    exportBtn.innerHTML = '<span>Exporting...</span>';
    exportBtn.disabled = true;
    
    // Fetch data from API
    const response = await fetch(`${CONFIG.API_BASE}/api/export/database`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Export failed');
    }
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `cursor-telemetry-export-${timestamp}.json`;
    
    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(result.data, null, 2);
    
    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`[SUCCESS] Exported ${result.data.metadata.totalEntries} entries, ${result.data.metadata.totalPrompts} prompts, ${result.data.metadata.totalEvents} events, ${result.data.metadata.totalTerminalCommands || 0} terminal commands, ${result.data.metadata.totalContextSnapshots || 0} context snapshots`);
    
    // Show success feedback
    exportBtn.innerHTML = '<span>Exported!</span>';
    setTimeout(() => {
      exportBtn.innerHTML = originalHTML;
      exportBtn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('Export error:', error);
    const exportBtn = document.querySelector('.export-btn');
    exportBtn.innerHTML = '<span>✗ Failed</span>';
    setTimeout(() => {
      exportBtn.innerHTML = originalHTML;
      exportBtn.disabled = false;
    }, 2000);
  }
}

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
      
      // Initialize search engine
      initializeSearch();
      
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
          // Don't reinitialize search on every refresh - it's expensive!
          // Only rebuild if we have significantly more documents
        }
      } catch (error) {
        console.error('Refresh error:', error);
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
      } catch (error) {
        console.error('Refresh error:', error);
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

function showPromptModal(promptId) {
  const prompt = state.data.prompts.find(p => p.id == promptId);
  if (!prompt) {
    console.error('Prompt not found:', promptId);
    return;
  }

  const modal = document.getElementById('eventModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = 'Prompt Details';
  
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-xl);">
      
      <!-- Prompt Status -->
      <div>
        <div class="prompt-status ${prompt.status || 'pending'}" style="display: inline-flex; margin-bottom: var(--space-md);">
          ${getPromptStatusIcon(prompt.status)}
          ${prompt.status || 'pending'}
        </div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
          Captured ${new Date(prompt.timestamp).toLocaleString()}
        </div>
      </div>

      <!-- Prompt Content -->
      <div>
        <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Prompt Text</h4>
        <div class="code-block">
          <code>${escapeHtml(prompt.text || prompt.content || prompt.prompt || 'No content available')}</code>
        </div>
      </div>

      <!-- Metadata -->
      ${prompt.metadata ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Metadata</h4>
          <div style="display: grid; gap: var(--space-sm);">
            ${prompt.metadata.method ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Capture Method:</span>
                <span style="color: var(--color-text);">${prompt.metadata.method}</span>
              </div>
            ` : ''}
            ${prompt.metadata.complexity ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Complexity:</span>
                <span style="color: var(--color-text);">${prompt.metadata.complexity}</span>
              </div>
            ` : ''}
            ${prompt.metadata.intent ? `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                <span style="color: var(--color-text-muted);">Intent:</span>
                <span style="color: var(--color-text);">${prompt.metadata.intent}</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Linked Entry -->
      ${prompt.linked_entry_id ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Linked Conversation</h4>
          <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
            <div style="color: var(--color-text-muted);">This prompt is linked to conversation entry #${prompt.linked_entry_id}</div>
            <button class="btn btn-sm" style="margin-top: var(--space-md);" onclick="showThreadModal('${prompt.linked_entry_id}')">
              View Conversation
            </button>
          </div>
        </div>
      ` : `
        <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-warning);">
          <div style="color: var(--color-text-muted);">This prompt has not been linked to a conversation yet</div>
        </div>
      `}

    </div>
  `;

  modal.classList.add('active');
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
      (clipboardEnabled ? 
        'Clipboard monitoring is active! Copy text containing prompts and they will be captured automatically.' : 
        'Clipboard monitoring is disabled. Enable it in the companion config.json file by setting "enable_clipboard": true')
    );
  } catch (error) {
    alert('Error checking clipboard status. Make sure the companion service is running.');
  }
}

// ===================================
// Search Integration
// ===================================

let searchEngine = null;
let searchSelectedIndex = -1;
let searchCurrentResults = [];

/**
 * Initialize search engine when data is loaded
 */
async function initializeSearch() {
  try {
    if (!window.SearchEngine) {
      console.warn('SearchEngine class not available');
      return;
    }
    
    if (!window.lunr) {
      console.warn('Lunr.js not loaded');
      return;
    }
    
    console.log('Initializing search engine...');
    searchEngine = new window.SearchEngine();
    await searchEngine.initialize(state.data);
    console.log('Search engine initialized with', searchEngine.documents.length, 'documents');
  } catch (error) {
    console.error('Search engine initialization failed:', error);
  }
}

/**
 * Open search palette
 */
function openSearchPalette() {
  const palette = document.getElementById('searchPalette');
  const input = document.getElementById('searchInput');
  
  if (palette) {
    palette.classList.add('active');
    if (input) {
      setTimeout(() => {
        input.focus();
        input.value = '';
      }, 50); // Small delay to ensure modal is visible
      showSearchSuggestions();
    }
    
    // Log search engine status for debugging
    if (searchEngine) {
      console.log('Search ready with', searchEngine.documents?.length || 0, 'documents');
    } else {
      console.warn('Search engine not ready - initializing...');
      // Try to initialize if not already done
      initializeSearch();
    }
  }
}

/**
 * Close search palette
 */
function closeSearchPalette() {
  const palette = document.getElementById('searchPalette');
  if (palette) {
    palette.classList.remove('active');
    searchSelectedIndex = -1;
    searchCurrentResults = [];
  }
}

/**
 * Perform search
 */
function performSearch(query) {
  if (!query.trim()) {
    showSearchSuggestions();
    return;
  }
  
  if (!searchEngine) {
    console.warn('Search engine not initialized');
    const container = document.getElementById('searchResults');
    if (container) {
      container.innerHTML = `
        <div class="search-empty">
          <svg class="search-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <div>Search is initializing...</div>
          <div style="font-size: var(--text-xs); margin-top: var(--space-sm); color: var(--color-text-muted);">
            Please wait for data to load
          </div>
        </div>
      `;
    }
    return;
  }

  try {
    console.log('Searching for:', query);
    const results = searchEngine.search(query, { limit: 20 });
    console.log('[DATA] Found', results.length, 'results');
    searchCurrentResults = results;
    searchSelectedIndex = -1;
    renderSearchResults(results);
  } catch (error) {
    console.error('Search error:', error);
    const container = document.getElementById('searchResults');
    if (container) {
      container.innerHTML = `
        <div class="search-empty">
          <svg class="search-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-width="2"/>
          </svg>
          <div>Search error</div>
          <div style="font-size: var(--text-xs); margin-top: var(--space-sm); color: var(--color-text-muted);">
            ${error.message}
          </div>
        </div>
      `;
    }
  }
}

/**
 * Show search suggestions
 */
function showSearchSuggestions() {
  const suggestionsContainer = document.getElementById('searchSuggestions');
  const resultsContainer = document.getElementById('searchResults');
  
  if (!searchEngine || !suggestionsContainer) return;

  const suggestions = searchEngine.getSuggestions('');
  
  resultsContainer.innerHTML = '';
  
  if (suggestions.length === 0) {
    suggestionsContainer.innerHTML = `
      <div class="search-empty">
        <svg class="search-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" stroke-width="2"/>
          <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>Start typing to search...</div>
        <div style="font-size: var(--text-xs); margin-top: var(--space-sm);">
          Try: <code>type:prompt</code> or <code>workspace:cursor-telemetry</code>
        </div>
      </div>
    `;
    return;
  }

  suggestionsContainer.innerHTML = `
    <div style="padding: var(--space-sm); color: var(--color-text-muted); font-size: var(--text-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
      Recent Searches
    </div>
    ${suggestions.map(suggestion => `
      <div class="search-suggestion-item" onclick="applySearchSuggestion('${escapeHtml(suggestion)}')">
        <span class="search-suggestion-icon">→</span>
        <span>${escapeHtml(suggestion)}</span>
      </div>
    `).join('')}
  `;
}

/**
 * Apply search suggestion
 */
function applySearchSuggestion(suggestion) {
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = suggestion;
    input.focus();
    performSearch(suggestion);
  }
}

/**
 * Render search results
 */
function renderSearchResults(results) {
  const container = document.getElementById('searchResults');
  const suggestionsContainer = document.getElementById('searchSuggestions');
  
  if (!container) return;

  suggestionsContainer.innerHTML = '';

  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-empty">
        <svg class="search-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" stroke-width="2"/>
          <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>No results found</div>
        <div style="font-size: var(--text-xs); margin-top: var(--space-sm); color: var(--color-text-muted);">
          Try different keywords or filters
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = results.map((result, index) => {
    const icon = getSearchResultIcon(result.type);
    const typeColor = getSearchResultTypeColor(result.type);
    const time = new Date(result.timestamp).toLocaleString();
    
    return `
      <div class="search-result-item ${index === searchSelectedIndex ? 'selected' : ''}" 
           onclick="selectSearchResult(${index})"
           data-result-index="${index}">
        <div class="search-result-icon" style="border-color: ${typeColor};">
          ${icon}
        </div>
        <div class="search-result-content">
          <div class="search-result-title">
            ${escapeHtml(result.title)}
          </div>
          <div class="search-result-description">
            ${escapeHtml(result.content.substring(0, 150))}${result.content.length > 150 ? '...' : ''}
          </div>
          <div class="search-result-meta">
            <span class="search-result-badge" style="border-color: ${typeColor};">${result.type}</span>
            <span>${escapeHtml(result.workspace)}</span>
            <span>${time}</span>
            ${result.searchMethod ? `<span style="color: var(--color-text-muted); font-size: 10px;">${result.searchMethod}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Get icon for search result type
 */
function getSearchResultIcon(type) {
  const icons = {
    event: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" fill="currentColor"/>
      <path d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" stroke-width="2"/>
    </svg>`,
    prompt: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-1l-3 3z" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    workspace: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M3 7v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2h-1V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2H5a2 2 0 00-2 2z" stroke-width="2"/>
    </svg>`
  };
  return icons[type] || icons.event;
}

/**
 * Get color for search result type
 */
function getSearchResultTypeColor(type) {
  const colors = {
    event: 'var(--color-info)',
    prompt: 'var(--color-accent)',
    workspace: 'var(--color-success)'
  };
  return colors[type] || 'var(--color-border)';
}

/**
 * Select search result
 */
function selectSearchResult(index) {
  if (index < 0 || index >= searchCurrentResults.length) return;
  
  const result = searchCurrentResults[index];
  
  // Close search palette
  closeSearchPalette();
  
  // Navigate to the result
  if (result.type === 'event' || result.type === 'prompt') {
    showEventModal(result.raw.id || result.raw.timestamp);
  } else if (result.type === 'workspace') {
    // Switch to workspace and show workspace view
    state.currentWorkspace = result.raw.name || result.raw.path;
    switchView('workspace');
    renderCurrentView();
  }
}

/**
 * Navigate search results with keyboard
 */
function navigateSearchResults(direction) {
  if (searchCurrentResults.length === 0) return;

  if (direction === 'down') {
    searchSelectedIndex = (searchSelectedIndex + 1) % searchCurrentResults.length;
  } else if (direction === 'up') {
    searchSelectedIndex = searchSelectedIndex <= 0 ? searchCurrentResults.length - 1 : searchSelectedIndex - 1;
  }

  // Update UI
  const items = document.querySelectorAll('.search-result-item');
  items.forEach((item, index) => {
    if (index === searchSelectedIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// Setup search input handler
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  
  if (searchInput) {
    // Debounce search
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.trim();
        if (query) {
          performSearch(query);
        } else {
          showSearchSuggestions();
        }
      }, 300);
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSearchResults('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSearchResults('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchSelectedIndex >= 0) {
          selectSearchResult(searchSelectedIndex);
        } else if (searchCurrentResults.length > 0) {
          selectSearchResult(0);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeSearchPalette();
      }
    });
  }

  // Setup Cmd+K / Ctrl+K shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearchPalette();
    }
  });
});

// Global functions for HTML onclick handlers
window.showEventModal = showEventModal;
window.closeEventModal = closeEventModal;
window.showThreadModal = showThreadModal;
window.closeThreadModal = closeThreadModal;
window.renderEmbeddingsVisualization = renderEmbeddingsVisualization;
window.filterActivityByTimeRange = filterActivityByTimeRange;
window.refreshPrompts = refreshPrompts;
window.showPromptModal = showPromptModal;
window.checkClipboardStatus = checkClipboardStatus;
window.updateFileGraph = updateFileGraph;
window.resetFileGraphZoom = resetFileGraphZoom;
window.showFileInfo = showFileInfo;
window.openSearchPalette = openSearchPalette;
window.closeSearchPalette = closeSearchPalette;
window.applySearchSuggestion = applySearchSuggestion;
window.selectSearchResult = selectSearchResult;
window.initializeSearch = initializeSearch;

// Context File Analytics Functions
async function renderContextFileAnalytics() {
  const container = document.getElementById('contextFileAnalytics');
  if (!container) return;

  try {
    // Fetch from API instead of calculating from prompts
    const response = await fetch(`${CONFIG.API_BASE}/api/analytics/context`);
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('No context data available');
    }
    
    const stats = result.data;
    
    if (stats.totalAtFiles === 0 && stats.totalContextFiles === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context data will appear here once you use @ mentions in Cursor</div>
        </div>
      `;
      return;
    }
    
    const promptsWithContext = stats.withContext || 0;
    
    // Note: mostReferencedFiles data needs to be added to the API if needed
    const topFiles = [];

  container.innerHTML = `
    <div style="display: grid; gap: var(--space-xl);">
      <!-- Stats Summary -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-md);">
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 600; color: #10b981;">${stats.totalAtFiles}</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">@ Files Referenced</div>
        </div>
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 600; color: #3b82f6;">${stats.totalContextFiles}</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">Context Files</div>
        </div>
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 600; color: #8b5cf6;">${stats.totalUIStates}</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">UI States</div>
        </div>
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 2rem; font-weight: 600; color: var(--color-accent);">${promptsWithContext.length}</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">With Context</div>
        </div>
      </div>

      <!-- Most Referenced Files -->
      ${topFiles.length > 0 ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Most Referenced Files</h4>
          <div style="display: grid; gap: var(--space-sm);">
            ${topFiles.map(([fileName, count]) => {
              const percentage = stats.totalAtFiles > 0 ? Math.round((count / stats.totalAtFiles) * 100) : 0;
              return `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                  <div style="flex: 1;">
                    <div style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); margin-bottom: 4px;">${fileName}</div>
                    <div style="background: var(--color-bg-alt); height: 6px; border-radius: 3px; overflow: hidden;">
                      <div style="background: var(--color-primary); height: 100%; width: ${percentage}%;"></div>
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 60px;">
                    <div style="font-weight: 600; color: var(--color-text);">${count}</div>
                    <div style="font-size: 10px; color: var(--color-text-muted);">${percentage}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
  } catch (error) {
    console.error('Error rendering context file analytics:', error);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context data will appear here once you use @ mentions in Cursor</div>
      </div>
    `;
  }
}

async function renderContextFileHeatmap() {
  const container = document.getElementById('contextFileHeatmap');
  if (!container) return;

  try {
    // Fetch context snapshots from database
    const response = await fetch(`${CONFIG.API_BASE}/api/analytics/context/snapshots?source=database&limit=200`);
    const result = await response.json();
    
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context data will appear here once you use @ mentions in Cursor</div>
        </div>
      `;
      return;
    }

    const snapshots = result.data;
    
    // Build co-occurrence matrix
    const fileCoOccurrence = new Map();
    
    snapshots.forEach(snapshot => {
      const files = [];
      
      // Collect all files from this snapshot
      try {
        if (snapshot.at_mentions) {
          const mentions = typeof snapshot.at_mentions === 'string' 
            ? JSON.parse(snapshot.at_mentions) 
            : snapshot.at_mentions;
          if (Array.isArray(mentions)) {
            files.push(...mentions);
          }
        }
        
        if (snapshot.context_files) {
          const contextFiles = typeof snapshot.context_files === 'string'
            ? JSON.parse(snapshot.context_files)
            : snapshot.context_files;
          if (Array.isArray(contextFiles)) {
            files.push(...contextFiles);
          } else if (contextFiles.attachedFiles || contextFiles.codebaseFiles) {
            const attached = contextFiles.attachedFiles || [];
            const codebase = contextFiles.codebaseFiles || [];
            files.push(...attached, ...codebase);
          }
        }
      } catch (e) {
        // Skip malformed JSON
      }
      
      // Record co-occurrences (files used together in same prompt)
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          const key = [files[i], files[j]].sort().join('::');
          fileCoOccurrence.set(key, (fileCoOccurrence.get(key) || 0) + 1);
        }
      }
    });

  // Get top file pairs
  const topPairs = Array.from(fileCoOccurrence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (topPairs.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: var(--space-xl);">Not enough data for heatmap</div>';
    return;
  }

  const maxCount = topPairs[0][1];

  container.innerHTML = `
    <div>
      <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-md);">
        Files frequently referenced together in the same prompt
      </div>
      <div style="display: grid; gap: var(--space-xs);">
        ${topPairs.map(([key, count]) => {
          const [file1, file2] = key.split('::');
          const intensity = count / maxCount;
          const color = `rgba(99, 102, 241, ${0.2 + (intensity * 0.8)})`;
          
          return `
            <div style="display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm); background: ${color}; border-radius: var(--radius-md); transition: all 0.2s;" 
                 onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';" 
                 onmouseout="this.style.transform=''; this.style.boxShadow='';">
              <div style="flex: 1; display: flex; align-items: center; gap: var(--space-xs); font-family: var(--font-mono); font-size: var(--text-xs);">
                <span style="color: var(--color-text); font-weight: 500;">${file1}</span>
                <span style="color: var(--color-text-muted);">↔</span>
                <span style="color: var(--color-text); font-weight: 500;">${file2}</span>
              </div>
              <div style="background: rgba(255, 255, 255, 0.9); padding: 4px 10px; border-radius: 12px; font-weight: 600; font-size: var(--text-xs); color: var(--color-primary);">
                ${count}x
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  } catch (error) {
    console.error('Error rendering context file heatmap:', error);
    container.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: var(--space-xl);">Unable to load heatmap data</div>';
  }
}

// UI State Analytics - DISABLED
// This feature tracks Cursor tabs/panels via AppleScript (expensive & unreliable)
// Removed from analytics view to focus on procedural knowledge features instead
function renderUIStateAnalytics() {
  const container = document.getElementById('uiStateAnalytics');
  if (!container) return;

  // Collect UI state data
  const promptsWithUI = state.data.prompts?.filter(p => p.context?.browserState?.tabs) || [];
  
  if (promptsWithUI.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: var(--space-xl);">No UI state data available yet</div>';
    return;
  }

  // Calculate statistics
  const tabCounts = promptsWithUI.map(p => p.context.browserState.tabs.length);
  const averageTabs = (tabCounts.reduce((a, b) => a + b, 0) / tabCounts.length).toFixed(1);
  const maxTabs = Math.max(...tabCounts);
  const minTabs = Math.min(...tabCounts);
  
  // Most active tabs
  const tabFrequency = new Map();
  promptsWithUI.forEach(prompt => {
    prompt.context.browserState.tabs.forEach(tab => {
      const tabName = tab.name || tab.path;
      tabFrequency.set(tabName, (tabFrequency.get(tabName) || 0) + 1);
    });
  });
  
  const topTabs = Array.from(tabFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  container.innerHTML = `
    <div style="display: grid; gap: var(--space-xl);">
      <!-- Tab Statistics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--space-md);">
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 1.5rem; font-weight: 600; color: #8b5cf6;">${averageTabs}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">Avg Tabs Open</div>
        </div>
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 1.5rem; font-weight: 600; color: #ec4899;">${maxTabs}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">Max Tabs</div>
        </div>
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 1.5rem; font-weight: 600; color: #06b6d4;">${minTabs}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">Min Tabs</div>
        </div>
        <div style="text-align: center; padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
          <div style="font-size: 1.5rem; font-weight: 600; color: #f59e0b;">${promptsWithUI.length}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">UI Sessions</div>
        </div>
      </div>

      <!-- Most Active Tabs -->
      ${topTabs.length > 0 ? `
        <div>
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text);">Most Active Tabs</h4>
          <div style="display: grid; gap: var(--space-xs);">
            ${topTabs.map(([tabName, count]) => {
              const percentage = Math.round((count / promptsWithUI.length) * 100);
              return `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-md);">
                  <div style="flex: 1;">
                    <div style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); margin-bottom: 4px;">${tabName}</div>
                    <div style="background: var(--color-bg-alt); height: 6px; border-radius: 3px; overflow: hidden;">
                      <div style="background: var(--color-primary); height: 100%; width: ${percentage}%;"></div>
                    </div>
                  </div>
                  <div style="text-align: right; min-width: 60px;">
                    <div style="font-weight: 600; color: var(--color-text);">${count}</div>
                    <div style="font-size: 10px; color: var(--color-text-muted);">${percentage}%</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}


// ===================================
// NEW ANALYTICS VISUALIZATION FUNCTIONS
// ===================================

/**
 * Render Model Usage Analytics
 */
function renderModelUsageAnalytics() {
  const container = document.getElementById('modelUsageAnalytics');
  if (!container) return;

  const prompts = state.data.prompts || [];
  
  if (prompts.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Model usage statistics will appear here once you start using Cursor AI</div>
      </div>
    `;
    return;
  }

  // Count models
  const modelCounts = {};
  const modelModes = {};
  const modelContext = {};
  
  prompts.forEach(p => {
    const model = p.modelName || p.model_name || 'Unknown';
    const mode = p.mode || 'unknown';
    const context = p.contextUsage || p.context_usage || 0;
    
    // Count by model
    modelCounts[model] = (modelCounts[model] || 0) + 1;
    
    // Count modes per model
    if (!modelModes[model]) modelModes[model] = {};
    modelModes[model][mode] = (modelModes[model][mode] || 0) + 1;
    
    // Average context per model
    if (!modelContext[model]) modelContext[model] = { total: 0, count: 0 };
    modelContext[model].total += context;
    modelContext[model].count++;
  });

  // Sort by usage
  const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
  
  const totalPrompts = prompts.length;

  let html = '<div style="display: flex; flex-direction: column; gap: var(--space-md);">';

  sortedModels.forEach(([model, count]) => {
    const percentage = ((count / totalPrompts) * 100).toFixed(1);
    const avgContext = modelContext[model] ? (modelContext[model].total / modelContext[model].count).toFixed(1) : 0;
    const modes = modelModes[model] || {};
    const modesList = Object.entries(modes)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, modeCount]) => `${mode}: ${modeCount}`)
      .join(', ');

    html += `
      <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm);">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
              ${model === 'Unknown' ? 'Model Not Specified' : model}
            </div>
            <div style="font-size: var(--text-sm); color: var(--color-text-muted);">
              ${modesList}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: var(--text-xl); font-weight: 600; color: var(--color-primary);">${count}</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-muted);">${percentage}%</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-sm);">
          <div style="flex: 1; background: var(--color-bg-alt); height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="background: var(--color-primary); height: 100%; width: ${percentage}%;"></div>
          </div>
          ${avgContext > 0 ? `<span style="font-size: var(--text-xs); color: var(--color-text-muted);">${avgContext}% avg context</span>` : ''}
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Render Enhanced Context Window Analytics
 */
async function renderEnhancedContextAnalytics() {
  const container = document.getElementById('enhancedContextAnalytics');
  if (!container) return;

  try {
    // Fetch context analytics from API
    const response = await APIClient.get('/api/analytics/context');
    
    if (!response.success || !response.data) {
      throw new Error('No context data available');
    }
    
    const data = response.data;
    
    container.innerHTML = `
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md); margin-bottom: var(--space-lg);">
        <div class="stat-card">
          <div class="stat-label">Avg Files per Prompt</div>
          <div class="stat-value">${data.avgFilesPerPrompt?.toFixed(1) || '0.0'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Tokens</div>
          <div class="stat-value">${Math.round(data.avgTokensPerPrompt || 0).toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Context Utilization</div>
          <div class="stat-value">${((data.avgContextUtilization || 0) * 100).toFixed(1)}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Snapshots</div>
          <div class="stat-value">${data.totalSnapshots || 0}</div>
        </div>
      </div>
      
      ${data.mostReferencedFiles && data.mostReferencedFiles.length > 0 ? `
        <div style="margin-top: var(--space-lg);">
          <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-base);">Most Referenced Files</h4>
          <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
            ${data.mostReferencedFiles.slice(0, 5).map(file => `
              <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm);">
                <span style="font-family: 'Geist Mono', monospace; font-size: var(--text-sm); color: var(--color-text);">${file.file}</span>
                <span style="color: var(--color-primary); font-weight: 500;">${file.mentionCount} mentions</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : '<div style="color: var(--color-text-muted); text-align: center; padding: var(--space-lg);">No file references yet</div>'}
    `;
  } catch (error) {
    console.warn('[INFO] Context analytics error:', error.message);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Context data will appear here once you use @ mentions in Cursor</div>
      </div>
    `;
  }
}

/**
 * Render Productivity Insights
 */
async function renderProductivityInsights() {
  const container = document.getElementById('productivityInsights');
  if (!container) return;

  try {
    // Fetch productivity stats from API
    const response = await APIClient.get('/api/analytics/productivity');
    
    if (!response.success || !response.data) {
      throw new Error('No productivity data available');
    }
    
    const data = response.data;
    const activity = data.activity || {};
    const iterations = data.promptIterations || {};
    const churn = data.codeChurn || {};
    const debug = data.debugActivity || {};
    
    const hasData = activity.totalActiveTime > 0 || iterations.total > 0 || churn.total > 0;
    
    if (!hasData) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Productivity data will accumulate as you work with Cursor</div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-md);">
        <div class="stat-card">
          <div class="stat-label">Active Coding Time</div>
          <div class="stat-value">${formatDuration(activity.totalActiveTime || 0)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Prompt Iterations</div>
          <div class="stat-value">${iterations.total || 0}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">${iterations.last24h || 0} in last 24h</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Code Churn Events</div>
          <div class="stat-value">${churn.total || 0}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">${churn.last24h || 0} in last 24h</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Debug Activity</div>
          <div class="stat-value">${debug.total || 0}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">${debug.afterAIChanges || 0} after AI changes</div>
        </div>
      </div>
    `;
  } catch (error) {
    console.warn('[INFO] Productivity insights error:', error.message);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Productivity data will accumulate as you work with Cursor</div>
      </div>
    `;
  }
}

// Helper function to format duration
function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * ✅ REMOVED: File Relationship Visualization (handled in File Graph view)
 */
// async function renderFileRelationshipVisualization() {
//   Disabled - this is better handled in the dedicated File Graph tab
// }
async function renderFileRelationshipVisualization_DISABLED() {
  const container = document.getElementById('fileRelationshipViz');
  if (!container) return;

  try {
    // Fetch file relationship data from API
    const response = await APIClient.get('/api/analytics/context/file-relationships');
    
    if (!response.success || !response.data) {
      throw new Error('No file relationship data available');
    }
    
    const data = response.data;
    
    if (!data.nodes || data.nodes.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">File relationships will appear once you use @ mentions in Cursor</div>
        </div>
      `;
      return;
    }
    
    // Render file relationship list (simple version for now)
    container.innerHTML = `
      <div style="margin-bottom: var(--space-md);">
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-sm);">
          ${data.nodes.length} files with ${data.edges.length} relationships
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: var(--space-xs);">
        ${data.nodes.slice(0, 10).map(node => `
          <div style="display: flex; justify-content: space-between; padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm);">
            <span style="font-family: 'Geist Mono', monospace; font-size: var(--text-sm); color: var(--color-text);">${node.id}</span>
            <span style="color: var(--color-primary); font-weight: 500;">${node.weight} references</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.warn('[INFO] File relationship error:', error.message);
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; padding: var(--space-xl); text-align: center;">
        <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">File relationships will appear once you use @ mentions in Cursor</div>
      </div>
    `;
  }
}

// ===================================
// TODO View
// ===================================

async function renderTodoView(container) {
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Task Tracking</h2>
          <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--space-xs);">
            TODOs created by AI assistant, linked to prompts and file changes
          </p>
        </div>
        <div class="card-body" id="todoListContainer">
          <div style="display: flex; justify-content: center; padding: var(--space-xl);">
            <div class="spinner"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/todos`);
    const data = await response.json();
    
    // ✅ Fix: API returns {success, todos}, not just array
    const todos = data.todos || data || [];
    
    const todoListContainer = document.getElementById('todoListContainer');
    
    if (!todos || todos.length === 0) {
      todoListContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-2xl); text-align: center;">
          <svg width="64" height="64" viewBox="0 0 20 20" fill="var(--color-text-muted)" style="opacity: 0.3; margin-bottom: var(--space-lg);">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
          </svg>
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No TODOs Yet</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); max-width: 400px;">
            TODOs will appear here automatically when the AI assistant creates them during your workflow
          </div>
        </div>
      `;
      return;
    }

    // Group todos by status
    const grouped = {
      in_progress: todos.filter(t => t.status === 'in_progress'),
      pending: todos.filter(t => t.status === 'pending'),
      completed: todos.filter(t => t.status === 'completed')
    };

    const totalCompleted = grouped.completed.length;
    const totalTodos = todos.length;
    const completionRate = totalTodos > 0 ? Math.round((totalCompleted / totalTodos) * 100) : 0;

    todoListContainer.innerHTML = `
      <!-- Progress Summary -->
      <div style="display: flex; gap: var(--space-lg); margin-bottom: var(--space-xl); padding: var(--space-lg); background: var(--color-bg); border-radius: var(--radius-md);">
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Total Tasks</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${totalTodos}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Completed</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-success);">${totalCompleted}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">In Progress</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-primary);">${grouped.in_progress.length}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-xs);">Completion Rate</div>
          <div style="font-size: var(--text-2xl); font-weight: 600; color: var(--color-text);">${completionRate}%</div>
        </div>
      </div>

      <!-- TODO Sections -->
      ${grouped.in_progress.length > 0 ? `
        <div style="margin-bottom: var(--space-xl);">
          <h3 style="font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <span style="color: var(--color-primary);">▶</span> In Progress
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${grouped.in_progress.map(todo => renderTodoItem(todo)).join('')}
          </div>
        </div>
      ` : ''}

      ${grouped.pending.length > 0 ? `
        <div style="margin-bottom: var(--space-xl);">
          <h3 style="font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <span style="color: var(--color-text-muted);">○</span> Pending
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${grouped.pending.map(todo => renderTodoItem(todo)).join('')}
          </div>
        </div>
      ` : ''}

      ${grouped.completed.length > 0 ? `
        <div>
          <h3 style="font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
            <span style="color: var(--color-success);">✓</span> Completed
          </h3>
          <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${grouped.completed.map(todo => renderTodoItem(todo)).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Attach event listeners
    todos.forEach(todo => {
      const expandBtn = document.getElementById(`expand-todo-${todo.id}`);
      const startBtn = document.getElementById(`start-todo-${todo.id}`);
      const completeBtn = document.getElementById(`complete-todo-${todo.id}`);

      if (expandBtn) {
        expandBtn.addEventListener('click', () => expandTodoDetails(todo.id));
      }
      if (startBtn) {
        startBtn.addEventListener('click', () => markTodoInProgress(todo.id));
      }
      if (completeBtn) {
        completeBtn.addEventListener('click', () => markTodoCompleted(todo.id));
      }
    });

  } catch (error) {
    console.error('Error loading todos:', error);
    const errorContainer = document.getElementById('todoListContainer');
    if (errorContainer) {
      errorContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-error); margin-bottom: var(--space-xs); font-weight: 500;">Failed to Load TODOs</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">${error.message}</div>
        </div>
      `;
    }
  }
}

function renderTodoItem(todo) {
  const statusIcon = {
    'pending': '<span style="color: var(--color-text-muted); font-size: 18px;">○</span>',
    'in_progress': '<span style="color: var(--color-primary); font-size: 18px;">▶</span>',
    'completed': '<span style="color: var(--color-success); font-size: 18px;">✓</span>'
  }[todo.status] || '○';

  const duration = getTodoDuration(todo);
  const eventCount = (todo.eventCount || 0);
  
  // Parse JSON strings if needed
  const promptsWhileActive = Array.isArray(todo.promptsWhileActive) 
    ? todo.promptsWhileActive 
    : (typeof todo.promptsWhileActive === 'string' && todo.promptsWhileActive.length > 0)
      ? JSON.parse(todo.promptsWhileActive)
      : [];
      
  const filesModified = Array.isArray(todo.filesModified)
    ? todo.filesModified
    : (typeof todo.filesModified === 'string' && todo.filesModified.length > 0)
      ? JSON.parse(todo.filesModified)
      : [];
      
  const promptCount = promptsWhileActive.length;
  const fileCount = filesModified.length;

  const isCompleted = todo.status === 'completed';
  const isPending = todo.status === 'pending';
  const isInProgress = todo.status === 'in_progress';

  return `
    <div style="background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-lg); ${isCompleted ? 'opacity: 0.7;' : ''}">
      <!-- Header -->
      <div style="display: flex; align-items: flex-start; gap: var(--space-md); margin-bottom: var(--space-md);">
        <div style="flex-shrink: 0; margin-top: 2px;">
          ${statusIcon}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: var(--text-md); color: var(--color-text); font-weight: 500; ${isCompleted ? 'text-decoration: line-through;' : ''}">${escapeHtml(todo.content)}</div>
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-md); margin-top: var(--space-sm); font-size: var(--text-sm); color: var(--color-text-muted);">
            ${duration ? `<span style="color: var(--color-primary); font-weight: 500;">${duration}</span>` : ''}
            ${todo.createdAt ? `<span>Created ${formatTimestamp(todo.createdAt)}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Activity Summary (Always Visible) -->
      ${(promptCount > 0 || fileCount > 0) ? `
        <div style="margin-bottom: var(--space-md); padding: var(--space-md); background: var(--color-bg-secondary); border-radius: var(--radius-sm);">
          <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-sm);">Activity Summary</div>
          <div style="display: grid; gap: var(--space-sm);">
            ${promptCount > 0 ? `
              <div style="font-size: var(--text-sm); color: var(--color-text);">
                <span style="color: var(--color-primary); font-weight: 600;">${promptCount}</span> AI prompt${promptCount !== 1 ? 's' : ''}
              </div>
            ` : ''}
            ${fileCount > 0 ? `
              <div style="font-size: var(--text-sm); color: var(--color-text);">
                <span style="color: var(--color-primary); font-weight: 600;">${fileCount}</span> file${fileCount !== 1 ? 's' : ''} modified
                <div style="margin-top: var(--space-xs); font-size: var(--text-xs); color: var(--color-text-muted); font-family: 'Geist Mono', monospace;">
                  ${filesModified.slice(0, 3).map(f => `<div style="margin-top: 2px;">• ${escapeHtml(f.split('/').pop())}</div>`).join('')}
                  ${fileCount > 3 ? `<div style="margin-top: 2px;">• +${fileCount - 3} more...</div>` : ''}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      ` : '<div style="margin-bottom: var(--space-md); padding: var(--space-md); background: var(--color-bg-secondary); border-radius: var(--radius-sm); font-size: var(--text-sm); color: var(--color-text-muted); text-align: center;">No activity yet</div>'}

      <!-- Actions -->
      <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap; align-items: center;">
        <button 
          onclick="expandTodoDetails(${todo.id})"
          style="padding: var(--space-xs) var(--space-md); font-size: var(--text-sm); background: var(--color-bg-hover); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text); cursor: pointer; transition: all 0.2s;"
          onmouseover="this.style.background='var(--color-border)'"
          onmouseout="this.style.background='var(--color-bg-hover)'"
        >
          <span id="expand-btn-text-${todo.id}">${eventCount > 0 ? `Show Timeline (${eventCount} events)` : 'Show Timeline'}</span>
        </button>
        
        <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic;">
          Status tracked automatically by AI
        </span>
      </div>

      <!-- Event Timeline (Initially Hidden) -->
      <div id="todo-events-${todo.id}" style="display: none; margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--color-border);">
        <!-- Events will be loaded here -->
      </div>
    </div>
  `;
}

function getTodoDuration(todo) {
  if (todo.status === 'completed' && todo.startedAt && todo.completedAt) {
    const durationMs = todo.completedAt - todo.startedAt;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '< 1m';
    }
  } else if (todo.status === 'in_progress' && todo.startedAt) {
    const durationMs = Date.now() - todo.startedAt;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m (ongoing)`;
    } else if (minutes > 0) {
      return `${minutes}m (ongoing)`;
    } else {
      return '< 1m (ongoing)';
    }
  }
  return null;
}

// Manual TODO actions removed - status is now automatic based on AI activity

async function expandTodoDetails(todoId) {
  const eventsContainer = document.getElementById(`todo-events-${todoId}`);
  const btnText = document.getElementById(`expand-btn-text-${todoId}`);
  if (!eventsContainer) return;

  // Toggle visibility
  if (eventsContainer.style.display === 'block') {
    eventsContainer.style.display = 'none';
    if (btnText) {
      const eventCount = eventsContainer.dataset.eventCount || 0;
      btnText.textContent = `Show Timeline (${eventCount} events)`;
    }
    return;
  }

  // Show loading state
  eventsContainer.style.display = 'block';
  if (btnText) btnText.textContent = 'Loading...';
  eventsContainer.innerHTML = `
    <div style="display: flex; justify-content: center; padding: var(--space-md);">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const response = await fetch(`${CONFIG.API_BASE}/api/todos/${todoId}/events`);
    const events = await response.json();
    
    // Store event count for toggle button
    eventsContainer.dataset.eventCount = events.length;

    if (!events || events.length === 0) {
      eventsContainer.innerHTML = `
        <div style="text-align: center; padding: var(--space-md); color: var(--color-text-muted); font-size: var(--text-sm);">
          No events recorded for this TODO yet
        </div>
      `;
      return;
    }

    // Render timeline
    eventsContainer.innerHTML = `
      <h4 style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-md);">Event Timeline (${events.length})</h4>
      <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
        ${events.map(event => `
          <div style="display: flex; gap: var(--space-md); padding: var(--space-sm); background: var(--color-bg-secondary); border-radius: var(--radius-sm);">
            <div style="flex-shrink: 0; color: var(--color-text-muted); font-size: var(--text-xs); font-family: 'Geist Mono', monospace;">
              ${formatTimestamp(event.timestamp)}
            </div>
            <div style="flex: 1;">
              <div style="font-size: var(--text-sm); color: var(--color-text);">
                ${event.eventType === 'prompt' ? 'Prompt' : 'File Change'}: 
                ${event.details ? escapeHtml(truncateText(event.details, 100)) : 'N/A'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
    // Update button text
    if (btnText) btnText.textContent = `Hide Timeline (${events.length} events)`;
    
  } catch (error) {
    console.error('Error loading TODO events:', error);
    eventsContainer.innerHTML = `
      <div style="text-align: center; padding: var(--space-md); color: var(--color-error); font-size: var(--text-sm);">
        Failed to load events: ${error.message}
      </div>
    `;
  }
}

// Helper function for formatting timestamps
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Relative time for recent timestamps
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Absolute time for older timestamps
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Helper function for escaping HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper function for truncating text
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Export new functions
window.renderEnhancedContextAnalytics = renderEnhancedContextAnalytics;
// window.renderErrorTracking - REMOVED: Section removed from dashboard
window.renderProductivityInsights = renderProductivityInsights;
// window.renderFileRelationshipVisualization - REMOVED: Handled in File Graph view
window.renderTodoView = renderTodoView;
