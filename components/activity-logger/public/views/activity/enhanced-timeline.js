/**
 * Enhanced Timeline Components
 * Better event cards, zoom controls, and filtering
 */

/**
 * Enhanced event card with expandable details
 */
function renderEnhancedEventCard(event, options = {}) {
  const {
    showFullDetails = false,
    showCP = false,
    showPatternMatch = false
  } = options;
  
  const time = new Date(event.timestamp || event.id).toLocaleTimeString();
  const date = new Date(event.timestamp || event.id).toLocaleDateString();
  const title = window.getEventTitle?.(event) || event.type || 'Event';
  const type = event.type || 'unknown';
  
  // Get CP score if available
  const cp = event.context_precision || event.cp;
  const cpBadge = showCP && cp ? `
    <span class="cp-badge" title="Context Precision: ${cp.toFixed(2)}">
      CP: ${cp.toFixed(2)}
    </span>
  ` : '';
  
  // Pattern match indicator
  const patternMatch = showPatternMatch && event.pattern_match ? `
    <span class="pattern-match-badge" title="Matches pattern: ${event.pattern_match}">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
      </svg>
      Pattern
    </span>
  ` : '';
  
  // Extract file info
  let filePath = '';
  let fileStats = '';
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    filePath = details?.file_path || event.file_path || '';
    
    const linesAdded = details?.lines_added || 0;
    const linesRemoved = details?.lines_removed || 0;
    if (linesAdded > 0 || linesRemoved > 0) {
      fileStats = `${linesAdded > 0 ? `+${linesAdded}` : ''}${linesRemoved > 0 ? (linesAdded > 0 ? ' / ' : '') + `-${linesRemoved}` : ''} lines`;
    }
  } catch (e) {
    // Ignore
  }
  
  return `
    <div class="enhanced-event-card card" data-event-id="${event.id || event.timestamp}">
      <div class="event-card-header">
        <div class="event-card-meta">
          <div class="event-time">${time}</div>
          <div class="event-date">${date}</div>
        </div>
        <div class="event-card-badges">
          ${cpBadge}
          ${patternMatch}
          <span class="event-type-badge">${type}</span>
        </div>
      </div>
      <div class="event-card-body">
        <h3 class="event-card-title">${title}</h3>
        ${filePath ? `<div class="event-file-path">${filePath}</div>` : ''}
        ${fileStats ? `<div class="event-stats">${fileStats}</div>` : ''}
        ${showFullDetails ? renderEventDetails(event) : ''}
      </div>
      ${!showFullDetails ? `
        <div class="event-card-footer">
          <button class="btn btn-ghost btn-sm" onclick="expandEventCard('${event.id || event.timestamp}')">
            Show Details
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderEventDetails(event) {
  const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
  
  return `
    <div class="event-details">
      ${details?.context_files ? `
        <div class="event-detail-section">
          <strong>Context Files:</strong>
          <ul class="context-files-list">
            ${(Array.isArray(details.context_files) ? details.context_files : []).slice(0, 5).map(f => `
              <li>${typeof f === 'string' ? f : f.path || f.fileName}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      ${event.prompt_text ? `
        <div class="event-detail-section">
          <strong>Prompt:</strong>
          <div class="event-prompt-text">${event.prompt_text.substring(0, 200)}${event.prompt_text.length > 200 ? '...' : ''}</div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Timeline zoom controls
 */
function renderTimelineZoomControls(container, currentZoom = 'day') {
  container.innerHTML = `
    <div class="timeline-zoom-controls">
      <div class="zoom-buttons">
        <button class="btn btn-ghost btn-sm ${currentZoom === 'hour' ? 'active' : ''}" onclick="setTimelineZoom('hour')">
          Hour
        </button>
        <button class="btn btn-ghost btn-sm ${currentZoom === 'day' ? 'active' : ''}" onclick="setTimelineZoom('day')">
          Day
        </button>
        <button class="btn btn-ghost btn-sm ${currentZoom === 'week' ? 'active' : ''}" onclick="setTimelineZoom('week')">
          Week
        </button>
        <button class="btn btn-ghost btn-sm ${currentZoom === 'month' ? 'active' : ''}" onclick="setTimelineZoom('month')">
          Month
        </button>
      </div>
      <div class="timeline-minimap" id="timeline-minimap">
        <!-- Minimap will be rendered here -->
      </div>
    </div>
  `;
}

/**
 * Enhanced filters for activity view
 */
function renderEnhancedFilters(container) {
  container.innerHTML = `
    <div class="activity-filters card">
      <div class="filter-group">
        <label class="filter-label">Event Type</label>
        <div class="filter-checkboxes">
          <label class="filter-checkbox">
            <input type="checkbox" id="filter-file-change" checked onchange="applyActivityFilters()">
            <span>File Changes</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" id="filter-prompt" checked onchange="applyActivityFilters()">
            <span>AI Prompts</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" id="filter-terminal" checked onchange="applyActivityFilters()">
            <span>Terminal</span>
          </label>
        </div>
      </div>
      <div class="filter-group">
        <label class="filter-label">Time Range</label>
        <select id="activity-time-range" class="input" onchange="applyActivityFilters()">
          <option value="hour">Last Hour</option>
          <option value="day">Last Day</option>
          <option value="week" selected>Last Week</option>
          <option value="month">Last Month</option>
          <option value="all">All Time</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Workspace</label>
        <select id="activity-workspace-filter" class="input" onchange="applyActivityFilters()">
          <option value="all">All Workspaces</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Show</label>
        <div class="filter-checkboxes">
          <label class="filter-checkbox">
            <input type="checkbox" id="show-cp-scores" onchange="applyActivityFilters()">
            <span>CP Scores</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" id="show-pattern-matches" onchange="applyActivityFilters()">
            <span>Pattern Matches</span>
          </label>
        </div>
      </div>
    </div>
  `;
}

// Export functions
if (typeof window !== 'undefined') {
  window.renderEnhancedEventCard = renderEnhancedEventCard;
  window.renderTimelineZoomControls = renderTimelineZoomControls;
  window.renderEnhancedFilters = renderEnhancedFilters;
}

