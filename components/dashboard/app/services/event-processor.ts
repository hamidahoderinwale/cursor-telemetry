import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { RedisEventQueue } from './redis-event-queue';
import { EventData } from './event-correlator';
import { MemoryEventQueue } from './memory-event-queue';
import { ConversationTracker } from './conversation-tracker';
import { SessionDatabase } from '../storage/session-database';
import { JsonDataStorage } from '../storage/json-data-storage';
import { FileMonitor } from './file-monitor';
import { JupyterSessionParser } from './jupyter-session-parser';

export interface ProcessingConfig {
  useRedis: boolean;
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  memoryConfig?: {
    maxSize: number;
    batchSize: number;
    processingInterval: number;
  };
  correlationWindow: number; // milliseconds
  sessionTimeout: number; // milliseconds
  maxEventsPerSession: number;
}

export interface ProcessedSession {
  id: string;
  startTime: string;
  endTime?: string;
  events: EventData[];
  conversationEvents: EventData[];
  fileChangeEvents: EventData[];
  codeExecutionEvents: EventData[];
  metadata: {
    totalEvents: number;
    duration: number;
    source: string;
    intent?: string;
    confidence?: number;
  };
}

export class EventProcessor extends EventEmitter {
  private config: ProcessingConfig;
  private eventQueue: RedisEventQueue | MemoryEventQueue;
  private conversationTracker: ConversationTracker;
  private sessionDatabase: SessionDatabase;
  private jsonStorage: JsonDataStorage;
  private fileMonitor: FileMonitor;
  private jupyterParser: JupyterSessionParser;
  
  private activeSessions: Map<string, ProcessedSession>;
  private eventCorrelation: Map<string, EventData[]>;
  private isProcessing: boolean = false;

  constructor(
    config: ProcessingConfig,
    conversationTracker: ConversationTracker,
    sessionDatabase: SessionDatabase,
    jsonStorage: JsonDataStorage,
    fileMonitor: FileMonitor,
    jupyterParser: JupyterSessionParser
  ) {
    super();
    
    this.config = {
      useRedis: false,
      correlationWindow: 30000, // 30 seconds
      sessionTimeout: 300000, // 5 minutes
      maxEventsPerSession: 1000,
      ...config
    };

    this.conversationTracker = conversationTracker;
    this.sessionDatabase = sessionDatabase;
    this.jsonStorage = jsonStorage;
    this.fileMonitor = fileMonitor;
    this.jupyterParser = jupyterParser;

    this.activeSessions = new Map();
    this.eventCorrelation = new Map();

    this.initializeEventQueue();
    this.setupEventHandlers();
  }

  private initializeEventQueue(): void {
    if (this.config.useRedis && this.config.redisConfig) {
      this.eventQueue = new RedisEventQueue(this.config.redisConfig);
    } else {
      this.eventQueue = new MemoryEventQueue(this.config.memoryConfig);
    }
  }

  private setupEventHandlers(): void {
    // Event queue handlers
    this.eventQueue.on('eventEnqueued', (event: EventData) => {
      this.handleEventEnqueued(event);
    });

    this.eventQueue.on('eventProcessing', (event: EventData) => {
      this.handleEventProcessing(event);
    });

    this.eventQueue.on('eventProcessed', (event: EventData) => {
      this.handleEventProcessed(event);
    });

    this.eventQueue.on('eventProcessingError', (error: any) => {
      this.handleEventProcessingError(error);
    });

    // File monitor handlers
    this.fileMonitor.on('fileChanges', (changes: any[]) => {
      this.handleFileChanges(changes);
    });

    // Jupyter parser handlers - Note: JupyterSessionParser doesn't emit events, so we'll handle this differently
  }

