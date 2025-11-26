/**
 * Schema Config View Helper Functions
 * HTML template functions for Schema Config view components
 */

/**
 * Render the table list sidebar
 */
function renderTableList(schema, selectedTable) {
  if (!schema || !schema.tables) {
    return '<p>Loading tables...</p>';
  }

  return schema.tables.map(table => `
    <div class="table-item ${selectedTable === table.name ? 'active' : ''}" 
         data-table="${table.name}">
      <span class="table-name">${table.name}</span>
      <span class="table-column-count">${table.columns.length} columns</span>
    </div>
  `).join('');
}

/**
 * Render welcome/overview message
 */
function renderWelcome(schema, customFields, connectionError, apiBase) {
  // Show connection error if present
  if (connectionError) {
    const errorMessage = connectionError.message || 'Unknown error';
    const isNetworkError = errorMessage.includes('Failed to fetch') || 
                          errorMessage.includes('NetworkError') ||
                          errorMessage.includes('timeout') ||
                          connectionError.name === 'AbortError' ||
                          connectionError.name === 'TypeError';
    
    const isLocalhost = apiBase.includes('localhost') || apiBase.includes('127.0.0.1');
    const showSwitchToLocalhost = !isLocalhost && isNetworkError;
    
    return `
      <div class="welcome-message" style="max-width: 600px; margin: 0 auto; padding: var(--space-xl);">
        <div style="text-align: center; margin-bottom: var(--space-lg);">
          <div style="font-size: 48px; margin-bottom: var(--space-md); opacity: 0.5;">[Warning]</div>
          <h3 style="color: var(--color-error); margin-bottom: var(--space-sm);">Cannot connect to companion service</h3>
          <p style="color: var(--color-text-muted); margin-bottom: var(--space-md);">
            ${isNetworkError 
              ? `Cannot connect to companion service at <code style="background: var(--color-bg-alt); padding: 2px 6px; border-radius: 4px;">${apiBase}</code>. Please ensure the service is running.`
              : `Error: ${errorMessage}`
            }
          </p>
          ${showSwitchToLocalhost ? `
            <p style="color: var(--color-text-muted); margin-bottom: var(--space-md); font-size: var(--text-sm);">
              If you're running the companion service locally, try switching to localhost.
            </p>
          ` : ''}
        </div>
        
        <div style="background: var(--color-bg-alt); border-radius: var(--radius-md); padding: var(--space-md); margin-bottom: var(--space-md);">
          <h4 style="margin: 0 0 var(--space-sm) 0; font-size: var(--text-md);">How to start the companion service:</h4>
          <ol style="margin: 0; padding-left: 20px; color: var(--color-text-muted); font-size: var(--text-sm); line-height: 1.8;">
            <li>Navigate to the companion directory:
              <code style="display: block; margin-top: var(--space-xs); background: var(--color-bg); padding: var(--space-xs); border-radius: var(--radius-sm); font-size: 11px;">
                cd cursor-telemetry/components/activity-logger/companion
              </code>
            </li>
            <li>Install dependencies (if not already done):
              <code style="display: block; margin-top: var(--space-xs); background: var(--color-bg); padding: var(--space-xs); border-radius: var(--radius-sm); font-size: 11px;">
                npm install
              </code>
            </li>
            <li>Start the service:
              <code style="display: block; margin-top: var(--space-xs); background: var(--color-bg); padding: var(--space-xs); border-radius: var(--radius-sm); font-size: 11px;">
                npm start
              </code>
              or
              <code style="display: block; margin-top: var(--space-xs); background: var(--color-bg); padding: var(--space-xs); border-radius: var(--radius-sm); font-size: 11px;">
                node src/index.js
              </code>
            </li>
            <li>Wait for the service to start (you should see "Server listening on port 43917")</li>
            <li>Refresh this page or click the retry button below</li>
          </ol>
        </div>
        
        <div style="display: flex; gap: var(--space-sm); justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="schemaConfigView.testConnection()" style="min-width: 120px;">
            Test Connection
          </button>
          <button class="btn btn-secondary" onclick="schemaConfigView.init()" style="min-width: 120px;">
            Retry
          </button>
          ${showSwitchToLocalhost ? `
            <button class="btn btn-secondary" onclick="schemaConfigView.switchToLocalhost()" style="min-width: 140px;">
              Switch to Localhost
            </button>
          ` : ''}
        </div>
        
        <div style="margin-top: var(--space-md); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--color-text-muted); text-align: center;">
          <strong>Note:</strong> The companion service must be running for schema configuration to work. 
          The service provides API access to the database schema and field configurations.
        </div>
      </div>
    `;
  }
  
  if (!schema || !schema.tables || schema.tables.length === 0) {
    return `
      <div class="welcome-message">
        <h3>Loading schema...</h3>
        <p>Fetching database schema information.</p>
      </div>
    `;
  }

  // Count enabled/disabled fields per table
  const tableStats = schema.tables.map(table => {
    const tableFields = customFields.filter(f => f.tableName === table.name);
    return {
      ...table,
      enabled: tableFields.filter(f => f.enabled).length,
      disabled: tableFields.filter(f => !f.enabled).length,
      configured: tableFields.length
    };
  });

  return `
    <div class="schema-overview">
      <div class="overview-header">
        <h3>Database Schema Overview</h3>
        <p class="overview-description">
          Select a table from the sidebar to configure which fields are included in exports. 
          Fields that are <strong>enabled</strong> will be exported; <strong>disabled</strong> fields will be excluded.
          Fields without explicit configuration are exported by default.
        </p>
      </div>

      <div class="tables-overview">
        ${tableStats.map(table => {
          const configStatus = table.configured > 0 
            ? `<span class="config-badge">${table.enabled} enabled, ${table.disabled} disabled</span>`
            : '<span class="config-badge badge-default">All fields exported by default</span>';
          
          return `
          <div class="table-overview-card" data-table="${table.name}">
            <div class="table-overview-header">
              <div>
                <h4 class="table-overview-name">${table.name}</h4>
                ${configStatus}
              </div>
              <span class="table-overview-count">${table.columns.length} columns</span>
            </div>
            <div class="table-overview-columns">
              ${table.columns.slice(0, 6).map(col => {
                const fieldConfig = customFields.find(f => f.tableName === table.name && f.fieldName === col.name);
                const statusClass = fieldConfig 
                  ? (fieldConfig.enabled ? 'field-enabled' : 'field-disabled')
                  : 'field-default';
                return `
                <div class="column-preview ${statusClass}">
                  <span class="column-preview-name">${col.name}</span>
                  <span class="column-preview-type">${col.type}</span>
                  ${col.primaryKey ? '<span class="badge badge-primary badge-small">PK</span>' : ''}
                  ${fieldConfig ? (fieldConfig.enabled ? '<span class="badge badge-success badge-small"></span>' : '<span class="badge badge-muted badge-small"></span>') : ''}
                </div>
              `;
              }).join('')}
              ${table.columns.length > 6 ? `
                <div class="column-preview-more">
                  +${table.columns.length - 6} more columns
                </div>
              ` : ''}
            </div>
          </div>
        `;
        }).join('')}
      </div>

      <div class="overview-actions">
        <div class="info-box">
          <strong>How it works:</strong>
          <ul>
            <li>Fields without configuration are <strong>exported by default</strong></li>
            <li>Add a field configuration to explicitly control its export status</li>
            <li>Toggle fields on/off to include or exclude them from exports</li>
            <li>This only affects exports, not the database schema itself</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render table details view
 */
function renderTableDetails(selectedTable, schema, customFields) {
  if (!selectedTable || !schema) {
    return renderWelcome(schema, customFields, null, '');
  }

  const table = schema.tables.find(t => t.name === selectedTable);
  if (!table) {
    return '<p>Table not found</p>';
  }

  const tableCustomFields = customFields.filter(f => f.tableName === selectedTable);

  return `
    <div class="table-details">
      <div class="table-header">
        <div>
          <h3>${selectedTable}</h3>
          <p class="table-subtitle">Current schema structure and configuration options</p>
        </div>
        <div class="table-header-actions">
          <button class="btn btn-secondary" onclick="schemaConfigView.selectedTable = null; schemaConfigView.render();" title="Back to schema overview">
            Back to Overview
          </button>
          <button class="btn btn-primary" onclick="schemaConfigView.showAddColumnModal()" title="Add a new column to this table">
            Add Column
          </button>
        </div>
      </div>

      <div class="table-sections">
        <div class="section">
          <div class="section-header">
            <h4>Current Columns</h4>
            <span class="section-count">${table.columns.length} columns</span>
          </div>
            <p class="section-description">These are the columns currently defined in the database schema.</p>
            <div class="columns-list">
              ${renderColumns(table.columns)}
            </div>
        </div>

        <div class="section">
          <div class="section-header">
            <h4>Export Field Configuration</h4>
            <span class="section-count">
              ${tableCustomFields.filter(f => f.enabled).length} enabled, 
              ${tableCustomFields.filter(f => !f.enabled).length} disabled
            </span>
          </div>
          <p class="section-description">
            <strong>Controls which fields are included in database exports.</strong> 
            Toggle fields on/off to include or exclude them from exported JSON files. 
            This helps reduce file size and protect sensitive data.
          </p>
          <div class="custom-fields-list">
            ${renderCustomFields(tableCustomFields)}
          </div>
          <button class="btn btn-secondary" onclick="schemaConfigView.showAddCustomFieldModal()">
            Configure Field for Export
          </button>
          <div style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
            <strong>Tip:</strong> Fields not listed here are exported by default. Add configurations to exclude specific fields from exports.
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render columns list
 */
function renderColumns(columns) {
  return columns.map(col => `
    <div class="column-item">
      <div class="column-header">
        <span class="column-name">${col.name}</span>
        ${col.primaryKey ? '<span class="badge badge-primary">PRIMARY KEY</span>' : ''}
        ${col.notnull ? '<span class="badge badge-info">NOT NULL</span>' : ''}
      </div>
      <div class="column-details">
        <span class="column-type">Type: ${col.type}</span>
        ${col.defaultValue ? `<span class="column-default">Default: ${col.defaultValue}</span>` : ''}
      </div>
    </div>
  `).join('');
}

/**
 * Render custom fields table
 */
function renderCustomFields(fields) {
  if (fields.length === 0) {
    return '<p class="empty-state">No field configurations. All fields will be exported by default.</p>';
  }

  // Render as a table for better readability
  const escapeHtml = window.escapeHtml || ((text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  });

  return `
    <div class="custom-fields-table-wrapper" style="overflow-x: auto;">
      <table class="custom-fields-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
            <th style="padding: var(--space-sm); text-align: left; font-weight: 600; font-size: var(--text-sm); color: var(--color-text);">Field Name</th>
            <th style="padding: var(--space-sm); text-align: left; font-weight: 600; font-size: var(--text-sm); color: var(--color-text);">Display Name</th>
            <th style="padding: var(--space-sm); text-align: left; font-weight: 600; font-size: var(--text-sm); color: var(--color-text);">Field Type</th>
            <th style="padding: var(--space-sm); text-align: left; font-weight: 600; font-size: var(--text-sm); color: var(--color-text);">Description</th>
            <th style="padding: var(--space-sm); text-align: center; font-weight: 600; font-size: var(--text-sm); color: var(--color-text);">Enabled</th>
            <th style="padding: var(--space-sm); text-align: center; font-weight: 600; font-size: var(--text-sm); color: var(--color-text);">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map(field => `
            <tr class="custom-field-row" style="border-bottom: 1px solid var(--color-border); transition: background-color 0.2s ease;" 
                onmouseover="this.style.background='var(--color-bg-alt)'" 
                onmouseout="this.style.background='var(--color-bg)'">
              <td style="padding: var(--space-sm); font-family: var(--font-mono, 'Monaco', 'Menlo', 'Courier New', monospace); font-size: var(--text-sm); color: var(--color-text);">
                ${escapeHtml(field.fieldName)}
              </td>
              <td style="padding: var(--space-sm); font-size: var(--text-sm); color: var(--color-text);">
                ${escapeHtml(field.displayName || field.fieldName)}
              </td>
              <td style="padding: var(--space-sm); font-size: var(--text-sm); color: var(--color-text-muted);">
                ${escapeHtml(field.fieldType)}
              </td>
              <td style="padding: var(--space-sm); font-size: var(--text-sm); color: var(--color-text-muted); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(field.description || '')}">
                ${escapeHtml(field.description || '-')}
              </td>
              <td style="padding: var(--space-sm); text-align: center;">
                <label class="toggle-switch" style="display: inline-block;">
                  <input type="checkbox" ${field.enabled ? 'checked' : ''} 
                         onchange="schemaConfigView.toggleField('${escapeHtml(field.tableName)}', '${escapeHtml(field.fieldName)}', this.checked)">
                  <span class="slider"></span>
                </label>
                <span style="font-size: var(--text-xs); color: ${field.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'}; margin-left: var(--space-xs);">
                  ${field.enabled ? '' : ''}
                </span>
              </td>
              <td style="padding: var(--space-sm); text-align: center;">
                <button class="btn btn-sm btn-secondary" 
                        onclick="schemaConfigView.deleteCustomField('${escapeHtml(field.tableName)}', '${escapeHtml(field.fieldName)}')" 
                        title="Remove configuration (field will be exported by default)"
                        style="padding: 4px 8px; font-size: var(--text-xs);">
                  Remove
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render JSON editor view
 */
function renderJsonEditor(schema, customFields) {
  const schemaJson = schema ? JSON.stringify(schema, null, 2) : '{}';
  const customFieldsJson = JSON.stringify(customFields, null, 2);
  
  return `
    <div class="json-editor-view" style="display: flex; flex-direction: column; height: 100%; gap: var(--space-md);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3>Schema JSON Editor</h3>
          <p style="color: var(--color-text-muted); font-size: var(--text-sm); margin-top: var(--space-xs);">
            Edit the database schema as JSON. Changes are validated before saving. 
            <strong>Warning:</strong> Invalid JSON or schema changes may cause errors.
          </p>
        </div>
        <div style="display: flex; gap: var(--space-sm);">
          <button class="btn btn-secondary" onclick="schemaConfigView.loadSchemaFromApi()" title="Reload schema from API">
            Reload
          </button>
          <button class="btn btn-primary" onclick="schemaConfigView.saveSchemaFromJson()" title="Save schema changes">
            Save Schema
          </button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); height: calc(100% - 120px);">
        <div style="display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: var(--space-sm); background: var(--color-bg-alt); border-bottom: 1px solid var(--color-border);">
            <strong>Database Schema</strong>
            <span style="color: var(--color-text-muted); font-size: var(--text-xs); margin-left: var(--space-sm);">
              Tables, columns, types, constraints
            </span>
          </div>
          <textarea id="schema-json-editor" 
                    style="flex: 1; padding: var(--space-md); font-family: 'Monaco', 'Menlo', 'Courier New', monospace; font-size: 13px; line-height: 1.6; border: none; resize: none; background: var(--color-bg); color: var(--color-text);"
                    spellcheck="false">${window.escapeHtml ? window.escapeHtml(schemaJson) : schemaJson}</textarea>
        </div>
        
        <div style="display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: var(--space-sm); background: var(--color-bg-alt); border-bottom: 1px solid var(--color-border);">
            <strong>Custom Field Configurations</strong>
            <span style="color: var(--color-text-muted); font-size: var(--text-xs); margin-left: var(--space-sm);">
              Field metadata and display settings
            </span>
          </div>
          <textarea id="custom-fields-json-editor" 
                    style="flex: 1; padding: var(--space-md); font-family: 'Monaco', 'Menlo', 'Courier New', monospace; font-size: 13px; line-height: 1.6; border: none; resize: none; background: var(--color-bg); color: var(--color-text);"
                    spellcheck="false">${window.escapeHtml ? window.escapeHtml(customFieldsJson) : customFieldsJson}</textarea>
        </div>
      </div>
      
      <div id="json-editor-status" style="padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); font-size: var(--text-sm);"></div>
    </div>
  `;
}

/**
 * Render export/import tab
 */
function renderExportImportTab() {
  return `
    <div class="export-import-tab">
      <div class="tab-header">
        <h3>Export & Import Workspace Data</h3>
        <p class="tab-description">
          Export your workspace data with custom options, or import/open shared workspaces. 
          Export settings respect your field configuration above.
        </p>
      </div>
      
      <div class="export-import-grid">
        <!-- Export Section -->
        <div class="action-card">
          <div class="action-card-header">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            <h4>Export Workspace Data</h4>
          </div>
          <p class="action-card-description">
            Export your workspace data as JSON with custom date ranges, workspace selection, and privacy levels.
          </p>
          <button class="btn btn-primary btn-block" 
                  onclick="if(window.showExportOptionsModal) window.showExportOptionsModal(); else console.warn('Export options modal not loaded');">
            Configure & Export
          </button>
          <div class="action-card-info">
            <strong>Export includes:</strong> File changes, AI prompts, terminal commands, context files, and workspace metadata (based on your field configuration).
          </div>
        </div>
        
        <!-- Import Section -->
        <div class="action-card">
          <div class="action-card-header">
            <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" transform="rotate(180 10 10)" clip-rule="evenodd"/>
            </svg>
            <h4>Import / Open Shared Workspace</h4>
          </div>
          <p class="action-card-description">
            Open a workspace shared by a teammate, restore from backup, or import historical data.
          </p>
          <button class="btn btn-primary btn-block" 
                  onclick="if(window.showImportModal) window.showImportModal(); else console.warn('Import handler not loaded');">
            Open Shared Workspace
          </button>
          <div class="action-card-info">
            <strong>Use cases:</strong> Open shared workspaces, restore backups, sync across devices, import historical data.
          </div>
        </div>
      </div>
    </div>
  `;
}

// Export functions to window for global access
if (typeof window !== 'undefined') {
  window.renderSchemaConfigTableList = renderTableList;
  window.renderSchemaConfigWelcome = renderWelcome;
  window.renderSchemaConfigTableDetails = renderTableDetails;
  window.renderSchemaConfigColumns = renderColumns;
  window.renderSchemaConfigCustomFields = renderCustomFields;
  window.renderSchemaConfigJsonEditor = renderJsonEditor;
  window.renderSchemaConfigExportImportTab = renderExportImportTab;
}

