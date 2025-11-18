/**
 * Rung 2 Edit Scripts View
 * Main entry point for the Statement-Level Abstraction view
 */

// Performance optimization: Debounce utility (shared)
if (!window.debounce) {
  window.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
}

// Performance optimization: Cache for filtered results
const rung2Cache = {
  filtered: null,
  filters: null,
  lastUpdate: 0
};

// Performance optimization: Pagination constants
const RUNG2_ITEMS_PER_PAGE = 50;
let rung2CurrentPage = 0;

if (!window.renderRung2EditScriptsTemplate) {
  const templatesScript = document.createElement('script');
  templatesScript.src = 'views/rung2-edit-scripts/templates.js';
  templatesScript.async = false;
  document.head.appendChild(templatesScript);
}

function renderRung2EditScriptsView(container) {
  container.innerHTML = window.renderRung2EditScriptsTemplate();
  
  // Setup debounced filter handlers
  const searchInput = document.getElementById('rung2-edit-scripts-search');
  const filePathInput = document.getElementById('rung2-edit-scripts-filter-filepath');
  if (searchInput) {
    searchInput.addEventListener('input', window.debounce(applyRung2EditScriptsFilters, 300));
  }
  if (filePathInput) {
    filePathInput.addEventListener('input', window.debounce(applyRung2EditScriptsFilters, 300));
  }
  
  // Reset pagination
  rung2CurrentPage = 0;
  
  loadRung2EditScriptsData();
  loadRung2EditScriptsStats();
}

/**
 * Load Rung 2 edit scripts data
 */
