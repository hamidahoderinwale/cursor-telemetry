/**
 * Overview View
 * HTML templates moved to views/overview/helpers.js
 */

function renderOverviewView(container) {
  const events = window.filterEventsByWorkspace ? window.filterEventsByWorkspace(window.state?.data?.events || []) : (window.state?.data?.events || []);
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Merge events, prompts, and terminal commands into unified timeline for recent activity
  const recentItems = [
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
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 10); // Show 10 most recent items

  container.innerHTML = `
    <div class="overview-view">
      
      <!-- Activity Heatmap -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Activity Heatmap</h3>
          <p class="card-subtitle">Last 7 days of development activity (click cells to filter)</p>
        </div>
        <div class="card-body">
          <div id="activityHeatmap"></div>
        </div>
      </div>
      
      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recent Activity</h3>
          <p class="card-subtitle" style="font-size: 0.85em; color: var(--color-text-muted); margin-top: 4px;">
            ${recentItems.length} items (${events.length} file changes, ${prompts.length} AI prompts, ${terminalCommands.length} terminal commands)
          </p>
        </div>
        <div class="card-body">
          ${recentItems.length > 0 ? window.renderUnifiedTimeline(recentItems) : '<div class="empty-state"><div class="empty-state-text">No recent activity</div></div>'}
        </div>
      </div>

      <!-- System Status -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">System Status</h3>
        </div>
        <div class="card-body">
          ${window.renderSystemStatus()}
        </div>
      </div>

      <!-- Workspaces -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Workspaces</h3>
        </div>
        <div class="card-body">
          ${window.renderWorkspacesList()}
        </div>
      </div>

    </div>
  `;
  
  // Render heatmap after DOM is ready
  setTimeout(() => {
    const heatmapContainer = document.getElementById('activityHeatmap');
    if (heatmapContainer && window.renderActivityHeatmap) {
      window.renderActivityHeatmap(heatmapContainer);
    }
  }, 100);
}

// Export to window for global access
window.renderOverviewView = renderOverviewView;

// Note: renderSystemStatus and renderWorkspacesList are in views/overview/helpers.js

