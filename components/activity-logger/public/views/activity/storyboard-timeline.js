/**
 * Storyboard Timeline - Visual narrative of Cursor development history
 * Presents activities as a storyboard with scenes, chapters, and visual flow
 */

/**
 * Render storyboard-style timeline
 * Groups activities into narrative "scenes" and "chapters"
 */
function renderStoryboardTimeline(items) {
  if (!items || items.length === 0) {
    return `
      <div class="storyboard-empty">
        <div class="storyboard-empty-icon">📖</div>
        <h3>No Activity Yet</h3>
        <p>Your development story will appear here as you work in Cursor</p>
      </div>
    `;
  }

  // Group items into narrative chapters (sessions/workflows)
  const chapters = groupIntoChapters(items);
  
  return `
    <div class="storyboard-container">
      <div class="storyboard-header">
        <h2 class="storyboard-title">Development Story</h2>
        <div class="storyboard-stats">
          <div class="stat-item">
            <span class="stat-value">${chapters.length}</span>
            <span class="stat-label">Sessions</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${items.length}</span>
            <span class="stat-label">Activities</span>
          </div>
        </div>
      </div>
      
      <div class="storyboard-timeline">
        ${chapters.map((chapter, chapterIndex) => renderChapter(chapter, chapterIndex, chapters.length)).join('')}
      </div>
    </div>
  `;
}

/**
 * Group timeline items into narrative chapters
 * Chapters represent development sessions or workflows
 */
function groupIntoChapters(items) {
  if (items.length === 0) return [];
  
  // Sort chronologically (oldest first for story flow)
  const sorted = [...items].sort((a, b) => {
    const aTime = a.sortTime || new Date(a.timestamp).getTime();
    const bTime = b.sortTime || new Date(b.timestamp).getTime();
    return aTime - bTime;
  });
  
  const chapters = [];
  let currentChapter = null;
  const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes = new session
  
  sorted.forEach((item, index) => {
    const itemTime = item.sortTime || new Date(item.timestamp).getTime();
    
    // Start new chapter if:
    // 1. First item
    // 2. Gap > 30 minutes from last item
    // 3. Different workspace
    // 4. New conversation starts
    const shouldStartNewChapter = !currentChapter || 
      (itemTime - currentChapter.endTime > SESSION_GAP_MS) ||
      (getWorkspace(item) !== getWorkspace(currentChapter.items[0])) ||
      (item.itemType === 'prompt' && isNewConversation(item, currentChapter.items));
    
    if (shouldStartNewChapter) {
      // Save previous chapter
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      
      // Start new chapter
      currentChapter = {
        id: `chapter-${itemTime}-${Math.random().toString(36).substr(2, 9)}`,
        startTime: itemTime,
        endTime: itemTime,
        items: [item],
        scenes: [],
        workspace: getWorkspace(item),
        conversationId: getConversationId(item)
      };
    } else {
      // Add to current chapter
      currentChapter.items.push(item);
      currentChapter.endTime = Math.max(currentChapter.endTime, itemTime);
    }
  });
  
  // Add final chapter
  if (currentChapter) {
    chapters.push(currentChapter);
  }
  
  // Group each chapter into scenes (related activities)
  chapters.forEach(chapter => {
    chapter.scenes = groupIntoScenes(chapter.items);
  });
  
  return chapters;
}

/**
 * Group chapter items into scenes (related activities)
 * A scene represents a cohesive workflow or task
 */
function groupIntoScenes(items) {
  if (items.length === 0) return [];
  
  const scenes = [];
  let currentScene = null;
  const SCENE_GAP_MS = 5 * 60 * 1000; // 5 minutes = new scene
  
  items.forEach(item => {
    const itemTime = item.sortTime || new Date(item.timestamp).getTime();
    
    // Start new scene if:
    // 1. First item
    // 2. Gap > 5 minutes
    // 3. Different file being worked on
    // 4. New prompt starts a new workflow
    const shouldStartNewScene = !currentScene ||
      (itemTime - currentScene.endTime > SCENE_GAP_MS) ||
      (item.itemType === 'prompt' && isWorkflowStart(item));
    
    if (shouldStartNewScene) {
      if (currentScene) {
        scenes.push(currentScene);
      }
      
      currentScene = {
        id: `scene-${itemTime}-${Math.random().toString(36).substr(2, 9)}`,
        startTime: itemTime,
        endTime: itemTime,
        items: [item],
        type: detectSceneType(item),
        primaryFile: getPrimaryFile(item)
      };
    } else {
      currentScene.items.push(item);
      currentScene.endTime = Math.max(currentScene.endTime, itemTime);
      // Update scene type if needed
      if (item.itemType === 'prompt') {
        currentScene.type = 'ai-interaction';
      }
    }
  });
  
  if (currentScene) {
    scenes.push(currentScene);
  }
  
  return scenes;
}

/**
 * Detect the type of scene based on activities
 */
