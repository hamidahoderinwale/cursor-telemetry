/**
 * Activity Logger Service for Cursor Telemetry SDK
 * Provides integration with the companion activity logger service
 */

import { HttpClient } from '../utils/http-client';
import { CursorTelemetryConfig } from '../types';

export interface ActivityLoggerConfig {
  root_dir: string;
  ignore: string[];
  diff_threshold: number;
  enable_clipboard: boolean;
  enable_preload: boolean;
  strict_auth: boolean;
  companion_token: string | null;
  polling_interval: number;
}

export interface ActivityLoggerStatus {
  running: boolean;
  port: number;
  queue_size: number;
  last_activity: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  errors: string[];
}

export interface ActivityLoggerStats {
  total_events: number;
  file_changes: number;
  clipboard_events: number;
  dom_events: number;
  mcp_events: number;
  uptime: number;
  memory_usage: number;
}

export class ActivityLoggerService {
  private httpClient: HttpClient;
  private config: CursorTelemetryConfig;
  private companionPort: number;

  constructor(httpClient: HttpClient, config: CursorTelemetryConfig, companionPort: number = 43917) {
    this.httpClient = httpClient;
    this.config = config;
    this.companionPort = companionPort;
  }

  /**
   * Get activity logger status
   */
  async getStatus(): Promise<ActivityLoggerStatus> {
    try {
      const response = await this.httpClient.get(`http://localhost:${this.companionPort}/health`);
      return response.data;
    } catch (error) {
      return {
        running: false,
        port: this.companionPort,
        queue_size: 0,
        last_activity: 'never',
        health: 'unhealthy',
        errors: ['Companion service not responding']
      };
    }
  }

  /**
   * Get activity logger statistics
   */
  async getStats(): Promise<ActivityLoggerStats> {
    try {
      const response = await this.httpClient.get(`http://localhost:${this.companionPort}/stats`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get activity logger stats: ' + error.message);
    }
  }

  /**
   * Get current configuration
   */
  async getConfig(): Promise<ActivityLoggerConfig> {
    try {
      const response = await this.httpClient.get(`http://localhost:${this.companionPort}/config`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get activity logger config: ' + error.message);
    }
  }

  /**
   * Update activity logger configuration
   */
  async updateConfig(config: Partial<ActivityLoggerConfig>): Promise<ActivityLoggerConfig> {
    try {
      const response = await this.httpClient.post(`http://localhost:${this.companionPort}/config`, config);
      return response.data;
    } catch (error) {
      throw new Error('Failed to update activity logger config: ' + error.message);
    }
  }

  /**
   * Get recent events from the queue
   */
  async getRecentEvents(limit: number = 50): Promise<any[]> {
    try {
      const response = await this.httpClient.get(`http://localhost:${this.companionPort}/queue?limit=${limit}`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get recent events: ' + error.message);
    }
  }

  /**
   * Clear the event queue
   */
  async clearQueue(): Promise<boolean> {
    try {
      const response = await this.httpClient.delete(`http://localhost:${this.companionPort}/queue`);
      return response.data.success;
    } catch (error) {
      throw new Error('Failed to clear queue: ' + error.message);
    }
  }

  /**
   * Start/stop clipboard monitoring
   */
  async setClipboardMonitoring(enabled: boolean): Promise<boolean> {
    try {
      const response = await this.httpClient.post(`http://localhost:${this.companionPort}/clipboard`, { enabled });
      return response.data.success;
    } catch (error) {
      throw new Error('Failed to set clipboard monitoring: ' + error.message);
    }
  }

  /**
   * Start/stop file monitoring
   */
  async setFileMonitoring(enabled: boolean): Promise<boolean> {
    try {
      const response = await this.httpClient.post(`http://localhost:${this.companionPort}/file-monitoring`, { enabled });
      return response.data.success;
    } catch (error) {
      throw new Error('Failed to set file monitoring: ' + error.message);
    }
  }

  /**
   * Get file monitoring status
   */
  async getFileMonitoringStatus(): Promise<{
    enabled: boolean;
    watching_paths: string[];
    ignored_patterns: string[];
    last_scan: string;
  }> {
    try {
      const response = await this.httpClient.get(`http://localhost:${this.companionPort}/file-monitoring/status`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to get file monitoring status: ' + error.message);
    }
  }

  /**
   * Restart the companion service
   */
  async restart(): Promise<boolean> {
    try {
      const response = await this.httpClient.post(`http://localhost:${this.companionPort}/restart`);
      return response.data.success;
    } catch (error) {
      throw new Error('Failed to restart companion service: ' + error.message);
    }
  }

  /**
   * Check if privacy controls are connected to activity logger
   */
  async checkPrivacyIntegration(): Promise<{
    connected: boolean;
    privacy_controls_active: boolean;
    issues: string[];
  }> {
    try {
      const response = await this.httpClient.get(`http://localhost:${this.companionPort}/privacy-status`);
      return response.data;
    } catch (error) {
      return {
        connected: false,
        privacy_controls_active: false,
        issues: ['Companion service not responding']
      };
    }
  }
}
