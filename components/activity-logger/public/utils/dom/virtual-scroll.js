/**
 * Virtual Scrolling Utility
 * Efficiently renders large lists by only rendering visible items
 */

class VirtualScroll {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 60;
    this.overscan = options.overscan || 5; // Render extra items above/below viewport
    this.items = [];
    this.renderItem = options.renderItem || (() => '');
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    // Create scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.cssText = `
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      position: relative;
    `;
    
    // Create content wrapper
    this.contentWrapper = document.createElement('div');
    this.contentWrapper.style.position = 'relative';
    
    // Create visible items container
    this.itemsContainer = document.createElement('div');
    this.itemsContainer.style.position = 'relative';
    
    this.scrollContainer.appendChild(this.contentWrapper);
    this.contentWrapper.appendChild(this.itemsContainer);
    
    // Handle scroll events with throttling
    this.handleScroll = this.throttle(() => {
      this.update();
    }, 16); // ~60fps
    
    this.scrollContainer.addEventListener('scroll', this.handleScroll);
    
    // Handle resize
    this.handleResize = this.throttle(() => {
      this.update();
    }, 100);
    
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
    
    container.appendChild(this.scrollContainer);
  }
  
  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    return function(...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }
  
  setItems(items) {
    this.items = items;
    this.update();
  }
  
  update() {
    if (!this.items.length) {
      this.itemsContainer.innerHTML = '';
      return;
    }
    
    this.scrollTop = this.scrollContainer.scrollTop;
    this.containerHeight = this.scrollContainer.clientHeight;
    
    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan);
    const endIndex = Math.min(
      this.items.length - 1,
      Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.overscan
    );
    
    // Calculate total height for scrollbar
    const totalHeight = this.items.length * this.itemHeight;
    this.contentWrapper.style.height = `${totalHeight}px`;
    
    // Render visible items
    const visibleItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const item = this.items[i];
      if (item) {
        visibleItems.push({
          index: i,
          item,
          top: i * this.itemHeight
        });
      }
    }
    
    // Update DOM efficiently
    this.renderVisibleItems(visibleItems);
  }
  
  renderVisibleItems(visibleItems) {
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Remove all existing items
    this.itemsContainer.innerHTML = '';
    
    visibleItems.forEach(({ index, item, top }) => {
      const itemElement = document.createElement('div');
      itemElement.style.cssText = `
        position: absolute;
        top: ${top}px;
        left: 0;
        right: 0;
        height: ${this.itemHeight}px;
      `;
      itemElement.innerHTML = this.renderItem(item, index);
      fragment.appendChild(itemElement);
    });
    
    this.itemsContainer.appendChild(fragment);
  }
  
  scrollToIndex(index) {
    const scrollTop = index * this.itemHeight;
    this.scrollContainer.scrollTop = scrollTop;
    this.update();
  }
  
  destroy() {
    this.scrollContainer.removeEventListener('scroll', this.handleScroll);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this.handleResize);
    }
    this.scrollContainer.remove();
  }
}

// Export to window
window.VirtualScroll = VirtualScroll;

