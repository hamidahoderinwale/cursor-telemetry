import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
export interface EventData {
  id: string;
  type: 'conversation' | 'file_change' | 'code_execution' | 'prompt' | 'response';
  timestamp: string;
  source: string;
  data: any;
  sessionId?: string;
  correlationId?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CorrelationRule {
  id: string;
  name: string;
  conditions: CorrelationCondition[];
  window: number; // milliseconds
  priority: number;
  enabled: boolean;
}

export interface CorrelationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists';
  value: any;
  weight: number;
}

export interface CorrelatedEvent {
  id: string;
  correlationId: string;
  events: EventData[];
  confidence: number;
  timestamp: string;
  metadata: {
    ruleId: string;
    ruleName: string;
    totalWeight: number;
    matchedConditions: number;
  };
}

export interface DeduplicationRule {
  id: string;
  name: string;
  fields: string[];
  window: number; // milliseconds
  enabled: boolean;
}

export class EventCorrelator extends EventEmitter {
  private correlationRules: Map<string, CorrelationRule>;
  private deduplicationRules: Map<string, DeduplicationRule>;
  private eventBuffer: Map<string, EventData[]>;
  private correlationWindow: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(correlationWindow: number = 30000) {
    super();
    
    this.correlationWindow = correlationWindow;
    this.correlationRules = new Map();
    this.deduplicationRules = new Map();
    this.eventBuffer = new Map();

    this.initializeDefaultRules();
    this.startCleanup();
  }

  /**
   * Initialize default correlation and deduplication rules
   */
  private initializeDefaultRules(): void {
    // Default correlation rules
    this.addCorrelationRule({
      id: 'conversation-session',
      name: 'Conversation Session Correlation',
      conditions: [
        { field: 'type', operator: 'equals', value: 'conversation', weight: 1.0 },
        { field: 'source', operator: 'contains', value: 'cursor', weight: 0.8 }
      ],
      window: 30000, // 30 seconds
      priority: 1,
      enabled: true
    });

    this.addCorrelationRule({
      id: 'file-code-correlation',
      name: 'File Change and Code Execution Correlation',
      conditions: [
        { field: 'type', operator: 'equals', value: 'file_change', weight: 0.6 },
        { field: 'type', operator: 'equals', value: 'code_execution', weight: 0.8 }
      ],
      window: 10000, // 10 seconds
      priority: 2,
      enabled: true
    });

    this.addCorrelationRule({
      id: 'prompt-response-pair',
      name: 'Prompt-Response Pair Correlation',
      conditions: [
        { field: 'type', operator: 'equals', value: 'prompt', weight: 0.9 },
        { field: 'type', operator: 'equals', value: 'response', weight: 0.9 }
      ],
      window: 5000, // 5 seconds
      priority: 1,
      enabled: true
    });

    // Default deduplication rules
    this.addDeduplicationRule({
      id: 'conversation-dedup',
      name: 'Conversation Deduplication',
      fields: ['type', 'data.userMessage', 'source'],
      window: 2000, // 2 seconds
      enabled: true
    });

    this.addDeduplicationRule({
      id: 'file-change-dedup',
      name: 'File Change Deduplication',
      fields: ['type', 'data.filePath', 'data.changeType'],
      window: 1000, // 1 second
      enabled: true
    });

    this.addDeduplicationRule({
      id: 'code-execution-dedup',
      name: 'Code Execution Deduplication',
      fields: ['type', 'data.code', 'data.filePath'],
      window: 500, // 0.5 seconds
      enabled: true
    });
  }

  /**
   * Add a correlation rule
   */
  addCorrelationRule(rule: CorrelationRule): void {
    this.correlationRules.set(rule.id, rule);
    console.log(`Added correlation rule: ${rule.name}`);
  }

  /**
   * Add a deduplication rule
   */
  addDeduplicationRule(rule: DeduplicationRule): void {
    this.deduplicationRules.set(rule.id, rule);
    console.log(`Added deduplication rule: ${rule.name}`);
  }

  /**
   * Process an event for correlation and deduplication
   */
  async processEvent(event: EventData): Promise<{
    isDuplicate: boolean;
    correlatedEvents: CorrelatedEvent[];
    processedEvent: EventData;
  }> {
    // Check for duplicates first
    const isDuplicate = await this.checkDuplication(event);
    if (isDuplicate) {
      console.log(`Duplicate event detected: ${event.id}`);
      return {
        isDuplicate: true,
        correlatedEvents: [],
        processedEvent: event
      };
    }

    // Add to event buffer
    this.addToBuffer(event);

    // Find correlations
    const correlatedEvents = await this.findCorrelations(event);

    return {
      isDuplicate: false,
      correlatedEvents,
      processedEvent: event
    };
  }

