/**
 * System View HTML Templates
 * Template functions for System view components
 */

function renderSystemViewTemplate(data) {
  return `
    <div class="system-view">
      <!-- System Resources Over Time Chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">System Resources Over Time</h3>
          <p class="card-subtitle">Memory usage and CPU load tracking</p>
        </div>
        <div class="card-body">
          <canvas id="systemResourcesChart" class="system-chart-container"></canvas>
        </div>
      </div>
    </div>
  `;
}

// Export to window for global access
window.renderSystemViewTemplate = renderSystemViewTemplate;

