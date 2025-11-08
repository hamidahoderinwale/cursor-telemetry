/**
 * Cursor Activity Dashboard - Main Application
 * Clean, modern implementation with full feature support
 * 
 * MODULE DEPENDENCIES:
 * - core/config.js → CONFIG
 * - core/state.js → state
 * - core/api-client.js → APIClient
 * - core/websocket-manager.js → WebSocketManager
 * - algorithms/similarity.js → cosineSimilarity, euclideanDistance, etc.
 * - algorithms/dimensionality-reduction.js → applyPCA, applyMDS, applyTSNE, applyUMAP
 * - algorithms/clustering.js → applyClustering, kMeansClustering, detectCommunities, etc.
 */

// Ensure modules are loaded (they export to window)
if (!window.CONFIG || !window.state || !window.APIClient) {
  console.error('[ERROR] Core modules not loaded. Ensure core/config.js, core/state.js, and core/api-client.js are loaded before dashboard.js');
  // Create fallbacks to prevent crashes
  if (!window.CONFIG) window.CONFIG = { API_BASE: 'http://localhost:43917' };
  if (!window.state) window.state = { data: {}, stats: {} };
  if (!window.APIClient) {
    console.error('[ERROR] APIClient not available! API calls will fail.');
    window.APIClient = { get: () => Promise.reject(new Error('APIClient not loaded')), post: () => Promise.reject(new Error('APIClient not loaded')) };
  }
}

// Use globals from modules (available via window exports)
// CONFIG, state, and APIClient are now loaded from core modules
// They are available as window.CONFIG, window.state, and window.APIClient
// No need to redeclare them here

// ===================================
// WebSocket Manager
// ===================================
// NOTE: WebSocketManager is now loaded from core/websocket-manager.js

// ===================================
// Data Fetching & Processing
// ===================================

// ===================================
// Data Initialization
// ===================================
// NOTE: initializeDashboard, loadFromCache, fetchRecentData, fetchOlderHistory, fetchAllData
// are now loaded from app/data-initializer.js
// They are available as window.initializeDashboard, window.loadFromCache, etc.
// 
// IMPORTANT: Do NOT define local functions with the same names - this causes infinite recursion!
// Always use window.initializeDashboard, window.fetchRecentData, etc. directly.

function calculateStats() {
  const events = state.data.events;
  const entries = state.data.entries;
  const terminalCommands = state.data.terminalCommands || [];

  // Count sessions
  const sessions = new Set();
  [...events, ...entries].forEach(item => {
    if (item.session_id) sessions.add(item.session_id);
  });

  // Count file changes (use totalEventCount for all-time if available, otherwise use filtered count)
  const fileChanges = state.stats?.totalEventCount || events.filter(e => 
    e.type === 'file_change' || e.type === 'code_change'
  ).length;
  
  // Count terminal commands
  state.stats.terminalCommands = terminalCommands.length;

  // Count AI interactions - prompts with meaningful content
  // Uses helper function to check all possible text field names
  const aiInteractions = (state.data.prompts || []).filter(p => {
    return window.hasPromptContent ? window.hasPromptContent(p, 5) : 
           (() => {
             const text = p.text || p.prompt || p.preview || p.content || '';
             return text && text.length > 5;
           })();
  }).length;
  
  console.log(`AI Interactions: ${aiInteractions} of ${state.data.prompts?.length || 0} prompts`);

  // Calculate code changed (approximate)
  let totalChars = 0;
  events.forEach(e => {
    try {
      const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
      const added = details?.chars_added || 0;
      const deleted = details?.chars_deleted || 0;
      totalChars += added + deleted;
    } catch (err) {
      // Silently skip parsing errors
    }
  });
  
  console.log(`[STATS] Code changed: ${totalChars} chars (${(totalChars / 1024).toFixed(1)} KB) from ${events.length} events`);

  // Calculate average context usage
  let totalContextUsage = 0;
  let contextUsageCount = 0;
  (state.data.prompts || []).forEach(p => {
    if (p.contextUsage && p.contextUsage > 0) {
      totalContextUsage += p.contextUsage;
      contextUsageCount++;
    }
  });
  const avgContextUsage = contextUsageCount > 0 ? (totalContextUsage / contextUsageCount) : 0;

  state.stats = {
    sessions: sessions.size,
    fileChanges: fileChanges,
    aiInteractions: aiInteractions,
    codeChanged: (totalChars / 1024).toFixed(1), // KB
    avgContext: avgContextUsage.toFixed(1) // percentage
  };
  
  console.log('[STATS] Final stats:', state.stats);

  updateStatsDisplay();
}

function handleRealtimeUpdate(data) {
  if (data.type === 'entry' && data.data) {
    state.data.entries.push(data.data);
  } else if (data.type === 'event' && data.data) {
    state.data.events.push(data.data);
  }
  
  calculateStats();
  renderCurrentView();
}

function handleTerminalCommand(cmd) {
  // Add to terminal commands array
  state.data.terminalCommands.unshift(cmd);
  
  // Keep only last 100 commands in memory
  if (state.data.terminalCommands.length > 100) {
    state.data.terminalCommands = state.data.terminalCommands.slice(0, 100);
  }
  
  // Update stats
  state.stats.terminalCommands = state.data.terminalCommands.length;
  
  // If on activity view, re-render
  if (state.currentView === 'activity') {
    renderCurrentView();
  }
}

// ===================================
// UI Updates
// ===================================
// NOTE: updateConnectionStatus and initProgress are now in app/progress-tracker.js

// ===================================
// UI Updates
// ===================================
// NOTE: updateStatsDisplay, updateWorkspaceSelector, and switchView are now in app/ui-helpers.js

// ===================================
// View rendering is handled by core/view-router.js
// Individual view implementations are in views/ directory
// ===================================

// Note: All view render functions are now in separate view files:
// - views/overview/index.js
// - views/activity/index.js  
// - views/analytics/index.js
// - views/file-graph/index.js
// - views/navigator/index.js
// - views/system/index.js
// - views/api-docs/index.js
// - views/threads/index.js

// Removed duplicate view render functions - use the ones from views/ instead
// ===================================
// Overview View (moved to views/overview/index.js)
// ===================================
// Removed: function renderOverviewView - see views/overview/index.js

// Removed: _legacy_renderOverviewView - no longer needed (replaced by views/overview/index.js)
// Removed: renderActivityTimeline - replaced by renderUnifiedTimeline in views/activity/timeline-helpers.js
// Removed: groupIntoTemporalThreads - moved to views/activity/timeline-helpers.js

// Legacy function - delegates to timeline-helpers version
function groupIntoTemporalThreads(items, timeWindowMs = 15 * 60 * 1000) {
  if (window.groupIntoTemporalThreads) {
    return window.groupIntoTemporalThreads(items, timeWindowMs);
  }
  // Fallback if not loaded yet
  return items;
}

// NOTE: renderUnifiedTimeline is now in views/activity/timeline-helpers.js
// Legacy stub for backward compatibility
function renderUnifiedTimeline(items) {
  if (window.renderUnifiedTimeline) {
    return window.renderUnifiedTimeline(items);
  }
  console.error('[ERROR] views/activity/timeline-helpers.js not loaded');
  return '<div class="empty-state">Timeline helpers not loaded</div>';
}

// NOTE: renderConversationThread is now in views/activity/timeline-helpers.js
// Legacy stub for backward compatibility
function renderConversationThread(conversation, side = 'right') {
  if (window.renderConversationThread) {
    return window.renderConversationThread(conversation, side);
  }
  console.error('[ERROR] views/activity/timeline-helpers.js not loaded');
  return '';
}

