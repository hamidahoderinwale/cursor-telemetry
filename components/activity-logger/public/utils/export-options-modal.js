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
    <div class="modal-content export-modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h2>Export Options</h2>
        <button class="modal-close" onclick="closeExportOptionsModal()">&times;</button>
      </div>
      
      <div class="modal-body" style="padding: var(--space-md);">
        
        <!-- Compact Grid Layout -->
        <div style="display: grid; gap: var(--space-md);">
          
          <!-- Date Range - Compact -->
          <div>
            <label class="form-label" style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-xs); display: block;">Date Range</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--space-xs); align-items: end;">
              <div>
                <input type="date" id="exportDateFrom" class="form-input" value="${formatDate(oneWeekAgo)}" style="font-size: var(--text-sm);">
              </div>
              <div>
                <input type="date" id="exportDateTo" class="form-input" value="${formatDate(today)}" style="font-size: var(--text-sm);">
              </div>
              <div style="display: flex; gap: 2px;">
                <button class="btn btn-sm" onclick="setExportDateRange('week')" title="Last Week" style="padding: 6px 8px; font-size: 11px;">Week</button>
                <button class="btn btn-sm" onclick="setExportDateRange('month')" title="Last Month" style="padding: 6px 8px; font-size: 11px;">Month</button>
                <button class="btn btn-sm" onclick="setExportDateRange('all')" title="All Time" style="padding: 6px 8px; font-size: 11px;">All</button>
              </div>
            </div>
          </div>
          
          <!-- Workspace - Compact -->
          <div>
            <label class="form-label" style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-xs); display: block;">Workspace</label>
            <div id="exportWorkspaceSelector">
              <label style="display: flex; align-items: center; gap: var(--space-xs); cursor: pointer;">
                <input type="checkbox" id="exportWorkspaceAll" checked onchange="toggleAllWorkspaces(this.checked)">
                <span style="font-size: var(--text-sm);">All Workspaces</span>
              </label>
              <div id="exportWorkspaceList" style="display: none; margin-top: var(--space-xs); max-height: 150px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-xs);"></div>
              <button type="button" class="btn btn-sm" onclick="document.getElementById('exportWorkspaceAll').checked = false; toggleAllWorkspaces(false);" 
                      style="margin-top: var(--space-xs); font-size: var(--text-xs); padding: 4px 8px; display: none;" id="selectSpecificWorkspacesBtn">
                Select specific
              </button>
            </div>
          </div>
          
          <!-- Data Types - Compact Inline -->
          <div>
            <label class="form-label" style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-xs); display: block;">Data Types</label>
            <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm);">
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                <input type="checkbox" id="exportTypeEvents" checked>
                <span>File Changes</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                <input type="checkbox" id="exportTypePrompts" checked>
                <span>AI Prompts</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                <input type="checkbox" id="exportTypeTerminal" checked>
                <span>Terminal</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                <input type="checkbox" id="exportTypeContext" checked>
                <span>Context</span>
              </label>
            </div>
          </div>
          
          <!-- Privacy Level - Compact Dropdown -->
          <div>
            <label class="form-label" style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-xs); display: flex; align-items: center; gap: var(--space-xs);">
              Privacy Level
              <span style="color: var(--color-text-muted); font-size: 10px; font-weight: normal;" title="Higher levels remove code content for privacy">(0=Raw, 3=Max Privacy)</span>
            </label>
            <select id="exportAbstractionLevel" class="form-input" onchange="updateAbstractionLevelFromSelect(this.value)" style="font-size: var(--text-sm);">
              <option value="0">Level 0: Raw (Full code, all metadata)</option>
              <option value="1" selected>Level 1: Abstracts (Stats only, no code)</option>
              <option value="2">Level 2: Statements (Descriptions only)</option>
              <option value="3">Level 3: Workflows (Patterns only)</option>
            </select>
            <div id="privacyLevelHint" style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 4px;"></div>
          </div>
          
          <!-- Item Limit - Compact -->
          <div>
            <label class="form-label" style="font-size: var(--text-sm); font-weight: 600; margin-bottom: var(--space-xs); display: block;">
              Item Limit
              <span style="font-weight: normal; color: var(--color-text-muted);">(per type)</span>
            </label>
            <input type="number" id="exportLimit" class="form-input" value="1000" min="100" max="10000" step="100" style="font-size: var(--text-sm); width: 120px;">
          </div>
          
          <!-- Advanced Options - Collapsible -->
          <div>
            <button type="button" class="btn btn-sm" onclick="toggleAdvancedOptions()" id="advancedOptionsToggle" 
                    style="font-size: var(--text-xs); padding: 4px 8px; color: var(--color-text-muted);">
              <span id="advancedOptionsToggleText">▼</span> Advanced Options
            </button>
            <div id="advancedOptionsSection" style="display: none; margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
              <div style="display: grid; gap: var(--space-xs);">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                  <input type="checkbox" id="exportIncludeCodeDiffs" checked>
                  <span>Code Diffs</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                  <input type="checkbox" id="exportIncludeLinkedData" checked>
                  <span>Linked Data</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                  <input type="checkbox" id="exportIncludeTemporalChunks" checked>
                  <span>Temporal Chunks</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                  <input type="checkbox" id="exportAbstractPrompts">
                  <span>Abstract Prompts</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                  <input type="checkbox" id="exportExtractPatterns">
                  <span>Extract Patterns</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm);">
                  <input type="checkbox" id="exportFullMetadata">
                  <span>Full Metadata</span>
                </label>
              </div>
            </div>
          </div>
          
        </div>
        
      </div>
      
      <div class="export-modal-footer">
        <button class="btn btn-secondary" onclick="closeExportOptionsModal()">Cancel</button>
        <button class="btn" onclick="shareFromExportModal()" style="margin-right: var(--space-xs);">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
          </svg>
          Share
        </button>
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
  
  // Initialize abstraction level (default to 1)
  updateAbstractionLevelFromSelect('1');
  
  // Load and populate workspaces
  loadWorkspacesForExport();
  
  // Show "Select specific" button if workspaces exist
  setTimeout(() => {
    const workspaceList = document.getElementById('exportWorkspaceList');
    const selectBtn = document.getElementById('selectSpecificWorkspacesBtn');
    if (workspaceList && workspaceList.children.length > 0 && selectBtn) {
      selectBtn.style.display = 'inline-block';
    }
  }, 100);
}

