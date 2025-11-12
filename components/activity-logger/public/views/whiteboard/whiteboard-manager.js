/**
 * Whiteboard Manager - Main controller for whiteboard functionality
 */

class WhiteboardManager {
  constructor(options = {}) {
    this.container = options.container;
    this.emptyState = options.emptyState;
    this.queries = new Map();
    this.nextQueryId = 1;
    this.zoom = 1;
    this.viewMode = 'canvas'; // 'canvas' or 'list'
    
    this.queryExecutor = new QueryExecutor();
    this.visualizationEngine = new VisualizationEngine();
    this.aiQueryGenerator = new AIQueryGenerator();
  }

  addQueryBlock(title = 'Untitled Query') {
    const queryId = `query-${this.nextQueryId++}`;
    const queryBlock = this.createQueryBlock(queryId, title);
    
    this.container.appendChild(queryBlock);
    this.hideEmptyState();
    
    // Initialize query block
    this.initializeQueryBlock(queryId);
    
    return queryId;
  }

  createQueryBlock(queryId, title) {
    const template = document.getElementById('queryBlockTemplate');
    if (!template) {
      throw new Error('Query block template not found');
    }
    
    const block = template.cloneNode(true);
    block.id = queryId;
    block.classList.remove('query-block-template');
    block.style.display = 'block';
    block.dataset.queryId = queryId;
    
    // Set initial position (staggered, with better spacing)
    const count = this.queries.size;
    block.style.position = 'absolute';
    block.style.left = `${80 + (count % 3) * 560}px`;
    block.style.top = `${120 + Math.floor(count / 3) * 500}px`;
    block.style.width = '520px';
    
    // Set title
    const titleInput = block.querySelector('.query-title-input');
    if (titleInput) titleInput.value = title;
    
    // Fix nested query-block element (cloneNode copies the inner div too)
    const innerBlock = block.querySelector('.query-block');
    if (innerBlock) {
      innerBlock.dataset.queryId = queryId;
    }
    
    return block;
  }

