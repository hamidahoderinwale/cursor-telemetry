/**
 * API Documentation View
 * HTML templates moved to views/api-docs/templates.js
 */

function renderAPIDocsView(container) {
  container.innerHTML = window.renderAPIDocsViewTemplate();
}

// Export to window for global access
window.renderAPIDocsView = renderAPIDocsView;
