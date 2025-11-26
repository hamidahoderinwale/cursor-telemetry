/**
 * Dashboard Lifecycle Module
 * Handles dashboard initialization, event listeners, and lifecycle management
 * Extracted from dashboard.js for better organization
 */

/**
 * Initialize dashboard lifecycle
 */
function initializeDashboardLifecycle() {
  // Setup navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view && window.switchView) {
        window.switchView(view);
      }
    });
  });

  // Setup workspace selector
  const workspaceSelect = document.getElementById('workspaceSelect');
  if (workspaceSelect) {
    workspaceSelect.addEventListener('change', (e) => {
      const state = window.state;
      if (state) {
        state.currentWorkspace = e.target.value;
      }
      if (window.renderCurrentView) {
        window.renderCurrentView();
      }
    });
  }

  // Setup modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      const parent = overlay.closest('.modal') || overlay.parentElement;
      if (parent) {
        parent.classList.remove('active');
      }
    });
  });

  // Setup search palette keyboard shortcuts and event listeners
  document.addEventListener('keydown', (e) => {
    // CMD+K or CTRL+K to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (window.openSearchPalette) {
        window.openSearchPalette();
      }
    }
    
    // ESC to close search
    if (e.key === 'Escape') {
      const palette = document.getElementById('searchPalette');
      if (palette && palette.classList.contains('active')) {
        if (window.closeSearchPalette) {
          window.closeSearchPalette();
        }
      }
    }
    
    // Arrow keys for navigation
    const palette = document.getElementById('searchPalette');
    if (palette && palette.classList.contains('active')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (window.navigateSearchResults) {
          window.navigateSearchResults('down');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (window.navigateSearchResults) {
          window.navigateSearchResults('up');
        }
      } else if (e.key === 'Enter' && window.searchSelectedIndex >= 0) {
        e.preventDefault();
        if (window.selectSearchResult) {
          window.selectSearchResult(window.searchSelectedIndex);
        }
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
        if (window.performSearch) {
          window.performSearch(e.target.value);
        }
      }, 300); // 300ms debounce
    });
  }
  
  // Setup search trigger button
  const searchTrigger = document.getElementById('searchTrigger');
  if (searchTrigger) {
    searchTrigger.addEventListener('click', () => {
      if (window.openSearchPalette) {
        window.openSearchPalette();
      }
    });
  }
  
  // Close search when clicking overlay
  const searchPalette = document.getElementById('searchPalette');
  if (searchPalette) {
    const overlay = searchPalette.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        if (window.closeSearchPalette) {
          window.closeSearchPalette();
        }
      });
    }
  }
}

/**
 * Setup auto-refresh with debouncing
 */