  initializeQueryBlock(queryId) {
    const block = document.getElementById(queryId);
    if (!block) return;

    const query = {
      id: queryId,
      title: 'Untitled Query',
      mode: 'natural', // 'natural', 'sql', 'builder'
      query: '',
      sql: '',
      results: null,
      visualization: null,
      position: { x: 0, y: 0 }
    };

    this.queries.set(queryId, query);

    // Tab switching
    const tabs = block.querySelectorAll('.query-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const mode = tab.dataset.mode;
        query.mode = mode;
        
        // Show/hide inputs
        block.querySelectorAll('.query-input').forEach(input => {
          input.style.display = 'none';
        });
        block.querySelector('.query-builder').style.display = 'none';
        
        if (mode === 'natural') {
          block.querySelector('.natural-input').style.display = 'block';
        } else if (mode === 'sql') {
          block.querySelector('.sql-input').style.display = 'block';
        } else {
          block.querySelector('.query-builder').style.display = 'block';
        }
      });
    });

    // Generate query button
    const generateBtn = block.querySelector('[data-action="generate-query"]');
    if (generateBtn) {
      generateBtn.addEventListener('click', async () => {
        await this.generateQuery(queryId);
      });
    }

    // Execute query button
    const executeBtn = block.querySelector('[data-action="execute-query"]');
    if (executeBtn) {
      executeBtn.addEventListener('click', async () => {
        await this.executeQuery(queryId);
      });
    }

    // Run button
    const runBtn = block.querySelector('[data-action="run"]');
    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        await this.executeQuery(queryId);
      });
    }

    // Toggle expand/collapse
    const expandBtn = block.querySelector('[data-action="toggle-expand"]');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        block.classList.toggle('expanded');
        block.classList.toggle('collapsed');
        const isExpanded = block.classList.contains('expanded');
        expandBtn.textContent = isExpanded ? '⊟' : '⛶';
        expandBtn.title = isExpanded ? 'Collapse' : 'Expand';
      });
    }

    // Add chart to panel button
    const chartBtn = block.querySelector('[data-action="add-chart"]');
    if (chartBtn) {
      chartBtn.addEventListener('click', () => {
        this.addChartToPanel(queryId);
      });
    }

    // Delete button
    const deleteBtn = block.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this.deleteQuery(queryId);
      });
    }

    // Show table/chart
    block.querySelector('[data-action="show-table"]')?.addEventListener('click', () => {
      this.showResultsTable(queryId);
    });
    block.querySelector('[data-action="show-chart"]')?.addEventListener('click', () => {
      this.showResultsChart(queryId);
    });

    // Make draggable
    this.makeDraggable(block, query);
  }

  async generateQuery(queryId) {
    const query = this.queries.get(queryId);
    if (!query) return;

    const block = document.getElementById(queryId);
    if (!block) return;
    
    const input = block.querySelector(`.${query.mode}-input`);
    const naturalQuery = input?.value.trim();

    if (!naturalQuery && query.mode === 'natural') {
      alert('Please enter a question');
      return;
    }

    try {
      const statusEl = block.querySelector('.query-status');
      if (statusEl) {
        statusEl.textContent = 'Generating...';
        statusEl.className = 'query-status generating';
      }

      const sql = await this.aiQueryGenerator.generateSQL(naturalQuery || query.query);
      query.sql = sql;
      
      // Update SQL input if in SQL mode
      const sqlInput = block.querySelector('.sql-input');
      if (sqlInput) {
        sqlInput.value = sql;
      }

      if (statusEl) {
        statusEl.textContent = '✓';
        statusEl.className = 'query-status ready';
      }
    } catch (error) {
      console.error('Query generation error:', error);
      const statusEl = block.querySelector('.query-status');
      if (statusEl) {
        statusEl.textContent = '✗';
        statusEl.className = 'query-status error';
      }
      alert('Failed to generate query: ' + error.message);
    }
  }

  async executeQuery(queryId) {
    const query = this.queries.get(queryId);
    if (!query) return;

    const block = document.getElementById(queryId);
    const statusEl = block.querySelector('.query-status');
    
    try {
      if (statusEl) {
        statusEl.textContent = 'Running...';
        statusEl.className = 'query-status running';
      }

      // Get query text based on mode
      let sql = query.sql;
      if (query.mode === 'natural') {
        const input = block.querySelector('.natural-input');
        if (!sql && input?.value) {
          sql = await this.aiQueryGenerator.generateSQL(input.value);
          query.sql = sql;
        }
      } else if (query.mode === 'sql') {
        const input = block.querySelector('.sql-input');
        sql = input?.value || sql;
      } else {
        // Builder mode - construct SQL
        sql = this.buildSQLFromBuilder(queryId);
      }

      if (!sql) {
        throw new Error('No query to execute');
      }

      query.sql = sql;
      const results = await this.queryExecutor.execute(sql);
      query.results = results;

      // Show results
      this.displayResults(queryId, results);

      // Update all charts that use this query (reactive updates)
      this.visualizationEngine.updateChartsForQuery(queryId, results);

      if (statusEl) {
        statusEl.textContent = '✓';
        statusEl.className = 'query-status success';
      }
    } catch (error) {
      console.error('Query execution error:', error);
      if (statusEl) {
        statusEl.textContent = '✗';
        statusEl.className = 'query-status error';
      }
      this.showError(queryId, error.message);
    }
  }

  displayResults(queryId, results) {
    const block = document.getElementById(queryId);
    const resultsSection = block.querySelector('.query-results');
    const resultsContent = block.querySelector('.results-content');
    
    if (!resultsSection || !resultsContent) return;

    resultsSection.style.display = 'block';
    
    // Update count
    const countEl = block.querySelector('.results-count');
    if (countEl) {
      countEl.textContent = `${results.rows?.length || 0} rows`;
    }

    // Show table by default
    this.showResultsTable(queryId);
  }

  showResultsTable(queryId) {
    const query = this.queries.get(queryId);
    if (!query?.results) return;

    const block = document.getElementById(queryId);
    if (!block) return;
    
    const tableContainer = block.querySelector('.results-table-container');
    const chartContainer = block.querySelector('.results-chart-container');
    
    if (tableContainer) {
      tableContainer.style.display = 'block';
      tableContainer.innerHTML = this.renderTable(query.results);
    }
    if (chartContainer) {
      chartContainer.style.display = 'none';
    }
  }

  showResultsChart(queryId) {
    const query = this.queries.get(queryId);
    if (!query?.results) return;

    const block = document.getElementById(queryId);
    if (!block) return;
    
    const tableContainer = block.querySelector('.results-table-container');
    const chartContainer = block.querySelector('.results-chart-container');
    
    if (tableContainer) {
      tableContainer.style.display = 'none';
    }
    if (chartContainer) {
      chartContainer.style.display = 'block';
      this.visualizeQuery(queryId);
    }
  }

  addChartToPanel(queryId) {
    const query = this.queries.get(queryId);
    if (!query || !query.results) {
      alert('Please run the query first to create a chart');
      return;
    }

    const chartsPanel = document.getElementById('whiteboardChartsPanel');
    const chartsContent = document.getElementById('chartsPanelContent');
    if (!chartsPanel || !chartsContent) {
      console.error('Charts panel not found');
      return;
    }

    // Show panel if hidden
    chartsPanel.classList.remove('hidden');
    const toggleText = document.getElementById('chartsPanelToggleText');
    if (toggleText) toggleText.textContent = 'Hide Charts';

    // Hide empty state
    const emptyState = chartsContent.querySelector('.charts-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    const chartId = `chart-${Date.now()}`;
    const chartCard = this.createChartCard(chartId, queryId, query);
    chartsContent.appendChild(chartCard);

    // Render chart
    this.renderChartInPanel(chartId, query.results, query.title || 'Untitled Query');
  }

  createChartCard(chartId, queryId, query) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.id = chartId;
    card.dataset.queryId = queryId;
    
    card.innerHTML = `
      <div class="chart-card-header">
        <div class="chart-card-title">
          <h4>${this.escapeHtml(query.title || 'Untitled Query')}</h4>
          <span class="chart-card-query-badge">Query ${queryId.replace('query-', '')}</span>
        </div>
        <div class="chart-card-actions">
          <select class="chart-type-select" data-chart-id="${chartId}">
            <option value="auto">Auto</option>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="scatter">Scatter</option>
            <option value="area">Area</option>
            <option value="heatmap">Heatmap</option>
            <option value="network">Network</option>
            <option value="parallel">Parallel Coordinates</option>
            <option value="sankey">Sankey</option>
          </select>
          <button class="btn-icon" data-action="refresh-chart" data-chart-id="${chartId}" title="Refresh">↻</button>
          <button class="btn-icon" data-action="remove-chart" data-chart-id="${chartId}" title="Remove">×</button>
        </div>
      </div>
      <div class="chart-card-body">
        <div class="chart-container" id="chart-${chartId}"></div>
      </div>
    `;

    // Add event listeners
    const refreshBtn = card.querySelector('[data-action="refresh-chart"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const query = this.queries.get(queryId);
        if (query?.results) {
          const typeSelect = card.querySelector('.chart-type-select');
          const chartType = typeSelect?.value || 'auto';
          this.renderChartInPanel(chartId, query.results, query.title || 'Untitled Query', chartType);
        }
      });
    }

    const removeBtn = card.querySelector('[data-action="remove-chart"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        // Unregister chart from visualization engine
        this.visualizationEngine.unregisterChart(chartId);
        card.remove();
        // Show empty state if no charts left
        const chartsContent = document.getElementById('chartsPanelContent');
        if (chartsContent) {
          const remainingCharts = chartsContent.querySelectorAll('.chart-card').length;
          const emptyState = chartsContent.querySelector('.charts-empty-state');
          if (emptyState) {
            emptyState.style.display = remainingCharts === 0 ? 'block' : 'none';
          }
        }
      });
    }

    const typeSelect = card.querySelector('.chart-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        const query = this.queries.get(queryId);
        if (query?.results) {
          this.renderChartInPanel(chartId, query.results, query.title || 'Untitled Query', typeSelect.value);
        }
      });
    }

    return card;
  }

  async renderChartInPanel(chartId, results, title, chartType = 'auto') {
    const container = document.getElementById(`chart-${chartId}`);
    if (!container) return;

    container.innerHTML = '<div class="chart-loading">Generating chart...</div>';

    try {
      const vizType = chartType === 'auto' ? this.visualizationEngine.detectVisualizationType(results) : chartType;
      // Get queryId from card data attribute for reactive updates
      const card = document.getElementById(chartId);
      const queryId = card?.dataset.queryId || null;
      // Pass chartId and queryId for reactive updates and linked brushing
      const chart = await this.visualizationEngine.createChart(results, vizType, chartId, queryId);
      
      if (chart) {
        container.innerHTML = '';
        container.appendChild(chart);
      } else {
        container.innerHTML = '<div class="chart-error">Failed to create chart</div>';
      }
    } catch (error) {
      console.error('Chart rendering error:', error);
      container.innerHTML = `<div class="chart-error">Error: ${this.escapeHtml(error.message)}</div>`;
    }
  }

  initializeChartWidget(chartId, queryId) {
    const widget = document.querySelector(`[data-chart-id="${chartId}"]`);
    if (!widget) return;

    // Toggle expand/collapse
    const expandBtn = widget.querySelector('[data-action="toggle-expand"]');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        widget.classList.toggle('expanded');
        widget.classList.toggle('collapsed');
        const isExpanded = widget.classList.contains('expanded');
        expandBtn.textContent = isExpanded ? '⊟' : '⛶';
        expandBtn.title = isExpanded ? 'Collapse' : 'Expand';
      });
    }

    // Refresh button
    const refreshBtn = widget.querySelector('[data-action="refresh"]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const query = this.queries.get(queryId);
        if (query?.results) {
          this.renderChart(chartId, query.results);
        }
      });
    }

    // Delete button
    const deleteBtn = widget.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        widget.remove();
      });
    }

    // Chart type selector
    const typeSelect = widget.querySelector('.chart-type-select');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        const query = this.queries.get(queryId);
        if (query?.results) {
          this.renderChart(chartId, query.results, typeSelect.value);
        }
      });
    }

    // Make draggable
    const header = widget.querySelector('.chart-widget-header');
    if (header) {
      this.makeDraggable(widget, { id: chartId, position: { x: 0, y: 0 } });
    }
  }

  renderChart(chartId, results, chartType = 'bar') {
    const widget = document.querySelector(`[data-chart-id="${chartId}"]`);
    if (!widget) return;

    const container = widget.querySelector('.chart-container');
    if (!container) return;

    // Use visualization engine if available
    if (this.visualizationEngine) {
      this.visualizationEngine.renderChart(container, results, chartType);
    } else {
      // Fallback: simple message
      container.innerHTML = `<div class="chart-loading">Chart visualization will be rendered here (${chartType})</div>`;
    }
  }

  async visualizeQuery(queryId) {
    const query = this.queries.get(queryId);
    if (!query?.results) {
      alert('Please execute the query first');
      return;
    }

    const block = document.getElementById(queryId);
    if (!block) return;
    
    const chartContainer = block.querySelector('.results-chart-container');
    if (!chartContainer) return;

    chartContainer.style.display = 'block';
    chartContainer.innerHTML = '<div class="chart-loading">Generating chart...</div>';

    try {
      // Auto-detect best visualization type
      const vizType = this.visualizationEngine.detectVisualizationType(query.results);
      // Pass queryId for reactive updates
      const chart = await this.visualizationEngine.createChart(query.results, vizType, null, queryId);
      
      if (chart) {
        chartContainer.innerHTML = '';
        chartContainer.appendChild(chart);
        query.visualization = { type: vizType, element: chart };
      } else {
        chartContainer.innerHTML = '<div class="chart-error">Failed to create chart</div>';
      }
    } catch (error) {
      console.error('Visualization error:', error);
      chartContainer.innerHTML = `<div class="chart-error">Error: ${this.escapeHtml(error.message)}</div>`;
    }
  }

  renderTable(results) {
    if (!results.rows || results.rows.length === 0) {
      return '<div class="empty-results">No results</div>';
    }

    const columns = results.columns || Object.keys(results.rows[0] || {});
    
    let html = '<table class="results-table"><thead><tr>';
    columns.forEach(col => {
      html += `<th>${this.escapeHtml(col)}</th>`;
    });
    html += '</tr></thead><tbody>';

    results.rows.forEach(row => {
      html += '<tr>';
      columns.forEach(col => {
        const value = row[col];
        html += `<td>${this.escapeHtml(value != null ? String(value) : '')}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
  }

  buildSQLFromBuilder(queryId) {
    const block = document.getElementById(queryId);
    if (!block) {
      throw new Error('Query block not found');
    }
    
    const source = block.querySelector('[data-field="source"]')?.value || 'events';
    const groupBy = block.querySelector('[data-field="groupBy"]')?.value;
    const aggregation = block.querySelector('[data-field="aggregation"]')?.value || 'count';
    
    // Basic SQL construction
    let sql = `SELECT `;
    if (groupBy) {
      sql += `${groupBy}, `;
    }
    sql += `${aggregation}(*) as count `;
    sql += `FROM ${source} `;
    if (groupBy) {
      sql += `GROUP BY ${groupBy} `;
    }
    sql += `LIMIT 100`;
    
    return sql;
  }

  makeDraggable(element, query) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    const header = element.querySelector('.query-block-header');
    if (!header) return;

    header.style.cursor = 'move';

    header.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      
      element.style.zIndex = '1000';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      element.style.left = `${initialX + dx}px`;
      element.style.top = `${initialY + dy}px`;
      
      query.position.x = initialX + dx;
      query.position.y = initialY + dy;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.zIndex = '';
      }
    });
  }

  deleteQuery(queryId) {
    if (!confirm('Delete this query?')) return;
    
    const block = document.getElementById(queryId);
    if (block) {
      block.remove();
    }
    
    this.queries.delete(queryId);
    
    if (this.queries.size === 0) {
      this.showEmptyState();
    }
  }

  showError(queryId, message) {
    const block = document.getElementById(queryId);
    if (!block) return;
    
    const resultsSection = block.querySelector('.query-results');
    if (resultsSection) {
      resultsSection.style.display = 'block';
      const resultsContent = resultsSection.querySelector('.results-content');
      if (resultsContent) {
        resultsContent.innerHTML = `<div class="error-message">${this.escapeHtml(message)}</div>`;
      }
    }
  }

  showEmptyState() {
    if (this.emptyState) {
      this.emptyState.style.display = 'flex';
    }
  }

  hideEmptyState() {
    if (this.emptyState) {
      this.emptyState.style.display = 'none';
    }
  }

  zoomIn() {
    this.zoom = Math.min(this.zoom * 1.2, 3);
    this.updateZoom();
  }

  zoomOut() {
    this.zoom = Math.max(this.zoom / 1.2, 0.5);
    this.updateZoom();
  }

  zoomFit() {
    this.zoom = 1;
    this.updateZoom();
  }

  updateZoom() {
    if (this.container) {
      this.container.style.transform = `scale(${this.zoom})`;
      this.container.style.transformOrigin = 'top left';
    }
    
    const zoomLevel = document.getElementById('zoomLevel');
    if (zoomLevel) {
      zoomLevel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  async save() {
    const whiteboard = {
      version: '1.0',
      queries: Array.from(this.queries.values()).map(q => ({
        id: q.id,
        title: q.title,
        mode: q.mode,
        query: q.query || '',
        sql: q.sql || '',
        position: q.position || { x: 0, y: 0 }
        // Note: results and visualization are not saved (re-execute on load)
      })),
      zoom: this.zoom,
      viewMode: this.viewMode,
      savedAt: new Date().toISOString()
    };

    const name = prompt('Whiteboard name:', 'My Whiteboard');
    if (!name) return;

    try {
      const apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
      const response = await fetch(`${apiBase}/api/whiteboard/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, whiteboard })
      });

      if (response.ok) {
        alert('Whiteboard saved!');
      } else {
        const error = await response.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(error.error || 'Save failed');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(`Failed to save whiteboard: ${error.message}`);
    }
  }

  async load() {
    try {
      const apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
      const response = await fetch(`${apiBase}/api/whiteboard/list`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch whiteboard list');
      }
      
      const data = await response.json();
      
      if (!data.whiteboards || data.whiteboards.length === 0) {
        alert('No saved whiteboards');
        return;
      }

      const names = data.whiteboards.map(w => w.name);
      const selected = prompt(`Load whiteboard:\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEnter number:`);
      const index = parseInt(selected) - 1;

      if (isNaN(index) || index < 0 || index >= names.length) return;

      const whiteboard = data.whiteboards[index];
      const loadResponse = await fetch(`${apiBase}/api/whiteboard/load?id=${whiteboard.id}`);
      
      if (!loadResponse.ok) {
        throw new Error('Failed to load whiteboard');
      }
      
      const loadData = await loadResponse.json();

      if (!loadData.whiteboard) {
        throw new Error('Invalid whiteboard data');
      }

      this.clear();
      this.loadWhiteboard(loadData.whiteboard);
    } catch (error) {
      console.error('Load error:', error);
      alert(`Failed to load whiteboard: ${error.message}`);
    }
  }

  loadWhiteboard(whiteboard) {
    this.zoom = whiteboard.zoom || 1;
    this.viewMode = whiteboard.viewMode || 'canvas';
    
    if (!whiteboard.queries || !Array.isArray(whiteboard.queries)) {
      console.warn('No queries found in whiteboard data');
      return;
    }
    
    whiteboard.queries.forEach(queryData => {
      try {
        const title = queryData.title || 'Untitled Query';
        const queryId = this.addQueryBlock(title);
        const query = this.queries.get(queryId);
        
        if (query && queryData) {
          // Merge query data (preserve new id)
          query.title = queryData.title || title;
          query.mode = queryData.mode || 'natural';
          query.query = queryData.query || '';
          query.sql = queryData.sql || '';
          query.position = queryData.position || { x: 0, y: 0 };
        }
        
        // Restore query text
        const block = document.getElementById(queryId);
        if (block) {
          // Switch to correct mode tab
          const tabs = block.querySelectorAll('.query-tab');
          tabs.forEach(tab => {
            if (tab.dataset.mode === query.mode) {
              tab.classList.add('active');
            } else {
              tab.classList.remove('active');
            }
          });
          
          // Show/hide inputs based on mode
          block.querySelectorAll('.query-input, .query-builder').forEach(el => {
            el.style.display = 'none';
          });
          
          if (query.mode === 'natural') {
            const naturalInput = block.querySelector('.natural-input');
            if (naturalInput) {
              naturalInput.style.display = 'block';
              naturalInput.value = query.query || '';
            }
          } else if (query.mode === 'sql') {
            const sqlInput = block.querySelector('.sql-input');
            if (sqlInput) {
              sqlInput.style.display = 'block';
              sqlInput.value = query.sql || '';
            }
          } else {
            const builder = block.querySelector('.query-builder');
            if (builder) {
              builder.style.display = 'block';
            }
          }
          
          // Restore position
          if (query.position) {
            block.style.left = `${query.position.x}px`;
            block.style.top = `${query.position.y}px`;
          }
        }
      } catch (error) {
        console.error('Error loading query:', error);
      }
    });
    
    this.updateZoom();
  }

  clear() {
    this.queries.forEach((query, id) => {
      const block = document.getElementById(id);
      if (block) block.remove();
    });
    this.queries.clear();
    this.showEmptyState();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

