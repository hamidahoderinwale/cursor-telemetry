/**
 * Overview View Helper Functions
 * HTML template functions for Overview view components
 */

function renderSystemStatus() {
  const systemResources = window.state?.data?.systemResources || [];
  const latest = systemResources.length > 0 ? systemResources[systemResources.length - 1] : null;
  
  if (!latest) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">No system data available</div>
        <div class="empty-state-hint" style="font-size: 0.85em; margin-top: 8px;">
          System resource monitoring is optional. The companion service collects CPU, memory, and load metrics every 5 seconds when running.
        </div>
      </div>
    `;
  }

  const memory = latest.memory ? `${(latest.memory.heapUsed / 1024 / 1024).toFixed(1)} MB` : 'N/A';
  const cpu = latest.cpu ? `${((latest.cpu.user + latest.cpu.system) / 1000000).toFixed(1)}s` : 'N/A';
  const load = latest.system?.loadAverage?.[0]?.toFixed(2) || 'N/A';
  const timestamp = latest.timestamp ? new Date(latest.timestamp).toLocaleTimeString() : '';

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
      ${timestamp ? `
      <div class="system-status-item" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border);">
        <span class="system-status-label" style="font-size: 0.85em; color: var(--color-text-muted);">Last Updated</span>
        <span class="system-status-value" style="font-size: 0.85em; color: var(--color-text-muted);">${timestamp}</span>
      </div>
      ` : ''}
    </div>
  `;
}

