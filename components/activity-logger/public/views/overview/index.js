/**
 * Overview View - Redesigned
 * Clean, unique visualizations focused on high-level insights
 */

function renderOverviewView(container) {
  const events = window.filterEventsByWorkspace ? window.filterEventsByWorkspace(window.state?.data?.events || []) : (window.state?.data?.events || []);
  const prompts = window.state?.data?.prompts || [];
  const terminalCommands = window.state?.data?.terminalCommands || [];
  
  // Calculate summary stats
  const stats = window.state?.stats || {};
  const totalEvents = events.length;
  const totalPrompts = prompts.length;
  
  // Calculate code changed
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
  
  // Calculate today's activity
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEvents = events.filter(e => {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    return ts >= todayStart;
  }).length;
  const todayPrompts = prompts.filter(p => {
    const ts = p.timestamp ? new Date(p.timestamp).getTime() : 0;
    return ts >= todayStart;
  }).length;
  
  // Calculate this week's activity
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const weekEvents = events.filter(e => {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    return ts >= sevenDaysAgo;
  }).length;
  const weekPrompts = prompts.filter(p => {
    const ts = p.timestamp ? new Date(p.timestamp).getTime() : 0;
    return ts >= sevenDaysAgo;
  }).length;
  
  // Calculate active days in last 7 days
  const activeDays = new Set();
  [...events, ...prompts, ...terminalCommands].forEach(item => {
    const timestamp = item.timestamp ? new Date(item.timestamp).getTime() : 0;
    if (timestamp >= sevenDaysAgo) {
      const day = new Date(timestamp).toDateString();
      activeDays.add(day);
    }
  });
  
  // Calculate activity by hour for rhythm visualization
  const activityByHour = new Array(24).fill(0);
  [...events, ...prompts].forEach(item => {
    if (item.timestamp) {
      const hour = new Date(item.timestamp).getHours();
      activityByHour[hour]++;
    }
  });
  const maxHourlyActivity = Math.max(...activityByHour, 1);
  
  // Calculate activity by day of week
  const activityByDay = new Array(7).fill(0);
  [...events, ...prompts].forEach(item => {
    if (item.timestamp) {
      const day = new Date(item.timestamp).getDay();
      activityByDay[day]++;
    }
  });
  const maxDailyActivity = Math.max(...activityByDay, 1);
  
  // Get workspace count
  const workspaceCount = window.state.stats?.workspaces || window.state.data?.workspaces?.length || 0;
  
  // Calculate streak (consecutive days with activity)
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dayStart = checkDate.getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);
    
    const hasActivity = [...events, ...prompts, ...terminalCommands].some(item => {
      const ts = item.timestamp ? new Date(item.timestamp).getTime() : 0;
      return ts >= dayStart && ts < dayEnd;
    });
    
    if (hasActivity) {
      streak++;
    } else {
      break;
    }
  }
  
  // Get top files today
  const fileActivityToday = new Map();
  todayEvents > 0 && events.forEach(event => {
    const ts = event.timestamp ? new Date(event.timestamp).getTime() : 0;
    if (ts >= todayStart) {
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        const filePath = details.file_path || details.filePath || event.file || event.filePath;
        if (filePath) {
          const fileName = filePath.split('/').pop();
          fileActivityToday.set(fileName, (fileActivityToday.get(fileName) || 0) + 1);
        }
      } catch (e) {
        // Ignore
      }
    }
  });
  const topFilesToday = Array.from(fileActivityToday.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Get most active workspace
  const workspaceActivity = new Map();
  [...events, ...prompts].forEach(item => {
    const wsPath = item.workspace_path || item.workspacePath || item.workspace || item.workspaceName;
    if (wsPath) {
      workspaceActivity.set(wsPath, (workspaceActivity.get(wsPath) || 0) + 1);
    }
  });
  const mostActiveWorkspace = Array.from(workspaceActivity.entries())
    .sort((a, b) => b[1] - a[1])[0];
  
  // Calculate productivity pulse (current activity vs average)
  const avgDailyActivity = (weekEvents + weekPrompts) / 7;
  const currentActivity = todayEvents + todayPrompts;
  const productivityPulse = avgDailyActivity > 0 ? (currentActivity / avgDailyActivity) * 100 : 0;
  
  container.innerHTML = `
    <div class="overview-view">
      
      <!-- Hero Section -->
      <div class="overview-hero">
        <div class="hero-main-stat">
          <div class="hero-stat-value">${todayEvents + todayPrompts}</div>
          <div class="hero-stat-label">Activities Today</div>
          <div class="hero-stat-hint">${todayEvents} file changes, ${todayPrompts} AI prompts</div>
        </div>
        <div class="hero-quick-stats">
          <div class="quick-stat">
            <div class="quick-stat-value">${activeDays.size}</div>
            <div class="quick-stat-label">Active Days (7d)</div>
          </div>
          <div class="quick-stat">
            <div class="quick-stat-value">${streak}</div>
            <div class="quick-stat-label">Day Streak</div>
          </div>
          <div class="quick-stat">
            <div class="quick-stat-value">${workspaceCount > 0 ? workspaceCount : '-'}</div>
            <div class="quick-stat-label">Workspaces</div>
          </div>
        </div>
        <div class="hero-actions">
          <a href="#activity" class="btn btn-primary" onclick="window.switchView('activity')">View Activity</a>
          <a href="#analytics" class="btn" onclick="window.switchView('analytics')">View Analytics</a>
        </div>
      </div>
      
      <!-- Activity Heatmap -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Activity Heatmap</h3>
          <p class="card-subtitle">Past year of development activity</p>
        </div>
        <div class="card-body">
          <div id="activityHeatmap"></div>
        </div>
      </div>
      
      <!-- Two Column Layout -->
      <div class="overview-grid-2col">
        
        <!-- Activity Rhythm -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Activity Rhythm</h3>
            <p class="card-subtitle">Your coding patterns by hour of day</p>
          </div>
          <div class="card-body">
            <div id="activityRhythmChart" class="activity-rhythm-chart"></div>
          </div>
        </div>
        
        <!-- Productivity Pulse -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Productivity Pulse</h3>
            <p class="card-subtitle">Today vs. weekly average</p>
          </div>
          <div class="card-body">
              <div class="productivity-pulse">
              <div class="pulse-gauge">
                <svg viewBox="0 0 200 120" class="pulse-svg">
                  <path d="M 20 100 A 80 80 0 0 1 180 100" 
                        fill="none" 
                        stroke="var(--color-border)" 
                        stroke-width="8" 
                        stroke-linecap="round"/>
                  <path d="M 20 100 A 80 80 0 0 1 180 100" 
                        fill="none" 
                        stroke="var(--color-primary)" 
                        stroke-width="8" 
                        stroke-linecap="round"
                        stroke-dasharray="${Math.min(100, productivityPulse) / 100 * 251.2} 251.2"
                        class="pulse-arc"/>
                  <text x="100" y="75" text-anchor="middle" class="pulse-value">${productivityPulse.toFixed(0)}%</text>
                  <text x="100" y="90" text-anchor="middle" class="pulse-label">of weekly avg</text>
                </svg>
              </div>
              <div class="pulse-stats">
                <div class="pulse-stat-item">
                  <span class="pulse-stat-label">Today</span>
                  <span class="pulse-stat-value">${currentActivity}</span>
                </div>
                <div class="pulse-stat-item">
                  <span class="pulse-stat-label">Daily Avg</span>
                  <span class="pulse-stat-value">${avgDailyActivity.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
      </div>
      
      <!-- Two Column Layout -->
      <div class="overview-grid-2col">
        
        <!-- Workspaces -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Workspaces</h3>
            <p class="card-subtitle">Your active projects</p>
          </div>
          <div class="card-body">
            ${window.renderWorkspacesVisual ? window.renderWorkspacesVisual() : (window.renderWorkspacesList ? window.renderWorkspacesList() : '<div class="empty-state"><div class="empty-state-text">Workspaces not available</div></div>')}
          </div>
        </div>
        
        <!-- Top Files Today -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Top Files Today</h3>
            <p class="card-subtitle">Most edited files</p>
          </div>
          <div class="card-body">
            ${topFilesToday.length > 0 ? `
              <div class="top-files-list">
                ${topFilesToday.map(([fileName, count], index) => `
                  <div class="top-file-item">
                    <div class="top-file-rank">${index + 1}</div>
                    <div class="top-file-info">
                      <div class="top-file-name">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</div>
                      <div class="top-file-count">${count} edit${count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-state-text">No file edits today</div>
                <div class="empty-state-hint">Start coding to see your most active files</div>
              </div>
            `}
          </div>
        </div>
        
      </div>
      
      <!-- Streak Tracker -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Coding Streak</h3>
          <p class="card-subtitle">Consecutive days with activity</p>
        </div>
        <div class="card-body">
          <div class="streak-display">
            <div class="streak-number">${streak}</div>
            <div class="streak-label">day${streak !== 1 ? 's' : ''} in a row</div>
          </div>
          ${streak > 0 ? `
            <div class="streak-hint">Keep it up! You're on a roll.</div>
          ` : `
            <div class="streak-hint">Start coding today to begin your streak!</div>
          `}
        </div>
      </div>
      
    </div>
  `;
  
  // Fetch and update workspace count
  (async () => {
    let workspaceCount = window.state.stats?.workspaces || window.state.data?.workspaces?.length || 0;
    
    if (workspaceCount === 0 && window.APIClient) {
      try {
        const workspaces = await window.APIClient.get('/api/workspaces', {
          timeout: 5000,
          retries: 1,
          silent: true
        }).catch(() => null);
        
        if (workspaces && Array.isArray(workspaces) && workspaces.length > 0) {
          workspaceCount = workspaces.length;
          if (!window.state.stats) window.state.stats = {};
          window.state.stats.workspaces = workspaceCount;
          if (!window.state.data) window.state.data = {};
          window.state.data.workspaces = workspaces;
        }
      } catch (err) {
        console.debug('[OVERVIEW] Could not fetch workspaces:', err.message);
      }
    }
  })();
  
  // Render visualizations after DOM is ready
  setTimeout(() => {
    // Render heatmap
    const heatmapContainer = document.getElementById('activityHeatmap');
    if (heatmapContainer && window.renderActivityHeatmap) {
      window.renderActivityHeatmap(heatmapContainer);
    } else if (heatmapContainer) {
      heatmapContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text" style="font-style: normal;">Heatmap renderer not available</div>
        </div>
      `;
    }
    
    // Render activity rhythm with D3
    const rhythmContainer = document.getElementById('activityRhythmChart');
    if (rhythmContainer && window.renderActivityRhythm) {
      window.renderActivityRhythm(rhythmContainer, activityByHour);
    } else if (rhythmContainer) {
      rhythmContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-text" style="font-style: normal;">Activity rhythm renderer not available</div>
        </div>
      `;
    }
  }, 100);
  
  // Retry after D3 loads (if deferred)
  setTimeout(() => {
    const rhythmContainer = document.getElementById('activityRhythmChart');
    if (rhythmContainer && window.renderActivityRhythm && typeof d3 !== 'undefined') {
      window.renderActivityRhythm(rhythmContainer, activityByHour);
    }
  }, 500);
}

// Export to window for global access
window.renderOverviewView = renderOverviewView;
