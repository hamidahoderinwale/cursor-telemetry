/**
 * Data Worker Helper
 * Simplified interface for using data processing Web Worker
 */

class DataWorkerHelper {
  constructor() {
    this.worker = null;
    this.pendingTasks = new Map();
    this.taskIdCounter = 0;
    this.workerPath = '/workers/data-processing-worker.js';
  }

  /**
   * Get or create worker instance
   */
  getWorker() {
    if (!this.worker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(this.workerPath);
        this.worker.onmessage = (e) => {
          const { taskId, type, result, error, progress } = e.data;
          const task = this.pendingTasks.get(taskId);
          
          if (!task) return;
          
          if (type === 'PROGRESS' && task.onProgress) {
            task.onProgress(progress);
          } else if (type === 'RESULT') {
            task.resolve(result);
            this.pendingTasks.delete(taskId);
          } else if (type === 'ERROR') {
            task.reject(new Error(error));
            this.pendingTasks.delete(taskId);
          }
        };
        
        this.worker.onerror = (error) => {
          console.error('[DATA-WORKER] Worker error:', error);
          // Reject all pending tasks
          for (const [taskId, task] of this.pendingTasks.entries()) {
            task.reject(error);
          }
          this.pendingTasks.clear();
          this.worker = null;
        };
      } catch (error) {
        console.warn('[DATA-WORKER] Failed to create worker, using fallback:', error);
        return null;
      }
    }
    
    return this.worker;
  }

  /**
   * Execute task in worker or fallback to main thread
   */
  async executeTask(task, payload, options = {}) {
    const worker = this.getWorker();
    
    if (!worker) {
      // Fallback to main thread execution
      return this.executeOnMainThread(task, payload, options);
    }
    
    const taskId = ++this.taskIdCounter;
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress: options.onProgress
      });
      
      worker.postMessage({
        taskId,
        task,
        payload,
        options
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error('Task timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Fallback execution on main thread
   */
  async executeOnMainThread(task, payload, options = {}) {
    const { onProgress } = options;
    
    switch (task) {
      case 'SORT':
        return [...payload.data].sort(payload.sortFn);
        
      case 'FILTER':
        return payload.data.filter(payload.filterFn);
        
      case 'GROUP_BY':
        const groups = {};
        for (const item of payload.data) {
          const key = payload.keyFn(item);
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        }
        return groups;
        
      case 'MAP':
        return payload.data.map(payload.mapFn);
        
      case 'REDUCE':
        return payload.data.reduce(payload.reducer, payload.initialValue);
        
      case 'PROCESS_TIMELINE':
        return this.processTimelineOnMainThread(payload.items, payload.options || {});
        
      default:
        throw new Error(`Unknown task: ${task}`);
    }
  }

  /**
   * Process timeline items on main thread
   */
  processTimelineOnMainThread(items, options) {
    let processed = [...items];
    
    if (options.filterFn) {
      processed = processed.filter(options.filterFn);
    }
    
    if (options.sortBy) {
      const sortFn = (a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === 'desc' ? -comparison : comparison;
      };
      processed.sort(sortFn);
    }
    
    if (options.groupBy) {
      const groups = {};
      for (const item of processed) {
        const key = options.groupBy(item);
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      }
      processed = groups;
    }
    
    if (options.limit && Array.isArray(processed)) {
      processed = processed.slice(0, options.limit);
    }
    
    return processed;
  }

  /**
   * Sort array
   */
  async sort(data, sortFn, options = {}) {
    return this.executeTask('SORT', { data, sortFn }, options);
  }

  /**
   * Filter array
   */
  async filter(data, filterFn, options = {}) {
    return this.executeTask('FILTER', { data, filterFn }, options);
  }

  /**
   * Group by key function
   */
  async groupBy(data, keyFn, options = {}) {
    return this.executeTask('GROUP_BY', { data, keyFn }, options);
  }

  /**
   * Map array
   */
  async map(data, mapFn, options = {}) {
    return this.executeTask('MAP', { data, mapFn }, options);
  }

  /**
   * Reduce array
   */
  async reduce(data, reducer, initialValue, options = {}) {
    return this.executeTask('REDUCE', { data, reducer, initialValue }, options);
  }

  /**
   * Process timeline items
   */
  async processTimeline(items, options = {}) {
    return this.executeTask('PROCESS_TIMELINE', { items, options }, options);
  }

  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.pendingTasks.clear();
    }
  }
}

// Export
window.DataWorkerHelper = DataWorkerHelper;
window.dataWorkerHelper = new DataWorkerHelper();



