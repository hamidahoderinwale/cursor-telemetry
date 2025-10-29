#!/usr/bin/env node

const path = require('path');

// Load environment variables from workspace root
require('dotenv').config({ path: path.resolve(__dirname, '../../../../../.env') });

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const http = require('http');
const chokidar = require('chokidar');
const fs = require('fs');
const crypto = require('crypto');
const lunr = require('lunr'); // Import lunr
// Import the new queue system and clipboard monitor
const { queue: queueSystem } = require('./queue.js');
const { clipboardMonitor } = require('./clipboardMonitor.js');

// Enhanced raw data capture modules
const os = require('os');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import IDE state capture service
const IDEStateCapture = require('./ide-state-capture.js');

// Import prompt capture system
const PromptCaptureSystem = require('./prompt-capture-system.js');

// Import Cursor database parser
const CursorDatabaseParser = require('./cursor-db-parser.js');

// Import screenshot monitor
const ScreenshotMonitor = require('./screenshot-monitor.js');

// Import persistent database
const PersistentDB = require('./persistent-db.js');

// Import reasoning engine
const { ReasoningEngine } = require('./reasoning-engine.js');

// Import new analytics modules
const ContextAnalyzer = require('./context-analyzer.js');
const ErrorTracker = require('./error-tracker.js');
const ProductivityTracker = require('./productivity-tracker.js');
const TerminalMonitor = require('./terminal-monitor.js');

// Initialize persistent database
const persistentDB = new PersistentDB();

// Initialize analytics trackers
const contextAnalyzer = new ContextAnalyzer(persistentDB);
const errorTracker = new ErrorTracker();
const productivityTracker = new ProductivityTracker();
const terminalMonitor = new TerminalMonitor({
  captureOutput: false, // Don't execute commands, just monitor
  debug: false
});

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

// Real-time broadcast function
function broadcastUpdate(type, data) {
  io.emit('activityUpdate', { type, data });
}

// Middleware
app.use(compression()); // Enable gzip compression for all responses
app.use(cors({ origin: '*' })); // Explicitly allow all origins
app.use(express.json());

// Serve static files from public directory
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));
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
        
        console.log(`📄 Captured log data: ${logFiles.length} files`);
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
  
  // Initial capture
  captureSystemResources();
  captureGitData();
  captureCursorAppState();
  captureCursorDatabase();
  captureLogData();
  
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