function toggleAdvancedOptions() {
  const section = document.getElementById('advancedOptionsSection');
  const toggle = document.getElementById('advancedOptionsToggleText');
  if (section) {
    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';
    if (toggle) {
      toggle.textContent = isVisible ? '▼' : '▲';
    }
  }
}

function updateAbstractionLevelFromSelect(level) {
  const levelNum = parseInt(level);
  const radio = document.querySelector(`input[name="abstractionLevel"][value="${levelNum}"]`);
  if (radio) {
    radio.checked = true;
  }
  updateAbstractionLevel(levelNum);
  
  // Update hint
  const hints = {
    0: 'Full code diffs, all metadata',
    1: 'Stats only, no code content',
    2: 'Descriptions only, high privacy',
    3: 'Patterns only, maximum privacy'
  };
  const hintEl = document.getElementById('privacyLevelHint');
  if (hintEl) {
    hintEl.textContent = hints[levelNum] || '';
  }
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
  
  // Populate workspace checkboxes (compact)
  workspaceList.innerHTML = workspaceArray.map(ws => {
    const displayName = ws.split('/').pop() || ws;
    const escapedWs = window.escapeHtml ? window.escapeHtml(ws) : ws;
    const escapedDisplay = window.escapeHtml ? window.escapeHtml(displayName) : displayName;
    return `
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm); padding: 4px 0;">
        <input type="checkbox" class="export-workspace-checkbox" value="${escapedWs}" ${allWorkspacesChecked ? 'disabled' : ''}>
        <span title="${escapedWs}">${escapedDisplay}</span>
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
  
  // Get abstraction level from select or radio
  const selectEl = document.getElementById('exportAbstractionLevel');
  const abstractionLevel = selectEl ? parseInt(selectEl.value) : 
    parseInt(document.querySelector('input[name="abstractionLevel"]:checked')?.value || '0');
  
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
function shareFromExportModal() {
  // Get selected workspaces from export modal
  const allWorkspaces = document.getElementById('exportWorkspaceAll');
  let workspaces = [];
  
  if (allWorkspaces && allWorkspaces.checked) {
    // Get all workspaces
    const events = window.state?.data?.events || [];
    const prompts = window.state?.data?.prompts || [];
    const allWorkspacesSet = new Set();
    events.forEach(e => {
      const ws = e.workspace_path || e.workspacePath || e.workspace;
      if (ws) allWorkspacesSet.add(ws);
    });
    prompts.forEach(p => {
      const ws = p.workspace_path || p.workspacePath || p.workspaceId;
      if (ws) allWorkspacesSet.add(ws);
    });
    workspaces = Array.from(allWorkspacesSet);
  } else {
    const workspaceCheckboxes = document.querySelectorAll('.export-workspace-checkbox:checked');
    workspaces = Array.from(workspaceCheckboxes).map(cb => cb.value);
  }
  
  // Close export modal
  closeExportOptionsModal();
  
  // Open share modal
  if (window.showShareModal) {
    setTimeout(() => {
      window.showShareModal(workspaces);
    }, 100);
  }
}

window.showExportOptionsModal = showExportOptionsModal;
window.closeExportOptionsModal = closeExportOptionsModal;
window.setExportDateRange = setExportDateRange;
window.executeExportWithOptions = executeExportWithOptions;
window.updateAbstractionLevel = updateAbstractionLevel;
window.updateAbstractionLevelFromSelect = updateAbstractionLevelFromSelect;
window.toggleAllWorkspaces = toggleAllWorkspaces;
window.toggleAdvancedOptions = toggleAdvancedOptions;
window.shareFromExportModal = shareFromExportModal;
