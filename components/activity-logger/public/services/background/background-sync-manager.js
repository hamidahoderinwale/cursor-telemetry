/**
 * Background Sync Manager
 * Handles Periodic Background Sync and background data synchronization
 */

class BackgroundSyncManager {
  constructor() {
    this.registration = null;
    this.isSupported = 'serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration?.prototype;
    this.syncTags = new Set(['sync-data', 'sync-analytics', 'sync-cache']);
  }

  /**
   * Initialize background sync manager
   */
  async initialize() {
    if (!this.isSupported) {
      return;
    }

    try {
      // Get service worker registration
      this.registration = await navigator.serviceWorker.ready;
      
      // Register periodic background sync
      await this.registerPeriodicSync();
      
      // Listen for sync events
      this.setupSyncListeners();
      
    } catch (error) {
      // Background sync not available - continue without it
    }
  }

  /**
   * Register periodic background sync
   */
  async registerPeriodicSync() {
    if (!this.registration || !this.isSupported) return;

    try {
      // Check if periodic sync is supported
      if ('periodicSync' in this.registration) {
        // Request permission for periodic sync
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        
        if (status.state === 'granted') {
          // Register periodic sync for data updates (every 5 minutes)
          await this.registration.periodicSync.register('sync-data', {
            minInterval: 5 * 60 * 1000 // 5 minutes
          });
          
          // Register periodic sync for analytics (every 15 minutes)
          await this.registration.periodicSync.register('sync-analytics', {
            minInterval: 15 * 60 * 1000 // 15 minutes
          });
          
        }
      }
    } catch (error) {
      // Periodic sync not available or permission denied
    }
  }

  /**
   * Setup sync event listeners
   */
  setupSyncListeners() {
    if (!this.registration) return;

    // Listen for one-shot sync events
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SYNC_COMPLETE') {
        this.handleSyncComplete(event.data);
      }
    });
  }

  /**
   * Request immediate background sync
   */
  async requestSync(tag = 'sync-data') {
    if (!this.registration) return false;

    try {
      await this.registration.sync.register(tag);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Handle sync completion
   */
  handleSyncComplete(data) {
    // Notify app that background sync completed
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('background-sync-complete', {
        detail: data
      }));
    }
  }

  /**
   * Unregister periodic sync
   */
  async unregisterPeriodicSync() {
    if (!this.registration || !this.isSupported) return;

    try {
      if ('periodicSync' in this.registration) {
        for (const tag of this.syncTags) {
          await this.registration.periodicSync.unregister(tag);
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
}

// Export singleton
const backgroundSyncManager = new BackgroundSyncManager();

if (typeof window !== 'undefined') {
  window.backgroundSyncManager = backgroundSyncManager;
  window.BackgroundSyncManager = BackgroundSyncManager;
}


