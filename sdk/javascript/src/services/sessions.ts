/**
 * Sessions service for managing development sessions
 */

import { HttpClient } from '../utils/http-client';
import {
  Session,
  SearchOptions,
  PaginationOptions,
  NotebookGenerationOptions,
  MemoryCreationOptions,
  Memory,
  ExecutionContext,
  ExecutionResult
} from '../types';

export class SessionsService {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get all sessions with optional pagination
   */
  async getAll(options: PaginationOptions = {}): Promise<Session[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/sessions?${queryString}` : '/sessions';
    
    return this.httpClient.get<Session[]>(url);
  }

  /**
   * Search sessions by query
   */
  async search(options: SearchOptions): Promise<Session[]> {
    const params = new URLSearchParams();
    
    params.append('q', options.query);
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        params.append(`filter[${key}]`, value.toString());
      });
    }
    
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    return this.httpClient.get<Session[]>(`/sessions/search?${params.toString()}`);
  }

  /**
   * Get session by ID
   */
  async getById(sessionId: string): Promise<Session> {
    return this.httpClient.get<Session>(`/sessions/${sessionId}`);
  }

  /**
   * Generate notebook from session
   */
  async generateNotebook(
    sessionId: string,
    options: NotebookGenerationOptions = {}
  ): Promise<Memory> {
    const data = {
      includeMetadata: options.includeMetadata ?? true,
      format: options.format ?? 'jupyter',
      addCells: options.addCells ?? true,
      includeAnalysis: options.includeAnalysis ?? false,
      template: options.template
    };

    return this.httpClient.post<Memory>(`/sessions/${sessionId}/generate-notebook`, data);
  }

  /**
   * Create .cursor-session file from session
   */
  async createSessionFile(sessionId: string, options: Record<string, any> = {}): Promise<Memory> {
    return this.httpClient.post<Memory>(`/sessions/${sessionId}/create-session-file`, options);
  }

  /**
   * Create integration package from session
   */
  async createIntegrationPackage(
    sessionId: string,
    options: Record<string, any> = {}
  ): Promise<Memory> {
    return this.httpClient.post<Memory>(`/sessions/${sessionId}/create-integration-package`, options);
  }

  /**
   * Create executable memory from session
   */
  async createMemory(
    sessionId: string,
    options: MemoryCreationOptions
  ): Promise<Memory> {
    const data = {
      name: options.name,
      type: options.type,
      tags: options.tags || [],
      description: options.description,
      includeMemories: options.includeMemories ?? true,
      includeASTAnalysis: options.includeASTAnalysis ?? true,
      includeKuraAnalysis: options.includeKuraAnalysis ?? true,
      pklFeatures: options.pklFeatures ?? true
    };

    return this.httpClient.post<Memory>(`/sessions/${sessionId}/create-memory`, data);
  }

  /**
   * Get session visualizations
   */
  async getVisualizations(sessionId: string): Promise<any[]> {
    return this.httpClient.get<any[]>(`/sessions/${sessionId}/visualizations`);
  }

  /**
   * Get session analytics
   */
  async getAnalytics(sessionId: string): Promise<any> {
    return this.httpClient.get<any>(`/sessions/${sessionId}/analytics`);
  }

  /**
   * Get session cell stages
   */
  async getCellStages(sessionId: string): Promise<any> {
    return this.httpClient.get<any>(`/sessions/${sessionId}/cell-stages`);
  }

  /**
   * Update session metadata
   */
  async updateMetadata(sessionId: string, metadata: Record<string, any>): Promise<Session> {
    return this.httpClient.patch<Session>(`/sessions/${sessionId}`, { metadata });
  }

  /**
   * Delete session
   */
  async delete(sessionId: string): Promise<void> {
    return this.httpClient.delete<void>(`/sessions/${sessionId}`);
  }

  /**
   * Execute session memory
   */
  async executeMemory(
    sessionId: string,
    memoryId: string,
    context: ExecutionContext = {}
  ): Promise<ExecutionResult> {
    return this.httpClient.post<ExecutionResult>(
      `/sessions/${sessionId}/memories/${memoryId}/execute`,
      context
    );
  }

  /**
   * Get session events
   */
  async getEvents(sessionId: string, options: PaginationOptions = {}): Promise<any[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/sessions/${sessionId}/events?${queryString}` : `/sessions/${sessionId}/events`;
    
    return this.httpClient.get<any[]>(url);
  }

  /**
   * Get session files
   */
  async getFiles(sessionId: string): Promise<string[]> {
    return this.httpClient.get<string[]>(`/sessions/${sessionId}/files`);
  }

  /**
   * Get session statistics
   */
  async getStats(sessionId: string): Promise<any> {
    return this.httpClient.get<any>(`/sessions/${sessionId}/stats`);
  }

  /**
   * Export session data
   */
  async export(sessionId: string, format: string = 'json'): Promise<any> {
    return this.httpClient.post<any>(`/sessions/${sessionId}/export`, { format });
  }

  /**
   * Clone session
   */
  async clone(sessionId: string, newName?: string): Promise<Session> {
    return this.httpClient.post<Session>(`/sessions/${sessionId}/clone`, { name: newName });
  }

  /**
   * Archive session
   */
  async archive(sessionId: string): Promise<Session> {
    return this.httpClient.post<Session>(`/sessions/${sessionId}/archive`);
  }

  /**
   * Restore archived session
   */
  async restore(sessionId: string): Promise<Session> {
    return this.httpClient.post<Session>(`/sessions/${sessionId}/restore`);
  }
}
