/**
 * System View - System monitoring and resources
 * HTML templates moved to views/system/templates.js
 */

function renderSystemView(container) {
  container.innerHTML = window.renderSystemViewTemplate();

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
