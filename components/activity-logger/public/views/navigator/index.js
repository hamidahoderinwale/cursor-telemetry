/**
 * Navigator View - UMAP semantic navigator
 * HTML templates moved to views/navigator/templates.js
 */

function renderNavigatorView(container) {
  container.innerHTML = window.renderNavigatorViewTemplate();

  // Reset initialization state when view is re-rendered
  if (window.navigatorState) {
    window.navigatorState.isInitialized = false;
    window.navigatorState.isInitializing = false;
  }

  // Initialize navigator after DOM is ready
  setTimeout(() => {
    if (window.initializeNavigator) window.initializeNavigator();
  }, 100);
}

// Export to window for global access
window.renderNavigatorView = renderNavigatorView;
