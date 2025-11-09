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
  'whiteboard': 'renderWhiteboardView'
};

// Debounced view switching
const debouncedRender = window.debounce ? 
  window.debounce(renderCurrentView, 50) : 
  renderCurrentView;

function switchView(viewName) {
  window.state.currentView = viewName;
  
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

  // Render the view
  if (renderFn) {
    try {
      // Use requestAnimationFrame for smooth rendering
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          renderFn(container);
        });
      } else {
        renderFn(container);
      }
    } catch (error) {
      console.error(`[VIEW] Error rendering ${viewName}:`, error);
      container.innerHTML = `<div class="empty-state">Error loading view: ${error.message}</div>`;
    }
  } else {
    container.innerHTML = '<div class="empty-state">View not found or not loaded</div>';
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

