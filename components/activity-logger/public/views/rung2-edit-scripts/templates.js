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

      <!-- Methodology Section -->
      <div class="rung-methodology-section">
        <button class="rung-methodology-toggle" onclick="toggleRung2Methodology()">
          <span class="rung-methodology-icon"></span>
          <span class="rung-methodology-title">Methodology</span>
          <span class="rung-methodology-arrow" id="rung2-methodology-arrow"></span>
        </button>
        <div class="rung-methodology-content" id="rung2-methodology-content" style="display: none;">
          <div class="rung-methodology-body">
            <h3>Overview</h3>
            <p>Rung 2 abstracts code changes at the statement level by computing semantic differences between Abstract Syntax Trees (ASTs). Instead of raw tokens, it produces high-level edit operations that describe what changed semantically.</p>
            
            <h3>Processing Pipeline</h3>
            <ol>
              <li><strong>Code Extraction</strong>: Extracts code diffs from Cursor database file metadata</li>
              <li><strong>AST Parsing</strong>: Parses both original and modified code into Abstract Syntax Trees
                <ul>
                  <li>Uses language-specific parsers (Babel for JavaScript/TypeScript, etc.)</ul>
                  <li>Represents code structure as tree of nodes (statements, expressions, declarations)</li>
                </ul>
              </li>
              <li><strong>AST Differencing</strong>: Computes differences between before and after ASTs
                <ul>
                  <li>Identifies added, removed, and modified nodes</li>
                  <li>Maps AST node types to semantic operations</li>
                </ul>
              </li>
              <li><strong>Semantic Operation Extraction</strong>: Converts AST changes into semantic edit operations
                <ul>
                  <li>ADD_IF_CONDITION, ADD_LOOP, ADD_FUNCTION, ADD_IMPORT, ADD_EXPORT</li>
                  <li>MODIFY_ASSIGNMENT, MODIFY_FUNCTION_SIGNATURE, ADD_CALL</li>
                  <li>ADD_CLASS, ADD_TRY, ADD_CATCH, ADD_RETURN</li>
                </ul>
              </li>
              <li><strong>Edit Script Generation</strong>: Groups operations into coherent edit scripts
                <ul>
                  <li>Each script represents a logical change unit</li>
                  <li>Includes metadata: operation types, counts, intent classification</li>
                </ul>
              </li>
            </ol>

            <h3>Semantic Operations</h3>
            <p>Edit scripts capture high-level semantic changes rather than low-level syntax:</p>
            <ul>
              <li><strong>Control Flow</strong>: ADD_IF_CONDITION, ADD_LOOP, ADD_TRY, ADD_CATCH</li>
              <li><strong>Structure</strong>: ADD_FUNCTION, ADD_CLASS, MODIFY_FUNCTION_SIGNATURE</li>
              <li><strong>Dependencies</strong>: ADD_IMPORT, ADD_EXPORT</li>
              <li><strong>Data Flow</strong>: MODIFY_ASSIGNMENT, ADD_CALL, ADD_RETURN</li>
            </ul>

            <h3>Privacy Features</h3>
            <ul>
              <li><strong>No Code Content</strong>: Only semantic operations are stored, no actual code</li>
              <li><strong>Abstract Representation</strong>: Describes "what" changed, not "how" it was implemented</li>
              <li><strong>Intent Classification</strong>: Categorizes changes by intent (bug fix, feature, refactor, test, etc.)</li>
              <li><strong>Operation Statistics</strong>: Provides counts and distributions without exposing details</li>
            </ul>

            <h3>Use Cases</h3>
            <ul>
              <li>Understanding common edit patterns across codebases</li>
              <li>Analyzing development workflows and change types</li>
              <li>Detecting recurring semantic patterns</li>
              <li>Privacy-preserving code change analysis</li>
            </ul>

            <h3>Output Format</h3>
            <p>Edit scripts contain:</p>
            <ul>
              <li>Operation sequence: Array of semantic operations</li>
              <li>Operation types: Distribution of operation categories</li>
              <li>Operation count: Total number of operations</li>
              <li>Intent category: Classified intent (FIX_BUG, ADD_FEATURE, REFACTOR, TEST, etc.)</li>
              <li>Change style: Pattern type (sequence, branch, loop, etc.)</li>
            </ul>
          </div>
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

