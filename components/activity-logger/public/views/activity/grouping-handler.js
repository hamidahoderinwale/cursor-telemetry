/**
 * Grouping and Aggregation Handler for Activity Timeline
 * Provides grouping by file, session, workflow type, error type, etc.
 */

// Grouping state
let currentGrouping = 'none'; // none, file, session, workflow, error, model
let groupedItems = [];
let groupExpanded = new Set();

/**
 * Group timeline items by selected criteria
 */
function groupTimelineItems(items, groupingType) {
  currentGrouping = groupingType;
  
  if (groupingType === 'none') {
    return items;
  }
  
  const groups = new Map();
  
  // Debug logging for conversation grouping
  if (groupingType === 'conversation') {
    console.log('[GROUPING] Grouping by conversation:', {
      totalItems: items.length,
      itemTypes: items.map(i => i.itemType),
      sampleItem: items[0] ? {
        itemType: items[0].itemType,
        conversationId: items[0].conversationId,
        conversation_id: items[0].conversation_id,
        composerId: items[0].composerId
      } : null
    });
  }
  
  items.forEach(item => {
    let groupKey = '';
    let groupLabel = '';
    
    switch (groupingType) {
      case 'file':
        const filePath = item.file_path || item.filePath || item.path || '';
        if (filePath) {
          groupKey = filePath;
          groupLabel = filePath.split('/').pop() || filePath;
        } else {
          groupKey = '_other';
          groupLabel = 'Other';
        }
        break;
        
      case 'session':
        const sessionId = item.session_id || item.sessionId || 'default';
        groupKey = sessionId;
        groupLabel = `Session ${sessionId.substring(0, 8)}`;
        break;
        
      case 'workflow':
        // Infer workflow type from patterns
        groupKey = inferWorkflowType(item);
        groupLabel = groupKey;
        break;
        
      case 'error':
        if (item.itemType === 'terminal') {
          const exitCode = item.exit_code;
          if (exitCode !== null && exitCode !== undefined && exitCode !== 0) {
            groupKey = 'error';
            groupLabel = `Errors (exit code ${exitCode})`;
          } else {
            groupKey = 'success';
            groupLabel = 'Successful Commands';
          }
        } else {
          groupKey = 'other';
          groupLabel = 'Other';
        }
        break;
        
      case 'model':
        if (item.itemType === 'prompt') {
          const model = item.model_name || item.modelName || item.model_type || item.modelType || 'unknown';
          groupKey = model;
          groupLabel = model;
        } else {
          groupKey = '_other';
          groupLabel = 'Other';
        }
        break;
        
      case 'workspace':
        const workspace = item.workspace_path || item.workspacePath || item.workspaceName || item.workspace || 'unknown';
        groupKey = workspace;
        groupLabel = window.getWorkspaceName ? window.getWorkspaceName(workspace) : workspace.split('/').pop();
        break;
        
      case 'conversation':
        // Group by conversation ID
        // Check multiple possible field names for conversation ID
        let conversationId = item.conversation_id || item.conversationId || item.composerId || 
                            item.parent_conversation_id || item.parentConversationId || '';
        const conversationTitle = item.conversation_title || item.conversationTitle || '';
        
        if (conversationId) {
          // Use conversation ID as key, title as label
          groupKey = conversationId;
          groupLabel = conversationTitle && conversationTitle !== 'Untitled Conversation' && conversationTitle !== 'Untitled'
            ? conversationTitle
            : `Conversation ${conversationId.substring(0, 8)}`;
        } else {
          // Items without conversation ID go to "Standalone" group
          groupKey = '_standalone';
          groupLabel = 'Standalone Items';
        }
        break;
        
      default:
        return items;
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        items: [],
        metadata: {
          count: 0,
          events: 0,
          prompts: 0,
          terminals: 0,
          firstTime: null,
          lastTime: null
        }
      });
    }
    
    const group = groups.get(groupKey);
    group.items.push(item);
    group.metadata.count++;
    
    if (item.itemType === 'event') group.metadata.events++;
    if (item.itemType === 'prompt' || item.itemType === 'conversation-turn') group.metadata.prompts++;
    if (item.itemType === 'terminal') group.metadata.terminals++;
    
    const itemTime = item.sortTime || (item.timestamp ? new Date(item.timestamp).getTime() : Date.now());
    if (!group.metadata.firstTime || itemTime < group.metadata.firstTime) {
      group.metadata.firstTime = itemTime;
    }
    if (!group.metadata.lastTime || itemTime > group.metadata.lastTime) {
      group.metadata.lastTime = itemTime;
    }
  });
  
  // Convert to array and sort
  groupedItems = Array.from(groups.values())
    .map(group => {
      // Sort items within group by time
      group.items.sort((a, b) => {
        const aTime = a.sortTime || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const bTime = b.sortTime || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return bTime - aTime; // Newest first
      });
      return group;
    })
    .sort((a, b) => {
      // Sort groups by most recent activity
      return (b.metadata.lastTime || 0) - (a.metadata.lastTime || 0);
    });
  
  // Debug logging for conversation grouping results
  if (groupingType === 'conversation') {
    console.log('[GROUPING] Conversation grouping complete:', {
      totalGroups: groupedItems.length,
      groups: groupedItems.map(g => ({
        label: g.label,
        count: g.metadata.count,
        events: g.metadata.events,
        prompts: g.metadata.prompts,
        terminals: g.metadata.terminals
      }))
    });
  }
  
  return groupedItems;
}

