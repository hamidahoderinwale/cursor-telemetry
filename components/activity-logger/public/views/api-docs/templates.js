/**
 * API Docs View HTML Templates
 * Template functions for API Documentation view
 */

function renderAPIDocsViewTemplate(data) {
  // Get API base URL from config (falls back to localhost for local development)
  const apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
  const wsUrl = window.CONFIG?.WS_URL || window.DASHBOARD_CONFIG?.WS_URL || 'ws://localhost:43917';
  const isLocal = apiBase.includes('localhost') || apiBase.includes('127.0.0.1');
  
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
            <p><strong>Base URL:</strong> <code>${apiBase}</code></p>
            <p><strong>Total Endpoints:</strong> <strong style="color: var(--color-primary);">60+</strong> REST endpoints</p>
            <p><strong>Content-Type:</strong> <code>application/json</code></p>
            <p><strong>CORS:</strong> Enabled for all origins</p>
            <p><strong>Authentication:</strong> ${isLocal ? 'None (local development service)' : 'None (public API)'}</p>
            
            <div style="margin-top: var(--space-lg); padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); border-left: 4px solid var(--color-warning);">
              <h4 style="margin: 0 0 var(--space-sm) 0; color: var(--color-text); font-weight: 600;">Dashboard Integration</h4>
              <p style="margin: 0; font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.6;">
                The dashboard works with the <strong>db watcher</strong> by default, which monitors Cursor's internal SQLite database directly. 
                However, you can configure it to use the <strong>companion service</strong> instead for live streaming, real-time updates, and API access.
                <br><br>
                <strong>To use the companion service:</strong> Update <code>window.CONFIG.API_BASE</code> to point to <code>${apiBase}</code> in your dashboard configuration.
                The companion service provides WebSocket support for real-time activity streams, comprehensive API endpoints, and advanced features like state management, annotations, and natural language commands.
                <br><br>
                <strong>Live Streaming:</strong> Use WebSocket (<code>${wsUrl}</code>) or Server-Sent Events (<code>${apiBase}/api/activity/stream</code>) for real-time activity updates without polling.
              </p>
            </div>
            
            <div style="margin-top: var(--space-lg); display: grid; gap: var(--space-sm);">
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-info);">
                <strong>Quick Health Check:</strong><br>
                <code>curl ${apiBase}/health</code>
              </div>
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-success);">
                <strong>Get Recent Activity:</strong><br>
                <code>curl ${apiBase}/api/activity?limit=10</code>
              </div>
              <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-accent);">
                <strong>Search Prompts:</strong><br>
                <code>curl "${apiBase}/api/search?q=authentication"</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Database Schema & Fields -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Database Schema & Field Reference</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Entries Table (File Changes)</h4>
              <p style="margin-bottom: var(--space-sm); color: var(--color-text-muted);">Stores file modification events with code diffs and metadata.</p>
              <details>
                <summary>All Fields</summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-sm);">
                  <thead>
                    <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Field</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Type</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>id</code></td><td>INTEGER</td><td>Primary key, auto-increment</td></tr>
                    <tr><td><code>session_id</code></td><td>TEXT</td><td>Session identifier linking related activities</td></tr>
                    <tr><td><code>workspace_path</code></td><td>TEXT</td><td>Full path to workspace root directory</td></tr>
                    <tr><td><code>file_path</code></td><td>TEXT</td><td>Relative or absolute path to modified file</td></tr>
                    <tr><td><code>source</code></td><td>TEXT</td><td>Source of change: 'composer', 'agent', 'manual', 'mcp'</td></tr>
                    <tr><td><code>before_code</code></td><td>TEXT</td><td>File content before modification (full or diff)</td></tr>
                    <tr><td><code>after_code</code></td><td>TEXT</td><td>File content after modification (full or diff)</td></tr>
                    <tr><td><code>notes</code></td><td>TEXT</td><td>Optional notes or description</td></tr>
                    <tr><td><code>timestamp</code></td><td>TEXT</td><td>ISO 8601 timestamp of the change</td></tr>
                    <tr><td><code>tags</code></td><td>TEXT</td><td>JSON array of tags for categorization</td></tr>
                    <tr><td><code>prompt_id</code></td><td>INTEGER</td><td>Foreign key to prompts table (if AI-generated)</td></tr>
                    <tr><td><code>modelInfo</code></td><td>TEXT</td><td>JSON object with model details (name, type, etc.)</td></tr>
                    <tr><td><code>type</code></td><td>TEXT</td><td>Change type: 'file_change', 'file_create', 'file_delete'</td></tr>
                  </tbody>
                </table>
              </details>
            </div>

            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Prompts Table (AI Interactions)</h4>
              <p style="margin-bottom: var(--space-sm); color: var(--color-text-muted);">Stores AI prompts with full metadata including model info, context usage, and threading.</p>
              <details>
                <summary>All Fields</summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-sm);">
                  <thead>
                    <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Field</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Type</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>id</code></td><td>INTEGER</td><td>Primary key, auto-increment</td></tr>
                    <tr><td><code>timestamp</code></td><td>TEXT</td><td>ISO 8601 timestamp of the prompt</td></tr>
                    <tr><td><code>text</code></td><td>TEXT</td><td>Full prompt text content</td></tr>
                    <tr><td><code>status</code></td><td>TEXT</td><td>Prompt status: 'pending', 'completed', 'error'</td></tr>
                    <tr><td><code>linked_entry_id</code></td><td>INTEGER</td><td>Foreign key to entries table (resulting code change)</td></tr>
                    <tr><td><code>source</code></td><td>TEXT</td><td>Source: 'composer', 'agent', 'chat', 'mcp'</td></tr>
                    <tr><td><code>workspace_id</code></td><td>TEXT</td><td>Workspace identifier</td></tr>
                    <tr><td><code>workspace_path</code></td><td>TEXT</td><td>Full path to workspace root</td></tr>
                    <tr><td><code>workspace_name</code></td><td>TEXT</td><td>Display name of workspace</td></tr>
                    <tr><td><code>composer_id</code></td><td>TEXT</td><td>Cursor composer/conversation ID for threading</td></tr>
                    <tr><td><code>subtitle</code></td><td>TEXT</td><td>Optional subtitle or preview text</td></tr>
                    <tr><td><code>lines_added</code></td><td>INTEGER</td><td>Lines of code added by this prompt (default: 0)</td></tr>
                    <tr><td><code>lines_removed</code></td><td>INTEGER</td><td>Lines of code removed by this prompt (default: 0)</td></tr>
                    <tr><td><code>context_usage</code></td><td>REAL</td><td>Context window usage percentage (0-100, default: 0)</td></tr>
                    <tr><td><code>mode</code></td><td>TEXT</td><td>AI mode: 'chat', 'edit', 'agent', 'composer'</td></tr>
                    <tr><td><code>model_type</code></td><td>TEXT</td><td>Model type category</td></tr>
                    <tr><td><code>model_name</code></td><td>TEXT</td><td>Actual model name (e.g., 'claude-4.5-sonnet', 'gpt-4')</td></tr>
                    <tr><td><code>original_model</code></td><td>TEXT</td><td>Original model selection (may be 'auto')</td></tr>
                    <tr><td><code>is_auto</code></td><td>INTEGER</td><td>Boolean (0/1): Whether model was auto-selected</td></tr>
                    <tr><td><code>force_mode</code></td><td>TEXT</td><td>Forced mode override</td></tr>
                    <tr><td><code>type</code></td><td>TEXT</td><td>Prompt type: 'user', 'assistant', 'system'</td></tr>
                    <tr><td><code>message_role</code></td><td>TEXT</td><td>Message role: 'user', 'assistant', 'system'</td></tr>
                    <tr><td><code>prompt_tokens</code></td><td>INTEGER</td><td>Number of tokens in prompt (if available)</td></tr>
                    <tr><td><code>completion_tokens</code></td><td>INTEGER</td><td>Number of tokens in completion (if available)</td></tr>
                    <tr><td><code>total_tokens</code></td><td>INTEGER</td><td>Total tokens used (if available)</td></tr>
                    <tr><td><code>context_window_size</code></td><td>INTEGER</td><td>Context window size in tokens (default: 200000)</td></tr>
                    <tr><td><code>parent_conversation_id</code></td><td>TEXT</td><td>Parent conversation ID for threading</td></tr>
                    <tr><td><code>conversation_id</code></td><td>TEXT</td><td>Conversation ID for grouping messages</td></tr>
                    <tr><td><code>context_files</code></td><td>TEXT</td><td>JSON array of context file paths</td></tr>
                    <tr><td><code>at_mentions</code></td><td>TEXT</td><td>JSON array of @-mentioned files</td></tr>
                    <tr><td><code>thinking_time_seconds</code></td><td>REAL</td><td>AI response time in seconds</td></tr>
                    <tr><td><code>confidence</code></td><td>TEXT</td><td>Confidence level: 'high', 'medium', 'low'</td></tr>
                  </tbody>
                </table>
              </details>
            </div>

            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Events Table (Activity Timeline)</h4>
              <p style="margin-bottom: var(--space-sm); color: var(--color-text-muted);">Stores activity events with AI-generated annotations and intent classification.</p>
              <details>
                <summary>All Fields</summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-sm);">
                  <thead>
                    <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Field</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Type</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>id</code></td><td>TEXT</td><td>Primary key (UUID)</td></tr>
                    <tr><td><code>session_id</code></td><td>TEXT</td><td>Session identifier</td></tr>
                    <tr><td><code>workspace_path</code></td><td>TEXT</td><td>Workspace root path</td></tr>
                    <tr><td><code>timestamp</code></td><td>TEXT</td><td>ISO 8601 timestamp</td></tr>
                    <tr><td><code>type</code></td><td>TEXT</td><td>Event type: 'file_change', 'prompt', 'terminal', 'state_fork', etc.</td></tr>
                    <tr><td><code>details</code></td><td>TEXT</td><td>JSON object with event-specific details</td></tr>
                    <tr><td><code>annotation</code></td><td>TEXT</td><td>AI-generated description of the event</td></tr>
                    <tr><td><code>intent</code></td><td>TEXT</td><td>Classified intent: 'feature', 'bug-fix', 'refactor', 'experiment', etc.</td></tr>
                    <tr><td><code>tags</code></td><td>TEXT</td><td>JSON array of tags</td></tr>
                    <tr><td><code>ai_generated</code></td><td>INTEGER</td><td>Boolean (0/1): Whether annotation is AI-generated</td></tr>
                  </tbody>
                </table>
              </details>
            </div>

            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Terminal Commands Table</h4>
              <p style="margin-bottom: var(--space-sm); color: var(--color-text-muted);">Stores shell command history with output, exit codes, and execution metadata.</p>
              <details>
                <summary>All Fields</summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-sm);">
                  <thead>
                    <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Field</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Type</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>id</code></td><td>TEXT</td><td>Primary key (UUID)</td></tr>
                    <tr><td><code>command</code></td><td>TEXT</td><td>Full command string executed</td></tr>
                    <tr><td><code>shell</code></td><td>TEXT</td><td>Shell type: 'zsh', 'bash', 'fish', etc.</td></tr>
                    <tr><td><code>source</code></td><td>TEXT</td><td>Source: 'terminal', 'script', 'mcp'</td></tr>
                    <tr><td><code>timestamp</code></td><td>INTEGER</td><td>Unix timestamp in milliseconds</td></tr>
                    <tr><td><code>workspace</code></td><td>TEXT</td><td>Workspace path where command was executed</td></tr>
                    <tr><td><code>output</code></td><td>TEXT</td><td>Command output (stdout + stderr)</td></tr>
                    <tr><td><code>exit_code</code></td><td>INTEGER</td><td>Command exit code (0 = success)</td></tr>
                    <tr><td><code>duration</code></td><td>INTEGER</td><td>Execution duration in milliseconds</td></tr>
                    <tr><td><code>error</code></td><td>TEXT</td><td>Error message if command failed</td></tr>
                    <tr><td><code>linked_entry_id</code></td><td>INTEGER</td><td>Foreign key to entries (if related to file change)</td></tr>
                    <tr><td><code>linked_prompt_id</code></td><td>INTEGER</td><td>Foreign key to prompts (if AI-suggested)</td></tr>
                    <tr><td><code>session_id</code></td><td>TEXT</td><td>Session identifier</td></tr>
                  </tbody>
                </table>
              </details>
            </div>

            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Context Snapshots Table</h4>
              <p style="margin-bottom: var(--space-sm); color: var(--color-text-muted);">Tracks context window usage over time for each prompt.</p>
              <details>
                <summary>All Fields</summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-sm);">
                  <thead>
                    <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Field</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Type</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>id</code></td><td>INTEGER</td><td>Primary key, auto-increment</td></tr>
                    <tr><td><code>prompt_id</code></td><td>TEXT</td><td>Foreign key to prompts table</td></tr>
                    <tr><td><code>timestamp</code></td><td>INTEGER</td><td>Unix timestamp in milliseconds</td></tr>
                    <tr><td><code>file_count</code></td><td>INTEGER</td><td>Number of files in context (default: 0)</td></tr>
                    <tr><td><code>token_estimate</code></td><td>INTEGER</td><td>Estimated token count (default: 0)</td></tr>
                    <tr><td><code>truncated</code></td><td>INTEGER</td><td>Boolean (0/1): Whether context was truncated</td></tr>
                    <tr><td><code>utilization_percent</code></td><td>REAL</td><td>Context window utilization percentage (0-100)</td></tr>
                    <tr><td><code>context_files</code></td><td>TEXT</td><td>JSON array of context file paths</td></tr>
                    <tr><td><code>at_mentions</code></td><td>TEXT</td><td>JSON array of @-mentioned files</td></tr>
                    <tr><td><code>created_at</code></td><td>TEXT</td><td>ISO 8601 timestamp (auto-generated)</td></tr>
                  </tbody>
                </table>
              </details>
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
                <pre><code>const eventSource = new EventSource('${apiBase}/api/activity/stream');
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

        <!-- WebSocket & Real-time Streaming -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">WebSocket & Real-time Streaming</h3>
          </div>
          <div class="card-body" style="display: grid; gap: var(--space-lg);">
            
            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">WebSocket (Socket.IO)</h4>
              <p><strong>URL:</strong> <code>${wsUrl}</code> or <code>${apiBase}</code></p>
              <p style="margin-bottom: var(--space-sm);">Connect via Socket.IO for real-time activity updates with bidirectional communication.</p>
              <details>
                <summary>Available Events</summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: var(--space-sm);">
                  <thead>
                    <tr style="background: var(--color-bg-alt); border-bottom: 2px solid var(--color-border);">
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Event</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Payload</th>
                      <th style="padding: var(--space-xs) var(--space-sm); text-align: left; font-weight: 600;">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>activity</code></td><td>Event object</td><td>New activity event (file change, prompt, terminal, etc.)</td></tr>
                    <tr><td><code>prompt</code></td><td>Prompt object</td><td>New AI prompt captured with full metadata</td></tr>
                    <tr><td><code>workspace</code></td><td>Workspace object</td><td>Workspace change or new workspace detected</td></tr>
                    <tr><td><code>entry</code></td><td>Entry object</td><td>New file change entry</td></tr>
                    <tr><td><code>terminal</code></td><td>Command object</td><td>New terminal command executed</td></tr>
                    <tr><td><code>stats</code></td><td>Stats object</td><td>Updated dashboard statistics</td></tr>
                  </tbody>
                </table>
              </details>
              <details>
                <summary>Client Example (Socket.IO)</summary>
                <pre><code>// Install: npm install socket.io-client