function renderWorkspacesList() {
  const workspaces = window.state?.data?.workspaces || [];
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  // Build comprehensive workspace map from all sources
  const workspaceMap = new Map();
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  // Extract from events
  events.forEach(event => {
    const wsPath = event.workspace_path || event.workspacePath || event.workspace;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, {
          path: wsPath,
          name: wsPath.split('/').pop() || 'Unknown',
          events: 0,
          entries: 0,
          promptCount: 0,
          lastActivity: 0,
          recentActivity: 0
        });
      }
      const ws = workspaceMap.get(wsPath);
      ws.events++;
      
      // Track last activity time
      const eventTime = event.timestamp ? new Date(event.timestamp).getTime() : 0;
      if (eventTime > ws.lastActivity) {
        ws.lastActivity = eventTime;
      }
      if (eventTime >= sevenDaysAgo) {
        ws.recentActivity++;
      }
    }
  });
  
  // Extract from prompts
  prompts.forEach(prompt => {
    const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, {
          path: wsPath,
          name: wsPath.split('/').pop() || 'Unknown',
          events: 0,
          entries: 0,
          promptCount: 0,
          lastActivity: 0,
          recentActivity: 0
        });
      }
      const ws = workspaceMap.get(wsPath);
      ws.promptCount++;
      
      // Track last activity time
      const promptTime = prompt.timestamp ? new Date(prompt.timestamp).getTime() : 0;
      if (promptTime > ws.lastActivity) {
        ws.lastActivity = promptTime;
      }
      if (promptTime >= sevenDaysAgo) {
        ws.recentActivity++;
      }
    }
  });
  
  // Merge with provided workspaces data
  workspaces.forEach(ws => {
    const wsPath = ws.path || ws.id || ws.name;
    if (wsPath) {
      if (!workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, {
          path: wsPath,
          name: ws.name || wsPath.split('/').pop() || 'Unknown',
          events: ws.events || ws.eventCount || 0,
          entries: ws.entries || 0,
          promptCount: ws.promptCount || 0,
          lastActivity: 0,
          recentActivity: 0
        });
      } else {
        // Update with provided data if available
        const existing = workspaceMap.get(wsPath);
        existing.events = existing.events || ws.events || ws.eventCount || 0;
        existing.entries = existing.entries || ws.entries || 0;
        existing.promptCount = existing.promptCount || ws.promptCount || 0;
      }
    }
  });
  
  const allWorkspaces = Array.from(workspaceMap.values());
  
  if (allWorkspaces.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">No workspaces detected</div>
        <div class="empty-state-hint" style="font-size: 0.85em; margin-top: 8px; line-height: 1.5;">
          Workspaces will appear as you work in different projects. Make sure the companion service is running and monitoring your activity.
          <br><br>
          <span style="font-size: 0.9em; color: var(--color-text-subtle);">
            Workspaces are automatically detected from file paths in your events and prompts.
          </span>
        </div>
      </div>
    `;
  }
  
  // Separate active (recent activity in last 7 days) and non-active workspaces
  const activeWorkspaces = allWorkspaces.filter(ws => ws.recentActivity > 0 || ws.lastActivity >= sevenDaysAgo);
  const nonActiveWorkspaces = allWorkspaces.filter(ws => ws.recentActivity === 0 && ws.lastActivity < sevenDaysAgo);
  
  // Sort active by recent activity, non-active by total activity
  activeWorkspaces.sort((a, b) => (b.recentActivity || 0) - (a.recentActivity || 0));
  nonActiveWorkspaces.sort((a, b) => (b.events + b.promptCount) - (a.events + a.promptCount));
  
  const renderWorkspaceItem = (ws, isActive = true) => {
    const name = ws.name || ws.path?.split('/').pop() || ws.path || 'Unknown';
    const eventCount = ws.events || 0;
    const entryCount = ws.entries || 0;
    const promptCount = ws.promptCount || 0;
    const wsPath = ws.path || '';
    const escapedPath = window.escapeHtml ? window.escapeHtml(wsPath) : wsPath;
    
    return `
      <div class="workspace-item ${!isActive ? 'workspace-item-inactive' : ''}">
        <div class="workspace-item-title">
          <span class="workspace-item-title-text">${window.escapeHtml ? window.escapeHtml(name) : name}</span>
          ${!isActive ? '<span class="workspace-item-badge" style="font-size: 0.7rem; color: var(--color-text-muted); margin-left: var(--space-xs);">(inactive)</span>' : ''}
          <div class="workspace-item-title-fade"></div>
        </div>
        <div class="workspace-item-meta" style="display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap;">
          <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap;">
            ${eventCount > 0 ? `<span>${eventCount} events</span>` : ''}
            ${entryCount > 0 ? `<span>${entryCount} entries</span>` : ''}
            ${promptCount > 0 ? `<span>${promptCount} prompts</span>` : ''}
            ${eventCount === 0 && entryCount === 0 && promptCount === 0 ? '<span>No activity</span>' : ''}
          </div>
          ${wsPath ? `<button class="btn btn-sm" onclick="if(window.showShareModal) window.showShareModal(['${escapedPath}']); else alert('Sharing feature not available');" title="Share this workspace" style="margin-left: auto; padding: 4px 8px; font-size: 0.75rem;">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="vertical-align: middle;">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
            </svg>
            Share
          </button>` : ''}
        </div>
      </div>
    `;
  };
  
  return `
    <div class="workspaces-list">
      ${activeWorkspaces.length > 0 ? `
        ${activeWorkspaces.map(ws => renderWorkspaceItem(ws, true)).join('')}
      ` : ''}
      ${nonActiveWorkspaces.length > 0 ? `
        ${activeWorkspaces.length > 0 ? '<div style="margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--color-border);"><div style="font-size: var(--text-sm); font-weight: 600; color: var(--color-text-muted); margin-bottom: var(--space-md);">Other Projects</div></div>' : ''}
        ${nonActiveWorkspaces.map(ws => renderWorkspaceItem(ws, false)).join('')}
      ` : ''}
    </div>
  `;
}

function renderWorkspacesVisual() {
  const workspaces = window.state?.data?.workspaces || [];
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  // Build workspace activity map
  const workspaceMap = new Map();
  
  // Extract from events
  events.forEach(event => {
    const wsPath = event.workspace_path || event.workspacePath || event.workspace;
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
  
  // Extract from prompts
  prompts.forEach(prompt => {
    const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId;
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
  
  // Use provided workspaces if available
  if (workspaces.length > 0) {
    workspaces.forEach(ws => {
      const wsPath = ws.path || ws.name;
      if (wsPath && !workspaceMap.has(wsPath)) {
        workspaceMap.set(wsPath, {
          path: wsPath,
          name: ws.name || wsPath.split('/').pop() || 'Unknown',
          events: ws.events || ws.eventCount || 0,
          prompts: ws.promptCount || 0
        });
      }
    });
  }
  
  const workspaceList = Array.from(workspaceMap.values());
  
  if (workspaceList.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">No workspaces detected</div>
        <div class="empty-state-hint" style="font-size: 0.85em; margin-top: 8px; line-height: 1.5;">
          Workspaces will appear as you work in different projects.
        </div>
      </div>
    `;
  }
  
  // Calculate max activity for normalization
  const maxActivity = Math.max(...workspaceList.map(ws => ws.events + ws.prompts), 1);
  
  // Sort by activity
  workspaceList.sort((a, b) => (b.events + b.prompts) - (a.events + a.prompts));
  
  return `
    <div class="workspaces-visual">
      ${workspaceList.slice(0, 5).map(ws => {
        const totalActivity = ws.events + ws.prompts;
        const activityPercent = (totalActivity / maxActivity) * 100;
        return `
          <div class="workspace-visual-item" onclick="if(window.switchView) window.switchView('activity'); if(window.setWorkspaceFilter) window.setWorkspaceFilter('${ws.path}')" style="cursor: pointer;">
            <div class="workspace-visual-name">${window.escapeHtml ? window.escapeHtml(ws.name) : ws.name}</div>
            <div class="workspace-visual-bar">
              <div class="workspace-visual-bar-fill" style="width: ${activityPercent}%;"></div>
            </div>
            <div class="workspace-visual-stats">
              <span>${ws.events} events</span>
              ${ws.prompts > 0 ? `<span>${ws.prompts} prompts</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
      ${workspaceList.length > 5 ? `
        <div class="workspace-visual-more">
          +${workspaceList.length - 5} more workspace${workspaceList.length - 5 !== 1 ? 's' : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// Export to window for global access
window.renderSystemStatus = renderSystemStatus;
window.renderWorkspacesList = renderWorkspacesList;
window.renderWorkspacesVisual = renderWorkspacesVisual;

