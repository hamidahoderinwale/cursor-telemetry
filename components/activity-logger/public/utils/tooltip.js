/**
 * Enhanced Tooltip System
 * Provides custom tooltips that work better than native title attributes
 */

class TooltipManager {
  constructor() {
    this.tooltip = null;
    this.hideTimeout = null;
    this.showTimeout = null;
  }

  /**
   * Initialize tooltip system
   */
  init() {
    // Handle tooltip-icon elements (priority - these are specifically for tooltips)
    document.addEventListener('mouseenter', (e) => {
      const target = e.target.closest('.tooltip-icon');
      if (target && target.title) {
        // Temporarily remove title to prevent native tooltip
        target.dataset.originalTitle = target.title;
        target.removeAttribute('title');
        this.show(target, target.dataset.originalTitle);
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = e.target.closest('.tooltip-icon');
      if (target && target.dataset.originalTitle) {
        // Restore title attribute
        target.title = target.dataset.originalTitle;
        this.hide();
      }
    }, true);

    // Handle elements with data-tooltip attribute
    document.addEventListener('mouseenter', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        const text = target.getAttribute('data-tooltip');
        if (text) {
          this.show(target, text);
        }
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) {
        this.hide();
      }
    }, true);

    // Handle elements with title attribute that should show custom tooltips
    // (buttons, inputs, etc. - but only if they have a title and aren't already handled)
    document.addEventListener('mouseenter', (e) => {
      // Skip if already handled by tooltip-icon or data-tooltip
      if (e.target.closest('.tooltip-icon') || e.target.closest('[data-tooltip]')) {
        return;
      }
      
      const target = e.target;
      // Only show custom tooltip for interactive elements with title
      if (target.title && 
          (target.tagName === 'BUTTON' || 
           target.tagName === 'INPUT' || 
           target.hasAttribute('aria-label') ||
           target.classList.contains('btn') ||
           target.classList.contains('btn-icon'))) {
        // Only show if title is meaningful (more than just a few characters)
        if (target.title.length > 10) {
          target.dataset.originalTitle = target.title;
          target.removeAttribute('title');
          this.show(target, target.dataset.originalTitle);
        }
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      const target = e.target;
      if (target.dataset.originalTitle && 
          (target.tagName === 'BUTTON' || 
           target.tagName === 'INPUT' || 
           target.hasAttribute('aria-label') ||
           target.classList.contains('btn') ||
           target.classList.contains('btn-icon'))) {
        target.title = target.dataset.originalTitle;
        this.hide();
      }
    }, true);
  }

  /**
   * Show tooltip
   */
  show(element, text) {
    // Clear any pending hide
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    // Delay showing tooltip slightly for better UX
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }

    this.showTimeout = setTimeout(() => {
      this.hide(); // Remove any existing tooltip

      if (!text || text.trim() === '') return;

      // Create tooltip element
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'custom-tooltip';
      
      // Support HTML content if text contains HTML tags, otherwise use textContent
      if (text.includes('<') && text.includes('>')) {
        this.tooltip.innerHTML = text;
      } else {
        this.tooltip.textContent = text;
      }
      
      document.body.appendChild(this.tooltip);

      // Position tooltip
      this.positionTooltip(element);

      // Show with animation
      requestAnimationFrame(() => {
        if (this.tooltip) {
          this.tooltip.classList.add('visible');
        }
      });
    }, 150); // Reduced delay for better responsiveness
  }

  /**
   * Hide tooltip
   */
  hide() {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    if (this.tooltip) {
      this.tooltip.classList.remove('visible');
      this.hideTimeout = setTimeout(() => {
        if (this.tooltip && this.tooltip.parentNode) {
          this.tooltip.parentNode.removeChild(this.tooltip);
        }
        this.tooltip = null;
      }, 200); // Wait for fade-out animation
    }
  }

  /**
   * Position tooltip relative to element
   */
  positionTooltip(element) {
    if (!this.tooltip || !element) return;

    // Force a layout calculation to get accurate tooltip dimensions
    this.tooltip.style.visibility = 'hidden';
    this.tooltip.style.display = 'block';

    const rect = element.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Default: position below and centered
    let left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);
    let top = rect.bottom + scrollY + 8;

    // Adjust if tooltip would go off screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;

    // Check right edge
    if (left + tooltipRect.width > viewportWidth + scrollX - padding) {
      left = viewportWidth + scrollX - tooltipRect.width - padding;
    }

    // Check left edge
    if (left < scrollX + padding) {
      left = scrollX + padding;
    }

    // Check bottom edge - position above if needed
    if (top + tooltipRect.height > viewportHeight + scrollY - padding) {
      top = rect.top + scrollY - tooltipRect.height - 8;
    }

    // Check top edge
    if (top < scrollY + padding) {
      top = scrollY + padding;
    }

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.visibility = 'visible';
  }
}

// Initialize tooltip manager
let tooltipManager = null;

function initTooltips() {
  if (!tooltipManager) {
    tooltipManager = new TooltipManager();
    tooltipManager.init();
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTooltips);
} else {
  initTooltips();
}

// Export for manual initialization if needed
window.initTooltips = initTooltips;
window.tooltipManager = tooltipManager;

