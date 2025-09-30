/**
 * Privacy Service for Cursor Telemetry SDK
 * Provides privacy controls and data protection features
 */

import { HttpClient } from '../utils/http-client';
import { CursorTelemetryConfig } from '../types';

export interface PrivacyConfig {
  epsilon: number;
  redactionLevel: number;
  abstractionLevel: number;
  redactNames: boolean;
  redactNumbers: boolean;
  redactEmails: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high';
  analysisScope: 'recent' | 'all' | 'custom';
  privacyFilters: {
    hidePersonalInfo: boolean;
    anonymizeFilePaths: boolean;
    includeCodeAnalysis: boolean;
  };
}

export interface PrivacyMetrics {
  riskLevel: 'low' | 'medium' | 'high';
  dataExposureScore: number;
  expressivenessScore: number;
  privacyBudget: number;
  redactionCoverage: number;
}

export interface PrivacyAnalysisResult {
  success: boolean;
  originalWorkflows: any[];
  transformedWorkflows: any[];
  expressivenessMetrics: PrivacyMetrics;
  privacyConfig: PrivacyConfig;
}

export class PrivacyService {
  private httpClient: HttpClient;
  private config: CursorTelemetryConfig;

  constructor(httpClient: HttpClient, config: CursorTelemetryConfig) {
    this.httpClient = httpClient;
    this.config = config;
  }

  /**
   * Update privacy configuration
   */
  async updatePrivacyConfig(privacyConfig: Partial<PrivacyConfig>): Promise<PrivacyConfig> {
    const response = await this.httpClient.post('/api/privacy/config', privacyConfig);
    return response.data;
  }

  /**
   * Get current privacy configuration
   */
  async getPrivacyConfig(): Promise<PrivacyConfig> {
    const response = await this.httpClient.get('/api/privacy/config');
    return response.data;
  }

  /**
   * Run privacy analysis on captured data
   */
  async analyzePrivacy(config?: Partial<PrivacyConfig>): Promise<PrivacyAnalysisResult> {
    const response = await this.httpClient.post('/api/privacy/analyze', { config });
    return response.data;
  }

  /**
   * Get privacy metrics for dashboard
   */
  async getPrivacyMetrics(): Promise<PrivacyMetrics> {
    const response = await this.httpClient.get('/api/privacy/metrics');
    return response.data;
  }

  /**
   * Export privacy report
   */
  async exportPrivacyReport(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const response = await this.httpClient.get(`/api/privacy/export?format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  /**
   * Delete sensitive data based on privacy settings
   */
  async deleteSensitiveData(scope: 'session' | 'all' | 'custom', sessionId?: string): Promise<boolean> {
    const response = await this.httpClient.delete('/api/privacy/delete', {
      data: { scope, sessionId }
    });
    return response.data.success;
  }

  /**
   * Check if privacy controls are properly connected to data capture
   */
  async checkPrivacyIntegration(): Promise<{
    connected: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const response = await this.httpClient.get('/api/privacy/integration-status');
    return response.data;
  }

  /**
   * Enable/disable real-time privacy filtering
   */
  async setRealTimePrivacyFiltering(enabled: boolean): Promise<boolean> {
    const response = await this.httpClient.post('/api/privacy/realtime-filtering', { enabled });
    return response.data.success;
  }

  /**
   * Get privacy compliance report
   */
  async getComplianceReport(): Promise<{
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const response = await this.httpClient.get('/api/privacy/compliance');
    return response.data;
  }
}