// Removed duplicate implementation - see views/activity/timeline-helpers.js
/*
function _old_renderConversationThread(conversation, side = 'right') {
  const { thread, messages } = conversation;
  const title = thread?.conversationTitle || thread?.text || 'Untitled Conversation';
  const time = formatTimeAgo(thread?.timestamp || conversation.timestamp);
  const messageCount = messages.length;
  const threadId = thread?.composerId || `conv-${Date.now()}`;
  
  // Sort messages chronologically
  const sortedMessages = messages.sort((a, b) => a.sortTime - b.sortTime);
  
  return `
    <div class="timeline-item timeline-item-${side} conversation-timeline-item">
      <div class="timeline-content prompt-content">
        <div class="timeline-header clickable" onclick="toggleConversationMessages('${threadId}')">
          <div class="timeline-title">
            <span id="conv-icon-${threadId}" class="timeline-title-icon"></span>
            <span class="timeline-title-text">${escapeHtml(title)}</span>
            ${messageCount > 0 ? `<span class="timeline-title-meta">(${messageCount} messages)</span>` : ''}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">Conversation</span>
          ${thread?.workspaceName ? `<span class="badge">${escapeHtml(thread.workspaceName)}</span>` : ''}
          ${thread?.mode ? `<span class="badge" style="background: var(--color-primary); color: white;">${escapeHtml(thread.mode)}</span>` : ''}
        </div>
        
        <!-- Messages (initially hidden) -->
        <div id="conv-messages-${threadId}" class="conversation-messages">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => renderConversationMessage(msg)).join('') : '<div class="conversation-empty">No messages in this conversation yet</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderConversationMessage(message) {
  const isUser = message.messageRole === 'user';
  const icon = '';
  const bgColor = isUser ? 'rgba(59, 130, 246, 0.1)' : 'rgba(139, 92, 246, 0.1)';
  const time = formatTimeAgo(message.timestamp);
  const text = message.text || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  return `
    <div class="conversation-message ${isUser ? 'user' : 'ai'}">
      <div class="conversation-message-header">
        <span class="conversation-message-icon">${icon}</span>
        <span class="conversation-message-author">${isUser ? 'You' : 'AI Assistant'}</span>
        <span class="conversation-message-time">${time}</span>
        ${message.thinkingTimeSeconds ? `<span class="badge" style="background: var(--color-success); color: white;">Thinking ${message.thinkingTimeSeconds}s</span>` : ''}
      </div>
      <div class="conversation-message-content">${escapeHtml(displayText)}</div>
      ${text.length > 300 ? `<button class="conversation-message-read-more" onclick="showEventModal('${message.id}')">Read more</button>` : ''}
    </div>
  `;
}

function toggleConversationMessages(threadId) {
  const messagesDiv = document.getElementById(`conv-messages-${threadId}`);
  const icon = document.getElementById(`conv-icon-${threadId}`);
  
  if (messagesDiv && icon) {
    const isHidden = !messagesDiv.classList.contains('visible');
    if (isHidden) {
      messagesDiv.classList.add('visible');
      icon.style.transform = 'rotate(90deg)';
    } else {
      messagesDiv.classList.remove('visible');
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

// NOTE: renderPromptTimelineItem is now in views/activity/timeline-helpers.js
// Legacy stub for backward compatibility
function renderPromptTimelineItem(prompt, side = 'right', timelineItems = null) {
  if (window.renderPromptTimelineItem) {
    return window.renderPromptTimelineItem(prompt, side, timelineItems);
  }
  console.error('[ERROR] views/activity/timeline-helpers.js not loaded');
  return '';
}

// NOTE: renderTemporalThread is now in views/activity/timeline-helpers.js
// Legacy stub for backward compatibility
function renderTemporalThread(thread, timelineItems = null) {
  if (window.renderTemporalThread) {
    return window.renderTemporalThread(thread, timelineItems);
  }
  console.error('[ERROR] views/activity/timeline-helpers.js not loaded');
  return '';
}

// Removed duplicate implementation - see views/activity/timeline-helpers.js
/*
function _old_renderTemporalThread(thread) {
  // Validate timestamps
  const startTime = thread.startTime && !isNaN(thread.startTime) ? thread.startTime : Date.now();
  const endTime = thread.endTime && !isNaN(thread.endTime) ? thread.endTime : startTime;
  
  const duration = endTime - startTime;
  const durationMinutes = duration > 0 ? Math.round(duration / 60000) : 0;
  
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  
  // Only show time range if times are different, otherwise show single time
  const timeRange = duration > 60000 // More than 1 minute difference
    ? `${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`
    : startDate.toLocaleTimeString();
  
  const threadId = thread.id;
  
  // Count items by type
  const eventCounts = {
    events: 0,
    prompts: 0,
    terminals: 0,
    conversations: 0
  };
  
  thread.items.forEach(item => {
    if (item.itemType === 'event') eventCounts.events++;
    else if (item.itemType === 'prompt') eventCounts.prompts++;
    else if (item.itemType === 'terminal') eventCounts.terminals++;
    else if (item.itemType === 'conversation') eventCounts.conversations++;
  });
  
  const totalItems = thread.items.length;
  const summary = [
    eventCounts.events > 0 ? `${eventCounts.events} file change${eventCounts.events !== 1 ? 's' : ''}` : '',
    eventCounts.prompts > 0 ? `${eventCounts.prompts} prompt${eventCounts.prompts !== 1 ? 's' : ''}` : '',
    eventCounts.terminals > 0 ? `${eventCounts.terminals} terminal command${eventCounts.terminals !== 1 ? 's' : ''}` : '',
    eventCounts.conversations > 0 ? `${eventCounts.conversations} conversation${eventCounts.conversations !== 1 ? 's' : ''}` : ''
  ].filter(Boolean).join(', ');
  
  // Sort items within thread chronologically (oldest first within the thread)
  const sortedItems = [...thread.items].sort((a, b) => a.sortTime - b.sortTime);
  
  return `
    <div class="timeline-item temporal-thread-item">
      <div class="timeline-content">
        <div class="timeline-header clickable" onclick="toggleTemporalThread('${threadId}')">
          <div class="timeline-title">
            <span id="thread-icon-${threadId}" class="timeline-title-icon">▶</span>
            <span class="timeline-title-text">Activity Session</span>
            <span class="timeline-title-meta">(${totalItems} items • ${durationMinutes} min)</span>
          </div>
          <div class="timeline-meta">${formatTimeAgo(thread.startTime)}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">${timeRange}</span>
          <span class="badge">${summary}</span>
        </div>
        
        <!-- Thread items (initially hidden) -->
        <div id="thread-items-${threadId}" class="temporal-thread-items">
          ${sortedItems.map(item => {
            if (item.itemType === 'event') {
              return renderTimelineItem(item, 'left');
            } else if (item.itemType === 'terminal') {
              return renderTerminalTimelineItem(item, 'left');
            } else if (item.itemType === 'conversation') {
              return renderConversationThread(item.conversation, 'right');
            } else if (item.itemType === 'prompt') {
              return renderPromptTimelineItem(item, 'right');
            }
            return '';
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleTemporalThread(threadId) {
  const itemsDiv = document.getElementById(`thread-items-${threadId}`);
  const icon = document.getElementById(`thread-icon-${threadId}`);
  
  if (itemsDiv && icon) {
    const isHidden = !itemsDiv.classList.contains('visible');
    if (isHidden) {
      itemsDiv.classList.add('visible');
      icon.textContent = '▼';
    } else {
      itemsDiv.classList.remove('visible');
      icon.textContent = '▶';
    }
  }
}

// NOTE: renderTerminalTimelineItem is now in views/activity/timeline-helpers.js
// Legacy stub for backward compatibility
function renderTerminalTimelineItem(cmd, side = 'left', timelineItems = null) {
  if (window.renderTerminalTimelineItem) {
    return window.renderTerminalTimelineItem(cmd, side, timelineItems);
  }
  console.error('[ERROR] views/activity/timeline-helpers.js not loaded');
  return '';
}
// NOTE: renderTimelineItem is now in views/activity/timeline-helpers.js
// Legacy stub for backward compatibility
function renderTimelineItem(event, side = 'left', timelineItems = null) {
  if (window.renderTimelineItem) {
    return window.renderTimelineItem(event, side, timelineItems);
  }
  console.error('[ERROR] views/activity/timeline-helpers.js not loaded');
  return '';
}

// Removed duplicate implementation - see views/activity/timeline-helpers.js
/*
function _old_renderTimelineItem(event, side = 'left') {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const title = getEventTitle(event);
  const desc = getEventDescription(event);
  
  // Quick check for related prompts (will do full search in modal)
  // Only show badge if we have prompts and the event has file_path
  let promptBadge = '';
  let contextIndicators = '';
  
  try {
    if (state.data.prompts && state.data.prompts.length > 0 && 
        (event.type === 'file_change' || event.type === 'code_change')) {
      // Quick count without full matching logic (badge is just an indicator)
      const eventTime = new Date(event.timestamp).getTime();
      // Removed uninformative "AI" badge - related prompts are shown in detail below
    }
    
    // Add context file indicators
    if (event.context) {
      const badges = [];
      
      // @ files indicator
      if (event.context.atFiles && event.context.atFiles.length > 0) {
        badges.push(`<span class="context-indicator files" title="${event.context.atFiles.length} @ referenced files">[FILE] ${event.context.atFiles.length}</span>`);
      }
      
      // Context files indicator
      const contextFileCount = (event.context.contextFiles?.attachedFiles?.length || 0) + 
                               (event.context.contextFiles?.codebaseFiles?.length || 0);
      if (contextFileCount > 0) {
        badges.push(`<span class="context-indicator context-files" title="${contextFileCount} context files">${contextFileCount} files</span>`);
      }
      
      // UI state indicator
      if (event.context.browserState && event.context.browserState.tabs && event.context.browserState.tabs.length > 0) {
        badges.push(`<span class="context-indicator system" title="${event.context.browserState.tabs.length} tabs open">[SYSTEM] ${event.context.browserState.tabs.length}</span>`);
      }
      
      contextIndicators = badges.join('');
    }
  } catch (e) {
    // Ignore errors in badge display
  }
  
  return `
    <div class="timeline-item timeline-item-left event-content" onclick="showEventModal('${event.id || event.timestamp}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            ${title}
            ${promptBadge}
            ${contextIndicators}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">${desc}</div>
      </div>
    </div>
  `;
}

function getEventTitle(event) {
  if (event.type === 'file_change' || event.type === 'code_change') {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || event.file_path || event.path || '';
      
      // Skip if it looks like a Git object hash (40 hex chars)
      if (/^[a-f0-9]{40}$/i.test(path)) {
        return 'Git object change';
      }
      
      // Extract filename from path
      const fileName = path.split('/').pop() || '';
      
      // If filename is empty or looks like a hash, try to use a better description
      if (!fileName || /^[a-f0-9]{32,}$/i.test(fileName)) {
        return details?.change_type || event.type || 'File changed';
      }
      
      return fileName;
    } catch {
      return 'File changed';
    }
  }
  return event.type || 'Activity';
}

function getEventDescription(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const added = details?.chars_added || 0;
    const deleted = details?.chars_deleted || 0;
    if (added || deleted) {
      return `+${added} / -${deleted} characters`;
    }
  } catch {}
  return 'File modification detected';
}

function renderPromptList(entries) {
  return `
    <div class="prompt-list">
      ${entries.map(entry => {
        // Get text from various possible fields
        const promptText = entry.prompt || entry.text || entry.preview || entry.content;
        const displayText = promptText ? truncate(promptText, 100) : 'Empty prompt';
        const source = entry.source || entry.method || 'unknown';
        
        return `
          <div class="prompt-item" onclick="showThreadModal('${entry.id}')">
            <div class="prompt-item-text">
              ${escapeHtml(displayText)}
            </div>
            <div class="prompt-item-footer">
              <div class="prompt-item-timestamp">
                ${new Date(entry.timestamp).toLocaleString()}
              </div>
              <div class="prompt-item-source">
                ${escapeHtml(source)}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// NOTE: renderSystemStatus and renderWorkspacesList are now in app/ui-helpers.js

// ===================================
// Activity View
// ===================================

// ===================================
// Activity View (moved to views/activity/index.js)
// ===================================
// Removed: function renderActivityView - see views/activity/index.js

// Removed: _legacy_renderActivityView - see views/activity/index.js

// ===================================
// Threads View  
// ===================================

// ===================================
// Threads View (moved to views/threads/index.js)
// ===================================
// Removed: function renderThreadsView - see views/threads/index.js

// Removed: _legacy_renderThreadsView - see views/threads/index.js

function renderPromptsList(prompts) {
  // Sort by most recent
  const sortedPrompts = [...prompts].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return `
    <div class="prompt-list">
      ${sortedPrompts.map(prompt => {
        // Get text from various possible fields
        const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content;
        const displayText = promptText ? truncate(promptText, 150) : 'Empty prompt';
        const source = prompt.source || prompt.method || 'unknown';
        const status = prompt.status || 'captured';
        
        return `
          <div class="prompt-card" onclick="showPromptModal('${prompt.id}')">
            <div class="prompt-header">
              <div class="prompt-status ${status}">
                ${getPromptStatusIcon(status)}
                ${escapeHtml(status)}
              </div>
              <div class="prompt-time">${formatTimeAgo(prompt.timestamp)}</div>
            </div>
            <div class="prompt-content">
              ${escapeHtml(displayText)}
            </div>
            <div class="prompt-meta">
              ${prompt.linked_entry_id ? '<span class="prompt-tag">Linked</span>' : '<span class="prompt-tag pending">Pending</span>'}
              <span class="prompt-tag">${escapeHtml(source)}</span>
              ${prompt.workspaceName ? `<span class="prompt-tag">[FILE] ${escapeHtml(prompt.workspaceName)}</span>` : prompt.workspaceId ? `<span class="prompt-tag">[FILE] ${escapeHtml(prompt.workspaceId.substring(0, 8))}...</span>` : ''}
              ${prompt.metadata?.complexity ? `<span class="prompt-tag">Complexity: ${escapeHtml(prompt.metadata.complexity)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// NOTE: renderPromptEmptyState and getPromptStatusIcon are now in app/ui-helpers.js
// NOTE: formatTimeAgo is already in utils/time-formatting.js

function groupIntoThreads(entries) {
  const threadMap = new Map();
  
  entries.forEach(entry => {
    const threadId = entry.session_id || entry.thread_id || 'default';
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, {
        id: threadId,
        messages: [],
        firstMessage: entry.timestamp,
        lastMessage: entry.timestamp
      });
    }
    
    const thread = threadMap.get(threadId);
    thread.messages.push(entry);
    thread.lastMessage = entry.timestamp;
  });
  
  return Array.from(threadMap.values()).sort((a, b) => 
    new Date(b.lastMessage) - new Date(a.lastMessage)
  );
}

function renderThreadsList(threads) {
  return `
    <div class="thread-list">
      ${threads.map(thread => `
        <div class="thread-card" onclick="showThreadModal('${thread.id}')">
          <div class="thread-card-header">
            <div>
              <div class="thread-card-title">${escapeHtml(truncate(thread.messages[0]?.prompt || thread.messages[0]?.text || 'Conversation Thread', 60))}</div>
              <div class="thread-card-meta">
                <span>${thread.messages.length} messages</span>
                <span>${new Date(thread.lastMessage).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="thread-card-badge">${escapeHtml(thread.id.substring(0, 8))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===================================
// Analytics View
// ===================================

// ===================================
// Analytics View (moved to views/analytics/index.js)
// ===================================
// Removed: function renderAnalyticsView - see views/analytics/index.js

// Removed: _legacy_renderAnalyticsView - see views/analytics/index.js
// ✅ REMOVED: Continuous Activity Timeline (per user request)
// function renderActivityChart() {
//   Commented out to remove Continuous Activity Timeline from dashboard
// }
function renderActivityChart_DISABLED() {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const allEvents = state.data.events || [];
  const allPrompts = state.data.prompts || [];
  
  if (allEvents.length === 0 && allPrompts.length === 0) {
    const context = ctx.getContext('2d');
    context.font = '500 16px Geist, -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text') || '#1f2937';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('No Data Available', ctx.width / 2, ctx.height / 2 - 10);
    context.font = '14px Geist, -apple-system, BlinkMacSystemFont, sans-serif';
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted') || '#6b7280';
    context.fillText('Activity data will appear here once you start coding', ctx.width / 2, ctx.height / 2 + 15);
    return;
  }

  // Determine time range and granularity
  const now = Date.now();
  const allTimes = [
    ...allEvents.map(e => new Date(e.timestamp).getTime()),
    ...allPrompts.map(p => new Date(p.timestamp).getTime())
  ];
  const oldestTime = Math.min(...allTimes);
  const timeSpan = now - oldestTime;
  
  // Choose granularity based on data span
  let bucketSize, numBuckets, labelFormat;
  if (timeSpan < 2 * 60 * 60 * 1000) {
    // Less than 2 hours: 1-minute buckets
    bucketSize = 60 * 1000;
    numBuckets = Math.min(120, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (timeSpan < 24 * 60 * 60 * 1000) {
    // Less than 1 day: 5-minute buckets
    bucketSize = 5 * 60 * 1000;
    numBuckets = Math.min(288, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (timeSpan < 7 * 24 * 60 * 60 * 1000) {
    // Less than 1 week: hourly buckets
    bucketSize = 60 * 60 * 1000;
    numBuckets = Math.min(168, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  } else {
    // More than 1 week: daily buckets
    bucketSize = 24 * 60 * 60 * 1000;
    numBuckets = Math.min(30, Math.ceil(timeSpan / bucketSize));
    labelFormat = (date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Create time buckets
  const buckets = [];
  for (let i = 0; i < numBuckets; i++) {
    const bucketStart = now - ((numBuckets - 1 - i) * bucketSize);
    buckets.push({
      timestamp: bucketStart,
      fileChanges: 0,
      aiPrompts: 0,
      codeSize: 0
    });
  }

  // Fill buckets with events
  allEvents.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    const bucketIndex = Math.floor((eventTime - (now - numBuckets * bucketSize)) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < numBuckets) {
      buckets[bucketIndex].fileChanges++;
      
      // Try to get code size
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        if (details.chars_added) buckets[bucketIndex].codeSize += details.chars_added;
        if (details.chars_deleted) buckets[bucketIndex].codeSize += details.chars_deleted;
      } catch (e) {}
    }
  });

  // Fill buckets with prompts
  allPrompts.forEach(prompt => {
    const promptTime = new Date(prompt.timestamp).getTime();
    const bucketIndex = Math.floor((promptTime - (now - numBuckets * bucketSize)) / bucketSize);
    if (bucketIndex >= 0 && bucketIndex < numBuckets) {
      buckets[bucketIndex].aiPrompts++;
    }
  });

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: buckets.map(b => labelFormat(new Date(b.timestamp))),
      datasets: [
        {
          label: 'File Changes',
          data: buckets.map(b => b.fileChanges),
          borderColor: CONFIG.CHART_COLORS.primary,
          backgroundColor: CONFIG.CHART_COLORS.primary + '15',
          tension: 0.3,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4
        },
        {
          label: 'AI Prompts',
          data: buckets.map(b => b.aiPrompts),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          tension: 0.3,
          fill: true,
          borderWidth: 2,
          pointRadius: 1,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 10,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 9 }
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { size: 10 }
          }
        }
      }
    }
  });
}



// ===================================
// File Graph View
// ===================================

// ===================================
// File Graph View (moved to views/file-graph/index.js)
// ===================================
// Removed: function renderFileGraphView - see views/file-graph/index.js


// NOTE: TF-IDF functions (computeTFIDFAnalysis, tokenizeCode, cosineSimilarity) 
// are now in views/file-graph/tfidf-analyzer.js

// NOTE: initializeD3FileGraph is now in views/file-graph/file-graph.js

// Legacy stub for backward compatibility (delegates to extracted module)
async function initializeD3FileGraph() {
  if (window.initializeD3FileGraph) {
    return window.initializeD3FileGraph();
  }
  console.error('[ERROR] views/file-graph/file-graph.js not loaded');
}

// NOTE: renderEmbeddingsVisualization and all embeddings-related functions
// (updatePromptSimilarityPairs, cosineSimilarityVector, applyPCA, applyTSNE, applyMDS, 
// euclideanDistance, renderEmbeddings2D, renderEmbeddings3D) are now in 
// views/file-graph/embeddings-visualization.js

// Legacy stub for backward compatibility
async function renderEmbeddingsVisualization() {
  if (window.renderEmbeddingsVisualization) {
    return window.renderEmbeddingsVisualization();
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
}

function updatePromptSimilarityPairs(prompts, vectors, promptTexts) {
  if (window.updatePromptSimilarityPairs) {
    return window.updatePromptSimilarityPairs(prompts, vectors, promptTexts);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
  return null;
}

function cosineSimilarityVector(a, b) {
  if (window.cosineSimilarityVector) {
    return window.cosineSimilarityVector(a, b);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
  return 0;
}

function applyPCA(vectors, dimensions, numComponents) {
  if (window.applyPCA) {
    return window.applyPCA(vectors, dimensions, numComponents);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
  return [];
}

function applyTSNE(vectors, dimensions, numComponents) {
  if (window.applyTSNE) {
    return window.applyTSNE(vectors, dimensions, numComponents);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
  return [];
}

function applyMDS(vectors, dimensions) {
  if (window.applyMDS) {
    return window.applyMDS(vectors, dimensions);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
  return [];
}

function euclideanDistance(a, b) {
  if (window.euclideanDistance) {
    return window.euclideanDistance(a, b);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
  return 0;
}

function renderEmbeddings2D(container, vectors, labels, metadata) {
  if (window.renderEmbeddings2D) {
    return window.renderEmbeddings2D(container, vectors, labels, metadata);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
}

function renderEmbeddings3D(container, vectors, labels, metadata) {
  if (window.renderEmbeddings3D) {
    return window.renderEmbeddings3D(container, vectors, labels, metadata);
  }
  console.error('[ERROR] views/file-graph/embeddings-visualization.js not loaded');
}

// NOTE: renderD3FileGraph and all D3 rendering functions (clustering, navigation, similar pairs)
// are now in views/file-graph/d3-renderer.js

// Legacy stub for backward compatibility
function renderD3FileGraph(container, nodes, links) {
  if (window.renderD3FileGraph) {
    return window.renderD3FileGraph(container, nodes, links);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

// NOTE: The following functions are now in views/file-graph/d3-renderer.js:
// - applyClustering, kMeansClustering, detectCommunities, calculateModularity
// - forceCluster, convexHull
// - zoomToFit, toggleLabels, filterGraphNodes, focusOnNode
// - renderSimilarFilePairs, updateSimilarPairs, highlightPairInGraph
// - clearGraphHighlights, focusOnPair, highlightSimilarPairs

// Legacy stubs for backward compatibility
function applyClustering(nodes, links, algorithm) {
  if (window.applyClustering) {
    return window.applyClustering(nodes, links, algorithm);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
  return [];
}

function zoomToFit() {
  if (window.zoomToFit) {
    return window.zoomToFit();
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function toggleLabels() {
  if (window.toggleLabels) {
    return window.toggleLabels();
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function filterGraphNodes(searchTerm) {
  if (window.filterGraphNodes) {
    return window.filterGraphNodes(searchTerm);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function focusOnNode(nodeId) {
  if (window.focusOnNode) {
    return window.focusOnNode(nodeId);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function renderSimilarFilePairs(links, files) {
  if (window.renderSimilarFilePairs) {
    return window.renderSimilarFilePairs(links, files);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function updateSimilarPairs() {
  if (window.updateSimilarPairs) {
    return window.updateSimilarPairs();
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function highlightPairInGraph(sourceId, targetId) {
  if (window.highlightPairInGraph) {
    return window.highlightPairInGraph(sourceId, targetId);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function clearGraphHighlights() {
  if (window.clearGraphHighlights) {
    return window.clearGraphHighlights();
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function focusOnPair(sourceId, targetId) {
  if (window.focusOnPair) {
    return window.focusOnPair(sourceId, targetId);
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

function highlightSimilarPairs() {
  if (window.highlightSimilarPairs) {
    return window.highlightSimilarPairs();
  }
  console.error('[ERROR] views/file-graph/d3-renderer.js not loaded');
}

// NOTE: getFileTypeColor, showFileInfo, updateFileGraph, resetFileGraph, resetFileGraphZoom
// are now in views/file-graph/helpers.js

// Legacy stubs for backward compatibility
function getFileTypeColor(ext) {
  if (window.getFileTypeColor) {
    return window.getFileTypeColor(ext);
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
  return '#64748b';
}

// NOTE: All D3 rendering functions (renderD3FileGraph, clustering, navigation, similar pairs)
// are now in views/file-graph/d3-renderer.js - removed duplicate implementations above

// NOTE: getFileTypeColor is now in views/file-graph/helpers.js - removed duplicate above

// ===================================
// Navigator Functions (Latent Space)
// ===================================
// NOTE: All Navigator functions are now in views/navigator/ modules:
// - navigator-core.js: initializeNavigator, navigatorState
// - navigator-layout.js: computePhysicalLayout, computeLatentLayoutUMAP, buildKNN, createFeatureVector, detectLatentClusters
// - navigator-renderer.js: renderNavigator, updateNodePositions, setNavigatorViewMode, animateInterpolation, 
//                          updateInterpolationDisplay, updateTransitionSpeed, renderMiniMap, updateMiniMapViewport,
//                          navigateToMiniMapPosition, updateNavigatorStats, generateSemanticInsights, 
//                          zoomToFitNavigator, resetNavigatorView, toggleNavigatorLabels

// Legacy stubs for backward compatibility (delegate to extracted modules)
async function initializeNavigator() {
  if (window.initializeNavigator) {
    return window.initializeNavigator();
  }
  console.error('[ERROR] views/navigator/navigator-core.js not loaded');
}

function computePhysicalLayout(files) {
  if (window.computePhysicalLayout) {
    return window.computePhysicalLayout(files);
  }
  console.error('[ERROR] views/navigator/navigator-layout.js not loaded');
  return { nodes: files, links: [] };
}

function computeLatentLayoutUMAP(files) {
  if (window.computeLatentLayoutUMAP) {
    return window.computeLatentLayoutUMAP(files);
  }
  console.error('[ERROR] views/navigator/navigator-layout.js not loaded');
  return files;
}

function buildKNN(vectors, k) {
  if (window.buildKNN) {
    return window.buildKNN(vectors, k);
  }
  console.error('[ERROR] views/navigator/navigator-layout.js not loaded');
  return [];
}

function createFeatureVector(file) {
  if (window.createFeatureVector) {
    return window.createFeatureVector(file);
  }
  console.error('[ERROR] views/navigator/navigator-layout.js not loaded');
  return [];
}

function detectLatentClusters(nodes, links) {
  if (window.detectLatentClusters) {
    return window.detectLatentClusters(nodes, links);
  }
  console.error('[ERROR] views/navigator/navigator-layout.js not loaded');
  return [];
}

function renderNavigator(container, nodes, links) {
  if (window.renderNavigator) {
    return window.renderNavigator(container, nodes, links);
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function setNavigatorViewMode(mode) {
  if (window.setNavigatorViewMode) {
    return window.setNavigatorViewMode(mode);
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function animateInterpolation(from, to) {
  if (window.animateInterpolation) {
    return window.animateInterpolation(from, to);
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function updateNodePositions() {
  if (window.updateNodePositions) {
    return window.updateNodePositions();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function updateInterpolationDisplay() {
  if (window.updateInterpolationDisplay) {
    return window.updateInterpolationDisplay();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function updateTransitionSpeed(value) {
  if (window.updateTransitionSpeed) {
    return window.updateTransitionSpeed(value);
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function renderMiniMap() {
  if (window.renderMiniMap) {
    return window.renderMiniMap();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function updateMiniMapViewport() {
  if (window.updateMiniMapViewport) {
    return window.updateMiniMapViewport();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function navigateToMiniMapPosition(x, y) {
  if (window.navigateToMiniMapPosition) {
    return window.navigateToMiniMapPosition(x, y);
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function updateNavigatorStats() {
  if (window.updateNavigatorStats) {
    return window.updateNavigatorStats();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function generateSemanticInsights() {
  if (window.generateSemanticInsights) {
    return window.generateSemanticInsights();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function zoomToFitNavigator() {
  if (window.zoomToFitNavigator) {
    return window.zoomToFitNavigator();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function resetNavigatorView() {
  if (window.resetNavigatorView) {
    return window.resetNavigatorView();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

function toggleNavigatorLabels() {
  if (window.toggleNavigatorLabels) {
    return window.toggleNavigatorLabels();
  }
  console.error('[ERROR] views/navigator/navigator-renderer.js not loaded');
}

// ===================================
// File Similarity via Prompts Analysis
// ===================================
// NOTE: renderFileSimilarityFromPrompts and renderFileSimilarityVisualization
// are still in dashboard.js (could be moved to views/file-graph/ if needed)

function renderFileSimilarityFromPrompts() {
  console.log('[STYLE] Rendering file similarity embeddings based on prompt context...');
  
  // Get all prompts with valid text (filter out JSON/composer conversations)
  const validPrompts = (window.state.data.prompts || []).filter(p => {
    if (!p.text && !p.preview && !p.prompt) return false;
    const text = p.text || p.preview || p.prompt || '';
    if (text.startsWith('{') || text.startsWith('[')) return false;
    if (text.length < 20) return false;
    if (p.source === 'composer' && p.type === 'conversation') return false;
    return true;
  });
  
  console.log(`[DATA] Found ${validPrompts.length} valid prompts for analysis`);
  
  if (validPrompts.length === 0) {
    const container = document.getElementById('embeddingsVisualization');
    if (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: var(--space-xl); text-align: center;">
          <div style="font-size: var(--text-lg); color: var(--color-text); margin-bottom: var(--space-xs); font-weight: 500;">No Data Available</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Prompt data will appear here once you start using Cursor AI</div>
        </div>
      `;
    }
    return;
  }
  
  // Extract file references from prompts
  const filePromptMap = new Map(); // file path -> array of prompts
  
  validPrompts.forEach(prompt => {
    const text = prompt.text || prompt.preview || prompt.prompt || '';
    
    // Extract file paths from prompt text (look for common patterns)
    const filePatterns = [
      /[\w-]+\.(js|ts|py|html|css|json|md|txt|jsx|tsx|vue|svelte)/gi, // File extensions
      /\/[\w\/-]+\.[\w]+/g, // Unix-style paths
      /[\w]+\/[\w\/]+\.(js|ts|py)/g // Relative paths
    ];
    
    const mentionedFiles = new Set();
    filePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(m => mentionedFiles.add(m));
    });
    
    // Also check workspace info if available
    if (prompt.workspaceName && prompt.workspaceName !== 'Unknown') {
      mentionedFiles.forEach(file => {
        const fullPath = `${prompt.workspaceName}/${file}`;
        if (!filePromptMap.has(fullPath)) {
          filePromptMap.set(fullPath, []);
        }
        filePromptMap.get(fullPath).push(prompt);
      });
    }
  });
  
  console.log(`[FILE] Found ${filePromptMap.size} files mentioned in prompts`);
  
  // Build file-to-file similarity based on shared prompt context
  const filesArray = Array.from(filePromptMap.keys());
  const fileSimilarities = [];
  
  for (let i = 0; i < filesArray.length; i++) {
    for (let j = i + 1; j < filesArray.length; j++) {
      const file1 = filesArray[i];
      const file2 = filesArray[j];
      const prompts1 = filePromptMap.get(file1);
      const prompts2 = filePromptMap.get(file2);
      
      // Calculate Jaccard similarity of prompt sets
      const set1 = new Set(prompts1.map(p => p.id || p.timestamp));
      const set2 = new Set(prompts2.map(p => p.id || p.timestamp));
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      if (similarity > 0) {
        fileSimilarities.push({
          file1,
          file2,
          similarity,
          sharedPrompts: intersection.size,
          totalPrompts: union.size
        });
      }
    }
  }
  
  // Sort by similarity
  fileSimilarities.sort((a, b) => b.similarity - a.similarity);
  
  console.log(`[GRAPH] Found ${fileSimilarities.length} file pairs with shared prompt context`);
  
  // Display top similar file pairs
  const similarityPairsContainer = document.getElementById('similarityPairs');
  if (similarityPairsContainer && fileSimilarities.length > 0) {
    const topPairs = fileSimilarities.slice(0, 10);
    const escapeHtml = window.escapeHtml || ((str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    });
    similarityPairsContainer.innerHTML = topPairs.map((pair, idx) => `
      <div style="padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 3px solid ${idx < 3 ? '#10b981' : '#6366f1'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--color-text);">${escapeHtml(pair.file1.split('/').pop())} ↔ ${escapeHtml(pair.file2.split('/').pop())}</span>
          <span style="font-size: 11px; font-weight: 700; color: #10b981;">${(pair.similarity * 100).toFixed(1)}%</span>
        </div>
        <div style="font-size: 11px; color: var(--color-text-muted);">
          ${pair.sharedPrompts} shared prompt${pair.sharedPrompts > 1 ? 's' : ''} • ${pair.totalPrompts} total
        </div>
      </div>
    `).join('');
    
    // Update stats
    const filesCountEl = document.getElementById('embeddingsFilesCount');
    const totalChangesEl = document.getElementById('embeddingsTotalChanges');
    const avgSimilarityEl = document.getElementById('embeddingsAvgSimilarity');
    if (filesCountEl) filesCountEl.textContent = filesArray.length;
    if (totalChangesEl) totalChangesEl.textContent = validPrompts.length;
    if (avgSimilarityEl) {
      const avgSim = fileSimilarities.length > 0 
        ? fileSimilarities.reduce((sum, p) => sum + p.similarity, 0) / fileSimilarities.length 
        : 0;
      avgSimilarityEl.textContent = avgSim.toFixed(3);
    }
  } else if (similarityPairsContainer) {
    similarityPairsContainer.innerHTML = `
      <div style="color: var(--color-text-muted); font-size: 13px;">
        No file relationships found in prompts
      </div>
    `;
  }
  
  // Create 2D visualization of file relationships
  if (filesArray.length > 1) {
    window.renderFileSimilarityVisualization(filesArray, filePromptMap, fileSimilarities);
  }
}

function renderFileSimilarityVisualization(files, filePromptMap, similarities) {
  const container = document.getElementById('embeddingsVisualization');
  if (!container) return;
  
  container.innerHTML = '';
  
  const width = container.clientWidth || 600;
  const height = 300;
  
  // Create nodes
  const nodes = files.map(file => ({
    id: file,
    name: file.split('/').pop(),
    promptCount: filePromptMap.get(file).length
  }));
  
  // Create links from similarities
  const links = similarities
    .filter(s => s.similarity > 0.1) // Only show meaningful connections
    .map(s => ({
      source: s.file1,
      target: s.file2,
      value: s.similarity
    }));
  
  // Create D3 force simulation
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(20));
  
  // Draw links
  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#6366f1')
    .attr('stroke-opacity', d => d.value * 0.8)
    .attr('stroke-width', d => Math.max(1, d.value * 3));
  
  // Draw nodes
  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g');
  
  node.append('circle')
    .attr('r', d => Math.max(4, Math.min(12, Math.sqrt(d.promptCount) * 2)))
    .attr('fill', '#8b5cf6')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5);
  
  node.append('text')
    .text(d => d.name)
    .attr('x', 0)
    .attr('y', -15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '9px')
    .attr('fill', 'var(--color-text)')
    .style('pointer-events', 'none');
  
  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

// Export to window
window.renderFileSimilarityFromPrompts = renderFileSimilarityFromPrompts;
window.renderFileSimilarityVisualization = renderFileSimilarityVisualization;

// ===================================
// Legacy Functions (to be removed)
// ===================================
// NOTE: All duplicate Navigator implementations have been removed.
// They are now in views/navigator/ modules (navigator-core.js, navigator-layout.js, navigator-renderer.js)

// Legacy view rendering functions (kept for backward compatibility but not used)
// NOTE: These functions are no longer used - view rendering is handled by views/ modules
// All duplicate Navigator implementations have been removed - they are in views/navigator/ modules

// NOTE: All duplicate Navigator implementations have been removed.
// They are now in views/navigator/ modules (navigator-core.js, navigator-layout.js, navigator-renderer.js)

// ===================================
// File Similarity via Prompts Analysis (Correct Implementation)
// ===================================
// NOTE: The correct implementation is at line 2992. All duplicate Navigator code has been removed.

// ===================================
// Navigator View (Latent Space)
// ===================================
// NOTE: Navigator functions are now in views/navigator/ modules:
// - navigator-core.js: initializeNavigator, navigatorState
// - navigator-layout.js: computePhysicalLayout, computeLatentLayoutUMAP, buildKNN, createFeatureVector, detectLatentClusters
// - navigator-renderer.js: renderNavigator, setNavigatorViewMode, animateInterpolation, updateNodePositions, etc.

// Legacy stubs for backward compatibility
function showFileInfo(file) {
  if (window.showFileInfo) {
    return window.showFileInfo(file);
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

function updateFileGraph() {
  if (window.updateFileGraph) {
    return window.updateFileGraph();
  }
  console.error('[ERROR] views/file-graph/file-graph.js not loaded');
}

function resetFileGraph() {
  if (window.resetFileGraph) {
    return window.resetFileGraph();
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

function resetFileGraphZoom() {
  if (window.resetFileGraphZoom) {
    return window.resetFileGraphZoom();
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

// ===================================
// File Similarity via Prompts Analysis (Correct Implementation)
// ===================================
// NOTE: The correct implementation is at line 2992. All duplicate Navigator code has been removed.

// ===================================
// Navigator View (Latent Space)
// ===================================
// NOTE: Navigator functions are now in views/navigator/ modules:
// - navigator-core.js: initializeNavigator, navigatorState
// - navigator-layout.js: computePhysicalLayout, computeLatentLayoutUMAP, buildKNN, createFeatureVector, detectLatentClusters
// - navigator-renderer.js: renderNavigator, setNavigatorViewMode, animateInterpolation, updateNodePositions, etc.

// ===================================
// File Similarity via Prompts Analysis (Correct Implementation)
// ===================================
// NOTE: The correct implementation is at line 3037. All duplicate Navigator code has been removed.

// NOTE: renderFileSimilarityFromPrompts is defined at line 1831 and exported to window at line 2055
// All duplicate implementations have been removed

// ===================================
// File Similarity via Prompts Analysis (Correct Implementation)
// ===================================
// NOTE: The correct implementation is at line 3045. All duplicate Navigator code has been removed.

// ===================================
// Navigator View (Latent Space)
// ===================================
// NOTE: Navigator functions are now in views/navigator/ modules:
// - navigator-core.js: initializeNavigator, navigatorState
// - navigator-layout.js: computePhysicalLayout, computeLatentLayoutUMAP, buildKNN, createFeatureVector, detectLatentClusters
// - navigator-renderer.js: renderNavigator, setNavigatorViewMode, animateInterpolation, updateNodePositions, etc.

// Legacy stubs for backward compatibility
function showFileInfo(file) {
  if (window.showFileInfo) {
    return window.showFileInfo(file);
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

function updateFileGraph() {
  if (window.updateFileGraph) {
    return window.updateFileGraph();
  }
  console.error('[ERROR] views/file-graph/file-graph.js not loaded');
}

function resetFileGraph() {
  if (window.resetFileGraph) {
    return window.resetFileGraph();
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

function resetFileGraphZoom() {
  if (window.resetFileGraphZoom) {
    return window.resetFileGraphZoom();
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

// ===================================
// File Similarity via Prompts Analysis (Correct Implementation)
// ===================================
// NOTE: The correct implementation is at line 3126. All duplicate Navigator code has been removed.

// ===================================
// File Similarity via Prompts Analysis (Correct Implementation)
// ===================================
// NOTE: This analyzes FILES based on prompts, not prompts themselves
// The "Prompts Embedding Analysis" section uses the renderEmbeddingsVisualization() function

// NOTE: All duplicate Navigator implementations have been removed.
// They are now in views/navigator/ modules (navigator-core.js, navigator-layout.js, navigator-renderer.js)

// Legacy stubs for backward compatibility
function showFileInfo(file) {
  if (window.showFileInfo) {
    return window.showFileInfo(file);
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

function updateFileGraph() {
  if (window.updateFileGraph) {
    return window.updateFileGraph();
  }
  console.error('[ERROR] views/file-graph/file-graph.js not loaded');
}

function resetFileGraph() {
  if (window.resetFileGraph) {
    return window.resetFileGraph();
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

function resetFileGraphZoom() {
  if (window.resetFileGraphZoom) {
    return window.resetFileGraphZoom();
  }
  console.error('[ERROR] views/file-graph/helpers.js not loaded');
}

// NOTE: renderFileSimilarityFromPrompts is defined at line 1831 and exported to window at line 2055
// All duplicate implementations have been removed

// ===================================
// Navigator View (Latent Space)
// ===================================
// ===================================
// Navigator View (Latent Space)
// ===================================

// ===================================
// Navigator View (moved to views/navigator/index.js)
// ===================================
// Removed: function renderNavigatorView - see views/navigator/index.js

// ===================================
// System View
// ===================================

// ===================================
// System View (moved to views/system/index.js)
// ===================================
// Removed: function renderSystemView - see views/system/index.js


// ===================================
// API Documentation View
// ===================================

// ===================================
// API Docs View (moved to views/api-docs/index.js)
// ===================================
// Removed: function renderAPIDocsView - see views/api-docs/index.js


/**
 * Helper to safely create a chart, destroying any existing instance
 */
