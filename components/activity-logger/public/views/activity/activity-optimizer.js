/**
 * Activity View Optimizer
 * Performance optimizations for activity timeline rendering
 */

class ActivityOptimizer {
  constructor() {
    // Cache for filtered/processed data
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds cache
    
    // Debounce timers
    this.filterDebounceTimer = null;
    this.renderDebounceTimer = null;
    
    // Memoization keys
    this.lastFilterKey = null;
    this.lastProcessedData = null;
    
    // Request deduplication
    this.pendingConversationRequests = new Map();
  }
  
  /**
   * Generate cache key from filter state
   */
  getCacheKey(workspaceFilter, timeRangeFilter, viewMode) {
    return `${workspaceFilter}|${timeRangeFilter}|${viewMode}|${Date.now() - (Date.now() % this.cacheTimeout)}`;
  }
  
  /**
   * Get cached data if available
   */
  getCachedData(key) {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  /**
   * Cache processed data
   */
  setCachedData(key, data) {
    // Limit cache size
    if (this.cache.size > 10) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  /**
   * Debounce filter changes
   */
  debounceFilterChange(callback, delay = 300) {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
    }
    
    this.filterDebounceTimer = setTimeout(() => {
      callback();
      this.filterDebounceTimer = null;
    }, delay);
  }
  
  /**
   * Debounce render operations
   */
  debounceRender(callback, delay = 100) {
    if (this.renderDebounceTimer) {
      clearTimeout(this.renderDebounceTimer);
    }
    
    this.renderDebounceTimer = setTimeout(() => {
      callback();
      this.renderDebounceTimer = null;
    }, delay);
  }
  
  /**
   * Optimized workspace filtering with memoization
   */
  filterByWorkspace(items, workspaceFilter, normalizeFn) {
    if (workspaceFilter === 'all') {
      return items;
    }
    
    const normalizedFilter = normalizeFn(workspaceFilter);
    const cacheKey = `workspace-${normalizedFilter}-${items.length}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }
    
    const filtered = items.filter(item => {
      const itemWorkspace = item.workspace_path || item.workspacePath || 
                           item.workspace || item.workspaceName || 
                           item.workspaceId || '';
      const normalizedItem = normalizeFn(itemWorkspace);
      
      return normalizedItem === normalizedFilter || 
             normalizedItem.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedItem);
    });
    
    this.setCachedData(cacheKey, filtered);
    return filtered;
  }
  
  /**
   * Optimized time range filtering
   */
  filterByTimeRange(items, timeRangeFilter) {
    if (timeRangeFilter === 'all') {
      return items;
    }
    
    const now = Date.now();
    let cutoffTime = 0;
    
    switch (timeRangeFilter) {
      case 'today':
        cutoffTime = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    // Use binary search for sorted arrays (O(log n) + O(n))
    // For now, simple filter (can be optimized further)
    return items.filter(item => {
      const itemTime = item.timestamp ? new Date(item.timestamp).getTime() : 
                      (item.sortTime || 0);
      return itemTime >= cutoffTime;
    });
  }
  
  /**
   * Batch conversation fetching with deduplication
   */
  async fetchConversationsBatch(conversationIds, batchSize = 10) {
    const results = new Map();
    const toFetch = [];
    
    // Check cache and deduplicate
    conversationIds.forEach(id => {
      const cacheKey = `conv-${id}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        results.set(id, cached);
      } else if (!this.pendingConversationRequests.has(id)) {
        toFetch.push(id);
      }
    });
    
    // Fetch in batches
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      
      // Create promises for batch
      const batchPromises = batch.map(async (id) => {
        // Check if already pending
        if (this.pendingConversationRequests.has(id)) {
          return this.pendingConversationRequests.get(id);
        }
        
        // Create new request
        const promise = window.APIClient.get(`/api/conversations/${id}`, {
          silent: true,
          cacheTTL: 5 * 60 * 1000
        }).then(response => {
          const data = response?.success ? response.data : response;
          const cacheKey = `conv-${id}`;
          this.setCachedData(cacheKey, data);
          this.pendingConversationRequests.delete(id);
          return { id, data };
        }).catch(error => {
          this.pendingConversationRequests.delete(id);
          return { id, error };
        });
        
        this.pendingConversationRequests.set(id, promise);
        return promise;
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && !result.value.error) {
          results.set(batch[index], result.value.data);
        }
      });
      
      // Yield to browser between batches
      if (i + batchSize < toFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }
  
  /**
   * Lazy load context for prompts (only when needed)
   */
  async enhancePromptLazy(prompt, force = false) {
    // Check if already enhanced
    if (prompt._contextEnhanced && !force) {
      return prompt;
    }
    
    // Check cache
    const cacheKey = `prompt-context-${prompt.id || prompt.timestamp}`;
    const cached = this.getCachedData(cacheKey);
    if (cached && !force) {
      return { ...prompt, ...cached, _contextEnhanced: true };
    }
    
    // Enhance only if function available
    if (window.enhancePromptWithContext) {
      try {
        const enhanced = await window.enhancePromptWithContext(prompt);
        this.setCachedData(cacheKey, enhanced);
        return { ...enhanced, _contextEnhanced: true };
      } catch (error) {
        console.warn('[OPTIMIZER] Error enhancing prompt:', error);
        return prompt;
      }
    }
    
    return prompt;
  }
  
  /**
   * Process timeline items in chunks to prevent blocking
   */
  async processTimelineItemsChunked(items, chunkSize = 50, processor) {
    const results = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const processed = await processor(chunk);
      results.push(...processed);
      
      // Yield to browser after each chunk
      if (i + chunkSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return results;
  }
  
  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
    this.lastFilterKey = null;
    this.lastProcessedData = null;
  }
  
  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton
const activityOptimizer = new ActivityOptimizer();

// Clean up expired cache periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    activityOptimizer.clearExpiredCache();
  }, 60000); // Every minute
  
  window.activityOptimizer = activityOptimizer;
  window.ActivityOptimizer = ActivityOptimizer;
}



