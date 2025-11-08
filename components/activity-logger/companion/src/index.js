#!/usr/bin/env node

const path = require('path');

// Load environment variables from workspace root
require('dotenv').config({ path: path.resolve(__dirname, '../../../../../.env') });

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const NodeCache = require('node-cache');
const http = require('http');
const chokidar = require('chokidar');
const fs = require('fs');
const crypto = require('crypto');
const lunr = require('lunr'); // Import lunr
// Import the new queue system and clipboard monitor
const { queue: queueSystem } = require('./utils/queue.js');
const { clipboardMonitor } = require('./monitors/clipboardMonitor.js');

// Initialize query cache (30 second TTL, check every 60s for expired)
const queryCache = new NodeCache({ 
  stdTTL: 30, 
  checkperiod: 60,
  useClones: false // Better performance, less memory
});

// Enhanced raw data capture modules
const os = require('os');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import IDE state capture service
const IDEStateCapture = require('./monitors/ide-state-capture.js');

// Import prompt capture system
const PromptCaptureSystem = require('./capture/prompt-capture-system.js');

// Import Cursor database parser
const CursorDatabaseParser = require('./database/cursor-db-parser.js');

// Import screenshot monitor
const ScreenshotMonitor = require('./monitors/screenshot-monitor.js');

// Import persistent database
const PersistentDB = require('./database/persistent-db.js');

// Import schema migrations
const SchemaMigrations = require('./database/schema-migrations.js');

// Reasoning engine removed - chat widget no longer used

// Import analytics modules
const ContextAnalyzer = require('./analytics/context-analyzer.js');
const ContextChangeTracker = require('./analytics/context-change-tracker.js');
const ErrorTracker = require('./analytics/error-tracker.js');
const ProductivityTracker = require('./analytics/productivity-tracker.js');
const AbstractionEngine = require('./analytics/abstraction-engine.js');

// Import monitor modules
const StatusMessageTracker = require('./monitors/status-message-tracker.js');
const TerminalMonitor = require('./monitors/terminal-monitor.js');

// Initialize persistent database
const persistentDB = new PersistentDB();

// Initialize schema migrations
const schemaMigrations = new SchemaMigrations(persistentDB);

// Initialize analytics trackers
const contextAnalyzer = new ContextAnalyzer(persistentDB);
const contextChangeTracker = new ContextChangeTracker(persistentDB);
const statusMessageTracker = new StatusMessageTracker(persistentDB);
const errorTracker = new ErrorTracker();
const productivityTracker = new ProductivityTracker();
const terminalMonitor = new TerminalMonitor({
  captureOutput: false, // Don't execute commands, just monitor
  debug: false
});
const abstractionEngine = new AbstractionEngine();

// Simple in-memory database for companion service (with persistent backup)
const db = {
    _entries: [],
    _prompts: [],
    nextId: 1,
    
    get entries() { return this._entries; },
    set entries(val) { this._entries = val; },
    
    get prompts() { return this._prompts; },
    set prompts(val) { this._prompts = val; },
    
    async add(table, data) {
        const item = { ...data, id: this.nextId++ };
        this[table].push(item);
        
        // Persist to disk
        try {
            if (table === 'entries') {
                await persistentDB.saveEntry(item);
            } else if (table === 'prompts') {
                await persistentDB.savePrompt(item);
            }
        } catch (error) {
            console.error(`Error persisting ${table} item:`, error);
        }
        
        return item;
    },
    
    async update(table, id, updates) {
        const index = this[table].findIndex(item => item.id === id);
        if (index >= 0) {
            this[table][index] = { ...this[table][index], ...updates };
            
            // Persist to disk
            try {
                if (table === 'entries') {
                    await persistentDB.updateEntry(id, updates);
                } else if (table === 'prompts') {
                    await persistentDB.updatePrompt(id, updates);
                }
            } catch (error) {
                console.error(`Error updating ${table} item:`, error);
            }
            
            return this[table][index];
        }
        return null;
    }
};

const PORT = process.env.PORT || 43917;
const app = express();
const { Server } = require('socket.io');

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Track active conversation streams (defined early for use in broadcast functions)
const conversationStreams = new Map();

// Real-time broadcast function with cache invalidation
function broadcastUpdate(type, data) {
  io.emit('activityUpdate', { type, data });
  
  // Invalidate relevant caches when data changes
  if (type === 'file-change' || type === 'new-entry') {
    invalidateCache('activity_');
    invalidateCache('context_');
    invalidateCache('productivity_');
  } else if (type === 'prompt' || type === 'ai-interaction') {
    invalidateCache('activity_');
    invalidateCache('context_');
  } else if (type === 'error') {
    invalidateCache('error_');
  }
}

// Helper function to broadcast conversation updates to subscribed clients
function broadcastConversationUpdate(conversationId, data) {
  const stream = conversationStreams.get(conversationId);
  if (stream && stream.subscribers) {
    stream.subscribers.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('conversation-stream', {
          conversation_id: conversationId,
          data: data,
          timestamp: Date.now()
        });
      }
    });
    
    // Update stream stats
    stream.messageCount++;
  }
}

// Middleware
app.use(compression({ 
  threshold: 1024, // Only compress responses > 1KB
  level: 6 // Balance between compression ratio and speed
}));
// CORS configuration - explicitly allow all origins and methods
app.use(cors({ 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false // No credentials needed for local API
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '10mb' })); // Increase JSON payload limit

// Serve static files from public directory with explicit MIME types
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));
console.log(`[FILE] Serving static files from: ${publicPath}`);

let ideStateCapture = new IDEStateCapture(); // Changed from const to let
ideStateCapture.start(); // Start capturing IDE state

// Initialize Cursor database parser
let cursorDbParser = new CursorDatabaseParser();

// Initialize screenshot monitor
let screenshotMonitor = new ScreenshotMonitor();

// Start screenshot monitoring with callback
screenshotMonitor.start((action, screenshotData) => {
  // Link screenshots to recent prompts/events
  if (action === 'added') {
    console.log(`📷 Screenshot captured: ${screenshotData.fileName}`);
    
    // Find prompts/events near this time
    const recentPrompts = db.prompts.filter(p => {
      const promptTime = new Date(p.timestamp).getTime();
      const screenshotTime = new Date(screenshotData.timestamp).getTime();
      return Math.abs(screenshotTime - promptTime) <= 5 * 60 * 1000; // 5 minutes
    });
    
    // Link screenshot to prompts
    recentPrompts.forEach(prompt => {
      screenshotMonitor.linkScreenshotToEvent(screenshotData.id, prompt.id, 'prompt');
    });
  }
});

// Add new endpoint for IDE state
app.get('/ide-state', (req, res) => {
  const limit = parseInt(req.query.limit) || 10000; // Much higher default limit
  const since = parseInt(req.query.since) || 0;
  res.json(ideStateCapture.getCachedData(limit, since));
});

// Simple in-memory storage with numeric sequence cursor
let entries = [];
let events = [];
let sequence = 0;
let queue = []; // { seq, kind: 'entry'|'event', payload }

let lunrIndex; // Lunr index instance
let indexedDocs = []; // Array to store documents added to the index

// Enhanced raw data storage
let rawData = {
  fileSystem: {
    changes: [],
    access: [],
    structure: []
  },
  systemResources: [],
  gitData: {
    status: [],
    commits: [],
    changes: []
  },
  cursorDatabase: {
    conversations: [],
    chatHistory: [],
    fileContexts: []
  },
  appleScript: {
    appState: [],
    editorState: [],
    debugState: []
  },
  logs: {
    cursor: [],
    extensions: [],
    errors: []
  }
};

// Session management
let activeSession = 'session-' + Date.now();
let lastActivityTime = Date.now();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

// Multi-workspace management
let currentWorkspace = process.cwd(); // Default workspace
let workspaceSessions = new Map(); // Map of workspace paths to active sessions
let workspaceData = new Map(); // Map of workspace paths to their data
let knownWorkspaces = new Set(); // Track all discovered workspaces

// Function to create a new session
function createNewSession() {
  activeSession = 'session-' + Date.now();
  lastActivityTime = Date.now();
  console.log(`[SYNC] Created new session: ${activeSession}`);
  return activeSession;
}

// Function to check if session should be renewed
function checkSessionTimeout() {
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivityTime;
  
  if (timeSinceLastActivity > SESSION_TIMEOUT) {
    console.log(`[TIME] Session timeout reached (${Math.round(timeSinceLastActivity / 60000)} minutes), creating new session`);
    createNewSession();
  }
}

// Update activity time when new activity occurs
function updateActivityTime() {
  lastActivityTime = Date.now();
}

// Workspace functions - detect from file paths
function detectWorkspace(filePath) {
  if (!filePath) return currentWorkspace;
  
  const path = require('path');
  let searchPath = path.isAbsolute(filePath) ? path.dirname(filePath) : path.resolve(filePath);
  
  // First pass: look for .git directory (highest priority - marks the true project root)
  let currentSearch = searchPath;
  let gitRoot = null;
  const maxDepth = 15;
  let depth = 0;
  
  while (currentSearch !== path.dirname(currentSearch) && depth < maxDepth) {
    const gitPath = path.join(currentSearch, '.git');
    if (fs.existsSync(gitPath)) {
      gitRoot = currentSearch;
      // Don't break - keep searching up to find the topmost .git
    }
    currentSearch = path.dirname(currentSearch);
    depth++;
  }
  
  // If we found a git root, that's the workspace
  if (gitRoot) {
    knownWorkspaces.add(gitRoot);
    return gitRoot;
  }
  
  // Second pass: if no .git found, look for other strong workspace indicators
  // but only at reasonably high levels (not deep nested directories)
  currentSearch = searchPath;
  depth = 0;
  const strongIndicators = ['.cursor', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pom.xml'];
  
  while (currentSearch !== path.dirname(currentSearch) && depth < maxDepth) {
    // Check for strong indicators
    for (const indicator of strongIndicators) {
      const indicatorPath = path.join(currentSearch, indicator);
      if (fs.existsSync(indicatorPath)) {
        // Only accept if it's at a reasonable level (not too deep)
        const parts = currentSearch.split(path.sep);
        if (parts.length <= 7) { // Adjust based on typical depth
          knownWorkspaces.add(currentSearch);
          return currentSearch;
        }
      }
    }
    currentSearch = path.dirname(currentSearch);
    depth++;
  }
  
  // Third pass: look for well-known parent directories
  const parts = searchPath.split(path.sep);
  for (let i = parts.length - 1; i >= 3; i--) {
    const dirName = parts[i];
    if (['Desktop', 'Documents', 'Projects', 'Code', 'dev', 'workspace', 'repos'].includes(dirName)) {
      // Take the directory right under this
      if (i + 1 < parts.length) {
        const workspacePath = parts.slice(0, i + 2).join(path.sep);
        knownWorkspaces.add(workspacePath);
        return workspacePath;
      }
    }
  }
  
  // Last resort: use a reasonable parent (3-4 levels deep from root)
  if (parts.length > 4) {
    const workspacePath = parts.slice(0, 5).join(path.sep);
    knownWorkspaces.add(workspacePath);
    return workspacePath;
  }
  
  knownWorkspaces.add(searchPath);
  return searchPath;
}

function getWorkspaceSession(workspacePath) {
  if (!workspaceSessions.has(workspacePath)) {
    workspaceSessions.set(workspacePath, 'session-' + Date.now());
  }
  return workspaceSessions.get(workspacePath);
}

function updateWorkspaceData(workspacePath, entry, event) {
  if (!workspaceData.has(workspacePath)) {
    workspaceData.set(workspacePath, {
      entries: [],
      events: [],
      lastActivity: Date.now()
    });
  }
  
  const data = workspaceData.get(workspacePath);
  if (entry) data.entries.push(entry);
  if (event) data.events.push(event);
  data.lastActivity = Date.now();
}

// Privacy filtering functions
function shouldCaptureData(content, type) {
  if (!privacyConfig.enabled || !privacyConfig.consentGiven) {
    return true; // Capture everything if privacy not enabled
  }
  
  // Check sensitivity level
  if (privacyConfig.sensitivityLevel === 'high' && type === 'clipboard') {
    return false; // Don't capture clipboard for high sensitivity
  }
  
  return true;
}

function applyPrivacyRedaction(content) {
  if (!privacyConfig.enabled || !privacyConfig.consentGiven) {
    return content; // No redaction if privacy not enabled
  }
  
  let redactedContent = content;
  
  // Redact names
  if (privacyConfig.redactNames) {
    redactedContent = redactedContent.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, '[NAME]');
  }
  
  // Redact emails
  if (privacyConfig.redactEmails) {
    redactedContent = redactedContent.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  }
  
  // Redact numbers
  if (privacyConfig.redactNumbers) {
    redactedContent = redactedContent.replace(/\b\d+(?:\.\d+)?\b/g, '[NUMBER]');
  }
  
  // Redact file paths
  if (privacyConfig.redactFilePaths) {
    redactedContent = redactedContent.replace(/(?:[a-zA-Z]:)?[\\\/](?:[^\\\/\n]+[\\\/])*[^\\\/\n]*/g, '[FILEPATH]');
  }
  
  return redactedContent;
}

// Enqueue function for reliable queuing
function enqueue(kind, payload) {
  // Apply privacy filtering
  if (!shouldCaptureData(payload.content || payload.data || '', kind)) {
    console.log(` Privacy filter blocked ${kind} capture`);
    return;
  }
  
  // Apply privacy redaction
  if (payload.content) {
    payload.content = applyPrivacyRedaction(payload.content);
  }
  if (payload.data) {
    payload.data = applyPrivacyRedaction(payload.data);
  }
  
  const item = { seq: ++sequence, kind, payload };
  queue.push(item);
  
  // Also maintain the old arrays for backward compatibility
  if (kind === 'entry') {
    entries.push(payload);
  } else if (kind === 'event') {
    events.push(payload);
    // Persist events to disk
    persistentDB.saveEvent(payload).catch(err => 
      console.error('Error persisting event:', err.message)
    );
  }
  
  console.log(`� Enqueued ${kind} #${sequence}: ${payload.id || payload.type}`);
  updateLunrIndex(item); // Update Lunr index with the new item
}

// Lunr indexing functions
function addToLunrIndex(item) {
  if (!lunrIndex) return;

  let doc = {};
  if (item.kind === 'entry') {
    doc = {
      id: item.payload.id,
      content: item.payload.prompt + ' ' + item.payload.response + ' ' + item.payload.before_code + ' ' + item.payload.after_code,
      filePath: item.payload.file_path,
      type: 'entry'
    };
  } else if (item.kind === 'event') {
    doc = {
      id: item.payload.id,
      content: item.payload.details ? JSON.stringify(item.payload.details) : '',
      filePath: item.payload.details ? JSON.parse(item.payload.details).file_path : '',
      type: item.payload.type
    };
  }
  
  if (doc.id) {
    indexedDocs.push(doc); // Keep track of indexed documents for retrieval
    console.log(`[SEARCH] Added ${item.kind} ${item.payload.id} to Lunr index.`);
  }
}

function buildLunrIndex() {
  lunrIndex = lunr(function () {
    this.ref('id');
    this.field('content');
    this.field('filePath');
    this.field('type');
  });
  
  // Add existing entries and events to the index
  entries.forEach(entry => {
    addToLunrIndex({
      kind: 'entry',
      payload: entry
    });
  });

  events.forEach(event => {
    addToLunrIndex({
      kind: 'event',
      payload: event
    });
  });
  
  console.log(`[SEARCH] Lunr index built with ${entries.length} entries and ${events.length} events.`);
}

function updateLunrIndex(item) {
  // In Lunr 2.x, we need to rebuild the index when adding new documents
  // This is not ideal for performance, but it's the only way with this version
  try {
    buildLunrIndex();
    console.log(`[SEARCH] Rebuilt Lunr index with new ${item.kind} ${item.payload.id}.`);
  } catch (error) {
    console.error('Error rebuilding Lunr index:', error);
  }
}

// File watcher state
let watcher = null;
let fileSnapshots = new Map();

// Enhanced data capture intervals
let captureIntervals = {
  systemResources: null,
  gitStatus: null,
  appleScript: null,
  cursorDatabase: null,
  logs: null
};

// IDE state capture service
// let ideStateCapture = null; // Remove this line

// Prompt capture system
let promptCaptureSystem = null;

// System resource monitoring
async function captureSystemResources() {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();
    
    const resourceData = {
      timestamp: Date.now(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      system: {
        loadAverage: loadAvg,
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        uptime: os.uptime(),
        platform: os.platform(),
        arch: os.arch()
      }
    };
    
    rawData.systemResources.push(resourceData);
    
    // Keep only last 1000 entries
    if (rawData.systemResources.length > 1000) {
      rawData.systemResources = rawData.systemResources.slice(-1000);
    }
    
    console.log(`[DATA] Captured system resources: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB memory`);
  } catch (error) {
    console.error('Error capturing system resources:', error);
  }
}

// Git data capture
async function captureGitData() {
  try {
    // Get git status
    const { stdout: gitStatus } = await execAsync('git status --porcelain');
    const { stdout: gitBranch } = await execAsync('git branch --show-current');
    const { stdout: gitLog } = await execAsync('git log --oneline -10');
    
    const gitData = {
      timestamp: Date.now(),
      branch: gitBranch.trim(),
      status: gitStatus.trim().split('\n').filter(line => line),
      recentCommits: gitLog.trim().split('\n').filter(line => line)
    };
    
    rawData.gitData.status.push(gitData);
    
    // Keep only last 100 entries
    if (rawData.gitData.status.length > 100) {
      rawData.gitData.status = rawData.gitData.status.slice(-100);
    }
    
    console.log(`[NOTE] Captured git data: branch ${gitBranch.trim()}`);
  } catch (error) {
    console.warn('Git data capture failed (not a git repository?):', error.message);
  }
}

