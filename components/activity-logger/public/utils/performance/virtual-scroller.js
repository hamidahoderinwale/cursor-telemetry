/**
 * Virtual Scroller - Renders only visible items for performance
 * Optimizes rendering of large lists by only showing items in viewport
 */

class VirtualScroller {
  constructor(config) {
    this.container = config.container;
    this.items = config.items || [];
    this.itemHeight = config.itemHeight || 80; // Default item height
    this.renderItem = config.renderItem; // Function to render each item
    this.bufferSize = config.bufferSize || 5; // Number of items to render outside viewport
    
    // State
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    
    // DOM elements
    this.viewport = null;
    this.content = null;
    
    // Throttle scroll handling
    this.scrollTimeout = null;
    
    this.init();
  }

  init() {
    if (!this.container) {
      console.error('[VIRTUAL-SCROLLER] Container not found');
      return;
    }
    
    // Create viewport structure
    this.container.innerHTML = `
      <div class="virtual-scroller-viewport" style="overflow-y: auto; height: 100%; position: relative;">
        <div class="virtual-scroller-spacer" style="height: ${this.items.length * this.itemHeight}px; position: relative;">
          <div class="virtual-scroller-content" style="position: absolute; top: 0; left: 0; right: 0;"></div>
        </div>
      </div>
    `;
    
    this.viewport = this.container.querySelector('.virtual-scroller-viewport');
    this.content = this.container.querySelector('.virtual-scroller-content');
    this.spacer = this.container.querySelector('.virtual-scroller-spacer');
    
    // Setup scroll listener
    this.viewport.addEventListener('scroll', () => this.handleScroll());
    
    // Measure container
    this.containerHeight = this.viewport.clientHeight;
    
    // Initial render
    this.render();
  }

  handleScroll() {
    // Throttle scroll handling for better performance
    if (this.scrollTimeout) {
      return;
    }
    
    this.scrollTimeout = setTimeout(() => {
      this.scrollTop = this.viewport.scrollTop;
      this.render();
      this.scrollTimeout = null;
    }, 16); // ~60fps
  }

  calculateVisibleRange() {
    const scrollTop = this.scrollTop;
    const viewportHeight = this.containerHeight;
    
    // Calculate which items are visible
    this.visibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
    this.visibleEnd = Math.min(
      this.items.length,
      Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
    );
  }

  render() {
    this.calculateVisibleRange();
    
    // Clear content
    this.content.innerHTML = '';
    
    // Position content at the right offset
    this.content.style.transform = `translateY(${this.visibleStart * this.itemHeight}px)`;
    
    // Render visible items
    const fragment = document.createDocumentFragment();
    
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const item = this.items[i];
      if (!item) continue;
      
      const itemElement = document.createElement('div');
      itemElement.className = 'virtual-scroller-item';
      itemElement.style.height = `${this.itemHeight}px`;
      itemElement.innerHTML = this.renderItem(item, i);
      
      fragment.appendChild(itemElement);
    }
    
    this.content.appendChild(fragment);
    
    console.log(`[VIRTUAL-SCROLLER] Rendered items ${this.visibleStart} to ${this.visibleEnd} of ${this.items.length}`);
  }

  /**
   * Update items and re-render
   */
  setItems(newItems) {
    this.items = newItems;
    
    // Update spacer height
    if (this.spacer) {
      this.spacer.style.height = `${this.items.length * this.itemHeight}px`;
    }
    
    this.render();
  }

  /**
   * Scroll to specific item
   */
  scrollToItem(index) {
    if (this.viewport) {
      this.viewport.scrollTop = index * this.itemHeight;
    }
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    if (this.viewport) {
      this.viewport.removeEventListener('scroll', this.handleScroll);
    }
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.VirtualScroller = VirtualScroller;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScroller;
}
