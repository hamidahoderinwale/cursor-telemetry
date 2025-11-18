/**
 * Rung 1 Templates
 * Token-level abstraction view templates
 */

function renderRung1TokensTemplate() {
  return `
    <div class="rung1-tokens-view">
      <!-- Header -->
      <div class="rung1-tokens-header">
        <div class="rung1-tokens-title-section">
          <h1 class="rung1-tokens-title">Token-Level Abstraction (Rung 1)</h1>
          <p class="rung1-tokens-subtitle">Token sequences with canonicalized identifiers (ID_001, FUNC_002, &lt;STR&gt;, &lt;NUM&gt;)</p>
        </div>
        <div class="rung1-tokens-actions">
          <button class="btn btn-sm" id="rung1-tokens-extract-btn" onclick="extractRung1Tokens()" title="Extract tokens from Cursor database">
            Extract Data
          </button>
          <button class="btn btn-sm" id="rung1-tokens-refresh-btn" onclick="refreshRung1Tokens()">
            Refresh
          </button>
          <button class="btn btn-sm" id="rung1-tokens-export-btn" onclick="exportRung1Tokens()">
            Export
          </button>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="rung1-tokens-controls-bar">
        <!-- Search -->
        <div class="control-group control-group-search">
          <label class="control-label">Search</label>
          <input type="text" id="rung1-tokens-search" class="control-input control-input-search" placeholder="Search token sequences...">
        </div>

        <!-- Language Filter -->
        <div class="control-group">
          <label class="control-label">Language</label>
          <select id="rung1-tokens-filter-language" class="control-select" onchange="applyRung1TokensFilters()">
            <option value="">All</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </div>

        <!-- File Path Filter -->
        <div class="control-group">
          <label class="control-label">File Path</label>
          <input type="text" id="rung1-tokens-filter-filepath" class="control-input" placeholder="Filter by file path...">
        </div>

        <!-- Time Range -->
        <div class="control-group">
          <label class="control-label">Time Range</label>
          <input type="range" id="rung1-tokens-time-range" class="control-range" min="0" max="100" value="100" oninput="updateRung1TokensTimeRange(this.value)">
          <span id="rung1-tokens-time-display">All Time</span>
        </div>
      </div>

      <!-- Main Content -->
      <div class="rung1-tokens-main-content">
        <!-- Stats Panel -->
        <div class="rung1-tokens-stats-panel">
          <div class="rung1-tokens-stat-card">
            <div class="rung1-tokens-stat-label">Total Token Sequences</div>
            <div class="rung1-tokens-stat-value" id="rung1-tokens-total-count">0</div>
          </div>
          <div class="rung1-tokens-stat-card">
            <div class="rung1-tokens-stat-label">Total Tokens</div>
            <div class="rung1-tokens-stat-value" id="rung1-tokens-token-count">0</div>
          </div>
          <div class="rung1-tokens-stat-card">
            <div class="rung1-tokens-stat-label">Languages</div>
            <div class="rung1-tokens-stat-value" id="rung1-tokens-language-count">0</div>
          </div>
          <div class="rung1-tokens-stat-card">
            <div class="rung1-tokens-stat-label">Identifiers</div>
            <div class="rung1-tokens-stat-value" id="rung1-tokens-identifier-count">0</div>
          </div>
        </div>

        <!-- Token Sequences List -->
        <div class="rung1-tokens-sequences-container">
          <div class="rung1-tokens-sequences-header">
            <h3 class="rung1-tokens-section-title">Token Sequences</h3>
            <div class="rung1-tokens-sequences-stats" id="rung1-tokens-sequences-stats">
              <span id="rung1-tokens-displayed-count">0 sequences</span>
            </div>
          </div>
          <div class="rung1-tokens-sequences" id="rung1-tokens-sequences">
            <div class="rung1-tokens-loading">Loading token sequences...</div>
          </div>
        </div>

        <!-- Details Panel -->
        <div class="rung1-tokens-details-panel" id="rung1-tokens-details-panel" style="display: none;">
          <div class="rung1-tokens-details-header">
            <h3 class="rung1-tokens-section-title">Token Sequence Details</h3>
            <button class="btn-icon" id="rung1-tokens-details-close" onclick="closeRung1TokensDetails()">×</button>
          </div>
          <div class="rung1-tokens-details-content" id="rung1-tokens-details-content">
            <!-- Details will be populated here -->
          </div>
        </div>
      </div>
    </div>
  `;
}

