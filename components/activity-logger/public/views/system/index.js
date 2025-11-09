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
        if (window.renderSystemResourceStats) window.renderSystemResourceStats();
        if (window.renderResourceDistributionChart) window.renderResourceDistributionChart();
        if (window.renderPerformanceTrends) window.renderPerformanceTrends();
      }).catch(() => {
        // Still try to render even if fetch fails
        if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
        if (window.renderSystemResourceStats) window.renderSystemResourceStats();
        if (window.renderResourceDistributionChart) window.renderResourceDistributionChart();
        if (window.renderPerformanceTrends) window.renderPerformanceTrends();
      });
    } else {
      if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
      if (window.renderSystemResourceStats) window.renderSystemResourceStats();
      if (window.renderResourceDistributionChart) window.renderResourceDistributionChart();
      if (window.renderPerformanceTrends) window.renderPerformanceTrends();
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

/**
 * Render system resource statistics
 */
function renderSystemResourceStats() {
  const container = document.getElementById('systemResourceStats');
  if (!container) return;

  const data = (window.state?.data?.systemResources || []).slice(-100);
  
  if (data.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">System statistics will appear as data is collected</div>
      </div>
    `;
    return;
  }

  const memoryData = data.map(d => {
    const memBytes = d.memory?.rss || d.memory?.heapUsed || d.memory || 0;
    return parseFloat((memBytes / 1024 / 1024).toFixed(1));
  });
  
  const cpuData = data.map(d => {
    const loadAvg = d.system?.loadAverage || d.loadAverage || [0];
    return loadAvg[0] || 0;
  });

  const avgMemory = memoryData.reduce((a, b) => a + b, 0) / memoryData.length;
  const maxMemory = Math.max(...memoryData);
  const minMemory = Math.min(...memoryData);
  
  const avgCpu = cpuData.reduce((a, b) => a + b, 0) / cpuData.length;
  const maxCpu = Math.max(...cpuData);
  const minCpu = Math.min(...cpuData);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
      <div class="stat-card">
        <div class="stat-label">Avg Memory</div>
        <div class="stat-value">${avgMemory.toFixed(1)} MB</div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
          Range: ${minMemory.toFixed(1)} - ${maxMemory.toFixed(1)} MB
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Peak Memory</div>
        <div class="stat-value">${maxMemory.toFixed(1)} MB</div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
          Maximum observed
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg CPU Load</div>
        <div class="stat-value">${avgCpu.toFixed(2)}</div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
          Range: ${minCpu.toFixed(2)} - ${maxCpu.toFixed(2)}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Peak CPU Load</div>
        <div class="stat-value">${maxCpu.toFixed(2)}</div>
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
          Maximum observed
        </div>
      </div>
    </div>
  `;
}

/**
 * Render resource distribution chart
 */
function renderResourceDistributionChart() {
  const canvas = document.getElementById('resourceDistributionChart');
  if (!canvas || !window.Chart) return;

  const data = (window.state?.data?.systemResources || []).slice(-100);
  
  if (data.length === 0) return;

  if (canvas.chart) {
    canvas.chart.destroy();
  }

  const memoryData = data.map(d => {
    const memBytes = d.memory?.rss || d.memory?.heapUsed || d.memory || 0;
    return parseFloat((memBytes / 1024 / 1024).toFixed(1));
  });

  // Create bins for distribution
  const bins = [0, 50, 100, 150, 200, 300, 500, 1000, Infinity];
  const distribution = new Array(bins.length - 1).fill(0);
  
  memoryData.forEach(mem => {
    for (let i = 0; i < bins.length - 1; i++) {
      if (mem >= bins[i] && mem < bins[i + 1]) {
        distribution[i]++;
        break;
      }
    }
  });

  const labels = bins.slice(0, -1).map((bin, i) => {
    if (i === bins.length - 2) return `${bin}+ MB`;
    return `${bin}-${bins[i + 1]} MB`;
  });

  canvas.chart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Memory Usage Distribution',
        data: distribution,
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Frequency'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Memory Range'
          }
        }
      }
    }
  });
}

