/**
 * Memory service for managing executable memories
 */

import { HttpClient } from '../utils/http-client';
import {
  Memory,
  SearchOptions,
  PaginationOptions,
  ExecutionContext,
  ExecutionResult,
  ExportOptions,
  ExportResult
} from '../types';

export class MemoryService {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get all memories with optional filtering
   */
  async getAll(options: PaginationOptions & { category?: string; type?: string } = {}): Promise<Memory[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options.category) params.append('category', options.category);
    if (options.type) params.append('type', options.type);

    const queryString = params.toString();
    const url = queryString ? `/memories?${queryString}` : '/memories';
    
    return this.httpClient.get<Memory[]>(url);
  }

  /**
   * Search memories by content
   */
  async search(options: SearchOptions & { category?: string; type?: string }): Promise<Memory[]> {
    const params = new URLSearchParams();
    
    params.append('q', options.query);
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options.category) params.append('category', options.category);
    if (options.type) params.append('type', options.type);
    
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        params.append(`filter[${key}]`, value.toString());
      });
    }
    
    if (options.dateRange) {
      if (options.dateRange.start) params.append('start', options.dateRange.start);
      if (options.dateRange.end) params.append('end', options.dateRange.end);
    }

    return this.httpClient.get<Memory[]>(`/memories/search?${params.toString()}`);
  }

  /**
   * Get memory by ID
   */
  async getById(memoryId: string): Promise<Memory> {
    return this.httpClient.get<Memory>(`/memories/${memoryId}`);
  }

  /**
   * Execute a stored memory
   */
  async execute(memoryId: string, context: ExecutionContext = {}): Promise<ExecutionResult> {
    return this.httpClient.post<ExecutionResult>(`/memories/${memoryId}/execute`, context);
  }

  /**
   * Update memory metadata
   */
  async update(memoryId: string, updates: Partial<Memory>): Promise<Memory> {
    return this.httpClient.put<Memory>(`/memories/${memoryId}`, updates);
  }

  /**
   * Delete memory
   */
  async delete(memoryId: string): Promise<void> {
    return this.httpClient.delete<void>(`/memories/${memoryId}`);
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<any> {
    return this.httpClient.get<any>('/memories/stats');
  }

  /**
   * Get memory execution history
   */
  async getExecutionHistory(memoryId: string, options: PaginationOptions = {}): Promise<ExecutionResult[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/memories/${memoryId}/executions?${queryString}` : `/memories/${memoryId}/executions`;
    
    return this.httpClient.get<ExecutionResult[]>(url);
  }

  /**
   * Get memory quality metrics
   */
  async getQualityMetrics(memoryId: string): Promise<any> {
    return this.httpClient.get<any>(`/memories/${memoryId}/quality`);
  }

  /**
   * Update memory quality metrics
   */
  async updateQualityMetrics(memoryId: string, metrics: any): Promise<any> {
    return this.httpClient.put<any>(`/memories/${memoryId}/quality`, metrics);
  }

  /**
   * Clone memory
   */
  async clone(memoryId: string, newName?: string): Promise<Memory> {
    return this.httpClient.post<Memory>(`/memories/${memoryId}/clone`, { name: newName });
  }

  /**
   * Archive memory
   */
  async archive(memoryId: string): Promise<Memory> {
    return this.httpClient.post<Memory>(`/memories/${memoryId}/archive`);
  }

  /**
   * Restore archived memory
   */
  async restore(memoryId: string): Promise<Memory> {
    return this.httpClient.post<Memory>(`/memories/${memoryId}/restore`);
  }

  /**
   * Export memories
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    return this.httpClient.post<ExportResult>('/memories/export', options);
  }

  /**
   * Import memories
   */
  async import(file: File | Buffer, options: { format?: string } = {}): Promise<Memory[]> {
    const formData = new FormData();
    
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', new Blob([file]), 'memories.json');
    }
    
    if (options.format) {
      formData.append('format', options.format);
    }

    return this.httpClient.post<Memory[]>('/memories/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * Get memory templates
   */
  async getTemplates(): Promise<any[]> {
    return this.httpClient.get<any[]>('/memories/templates');
  }

  /**
   * Create memory from template
   */
  async createFromTemplate(templateId: string, options: Record<string, any> = {}): Promise<Memory> {
    return this.httpClient.post<Memory>(`/memories/templates/${templateId}/create`, options);
  }

  /**
   * Get memory categories
   */
  async getCategories(): Promise<string[]> {
    return this.httpClient.get<string[]>('/memories/categories');
  }

  /**
   * Get memories by category
   */
  async getByCategory(category: string, options: PaginationOptions = {}): Promise<Memory[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/memories/category/${category}?${queryString}` : `/memories/category/${category}`;
    
    return this.httpClient.get<Memory[]>(url);
  }

  /**
   * Get memory tags
   */
  async getTags(): Promise<string[]> {
    return this.httpClient.get<string[]>('/memories/tags');
  }

  /**
   * Get memories by tag
   */
  async getByTag(tag: string, options: PaginationOptions = {}): Promise<Memory[]> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    const queryString = params.toString();
    const url = queryString ? `/memories/tag/${tag}?${queryString}` : `/memories/tag/${tag}`;
    
    return this.httpClient.get<Memory[]>(url);
  }

  /**
   * Bulk operations
   */
  async bulkDelete(memoryIds: string[]): Promise<void> {
    return this.httpClient.post<void>('/memories/bulk/delete', { memoryIds });
  }

  async bulkArchive(memoryIds: string[]): Promise<void> {
    return this.httpClient.post<void>('/memories/bulk/archive', { memoryIds });
  }

  async bulkRestore(memoryIds: string[]): Promise<void> {
    return this.httpClient.post<void>('/memories/bulk/restore', { memoryIds });
  }

  async bulkUpdate(memoryIds: string[], updates: Partial<Memory>): Promise<void> {
    return this.httpClient.post<void>('/memories/bulk/update', { memoryIds, updates });
  }
}
