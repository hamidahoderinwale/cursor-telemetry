/**
 * Timeline rendering helper functions
 * All HTML template functions for timeline rendering
 */

/**
 * Group items into temporal threads/sessions based on time proximity
 */
function groupIntoTemporalThreads(items, timeWindowMs = 15 * 60 * 1000) {
  if (items.length === 0) return [];
  
  // Filter out items with invalid timestamps first
  const validItems = items.filter(item => {
    return item.sortTime && !isNaN(item.sortTime) && isFinite(item.sortTime);
  });
  
  if (validItems.length === 0) {
    // If no valid items, return items as-is (don't group)
    return items.map(item => ({
      id: `single-${item.id || Date.now()}-${Math.random()}`,
      items: [item],
      startTime: item.sortTime || Date.now(),
      lastItemTime: item.sortTime || Date.now(),
      endTime: item.sortTime || Date.now(),
      itemType: 'temporal-thread'
    }));
  }
  
  // Sort items by time (newest first for display, but we'll process chronologically)
  const sorted = [...validItems].sort((a, b) => {
    const aTime = a.sortTime || 0;
    const bTime = b.sortTime || 0;
    return bTime - aTime;
  });
  
  const threads = [];
  let currentThread = null;
  
  // Process from oldest to newest to build threads
  const chronological = [...sorted].reverse();
  
  chronological.forEach(item => {
    const itemTime = item.sortTime || Date.now();
    
    if (!currentThread || (itemTime - currentThread.lastItemTime) > timeWindowMs) {
      // Start a new thread
      if (currentThread) {
        threads.push(currentThread);
      }
      currentThread = {
        id: `thread-${itemTime}-${Math.random().toString(36).substr(2, 9)}`,
        items: [item],
        startTime: itemTime,
        lastItemTime: itemTime,
        endTime: itemTime,
        itemType: 'temporal-thread'
      };
    } else {
      // Add to current thread
      currentThread.items.push(item);
      currentThread.lastItemTime = itemTime;
      currentThread.endTime = itemTime;
    }
  });
  
  // Add final thread
  if (currentThread) {
    threads.push(currentThread);
  }
  
  // Convert back to reverse chronological for display
  return threads.reverse();
}

/**
 * Render unified timeline with alternating layout (events left, prompts right)
 */
function renderUnifiedTimeline(items) {
  // First: Group prompts by conversation for threading
  const conversationMap = new Map();
  const standalonePrompts = [];
  const nonPromptItems = [];
  
  items.forEach(item => {
    if (item.itemType === 'prompt') {
      // Check if this is a conversation thread or a message
      const isThread = item.type === 'conversation-thread' && !item.parentConversationId;
      const conversationId = isThread ? item.composerId : (item.parentConversationId || item.composerId);
      
      // Only group prompts that are part of conversations
      // Standalone prompts (no conversationId) should be rendered individually
      if (conversationId) {
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            thread: isThread ? item : null,
            messages: [],
            timestamp: item.sortTime
          });
        }
        
        const conv = conversationMap.get(conversationId);
        if (isThread) {
          conv.thread = item;
        } else {
          conv.messages.push(item);
        }
        conv.timestamp = Math.max(conv.timestamp, item.sortTime);
      } else {
        // This is a standalone prompt, not part of a conversation
        standalonePrompts.push(item);
      }
    } else {
      nonPromptItems.push(item);
    }
  });
  
  // Convert conversations to timeline items
  const conversationItems = Array.from(conversationMap.values()).map(conv => ({
    itemType: 'conversation',
    conversation: conv,
    sortTime: conv.timestamp
  }));
  
  // Merge all items (conversations, standalone prompts, and other items)
  const allItems = [...conversationItems, ...standalonePrompts, ...nonPromptItems]
    .sort((a, b) => {
      const aTime = a.sortTime || 0;
      const bTime = b.sortTime || 0;
      return bTime - aTime;
    });
  
  // Apply temporal threading to group items by time windows
  const temporalThreads = groupIntoTemporalThreads(allItems, 15 * 60 * 1000); // 15 minute window
  
  return `
    <div class="timeline-alternating">
      <div class="timeline-axis"></div>
      ${temporalThreads.map(thread => {
        // If thread has only one item, render it with appropriate side
        if (thread.items.length === 1) {
          const item = thread.items[0];
          if (item.itemType === 'event') {
            return window.renderTimelineItem(item, 'left');
          } else if (item.itemType === 'terminal') {
            return window.renderTerminalTimelineItem(item, 'left');
          } else if (item.itemType === 'conversation') {
            return window.renderConversationThread(item.conversation, 'right');
          } else if (item.itemType === 'prompt') {
            return window.renderPromptTimelineItem(item, 'right');
          }
          return '';
        }
        
        // Multiple items: render as a temporal thread/session with mixed content
        return window.renderTemporalThread(thread);
      }).join('')}
    </div>
  `;
}

