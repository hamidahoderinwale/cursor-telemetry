/**
 * WebSocket Manager Module
 * Manages real-time WebSocket connection to companion service
 */

import { CONFIG } from '../core/config.js';

export class WebSocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.listeners = new Map();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('[WS] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    console.log(`[WS] Connecting to ${CONFIG.WS_URL}...`);

    try {
      this.socket = new WebSocket(CONFIG.WS_URL);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WS] Connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.socket.onopen = () => {
      console.log('[WS] Connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch (error) {
        console.error('[WS] Message parse error:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('[WS] Error:', error);
      this.emit('error', error);
    };

    this.socket.onclose = () => {
      console.log('[WS] Disconnected');
      this.isConnecting = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    };
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`[WS] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts + 1})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Send message to server
   */
  send(data) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }

  /**
   * Event emitter - register listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Event emitter - emit event
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export default WebSocketManager;

