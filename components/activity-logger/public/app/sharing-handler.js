/**
 * Sharing Handler Module
 * Handles workspace sharing via shareable links
 */

/**
 * Load all available workspaces from telemetry data
 */
function getAllAvailableWorkspaces() {
  const workspaces = new Set();
  
  // Get from events
  const events = window.state?.data?.events || [];
  events.forEach(e => {
    const ws = e.workspace_path || e.workspacePath || e.workspace;
    if (ws) workspaces.add(ws);
  });
  
  // Get from prompts
  const prompts = window.state?.data?.prompts || [];
  prompts.forEach(p => {
    const ws = p.workspace_path || p.workspacePath || p.workspaceId || p.workspaceName;
    if (ws) workspaces.add(ws);
  });
  
  // Get from entries
  const entries = window.state?.data?.entries || [];
  entries.forEach(e => {
    const ws = e.workspace_path || e.workspacePath || e.workspace;
    if (ws) workspaces.add(ws);
  });
  
  // Get from state workspaces if available
  const stateWorkspaces = window.state?.data?.workspaces || [];
  stateWorkspaces.forEach(ws => {
    const wsPath = ws.path || ws.id || ws.workspace_path;
    if (wsPath) workspaces.add(wsPath);
  });
  
  return Array.from(workspaces).sort();
}

/**
 * Show share modal for workspace(s)
 */
