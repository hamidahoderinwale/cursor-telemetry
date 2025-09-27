/**
 * Analytics service for data analysis and insights
 */

import { HttpClient } from '../utils/http-client';
import { Analytics, PaginationOptions, SearchOptions } from '../types';

export class AnalyticsService {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get system statistics
   */
  async getStats(): Promise<Analytics> {
    return this.httpClient.get<Analytics>('/stats');
  }

  /**
   * Get live analytics data
   */
  async getLive(): Promise<any> {
    return this.httpClient.get<any>('/analytics/live');
  }

  /**
   * Get visualization data
   */
  async getVisualizations(options: { type?: string; sessionId?: string } = {}): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options.type) params.append('type', options.type);
    if (options.sessionId) params.append('sessionId', options.sessionId);

    const queryString = params.toString();
    const url = queryString ? `/visualizations?${queryString}` : '/visualizations';
    
    return this.httpClient.get<any[]>(url);
  }

  /**
   * Get development events
   */
  async getEvents(options: PaginationOptions & { type?: string; source?: string } = {}): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options.type) params.append('type', options.type);
    if (options.source) params.append('source', options.source);

    const queryString = params.toString();
    const url = queryString ? `/events?${queryString}` : '/events';
    
    return this.httpClient.get<any[]>(url);
  }

  /**
   * Get session embeddings
   */
  async getEmbeddings(options: { sessionId?: string; limit?: number } = {}): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options.sessionId) params.append('sessionId', options.sessionId);
    if (options.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/embeddings?${queryString}` : '/embeddings';
    
    return this.httpClient.get<any[]>(url);
  }

  /**
   * Get cell stage distribution
   */
  async getStageDistribution(options: { sessionId?: string; dateRange?: { start: string; end: string } } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.sessionId) params.append('sessionId', options.sessionId);
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    const queryString = params.toString();
    const url = queryString ? `/analytics/stage-distribution?${queryString}` : '/analytics/stage-distribution';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get complexity analysis
   */
  async getComplexityAnalysis(options: { sessionId?: string; filePath?: string } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.sessionId) params.append('sessionId', options.sessionId);
    if (options.filePath) params.append('filePath', options.filePath);

    const queryString = params.toString();
    const url = queryString ? `/analytics/complexity?${queryString}` : '/analytics/complexity';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get workflow insights
   */
  async getWorkflowInsights(options: { sessionId?: string; type?: string } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.sessionId) params.append('sessionId', options.sessionId);
    if (options.type) params.append('type', options.type);

    const queryString = params.toString();
    const url = queryString ? `/analytics/workflow-insights?${queryString}` : '/analytics/workflow-insights';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get productivity metrics
   */
  async getProductivityMetrics(options: { 
    dateRange?: { start: string; end: string };
    userId?: string;
    projectId?: string;
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }
    if (options.userId) params.append('userId', options.userId);
    if (options.projectId) params.append('projectId', options.projectId);

    const queryString = params.toString();
    const url = queryString ? `/analytics/productivity?${queryString}` : '/analytics/productivity';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get code quality metrics
   */
  async getCodeQualityMetrics(options: { 
    sessionId?: string;
    filePath?: string;
    dateRange?: { start: string; end: string };
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.sessionId) params.append('sessionId', options.sessionId);
    if (options.filePath) params.append('filePath', options.filePath);
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    const queryString = params.toString();
    const url = queryString ? `/analytics/code-quality?${queryString}` : '/analytics/code-quality';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get team collaboration metrics
   */
  async getCollaborationMetrics(options: { 
    teamId?: string;
    dateRange?: { start: string; end: string };
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.teamId) params.append('teamId', options.teamId);
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    const queryString = params.toString();
    const url = queryString ? `/analytics/collaboration?${queryString}` : '/analytics/collaboration';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get learning patterns
   */
  async getLearningPatterns(options: { 
    userId?: string;
    dateRange?: { start: string; end: string };
  } = {}): Promise<any> {
    const params = new URLSearchParams();
    
    if (options.userId) params.append('userId', options.userId);
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    const queryString = params.toString();
    const url = queryString ? `/analytics/learning-patterns?${queryString}` : '/analytics/learning-patterns';
    
    return this.httpClient.get<any>(url);
  }

  /**
   * Get trend analysis
   */
  async getTrendAnalysis(options: { 
    metric: string;
    period: 'day' | 'week' | 'month' | 'year';
    dateRange?: { start: string; end: string };
  }): Promise<any> {
    const params = new URLSearchParams();
    
    params.append('metric', options.metric);
    params.append('period', options.period);
    
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    return this.httpClient.get<any>(`/analytics/trends?${params.toString()}`);
  }

  /**
   * Get comparative analysis
   */
  async getComparativeAnalysis(options: { 
    compareBy: string;
    values: string[];
    dateRange?: { start: string; end: string };
  }): Promise<any> {
    const data = {
      compareBy: options.compareBy,
      values: options.values,
      dateRange: options.dateRange
    };

    return this.httpClient.post<any>('/analytics/compare', data);
  }

  /**
   * Get anomaly detection results
   */
  async getAnomalies(options: { 
    type?: string;
    threshold?: number;
    dateRange?: { start: string; end: string };
  } = {}): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options.type) params.append('type', options.type);
    if (options.threshold) params.append('threshold', options.threshold.toString());
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    const queryString = params.toString();
    const url = queryString ? `/analytics/anomalies?${queryString}` : '/analytics/anomalies';
    
    return this.httpClient.get<any[]>(url);
  }

  /**
   * Get custom analytics query
   */
  async query(query: string, parameters: Record<string, any> = {}): Promise<any> {
    return this.httpClient.post<any>('/analytics/query', { query, parameters });
  }

  /**
   * Export analytics data
   */
  async export(options: { 
    format: 'json' | 'csv' | 'xlsx';
    metrics: string[];
    dateRange?: { start: string; end: string };
    filters?: Record<string, any>;
  }): Promise<any> {
    return this.httpClient.post<any>('/analytics/export', options);
  }
}
