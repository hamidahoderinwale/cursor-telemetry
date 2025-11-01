/**
 * Threads View
 */

function renderThreadsView(container) {
  const entries = window.state?.data?.entries || [];
  const threads = window.groupIntoThreads ? window.groupIntoThreads(entries) : [];
  const prompts = window.state?.data?.prompts || [];
  
  container.innerHTML = `
    <div class="threads-view">
      
      <!-- Captured Prompts Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Captured Prompts</h3>
            <p class="card-subtitle">Prompts captured from clipboard and manual entry</p>
          </div>
          <div class="thread-header-controls">
            <span class="thread-badge">[CLIPBOARD] ${prompts.length} captured</span>
            <button class="btn btn-sm" onclick="refreshPrompts()">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div class="card-body">
          ${prompts.length > 0 ? renderPromptsList(prompts) : renderPromptEmptyState()}
        </div>
      </div>

      <!-- Conversation Threads Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Conversation Threads</h3>
            <p class="card-subtitle">AI conversations grouped by session</p>
          </div>
          <div class="thread-badge">${threads.length} threads</div>
        </div>
        <div class="card-body">
          ${threads.length > 0 ? renderThreadsList(threads) : '<div class="empty-state"><div class="empty-state-text">No conversation threads</div><div class="empty-state-hint">Threads will appear as you interact with AI</div></div>'}
        </div>
      </div>

    </div>
  `;
}

function renderPromptsList(prompts) {
  const sortedPrompts = [...prompts].sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  return `
    <div class="prompt-list">
      ${sortedPrompts.map(prompt => {
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

// Export to window for global access
window.renderThreadsView = renderThreadsView;
window.renderPromptsList = renderPromptsList;
window.renderPromptEmptyState = renderPromptEmptyState;
window.getPromptStatusIcon = getPromptStatusIcon;
window.renderThreadsList = renderThreadsList;