async function showShareModal(workspaces = null) {
  // If no workspaces provided, get from export modal or current selection
  let selectedWorkspaces = [];
  if (!workspaces) {
    // Try to get from export modal if open
    const exportWorkspaceAll = document.getElementById('exportWorkspaceAll');
    const exportWorkspaceCheckboxes = document.querySelectorAll('.export-workspace-checkbox:checked');
    
    if (exportWorkspaceAll && exportWorkspaceAll.checked) {
      selectedWorkspaces = getAllAvailableWorkspaces();
    } else if (exportWorkspaceCheckboxes.length > 0) {
      selectedWorkspaces = Array.from(exportWorkspaceCheckboxes).map(cb => cb.value);
    } else {
      // Get current workspace filter
      const currentWorkspace = window.state?.currentWorkspace;
      if (currentWorkspace && currentWorkspace !== 'all') {
        selectedWorkspaces = [currentWorkspace];
      }
    }
  } else {
    selectedWorkspaces = Array.isArray(workspaces) ? workspaces : [workspaces];
  }

  // Get all available workspaces for selection
  const allWorkspaces = getAllAvailableWorkspaces();

  // Check if modal already exists and remove it
  const existingModal = document.getElementById('shareModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = document.createElement('div');
  modal.id = 'shareModal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content export-modal-content">
      <div class="modal-header">
        <h2>Share Workspace Data</h2>
        <button class="modal-close" onclick="closeShareModal()">&times;</button>
      </div>
      <div class="modal-body export-modal-section">
        
        <!-- Feature Explanation -->
        <div style="margin-bottom: var(--space-lg); padding: var(--space-md); background: var(--color-bg-alt); border-radius: 0(--radius-md); border-left: 3px solid var(--color-primary);">
          <h3 style="margin-bottom: var(--space-xs); font-size: var(--text-base); display: flex; align-items: center; gap: var(--space-xs);">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="color: var(--color-primary);">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            How Workspace Sharing Works
          </h3>
          <p style="font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.6; margin: 0;">
            Create secure, shareable links to your workspace data. Recipients can view your analytics, activity patterns, and metrics without needing access to your local files. 
            <strong style="color: var(--color-text);">Privacy controls</strong> let you choose how much detail to share (from full code traces to high-level patterns only). 
            Links can be set to expire automatically, and you can filter by date ranges to share specific time periods. 
            Perfect for <strong style="color: var(--color-text);">team collaboration</strong>, <strong style="color: var(--color-text);">project showcases</strong>, or <strong style="color: var(--color-text);">sharing progress</strong> with stakeholders.
          </p>
        </div>
        
        <!-- Workspace Selection -->
        <div>
          <h3 class="card-title">
            Workspaces to Share
            <span class="tooltip-icon" title="Select one or more workspaces to include in the share link. Only data from selected workspaces will be shared. You can select all workspaces or choose specific ones. The preview below shows how much data will be included.">i</span>
          </h3>
          ${allWorkspaces.length === 0 ? `
            <div style="color: var(--color-text-muted); padding: var(--space-sm); text-align: center; border: 1px solid var(--color-border); border-radius: 0(--radius-md);">
              No workspaces found in telemetry data
            </div>
          ` : `
            <div style="margin-bottom: var(--space-sm);">
              <label class="export-modal-checkbox-label" style="display: flex; align-items: center; gap: var(--space-xs); padding: var(--space-xs); cursor: pointer;">
                <input type="checkbox" id="shareWorkspaceAll" ${selectedWorkspaces.length === allWorkspaces.length ? 'checked' : ''} onchange="toggleAllShareWorkspaces(this.checked)">
                <span><strong>Select All Workspaces</strong></span>
              </label>
            </div>
            <div id="shareWorkspaceList" class="workspace-list-container" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 0(--radius-md); padding: var(--space-sm);">
              ${allWorkspaces.map(ws => {
                const displayName = ws.split('/').pop() || ws;
                const escapedWs = window.escapeHtml ? window.escapeHtml(ws) : ws;
                const escapedDisplay = window.escapeHtml ? window.escapeHtml(displayName) : displayName;
                const isSelected = selectedWorkspaces.includes(ws);
                return `
                  <label class="export-modal-checkbox-label" style="display: flex; align-items: flex-start; gap: var(--space-xs); padding: var(--space-xs); border-bottom: 1px solid var(--color-border); cursor: pointer; margin-bottom: 0;">
                    <input type="checkbox" class="share-workspace-checkbox" value="${escapedWs}" ${isSelected ? 'checked' : ''} onchange="updateShareWorkspaceSelection()">
                    <span style="flex: 1;">
                      <strong>${escapedDisplay}</strong>
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted);">${escapedWs}</div>
                    </span>
                  </label>
                `;
              }).join('')}
            </div>
            <div id="shareWorkspaceCount" style="margin-top: var(--space-xs); font-size: var(--text-sm); color: var(--color-text-muted);">
              ${selectedWorkspaces.length} of ${allWorkspaces.length} workspace${allWorkspaces.length !== 1 ? 's' : ''} selected
            </div>
          `}
        </div>

        <!-- Privacy Level -->
        <div>
          <h3 class="card-title">
            Privacy Level
            <span class="tooltip-icon" title="Controls how much detail is shared. Level 0: Full code diffs and all metadata (use only for trusted recipients). Level 1: Metrics and statistics without code content (recommended for most sharing). Level 2: High-level descriptions only. Level 3: Workflow patterns only (maximum privacy).">i</span>
          </h3>
          <div class="export-modal-field-group">
            <select id="shareAbstractionLevel" class="form-input" onchange="updateSharePreview()">
              <option value="0" data-desc="Includes full code diffs, file contents, and all metadata. Use only for trusted recipients.">Level 0: Raw Traces (Full code diffs, all metadata)</option>
              <option value="1" selected data-desc="Preserves metrics, statistics, and file relationships without exposing actual code content. Recommended for most sharing.">Level 1: Code Abstracts (Stats only, no code content)</option>
              <option value="2" data-desc="Only high-level descriptions of changes and patterns. No code or detailed metrics.">Level 2: Statement-Level (Descriptions only)</option>
              <option value="3" data-desc="Only workflow patterns and trends. Minimal detail, maximum privacy.">Level 3: Workflow-Level (Patterns only)</option>
            </select>
            <div id="abstractionLevelDesc" class="file-input-hint" style="margin-top: var(--space-xs); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: 0(--radius-sm);">
              Preserves metrics, statistics, and file relationships without exposing actual code content. Recommended for most sharing.
            </div>
          </div>
        </div>

        <!-- Date Range Filter -->
        <div>
          <h3 class="card-title">
            Date Range (Optional)
            <span class="tooltip-icon" title="Limit sharing to data within a specific time range. Useful for sharing recent work, specific project phases, or limiting data exposure. Leave empty to share all historical data.">i</span>
          </h3>
          <div class="export-modal-field-group">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
              <div>
                <label class="form-label" style="font-size: var(--text-xs);">From Date</label>
                <input type="date" id="shareDateFrom" class="form-input" onchange="updateSharePreview()">
              </div>
              <div>
                <label class="form-label" style="font-size: var(--text-xs);">To Date</label>
                <input type="date" id="shareDateTo" class="form-input" onchange="updateSharePreview()">
              </div>
            </div>
            <div class="file-input-hint">
              Leave empty to share all data. Date range helps limit what's shared for privacy or relevance.
            </div>
          </div>
        </div>

        <!-- Custom Name/Description -->
        <div>
          <h3 class="card-title">
            Share Link Name (Optional)
            <span class="tooltip-icon" title="Give your share link a friendly name to help identify it later. This name appears in your share links list and makes it easier to manage multiple shared workspaces. Examples: 'Project Alpha - Q4 2024', 'Team Demo - Sprint 3', 'Client Progress Report'.">i</span>
          </h3>
          <div class="export-modal-field-group">
            <input type="text" id="shareLinkName" class="form-input" placeholder="e.g., Project Alpha - Q4 2024" maxlength="100">
            <div class="file-input-hint">
              Optional name to help identify this share link in your list.
            </div>
          </div>
        </div>

        <!-- Expiration -->
        <div>
          <h3 class="card-title">
            Link Expiration
            <span class="tooltip-icon" title="Set when the share link will automatically expire. Expired links cannot be accessed. Use shorter expiration for sensitive data or temporary sharing. Use 'Never expire' for permanent documentation or long-term collaboration. You can always delete links manually from the 'Manage Links' button.">i</span>
          </h3>
          <div class="export-modal-field-group">
            <select id="shareExpirationDays" class="form-input" onchange="updateSharePreview()">
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7" selected>7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="0">Never expire</option>
            </select>
            <div class="file-input-hint">
              Share link will automatically expire after this time. Choose "Never expire" for permanent links. You can delete links manually anytime from the "Manage Links" button.
            </div>
          </div>
        </div>

        <!-- Share Preview -->
        <div id="sharePreview" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: var(--color-bg-alt); border-radius: 0(--radius-md); border: 1px solid var(--color-border);">
          <h4 style="margin-bottom: var(--space-sm); font-size: var(--text-base);">Share Preview</h4>
          <div id="sharePreviewContent" style="font-size: var(--text-sm); color: var(--color-text-muted);">
            <!-- Preview will be populated by updateSharePreview() -->
          </div>
        </div>

        <!-- Share Link Result -->
        <div id="shareLinkResult" style="display: none; margin-top: var(--space-md);">
          <div class="card" style="background: var(--color-bg-alt);">
            <div class="card-body">
              <h4 style="margin-bottom: var(--space-sm); display: flex; align-items: center; gap: var(--space-xs);">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="color: var(--color-success);">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                Shareable Link Created
              </h4>
              <div style="display: flex; gap: var(--space-sm); align-items: flex-start; margin-bottom: var(--space-sm);">
                <div style="flex: 1;">
                  <div style="display: flex; gap: var(--space-xs); align-items: center; margin-bottom: var(--space-xs);">
                    <input type="text" id="shareLinkInput" class="form-input" readonly style="flex: 1; font-family: monospace; font-size: var(--text-sm);">
                    <button class="btn btn-sm" onclick="copyShareLink()" id="copyShareLinkBtn" title="Copy link to clipboard">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                      </svg>
                      Copy
                    </button>
                  </div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                    <div>Expires: <span id="shareLinkExpires"></span></div>
                    <div style="margin-top: var(--space-xs);">Anyone with this link can access the workspace data.</div>
                  </div>
                </div>
                <div id="shareQRCode" style="flex-shrink: 0; padding: var(--space-sm); background: white; border-radius: 0(--radius-sm); border: 1px solid var(--color-border);">
                  <!-- QR code will be generated here if library available -->
                </div>
              </div>
              <div style="margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
                <button class="btn btn-sm btn-secondary" onclick="viewShareLinks()" style="margin-right: var(--space-xs);">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                  </svg>
                  Manage Links
                </button>
                <button class="btn btn-sm btn-secondary" onclick="testShareLink()">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd"/>
                  </svg>
                  Test Link
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div id="shareError" style="display: none; margin-top: var(--space-md); padding: var(--space-sm); background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: 0(--radius-md); color: var(--color-error);">
        </div>
        
      </div>
      
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeShareModal()">Cancel</button>
        <button class="btn btn-primary" id="createShareLinkBtn" onclick="createShareLink()" ${selectedWorkspaces.length === 0 ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
          </svg>
          Create Share Link
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Store selected workspaces for later use
  modal._selectedWorkspaces = selectedWorkspaces;
  modal._allWorkspaces = allWorkspaces;
  
  // Update preview after modal is rendered
  setTimeout(() => {
    updateSharePreview();
  }, 100);
  
  // Close on overlay click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeShareModal();
    }
  });
  
  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeShareModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

