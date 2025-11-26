/**
 * Shared Worker for Cross-Tab Coordination
 * Coordinates background sync and state across multiple tabs
 */

// Store connected ports
const ports = new Set();
let sharedState = {
  lastSyncTime: null,
  activeTabs: 0,
  syncInProgress: false
};

// Handle new connections
self.addEventListener('connect', (event) => {
  const port = event.ports[0];
  ports.add(port);
  
  // Update active tabs count
  sharedState.activeTabs = ports.size;
  
  // Send current state to new connection
  port.postMessage({
    type: 'STATE_UPDATE',
    state: sharedState
  });

  // Handle messages from tabs
  port.addEventListener('message', (event) => {
    const { type, data } = event.data;

    switch (type) {
      case 'SYNC_REQUEST':
        handleSyncRequest(port, data);
        break;
      
      case 'SYNC_COMPLETE':
        handleSyncComplete(data);
        break;
      
      case 'STATE_UPDATE':
        handleStateUpdate(data);
        break;
      
      case 'PING':
        port.postMessage({ type: 'PONG' });
        break;
    }
  });

  // Handle disconnect
  port.addEventListener('disconnect', () => {
    ports.delete(port);
    sharedState.activeTabs = ports.size;
    broadcastStateUpdate();
  });

  port.start();
});

/**
 * Handle sync request from a tab
 */
function handleSyncRequest(port, data) {
  // If sync is already in progress, notify requester
  if (sharedState.syncInProgress) {
    port.postMessage({
      type: 'SYNC_IN_PROGRESS',
      data: sharedState
    });
    return;
  }

  // Mark sync as in progress
  sharedState.syncInProgress = true;
  sharedState.lastSyncTime = Date.now();

  // Broadcast sync start to all tabs
  broadcast({
    type: 'SYNC_START',
    data: sharedState
  });

  // Notify requester
  port.postMessage({
    type: 'SYNC_STARTED',
    data: sharedState
  });
}

/**
 * Handle sync completion
 */
function handleSyncComplete(data) {
  sharedState.syncInProgress = false;
  sharedState.lastSyncTime = Date.now();

  // Broadcast sync complete to all tabs
  broadcast({
    type: 'SYNC_COMPLETE',
    data: { ...sharedState, ...data }
  });
}

/**
 * Handle state update from a tab
 */
function handleStateUpdate(data) {
  sharedState = { ...sharedState, ...data };
  broadcastStateUpdate();
}

/**
 * Broadcast state update to all connected tabs
 */
function broadcastStateUpdate() {
  broadcast({
    type: 'STATE_UPDATE',
    state: sharedState
  });
}

/**
 * Broadcast message to all connected ports
 */
function broadcast(message) {
  ports.forEach(port => {
    try {
      port.postMessage(message);
    } catch (error) {
      // Port may be closed, remove it
      ports.delete(port);
    }
  });
}


