/**
 * Cursor Telemetry SDK
 * Official JavaScript/TypeScript SDK for Cursor Telemetry API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

// Types
export interface CursorTelemetryConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

export interface Session {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  projectPath?: string;
  files: string[];
  events: Event[];
  metadata: Record<string, any>;
}

export interface Event {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: Session[];
  metadata: Record<string, any>;
}

export interface Analytics {
  totalSessions: number;
  totalDuration: number;
  averageSessionLength: number;
  mostActiveFiles: Array<{ file: string; count: number }>;
  sessionTrends: Array<{ date: string; count: number }>;
}

export interface Memory {
  id: string;
  sessionId: string;
  name: string;
  content: string;
  type: 'notebook' | 'session-file' | 'integration-package';
  createdAt: string;
  metadata: Record<string, any>;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Main SDK Class
export class CursorTelemetryAPI extends EventEmitter {
  private http: AxiosInstance;
  private socket?: Socket;
  private config: Required<CursorTelemetryConfig>;

  constructor(config: CursorTelemetryConfig) {
    super();
    
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    };

    // Initialize HTTP client
    this.http = axios.create({
      baseURL: `${this.config.baseUrl}/api`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      }
    });

    // Add request interceptor for retries
    this.http.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        if (!config || !config.retry) return Promise.reject(error);
        
        config.retryCount = config.retryCount || 0;
        if (config.retryCount >= this.config.retries) {
          return Promise.reject(error);
        }
        
        config.retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * config.retryCount));
        return this.http(config);
      }
    );
  }

  // Connection management
  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    this.socket = io(this.config.baseUrl, {
      auth: {
        token: this.config.apiKey
      }
    });

    this.socket.on('connect', () => {
      this.emit('connected');
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnected');
    });

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
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
  }

  // Sessions API
  sessions = {
    getAll: async (): Promise<Session[]> => {
      const response = await this.http.get<APIResponse<Session[]>>('/sessions');
      return this.handleResponse(response);
    },

    getById: async (id: string): Promise<Session> => {
      const response = await this.http.get<APIResponse<Session>>(`/sessions/${id}`);
      return this.handleResponse(response);
    },

    search: async (query: string): Promise<Session[]> => {
      const response = await this.http.get<APIResponse<Session[]>>('/sessions/search', {
        params: { q: query }
      });
      return this.handleResponse(response);
    },

    generateNotebook: async (id: string, options?: Record<string, any>): Promise<Memory> => {
      const response = await this.http.post<APIResponse<Memory>>(`/sessions/${id}/generate-notebook`, options);
      return this.handleResponse(response);
    },

    createSessionFile: async (id: string, options?: Record<string, any>): Promise<Memory> => {
      const response = await this.http.post<APIResponse<Memory>>(`/sessions/${id}/create-session-file`, options);
      return this.handleResponse(response);
    },

    createIntegrationPackage: async (id: string, options?: Record<string, any>): Promise<Memory> => {
      const response = await this.http.post<APIResponse<Memory>>(`/sessions/${id}/create-integration-package`, options);
      return this.handleResponse(response);
    },

    getVisualizations: async (id: string): Promise<any> => {
      const response = await this.http.get<APIResponse<any>>(`/sessions/${id}/visualizations`);
      return this.handleResponse(response);
    },

    getConversations: async (id: string): Promise<any[]> => {
      const response = await this.http.get<APIResponse<any[]>>(`/sessions/${id}/conversations`);
      return this.handleResponse(response);
    },

    getSuggestions: async (id: string): Promise<any[]> => {
      const response = await this.http.get<APIResponse<any[]>>(`/sessions/${id}/suggestions`);
      return this.handleResponse(response);
    }
  };

  // Projects API
  projects = {
    getAll: async (): Promise<Project[]> => {
      const response = await this.http.get<APIResponse<Project[]>>('/projects');
      return this.handleResponse(response);
    },

    getById: async (id: string): Promise<Project> => {
      const response = await this.http.get<APIResponse<Project>>(`/projects/${id}`);
      return this.handleResponse(response);
    },

    getSessions: async (id: string): Promise<Session[]> => {
      const response = await this.http.get<APIResponse<Session[]>>(`/projects/${id}/sessions`);
      return this.handleResponse(response);
    },

    open: async (path: string): Promise<void> => {
      await this.http.post('/project/open', { path });
    }
  };

  // Analytics API
  analytics = {
    getStats: async (): Promise<Analytics> => {
      const response = await this.http.get<APIResponse<Analytics>>('/stats');
      return this.handleResponse(response);
    },

    getVisualizations: async (): Promise<any> => {
      const response = await this.http.get<APIResponse<any>>('/visualizations');
      return this.handleResponse(response);
    },

    getEvents: async (): Promise<Event[]> => {
      const response = await this.http.get<APIResponse<Event[]>>('/events');
      return this.handleResponse(response);
    },

    getEmbeddings: async (): Promise<any[]> => {
      const response = await this.http.get<APIResponse<any[]>>('/embeddings');
      return this.handleResponse(response);
    },

    getLiveDurations: async (): Promise<any[]> => {
      const response = await this.http.get<APIResponse<any[]>>('/sessions/live-durations');
      return this.handleResponse(response);
    }
  };

  // Memory API
  memory = {
    getAll: async (): Promise<Memory[]> => {
      const response = await this.http.get<APIResponse<Memory[]>>('/memories');
      return this.handleResponse(response);
    },

    create: async (sessionId: string, options?: Record<string, any>): Promise<Memory> => {
      const response = await this.http.post<APIResponse<Memory>>(`/sessions/${sessionId}/create-memory`, options);
      return this.handleResponse(response);
    },

    execute: async (id: string, options?: Record<string, any>): Promise<any> => {
      const response = await this.http.post<APIResponse<any>>(`/memories/${id}/execute`, options);
      return this.handleResponse(response);
    },

    getQualityMetrics: async (): Promise<any> => {
      const response = await this.http.get<APIResponse<any>>('/quality-metrics');
      return this.handleResponse(response);
    }
  };

  // Export API
  export = {
    create: async (options: Record<string, any>): Promise<any> => {
      const response = await this.http.post<APIResponse<any>>('/export', options);
      return this.handleResponse(response);
    },

    list: async (): Promise<any[]> => {
      const response = await this.http.get<APIResponse<any[]>>('/export/list');
      return this.handleResponse(response);
    },

    download: async (filename: string): Promise<Buffer> => {
      const response = await this.http.get(`/export/download/${filename}`, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    },

    delete: async (filename: string): Promise<void> => {
      await this.http.delete(`/export/${filename}`);
    }
  };

  // Analysis API
  analysis = {
    withKura: async (options?: Record<string, any>): Promise<any> => {
      const response = await this.http.post<APIResponse<any>>('/sessions/analyze-with-kura', options);
      return this.handleResponse(response);
    },

    withClio: async (options?: Record<string, any>): Promise<any> => {
      const response = await this.http.post<APIResponse<any>>('/sessions/analyze-with-clio', options);
      return this.handleResponse(response);
    },

    getProcedurePatterns: async (): Promise<any[]> => {
      const response = await this.http.get<APIResponse<any[]>>('/procedures/patterns');
      return this.handleResponse(response);
    },

    executeProcedure: async (options: Record<string, any>): Promise<any> => {
      const response = await this.http.post<APIResponse<any>>('/procedures/execute', options);
      return this.handleResponse(response);
    }
  };

  // Privacy API
  privacy = {
    analyze: async (config?: Record<string, any>): Promise<any> => {
      const response = await this.http.post<APIResponse<any>>('/privacy/analyze', { config });
      return this.handleResponse(response);
    },

    updateConfig: async (config: Record<string, any>): Promise<void> => {
      await this.http.post('/privacy/config', config);
    }
  };

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.http.get('/health');
      return response.data.status === 'ok';
    } catch {
      return false;
    }
  }

  // Utility methods
  private handleResponse<T>(response: AxiosResponse<APIResponse<T>>): T {
    if (!response.data.success) {
      throw new Error(response.data.error || 'API request failed');
    }
    return response.data.data!;
  }
}

// Export default
export default CursorTelemetryAPI;
