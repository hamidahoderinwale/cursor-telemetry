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
          <h3 class="card-title" title="Historical tracking of Companion Service resource usage including memory consumption (heap) and system CPU load average. Data is collected every 5 seconds.">Companion Service Resources Over Time</h3>
          <p class="card-subtitle">Companion process memory and system CPU load</p>
        </div>
        <div class="card-body">
          <canvas id="systemResourcesChart" class="system-chart-container"></canvas>
        </div>
      </div>

      <!-- System Resource Statistics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Companion Service resource usage (Node.js process memory and system CPU load)">Companion Service Resources</h3>
          <p class="card-subtitle">Companion service process statistics</p>
        </div>
        <div class="card-body">
          <div id="systemResourceStats" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- System Performance Trends -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Performance trends showing how system resources correlate with development activity - helps identify if resource usage spikes during coding sessions">Performance Trends</h3>
          <p class="card-subtitle">Resource usage correlation with development activity</p>
        </div>
        <div class="card-body">
          <div id="performanceTrends" style="min-height: 250px;"></div>
        </div>
      </div>
    </div>
  `;
}

// Export to window for global access
window.renderSystemViewTemplate = renderSystemViewTemplate;

