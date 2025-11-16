/**
 * View Router - Handles view switching and rendering
 * Optimized with caching and lazy loading
 */

// Cache for view render functions
const viewRenderCache = new Map();

// View render function names (for script tag loading)
const viewFunctionNames = {
  'overview': 'renderOverviewView',
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
      'module-graph': 'renderModuleGraphView'
    };

// Debounced view switching
const debouncedRender = window.debounce ? 
  window.debounce(renderCurrentView, 50) : 
  renderCurrentView;

function switchView(viewName) {
  const oldView = window.state.currentView;
  
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
    if (!renderFn && viewName !== 'overview') {
      // Wait up to 2 seconds for deferred scripts to load
      const maxWait = 2000;
      const startTime = Date.now();
      while (!renderFn && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
        renderFn = window[functionName];
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
      
      // Clear any errors for this view
      if (window.setError) {
        window.setError(viewName, null);
      }
    } catch (error) {
      console.error(`[VIEW] Error rendering ${viewName}:`, error);
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
    container.innerHTML = `<div class="empty-state">
      <h3>View not found</h3>
      <p>The view "${viewName}" could not be loaded. It may not be available yet.</p>
      <button class="btn btn-primary" onclick="window.renderCurrentView()">Retry</button>
    </div>`;
    
    if (window.setLoading) {
      window.setLoading(viewName, false);
    }
  }
}

// Preload critical views on idle (check if functions are available)
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => {
    // Check if critical views are loaded
    ['overview', 'activity'].forEach(viewName => {
      const functionName = viewFunctionNames[viewName];
      if (functionName && window[functionName] && !viewRenderCache.has(viewName)) {
        viewRenderCache.set(viewName, window[functionName]);
      }
    });
  });
}

// Export to window for global access
window.switchView = switchView;
window.renderCurrentView = renderCurrentView;

