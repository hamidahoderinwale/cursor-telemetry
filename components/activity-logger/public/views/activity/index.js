/**
 * Activity View
 */

// Store current filters in module scope
let currentWorkspaceFilter = 'all';
let currentTimeRangeFilter = 'all';

async function renderActivityView(container) {
  let events = window.state?.data?.events || [];
  let prompts = window.state?.data?.prompts || [];
  let terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Apply workspace filter
  if (currentWorkspaceFilter !== 'all') {
    events = events.filter(event => {
      const eventWorkspace = event.workspace_path || event.workspacePath || event.workspace || '';
      const details = typeof event.details === 'string' ? 
        (() => { try { return JSON.parse(event.details); } catch(e) { return {}; } })() : 
        event.details || {};
      const detailsWorkspace = details.workspace_path || details.workspacePath || details.workspace || '';
      const fullWorkspace = eventWorkspace || detailsWorkspace;
      return fullWorkspace === currentWorkspaceFilter || 
             fullWorkspace.includes(currentWorkspaceFilter) ||
             currentWorkspaceFilter.includes(fullWorkspace);
    });
    
    // Filter prompts by workspace
    prompts = prompts.filter(prompt => {
      const promptWorkspace = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId || '';
      return promptWorkspace === currentWorkspaceFilter || 
             promptWorkspace.includes(currentWorkspaceFilter) ||
             currentWorkspaceFilter.includes(promptWorkspace);
    });
    
    // Filter terminal commands by workspace
    terminalCommands = terminalCommands.filter(cmd => {
      const cmdWorkspace = cmd.workspace_path || cmd.workspacePath || cmd.workspace || cmd.cwd || '';
      return cmdWorkspace === currentWorkspaceFilter || 
             cmdWorkspace.includes(currentWorkspaceFilter) ||
             currentWorkspaceFilter.includes(cmdWorkspace);
    });
  }
  
  // Enhance prompts with context information
  prompts = await Promise.all(
    prompts.map(async (prompt) => {
      if (window.enhancePromptWithContext) {
        try {
          return await window.enhancePromptWithContext(prompt);
        } catch (error) {
          console.warn('Error enhancing prompt with context:', error);
          return prompt;
        }
      }
      return prompt;
    })
  );
  
  // Apply time range filter
  if (currentTimeRangeFilter !== 'all') {
    const now = Date.now();
    let cutoffTime = 0;
    
    switch (currentTimeRangeFilter) {
      case 'today':
        cutoffTime = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    events = events.filter(event => new Date(event.timestamp).getTime() >= cutoffTime);
  }
  
  // Merge events, prompts, and terminal commands into unified timeline
  let timelineItems = [
    ...events.map(event => ({
      ...event,
      itemType: 'event',
      sortTime: new Date(event.timestamp).getTime()
    })),
    ...prompts.map(prompt => ({
      ...prompt,
      itemType: 'prompt',
      sortTime: new Date(prompt.timestamp).getTime(),
      id: prompt.id || `prompt-${prompt.timestamp}`
    })),
    ...terminalCommands.map(cmd => ({
      ...cmd,
      itemType: 'terminal',
      sortTime: cmd.timestamp,
      id: cmd.id
    }))
  ].sort((a, b) => b.sortTime - a.sortTime);
  
  // Enhance timeline with status messages if available
  if (window.enhanceTimelineWithStatusMessages) {
    try {
      timelineItems = await window.enhanceTimelineWithStatusMessages(timelineItems);
    } catch (error) {
      // Silently fail - status messages are optional
      // Don't log errors here as they're expected when service is offline
    }
  }
  
  // Limit to 100 items after enhancement
  timelineItems = timelineItems.slice(0, 100);
  
  // Extract unique workspaces for filter dropdown
  const workspaceMap = new Map();
  (window.state?.data?.events || []).forEach(event => {
    const wsPath = event.workspace_path || event.workspacePath || event.workspace;
    if (wsPath) {
      workspaceMap.set(wsPath, wsPath.split('/').pop() || wsPath);
    }
  });
  (window.state?.data?.prompts || []).forEach(prompt => {
    const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId;
    if (wsPath) {
      workspaceMap.set(wsPath, wsPath.split('/').pop() || wsPath);
    }
  });
  
  // Also use workspaces from state if available
  (window.state?.data?.workspaces || []).forEach(ws => {
    const wsPath = ws.path || ws.id;
    if (wsPath) {
      workspaceMap.set(wsPath, ws.name || ws.path?.split('/').pop() || wsPath);
    }
  });
  
  const uniqueWorkspaces = Array.from(workspaceMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  
  // Apply grouping if enabled
  let displayItems = timelineItems;
  let isGrouped = false;
  
  if (window.currentGrouping && window.currentGrouping !== 'none') {
    displayItems = window.groupTimelineItems ? window.groupTimelineItems(timelineItems, window.currentGrouping) : timelineItems;
    isGrouped = true;
  }
  
  container.innerHTML = `
    <div class="activity-view">
      
      <!-- Unified Activity Timeline -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title" title="Chronological timeline of all your development activity including file changes, AI prompts, and terminal commands. Items are displayed in chronological order with the most recent first. Use filters to narrow down by workspace, time range, or grouping">Activity Timeline</h3>
            <p class="card-subtitle">${timelineItems.length} items (${events.length} file changes, ${prompts.length} AI prompts, ${terminalCommands.length} terminal commands)</p>
          </div>
          <div class="activity-header-controls" style="display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap;">
            <select class="select-input" id="workspaceFilter" onchange="filterActivityByWorkspace(this.value)" style="min-width: 180px;">
              <option value="all" ${currentWorkspaceFilter === 'all' ? 'selected' : ''}>All Workspaces</option>
              ${uniqueWorkspaces.map(([path, name]) => `
                <option value="${window.escapeHtml ? window.escapeHtml(path) : path}" ${currentWorkspaceFilter === path ? 'selected' : ''}>
                  ${window.escapeHtml ? window.escapeHtml(name) : name}
                </option>
              `).join('')}
            </select>
            <select class="select-input" id="timeRangeFilter" onchange="filterActivityByTimeRange(this.value)">
              <option value="all" ${currentTimeRangeFilter === 'all' ? 'selected' : ''}>All Time</option>
              <option value="today" ${currentTimeRangeFilter === 'today' ? 'selected' : ''}>Today</option>
              <option value="week" ${currentTimeRangeFilter === 'week' ? 'selected' : ''}>This Week</option>
              <option value="month" ${currentTimeRangeFilter === 'month' ? 'selected' : ''}>This Month</option>
            </select>
            <select class="select-input" id="groupingFilter" onchange="updateGrouping(this.value)" style="min-width: 150px;">
              <option value="none" ${(window.currentGrouping || 'none') === 'none' ? 'selected' : ''}>No Grouping</option>
              <option value="file" ${(window.currentGrouping || 'none') === 'file' ? 'selected' : ''}>Group by File</option>
              <option value="session" ${(window.currentGrouping || 'none') === 'session' ? 'selected' : ''}>Group by Session</option>
              <option value="workflow" ${(window.currentGrouping || 'none') === 'workflow' ? 'selected' : ''}>Group by Workflow</option>
              <option value="workspace" ${(window.currentGrouping || 'none') === 'workspace' ? 'selected' : ''}>Group by Workspace</option>
              <option value="model" ${(window.currentGrouping || 'none') === 'model' ? 'selected' : ''}>Group by Model</option>
            </select>
          </div>
        </div>
        <div class="card-body">
          <!-- Search Container -->
          <div class="activity-search-container">
            <div class="activity-search-wrapper">
              <svg class="activity-search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                <circle cx="8" cy="8" r="6" stroke-width="2"/>
                <path d="M13 13l4 4" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <input type="text" 
                     id="activitySearchInput" 
                     class="activity-search-input" 
                     placeholder="Search timeline (Cmd+F)..."
                     autocomplete="off">
            </div>
            <div id="activitySearchResults" class="activity-search-results"></div>
          </div>
          
          <!-- Timeline Content -->
          ${isGrouped && window.renderGroupedTimeline ? 
            window.renderGroupedTimeline(displayItems) : 
            (timelineItems.length > 0 ? window.renderUnifiedTimeline(displayItems) : '<div class="empty-state"><div class="empty-state-text">No activity recorded</div><div class="empty-state-hint">Activity will appear as you work in Cursor</div></div>')
          }
        </div>
      </div>

    </div>
  `;
  
  // Initialize search after DOM is ready
  setTimeout(() => {
    if (window.initializeActivitySearch) {
      window.initializeActivitySearch();
    }
  }, 100);
}

function filterActivityByTimeRange(range) {
  currentTimeRangeFilter = range;
  const container = document.getElementById('viewContainer');
  if (container) {
    renderActivityView(container);
  }
}

function filterActivityByWorkspace(workspace) {
  currentWorkspaceFilter = workspace;
  const container = document.getElementById('viewContainer');
  if (container) {
    renderActivityView(container);
  }
}

// Export to window for global access
window.renderActivityView = renderActivityView;
window.filterActivityByTimeRange = filterActivityByTimeRange;
window.filterActivityByWorkspace = filterActivityByWorkspace;

