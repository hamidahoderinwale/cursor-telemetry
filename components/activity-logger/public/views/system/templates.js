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
          <h3 class="card-title" title="Historical tracking of system resource usage including memory consumption (RSS, heap) and CPU load average. Data is collected every 5 seconds by the companion service. Useful for monitoring performance and identifying resource-intensive periods">System Resources Over Time</h3>
          <p class="card-subtitle">Memory usage and CPU load tracking</p>
        </div>
        <div class="card-body">
          <canvas id="systemResourcesChart" class="system-chart-container"></canvas>
        </div>
      </div>

      <!-- System Resource Statistics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Aggregated statistics about system resource usage including peak usage, averages, and trends">System Resource Statistics</h3>
          <p class="card-subtitle">Peak usage, averages, and resource trends</p>
        </div>
        <div class="card-body">
          <div id="systemResourceStats" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- Resource Usage Distribution -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Distribution of resource usage levels over time - shows how often your system operates at different resource utilization levels">Resource Usage Distribution</h3>
          <p class="card-subtitle">Memory and CPU usage distribution patterns</p>
        </div>
        <div class="card-body">
          <canvas id="resourceDistributionChart" style="max-height: 300px;"></canvas>
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

