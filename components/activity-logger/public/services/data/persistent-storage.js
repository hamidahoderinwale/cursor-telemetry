/**
 * Persistent Storage Manager
 * Uses IndexedDB to store analytics data across sessions
 */

class PersistentStorage {
  constructor() {
    this.dbName = 'CursorTelemetryDB';
    this.version = 2;  // Incremented for new metadata store
    this.db = null;
    this.stores = {
      events: 'events',
      prompts: 'prompts',
      analytics: 'analytics',
      timeSeries: 'timeSeries',
      fileChanges: 'fileChanges',
      sessions: 'sessions',
      cursorDatabase: 'cursorDatabase',
      metadata: 'metadata'  // New: for versioning and cache control
    };
    this.maxTimeSeriesPoints = 1000; // Limit time series to 1000 points max
    this.cacheKey = 'snapshot_version';
  }

  /**
   * Downsample time series data to reduce memory usage
   * Uses LTTB (Largest-Triangle-Three-Buckets) algorithm
   */
  downsampleTimeSeries(data, threshold = 500) {
    if (!data || data.length <= threshold) return data;
    
    console.log(`[DOWN] Downsampling ${data.length} points to ${threshold} points`);
    
    const sampled = [];
    const bucketSize = (data.length - 2) / (threshold - 2);
    
    sampled[0] = data[0]; // Always keep first point
    
    for (let i = 0; i < threshold - 2; i++) {
      const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
      const avgRangeLength = avgRangeEnd - avgRangeStart;
      
      let avgX = 0, avgY = 0;
      
      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += data[j].timestamp || data[j].x || j;
        avgY += data[j].value || data[j].y || 0;
      }
      
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
      
      // Select point in current bucket with largest triangle area
      const rangeOffs = Math.floor(i * bucketSize) + 1;
      const rangeTo = Math.floor((i + 1) * bucketSize) + 1;
      
      let maxArea = -1;
      let maxAreaPoint = null;
      
      for (let j = rangeOffs; j < rangeTo; j++) {
        const pointX = data[j].timestamp || data[j].x || j;
        const pointY = data[j].value || data[j].y || 0;
        
        const area = Math.abs(
          (sampled[sampled.length - 1].timestamp - avgX) * (pointY - sampled[sampled.length - 1].value) -
          (sampled[sampled.length - 1].timestamp - pointX) * (avgY - sampled[sampled.length - 1].value)
        );
        
        if (area > maxArea) {
          maxArea = area;
          maxAreaPoint = data[j];
        }
      }
      
      sampled.push(maxAreaPoint);
    }
    
    sampled[sampled.length] = data[data.length - 1]; // Always keep last point
    
    console.log(`[SUCCESS] Downsampled to ${sampled.length} points (${((1 - sampled.length / data.length) * 100).toFixed(1)}% reduction)`);
    return sampled;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      console.log('[DATA] Opening IndexedDB:', this.dbName, 'version', this.version);
      
