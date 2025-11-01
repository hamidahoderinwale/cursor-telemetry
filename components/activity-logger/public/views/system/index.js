/**
 * System View - System monitoring and resources
 */

function renderSystemView(container) {
  const latestGit = window.state.data.gitData[window.state.data.gitData.length - 1];
  const latestIdeState = Array.isArray(window.state.data.ideState) && window.state.data.ideState.length > 0 
    ? window.state.data.ideState[window.state.data.ideState.length - 1] 
    : null;
  
  // Extract editor info from the nested structure
  const openTabs = latestIdeState?.editorState?.activeTabs?.length || 0;
  const currentFile = latestIdeState?.editorState?.editorLayout?.activeEditor || 'None';
  const currentFileName = currentFile !== 'None' ? currentFile.split('/').pop() : 'None';
  const languageMode = latestIdeState?.editorConfiguration?.languageMode || 'Unknown';
  const cursorPos = latestIdeState?.editorState?.activeTabs?.[0]?.lineNumber && latestIdeState?.editorState?.activeTabs?.[0]?.columnNumber
    ? `Ln ${latestIdeState.editorState.activeTabs[0].lineNumber}, Col ${latestIdeState.editorState.activeTabs[0].columnNumber}`
    : 'Unknown';

  container.innerHTML = `
    <div class="system-view">
      
      <!-- Current Stats Row -->
      <div class="system-stats-grid">
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">System Resources</h3>
          </div>
          <div class="card-body">
            ${renderSystemStatus()}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Git Repository</h3>
          </div>
          <div class="card-body">
            ${latestGit ? `
              <div class="system-status-list">
                <div class="info-row">
                  <span class="info-label">Branch</span>
                  <span class="info-value mono">${window.escapeHtml(latestGit.branch || 'Unknown')}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Modified Files</span>
                  <span class="info-value">${latestGit.status?.length || 0}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Recent Commits</span>
                  <span class="info-value">${latestGit.recentCommits?.length || 0}</span>
                </div>
              </div>
            ` : '<div class="empty-state-text">No git data available</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Editor State</h3>
          </div>
          <div class="card-body">
            ${latestIdeState ? `
              <div class="system-status-list">
                <div class="info-row">
                  <span class="info-label">Open Tabs</span>
                  <span class="info-value">${openTabs}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Current File</span>
                  <span class="info-value mono small" title="${window.escapeHtml(currentFile)}">${window.escapeHtml(window.truncate(currentFileName, 25))}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Language</span>
                  <span class="info-value">${window.escapeHtml(languageMode || 'Unknown')}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Position</span>
                  <span class="info-value">${window.escapeHtml(cursorPos)}</span>
                </div>
              </div>
            ` : '<div class="empty-state-text">No IDE state available</div>'}
          </div>
        </div>

      </div>

      <!-- Time Series Graphs -->
      <div class="time-series-grid">
        
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

    </div>
  `;

  // Render charts after DOM is updated
  setTimeout(() => {
    if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
  }, 0);
}

function renderSystemResourcesChart() {
  const canvas = document.getElementById('systemResourcesChart');
  if (!canvas) return;
  
  const data = window.state.data.systemResources.slice(-30);
  
  if (data.length === 0) {
    canvas.style.display = 'none';
    const container = canvas.parentElement;
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px; text-align: center;">
        <div style="font-size: var(--text-md); font-weight: 500; color: var(--color-text); margin-bottom: var(--space-xs);">No Data Available</div>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted);">System data will appear as resources are monitored</div>
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
  
  const maxMemory = Math.max(...memoryData);
  const maxCpu = Math.max(...cpuData);

  new Chart(canvas.getContext('2d'), {
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
          borderColor: window.CONFIG.CHART_COLORS.primary,
          backgroundColor: window.CONFIG.CHART_COLORS.primary + '15',
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
          borderColor: window.CONFIG.CHART_COLORS.accent,
          backgroundColor: window.CONFIG.CHART_COLORS.accent + '15',
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
          align: 'end',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 11,
              family: 'Inter'
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 13 },
          bodyFont: { size: 12 },
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.dataset.yAxisID === 'y-memory') {
                label += context.parsed.y.toFixed(1) + ' MB';
              } else {
                label += context.parsed.y.toFixed(2);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 10 }
          }
        },
        'y-memory': {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: {
            display: true,
            text: 'Memory (MB)',
            font: { size: 11, weight: 'bold' }
          },
          ticks: {
            callback: function(value) { return value.toFixed(0) + ' MB'; },
            font: { size: 10 }
          },
          grid: { color: 'rgba(99, 102, 241, 0.1)' }
        },
        'y-cpu': {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: {
            display: true,
            text: 'CPU Load',
            font: { size: 11, weight: 'bold' }
          },
          ticks: {
            callback: function(value) { return value.toFixed(1); },
            font: { size: 10 }
          },
          grid: {
            drawOnChartArea: false,
            color: 'rgba(245, 158, 11, 0.1)'
          }
        }
      }
    }
  });
}

// Export to window for global access
window.renderSystemView = renderSystemView;
window.renderSystemResourcesChart = renderSystemResourcesChart;

