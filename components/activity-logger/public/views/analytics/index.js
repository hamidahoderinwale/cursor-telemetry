/**
 * Analytics View - Main analytics dashboard
 */

// Render guards to prevent excessive re-rendering
let _isRendering = false;
let _lastRenderTime = 0;
let _renderDebounceTimer = null;
const MIN_RENDER_INTERVAL = 2000; // Minimum 2 seconds between full renders

async function renderAnalyticsView(container) {
  // Prevent excessive re-rendering
  const now = Date.now();
  if (_isRendering) {
    console.log('[ANALYTICS] Render already in progress, skipping');
    return;
  }
  
  if (now - _lastRenderTime < MIN_RENDER_INTERVAL) {
    console.log('[ANALYTICS] Render too soon, debouncing');
    if (_renderDebounceTimer) {
      clearTimeout(_renderDebounceTimer);
    }
    _renderDebounceTimer = setTimeout(() => {
      renderAnalyticsView(container);
    }, MIN_RENDER_INTERVAL - (now - _lastRenderTime));
    return;
  }
  
  _isRendering = true;
  _lastRenderTime = now;
  
  // Lazy load analytics services if not already loaded
  if (window.loadAnalyticsServices && !window._analyticsServicesLoaded) {
    await window.loadAnalyticsServices();
  }
  
  // Ensure advancedVisualizations has the latest APIClient reference
  if (window.advancedVisualizations && window.APIClient) {
    window.advancedVisualizations.updateAPIClient();
  }
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
                ${(() => {
                  // Check for data quality issues
                  const prompts = window.state.data.prompts || [];
                  const events = window.state.data.events || [];
                  
                  // Check model data availability - more thorough check
                  const promptsWithModel = prompts.filter(p => {
                    // Check all possible model field locations
                    if (p.modelName || p.model_name || p.model) return true;
                    if (p.modelInfo) {
                      const modelInfo = typeof p.modelInfo === 'string' ? 
                        (() => { try { return JSON.parse(p.modelInfo); } catch(e) { return {}; } })() : 
                        p.modelInfo;
                      if (modelInfo?.model || modelInfo?.modelName || modelInfo?.model_name) return true;
                    }
                    if (p.metadata?.model) return true;
                    if (p.modelType || p.model_type) return true;
                    return false;
                  }).length;
                  
                  // Check events with diff stats - check multiple field names
                  const fileChangeEvents = events.filter(e => {
                    const type = e.type || '';
                    return type === 'file-change' || type === 'file_change' || 
                           type === 'code-change' || type === 'code_change' || 
                           type === 'file-edit' || type === 'file_edit';
                  });
                  
                  const eventsWithDiffStats = fileChangeEvents.filter(e => {
                    try {
                      const details = typeof e.details === 'string' ? JSON.parse(e.details) : (e.details || {});
                      // Check multiple possible field names for line changes
                      return details?.lines_added !== undefined || 
                             details?.lines_removed !== undefined ||
                             details?.linesAdded !== undefined ||
                             details?.linesRemoved !== undefined ||
                             details?.diff_stats?.lines_added !== undefined ||
                             details?.diff_stats?.lines_removed !== undefined ||
                             details?.chars_added !== undefined ||
                             details?.chars_removed !== undefined;
                    } catch {
                      return false;
                    }
                  }).length;
                  
                  const issues = [];
                  // Only show warning if we have prompts but none have model info
                  if (prompts.length > 0 && promptsWithModel === 0) {
                    issues.push('Model information not available. The Cursor database may not include model details for older prompts. New prompts should capture model information automatically.');
                  } else if (prompts.length > 0 && promptsWithModel < prompts.length * 0.5) {
                    // Show info if less than 50% have model info
                    issues.push(`Model information partially available (${promptsWithModel} of ${prompts.length} prompts have model data). This is normal for data collected before model tracking was added.`);
                  }
                  
                  // Only show warning if we have file change events but none have diff stats
                  if (fileChangeEvents.length > 0 && eventsWithDiffStats === 0) {
                    issues.push('Line change statistics not available for file changes');
                  } else if (fileChangeEvents.length > 0 && eventsWithDiffStats < fileChangeEvents.length * 0.5) {
                    // Show info if less than 50% have diff stats
                    issues.push(`Line change statistics partially available (${eventsWithDiffStats} of ${fileChangeEvents.length} file changes have stats)`);
                  }
                  
                  if (issues.length > 0) {
                    return `
                      <div class="data-quality-notice" style="margin-top: var(--space-sm);">
                        <div class="data-quality-notice-header" onclick="this.parentElement.classList.toggle('expanded')">
                          <div style="display: flex; align-items: center; gap: var(--space-xs);">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink: 0;">
                              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                            </svg>
                            <span style="font-size: var(--text-sm); font-weight: 600; color: #856404;">Data Quality Notice</span>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" class="data-quality-notice-chevron" style="transition: transform 0.2s;">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                          </svg>
                        </div>
                        <div class="data-quality-notice-content">
                          <ul style="margin: var(--space-xs) 0; padding-left: var(--space-md); font-size: var(--text-sm); color: #856404; line-height: 1.6;">
                            ${issues.map(issue => `<li style="margin-bottom: var(--space-xs);">${issue}</li>`).join('')}
                          </ul>
                          <div style="margin-top: var(--space-sm); padding: var(--space-sm); background: rgba(255, 255, 255, 0.5); border-radius: var(--radius-sm); font-size: var(--text-xs); color: #856404; line-height: 1.5;">
                            <strong>Note:</strong> Data is loading correctly, but some fields may be missing. This is normal if the companion service hasn't captured model information or if events were created before diff stats were added.
                          </div>
                        </div>
                      </div>
                    `;
                  }
                  return '';
                })()}
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
      
      <!-- Split Pane Layout: Charts on Left, DB Preview on Right -->
      <div class="analytics-split-view">
        <!-- Left Panel: Charts -->
        <div class="analytics-charts-panel">
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
              <p class="card-subtitle">Shows the relationship between AI prompts and resulting code changes over time.</p>
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
              <p class="card-subtitle">Tracks how much of the AI context window is used over time. <span style="color: #10b981; font-weight: 500;">Green</span> = Normal (&lt;70%), <span style="color: #f59e0b; font-weight: 500;">Orange</span> = Medium-High (70–90%), <span style="color: #ef4444; font-weight: 500;">Red</span> = High (&gt;90%)</p>
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
          <div id="modelUsageAnalytics"></div>
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
            <div class="chart-container-small">
              <canvas id="fileTypesChart"></canvas>
            </div>
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
          <div id="contextFileAnalytics"></div>
        </div>
      </div>

      <!-- Enhanced Context Window Analytics -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Detailed analysis of context window usage including: number of files referenced, estimated token counts, how often you use context files (adoption rate), and which files are mentioned most frequently. Based on actual data from your Cursor database">Context Window Analytics</h3>
          <p class="card-subtitle">Real metrics: file references, estimated tokens, context adoption rate, and most-mentioned files from your actual prompt data</p>
        </div>
        <div class="card-body">
          <div id="enhancedContextAnalytics"></div>
        </div>
      </div>

      <!-- Productivity Insights -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Comprehensive productivity metrics including: estimated active coding time, patterns in how you iterate on prompts, total line changes, areas of high code churn (frequent modifications), and daily productivity trends">Productivity Insights</h3>
          <p class="card-subtitle">Coding velocity: active time estimation, prompt iteration patterns, line changes, code churn hotspots, and daily metrics</p>
        </div>
        <div class="card-body">
          <div id="productivityInsights"></div>
        </div>
      </div>

      <!-- Prompt Effectiveness -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Measures how effective your prompts are by tracking: time between sending a prompt and seeing code changes, success rate of prompts leading to modifications, iteration patterns (how many times you refine prompts), and overall workflow efficiency">Prompt Effectiveness</h3>
          <p class="card-subtitle">Time from prompt to code change, success rate, iteration patterns, and workflow efficiency</p>
        </div>
        <div class="card-body">
          <div id="promptEffectiveness"></div>
        </div>
      </div>

      <!-- Development Insights Section -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title" title="Quick insights into your development patterns - fast metrics that help you understand your coding habits and AI usage">Development Insights</h3>
          <p class="card-subtitle">Fast insights into your development patterns</p>
        </div>
        <div class="card-body">
          <div class="quick-wins-grid">
            
            <!-- Prompt Success Rate -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Percentage of prompts that resulted in code changes. Higher is better - indicates effective AI usage.">
                Prompt Success Rate
              </h4>
              <div id="promptSuccessRate" class="quick-win-value" style="color: var(--color-primary, #3b82f6);">
                Calculating...
              </div>
              <div class="quick-win-description">
                Prompts with code changes / Total prompts
              </div>
            </div>

            <!-- Context Efficiency Score -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Average lines of code added per context file. Higher values indicate more efficient context usage - fewer files needed for better results.">
                Context Efficiency Score
              </h4>
              <div id="contextEfficiencyScore" class="quick-win-value" style="color: var(--color-accent, #10b981);">
                Calculating...
              </div>
              <div class="quick-win-description">
                Lines added / Context files used
              </div>
            </div>

            <!-- Model Usage Distribution -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Distribution of AI models used across all prompts. Shows which models you use most frequently.">
                Model Usage Distribution
              </h4>
              <div id="modelUsageChart">
                <canvas id="modelUsagePieChart"></canvas>
              </div>
            </div>

            <!-- Context File Frequency -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Most frequently used context files. Files that appear often in your prompts are likely important dependencies or core files.">
                Most Used Context Files
              </h4>
              <div id="contextFileFrequency">
                <canvas id="contextFileChart"></canvas>
              </div>
            </div>

            <!-- Thinking Time Distribution -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Distribution of AI response times (thinking time). Shows how long models take to respond - useful for performance analysis.">
                Thinking Time Distribution
              </h4>
              <div id="thinkingTimeChart">
                <canvas id="thinkingTimeHistogram"></canvas>
              </div>
            </div>

            <!-- Time-of-Day Activity -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Activity patterns throughout the day. Shows when you're most productive - helps identify peak coding hours.">
                24-Hour Activity Pattern
              </h4>
              <div id="timeOfDayChart">
                <canvas id="timeOfDayBarChart"></canvas>
              </div>
            </div>

            <!-- Conversation Length Distribution -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Distribution of conversation lengths (message counts). Shows whether you have many short conversations or fewer long ones.">
                Conversation Length Distribution
              </h4>
              <div id="conversationLengthChart">
                <canvas id="conversationLengthHistogram"></canvas>
              </div>
            </div>

            <!-- Intent Distribution -->
            <div class="quick-win-card">
              <h4 class="quick-win-title" title="Distribution of development intents (feature, bug-fix, refactor, etc.). Shows what types of work you do most often.">
                Intent Distribution
              </h4>
              <div id="intentDistribution">
                <canvas id="intentTagCloud"></canvas>
              </div>
            </div>

          </div>
        </div>
        </div>
        
        <!-- Right Panel: Database Preview -->
        <div class="analytics-db-panel">
          <div id="analyticsDbPreview"></div>
        </div>
      </div>

    </div>
  `;
  
  // Initialize database preview and split pane
  setTimeout(() => {
    if (window.dbPreview) {
      const dbPreviewContainer = document.getElementById('analyticsDbPreview');
      if (dbPreviewContainer) {
        window.dbPreview.render(dbPreviewContainer);
      }
    }
    
    // Initialize split pane resizer
    if (window.initializeAnalyticsSplitPane) {
      window.initializeAnalyticsSplitPane();
    }
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('view-rendered', { 
      detail: { view: 'analytics' } 
    }));
  }, 100);

  // Render charts immediately with available data (fast loading)
  // Use requestAnimationFrame for immediate render, then load heavy analytics progressively
  requestAnimationFrame(() => {
    // Check if analytics view is still active
    const viewContainer = document.getElementById('viewContainer');
    if (!viewContainer) {
      console.warn('[ANALYTICS] View container not found, skipping auto-load');
      return;
    }
    
    // Verify analytics view is rendered
    const analyticsView = viewContainer.querySelector('.analytics-view');
    if (!analyticsView && !viewContainer.innerHTML.includes('analytics-view')) {
      console.warn('[ANALYTICS] Analytics view not found in container, skipping auto-load');
      return;
    }
    
    const state = window.state || {};
    const events = state.data?.events || [];
    const prompts = state.data?.prompts || [];
    
    // Skip chart rendering if no data (faster)
    if (events.length === 0 && prompts.length === 0) {
      console.log('[CHART] Skipping chart rendering - no data available');
      return;
    }
    
    console.log('[CHART] Rendering analytics charts with data:', {
      events: events.length,
      prompts: prompts.length,
      stateAvailable: !!window.state
    });
    
    if (!window.createChart) {
      console.error('[CHART] createChart function not available!');
      return;
    }
    
    // PHASE 1: Render fast charts immediately with available data (defer to next frame)
    requestAnimationFrame(() => {
      // Double-check view is still active before rendering
      const currentView = document.getElementById('viewContainer');
      if (currentView && (currentView.querySelector('.analytics-view') || currentView.innerHTML.includes('analytics-view'))) {
        renderFastCharts(events, prompts);
        renderQuickWins(events, prompts);
      }
    });
    
    // PHASE 2: Load more data and render heavy analytics progressively
    // Defer loading additional data more aggressively
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        if (events.length < 200 || prompts.length < 200) {
          // Load more data in background for complete analytics
          loadMoreDataForAnalytics().then(() => {
            const updatedEvents = window.state?.data?.events || [];
            const updatedPrompts = window.state?.data?.prompts || [];
            if (window.state?.currentView === 'analytics') {
              renderHeavyAnalytics(updatedEvents, updatedPrompts);
            }
          }).catch(err => {
            console.warn('[ANALYTICS] Failed to load additional data:', err.message);
            if (window.state?.currentView === 'analytics') {
              renderHeavyAnalytics(events, prompts);
            }
          });
        } else {
          // Already have enough data, render heavy analytics
          if (window.state?.currentView === 'analytics') {
            renderHeavyAnalytics(events, prompts);
          }
        }
      }, { timeout: 3000 }); // More aggressive deferral
    } else {
      setTimeout(() => {
        if (events.length < 200 || prompts.length < 200) {
          loadMoreDataForAnalytics().then(() => {
            const updatedEvents = window.state?.data?.events || [];
            const updatedPrompts = window.state?.data?.prompts || [];
            if (window.state?.currentView === 'analytics') {
              renderHeavyAnalytics(updatedEvents, updatedPrompts);
            }
          }).catch(err => {
            console.warn('[ANALYTICS] Failed to load additional data:', err.message);
            if (window.state?.currentView === 'analytics') {
              renderHeavyAnalytics(events, prompts);
            }
          });
        } else {
          if (window.state?.currentView === 'analytics') {
            renderHeavyAnalytics(events, prompts);
          }
        }
      }, 2000);
    }
  });
  
  // Guard to prevent excessive fast charts rendering
  let _fastChartsRendering = false;
  let _fastChartsLastRender = 0;
  const FAST_CHARTS_MIN_INTERVAL = 1500; // Minimum 1.5 seconds between fast charts renders
  
  // Fast charts that render immediately (with minimal data)
  function renderFastCharts(events, prompts) {
    // Prevent excessive re-rendering
    const now = Date.now();
    if (_fastChartsRendering) {
      console.log('[ANALYTICS] Fast charts already rendering, skipping');
      return;
    }
    
    if (now - _fastChartsLastRender < FAST_CHARTS_MIN_INTERVAL) {
      console.log('[ANALYTICS] Fast charts render too soon, skipping');
      return;
    }
    
    _fastChartsRendering = true;
    _fastChartsLastRender = now;
    
    console.log('[ANALYTICS] Rendering fast charts with', events.length, 'events and', prompts.length, 'prompts');
    
    // Verify containers exist before rendering
    const aiActivityCanvas = document.getElementById('aiActivityChart');
    const promptTokensCanvas = document.getElementById('promptTokensChart');
    if (!aiActivityCanvas && !promptTokensCanvas) {
      console.warn('[ANALYTICS] Chart containers not found, charts may not render');
      _fastChartsRendering = false;
      return;
    }
    
    // OPTIMIZATION: Debounce chart rendering to prevent multiple renders
    const debouncedRenderCharts = window.debounce ? window.debounce(async () => {
      // Render basic charts - these are fast
      if (window.renderAIActivityChart) {
        try {
          // Auto-detect and set initial time scale button
          const state = window.state || {};
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
          await window.renderAIActivityChart(null);
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
    }, 100) : (() => {
      // Fallback if debounce not available
      if (window.renderAIActivityChart) {
        try {
          window.renderAIActivityChart(null).catch(err => {
            console.error('[CHART] Error rendering AI Activity Chart:', err);
          });
        } catch (err) {
          console.error('[CHART] Error rendering AI Activity Chart:', err);
        }
      }
      if (window.renderPromptTokensChart) {
        try {
          window.renderPromptTokensChart();
        } catch (err) {
          console.error('[CHART] Error rendering Prompt Tokens Chart:', err);
        }
      }
    });
    
    // Use requestAnimationFrame for smooth rendering
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(debouncedRenderCharts);
    } else {
      debouncedRenderCharts();
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
    
    console.log('[ANALYTICS] Fast charts rendered');
    _fastChartsRendering = false;
  }
  
  // Guard to prevent excessive heavy analytics rendering
  let _heavyAnalyticsRendering = false;
  let _heavyAnalyticsLastRender = 0;
  const HEAVY_ANALYTICS_MIN_INTERVAL = 3000; // Minimum 3 seconds between heavy analytics renders
  
  // Heavy analytics that load progressively
  function renderHeavyAnalytics(events, prompts) {
    // Prevent excessive re-rendering
    const now = Date.now();
    if (_heavyAnalyticsRendering) {
      console.log('[ANALYTICS] Heavy analytics already rendering, skipping');
      return;
    }
    
    if (now - _heavyAnalyticsLastRender < HEAVY_ANALYTICS_MIN_INTERVAL) {
      console.log('[ANALYTICS] Heavy analytics render too soon, skipping');
      return;
    }
    
    // Verify view is still active
    const viewContainer = document.getElementById('viewContainer');
    if (!viewContainer) return;
    
    const analyticsView = viewContainer.querySelector('.analytics-view');
    if (!analyticsView && !viewContainer.innerHTML.includes('analytics-view')) {
      console.log('[ANALYTICS] View switched away, skipping heavy analytics');
      return;
    }
    
    // Skip if no data
    if (events.length === 0 && prompts.length === 0) {
      console.log('[ANALYTICS] Skipping heavy analytics - no data');
      return;
    }
    
    _heavyAnalyticsRendering = true;
    _heavyAnalyticsLastRender = now;
    
    console.log('[ANALYTICS] Rendering heavy analytics with', events.length, 'events and', prompts.length, 'prompts');
    
    // Defer heavy analytics more aggressively to avoid blocking
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        // Check again before rendering
        const currentView = document.getElementById('viewContainer');
        if (currentView && (currentView.querySelector('.analytics-view') || currentView.innerHTML.includes('analytics-view'))) {
          renderHeavyAnalyticsInternal(events, prompts);
        }
      }, { timeout: 3000 }); // Increased timeout for lower priority
    } else {
      setTimeout(() => {
        const currentView = document.getElementById('viewContainer');
        if (currentView && (currentView.querySelector('.analytics-view') || currentView.innerHTML.includes('analytics-view'))) {
          renderHeavyAnalyticsInternal(events, prompts);
        }
      }, 2000); // Increased delay
    }
  }
  
  // Reset render flag when view is done
  _isRendering = false;
  
  function renderHeavyAnalyticsInternal(events, prompts) {
    try {
      if (window.renderContextFileAnalytics) {
        window.renderContextFileAnalytics().catch(err => {
          if (!err.message || !err.message.includes('not found')) {
            console.warn('[INFO] Context file analytics not available:', err.message);
          }
        });
      }
      
      if (window.renderModelUsageAnalytics) {
        try {
          window.renderModelUsageAnalytics().catch(err => {
            console.error('[CHART] Error rendering Model Usage Analytics:', err);
          });
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
      
      // Advanced visualizations removed - they were not implemented and showed "Loading..." forever
      const renderAdvancedVisualizations = () => {
        // Placeholder for future advanced visualizations
        // For now, all advanced visualizations have been removed to avoid confusion
        if (false && render && typeof render === 'function') {
          // Use lazy loading if available, otherwise render immediately
          if (window.performanceOptimizer && window.performanceOptimizer.lazyLoad) {
            window.performanceOptimizer.lazyLoad(`#${id}`, (element) => {
              render().catch(err => {
                console.warn(`[ANALYTICS] Failed to render ${id}:`, err);
                const errorMsg = err?.message || err?.toString() || 'Unknown error';
                containerElement.innerHTML = `
                  <div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">
                    <div style="margin-bottom: var(--space-xs);">Unable to load visualization</div>
                    <div style="font-size: var(--text-xs);">${errorMsg}</div>
                  </div>
                `;
              });
            });
          } else {
            // Render immediately with a small delay to ensure DOM is ready
            setTimeout(() => {
              render().catch(err => {
                console.warn(`[ANALYTICS] Failed to render ${id}:`, err);
                const errorMsg = err?.message || err?.toString() || 'Unknown error';
                containerElement.innerHTML = `
                  <div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">
                    <div style="margin-bottom: var(--space-xs);">Unable to load visualization</div>
                    <div style="font-size: var(--text-xs);">${errorMsg}</div>
                  </div>
                `;
              });
            }, 100);
          }
        } else {
          console.warn(`[ANALYTICS] Render function for ${id} not available`);
          containerElement.innerHTML = `
            <div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">
              <div style="margin-bottom: var(--space-xs);">Visualization renderer not available</div>
              <div style="font-size: var(--text-xs);">The render function for this chart is not loaded</div>
            </div>
          `;
        }
      });
    };
    
      // Render immediately (removed excessive retries)
      renderAdvancedVisualizations();
    } finally {
      _heavyAnalyticsRendering = false;
    }
    
    // Also listen for data updates to re-render charts (debounced)
    if (!window._analyticsDataUpdateListener) {
      window._analyticsDataUpdateListener = window.debounce ? 
        window.debounce(() => {
          if (window.state?.currentView === 'analytics') {
            console.log('[ANALYTICS] Data updated, re-rendering charts...');
            renderAdvancedVisualizations();
          }
        }, 2000) : 
        (() => {
          let timeout;
          return () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              if (window.state?.currentView === 'analytics') {
                console.log('[ANALYTICS] Data updated, re-rendering charts...');
                renderAdvancedVisualizations();
              }
            }, 2000);
          };
        })();
      window.addEventListener('data-updated', window._analyticsDataUpdateListener);
    }
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
  
  // Guard to prevent excessive quick wins rendering
  let _quickWinsRendering = false;
  let _quickWinsLastRender = 0;
  const QUICK_WINS_MIN_INTERVAL = 1000; // Minimum 1 second between quick wins renders
  
  /**
   * Render Development Insights metrics
   */
  function renderQuickWins(events, prompts) {
    // Prevent excessive re-rendering
    const now = Date.now();
    if (_quickWinsRendering) {
      console.log('[DEVELOPMENT-INSIGHTS] Already rendering, skipping');
      return;
    }
    
    if (now - _quickWinsLastRender < QUICK_WINS_MIN_INTERVAL) {
      console.log('[DEVELOPMENT-INSIGHTS] Render too soon, skipping');
      return;
    }
    
    _quickWinsRendering = true;
    _quickWinsLastRender = now;
    
    console.log('[DEVELOPMENT-INSIGHTS] Rendering development insights with', events.length, 'events and', prompts.length, 'prompts');
    
    try {
      // 1. Prompt Success Rate
      renderPromptSuccessRate(prompts);
      
      // 2. Context Efficiency Score
      renderContextEfficiencyScore(prompts);
      
      // 3. Model Usage Distribution
      renderModelUsageDistribution(prompts);
      
      // 4. Context File Frequency (async)
      renderContextFileFrequency(prompts).catch(err => {
        console.warn('[ANALYTICS] Error rendering context file frequency:', err);
      });
      
      // 5. Thinking Time Distribution (async)
      renderThinkingTimeDistribution(prompts).catch(err => {
        console.warn('[ANALYTICS] Error rendering thinking time distribution:', err);
      });
      
      // 6. Time-of-Day Activity
      renderTimeOfDayActivity(events, prompts);
      
      // 7. Conversation Length Distribution
      renderConversationLengthDistribution(prompts);
      
      // 8. Intent Distribution
      renderIntentDistribution(events);
    } finally {
      _quickWinsRendering = false;
    }
  }

  /**
   * 1. Prompt Success Rate
   */
  function renderPromptSuccessRate(prompts) {
    const el = document.getElementById('promptSuccessRate');
    if (!el) return;
    
    if (prompts.length === 0) {
      el.textContent = 'N/A';
      return;
    }
    
    // Count prompts with code changes
    const promptsWithChanges = prompts.filter(p => {
      const linesAdded = p.lines_added || p.linesAdded || 0;
      const linesRemoved = p.lines_removed || p.linesRemoved || 0;
      return linesAdded > 0 || linesRemoved > 0;
    }).length;
    
    const successRate = ((promptsWithChanges / prompts.length) * 100).toFixed(1);
    el.textContent = `${successRate}%`;
    el.title = `${promptsWithChanges} of ${prompts.length} prompts resulted in code changes`;
  }

  /**
   * 2. Context Efficiency Score
   */
  function renderContextEfficiencyScore(prompts) {
    const el = document.getElementById('contextEfficiencyScore');
    if (!el) return;
    
    const promptsWithContext = prompts.filter(p => {
      const contextCount = p.context_file_count || p.contextFileCount || 0;
      const linesAdded = p.lines_added || p.linesAdded || 0;
      return contextCount > 0 && linesAdded > 0;
    });
    
    if (promptsWithContext.length === 0) {
      el.textContent = 'N/A';
      return;
    }
    
    const totalLines = promptsWithContext.reduce((sum, p) => sum + (p.lines_added || p.linesAdded || 0), 0);
    const totalContext = promptsWithContext.reduce((sum, p) => sum + (p.context_file_count || p.contextFileCount || 0), 0);
    
    const efficiency = totalContext > 0 ? (totalLines / totalContext).toFixed(1) : 0;
    el.textContent = efficiency;
    el.title = `Average ${efficiency} lines added per context file`;
  }

  /**
   * 3. Model Usage Distribution
   */
  function renderModelUsageDistribution(prompts) {
    const ctx = document.getElementById('modelUsagePieChart');
    if (!ctx || !window.createChart) return;
    
    if (prompts.length === 0) {
      ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">No prompt data</div>';
      return;
    }
    
    const modelCounts = {};
    prompts.forEach(p => {
      const model = p.model_name || p.modelName || p.model || 'Unknown';
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    });
    
    const labels = Object.keys(modelCounts).slice(0, 8);
    const data = labels.map(label => modelCounts[label]);
    const colors = getChartColors();
    
    window.createChart('modelUsagePieChart', {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            colors.primary, colors.secondary, colors.accent, colors.success, colors.warning,
            '#ef4444', '#06b6d4', '#a855f7'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} prompts (${((ctx.parsed / prompts.length) * 100).toFixed(1)}%)` } }
        }
      }
    });
  }

  /**
   * 4. Context File Frequency - Fetch from API for better data
   */
  async function renderContextFileFrequency(prompts) {
    const ctx = document.getElementById('contextFileChart');
    if (!ctx || !window.createChart) return;
    
    // Show loading state
    ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">Loading context file data...</div>';
    
    // Try to fetch from API first for better data (with timeout)
    try {
      const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${apiBase}/api/analytics/file-usage`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.mostUsedFiles && result.data.mostUsedFiles.length > 0) {
          const files = result.data.mostUsedFiles.slice(0, 10);
          const labels = files.map(f => {
            const fileName = f.name || f.path.split('/').pop() || f.path;
            return fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;
          });
          const data = files.map(f => f.count);
          const colors = getChartColors();
          
          window.createChart('contextFileChart', {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Usage Count',
                data: data,
                backgroundColor: colors.primary
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: { 
                  callbacks: { 
                    label: (ctx) => {
                      const file = files[ctx.dataIndex];
                      return `${file.name || file.path}: ${ctx.parsed.x} uses`;
                    }
                  } 
                }
              },
              scales: {
                x: { beginAtZero: true, ticks: { precision: 0 } },
                y: { ticks: { font: { size: 10 } } }
              }
            }
          });
          return;
        }
      }
    } catch (error) {
      console.debug('[ANALYTICS] Could not fetch context files from API, falling back to prompt data:', error);
    }
    
    // Fallback to parsing from prompts
    if (prompts.length === 0) {
      ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">No prompt data</div>';
      return;
    }
    
    const fileCounts = {};
    prompts.forEach(p => {
      try {
        // Try multiple field names for context files
        const contextFiles = p.context_files || p.contextFiles || p.context_files_json;
        let files = [];
        
        if (typeof contextFiles === 'string') {
          try {
            files = JSON.parse(contextFiles);
          } catch (e) {
            // If parsing fails, try splitting by comma
            files = contextFiles.split(',').map(f => f.trim()).filter(f => f);
          }
        } else if (Array.isArray(contextFiles)) {
          files = contextFiles;
        }
        
        files.forEach(file => {
          if (file) {
            let filePath = '';
            if (typeof file === 'string') {
              filePath = file;
            } else if (file.path) {
              filePath = file.path;
            } else if (file.name) {
              filePath = file.name;
            }
            
            if (filePath) {
              const fileName = filePath.split('/').pop() || filePath;
              fileCounts[fileName] = (fileCounts[fileName] || 0) + 1;
            }
          }
        });
      } catch (e) {
        // Skip invalid context_files
      }
    });
    
    const sorted = Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    if (sorted.length === 0) {
      ctx.parentElement.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No Context File Data</div>
          <div class="empty-state-description">Context file analytics will appear when you use @ mentions in your prompts</div>
          <div class="empty-state-hint">Try referencing files with @filename in your AI conversations</div>
        </div>
      `;
      return;
    }
    
    const labels = sorted.map(([file]) => file.length > 20 ? file.substring(0, 20) + '...' : file);
    const data = sorted.map(([, count]) => count);
    const colors = getChartColors();
    
    window.createChart('contextFileChart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Usage Count',
          data: data,
          backgroundColor: colors.primary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x} uses` } }
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  /**
   * 5. Thinking Time Distribution - Enhanced data fetching
   */
  async function renderThinkingTimeDistribution(prompts) {
    const ctx = document.getElementById('thinkingTimeHistogram');
    if (!ctx || !window.createChart) return;
    
    // Show loading state
    ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">Loading thinking time data...</div>';
    
    // Try to fetch from conversations API for better data (with timeout)
    let thinkingTimes = [];
    try {
      const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${apiBase}/api/conversations?limit=1000`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.conversations) {
          // Extract thinking time from conversation turns
          result.conversations.forEach(conv => {
            if (conv.turns && Array.isArray(conv.turns)) {
              conv.turns.forEach(turn => {
                if (turn.role === 'assistant' && turn.thinking_time_seconds) {
                  const time = parseFloat(turn.thinking_time_seconds);
                  if (time > 0 && time < 300) {
                    thinkingTimes.push(time);
                  }
                }
              });
            }
          });
        }
      }
    } catch (error) {
      console.debug('[ANALYTICS] Could not fetch thinking time from API, falling back to prompt data:', error);
    }
    
    // Fallback to prompts if API didn't provide enough data
    if (thinkingTimes.length === 0) {
      thinkingTimes = prompts
        .map(p => {
          // Try multiple field names
          return p.thinking_time_seconds || p.thinkingTimeSeconds || p.thinking_time || 
                 p.time_to_first_token_ms ? (p.time_to_first_token_ms / 1000) : null;
        })
        .filter(t => t !== null && t > 0 && t < 300); // Filter outliers
    }
    
    if (thinkingTimes.length === 0) {
      ctx.parentElement.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No Thinking Time Data</div>
          <div class="empty-state-description">Thinking time metrics will appear as AI models process your prompts</div>
          <div class="empty-state-hint">Response time data is captured automatically during AI interactions</div>
        </div>
      `;
      return;
    }
    
    // Create bins: 0-5s, 5-10s, 10-20s, 20-30s, 30-60s, 60+
    const bins = [0, 5, 10, 20, 30, 60, Infinity];
    const binLabels = ['0-5s', '5-10s', '10-20s', '20-30s', '30-60s', '60s+'];
    const binCounts = new Array(bins.length - 1).fill(0);
    
    thinkingTimes.forEach(time => {
      for (let i = 0; i < bins.length - 1; i++) {
        if (time >= bins[i] && time < bins[i + 1]) {
          binCounts[i]++;
          break;
        }
      }
    });
    
    const colors = getChartColors();
    
    window.createChart('thinkingTimeHistogram', {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Prompts',
          data: binCounts,
          backgroundColor: colors.accent
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} prompts (${((ctx.parsed.y / thinkingTimes.length) * 100).toFixed(1)}%)` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  /**
   * 6. Time-of-Day Activity
   */
  function renderTimeOfDayActivity(events, prompts) {
    const ctx = document.getElementById('timeOfDayBarChart');
    if (!ctx || !window.createChart) return;
    
    const hourCounts = new Array(24).fill(0);
    
    [...events, ...prompts].forEach(item => {
      if (item.timestamp) {
        const date = new Date(item.timestamp);
        const hour = date.getHours();
        hourCounts[hour]++;
      }
    });
    
    if (hourCounts.every(count => count === 0)) {
      ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">No activity data</div>';
      return;
    }
    
    const labels = Array.from({ length: 24 }, (_, i) => {
      const hour = i % 12 || 12;
      const period = i < 12 ? 'AM' : 'PM';
      return `${hour}${period}`;
    });
    
    const colors = getChartColors();
    
    window.createChart('timeOfDayBarChart', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Activity',
          data: hourCounts,
          backgroundColor: colors.secondary
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} activities` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { font: { size: 9 }, maxRotation: 45 } }
        }
      }
    });
  }

  /**
   * 7. Conversation Length Distribution
   */
  function renderConversationLengthDistribution(prompts) {
    const ctx = document.getElementById('conversationLengthHistogram');
    if (!ctx || !window.createChart) return;
    
    const conversationLengths = {};
    prompts.forEach(p => {
      const convId = p.conversation_id || p.conversationId;
      if (convId) {
        conversationLengths[convId] = (conversationLengths[convId] || 0) + 1;
      }
    });
    
    const lengths = Object.values(conversationLengths);
    if (lengths.length === 0) {
      ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">No conversation data</div>';
      return;
    }
    
    // Create bins: 1, 2-5, 6-10, 11-20, 21-50, 50+
    const bins = [1, 2, 6, 11, 21, 51, Infinity];
    const binLabels = ['1', '2-5', '6-10', '11-20', '21-50', '50+'];
    const binCounts = new Array(bins.length - 1).fill(0);
    
    lengths.forEach(length => {
      for (let i = 0; i < bins.length - 1; i++) {
        if (length >= bins[i] && length < bins[i + 1]) {
          binCounts[i]++;
          break;
        }
      }
    });
    
    const colors = getChartColors();
    
    window.createChart('conversationLengthHistogram', {
      type: 'bar',
      data: {
        labels: binLabels,
        datasets: [{
          label: 'Conversations',
          data: binCounts,
          backgroundColor: colors.warning
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y} conversations (${((ctx.parsed.y / lengths.length) * 100).toFixed(1)}%)` } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  /**
   * 8. Intent Distribution
   */
  function renderIntentDistribution(events) {
    const ctx = document.getElementById('intentTagCloud');
    if (!ctx || !window.createChart) return;
    
    const intentCounts = {};
    events.forEach(e => {
      const intent = e.intent || 'unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });
    
    // Also check tags
    events.forEach(e => {
      const tags = e.tags;
      if (tags) {
        // Handle both string and array tags, and other types
        let tagArray = [];
        if (typeof tags === 'string') {
          tagArray = tags.split(',').filter(t => t.trim());
        } else if (Array.isArray(tags)) {
          tagArray = tags;
        } else if (tags != null) {
          // Handle other types (numbers, objects, etc.)
          tagArray = [String(tags)];
        }
        
        tagArray.forEach(tag => {
          const trimmed = (typeof tag === 'string' ? tag : String(tag)).trim().toLowerCase();
          if (trimmed) {
            intentCounts[trimmed] = (intentCounts[trimmed] || 0) + 1;
          }
        });
      }
    });
    
    const sorted = Object.entries(intentCounts)
      .filter(([intent]) => intent !== 'unknown' && intent !== '')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    if (sorted.length === 0) {
      ctx.parentElement.innerHTML = '<div style="padding: var(--space-md); text-align: center; color: var(--color-text-muted);">No intent data</div>';
      return;
    }
    
    const labels = sorted.map(([intent]) => intent.charAt(0).toUpperCase() + intent.slice(1));
    const data = sorted.map(([, count]) => count);
    const colors = getChartColors();
    
    window.createChart('intentTagCloud', {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            colors.primary, colors.secondary, colors.accent, colors.success, colors.warning,
            '#ef4444', '#06b6d4', '#a855f7', '#f97316', '#84cc16'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} events (${((ctx.parsed / events.length) * 100).toFixed(1)}%)` } }
        }
      }
    });
  }

  // Helper function to get chart colors
  function getChartColors() {
    return (window.CONFIG && window.CONFIG.CHART_COLORS) ? {
      primary: window.CONFIG.CHART_COLORS.primary,
      secondary: window.CONFIG.CHART_COLORS.secondary,
      accent: window.CONFIG.CHART_COLORS.accent,
      success: window.CONFIG.CHART_COLORS.success,
      warning: window.CONFIG.CHART_COLORS.warning
    } : {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#10b981',
      success: '#22c55e',
      warning: '#f59e0b'
    };
  }
}

// Export to window for global access
window.renderAnalyticsView = renderAnalyticsView;

