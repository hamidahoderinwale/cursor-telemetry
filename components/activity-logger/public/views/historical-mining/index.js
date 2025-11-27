/**
 * Historical Mining View
 * Interface for triggering and managing historical data mining
 */

async function renderHistoricalMiningView(container) {
  if (!window.renderHistoricalMiningTemplate) {
    container.innerHTML = '<div class="loading-state">Loading templates...</div>';
    await waitForTemplate('renderHistoricalMiningTemplate', 5000);
  }
  
  if (!window.renderHistoricalMiningTemplate) {
    container.innerHTML = '<div class="error-state">Failed to load templates</div>';
    return;
  }
  
  container.innerHTML = window.renderHistoricalMiningTemplate();
  
  // Initialize view
  await initializeHistoricalMiningView();
}

async function initializeHistoricalMiningView() {
  // Load mining status
  await loadMiningStatus();
  
  // Load mining runs history
  await loadMiningRunsHistory();
  
  // Load statistics
  await loadHistoricalStats();
  
  // Setup event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Start mining button
  const startBtn = document.getElementById('start-mining-btn');
  if (startBtn) {
    startBtn.addEventListener('click', startMining);
  }
  
  // Individual mining buttons
  const gitBtn = document.getElementById('mine-git-btn');
  if (gitBtn) {
    gitBtn.addEventListener('click', () => mineSpecific('git'));
  }
  
  const shellBtn = document.getElementById('mine-shell-btn');
  if (shellBtn) {
    shellBtn.addEventListener('click', () => mineSpecific('shell'));
  }
  
  const logsBtn = document.getElementById('mine-logs-btn');
  if (logsBtn) {
    logsBtn.addEventListener('click', () => mineSpecific('logs'));
  }
  
  const filesBtn = document.getElementById('mine-files-btn');
  if (filesBtn) {
    filesBtn.addEventListener('click', () => mineSpecific('files'));
  }
  
  // Workspace selector
  const workspaceSelect = document.getElementById('mining-workspace-select');
  if (workspaceSelect) {
    loadWorkspaces();
  }
  
  // Refresh buttons
  const refreshStatsBtn = document.getElementById('refresh-stats-btn');
  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', loadHistoricalStats);
  }
  
  const refreshHistoryBtn = document.getElementById('refresh-history-btn');
  if (refreshHistoryBtn) {
    refreshHistoryBtn.addEventListener('click', loadMiningRunsHistory);
  }
}

async function loadWorkspaces() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/workspaces`);
    const data = await response.json();
    
    const select = document.getElementById('mining-workspace-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select workspace...</option>';
    
    if (data.workspaces && data.workspaces.length > 0) {
      data.workspaces.forEach(ws => {
        const option = document.createElement('option');
        option.value = ws.path;
        option.textContent = ws.name || ws.path;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[MINING] Error loading workspaces:', error);
  }
}

async function startMining() {
  const workspace = document.getElementById('mining-workspace-select')?.value;
  if (!workspace) {
    showMiningError('Please select a workspace');
    return;
  }
  
  const includeGit = document.getElementById('include-git')?.checked ?? true;
  const includeShell = document.getElementById('include-shell')?.checked ?? true;
  const includeLogs = document.getElementById('include-logs')?.checked ?? true;
  const includeFiles = document.getElementById('include-files')?.checked ?? true;
  const sinceDays = parseInt(document.getElementById('since-days')?.value) || 365;
  const includeDiffs = document.getElementById('include-diffs')?.checked ?? false;
  
  const startBtn = document.getElementById('start-mining-btn');
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'Mining...';
  }
  
  showMiningProgress('Starting mining operation...');
  
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/mining/workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace,
        includeGit,
        includeShell,
        includeCursorLogs: includeLogs,
        includeFileTimeline: includeFiles,
        sinceDays,
        includeDiffs
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMiningProgress(`Mining started (Run ID: ${result.runId})`);
      
      // Poll for status
      pollMiningStatus();
    } else {
      showMiningError(result.error || 'Failed to start mining');
    }
  } catch (error) {
    console.error('[MINING] Error:', error);
    showMiningError(error.message);
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = 'Start Mining';
    }
  }
}

async function mineSpecific(type) {
  const workspace = document.getElementById('mining-workspace-select')?.value;
  
  let endpoint = '';
  let requiresWorkspace = false;
  
  switch (type) {
    case 'git':
      endpoint = '/api/mining/git-history';
      requiresWorkspace = true;
      break;
    case 'shell':
      endpoint = '/api/mining/shell-history';
      break;
    case 'logs':
      endpoint = '/api/mining/cursor-logs';
      break;
    case 'files':
      endpoint = '/api/mining/file-timeline';
      requiresWorkspace = true;
      break;
  }
  
  if (requiresWorkspace && !workspace) {
    showMiningError('Please select a workspace');
    return;
  }
  
  showMiningProgress(`Mining ${type}...`);
  
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const body = requiresWorkspace ? { workspace } : {};
    
    const response = await fetch(`${apiBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMiningSuccess(`${type} mining completed: ${JSON.stringify(result.results)}`);
      await loadHistoricalStats();
      await loadMiningRunsHistory();
    } else {
      showMiningError(result.error || 'Mining failed');
    }
  } catch (error) {
    console.error(`[MINING] Error mining ${type}:`, error);
    showMiningError(error.message);
  }
}

