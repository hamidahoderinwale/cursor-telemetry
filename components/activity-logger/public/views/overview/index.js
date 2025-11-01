/**
 * Overview View
 */

function renderOverviewView(container) {
  const recentEvents = (window.state?.data?.events || []).slice(-10).reverse();

  container.innerHTML = `
    <div class="overview-view">
      
      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recent Activity</h3>
        </div>
        <div class="card-body">
          ${recentEvents.length > 0 ? renderActivityTimeline(recentEvents) : '<div class="empty-state"><div class="empty-state-text">No recent activity</div></div>'}
        </div>
      </div>

      <!-- System Status -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">System Status</h3>
        </div>
        <div class="card-body">
          ${renderSystemStatus()}
        </div>
      </div>

      <!-- Workspaces -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Workspaces</h3>
        </div>
        <div class="card-body">
          ${renderWorkspacesList()}
        </div>
      </div>

    </div>
  `;
}

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
window.renderOverviewView = renderOverviewView;
window.renderSystemStatus = renderSystemStatus;
window.renderWorkspacesList = renderWorkspacesList;