function detectSceneType(item) {
  if (item.itemType === 'prompt') return 'ai-interaction';
  if (item.itemType === 'terminal') return 'terminal-work';
  if (item.type === 'file_change' || item.type === 'code_change') return 'code-editing';
  return 'activity';
}

/**
 * Check if item starts a new conversation
 */
function isNewConversation(item, previousItems) {
  if (item.itemType !== 'prompt') return false;
  
  // Check if this prompt has a different conversation ID
  const itemConvId = getConversationId(item);
  if (!itemConvId) return false;
  
  // Check if any previous item in chapter has same conversation ID
  const hasSameConversation = previousItems.some(prev => {
    const prevConvId = getConversationId(prev);
    return prevConvId && prevConvId === itemConvId;
  });
  
  return !hasSameConversation;
}

/**
 * Check if prompt starts a new workflow
 */
function isWorkflowStart(item) {
  if (item.itemType !== 'prompt') return false;
  
  // Heuristics: long prompts or prompts with specific keywords might start workflows
  const text = (item.text || item.prompt || '').toLowerCase();
  const workflowKeywords = ['implement', 'create', 'build', 'refactor', 'fix', 'add', 'design'];
  return workflowKeywords.some(keyword => text.includes(keyword));
}

/**
 * Get workspace from item
 */
function getWorkspace(item) {
  return item.workspace_path || item.workspacePath || item.workspace || 
         item.workspaceId || item.workspaceName || 'unknown';
}

/**
 * Get conversation ID from item
 */
function getConversationId(item) {
  return item.conversation_id || item.conversationId || 
         item.conversation?.id || null;
}

/**
 * Get primary file from item
 */
function getPrimaryFile(item) {
  if (item.file_path) return item.file_path;
  if (item.details) {
    try {
      const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
      return details.file_path || details.filePath || null;
    } catch {}
  }
  return null;
}

/**
 * Render a chapter (development session)
 */
