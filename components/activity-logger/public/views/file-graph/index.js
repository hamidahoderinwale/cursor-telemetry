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

  // Initialize file graph progressively - use idle time for non-critical work
  const initializeHeavy = () => {
    // Main graph - load first (critical)
    if (window.initializeD3FileGraph) {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          window.initializeD3FileGraph();
        }, { timeout: 1000 });
      } else {
        setTimeout(() => window.initializeD3FileGraph(), 200);
      }
    }
    
    // Use Intersection Observer for lazy loading below-the-fold sections
    const setupLazyLoading = () => {
      if (typeof IntersectionObserver === 'undefined') {
        // Fallback: load after delay
        setTimeout(() => {
          loadHeavyVisualizations();
        }, 3000);
        return;
      }
      
      // Lazy load file dependency strength when it becomes visible
      const dependencySection = document.getElementById('fileDependencyStrength');
      if (dependencySection && window.renderFileDependencyStrength) {
        const dependencyObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              dependencyObserver.unobserve(entry.target);
              if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                  window.renderFileDependencyStrength().catch(err => {
                    if (!err.message || !err.message.includes('not found')) {
                      console.warn('[FILE] File dependency strength not available:', err.message);
                    }
                  });
                }, { timeout: 2000 });
              } else {
                setTimeout(() => {
                  window.renderFileDependencyStrength().catch(err => {
                    if (!err.message || !err.message.includes('not found')) {
                      console.warn('[FILE] File dependency strength not available:', err.message);
                    }
                  });
                }, 1000);
              }
            }
          });
        }, { rootMargin: '100px' }); // Start loading 100px before visible
        
        dependencyObserver.observe(dependencySection);
      }
      
      // Lazy load file complexity trends when it becomes visible
      const complexitySection = document.getElementById('fileComplexityTrends');
      if (complexitySection && window.renderFileComplexityTrends) {
        const complexityObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              complexityObserver.unobserve(entry.target);
              if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => {
                  window.renderFileComplexityTrends().catch(err => {
                    if (!err.message || !err.message.includes('not found')) {
                      console.warn('[FILE] File complexity trends not available:', err.message);
                    }
                  });
                }, { timeout: 2000 });
              } else {
                setTimeout(() => {
                  window.renderFileComplexityTrends().catch(err => {
                    if (!err.message || !err.message.includes('not found')) {
                      console.warn('[FILE] File complexity trends not available:', err.message);
                    }
                  });
                }, 1000);
              }
            }
          });
        }, { rootMargin: '100px' }); // Start loading 100px before visible
        
        complexityObserver.observe(complexitySection);
      }
    };
    
    // Setup lazy loading after DOM is ready
    setTimeout(setupLazyLoading, 500);
  };
  
  // Start initialization
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(initializeHeavy, { timeout: 500 });
  } else {
    setTimeout(initializeHeavy, 100);
  }
}

// Export to window for global access
window.renderFileGraphView = renderFileGraphView;
