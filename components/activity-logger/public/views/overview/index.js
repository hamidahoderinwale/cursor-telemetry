/**
 * Overview View
 * HTML templates moved to views/overview/helpers.js
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
          ${recentEvents.length > 0 ? window.renderActivityTimeline(recentEvents) : '<div class="empty-state"><div class="empty-state-text">No recent activity</div></div>'}
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
}

// Export to window for global access
window.renderOverviewView = renderOverviewView;

// Note: renderSystemStatus and renderWorkspacesList are in views/overview/helpers.js