// AppleScript integration for Cursor state
async function captureCursorAppState() {
  try {
    const script = `
      tell application "System Events"
        set cursorProcess to first process whose name is "Cursor"
        if exists cursorProcess then
          set isActive to frontmost of cursorProcess
          set windowCount to count of windows of cursorProcess
          return {isActive, windowCount}
        else
          return {false, 0}
        end if
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const [isActive, windowCount] = stdout.trim().split(',').map(v => v.trim());
    
    const appState = {
      timestamp: Date.now(),
      isActive: isActive === 'true',
      windowCount: parseInt(windowCount) || 0,
      processName: 'Cursor'
    };
    
    rawData.appleScript.appState.push(appState);
    
    // Keep only last 500 entries
    if (rawData.appleScript.appState.length > 500) {
      rawData.appleScript.appState = rawData.appleScript.appState.slice(-500);
    }
    
    console.log(`[APPLE] Captured Cursor app state: active=${isActive}, windows=${windowCount}`);
  } catch (error) {
    console.warn('AppleScript capture failed:', error.message);
  }
}

// Cursor database monitoring
async function captureCursorDatabase() {
  try {
    const possiblePaths = [
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/workspaceStorage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/globalStorage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/logs')
    ];
    
    for (const basePath of possiblePaths) {
      if (fs.existsSync(basePath)) {
        const dbFiles = findSQLiteFiles(basePath);
        if (dbFiles.length > 0) {
          const dbPath = dbFiles[0];
          console.log(`[DATA] Found Cursor database: ${dbPath}`);
          
          // Try to read basic database info
          try {
            const { stdout: tableInfo } = await execAsync(`sqlite3 "${dbPath}" ".tables"`);
            const tables = tableInfo.trim().split(/\s+/).filter(t => t);
            
            const dbInfo = {
              timestamp: Date.now(),
              path: dbPath,
              tables: tables,
              size: fs.statSync(dbPath).size
            };
            
            rawData.cursorDatabase.conversations.push(dbInfo);
            
            // Keep only last 50 entries
            if (rawData.cursorDatabase.conversations.length > 50) {
              rawData.cursorDatabase.conversations = rawData.cursorDatabase.conversations.slice(-50);
            }
            
            console.log(`[DATA] Captured Cursor database info: ${tables.length} tables`);
            break;
          } catch (dbError) {
            console.warn('Could not read Cursor database:', dbError.message);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Cursor database capture failed:', error.message);
  }
}

/**
 * NEW: Sync prompts from Cursor's database to persistent storage
 * Extracts prompts from aiService.prompts and aiService.generations
 * and saves them to the companion.db for persistence and linking
 */
const syncedPromptIds = new Set(); // Track which prompts we've already saved
let syncInProgress = false; // Prevent concurrent sync operations
let initialSyncComplete = false; // Only do full sync once on startup

async function syncPromptsFromCursorDB() {
  // Prevent concurrent syncs
  if (syncInProgress) {
    console.log('[SYNC] Skipping - sync already in progress');
    return;
  }
  
  // After initial sync, only sync new prompts (not full rescan)
  if (initialSyncComplete && syncedPromptIds.size > 0) {
    console.log('[SYNC] Initial sync complete - skipping periodic full rescan (use API for real-time data)');
    return;
  }
  
  syncInProgress = true;
  
  try {
    console.log('[SYNC] Starting prompt sync cycle...');
    
    // Extract prompts directly without enrichment for faster sync
    const startTime = Date.now();
    
    // Direct extraction without expensive enrichment
    const aiServiceMessages = await cursorDbParser.extractAllAIServiceData();
    const prompts = aiServiceMessages || [];
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SYNC] Extracted ${prompts.length} prompts from Cursor DB in ${duration}s`);
    
    if (prompts.length === 0) {
      console.log('[SYNC] No prompts to sync');
      return;
    }
    
    let newPrompts = 0;
    let skippedPrompts = 0;
    const promptsToSave = [];
    
    // Filter and prepare prompts (fast, in-memory only)
    for (const prompt of prompts) {
      // Create a unique ID based on content and timestamp
      const promptId = prompt.id || `${prompt.composerId || ''}_${prompt.timestamp || Date.now()}_${prompt.messageRole || 'user'}`;
      
      // Skip if already synced
      if (syncedPromptIds.has(promptId)) {
        skippedPrompts++;
        continue;
      }
      
      // Prepare prompt for database storage
      const dbPrompt = {
        id: db.nextId++,
        timestamp: prompt.timestamp || Date.now(),
        text: prompt.text || '',
        status: prompt.status || 'captured',
        source: prompt.source || 'cursor-database',
        workspaceId: prompt.workspaceId,
        workspacePath: prompt.workspacePath,
        workspaceName: prompt.workspaceName,
        composerId: prompt.composerId,
        subtitle: prompt.subtitle,
        contextUsage: prompt.contextUsage || 0,
        mode: prompt.mode,
        modelType: prompt.modelType,
        modelName: prompt.modelName,
        forceMode: prompt.forceMode,
        isAuto: prompt.isAuto || false,
        type: prompt.type || 'unknown',
        confidence: prompt.confidence || 'high',
        added_from_database: true,
        // Threading fields
        conversationTitle: prompt.conversationTitle,
        messageRole: prompt.messageRole, // 'user' or 'assistant'
        parentConversationId: prompt.parentConversationId,
        // Thinking time
        thinkingTimeSeconds: prompt.thinkingTimeSeconds,
        // Context data
        contextFiles: prompt.contextFiles || prompt.context?.contextFiles,
        terminalBlocks: prompt.terminalBlocks || [],
        hasAttachments: prompt.hasAttachments || false,
        attachmentCount: prompt.attachmentCount || 0
      };
      
      promptsToSave.push({ promptId, dbPrompt });
      syncedPromptIds.add(promptId);
    }
    
    // Batch save to database (if any new prompts)
    if (promptsToSave.length > 0) {
      console.log(`[SYNC] Saving ${promptsToSave.length} prompts to database...`);
      
      for (const { promptId, dbPrompt } of promptsToSave) {
        try {
          await persistentDB.savePrompt(dbPrompt);
          newPrompts++;
          
          // Link to active TODO if one exists (skip for performance)
          // if (currentActiveTodo) {
          //   await persistentDB.addPromptToTodo(currentActiveTodo, dbPrompt.id);
          //   await persistentDB.linkEventToTodo('prompt', dbPrompt.id);
          // }
          
        } catch (saveError) {
          console.warn(`[SYNC] Error saving prompt ${promptId}:`, saveError.message);
          syncedPromptIds.delete(promptId); // Remove from cache if save failed
        }
      }
    }
    
    console.log(`[SYNC] Sync complete: ${newPrompts} new, ${skippedPrompts} skipped, ${syncedPromptIds.size} total tracked (${prompts.length} available in Cursor DB)`);
    
    // Mark initial sync as complete
    if (!initialSyncComplete && syncedPromptIds.size > 0) {
      initialSyncComplete = true;
      console.log('[SYNC] Initial sync complete - future syncs disabled (prompts available via API)');
    }
    
  } catch (error) {
    console.error('[SYNC] Error syncing prompts from Cursor database:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    syncInProgress = false; // Release lock
  }
}

// Log file monitoring
async function captureLogData() {
  try {
    const logPaths = [
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/logs'),
      path.join(process.env.HOME || '', 'Library/Logs/Cursor')
    ];
    
    for (const logPath of logPaths) {
      if (fs.existsSync(logPath)) {
        const logFiles = fs.readdirSync(logPath)
          .filter(file => file.endsWith('.log'))
          .slice(-5); // Get last 5 log files
        
        for (const logFile of logFiles) {
          const fullPath = path.join(logPath, logFile);
          const stats = fs.statSync(fullPath);
          
          const logInfo = {
            timestamp: Date.now(),
            path: fullPath,
            size: stats.size,
            modified: stats.mtime,
            name: logFile
          };
          
          rawData.logs.cursor.push(logInfo);
        }
        
        // Keep only last 100 entries
        if (rawData.logs.cursor.length > 100) {
          rawData.logs.cursor = rawData.logs.cursor.slice(-100);
        }
        
        console.log(`Captured log data: ${logFiles.length} files`);
        break;
      }
    }
  } catch (error) {
    console.warn('Log capture failed:', error.message);
  }
}

// Helper function to find SQLite files
function findSQLiteFiles(dir) {
  const files = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...findSQLiteFiles(fullPath));
      } else if (item.endsWith('.db') || item.endsWith('.sqlite') || item.endsWith('.sqlite3')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
      // Ignore errors
    }
  return files;
}

// Start raw data capture intervals
function startRawDataCapture() {
  console.log('[LAUNCH] Starting enhanced raw data capture...');
  
  // Initialize IDE state capture
  ideStateCapture = new IDEStateCapture();
  ideStateCapture.start(2000); // Capture every 2 seconds
  
  // Initialize prompt capture system
  promptCaptureSystem = new PromptCaptureSystem();
  
  // Start status message tracking
  statusMessageTracker.start(2000); // Check every 2 seconds
  
  // Link status messages to context changes
  statusMessageTracker.on('fileRead', async (data) => {
    // Try to find recent context changes that might be related
    try {
      const recentChanges = await persistentDB.getContextChanges({
        startTime: data.timestamp - 5000, // 5 seconds before
        endTime: data.timestamp + 5000,   // 5 seconds after
        limit: 10
      });
      
      // Link to context changes that added this file
      for (const change of recentChanges) {
        if (change.addedFiles && change.addedFiles.includes(data.filePath)) {
          await persistentDB.linkStatusToContextChange(data.statusId, change.id);
          console.log(`[STATUS] Linked "Read ${data.filePath}" to context change ${change.id}`);
        }
      }
    } catch (error) {
      console.warn('Error linking status to context change:', error);
    }
  });
  
  // System resources every 5 seconds
  captureIntervals.systemResources = setInterval(captureSystemResources, 5000);
  
  // Git data every 30 seconds
  captureIntervals.gitStatus = setInterval(captureGitData, 30000);
  
  // AppleScript every 2 seconds
  captureIntervals.appleScript = setInterval(captureCursorAppState, 2000);
  
  // Cursor database every 5 seconds
  captureIntervals.cursorDatabase = setInterval(captureCursorDatabase, 5000);
  
  // Logs every 60 seconds
  captureIntervals.logs = setInterval(captureLogData, 60000);
  
  // NEW: Sync prompts from Cursor database every 30 seconds
  captureIntervals.promptSync = setInterval(syncPromptsFromCursorDB, 30000);
  
  // Initial capture
  captureSystemResources();
  captureGitData();
  captureCursorAppState();
  captureCursorDatabase();
  captureLogData();
  syncPromptsFromCursorDB(); // Initial sync
  
  console.log('[SUCCESS] Enhanced raw data capture started');
}

// Load configuration
let config;
let privacyConfig = {
  enabled: false,
  redactionLevel: 0.5,
  sensitivityLevel: 'medium',
  redactNames: true,
  redactNumbers: true,
  redactEmails: true,
  redactFilePaths: false,
  consentGiven: false
};

try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
  console.log(' Loaded configuration from config.json');
} catch (error) {
  console.log(' Using default configuration');
  config = {
    root_dir: process.cwd(),
    ignore: [
      'node_modules/**', 
      'dist/**', 
      '.git/**', 
      '.cursor/**',
      '**/node_modules/**',
      '**/package-lock.json',
      '**/yarn.lock',
      '**/.DS_Store',
      '**/Thumbs.db',
      '**/*.log',
      '**/coverage/**',
      '**/build/**',
      '**/tmp/**',
      '**/temp/**'
    ],
    diff_threshold: 12,
    enable_clipboard: false
  };
}

// Support automatic workspace detection
const workspacesToWatch = config.workspace_roots || config.workspaces || [config.root_dir];
const autoDetect = config.auto_detect_workspaces !== false;

console.log(' Configuration:', {
  root_dir: config.root_dir,
  workspace_roots: workspacesToWatch.length,
  auto_detect: autoDetect,
  ignore_count: config.ignore.length,
  diff_threshold: config.diff_threshold
});

// Set initial workspace (will be detected dynamically from file paths)
currentWorkspace = config.root_dir;
if (autoDetect) {
  console.log('[TARGET] Auto-detecting workspaces from activity in:', workspacesToWatch);
  console.log('[DATA] All workspaces will be discovered dynamically from file changes');
} else {
  console.log('[TARGET] Monitoring configured workspaces:', workspacesToWatch);
}

// ===================================
// Performance: Cache Utilities
// ===================================

// Cache invalidation helper
function invalidateCache(pattern) {
  const keys = queryCache.keys();
  const matching = keys.filter(k => k.includes(pattern));
  matching.forEach(k => queryCache.del(k));
  if (matching.length > 0) {
    console.log(`[CACHE] Invalidated ${matching.length} entries matching: ${pattern}`);
  }
}

// Cache wrapper for async functions
async function withCache(key, ttl, asyncFn) {
  const cached = queryCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  
  const result = await asyncFn();
  queryCache.set(key, result, ttl || 30);
  return result;
}

// Health check
app.get('/health', (req, res) => {
  const queueStats = queueSystem.getStats();
  const clipboardStats = clipboardMonitor.getStats();
  const cacheStats = queryCache.getStats();
  
  // No caching for health check
  res.set('Cache-Control', 'no-cache');
  
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    entries: db.entries.length,
    prompts: db.prompts.length,
    queue_length: queue.length,
    sequence: sequence,
    queue_stats: queueStats,
    clipboard_stats: clipboardStats,
    raw_data_stats: {
      systemResources: rawData.systemResources.length,
      gitData: rawData.gitData.status.length,
      cursorDatabase: rawData.cursorDatabase.conversations.length,
      appleScript: rawData.appleScript.appState.length,
      logs: rawData.logs.cursor.length
    },
    cache_stats: {
      keys: queryCache.keys().length,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
    }
  });
});

// Get queue
app.get('/queue', (req, res) => {
  const since = Number(req.query.since || 0);
  
  console.log(`� Queue request: since=${since}, queue_length=${queue.length}`);
  
  const newItems = queue.filter(item => item.seq > since);
  const newEntries = newItems.filter(item => item.kind === 'entry').map(item => item.payload);
  const newEvents = newItems.filter(item => item.kind === 'event').map(item => item.payload);
  
  console.log(`� Queue response: ${newEntries.length} entries, ${newEvents.length} events since seq ${since}`);
  
  // Use all available data for comprehensive analysis
  const limitedEntries = newEntries; // No limit - use all entries
  const limitedEvents = newEvents; // No limit - use all events
  
  // Use full content for comprehensive analysis
  const cleanedEntries = limitedEntries.map(entry => ({
    ...entry,
    content: entry.content || '', // Use full content
    before_code: entry.before_code || '',
    after_code: entry.after_code || ''
  }));
  
  const cleanedEvents = limitedEvents.map(event => ({
    ...event,
    details: event.details ? JSON.stringify(JSON.parse(event.details || '{}')) : '{}'
  }));
  
  res.json({
    entries: cleanedEntries,
    events: cleanedEvents,
    cursor: sequence
  });
});

