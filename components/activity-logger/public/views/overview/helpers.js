/**
 * Overview View Helper Functions
 * HTML template functions for Overview view components
 */

function renderSystemStatus() {
  const systemResources = window.state?.data?.systemResources || [];
  const latest = systemResources.length > 0 ? systemResources[systemResources.length - 1] : null;
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

function renderWorkspacesList() {
  const workspaces = window.state?.data?.workspaces || [];
  if (workspaces.length === 0) {
    return '<div class="empty-state-text">No workspaces detected</div>';
  }

  return `
    <div class="workspaces-list">
      ${workspaces.map(ws => `
        <div class="workspace-item">
          <div class="workspace-item-title">
            <span class="workspace-item-title-text">${window.escapeHtml(ws.path.split('/').pop() || ws.path)}</span>
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

// Export to window for global access
window.renderSystemStatus = renderSystemStatus;
window.renderWorkspacesList = renderWorkspacesList;

