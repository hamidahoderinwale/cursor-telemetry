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
  
  // Ensure canvas has proper dimensions before rendering
  const container = canvas.parentElement;
  if (container) {
    // Force a layout recalculation to ensure container has proper size
    const containerWidth = container.clientWidth || container.offsetWidth;
    const containerHeight = container.clientHeight || container.offsetHeight;
    
    // Set explicit dimensions if container has size
    if (containerWidth > 0 && containerHeight > 0) {
      // Ensure canvas fills container properly
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
  }
  
  const ctx = canvas.getContext('2d');
  
  // Ensure responsive is enabled and maintainAspectRatio is set appropriately
  if (config.options) {
    config.options.responsive = config.options.responsive !== false;
    // For charts that appear squished, disable maintainAspectRatio
    if (config.options.maintainAspectRatio === undefined) {
      config.options.maintainAspectRatio = false;
    }
  }
  
  window.state.charts[canvasId] = new Chart(ctx, config);
  
  // Resize chart after a short delay to ensure container is fully laid out
  setTimeout(() => {
    if (window.state.charts[canvasId]) {
      window.state.charts[canvasId].resize();
    }
  }, 100);
  
  return window.state.charts[canvasId];
}

// Export to window for global access
window.createChart = createChart;

