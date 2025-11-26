/**
 * Batch Request Manager
 * Groups multiple API requests into batches for better performance
 */

class BatchRequestManager {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchDelay = options.batchDelay || 50; // ms
    this.pendingBatches = new Map();
    this.batchTimers = new Map();
  }

  /**
   * Add request to batch
   */
  async batchRequest(batchKey, requestFn, priority = 0) {
    if (!this.pendingBatches.has(batchKey)) {
      this.pendingBatches.set(batchKey, []);
    }

    const batch = this.pendingBatches.get(batchKey);
    
    return new Promise((resolve, reject) => {
      batch.push({ requestFn, resolve, reject, priority });
      
      // Sort by priority (higher first)
      batch.sort((a, b) => b.priority - a.priority);
      
      // Clear existing timer
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey));
      }
      
      // Execute batch if it's full
      if (batch.length >= this.batchSize) {
        this.executeBatch(batchKey);
      } else {
        // Otherwise, set timer to execute after delay
        const timer = setTimeout(() => {
          this.executeBatch(batchKey);
        }, this.batchDelay);
        this.batchTimers.set(batchKey, timer);
      }
    });
  }

  /**
   * Execute a batch of requests
   */
  async executeBatch(batchKey) {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Clear timer
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey));
      this.batchTimers.delete(batchKey);
    }

    // Remove batch from pending
    this.pendingBatches.delete(batchKey);

    // Execute all requests in parallel
    const promises = batch.map(({ requestFn, resolve, reject }) => {
      return Promise.resolve(requestFn())
        .then(resolve)
        .catch(reject);
    });

    await Promise.allSettled(promises);
  }

  /**
   * Execute all pending batches immediately
   */
  async flush() {
    const batchKeys = Array.from(this.pendingBatches.keys());
    await Promise.all(batchKeys.map(key => this.executeBatch(key)));
  }

  /**
   * Clear pending batches
   */
  clear(batchKey = null) {
    if (batchKey) {
      this.pendingBatches.delete(batchKey);
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey));
        this.batchTimers.delete(batchKey);
      }
    } else {
      this.pendingBatches.clear();
      this.batchTimers.forEach(timer => clearTimeout(timer));
      this.batchTimers.clear();
    }
  }
}

window.BatchRequestManager = BatchRequestManager;
window.batchRequestManager = new BatchRequestManager();





