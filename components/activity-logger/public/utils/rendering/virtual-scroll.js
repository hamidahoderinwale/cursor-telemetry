/**
 * Virtual Scroll Manager
 * Efficiently renders large lists by only rendering visible items
 */

class VirtualScrollManager {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 50;
    this.overscan = options.overscan || 5; // Render extra items above/below viewport
    this.items = [];
    this.renderFn = null;
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.setupContainer();
  }

  setupContainer() {
    // Create scroll container
    this.scrollContainer = document.createElement('div');
    this.scrollContainer.style.height = '100%';
    this.scrollContainer.style.overflowY = 'auto';
    this.scrollContainer.style.position = 'relative';
    
    // Create content container
    this.contentContainer = document.createElement('div');
    this.contentContainer.style.position = 'relative';
    
    // Create viewport container
    this.viewportContainer = document.createElement('div');
    this.viewportContainer.style.position = 'relative';
    
    this.scrollContainer.appendChild(this.contentContainer);
    this.contentContainer.appendChild(this.viewportContainer);
    this.container.appendChild(this.scrollContainer);
    
    // Setup scroll listener
    this.scrollContainer.addEventListener('scroll', () => {
      this.handleScroll();
    });
    
    // Setup resize observer
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateDimensions();
        this.render();
      });
      this.resizeObserver.observe(this.scrollContainer);
    }
    
    this.updateDimensions();
  }

  updateDimensions() {
    this.containerHeight = this.scrollContainer.clientHeight;
    this.scrollTop = this.scrollContainer.scrollTop;
  }

  handleScroll() {
    this.scrollTop = this.scrollContainer.scrollTop;
    this.render();
  }

  setItems(items) {
    this.items = items;
    this.updateTotalHeight();
    this.render();
  }

  setRenderFunction(renderFn) {
    this.renderFn = renderFn;
  }

  updateTotalHeight() {
    const totalHeight = this.items.length * this.itemHeight;
    this.contentContainer.style.height = `${totalHeight}px`;
  }

  getVisibleRange() {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan);
    const endIndex = Math.min(
      this.items.length - 1,
      Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.overscan
    );
    
    return { startIndex, endIndex };
  }

  render() {
    if (!this.renderFn || this.items.length === 0) {
      this.viewportContainer.innerHTML = '';
      return;
    }

    const { startIndex, endIndex } = this.getVisibleRange();
    const visibleItems = this.items.slice(startIndex, endIndex + 1);
    
    // Calculate offset for visible items
    const offsetY = startIndex * this.itemHeight;
    
    // Render visible items
    const itemsHTML = visibleItems.map((item, index) => {
      const actualIndex = startIndex + index;
      return this.renderFn(item, actualIndex);
    }).join('');
    
    this.viewportContainer.style.transform = `translateY(${offsetY}px)`;
    this.viewportContainer.innerHTML = itemsHTML;
  }

  scrollToIndex(index) {
    const scrollTop = index * this.itemHeight;
    this.scrollContainer.scrollTop = scrollTop;
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.scrollContainer && this.scrollContainer.parentNode) {
      this.scrollContainer.parentNode.removeChild(this.scrollContainer);
    }
  }
}

window.VirtualScrollManager = VirtualScrollManager;



