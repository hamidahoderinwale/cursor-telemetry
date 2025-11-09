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

  // Get time scale settings from UI or use defaults
  const timeRangeSelect = document.getElementById('performanceTimeRange');
  const periodSizeSelect = document.getElementById('performancePeriodSize');
  
  const timeRange = timeRangeSelect?.value || '24h'; // Default: last 24 hours
  const periodSize = periodSizeSelect?.value || '5m'; // Default: 5 minute periods
  
  // Calculate time range in milliseconds
  const timeRangeMs = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'all': Infinity
  }[timeRange] || 24 * 60 * 60 * 1000;
  
  // Calculate period size in milliseconds
  const periodSizeMs = {
    '1m': 1 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000
  }[periodSize] || 5 * 60 * 1000;
  
  // Use period size as activity window
  const activityWindowMs = periodSizeMs;

  // Filter system data by time range
  const now = Date.now();
  const cutoffTime = now - timeRangeMs;
  let systemData = (window.state?.data?.systemResources || []).filter(d => {
    const timestamp = typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp).getTime();
    return timestamp >= cutoffTime;
  });
  
  // If too much data, sample it
  if (systemData.length > 1000) {
    const step = Math.ceil(systemData.length / 1000);
    systemData = systemData.filter((_, i) => i % step === 0);
  }
  
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
  
  // Pre-process events for faster lookup (sort once)
  const eventTimestamps = events.map(e => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
  
  // Match system data to nearby events
  const correlations = [];
  systemData.forEach(d => {
    const timestamp = typeof d.timestamp === 'number' ? d.timestamp : new Date(d.timestamp).getTime();
    
    // Count events within the activity window using binary search
    const windowStart = timestamp - activityWindowMs;
    const windowEnd = timestamp + activityWindowMs;
    
    // Binary search for start index
    let left = 0;
    let right = eventTimestamps.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (eventTimestamps[mid] < windowStart) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    const startIdx = left;
    
    // Count events in range
    let activityCount = 0;
    for (let i = startIdx; i < eventTimestamps.length && eventTimestamps[i] <= windowEnd; i++) {
      activityCount++;
    }
    
    const activity = activityCount;
    
    // Extract memory value (handle different data structures)
    let memBytes = 0;
    if (d.memory) {
      if (typeof d.memory === 'number') {
        memBytes = d.memory;
      } else {
        memBytes = d.memory.rss || d.memory.heapUsed || d.memory.heapTotal || 0;
      }
    }
    const memoryMB = memBytes / 1024 / 1024;
    
    // Extract CPU load (handle different data structures)
    const cpuLoad = d.system?.loadAverage?.[0] || 
                     d.loadAverage?.[0] || 
                     d.cpu?.load || 
                     d.cpu || 0;

    correlations.push({
      timestamp,
      memory: memoryMB,
      cpu: cpuLoad,
      activity
    });
  });

  // Calculate correlation statistics
  // Use a threshold for "active" - at least 2 events in the window
  const ACTIVE_THRESHOLD = 2;
  const activePeriods = correlations.filter(c => c.activity >= ACTIVE_THRESHOLD);
  const idlePeriods = correlations.filter(c => c.activity < ACTIVE_THRESHOLD);

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
          <div class="stat-value">${idlePeriods.length > 0 ? `${avgMemoryIdle.toFixed(1)} MB` : 'N/A'}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${idlePeriods.length > 0 ? `${idlePeriods.length} periods` : 'No idle periods detected'}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">CPU Load (Active)</div>
          <div class="stat-value">${avgCpuActive.toFixed(2)}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${activePeriods.length} periods with activity
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">CPU Load (Idle)</div>
          <div class="stat-value">${idlePeriods.length > 0 ? avgCpuIdle.toFixed(2) : 'N/A'}</div>
          <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            ${idlePeriods.length > 0 ? `${idlePeriods.length} periods` : 'No idle periods detected'}
          </div>
        </div>
      </div>
    </div>
    
    ${correlations.length > 0 ? `
      <div style="margin-bottom: var(--space-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm); flex-wrap: wrap; gap: var(--space-sm);">
          <h4 style="margin: 0; color: var(--color-text); font-size: var(--text-md);">Resource Usage Over Time</h4>
          <div style="display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap;">
            <label style="font-size: var(--text-xs); color: var(--color-text-muted); display: flex; align-items: center; gap: var(--space-xs);">
              Time Range:
              <select id="performanceTimeRange" onchange="if(window.renderPerformanceTrends) window.renderPerformanceTrends()" style="padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font-size: var(--text-xs);">
                <option value="1h" ${timeRange === '1h' ? 'selected' : ''}>Last Hour</option>
                <option value="6h" ${timeRange === '6h' ? 'selected' : ''}>Last 6 Hours</option>
                <option value="24h" ${timeRange === '24h' ? 'selected' : ''}>Last 24 Hours</option>
                <option value="7d" ${timeRange === '7d' ? 'selected' : ''}>Last 7 Days</option>
                <option value="30d" ${timeRange === '30d' ? 'selected' : ''}>Last 30 Days</option>
                <option value="all" ${timeRange === 'all' ? 'selected' : ''}>All Time</option>
              </select>
            </label>
            <label style="font-size: var(--text-xs); color: var(--color-text-muted); display: flex; align-items: center; gap: var(--space-xs);">
              Period Size:
              <select id="performancePeriodSize" onchange="if(window.renderPerformanceTrends) window.renderPerformanceTrends()" style="padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); font-size: var(--text-xs);">
                <option value="1m" ${periodSize === '1m' ? 'selected' : ''}>1 Minute</option>
                <option value="5m" ${periodSize === '5m' ? 'selected' : ''}>5 Minutes</option>
                <option value="15m" ${periodSize === '15m' ? 'selected' : ''}>15 Minutes</option>
                <option value="30m" ${periodSize === '30m' ? 'selected' : ''}>30 Minutes</option>
                <option value="1h" ${periodSize === '1h' ? 'selected' : ''}>1 Hour</option>
                <option value="6h" ${periodSize === '6h' ? 'selected' : ''}>6 Hours</option>
              </select>
            </label>
          </div>
        </div>
        <canvas id="performanceTrendsChart" style="max-height: 300px;"></canvas>
      </div>
    ` : ''}
    
    ${generateInsight(avgMemoryActive, avgMemoryIdle, avgCpuActive, avgCpuIdle, activePeriods.length, idlePeriods.length)}
  `;
  
  // Render chart if data available
  if (correlations.length > 0 && window.Chart) {
    setTimeout(() => {
      renderPerformanceTrendsChart(correlations, periodSize);
    }, 100);
  }
}

// Export to window for global access
window.renderPerformanceTrends = renderPerformanceTrends;

/**
 * Generate insight message with proper handling of edge cases
 */
function generateInsight(avgMemoryActive, avgMemoryIdle, avgCpuActive, avgCpuIdle, activeCount, idleCount) {
  const insights = [];
  
  // Memory insight
  if (avgMemoryIdle > 0 && avgMemoryActive > avgMemoryIdle) {
    const memoryIncrease = ((avgMemoryActive - avgMemoryIdle) / avgMemoryIdle * 100).toFixed(1);
    insights.push(`Memory usage is ${memoryIncrease}% higher during active coding periods`);
  } else if (avgMemoryIdle === 0 && avgMemoryActive > 0) {
    insights.push(`Memory usage: ${avgMemoryActive.toFixed(1)} MB during active periods (no idle data for comparison)`);
  } else if (avgMemoryActive < avgMemoryIdle && avgMemoryIdle > 0) {
    const memoryDecrease = ((avgMemoryIdle - avgMemoryActive) / avgMemoryIdle * 100).toFixed(1);
    insights.push(`Memory usage is ${memoryDecrease}% lower during active periods (unusual pattern)`);
  }
  
  // CPU insight
  if (avgCpuIdle > 0 && avgCpuActive > avgCpuIdle) {
    const cpuIncrease = ((avgCpuActive - avgCpuIdle) / avgCpuIdle * 100).toFixed(1);
    insights.push(`CPU load is ${cpuIncrease}% higher during active coding periods`);
  } else if (avgCpuIdle === 0 && avgCpuActive > 0) {
    insights.push(`CPU load: ${avgCpuActive.toFixed(2)} during active periods (no idle data for comparison)`);
  }
  
  // Activity insight
  if (idleCount === 0 && activeCount > 0) {
    insights.push(`All recorded periods show coding activity - system was active throughout`);
  } else if (activeCount === 0 && idleCount > 0) {
    insights.push(`No active coding periods detected in system resource data`);
  }
  
  if (insights.length === 0) {
    return '';
  }
  
  return `
    <div style="padding: var(--space-sm); background: #10b98115; border-radius: var(--radius-md); border-left: 3px solid #10b981;">
      <div style="font-size: var(--text-sm); color: var(--color-text);">
        <strong>Insight:</strong> ${insights.join('. ')}
      </div>
    </div>
  `;
}

/**
 * Render performance trends chart
 */
function renderPerformanceTrendsChart(correlations, periodSize = '5m') {
  const canvas = document.getElementById('performanceTrendsChart');
  if (!canvas || !window.Chart) return;

  // Destroy existing chart
  if (canvas.chart) {
    canvas.chart.destroy();
  }

  // Sort by timestamp
  const sorted = [...correlations].sort((a, b) => a.timestamp - b.timestamp);
  
  // Downsample if too many points (adjust based on period size)
  const periodSizeMs = {
    '1m': 1 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000
  }[periodSize] || 5 * 60 * 1000;
  
  // Adjust max points based on period size (smaller periods = more points)
  const maxPoints = periodSizeMs <= 5 * 60 * 1000 ? 200 : 100;
  const step = Math.max(1, Math.floor(sorted.length / maxPoints));
  const sampled = sorted.filter((_, i) => i % step === 0 || i === sorted.length - 1);

  // Format labels based on period size
  const formatLabel = (timestamp) => {
    const date = new Date(timestamp);
    if (periodSizeMs >= 6 * 60 * 60 * 1000) {
      // 6+ hour periods: show date and time
      return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else if (periodSizeMs >= 60 * 60 * 1000) {
      // 1+ hour periods: show date and time
      return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      // Smaller periods: show time only
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const labels = sampled.map(d => formatLabel(d.timestamp));

  canvas.chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Memory (MB)',
          data: sampled.map(d => d.memory),
          borderColor: '#3b82f6',
          backgroundColor: '#3b82f615',
          tension: 0.4,
          fill: true,
          yAxisID: 'y-memory'
        },
        {
          label: 'CPU Load',
          data: sampled.map(d => d.cpu),
          borderColor: '#10b981',
          backgroundColor: '#10b98115',
          tension: 0.4,
          fill: false,
          yAxisID: 'y-cpu',
          borderDash: [5, 5]
        },
        {
          label: 'Activity Level',
          data: sampled.map(d => d.activity),
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b15',
          tension: 0.4,
          fill: false,
          yAxisID: 'y-activity',
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        'y-memory': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Memory (MB)'
          },
          beginAtZero: true
        },
        'y-cpu': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'CPU Load'
          },
          beginAtZero: true,
          grid: {
            drawOnChartArea: false
          }
        },
        'y-activity': {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Activity'
          },
          beginAtZero: true,
          display: false // Hide this axis but keep the data visible
        }
      }
    }
  });
}

// Export to window for global access
window.renderSystemView = renderSystemView;
window.renderSystemResourcesChart = renderSystemResourcesChart;
window.fetchSystemResources = fetchSystemResources;
window.renderSystemResourceStats = renderSystemResourceStats;
window.renderResourceDistributionChart = renderResourceDistributionChart;
window.renderPerformanceTrends = renderPerformanceTrends;

