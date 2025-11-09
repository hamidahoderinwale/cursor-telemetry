// Database setup using Dexie
const db = new Dexie('CursorActivityLogger');

db.version(5).stores({
    sessions: 'id, name, created_at',
    entries: '++id, session_id, timestamp, source, file_path, prompt, response, notes, tags, before_code, after_code, prompt_id',
    events: '++id, session_id, timestamp, type, details',
    attachments: '++id, entry_id, name, mime_type, data',
    prompts: '++id, timestamp, text, status, linked_entry_id'
}).upgrade(tx => {
    // Migration from version 4 to 5
    // Add source field and prompt_id field to existing entries
    return tx.entries.toCollection().modify(entry => {
        if (!entry.source) {
            entry.source = 'clipboard'; // Default for existing entries
        }
        if (!entry.prompt_id) {
            entry.prompt_id = null; // Initialize prompt_id field
        }
    });
});

// Global state
let currentSession = null;
let clipboardWatcherActive = false;
let lastClipboardContent = '';
let searchIndex = null;
let isSearching = false;
let selectedEntryForAttachment = null;
let pendingFiles = [];
let currentFilter = 'all';
let currentSourceFilter = ['filewatcher', 'clipboard', 'mcp', 'dom']; // All sources enabled by default

// Companion integration
let companionIntegration = null;
let companionAvailable = false;

// Health status tracking
let lastPollTime = null;
let lastNewEntries = 0;
let lastNewEvents = 0;

// DOM Watcher state
let domWatcherActive = false;
let domObserver = null;
let lastDetectedPrompt = '';
let lastDetectedResponse = '';
let activeFilePath = '';

// Diff Poller state
let diffPollerActive = false;
let diffPollerInterval = null;
let fileSnapshots = new Map(); // filePath -> { content, timestamp }
let lastActivityTime = Date.now();

// File Detector state
let fileDetectorActive = false;
let fileDetectorInterval = null;

// Idle Timer state
let idleTimerActive = false;
let idleCheckInterval = null;
let isIdle = false;
let idleThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

// DOM elements
const elements = {
    startNewSession: document.getElementById('startNewSession'),
    requestPermission: document.getElementById('requestPermission'),
    exportJSON: document.getElementById('exportJSON'),
    clearDatabase: document.getElementById('clearDatabase'),
    toggleTelemetry: document.getElementById('toggleTelemetry'),
    toggleDOMWatcher: document.getElementById('toggleDOMWatcher'),
    toggleDiffPoller: document.getElementById('toggleDiffPoller'),
    telemetryStatus: document.getElementById('telemetryStatus'),
    activeSession: document.getElementById('activeSession'),
    domStatus: document.getElementById('domStatus'),
    diffStatus: document.getElementById('diffStatus'),
    fileStatus: document.getElementById('fileStatus'),
    idleStatus: document.getElementById('idleStatus'),
    currentSessionInfo: document.getElementById('currentSessionInfo'),
    currentSessionName: document.getElementById('currentSessionName'),
    feedContent: document.getElementById('activityFeed'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    codeChangeLogger: document.getElementById('codeChangeLogger'),
    codeChangeFilePath: document.getElementById('codeChangeFilePath'),
    beforeCode: document.getElementById('beforeCode'),
    afterCode: document.getElementById('afterCode'),
    saveCodeChange: document.getElementById('saveCodeChange'),
    cancelCodeChange: document.getElementById('cancelCodeChange'),
    logCodeChange: document.getElementById('logCodeChange'),
    testClipboard: document.getElementById('testClipboard'),
    debugDatabase: document.getElementById('debugDatabase'),
    cleanupEvents: document.getElementById('cleanupEvents'),
    attachmentUpload: document.getElementById('attachmentUpload'),
    fileInput: document.getElementById('fileInput'),
    attachmentPreview: document.getElementById('attachmentPreview'),
    saveAttachment: document.getElementById('saveAttachment'),
    cancelAttachment: document.getElementById('cancelAttachment'),
    // Source filter elements
    filterFileWatcher: document.getElementById('filterFileWatcher'),
    filterMCP: document.getElementById('filterMCP'),
    filterClipboard: document.getElementById('filterClipboard'),
    filterDOM: document.getElementById('filterDOM')
};

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
}

// Event logging
async function logEvent(type, details = {}) {
    // Filter out internal app actions that shouldn't be logged
    const internalActions = [
        'search_performed',
        'filter_changed',
        'ui_interaction',
        'button_click',
        'form_submit'
    ];
    
    if (internalActions.includes(type)) {
        return;
    }
    
    try {
        const event = {
            session_id: currentSession ? currentSession.id : null,
            timestamp: new Date().toISOString(),
            type: type,
            details: JSON.stringify(details)
        };
        
        const eventId = await db.events.put(event);
        
        // Update search index if it exists
        if (searchIndex) {
            // Add event to search index with basic searchable content
            const searchableEvent = {
                id: `event_${Date.now()}`,
                session_id: event.session_id,
                timestamp: event.timestamp,
                prompt: '', // Events don't have prompts
                response: getEventDescription(type, details),
                notes: '',
                file_path: null,
                tags: ['event']
            };
            try {
                searchIndex.add(searchableEvent);
            } catch (error) {
                if (error.message.includes('duplicate ID')) {
                    try {
                        searchIndex.replace(searchableEvent);
                    } catch (replaceError) {
                        console.warn('Could not add event to search index:', replaceError.message);
                    }
                } else {
                    console.warn('Search index error:', error.message);
                }
            }
        }
    } catch (error) {
        console.error('Error logging event:', error);
        console.error('Event data:', { type, details, sessionId: currentSession?.id });
        // Don't throw - event logging failure shouldn't break the main flow
    }
}

function getEventDescription(type, details) {
    const descriptions = {
        'session_start': `Session started: "${details.name || 'Unnamed Session'}"`,
        'session_end': 'Session ended',
        'entry_created': 'Entry created from clipboard',
        'entry_manual': 'Manual entry created',
        'export_json': `JSON exported: ${details.filename || 'activity-log.json'}`,
        'database_cleared': 'Database cleared',
        'clipboard_enabled': 'Auto-logging enabled',
        'clipboard_disabled': 'Auto-logging disabled',
        'attachment_added': `Attachment added: ${details.filename || 'file'}`,
        'code_change': `Code change detected in ${details.file_path || 'unknown file'}`,
        'file_changed': `Active file changed: ${details.previous_file} → ${details.new_file}`,
        'pause_logging': `Session paused: ${details.reason || 'unknown reason'}`,
        'resume_logging': `Session resumed: ${details.reason || 'activity detected'}`
    };
    
    return descriptions[type] || `Event: ${type}`;
}

function getEventCategory(type) {
    const categories = {
        'session_start': 'Session Management',
        'session_end': 'Session Management',
        'entry_created': 'Content Capture',
        'entry_manual': 'Content Capture',
        'export_json': 'Data Export',
        'database_cleared': 'System Maintenance',
        'clipboard_enabled': 'System Control',
        'clipboard_disabled': 'System Control',
        'attachment_added': 'Content Capture',
        'code_change': 'Content Capture',
        'file_changed': 'File Management',
        'pause_logging': 'Session Management',
        'resume_logging': 'Session Management'
    };
    return categories[type] || 'System Event';
}

function getEventSourceType(source, entry) {
    // Determine if this is a Cursor AI event or general app event based on source
    const cursorSources = ['filewatcher', 'mcp'];
    const appSources = ['clipboard', 'dom'];
    
    // Check source first
    if (cursorSources.includes(source)) {
        return 'cursor';
    }
    
    if (appSources.includes(source)) {
        return 'app';
    }
    
    // Check if entry has AI-related content
    if (entry && typeof entry === 'object') {
        const entryStr = JSON.stringify(entry).toLowerCase();
        if (entryStr.includes('ai') || entryStr.includes('prompt') || 
            entryStr.includes('response') || entryStr.includes('completion') ||
            entryStr.includes('suggestion') || entryStr.includes('cursor')) {
            return 'cursor';
        }
    }
    
    // Default to app event for general development activity
    return 'app';
}

function getSystemComponent(type) {
    const components = {
        'session_start': 'Session Manager',
        'session_end': 'Session Manager',
        'entry_created': 'Clipboard Watcher',
        'entry_manual': 'Manual Entry',
        'export_json': 'Export System',
        'database_cleared': 'Database Manager',
        'clipboard_enabled': 'Clipboard Watcher',
        'clipboard_disabled': 'Clipboard Watcher',
        'attachment_added': 'Attachment System',
        'code_change': 'Diff Poller',
        'file_changed': 'File Detector',
        'pause_logging': 'Idle Timer',
        'resume_logging': 'Idle Timer'
    };
    return components[type] || 'Unknown';
}


// Clipboard watcher functions
async function startClipboardWatcher() {
    
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        console.error('Clipboard API not supported');
        showNotification('Clipboard API not supported in this browser', 'error');
        return false;
    }

    try {
        // Test clipboard access
        await navigator.clipboard.readText();
        
        clipboardWatcherActive = true;
        await logEvent('clipboard_enabled');
        updateClipboardStatus();
        showNotification('Clipboard watcher started - copy content to auto-log', 'success');
        return true;
        
    } catch (error) {
        console.error('Clipboard permission denied:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('Clipboard permission required. Click "Request Permission" button to enable.', 'warning');
        } else {
            showNotification('Clipboard access failed. Please try again or check browser settings.', 'error');
        }
        return false;
    }
}

async function stopClipboardWatcher() {
    clipboardWatcherActive = false;
    await logEvent('clipboard_disabled');
    showNotification('Clipboard watcher stopped', 'success');
    updateClipboardStatus();
}

async function toggleClipboardWatcher() {
    if (clipboardWatcherActive) {
        stopClipboardWatcher();
    } else {
        if (!currentSession) {
            showNotification('Please start a session first', 'error');
            return;
        }
        await startClipboardWatcher();
    }
}

function updateClipboardStatus() {
    // Check if any telemetry system is active
    const anySystemActive = companionAvailable || clipboardWatcherActive || domWatcherActive || diffPollerActive || fileDetectorActive;
    
    if (elements.telemetryStatus) {
        if (companionAvailable) {
            elements.telemetryStatus.textContent = 'Telemetry ON (Companion)';
        } else {
            elements.telemetryStatus.textContent = anySystemActive ? 'Telemetry ON (Browser)' : 'Telemetry OFF';
        }
        elements.telemetryStatus.className = anySystemActive ? 'status-indicator telemetry-on' : 'status-indicator';
    }
    
    if (elements.activeSession && currentSession) {
        elements.activeSession.textContent = `Active Session: ${currentSession.name}`;
    } else if (elements.activeSession) {
        elements.activeSession.textContent = 'No active session';
    }
    
    // Update system status indicators
    updateSystemStatus();
}

function updateSystemStatus() {
    // DOM Watcher status
    if (elements.domStatus) {
        elements.domStatus.textContent = domWatcherActive ? 'DOM: ON' : 'DOM: OFF';
        elements.domStatus.className = domWatcherActive ? 'system-indicator active' : 'system-indicator';
    }
    
    // Diff Poller status
    if (elements.diffStatus) {
        elements.diffStatus.textContent = diffPollerActive ? 'DIFF: ON' : 'DIFF: OFF';
        elements.diffStatus.className = diffPollerActive ? 'system-indicator active' : 'system-indicator';
    }
    
    // File Detector status
    if (elements.fileStatus) {
        elements.fileStatus.textContent = fileDetectorActive ? 'FILE: ON' : 'FILE: OFF';
        elements.fileStatus.className = fileDetectorActive ? 'system-indicator active' : 'system-indicator';
    }
    
    // Idle Timer status
    if (elements.idleStatus) {
        const idleText = isIdle ? 'IDLE: PAUSED' : 'IDLE: ACTIVE';
        elements.idleStatus.textContent = idleTimerActive ? idleText : 'IDLE: OFF';
        elements.idleStatus.className = idleTimerActive ? 
            (isIdle ? 'system-indicator' : 'system-indicator active') : 'system-indicator';
    }
}

