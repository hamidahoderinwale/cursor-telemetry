/**
 * Data Access Service
 * Smart routing between Companion Service API and fallback data sources
 * 
 * Hybrid Architecture:
 * - Primary: Companion Service API (real-time, processed, enriched data)
 * - Fallback: CompanionDBReader (IndexedDB cache when companion is offline)
 * 
 * This service provides a unified interface for data access that automatically
 * handles online/offline scenarios.
 */

class DataAccessService {
  constructor(apiClient = null, dbReader = null, persistentStorage = null) {
    this.apiClient = apiClient || window.APIClient;
    this.dbReader = dbReader || (persistentStorage ? new window.CompanionDBReader(persistentStorage) : null);
    this.persistentStorage = persistentStorage || window.persistentStorage;
    this.isOnline = null; // null = unknown, true/false = known state
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 10000; // Check health every 10 seconds
    this.healthCheckPromise = null;
  }

  /**
   * Check if companion service is online
   */
  async checkCompanionOnline(force = false) {
    const now = Date.now();
    
    // Use cached result if recent
    if (!force && this.isOnline !== null && (now - this.lastHealthCheck) < this.healthCheckInterval) {
      return this.isOnline;
    }
    
    // If a health check is already in progress, wait for it
    if (this.healthCheckPromise) {
      return this.healthCheckPromise;
    }
    
    // Perform health check
    this.healthCheckPromise = (async () => {
      try {
        const health = await this.apiClient.get('/health', { 
          timeout: 3000, 
          retries: 0, 
          silent: true 
        });
        
        this.isOnline = health.status === 'running';
        this.lastHealthCheck = now;
        return this.isOnline;
      } catch (error) {
        this.isOnline = false;
        this.lastHealthCheck = now;
        return false;
      } finally {
        this.healthCheckPromise = null;
      }
    })();
    
    return this.healthCheckPromise;
  }

  /**
   * Get data with automatic fallback
   */
  async getData(type, options = {}) {
    const useFallback = options.fallback !== false; // Default to true
    const preferCache = options.preferCache === true; // Default to false
    
    // If explicitly preferring cache, use DB reader
    if (preferCache && this.dbReader) {
      return this.getDataFromCache(type, options);
    }
    
    // Check if companion is online
    const isOnline = await this.checkCompanionOnline();
    
    if (isOnline && !preferCache) {
      // Try API first
      try {
        return await this.getDataFromAPI(type, options);
      } catch (error) {
        // If API fails and fallback is enabled, try cache
        if (useFallback && this.dbReader) {
          console.warn(`[DATA-ACCESS] API failed for ${type}, falling back to cache:`, error.message);
          return this.getDataFromCache(type, options);
        }
        throw error;
      }
    } else {
      // Companion is offline, use cache if available
      if (useFallback && this.dbReader) {
        return this.getDataFromCache(type, options);
      } else {
        throw new Error(`Companion service is offline and no fallback available for ${type}`);
      }
    }
  }

  /**
   * Get data from Companion Service API
   */
  async getDataFromAPI(type, options = {}) {
    const endpointMap = {
      events: '/api/activity',
      prompts: '/entries',
      entries: '/entries',
      activity: '/api/activity',
      workspaces: '/api/workspaces',
      conversations: '/api/prompts',
      stats: '/health'
    };
    
    const endpoint = endpointMap[type] || `/api/${type}`;
    
    // Build query string
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    if (options.since) params.append('since', options.since);
    if (options.until) params.append('until', options.until);
    if (options.workspacePath) params.append('workspace', options.workspacePath);
    if (options.conversationId) params.append('conversation', options.conversationId);
    
    const url = endpoint + (params.toString() ? `?${params.toString()}` : '');
    
    const response = await this.apiClient.get(url, {
      timeout: options.timeout || 20000,
      retries: options.retries || 1,
      silent: options.silent || false
    });
    
    // Normalize response format
    if (response.data) {
      return response.data;
    } else if (Array.isArray(response)) {
      return response;
    } else if (response.entries) {
      return response.entries;
    } else if (response.events) {
      return response.events;
    } else {
      return response;
    }
  }

  /**
   * Get data from cache (IndexedDB via CompanionDBReader)
   */
  async getDataFromCache(type, options = {}) {
    if (!this.dbReader) {
      throw new Error('DB reader not available for cache access');
    }
    
    const methodMap = {
      events: 'getEvents',
      prompts: 'getPrompts',
      entries: 'getEntries',
      activity: 'getActivity',
      workspaces: 'getWorkspaces',
      conversations: 'getConversations',
      stats: 'getStats'
    };
    
    const method = methodMap[type];
    if (!method) {
      throw new Error(`Unknown data type: ${type}`);
    }
    
    return await this.dbReader[method](options);
  }

  /**
   * Convenience methods for common data types
   */
  async getEvents(options = {}) {
    return this.getData('events', options);
  }

  async getPrompts(options = {}) {
    return this.getData('prompts', options);
  }

  async getEntries(options = {}) {
    return this.getData('entries', options);
  }

  async getActivity(options = {}) {
    return this.getData('activity', options);
  }

  async getWorkspaces(options = {}) {
    return this.getData('workspaces', options);
  }

  async getConversations(options = {}) {
    return this.getData('conversations', options);
  }

  async getStats(options = {}) {
    return this.getData('stats', options);
  }

  /**
   * Force refresh from API (bypass cache)
   */
  async refreshFromAPI(type, options = {}) {
    const isOnline = await this.checkCompanionOnline(true); // Force check
    
    if (!isOnline) {
      throw new Error('Companion service is offline, cannot refresh from API');
    }
    
    return this.getDataFromAPI(type, options);
  }

  /**
   * Get data source info (for debugging)
   */
  async getDataSourceInfo() {
    const isOnline = await this.checkCompanionOnline();
    const cacheAvailable = this.dbReader ? await this.dbReader.isCompanionDbAvailable() : false;
    
    return {
      companionOnline: isOnline,
      cacheAvailable,
      primarySource: isOnline ? 'api' : (cacheAvailable ? 'cache' : 'none'),
      fallbackAvailable: cacheAvailable
    };
  }
}

// Export for use in other modules
window.DataAccessService = DataAccessService;




