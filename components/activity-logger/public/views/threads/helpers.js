/**
 * Threads View Helper Functions
 * HTML template functions for Threads view components
 */

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
        const displayText = promptText ? window.truncate(promptText, 150) : 'Empty prompt';
        const source = prompt.source || prompt.method || 'unknown';
        const status = prompt.status || 'captured';
        
        return `
          <div class="prompt-card" onclick="showPromptModal('${prompt.id}')">
            <div class="prompt-header">
              <div class="prompt-status ${status}">
                ${getPromptStatusIcon(status)}
                ${window.escapeHtml(status)}
              </div>
              <div class="prompt-time">${window.formatTimeAgo(prompt.timestamp)}</div>
            </div>
            <div class="prompt-content">
              ${window.escapeHtml(displayText)}
            </div>
            <div class="prompt-meta">
              ${prompt.linked_entry_id ? '<span class="prompt-tag">Linked</span>' : '<span class="prompt-tag pending">Pending</span>'}
              <span class="prompt-tag">${window.escapeHtml(source)}</span>
              ${prompt.workspaceName ? `<span class="prompt-tag">[FILE] ${window.escapeHtml(prompt.workspaceName)}</span>` : prompt.workspaceId ? `<span class="prompt-tag">[FILE] ${window.escapeHtml(prompt.workspaceId.substring(0, 8))}...</span>` : ''}
              ${prompt.metadata?.complexity ? `<span class="prompt-tag">Complexity: ${window.escapeHtml(prompt.metadata.complexity)}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderPromptEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-text">No prompts captured yet</div>
      <div class="empty-state-hint">
        Prompts will appear here when you:
        <ul style="margin-top: var(--space-md); text-align: left; display: inline-block;">
          <li>Copy text to clipboard (if enabled)</li>
          <li>Use AI features in Cursor</li>
          <li>Send prompts through MCP</li>
        </ul>
      </div>
      <button class="btn" style="margin-top: var(--space-lg);" onclick="checkClipboardStatus()">
        Check Clipboard Status
      </button>
    </div>
  `;
}

function getPromptStatusIcon(status) {
  const icons = {
    'captured': '[OK]',
    'pending': '[PENDING]',
    'linked': '[LINKED]',
    'processed': '[DONE]',
    'failed': '[FAILED]'
  };
  return icons[status] || '[NOTE]';
}

function renderThreadsList(threads) {
  return `
    <div class="thread-list">
      ${threads.map(thread => `
        <div class="thread-card" onclick="showThreadModal('${thread.id}')">
          <div class="thread-card-header">
            <div>
              <div class="thread-card-title">${window.escapeHtml(window.truncate(thread.messages[0]?.prompt || thread.messages[0]?.text || 'Conversation Thread', 60))}</div>
              <div class="thread-card-meta">
                <span>${thread.messages.length} messages</span>
                <span>${new Date(thread.lastMessage).toLocaleDateString()}</span>
              </div>
            </div>
            <div class="thread-card-badge">${window.escapeHtml(thread.id.substring(0, 8))}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

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

// Export to window for global access
window.renderPromptsList = renderPromptsList;
window.renderPromptEmptyState = renderPromptEmptyState;
window.getPromptStatusIcon = getPromptStatusIcon;
window.renderThreadsList = renderThreadsList;
window.groupIntoThreads = groupIntoThreads;

