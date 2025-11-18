/**
 * Computation Manager - Interface for Web Worker computations
 */

class ComputationManager {
  constructor() {
    this.worker = null;
    this.pendingComputations = new Map();
    this.computationId = 0;
    this.initWorker();
  }
  
  initWorker() {
    try {
      // Create worker
      this.worker = new Worker('/workers/computation-worker.js');
      
      this.worker.onmessage = (e) => {
        const { id, type, result, error, progress, message } = e.data;
        
        const computation = this.pendingComputations.get(id);
        if (!computation) return;
        
        if (error) {
          computation.reject(new Error(error));
          this.pendingComputations.delete(id);
          return;
        }
        
        if (type === 'PROGRESS') {
          if (computation.onProgress) {
            computation.onProgress(progress, message);
          }
        } else if (type === 'RESULT') {
          computation.resolve(result);
          this.pendingComputations.delete(id);
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('[COMPUTATION] Worker error:', error);
        // Reject all pending computations
        this.pendingComputations.forEach((computation) => {
          computation.reject(error);
        });
        this.pendingComputations.clear();
      };
    } catch (error) {
      console.warn('[COMPUTATION] Web Worker not available, falling back to main thread:', error);
      this.worker = null;
    }
  }
  
  /**
   * Run computation in worker or fallback to main thread
   */
  async compute(type, data, onProgress = null) {
    const id = ++this.computationId;
    
    return new Promise((resolve, reject) => {
      if (this.worker) {
        // Use worker
        this.pendingComputations.set(id, { resolve, reject, onProgress });
        this.worker.postMessage({ type, data, id });
      } else {
        // Fallback to main thread (with progress simulation)
        this.computeInMainThread(type, data, onProgress)
          .then(resolve)
          .catch(reject);
      }
    });
  }
  
  /**
   * Fallback computation in main thread
   */
  async computeInMainThread(type, data, onProgress) {
    // Import computation functions if available
    if (type === 'PCA' && window.applyPCA) {
      if (onProgress) onProgress(0, 'Starting PCA...');
      const result = window.applyPCA(data.vectors, data.dimensions, data.numComponents);
      if (onProgress) onProgress(100, 'PCA complete');
      return result;
    }
    
    if (type === 'TSNE' && window.applyTSNE) {
      if (onProgress) onProgress(0, 'Starting t-SNE...');
      // t-SNE is slow, so we'll need to break it into chunks
      const result = await this.chunkedTSNE(data, onProgress);
      return result;
    }
    
    if (type === 'MDS' && window.applyMDS) {
      if (onProgress) onProgress(0, 'Starting MDS...');
      const result = window.applyMDS(data.vectors, data.dimensions);
      if (onProgress) onProgress(100, 'MDS complete');
      return result;
    }
    
    throw new Error(`Computation type ${type} not available in main thread`);
  }
  
  /**
   * Chunked t-SNE computation with progress updates
   */
  async chunkedTSNE(data, onProgress) {
    const { vectors, dimensions, numComponents } = data;
    const chunkSize = 50;
    
    // This is a simplified version - actual t-SNE would need proper implementation
    const result = [];
    for (let i = 0; i < vectors.length; i += chunkSize) {
      const chunk = vectors.slice(i, i + chunkSize);
      // Process chunk (placeholder)
      chunk.forEach(() => {
        result.push([Math.random() * 100, Math.random() * 100]);
      });
      
      if (onProgress) {
        onProgress((i / vectors.length) * 100, `Processing chunk ${Math.floor(i / chunkSize) + 1}...`);
      }
      
      // Yield to prevent blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return result;
  }
  
  /**
   * Terminate worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.pendingComputations.clear();
    }
  }
}

// Create global instance
window.computationManager = new ComputationManager();

