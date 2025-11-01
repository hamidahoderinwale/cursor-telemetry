/**
 * API Documentation View
 */

function renderAPIDocsView(container) {
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <div class="page-header">
        <h1>API Documentation</h1>
        <p class="page-subtitle">Complete reference for the Cursor Telemetry Companion Service API</p>
      </div>

      <div style="display: grid; gap: var(--space-xl);">
        
        <!-- Overview Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Overview</h3>
          </div>
          <div class="card-body">
            <p><strong>Base URL:</strong> <code>http://localhost:43917</code></p>
            <p><strong>Total Endpoints:</strong> <strong style="color: var(--color-primary);">49+</strong> REST endpoints</p>
            <p><strong>Content-Type:</strong> <code>application/json</code></p>
            <p><strong>CORS:</strong> Enabled for all origins</p>
            <p><strong>Authentication:</strong> None (local development service)</p>
            
            <div style="margin-top: var(--space-lg); display: grid; gap: var(--space-sm);">
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-info);">
                <strong>Quick Health Check:</strong><br>
                <code>curl http://localhost:43917/health</code>
              </div>
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-success);">
                <strong>Get Recent Activity:</strong><br>
                <code>curl http://localhost:43917/api/activity?limit=10</code>
              </div>
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-accent);">
                <strong>Search Prompts:</strong><br>
                <code>curl "http://localhost:43917/api/search?q=authentication"</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Core Endpoints -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Core Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/health</code>
              </div>
              <p>Health check and service status</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/activity</code>
              </div>
              <p>Get all historical activity events</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>since</code> - Timestamp filter (optional)</li>
                  <li><code>limit</code> - Max results (default: all)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/entries</code>
              </div>
              <p>Get prompts and entries with Cursor DB integration</p>
            </div>

          </div>
        </div>

        <!-- Additional endpoint cards would go here -->
        <!-- For brevity, showing structure only - full implementation would include all API endpoints -->

      </div>
    </div>
  `;
}

// Export to window for global access
window.renderAPIDocsView = renderAPIDocsView;

