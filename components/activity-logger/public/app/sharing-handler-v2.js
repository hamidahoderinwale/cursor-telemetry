/**
 * Sharing Handler V2 - Improved Interface
 * Modern, intuitive sharing interface with better UX
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
 * Show improved share modal with step-by-step wizard
 */
async function showShareModalV2(workspaces = null) {
  // Get selected workspaces
  let selectedWorkspaces = [];
  if (!workspaces) {
    const exportWorkspaceAll = document.getElementById('exportWorkspaceAll');
    const exportWorkspaceCheckboxes = document.querySelectorAll('.export-workspace-checkbox:checked');
    
    if (exportWorkspaceAll && exportWorkspaceAll.checked) {
      selectedWorkspaces = getAllAvailableWorkspaces();
    } else if (exportWorkspaceCheckboxes.length > 0) {
      selectedWorkspaces = Array.from(exportWorkspaceCheckboxes).map(cb => cb.value);
    } else {
      const currentWorkspace = window.state?.currentWorkspace;
      if (currentWorkspace && currentWorkspace !== 'all') {
        selectedWorkspaces = [currentWorkspace];
      }
    }
  } else {
    selectedWorkspaces = Array.isArray(workspaces) ? workspaces : [workspaces];
  }

  const allWorkspaces = getAllAvailableWorkspaces();

  // Remove existing modal
  const existingModal = document.getElementById('shareModalV2');
  if (existingModal) existingModal.remove();
  
  const modal = document.createElement('div');
  modal.id = 'shareModalV2';
  modal.className = 'modal-overlay';
  
  // Step-based wizard interface
  modal.innerHTML = `
    <div class="modal-content share-modal-v2" style="max-width: 900px;">
      <!-- Header with progress indicator -->
      <div class="share-header">
        <div class="share-header-content">
          <h2>Share Workspace</h2>
          <p class="share-subtitle">Create a secure link to share your workspace data</p>
        </div>
        <button class="modal-close" onclick="closeShareModalV2()">&times;</button>
      </div>

      <!-- Progress Steps -->
      <div class="share-progress">
        <div class="share-step active" data-step="1">
          <div class="step-number">1</div>
          <div class="step-label">Select</div>
        </div>
        <div class="share-step" data-step="2">
          <div class="step-number">2</div>
          <div class="step-label">Configure</div>
        </div>
        <div class="share-step" data-step="3">
          <div class="step-number">3</div>
          <div class="step-label">Share</div>
        </div>
      </div>

      <div class="share-body">
        <!-- Step 1: Workspace Selection -->
        <div class="share-step-content active" data-step-content="1">
          <div class="share-section">
            <h3 class="share-section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
              </svg>
              Select Workspaces
            </h3>
            <p class="share-section-desc">Choose which workspaces to include in your share link</p>
            
            ${allWorkspaces.length === 0 ? `
              <div class="share-empty-state">
                <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style="opacity: 0.3;">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                </svg>
                <p>No workspaces found in your telemetry data</p>
              </div>
            ` : `
              <div class="workspace-selector-v2">
                <div class="workspace-selector-header">
                  <label class="workspace-select-all">
                    <input type="checkbox" id="shareSelectAll" ${selectedWorkspaces.length === allWorkspaces.length ? 'checked' : ''} 
                           onchange="toggleAllWorkspacesV2(this.checked)">
                    <span>Select All (${allWorkspaces.length})</span>
                  </label>
                  <input type="text" id="workspaceSearch" class="workspace-search" 
                         placeholder="Search workspaces..." oninput="filterWorkspacesV2(this.value)">
                </div>
                
                <div class="workspace-list-v2" id="workspaceListV2">
                  ${allWorkspaces.map(ws => {
                    const displayName = ws.split('/').pop() || ws;
                    const escapedWs = window.escapeHtml ? window.escapeHtml(ws) : ws;
                    const escapedDisplay = window.escapeHtml ? window.escapeHtml(displayName) : displayDisplay;
                    const isSelected = selectedWorkspaces.includes(ws);
                    return `
                      <label class="workspace-item ${isSelected ? 'selected' : ''}">
                        <input type="checkbox" class="workspace-checkbox" value="${escapedWs}" ${isSelected ? 'checked' : ''}
                               onchange="updateWorkspaceSelectionV2()">
                        <div class="workspace-item-content">
                          <div class="workspace-item-name">${escapedDisplay}</div>
                          <div class="workspace-item-path">${escapedWs}</div>
                        </div>
                        <div class="workspace-item-stats" data-workspace="${escapedWs}">
                          <span class="stat-badge">Loading...</span>
                        </div>
                      </label>
                    `;
                  }).join('')}
                </div>
                
                <div class="workspace-selection-summary" id="workspaceSummary">
                  <span id="selectedCount">${selectedWorkspaces.length}</span> of ${allWorkspaces.length} selected
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- Step 2: Privacy & Settings -->
        <div class="share-step-content" data-step-content="2">
          <div class="share-section">
            <h3 class="share-section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
              </svg>
              Privacy & Settings
            </h3>
            <p class="share-section-desc">Control what data is shared and how long the link stays active</p>

            <!-- Privacy Level Cards -->
            <div class="privacy-level-selector">
              <div class="privacy-card" data-level="0" onclick="selectPrivacyLevel(0)">
                <div class="privacy-card-header">
                  <input type="radio" name="privacyLevel" value="0" id="privacy0">
                  <label for="privacy0" class="privacy-card-title">Full Details</label>
                  <span class="privacy-badge low">Low Privacy</span>
                </div>
                <p class="privacy-card-desc">Includes full code diffs, file contents, and all metadata. Use only for trusted recipients.</p>
                <div class="privacy-card-features">
                  <span class="feature-tag">Code Content</span>
                  <span class="feature-tag">Full Metadata</span>
                  <span class="feature-tag">File Paths</span>
                </div>
              </div>

              <div class="privacy-card active" data-level="1" onclick="selectPrivacyLevel(1)">
                <div class="privacy-card-header">
                  <input type="radio" name="privacyLevel" value="1" id="privacy1" checked>
                  <label for="privacy1" class="privacy-card-title">Metrics Only</label>
                  <span class="privacy-badge medium">Recommended</span>
                </div>
                <p class="privacy-card-desc">Statistics, metrics, and file relationships without exposing code content. Best for most sharing.</p>
                <div class="privacy-card-features">
                  <span class="feature-tag">Statistics</span>
                  <span class="feature-tag">Metrics</span>
                  <span class="feature-tag">Relationships</span>
                </div>
              </div>

              <div class="privacy-card" data-level="2" onclick="selectPrivacyLevel(2)">
                <div class="privacy-card-header">
                  <input type="radio" name="privacyLevel" value="2" id="privacy2">
                  <label for="privacy2" class="privacy-card-title">High-Level</label>
                  <span class="privacy-badge high">High Privacy</span>
                </div>
                <p class="privacy-card-desc">Only descriptions of changes and patterns. No code or detailed metrics.</p>
                <div class="privacy-card-features">
                  <span class="feature-tag">Descriptions</span>
                  <span class="feature-tag">Patterns</span>
                </div>
              </div>

              <div class="privacy-card" data-level="3" onclick="selectPrivacyLevel(3)">
                <div class="privacy-card-header">
                  <input type="radio" name="privacyLevel" value="3" id="privacy3">
                  <label for="privacy3" class="privacy-card-title">Patterns Only</label>
                  <span class="privacy-badge maximum">Maximum Privacy</span>
                </div>
                <p class="privacy-card-desc">Only workflow patterns and trends. Minimal detail, maximum privacy.</p>
                <div class="privacy-card-features">
                  <span class="feature-tag">Workflow Patterns</span>
                  <span class="feature-tag">Trends</span>
                </div>
              </div>
            </div>

            <!-- Advanced Options (Collapsible) -->
            <div class="share-advanced-section">
              <button class="share-advanced-toggle" onclick="toggleAdvancedOptionsV2()">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                Advanced Options
              </button>
              
              <div class="share-advanced-content" id="advancedOptionsV2" style="display: none;">
                <!-- Date Range -->
                <div class="form-group">
                  <label class="form-label">Date Range (Optional)</label>
                  <div class="date-range-inputs">
                    <input type="date" id="shareDateFromV2" class="form-input" placeholder="From">
                    <span class="date-separator">to</span>
                    <input type="date" id="shareDateToV2" class="form-input" placeholder="To">
                  </div>
                  <div class="date-presets">
                    <button class="preset-btn" onclick="setDatePreset('week')">Last Week</button>
                    <button class="preset-btn" onclick="setDatePreset('month')">Last Month</button>
                    <button class="preset-btn" onclick="setDatePreset('quarter')">Last Quarter</button>
                    <button class="preset-btn" onclick="setDatePreset('all')">All Time</button>
                  </div>
                </div>

                <!-- Link Name -->
                <div class="form-group">
                  <label class="form-label">Link Name (Optional)</label>
                  <input type="text" id="shareLinkNameV2" class="form-input" 
                         placeholder="e.g., Project Alpha - Q4 2024" maxlength="100">
                  <small class="form-hint">Give your link a friendly name for easy identification</small>
                </div>

                <!-- Expiration -->
                <div class="form-group">
                  <label class="form-label">Link Expiration</label>
                  <select id="shareExpirationV2" class="form-input">
                    <option value="1">1 day</option>
                    <option value="3">3 days</option>
                    <option value="7" selected>7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="0">Never expire</option>
                  </select>
                  <small class="form-hint">The link will automatically expire after this time</small>
                </div>
              </div>
            </div>

            <!-- Live Preview -->
            <div class="share-preview-card" id="sharePreviewV2">
              <div class="preview-header">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                </svg>
                <span>Preview</span>
              </div>
              <div class="preview-content" id="previewContentV2">
                <div class="preview-stats">
                  <div class="preview-stat">
                    <div class="stat-value" id="previewWorkspaces">0</div>
                    <div class="stat-label">Workspaces</div>
                  </div>
                  <div class="preview-stat">
                    <div class="stat-value" id="previewEvents">0</div>
                    <div class="stat-label">Events</div>
                  </div>
                  <div class="preview-stat">
                    <div class="stat-value" id="previewPrompts">0</div>
                    <div class="stat-label">Prompts</div>
                  </div>
                  <div class="preview-stat">
                    <div class="stat-value" id="previewSize">0 KB</div>
                    <div class="stat-label">Est. Size</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 3: Share Link -->
        <div class="share-step-content" data-step-content="3">
          <div class="share-section">
            <div class="share-success">
              <div class="success-icon">
                <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
              </div>
              <h3>Share Link Created!</h3>
              <p>Your workspace data is now accessible via the link below</p>
            </div>

            <div class="share-link-result" id="shareLinkResultV2">
              <div class="link-input-group">
                <input type="text" id="shareLinkInputV2" class="link-input" readonly>
                <button class="btn btn-primary" onclick="copyShareLinkV2()" id="copyBtnV2">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                  </svg>
                  Copy Link
                </button>
              </div>
              
              <div class="link-info">
                <div class="info-item">
                  <span class="info-label">Expires:</span>
                  <span class="info-value" id="linkExpiresV2">Never</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Privacy:</span>
                  <span class="info-value" id="linkPrivacyV2">Metrics Only</span>
                </div>
              </div>

              <div class="link-actions">
                <button class="btn btn-secondary" onclick="testShareLinkV2()">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
                  </svg>
                  Test Link
                </button>
                <button class="btn btn-secondary" onclick="viewAllLinksV2()">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                  </svg>
                  Manage All Links
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Navigation -->
      <div class="share-footer">
        <button class="btn btn-secondary" onclick="closeShareModalV2()">Cancel</button>
        <div class="share-footer-actions">
          <button class="btn btn-secondary" id="prevStepBtn" onclick="previousStepV2()" style="display: none;">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"/>
            </svg>
            Previous
          </button>
          <button class="btn btn-primary" id="nextStepBtn" onclick="nextStepV2()">
            Next
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
          <button class="btn btn-primary" id="createLinkBtn" onclick="createShareLinkV2()" style="display: none;">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
            </svg>
            Create Link
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Initialize
  setTimeout(() => {
    updateWorkspaceSelectionV2();
    updatePreviewV2();
    loadWorkspaceStats();
  }, 100);

  // Close handlers
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeShareModalV2();
  });

  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeShareModalV2();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