async function loadRung2EditScriptsData() {
  const listContainer = document.getElementById('rung2-edit-scripts-list');
  if (!listContainer) return;

  try {
    listContainer.innerHTML = '<div class="rung2-edit-scripts-loading">Loading edit scripts...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung2/edit-scripts?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung2/edit-scripts`;

    const response = await fetch(url);
    
    if (!response.ok) {
      // Handle 503 (service unavailable) and 404 gracefully
      if (response.status === 503 || response.status === 404) {
        throw new Error('Service not available');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load edit scripts');
    }

    window.rung2EditScriptsData = data.scripts || [];
    
    // Log for debugging
    console.log('[RUNG2] Loaded edit scripts:', {
      count: window.rung2EditScriptsData.length,
      hasData: window.rung2EditScriptsData.length > 0
    });
    
    renderRung2EditScriptsList(window.rung2EditScriptsData);
    updateRung2EditScriptsDisplayedCount();
  } catch (error) {
    // Log all errors for debugging
    console.error('[RUNG2] Error loading edit scripts:', error);
    
    // Show appropriate message based on error type
    let errorMessage = 'Edit scripts not available.';
    if (error.message.includes('404') || error.message.includes('503') || error.message.includes('not available')) {
      errorMessage = 'Edit scripts service not available. The Rung 2 service needs to be initialized to generate edit scripts from your code changes.';
    } else if (error.message.includes('500')) {
      errorMessage = 'Error loading edit scripts. The service may be experiencing issues.';
    } else {
      errorMessage = `Error loading edit scripts: ${error.message}`;
    }
    
    listContainer.innerHTML = `
      <div class="rung2-edit-scripts-loading" style="color: var(--color-text-muted); padding: 2rem; text-align: center;">
        <div style="margin-bottom: 0.5rem;">${errorMessage}</div>
        <div style="font-size: 0.875rem; opacity: 0.7; margin-bottom: 1rem;">Edit scripts are generated from AST differencing of your code changes. Click "Extract Data" to process edit scripts from your Cursor database.</div>
        <button class="btn btn-sm" onclick="extractRung2EditScripts()" style="margin-top: 0.5rem;">
          Extract Data Now
        </button>
      </div>
    `;
  }
}

/**
 * Load Rung 2 statistics
 */
async function loadRung2EditScriptsStats() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung2/operations?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung2/operations`;

    const response = await fetch(url);
    
    if (!response.ok) {
      // Handle 503 (service unavailable) and 404 gracefully
      if (response.status === 503 || response.status === 404) {
        throw new Error('Service not available');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load operations');
    }

    const operations = data.operations || {};
    const scripts = window.rung2EditScriptsData || [];
    
    // Update stat cards
    const totalCountEl = document.getElementById('rung2-edit-scripts-total-count');
    if (totalCountEl) totalCountEl.textContent = scripts.length;
    
    const operationCountEl = document.getElementById('rung2-edit-scripts-operation-count');
    if (operationCountEl) {
      operationCountEl.textContent = scripts.reduce((sum, s) => sum + (s.operationCount || 0), 0);
    }
    
    const operationTypesCountEl = document.getElementById('rung2-edit-scripts-operation-types-count');
    if (operationTypesCountEl) {
      operationTypesCountEl.textContent = Object.keys(operations).length;
    }
  } catch (error) {
    // Only log non-404/503 errors (404/503 means service not available)
    if (!error.message.includes('404') && !error.message.includes('503') && !error.message.includes('not available')) {
      console.error('[RUNG2] Error loading statistics:', error);
    }
  }
}

/**
 * Render edit scripts list
 */
function renderRung2EditScriptsList(scripts, resetPagination = false) {
  const listContainer = document.getElementById('rung2-edit-scripts-list');
  if (!listContainer) return;

  if (resetPagination) {
    rung2CurrentPage = 0;
  }

  if (!scripts || scripts.length === 0) {
    listContainer.innerHTML = `
      <div class="rung2-edit-scripts-loading" style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
        <div style="margin-bottom: 0.5rem; font-weight: 500;">No edit scripts found</div>
        <div style="font-size: 0.875rem; opacity: 0.7; margin-bottom: 1rem;">
          Edit scripts are generated from AST differencing of your code changes.<br>
          Click "Extract Data" to process edit scripts from your Cursor database.
        </div>
        <button class="btn btn-sm" onclick="extractRung2EditScripts()" style="margin-top: 0.5rem;">
          Extract Data Now
        </button>
      </div>
    `;
    return;
  }

  // Pagination: only render current page
  const startIdx = rung2CurrentPage * RUNG2_ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + RUNG2_ITEMS_PER_PAGE, scripts.length);
  const pageScripts = scripts.slice(startIdx, endIdx);
  const hasMore = endIdx < scripts.length;

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  let html = '';
  for (const script of pageScripts) {
    const filePath = script.filePath || 'Unknown';
    const fileName = window.escapeHtml ? window.escapeHtml(filePath.split('/').pop()) : filePath.split('/').pop();
    const language = script.language || 'unknown';
    const timestamp = script.timestamp ? new Date(script.timestamp).toLocaleString() : 'Unknown';
    const operationTypes = Object.keys(script.operationTypes || {});
    const scriptId = (script.id || '').replace(/'/g, "\\'");

    html += `
      <div class="rung2-edit-scripts-script-item" onclick="selectRung2EditScript('${scriptId}')">
        <div class="rung2-edit-scripts-script-header">
          <div>
            <div class="rung2-edit-scripts-script-file">${fileName}</div>
            <div class="rung2-edit-scripts-script-meta">${language} • ${script.operationCount || 0} operations • ${script.changeStyle || 'mixed'} • ${timestamp}</div>
          </div>
        </div>
        <div class="rung2-edit-scripts-script-operations">
          ${operationTypes.slice(0, 5).map(op => 
            `<span class="rung2-edit-scripts-operation-badge">${window.escapeHtml ? window.escapeHtml(op) : op}</span>`
          ).join('')}
          ${operationTypes.length > 5 ? `<span class="rung2-edit-scripts-operation-badge">+${operationTypes.length - 5} more</span>` : ''}
        </div>
      </div>
    `;
  }

  // Add pagination controls if needed
  if (scripts.length > RUNG2_ITEMS_PER_PAGE) {
    html += `
      <div class="rung2-pagination">
        <button class="btn btn-sm" onclick="rung2PreviousPage()" ${rung2CurrentPage === 0 ? 'disabled' : ''}>
          Previous
        </button>
        <span class="rung2-pagination-info">
          Showing ${startIdx + 1}-${endIdx} of ${scripts.length}
        </span>
        <button class="btn btn-sm" onclick="rung2NextPage()" ${!hasMore ? 'disabled' : ''}>
          Next
        </button>
      </div>
    `;
  }

  tempDiv.innerHTML = html;
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }

  listContainer.innerHTML = '';
  listContainer.appendChild(fragment);
}

/**
 * Pagination functions
 */
function rung2NextPage() {
  const scripts = rung2Cache.filtered || window.rung2EditScriptsData || [];
  const maxPage = Math.ceil(scripts.length / RUNG2_ITEMS_PER_PAGE) - 1;
  if (rung2CurrentPage < maxPage) {
    rung2CurrentPage++;
    renderRung2EditScriptsList(scripts, false);
  }
}

function rung2PreviousPage() {
  if (rung2CurrentPage > 0) {
    rung2CurrentPage--;
    const scripts = rung2Cache.filtered || window.rung2EditScriptsData || [];
    renderRung2EditScriptsList(scripts, false);
  }
}

/**
 * Select an edit script and show details
 */
function selectRung2EditScript(id) {
  const scripts = window.rung2EditScriptsData || [];
  const script = scripts.find(s => s.id === id);
  
  if (!script) return;

  const detailsPanel = document.getElementById('rung2-edit-scripts-details-panel');
  const detailsContent = document.getElementById('rung2-edit-scripts-details-content');
  
  if (!detailsPanel || !detailsContent) return;

  const operations = script.editOperations || [];
  const operationTypes = script.operationTypes || {};

  const operationsJson = JSON.stringify(operations, null, 2);
  const escapedOperations = window.escapeHtml ? window.escapeHtml(operationsJson) : operationsJson;
  
  detailsContent.innerHTML = `
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">File Path</div>
      <div class="rung2-edit-scripts-detail-value">
        <code style="background: var(--color-bg-secondary, #f5f5f5); padding: 2px 6px; border-radius: 4px;">${script.filePath || 'Unknown'}</code>
        <button class="btn-copy" onclick="copyToClipboard('${(script.filePath || '').replace(/'/g, "\\'")}', event)" title="Copy file path">📋</button>
      </div>
    </div>
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">Language</div>
      <div class="rung2-edit-scripts-detail-value">
        <span class="badge badge-language">${script.language || 'unknown'}</span>
      </div>
    </div>
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">Change Style</div>
      <div class="rung2-edit-scripts-detail-value">
        <span class="badge badge-change-style">${script.changeStyle || 'mixed'}</span>
      </div>
    </div>
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">Operation Count</div>
      <div class="rung2-edit-scripts-detail-value">${script.operationCount || 0}</div>
    </div>
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">Operation Types</div>
      <div class="rung2-edit-scripts-detail-value">
        ${Object.entries(operationTypes).map(([type, count]) => 
          `<span class="rung2-edit-scripts-operation-badge" style="margin-right: var(--space-xs, 0.5rem); margin-bottom: var(--space-xs, 0.5rem); display: inline-block;">${type}: ${count}</span>`
        ).join('')}
      </div>
    </div>
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">
        Edit Operations
        <button class="btn-copy" onclick="copyToClipboard('${operationsJson.replace(/'/g, "\\'")}', event)" title="Copy operations JSON">📋</button>
      </div>
      <div class="rung2-edit-scripts-detail-value">
        <pre style="font-size: var(--text-xs, 0.75rem); overflow-x: auto; background: var(--color-bg-secondary, #f5f5f5); padding: var(--space-md, 1rem); border-radius: var(--radius-sm, 0.125rem);">${escapedOperations}</pre>
      </div>
    </div>
    <div class="rung2-edit-scripts-detail-section">
      <div class="rung2-edit-scripts-detail-label">Timestamp</div>
      <div class="rung2-edit-scripts-detail-value">${script.timestamp ? new Date(script.timestamp).toLocaleString() : 'Unknown'}</div>
    </div>
  `;

  detailsPanel.style.display = 'flex';
}

/**
 * Close details panel
 */
function closeRung2EditScriptsDetails() {
  const detailsPanel = document.getElementById('rung2-edit-scripts-details-panel');
  if (detailsPanel) {
    detailsPanel.style.display = 'none';
  }
}

/**
 * Apply filters (optimized with caching)
 */
function applyRung2EditScriptsFilters() {
  const search = document.getElementById('rung2-edit-scripts-search')?.value?.toLowerCase() || '';
  const language = document.getElementById('rung2-edit-scripts-filter-language')?.value || '';
  const filePath = document.getElementById('rung2-edit-scripts-filter-filepath')?.value || '';
  
  // Check cache
  const currentFilters = JSON.stringify({ search, language, filePath });
  if (rung2Cache.filtered && rung2Cache.filters === currentFilters) {
    renderRung2EditScriptsList(rung2Cache.filtered, true);
    updateRung2EditScriptsDisplayedCount(rung2Cache.filtered.length);
    return;
  }
  
  const scripts = window.rung2EditScriptsData || [];
  let filtered = scripts;

  // Apply search filter
  if (search) {
    filtered = filtered.filter(s => {
      const filePathMatch = (s.filePath || '').toLowerCase().includes(search);
      const languageMatch = (s.language || '').toLowerCase().includes(search);
      const changeStyleMatch = (s.changeStyle || '').toLowerCase().includes(search);
      const operationTypesMatch = Object.keys(s.operationTypes || {}).some(op => 
        op.toLowerCase().includes(search)
      );
      return filePathMatch || languageMatch || changeStyleMatch || operationTypesMatch;
    });
  }

  if (language) {
    filtered = filtered.filter(s => s.language === language);
  }

  if (filePath) {
    filtered = filtered.filter(s => (s.filePath || '').includes(filePath));
  }

  // Update cache
  rung2Cache.filtered = filtered;
  rung2Cache.filters = currentFilters;
  rung2Cache.lastUpdate = Date.now();

  renderRung2EditScriptsList(filtered, true);
  updateRung2EditScriptsDisplayedCount(filtered.length);
}

/**
 * Update time range
 */
function updateRung2EditScriptsTimeRange(value) {
  const percentage = parseInt(value);
  const display = document.getElementById('rung2-edit-scripts-time-display');
  if (display) {
    display.textContent = percentage === 100 ? 'All Time' : `Last ${percentage}%`;
  }
  
  // Calculate time range based on percentage
  if (percentage < 100 && window.rung2EditScriptsData && window.rung2EditScriptsData.length > 0) {
    const scripts = window.rung2EditScriptsData;
    const timestamps = scripts.map(s => new Date(s.timestamp || 0).getTime()).sort((a, b) => a - b);
    const minTime = timestamps[0];
    const maxTime = timestamps[timestamps.length - 1];
    const timeRange = maxTime - minTime;
    const cutoffTime = maxTime - (timeRange * percentage / 100);
    
    // Filter scripts
    const filtered = scripts.filter(s => new Date(s.timestamp || 0).getTime() >= cutoffTime);
    renderRung2EditScriptsList(filtered);
    updateRung2EditScriptsDisplayedCount(filtered.length);
  } else {
    // Show all scripts
    renderRung2EditScriptsList(window.rung2EditScriptsData || []);
    updateRung2EditScriptsDisplayedCount(window.rung2EditScriptsData?.length || 0);
  }
}

/**
 * Update displayed count
 */
function updateRung2EditScriptsDisplayedCount(count) {
  const countEl = document.getElementById('rung2-edit-scripts-displayed-count');
  if (countEl) {
    const actualCount = count !== undefined ? count : (window.rung2EditScriptsData || []).length;
    countEl.textContent = `${actualCount} scripts`;
  }
}

/**
 * Refresh data
 */
async function extractRung2EditScripts() {
  const extractBtn = document.getElementById('rung2-edit-scripts-extract-btn');
  const listContainer = document.getElementById('rung2-edit-scripts-list');
  
  if (!extractBtn || !listContainer) return;
  
  try {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    listContainer.innerHTML = '<div class="rung2-edit-scripts-loading">Extracting edit scripts from Cursor database... This may take a moment.</div>';
    
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const body = workspace ? { workspace } : { force: true };
    
    const response = await fetch(`${apiBase}/api/rung2/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Extraction failed');
    }
    
    // Show success message
    listContainer.innerHTML = `<div class="rung2-edit-scripts-loading" style="color: var(--color-success);">
      ${data.message || `Extracted ${data.count || 0} edit scripts`}. Refreshing...
    </div>`;
    
    // Refresh data
    setTimeout(() => {
      refreshRung2EditScripts();
    }, 500);
    
  } catch (error) {
    console.error('[RUNG2] Error extracting edit scripts:', error);
    listContainer.innerHTML = `<div class="rung2-edit-scripts-loading" style="color: var(--color-error);">
      Extraction failed: ${error.message}. Make sure the companion service is running and has access to the Cursor database.
    </div>`;
  } finally {
    if (extractBtn) {
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extract Data';
    }
  }
}

