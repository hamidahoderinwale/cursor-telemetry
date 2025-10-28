/**
 * Data Synchronizer
 * Syncs data from Cursor databases (static) and companion service (live)
 */

class DataSynchronizer {
  constructor(storage, aggregator) {
    this.storage = storage;
    this.aggregator = aggregator;
    this.companionUrl = 'http://localhost:43917';
    this.lastSync = {
      events: 0,
      prompts: 0,
      cursorDb: 0
    };
    this.syncInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize and perform full sync
   */
  async initialize() {
    console.log('[SYNC] Initializing data synchronizer...');
    
    // Initialize storage
    await this.storage.init();
    
    // Load from static Cursor databases (one-time historical data)
    await this.syncCursorDatabases();
    
    // Load from companion service
    await this.syncCompanionService();
    
    // Run initial aggregation
    await this.aggregator.aggregateAll();
    
    // Start periodic sync for live updates
    this.startPeriodicSync();
    
    this.isInitialized = true;
    console.log('[SUCCESS] Data synchronizer initialized');
    
    // Return stats
    return await this.storage.getStats();
  }

  /**
   * Sync from Cursor databases (historical data)
   */
  async syncCursorDatabases() {
    console.log('[ARCHIVE] Syncing from Cursor databases...');
    
    try {
      const response = await fetch(`${this.companionUrl}/api/cursor-database`);
      if (!response.ok) throw new Error('Failed to fetch Cursor database');
      
      const data = await response.json();
      
      // Store conversations
      if (data.data && data.data.conversations) {
        await this.storage.storePrompts(data.data.conversations);
        console.log(`  ✓ Stored ${data.data.conversations.length} conversations`);
      }
      
      // Store prompts
      if (data.data && data.data.prompts) {
        const stored = await this.storage.storePrompts(data.data.prompts);
        console.log(`  ✓ Stored ${stored} new prompts from Cursor DB`);
      }
      
      this.lastSync.cursorDb = Date.now();
    } catch (error) {
      console.warn('Could not sync Cursor databases:', error.message);
    }
  }

  /**
   * Sync from companion service (live data)
   */
  async syncCompanionService() {
    console.log('[ERROR] Syncing from companion service...');
    
    try {
      // Get events
      const eventsResponse = await fetch(`${this.companionUrl}/queue?since=${this.lastSync.events}`);
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        
        if (eventsData.events && eventsData.events.length > 0) {
          const stored = await this.storage.storeEvents(eventsData.events);
          console.log(`  ✓ Stored ${stored} new events`);
          this.lastSync.events = eventsData.cursor || this.lastSync.events;
        }
      }
      
      // Get entries (prompts from companion)
      const entriesResponse = await fetch(`${this.companionUrl}/entries`);
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        
        if (entriesData.entries && entriesData.entries.length > 0) {
          const stored = await this.storage.storePrompts(entriesData.entries);
          console.log(`  ✓ Stored ${stored} new entries`);
        }
      }
      
    } catch (error) {
      console.warn('Could not sync companion service:', error.message);
    }
  }

  /**
   * Start periodic sync (every 30 seconds for live feed)
   */
  startPeriodicSync() {
    console.log('[TIME] Starting periodic sync (every 30s)...');
    
    this.syncInterval = setInterval(async () => {
      console.log('[SYNC] Periodic sync...');
      
      // Sync from companion service only (live updates)
      await this.syncCompanionService();
      
      // Aggregate new data every 5 minutes
      const timeSinceLastAggregation = Date.now() - this.aggregator.lastAggregation;
      if (timeSinceLastAggregation > 5 * 60 * 1000) {
        console.log('[DATA] Running periodic aggregation...');
        await this.aggregator.aggregateAll();
      }
      
    }, 30000); // 30 seconds
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏸️ Periodic sync stopped');
    }
  }

  /**
   * Force full re-sync
   */
  async forceSync() {
    console.log('[SYNC] Force sync requested...');
    
    await this.syncCursorDatabases();
    await this.syncCompanionService();
    await this.aggregator.aggregateAll();
    
    return await this.storage.getStats();
  }

  /**
   * Get all data for dashboard
   */
  async getAllData() {
    const [events, prompts, stats] = await Promise.all([
      this.storage.getAllEvents(1000), // Last 1000 events
      this.storage.getAllPrompts(1000), // Last 1000 prompts
      this.storage.getStats()
    ]);
    
    return {
      events,
      prompts,
      stats,
      lastSync: this.lastSync
    };
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeriesData(metric, hours = 24) {
    const startTime = Date.now() - (hours * 60 * 60 * 1000);
    return await this.storage.getTimeSeries(metric, startTime);
  }

  /**
   * Get time series for all key metrics
   */
  async getAllTimeSeriesData(hours = 24) {
    const metrics = [
      'fileActivity',
      'promptActivity',
      'productivity',
      'complexity',
      'languageDistribution',
      'sessionMetrics',
      'workspaceMetrics'
    ];
    
    const data = {};
    for (const metric of metrics) {
      data[metric] = await this.getTimeSeriesData(metric, hours);
    }
    
    return data;
  }

  /**
   * Export all data as JSON
   */
  async exportData() {
    const [events, prompts, timeSeries] = await Promise.all([
      this.storage.getAllEvents(),
      this.storage.getAllPrompts(),
      this.getAllTimeSeriesData(24 * 30) // Last 30 days
    ]);
    
    return {
      export_date: new Date().toISOString(),
      events,
      prompts,
      time_series: timeSeries,
      stats: await this.storage.getStats()
    };
  }

  /**
   * Check companion service health
   */
  async checkCompanionHealth() {
    try {
      const response = await fetch(`${this.companionUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'connected',
          ...data
        };
      }
    } catch (error) {
      return {
        status: 'disconnected',
        error: error.message
      };
    }
  }
}

// Initialize global synchronizer
let synchronizer = null;

async function initializeDataSync() {
  if (!synchronizer) {
    const storage = new PersistentStorage();
    const aggregator = new AnalyticsAggregator(storage);
    synchronizer = new DataSynchronizer(storage, aggregator);
    
    const stats = await synchronizer.initialize();
    console.log('[DATA] Initial data stats:', stats);
    
    return synchronizer;
  }
  return synchronizer;
}

// Export
window.initializeDataSync = initializeDataSync;
window.getSynchronizer = () => synchronizer;


