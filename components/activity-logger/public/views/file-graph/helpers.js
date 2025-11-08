/**
 * File Graph Helper Functions
 * Utility functions for file graph view
 */

/**
 * Get color for file type based on extension
 */
function getFileTypeColor(ext) {
  const colors = {
    'js': '#f7df1e',
    'ts': '#3178c6',
    'py': '#3776ab',
    'html': '#e34c26',
    'css': '#264de4',
    'json': '#00d1b2',
    'md': '#083fa1'
  };
  return colors[ext] || '#64748b';
}

/**
 * Show file information in modal
 */
function showFileInfo(file) {
  const modal = document.getElementById('eventModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');
  
  if (!modal || !title || !body) {
    console.warn('Modal elements not found');
    return;
  }
  
  title.textContent = `File: ${file.name}`;
  
  body.innerHTML = `
    <div class="file-info-section">
      <div>
        <h4>File Information</h4>
        <div class="file-info-grid">
          <div class="file-info-row">
            <span class="file-info-label">Path:</span>
            <span class="file-info-value mono" title="${window.escapeHtml ? window.escapeHtml(file.path) : file.path}">${window.escapeHtml ? window.escapeHtml(window.truncate ? window.truncate(file.path, 50) : file.path) : (window.truncate ? window.truncate(file.path, 50) : file.path)}</span>
          </div>
          <div class="file-info-row">
            <span class="file-info-label">Type:</span>
            <span class="badge" style="background: var(--color-bg-alt); color: var(--color-text); border: 2px solid ${getFileTypeColor(file.ext)}; font-weight: 600; font-family: var(--font-mono);">${file.ext.toUpperCase()}</span>
          </div>
          <div class="file-info-row">
            <span class="file-info-label">Total Changes:</span>
            <span class="file-info-value bold">${file.changes}</span>
          </div>
          <div class="file-info-row">
            <span class="file-info-label">Last Modified:</span>
            <span class="file-info-value">${window.formatTimeAgo ? window.formatTimeAgo(file.lastModified) : new Date(file.lastModified).toLocaleString()}</span>
          </div>
        </div>
      </div>
      
      <div>
        <h4>Recent Events (${file.events.length})</h4>
        <div class="file-events-list">
          ${file.events.slice(-10).reverse().map(event => `
            <div class="file-event-item">
              <div class="file-event-header">
                <span class="file-event-time">
                  ${window.formatTimeAgo ? window.formatTimeAgo(event.timestamp) : new Date(event.timestamp).toLocaleString()}
                </span>
                <span class="badge">${window.escapeHtml ? window.escapeHtml(event.type || 'file_change') : (event.type || 'file_change')}</span>
              </div>
              <div class="file-event-description">
                ${window.escapeHtml ? window.escapeHtml(event.description || event.title || 'File modified') : (event.description || event.title || 'File modified')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
}

/**
 * Reset file graph controls to defaults
 */
function resetFileGraph() {
  // Reset all controls
  const vizMode = document.getElementById('vizMode');
  const layoutAlgorithm = document.getElementById('layoutAlgorithm');
  const graphMetric = document.getElementById('graphMetric');
  const reductionMethod = document.getElementById('reductionMethod');
  const clustering = document.getElementById('clustering');
  const similarityThreshold = document.getElementById('similarityThreshold');
  const thresholdValue = document.getElementById('thresholdValue');
  
  if (vizMode) vizMode.value = 'network';
  if (layoutAlgorithm) layoutAlgorithm.value = 'force';
  if (graphMetric) graphMetric.value = 'semantic';
  if (reductionMethod) reductionMethod.value = 'pca';
  if (clustering) clustering.value = 'none';
  if (similarityThreshold) similarityThreshold.value = 0.3;
  if (thresholdValue) thresholdValue.textContent = '0.3';
  
  // Select all file types in dropdown
  const fileTypeFilter = document.getElementById('fileTypeFilter');
  if (fileTypeFilter) {
    Array.from(fileTypeFilter.options).forEach(option => option.selected = true);
  }
  
  if (window.updateFileGraph) {
    window.updateFileGraph();
  }
}

/**
 * Reset file graph zoom (alias for resetFileGraph)
 */
function resetFileGraphZoom() {
  resetFileGraph();
}

// Export to window for global access
window.getFileTypeColor = getFileTypeColor;
window.showFileInfo = showFileInfo;
window.resetFileGraph = resetFileGraph;
window.resetFileGraphZoom = resetFileGraphZoom;

