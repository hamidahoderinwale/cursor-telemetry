/**
 * Event Classifier and Summary Generator
 * Provides intelligent tagging and 1-line summaries for events
 */

class EventClassifier {
  constructor() {
    // Tag patterns and rules
    this.tagPatterns = {
      // File type tags
      file: {
        patterns: [/\.(js|ts|jsx|tsx|py|java|cpp|c|h|go|rs|rb|php|swift|kt|scala)$/i],
        tag: 'Code'
      },
      config: {
        patterns: [/\.(json|yaml|yml|toml|ini|conf|config|env)$/i, /config\./i, /\.config/i],
        tag: 'Config'
      },
      doc: {
        patterns: [/\.(md|txt|rst|doc|docx|pdf)$/i, /README/i, /LICENSE/i, /CHANGELOG/i],
        tag: 'Doc'
      },
      style: {
        patterns: [/\.(css|scss|sass|less|styl)$/i],
        tag: 'Style'
      },
      test: {
        patterns: [/\.(test|spec)\./i, /__tests__/, /test\//i, /spec\//i],
        tag: 'Test'
      }
    };

    // Change type patterns
    this.changePatterns = {
      new: {
        patterns: [/^0\s*$/, /^\+.*$/],
        tag: 'New',
        check: (details) => {
          const linesAdded = details?.lines_added || details?.added_lines || 0;
          const linesRemoved = details?.lines_removed || details?.deleted_lines || 0;
          const beforeCode = details?.before_code || details?.before_content || '';
          return linesAdded > 0 && linesRemoved === 0 && (!beforeCode || beforeCode.trim() === '');
        }
      },
      edit: {
        patterns: [/^.*\+.*-.*$/],
        tag: 'Edit',
        check: (details) => {
          const linesAdded = details?.lines_added || details?.added_lines || 0;
          const linesRemoved = details?.lines_removed || details?.deleted_lines || 0;
          return linesAdded > 0 && linesRemoved > 0;
        }
      },
      rename: {
        patterns: [/rename/i, /move/i, /mv/i],
        tag: 'Rename',
        check: (details, event) => {
          const changeType = details?.change_type || event?.change_type || '';
          return /rename|move/i.test(changeType);
        }
      },
      delete: {
        patterns: [/^.*-.*$/],
        tag: 'Delete',
        check: (details) => {
          const linesAdded = details?.lines_added || details?.added_lines || 0;
          const linesRemoved = details?.lines_removed || details?.deleted_lines || 0;
          const afterCode = details?.after_code || details?.after_content || '';
          return linesRemoved > 0 && linesAdded === 0 && (!afterCode || afterCode.trim() === '');
        }
      },
      bug: {
        patterns: [/bug/i, /fix/i, /error/i, /exception/i, /crash/i],
        tag: 'Bug',
        check: (details, event) => {
          const message = event?.message || details?.message || '';
          const changeType = details?.change_type || event?.change_type || '';
          return /bug|fix|error|exception|crash/i.test(message + ' ' + changeType);
        }
      },
      refactor: {
        patterns: [/refactor/i, /clean/i, /restructure/i],
        tag: 'Refactor',
        check: (details, event) => {
          const message = event?.message || details?.message || '';
          return /refactor|clean|restructure/i.test(message);
        }
      },
      feature: {
        patterns: [/feature/i, /add/i, /implement/i, /new/i],
        tag: 'Feature',
        check: (details, event) => {
          const message = event?.message || details?.message || '';
          return /feature|add|implement|new/i.test(message);
        }
      }
    };

    // Workspace tag
    this.workspaceTag = 'WS';
  }

  /**
   * Classify an event and return tags
   */
  classifyEvent(event) {
    const tags = [];
    
    try {
      const details = typeof event.details === 'string' 
        ? JSON.parse(event.details) 
        : (event.details || {});
      
      const filePath = details?.file_path || event.file_path || event.path || '';
      const eventType = event.type || details?.type || details?.change_type || '';
      
      // File type classification
      if (filePath) {
        for (const [key, config] of Object.entries(this.tagPatterns)) {
          if (config.patterns.some(pattern => pattern.test(filePath))) {
            tags.push(config.tag);
            break;
          }
        }
      }
      
      // Change type classification
      for (const [key, config] of Object.entries(this.changePatterns)) {
        if (config.check && config.check(details, event)) {
          tags.push(config.tag);
          break; // Only one change type tag
        }
      }
      
      // Workspace tag
      if (event.workspace_path || details?.workspace_path) {
        tags.push(this.workspaceTag);
      }
      
    } catch (error) {
      console.warn('[CLASSIFIER] Error classifying event:', error);
    }
    
    return tags;
  }

  /**
   * Generate a 1-line summary for an event
   */
  generateSummary(event) {
    try {
      const details = typeof event.details === 'string' 
        ? JSON.parse(event.details) 
        : (event.details || {});
      
      const linesAdded = details?.lines_added || details?.added_lines || 0;
      const linesRemoved = details?.lines_removed || details?.deleted_lines || 0;
      const charsAdded = details?.chars_added || 0;
      const charsDeleted = details?.chars_deleted || 0;
      
      // Prefer lines over characters
      if (linesAdded > 0 || linesRemoved > 0) {
        if (linesAdded > 0 && linesRemoved > 0) {
          return `+${linesAdded} / -${linesRemoved} lines`;
        } else if (linesAdded > 0) {
          return `+${linesAdded} lines`;
        } else if (linesRemoved > 0) {
          return `-${linesRemoved} lines`;
        }
      } else if (charsAdded > 0 || charsDeleted > 0) {
        const formatChars = (num) => {
          if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
          return num.toString();
        };
        if (charsAdded > 0 && charsDeleted > 0) {
          return `+${formatChars(charsAdded)} / -${formatChars(charsDeleted)} chars`;
        } else if (charsAdded > 0) {
          return `+${formatChars(charsAdded)} chars`;
        } else if (charsDeleted > 0) {
          return `-${formatChars(charsDeleted)} chars`;
        }
      }
      
      // Fallback to change type
      const changeType = details?.change_type || event?.change_type || '';
      if (changeType) {
        return changeType.charAt(0).toUpperCase() + changeType.slice(1);
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Get file type tag from path
   */
  getFileTypeTag(filePath) {
    if (!filePath) return null;
    
    for (const [key, config] of Object.entries(this.tagPatterns)) {
      if (config.patterns.some(pattern => pattern.test(filePath))) {
        return config.tag;
      }
    }
    
    return 'File';
  }
}

// Create global instance
window.EventClassifier = EventClassifier;
window.eventClassifier = new EventClassifier();

// Export functions for backward compatibility
window.autoTagEvent = (event) => {
  return window.eventClassifier.classifyEvent(event);
};

window.generateEventSummary = (event) => {
  return window.eventClassifier.generateSummary(event);
};

