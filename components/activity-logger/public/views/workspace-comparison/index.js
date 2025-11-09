/**
 * Workspace Comparison View
 * Compare multiple workspaces with add/delete functionality
 */

// Store selected workspaces
let selectedWorkspaces = [];
let availableWorkspaces = [];

function renderWorkspaceComparisonView(container) {
  container.innerHTML = `
    <div class="workspace-comparison-view">
      <div class="view-header">
        <h2>Workspace Comparison</h2>
        <p class="view-subtitle">Compare productivity, activity patterns, and metrics across different workspaces</p>
      </div>

      <!-- Workspace Statistics Overview -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Workspace Statistics</h3>
          <p class="card-subtitle">Aggregate metrics across all workspaces</p>
        </div>
        <div class="card-body">
          <div id="workspaceStatsOverview" class="workspace-stats-grid">
            <!-- Will be populated by updateWorkspaceStats() -->
          </div>
        </div>
      </div>

      <!-- Workspace Selection -->
      <div class="card">
        <div class="card-header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h3 class="card-title">Select Workspaces to Compare</h3>
              <p class="card-subtitle">Add workspaces from the list below to compare their metrics</p>
            </div>
            <div style="display: flex; gap: var(--space-xs);">
              <button class="btn" onclick="shareSelectedWorkspaces()" id="shareWorkspacesBtn" ${selectedWorkspaces.length === 0 ? 'disabled' : ''} title="Share selected workspaces">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                </svg>
                Share
              </button>
              <button class="btn btn-primary" onclick="addWorkspaceFromList()" id="addWorkspaceBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Workspace
              </button>
            </div>
          </div>
        </div>
        <div class="card-body">
          <!-- Selected Workspaces -->
          <div id="selectedWorkspacesList" class="selected-workspaces-list">
            <!-- Will be populated dynamically -->
          </div>

          <!-- Available Workspaces Dropdown -->
          <div id="workspaceSelectorContainer" class="workspace-selector-container" style="display: none;">
            <div class="workspace-selector">
              <input type="text" id="workspaceSearch" class="workspace-search-input" placeholder="Search workspaces..." oninput="filterWorkspaces(this.value)">
              <div id="availableWorkspacesList" class="available-workspaces-list">
                <!-- Will be populated by loadAvailableWorkspaces() -->
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Comparison Results -->
      <div id="workspaceComparisonResults">
        <!-- Will be populated by updateWorkspaceComparison() -->
      </div>
    </div>
  `;

  // Initialize
  setTimeout(() => {
    loadAvailableWorkspaces().then(() => {
      // Automatically select first two workspaces if none are selected
      if (selectedWorkspaces.length === 0 && availableWorkspaces.length >= 2) {
        // Select first two workspaces
        addWorkspace(availableWorkspaces[0].path);
        addWorkspace(availableWorkspaces[1].path);
      } else if (selectedWorkspaces.length === 0 && availableWorkspaces.length === 1) {
        // If only one workspace, select it
        addWorkspace(availableWorkspaces[0].path);
      }
    });
    updateWorkspaceStats();
    renderSelectedWorkspaces();
  }, 100);
}

/**
 * Load available workspaces from API
 */
async function loadAvailableWorkspaces() {
  try {
    const response = await window.APIClient.get('/api/workspaces', { silent: true });
    availableWorkspaces = Array.isArray(response) ? response : (response?.data || []);
    // Sort by activity (most active first) for better default selection
    availableWorkspaces.sort((a, b) => {
      const aActivity = (a.events || 0) + (a.prompts || a.promptCount || 0);
      const bActivity = (b.events || 0) + (b.prompts || b.promptCount || 0);
      return bActivity - aActivity;
    });
    renderAvailableWorkspaces();
    return Promise.resolve();
  } catch (error) {
    console.warn('[WORKSPACE] Could not load workspaces:', error.message);
    // Extract workspaces from current data
    extractWorkspacesFromData();
    return Promise.resolve();
  }
}

/**
 * Extract workspaces from current state data
 */