// Auto-entry builder
async function handleClipboardCopy(testData = null) {
    
    if (!clipboardWatcherActive) {
        return;
    }
    
    if (!currentSession) {
        return;
    }

    try {
        const clipboardText = testData || await navigator.clipboard.readText();
        
        // Avoid duplicate entries
        if (clipboardText === lastClipboardContent) {
            return;
        }
        lastClipboardContent = clipboardText;
        
        // Update activity time
        updateActivityTime();

        // Parse the copied text
        const parsed = parseCopiedText(clipboardText);
        
        if (!parsed.prompt && !parsed.response) {
            return;
        }

        // Create entry automatically
        const entry = {
            session_id: currentSession.id,
            timestamp: new Date().toISOString(),
            source: 'clipboard',
            file_path: parsed.file_path || null,
            prompt: parsed.prompt || null,
            response: parsed.response || null,
            notes: parsed.notes || 'Auto-logged from clipboard',
            tags: parsed.tags || ['auto-logged'],
            before_code: parsed.before_code || null,
            after_code: parsed.after_code || null
        };

        
        const entryId = await db.entries.put(entry);
        
        // Log event
        await logEvent('entry_created', { entry_id: entryId });
        
        // Update search index
        if (searchIndex) {
            try {
                searchIndex.add(entry);
            } catch (error) {
                if (error.message.includes('duplicate ID')) {
                    try {
                        searchIndex.replace(entry);
                    } catch (replaceError) {
                        console.warn('Could not add entry to search index:', replaceError.message);
                    }
                } else {
                    console.warn('Search index error:', error.message);
                }
            }
        }
        
        await renderFeed();
        await updateStatusDashboard();
        showNotification('Entry auto-logged from clipboard', 'success');
        
        // Add visual indicator to show content was captured
        showCaptureIndicator();
    } catch (error) {
        console.error('Error reading clipboard:', error);
        
        // Show user-friendly error message for common issues
        if (error.name === 'NotAllowedError') {
            showNotification('Clipboard access denied. Please allow clipboard access to enable auto-logging.', 'error');
        } else if (error.name === 'NotFoundError') {
        } else {
        }
    }
}

function parseCopiedText(text) {
    if (!text || text.trim().length === 0) {
        return { prompt: null, response: null, file_path: null, notes: null, tags: null, before_code: null, after_code: null };
    }

    const trimmed = text.trim();
    
    // Try to detect prompt/response patterns
    // Pattern 1: Look for common separators
    const separators = [
        /\n\n---\n\n/,  // Common markdown separator
        /\n\n### Response\n\n/,  // Common AI response marker
        /\n\n## Response\n\n/,   // Another response marker
        /\n\nAnswer:\n\n/,       // Answer marker
        /\n\n---\n/,             // Single line separator
        /\n\n\n/,                // Triple newline
        /\n\n/                   // Double newline (fallback)
    ];

    for (const separator of separators) {
        if (separator.test(trimmed)) {
            const parts = trimmed.split(separator);
            if (parts.length >= 2) {
                const result = {
                    prompt: parts[0].trim(),
                    response: parts.slice(1).join(separator.source).trim(),
                    file_path: extractFilePath(parts[0]),
                    notes: null,
                    tags: ['auto-logged'],
                    before_code: null,
                    after_code: null
                };
                return result;
            }
        }
    }

    // Pattern 2: Look for question/answer patterns
    const questionPatterns = [
        /^(.*\?)\s*\n\n(.*)$/s,  // Ends with question mark
        /^(How to.*?)\s*\n\n(.*)$/s,  // "How to" questions
        /^(What is.*?)\s*\n\n(.*)$/s,  // "What is" questions
        /^(Can you.*?)\s*\n\n(.*)$/s,  // "Can you" questions
    ];

    for (const pattern of questionPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            const result = {
                prompt: match[1].trim(),
                response: match[2].trim(),
                file_path: extractFilePath(match[1]),
                notes: null,
                tags: ['auto-logged', 'question'],
                before_code: null,
                after_code: null
            };
            return result;
        }
    }

    // Pattern 3: Look for code blocks
    const codeBlockPattern = /^(.*?)\s*```[\s\S]*?```\s*(.*)$/s;
    const codeMatch = trimmed.match(codeBlockPattern);
    if (codeMatch) {
        const result = {
            prompt: codeMatch[1].trim(),
            response: codeMatch[0].trim(), // Include the full code block
            file_path: extractFilePath(codeMatch[1]),
            notes: codeMatch[2] ? codeMatch[2].trim() : null,
            tags: ['auto-logged', 'code'],
            before_code: null,
            after_code: null
        };
        return result;
    }

    // Pattern 4: Look for code diffs (before/after patterns)
    const diffPatterns = [
        // Git diff format
        /^(.*?)\s*```diff\s*\n([\s\S]*?)\n```\s*(.*)$/s,
        // Before/After format
        /^(.*?)\s*Before:\s*\n([\s\S]*?)\nAfter:\s*\n([\s\S]*?)\s*(.*)$/s,
        // Old/New format
        /^(.*?)\s*Old:\s*\n([\s\S]*?)\nNew:\s*\n([\s\S]*?)\s*(.*)$/s
    ];

    for (const pattern of diffPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
            if (pattern.source.includes('Before:') || pattern.source.includes('Old:')) {
                const result = {
                    prompt: match[1].trim(),
                    response: match[0].trim(),
                    file_path: extractFilePath(match[1]),
                    before_code: match[2].trim(),
                    after_code: match[3].trim(),
                    notes: match[4] ? match[4].trim() : null,
                    tags: ['auto-logged', 'code-diff']
                };
                return result;
            } else if (pattern.source.includes('diff')) {
                // Parse git diff format
                const diffContent = match[2];
                const lines = diffContent.split('\n');
                const beforeLines = [];
                const afterLines = [];
                
                for (const line of lines) {
                    if (line.startsWith('-')) {
                        beforeLines.push(line.substring(1));
                    } else if (line.startsWith('+')) {
                        afterLines.push(line.substring(1));
                    }
                }
                
                const result = {
                    prompt: match[1].trim(),
                    response: match[0].trim(),
                    file_path: extractFilePath(match[1]),
                    before_code: beforeLines.join('\n'),
                    after_code: afterLines.join('\n'),
                    notes: match[3] ? match[3].trim() : null,
                    tags: ['auto-logged', 'code-diff']
                };
                return result;
            }
        }
    }

    // Pattern 5: Simple heuristic - first paragraph vs rest
    const lines = trimmed.split('\n');
    if (lines.length > 3) {
        const firstParagraph = lines[0].trim();
        const rest = lines.slice(1).join('\n').trim();
        
        if (firstParagraph.length > 10 && rest.length > 10) {
            const result = {
                prompt: firstParagraph,
                response: rest,
                file_path: extractFilePath(firstParagraph),
                notes: null,
                tags: ['auto-logged'],
                before_code: null,
                after_code: null
            };
            return result;
        }
    }

    // Fallback: treat as response if it looks like code or is long
    if (trimmed.length > 50 || /[{}();]/.test(trimmed)) {
        const result = {
            prompt: null,
            response: trimmed,
            file_path: null,
            notes: null,
            tags: ['auto-logged', 'response'],
            before_code: null,
            after_code: null
        };
        return result;
    }

    // Final fallback: treat as prompt
    const result = {
        prompt: trimmed,
        response: null,
        file_path: extractFilePath(trimmed),
        notes: null,
        tags: ['auto-logged', 'prompt'],
        before_code: null,
        after_code: null
    };
    return result;
}

