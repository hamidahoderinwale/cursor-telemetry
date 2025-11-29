/**
 * View Router - Handles view switching and rendering
 * Optimized with caching and lazy loading
 */

// Cache for view render functions
const viewRenderCache = new Map();

// View lifecycle management
const viewCleanupRegistry = new Map(); // cleanup functions for each view
const viewPauseResumeRegistry = new Map(); // pause/resume functions for animations
const viewStateRegistry = new Map(); // state to restore when view becomes visible
let currentActiveView = null;
let previousView = null;

// View render function names (for script tag loading)
const viewFunctionNames = {
  'dashboard-home': 'renderDashboardHome',
  'overview': 'renderOverviewView',
  'patterns-history': 'renderPatternsHistoryView',
  'patterns': 'renderPatternsView',
  'context-precision': 'renderContextPrecisionView',
  'model-comparison': 'renderModelComparisonView',
  'activity': 'renderActivityView',
  'threads': 'renderThreadsView',
  'analytics': 'renderAnalyticsView',
  'filegraph': 'renderFileGraphView',
  'navigator': 'renderNavigatorView',
  'todos': 'renderTodoView',
  'system': 'renderSystemView',
  'api-docs': 'renderAPIDocsView',
  'schema-config': 'renderSchemaConfigView',
  'workspace-comparison': 'renderWorkspaceComparisonView',
  'whiteboard': 'renderWhiteboardView',
  'clio': 'renderClioView',
  'module-graph': 'renderModuleGraphView',
  'rung1-tokens': 'renderRung1TokensView',
  'rung2-edit-scripts': 'renderRung2EditScriptsView',
  'rung3-functions': 'renderRung3FunctionsView',
  'historical-mining': 'renderHistoricalMiningView'
};

// Debounced view switching
const debouncedRender = window.debounce ? 
  window.debounce(renderCurrentView, 50) : 
  renderCurrentView;

function switchView(viewName) {
  const oldView = window.state.currentView;
  
  // Save state of previous view before switching
  if (oldView && oldView !== viewName && window.viewStateManager) {
    const container = document.getElementById('viewContainer');
    if (container) {
      window.viewStateManager.saveScrollPosition(oldView, container.scrollLeft, container.scrollTop);
    }
  }
  
  // Cleanup previous view before switching
  if (oldView && oldView !== viewName) {
    cleanupView(oldView);
    pauseView(oldView);
  }
  
  previousView = oldView;
  currentActiveView = viewName;
  
  // Update state with reactive notification
  if (window.updateState) {
    window.updateState({ currentView: viewName });
  } else {
    window.state.currentView = viewName;
  }
  
  // Optimize nav link updates with batch DOM updates
  if (window.batchDOMUpdates) {
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    window.batchDOMUpdates(
      navLinks.map(link => () => {
        link.classList.remove('active');
        if (link.dataset.view === viewName) {
          link.classList.add('active');
        }
      })
    );
  } else {
    // Fallback
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });
  }

  // Use debounced render for rapid view switches
  debouncedRender();
}