/**
 * Close share modal
 */
function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Toggle all workspaces selection
 */
function toggleAllShareWorkspaces(checked) {
  const checkboxes = document.querySelectorAll('.share-workspace-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    cb.disabled = checked;
  });
  updateShareWorkspaceSelection();
}

/**
 * Update workspace selection count and button state
 */
function updateShareWorkspaceSelection() {
  const checkboxes = document.querySelectorAll('.share-workspace-checkbox:checked');
  const count = checkboxes.length;
  const total = document.querySelectorAll('.share-workspace-checkbox').length;
  
  const countDiv = document.getElementById('shareWorkspaceCount');
  if (countDiv) {
    countDiv.textContent = `${count} of ${total} workspace${total !== 1 ? 's' : ''} selected`;
  }
  
  const createBtn = document.getElementById('createShareLinkBtn');
  if (createBtn) {
    createBtn.disabled = count === 0;
  }
  
  // Update "Select All" checkbox
  const selectAll = document.getElementById('shareWorkspaceAll');
  if (selectAll) {
    selectAll.checked = count === total;
    selectAll.indeterminate = count > 0 && count < total;
  }
  
  // Update preview
  updateSharePreview();
}

/**
 * Update share preview with estimated data
 */
async function updateSharePreview() {
  const previewDiv = document.getElementById('sharePreview');
  const previewContent = document.getElementById('sharePreviewContent');
  if (!previewDiv || !previewContent) return;
  
  const checkboxes = document.querySelectorAll('.share-workspace-checkbox:checked');
  const workspaces = Array.from(checkboxes).map(cb => cb.value);
  
  if (workspaces.length === 0) {
    previewDiv.style.display = 'none';
    return;
  }
  
  previewDiv.style.display = 'block';
  
  // Calculate preview stats
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  const filteredEvents = events.filter(e => {
    const ws = e.workspace_path || e.workspacePath || e.workspace;
    return workspaces.includes(ws);
  });
  
  const filteredPrompts = prompts.filter(p => {
    const ws = p.workspace_path || p.workspacePath || p.workspaceId || p.workspaceName;
    return workspaces.includes(ws);
  });
  
  const abstractionLevel = parseInt(document.getElementById('shareAbstractionLevel')?.value || '1');
  const expirationDays = parseInt(document.getElementById('shareExpirationDays')?.value || '7');
  const dateFrom = document.getElementById('shareDateFrom')?.value;
  const dateTo = document.getElementById('shareDateTo')?.value;
  
  // Estimate data size (rough calculation)
  const avgEventSize = 500; // bytes
  const avgPromptSize = abstractionLevel === 0 ? 2000 : abstractionLevel === 1 ? 500 : 200;
  const estimatedSize = (filteredEvents.length * avgEventSize + filteredPrompts.length * avgPromptSize) / 1024; // KB
  
  const expirationText = expirationDays === 0 ? 'Never' : expirationDays === 1 ? '1 day' : expirationDays < 30 ? `${expirationDays} days` : expirationDays < 365 ? `${Math.round(expirationDays / 30)} months` : `${Math.round(expirationDays / 365)} year${Math.round(expirationDays / 365) > 1 ? 's' : ''}`;
  
  previewContent.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-sm); margin-bottom: var(--space-sm);">
      <div>
        <div style="font-weight: 600; color: var(--color-text);">Workspaces</div>
        <div style="font-size: var(--text-lg); color: var(--color-primary);">${workspaces.length}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: var(--color-text);">Events</div>
        <div style="font-size: var(--text-lg); color: var(--color-primary);">${filteredEvents.length.toLocaleString()}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: var(--color-text);">Prompts</div>
        <div style="font-size: var(--text-lg); color: var(--color-primary);">${filteredPrompts.length.toLocaleString()}</div>
      </div>
      <div>
        <div style="font-weight: 600; color: var(--color-text);">Est. Size</div>
        <div style="font-size: var(--text-lg); color: var(--color-primary);">${estimatedSize.toFixed(1)} KB</div>
      </div>
    </div>
    <div style="font-size: var(--text-xs); color: var(--color-text-muted); line-height: 1.6;">
      <div><strong>Privacy Level:</strong> ${document.getElementById('shareAbstractionLevel')?.selectedOptions[0]?.text || 'Level 1'}</div>
      <div><strong>Expires:</strong> ${expirationText}</div>
      ${dateFrom || dateTo ? `<div><strong>Date Range:</strong> ${dateFrom || 'Start'} to ${dateTo || 'End'}</div>` : ''}
    </div>
  `;
  
  // Update abstraction level description
  const descDiv = document.getElementById('abstractionLevelDesc');
  const selectedOption = document.getElementById('shareAbstractionLevel')?.selectedOptions[0];
  if (descDiv && selectedOption) {
    const desc = selectedOption.getAttribute('data-desc') || '';
    descDiv.textContent = desc;
  }
}

/**
 * Create share link
 */
async function createShareLink() {
  const modal = document.getElementById('shareModal');
  if (!modal) return;
  
  // Get selected workspaces from checkboxes
  const checkboxes = document.querySelectorAll('.share-workspace-checkbox:checked');
  const workspaces = Array.from(checkboxes).map(cb => cb.value);
  
  // Fallback to stored workspaces if no checkboxes found
  const workspaces_fallback = modal._selectedWorkspaces || [];
  const finalWorkspaces = workspaces.length > 0 ? workspaces : workspaces_fallback;
  const abstractionLevel = parseInt(document.getElementById('shareAbstractionLevel').value) || 1;
  const expirationDays = parseInt(document.getElementById('shareExpirationDays').value) || 7;
  const linkName = document.getElementById('shareLinkName')?.value?.trim() || null;
  const dateFrom = document.getElementById('shareDateFrom')?.value || null;
  const dateTo = document.getElementById('shareDateTo')?.value || null;
  
  const createBtn = document.getElementById('createShareLinkBtn');
  const errorDiv = document.getElementById('shareError');
  const resultDiv = document.getElementById('shareLinkResult');
  
  if (finalWorkspaces.length === 0) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Please select at least one workspace to share';
    return;
  }
  
  // Validate date range
  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'From date must be before To date';
    return;
  }
  
  try {
    createBtn.disabled = true;
    createBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="animation: spin 1s linear infinite;"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg> Creating...';
    errorDiv.style.display = 'none';
    resultDiv.style.display = 'none';
    
    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    
    const response = await fetch(`${window.CONFIG.API_BASE}/api/share/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspaces: finalWorkspaces,
        abstractionLevel,
        expirationDays,
        filters,
        name: linkName
      })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to create share link');
    }
    
    // Display share link - use full URL with share parameter for easier sharing
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${result.shareId}`;
    const shareLinkInput = document.getElementById('shareLinkInput');
    if (shareLinkInput) {
      shareLinkInput.value = shareUrl;
    }
    const expiresEl = document.getElementById('shareLinkExpires');
    if (expiresEl) {
      expiresEl.textContent = result.expiresAt ? new Date(result.expiresAt).toLocaleString() : 'Never';
    }
    resultDiv.style.display = 'block';
    
    // Generate QR code if library available
    const qrContainer = document.getElementById('shareQRCode');
    if (qrContainer) {
      // Check if QR code library is available
      if (typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        QRCode.toCanvas(qrContainer, shareUrl, { width: 200, margin: 2 }, (error) => {
          if (error) {
            qrContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: var(--text-xs);">QR code unavailable</div>';
          }
        });
      } else {
        qrContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: var(--text-xs);">QR code library not loaded</div>';
      }
    }
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    createBtn.disabled = false;
    createBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg> Create Share Link';
    
  } catch (error) {
    console.error('[SHARING] Error creating share link:', error);
    errorDiv.style.display = 'block';
    errorDiv.textContent = error.message || 'Failed to create share link';
    createBtn.disabled = false;
    createBtn.textContent = 'Create Share Link';
  }
}

/**
 * Copy share link to clipboard
 */
async function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  if (!input) return;
  
  try {
    await navigator.clipboard.writeText(input.value);
    const btn = document.getElementById('copyShareLinkBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Copied!';
    btn.style.color = 'var(--color-success)';
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.color = '';
    }, 2000);
  } catch (error) {
    // Fallback: select text
    input.select();
    document.execCommand('copy');
  }
}

/**
 * Handle share link import (when user visits a share link)
 */
async function handleShareLinkImport(shareId) {
  try {
    // Get share link info first
    const infoResponse = await fetch(`${window.CONFIG.API_BASE}/api/share/${shareId}/info`);
    const info = await infoResponse.json();
    
    if (!info.success) {
      throw new Error(info.error || 'Share link not found');
    }
    
    // Show import modal with share link pre-filled
    if (window.showImportModal) {
      // Close any existing modals
      const existingModal = document.getElementById('importModal');
      if (existingModal) existingModal.remove();
      
      // Show import modal
      await window.showImportModal();
      
      // Pre-fill with share link data
      setTimeout(() => {
        const importFileInput = document.getElementById('importFileInput');
        if (importFileInput) {
          // Trigger import from share link
          importFromShareLink(shareId);
        }
      }, 100);
    } else {
      // Fallback: direct import
      await importFromShareLink(shareId);
    }
  } catch (error) {
    console.error('[SHARING] Error importing from share link:', error);
    alert(`Failed to import from share link: ${error.message}`);
  }
}

/**
 * Import data from share link
 */
async function importFromShareLink(shareId) {
  try {
    // Fetch data from share link
    const response = await fetch(`${window.CONFIG.API_BASE}/api/share/${shareId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch shared data');
    }
    
    const importData = await response.json();
    
    // Use existing import handler
    if (window.handleImport) {
      // Create a temporary file input with the data
      const blob = new Blob([JSON.stringify(importData)], { type: 'application/json' });
      const file = new File([blob], `shared-workspace-${shareId}.json`, { type: 'application/json' });
      
      // Trigger import
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const importFileInput = document.getElementById('importFileInput');
      if (importFileInput) {
        importFileInput.files = dataTransfer.files;
        importFileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      // Direct API import
      await fetch(`${window.CONFIG.API_BASE}/api/import/database`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: importData,
          options: {
            mergeStrategy: 'skip',
            dryRun: false
          }
        })
      });
      
      alert('Workspace data imported successfully!');
      if (window.fetchRecentData) {
        await window.fetchRecentData();
        if (window.renderCurrentView) window.renderCurrentView();
      }
    }
  } catch (error) {
    console.error('[SHARING] Error importing from share link:', error);
    alert(`Failed to import: ${error.message}`);
  }
}

