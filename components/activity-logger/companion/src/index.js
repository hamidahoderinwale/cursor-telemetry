#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const http = require('http');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
// Import the new queue system and clipboard monitor
const { queue: queueSystem } = require('./queue.js');
const { clipboardMonitor } = require('./clipboardMonitor.js');

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
  io.emit('realtime-update', {
    type,
    data,
    timestamp: new Date().toISOString()
  });
  console.log(`Broadcasted ${type} update:`, data.id || data.sessionId);
}

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage with numeric sequence cursor
let entries = [];
let events = [];
let sequence = 0;
let queue = []; // { seq, kind: 'entry'|'event', payload }

// Session management
let activeSession = 'session-' + Date.now();

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
}

// File watcher state
let watcher = null;
let fileSnapshots = new Map();

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

console.log(' Configuration:', {
  root_dir: config.root_dir,
  ignore_count: config.ignore.length,
  diff_threshold: config.diff_threshold
});

// Health check
app.get('/health', (req, res) => {
  const queueStats = queueSystem.getStats();
  const clipboardStats = clipboardMonitor.getStats();
  
  res.json({ 
    status: 'running', 
    timestamp: new Date().toISOString(),
    entries: entries.length,
    events: events.length,
    queue_length: queue.length,
    sequence: sequence,
    queue_stats: queueStats,
    clipboard_stats: clipboardStats
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
  
  res.json({
    entries: newEntries,
    events: newEvents,
    cursor: sequence
  });
});

// Get entries with linked prompts
app.get('/entries', async (req, res) => {
  try {
    const allEntries = await db.entries.toArray();
    const allPrompts = await db.prompts.toArray();
    
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
  console.log('� MCP request received:', req.body);
  const { session_id, file_path, prompt, response } = req.body;
  
  const entry = {
    id: crypto.randomUUID(),
    session_id: session_id || activeSession,
    timestamp: new Date().toISOString(),
    source: 'mcp',
    file_path: file_path || '',
    prompt: prompt || '',
    response: response || '',
    notes: 'Logged via MCP'
  };
  
  console.log(' Creating entry:', entry);
  
  // Create matching event
  const event = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    timestamp: entry.timestamp,
    type: 'prompt_response',
    details: JSON.stringify({ file_path: entry.file_path })
  };
  
  // Use enqueue function for reliable queuing
  enqueue('entry', entry);
  enqueue('event', event);
  
  console.log(` MCP entry added: ${entry.id} - ${entry.file_path}`);
  
  res.json({ success: true, entry_id: entry.id });
});

app.post('/mcp/log-code-change', (req, res) => {
  const { session_id, file_path, before_code, after_code } = req.body;
  
  const entry = {
    id: crypto.randomUUID(),
    session_id: session_id || activeSession,
    timestamp: new Date().toISOString(),
    source: 'mcp',
    file_path: file_path || '',
    before_code: before_code || '',
    after_code: after_code || '',
    notes: 'Code change logged via MCP'
  };
  
  entries.push(entry);
  
  // Create matching event
  const event = {
    id: crypto.randomUUID(),
    session_id: entry.session_id,
    timestamp: entry.timestamp,
    type: 'code_change',
    details: JSON.stringify({ file_path: entry.file_path })
  };
  events.push(event);
  
  cursor = new Date().toISOString();
  
  console.log(` MCP code change added: ${entry.id} - ${entry.file_path}`);
  console.log(` Total entries: ${entries.length}, events: ${events.length}`);
  
  res.json({ success: true, entry_id: entry.id });
});

app.post('/mcp/log-event', (req, res) => {
  const { session_id, type, details } = req.body;
  
  const event = {
    id: crypto.randomUUID(),
    session_id: session_id || activeSession,
    timestamp: new Date().toISOString(),
    type: type || 'unknown',
    details: details || {}
  };
  
  events.push(event);
  cursor = new Date().toISOString();
  
  console.log(` MCP event added: ${event.id} - ${event.type}`);
  console.log(` Total events: ${events.length}`);
  
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
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(config.root_dir, filePath);
    const previousContent = fileSnapshots.get(relativePath) || '';
    
    console.log(` File: ${relativePath}, Previous length: ${previousContent.length}, Current length: ${content.length}`);
    
    if (content !== previousContent) {
      const diff = calculateDiff(previousContent, content);
      console.log(` Diff: ${diff.summary}, Significant: ${diff.isSignificant}, Threshold: ${config.diff_threshold}`);
      
      if (diff.isSignificant) {
        // Use the new queue system which will automatically link prompts
        const entry = queueSystem.addEntry({
          session_id: activeSession,
          source: 'filewatcher',
          file_path: relativePath,
          before_code: previousContent,
          after_code: content,
          notes: `File change detected. Diff: ${diff.summary}`,
          tags: ['filewatcher-detected', 'code-change']
        });
        
        // Save entry to database
        try {
          await db.add('entries', entry);
          console.log(`Saved entry to database: ${entry.id}`);
          
          // Broadcast real-time update to connected clients
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
          session_id: activeSession,
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
        
        console.log(`File change detected: ${relativePath}`);
      } else {
        console.log(`Change too small for ${relativePath}: ${diff.summary}`);
      }
      
      fileSnapshots.set(relativePath, content);
    } else {
      console.log(`�No content change for ${relativePath}`);
    }
  } catch (error) {
    console.error(` Error processing file ${filePath}:`, error.message);
  }
}

function startFileWatcher() {
  if (watcher) {
    watcher.close();
  }
  
  console.log(` Starting file watcher for: ${config.root_dir}`);
  console.log(` Ignoring: ${config.ignore.join(', ')}`);
  
  watcher = chokidar.watch(config.root_dir, {
    ignored: config.ignore,
    persistent: true,
    ignoreInitial: false
  });
  
  watcher
    .on('add', processFileChange)
    .on('change', processFileChange)
    .on('unlink', (filePath) => {
      const relativePath = path.relative(config.root_dir, filePath);
      fileSnapshots.delete(relativePath);
      console.log(` File deleted: ${relativePath}`);
    })
    .on('error', error => console.error(` Watcher error: ${error}`))
    .on('ready', () => {
      console.log(' File watcher ready');
    });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
  
  // Send current data to newly connected client
  socket.emit('initial-data', {
    entries: db.entries,
    events: events,
    queue: queue
  });
});

// Start the server
server.listen(PORT, '127.0.0.1', () => {
  console.log(` Companion service running on http://127.0.0.1:${PORT}`);
  console.log(` WebSocket server running on ws://127.0.0.1:${PORT}`);
  console.log(` Watching: ${config.root_dir}`);
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
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n Shutting down companion service...');
  if (watcher) {
    watcher.close();
  }
  clipboardMonitor.stop();
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
  server.close(() => {
    console.log(' Companion service stopped');
    process.exit(0);
  });
});