/**
 * Chart.js utility functions
 */

function createChart(canvasId, config) {
  // Destroy existing chart if it exists
  if (window.state.charts[canvasId]) {
    window.state.charts[canvasId].destroy();
    delete window.state.charts[canvasId];
  }
  
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  
  const ctx = canvas.getContext('2d');
  window.state.charts[canvasId] = new Chart(ctx, config);
  return window.state.charts[canvasId];
}

// Export to window for global access
window.createChart = createChart;

