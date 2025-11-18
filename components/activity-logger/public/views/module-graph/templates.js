/**
 * Module Graph Templates
 */

function renderModuleGraphTemplate() {
  return `
    <div class="module-graph-view">
      <!-- Header -->
      <div class="module-graph-header">
        <div class="module-graph-title-section">
          <h1 class="module-graph-title">Module Graph</h1>
          <p class="module-graph-subtitle">Content-free, compositional system graph with typed signals (imports, calls, context, navigation, tools)</p>
        </div>
        <div class="module-graph-actions">
          <button class="btn btn-sm" id="module-graph-refresh-btn" onclick="refreshModuleGraph()">
            Refresh
          </button>
          <button class="btn btn-sm" id="module-graph-export-btn" onclick="exportModuleGraph()">
            Export
          </button>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="module-graph-controls-bar">
        <!-- File Type Filter -->
        <div class="control-group">
          <label class="control-label">Type</label>
          <select id="module-graph-filter-type" class="control-select" onchange="applyModuleGraphFilters()">
            <option value="">All</option>
            <option value="file">Files</option>
            <option value="directory">Directories</option>
          </select>
        </div>

        <!-- Language Filter -->
        <div class="control-group">
          <label class="control-label">Language</label>
          <select id="module-graph-filter-lang" class="control-select" onchange="applyModuleGraphFilters()">
            <option value="">All</option>
            <option value="js">JavaScript</option>
            <option value="ts">TypeScript</option>
            <option value="py">Python</option>
            <option value="java">Java</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </div>

        <!-- Edge Type Filter -->
        <div class="control-group">
          <label class="control-label">Edge Types</label>
          <div class="control-checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" id="module-graph-edge-import" checked onchange="applyModuleGraphFilters()">
              <span>IMPORT</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="module-graph-edge-call" checked onchange="applyModuleGraphFilters()">
              <span>CALL</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="module-graph-edge-context" checked onchange="applyModuleGraphFilters()">
              <span>MODEL_CONTEXT</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="module-graph-edge-nav" checked onchange="applyModuleGraphFilters()">
              <span>NAVIGATE</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="module-graph-edge-tool" checked onchange="applyModuleGraphFilters()">
              <span>TOOL</span>
            </label>
          </div>
        </div>

        <!-- Layout Options -->
        <div class="control-group">
          <label class="control-label">Layout</label>
          <select id="module-graph-layout" class="control-select" onchange="changeModuleGraphLayout()">
            <option value="force">Force-Directed</option>
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
            <option value="matrix">Matrix</option>
          </select>
        </div>

        <!-- Time Range -->
        <div class="control-group">
          <label class="control-label">Time Range</label>
          <input type="range" id="module-graph-time-range" class="control-range" min="0" max="100" value="100" oninput="updateModuleGraphTimeRange(this.value)">
          <div class="control-range-labels">
            <span>All Time</span>
            <span id="module-graph-time-display">All Time</span>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="module-graph-main-content">
        <!-- Graph Visualization -->
        <div class="module-graph-graph-container">
          <div class="module-graph-graph-header">
            <h3 class="module-graph-section-title">Module Graph</h3>
            <div class="module-graph-graph-stats" id="module-graph-graph-stats">
              <span id="module-graph-node-count">0 nodes</span>
              <span id="module-graph-edge-count">0 edges</span>
            </div>
          </div>
          <div class="module-graph-graph" id="module-graph-graph">
            <div class="module-graph-loading">Loading module graph...</div>
          </div>
          <div class="module-graph-legend">
            <div class="legend-item">
              <div class="legend-color" style="background: #3b82f6;"></div>
              <span>IMPORT</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #10b981;"></div>
              <span>CALL</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #8b5cf6; border-style: dashed;"></div>
              <span>MODEL_CONTEXT</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #f59e0b; border-style: dotted;"></div>
              <span>NAVIGATE</span>
            </div>
            <div class="legend-item">
              <div class="legend-color" style="background: #ef4444; border-style: dashed;"></div>
              <span>TOOL</span>
            </div>
          </div>
        </div>

        <!-- Details Panel -->
        <div class="module-graph-details-panel">
          <div class="module-graph-details-header">
            <h3 class="module-graph-section-title">Details</h3>
            <button class="btn-icon" id="module-graph-details-close" onclick="closeModuleGraphDetails()">×</button>
          </div>
          <div class="module-graph-details-content" id="module-graph-details-content">
            <div class="module-graph-details-placeholder">
              <p>Click a node or edge to view details</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Event Timeline -->
      <div class="module-graph-timeline-container">
        <div class="module-graph-timeline-header">
          <h3 class="module-graph-section-title">Structural Events Timeline</h3>
          <div class="module-graph-timeline-controls">
            <select id="module-graph-event-filter" class="control-select" onchange="updateModuleGraphTimeline()">
              <option value="">All Events</option>
              <option value="FILE_EDIT">File Edits</option>
              <option value="IMPORT_ADD">Import Add</option>
              <option value="IMPORT_REMOVE">Import Remove</option>
              <option value="AI_SUGGEST_EDIT">AI Suggestions</option>
              <option value="NAVIGATE">Navigation</option>
            </select>
          </div>
        </div>
        <div class="module-graph-timeline" id="module-graph-timeline">
          <div class="module-graph-timeline-loading">Loading events...</div>
        </div>
      </div>
    </div>
  `;
}

// Export to window
window.renderModuleGraphTemplate = renderModuleGraphTemplate;

