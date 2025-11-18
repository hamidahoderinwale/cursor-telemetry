/**
 * Rung 3 Functions View
 * Main entry point for the Function-Level Abstraction view
 */

// Performance optimization: Cache for filtered results
const rung3Cache = {
  filtered: null,
  filters: null,
  lastUpdate: 0
};

// Performance optimization: Pagination constants
const RUNG3_ITEMS_PER_PAGE = 50;
let rung3CurrentPage = 0;

if (!window.renderRung3FunctionsTemplate) {
  const templatesScript = document.createElement('script');
  templatesScript.src = 'views/rung3-functions/templates.js';
  templatesScript.async = false;
  document.head.appendChild(templatesScript);
}

function renderRung3FunctionsView(container) {
  container.innerHTML = window.renderRung3FunctionsTemplate();
  
  // Setup debounced filter handler
  const searchInput = document.getElementById('rung3-functions-search');
  const filePathInput = document.getElementById('rung3-functions-filter-filepath');
  if (searchInput && window.debounce) {
    searchInput.addEventListener('input', window.debounce(applyRung3FunctionsFilters, 300));
  }
  if (filePathInput && window.debounce) {
    filePathInput.addEventListener('input', window.debounce(applyRung3FunctionsFilters, 300));
  }
  
  // Reset pagination
  rung3CurrentPage = 0;
  
  loadRung3FunctionsData();
}

/**
 * Load Rung 3 data
 */
async function loadRung3FunctionsData() {
  await Promise.all([
    loadRung3FunctionChanges(),
    loadRung3Functions(),
    loadRung3CallGraph(),
    loadRung3Stats()
  ]);
}

/**
 * Load function changes
 */
async function loadRung3FunctionChanges() {
  const listContainer = document.getElementById('rung3-functions-changes-list');
  if (!listContainer) return;

  try {
    listContainer.innerHTML = '<div class="rung3-functions-loading">Loading function changes...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung3/changes?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung3/changes`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load function changes');
    }

    window.rung3ChangesData = data.changes || [];
    renderRung3FunctionChanges(window.rung3ChangesData);
    updateRung3ChangesDisplayedCount();
  } catch (error) {
    // Only log non-404 errors (404 means service not available)
    if (!error.message.includes('404')) {
      console.error('[RUNG3] Error loading function changes:', error);
    }
    window.rung3ChangesData = [];
    listContainer.innerHTML = `
      <div class="rung3-functions-loading" style="color: var(--color-text-muted); padding: 2rem; text-align: center;">
        <div style="margin-bottom: 1rem;">No function changes found.</div>
        <div style="font-size: 0.9rem; margin-bottom: 1rem;">
          Click "Extract Data" to process function changes from your Cursor database, or wait for automatic processing.
        </div>
        <button class="btn btn-sm" onclick="extractRung3Functions()" style="margin-top: 0.5rem;">
          Extract Data Now
        </button>
      </div>
    `;
    updateRung3ChangesDisplayedCount(0);
  }
}

/**
 * Load functions
 */
async function loadRung3Functions() {
  const listContainer = document.getElementById('rung3-functions-functions-list');
  if (!listContainer) return;

  try {
    listContainer.innerHTML = '<div class="rung3-functions-loading">Loading functions...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung3/functions?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung3/functions`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load functions');
    }

    window.rung3FunctionsData = data.functions || [];
    renderRung3Functions(window.rung3FunctionsData);
    updateRung3FunctionsDisplayedCount();
  } catch (error) {
    // Only log non-404 errors (404 means service not available)
    if (!error.message.includes('404')) {
      console.error('[RUNG3] Error loading functions:', error);
    }
    listContainer.innerHTML = `
      <div class="rung3-functions-loading" style="color: var(--color-text-muted);">
        Functions not available. Data will appear once the service is initialized.
      </div>
    `;
  }
}

/**
 * Load call graph
 */