function extractFilePath(text) {
    // Look for file paths in the text
    const pathPatterns = [
        /([a-zA-Z0-9_\-\.\/\\]+\.(js|ts|py|java|cpp|c|h|html|css|json|xml|yaml|yml|md|txt))/g,
        /([a-zA-Z0-9_\-\.\/\\]+\.(js|ts|py|java|cpp|c|h|html|css|json|xml|yaml|yml|md|txt))/,
        /([a-zA-Z0-9_\-\.\/\\]+\.(js|ts|py|java|cpp|c|h|html|css|json|xml|yaml|yml|md|txt))/i
    ];

    for (const pattern of pathPatterns) {
        const match = text.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

// Search functionality
async function initializeSearchIndex() {
    try {
        searchIndex = new MiniSearch({
            fields: ['prompt', 'response', 'notes', 'file_path'],
            storeFields: ['id', 'session_id', 'timestamp', 'file_path', 'prompt', 'response', 'notes', 'tags']
        });

        // Index all existing entries
        const entries = await db.entries.toArray();
        if (entries.length > 0) {
            try {
                searchIndex.addAll(entries);
            } catch (error) {
                console.warn('Could not add all entries to search index:', error.message);
                // Try adding them one by one to handle duplicates
                for (const entry of entries) {
                    try {
                        searchIndex.add(entry);
                    } catch (addError) {
                        if (addError.message.includes('duplicate ID')) {
                            try {
                                searchIndex.replace(entry);
                            } catch (replaceError) {
                                console.warn('Could not add entry to search index:', replaceError.message);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error initializing search index:', error);
    }
}

async function performSearch(query) {
    if (!searchIndex || !query.trim()) {
        isSearching = false;
        await renderFeed();
        return;
    }

    isSearching = true;
    try {
        const results = searchIndex.search(query);
        // Don't log search events - they're internal app actions
        await renderSearchResults(results);
    } catch (error) {
        console.error('Error performing search:', error);
        isSearching = false;
        await renderFeed();
    }
}

async function renderSearchResults(results) {
    if (results.length === 0) {
        elements.searchResults.innerHTML = '<p class="empty-state">No results found</p>';
        elements.feedContent.innerHTML = '<p class="empty-state">Search results above</p>';
        return;
    }

    // Group results by session
    const sessions = await db.sessions.toArray();
    const sessionMap = new Map(sessions.map(s => [s.id, s]));
    
    const groupedResults = {};
    for (const result of results) {
        const sessionId = result.session_id;
        if (!groupedResults[sessionId]) {
            groupedResults[sessionId] = {
                session: sessionMap.get(sessionId),
                entries: []
            };
        }
        groupedResults[sessionId].entries.push(result);
    }

    let html = '';
    for (const [sessionId, group] of Object.entries(groupedResults)) {
        if (!group.session) continue;
        
        html += `
            <div class="session">
                <div class="session-header">
                    <div class="session-name">${group.session.name}</div>
                    <div class="session-date">${formatTimestamp(group.session.created_at)}</div>
                </div>
                <div class="entries">
                    ${group.entries.map(entry => renderEntry(entry)).join('')}
                </div>
            </div>
        `;
    }

    elements.searchResults.innerHTML = html;
    elements.feedContent.innerHTML = '<p class="empty-state">Search results above</p>';
}

async function clearSearch() {
    elements.searchInput.value = '';
    isSearching = false;
    elements.searchResults.innerHTML = '';
    await renderFeed();
}

function updateSourceFilters() {
    const enabledSources = [];
    if (elements.filterFileWatcher && elements.filterFileWatcher.checked) enabledSources.push('filewatcher');
    if (elements.filterMCP && elements.filterMCP.checked) enabledSources.push('mcp');
    if (elements.filterClipboard && elements.filterClipboard.checked) enabledSources.push('clipboard');
    if (elements.filterDOM && elements.filterDOM.checked) enabledSources.push('dom');
    
    currentSourceFilter = enabledSources;
    renderFeed();
}

// Attachment functionality
function showAttachmentUpload(entryId) {
    selectedEntryForAttachment = entryId;
    elements.attachmentUpload.style.display = 'block';
    elements.fileInput.value = '';
    elements.attachmentPreview.innerHTML = '';
    pendingFiles = [];
}

function hideAttachmentUpload() {
    selectedEntryForAttachment = null;
    elements.attachmentUpload.style.display = 'none';
    elements.fileInput.value = '';
    elements.attachmentPreview.innerHTML = '';
    pendingFiles = [];
}

async function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    pendingFiles = files;
    
    let previewHtml = '';
    for (const file of files) {
        previewHtml += `
            <div class="file-preview">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
            </div>
        `;
    }
    
    elements.attachmentPreview.innerHTML = previewHtml;
}

async function saveAttachments() {
    if (!selectedEntryForAttachment || pendingFiles.length === 0) {
        showNotification('No files selected', 'error');
        return;
    }

    try {
        for (const file of pendingFiles) {
            const data = await fileToBase64(file);
            const attachment = {
                entry_id: selectedEntryForAttachment,
                name: file.name,
                mime_type: file.type,
                data: data
            };
            
            await db.attachments.add(attachment);
        }
        
        await logEvent('attachment_added', { filename: pendingFiles[0].name, count: pendingFiles.length });
        showNotification(`${pendingFiles.length} attachment(s) saved successfully`);
        hideAttachmentUpload();
        await renderFeed();
    } catch (error) {
        console.error('Error saving attachments:', error);
        showNotification('Error saving attachments', 'error');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function loadAttachments(entryId) {
    try {
        const attachments = await db.attachments.where('entry_id').equals(entryId).toArray();
        return attachments;
    } catch (error) {
        console.error('Error loading attachments:', error);
        return [];
    }
}

function renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    
    return `
        <div class="attachments">
            <h4>Attachments:</h4>
            ${attachments.map(att => `
                <div class="attachment">
                    <span class="attachment-name">${att.name}</span>
                    <button class="btn btn-small" onclick="downloadAttachment(${att.id})">Download</button>
                </div>
            `).join('')}
        </div>
    `;
}

async function downloadAttachment(attachmentId) {
    try {
        const attachment = await db.attachments.get(attachmentId);
        if (!attachment) return;
        
        const link = document.createElement('a');
        link.href = attachment.data;
        link.download = attachment.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Error downloading attachment:', error);
        showNotification('Error downloading attachment', 'error');
    }
}

// Session management
function generateSessionName() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
    return `${dateStr} ${timeStr}`;
}

async function createNewSession(sessionName = null) {
    const name = sessionName || generateSessionName();
    
    const session = {
        id: generateId(),
        name: name,
        created_at: new Date().toISOString()
    };

    try {
        await db.sessions.add(session);
        currentSession = session;
        
        
        updateCurrentSessionDisplay();
        
        // Log session start event
        await logEvent('session_start', { name: session.name });
        
        // Don't call renderFeed here - let init() handle it
        return session;
    } catch (error) {
        console.error('Error creating session:', error);
        showNotification('Error creating session', 'error');
        return null;
    }
}

async function createSessionManually() {
    const sessionName = prompt('Enter session name:', `Session ${new Date().toLocaleDateString()}`);
    if (!sessionName) return;

    const session = await createNewSession(sessionName);
    if (session) {
        showNotification('Custom session created successfully. Auto-logging is already enabled - start copying content!');
    }
}

async function ensureActiveSession() {
    // Check if there's already an active session
    if (currentSession) {
        return currentSession;
    }
    
    // Check if there are any existing sessions
    const sessions = await db.sessions.orderBy('created_at').reverse().toArray();
    
    if (sessions.length > 0) {
        // Use the most recent session
        currentSession = sessions[0];
        updateCurrentSessionDisplay();
        // Don't call renderFeed here - let init() handle it
        return currentSession;
    }
    
    // Create a new session automatically
    const session = await createNewSession();
    if (session) {
        // Don't show notification here - it will be shown in init() after clipboard is enabled
    }
    
    return session;
}

function updateCurrentSessionDisplay() {
    if (currentSession) {
        if (elements.currentSessionName) {
            elements.currentSessionName.textContent = `${currentSession.name} (${formatTimestamp(currentSession.created_at)})`;
        }
        if (elements.currentSessionInfo) {
            elements.currentSessionInfo.style.display = 'block';
        }
    } else {
        if (elements.currentSessionInfo) {
            elements.currentSessionInfo.style.display = 'none';
        }
    }
}


// Feed rendering
async function renderFeed() {
    try {
        // Don't render feed if we're showing search results
        if (isSearching) {
            return;
        }
        
        // Get all data for comprehensive dashboard
        const sessions = await db.sessions.orderBy('created_at').reverse().toArray();
        const allEntries = await db.entries.orderBy('timestamp').reverse().toArray();
        const allEvents = await db.events.orderBy('timestamp').reverse().toArray();
        
        // Check filewatcher entries specifically
        const filewatcherEntries = allEntries.filter(e => e.source === 'filewatcher');
        
        if (sessions.length === 0) {
            elements.feedContent.innerHTML = `
                <div class="dashboard-empty">
                    <h2> Cursor Telemetry Dashboard</h2>
                    <p>No activity yet. Copy content from Cursor to begin capturing your interactions automatically.</p>
                    <div class="empty-actions">
                        <button class="btn btn-primary" onclick="startNewSession()">Start New Session</button>
                        <button class="btn btn-secondary" onclick="requestClipboardPermission()">Enable Clipboard Capture</button>
                    </div>
                </div>
            `;
            return;
        }

        // Start with empty content - header is already in HTML
        let html = '';

        // Create activity timeline with all items
        const allItems = [
            ...allEntries.map(entry => ({ ...entry, itemType: 'entry' })),
            ...allEvents.map(event => ({ ...event, itemType: 'event' }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Apply filters
        let filteredItems = allItems;
        
        if (currentFilter !== 'all') {
            filteredItems = filteredItems.filter(item => {
                if (item.itemType === 'entry') {
                    // Determine event category for this entry
                    const eventCategory = getEventSourceType(item.source, item);
                    
                    switch (currentFilter) {
                        case 'cursor': return eventCategory === 'cursor';
                        case 'app': return eventCategory === 'app';
                        case 'prompts': return item.prompt && item.prompt.trim();
                        case 'responses': return item.response && item.response.trim();
                        case 'codeChanges': return item.before_code && item.after_code;
                        case 'filewatcher': return item.source === 'filewatcher';
                        case 'clipboard': return item.source === 'clipboard';
                        case 'dom': return item.source === 'dom';
                        case 'mcp': return item.source === 'mcp';
                        default: return true;
                    }
                } else if (item.itemType === 'event') {
                    return currentFilter === 'events';
                }
                return true;
            });
        }

        // Apply source filter
        if (currentSourceFilter && currentSourceFilter.length > 0) {
            filteredItems = filteredItems.filter(item => {
                if (item.itemType === 'entry') {
                    return currentSourceFilter.includes(item.source);
                }
                return true; // Events don't have source filter
            });
        }

        // Render all items in chronological order
        if (filteredItems.length > 0) {
            filteredItems.forEach((item, index) => {
                try {
                    html += item.itemType === 'entry' ? renderActivityItem(item) : renderEventItem(item);
                } catch (error) {
                    console.error('Error rendering item:', error, item);
                    html += '<div class="error">Error rendering item</div>';
                }
            });
        } else {
            html += '<div class="empty-state">No activity found</div>';
        }

        // No need to close container divs since we're not creating them

        elements.feedContent.innerHTML = html;
        
        // Update status dashboard after rendering
        await updateStatusDashboard();
    } catch (error) {
        console.error('Error rendering feed:', error);
        elements.feedContent.innerHTML = '<p class="empty-state">Error loading sessions</p>';
    }
}

async function renderEntry(entry) {
    const tagsHtml = entry.tags && entry.tags.length > 0 
        ? `<div class="entry-tags">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
        : '';
    
    const sourceIndicator = entry.source ? `<span class="source-indicator source-${entry.source}">${entry.source.toUpperCase()}</span>` : '';

    // Code diff display
    const diffHtml = (entry.before_code && entry.after_code) 
        ? `<div class="code-diff">
            <div class="diff-section">
                <h4>Before:</h4>
                <pre class="code-before">${entry.before_code}</pre>
            </div>
            <div class="diff-section">
                <h4>After:</h4>
                <pre class="code-after">${entry.after_code}</pre>
            </div>
           </div>`
        : '';

    // Load and render attachments
    const attachments = await loadAttachments(entry.id);
    const attachmentsHtml = renderAttachments(attachments);

    return `
        <div class="timeline-item entry-item">
            <div class="timeline-marker entry-marker"></div>
            <div class="timeline-content">
                <div class="entry-header">
                    <span class="entry-timestamp">${formatTimestamp(entry.timestamp)}</span>
                    ${entry.file_path ? `<span class="entry-file">${entry.file_path}</span>` : ''}
                    ${sourceIndicator}
                    <div class="entry-actions">
                        <button class="btn btn-small" onclick="showAttachmentUpload(${entry.id})">Add File</button>
                    </div>
                </div>
                <div class="entry-content">
                    ${entry.prompt ? `
                        <div class="content-section">
                            <h4 class="content-label">Prompt:</h4>
                            <div class="content-text prompt-text">${entry.prompt}</div>
                        </div>
                    ` : ''}
                    ${entry.response ? `
                        <div class="content-section">
                            <h4 class="content-label">Response:</h4>
                            <div class="content-text response-text">${entry.response}</div>
                        </div>
                    ` : ''}
                    ${diffHtml}
                    ${attachmentsHtml}
                    ${entry.notes ? `
                        <div class="content-section">
                            <h4 class="content-label">Notes:</h4>
                            <div class="content-text notes-text">${entry.notes}</div>
                        </div>
                    ` : ''}
                    ${tagsHtml}
                </div>
            </div>
        </div>
    `;
}

function renderEvent(event) {
    const details = JSON.parse(event.details || '{}');
    const description = getEventDescription(event.type, details);
    
    const eventIcons = {
        'session_start': '🕒',
        'session_end': '',
        'entry_created': '',
        'entry_manual': '',
        'export_json': '',
        'database_cleared': '',
        'clipboard_enabled': '',
        'clipboard_disabled': '[ERROR]',
        'attachment_added': '[Attach]',
        'search_performed': ''
    };
    
    const icon = eventIcons[event.type] || '[Event]';
    
    return `
        <div class="timeline-item event-item">
            <div class="timeline-marker event-marker">${icon}</div>
            <div class="timeline-content">
                <div class="event-content">
                    <span class="event-timestamp">${formatTimestamp(event.timestamp)}</span>
                    <span class="event-description">${description}</span>
                </div>
            </div>
        </div>
    `;
}

// Export functionality

async function exportJSON() {
    try {
        const sessions = await db.sessions.toArray();
        const entries = await db.entries.toArray();
        const events = await db.events.toArray();
        const attachments = await db.attachments.toArray();

        // Calculate comprehensive statistics
        const stats = {
            total_sessions: sessions.length,
            total_entries: entries.length,
            total_events: events.length,
            total_attachments: attachments.length,
            entries_by_type: {
                prompt_response: entries.filter(e => !e.tags || !e.tags.includes('code-change')).length,
                code_changes: entries.filter(e => e.tags && e.tags.includes('code-change')).length
            },
            entries_by_capture_method: {
                clipboard: entries.filter(e => !e.tags || (!e.tags.includes('dom-detected') && !e.tags.includes('auto-detected'))).length,
                dom: entries.filter(e => e.tags && e.tags.includes('dom-detected')).length,
                auto: entries.filter(e => e.tags && e.tags.includes('auto-detected')).length
            },
            events_by_category: {
                session: events.filter(e => e.type.includes('session')).length,
                system: events.filter(e => ['clipboard_enabled', 'clipboard_disabled', 'dom_enabled', 'dom_disabled', 
                                         'diff_enabled', 'diff_disabled', 'file_enabled', 'file_disabled',
                                         'idle_enabled', 'idle_disabled', 'pause_logging', 'resume_logging'].includes(e.type)).length,
                user_action: events.filter(e => ['export_json', 'database_cleared', 'entry_created', 'code_change'].includes(e.type)).length
            },
            total_word_count: entries.reduce((sum, e) => sum + (e.prompt ? e.prompt.split(/\s+/).length : 0) + (e.response ? e.response.split(/\s+/).length : 0), 0),
            total_char_count: entries.reduce((sum, e) => sum + (e.prompt ? e.prompt.length : 0) + (e.response ? e.response.length : 0), 0),
            files_with_code_changes: [...new Set(entries.filter(e => e.file_path && e.tags && e.tags.includes('code-change')).map(e => e.file_path))].length,
            export_metadata: {
                exported_at: new Date().toISOString(),
                export_version: '2.0',
                telemetry_system_version: '1.0',
                data_completeness: {
                    has_entries: entries.length > 0,
                    has_events: events.length > 0,
                    has_attachments: attachments.length > 0,
                    has_code_changes: entries.some(e => e.tags && e.tags.includes('code-change')),
                    has_dom_detected: entries.some(e => e.tags && e.tags.includes('dom-detected')),
                    has_auto_detected: entries.some(e => e.tags && e.tags.includes('auto-detected'))
                }
            }
        };

        const data = {
            metadata: stats,
            sessions: sessions,
            entries: entries,
            events: events,
            attachments: attachments,
            exported_at: new Date().toISOString()
        };

        const json = JSON.stringify(data, null, 2);
        const filename = `cursor-activity-log-${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(json, filename, 'application/json');
        
        // Log comprehensive export details
        const exportDetails = {
            filename,
            total_sessions: stats.total_sessions,
            total_entries: stats.total_entries,
            total_events: stats.total_events,
            total_attachments: stats.total_attachments,
            file_size: json.length,
            export_timestamp: new Date().toISOString(),
            metadata_included: true
        };
        
        await logEvent('export_json', exportDetails);
        showNotification(`JSON exported successfully - ${stats.total_entries} entries, ${stats.total_events} events, ${stats.total_attachments} attachments`);
    } catch (error) {
        console.error('Error exporting JSON:', error);
        showNotification('Error exporting JSON', 'error');
    }
}

async function exportMarkdown() {
    try {
        const sessions = await db.sessions.toArray();
        const entries = await db.entries.toArray();
        const events = await db.events.toArray();
        
        let markdown = `# Cursor Telemetry Log\n\n`;
        markdown += `**Export Date:** ${new Date().toLocaleString()}\n`;
        markdown += `**Total Sessions:** ${sessions.length}\n`;
        markdown += `**Total Entries:** ${entries.length}\n`;
        markdown += `**Total Events:** ${events.length}\n\n`;
        
        // Group entries by session
        const entriesBySession = {};
        entries.forEach(entry => {
            const sessionId = entry.session_id || 'global';
            if (!entriesBySession[sessionId]) {
                entriesBySession[sessionId] = [];
            }
            entriesBySession[sessionId].push(entry);
        });
        
        // Export each session
        for (const session of sessions) {
            const sessionEntries = entriesBySession[session.id] || [];
            if (sessionEntries.length === 0) continue;
            
            markdown += `## Session: ${session.name}\n`;
            markdown += `**Created:** ${new Date(session.created_at).toLocaleString()}\n\n`;
            
            // Sort entries by timestamp
            sessionEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            sessionEntries.forEach((entry, index) => {
                markdown += `### Entry ${index + 1}\n`;
                markdown += `**Time:** ${new Date(entry.timestamp).toLocaleString()}\n`;
                markdown += `**Source:** ${entry.source}\n`;
                if (entry.file_path) {
                    markdown += `**File:** ${entry.file_path}\n`;
                }
                if (entry.tags && entry.tags.length > 0) {
                    markdown += `**Tags:** ${entry.tags.join(', ')}\n`;
                }
                markdown += `\n`;
                
                if (entry.prompt) {
                    markdown += `**Prompt:**\n\`\`\`\n${entry.prompt}\n\`\`\`\n\n`;
                }
                
                if (entry.response) {
                    markdown += `**Response:**\n\`\`\`\n${entry.response}\n\`\`\`\n\n`;
                }
                
                if (entry.notes) {
                    markdown += `**Notes:** ${entry.notes}\n\n`;
                }
                
                if (entry.before_code && entry.after_code) {
                    markdown += `**Code Changes:**\n\n`;
                    markdown += `**Before:**\n\`\`\`\n${entry.before_code}\n\`\`\`\n\n`;
                    markdown += `**After:**\n\`\`\`\n${entry.after_code}\n\`\`\`\n\n`;
                }
                
                markdown += `---\n\n`;
            });
        }
        
        const filename = `cursor-activity-log-${new Date().toISOString().split('T')[0]}.md`;
        downloadFile(markdown, filename, 'text/markdown');
        
        await logEvent('export_markdown', { 
            filename,
            total_entries: entries.length,
            total_sessions: sessions.length,
            file_size: markdown.length
        });
        
        showNotification(`Markdown exported successfully - ${entries.length} entries from ${sessions.length} sessions`);
    } catch (error) {
        console.error('Error exporting Markdown:', error);
        showNotification('Error exporting Markdown', 'error');
    }
}


function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Debug function to check database contents
async function debugDatabase() {
    try {
        const sessions = await db.sessions.toArray();
        const entries = await db.entries.toArray();
        const events = await db.events.toArray();
        const attachments = await db.attachments.toArray();
        
        
        return { sessions, entries, events, attachments };
    } catch (error) {
        console.error('Debug database error:', error);
        return null;
    }
}

// Make debug function available globally
window.debugDatabase = debugDatabase;

// Cleanup function to remove internal app events
async function cleanupInternalEvents() {
    try {
        
        // First, let's see what events exist
        const allEvents = await db.events.toArray();
        
        const internalEventTypes = [
            'search_performed',
            'filter_changed',
            'ui_interaction',
            'button_click',
            'form_submit'
        ];
        
        let deletedCount = 0;
        for (const eventType of internalEventTypes) {
            const events = await db.events.where('type').equals(eventType).toArray();
            if (events.length > 0) {
                await db.events.where('type').equals(eventType).delete();
                deletedCount += events.length;
            }
        }
        
        // Verify cleanup
        const remainingEvents = await db.events.toArray();
        
        
        // Re-render the feed
        await renderFeed();
        await updateStatusDashboard();
        
        showNotification(`Cleaned up ${deletedCount} internal events`, 'success');
        
    } catch (error) {
        console.error('Error cleaning up internal events:', error);
        showNotification('Error cleaning up internal events', 'error');
    }
}

// Make cleanup function available globally
window.cleanupInternalEvents = cleanupInternalEvents;

// Test function to manually trigger cleanup
window.testCleanup = async function() {
    await cleanupInternalEvents();
};

// Setup automatic permission request on user interaction
function setupAutoPermissionRequest() {
    
    const requestPermission = async () => {
        try {
            const success = await startClipboardWatcher();
            if (success) {
                showNotification('Clipboard permission granted! Auto-logging enabled.', 'success');
                // Remove the event listeners since permission is now granted
                document.removeEventListener('click', requestPermission);
                document.removeEventListener('keydown', requestPermission);
            }
        } catch (error) {
        }
    };
    
    // Listen for user interactions to trigger permission request
    document.addEventListener('click', requestPermission, { once: true });
    document.addEventListener('keydown', requestPermission, { once: true });
}

// Companion polling
let companionPollingInterval = null;
let lastCompanionCursor = 0; // Start from beginning of sequence
let companionConnected = false;
let totalEntriesReceived = 0;
let totalEventsReceived = 0;

// Update companion status indicators
function updateCompanionStatus(connected, newItemsCount) {
    const companionStatusEl = document.getElementById('companionStatus');
    const lastPollTimeEl = document.getElementById('lastPollTime');
    const newItemsCountEl = document.getElementById('newItemsCount');
    
    if (companionStatusEl) {
        companionStatusEl.textContent = connected ? 'Companion: Connected' : 'Companion: Disconnected';
        companionStatusEl.className = `system-indicator ${connected ? 'connected' : 'disconnected'}`;
    }
    
    if (lastPollTimeEl) {
        const timeAgo = lastPollTime ? Math.round((Date.now() - lastPollTime) / 1000) : 0;
        lastPollTimeEl.textContent = `Last poll: ${timeAgo}s ago`;
    }
    
    if (newItemsCountEl) {
        newItemsCountEl.textContent = `New items: ${newItemsCount || 0}`;
    }
}

function startCompanionPolling() {
    if (companionPollingInterval) {
        clearInterval(companionPollingInterval);
    }
    
    // Reset cursor to 0 to ensure we get all items from the beginning
    lastCompanionCursor = 0;
    companionConnected = false;
    
    // Poll every 2 seconds
    companionPollingInterval = setInterval(async () => {
        try {
            const since = lastCompanionCursor || 0;
            addEventToStream('polling', `Polling companion with since=${since}`);
            
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            let response;
            try {
              const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
              response = await fetch(`${apiBase}/queue?since=${since}`, {
                  signal: controller.signal
              });
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
            } catch (error) {
              clearTimeout(timeoutId);
              if (error.name === 'AbortError') {
                console.warn('[POLL] Queue fetch timed out');
              } else {
                console.warn('[POLL] Failed to fetch queue:', error.message);
              }
              return; // Skip this poll cycle
            }
            
            if (response.ok) {
                const data = await response.json();
                
                // Update connection status
                if (!companionConnected) {
                    companionConnected = true;
                    addEventToStream('companion', 'Companion service connected successfully');
                }
                
                // Update health status
                lastPollTime = Date.now();
                lastNewEntries = data.entries ? data.entries.length : 0;
                lastNewEvents = data.events ? data.events.length : 0;
                
                // Update totals
                totalEntriesReceived += lastNewEntries;
                totalEventsReceived += lastNewEvents;
                
                updateHealthStatus();
                
                // Update companion status indicators
                updateCompanionStatus(true, lastNewEntries + lastNewEvents);
                
                if (data.entries.length > 0 || data.events.length > 0) {
                    addEventToStream('companion', `Received ${data.entries.length} entries and ${data.events.length} events from companion`, {
                        entries: data.entries.length,
                        events: data.events.length,
                        cursor: data.cursor
                    });
                    
                    // Debug: Log the actual data received (only if there's data)
                    if (data.entries.length > 0 || data.events.length > 0) {
                        console.log('=== COMPANION DATA RECEIVED ===');
                        console.log('Entries:', data.entries.length);
                        console.log('Events:', data.events.length);
                    }
                    
                    // Add entries to database
                    for (const entry of data.entries) {
                        try {
                            
                            const entryId = await db.entries.put(entry);
                            addEventToStream('database', `Saved companion entry: ${entry.file_path || 'unknown file'}`, {
                                entryId: entryId,
                                filePath: entry.file_path,
                                source: entry.source
                            });
                            
                            if (searchIndex) {
                                try {
                                    // Try to add to search index, but handle duplicates gracefully
                                    searchIndex.add(entry);
                                } catch (searchError) {
                                    // If it's a duplicate ID error, try to replace instead
                                    if (searchError.message.includes('duplicate ID')) {
                                        try {
                                            searchIndex.replace(entry);
                                        } catch (replaceError) {
                                            // If replace also fails, just skip this entry for search
                                            console.warn('Could not add entry to search index:', replaceError.message);
                                        }
                                    } else {
                                        console.warn('Search index error:', searchError.message);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error('Error adding companion entry:', error);
                            console.error('Entry that failed:', entry);
                        }
                    }
                    
                    // Add events to database
                    for (const event of data.events) {
                        try {
                            
                            const eventId = await db.events.put(event);
                            addEventToStream('database', `Saved companion event: ${event.type}`, {
                                eventId: eventId,
                                type: event.type
                            });
                        } catch (error) {
                            console.error('Error adding companion event:', error);
                            console.error('Event that failed:', event);
                        }
                    }
                    
                    // Update cursor
                    if (data.cursor) {
                        lastCompanionCursor = data.cursor;
                    }
                    
                    // Acknowledge the data
                    const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
                    await fetch(`${apiBase}/ack`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cursor: data.cursor })
                    });
                    
                    addEventToStream('companion', `Acknowledged data up to cursor ${data.cursor}`);
                    
                    // Update UI
                    await renderFeed();
                    await updateStatusDashboard();
                }
            }
        } catch (error) {
            // Handle different types of errors
            if (error.name === 'AbortError') {
                // Timeout error - don't log as it's expected
                return;
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                // Network error - only log if we were previously connected
                if (companionConnected) {
                    console.warn('Companion network error:', error.message);
                    companionConnected = false;
                    addEventToStream('companion', 'Companion service disconnected');
                    updateHealthStatus();
                    updateCompanionStatus(false, 0);
                }
            } else {
                // Other errors - log them
                console.warn('Companion polling error:', error.message);
                addEventToStream('error', `Companion polling error: ${error.message}`);
            }
        }
    }, 2000);
}

// Fallback detection when companion service is not available
async function startFallbackDetection() {
    
    // Don't automatically start clipboard - wait for user interaction
    setupAutoPermissionRequest();
    
    // Start DOM watcher
    startDOMWatcher();
    
    // Start diff poller
    startDiffPoller();
    
    // Start file detector
    startFileDetector();
    
    // Start idle timer
    startIdleTimer();
    
}

// Test function to simulate clipboard content
async function testClipboardCapture() {
    
    // Test data that simulates what would be copied from Cursor
    const testData = `How do I implement a React component with hooks?

Here's a simple React component using hooks:

\`\`\`jsx
import React, { useState, useEffect } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}

export default MyComponent;
\`\`\`

This component demonstrates:
- useState for state management
- useEffect for side effects
- Event handling with onClick`;

    
    // Simulate the clipboard copy event
    try {
        await handleClipboardCopy(testData);
    } catch (error) {
        console.error('Test clipboard capture failed:', error);
    }
}

// Make test function available globally
window.testClipboardCapture = testClipboardCapture;

// Manual clipboard permission request
async function requestClipboardPermission() {
    try {
        // This will trigger the browser's permission dialog
        const text = await navigator.clipboard.readText();
        showNotification('Clipboard permission granted! Auto-logging can now capture content.', 'success');
        return true;
    } catch (error) {
        console.error('Clipboard permission denied:', error);
        showNotification('Clipboard permission denied. Please allow clipboard access to enable auto-logging.', 'error');
        return false;
    }
}

// Permission request function - already defined above

// Make permission request function available globally
window.requestClipboardPermission = requestClipboardPermission;

// DOM Watcher toggle function
function toggleDOMWatcher() {
    if (domWatcherActive) {
        stopDOMWatcher();
    } else {
        if (!currentSession) {
            showNotification('Please start a session first', 'error');
            return;
        }
        startDOMWatcher();
    }
}

// Diff Poller toggle function
function toggleDiffPoller() {
    if (diffPollerActive) {
        stopDiffPoller();
    } else {
        if (!currentSession) {
            showNotification('Please start a session first', 'error');
            return;
        }
        startDiffPoller();
    }
}

// DOM Watcher functions
function startDOMWatcher() {
    
    if (domWatcherActive) {
        return;
    }
    
    // Create MutationObserver to watch for changes in the DOM
    let mutationTimeout;
    domObserver = new MutationObserver((mutations) => {
        // Debounce mutations to avoid excessive checking
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
            checkForNewPromptResponse();
        }, 1000); // Wait 1 second after last mutation
    });
    
    // Start observing the entire document for changes
    domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: false // Disable character data to reduce noise
    });
    
    domWatcherActive = true;
    updateSystemStatus();
    showNotification('DOM watcher enabled - monitoring Cursor interface', 'success');
}

function stopDOMWatcher() {
    
    if (domObserver) {
        domObserver.disconnect();
        domObserver = null;
    }
    
    domWatcherActive = false;
    updateSystemStatus();
    showNotification('DOM watcher disabled', 'info');
}

function checkForNewPromptResponse() {
    if (!domWatcherActive || !currentSession) {
        return;
    }
    
    try {
        // Look for common Cursor chat interface selectors (expanded)
        const chatSelectors = [
            '[data-testid="conversation"]',
            '.conversation',
            '[role="dialog"]',
            '.chat-messages',
            '.message',
            '.prompt',
            '.response',
            '[class*="chat"]',
            '[class*="message"]',
            '[class*="prompt"]',
            '[class*="response"]',
            '[class*="conversation"]',
            '[data-testid*="message"]',
            '[data-testid*="chat"]',
            '.ai-message',
            '.user-message',
            '[role="listitem"]',
            '.text-content',
            // Additional selectors for better detection
            '[data-testid*="conversation"]',
            '[data-testid*="prompt"]',
            '[data-testid*="response"]',
            '.conversation-item',
            '.chat-item',
            '.message-item',
            '[aria-label*="message"]',
            '[aria-label*="conversation"]'
        ];
        
        let foundPrompt = '';
        let foundResponse = '';
        
        // Try to find prompt and response elements
        for (const selector of chatSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent?.trim() || '';
                if (text.length > 10) { // Minimum length to avoid noise
                    // Simple heuristic: if it contains question words, it's likely a prompt
                    if (text.includes('?') || text.includes('how') || text.includes('what') || text.includes('why')) {
                        if (text !== lastDetectedPrompt) {
                            foundPrompt = text;
                        }
                    } else if (text.includes('```') || text.includes('function') || text.includes('const')) {
                        if (text !== lastDetectedResponse) {
                            foundResponse = text;
                        }
                    }
                }
            }
        }
        
        // If we found both a new prompt and response, create an entry
        if (foundPrompt && foundResponse && 
            (foundPrompt !== lastDetectedPrompt || foundResponse !== lastDetectedResponse)) {
            
            
            createEntryFromDOM(foundPrompt, foundResponse);
            
            lastDetectedPrompt = foundPrompt;
            lastDetectedResponse = foundResponse;
            
            // Update activity time
            updateActivityTime();
        }
        
    } catch (error) {
        console.error('Error in DOM watcher:', error);
    }
}

async function createEntryFromDOM(prompt, response) {
    if (!currentSession) {
        return;
    }
    
    try {
        const entry = {
            session_id: currentSession.id,
            timestamp: new Date().toISOString(),
            source: 'dom',
            file_path: activeFilePath || null,
            prompt: prompt,
            response: response,
            notes: 'Auto-detected from DOM',
            tags: ['dom-detected', 'auto-logged'],
            before_code: null,
            after_code: null
        };
        
        
        const entryId = await db.entries.put(entry);
        
        await logEvent('entry_created', { entry_id: entryId, method: 'dom' });
        
        // Update search index
        if (searchIndex) {
            try {
                searchIndex.add(entry);
            } catch (error) {
                if (error.message.includes('duplicate ID')) {
                    try {
                        searchIndex.replace(entry);
                    } catch (replaceError) {
                        console.warn('Could not add entry to search index:', replaceError.message);
                    }
                } else {
                    console.warn('Search index error:', error.message);
                }
            }
        }
        
        // Update UI
        await renderFeed();
        await updateStatusDashboard();
        showNotification('Entry auto-detected from Cursor interface', 'success');
        showCaptureIndicator('prompt');
        
    } catch (error) {
        console.error('Error saving DOM entry:', error);
    }
}

// Diff Poller functions
function startDiffPoller() {
    
    if (diffPollerActive) {
        return;
    }
    
    // Poll every 3 seconds for code changes (more frequent for better detection)
    diffPollerInterval = setInterval(() => {
        // Add debouncing to prevent excessive calls
        if (window.diffPollerTimeout) {
            clearTimeout(window.diffPollerTimeout);
        }
        window.diffPollerTimeout = setTimeout(() => {
            checkForCodeChanges();
        }, 500);
    }, 3000);
    
    diffPollerActive = true;
    updateSystemStatus();
    showNotification('Diff poller enabled - monitoring code changes', 'success');
}

function stopDiffPoller() {
    
    if (diffPollerInterval) {
        clearInterval(diffPollerInterval);
        diffPollerInterval = null;
    }
    
    diffPollerActive = false;
    updateSystemStatus();
    showNotification('Diff poller disabled', 'info');
}

async function checkForCodeChanges() {
    if (!diffPollerActive || !currentSession) {
        return;
    }
    
    try {
        // Get current active file from DOM (if available)
        const currentFile = detectActiveFile();
        if (!currentFile) {
            // Try to detect any file that might be open
            const anyFile = detectAnyOpenFile();
            if (anyFile) {
                try {
                    await createCodeChangeEntry(anyFile, '', getFileContentFromDOM(anyFile) || '');
                } catch (error) {
                }
            }
            return;
        }
        
        // Get current file content from DOM
        const currentContent = getFileContentFromDOM(currentFile);
        if (!currentContent) {
            return;
        }
        
        // Check if we have a previous snapshot
        const previousSnapshot = fileSnapshots.get(currentFile);
        
        if (previousSnapshot) {
            // Compare content
            if (currentContent !== previousSnapshot.content) {
                
                // Only log if change is significant (more than 5 characters)
                if (Math.abs(currentContent.length - previousSnapshot.content.length) > 5) {
                    await createCodeChangeEntry(currentFile, previousSnapshot.content, currentContent);
                }
            }
        }
        
        // Update snapshot
        fileSnapshots.set(currentFile, {
            content: currentContent,
            timestamp: Date.now()
        });
        
        // Update activity time
        lastActivityTime = Date.now();
        updateActivityTime();
        
    } catch (error) {
        console.error('Error in diff poller:', error);
    }
}

function detectActiveFile() {
    // Try to detect the active file from Cursor's DOM
    const fileSelectors = [
        '[data-testid="tab-title"]',
        '.tab-title',
        '.file-tab',
        '.active-file',
        '[aria-selected="true"]'
    ];
    
    for (const selector of fileSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
            const fileName = element.textContent.trim();
            if (fileName && fileName.includes('.')) {
                activeFilePath = fileName;
                return fileName;
            }
        }
    }
    
    return activeFilePath || null;
}

function detectAnyOpenFile() {
    // More aggressive file detection - look for any file indicators
    const selectors = [
        '[data-testid*="tab"]',
        '.tab',
        '[class*="tab"]',
        '[title*="."]',
        '[data-path*="."]',
        '[aria-label*="."]',
        '.file-name',
        '[class*="file"]',
        '[class*="filename"]'
    ];
    
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            const text = element.textContent || element.title || element.getAttribute('data-path') || element.getAttribute('aria-label');
            if (text && text.includes('.') && text.length < 200) {
                const filePath = text.trim();
                if (filePath.match(/\.(js|ts|jsx|tsx|py|java|cpp|c|h|css|html|json|md|txt)$/i)) {
                    return filePath;
                }
            }
        }
    }
    
    return null;
}

function getFileContentFromDOM(filePath) {
    // Try to get file content from Cursor's editor DOM
    const editorSelectors = [
        '.monaco-editor',
        '.editor',
        '[role="textbox"]',
        '.code-editor'
    ];
    
    for (const selector of editorSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            // Try to get text content
            let content = element.textContent || element.innerText || '';
            
            // Clean up the content
            content = content.trim();
            
            if (content.length > 10) {
                return content;
            }
        }
    }
    
    return null;
}

async function createCodeChangeEntry(filePath, beforeCode, afterCode) {
    if (!currentSession) {
        return;
    }
    
    try {
        const entry = {
            session_id: currentSession.id,
            timestamp: new Date().toISOString(),
            source: 'filewatcher',
            file_path: filePath,
            prompt: `Code change in ${filePath}`,
            response: `Updated ${filePath}`,
            notes: 'Auto-detected code change',
            tags: ['code-change', 'auto-detected'],
            before_code: beforeCode,
            after_code: afterCode
        };
        
        
        const entryId = await db.entries.put(entry);
        
        await logEvent('code_change', { 
            entry_id: entryId, 
            file_path: filePath,
            method: 'diff-poller'
        });
        
        // Update search index
        if (searchIndex) {
            try {
                searchIndex.add(entry);
            } catch (error) {
                if (error.message.includes('duplicate ID')) {
                    try {
                        searchIndex.replace(entry);
                    } catch (replaceError) {
                        console.warn('Could not add entry to search index:', replaceError.message);
                    }
                } else {
                    console.warn('Search index error:', error.message);
                }
            }
        }
        
        // Update UI
        await renderFeed();
        await updateStatusDashboard();
        showNotification(`Code change detected in ${filePath}`, 'success');
        showCaptureIndicator('code');
        
    } catch (error) {
        console.error('Error saving code change entry:', error);
    }
}

// File Detector functions
function startFileDetector() {
    
    if (fileDetectorActive) {
        return;
    }
    
    // Check for active file every 2 seconds
    fileDetectorInterval = setInterval(() => {
        detectAndUpdateActiveFile();
    }, 2000);
    
    fileDetectorActive = true;
    updateSystemStatus();
    showNotification('File detector enabled - monitoring active file', 'success');
}

function stopFileDetector() {
    
    if (fileDetectorInterval) {
        clearInterval(fileDetectorInterval);
        fileDetectorInterval = null;
    }
    
    fileDetectorActive = false;
    updateSystemStatus();
    showNotification('File detector disabled', 'info');
}

function detectAndUpdateActiveFile() {
    if (!fileDetectorActive) {
        return;
    }
    
    try {
        const newActiveFile = detectActiveFile();
        
        if (newActiveFile && newActiveFile !== activeFilePath) {
            
            const previousFile = activeFilePath;
            activeFilePath = newActiveFile;
            
            // Log file change event
            if (currentSession) {
                logEvent('file_changed', { 
                    previous_file: previousFile, 
                    new_file: newActiveFile 
                });
            }
            
            showNotification(`Active file: ${newActiveFile}`, 'info');
            showCaptureIndicator('file');
        }
        
    } catch (error) {
        console.error('Error in file detector:', error);
    }
}

// Idle Timer functions
function startIdleTimer() {
    
    if (idleTimerActive) {
        return;
    }
    
    // Check for idle every 30 seconds
    idleCheckInterval = setInterval(() => {
        checkIdleStatus();
    }, 30000);
    
    idleTimerActive = true;
    updateSystemStatus();
    showNotification('Idle timer enabled - monitoring activity', 'success');
}

function stopIdleTimer() {
    
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
    
    idleTimerActive = false;
    updateSystemStatus();
    showNotification('Idle timer disabled', 'info');
}

function checkIdleStatus() {
    if (!idleTimerActive || !currentSession) {
        return;
    }
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    
    if (timeSinceLastActivity > idleThreshold && !isIdle) {
        // User has gone idle
        isIdle = true;
        
        logEvent('pause_logging', { 
            reason: 'idle', 
            idle_duration: timeSinceLastActivity 
        });
        
        updateSystemStatus();
        showNotification('Session paused due to inactivity', 'warning');
        
    } else if (timeSinceLastActivity <= idleThreshold && isIdle) {
        // User has become active again
        isIdle = false;
        
        logEvent('resume_logging', { 
            reason: 'activity_detected' 
        });
        
        updateSystemStatus();
        showNotification('Session resumed - activity detected', 'success');
    }
}

function updateActivityTime() {
    lastActivityTime = Date.now();
    
    // If we were idle and now have activity, mark as active
    if (isIdle) {
        isIdle = false;
        logEvent('resume_logging', { reason: 'activity_detected' });
    }
}

// Filter functions
function setFilter(filter) {
    currentFilter = filter;
    
    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find the button that matches the filter and activate it
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        if (btn.textContent.toLowerCase().includes(filter.toLowerCase()) || 
            (filter === 'all' && btn.textContent.toLowerCase().includes('all'))) {
            btn.classList.add('active');
        }
    });
    
    // Re-render feed with filter
    renderFeed();
    
    // Don't log filter changes - they're internal app actions
}