// Health check
app.get('/health', (req, res) => {
  const queueStats = queueSystem.getStats();
  const clipboardStats = clipboardMonitor.getStats();
  
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
// API endpoint for activity data (used by dashboard) with pagination
app.get('/api/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000 at a time
    const offset = parseInt(req.query.offset) || 0;
    const allEntries = db.entries;
    const allPrompts = db.prompts;
    
    // Sort by timestamp descending (most recent first)
    const sortedEntries = [...allEntries].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Apply pagination
    const paginatedEntries = sortedEntries.slice(offset, offset + limit);
    
    // Convert entries to events format for dashboard compatibility
    const events = paginatedEntries.map(entry => {
      // Calculate diff stats if we have before/after content
      let diffStats = {};
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
        description: entry.description || entry.notes || 'File change detected'
      };
    });
    
    console.log(`API: Returning ${events.length} of ${allEntries.length} activity events (offset: ${offset})`);
    res.json({
      data: events,
      pagination: {
        total: allEntries.length,
        limit,
        offset,
        hasMore: offset + events.length < allEntries.length
      }
    });
  } catch (error) {
    console.error('Error fetching activity data:', error);
    res.status(500).json({ error: 'Failed to fetch activity data' });
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
    const allEntries = db.entries;
    const allPrompts = db.prompts;
    
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
          confidence: p.confidence || 'medium'
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
app.get('/api/cursor-database', async (req, res) => {
  try {
    const data = await cursorDbParser.getAllData();
    res.json({
      success: true,
      data: data,
      timestamp: Date.now()
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
app.get('/api/analytics/context', (req, res) => {
  try {
    const analytics = contextAnalyzer.getContextAnalytics();
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

// Error Tracking Endpoints
app.get('/api/analytics/errors', (req, res) => {
  try {
    const stats = errorTracker.getErrorStats();
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
app.get('/api/analytics/productivity', (req, res) => {
  try {
    const stats = productivityTracker.getProductivityStats();
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

// Database export
app.get('/api/export/database', async (req, res) => {
  try {
    console.log('📤 Export request received');
    
    // Gather all data from database including new tables
    const [entries, prompts, events, terminalCommands, contextSnapshots, contextAnalytics] = await Promise.all([
      persistentDB.getAllEntries(),
      persistentDB.getAllPrompts(),
      persistentDB.getAllEvents(),
      persistentDB.getAllTerminalCommands(10000),  // Get up to 10k commands
      persistentDB.getContextSnapshots({ since: 0, limit: 10000 }),  // All snapshots
      persistentDB.getContextAnalytics()  // Context usage analytics
    ]);
    
    // Get in-memory data
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '2.0',  // Bumped version for new fields
        totalEntries: entries.length,
        totalPrompts: prompts.length,
        totalEvents: events.length,
        totalTerminalCommands: terminalCommands.length,
        totalContextSnapshots: contextSnapshots.length
      },
      entries: entries,
      prompts: prompts,
      events: events,
      terminal_commands: terminalCommands,  // NEW: Full command history
      context_snapshots: contextSnapshots,  // NEW: Context usage over time
      context_analytics: contextAnalytics,  // NEW: Aggregated context stats
      workspaces: db.workspaces || [],
      stats: {
        sessions: db.entries.length,
        fileChanges: entries.length,
        aiInteractions: prompts.length,
        totalActivities: events.length,
        terminalCommands: terminalCommands.length,
        avgContextUsage: contextAnalytics.avgContextUtilization || 0
      }
    };
    
    console.log(`[SUCCESS] Exported ${entries.length} entries, ${prompts.length} prompts, ${events.length} events, ${terminalCommands.length} terminal commands, ${contextSnapshots.length} context snapshots`);
    
    res.json({
      success: true,
      data: exportData
    });
    
  } catch (error) {
    console.error('Error exporting database:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API endpoint for file contents (for TF-IDF analysis)
app.get('/api/file-contents', async (req, res) => {
  try {
    const entries = await persistentDB.getAllEntries();
    
    // Helper to check if a string is a Git object hash (40-char hex)
    const isGitObjectHash = (str) => /^[0-9a-f]{40}$/i.test(str);
    
    // Build file content map with latest content for each file
    const fileContents = new Map();
    
    entries.forEach(entry => {
      const filePath = entry.file_path;
      if (!filePath) return;
      
      // Use after_code as the most recent content
      const content = entry.after_code || entry.after_content || '';
      if (!content) return;
      
      // Skip very small files (likely Git metadata) unless they're known Git files
      if (content.length < 10 && !filePath.includes('.git/')) return;
      
      const fileName = filePath.split('/').pop();
      let displayName = fileName;
      let fileType = 'file';
      
      // Try to decode Git-specific files
      if (filePath.includes('.git/')) {
        // Check if filename is a Git object hash
        if (isGitObjectHash(fileName)) {
          const resolved = resolveGitObject(fileName, filePath);
          if (resolved) {
            displayName = resolved;
            fileType = 'git-object';
          } else {
            // Skip unknown Git objects
            return;
          }
        }
        // Check if it's a Git ref file
        else if (filePath.includes('.git/refs/') || filePath.endsWith('.git/HEAD') || 
                 filePath.endsWith('.git/ORIG_HEAD') || filePath.endsWith('.git/FETCH_HEAD')) {
          const decoded = decodeGitRef(filePath, content);
          if (decoded) {
            displayName = decoded;
            fileType = 'git-ref';
          }
        }
        // Filter out pack files and logs
        else if (filePath.includes('.git/objects/pack/') || filePath.includes('.git/logs/')) {
          return;
        }
        // Keep known Git config files
        else if (fileName === 'index' || fileName === 'config' || fileName === 'COMMIT_EDITMSG') {
          displayName = `Git ${fileName}`;
          fileType = 'git-meta';
        }
      }
      
      // Create or update file entry
      if (!fileContents.has(filePath)) {
        fileContents.set(filePath, {
          path: filePath,
          name: displayName,
          originalName: fileName,
          ext: filePath.split('.').pop()?.toLowerCase(),
          type: fileType,
          content: content,
          lastModified: entry.timestamp,
          changes: 1,
          size: content.length
        });
      } else {
        // Update if this entry is more recent
        const existing = fileContents.get(filePath);
        if (new Date(entry.timestamp) > new Date(existing.lastModified)) {
          existing.content = content;
          existing.lastModified = entry.timestamp;
          existing.size = content.length;
        }
        existing.changes++;
      }
    });
    
    const result = Array.from(fileContents.values());
    console.log(`[FILE] Serving ${result.length} files with content for TF-IDF analysis (filtered Git objects)`);
    
    res.json({
      files: result,
      totalFiles: result.length,
      totalSize: result.reduce((sum, f) => sum + f.size, 0)
    });
  } catch (error) {
    console.error('Error fetching file contents:', error);
    res.status(500).json({ error: 'Failed to fetch file contents' });
  }
});

// Chat query endpoint with reasoning engine
const reasoningEngine = new ReasoningEngine();

app.post('/api/chat/query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    console.log('[CHAT] Chat query:', query);
    
    // Gather telemetry data
    const allEntries = await persistentDB.getAllEntries();
    const telemetryData = {
      events: allEntries,
      prompts: db.prompts || [],
      sessions: [], // Session data structure to be implemented
      files: db.entries || []
    };
    
    // Process query with reasoning engine
    const response = await reasoningEngine.query(query, telemetryData);
    
    console.log('[SUCCESS] Generated response with', response.confidence, 'confidence');
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to process query',
      details: error.message 
    });
  }
});

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

// MCP endpoints
app.post('/mcp/log-prompt-response', (req, res) => {
  console.log('[NOTE] MCP request received:', req.body);
  // Check if we need to create a new session due to timeout
  checkSessionTimeout();
  updateActivityTime();
  
  const { session_id, file_path, prompt, response } = req.body;
  
  // Detect workspace for this file
  const workspacePath = file_path ? detectWorkspace(file_path) : currentWorkspace;
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  const entry = {
    id: crypto.randomUUID(),
    session_id: session_id || workspaceSession,
    workspace_path: workspacePath,
    timestamp: new Date().toISOString(),
    source: 'mcp',
    file_path: file_path || '',
    prompt: prompt || '',
    response: response || '',
    notes: 'Logged via MCP'
  };
  
  console.log('[SUCCESS] Creating entry:', entry);
  
  // Create matching event
  const event = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    workspace_path: workspacePath,
    timestamp: entry.timestamp,
    type: 'prompt_response',
    details: JSON.stringify({ file_path: entry.file_path })
  };
  
  // Use enqueue function for reliable queuing
  enqueue('entry', entry);
  enqueue('event', event);
  
  // Update workspace data
  updateWorkspaceData(workspacePath, entry, event);
  
  console.log(`[SUCCESS] MCP entry added: ${entry.id} - ${entry.file_path} in workspace: ${workspacePath}`);
  
  res.json({ success: true, entry_id: entry.id });
});

app.post('/mcp/log-code-change', (req, res) => {
  // Check if we need to create a new session due to timeout
  checkSessionTimeout();
  updateActivityTime();
  
  const { session_id, file_path, before_code, after_code } = req.body;
  
  // Detect workspace for this file
  const workspacePath = file_path ? detectWorkspace(file_path) : currentWorkspace;
  const workspaceSession = getWorkspaceSession(workspacePath);
  
  const entry = {
    id: crypto.randomUUID(),
    session_id: session_id || workspaceSession,
    workspace_path: workspacePath,
    timestamp: new Date().toISOString(),
    source: 'mcp',
    file_path: file_path || '',
    before_code: before_code || '',
    after_code: after_code || '',
    notes: 'Code change logged via MCP'
  };
  
  // Use enqueue function for reliable queuing
  enqueue('entry', entry);
  
  // Create matching event
  const event = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    workspace_path: workspacePath,
    timestamp: entry.timestamp,
    type: 'code_change',
    details: JSON.stringify({ file_path: entry.file_path })
  };
  enqueue('event', event);
  
  // Update workspace data
  updateWorkspaceData(workspacePath, entry, event);
  
  console.log(`[SUCCESS] MCP code change added: ${entry.id} - ${entry.file_path} in workspace: ${workspacePath}`);
  console.log(`[DATA] Total entries: ${entries.length}, events: ${events.length}`);
  
  res.json({ success: true, entry_id: entry.id });
});

app.post('/mcp/log-event', (req, res) => {
  // Check if we need to create a new session due to timeout
  checkSessionTimeout();
  updateActivityTime();
  
  const { session_id, type, details, file_path } = req.body;
  
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
    timestamp: new Date().toISOString(),
    type: type || 'unknown',
    details: typeof details === 'string' ? details : JSON.stringify(details || {})
  };
  
  // Use enqueue function for reliable queuing
  enqueue('event', event);
  
  // Update workspace data
  updateWorkspaceData(workspacePath, null, event);
  
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
          
          // Find recent prompts (pending or captured status, within time window)
          const recentPrompts = db.prompts
            .filter(p => {
              const promptTime = new Date(p.timestamp).getTime();
              return (p.status === 'pending' || p.status === 'captured') && 
                     promptTime >= fiveMinutesAgo &&
                     promptTime <= entryTime &&
                     !p.linked_entry_id; // Not already linked
            })
            .sort((a, b) => b.timestamp - a.timestamp);
          
          const lastPrompt = recentPrompts[0];
          
          if (lastPrompt) {
            // Update in-memory
            lastPrompt.status = 'linked';
            lastPrompt.linked_entry_id = entry.id;
            entry.prompt_id = lastPrompt.id;
            
            // Persist to database
            await persistentDB.updatePrompt(lastPrompt.id, {
              status: 'linked',
              linked_entry_id: entry.id
            });
            
            await persistentDB.updateEntry(entry.id, { 
              prompt_id: lastPrompt.id 
            });
            
            console.log(`✓ Linked prompt ${lastPrompt.id} ("${lastPrompt.text?.substring(0, 50)}...") to entry ${entry.id}`);
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Send initial data when client connects
  socket.emit('initial-data', {
    entries: db.entries,
    prompts: db.prompts,
    queue: queueSystem.getQueue(),
    ideState: ideStateCapture ? ideStateCapture.getLatestState() : null,
    timestamp: Date.now()
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
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
        case 'all':
          socket.emit('full-update', {
            entries: db.entries,
            prompts: db.prompts,
            queue: queueSystem.getQueue(),
            ideState: ideStateCapture.getLatestState(),
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
    queue: queue
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

// Load data from persistent database on startup
async function loadPersistedData() {
  try {
    console.log('[SAVE] Loading persisted data from SQLite...');
    await persistentDB.init();
    
    const [entries, prompts] = await Promise.all([
      persistentDB.getAllEntries(),
      persistentDB.getAllPrompts()
    ]);
    
    // Restore to in-memory database
    db._entries = entries;
    db._prompts = prompts;
    
    // Update nextId to be higher than any existing ID
    if (entries.length > 0) {
      const maxId = Math.max(...entries.map(e => e.id));
      db.nextId = maxId + 1;
    }
    if (prompts.length > 0) {
      const maxId = Math.max(...prompts.map(p => p.id));
      db.nextId = Math.max(db.nextId, maxId + 1);
    }
    
    const stats = await persistentDB.getStats();
    console.log(`[SUCCESS] Loaded ${stats.entries} entries and ${stats.prompts} prompts from database`);
  } catch (error) {
    console.error('⚠️  Error loading persisted data:', error.message);
    console.log('   Starting with empty database');
  }
}

// Start the server
const HOST = process.env.HOST || 'localhost';

loadPersistedData().then(() => {
  app.listen(PORT, HOST, () => {
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
  console.error('❌ Failed to load persisted data:', error);
  // Start anyway with empty database
  app.listen(PORT, HOST, () => {
    console.log(`[LAUNCH] Companion service running on http://${HOST}:${PORT} (without persisted data)`);
  });
});