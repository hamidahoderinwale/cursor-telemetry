/**
 * Navigator View - UMAP semantic navigator
 * HTML templates moved to views/navigator/templates.js
 */

function renderNavigatorView(container) {
  container.innerHTML = window.renderNavigatorViewTemplate();

  // Initialize navigator after DOM is ready
  setTimeout(() => {
    if (window.initializeNavigator) window.initializeNavigator();
  }, 0);
}

// Export to window for global access
window.renderNavigatorView = renderNavigatorView;