async function renderCurrentView() {
  const container = document.getElementById('viewContainer');
  if (!container) return;

  const viewName = window.state.currentView;
  
  // Show loading state if available
  if (window.setLoading) {
    window.setLoading(viewName, true);
  }
  
  // Check if view render function is already cached
  let renderFn = viewRenderCache.get(viewName);
  
  if (!renderFn) {
    // Get function name from mapping
    const functionName = viewFunctionNames[viewName] || `render${viewName.charAt(0).toUpperCase() + viewName.slice(1)}View`;
    renderFn = window[functionName];
    
    // Wait for view to load if not available yet (for deferred scripts)
    if (!renderFn) {
      // Show loading message while waiting
      container.innerHTML = `<div class="view-loading">
        <div class="loading-spinner loading-spinner--inline"></div>
        <h3 class="view-loading__title">Loading ${viewName}...</h3>
        <p class="view-loading__message">Waiting for view scripts to load</p>
      </div>`;
      
      // Wait up to 5 seconds for deferred scripts to load (increased from 2s)
      const maxWait = 5000;
      const startTime = Date.now();
      const checkInterval = 50; // Check every 50ms for faster detection
      
      while (!renderFn && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        renderFn = window[functionName];
        
        // Also check if script tag exists and has loaded
        if (!renderFn) {
          const scriptTags = Array.from(document.querySelectorAll('script[src*="' + viewName + '"]'));
          const allLoaded = scriptTags.every(script => {
            // Check if script has loaded (no defer attribute means it's loaded, or check readyState)
            return script.defer === false || script.readyState === 'complete' || script.readyState === 'loaded';
          });
          
          // If all scripts are loaded but function still not available, might be an error
          if (allLoaded && scriptTags.length > 0 && !renderFn) {
            console.warn(`[VIEW] Scripts for ${viewName} loaded but function ${functionName} not found`);
            // Give it one more check cycle
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            renderFn = window[functionName];
            break;
          }
        }
      }
    }
    
    if (renderFn) {
      viewRenderCache.set(viewName, renderFn);
    }
  }

  // Render the view (optimized with yielding)
  if (renderFn) {
    try {
      // Yield to event loop before rendering heavy views
      if (['analytics', 'filegraph', 'navigator', 'whiteboard'].includes(viewName)) {
        // Heavy views: yield first, then render (use requestIdleCallback for better performance)
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => {
            // Double-check view is still active before rendering
            if (window.state?.currentView === viewName) {
              renderFn(container);
            }
            if (window.setLoading) window.setLoading(viewName, false);
          }, { timeout: 100 }); // Slightly increased for better batching
        } else {
          // Fallback: use requestAnimationFrame with double frame delay
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (window.state?.currentView === viewName) {
                renderFn(container);
              }
              if (window.setLoading) window.setLoading(viewName, false);
            });
          });
        }
      } else {
        // Light views: render immediately with animation frame (non-blocking)
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            renderFn(container);
            if (window.setLoading) window.setLoading(viewName, false);
          });
        } else {
          renderFn(container);
          if (window.setLoading) window.setLoading(viewName, false);
        }
      }
      
      // Resume view if it was paused
      resumeView(viewName);
      
      // Restore view state (scroll position, filters, etc.)
      if (window.viewStateManager) {
        const container = document.getElementById('viewContainer');
        if (container) {
          window.viewStateManager.restoreScrollPosition(viewName, container);
          
          // Setup automatic scroll tracking
          if (window.viewStateManager.setupScrollTracking) {
            window.viewStateManager.setupScrollTracking(viewName, container);
          }
        }
      }
      
      // Clear any errors for this view
      if (window.setError) {
        window.setError(viewName, null);
      }
    } catch (error) {
      container.innerHTML = `<div class="empty-state">
        <h3>Error loading view</h3>
        <p>${error.message}</p>
        <button class="btn btn-primary" onclick="window.renderCurrentView()">Retry</button>
      </div>`;
      
      // Set error state
      if (window.setError) {
        window.setError(viewName, error);
      }
      if (window.setLoading) {
        window.setLoading(viewName, false);
      }
    }
  } else {
    // Check if scripts are still loading
    const scriptTags = Array.from(document.querySelectorAll('script[src*="' + viewName + '"]'));
    const functionName = viewFunctionNames[viewName] || `render${viewName.charAt(0).toUpperCase() + viewName.slice(1)}View`;
    const scriptsLoading = scriptTags.some(script => {
      return script.defer && (script.readyState === 'loading' || script.readyState === '');
    });
    
    if (scriptsLoading) {
      // Scripts are still loading, show loading state and retry
      container.innerHTML = `<div class="view-loading">
        <div class="loading-spinner loading-spinner--inline"></div>
        <h3 class="view-loading__title">Loading ${viewName}...</h3>
        <p class="view-loading__message">Scripts are still loading. Please wait...</p>
        <button class="btn btn-primary view-loading__retry" onclick="setTimeout(() => window.renderCurrentView(), 500)">Retry</button>
      </div>`;
      
      // Auto-retry after a short delay
      setTimeout(() => {
        if (window.state?.currentView === viewName) {
          renderCurrentView();
        }
      }, 1000);
    } else {
      // Scripts loaded but function not found - likely an error
      container.innerHTML = `<div class="view-unavailable">
        <h3 class="view-unavailable__title">View not available</h3>
        <p>The view "${viewName}" could not be loaded.</p>
        <p class="view-unavailable__details">
          Expected function: <code>${functionName}</code><br/>
          Scripts found: ${scriptTags.length}
        </p>
        <div class="view-unavailable__actions">
          <button class="btn btn-primary" onclick="window.renderCurrentView()">Retry</button>
          <button class="btn btn-secondary" onclick="location.reload()">Reload Page</button>
        </div>
      </div>`;
    }
    
    if (window.setLoading) {
      window.setLoading(viewName, false);
    }
  }
}

// Preload critical views on idle (check if functions are available)
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => {
    // Check if critical views are loaded
    ['activity'].forEach(viewName => {
      const functionName = viewFunctionNames[viewName];
      if (functionName && window[functionName] && !viewRenderCache.has(viewName)) {
        viewRenderCache.set(viewName, window[functionName]);
      }
    });
  });
}

/**
 * Check if a view is available (function exists)
 */
function isViewAvailable(viewName) {
  const functionName = viewFunctionNames[viewName];
  if (!functionName) return false;
  return typeof window[functionName] === 'function';
}

