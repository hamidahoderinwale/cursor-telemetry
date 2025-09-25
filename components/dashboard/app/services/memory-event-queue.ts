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

export interface QueueConfig {
  maxSize: number;
  batchSize: number;
  processingInterval: number;
  maxRetries: number;
  retryDelay: number;
  eventTTL: number; // Time to live in milliseconds
}

export class MemoryEventQueue extends EventEmitter {
  private config: QueueConfig;
  private queues: {
    high: EventData[];
    medium: EventData[];
    low: EventData[];
  };
  private processedEvents: Map<string, EventData>;
  private failedEvents: Map<string, { event: EventData; retryCount: number; lastRetry: Date }>;
  private correlationIndex: Map<string, Set<string>>;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    
    this.config = {
      maxSize: 10000,
      batchSize: 10,
      processingInterval: 1000,
      maxRetries: 3,
      retryDelay: 5000,
      eventTTL: 24 * 60 * 60 * 1000, // 24 hours
      ...config
    };

    this.queues = {
      high: [],
      medium: [],
      low: []
    };

    this.processedEvents = new Map();
    this.failedEvents = new Map();
    this.correlationIndex = new Map();

    this.startCleanup();
  }

  /**
   * Enqueue an event for processing
   */
  async enqueue(event: Omit<EventData, 'id' | 'timestamp'>): Promise<string> {
    const eventData: EventData = {
      id: nanoid(),
      timestamp: new Date().toISOString(),
      ...event
    };

    // Check queue size limits
    const totalSize = this.queues.high.length + this.queues.medium.length + this.queues.low.length;
    if (totalSize >= this.config.maxSize) {
      // Remove oldest low priority events
      this.queues.low.shift();
    }

    // Add to appropriate priority queue
    this.queues[eventData.priority].push(eventData);

    // Add to correlation index
    if (eventData.correlationId) {
      if (!this.correlationIndex.has(eventData.correlationId)) {
        this.correlationIndex.set(eventData.correlationId, new Set());
      }
      this.correlationIndex.get(eventData.correlationId)!.add(eventData.id);
    }

    console.log(`Event enqueued: ${eventData.type} (${eventData.id}) - Priority: ${eventData.priority}`);
    this.emit('eventEnqueued', eventData);
    
    return eventData.id;
  }

  /**
   * Start processing events from the queue
   */
  startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('Starting in-memory event processing...');

    // Process events immediately
    this.processEvents();

    // Set up periodic processing
    this.processingInterval = setInterval(() => {
      this.processEvents();
    }, this.config.processingInterval);

    this.emit('processingStarted');
  }

  /**
   * Stop processing events
   */
  stopProcessing(): void {
    if (!this.isProcessing) return;

    this.isProcessing = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('Stopped in-memory event processing');
    this.emit('processingStopped');
  }

  /**
   * Process events from the queue
   */
  private async processEvents(): Promise<void> {
    if (!this.isProcessing) return;

    try {
      // Process high priority events first
      await this.processPriorityQueue('high');
      await this.processPriorityQueue('medium');
      await this.processPriorityQueue('low');

      // Retry failed events
      await this.retryFailedEvents();
    } catch (error) {
      console.error('Error processing events:', error);
      this.emit('processingError', error);
    }
  }

  /**
   * Process events from a specific priority queue
   */
  private async processPriorityQueue(priority: 'high' | 'medium' | 'low'): Promise<void> {
    const queue = this.queues[priority];
    const batchSize = Math.min(this.config.batchSize, queue.length);
    
    for (let i = 0; i < batchSize; i++) {
      const event = queue.shift();
      if (!event) break;

      try {
        await this.processEvent(event);
      } catch (error) {
        console.error(`Error processing event from ${priority} queue:`, error);
        await this.handleFailedEvent(event, error);
      }
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: EventData): Promise<void> {
    try {
      console.log(`Processing event: ${event.type} (${event.id})`);
      
      // Emit event for processing
      this.emit('eventProcessing', event);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Mark as processed
      this.markEventProcessed(event);
      
      console.log(`Event processed successfully: ${event.id}`);
      this.emit('eventProcessed', event);
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      this.emit('eventProcessingError', { event, error });
      throw error;
    }
  }

  /**
   * Mark an event as processed
   */
  private markEventProcessed(event: EventData): void {
    this.processedEvents.set(event.id, event);
    
    // Remove from correlation index
    if (event.correlationId) {
      const correlationSet = this.correlationIndex.get(event.correlationId);
      if (correlationSet) {
        correlationSet.delete(event.id);
        if (correlationSet.size === 0) {
          this.correlationIndex.delete(event.correlationId);
        }
      }
    }
  }

  /**
   * Handle failed event processing
   */
  private async handleFailedEvent(event: EventData, error: any): Promise<void> {
    const existingFailure = this.failedEvents.get(event.id);
    const retryCount = existingFailure ? existingFailure.retryCount + 1 : 1;

    if (retryCount <= this.config.maxRetries) {
      // Schedule for retry
      this.failedEvents.set(event.id, {
        event,
        retryCount,
        lastRetry: new Date()
      });
      
      console.log(`Event ${event.id} scheduled for retry (${retryCount}/${this.config.maxRetries})`);
    } else {
      // Move to dead letter (failed events map)
      console.log(`Event ${event.id} moved to dead letter after ${retryCount} retries`);
      this.emit('eventFailed', { event, error, retryCount });
    }
  }

  /**
   * Retry failed events
   */
  private async retryFailedEvents(): Promise<void> {
    const now = new Date();
    const eventsToRetry: string[] = [];

    for (const [eventId, failure] of this.failedEvents.entries()) {
      const timeSinceLastRetry = now.getTime() - failure.lastRetry.getTime();
      
      if (timeSinceLastRetry >= this.config.retryDelay) {
        eventsToRetry.push(eventId);
      }
    }

    for (const eventId of eventsToRetry) {
      const failure = this.failedEvents.get(eventId);
      if (failure) {
        // Re-queue the event with lower priority
        const retryEvent = { ...failure.event, priority: 'low' as const };
        this.queues.low.push(retryEvent);
        this.failedEvents.delete(eventId);
        
        console.log(`Retrying event: ${eventId}`);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    processed: number;
    failed: number;
    isProcessing: boolean;
    totalSize: number;
  } {
    return {
      highPriority: this.queues.high.length,
      mediumPriority: this.queues.medium.length,
      lowPriority: this.queues.low.length,
      processed: this.processedEvents.size,
      failed: this.failedEvents.size,
      isProcessing: this.isProcessing,
      totalSize: this.queues.high.length + this.queues.medium.length + this.queues.low.length
    };
  }

  /**
   * Get events by correlation ID
   */
  getEventsByCorrelation(correlationId: string): EventData[] {
    const eventIds = this.correlationIndex.get(correlationId);
    if (!eventIds) return [];

    const events: EventData[] = [];
    
    // Check all queues for events with this correlation ID
    for (const priority of ['high', 'medium', 'low'] as const) {
      for (const event of this.queues[priority]) {
        if (eventIds.has(event.id)) {
          events.push(event);
        }
      }
    }

    return events;
  }

  /**
   * Get processed events
   */
  getProcessedEvents(limit: number = 100): EventData[] {
    const events = Array.from(this.processedEvents.values());
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get failed events
   */
  getFailedEvents(): Array<{ event: EventData; retryCount: number; lastRetry: Date }> {
    return Array.from(this.failedEvents.values());
  }

  /**
   * Clear all queues (for testing/cleanup)
   */
  clearQueues(): void {
    this.queues.high = [];
    this.queues.medium = [];
    this.queues.low = [];
    this.processedEvents.clear();
    this.failedEvents.clear();
    this.correlationIndex.clear();
    
    console.log('All queues cleared');
  }

  /**
   * Start cleanup of old events
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Clean up old events
   */
  private cleanupOldEvents(): void {
    const cutoffTime = new Date(Date.now() - this.config.eventTTL);
    let cleanedCount = 0;

    // Clean up processed events
    for (const [eventId, event] of this.processedEvents.entries()) {
      if (new Date(event.timestamp) < cutoffTime) {
        this.processedEvents.delete(eventId);
        cleanedCount++;
      }
    }

    // Clean up failed events
    for (const [eventId, failure] of this.failedEvents.entries()) {
      if (new Date(failure.event.timestamp) < cutoffTime) {
        this.failedEvents.delete(eventId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old events`);
    }
  }

  /**
   * Destroy the queue and cleanup resources
   */
  destroy(): void {
    this.stopProcessing();
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clearQueues();
    this.removeAllListeners();
    
    console.log('Memory event queue destroyed');
  }
}
