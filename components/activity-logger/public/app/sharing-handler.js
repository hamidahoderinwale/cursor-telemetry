/**
 * Sharing Handler Module
 * Handles workspace sharing via shareable links
 */

/**
 * Show share modal for workspace(s)
 */
async function showShareModal(workspaces = null) {
  // If no workspaces provided, get from export modal or current selection
  if (!workspaces) {
    // Try to get from export modal if open
    const exportWorkspaceAll = document.getElementById('exportWorkspaceAll');
    const exportWorkspaceCheckboxes = document.querySelectorAll('.export-workspace-checkbox:checked');
    
    if (exportWorkspaceAll && exportWorkspaceAll.checked) {
      // Get all workspaces
      const events = window.state?.data?.events || [];
      const prompts = window.state?.data?.prompts || [];
      const allWorkspaces = new Set();
      events.forEach(e => {
        const ws = e.workspace_path || e.workspacePath || e.workspace;
        if (ws) allWorkspaces.add(ws);
      });
      prompts.forEach(p => {
        const ws = p.workspace_path || p.workspacePath || p.workspaceId;
        if (ws) allWorkspaces.add(ws);
      });
      workspaces = Array.from(allWorkspaces);
    } else if (exportWorkspaceCheckboxes.length > 0) {
      workspaces = Array.from(exportWorkspaceCheckboxes).map(cb => cb.value);
    } else {
      // Get current workspace filter
      const currentWorkspace = window.state?.currentWorkspace;
      if (currentWorkspace && currentWorkspace !== 'all') {
        workspaces = [currentWorkspace];
      } else {
        workspaces = [];
      }
    }
  }

  // Ensure workspaces is an array
  if (!Array.isArray(workspaces)) {
    workspaces = [workspaces];
  }

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
        
        <!-- Workspace Selection -->
        <div>
          <h3 class="card-title">Workspaces to Share</h3>
          <div id="shareWorkspaceList" class="workspace-list-container" style="max-height: 200px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-sm);">
            ${workspaces.length > 0 ? workspaces.map(ws => {
              const displayName = ws.split('/').pop() || ws;
              const escapedWs = window.escapeHtml ? window.escapeHtml(ws) : ws;
              const escapedDisplay = window.escapeHtml ? window.escapeHtml(displayName) : displayName;
              return `
                <div style="padding: var(--space-xs); border-bottom: 1px solid var(--color-border);">
                  <strong>${escapedDisplay}</strong>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted);">${escapedWs}</div>
                </div>
              `;
            }).join('') : '<div style="color: var(--color-text-muted); padding: var(--space-sm); text-align: center;">No workspaces selected</div>'}
          </div>
        </div>

        <!-- Privacy Level -->
        <div>
          <h3 class="card-title">
            Privacy Level
            <span class="tooltip-icon" title="Controls how much detail is shared. Higher levels remove code content for privacy.">i</span>
          </h3>
          <div class="export-modal-field-group">
            <select id="shareAbstractionLevel" class="form-input">
              <option value="0">Level 0: Raw Traces (Full code diffs, all metadata)</option>
              <option value="1" selected>Level 1: Code Abstracts (Stats only, no code content)</option>
              <option value="2">Level 2: Statement-Level (Descriptions only)</option>
              <option value="3">Level 3: Workflow-Level (Patterns only)</option>
            </select>
            <div class="file-input-hint">
              Level 1 is recommended for sharing - preserves metrics without exposing code content.
            </div>
          </div>
        </div>

        <!-- Expiration -->
        <div>
          <h3 class="card-title">Link Expiration</h3>
          <div class="export-modal-field-group">
            <select id="shareExpirationDays" class="form-input">
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7" selected>7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </div>

        <!-- Share Link Result -->
        <div id="shareLinkResult" style="display: none; margin-top: var(--space-md);">
          <div class="card" style="background: var(--color-bg-alt);">
            <div class="card-body">
              <h4 style="margin-bottom: var(--space-sm);">Shareable Link Created</h4>
              <div style="display: flex; gap: var(--space-xs); align-items: center; margin-bottom: var(--space-sm);">
                <input type="text" id="shareLinkInput" class="form-input" readonly style="flex: 1; font-family: monospace; font-size: var(--text-sm);">
                <button class="btn btn-sm" onclick="copyShareLink()" id="copyShareLinkBtn">
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
          </div>
        </div>

        <!-- Error Message -->
        <div id="shareError" style="display: none; margin-top: var(--space-md); padding: var(--space-sm); background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: var(--radius-md); color: var(--color-error);">
        </div>
        
      </div>
      
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeShareModal()">Cancel</button>
        <button class="btn btn-primary" id="createShareLinkBtn" onclick="createShareLink()" ${workspaces.length === 0 ? 'disabled' : ''}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
          </svg>
          Create Share Link
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Store workspaces for later use
  modal._workspaces = workspaces;
  
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
 * Create share link
 */
async function createShareLink() {
  const modal = document.getElementById('shareModal');
  if (!modal) return;
  
  const workspaces = modal._workspaces || [];
  const abstractionLevel = parseInt(document.getElementById('shareAbstractionLevel').value) || 1;
  const expirationDays = parseInt(document.getElementById('shareExpirationDays').value) || 7;
  
  const createBtn = document.getElementById('createShareLinkBtn');
  const errorDiv = document.getElementById('shareError');
  const resultDiv = document.getElementById('shareLinkResult');
  
  if (workspaces.length === 0) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = 'Please select at least one workspace to share';
    return;
  }
  
  try {
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    errorDiv.style.display = 'none';
    resultDiv.style.display = 'none';
    
    const response = await fetch(`${window.CONFIG.API_BASE}/api/share/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspaces,
        abstractionLevel,
        expirationDays
      })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to create share link');
    }
    
    // Display share link
    const shareUrl = `${window.location.origin}${result.shareUrl}`;
    document.getElementById('shareLinkInput').value = shareUrl;
    document.getElementById('shareLinkExpires').textContent = new Date(result.expiresAt).toLocaleString();
    resultDiv.style.display = 'block';
    
    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    createBtn.disabled = false;
    createBtn.textContent = 'Create Share Link';
    
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

// Export to window for global access
window.showShareModal = showShareModal;
window.closeShareModal = closeShareModal;
window.createShareLink = createShareLink;
window.copyShareLink = copyShareLink;
window.handleShareLinkImport = handleShareLinkImport;
window.importFromShareLink = importFromShareLink;

