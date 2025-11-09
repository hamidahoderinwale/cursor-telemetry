/**
 * Chunked Renderer Utility
 * Renders large datasets in chunks to prevent blocking the main thread
 */

class ChunkedRenderer {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 50;
    this.delay = options.delay || 0; // Delay between chunks in ms
    this.useIdleCallback = options.useIdleCallback !== false;
  }
  
  /**
   * Render items in chunks with yielding to prevent blocking
   * @param {Array} items - Items to render
   * @param {Function} renderFn - Function to render each item (item, index) => HTMLElement|string
   * @param {HTMLElement} container - Container to append items to
   * @param {Function} onProgress - Optional progress callback (rendered, total)
   * @returns {Promise} Promise that resolves when all items are rendered
   */
  async renderChunked(items, renderFn, container, onProgress = null) {
    if (!items || items.length === 0) {
      return Promise.resolve();
    }
    
    const total = items.length;
    let rendered = 0;
    const fragment = document.createDocumentFragment();
    
    // Render first chunk immediately
    const firstChunk = items.slice(0, Math.min(this.chunkSize, total));
    firstChunk.forEach((item, index) => {
      const element = this.createElement(renderFn(item, index));
      fragment.appendChild(element);
      rendered++;
    });
    
    container.appendChild(fragment);
    if (onProgress) onProgress(rendered, total);
    
    // Render remaining chunks with yielding
    for (let i = this.chunkSize; i < total; i += this.chunkSize) {
      await this.yield();
      
      const chunk = items.slice(i, Math.min(i + this.chunkSize, total));
      const chunkFragment = document.createDocumentFragment();
      
      chunk.forEach((item, index) => {
        const element = this.createElement(renderFn(item, i + index));
        chunkFragment.appendChild(element);
        rendered++;
      });
      
      container.appendChild(chunkFragment);
      if (onProgress) onProgress(rendered, total);
      
      if (this.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
  }
  
  /**
   * Yield to event loop
   */
  yield() {
    if (this.useIdleCallback && typeof requestIdleCallback !== 'undefined') {
      return new Promise(resolve => {
        requestIdleCallback(() => resolve(), { timeout: 50 });
      });
    } else if (typeof requestAnimationFrame !== 'undefined') {
      return new Promise(resolve => requestAnimationFrame(() => resolve()));
    } else {
      return new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  /**
   * Create element from render function result
   */
  createElement(result) {
    if (typeof result === 'string') {
      const div = document.createElement('div');
      div.innerHTML = result;
      return div.firstElementChild || div;
    } else if (result instanceof HTMLElement) {
      return result;
    } else {
      const div = document.createElement('div');
      div.textContent = String(result);
      return div;
    }
  }
  
  /**
   * Process array in chunks (for filtering, mapping, etc.)
   * @param {Array} items - Items to process
   * @param {Function} processFn - Function to process each item
   * @param {Function} onProgress - Optional progress callback
   * @returns {Promise<Array>} Processed items
   */
  async processChunked(items, processFn, onProgress = null) {
    if (!items || items.length === 0) {
      return Promise.resolve([]);
    }
    
    const results = [];
    const total = items.length;
    
    for (let i = 0; i < total; i += this.chunkSize) {
      await this.yield();
      
      const chunk = items.slice(i, Math.min(i + this.chunkSize, total));
      const chunkResults = chunk.map((item, index) => processFn(item, i + index));
      results.push(...chunkResults);
      
      if (onProgress) onProgress(Math.min(i + this.chunkSize, total), total);
    }
    
    return results;
  }
}

// Export to window
window.ChunkedRenderer = ChunkedRenderer;

