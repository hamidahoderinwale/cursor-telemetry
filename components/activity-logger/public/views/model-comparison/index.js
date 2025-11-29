/**
 * Model Comparison View
 * Compare AI model performance across different task types
 */

async function renderModelComparisonView(container) {
  container.innerHTML = `
    <div class="model-comparison-view">
      <!-- Header -->
      <div class="view-header">
        <div>
          <h1 class="view-title">Model Comparison</h1>
          <p class="view-subtitle">Compare AI model performance across task patterns</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-secondary btn-sm" onclick="refreshModelComparison()">
            Refresh Data
          </button>
        </div>
      </div>

      <!-- Overall Leaderboard -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Overall Performance</h2>
          <select id="metric-select" class="input" onchange="updateComparison()">
            <option value="cp">Context Precision</option>
            <option value="quality">Code Quality</option>
            <option value="time">Time Efficiency</option>
            <option value="acceptance">Acceptance Rate</option>
          </select>
        </div>
        <div class="card-body">
          <div class="model-leaderboard" id="model-leaderboard">
            Loading...
          </div>
        </div>
      </div>

      <!-- Performance by Task Type -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Performance by Task Type</h2>
        </div>
        <div class="card-body">
          <canvas id="model-by-type-chart" height="300"></canvas>
        </div>
      </div>

      <!-- Model Details -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Model Details</h2>
        </div>
        <div class="card-body">
          <div class="model-details-grid" id="model-details">
            Loading...
          </div>
        </div>
      </div>

      <!-- Recommendations -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Recommendations</h2>
        </div>
        <div class="card-body">
          <div class="recommendations-list" id="recommendations">
            Loading recommendations...
          </div>
        </div>
      </div>
    </div>
  `;

  await loadModelComparison();
}

async function loadModelComparison() {
  try {
    const response = await window.APIClient.get('/api/models/comparison');
    const data = await response.json();
    renderModelComparison(data);
  } catch (error) {
    console.warn('Model comparison API not available, using local data:', error);
    renderModelComparisonFromLocal();
  }
}

function renderModelComparison(data) {
  const models = data.models || data.leaderboard?.overall || [];
  
  // Render leaderboard
  renderModelLeaderboard(models);
  
  // Render by type chart
  if (data.byType) {
    renderModelByTypeChart(data.byType);
  }
  
  // Render model details
  renderModelDetails(data.models || models);
  
  // Render recommendations
  renderRecommendations(data);
}

function renderModelComparisonFromLocal() {
  const state = window.state || {};
  const prompts = state.data?.prompts || [];
  
  // Group by model
  const modelMap = new Map();
  
  prompts.forEach(p => {
    const modelName = p.model_name || p.modelName || 'Unknown';
    if (!modelMap.has(modelName)) {
      modelMap.set(modelName, {
        name: modelName,
        taskCount: 0,
        cpScores: [],
        qualityScores: []
      });
    }
    
    const model = modelMap.get(modelName);
    model.taskCount++;
    
    const cp = p.context_precision || p.cp;
    if (cp) model.cpScores.push(cp);
  });
  
  const models = Array.from(modelMap.values()).map(m => ({
    model: m.name,
    total_tasks: m.taskCount,
    avg_cp: m.cpScores.length > 0 ? m.cpScores.reduce((a, b) => a + b, 0) / m.cpScores.length : 0,
    pattern_count: 0
  })).sort((a, b) => b.avg_cp - a.avg_cp);
  
  renderModelComparison({ models, byType: {} });
}