function setSourceFilter(source) {
    currentSourceFilter = source;
    
    // Update source filter button states
    document.querySelectorAll('.source-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (source !== 'all') {
        document.getElementById(`filter${source.charAt(0).toUpperCase() + source.slice(1)}`).classList.add('active');
    }
    
    // Re-render feed with source filter
    renderFeed();
}

// Code change logging functions
function showCodeChangeLogger() {
    elements.codeChangeLogger.style.display = 'block';
    elements.codeChangeFilePath.focus();
}

function hideCodeChangeLogger() {
    elements.codeChangeLogger.style.display = 'none';
    elements.codeChangeFilePath.value = '';
    elements.beforeCode.value = '';
    elements.afterCode.value = '';
}

async function saveCodeChange() {
    const filePath = elements.codeChangeFilePath.value.trim();
    const beforeCode = elements.beforeCode.value.trim();
    const afterCode = elements.afterCode.value.trim();
    
    if (!filePath || !beforeCode || !afterCode) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (!currentSession) {
        showNotification('No active session', 'error');
        return;
    }
    
    try {
        // Create a new entry for the code change
        const entry = {
            session_id: currentSession.id,
            timestamp: new Date().toISOString(),
            source: 'manual',
            file_path: filePath,
            prompt: `Code change in ${filePath}`,
            response: `Updated ${filePath}`,
            notes: 'Manual code change log',
            tags: ['code-change', 'manual'],
            before_code: beforeCode,
            after_code: afterCode
        };
        
        await db.entries.put(entry);
        await logEvent('code_change', { entry_id: entry.id, file_path: filePath });
        
        // Update search index
        if (searchIndex) {
            try {
                searchIndex.add(entry);
            } catch (error) {
                if (error.message.includes('duplicate ID')) {
                    try {
                        searchIndex.replace(entry);
                    } catch (replaceError) {
                        console.warn('Could not add entry to search index:', replaceError.message);
                    }
                } else {
                    console.warn('Search index error:', error.message);
                }
            }
        }
        
        await renderFeed();
        await updateStatusDashboard();
        showNotification('Code change logged successfully', 'success');
        hideCodeChangeLogger();
        
    } catch (error) {
        console.error('Error saving code change:', error);
        showNotification('Error saving code change', 'error');
    }
}

