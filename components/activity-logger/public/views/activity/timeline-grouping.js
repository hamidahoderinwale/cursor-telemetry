/**
 * Timeline Grouping Functions
 * Handles grouping of timeline items by time, similarity, and relationships
 */

/**
 * Group items into temporal threads/sessions based on time proximity
 * @param {Array} items - Timeline items to group
 * @param {number} timeWindowMs - Time window in milliseconds (default: 10 minutes)
 * @returns {Array} Grouped items as temporal threads
 */
function groupIntoTemporalThreads(items, timeWindowMs = 10 * 60 * 1000) {
  if (items.length === 0) return [];
  
  const validItems = items.filter(item => {
    return item.sortTime && !isNaN(item.sortTime) && isFinite(item.sortTime);
  });
  
  if (validItems.length === 0) {
    return items.map(item => ({
      id: `single-${item.id || Date.now()}-${Math.random()}`,
      items: [item],
      startTime: item.sortTime || Date.now(),
      lastItemTime: item.sortTime || Date.now(),
      endTime: item.sortTime || Date.now(),
      itemType: 'temporal-thread'
    }));
  }
  
  const sorted = [...validItems].sort((a, b) => {
    const aTime = a.sortTime || 0;
    const bTime = b.sortTime || 0;
    return bTime - aTime;
  });
  
  const threads = [];
  let currentThread = null;
  const chronological = [...sorted].reverse();
  
  chronological.forEach(item => {
    const itemTime = item.sortTime || Date.now();
    
    if (!currentThread || (itemTime - currentThread.lastItemTime) > timeWindowMs) {
      if (currentThread) {
        threads.push(currentThread);
      }
      currentThread = {
        id: `thread-${itemTime}-${Math.random().toString(36).substr(2, 9)}`,
        items: [item],
        startTime: itemTime,
        lastItemTime: itemTime,
        endTime: itemTime,
        itemType: 'temporal-thread'
      };
    } else {
      currentThread.items.push(item);
      currentThread.lastItemTime = itemTime;
      currentThread.endTime = itemTime;
    }
  });
  
  if (currentThread) {
    threads.push(currentThread);
  }
  
  return threads.reverse();
}

/**
 * Consolidate consecutive similar prompts into groups
 * @param {Array} items - Timeline items
 * @returns {Array} Consolidated items with prompt groups
 */
function consolidateSimilarPrompts(items) {
  const consolidated = [];
  let currentGroup = null;
  const CONSOLIDATION_TIME_WINDOW = 2 * 60 * 1000; // 2 minutes
  const MIN_GROUP_SIZE = 3;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (item.itemType === 'prompt') {
      const workspace = item.workspace_path || item.workspacePath || item.workspaceName || '';
      const conversationId = item.conversation_id || item.conversationId || '';
      const isUntitled = !item.conversationTitle || 
                        item.conversationTitle === 'Untitled Conversation' ||
                        item.conversationTitle === 'Untitled';
      
      if (currentGroup && 
          currentGroup.workspace === workspace &&
          (currentGroup.isUntitled && isUntitled || conversationId && currentGroup.conversationId === conversationId)) {
        const itemTime = item.sortTime || new Date(item.timestamp).getTime();
        const lastItemTime = currentGroup.items[currentGroup.items.length - 1].sortTime || 
                            new Date(currentGroup.items[currentGroup.items.length - 1].timestamp).getTime();
        const timeDiff = Math.abs(itemTime - lastItemTime);
        
        if (timeDiff < CONSOLIDATION_TIME_WINDOW) {
          currentGroup.items.push(item);
          continue;
        }
      }
      
      if (currentGroup && currentGroup.items.length >= MIN_GROUP_SIZE) {
        consolidated.push({
          itemType: 'prompt-group',
          items: currentGroup.items,
          workspace: currentGroup.workspace,
          conversationId: currentGroup.conversationId,
          isUntitled: currentGroup.isUntitled,
          timestamp: currentGroup.items[0].timestamp,
          sortTime: currentGroup.items[0].sortTime,
          _isConsolidated: true
        });
        currentGroup = null;
      } else if (currentGroup && currentGroup.items.length < MIN_GROUP_SIZE) {
        currentGroup.items.forEach(prompt => consolidated.push(prompt));
        currentGroup = null;
      }
      
      currentGroup = {
        items: [item],
        workspace: workspace,
        conversationId: conversationId,
        isUntitled: isUntitled
      };
    } else {
      if (currentGroup) {
        if (currentGroup.items.length >= MIN_GROUP_SIZE) {
          consolidated.push({
            itemType: 'prompt-group',
            items: currentGroup.items,
            workspace: currentGroup.workspace,
            conversationId: currentGroup.conversationId,
            isUntitled: currentGroup.isUntitled,
            timestamp: currentGroup.items[0].timestamp,
            sortTime: currentGroup.items[0].sortTime,
            _isConsolidated: true
          });
        } else {
          currentGroup.items.forEach(prompt => consolidated.push(prompt));
        }
        currentGroup = null;
      }
      consolidated.push(item);
    }
  }
  
  if (currentGroup) {
    if (currentGroup.items.length >= MIN_GROUP_SIZE) {
      consolidated.push({
        itemType: 'prompt-group',
        items: currentGroup.items,
        workspace: currentGroup.workspace,
        conversationId: currentGroup.conversationId,
        isUntitled: currentGroup.isUntitled,
        timestamp: currentGroup.items[0].timestamp,
        sortTime: currentGroup.items[0].sortTime,
        _isConsolidated: true
      });
    } else {
      currentGroup.items.forEach(prompt => consolidated.push(prompt));
    }
  }
  
  return consolidated;
}