function refreshRung2EditScripts() {
  loadRung2EditScriptsData();
  loadRung2EditScriptsStats();
}

/**
 * Export data
 */
function exportRung2EditScripts() {
  try {
    const scripts = window.rung2EditScriptsData || [];
    
    if (scripts.length === 0) {
      alert('No edit script data available to export. Please load data first.');
      return;
    }
    
    // Get current filters to include in metadata
    const language = document.getElementById('rung2-edit-scripts-filter-language')?.value || '';
    const filePath = document.getElementById('rung2-edit-scripts-filter-filepath')?.value || '';
    
    // Determine which data to export (filtered or all)
    let dataToExport = scripts;
    if (language || filePath) {
      dataToExport = scripts.filter(script => {
        if (language && script.language !== language) return false;
        if (filePath && !(script.filePath || '').includes(filePath)) return false;
        return true;
      });
    }
    
    // Calculate stats
    const totalOperations = dataToExport.reduce((sum, s) => sum + (s.operationCount || 0), 0);
    const operationTypes = new Set();
    dataToExport.forEach(script => {
      Object.keys(script.operationTypes || {}).forEach(type => operationTypes.add(type));
    });
    
    // Create export data with metadata
    const exportData = {
      version: '1.0',
      rung: 2,
      description: 'Statement-level semantic edit scripts from AST differencing',
      exportDate: new Date().toISOString(),
      workspace: getCurrentWorkspace() || 'all',
      filters: {
        language: language || null,
        filePath: filePath || null
      },
      stats: {
        totalScripts: dataToExport.length,
        totalOperations: totalOperations,
        operationTypes: Array.from(operationTypes),
        languages: [...new Set(dataToExport.map(s => s.language))].filter(Boolean)
      },
      scripts: dataToExport
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rung2-edit-scripts-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[RUNG2] Export error:', error);
    alert('Failed to export data: ' + error.message);
  }
}

/**
 * Get current workspace
 */
function getCurrentWorkspace() {
  return window.state?.currentWorkspace || null;
}

/**
 * Copy to clipboard helper (if not already defined)
 */
if (!window.copyToClipboard) {
  window.copyToClipboard = function(text, event) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (event && event.target) {
          const btn = event.target;
          const originalText = btn.textContent;
          btn.textContent = '✓';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 1000);
        }
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };
}

window.renderRung2EditScriptsView = renderRung2EditScriptsView;
window.selectRung2EditScript = selectRung2EditScript;
window.closeRung2EditScriptsDetails = closeRung2EditScriptsDetails;
window.applyRung2EditScriptsFilters = applyRung2EditScriptsFilters;
window.updateRung2EditScriptsTimeRange = updateRung2EditScriptsTimeRange;
window.extractRung2EditScripts = extractRung2EditScripts;
window.refreshRung2EditScripts = refreshRung2EditScripts;
window.exportRung2EditScripts = exportRung2EditScripts;
window.rung2NextPage = rung2NextPage;
window.rung2PreviousPage = rung2PreviousPage;

