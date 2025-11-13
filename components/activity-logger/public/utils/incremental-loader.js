/**
 * Incremental Data Loader
 * Loads large datasets in chunks with pagination
 */

class IncrementalLoader {
  constructor(options = {}) {
    this.pageSize = options.pageSize || 100;
    this.loadDelay = options.loadDelay || 50;
    this.maxPages = options.maxPages || null; // null = unlimited
    this.cache = new Map();
  }

  /**
   * Load data incrementally
   */
  async loadIncremental(loadFn, renderFn, options = {}) {
    const {
      pageSize = this.pageSize,
      maxPages = this.maxPages,
      startPage = 0,
      cacheKey = null
    } = options;

    // Check cache
    if (cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached.complete) {
        renderFn(cached.allData);
        return cached.allData;
      }
    }

    const allData = [];
    let page = startPage;
    let hasMore = true;

    while (hasMore && (maxPages === null || page < maxPages)) {
      try {
        const pageData = await loadFn(page, pageSize);
        
        if (!pageData || pageData.length === 0) {
          hasMore = false;
          break;
        }

        allData.push(...pageData);
        
        // Render incrementally
        if (renderFn) {
          renderFn(allData, { page, hasMore: pageData.length === pageSize });
        }

        // If we got less than pageSize, we're done
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, this.loadDelay));
        }
      } catch (error) {
        console.error('[INCREMENTAL] Error loading page:', error);
        hasMore = false;
      }
    }

    // Cache result
    if (cacheKey) {
      this.cache.set(cacheKey, {
        allData,
        complete: !hasMore,
        timestamp: Date.now()
      });
    }

    return allData;
  }

  /**
   * Load with virtual scrolling support
   */
  async loadVirtual(loadFn, container, itemHeight, options = {}) {
    const {
      pageSize = this.pageSize,
      overscan = 5
    } = options;

    let allData = [];
    let loadedPages = new Set();
    let scrollTop = 0;

    const updateView = () => {
      const containerHeight = container.clientHeight;
      const visibleStart = Math.floor(scrollTop / itemHeight);
      const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
      
      const startPage = Math.floor((visibleStart - overscan) / pageSize);
      const endPage = Math.ceil((visibleEnd + overscan) / pageSize);

      // Load missing pages
      for (let page = startPage; page <= endPage; page++) {
        if (!loadedPages.has(page)) {
          loadedPages.add(page);
          loadFn(page, pageSize).then(pageData => {
            if (pageData && pageData.length > 0) {
              // Insert page data at correct position
              const startIdx = page * pageSize;
              allData.splice(startIdx, 0, ...pageData);
              updateView();
            }
          });
        }
      }
    };

    container.addEventListener('scroll', () => {
      scrollTop = container.scrollTop;
      updateView();
    });

    // Initial load
    updateView();
  }

  /**
   * Clear cache
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

window.IncrementalLoader = IncrementalLoader;
window.incrementalLoader = new IncrementalLoader();






