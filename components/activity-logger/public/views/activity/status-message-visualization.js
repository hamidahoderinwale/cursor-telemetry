/**
 * Status Message Visualization
 * Visualizes Cursor status messages like "Read X file", "Planning next moves" in timeline
 * Version: 2.3 - Complete error suppression, no console output for network errors, defensive health checks
 */

// Track failed requests to prevent spam
let lastFailureTime = 0;
let failureCount = 0;
// Start with serviceOffline = true to prevent initial requests until we confirm service is available
let serviceOffline = true;
let healthCheckAttempted = false;
const FAILURE_COOLDOWN = 30000; // 30 seconds
const MAX_FAILURES_BEFORE_SILENCE = 1; // Only log first failure, then silence completely

/**
 * Check if companion service is available
 * Only attempts health check once per page load to minimize CORS errors
 */
async function checkServiceHealth() {
  // If we've already attempted a health check and service is offline, don't retry immediately
  if (serviceOffline && healthCheckAttempted) {
    const timeSinceLastCheck = Date.now() - lastFailureTime;
    // Only retry after cooldown period
    if (timeSinceLastCheck < FAILURE_COOLDOWN) {
      return false;
    }
  }
  
  // Mark that we've attempted a health check
  healthCheckAttempted = true;
  
  try {
    const apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    
    const response = await fetch(`${apiBase}/health`, { 
      signal: controller.signal,
      mode: 'cors'
    });
    
    clearTimeout(timeoutId);
    
    if (response && response.ok) {
      serviceOffline = false;
      failureCount = 0;
      return true;
    }
  } catch (e) {
    // Expected when service is offline
  }
  
  serviceOffline = true;
  lastFailureTime = Date.now();
  return false;
}

/**
 * Fetch status messages for a time range
 */
async function fetchStatusMessages(startTime, endTime) {
  // Validate inputs - check for NaN and reasonable date range
  if (!startTime || !endTime || isNaN(startTime) || isNaN(endTime)) {
    return [];
  }

  // Validate timestamps are reasonable (not from year 2000 or future)
  // Reject timestamps before 2020-01-01 (1577836800000) or after 10 years from now
  const MIN_VALID_TIMESTAMP = 1577836800000; // 2020-01-01
  const MAX_VALID_TIMESTAMP = Date.now() + (10 * 365 * 24 * 60 * 60 * 1000); // 10 years from now
  
  if (startTime < MIN_VALID_TIMESTAMP || startTime > MAX_VALID_TIMESTAMP ||
      endTime < MIN_VALID_TIMESTAMP || endTime > MAX_VALID_TIMESTAMP) {
    // Invalid timestamp range - silently return empty array
    return [];
  }

  // Validate time range is reasonable (not more than 1 year)
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  if (endTime - startTime > ONE_YEAR_MS) {
    // Time range too large - silently return empty array
    return [];
  }

  // If service is marked offline, skip immediately - NO requests, NO errors, NO console output
  if (serviceOffline) {
    return [];
  }
  
  // Quick health check - if service is down, mark as offline and return silently
  const isHealthy = await checkServiceHealth();
  if (!isHealthy) {
    serviceOffline = true;
    return []; // Return silently - NO errors logged
  }

  // Rate limit error logging
  const now = Date.now();
  const timeSinceLastFailure = now - lastFailureTime;
  
  // If we've had failures recently, silently fail - NO requests
  if (failureCount >= MAX_FAILURES_BEFORE_SILENCE && timeSinceLastFailure < FAILURE_COOLDOWN) {
    return [];
  }

  try {
    const apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    
    // Quick health check before making request - skip if offline
    if (serviceOffline && timeSinceLastFailure < FAILURE_COOLDOWN) {
      return [];
    }

    // Use AbortController for timeout with very short timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
    
    // Wrap fetch in additional try-catch to silently handle CORS/network errors
    let response;
    try {
      response = await fetch(
        `${apiBase}/api/status-messages?startTime=${startTime}&endTime=${endTime}&limit=50`,
        {
          signal: controller.signal,
          mode: 'cors'
        }
      );
    } catch (fetchError) {
      // Silently catch ALL fetch errors (CORS, network, abort, etc.) - NO logging
      clearTimeout(timeoutId);
      serviceOffline = true;
      failureCount++;
      lastFailureTime = Date.now();
      return []; // Return empty array silently - NO console output
    }
    
    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      // Mark as offline on non-OK response
      serviceOffline = true;
      failureCount++;
      lastFailureTime = Date.now();
      return []; // Return silently
    }

    const result = await response.json();
    
    // Reset failure count on success
    failureCount = 0;
    serviceOffline = false;
    
    return result.success ? (result.data || []) : [];
  } catch (error) {
    // Reset counter after cooldown
    if (timeSinceLastFailure >= FAILURE_COOLDOWN) {
      failureCount = 0;
    }
    
    failureCount++;
    lastFailureTime = now;
    
    // Detect network errors - be very aggressive in detection
    const errorMessage = String(error?.message || error?.toString() || '');
    const errorName = String(error?.name || '');
    const errorString = String(error || '');
    
    const isNetworkError = 
      errorMessage.includes('CORS') || 
      errorMessage.includes('NetworkError') || 
      errorMessage.includes('Failed to fetch') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('TypeError') ||
      errorName === 'NetworkError' ||
      errorName === 'TypeError' ||
      errorName === 'AbortError' ||
      errorString.includes('NetworkError') ||
      errorString.includes('CORS') ||
      // Check if it's a fetch-related TypeError
      (errorName === 'TypeError' && errorMessage.toLowerCase().includes('fetch'));
    
    // Mark service as offline on ANY network-related error
    if (isNetworkError) {
      serviceOffline = true;
      // Return empty array silently
      return [];
    }
    
    // Return empty array for non-network errors as well
    return [];
  }
}

