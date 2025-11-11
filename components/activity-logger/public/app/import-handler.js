/**
 * Import Handler Module
 * Handles opening shared workspaces and importing workspace data
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
    <div class="modal-content export-modal-content" style="max-width: 1200px;">
      <div class="modal-header">
        <h2>Open Shared Workspace</h2>
        <button class="modal-close" onclick="closeImportModal()">&times;</button>
      </div>
      <div class="modal-body export-modal-section">
        <!-- Use Cases / Workflow Explanation -->
        <div class="import-use-cases">
          <h3 class="card-title">How This Works</h3>
          <div class="use-cases-grid">
            <div class="use-case-item">
              <div class="use-case-title">Receive Shared Workspace</div>
              <div class="use-case-desc">Open a workspace that someone shared with you via a share link or file</div>
            </div>
            <div class="use-case-item">
              <div class="use-case-title">Collaborate with Team</div>
              <div class="use-case-desc">Import workspace data from teammates to see their activity and patterns</div>
            </div>
            <div class="use-case-item">
              <div class="use-case-title">Sync Across Devices</div>
              <div class="use-case-desc">Move your workspace data to a new machine or installation</div>
            </div>
            <div class="use-case-item">
              <div class="use-case-title">Restore from Backup</div>
              <div class="use-case-desc">Recover workspace data from a previously exported backup file</div>
            </div>
          </div>
        </div>
        
        <div class="import-section">
          <h3 class="card-title">Step 1: Select Shared Workspace File</h3>
          <div class="export-modal-field-group">
            <label class="form-label">Select shared workspace file:</label>
            <input type="file" id="importFileInput" accept=".json" class="form-input file-input">
            <div class="file-input-hint">Choose a workspace file that was shared with you, or exported from the "Export JSON" feature. You can also paste a share link URL.</div>
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
          <h3 class="card-title">Step 2: Configure Options</h3>
          
          <div class="export-modal-field-group">
            <label class="form-label">
              How to Handle Existing Data
              <span class="tooltip-icon" title="Determines how to handle workspace data that already exists in your dashboard">i</span>
            </label>
            <select id="importMergeStrategy" class="form-input">
              <option value="skip">Skip duplicates (recommended)</option>
              <option value="overwrite">Overwrite existing workspace data</option>
              <option value="merge">Merge with existing data</option>
              <option value="append">Add all (allow duplicates)</option>
            </select>
            <div class="merge-strategy-help">
              <div class="strategy-option" data-strategy="skip">
                <strong>Skip duplicates:</strong> Only add workspace data that doesn't already exist. Safe for opening shared workspaces.
              </div>
              <div class="strategy-option" data-strategy="overwrite">
                <strong>Overwrite existing:</strong> Replace your existing workspace data with the shared workspace data. Use when updating a workspace.
              </div>
              <div class="strategy-option" data-strategy="merge">
                <strong>Merge:</strong> Combine data from both your workspace and the shared workspace. Useful for combining multiple sources.
              </div>
              <div class="strategy-option" data-strategy="append">
                <strong>Append all:</strong> Add everything from the shared workspace, even if duplicates exist. Creates duplicate records.
              </div>
            </div>
          </div>
          
          <div class="export-modal-field-group">
            <label class="form-label">
              Workspace Filter (optional)
              <span class="tooltip-icon" title="Only import data for a specific workspace path">i</span>
            </label>
            <input type="text" id="importWorkspaceFilter" class="form-input" placeholder="Leave empty to import all workspaces">
            <div class="file-input-hint">Enter a workspace path to open only that workspace from the shared file. Leave empty to open all workspaces from the file.</div>
          </div>

          <div class="export-modal-field-group">
            <label class="form-label">
              Workspace Renaming (optional)
              <span class="tooltip-icon" title="Map imported workspace paths to your local paths">i</span>
            </label>
            <div id="workspaceMappingContainer" style="margin-top: var(--space-xs);">
              <div class="file-input-hint" style="margin-bottom: var(--space-xs);">
                Map shared workspace paths to your local workspace paths. Leave empty to keep the original paths from the shared workspace.
              </div>
              <div id="workspaceMappings" style="display: none;">
                <!-- Will be populated when file is selected -->
              </div>
            </div>
          </div>
          
          <div class="export-modal-checkbox-group">
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="importDryRun">
              <span>
                <strong>Preview only (validate without opening)</strong>
                <div class="description">See what would be opened without actually adding the workspace to your dashboard. Recommended when opening a workspace for the first time.</div>
              </span>
            </label>
          </div>
          
          <div class="import-warning-box" style="display: none;" id="overwriteWarning">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink: 0; margin-right: 8px; color: var(--color-warning);">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div>
              <strong>Warning:</strong> This will overwrite existing workspace data. Make sure you have a backup before proceeding.
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
          <button class="btn btn-primary" id="importButton" onclick="handleImport()" disabled>Open Workspace</button>
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
      importButton.textContent = 'Open Workspace';
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

    // Extract workspaces from import data for mapping
    const importWorkspaces = new Set();
    const data = importData.data || importData;
    if (data.entries) {
      data.entries.forEach(e => {
        const ws = e.workspace_path || e.workspacePath || e.workspace;
        if (ws) importWorkspaces.add(ws);
      });
    }
    if (data.prompts) {
      data.prompts.forEach(p => {
        const ws = p.workspace_path || p.workspacePath || p.workspaceId;
        if (ws) importWorkspaces.add(ws);
      });
    }
    
    // Show workspace mappings if workspaces found
    const workspaceMappingsDiv = document.getElementById('workspaceMappings');
    if (workspaceMappingsDiv && importWorkspaces.size > 0) {
      const importWorkspacesArray = Array.from(importWorkspaces).sort();
      workspaceMappingsDiv.style.display = 'block';
      workspaceMappingsDiv.innerHTML = importWorkspacesArray.map((importWs, idx) => {
        const displayName = importWs.split('/').pop() || importWs;
        const escapedWs = window.escapeHtml ? window.escapeHtml(importWs) : importWs;
        const escapedDisplay = window.escapeHtml ? window.escapeHtml(displayName) : displayName;
        return `
          <div style="display: flex; gap: var(--space-xs); align-items: center; margin-bottom: var(--space-xs); padding: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm);">
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: 2px;">${escapedDisplay}</div>
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapedWs}">${escapedWs}</div>
            </div>
            <div style="color: var(--color-text-muted);">→</div>
            <input type="text" 
                   class="form-input workspace-mapping-input" 
                   data-import-workspace="${escapedWs}"
                   placeholder="Local path (optional)"
                   style="flex: 1; font-size: var(--text-xs);">
          </div>
        `;
      }).join('');
    }

    // Data summary
    html += `
      <div class="schema-data-summary">
        <h4>Shared Workspace Contents</h4>
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
          Workspace file is valid and compatible. Ready to open.
        </div>
      `;
    }

    schemaContent.innerHTML = html;

    // Disable import button if there are errors
    const importButton = document.getElementById('importButton');
    if (importButton && compatibility.errors.length > 0) {
      importButton.disabled = true;
      importButton.title = 'Please fix schema errors before opening the workspace';
    } else if (importButton) {
      importButton.disabled = false;
      importButton.title = '';
    }

  } catch (error) {
    console.error('[IMPORT] Schema validation error:', error);
    schemaContent.innerHTML = `
      <div class="schema-error">
        <strong>Validation Error:</strong> ${error.message}
        <div class="schema-error-note">File structure could not be validated. The workspace may still open, but some data might not be available.</div>
      </div>
    `;
  }
}

/**
 * Handle the import process
 */