function extractWorkspacesFromData() {
  const workspaceMap = new Map();
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];

  events.forEach(e => {
    const wsPath = e.workspace_path || e.workspacePath;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, {
          path: wsPath,
          name: wsPath.split('/').pop() || 'Unknown',
          events: 0,
          prompts: 0
        });
      }
      workspaceMap.get(wsPath).events++;
    }
  });

  prompts.forEach(p => {
    const wsPath = p.workspace_path || p.workspacePath || p.workspaceId;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, {
          path: wsPath,
          name: wsPath.split('/').pop() || 'Unknown',
          events: 0,
          prompts: 0
        });
      }
      workspaceMap.get(wsPath).prompts++;
    }
  });

  availableWorkspaces = Array.from(workspaceMap.values());
  // Sort by activity (most active first)
  availableWorkspaces.sort((a, b) => {
    const aActivity = (a.events || 0) + (a.prompts || 0);
    const bActivity = (b.events || 0) + (b.prompts || 0);
    return bActivity - aActivity;
  });
  renderAvailableWorkspaces();
}

/**
 * Render available workspaces list
 */
function renderAvailableWorkspaces() {
  const container = document.getElementById('availableWorkspacesList');
  if (!container) return;

  if (availableWorkspaces.length === 0) {
    container.innerHTML = `
      <div class="empty-workspace-list">
        <p>No workspaces found. Workspaces will appear as you work in different projects.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = availableWorkspaces
    .filter(ws => !selectedWorkspaces.find(sw => sw.path === ws.path))
    .map(ws => `
      <div class="workspace-item" onclick="addWorkspace('${ws.path.replace(/'/g, "\\'")}')">
        <div class="workspace-item-info">
          <div class="workspace-item-name">${escapeHtml(ws.name || ws.path.split('/').pop())}</div>
          <div class="workspace-item-path">${escapeHtml(ws.path)}</div>
          <div class="workspace-item-stats">
            <span>${ws.events || 0} events</span>
            <span>•</span>
            <span>${ws.prompts || ws.promptCount || 0} prompts</span>
          </div>
        </div>
        <button class="workspace-item-add" onclick="event.stopPropagation(); addWorkspace('${ws.path.replace(/'/g, "\\'")}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    `).join('');
}

/**
 * Filter workspaces by search term
 */
function filterWorkspaces(searchTerm) {
  const items = document.querySelectorAll('.workspace-item');
  const term = searchTerm.toLowerCase();
  
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(term) ? 'flex' : 'none';
  });
}

/**
 * Add workspace to comparison
 */
function addWorkspace(workspacePath) {
  const workspace = availableWorkspaces.find(ws => ws.path === workspacePath);
  if (!workspace) {
    // Create workspace object if not found
    const workspace = {
      path: workspacePath,
      name: workspacePath.split('/').pop() || 'Unknown',
      events: 0,
      prompts: 0
    };
    availableWorkspaces.push(workspace);
  }

  if (!selectedWorkspaces.find(ws => ws.path === workspacePath)) {
    selectedWorkspaces.push(workspace);
    renderSelectedWorkspaces();
    renderAvailableWorkspaces();
    updateWorkspaceComparison();
    hideWorkspaceSelector();
  }
}

/**
 * Remove workspace from comparison
 */
function removeWorkspace(workspacePath) {
  selectedWorkspaces = selectedWorkspaces.filter(ws => ws.path !== workspacePath);
  renderSelectedWorkspaces();
  renderAvailableWorkspaces();
  updateWorkspaceComparison();
}

/**
 * Render selected workspaces
 */