async function loadRung3CallGraph() {
  const graphContainer = document.getElementById('rung3-functions-callgraph');
  if (!graphContainer) return;

  try {
    graphContainer.innerHTML = '<div class="rung3-functions-loading">Loading call graph...</div>';

    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung3/callgraph?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung3/callgraph`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load call graph');
    }

    window.rung3CallGraphData = data.callgraph || { nodes: [], edges: [] };
    renderRung3CallGraph(window.rung3CallGraphData);
    updateRung3CallGraphStats();
  } catch (error) {
    // Only log non-404 errors (404 means service not available)
    if (!error.message.includes('404')) {
      console.error('[RUNG3] Error loading call graph:', error);
    }
    graphContainer.innerHTML = `
      <div class="rung3-functions-loading" style="color: var(--color-text-muted);">
        Call graph not available. Data will appear once the service is initialized.
      </div>
    `;
  }
}

/**
 * Load statistics
 */
async function loadRung3Stats() {
  try {
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const url = workspace 
      ? `${apiBase}/api/rung3/stats?workspace=${encodeURIComponent(workspace)}`
      : `${apiBase}/api/rung3/stats`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load statistics');
    }

    const stats = data.stats || {};
    const changes = window.rung3ChangesData || [];
    const functions = window.rung3FunctionsData || [];
    const callGraph = window.rung3CallGraphData || { nodes: [], edges: [] };
    
    // Update stat cards
    const totalCountEl = document.getElementById('rung3-functions-total-count');
    if (totalCountEl) totalCountEl.textContent = changes.length;
    
    const functionCountEl = document.getElementById('rung3-functions-function-count');
    if (functionCountEl) functionCountEl.textContent = functions.length;
    
    const nodeCountEl = document.getElementById('rung3-functions-node-count');
    if (nodeCountEl) nodeCountEl.textContent = callGraph.nodes?.length || 0;
    
    const edgeCountEl = document.getElementById('rung3-functions-edge-count');
    if (edgeCountEl) edgeCountEl.textContent = callGraph.edges?.length || 0;
  } catch (error) {
    // Only log non-404 errors (404 means service not available)
    if (!error.message.includes('404')) {
      console.error('[RUNG3] Error loading statistics:', error);
    }
  }
}

/**
 * Render function changes list (optimized with pagination)
 */
function renderRung3FunctionChanges(changes, resetPagination = false) {
  const listContainer = document.getElementById('rung3-functions-changes-list');
  if (!listContainer) return;

  if (resetPagination) {
    rung3CurrentPage = 0;
  }

  if (!changes || changes.length === 0) {
    listContainer.innerHTML = '<div class="rung3-functions-loading">No function changes found</div>';
    updateRung3ChangesDisplayedCount(0);
    return;
  }

  // Pagination: only render current page
  const startIdx = rung3CurrentPage * RUNG3_ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + RUNG3_ITEMS_PER_PAGE, changes.length);
  const pageChanges = changes.slice(startIdx, endIdx);
  const hasMore = endIdx < changes.length;

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  let html = '';
  for (const change of pageChanges) {
    const filePath = change.filePath || 'Unknown';
    const fileName = window.escapeHtml ? window.escapeHtml(filePath.split('/').pop()) : filePath.split('/').pop();
    const functionName = window.escapeHtml ? window.escapeHtml(change.functionName || 'Unknown') : (change.functionName || 'Unknown');
    const timestamp = change.timestamp ? new Date(change.timestamp).toLocaleString() : 'Unknown';
    const changeTypeClass = change.changeType === 'FUNCTION_ADD' ? 'add' : 
                           change.changeType === 'FUNCTION_REMOVE' ? 'remove' : 'modify';
    const changeType = window.escapeHtml ? window.escapeHtml(change.changeType || '') : (change.changeType || '');
    const changeId = (change.id || '').replace(/'/g, "\\'");

    html += `
      <div class="rung3-functions-change-item" onclick="selectRung3Change('${changeId}')">
        <div class="rung3-functions-change-header">
          <div>
            <div class="rung3-functions-change-function">${functionName}</div>
            <div class="rung3-functions-change-meta">${fileName} • ${change.language || 'unknown'} • ${timestamp}</div>
          </div>
          <span class="rung3-functions-change-type-badge ${changeTypeClass}">${changeType}</span>
        </div>
      </div>
    `;
  }

  // Add pagination controls if needed
  if (changes.length > RUNG3_ITEMS_PER_PAGE) {
    html += `
      <div class="rung3-pagination">
        <button class="btn btn-sm" onclick="rung3PreviousPage()" ${rung3CurrentPage === 0 ? 'disabled' : ''}>
          Previous
        </button>
        <span class="rung3-pagination-info">
          Showing ${startIdx + 1}-${endIdx} of ${changes.length}
        </span>
        <button class="btn btn-sm" onclick="rung3NextPage()" ${!hasMore ? 'disabled' : ''}>
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
function rung3NextPage() {
  const changes = rung3Cache.filtered || window.rung3ChangesData || [];
  const maxPage = Math.ceil(changes.length / RUNG3_ITEMS_PER_PAGE) - 1;
  if (rung3CurrentPage < maxPage) {
    rung3CurrentPage++;
    renderRung3FunctionChanges(changes, false);
  }
}

function rung3PreviousPage() {
  if (rung3CurrentPage > 0) {
    rung3CurrentPage--;
    const changes = rung3Cache.filtered || window.rung3ChangesData || [];
    renderRung3FunctionChanges(changes, false);
  }
}

/**
 * Render functions list
 */
function renderRung3Functions(functions) {
  const listContainer = document.getElementById('rung3-functions-functions-list');
  if (!listContainer) return;

  if (!functions || functions.length === 0) {
    listContainer.innerHTML = '<div class="rung3-functions-loading">No functions found</div>';
    return;
  }

  const html = functions.map(func => {
    const lastModified = func.lastModified ? new Date(func.lastModified).toLocaleString() : 'Unknown';

    return `
      <div class="rung3-functions-function-item" onclick="selectRung3Function('${func.id}')">
        <div class="rung3-functions-function-header">
          <div>
            <div class="rung3-functions-function-name">${func.functionName || 'Unknown'}</div>
            <div class="rung3-functions-function-meta">${func.parameterCount || 0} params • ${func.returnType || 'unknown'} • ${func.callCount || 0} calls • ${lastModified}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = html;
}

/**
 * Render call graph (enhanced visualization)
 */
function renderRung3CallGraph(callGraph) {
  const graphContainer = document.getElementById('rung3-functions-callgraph');
  if (!graphContainer) return;

  const nodes = callGraph.nodes || [];
  const edges = callGraph.edges || [];

  if (nodes.length === 0 && edges.length === 0) {
    graphContainer.innerHTML = '<div class="rung3-functions-loading">No call graph data available</div>';
    return;
  }

  // Enhanced visualization with better formatting
  let html = '<div class="rung3-callgraph-visualization">';
  
  // Nodes section with better styling
  html += '<div class="rung3-callgraph-section">';
  html += '<h4 class="rung3-callgraph-section-title">Functions (Nodes)</h4>';
  html += '<div class="rung3-callgraph-nodes">';
  
  const displayedNodes = nodes.slice(0, 100);
  for (const node of displayedNodes) {
    const nodeName = window.escapeHtml ? window.escapeHtml(node.name || 'Unknown') : (node.name || 'Unknown');
    html += `
      <div class="rung3-callgraph-node-item">
        <div class="rung3-callgraph-node-name">${nodeName}</div>
        <div class="rung3-callgraph-node-meta">
          ${node.parameterCount !== undefined ? `${node.parameterCount} params` : ''}
          ${node.returnType ? ` • ${node.returnType}` : ''}
        </div>
      </div>
    `;
  }
  if (nodes.length > 100) {
    html += `<div class="rung3-callgraph-more">... and ${nodes.length - 100} more functions</div>`;
  }
  html += '</div></div>';

  // Edges section with better styling
  html += '<div class="rung3-callgraph-section">';
  html += '<h4 class="rung3-callgraph-section-title">Function Calls (Edges)</h4>';
  html += '<div class="rung3-callgraph-edges">';
  
  const displayedEdges = edges.slice(0, 100);
  for (const edge of displayedEdges) {
    const source = window.escapeHtml ? window.escapeHtml(edge.source || 'Unknown') : (edge.source || 'Unknown');
    const target = window.escapeHtml ? window.escapeHtml(edge.target || 'Unknown') : (edge.target || 'Unknown');
    html += `
      <div class="rung3-callgraph-edge-item">
        <span class="rung3-callgraph-edge-source">${source}</span>
        <span class="rung3-callgraph-edge-arrow">→</span>
        <span class="rung3-callgraph-edge-target">${target}</span>
      </div>
    `;
  }
  if (edges.length > 100) {
    html += `<div class="rung3-callgraph-more">... and ${edges.length - 100} more calls</div>`;
  }
  html += '</div></div>';

  html += '</div>';

  graphContainer.innerHTML = html;
}

/**
 * Select a function change and show details
 */
function selectRung3Change(id) {
  const changes = window.rung3ChangesData || [];
  const change = changes.find(c => c.id === id);
  
  if (!change) return;

  const detailsPanel = document.getElementById('rung3-functions-details-panel');
  const detailsContent = document.getElementById('rung3-functions-details-content');
  
  if (!detailsPanel || !detailsContent) return;

  const changeTypeClass = change.changeType === 'FUNCTION_ADD' ? 'add' : 
                         change.changeType === 'FUNCTION_REMOVE' ? 'remove' : 'modify';
  const signatureBeforeJson = change.signatureBefore ? JSON.stringify(change.signatureBefore, null, 2) : '';
  const signatureAfterJson = change.signatureAfter ? JSON.stringify(change.signatureAfter, null, 2) : '';
  const parameterChangesJson = change.parameterChanges ? JSON.stringify(change.parameterChanges, null, 2) : '';
  
  detailsContent.innerHTML = `
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Change Type</div>
      <div class="rung3-functions-detail-value">
        <span class="rung3-functions-change-type-badge ${changeTypeClass}">${change.changeType || 'Unknown'}</span>
      </div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Function</div>
      <div class="rung3-functions-detail-value">
        <code style="background: var(--color-bg-secondary, #f5f5f5); padding: 2px 6px; border-radius: 4px;">${change.functionName || 'Unknown'}</code>
      </div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">File Path</div>
      <div class="rung3-functions-detail-value">
        <code style="background: var(--color-bg-secondary, #f5f5f5); padding: 2px 6px; border-radius: 4px;">${change.filePath || 'Unknown'}</code>
        <button class="btn-copy" onclick="copyToClipboard('${(change.filePath || '').replace(/'/g, "\\'")}', event)" title="Copy file path">📋</button>
      </div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Language</div>
      <div class="rung3-functions-detail-value">
        <span class="badge badge-language">${change.language || 'unknown'}</span>
      </div>
    </div>
    ${change.signatureBefore ? `
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">
        Signature Before
        <button class="btn-copy" onclick="copyToClipboard('${signatureBeforeJson.replace(/'/g, "\\'")}', event)" title="Copy signature">📋</button>
      </div>
      <div class="rung3-functions-detail-value">
        <pre style="font-size: var(--text-xs, 0.75rem); background: var(--color-bg-secondary, #f5f5f5); padding: var(--space-md, 1rem); border-radius: var(--radius-sm, 0.125rem); overflow-x: auto;">${window.escapeHtml ? window.escapeHtml(signatureBeforeJson) : signatureBeforeJson}</pre>
      </div>
    </div>
    ` : ''}
    ${change.signatureAfter ? `
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">
        Signature After
        <button class="btn-copy" onclick="copyToClipboard('${signatureAfterJson.replace(/'/g, "\\'")}', event)" title="Copy signature">📋</button>
      </div>
      <div class="rung3-functions-detail-value">
        <pre style="font-size: var(--text-xs, 0.75rem); background: var(--color-bg-secondary, #f5f5f5); padding: var(--space-md, 1rem); border-radius: var(--radius-sm, 0.125rem); overflow-x: auto;">${window.escapeHtml ? window.escapeHtml(signatureAfterJson) : signatureAfterJson}</pre>
      </div>
    </div>
    ` : ''}
    ${change.parameterChanges ? `
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">
        Parameter Changes
        <button class="btn-copy" onclick="copyToClipboard('${parameterChangesJson.replace(/'/g, "\\'")}', event)" title="Copy changes">📋</button>
      </div>
      <div class="rung3-functions-detail-value">
        <pre style="font-size: var(--text-xs, 0.75rem); background: var(--color-bg-secondary, #f5f5f5); padding: var(--space-md, 1rem); border-radius: var(--radius-sm, 0.125rem); overflow-x: auto;">${window.escapeHtml ? window.escapeHtml(parameterChangesJson) : parameterChangesJson}</pre>
      </div>
    </div>
    ` : ''}
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Return Type Changed</div>
      <div class="rung3-functions-detail-value">${change.returnTypeChanged ? '<span style="color: var(--color-success, #10b981);">Yes</span>' : '<span style="color: var(--color-text-muted, #666);">No</span>'}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Timestamp</div>
      <div class="rung3-functions-detail-value">${change.timestamp ? new Date(change.timestamp).toLocaleString() : 'Unknown'}</div>
    </div>
  `;

  detailsPanel.style.display = 'flex';
}

/**
 * Select a function and show details
 */
function selectRung3Function(id) {
  const functions = window.rung3FunctionsData || [];
  const func = functions.find(f => f.id === id);
  
  if (!func) return;

  const detailsPanel = document.getElementById('rung3-functions-details-panel');
  const detailsContent = document.getElementById('rung3-functions-details-content');
  
  if (!detailsPanel || !detailsContent) return;

  detailsContent.innerHTML = `
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Function Name</div>
      <div class="rung3-functions-detail-value">${func.functionName || 'Unknown'}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Canonical Signature</div>
      <div class="rung3-functions-detail-value">${func.canonicalSignature || 'Unknown'}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Parameter Count</div>
      <div class="rung3-functions-detail-value">${func.parameterCount || 0}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Return Type</div>
      <div class="rung3-functions-detail-value">${func.returnType || 'unknown'}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Call Count</div>
      <div class="rung3-functions-detail-value">${func.callCount || 0}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">First Seen</div>
      <div class="rung3-functions-detail-value">${func.firstSeen ? new Date(func.firstSeen).toLocaleString() : 'Unknown'}</div>
    </div>
    <div class="rung3-functions-detail-section">
      <div class="rung3-functions-detail-label">Last Modified</div>
      <div class="rung3-functions-detail-value">${func.lastModified ? new Date(func.lastModified).toLocaleString() : 'Unknown'}</div>
    </div>
  `;

  detailsPanel.style.display = 'flex';
}

/**
 * Close details panel
 */
function closeRung3FunctionsDetails() {
  const detailsPanel = document.getElementById('rung3-functions-details-panel');
  if (detailsPanel) {
    detailsPanel.style.display = 'none';
  }
}

/**
 * Switch tabs
 */
function switchRung3Tab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.rung3-functions-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(`rung3-tab-${tabName}`)?.classList.add('active');

  // Update tab content
  document.querySelectorAll('.rung3-functions-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`rung3-tab-content-${tabName}`)?.classList.add('active');
}

/**
 * Apply filters (optimized with caching)
 */
function applyRung3FunctionsFilters() {
  const search = document.getElementById('rung3-functions-search')?.value?.toLowerCase() || '';
  const changeType = document.getElementById('rung3-functions-filter-change-type')?.value || '';
  const language = document.getElementById('rung3-functions-filter-language')?.value || '';
  const filePath = document.getElementById('rung3-functions-filter-filepath')?.value || '';
  
  // Check cache
  const currentFilters = JSON.stringify({ search, changeType, language, filePath });
  if (rung3Cache.filtered && rung3Cache.filters === currentFilters) {
    renderRung3FunctionChanges(rung3Cache.filtered, true);
    updateRung3ChangesDisplayedCount(rung3Cache.filtered.length);
    return;
  }
  
  const changes = window.rung3ChangesData || [];
  let filtered = changes;

  // Apply search filter
  if (search) {
    filtered = filtered.filter(c => {
      const filePathMatch = (c.filePath || '').toLowerCase().includes(search);
      const languageMatch = (c.language || '').toLowerCase().includes(search);
      const functionNameMatch = (c.functionName || '').toLowerCase().includes(search);
      const changeTypeMatch = (c.changeType || '').toLowerCase().includes(search);
      return filePathMatch || languageMatch || functionNameMatch || changeTypeMatch;
    });
  }

  if (changeType) {
    filtered = filtered.filter(c => c.changeType === changeType);
  }

  if (language) {
    filtered = filtered.filter(c => c.language === language);
  }

  if (filePath) {
    filtered = filtered.filter(c => (c.filePath || '').includes(filePath));
  }

  // Update cache
  rung3Cache.filtered = filtered;
  rung3Cache.filters = currentFilters;
  rung3Cache.lastUpdate = Date.now();

  renderRung3FunctionChanges(filtered, true);
  updateRung3ChangesDisplayedCount(filtered.length);
}

/**
 * Update displayed counts
 */
function updateRung3ChangesDisplayedCount(count) {
  const countEl = document.getElementById('rung3-functions-changes-displayed-count');
  if (countEl) {
    const actualCount = count !== undefined ? count : (window.rung3ChangesData || []).length;
    if (actualCount === 0) {
      countEl.textContent = 'No function changes found';
    } else {
      countEl.textContent = `${actualCount} ${actualCount === 1 ? 'change' : 'changes'}`;
    }
  }
}

function updateRung3FunctionsDisplayedCount(count) {
  const countEl = document.getElementById('rung3-functions-functions-displayed-count');
  if (countEl) {
    const actualCount = count !== undefined ? count : (window.rung3FunctionsData || []).length;
    countEl.textContent = `${actualCount} functions`;
  }
}

function updateRung3CallGraphStats() {
  const callGraph = window.rung3CallGraphData || { nodes: [], edges: [] };
  const nodeCountEl = document.getElementById('rung3-functions-callgraph-node-count');
  const edgeCountEl = document.getElementById('rung3-functions-callgraph-edge-count');
  
  if (nodeCountEl) {
    nodeCountEl.textContent = `${callGraph.nodes?.length || 0} nodes`;
  }
  if (edgeCountEl) {
    edgeCountEl.textContent = `${callGraph.edges?.length || 0} edges`;
  }
}

/**
 * Refresh data
 */
async function extractRung3Functions() {
  const extractBtn = document.getElementById('rung3-functions-extract-btn');
  const changesContainer = document.getElementById('rung3-functions-changes-list');
  
  if (!extractBtn || !changesContainer) return;
  
  try {
    extractBtn.disabled = true;
    extractBtn.textContent = 'Extracting...';
    changesContainer.innerHTML = '<div class="rung3-functions-loading">Extracting function changes from Cursor database... This may take a moment.</div>';
    
    const apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    const workspace = getCurrentWorkspace();
    const body = workspace ? { workspace } : { force: true };
    
    const response = await fetch(`${apiBase}/api/rung3/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Extraction failed');
    }
    
    // Show success message
    changesContainer.innerHTML = `<div class="rung3-functions-loading" style="color: var(--color-success);">
      ${data.message || `Extracted ${data.changes || 0} function changes`}. Refreshing...
    </div>`;
    
    // Refresh data
    setTimeout(() => {
      refreshRung3Functions();
    }, 500);
    
  } catch (error) {
    console.error('[RUNG3] Error extracting function changes:', error);
    changesContainer.innerHTML = `<div class="rung3-functions-loading" style="color: var(--color-error);">
      Extraction failed: ${error.message}. Make sure the companion service is running and has access to the Cursor database.
    </div>`;
  } finally {
    if (extractBtn) {
      extractBtn.disabled = false;
      extractBtn.textContent = 'Extract Data';
    }
  }
}

function refreshRung3Functions() {
  loadRung3FunctionsData();
}

/**
 * Export data
 */
function exportRung3Functions() {
  try {
    const changes = window.rung3ChangesData || [];
    const functions = window.rung3FunctionsData || [];
    const callGraph = window.rung3CallGraphData || { nodes: [], edges: [] };
    
    if (changes.length === 0 && functions.length === 0 && (!callGraph.nodes || callGraph.nodes.length === 0)) {
      alert('No function data available to export. Please load data first.');
      return;
    }
    
    // Get current filters to include in metadata
    const changeType = document.getElementById('rung3-functions-filter-change-type')?.value || '';
    const language = document.getElementById('rung3-functions-filter-language')?.value || '';
    const filePath = document.getElementById('rung3-functions-filter-filepath')?.value || '';
    
    // Determine which data to export (filtered or all)
    let changesToExport = changes;
    if (changeType || language || filePath) {
      changesToExport = changes.filter(change => {
        if (changeType && change.changeType !== changeType) return false;
        if (language && change.language !== language) return false;
        if (filePath && !(change.filePath || '').includes(filePath)) return false;
        return true;
      });
    }
    
    // Calculate stats
    const changeTypes = [...new Set(changesToExport.map(c => c.changeType))].filter(Boolean);
    const languages = [...new Set([...changesToExport.map(c => c.language), ...functions.map(f => f.language)])].filter(Boolean);
    
    // Create export data with metadata
    const exportData = {
      version: '1.0',
      rung: 3,
      description: 'Function-level changes and callgraph updates',
      exportDate: new Date().toISOString(),
      workspace: getCurrentWorkspace() || 'all',
      filters: {
        changeType: changeType || null,
        language: language || null,
        filePath: filePath || null
      },
      stats: {
        totalChanges: changesToExport.length,
        totalFunctions: functions.length,
        callGraphNodes: callGraph.nodes?.length || 0,
        callGraphEdges: callGraph.edges?.length || 0,
        changeTypes: changeTypes,
        languages: languages
      },
      changes: changesToExport,
      functions: functions,
      callGraph: callGraph
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rung3-functions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[RUNG3] Export error:', error);
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

window.renderRung3FunctionsView = renderRung3FunctionsView;
window.selectRung3Change = selectRung3Change;
window.selectRung3Function = selectRung3Function;
window.closeRung3FunctionsDetails = closeRung3FunctionsDetails;
window.switchRung3Tab = switchRung3Tab;
window.applyRung3FunctionsFilters = applyRung3FunctionsFilters;
window.extractRung3Functions = extractRung3Functions;
window.refreshRung3Functions = refreshRung3Functions;
window.exportRung3Functions = exportRung3Functions;
window.rung3NextPage = rung3NextPage;
window.rung3PreviousPage = rung3PreviousPage;

