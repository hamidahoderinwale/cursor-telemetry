/**
 * Status Message Visualization
 * Visualizes Cursor status messages like "Read X file", "Planning next moves" in timeline
 */

/**
 * Fetch status messages for a time range
 */
async function fetchStatusMessages(startTime, endTime) {
  try {
    const apiBase = window.CONFIG?.API_BASE_URL || 'http://localhost:43917';
    const response = await fetch(
      `${apiBase}/api/status-messages?startTime=${startTime}&endTime=${endTime}&limit=50`
    );
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('Error fetching status messages:', error);
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
  
  // Get time range from timeline items
  const timestamps = timelineItems
    .map(item => item.sortTime || item.timestamp)
    .filter(Boolean)
    .map(ts => typeof ts === 'string' ? new Date(ts).getTime() : ts);
  
  if (timestamps.length === 0) return timelineItems;
  
  const startTime = Math.min(...timestamps) - 60000; // 1 minute before
  const endTime = Math.max(...timestamps) + 60000;   // 1 minute after
  
  // Fetch status messages
  const statusMessages = await fetchStatusMessages(startTime, endTime);
  
  // Merge status messages into timeline
  const enhancedItems = [...timelineItems];
  
  statusMessages.forEach(status => {
    enhancedItems.push({
      ...status,
      itemType: 'status',
      sortTime: status.timestamp
    });
  });
  
  // Re-sort
  return enhancedItems.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
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
}

