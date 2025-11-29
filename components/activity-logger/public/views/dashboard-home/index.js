/**
 * Unified Dashboard Homepage
 * Modern, personalized dashboard with smart insights
 */

async function renderDashboardHome(container) {
  container.innerHTML = `
    <div class="dashboard-home">
      <!-- Header -->
      <div class="dashboard-home-header">
        <div>
          <h1 class="dashboard-home-title">Dashboard</h1>
          <p class="dashboard-home-subtitle">Your development activity at a glance</p>
        </div>
        <div class="dashboard-home-actions">
          <button class="btn btn-secondary btn-sm" onclick="window.exportData()">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
            </svg>
            Export
          </button>
        </div>
      </div>

      <!-- At-a-Glance Metrics -->
      <div class="dashboard-home-metrics">
        <div class="metric-card card">
          <div class="metric-label">Today's Activity</div>
          <div class="metric-value" id="metric-today-events">-</div>
          <div class="metric-change" id="metric-today-change">
            <span class="metric-change-icon">-</span>
            <span>Loading...</span>
          </div>
        </div>

        <div class="metric-card card">
          <div class="metric-label">Context Precision</div>
          <div class="metric-value" id="metric-cp-score">-</div>
          <div class="metric-change" id="metric-cp-change">
            <span class="metric-change-icon">-</span>
            <span>Loading...</span>
          </div>
        </div>

        <div class="metric-card card">
          <div class="metric-label">Active Workspaces</div>
          <div class="metric-value" id="metric-workspaces">-</div>
          <div class="metric-change neutral">
            <span>This week</span>
          </div>
        </div>

        <div class="metric-card card">
          <div class="metric-label">Patterns Discovered</div>
          <div class="metric-value" id="metric-patterns">-</div>
          <div class="metric-change neutral">
            <span>Total patterns</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="dashboard-home-section">
        <h2 class="section-title">Quick Actions</h2>
        <div class="quick-actions-grid">
          <button class="quick-action-card card" onclick="window.switchView('activity')">
            <div class="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
              </svg>
            </div>
            <div class="quick-action-content">
              <div class="quick-action-title">View Activity</div>
              <div class="quick-action-desc">Timeline of all events</div>
            </div>
          </button>

          <button class="quick-action-card card" onclick="window.switchView('context-precision')">
            <div class="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div class="quick-action-content">
              <div class="quick-action-title">Context Precision</div>
              <div class="quick-action-desc">Analyze context efficiency</div>
            </div>
          </button>

          <button class="quick-action-card card" onclick="window.switchView('patterns')">
            <div class="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
              </svg>
            </div>
            <div class="quick-action-content">
              <div class="quick-action-title">Patterns</div>
              <div class="quick-action-desc">Discover behavioral patterns</div>
            </div>
          </button>

          <button class="quick-action-card card" onclick="window.switchView('analytics')">
            <div class="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
            </div>
            <div class="quick-action-content">
              <div class="quick-action-title">Analytics</div>
              <div class="quick-action-desc">Deep insights & metrics</div>
            </div>
          </button>
        </div>
      </div>

      <!-- Smart Insights -->
      <div class="dashboard-home-section">
        <h2 class="section-title">Insights</h2>
        <div class="insights-grid" id="insights-container">
          <div class="insight-card card">
            <div class="card-title">Loading insights...</div>
            <div class="card-body">Analyzing your data...</div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="dashboard-home-section">
        <div class="section-header">
          <h2 class="section-title">Recent Activity</h2>
          <a href="#activity" class="btn btn-ghost btn-sm" onclick="window.switchView('activity')">
            View All
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
            </svg>
          </a>
        </div>
        <div class="recent-activity-list" id="recent-activity">
          <div class="activity-item-skeleton">
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load data
  await loadDashboardHomeData();
}

async function loadDashboardHomeData() {
  const state = window.state || {};
  const data = state.data || {};
  
  // Calculate today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const events = (data.events || []).filter(e => {
    const eventDate = new Date(e.timestamp || e.id);
    return eventDate >= today;
  });
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEvents = (data.events || []).filter(e => {
    const eventDate = new Date(e.timestamp || e.id);
    return eventDate >= yesterday && eventDate < today;
  });
  
  // Update metrics
  const todayCount = events.length;
  const yesterdayCount = yesterdayEvents.length;
  const change = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(0) : 0;
  
  document.getElementById('metric-today-events').textContent = todayCount;
  const todayChangeEl = document.getElementById('metric-today-change');
  if (change > 0) {
    todayChangeEl.className = 'metric-change positive';
    todayChangeEl.innerHTML = `
      <svg class="metric-change-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"/>
      </svg>
      <span>+${change}% from yesterday</span>
    `;
  } else if (change < 0) {
    todayChangeEl.className = 'metric-change negative';
    todayChangeEl.innerHTML = `
      <svg class="metric-change-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z"/>
      </svg>
      <span>${change}% from yesterday</span>
    `;
  } else {
    todayChangeEl.className = 'metric-change neutral';
    todayChangeEl.innerHTML = `<span>Same as yesterday</span>`;
  }
  
  // Workspaces
  const workspaces = new Set();
  (data.events || []).forEach(e => {
    if (e.workspace_path || e.workspacePath) {
      workspaces.add(e.workspace_path || e.workspacePath);
    }
  });
  document.getElementById('metric-workspaces').textContent = workspaces.size;
  
  // Calculate average CP (simplified)
  const prompts = data.prompts || [];
  let totalCP = 0;
  let cpCount = 0;
  
  prompts.forEach(p => {
    const cp = p.context_precision || p.cp || p.contextPrecision;
    if (cp !== undefined && cp !== null) {
      totalCP += cp;
      cpCount++;
    }
  });
  
  const avgCP = cpCount > 0 ? (totalCP / cpCount) : 0;
  document.getElementById('metric-cp-score').textContent = avgCP > 0 ? avgCP.toFixed(2) : 'N/A';
  
  // Load insights
  await loadInsights(data);
  
  // Load recent activity
  loadRecentActivity(data);
}

async function loadInsights(data) {
  const insights = [];
  const container = document.getElementById('insights-container');
  
  // Insight 1: Time spent analysis
  const events = data.events || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEvents = events.filter(e => {
    const eventDate = new Date(e.timestamp || e.id);
    return eventDate >= today;
  });
  
  if (todayEvents.length > 10) {
    insights.push({
      type: 'info',
      title: 'Active Day',
      message: `You've had ${todayEvents.length} events today. Keep up the momentum!`
    });
  }
  
  // Insight 2: CP improvement
  const prompts = data.prompts || [];
  if (prompts.length > 0) {
    const recentPrompts = prompts.slice(0, 10);
    const olderPrompts = prompts.slice(10, 20);
    
    let recentCP = 0, recentCount = 0;
    let olderCP = 0, olderCount = 0;
    
    recentPrompts.forEach(p => {
      const cp = p.context_precision || p.cp;
      if (cp) { recentCP += cp; recentCount++; }
    });
    
    olderPrompts.forEach(p => {
      const cp = p.context_precision || p.cp;
      if (cp) { olderCP += cp; olderCount++; }
    });
    
    if (recentCount > 0 && olderCount > 0) {
      const recentAvg = recentCP / recentCount;
      const olderAvg = olderCP / olderCount;
      const improvement = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(0);
      
      if (improvement > 5) {
        insights.push({
          type: 'success',
          title: 'Improving Context Usage',
          message: `Your Context Precision improved by ${improvement}% recently!`
        });
      }
    }
  }
  
  // Insight 3: Pattern detection
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      title: 'Getting Started',
      message: 'Continue using Cursor to discover patterns in your workflow.'
    });
  }
  
  container.innerHTML = insights.map(insight => `
    <div class="insight-card card">
      <div class="card-title">${insight.title}</div>
      <div class="card-body">${insight.message}</div>
    </div>
  `).join('');
}

function loadRecentActivity(data) {
  const container = document.getElementById('recent-activity');
  const events = (data.events || []).slice(0, 10);
  
  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }
  
  container.innerHTML = events.map(event => {
    const date = new Date(event.timestamp || event.id);
    const timeAgo = getTimeAgo(date);
    const type = event.type || 'event';
    
    return `
      <div class="activity-item">
        <div class="activity-item-icon">
          ${getEventIcon(type)}
        </div>
        <div class="activity-item-content">
          <div class="activity-item-title">${event.type || 'Event'}</div>
          <div class="activity-item-meta">${timeAgo}</div>
        </div>
        <div class="activity-item-action">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="window.switchView('activity')">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getEventIcon(type) {
  const icons = {
    'file_change': '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/></svg>',
    'prompt': '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z"/></svg>',
    'terminal': '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5v13A1.5 1.5 0 003.5 18h13a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-13zM4 4h12v12H4V4zm2 3a1 1 0 000 2h6a1 1 0 100-2H6z"/></svg>',
  };
  
  return icons[type] || '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><circle cx="10" cy="10" r="8"/></svg>';
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Export for view router
if (typeof window !== 'undefined') {
  window.renderDashboardHome = renderDashboardHome;
}

