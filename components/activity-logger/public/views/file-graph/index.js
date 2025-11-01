/**
 * File Graph View - D3 file relationship visualization
 * HTML templates moved to views/file-graph/templates.js
 */

function renderFileGraphView(container) {
  container.innerHTML = window.renderFileGraphViewTemplate();

  // Initialize file graph after DOM is ready
  setTimeout(() => {
    if (window.initializeD3FileGraph) window.initializeD3FileGraph();
  }, 100);
}

// Export to window for global access
window.renderFileGraphView = renderFileGraphView;
