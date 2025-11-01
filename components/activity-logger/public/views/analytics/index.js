/**
 * Analytics View - Main analytics dashboard
 */

function renderAnalyticsView(container) {
  const totalPrompts = window.state.data.prompts?.length || 0;
  const totalEvents = window.state.data.events?.length || 0;
  const hasData = totalPrompts > 0 || totalEvents > 0;
  
  // Calculate data age
  let dataFreshness = 'Unknown';
  if (totalPrompts > 0 || totalEvents > 0) {
    const allTimestamps = [
      ...(window.state.data.prompts || []).map(p => new Date(p.timestamp).getTime()),
      ...(window.state.data.events || []).map(e => new Date(e.timestamp).getTime())
    ].filter(t => !isNaN(t));
    
    if (allTimestamps.length > 0) {
      const newestData = Math.max(...allTimestamps);
      const age = Date.now() - newestData;
      if (age < 60 * 60 * 1000) {
        dataFreshness = 'Very Fresh (< 1h old)';
      } else if (age < 24 * 60 * 60 * 1000) {
        dataFreshness = `Fresh (${Math.round(age / (60 * 60 * 1000))}h old)`;
      } else {
        dataFreshness = `${Math.round(age / (24 * 60 * 60 * 1000))} days old`;
      }
    }
  }
  
  container.innerHTML = `
    <div class="analytics-view">
      
      ${!hasData ? `
        <!-- Data Status Alert -->
        <div class="data-status-alert">
          <div class="data-status-content">
            <div class="data-status-content-main">
              <h3>Waiting for Telemetry Data</h3>
              <p>
                No data has been received yet. Make sure the companion service is running:
              </p>
              <div class="data-status-instructions">
                <div class="data-status-instruction">
                  <code>cd cursor-telemetry/components/activity-logger/companion</code>
                </div>
                <div class="data-status-instruction">
                  <code>node src/index.js</code>
                </div>
              </div>
              <div class="data-status-box">
                <div class="data-status-label">Status:</div>
                <div class="data-status-value">
                  Events: ${totalEvents} | Prompts: ${totalPrompts}
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : `
        <!-- Data Status Info -->
        <div class="data-status-info">
          <div class="data-status-info-content">
            <div class="data-status-info-left">
              <span class="data-status-info-icon">📊</span>
              <div class="data-status-info-text">
                <h4>Telemetry Active</h4>
                <p>Tracking ${totalPrompts.toLocaleString()} prompts and ${totalEvents.toLocaleString()} events</p>
              </div>
            </div>
            <div class="data-status-info-right">
              <div class="data-status-freshness">
                <div class="data-status-freshness-label">Data Freshness</div>
                <div class="data-status-freshness-value">${dataFreshness}</div>
              </div>
            </div>
          </div>
        </div>
      `}
      
      <!-- AI Activity & Code Output -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">AI Activity & Code Output</h3>
          <p class="card-subtitle">Prompt frequency and code changes correlation</p>
        </div>
        <div class="card-body">
          <canvas id="aiActivityChart" class="chart-container"></canvas>
        </div>
      </div>

      <!-- Context Usage Over Time -->
      <div class="card">
        <div class="card-header">
          <div class="chart-header-controls">
            <h3 class="card-title">Context Usage Over Time</h3>
            <div class="timescale-controls">
              <button class="btn-timescale active" data-hours="24" onclick="updateContextChartTimescale(24)">24h</button>
              <button class="btn-timescale" data-hours="72" onclick="updateContextChartTimescale(72)">3d</button>
              <button class="btn-timescale" data-hours="168" onclick="updateContextChartTimescale(168)">7d</button>
              <button class="btn-timescale" data-hours="720" onclick="updateContextChartTimescale(720)">30d</button>
            </div>
          </div>
          <p class="card-subtitle">AI context window utilization with smart scaling (auto-adjusts range for better detail). Color-coded: <span style="color: #10b981;">Green</span> = Normal, <span style="color: #f59e0b;">Orange</span> = Medium-High, <span style="color: #ef4444;">Red</span> = High</p>
        </div>
        <div class="card-body">
          <canvas id="promptTokensChart" class="chart-container-small"></canvas>
        </div>
      </div>

      <!-- Model Usage Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">AI Model Usage</h3>
          <p class="card-subtitle">Distribution of models used across prompts and modes</p>
        </div>
        <div class="card-body">
          <div id="modelUsageAnalytics" style="min-height: 250px;"></div>
        </div>
      </div>

      <!-- Breakdown Charts -->
      <div class="analytics-grid">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">File Changes by Type</h3>
            <p class="card-subtitle">Extension breakdown</p>
          </div>
          <div class="card-body">
            <canvas id="fileTypesChart"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity (15-min intervals)</h3>
            <p class="card-subtitle">Last 12 hours of activity</p>
          </div>
          <div class="card-body">
            <canvas id="hourlyChart"></canvas>
          </div>
        </div>
      </div>

      <!-- Context File Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Context File Analytics</h3>
          <p class="card-subtitle">@ referenced files and context patterns</p>
        </div>
        <div class="card-body">
          <div id="contextFileAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- Enhanced Context Window Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Context Window Analytics</h3>
          <p class="card-subtitle">Real metrics: file references, estimated tokens, context adoption rate, and most-mentioned files from your actual prompt data</p>
        </div>
        <div class="card-body">
          <div id="enhancedContextAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- Productivity Insights -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Productivity Insights</h3>
          <p class="card-subtitle">Coding velocity: active time estimation, prompt iteration patterns, line changes, code churn hotspots, and daily metrics</p>
        </div>
        <div class="card-body">
          <div id="productivityInsights" style="min-height: 200px;"></div>
        </div>
      </div>

    </div>
  `;

  // Render charts after DOM is ready
  setTimeout(() => {
    const state = window.state || {};
    const events = state.data?.events || [];
    const prompts = state.data?.prompts || [];
    
    console.log('[CHART] Rendering analytics charts with data:', {
      events: events.length,
      prompts: prompts.length,
      stateAvailable: !!window.state,
      chartsAvailable: {
        renderAIActivityChart: !!window.renderAIActivityChart,
        renderPromptTokensChart: !!window.renderPromptTokensChart,
        renderFileTypesChart: !!window.renderFileTypesChart,
        renderHourlyChart: !!window.renderHourlyChart,
        renderModelUsageAnalytics: !!window.renderModelUsageAnalytics,
        renderEnhancedContextAnalytics: !!window.renderEnhancedContextAnalytics,
        renderProductivityInsights: !!window.renderProductivityInsights,
        renderContextFileAnalytics: !!window.renderContextFileAnalytics,
        createChart: !!window.createChart
      }
    });
    
    if (!window.createChart) {
      console.error('[CHART] createChart function not available!');
      return;
    }
    
    if (window.renderAIActivityChart) {
      try {
        window.renderAIActivityChart();
      } catch (err) {
        console.error('[CHART] Error rendering AI Activity Chart:', err);
      }
    } else {
      console.warn('[CHART] renderAIActivityChart not available');
    }
    
    if (window.renderPromptTokensChart) {
      try {
        window.renderPromptTokensChart();
      } catch (err) {
        console.error('[CHART] Error rendering Prompt Tokens Chart:', err);
      }
    } else {
      console.warn('[CHART] renderPromptTokensChart not available');
    }
    
    if (window.renderFileTypesChart) {
      try {
        window.renderFileTypesChart();
      } catch (err) {
        console.error('[CHART] Error rendering File Types Chart:', err);
      }
    } else {
      console.warn('[CHART] renderFileTypesChart not available');
    }
    
    if (window.renderHourlyChart) {
      try {
        window.renderHourlyChart();
      } catch (err) {
        console.error('[CHART] Error rendering Hourly Chart:', err);
      }
    } else {
      console.warn('[CHART] renderHourlyChart not available');
    }
    
    if (window.renderContextFileAnalytics) {
      window.renderContextFileAnalytics().catch(err => console.warn('[INFO] Context file analytics not available:', err.message));
    } else {
      console.warn('[CHART] renderContextFileAnalytics not available');
    }
    
    if (window.renderModelUsageAnalytics) {
      try {
        window.renderModelUsageAnalytics();
      } catch (err) {
        console.error('[CHART] Error rendering Model Usage Analytics:', err);
      }
    } else {
      console.warn('[CHART] renderModelUsageAnalytics not available');
    }
    
    if (window.renderEnhancedContextAnalytics) {
      window.renderEnhancedContextAnalytics().catch(err => console.warn('[INFO] Context analytics not available:', err.message));
    } else {
      console.warn('[CHART] renderEnhancedContextAnalytics not available');
    }
    
    if (window.renderProductivityInsights) {
      window.renderProductivityInsights().catch(err => console.warn('[INFO] Productivity insights not available:', err.message));
    } else {
      console.warn('[CHART] renderProductivityInsights not available');
    }
  }, 300);
}

// Export to window for global access
window.renderAnalyticsView = renderAnalyticsView;

