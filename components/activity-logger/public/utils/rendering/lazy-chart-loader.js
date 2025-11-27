/**
 * Lazy Chart Loader
 * Renders charts only when they enter the viewport
 * Significantly improves initial page load performance
 */

class LazyChartLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: '100px', // Start loading 100px before viewport
      threshold: 0.01,      // Trigger when 1% visible
      ...options
    };
    
    this.pendingCharts = new Map(); // chartId -> renderFunction
    this.observer = null;
    this.initialized = false;
  }

  /**
   * Initialize the Intersection Observer
   */
  init() {
    if (this.initialized) return;
    
    if (!('IntersectionObserver' in window)) {
      console.warn('[LAZY-CHART] IntersectionObserver not supported, rendering all charts immediately');
      this.renderAllCharts();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      {
        root: null,
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      }
    );

    this.initialized = true;
    console.log('[LAZY-CHART] Lazy chart loader initialized');
  }

  /**
   * Register a chart for lazy loading
   * @param {string} chartId - Element ID of the chart container
   * @param {Function} renderFunction - Function to call when chart should be rendered
   */
  register(chartId, renderFunction) {
    if (!this.initialized) {
      this.init();
    }

    const element = document.getElementById(chartId);
    if (!element) {
      console.warn(`[LAZY-CHART] Element #${chartId} not found`);
      return;
    }

    // Check if chart is already in viewport (immediate render)
    const rect = element.getBoundingClientRect();
    const inViewport = (
      rect.top < window.innerHeight &&
      rect.bottom > 0
    );

    if (inViewport) {
      console.log(`[LAZY-CHART] #${chartId} already in viewport, rendering immediately`);
      this.renderChart(chartId, renderFunction);
    } else {
      console.log(`[LAZY-CHART] #${chartId} registered for lazy loading`);
      this.pendingCharts.set(chartId, renderFunction);
      
      // Add placeholder
      element.innerHTML = `
        <div class="chart-placeholder" style="display: flex; align-items: center; justify-content: center; min-height: 200px; color: var(--color-text-muted);">
          <div style="text-align: center;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <p style="margin-top: 8px; font-size: 0.875rem;">Chart will load when visible</p>
          </div>
        </div>
      `;
      
      // Observe the element
      if (this.observer) {
        this.observer.observe(element);
      }
    }
  }

  /**
   * Handle intersection events
   */
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const chartId = entry.target.id;
        const renderFunction = this.pendingCharts.get(chartId);
        
        if (renderFunction) {
          console.log(`[LAZY-CHART] #${chartId} entered viewport, rendering...`);
          this.renderChart(chartId, renderFunction);
          
          // Stop observing this element
          this.observer.unobserve(entry.target);
          this.pendingCharts.delete(chartId);
        }
      }
    });
  }

  /**
   * Render a single chart
   */
  renderChart(chartId, renderFunction) {
    const startTime = performance.now();
    
    try {
      renderFunction();
      const renderTime = performance.now() - startTime;
      console.log(`[LAZY-CHART] #${chartId} rendered in ${renderTime.toFixed(2)}ms`);
    } catch (error) {
      console.error(`[LAZY-CHART] Error rendering #${chartId}:`, error);
      const element = document.getElementById(chartId);
      if (element) {
        element.innerHTML = `
          <div style="padding: 20px; text-align: center; color: var(--color-error, #ef4444);">
            Failed to render chart
          </div>
        `;
      }
    }
  }

  /**
   * Render all pending charts immediately (fallback)
   */
  renderAllCharts() {
    console.log(`[LAZY-CHART] Rendering all ${this.pendingCharts.size} pending charts`);
    this.pendingCharts.forEach((renderFunction, chartId) => {
      this.renderChart(chartId, renderFunction);
    });
    this.pendingCharts.clear();
  }

  /**
   * Clear all observers and pending charts
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.pendingCharts.clear();
    this.initialized = false;
    console.log('[LAZY-CHART] Lazy chart loader destroyed');
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.lazyChartLoader = new LazyChartLoader();
  
  // Helper function for easy registration
  window.registerLazyChart = function(chartId, renderFunction) {
    if (window.lazyChartLoader) {
      window.lazyChartLoader.register(chartId, renderFunction);
    } else {
      // Fallback: render immediately
      renderFunction();
    }
  };
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LazyChartLoader;
}