/**
 * View and manage all share links
 * Shows account-linked shares if authenticated
 */
async function viewShareLinks() {
  try {
    const response = await fetch(`${window.CONFIG.API_BASE}/api/share`);
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to load share links');
    }
    
    const links = result.links || [];
    
    // Create modal to display links
    const modal = document.createElement('div');
    modal.id = 'shareLinksModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content export-modal-content" style="max-width: 800px;">
        <div class="modal-header">
          <h2>Manage Share Links</h2>
          <button class="modal-close" onclick="closeShareLinksModal()">&times;</button>
        </div>
        <div class="modal-body export-modal-section">
          ${links.length === 0 ? `
            <div style="text-align: center; padding: var(--space-xl); color: var(--color-text-muted);">
              <div style="font-size: 48px; margin-bottom: var(--space-md); opacity: 0.5;">[Link]</div>
              <div>No share links created yet</div>
            </div>
          ` : `
            <div id="shareLinksList" style="display: flex; flex-direction: column; gap: var(--space-sm);">
              ${links.map(link => `
                <div class="card" style="padding: var(--space-md);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-md);">
                    <div style="flex: 1;">
                      <div style="font-weight: 600; margin-bottom: var(--space-xs);">${link.name || 'Unnamed Share Link'}</div>
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted); font-family: monospace; margin-bottom: var(--space-xs); word-break: break-all;">
                        ${window.location.origin}${window.location.pathname}?share=${link.shareId}
                      </div>
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted);">
                        ${link.account_linked ? '<div style="color: var(--color-primary); margin-bottom: 4px;"><svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="vertical-align: middle; margin-right: 4px;"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg> Account-linked</div>' : ''}
                        <div>Workspaces: ${link.workspaces?.length || 0}</div>
                        <div>Created: ${new Date(link.createdAt).toLocaleString()}</div>
                        <div>Expires: ${link.isExpired ? '<span style="color: var(--color-error);">Expired</span>' : link.expiresAt ? new Date(link.expiresAt).toLocaleString() : 'Never'}</div>
                        <div>Accesses: ${link.accessCount || 0}</div>
                      </div>
                    </div>
                    <div style="display: flex; gap: var(--space-xs); flex-direction: column;">
                      <button class="btn btn-sm btn-secondary" onclick="copyShareLinkById('${link.shareId}')" title="Copy link">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                        </svg>
                      </button>
                      <button class="btn btn-sm btn-danger" onclick="deleteShareLink('${link.shareId}')" title="Delete link">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeShareLinksModal()">Close</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeShareLinksModal();
      }
    });
    
  } catch (error) {
    console.error('[SHARING] Error loading share links:', error);
    alert(`Failed to load share links: ${error.message}`);
  }
}