/**
 * Build integrated chunks: group prompts with their related code changes
 * @param {Array} items - Timeline items
 * @returns {Array} Integrated chunks
 */
function buildIntegratedChunks(items) {
  const consolidatedItems = consolidateSimilarPrompts(items);
  const chunks = [];
  const processed = new Set();
  const SEQUENCE_WINDOW = 15;
  
  for (let i = 0; i < consolidatedItems.length; i++) {
    const item = consolidatedItems[i];
    
    if (item.itemType === 'prompt-group' && item._isConsolidated) {
      chunks.push(item);
      continue;
    }
    
    if (processed.has(i)) continue;
    
    if (item.itemType === 'prompt') {
      const promptTime = item.sortTime || new Date(item.timestamp).getTime();
      const relatedItems = [];
      
      for (let j = Math.max(0, i - SEQUENCE_WINDOW); j < Math.min(consolidatedItems.length, i + SEQUENCE_WINDOW); j++) {
        if (j === i || processed.has(j)) continue;
        
        const otherItem = consolidatedItems[j];
        if (otherItem.itemType === 'event' || otherItem.itemType === 'file_change') {
          const otherTime = otherItem.sortTime || new Date(otherItem.timestamp).getTime();
          const timeDiff = Math.abs(otherTime - promptTime);
          
          if (timeDiff < 5 * 60 * 1000) {
            relatedItems.push({ item: otherItem, index: j, timeDiff });
          }
        }
      }
      
      if (relatedItems.length > 0) {
        relatedItems.sort((a, b) => a.timeDiff - b.timeDiff);
        const selectedItems = relatedItems.slice(0, 5).map(r => r.item);
        selectedItems.forEach(ri => {
          const idx = consolidatedItems.indexOf(ri);
          if (idx !== -1) processed.add(idx);
        });
        
        chunks.push({
          itemType: 'integrated-chunk',
          prompt: item,
          relatedItems: selectedItems,
          timestamp: item.timestamp,
          sortTime: item.sortTime
        });
        processed.add(i);
      } else {
        chunks.push(item);
      }
    } else {
      chunks.push(item);
    }
  }
  
  return chunks;
}

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.groupIntoTemporalThreads = groupIntoTemporalThreads;
  window.consolidateSimilarPrompts = consolidateSimilarPrompts;
  window.buildIntegratedChunks = buildIntegratedChunks;
}