function renderSelectedWorkspaces() {
  const container = document.getElementById('selectedWorkspacesList');
  if (!container) return;

  // Update share button state
  const shareBtn = document.getElementById('shareWorkspacesBtn');
  if (shareBtn) {
    shareBtn.disabled = selectedWorkspaces.length === 0;
  }
  
  if (selectedWorkspaces.length === 0) {
    container.innerHTML = `
      <div class="empty-selection">
        <p>No workspaces selected. Click "Add Workspace" to start comparing.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = selectedWorkspaces.map((ws, index) => `
    <div class="selected-workspace-card" data-workspace="${escapeHtml(ws.path)}">
      <div class="selected-workspace-header">
        <div class="selected-workspace-number">${index + 1}</div>
        <div class="selected-workspace-info">
          <div class="selected-workspace-name">${escapeHtml(ws.name || ws.path.split('/').pop())}</div>
          <div class="selected-workspace-path">${escapeHtml(ws.path)}</div>
        </div>
        <button class="selected-workspace-remove" onclick="removeWorkspace('${ws.path.replace(/'/g, "\\'")}')" title="Remove workspace">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Show workspace selector
 */
function addWorkspaceFromList() {
  const container = document.getElementById('workspaceSelectorContainer');
  if (container) {
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  }
}

/**
 * Hide workspace selector
 */
function hideWorkspaceSelector() {
  const container = document.getElementById('workspaceSelectorContainer');
  if (container) {
    container.style.display = 'none';
  }
}

/**
 * Update workspace statistics overview
 */
function updateWorkspaceStats() {
  const container = document.getElementById('workspaceStatsOverview');
  if (!container) return;

  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  // Calculate aggregate statistics
  const workspaceMap = new Map();
  const sessions = new Set();
  let totalFileChanges = 0;
  let totalCodeChanged = 0;
  let totalContextUsed = 0;
  let contextCount = 0;

  events.forEach(e => {
    const wsPath = e.workspace_path || e.workspacePath;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, { events: 0, prompts: 0 });
      }
      workspaceMap.get(wsPath).events++;
      
      if (e.type === 'file-change' || e.type === 'file-edit' || e.type === 'code-change') {
        totalFileChanges++;
        const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
        totalCodeChanged += (details?.chars_added || 0);
      }
    }
    if (e.session_id) sessions.add(e.session_id);
  });

  prompts.forEach(p => {
    const wsPath = p.workspace_path || p.workspacePath || p.workspaceId;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, { events: 0, prompts: 0 });
      }
      workspaceMap.get(wsPath).prompts++;
    }
    
    const contextUsage = p.contextUsage || p.context_usage || p.promptTokens || 0;
    if (contextUsage > 0) {
      totalContextUsed += contextUsage;
      contextCount++;
    }
  });

  const totalWorkspaces = workspaceMap.size;
  const avgContextUsed = contextCount > 0 ? (totalContextUsed / contextCount / 100000 * 100).toFixed(1) : 0; // Assuming 100k token context window

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Workspaces</div>
      <div class="stat-value">${totalWorkspaces}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active Sessions</div>
      <div class="stat-value">${sessions.size}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">File Changes</div>
      <div class="stat-value">${totalFileChanges.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">AI Interactions</div>
      <div class="stat-value">${prompts.length.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Code Changed</div>
      <div class="stat-value">${(totalCodeChanged / 1024).toFixed(1)} KB</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Context Used</div>
      <div class="stat-value">${avgContextUsed}%</div>
    </div>
  `;
}

/**
 * Update workspace comparison
 */
function updateWorkspaceComparison() {
  const container = document.getElementById('workspaceComparisonResults');
  if (!container) return;

  if (selectedWorkspaces.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align: center; padding: var(--space-xl);">
          <p style="color: var(--color-text-muted);">Select at least one workspace to see comparison metrics</p>
        </div>
      </div>
    `;
    return;
  }

  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];

  // Calculate metrics for each workspace
  const workspaceMetrics = selectedWorkspaces.map(ws => {
    const wsEvents = events.filter(e => {
      const wsPath = e.workspace_path || e.workspacePath;
      return wsPath === ws.path;
    });

    const wsPrompts = prompts.filter(p => {
      const wsPath = p.workspace_path || p.workspacePath || p.workspaceId;
      return wsPath === ws.path;
    });

    return calculateWorkspaceMetrics(ws, wsEvents, wsPrompts);
  });

  // Render comparison
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Workspace Comparison</h3>
        <p class="card-subtitle">Comparing ${selectedWorkspaces.length} workspace${selectedWorkspaces.length > 1 ? 's' : ''}</p>
      </div>
      <div class="card-body">
        <div class="workspace-comparison-grid">
          ${workspaceMetrics.map((metrics, index) => `
            <div class="workspace-metrics-card">
              <div class="workspace-metrics-header">
                <div class="workspace-metrics-number">${index + 1}</div>
                <div class="workspace-metrics-name">${escapeHtml(metrics.name)}</div>
              </div>
              <div class="workspace-metrics-body">
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Prompts</span>
                  <span class="workspace-metric-value">${metrics.prompts}</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Events</span>
                  <span class="workspace-metric-value">${metrics.events}</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">File Changes</span>
                  <span class="workspace-metric-value">${metrics.fileChanges}</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Lines Added</span>
                  <span class="workspace-metric-value">${metrics.linesAdded.toLocaleString()}</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Lines Removed</span>
                  <span class="workspace-metric-value">${metrics.linesRemoved.toLocaleString()}</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Code Changed</span>
                  <span class="workspace-metric-value">${(metrics.codeChanged / 1024).toFixed(1)} KB</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Avg Context</span>
                  <span class="workspace-metric-value">${metrics.avgContext}%</span>
                </div>
                <div class="workspace-metric">
                  <span class="workspace-metric-label">Active Time</span>
                  <span class="workspace-metric-value">${formatDuration(metrics.activeTime)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Comparison Chart</h3>
      </div>
      <div class="card-body">
        <canvas id="workspaceComparisonChart" style="max-height: 400px;"></canvas>
      </div>
    </div>
  `;

  // Render chart
  setTimeout(() => {
    renderWorkspaceComparisonChart(workspaceMetrics);
  }, 100);
}

/**
 * Calculate metrics for a workspace
 */
function calculateWorkspaceMetrics(workspace, events, prompts) {
  const fileChanges = events.filter(e => 
    e.type === 'file-change' || e.type === 'file-edit' || e.type === 'code-change'
  ).length;

  let linesAdded = 0;
  let linesRemoved = 0;
  let codeChanged = 0;

  events.forEach(e => {
    const details = typeof e.details === 'string' ? JSON.parse(e.details) : e.details;
    linesAdded += details?.lines_added || 0;
    linesRemoved += details?.lines_removed || 0;
    codeChanged += details?.chars_added || 0;
  });

  // Calculate average context usage
  let totalContext = 0;
  let contextCount = 0;
  prompts.forEach(p => {
    const contextUsage = p.contextUsage || p.context_usage || p.promptTokens || 0;
    if (contextUsage > 0) {
      totalContext += contextUsage;
      contextCount++;
    }
  });
  const avgContext = contextCount > 0 ? (totalContext / contextCount / 100000 * 100).toFixed(1) : 0;

  // Estimate active time
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let activeTime = 0;
  for (let i = 1; i < sortedEvents.length; i++) {
    const timeDiff = new Date(sortedEvents[i].timestamp) - new Date(sortedEvents[i - 1].timestamp);
    if (timeDiff < 5 * 60 * 1000) {
      activeTime += timeDiff;
    }
  }

  return {
    name: workspace.name || workspace.path.split('/').pop(),
    path: workspace.path,
    prompts: prompts.length,
    events: events.length,
    fileChanges,
    linesAdded,
    linesRemoved,
    codeChanged,
    avgContext,
    activeTime
  };
}

/**
 * Render workspace comparison chart
 */
function renderWorkspaceComparisonChart(metrics) {
  const canvas = document.getElementById('workspaceComparisonChart');
  if (!canvas || !window.Chart) return;

  if (canvas.chart) {
    canvas.chart.destroy();
  }

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  
  canvas.chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: metrics.map(m => m.name),
      datasets: [
        {
          label: 'Prompts',
          data: metrics.map(m => m.prompts),
          backgroundColor: colors[0],
          yAxisID: 'y-prompts'
        },
        {
          label: 'Events',
          data: metrics.map(m => m.events),
          backgroundColor: colors[1],
          yAxisID: 'y-events'
        },
        {
          label: 'File Changes',
          data: metrics.map(m => m.fileChanges),
          backgroundColor: colors[2],
          yAxisID: 'y-changes'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        'y-prompts': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Prompts'
          }
        },
        'y-events': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Events & Changes'
          }
        },
        'y-changes': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'File Changes'
          }
        }
      }
    }
  });
}

/**
 * Format duration
 */
function formatDuration(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export to window
function shareSelectedWorkspaces() {
  if (selectedWorkspaces.length === 0) {
    alert('Please select at least one workspace to share');
    return;
  }
  
  const workspacePaths = selectedWorkspaces.map(ws => ws.path || ws);
  if (window.showShareModal) {
    window.showShareModal(workspacePaths);
  } else {
    alert('Sharing feature not available. Please refresh the page.');
  }
}

window.renderWorkspaceComparisonView = renderWorkspaceComparisonView;
window.addWorkspace = addWorkspace;
window.removeWorkspace = removeWorkspace;
window.addWorkspaceFromList = addWorkspaceFromList;
window.filterWorkspaces = filterWorkspaces;
window.updateWorkspaceComparison = updateWorkspaceComparison;
window.shareSelectedWorkspaces = shareSelectedWorkspaces;
