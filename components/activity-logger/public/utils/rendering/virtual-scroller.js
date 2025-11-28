/**
 * Virtual Scroller
 * Efficiently renders large lists by only rendering visible items
 */

class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.renderedItems = new Map(); // index -> element
    
    // Configuration
    this.itemHeight = options.itemHeight || 100; // Estimated height per item
    this.bufferSize = options.bufferSize || 5; // Extra items to render above/below viewport
    this.renderFunction = options.renderFunction || this.defaultRenderFunction;
    this.threshold = options.threshold || 0.75; // Load more threshold
    
    // Scroll state
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.totalHeight = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    
    // Loading state
    this.isLoading = false;
    this.hasMore = true;
    this.onLoadMore = options.onLoadMore || null;
    
    // Performance
    this.rafId = null;
    this.scrollTimeout = null;
    
    this.initialize();
  }

  /**
   * Initialize virtual scroller
   */
  initialize() {
    // Create scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.cssText = `
      position: relative;
      overflow-y: auto;
      height: 100%;
      will-change: scroll-position;
    `;
    
    // Create content container
    this.contentContainer = document.createElement('div');
    this.contentContainer.style.cssText = `
      position: relative;
      will-change: transform;
    `;
    
    // Create spacer for total height
    this.spacer = document.createElement('div');
    this.spacer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 1px;
      pointer-events: none;
    `;
    
    this.scrollContainer.appendChild(this.spacer);
    this.scrollContainer.appendChild(this.contentContainer);
    this.container.appendChild(this.scrollContainer);
    
    // Attach scroll listener with passive for better performance
    this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    
    // Observe container size changes
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
      this.resizeObserver.observe(this.scrollContainer);
    }
    
    this.viewportHeight = this.scrollContainer.clientHeight;
  }

  /**
   * Set items to render
   */
  setItems(items) {
    this.items = items;
    this.totalHeight = items.length * this.itemHeight;
    this.spacer.style.height = `${this.totalHeight}px`;
    this.hasMore = true;
    
    this.calculateVisible();
    this.render();
  }

  /**
   * Append items (for infinite scroll)
   */
  appendItems(newItems) {
    this.items = [...this.items, ...newItems];
    this.totalHeight = this.items.length * this.itemHeight;
    this.spacer.style.height = `${this.totalHeight}px`;
    
    this.render();
  }

  /**
   * Handle scroll event
   */
  handleScroll(event) {
    // Cancel any pending RAF
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    // Use RAF for smooth performance
    this.rafId = requestAnimationFrame(() => {
      this.scrollTop = this.scrollContainer.scrollTop;
      this.calculateVisible();
      this.render();
      
      // Check if we need to load more
      this.checkLoadMore();
    });
    
    // Debounced scroll end handler
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.onScrollEnd();
    }, 150);
  }

  /**
   * Handle container resize
   */
  handleResize(entries) {
    for (const entry of entries) {
      this.viewportHeight = entry.contentRect.height;
      this.calculateVisible();
      this.render();
    }
  }

  /**
   * Calculate which items should be visible
   */
  calculateVisible() {
    const scrollTop = this.scrollTop;
    const viewportHeight = this.viewportHeight;
    
    // Calculate visible range with buffer
    this.visibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    this.visibleEnd = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
    );
  }

  /**
   * Render visible items
   */
  render() {
    const fragment = document.createDocumentFragment();
    const toRender = new Set();
    
    // Render visible items
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      toRender.add(i);
      
      if (!this.renderedItems.has(i)) {
        // Create new item
        const element = this.renderItem(this.items[i], i);
        element.style.cssText = `
          position: absolute;
          top: ${i * this.itemHeight}px;
          left: 0;
          right: 0;
        `;
        element.dataset.index = i;
        
        this.renderedItems.set(i, element);
        fragment.appendChild(element);
      }
    }
    
    // Append new elements
    if (fragment.childElementCount > 0) {
      this.contentContainer.appendChild(fragment);
    }
    
    // Remove items outside visible range
    for (const [index, element] of this.renderedItems.entries()) {
      if (!toRender.has(index)) {
        element.remove();
        this.renderedItems.delete(index);
      }
    }
  }

  /**
   * Render individual item
   */
  renderItem(item, index) {
    return this.renderFunction(item, index);
  }

  /**
   * Default render function
   */
  defaultRenderFunction(item, index) {
    const div = document.createElement('div');
    div.className = 'virtual-item';
    div.textContent = JSON.stringify(item);
    return div;
  }

  /**
   * Check if we need to load more data
   */
  checkLoadMore() {
    if (this.isLoading || !this.hasMore || !this.onLoadMore) {
      return;
    }
    
    const scrollBottom = this.scrollTop + this.viewportHeight;
    const triggerPoint = this.totalHeight * this.threshold;
    
    if (scrollBottom >= triggerPoint) {
      this.loadMore();
    }
  }

  /**
   * Load more items
   */
  async loadMore() {
    if (this.isLoading || !this.onLoadMore) return;
    
    this.isLoading = true;
    this.showLoadingIndicator();
    
    try {
      const newItems = await this.onLoadMore();
      
      if (newItems && newItems.length > 0) {
        this.appendItems(newItems);
      } else {
        this.hasMore = false;
      }
    } catch (error) {
      console.error('[VIRTUAL-SCROLLER] Load more failed:', error);
    } finally {
      this.isLoading = false;
      this.hideLoadingIndicator();
    }
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator() {
    if (!this.loadingIndicator) {
      this.loadingIndicator = document.createElement('div');
      this.loadingIndicator.className = 'virtual-scroller-loading';
      this.loadingIndicator.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--color-text-muted);">
          Loading more...
        </div>
      `;
    }
    this.contentContainer.appendChild(this.loadingIndicator);
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    if (this.loadingIndicator && this.loadingIndicator.parentNode) {
      this.loadingIndicator.remove();
    }
  }

  /**
   * Handle scroll end
   */
  onScrollEnd() {
    // Can be used for optimization or analytics
    console.log('[VIRTUAL-SCROLLER] Scroll ended at', this.scrollTop);
  }

  /**
   * Scroll to index
   */
  scrollToIndex(index, behavior = 'smooth') {
    const targetScroll = index * this.itemHeight;
    this.scrollContainer.scrollTo({
      top: targetScroll,
      behavior
    });
  }

  /**
   * Update item height (if using dynamic heights)
   */
  updateItemHeight(newHeight) {
    this.itemHeight = newHeight;
    this.totalHeight = this.items.length * this.itemHeight;
    this.spacer.style.height = `${this.totalHeight}px`;
    this.calculateVisible();
    this.render();
  }

  /**
   * Refresh all rendered items
   */
  refresh() {
    // Clear rendered items
    this.renderedItems.forEach(element => element.remove());
    this.renderedItems.clear();
    
    // Re-render
    this.calculateVisible();
    this.render();
  }

  /**
   * Destroy virtual scroller
   */
  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    this.scrollContainer.remove();
    this.renderedItems.clear();
  }
}

// Export
if (typeof window !== 'undefined') {
  window.VirtualScroller = VirtualScroller;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScroller;
}







