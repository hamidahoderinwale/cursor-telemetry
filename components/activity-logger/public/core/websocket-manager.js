/**
 * WebSocket Manager
 * Handles real-time connections and subscriptions
 */

class WebSocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscriptions = new Set();
    this.lastMessageId = 0;
    
    // Restore connection state from localStorage
    this.restoreConnectionState();
  }

  restoreConnectionState() {
    try {
      const saved = localStorage.getItem('ws_connection_state');
      if (saved) {
        const state = JSON.parse(saved);
        this.subscriptions = new Set(state.subscriptions || []);
        this.lastMessageId = state.lastMessageId || 0;
        console.log('[SYNC] Restored WebSocket state:', {
          subscriptions: this.subscriptions.size,
          lastMessageId: this.lastMessageId
        });
      }
    } catch (error) {
      console.warn('[WARNING] Failed to restore WebSocket state:', error);
    }
  }

  saveConnectionState() {
    try {
      const state = {
        subscriptions: Array.from(this.subscriptions),
        lastMessageId: this.lastMessageId,
        timestamp: Date.now()
      };
      localStorage.setItem('ws_connection_state', JSON.stringify(state));
    } catch (error) {
      console.warn('[WARNING] Failed to save WebSocket state:', error);
    }
  }

  connect(handlers = {}) {
    try {
      this.socket = io(window.CONFIG.API_BASE, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
        query: {
          lastMessageId: this.lastMessageId
        }
      });

      this.socket.on('connect', () => {
        console.log('[SUCCESS] WebSocket connected');
        if (window.state) window.state.connected = true;
        if (handlers.onConnect) handlers.onConnect();
        this.reconnectAttempts = 0;
        this.restoreSubscriptions();
      });

      this.socket.on('disconnect', () => {
        console.log('[ERROR] WebSocket disconnected');
        if (window.state) window.state.connected = false;
        if (handlers.onDisconnect) handlers.onDisconnect();
        this.saveConnectionState();
      });

      this.socket.on('activityUpdate', (data) => {
        console.log('Activity update:', data);
        if (data.id) this.lastMessageId = Math.max(this.lastMessageId, data.id);
        if (handlers.onActivityUpdate) handlers.onActivityUpdate(data);
        this.saveConnectionState();
      });

      this.socket.on('terminal-command', (cmd) => {
        console.log('Terminal command:', cmd);
        if (handlers.onTerminalCommand) handlers.onTerminalCommand(cmd);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[ERROR] WebSocket connection error:', error);
        this.reconnectAttempts++;
      });

      if (window.state) window.state.socket = this.socket;
    } catch (error) {
      console.error('[ERROR] Failed to initialize WebSocket:', error);
    }
  }

  restoreSubscriptions() {
    this.subscriptions.forEach(channel => {
      console.log(`[SYNC] Re-subscribing to: ${channel}`);
      if (this.socket) this.socket.emit('subscribe', channel);
    });
  }

  subscribe(channel) {
    this.subscriptions.add(channel);
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe', channel);
    }
    this.saveConnectionState();
  }

  unsubscribe(channel) {
    this.subscriptions.delete(channel);
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe', channel);
    }
    this.saveConnectionState();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

// Export for use in other modules
window.WebSocketManager = WebSocketManager;

