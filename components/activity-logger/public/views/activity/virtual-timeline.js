/**
 * Virtual Timeline - Efficiently renders large timelines using virtual scrolling
 * Only renders visible items for optimal performance
 */

class VirtualTimeline {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      itemHeight: options.itemHeight || 120, // Est. height per timeline item
      bufferSize: options.bufferSize || 3, // Extra items above/below viewport
      threshold: options.threshold || 0.8, // Load more threshold
      batchSize: options.batchSize || 50, // Items to load per batch
      ...options
    };
    
    this.items = [];
    this.renderedItems = new Map();
    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.isLoading = false;
    this.hasMore = true;
    
    // Performance
    this.rafId = null;
    this.scrollTimeout = null;
  }

  /**
   * Initialize with items
   */
  setItems(items) {
    this.items = items || [];
    this.hasMore = items.length >= this.options.batchSize;
    this.render();
  }

  /**
   * Append more items
   */
  appendItems(items) {
    if (!items || items.length === 0) {
      this.hasMore = false;
      return;
    }
    
    this.items.push(...items);
    this.hasMore = items.length >= this.options.batchSize;
    this.render();
  }

  /**
   * Main render function
   */
  render() {
    if (!this.container) return;
    
    // Create virtual scroll container if not exists
    if (!this.scrollContainer) {
      this.createScrollContainer();
    }
    
    // Update viewport measurements
    this.viewportHeight = this.scrollContainer.clientHeight || window.innerHeight;
    const totalHeight = this.items.length * this.options.itemHeight;
    
    // Update spacer height
    if (this.spacer) {
      this.spacer.style.height = `${totalHeight}px`;
    }
    
    // Calculate visible range
    this.calculateVisibleRange();
    
    // Render visible items
    this.renderVisibleItems();
  }

  /**
   * Create scroll container structure
   */
  createScrollContainer() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create scroll wrapper
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'virtual-timeline-scroll';
    this.scrollContainer.style.cssText = `
      position: relative;
      overflow-y: auto;
      height: 100%;
      will-change: scroll-position;
    `;
    
    // Create content container
    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'virtual-timeline-content';
    this.contentContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      will-change: transform;
    `;
    
    // Create spacer for scroll height
    this.spacer = document.createElement('div');
    this.spacer.style.cssText = 'position: relative;';
    
    // Assemble structure
    this.scrollContainer.appendChild(this.spacer);
    this.scrollContainer.appendChild(this.contentContainer);
    this.container.appendChild(this.scrollContainer);
    
    // Attach scroll listener with throttling
    this.scrollContainer.addEventListener('scroll', () => this.onScroll(), { passive: true });
    
    // Attach resize observer
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.scrollContainer);
    }
  }

  /**
   * Calculate visible range
   */
  calculateVisibleRange() {
    this.scrollTop = this.scrollContainer.scrollTop;
    
    const startIndex = Math.floor(this.scrollTop / this.options.itemHeight);
    const endIndex = Math.ceil((this.scrollTop + this.viewportHeight) / this.options.itemHeight);
    
    // Add buffer
    this.visibleStart = Math.max(0, startIndex - this.options.bufferSize);
    this.visibleEnd = Math.min(this.items.length, endIndex + this.options.bufferSize);
  }

  /**
   * Render only visible items
   */
  renderVisibleItems() {
    // Remove items outside visible range
    for (const [index, element] of this.renderedItems.entries()) {
      if (index < this.visibleStart || index >= this.visibleEnd) {
        element.remove();
        this.renderedItems.delete(index);
      }
    }
    
    // Render visible items
    const fragment = document.createDocumentFragment();
    let hasNewItems = false;
    
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      if (!this.renderedItems.has(i)) {
        const item = this.items[i];
        const element = this.renderItem(item, i);
        
        if (element) {
          this.renderedItems.set(i, element);
          fragment.appendChild(element);
          hasNewItems = true;
        }
      }
    }
    
    if (hasNewItems) {
      this.contentContainer.appendChild(fragment);
    }
    
    // Update content position
    const offset = this.visibleStart * this.options.itemHeight;
    this.contentContainer.style.transform = `translateY(${offset}px)`;
  }

  /**
   * Render single item
   */
  renderItem(item, index) {
    if (!item) return null;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'virtual-timeline-item';
    wrapper.style.cssText = `
      position: relative;
      min-height: ${this.options.itemHeight}px;
    `;
    wrapper.dataset.index = index;
    
    // Use appropriate renderer based on item type
    let html = '';
    
    if (item.itemType === 'integrated-chunk' && window.renderIntegratedChunk) {
      html = window.renderIntegratedChunk(item, this.items);
    } else if (item.itemType === 'file-change-group' && window.renderFileChangeGroup) {
      html = window.renderFileChangeGroup(item, 'left', this.items);
    } else if (item.itemType === 'conversation-turn' && window.renderConversationTurnTimelineItem) {
      html = window.renderConversationTurnTimelineItem(item, 'left', this.items);
    } else if (item.itemType === 'prompt' && window.renderPromptTimelineItem) {
      html = window.renderPromptTimelineItem(item, 'left', this.items);
    } else if (item.itemType === 'terminal' && window.renderTerminalTimelineItem) {
      html = window.renderTerminalTimelineItem(item, 'left', this.items);
    } else if (item.itemType === 'event' && window.renderTimelineItem) {
      html = window.renderTimelineItem(item, 'left', this.items);
    } else if (item.itemType === 'status' && window.renderStatusMessageTimelineItem) {
      html = window.renderStatusMessageTimelineItem(item, 'left');
    }
    
    if (html) {
      wrapper.innerHTML = html;
    }
    
    return wrapper;
  }

  /**
   * Handle scroll events (throttled)
   */
  onScroll() {
    // Cancel pending RAF
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    // Schedule render on next frame
    this.rafId = requestAnimationFrame(() => {
      this.render();
      this.checkLoadMore();
    });
  }

  /**
   * Handle resize events
   */
  onResize() {
    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.render();
    }, 150);
  }

  /**
   * Check if we need to load more items
   */
  checkLoadMore() {
    if (this.isLoading || !this.hasMore) return;
    
    const scrollBottom = this.scrollTop + this.viewportHeight;
    const totalHeight = this.items.length * this.options.itemHeight;
    const threshold = totalHeight * this.options.threshold;
    
    if (scrollBottom >= threshold && this.options.onLoadMore) {
      this.isLoading = true;
      this.options.onLoadMore().finally(() => {
        this.isLoading = false;
      });
    }
  }

  /**
   * Scroll to item
   */
  scrollToItem(index) {
    if (index < 0 || index >= this.items.length) return;
    
    const offset = index * this.options.itemHeight;
    this.scrollContainer.scrollTo({
      top: offset,
      behavior: 'smooth'
    });
  }

  /**
   * Destroy and cleanup
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
    if (this.scrollContainer) {
      this.scrollContainer.remove();
    }
    
    this.renderedItems.clear();
    this.items = [];
  }
}

// Export for use in activity view
window.VirtualTimeline = VirtualTimeline;


