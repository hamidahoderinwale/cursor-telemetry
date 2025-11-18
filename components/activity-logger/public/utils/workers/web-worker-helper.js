/**
 * Web Worker Helper
 * Manages Web Workers for heavy computations
 */

class WebWorkerHelper {
  constructor() {
    this.workers = new Map();
    this.taskQueue = new Map();
    this.maxWorkers = navigator.hardwareConcurrency || 4;
  }

  /**
   * Execute task in Web Worker
   */
  async execute(workerScript, task, data) {
    // Check if Web Workers are supported
    if (typeof Worker === 'undefined') {
      console.warn('[WORKER] Web Workers not supported, executing synchronously');
      return task(data);
    }

    const taskId = `${workerScript}_${Date.now()}_${Math.random()}`;
    
    return new Promise((resolve, reject) => {
      let worker = this.workers.get(workerScript);
      
      if (!worker) {
        try {
          worker = new Worker(workerScript);
          worker.onerror = (error) => {
            console.error('[WORKER] Worker error:', error);
            this.workers.delete(workerScript);
            // Fallback to synchronous execution
            try {
              resolve(task(data));
            } catch (e) {
              reject(e);
            }
          };
          this.workers.set(workerScript, worker);
        } catch (error) {
          console.warn('[WORKER] Failed to create worker, executing synchronously:', error);
          try {
            resolve(task(data));
          } catch (e) {
            reject(e);
          }
          return;
        }
      }

      const handler = (event) => {
        if (event.data.taskId === taskId) {
          worker.removeEventListener('message', handler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ taskId, data });
    });
  }

  /**
   * Execute heavy computation (fallback to main thread if workers unavailable)
   */
  async executeHeavyComputation(fn, data, chunkSize = 1000) {
    if (typeof Worker === 'undefined') {
      // Fallback: execute in chunks with yields
      return this.executeInChunks(fn, data, chunkSize);
    }

    // For now, use chunked execution as Web Worker setup requires more infrastructure
    return this.executeInChunks(fn, data, chunkSize);
  }

  /**
   * Execute function in chunks with yields
   */
  async executeInChunks(fn, data, chunkSize = 1000) {
    if (!Array.isArray(data) || data.length <= chunkSize) {
      return fn(data);
    }

    const results = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      results.push(...fn(chunk));
      
      // Yield to event loop
      if (i + chunkSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }

  /**
   * Terminate all workers
   */
  terminateAll() {
    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
  }
}

window.WebWorkerHelper = WebWorkerHelper;
window.webWorkerHelper = new WebWorkerHelper();