// Update status dashboard
async function updateStatusDashboard() {
    try {
        const entries = await db.entries.toArray();
        const events = await db.events.toArray();
        const sessions = await db.sessions.toArray();
        
        // Filter out internal events for display
        const internalEventTypes = ['search_performed', 'filter_changed', 'ui_interaction', 'button_click', 'form_submit'];
        const filteredEvents = events.filter(event => !internalEventTypes.includes(event.type));
        
        // Calculate code changes
        const codeChanges = entries.filter(e => e.before_code && e.after_code).length;
        
        // Update total counts
        const totalSessionsElement = document.getElementById('totalSessions');
        const totalEntriesElement = document.getElementById('totalEntries');
        const totalEventsElement = document.getElementById('totalEvents');
        const totalCodeChangesElement = document.getElementById('totalCodeChanges');
        const lastCaptureElement = document.getElementById('lastCapture');
        
        if (totalSessionsElement) {
            totalSessionsElement.textContent = sessions.length;
        }
        
        if (totalEntriesElement) {
            totalEntriesElement.textContent = entries.length;
        }
        
        if (totalEventsElement) {
            totalEventsElement.textContent = filteredEvents.length;
        }
        
        if (totalCodeChangesElement) {
            totalCodeChangesElement.textContent = codeChanges;
        }
        
        // Update connection status
        updateConnectionStatus();
        
        if (lastCaptureElement) {
            if (entries.length > 0) {
                const lastEntry = entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                const lastCaptureTime = new Date(lastEntry.timestamp);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastCaptureTime) / (1000 * 60));
                
                if (diffMinutes < 1) {
                    lastCaptureElement.textContent = 'Just now';
                } else if (diffMinutes < 60) {
                    lastCaptureElement.textContent = `${diffMinutes}m ago`;
                } else {
                    const diffHours = Math.floor(diffMinutes / 60);
                    lastCaptureElement.textContent = `${diffHours}h ago`;
                }
            } else {
                lastCaptureElement.textContent = 'Never';
            }
        }
        
        // Update companion status
        const companionStatusMain = document.getElementById('companionStatusMain');
        if (companionStatusMain) {
            if (companionAvailable) {
                companionStatusMain.textContent = 'Connected';
                companionStatusMain.className = 'status-value';
            } else {
                companionStatusMain.textContent = 'Disconnected';
                companionStatusMain.className = 'status-value';
            }
        }
        
        // Update file changes count
        const fileChangesCount = document.getElementById('fileChangesCount');
        if (fileChangesCount) {
            const fileChangeEntries = entries.filter(entry => entry.source === 'filewatcher');
            fileChangesCount.textContent = fileChangeEntries.length;
        }
        
        // Update activity insights
        await updateActivityInsights(entries, events);
        
    } catch (error) {
        console.error('Error updating status dashboard:', error);
    }
}

