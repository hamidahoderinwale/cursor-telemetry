#!/usr/bin/env node

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const EventEmitter = require('events');
// Simple database wrapper using fs and sqlite3 command line
const fs = require('fs');
const { execSync } = require('child_process');

// Add graceful shutdown handling
let conversationMonitor = null;
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (conversationMonitor) {
    await conversationMonitor.optimizeStorage();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (conversationMonitor) {
    await conversationMonitor.optimizeStorage();
  }
  process.exit(0);
});

// Enhanced monitoring services
const EnhancedMonitoringService = require('./enhanced-monitoring-service');
const { ProgramSlicingService } = require('../services/program-slicing-service');
const { EnhancedSlicingInsights } = require('../services/enhanced-slicing-insights');
const { ConversationTracker } = require('../services/conversation-tracker');
const { LiveConversationMonitor } = require('../services/live-conversation-monitor');

// Optimization services
const OptimizationManager = require('../services/optimization-manager');

class SimpleDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
  }

  prepare(query) {
    return {
      all: () => {
        try {
          const result = execSync(`sqlite3 "${this.dbPath}" "${query}"`, { encoding: 'utf8' });
          return result.trim().split('\n').filter(line => line).map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return { data: line };
            }
          });
        } catch (error) {
          console.warn('Database query failed:', error.message);
          return [];
        }
      },
      get: () => {
        try {
          const result = execSync(`sqlite3 "${this.dbPath}" "${query}" LIMIT 1"`, { encoding: 'utf8' });
          return result.trim() ? JSON.parse(result.trim()) : null;
        } catch (error) {
          console.warn('Database query failed:', error.message);
          return null;
        }
      },
      run: (params) => {
        try {
          execSync(`sqlite3 "${this.dbPath}" "${query}"`, { encoding: 'utf8' });
          return { changes: 1 };
        } catch (error) {
          console.warn('Database query failed:', error.message);
          return { changes: 0 };
        }
      }
    };
  }

  close() {
    // No-op for SimpleDatabase
    return Promise.resolve();
  }
}
const RealMonitor = require('./real-monitor');
const DataStorage = require('../data-processing/data-storage');
const ExportService = require('../data-processing/export-service');
// AppleScript service for macOS integration with Cursor IDE
const AppleScriptService = {
  executeScript: (script) => {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
          console.error('AppleScript error:', error);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  },
  
  isAvailable: () => {
    // Check if we're on macOS
    return process.platform === 'darwin';
  },
  
  restoreSessionContext: async ({ currentFile, cursorPosition, selectedText }) => {
    try {
      if (!currentFile) {
        return { success: false, error: 'No file specified' };
      }
      
      // Open file in Cursor IDE
      const openScript = `tell application "Cursor" to open POSIX file "${currentFile}"`;
      await AppleScriptService.executeScript(openScript);
      
      // Wait a moment for the file to open
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set cursor position if provided
      if (cursorPosition) {
        const positionScript = `
          tell application "Cursor"
            activate
            tell application "System Events"
              key code 36 -- Enter key to ensure we're in the editor
              delay 0.5
              -- Navigate to position (this is a simplified approach)
              repeat ${cursorPosition.line || 1} times
                key code 125 -- Down arrow
              end repeat
              repeat ${cursorPosition.character || 0} times
                key code 124 -- Right arrow
              end repeat
            end tell
          end tell
        `;
        await AppleScriptService.executeScript(positionScript);
      }
      
      return {
        success: true,
        method: 'AppleScript',
        position: cursorPosition,
        file: currentFile
      };
    } catch (error) {
      console.error('Error restoring session context:', error);
      return {
        success: false,
        error: error.message || 'Failed to restore context in Cursor IDE'
      };
    }
  },
  
  openFileInCursor: async (filePath) => {
    try {
      const script = `tell application "Cursor" to open POSIX file "${filePath}"`;
      await AppleScriptService.executeScript(script);
      return true;
    } catch (error) {
      console.error('Error opening file in Cursor:', error);
      return false;
    }
  },
  
  extractNotebookVisualizations: async (filePath) => {
    try {
      console.log(`Extracting visualizations from ${filePath}`);
      
      // For now, return empty visualizations
      // This would normally parse the notebook file and extract visualization data
      return {
        success: true,
        visualizations: [],
        total: 0,
        file: filePath,
        lastModified: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting visualizations:', error);
      return {
        success: false,
        error: error.message,
        visualizations: [],
        total: 0
      };
    }
  }
};

// Import the proper PrivacyService
const PrivacyService = require('../data-processing/privacy-service');

const ProcedurePatternService = class {
  constructor() {}
  extractPatterns() { return { patterns: [], insights: [] }; }
  generateProcedure() { return { steps: [], metadata: {} }; }
};

// Deterministic Event Processing Architecture
class EventQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.batchSize = 10;
    this.maxQueueSize = 1000;
  }

  // Deterministic ordering by timestamp + sequence
  enqueue(event) {
    const eventWithId = {
      ...event,
      id: `${event.timestamp}_${this.queue.length}`,
      sequence: this.queue.length
    };
    
    // Insert in chronological order
    const insertIndex = this.binarySearchInsert(eventWithId);
    this.queue.splice(insertIndex, 0, eventWithId);
    
    // Maintain queue size
    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift(); // Remove oldest
    }
  }

  binarySearchInsert(event) {
    let left = 0, right = this.queue.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.queue[mid].timestamp <= event.timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    return left;
  }

  dequeueBatch() {
    const batch = this.queue.splice(0, this.batchSize);
    return batch.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.sequence - b.sequence; // Tie-breaker
    });
  }

  get length() {
    return this.queue.length;
  }

  startProcessing() {
    this.processing = true;
    console.log('Deterministic event queue processing started');
  }

  stopProcessing() {
    this.processing = false;
    console.log('Deterministic event queue processing stopped');
  }
}

// Event Deduplication
class EventDeduplicator {
  constructor() {
    this.deduplicationWindow = 5000; // 5 seconds
    this.eventHashes = new Map();
  }

  deduplicate(events) {
    const unique = [];
    const seen = new Set();
    
    for (const event of events) {
      const hash = this.generateEventHash(event);
      const timeKey = Math.floor(event.timestamp / this.deduplicationWindow);
      const dedupKey = `${hash}_${timeKey}`;
      
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        unique.push(event);
      }
    }
    
    return unique;
  }

  generateEventHash(event) {
    // Deterministic hash of event content
    const content = JSON.stringify({
      type: event.type,
      content: event.content,
      filePath: event.filePath,
      // Exclude timestamp for content-based deduplication
    });
    
    return this.simpleHash(content);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

// Session Boundary Detection
class SessionBoundaryDetector {
  constructor() {
    this.sessionTimeout = 300000; // 5 minutes
    this.contextSwitchThreshold = 60000; // 1 minute
  }

  detectBoundaries(events) {
    const sessions = [];
    let currentSession = [];
    let lastEventTime = null;
    let lastContext = null;
    
    for (const event of events) {
      const shouldStartNewSession = this.evaluateBoundaryRules(
        event, 
        lastEventTime, 
        lastContext,
        currentSession
      );
      
      if (shouldStartNewSession && currentSession.length > 0) {
        sessions.push(this.finalizeSession(currentSession));
        currentSession = [];
      }
      
      currentSession.push(event);
      lastEventTime = event.timestamp;
      lastContext = this.extractContext(event);
    }
    
    // Add final session
    if (currentSession.length > 0) {
      sessions.push(this.finalizeSession(currentSession));
    }
    
    return sessions;
  }

  evaluateBoundaryRules(event, lastEventTime, lastContext, currentSession) {
    // Timeout boundary
    if (lastEventTime && (event.timestamp - lastEventTime) > this.sessionTimeout) {
      return true;
    }
    
    // Context switch boundary
    if (lastContext) {
      const currentContext = this.extractContext(event);
      const contextChanged = this.contextsDiffer(lastContext, currentContext);
      const timeSinceLastEvent = event.timestamp - lastEventTime;
      
      if (contextChanged && timeSinceLastEvent > this.contextSwitchThreshold) {
        return true;
      }
    }
    
    // Explicit boundary
    if (event.type === 'session_end' || 
        event.type === 'conversation_end' ||
        event.content?.includes('---SESSION_END---')) {
      return true;
    }
    
    return false;
  }

  extractContext(event) {
    return {
      filePath: event.filePath,
      processId: event.processId,
      userId: event.userId,
      workingDirectory: event.workingDirectory,
      application: event.application,
      fingerprint: this.generateContextFingerprint(event)
    };
  }

  generateContextFingerprint(event) {
    const components = [
      event.filePath || 'unknown',
      event.processId || 'unknown',
      event.workingDirectory || 'unknown',
      event.application || 'unknown'
    ];
    
    return components.join('|');
  }

  contextsDiffer(context1, context2) {
    if (!context1 || !context2) return true;
    return context1.fingerprint !== context2.fingerprint;
  }

  finalizeSession(events) {
    return {
      events: events,
      startTime: events[0]?.timestamp,
      endTime: events[events.length - 1]?.timestamp,
      duration: events[events.length - 1]?.timestamp - events[0]?.timestamp
    };
  }
}

const EventCorrelator = class {
  constructor() {
    this.correlationWindow = 30000; // 30 seconds
  }
  
  correlate(events) { 
    return { correlations: [], sessions: [] }; 
  }
};

// Deterministic Session Builder
class DeterministicSessionBuilder extends EventEmitter {
  constructor() {
    super();
    this.sessionIdGenerator = new SessionIdGenerator();
  }

  buildSession(events) {
    // Sort events deterministically
    const sortedEvents = events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.sequence - b.sequence;
    });
    
    const session = {
      id: this.sessionIdGenerator.generate(sortedEvents),
      timestamp: sortedEvents[0]?.timestamp || Date.now(),
      endTime: sortedEvents[sortedEvents.length - 1]?.timestamp || Date.now(),
      events: sortedEvents,
      duration: (sortedEvents[sortedEvents.length - 1]?.timestamp || Date.now()) - (sortedEvents[0]?.timestamp || Date.now()),
      fingerprint: this.generateSessionFingerprint(sortedEvents)
    };
    
    return session;
  }

  generateSessionFingerprint(events) {
    const eventHashes = events.map(e => this.generateEventHash(e));
    return this.simpleHash(eventHashes.join('|'));
  }

  generateEventHash(event) {
    const content = JSON.stringify({
      type: event.type,
      content: event.content,
      filePath: event.filePath
    });
    return this.simpleHash(content);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }
}

// Session ID Generator
class SessionIdGenerator {
  generate(events) {
    if (!events || events.length === 0) {
      return `session-${Date.now()}`;
    }
    
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    
    return `session-${firstEvent.timestamp}-${lastEvent.timestamp}`;
  }
}

// Complete Deterministic Pipeline
class DeterministicEventPipeline extends EventEmitter {
  constructor() {
    super();
    this.queue = new EventQueue();
    this.correlator = new EventCorrelator();
    this.deduplicator = new EventDeduplicator();
    this.boundaryDetector = new SessionBoundaryDetector();
    this.sessionBuilder = new DeterministicSessionBuilder();
  }

  async processEvent(event) {
    // 1. Add to queue (deterministic ordering)
    this.queue.enqueue(event);
    
    // 2. Process batch when ready
    if (this.queue.length >= this.queue.batchSize) {
      return await this.processBatch();
    }
    
    return [];
  }

