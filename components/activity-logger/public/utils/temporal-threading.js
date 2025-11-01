/**
 * Temporal Threading Utilities
 * Pure logic for grouping timeline items by time proximity (no HTML)
 */

/**
 * Group items into temporal threads/sessions based on time proximity
 * Events within a time window (default 15 minutes) are grouped together
 */
function groupIntoTemporalThreads(items, timeWindowMs = 15 * 60 * 1000) {
  if (items.length === 0) return [];
  
  // Filter out items with invalid timestamps first
  const validItems = items.filter(item => {
    return item.sortTime && !isNaN(item.sortTime) && isFinite(item.sortTime);
  });
  
  if (validItems.length === 0) {
    // If no valid items, return items as-is (don't group)
    return items.map(item => ({
      id: `single-${item.id || Date.now()}-${Math.random()}`,
      items: [item],
      startTime: item.sortTime || Date.now(),
      lastItemTime: item.sortTime || Date.now(),
      endTime: item.sortTime || Date.now(),
      itemType: 'temporal-thread'
    }));
  }
  
  // Sort items by time (newest first for display, but we'll process chronologically)
  const sorted = [...validItems].sort((a, b) => {
    const aTime = a.sortTime || 0;
    const bTime = b.sortTime || 0;
    return bTime - aTime;
  });
  
  const threads = [];
  let currentThread = null;
  
  // Process from oldest to newest to build threads
  const chronological = [...sorted].reverse();
  
  chronological.forEach(item => {
    const itemTime = item.sortTime || Date.now();
    
    if (!currentThread || (itemTime - currentThread.lastItemTime) > timeWindowMs) {
      // Start a new thread
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
      // Add to current thread
      currentThread.items.push(item);
      currentThread.lastItemTime = itemTime;
      currentThread.endTime = itemTime;
    }
  });
  
  // Add final thread
  if (currentThread) {
    threads.push(currentThread);
  }
  
  // Convert back to reverse chronological for display
  return threads.reverse();
}

// Export to window for global access
window.groupIntoTemporalThreads = groupIntoTemporalThreads;

