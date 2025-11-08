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
        <div class="empty-state-text">System monitoring not active</div>
        <div class="empty-state-hint" style="font-size: 0.85em; margin-top: 8px;">
          System resource monitoring is optional. Enable it in the companion service to see CPU, memory, and load metrics.
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
  
  if (workspaces.length === 0) {
    // Try to extract workspaces from events and prompts if not available
    const workspaceMap = new Map();
    
    // Extract from events
    (window.state?.data?.events || []).forEach(event => {
      const wsPath = event.workspace_path || event.workspacePath || event.workspace;
      if (wsPath) {
        if (!workspaceMap.has(wsPath)) {
          workspaceMap.set(wsPath, {
            path: wsPath,
            name: wsPath.split('/').pop() || 'Unknown',
            events: 0,
            entries: 0,
            promptCount: 0
          });
        }
        workspaceMap.get(wsPath).events++;
      }
    });
    
    // Extract from prompts
    (window.state?.data?.prompts || []).forEach(prompt => {
      const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId;
      if (wsPath) {
        if (!workspaceMap.has(wsPath)) {
          workspaceMap.set(wsPath, {
            path: wsPath,
            name: wsPath.split('/').pop() || 'Unknown',
            events: 0,
            entries: 0,
            promptCount: 0
          });
        }
        workspaceMap.get(wsPath).promptCount++;
      }
    });
    
    const extractedWorkspaces = Array.from(workspaceMap.values());
    
    if (extractedWorkspaces.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-text">No workspaces detected</div>
          <div class="empty-state-hint" style="font-size: 0.85em; margin-top: 8px;">
            Workspaces will appear as you work in different projects. Make sure the companion service is running and monitoring your activity.
          </div>
        </div>
      `;
    }
    
    // Use extracted workspaces
    return `
      <div class="workspaces-list">
        ${extractedWorkspaces.map(ws => `
          <div class="workspace-item">
            <div class="workspace-item-title">
              <span class="workspace-item-title-text">${window.escapeHtml ? window.escapeHtml(ws.name) : ws.name}</span>
              <div class="workspace-item-title-fade"></div>
            </div>
            <div class="workspace-item-meta">
              <span>${ws.events || 0} events</span>
              ${ws.promptCount > 0 ? `<span>${ws.promptCount} prompts</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="workspaces-list">
      ${workspaces.map(ws => {
        const name = ws.name || ws.path?.split('/').pop() || ws.path || 'Unknown';
        const eventCount = ws.events || ws.eventCount || 0;
        const entryCount = ws.entries || ws.entryCount || 0;
        const promptCount = ws.promptCount || 0;
        
        return `
          <div class="workspace-item">
            <div class="workspace-item-title">
              <span class="workspace-item-title-text">${window.escapeHtml ? window.escapeHtml(name) : name}</span>
              <div class="workspace-item-title-fade"></div>
            </div>
            <div class="workspace-item-meta">
              ${eventCount > 0 ? `<span>${eventCount} events</span>` : ''}
              ${entryCount > 0 ? `<span>${entryCount} entries</span>` : ''}
              ${promptCount > 0 ? `<span>${promptCount} prompts</span>` : ''}
              ${eventCount === 0 && entryCount === 0 && promptCount === 0 ? '<span>No activity</span>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Export to window for global access
window.renderSystemStatus = renderSystemStatus;
window.renderWorkspacesList = renderWorkspacesList;

