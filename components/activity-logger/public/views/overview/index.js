/**
 * Overview View
 * HTML templates moved to views/overview/helpers.js
 */

function renderOverviewView(container) {
  const events = window.filterEventsByWorkspace ? window.filterEventsByWorkspace(window.state?.data?.events || []) : (window.state?.data?.events || []);
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Calculate summary stats
  const stats = window.state?.stats || {};
  const totalEvents = events.length;
  const totalPrompts = prompts.length;
  const totalTerminal = terminalCommands.length;
  
  // Calculate code changed (from events)
  let totalCodeChanged = 0;
  events.forEach(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      if (details.chars_added) totalCodeChanged += details.chars_added;
      if (details.chars_deleted) totalCodeChanged += details.chars_deleted;
    } catch (e) {
      // Ignore parse errors
    }
  });
  const codeChangedKB = (totalCodeChanged / 1024).toFixed(1);
  
  // Calculate average context usage
  let totalContext = 0;
  let contextCount = 0;
  prompts.forEach(prompt => {
    const context = prompt.contextUsage || prompt.context_usage || 0;
    if (context > 0) {
      totalContext += context;
      contextCount++;
    }
  });
  const avgContext = contextCount > 0 ? (totalContext / contextCount).toFixed(1) : 0;
  
  // Calculate active sessions (unique days with activity in last 7 days)
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const activeDays = new Set();
  [...events, ...prompts, ...terminalCommands].forEach(item => {
    const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : 0;
    if (timestamp >= sevenDaysAgo) {
      const day = new Date(timestamp).toDateString();
      activeDays.add(day);
    }
  });
  
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
      sortTime: cmd.timestamp || new Date(cmd.timestamp).getTime(),
      id: cmd.id
    }))
  ]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 10); // Show 10 most recent items

  container.innerHTML = `
    <div class="overview-view">
      
      <!-- Summary Stats -->
      <div class="overview-stats-grid">
        <div class="overview-stat-card" title="Number of unique days in the last 7 days where you had any development activity (file changes, AI prompts, or terminal commands)">
          <div class="overview-stat-value">${activeDays.size}</div>
          <div class="overview-stat-label">Active Sessions (7d)</div>
          <div class="overview-stat-hint">Days with activity in the last week</div>
        </div>
        <div class="overview-stat-card" title="Total number of file modification events tracked. Includes code changes, file saves, and other file-related activities captured by the companion service">
          <div class="overview-stat-value">${totalEvents.toLocaleString()}</div>
          <div class="overview-stat-label">File Changes</div>
          <div class="overview-stat-hint">Total tracked file modifications</div>
        </div>
        <div class="overview-stat-card" title="Total number of AI prompts you've sent to Cursor. This includes all prompts captured from your clipboard and manual entries">
          <div class="overview-stat-value">${totalPrompts.toLocaleString()}</div>
          <div class="overview-stat-label">AI Interactions</div>
          <div class="overview-stat-hint">Total prompts and conversations</div>
        </div>
        <div class="overview-stat-card" title="Total characters added and deleted across all file changes. This is calculated from the actual diff data captured by the companion service">
          <div class="overview-stat-value">${codeChangedKB} KB</div>
          <div class="overview-stat-label">Code Changed</div>
          <div class="overview-stat-hint">Total characters added/deleted</div>
        </div>
        <div class="overview-stat-card" title="Average percentage of the AI context window used across all prompts. Higher percentages indicate more context files were included in your prompts">
          <div class="overview-stat-value">${avgContext}%</div>
          <div class="overview-stat-label">Avg Context Used</div>
          <div class="overview-stat-hint">Average AI context window usage</div>
        </div>
      </div>
      
            <!-- Activity Heatmap -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title" title="Visual representation of your development activity over the last 7 days. Each cell represents one hour. Color indicates code changes: green = more additions, red = more deletions, yellow = balanced. Darkness indicates overall activity level. Click any cell to filter the Activity view to that time period">Activity Heatmap</h3>
                <p class="card-subtitle">Last 7 days of development activity (click cells to filter)</p>
              </div>
        <div class="card-body">
          <div id="activityHeatmap"></div>
        </div>
      </div>
      
            <!-- Recent Activity -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title" title="Most recent development activities including file changes, AI prompts, and terminal commands. Items are sorted by timestamp with the newest first. Click any item to view details">Recent Activity</h3>
                <p class="card-subtitle" style="font-size: 0.85em; color: var(--color-text-muted); margin-top: 4px;">
            ${recentItems.length} items (${totalEvents} file changes, ${totalPrompts} AI prompts, ${totalTerminal} terminal commands)
          </p>
        </div>
        <div class="card-body">
          ${recentItems.length > 0 ? (window.renderUnifiedTimeline ? window.renderUnifiedTimeline(recentItems) : '<div class="empty-state"><div class="empty-state-text">Timeline renderer not available</div></div>') : `
            <div class="empty-state">
              <div class="empty-state-text">No recent activity</div>
              <div class="empty-state-hint" style="font-size: 0.85em; margin-top: 8px; color: var(--color-text-muted);">
                Activity will appear as you work in Cursor. Make sure the companion service is running.
              </div>
            </div>
          `}
        </div>
      </div>

      <!-- Two Column Layout for System Status and Workspaces -->
      <div class="overview-grid-2col">
        <!-- System Status -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" title="Current system resource usage including CPU load, memory consumption, and system load average. Data is collected by the companion service every 5 seconds when running">System Status</h3>
          </div>
          <div class="card-body">
            ${window.renderSystemStatus ? window.renderSystemStatus() : '<div class="empty-state"><div class="empty-state-text">System status not available</div></div>'}
          </div>
        </div>

        <!-- Workspaces -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" title="Detected project workspaces where you've been working. Workspaces are automatically identified from file paths and activity data. Each workspace shows the project name and path">Workspaces</h3>
          </div>
          <div class="card-body">
            ${window.renderWorkspacesList ? window.renderWorkspacesList() : '<div class="empty-state"><div class="empty-state-text">Workspaces not available</div></div>'}
          </div>
        </div>
      </div>

    </div>
  `;
  
  // Render heatmap after DOM is ready
  setTimeout(() => {
    const heatmapContainer = document.getElementById('activityHeatmap');
    if (heatmapContainer && window.renderActivityHeatmap) {
      window.renderActivityHeatmap(heatmapContainer);
    } else if (heatmapContainer) {
      // Show message if heatmap renderer is not available
      heatmapContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text">Heatmap renderer not available</div>
        </div>
      `;
    }
  }, 100);
}

// Export to window for global access
window.renderOverviewView = renderOverviewView;

// Note: renderSystemStatus and renderWorkspacesList are in views/overview/helpers.js