// Multi-workspace API endpoints
// Get conversations for a workspace
app.get('/api/workspaces/:workspaceId/conversations', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    const conversations = await persistentDB.getConversationsByWorkspace(workspaceId, limit);
    
    res.json({
      success: true,
      data: conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get audit log
app.get('/api/audit-log', async (req, res) => {
  try {
    const options = {
      workspaceId: req.query.workspaceId || null,
      operationType: req.query.operationType || null,
      limit: parseInt(req.query.limit) || 100,
      offset: parseInt(req.query.offset) || 0
    };
    
    const auditLog = await persistentDB.getAuditLog(options);
    
    res.json({
      success: true,
      data: auditLog,
      count: auditLog.length
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/workspaces', async (req, res) => {
  try {
    // Get ALL workspaces from Cursor (including old/stale ones)
    const allCursorWorkspaces = await cursorDbParser.getAllWorkspaces();
    
    // Get prompt data to enrich workspace info
    const cursorData = await cursorDbParser.getAllData();
    
    // Build workspace list from Cursor database first (this is the source of truth)
    const workspaces = allCursorWorkspaces.map(ws => {
      // Count prompts for this workspace
      const wsPrompts = cursorData.prompts.filter(p => p.workspaceId === ws.id);
      
      // Check if we have activity data for this workspace
      const activityData = workspaceData.get(ws.path);
      
      return {
        id: ws.id,
        path: ws.path || `Unknown (${ws.id.substring(0, 8)})`,
        name: ws.name,
        entries: activityData?.entries?.length || 0,
        events: activityData?.events?.length || 0,
        promptCount: wsPrompts.length,
        lastActivity: activityData?.lastActivity || ws.lastAccessed,
        lastAccessed: ws.lastAccessed,
        created: ws.created,
        sessionId: workspaceSessions.get(ws.path),
        active: activityData ? true : false,
        exists: ws.exists,
        fromCursorDb: true
      };
    });
    
    // Add any workspaces from knownWorkspaces that weren't in Cursor DB
    Array.from(knownWorkspaces).forEach(wsPath => {
      if (!workspaces.find(w => w.path === wsPath)) {
        const activityData = workspaceData.get(wsPath);
        workspaces.push({
          path: wsPath,
          name: wsPath.split('/').pop() || 'Unknown',
          entries: activityData?.entries?.length || 0,
          events: activityData?.events?.length || 0,
          promptCount: 0,
          lastActivity: activityData?.lastActivity || null,
          sessionId: workspaceSessions.get(wsPath),
          active: activityData ? true : false,
          exists: true,
          fromCursorDb: false
        });
      }
    });
    
    // Sort by lastActivity/lastAccessed (most recent first)
    workspaces.sort((a, b) => {
      const aTime = a.lastActivity || a.lastAccessed || 0;
      const bTime = b.lastActivity || b.lastAccessed || 0;
      return new Date(bTime) - new Date(aTime);
    });
    
    res.json(workspaces);
  } catch (error) {
    console.error('Error getting workspaces:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workspace/:workspacePath/activity', (req, res) => {
  const { workspacePath } = req.params;
  const data = workspaceData.get(workspacePath);
  if (!data) {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  res.json({
    entries: data.entries,
    events: data.events,
    lastActivity: data.lastActivity
  });
});

app.get('/api/workspace/:workspacePath/sessions', (req, res) => {
  const { workspacePath } = req.params;
  const workspaceEntries = entries.filter(entry => entry.workspace_path === workspacePath);
  const sessionIds = [...new Set(workspaceEntries.map(entry => entry.session_id))];
  res.json(sessionIds);
});

// Raw data API endpoints
app.get('/raw-data/system-resources', (req, res) => {
  const { limit = 10000, since } = req.query;
  let data = rawData.systemResources;
  
  if (since) {
    const sinceTime = parseInt(since);
    data = data.filter(item => item.timestamp >= sinceTime);
  }
  
  data = data.slice(-parseInt(limit));
  
  res.json({
    success: true,
    data: data,
    count: data.length,
    total: rawData.systemResources.length
  });
});

app.get('/raw-data/git', (req, res) => {
  const { limit = 50, since } = req.query;
  let data = rawData.gitData.status;
  
  if (since) {
    const sinceTime = parseInt(since);
    data = data.filter(item => item.timestamp >= sinceTime);
  }
  
  data = data.slice(-parseInt(limit));
  
  res.json({
    success: true,
    data: data,
    count: data.length,
    total: rawData.gitData.status.length
  });
});

app.get('/raw-data/cursor-database', (req, res) => {
  const { limit = 20, since } = req.query;
  let data = rawData.cursorDatabase.conversations;
  
  if (since) {
    const sinceTime = parseInt(since);
    data = data.filter(item => item.timestamp >= sinceTime);
  }
  
  data = data.slice(-parseInt(limit));
  
  res.json({
    success: true,
    data: data,
    count: data.length,
    total: rawData.cursorDatabase.conversations.length
  });
});

app.get('/raw-data/apple-script', (req, res) => {
  const { limit = 10000, since } = req.query;
  let data = rawData.appleScript.appState;
  
  if (since) {
    const sinceTime = parseInt(since);
    data = data.filter(item => item.timestamp >= sinceTime);
  }
  
  data = data.slice(-parseInt(limit));
  
  res.json({
    success: true,
    data: data,
    count: data.length,
    total: rawData.appleScript.appState.length
  });
});

app.get('/raw-data/logs', (req, res) => {
  const { limit = 50, since } = req.query;
  let data = rawData.logs.cursor;
  
  if (since) {
    const sinceTime = parseInt(since);
    data = data.filter(item => item.timestamp >= sinceTime);
  }
  
  data = data.slice(-parseInt(limit));
  
  res.json({
    success: true,
    data: data,
    count: data.length,
    total: rawData.logs.cursor.length
  });
});

app.get('/raw-data/all', (req, res) => {
  const { limit = 50, since } = req.query;
  
  const allData = {
    systemResources: rawData.systemResources.slice(-parseInt(limit)),
    gitData: rawData.gitData.status.slice(-parseInt(limit)),
    cursorDatabase: rawData.cursorDatabase.conversations.slice(-parseInt(limit)),
    appleScript: rawData.appleScript.appState.slice(-parseInt(limit)),
    logs: rawData.logs.cursor.slice(-parseInt(limit))
  };
  
  res.json({
    success: true,
    data: allData,
    counts: {
      systemResources: rawData.systemResources.length,
      gitData: rawData.gitData.status.length,
      cursorDatabase: rawData.cursorDatabase.conversations.length,
      appleScript: rawData.appleScript.appState.length,
      logs: rawData.logs.cursor.length
    }
  });
});

// IDE state API endpoints
app.get('/ide-state', (req, res) => {
  try {
    if (!ideStateCapture) {
      return res.status(503).json({ 
        success: false, 
        error: 'IDE state capture not initialized' 
      });
    }

    const latestState = ideStateCapture.getLatestState();
    
    res.json({
      success: true,
      data: latestState,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting IDE state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/ide-state/history', (req, res) => {
  try {
    if (!ideStateCapture) {
      return res.status(503).json({ 
        success: false, 
        error: 'IDE state capture not initialized' 
      });
    }

    const { limit = 10000, since = 0 } = req.query;
    const data = ideStateCapture.getCachedData(parseInt(limit), parseInt(since));
    
    res.json(data);
  } catch (error) {
    console.error('Error getting IDE state history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/ide-state/editor', (req, res) => {
  try {
    if (!ideStateCapture) {
      return res.status(503).json({ 
        success: false, 
        error: 'IDE state capture not initialized' 
      });
    }

    const latestState = ideStateCapture.getLatestState();
    const editorState = latestState?.editorState || null;
    
    res.json({
      success: true,
      data: editorState,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting editor state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/ide-state/workspace', (req, res) => {
  try {
    if (!ideStateCapture) {
      return res.status(503).json({ 
        success: false, 
        error: 'IDE state capture not initialized' 
      });
    }

    const latestState = ideStateCapture.getLatestState();
    const workspaceState = latestState?.workspaceState || null;
    
    res.json({
      success: true,
      data: workspaceState,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting workspace state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/ide-state/debug', (req, res) => {
  try {
    if (!ideStateCapture) {
      return res.status(503).json({ 
        success: false, 
        error: 'IDE state capture not initialized' 
      });
    }

    const latestState = ideStateCapture.getLatestState();
    const debugState = latestState?.debugState || null;
    
    res.json({
      success: true,
      data: debugState,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting debug state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/ide-state/cursor', (req, res) => {
  try {
    if (!ideStateCapture) {
      return res.status(503).json({ 
        success: false, 
        error: 'IDE state capture not initialized' 
      });
    }

    const latestState = ideStateCapture.getLatestState();
    const cursorState = latestState?.cursorSpecificState || null;
    
    res.json({
      success: true,
      data: cursorState,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error getting Cursor-specific state:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get entries with linked prompts
// API endpoint for activity data (used by dashboard) with pagination - OPTIMIZED with caching
app.get('/api/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Max 500 at a time
    const offset = parseInt(req.query.offset) || 0;
    
    // Add cache control headers (30 seconds)
    res.set('Cache-Control', 'public, max-age=30, must-revalidate');
    res.set('ETag', `W/"activity-${sequence}-${limit}-${offset}"`);
    
    // Cache key based on params
    const cacheKey = `activity_${limit}_${offset}_${sequence}`;
    
    // Try to get from cache first
    const cached = await withCache(cacheKey, 30, async () => {
      //  Get total count and limited entries separately
      const totalCount = await persistentDB.getTotalEntriesCount();
      const allEntries = await persistentDB.getRecentEntries(limit + offset);
      const allPrompts = await persistentDB.getRecentPrompts(limit);
      
      // Already sorted by database query (ORDER BY timestamp DESC)
      // Apply offset/limit
      const paginatedEntries = allEntries.slice(offset, Math.min(offset + limit, allEntries.length));
      
      return { totalCount, allEntries, allPrompts, paginatedEntries };
    });
    
    const { totalCount, allEntries, allPrompts, paginatedEntries } = cached;
    
    // Convert entries to events format for dashboard compatibility
    const events = paginatedEntries.map(entry => {
      // Extract diff stats from notes field (e.g., "Diff: +172 chars")
      let diffStats = {};
      
      if (entry.notes) {
        const charsMatch = entry.notes.match(/Diff: \+(\d+) chars/);
        if (charsMatch) {
          const chars = parseInt(charsMatch[1]);
          diffStats = {
            chars_added: chars,
            chars_deleted: 0  // Notes format doesn't distinguish add/delete, just total change
          };
        }
      }
      
      // If we have full content (not loaded by default), calculate precise stats
      if (entry.before_code && entry.after_code) {
        const diff = calculateDiff(entry.before_code, entry.after_code);
        diffStats = {
          lines_added: diff.linesAdded,
          lines_removed: diff.linesRemoved,
          chars_added: diff.charsAdded,
          chars_deleted: diff.charsDeleted,
          // Truncate large content to prevent memory issues
          before_content: diff.beforeContent.length > 5000 ? diff.beforeContent.substring(0, 5000) + '\n... (truncated)' : diff.beforeContent,
          after_content: diff.afterContent.length > 5000 ? diff.afterContent.substring(0, 5000) + '\n... (truncated)' : diff.afterContent
        };
      }
      
      return {
        id: entry.id,
        type: entry.type || 'file_change',
        timestamp: entry.timestamp,
        session_id: entry.session_id || 'default',
        workspace_path: entry.workspace_path || entry.file_path || '/unknown',
        file_path: entry.file_path,
        details: JSON.stringify({
          content: entry.content ? (entry.content.length > 5000 ? entry.content.substring(0, 5000) + '\n... (truncated)' : entry.content) : null,
          before_content: entry.before_content || entry.before_code,
          after_content: entry.after_content || entry.after_code,
          diff: entry.diff,
          file_path: entry.file_path,
          workspace_path: entry.workspace_path,
          ...diffStats
        }),
        title: entry.title || `File Change: ${entry.file_path ? entry.file_path.split('/').pop() : 'Unknown'}`,
        description: entry.description || entry.notes || 'File change detected',
        // Include metadata fields for modal display
        modelInfo: entry.modelInfo,  // Model information (parsed from JSON)
        tags: entry.tags || [],  // Tags array
        prompt_id: entry.prompt_id,  // Linked prompt ID
        notes: entry.notes,  // User notes
        source: entry.source  // Source of the entry
      };
    });
    
    console.log(`[API] Returning ${events.length} of ${totalCount} activity events (offset: ${offset})`);
    res.json({
      data: events,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + events.length < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({ error: 'Failed to fetch activity data' });
  }
});

// Streaming endpoint for large datasets - returns data progressively
app.get('/api/activity/stream', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Allow more for streaming
    const offset = parseInt(req.query.offset) || 0;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.write('{"data":[');
    
    const entries = await persistentDB.getRecentEntries(limit + offset);
    const paginatedEntries = entries.slice(offset, offset + limit);
    
    let first = true;
    for (const entry of paginatedEntries) {
      if (!first) res.write(',');
      
      const event = {
        id: entry.id,
        type: entry.type || 'file_change',
        timestamp: entry.timestamp,
        session_id: entry.session_id || 'default',
        workspace_path: entry.workspace_path || entry.file_path || '/unknown',
        file_path: entry.file_path,
        title: entry.title || `File Change: ${entry.file_path ? entry.file_path.split('/').pop() : 'Unknown'}`,
        description: entry.description || entry.notes || 'File change detected',
        modelInfo: entry.modelInfo,
        tags: entry.tags || [],
        prompt_id: entry.prompt_id,
        source: entry.source
      };
      
      res.write(JSON.stringify(event));
      first = false;
      
      // Flush every 10 items for progressive loading
      if (paginatedEntries.indexOf(entry) % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    res.write('],"pagination":{');
    res.write(`"total":${entries.length},`);
    res.write(`"limit":${limit},`);
    res.write(`"offset":${offset},`);
    res.write(`"hasMore":${offset + paginatedEntries.length < entries.length}`);
    res.write('}}');
    res.end();
    
    console.log(`[STREAM] Streamed ${paginatedEntries.length} events`);
  } catch (error) {
    console.error('Error streaming activity data:', error);
    res.status(500).json({ error: 'Failed to stream activity data' });
  }
});

// Debug endpoint to check companion service data
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'companion service running',
    timestamp: new Date().toISOString(),
    database: {
      entries: db.entries.length,
      prompts: db.prompts.length,
      sampleEntry: db.entries[0] || null,
      samplePrompt: db.prompts[0] || null
    },
    queue: {
      length: queue.length,
      sample: queue[0] || null
    }
  });
});

app.get('/entries', async (req, res) => {
  try {
    // Use pagination - don't load everything
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const allPrompts = await persistentDB.getRecentPrompts(limit);
    
    // Also get prompts from Cursor database
    try {
      const cursorData = await cursorDbParser.getAllData();
      const cursorPrompts = cursorData.prompts || [];
      
      // Add Cursor database prompts to response
      const combined = [
        ...allPrompts,
        ...cursorPrompts.map(p => ({
          id: `cursor_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          timestamp: p.timestamp || new Date().toISOString(),
          text: p.text,
          status: p.status || 'captured',
          source: 'cursor-database',
          method: 'database-extraction',
          confidence: p.confidence || 'medium',
          // Include context and code change metadata
          contextUsage: p.contextUsage || 0,
          linesAdded: p.linesAdded || 0,
          linesRemoved: p.linesRemoved || 0,
          mode: p.mode,
          modelName: p.modelName,
          modelType: p.modelType,
          isAuto: p.isAuto,
          workspaceName: p.workspaceName,
          workspacePath: p.workspacePath,
          composerId: p.composerId,
          subtitle: p.subtitle,
          contextFiles: p.contextFiles
        }))
      ];
      
      res.json({ entries: combined });
    } catch (dbError) {
      console.warn('Could not extract Cursor database prompts:', dbError.message);
      res.json({ entries: allPrompts });
    }
  } catch (error) {
    console.error('Error fetching entries with prompts:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// New endpoint specifically for Cursor database data
// Supports incremental sync via ?since=timestamp query param
app.get('/api/cursor-database', async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since) : null;
    
    // If since is provided, try to return only new data (if parser supports it)
    // For now, we'll use the cache which is updated every 5 minutes
    // This means incremental sync will work if last sync was > 5 min ago
    const data = await cursorDbParser.getAllData();
    
    // Filter prompts by timestamp if since is provided (basic incremental support)
    let filteredData = data;
    if (since && data.prompts) {
      filteredData = {
        ...data,
        prompts: data.prompts.filter(p => {
          const promptTime = p.timestamp ? new Date(p.timestamp).getTime() : 0;
          return promptTime > since;
        })
      };
      
      // If no new prompts, return early with empty result
      if (filteredData.prompts.length === 0) {
        return res.json({
          success: true,
          data: {
            conversations: [],
            prompts: [],
            stats: { totalPrompts: 0, totalConversations: 0 }
          },
          timestamp: Date.now(),
          incremental: true,
          newItems: 0
        });
      }
    }
    
    res.json({
      success: true,
      data: filteredData,
      timestamp: Date.now(),
      incremental: !!since,
      newItems: since ? filteredData.prompts.length : data.prompts.length
    });
  } catch (error) {
    console.error('Error fetching Cursor database:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper to resolve Git object hash to actual content/name
function resolveGitObject(hash, filePath) {
  if (!hash || hash.length !== 40) return null;
  
  try {
    // Try to get the type and content of the Git object
    const typeResult = execSync(`git cat-file -t ${hash} 2>/dev/null`, { 
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    if (typeResult === 'blob') {
      // It's a file - try to find its name from git show
      const showResult = execSync(`git show --name-only --format="" ${hash} 2>/dev/null || echo ""`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      if (showResult) {
        return showResult.split('\n')[0]; // First line is the filename
      }
    } else if (typeResult === 'commit') {
      // It's a commit - get the commit message subject
      const commitMsg = execSync(`git log --format=%s -n 1 ${hash} 2>/dev/null || echo ""`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      
      return commitMsg ? `Commit: ${commitMsg}` : `Commit ${hash.substring(0, 7)}`;
    } else if (typeResult === 'tree') {
      return `Tree ${hash.substring(0, 7)}`;
    }
  } catch (error) {
    // Git command failed, object doesn't exist in repo
    return null;
  }
  
  return null;
}

// Helper to decode git ref files
function decodeGitRef(filePath, content) {
  // For files like .git/refs/heads/master or .git/HEAD
  if (filePath.includes('.git/refs/heads/')) {
    const branch = filePath.split('.git/refs/heads/').pop();
    return `Branch ref: ${branch}`;
  }
  if (filePath.includes('.git/refs/remotes/')) {
    const remote = filePath.split('.git/refs/remotes/').pop();
    return `Remote ref: ${remote}`;
  }
  if (filePath.endsWith('.git/HEAD')) {
    // Parse HEAD content
    const match = content.match(/ref: refs\/heads\/(\w+)/);
    if (match) {
      return `HEAD -> ${match[1]}`;
    }
  }
  if (filePath.endsWith('.git/ORIG_HEAD') || filePath.endsWith('.git/FETCH_HEAD')) {
    const type = filePath.split('/').pop();
    return `Git ${type}`;
  }
  
  return null;
}

// API endpoint for screenshots
app.get('/api/screenshots', (req, res) => {
  try {
    const { limit, recent, since, until } = req.query;
    
    let screenshots = [];
    
    if (recent) {
      // Get recent screenshots
      screenshots = screenshotMonitor.getRecentScreenshots(parseInt(recent) || 10);
    } else if (since && until) {
      // Get screenshots in time range
      const startTime = new Date(since).getTime();
      const endTime = new Date(until).getTime();
      screenshots = screenshotMonitor.getScreenshotsInRange(startTime, endTime);
    } else {
      // Get all screenshots
      screenshots = screenshotMonitor.getAllScreenshots();
      if (limit) {
        screenshots = screenshots.slice(0, parseInt(limit));
      }
    }
    
    res.json({
      success: true,
      screenshots: screenshots,
      stats: screenshotMonitor.getStats()
    });
  } catch (error) {
    console.error('Error getting screenshots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to serve images (proxy for file:// URLs)
app.get('/api/image', async (req, res) => {
  try {
    let filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }
    
    // Decode URL-encoded path (handles spaces, special characters)
    // The path might be double-encoded or have plus signs instead of spaces
    try {
      filePath = decodeURIComponent(filePath);
      // Replace + with spaces if needed (some browsers encode spaces as +)
      filePath = filePath.replace(/\+/g, ' ');
    } catch (decodeError) {
      console.warn('[IMAGE] Path decode warning:', decodeError.message);
      // If decoding fails, try using the path as-is
    }
    
    // Resolve the file path
    let resolvedPath = filePath;
    
    // Handle relative paths (e.g., "Desktop/file.png")
    if (!path.isAbsolute(filePath)) {
      // Try resolving from user's home directory
      const homeDir = os.homedir();
      resolvedPath = path.join(homeDir, filePath);
    }
    
    // Normalize the path (resolves . and .., handles duplicate slashes)
    resolvedPath = path.normalize(resolvedPath);
    
    // Security: Only allow files within user's home directory
    const homeDir = os.homedir();
    const homeDirNormalized = path.normalize(homeDir);
    if (!resolvedPath.startsWith(homeDirNormalized)) {
      console.warn('[IMAGE] Security check failed:', { resolvedPath, homeDir: homeDirNormalized });
      return res.status(403).json({ error: 'Access denied: File outside home directory' });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      console.warn('[IMAGE] File not found:', resolvedPath);
      return res.status(404).json({ error: 'File not found', path: resolvedPath });
    }
    
    // Check if it's actually a file (not a directory)
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file' });
    }
    
    // Check if it's an image file
    const ext = path.extname(resolvedPath).toLowerCase();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];
    if (!imageExts.includes(ext)) {
      return res.status(400).json({ error: 'Not an image file', ext });
    }
    
    // Read and serve the file (use async to avoid blocking)
    const fileBuffer = await fs.promises.readFile(resolvedPath);
    
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp'
    };
    
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Length', fileBuffer.length);
    
    // Send the file buffer
    res.send(fileBuffer);
    
    console.log(`[IMAGE] Served: ${resolvedPath} (${(fileBuffer.length / 1024).toFixed(2)}KB)`);
    
  } catch (error) {
    console.error('[IMAGE] Error serving image:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve image', details: error.message });
    }
  }
});

// API endpoint to get screenshots near a specific time
app.get('/api/screenshots/near/:timestamp', (req, res) => {
  try {
    const timestamp = req.params.timestamp;
    const windowMs = parseInt(req.query.window) || 5 * 60 * 1000; // 5 minutes default
    
    const screenshots = screenshotMonitor.findScreenshotsNearTime(timestamp, windowMs);
    
    res.json({
      success: true,
      screenshots: screenshots,
      count: screenshots.length
    });
  } catch (error) {
    console.error('Error finding screenshots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================================
// NEW ANALYTICS ENDPOINTS
// ===================================

// Context Analytics Endpoints
app.get('/api/analytics/context', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    
    const analytics = await withCache('context_analytics', 30, async () => {
      // Pull from database for persistent data
      return await persistentDB.getContextAnalytics();
    });
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting context analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/context/snapshots', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const since = parseInt(req.query.since) || 0;
    const source = req.query.source || 'memory'; // 'memory' or 'database'
    
    let snapshots;
    if (source === 'database') {
      // Get from persistent database for historical data
      snapshots = await persistentDB.getContextSnapshots({ limit, since });
    } else {
      // Get from in-memory for recent data
      snapshots = contextAnalyzer.getRecentSnapshots(limit);
    }
    
    res.json({
      success: true,
      data: snapshots,
      count: snapshots.length,
      source
    });
  } catch (error) {
    console.error('Error getting context snapshots:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get persistent context analytics from database
app.get('/api/analytics/context/historical', async (req, res) => {
  try {
    const analytics = await persistentDB.getContextAnalytics();
    res.json({
      success: true,
      data: analytics,
      source: 'database'
    });
  } catch (error) {
    console.error('Error getting historical context analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/context/timeline', (req, res) => {
  try {
    const timeline = contextAnalyzer.getContextTimeline();
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    console.error('Error getting context timeline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cache for file relationship graph
const fileGraphCache = new Map();
const GRAPH_CACHE_TTL = 30000; // 30 seconds

app.get('/api/analytics/context/file-relationships', (req, res) => {
  try {
    const minCount = parseInt(req.query.minCount) || 2;
    const cacheKey = `graph:${minCount}`;
    
    // Check cache
    const cached = fileGraphCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < GRAPH_CACHE_TTL) {
      res.set('X-Cache', 'HIT');
      return res.json({
        success: true,
        data: cached.data,
        cached: true
      });
    }
    
    // Generate graph
    const graph = contextAnalyzer.getFileRelationshipGraph(minCount);
    
    // Cache result
    fileGraphCache.set(cacheKey, {
      data: graph,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (fileGraphCache.size > 10) {
      const oldestKey = Array.from(fileGraphCache.keys())[0];
      fileGraphCache.delete(oldestKey);
    }
    
    res.set('X-Cache', 'MISS');
    res.json({
      success: true,
      data: graph
    });
  } catch (error) {
    console.error('Error getting file relationships:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Context Changes Endpoints - Track files added/removed from context
app.get('/api/analytics/context/changes', async (req, res) => {
  try {
    const {
      promptId = null,
      eventId = null,
      taskId = null,
      sessionId = null,
      startTime = null,
      endTime = null,
      limit = parseInt(req.query.limit) || 100
    } = req.query;

    const options = {
      promptId: promptId || null,
      eventId: eventId || null,
      taskId: taskId || null,
      sessionId: sessionId || null,
      startTime: startTime ? parseInt(startTime) : null,
      endTime: endTime ? parseInt(endTime) : null,
      limit: parseInt(limit)
    };

    const changes = await persistentDB.getContextChanges(options);
    
    res.json({
      success: true,
      data: changes,
      count: changes.length,
      filters: options
    });
  } catch (error) {
    console.error('Error getting context changes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get context changes for a specific prompt
app.get('/api/prompts/:id/context-changes', async (req, res) => {
  try {
    const promptId = req.params.id;
    const changes = await contextChangeTracker.getContextChangesForPrompt(promptId);
    
    res.json({
      success: true,
      data: changes,
      count: changes.length,
      promptId
    });
  } catch (error) {
    console.error('Error getting context changes for prompt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get context changes for a specific event
app.get('/api/events/:id/context-changes', async (req, res) => {
  try {
    const eventId = req.params.id;
    const changes = await contextChangeTracker.getContextChangesForEvent(eventId);
    
    res.json({
      success: true,
      data: changes,
      count: changes.length,
      eventId
    });
  } catch (error) {
    console.error('Error getting context changes for event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get context changes summary statistics
app.get('/api/analytics/context/changes/summary', (req, res) => {
  try {
    const stats = contextChangeTracker.getSummaryStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting context changes summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================================
// SCHEMA CONFIGURATION ENDPOINTS
// ===================================

// Get full database schema
app.get('/api/schema', async (req, res) => {
  try {
    const schema = await persistentDB.getSchema();
    res.json({
      success: true,
      data: schema
    });
  } catch (error) {
    console.error('Error getting schema:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get schema for a specific table
app.get('/api/schema/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const tableSchema = await persistentDB.getTableSchema(tableName);
    res.json({
      success: true,
      data: tableSchema
    });
  } catch (error) {
    console.error(`Error getting schema for table ${req.params.tableName}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a column to a table
app.post('/api/schema/:tableName/columns', async (req, res) => {
  try {
    const { tableName } = req.params;
    const columnDef = req.body;
    
    if (!columnDef.name || !columnDef.type) {
      return res.status(400).json({
        success: false,
        error: 'Column name and type are required'
      });
    }
    
    const result = await persistentDB.addColumn(tableName, columnDef);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(`Error adding column to ${req.params.tableName}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get custom field configurations
app.get('/api/schema/config/fields', async (req, res) => {
  try {
    const { tableName } = req.query;
    const configs = await persistentDB.getCustomFieldConfigs(tableName || null);
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error getting custom field configs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save custom field configuration
app.post('/api/schema/config/fields', async (req, res) => {
  try {
    const config = req.body;
    
    if (!config.tableName || !config.fieldName || !config.fieldType) {
      return res.status(400).json({
        success: false,
        error: 'tableName, fieldName, and fieldType are required'
      });
    }
    
    const result = await persistentDB.saveCustomFieldConfig(config);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error saving custom field config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete custom field configuration
app.delete('/api/schema/config/fields/:tableName/:fieldName', async (req, res) => {
  try {
    const { tableName, fieldName } = req.params;
    const result = await persistentDB.deleteCustomFieldConfig(tableName, fieldName);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error deleting custom field config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================================
// STATUS MESSAGE ENDPOINTS
// ===================================

// Get status messages
app.get('/api/status-messages', async (req, res) => {
  try {
    const {
      startTime = null,
      endTime = null,
      type = null,
      action = null,
      limit = parseInt(req.query.limit) || 100
    } = req.query;

    const options = {
      startTime: startTime ? parseInt(startTime) : null,
      endTime: endTime ? parseInt(endTime) : null,
      type: type || null,
      action: action || null,
      limit: parseInt(limit)
    };

    const messages = await persistentDB.getStatusMessages(options);
    
    res.json({
      success: true,
      data: messages,
      count: messages.length,
      filters: options
    });
  } catch (error) {
    console.error('Error getting status messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error Tracking Endpoints
app.get('/api/analytics/errors', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    
    const stats = await withCache('error_stats', 30, async () => {
      return errorTracker.getErrorStats();
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting error stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analytics/errors/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const errors = errorTracker.getRecentErrors(limit);
    res.json({
      success: true,
      data: errors,
      count: errors.length
    });
  } catch (error) {
    console.error('Error getting recent errors:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Productivity Metrics Endpoints
app.get('/api/analytics/productivity', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    
    const stats = await withCache('productivity_stats', 30, async () => {
      // Pass database to calculate from persistent data
      return await productivityTracker.getProductivityStats(persistentDB);
    });
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting productivity stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Terminal Monitoring Endpoints
app.get('/api/terminal/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const source = req.query.source;
    const since = req.query.since ? parseInt(req.query.since) : null;
    const workspace = req.query.workspace;
    const exitCode = req.query.exitCode ? parseInt(req.query.exitCode) : undefined;
    
    // Fetch from database for persistent history
    const history = await persistentDB.getTerminalCommands({ 
      limit, 
      source, 
      since,
      workspace,
      exitCode
    });
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting terminal history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/terminal/stats', async (req, res) => {
  try {
    // Get stats from both in-memory and database
    const memoryStats = terminalMonitor.getStats();
    const allCommands = await persistentDB.getAllTerminalCommands();
    
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    const recentCommands = allCommands.filter(cmd => cmd.timestamp > last24h);
    const errorCommands = allCommands.filter(cmd => cmd.exit_code && cmd.exit_code !== 0);
    
    // Count by source
    const bySource = {};
    allCommands.forEach(cmd => {
      bySource[cmd.source] = (bySource[cmd.source] || 0) + 1;
    });
    
    // Most common commands
    const commandCounts = {};
    allCommands.forEach(cmd => {
      const shortCmd = cmd.command.split(' ')[0]; // Get first word
      commandCounts[shortCmd] = (commandCounts[shortCmd] || 0) + 1;
    });
    const topCommands = Object.entries(commandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ command: cmd, count }));
    
    res.json({
      success: true,
      data: {
        total: allCommands.length,
        last24h: recentCommands.length,
        errorCount: errorCommands.length,
        errorRate: allCommands.length > 0 ? (errorCommands.length / allCommands.length * 100).toFixed(2) : 0,
        bySource: bySource,
        topCommands: topCommands,
        memory: memoryStats
      }
    });
  } catch (error) {
    console.error('Error getting terminal stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/terminal/enable', (req, res) => {
  try {
    terminalMonitor.start();
    res.json({
      success: true,
      message: 'Terminal monitoring enabled'
    });
  } catch (error) {
    console.error('Error enabling terminal monitoring:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/terminal/disable', (req, res) => {
  try {
    terminalMonitor.stop();
    res.json({
      success: true,
      message: 'Terminal monitoring disabled'
    });
  } catch (error) {
    console.error('Error disabling terminal monitoring:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===================================
// DATABASE MANAGEMENT ENDPOINTS
// ===================================

// Database statistics and integrity
app.get('/api/database/stats', async (req, res) => {
  try {
    const stats = await persistentDB.getStats();
    const integrity = await persistentDB.validateIntegrity();
    
    res.json({
      success: true,
      stats,
      integrity
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get entries with linked prompts
app.get('/api/database/entries-with-prompts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const entries = await persistentDB.getEntriesWithPrompts(limit);
    
    res.json({
      success: true,
      data: entries,
      count: entries.length
    });
  } catch (error) {
    console.error('Error getting entries with prompts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get prompts with linked entries
app.get('/api/database/prompts-with-entries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const prompts = await persistentDB.getPromptsWithEntries(limit);
    
    res.json({
      success: true,
      data: prompts,
      count: prompts.length
    });
  } catch (error) {
    console.error('Error getting prompts with entries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// NEW: Get context files for a specific prompt
app.get('/api/prompts/:id/context-files', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get prompt with context files
    const prompts = await persistentDB.getAllPrompts();
    const prompt = prompts.find(p => p.id == id);
    
    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found'
      });
    }
    
    // Parse context files if stored as JSON
    let contextFiles = [];
    let counts = { total: 0, explicit: 0, tabs: 0, auto: 0 };
    
    if (prompt.context_files_json) {
      try {
        contextFiles = JSON.parse(prompt.context_files_json);
      } catch (e) {
        console.warn('Error parsing context files JSON:', e.message);
      }
    }
    
    counts = {
      total: prompt.context_file_count || contextFiles.length || 0,
      explicit: prompt.context_file_count_explicit || 0,
      tabs: prompt.context_file_count_tabs || 0,
      auto: prompt.context_file_count_auto || 0
    };
    
    res.json({
      success: true,
      promptId: parseInt(id),
      promptText: prompt.text,
      mode: prompt.mode,
      contextUsage: prompt.context_usage,
      fileCount: counts.total,
      counts: counts,
      files: contextFiles
    });
    
  } catch (error) {
    console.error('Error getting prompt context files:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NEW: Get file usage statistics across all prompts
app.get('/api/analytics/file-usage', async (req, res) => {
  try {
    const prompts = await persistentDB.getAllPrompts();
    
    // Aggregate file usage statistics
    const fileUsage = new Map();
    let totalFileCount = 0;
    let totalPrompts = 0;
    let explicitCount = 0;
    let autoCount = 0;
    
    prompts.forEach(prompt => {
      if (prompt.context_file_count > 0) {
        totalFileCount += prompt.context_file_count;
        totalPrompts++;
        explicitCount += prompt.context_file_count_explicit || 0;
        autoCount += prompt.context_file_count_auto || 0;
        
        // Parse individual files
        if (prompt.context_files_json) {
          try {
            const files = JSON.parse(prompt.context_files_json);
            files.forEach(file => {
              const filePath = file.path || file;
              const existing = fileUsage.get(filePath) || { count: 0, sources: new Set(), name: file.name || filePath };
              existing.count++;
              existing.sources.add(file.source || 'unknown');
              fileUsage.set(filePath, existing);
            });
          } catch (e) {
            // Skip parsing errors
          }
        }
      }
    });
    
    // Sort files by usage
    const sortedFiles = Array.from(fileUsage.entries())
      .map(([path, data]) => ({
        path,
        name: data.name,
        count: data.count,
        sources: Array.from(data.sources)
      }))
      .sort((a, b) => b.count - a.count);
    
    // Calculate distribution
    const distribution = {
      '0': 0,
      '1-5': 0,
      '6-10': 0,
      '11-20': 0,
      '20+': 0
    };
    
    prompts.forEach(p => {
      const count = p.context_file_count || 0;
      if (count === 0) distribution['0']++;
      else if (count <= 5) distribution['1-5']++;
      else if (count <= 10) distribution['6-10']++;
      else if (count <= 20) distribution['11-20']++;
      else distribution['20+']++;
    });
    
    res.json({
      success: true,
      data: {
        mostUsedFiles: sortedFiles.slice(0, 20),
        contextSizeDistribution: distribution,
        avgFilesPerPrompt: totalPrompts > 0 ? (totalFileCount / totalPrompts).toFixed(2) : 0,
        totalUniqueFiles: fileUsage.size,
        explicitVsAuto: {
          explicit: explicitCount,
          auto: autoCount,
          ratio: autoCount > 0 ? (explicitCount / autoCount).toFixed(2) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting file usage stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===================================
// TODO TRACKING API ENDPOINTS
// ===================================

// Track currently active TODO
let currentActiveTodo = null;

/**
 * Get current session TODOs
 */
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await persistentDB.getCurrentSessionTodos();
    
    // Enrich with event counts
    for (const todo of todos) {
      const events = await persistentDB.getTodoEvents(todo.id);
      todo.eventCount = events.length;
      todo.promptCount = events.filter(e => e.event_type === 'prompt').length;
      todo.fileChangeCount = events.filter(e => e.event_type === 'file_change').length;
      
      // Calculate duration
      if (todo.completedAt && todo.startedAt) {
        todo.duration = todo.completedAt - todo.startedAt;
      } else if (todo.startedAt) {
        todo.duration = Date.now() - todo.startedAt;
      }
    }
    
    res.json({
      success: true,
      todos: todos,
      activeTodoId: currentActiveTodo
    });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get events for a specific TODO
 */
app.get('/api/todos/:id/events', async (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const events = await persistentDB.getTodoEvents(todoId);
    
    // Enrich events with actual data
    const enrichedEvents = [];
    for (const event of events) {
      let enrichedEvent = {
        eventType: event.event_type,
        timestamp: event.timestamp
      };
      
      if (event.event_type === 'prompt') {
        const prompt = await persistentDB.getPromptById(event.event_id);
        if (prompt) {
          enrichedEvent.details = prompt.text || prompt.preview || 'N/A';
          enrichedEvent.data = prompt;
        } else {
          enrichedEvent.details = 'Prompt not found';
        }
      } else if (event.event_type === 'file_change') {
        // Get entry from database
        const entry = await persistentDB.getRecentEntries(1, event.event_id);
        if (entry && entry.length > 0) {
          const fileEntry = entry[0];
          enrichedEvent.details = `File: ${fileEntry.filePath || fileEntry.file_path || 'unknown'}`;
          enrichedEvent.data = fileEntry;
        } else {
          enrichedEvent.details = 'File change details not available';
        }
      } else {
        enrichedEvent.details = 'Unknown event type';
      }
      
      enrichedEvents.push(enrichedEvent);
    }
    
    res.json({
      success: true,
      events: enrichedEvents
    });
  } catch (error) {
    console.error('Error fetching todo events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update TODO status manually
 */
app.post('/api/todos/:id/status', async (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const { status } = req.body;
    
    await persistentDB.updateTodoStatus(todoId, status);
    
    if (status === 'in_progress') {
      currentActiveTodo = todoId;
      console.log(`[TODO] Set active TODO to ${todoId}`);
    } else if (status === 'completed' && currentActiveTodo === todoId) {
      currentActiveTodo = null;
      console.log(`[TODO] Completed TODO ${todoId}, cleared active TODO`);
    }
    
    // Broadcast update
    broadcastUpdate('todos', { 
      todos: await persistentDB.getCurrentSessionTodos(),
      activeTodoId: currentActiveTodo
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating todo status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create TODOs manually (or capture from AI todo_write calls)
 */
app.post('/api/todos', async (req, res) => {
  try {
    const { todos, merge } = req.body;
    
    if (!todos || !Array.isArray(todos)) {
      return res.status(400).json({ success: false, error: 'todos array required' });
    }
    
    const savedTodos = [];
    
    for (let i = 0; i < todos.length; i++) {
      const todo = todos[i];
      
      if (merge && todo.id) {
        // Update existing TODO
        if (todo.status) {
          await persistentDB.updateTodoStatus(todo.id, todo.status);
          
          if (todo.status === 'in_progress') {
            currentActiveTodo = todo.id;
          } else if (todo.status === 'completed' && currentActiveTodo === todo.id) {
            currentActiveTodo = null;
          }
        }
      } else {
        // Create new TODO
        const todoId = await persistentDB.saveTodo({
          content: todo.content,
          status: todo.status || 'pending',
          order_index: i,
          created_at: Date.now()
        });
        
        savedTodos.push(todoId);
        
        // If this is the first in_progress todo, set as active
        if (todo.status === 'in_progress' && !currentActiveTodo) {
          currentActiveTodo = todoId;
          console.log(`[TODO] Set active TODO to ${todoId}`);
        }
      }
    }
    
    console.log(`[TODO] Created ${savedTodos.length} new TODOs`);
    
    // Broadcast update
    broadcastUpdate('todos', { 
      todos: await persistentDB.getCurrentSessionTodos(),
      activeTodoId: currentActiveTodo
    });
    
    res.json({ 
      success: true, 
      created: savedTodos.length,
      todoIds: savedTodos
    });
  } catch (error) {
    console.error('Error creating todos:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual prompt logging endpoint
app.post('/api/prompts/manual', async (req, res) => {
  try {
    const { text, conversationTitle, conversationId, messageRole, hasAttachments, attachments } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: 'Prompt text is required' });
    }
    
    const prompt = {
      id: db.nextId++,
      text: text,
      timestamp: Date.now(),
      source: 'manual',
      type: messageRole ? 'message' : 'standalone-prompt',
      conversationTitle: conversationTitle || null,
      parentConversationId: conversationId || null,
      messageRole: messageRole || 'user',
      hasAttachments: hasAttachments || attachments?.length > 0 || false,
      attachmentCount: attachments?.length || 0,
      status: 'captured',
      confidence: 'high',
      workspacePath: currentWorkspace || null
    };
    
    // Save to in-memory
    db.prompts.push(prompt);
    
    // Save to database
    await persistentDB.savePrompt(prompt);
    
    // Link to active TODO
    if (currentActiveTodo) {
      await persistentDB.addPromptToTodo(currentActiveTodo, prompt.id);
      await persistentDB.linkEventToTodo('prompt', prompt.id);
    }
    
    console.log(`[MANUAL] Captured prompt: "${text.substring(0, 60)}..."`);
    
    res.json({
      success: true,
      promptId: prompt.id,
      message: 'Prompt captured successfully'
    });
    
  } catch (error) {
    console.error('Error capturing manual prompt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint to repair database links
app.post('/api/repair/links', async (req, res) => {
  try {
    console.log('[API] Repair links request received');
    const result = await repairDatabaseLinks();
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[API] Error in repair links:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Database export with streaming support
app.get('/api/export/database', async (req, res) => {
  try {
    console.log('📤 Export request received');
    
    // Check if streaming is requested
    const useStreaming = req.query.stream === 'true' || req.query.streaming === 'true';
    const streamThreshold = parseInt(req.query.stream_threshold) || 5000; // Stream if > 5000 items
    
    // Parse query parameters
    const limit = parseInt(req.query.limit) || 1000;
    const includeAllFields = req.query.full === 'true';
    
    // Parse date strings - handle both ISO date strings (YYYY-MM-DD) and timestamps
    let since = null;
    let until = null;
    if (req.query.since) {
      // If it's a number, treat as timestamp; otherwise parse as date string
      if (!isNaN(req.query.since) && req.query.since.length > 10) {
        since = parseInt(req.query.since);
      } else {
        // ISO date string (YYYY-MM-DD) - convert to timestamp
        const date = new Date(req.query.since);
        since = date.getTime();
      }
    }
    if (req.query.until) {
      // If it's a number, treat as timestamp; otherwise parse as date string
      if (!isNaN(req.query.until) && req.query.until.length > 10) {
        until = parseInt(req.query.until);
      } else {
        // ISO date string (YYYY-MM-DD) - add end of day
        const date = new Date(req.query.until + 'T23:59:59.999Z');
        until = date.getTime();
      }
    }
    
    // Type filters
    const excludeEvents = req.query.exclude_events === 'true';
    const excludePrompts = req.query.exclude_prompts === 'true';
    const excludeTerminal = req.query.exclude_terminal === 'true';
    const excludeContext = req.query.exclude_context === 'true';
    
    // Options
    const noCodeDiffs = req.query.no_code_diffs === 'true';
    const noLinkedData = req.query.no_linked_data === 'true';
    const noTemporalChunks = req.query.no_temporal_chunks === 'true';
    
    // Abstraction level (new)
    const abstractionLevel = parseInt(req.query.abstraction_level || req.query.abstractionLevel || '0');
    const abstractPrompts = req.query.abstract_prompts === 'true' || req.query.abstractPrompts === 'true';
    const extractPatterns = req.query.extract_patterns === 'true' || req.query.extractPatterns === 'true';
    
    console.log(`[EXPORT] Limit: ${limit}, Since: ${since ? new Date(since).toISOString() : 'all'}, Until: ${until ? new Date(until).toISOString() : 'all'}`);
    console.log(`[EXPORT] Exclude: events=${excludeEvents}, prompts=${excludePrompts}, terminal=${excludeTerminal}, context=${excludeContext}`);
    console.log(`[EXPORT] Abstraction Level: ${abstractionLevel}, Abstract Prompts: ${abstractPrompts}, Extract Patterns: ${extractPatterns}`);
    console.log(`[EXPORT] Streaming: ${useStreaming || limit > streamThreshold} (threshold: ${streamThreshold})`);
    
    // Use streaming for large exports or if explicitly requested
    if (useStreaming || limit > streamThreshold) {
      return handleStreamingExport(req, res, {
        limit, includeAllFields, since, until,
        excludeEvents, excludePrompts, excludeTerminal, excludeContext,
        noCodeDiffs, noLinkedData, noTemporalChunks,
        abstractionLevel, abstractPrompts, extractPatterns
      });
    }
    
    // Helper function to filter by date range
    const filterByDateRange = (items) => {
      if (!since && !until) return items;
      return items.filter(item => {
        const itemTime = new Date(item.timestamp).getTime();
        if (since && itemTime < since) return false;
        if (until && itemTime > until) return false;
        return true;
      });
    };
    
    // Gather data from database with limits and filters
    const promises = [];
    
    if (!excludeEvents) {
      // Use time range filtering if dates are provided, otherwise get entries with code
      if (since || until) {
        promises.push(persistentDB.getEntriesInTimeRange(since || 0, until || Date.now(), null, Math.min(limit, 10000)));
      } else {
        promises.push(persistentDB.getEntriesWithCode(Math.min(limit, 10000)));
      }
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (!excludePrompts) {
      // Use time range filtering if dates are provided, otherwise get recent prompts
      if (since || until) {
        promises.push(persistentDB.getPromptsInTimeRange(since || 0, until || Date.now(), Math.min(limit, 10000)));
      } else {
        promises.push(persistentDB.getRecentPrompts(Math.min(limit, 10000)));
      }
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (!excludeEvents) {
      promises.push(persistentDB.getAllEvents());
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (!excludeTerminal) {
      promises.push(persistentDB.getAllTerminalCommands(Math.min(limit, 10000)));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (!excludeContext) {
      promises.push(persistentDB.getContextSnapshots({ since: since || 0, limit: Math.min(limit, 10000) }));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    promises.push(persistentDB.getContextAnalytics());
    
    const [entries, prompts, events, terminalCommands, contextSnapshots, contextAnalytics] = await Promise.all(promises);
    
    // Apply date range filtering
    const filteredEntries = filterByDateRange(entries);
    const filteredPrompts = filterByDateRange(prompts);
    const filteredEvents = filterByDateRange(events);
    const filteredTerminalCommands = filterByDateRange(terminalCommands);
    const filteredContextSnapshots = filterByDateRange(contextSnapshots);
    
    // Calculate diff stats for entries with code
    const calculateDiff = (before, after) => {
      if (!before && !after) return { linesAdded: 0, linesRemoved: 0, charsAdded: 0, charsDeleted: 0 };
      const beforeLines = (before || '').split('\n');
      const afterLines = (after || '').split('\n');
      const charsAdded = (after || '').length;
      const charsDeleted = (before || '').length;
      // Simple diff: compare line counts
      const linesAdded = Math.max(0, afterLines.length - beforeLines.length);
      const linesRemoved = Math.max(0, beforeLines.length - afterLines.length);
      return { linesAdded, linesRemoved, charsAdded, charsDeleted };
    };
    
    // Enrich entries with diff stats and ensure code diffs are included
    const enrichedEntries = filteredEntries.map(entry => {
      const diff = calculateDiff(entry.before_code || entry.before_content, entry.after_code || entry.after_content);
      const enriched = {
        ...entry,
        // Add computed diff stats
        diff_stats: {
          lines_added: diff.linesAdded,
          lines_removed: diff.linesRemoved,
          chars_added: diff.charsAdded,
          chars_deleted: diff.charsDeleted,
          has_diff: !!(entry.before_code || entry.after_code)
        }
      };
      
      // Only include code diffs if requested
      if (!noCodeDiffs) {
        enriched.before_code = entry.before_code || entry.before_content || '';
        enriched.after_code = entry.after_code || entry.after_content || '';
        enriched.before_content = entry.before_code || entry.before_content || '';
        enriched.after_content = entry.after_code || entry.after_content || '';
      } else {
        // Remove code content but keep metadata
        enriched.before_code = '';
        enriched.after_code = '';
        enriched.before_content = '';
        enriched.after_content = '';
      }
      
      return enriched;
    });
    
    // Create linked data structure: group prompts with their code changes
    const linkedData = [];
    const unlinkedEntries = [];
    const unlinkedPrompts = [];
    
    // Build lookup maps for fast access
    const promptMap = new Map(filteredPrompts.map(p => [p.id, p]));
    const entryMap = new Map(enrichedEntries.map(e => [e.id, e]));
    
    // Only build linked data if requested
    if (!noLinkedData) {
      // Group linked prompts and entries
      enrichedEntries.forEach(entry => {
        if (entry.prompt_id) {
          const prompt = promptMap.get(entry.prompt_id);
          if (prompt) {
            linkedData.push({
              type: 'prompt_with_code_change',
              prompt: prompt,
              code_change: entry,
              linked_at: entry.timestamp,
              relationship: {
                prompt_id: prompt.id,
                entry_id: entry.id,
                link_type: 'entry_to_prompt'
              }
            });
          } else {
            unlinkedEntries.push(entry);
          }
        } else {
          unlinkedEntries.push(entry);
        }
      });
      
      // Add prompts that link to entries (reverse direction)
      filteredPrompts.forEach(prompt => {
        if (prompt.linked_entry_id || prompt.linkedEntryId) {
          const entryId = prompt.linked_entry_id || prompt.linkedEntryId;
          const entry = entryMap.get(entryId);
          // Only add if not already in linkedData
          const alreadyLinked = linkedData.some(link => 
            link.prompt.id === prompt.id && link.code_change.id === entryId
          );
          if (entry && !alreadyLinked) {
            linkedData.push({
              type: 'prompt_with_code_change',
              prompt: prompt,
              code_change: entry,
              linked_at: prompt.timestamp,
              relationship: {
                prompt_id: prompt.id,
                entry_id: entry.id,
                link_type: 'prompt_to_entry'
              }
            });
          }
        } else if (!linkedData.some(link => link.prompt.id === prompt.id)) {
          unlinkedPrompts.push(prompt);
        }
      });
    } else {
      // If no linked data requested, mark all as unlinked
      enrichedEntries.forEach(entry => {
        if (!entry.prompt_id) {
          unlinkedEntries.push(entry);
        }
      });
      filteredPrompts.forEach(prompt => {
        if (!prompt.linked_entry_id && !prompt.linkedEntryId) {
          unlinkedPrompts.push(prompt);
        }
      });
    }
    
    // Sort linked data by timestamp
    linkedData.sort((a, b) => new Date(b.linked_at) - new Date(a.linked_at));
    
    // ============================================
    // NEW: Create temporal chunks/sessions
    // Groups prompts, code changes, and metadata by time proximity
    // ============================================
    const temporalChunks = [];
    const timeWindowMs = 5 * 60 * 1000; // 5 minutes
    
    // Combine all items with timestamps for temporal grouping
    const allTemporalItems = [
      ...enrichedEntries.map(e => ({
        type: 'code_change',
        item: e,
        timestamp: new Date(e.timestamp).getTime(),
        file_path: e.file_path,
        workspace_path: e.workspace_path,
        model_info: e.modelInfo || null,
        diff_stats: e.diff_stats,
        before_code: e.before_code,
        after_code: e.after_code,
        prompt_id: e.prompt_id,
        metadata: {
          source: e.source,
          session_id: e.session_id,
          tags: e.tags || [],
          notes: e.notes,
          type: e.type
        }
      })),
      ...filteredPrompts.map(p => ({
        type: 'prompt',
        item: p,
        timestamp: new Date(p.timestamp).getTime(),
        file_path: null, // Prompts don't have file_path directly
        workspace_path: p.workspace_path,
        model_info: {
          model_type: p.model_type || p.modelType,
          model_name: p.model_name || p.modelName
        },
        diff_stats: null,
        before_code: null,
        after_code: null,
        prompt_id: p.id,
        metadata: {
          source: p.source,
          mode: p.mode,
          workspace_id: p.workspace_id,
          workspace_name: p.workspace_name,
          composer_id: p.composer_id,
          context_usage: p.context_usage || p.contextUsage,
          context_file_count: p.context_file_count || p.contextFileCount,
          lines_added: p.lines_added || p.linesAdded,
          lines_removed: p.lines_removed || p.linesRemoved,
          conversation_title: p.conversation_title || p.conversationTitle,
          message_role: p.message_role || p.messageRole,
          thinking_time: p.thinking_time || p.thinkingTime
        }
      })),
      ...filteredTerminalCommands.map(cmd => ({
        type: 'terminal_command',
        item: cmd,
        timestamp: new Date(cmd.timestamp).getTime(),
        file_path: null,
        workspace_path: cmd.workspace,
        model_info: null,
        diff_stats: null,
        before_code: null,
        after_code: null,
        prompt_id: null,
        metadata: {
          command: cmd.command,
          exit_code: cmd.exit_code,
          shell: cmd.shell,
          source: cmd.source,
          duration: cmd.duration,
          linked_entry_id: cmd.linked_entry_id,
          linked_prompt_id: cmd.linked_prompt_id
        }
      }))
    ].filter(item => item.timestamp > 0); // Filter invalid timestamps
    
    // Sort by timestamp
    allTemporalItems.sort((a, b) => a.timestamp - b.timestamp);
    
    // Group into temporal chunks
    let currentChunk = null;
    allTemporalItems.forEach(item => {
      if (!currentChunk || (item.timestamp - currentChunk.end_time) > timeWindowMs) {
        // Start new chunk
        if (currentChunk) {
          temporalChunks.push(currentChunk);
        }
        currentChunk = {
          id: `chunk-${item.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          start_time: item.timestamp,
          end_time: item.timestamp,
          duration_seconds: 0,
          workspace_paths: new Set(),
          files_changed: new Set(),
          models_used: new Set(),
          items: [],
          summary: {
            prompts: 0,
            code_changes: 0,
            terminal_commands: 0,
            total_lines_added: 0,
            total_lines_removed: 0,
            total_chars_added: 0,
            total_chars_deleted: 0
          }
        };
      }
      
      // Add item to current chunk
      currentChunk.items.push(item);
      currentChunk.end_time = Math.max(currentChunk.end_time, item.timestamp);
      currentChunk.duration_seconds = Math.round((currentChunk.end_time - currentChunk.start_time) / 1000);
      
      // Track workspace
      if (item.workspace_path) {
        currentChunk.workspace_paths.add(item.workspace_path);
      }
      
      // Track files
      if (item.file_path) {
        currentChunk.files_changed.add(item.file_path);
      }
      
      // Track models
      if (item.model_info) {
        const modelName = item.model_info.model_name || item.model_info.modelName;
        const modelType = item.model_info.model_type || item.model_info.modelType;
        if (modelName || modelType) {
          currentChunk.models_used.add(modelType && modelName ? `${modelType}/${modelName}` : (modelName || modelType || 'Unknown'));
        }
      }
      
      // Update summary
      if (item.type === 'prompt') currentChunk.summary.prompts++;
      if (item.type === 'code_change') {
        currentChunk.summary.code_changes++;
        if (item.diff_stats) {
          currentChunk.summary.total_lines_added += item.diff_stats.lines_added || 0;
          currentChunk.summary.total_lines_removed += item.diff_stats.lines_removed || 0;
          currentChunk.summary.total_chars_added += item.diff_stats.chars_added || 0;
          currentChunk.summary.total_chars_deleted += item.diff_stats.chars_deleted || 0;
        }
      }
      if (item.type === 'terminal_command') currentChunk.summary.terminal_commands++;
    });
    
    // Add final chunk
    if (currentChunk) {
      temporalChunks.push(currentChunk);
    }
    
    // Convert Sets to Arrays for JSON serialization and add linked relationships
    const enrichedChunks = temporalChunks.map(chunk => {
      // Find linked relationships within this chunk
      const relationships = [];
      chunk.items.forEach(item => {
        if (item.type === 'code_change' && item.prompt_id) {
          const linkedPrompt = chunk.items.find(i => i.type === 'prompt' && i.prompt_id === item.prompt_id);
          if (linkedPrompt) {
            relationships.push({
              type: 'prompt_to_code',
              prompt_id: item.prompt_id,
              code_change_id: item.item.id,
              time_gap_seconds: Math.abs((item.timestamp - linkedPrompt.timestamp) / 1000)
            });
          }
        }
      });
      
      return {
        ...chunk,
        start_time: new Date(chunk.start_time).toISOString(),
        end_time: new Date(chunk.end_time).toISOString(),
        workspace_paths: Array.from(chunk.workspace_paths),
        files_changed: Array.from(chunk.files_changed),
        models_used: Array.from(chunk.models_used),
        relationships: relationships,
        // Include full items with all metadata
        items: chunk.items.map(i => ({
          type: i.type,
          id: i.item.id,
          timestamp: new Date(i.timestamp).toISOString(),
          // Code change metadata
          ...(i.type === 'code_change' ? {
            file_path: i.file_path,
            before_code: i.before_code,
            after_code: i.after_code,
            diff_stats: i.diff_stats,
            model_info: i.model_info,
            prompt_id: i.prompt_id,
            metadata: i.metadata
          } : {}),
          // Prompt metadata
          ...(i.type === 'prompt' ? {
            text: i.item.text || i.item.prompt || i.item.content,
            workspace_path: i.workspace_path,
            model_info: i.model_info,
            metadata: i.metadata
          } : {}),
          // Terminal command metadata
          ...(i.type === 'terminal_command' ? {
            command: i.metadata.command,
            workspace_path: i.workspace_path,
            exit_code: i.metadata.exit_code,
            metadata: i.metadata
          } : {})
        }))
      };
    });
    
    // Get current schema version
    let schemaVersion = '1.0.0';
    try {
      const schema = await persistentDB.getSchema();
      schemaVersion = schema.version || '1.0.0';
    } catch (err) {
      console.warn('[EXPORT] Could not get schema version:', err.message);
    }

    // Get in-memory data with improved structure
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '2.4',  // Bumped for export filters
        schema_version: schemaVersion,
        exportLimit: limit,
        fullExport: includeAllFields,
        dateRange: {
          since: since ? new Date(since).toISOString() : null,
          until: until ? new Date(until).toISOString() : null
        },
        filters: {
          excludeEvents,
          excludePrompts,
          excludeTerminal,
          excludeContext,
          noCodeDiffs,
          noLinkedData,
          noTemporalChunks
        },
        totalEntries: enrichedEntries.length,
        totalPrompts: filteredPrompts.length,
        totalEvents: filteredEvents.length,
        totalTerminalCommands: filteredTerminalCommands.length,
        totalContextSnapshots: filteredContextSnapshots.length,
        totalLinked: linkedData.length,
        totalTemporalChunks: noTemporalChunks ? 0 : enrichedChunks.length,
        note: limit < 10000 ? 'Limited export - use ?limit=10000 for more data' : 'Full export'
      },
      // NEW: Temporal chunks (groups by time proximity with all metadata) - only if requested
      ...(noTemporalChunks ? {} : { temporal_chunks: enrichedChunks }),
      // NEW: Linked data structure (prompts with their code changes - explicit links) - only if requested
      ...(noLinkedData ? {} : { linked_data: linkedData }),
      // Original flat arrays (for backward compatibility and direct access)
      entries: enrichedEntries,
      prompts: filteredPrompts,
      events: filteredEvents,
      terminal_commands: filteredTerminalCommands,
      context_snapshots: filteredContextSnapshots,
      context_analytics: contextAnalytics,
      workspaces: db.workspaces || [],
      // Unlinked items (for analysis)
      unlinked: {
        entries: unlinkedEntries.filter(e => !e.prompt_id),
        prompts: unlinkedPrompts,
        note: 'Items without explicit links (may be linked by timestamp proximity in temporal_chunks)'
      },
      stats: {
        sessions: enrichedEntries.length,
        fileChanges: enrichedEntries.length,
        aiInteractions: filteredPrompts.length,
        totalActivities: filteredEvents.length,
        terminalCommands: filteredTerminalCommands.length,
        avgContextUsage: contextAnalytics.avgContextUtilization || 0,
        linkedPairs: linkedData.length,
        linkingRate: enrichedEntries.length > 0 
          ? ((linkedData.length / enrichedEntries.length) * 100).toFixed(1) + '%'
          : '0%'
      }
    };
    
    // Apply abstraction if level > 0
    let finalExportData = exportData;
    if (abstractionLevel > 0) {
      console.log(`[ABSTRACTION] Applying level ${abstractionLevel} abstraction...`);
      finalExportData = abstractionEngine.abstractExportData(exportData, abstractionLevel, {
        abstractPrompts: abstractPrompts || abstractionLevel >= 2,
        extractPatterns: extractPatterns || abstractionLevel >= 3
      });
      console.log(`[ABSTRACTION] Abstraction applied successfully`);
    }
    
    console.log(`[SUCCESS] Exported ${enrichedEntries.length} entries (${linkedData.length} linked to prompts), ${filteredPrompts.length} prompts, ${filteredEvents.length} events, ${filteredTerminalCommands.length} terminal commands, ${filteredContextSnapshots.length} context snapshots`);
    
    res.json({
      success: true,
      schema_version: schemaVersion,
      data: finalExportData
    });
    
  } catch (error) {
    console.error('Error exporting database:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Streaming export handler for large datasets
async function handleStreamingExport(req, res, options) {
  const {
    limit, includeAllFields, since, until,
    excludeEvents, excludePrompts, excludeTerminal, excludeContext,
    noCodeDiffs, noLinkedData, noTemporalChunks,
    abstractionLevel, abstractPrompts, extractPatterns
  } = options;
  
  try {
    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Helper function to filter by date range
    const filterByDateRange = (items) => {
      if (!since && !until) return items;
      return items.filter(item => {
        const itemTime = new Date(item.timestamp).getTime();
        if (since && itemTime < since) return false;
        if (until && itemTime > until) return false;
        return true;
      });
    };
    
    // Helper to write JSON chunk
    const writeChunk = (chunk) => {
      res.write(chunk);
    };
    
    // Helper to abstract entry if needed
    const processEntry = (entry) => {
      if (abstractionLevel > 0 && abstractionEngine) {
        return abstractionEngine.abstractEntry(entry, abstractionLevel);
      }
      return entry;
    };
    
    // Helper to abstract prompt if needed
    const processPrompt = (prompt) => {
      if (abstractionLevel > 0 && abstractionEngine) {
        return abstractionEngine.abstractPrompt(prompt, abstractionLevel);
      }
      return prompt;
    };
    
    // Calculate diff stats
    const calculateDiff = (before, after) => {
      if (!before && !after) return { linesAdded: 0, linesRemoved: 0, charsAdded: 0, charsDeleted: 0 };
      const beforeLines = (before || '').split('\n');
      const afterLines = (after || '').split('\n');
      const charsAdded = (after || '').length;
      const charsDeleted = (before || '').length;
      const linesAdded = Math.max(0, afterLines.length - beforeLines.length);
      const linesRemoved = Math.max(0, beforeLines.length - afterLines.length);
      return { linesAdded, linesRemoved, charsAdded, charsDeleted };
    };
    
    // Start writing JSON structure
    writeChunk('{\n  "success": true,\n  "data": {\n');
    
    // Get current schema version
    let schemaVersion = '1.0.0';
    try {
      const schema = await persistentDB.getSchema();
      schemaVersion = schema.version || '1.0.0';
    } catch (err) {
      console.warn('[EXPORT] Could not get schema version:', err.message);
    }

    // Write metadata first (small, can load all at once)
    const metadata = {
      exportedAt: new Date().toISOString(),
      version: '2.4',
      schema_version: schemaVersion,
      exportLimit: limit,
      fullExport: includeAllFields,
      dateRange: {
        since: since ? new Date(since).toISOString() : null,
        until: until ? new Date(until).toISOString() : null
      },
      filters: {
        excludeEvents, excludePrompts, excludeTerminal, excludeContext,
        noCodeDiffs, noLinkedData, noTemporalChunks
      },
      streaming: true
    };
    writeChunk(`    "metadata": ${JSON.stringify(metadata, null, 2).split('\n').join('\n    ')},\n`);
    
    // Stream entries in batches
    if (!excludeEvents) {
      writeChunk('    "entries": [\n');
      const batchSize = 100; // Process 100 entries at a time
      let processedCount = 0;
      let firstEntry = true;
      
      // Get entries - use time range filtering if dates are provided
      let allEntries = [];
      if (since || until) {
        // Get all entries in time range at once (more efficient for date filtering)
        allEntries = await persistentDB.getEntriesInTimeRange(since || 0, until || Date.now(), null, limit);
      } else {
        // Get entries in batches
        for (let offset = 0; offset < limit; offset += batchSize) {
          const batchLimit = Math.min(batchSize, limit - offset);
          const batch = await persistentDB.getEntriesWithCode(batchLimit);
          allEntries.push(...batch);
          if (allEntries.length >= limit) break;
        }
        allEntries = allEntries.slice(0, limit);
      }
      
      // Process entries
      for (const entry of allEntries) {
        if (processedCount >= limit) break;
        
        // Apply date range filter (in case database query didn't filter perfectly)
        const itemTime = new Date(entry.timestamp).getTime();
        if (since && itemTime < since) continue;
        if (until && itemTime > until) continue;
        
        if (!firstEntry) writeChunk(',\n');
        firstEntry = false;
        
        // Enrich entry
        const diff = calculateDiff(entry.before_code || entry.before_content, entry.after_code || entry.after_content);
        const enriched = {
          ...entry,
          diff_stats: {
            lines_added: diff.linesAdded,
            lines_removed: diff.linesRemoved,
            chars_added: diff.charsAdded,
            chars_deleted: diff.charsDeleted,
            has_diff: !!(entry.before_code || entry.after_code)
          }
        };
        
        // Only include code diffs if requested
        if (noCodeDiffs) {
          enriched.before_code = '';
          enriched.after_code = '';
          enriched.before_content = '';
          enriched.after_content = '';
        }
        
        // Apply abstraction
        const processed = processEntry(enriched);
        writeChunk('      ' + JSON.stringify(processed).split('\n').join('\n      '));
        processedCount++;
        
        // Flush periodically
        if (processedCount % (batchSize * 10) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      writeChunk('\n    ],\n');
    } else {
      writeChunk('    "entries": [],\n');
    }
    
    // Stream prompts in batches
    if (!excludePrompts) {
      writeChunk('    "prompts": [\n');
      const batchSize = 100;
      let processedCount = 0;
      let firstPrompt = true;
      
      // Use time range filtering if dates are provided
      let allPrompts = [];
      if (since || until) {
        // Get all prompts in time range at once (more efficient for date filtering)
        allPrompts = await persistentDB.getPromptsInTimeRange(since || 0, until || Date.now(), limit);
      } else {
        // Get recent prompts in batches
        for (let offset = 0; offset < limit; offset += batchSize) {
          const batchLimit = Math.min(batchSize, limit - offset);
          const batch = await persistentDB.getRecentPrompts(batchLimit);
          allPrompts.push(...batch);
          if (allPrompts.length >= limit) break;
        }
        allPrompts = allPrompts.slice(0, limit);
      }
      
      // Process prompts
      for (const prompt of allPrompts) {
        if (processedCount >= limit) break;
        
        // Apply date range filter (in case database query didn't filter perfectly)
        const itemTime = new Date(prompt.timestamp).getTime();
        if (since && itemTime < since) continue;
        if (until && itemTime > until) continue;
        
        if (!firstPrompt) writeChunk(',\n');
        firstPrompt = false;
        
        const processed = processPrompt(prompt);
        writeChunk('      ' + JSON.stringify(processed).split('\n').join('\n      '));
        processedCount++;
        
        // Flush periodically
        if (processedCount % (batchSize * 10) === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      writeChunk('\n    ],\n');
    } else {
      writeChunk('    "prompts": [],\n');
    }
    
    // Stream terminal commands (smaller, can batch)
    if (!excludeTerminal) {
      writeChunk('    "terminal_commands": [\n');
      const commands = await persistentDB.getAllTerminalCommands(Math.min(limit, 10000));
      const filteredCommands = filterByDateRange(commands);
      let firstCmd = true;
      
      for (const cmd of filteredCommands.slice(0, limit)) {
        if (!firstCmd) writeChunk(',\n');
        firstCmd = false;
        writeChunk('      ' + JSON.stringify(cmd).split('\n').join('\n      '));
      }
      
      writeChunk('\n    ],\n');
    } else {
      writeChunk('    "terminal_commands": [],\n');
    }
    
    // Context snapshots (smaller dataset)
    if (!excludeContext) {
      writeChunk('    "context_snapshots": [\n');
      const snapshots = await persistentDB.getContextSnapshots({ since: since || 0, limit: Math.min(limit, 10000) });
      const filteredSnapshots = filterByDateRange(snapshots);
      let firstSnapshot = true;
      
      for (const snapshot of filteredSnapshots.slice(0, limit)) {
        if (!firstSnapshot) writeChunk(',\n');
        firstSnapshot = false;
        writeChunk('      ' + JSON.stringify(snapshot).split('\n').join('\n      '));
      }
      
      writeChunk('\n    ],\n');
    } else {
      writeChunk('    "context_snapshots": [],\n');
    }
    
    // Context analytics (small, can load all)
    const contextAnalytics = await persistentDB.getContextAnalytics();
    writeChunk(`    "context_analytics": ${JSON.stringify(contextAnalytics).split('\n').join('\n    ')},\n`);
    
    // Workspaces (small)
    writeChunk(`    "workspaces": ${JSON.stringify(db.workspaces || []).split('\n').join('\n    ')},\n`);
    
    // Stats (computed)
    const stats = {
      sessions: 0, // Would need to compute
      fileChanges: 0,
      aiInteractions: 0,
      totalActivities: 0,
      terminalCommands: 0,
      avgContextUsage: contextAnalytics.avgContextUtilization || 0
    };
    writeChunk(`    "stats": ${JSON.stringify(stats).split('\n').join('\n    ')}\n`);
    
    // Close JSON
    writeChunk('\n  }\n}');
    
    res.end();
    console.log(`[STREAM] Streaming export completed`);
    
  } catch (error) {
    console.error('Error in streaming export:', error);
    // Try to close JSON properly on error
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    } else {
      res.write(`\n  "error": "${error.message.replace(/"/g, '\\"')}"\n}`);
      res.end();
    }
  }
}

// Database import/redeploy endpoint - restore exported data
app.post('/api/import/database', async (req, res) => {
  try {
    console.log('[IMPORT] Import request received');
    
    const importData = req.body;
    
    // Validate import data structure
    if (!importData || !importData.data) {
      return res.status(400).json({
        success: false,
        error: 'Invalid import data: missing "data" field'
      });
    }
    
    const data = importData.data;
    const options = req.body.options || {};
    const {
      overwrite = false,  // If true, overwrite existing records; if false, skip duplicates
      skipLinkedData = false,  // Skip linked_data and temporal_chunks if present
      dryRun = false,  // If true, validate but don't import
      workspaceFilter = null,  // If set, only import data for this workspace
      mergeStrategy = 'skip'  // 'skip', 'overwrite', 'merge', 'append'
    } = options;

    // Get current schema for schema version comparison
    let currentSchema = null;
    let currentSchemaVersion = '1.0.0';
    try {
      currentSchema = await persistentDB.getSchema();
      currentSchemaVersion = currentSchema.version || '1.0.0';
    } catch (err) {
      console.warn('[IMPORT] Could not load current schema:', err.message);
    }

    // Detect import schema version
    const importSchemaVersion = 
      importData.schema_version || 
      importData.metadata?.schema_version || 
      data.metadata?.schema_version || 
      '1.0.0';
    
    console.log(`[IMPORT] Schema versions - Import: ${importSchemaVersion}, Current: ${currentSchemaVersion}`);
    
    // Schema compatibility check and migration
    const schemaCompatible = importSchemaVersion === currentSchemaVersion;
    if (!schemaCompatible) {
      console.log(`[IMPORT] Schema version mismatch detected - will normalize data during import`);
      
      // Run migrations if needed (migrate to current version)
      if (!dryRun) {
        try {
          const migrationResult = await schemaMigrations.migrate();
          if (migrationResult.migrations.length > 0) {
            console.log(`[IMPORT] Schema migrations completed: ${migrationResult.migrations.length} migration(s) applied`);
          }
        } catch (migrationErr) {
          console.warn(`[IMPORT] Schema migration warning:`, migrationErr.message);
        }
      }
      
      // Normalize data structure
      try {
        const normalizedData = await schemaMigrations.normalizeData(data, importSchemaVersion, currentSchemaVersion);
        Object.assign(data, normalizedData);
      } catch (normalizeErr) {
        console.warn(`[IMPORT] Data normalization warning:`, normalizeErr.message);
      }
    }
    
    // Log audit event for import start
    if (!dryRun) {
      await persistentDB.logAuditEvent('Import started', 'import', {
        workspaceId: workspaceFilter,
        importVersion: importSchemaVersion,
        currentVersion: currentSchemaVersion,
        mergeStrategy,
        overwrite,
        status: 'in_progress'
      }).catch(err => console.warn('[IMPORT] Could not log audit event:', err.message));
    }
    
    const stats = {
      entries: { imported: 0, skipped: 0, errors: 0 },
      prompts: { imported: 0, skipped: 0, errors: 0 },
      events: { imported: 0, skipped: 0, errors: 0 },
      terminalCommands: { imported: 0, skipped: 0, errors: 0 },
      contextSnapshots: { imported: 0, skipped: 0, errors: 0 },
      workspaces: { imported: 0, skipped: 0, errors: 0 }
    };
    
    // Helper to check if record exists and apply merge strategy
    const shouldImport = async (table, item) => {
      if (mergeStrategy === 'append') return true; // Always import with append
      
      // Filter by workspace if specified
      if (workspaceFilter) {
        const itemWorkspace = item.workspaceId || item.workspace_id || item.workspace_path || item.workspacePath;
        if (itemWorkspace && !itemWorkspace.includes(workspaceFilter) && !workspaceFilter.includes(itemWorkspace)) {
          return false; // Skip items not matching workspace filter
        }
      }
      
      try {
        let existing = null;
        if (table === 'entries') {
          existing = await persistentDB.getEntryById(item.id);
        } else if (table === 'prompts') {
          existing = await persistentDB.getPromptById(item.id);
        }
        
        if (!existing) return true; // New item, import it
        
        // Item exists, apply merge strategy
        if (mergeStrategy === 'skip' || (!overwrite && mergeStrategy !== 'overwrite' && mergeStrategy !== 'merge')) {
          return false; // Skip existing
        } else if (mergeStrategy === 'overwrite' || overwrite) {
          return true; // Overwrite existing
        } else if (mergeStrategy === 'merge') {
          // Merge: combine data, prefer existing for conflicts
          Object.assign(item, existing, item);
          return true;
        }
        
        return false;
      } catch (err) {
        return true; // On error, try to import
      }
    };
    
    // Import entries
    if (data.entries && Array.isArray(data.entries)) {
      console.log(`[IMPORT] Processing ${data.entries.length} entries...`);
      
      for (const entry of data.entries) {
        try {
          if (!dryRun) {
            const shouldImportEntry = await shouldImport('entries', entry);
            if (!shouldImportEntry) {
              stats.entries.skipped++;
              continue;
            }
            
            // Normalize entry data
            const normalizedEntry = {
              id: entry.id,
              session_id: entry.session_id || entry.sessionId,
              workspace_path: entry.workspace_path || entry.workspacePath,
              file_path: entry.file_path || entry.filePath,
              source: entry.source || 'imported',
              before_code: entry.before_code || entry.beforeCode || entry.before_content,
              after_code: entry.after_code || entry.afterCode || entry.after_content,
              notes: entry.notes || entry.description,
              timestamp: entry.timestamp,
              tags: entry.tags,
              prompt_id: entry.prompt_id || entry.promptId,
              modelInfo: entry.modelInfo || entry.model_info,
              type: entry.type || 'file_change'
            };
            
            await persistentDB.saveEntry(normalizedEntry);
            stats.entries.imported++;
          } else {
            stats.entries.imported++; // Count in dry run
          }
        } catch (error) {
          console.error(`[IMPORT] Error importing entry ${entry.id}:`, error.message);
          stats.entries.errors++;
        }
      }
    }
    
    // Import prompts
    if (data.prompts && Array.isArray(data.prompts)) {
      console.log(`[IMPORT] Processing ${data.prompts.length} prompts...`);
      
      for (const prompt of data.prompts) {
        try {
          if (!dryRun) {
            const shouldImportPrompt = await shouldImport('prompts', prompt);
            if (!shouldImportPrompt) {
              stats.prompts.skipped++;
              continue;
            }
            
            // Normalize prompt data
            const normalizedPrompt = {
              id: prompt.id,
              timestamp: prompt.timestamp,
              text: prompt.text || prompt.prompt || prompt.preview || prompt.content,
              status: prompt.status || 'captured',
              linked_entry_id: prompt.linked_entry_id || prompt.linkedEntryId,
              source: prompt.source || 'imported',
              workspaceId: prompt.workspaceId || prompt.workspace_id,
              workspacePath: prompt.workspacePath || prompt.workspace_path,
              workspaceName: prompt.workspaceName || prompt.workspace_name,
              composerId: prompt.composerId || prompt.composer_id,
              subtitle: prompt.subtitle,
              linesAdded: prompt.linesAdded || prompt.lines_added || 0,
              linesRemoved: prompt.linesRemoved || prompt.lines_removed || 0,
              contextUsage: prompt.contextUsage || prompt.context_usage || 0,
              mode: prompt.mode,
              modelType: prompt.modelType || prompt.model_type,
              modelName: prompt.modelName || prompt.model_name,
              forceMode: prompt.forceMode || prompt.force_mode,
              isAuto: prompt.isAuto || prompt.is_auto || false,
              type: prompt.type,
              confidence: prompt.confidence,
              added_from_database: false, // Mark as imported, not from Cursor DB
              contextFiles: prompt.contextFiles || prompt.context_files,
              terminalBlocks: prompt.terminalBlocks || prompt.terminal_blocks,
              thinkingTime: prompt.thinkingTime || prompt.thinking_time,
              thinkingTimeSeconds: prompt.thinkingTimeSeconds || prompt.thinking_time_seconds,
              hasAttachments: prompt.hasAttachments || prompt.has_attachments || false,
              attachmentCount: prompt.attachmentCount || prompt.attachment_count || 0,
              conversationTitle: prompt.conversationTitle || prompt.conversation_title,
              messageRole: prompt.messageRole || prompt.message_role,
              parentConversationId: prompt.parentConversationId || prompt.parent_conversation_id,
              conversationId: prompt.conversationId || prompt.composerId || prompt.parentConversationId,
              conversationIndex: prompt.conversationIndex || prompt.conversation_index
            };
            
            // Update conversation metadata if conversation_id is set
            if (normalizedPrompt.conversationId && normalizedPrompt.workspaceId) {
              await persistentDB.updateConversationMetadata(
                normalizedPrompt.conversationId,
                normalizedPrompt.workspaceId,
                normalizedPrompt.workspacePath,
                normalizedPrompt.conversationTitle
              ).catch(err => console.warn('[IMPORT] Could not update conversation:', err.message));
            }
            
            await persistentDB.savePrompt(normalizedPrompt);
            stats.prompts.imported++;
          } else {
            stats.prompts.imported++;
          }
        } catch (error) {
          console.error(`[IMPORT] Error importing prompt ${prompt.id}:`, error.message);
          stats.prompts.errors++;
        }
      }
    }
    
    // Import events
    if (data.events && Array.isArray(data.events)) {
      console.log(`[IMPORT] Processing ${data.events.length} events...`);
      
      for (const event of data.events) {
        try {
          if (!dryRun) {
            const normalizedEvent = {
              id: event.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              session_id: event.session_id || event.sessionId,
              workspace_path: event.workspace_path || event.workspacePath,
              timestamp: event.timestamp,
              type: event.type || 'activity',
              details: event.details || event.metadata || {}
            };
            
            await persistentDB.saveEvent(normalizedEvent);
            stats.events.imported++;
          } else {
            stats.events.imported++;
          }
        } catch (error) {
          console.error(`[IMPORT] Error importing event:`, error.message);
          stats.events.errors++;
        }
      }
    }
    
    // Import terminal commands
    if (data.terminal_commands && Array.isArray(data.terminal_commands)) {
      console.log(`[IMPORT] Processing ${data.terminal_commands.length} terminal commands...`);
      
      for (const cmd of data.terminal_commands) {
        try {
          if (!dryRun) {
            const normalizedCmd = {
              id: cmd.id || `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              command: cmd.command,
              shell: cmd.shell || cmd.metadata?.shell,
              source: cmd.source || cmd.metadata?.source || 'imported',
              timestamp: cmd.timestamp || cmd.metadata?.timestamp,
              workspace: cmd.workspace || cmd.workspace_path || cmd.metadata?.workspace,
              output: cmd.output || cmd.metadata?.output,
              exitCode: cmd.exit_code || cmd.exitCode || cmd.metadata?.exit_code,
              duration: cmd.duration || cmd.metadata?.duration,
              error: cmd.error || cmd.metadata?.error,
              linkedEntryId: cmd.linked_entry_id || cmd.linkedEntryId,
              linkedPromptId: cmd.linked_prompt_id || cmd.linkedPromptId,
              sessionId: cmd.session_id || cmd.sessionId
            };
            
            await persistentDB.saveTerminalCommand(normalizedCmd);
            stats.terminalCommands.imported++;
          } else {
            stats.terminalCommands.imported++;
          }
        } catch (error) {
          console.error(`[IMPORT] Error importing terminal command:`, error.message);
          stats.terminalCommands.errors++;
        }
      }
    }
    
    // Import context snapshots (if present)
    if (data.context_snapshots && Array.isArray(data.context_snapshots)) {
      console.log(`[IMPORT] Processing ${data.context_snapshots.length} context snapshots...`);
      // Context snapshots are typically derived from prompts, so we'll skip explicit import
      // unless there's a dedicated table for them
      stats.contextSnapshots.skipped = data.context_snapshots.length;
    }
    
    // Import workspaces (add to in-memory db.workspaces)
    if (data.workspaces && Array.isArray(data.workspaces)) {
      console.log(`[IMPORT] Processing ${data.workspaces.length} workspaces...`);
      
      if (!dryRun) {
        for (const workspace of data.workspaces) {
          try {
            const workspacePath = workspace.path || workspace.workspace_path || workspace;
            if (workspacePath && !db.workspaces.includes(workspacePath)) {
              db.workspaces.push(workspacePath);
              stats.workspaces.imported++;
            } else {
              stats.workspaces.skipped++;
            }
          } catch (error) {
            console.error(`[IMPORT] Error importing workspace:`, error.message);
            stats.workspaces.errors++;
          }
        }
      } else {
        stats.workspaces.imported = data.workspaces.length;
      }
    }
    
    // Reload in-memory data from database after import
    if (!dryRun) {
      console.log('[IMPORT] Reloading in-memory data from database...');
      const recentEntries = await persistentDB.getRecentEntries(1000);
      const recentPrompts = await persistentDB.getRecentPrompts(1000);
      db.entries = recentEntries;
      db.prompts = recentPrompts;
    }
    
    const totalImported = 
      stats.entries.imported +
      stats.prompts.imported +
      stats.events.imported +
      stats.terminalCommands.imported +
      stats.contextSnapshots.imported +
      stats.workspaces.imported;
    
    const totalSkipped = 
      stats.entries.skipped +
      stats.prompts.skipped +
      stats.events.skipped +
      stats.terminalCommands.skipped +
      stats.contextSnapshots.skipped +
      stats.workspaces.skipped;
    
    const totalErrors = 
      stats.entries.errors +
      stats.prompts.errors +
      stats.events.errors +
      stats.terminalCommands.errors +
      stats.contextSnapshots.errors +
      stats.workspaces.errors;
    
    console.log(`[SUCCESS] Import completed: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`);
    
    // Log audit event for import completion
    if (!dryRun) {
      await persistentDB.logAuditEvent('Import completed', 'import', {
        workspaceId: workspaceFilter,
        importVersion: importSchemaVersion,
        currentVersion: currentSchemaVersion,
        mergeStrategy,
        overwrite,
        totalImported,
        totalSkipped,
        totalErrors,
        status: totalErrors > 0 ? 'partial' : 'success'
      }).catch(err => console.warn('[IMPORT] Could not log audit event:', err.message));
    }
    
    res.json({
      success: true,
      dryRun,
      stats,
      summary: {
        totalImported,
        totalSkipped,
        totalErrors,
        overwrite,
        mergeStrategy,
        workspaceFilter,
        timestamp: new Date().toISOString()
      },
      schema: {
        importVersion: importSchemaVersion,
        currentVersion: currentSchemaVersion,
        compatible: schemaCompatible
      },
      message: dryRun 
        ? `Dry run: Would import ${totalImported} items (${totalSkipped} would be skipped)`
        : `Successfully imported ${totalImported} items (${totalSkipped} skipped, ${totalErrors} errors)`
    });
    
  } catch (error) {
    console.error('Error importing database:', error);
    
    // Log audit event for import failure
    if (!req.body.options?.dryRun) {
      await persistentDB.logAuditEvent('Import failed', 'import', {
        workspaceId: req.body.options?.workspaceFilter,
        error: error.message,
        status: 'error'
      }).catch(err => console.warn('[IMPORT] Could not log audit event:', err.message));
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Cache for file contents (refresh every 5 minutes)
let fileContentsCache = null;
let fileContentsCacheTime = 0;
const FILE_CONTENTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// API endpoint for file contents (for TF-IDF analysis) - OPTIMIZED WITH SIZE LIMITS
app.get('/api/file-contents', async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (fileContentsCache && (now - fileContentsCacheTime) < FILE_CONTENTS_CACHE_TTL) {
      console.log('[CACHE] Serving file contents from cache');
      return res.json(fileContentsCache);
    }
    
    // Fetch all recent file changes (default 2000, configurable via ?limit=N)
    const limit = parseInt(req.query.limit) || 2000;
    console.log(`[FILE] Fetching file contents with limit ${limit}...`);
    
    if (typeof persistentDB.getFileContents !== 'function') {
      throw new Error('persistentDB.getFileContents is not a function');
    }
    
    const entries = await persistentDB.getFileContents(limit);
    console.log(`[FILE] Processing ${entries.length} files for semantic analysis...`);
    
    // Build file content map with latest content for each file
    const fileContents = new Map();
    const MAX_CONTENT_SIZE = 200000; // 200KB per file - enough for most code files
    
    entries.forEach(entry => {
      const filePath = entry.file_path;
      const content = entry.after_code;
      
      if (!filePath || !content) return;
      
      // Skip very small files (likely metadata)
      if (content.length < 10) return;
      
      const fileName = filePath.split('/').pop();
      const ext = filePath.split('.').pop()?.toLowerCase();
      
      // Truncate content if too large (keep first 200KB - rare but prevents crashes)
      const truncatedContent = content.length > MAX_CONTENT_SIZE 
        ? content.substring(0, MAX_CONTENT_SIZE) 
        : content;
      
      // Create or update file entry (keep most recent version of each file)
      if (!fileContents.has(filePath)) {
        fileContents.set(filePath, {
          path: filePath,
          name: fileName,
          ext: ext,
          content: truncatedContent,
          lastModified: entry.timestamp,
          size: truncatedContent.length,
          truncated: content.length > MAX_CONTENT_SIZE
        });
      } else {
        // Update if this entry is more recent
        const existing = fileContents.get(filePath);
        if (new Date(entry.timestamp) > new Date(existing.lastModified)) {
          existing.content = truncatedContent;
          existing.lastModified = entry.timestamp;
          existing.size = truncatedContent.length;
          existing.truncated = content.length > MAX_CONTENT_SIZE;
        }
      }
    });
    
    const result = Array.from(fileContents.values());
    const totalSize = result.reduce((sum, f) => sum + f.size, 0);
    const truncatedCount = result.filter(f => f.truncated).length;
    
    console.log(`[FILE] Serving ${result.length} unique files with ${(totalSize/1024/1024).toFixed(2)}MB content for TF-IDF analysis`);
    if (truncatedCount > 0) {
      console.log(`[FILE] ${truncatedCount} files truncated to ${MAX_CONTENT_SIZE/1000}KB (originally larger)`);
    }
    
    const response = {
      files: result,
      totalFiles: result.length,
      totalSize: totalSize,
      cached: false,
      processedEntries: entries.length,
      truncatedFiles: truncatedCount,
      maxContentSize: MAX_CONTENT_SIZE
    };
    
    // Cache the result
    fileContentsCache = response;
    fileContentsCacheTime = now;
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching file contents:', error);
    // More detailed error for JSON serialization issues
    if (error.message && error.message.includes('Invalid string length')) {
      console.error('[ERROR] Response too large to serialize - this should not happen with limits!');
      res.status(500).json({ error: 'Response too large - contact support' });
    } else {
      res.status(500).json({ error: 'Failed to fetch file contents', details: error.message });
    }
  }
});

// Chat query endpoint removed - Qwen widget no longer used

// Acknowledge queue
app.post('/ack', (req, res) => {
  const { cursor: ackCursor } = req.body;
  if (ackCursor) {
    const ackSeq = Number(ackCursor);
    // Only clean up items that are older than 1 hour AND have been acknowledged
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const beforeCount = queue.length;
    
    queue = queue.filter(item => {
      const itemAge = Date.now() - new Date(item.payload.timestamp).getTime();
      return item.seq > ackSeq || itemAge < oneHourAgo;
    });
    
    // Update the legacy arrays for backward compatibility
    entries = queue.filter(item => item.kind === 'entry').map(item => item.payload);
    events = queue.filter(item => item.kind === 'event').map(item => item.payload);
    
    const afterCount = queue.length;
    console.log(` Queue acknowledged up to seq ${ackSeq}. Cleaned up ${beforeCount - afterCount} old items. Remaining: ${queue.length} items`);
  }
  res.json({ status: 'acknowledged', cursor: ackCursor });
});

// FTS Search Endpoint
app.get('/search/fts', (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
    }

    if (!lunrIndex) {
      return res.status(503).json({ success: false, error: 'Lunr index not initialized.' });
    }

    const results = lunrIndex.search(query);
    const hydratedResults = results.map(result => {
      // Retrieve original document from indexedDocs based on ref (id)
      const originalDoc = indexedDocs.find(doc => doc.id === result.ref);
      return { ...originalDoc, score: result.score };
    });

    res.json({ success: true, query, results: hydratedResults });
  } catch (error) {
    console.error('Error during FTS search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get configuration
app.get('/config', (req, res) => {
  res.json(config);
});

// Update configuration
app.post('/config', (req, res) => {
  Object.assign(config, req.body);
  res.json({ status: 'updated', config });
});

// Privacy API endpoints
app.get('/privacy/config', (req, res) => {
  res.json(privacyConfig);
});

app.post('/privacy/config', (req, res) => {
  Object.assign(privacyConfig, req.body);
  console.log(' Privacy config updated:', privacyConfig);
  res.json({ status: 'updated', privacyConfig });
});

app.post('/privacy/consent', (req, res) => {
  const { consent } = req.body;
  privacyConfig.consentGiven = consent;
  privacyConfig.enabled = consent;
  console.log(' Privacy consent updated:', consent);
  res.json({ status: 'updated', consentGiven: consent });
});

app.get('/privacy/status', (req, res) => {
  res.json({
    enabled: privacyConfig.enabled,
    consentGiven: privacyConfig.consentGiven,
    sensitivityLevel: privacyConfig.sensitivityLevel,
    redactionLevel: privacyConfig.redactionLevel
  });
});

// Data deletion endpoints
app.delete('/privacy/delete-session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  try {
    // Remove from in-memory storage
    const sessionIndex = entries.findIndex(entry => entry.sessionId === sessionId);
    if (sessionIndex >= 0) {
      entries.splice(sessionIndex, 1);
    }
    
    const eventIndex = events.findIndex(event => event.sessionId === sessionId);
    if (eventIndex >= 0) {
      events.splice(eventIndex, 1);
    }
    
    // Remove from queue
    const queueIndex = queue.findIndex(item => item.payload.sessionId === sessionId);
    if (queueIndex >= 0) {
      queue.splice(queueIndex, 1);
    }
    
    console.log(` Deleted session ${sessionId} from companion service`);
    res.json({ success: true, message: `Session ${sessionId} deleted` });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/privacy/delete-all', (req, res) => {
  try {
    // Clear all in-memory storage
    entries.length = 0;
    events.length = 0;
    queue.length = 0;
    sequence = 0;
    
    console.log(' Deleted all data from companion service');
    res.json({ success: true, message: 'All data deleted' });
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/privacy/delete-sensitive', (req, res) => {
  const { patterns } = req.body;
  
  try {
    let deletedCount = 0;
    
    // Delete entries matching sensitive patterns
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const content = entry.content || entry.data || '';
      
      if (patterns.some(pattern => {
        const regex = new RegExp(pattern, 'gi');
        return regex.test(content);
      })) {
        entries.splice(i, 1);
        deletedCount++;
      }
    }
    
    // Delete events matching sensitive patterns
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      const content = event.content || event.data || '';
      
      if (patterns.some(pattern => {
        const regex = new RegExp(pattern, 'gi');
        return regex.test(content);
      })) {
        events.splice(i, 1);
        deletedCount++;
      }
    }
    
    // Delete queue items matching sensitive patterns
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      const content = item.payload.content || item.payload.data || '';
      
      if (patterns.some(pattern => {
        const regex = new RegExp(pattern, 'gi');
        return regex.test(content);
      })) {
        queue.splice(i, 1);
        deletedCount++;
      }
    }
    
    console.log(` Deleted ${deletedCount} items matching sensitive patterns`);
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('Error deleting sensitive data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MCP (Model Context Protocol) Endpoints - OPTIONAL/FUTURE FEATURE
// These endpoints are disabled by default. Set enable_mcp: true in config.json
// to enable external data collection via MCP instead of direct database reads.
// ============================================================================

// Check if MCP is enabled (default: false)
const isMCPEnabled = () => {
  try {
    const cfg = require('./utils/config.js');
    return cfg.get().enable_mcp === true;
  } catch (e) {
    return false; // Default to disabled
  }
};

// Enhanced MCP endpoints with comprehensive data capture (OPTIONAL)
app.post('/mcp/log-prompt-response', async (req, res) => {
  if (!isMCPEnabled()) {
    return res.status(503).json({ 
      success: false, 
      error: 'MCP endpoints are disabled. Set enable_mcp: true in config.json to enable.',
      note: 'MCP is an optional feature for external data collection. Database mode is the default.'
    });
  }
  console.log('[MCP] Enhanced prompt-response received:', Object.keys(req.body));
  checkSessionTimeout();
  updateActivityTime();
  
  const {
    session_id,
    conversation_id,
    conversation_title,
    message_id,
    timestamp,
    file_path,
    workspace_path,
    workspace_name,
    prompt,
    response,
    message_role = 'user',
    metadata = {}
  } = req.body;
  
  // Detect workspace for this file
  const workspacePath = workspace_path || (file_path ? detectWorkspace(file_path) : currentWorkspace);
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  const entryId = message_id || crypto.randomUUID();
  const entryTimestamp = timestamp || new Date().toISOString();
  
  // Create entry with enhanced metadata
  const entry = {
    id: entryId,
    session_id: session_id || workspaceSession,
    workspace_path: workspacePath,
    workspace_name: workspace_name || path.basename(workspacePath),
    timestamp: entryTimestamp,
    source: 'mcp',
    file_path: file_path || '',
    prompt: prompt || '',
    response: response || '',
    notes: 'Logged via MCP (Enhanced)',
    conversation_id: conversation_id,
    conversation_title: conversation_title,
    message_role: message_role
  };
  
  // Create prompt record with comprehensive metadata (matching database mode structure)
  const promptData = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    workspace_path: workspacePath,
    workspace_name: entry.workspace_name,
    timestamp: entryTimestamp,
    source: 'mcp',
    conversation_id: conversation_id || entryId,
    conversation_title: conversation_title,
    message_role: message_role,
    text: message_role === 'user' ? prompt : response,
    linked_entry_id: entryId,
    // Enhanced metadata
    context_usage: metadata.contextUsage || metadata.context_usage || null,
    lines_added: metadata.linesAdded || metadata.lines_added || null,
    lines_removed: metadata.linesRemoved || metadata.lines_removed || null,
    ai_mode: metadata.aiMode || metadata.ai_mode || 'chat',
    model: metadata.model || null,
    finish_reason: metadata.finishReason || metadata.finish_reason || null,
    thinking_time_seconds: metadata.thinkingTimeSeconds || metadata.thinking_time_seconds || null,
    context_files: JSON.stringify(metadata.contextFiles || metadata.context_files || []),
    at_files: JSON.stringify(metadata.atFiles || metadata.at_files || []),
    command_type: metadata.commandType || metadata.command_type || null,
    generation_uuid: metadata.generationUUID || metadata.generation_uuid || null,
    status: 'captured',
    confidence: 'high'
  };
  
  // Create matching event
  const event = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    workspace_path: workspacePath,
    timestamp: entryTimestamp,
    type: 'prompt_response',
    details: JSON.stringify({
      file_path: entry.file_path,
      conversation_id: conversation_id,
      message_role: message_role,
      metadata: metadata
    })
  };
  
  // Store in database if persistent DB is available
  if (persistentDB) {
    try {
      await persistentDB.savePrompt(promptData);
      if (message_role === 'assistant' && response) {
        // Also save as entry for AI responses
        await persistentDB.saveEntry(entry);
      }
    } catch (dbError) {
      console.warn('[MCP] Failed to save to persistent DB:', dbError.message);
    }
  }
  
  // Use enqueue function for reliable queuing
  enqueue('entry', entry);
  enqueue('event', event);
  
  // Add prompt to in-memory store
  if (!db.prompts) db.prompts = [];
  db.prompts.push(promptData);
  
  // Update workspace data
  updateWorkspaceData(workspacePath, entry, event);
  
  // Broadcast real-time update via WebSocket
  broadcastUpdate('prompt-captured', {
    prompt: promptData,
    entry: entry,
    conversation_id: conversation_id
  });
  
  console.log(`[SUCCESS] MCP enhanced entry added: ${entry.id} - ${entry.file_path} in workspace: ${workspacePath}`);
  
  res.json({ success: true, entry_id: entry.id, prompt_id: promptData.id });
});

app.post('/mcp/log-code-change', async (req, res) => {
  if (!isMCPEnabled()) {
    return res.status(503).json({ 
      success: false, 
      error: 'MCP endpoints are disabled. Set enable_mcp: true in config.json to enable.',
      note: 'MCP is an optional feature for external data collection. Database mode is the default.'
    });
  }
  
  checkSessionTimeout();
  updateActivityTime();
  
  const {
    session_id,
    conversation_id,
    timestamp,
    file_path,
    workspace_path,
    before_code,
    after_code,
    metadata = {}
  } = req.body;
  
  // Detect workspace for this file
  const workspacePath = workspace_path || (file_path ? detectWorkspace(file_path) : currentWorkspace);
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  // Calculate diff metrics if not provided
  const linesAdded = metadata.linesAdded || metadata.lines_added || 
    Math.max(0, (after_code || '').split('\n').length - (before_code || '').split('\n').length);
  const linesRemoved = metadata.linesRemoved || metadata.lines_removed || 
    Math.max(0, (before_code || '').split('\n').length - (after_code || '').split('\n').length);
  
  const entry = {
    id: crypto.randomUUID(),
    session_id: session_id || workspaceSession,
    workspace_path: workspacePath,
    timestamp: timestamp || new Date().toISOString(),
    source: 'mcp',
    file_path: file_path || '',
    before_code: before_code || '',
    after_code: after_code || '',
    notes: 'Code change logged via MCP (Enhanced)',
    conversation_id: conversation_id,
    lines_added: linesAdded,
    lines_removed: linesRemoved,
    diff_size: metadata.diffSize || metadata.diff_size || 
      Math.abs((after_code || '').length - (before_code || '').length)
  };
  
  // Store in database if persistent DB is available
  if (persistentDB) {
    try {
      await persistentDB.saveEntry(entry);
    } catch (dbError) {
      console.warn('[MCP] Failed to save entry to persistent DB:', dbError.message);
    }
  }
  
  // Use enqueue function for reliable queuing
  enqueue('entry', entry);
  
  // Create matching event
  const event = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    workspace_path: workspacePath,
    timestamp: entry.timestamp,
    type: 'code_change',
    details: JSON.stringify({
      file_path: entry.file_path,
      conversation_id: conversation_id,
      lines_added: linesAdded,
      lines_removed: linesRemoved,
      metadata: metadata
    })
  };
  enqueue('event', event);
  
  // Update workspace data
  updateWorkspaceData(workspacePath, entry, event);
  
  // Broadcast real-time update
  broadcastUpdate('file-changed', {
    entry: entry,
    event: event
  });
  
  console.log(`[SUCCESS] MCP enhanced code change added: ${entry.id} - ${entry.file_path} in workspace: ${workspacePath}`);
  console.log(`[DATA] Total entries: ${entries.length}, events: ${events.length}`);
  
  res.json({ success: true, entry_id: entry.id });
});

// conversationStreams is defined at the top of the file

// Enhanced conversation logging endpoint (OPTIONAL)
app.post('/mcp/log-conversation', async (req, res) => {
  if (!isMCPEnabled()) {
    return res.status(503).json({ 
      success: false, 
      error: 'MCP endpoints are disabled. Set enable_mcp: true in config.json to enable.',
      note: 'MCP is an optional feature for external data collection. Database mode is the default.'
    });
  }
  
  console.log('[MCP] Conversation received:', req.body.conversation_id);
  checkSessionTimeout();
  updateActivityTime();
  
  const {
    conversation_id,
    conversation_title,
    session_id,
    workspace_path,
    workspace_name,
    messages = [],
    metadata = {}
  } = req.body;
  
  const workspacePath = workspace_path || currentWorkspace;
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  // Process all messages in the conversation
  const savedPrompts = [];
  const savedEntries = [];
  
  for (const message of messages) {
    const messageId = message.id || crypto.randomUUID();
    const messageTimestamp = message.timestamp || new Date().toISOString();
    
    // Create prompt record for each message
    const promptData = {
      id: messageId,
      session_id: session_id || workspaceSession,
      workspace_path: workspacePath,
      workspace_name: workspace_name || path.basename(workspacePath),
      timestamp: messageTimestamp,
      source: 'mcp',
      conversation_id: conversation_id,
      conversation_title: conversation_title,
      message_role: message.role || 'user',
      text: message.text || message.content || '',
      linked_entry_id: null,
      context_usage: message.metadata?.contextUsage || metadata.contextUsage || null,
      lines_added: message.metadata?.linesAdded || metadata.linesAdded || null,
      lines_removed: message.metadata?.linesRemoved || metadata.linesRemoved || null,
      ai_mode: message.metadata?.aiMode || metadata.aiMode || 'chat',
      model: message.metadata?.model || metadata.model || null,
      finish_reason: message.metadata?.finishReason || metadata.finishReason || null,
      thinking_time_seconds: message.metadata?.thinkingTimeSeconds || metadata.thinkingTimeSeconds || null,
      context_files: JSON.stringify(message.metadata?.contextFiles || metadata.contextFiles || []),
      at_files: JSON.stringify(message.metadata?.atFiles || metadata.atFiles || []),
      status: 'captured',
      confidence: 'high'
    };
    
    savedPrompts.push(promptData);
    
    // Store in database
    if (persistentDB) {
      try {
        await persistentDB.savePrompt(promptData);
      } catch (dbError) {
        console.warn('[MCP] Failed to save prompt:', dbError.message);
      }
    }
    
    // Add to in-memory store
    if (!db.prompts) db.prompts = [];
    db.prompts.push(promptData);
  }
  
  // Create conversation event
  const event = {
    id: crypto.randomUUID(),
    session_id: session_id || workspaceSession,
    workspace_path: workspacePath,
    timestamp: new Date().toISOString(),
    type: 'conversation',
    details: JSON.stringify({
      conversation_id: conversation_id,
      conversation_title: conversation_title,
      message_count: messages.length,
      metadata: metadata
    })
  };
  
  enqueue('event', event);
  updateWorkspaceData(workspacePath, null, event);
  
  // Broadcast conversation update
  broadcastUpdate('conversation-update', {
    conversation_id: conversation_id,
    conversation_title: conversation_title,
    messages: savedPrompts,
    metadata: metadata
  });
  
  // Broadcast to subscribed WebSocket clients
  broadcastConversationUpdate(conversation_id, {
    conversation_id: conversation_id,
    conversation_title: conversation_title,
    messages: savedPrompts,
    metadata: metadata
  });
  
  console.log(`[SUCCESS] MCP conversation logged: ${conversation_id} with ${messages.length} messages`);
  
  res.json({
    success: true,
    conversation_id: conversation_id,
    message_count: messages.length,
    prompt_ids: savedPrompts.map(p => p.id)
  });
});

// Conversation streaming endpoint (OPTIONAL)
app.post('/mcp/stream-conversation', (req, res) => {
  if (!isMCPEnabled()) {
    return res.status(503).json({ 
      success: false, 
      error: 'MCP endpoints are disabled. Set enable_mcp: true in config.json to enable.',
      note: 'MCP is an optional feature for external data collection. Database mode is the default.'
    });
  }
  
  const { conversation_id, enable = true } = req.body;
  
  if (enable) {
    conversationStreams.set(conversation_id, {
      id: conversation_id,
      enabled: true,
      startTime: Date.now(),
      messageCount: 0
    });
    console.log(`[MCP] Conversation streaming enabled: ${conversation_id}`);
  } else {
    conversationStreams.delete(conversation_id);
    console.log(`[MCP] Conversation streaming disabled: ${conversation_id}`);
  }
  
  res.json({ success: true, streaming: enable, conversation_id });
});

// Get active conversation streams (OPTIONAL)
app.get('/mcp/streams', (req, res) => {
  if (!isMCPEnabled()) {
    return res.status(503).json({ 
      success: false, 
      error: 'MCP endpoints are disabled. Set enable_mcp: true in config.json to enable.',
      note: 'MCP is an optional feature for external data collection. Database mode is the default.'
    });
  }
  
  const streams = Array.from(conversationStreams.values());
  res.json({ success: true, streams: streams });
});

app.post('/mcp/log-event', (req, res) => {
  if (!isMCPEnabled()) {
    return res.status(503).json({ 
      success: false, 
      error: 'MCP endpoints are disabled. Set enable_mcp: true in config.json to enable.',
      note: 'MCP is an optional feature for external data collection. Database mode is the default.'
    });
  }
  
  checkSessionTimeout();
  updateActivityTime();
  
  const { session_id, type, details, file_path, timestamp } = req.body;
  
  // Detect workspace from file_path if provided, or use details
  let workspacePath = currentWorkspace;
  const parsedDetails = typeof details === 'string' ? JSON.parse(details || '{}') : details;
  const eventFilePath = file_path || parsedDetails.file_path;
  
  if (eventFilePath) {
    workspacePath = detectWorkspace(eventFilePath);
  }
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  const event = {
    id: crypto.randomUUID(),
    session_id: session_id || workspaceSession,
    workspace_path: workspacePath,
    timestamp: timestamp || new Date().toISOString(),
    type: type || 'unknown',
    details: typeof details === 'string' ? details : JSON.stringify(details || {})
  };
  
  // Use enqueue function for reliable queuing
  enqueue('event', event);
  
  // Update workspace data
  updateWorkspaceData(workspacePath, null, event);
  
  // Broadcast real-time update
  broadcastUpdate('event', event);
  
  console.log(`[SUCCESS] MCP event added: ${event.id} - ${event.type} in workspace: ${workspacePath}`);
  console.log(`[DATA] Total events: ${events.length}`);
  
  res.json({ success: true, event_id: event.id });
});

// Debug endpoint to force enqueue test data
app.post('/debug/enqueue', (req, res) => {
  const entry = {
    id: crypto.randomUUID(),
    session_id: 'debug',
    timestamp: new Date().toISOString(),
    source: 'mcp',
    file_path: 'debug.txt',
    prompt: 'Hello',
    response: 'World',
    before_code: null,
    after_code: null
  };
  enqueue('entry', entry);
  
  const event = {
    id: crypto.randomUUID(),
    session_id: 'debug',
    timestamp: entry.timestamp,
    type: 'entry_created',
    details: '{}'
  };
  enqueue('event', event);
  
  res.json({ ok: true, entry_id: entry.id, event_id: event.id });
});

// File watching functions
function calculateDiff(text1, text2) {
  const diffThreshold = config.diff_threshold;
  const diffSize = Math.abs(text1.length - text2.length);
  const isSignificant = diffSize >= diffThreshold;
  
  // Calculate line-based diff stats
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const linesAdded = Math.max(0, lines2.length - lines1.length);
  const linesRemoved = Math.max(0, lines1.length - lines2.length);
  const charsAdded = Math.max(0, text2.length - text1.length);
  const charsDeleted = Math.max(0, text1.length - text2.length);
  
  return {
    diffSize,
    isSignificant,
    summary: `+${text2.length - text1.length} chars`,
    linesAdded,
    linesRemoved,
    charsAdded,
    charsDeleted,
    beforeContent: text1,
    afterContent: text2
  };
}

async function processFileChange(filePath) {
  console.log(` Processing file change: ${filePath}`);
  
  // Detect workspace for this file
  const workspacePath = detectWorkspace(filePath);
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  // Check if we need to create a new session due to timeout
  checkSessionTimeout();
  updateActivityTime();
  
  try {
    // Check file size before reading (skip files > 5MB to prevent memory issues)
    const stats = fs.statSync(filePath);
    const maxFileSizeMB = 5;
    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
    
    if (stats.size > maxFileSizeBytes) {
      console.log(`[WARNING] Skipping large file (${(stats.size / 1024 / 1024).toFixed(2)}MB): ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    // Use the detected workspace as the base for relative path
    const relativePath = path.relative(workspacePath, filePath);
    const previousContent = fileSnapshots.get(filePath) || '';
    
    console.log(` File: ${relativePath}, Workspace: ${workspacePath}, Session: ${workspaceSession}`);
    console.log(` Previous length: ${previousContent.length}, Current length: ${content.length}`);
    
    if (content !== previousContent) {
      const diff = calculateDiff(previousContent, content);
      console.log(` Diff: ${diff.summary}, Significant: ${diff.isSignificant}, Threshold: ${config.diff_threshold}`);
      
      if (diff.isSignificant) {
        // Enhanced model detection
        const modelInfo = extractModelInfo({
          file_path: relativePath,
          content: content,
          before_content: previousContent
        });
        
        // Use the new queue system which will automatically link prompts
        const entry = queueSystem.addEntry({
          session_id: workspaceSession,
          workspace_path: workspacePath,
          source: 'filewatcher',
          file_path: relativePath,
          before_code: previousContent,
          after_code: content,
          notes: `File change detected. Diff: ${diff.summary}`,
          tags: ['filewatcher-detected', 'code-change'],
          modelInfo: modelInfo
        });
        
        // Save entry to database
        try {
          await db.add('entries', entry);
          console.log(`Saved entry to database: ${entry.id} for workspace: ${workspacePath}`);
          
          // Link to active TODO
          if (currentActiveTodo) {
            await persistentDB.addFileToTodo(currentActiveTodo, relativePath);
            await persistentDB.linkEventToTodo('file_change', entry.id);
            console.log(`   [TODO] Linked file change ${entry.id} (${relativePath}) to TODO ${currentActiveTodo}`);
          }
          
          // Update workspace data
          updateWorkspaceData(workspacePath, entry, null);
          
          // ===== NEW: Track productivity metrics =====
          // Track file edit for time-to-first-edit calculation
          const ttfeMetrics = productivityTracker.trackFileEdit(entry);
          
          // Track code churn (if AI-generated)
          if (entry.source === 'ai-generated' || entry.prompt_id) {
            productivityTracker.trackCodeChurn(entry);
          }
          
          // Detect debug activity
          productivityTracker.detectDebugActivity(entry);
          
          // Track activity for active/waiting time
          productivityTracker.trackActivity('file_change');
          // ===== END NEW TRACKING =====
          
          // Broadcast real-time update to connected clients
          io.emit('new-entry', entry);
          io.emit('entries-update', db.entries);
          broadcastUpdate('file-change', {
            id: entry.id,
            sessionId: entry.session_id,
            filePath: relativePath,
            changeType: 'modified',
            timestamp: new Date().toISOString(),
            beforeContent: previousContent,
            afterContent: content,
            diff: diff.summary
          });
        } catch (error) {
          console.error('Error saving entry to database:', error);
        }
        
        // Link the most recent prompt to this entry (look for recent prompts within 5 minutes)
        try {
          const entryTime = new Date(entry.timestamp).getTime();
          const fiveMinutesAgo = entryTime - (5 * 60 * 1000);
          
          // Query database for recent prompts (more reliable than in-memory array)
          const recentPrompts = await persistentDB.getPromptsInTimeRange(
            new Date(fiveMinutesAgo).toISOString(),
            new Date(entryTime).toISOString(),
            50 // Limit to 50 most recent
          );
          
          // Filter for unlinked prompts with pending/captured status
          const candidatePrompts = recentPrompts
            .filter(p => {
              const status = p.status || 'captured';
              const linkedEntryId = p.linked_entry_id || p.linkedEntryId;
              return (status === 'pending' || status === 'captured') && !linkedEntryId;
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          
          const lastPrompt = candidatePrompts[0];
          
          if (lastPrompt) {
            // Persist to database (bidirectional linking)
            await persistentDB.updatePrompt(lastPrompt.id, {
              status: 'linked',
              linked_entry_id: entry.id
            });
            
            await persistentDB.updateEntry(entry.id, { 
              prompt_id: lastPrompt.id 
            });
            
            // Update in-memory if present
            const inMemoryPrompt = db.prompts.find(p => p.id === lastPrompt.id);
            if (inMemoryPrompt) {
              inMemoryPrompt.status = 'linked';
              inMemoryPrompt.linked_entry_id = entry.id;
            }
            entry.prompt_id = lastPrompt.id;
            
            const promptText = lastPrompt.text || lastPrompt.prompt || lastPrompt.content || '';
            console.log(`Linked prompt ${lastPrompt.id} ("${promptText.substring(0, 50)}...") to entry ${entry.id}`);
          }
        } catch (error) {
          console.error('Error linking prompt to entry:', error);
        }
        
        // Create matching event
        const event = {
          id: crypto.randomUUID(),
          session_id: workspaceSession,
          workspace_path: workspacePath,
          timestamp: entry.timestamp,
          type: 'code_change',
          details: JSON.stringify({ 
            file_path: relativePath,
            diff_summary: diff.summary,
            diff_size: diff.diffSize,
            lines_added: diff.linesAdded,
            lines_removed: diff.linesRemoved,
            chars_added: diff.charsAdded,
            chars_deleted: diff.charsDeleted,
            before_content: diff.beforeContent.length > 10000 ? diff.beforeContent.substring(0, 10000) + '\n... (truncated)' : diff.beforeContent,
            after_content: diff.afterContent.length > 10000 ? diff.afterContent.substring(0, 10000) + '\n... (truncated)' : diff.afterContent
          })
        };
        
        // Use enqueue function for reliable queuing
        enqueue('entry', entry);
        enqueue('event', event);
        
        // Update workspace data for event
        updateWorkspaceData(workspacePath, null, event);
        
        console.log(`File change detected: ${relativePath} in workspace: ${workspacePath}`);
      } else {
        console.log(`Change too small for ${relativePath}: ${diff.summary}`);
      }
      
      fileSnapshots.set(filePath, content);
    } else {
      console.log(`No content change for ${relativePath}`);
    }
  } catch (error) {
    console.error(` Error processing file ${filePath}:`, error.message);
  }
}

function startFileWatcher() {
  if (watcher) {
    watcher.close();
  }
  
  const workspacesToWatch = config.workspace_roots || config.workspaces || [config.root_dir];
  const autoDetect = config.auto_detect_workspaces !== false;
  
  if (autoDetect) {
    console.log(` Starting automatic workspace detection from ${workspacesToWatch.length} root(s):`);
  } else {
    console.log(` Starting file watcher for ${workspacesToWatch.length} workspace(s):`);
  }
  workspacesToWatch.forEach((ws, i) => {
    console.log(`   ${i + 1}. ${ws}`);
  });
  console.log(` Ignoring: ${config.ignore.join(', ')}`);
  
  watcher = chokidar.watch(workspacesToWatch, {
    ignored: config.ignore,
    persistent: true,
    ignoreInitial: true,
    depth: autoDetect ? 99 : 10,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });
  
  watcher
    .on('add', processFileChange)
    .on('change', processFileChange)
    .on('unlink', (filePath) => {
      // Detect the actual workspace from the file path
      const detectedWorkspace = detectWorkspace(filePath);
      fileSnapshots.delete(filePath);
      const relativePath = path.relative(detectedWorkspace || config.root_dir, filePath);
      console.log(` File deleted: ${relativePath} from workspace: ${detectedWorkspace}`);
    })
    .on('error', error => console.error(` Watcher error: ${error}`))
    .on('ready', () => {
      console.log(' File watcher ready');
    });
}

// Socket.IO connection handling with conversation streaming
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Track client's subscribed conversation streams
  const clientStreams = new Set();
  
  // Send initial data when client connects
  socket.emit('initial-data', {
    entries: db.entries,
    prompts: db.prompts,
    queue: queueSystem.getQueue(),
    ideState: ideStateCapture ? ideStateCapture.getLatestState() : null,
    activeStreams: Array.from(conversationStreams.keys()),
    timestamp: Date.now()
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Clean up client streams
    clientStreams.clear();
  });
  
  // Subscribe to conversation stream
  socket.on('subscribe-conversation', (conversationId) => {
    if (conversationId) {
      clientStreams.add(conversationId);
      console.log(`[WS] Client ${socket.id} subscribed to conversation: ${conversationId}`);
      
      // Enable streaming for this conversation if not already enabled
      if (!conversationStreams.has(conversationId)) {
        conversationStreams.set(conversationId, {
          id: conversationId,
          enabled: true,
          startTime: Date.now(),
          messageCount: 0,
          subscribers: new Set([socket.id])
        });
      } else {
        conversationStreams.get(conversationId).subscribers.add(socket.id);
      }
      
      socket.emit('conversation-subscribed', { conversation_id: conversationId });
    }
  });
  
  // Unsubscribe from conversation stream
  socket.on('unsubscribe-conversation', (conversationId) => {
    if (conversationId && clientStreams.has(conversationId)) {
      clientStreams.delete(conversationId);
      console.log(`[WS] Client ${socket.id} unsubscribed from conversation: ${conversationId}`);
      
      const stream = conversationStreams.get(conversationId);
      if (stream && stream.subscribers) {
        stream.subscribers.delete(socket.id);
        if (stream.subscribers.size === 0) {
          conversationStreams.delete(conversationId);
        }
      }
      
      socket.emit('conversation-unsubscribed', { conversation_id: conversationId });
    }
  });
  
  // Handle client requests for specific data
  socket.on('request-data', async (dataType) => {
    try {
      switch (dataType) {
        case 'entries':
          socket.emit('entries-update', db.entries);
          break;
        case 'prompts':
          socket.emit('prompts-update', db.prompts);
          break;
        case 'queue':
          socket.emit('queue-update', queueSystem.getQueue());
          break;
        case 'ide-state':
          socket.emit('ide-state-update', ideStateCapture.getLatestState());
          break;
        case 'conversations':
          // Get all conversations from prompts
          const conversations = {};
          (db.prompts || []).forEach(prompt => {
            if (prompt.conversation_id) {
              if (!conversations[prompt.conversation_id]) {
                conversations[prompt.conversation_id] = {
                  id: prompt.conversation_id,
                  title: prompt.conversation_title,
                  messages: []
                };
              }
              conversations[prompt.conversation_id].messages.push(prompt);
            }
          });
          socket.emit('conversations-update', Object.values(conversations));
          break;
        case 'all':
          socket.emit('full-update', {
            entries: db.entries,
            prompts: db.prompts,
            queue: queueSystem.getQueue(),
            ideState: ideStateCapture.getLatestState(),
            activeStreams: Array.from(conversationStreams.keys()),
            timestamp: Date.now()
          });
          break;
      }
    } catch (error) {
      socket.emit('error', { message: `Failed to fetch ${dataType}`, error: error.message });
    }
  });
  
  // Send current data to newly connected client
  socket.emit('initial-data', {
    entries: db.entries,
    events: events,
    queue: queue,
    activeStreams: Array.from(conversationStreams.keys())
  });
});

// Start the server
// Server startup moved to end of file to avoid duplicate

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Shutting down companion service...');
  if (watcher) {
    watcher.close();
  }
  clipboardMonitor.stop();
  
  // Clear capture intervals
  Object.values(captureIntervals).forEach(interval => {
    if (interval) clearInterval(interval);
  });
  
  // Stop IDE state capture
  if (ideStateCapture) {
    ideStateCapture.stop();
  }
  
  server.close(() => {
    console.log(' Companion service stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n Shutting down companion service...');
  if (watcher) {
    watcher.close();
  }
  clipboardMonitor.stop();
  
  // Clear capture intervals
  Object.values(captureIntervals).forEach(interval => {
    if (interval) clearInterval(interval);
  });
  
  // Stop IDE state capture
  if (ideStateCapture) {
    ideStateCapture.stop();
  }
  
  server.close(() => {
    console.log(' Companion service stopped');
    process.exit(0);
  });
});

// Enhanced model detection function
function extractModelInfo(data) {
  const modelInfo = {
    model: 'Unknown',
    mode: 'Unknown',
    provider: 'Unknown',
    isAuto: false
  };

  // Check for explicit model fields in data
  if (data.model) {
    modelInfo.model = data.model;
  } else if (data.ai_model) {
    modelInfo.model = data.ai_model;
  } else if (data.assistant_model) {
    modelInfo.model = data.assistant_model;
  }

  // Check for mode information
  if (data.mode) {
    modelInfo.mode = data.mode;
  } else if (data.assistant_mode) {
    modelInfo.mode = data.assistant_mode;
  }

  // Detect Auto mode from various indicators
  if (modelInfo.mode.toLowerCase().includes('auto') || 
      modelInfo.model.toLowerCase().includes('auto') ||
      data.auto_mode === true ||
      data.is_auto === true ||
      data.content?.toLowerCase().includes('auto mode') ||
      data.content?.toLowerCase().includes('automatic model selection')) {
    modelInfo.isAuto = true;
    modelInfo.mode = 'Auto';
  }

  // Detect provider from model name or content
  if (modelInfo.model.toLowerCase().includes('gpt') || modelInfo.model.toLowerCase().includes('openai')) {
    modelInfo.provider = 'OpenAI';
  } else if (modelInfo.model.toLowerCase().includes('claude') || modelInfo.model.toLowerCase().includes('anthropic')) {
    modelInfo.provider = 'Anthropic';
  } else if (modelInfo.model.toLowerCase().includes('gemini') || modelInfo.model.toLowerCase().includes('google')) {
    modelInfo.provider = 'Google';
  } else if (modelInfo.isAuto) {
    modelInfo.provider = 'Auto';
  } else if (data.content) {
    // Try to detect from content patterns
    const content = data.content.toLowerCase();
    if (content.includes('gpt-') || content.includes('openai')) {
      modelInfo.provider = 'OpenAI';
    } else if (content.includes('claude') || content.includes('anthropic')) {
      modelInfo.provider = 'Anthropic';
    } else if (content.includes('gemini') || content.includes('google')) {
      modelInfo.provider = 'Google';
    }
  }

  return modelInfo;
}

// Load data from persistent database on startup - LAZY LOADING
async function loadPersistedData() {
  try {
    console.log('[SAVE] Initializing database (lazy loading mode)...');
    await persistentDB.init();
    
    // DON'T load all data - just get stats and setup
    const stats = await persistentDB.getStats();
    
    // Set nextId from database max ID (without loading all records)
    const maxIds = await persistentDB.getMaxIds();
    db.nextId = Math.max(maxIds.entryId || 0, maxIds.promptId || 0) + 1;
    
    // Keep in-memory arrays empty - query database on demand
    db._entries = [];  // Don't load - use database queries
    db._prompts = [];  // Don't load - use database queries
    
    console.log(`[SUCCESS] Database ready with ${stats.entries} entries and ${stats.prompts} prompts (lazy loading)`);
    console.log(`[MEMORY] In-memory cache disabled - using on-demand queries`);
  } catch (error) {
    console.error('Error loading persisted data:', error.message);
    console.log('   Starting with empty database');
  }
}

// Start the server
const HOST = process.env.HOST || '127.0.0.1';

// Repair function to fix existing unlinked data
async function repairDatabaseLinks() {
  try {
    console.log('[REPAIR] Starting database link repair...');
    
    // Get all prompts that have linked_entry_id
    const promptsWithLinks = await persistentDB.getPromptsWithLinkedEntries();
    let repairedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    
    for (const prompt of promptsWithLinks) {
      const linkedEntryId = prompt.linked_entry_id || prompt.linkedEntryId;
      if (!linkedEntryId) {
        skippedCount++;
        continue;
      }
      
      // Try to find entry by the linked_entry_id (could be UUID or numeric)
      let entry = await persistentDB.getEntryById(linkedEntryId);
      
      // If not found by ID, try to find by timestamp proximity (within 5 minutes)
      if (!entry) {
        // Handle both ISO string and numeric timestamps
        let promptTime;
        if (typeof prompt.timestamp === 'number') {
          promptTime = prompt.timestamp;
        } else if (typeof prompt.timestamp === 'string') {
          promptTime = new Date(prompt.timestamp).getTime();
        } else {
          notFoundCount++;
          continue;
        }
        
        if (isNaN(promptTime) || !isFinite(promptTime)) {
          notFoundCount++;
          continue;
        }
        
        const fiveMinutesAgo = promptTime - (5 * 60 * 1000);
        const fiveMinutesAfter = promptTime + (5 * 60 * 1000);
        
        // Find entries in the same workspace within time window
        const nearbyEntries = await persistentDB.getEntriesInTimeRange(
          new Date(fiveMinutesAgo).toISOString(),
          new Date(fiveMinutesAfter).toISOString(),
          prompt.workspace_path || prompt.workspacePath
        );
        
        // Find the closest entry without a prompt_id
        entry = nearbyEntries
          .filter(e => !e.prompt_id)
          .sort((a, b) => {
            const aTime = new Date(a.timestamp).getTime();
            const bTime = new Date(b.timestamp).getTime();
            return Math.abs(aTime - promptTime) - Math.abs(bTime - promptTime);
          })[0];
      }
      
      if (!entry) {
        notFoundCount++;
        continue;
      }
      
      if (entry.prompt_id) {
        skippedCount++;
        continue;
      }
      
      // Fix: Set prompt_id on entry
      try {
        await persistentDB.updateEntry(entry.id, {
          prompt_id: prompt.id
        });
        repairedCount++;
        console.log(`[REPAIR] Fixed entry ${entry.id} -> prompt ${prompt.id}`);
      } catch (updateError) {
        console.error(`[REPAIR] Error updating entry ${entry.id}:`, updateError.message);
      }
    }
    
    console.log(`[REPAIR] Completed: Fixed ${repairedCount} entries, skipped ${skippedCount}, not found ${notFoundCount}`);
    return { 
      repaired: repairedCount, 
      total: promptsWithLinks.length,
      skipped: skippedCount,
      notFound: notFoundCount
    };
  } catch (error) {
    console.error('[REPAIR] Error repairing links:', error);
    return { repaired: 0, error: error.message };
  }
}

loadPersistedData().then(() => {
  // Repair existing links on startup
  repairDatabaseLinks().then(result => {
    if (result.repaired > 0) {
      console.log(`[REPAIR] Repaired ${result.repaired} database links on startup`);
    }
  }).catch(err => {
    console.warn('[REPAIR] Link repair failed (non-critical):', err.message);
  });
  
  // Use server.listen() instead of app.listen() to ensure Socket.IO works properly
  server.listen(PORT, HOST, () => {
    console.log(`[LAUNCH] Companion service running on http://${HOST}:${PORT}`);
    console.log(`[DATA] Health endpoint: http://${HOST}:${PORT}/health`);
    console.log(`[UP] Activity endpoint: http://${HOST}:${PORT}/api/activity`);
    console.log(`[SEARCH] Queue endpoint: http://${HOST}:${PORT}/queue`);
    console.log(` WebSocket server running on ws://${HOST}:${PORT}`);
    const workspacesToWatch = config.workspace_roots || config.workspaces || [config.root_dir];
    const autoDetect = config.auto_detect_workspaces !== false;
    if (autoDetect) {
      console.log(` Auto-detecting workspaces from ${workspacesToWatch.length} root location(s):`);
    } else {
      console.log(` Watching ${workspacesToWatch.length} configured workspace(s):`);
    }
  workspacesToWatch.forEach((ws, i) => {
    console.log(`   ${i + 1}. ${ws}`);
  });
  console.log(` Ignoring: ${config.ignore.length} patterns`);
  
  // Start file watcher
  startFileWatcher();
  
  // Start clipboard monitor for prompt capture
  if (config.enable_clipboard === true) {
    clipboardMonitor.start();
    console.log(' Clipboard monitor started for prompt capture');
  } else {
    console.log(' Clipboard monitor disabled in config');
  }
  
  // Automatic prompt sync DISABLED (causes OOM - use /api/cursor-database instead)
  // The dashboard should query /api/cursor-database for real-time data
  // Historical data already in database from previous syncs
  console.log('[SYNC] Automatic prompt sync DISABLED (use /api/cursor-database for fresh data)');
  
  // Start terminal monitor
  if (config.enable_terminal_monitoring !== false) {
    terminalMonitor.start();
    
    // Listen for terminal commands and track errors
    terminalMonitor.on('command', async (commandRecord) => {
      // Save to database
      try {
        await persistentDB.saveTerminalCommand(commandRecord);
      } catch (error) {
        console.error('Error persisting terminal command:', error);
      }
      
      // Track terminal errors if exit code is non-zero
      if (commandRecord.exitCode && commandRecord.exitCode !== 0) {
        errorTracker.trackTerminalError(
          commandRecord.command,
          commandRecord.output || '',
          commandRecord.exitCode
        );
      }
      
      // Emit WebSocket event for real-time updates
      if (global.io) {
        global.io.emit('terminal-command', commandRecord);
      }
    });
    
    console.log('[SYSTEM]  Terminal monitor started for command tracking');
  } else {
    console.log(' Terminal monitor disabled in config');
  }
  
  // Start enhanced raw data capture
  startRawDataCapture();

  // Build Lunr index after initial data is loaded
  buildLunrIndex();
  
  // Start periodic session timeout check (every 5 minutes)
  setInterval(() => {
    checkSessionTimeout();
  }, 5 * 60 * 1000);
  
  console.log('[TIME] Session timeout check started (every 5 minutes)');
  
  // Start Cursor database monitoring
  console.log('[SEARCH] Starting Cursor database monitoring...');
  cursorDbParser.startMonitoring(async (data) => {
    if (data.prompts && data.prompts.length > 0) {
      console.log(`[CHAT] Found ${data.prompts.length} prompts in Cursor database`);
      
      // Optionally add to our database (avoid duplicates)
      for (const prompt of data.prompts) {
        const exists = db.prompts.find(p => p.text === prompt.text);
        if (!exists) {
          const enhancedPrompt = {
            ...prompt,
            id: db.nextId++,
            added_from_database: true
          };
          
          db.prompts.push(enhancedPrompt);
          
          // ===== SAVE TO PERSISTENT DATABASE =====
          try {
            await persistentDB.savePrompt(enhancedPrompt);
            console.log(`   Saved prompt to SQLite: ${enhancedPrompt.id}`);
            
            // Link to active TODO
            if (currentActiveTodo) {
              await persistentDB.addPromptToTodo(currentActiveTodo, enhancedPrompt.id);
              await persistentDB.linkEventToTodo('prompt', enhancedPrompt.id);
              console.log(`   [TODO] Linked prompt ${enhancedPrompt.id} to TODO ${currentActiveTodo}`);
            }
          } catch (saveError) {
            console.warn('Error saving prompt to database:', saveError.message);
          }
          // ===== END PERSISTENCE =====
          
          // ===== NEW: Track analytics for this prompt =====
          try {
            // Analyze context window
            const contextAnalysis = await contextAnalyzer.analyzePromptContext(prompt);
            if (contextAnalysis) {
              enhancedPrompt.contextAnalysis = contextAnalysis;
              
              // Track context changes (files added/removed)
              const contextChange = await contextChangeTracker.trackContextChange(
                contextAnalysis,
                {
                  promptId: enhancedPrompt.id,
                  timestamp: Date.now(),
                  sessionId: activeSession
                }
              );
              if (contextChange) {
                enhancedPrompt.contextChange = contextChange;
              }
            }
            
            // Track prompt creation for productivity metrics
            productivityTracker.trackPromptCreated(enhancedPrompt);
            
            // Detect prompt iterations
            productivityTracker.detectPromptIteration(enhancedPrompt, db.prompts);
            
            // Mark as AI-generated code source
            if (enhancedPrompt.linkedEntryId) {
              const linkedEntry = db.entries.find(e => e.id === enhancedPrompt.linkedEntryId);
              if (linkedEntry) {
                productivityTracker.markAIGeneratedCode(linkedEntry);
              }
            }
          } catch (trackingError) {
            console.warn('Error tracking prompt analytics:', trackingError.message);
          }
          // ===== END NEW TRACKING =====
        }
      }
    }
  });
  }); // Close app.listen callback
}).catch(error => {
  console.error('Failed to load persisted data:', error);
  // Start anyway with empty database
  // Use server.listen() instead of app.listen() to ensure Socket.IO works properly
  server.listen(PORT, HOST, () => {
    console.log(`[LAUNCH] Companion service running on http://${HOST}:${PORT} (without persisted data)`);
  });
});