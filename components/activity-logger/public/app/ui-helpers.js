/**
 * UI Helpers Module
 * UI update functions for stats, workspace selector, and view switching
 */

/**
 * Update stats display in the header
 */
function updateStatsDisplay() {
  // Defensive checks for DOM elements
  const statWorkspaces = document.getElementById('statWorkspaces');
  const statSessions = document.getElementById('statSessions');
  const statFileChanges = document.getElementById('statFileChanges');
  const statAIInteractions = document.getElementById('statAIInteractions');
  const statCodeChanged = document.getElementById('statCodeChanged');
  const statAvgContext = document.getElementById('statAvgContext');
  const statLanguages = document.getElementById('statLanguages');
  const statActiveWorkspace = document.getElementById('statActiveWorkspace');
  const statActivitiesToday = document.getElementById('statActivitiesToday');
  const statActivitiesTodayBreakdown = document.getElementById('statActivitiesTodayBreakdown');
  
  // Update workspace count
  const workspaceCount = window.state.stats.workspaces || 
                        (window.state.data?.workspaces?.length || 0);
  if (statWorkspaces) statWorkspaces.textContent = workspaceCount;
  
  if (statSessions) statSessions.textContent = window.state.stats.sessions || 0;
  if (statFileChanges) statFileChanges.textContent = window.state.stats.fileChanges || 0;
  if (statAIInteractions) statAIInteractions.textContent = window.state.stats.aiInteractions || 0;
  if (statCodeChanged) statCodeChanged.textContent = `${window.state.stats.codeChanged || 0} KB`;
  if (statAvgContext) statAvgContext.textContent = `${window.state.stats.avgContext || 0}%`;
  
  // Get events and prompts from state
  const events = window.state.data?.events || [];
  const prompts = window.state.data?.prompts || [];
  
  // Calculate programming languages
  const languageMap = {
    '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript', '.jsx': 'JavaScript', '.tsx': 'TypeScript',
    '.java': 'Java', '.cpp': 'C++', '.c': 'C', '.h': 'C', '.go': 'Go', '.rs': 'Rust',
    '.php': 'PHP', '.rb': 'Ruby', '.swift': 'Swift', '.kt': 'Kotlin', '.scala': 'Scala',
    '.cs': 'C#', '.vb': 'VB.NET', '.fs': 'F#', '.r': 'R', '.m': 'Objective-C', '.mm': 'Objective-C++',
    '.clj': 'Clojure', '.hs': 'Haskell', '.ml': 'OCaml', '.erl': 'Erlang',
    '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell', '.fish': 'Shell',
    '.html': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SASS', '.less': 'Less',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.xml': 'XML', '.md': 'Markdown',
    '.txt': 'Text', '.csv': 'CSV', '.ipynb': 'Jupyter', '.sql': 'SQL', '.vue': 'Vue', '.svelte': 'Svelte'
  };
  
  const languageStats = new Map();
  events.forEach(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const filePath = details.file_path || details.filePath || event.file || event.filePath;
      if (filePath) {
        const ext = '.' + filePath.split('.').pop().toLowerCase();
        const language = languageMap[ext] || 'Other';
        languageStats.set(language, (languageStats.get(language) || 0) + 1);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  // Calculate total for percentages
  const totalChanges = Array.from(languageStats.values()).reduce((sum, count) => sum + count, 0);
  
  // Sort by percentage (which is proportional to count) and get top languages
  const topLanguages = Array.from(languageStats.entries())
    .map(([lang, count]) => ({
      language: lang,
      count: count,
      percentage: totalChanges > 0 ? (count / totalChanges) * 100 : 0
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3); // Top 3 languages
  
  if (statLanguages) {
    if (topLanguages.length > 0) {
      // Display with percentages, ordered by percentage
      statLanguages.textContent = topLanguages.map(({ language, percentage }) => 
        `${language} ${percentage.toFixed(0)}%`
      ).join(', ');
      statLanguages.title = topLanguages.map(({ language, count, percentage }) => 
        `${language}: ${count} changes (${percentage.toFixed(1)}%)`
      ).join('\n');
    } else {
      statLanguages.textContent = '-';
    }
  }
  
  // Calculate most active workspace
  const workspaceActivity = new Map();
  [...events, ...prompts].forEach(item => {
    const wsPath = item.workspace_path || item.workspacePath || item.workspace || item.workspaceName;
    if (wsPath) {
      workspaceActivity.set(wsPath, (workspaceActivity.get(wsPath) || 0) + 1);
    }
  });
  
  const mostActiveWorkspace = Array.from(workspaceActivity.entries())
    .sort((a, b) => b[1] - a[1])[0];
  
  if (statActiveWorkspace) {
    if (mostActiveWorkspace) {
      const workspaceName = mostActiveWorkspace[0].split('/').pop() || mostActiveWorkspace[0];
      statActiveWorkspace.textContent = workspaceName;
      statActiveWorkspace.title = `${mostActiveWorkspace[0]}\n${mostActiveWorkspace[1]} activities`;
    } else {
      statActiveWorkspace.textContent = '-';
    }
  }
  
  // Calculate activities today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayEvents = events.filter(e => {
    const eventDate = e.timestamp ? new Date(e.timestamp) : null;
    return eventDate && eventDate >= today && (e.type === 'file_change' || e.type === 'code_change');
  }).length;
  
  const todayPrompts = prompts.filter(p => {
    const promptDate = p.timestamp ? new Date(p.timestamp) : null;
    return promptDate && promptDate >= today;
  }).length;
  
  const currentActivity = todayEvents + todayPrompts;
  
  // Update Activities Today
  if (statActivitiesToday) {
    statActivitiesToday.textContent = currentActivity;
  }
  
  if (statActivitiesTodayBreakdown) {
    statActivitiesTodayBreakdown.textContent = `${todayEvents} file changes, ${todayPrompts} AI prompts`;
  }
  
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

