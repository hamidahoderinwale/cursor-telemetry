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

      <!-- Methodology Section -->
      <div class="rung-methodology-section">
        <button class="rung-methodology-toggle" onclick="toggleRung1Methodology()">
          <span class="rung-methodology-icon"></span>
          <span class="rung-methodology-title">Methodology</span>
          <span class="rung-methodology-arrow" id="rung1-methodology-arrow"></span>
        </button>
        <div class="rung-methodology-content" id="rung1-methodology-content" style="display: none;">
          <div class="rung-methodology-body">
            <h3>Overview</h3>
            <p>Rung 1 provides the most granular abstraction level by converting source code into token sequences with canonicalized identifiers. This preserves the structural patterns of code while removing all semantic meaning and sensitive information.</p>
            
            <h3>Processing Pipeline</h3>
            <ol>
              <li><strong>Code Extraction</strong>: Extracts code diffs from Cursor database file metadata</li>
              <li><strong>Language Detection</strong>: Identifies programming language from file extension (JavaScript, TypeScript, Python, Java, Go, Rust, etc.)</li>
              <li><strong>Tokenization</strong>: Converts source code into token sequences using language-specific parsers
                <ul>
                  <li>Preserves keywords, operators, and structural elements</li>
                  <li>Identifies identifiers, string literals, numeric literals</li>
                </ul>
              </li>
              <li><strong>Canonicalization</strong>: Replaces identifiers with stable canonical IDs
                <ul>
                  <li>Functions → FUNC_001, FUNC_002, ...</li>
                  <li>Classes → CLASS_001, CLASS_002, ...</li>
                  <li>Variables → VAR_001, VAR_002, ...</li>
                  <li>Generic identifiers → ID_001, ID_002, ...</li>
                </ul>
              </li>
              <li><strong>PII Redaction</strong>: Applies privacy-preserving transformations
                <ul>
                  <li>String literals → &lt;STR&gt; (or selective redaction based on PII detection)</li>
                  <li>Numeric literals → &lt;NUM&gt; (or selective redaction for PII-like numbers)</li>
                  <li>Detects and redacts: emails, names, URLs, IP addresses, file paths, JWT secrets</li>
                </ul>
              </li>
              <li><strong>Semantic Expressiveness Fuzzing</strong> (optional): Preserves type distinctions (FUNC, CLASS, VAR) while anonymizing names</li>
            </ol>

            <h3>Privacy Features</h3>
            <ul>
              <li><strong>Granular PII Detection</strong>: Pattern-based detection for emails, names, URLs, IPs, file paths, JWT secrets</li>
              <li><strong>Configurable Redaction</strong>: Enable/disable specific PII types per export</li>
              <li><strong>Selective vs. Aggressive</strong>: Choose between selective PII redaction or redacting all strings/numbers</li>
              <li><strong>No Code Content</strong>: Only token sequences are stored, original code is never persisted</li>
            </ul>

            <h3>Use Cases</h3>
            <ul>
              <li>Pattern mining across codebases without exposing sensitive data</li>
              <li>Code style and structure analysis</li>
              <li>Token-level similarity detection</li>
              <li>Privacy-preserving code sharing and research</li>
            </ul>

            <h3>Output Format</h3>
            <p>Token sequences are represented as arrays of canonical tokens, for example:</p>
            <pre><code>["FUNCTION", "FUNC_001", "(", "VAR_001", ",", "VAR_002", ")", "{", 
 "IF", "(", "VAR_001", ">", "&lt;NUM&gt;", ")", "{", 
 "RETURN", "&lt;STR&gt;", ";", "}", "}"]</code></pre>
          </div>
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

