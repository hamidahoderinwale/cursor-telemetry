#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const http = require('http');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const lunr = require('lunr'); // Import lunr
// Import the new queue system and clipboard monitor
const { queue: queueSystem } = require('./queue.js');
const { clipboardMonitor } = require('./clipboardMonitor.js');

// Enhanced raw data capture modules
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Import IDE state capture service
const IDEStateCapture = require('./ide-state-capture.js');

// Import prompt capture system
const PromptCaptureSystem = require('./prompt-capture-system.js');

// Simple in-memory database for companion service (replacing Dexie/IndexedDB)
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
        return item;
    },
    
    async update(table, id, updates) {
        const index = this[table].findIndex(item => item.id === id);
        if (index >= 0) {
            this[table][index] = { ...this[table][index], ...updates };
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
app.use(cors({ origin: '*' })); // Explicitly allow all origins
app.use(express.json());

let ideStateCapture = new IDEStateCapture(); // Changed from const to let
ideStateCapture.start(); // Start capturing IDE state

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
  console.log(`🔄 Created new session: ${activeSession}`);
  return activeSession;
}

// Function to check if session should be renewed
function checkSessionTimeout() {
  const now = Date.now();
  const timeSinceLastActivity = now - lastActivityTime;
  
  if (timeSinceLastActivity > SESSION_TIMEOUT) {
    console.log(`⏰ Session timeout reached (${Math.round(timeSinceLastActivity / 60000)} minutes), creating new session`);
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
    console.log(`🔍 Added ${item.kind} ${item.payload.id} to Lunr index.`);
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
  
  console.log(`🔍 Lunr index built with ${entries.length} entries and ${events.length} events.`);
}

function updateLunrIndex(item) {
  // In Lunr 2.x, we need to rebuild the index when adding new documents
  // This is not ideal for performance, but it's the only way with this version
  try {
    buildLunrIndex();
    console.log(`🔍 Rebuilt Lunr index with new ${item.kind} ${item.payload.id}.`);
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
    
    console.log(`📊 Captured system resources: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB memory`);
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
    
    console.log(`📝 Captured git data: branch ${gitBranch.trim()}`);
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
    
    console.log(`🍎 Captured Cursor app state: active=${isActive}, windows=${windowCount}`);
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
          console.log(`📊 Found Cursor database: ${dbPath}`);
          
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
            
            console.log(`📊 Captured Cursor database info: ${tables.length} tables`);
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
  console.log('🚀 Starting enhanced raw data capture...');
  
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
  
  console.log('✅ Enhanced raw data capture started');
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
  console.log('🎯 Auto-detecting workspaces from activity in:', workspacesToWatch);
  console.log('📊 All workspaces will be discovered dynamically from file changes');
} else {
  console.log('🎯 Monitoring configured workspaces:', workspacesToWatch);
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
app.get('/api/workspaces', (req, res) => {
  const workspaces = Array.from(workspaceData.entries()).map(([path, data]) => ({
    path,
    entries: data.entries.length,
    events: data.events.length,
    lastActivity: data.lastActivity,
    sessionId: workspaceSessions.get(path)
  }));
  res.json(workspaces);
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
// API endpoint for activity data (used by dashboard)
app.get('/api/activity', async (req, res) => {
  try {
    const allEntries = db.entries;
    const allPrompts = db.prompts;
    
    // Convert entries to events format for dashboard compatibility
    const events = allEntries.map(entry => ({
      id: entry.id,
      type: entry.type || 'file_change',
      timestamp: entry.timestamp,
      session_id: entry.session_id || 'default',
      workspace_path: entry.workspace_path || entry.file_path || '/unknown',
      file_path: entry.file_path,
      details: JSON.stringify({
        content: entry.content,
        before_content: entry.before_content,
        after_content: entry.after_content,
        diff: entry.diff,
        file_path: entry.file_path,
        workspace_path: entry.workspace_path
      }),
      title: entry.title || `File Change: ${entry.file_path ? entry.file_path.split('/').pop() : 'Unknown'}`,
      description: entry.description || 'File change detected'
    }));
    
    console.log(`API: Returning ${events.length} activity events`);
    res.json(events);
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
    
    const entriesWithPrompts = allEntries.map(entry => ({
      ...entry,
      prompt: entry.prompt_id ? allPrompts.find(p => p.id === entry.prompt_id) : null
    }));
    
    res.json(entriesWithPrompts);
  } catch (error) {
    console.error('Error fetching entries with prompts:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
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
  console.log('📝 MCP request received:', req.body);
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
  
  console.log('✅ Creating entry:', entry);
  
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
  
  console.log(`✅ MCP entry added: ${entry.id} - ${entry.file_path} in workspace: ${workspacePath}`);
  
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
  
  console.log(`✅ MCP code change added: ${entry.id} - ${entry.file_path} in workspace: ${workspacePath}`);
  console.log(`📊 Total entries: ${entries.length}, events: ${events.length}`);
  
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
  
  console.log(`✅ MCP event added: ${event.id} - ${event.type} in workspace: ${workspacePath}`);
  console.log(`📊 Total events: ${events.length}`);
  
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
  
  return {
    diffSize,
    isSignificant,
    summary: `+${text2.length - text1.length} chars`
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
        
        // Link the most recent pending prompt to this entry
        try {
          const lastPrompt = db.prompts
            .filter(p => p.status === 'pending')
            .sort((a, b) => b.timestamp - a.timestamp)[0];
          
          if (lastPrompt) {
            await db.update('prompts', lastPrompt.id, {
              status: 'linked',
              linked_entry_id: entry.id
            });
            entry.prompt_id = lastPrompt.id;
            
            // Update the entry in database with prompt_id
            await db.update('entries', entry.id, { prompt_id: lastPrompt.id });
            
            console.log(`Linked prompt ${lastPrompt.id} to entry ${entry.id}`);
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
            diff_size: diff.diffSize
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

// Start the server
const HOST = process.env.HOST || 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Companion service running on http://${HOST}:${PORT}`);
  console.log(`📊 Health endpoint: http://${HOST}:${PORT}/health`);
  console.log(`📈 Activity endpoint: http://${HOST}:${PORT}/api/activity`);
  console.log(`🔍 Queue endpoint: http://${HOST}:${PORT}/queue`);
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
  
  // Start enhanced raw data capture
  startRawDataCapture();

  // Build Lunr index after initial data is loaded
  buildLunrIndex();
  
  // Start periodic session timeout check (every 5 minutes)
  setInterval(() => {
    checkSessionTimeout();
  }, 5 * 60 * 1000);
  
  console.log('⏰ Session timeout check started (every 5 minutes)');
});