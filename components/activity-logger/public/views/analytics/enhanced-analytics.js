/**
 * Enhanced Analytics Components
 * Deeper metrics and visualizations
 */

/**
 * Render productivity heatmap
 */
function renderProductivityHeatmap(container, data) {
  if (!window.Chart) {
    container.innerHTML = '<div class="empty-state">Chart.js required for visualizations</div>';
    return;
  }
  
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  
  // Prepare heatmap data (hours of day vs days of week)
  const heatmapData = prepareHeatmapData(data);
  
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: Object.entries(heatmapData).map(([hour, values]) => ({
        label: `${hour}:00`,
        data: values,
        backgroundColor: `rgba(37, 99, 235, ${Math.min(1, values.reduce((a, b) => a + b, 0) / 100)})`
      }))
    },
    options: {
      responsive: true,
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });
}

function prepareHeatmapData(data) {
  const events = data.events || [];
  const heatmap = {};
  
  // Initialize all hours
  for (let h = 0; h < 24; h++) {
    heatmap[h] = [0, 0, 0, 0, 0, 0, 0]; // 7 days
  }
  
  events.forEach(event => {
    const date = new Date(event.timestamp || event.id);
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    
    if (heatmap[hour]) {
      heatmap[hour][day] = (heatmap[hour][day] || 0) + 1;
    }
  });
  
  return heatmap;
}

/**
 * Render code quality trends
 */
function renderCodeQualityTrends(container, data) {
  const entries = data.entries || [];
  
  // Group by date
  const dailyStats = {};
  entries.forEach(entry => {
    const date = new Date(entry.timestamp || entry.id).toDateString();
    if (!dailyStats[date]) {
      dailyStats[date] = {
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: new Set()
      };
    }
    
    const before = (entry.before_code || '').split('\n').length;
    const after = (entry.after_code || '').split('\n').length;
    dailyStats[date].linesAdded += Math.max(0, after - before);
    dailyStats[date].linesRemoved += Math.max(0, before - after);
    if (entry.file_path) {
      dailyStats[date].filesChanged.add(entry.file_path);
    }
  });
  
  const dates = Object.keys(dailyStats).sort();
  const labels = dates.map(d => new Date(d).toLocaleDateString());
  const linesAdded = dates.map(d => dailyStats[d].linesAdded);
  const linesRemoved = dates.map(d => dailyStats[d].linesRemoved);
  const filesChanged = dates.map(d => dailyStats[d].filesChanged.size);
  
  if (!window.Chart) {
    container.innerHTML = '<div class="empty-state">Chart.js required</div>';
    return;
  }
  
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Lines Added',
          data: linesAdded,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        },
        {
          label: 'Lines Removed',
          data: linesRemoved,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4
        },
        {
          label: 'Files Changed',
          data: filesChanged,
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          type: 'linear',
          position: 'left'
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: {
            drawOnChartArea: false
          }
        }
      }
    }
  });
}

/**
 * Render AI usage breakdown
 */
function renderAIUsageBreakdown(container, data) {
  const prompts = data.prompts || [];
  
  // Group by model
  const modelUsage = {};
  prompts.forEach(p => {
    const model = p.model_name || p.modelName || 'Unknown';
    if (!modelUsage[model]) {
      modelUsage[model] = {
        count: 0,
        totalTokens: 0,
        avgCP: 0,
        cpScores: []
      };
    }
    modelUsage[model].count++;
    if (p.total_tokens) modelUsage[model].totalTokens += p.total_tokens;
    const cp = p.context_precision || p.cp;
    if (cp) {
      modelUsage[model].cpScores.push(cp);
      modelUsage[model].avgCP = modelUsage[model].cpScores.reduce((a, b) => a + b, 0) / modelUsage[model].cpScores.length;
    }
  });
  
  container.innerHTML = `
    <div class="ai-usage-grid">
      ${Object.entries(modelUsage).map(([model, stats]) => `
        <div class="ai-usage-card card">
          <div class="ai-usage-header">
            <h3 class="ai-usage-model">${model}</h3>
            <div class="ai-usage-count">${stats.count} prompts</div>
          </div>
          <div class="ai-usage-metrics">
            <div class="ai-usage-metric">
              <div class="metric-label">Total Tokens</div>
              <div class="metric-value">${(stats.totalTokens / 1000).toFixed(1)}K</div>
            </div>
            ${stats.avgCP > 0 ? `
              <div class="ai-usage-metric">
                <div class="metric-label">Avg CP</div>
                <div class="metric-value">${stats.avgCP.toFixed(2)}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Export
if (typeof window !== 'undefined') {
  window.renderProductivityHeatmap = renderProductivityHeatmap;
  window.renderCodeQualityTrends = renderCodeQualityTrends;
  window.renderAIUsageBreakdown = renderAIUsageBreakdown;
}

