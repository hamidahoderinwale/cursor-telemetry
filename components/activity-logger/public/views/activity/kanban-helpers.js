/**
 * Kanban Board Helpers
 * Renders activity items in a kanban board layout with columns
 */

/**
 * Get intent category for an item
 */
function getItemIntent(item) {
  // Check for explicit intent
  if (item.intent) {
    const intent = item.intent.toLowerCase();
    if (intent.includes('explore') || intent.includes('analysis') || intent.includes('data_exploration')) {
      return 'explore';
    }
    if (intent.includes('implement') || intent.includes('build') || intent.includes('create') || intent.includes('development')) {
      return 'implement';
    }
    if (intent.includes('debug') || intent.includes('fix') || intent.includes('error') || intent.includes('bug')) {
      return 'debug';
    }
    if (intent.includes('refactor') || intent.includes('restructure') || intent.includes('reorganize')) {
      return 'refactor';
    }
  }
  
  // Check annotation for intent hints
  if (item.annotation) {
    const annotation = item.annotation.toLowerCase();
    if (annotation.includes('explore') || annotation.includes('analyze')) return 'explore';
    if (annotation.includes('implement') || annotation.includes('build')) return 'implement';
    if (annotation.includes('debug') || annotation.includes('fix')) return 'debug';
    if (annotation.includes('refactor')) return 'refactor';
  }
  
  // Check file path for hints
  if (item.file_path || item.details?.file_path) {
    const filePath = (item.file_path || item.details?.file_path).toLowerCase();
    if (filePath.includes('test') || filePath.includes('spec')) return 'test';
    if (filePath.includes('doc') || filePath.includes('readme')) return 'documentation';
  }
  
  // Check type
  if (item.itemType === 'prompt') {
    const promptText = (item.text || item.prompt || item.content || '').toLowerCase();
    if (promptText.includes('explore') || promptText.includes('analyze')) return 'explore';
    if (promptText.includes('implement') || promptText.includes('build')) return 'implement';
    if (promptText.includes('debug') || promptText.includes('fix')) return 'debug';
    if (promptText.includes('refactor')) return 'refactor';
  }
  
  // Default to 'other'
  return 'other';
}

/**
 * Group items by intent into kanban columns
 */