// Step navigation
let currentStep = 1;
const totalSteps = 3;

function nextStepV2() {
  if (currentStep < totalSteps) {
    // Validate current step
    if (currentStep === 1) {
      const selected = document.querySelectorAll('.workspace-checkbox:checked');
      if (selected.length === 0) {
        alert('Please select at least one workspace');
        return;
      }
    }
    
    currentStep++;
    updateStepDisplay();
  }
}

function previousStepV2() {
  if (currentStep > 1) {
    currentStep--;
    updateStepDisplay();
  }
}

function updateStepDisplay() {
  // Update progress indicator
  document.querySelectorAll('.share-step').forEach((step, idx) => {
    const stepNum = idx + 1;
    step.classList.toggle('active', stepNum === currentStep);
    step.classList.toggle('completed', stepNum < currentStep);
  });

  // Update step content
  document.querySelectorAll('.share-step-content').forEach((content, idx) => {
    const stepNum = idx + 1;
    content.classList.toggle('active', stepNum === currentStep);
  });

  // Update buttons
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  const createBtn = document.getElementById('createLinkBtn');

  prevBtn.style.display = currentStep > 1 ? 'inline-flex' : 'none';
  
  if (currentStep === totalSteps) {
    nextBtn.style.display = 'none';
    createBtn.style.display = 'inline-flex';
  } else {
    nextBtn.style.display = 'inline-flex';
    createBtn.style.display = 'none';
  }
}