const io = require('socket.io-client');
const socket = io('${apiBase}');

// Listen for events
socket.on('connect', () => {
  console.log('Connected to companion service');
});

socket.on('activity', (event) => {
  console.log('New activity:', event);
  // event.type, event.timestamp, event.details, etc.
});

socket.on('prompt', (prompt) => {
  console.log('New prompt:', prompt);
  // prompt.text, prompt.model_name, prompt.context_usage, etc.
});

socket.on('workspace', (workspace) => {
  console.log('Workspace change:', workspace);
});

// Disconnect
socket.on('disconnect', () => {
  console.log('Disconnected from companion service');
});</code></pre>
              </details>
            </div>

            <div class="api-endpoint">
              <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-weight: 600;">Server-Sent Events (SSE)</h4>
              <p><strong>Endpoint:</strong> <code>GET ${apiBase}/api/activity/stream</code></p>
              <p style="margin-bottom: var(--space-sm);">Unidirectional real-time stream using HTTP Server-Sent Events. Lower overhead than WebSocket for read-only streams.</p>
              <details>
                <summary>Query Parameters</summary>
                <ul>
                  <li><code>limit</code> - Max events to send initially (default: 100, max: 1000)</li>
                  <li><code>since</code> - Timestamp filter (Unix milliseconds)</li>
                </ul>
              </details>
              <details>
                <summary>Client Example (EventSource)</summary>
                <pre><code>// Browser native API (no library needed)