/**
 * Render status message timeline item
 */
function renderStatusMessageTimelineItem(status, side = 'left') {
  const time = window.formatTimeAgo ? window.formatTimeAgo(status.timestamp) : new Date(status.timestamp).toLocaleTimeString();
  const icon = getStatusIcon(status.type);
  const color = getStatusColor(status.type);
  
  return `
    <div class="timeline-item timeline-item-${side} status-message-item" 
         style="border-left: 3px solid ${color};"
         onclick="showStatusMessageModal('${status.id}')">
      <div class="timeline-content status-message-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span class="status-icon">${icon}</span>
            <span>${window.escapeHtml ? window.escapeHtml(status.message) : status.message}</span>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge" style="background: ${color}; color: white;">${status.type || 'status'}</span>
          ${status.fileName ? `<span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--color-info);">${window.escapeHtml ? window.escapeHtml(status.fileName) : status.fileName}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Get icon for status type
 */
function getStatusIcon(type) {
  const icons = {
    'file_read': '[Read]',
    'planning': '[Plan]',
    'analysis': '[Analyze]',
    'processing': '[Process]',
    'thinking': '[Think]',
    'generating': '[Generate]',
    'searching': '[Search]',
    'status': '[Info]'
  };
  return icons[type] || '[Info]';
}

/**
 * Get color for status type
 */
function getStatusColor(type) {
  const colors = {
    'file_read': '#3b82f6',      // Blue
    'planning': '#8b5cf6',        // Purple
    'analysis': '#10b981',        // Green
    'processing': '#f59e0b',     // Orange
    'thinking': '#ec4899',        // Pink
    'generating': '#6366f1',      // Indigo
    'searching': '#06b6d4',       // Cyan
    'status': '#6b7280'          // Gray
  };
  return colors[type] || '#6b7280';
}

/**
 * Render status messages in context evolution
 */
