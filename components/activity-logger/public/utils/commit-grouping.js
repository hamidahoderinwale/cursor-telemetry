/**
 * Commit Grouping Utility
 * Groups events and prompts by git commits for visual threading
 */

/**
 * Fetch git commits from API
 */
async function fetchGitCommits() {
  try {
    const apiBase = window.CONFIG?.API_BASE_URL || window.DASHBOARD_CONFIG?.API_BASE_URL || 'http://localhost:43917';
    const response = await fetch(`${apiBase}/raw-data/git?limit=50`, {
      timeout: 5000,
      signal: AbortSignal.timeout(5000)
    }).catch(() => null);
    
    if (!response || !response.ok) return [];
    
    const data = await response.json().catch(() => ({}));
    // Handle different response formats
    const gitData = data?.data || data?.gitData || (Array.isArray(data) ? data : []);
    
    // Parse commits from git data
    const commits = [];
    gitData.forEach(entry => {
      if (entry.recentCommits && Array.isArray(entry.recentCommits)) {
        entry.recentCommits.forEach(commitLine => {
          if (commitLine && commitLine.trim()) {
            // Git log --oneline format: "hash message"
            // Try to extract hash (first 7-40 hex chars) and message
            const trimmed = commitLine.trim();
            const hashMatch = trimmed.match(/^([a-f0-9]{7,40})\s+(.+)$/i);
            if (hashMatch) {
              commits.push({
                hash: hashMatch[1],
                message: hashMatch[2],
                timestamp: entry.timestamp || Date.now(),
                branch: entry.branch || 'main'
              });
            } else {
              // Fallback: split by first space
              const parts = trimmed.split(/\s+/, 2);
              if (parts.length >= 2 && /^[a-f0-9]{7,40}$/i.test(parts[0])) {
                commits.push({
                  hash: parts[0],
                  message: parts[1] || 'No message',
                  timestamp: entry.timestamp || Date.now(),
                  branch: entry.branch || 'main'
                });
              }
            }
          }
        });
      }
    });
    
    // Remove duplicates and sort
    return Array.from(
      new Map(commits.map(c => [c.hash, c])).values()
    ).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.debug('[COMMIT-GROUPING] Could not fetch git commits:', error.message);
    return [];
  }
}

/**
 * Get file paths from an event
 */
function getEventFilePaths(event) {
  const paths = new Set();
  
  // Direct file_path
  if (event.file_path) paths.add(event.file_path);
  
  // From details
  if (event.details) {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      if (details.file_path) paths.add(details.file_path);
      if (details.files && Array.isArray(details.files)) {
        details.files.forEach(f => {
          if (typeof f === 'string') paths.add(f);
          else if (f.path) paths.add(f.path);
        });
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  return Array.from(paths);
}

/**
 * Match events to commits based on time window and file paths
 * Uses heuristics: events within time window before commit
 * Since git log --oneline doesn't include timestamps, we use the entry timestamp
 * and match events that occurred shortly before that time
 */
function matchEventsToCommits(events, commits, timeWindowMs = 15 * 60 * 1000) {
  const commitMap = new Map();
  
  // Initialize commit groups
  commits.forEach(commit => {
    commitMap.set(commit.hash, {
      commit,
      events: [],
      prompts: [],
      filePaths: new Set()
    });
  });
  
  // Sort commits by timestamp (newest first)
  const sortedCommits = [...commits].sort((a, b) => {
    const aTime = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp).getTime();
    const bTime = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp).getTime();
    return bTime - aTime;
  });
  
  // Match events to commits (each event can only belong to one commit)
  const usedEventIds = new Set();
  
  events.forEach(event => {
    if (usedEventIds.has(event.id || event.timestamp)) return;
    
    const eventTime = new Date(event.timestamp).getTime();
    const eventPaths = getEventFilePaths(event);
    
    // Find the closest commit (event within time window before commit)
    // Prefer commits where event is closer to commit time
    let bestMatch = null;
    let bestTimeDiff = Infinity;
    
    for (const commit of sortedCommits) {
      const commitTime = typeof commit.timestamp === 'number' 
        ? commit.timestamp 
        : new Date(commit.timestamp).getTime();
      const timeDiff = commitTime - eventTime;
      
      // Event must be before commit and within time window
      if (timeDiff > 0 && timeDiff <= timeWindowMs && timeDiff < bestTimeDiff) {
        bestMatch = commit;
        bestTimeDiff = timeDiff;
      }
    }
    
    if (bestMatch) {
      const group = commitMap.get(bestMatch.hash);
      group.events.push(event);
      eventPaths.forEach(p => group.filePaths.add(p));
      usedEventIds.add(event.id || event.timestamp);
    }
  });
  
  return commitMap;
}

