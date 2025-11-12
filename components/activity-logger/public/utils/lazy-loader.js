/**
 * Lazy Loader Utility
 * Dynamically loads modules only when needed to reduce initial load time
 */

class LazyLoader {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
    this.loadQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Load a module dynamically
   * @param {string} modulePath - Path to the module
   * @param {string} moduleName - Name for caching
   * @returns {Promise} Module exports
   */
  async loadModule(modulePath, moduleName = null) {
    const key = moduleName || modulePath;
    
    // Return cached module if already loaded
    if (this.loadedModules.has(key)) {
      return this.loadedModules.get(key);
    }

    // Return existing promise if already loading
    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key);
    }

    // Create loading promise
    const loadPromise = this._doLoadModule(modulePath, key);
    this.loadingPromises.set(key, loadPromise);

    try {
      const module = await loadPromise;
      this.loadedModules.set(key, module);
      return module;
    } catch (error) {
      this.loadingPromises.delete(key);
      throw error;
    }
  }

  async _doLoadModule(modulePath, key) {
    // Check if it's a script tag module
    if (modulePath.endsWith('.js')) {
      return this._loadScriptModule(modulePath);
    }
    
    // Try ES module import
    try {
      return await import(modulePath);
    } catch (error) {
      // Fallback to script tag loading
      return this._loadScriptModule(modulePath);
    }
  }

  async _loadScriptModule(modulePath) {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[data-module="${modulePath}"]`);
      if (existingScript) {
        // Wait for it to load
        if (existingScript.dataset.loaded === 'true') {
          resolve(window[modulePath.split('/').pop().replace('.js', '')] || {});
          return;
        }
        existingScript.addEventListener('load', () => {
          resolve(window[modulePath.split('/').pop().replace('.js', '')] || {});
        });
        return;
      }

      const script = document.createElement('script');
      script.src = modulePath;
      script.setAttribute('data-module', modulePath);
      script.async = true;
      
      script.onload = () => {
        script.dataset.loaded = 'true';
        const moduleName = modulePath.split('/').pop().replace('.js', '');
        resolve(window[moduleName] || {});
      };
      
      script.onerror = () => {
        reject(new Error(`Failed to load module: ${modulePath}`));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Queue modules for batch loading
   */
  queueModule(modulePath, priority = 0) {
    this.loadQueue.push({ path: modulePath, priority });
    this.loadQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Process load queue with priority
   */
  async processQueue(maxConcurrent = 3) {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.loadQueue.length > 0) {
      const batch = this.loadQueue.splice(0, maxConcurrent);
      await Promise.allSettled(
        batch.map(item => this.loadModule(item.path))
      );
      
      // Yield to event loop
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.isProcessingQueue = false;
  }

  /**
   * Preload modules in background (low priority)
   */
  preloadModules(modulePaths) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        modulePaths.forEach(path => this.queueModule(path, 0));
        this.processQueue(2); // Lower concurrency for preload
      }, { timeout: 5000 });
    } else {
      setTimeout(() => {
        modulePaths.forEach(path => this.queueModule(path, 0));
        this.processQueue(2);
      }, 2000);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.loadedModules.clear();
    this.loadingPromises.clear();
  }
}

// Export
if (typeof window !== 'undefined') {
  window.LazyLoader = LazyLoader;
  window.lazyLoader = new LazyLoader();
}





