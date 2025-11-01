/**
 * Timeline rendering helper functions
 */

function renderActivityTimeline(events) {
  return `
    <div class="timeline">
      ${events.map(event => renderTimelineItem(event)).join('')}
    </div>
  `;
}

function renderUnifiedTimeline(items) {
  const conversationMap = new Map();
  const nonPromptItems = [];
  
  items.forEach(item => {
    if (item.itemType === 'prompt') {
      const isThread = item.type === 'conversation-thread' && !item.parentConversationId;
      const conversationId = isThread ? item.composerId : (item.parentConversationId || item.composerId);
      
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
      nonPromptItems.push(item);
    }
  });
  
  const conversationItems = Array.from(conversationMap.values()).map(conv => ({
    itemType: 'conversation',
    conversation: conv,
    sortTime: conv.timestamp
  }));
  
  const allItems = [...conversationItems, ...nonPromptItems]
    .sort((a, b) => b.sortTime - a.sortTime);
  
  return `
    <div class="timeline">
      ${allItems.map(item => {
        if (item.itemType === 'event') {
          return renderTimelineItem(item);
        } else if (item.itemType === 'terminal') {
          return renderTerminalTimelineItem(item);
        } else if (item.itemType === 'conversation') {
          return renderConversationThread(item.conversation);
        } else {
          return renderPromptTimelineItem(item);
        }
      }).join('')}
    </div>
  `;
}

function renderConversationThread(conversation) {
  const { thread, messages } = conversation;
  const title = thread?.conversationTitle || thread?.text || 'Untitled Conversation';
  const time = window.formatTimeAgo(thread?.timestamp || conversation.timestamp);
  const messageCount = messages.length;
  const threadId = thread?.composerId || `conv-${Date.now()}`;
  
  const sortedMessages = messages.sort((a, b) => a.sortTime - b.sortTime);
  
  return `
    <div class="timeline-item conversation-timeline-item">
      <div class="timeline-content">
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
        
        <div id="conv-messages-${threadId}" class="conversation-messages">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => renderConversationMessage(msg)).join('') : '<div class="conversation-empty">No messages in this conversation yet</div>'}
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

function renderPromptTimelineItem(prompt) {
  const time = window.formatTimeAgo(prompt.timestamp);
  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
  const displayText = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
  const isJsonLike = promptText.startsWith('{') || promptText.startsWith('[');
  
  if (isJsonLike && promptText.length > 200) {
    return '';
  }
  
  const source = prompt.source || 'cursor';
  
  return `
    <div class="timeline-item prompt-timeline-item" onclick="showEventModal('${prompt.id}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span></span>
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

function renderTerminalTimelineItem(cmd) {
  const time = window.formatTimeAgo(cmd.timestamp);
  const commandText = cmd.command || 'Unknown command';
  const displayText = commandText.length > 80 ? commandText.substring(0, 80) + '...' : commandText;
  const isError = cmd.exit_code && cmd.exit_code !== 0;
  const icon = isError ? '[ERROR]' : '>';
  const source = cmd.source || 'terminal';
  
  return `
    <div class="timeline-item terminal-timeline-item ${isError ? 'error' : ''}" style="border-left-color: ${isError ? '#ef4444' : '#8b5cf6'};" onclick="showTerminalModal('${cmd.id}')">
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

function renderTimelineItem(event) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const title = getEventTitle(event);
  const desc = getEventDescription(event);
  
  let promptBadge = '';
  let contextIndicators = '';
  
  try {
    if (window.state.data.prompts && window.state.data.prompts.length > 0 && 
        (event.type === 'file_change' || event.type === 'code_change')) {
      const eventTime = new Date(event.timestamp).getTime();
      const recentPromptCount = window.state.data.prompts.filter(p => {
        const promptTime = new Date(p.timestamp).getTime();
        return promptTime > 0 && (eventTime - promptTime) >= 0 && (eventTime - promptTime) <= 300000;
      }).length;
      
      if (recentPromptCount > 0) {
        promptBadge = `<span class="context-indicator ai" title="Has related AI prompts">AI</span>`;
      }
    }
    
    if (event.context) {
      const badges = [];
      
      if (event.context.atFiles && event.context.atFiles.length > 0) {
        badges.push(`<span class="context-indicator files" title="${event.context.atFiles.length} @ referenced files">[FILE] ${event.context.atFiles.length}</span>`);
      }
      
      const contextFileCount = (event.context.contextFiles?.attachedFiles?.length || 0) + 
                               (event.context.contextFiles?.codebaseFiles?.length || 0);
      if (contextFileCount > 0) {
        badges.push(`<span class="context-indicator context-files" title="${contextFileCount} context files">${contextFileCount} files</span>`);
      }
      
      if (event.context.browserState && event.context.browserState.tabs && event.context.browserState.tabs.length > 0) {
        badges.push(`<span class="context-indicator system" title="${event.context.browserState.tabs.length} tabs open">[SYSTEM] ${event.context.browserState.tabs.length}</span>`);
      }
      
      contextIndicators = badges.join('');
    }
  } catch (e) {
    // Ignore errors in badge display
  }
  
  return `
    <div class="timeline-item" onclick="showEventModal('${event.id || event.timestamp}')">
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
      
      if (/^[a-f0-9]{40}$/i.test(path)) {
        return 'Git object change';
      }
      
      const fileName = path.split('/').pop() || '';
      
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

// Export to window for global access
window.renderActivityTimeline = renderActivityTimeline;
window.renderUnifiedTimeline = renderUnifiedTimeline;
window.renderConversationThread = renderConversationThread;
window.renderConversationMessage = renderConversationMessage;
window.toggleConversationMessages = toggleConversationMessages;
window.renderPromptTimelineItem = renderPromptTimelineItem;
window.renderTerminalTimelineItem = renderTerminalTimelineItem;
window.renderTimelineItem = renderTimelineItem;
window.getEventTitle = getEventTitle;
window.getEventDescription = getEventDescription;

