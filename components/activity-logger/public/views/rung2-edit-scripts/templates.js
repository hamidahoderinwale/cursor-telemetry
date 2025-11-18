/**
 * Rung 2 Templates
 * Statement-level (semantic edit scripts) view templates
 */

function renderRung2EditScriptsTemplate() {
  return `
    <div class="rung2-edit-scripts-view">
      <div class="rung2-edit-scripts-header">
        <div class="rung2-edit-scripts-title-section">
          <h1 class="rung2-edit-scripts-title">Statement-Level Abstraction (Rung 2)</h1>
          <p class="rung2-edit-scripts-subtitle">Semantic edit scripts from AST differencing (ADD_IF_CONDITION, ADD_IMPORT, MODIFY_FUNCTION_SIGNATURE, etc.)</p>
        </div>
        <div class="rung2-edit-scripts-actions">
          <button class="btn btn-sm" id="rung2-edit-scripts-extract-btn" onclick="extractRung2EditScripts()" title="Extract edit scripts from Cursor database">
            Extract Data
          </button>
          <button class="btn btn-sm" id="rung2-edit-scripts-refresh-btn" onclick="refreshRung2EditScripts()">
            Refresh
          </button>
          <button class="btn btn-sm" id="rung2-edit-scripts-export-btn" onclick="exportRung2EditScripts()">
            Export
          </button>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="rung2-edit-scripts-controls-bar">
        <!-- Search -->
        <div class="control-group control-group-search">
          <label class="control-label">Search</label>
          <input type="text" id="rung2-edit-scripts-search" class="control-input control-input-search" placeholder="Search edit scripts...">
        </div>
        <div class="control-group">
          <label class="control-label">Language</label>
          <select id="rung2-edit-scripts-filter-language" class="control-select" onchange="applyRung2EditScriptsFilters()">
            <option value="">All</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">File Path</label>
          <input type="text" id="rung2-edit-scripts-filter-filepath" class="control-input" placeholder="Filter by file path...">
        </div>
        <!-- Time Range -->
        <div class="control-group">
          <label class="control-label">Time Range</label>
          <input type="range" id="rung2-edit-scripts-time-range" class="control-range" min="0" max="100" value="100" oninput="updateRung2EditScriptsTimeRange(this.value)">
          <span id="rung2-edit-scripts-time-display">All Time</span>
        </div>
      </div>

      <!-- Main Content -->
      <div class="rung2-edit-scripts-main-content">
        <!-- Stats Panel -->
        <div class="rung2-edit-scripts-stats-panel">
          <div class="rung2-edit-scripts-stat-card">
            <div class="rung2-edit-scripts-stat-label">Total Edit Scripts</div>
            <div class="rung2-edit-scripts-stat-value" id="rung2-edit-scripts-total-count">0</div>
          </div>
          <div class="rung2-edit-scripts-stat-card">
            <div class="rung2-edit-scripts-stat-label">Total Operations</div>
            <div class="rung2-edit-scripts-stat-value" id="rung2-edit-scripts-operation-count">0</div>
          </div>
          <div class="rung2-edit-scripts-stat-card">
            <div class="rung2-edit-scripts-stat-label">Operation Types</div>
            <div class="rung2-edit-scripts-stat-value" id="rung2-edit-scripts-operation-types-count">0</div>
          </div>
        </div>

        <!-- Edit Scripts List -->
        <div class="rung2-edit-scripts-list-container">
          <div class="rung2-edit-scripts-list-header">
            <h3 class="rung2-edit-scripts-section-title">Edit Scripts</h3>
            <div class="rung2-edit-scripts-list-stats" id="rung2-edit-scripts-list-stats">
              <span id="rung2-edit-scripts-displayed-count">0 scripts</span>
            </div>
          </div>
          <div class="rung2-edit-scripts-list" id="rung2-edit-scripts-list">
            <div class="rung2-edit-scripts-loading">Loading edit scripts...</div>
          </div>
        </div>

        <!-- Details Panel -->
        <div class="rung2-edit-scripts-details-panel" id="rung2-edit-scripts-details-panel" style="display: none;">
          <div class="rung2-edit-scripts-details-header">
            <h3 class="rung2-edit-scripts-section-title">Edit Script Details</h3>
            <button class="btn-icon" id="rung2-edit-scripts-details-close" onclick="closeRung2EditScriptsDetails()">×</button>
          </div>
          <div class="rung2-edit-scripts-details-content" id="rung2-edit-scripts-details-content">
            <!-- Details will be populated here -->
          </div>
        </div>
      </div>
    </div>
  `;
}