async function loadMiningStatus() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/mining/status`);
    const data = await response.json();
    
    if (data.success) {
      displayMiningStatus(data.status);
    }
  } catch (error) {
    console.error('[MINING] Error loading status:', error);
  }
}

function displayMiningStatus(status) {
  const statusContainer = document.getElementById('mining-status-display');
  if (!statusContainer) return;
  
  if (status.inProgress) {
    statusContainer.innerHTML = `
      <div class="status-badge status-warning">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Mining in progress...
      </div>
    `;
  } else if (status.lastRun) {
    const lastRun = new Date(status.lastRun.started_at).toLocaleString();
    statusContainer.innerHTML = `
      <div class="status-badge status-success">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Last run: ${lastRun}
      </div>
    `;
  } else {
    statusContainer.innerHTML = `
      <div class="status-badge status-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        No mining runs yet
      </div>
    `;
  }
}

let statusPollInterval = null;

function pollMiningStatus() {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
  }
  
  statusPollInterval = setInterval(async () => {
    await loadMiningStatus();
    
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/mining/status`);
    const data = await response.json();
    
    if (data.success && !data.status.inProgress) {
      clearInterval(statusPollInterval);
      statusPollInterval = null;
      
      // Reload stats and history
      await loadHistoricalStats();
      await loadMiningRunsHistory();
      
      showMiningSuccess('Mining completed!');
    }
  }, 3000); // Poll every 3 seconds
}

