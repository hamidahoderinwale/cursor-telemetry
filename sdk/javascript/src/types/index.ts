/**
 * Core types for the Cursor Telemetry SDK
 */

export interface CursorTelemetryConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  debug?: boolean;
}

export interface Session {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  projectPath: string;
  files: string[];
  events: Event[];
  metadata: Record<string, any>;
  cellStages?: CellStage[];
  intent?: string;
  type?: string;
  status?: 'active' | 'completed' | 'paused';
}

export interface Event {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, any>;
  source?: string;
  filePath?: string;
  content?: string;
}

export interface CellStage {
  index: number;
  stage: string;
  confidence: number;
  content: string;
  timestamp: string;
  source: string;
  stageInfo?: {
    name: string;
    description: string;
    color: string;
    icon: string;
  };
}

export interface Project {
  id: string;
  name: string;
  path: string;
  sessions: Session[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string;
  sessionId: string;
  name: string;
  content: string;
  type: 'notebook' | 'session-file' | 'integration-package';
  createdAt: string;
  metadata: Record<string, any>;
  executable?: {
    commands: Command[];
    parameters: Record<string, any>;
  };
  quality?: {
    completeness: number;
    vMeasure: number;
    fileCoverage: number;
    analysisDepth: number;
  };
}

export interface Command {
  type: 'file_operation' | 'notebook_operation' | 'system_command';
  action: string;
  path?: string;
  content?: string;
  parameters?: Record<string, any>;
}

export interface Analytics {
  totalSessions: number;
  totalDuration: number;
  averageSessionLength: number;
  mostActiveFiles: Array<{
    file: string;
    count: number;
  }>;
  sessionTrends: Array<{
    date: string;
    count: number;
  }>;
  stageDistribution?: Record<string, number>;
  complexityMetrics?: {
    averageComplexity: number;
    maxComplexity: number;
    complexityDistribution: Record<string, number>;
  };
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  includeSessions?: boolean;
  includeEvents?: boolean;
  includeAnalytics?: boolean;
  includeMemories?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  filters?: Record<string, any>;
}

export interface ExportResult {
  filename: string;
  downloadUrl: string;
  size: number;
  createdAt: string;
  expiresAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchOptions extends PaginationOptions {
  query: string;
  filters?: Record<string, any>;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketConfig {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface NotebookGenerationOptions {
  includeMetadata?: boolean;
  format?: 'jupyter' | 'colab' | 'markdown';
  addCells?: boolean;
  includeAnalysis?: boolean;
  template?: string;
}

export interface MemoryCreationOptions {
  name: string;
  type: 'notebook' | 'session-file' | 'integration-package';
  tags?: string[];
  description?: string;
  includeMemories?: boolean;
  includeASTAnalysis?: boolean;
  includeKuraAnalysis?: boolean;
  pklFeatures?: boolean;
}

export interface ExecutionContext {
  targetDirectory?: string;
  parameters?: Record<string, any>;
  environment?: Record<string, string>;
  options?: Record<string, any>;
}

export interface ExecutionResult {
  memoryId: string;
  executed: string;
  commands: Command[];
  results: any[];
  success: boolean;
  errors: Array<{
    command: Command;
    error: string;
  }>;
  duration?: number;
}

// Error types
export class CursorTelemetryError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public requestId?: string
  ) {
    super(message);
    this.name = 'CursorTelemetryError';
  }
}

export class AuthenticationError extends CursorTelemetryError {
  constructor(message: string = 'Authentication failed', requestId?: string) {
    super(message, 'AUTH_ERROR', 401, requestId);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends CursorTelemetryError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number,
    requestId?: string
  ) {
    super(message, 'RATE_LIMIT_ERROR', 429, requestId);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends CursorTelemetryError {
  constructor(message: string, requestId?: string) {
    super(message, 'VALIDATION_ERROR', 400, requestId);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends CursorTelemetryError {
  constructor(message: string = 'Resource not found', requestId?: string) {
    super(message, 'NOT_FOUND_ERROR', 404, requestId);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends CursorTelemetryError {
  constructor(message: string = 'Internal server error', requestId?: string) {
    super(message, 'SERVER_ERROR', 500, requestId);
    this.name = 'ServerError';
  }
}