async function updateActivityInsights(entries, events) {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Filter entries from today
        const todayEntries = entries.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            return entryDate >= today;
        });
        
        // Count prompts today
        const promptsToday = todayEntries.filter(entry => entry.prompt && entry.prompt.trim().length > 0).length;
        const promptsTodayElement = document.getElementById('promptsToday');
        if (promptsTodayElement) {
            promptsTodayElement.textContent = promptsToday;
        }
        
        // Count responses today
        const responsesToday = todayEntries.filter(entry => entry.response && entry.response.trim().length > 0).length;
        const responsesTodayElement = document.getElementById('responsesToday');
        if (responsesTodayElement) {
            responsesTodayElement.textContent = responsesToday;
        }
        
        // Count code changes today
        const codeChangesToday = todayEntries.filter(entry => 
            entry.tags && entry.tags.includes('code-change')
        ).length;
        const codeChangesTodayElement = document.getElementById('codeChangesToday');
        if (codeChangesTodayElement) {
            codeChangesTodayElement.textContent = codeChangesToday;
        }
        
        // Count unique active files
        const activeFiles = [...new Set(entries
            .filter(entry => entry.file_path && entry.file_path.trim().length > 0)
            .map(entry => entry.file_path)
        )];
        const activeFilesCountElement = document.getElementById('activeFilesCount');
        if (activeFilesCountElement) {
            activeFilesCountElement.textContent = activeFiles.length;
        }
        
    } catch (error) {
        console.error('Error updating activity insights:', error);
    }
}