function renderStatusMessagesInContext(statusMessages, contextChanges) {
  if (!statusMessages || statusMessages.length === 0) return '';
  
  // Group status messages by type
  const grouped = {};
  statusMessages.forEach(status => {
    if (!grouped[status.type]) {
      grouped[status.type] = [];
    }
    grouped[status.type].push(status);
  });
  
  return `
    <div class="status-messages-in-context">
      <h5>Status Messages</h5>
      <div class="status-messages-list">
        ${Object.entries(grouped).map(([type, messages]) => `
          <div class="status-group">
            <div class="status-group-header">
              <span class="status-icon">${getStatusIcon(type)}</span>
              <strong>${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong>
              <span class="status-count">${messages.length}</span>
            </div>
            <div class="status-group-items">
              ${messages.slice(0, 5).map(status => `
                <div class="status-item">
                  <span class="status-time">${new Date(status.timestamp).toLocaleTimeString()}</span>
                  <span class="status-text">${window.escapeHtml ? window.escapeHtml(status.message) : status.message}</span>
                  ${status.fileName ? `<code class="status-file">${window.escapeHtml ? window.escapeHtml(status.fileName) : status.fileName}</code>` : ''}
                </div>
              `).join('')}
              ${messages.length > 5 ? `<div class="status-more">+${messages.length - 5} more</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Enhance timeline items with status messages
 */
async function enhanceTimelineWithStatusMessages(timelineItems) {
  if (!timelineItems || timelineItems.length === 0) return timelineItems;
  
  // If service is marked offline and we've already checked, skip immediately (NO requests, NO errors)
  if (serviceOffline && healthCheckAttempted) {
    const timeSinceLastCheck = Date.now() - lastFailureTime;
    // Only retry after cooldown period
    if (timeSinceLastCheck < FAILURE_COOLDOWN) {
      return timelineItems;
    }
  }
  
  // Quick health check before proceeding (only if we haven't checked recently or service was online)
  const isHealthy = await checkServiceHealth();
  if (!isHealthy) {
    return timelineItems; // Skip silently if service is offline
  }
  
  // Get time range from timeline items
  const MIN_VALID_TIMESTAMP = 1577836800000; // 2020-01-01
  const MAX_VALID_TIMESTAMP = Date.now() + (24 * 60 * 60 * 1000); // 1 day in future max
  
  const timestamps = timelineItems
    .map(item => item.sortTime || item.timestamp)
    .filter(Boolean)
    .map(ts => {
      if (typeof ts === 'string') {
        const parsed = new Date(ts).getTime();
        return isNaN(parsed) ? null : parsed;
      }
      return typeof ts === 'number' && !isNaN(ts) ? ts : null;
    })
    .filter(Boolean)
    // Filter out invalid timestamps (year 2000, etc.)
    .filter(ts => ts >= MIN_VALID_TIMESTAMP && ts <= MAX_VALID_TIMESTAMP);
  
  if (timestamps.length === 0) return timelineItems;
  
  const startTime = Math.min(...timestamps) - 60000; // 1 minute before
  const endTime = Math.max(...timestamps) + 60000;   // 1 minute after
  
  // Validate time range
  if (isNaN(startTime) || isNaN(endTime) || startTime >= endTime) {
    return timelineItems;
  }
  
  // Additional validation: ensure timestamps are still in valid range after adjustment
  if (startTime < MIN_VALID_TIMESTAMP || endTime > MAX_VALID_TIMESTAMP) {
    return timelineItems;
  }
  
  try {
    // Fetch status messages
    const statusMessages = await fetchStatusMessages(startTime, endTime);
    
    if (!statusMessages || statusMessages.length === 0) {
      return timelineItems;
    }
    
    // Merge status messages into timeline
    const enhancedItems = [...timelineItems];
    
    statusMessages.forEach(status => {
      if (status && status.timestamp) {
        enhancedItems.push({
          ...status,
          itemType: 'status',
          sortTime: typeof status.timestamp === 'number' ? status.timestamp : new Date(status.timestamp).getTime()
        });
      }
    });
    
    // Re-sort
    return enhancedItems.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
  } catch (error) {
    // Silently fail - don't break the timeline
    return timelineItems;
  }
}

/**
 * Show status message modal
 */
function showStatusMessageModal(statusId) {
  // This would open a modal with status message details
  // For now, just log it
  console.log('Show status message modal:', statusId);
}

// Export functions
if (typeof window !== 'undefined') {
  window.fetchStatusMessages = fetchStatusMessages;
  window.renderStatusMessageTimelineItem = renderStatusMessageTimelineItem;
  window.renderStatusMessagesInContext = renderStatusMessagesInContext;
  window.enhanceTimelineWithStatusMessages = enhanceTimelineWithStatusMessages;
  window.getStatusIcon = getStatusIcon;
  window.getStatusColor = getStatusColor;
  window.showStatusMessageModal = showStatusMessageModal;
  
  // Perform one initial health check after page load (with delay to avoid blocking)
  // This will silently fail if service is offline, but won't spam requests
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait 2 seconds after page load before attempting health check
      setTimeout(() => {
        checkServiceHealth().catch(() => {
          // Silently ignore - service is offline
        });
      }, 2000);
    });
  } else {
    // Page already loaded
    setTimeout(() => {
      checkServiceHealth().catch(() => {
        // Silently ignore - service is offline
      });
    }, 2000);
  }
}