function renderChapter(chapter, index, totalChapters) {
  const startDate = new Date(chapter.startTime);
  const endDate = new Date(chapter.endTime);
  const duration = Math.round((chapter.endTime - chapter.startTime) / 1000 / 60); // minutes
  
  const workspaceName = chapter.workspace.split('/').pop() || chapter.workspace;
  const dateStr = startDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  
  return `
    <div class="storyboard-chapter" data-chapter-index="${index}">
      <div class="chapter-header">
        <div class="chapter-number">Session ${index + 1}</div>
        <div class="chapter-info">
          <div class="chapter-title">${workspaceName}</div>
          <div class="chapter-meta">
            <span class="chapter-date">${dateStr}</span>
            <span class="chapter-duration">${duration} min</span>
            <span class="chapter-activities">${chapter.items.length} activities</span>
          </div>
        </div>
        <button class="chapter-toggle" onclick="toggleChapter('${chapter.id}')" data-chapter-id="${chapter.id}">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
      
      <div class="chapter-content" id="chapter-content-${chapter.id}">
        <div class="chapter-scenes">
          ${chapter.scenes.map((scene, sceneIndex) => renderScene(scene, sceneIndex, chapter.scenes.length)).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a scene (cohesive workflow)
 */
function renderScene(scene, index, totalScenes) {
  const sceneDuration = Math.round((scene.endTime - scene.startTime) / 1000 / 60);
  const sceneTypeIcon = getSceneTypeIcon(scene.type);
  const sceneTypeLabel = getSceneTypeLabel(scene.type);
  
  // Get primary activity for scene summary
  const primaryActivity = scene.items[0];
  const sceneTitle = getSceneTitle(scene, primaryActivity);
  
  return `
    <div class="storyboard-scene" data-scene-type="${scene.type}">
      <div class="scene-header">
        <div class="scene-icon">${sceneTypeIcon}</div>
        <div class="scene-info">
          <div class="scene-title">${sceneTitle}</div>
          <div class="scene-meta">
            <span class="scene-type">${sceneTypeLabel}</span>
            <span class="scene-duration">${sceneDuration} min</span>
            <span class="scene-items">${scene.items.length} items</span>
          </div>
        </div>
      </div>
      
      <div class="scene-timeline">
        ${scene.items.map((item, itemIndex) => renderStoryboardItem(item, itemIndex, scene.items.length)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a single storyboard item
 */
function renderStoryboardItem(item, index, totalItems) {
  const itemType = item.itemType || 'event';
  const time = new Date(item.timestamp).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });
  
  // Get visual representation based on type
  const itemConfig = getItemConfig(item, itemType);
  
  return `
    <div class="storyboard-item storyboard-item-${itemType}" data-item-type="${itemType}">
      <div class="item-connector"></div>
      <div class="item-content">
        <div class="item-icon">${itemConfig.icon}</div>
        <div class="item-body">
          <div class="item-title">${itemConfig.title}</div>
          ${itemConfig.description ? `<div class="item-description">${itemConfig.description}</div>` : ''}
          <div class="item-meta">
            <span class="item-time">${time}</span>
            ${itemConfig.badges || ''}
          </div>
        </div>
        <button class="item-expand" onclick="expandStoryboardItem('${item.id || item.timestamp}')">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Get configuration for storyboard item rendering
 */
function getItemConfig(item, itemType) {
  const escape = window.escapeHtml || ((s) => s);
  
  if (itemType === 'prompt') {
    const text = item.text || item.prompt || item.content || '';
    const preview = text.length > 80 ? text.substring(0, 80) + '...' : text;
    return {
      icon: '💬',
      title: 'AI Interaction',
      description: escape(preview),
      badges: `<span class="item-badge badge-ai">AI</span>`
    };
  }
  
  if (itemType === 'terminal') {
    const command = item.command || item.text || '';
    const preview = command.length > 60 ? command.substring(0, 60) + '...' : command;
    const isError = item.exit_code !== 0 && item.exit_code !== null;
    return {
      icon: isError ? '❌' : '💻',
      title: 'Terminal Command',
      description: escape(preview),
      badges: isError ? `<span class="item-badge badge-error">Error</span>` : ''
    };
  }
  
  if (item.type === 'file_change' || item.type === 'code_change') {
    const filePath = item.file_path || (item.details?.file_path) || 'Unknown file';
    const fileName = filePath.split('/').pop() || filePath;
    let stats = '';
    try {
      const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
      const added = details?.lines_added || details?.diff_stats?.lines_added || 0;
      const removed = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
      if (added > 0 || removed > 0) {
        stats = ` (+${added}${removed > 0 ? `/-${removed}` : ''})`;
      }
    } catch {}
    return {
      icon: '📝',
      title: 'Code Change',
      description: escape(fileName) + stats,
      badges: ''
    };
  }
  
  // Default event
  const title = window.getEventTitle ? window.getEventTitle(item) : 'Activity';
  const desc = window.getEventDescription ? window.getEventDescription(item) : '';
  return {
    icon: '⚡',
    title: escape(title),
    description: desc ? escape(desc) : '',
    badges: ''
  };
}

/**
 * Get scene type icon
 */
function getSceneTypeIcon(type) {
  const icons = {
    'ai-interaction': '🤖',
    'code-editing': '✏️',
    'terminal-work': '💻',
    'activity': '⚡'
  };
  return icons[type] || '⚡';
}

/**
 * Get scene type label
 */
function getSceneTypeLabel(type) {
  const labels = {
    'ai-interaction': 'AI Collaboration',
    'code-editing': 'Code Editing',
    'terminal-work': 'Terminal Work',
    'activity': 'Activity'
  };
  return labels[type] || 'Activity';
}

/**
 * Get scene title from activities
 */
function getSceneTitle(scene, primaryActivity) {
  if (primaryActivity.itemType === 'prompt') {
    const text = primaryActivity.text || primaryActivity.prompt || '';
    if (text.length > 0) {
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      return window.escapeHtml ? window.escapeHtml(preview) : preview;
    }
  }
  
  if (primaryActivity.type === 'file_change' || primaryActivity.type === 'code_change') {
    const filePath = primaryActivity.file_path || (primaryActivity.details?.file_path);
    if (filePath) {
      return filePath.split('/').pop() || filePath;
    }
  }
  
  if (primaryActivity.itemType === 'terminal') {
    const command = primaryActivity.command || primaryActivity.text || '';
    if (command) {
      const preview = command.length > 40 ? command.substring(0, 40) + '...' : command;
      return window.escapeHtml ? window.escapeHtml(preview) : preview;
    }
  }
  
  return 'Development Activity';
}

/**
 * Toggle chapter expansion
 */
function toggleChapter(chapterId) {
  const content = document.getElementById(`chapter-content-${chapterId}`);
  const toggle = document.querySelector(`[data-chapter-id="${chapterId}"]`);
  
  if (!content || !toggle) return;
  
  const isExpanded = content.style.display !== 'none';
  content.style.display = isExpanded ? 'none' : 'block';
  
  const icon = toggle.querySelector('svg');
  if (icon) {
    icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
  }
}

/**
 * Expand storyboard item to show details
 */
function expandStoryboardItem(itemId) {
  // Find the item in state
  const events = window.state?.data?.events || [];
  const prompts = window.state?.data?.prompts || [];
  const terminals = window.state?.data?.terminalCommands || [];
  
  const item = [...events, ...prompts, ...terminals].find(i => 
    (i.id && String(i.id) === String(itemId)) ||
    (i.timestamp && String(i.timestamp) === String(itemId))
  );
  
  if (!item) return;
  
  // Use existing modal system to show details
  if (window.modalManager) {
    if (item.itemType === 'prompt') {
      window.modalManager.showPromptModal(item);
    } else if (item.itemType === 'terminal') {
      window.modalManager.showTerminalModal(item);
    } else {
      window.modalManager.showEventModal(item);
    }
  }
}

// Export functions
window.renderStoryboardTimeline = renderStoryboardTimeline;
window.toggleChapter = toggleChapter;
window.expandStoryboardItem = expandStoryboardItem;

