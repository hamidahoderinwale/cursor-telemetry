/**
 * Schema Configuration View
 * Allows users to view and configure the database schema through the UI
 */

class SchemaConfigView {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE_URL || window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.schema = null;
    this.customFields = [];
    this.selectedTable = null;
    this.connectionError = null;
  }

  async init() {
    await this.loadSchema();
    await this.loadCustomFields();
    this.render();
  }

  async loadSchema() {
    try {
      // Create abort controller for timeout (compatible with older browsers)
      // Use longer timeout for production (Render backend can be slow on cold start)
      const isProduction = !this.apiBase.includes('localhost') && !this.apiBase.includes('127.0.0.1');
      const timeout = isProduction ? 30000 : 5000; // 30s for production, 5s for local
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${this.apiBase}/api/schema`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        this.schema = result.data;
        this.connectionError = null; // Clear any previous errors
      } else {
        throw new Error(result.error || 'Failed to load schema');
      }
    } catch (error) {
      // Don't log abort errors as errors - they're expected when backend is slow
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        console.log('Schema request timed out (backend may be starting up)');
      } else {
        console.error('Error loading schema:', error);
      }
      
      // If the primary URL failed and it's not localhost, try localhost as fallback
      const isNetworkError = error.message.includes('Failed to fetch') || 
                            error.message.includes('NetworkError') ||
                            error.message.includes('timeout') ||
                            error.name === 'AbortError' ||
                            error.name === 'TypeError';
      const isLocalhost = this.apiBase.includes('localhost') || this.apiBase.includes('127.0.0.1');
      
      if (isNetworkError && !isLocalhost) {
        console.log('Primary URL failed, trying localhost fallback...');
        const localhostUrl = 'http://localhost:43917';
        try {
          const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 3000);
          
          const fallbackResponse = await fetch(`${localhostUrl}/api/schema`, {
            signal: fallbackController.signal
          });
          
          clearTimeout(fallbackTimeoutId);
          
          if (fallbackResponse.ok) {
            const fallbackResult = await fallbackResponse.json();
            if (fallbackResult.success) {
              // Localhost worked! Update the API base
              this.apiBase = localhostUrl;
              this.schema = fallbackResult.data;
              this.connectionError = null;
              
              // Update global config
              if (window.configureCompanionURL) {
                window.configureCompanionURL(localhostUrl, 'ws://localhost:43917');
              }
              
              console.log('Successfully connected to localhost companion service');
              return; // Success, exit early
            }
          }
        } catch (fallbackError) {
          console.log('Localhost fallback also failed:', fallbackError);
          // Continue to set the original error
        }
      }
      
      // If fallback didn't work or wasn't applicable, set the original error
      this.connectionError = error;
      // Set empty schema so UI can show error message
      this.schema = { tables: [] };
    }
  }

  async loadCustomFields(tableName = null) {
    try {
      const url = tableName 
        ? `${this.apiBase}/api/schema/config/fields?tableName=${tableName}`
        : `${this.apiBase}/api/schema/config/fields`;
      
      // Create abort controller for timeout (compatible with older browsers)
      // Use longer timeout for production (Render backend can be slow on cold start)
      const isProduction = !this.apiBase.includes('localhost') && !this.apiBase.includes('127.0.0.1');
      const timeout = isProduction ? 30000 : 5000; // 30s for production, 5s for local
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.success) {
        this.customFields = result.data;
      } else {
        // Don't throw - custom fields are optional
        this.customFields = [];
      }
    } catch (error) {
      // Don't log abort errors as errors - they're expected when backend is slow
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        console.log('Custom fields request timed out (backend may be starting up)');
      } else {
        console.error('Error loading custom fields:', error);
      }
      // Don't set connectionError here - schema loading is the main indicator
      this.customFields = [];
    }
  }

  render() {
    const container = document.getElementById('schema-config-container');
    if (!container) return;

    const viewMode = this.viewMode || 'ui'; // 'ui' or 'json'
    const activeTab = this.activeTab || 'configure'; // 'configure' or 'export-import'

    // Calculate statistics for overview
    const totalFields = this.schema?.tables?.reduce((sum, table) => sum + table.columns.length, 0) || 0;
    const enabledFields = this.customFields.filter(f => f.enabled).length;
    const disabledFields = this.customFields.filter(f => !f.enabled).length;
    const configuredFields = enabledFields + disabledFields;

    container.innerHTML = `
      <div class="schema-config-view">
        <!-- Header Section -->
        <div class="schema-header">
          <div class="header-content">
            <h2>Export Field Configuration</h2>
            <p class="schema-description">
              Control which database fields are included in exports. Configure field visibility to manage privacy, reduce file size, and customize exported data.
            </p>
          </div>
          
          <!-- Quick Stats -->
          <div class="header-stats">
            <div class="stat-item">
              <div class="stat-value">${configuredFields}</div>
              <div class="stat-label">Configured</div>
            </div>
            <div class="stat-item stat-success">
              <div class="stat-value">${enabledFields}</div>
              <div class="stat-label">Enabled</div>
            </div>
            <div class="stat-item stat-muted">
              <div class="stat-value">${disabledFields}</div>
              <div class="stat-label">Disabled</div>
            </div>
            <div class="stat-item stat-info">
              <div class="stat-value">${totalFields - configuredFields}</div>
              <div class="stat-label">Default</div>
            </div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="schema-tabs">
          <button class="tab-button ${activeTab === 'configure' ? 'active' : ''}" 
                  onclick="schemaConfigView.activeTab = 'configure'; schemaConfigView.render();">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
              <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
            </svg>
            Configure Fields
          </button>
          <button class="tab-button ${activeTab === 'export-import' ? 'active' : ''}" 
                  onclick="schemaConfigView.activeTab = 'export-import'; schemaConfigView.render();">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            Export & Import
          </button>
          <button class="tab-button ${viewMode === 'json' ? 'active' : ''}" 
                  onclick="schemaConfigView.setViewMode('json'); schemaConfigView.render();"
                  title="Advanced JSON editor">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            JSON Editor
          </button>
        </div>

        <!-- Tab Content -->
        <div class="schema-content">
          ${viewMode === 'json' ? this.renderJsonEditor() : 
            activeTab === 'export-import' ? this.renderExportImportTab() : `
            <div class="schema-sidebar">
              <div class="sidebar-header">
                <h3>Database Tables</h3>
                <p class="sidebar-subtitle">Select a table to configure its export fields</p>
              </div>
              <div class="table-list" id="table-list">
                ${this.renderTableList()}
              </div>
            </div>

            <div class="schema-main">
              ${this.selectedTable ? this.renderTableDetails() : this.renderWelcome()}
            </div>
          `}
        </div>
      </div>
    `;

    if (viewMode === 'json') {
      this.attachJsonEditorListeners();
    } else if (activeTab === 'configure') {
      this.attachEventListeners();
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    if (mode === 'json') {
      this.activeTab = null; // Clear active tab when switching to JSON
    } else if (!this.activeTab) {
      this.activeTab = 'configure'; // Default to configure tab
    }
  }

  renderJsonEditor() {
    const schemaJson = this.schema ? JSON.stringify(this.schema, null, 2) : '{}';
    const customFieldsJson = JSON.stringify(this.customFields, null, 2);
    
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

  attachJsonEditorListeners() {
    const schemaEditor = document.getElementById('schema-json-editor');
    const customFieldsEditor = document.getElementById('custom-fields-json-editor');
    
    if (schemaEditor) {
      schemaEditor.addEventListener('input', () => {
        this.validateJson(schemaEditor.value, 'schema');
      });
    }
    
    if (customFieldsEditor) {
      customFieldsEditor.addEventListener('input', () => {
        this.validateJson(customFieldsEditor.value, 'customFields');
      });
    }
  }

  validateJson(jsonString, type) {
    const statusEl = document.getElementById('json-editor-status');
    if (!statusEl) return;
    
    try {
      const parsed = JSON.parse(jsonString);
      statusEl.innerHTML = `<span style="color: var(--color-success);">✓ Valid JSON (${type})</span>`;
      statusEl.style.color = 'var(--color-success)';
      return true;
    } catch (error) {
      statusEl.innerHTML = `<span style="color: var(--color-error);">✗ Invalid JSON (${type}): ${error.message}</span>`;
      statusEl.style.color = 'var(--color-error)';
      return false;
    }
  }

  async loadSchemaFromApi() {
    await this.loadSchema();
    await this.loadCustomFields();
    this.render();
    this.showNotification('Schema reloaded from database', 'success');
  }

  async saveSchemaFromJson() {
    const schemaEditor = document.getElementById('schema-json-editor');
    const customFieldsEditor = document.getElementById('custom-fields-json-editor');
    
    if (!schemaEditor || !customFieldsEditor) {
      this.showNotification('Editors not found', 'error');
      return;
    }
    
    // Validate JSON
    let schemaData, customFieldsData;
    try {
      schemaData = JSON.parse(schemaEditor.value);
    } catch (error) {
      this.showNotification(`Invalid schema JSON: ${error.message}`, 'error');
      return;
    }
    
    try {
      customFieldsData = JSON.parse(customFieldsEditor.value);
    } catch (error) {
      this.showNotification(`Invalid custom fields JSON: ${error.message}`, 'error');
      return;
    }
    
    // Save custom fields (schema changes require migrations, so we only save custom field configs)
    try {
      for (const field of customFieldsData) {
        const response = await fetch(`${this.apiBase}/api/schema/config/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(field)
        });
        
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to save field');
        }
      }
      
      await this.loadCustomFields();
      this.showNotification('Custom field configurations saved successfully', 'success');
      
      // Note: Schema changes require database migrations
      this.showNotification('Note: Schema structure changes require database migrations. Use the UI view to add columns.', 'info');
    } catch (error) {
      this.showNotification(`Error saving: ${error.message}`, 'error');
    }
  }

  renderTableList() {
    if (!this.schema || !this.schema.tables) {
      return '<p>Loading tables...</p>';
    }

    return this.schema.tables.map(table => `
      <div class="table-item ${this.selectedTable === table.name ? 'active' : ''}" 
           data-table="${table.name}">
        <span class="table-name">${table.name}</span>
        <span class="table-column-count">${table.columns.length} columns</span>
      </div>
    `).join('');
  }

  renderWelcome() {
    // Show connection error if present
    if (this.connectionError) {
      const errorMessage = this.connectionError.message || 'Unknown error';
      const isNetworkError = errorMessage.includes('Failed to fetch') || 
                            errorMessage.includes('NetworkError') ||
                            errorMessage.includes('timeout') ||
                            this.connectionError.name === 'AbortError' ||
                            this.connectionError.name === 'TypeError';
      
      const isLocalhost = this.apiBase.includes('localhost') || this.apiBase.includes('127.0.0.1');
      const showSwitchToLocalhost = !isLocalhost && isNetworkError;
      
      return `
        <div class="welcome-message" style="max-width: 600px; margin: 0 auto; padding: var(--space-xl);">
          <div style="text-align: center; margin-bottom: var(--space-lg);">
            <div style="font-size: 48px; margin-bottom: var(--space-md); opacity: 0.5;">⚠️</div>
            <h3 style="color: var(--color-error); margin-bottom: var(--space-sm);">Cannot connect to companion service</h3>
            <p style="color: var(--color-text-muted); margin-bottom: var(--space-md);">
              ${isNetworkError 
                ? `Cannot connect to companion service at <code style="background: var(--color-bg-alt); padding: 2px 6px; border-radius: 4px;">${this.apiBase}</code>. Please ensure the service is running.`
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
    
    if (!this.schema || !this.schema.tables || this.schema.tables.length === 0) {
      return `
        <div class="welcome-message">
          <h3>Loading schema...</h3>
          <p>Fetching database schema information.</p>
        </div>
      `;
    }

    // Count enabled/disabled fields per table
    const tableStats = this.schema.tables.map(table => {
      const tableFields = this.customFields.filter(f => f.tableName === table.name);
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
                  const fieldConfig = this.customFields.find(f => f.tableName === table.name && f.fieldName === col.name);
                  const statusClass = fieldConfig 
                    ? (fieldConfig.enabled ? 'field-enabled' : 'field-disabled')
                    : 'field-default';
                  return `
                  <div class="column-preview ${statusClass}">
                    <span class="column-preview-name">${col.name}</span>
                    <span class="column-preview-type">${col.type}</span>
                    ${col.primaryKey ? '<span class="badge badge-primary badge-small">PK</span>' : ''}
                    ${fieldConfig ? (fieldConfig.enabled ? '<span class="badge badge-success badge-small">✓</span>' : '<span class="badge badge-muted badge-small">✗</span>') : ''}
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

  renderExportImportTab() {
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

  renderTableDetails() {
    if (!this.selectedTable || !this.schema) {
      return this.renderWelcome();
    }

    const table = this.schema.tables.find(t => t.name === this.selectedTable);
    if (!table) {
      return '<p>Table not found</p>';
    }

    const tableCustomFields = this.customFields.filter(f => f.tableName === this.selectedTable);

    return `
      <div class="table-details">
        <div class="table-header">
          <div>
            <h3>${this.selectedTable}</h3>
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
              ${this.renderColumns(table.columns)}
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
              ${this.renderCustomFields(tableCustomFields)}
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

  renderColumns(columns) {
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

  renderCustomFields(fields) {
    if (fields.length === 0) {
      return '<p class="empty-state">No field configurations. All fields will be exported by default.</p>';
    }

    return fields.map(field => `
      <div class="custom-field-item" style="border-left: 3px solid ${field.enabled ? 'var(--color-success)' : 'var(--color-error)'}; padding: var(--space-sm); margin-bottom: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm);">
        <div class="field-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xs);">
          <div>
            <span class="field-name" style="font-weight: 600;">${field.displayName || field.fieldName}</span>
            <span style="color: var(--color-text-muted); font-size: var(--text-xs); margin-left: var(--space-xs);">
              (${field.tableName}.${field.fieldName})
            </span>
          </div>
          <div class="field-actions" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span style="font-size: var(--text-xs); color: ${field.enabled ? 'var(--color-success)' : 'var(--color-text-muted)'};">
              ${field.enabled ? '✓ Exported' : '✗ Excluded'}
            </span>
            <label class="toggle-switch">
              <input type="checkbox" ${field.enabled ? 'checked' : ''} 
                     onchange="schemaConfigView.toggleField('${field.tableName}', '${field.fieldName}', this.checked)">
              <span class="slider"></span>
            </label>
            <button class="btn-icon" onclick="schemaConfigView.deleteCustomField('${field.tableName}', '${field.fieldName}')" title="Remove configuration (field will be exported by default)">
              [Remove]
            </button>
          </div>
        </div>
        <div class="field-details" style="font-size: var(--text-xs); color: var(--color-text-muted);">
          <span class="field-type">Type: ${field.fieldType}</span>
          ${field.description ? `<span style="margin-left: var(--space-sm);">• ${field.description}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  attachEventListeners() {
    const tableItems = document.querySelectorAll('.table-item');
    tableItems.forEach(item => {
      item.addEventListener('click', () => {
        const tableName = item.dataset.table;
        this.selectTable(tableName);
      });
    });

    // Add click handlers for table overview cards
    const tableCards = document.querySelectorAll('.table-overview-card');
    tableCards.forEach(card => {
      card.addEventListener('click', () => {
        const tableName = card.dataset.table;
        this.selectTable(tableName);
      });
    });
  }

  async selectTable(tableName) {
    this.selectedTable = tableName;
    await this.loadCustomFields(tableName);
    this.render();
  }

  async showAddColumnModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Add Column to ${this.selectedTable}</h3>
        <form id="add-column-form">
          <div class="form-group">
            <label>Column Name</label>
            <input type="text" name="name" required placeholder="column_name">
          </div>
          <div class="form-group">
            <label>Data Type</label>
            <select name="type" required>
              <option value="TEXT">TEXT</option>
              <option value="INTEGER">INTEGER</option>
              <option value="REAL">REAL</option>
              <option value="BLOB">BLOB</option>
              <option value="NUMERIC">NUMERIC</option>
            </select>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="notnull"> NOT NULL
            </label>
          </div>
          <div class="form-group">
            <label>Default Value (optional)</label>
            <input type="text" name="defaultValue" placeholder="NULL">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Column</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#add-column-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const columnDef = {
        name: formData.get('name'),
        type: formData.get('type'),
        notnull: formData.get('notnull') === 'on',
        defaultValue: formData.get('defaultValue') || null
      };

      try {
        const response = await fetch(`${this.apiBase}/api/schema/${this.selectedTable}/columns`, {
          method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(columnDef)
      });

      const result = await response.json();
      if (result.success) {
        await this.loadSchema();
        this.render();
        modal.remove();
        this.showNotification('Column added successfully', 'success');
      } else {
        this.showNotification(result.error || 'Failed to add column', 'error');
      }
    } catch (error) {
      this.showNotification('Error adding column: ' + error.message, 'error');
    }
  });
}

  async showAddCustomFieldModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Add Custom Field Configuration</h3>
        <form id="add-custom-field-form">
          <div class="form-group">
            <label>Field Name</label>
            <input type="text" name="fieldName" required placeholder="field_name">
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" name="displayName" placeholder="Display Name">
          </div>
          <div class="form-group">
            <label>Field Type</label>
            <select name="fieldType" required>
              <option value="TEXT">TEXT</option>
              <option value="INTEGER">INTEGER</option>
              <option value="REAL">REAL</option>
              <option value="BOOLEAN">BOOLEAN</option>
              <option value="JSON">JSON</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="3" placeholder="Field description"></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" name="enabled" checked> Enabled
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Configuration</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#add-custom-field-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const config = {
        tableName: this.selectedTable,
        fieldName: formData.get('fieldName'),
        displayName: formData.get('displayName') || formData.get('fieldName'),
        fieldType: formData.get('fieldType'),
        description: formData.get('description') || '',
        enabled: formData.get('enabled') === 'on'
      };

      try {
        const response = await fetch(`${this.apiBase}/api/schema/config/fields`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(config)
        });

        const result = await response.json();
        if (result.success) {
          await this.loadCustomFields(this.selectedTable);
          this.render();
          modal.remove();
          this.showNotification('Custom field configuration saved', 'success');
        } else {
          this.showNotification(result.error || 'Failed to save configuration', 'error');
        }
      } catch (error) {
        this.showNotification('Error saving configuration: ' + error.message, 'error');
      }
    });
  }

  async toggleField(tableName, fieldName, enabled) {
    try {
      const field = this.customFields.find(f => f.tableName === tableName && f.fieldName === fieldName);
      if (!field) return;

      const config = {
        ...field,
        enabled: enabled
      };

      const response = await fetch(`${this.apiBase}/api/schema/config/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      if (result.success) {
        await this.loadCustomFields(this.selectedTable);
        this.render();
      }
    } catch (error) {
      console.error('Error toggling field:', error);
    }
  }

  async deleteCustomField(tableName, fieldName) {
    if (!confirm(`Are you sure you want to delete the custom field configuration for ${fieldName}?`)) {
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/api/schema/config/fields/${tableName}/${fieldName}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        await this.loadCustomFields(this.selectedTable);
        this.render();
        this.showNotification('Custom field configuration deleted', 'success');
      } else {
        this.showNotification(result.error || 'Failed to delete configuration', 'error');
      }
    } catch (error) {
      this.showNotification('Error deleting configuration: ' + error.message, 'error');
    }
  }

  async testConnection() {
    const container = document.getElementById('schema-config-container');
    if (!container) return;
    
    // Show testing message
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.innerHTML = `
        <div style="text-align: center; padding: var(--space-xl);">
          <div class="loading-spinner" style="margin: 0 auto var(--space-md);"></div>
          <h3>Testing connection...</h3>
          <p style="color: var(--color-text-muted);">Checking if companion service is available at ${this.apiBase}</p>
        </div>
      `;
    }
    
    try {
      // Test health endpoint first (faster)
      const healthController = new AbortController();
      const healthTimeoutId = setTimeout(() => healthController.abort(), 3000);
      
      const healthResponse = await fetch(`${this.apiBase}/health`, {
        signal: healthController.signal
      });
      
      clearTimeout(healthTimeoutId);
      
      if (!healthResponse.ok) {
        throw new Error(`Service returned HTTP ${healthResponse.status}`);
      }
      
      // If health check passes, try loading schema
      await this.loadSchema();
      await this.loadCustomFields();
      
      if (this.connectionError) {
        throw this.connectionError;
      }
      
      // Success - re-render
      this.render();
      this.showNotification('Successfully connected to companion service!', 'success');
    } catch (error) {
      console.error('Connection test failed:', error);
      this.connectionError = error;
      this.render();
      this.showNotification(`Connection failed: ${error.message}`, 'error');
    }
  }

  async switchToLocalhost() {
    // Switch API base to localhost
    const localhostUrl = 'http://localhost:43917';
    this.apiBase = localhostUrl;
    
    // Update global config
    if (window.configureCompanionURL) {
      window.configureCompanionURL(localhostUrl, 'ws://localhost:43917');
    } else {
      // Fallback: update localStorage directly
      if (window.LocalStorageHelper) {
        window.LocalStorageHelper.set('COMPANION_API_URL', localhostUrl, false);
        window.LocalStorageHelper.set('COMPANION_WS_URL', 'ws://localhost:43917', false);
      } else {
        localStorage.setItem('COMPANION_API_URL', localhostUrl);
        localStorage.setItem('COMPANION_WS_URL', 'ws://localhost:43917');
      }
      if (window.CONFIG) {
        window.CONFIG.API_BASE = localhostUrl;
        window.CONFIG.API_BASE_URL = localhostUrl;
        window.CONFIG.WS_URL = 'ws://localhost:43917';
      }
    }
    
    // Clear connection error and try to connect
    this.connectionError = null;
    this.showNotification('Switched to localhost. Testing connection...', 'info');
    
    // Test connection to localhost
    await this.testConnection();
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SchemaConfigView;
} else {
  window.SchemaConfigView = SchemaConfigView;
  
  // Create global render function for view router
  let schemaConfigViewInstance = null;
  
  window.renderSchemaConfigView = function(container) {
    if (!schemaConfigViewInstance) {
      schemaConfigViewInstance = new SchemaConfigView();
    }
    
    container.innerHTML = '<div id="schema-config-container"></div>';
    schemaConfigViewInstance.init();
  };
  
  // Make instance globally accessible
  window.schemaConfigView = null;
  
  // Initialize on first render
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.schemaConfigView) {
      window.schemaConfigView = new SchemaConfigView();
    }
  });
}

