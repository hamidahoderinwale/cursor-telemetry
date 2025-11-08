/**
 * System View - System monitoring and resources
 * HTML templates moved to views/system/templates.js
 */

function renderSystemView(container) {
  container.innerHTML = window.renderSystemViewTemplate();

  // Render charts after DOM is updated
  setTimeout(() => {
    // Try to fetch latest system resources if not available
    if (!window.state?.data?.systemResources || window.state.data.systemResources.length === 0) {
      fetchSystemResources().then(() => {
        if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
      }).catch(() => {
        // Still try to render even if fetch fails
        if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
      });
    } else {
      if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
    }
  }, 100);
}

/**
 * Fetch system resources from the API
 */
async function fetchSystemResources() {
  if (!window.APIClient) return false;
  
  try {
    const systemRes = await window.APIClient.get('/raw-data/system-resources?limit=100', {
      timeout: 5000,
      retries: 1,
      silent: true
    }).catch(() => null);
    
    if (systemRes && systemRes.data && Array.isArray(systemRes.data)) {
      if (!window.state.data) window.state.data = {};
      window.state.data.systemResources = systemRes.data;
      return true;
    }
  } catch (err) {
    // System resources are optional
    console.debug('[SYSTEM] Could not fetch system resources:', err.message);
  }
  return false;
}

function renderSystemResourcesChart() {
  const canvas = document.getElementById('systemResourcesChart');
  if (!canvas) return;
  
  const data = (window.state?.data?.systemResources || []).slice(-100); // Show last 100 data points for better visualization
  
  if (data.length === 0) {
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-sm);">System data will appear as resources are monitored</div>
        <div style="font-size: var(--text-xs); color: var(--color-text-subtle);">
          <p>Make sure the companion service is running and collecting system metrics.</p>
          <p style="margin-top: var(--space-xs);">The service collects CPU, memory, and load average every 5 seconds.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Destroy existing chart if it exists
  if (canvas.chart) {
    canvas.chart.destroy();
  }

  const memoryData = data.map(d => {
    const memBytes = d.memory?.rss || d.memory?.heapUsed || d.memory || 0;
    return parseFloat((memBytes / 1024 / 1024).toFixed(1));
  });
  
  const cpuData = data.map(d => {
    const loadAvg = d.system?.loadAverage || d.loadAverage || [0];
    return loadAvg[0] || 0;
  });
  
  const maxMemory = Math.max(...memoryData, 100); // Minimum 100MB for scale
  const maxCpu = Math.max(...cpuData, 1); // Minimum 1 for scale

  // Store chart instance for cleanup
  canvas.chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map((d, i) => {
        const date = new Date(d.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }),
      datasets: [
        {
          label: 'Memory Usage (MB)',
          data: memoryData,
          borderColor: window.CONFIG?.CHART_COLORS?.primary || '#3b82f6',
          backgroundColor: (window.CONFIG?.CHART_COLORS?.primary || '#3b82f6') + '15',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-memory',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4
        },
        {
          label: 'CPU Load Average',
          data: cpuData,
          borderColor: window.CONFIG?.CHART_COLORS?.accent || '#8b5cf6',
          backgroundColor: (window.CONFIG?.CHART_COLORS?.accent || '#8b5cf6') + '15',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-cpu',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
      scales: {
        'y-memory': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Memory (MB)'
          },
          max: maxMemory * 1.2
        },
        'y-cpu': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Load Average'
          },
          max: maxCpu * 1.2
        }
      }
    }
  });
}

// Export to window for global access
window.renderSystemView = renderSystemView;
window.renderSystemResourcesChart = renderSystemResourcesChart;
window.fetchSystemResources = fetchSystemResources;
