/**
 * Cursor Telemetry SDK - Main entry point
 */

import { HttpClient } from './utils/http-client';
import { WebSocketClient } from './services/websocket-client';
import { SessionsService } from './services/sessions';
import { MemoryService } from './services/memory';
import { AnalyticsService } from './services/analytics';
import {
  CursorTelemetryConfig,
  WebSocketConfig,
  WebSocketEvent
} from './types';

export class CursorTelemetryAPI {
  private httpClient: HttpClient;
  private wsClient: WebSocketClient;
  private config: CursorTelemetryConfig;

  // Services
  public sessions: SessionsService;
  public memory: MemoryService;
  public analytics: AnalyticsService;

  constructor(config: CursorTelemetryConfig) {
    this.config = config;
    
    // Initialize HTTP client
    this.httpClient = new HttpClient(config);
    
    // Initialize WebSocket client
    this.wsClient = new WebSocketClient();
    
    // Initialize services
    this.sessions = new SessionsService(this.httpClient);
    this.memory = new MemoryService(this.httpClient);
    this.analytics = new AnalyticsService(this.httpClient);
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  async connect(wsConfig?: WebSocketConfig): Promise<void> {
    if (wsConfig) {
      this.wsClient = new WebSocketClient(wsConfig);
    }
    
    await this.wsClient.connect(this.config.baseUrl, this.config.apiKey);
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    this.wsClient.disconnect();
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * Listen for real-time events
   */
  on(event: string, handler: (data: any) => void): void {
    this.wsClient.on(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: (data: any) => void): void {
    this.wsClient.off(event, handler);
  }

  /**
   * Emit event to server
   */
  emit(event: string, data: any): void {
    this.wsClient.emit(event, data);
  }

  /**
   * Subscribe to specific events
   */
  subscribe(event: string): void {
    this.wsClient.subscribe(event);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(event: string): void {
    this.wsClient.unsubscribe(event);
  }

  /**
   * Convenience methods for common events
   */
  onSessionsUpdated(handler: (data: any) => void): void {
    this.wsClient.onSessionsUpdated(handler);
  }

  onSessionCreated(handler: (data: any) => void): void {
    this.wsClient.onSessionCreated(handler);
  }

  onFileChanged(handler: (data: any) => void): void {
    this.wsClient.onFileChanged(handler);
  }

  onAnalysisComplete(handler: (data: any) => void): void {
    this.wsClient.onAnalysisComplete(handler);
  }

  onMemoryCreated(handler: (data: any) => void): void {
    this.wsClient.onMemoryCreated(handler);
  }

  onMemoryExecuted(handler: (data: any) => void): void {
    this.wsClient.onMemoryExecuted(handler);
  }

  /**
   * Request analysis for a session
   */
  requestAnalysis(sessionId: string): void {
    this.wsClient.requestAnalysis(sessionId);
  }

  /**
   * Subscribe to all events
   */
  subscribeToEvents(): void {
    this.wsClient.subscribeToEvents();
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeFromEvents(): void {
    this.wsClient.unsubscribeFromEvents();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.httpClient.healthCheck();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CursorTelemetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.httpClient.updateConfig(newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): CursorTelemetryConfig {
    return { ...this.config };
  }

  /**
   * Get HTTP client (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }

  /**
   * Get WebSocket client (for advanced usage)
   */
  getWebSocketClient(): WebSocketClient {
    return this.wsClient;
  }
}

// Export types
export * from './types';

// Export individual services for advanced usage
export { HttpClient } from './utils/http-client';
export { WebSocketClient } from './services/websocket-client';
export { SessionsService } from './services/sessions';
export { MemoryService } from './services/memory';
export { AnalyticsService } from './services/analytics';

// Default export
export default CursorTelemetryAPI;
