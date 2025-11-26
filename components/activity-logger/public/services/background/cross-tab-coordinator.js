/**
 * Cross-Tab Coordinator
 * Coordinates background operations across multiple tabs using SharedWorker
 */

class CrossTabCoordinator {
  constructor() {
    this.worker = null;
    this.isSupported = typeof SharedWorker !== 'undefined';
    this.isCoordinator = false;
    this.lastSyncTime = null;
  }

  /**
   * Initialize cross-tab coordination
   */
  async initialize() {
    if (!this.isSupported) {
      return;
    }

    try {
      // Create or connect to shared worker
      this.worker = new SharedWorker('/workers/shared-worker.js');
      this.worker.port.start();

      // Listen for messages from shared worker
      this.worker.port.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });

      // Send ping to check connection
      this.worker.port.postMessage({ type: 'PING' });

      // Try to become coordinator (first tab)
      this.requestCoordinatorRole();

    } catch (error) {
      // SharedWorker not available - continue without coordination
    }
  }

  /**
   * Handle messages from shared worker
   */
  handleMessage(data) {
    const { type, state, data: messageData } = data;

    switch (type) {
      case 'STATE_UPDATE':
        this.handleStateUpdate(state);
        break;
      
      case 'SYNC_START':
        this.handleSyncStart(messageData);
        break;
      
      case 'SYNC_COMPLETE':
        this.handleSyncComplete(messageData);
        break;
      
      case 'SYNC_IN_PROGRESS':
        // Another tab is syncing, don't start another sync
        break;
      
      case 'PONG':
        // Connection confirmed
        break;
    }
  }

  /**
   * Request coordinator role
   */
  requestCoordinatorRole() {
    if (this.worker) {
      this.worker.port.postMessage({
        type: 'STATE_UPDATE',
        data: { requestingCoordinator: true }
      });
    }
  }

  /**
   * Request background sync
   */
  requestSync() {
    if (!this.worker || !this.isCoordinator) return;

    this.worker.port.postMessage({
      type: 'SYNC_REQUEST',
      data: { timestamp: Date.now() }
    });
  }

  /**
   * Handle state update from shared worker
   */
  handleStateUpdate(state) {
    this.lastSyncTime = state.lastSyncTime;
    
    // If no coordinator and we're the first tab, become coordinator
    if (!this.isCoordinator && state.activeTabs === 1) {
      this.isCoordinator = true;
    }
  }

  /**
   * Handle sync start notification
   */
  handleSyncStart(data) {
    // Another tab started sync, update our state
    this.lastSyncTime = data.lastSyncTime;
    
    // Notify app
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cross-tab-sync-start', {
        detail: data
      }));
    }
  }

  /**
   * Handle sync complete notification
   */
  handleSyncComplete(data) {
    this.lastSyncTime = data.lastSyncTime;
    
    // Notify app
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cross-tab-sync-complete', {
        detail: data
      }));
    }
  }

  /**
   * Notify sync completion
   */
  notifySyncComplete(data) {
    if (this.worker) {
      this.worker.port.postMessage({
        type: 'SYNC_COMPLETE',
        data: { ...data, timestamp: Date.now() }
      });
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.worker) {
      this.worker.port.close();
      this.worker = null;
    }
  }
}

// Export singleton
const crossTabCoordinator = new CrossTabCoordinator();

if (typeof window !== 'undefined') {
  window.crossTabCoordinator = crossTabCoordinator;
  window.CrossTabCoordinator = CrossTabCoordinator;
}