function renderConversationThread(conversation, side = 'right') {
  const { thread, messages } = conversation;
  
  // Build a better title from available properties
  let title = 'Untitled Conversation';
  
  // Try multiple sources for title
  if (thread?.conversationTitle) {
    title = thread.conversationTitle;
  } else if (thread?.text) {
    // Use thread text if it's not too long
    const threadText = thread.text || '';
    title = threadText.length > 80 ? threadText.substring(0, 80) + '...' : threadText;
  } else if (messages.length > 0) {
    // Use first user message text as title
    const firstUserMessage = messages.find(m => m.messageRole === 'user' || m.text);
    if (firstUserMessage?.text) {
      const msgText = firstUserMessage.text;
      title = msgText.length > 80 ? msgText.substring(0, 80) + '...' : msgText;
    }
  } else if (thread?.composerId) {
    // Fallback to composer ID if available
    title = `Conversation ${thread.composerId.substring(0, 8)}`;
  }
  
  const time = window.formatTimeAgo(thread?.timestamp || conversation.timestamp);
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
            <span class="timeline-title-text">${window.escapeHtml(title)}</span>
            ${messageCount > 0 ? `<span class="timeline-title-meta">(${messageCount} messages)</span>` : ''}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">Conversation</span>
          ${thread?.workspaceName ? `<span class="badge">${window.escapeHtml(thread.workspaceName)}</span>` : ''}
          ${thread?.mode ? `<span class="badge" style="background: var(--color-primary); color: white;">${window.escapeHtml(thread.mode)}</span>` : ''}
        </div>
        
        <!-- Messages (initially hidden) -->
        <div id="conv-messages-${threadId}" class="conversation-messages">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => window.renderConversationMessage(msg)).join('') : '<div class="conversation-empty">No messages in this conversation yet</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderConversationMessage(message) {
  const isUser = message.messageRole === 'user';
  const time = window.formatTimeAgo(message.timestamp);
  const text = message.text || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  return `
    <div class="conversation-message ${isUser ? 'user' : 'ai'}">
      <div class="conversation-message-header">
        <span class="conversation-message-icon"></span>
        <span class="conversation-message-author">${isUser ? 'You' : 'AI Assistant'}</span>
        <span class="conversation-message-time">${time}</span>
        ${message.thinkingTimeSeconds ? `<span class="badge" style="background: var(--color-success); color: white;">Thinking ${message.thinkingTimeSeconds}s</span>` : ''}
      </div>
      <div class="conversation-message-content">${window.escapeHtml(displayText)}</div>
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

function renderPromptTimelineItem(prompt, side = 'right') {
  // Use sortTime if available (processed timestamp), otherwise fall back to timestamp
  const timestamp = prompt.sortTime && !isNaN(prompt.sortTime) ? prompt.sortTime : 
                    (prompt.timestamp ? new Date(prompt.timestamp).getTime() : Date.now());
  const time = window.formatTimeAgo(timestamp);
  
  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
  const displayText = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
  const isJsonLike = promptText.startsWith('{') || promptText.startsWith('[');
  
  // Skip JSON metadata entries
  if (isJsonLike && promptText.length > 200) {
    return '';
  }
  
  const icon = isJsonLike ? '' : '';
  const source = prompt.source || 'cursor';
  
  return `
    <div class="timeline-item timeline-item-${side} prompt-timeline-item" onclick="showEventModal('${prompt.id}')">
      <div class="timeline-content prompt-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span>${icon}</span>
            <span>${window.escapeHtml(displayText)}</span>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">${window.escapeHtml(source)}</span>
          ${prompt.workspaceName ? `<span class="badge">${window.escapeHtml(prompt.workspaceName)}</span>` : prompt.workspaceId ? `<span class="badge">${window.escapeHtml(prompt.workspaceId.substring(0, 8))}</span>` : ''}
          ${prompt.composerId ? `<span class="badge">Composer</span>` : ''}
          ${prompt.contextUsage > 0 ? `<span class="badge" style="background: var(--color-warning); color: white;">${prompt.contextUsage.toFixed(1)}% context</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a temporal thread/session containing multiple events within a time window
 */
function renderTemporalThread(thread) {
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
          <div class="timeline-meta">${window.formatTimeAgo(thread.startTime)}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">${timeRange}</span>
          <span class="badge">${summary}</span>
        </div>
        
        <!-- Thread items (initially hidden) -->
        <div id="thread-items-${threadId}" class="temporal-thread-items">
          ${sortedItems.map(item => {
            if (item.itemType === 'event') {
              return window.renderTimelineItem(item, 'left');
            } else if (item.itemType === 'terminal') {
              return window.renderTerminalTimelineItem(item, 'left');
            } else if (item.itemType === 'conversation') {
              return window.renderConversationThread(item.conversation, 'right');
            } else if (item.itemType === 'prompt') {
              return window.renderPromptTimelineItem(item, 'right');
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

function renderTerminalTimelineItem(cmd, side = 'left') {
  const time = window.formatTimeAgo(cmd.timestamp);
  const commandText = cmd.command || 'Unknown command';
  const displayText = commandText.length > 80 ? commandText.substring(0, 80) + '...' : commandText;
  const isError = cmd.exit_code && cmd.exit_code !== 0;
  const icon = isError ? '[ERROR]' : '>';
  const source = cmd.source || 'terminal';
  
  return `
    <div class="timeline-item timeline-item-${side} terminal-timeline-item event-content ${isError ? 'error' : ''}" style="border-left-color: ${isError ? '#ef4444' : '#8b5cf6'};" onclick="showTerminalModal('${cmd.id}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span>${icon}</span>
            <code class="terminal-command-code">${window.escapeHtml(displayText)}</code>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge" style="background: #6366f1; color: white;">${window.escapeHtml(source)}</span>
          ${cmd.shell ? `<span class="badge">${window.escapeHtml(cmd.shell)}</span>` : ''}
          ${cmd.workspace ? `<span class="badge" style="font-size: 11px;">${window.escapeHtml(cmd.workspace.split('/').pop())}</span>` : ''}
          ${isError ? `<span class="badge" style="background: #ef4444; color: white;">Exit ${cmd.exit_code}</span>` : ''}
          ${cmd.duration ? `<span class="badge">${cmd.duration}ms</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderTimelineItem(event, side = 'left') {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const title = window.getEventTitle(event);
  const desc = window.getEventDescription(event);
  
  // Quick check for related prompts (will do full search in modal)
  let promptBadge = '';
  let contextIndicators = '';
  
  try {
    if (window.state.data.prompts && window.state.data.prompts.length > 0 && 
        (event.type === 'file_change' || event.type === 'code_change')) {
      const eventTime = new Date(event.timestamp).getTime();
      const recentPromptCount = window.state.data.prompts.filter(p => {
        const promptTime = new Date(p.timestamp).getTime();
        return promptTime > 0 && (eventTime - promptTime) >= 0 && (eventTime - promptTime) <= 300000; // 5 min
      }).length;
      
      if (recentPromptCount > 0) {
        promptBadge = `<span class="context-indicator ai" title="Has related AI prompts">AI</span>`;
      }
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

function renderActivityTimeline(events) {
  // Simple timeline for Overview view (not alternating layout)
  return `
    <div class="timeline-simple">
      ${events.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const title = window.getEventTitle(event);
        const desc = window.getEventDescription(event);
        
        return `
          <div class="timeline-simple-item" onclick="showEventModal('${event.id || event.timestamp}')">
            <div class="timeline-simple-content">
              <div class="timeline-simple-header">
                <div class="timeline-simple-title">${window.escapeHtml(title)}</div>
                <div class="timeline-simple-meta">${time}</div>
              </div>
              <div class="timeline-simple-description">${window.escapeHtml(desc)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Export to window for global access
window.groupIntoTemporalThreads = groupIntoTemporalThreads;
window.renderUnifiedTimeline = renderUnifiedTimeline;
window.renderActivityTimeline = renderActivityTimeline;
window.renderConversationThread = renderConversationThread;
window.renderConversationMessage = renderConversationMessage;
window.toggleConversationMessages = toggleConversationMessages;
window.renderPromptTimelineItem = renderPromptTimelineItem;
window.renderTerminalTimelineItem = renderTerminalTimelineItem;
window.renderTimelineItem = renderTimelineItem;
window.renderTemporalThread = renderTemporalThread;
window.toggleTemporalThread = toggleTemporalThread;
window.getEventTitle = getEventTitle;
window.getEventDescription = getEventDescription;