/**
 * Infer workflow type from item patterns
 */
function inferWorkflowType(item) {
  // Simple heuristics - could be enhanced with ML
  if (item.itemType === 'prompt') {
    const text = (item.text || item.prompt || item.preview || item.content || '').toLowerCase();
    
    if (text.includes('refactor') || text.includes('restructure') || text.includes('reorganize')) {
      return 'Refactoring';
    }
    if (text.includes('bug') || text.includes('fix') || text.includes('error') || text.includes('issue')) {
      return 'Bug Fix';
    }
    if (text.includes('add') || text.includes('create') || text.includes('implement') || text.includes('new feature')) {
      return 'Feature Addition';
    }
    if (text.includes('test') || text.includes('spec') || text.includes('coverage')) {
      return 'Testing';
    }
    if (text.includes('optimize') || text.includes('performance') || text.includes('speed')) {
      return 'Optimization';
    }
    if (text.includes('document') || text.includes('comment') || text.includes('readme')) {
      return 'Documentation';
    }
  }
  
  if (item.itemType === 'event') {
    const filePath = item.file_path || item.filePath || item.path || '';
    const fileName = filePath.split('/').pop() || '';
    
    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'Testing';
    }
    if (fileName.includes('doc') || fileName.includes('readme') || fileName.includes('md')) {
      return 'Documentation';
    }
  }
  
  return 'General Development';
}

/**
 * Render grouped timeline
 */
function renderGroupedTimeline(groups) {
  if (!groups || groups.length === 0) {
    return '<div class="empty-state">No items to display</div>';
  }
  
  // Mark that we're rendering grouped timeline to prevent double-grouping
  window._isRenderingGroupedTimeline = true;
  
  try {
    return groups.map(group => {
      const isExpanded = groupExpanded.has(group.key);
      const duration = group.metadata.lastTime && group.metadata.firstTime 
        ? Math.round((group.metadata.lastTime - group.metadata.firstTime) / 1000 / 60)
        : 0;
      
      return `
        <div class="timeline-group" data-group-key="${group.key}">
          <div class="timeline-group-header" onclick="toggleGroup('${group.key}')">
            <div class="timeline-group-title">
              <span class="group-icon">${isExpanded ? '' : ''}</span>
              <span class="group-label">${window.escapeHtml ? window.escapeHtml(group.label) : group.label}</span>
              <span class="group-badge">${group.metadata.count} items</span>
            </div>
            <div class="timeline-group-meta">
              <span>${group.metadata.events} events</span>
              <span>${group.metadata.prompts} prompts</span>
              ${group.metadata.terminals > 0 ? `<span>${group.metadata.terminals} commands</span>` : ''}
              ${duration > 0 ? `<span>${duration} min</span>` : ''}
            </div>
          </div>
          <div class="timeline-group-items" style="display: ${isExpanded ? 'block' : 'none'}">
            ${window.renderUnifiedTimeline ? window.renderUnifiedTimeline(group.items) : ''}
          </div>
        </div>
      `;
    }).join('');
  } finally {
    // Always clear the flag after rendering
    window._isRenderingGroupedTimeline = false;
  }
}

/**
 * Toggle group expansion
 */
function toggleGroup(groupKey) {
  if (groupExpanded.has(groupKey)) {
    groupExpanded.delete(groupKey);
  } else {
    groupExpanded.add(groupKey);
  }
  
  const itemsContainer = document.querySelector(`.timeline-group[data-group-key="${groupKey}"] .timeline-group-items`);
  const icon = document.querySelector(`.timeline-group[data-group-key="${groupKey}"] .group-icon`);
  
  if (itemsContainer) {
    itemsContainer.style.display = groupExpanded.has(groupKey) ? 'block' : 'none';
  }
  if (icon) {
    icon.textContent = groupExpanded.has(groupKey) ? '' : '';
  }
}

/**
 * Expand all groups
 */
function expandAllGroups() {
  groupedItems.forEach(group => {
    groupExpanded.add(group.key);
  });
  
  // Re-render to show expanded state
  if (window.renderActivityView) {
    const container = document.getElementById('viewContainer');
    if (container) {
      window.renderActivityView(container);
    }
  }
}

/**
 * Collapse all groups
 */
function collapseAllGroups() {
  groupExpanded.clear();
  
  // Re-render to show collapsed state
  if (window.renderActivityView) {
    const container = document.getElementById('viewContainer');
    if (container) {
      window.renderActivityView(container);
    }
  }
}

// Export to window for global access
window.groupTimelineItems = groupTimelineItems;
window.renderGroupedTimeline = renderGroupedTimeline;
window.toggleGroup = toggleGroup;
window.expandAllGroups = expandAllGroups;
window.collapseAllGroups = collapseAllGroups;
window.inferWorkflowType = inferWorkflowType;

