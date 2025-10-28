/**
 * Analytics Manager
 * Manages deferred analytics loading and Web Worker offloading
 */

class AnalyticsManager {
  constructor() {
    this.worker = null;
    this.taskQueue = [];
    this.taskId = 0;
    this.pendingTasks = new Map();
    this.analyticsDeferred = true;
    this.analyticsReady = false;
    
    // Configuration
    this.config = {
      deferAnalytics: true,
      useWorkers: true,
      initialWindowHours: 24,
      pageSize: 200,
      workerTimeout: 30000  // 30 seconds max per task
    };
    
    // State
    this.isIdle = false;
    this.tabVisible = true;
    
    // Setup idle and visibility detection
    this.setupIdleDetection();
    this.setupVisibilityDetection();
  }

  /**
   * Setup idle callback detection
   */
  setupIdleDetection() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.isIdle = true;
        console.log('[SYNC] Browser idle - ready for deferred analytics');
        this.triggerDeferredAnalytics();
      });
    } else {
      // Fallback: use setTimeout
      setTimeout(() => {
        this.isIdle = true;
        this.triggerDeferredAnalytics();
      }, 2000);
    }
  }

  /**
   * Setup tab visibility detection
   */
  setupVisibilityDetection() {
    document.addEventListener('visibilitychange', () => {
      this.tabVisible = !document.hidden;
      
      if (this.tabVisible && this.analyticsDeferred) {
        console.log('👁️ Tab visible - loading deferred analytics');
        this.triggerDeferredAnalytics();
      }
    });
  }

  /**
   * Trigger deferred analytics
   */
  async triggerDeferredAnalytics() {
    if (!this.analyticsDeferred || this.analyticsReady) return;
    
    console.log('[DATA] Loading deferred analytics...');
    this.analyticsReady = true;
    this.analyticsDeferred = false;
    
    // Dispatch event for components to load heavy analytics
    window.dispatchEvent(new CustomEvent('analytics-ready'));
  }

  /**
   * Initialize Web Worker
   */
  initWorker() {
    if (!this.config.useWorkers || !window.Worker) {
      console.warn('⚠️ Web Workers not available, using main thread');
      return false;
    }
    
    try {
      this.worker = new Worker('analytics-worker.js');
      
      this.worker.onmessage = (e) => {
        const { taskId, success, result, error, stats } = e.data;
        
        const task = this.pendingTasks.get(taskId);
        if (!task) return;
        
        clearTimeout(task.timeout);
        this.pendingTasks.delete(taskId);
        
        if (success) {
          console.log(`[SUCCESS] Worker task ${task.type} completed in ${stats.duration.toFixed(1)}ms`);
          task.resolve(result);
        } else {
          console.error(`❌ Worker task ${task.type} failed:`, error);
          task.reject(new Error(error));
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('❌ Worker error:', error);
        // Fallback to main thread for pending tasks
        this.pendingTasks.forEach(task => {
          task.reject(new Error('Worker crashed'));
        });
        this.pendingTasks.clear();
        this.worker = null;
      };
      
      console.log('[SUCCESS] Analytics worker initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize worker:', error);
      return false;
    }
  }

  /**
   * Run task in worker (or fallback to main thread)
   */
  async runTask(taskType, payload) {
    if (!this.worker && this.config.useWorkers) {
      this.initWorker();
    }
    
    if (!this.worker) {
      // Fallback to main thread
      return this.runTaskMainThread(taskType, payload);
    }
    
    const taskId = ++this.taskId;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task ${taskType} timed out`));
      }, this.config.workerTimeout);
      
      this.pendingTasks.set(taskId, {
        type: taskType,
        resolve,
        reject,
        timeout
      });
      
      this.worker.postMessage({ taskId, task: taskType, payload });
    });
  }

  /**
   * Fallback: run task on main thread
   */
  async runTaskMainThread(taskType, payload) {
    console.warn(`⚠️ Running ${taskType} on main thread (worker unavailable)`);
    
    // For now, return null and let calling code handle fallback
    // In a real implementation, we'd duplicate the worker logic here
    return null;
  }

  /**
   * Compute TF-IDF (via worker)
   */
  async computeTFIDF(documents) {
    return this.runTask('tfidf', { documents });
  }

  /**
   * Compute clusters (via worker)
   */
  async computeClusters(points, k = 5) {
    return this.runTask('cluster', { points, k });
  }

  /**
   * Parse large JSON (via worker)
   */
  async parseJSON(json) {
    return this.runTask('parseJson', { json });
  }

  /**
   * Compute semantic analysis (via worker)
   */
  async computeSemanticAnalysis(documents) {
    return this.runTask('semantic', { documents });
  }

  /**
   * Compute scoring (via worker)
   */
  async computeScoring(items, criteria) {
    return this.runTask('scoring', { items, criteria });
  }

  /**
   * Check if analytics should be deferred
   */
  shouldDeferAnalytics() {
    return this.analyticsDeferred && !this.analyticsReady;
  }

  /**
   * Wait for analytics to be ready
   */
  async waitForAnalytics() {
    if (!this.shouldDeferAnalytics()) {
      return Promise.resolve();
    }
    
    return new Promise((resolve) => {
      const handler = () => {
        window.removeEventListener('analytics-ready', handler);
        resolve();
      };
      window.addEventListener('analytics-ready', handler);
      
      // Also trigger if idle/visible
      if (this.isIdle || this.tabVisible) {
        this.triggerDeferredAnalytics();
      }
    });
  }

  /**
   * Get initial data window (last N hours)
   */
  getInitialWindow() {
    const now = Date.now();
    const windowMs = this.config.initialWindowHours * 60 * 60 * 1000;
    return {
      start: now - windowMs,
      end: now
    };
  }

  /**
   * Check if timestamp is within initial window
   */
  isWithinInitialWindow(timestamp) {
    const window = this.getInitialWindow();
    const ts = new Date(timestamp).getTime();
    return ts >= window.start && ts <= window.end;
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingTasks.clear();
  }
}

// Export singleton
const analyticsManager = new AnalyticsManager();

