/**
 * Timeline Grouping and Chunking Utilities
 * Provides intelligent grouping and visual nesting for timeline items
 */

/**
 * Group events by file within a commit or time window
 */
function groupEventsByFile(events) {
  const fileGroups = new Map();
  
  events.forEach(event => {
    try {
      const details = typeof event.details === 'string' 
        ? JSON.parse(event.details) 
        : (event.details || {});
      
      const filePath = details?.file_path || event.file_path || event.path || '';
      
      if (!filePath) {
        // Events without file paths go into a "misc" group
        if (!fileGroups.has('_misc')) {
          fileGroups.set('_misc', []);
        }
        fileGroups.get('_misc').push(event);
        return;
      }
      
      if (!fileGroups.has(filePath)) {
        fileGroups.set(filePath, []);
      }
      fileGroups.get(filePath).push(event);
    } catch (error) {
      // On error, add to misc
      if (!fileGroups.has('_misc')) {
        fileGroups.set('_misc', []);
      }
      fileGroups.get('_misc').push(event);
    }
  });
  
  // Convert to array and sort by file path
  return Array.from(fileGroups.entries())
    .map(([filePath, events]) => ({
      filePath: filePath === '_misc' ? null : filePath,
      events: events.sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime; // Newest first
      }),
      eventCount: events.length
    }))
    .sort((a, b) => {
      // Sort by event count (most active files first), then by path
      if (b.eventCount !== a.eventCount) {
        return b.eventCount - a.eventCount;
      }
      if (!a.filePath) return 1;
      if (!b.filePath) return -1;
      return a.filePath.localeCompare(b.filePath);
    });
}

/**
 * Group events by type (Code, Config, Doc, etc.)
 */
function groupEventsByType(events) {
  const typeGroups = new Map();
  
  events.forEach(event => {
    const tags = window.eventClassifier ? window.eventClassifier.classifyEvent(event) : [];
    const typeTag = tags.find(tag => ['Code', 'Config', 'Doc', 'Style', 'Test', 'File'].includes(tag)) || 'File';
    
    if (!typeGroups.has(typeTag)) {
      typeGroups.set(typeTag, []);
    }
    typeGroups.get(typeTag).push(event);
  });
  
  return Array.from(typeGroups.entries())
    .map(([type, events]) => ({
      type,
      events: events.sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      }),
      eventCount: events.length
    }))
    .sort((a, b) => b.eventCount - a.eventCount);
}

/**
 * Chunk events by time windows (for better visual grouping)
 */
function chunkEventsByTime(events, timeWindowMs = 5 * 60 * 1000) {
  if (events.length === 0) return [];
  
  const sorted = [...events].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return bTime - aTime; // Newest first
  });
  
  const chunks = [];
  let currentChunk = null;
  
  sorted.forEach(event => {
    const eventTime = new Date(event.timestamp).getTime();
    
    if (!currentChunk || (currentChunk.startTime - eventTime) > timeWindowMs) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = {
        events: [event],
        startTime: eventTime,
        endTime: eventTime
      };
    } else {
      currentChunk.events.push(event);
      currentChunk.endTime = Math.min(currentChunk.endTime, eventTime);
    }
  });
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Create nested groups for commit items
 * Groups by file, then by type, with visual hierarchy
 */
function createNestedCommitGroups(commitGroup) {
  const { items, commit } = commitGroup;
  
  // Separate events and prompts
  const events = items.filter(item => item.itemType === 'event');
  const prompts = items.filter(item => item.itemType === 'prompt');
  
  // Group events by file
  const fileGroups = groupEventsByFile(events);
  
  // Build nested structure
  const nestedGroups = [];
  
  // Add prompts first (if any)
  if (prompts.length > 0) {
    nestedGroups.push({
      type: 'prompts',
      label: `${prompts.length} prompt${prompts.length !== 1 ? 's' : ''}`,
      items: prompts,
      level: 0
    });
  }
  
  // Add file groups
  fileGroups.forEach(({ filePath, events: fileEvents, eventCount }) => {
    if (filePath) {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
      
      // Further group by type within file if there are many events
      if (fileEvents.length > 3) {
        const typeGroups = groupEventsByType(fileEvents);
        
        nestedGroups.push({
          type: 'file',
          label: fileName,
          filePath: filePath,
          items: fileEvents,
          eventCount: eventCount,
          subgroups: typeGroups.map(({ type, events: typeEvents }) => ({
            type: 'type',
            label: type,
            items: typeEvents,
            eventCount: typeEvents.length
          })),
          level: 0
        });
      } else {
        nestedGroups.push({
          type: 'file',
          label: fileName,
          filePath: filePath,
          items: fileEvents,
          eventCount: eventCount,
          level: 0
        });
      }
    } else {
      // Misc events (no file path)
      nestedGroups.push({
        type: 'misc',
        label: 'Other changes',
        items: fileEvents,
        eventCount: eventCount,
        level: 0
      });
    }
  });
  
  return nestedGroups;
}

/**
 * Determine if grouping is valuable (reduces clutter)
 */
function shouldGroup(items, groupType) {
  if (items.length < 2) return false;
  
  // Always group if more than 5 items
  if (items.length > 5) return true;
  
  // Group by file if multiple files
  if (groupType === 'file') {
    const files = new Set();
    items.forEach(item => {
      try {
        const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
        const filePath = details?.file_path || item.file_path || item.path;
        if (filePath) files.add(filePath);
      } catch {}
    });
    return files.size > 1;
  }
  
  // Group by type if multiple types
  if (groupType === 'type') {
    const types = new Set();
    items.forEach(item => {
      const tags = window.eventClassifier ? window.eventClassifier.classifyEvent(item) : [];
      const typeTag = tags.find(tag => ['Code', 'Config', 'Doc', 'Style', 'Test'].includes(tag)) || 'File';
      types.add(typeTag);
    });
    return types.size > 1;
  }
  
  return false;
}

// Export to window
window.groupEventsByFile = groupEventsByFile;
window.groupEventsByType = groupEventsByType;
window.chunkEventsByTime = chunkEventsByTime;
window.createNestedCommitGroups = createNestedCommitGroups;
window.shouldGroup = shouldGroup;

