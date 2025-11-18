/**
 * Image Lazy Loading Utility
 * Implements lazy loading for images with Intersection Observer
 */

class ImageLazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0.01,
      placeholder: options.placeholder || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E',
      ...options
    };
    this.observer = null;
    this.init();
  }
  
  init() {
    if (typeof IntersectionObserver === 'undefined') {
      console.warn('[LAZY-LOAD] IntersectionObserver not supported, loading all images immediately');
      this.loadAllImages();
      return;
    }
    
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: this.options.rootMargin,
      threshold: this.options.threshold
    });
  }
  
  /**
   * Observe an image element for lazy loading
   * @param {HTMLImageElement} img - Image element
   * @param {string} src - Image source URL
   */
  observe(img, src) {
    if (!img) return;
    
    // Store original src
    img.dataset.lazySrc = src;
    
    // Set placeholder
    if (this.options.placeholder) {
      img.src = this.options.placeholder;
      img.classList.add('lazy-loading');
    }
    
    // Add loading attribute
    img.loading = 'lazy';
    
    // Observe if observer is available
    if (this.observer) {
      this.observer.observe(img);
    } else {
      // Fallback: load immediately
      this.loadImage(img);
    }
  }
  
  /**
   * Load image
   * @param {HTMLImageElement} img - Image element
   */
  loadImage(img) {
    if (!img || !img.dataset.lazySrc) return;
    
    const src = img.dataset.lazySrc;
    
    // Create new image to preload
    const imageLoader = new Image();
    
    imageLoader.onload = () => {
      img.src = src;
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-loaded');
      delete img.dataset.lazySrc;
    };
    
    imageLoader.onerror = () => {
      img.classList.remove('lazy-loading');
      img.classList.add('lazy-error');
      // Optionally set error placeholder
      if (this.options.errorPlaceholder) {
        img.src = this.options.errorPlaceholder;
      }
    };
    
    imageLoader.src = src;
  }
  
  /**
   * Load all images immediately (fallback)
   */
  loadAllImages() {
    document.querySelectorAll('img[data-lazy-src]').forEach(img => {
      this.loadImage(img);
    });
  }
  
  /**
   * Add lazy loading to all images in container
   * @param {HTMLElement} container - Container element
   */
  observeContainer(container) {
    if (!container) return;
    
    const images = container.querySelectorAll('img:not([data-lazy-loaded])');
    images.forEach(img => {
      const src = img.src || img.getAttribute('src');
      if (src && !img.dataset.lazyLoaded) {
        img.dataset.lazyLoaded = 'true';
        this.observe(img, src);
      }
    });
  }
  
  /**
   * Create lazy-loaded image element
   * @param {string} src - Image source
   * @param {Object} attrs - Image attributes
   * @returns {HTMLImageElement}
   */
  createLazyImage(src, attrs = {}) {
    const img = document.createElement('img');
    Object.entries(attrs).forEach(([key, value]) => {
      img.setAttribute(key, value);
    });
    this.observe(img, src);
    return img;
  }
  
  /**
   * Disconnect observer
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Create global instance
window.imageLazyLoader = new ImageLazyLoader();

// Auto-observe images added to DOM
if (typeof MutationObserver !== 'undefined') {
  const mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'IMG' && node.src && !node.dataset.lazyLoaded) {
            window.imageLazyLoader.observe(node, node.src);
          } else {
            // Check for images within added node
            const images = node.querySelectorAll && node.querySelectorAll('img:not([data-lazy-loaded])');
            if (images) {
              images.forEach(img => {
                const src = img.src || img.getAttribute('src');
                if (src) {
                  window.imageLazyLoader.observe(img, src);
                }
              });
            }
          }
        }
      });
    });
  });
  
  // Start observing when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  } else {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

