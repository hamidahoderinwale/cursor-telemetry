/**
 * System View - System monitoring and resources
 */

function renderSystemView(container) {
  container.innerHTML = `
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

  // Render charts after DOM is updated
  setTimeout(() => {
    if (window.renderSystemResourcesChart) window.renderSystemResourcesChart();
  }, 0);
}

function renderSystemResourcesChart() {
  const canvas = document.getElementById('systemResourcesChart');
  if (!canvas) return;
  
  const data = (window.state?.data?.systemResources || []).slice(-30);
  
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