/**
 * Check availability of all registered views
 */
function checkViewAvailability() {
  const availability = {};
  Object.keys(viewFunctionNames).forEach(viewName => {
    availability[viewName] = isViewAvailable(viewName);
  });
  return availability;
}

/**
 * Update navigation links to show which views are available
 */
function updateNavigationAvailability() {
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    const viewName = link.dataset.view;
    const isAvailable = isViewAvailable(viewName);
    
    if (!isAvailable) {
      link.classList.add('view-unavailable');
      link.title = (link.title || '') + ' (Loading...)';
    } else {
      link.classList.remove('view-unavailable');
      // Remove "(Loading...)" from title if present
      link.title = link.title?.replace(' (Loading...)', '') || '';
    }
  });
}

// Check view availability periodically until all views are loaded
let availabilityCheckInterval = null;
function startAvailabilityCheck() {
  if (availabilityCheckInterval) return;
  
  availabilityCheckInterval = setInterval(() => {
    updateNavigationAvailability();
    
    // Stop checking once all views are available or after 10 seconds
    const availability = checkViewAvailability();
    const allAvailable = Object.values(availability).every(avail => avail);
    
    if (allAvailable || (Date.now() - (window._availabilityCheckStart || Date.now())) > 10000) {
      clearInterval(availabilityCheckInterval);
      availabilityCheckInterval = null;
      updateNavigationAvailability(); // Final update
    }
  }, 500);
}

// Start checking when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window._availabilityCheckStart = Date.now();
    startAvailabilityCheck();
    updateNavigationAvailability();
  });
} else {
  window._availabilityCheckStart = Date.now();
  startAvailabilityCheck();
  updateNavigationAvailability();
}

/**
 * Register cleanup function for a view
 */
function registerViewCleanup(viewName, cleanupFn) {
  if (typeof cleanupFn === 'function') {
    viewCleanupRegistry.set(viewName, cleanupFn);
  }
}

/**
 * Register pause/resume functions for a view
 */
function registerViewPauseResume(viewName, pauseFn, resumeFn) {
  if (typeof pauseFn === 'function' || typeof resumeFn === 'function') {
    viewPauseResumeRegistry.set(viewName, {
      pause: pauseFn,
      resume: resumeFn
    });
  }
}

/**
 * Cleanup a view (called when switching away)
 */
function cleanupView(viewName) {
  if (!viewName) return;
  
  const cleanup = viewCleanupRegistry.get(viewName);
  if (cleanup) {
    try {
      cleanup();
    } catch (error) {
      // Silently handle cleanup errors
    }
  }
}

/**
 * Pause a view (pause animations, timers, etc.)
 */
function pauseView(viewName) {
  if (!viewName) return;
  
  const pauseResume = viewPauseResumeRegistry.get(viewName);
  if (pauseResume && pauseResume.pause) {
    try {
      pauseResume.pause();
    } catch (error) {
      // Silently handle pause errors
    }
  }
}

/**
 * Resume a view (resume animations, timers, etc.)
 */
function resumeView(viewName) {
  if (!viewName) return;
  
  const pauseResume = viewPauseResumeRegistry.get(viewName);
  if (pauseResume && pauseResume.resume) {
    try {
      pauseResume.resume();
    } catch (error) {
      // Silently handle resume errors
    }
  }
}

/**
 * Save view state before switching away
 */
function saveViewState(viewName, state) {
  if (viewName && state) {
    viewStateRegistry.set(viewName, state);
  }
}

/**
 * Restore view state when switching back
 */
function restoreViewState(viewName) {
  if (!viewName) return null;
  return viewStateRegistry.get(viewName) || null;
}

/**
 * Setup visibility change handler to pause/resume views
 */
function setupViewVisibilityHandling() {
  if (typeof document === 'undefined') return;
  
  document.addEventListener('visibilitychange', () => {
    const isVisible = !document.hidden;
    const currentView = window.state?.currentView;
    
    if (currentView) {
      if (isVisible) {
        // Tab became visible - resume current view
        resumeView(currentView);
      } else {
        // Tab hidden - pause current view
        pauseView(currentView);
      }
    }
  });
}

// Setup visibility handling
setupViewVisibilityHandling();

// Export to window for global access
window.switchView = switchView;
window.renderCurrentView = renderCurrentView;
window.isViewAvailable = isViewAvailable;
window.checkViewAvailability = checkViewAvailability;
window.updateNavigationAvailability = updateNavigationAvailability;
window.registerViewCleanup = registerViewCleanup;
window.registerViewPauseResume = registerViewPauseResume;
window.cleanupView = cleanupView;
window.pauseView = pauseView;
window.resumeView = resumeView;
window.saveViewState = saveViewState;
window.restoreViewState = restoreViewState;

