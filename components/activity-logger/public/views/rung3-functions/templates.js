/**
 * Rung 3 Templates
 * Function-level representation view templates
 */

function renderRung3FunctionsTemplate() {
  return `
    <div class="rung3-functions-view">
      <div class="rung3-functions-header">
        <div class="rung3-functions-title-section">
          <h1 class="rung3-functions-title">Function-Level Abstraction (Rung 3)</h1>
          <p class="rung3-functions-subtitle">Function-level changes and callgraph updates (FUNCTION_ADD, FUNCTION_MODIFY_SIGNATURE, CALLGRAPH_UPDATE, etc.)</p>
        </div>
        <div class="rung3-functions-actions">
          <button class="btn btn-sm" id="rung3-functions-extract-btn" onclick="extractRung3Functions()" title="Extract function changes from Cursor database">
            Extract Data
          </button>
          <button class="btn btn-sm" id="rung3-functions-refresh-btn" onclick="refreshRung3Functions()">
            Refresh
          </button>
          <button class="btn btn-sm" id="rung3-functions-export-btn" onclick="exportRung3Functions()">
            Export
          </button>
        </div>
      </div>

      <!-- Methodology Section -->
      <div class="rung-methodology-section">
        <button class="rung-methodology-toggle" onclick="toggleRung3Methodology()">
          <span class="rung-methodology-icon"></span>
          <span class="rung-methodology-title">Methodology</span>
          <span class="rung-methodology-arrow" id="rung3-methodology-arrow"></span>
        </button>
        <div class="rung-methodology-content" id="rung3-methodology-content" style="display: none;">
          <div class="rung-methodology-body">
            <h3>Overview</h3>
            <p>Rung 3 abstracts code at the function level, tracking function-level changes and building call graphs that represent how functions interact. This provides a higher-level view of code evolution and dependencies.</p>
            
            <h3>Processing Pipeline</h3>
            <ol>
              <li><strong>Code Extraction</strong>: Extracts code diffs from Cursor database file metadata</li>
              <li><strong>Function Extraction</strong>: Identifies and extracts function definitions from code
                <ul>
                  <li>Detects function declarations, methods, constructors</li>
                  <li>Extracts function signatures (name, parameters, return type)</li>
                  <li>Captures function metadata (line numbers, scope, visibility)</li>
                </ul>
              </li>
              <li><strong>Function Change Detection</strong>: Compares functions across diffs to identify changes
                <ul>
                  <li>FUNCTION_ADD: New function introduced</li>
                  <li>FUNCTION_REMOVE: Function deleted</li>
                  <li>FUNCTION_MODIFY: Function body modified</li>
                  <li>FUNCTION_MODIFY_SIGNATURE: Parameters or return type changed</li>
                </ul>
              </li>
              <li><strong>Call Graph Construction</strong>: Builds graph of function calls
                <ul>
                  <li>Nodes: Functions in the codebase</li>
                  <li>Edges: Call relationships between functions</li>
                  <li>Tracks direct and indirect call chains</li>
                </ul>
              </li>
              <li><strong>Call Graph Updates</strong>: Updates graph as functions change
                <ul>
                  <li>CALLGRAPH_UPDATE: New call relationships added</li>
                  <li>Removes edges when functions are deleted</li>
                  <li>Updates edges when signatures change</li>
                </ul>
              </li>
              <li><strong>Signature Matching</strong>: Uses fuzzy matching to track functions across changes
                <ul>
                  <li>Matches functions by name and signature similarity</li>
                  <li>Handles refactoring and renaming</li>
                </ul>
              </li>
            </ol>

            <h3>Function Change Types</h3>
            <ul>
              <li><strong>FUNCTION_ADD</strong>: New function introduced to codebase</li>
              <li><strong>FUNCTION_REMOVE</strong>: Function deleted from codebase</li>
              <li><strong>FUNCTION_MODIFY</strong>: Function body modified (implementation changed)</li>
              <li><strong>FUNCTION_MODIFY_SIGNATURE</strong>: Function signature changed (parameters, return type)</li>
            </ul>

            <h3>Call Graph Representation</h3>
            <ul>
              <li><strong>Nodes</strong>: Represent functions with metadata (name, signature, file location)</li>
              <li><strong>Edges</strong>: Represent call relationships (caller → callee)</li>
              <li><strong>Graph Updates</strong>: Tracks how call graph evolves over time</li>
              <li><strong>Dependency Analysis</strong>: Identifies function dependencies and impact of changes</li>
            </ul>

            <h3>Privacy Features</h3>
            <ul>
              <li><strong>No Code Content</strong>: Only function signatures and call relationships are stored</li>
              <li><strong>Abstract Signatures</strong>: Function names can be canonicalized for additional privacy</li>
              <li><strong>Structural Information Only</strong>: Focuses on "what functions exist" and "how they call each other"</li>
              <li><strong>No Implementation Details</strong>: Function bodies are never stored or analyzed</li>
            </ul>

            <h3>Use Cases</h3>
            <ul>
              <li>Understanding code architecture and function dependencies</li>
              <li>Analyzing impact of function changes on call graph</li>
              <li>Detecting refactoring patterns and function evolution</li>
              <li>Privacy-preserving code structure analysis</li>
            </ul>

            <h3>Output Format</h3>
            <p>Rung 3 provides three main data structures:</p>
            <ul>
              <li><strong>Function Changes</strong>: Array of change events (FUNCTION_ADD, FUNCTION_MODIFY, etc.)</li>
              <li><strong>Functions</strong>: Current snapshot of all functions with signatures and metadata</li>
              <li><strong>Call Graph</strong>: Graph structure with nodes (functions) and edges (call relationships)</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="rung3-functions-controls-bar">
        <!-- Search -->
        <div class="control-group control-group-search">
          <label class="control-label">Search</label>
          <input type="text" id="rung3-functions-search" class="control-input control-input-search" placeholder="Search functions...">
        </div>
        <div class="control-group">
          <label class="control-label">Change Type</label>
          <select id="rung3-functions-filter-change-type" class="control-select" onchange="applyRung3FunctionsFilters()">
            <option value="">All</option>
            <option value="FUNCTION_ADD">Added</option>
            <option value="FUNCTION_REMOVE">Removed</option>
            <option value="FUNCTION_MODIFY">Modified</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">Language</label>
          <select id="rung3-functions-filter-language" class="control-select" onchange="applyRung3FunctionsFilters()">
            <option value="">All</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <div class="control-group">
          <label class="control-label">File Path</label>
          <input type="text" id="rung3-functions-filter-filepath" class="control-input" placeholder="Filter by file path...">
        </div>
      </div>

      <!-- Main Content -->
      <div class="rung3-functions-main-content">
        <!-- Stats Panel -->
        <div class="rung3-functions-stats-panel">
          <div class="rung3-functions-stat-card">
            <div class="rung3-functions-stat-label">Total Changes</div>
            <div class="rung3-functions-stat-value" id="rung3-functions-total-count">0</div>
          </div>
          <div class="rung3-functions-stat-card">
            <div class="rung3-functions-stat-label">Total Functions</div>
            <div class="rung3-functions-stat-value" id="rung3-functions-function-count">0</div>
          </div>
          <div class="rung3-functions-stat-card">
            <div class="rung3-functions-stat-label">Call Graph Nodes</div>
            <div class="rung3-functions-stat-value" id="rung3-functions-node-count">0</div>
          </div>
          <div class="rung3-functions-stat-card">
            <div class="rung3-functions-stat-label">Call Graph Edges</div>
            <div class="rung3-functions-stat-value" id="rung3-functions-edge-count">0</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="rung3-functions-tabs">
          <button class="rung3-functions-tab active" onclick="switchRung3Tab('changes')" id="rung3-tab-changes">
            Function Changes
          </button>
          <button class="rung3-functions-tab" onclick="switchRung3Tab('functions')" id="rung3-tab-functions">
            Functions
          </button>
          <button class="rung3-functions-tab" onclick="switchRung3Tab('callgraph')" id="rung3-tab-callgraph">
            Call Graph
          </button>
        </div>

        <!-- Function Changes Tab -->
        <div class="rung3-functions-tab-content active" id="rung3-tab-content-changes">
          <div class="rung3-functions-list-container">
            <div class="rung3-functions-list-header">
              <h3 class="rung3-functions-section-title">Function Changes</h3>
              <div class="rung3-functions-list-stats" id="rung3-functions-changes-stats">
                <span id="rung3-functions-changes-displayed-count">No function changes found</span>
              </div>
            </div>
            <div class="rung3-functions-list" id="rung3-functions-changes-list">
              <div class="rung3-functions-loading">Loading function changes...</div>
            </div>
          </div>
        </div>

        <!-- Functions Tab -->
        <div class="rung3-functions-tab-content" id="rung3-tab-content-functions">
          <div class="rung3-functions-list-container">
            <div class="rung3-functions-list-header">
              <h3 class="rung3-functions-section-title">Functions</h3>
              <div class="rung3-functions-list-stats" id="rung3-functions-functions-stats">
                <span id="rung3-functions-functions-displayed-count">0 functions</span>
              </div>
            </div>
            <div class="rung3-functions-list" id="rung3-functions-functions-list">
              <div class="rung3-functions-loading">Loading functions...</div>
            </div>
          </div>
        </div>

        <!-- Call Graph Tab -->
        <div class="rung3-functions-tab-content" id="rung3-tab-content-callgraph">
          <div class="rung3-functions-callgraph-container">
            <div class="rung3-functions-callgraph-header">
              <h3 class="rung3-functions-section-title">Call Graph</h3>
              <div class="rung3-functions-callgraph-stats" id="rung3-functions-callgraph-stats">
                <span id="rung3-functions-callgraph-node-count">0 nodes</span>
                <span id="rung3-functions-callgraph-edge-count">0 edges</span>
              </div>
            </div>
            <div class="rung3-functions-callgraph" id="rung3-functions-callgraph">
              <div class="rung3-functions-loading">Loading call graph...</div>
            </div>
          </div>
        </div>

        <!-- Details Panel -->
        <div class="rung3-functions-details-panel" id="rung3-functions-details-panel" style="display: none;">
          <div class="rung3-functions-details-header">
            <h3 class="rung3-functions-section-title">Details</h3>
            <button class="btn-icon" id="rung3-functions-details-close" onclick="closeRung3FunctionsDetails()">×</button>
          </div>
          <div class="rung3-functions-details-content" id="rung3-functions-details-content">
            <!-- Details will be populated here -->
          </div>
        </div>
      </div>
    </div>
  `;
}

