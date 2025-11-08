/**
 * UI Helpers Module
 * UI update functions for stats, workspace selector, and view switching
 */

/**
 * Update stats display in the header
 */
function updateStatsDisplay() {
  // Defensive checks for DOM elements
  const statSessions = document.getElementById('statSessions');
  const statFileChanges = document.getElementById('statFileChanges');
  const statAIInteractions = document.getElementById('statAIInteractions');
  const statCodeChanged = document.getElementById('statCodeChanged');
  const statAvgContext = document.getElementById('statAvgContext');
  
  if (statSessions) statSessions.textContent = window.state.stats.sessions || 0;
  if (statFileChanges) statFileChanges.textContent = window.state.stats.fileChanges || 0;
  if (statAIInteractions) statAIInteractions.textContent = window.state.stats.aiInteractions || 0;
  if (statCodeChanged) statCodeChanged.textContent = `${window.state.stats.codeChanged || 0} KB`;
  if (statAvgContext) statAvgContext.textContent = `${window.state.stats.avgContext || 0}%`;
  
  console.log('[STATS] Updated display:', window.state.stats);
}

/**
 * Update workspace selector dropdown
 */
function updateWorkspaceSelector() {
  const select = document.getElementById('workspaceSelect');
  if (!select) return;

  // Clear existing options except "All"
  select.innerHTML = '<option value="all">All Workspaces</option>';

  // Add workspace options
  window.state.data.workspaces.forEach(ws => {
    const option = document.createElement('option');
    option.value = ws.path;
    option.textContent = ws.path.split('/').pop() || ws.path;
    select.appendChild(option);
  });

  select.value = window.state.currentWorkspace;
}

/**
 * Switch to a different view
 */
function switchView(viewName) {
  window.state.currentView = viewName;
  
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.view === viewName) {
      link.classList.add('active');
    }
  });

  if (window.renderCurrentView) {
    window.renderCurrentView();
  }
}

/**
 * Render system status
 */
function renderSystemStatus() {
  const latest = window.state.data.systemResources?.[window.state.data.systemResources.length - 1];
  if (!latest) {
    return '<div class="empty-state-text">No system data available</div>';
  }

  const memory = latest.memory ? `${(latest.memory.heapUsed / 1024 / 1024).toFixed(1)} MB` : 'N/A';
  const cpu = latest.cpu ? `${((latest.cpu.user + latest.cpu.system) / 1000000).toFixed(1)}s` : 'N/A';
  const load = latest.system?.loadAverage?.[0]?.toFixed(2) || 'N/A';

  return `
    <div class="system-status-list">
      <div class="system-status-item">
        <span class="system-status-label">Memory</span>
        <span class="system-status-value">${memory}</span>
      </div>
      <div class="system-status-item">
        <span class="system-status-label">CPU Time</span>
        <span class="system-status-value">${cpu}</span>
      </div>
      <div class="system-status-item">
        <span class="system-status-label">Load Avg</span>
        <span class="system-status-value">${load}</span>
      </div>
    </div>
  `;
}

/**
 * Render workspaces list
 */
function renderWorkspacesList() {
  if (!window.state.data.workspaces || window.state.data.workspaces.length === 0) {
    return '<div class="empty-state-text">No workspaces detected</div>';
  }

  return `
    <div class="workspaces-list">
      ${window.state.data.workspaces.map(ws => `
        <div class="workspace-item">
          <div class="workspace-item-title">
            <span class="workspace-item-title-text">${window.escapeHtml?.(ws.path.split('/').pop() || ws.path) || (ws.path.split('/').pop() || ws.path)}</span>
            <div class="workspace-item-title-fade"></div>
          </div>
          <div class="workspace-item-meta">
            <span>${ws.entries || 0} entries</span>
            <span>${ws.events || 0} events</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render empty state for prompts
 */
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

/**
 * Get status icon for prompt status
 */
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

/**
 * Refresh prompts from API
 */
async function refreshPrompts() {
  console.log('Refreshing prompts...');
  try {
    const response = await window.APIClient.get('/entries');
    if (response && response.entries && Array.isArray(response.entries)) {
      window.state.data.prompts = response.entries;
    } else if (Array.isArray(response)) {
      window.state.data.prompts = response;
    } else {
      console.warn('Invalid prompts response format:', response);
      window.state.data.prompts = [];
    }
    if (window.renderCurrentView) {
      window.renderCurrentView();
    }
  } catch (error) {
    console.error('Error refreshing prompts:', error);
    window.state.data.prompts = [];
  }
}

/**
 * Check clipboard monitoring status
 */
async function checkClipboardStatus() {
  try {
    const health = await window.APIClient.get('/health');
    const clipboardEnabled = health.clipboard_stats?.enabled || false;
    const capturedCount = health.clipboard_stats?.captured || 0;

    alert(
      `Clipboard Monitoring Status\n\n` +
      `Enabled: ${clipboardEnabled ? 'Yes' : 'No'}\n` +
      `Prompts Captured: ${capturedCount}\n\n` +
      `Check the companion service logs for more details.`
    );
  } catch (error) {
    console.error('Error checking clipboard status:', error);
    alert('Could not check clipboard status. Make sure the companion service is running.');
  }
}

// Export functions to window for global access
window.updateStatsDisplay = updateStatsDisplay;
window.updateWorkspaceSelector = updateWorkspaceSelector;
window.switchView = switchView;
window.renderSystemStatus = renderSystemStatus;
window.renderWorkspacesList = renderWorkspacesList;
window.renderPromptEmptyState = renderPromptEmptyState;
window.getPromptStatusIcon = getPromptStatusIcon;
window.refreshPrompts = refreshPrompts;
window.checkClipboardStatus = checkClipboardStatus;

