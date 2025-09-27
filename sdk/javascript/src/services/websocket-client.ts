/**
 * WebSocket client for real-time updates
 */

import { io, Socket } from 'socket.io-client';
import { WebSocketConfig, WebSocketEvent } from '../types';

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventHandlers = new Map<string, Set<(data: any) => void>>();

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      ...config
    };
  }

  connect(baseUrl: string, apiKey?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(baseUrl, {
          auth: {
            token: apiKey
          },
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: true
        });

        this.socket.on('connect', () => {
          console.log('[CursorTelemetry] WebSocket connected');
          this.reconnectAttempts = 0;
          this.config.onConnect?.();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[CursorTelemetry] WebSocket disconnected:', reason);
          this.config.onDisconnect?.();
          
          if (this.config.autoReconnect && reason !== 'io client disconnect') {
            this.scheduleReconnect();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('[CursorTelemetry] WebSocket connection error:', error);
          this.config.onError?.(error);
          
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        // Set up event handlers
        this.setupEventHandlers();

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Generic event handler
    this.socket.onAny((eventName: string, data: any) => {
      const handlers = this.eventHandlers.get(eventName);
      if (handlers) {
        const event: WebSocketEvent = {
          type: eventName,
          data,
          timestamp: new Date().toISOString()
        };
        
        handlers.forEach(handler => {
          try {
            handler(event);
          } catch (error) {
            console.error(`[CursorTelemetry] Error in event handler for ${eventName}:`, error);
          }
        });
      }
    });

    // Specific event handlers
    this.socket.on('sessions-updated', (data) => {
      this.emit('sessions-updated', data);
    });

    this.socket.on('session-created', (data) => {
      this.emit('session-created', data);
    });

    this.socket.on('file-changed', (data) => {
      this.emit('file-changed', data);
    });

    this.socket.on('analysis-complete', (data) => {
      this.emit('analysis-complete', data);
    });

    this.socket.on('memory-created', (data) => {
      this.emit('memory-created', data);
    });

    this.socket.on('memory-executed', (data) => {
      this.emit('memory-executed', data);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('[CursorTelemetry] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[CursorTelemetry] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[CursorTelemetry] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  emit(event: string, data: any): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[CursorTelemetry] WebSocket not connected, cannot emit event:', event);
    }
  }

  subscribe(event: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('subscribe', { event });
    }
  }

  unsubscribe(event: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('unsubscribe', { event });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.eventHandlers.clear();
    this.reconnectAttempts = 0;
  }

  // Convenience methods for common events
  onSessionsUpdated(handler: (data: any) => void): void {
    this.on('sessions-updated', handler);
  }

  onSessionCreated(handler: (data: any) => void): void {
    this.on('session-created', handler);
  }

  onFileChanged(handler: (data: any) => void): void {
    this.on('file-changed', handler);
  }

  onAnalysisComplete(handler: (data: any) => void): void {
    this.on('analysis-complete', handler);
  }

  onMemoryCreated(handler: (data: any) => void): void {
    this.on('memory-created', handler);
  }

  onMemoryExecuted(handler: (data: any) => void): void {
    this.on('memory-executed', handler);
  }

  // Request real-time updates
  requestAnalysis(sessionId: string): void {
    this.emit('request-analysis', { sessionId });
  }

  subscribeToEvents(): void {
    this.emit('subscribe-events', {});
  }

  unsubscribeFromEvents(): void {
    this.emit('unsubscribe-events', {});
  }
}
