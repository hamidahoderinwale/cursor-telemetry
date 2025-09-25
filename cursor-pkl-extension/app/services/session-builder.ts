import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { EventData, CorrelatedEvent } from './event-correlator';

export interface SessionContext {
  id: string;
  startTime: string;
  endTime?: string;
  source: string;
  workspacePath?: string;
  currentFile?: string;
  cursorPosition?: { line: number; character: number };
  selectedText?: string;
  userContext?: any;
  lastActivity?: string;
}

export interface SessionBoundary {
  type: 'timeout' | 'context_switch' | 'file_change' | 'intent_change' | 'manual';
  threshold: number;
  enabled: boolean;
}

export interface BuiltSession {
  id: string;
  timestamp: string;
  startTime: string;
  endTime: string;
  intent: string;
  phase: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  outcome: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'CANCELLED';
  confidence: number;
  currentFile: string;
  cursorPosition: { line: number; character: number };
  selectedText: string;
  fileChanges: any[];
  codeDeltas: any[];
  linkedEvents: any[];
  privacyMode: boolean;
  userConsent: boolean;
  dataRetention: string;
  annotations: any[];
  lastActivity: string;
  duration: number;
  metadata: {
    totalEvents: number;
    conversationEvents: number;
    fileChangeEvents: number;
    codeExecutionEvents: number;
    source: string;
    workspacePath?: string;
    sessionBoundary: string;
    correlationIds: string[];
  };
}

export class SessionBuilder extends EventEmitter {
  private activeContexts: Map<string, SessionContext>;
  private sessionBoundaries: Map<string, SessionBoundary>;
  private eventHistory: Map<string, EventData[]>;
  private correlationHistory: Map<string, CorrelatedEvent[]>;
  private defaultBoundaries: SessionBoundary[];

  constructor() {
    super();
    
    this.activeContexts = new Map();
    this.sessionBoundaries = new Map();
    this.eventHistory = new Map();
    this.correlationHistory = new Map();

    this.initializeDefaultBoundaries();
  }

  /**
   * Initialize default session boundaries
   */
  private initializeDefaultBoundaries(): void {
    this.defaultBoundaries = [
      {
        type: 'timeout',
        threshold: 300000, // 5 minutes
        enabled: true
      },
      {
        type: 'context_switch',
        threshold: 60000, // 1 minute
        enabled: true
      },
      {
        type: 'file_change',
        threshold: 30000, // 30 seconds
        enabled: true
      },
      {
        type: 'intent_change',
        threshold: 0, // Immediate
        enabled: true
      }
    ];
  }

  /**
   * Start a new session context
   */
  startSessionContext(data: {
    source: string;
    workspacePath?: string;
    currentFile?: string;
    cursorPosition?: { line: number; character: number };
    selectedText?: string;
    userContext?: any;
  }): string {
    const contextId = nanoid();
    const now = new Date().toISOString();

    const context: SessionContext = {
      id: contextId,
      startTime: now,
      source: data.source,
      workspacePath: data.workspacePath,
      currentFile: data.currentFile,
      cursorPosition: data.cursorPosition || { line: 1, character: 0 },
      selectedText: data.selectedText || '',
      userContext: data.userContext
    };

    this.activeContexts.set(contextId, context);
    this.eventHistory.set(contextId, []);
    this.correlationHistory.set(contextId, []);

    console.log(`Started session context: ${contextId} from ${data.source}`);
    this.emit('sessionContextStarted', context);

    return contextId;
  }

  /**
   * Add event to session context
   */
  addEventToContext(contextId: string, event: EventData): void {
    const context = this.activeContexts.get(contextId);
    if (!context) {
      console.warn(`Context not found: ${contextId}`);
      return;
    }

    // Add to event history
    const events = this.eventHistory.get(contextId) || [];
    events.push(event);
    this.eventHistory.set(contextId, events);

    // Update context based on event
    this.updateContextFromEvent(context, event);

    // Check for session boundaries
    this.checkSessionBoundaries(contextId);

    console.log(`Added event to context ${contextId}: ${event.type}`);
    this.emit('eventAddedToContext', { contextId, event });
  }

