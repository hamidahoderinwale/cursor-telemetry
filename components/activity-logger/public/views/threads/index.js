/**
 * Threads View
 * HTML templates moved to views/threads/helpers.js
 */

function renderThreadsView(container) {
  const entries = window.state?.data?.entries || [];
  const threads = window.groupIntoThreads ? window.groupIntoThreads(entries) : [];
  const prompts = window.state?.data?.prompts || [];
  
  container.innerHTML = `
    <div class="threads-view">
      
      <!-- Captured Prompts Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title" title="All prompts you've sent to Cursor, captured automatically from your clipboard or entered manually. Shows the full prompt text, timestamp, and any linked code changes">Captured Prompts</h3>
            <p class="card-subtitle">Prompts captured from clipboard and manual entry</p>
          </div>
          <div class="thread-header-controls">
            <span class="thread-badge">[CLIPBOARD] ${prompts.length} captured</span>
            <button class="btn btn-sm" onclick="refreshPrompts()">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div class="card-body">
          ${prompts.length > 0 ? window.renderPromptsList(prompts) : window.renderPromptEmptyState()}
        </div>
      </div>

      <!-- Conversation Threads Section -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title" title="AI conversation threads grouped by session. Each thread represents a continuous conversation with the AI, showing the back-and-forth exchange of prompts and responses">Conversation Threads</h3>
            <p class="card-subtitle">AI conversations grouped by session</p>
          </div>
          <div class="thread-badge">${threads.length} threads</div>
        </div>
        <div class="card-body">
          ${threads.length > 0 ? window.renderThreadsList(threads) : '<div class="empty-state"><div class="empty-state-text">No conversation threads</div><div class="empty-state-hint">Threads will appear as you interact with AI</div></div>'}
        </div>
      </div>

    </div>
  `;
}

// Export to window for global access
window.renderThreadsView = renderThreadsView;

// Note: renderPromptsList, renderPromptEmptyState, getPromptStatusIcon, renderThreadsList, and groupIntoThreads are in views/threads/helpers.js

