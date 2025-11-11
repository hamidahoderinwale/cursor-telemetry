/**
 * Split Pane Resizer
 * Makes panels resizable with drag handles
 */

class SplitPaneResizer {
  constructor(container, leftPanel, rightPanel, resizer, options = {}) {
    this.container = container;
    this.leftPanel = leftPanel;
    this.rightPanel = rightPanel;
    this.resizer = resizer;
    this.options = {
      minLeftWidth: options.minLeftWidth || 300,
      minRightWidth: options.minRightWidth || 300,
      initialRightWidth: options.initialRightWidth || 450,
      ...options
    };
    
    this.isResizing = false;
    this.startX = 0;
    this.startLeftWidth = 0;
    
    this.init();
  }

  init() {
    // Set initial right panel width
    if (this.rightPanel) {
      this.rightPanel.style.width = `${this.options.initialRightWidth}px`;
    }
    
    // Add event listeners
    if (this.resizer) {
      this.resizer.addEventListener('mousedown', this.startResize.bind(this));
      document.addEventListener('mousemove', this.handleResize.bind(this));
      document.addEventListener('mouseup', this.stopResize.bind(this));
      
      // Prevent text selection while dragging
      this.resizer.addEventListener('selectstart', (e) => e.preventDefault());
    }
  }

  startResize(e) {
    this.isResizing = true;
    this.startX = e.clientX;
    this.startLeftWidth = this.leftPanel.offsetWidth;
    
    this.resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    e.preventDefault();
  }

  handleResize(e) {
    if (!this.isResizing) return;
    
    const containerWidth = this.container.offsetWidth;
    const deltaX = e.clientX - this.startX;
    const newLeftWidth = this.startLeftWidth + deltaX;
    const newRightWidth = containerWidth - newLeftWidth - (this.resizer?.offsetWidth || 4);
    
    // Check min widths
    if (newLeftWidth >= this.options.minLeftWidth && 
        newRightWidth >= this.options.minRightWidth) {
      this.leftPanel.style.flex = 'none';
      this.leftPanel.style.width = `${newLeftWidth}px`;
      this.rightPanel.style.width = `${newRightWidth}px`;
    }
    
    e.preventDefault();
  }

  stopResize() {
    if (!this.isResizing) return;
    
    this.isResizing = false;
    this.resizer?.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
}

// Auto-initialize split panes when analytics view is rendered
function initializeAnalyticsSplitPane() {
  const analyticsView = document.querySelector('.analytics-split-view');
  if (!analyticsView) return;
  
  // Check if already initialized
  if (analyticsView.dataset.resizerInitialized === 'true') return;
  
  const leftPanel = analyticsView.querySelector('.analytics-charts-panel');
  const rightPanel = analyticsView.querySelector('.analytics-db-panel');
  
  if (leftPanel && rightPanel) {
    // Check if resizer already exists
    let resizer = analyticsView.querySelector('.split-pane-resizer');
    if (!resizer) {
      // Create resizer element
      resizer = document.createElement('div');
      resizer.className = 'split-pane-resizer';
      rightPanel.parentNode.insertBefore(resizer, rightPanel);
    }
    
    // Initialize resizer
    new SplitPaneResizer(analyticsView, leftPanel, rightPanel, resizer, {
      minLeftWidth: 400,
      minRightWidth: 300,
      initialRightWidth: 450
    });
    
    analyticsView.dataset.resizerInitialized = 'true';
  }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeAnalyticsSplitPane, 100);
  });
} else {
  setTimeout(initializeAnalyticsSplitPane, 100);
}

// Also initialize when analytics view is rendered
window.addEventListener('view-rendered', (event) => {
  if (event.detail?.view === 'analytics') {
    setTimeout(initializeAnalyticsSplitPane, 200);
  }
});

// Export for manual initialization
window.initializeAnalyticsSplitPane = initializeAnalyticsSplitPane;

// Export for manual initialization
window.SplitPaneResizer = SplitPaneResizer;