function createChart(canvasId, config) {
  // Destroy existing chart if it exists
  if (state.charts[canvasId]) {
    state.charts[canvasId].destroy();
    delete state.charts[canvasId];
  }
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  const ctx = canvas.getContext('2d');
  state.charts[canvasId] = new Chart(ctx, config);
  return state.charts[canvasId];
}

// ===================================
// Modals
// ===================================

// ===================================
// Prompt Relationship Finding
// ===================================
// NOTE: findRelatedPrompts is now in utils/dashboard-helpers.js

// ===================================
// Utility Functions
// ===================================
// NOTE: Utility functions are now in utils/dashboard-helpers.js:
// - truncate, isImageFile, copyToClipboard, filterEventsByWorkspace, filterActivityByTimeRange
// NOTE: escapeHtml is in utils/templates.js

// ===================================
// Status Popup System
// ===================================

// ===================================
// Status Popup
// ===================================
// NOTE: Status popup functions are now in app/status-popup.js

// ===================================
// Export Functions
// ===================================
// NOTE: Export functions are now in app/export-handler.js

// Add fadeOut animation to CSS (dynamically)
const fadeOutStyle = document.createElement('style');
fadeOutStyle.textContent = `
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`;
document.head.appendChild(fadeOutStyle);

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize status popup FIRST (before any console.logs)
  initStatusPopup();
  
  console.log('Initializing Cursor Activity Dashboard');

  // Setup navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      if (view) switchView(view);
    });
  });

  // Setup workspace selector
  document.getElementById('workspaceSelect')?.addEventListener('change', (e) => {
    state.currentWorkspace = e.target.value;
    renderCurrentView();
  });

  // Setup modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      overlay.parentElement.classList.remove('active');
    });
  });

  // Initialize persistent storage and data synchronization
  let storage, aggregator, synchronizer;
  
  try {
    storage = new PersistentStorage();
    aggregator = new AnalyticsAggregator(storage);
    synchronizer = new DataSynchronizer(storage, aggregator);
    
    console.log('Persistence system enabled');
  } catch (error) {
    console.warn('Persistence system not available:', error);
    storage = null;
  }
  
  // Initialize WebSocket (disabled - using HTTP polling instead)
  // Socket.IO is not configured on the companion service
  // const wsManager = new WebSocketManager();
  // wsManager.connect();

  // Use optimized initialization with warm-start
  if (storage && synchronizer) {
    // Initialize persistent storage
    synchronizer.initialize().then(async (stats) => {
      console.log('[DATA] Persistent storage ready:', stats);
      
      // Use new optimized initialization
      state.connected = true;
      updateConnectionStatus(true);
      await (window.initializeDashboard || (() => { console.error('[ERROR] initializeDashboard not available'); }))();
      
      // Initialize search engine after data is loaded (with delay to ensure state is populated)
      setTimeout(() => {
        if (typeof window.initializeSearch === 'function') {
          window.initializeSearch().catch(err => {
            console.warn('[SEARCH] Initial search initialization failed, will retry:', err);
          });
        }
      }, 500);
      
      console.log('[SUCCESS] Dashboard initialized with warm-start');
    }).catch(error => {
      console.error('Persistence initialization failed:', error);
      // Fall back to non-persistent mode
      initializeNonPersistent();
    });
    
    // Setup auto-refresh with debouncing to prevent excessive requests
    let refreshInProgress = false;
    let lastRefreshTime = Date.now();
    const MIN_REFRESH_INTERVAL = CONFIG.REFRESH_INTERVAL; // Match the interval to prevent overlap
    
    setInterval(async () => {
      // Skip if refresh is already in progress or too soon
      if (refreshInProgress || (Date.now() - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
        console.log('[SYNC] Skipping refresh - already in progress or too soon');
        return;
      }
      
      refreshInProgress = true;
      lastRefreshTime = Date.now();
      
      try {
        if (storage && synchronizer) {
          // Use optimized fetch for refresh
          await (window.fetchRecentData || (() => { console.error('[ERROR] fetchRecentData not available'); }))();
          calculateStats();
          renderCurrentView();
          // Update status on successful sync
          if (window.state && window.state.connected) {
            updateConnectionStatus(true, 'Connected - synced');
          }
          // Reinitialize search if we have significantly more data
          if (typeof window.reinitializeSearch === 'function') {
            window.reinitializeSearch().catch(err => {
              console.warn('[SEARCH] Search reinitialization failed:', err);
            });
          }
        }
      } catch (error) {
        console.error('Refresh error:', error);
        // Update status if sync fails
        if (window.state && window.state.connected) {
          updateConnectionStatus(false, 'Sync failed - retrying...');
        }
      } finally {
        refreshInProgress = false;
      }
    }, CONFIG.REFRESH_INTERVAL);
  } else {
    // No persistence - use traditional fetch
    initializeNonPersistent();
  }
  
  // Non-persistent initialization function
  function initializeNonPersistent() {
    (window.initializeDashboard || (() => { console.error('[ERROR] initializeDashboard not available'); return Promise.resolve(); }))().then(() => {
      state.connected = true;
      updateConnectionStatus(true);
      // Initialize search engine after data is loaded
      setTimeout(() => {
        if (typeof window.initializeSearch === 'function') {
          window.initializeSearch().catch(err => {
            console.warn('[SEARCH] Initial search initialization failed:', err);
          });
        }
      }, 500);
    }).catch(error => {
      console.error('Initial data fetch failed:', error);
      updateConnectionStatus(false);
      // Fallback to old method
      (window.fetchAllData || (() => { console.error('[ERROR] fetchAllData not available'); return Promise.resolve(); }))().then(() => {
        renderCurrentView();
        setTimeout(() => {
          if (typeof window.initializeSearch === 'function') {
            window.initializeSearch().catch(err => {
              console.warn('[SEARCH] Search initialization failed:', err);
            });
          }
        }, 500);
      });
    });
    
    // Setup auto-refresh with debouncing
    let refreshInProgress = false;
    let lastRefreshTime = Date.now();
    const MIN_REFRESH_INTERVAL = CONFIG.REFRESH_INTERVAL; // Match the interval to prevent overlap
    
    setInterval(async () => {
      if (refreshInProgress || (Date.now() - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
        console.log('[SYNC] Skipping refresh - already in progress or too soon');
        return;
      }
      
      refreshInProgress = true;
      lastRefreshTime = Date.now();
      
      try {
        await (window.fetchRecentData || (() => { console.error('[ERROR] fetchRecentData not available'); }))();
        calculateStats();
        renderCurrentView();
        // Update status on successful sync
        if (window.state && window.state.connected) {
          updateConnectionStatus(true, 'Connected - synced');
        }
      } catch (error) {
        console.error('Refresh error:', error);
        // Update status if sync fails
        if (window.state && window.state.connected) {
          updateConnectionStatus(false, 'Sync failed - retrying...');
        }
      } finally {
        refreshInProgress = false;
      }
    }, CONFIG.REFRESH_INTERVAL);
  }

  // Setup search palette keyboard shortcuts and event listeners
  document.addEventListener('keydown', (e) => {
    // CMD+K or CTRL+K to open search
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearchPalette();
    }
    
    // ESC to close search
    if (e.key === 'Escape') {
      const palette = document.getElementById('searchPalette');
      if (palette && palette.classList.contains('active')) {
        closeSearchPalette();
      }
    }
    
    // Arrow keys for navigation
    const palette = document.getElementById('searchPalette');
    if (palette && palette.classList.contains('active')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSearchResults('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSearchResults('up');
      } else if (e.key === 'Enter' && searchSelectedIndex >= 0) {
        e.preventDefault();
        selectSearchResult(searchSelectedIndex);
      }
    }
  });
  
  // Setup search input with debouncing and example visibility
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    let debounceTimeout;
    searchInput.addEventListener('input', (e) => {
      // Update examples visibility
      if (window.updateSearchExamples) {
        window.updateSearchExamples();
      }
      
      // Debounce search
      clearTimeout(debounceTimeout);
      const query = e.target.value.trim();
      if (query.length > 0) {
        debounceTimeout = setTimeout(() => {
          if (window.performSearch) {
            window.performSearch(query);
          }
        }, 300); // 300ms debounce
      } else {
        // Show examples when empty
        if (window.updateSearchExamples) {
          window.updateSearchExamples();
        }
      }
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query && window.performSearch) {
          window.performSearch(query);
        }
      } else if (e.key === 'Escape') {
        if (window.closeSearchPalette) {
          window.closeSearchPalette();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (window.navigateSearchResults) {
          window.navigateSearchResults(e.key === 'ArrowDown' ? 'down' : 'up');
        }
      }
    });
  }
  
  // Setup search trigger button
  const searchTrigger = document.getElementById('searchTrigger');
  if (searchTrigger) {
    searchTrigger.addEventListener('click', () => {
      openSearchPalette();
    });
  }
  
  // Close search when clicking overlay
  const searchPalette = document.getElementById('searchPalette');
  if (searchPalette) {
    const overlay = searchPalette.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        closeSearchPalette();
      });
    }
  }
  
  console.log('Dashboard initialized');
});

// ===================================
// Search Engine
// ===================================
// NOTE: Search functions are now in app/search-handler.js

// ===================================
// Prompt Management
// ===================================
// NOTE: refreshPrompts and checkClipboardStatus are now in app/ui-helpers.js