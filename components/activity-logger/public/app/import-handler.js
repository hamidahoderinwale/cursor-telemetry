/**
 * Import Handler Module
 * Handles importing/redeploying exported database data with schema validation
 */

/**
 * Show import modal and handle file selection
 */
async function showImportModal() {
  // Check if modal already exists and remove it
  const existingModal = document.getElementById('importModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'importModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content export-modal-content">
      <div class="modal-header">
        <h2>Import / Redeploy Data</h2>
        <button class="modal-close" onclick="closeImportModal()">&times;</button>
      </div>
      <div class="modal-body export-modal-section">
        <!-- Use Cases / Workflow Explanation -->
        <div class="import-use-cases">
          <h3 class="card-title">Common Use Cases</h3>
          <div class="use-cases-grid">
            <div class="use-case-item">
              <div class="use-case-title">Backup & Restore</div>
              <div class="use-case-desc">Restore your telemetry data from a backup file</div>
            </div>
            <div class="use-case-item">
              <div class="use-case-title">System Migration</div>
              <div class="use-case-desc">Move your data to a new machine or installation</div>
            </div>
            <div class="use-case-item">
              <div class="use-case-title">Redeployment</div>
              <div class="use-case-desc">Restore data after resetting or reinstalling the service</div>
            </div>
            <div class="use-case-item">
              <div class="use-case-title">Data Merging</div>
              <div class="use-case-desc">Combine data from multiple sources or time periods</div>
            </div>
          </div>
        </div>
        
        <div class="import-section">
          <h3 class="card-title">Step 1: Select Export File</h3>
          <div class="export-modal-field-group">
            <label class="form-label">Select exported JSON file:</label>
            <input type="file" id="importFileInput" accept=".json" class="form-input file-input">
            <div class="file-input-hint">Choose a file exported from the "Export JSON" feature. The file should contain events, prompts, workspaces, and terminal commands.</div>
          </div>
          <div id="filePreview" class="file-preview" style="display: none;">
            <div class="file-preview-header">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 8px;">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"/>
              </svg>
              <span id="fileName"></span>
              <span id="fileSize" class="file-size"></span>
            </div>
          </div>
        </div>
        
        <div class="import-section">
          <h3 class="card-title">Step 2: Configure Import Options</h3>
          
          <div class="export-modal-field-group">
            <label class="form-label">
              Merge Strategy
              <span class="tooltip-icon" title="Determines how to handle records that already exist in your database">i</span>
            </label>
            <select id="importMergeStrategy" class="form-input">
              <option value="skip">Skip duplicates (recommended)</option>
              <option value="overwrite">Overwrite existing records</option>
              <option value="merge">Merge (combine data)</option>
              <option value="append">Append all (allow duplicates)</option>
            </select>
            <div class="merge-strategy-help">
              <div class="strategy-option" data-strategy="skip">
                <strong>Skip duplicates:</strong> Only import records that don't already exist. Safe for backups and restores.
              </div>
              <div class="strategy-option" data-strategy="overwrite">
                <strong>Overwrite existing:</strong> Replace existing records with imported data. Use when updating data.
              </div>
              <div class="strategy-option" data-strategy="merge">
                <strong>Merge:</strong> Combine data from both sources. Useful for merging datasets.
              </div>
              <div class="strategy-option" data-strategy="append">
                <strong>Append all:</strong> Import everything, even duplicates. Creates duplicate records.
              </div>
            </div>
          </div>
          
          <div class="export-modal-field-group">
            <label class="form-label">
              Workspace Filter (optional)
              <span class="tooltip-icon" title="Only import data for a specific workspace path">i</span>
            </label>
            <input type="text" id="importWorkspaceFilter" class="form-input" placeholder="Leave empty to import all workspaces">
            <div class="file-input-hint">Enter a workspace path to import only data from that workspace. Leave empty to import all workspaces from the file.</div>
          </div>
          
          <div class="export-modal-checkbox-group">
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="importDryRun">
              <span>
                <strong>Dry run (validate only)</strong>
                <div class="description">Test the import without actually importing data. Shows what would be imported without making changes. Recommended for first-time imports.</div>
              </span>
            </label>
          </div>
          
          <div class="import-warning-box" style="display: none;" id="overwriteWarning">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink: 0; margin-right: 8px; color: var(--color-warning);">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div>
              <strong>Warning:</strong> This will overwrite existing records. Make sure you have a backup before proceeding.
            </div>
          </div>
        </div>
        
        <div id="schemaValidation" class="schema-validation-section" style="display: none;">
          <h3 class="card-title">Schema Compatibility</h3>
          <div id="schemaValidationContent"></div>
        </div>
        
        <div id="importStatus" class="import-status" style="display: none;"></div>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeImportModal()">Cancel</button>
          <button class="btn btn-primary" id="importButton" onclick="handleImport()" disabled>Import</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Enable import button when file is selected
  const fileInput = document.getElementById('importFileInput');
  const importButton = document.getElementById('importButton');
  
  fileInput.addEventListener('change', async (e) => {
    const hasFile = e.target.files && e.target.files.length > 0;
    importButton.disabled = !hasFile;
    
    if (hasFile) {
      importButton.textContent = 'Import';
      // Validate schema when file is selected
      await validateImportFile(e.target.files[0]);
    } else {
      // Hide schema validation
      const schemaSection = document.getElementById('schemaValidation');
      if (schemaSection) {
        schemaSection.style.display = 'none';
      }
    }
  });
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeImportModal();
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeImportModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Close import modal
 */
function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Validate import file and show schema compatibility
 */
async function validateImportFile(file) {
  const schemaSection = document.getElementById('schemaValidation');
  const schemaContent = document.getElementById('schemaValidationContent');
  
  if (!schemaSection || !schemaContent) return;

  try {
    schemaSection.style.display = 'block';
    schemaContent.innerHTML = '<div style="color: var(--color-info);">Analyzing file structure...</div>';

    // Read and parse file
    const fileText = await file.text();
    const importData = JSON.parse(fileText);

    // Initialize validator if needed
    if (!window.schemaValidator) {
      window.schemaValidator = new window.SchemaValidator();
    }

    const validator = window.schemaValidator;

    // Load current schema
    await validator.loadCurrentSchema();

    // Analyze import data
    const analysis = validator.analyzeImportData(importData);
    
    // Validate structure
    const validation = validator.validateImportData(importData);
    
    // Check compatibility
    const compatibility = await validator.checkCompatibility(analysis);

    // Render schema validation results
    let html = '';

    // Schema version info
    html += `
      <div class="schema-info">
        <div class="schema-info-item">
          <strong>Import Schema Version:</strong> 
          <span class="schema-version">${analysis.schemaVersion}</span>
        </div>
        <div class="schema-info-item">
          <strong>Current Schema Version:</strong> 
          <span class="schema-version">${validator.schemaVersion}</span>
        </div>
        ${!compatibility.schemaVersionMatch ? `
          <div class="schema-warning">
            Schema versions differ - data will be normalized during import
          </div>
        ` : `
          <div class="schema-success">
            Schema versions match
          </div>
        `}
      </div>
    `;

    // Data summary
    html += `
      <div class="schema-data-summary">
        <h4>Import Data Summary</h4>
        <div class="data-summary-grid">
          ${analysis.hasEntries ? `
            <div class="data-summary-item">
              <strong>Entries:</strong> ${analysis.tables.entries.count.toLocaleString()}
            </div>
          ` : ''}
          ${analysis.hasPrompts ? `
            <div class="data-summary-item">
              <strong>Prompts:</strong> ${analysis.tables.prompts.count.toLocaleString()}
            </div>
          ` : ''}
          ${analysis.hasEvents ? `
            <div class="data-summary-item">
              <strong>Events:</strong> ${analysis.tables.events.count.toLocaleString()}
            </div>
          ` : ''}
          ${analysis.hasTerminalCommands ? `
            <div class="data-summary-item">
              <strong>Terminal Commands:</strong> ${analysis.tables.terminal_commands.count.toLocaleString()}
            </div>
          ` : ''}
          ${analysis.hasWorkspaces ? `
            <div class="data-summary-item">
              <strong>Workspaces:</strong> ${analysis.tables.workspaces.count.toLocaleString()}
            </div>
          ` : ''}
        </div>
        <div class="data-summary-total">
          <strong>Total Records:</strong> ${analysis.totalRecords.toLocaleString()}
        </div>
      </div>
    `;

    // Compatibility status
    if (compatibility.errors.length > 0) {
      html += `
        <div class="schema-errors">
          <h4>Schema Errors</h4>
          <ul>
            ${compatibility.errors.map(err => `<li>${err}</li>`).join('')}
          </ul>
          <div class="schema-error-note">
            These errors must be resolved before import can proceed.
          </div>
        </div>
      `;
    }

    if (compatibility.warnings.length > 0) {
      html += `
        <div class="schema-warnings">
          <h4>Schema Warnings</h4>
          <ul>
            ${compatibility.warnings.map(warn => `<li>${warn}</li>`).join('')}
          </ul>
          <div class="schema-warning-note">
            These warnings won't prevent import but may affect data quality.
          </div>
        </div>
      `;
    }

    if (compatibility.errors.length === 0 && compatibility.warnings.length === 0) {
      html += `
        <div class="schema-success-message">
          Schema validation passed. Import is compatible with current database schema.
        </div>
      `;
    }

    schemaContent.innerHTML = html;

    // Disable import button if there are errors
    const importButton = document.getElementById('importButton');
    if (importButton && compatibility.errors.length > 0) {
      importButton.disabled = true;
      importButton.title = 'Please fix schema errors before importing';
    } else if (importButton) {
      importButton.disabled = false;
      importButton.title = '';
    }

  } catch (error) {
    console.error('[IMPORT] Schema validation error:', error);
    schemaContent.innerHTML = `
      <div class="schema-error">
        <strong>Validation Error:</strong> ${error.message}
        <div class="schema-error-note">File structure could not be validated. Import may still work.</div>
      </div>
    `;
  }
}

/**
 * Handle the import process
 */
async function handleImport() {
  const fileInput = document.getElementById('importFileInput');
  const overwrite = document.getElementById('importOverwrite').checked;
  const dryRun = document.getElementById('importDryRun').checked;
  const workspaceFilter = document.getElementById('importWorkspaceFilter').value.trim() || null;
  const mergeStrategySelect = document.getElementById('importMergeStrategy');
  let mergeStrategy = mergeStrategySelect ? mergeStrategySelect.value : 'skip';
  
  // Legacy overwrite checkbox takes precedence
  if (overwrite && mergeStrategy !== 'append') {
    mergeStrategy = 'overwrite';
  }
  
  const statusDiv = document.getElementById('importStatus');
  const importButton = document.getElementById('importButton');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div style="color: var(--color-error);">Please select a file to import</div>';
    return;
  }
  
  const file = fileInput.files[0];
  
  try {
    importButton.disabled = true;
    importButton.textContent = 'Importing...';
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div style="color: var(--color-info);">Reading file...</div>';
    
    // Read file as text
    const fileText = await file.text();
    const importData = JSON.parse(fileText);
    
    // Validate structure
    if (!importData.data && !importData.success) {
      // Handle direct export format (where data is at root level)
      if (importData.entries || importData.prompts) {
        importData.data = importData;
      } else {
        throw new Error('Invalid import file format: missing data structure');
      }
    }
    
    // Extract data (handle both {success: true, data: {...}} and {data: {...}} formats)
    const data = importData.data || importData;
    
    statusDiv.innerHTML = '<div style="color: var(--color-info);">Uploading and importing data...</div>';
    
    // Send to import endpoint
    const response = await fetch(`${window.CONFIG.API_BASE}/api/import/database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: data,
        options: {
          overwrite,
          dryRun,
          workspaceFilter,
          mergeStrategy
        }
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Import failed');
    }
    
    if (result.success) {
      // Show success message with stats
      const stats = result.stats;
      const summary = result.summary;
      const schemaInfo = result.schema || {};
      
      let statsHTML = `
        <div class="import-success-message">
          <div class="import-success-header">
            ${dryRun ? 'Dry run completed' : 'Import successful'}
          </div>
          <div class="import-success-text">
            ${result.message}
          </div>
          ${schemaInfo.importVersion ? `
            <div class="import-schema-info" style="margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid rgba(16, 185, 129, 0.3); font-size: var(--text-xs);">
              <strong>Schema:</strong> Import v${schemaInfo.importVersion} → Current v${schemaInfo.currentVersion || '1.0.0'}
              ${schemaInfo.compatible === false ? ' <span style="color: #f59e0b;">(normalized during import)</span>' : ''}
            </div>
          ` : ''}
          ${summary.mergeStrategy ? `
            <div class="import-schema-info" style="margin-top: var(--space-xs); font-size: var(--text-xs);">
              <strong>Merge Strategy:</strong> ${summary.mergeStrategy}
              ${summary.workspaceFilter ? ` | <strong>Workspace:</strong> ${summary.workspaceFilter}` : ''}
            </div>
          ` : ''}
        </div>
        
        <div class="import-stats-grid">
          <div class="import-stat-item">
            <strong>Entries:</strong> 
            <span class="stat-value imported">${stats.entries.imported}</span> imported, 
            <span class="stat-value skipped">${stats.entries.skipped}</span> skipped, 
            <span class="stat-value errors">${stats.entries.errors}</span> errors
          </div>
          <div class="import-stat-item">
            <strong>Prompts:</strong> 
            <span class="stat-value imported">${stats.prompts.imported}</span> imported, 
            <span class="stat-value skipped">${stats.prompts.skipped}</span> skipped, 
            <span class="stat-value errors">${stats.prompts.errors}</span> errors
          </div>
          <div class="import-stat-item">
            <strong>Events:</strong> 
            <span class="stat-value imported">${stats.events.imported}</span> imported, 
            <span class="stat-value skipped">${stats.events.skipped}</span> skipped, 
            <span class="stat-value errors">${stats.events.errors}</span> errors
          </div>
          <div class="import-stat-item">
            <strong>Terminal:</strong> 
            <span class="stat-value imported">${stats.terminalCommands.imported}</span> imported, 
            <span class="stat-value skipped">${stats.terminalCommands.skipped}</span> skipped, 
            <span class="stat-value errors">${stats.terminalCommands.errors}</span> errors
          </div>
          <div class="import-stat-item">
            <strong>Workspaces:</strong> 
            <span class="stat-value imported">${stats.workspaces.imported}</span> imported, 
            <span class="stat-value skipped">${stats.workspaces.skipped}</span> skipped
          </div>
          <div class="import-stat-item import-stat-total">
            <strong>Total:</strong> 
            <span class="stat-value imported">${summary.totalImported}</span> imported, 
            <span class="stat-value skipped">${summary.totalSkipped}</span> skipped, 
            <span class="stat-value errors">${summary.totalErrors}</span> errors
          </div>
        </div>
      `;
      
      statusDiv.innerHTML = statsHTML;
      statusDiv.style.display = 'block';
      
      // Reload dashboard data if not dry run
      if (!dryRun) {
        setTimeout(() => {
          if (window.fetchRecentData) {
            window.fetchRecentData().then(() => {
              if (window.calculateStats) window.calculateStats();
              if (window.renderCurrentView) window.renderCurrentView();
              console.log('[IMPORT] Dashboard data refreshed');
            });
          }
        }, 1000);
      }
      
      importButton.textContent = dryRun ? 'Import Now' : 'Done';
      if (dryRun) {
        importButton.onclick = () => {
          document.getElementById('importDryRun').checked = false;
          handleImport();
        };
      } else {
        importButton.onclick = () => {
          closeImportModal();
        };
      }
    } else {
      throw new Error(result.error || 'Import failed');
    }
    
  } catch (error) {
    console.error('[IMPORT] Error:', error);
    statusDiv.style.display = 'block';
    statusDiv.className = 'import-status import-error';
    statusDiv.innerHTML = `
      <div class="import-error-message">
        <div class="import-error-header">Import Failed</div>
        <div class="import-error-text">${error.message}</div>
      </div>
    `;
    importButton.disabled = false;
    importButton.textContent = 'Import';
  }
}

// Export to window for global access
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.handleImport = handleImport;