function renderModelLeaderboard(models) {
  const container = document.getElementById('model-leaderboard');
  
  if (models.length === 0) {
    container.innerHTML = '<div class="empty-state">No model comparison data available</div>';
    return;
  }
  
  container.innerHTML = `
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Model</th>
          <th>Avg CP</th>
          <th>Tasks</th>
          <th>Patterns</th>
        </tr>
      </thead>
      <tbody>
        ${models.map((model, index) => `
          <tr>
            <td class="rank-cell">${index + 1}</td>
            <td class="model-name-cell">${model.model || model.name || 'Unknown'}</td>
            <td class="metric-cell">
              <div class="metric-bar">
                <div class="metric-bar-fill" style="width: ${(model.avg_cp || 0) * 100}%"></div>
                <span class="metric-value">${(model.avg_cp || 0).toFixed(2)}</span>
              </div>
            </td>
            <td>${model.total_tasks || model.taskCount || 0}</td>
            <td>${model.pattern_count || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderModelByTypeChart(data) {
  const canvas = document.getElementById('model-by-type-chart');
  if (!canvas || !window.Chart) return;
  
  const ctx = canvas.getContext('2d');
  
  // Prepare data
  const taskTypes = Object.keys(data);
  const models = new Set();
  taskTypes.forEach(type => {
    Object.keys(data[type] || {}).forEach(model => models.add(model));
  });
  
  const datasets = Array.from(models).map((model, index) => {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    return {
      label: model,
      data: taskTypes.map(type => data[type]?.[model]?.avg_cp || 0),
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      borderWidth: 1
    };
  });
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: taskTypes,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 1.0
        }
      },
      plugins: {
        legend: {
          position: 'top'
        }
      }
    }
  });
}

function renderModelDetails(models) {
  const container = document.getElementById('model-details');
  
  container.innerHTML = models.map(model => `
    <div class="model-detail-card card">
      <div class="model-detail-header">
        <h3 class="model-detail-name">${model.model || model.name}</h3>
        <div class="model-detail-badge">${model.total_tasks || 0} tasks</div>
      </div>
      <div class="model-detail-metrics">
        <div class="model-detail-metric">
          <div class="metric-label">Avg CP</div>
          <div class="metric-value">${(model.avg_cp || 0).toFixed(2)}</div>
        </div>
        <div class="model-detail-metric">
          <div class="metric-label">Patterns</div>
          <div class="metric-value">${model.pattern_count || 0}</div>
        </div>
      </div>
      ${model.patterns ? `
        <div class="model-detail-patterns">
          <div class="pattern-tags">
            ${model.patterns.slice(0, 5).map(p => `
              <span class="pattern-tag">${p}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');
}

function renderRecommendations(data) {
  const container = document.getElementById('recommendations');
  const recommendations = [];
  
  if (data.models && data.models.length > 0) {
    const bestModel = data.models[0];
    recommendations.push({
      type: 'success',
      message: `Best overall: ${bestModel.model} with CP ${bestModel.avg_cp?.toFixed(2)}`
    });
  }
  
  if (data.byType) {
    Object.entries(data.byType).forEach(([type, models]) => {
      if (models && Object.keys(models).length > 0) {
        const best = Object.entries(models)
          .map(([model, data]) => ({ model, cp: data.avg_cp || 0 }))
          .sort((a, b) => b.cp - a.cp)[0];
        
        if (best && best.cp > 0.7) {
          recommendations.push({
            type: 'info',
            message: `For ${type} tasks, ${best.model} performs best (CP: ${best.cp.toFixed(2)})`
          });
        }
      }
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'info',
      message: 'Continue using different models to see comparison data.'
    });
  }
  
  container.innerHTML = recommendations.map(rec => `
    <div class="recommendation-item recommendation-${rec.type}">
      <div class="recommendation-icon">${getRecommendationIcon(rec.type)}</div>
      <div class="recommendation-message">${rec.message}</div>
    </div>
  `).join('');
}

function getRecommendationIcon(type) {
  const icons = {
    success: '✓',
    warning: '⚠',
    info: 'ℹ'
  };
  return icons[type] || '•';
}

function updateComparison() {
  const metric = document.getElementById('metric-select').value;
  // Reload with different metric
  loadModelComparison();
}

async function refreshModelComparison() {
  await loadModelComparison();
}

// Export for view router
if (typeof window !== 'undefined') {
  window.renderModelComparisonView = renderModelComparisonView;
}