/**
 * Close share links modal
 */
function closeShareLinksModal() {
  const modal = document.getElementById('shareLinksModal');
  if (modal) {
    modal.remove();
  }
}

/**
 * Copy share link by ID
 */
async function copyShareLinkById(shareId) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
  } catch (error) {
    // Fallback
    const input = document.createElement('input');
    input.value = shareUrl;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('Share link copied to clipboard!');
  }
}

/**
 * Delete share link
 */
async function deleteShareLink(shareId) {
  if (!confirm('Are you sure you want to delete this share link? It will no longer be accessible.')) {
    return;
  }
  
  try {
    const response = await fetch(`${window.CONFIG.API_BASE}/api/share/${shareId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to delete share link');
    }
    
    // Reload the list
    closeShareLinksModal();
    viewShareLinks();
    
  } catch (error) {
    console.error('[SHARING] Error deleting share link:', error);
    alert(`Failed to delete share link: ${error.message}`);
  }
}

/**
 * Test share link (open in new tab)
 */
function testShareLink() {
  const shareLinkInput = document.getElementById('shareLinkInput');
  if (shareLinkInput && shareLinkInput.value) {
    window.open(shareLinkInput.value, '_blank');
  }
}

// Export to window for global access
window.showShareModal = showShareModal;
window.closeShareModal = closeShareModal;
window.createShareLink = createShareLink;
window.copyShareLink = copyShareLink;
window.handleShareLinkImport = handleShareLinkImport;
window.importFromShareLink = importFromShareLink;
window.toggleAllShareWorkspaces = toggleAllShareWorkspaces;
window.updateShareWorkspaceSelection = updateShareWorkspaceSelection;
window.updateSharePreview = updateSharePreview;
window.viewShareLinks = viewShareLinks;
window.closeShareLinksModal = closeShareLinksModal;
window.copyShareLinkById = copyShareLinkById;
window.deleteShareLink = deleteShareLink;
window.testShareLink = testShareLink;
window.getAllAvailableWorkspaces = getAllAvailableWorkspaces;