/**
 * Match prompts to commits via their linked events
 */
function matchPromptsToCommits(prompts, commitGroups) {
  prompts.forEach(prompt => {
    // Find events linked to this prompt
    const promptId = prompt.id || prompt.prompt_id;
    const promptTime = new Date(prompt.timestamp).getTime();
    
    // Check each commit group for linked events
    for (const [hash, group] of commitGroups.entries()) {
      const linkedEvent = group.events.find(e => {
        const linkedPromptId = e.prompt_id || e.linked_entry_id || e.linked_prompt_id;
        return linkedPromptId === promptId;
      });
      
      if (linkedEvent) {
        group.prompts.push(prompt);
        break;
      }
      
      // Also match by time proximity if prompt is close to commit
      const commitTime = typeof group.commit.timestamp === 'number' 
        ? group.commit.timestamp 
        : new Date(group.commit.timestamp).getTime();
      const timeDiff = Math.abs(commitTime - promptTime);
      
      // If prompt is within 5 minutes of commit and has related events
      if (timeDiff <= 5 * 60 * 1000 && group.events.length > 0) {
        group.prompts.push(prompt);
        break;
      }
    }
  });
}

/**
 * Group timeline items by commits
 */
async function groupByCommits(timelineItems) {
  // Separate items by type
  const events = timelineItems.filter(item => item.itemType === 'event');
  const prompts = timelineItems.filter(item => item.itemType === 'prompt');
  const otherItems = timelineItems.filter(item => 
    item.itemType !== 'event' && item.itemType !== 'prompt'
  );
  
  // Fetch commits
  const commits = await fetchGitCommits();
  
  if (commits.length === 0) {
    // No commits, return items as-is
    return timelineItems;
  }
  
  // Match events to commits
  const commitGroups = matchEventsToCommits(events, commits);
  
  // Match prompts to commits
  matchPromptsToCommits(prompts, commitGroups);
  
  // Build grouped timeline
  const groupedItems = [];
  const usedItemIds = new Set();
  
  // Add commit groups (only if they have at least 2 items, or 1 item with meaningful content)
  for (const [hash, group] of commitGroups.entries()) {
    const totalItems = group.events.length + group.prompts.length;
    
    // Skip empty groups
    if (totalItems === 0) continue;
    
    // For single-item groups, only show if it's a meaningful event (not just a prompt)
    // This prevents cluttering with single-prompt commits
    if (totalItems === 1 && group.events.length === 0) {
      // Single prompt only - don't group, let it show normally
      continue;
    }
    
    // Mark items as used
    group.events.forEach(e => usedItemIds.add(e.id || e.timestamp));
    group.prompts.forEach(p => usedItemIds.add(p.id || p.timestamp));
    
    // Sort items within commit group (chronologically within commit)
    const commitItems = [
      ...group.prompts,
      ...group.events
    ].sort((a, b) => {
      const aTime = a.sortTime || new Date(a.timestamp).getTime();
      const bTime = b.sortTime || new Date(b.timestamp).getTime();
      return bTime - aTime; // Newest first
    });
    
    const commitTime = typeof group.commit.timestamp === 'number'
      ? group.commit.timestamp
      : new Date(group.commit.timestamp).getTime();
    
    groupedItems.push({
      itemType: 'commit-group',
      commit: group.commit,
      items: commitItems,
      sortTime: commitTime,
      id: `commit-${hash}`,
      eventCount: group.events.length,
      promptCount: group.prompts.length
    });
  }
  
  // Add unused items (not matched to any commit)
  const unusedItems = timelineItems.filter(item => {
    const itemId = item.id || item.timestamp;
    return !usedItemIds.has(itemId);
  });
  
  // Combine: commit groups first, then unused items
  const allItems = [...groupedItems, ...unusedItems].sort((a, b) => {
    const aTime = a.sortTime || 0;
    const bTime = b.sortTime || 0;
    return bTime - aTime; // Newest first
  });
  
  return allItems;
}

// Export to window
window.groupByCommits = groupByCommits;
window.fetchGitCommits = fetchGitCommits;

