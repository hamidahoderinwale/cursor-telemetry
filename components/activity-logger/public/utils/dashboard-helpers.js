/**
 * Dashboard Helper Utilities
 * General utility functions used throughout the dashboard
 */

/**
 * Generate a consistent color for a workspace based on its path
 * Uses a simple hash function to map workspace paths to colors
 */
function getWorkspaceColor(workspacePath) {
  if (!workspacePath) return '#94A3B8'; // Default gray
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < workspacePath.length; i++) {
    hash = workspacePath.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Color palette for workspaces (distinct colors)
  const colors = [
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#F97316', // Orange-red
    '#A855F7', // Purple-violet
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get workspace name (last directory) from path
 */
function getWorkspaceName(workspacePath) {
  if (!workspacePath) return 'Unknown';
  const parts = workspacePath.split('/').filter(p => p);
  return parts[parts.length - 1] || workspacePath;
}

/**
 * Get directory path from full file path (everything except filename)
 */
function getDirectoryPath(filePath) {
  if (!filePath) return '';
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return filePath.substring(0, lastSlash);
}

/**
 * Format file path with directory structure
 * @param {string} filePath - Full file path
 * @param {number} maxDepth - Maximum directory depth to show (default: 2)
 * @returns {string} Formatted path with directory structure
 */
function formatFilePathWithDirectory(filePath, maxDepth = 2) {
  if (!filePath) return '';
  
  const parts = filePath.split('/').filter(p => p);
  const fileName = parts[parts.length - 1];
  const dirParts = parts.slice(0, -1);
  
  if (dirParts.length === 0) {
    return fileName;
  }
  
  // Show last N directories + filename
  const visibleDirs = dirParts.slice(-maxDepth);
  const prefix = dirParts.length > maxDepth ? '.../' : '';
  
  return `${prefix}${visibleDirs.join('/')}/${fileName}`;
}

/**
 * Create a workspace badge with color coding
 * @param {string} workspacePath - Workspace path
 * @param {string} size - Badge size: 'sm' or 'md' (default: 'sm')
 * @returns {string} HTML for workspace badge
 */
function createWorkspaceBadge(workspacePath, size = 'sm') {
  if (!workspacePath) return '';
  
  const workspaceName = getWorkspaceName(workspacePath);
  const color = getWorkspaceColor(workspacePath);
  const fontSize = size === 'md' ? 'var(--text-sm)' : 'var(--text-xs)';
  const padding = size === 'md' ? 'var(--space-xs) var(--space-sm)' : '2px 6px';
  
  return `
    <span class="workspace-badge" 
          style="background: ${color}20; color: ${color}; border: 1px solid ${color}40; 
                 padding: ${padding}; border-radius: var(--radius-sm); font-size: ${fontSize}; 
                 font-weight: 500; font-family: var(--font-mono);"
          title="${window.escapeHtml ? window.escapeHtml(workspacePath) : workspacePath}">
      ${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}
    </span>
  `;
}

/**
 * Create a file path badge with directory structure
 * @param {string} filePath - Full file path
 * @param {string} workspacePath - Workspace path for color coding
 * @returns {string} HTML for file path badge
 */
function createFilePathBadge(filePath, workspacePath = null) {
  if (!filePath) return '';
  
  const fileName = filePath.split('/').pop();
  const directory = getDirectoryPath(filePath);
  const formattedPath = formatFilePathWithDirectory(filePath, 2);
  const shortPath = formatFilePathWithDirectory(filePath, 1);
  
  return `
    <div style="display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap;">
      <span style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); font-weight: 500;">
        ${window.escapeHtml ? window.escapeHtml(fileName) : fileName}
      </span>
      ${directory ? `
        <span style="font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-muted);" title="${window.escapeHtml ? window.escapeHtml(filePath) : filePath}">
          ${window.escapeHtml ? window.escapeHtml(shortPath) : shortPath}
        </span>
      ` : ''}
      ${workspacePath ? createWorkspaceBadge(workspacePath, 'sm') : ''}
    </div>
  `;
}

/**
 * Truncate a string to a specified length
 */
function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

/**
 * Check if a file path is an image file
 */
function isImageFile(filePath) {
  if (!filePath) return false;
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text, message) {
  navigator.clipboard.writeText(text).then(() => {
    if (message) console.log(message);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

/**
 * Filter events by workspace
 */
function filterEventsByWorkspace(events) {
  if (window.state.currentWorkspace === 'all') return events;
  
  return events.filter(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || '';
      return path.includes(window.state.currentWorkspace);
    } catch {
      return false;
    }
  });
}

/**
 * Filter activity by time range
 */
function filterActivityByTimeRange(range) {
  // Implementation for time range filtering
  console.log('Filtering by:', range);
  if (window.renderCurrentView) {
    window.renderCurrentView();
  }
}

/**
 * Extract prompt text from various possible field names
 * Prompts can come from different sources (Cursor DB, manual capture, etc.)
 * and may use different field names for the text content.
 * 
 * Field priority order:
 * 1. text - Primary field (stored in our database)
 * 2. prompt - Alternative field name
 * 3. preview - Legacy/truncated preview version
 * 4. content - Content field (used in some capture methods)
 * 5. message - Message field (from Cursor's internal data)
 * 
 * @param {Object} prompt - Prompt object
 * @returns {string} Prompt text or empty string
 */
function extractPromptText(prompt) {
  if (!prompt) return '';
  return prompt.text || 
         prompt.prompt || 
         prompt.preview || 
         prompt.content || 
         prompt.message ||
         prompt.textDescription || // From Cursor DB
         '';
}

/**
 * Check if a prompt has meaningful content
 * @param {Object} prompt - Prompt object
 * @param {number} minLength - Minimum length to consider meaningful (default: 5)
 * @returns {boolean} True if prompt has meaningful content
 */
function hasPromptContent(prompt, minLength = 5) {
  const text = extractPromptText(prompt);
  return text && text.length > minLength;
}

/**
 * Normalize workspace path for comparison
 */
function normalizeWorkspacePath(path) {
  if (!path) return '';
  return path.toLowerCase()
    .replace(/\/$/, '') // Remove trailing slash
    .trim();
}

/**
 * Check if prompt text mentions a file path or name
 */
function promptMentionsFile(promptText, filePath) {
  if (!promptText || !filePath) return false;
  const text = promptText.toLowerCase();
  const fileName = filePath.split('/').pop().toLowerCase();
  const filePathLower = filePath.toLowerCase();
  
  return text.includes(fileName) || 
         text.includes(filePathLower) ||
         text.includes(filePathLower.replace(/^.*\//, '')); // Just filename without extension
}

/**
 * Find prompts related to an event using multi-tier matching strategy
 * @param {Object} event - The event to find related prompts for
 * @param {Number} timeWindowMinutes - Time window in minutes to search (default 15)
 * @returns {Array} Array of related prompts, sorted by relevance
 */
function findRelatedPrompts(event, timeWindowMinutes = 15) {
  if (!event || !window.state.data.prompts || window.state.data.prompts.length === 0) {
    return [];
  }

  const eventTime = new Date(event.timestamp).getTime();
  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const shortTimeWindowMs = 5 * 60 * 1000; // 5 minutes for time-only fallback
  
  // Extract and normalize workspace from event
  const eventWorkspace = normalizeWorkspacePath(
    event.workspace_path || event.details?.workspace_path || ''
  );
  const eventFile = event.details?.file_path || event.file_path || '';
  const eventFileName = eventFile ? eventFile.split('/').pop() : '';
  
  // Multi-tier matching: score prompts based on multiple criteria
  const related = window.state.data.prompts
    .map(prompt => {
      const promptTime = new Date(prompt.timestamp).getTime();
      const timeDiff = eventTime - promptTime;
      const absTimeDiff = Math.abs(timeDiff);
      
      // Tier 1: Time-based matching (primary)
      const isWithinWindow = absTimeDiff <= timeWindowMs;
      const isWithinShortWindow = absTimeDiff <= shortTimeWindowMs;
      const isBefore = timeDiff >= 0;
      
      // Skip if way outside time window (unless very close)
      if (!isWithinWindow && !isWithinShortWindow) {
        return null;
      }
      
      // Normalize prompt workspace
      const promptWorkspace = normalizeWorkspacePath(
        prompt.workspacePath || prompt.workspaceId || prompt.workspace_name || ''
      );
      
      // Tier 2: Workspace-based matching (secondary) - multiple fallback strategies
      let workspaceScore = 0;
      let workspaceMatchReason = '';
      
      if (!eventWorkspace || !promptWorkspace) {
        // No workspace data - match all (lower score)
        workspaceScore = 0.3;
        workspaceMatchReason = 'no-workspace-data';
      } else if (eventWorkspace === promptWorkspace) {
        // Exact match
        workspaceScore = 1.0;
        workspaceMatchReason = 'exact-match';
      } else {
        // Check path segment overlap
        const eventParts = eventWorkspace.split('/').filter(p => p);
        const promptParts = promptWorkspace.split('/').filter(p => p);
        const commonParts = eventParts.filter(p => promptParts.includes(p));
        
        if (commonParts.length >= 1) { // Reduced from 2+ to 1+
          workspaceScore = 0.7 + (commonParts.length * 0.05); // 0.7-0.9 based on overlap
          workspaceMatchReason = `segment-overlap-${commonParts.length}`;
        } else if (eventWorkspace.includes(promptWorkspace) || promptWorkspace.includes(eventWorkspace)) {
          // Path inclusion
          workspaceScore = 0.6;
          workspaceMatchReason = 'path-inclusion';
        } else {
          // Check if event file path matches prompt workspace
          if (eventFile && promptWorkspace && eventFile.toLowerCase().includes(promptWorkspace)) {
            workspaceScore = 0.5;
            workspaceMatchReason = 'file-path-match';
          } else {
            workspaceScore = 0.2; // Weak match, but don't exclude
            workspaceMatchReason = 'weak-match';
          }
        }
      }
      
      // Tier 3: Content-based matching (tertiary) - file mentions in prompt text
      const promptText = extractPromptText(prompt).toLowerCase();
      let contentScore = 0;
      if (eventFile && promptMentionsFile(promptText, eventFile)) {
        contentScore = 0.3; // Boost if file is mentioned
      } else if (eventFileName && promptText.includes(eventFileName.toLowerCase())) {
        contentScore = 0.2; // Smaller boost for filename only
      }
      
      // Tier 4: Time-only fallback - if very close in time, include regardless of workspace
      let timeOnlyFallback = false;
      if (isWithinShortWindow && absTimeDiff < 2 * 60 * 1000) { // Within 2 minutes
        timeOnlyFallback = true;
        workspaceScore = Math.max(workspaceScore, 0.4); // Minimum score for close matches
      }
      
      // Calculate temporal score (prefer prompts before events)
      let temporalScore = 0;
      if (isWithinWindow) {
        if (isBefore) {
          temporalScore = 1 - (absTimeDiff / timeWindowMs); // Closer = higher score
        } else {
          temporalScore = 0.7 - ((absTimeDiff / timeWindowMs) * 0.2); // After is less relevant
        }
      } else if (isWithinShortWindow) {
        temporalScore = 0.5 - ((absTimeDiff / shortTimeWindowMs) * 0.3); // Lower score for short window
      }
      
      // Combined relevance score: Time (40%) + Workspace (20%) + Content (20%) + Time Fallback Bonus (20%)
      const baseScore = (temporalScore * 0.4) + (workspaceScore * 0.2) + (contentScore * 0.2);
      const fallbackBonus = timeOnlyFallback ? 0.2 : 0;
      const relevanceScore = Math.min(1.0, baseScore + fallbackBonus);
      
      // Always include prompts within 5 minutes, even if workspace doesn't match
      // Lower threshold for time-based matches to show more relevant prompts
      const minScore = isWithinShortWindow ? 0.1 : 0.2;
      if (relevanceScore < minScore && !timeOnlyFallback) {
        return null;
      }
      
      return {
        ...prompt,
        relevanceScore,
        timeDiffSeconds: Math.floor(absTimeDiff / 1000),
        isBefore,
        matchDetails: {
          temporalScore,
          workspaceScore,
          contentScore,
          workspaceMatchReason,
          timeOnlyFallback
        }
      };
    })
    .filter(p => p !== null) // Remove null entries
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10); // Limit to top 10
  
  return related;
}

/**
 * Find prompts related to an event based on timeline sequence position
 * @param {Object} event - The event to find related prompts for
 * @param {Array} timelineItems - Sorted array of all timeline items (reverse chronological)
 * @param {Number} sequenceWindow - Number of items to look before/after in sequence (default: 20 before, 5 after)
 * @returns {Array} Array of related prompts, sorted by relevance
 */
function findRelatedPromptsBySequence(event, timelineItems = [], sequenceWindow = { before: 20, after: 5 }) {
  if (!event || !timelineItems || timelineItems.length === 0) {
    // Fallback to time-based if no timeline items
    return window.findRelatedPrompts ? window.findRelatedPrompts(event, 15) : [];
  }

  // Find event's position in timeline
  const eventIndex = timelineItems.findIndex(item => 
    item.itemType === 'event' && 
    (item.id === event.id || item.timestamp === event.timestamp || 
     (item.id && event.id && item.id.toString() === event.id.toString()))
  );

  if (eventIndex === -1) {
    // Fallback to time-based if event not found in timeline
    return window.findRelatedPrompts ? window.findRelatedPrompts(event, 15) : [];
  }

  // Look for prompts in sequence window (before = higher index, after = lower index)
  const startIndex = Math.max(0, eventIndex - sequenceWindow.before);
  const endIndex = Math.min(timelineItems.length, eventIndex + sequenceWindow.after + 1);
  
  const sequenceItems = timelineItems.slice(startIndex, endIndex);
  
  // Extract workspace and file info from event
  const eventWorkspace = normalizeWorkspacePath(
    event.workspace_path || event.details?.workspace_path || ''
  );
  const eventFile = event.details?.file_path || event.file_path || '';
  const eventFileName = eventFile ? eventFile.split('/').pop() : '';

  // Score prompts based on sequence position, workspace, and content
  const related = sequenceItems
    .map((item, idx) => {
      // Only process prompts
      if (item.itemType !== 'prompt') return null;
      
      const prompt = item;
      const sequenceIndex = startIndex + idx;
      const sequenceDistance = Math.abs(sequenceIndex - eventIndex);
      
      // Sequence score: closer = higher score (inverse of distance)
      const maxDistance = sequenceWindow.before + sequenceWindow.after;
      const sequenceScore = 1 - (sequenceDistance / maxDistance);
      
      // Check if prompt is before event in sequence (appears earlier in timeline = happened later chronologically)
      const isBeforeInSequence = sequenceIndex > eventIndex;
      
      // Workspace matching
      const promptWorkspace = normalizeWorkspacePath(
        prompt.workspacePath || prompt.workspaceId || prompt.workspace_name || ''
      );
      
      let workspaceScore = 0;
      if (!eventWorkspace || !promptWorkspace) {
        workspaceScore = 0.3;
      } else if (eventWorkspace === promptWorkspace) {
        workspaceScore = 1.0;
      } else {
        const eventParts = eventWorkspace.split('/').filter(p => p);
        const promptParts = promptWorkspace.split('/').filter(p => p);
        const commonParts = eventParts.filter(p => promptParts.includes(p));
        if (commonParts.length >= 1) {
          workspaceScore = 0.7 + (commonParts.length * 0.05);
        } else if (eventWorkspace.includes(promptWorkspace) || promptWorkspace.includes(eventWorkspace)) {
          workspaceScore = 0.6;
        } else {
          workspaceScore = 0.2;
        }
      }
      
      // Content matching
      const promptText = extractPromptText(prompt).toLowerCase();
      let contentScore = 0;
      if (eventFile && promptMentionsFile(promptText, eventFile)) {
        contentScore = 0.3;
      } else if (eventFileName && promptText.includes(eventFileName.toLowerCase())) {
        contentScore = 0.2;
      }
      
      // Combined score: Sequence (50%) + Workspace (30%) + Content (20%)
      const relevanceScore = (sequenceScore * 0.5) + (workspaceScore * 0.3) + (contentScore * 0.2);
      
      // Only include if score is above threshold
      if (relevanceScore < 0.3) {
        return null;
      }
      
      // Calculate time difference for display
      const eventTime = new Date(event.timestamp).getTime();
      const promptTime = new Date(prompt.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - promptTime);
      
      return {
        ...prompt,
        relevanceScore,
        sequenceDistance,
        isBeforeInSequence,
        timeDiffSeconds: Math.floor(timeDiff / 1000),
        isBefore: promptTime < eventTime
      };
    })
    .filter(p => p !== null)
    .sort((a, b) => {
      // Sort by relevance, then by sequence distance
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.01) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.sequenceDistance - b.sequenceDistance;
    })
    .slice(0, 10);
  
  return related;
}

/**
 * Find events related to a prompt based on timeline sequence position
 * @param {Object} prompt - The prompt to find related events for
 * @param {Array} timelineItems - Sorted array of all timeline items (reverse chronological)
 * @param {Number} sequenceWindow - Number of items to look after in sequence (default: 15)
 * @returns {Array} Array of related events, sorted by relevance
 */
function findRelatedEventsBySequence(prompt, timelineItems = [], sequenceWindow = 15) {
  if (!prompt || !timelineItems || timelineItems.length === 0) {
    // Fallback to time-based if no timeline items
    return window.findRelatedEvents ? window.findRelatedEvents(prompt, 15) : [];
  }

  // Find prompt's position in timeline
  const promptIndex = timelineItems.findIndex(item => 
    item.itemType === 'prompt' && 
    (item.id === prompt.id || item.timestamp === prompt.timestamp ||
     (item.id && prompt.id && item.id.toString() === prompt.id.toString()))
  );

  if (promptIndex === -1) {
    // Fallback to time-based if prompt not found in timeline
    return window.findRelatedEvents ? window.findRelatedEvents(prompt, 15) : [];
  }

  // Look for events AFTER prompt in sequence (lower index = newer = happened after)
  const endIndex = Math.min(timelineItems.length, promptIndex + sequenceWindow + 1);
  const sequenceItems = timelineItems.slice(promptIndex + 1, endIndex);
  
  const promptWorkspace = normalizeWorkspacePath(
    prompt.workspacePath || prompt.workspaceId || prompt.workspace_name || ''
  );
  const promptText = extractPromptText(prompt).toLowerCase();
  
  // Score events based on sequence position, workspace, and content
  const related = sequenceItems
    .map((item, idx) => {
      // Only process events
      if (item.itemType !== 'event') return null;
      
      const event = item;
      const sequenceDistance = idx + 1; // Distance from prompt
      
      // Sequence score: closer = higher score
      const sequenceScore = 1 - (sequenceDistance / sequenceWindow);
      
      const eventWorkspace = normalizeWorkspacePath(
        event.workspace_path || event.details?.workspace_path || ''
      );
      const eventFile = event.details?.file_path || event.file_path || '';
      
      // Workspace matching
      let workspaceScore = 0;
      if (!promptWorkspace || !eventWorkspace) {
        workspaceScore = 0.3;
      } else if (promptWorkspace === eventWorkspace) {
        workspaceScore = 1.0;
      } else {
        const promptParts = promptWorkspace.split('/').filter(p => p);
        const eventParts = eventWorkspace.split('/').filter(p => p);
        const commonParts = promptParts.filter(p => eventParts.includes(p));
        if (commonParts.length >= 1) {
          workspaceScore = 0.7 + (commonParts.length * 0.05);
        } else if (promptWorkspace.includes(eventWorkspace) || eventWorkspace.includes(promptWorkspace)) {
          workspaceScore = 0.6;
        } else {
          workspaceScore = 0.2;
        }
      }
      
      // Content matching
      let contentScore = 0;
      if (eventFile && promptMentionsFile(promptText, eventFile)) {
        contentScore = 0.3;
      }
      
      // Combined score: Sequence (50%) + Workspace (30%) + Content (20%)
      const relevanceScore = (sequenceScore * 0.5) + (workspaceScore * 0.3) + (contentScore * 0.2);
      
      if (relevanceScore < 0.3) {
        return null;
      }
      
      // Calculate time difference
      const promptTime = new Date(prompt.timestamp).getTime();
      const eventTime = new Date(event.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - promptTime);
      
      return {
        ...event,
        relevanceScore,
        sequenceDistance,
        timeDiffSeconds: Math.floor(timeDiff / 1000),
        isAfter: eventTime > promptTime
      };
    })
    .filter(e => e !== null)
    .sort((a, b) => {
      // Sort by relevance, then by sequence distance
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.01) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.sequenceDistance - b.sequenceDistance;
    })
    .slice(0, 10);
  
  return related;
}

/**
 * Find events related to a prompt (reverse lookup) - TIME-BASED (legacy)
 * @param {Object} prompt - The prompt to find related events for
 * @param {Number} timeWindowMinutes - Time window in minutes to search (default 15)
 * @returns {Array} Array of related events, sorted by relevance
 */
function findRelatedEvents(prompt, timeWindowMinutes = 15) {
  if (!prompt || !window.state.data.events || window.state.data.events.length === 0) {
    return [];
  }

  const promptTime = new Date(prompt.timestamp).getTime();
  const timeWindowMs = timeWindowMinutes * 60 * 1000;
  const shortTimeWindowMs = 5 * 60 * 1000;
  
  const promptWorkspace = normalizeWorkspacePath(
    prompt.workspacePath || prompt.workspaceId || prompt.workspace_name || ''
  );
  const promptText = extractPromptText(prompt).toLowerCase();
  
  const related = window.state.data.events
    .map(event => {
      const eventTime = new Date(event.timestamp).getTime();
      const timeDiff = eventTime - promptTime;
      const absTimeDiff = Math.abs(timeDiff);
      
      // Events should come AFTER prompts (prompt → code change)
      const isAfter = timeDiff >= 0;
      const isWithinWindow = absTimeDiff <= timeWindowMs;
      const isWithinShortWindow = absTimeDiff <= shortTimeWindowMs;
      
      if (!isAfter || (!isWithinWindow && !isWithinShortWindow)) {
        return null;
      }
      
      const eventWorkspace = normalizeWorkspacePath(
        event.workspace_path || event.details?.workspace_path || ''
      );
      const eventFile = event.details?.file_path || event.file_path || '';
      
      // Workspace matching
      let workspaceScore = 0;
      if (!promptWorkspace || !eventWorkspace) {
        workspaceScore = 0.3;
      } else if (promptWorkspace === eventWorkspace) {
        workspaceScore = 1.0;
      } else {
        const promptParts = promptWorkspace.split('/').filter(p => p);
        const eventParts = eventWorkspace.split('/').filter(p => p);
        const commonParts = promptParts.filter(p => eventParts.includes(p));
        if (commonParts.length >= 1) {
          workspaceScore = 0.7 + (commonParts.length * 0.05);
        } else if (promptWorkspace.includes(eventWorkspace) || eventWorkspace.includes(promptWorkspace)) {
          workspaceScore = 0.6;
        } else {
          workspaceScore = 0.2;
        }
      }
      
      // Content matching
      let contentScore = 0;
      if (eventFile && promptMentionsFile(promptText, eventFile)) {
        contentScore = 0.3;
      }
      
      // Temporal score (closer = better)
      const temporalScore = isWithinWindow 
        ? 1 - (absTimeDiff / timeWindowMs)
        : 0.5 - ((absTimeDiff / shortTimeWindowMs) * 0.3);
      
      const relevanceScore = (temporalScore * 0.4) + (workspaceScore * 0.2) + (contentScore * 0.2);
      
      if (relevanceScore < 0.2) {
        return null;
      }
      
      return {
        ...event,
        relevanceScore,
        timeDiffSeconds: Math.floor(absTimeDiff / 1000),
        isAfter
      };
    })
    .filter(e => e !== null)
    .sort((a, b) => {
      // Sort by time first (earliest first), then by relevance
      if (Math.abs(a.sortTime - b.sortTime) < 1000) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.sortTime - b.sortTime;
    })
    .slice(0, 10);
  
  return related;
}

// Export functions to window for global access
window.truncate = truncate;
window.isImageFile = isImageFile;
window.copyToClipboard = copyToClipboard;
window.filterEventsByWorkspace = filterEventsByWorkspace;
window.filterActivityByTimeRange = filterActivityByTimeRange;
window.findRelatedPrompts = findRelatedPrompts; // Time-based (legacy)
window.findRelatedEvents = findRelatedEvents; // Time-based (legacy)
window.findRelatedPromptsBySequence = findRelatedPromptsBySequence; // Sequence-based (new)
window.findRelatedEventsBySequence = findRelatedEventsBySequence; // Sequence-based (new)
window.normalizeWorkspacePath = normalizeWorkspacePath;
window.promptMentionsFile = promptMentionsFile;
window.extractPromptText = extractPromptText;
window.hasPromptContent = hasPromptContent;
window.getWorkspaceColor = getWorkspaceColor;
window.getWorkspaceName = getWorkspaceName;
window.getDirectoryPath = getDirectoryPath;
window.formatFilePathWithDirectory = formatFilePathWithDirectory;
window.createWorkspaceBadge = createWorkspaceBadge;
window.createFilePathBadge = createFilePathBadge;

