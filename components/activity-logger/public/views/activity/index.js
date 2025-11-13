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
  
  // Sync with global workspace selector if available
  const globalWorkspace = window.state?.currentWorkspace;
  if (globalWorkspace && globalWorkspace !== 'all') {
    currentWorkspaceFilter = globalWorkspace;
  }
  
  // Apply workspace filter with proper normalization
  if (currentWorkspaceFilter !== 'all') {
    // Normalize the filter value
    const normalizeWorkspacePath = window.normalizeWorkspacePath || ((path) => {
      if (!path) return '';
      return path.toLowerCase().replace(/\/$/, '').trim();
    });
    const normalizedFilter = normalizeWorkspacePath(currentWorkspaceFilter);
    
    events = events.filter(event => {
      // Try multiple fields for workspace
      const eventWorkspace = event.workspace_path || event.workspacePath || event.workspace || event.workspaceName || '';
      const details = typeof event.details === 'string' ? 
        (() => { try { return JSON.parse(event.details); } catch(e) { return {}; } })() : 
        event.details || {};
      const detailsWorkspace = details.workspace_path || details.workspacePath || details.workspace || details.workspaceName || '';
      
      // Also check user field (sometimes workspace is stored as user)
      const userWorkspace = event.user || details.user || '';
      
      // Combine all possible workspace sources
      const fullWorkspace = eventWorkspace || detailsWorkspace || userWorkspace;
      const normalizedEventWorkspace = normalizeWorkspacePath(fullWorkspace);
      
      // Match if normalized paths are equal or one contains the other
      return normalizedEventWorkspace === normalizedFilter || 
             normalizedEventWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedEventWorkspace);
    });
    
    // Filter prompts by workspace
    prompts = prompts.filter(prompt => {
      const promptWorkspace = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId || prompt.workspace || '';
      const normalizedPromptWorkspace = normalizeWorkspacePath(promptWorkspace);
      return normalizedPromptWorkspace === normalizedFilter || 
             normalizedPromptWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedPromptWorkspace);
    });
    
    // Filter terminal commands by workspace
    terminalCommands = terminalCommands.filter(cmd => {
      const cmdWorkspace = cmd.workspace_path || cmd.workspacePath || cmd.workspace || cmd.cwd || cmd.user || '';
      const normalizedCmdWorkspace = normalizeWorkspacePath(cmdWorkspace);
      return normalizedCmdWorkspace === normalizedFilter || 
             normalizedCmdWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedCmdWorkspace);
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
  
  // Filter out git internal files from events
  const isGitInternalFile = window.isGitInternalFile || ((path) => {
    if (!path) return false;
    if (path.includes('/.git/') || path.includes('\\.git\\')) return true;
    if (path.startsWith('.git/') || path.startsWith('.git\\')) return true;
    if (/^[a-f0-9]{40}$/i.test(path)) return true;
    if (/objects\/[a-f0-9]{2}\/[a-f0-9]{38}/i.test(path)) return true;
    const fileName = path.split('/').pop() || path.split('\\').pop() || '';
    if (/^[a-f0-9]{32,}$/i.test(fileName) && (path.includes('objects/') || path.includes('objects\\'))) return true;
    return false;
  });
  
  // Filter events to exclude git internal files
  const filteredEvents = events.filter(event => {
    if (event.type === 'file_change' || event.type === 'code_change') {
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        const path = details?.file_path || event.file_path || event.path || '';
        return !isGitInternalFile(path);
      } catch {
        return true; // Keep if we can't parse
      }
    }
    return true; // Keep non-file-change events
  });
  
  // Merge events, prompts, and terminal commands into unified timeline
  // First, sort by timestamp to establish initial order
  let timelineItems = [
    ...filteredEvents.map(event => ({
      ...event,
      itemType: 'event',
      sortTime: new Date(event.timestamp).getTime(),
      originalTimestamp: new Date(event.timestamp).getTime()
    })),
    ...prompts.map(prompt => ({
      ...prompt,
      itemType: 'prompt',
      sortTime: new Date(prompt.timestamp).getTime(),
      originalTimestamp: new Date(prompt.timestamp).getTime(),
      id: prompt.id || `prompt-${prompt.timestamp}`
    })),
    ...terminalCommands.map(cmd => ({
      ...cmd,
      itemType: 'terminal',
      sortTime: cmd.timestamp,
      originalTimestamp: cmd.timestamp,
      id: cmd.id
    }))
  ].sort((a, b) => b.sortTime - a.sortTime);
  
  // Assign sequence indices based on position in timeline (reverse chronological)
  // Higher sequence number = appears earlier in timeline = happened more recently
  timelineItems = timelineItems.map((item, index) => ({
    ...item,
    sequenceIndex: timelineItems.length - index, // Higher number = more recent
    sequencePosition: index // Position in sorted array
  }));
  
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
  
  // Group by commits if available (lightweight, non-blocking)
  if (window.groupByCommits) {
    try {
      timelineItems = await window.groupByCommits(timelineItems);
    } catch (error) {
      console.debug('[ACTIVITY] Commit grouping failed, using regular timeline:', error.message);
      // Continue with ungrouped items
    }
  }
  
  // Extract unique workspaces for filter dropdown
  const normalizeWorkspacePath = window.normalizeWorkspacePath || ((path) => {
    if (!path) return '';
    return path.toLowerCase().replace(/\/$/, '').trim();
  });
  
  const workspaceMap = new Map();
  
  // Extract from events
  (window.state?.data?.events || []).forEach(event => {
    const eventWs = event.workspace_path || event.workspacePath || event.workspace || event.workspaceName || '';
    const details = typeof event.details === 'string' ? 
      (() => { try { return JSON.parse(event.details); } catch(e) { return {}; } })() : 
      event.details || {};
    const detailsWs = details.workspace_path || details.workspacePath || details.workspace || details.workspaceName || '';
    const userWs = event.user || details.user || '';
    
    const wsPath = eventWs || detailsWs || userWs;
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Extract from prompts
  (window.state?.data?.prompts || []).forEach(prompt => {
    const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId || prompt.workspace || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Extract from terminal commands
  (window.state?.data?.terminalCommands || []).forEach(cmd => {
    const wsPath = cmd.workspace_path || cmd.workspacePath || cmd.workspace || cmd.cwd || cmd.user || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Also use workspaces from state if available
  (window.state?.data?.workspaces || []).forEach(ws => {
    const wsPath = ws.path || ws.id || ws.name || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = ws.name || ws.path?.split('/').pop() || ws.path?.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
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
            <p class="card-subtitle">${timelineItems.length} items (${filteredEvents.length} file changes, ${prompts.length} AI prompts, ${terminalCommands.length} terminal commands)</p>
          </div>
          <div class="activity-header-controls" style="display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap;">
            ${currentWorkspaceFilter !== 'all' ? `
              <button class="btn btn-sm" onclick="if(window.showShareModal) window.showShareModal(['${window.escapeHtml ? window.escapeHtml(currentWorkspaceFilter) : currentWorkspaceFilter}']); else alert('Sharing feature not available');" title="Share this workspace view" style="padding: 6px 12px;">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                </svg>
                Share Workspace
              </button>
            ` : ''}
            <select class="select-input" id="workspaceFilter" onchange="filterActivityByWorkspace(this.value)" style="min-width: 180px;">
              <option value="all" ${currentWorkspaceFilter === 'all' ? 'selected' : ''}>All Workspaces</option>
              ${uniqueWorkspaces.map(([normalizedPath, displayName]) => {
                // Compare normalized paths for selection
                const normalizeForCompare = window.normalizeWorkspacePath || ((path) => {
                  if (!path) return '';
                  return path.toLowerCase().replace(/\/$/, '').trim();
                });
                const normalizedCurrent = normalizeForCompare(currentWorkspaceFilter);
                const isSelected = normalizedCurrent === normalizedPath;
                return `
                  <option value="${window.escapeHtml ? window.escapeHtml(normalizedPath) : normalizedPath}" ${isSelected ? 'selected' : ''}>
                    ${window.escapeHtml ? window.escapeHtml(displayName) : displayName}
                  </option>
                `;
              }).join('')}
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