  /**
   * Add correlated events to session context
   */
  addCorrelatedEventsToContext(contextId: string, correlatedEvents: CorrelatedEvent[]): void {
    const context = this.activeContexts.get(contextId);
    if (!context) {
      console.warn(`Context not found: ${contextId}`);
      return;
    }

    // Add to correlation history
    const correlations = this.correlationHistory.get(contextId) || [];
    correlations.push(...correlatedEvents);
    this.correlationHistory.set(contextId, correlations);

    // Add individual events from correlations
    for (const correlatedEvent of correlatedEvents) {
      for (const event of correlatedEvent.events) {
        this.addEventToContext(contextId, event);
      }
    }

    console.log(`Added ${correlatedEvents.length} correlated events to context ${contextId}`);
    this.emit('correlatedEventsAddedToContext', { contextId, correlatedEvents });
  }

  /**
   * Update context from event
   */
  private updateContextFromEvent(context: SessionContext, event: EventData): void {
    // Update current file if it's a file change event
    if (event.type === 'file_change' && event.data.filePath) {
      context.currentFile = event.data.filePath;
    }

    // Update cursor position if available
    if (event.data.cursorPosition) {
      context.cursorPosition = event.data.cursorPosition;
    }

    // Update selected text if available
    if (event.data.selectedText) {
      context.selectedText = event.data.selectedText;
    }

    // Update last activity
    context.lastActivity = event.timestamp;
  }

  /**
   * Check session boundaries
   */
  private checkSessionBoundaries(contextId: string): void {
    const context = this.activeContexts.get(contextId);
    if (!context) return;

    const events = this.eventHistory.get(contextId) || [];
    const correlations = this.correlationHistory.get(contextId) || [];

    for (const boundary of this.defaultBoundaries) {
      if (!boundary.enabled) continue;

      if (this.shouldCreateSessionBoundary(context, events, correlations, boundary)) {
        this.createSessionFromContext(contextId, boundary.type);
        break;
      }
    }
  }

  /**
   * Check if session boundary should be created
   */
  private shouldCreateSessionBoundary(
    context: SessionContext,
    events: EventData[],
    correlations: CorrelatedEvent[],
    boundary: SessionBoundary
  ): boolean {
    const now = new Date().getTime();
    const startTime = new Date(context.startTime).getTime();
    const duration = now - startTime;

    switch (boundary.type) {
      case 'timeout':
        return duration >= boundary.threshold;

      case 'context_switch':
        return this.detectContextSwitch(events, boundary.threshold);

      case 'file_change':
        return this.detectFileChange(events, boundary.threshold);

      case 'intent_change':
        return this.detectIntentChange(events, correlations);

      default:
        return false;
    }
  }

