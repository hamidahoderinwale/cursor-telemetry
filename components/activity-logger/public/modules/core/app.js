/**
 * Main Application Entry Point
 * Initializes and coordinates all dashboard modules
 */

import { CONFIG } from './config.js';
import { state, updateState } from './state.js';
import { APIClient } from '../api/client.js';
import { WebSocketManager } from '../api/websocket.js';
import { calculateStats } from '../data/processor.js';

class DashboardApp {
  constructor() {
    this.initialized = false;
    this.wsManager = null;
    this.storage = null;
    this.synchronizer = null;
  }

  /**
   * Initialize the dashboard application
   */
  async initialize() {
    if (this.initialized) {
      console.warn('[APP] Already initialized');
      return;
    }

    console.log('[APP] Initializing Cursor Telemetry Dashboard...');

    try {
      // Initialize persistent storage
      await this.initializeStorage();
      
      // Load cached data for instant UI
      await this.loadFromCache();
      
      // Check server connection
      const health = await APIClient.checkHealth();
      const isConnected = health.status === 'running';
      
      updateState({ connected: isConnected });
      
      if (isConnected) {
        console.log('[APP] Connected to companion service');
        
        // Check if cache is stale and fetch updates
        await this.syncData(health);
        
        // Initialize WebSocket for real-time updates (optional)
        // this.initializeWebSocket();
      } else {
        console.warn('[APP] Companion service offline, using cached data');
      }
      
      // Setup UI
      this.setupEventListeners();
      
      // Setup auto-refresh
      this.setupAutoRefresh();
      
      // Initial render
      this.render();
      
      this.initialized = true;
      console.log('[APP] Dashboard initialized successfully');
      
    } catch (error) {
      console.error('[APP] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize persistent storage system
   */
  async initializeStorage() {
    try {
      if (window.PersistentStorage) {
        this.storage = new PersistentStorage();
        await this.storage.init();
        console.log('[APP] Persistent storage initialized');
      }
    } catch (error) {
      console.warn('[APP] Persistent storage unavailable:', error);
    }
  }

  /**
   * Load cached data from IndexedDB
   */
  async loadFromCache() {
    if (!this.storage) return;
    
    try {
      console.log('[APP] Loading cached data...');
      
      const [events, prompts] = await Promise.all([
        this.storage.getAllEvents(500),
        this.storage.getAllPrompts(200)
      ]);
      
      state.data.events = events || [];
      state.data.prompts = prompts || [];
      
      calculateStats();
      
      console.log(`[APP] Loaded ${events?.length || 0} events and ${prompts?.length || 0} prompts from cache`);
    } catch (error) {
      console.error('[APP] Cache load failed:', error);
    }
  }

  /**
   * Sync data with server
   */
  async syncData(health) {
    try {
      const serverSequence = health.sequence || 0;
      
      // Check if we need to sync
      if (this.storage) {
        const cacheStale = await this.storage.isCacheStale(serverSequence);
        
        if (!cacheStale) {
          console.log('[APP] Cache is up-to-date');
          return;
        }
      }
      
      console.log('[APP] Fetching updates from server...');
      
      // Fetch recent data
      const [activity, entries, workspaces] = await Promise.allSettled([
        APIClient.get('/api/activity?limit=200'),
        APIClient.get('/entries?limit=200'),
        APIClient.get('/api/workspaces')
      ]);
      
      // Process results
      if (activity.status === 'fulfilled') {
        state.data.events = activity.value.data || activity.value || [];
      }
      
      if (entries.status === 'fulfilled') {
        state.data.prompts = entries.value || [];
      }
      
      if (workspaces.status === 'fulfilled') {
        state.data.workspaces = workspaces.value || [];
      }
      
      // Cache the data
      if (this.storage) {
        await this.storage.storeEvents(state.data.events);
        await this.storage.storePrompts(state.data.prompts);
        await this.storage.updateServerSequence(serverSequence);
      }
      
      calculateStats();
      
      console.log('[APP] Data synced successfully');
      
    } catch (error) {
      console.error('[APP] Sync failed:', error);
    }
  }

  /**
   * Initialize WebSocket connection
   */
  initializeWebSocket() {
    this.wsManager = new WebSocketManager();
    
    this.wsManager.on('connected', () => {
      console.log('[APP] WebSocket connected');
      updateState({ connected: true });
    });
    
    this.wsManager.on('disconnected', () => {
      console.log('[APP] WebSocket disconnected');
      updateState({ connected: false });
    });
    
    this.wsManager.on('message', (data) => {
      this.handleRealtimeUpdate(data);
    });
    
    this.wsManager.connect();
  }

  /**
   * Handle real-time updates from WebSocket
   */
  handleRealtimeUpdate(data) {
    console.log('[APP] Real-time update:', data);
    
    // Handle different update types
    if (data.type === 'activity') {
      state.data.events.unshift(data.event);
    } else if (data.type === 'prompt') {
      state.data.prompts.unshift(data.prompt);
    }
    
    calculateStats();
    this.render();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) this.switchView(view);
      });
    });
    
    // Workspace selector
    const workspaceSelect = document.getElementById('workspaceSelect');
    if (workspaceSelect) {
      workspaceSelect.addEventListener('change', (e) => {
        state.currentWorkspace = e.target.value;
        this.render();
      });
    }
  }

  /**
   * Setup auto-refresh
   */
  setupAutoRefresh() {
    let refreshInProgress = false;
    let lastRefreshTime = Date.now();
    
    setInterval(async () => {
      const now = Date.now();
      
      // Skip if refresh in progress or too soon
      if (refreshInProgress || (now - lastRefreshTime) < CONFIG.MIN_REFRESH_INTERVAL) {
        return;
      }
      
      refreshInProgress = true;
      lastRefreshTime = now;
      
      try {
        const health = await APIClient.checkHealth();
        if (health.status === 'running') {
          await this.syncData(health);
          this.render();
        }
      } catch (error) {
        console.error('[APP] Auto-refresh failed:', error);
      } finally {
        refreshInProgress = false;
      }
    }, CONFIG.REFRESH_INTERVAL);
  }

  /**
   * Switch to a different view
   */
  switchView(viewName) {
    state.currentView = viewName;
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });
    
    this.render();
  }

  /**
   * Render current view
   */
  render() {
    const container = document.getElementById('content');
    if (!container) return;
    
    // Update stats display
    this.updateStatsDisplay();
    
    // Render current view
    console.log(`[APP] Rendering view: ${state.currentView}`);
    
    // This would call view-specific render functions
    // import and use view renderers here
  }

  /**
   * Update stats display
   */
  updateStatsDisplay() {
    const stats = state.stats;
    
    const updates = {
      'stat-sessions': stats.sessions,
      'stat-files': stats.fileChanges,
      'stat-prompts': stats.aiInteractions,
      'stat-code': this.formatFileSize(stats.codeChanged),
      'stat-terminal': stats.terminalCommands
    };
    
    Object.entries(updates).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  /**
   * Format file size helper
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}

// Export singleton instance
export const app = new DashboardApp();
export default app;