  async processBatch() {
    const events = this.queue.dequeueBatch();
    
    // 3. Deduplicate (deterministic)
    const uniqueEvents = this.deduplicator.deduplicate(events);
    
    // 4. Correlate (deterministic)
    const correlated = this.correlator.correlate(uniqueEvents);
    
    // 5. Detect boundaries (deterministic)
    const sessions = this.boundaryDetector.detectBoundaries(uniqueEvents);
    
    // 6. Build sessions (deterministic)
    const builtSessions = sessions.map(sessionData => 
      this.sessionBuilder.buildSession(sessionData.events)
    );
    
    return builtSessions;
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.queue.processing,
      batchSize: this.queue.batchSize,
      maxQueueSize: this.queue.maxQueueSize
    };
  }

  // Add missing enqueue method
  async enqueue(event) {
    try {
      // Add event to queue
      this.queue.enqueue(event);
      
      // Emit event enqueued
      this.emit('eventEnqueued', event);
      
      // Process immediately for high priority events
      if (event.priority === 'high') {
        await this.processEvent(event);
      }
      
      return event.id || `event-${Date.now()}`;
    } catch (error) {
      console.error('Error enqueuing event:', error);
      this.emit('eventProcessingError', error);
      throw error;
    }
  }

  // Add missing startProcessing method
  startProcessing() {
    this.queue.startProcessing();
    console.log('Deterministic event pipeline processing started');
  }

  stopProcessing() {
    this.queue.stopProcessing();
    console.log('Deterministic event pipeline processing stopped');
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const port = process.env.PORT || 3000;

// Initialize WebSocket server with optimization manager
server.on('listening', async () => {
  if (optimizationManager) {
    await optimizationManager.startWebSocketServer(server);
  }
});

// Initialize components
const realMonitor = new RealMonitor();
const dataStorage = new DataStorage();
const exportService = new ExportService();
const privacyService = new PrivacyService();
const procedureService = new ProcedurePatternService();

// Initialize optimization manager
let optimizationManager = null;

// Initialize deterministic event processing pipeline
const eventPipeline = new DeterministicEventPipeline();

const eventCorrelator = new EventCorrelator({
  correlationWindow: 5000, // 5 seconds for immediate correlation
  maxEventsPerCorrelation: 100,
  deduplicationWindow: 1000 // 1 second deduplication
});

const sessionBuilder = new DeterministicSessionBuilder();

// Connect data storage to real monitor
realMonitor.dataStorage = dataStorage;

// Connect real monitor to broadcast updates
realMonitor.setBroadcastCallback(broadcastUpdate);

// Connect event queue to real monitor
realMonitor.setEventQueue(eventPipeline);

// Setup event queue integration
setupEventQueueIntegration();

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current sessions to newly connected client
  socket.emit('sessions-update', realMonitor.getActiveSessions());
  
  // Handle client requests
  socket.on('request-sessions', async () => {
    try {
      const activeSessions = realMonitor.getActiveSessions();
      const storedSessions = await dataStorage.loadSessions();
      const allSessions = [...activeSessions, ...storedSessions];
      const uniqueSessions = deduplicateSessions(allSessions);
      socket.emit('sessions-update', uniqueSessions);
    } catch (error) {
      socket.emit('error', { message: 'Failed to load sessions' });
    }
  });
  
  socket.on('request-live-durations', () => {
    const activeSessions = realMonitor.getActiveSessions();
    const liveDurations = {};
    
    activeSessions.forEach(session => {
      const duration = realMonitor.getLiveDuration(session.id);
      liveDurations[session.id] = {
        duration: duration,
        formatted: realMonitor.formatDuration(duration),
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: !session.endTime
      };
    });
    
    socket.emit('live-durations-update', liveDurations);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Function to broadcast updates to all connected clients
function broadcastUpdate(event, data) {
  io.emit(event, data);
}

// REAL-TIME CONVERSATION CAPTURE TRIGGERS
function triggerImmediateCapture(eventType, data) {
  console.log(`IMMEDIATE CAPTURE TRIGGERED: ${eventType}`);
  
  // Create immediate event for queue
  const immediateEvent = {
    id: require('nanoid').nanoid(),
    type: eventType,
    timestamp: new Date().toISOString(),
    source: 'real-time-trigger',
    priority: 'high',
    data: data
  };
  
  // Add to queue with high priority (bypasses normal batching)
  eventPipeline.enqueue(immediateEvent);
  
  // Broadcast immediately to connected clients
  broadcastUpdate('real-time-event', immediateEvent);
  
  return immediateEvent;
}

// Setup event queue integration
function setupEventQueueIntegration() {
  console.log('Setting up event queue integration...');
  
  // Start event queue processing
  eventPipeline.startProcessing();
  
  // Event queue handlers
  eventPipeline.on('eventEnqueued', (event) => {
    console.log(`Event enqueued: ${event.type} (${event.id})`);
  });
  
  eventPipeline.on('eventProcessing', async (event) => {
    console.log(`Processing event: ${event.type} (${event.id})`);
    
    // Correlate event with other events
    const correlationResult = await eventCorrelator.processEvent(event);
    
    if (!correlationResult.isDuplicate) {
      // Add to session builder
      const contextId = event.sessionId || 'default-context';
      sessionBuilder.addEventToContext(contextId, event);
      
      if (correlationResult.correlatedEvents && correlationResult.correlatedEvents.length > 0) {
        sessionBuilder.addCorrelatedEventsToContext(contextId, correlationResult.correlatedEvents);
      }
    }
  });
  
  eventPipeline.on('eventProcessed', (event) => {
    console.log(`Event processed: ${event.type} (${event.id})`);
    
    // Broadcast event to connected clients
    io.emit('event-processed', {
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      source: event.source
    });
  });
  
  eventPipeline.on('eventProcessingError', (error) => {
    console.error('Event processing error:', error);
    io.emit('event-processing-error', error);
  });
  
  // Session builder handlers - using deterministic pipeline
  console.log('Session builder handlers initialized for deterministic processing');
  
  console.log('Event queue integration setup complete');
}

// Initialize data storage and run maintenance
async function initializeDataStorage() {
  try {
    // Run data migration
    await dataStorage.migrateData();
    
    // Clean up old data (keep last 30 days)
    await dataStorage.cleanupOldData(30);
    
    // Get data size info
    const dataSize = await dataStorage.getDataSize();
    console.log(`Data storage: ${dataSize.totalSizeMB}MB (${dataSize.stats.totalSessions} sessions)`);
  } catch (error) {
    console.error('Error initializing data storage:', error);
  }
}

// Initialize enhanced monitoring service
let enhancedMonitoringService = null;

// Initialize real-time update engine
let realTimeUpdateEngine = null;

// Initialize context-aware monitor
let contextAwareMonitor = null;

async function initializeEnhancedMonitoring() {
  try {
    enhancedMonitoringService = new EnhancedMonitoringService({
      watchPaths: [
        process.cwd(),
        path.join(process.env.HOME || '', 'Desktop'),
        path.join(process.env.HOME || '', 'Documents')
      ],
      enableRealTimeUpdates: true,
      enableFileAnalysis: true
    });
    
    // Setup event handlers
    enhancedMonitoringService.on('file-change-detected', (changeRecord) => {
      console.log(`File change detected: ${changeRecord.relativePath}`);
      // Broadcast to connected clients
      io.emit('file-change-detected', changeRecord);
    });
    
    enhancedMonitoringService.on('file-added-detected', (changeRecord) => {
      console.log(`➕ File added: ${changeRecord.relativePath}`);
      io.emit('file-added-detected', changeRecord);
    });
    
    enhancedMonitoringService.on('file-deleted-detected', (changeRecord) => {
      console.log(`File deleted: ${changeRecord.relativePath}`);
      io.emit('file-deleted-detected', changeRecord);
    });
    
    enhancedMonitoringService.on('periodic-update', (stats) => {
      io.emit('monitoring-stats-update', stats);
    });
    
    await enhancedMonitoringService.start();
    console.log('✅ Enhanced monitoring service started');
    
  } catch (error) {
    console.error('❌ Failed to start enhanced monitoring service:', error);
  }
}

async function initializeRealTimeUpdateEngine() {
  try {
    const RealTimeUpdateEngine = require('../services/real-time-update-engine');
    realTimeUpdateEngine = new RealTimeUpdateEngine();
    
    // Set up event handlers
    realTimeUpdateEngine.on('update', (update) => {
      // Broadcast to all connected clients
      io.emit('real-time-update', update);
    });
    
    realTimeUpdateEngine.on('update:file-change', (update) => {
      io.emit('file-change', update.data);
    });
    
    realTimeUpdateEngine.on('update:conversation-detected', (update) => {
      io.emit('conversation-detected', update.data);
    });
    
    realTimeUpdateEngine.on('update:process-change', (update) => {
      io.emit('process-change', update.data);
    });
    
    realTimeUpdateEngine.on('update:system-resources', (update) => {
      io.emit('system-resources', update.data);
    });
    
    // Start the real-time update engine
    await realTimeUpdateEngine.start();
    console.log('✅ Real-time update engine started');
    
  } catch (error) {
    console.error('❌ Failed to start real-time update engine:', error);
  }
}

async function initializeContextAwareMonitor() {
  try {
    const ContextAwareMonitor = require('../services/context-aware-monitor');
    contextAwareMonitor = new ContextAwareMonitor();
    
    // Set up event handlers
    contextAwareMonitor.on('prompt-detected', (prompt) => {
      console.log(`💬 Prompt detected: ${prompt.content.substring(0, 50)}...`);
      io.emit('prompt-detected', prompt);
    });
    
    contextAwareMonitor.on('file-change-with-context', (change) => {
      console.log(`File change with context: ${path.basename(change.filePath)}`);
      io.emit('file-change-with-context', change);
    });
    
    contextAwareMonitor.on('prompt-file-linked', (link) => {
      console.log(`🔗 Prompt-file link created: ${link.promptId} -> ${path.basename(link.filePath)}`);
      io.emit('prompt-file-linked', link);
    });
    
    contextAwareMonitor.on('context-added', (context) => {
      console.log(`Context added for ${path.basename(context.filePath)}: ${context.contextType}`);
      io.emit('context-added', context);
    });
    
    contextAwareMonitor.on('explicit-prompt-file-link', (link) => {
      console.log(`🔗 Explicit prompt-file link: ${link.promptId} -> ${path.basename(link.filePath)}`);
      io.emit('explicit-prompt-file-link', link);
    });
    
    // Start the context-aware monitor
    await contextAwareMonitor.start();
    console.log('✅ Context-aware monitor started');
    
  } catch (error) {
    console.error('❌ Failed to start context-aware monitor:', error);
  }
}

// Program slicing service
let programSlicingService = null;
let enhancedSlicingInsights = null;
let conversationTracker = null;
let liveConversationMonitor = null;

async function initializeProgramSlicing() {
  try {
    programSlicingService = new ProgramSlicingService({
      tempDir: './temp/slicing-analysis',
      enableAST: true,
      enableSemantic: true,
      enableLLVM: false // Disabled due to compatibility issues
    });
    
    console.log('✅ Program slicing service initialized');
    
    // Initialize enhanced insights service
    enhancedSlicingInsights = new EnhancedSlicingInsights(programSlicingService);
    console.log('✅ Enhanced slicing insights service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize program slicing service:', error);
  }
}

async function initializeConversationTracker() {
  try {
    conversationTracker = new ConversationTracker();
    console.log('✅ Conversation tracker initialized');
  } catch (error) {
    console.error('❌ Failed to initialize conversation tracker:', error);
  }
}

async function initializeLiveConversationMonitor() {
  try {
    liveConversationMonitor = new LiveConversationMonitor();
    liveConversationMonitor.startMonitoring();
    console.log('✅ Live conversation monitor initialized and started');
  } catch (error) {
    console.error('❌ Failed to initialize live conversation monitor:', error);
  }
}

// Initialize optimization manager
async function initializeOptimizationManager() {
  try {
    optimizationManager = new OptimizationManager({
      storageDir: path.join(process.cwd(), '.optimizations'),
      enableAllOptimizations: true
    });
    
    await optimizationManager.initialize();
    
    // Setup optimization event handlers
    optimizationManager.on('memory-warning', (data) => {
      console.warn('Memory warning:', data);
    });
    
    optimizationManager.on('memory-critical', (data) => {
      console.error('🚨 Memory critical:', data);
    });
    
    optimizationManager.on('emergency-optimization', (data) => {
      console.log('Emergency optimization triggered:', data);
    });
    
    console.log('✅ Optimization manager initialized');
    
  } catch (error) {
    console.error('❌ Optimization manager initialization failed:', error);
  }
}

// Initialize and start monitoring
initializeDataStorage().then(async () => {
  realMonitor.startMonitoring();
  await initializeOptimizationManager();
  await initializeEnhancedMonitoring();
  await initializeRealTimeUpdateEngine();
  await initializeContextAwareMonitor();
  await initializeProgramSlicing();
  await initializeConversationTracker();
  await initializeLiveConversationMonitor();
  await initializeConversationMonitoring();
});

// Middleware
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Security headers middleware
app.use((req, res, next) => {
  // Set Content Security Policy
  res.header('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://d3js.org https://cdn.plot.ly https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "img-src 'self' data: blob: http: https: localhost:*; " +
    "font-src 'self' data: https:; " +
    "connect-src 'self' ws: wss: https: localhost:*; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  
  // Set other security headers
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  next();
});

app.use(express.static(path.join(__dirname)));

// Serve CSS and JS files from root directory
app.use(express.static(path.join(__dirname, '..')));

// Serve kura-dashboard.js specifically
app.get('/src/web-interface/kura-dashboard.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'kura-dashboard.js'));
});

// Favicon routes
app.get('/favicon.ico', (req, res) => {
  // Try to serve favicon.ico if it exists, otherwise serve SVG favicon
  const faviconPath = path.join(__dirname, 'favicon.ico');
  const faviconSvgPath = path.join(__dirname, 'favicon.svg');
  const fs = require('fs');
  
  if (fs.existsSync(faviconPath)) {
    res.sendFile(faviconPath);
  } else if (fs.existsSync(faviconSvgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(faviconSvgPath);
  } else {
    // Return 204 No Content to prevent browser from retrying
    res.status(204).end();
  }
});

app.get('/favicon.svg', (req, res) => {
  const faviconSvgPath = path.join(__dirname, 'favicon.svg');
  const fs = require('fs');
  
  if (fs.existsSync(faviconSvgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(faviconSvgPath);
  } else {
    res.status(404).end();
  }
});

// API Routes
app.get('/api/sessions', async (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Combine and deduplicate
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Sort by timestamp
    uniqueSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ 
      success: true, 
      sessions: uniqueSessions,
      count: uniqueSessions.length
    });
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Conversations endpoint
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await dataStorage.loadConversations();
    
    res.json({ 
      success: true, 
      conversations: conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search sessions endpoint
app.get('/api/sessions/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.json({ success: true, sessions: [], query: '', total: 0 });
    }
    
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    const searchTerm = query.toLowerCase();
    
    const filteredSessions = uniqueSessions.filter(session => {
      return (
        (session.intent && session.intent.toLowerCase().includes(searchTerm)) ||
        (session.currentFile && session.currentFile.toLowerCase().includes(searchTerm)) ||
        (session.outcome && session.outcome.toLowerCase().includes(searchTerm)) ||
        (session.id && session.id.toLowerCase().includes(searchTerm)) ||
        (session.codeDeltas && session.codeDeltas.some(delta => 
          delta.content && delta.content.toLowerCase().includes(searchTerm)
        )) ||
        (session.fileChanges && session.fileChanges.some(change => 
          change.afterSnippet && change.afterSnippet.toLowerCase().includes(searchTerm)
        ))
      );
    });
    
    res.json({ 
      success: true,
      sessions: filteredSessions,
      query: query,
      total: filteredSessions.length
    });
  } catch (error) {
    console.error('Error searching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced Project Organization API Endpoints
app.get('/api/projects', async (req, res) => {
  try {
    // Load enhanced project analyzer
    const EnhancedProjectAnalyzer = require('../services/enhanced-project-analyzer');
    const projectAnalyzer = new EnhancedProjectAnalyzer();
    
    // Analyze all projects
    const analysis = await projectAnalyzer.analyzeAllProjects();
    
    // Get sessions and update projects with session data
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Update projects with session data
    const projectsWithSessions = analysis.projects.map(project => 
      projectAnalyzer.updateProjectWithSessions(project, uniqueSessions)
    );
    
    res.json({
      success: true,
      projects: projectsWithSessions,
      count: projectsWithSessions.length,
      analysis: {
        timestamp: analysis.timestamp,
        totalProjects: analysis.totalProjects,
        totalSessions: analysis.totalSessions
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Combine and deduplicate
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Organize sessions by project
    const projects = organizeSessionsByProject(uniqueSessions);
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    res.json({
      success: true,
      project: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/projects/:projectId/sessions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Combine and deduplicate
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Organize sessions by project
    const projects = organizeSessionsByProject(uniqueSessions);
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    
    // Sort project sessions by timestamp (newest first)
    const projectSessions = project.sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      sessions: projectSessions,
      count: projectSessions.length,
      project: {
        id: project.id,
        name: project.name,
        category: project.category
      }
    });
  } catch (error) {
    console.error('Error fetching project sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced Monitoring API Endpoints
app.get('/api/monitoring/status', (req, res) => {
  try {
    if (!enhancedMonitoringService) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced monitoring service not initialized' 
      });
    }
    
    const status = enhancedMonitoringService.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/monitoring/stats', (req, res) => {
  try {
    if (!enhancedMonitoringService) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced monitoring service not initialized' 
      });
    }
    
    const stats = enhancedMonitoringService.getStats();
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting monitoring stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/monitoring/start', async (req, res) => {
  try {
    if (!enhancedMonitoringService) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced monitoring service not initialized' 
      });
    }
    
    await enhancedMonitoringService.start();
    res.json({
      success: true,
      message: 'Enhanced monitoring service started'
    });
  } catch (error) {
    console.error('Error starting monitoring service:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/monitoring/stop', async (req, res) => {
  try {
    if (!enhancedMonitoringService) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced monitoring service not initialized' 
      });
    }
    
    await enhancedMonitoringService.stop();
    res.json({
      success: true,
      message: 'Enhanced monitoring service stopped'
    });
  } catch (error) {
    console.error('Error stopping monitoring service:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Open project in Cursor
app.post('/api/project/open', async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ success: false, error: 'Project path is required' });
    }
    
    // Use AppleScript to open the project in Cursor
    const openScript = `tell application "Cursor" to open POSIX file "${projectPath}"`;
    await AppleScriptService.executeScript(openScript);
    
    res.json({
      success: true,
      message: 'Project opened in Cursor',
      path: projectPath
    });
  } catch (error) {
    console.error('Error opening project in Cursor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/session/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    const conversations = await dataStorage.getConversationsForSession(sessionId);
    let fileChanges = [];
    let annotations = [];
    
    try {
      fileChanges = await dataStorage.getFileChangesForSession(sessionId);
    } catch (error) {
      console.warn(`Failed to load file changes for session ${sessionId}:`, error.message);
    }
    
    try {
      annotations = await dataStorage.getAnnotationsForSession(sessionId);
    } catch (error) {
      console.warn(`Failed to load annotations for session ${sessionId}:`, error.message);
    }
    
    res.json({
      success: true,
      session: {
        ...session,
        conversations,
        fileChanges,
        annotations
      }
    });
  } catch (error) {
    console.error('Error getting session details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Program slicing analysis for session
app.get('/api/session/:id/slicing', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    if (!programSlicingService) {
      return res.status(503).json({ 
        success: false, 
        error: 'Program slicing service not available' 
      });
    }
    
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Perform program slicing analysis
    const slicingAnalysis = await programSlicingService.analyzeSession(sessionId, session);
    
    res.json({
      success: true,
      slicing: slicingAnalysis
    });
    
  } catch (error) {
    console.error('Error performing program slicing analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced insights endpoint
app.get('/api/session/:id/insights', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    if (!enhancedSlicingInsights) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced insights service not available' 
      });
    }

    // Get session data
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // Perform enhanced insights analysis
    const insights = await enhancedSlicingInsights.analyzeForDashboardImprovements(session);
    
    res.json({
      success: true,
      insights: insights
    });
    
  } catch (error) {
    console.error('Error in enhanced insights analysis:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Dashboard recommendations endpoint
app.get('/api/dashboard/recommendations', async (req, res) => {
  try {
    if (!enhancedSlicingInsights) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced insights service not available' 
      });
    }

    // Get recent sessions for analysis
    const sessions = (await dataStorage.loadSessions()).slice(0, 10); // Last 10 sessions
    const allInsights = [];

    for (const session of sessions) {
      try {
        const insights = await enhancedSlicingInsights.analyzeForDashboardImprovements(session);
        allInsights.push(insights);
      } catch (error) {
        console.error(`Error analyzing session ${session.id}:`, error);
      }
    }

    // Generate overall recommendations
    const recommendations = enhancedSlicingInsights.generateDashboardRecommendations({
      memoryCandidates: allInsights.flatMap(i => i.memoryCandidates || []),
      workflowInsights: allInsights.flatMap(i => i.workflowInsights || []),
      performanceInsights: allInsights.flatMap(i => i.performanceInsights || [])
    });
    
    res.json({
      success: true,
      recommendations: recommendations,
      totalSessionsAnalyzed: sessions.length,
      totalInsights: allInsights.length
    });
    
  } catch (error) {
    console.error('Error generating dashboard recommendations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Conversation tracking endpoints
app.get('/api/conversations/live', async (req, res) => {
  try {
    if (!conversationTracker) {
      return res.status(503).json({ 
        success: false, 
        error: 'Conversation tracker not available' 
      });
    }

    const conversations = conversationTracker.getAllConversations();
    const stats = conversationTracker.getStats();
    
    res.json({
      success: true,
      conversations: conversations,
      stats: stats,
      total: conversations.length
    });
  } catch (error) {
    console.error('Error getting live conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/conversations/capture', async (req, res) => {
  try {
    if (!conversationTracker) {
      return res.status(503).json({ 
        success: false, 
        error: 'Conversation tracker not available' 
      });
    }

    const { content, role = 'user', metadata = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content is required' 
      });
    }

    const conversation = conversationTracker.captureConversation(content, role, metadata);
    
    res.json({
      success: true,
      conversation: conversation,
      message: 'Conversation captured successfully'
    });
  } catch (error) {
    console.error('Error capturing conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/conversations/stats', async (req, res) => {
  try {
    if (!conversationTracker) {
      return res.status(503).json({ 
        success: false, 
        error: 'Conversation tracker not available' 
      });
    }

    const stats = conversationTracker.getStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting conversation stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Live conversation monitor endpoints
app.get('/api/conversations/monitor', async (req, res) => {
  try {
    if (!liveConversationMonitor) {
      return res.status(503).json({ 
        success: false, 
        error: 'Live conversation monitor not available' 
      });
    }

    const conversations = liveConversationMonitor.getAllConversations();
    const stats = liveConversationMonitor.getStats();
    
    res.json({
      success: true,
      conversations: conversations,
      stats: stats,
      total: conversations.length
    });
  } catch (error) {
    console.error('Error getting monitored conversations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/conversations/monitor/stats', async (req, res) => {
  try {
    if (!liveConversationMonitor) {
      return res.status(503).json({ 
        success: false, 
        error: 'Live conversation monitor not available' 
      });
    }

    const stats = liveConversationMonitor.getStats();
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error getting monitor stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Code acceptance/rejection analytics
app.get('/api/conversations/code-analytics', async (req, res) => {
  try {
    if (!conversationTracker) {
      return res.status(503).json({ 
        success: false, 
        error: 'Conversation tracker not available' 
      });
    }

    const conversations = conversationTracker.getAllConversations();
    
    // Analyze code acceptance/rejection patterns
    const analytics = {
      totalInteractions: 0,
      acceptances: 0,
      rejections: 0,
      suggestionInteractions: 0,
      methods: {
        keyboard: 0,
        gui: 0,
        suggestion: 0
      },
      actions: {
        'Command+N': 0,
        'Command+Y': 0,
        'Tab': 0,
        'Escape': 0,
        'click': 0,
        'Enter': 0
      },
      languages: {},
      timePatterns: {},
      recentActivity: []
    };

    conversations.forEach(conv => {
      if (conv.metadata?.source === 'cursor_interaction') {
        analytics.totalInteractions++;
        
        const captureType = conv.metadata.captureType;
        const method = conv.metadata.method;
        const action = conv.metadata.action;
        
        if (captureType === 'code_acceptance') {
          analytics.acceptances++;
        } else if (captureType === 'code_rejection') {
          analytics.rejections++;
        } else if (captureType === 'suggestion_interaction') {
          analytics.suggestionInteractions++;
        }
        
        if (method) {
          analytics.methods[method] = (analytics.methods[method] || 0) + 1;
        }
        
        if (action) {
          analytics.actions[action] = (analytics.actions[action] || 0) + 1;
        }
        
        // Language analysis
        if (conv.codeBlocks && conv.codeBlocks.length > 0) {
          const language = conv.codeBlocks[0].language;
          analytics.languages[language] = (analytics.languages[language] || 0) + 1;
        }
        
        // Time pattern analysis
        const hour = new Date(conv.timestamp).getHours();
        analytics.timePatterns[hour] = (analytics.timePatterns[hour] || 0) + 1;
        
        // Recent activity (last 10)
        if (analytics.recentActivity.length < 10) {
          analytics.recentActivity.push({
            timestamp: conv.timestamp,
            type: captureType,
            method: method,
            action: action,
            content: conv.content
          });
        }
      }
    });

    // Calculate acceptance rate
    const totalDecisions = analytics.acceptances + analytics.rejections;
    analytics.acceptanceRate = totalDecisions > 0 ? (analytics.acceptances / totalDecisions * 100).toFixed(2) : 0;
    
    // Sort recent activity by timestamp
    analytics.recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      analytics: analytics
    });
  } catch (error) {
    console.error('Error getting code analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Auto-create memories from session insights
app.post('/api/session/:id/auto-create-memories', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    if (!enhancedSlicingInsights) {
      return res.status(503).json({ 
        success: false, 
        error: 'Enhanced insights service not available' 
      });
    }

    // Get session data
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // Get insights for the session
    const insights = await enhancedSlicingInsights.analyzeForDashboardImprovements(session);
    
    // Auto-create memories from detected patterns
    const createdMemories = await enhancedSlicingInsights.autoCreateMemoriesFromPatterns(insights);
    
    res.json({
      success: true,
      createdMemories: createdMemories,
      totalCreated: createdMemories.length,
      memoryCandidates: insights.memoryCandidates.length,
      message: `Successfully created ${createdMemories.length} memories from detected patterns`
    });
    
  } catch (error) {
    console.error('Error auto-creating memories:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Enhanced session details with OpenClio and Kura analysis
app.post('/api/session/:id/enhanced', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { include_openclio, include_kura, include_procedural_insights } = req.body;
    
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Get basic session data
    const conversations = await dataStorage.getConversationsForSession(sessionId);
    let fileChanges = [];
    let annotations = [];
    
    try {
      fileChanges = await dataStorage.getFileChangesForSession(sessionId);
    } catch (error) {
      console.warn(`Failed to load file changes for session ${sessionId}:`, error.message);
    }
    
    try {
      annotations = await dataStorage.getAnnotationsForSession(sessionId);
    } catch (error) {
      console.warn(`Failed to load annotations for session ${sessionId}:`, error.message);
    }
    
    const enhancedSession = {
      ...session,
      conversations,
      fileChanges,
      annotations
    };
    
    // Add OpenClio analysis if requested
    if (include_openclio) {
      enhancedSession.openclio_analysis = await generateOpenClioAnalysis(session, conversations);
    }
    
    // Add Kura analysis if requested
    if (include_kura) {
      enhancedSession.kura_analysis = await generateKuraAnalysis(session, conversations);
    }
    
    // Add procedural insights if requested
    if (include_procedural_insights) {
      enhancedSession.procedural_insights = await generateProceduralInsights(session, conversations, fileChanges);
    }
    
    res.json({
      success: true,
      session: enhancedSession
    });
  } catch (error) {
    console.error('Error getting enhanced session details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/session/:id/annotation', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { content } = req.body;
    
    const annotation = {
      id: 'annotation-' + Date.now(),
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
      content: content,
      tags: []
    };
    
    await dataStorage.saveAnnotation(annotation);
    
    res.json({ success: true, annotation });
  } catch (error) {
    console.error('Error adding annotation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Memory API Integration
const { MemoryAPI } = require('./enhanced-memory-api');
const memoryAPI = new MemoryAPI();

// Setup memory API routes
memoryAPI.setupRoutes(app);

// Notebook Generation API Integration
const { NotebookGenerator } = require('../services/notebook-generator');
const { FileBasedIntegration } = require('../services/file-based-integration');

const notebookGenerator = new NotebookGenerator();
const fileBasedIntegration = new FileBasedIntegration();

// Notebook generation endpoints
app.post('/api/session/:id/generate-notebook', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const options = req.body;
    
    console.log(`Notebook generation requested for session: ${sessionId}`);
    
    // Load session data first
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: 'Session not found'
      });
    }
    
    const result = await notebookGenerator.generateNotebook(sessionId, session, options);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Notebook generated successfully',
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to generate notebook'
      });
    }
  } catch (error) {
    console.error('Notebook generation API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Notebook download endpoint
app.get('/api/download/notebook/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(process.cwd(), 'generated-notebooks', filename);
    
    // Check if file exists
    try {
      fs.accessSync(filepath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'Notebook file not found'
      });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Read and send file content
    const fileContent = fs.readFileSync(filepath, 'utf8');
    res.send(fileContent);
  } catch (error) {
    console.error('Notebook download error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// File-based integration endpoints
app.post('/api/session/:id/create-session-file', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const options = req.body;
    
    console.log(`Session file creation requested for session: ${sessionId}`);
    
    const result = await fileBasedIntegration.createCursorSessionFile(sessionId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Cursor session file created successfully',
        sessionFile: result,
        downloadUrl: `/api/download/session/${result.filename}`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to create session file'
      });
    }
  } catch (error) {
    console.error('Session file creation API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Comprehensive integration package endpoint
app.post('/api/session/:id/create-integration-package', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const options = req.body;
    
    console.log(`Integration package creation requested for session: ${sessionId}`);
    
    // Load session data first
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        message: 'Session not found'
      });
    }
    
    const result = await fileBasedIntegration.createIntegrationPackage(sessionId, session);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Integration package created successfully',
        package: result.package,
        sessionFile: result.sessionFile,
        notebook: result.notebook
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Failed to create integration package'
      });
    }
  } catch (error) {
    console.error('Integration package creation API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// File download endpoints
app.get('/api/download/notebook/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(notebookGenerator.options.outputDir, filename);
    
    if (await fs.access(filepath).then(() => true).catch(() => false)) {
      res.download(filepath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Notebook download error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/session/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(fileBasedIntegration.options.sessionFilesDir, filename);
    
    if (await fs.access(filepath).then(() => true).catch(() => false)) {
      res.download(filepath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Session file download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy return-to-context endpoint (now uses dynamic integration)
app.post('/api/session/:id/return-to-context', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    console.log('INFO: Return to context requested for session:', sessionId);
    console.log('Using dynamic integration instead of AppleScript');
    
    // Use dynamic integration instead of AppleScript
    const integrationResult = await memoryAPI.dynamicIntegration.integrateSession(sessionId, req.body);
    
    if (integrationResult.success) {
      console.log('SUCCESS: Session context restored using dynamic integration');
      console.log('   - Method:', integrationResult.strategy);
      res.json({
        success: true,
        message: 'Session context restored using dynamic integration',
        method: integrationResult.strategy,
        integration: integrationResult.result,
        executionTime: integrationResult.executionTime,
        qualityMetrics: integrationResult.qualityMetrics
      });
    } else {
      console.log('WARNING: Dynamic integration failed:', integrationResult.error);
      res.status(500).json({
        success: false,
        error: integrationResult.error,
        message: 'Dynamic integration failed. Try generating a notebook instead.',
        alternatives: [
          {
            action: 'generate-notebook',
            description: 'Generate executable notebook from session',
            endpoint: `/api/session/${sessionId}/generate-notebook`
          },
          {
            action: 'create-memory',
            description: 'Create memory from session patterns',
            endpoint: `/api/session/${sessionId}/create-memory`
          }
        ]
      });
    }
  } catch (error) {
    console.error('Error in enhanced return to context:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Context restoration failed. Use alternative methods.',
      alternatives: [
        {
          action: 'generate-notebook',
          description: 'Generate executable notebook from session',
          endpoint: `/api/session/${req.params.id}/generate-notebook`
        },
        {
          action: 'create-memory',
          description: 'Create memory from session patterns',
          endpoint: `/api/session/${req.params.id}/create-memory`
        }
      ]
    });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dataStorage.getStats();
    const activeSessions = realMonitor.getActiveSessions();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        activeSessions: activeSessions.length,
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get live durations for all active sessions
app.get('/api/sessions/live-durations', (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const liveDurations = {};
    
    activeSessions.forEach(session => {
      const duration = realMonitor.getLiveDuration(session.id);
      liveDurations[session.id] = {
        duration: duration,
        formatted: realMonitor.formatDuration(duration),
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: !session.endTime
      };
    });
    
    res.json({
      success: true,
      durations: liveDurations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting live durations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get visualizations from a notebook session
app.get('/api/session/:id/visualizations', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Get session from active sessions or storage
    const session = realMonitor.getSession(sessionId) || await dataStorage.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }

    // Check if session has a notebook file
    if (!session.currentFile || !session.currentFile.endsWith('.ipynb')) {
      return res.json({
        success: true,
        visualizations: [],
        message: 'Session does not contain a notebook file'
      });
    }

    console.log('INFO: Extracting visualizations for session:', sessionId);
    console.log('   - File:', session.currentFile);

    // Extract visualizations from the notebook
    const result = await AppleScriptService.extractNotebookVisualizations(session.currentFile);
    
    if (result.error) {
      console.log('WARNING: Failed to extract visualizations:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    console.log('SUCCESS: Extracted', result.total, 'visualizations');
    res.json({
      success: true,
      visualizations: result.visualizations,
      total: result.total,
      file: result.file,
      lastModified: result.lastModified,
      session: {
        id: session.id,
        file: session.currentFile,
        timestamp: session.timestamp
      }
    });
  } catch (error) {
    console.error('Error extracting visualizations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all visualizations from all notebook sessions
app.get('/api/visualizations', async (req, res) => {
  try {
    const allSessions = [
      ...realMonitor.getActiveSessions(),
      ...(await dataStorage.loadSessions())
    ];

    // Filter for notebook sessions and deduplicate
    const notebookSessions = allSessions
      .filter(session => session.currentFile && session.currentFile.endsWith('.ipynb'))
      .reduce((unique, session) => {
        const existing = unique.find(s => s.currentFile === session.currentFile);
        if (!existing || new Date(session.timestamp) > new Date(existing.timestamp)) {
          return [...unique.filter(s => s.currentFile !== session.currentFile), session];
        }
        return unique;
      }, []);

    const allVisualizations = [];
    
    for (const session of notebookSessions) {
      try {
        const result = await AppleScriptService.extractNotebookVisualizations(session.currentFile);
        if (result.visualizations && result.visualizations.length > 0) {
          allVisualizations.push({
            sessionId: session.id,
            file: session.currentFile,
            timestamp: session.timestamp,
            visualizations: result.visualizations,
            total: result.total
          });
        }
      } catch (error) {
        console.log('Skipping visualization extraction for', session.currentFile, ':', error.message);
      }
    }

    console.log('INFO: Found visualizations in', allVisualizations.length, 'notebook sessions');
    res.json({
      success: true,
      sessions: allVisualizations,
      totalSessions: allVisualizations.length,
      totalVisualizations: allVisualizations.reduce((sum, s) => sum + s.total, 0)
    });
  } catch (error) {
    console.error('Error getting all visualizations:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Real Data API Endpoints for Visualizations
app.get('/api/events', async (req, res) => {
  try {
    // Get events from sessions and conversations
    const sessions = await dataStorage.loadSessions();
    const conversations = await dataStorage.loadConversations();
    
    const events = [];
    
    // Convert sessions to events
    sessions.forEach(session => {
      events.push({
        id: `session-${session.id}`,
        timestamp: session.timestamp || session.startTime,
        event_type: 'session_start',
        workspace_id: session.workspaceId || 'default',
        description: `Development session: ${session.id}`,
        duration: session.duration || 0,
        project: session.project || 'Unknown',
        file: session.files?.[0] || 'Unknown',
        language: session.language || 'unknown',
        metadata: {
          sessionId: session.id,
          codeDeltas: session.codeDeltas?.length || 0,
          fileChanges: session.fileChanges?.length || 0,
          conversations: session.conversations?.length || 0
        }
      });
      
      // Add code delta events
      if (session.codeDeltas) {
        session.codeDeltas.forEach((delta, index) => {
          events.push({
            id: `delta-${session.id}-${index}`,
            timestamp: delta.timestamp || session.timestamp,
            event_type: 'code_change',
            workspace_id: session.workspaceId || 'default',
            description: `Code change in ${delta.file || 'unknown file'}`,
            duration: 0,
            project: session.project || 'Unknown',
            file: delta.file || 'Unknown',
            language: delta.language || 'unknown',
            metadata: {
              sessionId: session.id,
              deltaIndex: index,
              changeType: delta.type || 'modification',
              content: delta.content?.substring(0, 100) || ''
            }
          });
        });
      }
      
      // Add file change events
      if (session.fileChanges) {
        session.fileChanges.forEach((change, index) => {
          events.push({
            id: `file-${session.id}-${index}`,
            timestamp: change.timestamp || session.timestamp,
            event_type: 'file_change',
            workspace_id: session.workspaceId || 'default',
            description: `File ${change.type || 'modified'}: ${change.file}`,
            duration: 0,
            project: session.project || 'Unknown',
            file: change.file,
            language: change.language || 'unknown',
            metadata: {
              sessionId: session.id,
              changeType: change.type || 'modification',
              fileSize: change.size || 0
            }
          });
        });
      }
    });
    
    // Convert conversations to events
    conversations.forEach(conversation => {
      events.push({
        id: `conv-${conversation.id}`,
        timestamp: conversation.timestamp,
        event_type: 'conversation',
        workspace_id: conversation.workspaceId || 'default',
        description: `Conversation: ${conversation.content?.substring(0, 50)}...`,
        duration: 0,
        project: conversation.project || 'Unknown',
        file: conversation.referencedFiles?.[0] || 'Unknown',
        language: 'conversation',
        metadata: {
          conversationId: conversation.id,
          role: conversation.role,
          sessionId: conversation.sessionId,
          referencedFiles: conversation.referencedFiles || []
        }
      });
    });
    
    // Sort events by timestamp (newest first)
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      events: events.slice(0, 100), // Limit to 100 most recent
      count: events.length
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/embeddings', async (req, res) => {
  try {
    // Query the database for embeddings
    const db = new SimpleDatabase('../../cursor_process_mining.db');
    
    let embeddings = [];
    try {
      embeddings = db.prepare(`
        SELECT 
          id,
          content_hash as session_id,
          embedding,
          metadata
        FROM semantic_embeddings 
        ORDER BY created_at DESC 
        LIMIT 50
      `).all();
    } catch (dbError) {
      console.log('Semantic embeddings table not found, returning empty results');
      embeddings = [];
    }
    
    db.close();
    
    // Parse embedding and metadata JSON
    const parsedEmbeddings = embeddings.map(embedding => {
      let parsedEmbedding = [];
      let parsedMetadata = {};
      
      // Handle Buffer data for embeddings
      if (embedding.embedding) {
        try {
          // If it's already a Buffer, convert to string directly
          const embeddingString = embedding.embedding.toString('utf8');
          parsedEmbedding = JSON.parse(embeddingString);
        } catch (e) {
          console.warn('Failed to parse embedding:', e);
          parsedEmbedding = [];
        }
      }
      
      // Parse metadata
      if (embedding.metadata) {
        try {
          parsedMetadata = JSON.parse(embedding.metadata);
        } catch (e) {
          console.warn('Failed to parse metadata:', e);
          parsedMetadata = {};
        }
      }
      
      return {
        ...embedding,
        embedding: parsedEmbedding,
        metadata: parsedMetadata
      };
    });
    
    res.json({
      success: true,
      embeddings: parsedEmbeddings,
      count: parsedEmbeddings.length
    });
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    // Return empty embeddings array if table doesn't exist
    res.json({
      success: true,
      embeddings: [],
      count: 0,
      message: 'Embeddings table not available'
    });
  }
});

// Analytics API endpoints
app.get('/api/analytics/stage-distribution', async (req, res) => {
  try {
    // Get all sessions
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Load CellStageClassifier
    const CellStageClassifier = require('../web-interface/components/cell-stage-classifier');
    const classifier = new CellStageClassifier();
    
    // Generate stage distribution
    const distribution = classifier.generateStageDistribution(uniqueSessions);
    
    res.json({
      success: true,
      distribution: distribution,
      sessionCount: uniqueSessions.length,
      totalCells: distribution.totalCells
    });
  } catch (error) {
    console.error('Error generating stage distribution:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      distribution: { globalDistribution: {}, totalCells: 0 }
    });
  }
});

// Export API endpoints
app.post('/api/export', async (req, res) => {
  try {
    const options = req.body?.options || {};
    
    // Get all sessions
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Generate export data
    const exportData = await exportService.generateExportData(uniqueSessions, options);
    
    // Save to file
    const result = await exportService.saveExport(exportData);
    
    res.json({
      success: true,
      export: {
        filename: result.filename,
        size: result.size,
        sessionCount: result.sessionCount,
        downloadUrl: `/api/export/download/${result.filename}`
      }
    });
  } catch (error) {
    console.error('Error creating export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export/list', async (req, res) => {
  try {
    const exports = await exportService.getAvailableExports();
    res.json({
      success: true,
      exports: exports.map(exp => ({
        filename: exp.filename,
        size: exp.size,
        created: exp.created,
        modified: exp.modified,
        downloadUrl: `/api/export/download/${exp.filename}`
      }))
    });
  } catch (error) {
    console.error('Error listing exports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(exportService.exportDir, filename);
    
    // Check if file exists
    try {
      await require('fs').promises.access(filePath);
    } catch (error) {
      return res.status(404).json({ success: false, error: 'Export file not found' });
    }
    
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ success: false, error: 'Download failed' });
      }
    });
  } catch (error) {
    console.error('Error downloading export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/export/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const success = await exportService.deleteExport(filename);
    
    if (success) {
      res.json({ success: true, message: 'Export deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Export file not found' });
    }
  } catch (error) {
    console.error('Error deleting export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get conversations for a specific session
app.get('/api/session/:id/conversations', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const conversations = await dataStorage.getConversationsForSession(sessionId);
    res.json({ success: true, conversations, count: conversations.length });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all conversations
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await dataStorage.getAllConversations();
    res.json({ success: true, conversations, count: conversations.length });
  } catch (error) {
    console.error('Error getting all conversations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Comprehensive data analysis endpoint for enhanced dashboard with diverse clustering
app.post('/api/sessions/analyze-with-kura', async (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Load all available data for comprehensive analysis
    const conversations = await dataStorage.loadConversations();
    
    // Generate events dynamically (since they're not stored separately)
    const events = [];
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Convert sessions to events
    uniqueSessions.forEach(session => {
      events.push({
        id: `session-${session.id}`,
        timestamp: session.timestamp || session.startTime,
        event_type: 'session_start',
        workspace_id: session.workspaceId || 'default',
        description: `Development session: ${session.id}`,
        duration: session.duration || 0,
        project: session.project || 'Unknown',
        file: session.files?.[0] || 'Unknown',
        language: session.language || 'unknown',
        metadata: {
          sessionId: session.id,
          codeDeltas: session.codeDeltas?.length || 0,
          fileChanges: session.fileChanges?.length || 0,
          conversations: session.conversations?.length || 0
        }
      });
      
      // Add code delta events
      if (session.codeDeltas) {
        session.codeDeltas.forEach((delta, index) => {
          events.push({
            id: `delta-${session.id}-${index}`,
            timestamp: delta.timestamp || session.timestamp,
            event_type: 'code_change',
            workspace_id: session.workspaceId || 'default',
            description: `Code change in ${delta.file || 'unknown file'}`,
            duration: 0,
            project: session.project || 'Unknown',
            file: delta.file || 'Unknown',
            language: delta.language || 'unknown',
            metadata: {
              sessionId: session.id,
              deltaIndex: index,
              changeType: delta.type || 'modification',
              content: delta.content?.substring(0, 100) || ''
            }
          });
        });
      }
      
      // Add file change events
      if (session.fileChanges) {
        session.fileChanges.forEach((change, index) => {
          events.push({
            id: `file-${session.id}-${index}`,
            timestamp: change.timestamp || session.timestamp,
            event_type: 'file_change',
            workspace_id: session.workspaceId || 'default',
            description: `File ${change.type || 'modified'}: ${change.file}`,
            duration: 0,
            project: session.project || 'Unknown',
            file: change.file,
            language: change.language || 'unknown',
            metadata: {
              sessionId: session.id,
              changeType: change.type || 'modification',
              fileSize: change.size || 0
            }
          });
        });
      }
    });
    
    // Convert conversations to events
    conversations.forEach(conversation => {
      events.push({
        id: `conv-${conversation.id}`,
        timestamp: conversation.timestamp,
        event_type: 'conversation',
        workspace_id: conversation.workspaceId || 'default',
        description: `Conversation: ${conversation.content?.substring(0, 50)}...`,
        duration: 0,
        project: conversation.project || 'Unknown',
        file: conversation.referencedFiles?.[0] || 'Unknown',
        language: 'conversation',
        metadata: {
          conversationId: conversation.id,
          role: conversation.role,
          sessionId: conversation.sessionId,
          referencedFiles: conversation.referencedFiles || []
        }
      });
    });
    
    console.log(`Loaded ${conversations.length} conversations, ${events.length} events for comprehensive analysis`);
    
    // Sort by timestamp
    uniqueSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Transform sessions for analysis
    const transformedSessions = uniqueSessions.map(session => ({
      id: session.id,
      intent: session.intent || 'unknown',
      outcome: session.outcome || 'in_progress',
      currentFile: session.currentFile || 'unknown',
      timestamp: session.timestamp,
      confidence: session.confidence || 0.5,
      summary: session.summary || `${session.intent} session on ${session.currentFile ? session.currentFile.split('/').pop() : 'unknown file'}`,
      phase: session.phase || 'IN_PROGRESS',
      duration: session.duration || 0,
      codeDeltas: session.codeDeltas || [],
      fileChanges: session.fileChanges || []
    }));
    
    // Create comprehensive clusters from all data types
    console.log(`Generating comprehensive clusters from ${transformedSessions.length} sessions, ${conversations.length} conversations, ${events.length} events`);
    let clusters = [];
    try {
      const comprehensiveClusters = await generateComprehensiveClusters({
        sessions: transformedSessions,
        conversations: conversations,
        events: events
      });
      
      console.log(`Generated ${comprehensiveClusters.length} comprehensive clusters`);
      clusters = comprehensiveClusters;
    } catch (error) {
      console.error('Error generating comprehensive clusters:', error);
      // Fallback to simple session clustering
      const intentGroups = {};
      transformedSessions.forEach(session => {
        if (!intentGroups[session.intent]) {
          intentGroups[session.intent] = [];
        }
        intentGroups[session.intent].push(session.id);
      });
      
      clusters = Object.entries(intentGroups).map(([intent, sessionIds], index) => {
        const sessionsInCluster = transformedSessions.filter(s => sessionIds.includes(s.id));
        const successCount = sessionsInCluster.filter(s => s.outcome === 'success').length;
        
        return {
          id: `cluster_${intent}_${index}`,
          name: `${intent.charAt(0).toUpperCase() + intent.slice(1)} Tasks`,
          sessions: sessionIds,
          size: sessionIds.length,
          success_rate: sessionIds.length > 0 ? successCount / sessionIds.length : 0
        };
      });
    }
    
    // Ensure clusters is always defined
    if (!clusters || clusters.length === 0) {
      clusters = [];
    }
    
    console.log(`Final clusters count: ${clusters.length}`);
    
    // Generate UMAP coordinates based on session characteristics
    const umapCoordinates = transformedSessions.map((session, index) => {
      // Use session characteristics to generate deterministic coordinates
      const intentHash = session.intent ? session.intent.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
      const outcomeHash = session.outcome ? session.outcome.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
      const sessionHash = (intentHash + outcomeHash + index) % 1000;
      
      return {
        session_id: session.id,
        x: Math.cos(sessionHash * 2 * Math.PI / 1000) * (0.3 + (sessionHash % 100) / 200),
        y: Math.sin(sessionHash * 2 * Math.PI / 1000) * (0.3 + (sessionHash % 100) / 200),
        intent: session.intent,
        outcome: session.outcome,
        confidence: session.confidence
      };
    });
    
    // Generate Clio-derived facets for data-exploration sessions
    const clioFacets = {
      data_exploration: {
        intent_classifications: {},
        workflow_patterns: [],
        cluster_assignments: {}
      }
    };

    // Analyze data-exploration sessions for Clio insights
    transformedSessions.forEach(session => {
      if (session.intent === 'data_exploration' || session.intent === 'explore') {
        // Get conversations for this session
        const sessionConversations = conversations.filter(conv => conv.sessionId === session.id);
        // Simulate Clio analysis for data exploration sessions with conversation data
        const clioAnalysis = analyzeDataExplorationSession(session, sessionConversations);
        clioFacets.data_exploration.intent_classifications[session.id] = clioAnalysis;
        
        // Add to workflow patterns
        if (clioAnalysis.workflowPattern) {
          clioFacets.data_exploration.workflow_patterns.push({
            sessionId: session.id,
            pattern: clioAnalysis.workflowPattern,
            confidence: clioAnalysis.confidence
          });
        }
        
        // Add cluster assignment
        clioFacets.data_exploration.cluster_assignments[session.id] = {
          cluster: clioAnalysis.cluster,
          confidence: clioAnalysis.confidence
        };
      }
    });

    res.json({
      success: true,
      sessions: transformedSessions,
      clusters: clusters,
      umap_coordinates: umapCoordinates,
      total_sessions: transformedSessions.length,
      clio_facets: clioFacets,
      analysis_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in Kura analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Procedural analysis endpoint
app.post('/api/sessions/analyze-procedural', async (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    const conversations = await dataStorage.loadConversations();
    
    // Combine and deduplicate sessions
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    console.log(`Analyzing ${uniqueSessions.length} sessions for procedural patterns`);
    
    // Import embeddings-based classifier for procedural analysis
    const EmbeddingsIntentClassifier = require('../intent-classification/embeddings-intent-classifier');
    const embeddingsClassifier = new EmbeddingsIntentClassifier();
    
    // Analyze each session for procedural patterns
    const proceduralAnalyses = [];
    for (const session of uniqueSessions) {
      try {
        const sessionConversations = conversations.filter(c => c.sessionId === session.id);
        const analysis = await embeddingsClassifier.classifyIntent(session, sessionConversations);
        
        if (analysis.procedural_analysis) {
          proceduralAnalyses.push({
            sessionId: session.id,
            session: session,
            procedural_analysis: analysis.procedural_analysis,
            procedural_profile: analysis.procedural_profile,
            procedural_facets: analysis.procedural_facets,
            embeddings: {
              actions: analysis.embeddings.actions,
              procedures: analysis.embeddings.procedures,
              goals: analysis.embeddings.goals
            }
          });
        }
      } catch (error) {
        console.error(`Error analyzing session ${session.id}:`, error);
      }
    }
    
    // Aggregate procedural patterns across all sessions
    const aggregatedPatterns = aggregateProceduralPatterns(proceduralAnalyses);
    
    // Generate procedural clusters
    const proceduralClusters = generateProceduralClusters(proceduralAnalyses);
    
    res.json({
      success: true,
      data: {
        total_sessions: uniqueSessions.length,
        analyzed_sessions: proceduralAnalyses.length,
        procedural_analyses: proceduralAnalyses,
        aggregated_patterns: aggregatedPatterns,
        procedural_clusters: proceduralClusters,
        analysis_timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in procedural analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clio analysis endpoint for enhanced dashboard
app.post('/api/sessions/analyze-with-clio', async (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Load conversations for analysis
    const conversations = await dataStorage.loadConversations();
    console.log(`Loaded ${conversations.length} conversations for Clio analysis`);
    
    // Combine and deduplicate
    const allSessions = [...activeSessions];
    storedSessions.forEach(stored => {
      if (!allSessions.find(s => s.id === stored.id)) {
        allSessions.push(stored);
      }
    });

    if (allSessions.length === 0) {
      return res.json({
        success: true,
        visualizations: [],
        facets: {},
        total_sessions: 0,
        analysis_timestamp: new Date().toISOString()
      });
    }

    // Generate Clio analysis for notebook visualizations
    const clioAnalysis = {
      visualizations: [],
      facets: {
        data_exploration: {
          intent_classifications: {},
          workflow_patterns: [],
          cluster_assignments: {}
        },
        code_analysis: {
          patterns: [],
          complexity_metrics: {},
          refactoring_suggestions: []
        },
        temporal_patterns: {
          session_flows: [],
          productivity_cycles: [],
          collaboration_patterns: []
        }
      },
      total_sessions: allSessions.length,
      analysis_timestamp: new Date().toISOString()
    };

    // Analyze each session for Clio insights
    allSessions.forEach(session => {
      // Get conversations for this session
      const sessionConversations = conversations.filter(conv => conv.sessionId === session.id);
      const sessionAnalysis = analyzeSessionForClio(session, sessionConversations);
      
      // Add to visualizations if it's a notebook-related session
      if (sessionAnalysis.hasNotebookContent) {
        clioAnalysis.visualizations.push({
          sessionId: session.id,
          type: sessionAnalysis.visualizationType,
          content: sessionAnalysis.content,
          confidence: sessionAnalysis.confidence,
          timestamp: session.timestamp
        });
      }

      // Add to facets based on session type
      if (session.intent === 'data_exploration' || session.intent === 'explore') {
        clioAnalysis.facets.data_exploration.intent_classifications[session.id] = sessionAnalysis;
      }
      
      if (sessionAnalysis.codePatterns && sessionAnalysis.codePatterns.length > 0) {
        clioAnalysis.facets.code_analysis.patterns.push({
          sessionId: session.id,
          patterns: sessionAnalysis.codePatterns,
          complexity: sessionAnalysis.complexity
        });
      }
    });

    res.json({
      success: true,
      ...clioAnalysis
    });
  } catch (error) {
    console.error('Error in Clio analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save a new conversation
app.post('/api/conversations', async (req, res) => {
  try {
    const conversation = req.body;
    const result = await dataStorage.saveConversation(conversation);
    
    // IMMEDIATE CAPTURE TRIGGER
    triggerImmediateCapture('conversation', {
      userMessage: conversation.content || conversation.userMessage,
      assistantResponse: conversation.assistantResponse || '',
      filesReferenced: conversation.referencedFiles || [],
      timestamp: conversation.timestamp || new Date().toISOString(),
      conversationId: conversation.id
    });
    
    res.json({ success: true, conversation, result });
  } catch (error) {
    console.error('Error saving conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Capture prompt with code changes
app.post('/api/capture-prompt', async (req, res) => {
  try {
    const { prompt, filePath, codeChanges, sessionId } = req.body;
    
    if (!prompt || !filePath) {
      return res.status(400).json({ 
        success: false, 
        error: 'Prompt and filePath are required' 
      });
    }
    
    const correlationId = `prompt-${Date.now()}`;
    
    // Create prompt event for the event queue
    const promptEvent = {
      type: 'prompt',
      source: 'manual_capture',
      data: {
        content: prompt,
        filePath: filePath,
        sessionId: sessionId || 'manual-session',
        metadata: {
          source: 'manual_capture',
          captureType: 'prompt_with_code'
        }
      },
      sessionId: sessionId || 'manual-session',
      correlationId: correlationId,
      priority: 'high'
    };
    
    // Enqueue the prompt event
    const promptEventId = await eventPipeline.enqueue(promptEvent);
    
    // Create conversation event for storage
    const conversation = {
      id: promptEventId,
      sessionId: sessionId || 'manual-session',
      timestamp: new Date().toISOString(),
      role: 'user',
      content: prompt,
      metadata: {
        source: 'manual_capture',
        filePath: filePath,
        codeChanges: codeChanges || [],
        captureType: 'prompt_with_code',
        eventId: promptEventId
      },
      referencedFiles: [filePath],
      codeBlocks: codeChanges ? codeChanges.map(change => ({
        id: 'change-' + Date.now(),
        language: 'python',
        content: change,
        lineRange: { start: 0, end: 0 }
      })) : []
    };
    
    // Save the conversation
    await dataStorage.saveConversation(conversation);
    
    // If there are code changes, create code execution events
    if (codeChanges && codeChanges.length > 0) {
      for (let i = 0; i < codeChanges.length; i++) {
        const change = codeChanges[i];
        
        const codeEvent = {
          type: 'code_execution',
          source: 'manual_capture',
          data: {
            content: change,
            filePath: filePath,
            sessionId: sessionId || 'manual-session',
            metadata: {
              changeType: 'prompt_generated',
              cellIndex: i,
              isSuggestion: true,
              suggestionStatus: 'accepted'
            }
          },
          sessionId: sessionId || 'manual-session',
          correlationId: correlationId,
          priority: 'medium'
        };
        
        await eventPipeline.enqueue(codeEvent);
      }
    }
    
    console.log('Prompt captured with event queue:', {
      promptEventId: promptEventId,
      prompt: prompt ? prompt.substring(0, 100) + '...' : 'No prompt',
      filePath: filePath,
      codeChanges: codeChanges ? codeChanges.length : 0,
      correlationId: correlationId
    });
    
    res.json({ 
      success: true, 
      conversation,
      eventId: promptEventId,
      correlationId: correlationId,
      message: 'Prompt and code changes captured successfully with event queue'
    });
  } catch (error) {
    console.error('Error capturing prompt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get event queue statistics
app.get('/api/event-queue/stats', (req, res) => {
  try {
    const stats = eventPipeline.getStats();
    const processedEvents = eventPipeline.getProcessedEvents(50);
    const failedEvents = eventPipeline.getFailedEvents();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        processedEvents: processedEvents.length,
        failedEvents: failedEvents.length
      },
      recentProcessedEvents: processedEvents.slice(0, 10),
      failedEvents: failedEvents.slice(0, 5)
    });
  } catch (error) {
    console.error('Error getting event queue stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get events by correlation ID
app.get('/api/event-queue/correlation/:correlationId', (req, res) => {
  try {
    const { correlationId } = req.params;
    const events = eventPipeline.getEventsByCorrelation(correlationId);
    
    res.json({
      success: true,
      correlationId: correlationId,
      events: events,
      count: events.length
    });
  } catch (error) {
    console.error('Error getting correlated events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process existing notebooks endpoint
app.post('/api/process-existing-notebooks', async (req, res) => {
  try {
    console.log('Processing existing notebooks...');
    
    // This would typically scan for existing .ipynb files and process them
    // For now, we'll return a success response
    res.json({
      success: true,
      message: 'Notebooks processed successfully',
      processed: 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing notebooks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    const stats = eventPipeline.getStats();
    const activeSessions = realMonitor.getActiveSessions();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        webServer: 'running',
        eventPipeline: stats.isProcessing ? 'processing' : 'stopped',
        realMonitor: realMonitor.isMonitoring ? 'monitoring' : 'stopped',
        dataStorage: 'connected'
      },
      metrics: {
        activeSessions: activeSessions.length,
        eventPipelineStats: stats,
        uptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Serve the live dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'live-dashboard-clean.html'));
});

// Serve the real-time test page
app.get('/test-realtime', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'test-realtime.html'));
});


// Serve privacy analysis view
app.get('/privacy-analysis', (req, res) => {
  res.sendFile(path.join(__dirname, 'components/privacy-analysis/privacy-analysis.html'));
});


// ============================================================================
// PROCEDURAL PATTERN API ENDPOINTS
// ============================================================================

// Get procedure suggestions for a session
app.get('/api/session/:id/suggestions', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const sessions = await dataStorage.loadSessions();
    const currentSession = sessions.find(s => s.id === sessionId);
    
    if (!currentSession) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Get all patterns (built-in + discovered)
    const allPatterns = await procedureService.identifyPatternsFromSessions(sessions);
    
    // Get suggestions for current context
    const suggestions = procedureService.getSuggestionsForContext(currentSession, allPatterns);
    
    res.json({
      success: true,
      sessionId,
      suggestions,
      totalPatterns: allPatterns.length
    });
  } catch (error) {
    console.error('Error getting procedure suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all available procedure patterns
app.get('/api/procedures/patterns', async (req, res) => {
  try {
    const sessions = await dataStorage.loadSessions();
    const patterns = await procedureService.identifyPatternsFromSessions(sessions);
    
    res.json({
      success: true,
      patterns: patterns.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        successRate: p.successRate,
        avgDuration: p.avgDuration,
        parameters: p.parameters
      })),
      builtInCount: procedureService.builtInPatterns.length,
      discoveredCount: patterns.length - procedureService.builtInPatterns.length
    });
  } catch (error) {
    console.error('Error getting procedure patterns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute a procedure pattern
app.post('/api/procedures/execute', async (req, res) => {
  try {
    const { procedureId, parameters, targetFile } = req.body;
    
    if (!procedureId) {
      return res.status(400).json({ success: false, error: 'Procedure ID is required' });
    }
    
    // Get the pattern
    const sessions = await dataStorage.loadSessions();
    const allPatterns = await procedureService.identifyPatternsFromSessions(sessions);
    const pattern = allPatterns.find(p => p.id === procedureId);
    
    if (!pattern) {
      return res.status(404).json({ success: false, error: 'Procedure pattern not found' });
    }
    
    // Generate executable notebook
    const notebook = procedureService.generateExecutableNotebook(pattern, parameters || {});
    
    // Save notebook to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${pattern.id}-${timestamp}.ipynb`;
    const notebookPath = path.join(__dirname, 'generated-notebooks', filename);
    
    // Ensure directory exists
    const fs = require('fs');
    const generatedDir = path.join(__dirname, 'generated-notebooks');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    
    // Write notebook file
    fs.writeFileSync(notebookPath, JSON.stringify(notebook, null, 2));
    
    console.log(`Generated procedure notebook: ${filename}`);
    console.log(`  - Pattern: ${pattern.name}`);
    console.log(`  - Parameters: ${JSON.stringify(parameters)}`);
    console.log(`  - Cells: ${notebook.cells.length}`);
    
    res.json({
      success: true,
      procedureId,
      patternName: pattern.name,
      generatedNotebook: notebookPath,
      filename,
      cellCount: notebook.cells.length,
      parameters: parameters || {}
    });
  } catch (error) {
    console.error('Error executing procedure:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Open generated notebook in Cursor
app.post('/api/cursor/open-notebook', async (req, res) => {
  try {
    const { notebookPath, openInCursor = true } = req.body;
    
    if (!notebookPath) {
      return res.status(400).json({ success: false, error: 'Notebook path is required' });
    }
    
    if (openInCursor) {
      // Use AppleScript service to open in Cursor
      const success = await AppleScriptService.openFileInCursor(notebookPath);
      
      if (success) {
        res.json({
          success: true,
          message: 'Notebook opened in Cursor IDE',
          notebookPath
        });
      } else {
        res.json({
          success: false,
          error: 'Failed to open notebook in Cursor IDE',
          notebookPath
        });
      }
    } else {
      res.json({
        success: true,
        message: 'Notebook generated successfully',
        notebookPath
      });
    }
  } catch (error) {
    console.error('Error opening notebook in Cursor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get procedure execution history
app.get('/api/procedures/history', async (req, res) => {
  try {
    const fs = require('fs');
    const generatedDir = path.join(__dirname, 'generated-notebooks');
    
    if (!fs.existsSync(generatedDir)) {
      return res.json({ success: true, history: [] });
    }
    
    const files = fs.readdirSync(generatedDir)
      .filter(file => file.endsWith('.ipynb'))
      .map(file => {
        const filePath = path.join(generatedDir, file);
        const stats = fs.statSync(filePath);
        const parts = file.replace('.ipynb', '').split('-');
        const procedureId = parts[0];
        
        return {
          filename: file,
          procedureId,
          createdAt: stats.birthtime,
          size: stats.size,
          path: filePath
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      success: true,
      history: files,
      totalGenerated: files.length
    });
  } catch (error) {
    console.error('Error getting procedure history:', error);
    res.status(500).json({ success: false, error: error.message          });
       }
     });








// Serve static assets
app.use('/assets', express.static(path.join(__dirname, '../../assets')));
app.use('/components', express.static(path.join(__dirname, 'components')));
app.use('/static', express.static(path.join(__dirname, '../../../../')));

// Utility function to deduplicate sessions
function deduplicateSessions(sessions) {
  const seen = new Map();
  const unique = [];
  
  for (const session of sessions) {
    const key = session.currentFile + '_' + session.intent;
    const existing = seen.get(key);
    
    if (!existing || new Date(session.timestamp) > new Date(existing.timestamp)) {
      if (existing) {
        const index = unique.indexOf(existing);
        if (index > -1) unique.splice(index, 1);
      }
      seen.set(key, session);
      unique.push(session);
    }
  }
  
  return unique;
}

// Extract insights from conversation data for facet analysis
function extractConversationInsights(conversations) {
  if (!conversations || conversations.length === 0) {
    return {
      messageCount: 0,
      topics: [],
      intentKeywords: [],
      complexity: 0,
      sentiment: 'neutral',
      hasCodeDiscussion: false,
      hasDataDiscussion: false,
      hasVisualizationDiscussion: false
    };
  }

  const allContent = conversations.map(conv => conv.content || '').join(' ').toLowerCase();
  const topics = [];
  const intentKeywords = [];
  let complexity = 0;
  let sentiment = 'neutral';
  let hasCodeDiscussion = false;
  let hasDataDiscussion = false;
  let hasVisualizationDiscussion = false;

  // Extract topics and intent keywords
  const topicPatterns = {
    'data_analysis': ['data', 'analysis', 'dataset', 'pandas', 'numpy'],
    'visualization': ['plot', 'chart', 'graph', 'matplotlib', 'seaborn', 'plotly'],
    'machine_learning': ['model', 'ml', 'train', 'predict', 'algorithm'],
    'debugging': ['error', 'bug', 'fix', 'debug', 'issue'],
    'optimization': ['optimize', 'performance', 'speed', 'efficient'],
    'documentation': ['document', 'comment', 'explain', 'readme']
  };

  Object.entries(topicPatterns).forEach(([topic, keywords]) => {
    const matches = keywords.filter(keyword => allContent.includes(keyword));
    if (matches.length > 0) {
      topics.push(topic);
      intentKeywords.push(...matches);
      
      // Set specific flags
      if (topic === 'visualization') hasVisualizationDiscussion = true;
      if (topic === 'data_analysis') hasDataDiscussion = true;
      if (topic === 'debugging' || topic === 'optimization') hasCodeDiscussion = true;
    }
  });

  // Calculate complexity based on conversation length and technical terms
  const technicalTerms = ['function', 'class', 'import', 'def', 'return', 'variable', 'array', 'dataframe'];
  const technicalTermCount = technicalTerms.filter(term => allContent.includes(term)).length;
  complexity = Math.min(10, conversations.length + technicalTermCount);

  // Simple sentiment analysis
  const positiveWords = ['good', 'great', 'excellent', 'working', 'success', 'helpful'];
  const negativeWords = ['error', 'problem', 'issue', 'wrong', 'failed', 'broken'];
  const positiveCount = positiveWords.filter(word => allContent.includes(word)).length;
  const negativeCount = negativeWords.filter(word => allContent.includes(word)).length;
  
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';

  return {
    messageCount: conversations.length,
    topics: [...new Set(topics)],
    intentKeywords: [...new Set(intentKeywords)],
    complexity,
    sentiment,
    hasCodeDiscussion,
    hasDataDiscussion,
    hasVisualizationDiscussion
  };
}

// Analyze session for Clio insights
function analyzeSessionForClio(session, conversations = []) {
  const fileName = session.currentFile ? session.currentFile.split('/').pop() : '';
  const codeDeltas = session.codeDeltas || [];
  const fileChanges = session.fileChanges || [];
  
  // Extract conversation insights
  const conversationInsights = extractConversationInsights(conversations);
  
  // Check if this is a notebook-related session
  const hasNotebookContent = fileName.includes('.ipynb') || 
                            fileName.includes('.py') || 
                            session.intent === 'data_exploration' ||
                            session.intent === 'explore';
  
  // Determine visualization type
  let visualizationType = 'general';
  let confidence = 0.5;
  let content = '';
  let codePatterns = [];
  let complexity = 0;
  
  if (hasNotebookContent) {
    // Analyze code deltas for patterns
    codeDeltas.forEach(delta => {
      if (delta.content) {
        const deltaContent = delta.content.toLowerCase();
        
        // Check for visualization patterns
        if (deltaContent.includes('matplotlib') || deltaContent.includes('seaborn') || 
            deltaContent.includes('plotly') || deltaContent.includes('plot')) {
          visualizationType = 'data_visualization';
          confidence = 0.8;
          content = delta.content.substring(0, 200) + '...';
        }
        
        // Check for data analysis patterns
        if (deltaContent.includes('pandas') || deltaContent.includes('numpy') || 
            deltaContent.includes('dataframe') || deltaContent.includes('analysis')) {
          visualizationType = 'data_analysis';
          confidence = 0.7;
          content = delta.content.substring(0, 200) + '...';
        }
        
        // Extract code patterns
        if (deltaContent.includes('import')) {
          codePatterns.push('imports');
        }
        if (deltaContent.includes('def ') || deltaContent.includes('function')) {
          codePatterns.push('functions');
        }
        if (deltaContent.includes('class ')) {
          codePatterns.push('classes');
        }
        if (deltaContent.includes('for ') || deltaContent.includes('while ')) {
          codePatterns.push('loops');
        }
        if (deltaContent.includes('if ') || deltaContent.includes('elif ')) {
          codePatterns.push('conditionals');
        }
        
        // Calculate basic complexity
        const lines = delta.content.split('\n').length;
        const functions = (delta.content.match(/def\s+\w+/g) || []).length;
        const classes = (delta.content.match(/class\s+\w+/g) || []).length;
        complexity += lines + (functions * 2) + (classes * 3);
      }
    });
    
    // Analyze file changes if no code deltas
    if (codeDeltas.length === 0 && fileChanges.length > 0) {
      fileChanges.forEach(change => {
        if (change.afterSnippet) {
          const changeContent = change.afterSnippet.toLowerCase();
          if (changeContent.includes('matplotlib') || changeContent.includes('plot')) {
            visualizationType = 'data_visualization';
            confidence = 0.6;
            content = change.afterSnippet.substring(0, 200) + '...';
          }
        }
      });
    }
  }
  
  return {
    hasNotebookContent,
    visualizationType,
    content,
    confidence,
    codePatterns: [...new Set(codePatterns)], // Remove duplicates
    complexity: Math.max(1, complexity),
    sessionId: session.id,
    timestamp: session.timestamp,
    conversationInsights: conversationInsights
  };
}

// Analyze data exploration session for Clio-derived insights
function analyzeDataExplorationSession(session, conversations = []) {
  const fileName = session.currentFile ? session.currentFile.split('/').pop() : '';
  const codeDeltas = session.codeDeltas || [];
  const fileChanges = session.fileChanges || [];
  
  // Extract conversation insights for enhanced analysis
  const conversationInsights = extractConversationInsights(conversations);
  
  // Analyze file patterns to determine more specific intent
  let classification = 'data_exploration';
  let confidence = 0.8;
  let workflowPattern = 'general_exploration';
  let cluster = 'exploration';
  
  // Analyze based on file name patterns
  if (fileName.includes('viz') || fileName.includes('plot') || fileName.includes('chart')) {
    classification = 'data_visualization';
    workflowPattern = 'visualization_workflow';
    cluster = 'visualization';
    confidence = 0.9;
  } else if (fileName.includes('analysis') || fileName.includes('eda')) {
    classification = 'exploratory_data_analysis';
    workflowPattern = 'eda_workflow';
    cluster = 'analysis';
    confidence = 0.85;
  } else if (fileName.includes('model') || fileName.includes('ml') || fileName.includes('train')) {
    classification = 'model_development';
    workflowPattern = 'ml_workflow';
    cluster = 'modeling';
    confidence = 0.9;
  } else if (fileName.includes('monitoring') || fileName.includes('test')) {
    classification = 'monitoring_analysis';
    workflowPattern = 'monitoring_workflow';
    cluster = 'monitoring';
    confidence = 0.8;
  }
  
  // Analyze code patterns for additional insights
  const hasDataLoading = codeDeltas.some(delta => 
    delta.afterContent && (
      delta.afterContent.includes('pd.read_') ||
      delta.afterContent.includes('load_csv') ||
      delta.afterContent.includes('read_json')
    )
  );
  
  const hasVisualization = codeDeltas.some(delta =>
    delta.afterContent && (
      delta.afterContent.includes('plt.') ||
      delta.afterContent.includes('sns.') ||
      delta.afterContent.includes('plotly')
    )
  );
  
  const hasModeling = codeDeltas.some(delta =>
    delta.afterContent && (
      delta.afterContent.includes('sklearn') ||
      delta.afterContent.includes('fit(') ||
      delta.afterContent.includes('predict(')
    )
  );
  
  // Adjust classification based on code patterns
  if (hasVisualization && classification === 'data_exploration') {
    classification = 'data_visualization';
    workflowPattern = 'visualization_workflow';
    confidence = Math.min(confidence + 0.1, 0.95);
  }
  
  if (hasModeling && classification === 'data_exploration') {
    classification = 'model_development';
    workflowPattern = 'ml_workflow';
    confidence = Math.min(confidence + 0.1, 0.95);
  }
  
  return {
    classification,
    confidence,
    workflowPattern,
    cluster,
    hasDataLoading,
    hasVisualization,
    hasModeling,
    codeComplexity: codeDeltas.length,
    fileComplexity: fileChanges.length,
    conversationInsights: conversationInsights
  };
}

// Privacy Analysis API Endpoints

// Get privacy-transformed workflow data
app.post('/api/privacy/analyze', async (req, res) => {
  try {
    const { config } = req.body;
    
    // Update privacy configuration if provided
    if (config) {
      privacyService.updateConfig(config);
    }
    
    // Get all sessions
    const sessions = await dataStorage.loadSessions();
    
    // Collect workflow data
    const workflows = await privacyService.collectWorkflowData(sessions);
    
    // Apply privacy transformations
    const transformedWorkflows = await privacyService.applyPrivacyTransformations(workflows);
    
    // Measure expressiveness
    const metrics = await privacyService.measureExpressiveness(workflows, transformedWorkflows);
    
    res.json({
      success: true,
      originalWorkflows: workflows,
      transformedWorkflows: transformedWorkflows,
      expressivenessMetrics: metrics,
      privacyConfig: privacyService.privacyConfig
    });
  } catch (error) {
    console.error('Error in privacy analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update privacy configuration
app.post('/api/privacy/config', async (req, res) => {
  try {
    const { config } = req.body;
    privacyService.updateConfig(config);
    
    res.json({
      success: true,
      config: privacyService.privacyConfig
    });
  } catch (error) {
    console.error('Error updating privacy config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Data deletion endpoints
app.delete('/api/privacy/delete-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Delete from main database
    await dataStorage.deleteSession(sessionId);
    
    // Delete from companion service
    try {
      await fetch(`http://localhost:43917/privacy/delete-session/${sessionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.warn('Could not delete from companion service:', error.message);
    }
    
    res.json({ success: true, message: `Session ${sessionId} deleted` });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/privacy/delete-all', async (req, res) => {
  try {
    // Delete from main database
    await dataStorage.deleteAllSessions();
    
    // Delete from companion service
    try {
      await fetch('http://localhost:43917/privacy/delete-all', {
        method: 'DELETE'
      });
    } catch (error) {
      console.warn('Could not delete from companion service:', error.message);
    }
    
    res.json({ success: true, message: 'All data deleted' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/privacy/delete-sensitive', async (req, res) => {
  try {
    const { patterns } = req.body;
    
    if (!patterns || !Array.isArray(patterns)) {
      return res.status(400).json({ success: false, error: 'Patterns array required' });
    }
    
    // Delete from main database
    const deletedCount = await dataStorage.deleteSensitiveData(patterns);
    
    // Delete from companion service
    try {
      const companionResponse = await fetch('http://localhost:43917/privacy/delete-sensitive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patterns })
      });
      const companionResult = await companionResponse.json();
      console.log(`Companion service deleted ${companionResult.deletedCount} items`);
    } catch (error) {
      console.warn('Could not delete from companion service:', error.message);
    }
    
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error deleting sensitive data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get privacy analysis statistics
app.get('/api/privacy/stats', async (req, res) => {
  try {
    const sessions = await dataStorage.loadSessions();
    const workflows = await privacyService.collectWorkflowData(sessions);
    
    // Calculate aggregate statistics
    const stats = {
      totalSessions: sessions.length,
      totalTokens: workflows.reduce((sum, w) => {
        return sum + (w.traces || []).reduce((traceSum, trace) => {
          return traceSum + (trace.tokens ? trace.tokens.length : 0);
        }, 0);
      }, 0),
      privacyViolations: workflows.reduce((sum, w) => {
        return sum + (w.traces || []).reduce((traceSum, trace) => {
          // Count potential privacy violations based on content analysis
          const content = trace.content || '';
          const violations = (content.match(/password|api_key|secret|token/gi) || []).length;
          return traceSum + violations;
        }, 0);
      }, 0),
      avgRedactionRate: privacyService.privacyConfig?.redactionLevel || 0.5,
      avgExpressionScore: workflows.length > 0 ? workflows.reduce((sum, w) => sum + (w.expressivenessScore || 0.5), 0) / workflows.length : 0.5,
      clusterCount: 0
    };
    
    res.json({
      success: true,
      stats: stats,
      privacyConfig: privacyService.privacyConfig
    });
  } catch (error) {
    console.error('Error getting privacy stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export privacy analysis
app.post('/api/privacy/export', async (req, res) => {
  try {
    const { format, options } = req.body;
    
    // Get sessions and perform analysis
    const sessions = await dataStorage.loadSessions();
    const workflows = await privacyService.collectWorkflowData(sessions);
    const transformedWorkflows = await privacyService.applyPrivacyTransformations(workflows);
    const metrics = await privacyService.measureExpressiveness(workflows, transformedWorkflows);
    
    // Create export data
    const exportData = {
      timestamp: new Date().toISOString(),
      privacyConfig: privacyService.privacyConfig,
      workflows: options?.includeWorkflows ? workflows : undefined,
      transformedWorkflows: options?.includeTransformed ? transformedWorkflows : undefined,
      expressivenessMetrics: options?.includeMetrics ? metrics : undefined,
      summary: {
        totalSessions: workflows.length,
        avgExpressionScore: metrics.expressivenessScore,
        privacyBudget: privacyService.privacyConfig.epsilon
      }
    };
    
    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `privacy-analysis-${timestamp}.${format}`;
    
    // Export using existing export service
    const exportPath = await exportService.exportData(exportData, format, filename);
    
    res.json({
      success: true,
      filename: filename,
      path: exportPath,
      size: JSON.stringify(exportData).length
    });
  } catch (error) {
    console.error('Error exporting privacy analysis:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced prompt extraction system
class EnhancedPromptExtractor {
  constructor() {
    this.promptPatterns = [
      // Direct prompt patterns
      { pattern: /(?:prompt|question|ask|request):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'direct_prompt' },
      { pattern: /(?:user|you):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'user_directive' },
      { pattern: /(?:please|can you|help me):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'request' },
      
      // Cursor-specific patterns
      { pattern: /@cursor\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'cursor_directive' },
      { pattern: /@ai\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'ai_directive' },
      { pattern: /@assistant\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'assistant_directive' },
      { pattern: /@composer\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'composer_directive' },
      { pattern: /@chat\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'chat_directive' },
      { pattern: /@edit\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'edit_directive' },
      { pattern: /@generate\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'generate_directive' },
      { pattern: /@refactor\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'refactor_directive' },
      { pattern: /@debug\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'debug_directive' },
      { pattern: /@test\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'test_directive' },
      { pattern: /@explain\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'explain_directive' },
      { pattern: /@optimize\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'optimize_directive' },
      
      // Code comment patterns
      { pattern: /\/\/\s*prompt:\s*(.+?)(?:\n|$)/gi, type: 'code_comment_prompt' },
      { pattern: /#\s*prompt:\s*(.+?)(?:\n|$)/gi, type: 'python_comment_prompt' },
      { pattern: /<!--\s*prompt:\s*(.+?)\s*-->/gi, type: 'html_comment_prompt' },
      
      // Context and file reference patterns
      { pattern: /(?:here's|here is|attached|from)\s+(?:the\s+)?(.+?\.(?:js|ts|py|jsx|tsx|html|css|json|md))\s*[:.]?\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'context_file_reference' },
      { pattern: /(?:file|code|script|function|class)\s+(?:in|from)\s+(.+?\.(?:js|ts|py|jsx|tsx|html|css|json|md))(?:\s*[:.]?\s*(.+?))?(?:\n\n|\n$|$)/gi, type: 'file_context_prompt' },
      { pattern: /(?:add|modify|update|change|fix|implement)\s+(?:error handling|validation|functionality|feature|code)\s+(?:to|in|for)\s+(?:the\s+)?(.+?\.(?:js|ts|py|jsx|tsx|html|css|json|md))(?:\s*[:.]?\s*(.+?))?(?:\n\n|\n$|$)/gi, type: 'code_modification_prompt' },
      
      // Conversation patterns
      { pattern: /Human:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'conversation_human' },
      { pattern: /User:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'conversation_user' },
      { pattern: /Me:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'conversation_me' },
      
      // Task patterns
      { pattern: /Task:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'task_definition' },
      { pattern: /Goal:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'goal_definition' },
      { pattern: /Objective:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'objective_definition' },
      
      // File watching and automation patterns
      { pattern: /File\s+change:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'file_change_prompt' },
      { pattern: /Watch\s+for:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'watch_directive' },
      { pattern: /Monitor:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'monitor_directive' },
      { pattern: /Auto.*?:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'automation_directive' },
      
      // Code generation patterns
      { pattern: /(?:create|generate|write|build|make)\s+(?:a\s+)?(?:function|class|component|script|module|file)\s+(?:to|for|that)\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'code_generation_prompt' },
      { pattern: /(?:implement|add|insert)\s+(?:a\s+)?(?:function|method|feature|capability)\s+(?:that|to|for)\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'implementation_prompt' },
    ];
    
    this.intentPatterns = {
      'data_visualization': ['plot', 'chart', 'graph', 'visualize', 'matplotlib', 'seaborn', 'plotly', 'show'],
      'data_analysis': ['analyze', 'analysis', 'data', 'dataset', 'pandas', 'numpy', 'statistics'],
      'code_implementation': ['implement', 'create', 'build', 'write', 'function', 'class', 'method'],
      'debugging': ['debug', 'error', 'bug', 'fix', 'issue', 'problem', 'troubleshoot'],
      'optimization': ['optimize', 'performance', 'speed', 'efficient', 'improve', 'better'],
      'documentation': ['document', 'comment', 'explain', 'readme', 'docstring', 'help'],
      'testing': ['test', 'testing', 'unit test', 'assert', 'verify', 'check'],
      'refactoring': ['refactor', 'restructure', 'reorganize', 'clean up', 'simplify']
    };
  }

  extractPrompts(content, context = {}) {
    const prompts = [];
    const filePath = context.filePath || '';
    const fileType = this.getFileType(filePath);
    const sessionId = context.sessionId || '';
    
    this.promptPatterns.forEach(({ pattern, type }) => {
      const matches = [...content.matchAll(pattern)];
      matches.forEach(match => {
        const promptContent = match[1]?.trim();
        if (promptContent && promptContent.length > 3) {
          // Extract referenced files from the prompt
          const referencedFiles = this.extractReferencedFiles(promptContent);
          
          // Extract code context if present
          const codeContext = this.extractCodeContext(content, match.index);
          
          prompts.push({
            id: this.generatePromptId(),
            type: type,
            content: promptContent,
            fullMatch: match[0],
            timestamp: new Date().toISOString(),
            context: {
              filePath: filePath,
              fileType: fileType,
              sessionId: sessionId,
              lineNumber: this.getLineNumber(content, match.index),
              intent: this.classifyIntent(promptContent, filePath),
              complexity: this.analyzeComplexity(promptContent),
              isFileWatching: type.includes('file_change') || type.includes('watch') || type.includes('monitor'),
              isAutomation: type.includes('automation') || type.includes('auto'),
              referencedFiles: referencedFiles,
              codeContext: codeContext,
              promptLength: promptContent.length,
              hasFileReference: referencedFiles.length > 0,
              hasCodeContext: codeContext.length > 0
            }
          });
        }
      });
    });
    
    // Sort by relevance and timestamp
    return prompts.sort((a, b) => {
      // Prioritize file-watching and automation prompts
      if (a.context.isFileWatching && !b.context.isFileWatching) return -1;
      if (!a.context.isFileWatching && b.context.isFileWatching) return 1;
      if (a.context.isAutomation && !b.context.isAutomation) return -1;
      if (!a.context.isAutomation && b.context.isAutomation) return 1;
      
      // Prioritize prompts with file references
      if (a.context.hasFileReference && !b.context.hasFileReference) return -1;
      if (!a.context.hasFileReference && b.context.hasFileReference) return 1;
      
      // Then by complexity (higher complexity first)
      return b.context.complexity - a.context.complexity;
    });
  }

  classifyIntent(prompt, context = '') {
    const content = (prompt + ' ' + context).toLowerCase();
    
    let maxScore = 0;
    let detectedIntent = 'general';

    Object.entries(this.intentPatterns).forEach(([intent, keywords]) => {
      const score = keywords.reduce((acc, keyword) => {
        return acc + (content.includes(keyword) ? 1 : 0);
      }, 0);
      
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
      }
    });

    return detectedIntent;
  }

  analyzeComplexity(prompt) {
    const words = prompt.split(/\s+/).length;
    const sentences = prompt.split(/[.!?]+/).length;
    const technicalTerms = ['function', 'class', 'import', 'def', 'return', 'variable', 'array', 'dataframe', 'model', 'algorithm'];
    const technicalTermCount = technicalTerms.filter(term => prompt.toLowerCase().includes(term)).length;
    
    let complexity = 'simple';
    if (words > 50 || sentences > 3 || technicalTermCount > 3) {
      complexity = 'complex';
    } else if (words > 20 || sentences > 2 || technicalTermCount > 1) {
      complexity = 'medium';
    }
    
    return {
      level: complexity,
      wordCount: words,
      sentenceCount: sentences,
      technicalTermCount: technicalTermCount
    };
  }

  /**
   * Extract referenced files from prompt content
   */
  extractReferencedFiles(promptContent) {
    const filePatterns = [
      /([a-zA-Z0-9_\-\.\/]+\.(?:js|ts|py|jsx|tsx|html|css|json|md|yaml|yml|xml|sql|sh|bat|ps1))/gi,
      /(?:file|script|module|component|class|function)\s+([a-zA-Z0-9_\-\.\/]+\.(?:js|ts|py|jsx|tsx|html|css|json|md))/gi,
      /(?:in|from|to|for)\s+([a-zA-Z0-9_\-\.\/]+\.(?:js|ts|py|jsx|tsx|html|css|json|md))/gi
    ];
    
    const referencedFiles = new Set();
    
    filePatterns.forEach(pattern => {
      const matches = [...promptContent.matchAll(pattern)];
      matches.forEach(match => {
        const fileName = match[1] || match[0];
        if (fileName && !fileName.includes(' ')) {
          referencedFiles.add(fileName);
        }
      });
    });
    
    return Array.from(referencedFiles);
  }

  /**
   * Extract code context around the prompt
   */
  extractCodeContext(content, promptIndex) {
    const contextRadius = 200; // characters before and after
    const start = Math.max(0, promptIndex - contextRadius);
    const end = Math.min(content.length, promptIndex + contextRadius);
    const context = content.substring(start, end);
    
    // Look for code blocks, function definitions, etc.
    const codePatterns = [
      /```[\s\S]*?```/g,
      /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g,
      /class\s+\w+\s*\{[\s\S]*?\}/g,
      /def\s+\w+\s*\([^)]*\):[\s\S]*?(?=\n\w|\n$|$)/g
    ];
    
    const codeContext = [];
    codePatterns.forEach(pattern => {
      const matches = [...context.matchAll(pattern)];
      matches.forEach(match => {
        codeContext.push({
          type: 'code_block',
          content: match[0].substring(0, 200) + (match[0].length > 200 ? '...' : ''),
          start: match.index,
          end: match.index + match[0].length
        });
      });
    });
    
    return codeContext;
  }

  /**
   * Get file type from file path
   */
  getFileType(filePath) {
    if (!filePath) return 'unknown';
    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'jsx': 'react',
      'tsx': 'react-typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml'
    };
    return typeMap[ext] || ext || 'unknown';
  }

  /**
   * Get line number from content and index
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Generate unique prompt ID
   */
  generatePromptId() {
    return 'prompt_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize enhanced prompt extractor
const promptExtractor = new EnhancedPromptExtractor();

// Cursor CLI Integration API endpoints
app.post('/api/cursor/check-cli', async (req, res) => {
  try {
    const { path } = req.body;
    const fs = require('fs');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Check if file exists and is executable
    const exists = fs.existsSync(path);
    let executable = false;
    
    if (exists) {
      try {
        // Try to execute the CLI to check if it's working
        await execAsync(`${path} --version`, { timeout: 5000 });
        executable = true;
      } catch (error) {
        // CLI exists but might not be executable or might not have --version flag
        executable = fs.accessSync(path, fs.constants.X_OK) === undefined;
      }
    }

    res.json({ exists, executable, path });
  } catch (error) {
    console.error('Error checking Cursor CLI:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cursor/watch-file', async (req, res) => {
  try {
    const { filePath, patterns, actions, debounceMs, autoAnalyze, autoFormat, autoLint } = req.body;
    
    // Store watch configuration
    if (!global.cursorWatchConfig) {
      global.cursorWatchConfig = new Map();
    }
    
    global.cursorWatchConfig.set(filePath, {
      filePath,
      patterns,
      actions,
      debounceMs,
      autoAnalyze,
      autoFormat,
      autoLint,
      createdAt: new Date().toISOString()
    });

    console.log('File watch configured:', filePath);
    res.json({ success: true, message: 'File watch configured successfully' });
  } catch (error) {
    console.error('Error configuring file watch:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cursor/stop-watch', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (global.cursorWatchConfig && global.cursorWatchConfig.has(filePath)) {
      global.cursorWatchConfig.delete(filePath);
      console.log('File watch stopped:', filePath);
      res.json({ success: true, message: 'File watch stopped successfully' });
    } else {
      res.json({ success: false, message: 'File watch not found' });
    }
  } catch (error) {
    console.error('Error stopping file watch:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cursor/execute', async (req, res) => {
  try {
    const { command, filePath, workingDirectory, arguments: args, timeout } = req.body;
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Build the full command
    let fullCommand = command;
    if (filePath) {
      fullCommand += ` "${filePath}"`;
    }
    if (args && args.length > 0) {
      fullCommand += ` ${args.join(' ')}`;
    }

    // Execute the command
    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd: workingDirectory || process.cwd(),
      timeout: timeout || 30000
    });

    res.json({
      success: true,
      stdout,
      stderr,
      command: fullCommand,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error executing Cursor command:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      command: req.body.command
    });
  }
});

app.post('/api/cursor/auto-watch', async (req, res) => {
  try {
    const { projectPath, fileTypes, actions, debounceMs, recursive, ignorePatterns } = req.body;
    
    // Store auto-watch configuration
    if (!global.cursorAutoWatchConfig) {
      global.cursorAutoWatchConfig = new Map();
    }
    
    global.cursorAutoWatchConfig.set(projectPath, {
      projectPath,
      fileTypes,
      actions,
      debounceMs,
      recursive,
      ignorePatterns,
      createdAt: new Date().toISOString()
    });

    console.log('Auto-watch configured for project:', projectPath);
    res.json({ success: true, message: 'Auto-watch configured successfully' });
  } catch (error) {
    console.error('Error configuring auto-watch:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cursor/status', async (req, res) => {
  try {
    const status = {
      watchConfigs: global.cursorWatchConfig ? Array.from(global.cursorWatchConfig.keys()) : [],
      autoWatchConfigs: global.cursorAutoWatchConfig ? Array.from(global.cursorAutoWatchConfig.keys()) : [],
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error getting Cursor status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize conversation monitoring
async function initializeConversationMonitoring() {
  try {
    // Initialize enhanced conversation monitor
    const EnhancedConversationMonitor = require('../services/enhanced-conversation-monitor');
    conversationMonitor = new EnhancedConversationMonitor();
    
    await conversationMonitor.initialize();
    conversationMonitor.startMonitoring();
    
    // Set up event handlers
    conversationMonitor.on('conversation-detected', async (conversation) => {
      console.log(`New conversation detected from ${conversation.source}`);
      
      // Extract prompts from conversation content
      const extractedPrompts = promptExtractor.extractPrompts(conversation.content || conversation.userMessage || '');
      
      // Enhance conversation with prompt analysis
      const enhancedConversation = {
        ...conversation,
        extractedPrompts: extractedPrompts,
        intent: promptExtractor.classifyIntent(conversation.content || conversation.userMessage || ''),
        complexity: promptExtractor.analyzeComplexity(conversation.content || conversation.userMessage || ''),
        promptCount: extractedPrompts.length
      };
      
      await dataStorage.saveConversation(enhancedConversation);
      
      // Broadcast real-time update
      broadcastUpdate('conversation-detected', enhancedConversation);
      
      // Broadcast enhanced prompt data
      if (extractedPrompts.length > 0) {
        broadcastUpdate('enhanced-prompts-extracted', {
          conversationId: conversation.id,
          prompts: extractedPrompts,
          intent: enhancedConversation.intent,
          complexity: enhancedConversation.complexity
        });
      }
    });
    
    conversationMonitor.on('monitoring-started', () => {
      console.log('✅ Enhanced conversation monitoring started');
    });
    
    conversationMonitor.on('periodic-check', (stats) => {
      broadcastUpdate('conversation-stats', stats);
    });
    
    console.log('✅ Enhanced conversation monitoring with multiple sources initialized');
    
    // Also try the original Cursor DB parser as fallback
    try {
      const { CursorDBParser } = require('../../dist/services/cursor-db-parser');
      const cursorDbParser = new CursorDBParser();
      await cursorDbParser.connect();
      
      console.log('✅ Cursor database parser also initialized');
    } catch (dbError) {
      console.log('Cursor database parser not available:', dbError.message);
    }
    
  } catch (error) {
    console.log('WARNING: Enhanced conversation monitoring initialization failed:', error.message);
    console.log('INFO: Falling back to basic conversation API endpoints');
    console.log('Conversation API endpoints available:');
    console.log('   - POST /api/conversations');
    console.log('   - GET /api/conversations');
    console.log('   - GET /api/session/:id/conversations');
  }
}

// Context-aware monitoring API endpoints
app.post('/api/add-context', (req, res) => {
  try {
    const { filePath, prompt, contextType = 'manual' } = req.body;
    
    if (!filePath || !prompt) {
      return res.status(400).json({ error: 'filePath and prompt are required' });
    }
    
    if (!contextAwareMonitor) {
      return res.status(503).json({ error: 'Context-aware monitor not available' });
    }
    
    const contextId = contextAwareMonitor.addContext(filePath, prompt, contextType);
    
    res.json({
      success: true,
      contextId: contextId,
      message: 'Context added successfully'
    });
  } catch (error) {
    console.error('Error adding context:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/link-prompt-file', (req, res) => {
  try {
    const { promptId, filePath, changeType = 'modification' } = req.body;
    
    if (!promptId || !filePath) {
      return res.status(400).json({ error: 'promptId and filePath are required' });
    }
    
    if (!contextAwareMonitor) {
      return res.status(503).json({ error: 'Context-aware monitor not available' });
    }
    
    const link = contextAwareMonitor.linkPromptToFileChange(promptId, filePath, changeType);
    
    res.json({
      success: true,
      link: link,
      message: 'Prompt-file link created successfully'
    });
  } catch (error) {
    console.error('Error linking prompt to file:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contexts', (req, res) => {
  try {
    if (!contextAwareMonitor) {
      return res.status(503).json({ error: 'Context-aware monitor not available' });
    }
    
    const contexts = contextAwareMonitor.getAllContexts();
    const contextHistory = contextAwareMonitor.getContextHistory();
    const activePrompts = contextAwareMonitor.getActivePrompts();
    
    res.json({
      contexts: contexts,
      contextHistory: contextHistory,
      activePrompts: activePrompts
    });
  } catch (error) {
    console.error('Error getting contexts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced event type classification API endpoint
app.post('/api/classify-event-type', async (req, res) => {
  try {
    const { session, conversations = [] } = req.body;
    
    if (!session) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session data is required' 
      });
    }
    
    // Import the enhanced classifier
    const EnhancedEventTypeClassifier = require('../intent-classification/enhanced-event-type-classifier');
    const classifier = new EnhancedEventTypeClassifier();
    
    // Get enhanced classification
    const classification = await classifier.classifyEventType(session, conversations);
    
    res.json({
      success: true,
      classification,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in enhanced event type classification:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Enhanced prompt extraction API endpoints
app.post('/api/extract-prompts', async (req, res) => {
  try {
    const { content, context } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content is required' 
      });
    }
    
    // Extract prompts using enhanced system
    const extractedPrompts = promptExtractor.extractPrompts(content);
    const intent = promptExtractor.classifyIntent(content, context);
    const complexity = promptExtractor.analyzeComplexity(content);
    
    res.json({
      success: true,
      data: {
        prompts: extractedPrompts,
        intent: intent,
        complexity: complexity,
        promptCount: extractedPrompts.length,
        analysis: {
          hasCodeRequest: /code|function|class|implement|write/.test(content.toLowerCase()),
          hasDataRequest: /data|dataset|analysis|visualize/.test(content.toLowerCase()),
          hasDebugRequest: /debug|error|bug|fix|issue/.test(content.toLowerCase()),
          urgency: /urgent|asap|quickly|immediately/.test(content.toLowerCase()) ? 'high' : 'normal'
        }
      }
    });
  } catch (error) {
    console.error('Error extracting prompts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/prompt-patterns', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        patterns: promptExtractor.promptPatterns.map(p => ({
          type: p.type,
          pattern: p.pattern.toString(),
          description: getPatternDescription(p.type)
        })),
        intentPatterns: promptExtractor.intentPatterns
      }
    });
  } catch (error) {
    console.error('Error getting prompt patterns:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

function getPatternDescription(type) {
  const descriptions = {
    'direct_prompt': 'Direct prompt statements (prompt:, question:, ask:, request:)',
    'user_directive': 'User directive patterns (user:, you:)',
    'request': 'Request patterns (please, can you, help me)',
    'cursor_directive': 'Cursor-specific directives (@cursor)',
    'ai_directive': 'AI assistant directives (@ai)',
    'assistant_directive': 'Assistant directives (@assistant)',
    'code_comment_prompt': 'Code comment prompts (// prompt:)',
    'python_comment_prompt': 'Python comment prompts (# prompt:)',
    'html_comment_prompt': 'HTML comment prompts (<!-- prompt: -->)',
    'conversation_human': 'Human conversation patterns (Human:)',
    'conversation_user': 'User conversation patterns (User:)',
    'conversation_me': 'First-person conversation patterns (Me:)',
    'task_definition': 'Task definition patterns (Task:)',
    'goal_definition': 'Goal definition patterns (Goal:)',
    'objective_definition': 'Objective definition patterns (Objective:)'
  };
  return descriptions[type] || 'Unknown pattern type';
}

// Optimization API endpoints
app.get('/api/optimization/stats', async (req, res) => {
  try {
    if (!optimizationManager) {
      return res.status(503).json({ error: 'Optimization manager not available' });
    }
    
    const stats = optimizationManager.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/optimization/optimize', async (req, res) => {
  try {
    if (!optimizationManager) {
      return res.status(503).json({ error: 'Optimization manager not available' });
    }
    
    const optimizations = await optimizationManager.optimize();
    res.json({ success: true, optimizations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/optimization/services', async (req, res) => {
  try {
    if (!optimizationManager) {
      return res.status(503).json({ error: 'Optimization manager not available' });
    }
    
    const services = optimizationManager.getServices();
    const serviceInfo = {};
    
    for (const [name, service] of Object.entries(services)) {
      if (service && typeof service.getStats === 'function') {
        serviceInfo[name] = service.getStats();
      } else {
        serviceInfo[name] = { status: service ? 'active' : 'inactive' };
      }
    }
    
    res.json({ success: true, services: serviceInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
server.listen(port, async () => {
  console.log('PKL Web Server Started');
  console.log('========================');
  console.log(`Dashboard: http://localhost:${port}`);
  console.log(`API: http://localhost:${port}/api/sessions`);
  console.log(`WebSocket: ws://localhost:${port}`);
  console.log(`Optimization: http://localhost:${port}/api/optimization/stats`);
  console.log('Monitoring .ipynb files...');
  
  // Initialize conversation monitoring (moved to avoid duplicate calls)
  // await initializeConversationMonitoring();
  
  console.log('');
});

// Generate OpenClio analysis for a session using embeddings-based classification
async function generateOpenClioAnalysis(session, conversations) {
  try {
    // Import embeddings-based classifier
    const EmbeddingsIntentClassifier = require('../intent-classification/embeddings-intent-classifier');
    const embeddingsClassifier = new EmbeddingsIntentClassifier();
    
    // Get sophisticated intent classification
    const intentAnalysis = await embeddingsClassifier.classifyIntent(session, conversations);
    
    // Generate high-dimensional faceted analysis
    const faceted_analysis = {
      'PrimaryIntent': intentAnalysis.primary_intent,
      'Confidence': intentAnalysis.confidence,
      'ComplexityLevel': intentAnalysis.profile.complexity_level,
      'WorkflowType': intentAnalysis.profile.workflow_type,
      'ExpertiseLevel': intentAnalysis.profile.expertise_level,
      'EmbeddingDimensions': intentAnalysis.embeddings.dimensions,
      'FacetCount': Object.keys(intentAnalysis.facets).length
    };
    
    // Generate workflow patterns based on embeddings analysis
    const workflow_patterns = intentAnalysis.profile.characteristics.map(char => ({
      name: `${char.facet.replace(/_/g, ' ').toUpperCase()} Pattern`,
      confidence: char.confidence,
      description: `High-dimensional analysis indicates ${char.dimension} approach with ${(char.confidence * 100).toFixed(1)}% confidence`,
      dimension: char.dimension,
      weight: char.weight
    }));
    
    // Generate multi-dimensional intent classifications
    const intent_classifications = {};
    Object.entries(intentAnalysis.facets).forEach(([facetName, facet]) => {
      Object.entries(facet.scores).forEach(([dimension, score]) => {
        const key = `${facetName}_${dimension}`;
        intent_classifications[key] = score;
      });
    });
    
    return {
      faceted_analysis,
      workflow_patterns,
      intent_classifications,
      embeddings_analysis: intentAnalysis,
      analysis_timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating OpenClio analysis:', error);
    return null;
  }
}

// Generate Kura analysis for a session using embeddings-based classification with procedural clustering
async function generateKuraAnalysis(session, conversations) {
  try {
    // Import embeddings-based classifier
    const EmbeddingsIntentClassifier = require('../intent-classification/embeddings-intent-classifier');
    const embeddingsClassifier = new EmbeddingsIntentClassifier();
    
    // Get sophisticated intent analysis with procedural clustering
    const intentAnalysis = await embeddingsClassifier.classifyIntent(session, conversations);
    
    // Enhanced conversation analysis using embeddings
    const conversation_analysis = {
      message_count: conversations.length,
      avg_response_time: conversations.length > 0 ? 
        `${Math.floor(conversations.reduce((sum, c) => sum + (c.responseTime || 0), 0) / conversations.length)}s` : '0s',
      complexity_score: intentAnalysis.profile.complexity_level,
      sentiment_analysis: conversations.length > 0 ? 'positive' : 'neutral',
      topic_coherence: intentAnalysis.confidence,
      embedding_similarity: calculateConversationSimilarity(conversations),
      semantic_density: calculateSemanticDensity(intentAnalysis.embeddings.conversation)
    };
    
    // NEW: Procedural analysis
    const procedural_analysis = {
      actions: intentAnalysis.procedural_analysis?.actions || [],
      sequences: intentAnalysis.procedural_analysis?.sequences || [],
      goals: intentAnalysis.procedural_analysis?.goals || [],
      action_embeddings: intentAnalysis.embeddings?.actions || [],
      procedure_embeddings: intentAnalysis.embeddings?.procedures || [],
      goal_embeddings: intentAnalysis.embeddings?.goals || [],
      procedural_profile: intentAnalysis.procedural_profile || {},
      procedural_facets: intentAnalysis.procedural_facets || {}
    };
    
    // Generate cluster assignment based on embeddings and procedural patterns
    const cluster_assignment = {
      cluster_id: `cluster_${intentAnalysis.primary_intent}_${Math.floor(intentAnalysis.confidence * 10)}`,
      confidence: intentAnalysis.confidence,
      similar_sessions: Math.max(1, Math.floor((session.codeDeltas?.length || 0) / 2) + 1),
      embedding_distance: calculateEmbeddingDistance(intentAnalysis.embeddings.code, intentAnalysis.embeddings.conversation),
      facet_alignment: calculateFacetAlignment(intentAnalysis.facets),
      // NEW: Procedural clustering
      procedural_cluster_id: `proc_${intentAnalysis.procedural_profile?.primary_action_type || 'unknown'}_${Math.floor(intentAnalysis.procedural_profile?.procedural_confidence * 10)}`,
      procedural_confidence: intentAnalysis.procedural_profile?.procedural_confidence || 0,
      action_similarity: calculateActionSimilarity(procedural_analysis.actions),
      sequence_complexity: calculateSequenceComplexity(procedural_analysis.sequences),
      goal_alignment: calculateGoalAlignment(procedural_analysis.goals)
    };
    
    // Generate high-dimensional embedding coordinates including procedural embeddings
    const embedding_coordinates = generateHighDimensionalCoordinates(intentAnalysis.embeddings);
    const procedural_coordinates = generateProceduralCoordinates(procedural_analysis);
    
    return {
      conversation_analysis,
      cluster_assignment,
      embedding_coordinates,
      procedural_coordinates,
      procedural_analysis,
      embeddings_analysis: intentAnalysis,
      analysis_timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating Kura analysis:', error);
    return null;
  }
}

// NEW: Helper functions for procedural analysis
function calculateActionSimilarity(actions) {
  if (!actions || actions.length === 0) return 0;
  
  const actionTypes = actions.map(a => a.action);
  const uniqueTypes = new Set(actionTypes);
  
  // Calculate similarity based on action type diversity
  return uniqueTypes.size / actionTypes.length;
}

function calculateSequenceComplexity(sequences) {
  if (!sequences || sequences.length === 0) return 0;
  
  const complexities = sequences.map(seq => seq.complexity?.complexityScore || 0);
  return complexities.reduce((sum, c) => sum + c, 0) / complexities.length;
}

function calculateGoalAlignment(goals) {
  if (!goals || goals.length === 0) return 0;
  
  const confidences = goals.map(goal => goal.confidence || 0);
  return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
}

function generateProceduralCoordinates(proceduralAnalysis) {
  const { actions, sequences, goals } = proceduralAnalysis;
  
  // Generate 2D coordinates for procedural visualization
  const x = (actions.length * 0.3) + (sequences.length * 0.4) + (goals.length * 0.3);
  const y = calculateSequenceComplexity(sequences) * 100;
  
  return {
    x: Math.min(x, 100),
    y: Math.min(y, 100),
    z: calculateGoalAlignment(goals) * 100,
    metadata: {
      action_count: actions.length,
      sequence_count: sequences.length,
      goal_count: goals.length,
      complexity: calculateSequenceComplexity(sequences),
      alignment: calculateGoalAlignment(goals)
    }
  };
}

// NEW: Helper functions for procedural pattern aggregation
function aggregateProceduralPatterns(proceduralAnalyses) {
  const aggregated = {
    total_actions: 0,
    total_sequences: 0,
    total_goals: 0,
    action_types: {},
    sequence_patterns: {},
    goal_levels: {},
    complexity_distribution: { low: 0, medium: 0, high: 0 },
    temporal_patterns: {},
    workflow_types: {}
  };
  
  proceduralAnalyses.forEach(analysis => {
    const { procedural_analysis, procedural_profile } = analysis;
    
    // Aggregate actions
    aggregated.total_actions += procedural_analysis.actions.length;
    procedural_analysis.actions.forEach(action => {
      aggregated.action_types[action.action] = (aggregated.action_types[action.action] || 0) + 1;
    });
    
    // Aggregate sequences
    aggregated.total_sequences += procedural_analysis.sequences.length;
    procedural_analysis.sequences.forEach(sequence => {
      aggregated.sequence_patterns[sequence.pattern] = (aggregated.sequence_patterns[sequence.pattern] || 0) + 1;
    });
    
    // Aggregate goals
    aggregated.total_goals += procedural_analysis.goals.length;
    procedural_analysis.goals.forEach(goal => {
      aggregated.goal_levels[goal.level] = (aggregated.goal_levels[goal.level] || 0) + 1;
    });
    
    // Aggregate complexity
    const complexity = procedural_profile.complexity_level || 'low';
    aggregated.complexity_distribution[complexity] = (aggregated.complexity_distribution[complexity] || 0) + 1;
    
    // Aggregate workflow types
    const workflowType = procedural_profile.workflow_type || 'unknown';
    aggregated.workflow_types[workflowType] = (aggregated.workflow_types[workflowType] || 0) + 1;
  });
  
  return aggregated;
}

function generateProceduralClusters(proceduralAnalyses) {
  const clusters = {
    by_action_type: {},
    by_sequence_pattern: {},
    by_goal_level: {},
    by_complexity: {},
    by_workflow_type: {}
  };
  
  proceduralAnalyses.forEach(analysis => {
    const { sessionId, procedural_profile, procedural_analysis } = analysis;
    
    // Cluster by primary action type
    const primaryAction = procedural_profile.primary_action_type || 'unknown';
    if (!clusters.by_action_type[primaryAction]) {
      clusters.by_action_type[primaryAction] = [];
    }
    clusters.by_action_type[primaryAction].push(sessionId);
    
    // Cluster by sequence patterns
    procedural_analysis.sequences.forEach(sequence => {
      const pattern = sequence.pattern;
      if (!clusters.by_sequence_pattern[pattern]) {
        clusters.by_sequence_pattern[pattern] = [];
      }
      clusters.by_sequence_pattern[pattern].push(sessionId);
    });
    
    // Cluster by goal level
    const goalLevel = procedural_profile.goal_level || 'unknown';
    if (!clusters.by_goal_level[goalLevel]) {
      clusters.by_goal_level[goalLevel] = [];
    }
    clusters.by_goal_level[goalLevel].push(sessionId);
    
    // Cluster by complexity
    const complexity = procedural_profile.complexity_level || 'low';
    if (!clusters.by_complexity[complexity]) {
      clusters.by_complexity[complexity] = [];
    }
    clusters.by_complexity[complexity].push(sessionId);
    
    // Cluster by workflow type
    const workflowType = procedural_profile.workflow_type || 'unknown';
    if (!clusters.by_workflow_type[workflowType]) {
      clusters.by_workflow_type[workflowType] = [];
    }
    clusters.by_workflow_type[workflowType].push(sessionId);
  });
  
  return clusters;
}

// Helper function to calculate conversation similarity
function calculateConversationSimilarity(conversations) {
  if (conversations.length < 2) return 1.0;
  
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 0; i < conversations.length - 1; i++) {
    for (let j = i + 1; j < conversations.length; j++) {
      const text1 = (conversations[i].userMessage || '') + (conversations[i].assistantResponse || '');
      const text2 = (conversations[j].userMessage || '') + (conversations[j].assistantResponse || '');
      
      // Simple similarity based on common words
      const words1 = text1.toLowerCase().split(/\s+/);
      const words2 = text2.toLowerCase().split(/\s+/);
      const commonWords = words1.filter(word => words2.includes(word));
      const similarity = commonWords.length / Math.max(words1.length, words2.length);
      
      totalSimilarity += similarity;
      comparisons++;
    }
  }
  
  return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
}

// Helper function to calculate semantic density
function calculateSemanticDensity(embeddings) {
  if (!embeddings || embeddings.length === 0) return 0;
  
  // Calculate variance as a measure of semantic density
  const mean = embeddings.reduce((sum, val) => sum + val, 0) / embeddings.length;
  const variance = embeddings.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embeddings.length;
  
  return Math.sqrt(variance);
}

// Helper function to calculate embedding distance
function calculateEmbeddingDistance(embeddings1, embeddings2) {
  if (!embeddings1 || !embeddings2 || embeddings1.length !== embeddings2.length) return 1.0;
  
  let distance = 0;
  for (let i = 0; i < embeddings1.length; i++) {
    distance += Math.pow(embeddings1[i] - embeddings2[i], 2);
  }
  
  return Math.sqrt(distance);
}

// Helper function to calculate facet alignment
function calculateFacetAlignment(facets) {
  if (!facets || Object.keys(facets).length === 0) return 0;
  
  const confidences = Object.values(facets).map(facet => facet.confidence);
  const meanConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  
  // Calculate how aligned the facets are (lower variance = higher alignment)
  const variance = confidences.reduce((sum, conf) => sum + Math.pow(conf - meanConfidence, 2), 0) / confidences.length;
  
  return Math.max(0, 1 - Math.sqrt(variance));
}

// Helper function to generate high-dimensional coordinates
function generateHighDimensionalCoordinates(embeddings) {
  const coordinates = [];
  
  // Generate multiple 2D projections from high-dimensional embeddings
  for (let i = 0; i < 3; i++) {
    const codeEmbedding = embeddings.code || [];
    const conversationEmbedding = embeddings.conversation || [];
    
    // Create projection based on embedding dimensions
    const projectionAngle = (i * 2 * Math.PI) / 3;
    const x = Math.cos(projectionAngle) * (codeEmbedding[0] || 0) + Math.sin(projectionAngle) * (conversationEmbedding[0] || 0);
    const y = Math.sin(projectionAngle) * (codeEmbedding[0] || 0) - Math.cos(projectionAngle) * (conversationEmbedding[0] || 0);
    
    coordinates.push({
      projection: i,
      x: x * 0.5 + 0.5, // Normalize to [0, 1]
      y: y * 0.5 + 0.5, // Normalize to [0, 1]
      dimension: embeddings.dimensions || 512
    });
  }
  
  return coordinates;
}

// Project Organization System
function extractProjectInfo(filePath) {
  if (!filePath) return { project: 'Unknown', category: 'other', subproject: null };
  
  const pathParts = filePath.split('/');
  const homeIndex = pathParts.findIndex(part => part === 'hamidaho');
  
  if (homeIndex === -1) {
    return { project: 'Unknown', category: 'other', subproject: null };
  }
  
  // Extract project information from path structure
  const projectPath = pathParts.slice(homeIndex + 1);
  
  if (projectPath.length === 0) {
    return { project: 'Unknown', category: 'other', subproject: null };
  }
  
  const topLevel = projectPath[0];
  let project = topLevel;
  let category = 'other';
  let subproject = null;
  
  // Categorize projects
  if (topLevel.includes('HF Project') || topLevel.includes('hf')) {
    category = 'machine_learning';
    project = 'Hugging Face Research';
    if (projectPath.length > 1) {
      subproject = projectPath[1];
    }
  } else if (topLevel.includes('cursor_dashboard')) {
    category = 'development_tools';
    project = 'PKL Extension Dashboard';
    if (projectPath.length > 2) {
      subproject = projectPath[2];
    }
  } else if (topLevel.includes('Desktop')) {
    category = 'experiments';
    project = 'Desktop Experiments';
    if (projectPath.length > 1) {
      subproject = projectPath[1];
    }
  } else if (topLevel.includes('updated_notebooks')) {
    category = 'maintenance';
    project = 'Notebook Maintenance';
  } else {
    category = 'other';
    project = topLevel.replace(/_/g, ' ').replace(/-/g, ' ');
  }
  
  return { project, category, subproject };
}

function organizeSessionsByProject(sessions) {
  const projectMap = new Map();
  
  sessions.forEach(session => {
    const projectInfo = extractProjectInfo(session.currentFile);
    const projectKey = `${projectInfo.project}_${projectInfo.category}`;
    
    if (!projectMap.has(projectKey)) {
      projectMap.set(projectKey, {
        id: projectKey,
        name: projectInfo.project,
        category: projectInfo.category,
        subprojects: new Map(),
        sessions: [],
        stats: {
          totalSessions: 0,
          totalDuration: 0,
          lastActivity: null,
          intentDistribution: {},
          outcomeDistribution: {}
        }
      });
    }
    
    const project = projectMap.get(projectKey);
    project.sessions.push(session);
    project.stats.totalSessions++;
    
    // Update duration
    if (session.duration) {
      project.stats.totalDuration += session.duration;
    }
    
    // Update last activity
    const sessionTime = new Date(session.timestamp);
    if (!project.stats.lastActivity || sessionTime > new Date(project.stats.lastActivity)) {
      project.stats.lastActivity = session.timestamp;
    }
    
    // Update intent distribution
    const intent = session.intent || 'unknown';
    project.stats.intentDistribution[intent] = (project.stats.intentDistribution[intent] || 0) + 1;
    
    // Update outcome distribution
    const outcome = session.outcome || 'in_progress';
    project.stats.outcomeDistribution[outcome] = (project.stats.outcomeDistribution[outcome] || 0) + 1;
    
    // Handle subprojects
    if (projectInfo.subproject) {
      if (!project.subprojects.has(projectInfo.subproject)) {
        project.subprojects.set(projectInfo.subproject, {
          name: projectInfo.subproject,
          sessions: [],
          stats: {
            totalSessions: 0,
            totalDuration: 0,
            lastActivity: null
          }
        });
      }
      
      const subproject = project.subprojects.get(projectInfo.subproject);
      subproject.sessions.push(session);
      subproject.stats.totalSessions++;
      
      if (session.duration) {
        subproject.stats.totalDuration += session.duration;
      }
      
      const subSessionTime = new Date(session.timestamp);
      if (!subproject.stats.lastActivity || subSessionTime > new Date(subproject.stats.lastActivity)) {
        subproject.stats.lastActivity = session.timestamp;
      }
    }
  });
  
  // Convert Map to Array and sort by last activity
  return Array.from(projectMap.values())
    .map(project => ({
      ...project,
      subprojects: Array.from(project.subprojects.values())
    }))
    .sort((a, b) => new Date(b.stats.lastActivity) - new Date(a.stats.lastActivity));
}

// Generate procedural insights for a session
async function generateProceduralInsights(session, conversations, fileChanges) {
  try {
    // Generate reusable patterns
    const reusable_patterns = [
      {
        id: `pattern_${session.id}_1`,
        name: 'Data Loading Pattern',
        frequency: Math.max(1, Math.floor((session.codeDeltas?.length || 0) / 3) + 2),
        description: 'Standard pattern for loading and preprocessing data',
        tags: ['data', 'preprocessing', 'pandas']
      },
      {
        id: `pattern_${session.id}_2`,
        name: 'Visualization Pattern',
        frequency: Math.max(1, Math.floor((session.codeDeltas?.length || 0) / 4) + 1),
        description: 'Common visualization workflow with matplotlib/seaborn',
        tags: ['visualization', 'matplotlib', 'seaborn']
      }
    ];
    
    // Generate efficiency metrics based on session data
    const sessionDuration = session.duration || 0;
    const completion_rate = session.outcome === 'success' ? 1.0 : 
                           session.outcome === 'stuck' ? 0.3 : 0.7;
    const efficiency_metrics = {
      completion_rate: completion_rate,
      avg_duration: sessionDuration > 0 ? 
        `${Math.floor(sessionDuration / 60000)} minutes` : '0 minutes',
      success_score: session.outcome === 'success' ? 10 : 
                    session.outcome === 'stuck' ? 4 : 7
    };
    
    // Improvement suggestions removed per user request
    
    return {
      reusable_patterns,
      efficiency_metrics,
      analysis_timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating procedural insights:', error);
    return null;
  }
}

// Graceful shutdown
// NEW: Comprehensive clustering function that analyzes all data types
async function generateComprehensiveClusters(data) {
  try {
    console.log('generateComprehensiveClusters called with:', {
      sessions: data.sessions?.length || 0,
      conversations: data.conversations?.length || 0,
      events: data.events?.length || 0
    });
    
    const { sessions, conversations, events } = data;
  
  // 1. Session-based clusters (existing functionality)
  console.log('Generating session clusters...');
  const sessionClusters = generateSessionClusters(sessions);
  console.log(`Generated ${sessionClusters.length} session clusters`);
  
  // 2. Conversation-based clusters (new)
  console.log('Generating conversation clusters...');
  const conversationClusters = generateConversationClusters(conversations);
  console.log(`Generated ${conversationClusters.length} conversation clusters`);
  
  // 3. Event-based clusters (new)
  console.log('Generating event clusters...');
  const eventClusters = generateEventClusters(events);
  console.log(`Generated ${eventClusters.length} event clusters`);
  
  // 4. Cross-data clusters (new)
  console.log('Generating cross-data clusters...');
  const crossDataClusters = generateCrossDataClusters(sessions, conversations, events);
  console.log(`Generated ${crossDataClusters.length} cross-data clusters`);
  
  // 5. Temporal clusters (new)
  console.log('Generating temporal clusters...');
  const temporalClusters = generateTemporalClusters(sessions, conversations, events);
  console.log(`Generated ${temporalClusters.length} temporal clusters`);
  
  // 6. Content-based clusters (new)
  console.log('Generating content clusters...');
  const contentClusters = generateContentClusters(sessions, conversations, events);
  console.log(`Generated ${contentClusters.length} content clusters`);
  
  // 7. Behavioral clusters (new)
  console.log('Generating behavioral clusters...');
  const behavioralClusters = generateBehavioralClusters(sessions, conversations, events);
  console.log(`Generated ${behavioralClusters.length} behavioral clusters`);
  
  // Combine all cluster types
  const allClusters = [
    ...sessionClusters,
    ...conversationClusters,
    ...eventClusters,
    ...crossDataClusters,
    ...temporalClusters,
    ...contentClusters,
    ...behavioralClusters
  ];
  
  console.log(`Total comprehensive clusters generated: ${allClusters.length}`);
  return allClusters;
  } catch (error) {
    console.error('Error in generateComprehensiveClusters:', error);
    return [];
  }
}

// Generate session-based clusters
function generateSessionClusters(sessions) {
  const intentGroups = {};
  sessions.forEach(session => {
    if (!intentGroups[session.intent]) {
      intentGroups[session.intent] = [];
    }
    intentGroups[session.intent].push(session.id);
  });
  
  return Object.entries(intentGroups).map(([intent, sessionIds], index) => {
    const sessionsInCluster = sessions.filter(s => sessionIds.includes(s.id));
    const successCount = sessionsInCluster.filter(s => s.outcome === 'success').length;
    
    return {
      id: `session_cluster_${intent}_${index}`,
      name: `${intent.charAt(0).toUpperCase() + intent.slice(1)} Development Sessions`,
      type: 'session_based',
      sessions: sessionIds,
      size: sessionIds.length,
      success_rate: sessionIds.length > 0 ? successCount / sessionIds.length : 0,
      description: `Sessions focused on ${intent} tasks`,
      facets: {
        intent: intent,
        outcome_distribution: {
          success: successCount,
          in_progress: sessionsInCluster.filter(s => s.outcome === 'in_progress').length,
          failed: sessionsInCluster.filter(s => s.outcome === 'failed').length
        }
      }
    };
  });
}

// Generate conversation-based clusters
function generateConversationClusters(conversations) {
  const roleGroups = {};
  const topicGroups = {};
  
  conversations.forEach(conv => {
    // Group by role
    if (!roleGroups[conv.role]) {
      roleGroups[conv.role] = [];
    }
    roleGroups[conv.role].push(conv.id);
    
    // Group by topic (extracted from content)
    const topic = extractConversationTopic(conv.content);
    if (!topicGroups[topic]) {
      topicGroups[topic] = [];
    }
    topicGroups[topic].push(conv.id);
  });
  
  const clusters = [];
  
  // Role-based clusters
  Object.entries(roleGroups).forEach(([role, convIds], index) => {
    clusters.push({
      id: `conversation_role_${role}_${index}`,
      name: `${role.charAt(0).toUpperCase() + role.slice(1)} Conversations`,
      type: 'conversation_role',
      conversations: convIds,
      size: convIds.length,
      description: `Conversations initiated by ${role}`,
      facets: {
        role: role,
        avg_length: conversations.filter(c => convIds.includes(c.id))
          .reduce((sum, c) => sum + (c.content?.length || 0), 0) / convIds.length
      }
    });
  });
  
  // Topic-based clusters
  Object.entries(topicGroups).forEach(([topic, convIds], index) => {
    if (convIds.length > 1) { // Only include topics with multiple conversations
      clusters.push({
        id: `conversation_topic_${topic.replace(/\s+/g, '_')}_${index}`,
        name: `${topic} Discussions`,
        type: 'conversation_topic',
        conversations: convIds,
        size: convIds.length,
        description: `Conversations about ${topic}`,
        facets: {
          topic: topic,
          related_sessions: conversations.filter(c => convIds.includes(c.id))
            .map(c => c.sessionId).filter(Boolean)
        }
      });
    }
  });
  
  return clusters;
}

// Generate event-based clusters
function generateEventClusters(events) {
  const eventTypeGroups = {};
  const fileTypeGroups = {};
  
  events.forEach(event => {
    // Group by event type
    if (!eventTypeGroups[event.event_type]) {
      eventTypeGroups[event.event_type] = [];
    }
    eventTypeGroups[event.event_type].push(event.id);
    
    // Group by file type
    const fileType = extractFileType(event.file);
    if (!fileTypeGroups[fileType]) {
      fileTypeGroups[fileType] = [];
    }
    fileTypeGroups[fileType].push(event.id);
  });
  
  const clusters = [];
  
  // Event type clusters
  Object.entries(eventTypeGroups).forEach(([eventType, eventIds], index) => {
    clusters.push({
      id: `event_type_${eventType}_${index}`,
      name: `${eventType.replace(/_/g, ' ').toUpperCase()} Events`,
      type: 'event_type',
      events: eventIds,
      size: eventIds.length,
      description: `Events of type ${eventType}`,
      facets: {
        event_type: eventType,
        avg_duration: events.filter(e => eventIds.includes(e.id))
          .reduce((sum, e) => sum + (e.duration || 0), 0) / eventIds.length
      }
    });
  });
  
  // File type clusters
  Object.entries(fileTypeGroups).forEach(([fileType, eventIds], index) => {
    if (eventIds.length > 1) {
      clusters.push({
        id: `file_type_${fileType}_${index}`,
        name: `${fileType.toUpperCase()} File Events`,
        type: 'file_type',
        events: eventIds,
        size: eventIds.length,
        description: `Events involving ${fileType} files`,
        facets: {
          file_type: fileType,
          unique_files: new Set(events.filter(e => eventIds.includes(e.id))
            .map(e => e.file)).size
        }
      });
    }
  });
  
  return clusters;
}

// Generate cross-data clusters
function generateCrossDataClusters(sessions, conversations, events) {
  const clusters = [];
  
  // High-activity sessions (sessions with many conversations and events)
  const sessionActivity = sessions.map(session => {
    const sessionConversations = conversations.filter(c => c.sessionId === session.id);
    const sessionEvents = events.filter(e => e.workspace_id === session.workspaceId);
    
    return {
      sessionId: session.id,
      conversationCount: sessionConversations.length,
      eventCount: sessionEvents.length,
      activityScore: sessionConversations.length + sessionEvents.length
    };
  });
  
  const highActivitySessions = sessionActivity
    .filter(s => s.activityScore > 5)
    .sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, 10);
  
  if (highActivitySessions.length > 0) {
    clusters.push({
      id: 'high_activity_sessions',
      name: 'High Activity Development Sessions',
      type: 'cross_data',
      sessions: highActivitySessions.map(s => s.sessionId),
      size: highActivitySessions.length,
      description: 'Sessions with high conversation and event activity',
      facets: {
        avg_conversations: highActivitySessions.reduce((sum, s) => sum + s.conversationCount, 0) / highActivitySessions.length,
        avg_events: highActivitySessions.reduce((sum, s) => sum + s.eventCount, 0) / highActivitySessions.length,
        activity_distribution: highActivitySessions.map(s => s.activityScore)
      }
    });
  }
  
  return clusters;
}

// Generate temporal clusters
function generateTemporalClusters(sessions, conversations, events) {
  const clusters = [];
  
  // Group by time periods
  const now = new Date();
  const timePeriods = {
    'last_hour': new Date(now.getTime() - 60 * 60 * 1000),
    'last_day': new Date(now.getTime() - 24 * 60 * 60 * 1000),
    'last_week': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    'last_month': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  };
  
  Object.entries(timePeriods).forEach(([period, cutoff]) => {
    const recentSessions = sessions.filter(s => new Date(s.timestamp) > cutoff);
    const recentConversations = conversations.filter(c => new Date(c.timestamp) > cutoff);
    const recentEvents = events.filter(e => new Date(e.timestamp) > cutoff);
    
    if (recentSessions.length > 0 || recentConversations.length > 0 || recentEvents.length > 0) {
      clusters.push({
        id: `temporal_${period}`,
        name: `${period.replace(/_/g, ' ').toUpperCase()} Activity`,
        type: 'temporal',
        sessions: recentSessions.map(s => s.id),
        conversations: recentConversations.map(c => c.id),
        events: recentEvents.map(e => e.id),
        size: recentSessions.length + recentConversations.length + recentEvents.length,
        description: `Activity in the ${period.replace(/_/g, ' ')}`,
        facets: {
          period: period,
          session_count: recentSessions.length,
          conversation_count: recentConversations.length,
          event_count: recentEvents.length
        }
      });
    }
  });
  
  return clusters;
}

// Generate content-based clusters
function generateContentClusters(sessions, conversations, events) {
  const clusters = [];
  
  // Programming language clusters
  const languageGroups = {};
  
  sessions.forEach(session => {
    if (session.codeDeltas) {
      session.codeDeltas.forEach(delta => {
        const language = detectProgrammingLanguage(delta.afterContent || delta.content || '');
        if (language !== 'unknown') {
          if (!languageGroups[language]) {
            languageGroups[language] = [];
          }
          languageGroups[language].push(session.id);
        }
      });
    }
  });
  
  Object.entries(languageGroups).forEach(([language, sessionIds], index) => {
    const uniqueSessionIds = [...new Set(sessionIds)];
    if (uniqueSessionIds.length > 0) {
      clusters.push({
        id: `language_${language}_${index}`,
        name: `${language.toUpperCase()} Development`,
        type: 'content_language',
        sessions: uniqueSessionIds,
        size: uniqueSessionIds.length,
        description: `Sessions involving ${language} code`,
        facets: {
          language: language,
          code_volume: sessionIds.length
        }
      });
    }
  });
  
  return clusters;
}

// Generate behavioral clusters
function generateBehavioralClusters(sessions, conversations, events) {
  const clusters = [];
  
  // Rapid development sessions (short duration, high activity)
  const rapidSessions = sessions.filter(session => {
    const duration = session.duration || 0;
    const activity = (session.codeDeltas?.length || 0) + (session.fileChanges?.length || 0);
    return duration < 3600000 && activity > 10; // Less than 1 hour, more than 10 changes
  });
  
  if (rapidSessions.length > 0) {
    clusters.push({
      id: 'rapid_development',
      name: 'Rapid Development Sessions',
      type: 'behavioral',
      sessions: rapidSessions.map(s => s.id),
      size: rapidSessions.length,
      description: 'Short, high-activity development sessions',
      facets: {
        avg_duration: rapidSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / rapidSessions.length,
        avg_activity: rapidSessions.reduce((sum, s) => 
          sum + (s.codeDeltas?.length || 0) + (s.fileChanges?.length || 0), 0) / rapidSessions.length
      }
    });
  }
  
  // Long-form development sessions
  const longSessions = sessions.filter(session => {
    const duration = session.duration || 0;
    return duration > 7200000; // More than 2 hours
  });
  
  if (longSessions.length > 0) {
    clusters.push({
      id: 'long_form_development',
      name: 'Long-Form Development Sessions',
      type: 'behavioral',
      sessions: longSessions.map(s => s.id),
      size: longSessions.length,
      description: 'Extended development sessions',
      facets: {
        avg_duration: longSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / longSessions.length,
        completion_rate: longSessions.filter(s => s.outcome === 'success').length / longSessions.length
      }
    });
  }
  
  return clusters;
}

// Helper functions for clustering
function extractConversationTopic(content) {
  if (!content) return 'general';
  
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('bug') || lowerContent.includes('error') || lowerContent.includes('fix')) {
    return 'debugging';
  } else if (lowerContent.includes('feature') || lowerContent.includes('implement') || lowerContent.includes('add')) {
    return 'feature_development';
  } else if (lowerContent.includes('refactor') || lowerContent.includes('clean') || lowerContent.includes('optimize')) {
    return 'refactoring';
  } else if (lowerContent.includes('test') || lowerContent.includes('spec') || lowerContent.includes('assert')) {
    return 'testing';
  } else if (lowerContent.includes('document') || lowerContent.includes('comment') || lowerContent.includes('readme')) {
    return 'documentation';
  } else if (lowerContent.includes('deploy') || lowerContent.includes('build') || lowerContent.includes('ci')) {
    return 'deployment';
  } else {
    return 'general';
  }
}

function extractFileType(filename) {
  if (!filename) return 'unknown';
  
  const extension = filename.split('.').pop()?.toLowerCase();
  
  const typeMap = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'shell',
    'bat': 'batch',
    'ps1': 'powershell'
  };
  
  return typeMap[extension] || 'other';
}

function detectProgrammingLanguage(code) {
  if (!code) return 'unknown';
  
  const lowerCode = code.toLowerCase();
  
  if (lowerCode.includes('import ') || lowerCode.includes('def ') || lowerCode.includes('class ')) {
    return 'python';
  } else if (lowerCode.includes('function ') || lowerCode.includes('const ') || lowerCode.includes('let ')) {
    return 'javascript';
  } else if (lowerCode.includes('public class') || lowerCode.includes('private ') || lowerCode.includes('public ')) {
    return 'java';
  } else if (lowerCode.includes('#include') || lowerCode.includes('int main')) {
    return 'cpp';
  } else if (lowerCode.includes('<?php') || lowerCode.includes('$')) {
    return 'php';
  } else if (lowerCode.includes('package ') || lowerCode.includes('import (')) {
    return 'go';
  } else if (lowerCode.includes('fn ') || lowerCode.includes('let mut')) {
    return 'rust';
  } else {
    return 'unknown';
  }
}

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  realMonitor.stopMonitoring();
    process.exit(0);
});