  /**
   * Start the event processor
   */
  async start(): Promise<void> {
    try {
      console.log('Starting Event Processor...');
      
      // Connect to event queue
      if (this.eventQueue instanceof RedisEventQueue) {
        await this.eventQueue.connect();
      }
      
      // Start event processing
      this.eventQueue.startProcessing();
      this.isProcessing = true;
      
      // Start session cleanup
      this.startSessionCleanup();
      
      console.log('Event Processor started successfully');
      this.emit('started');
    } catch (error) {
      console.error('Failed to start Event Processor:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the event processor
   */
  async stop(): Promise<void> {
    try {
      console.log('Stopping Event Processor...');
      
      this.isProcessing = false;
      this.eventQueue.stopProcessing();
      
      if (this.eventQueue instanceof RedisEventQueue) {
        await this.eventQueue.disconnect();
      }
      
      // Save active sessions
      await this.saveActiveSessions();
      
      console.log('Event Processor stopped');
      this.emit('stopped');
    } catch (error) {
      console.error('Error stopping Event Processor:', error);
      this.emit('error', error);
    }
  }

  /**
   * Enqueue a conversation event
   */
  async enqueueConversation(data: {
    userMessage: string;
    assistantResponse?: string;
    source: string;
    sessionId?: string;
    filesReferenced?: string[];
  }): Promise<string> {
    const event: Omit<EventData, 'id' | 'timestamp'> = {
      type: 'conversation',
      source: data.source,
      data: {
        userMessage: data.userMessage,
        assistantResponse: data.assistantResponse,
        filesReferenced: data.filesReferenced
      },
      sessionId: data.sessionId,
      correlationId: data.sessionId,
      priority: 'high'
    };

    return await this.eventQueue.enqueue(event);
  }

  /**
   * Enqueue a prompt event
   */
  async enqueuePrompt(data: {
    prompt: string;
    context: any;
    source: string;
    sessionId?: string;
  }): Promise<string> {
    const event: Omit<EventData, 'id' | 'timestamp'> = {
      type: 'prompt',
      source: data.source,
      data: {
        prompt: data.prompt,
        context: data.context
      },
      sessionId: data.sessionId,
      correlationId: data.sessionId,
      priority: 'high'
    };

    return await this.eventQueue.enqueue(event);
  }

  /**
   * Enqueue a response event
   */
  async enqueueResponse(data: {
    response: string;
    context: any;
    source: string;
    sessionId?: string;
  }): Promise<string> {
    const event: Omit<EventData, 'id' | 'timestamp'> = {
      type: 'response',
      source: data.source,
      data: {
        response: data.response,
        context: data.context
      },
      sessionId: data.sessionId,
      correlationId: data.sessionId,
      priority: 'high'
    };

    return await this.eventQueue.enqueue(event);
  }

  /**
   * Handle event enqueued
   */
  private handleEventEnqueued(event: EventData): void {
    console.log(`Event enqueued: ${event.type} from ${event.source}`);
    this.emit('eventEnqueued', event);
  }

  /**
   * Handle event processing
   */
  private handleEventProcessing(event: EventData): void {
    console.log(`Processing event: ${event.type} (${event.id})`);
    
    // Add to correlation tracking
    if (event.correlationId) {
      if (!this.eventCorrelation.has(event.correlationId)) {
        this.eventCorrelation.set(event.correlationId, []);
      }
      this.eventCorrelation.get(event.correlationId)!.push(event);
    }

    // Process based on event type
    switch (event.type) {
      case 'conversation':
        this.processConversationEvent(event);
        break;
      case 'prompt':
        this.processPromptEvent(event);
        break;
      case 'response':
        this.processResponseEvent(event);
        break;
      case 'file_change':
        this.processFileChangeEvent(event);
        break;
      case 'code_execution':
        this.processCodeExecutionEvent(event);
        break;
    }
  }

  /**
   * Handle event processed
   */
  private handleEventProcessed(event: EventData): void {
    console.log(`Event processed: ${event.type} (${event.id})`);
    this.emit('eventProcessed', event);
  }

  /**
   * Handle event processing error
   */
  private handleEventProcessingError(error: any): void {
    console.error('Event processing error:', error);
    this.emit('eventProcessingError', error);
  }

  /**
   * Process conversation event
   */
  private processConversationEvent(event: EventData): void {
    const { userMessage, assistantResponse, filesReferenced } = event.data;
    
    // Add to conversation tracker
    this.conversationTracker.addExternalInteraction({
      userMessage,
      assistantResponse,
      timestamp: event.timestamp,
      source: event.source,
      filesReferenced
    });

    // Update session
    this.updateSessionWithEvent(event);
  }

  /**
   * Process prompt event
   */
  private processPromptEvent(event: EventData): void {
    const { prompt, context } = event.data;
    
    // Add to conversation tracker as user message
    this.conversationTracker.addExternalInteraction({
      userMessage: prompt,
      timestamp: event.timestamp,
      source: event.source
    });

    // Update session
    this.updateSessionWithEvent(event);
  }

  /**
   * Process response event
   */
  private processResponseEvent(event: EventData): void {
    const { response, context } = event.data;
    
    // Add to conversation tracker as assistant response
    this.conversationTracker.addExternalInteraction({
      assistantResponse: response,
      timestamp: event.timestamp,
      source: event.source
    });

    // Update session
    this.updateSessionWithEvent(event);
  }

  /**
   * Process file change event
   */
  private processFileChangeEvent(event: EventData): void {
    // Update session with file change
    this.updateSessionWithEvent(event);
  }

  /**
   * Process code execution event
   */
  private processCodeExecutionEvent(event: EventData): void {
    // Update session with code execution
    this.updateSessionWithEvent(event);
  }

  /**
   * Update session with event
   */
  private updateSessionWithEvent(event: EventData): void {
    const sessionId = event.sessionId || this.generateSessionId(event);
    
    if (!this.activeSessions.has(sessionId)) {
      this.createNewSession(sessionId, event);
    }

    const session = this.activeSessions.get(sessionId)!;
    session.events.push(event);

    // Categorize events
    switch (event.type) {
      case 'conversation':
        session.conversationEvents.push(event);
        break;
      case 'file_change':
        session.fileChangeEvents.push(event);
        break;
      case 'code_execution':
        session.codeExecutionEvents.push(event);
        break;
    }

    // Update metadata
    session.metadata.totalEvents = session.events.length;
    session.metadata.duration = new Date().getTime() - new Date(session.startTime).getTime();

    // Check if session should be finalized
    if (this.shouldFinalizeSession(session)) {
      this.finalizeSession(session);
    }
  }

  /**
   * Generate session ID from event
   */
  private generateSessionId(event: EventData): string {
    // Use correlation ID if available, otherwise generate new one
    return event.correlationId || `session-${nanoid()}`;
  }

  /**
   * Create new session
   */
  private createNewSession(sessionId: string, firstEvent: EventData): void {
    const session: ProcessedSession = {
      id: sessionId,
      startTime: firstEvent.timestamp,
      events: [],
      conversationEvents: [],
      fileChangeEvents: [],
      codeExecutionEvents: [],
      metadata: {
        totalEvents: 0,
        duration: 0,
        source: firstEvent.source
      }
    };

    this.activeSessions.set(sessionId, session);
    console.log(`Created new session: ${sessionId}`);
    this.emit('sessionCreated', session);
  }

  /**
   * Check if session should be finalized
   */
  private shouldFinalizeSession(session: ProcessedSession): boolean {
    const now = new Date().getTime();
    const lastEventTime = new Date(session.events[session.events.length - 1]?.timestamp || session.startTime).getTime();
    
    // Finalize if timeout reached or max events reached
    return (now - lastEventTime) > this.config.sessionTimeout || 
           session.events.length >= this.config.maxEventsPerSession;
  }

  /**
   * Finalize session
   */
  private async finalizeSession(session: ProcessedSession): Promise<void> {
    try {
      session.endTime = new Date().toISOString();
      session.metadata.duration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();

      // Analyze session intent
      const intent = this.analyzeSessionIntent(session);
      session.metadata.intent = intent.intent;
      session.metadata.confidence = intent.confidence;

      // Save to storage
      await this.saveSession(session);

      // Remove from active sessions
      this.activeSessions.delete(session.id);

      console.log(`Finalized session: ${session.id} (${session.events.length} events, ${session.metadata.duration}ms)`);
      this.emit('sessionFinalized', session);
    } catch (error) {
      console.error(`Error finalizing session ${session.id}:`, error);
      this.emit('sessionFinalizationError', { session, error });
    }
  }

  /**
   * Analyze session intent
   */
  private analyzeSessionIntent(session: ProcessedSession): { intent: string; confidence: number } {
    const conversationText = session.conversationEvents
      .map(e => e.data.userMessage || e.data.assistantResponse || '')
      .join(' ')
      .toLowerCase();

    const codeText = session.codeExecutionEvents
      .map(e => e.data.code || '')
      .join(' ')
      .toLowerCase();

    const allText = conversationText + ' ' + codeText;

    // Simple intent classification
    if (allText.includes('debug') || allText.includes('error') || allText.includes('fix')) {
      return { intent: 'debug', confidence: 0.8 };
    } else if (allText.includes('implement') || allText.includes('create') || allText.includes('build')) {
      return { intent: 'implementation', confidence: 0.7 };
    } else if (allText.includes('analyze') || allText.includes('explore') || allText.includes('data')) {
      return { intent: 'analysis', confidence: 0.7 };
    } else if (allText.includes('test') || allText.includes('verify') || allText.includes('check')) {
      return { intent: 'testing', confidence: 0.8 };
    } else {
      return { intent: 'general', confidence: 0.5 };
    }
  }

  /**
   * Save session to storage
   */
  private async saveSession(session: ProcessedSession): Promise<void> {
    try {
      // Convert to PKL session format
      const pklSession = this.convertToPKLSession(session);
      
      // Save to both storage systems
      await this.sessionDatabase.storeSessions([pklSession]);
      await this.jsonStorage.saveSession(pklSession);
      
      console.log(`Session saved: ${session.id}`);
    } catch (error) {
      console.error(`Error saving session ${session.id}:`, error);
      throw error;
    }
  }

  /**
   * Convert processed session to PKL session format
   */
  private convertToPKLSession(session: ProcessedSession): any {
    return {
      id: session.id,
      timestamp: session.startTime,
      startTime: session.startTime,
      endTime: session.endTime,
      intent: session.metadata.intent || 'general',
      phase: 'COMPLETED',
      outcome: 'SUCCESS',
      confidence: session.metadata.confidence || 0.5,
      currentFile: this.extractCurrentFile(session),
      cursorPosition: { line: 1, character: 0 },
      selectedText: '',
      fileChanges: session.fileChangeEvents.map(e => ({
        id: e.id,
        sessionId: session.id,
        timestamp: e.timestamp,
        filePath: e.data.filePath || 'unknown',
        changeType: e.data.changeType || 'modified',
        beforeSnippet: e.data.beforeSnippet || '',
        afterSnippet: e.data.afterSnippet || '',
        lineRange: e.data.lineRange || { start: 0, end: 0 },
        gitHash: e.data.gitHash || ''
      })),
      codeDeltas: session.codeExecutionEvents.map(e => ({
        id: e.id,
        sessionId: session.id,
        timestamp: e.timestamp,
        filePath: e.data.filePath || 'unknown',
        beforeContent: e.data.beforeContent || '',
        afterContent: e.data.afterContent || '',
        diff: e.data.diff || '',
        changeType: e.data.changeType || 'added',
        lineCount: e.data.lineCount || 0,
        cellIndex: e.data.cellIndex || null,
        executionCount: e.data.executionCount || null,
        isSuggestion: e.data.isSuggestion || false,
        suggestionStatus: e.data.suggestionStatus || 'unknown'
      })),
      linkedEvents: [],
      privacyMode: false,
      userConsent: true,
      dataRetention: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      annotations: [],
      lastActivity: session.endTime || new Date().toISOString(),
      duration: session.metadata.duration
    };
  }

  /**
   * Extract current file from session events
   */
  private extractCurrentFile(session: ProcessedSession): string {
    // Find the most recent file from file change events
    const fileChange = session.fileChangeEvents[session.fileChangeEvents.length - 1];
    if (fileChange && fileChange.data.filePath) {
      return fileChange.data.filePath;
    }

    // Fallback to source
    return session.metadata.source;
  }

  /**
   * Handle file changes from file monitor
   */
  private handleFileChanges(changes: any[]): void {
    for (const change of changes) {
      const event: Omit<EventData, 'id' | 'timestamp'> = {
        type: 'file_change',
        source: 'file_monitor',
        data: change,
        priority: 'medium'
      };

      this.eventQueue.enqueue(event);
    }
  }

  /**
   * Handle Jupyter session from parser
   */
  private handleJupyterSession(session: any): void {
    const event: Omit<EventData, 'id' | 'timestamp'> = {
      type: 'code_execution',
      source: 'jupyter_parser',
      data: session,
      sessionId: session.id,
      priority: 'medium'
    };

    this.eventQueue.enqueue(event);
  }

  /**
   * Start session cleanup
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date().getTime();
    const sessionsToFinalize: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const lastEventTime = new Date(session.events[session.events.length - 1]?.timestamp || session.startTime).getTime();
      
      if ((now - lastEventTime) > this.config.sessionTimeout) {
        sessionsToFinalize.push(sessionId);
      }
    }

    for (const sessionId of sessionsToFinalize) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        this.finalizeSession(session);
      }
    }
  }

  /**
   * Save active sessions
   */
  private async saveActiveSessions(): Promise<void> {
    for (const session of this.activeSessions.values()) {
      await this.finalizeSession(session);
    }
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    isProcessing: boolean;
    activeSessions: number;
    totalEvents: number;
    queueStats: any;
  } {
    const totalEvents = Array.from(this.activeSessions.values())
      .reduce((sum, session) => sum + session.events.length, 0);

    return {
      isProcessing: this.isProcessing,
      activeSessions: this.activeSessions.size,
      totalEvents,
      queueStats: this.eventQueue.getStats()
    };
  }
}