  /**
   * Check if event is a duplicate
   */
  private async checkDuplication(event: EventData): Promise<boolean> {
    for (const rule of this.deduplicationRules.values()) {
      if (!rule.enabled) continue;

      const isDuplicate = await this.checkDeduplicationRule(event, rule);
      if (isDuplicate) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check deduplication rule
   */
  private async checkDeduplicationRule(event: EventData, rule: DeduplicationRule): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - rule.window);
    
    // Get events from buffer within the time window
    const recentEvents = this.getRecentEvents(cutoffTime);
    
    for (const recentEvent of recentEvents) {
      if (this.eventsMatch(event, recentEvent, rule.fields)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if two events match based on specified fields
   */
  private eventsMatch(event1: EventData, event2: EventData, fields: string[]): boolean {
    for (const field of fields) {
      const value1 = this.getNestedValue(event1, field);
      const value2 = this.getNestedValue(event2, field);
      
      if (value1 !== value2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Add event to buffer
   */
  private addToBuffer(event: EventData): void {
    const timeKey = this.getTimeKey(event.timestamp);
    
    if (!this.eventBuffer.has(timeKey)) {
      this.eventBuffer.set(timeKey, []);
    }
    
    this.eventBuffer.get(timeKey)!.push(event);
  }

  /**
   * Get time key for buffering (rounded to nearest minute)
   */
  private getTimeKey(timestamp: string): string {
    const date = new Date(timestamp);
    const minutes = Math.floor(date.getMinutes() / 1) * 1; // Round to nearest minute
    date.setMinutes(minutes, 0, 0);
    return date.toISOString();
  }

  /**
   * Get recent events from buffer
   */
  private getRecentEvents(cutoffTime: Date): EventData[] {
    const events: EventData[] = [];
    
    for (const [timeKey, eventList] of this.eventBuffer.entries()) {
      const timeKeyDate = new Date(timeKey);
      if (timeKeyDate >= cutoffTime) {
        events.push(...eventList);
      }
    }
    
    return events;
  }

  /**
   * Find correlations for an event
   */
  private async findCorrelations(event: EventData): Promise<CorrelatedEvent[]> {
    const correlatedEvents: CorrelatedEvent[] = [];
    
    for (const rule of this.correlationRules.values()) {
      if (!rule.enabled) continue;

      const correlation = await this.findCorrelationForRule(event, rule);
      if (correlation) {
        correlatedEvents.push(correlation);
      }
    }

    return correlatedEvents;
  }

  /**
   * Find correlation for a specific rule
   */
  private async findCorrelationForRule(event: EventData, rule: CorrelationRule): Promise<CorrelatedEvent | null> {
    const cutoffTime = new Date(Date.now() - rule.window);
    const recentEvents = this.getRecentEvents(cutoffTime);
    
    // Find events that match the correlation conditions
    const matchingEvents: EventData[] = [event];
    let totalWeight = 0;
    let matchedConditions = 0;

    for (const condition of rule.conditions) {
      let conditionMatched = false;
      
      for (const recentEvent of recentEvents) {
        if (recentEvent.id === event.id) continue; // Skip the current event
        
        if (this.eventMatchesCondition(recentEvent, condition)) {
          if (!matchingEvents.find(e => e.id === recentEvent.id)) {
            matchingEvents.push(recentEvent);
          }
          totalWeight += condition.weight;
          conditionMatched = true;
        }
      }
      
      if (conditionMatched) {
        matchedConditions++;
      }
    }

    // Check if we have enough matches to create a correlation
    if (matchedConditions >= rule.conditions.length && matchingEvents.length > 1) {
      const confidence = Math.min(totalWeight / rule.conditions.length, 1.0);
      
      return {
        id: nanoid(),
        correlationId: `corr-${nanoid()}`,
        events: matchingEvents,
        confidence,
        timestamp: new Date().toISOString(),
        metadata: {
          ruleId: rule.id,
          ruleName: rule.name,
          totalWeight,
          matchedConditions
        }
      };
    }

    return null;
  }

  /**
   * Check if event matches a correlation condition
   */
  private eventMatchesCondition(event: EventData, condition: CorrelationCondition): boolean {
    const value = this.getNestedValue(event, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);
      case 'matches':
        return typeof value === 'string' && new RegExp(condition.value).test(value);
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return false;
    }
  }

  /**
   * Get events by correlation ID
   */
  getEventsByCorrelation(correlationId: string): EventData[] {
    const events: EventData[] = [];
    
    for (const [timeKey, eventList] of this.eventBuffer.entries()) {
      for (const event of eventList) {
        if (event.correlationId === correlationId) {
          events.push(event);
        }
      }
    }
    
    return events;
  }

  /**
   * Get correlation statistics
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    totalDeduplicationRules: number;
    enabledDeduplicationRules: number;
    bufferSize: number;
    totalEvents: number;
  } {
    const totalEvents = Array.from(this.eventBuffer.values())
      .reduce((sum, events) => sum + events.length, 0);

    return {
      totalRules: this.correlationRules.size,
      enabledRules: Array.from(this.correlationRules.values()).filter(r => r.enabled).length,
      totalDeduplicationRules: this.deduplicationRules.size,
      enabledDeduplicationRules: Array.from(this.deduplicationRules.values()).filter(r => r.enabled).length,
      bufferSize: this.eventBuffer.size,
      totalEvents
    };
  }

  /**
   * Start cleanup process
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEvents();
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup old events from buffer
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - (this.correlationWindow * 2));
    
    // Check if cutoffTime is valid
    if (isNaN(cutoffTime.getTime())) {
      console.error('Invalid cutoff time for cleanup');
      return;
    }
    
    const cutoffKey = this.getTimeKey(cutoffTime.toISOString());
    
    let cleanedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const [timeKey, events] of this.eventBuffer.entries()) {
      if (timeKey < cutoffKey) {
        cleanedCount += events.length;
        keysToDelete.push(timeKey);
      }
    }
    
    for (const key of keysToDelete) {
      this.eventBuffer.delete(key);
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old events from correlation buffer`);
    }
  }

  /**
   * Destroy the correlator and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.eventBuffer.clear();
    this.removeAllListeners();
    
    console.log('Event correlator destroyed');
  }
}
