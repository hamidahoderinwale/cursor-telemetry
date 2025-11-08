/**
 * Import Handler Module
 * Handles importing/redeploying exported database data
 */

/**
 * Show import modal and handle file selection
 */
function showImportModal() {
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
        <p class="import-description">
          Import previously exported data to restore events, prompts, workspaces, and terminal commands.
          This allows you to redeploy data from another system or restore from a backup.
        </p>
        
        <div class="import-section">
          <h3 class="card-title">File Selection</h3>
          <div class="export-modal-field-group">
            <label class="form-label">Select exported JSON file:</label>
            <input type="file" id="importFileInput" accept=".json" class="form-input file-input">
            <div class="file-input-hint">Choose a file exported from the Export JSON feature</div>
          </div>
        </div>
        
        <div class="import-section">
          <h3 class="card-title">Import Options</h3>
          <div class="export-modal-checkbox-group">
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="importOverwrite">
              <span>
                <strong>Overwrite existing records</strong>
                <div class="description">If checked, existing records with the same ID will be replaced. If unchecked, duplicates will be skipped.</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="importDryRun">
              <span>
                <strong>Dry run (validate only)</strong>
                <div class="description">Test the import without actually importing data. Useful to check for errors before importing.</div>
              </span>
            </label>
          </div>
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
  
  fileInput.addEventListener('change', (e) => {
    const hasFile = e.target.files && e.target.files.length > 0;
    importButton.disabled = !hasFile;
    if (hasFile) {
      importButton.textContent = 'Import';
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
 * Handle the import process
 */
async function handleImport() {
  const fileInput = document.getElementById('importFileInput');
  const overwrite = document.getElementById('importOverwrite').checked;
  const dryRun = document.getElementById('importDryRun').checked;
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
          dryRun
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
      
      let statsHTML = `
        <div class="import-success-message">
          <div class="import-success-header">
            ${dryRun ? 'Dry run completed' : 'Import successful'}
          </div>
          <div class="import-success-text">
            ${result.message}
          </div>
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

