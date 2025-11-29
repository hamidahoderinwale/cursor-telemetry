/**
 * Context Precision Dashboard
 * Visualizes and analyzes Context Precision metrics
 */

async function renderContextPrecisionView(container) {
  container.innerHTML = `
    <div class="context-precision-view">
      <!-- Header -->
      <div class="view-header">
        <div>
          <h1 class="view-title">Context Precision</h1>
          <p class="view-subtitle">Measure how efficiently AI uses context</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="calculateCPBaseline()">
            Recalculate Baseline
          </button>
        </div>
      </div>

      <!-- Overview Metrics -->
      <div class="cp-metrics-grid">
        <div class="metric-card card">
          <div class="metric-label">Average CP</div>
          <div class="metric-value" id="cp-avg">-</div>
          <div class="metric-change" id="cp-avg-change">Loading...</div>
        </div>
        
        <div class="metric-card card">
          <div class="metric-label">Median CP</div>
          <div class="metric-value" id="cp-median">-</div>
          <div class="metric-change neutral">All time</div>
        </div>
        
        <div class="metric-card card">
          <div class="metric-label">High CP Tasks</div>
          <div class="metric-value" id="cp-high">-</div>
          <div class="metric-change neutral">CP > 0.8</div>
        </div>
        
        <div class="metric-card card">
          <div class="metric-label">Low CP Tasks</div>
          <div class="metric-value" id="cp-low">-</div>
          <div class="metric-change neutral">CP < 0.5</div>
        </div>
      </div>

      <!-- CP Trend Chart -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">CP Trend Over Time</h2>
          <div class="chart-controls">
            <select id="cp-timeframe" class="btn btn-ghost btn-sm" onchange="updateCPChart()">
              <option value="7d">Last 7 days</option>
              <option value="30d" selected>Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        <div class="card-body">
          <canvas id="cp-trend-chart" height="300"></canvas>
        </div>
      </div>

      <!-- CP Distribution -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">CP Distribution</h2>
        </div>
        <div class="card-body">
          <div class="cp-distribution">
            <div class="distribution-bar">
              <div class="distribution-label">0.0 - 0.2</div>
              <div class="distribution-track">
                <div class="distribution-fill" id="dist-0-2" style="width: 0%"></div>
              </div>
              <div class="distribution-value" id="dist-0-2-value">0</div>
            </div>
            <div class="distribution-bar">
              <div class="distribution-label">0.2 - 0.4</div>
              <div class="distribution-track">
                <div class="distribution-fill" id="dist-2-4" style="width: 0%"></div>
              </div>
              <div class="distribution-value" id="dist-2-4-value">0</div>
            </div>
            <div class="distribution-bar">
              <div class="distribution-label">0.4 - 0.6</div>
              <div class="distribution-track">
                <div class="distribution-fill" id="dist-4-6" style="width: 0%"></div>
              </div>
              <div class="distribution-value" id="dist-4-6-value">0</div>
            </div>
            <div class="distribution-bar">
              <div class="distribution-label">0.6 - 0.8</div>
              <div class="distribution-track">
                <div class="distribution-fill" id="dist-6-8" style="width: 0%"></div>
              </div>
              <div class="distribution-value" id="dist-6-8-value">0</div>
            </div>
            <div class="distribution-bar">
              <div class="distribution-label">0.8 - 1.0</div>
              <div class="distribution-track">
                <div class="distribution-fill" id="dist-8-10" style="width: 0%"></div>
              </div>
              <div class="distribution-value" id="dist-8-10-value">0</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CP by Task Type -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">CP by Task Type</h2>
        </div>
        <div class="card-body">
          <canvas id="cp-by-type-chart" height="250"></canvas>
        </div>
      </div>

      <!-- CP by Model -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">CP by Model</h2>
        </div>
        <div class="card-body">
          <div class="cp-model-comparison" id="cp-model-comparison">
            Loading...
          </div>
        </div>
      </div>

      <!-- Efficiency Insights -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Efficiency Insights</h2>
        </div>
        <div class="card-body">
          <div class="insights-list" id="cp-insights">
            Loading insights...
          </div>
        </div>
      </div>
    </div>
  `;

  await loadCPData();
}

async function loadCPData() {
  try {
    const response = await window.APIClient.get('/api/analytics/context-precision');
    const data = await response.json();
    
    // Update metrics
    if (data.average !== undefined) {
      document.getElementById('cp-avg').textContent = data.average.toFixed(2);
    }
    if (data.median !== undefined) {
      document.getElementById('cp-median').textContent = data.median.toFixed(2);
    }
    if (data.distribution) {
      const dist = data.distribution;
      updateDistribution(dist);
    }
    
    // Render charts
    renderCPTrendChart(data.trend || []);
    renderCPByTypeChart(data.byType || {});
    renderCPByModel(data.byModel || {});
    renderCPInsights(data);
    
  } catch (error) {
    console.error('Failed to load CP data:', error);
    // Fallback: calculate from local data
    calculateCPFromLocalData();
  }
}