/**
 * Render performance trends (correlation with activity)
 */
function renderPerformanceTrends() {
  const container = document.getElementById('performanceTrends');
  if (!container) return;

  const systemData = (window.state?.data?.systemResources || []).slice(-100);
  const events = window.state?.data?.events || [];

  if (systemData.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">Performance trends will appear as data is collected</div>
      </div>
    `;
    return;
  }

  // Group events by time windows (5-minute intervals)
  const timeWindow = 5 * 60 * 1000;
  const activityWindows = new Map();

  events.forEach(e => {
    const timestamp = new Date(e.timestamp).getTime();
    const windowKey = Math.floor(timestamp / timeWindow) * timeWindow;
    activityWindows.set(windowKey, (activityWindows.get(windowKey) || 0) + 1);
  });

  // Match system data to activity windows
  const correlations = [];
  systemData.forEach(d => {
    const timestamp = d.timestamp;
    const windowKey = Math.floor(timestamp / timeWindow) * timeWindow;
    const activity = activityWindows.get(windowKey) || 0;
    
    const memBytes = d.memory?.rss || d.memory?.heapUsed || d.memory || 0;
    const memoryMB = memBytes / 1024 / 1024;
    const cpuLoad = d.system?.loadAverage?.[0] || d.loadAverage?.[0] || 0;

    correlations.push({
      timestamp,
      memory: memoryMB,
      cpu: cpuLoad,
      activity
    });
  });

  // Calculate correlation statistics
  const activePeriods = correlations.filter(c => c.activity > 0);
  const idlePeriods = correlations.filter(c => c.activity === 0);

  const avgMemoryActive = activePeriods.length > 0
    ? activePeriods.reduce((sum, c) => sum + c.memory, 0) / activePeriods.length
    : 0;
  const avgMemoryIdle = idlePeriods.length > 0
    ? idlePeriods.reduce((sum, c) => sum + c.memory, 0) / idlePeriods.length
    : 0;

  const avgCpuActive = activePeriods.length > 0
    ? activePeriods.reduce((sum, c) => sum + c.cpu, 0) / activePeriods.length
    : 0;
  const avgCpuIdle = idlePeriods.length > 0
    ? idlePeriods.reduce((sum, c) => sum + c.cpu, 0) / idlePeriods.length
    : 0;

  container.innerHTML = `
    <div style="margin-bottom: var(--space-md);">
      <h4 style="margin-bottom: var(--space-sm); color: var(--color-text); font-size: var(--text-md);">Resource Usage: Active vs Idle Periods</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-md);">
        <div class="stat-card">
          <div class="stat-label">Memory (Active)</div>
          <div class="stat-value">${avgMemoryActive.toFixed(1)} MB</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${activePeriods.length} periods
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Memory (Idle)</div>
          <div class="stat-value">${avgMemoryIdle.toFixed(1)} MB</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${idlePeriods.length} periods
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">CPU Load (Active)</div>
          <div class="stat-value">${avgCpuActive.toFixed(2)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            During coding activity
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">CPU Load (Idle)</div>
          <div class="stat-value">${avgCpuIdle.toFixed(2)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            No activity
          </div>
        </div>
      </div>
    </div>
    ${avgMemoryActive > avgMemoryIdle ? `
      <div style="padding: var(--space-sm); background: #10b98115; border-radius: var(--radius-md); border-left: 3px solid #10b981;">
        <div style="font-size: var(--text-sm); color: var(--color-text);">
          <strong>Insight:</strong> Memory usage is ${((avgMemoryActive - avgMemoryIdle) / avgMemoryIdle * 100).toFixed(1)}% higher during active coding periods
        </div>
      </div>
    ` : ''}
  `;
}

// Export to window for global access
window.renderSystemView = renderSystemView;
window.renderSystemResourcesChart = renderSystemResourcesChart;
window.fetchSystemResources = fetchSystemResources;
window.renderSystemResourceStats = renderSystemResourceStats;
window.renderResourceDistributionChart = renderResourceDistributionChart;
window.renderPerformanceTrends = renderPerformanceTrends;
