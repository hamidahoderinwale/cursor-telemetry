/**
 * Lazy Loader - Load views and resources on demand
 * Reduces initial bundle size and improves load time
 */

class LazyLoader {
  constructor() {
    // Track loaded modules
    this.loadedModules = new Set();
    this.loadingModules = new Map(); // path -> Promise
    
    // Performance metrics
    this.metrics = {
      totalLoaded: 0,
      totalTime: 0,
      cache: new Map() // module -> load time
    };
  }

  /**
   * Load a JavaScript module
   * @param {string} path - Path to the module
   * @returns {Promise} - Resolves when module is loaded
   */
  async loadScript(path) {
    // Check if already loaded
    if (this.loadedModules.has(path)) {
      console.log(`[LAZY-LOAD] Module already loaded: ${path}`);
      return Promise.resolve();
    }
    
    // Check if currently loading
    if (this.loadingModules.has(path)) {
      console.log(`[LAZY-LOAD] Module already loading: ${path}`);
      return this.loadingModules.get(path);
    }
    
    // Start loading
    const startTime = performance.now();
    console.log(`[LAZY-LOAD] Loading module: ${path}`);
    
    const loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      script.async = true;
      
      script.onload = () => {
        const loadTime = performance.now() - startTime;
        this.loadedModules.add(path);
        this.loadingModules.delete(path);
        this.metrics.totalLoaded++;
        this.metrics.totalTime += loadTime;
        this.metrics.cache.set(path, loadTime);
        
        console.log(`[LAZY-LOAD] Loaded ${path} in ${loadTime.toFixed(2)}ms`);
        resolve();
      };
      
      script.onerror = (error) => {
        this.loadingModules.delete(path);
        console.error(`[LAZY-LOAD] Failed to load ${path}:`, error);
        reject(new Error(`Failed to load module: ${path}`));
      };
      
      document.head.appendChild(script);
    });
    
    this.loadingModules.set(path, loadPromise);
    return loadPromise;
  }

  /**
   * Load multiple scripts in parallel
   * @param {string[]} paths - Array of script paths
   * @returns {Promise} - Resolves when all scripts are loaded
   */
  async loadScripts(paths) {
    return Promise.all(paths.map(path => this.loadScript(path)));
  }

  /**
   * Load a CSS file
   * @param {string} path - Path to the CSS file
   * @returns {Promise} - Resolves when CSS is loaded
   */
  async loadCSS(path) {
    // Check if already loaded
    if (this.loadedModules.has(path)) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = path;
      
      link.onload = () => {
        this.loadedModules.add(path);
        console.log(`[LAZY-LOAD] Loaded CSS: ${path}`);
        resolve();
      };
      
      link.onerror = (error) => {
        console.error(`[LAZY-LOAD] Failed to load CSS ${path}:`, error);
        reject(new Error(`Failed to load CSS: ${path}`));
      };
      
      document.head.appendChild(link);
    });
  }

  /**
   * Load view dependencies on demand
   * @param {string} viewName - Name of the view
   * @returns {Promise} - Resolves when view is ready
   */
  async loadView(viewName) {
    const viewConfigs = {
      'analytics': {
        scripts: [
          '/views/analytics/index.js',
          '/charts/analytics-charts.js'
        ],
        css: ['/views/analytics/styles.css']
      },
      'whiteboard': {
        scripts: [
          '/views/whiteboard/index.js',
          '/views/whiteboard/whiteboard-canvas.js'
        ],
        css: ['/views/whiteboard/styles.css']
      },
      'file-graph': {
        scripts: [
          '/views/file-graph/index.js',
          '/visualizations/file-graph/file-graph-visualizer.js'
        ],
        css: ['/views/file-graph/styles.css']
      },
      'navigator': {
        scripts: [
          '/views/navigator/index.js',
          '/views/navigator/navigator-timeline.js'
        ],
        css: ['/views/navigator/styles.css']
      }
    };
    
    const config = viewConfigs[viewName];
    if (!config) {
      console.warn(`[LAZY-LOAD] No configuration for view: ${viewName}`);
      return;
    }
    
    const startTime = performance.now();
    console.log(`[LAZY-LOAD] Loading view: ${viewName}`);
    
    try {
      // Load CSS first (non-blocking)
      if (config.css) {
        await Promise.all(config.css.map(path => this.loadCSS(path)));
      }
      
      // Load scripts
      if (config.scripts) {
        await this.loadScripts(config.scripts);
      }
      
      const loadTime = performance.now() - startTime;
      console.log(`[LAZY-LOAD] View ${viewName} loaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error(`[LAZY-LOAD] Failed to load view ${viewName}:`, error);
      throw error;
    }
  }

  /**
   * Preload views for faster navigation
   * @param {string[]} viewNames - Array of view names to preload
   */
  async preloadViews(viewNames) {
    console.log(`[LAZY-LOAD] Preloading ${viewNames.length} views...`);
    
    // Load views in background during idle time
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(async () => {
        for (const viewName of viewNames) {
          try {
            await this.loadView(viewName);
          } catch (error) {
            console.warn(`[LAZY-LOAD] Failed to preload view ${viewName}:`, error);
          }
        }
      }, { timeout: 5000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(async () => {
        for (const viewName of viewNames) {
          try {
            await this.loadView(viewName);
          } catch (error) {
            console.warn(`[LAZY-LOAD] Failed to preload view ${viewName}:`, error);
          }
        }
      }, 2000);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const avgTime = this.metrics.totalLoaded > 0 
      ? (this.metrics.totalTime / this.metrics.totalLoaded).toFixed(2)
      : 0;
    
    return {
      totalLoaded: this.metrics.totalLoaded,
      totalTime: this.metrics.totalTime.toFixed(2),
      averageTime: avgTime,
      loadedModules: Array.from(this.loadedModules)
    };
  }

  /**
   * Clear cache and reset
   */
  reset() {
    this.loadedModules.clear();
    this.loadingModules.clear();
    this.metrics = {
      totalLoaded: 0,
      totalTime: 0,
      cache: new Map()
    };
  }
}

// Create global instance
window.lazyLoader = window.lazyLoader || new LazyLoader();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LazyLoader;
}