function calculateCPFromLocalData() {
  const state = window.state || {};
  const prompts = state.data?.prompts || [];
  
  const cpScores = [];
  prompts.forEach(p => {
    const cp = p.context_precision || p.cp || p.contextPrecision;
    if (cp !== undefined && cp !== null) {
      cpScores.push(cp);
    }
  });
  
  if (cpScores.length === 0) {
    document.getElementById('cp-avg').textContent = 'N/A';
    document.getElementById('cp-median').textContent = 'N/A';
    return;
  }
  
  const avg = cpScores.reduce((a, b) => a + b, 0) / cpScores.length;
  const sorted = [...cpScores].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  const high = cpScores.filter(cp => cp > 0.8).length;
  const low = cpScores.filter(cp => cp < 0.5).length;
  
  document.getElementById('cp-avg').textContent = avg.toFixed(2);
  document.getElementById('cp-median').textContent = median.toFixed(2);
  document.getElementById('cp-high').textContent = high;
  document.getElementById('cp-low').textContent = low;
  
  // Distribution
  const distribution = {
    '0.0-0.2': cpScores.filter(cp => cp >= 0 && cp < 0.2).length,
    '0.2-0.4': cpScores.filter(cp => cp >= 0.2 && cp < 0.4).length,
    '0.4-0.6': cpScores.filter(cp => cp >= 0.4 && cp < 0.6).length,
    '0.6-0.8': cpScores.filter(cp => cp >= 0.6 && cp < 0.8).length,
    '0.8-1.0': cpScores.filter(cp => cp >= 0.8 && cp <= 1.0).length,
  };
  
  updateDistribution(distribution);
}

function updateDistribution(distribution) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return;
  
  const buckets = [
    { id: '0-2', key: '0.0-0.2', value: distribution['0.0-0.2'] || 0 },
    { id: '2-4', key: '0.2-0.4', value: distribution['0.2-0.4'] || 0 },
    { id: '4-6', key: '0.4-0.6', value: distribution['0.4-0.6'] || 0 },
    { id: '6-8', key: '0.6-0.8', value: distribution['0.6-0.8'] || 0 },
    { id: '8-10', key: '0.8-1.0', value: distribution['0.8-1.0'] || 0 },
  ];
  
  buckets.forEach(bucket => {
    const percentage = (bucket.value / total * 100).toFixed(0);
    document.getElementById(`dist-${bucket.id}`).style.width = `${percentage}%`;
    document.getElementById(`dist-${bucket.id}-value`).textContent = bucket.value;
  });
}

function renderCPTrendChart(data) {
  const canvas = document.getElementById('cp-trend-chart');
  if (!canvas || !window.Chart) {
    console.warn('Chart.js not available');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [{
        label: 'Average CP',
        data: data.map(d => d.avgCP),
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1.0
        }
      }
    }
  });
}

function renderCPByTypeChart(data) {
  const canvas = document.getElementById('cp-by-type-chart');
  if (!canvas || !window.Chart) return;
  
  const ctx = canvas.getContext('2d');
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: 'Average CP',
        data: Object.values(data),
        backgroundColor: 'rgba(37, 99, 235, 0.8)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 1.0
        }
      }
    }
  });
}

function renderCPByModel(data) {
  const container = document.getElementById('cp-model-comparison');
  
  if (Object.keys(data).length === 0) {
    container.innerHTML = '<div class="empty-state">No model comparison data available</div>';
    return;
  }
  
  const models = Object.entries(data)
    .map(([model, cp]) => ({ model, cp }))
    .sort((a, b) => b.cp - a.cp);
  
  container.innerHTML = models.map(({ model, cp }) => `
    <div class="model-comparison-item">
      <div class="model-name">${model || 'Unknown'}</div>
      <div class="model-cp-bar">
        <div class="model-cp-fill" style="width: ${cp * 100}%"></div>
      </div>
      <div class="model-cp-value">${cp.toFixed(2)}</div>
    </div>
  `).join('');
}

function renderCPInsights(data) {
  const container = document.getElementById('cp-insights');
  const insights = [];
  
  if (data.average) {
    if (data.average > 0.8) {
      insights.push({
        type: 'success',
        message: 'Excellent context usage! Your average CP is above 0.8.'
      });
    } else if (data.average < 0.5) {
      insights.push({
        type: 'warning',
        message: 'Consider improving context efficiency. Your average CP is below 0.5.'
      });
    }
  }
  
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      message: 'Continue tracking to see insights about your context usage patterns.'
    });
  }
  
  container.innerHTML = insights.map(insight => `
    <div class="insight-item insight-${insight.type}">
      <div class="insight-icon">${getInsightIcon(insight.type)}</div>
      <div class="insight-message">${insight.message}</div>
    </div>
  `).join('');
}

function getInsightIcon(type) {
  const icons = {
    success: '✓',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || '•';
}

function updateCPChart() {
  const timeframe = document.getElementById('cp-timeframe').value;
  // Reload data with new timeframe
  loadCPData();
}

async function calculateCPBaseline() {
  try {
    const response = await window.APIClient.post('/api/analytics/calculate-cp-baseline');
    const data = await response.json();
    await loadCPData();
  } catch (error) {
    console.error('Failed to calculate baseline:', error);
  }
}

// Export for view router
if (typeof window !== 'undefined') {
  window.renderContextPrecisionView = renderContextPrecisionView;
}

