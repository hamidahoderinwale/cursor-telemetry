/**
 * API Docs View HTML Templates
 * Template functions for API Documentation view
 */

function renderAPIDocsViewTemplate(data) {
  return `
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
              <details>
                <summary>Response Example</summary>
                <pre><code>{
  "status": "running",
  "timestamp": "2025-10-24T04:00:00.000Z",
  "entries": 811,
  "prompts": 337,
  "queue_length": 26,
  "clipboard_stats": {...},
  "raw_data_stats": {...}
}</code></pre>
              </details>
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
              <details>
                <summary>Response Example</summary>
                <pre><code>[
  {
    "id": "abc123",
    "type": "code_change",
    "timestamp": "2025-10-24T03:30:00.000Z",
    "file_path": "src/index.js",
    "workspace_path": "/Users/dev/project",
    "session_id": "sess_xyz",
    "details": {...}
  }
]</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/entries</code>
              </div>
              <p>Get prompts and entries with Cursor DB integration</p>
              <details>
                <summary>Response Example</summary>
                <pre><code>{
  "entries": [
    {
      "id": 123,
      "text": "Implementing authentication",
      "source": "composer",
      "timestamp": "2025-10-24T03:30:00.000Z",
      "workspacePath": "/Users/dev/project",
      "linesAdded": 247,
      "linesRemoved": 83,
      "contextUsage": 67.5,
      "mode": "agent",
      "modelName": "claude-4.5-sonnet"
    }
  ]
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- Database Management -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Database Management</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/database/stats</code>
              </div>
              <p>Get database statistics with integrity checks</p>
              <details>
                <summary>Response Example</summary>
                <pre><code>{
  "success": true,
  "stats": {
    "entries": 811,
    "prompts": 337,
    "events": 806,
    "linked_entries": 245,
    "linked_prompts": 198,
    "unique_sessions": 27,
    "linked_entries_percent": "30.21",
    "linked_prompts_percent": "58.75"
  },
  "integrity": {
    "valid": true,
    "checks": {
      "orphaned_entry_prompts": 0,
      "orphaned_prompt_entries": 0,
      "null_timestamps": 0
    }
  }
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/database/entries-with-prompts</code>
              </div>
              <p>Get entries with their linked prompts (JOIN query)</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max results (default: 100)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/database/prompts-with-entries</code>
              </div>
              <p>Get prompts with their linked entries (JOIN query)</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max results (default: 100)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/export/database</code>
              </div>
              <p>Export complete database snapshot as JSON</p>
              <details>
                <summary>Response Structure</summary>
                <pre><code>{
  "success": true,
  "data": {
    "metadata": {
      "exportedAt": "2025-10-24T04:00:00.000Z",
      "version": "2.0",
      "totalEntries": 811,
      "totalPrompts": 337,
      "totalEvents": 806,
      "totalTerminalCommands": 245,
      "totalContextSnapshots": 189
    },
    "entries": [...],          // File changes with full details
    "prompts": [...],          // AI prompts with all metadata
    "events": [...],           // Activity events
    "terminal_commands": [...], // Command history (NEW)
    "context_snapshots": [...], // Context usage over time (NEW)
    "context_analytics": {...}, // Aggregated context stats (NEW)
    "workspaces": [...],
    "stats": {
      "sessions": 39,
      "fileChanges": 811,
      "aiInteractions": 337,
      "totalActivities": 806,
      "terminalCommands": 245,
      "avgContextUsage": 58.9
    }
  }
}</code></pre>
               </details>
             </div>

          </div>
        </div>

        <!-- Analytics Endpoints -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Analytics Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context</code>
              </div>
              <p>Context window analytics (@ mentions, token usage)</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/snapshots</code>
              </div>
              <p>Historical context usage snapshots over time</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/historical</code>
              </div>
              <p>Historical context data for trend analysis</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/timeline</code>
              </div>
              <p>Context usage timeline visualization data</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/context/file-relationships</code>
              </div>
              <p>File co-occurrence graph for context analysis</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>minCount</code> - Minimum co-occurrence count (default: 2)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/errors</code>
              </div>
              <p>Error and bug tracking statistics</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/errors/recent</code>
              </div>
              <p>Recent errors with detailed information</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/productivity</code>
              </div>
              <p>Productivity metrics (time-to-edit, iterations, code churn)</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/analytics/file-usage</code>
              </div>
              <p>File usage patterns and access frequency</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/prompts/:id/context-files</code>
              </div>
              <p>Get context files for a specific prompt by ID</p>
            </div>

          </div>
        </div>

        <!-- Terminal Monitoring -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Terminal Monitoring</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/terminal/history</code>
              </div>
              <p>Shell command history with filtering</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max results (default: 100)</li>
                  <li><code>source</code> - Filter by source (e.g., 'zsh', 'bash')</li>
                  <li><code>workspace</code> - Filter by workspace path</li>
                  <li><code>exitCode</code> - Filter by exit code</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/terminal/stats</code>
              </div>
              <p>Terminal usage statistics and top commands</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/terminal/enable</code>
              </div>
              <p>Enable terminal monitoring</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/terminal/disable</code>
              </div>
              <p>Disable terminal monitoring</p>
            </div>

          </div>
        </div>

        <!-- Screenshots -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Screenshots</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/screenshots</code>
              </div>
              <p>Get all screenshot metadata</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/screenshots/near/:timestamp</code>
              </div>
              <p>Find screenshot closest to a specific timestamp</p>
              <details>
                <summary>Parameters</summary>
                <ul>
                  <li><code>timestamp</code> - Unix timestamp in milliseconds</li>
                </ul>
              </details>
            </div>

          </div>
        </div>

        <!-- Todo/Task Management -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Todo & Task Management</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/todos</code>
              </div>
              <p>Get all todos with optional filtering</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>status</code> - Filter by status (e.g., 'pending', 'completed')</li>
                  <li><code>workspace</code> - Filter by workspace path</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/todos/:id/events</code>
              </div>
              <p>Get events associated with a specific todo</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/todos</code>
              </div>
              <p>Create a new todo</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "title": "Implement authentication",
  "description": "Add JWT-based auth",
  "workspace": "/path/to/workspace",
  "status": "pending"
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/todos/:id/status</code>
              </div>
              <p>Update todo status</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "status": "completed"
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- Workspace-Specific -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Workspace-Specific Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/workspace/:workspacePath/activity</code>
              </div>
              <p>Get activity for a specific workspace</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>since</code> - Timestamp filter</li>
                  <li><code>limit</code> - Max results</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/workspace/:workspacePath/sessions</code>
              </div>
              <p>Get coding sessions for a specific workspace</p>
            </div>

          </div>
        </div>

        <!-- Data Sources -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Data Sources & Raw Data</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state</code>
              </div>
              <p>Current IDE state from AppleScript capture</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/history</code>
              </div>
              <p>Historical IDE state data</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/editor</code>
              </div>
              <p>Current editor state and open files</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/workspace</code>
              </div>
              <p>Current workspace state</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/debug</code>
              </div>
              <p>Debug state and breakpoint information</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/ide-state/cursor</code>
              </div>
              <p>Cursor-specific IDE state</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/system-resources</code>
              </div>
              <p>System resource usage (CPU, memory, load)</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max data points (default: 50)</li>
                </ul>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/git</code>
              </div>
              <p>Git activity data (commits, branches)</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/cursor-database</code>
              </div>
              <p>Raw data from Cursor database queries</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/apple-script</code>
              </div>
              <p>AppleScript automation data</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/logs</code>
              </div>
              <p>System and application logs</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/raw-data/all</code>
              </div>
              <p>All raw data sources combined</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/cursor-database</code>
              </div>
              <p>Direct access to Cursor database mining results</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/workspaces</code>
              </div>
              <p>List of monitored workspaces</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/file-contents</code>
              </div>
              <p>Get file contents from the database</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>path</code> - File path (required)</li>
                </ul>
              </details>
            </div>

          </div>
        </div>

        <!-- Utility Endpoints -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Utility & Debug Endpoints</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/queue</code>
              </div>
              <p>View internal processing queue status</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/debug</code>
              </div>
              <p>Debug information and diagnostics</p>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-get">GET</span>
                <code>/api/activity/stream</code>
              </div>
              <p>Server-Sent Events stream for real-time activity</p>
              <details>
                <summary>Usage</summary>
                <pre><code>const eventSource = new EventSource('http://localhost:43917/api/activity/stream');
eventSource.onmessage = (event) => {
  console.log(JSON.parse(event.data));
};</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/api/prompts/manual</code>
              </div>
              <p>Manually log a prompt</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "text": "Your prompt text",
  "source": "manual",
  "workspace": "/path/to/workspace",
  "metadata": {}
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- MCP Integration -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">MCP Integration (Model Context Protocol)</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/mcp/log-prompt-response</code>
              </div>
              <p>Log AI prompt/response pairs from MCP</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "session_id": "optional-session-id",
  "file_path": "src/index.js",
  "prompt": "How do I implement JWT auth?",
  "response": "Here's how to implement JWT..."
}</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <div class="api-method-url">
                <span class="api-method api-post">POST</span>
                <code>/mcp/log-code-change</code>
              </div>
              <p>Log code changes from MCP</p>
              <details>
                <summary>Request Body</summary>
                <pre><code>{
  "file_path": "src/index.js",
  "before_code": "const x = 1;",
  "after_code": "const x = 2;",
  "source": "ai-generated"
}</code></pre>
              </details>
            </div>

          </div>
        </div>

        <!-- WebSocket -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">WebSocket (Real-time Updates)</h3>
          </div>
          <div class="card-body">
            <p><strong>URL:</strong> <code>ws://localhost:43917</code></p>
            <p>Connect via Socket.IO for real-time activity updates</p>
            <details>
              <summary>Events</summary>
              <ul>
                <li><code>activity</code> - New activity event</li>
                <li><code>prompt</code> - New prompt captured</li>
                <li><code>workspace</code> - Workspace change</li>
              </ul>
            </details>
            <details>
              <summary>Example (Socket.IO Client)</summary>
              <pre><code>const socket = io('http://localhost:43917');
socket.on('activity', (event) => {
  console.log('New activity:', event);
});</code></pre>
            </details>
          </div>
        </div>

        <!-- Rate Limiting & Performance -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Performance & Best Practices</h3>
          </div>
          <div class="card-body">
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Performance Characteristics</h4>
            <ul style="margin-bottom: var(--space-lg);">
              <li><strong>No rate limiting:</strong> Local development service, no throttling applied</li>
              <li><strong>Response time:</strong> Most endpoints < 50ms, heavy analytics < 200ms</li>
              <li><strong>Database size:</strong> ~5-10MB per hour of active development</li>
              <li><strong>Large exports:</strong> <code>/api/export/database</code> may take 1-2 seconds for large datasets</li>
              <li><strong>Cursor DB sync:</strong> Initial sync can take 10-30 seconds depending on history</li>
            </ul>
            
            <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Best Practices</h4>
            <ul>
              <li><strong>Use pagination:</strong> Add <code>?limit=100</code> for large datasets</li>
              <li><strong>Filter by time:</strong> Use <code>?since=timestamp</code> for recent data only</li>
              <li><strong>Cache responses:</strong> Most data changes infrequently (poll every 2-5 seconds)</li>
              <li><strong>WebSocket for real-time:</strong> Use Socket.IO for instant updates instead of polling</li>
              <li><strong>Export strategically:</strong> Schedule database exports during idle times</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  `;
}

// Export to window for global access
window.renderAPIDocsViewTemplate = renderAPIDocsViewTemplate;

