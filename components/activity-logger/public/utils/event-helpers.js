/**
 * Event Helper Utilities
 * Pure utility functions for event processing (no HTML)
 */

/**
 * Check if a file path is a git internal file that should be filtered
 */
function isGitInternalFile(path) {
  if (!path) return false;
  
  // Git directory files
  if (path.includes('/.git/') || path.includes('\\.git\\')) return true;
  if (path.startsWith('.git/') || path.startsWith('.git\\')) return true;
  
  // Git object hashes (40 hex chars)
  if (/^[a-f0-9]{40}$/i.test(path)) return true;
  
  // Git object paths (objects/XX/...)
  if (/objects\/[a-f0-9]{2}\/[a-f0-9]{38}/i.test(path)) return true;
  
  // Common git files
  const gitFiles = [
    'COMMIT_EDITMSG',
    'index',
    'HEAD',
    'config',
    'packed-refs',
    'FETCH_HEAD',
    'MERGE_HEAD',
    'ORIG_HEAD'
  ];
  const fileName = path.split('/').pop() || path.split('\\').pop() || '';
  if (gitFiles.includes(fileName) && (path.includes('/.git/') || path.includes('\\.git\\'))) {
    return true;
  }
  
  // Hash-like filenames (32+ hex chars)
  if (/^[a-f0-9]{32,}$/i.test(fileName)) {
    // Check if it's in a git objects directory
    if (path.includes('objects/') || path.includes('objects\\')) return true;
  }
  
  return false;
}

function getEventTitle(event) {
  if (event.type === 'file_change' || event.type === 'code_change') {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || event.file_path || event.path || '';
      
      // Filter out git internal files
      if (isGitInternalFile(path)) {
        return null; // Return null to signal this should be filtered
      }
      
      // Extract filename from path
      const fileName = path.split('/').pop() || path.split('\\').pop() || '';
      
      // If filename is empty or looks like a hash, try to use a better description
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

function getEventDescription(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    
    // Prefer lines over characters for better readability
    const linesAdded = details?.lines_added || details?.added_lines || 0;
    const linesDeleted = details?.lines_deleted || details?.deleted_lines || 0;
    const charsAdded = details?.chars_added || 0;
    const charsDeleted = details?.chars_deleted || 0;
    
    // Use lines if available, otherwise fall back to characters
    if (linesAdded || linesDeleted) {
      if (linesAdded && linesDeleted) {
        return `+${linesAdded.toLocaleString()} / -${linesDeleted.toLocaleString()} lines`;
      } else if (linesAdded) {
        return `+${linesAdded.toLocaleString()} lines`;
      } else if (linesDeleted) {
        return `-${linesDeleted.toLocaleString()} lines`;
      }
    } else if (charsAdded || charsDeleted) {
      // Format large character counts better
      const formatChars = (num) => {
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toLocaleString();
      };
      if (charsAdded && charsDeleted) {
        return `+${formatChars(charsAdded)} / -${formatChars(charsDeleted)} chars`;
      } else if (charsAdded) {
        return `+${formatChars(charsAdded)} chars`;
      } else if (charsDeleted) {
        return `-${formatChars(charsDeleted)} chars`;
      }
    }
    
    // Show change type if available
    const changeType = details?.change_type || event.change_type;
    if (changeType) {
      return changeType.charAt(0).toUpperCase() + changeType.slice(1);
    }
  } catch {}
  return 'File modification detected';
}

// Export helper function
window.isGitInternalFile = isGitInternalFile;

// Export to window for global access
window.getEventTitle = getEventTitle;
window.getEventDescription = getEventDescription;

