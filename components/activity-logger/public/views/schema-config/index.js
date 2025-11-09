/**
 * Schema Configuration View
 * Allows users to view and configure the database schema through the UI
 */

class SchemaConfigView {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    this.schema = null;
    this.customFields = [];
    this.selectedTable = null;
  }

  async init() {
    await this.loadSchema();
    await this.loadCustomFields();
    this.render();
  }

  async loadSchema() {
    try {
      const response = await fetch(`${this.apiBase}/api/schema`);
      const result = await response.json();
      if (result.success) {
        this.schema = result.data;
      }
    } catch (error) {
      console.error('Error loading schema:', error);
    }
  }

  async loadCustomFields(tableName = null) {
    try {
      const url = tableName 
        ? `${this.apiBase}/api/schema/config/fields?tableName=${tableName}`
        : `${this.apiBase}/api/schema/config/fields`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        this.customFields = result.data;
      }
    } catch (error) {
      console.error('Error loading custom fields:', error);
    }
  }

  render() {
    const container = document.getElementById('schema-config-container');
    if (!container) return;

    container.innerHTML = `
      <div class="schema-config-view">
        <div class="schema-header">
          <h2>Database Schema Configuration</h2>
          <p class="schema-description">
            View and configure your database schema. Add custom fields, modify table structures, 
            and manage field configurations. Schema-aware imports validate data compatibility before importing.
          </p>
          <div class="schema-header-actions">
            <button class="btn btn-secondary" onclick="if(window.showImportModal) window.showImportModal(); else console.warn('Import handler not loaded');" title="Open a shared workspace or import workspace data">
              Open Shared Workspace
            </button>
          </div>
        </div>

        <div class="schema-content">
          <div class="schema-sidebar">
            <h3>Tables</h3>
            <div class="table-list" id="table-list">
              ${this.renderTableList()}
            </div>
          </div>

          <div class="schema-main">
            ${this.selectedTable ? this.renderTableDetails() : this.renderWelcome()}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
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
    if (!this.schema || !this.schema.tables || this.schema.tables.length === 0) {
      return `
        <div class="welcome-message">
          <h3>Loading schema...</h3>
          <p>Fetching database schema information.</p>
        </div>
      `;
    }

    // Show schema overview by default
    return `
      <div class="schema-overview">
        <div class="overview-header">
          <h3>Current Database Schema</h3>
          <p class="overview-description">
            Overview of all tables and their structure. Click on any table to view details and make modifications.
          </p>
        </div>

        <div class="tables-overview">
          ${this.schema.tables.map(table => `
            <div class="table-overview-card" data-table="${table.name}" style="cursor: pointer;">
              <div class="table-overview-header">
                <h4 class="table-overview-name">${table.name}</h4>
                <span class="table-overview-count">${table.columns.length} columns</span>
              </div>
              <div class="table-overview-columns">
                ${table.columns.slice(0, 5).map(col => `
                  <div class="column-preview">
                    <span class="column-preview-name">${col.name}</span>
                    <span class="column-preview-type">${col.type}</span>
                    ${col.primaryKey ? '<span class="badge badge-primary badge-small">PK</span>' : ''}
                    ${col.notnull ? '<span class="badge badge-info badge-small">NN</span>' : ''}
                  </div>
                `).join('')}
                ${table.columns.length > 5 ? `
                  <div class="column-preview-more">
                    +${table.columns.length - 5} more columns
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="overview-actions">
          <p class="overview-hint">
            <strong>Tip:</strong> Select a table from the sidebar or click on any table card above to view its full schema and make modifications.
          </p>
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
              <h4>Custom Field Configurations</h4>
              <span class="section-count">${tableCustomFields.length} configured</span>
            </div>
            <p class="section-description">Metadata and display configurations for fields. These don't modify the database schema but control how fields are displayed and used.</p>
            <div class="custom-fields-list">
              ${this.renderCustomFields(tableCustomFields)}
            </div>
            <button class="btn btn-secondary" onclick="schemaConfigView.showAddCustomFieldModal()">
              Add Custom Field Configuration
            </button>
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
      return '<p class="empty-state">No custom field configurations</p>';
    }

    return fields.map(field => `
      <div class="custom-field-item">
        <div class="field-header">
          <span class="field-name">${field.displayName || field.fieldName}</span>
          <div class="field-actions">
            <label class="toggle-switch">
              <input type="checkbox" ${field.enabled ? 'checked' : ''} 
                     onchange="schemaConfigView.toggleField('${field.tableName}', '${field.fieldName}', this.checked)">
              <span class="slider"></span>
            </label>
            <button class="btn-icon" onclick="schemaConfigView.deleteCustomField('${field.tableName}', '${field.fieldName}')" title="Delete">
              [Delete]
            </button>
          </div>
        </div>
        <div class="field-details">
          <span class="field-type">Type: ${field.fieldType}</span>
          ${field.description ? `<p class="field-description">${field.description}</p>` : ''}
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

