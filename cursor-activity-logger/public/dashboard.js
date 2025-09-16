// Database setup
const db = new Dexie('CursorActivityLogger');
db.version(4).stores({
    sessions: 'id, name, created_at',
    entries: '++id, session_id, timestamp, source, file_path, prompt, response, notes, tags, before_code, after_code',
    events: '++id, session_id, timestamp, type, details',
    attachments: '++id, entry_id, name, mime_type, data'
});

// Global state
let currentFilter = 'all';
let companionConnected = false;
let lastCompanionCursor = 0;
let pollingInterval = null;

// Initialize dashboard
async function init() {
    try {
        await db.open();
        console.log('✅ Database opened successfully');
        
        // Start companion polling
        startCompanionPolling();
        
        // Load initial data
        await loadData();
        
        // Set up click handlers for diff viewer
        addCardClickHandlers();
        
        // Set up auto-refresh
        setInterval(loadData, 5000);
        
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        showError('Failed to initialize dashboard');
    }
}

// Start companion polling
function startCompanionPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }

    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch(`http://127.0.0.1:43917/queue?since=${lastCompanionCursor}`);
            if (response.ok) {
                const data = await response.json();
                
                if (!companionConnected) {
                    companionConnected = true;
                    updateConnectionStatus(true);
                }

                // Process entries
                if (data.entries && data.entries.length > 0) {
                    console.log(`📥 Received ${data.entries.length} entries from companion`);
                    for (const entry of data.entries) {
                        try {
                            await db.entries.put(entry);
                        } catch (error) {
                            console.error('Error saving entry:', error);
                        }
                    }
                }

                // Process events
                if (data.events && data.events.length > 0) {
                    console.log(`📥 Received ${data.events.length} events from companion`);
                    for (const event of data.events) {
                        try {
                            await db.events.put(event);
                        } catch (error) {
                            console.error('Error saving event:', error);
                        }
                    }
                }

                // Update cursor
                if (data.cursor) {
                    lastCompanionCursor = data.cursor;
                }

                // Refresh display if we got new data
                if ((data.entries && data.entries.length > 0) || (data.events && data.events.length > 0)) {
                    await loadData();
                }
            }
        } catch (error) {
            if (companionConnected) {
                companionConnected = false;
                updateConnectionStatus(false);
            }
        }
    }, 2000);
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const textEl = document.getElementById('connectionText');
    
    if (connected) {
        statusEl.className = 'status-indicator status-connected';
        textEl.textContent = 'Connected';
    } else {
        statusEl.className = 'status-indicator status-disconnected';
        textEl.textContent = 'Disconnected';
    }
}

// Load and display data
async function loadData() {
    try {
        const sessions = await db.sessions.toArray();
        const entries = await db.entries.orderBy('timestamp').reverse().toArray();
        const events = await db.events.orderBy('timestamp').reverse().toArray();

        console.log(`📊 Loaded data: ${sessions.length} sessions, ${entries.length} entries, ${events.length} events`);

        // Update stats
        updateStats(sessions, entries, events);

        // Filter data
        const filteredData = filterData(entries, events);

        // Group data by session
        const groupedData = groupDataBySession(filteredData);

        // Render data
        renderActivityFeed(groupedData);

    } catch (error) {
        console.error('❌ Error loading data:', error);
        showError('Failed to load data');
    }
}

// Update statistics
function updateStats(sessions, entries, events) {
    document.getElementById('totalSessions').textContent = sessions.length;
    document.getElementById('totalEntries').textContent = entries.length;
    document.getElementById('totalEvents').textContent = events.length;
    
    const codeChanges = entries.filter(e => e.before_code && e.after_code).length;
    document.getElementById('totalCodeChanges').textContent = codeChanges;
}

