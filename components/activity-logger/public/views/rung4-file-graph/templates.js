/**
 * Rung 4 File Graph Templates
 */

function renderRung4FileGraphTemplate() {
  return `
    <div class="rung4-file-graph-view">
      <!-- Header -->
      <div class="rung4-header">
        <div class="rung4-title-section">
          <h1 class="rung4-title">Module Graph</h1>
          <p class="rung4-subtitle">Content-free, compositional system graph with typed signals (imports, calls, context, navigation, tools)</p>
        </div>
        <div class="rung4-actions">
          <button class="btn btn-sm" id="rung4-refresh-btn" onclick="refreshRung4Graph()">
            Refresh
          </button>
          <button class="btn btn-sm" id="rung4-export-btn" onclick="exportRung4Graph()">
            Export
          </button>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="rung4-controls-bar">
        <!-- File Type Filter -->
        <div class="control-group">
          <label class="control-label">Type</label>
          <select id="rung4-filter-type" class="control-select" onchange="applyRung4Filters()">
            <option value="">All</option>
            <option value="file">Files</option>
            <option value="directory">Directories</option>
          </select>
        </div>

        <!-- Language Filter -->
        <div class="control-group">
          <label class="control-label">Language</label>
          <select id="rung4-filter-lang" class="control-select" onchange="applyRung4Filters()">
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
              <input type="checkbox" id="rung4-edge-import" checked onchange="applyRung4Filters()">
              <span>IMPORT</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="rung4-edge-call" checked onchange="applyRung4Filters()">
              <span>CALL</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="rung4-edge-context" checked onchange="applyRung4Filters()">
              <span>MODEL_CONTEXT</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="rung4-edge-nav" checked onchange="applyRung4Filters()">
              <span>NAVIGATE</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="rung4-edge-tool" checked onchange="applyRung4Filters()">
              <span>TOOL</span>
            </label>
          </div>
        </div>

        <!-- Layout Options -->
        <div class="control-group">
          <label class="control-label">Layout</label>
          <select id="rung4-layout" class="control-select" onchange="changeRung4Layout()">
            <option value="force">Force-Directed</option>
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
            <option value="matrix">Matrix</option>
          </select>
        </div>

        <!-- Time Range -->
        <div class="control-group">
          <label class="control-label">Time Range</label>
          <input type="range" id="rung4-time-range" class="control-range" min="0" max="100" value="100" oninput="updateRung4TimeRange(this.value)">
          <div class="control-range-labels">
            <span>All Time</span>
            <span id="rung4-time-display">All Time</span>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="rung4-main-content">
        <!-- Graph Visualization -->
        <div class="rung4-graph-container">
          <div class="rung4-graph-header">
            <h3 class="rung4-section-title">Module Graph</h3>
            <div class="rung4-graph-stats" id="rung4-graph-stats">
              <span id="rung4-node-count">0 nodes</span>
              <span id="rung4-edge-count">0 edges</span>
            </div>
          </div>
          <div class="rung4-graph" id="rung4-graph">
            <div class="rung4-loading">Loading module graph...</div>
          </div>
          <div class="rung4-legend">
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
        <div class="rung4-details-panel">
          <div class="rung4-details-header">
            <h3 class="rung4-section-title">Details</h3>
            <button class="btn-icon" id="rung4-details-close" onclick="closeRung4Details()">×</button>
          </div>
          <div class="rung4-details-content" id="rung4-details-content">
            <div class="rung4-details-placeholder">
              <p>Click a node or edge to view details</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Event Timeline -->
      <div class="rung4-timeline-container">
        <div class="rung4-timeline-header">
          <h3 class="rung4-section-title">Structural Events Timeline</h3>
          <div class="rung4-timeline-controls">
            <select id="rung4-event-filter" class="control-select" onchange="updateRung4Timeline()">
              <option value="">All Events</option>
              <option value="FILE_EDIT">File Edits</option>
              <option value="IMPORT_ADD">Import Add</option>
              <option value="IMPORT_REMOVE">Import Remove</option>
              <option value="AI_SUGGEST_EDIT">AI Suggestions</option>
              <option value="NAVIGATE">Navigation</option>
            </select>
          </div>
        </div>
        <div class="rung4-timeline" id="rung4-timeline">
          <div class="rung4-timeline-loading">Loading events...</div>
        </div>
      </div>
    </div>
  `;
}

// Export to window
window.renderRung4FileGraphTemplate = renderRung4FileGraphTemplate;

