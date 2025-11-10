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

      <!-- Context Evolution Timeline -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Tracks how your context window evolves over time - showing when files are added or removed from context, context size changes, and context switching patterns">Context Evolution Timeline</h3>
          <p class="card-subtitle">Context window changes, file additions/removals, and context switching patterns over time</p>
        </div>
        <div class="card-body">
          <div id="contextEvolutionTimeline" style="min-height: 300px;"></div>
        </div>
      </div>

      <!-- Prompt-to-Code Correlation -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Analyzes the correlation between AI prompts and resulting code changes - showing success rate, time from prompt to code change, and how many changes each prompt generates">Prompt-to-Code Correlation</h3>
          <p class="card-subtitle">Success rate, time to first change, and code change patterns following prompts</p>
        </div>
        <div class="card-body">
          <div id="promptToCodeCorrelation" style="min-height: 300px;"></div>
        </div>
      </div>

      <!-- Git Commit Timeline -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Shows your git commit history with commit messages, timestamps, and branch information. Helps track development milestones and commit frequency">Git Commit Timeline</h3>
          <p class="card-subtitle">Recent commits, commit frequency, and branch activity</p>
        </div>
        <div class="card-body">
          <div id="gitCommitTimeline" style="min-height: 250px;"></div>
        </div>
      </div>

      <!-- File Hotspots -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Identifies files that are edited most frequently - showing edit counts, lines changed, and recency to highlight your most active development areas">File Hotspots</h3>
          <p class="card-subtitle">Most frequently edited files with edit counts, lines changed, and activity scores</p>
        </div>
        <div class="card-body">
          <div id="fileHotspots" style="min-height: 250px;"></div>
        </div>
      </div>

    </div>
  `;

  // Render charts immediately with available data (fast loading)
  // Use requestAnimationFrame for immediate render, then load heavy analytics progressively
  requestAnimationFrame(() => {
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
      stateAvailable: !!window.state
    });
    
    if (!window.createChart) {
      console.error('[CHART] createChart function not available!');
      return;
    }
    
    // PHASE 1: Render fast charts immediately with available data
    renderFastCharts(events, prompts);
    
    // PHASE 2: Load more data and render heavy analytics progressively
    if (events.length < 200 || prompts.length < 200) {
      // Load more data in background for complete analytics
      loadMoreDataForAnalytics().then(() => {
        const updatedEvents = window.state?.data?.events || [];
        const updatedPrompts = window.state?.data?.prompts || [];
        renderHeavyAnalytics(updatedEvents, updatedPrompts);
      });
    } else {
      // Already have enough data, render heavy analytics
      setTimeout(() => renderHeavyAnalytics(events, prompts), 100);
    }
  });
  
  // Fast charts that render immediately (with minimal data)
  function renderFastCharts(events, prompts) {
    console.log('[ANALYTICS] Rendering fast charts with', events.length, 'events and', prompts.length, 'prompts');
    
    // Render basic charts immediately - these are fast
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
    
    console.log('[ANALYTICS] Fast charts rendered');
  }
  
  // Heavy analytics that load progressively
  function renderHeavyAnalytics(events, prompts) {
    console.log('[ANALYTICS] Rendering heavy analytics with', events.length, 'events and', prompts.length, 'prompts');
    
    // Defer heavy analytics to avoid blocking
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        renderHeavyAnalyticsInternal(events, prompts);
      }, { timeout: 1000 });
    } else {
      setTimeout(() => renderHeavyAnalyticsInternal(events, prompts), 500);
    }
  }
  
  function renderHeavyAnalyticsInternal(events, prompts) {
    if (window.renderContextFileAnalytics) {
      window.renderContextFileAnalytics().catch(err => {
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[INFO] Context file analytics not available:', err.message);
        }
      });
    }
    
    if (window.renderModelUsageAnalytics) {
      try {
        window.renderModelUsageAnalytics();
      } catch (err) {
        console.error('[CHART] Error rendering Model Usage Analytics:', err);
      }
    }
    
    if (window.renderEnhancedContextAnalytics) {
      window.renderEnhancedContextAnalytics().catch(err => {
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[INFO] Context analytics not available:', err.message);
        }
      });
    }
    
    if (window.renderProductivityInsights) {
      window.renderProductivityInsights().catch(err => {
        if (!err.message || !err.message.includes('not found')) {
          console.warn('[INFO] Productivity insights not available:', err.message);
        }
      });
    }
    
    if (window.renderPromptEffectiveness) {
      try {
        window.renderPromptEffectiveness();
      } catch (err) {
        console.error('[CHART] Error rendering Prompt Effectiveness:', err);
      }
    }
    
    // Advanced visualizations - lazy load with intersection observer
    const lazyLoadVisualizations = () => {
      const containers = [
        { id: 'contextEvolutionTimeline', render: window.renderContextEvolutionTimeline },
        { id: 'promptToCodeCorrelation', render: window.renderPromptToCodeCorrelation },
        { id: 'gitCommitTimeline', render: window.renderGitCommitTimeline },
        { id: 'fileHotspots', render: window.renderFileHotspots }
      ];
      
      if (window.performanceOptimizer && window.performanceOptimizer.lazyLoad) {
        containers.forEach(({ id, render }) => {
          if (render) {
            window.performanceOptimizer.lazyLoad(`#${id}`, (element) => {
              render().catch(err => {
                if (!err.message || !err.message.includes('not found')) {
                  console.warn(`[INFO] ${id} not available:`, err.message);
                }
              });
            });
          }
        });
      } else {
        // Fallback: load all immediately
        containers.forEach(({ render }) => {
          if (render) {
            render().catch(err => {
              if (!err.message || !err.message.includes('not found')) {
                console.warn('[INFO] Visualization not available:', err.message);
              }
            });
          }
        });
      }
    };
    
    // Use requestIdleCallback for non-critical visualizations (already in idle callback)
    lazyLoadVisualizations();
  }
  
  // Load more data for analytics if needed
  async function loadMoreDataForAnalytics() {
    if (!window.APIClient) return;
    
    try {
      // Load up to 200 items for better analytics
      const currentEvents = window.state?.data?.events?.length || 0;
      const currentPrompts = window.state?.data?.prompts?.length || 0;
      
      if (currentEvents < 200) {
        const needed = 200 - currentEvents;
        const response = await window.APIClient.get(`/api/activity?limit=${needed}&offset=${currentEvents}`, {
          timeout: 10000,
          retries: 1,
          silent: true
        });
        
        if (response?.data && Array.isArray(response.data)) {
          const existingIds = new Set((window.state.data.events || []).map(e => e.id));
          const newEvents = response.data.filter(e => !existingIds.has(e.id));
          if (newEvents.length > 0) {
            window.state.data.events = [...(window.state.data.events || []), ...newEvents];
            console.log(`[ANALYTICS] Loaded ${newEvents.length} additional events`);
          }
        }
      }
      
      if (currentPrompts < 200) {
        const needed = 200 - currentPrompts;
        const response = await window.APIClient.get(`/entries?limit=${needed}&offset=${currentPrompts}`, {
          timeout: 10000,
          retries: 1,
          silent: true
        });
        
        if (response?.entries && Array.isArray(response.entries)) {
          const existingIds = new Set((window.state.data.prompts || []).map(p => p.id || p.prompt_id));
          const newPrompts = response.entries.filter(p => {
            const id = p.id || p.prompt_id;
            return id && !existingIds.has(id);
          });
          if (newPrompts.length > 0) {
            window.state.data.prompts = [...(window.state.data.prompts || []), ...newPrompts];
            console.log(`[ANALYTICS] Loaded ${newPrompts.length} additional prompts`);
          }
        }
      }
    } catch (err) {
      console.warn('[ANALYTICS] Failed to load additional data:', err.message);
    }
  }
}

// Export to window for global access
window.renderAnalyticsView = renderAnalyticsView;

