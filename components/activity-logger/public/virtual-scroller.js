/**
 * Virtual Scroller - Efficient rendering of large lists
 * Only renders visible items for better performance
 */

class VirtualScroller {
  constructor(options = {}) {
    this.container = options.container;
    this.itemHeight = options.itemHeight || 100;
    this.bufferSize = options.bufferSize || 5;
    this.items = [];
    this.renderItem = options.renderItem;
    
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollTop = 0;
    
    this.init();
  }
  
  init() {
    if (!this.container) return;
    
    // Create viewport and content containers
    this.viewport = document.createElement('div');
    this.viewport.style.height = '100%';
    this.viewport.style.overflow = 'auto';
    this.viewport.style.position = 'relative';
    
    this.content = document.createElement('div');
    this.content.style.position = 'relative';
    
    this.viewport.appendChild(this.content);
    this.container.appendChild(this.viewport);
    
    // Set up scroll listener with throttling
    let scrollTimeout;
    this.viewport.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => this.handleScroll(), 16); // ~60fps
    });
    
    // Initial render
    this.handleScroll();
  }
  
  setItems(items) {
    this.items = items;
    this.content.style.height = `${items.length * this.itemHeight}px`;
    this.handleScroll();
  }
  
  handleScroll() {
    if (!this.items.length) return;
    
    this.scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    
    // Calculate visible range with buffer
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + viewportHeight) / this.itemHeight) + this.bufferSize
    );
    
    // Only re-render if range changed
    if (startIndex !== this.visibleStart || endIndex !== this.visibleEnd) {
      this.visibleStart = startIndex;
      this.visibleEnd = endIndex;
      this.render();
    }
  }
  
  render() {
    // Clear existing content
    this.content.innerHTML = '';
    
    // Create container at the correct offset
    const container = document.createElement('div');
    container.style.transform = `translateY(${this.visibleStart * this.itemHeight}px)`;
    container.style.willChange = 'transform';
    
    // Render visible items
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      if (i >= this.items.length) break;
      
      const itemElement = this.renderItem(this.items[i], i);
      if (itemElement) {
        container.appendChild(itemElement);
      }
    }
    
    this.content.appendChild(container);
    
    console.log(`[VSCROLL] Rendered items ${this.visibleStart} to ${this.visibleEnd} of ${this.items.length}`);
  }
  
  scrollToIndex(index) {
    const scrollTop = index * this.itemHeight;
    this.viewport.scrollTop = scrollTop;
  }
  
  getVisibleRange() {
    return {
      start: this.visibleStart,
      end: this.visibleEnd,
      total: this.items.length
    };
  }
  
  destroy() {
    if (this.viewport && this.viewport.parentNode) {
      this.viewport.parentNode.removeChild(this.viewport);
    }
  }
}

// Export for use in main dashboard
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VirtualScroller;
}