function selectPrivacyLevel(level) {
  document.querySelectorAll('.privacy-card').forEach(card => {
    card.classList.remove('active');
    if (parseInt(card.dataset.level) === level) {
      card.classList.add('active');
      card.querySelector('input[type="radio"]').checked = true;
    }
  });
  updatePreviewV2();
}

function toggleAdvancedOptionsV2() {
  const content = document.getElementById('advancedOptionsV2');
  const toggle = event.target.closest('.share-advanced-toggle');
  const isVisible = content.style.display !== 'none';
  content.style.display = isVisible ? 'none' : 'block';
  if (toggle) {
    const icon = toggle.querySelector('svg');
    icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}

function toggleAllWorkspacesV2(checked) {
  document.querySelectorAll('.workspace-checkbox').forEach(cb => {
    cb.checked = checked;
    cb.closest('.workspace-item').classList.toggle('selected', checked);
  });
  updateWorkspaceSelectionV2();
}

function filterWorkspacesV2(query) {
  const items = document.querySelectorAll('.workspace-item');
  const lowerQuery = query.toLowerCase();
  items.forEach(item => {
    const name = item.querySelector('.workspace-item-name').textContent.toLowerCase();
    const path = item.querySelector('.workspace-item-path').textContent.toLowerCase();
    const matches = name.includes(lowerQuery) || path.includes(lowerQuery);
    item.style.display = matches ? '' : 'none';
  });
}

function updateWorkspaceSelectionV2() {
  const selected = document.querySelectorAll('.workspace-checkbox:checked');
  const total = document.querySelectorAll('.workspace-checkbox').length;
  const count = selected.length;

  // Update summary
  const summary = document.getElementById('workspaceSummary');
  if (summary) {
    summary.querySelector('#selectedCount').textContent = count;
  }

  // Update select all checkbox
  const selectAll = document.getElementById('shareSelectAll');
  if (selectAll) {
    selectAll.checked = count === total;
    selectAll.indeterminate = count > 0 && count < total;
  }

  // Update item classes
  selected.forEach(cb => {
    cb.closest('.workspace-item').classList.add('selected');
  });
  document.querySelectorAll('.workspace-checkbox:not(:checked)').forEach(cb => {
    cb.closest('.workspace-item').classList.remove('selected');
  });

  updatePreviewV2();
}

async function loadWorkspaceStats() {
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  document.querySelectorAll('.workspace-item-stats').forEach(statEl => {
    const workspace = statEl.dataset.workspace;
    const wsEvents = events.filter(e => {
      const ws = e.workspace_path || e.workspacePath || e.workspace;
      return ws === workspace;
    }).length;
    const wsPrompts = prompts.filter(p => {
      const ws = p.workspace_path || p.workspacePath || p.workspaceId;
      return ws === workspace;
    }).length;
    
    statEl.innerHTML = `<span class="stat-badge">${wsEvents} events, ${wsPrompts} prompts</span>`;
  });
}

function updatePreviewV2() {
  const selected = Array.from(document.querySelectorAll('.workspace-checkbox:checked')).map(cb => cb.value);
  const privacyLevel = parseInt(document.querySelector('input[name="privacyLevel"]:checked')?.value || '1');
  const expirationDays = parseInt(document.getElementById('shareExpirationV2')?.value || '7');
  
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  
  const filteredEvents = events.filter(e => {
    const ws = e.workspace_path || e.workspacePath || e.workspace;
    return selected.includes(ws);
  });
  
  const filteredPrompts = prompts.filter(p => {
    const ws = p.workspace_path || p.workspacePath || p.workspaceId;
    return selected.includes(ws);
  });
  
  const avgEventSize = 500;
  const avgPromptSize = privacyLevel === 0 ? 2000 : privacyLevel === 1 ? 500 : 200;
  const estimatedSize = (filteredEvents.length * avgEventSize + filteredPrompts.length * avgPromptSize) / 1024;
  
  document.getElementById('previewWorkspaces').textContent = selected.length;
  document.getElementById('previewEvents').textContent = filteredEvents.length.toLocaleString();
  document.getElementById('previewPrompts').textContent = filteredPrompts.length.toLocaleString();
  document.getElementById('previewSize').textContent = estimatedSize.toFixed(1) + ' KB';
}

function setDatePreset(preset) {
  const today = new Date();
  const fromInput = document.getElementById('shareDateFromV2');
  const toInput = document.getElementById('shareDateToV2');
  
  let fromDate = new Date();
  
  switch (preset) {
    case 'week':
      fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'quarter':
      fromDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      fromDate = new Date(0);
      break;
  }
  
  if (fromInput) fromInput.value = fromDate.toISOString().split('T')[0];
  if (toInput) toInput.value = today.toISOString().split('T')[0];
  updatePreviewV2();
}

async function createShareLinkV2() {
  const selected = Array.from(document.querySelectorAll('.workspace-checkbox:checked')).map(cb => cb.value);
  const privacyLevel = parseInt(document.querySelector('input[name="privacyLevel"]:checked')?.value || '1');
  const expirationDays = parseInt(document.getElementById('shareExpirationV2')?.value || '7');
  const linkName = document.getElementById('shareLinkNameV2')?.value?.trim() || null;
  const dateFrom = document.getElementById('shareDateFromV2')?.value || null;
  const dateTo = document.getElementById('shareDateToV2')?.value || null;
  
  if (selected.length === 0) {
    alert('Please select at least one workspace');
    return;
  }
  
  const createBtn = document.getElementById('createLinkBtn');
  createBtn.disabled = true;
  createBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="animation: spin 1s linear infinite;"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg> Creating...';
  
  try {
    const filters = {};
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    
    const response = await fetch(`${window.CONFIG.API_BASE}/api/share/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaces: selected,
        abstractionLevel: privacyLevel,
        expirationDays,
        filters,
        name: linkName
      })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to create share link');
    }
    
    // Move to step 3
    currentStep = 3;
    updateStepDisplay();
    
    // Display link
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${result.shareId}`;
    document.getElementById('shareLinkInputV2').value = shareUrl;
    document.getElementById('linkExpiresV2').textContent = result.expiresAt 
      ? new Date(result.expiresAt).toLocaleString() 
      : 'Never';
    
    const privacyLabels = ['Full Details', 'Metrics Only', 'High-Level', 'Patterns Only'];
    document.getElementById('linkPrivacyV2').textContent = privacyLabels[privacyLevel] || 'Metrics Only';
    
    createBtn.disabled = false;
    createBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg> Create Link';
    
  } catch (error) {
    console.error('[SHARING] Error:', error);
    alert(`Failed to create share link: ${error.message}`);
    createBtn.disabled = false;
    createBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/></svg> Create Link';
  }
}

async function copyShareLinkV2() {
  const input = document.getElementById('shareLinkInputV2');
  if (!input) return;
  
  try {
    await navigator.clipboard.writeText(input.value);
    const btn = document.getElementById('copyBtnV2');
    const original = btn.innerHTML;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Copied!';
    btn.style.background = 'var(--color-success)';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
    }, 2000);
  } catch (error) {
    input.select();
    document.execCommand('copy');
  }
}

