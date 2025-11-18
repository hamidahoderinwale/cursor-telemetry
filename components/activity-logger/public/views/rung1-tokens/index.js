/**
 * Rung 1 Tokens View
 * Main entry point for the Token-Level Abstraction view
 */

// Performance optimization: Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Performance optimization: Cache for filtered results
const rung1Cache = {
  filtered: null,
  filters: null,
  lastUpdate: 0
};

// Performance optimization: Pagination constants
const RUNG1_ITEMS_PER_PAGE = 50;
let rung1CurrentPage = 0;

// Load templates first
if (!window.renderRung1TokensTemplate) {
  const templatesScript = document.createElement('script');
  templatesScript.src = 'views/rung1-tokens/templates.js';
  templatesScript.async = false;
  document.head.appendChild(templatesScript);
}

function renderRung1TokensView(container) {
  initializeRung1TokensView(container);
}

function initializeRung1TokensView(container) {
  renderRung1TokensViewContent(container);
}

function renderRung1TokensViewContent(container) {
  // Render template
  container.innerHTML = window.renderRung1TokensTemplate();

  // Setup debounced filter handler
  const searchInput = document.getElementById('rung1-tokens-search');
  const filePathInput = document.getElementById('rung1-tokens-filter-filepath');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyRung1TokensFilters, 300));
  }
  if (filePathInput) {
    filePathInput.addEventListener('input', debounce(applyRung1TokensFilters, 300));
  }

  // Reset pagination
  rung1CurrentPage = 0;

  // Load data
  loadRung1TokensData();
  loadRung1TokensStats();
}

/**
 * Load Rung 1 token sequences data
 */
async function loadRung1TokensData() {
  const sequencesContainer = document.getElementById('rung1-tokens-sequences');
  if (!sequencesContainer) return;

  try {
    sequencesContainer.innerHTML = '<div class="rung1-tokens-loading">Loading token sequences...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const params = new URLSearchParams();
    if (workspace) params.append('workspace', workspace);
    
    // Add time range filters if specified
    const timeRangeSlider = document.getElementById('rung1-tokens-time-range');
    if (timeRangeSlider) {
      const percentage = parseInt(timeRangeSlider.value);
      if (percentage < 100 && window.rung1TokensData && window.rung1TokensData.length > 0) {
        const tokens = window.rung1TokensData;
        const timestamps = tokens.map(t => new Date(t.timestamp).getTime()).sort((a, b) => a - b);
        const minTime = timestamps[0];
        const maxTime = timestamps[timestamps.length - 1];
        const timeRange = maxTime - minTime;
        const cutoffTime = maxTime - (timeRange * percentage / 100);
        params.append('since', new Date(cutoffTime).toISOString());
      }
    }
    
    const url = `${apiBase}/api/rung1/tokens?${params.toString()}`;

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
      throw new Error(data.error || 'Failed to load token sequences');
    }

    window.rung1TokensData = data.tokens || [];
    renderRung1TokensSequences(window.rung1TokensData);
    updateRung1TokensDisplayedCount();
  } catch (error) {
    // Only log non-404/503 errors (404/503 means service not available)
    if (!error.message.includes('404') && !error.message.includes('503') && !error.message.includes('not available')) {
      console.error('[RUNG1] Error loading token sequences:', error);
    }
    sequencesContainer.innerHTML = `
      <div class="rung1-tokens-loading" style="color: var(--color-text-muted); padding: 2rem; text-align: center;">
        <div style="margin-bottom: 1rem;">No token sequences found.</div>
        <div style="font-size: 0.9rem; margin-bottom: 1rem;">
          Click "Extract Data" to process tokens from your Cursor database, or wait for automatic processing.
        </div>
        <button class="btn btn-sm" onclick="extractRung1Tokens()" style="margin-top: 0.5rem;">
          Extract Data Now
        </button>
      </div>
    `;
  }
}

/**
 * Load Rung 1 statistics
 */