function setupAutoRefresh() {
  const CONFIG = window.CONFIG || {};
  const refreshInterval = CONFIG.REFRESH_INTERVAL || 30000;
  
  let refreshInProgress = false;
  let lastRefreshTime = Date.now();
  const MIN_REFRESH_INTERVAL = refreshInterval;
  
  setInterval(async () => {
    // Skip if refresh is already in progress or too soon
    if (refreshInProgress || (Date.now() - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
      console.log('[SYNC] Skipping refresh - already in progress or too soon');
      return;
    }
    
    refreshInProgress = true;
    lastRefreshTime = Date.now();
    
    try {
      const state = window.state;
      if (state && state.connected) {
        // Use optimized fetch for refresh
        if (window.fetchRecentData) {
          await window.fetchRecentData();
        }
        if (window.calculateStats) {
          window.calculateStats();
        }
        if (window.renderCurrentView) {
          window.renderCurrentView();
        }
        // Update status on successful sync
        if (window.updateConnectionStatus) {
          window.updateConnectionStatus(true, 'Connected - synced');
        }
      }
    } catch (error) {
      console.error('Refresh error:', error);
      // Update status if sync fails
      const state = window.state;
      if (state && state.connected && window.updateConnectionStatus) {
        window.updateConnectionStatus(false, 'Sync failed - retrying...');
      }
    } finally {
      refreshInProgress = false;
    }
  }, refreshInterval);
}

/**
 * Initialize persistent storage and data synchronization
 */
async function initializePersistence() {
  // Wait for persistence classes to be loaded (they're loaded with defer)
  let attempts = 0;
  const maxAttempts = 50; // Wait up to 5 seconds (50 * 100ms)
  
  while (attempts < maxAttempts) {
    const PersistentStorage = window.PersistentStorage;
    const AnalyticsAggregator = window.AnalyticsAggregator;
    const DataSynchronizer = window.DataSynchronizer;
    
    if (PersistentStorage && AnalyticsAggregator && DataSynchronizer) {
      // Classes are available, proceed with initialization
      try {
        const storage = new PersistentStorage();
        const aggregator = new AnalyticsAggregator(storage);
        const synchronizer = new DataSynchronizer(storage, aggregator);
        
        console.log('Persistence system enabled');
        
        // Initialize persistent storage
        const stats = await synchronizer.initialize();
        console.log('[DATA] Persistent storage ready:', stats);
        
        // Store globally for access
        window.persistentStorage = storage;
        window.analyticsAggregator = aggregator;
        window.dataSynchronizer = synchronizer;
        
        return { storage, aggregator, synchronizer };
      } catch (error) {
        console.warn('Persistence system initialization failed:', error);
        return null;
      }
    }
    
    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  // Classes not available after waiting
  console.warn('Persistence system not available - required classes not found after waiting');
  return null;
  
  try {
    const storage = new PersistentStorage();
    const aggregator = new AnalyticsAggregator(storage);
    const synchronizer = new DataSynchronizer(storage, aggregator);
    
    console.log('Persistence system enabled');
    
    // Initialize persistent storage
    const stats = await synchronizer.initialize();
    console.log('[DATA] Persistent storage ready:', stats);
    
    // Store globally for access
    window.persistentStorage = storage;
    window.analyticsAggregator = aggregator;
    window.dataSynchronizer = synchronizer;
    
    return { storage, aggregator, synchronizer };
  } catch (error) {
    console.warn('Persistence system not available:', error);
    return null;
  }
}

/**
 * Non-persistent initialization function
 */
async function initializeNonPersistent() {
  if (window.initializeDashboard) {
    await window.initializeDashboard();
  }
  
  const state = window.state;
  if (state) {
    state.connected = true;
  }
  
  if (window.updateConnectionStatus) {
    window.updateConnectionStatus(true);
  }
  
  // Initialize search engine
  if (window.initializeSearch) {
    window.initializeSearch();
  }
  
  // Setup auto-refresh
  setupAutoRefresh();
}

/**
 * Main initialization function
 */
async function initializeDashboardApp() {
  console.log('Initializing Cursor Telemetry Dashboard');
  
  // Initialize status popup FIRST (before any console.logs)
  if (window.initStatusPopup) {
    window.initStatusPopup();
  }
  
  // Setup lifecycle event listeners
  initializeDashboardLifecycle();
  
  // Try to initialize persistence
  const persistence = await initializePersistence();
  
  if (persistence) {
    const { storage, synchronizer } = persistence;
    
    // Use optimized initialization with warm-start
    const state = window.state;
    if (state) {
      state.connected = true;
    }
    
    if (window.updateConnectionStatus) {
      window.updateConnectionStatus(true);
    }
    
    if (window.initializeDashboard) {
      await window.initializeDashboard();
    }
    
    // Initialize search engine (if available)
    if (window.initializeSearch) {
      window.initializeSearch();
    }
    
    console.log('[SUCCESS] Dashboard initialized with warm-start');
    
    // Setup auto-refresh
    setupAutoRefresh();
  } else {
    // No persistence - use traditional fetch
    try {
      await initializeNonPersistent();
    } catch (error) {
      console.error('Initial data fetch failed:', error);
      if (window.updateConnectionStatus) {
        window.updateConnectionStatus(false);
      }
      // Fallback to old method
      if (window.fetchAllData) {
        await window.fetchAllData();
      }
      if (window.renderCurrentView) {
        window.renderCurrentView();
      }
      if (window.initializeSearch) {
        window.initializeSearch();
      }
    }
  }
  
  console.log('Dashboard initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboardApp);
} else {
  // DOM already loaded
  initializeDashboardApp();
}

// Export for manual initialization if needed
window.initializeDashboardApp = initializeDashboardApp;
window.initializeDashboardLifecycle = initializeDashboardLifecycle;
window.setupAutoRefresh = setupAutoRefresh;

