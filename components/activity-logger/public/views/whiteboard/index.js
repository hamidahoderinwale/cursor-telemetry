/**
 * Whiteboard View - Configurable Analytics
 * Interactive query builder and visualization canvas
 */

function renderWhiteboardView(container) {
  container.innerHTML = `
    <div class="whiteboard-view">
      <!-- Header -->
      <div class="whiteboard-header">
        <div class="whiteboard-header-left">
          <h1 class="whiteboard-title">Whiteboard</h1>
          <p class="whiteboard-subtitle">Build custom analytics with queries and visualizations</p>
          <div class="whiteboard-stats">
            <div class="whiteboard-stat">
              <span class="stat-label">Code Changed:</span>
              <span class="stat-value" id="whiteboardCodeChanged">0 KB</span>
            </div>
            <div class="whiteboard-stat">
              <span class="stat-label">Avg Context Used:</span>
              <span class="stat-value" id="whiteboardAvgContext">0%</span>
            </div>
          </div>
        </div>
        <div class="whiteboard-header-actions">
          <button class="btn btn-secondary" id="whiteboardNewBtn" title="New whiteboard">
            <span>+ New</span>
          </button>
          <button class="btn btn-secondary" id="whiteboardSaveBtn" title="Save whiteboard">
            <span>Save</span>
          </button>
          <button class="btn btn-secondary" id="whiteboardLoadBtn" title="Load whiteboard">
            <span>Load</span>
          </button>
          <button class="btn btn-primary" id="whiteboardAddQueryBtn" title="Add query block">
            <span>+ Query</span>
          </button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="whiteboard-toolbar">
        <div class="toolbar-section">
          <label>Canvas Zoom:</label>
          <button class="btn-icon" id="zoomOutBtn" title="Zoom out">−</button>
          <span id="zoomLevel">100%</span>
          <button class="btn-icon" id="zoomInBtn" title="Zoom in">+</button>
          <button class="btn-icon" id="zoomFitBtn" title="Fit to screen">⌂</button>
        </div>
        <div class="toolbar-section">
          <button class="btn btn-secondary" id="toggleChartsPanelBtn" title="Toggle charts panel">
            <span id="chartsPanelToggleText">Hide Charts</span>
          </button>
        </div>
      </div>

      <!-- Main Content: Split Pane Layout -->
      <div class="whiteboard-main-layout">
        <!-- Left: Canvas Container for Queries -->
        <div class="whiteboard-canvas-wrapper">
          <div class="whiteboard-canvas-container" id="whiteboardCanvas">
            <div class="whiteboard-empty-state" id="whiteboardEmptyState">
              <div class="empty-state-content">
                <h3>Start Building</h3>
                <p>Add your first query to begin analyzing your data</p>
                <button class="btn btn-primary" id="addFirstQueryBtn">+ Add Query</button>
                <div class="empty-state-templates">
                  <p>Or start with a template:</p>
                  <div class="template-grid" id="templateGrid"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Charts Panel -->
        <div class="whiteboard-charts-panel" id="whiteboardChartsPanel">
          <div class="charts-panel-header">
            <h3 class="charts-panel-title">Visualizations</h3>
            <p class="charts-panel-subtitle">Charts created from your queries</p>
            <button class="btn-icon" id="closeChartsPanelBtn" title="Close panel">×</button>
          </div>
          <div class="charts-panel-content" id="chartsPanelContent">
            <div class="charts-empty-state">
              <p>No charts yet. Run a query and click "Add to Charts" to visualize results.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Query Block Template (hidden) -->
      <div class="query-block-template" id="queryBlockTemplate" style="display: none;">
        <div class="query-block" data-query-id="">
          <div class="query-block-header">
            <div class="query-block-title">
              <input type="text" class="query-title-input" placeholder="Query title" value="Untitled Query">
              <span class="query-status" title="Query status"></span>
            </div>
            <div class="query-block-actions">
              <button class="btn-icon expand-btn" title="Expand/Collapse" data-action="toggle-expand">⛶</button>
              <button class="btn-icon" title="Run query" data-action="run">▶</button>
              <button class="btn-icon" title="Add chart to panel" data-action="add-chart">📊</button>
              <button class="btn-icon" title="Export results" data-action="export">↓</button>
              <button class="btn-icon" title="Delete query" data-action="delete">×</button>
            </div>
          </div>
          <div class="query-block-body">
            <div class="query-input-section">
              <div class="query-input-tabs">
                <button class="query-tab active" data-mode="natural">Natural Language</button>
                <button class="query-tab" data-mode="sql">SQL</button>
                <button class="query-tab" data-mode="builder">Builder</button>
              </div>
              <div class="query-input-content">
                <textarea class="query-input natural-input" placeholder="Ask a question in natural language...&#10;&#10;Examples:&#10;• Show me files I edited most this week&#10;• What are my most active coding sessions?&#10;• Which files have the most AI interactions?"></textarea>
                <textarea class="query-input sql-input" style="display: none;" placeholder="Write SQL query...&#10;&#10;Example:&#10;SELECT file_path, COUNT(*) as edit_count&#10;FROM entries&#10;WHERE timestamp > datetime('now', '-7 days')&#10;GROUP BY file_path&#10;ORDER BY edit_count DESC&#10;LIMIT 20"></textarea>
                <div class="query-builder" style="display: none;">
                  <div class="builder-section">
                    <label>Data Source:</label>
                    <select class="builder-select" data-field="source">
                      <option value="events">Events</option>
                      <option value="prompts">Prompts</option>
                      <option value="entries">Entries</option>
                      <option value="conversations">Conversations</option>
                      <option value="terminal">Terminal Commands</option>
                    </select>
                  </div>
                  <div class="builder-section">
                    <label>Filters:</label>
                    <div class="builder-filters" id="builderFilters"></div>
                    <button class="btn-small" data-action="add-filter">+ Add Filter</button>
                  </div>
                  <div class="builder-section">
                    <label>Group By:</label>
                    <select class="builder-select" data-field="groupBy">
                      <option value="">None</option>
                    </select>
                  </div>
                  <div class="builder-section">
                    <label>Aggregation:</label>
                    <select class="builder-select" data-field="aggregation">
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                </div>
              </div>
              <div class="query-actions">
                <button class="btn btn-primary" data-action="generate-query">Generate Query</button>
                <button class="btn" data-action="execute-query">Execute</button>
              </div>
            </div>
            <div class="query-results" style="display: none;">
              <div class="results-header">
                <span class="results-count">0 rows</span>
                <div class="results-actions">
                  <button class="btn-small" data-action="show-table">Table</button>
                  <button class="btn-small" data-action="show-chart">Chart</button>
                  <button class="btn-small" data-action="export-results">Export</button>
                </div>
              </div>
              <div class="results-content">
                <div class="results-table-container"></div>
                <div class="results-chart-container"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize whiteboard
  initializeWhiteboard();
  
  // Update stats when view is rendered
  // Also listen for stats updates
  if (window.state && window.state.stats) {
    updateWhiteboardStats();
  }
  
  // Update stats periodically or when stats change
  const statsInterval = setInterval(() => {
    if (document.getElementById('whiteboardCodeChanged')) {
      updateWhiteboardStats();
    } else {
      clearInterval(statsInterval);
    }
  }, 2000);
}

function initializeWhiteboard() {
  const container = document.getElementById('whiteboardCanvas');
  const emptyState = document.getElementById('whiteboardEmptyState');
  
  if (!container) {
    console.error('Whiteboard container not found');
    return;
  }

  const whiteboard = new WhiteboardManager({
    container,
    emptyState
  });

  // Update stats display
  updateWhiteboardStats();

  // Initialize charts panel toggle
  const toggleChartsPanelBtn = document.getElementById('toggleChartsPanelBtn');
  const closeChartsPanelBtn = document.getElementById('closeChartsPanelBtn');
  const chartsPanel = document.getElementById('whiteboardChartsPanel');
  const chartsPanelToggleText = document.getElementById('chartsPanelToggleText');
  
  if (toggleChartsPanelBtn && chartsPanel) {
    toggleChartsPanelBtn.addEventListener('click', () => {
      chartsPanel.classList.toggle('hidden');
      if (chartsPanelToggleText) {
        chartsPanelToggleText.textContent = chartsPanel.classList.contains('hidden') ? 'Show Charts' : 'Hide Charts';
      }
    });
  }
  
  if (closeChartsPanelBtn && chartsPanel) {
    closeChartsPanelBtn.addEventListener('click', () => {
      chartsPanel.classList.add('hidden');
      if (chartsPanelToggleText) {
        chartsPanelToggleText.textContent = 'Show Charts';
      }
    });
  }

  // Event listeners with null checks
  const addQueryBtn = document.getElementById('whiteboardAddQueryBtn');
  if (addQueryBtn) {
    addQueryBtn.addEventListener('click', () => {
      whiteboard.addQueryBlock();
    });
  }

  const addFirstQueryBtn = document.getElementById('addFirstQueryBtn');
  if (addFirstQueryBtn) {
    addFirstQueryBtn.addEventListener('click', () => {
      whiteboard.addQueryBlock();
    });
  }

  const saveBtn = document.getElementById('whiteboardSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      whiteboard.save();
    });
  }

  const loadBtn = document.getElementById('whiteboardLoadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      whiteboard.load();
    });
  }

  const newBtn = document.getElementById('whiteboardNewBtn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      if (confirm('Create a new whiteboard? Current work will be lost.')) {
        whiteboard.clear();
      }
    });
  }

  // Zoom controls
  const zoomInBtn = document.getElementById('zoomInBtn');
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => whiteboard.zoomIn());
  }
  
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => whiteboard.zoomOut());
  }
  
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  if (zoomFitBtn) {
    zoomFitBtn.addEventListener('click', () => whiteboard.zoomFit());
  }

  // Store instance globally for access
  window.whiteboard = whiteboard;
}

/**
 * Update whiteboard stats display
 */
function updateWhiteboardStats() {
  // Get stats from window.state or calculate them
  let codeChanged = '0 KB';
  let avgContext = '0%';
  
  if (window.state && window.state.stats) {
    codeChanged = `${window.state.stats.codeChanged || 0} KB`;
    avgContext = `${window.state.stats.avgContext || 0}%`;
  } else if (window.calculateStats) {
    // Calculate stats if available
    const stats = window.calculateStats();
    if (stats) {
      codeChanged = `${stats.codeChanged || 0} KB`;
      avgContext = `${stats.avgContext || 0}%`;
    // Update window.state if it exists
      if (window.state) {
        window.state.stats = stats;
      }
    }
  }
  
  const codeChangedEl = document.getElementById('whiteboardCodeChanged');
  const avgContextEl = document.getElementById('whiteboardAvgContext');
  
  if (codeChangedEl) {
    codeChangedEl.textContent = codeChanged;
  }
  if (avgContextEl) {
    avgContextEl.textContent = avgContext;
  }
}

// Export to window for global access
window.renderWhiteboardView = renderWhiteboardView;
window.updateWhiteboardStats = updateWhiteboardStats;