// Filter data based on current filter
function filterData(entries, events) {
    const allItems = [
        ...entries.map(entry => ({ ...entry, itemType: 'entry' })),
        ...events.map(event => ({ ...event, itemType: 'event' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (currentFilter === 'all') {
        return allItems;
    } else if (currentFilter === 'events') {
        return allItems.filter(item => item.itemType === 'event');
    } else {
        return allItems.filter(item => 
            item.itemType === 'entry' && item.source === currentFilter
        );
    }
}

// Group data by session
function groupDataBySession(items) {
    const groups = {};
    
    for (const item of items) {
        const sessionId = item.session_id || 'no-session';
        if (!groups[sessionId]) {
            groups[sessionId] = {
                sessionId: sessionId,
                items: []
            };
        }
        groups[sessionId].items.push(item);
    }
    
    // Sort items within each group by timestamp
    Object.values(groups).forEach(group => {
        group.items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });
    
    return Object.values(groups);
}

// Render activity feed
function renderActivityFeed(groups) {
    const feedEl = document.getElementById('activityFeed');
    
    if (groups.length === 0) {
        feedEl.innerHTML = '<div class="empty-state">No activity found. Try changing the filter or wait for new data.</div>';
        return;
    }

    let html = '';
    
    for (const group of groups) {
        // Session header
        html += `<div class="session-header">Session: ${group.sessionId}</div>`;
        
        // Items in this session
        for (const item of group.items) {
            if (item.itemType === 'entry') {
                html += renderEntry(item);
            } else {
                html += renderEvent(item);
            }
        }
    }

    feedEl.innerHTML = html;
}

// Render entry
function renderEntry(entry) {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const hasCodeDiff = entry.before_code && entry.after_code;
    const hasContent = entry.prompt || entry.response;
    
    // Calculate diff size for file changes
    let diffSize = '';
    if (hasCodeDiff) {
        const beforeLength = entry.before_code.length;
        const afterLength = entry.after_code.length;
        const diff = afterLength - beforeLength;
        diffSize = diff > 0 ? `+${diff} chars` : `${diff} chars`;
    }
    
    let contentHtml = '';
    
    if (hasCodeDiff) {
        contentHtml = `
            <div class="code-diff">
                <div>
                    <div class="diff-label">Before</div>
                    <div class="code-before">${entry.before_code}</div>
                </div>
                <div>
                    <div class="diff-label">After</div>
                    <div class="code-after">${entry.after_code}</div>
                </div>
            </div>
        `;
    } else if (hasContent) {
        if (entry.prompt) {
            contentHtml += `
                <div class="label">Prompt</div>
                <div class="content-text">${entry.prompt}</div>
            `;
        }
        if (entry.response) {
            contentHtml += `
                <div class="label">Response</div>
                <div class="content-text">${entry.response}</div>
            `;
        }
    }

    if (entry.notes) {
        contentHtml += `<div class="notes">${entry.notes}</div>`;
    }

    const tagsHtml = entry.tags && entry.tags.length > 0 
        ? `<div class="tags">${entry.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
        : '';

    return `
        <div class="feed-item entry-card" data-entry-id="${entry.id}" style="cursor: pointer;">
            <div class="header">
                <div class="title">
                    ${entry.file_path ? `<span class="file-path">${entry.file_path}</span>` : 'Entry'}
                </div>
                <div class="timestamp">${timestamp}</div>
            </div>
            <div class="meta-row">
                <span class="source">${entry.source}</span>
                ${diffSize ? `<span class="diff-size">${diffSize}</span>` : ''}
                <span class="activity-type">${getActivityType(entry)}</span>
            </div>
            <div class="content">
                ${contentHtml}
            </div>
            ${tagsHtml}
        </div>
    `;
}

// Render event
function renderEvent(event) {
    const timestamp = new Date(event.timestamp).toLocaleString();
    const details = JSON.parse(event.details || '{}');
    
    return `
        <div class="feed-item event-card" data-entry-id="${event.id}" style="cursor: pointer;">
            <div class="header">
                <div class="title">
                    ⚡ ${event.type.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div class="timestamp">${timestamp}</div>
            </div>
            ${Object.keys(details).length > 0 ? `
                <div class="content">
                    <pre>${JSON.stringify(details, null, 2)}</pre>
                </div>
            ` : ''}
        </div>
    `;
}

// Get activity type
function getActivityType(entry) {
    if (entry.before_code && entry.after_code) {
        return 'Code Change';
    } else if (entry.prompt && entry.response) {
        return 'Conversation';
    } else if (entry.prompt) {
        return 'Prompt';
    } else if (entry.response) {
        return 'Response';
    } else {
        return 'Activity';
    }
}

// Set filter
function setFilter(filter) {
    currentFilter = filter;
    
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Reload data
    loadData();
}

// Refresh data
async function refreshData() {
    await loadData();
}

// Debug database
async function debugDatabase() {
    try {
        const sessions = await db.sessions.toArray();
        const entries = await db.entries.toArray();
        const events = await db.events.toArray();
        
        console.log('=== DATABASE DEBUG ===');
        console.log('Sessions:', sessions.length, sessions);
        console.log('Entries:', entries.length, entries);
        console.log('Events:', events.length, events);
        
        const filewatcherEntries = entries.filter(e => e.source === 'filewatcher');
        console.log('Filewatcher entries:', filewatcherEntries.length, filewatcherEntries);
        
        alert(`Database contains:\n${sessions.length} sessions\n${entries.length} entries\n${events.length} events\n\nCheck console for details.`);
    } catch (error) {
        console.error('Debug error:', error);
        alert('Debug failed: ' + error.message);
    }
}

// Test companion connection
async function testCompanion() {
    try {
        const response = await fetch('http://127.0.0.1:43917/queue?since=0');
        const data = await response.json();
        
        console.log('=== COMPANION TEST ===');
        console.log('Response status:', response.status);
        console.log('Data received:', data);
        console.log('Entries:', data.entries?.length || 0);
        console.log('Events:', data.events?.length || 0);
        
        alert(`Companion test successful!\n\nStatus: ${response.status}\nEntries: ${data.entries?.length || 0}\nEvents: ${data.events?.length || 0}\n\nCheck console for details.`);
    } catch (error) {
        console.error('Companion test error:', error);
        alert('Companion test failed: ' + error.message);
    }
}

// Show error
function showError(message) {
    const feedEl = document.getElementById('activityFeed');
    feedEl.innerHTML = `<div class="error">${message}</div>`;
}

// ========================================
// Code Diff Viewer Functions
// ========================================

function openDiffModal(entry) {
    const modal = document.getElementById('diffModal');
    const filePath = document.getElementById('diffFilePath');
    const timestamp = document.getElementById('diffTimestamp');
    const beforeCode = document.getElementById('beforeCode');
    const afterCode = document.getElementById('afterCode');
    
    // Populate modal with entry data
    filePath.textContent = entry.file_path || 'Unknown file';
    timestamp.textContent = new Date(entry.timestamp).toLocaleString();
    
    // Set code content
    beforeCode.textContent = entry.before_code || 'No previous content';
    afterCode.textContent = entry.after_code || 'No new content';
    
    // Show modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeDiffModal() {
    const modal = document.getElementById('diffModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('diffModal');
    if (event.target === modal) {
        closeDiffModal();
    }
}

// Add click handlers to cards
function addCardClickHandlers() {
    // Add click handlers to all cards that have code changes
    document.addEventListener('click', function(event) {
        const card = event.target.closest('.entry-card, .event-card');
        if (card && card.dataset.entryId) {
            const entryId = card.dataset.entryId;
            // Find the entry data and open diff modal
            db.entries.get(parseInt(entryId)).then(entry => {
                if (entry && (entry.before_code || entry.after_code)) {
                    openDiffModal(entry);
                }
            });
        }
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