const eventSource = new EventSource('${apiBase}/api/activity/stream?limit=50');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New activity:', data);
  // data.type, data.timestamp, data.details, etc.
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // Connection will auto-reconnect
};

// Close connection
eventSource.close();</code></pre>
              </details>
              <details>
                <summary>Node.js Example (SSE Client)</summary>
                <pre><code>// Install: npm install eventsource
const EventSource = require('eventsource');

const eventSource = new EventSource('${apiBase}/api/activity/stream?limit=100');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New activity:', data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};

// Close connection
eventSource.close();</code></pre>
              </details>
            </div>

            <div style="padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); border-left: 3px solid var(--color-info);">
              <h4 style="margin: 0 0 var(--space-xs) 0; color: var(--color-text); font-weight: 600;">When to Use Each</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: var(--text-sm); color: var(--color-text-muted); line-height: 1.6;">
                <li><strong>WebSocket (Socket.IO):</strong> Use when you need bidirectional communication, want to send commands to the server, or need more control over the connection.</li>
                <li><strong>Server-Sent Events:</strong> Use for simple read-only streams, when you only need to receive updates, or want lower overhead. Works well in browsers without additional libraries.</li>
                <li><strong>Polling:</strong> Use <code>GET /api/activity?since=timestamp</code> for simple polling scenarios or when WebSocket/SSE are not available.</li>
              </ul>
            </div>

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