  /**
   * Detect context switch
   */
  private detectContextSwitch(events: EventData[], threshold: number): boolean {
    if (events.length < 2) return false;

    const recentEvents = events.slice(-5); // Check last 5 events
    const now = new Date().getTime();

    for (let i = 1; i < recentEvents.length; i++) {
      const prevEvent = recentEvents[i - 1];
      const currEvent = recentEvents[i];
      
      const timeDiff = new Date(currEvent.timestamp).getTime() - new Date(prevEvent.timestamp).getTime();
      
      if (timeDiff > threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect file change
   */
  private detectFileChange(events: EventData[], threshold: number): boolean {
    const fileChangeEvents = events.filter(e => e.type === 'file_change');
    if (fileChangeEvents.length === 0) return false;

    const now = new Date().getTime();
    const recentFileChanges = fileChangeEvents.filter(e => 
      (now - new Date(e.timestamp).getTime()) <= threshold
    );

    return recentFileChanges.length > 0;
  }

  /**
   * Detect intent change
   */
  private detectIntentChange(events: EventData[], correlations: CorrelatedEvent[]): boolean {
    // Simple intent change detection based on event types
    const conversationEvents = events.filter(e => e.type === 'conversation').length;
    const codeEvents = events.filter(e => e.type === 'code_execution').length;
    const fileEvents = events.filter(e => e.type === 'file_change').length;

    // If we have a significant shift in event types, it might indicate intent change
    const totalEvents = events.length;
    if (totalEvents < 3) return false;

    const conversationRatio = conversationEvents / totalEvents;
    const codeRatio = codeEvents / totalEvents;
    const fileRatio = fileEvents / totalEvents;

    // Intent change if one type dominates significantly
    return conversationRatio > 0.7 || codeRatio > 0.7 || fileRatio > 0.7;
  }

  /**
   * Create session from context
   */
  private createSessionFromContext(contextId: string, boundaryType: string): void {
    const context = this.activeContexts.get(contextId);
    if (!context) return;

    const events = this.eventHistory.get(contextId) || [];
    const correlations = this.correlationHistory.get(contextId) || [];

    const session = this.buildSession(context, events, correlations, boundaryType);

    // Clean up context
    this.activeContexts.delete(contextId);
    this.eventHistory.delete(contextId);
    this.correlationHistory.delete(contextId);

    console.log(`Created session from context ${contextId}: ${session.id}`);
    this.emit('sessionCreated', session);
  }

  /**
   * Build session from context and events
   */
  private buildSession(
    context: SessionContext,
    events: EventData[],
    correlations: CorrelatedEvent[],
    boundaryType: string
  ): BuiltSession {
    const now = new Date().toISOString();
    const sessionId = nanoid();
    const startTime = new Date(context.startTime);
    const endTime = new Date(now);
    const duration = endTime.getTime() - startTime.getTime();

    // Analyze events to determine intent and outcome
    const analysis = this.analyzeEvents(events, correlations);

    // Build file changes
    const fileChanges = this.buildFileChanges(events);

    // Build code deltas
    const codeDeltas = this.buildCodeDeltas(events);

    // Build linked events
    const linkedEvents = this.buildLinkedEvents(correlations);

    // Build annotations
    const annotations = this.buildAnnotations(events, correlations);

    const session: BuiltSession = {
      id: sessionId,
      timestamp: context.startTime,
      startTime: context.startTime,
      endTime: now,
      intent: analysis.intent,
      phase: 'COMPLETED',
      outcome: analysis.outcome as 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'CANCELLED',
      confidence: analysis.confidence,
      currentFile: context.currentFile || 'unknown',
      cursorPosition: context.cursorPosition || { line: 1, character: 0 },
      selectedText: context.selectedText || '',
      fileChanges,
      codeDeltas,
      linkedEvents,
      privacyMode: false,
      userConsent: true,
      dataRetention: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      annotations,
      lastActivity: now,
      duration,
      metadata: {
        totalEvents: events.length,
        conversationEvents: events.filter(e => e.type === 'conversation').length,
        fileChangeEvents: events.filter(e => e.type === 'file_change').length,
        codeExecutionEvents: events.filter(e => e.type === 'code_execution').length,
        source: context.source,
        workspacePath: context.workspacePath,
        sessionBoundary: boundaryType,
        correlationIds: correlations.map(c => c.correlationId)
      }
    };

    return session;
  }

  /**
   * Analyze events to determine intent and outcome
   */
  private analyzeEvents(events: EventData[], correlations: CorrelatedEvent[]): {
    intent: string;
    outcome: string;
    confidence: number;
  } {
    const conversationEvents = events.filter(e => e.type === 'conversation');
    const codeEvents = events.filter(e => e.type === 'code_execution');
    const fileEvents = events.filter(e => e.type === 'file_change');

    // Determine intent based on event types and content
    let intent = 'general';
    let confidence = 0.5;

    if (conversationEvents.length > 0) {
      const conversationText = conversationEvents
        .map(e => e.data.userMessage || e.data.assistantResponse || '')
        .join(' ')
        .toLowerCase();

      if (conversationText.includes('debug') || conversationText.includes('error')) {
        intent = 'debug';
        confidence = 0.8;
      } else if (conversationText.includes('implement') || conversationText.includes('create')) {
        intent = 'implementation';
        confidence = 0.7;
      } else if (conversationText.includes('analyze') || conversationText.includes('explore')) {
        intent = 'analysis';
        confidence = 0.7;
      } else if (conversationText.includes('test') || conversationText.includes('verify')) {
        intent = 'testing';
        confidence = 0.8;
      }
    }

    if (codeEvents.length > 0) {
      intent = 'code_development';
      confidence = Math.max(confidence, 0.6);
    }

    // Determine outcome
    let outcome: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'CANCELLED' = 'SUCCESS';
    if (events.length === 0) {
      outcome = 'CANCELLED';
    } else if (events.some(e => e.data.error || e.data.failed)) {
      outcome = 'FAILED';
    }

    return { intent, outcome, confidence };
  }

  /**
   * Build file changes from events
   */
  private buildFileChanges(events: EventData[]): any[] {
    return events
      .filter(e => e.type === 'file_change')
      .map(e => ({
        id: e.id,
        sessionId: e.sessionId,
        timestamp: e.timestamp,
        filePath: e.data.filePath || 'unknown',
        changeType: e.data.changeType || 'modified',
        beforeSnippet: e.data.beforeSnippet || '',
        afterSnippet: e.data.afterSnippet || '',
        lineRange: e.data.lineRange || { start: 0, end: 0 },
        gitHash: e.data.gitHash || ''
      }));
  }

  /**
   * Build code deltas from events
   */
  private buildCodeDeltas(events: EventData[]): any[] {
    return events
      .filter(e => e.type === 'code_execution')
      .map(e => ({
        id: e.id,
        sessionId: e.sessionId,
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
      }));
  }

  /**
   * Build linked events from correlations
   */
  private buildLinkedEvents(correlations: CorrelatedEvent[]): any[] {
    return correlations.map(c => ({
      id: c.id,
      correlationId: c.correlationId,
      confidence: c.confidence,
      timestamp: c.timestamp,
      eventCount: c.events.length,
      ruleId: c.metadata.ruleId,
      ruleName: c.metadata.ruleName
    }));
  }

  /**
   * Build annotations from events and correlations
   */
  private buildAnnotations(events: EventData[], correlations: CorrelatedEvent[]): any[] {
    const annotations: any[] = [];

    // Add annotations from conversation events
    const conversationEvents = events.filter(e => e.type === 'conversation');
    for (const event of conversationEvents) {
      if (event.data.userMessage) {
        annotations.push({
          id: nanoid(),
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          content: `User: ${event.data.userMessage}`,
          tags: ['conversation', 'user']
        });
      }
      if (event.data.assistantResponse) {
        annotations.push({
          id: nanoid(),
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          content: `Assistant: ${event.data.assistantResponse}`,
          tags: ['conversation', 'assistant']
        });
      }
    }

    // Add annotations from correlations
    for (const correlation of correlations) {
      annotations.push({
        id: nanoid(),
        sessionId: correlation.events[0]?.sessionId,
        timestamp: correlation.timestamp,
        content: `Correlated ${correlation.events.length} events (${correlation.metadata.ruleName})`,
        tags: ['correlation', correlation.metadata.ruleId]
      });
    }

    return annotations;
  }

  /**
   * End session context manually
   */
  endSessionContext(contextId: string): BuiltSession | null {
    const context = this.activeContexts.get(contextId);
    if (!context) return null;

    const events = this.eventHistory.get(contextId) || [];
    const correlations = this.correlationHistory.get(contextId) || [];

    const session = this.buildSession(context, events, correlations, 'manual');

    // Clean up context
    this.activeContexts.delete(contextId);
    this.eventHistory.delete(contextId);
    this.correlationHistory.delete(contextId);

    console.log(`Manually ended session context ${contextId}: ${session.id}`);
    this.emit('sessionContextEnded', { contextId, session });

    return session;
  }

  /**
   * Get active session contexts
   */
  getActiveContexts(): SessionContext[] {
    return Array.from(this.activeContexts.values());
  }

  /**
   * Get session builder statistics
   */
  getStats(): {
    activeContexts: number;
    totalEvents: number;
    totalCorrelations: number;
  } {
    const totalEvents = Array.from(this.eventHistory.values())
      .reduce((sum, events) => sum + events.length, 0);
    
    const totalCorrelations = Array.from(this.correlationHistory.values())
      .reduce((sum, correlations) => sum + correlations.length, 0);

    return {
      activeContexts: this.activeContexts.size,
      totalEvents,
      totalCorrelations
    };
  }

  /**
   * Cleanup old contexts
   */
  cleanupOldContexts(maxAge: number = 3600000): void { // 1 hour default
    const cutoffTime = new Date(Date.now() - maxAge);
    const contextsToRemove: string[] = [];

    for (const [contextId, context] of this.activeContexts.entries()) {
      if (new Date(context.startTime) < cutoffTime) {
        contextsToRemove.push(contextId);
      }
    }

    for (const contextId of contextsToRemove) {
      this.endSessionContext(contextId);
    }

    if (contextsToRemove.length > 0) {
      console.log(`Cleaned up ${contextsToRemove.length} old session contexts`);
    }
  }
}
