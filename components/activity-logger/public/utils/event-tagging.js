/**
 * Event Tagging System
 * Automatically tags events based on their content, type, and metadata
 * Provides visual distinction between different event types (file uploads, code changes, etc.)
 */

/**
 * Event tag categories
 */
const EVENT_TAG_CATEGORIES = {
  // Content types
  FILE_UPLOAD: 'file-upload',
  CODE_CHANGE: 'code-change',
  DOCUMENT_UPLOAD: 'document-upload',
  IMAGE_UPLOAD: 'image-upload',
  CONFIG_CHANGE: 'config-change',
  
  // Actions
  CREATED: 'created',
  MODIFIED: 'modified',
  DELETED: 'deleted',
  RENAMED: 'renamed',
  
  // Sources
  AI_GENERATED: 'ai-generated',
  MANUAL: 'manual',
  AUTO_DETECTED: 'auto-detected',
  
  // Context
  REFACTORING: 'refactoring',
  BUG_FIX: 'bug-fix',
  FEATURE_ADD: 'feature-add',
  TEST_UPDATE: 'test-update',
  DOCUMENTATION: 'documentation'
};

/**
 * Tag icons and colors
 */
const TAG_STYLES = {
  [EVENT_TAG_CATEGORIES.FILE_UPLOAD]: { icon: '📄', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  [EVENT_TAG_CATEGORIES.CODE_CHANGE]: { icon: '💻', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
  [EVENT_TAG_CATEGORIES.DOCUMENT_UPLOAD]: { icon: '📑', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  [EVENT_TAG_CATEGORIES.IMAGE_UPLOAD]: { icon: '🖼️', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  [EVENT_TAG_CATEGORIES.CONFIG_CHANGE]: { icon: '⚙️', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  [EVENT_TAG_CATEGORIES.AI_GENERATED]: { icon: '✨', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' },
  [EVENT_TAG_CATEGORIES.MANUAL]: { icon: '✋', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
  [EVENT_TAG_CATEGORIES.REFACTORING]: { icon: '♻️', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
  [EVENT_TAG_CATEGORIES.BUG_FIX]: { icon: '🐛', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  [EVENT_TAG_CATEGORIES.FEATURE_ADD]: { icon: '➕', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  [EVENT_TAG_CATEGORIES.TEST_UPDATE]: { icon: '🧪', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  [EVENT_TAG_CATEGORIES.DOCUMENTATION]: { icon: '📝', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' }
};

/**
 * Detect file type from extension
 */
function getFileType(filePath) {
  if (!filePath) return null;
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'];
  const codeExts = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'rb', 'swift', 'kt'];
  const configExts = ['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config', 'env'];
  
  if (imageExts.includes(ext)) return 'image';
  if (docExts.includes(ext)) return 'document';
  if (codeExts.includes(ext)) return 'code';
  if (configExts.includes(ext)) return 'config';
  
  return 'other';
}

/**
 * Detect if a file is a paper/document (PDF, long text files)
 */
function isDocumentUpload(filePath, content) {
  const fileType = getFileType(filePath);
  if (fileType === 'document') return true;
  
  // Check if it's a PDF by extension
  if (filePath.toLowerCase().endsWith('.pdf')) return true;
  
  // Check if content suggests it's a document (long text, not code)
  if (content && content.length > 1000) {
    // If it's mostly text with few code-like patterns, it's likely a document
    const codePatterns = /[{}();=<>[\]]/g;
    const codeMatches = (content.match(codePatterns) || []).length;
    const codeRatio = codeMatches / content.length;
    
    if (codeRatio < 0.01) return true; // Less than 1% code patterns = document
  }
  
  return false;
}

/**
 * Detect if content is code
 */
function isCodeChange(filePath, beforeCode, afterCode) {
  const fileType = getFileType(filePath);
  if (fileType === 'code') return true;
  
  // Check if there's actual code content
  const code = afterCode || beforeCode || '';
  if (!code) return false;
  
  // Look for code patterns
  const codePatterns = [
    /function\s+\w+\s*\(/,
    /class\s+\w+/,
    /import\s+.*from/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /var\s+\w+\s*=/,
    /def\s+\w+\s*\(/,
    /public\s+\w+/,
    /private\s+\w+/
  ];
  
  return codePatterns.some(pattern => pattern.test(code));
}

/**
 * Detect change type from diff
 */
function detectChangeType(beforeCode, afterCode, filePath) {
  if (!beforeCode && afterCode) return EVENT_TAG_CATEGORIES.CREATED;
  if (beforeCode && !afterCode) return EVENT_TAG_CATEGORIES.DELETED;
  if (beforeCode && afterCode) {
    // Check if it's a rename (content similar, path different)
    if (beforeCode === afterCode) return EVENT_TAG_CATEGORIES.RENAMED;
    return EVENT_TAG_CATEGORIES.MODIFIED;
  }
  return null;
}

/**
 * Detect intent from code changes
 */
function detectCodeIntent(beforeCode, afterCode, filePath) {
  if (!isCodeChange(filePath, beforeCode, afterCode)) return null;
  
  const code = afterCode || beforeCode || '';
  const lowerCode = code.toLowerCase();
  
  // Bug fix patterns
  if (lowerCode.match(/fix|bug|error|issue|wrong|broken|correct/)) {
    return EVENT_TAG_CATEGORIES.BUG_FIX;
  }
  
  // Refactoring patterns
  if (lowerCode.match(/refactor|clean|improve|optimize|restructure/)) {
    return EVENT_TAG_CATEGORIES.REFACTORING;
  }
  
  // Feature addition patterns
  if (lowerCode.match(/add|new|feature|implement|create|introduce/)) {
    return EVENT_TAG_CATEGORIES.FEATURE_ADD;
  }
  
  // Test patterns
  if (filePath.match(/test|spec|\.test\.|\.spec\./i)) {
    return EVENT_TAG_CATEGORIES.TEST_UPDATE;
  }
  
  // Documentation patterns
  if (filePath.match(/readme|doc|\.md$/i) || lowerCode.match(/\/\*\*|#\s/)) {
    return EVENT_TAG_CATEGORIES.DOCUMENTATION;
  }
  
  return null;
}

/**
 * Auto-tag an event based on its properties
 */
function autoTagEvent(event) {
  const tags = [];
  
  // Parse event details
  let details = event.details;
  if (typeof details === 'string') {
    try {
      details = JSON.parse(details);
    } catch (e) {
      details = {};
    }
  }
  
  const filePath = details?.file_path || event.file_path;
  const beforeCode = details?.before_code || details?.before_content;
  const afterCode = details?.after_code || details?.after_content;
  const source = event.source || details?.source;
  
  // Detect file type
  if (filePath) {
    const fileType = getFileType(filePath);
    
    if (fileType === 'image') {
      tags.push(EVENT_TAG_CATEGORIES.IMAGE_UPLOAD);
    } else if (isDocumentUpload(filePath, afterCode || beforeCode)) {
      tags.push(EVENT_TAG_CATEGORIES.DOCUMENT_UPLOAD);
    } else if (fileType === 'config') {
      tags.push(EVENT_TAG_CATEGORIES.CONFIG_CHANGE);
    } else if (isCodeChange(filePath, beforeCode, afterCode)) {
      tags.push(EVENT_TAG_CATEGORIES.CODE_CHANGE);
    } else {
      tags.push(EVENT_TAG_CATEGORIES.FILE_UPLOAD);
    }
  }
  
  // Detect change type
  const changeType = detectChangeType(beforeCode, afterCode, filePath);
  if (changeType) {
    tags.push(changeType);
  }
  
  // Detect code intent
  const intent = detectCodeIntent(beforeCode, afterCode, filePath);
  if (intent) {
    tags.push(intent);
  }
  
  // Detect source
  if (source === 'filewatcher' || source === 'mcp') {
    tags.push(EVENT_TAG_CATEGORIES.AUTO_DETECTED);
  } else if (source === 'clipboard' || source === 'manual') {
    tags.push(EVENT_TAG_CATEGORIES.MANUAL);
  }
  
  // Check if AI-generated (has prompt_id or linked_entry_id)
  if (event.prompt_id || details?.prompt_id || event.linked_entry_id || details?.linked_entry_id) {
    tags.push(EVENT_TAG_CATEGORIES.AI_GENERATED);
  }
  
  return tags;
}

/**
 * Get tag badge HTML
 */
function renderTagBadge(tag, compact = false) {
  const style = TAG_STYLES[tag] || { icon: '🏷️', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' };
  const label = tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  
  if (compact) {
    return `<span class="event-tag" style="background: ${style.bg}; color: ${style.color}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;" title="${label}">${style.icon}</span>`;
  }
  
  return `<span class="event-tag" style="background: ${style.bg}; color: ${style.color}; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;" title="${label}">${style.icon} ${label}</span>`;
}

/**
 * Render multiple tags
 */
function renderTags(tags, compact = false) {
  if (!tags || tags.length === 0) return '';
  return tags.map(tag => renderTagBadge(tag, compact)).join(' ');
}

// Export to window
window.EVENT_TAG_CATEGORIES = EVENT_TAG_CATEGORIES;
window.TAG_STYLES = TAG_STYLES;
window.autoTagEvent = autoTagEvent;
window.renderTagBadge = renderTagBadge;
window.renderTags = renderTags;
window.getFileType = getFileType;
window.isDocumentUpload = isDocumentUpload;
window.isCodeChange = isCodeChange;

