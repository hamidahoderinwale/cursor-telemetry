/**
 * File Graph View - D3 file relationship visualization
 * 
 * Structure:
 * - index.js (this file) - View entry point
 * - templates.js - HTML templates
 * - styles.css - View-specific styles
 * - file-graph.js - Main file graph component
 * - tfidf-analyzer.js - TF-IDF analysis utilities
 * - d3-renderer.js - D3.js rendering functions
 * - helpers.js - Helper functions (getFileTypeColor, etc.)
 */

function renderFileGraphView(container) {
  container.innerHTML = window.renderFileGraphViewTemplate();

  // Initialize file graph after DOM is ready
  setTimeout(() => {
    if (window.initializeD3FileGraph) window.initializeD3FileGraph();
    
    // Load file metrics visualizations
    if (window.renderFileDependencyStrength) {
      window.renderFileDependencyStrength().catch(err => {
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[FILE] File dependency strength not available:', err.message);
        }
      });
    }
    
    if (window.renderFileComplexityTrends) {
      window.renderFileComplexityTrends().catch(err => {
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[FILE] File complexity trends not available:', err.message);
        }
      });
    }
  }, 100);
}

// Export to window for global access
window.renderFileGraphView = renderFileGraphView;
