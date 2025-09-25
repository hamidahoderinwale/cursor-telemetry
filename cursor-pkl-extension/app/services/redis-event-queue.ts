import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import { EventData } from './event-correlator';


export interface QueueConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
  processingTimeout: number;
}

export class RedisEventQueue extends EventEmitter {
  private redis: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private config: QueueConfig;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private eventBuffer: EventData[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    
    this.config = {
      host: 'localhost',
      port: 6379,
      db: 0,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
      processingTimeout: 30000,
      ...config
    };

    this.redis = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetries,
      lazyConnect: true
    });

    this.subscriber = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetries,
      lazyConnect: true
    });

    this.publisher = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      maxRetriesPerRequest: this.config.maxRetries,
      lazyConnect: true
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      console.log('Redis Event Queue connected');
      this.emit('connected');
    });

    this.redis.on('error', (error) => {
      console.error('Redis Event Queue error:', error);
      this.emit('error', error);
    });

    this.redis.on('close', () => {
      console.log('Redis Event Queue disconnected');
      this.emit('disconnected');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      await this.subscriber.connect();
      await this.publisher.connect();
      
      // Subscribe to event processing channel
      await this.subscriber.subscribe('events:process');
      this.subscriber.on('message', (channel, message) => {
        if (channel === 'events:process') {
          this.processEvents();
        }
      });

      console.log('Redis Event Queue connected successfully');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      await this.redis.disconnect();
      await this.subscriber.disconnect();
      await this.publisher.disconnect();
      
      console.log('Redis Event Queue disconnected');
    } catch (error) {
      console.error('Error disconnecting from Redis:', error);
    }
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

    try {
      // Add to Redis queue with priority
      const queueKey = `events:queue:${eventData.priority}`;
      await this.redis.lpush(queueKey, JSON.stringify(eventData));
      
      // Add to correlation index if correlationId exists
      if (eventData.correlationId) {
        await this.redis.sadd(`events:correlation:${eventData.correlationId}`, eventData.id);
      }

      // Publish processing signal
      await this.publisher.publish('events:process', 'new_event');

      console.log(`Event enqueued: ${eventData.type} (${eventData.id})`);
      this.emit('eventEnqueued', eventData);
      
      return eventData.id;
    } catch (error) {
      console.error('Failed to enqueue event:', error);
      throw error;
    }
  }

  /**
   * Start processing events from the queue
   */
  startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('Starting Redis event processing...');

    // Process events immediately
    this.processEvents();

    // Set up periodic processing
    this.processingInterval = setInterval(() => {
      this.processEvents();
    }, 1000); // Process every second

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

    console.log('Stopped Redis event processing');
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
    } catch (error) {
      console.error('Error processing events:', error);
      this.emit('processingError', error);
    }
  }

  /**
   * Process events from a specific priority queue
   */
  private async processPriorityQueue(priority: 'high' | 'medium' | 'low'): Promise<void> {
    const queueKey = `events:queue:${priority}`;
    
    for (let i = 0; i < this.config.batchSize; i++) {
      const eventJson = await this.redis.rpop(queueKey);
      if (!eventJson) break;

      try {
        const event: EventData = JSON.parse(eventJson);
        await this.processEvent(event);
      } catch (error) {
        console.error(`Error processing event from ${priority} queue:`, error);
        // Re-queue the event with lower priority or move to dead letter queue
        await this.handleFailedEvent(eventJson, priority);
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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mark as processed
      await this.markEventProcessed(event);
      
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
  private async markEventProcessed(event: EventData): Promise<void> {
    // Add to processed events set
    await this.redis.sadd('events:processed', event.id);
    
    // Remove from correlation index
    if (event.correlationId) {
      await this.redis.srem(`events:correlation:${event.correlationId}`, event.id);
    }

    // Set expiration for processed events (24 hours)
    await this.redis.expire(`events:processed:${event.id}`, 86400);
  }

  /**
   * Handle failed event processing
   */
  private async handleFailedEvent(eventJson: string, priority: string): Promise<void> {
    try {
      // Move to dead letter queue
      await this.redis.lpush('events:deadletter', JSON.stringify({
        event: eventJson,
        failedAt: new Date().toISOString(),
        priority,
        retryCount: 0
      }));
      
      console.log(`Event moved to dead letter queue: ${priority}`);
    } catch (error) {
      console.error('Error handling failed event:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    processed: number;
    deadLetter: number;
    isProcessing: boolean;
  }> {
    try {
      const [highPriority, mediumPriority, lowPriority, processed, deadLetter] = await Promise.all([
        this.redis.llen('events:queue:high'),
        this.redis.llen('events:queue:medium'),
        this.redis.llen('events:queue:low'),
        this.redis.scard('events:processed'),
        this.redis.llen('events:deadletter')
      ]);

      return {
        highPriority,
        mediumPriority,
        lowPriority,
        processed,
        deadLetter,
        isProcessing: this.isProcessing
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return {
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        processed: 0,
        deadLetter: 0,
        isProcessing: false
      };
    }
  }

  /**
   * Get events by correlation ID
   */
  async getEventsByCorrelation(correlationId: string): Promise<EventData[]> {
    try {
      const eventIds = await this.redis.smembers(`events:correlation:${correlationId}`);
      const events: EventData[] = [];

      for (const eventId of eventIds) {
        // Check if event is still in queue
        const queues = ['events:queue:high', 'events:queue:medium', 'events:queue:low'];
        for (const queue of queues) {
          const eventJson = await this.redis.lrange(queue, 0, -1);
          const event = eventJson.find(e => {
            try {
              const parsed = JSON.parse(e);
              return parsed.id === eventId;
            } catch {
              return false;
            }
          });
          
          if (event) {
            events.push(JSON.parse(event));
            break;
          }
        }
      }

      return events;
    } catch (error) {
      console.error('Error getting events by correlation:', error);
      return [];
    }
  }

  /**
   * Clear all queues (for testing/cleanup)
   */
  async clearQueues(): Promise<void> {
    try {
      await Promise.all([
        this.redis.del('events:queue:high'),
        this.redis.del('events:queue:medium'),
        this.redis.del('events:queue:low'),
        this.redis.del('events:processed'),
        this.redis.del('events:deadletter')
      ]);
      
      console.log('All queues cleared');
    } catch (error) {
      console.error('Error clearing queues:', error);
    }
  }
}
