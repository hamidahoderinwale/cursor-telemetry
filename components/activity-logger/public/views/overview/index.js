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
  
  // Calculate programming language distribution
  const languageMap = {
    '.py': 'Python',
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.jsx': 'JavaScript',
    '.tsx': 'TypeScript',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.h': 'C',
    '.go': 'Go',
    '.rs': 'Rust',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.scala': 'Scala',
    '.cs': 'C#',
    '.vb': 'VB.NET',
    '.fs': 'F#',
    '.r': 'R',
    '.m': 'Objective-C',
    '.mm': 'Objective-C++',
    '.clj': 'Clojure',
    '.hs': 'Haskell',
    '.ml': 'OCaml',
    '.erl': 'Erlang',
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.zsh': 'Shell',
    '.fish': 'Shell',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'SASS',
    '.less': 'Less',
    '.json': 'JSON',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.xml': 'XML',
    '.md': 'Markdown',
    '.txt': 'Text',
    '.csv': 'CSV',
    '.ipynb': 'Jupyter',
    '.sql': 'SQL',
    '.vue': 'Vue',
    '.svelte': 'Svelte'
  };
  
  const languageStats = new Map();
  let totalFileChanges = 0;
  
  events.forEach(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const filePath = details.file_path || details.filePath || event.file || event.filePath;
      
      if (filePath) {
        const ext = '.' + filePath.split('.').pop().toLowerCase();
        const language = languageMap[ext] || 'Other';
        const current = languageStats.get(language) || 0;
        languageStats.set(language, current + 1);
        totalFileChanges++;
      }
    } catch (e) {
      // Ignore parse errors
    }
  });
  
  // Sort languages by percentage and get top languages
  const languageData = Array.from(languageStats.entries())
    .map(([lang, count]) => ({
      language: lang,
      count: count,
      percentage: totalFileChanges > 0 ? parseFloat(((count / totalFileChanges) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.percentage - a.percentage) // Sort by percentage (descending)
    .slice(0, 10); // Top 10 languages
  
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
            <div class="quick-stat-value">${workspaceCount > 0 ? workspaceCount : '-'}</div>
            <div class="quick-stat-label">Workspaces</div>
          </div>
        </div>
        <div class="hero-actions">
          <a href="#activity" class="btn btn-primary" onclick="window.switchView('activity')">View Activity</a>
          <a href="#analytics" class="btn" onclick="window.switchView('analytics')">View Analytics</a>
        </div>
      </div>
      
      <!-- Two Column Layout -->
      <div class="overview-grid-2col">
        
        <!-- Programming Languages -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Programming Languages</h3>
            <p class="card-subtitle">Distribution of file changes by language</p>
          </div>
          <div class="card-body">
            ${languageData.length > 0 ? `
              <div class="language-stats">
                ${languageData.map(({ language, count, percentage }) => `
                  <div class="language-stat-item">
                    <div class="language-stat-header">
                      <span class="language-name">${window.escapeHtml ? window.escapeHtml(language) : language}</span>
                      <span class="language-count">${count}</span>
                    </div>
                    <div class="language-stat-bar">
                      <div class="language-stat-bar-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="language-stat-percentage">${percentage}%</div>
                  </div>
                `).join('')}
                ${languageStats.size > 10 ? `
                  <div class="language-stat-footer">
                    <span class="language-stat-hint">Showing top 10 of ${languageStats.size} languages</span>
                  </div>
                ` : ''}
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-state-text">No language data available</div>
                <div class="empty-state-hint">File changes will appear here as you code</div>
              </div>
            `}
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
}

// Export to window for global access
window.renderOverviewView = renderOverviewView;

