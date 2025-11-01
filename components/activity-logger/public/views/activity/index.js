/**
 * Activity View
 */

function renderActivityView(container) {
  const events = window.filterEventsByWorkspace ? window.filterEventsByWorkspace(window.state?.data?.events || []) : (window.state?.data?.events || []);
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Merge events, prompts, and terminal commands into unified timeline
  const timelineItems = [
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
  ].sort((a, b) => b.sortTime - a.sortTime).slice(0, 100);
  
  container.innerHTML = `
    <div class="activity-view">
      
      <!-- Unified Activity Timeline -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Activity Timeline</h3>
            <p class="card-subtitle">${timelineItems.length} items (${events.length} file changes, ${prompts.length} AI prompts, ${terminalCommands.length} terminal commands)</p>
          </div>
          <div class="activity-header-controls">
            <select class="select-input" onchange="filterActivityByTimeRange(this.value)">
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>
        <div class="card-body">
          ${timelineItems.length > 0 ? renderUnifiedTimeline(timelineItems) : '<div class="empty-state"><div class="empty-state-text">No activity recorded</div><div class="empty-state-hint">Activity will appear as you work in Cursor</div></div>'}
        </div>
      </div>

    </div>
  `;
}

function filterActivityByTimeRange(range) {
  // Implementation would filter and re-render
  renderActivityView(document.getElementById('content'));
}

// Export to window for global access
window.renderActivityView = renderActivityView;
window.filterActivityByTimeRange = filterActivityByTimeRange;