async function loadRung1TokensStats() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung1/stats?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung1/stats`;

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
      throw new Error(data.error || 'Failed to load statistics');
    }

    const stats = data.stats || {};
    
    // Update stat cards (with null checks)
    const totalCountEl = document.getElementById('rung1-tokens-total-count');
    if (totalCountEl) totalCountEl.textContent = stats.total || 0;
    
    const tokenCountEl = document.getElementById('rung1-tokens-token-count');
    if (tokenCountEl) tokenCountEl.textContent = stats.totalTokenCount || 0;
    
    const languageCountEl = document.getElementById('rung1-tokens-language-count');
    if (languageCountEl) languageCountEl.textContent = Object.keys(stats.byLanguage || {}).length;
    
    const identifierCountEl = document.getElementById('rung1-tokens-identifier-count');
    if (identifierCountEl) identifierCountEl.textContent = stats.totalIdentifierCount || 0;
  } catch (error) {
    // Only log non-404/503 errors (404/503 means service not available)
    if (!error.message.includes('404') && !error.message.includes('503') && !error.message.includes('not available')) {
      console.error('[RUNG1] Error loading statistics:', error);
    }
  }
}

/**
 * Render token sequences list (optimized with pagination and document fragments)
 */
function renderRung1TokensSequences(tokens, resetPagination = false) {
  const sequencesContainer = document.getElementById('rung1-tokens-sequences');
  if (!sequencesContainer) return;

  if (resetPagination) {
    rung1CurrentPage = 0;
  }

  if (!tokens || tokens.length === 0) {
    sequencesContainer.innerHTML = '<div class="rung1-tokens-loading">No token sequences found</div>';
    return;
  }

  // Pagination: only render current page
  const startIdx = rung1CurrentPage * RUNG1_ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + RUNG1_ITEMS_PER_PAGE, tokens.length);
  const pageTokens = tokens.slice(startIdx, endIdx);
  const hasMore = endIdx < tokens.length;

  // Use document fragment for better performance
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  // Build HTML string for current page
  let html = '';
  for (const token of pageTokens) {
    const filePath = token.filePath || 'Unknown';
    const fileName = window.escapeHtml ? window.escapeHtml(filePath.split('/').pop()) : filePath.split('/').pop();
    const language = token.language || 'unknown';
    const preview = Array.isArray(token.canonicalSequence) 
      ? token.canonicalSequence.slice(0, 20).join(' ') + (token.canonicalSequence.length > 20 ? '...' : '')
      : (token.canonicalSequence || '').substring(0, 100);
    const escapedPreview = window.escapeHtml ? window.escapeHtml(preview) : preview;
    const timestamp = token.timestamp ? new Date(token.timestamp).toLocaleString() : 'Unknown';
    const tokenId = (token.id || '').replace(/'/g, "\\'");

    html += `
      <div class="rung1-tokens-sequence-item" onclick="selectRung1TokensSequence('${tokenId}')">
        <div class="rung1-tokens-sequence-header">
          <div>
            <div class="rung1-tokens-sequence-file">${fileName}</div>
            <div class="rung1-tokens-sequence-meta">${language} • ${token.tokenCount || 0} tokens • ${timestamp}</div>
          </div>
        </div>
        <div class="rung1-tokens-sequence-preview">${escapedPreview}</div>
      </div>
    `;
  }

  // Add pagination controls if needed
  if (tokens.length > RUNG1_ITEMS_PER_PAGE) {
    html += `
      <div class="rung1-pagination">
        <button class="btn btn-sm" onclick="rung1PreviousPage()" ${rung1CurrentPage === 0 ? 'disabled' : ''}>
          Previous
        </button>
        <span class="rung1-pagination-info">
          Showing ${startIdx + 1}-${endIdx} of ${tokens.length}
        </span>
        <button class="btn btn-sm" onclick="rung1NextPage()" ${!hasMore ? 'disabled' : ''}>
          Next
        </button>
      </div>
    `;
  }

  tempDiv.innerHTML = html;
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }

  sequencesContainer.innerHTML = '';
  sequencesContainer.appendChild(fragment);
}

/**
 * Pagination functions
 */
function rung1NextPage() {
  const tokens = rung1Cache.filtered || window.rung1TokensData || [];
  const maxPage = Math.ceil(tokens.length / RUNG1_ITEMS_PER_PAGE) - 1;
  if (rung1CurrentPage < maxPage) {
    rung1CurrentPage++;
    renderRung1TokensSequences(tokens, false);
  }
}

function rung1PreviousPage() {
  if (rung1CurrentPage > 0) {
    rung1CurrentPage--;
    const tokens = rung1Cache.filtered || window.rung1TokensData || [];
    renderRung1TokensSequences(tokens, false);
  }
}

/**
 * Select a token sequence and show details
 */
function selectRung1TokensSequence(id) {
  const tokens = window.rung1TokensData || [];
  const token = tokens.find(t => t.id === id);
  
  if (!token) return;

  const detailsPanel = document.getElementById('rung1-tokens-details-panel');
  const detailsContent = document.getElementById('rung1-tokens-details-content');
  
  if (!detailsPanel || !detailsContent) return;

  const canonicalSequence = Array.isArray(token.canonicalSequence)
    ? token.canonicalSequence.join(' ')
    : token.canonicalSequence || '';

  const escapedSequence = window.escapeHtml ? window.escapeHtml(canonicalSequence) : canonicalSequence;
  
  detailsContent.innerHTML = `
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">File Path</div>
      <div class="rung1-tokens-detail-value">
        <code style="background: var(--color-bg-secondary, #f5f5f5); padding: 2px 6px; border-radius: 4px;">${token.filePath || 'Unknown'}</code>
        <button class="btn-copy" onclick="copyToClipboard('${(token.filePath || '').replace(/'/g, "\\'")}', event)" title="Copy file path">📋</button>
      </div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">Language</div>
      <div class="rung1-tokens-detail-value">
        <span class="badge badge-language">${token.language || 'unknown'}</span>
      </div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">Token Count</div>
      <div class="rung1-tokens-detail-value">${token.tokenCount || 0}</div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">Identifiers</div>
      <div class="rung1-tokens-detail-value">${token.identifierCount || 0}</div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">String Literals</div>
      <div class="rung1-tokens-detail-value">${token.stringLiteralCount || 0}</div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">Numeric Literals</div>
      <div class="rung1-tokens-detail-value">${token.numericLiteralCount || 0}</div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">Timestamp</div>
      <div class="rung1-tokens-detail-value">${token.timestamp ? new Date(token.timestamp).toLocaleString() : 'Unknown'}</div>
    </div>
    <div class="rung1-tokens-detail-section">
      <div class="rung1-tokens-detail-label">
        Canonical Token Sequence
        <button class="btn-copy" onclick="copyToClipboard('${canonicalSequence.replace(/'/g, "\\'")}', event)" title="Copy sequence">📋</button>
      </div>
      <div class="rung1-tokens-token-sequence">${escapedSequence}</div>
    </div>
  `;

  detailsPanel.style.display = 'flex';
}

/**
 * Close details panel
 */
function closeRung1TokensDetails() {
  const detailsPanel = document.getElementById('rung1-tokens-details-panel');
  if (detailsPanel) {
    detailsPanel.style.display = 'none';
  }
}

/**
 * Apply filters (optimized with caching)
 */
function applyRung1TokensFilters() {
  const search = document.getElementById('rung1-tokens-search')?.value?.toLowerCase() || '';
  const language = document.getElementById('rung1-tokens-filter-language')?.value || '';
  const filePath = document.getElementById('rung1-tokens-filter-filepath')?.value || '';
  
  // Check cache
  const currentFilters = JSON.stringify({ search, language, filePath });
  if (rung1Cache.filtered && rung1Cache.filters === currentFilters) {
    renderRung1TokensSequences(rung1Cache.filtered, true);
    updateRung1TokensDisplayedCount(rung1Cache.filtered.length);
    return;
  }

  const tokens = window.rung1TokensData || [];
  let filtered = tokens;

  // Apply search filter
  if (search) {
    filtered = filtered.filter(t => {
      const filePathMatch = (t.filePath || '').toLowerCase().includes(search);
      const languageMatch = (t.language || '').toLowerCase().includes(search);
      const canonicalMatch = Array.isArray(t.canonicalSequence)
        ? t.canonicalSequence.join(' ').toLowerCase().includes(search)
        : (t.canonicalSequence || '').toLowerCase().includes(search);
      return filePathMatch || languageMatch || canonicalMatch;
    });
  }

  if (language) {
    filtered = filtered.filter(t => t.language === language);
  }

  if (filePath) {
    filtered = filtered.filter(t => (t.filePath || '').includes(filePath));
  }

  // Update cache
  rung1Cache.filtered = filtered;
  rung1Cache.filters = currentFilters;
  rung1Cache.lastUpdate = Date.now();

  renderRung1TokensSequences(filtered, true);
  updateRung1TokensDisplayedCount(filtered.length);
}

/**
 * Update time range
 */
function updateRung1TokensTimeRange(value) {
  const percentage = parseInt(value);
  const display = document.getElementById('rung1-tokens-time-display');
  if (display) {
    display.textContent = percentage === 100 ? 'All Time' : `Last ${percentage}%`;
  }
  
  // Calculate time range based on percentage
  if (percentage < 100 && window.rung1TokensData && window.rung1TokensData.length > 0) {
    const tokens = window.rung1TokensData;
    const timestamps = tokens.map(t => new Date(t.timestamp).getTime()).sort((a, b) => a - b);
    const minTime = timestamps[0];
    const maxTime = timestamps[timestamps.length - 1];
    const timeRange = maxTime - minTime;
    const cutoffTime = maxTime - (timeRange * percentage / 100);
    
    // Filter tokens
    const filtered = tokens.filter(t => new Date(t.timestamp).getTime() >= cutoffTime);
    renderRung1TokensSequences(filtered);
    updateRung1TokensDisplayedCount(filtered.length);
  } else {
    // Show all tokens
    renderRung1TokensSequences(window.rung1TokensData || []);
    updateRung1TokensDisplayedCount(window.rung1TokensData?.length || 0);
  }
}

/**
 * Update displayed count
 */
function updateRung1TokensDisplayedCount(count) {
  const countEl = document.getElementById('rung1-tokens-displayed-count');
  if (countEl) {
    const actualCount = count !== undefined ? count : (window.rung1TokensData || []).length;
    countEl.textContent = `${actualCount} sequences`;
  }
}

/**
 * Refresh data
 */
async function extractRung1Tokens() {
  const extractBtn = document.getElementById('rung1-tokens-extract-btn');
  const sequencesContainer = document.getElementById('rung1-tokens-sequences');
  
  if (!extractBtn || !sequencesContainer) return;
  
  try {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    sequencesContainer.innerHTML = '<div class="rung1-tokens-loading">Extracting tokens from Cursor database... This may take a moment.</div>';
    
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const body = workspace ? { workspace } : { force: true };
    
    const response = await fetch(`${apiBase}/api/rung1/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Extraction failed');
    }
    
    // Show success message
    sequencesContainer.innerHTML = `<div class="rung1-tokens-loading" style="color: var(--color-success);">
      ${data.message || `Extracted ${data.count || 0} token sequences`}. Refreshing...
    </div>`;
    
    // Refresh data
    setTimeout(() => {
      refreshRung1Tokens();
    }, 500);
    
  } catch (error) {
    console.error('[RUNG1] Error extracting tokens:', error);
    sequencesContainer.innerHTML = `<div class="rung1-tokens-loading" style="color: var(--color-error);">
      Extraction failed: ${error.message}. Make sure the companion service is running and has access to the Cursor database.
    </div>`;
  } finally {
    if (extractBtn) {
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extract Data';
    }
  }
}