async function handleImport() {
  const fileInput = document.getElementById('importFileInput');
  const overwrite = document.getElementById('importOverwrite')?.checked || false;
  const dryRun = document.getElementById('importDryRun').checked;
  const workspaceFilter = document.getElementById('importWorkspaceFilter')?.value.trim() || null;
  const mergeStrategySelect = document.getElementById('importMergeStrategy');
  let mergeStrategy = mergeStrategySelect ? mergeStrategySelect.value : 'skip';
  
  // Legacy overwrite checkbox takes precedence
  if (overwrite && mergeStrategy !== 'append') {
    mergeStrategy = 'overwrite';
  }
  
  // Collect workspace mappings
  const workspaceMappings = {};
  const mappingInputs = document.querySelectorAll('.workspace-mapping-input');
  mappingInputs.forEach(input => {
    const importWs = input.getAttribute('data-import-workspace');
    const localWs = input.value.trim();
    if (importWs && localWs) {
      workspaceMappings[importWs] = localWs;
    }
  });
  
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
    importButton.textContent = 'Opening...';
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<div style="color: var(--color-info);">Reading workspace file...</div>';
    
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
    
    statusDiv.innerHTML = '<div style="color: var(--color-info);">Opening shared workspace...</div>';
    
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
          mergeStrategy,
          workspaceMappings: Object.keys(workspaceMappings).length > 0 ? workspaceMappings : undefined
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
            ${dryRun ? 'Preview completed' : 'Workspace opened successfully'}
          </div>
          <div class="import-success-text">
            ${result.message || 'The shared workspace has been added to your dashboard.'}
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
      
      importButton.textContent = dryRun ? 'Open Workspace' : 'Done';
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
        <div class="import-error-header">Failed to Open Workspace</div>
        <div class="import-error-text">${error.message}</div>
      </div>
    `;
    importButton.disabled = false;
    importButton.textContent = 'Open Workspace';
  }
}

// Export to window for global access
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.handleImport = handleImport;

