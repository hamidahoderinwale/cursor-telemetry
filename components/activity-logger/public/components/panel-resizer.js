/**
 * Enhanced Panel Resizer System
 * Inspired by clean, minimal design with flexible resizing
 * Supports multiple panels with data-panel-group-id and data-panel-size attributes
 */

class PanelResizer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      minPanelSize: options.minPanelSize || 200,
      maxPanelSize: options.maxPanelSize || null,
      storageKey: options.storageKey || null,
      ...options
    };
    
    this.panels = [];
    this.resizers = [];
    this.isResizing = false;
    this.activeResizer = null;
    this.startX = 0;
    this.startSizes = [];
    
    this.init();
  }

  init() {
    // Find all panels in container
    const panelElements = this.container.querySelectorAll('[data-panel]');
    this.panels = Array.from(panelElements);
    
    if (this.panels.length < 2) {
      console.warn('[PanelResizer] Need at least 2 panels for resizing');
      return;
    }
    
    // Load saved sizes from localStorage if available
    if (this.options.storageKey) {
      this.loadSizes();
    }
    
    // Create resizers between panels
    for (let i = 0; i < this.panels.length - 1; i++) {
      this.createResizer(i);
    }
    
    // Set up initial flex values
    this.updateFlexValues();
    
    // Add resize observer for container size changes
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateFlexValues();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  createResizer(index) {
    const resizer = document.createElement('div');
    resizer.className = 'panel-resizer';
    resizer.setAttribute('data-resizer-index', index);
    resizer.setAttribute('role', 'separator');
    resizer.setAttribute('aria-orientation', 'vertical');
    resizer.setAttribute('aria-label', 'Resize panels');
    
    // Insert resizer between panels
    const afterPanel = this.panels[index + 1];
    afterPanel.parentNode.insertBefore(resizer, afterPanel);
    
    this.resizers.push(resizer);
    
    // Add event listeners
    resizer.addEventListener('mousedown', (e) => this.startResize(e, index));
    resizer.addEventListener('touchstart', (e) => this.startResize(e, index), { passive: false });
  }

  startResize(e, index) {
    this.isResizing = true;
    this.activeResizer = index;
    this.startX = e.touches ? e.touches[0].clientX : e.clientX;
    
    // Get current sizes
    this.startSizes = this.panels.map(panel => {
      const rect = panel.getBoundingClientRect();
      return rect.width;
    });
    
    // Add dragging class
    this.resizers[index].classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Add global listeners
    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.stopResize);
    document.addEventListener('touchmove', this.handleResize, { passive: false });
    document.addEventListener('touchend', this.stopResize);
    
    e.preventDefault();
    e.stopPropagation();
  }

  handleResize = (e) => {
    if (!this.isResizing || this.activeResizer === null) return;
    
    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const deltaX = currentX - this.startX;
    const containerWidth = this.container.getBoundingClientRect().width;
    
    const leftPanelIndex = this.activeResizer;
    const rightPanelIndex = this.activeResizer + 1;
    
    const leftPanel = this.panels[leftPanelIndex];
    const rightPanel = this.panels[rightPanelIndex];
    
    const newLeftSize = this.startSizes[leftPanelIndex] + deltaX;
    const newRightSize = this.startSizes[rightPanelIndex] - deltaX;
    
    // Check constraints
    const minSize = this.options.minPanelSize;
    const maxSize = this.options.maxPanelSize || containerWidth;
    
    if (newLeftSize >= minSize && newRightSize >= minSize &&
        newLeftSize <= maxSize && newRightSize <= maxSize) {
      
      // Calculate percentages
      const leftPercent = (newLeftSize / containerWidth) * 100;
      const rightPercent = (newRightSize / containerWidth) * 100;
      
      // Update panel sizes
      leftPanel.style.flex = `${leftPercent} 1 0px`;
      rightPanel.style.flex = `${rightPercent} 1 0px`;
      
      // Update data attributes
      leftPanel.setAttribute('data-panel-size', leftPercent.toFixed(1));
      rightPanel.setAttribute('data-panel-size', rightPercent.toFixed(1));
      
      // Save to localStorage if storage key is set
      if (this.options.storageKey) {
        this.saveSizes();
      }
    }
    
    e.preventDefault();
  }

  stopResize = () => {
    if (!this.isResizing) return;
    
    this.isResizing = false;
    if (this.activeResizer !== null && this.resizers[this.activeResizer]) {
      this.resizers[this.activeResizer].classList.remove('dragging');
    }
    this.activeResizer = null;
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Remove global listeners
    document.removeEventListener('mousemove', this.handleResize);
    document.removeEventListener('mouseup', this.stopResize);
    document.removeEventListener('touchmove', this.handleResize);
    document.removeEventListener('touchend', this.stopResize);
  }

  updateFlexValues() {
    const containerWidth = this.container.getBoundingClientRect().width;
    if (containerWidth === 0) return;
    
    // If panels have data-panel-size, use those; otherwise distribute evenly
    this.panels.forEach((panel, index) => {
      const savedSize = panel.getAttribute('data-panel-size');
      if (savedSize) {
        panel.style.flex = `${savedSize} 1 0px`;
      } else {
        const equalSize = 100 / this.panels.length;
        panel.style.flex = `${equalSize} 1 0px`;
        panel.setAttribute('data-panel-size', equalSize.toFixed(1));
      }
    });
  }

  saveSizes() {
    if (!this.options.storageKey) return;
    
    const sizes = {};
    this.panels.forEach((panel, index) => {
      const panelId = panel.getAttribute('data-panel-id') || `panel-${index}`;
      sizes[panelId] = panel.getAttribute('data-panel-size');
    });
    
    try {
      localStorage.setItem(this.options.storageKey, JSON.stringify(sizes));
    } catch (e) {
      console.warn('[PanelResizer] Failed to save sizes:', e);
    }
  }

  loadSizes() {
    if (!this.options.storageKey) return;
    
    try {
      const saved = localStorage.getItem(this.options.storageKey);
      if (!saved) return;
      
      const sizes = JSON.parse(saved);
      this.panels.forEach((panel, index) => {
        const panelId = panel.getAttribute('data-panel-id') || `panel-${index}`;
        if (sizes[panelId]) {
          panel.setAttribute('data-panel-size', sizes[panelId]);
        }
      });
    } catch (e) {
      console.warn('[PanelResizer] Failed to load sizes:', e);
    }
  }

  destroy() {
    // Remove resizers
    this.resizers.forEach(resizer => resizer.remove());
    this.resizers = [];
    
    // Remove event listeners
    this.stopResize();
    
    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

// Auto-initialize panels with data-panel-group-id
function initializePanelGroups() {
  const groups = document.querySelectorAll('[data-panel-group-id]');
  
  groups.forEach(group => {
    const groupId = group.getAttribute('data-panel-group-id');
    
    // Check if already initialized
    if (group.dataset.resizerInitialized === 'true') return;
    
    // Initialize resizer
    const storageKey = `panel-sizes-${groupId}`;
    const resizer = new PanelResizer(group, {
      minPanelSize: 200,
      storageKey: storageKey
    });
    
    // Store reference
    group._panelResizer = resizer;
    group.dataset.resizerInitialized = 'true';
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePanelGroups);
} else {
  initializePanelGroups();
}

// Re-initialize when views are rendered
window.addEventListener('view-rendered', () => {
  setTimeout(initializePanelGroups, 100);
});

// Export for manual use
window.PanelResizer = PanelResizer;
window.initializePanelGroups = initializePanelGroups;