// Visual indicator for content capture
function showCaptureIndicator(type = 'content') {
    const indicator = document.createElement('div');
    
    const messages = {
        'content': 'Content Captured',
        'code': 'Code Change Detected',
        'file': 'File Change Detected',
        'prompt': 'Prompt/Response Captured'
    };
    
    indicator.innerHTML = messages[type] || 'Content Captured';
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333333;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1001;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease-out;
    `;
    
    // Add animation keyframes
    if (!document.getElementById('captureIndicatorStyles')) {
        const style = document.createElement('style');
        style.id = 'captureIndicatorStyles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(indicator);
    
    // Remove after 2 seconds
    setTimeout(() => {
        indicator.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 300);
    }, 2000);
}

// Database management
async function clearDatabase() {
    if (!confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        return;
    }

    try {
        await db.sessions.clear();
        await db.entries.clear();
        await db.attachments.clear();
        await db.events.clear();
        
        // Log the clear event before clearing
        await logEvent('database_cleared');
        
        currentSession = null;
        updateCurrentSessionDisplay();
        await renderFeed();
        showNotification('Database cleared successfully');
    } catch (error) {
        console.error('Error clearing database:', error);
        showNotification('Error clearing database', 'error');
    }
}

// Notification system
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        background: ${type === 'error' ? '#666666' : '#000'};
        color: #fff;
        border-radius: 4px;
        font-size: 14px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Event listeners - only add if elements exist
if (elements.startNewSession) elements.startNewSession.addEventListener('click', createSessionManually);
if (elements.requestPermission) elements.requestPermission.addEventListener('click', requestClipboardPermission);
if (elements.exportJSON) elements.exportJSON.addEventListener('click', exportJSON);
if (elements.clearDatabase) elements.clearDatabase.addEventListener('click', clearDatabase);
if (elements.toggleTelemetry) elements.toggleTelemetry.addEventListener('click', toggleClipboardWatcher);
if (elements.toggleDOMWatcher) elements.toggleDOMWatcher.addEventListener('click', toggleDOMWatcher);
if (elements.toggleDiffPoller) elements.toggleDiffPoller.addEventListener('click', toggleDiffPoller);
if (elements.searchInput) elements.searchInput.addEventListener('input', (e) => performSearch(e.target.value));
// Filter functionality is now handled by checkboxes in the new design

// Source filter checkboxes
if (elements.filterFileWatcher) elements.filterFileWatcher.addEventListener('change', (e) => updateSourceFilters());
if (elements.filterMCP) elements.filterMCP.addEventListener('change', (e) => updateSourceFilters());
if (elements.filterClipboard) elements.filterClipboard.addEventListener('change', (e) => updateSourceFilters());
if (elements.filterDOM) elements.filterDOM.addEventListener('change', (e) => updateSourceFilters());

// Code change logger
if (elements.logCodeChange) elements.logCodeChange.addEventListener('click', showCodeChangeLogger);
if (elements.saveCodeChange) elements.saveCodeChange.addEventListener('click', saveCodeChange);
if (elements.cancelCodeChange) elements.cancelCodeChange.addEventListener('click', hideCodeChangeLogger);

// Debug tools
if (elements.testClipboard) elements.testClipboard.addEventListener('click', testClipboardCapture);
if (elements.debugDatabase) elements.debugDatabase.addEventListener('click', debugDatabase);
if (elements.cleanupEvents) elements.cleanupEvents.addEventListener('click', cleanupInternalEvents);

// Companion debug tools - moved to init function

// Event stream controls - removed (elements don't exist in current HTML)

// Attachments
if (elements.fileInput) elements.fileInput.addEventListener('change', handleFileSelection);
if (elements.saveAttachment) elements.saveAttachment.addEventListener('click', saveAttachments);
if (elements.cancelAttachment) elements.cancelAttachment.addEventListener('click', hideAttachmentUpload);

// Clipboard event listener
document.addEventListener('copy', handleClipboardCopy);

// Initialize app
async function init() {
    try {
        // Ensure there's an active session (auto-create if needed)
        await ensureActiveSession();
        
        // Initialize clipboard status
        updateClipboardStatus();
        
        // Initialize search index
        await initializeSearchIndex();
        
        // Clean up any existing internal events
        await cleanupInternalEvents();
        
        // Try to connect to companion service first
        // Initialize event stream
        addEventToStream('info', 'Initializing Cursor Telemetry Logger');
        
        addEventToStream('info', 'Attempting to connect to companion service...');
        
        // Try to connect to companion service
        try {
            const response = await fetch('http://127.0.0.1:43918/health');
            if (response.ok) {
                companionAvailable = true;
                showNotification('Companion service connected - using file watcher + MCP integration', 'success');
                addEventToStream('info', 'Companion service connected - using file watcher + MCP integration');
                
                // Start polling companion service
                startCompanionPolling();
                
                // Don't automatically start clipboard - wait for user interaction
                addEventToStream('warning', 'Clipboard permission requires user interaction');
                setupAutoPermissionRequest();
            } else {
                throw new Error('Companion service not responding');
            }
        } catch (error) {
            showNotification('Companion service not available - using browser detection', 'warning');
            addEventToStream('warning', 'Companion service not available - falling back to browser detection');
            await startFallbackDetection();
        }
        
        // Ensure we have data to display
        const testSessions = await db.sessions.toArray();
        if (testSessions.length === 0) {
            await createNewSession();
        }
        
        await renderFeed();
        updateHealthStatus();
        
        // Update companion debug info if available
        updateCompanionDebugInfo();
        
        // Set up companion debug event listeners
        const toggleCompanionDebugEl = document.getElementById('toggleCompanionDebug');
        const refreshCompanionDataEl = document.getElementById('refreshCompanionData');
        const testCompanionConnectionEl = document.getElementById('testCompanionConnection');

        if (toggleCompanionDebugEl) toggleCompanionDebugEl.addEventListener('click', toggleCompanionDebug);
        if (refreshCompanionDataEl) refreshCompanionDataEl.addEventListener('click', refreshCompanionData);
        if (testCompanionConnectionEl) testCompanionConnectionEl.addEventListener('click', testCompanionConnection);
        
        if (clipboardWatcherActive) {
            showNotification('Full telemetry system ready - All automation enabled!', 'success');
        } else {
            showNotification('Telemetry system ready - Click "Request Permission" for full clipboard support.', 'warning');
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        console.error('Error stack:', error.stack);
        showNotification('Error initializing app: ' + error.message, 'error');
        
        // Try to render feed anyway in case of partial initialization
        try {
            await renderFeed();
        } catch (renderError) {
            console.error('Error rendering feed after init error:', renderError);
        }
    }
}

// Health status functions
function updateHealthStatus() {
    const healthBar = document.getElementById('healthStatusBar');
    const companionStatus = document.getElementById('companionStatus');
    const lastPollTimeEl = document.getElementById('lastPollTime');
    const newItemsCount = document.getElementById('newItemsCount');
    const dbTotals = document.getElementById('dbTotals');
    
    if (!healthBar) return;
    
    // Show health bar if companion is available
    if (companionAvailable) {
        healthBar.style.display = 'flex';
        
        // Update companion status
        if (companionStatus) {
            if (companionConnected) {
                companionStatus.textContent = 'Connected';
                companionStatus.className = 'health-value connected';
            } else {
                companionStatus.textContent = 'Disconnected';
                companionStatus.className = 'health-value disconnected';
            }
        }
        
        // Update last poll time
        if (lastPollTimeEl) {
            if (lastPollTime) {
                const timeAgo = Math.round((Date.now() - lastPollTime) / 1000);
                lastPollTimeEl.textContent = `${timeAgo}s ago`;
                lastPollTimeEl.className = timeAgo < 10 ? 'health-value connected' : 'health-value warning';
            } else {
                lastPollTimeEl.textContent = 'Never';
                lastPollTimeEl.className = 'health-value disconnected';
            }
        }
        
        // Update new items count
        if (newItemsCount) {
            newItemsCount.textContent = `New: ${lastNewEntries}E/${lastNewEvents}Ev | Total: ${totalEntriesReceived}E/${totalEventsReceived}Ev`;
            newItemsCount.className = (lastNewEntries > 0 || lastNewEvents > 0) ? 'health-value connected' : 'health-value';
        }
        
        // Update DB totals
        updateDBTotals();
        
        // Update companion debug info
        updateCompanionDebugInfo();
    } else {
        healthBar.style.display = 'none';
    }
}

async function updateDBTotals() {
    const dbTotals = document.getElementById('dbTotals');
    if (!dbTotals) return;
    
    try {
        const entryCount = await db.entries.count();
        const eventCount = await db.events.count();
        dbTotals.textContent = `${entryCount} entries, ${eventCount} events`;
        dbTotals.className = 'health-value';
    } catch (error) {
        console.error('Error updating DB totals:', error);
        dbTotals.textContent = 'Error';
        dbTotals.className = 'health-value disconnected';
    }
}

// Event Stream functionality
let eventStream = [];
let streamPaused = false;
let streamCount = 0;

function addEventToStream(type, message, details = null, timestamp = null) {
    if (streamPaused) return;
    
    const event = {
        id: Date.now() + Math.random(),
        type: type,
        message: message,
        details: details,
        timestamp: timestamp || new Date().toISOString()
    };
    
    eventStream.unshift(event); // Add to beginning for newest first
    streamCount++;
    
    // Keep only last 100 events to prevent memory issues
    if (eventStream.length > 100) {
        eventStream = eventStream.slice(0, 100);
    }
    
    renderEventStream();
    updateStreamStats();
}

function renderEventStream() {
    const container = document.getElementById('eventStream');
    if (!container) return;
    
    if (eventStream.length === 0) {
        container.innerHTML = '<p class="empty-state">Event stream will appear here...</p>';
        return;
    }
    
    const html = eventStream.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const detailsHtml = event.details ? 
            `<div class="event-details">${JSON.stringify(event.details, null, 2)}</div>` : '';
        
        return `
            <div class="event-item">
                <div class="event-timestamp">${time}</div>
                <div class="event-content">
                    <div class="event-message">
                        <span class="event-type ${event.type}">${event.type}</span>
                        ${event.message}
                    </div>
                    ${detailsHtml}
                </div>
                <div class="event-actions">
                    <button class="btn btn-small" onclick="copyEventDetails('${event.id}')">Copy</button>
                    <button class="btn btn-small" onclick="removeEvent('${event.id}')">Remove</button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function updateStreamStats() {
    const countEl = document.getElementById('streamCount');
    const statusEl = document.getElementById('streamStatus');
    
    if (countEl) {
        countEl.textContent = `${streamCount} events`;
    }
    
    if (statusEl) {
        statusEl.textContent = streamPaused ? 'Paused' : 'Running';
        statusEl.className = `stream-status ${streamPaused ? 'paused' : 'running'}`;
    }
}

function clearEventStream() {
    eventStream = [];
    streamCount = 0;
    renderEventStream();
    updateStreamStats();
    addEventToStream('info', 'Event stream cleared');
}

function toggleStreamPause() {
    streamPaused = !streamPaused;
    updateStreamStats();
    addEventToStream('info', streamPaused ? 'Event stream paused' : 'Event stream resumed');
}

function copyEventDetails(eventId) {
    const event = eventStream.find(e => e.id == eventId);
    if (event) {
        const text = `${event.timestamp} [${event.type}] ${event.message}\n${event.details ? JSON.stringify(event.details, null, 2) : ''}`;
        navigator.clipboard.writeText(text);
        addEventToStream('info', `Copied event details to clipboard`);
    }
}

function removeEvent(eventId) {
    eventStream = eventStream.filter(e => e.id != eventId);
    streamCount = Math.max(0, streamCount - 1);
    renderEventStream();
    updateStreamStats();
}

function exportEventStream() {
    const data = {
        exported_at: new Date().toISOString(),
        total_events: streamCount,
        events: eventStream
    };
    
    const json = JSON.stringify(data, null, 2);
    const filename = `event-stream-${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
    addEventToStream('info', `Exported ${streamCount} events to ${filename}`);
}

// Companion debug functions
async function updateCompanionDebugInfo() {
    const debugSection = document.getElementById('companionDebug');
    if (!debugSection) return;
    
    try {
        // Get companion health
        const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
        const healthResponse = await fetch(`${apiBase}/health`);
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            
            // Update debug info
            const statusEl = document.getElementById('companionDebugStatus');
            const queueLengthEl = document.getElementById('companionQueueLength');
            const sequenceEl = document.getElementById('companionSequence');
            const lastPollEl = document.getElementById('companionLastPoll');
            const newItemsEl = document.getElementById('companionNewItems');
            const dbTotalsEl = document.getElementById('companionDbTotals');
            
            if (statusEl) {
                statusEl.textContent = 'Connected';
                statusEl.className = 'debug-value connected';
            }
            
            if (queueLengthEl) {
                queueLengthEl.textContent = healthData.queue_length || 0;
                queueLengthEl.className = 'debug-value';
            }
            
            if (sequenceEl) {
                sequenceEl.textContent = healthData.sequence || 0;
                sequenceEl.className = 'debug-value';
            }
            
            if (lastPollEl) {
                if (lastPollTime) {
                    const timeAgo = Math.round((Date.now() - lastPollTime) / 1000);
                    lastPollEl.textContent = `${timeAgo}s ago`;
                    lastPollEl.className = timeAgo < 10 ? 'debug-value connected' : 'debug-value warning';
                } else {
                    lastPollEl.textContent = 'Never';
                    lastPollEl.className = 'debug-value disconnected';
                }
            }
            
            if (newItemsEl) {
                newItemsEl.textContent = `${lastNewEntries} entries, ${lastNewEvents} events`;
                newItemsEl.className = (lastNewEntries > 0 || lastNewEvents > 0) ? 'debug-value connected' : 'debug-value';
            }
            
            if (dbTotalsEl) {
                const entryCount = await db.entries.count();
                const eventCount = await db.events.count();
                dbTotalsEl.textContent = `${entryCount} entries, ${eventCount} events`;
                dbTotalsEl.className = 'debug-value';
            }
        } else {
            // Companion not available
            const statusEl = document.getElementById('companionDebugStatus');
            if (statusEl) {
                statusEl.textContent = 'Disconnected';
                statusEl.className = 'debug-value disconnected';
            }
        }
    } catch (error) {
        console.error('Error updating companion debug info:', error);
        const statusEl = document.getElementById('companionDebugStatus');
        if (statusEl) {
            statusEl.textContent = 'Error';
            statusEl.className = 'debug-value disconnected';
        }
    }
}

async function refreshCompanionData() {
    await updateCompanionDebugInfo();
    await renderFeed();
    await updateStatusDashboard();
    showNotification('Companion data refreshed', 'success');
}

async function testCompanionConnection() {
    try {
        const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
        const response = await fetch(`${apiBase}/health`);
        if (response.ok) {
            const data = await response.json();
            showNotification(`Companion connected: ${data.entries} entries, ${data.events} events`, 'success');
        } else {
            showNotification('Companion not responding', 'error');
        }
    } catch (error) {
        showNotification('Companion connection failed', 'error');
    }
}

function toggleCompanionDebug() {
    const debugSection = document.getElementById('companionDebug');
    const toggleBtn = document.getElementById('toggleCompanionDebug');
    
    if (debugSection.style.display === 'none') {
        debugSection.style.display = 'block';
        toggleBtn.textContent = 'Hide Debug';
        updateCompanionDebugInfo();
    } else {
        debugSection.style.display = 'none';
        toggleBtn.textContent = 'Show Debug';
    }
}

// New clean layout functions
function renderActivityItem(entry) {
    const timestamp = formatTimestamp(entry.timestamp);
    const filePath = entry.file_path || 'No file';
    const source = entry.source || 'unknown';
    const entryId = entry.id || 'unknown';
    const sessionId = entry.session_id || 'unknown';
    
    // Calculate diff size (both lines and characters)
    const beforeLength = entry.before_code ? entry.before_code.length : 0;
    const afterLength = entry.after_code ? entry.after_code.length : 0;
    const beforeLines = entry.before_code ? entry.before_code.split('\n').length : 0;
    const afterLines = entry.after_code ? entry.after_code.split('\n').length : 0;
    const diffChars = afterLength - beforeLength;
    const diffLines = afterLines - beforeLines;
    
    // Create diff string showing both lines and characters
    const diffStr = diffLines !== 0 ? 
        `${diffLines > 0 ? '+' : ''}${diffLines} lines (${diffChars > 0 ? '+' : ''}${diffChars} chars)` :
        `${diffChars > 0 ? '+' : ''}${diffChars} chars`;
    
    // Determine activity type and description based on source
    let activityIcon = '';
    let activityType = 'Activity';
    let description = '';
    let eventCategory = getEventSourceType(entry.source, entry);
    
    if (entry.source === 'filewatcher') {
        // Cursor events - file changes
        activityIcon = '';
        activityType = 'Cursor Code Change';
        if (entry.prompt && (typeof entry.prompt === 'string' ? entry.prompt : entry.prompt.text)) {
            description = `Cursor: Code change with linked prompt. Diff: ${diffStr}`;
        } else {
            description = `Cursor: Code change detected. Diff: ${diffStr}`;
        }
    } else if (entry.source === 'mcp') {
        // Cursor events - MCP communication
        if (entry.prompt && entry.response) {
            activityIcon = '';
            activityType = 'Cursor Conversation';
            description = `Cursor: Full conversation logged`;
        } else if (entry.prompt) {
            activityIcon = '❓';
            activityType = 'Cursor Prompt';
            description = `Cursor: Prompt logged`;
        } else if (entry.response) {
            activityIcon = '🤖';
            activityType = 'Cursor Response';
            description = `Cursor: Response logged`;
        } else {
            activityIcon = '';
            activityType = 'Cursor Telemetry';
            description = `Cursor: Activity logged`;
        }
    } else if (entry.source === 'clipboard') {
        // App events - clipboard capture
        activityIcon = '';
        activityType = 'App Clipboard';
        description = `App: Clipboard content captured`;
    } else if (entry.source === 'dom') {
        // App events - DOM detection
        activityIcon = '[Web]';
        activityType = 'App DOM';
        description = `App: DOM change detected`;
    } else {
        // Default events
        activityIcon = '';
        activityType = eventCategory === 'cursor' ? 'Cursor Event' : 'App Event';
        description = `${eventCategory === 'cursor' ? 'Cursor' : 'App'}: Activity logged`;
    }

    // Create tags display
    const tagsHtml = entry.tags && entry.tags.length > 0 
        ? `<div class="tags-row">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
        : '';

    // Create code/diff preview section
    const codePreviewSection = (entry.before_code && entry.after_code) ? `
        <div class="content-block">
            <div class="content-label">▸ Code Changes:</div>
            <div class="code-preview">
                <div class="code-preview-before">
                    <div class="code-preview-label">Before (${beforeLines} lines):</div>
                    <pre class="code-preview-code">${entry.before_code.substring(0, 200)}${entry.before_code.length > 200 ? '...' : ''}</pre>
                </div>
                <div class="code-preview-after">
                    <div class="code-preview-label">After (${afterLines} lines):</div>
                    <pre class="code-preview-code">${entry.after_code.substring(0, 200)}${entry.after_code.length > 200 ? '...' : ''}</pre>
                </div>
            </div>
        </div>
    ` : '';

    // Create prompt/response sections - always show if they exist
    // Handle both old string format and new object format for prompts
    const promptText = entry.prompt ? 
        (typeof entry.prompt === 'string' ? entry.prompt : entry.prompt.text) : 
        '';
    
    const promptSection = promptText && promptText.length > 0 ? `
        <div class="content-block prompt-block">
            <div class="content-label"> Prompt:</div>
            <div class="content-text prompt-text">${promptText}</div>
        </div>
    ` : '';

    const responseSection = entry.response && entry.response.length > 0 ? `
        <div class="content-block">
            <div class="content-label">🤖 Response:</div>
            <div class="content-text response-text">${entry.response}</div>
        </div>
    ` : '';

    const notesSection = entry.notes ? `
        <div class="content-block">
            <div class="content-label">Notes:</div>
            <div class="content-text notes-text">${entry.notes}</div>
        </div>
    ` : '';

    // Shorten session ID for display
    const shortSessionId = sessionId.length > 8 ? sessionId.substring(0, 8) + '...' : sessionId;

    return `
        <div class="feed-item ${eventCategory}" onclick="toggleFeedItem(${entry.id})">
            <div class="header">
                <div class="file-path"> ${filePath}</div>
                <div class="timestamp"> ${timestamp}</div>
                <div class="event-category ${eventCategory}">${eventCategory.toUpperCase()}</div>
            </div>
            <div class="meta-row">
                <span class="source">Source: ${source}</span>
                <span class="session">• Session: ${shortSessionId}</span>
                ${(diffLines !== 0 || diffChars !== 0) ? `<span class="diff-size">• ${diffStr}</span>` : ''}
            </div>
            ${tagsHtml}
            <div class="content">
                <div class="description">${description}</div>
                ${promptSection}
                ${responseSection}
                ${codePreviewSection}
                ${notesSection}
                ${(entry.before_code && entry.after_code) ? `
                    <div class="diff-actions">
                        <button class="diff-btn" onclick="event.stopPropagation(); showDiffModal(${entry.id})">View Full Diff</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderEventItem(event) {
    const timestamp = formatTimestamp(event.timestamp);
    const details = JSON.parse(event.details || '{}');
    const description = getEventDescription(event.type, details);
    
    // Determine if this is a Cursor event or App event
    let eventCategory = 'app'; // Default to app event
    let categoryPrefix = 'App:';
    
    // Cursor events are typically code changes, file changes, or MCP-related
    if (event.type === 'code_change' || event.type === 'file_changed' || 
        event.type === 'prompt_response' || event.type === 'mcp_logged') {
        eventCategory = 'cursor';
        categoryPrefix = 'Cursor:';
    }
    
    // Event type icons
    const eventIcons = {
        'session_start': '',
        'session_end': '',
        'entry_created': '',
        'entry_manual': '',
        'export_json': '',
        'database_cleared': '',
        'clipboard_enabled': '',
        'clipboard_disabled': '[ERROR]',
        'attachment_added': '[Attach]',
        'search_performed': '',
        'code_change': '',
        'file_changed': '',
        'pause_logging': '',
        'resume_logging': '',
        'prompt_response': '',
        'mcp_logged': ''
    };
    
    const icon = eventIcons[event.type] || '';
    
    // Format details for display
    const detailsText = Object.keys(details).length > 0 
        ? Object.entries(details).map(([key, value]) => `${key}=${value}`).join(', ')
        : '';

    return `
        <div class="feed-item event ${eventCategory}">
            <div class="header">
                <div class="event-title">${icon} ${event.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div class="timestamp">${timestamp}</div>
                <div class="event-category ${eventCategory}">${eventCategory.toUpperCase()}</div>
            </div>
            <div class="content">
                <div class="description">${categoryPrefix} ${description}</div>
                ${detailsText ? `<div class="event-details">Details: ${detailsText}</div>` : ''}
            </div>
        </div>
    `;
}

// New functions for the redesigned interface
function refreshData() {
    renderFeed(); // This will call updateStatusDashboard() internally
    showNotification('Data refreshed', 'success');
}

function testCompanion() {
    testCompanionConnection();
}

function closeDiffModal() {
    const modal = document.getElementById('diffModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function startNewSession() {
    await createNewSession();
    showNotification('New session started', 'success');
}

// Debug function to check prompt data
async function debugPromptData() {
    try {
        const entries = await db.entries.toArray();
        console.log('=== PROMPT DATA DEBUG ===');
        console.log('Total entries:', entries.length);
        
        const entriesWithPrompts = entries.filter(e => e.prompt && e.prompt.length > 0);
        console.log('Entries with prompts:', entriesWithPrompts.length);
        
        entriesWithPrompts.forEach((entry, index) => {
            console.log(`Entry ${index + 1}:`, {
                id: entry.id,
                source: entry.source,
                prompt: entry.prompt.substring(0, 100) + '...',
                response: entry.response ? entry.response.substring(0, 100) + '...' : 'No response',
                tags: entry.tags
            });
        });
        
        showNotification(`Found ${entriesWithPrompts.length} entries with prompts`, 'info');
    } catch (error) {
        console.error('Debug prompt data error:', error);
    }
}

function updateConnectionStatus() {
    const connectionStatusEl = document.getElementById('connectionStatus');
    const connectionTextEl = document.getElementById('connectionText');
    
    if (connectionStatusEl && connectionTextEl) {
        // Check if companion is connected (you can enhance this logic)
        const isConnected = companionConnected || true; // Default to true for now
        
        if (isConnected) {
            connectionStatusEl.className = 'status-indicator status-connected';
            connectionTextEl.textContent = 'Connected';
        } else {
            connectionStatusEl.className = 'status-indicator status-disconnected';
            connectionTextEl.textContent = 'Disconnected';
        }
    }
}

function toggleFeedItem(entryId) {
    const expandedContent = document.getElementById(`expanded-content-${entryId}`);
    if (expandedContent) {
        expandedContent.style.display = expandedContent.style.display === 'none' ? 'block' : 'none';
    }
}

function showDiffModal(entryId) {
    // Get entry data from the database
    db.entries.get(entryId).then(entry => {
        if (entry && entry.before_code && entry.after_code) {
            showModal(`
                <div class="diff-modal">
                    <div class="diff-header">
                        <h3>Code Diff - ${entry.file_path || 'Unknown File'}</h3>
                        <button class="close-btn" onclick="closeModal()">×</button>
                    </div>
                    <div class="diff-container">
                        <div class="diff-section">
                            <h4>Before:</h4>
                            <pre class="code-before">${entry.before_code}</pre>
                        </div>
                        <div class="diff-section">
                            <h4>After:</h4>
                            <pre class="code-after">${entry.after_code}</pre>
                        </div>
                    </div>
                </div>
            `);
        }
    });
}

function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            ${content}
        </div>
    `;
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// Export functions are defined earlier in the file

function toggleCodePreview(entryId) {
    const preview = document.getElementById(`code-preview-${entryId}`);
    if (preview) {
        preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
    }
}

function toggleActivityContent(entryId) {
    const content = document.getElementById(`expanded-content-${entryId}`);
    const button = event.target;
    if (content) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? 'Show Details' : 'Hide Details';
    }
}

function toggleEventContent(eventId) {
    const content = document.getElementById(`expanded-event-${eventId}`);
    const button = event.target;
    if (content) {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? 'Show Details' : 'Hide Details';
    }
}

// Debug function to check database contents
window.debugDatabase = async function() {
    try {
        const entries = await db.entries.toArray();
        const events = await db.events.toArray();
        const sessions = await db.sessions.toArray();
        
        console.log('=== DATABASE DEBUG ===');
        console.log('Sessions:', sessions.length, sessions);
        console.log('Entries:', entries.length, entries);
        console.log('Events:', events.length, events);
        
        // Check filewatcher entries specifically
        const filewatcherEntries = entries.filter(e => e.source === 'filewatcher');
        console.log('Filewatcher entries:', filewatcherEntries.length, filewatcherEntries);
        
        // Check if companion is connected
        console.log('Companion connected:', companionConnected);
        console.log('Last poll time:', lastPollTime);
        console.log('Last cursor:', lastCompanionCursor);
        
        return { sessions, entries, events, filewatcherEntries };
    } catch (error) {
        console.error('Debug database error:', error);
    }
};

// Test companion connection
window.testCompanion = async function() {
    try {
        const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
        const response = await fetch(`${apiBase}/queue?since=0`);
        const data = await response.json();
        console.log('=== COMPANION TEST ===');
        console.log('Response status:', response.status);
        console.log('Data received:', data);
        console.log('Entries:', data.entries?.length || 0);
        console.log('Events:', data.events?.length || 0);
        return data;
    } catch (error) {
        console.error('Companion test error:', error);
    }
};

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Cache bust: Mon Sep 15 19:15:42 EDT 2025