function testShareLinkV2() {
  const input = document.getElementById('shareLinkInputV2');
  if (input && input.value) {
    window.open(input.value, '_blank');
  }
}

function viewAllLinksV2() {
  if (window.viewShareLinks) {
    window.viewShareLinks();
  }
}

function closeShareModalV2() {
  const modal = document.getElementById('shareModalV2');
  if (modal) modal.remove();
  currentStep = 1;
}

// Export functions - provide both v2 and standard names for compatibility
window.showShareModalV2 = showShareModalV2;
window.showShareModal = showShareModalV2; // Main export for compatibility with existing code
window.closeShareModalV2 = closeShareModalV2;
window.closeShareModal = closeShareModalV2; // Compatibility alias
window.nextStepV2 = nextStepV2;
window.previousStepV2 = previousStepV2;
window.selectPrivacyLevel = selectPrivacyLevel;
window.toggleAdvancedOptionsV2 = toggleAdvancedOptionsV2;
window.toggleAllWorkspacesV2 = toggleAllWorkspacesV2;
window.filterWorkspacesV2 = filterWorkspacesV2;
window.updateWorkspaceSelectionV2 = updateWorkspaceSelectionV2;
window.setDatePreset = setDatePreset;
window.createShareLinkV2 = createShareLinkV2;
window.copyShareLinkV2 = copyShareLinkV2;
window.testShareLinkV2 = testShareLinkV2;
window.viewAllLinksV2 = viewAllLinksV2;
// Export getAllAvailableWorkspaces
window.getAllAvailableWorkspaces = getAllAvailableWorkspaces;

