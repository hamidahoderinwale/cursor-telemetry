/**
 * Export Options Modal
 * Provides UI for configuring export parameters with procedural abstraction levels
 */

function showExportOptionsModal() {
  // Create modal if it doesn't exist
  let modal = document.getElementById('exportOptionsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exportOptionsModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  // Get current date for default range
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  modal.innerHTML = `
    <div class="modal-content export-modal-content">
      <div class="modal-header">
        <h2>Export Options</h2>
        <button class="modal-close" onclick="closeExportOptionsModal()">&times;</button>
      </div>
      
      <div class="modal-body export-modal-section">
        
        <!-- Date Range -->
        <div>
          <h3 class="card-title">Date Range</h3>
          <div class="export-modal-field-group">
            <div>
              <label class="form-label">From</label>
              <input type="date" id="exportDateFrom" class="form-input" value="${formatDate(oneWeekAgo)}">
            </div>
            <div>
              <label class="form-label">To</label>
              <input type="date" id="exportDateTo" class="form-input" value="${formatDate(today)}">
            </div>
          </div>
          <div class="export-modal-date-presets">
            <button class="btn btn-sm" onclick="setExportDateRange('today')">Today</button>
            <button class="btn btn-sm" onclick="setExportDateRange('week')">Last Week</button>
            <button class="btn btn-sm" onclick="setExportDateRange('month')">Last Month</button>
            <button class="btn btn-sm" onclick="setExportDateRange('all')">All Time</button>
          </div>
        </div>
        
        <!-- Workspace Selection -->
        <div>
          <h3 class="card-title">Workspace</h3>
          <div class="export-modal-field-group">
            <label class="form-label">
              Select workspaces to export
              <span class="tooltip-icon" title="Export activity for selected workspaces only">i</span>
            </label>
            <div id="exportWorkspaceSelector" class="workspace-selector-container">
              <div class="workspace-selector-checkbox-group">
                <label class="export-modal-checkbox-label">
                  <input type="checkbox" id="exportWorkspaceAll" checked onchange="toggleAllWorkspaces(this.checked)">
                  <span>
                    <strong>All Workspaces</strong>
                    <div class="description">Export data from all tracked workspaces</div>
                  </span>
                </label>
                <div style="margin-top: var(--space-xs);">
                  <button type="button" class="btn btn-sm" onclick="document.getElementById('exportWorkspaceAll').checked = false; toggleAllWorkspaces(false);" style="font-size: var(--text-xs);">
                    Select specific workspaces
                  </button>
                </div>
              </div>
              <div id="exportWorkspaceList" class="workspace-list-container" style="display: none; margin-top: var(--space-sm); max-height: 200px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-sm);">
                <!-- Workspace checkboxes will be populated here -->
              </div>
            </div>
          </div>
        </div>
        
        <!-- Data Types -->
        <div>
          <h3 class="card-title">Data Types</h3>
          <div class="export-modal-checkbox-group">
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportTypeEvents" checked>
              <span>
                <strong>File Changes</strong>
                <div class="description">Code changes, file edits</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportTypePrompts" checked>
              <span>
                <strong>AI Prompts</strong>
                <div class="description">Captured prompts and conversations</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportTypeTerminal" checked>
              <span>
                <strong>Terminal Commands</strong>
                <div class="description">Command line activity</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportTypeContext" checked>
              <span>
                <strong>Context Snapshots</strong>
                <div class="description">Workspace context data</div>
              </span>
            </label>
          </div>
        </div>
        
        <!-- NEW: Procedural Abstraction Level -->
        <div class="abstraction-level-section">
          <h3 class="card-title">
            Privacy-Expressiveness Level
            <span class="tooltip-icon" title="Controls how much detail is preserved vs. abstracted for privacy">[Info]</span>
          </h3>
          
          <div class="abstraction-level-selector">
            <div class="abstraction-spectrum">
              <div class="spectrum-bar">
                <div class="spectrum-indicator" id="abstractionIndicator"></div>
              </div>
              <div class="spectrum-labels">
                <span class="spectrum-label">Raw</span>
                <span class="spectrum-label">Code Abstracts</span>
                <span class="spectrum-label">Statement-Level</span>
                <span class="spectrum-label">Workflow-Level</span>
              </div>
            </div>
            
            <div class="abstraction-radio-group">
              <label class="abstraction-radio-label">
                <input type="radio" name="abstractionLevel" value="0" checked onchange="updateAbstractionLevel(0)">
                <div class="radio-content">
                  <strong>Level 0: Raw Traces</strong>
                  <div class="description">Full code diffs, explicit links, all metadata. Maximum expressiveness, minimum privacy.</div>
                  <div class="example">Example: Full before/after code, complete prompt text</div>
                </div>
              </label>
              
              <label class="abstraction-radio-label">
                <input type="radio" name="abstractionLevel" value="1" onchange="updateAbstractionLevel(1)">
                <div class="radio-content">
                  <strong>Level 1: Code Abstracts</strong>
                  <div class="description">Remove code content, preserve diff stats and metadata. Medium expressiveness, increased privacy.</div>
                  <div class="example">Example: "+150/-50 lines in auth.js" instead of full code</div>
                </div>
              </label>
              
              <label class="abstraction-radio-label">
                <input type="radio" name="abstractionLevel" value="2" onchange="updateAbstractionLevel(2)">
                <div class="radio-content">
                  <strong>Level 2: Statement-Level</strong>
                  <div class="description">Abstract changes to descriptions. Reduced expressiveness, high privacy.</div>
                  <div class="example">Example: "added error handling in authenticate()" not code</div>
                </div>
              </label>
              
              <label class="abstraction-radio-label">
                <input type="radio" name="abstractionLevel" value="3" onchange="updateAbstractionLevel(3)">
                <div class="radio-content">
                  <strong>Level 3: Workflow-Level</strong>
                  <div class="description">Extract reusable patterns only. Minimal expressiveness, maximum privacy.</div>
                  <div class="example">Example: "refactoring component" workflow template</div>
                </div>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Advanced Options (auto-enabled/disabled based on abstraction level) -->
        <div id="advancedOptionsSection">
          <h3 class="card-title">Advanced Options</h3>
          <div class="export-modal-checkbox-group">
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportIncludeCodeDiffs" checked>
              <span>
                <strong>Include Code Diffs</strong>
                <div class="description">Before/after code content (disabled at Level 1+)</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportIncludeLinkedData" checked>
              <span>
                <strong>Include Linked Data</strong>
                <div class="description">Prompt-code relationships (disabled at Level 3)</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportIncludeTemporalChunks" checked>
              <span>
                <strong>Include Temporal Chunks</strong>
                <div class="description">Time-grouped activity sessions (disabled at Level 3)</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportAbstractPrompts">
              <span>
                <strong>Abstract Prompt Text</strong>
                <div class="description">Replace prompts with descriptions (Level 2+)</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportExtractPatterns">
              <span>
                <strong>Extract Workflow Patterns</strong>
                <div class="description">Identify reusable workflow templates (Level 3)</div>
              </span>
            </label>
            <label class="export-modal-checkbox-label">
              <input type="checkbox" id="exportFullMetadata">
              <span>
                <strong>Full Metadata</strong>
                <div class="description">All fields (larger file, slower export)</div>
              </span>
            </label>
          </div>
        </div>
        
        <!-- Item Limit -->
        <div>
          <h3 class="card-title">Item Limit</h3>
          <input type="number" id="exportLimit" class="form-input" value="1000" min="100" max="10000" step="100">
          <div class="card-subtitle" style="margin-top: var(--space-xs);">
            Maximum items per type (recommended: 1000-5000)
          </div>
        </div>
        
      </div>
      
      <div class="export-modal-footer">
        <button class="btn btn-secondary" onclick="closeExportOptionsModal()">Cancel</button>
        <button class="btn btn-primary" onclick="executeExportWithOptions()">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"/>
          </svg>
          Export JSON
        </button>
      </div>
    </div>
  `;

  modal.classList.add('active');
  
  // Initialize abstraction level
  updateAbstractionLevel(0);
  
  // Load and populate workspaces
  loadWorkspacesForExport();
}

function loadWorkspacesForExport() {
  const workspaceList = document.getElementById('exportWorkspaceList');
  const allWorkspacesCheckbox = document.getElementById('exportWorkspaceAll');
  
  if (!workspaceList || !allWorkspacesCheckbox) return;
  
  // Get workspaces from state
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  // Collect unique workspaces
  const workspaces = new Set();
  events.forEach(e => {
    const ws = e.workspace_path || e.workspacePath || e.workspace;
    if (ws) workspaces.add(ws);
  });
  prompts.forEach(p => {
    const ws = p.workspace_path || p.workspacePath || p.workspaceId;
    if (ws) workspaces.add(ws);
  });
  
  const workspaceArray = Array.from(workspaces).sort();
  
  if (workspaceArray.length === 0) {
    workspaceList.innerHTML = '<div style="color: var(--color-text-muted); padding: var(--space-sm); text-align: center;">No workspaces found</div>';
    allWorkspacesCheckbox.disabled = true;
    return;
  }
  
  // Check if "All Workspaces" is checked
  const allWorkspacesChecked = allWorkspacesCheckbox.checked;
  
  // Populate workspace checkboxes
  workspaceList.innerHTML = workspaceArray.map(ws => {
    const displayName = ws.split('/').pop() || ws;
    const escapedWs = window.escapeHtml ? window.escapeHtml(ws) : ws;
    const escapedDisplay = window.escapeHtml ? window.escapeHtml(displayName) : displayName;
    return `
      <label class="export-modal-checkbox-label" style="margin-bottom: var(--space-xs);">
        <input type="checkbox" class="export-workspace-checkbox" value="${escapedWs}" ${allWorkspacesChecked ? 'disabled' : ''}>
        <span>
          <strong>${escapedDisplay}</strong>
          <div class="description" style="font-size: var(--text-xs); color: var(--color-text-muted);">${escapedWs}</div>
        </span>
      </label>
    `;
  }).join('');
  
  // Show/hide list based on "All Workspaces" state
  if (workspaceList) {
    workspaceList.style.display = allWorkspacesChecked ? 'none' : 'block';
  }
}

function toggleAllWorkspaces(checked) {
  const workspaceList = document.getElementById('exportWorkspaceList');
  const checkboxes = workspaceList?.querySelectorAll('.export-workspace-checkbox');
  
  if (checkboxes) {
    checkboxes.forEach(cb => {
      cb.disabled = checked;
      if (checked) {
        cb.checked = false; // Uncheck when "All Workspaces" is selected
      }
    });
  }
  
  if (workspaceList) {
    workspaceList.style.display = checked ? 'none' : 'block';
  }
}

function updateAbstractionLevel(level) {
  // Update spectrum indicator position
  const indicator = document.getElementById('abstractionIndicator');
  const positions = [10, 35, 65, 90]; // Percentage positions
  if (indicator) {
    indicator.style.left = positions[level] + '%';
  }
  
  // Auto-enable/disable advanced options based on level
  const codeDiffs = document.getElementById('exportIncludeCodeDiffs');
  const linkedData = document.getElementById('exportIncludeLinkedData');
  const temporalChunks = document.getElementById('exportIncludeTemporalChunks');
  const abstractPrompts = document.getElementById('exportAbstractPrompts');
  const extractPatterns = document.getElementById('exportExtractPatterns');
  
  if (codeDiffs) {
    codeDiffs.checked = level === 0;
    codeDiffs.disabled = level >= 1;
  }
  
  if (linkedData) {
    linkedData.checked = level < 3;
    linkedData.disabled = level >= 3;
  }
  
  if (temporalChunks) {
    temporalChunks.checked = level < 3;
    temporalChunks.disabled = level >= 3;
  }
  
  if (abstractPrompts) {
    abstractPrompts.checked = level >= 2;
    abstractPrompts.disabled = level < 2;
  }
  
  if (extractPatterns) {
    extractPatterns.checked = level === 3;
    extractPatterns.disabled = level < 3;
  }
}

function closeExportOptionsModal() {
  const modal = document.getElementById('exportOptionsModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function setExportDateRange(range) {
  const fromInput = document.getElementById('exportDateFrom');
  const toInput = document.getElementById('exportDateTo');
  
  if (!fromInput || !toInput) return;
  
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  let fromDate = new Date();
  
  switch (range) {
    case 'today':
      fromDate = new Date(today);
      fromDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      fromDate = new Date(0); // Epoch
      break;
  }
  
  fromInput.value = fromDate.toISOString().split('T')[0];
  toInput.value = today.toISOString().split('T')[0];
}

async function executeExportWithOptions() {
  const fromDate = document.getElementById('exportDateFrom').value;
  const toDate = document.getElementById('exportDateTo').value;
  const limit = parseInt(document.getElementById('exportLimit').value) || 1000;
  
  // Get abstraction level
  const abstractionLevel = parseInt(
    document.querySelector('input[name="abstractionLevel"]:checked')?.value || '0'
  );
  
  // Get workspace selection
  const allWorkspaces = document.getElementById('exportWorkspaceAll').checked;
  let selectedWorkspaces = null;
  
  if (!allWorkspaces) {
    const workspaceCheckboxes = document.querySelectorAll('.export-workspace-checkbox:checked');
    selectedWorkspaces = Array.from(workspaceCheckboxes).map(cb => cb.value);
    
    if (selectedWorkspaces.length === 0) {
      alert('Please select at least one workspace or choose "All Workspaces"');
      return;
    }
  }
  
  const types = {
    events: document.getElementById('exportTypeEvents').checked,
    prompts: document.getElementById('exportTypePrompts').checked,
    terminal: document.getElementById('exportTypeTerminal').checked,
    context: document.getElementById('exportTypeContext').checked
  };
  
  const options = {
    abstractionLevel: abstractionLevel,
    includeCodeDiffs: document.getElementById('exportIncludeCodeDiffs').checked,
    includeLinkedData: document.getElementById('exportIncludeLinkedData').checked,
    includeTemporalChunks: document.getElementById('exportIncludeTemporalChunks').checked,
    abstractPrompts: document.getElementById('exportAbstractPrompts').checked,
    extractPatterns: document.getElementById('exportExtractPatterns').checked,
    fullMetadata: document.getElementById('exportFullMetadata').checked,
    workspaces: selectedWorkspaces // Pass selected workspaces
  };
  
  closeExportOptionsModal();
  
  // Call the updated export function
  await window.exportDatabaseWithFilters({
    dateFrom: fromDate,
    dateTo: toDate,
    limit,
    types,
    options
  });
}

// Export to window for global access
window.showExportOptionsModal = showExportOptionsModal;
window.closeExportOptionsModal = closeExportOptionsModal;
window.setExportDateRange = setExportDateRange;
window.executeExportWithOptions = executeExportWithOptions;
window.updateAbstractionLevel = updateAbstractionLevel;
window.toggleAllWorkspaces = toggleAllWorkspaces;
