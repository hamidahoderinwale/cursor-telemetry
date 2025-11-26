/**
 * Timeline Utility Functions
 * Helper functions for extracting and formatting timeline data
 */

/**
 * Extract file path from event
 * @param {Object} event - Event object
 * @returns {string} File path
 */
function getFilePathFromEvent(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    return details?.file_path || event.file_path || event.path || '';
  } catch (e) {
    return event.file_path || event.path || '';
  }
}

/**
 * Extract conversation title for summary display
 * @param {Object} conversation - Conversation object
 * @returns {string} Conversation title
 */
function extractConversationTitle(conversation) {
  const { thread, messages } = conversation || {};
  
  function extractText(obj) {
    if (!obj) return '';
    const text = obj.text || obj.prompt || obj.preview || obj.content || '';
    if (!text) return '';
    if (text.startsWith('{') || text.startsWith('[')) return '';
    const cleaned = text.trim();
    if (cleaned.match(/^[\[\]{}",:\s]*$/) || cleaned.length < 3) return '';
    return cleaned;
  }
  
  function smartTitle(text, maxLength = 60) {
    if (!text) return '';
    let cleaned = text.trim().replace(/\s+/g, ' ');
    const sentenceMatch = cleaned.match(/^[^.!?]+[.!?]/);
    if (sentenceMatch) cleaned = sentenceMatch[0].trim();
    if (cleaned.length > maxLength) {
      const truncated = cleaned.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      cleaned = lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }
    return cleaned;
  }
  
  if (thread?.conversationTitle) return thread.conversationTitle;
  if (thread) {
    const threadText = extractText(thread);
    if (threadText) return smartTitle(threadText);
  }
  if (messages && Array.isArray(messages) && messages.length > 0) {
    const sorted = [...messages].sort((a, b) => (a.sortTime || 0) - (b.sortTime || 0));
    const firstUser = sorted.find(m => (m.messageRole === 'user' || !m.messageRole) && extractText(m).length > 5);
    if (firstUser) {
      const text = extractText(firstUser);
      if (text) return smartTitle(text);
    }
  }
  
  return 'Untitled Conversation';
}

/**
 * Extract context files from a prompt
 * @param {Object} prompt - Prompt object
 * @returns {Array<string>} Array of file paths
 */
function extractContextFiles(prompt) {
  const files = [];
  try {
    const contextFiles = prompt.context_files || prompt.contextFiles;
    if (contextFiles) {
      if (typeof contextFiles === 'string') {
        const parsed = JSON.parse(contextFiles);
        if (Array.isArray(parsed)) {
          files.push(...parsed.filter(f => f && typeof f === 'string'));
        }
      } else if (Array.isArray(contextFiles)) {
        files.push(...contextFiles.filter(f => f && typeof f === 'string'));
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return files;
}

/**
 * Extract @ files from a prompt
 * @param {Object} prompt - Prompt object
 * @returns {Array<string>} Array of file paths
 */
function extractAtFiles(prompt) {
  const files = [];
  try {
    const atFiles = prompt.at_files || prompt.atFiles;
    if (atFiles) {
      if (typeof atFiles === 'string') {
        const parsed = JSON.parse(atFiles);
        if (Array.isArray(parsed)) {
          files.push(...parsed.filter(f => f && typeof f === 'string'));
        }
      } else if (Array.isArray(atFiles)) {
        files.push(...atFiles.filter(f => f && typeof f === 'string'));
      }
    }
  } catch (e) {
    // Ignore parse errors
  }
  return files;
}

/**
 * Get event title
 * @param {Object} event - Event object
 * @returns {string} Event title
 */
function getEventTitle(event) {
  if (event.type === 'file_change' || event.type === 'code_change') {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || event.file_path || event.path || '';
      
      if (/^[a-f0-9]{40}$/i.test(path)) {
        return 'Git object change';
      }
      
      const fileName = path.split('/').pop() || '';
      
      if (!fileName || /^[a-f0-9]{32,}$/i.test(fileName)) {
        return details?.change_type || event.type || 'File changed';
      }
      
      return fileName;
    } catch {
      return 'File changed';
    }
  }
  return event.type || 'Activity';
}

/**
 * Get enhanced file information with workspace and directory context
 * @param {Object} event - Event object
 * @returns {Object} Enhanced file info
 */
function getEnhancedFileInfo(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const filePath = details?.file_path || event.file_path || event.path || '';
    const workspacePath = event.workspace_path || event.details?.workspace_path || '';
    
    if (!filePath) {
      return {
        fileName: event.type || 'Activity',
        directory: '',
        workspacePath: workspacePath,
        fullPath: '',
        badges: '',
        displayTitle: event.type || 'Activity'
      };
    }
    
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    const pathParts = filePath.split('/').filter(p => p) || filePath.split('\\').filter(p => p);
    const directory = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
    const shortDirectory = directory ? (directory.split('/').slice(-2).join('/') || directory.split('\\').slice(-2).join('\\')) : '';
    
    let displayTitle = fileName;
    if (shortDirectory && fileName) {
      displayTitle = `<span style="color: var(--color-text-muted); font-size: 0.9em;">${window.escapeHtml ? window.escapeHtml(shortDirectory) : shortDirectory}/</span>${window.escapeHtml ? window.escapeHtml(fileName) : fileName}`;
    } else if (fileName) {
      displayTitle = window.escapeHtml ? window.escapeHtml(fileName) : fileName;
    }
    
    return {
      fileName,
      directory,
      workspacePath,
      fullPath: filePath,
      formattedPath: shortDirectory ? `${shortDirectory}/${fileName}` : fileName,
      badges: '',
      displayTitle
    };
  } catch (e) {
    return {
      fileName: event.type || 'Activity',
      directory: '',
      workspacePath: '',
      fullPath: '',
      badges: '',
      displayTitle: event.type || 'Activity'
    };
  }
}

/**
 * Get event description
 * @param {Object} event - Event object
 * @returns {string} Event description
 */
function getEventDescription(event) {
  const removeEmojis = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/[Reload]||↗|⇄|→|||[Target]|[Note]|[Chat]|[Fast]|[Tool]|[Chart]|[Art]|||[Search]|[Settings]|[Launch]|[Idea]|[Locked]|[Up]|[Down]|[Mask]|[Circus]|[Film]|[Pin]|||||[Star]||[Fire]||[OK]|[X]|[Warning]|[Info]|[Bell]||||🟢|🟡||🟣|🟠|||🟤/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
      .trim();
  };
  
  if (event.annotation) {
    return removeEmojis(event.annotation);
  }
  
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    
    if (details?.change_type) {
      return details.change_type;
    }
    
    const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
    const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
    
    if (linesAdded > 0 || linesRemoved > 0) {
      return `${linesAdded > 0 ? `+${linesAdded}` : ''}${linesRemoved > 0 ? (linesAdded > 0 ? ' / ' : '') + `-${linesRemoved}` : ''} lines`;
    }
    
    return event.type || 'Activity';
  } catch {
    return event.type || 'Activity';
  }
}

/**
 * Highlight file in file graph (if available)
 * @param {string} filePath - File path to highlight
 */
function highlightFileInGraph(filePath) {
  if (window.highlightFileInGraph) {
    window.highlightFileInGraph(filePath);
  } else if (window.filterGraphNodes) {
    const fileName = filePath.split('/').pop();
    window.filterGraphNodes(fileName);
  }
}

/**
 * Toggle context files visibility
 * @param {string} contextFileId - Context file element ID
 */
function toggleContextFiles(contextFileId) {
  const element = document.getElementById(contextFileId);
  if (element) {
    const isHidden = element.style.display === 'none' || !element.classList.contains('visible');
    if (isHidden) {
      element.style.display = 'block';
      element.classList.add('visible');
    } else {
      element.style.display = 'none';
      element.classList.remove('visible');
    }
  }
}

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.getFilePathFromEvent = getFilePathFromEvent;
  window.extractConversationTitle = extractConversationTitle;
  window.extractContextFiles = extractContextFiles;
  window.extractAtFiles = extractAtFiles;
  window.getEventTitle = getEventTitle;
  window.getEnhancedFileInfo = getEnhancedFileInfo;
  window.getEventDescription = getEventDescription;
  window.highlightFileInGraph = highlightFileInGraph;
  window.toggleContextFiles = toggleContextFiles;
}