async function loadMiningRunsHistory() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/historical/mining-runs?limit=10`);
    const data = await response.json();
    
    if (data.success) {
      displayMiningRunsHistory(data.runs);
    }
  } catch (error) {
    console.error('[MINING] Error loading runs history:', error);
  }
}

function displayMiningRunsHistory(runs) {
  const container = document.getElementById('mining-runs-history');
  if (!container) return;
  
  if (!runs || runs.length === 0) {
    container.innerHTML = '<p class="text-muted">No mining runs yet</p>';
    return;
  }
  
  const html = `
    <div class="mining-runs-list">
      ${runs.map(run => `
        <div class="mining-run-card">
          <div class="run-header">
            <div class="run-status ${run.status === 'completed' ? 'status-success' : run.status === 'failed' ? 'status-error' : 'status-warning'}">
              ${run.status}
            </div>
            <div class="run-workspace">${escapeHtml(run.workspace_path || 'Unknown')}</div>
          </div>
          <div class="run-stats">
            <div class="stat-item">
              <span class="stat-label">Commits:</span>
              <span class="stat-value">${run.git_commits || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Commands:</span>
              <span class="stat-value">${run.shell_commands || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Prompts:</span>
              <span class="stat-value">${run.cursor_prompts || 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Files:</span>
              <span class="stat-value">${run.file_timestamps || 0}</span>
            </div>
          </div>
          <div class="run-footer">
            <div class="run-date">${new Date(run.started_at).toLocaleString()}</div>
            <div class="run-duration">${formatDuration(run.duration_ms)}</div>
          </div>
          ${run.errors && run.errors.length > 0 ? `
            <div class="run-errors">
              <strong>Errors:</strong>
              <ul>
                ${run.errors.map(e => `<li>${escapeHtml(e.source || 'unknown')}: ${escapeHtml(e.error || e.message || 'Unknown error')}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
  
  container.innerHTML = html;
}

async function loadHistoricalStats() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/api/historical/stats`);
    const data = await response.json();
    
    if (data.success) {
      displayHistoricalStats(data.stats);
    }
  } catch (error) {
    console.error('[MINING] Error loading stats:', error);
  }
}

function displayHistoricalStats(stats) {
  // Update stat cards
  document.getElementById('stat-commits')?.setAttribute('data-value', stats.total_commits || 0);
  document.getElementById('stat-commands')?.setAttribute('data-value', stats.total_commands || 0);
  document.getElementById('stat-prompts')?.setAttribute('data-value', stats.total_prompts || 0);
  document.getElementById('stat-files')?.setAttribute('data-value', stats.total_files || 0);
  
  // Animate counters
  animateCounter('stat-commits', stats.total_commits || 0);
  animateCounter('stat-commands', stats.total_commands || 0);
  animateCounter('stat-prompts', stats.total_prompts || 0);
  animateCounter('stat-files', stats.total_files || 0);
  
  // Update date range
  const dateRangeEl = document.getElementById('stats-date-range');
  if (dateRangeEl && stats.earliest_commit && stats.latest_commit) {
    const earliest = new Date(stats.earliest_commit).toLocaleDateString();
    const latest = new Date(stats.latest_commit).toLocaleDateString();
    dateRangeEl.textContent = `${earliest} - ${latest}`;
  }
}

function animateCounter(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const duration = 1000;
  const steps = 20;
  const increment = targetValue / steps;
  let current = 0;
  let step = 0;
  
  const interval = setInterval(() => {
    step++;
    current = Math.min(current + increment, targetValue);
    element.textContent = Math.floor(current).toLocaleString();
    
    if (step >= steps) {
      clearInterval(interval);
      element.textContent = targetValue.toLocaleString();
    }
  }, duration / steps);
}

function showMiningProgress(message) {
  const container = document.getElementById('mining-messages');
  if (!container) return;
  
  container.innerHTML = `
    <div class="message message-info">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      ${escapeHtml(message)}
    </div>
  `;
}

function showMiningSuccess(message) {
  const container = document.getElementById('mining-messages');
  if (!container) return;
  
  container.innerHTML = `
    <div class="message message-success">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      ${escapeHtml(message)}
    </div>
  `;
  
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

function showMiningError(message) {
  const container = document.getElementById('mining-messages');
  if (!container) return;
  
  container.innerHTML = `
    <div class="message message-error">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
      ${escapeHtml(message)}
    </div>
  `;
}

function formatDuration(ms) {
  if (!ms) return 'N/A';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }
  
  return `${seconds}s`;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function waitForTemplate(templateName, maxWait = 5000) {
  return new Promise((resolve) => {
    if (window[templateName]) {
      resolve();
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = 50;
    
    const checkTemplate = setInterval(() => {
      if (window[templateName]) {
        clearInterval(checkTemplate);
        resolve();
      } else if (Date.now() - startTime > maxWait) {
        clearInterval(checkTemplate);
        resolve();
      }
    }, checkInterval);
  });
}

// Export to window
window.renderHistoricalMiningView = renderHistoricalMiningView;