      const request = indexedDB.open(this.dbName, this.version);
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('[WARNING] IndexedDB initialization taking longer than expected...');
      }, 3000);

      request.onerror = () => {
        clearTimeout(timeout);
        console.error('[ERROR] IndexedDB open failed:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        this.db = request.result;
        console.log('[SUCCESS] Persistent storage initialized (version', this.db.version, ')');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        clearTimeout(timeout);
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;
        
        console.log(`[SYNC] Upgrading database from version ${oldVersion} to ${newVersion}...`);

        // Events store - all file changes, AI interactions
        if (!db.objectStoreNames.contains(this.stores.events)) {
          console.log('[DATA] Creating events store...');
          const eventsStore = db.createObjectStore(this.stores.events, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          eventsStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventsStore.createIndex('type', 'type', { unique: false });
          eventsStore.createIndex('workspace', 'workspace_path', { unique: false });
          eventsStore.createIndex('sessionId', 'session_id', { unique: false });
        }

        // Prompts store - AI prompts from Cursor DB
        if (!db.objectStoreNames.contains(this.stores.prompts)) {
          console.log('[DATA] Creating prompts store...');
          const promptsStore = db.createObjectStore(this.stores.prompts, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          promptsStore.createIndex('timestamp', 'timestamp', { unique: false });
          promptsStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          promptsStore.createIndex('composerId', 'composerId', { unique: false });
        }

        // Analytics snapshots - hourly/daily aggregations
        if (!db.objectStoreNames.contains(this.stores.analytics)) {
          console.log('[DATA] Creating analytics store...');
          const analyticsStore = db.createObjectStore(this.stores.analytics, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
          analyticsStore.createIndex('type', 'type', { unique: false });
          analyticsStore.createIndex('period', 'period', { unique: false });
        }

        // Time series data - metrics over time
        if (!db.objectStoreNames.contains(this.stores.timeSeries)) {
          console.log('[DATA] Creating timeSeries store...');
          const timeSeriesStore = db.createObjectStore(this.stores.timeSeries, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          timeSeriesStore.createIndex('timestamp', 'timestamp', { unique: false });
          timeSeriesStore.createIndex('metric', 'metric', { unique: false });
          timeSeriesStore.createIndex('workspace', 'workspace', { unique: false });
        }

        // File changes aggregated
        if (!db.objectStoreNames.contains(this.stores.fileChanges)) {
          console.log('[DATA] Creating fileChanges store...');
          const fileChangesStore = db.createObjectStore(this.stores.fileChanges, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          fileChangesStore.createIndex('filePath', 'filePath', { unique: false });
          fileChangesStore.createIndex('timestamp', 'timestamp', { unique: false });
          fileChangesStore.createIndex('workspace', 'workspace', { unique: false });
        }

        // Sessions
        if (!db.objectStoreNames.contains(this.stores.sessions)) {
          console.log('[DATA] Creating sessions store...');
          const sessionsStore = db.createObjectStore(this.stores.sessions, { 
            keyPath: 'sessionId' 
          });
          sessionsStore.createIndex('startTime', 'startTime', { unique: false });
          sessionsStore.createIndex('workspace', 'workspace', { unique: false });
        }

        // Cursor Database cache - conversations, composers
        if (!db.objectStoreNames.contains(this.stores.cursorDatabase)) {
          console.log('[DATA] Creating cursorDatabase store...');
          const cursorDbStore = db.createObjectStore(this.stores.cursorDatabase, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          cursorDbStore.createIndex('type', 'type', { unique: false });
          cursorDbStore.createIndex('workspaceId', 'workspaceId', { unique: false });
          cursorDbStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // Metadata store - for versioning and cache control (NEW in v2)
        if (!db.objectStoreNames.contains(this.stores.metadata)) {
          console.log('[DATA] Creating metadata store (new in v2)...');
          const metadataStore = db.createObjectStore(this.stores.metadata, { 
            keyPath: 'key'
          });
          metadataStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        console.log('[SUCCESS] Database schema upgrade complete');
      };
      
      request.onblocked = () => {
        clearTimeout(timeout);
        console.warn('[WARNING] IndexedDB upgrade blocked. Please close other tabs with this dashboard open.');
      };
    });
  }

  /**
   * Store events
   */
  async storeEvents(events) {
    if (!this.db) await this.init();
    
    // First, get all existing events to check for duplicates
    const existingEvents = await this.getAllEvents();
    const existingKeys = new Set(existingEvents.map(e => `${e.timestamp}_${e.type || 'unknown'}`));
    
    // Filter out duplicates
    const newEvents = events.filter(event => {
      const key = `${event.timestamp}_${event.type || 'unknown'}`;
      return !existingKeys.has(key);
    });
    
    if (newEvents.length === 0) {
      return 0;
    }
    
    // Now store all new events in a single transaction
    const transaction = this.db.transaction([this.stores.events], 'readwrite');
    const store = transaction.objectStore(this.stores.events);
    
    let stored = 0;
    const promises = newEvents.map(event => {
      return new Promise((resolve, reject) => {
        // Use put instead of add to allow updates
        const request = store.put({
          ...event,
          storedAt: Date.now()
        });
        request.onsuccess = () => {
          stored++;
          resolve();
        };
        request.onerror = () => {
          console.warn('Failed to store event:', event.id || event.timestamp, request.error);
          resolve(); // Don't reject, just skip this one
        };
      });
    });
    
    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn('Some events could not be stored:', error.message);
    }
    
    return stored;
  }

  /**
   * Store prompts
   */
  async storePrompts(prompts) {
    if (!this.db) await this.init();
    
    // First, get all existing prompts to check for duplicates
    const existingPrompts = await this.getAllPrompts();
    const existingKeys = new Set(existingPrompts.map(p => {
      if (p.composerId) return `composer_${p.composerId}`;
      return `${p.timestamp}_${p.text?.substring(0, 50) || p.preview?.substring(0, 50) || 'unknown'}`;
    }));
    
    // Filter out duplicates
    const newPrompts = prompts.filter(prompt => {
      let key;
      if (prompt.composerId) {
        key = `composer_${prompt.composerId}`;
      } else {
        key = `${prompt.timestamp}_${prompt.text?.substring(0, 50) || prompt.preview?.substring(0, 50) || 'unknown'}`;
      }
      return !existingKeys.has(key);
    });
    
    if (newPrompts.length === 0) {
      return 0;
    }
    
    // Now store all new prompts in a single transaction
    const transaction = this.db.transaction([this.stores.prompts], 'readwrite');
    const store = transaction.objectStore(this.stores.prompts);
    
    let stored = 0;
    const promises = newPrompts.map(prompt => {
      return new Promise((resolve, reject) => {
        // Use put instead of add to allow updates
        const request = store.put({
          ...prompt,
          storedAt: Date.now()
        });
        request.onsuccess = () => {
          stored++;
          resolve();
        };
        request.onerror = () => {
          console.warn('Failed to store prompt:', prompt.id || prompt.composerId, request.error);
          resolve(); // Don't reject, just skip this one
        };
      });
    });
    
    try {
      await Promise.all(promises);
    } catch (error) {
      console.warn('Some prompts could not be stored:', error.message);
    }
    
    return stored;
  }

  /**
   * Store analytics snapshot
   */
  async storeAnalyticsSnapshot(type, data, period = 'hourly') {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction([this.stores.analytics], 'readwrite');
    const store = transaction.objectStore(this.stores.analytics);
    
    await store.add({
      type,
      period,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Store time series data point
   */
  async storeTimeSeriesPoint(metric, value, workspace = null, metadata = {}) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction([this.stores.timeSeries], 'readwrite');
    const store = transaction.objectStore(this.stores.timeSeries);
    
    await store.add({
      metric,
      value,
      workspace,
      metadata,
      timestamp: Date.now()
    });
  }

  /**
   * Get all events
   */
  async getAllEvents(limit = null, offset = 0) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.events], 'readonly');
      const store = transaction.objectStore(this.stores.events);
      const index = store.index('timestamp');
      
      const request = index.openCursor(null, 'prev'); // newest first
      const results = [];
      let count = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && (!limit || count < limit + offset)) {
          if (count >= offset) {
            results.push(cursor.value);
          }
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get events by time range
   */
  async getEventsByTimeRange(startTime, endTime) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.events], 'readonly');
      const store = transaction.objectStore(this.stores.events);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.bound(startTime, endTime);
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all data from all stores
   */
  async getAll() {
    if (!this.db) await this.init();
    
    const [events, prompts] = await Promise.all([
      this.getAllEvents(),
      this.getAllPrompts()
    ]);
    
    // Get counts for other stores
    let analyticsCount = 0;
    let timeSeriesCount = 0;
    
    try {
      const tx = this.db.transaction(['analytics', 'timeSeries'], 'readonly');
      analyticsCount = await tx.objectStore('analytics').count();
      timeSeriesCount = await tx.objectStore('timeSeries').count();
      await tx.done;
    } catch (error) {
      console.warn('Error counting analytics/timeSeries:', error);
    }
    
    return {
      events,
      prompts,
      analytics: analyticsCount,
      timeSeries: timeSeriesCount,
      fileChanges: 0,
      sessions: 0,
      cursorDatabase: 0
    };
  }

  /**
   * Get all prompts
   */
  async getAllPrompts(limit = null) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.prompts], 'readonly');
      const store = transaction.objectStore(this.stores.prompts);
      const index = store.index('timestamp');
      
      const request = index.openCursor(null, 'prev');
      const results = [];
      let count = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && (!limit || count < limit)) {
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeries(metric, startTime = null, endTime = null) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.timeSeries], 'readonly');
      const store = transaction.objectStore(this.stores.timeSeries);
      const index = store.index('metric');
      
      const request = index.getAll(metric);
      
      request.onsuccess = () => {
        let results = request.result;
        
        // Filter by time range if provided
        if (startTime || endTime) {
          results = results.filter(item => {
            if (startTime && item.timestamp < startTime) return false;
            if (endTime && item.timestamp > endTime) return false;
            return true;
          });
        }
        
        // Sort by timestamp
        results.sort((a, b) => a.timestamp - b.timestamp);
        
        resolve(results);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get analytics by type and period
   */
  async getAnalytics(type, period = 'hourly', limit = 24) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.analytics], 'readonly');
      const store = transaction.objectStore(this.stores.analytics);
      const index = store.index('timestamp');
      
      const request = index.openCursor(null, 'prev');
      const results = [];
      let count = 0;
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && count < limit) {
          if (cursor.value.type === type && cursor.value.period === period) {
            results.push(cursor.value);
            count++;
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Get event by timestamp and type
   */
  async getEventByTimestamp(timestamp, type) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.events], 'readonly');
      const store = transaction.objectStore(this.stores.events);
      const index = store.index('timestamp');
      
      const request = index.get(timestamp);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.type === type) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Helper: Get prompt by composer ID
   */
  async getPromptByComposerId(composerId) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.prompts], 'readonly');
      const store = transaction.objectStore(this.stores.prompts);
      const index = store.index('composerId');
      
      const request = index.get(composerId);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get statistics
   */
  async getStats() {
    if (!this.db) await this.init();
    
    const stats = {};
    
    for (const [name, storeName] of Object.entries(this.stores)) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      stats[name] = await new Promise((resolve) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    }
    
    return stats;
  }

  /**
   * Clear old data (keep last N days)
   */
  async cleanupOldData(daysToKeep = 30) {
    if (!this.db) await this.init();
    
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    // Clean events
    const eventsTransaction = this.db.transaction([this.stores.events], 'readwrite');
    const eventsStore = eventsTransaction.objectStore(this.stores.events);
    const eventsIndex = eventsStore.index('timestamp');
    
    const eventsRequest = eventsIndex.openCursor(IDBKeyRange.upperBound(cutoffTime));
    let eventsDeleted = 0;
    
    eventsRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        eventsDeleted++;
        cursor.continue();
      }
    };
    
    await new Promise((resolve) => {
      eventsTransaction.oncomplete = () => {
        console.log(`Cleaned up ${eventsDeleted} old events`);
        resolve();
      };
    });
  }

  /**
   * Store snapshot metadata (for warm-start)
   */
  async storeMetadata(key, value) {
    if (!this.db) await this.init();
    
    const transaction = this.db.transaction([this.stores.metadata], 'readwrite');
    const store = transaction.objectStore(this.stores.metadata);
    
    await store.put({
      key,
      value,
      lastUpdated: Date.now()
    });
  }

  /**
   * Get snapshot metadata
   */
  async getMetadata(key) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.metadata], 'readonly');
      const store = transaction.objectStore(this.stores.metadata);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get events since a specific timestamp (for diff fetching)
   */
  async getEventsSince(timestamp) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.events], 'readonly');
      const store = transaction.objectStore(this.stores.events);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.lowerBound(timestamp, false);
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get prompts since a specific timestamp
   */
  async getPromptsSince(timestamp) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.stores.prompts], 'readonly');
      const store = transaction.objectStore(this.stores.prompts);
      const index = store.index('timestamp');
      
      const range = IDBKeyRange.lowerBound(timestamp, false);
      const request = index.getAll(range);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if cache is stale (compares with server version)
   */
  async isCacheStale(serverSequence) {
    const cachedSequence = await this.getMetadata('server_sequence');
    return cachedSequence !== serverSequence;
  }

  /**
   * Update server sequence tracking
   */
  async updateServerSequence(sequence) {
    await this.storeMetadata('server_sequence', sequence);
    await this.storeMetadata('last_sync', Date.now());
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime() {
    return await this.getMetadata('last_sync');
  }
}

// Export singleton
const persistentStorage = new PersistentStorage();

// Export to window for global access
if (typeof window !== 'undefined') {
  window.persistentStorage = persistentStorage;
  window.PersistentStorage = PersistentStorage;
}