function refreshRung1Tokens() {
  loadRung1TokensData();
  loadRung1TokensStats();
}

/**
 * Export data
 */
function exportRung1Tokens() {
  try {
    const tokens = window.rung1TokensData || [];
    
    if (tokens.length === 0) {
      alert('No token data available to export. Please load data first.');
      return;
    }
    
    // Get current filters to include in metadata
    const language = document.getElementById('rung1-tokens-filter-language')?.value || '';
    const filePath = document.getElementById('rung1-tokens-filter-filepath')?.value || '';
    const timeRange = document.getElementById('rung1-tokens-time-range')?.value || '100';
    
    // Determine which data to export (filtered or all)
    let dataToExport = tokens;
    if (language || filePath || timeRange !== '100') {
      // Apply filters to get what's currently displayed
      dataToExport = tokens.filter(token => {
        if (language && token.language !== language) return false;
        if (filePath && !(token.filePath || '').includes(filePath)) return false;
        if (timeRange !== '100') {
          const timestamps = tokens.map(t => new Date(t.timestamp).getTime()).sort((a, b) => a - b);
          const minTime = timestamps[0];
          const maxTime = timestamps[timestamps.length - 1];
          const timeRangeMs = maxTime - minTime;
          const cutoffTime = maxTime - (timeRangeMs * parseInt(timeRange) / 100);
          if (new Date(token.timestamp).getTime() < cutoffTime) return false;
        }
        return true;
      });
    }
    
    // Create export data with metadata
    const exportData = {
      version: '1.0',
      rung: 1,
      description: 'Token-level abstraction with canonicalized identifiers',
      exportDate: new Date().toISOString(),
      workspace: getCurrentWorkspace() || 'all',
      filters: {
        language: language || null,
        filePath: filePath || null,
        timeRange: timeRange !== '100' ? `${timeRange}%` : 'all'
      },
      stats: {
        totalTokens: dataToExport.length,
        totalTokenCount: dataToExport.reduce((sum, t) => sum + (t.tokenCount || 0), 0),
        languages: [...new Set(dataToExport.map(t => t.language))].filter(Boolean),
        totalIdentifiers: dataToExport.reduce((sum, t) => sum + (t.identifierCount || 0), 0)
      },
      tokens: dataToExport
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rung1-tokens-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[RUNG1] Export error:', error);
    alert('Failed to export data: ' + error.message);
  }
}

/**
 * Get current workspace
 */
function getCurrentWorkspace() {
  return window.state?.currentWorkspace || null;
}

// Export to window for global access
/**
 * Copy to clipboard helper
 */
function copyToClipboard(text, event) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      // Show temporary feedback
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
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

window.renderRung1TokensView = renderRung1TokensView;
window.selectRung1TokensSequence = selectRung1TokensSequence;
window.closeRung1TokensDetails = closeRung1TokensDetails;
window.applyRung1TokensFilters = applyRung1TokensFilters;
window.updateRung1TokensTimeRange = updateRung1TokensTimeRange;
window.extractRung1Tokens = extractRung1Tokens;
window.refreshRung1Tokens = refreshRung1Tokens;
window.exportRung1Tokens = exportRung1Tokens;
window.copyToClipboard = copyToClipboard;
window.rung1NextPage = rung1NextPage;
window.rung1PreviousPage = rung1PreviousPage;

