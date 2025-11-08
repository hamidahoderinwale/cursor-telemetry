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
          <div class="chart-header-controls">
            <h3 class="card-title" title="Shows the correlation between AI prompts and resulting code changes over time. The chart displays prompt frequency alongside code modifications to help identify patterns in your AI-assisted development workflow. Use the time scale buttons to view different time periods">AI Activity & Code Output</h3>
            <div class="timescale-controls" id="aiActivityTimescaleControls">
              <button class="btn-timescale active" data-scale="hourly" onclick="updateAIActivityChartTimescale('hourly')" title="View activity aggregated by hour - shows the last 24 hours">Hourly</button>
              <button class="btn-timescale" data-scale="daily" onclick="updateAIActivityChartTimescale('daily')" title="View activity aggregated by day - shows the last 30 days">Daily</button>
              <button class="btn-timescale" data-scale="weekly" onclick="updateAIActivityChartTimescale('weekly')" title="View activity aggregated by week - shows the last 12 weeks">Weekly</button>
              <button class="btn-timescale" data-scale="monthly" onclick="updateAIActivityChartTimescale('monthly')" title="View activity aggregated by month - shows the last 12 months">Monthly</button>
            </div>
          </div>
          <p class="card-subtitle">Prompt frequency and code changes correlation. Select time scale to view different time periods.</p>
        </div>
        <div class="card-body">
          <canvas id="aiActivityChart" class="chart-container"></canvas>
        </div>
      </div>

      <!-- Context Usage Over Time -->
      <div class="card">
        <div class="card-header">
          <div class="chart-header-controls">
            <h3 class="card-title" title="Tracks how much of the AI context window you're using over time. The context window is the maximum number of tokens the AI can consider. Higher usage means more files or code were included in your prompts. Color coding: Green = Normal (under 70%), Orange = Medium-High (70-90%), Red = High (over 90%)">Context Usage Over Time</h3>
            <div class="timescale-controls">
              <button class="btn-timescale active" data-hours="24" onclick="updateContextChartTimescale(24)" title="Show context usage for the last 24 hours">24h</button>
              <button class="btn-timescale" data-hours="72" onclick="updateContextChartTimescale(72)" title="Show context usage for the last 3 days">3d</button>
              <button class="btn-timescale" data-hours="168" onclick="updateContextChartTimescale(168)" title="Show context usage for the last 7 days">7d</button>
              <button class="btn-timescale" data-hours="720" onclick="updateContextChartTimescale(720)" title="Show context usage for the last 30 days">30d</button>
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
          <h3 class="card-title" title="Shows which AI models you've been using (e.g., GPT-4, Claude, etc.) and how frequently each model is used. Also breaks down usage by mode (chat, edit, etc.) to help you understand your AI interaction patterns">AI Model Usage</h3>
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
            <h3 class="card-title" title="Breakdown of file modifications by file extension. Helps identify which file types you work with most frequently (e.g., .js, .ts, .py, .md, etc.)">File Changes by Type</h3>
            <p class="card-subtitle">Extension breakdown</p>
          </div>
          <div class="card-body">
            <canvas id="fileTypesChart"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title" title="Activity timeline showing development events aggregated into 15-minute intervals. Useful for identifying peak activity periods and understanding your daily coding patterns">Recent Activity (15-min intervals)</h3>
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
          <h3 class="card-title" title="Analyzes which files you reference most often in your prompts using @ mentions. Shows patterns in how you use context files and which files are most frequently included in your AI interactions">Context File Analytics</h3>
          <p class="card-subtitle">@ referenced files and context patterns</p>
        </div>
        <div class="card-body">
          <div id="contextFileAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- Enhanced Context Window Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Detailed analysis of context window usage including: number of files referenced, estimated token counts, how often you use context files (adoption rate), and which files are mentioned most frequently. Based on actual data from your Cursor database">Context Window Analytics</h3>
          <p class="card-subtitle">Real metrics: file references, estimated tokens, context adoption rate, and most-mentioned files from your actual prompt data</p>
        </div>
        <div class="card-body">
          <div id="enhancedContextAnalytics" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- Productivity Insights -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Comprehensive productivity metrics including: estimated active coding time, patterns in how you iterate on prompts, total line changes, areas of high code churn (frequent modifications), and daily productivity trends">Productivity Insights</h3>
          <p class="card-subtitle">Coding velocity: active time estimation, prompt iteration patterns, line changes, code churn hotspots, and daily metrics</p>
        </div>
        <div class="card-body">
          <div id="productivityInsights" style="min-height: 200px;"></div>
        </div>
      </div>

      <!-- Prompt Effectiveness -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Measures how effective your prompts are by tracking: time between sending a prompt and seeing code changes, success rate of prompts leading to modifications, iteration patterns (how many times you refine prompts), and overall workflow efficiency">Prompt Effectiveness</h3>
          <p class="card-subtitle">Time from prompt to code change, success rate, iteration patterns, and workflow efficiency</p>
        </div>
        <div class="card-body">
          <div id="promptEffectiveness" style="min-height: 200px;"></div>
        </div>
      </div>

    </div>
  `;

  // Render charts after DOM is ready (300ms delay to ensure all modules loaded)
  setTimeout(() => {
    // Check if analytics view is still active
    const viewContainer = document.getElementById('viewContainer');
    if (!viewContainer || !viewContainer.innerHTML.includes('analytics-view')) {
      // View has been switched away, don't render charts
      return;
    }
    
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
        // Auto-detect and set initial time scale button
        const allEvents = state.data?.events || [];
        const allPrompts = state.data?.prompts || [];
        const now = Date.now();
        const oldestEvent = allEvents.length > 0 ? Math.min(...allEvents.map(e => new Date(e.timestamp).getTime())) : now;
        const oldestPrompt = allPrompts.length > 0 ? Math.min(...allPrompts.map(p => new Date(p.timestamp).getTime())) : now;
        const oldestData = Math.min(oldestEvent, oldestPrompt);
        const daysSpan = (now - oldestData) / (24 * 60 * 60 * 1000);
        
        // Set initial active button based on data span
        let initialScale = 'daily';
        if (daysSpan < 1) {
          initialScale = 'hourly';
        } else if (daysSpan <= 7) {
          initialScale = 'daily';
        } else if (daysSpan <= 90) {
          initialScale = 'daily';
        } else {
          initialScale = 'weekly';
        }
        
        // Update button state
        const controls = document.getElementById('aiActivityTimescaleControls');
        if (controls) {
          controls.querySelectorAll('.btn-timescale').forEach(btn => {
            if (btn.dataset.scale === initialScale) {
              btn.classList.add('active');
            } else {
              btn.classList.remove('active');
            }
          });
        }
        
        // Render with auto-detected scale (pass null to use auto-detect logic)
        window.renderAIActivityChart(null);
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
      window.renderContextFileAnalytics().catch(err => {
        // Only log if it's not a missing element error
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[INFO] Context file analytics not available:', err.message);
        }
      });
    }
    // Note: renderContextFileAnalytics may not be available if analytics-renderers.js is not loaded (ES module)
    
    if (window.renderModelUsageAnalytics) {
      try {
        window.renderModelUsageAnalytics();
      } catch (err) {
        console.error('[CHART] Error rendering Model Usage Analytics:', err);
      }
    }
    // Note: renderModelUsageAnalytics may not be available if analytics-renderers.js is not loaded (ES module)
    
    if (window.renderEnhancedContextAnalytics) {
      window.renderEnhancedContextAnalytics().catch(err => {
        // Only log if it's not a missing element error
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[INFO] Context analytics not available:', err.message);
        }
      });
    }
    // Note: renderEnhancedContextAnalytics may not be available if analytics-renderers.js is not loaded (ES module)
    
    if (window.renderProductivityInsights) {
      window.renderProductivityInsights().catch(err => {
        // Only log if it's not a missing element error
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[INFO] Productivity insights not available:', err.message);
        }
      });
    }
    // Note: renderProductivityInsights may not be available if analytics-renderers.js is not loaded (ES module)
    
    if (window.renderPromptEffectiveness) {
      try {
        window.renderPromptEffectiveness();
      } catch (err) {
        console.error('[CHART] Error rendering Prompt Effectiveness:', err);
      }
    } else {
      console.warn('[CHART] renderPromptEffectiveness not available');
    }
  }, 300);
}

// Export to window for global access
window.renderAnalyticsView = renderAnalyticsView;

