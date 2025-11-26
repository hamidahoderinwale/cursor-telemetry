/**
 * Historical Mining Templates
 * HTML templates for historical mining view
 */

function renderHistoricalMiningTemplate() {
  return `
    <div class="historical-mining-view">
      <div class="view-header">
        <h1>Historical Data Mining</h1>
        <p class="view-description">
          Mine historical data from git repositories, shell history, Cursor logs, and filesystem timestamps.
          This allows you to reconstruct your development timeline before monitoring started.
        </p>
      </div>

      <!-- Mining Status -->
      <div class="card">
        <div class="card-header">
          <h2>Mining Status</h2>
          <div id="mining-status-display"></div>
        </div>
      </div>

      <!-- Mining Configuration -->
      <div class="card">
        <div class="card-header">
          <h2>Start Mining</h2>
        </div>
        <div class="card-body">
          <div class="mining-form">
            <div class="form-group">
              <label for="mining-workspace-select">Workspace</label>
              <select id="mining-workspace-select" class="form-input">
                <option value="">Select workspace...</option>
              </select>
            </div>

            <div class="form-group">
              <label>Data Sources</label>
              <div class="checkbox-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="include-git" checked>
                  <span>Git History (commits, branches, diffs)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="include-shell" checked>
                  <span>Shell History (bash, zsh commands)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="include-logs" checked>
                  <span>Cursor Logs (recovered prompts)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="include-files" checked>
                  <span>File Timeline (modification timestamps)</span>
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="since-days">History Days</label>
                <input type="number" id="since-days" class="form-input" value="365" min="1" max="3650">
                <small class="form-hint">How many days back to mine (default: 365)</small>
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="include-diffs">
                  <span>Include Full Diffs (slower, larger)</span>
                </label>
              </div>
            </div>

            <div class="form-actions">
              <button id="start-mining-btn" class="btn btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Start Mining
              </button>
            </div>

            <div id="mining-messages" class="mining-messages"></div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card">
        <div class="card-header">
          <h2>Quick Actions</h2>
        </div>
        <div class="card-body">
          <div class="quick-actions-grid">
            <button id="mine-git-btn" class="quick-action-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
              <span>Mine Git Only</span>
            </button>
            <button id="mine-shell-btn" class="quick-action-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" y1="19" x2="20" y2="19"></line>
              </svg>
              <span>Mine Shell Only</span>
            </button>
            <button id="mine-logs-btn" class="quick-action-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Mine Logs Only</span>
            </button>
            <button id="mine-files-btn" class="quick-action-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              <span>Mine Files Only</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Statistics -->
      <div class="card">
        <div class="card-header">
          <h2>Historical Data Statistics</h2>
          <button id="refresh-stats-btn" class="btn btn-sm btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>
        <div class="card-body">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">Git Commits</div>
                <div class="stat-value" id="stat-commits">0</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polyline points="4 17 10 11 4 5"></polyline>
                  <line x1="12" y1="19" x2="20" y2="19"></line>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">Shell Commands</div>
                <div class="stat-value" id="stat-commands">0</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">Recovered Prompts</div>
                <div class="stat-value" id="stat-prompts">0</div>
              </div>
            </div>
            
            <div class="stat-card">
              <div class="stat-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </div>
              <div class="stat-content">
                <div class="stat-label">File Timestamps</div>
                <div class="stat-value" id="stat-files">0</div>
              </div>
            </div>
          </div>
          
          <div class="stats-footer">
            <div class="stats-date-range">
              <strong>Date Range:</strong>
              <span id="stats-date-range">No data</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Mining Runs History -->
      <div class="card">
        <div class="card-header">
          <h2>Mining History</h2>
          <button id="refresh-history-btn" class="btn btn-sm btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>
        <div class="card-body">
          <div id="mining-runs-history"></div>
        </div>
      </div>
    </div>
  `;
}

// Export to window
window.renderHistoricalMiningTemplate = renderHistoricalMiningTemplate;