function groupItemsByIntent(items) {
  const columns = {
    explore: { items: [], label: 'Explore', icon: '[Search]', color: '#3b82f6' },
    implement: { items: [], label: 'Implement', icon: '[Fast]', color: '#10b981' },
    debug: { items: [], label: 'Debug', icon: '', color: '#ef4444' },
    refactor: { items: [], label: 'Refactor', icon: '', color: '#f59e0b' },
    other: { items: [], label: 'Other', icon: '[Note]', color: '#6b7280' }
  };
  
  items.forEach(item => {
    const intent = getItemIntent(item);
    if (columns[intent]) {
      columns[intent].items.push(item);
    } else {
      columns.other.items.push(item);
    }
  });
  
  // Sort items within each column by timestamp (most recent first)
  Object.keys(columns).forEach(key => {
    columns[key].items.sort((a, b) => {
      const timeA = a.sortTime || new Date(a.timestamp || 0).getTime();
      const timeB = b.sortTime || new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  });
  
  return columns;
}

/**
 * Group items by time period
 */
function groupItemsByTime(items) {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  
  const columns = {
    today: { items: [], label: 'Today', icon: '', color: '#3b82f6' },
    thisWeek: { items: [], label: 'This Week', icon: '', color: '#10b981' },
    older: { items: [], label: 'Older', icon: '', color: '#6b7280' }
  };
  
  items.forEach(item => {
    const itemTime = item.sortTime || new Date(item.timestamp || 0).getTime();
    const diff = now - itemTime;
    
    if (diff < oneDay) {
      columns.today.items.push(item);
    } else if (diff < oneWeek) {
      columns.thisWeek.items.push(item);
    } else {
      columns.older.items.push(item);
    }
  });
  
  // Sort items within each column by timestamp (most recent first)
  Object.keys(columns).forEach(key => {
    columns[key].items.sort((a, b) => {
      const timeA = a.sortTime || new Date(a.timestamp || 0).getTime();
      const timeB = b.sortTime || new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  });
  
  return columns;
}

/**
 * Group items by type
 */
function groupItemsByType(items) {
  const columns = {
    events: { items: [], label: 'File Changes', icon: '', color: '#3b82f6' },
    prompts: { items: [], label: 'Prompts', icon: '[Chat]', color: '#8b5cf6' },
    terminal: { items: [], label: 'Terminal', icon: '[Code]', color: '#10b981' },
    conversations: { items: [], label: 'Conversations', icon: '', color: '#f59e0b' }
  };
  
  items.forEach(item => {
    const type = item.itemType || 'event';
    if (type === 'event') {
      columns.events.items.push(item);
    } else if (type === 'prompt') {
      columns.prompts.items.push(item);
    } else if (type === 'terminal') {
      columns.terminal.items.push(item);
    } else if (type === 'conversation-turn' || type === 'conversation') {
      columns.conversations.items.push(item);
    } else {
      columns.events.items.push(item); // Default to events
    }
  });
  
  // Sort items within each column by timestamp (most recent first)
  Object.keys(columns).forEach(key => {
    columns[key].items.sort((a, b) => {
      const timeA = a.sortTime || new Date(a.timestamp || 0).getTime();
      const timeB = b.sortTime || new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  });
  
  return columns;
}

/**
 * Render a compact kanban card
 */
function renderKanbanCard(item, allItems, index) {
  const timestamp = item.sortTime || new Date(item.timestamp || 0).getTime();
  const timeAgo = window.formatTimeAgo ? window.formatTimeAgo(timestamp) : new Date(timestamp).toLocaleTimeString();
  
  // Get item preview text
  let previewText = '';
  let itemType = item.itemType || 'event';
  let icon = '';
  let color = 'var(--color-primary)';
  
  if (itemType === 'prompt') {
    previewText = (item.text || item.prompt || item.content || 'No prompt text').substring(0, 120);
    icon = '[Chat]';
    color = 'var(--color-accent)';
  } else if (itemType === 'event') {
    const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
    const filePath = details?.file_path || item.file_path || 'Unknown file';
    previewText = filePath.split('/').pop();
    icon = '[Note]';
    color = 'var(--color-success)';
    const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
    const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
    if (linesAdded > 0 || linesRemoved > 0) {
      previewText += ` (+${linesAdded}${linesRemoved > 0 ? `/-${linesRemoved}` : ''})`;
    }
  } else if (itemType === 'terminal') {
    previewText = (item.command || 'Terminal command').substring(0, 80);
    icon = '[Code]';
    color = 'var(--color-success)';
  } else if (itemType === 'conversation-turn') {
    previewText = (item.content || item.text || 'Conversation message').substring(0, 120);
    icon = item.isUser || item.role === 'user' ? '' : '[AI]';
    color = item.isUser || item.role === 'user' ? 'var(--color-primary)' : 'var(--color-accent)';
  } else if (itemType === 'conversation') {
    previewText = (item.title || item.conversationTitle || 'Conversation').substring(0, 100);
    icon = '';
    color = 'var(--color-warning)';
  }
  
  // Truncate preview text
  if (previewText.length > 100) {
    previewText = previewText.substring(0, 100) + '...';
  }
  
  // Get workspace badge
  const workspaceName = item.workspaceName || (item.workspace_path ? item.workspace_path.split('/').pop() : '') || '';
  const workspaceBadge = workspaceName ? `<span class="kanban-card-badge" style="background: var(--color-success-alpha-10); color: var(--color-success); font-size: 10px; padding: 2px 6px; border-radius: 4px;">${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}</span>` : '';
  
  const cardId = `kanban-card-${item.id || item.timestamp || index}`;
  
  return `
    <div class="kanban-card" data-item-id="${item.id || item.timestamp}" onclick="event.stopPropagation(); ${item.id ? `showEventModal('${item.id}')` : ''}" style="border-left: 3px solid ${color};">
      <div class="kanban-card-header">
        <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: var(--space-xs);">
          <span style="font-size: 14px; opacity: 0.8;">${icon}</span>
          <span style="font-size: var(--text-xs); color: var(--color-text-muted); flex: 1;">${timeAgo}</span>
        </div>
      </div>
      <div class="kanban-card-body">
        <div class="kanban-card-preview" style="line-height: 1.5; color: var(--color-text); font-size: var(--text-sm); margin-bottom: var(--space-xs);">
          ${window.escapeHtml ? window.escapeHtml(previewText) : previewText}
        </div>
        ${workspaceBadge ? `
          <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-xs);">
            ${workspaceBadge}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render kanban board
 */
function renderKanbanBoard(items, groupingMode = 'intent') {
  if (!items || items.length === 0) {
    return '<div class="empty-state"><div class="empty-state-text">No items to display</div></div>';
  }
  
  // Flatten temporal threads for kanban display
  const flatItems = [];
  items.forEach(item => {
    if (item.itemType === 'temporal-thread' && item.items) {
      // Add thread items individually
      item.items.forEach(subItem => {
        flatItems.push(subItem);
      });
    } else {
      flatItems.push(item);
    }
  });
  
  // Group items based on mode
  let columns;
  switch (groupingMode) {
    case 'time':
      columns = groupItemsByTime(flatItems);
      break;
    case 'type':
      columns = groupItemsByType(flatItems);
      break;
    case 'intent':
    default:
      columns = groupItemsByIntent(flatItems);
      break;
  }
  
  // Render columns
  const columnOrder = Object.keys(columns);
  const totalItems = flatItems.length;
  
  return `
    <div class="kanban-board">
      ${columnOrder.map(columnKey => {
        const column = columns[columnKey];
        const itemCount = column.items.length;
        const percentage = totalItems > 0 ? Math.round((itemCount / totalItems) * 100) : 0;
        
        return `
          <div class="kanban-column" data-column="${columnKey}">
            <div class="kanban-column-header" style="border-left: 4px solid ${column.color}; background: var(--color-bg-alt);">
              <div class="kanban-column-title">
                <span class="kanban-column-icon" style="color: ${column.color};">${column.icon}</span>
                <div style="flex: 1; min-width: 0;">
                  <div class="kanban-column-label">${column.label}</div>
                  ${itemCount > 0 ? `
                    <div style="font-size: 10px; color: var(--color-text-muted); margin-top: 2px; font-weight: 400;">
                      ${percentage}% of total
                    </div>
                  ` : ''}
                </div>
                <span class="kanban-column-count" style="background: ${column.color}20; color: ${column.color}; border: 1px solid ${column.color}40;">${itemCount}</span>
              </div>
            </div>
            <div class="kanban-column-body">
              ${itemCount === 0 ? `
                <div class="kanban-empty-state">
                  <div style="font-size: 32px; opacity: 0.3; margin-bottom: var(--space-sm);">${column.icon}</div>
                  <div class="kanban-empty-text">No items in this column</div>
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs); opacity: 0.7;">
                    Items will appear here when they match this category
                  </div>
                </div>
              ` : column.items.map((item, idx) => {
                // Render compact kanban cards
                return renderKanbanCard(item, flatItems, idx);
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Export functions
window.renderKanbanBoard = renderKanbanBoard;
window.groupItemsByIntent = groupItemsByIntent;
window.groupItemsByTime = groupItemsByTime;
window.groupItemsByType = groupItemsByType;
window.getItemIntent = getItemIntent;

