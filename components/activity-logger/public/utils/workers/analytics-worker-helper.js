/**
 * Analytics Worker Helper
 * Simplified interface for using analytics Web Worker
 */

class AnalyticsWorkerHelper {
  constructor() {
    this.worker = null;
    this.pendingTasks = new Map();
    this.taskIdCounter = 0;
    this.workerPath = '/workers/analytics-worker.js';
  }

  /**
   * Get or create worker instance
   */
  getWorker() {
    if (!this.worker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(this.workerPath);
        this.worker.onmessage = (e) => {
          const { taskId, type, result, error } = e.data;
          const task = this.pendingTasks.get(taskId);
          
          if (!task) return;
          
          if (type === 'RESULT') {
            task.resolve(result);
            this.pendingTasks.delete(taskId);
          } else if (type === 'ERROR') {
            task.reject(new Error(error));
            this.pendingTasks.delete(taskId);
          }
        };
        
        this.worker.onerror = (error) => {
          console.error('[ANALYTICS-WORKER] Worker error:', error);
          for (const [taskId, task] of this.pendingTasks.entries()) {
            task.reject(error);
          }
          this.pendingTasks.clear();
          this.worker = null;
        };
      } catch (error) {
        console.warn('[ANALYTICS-WORKER] Failed to create worker, using fallback:', error);
        return null;
      }
    }
    
    return this.worker;
  }

  /**
   * Process analytics buckets
   */
  async processBuckets(prompts, events, startTime, endTime, bucketSize) {
    const worker = this.getWorker();
    
    if (!worker || (prompts.length + events.length) < 1000) {
      // Fallback to main thread for small datasets
      return this.processBucketsOnMainThread(prompts, events, startTime, endTime, bucketSize);
    }
    
    const taskId = ++this.taskIdCounter;
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });
      
      worker.postMessage({
        taskId,
        task: 'PROCESS_BUCKETS',
        payload: { prompts, events, startTime, endTime, bucketSize }
      });
      
      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error('Task timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Calculate model usage statistics
   */
  async calculateModelUsage(prompts) {
    const worker = this.getWorker();
    
    if (!worker || prompts.length < 500) {
      // Fallback to main thread for small datasets
      return this.calculateModelUsageOnMainThread(prompts);
    }
    
    const taskId = ++this.taskIdCounter;
    
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(taskId, { resolve, reject });
      
      worker.postMessage({
        taskId,
        task: 'CALCULATE_MODEL_USAGE',
        payload: { prompts }
      });
      
      setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error('Task timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Fallback: Process buckets on main thread
   */
  processBucketsOnMainThread(prompts, events, startTime, endTime, bucketSize) {
    const buckets = [];
    const numBuckets = Math.ceil((endTime - startTime) / bucketSize);
    
    for (let i = 0; i < numBuckets; i++) {
      const bucketTime = startTime + (i * bucketSize);
      buckets.push({
        timestamp: bucketTime,
        promptCount: 0,
        codeChanges: 0,
        fileCount: 0,
        charCount: 0,
        contextUsage: 0,
        contextCount: 0,
        count: 0
      });
    }
    
    // Aggregate prompts
    for (const prompt of prompts) {
      const promptTime = new Date(prompt.timestamp).getTime();
      if (promptTime < startTime || promptTime > endTime) continue;
      
      const bucketIndex = Math.floor((promptTime - startTime) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].promptCount++;
        buckets[bucketIndex].count++;
        
        const text = prompt.text || prompt.prompt || prompt.preview || '';
        buckets[bucketIndex].charCount += text.length;
      }
    }
    
    // Aggregate events
    for (const event of events) {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime < startTime || eventTime > endTime) continue;
      
      const bucketIndex = Math.floor((eventTime - startTime) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].fileCount++;
        
        let changeSize = 0;
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          if (details.chars_added) changeSize += details.chars_added;
          if (details.chars_deleted) changeSize += details.chars_deleted;
        } catch (e) {
          changeSize = 100;
        }
        buckets[bucketIndex].codeChanges += changeSize / 1024;
      }
    }
    
    return buckets;
  }

  /**
   * Fallback: Calculate model usage on main thread
   */
  calculateModelUsageOnMainThread(prompts) {
    const modelCounts = new Map();
    const modeCounts = new Map();
    const modelModeCombos = new Map();
    
    for (const p of prompts) {
      const modelName = p.model_name || p.modelName || p.model || 'unknown';
      const mode = p.mode || p.source || 'unknown';
      
      modelCounts.set(modelName, (modelCounts.get(modelName) || 0) + 1);
      modeCounts.set(mode, (modeCounts.get(mode) || 0) + 1);
      
      const combo = `${modelName} (${mode})`;
      modelModeCombos.set(combo, (modelModeCombos.get(combo) || 0) + 1);
    }
    
    return {
      modelCounts: Object.fromEntries(modelCounts),
      modeCounts: Object.fromEntries(modeCounts),
      modelModeCombos: Object.fromEntries(modelModeCombos)
    };
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
window.AnalyticsWorkerHelper = AnalyticsWorkerHelper;
window.analyticsWorkerHelper = new AnalyticsWorkerHelper();



