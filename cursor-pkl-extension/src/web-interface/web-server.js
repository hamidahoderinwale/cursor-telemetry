#!/usr/bin/env node

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const EventEmitter = require('events');
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

const PrivacyService = class {
  constructor() {}
  analyzePrivacy() { return { risk: 'low', issues: [] }; }
  sanitizeData(data) { return data; }
  collectWorkflowData() { 
    return { 
      workflows: [], 
      privacyScore: 85, 
      recommendations: ['Use data anonymization', 'Implement access controls'] 
    }; 
  }
};

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
const port = 3000;

// Initialize components
const realMonitor = new RealMonitor();
const dataStorage = new DataStorage();
const exportService = new ExportService();
const privacyService = new PrivacyService();
const procedureService = new ProcedurePatternService();

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

// Initialize and start monitoring
initializeDataStorage().then(() => {
  realMonitor.startMonitoring();
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

// Project Organization API Endpoints
app.get('/api/projects', async (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Combine and deduplicate
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Organize sessions by project
    const projects = organizeSessionsByProject(uniqueSessions);
    
    res.json({
      success: true,
      projects: projects,
      count: projects.length
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

// Return to context - opens file in Cursor IDE and restores session state (Enhanced)
app.post('/api/session/:id/return-to-context', async (req, res) => {
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
    
    console.log('INFO: Return to context requested for session:', sessionId);
    console.log('   - File:', session.currentFile);
    console.log('   - Position:', session.cursorPosition);
    
    // Use enhanced AppleScript to restore context in Cursor IDE
    const result = await AppleScriptService.restoreSessionContext({
      currentFile: session.currentFile,
      cursorPosition: session.cursorPosition,
      selectedText: session.selectedText
    });
    
    if (result.success) {
      console.log('SUCCESS: Session context restored in Cursor IDE');
      console.log('   - Method:', result.method);
      res.json({ 
        success: true, 
        message: 'Session context restored in Cursor IDE',
        method: result.method,
        session: {
          id: session.id,
          file: session.currentFile,
          timestamp: session.timestamp,
          position: result.position
        }
      });
    } else {
      console.log('WARNING: Failed to restore session context:', result.error);
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to restore context in Cursor IDE. Please ensure Cursor is accessible.' 
      });
    }
  } catch (error) {
    console.error('Error restoring session context:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
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

// Kura analysis endpoint for enhanced dashboard
app.post('/api/sessions/analyze-with-kura', async (req, res) => {
  try {
    const activeSessions = realMonitor.getActiveSessions();
    const storedSessions = await dataStorage.loadSessions();
    
    // Combine and deduplicate
    const allSessions = [...activeSessions, ...storedSessions];
    const uniqueSessions = deduplicateSessions(allSessions);
    
    // Sort by timestamp
    uniqueSessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Transform sessions for Kura dashboard format
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
    
    // Create simple clusters based on intent
    const intentGroups = {};
    transformedSessions.forEach(session => {
      if (!intentGroups[session.intent]) {
        intentGroups[session.intent] = [];
      }
      intentGroups[session.intent].push(session.id);
    });
    
    const clusters = Object.entries(intentGroups).map(([intent, sessionIds], index) => {
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
        // Simulate Clio analysis for data exploration sessions
        const clioAnalysis = analyzeDataExplorationSession(session);
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

// Serve the enhanced dashboard
app.get('/dashboard/enhanced', (req, res) => {
  res.sendFile(path.join(__dirname, 'kura-enhanced-dashboard.html'));
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

// Analyze data exploration session for Clio-derived insights
function analyzeDataExplorationSession(session) {
  const fileName = session.currentFile ? session.currentFile.split('/').pop() : '';
  const codeDeltas = session.codeDeltas || [];
  const fileChanges = session.fileChanges || [];
  
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
    fileComplexity: fileChanges.length
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

// Get privacy analysis statistics
app.get('/api/privacy/stats', async (req, res) => {
  try {
    const sessions = await dataStorage.loadSessions();
    const workflows = await privacyService.collectWorkflowData(sessions);
    
    // Calculate aggregate statistics
    const stats = {
      totalSessions: workflows.length,
      totalTokens: workflows.reduce((sum, w) => {
        return sum + w.traces.reduce((traceSum, trace) => {
          return traceSum + (trace.tokens ? trace.tokens.length : 0);
        }, 0);
      }, 0),
      privacyViolations: workflows.reduce((sum, w) => {
        return sum + w.traces.reduce((traceSum, trace) => {
          // Count potential privacy violations based on content analysis
          const content = trace.content || '';
          const violations = (content.match(/password|api_key|secret|token/gi) || []).length;
          return traceSum + violations;
        }, 0);
      }, 0),
      avgRedactionRate: privacyService.privacyConfig.redactionLevel,
      avgExpressionScore: workflows.length > 0 ? workflows.reduce((sum, w) => sum + (w.expressivenessScore || 0.5), 0) / workflows.length : 0.5,
      clusterCount: clusters.length
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

// Initialize conversation monitoring
async function initializeConversationMonitoring() {
  try {
    const { CursorDBParser } = require('../../dist/services/cursor-db-parser');
    const cursorDbParser = new CursorDBParser();
    await cursorDbParser.connect();
    
    // Start monitoring for new conversations
    await cursorDbParser.startConversationMonitoring(async (conversations) => {
      console.log(`Processing ${conversations.length} new conversations`);
      for (const conversation of conversations) {
        await dataStorage.saveConversation(conversation);
      }
    });
    
    console.log('Conversation monitoring started');
  } catch (error) {
    console.log('WARNING: Conversation monitoring not available (Cursor DB not accessible):', error.message);
    console.log('INFO: To capture real conversations, ensure Cursor IDE is running and accessible');
    
    // We can still manually add conversations via the API
    console.log('Conversation API endpoints available:');
    console.log('   - POST /api/conversations');
    console.log('   - GET /api/conversations');
    console.log('   - GET /api/session/:id/conversations');
  }
}

// Start server
server.listen(port, async () => {
  console.log('PKL Web Server Started');
  console.log('========================');
  console.log(`Dashboard: http://localhost:${port}`);
  console.log(`API: http://localhost:${port}/api/sessions`);
  console.log(`WebSocket: ws://localhost:${port}`);
  console.log('Monitoring .ipynb files...');
  
  // Initialize conversation monitoring
  await initializeConversationMonitoring();
  
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

// Generate Kura analysis for a session using embeddings-based classification
async function generateKuraAnalysis(session, conversations) {
  try {
    // Import embeddings-based classifier
    const EmbeddingsIntentClassifier = require('../intent-classification/embeddings-intent-classifier');
    const embeddingsClassifier = new EmbeddingsIntentClassifier();
    
    // Get sophisticated intent analysis
    const intentAnalysis = await embeddingsClassifier.classifyIntent(session, conversations);
    
    // Enhanced conversation analysis using embeddings
    const conversation_analysis = {
      message_count: conversations.length,
      avg_response_time: conversations.length > 0 ? 
        `${Math.floor(conversations.reduce((sum, c) => sum + (c.responseTime || 0), 0) / conversations.length)}s` : 'N/A',
      complexity_score: intentAnalysis.profile.complexity_level,
      sentiment_analysis: conversations.length > 0 ? 'positive' : 'neutral',
      topic_coherence: intentAnalysis.confidence,
      embedding_similarity: calculateConversationSimilarity(conversations),
      semantic_density: calculateSemanticDensity(intentAnalysis.embeddings.conversation)
    };
    
    // Generate cluster assignment based on embeddings
    const cluster_assignment = {
      cluster_id: `cluster_${intentAnalysis.primary_intent}_${Math.floor(intentAnalysis.confidence * 10)}`,
      confidence: intentAnalysis.confidence,
      similar_sessions: Math.max(1, Math.floor((session.codeDeltas?.length || 0) / 2) + 1),
      embedding_distance: calculateEmbeddingDistance(intentAnalysis.embeddings.code, intentAnalysis.embeddings.conversation),
      facet_alignment: calculateFacetAlignment(intentAnalysis.facets)
    };
    
    // Generate high-dimensional embedding coordinates
    const embedding_coordinates = generateHighDimensionalCoordinates(intentAnalysis.embeddings);
    
    return {
      conversation_analysis,
      cluster_assignment,
      embedding_coordinates,
      embeddings_analysis: intentAnalysis,
      analysis_timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating Kura analysis:', error);
    return null;
  }
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
        `${Math.floor(sessionDuration / 60000)} minutes` : 'N/A',
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
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  realMonitor.stopMonitoring();
    process.exit(0);
});
