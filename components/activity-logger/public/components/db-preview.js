/**
 * Database Preview Component
 * Shows a preview of database tables and records, similar to Hugging Face's data viewer
 */

class DatabasePreview {
  constructor() {
    this.selectedTable = null;
    this.selectedRecord = null;
    this.currentPage = 1;
    this.pageSize = 20;
    this.apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
  }

  /**
   * Render the database preview panel
   */
  render(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="db-preview-panel">
        <div class="db-preview-header">
          <h3 class="db-preview-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 8px; vertical-align: middle;">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
            </svg>
            Database Preview
          </h3>
          <div class="db-preview-controls">
            <button class="btn-icon" onclick="dbPreview.refresh()" title="Refresh data">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="db-preview-content">
          <!-- Table Selector -->
          <div class="db-table-selector">
            <label class="db-selector-label">Table</label>
            <select id="dbTableSelect" class="db-select" onchange="dbPreview.selectTable(this.value)">
              <option value="">Select a table...</option>
              <option value="entries">Entries (File Changes)</option>
              <option value="prompts">Prompts (AI Interactions)</option>
              <option value="events">Events (Activity Timeline)</option>
              <option value="terminal_commands">Terminal Commands</option>
              <option value="context_snapshots">Context Snapshots</option>
            </select>
          </div>

          <!-- Data Preview -->
          <div id="dbDataPreview" class="db-data-preview">
            <div class="db-empty-state">
              <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style="opacity: 0.3; margin-bottom: var(--space-md);">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
              </svg>
              <p style="color: var(--color-text-muted); font-size: var(--text-sm);">Select a table to preview data</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Select a table and load its data
   */
  async selectTable(tableName) {
    this.selectedTable = tableName;
    const preview = document.getElementById('dbDataPreview');
    if (!preview) return;

    if (!tableName) {
      preview.innerHTML = `
        <div class="db-empty-state">
          <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style="opacity: 0.3; margin-bottom: var(--space-md);">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
          </svg>
          <p style="color: var(--color-text-muted); font-size: var(--text-sm);">Select a table to preview data</p>
        </div>
      `;
      return;
    }

    preview.innerHTML = `
      <div class="db-loading">
        <div class="db-loading-spinner"></div>
        <p style="color: var(--color-text-muted); font-size: var(--text-sm); margin-top: var(--space-sm);">Loading ${tableName}...</p>
      </div>
    `;

    try {
      // Load data from state or API
      const data = await this.loadTableData(tableName);
      this.renderTableData(preview, tableName, data);
    } catch (error) {
      console.error('[DB-PREVIEW] Error loading table:', error);
      preview.innerHTML = `
        <div class="db-error">
          <p style="color: var(--color-error); font-size: var(--text-sm);">Error loading ${tableName}: ${error.message}</p>
        </div>
      `;
    }
  }

  /**
   * Load table data from state or API
   */
  async loadTableData(tableName) {
    // Try to get from state first (faster)
    const state = window.state?.data || {};
    
    let data = [];
    switch (tableName) {
      case 'entries':
        data = state.entries || [];
        break;
      case 'prompts':
        data = state.prompts || [];
        break;
      case 'events':
        data = state.events || [];
        break;
      case 'terminal_commands':
        data = state.terminal_commands || [];
        break;
      case 'context_snapshots':
        data = state.context_snapshots || [];
        break;
      default:
        return [];
    }
    
    // If no data in state, try API
    if (data.length === 0 && this.apiBase) {
      try {
        const endpoint = tableName === 'terminal_commands' ? '/api/terminal/history' :
                        tableName === 'prompts' ? '/api/prompts' :
                        tableName === 'events' ? '/api/events' :
                        `/api/${tableName}`;
        
        const response = await fetch(`${this.apiBase}${endpoint}?limit=100`);
        if (response.ok) {
          const result = await response.json();
          data = Array.isArray(result) ? result : (result.data || result[tableName] || []);
        }
      } catch (error) {
        console.warn('[DB-PREVIEW] API fetch failed:', error);
      }
    }
    
    return data;
  }

  /**
   * Render table data in a preview format
   */
  renderTableData(container, tableName, data) {
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No Data Available</div>
          <div class="empty-state-description">The ${tableName} table is currently empty</div>
          <div class="empty-state-hint">Data will appear here as you use Cursor features</div>
        </div>
      `;
      return;
    }

    // Ensure data is an array
    if (!Array.isArray(data)) {
      data = Object.values(data);
    }

    // Get first record to determine columns
    const firstRecord = data[0];
    if (!firstRecord || typeof firstRecord !== 'object') {
      container.innerHTML = `
        <div class="db-empty-state">
          <p style="color: var(--color-text-muted); font-size: var(--text-sm);">Invalid data format</p>
        </div>
      `;
      return;
    }

    const columns = Object.keys(firstRecord).slice(0, 10); // Limit to 10 columns for preview
    const displayData = data.slice(0, this.pageSize);

    // Build table HTML
    let html = `
      <div class="db-table-info">
        <span class="db-table-count">${data.length.toLocaleString()} records</span>
        <span class="db-table-showing">Showing ${displayData.length}</span>
      </div>
      <div class="db-table-wrapper">
        <table class="db-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${this.formatColumnName(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${displayData.map((record, idx) => `
              <tr class="db-table-row" onclick="dbPreview.selectRecord(${idx})" data-record-idx="${idx}">
                ${columns.map(col => {
                  const value = record[col];
                  return `<td>${this.formatCellValue(value)}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Add record detail view if a record is selected
    if (this.selectedRecord !== null && displayData[this.selectedRecord]) {
      html += this.renderRecordDetail(displayData[this.selectedRecord]);
    }

    container.innerHTML = html;
  }

  /**
   * Format column name for display
   */
  formatColumnName(name) {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format cell value for display
   */
  formatCellValue(value) {
    if (value === null || value === undefined) {
      return '<span style="color: var(--color-text-muted); font-style: italic;">null</span>';
    }
    
    // Escape HTML to prevent injection and ensure proper text containment
    const escapeHtml = (str) => {
      if (typeof str !== 'string') str = String(str);
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    };
    
    if (typeof value === 'object') {
      return '<span style="color: var(--color-text-muted);">[Object]</span>';
    }
    
    const strValue = String(value);
    if (strValue.length > 50) {
      return escapeHtml(strValue.substring(0, 50)) + '...';
    }
    
    return escapeHtml(strValue);
  }

  /**
   * Select a record to view details
   */
  selectRecord(idx) {
    this.selectedRecord = idx;
    const container = document.getElementById('dbDataPreview');
    if (!container) return;

    // Re-render with selected record
    const tableName = this.selectedTable;
    if (tableName) {
      this.loadTableData(tableName).then(data => {
        this.renderTableData(container, tableName, data);
      });
    }
  }

  /**
   * Render detailed view of a selected record
   */
  renderRecordDetail(record) {
    return `
      <div class="db-record-detail">
        <div class="db-record-header">
          <h4>Record Details</h4>
          <button class="btn-icon" onclick="dbPreview.selectRecord(null)" title="Close">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
        <div class="db-record-content">
          <pre class="db-record-json">${JSON.stringify(record, null, 2)}</pre>
        </div>
      </div>
    `;
  }

  /**
   * Refresh the current table data
   */
  async refresh() {
    if (this.selectedTable) {
      await this.selectTable(this.selectedTable);
    }
  }
}

// Create global instance
window.dbPreview = new DatabasePreview();

