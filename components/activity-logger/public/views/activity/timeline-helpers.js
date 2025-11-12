/**
 * Timeline rendering helper functions
 * All HTML template functions for timeline rendering
 */

/**
 * Group items into temporal threads/sessions based on time proximity
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

/**
 * Render unified timeline with alternating layout (events left, prompts right)
 */
function renderUnifiedTimeline(items) {
  // Build full hierarchy: Workspace → Conversation → Tabs → Prompts
  const hierarchyBuilder = window.ConversationHierarchyBuilder ? 
    new window.ConversationHierarchyBuilder() : null;
  
  const prompts = items.filter(item => item.itemType === 'prompt');
  const events = items.filter(item => item.itemType !== 'prompt');
  
  // Build hierarchy if builder is available
  let hierarchy = null;
  if (hierarchyBuilder && prompts.length > 0) {
    try {
      hierarchy = hierarchyBuilder.buildHierarchy(prompts, events);
    } catch (error) {
      console.warn('[TIMELINE] Failed to build hierarchy, using fallback:', error);
    }
  }
  
  // Group by workspace → conversation → tabs
  const workspaceMap = new Map();
  const standalonePrompts = [];
  const nonPromptItems = events;
  
  if (hierarchy) {
    // Use hierarchy structure
    hierarchy.workspaces.forEach(workspace => {
      workspace.conversations.forEach(conversation => {
        const workspaceId = workspace.id;
        const conversationId = conversation.id;
        
        if (!workspaceMap.has(workspaceId)) {
          workspaceMap.set(workspaceId, {
            id: workspaceId,
            name: workspace.name,
            path: workspace.path,
            conversations: new Map()
          });
        }
        
        const ws = workspaceMap.get(workspaceId);
        if (!ws.conversations.has(conversationId)) {
          ws.conversations.set(conversationId, {
            id: conversationId,
            title: conversation.title,
            workspaceId: workspaceId,
            workspaceName: workspace.name,
            tabs: new Map(),
            rootPrompts: [],
            allPrompts: conversation.allPrompts || [],
            metadata: conversation.metadata,
            timestamp: conversation.metadata?.firstMessage || Date.now()
          });
        }
        
        const conv = ws.conversations.get(conversationId);
        
        // Add tabs
        if (conversation.tabs && conversation.tabs.length > 0) {
          conversation.tabs.forEach(tab => {
            if (!conv.tabs.has(tab.id)) {
              conv.tabs.set(tab.id, {
                id: tab.id,
                title: tab.title,
                prompts: tab.promptIds ? 
                  prompts.filter(p => tab.promptIds.includes(p.id || p.timestamp)) : []
              });
            }
          });
        }
        
        // Add root prompts
        if (conversation.rootPromptIds && conversation.rootPromptIds.length > 0) {
          conv.rootPrompts = prompts.filter(p => 
            conversation.rootPromptIds.includes(p.id || p.timestamp)
          );
        }
      });
    });
  } else {
    // Fallback: Group prompts by conversation for threading
    prompts.forEach(item => {
      // Check if this is a conversation thread or a message
      const isThread = item.type === 'conversation-thread' && !item.parentConversationId;
      const conversationId = isThread ? item.composerId : (item.parentConversationId || item.composerId);
      
      // Only group prompts that are part of conversations
      // Standalone prompts (no conversationId) should be rendered individually
      if (conversationId) {
        const workspaceId = item.workspace_id || item.workspaceId || 
                           item.workspace_path || item.workspacePath || 
                           'unknown';
        
        if (!workspaceMap.has(workspaceId)) {
          workspaceMap.set(workspaceId, {
            id: workspaceId,
            name: item.workspace_name || item.workspaceName || workspaceId.split('/').pop(),
            path: item.workspace_path || item.workspacePath || workspaceId,
            conversations: new Map()
          });
        }
        
        const ws = workspaceMap.get(workspaceId);
        if (!ws.conversations.has(conversationId)) {
          ws.conversations.set(conversationId, {
            id: conversationId,
            title: item.conversationTitle || item.conversation_title || 'Untitled Conversation',
            workspaceId: workspaceId,
            workspaceName: ws.name,
            tabs: new Map(),
            rootPrompts: [],
            allPrompts: [],
            timestamp: item.sortTime
          });
        }
        
        const conv = ws.conversations.get(conversationId);
        conv.allPrompts.push(item);
        
        // Check if this is a tab/thread
        const parentId = item.parent_conversation_id || item.parentConversationId;
        if (parentId && parentId !== conversationId) {
          if (!conv.tabs.has(parentId)) {
            conv.tabs.set(parentId, {
              id: parentId,
              title: `Tab ${parentId.substring(0, 8)}`,
              prompts: []
            });
          }
          conv.tabs.get(parentId).prompts.push(item);
        } else {
          conv.rootPrompts.push(item);
        }
        
        conv.timestamp = Math.max(conv.timestamp || 0, item.sortTime);
      } else {
        // This is a standalone prompt, not part of a conversation
        standalonePrompts.push(item);
      }
    });
  }
  
  // Convert workspace conversations to timeline items
  const conversationItems = [];
  workspaceMap.forEach((workspace, workspaceId) => {
    workspace.conversations.forEach((conversation, conversationId) => {
      // Only include if has prompts
      if (conversation.allPrompts.length > 0 || conversation.rootPrompts.length > 0) {
        // If only 1 root prompt and no tabs, treat as standalone prompt
        if (conversation.rootPrompts.length === 1 && conversation.tabs.size === 0) {
          conversationItems.push({
            ...conversation.rootPrompts[0],
            itemType: 'prompt',
            sortTime: conversation.rootPrompts[0].sortTime || conversation.timestamp,
            workspaceId: workspaceId,
            workspaceName: workspace.name
          });
        } else {
          // Render as conversation with hierarchy
          conversationItems.push({
            itemType: 'conversation',
            conversation: {
              ...conversation,
              workspace: workspace,
              tabs: Array.from(conversation.tabs.values())
            },
            sortTime: conversation.timestamp
          });
        }
      }
    });
  });
  
  // Merge all items (conversations, standalone prompts, and other items)
  const allItems = [...conversationItems, ...standalonePrompts, ...nonPromptItems]
    .sort((a, b) => {
      const aTime = a.sortTime || 0;
      const bTime = b.sortTime || 0;
      return bTime - aTime;
    });
  
  // Analyze conversation flow if analyzer is available
  let conversationAnalytics = {};
  // Build a flat conversation map for the analyzer (backward compatibility)
  const conversationMapForAnalyzer = new Map();
  if (workspaceMap && workspaceMap.size > 0) {
    workspaceMap.forEach((workspace, workspaceId) => {
      if (workspace && workspace.conversations) {
        workspace.conversations.forEach((conversation, conversationId) => {
          if (conversation) {
            conversationMapForAnalyzer.set(conversationId, {
              thread: conversation.rootPrompts?.[0] || null,
              messages: conversation.allPrompts || [],
              timestamp: conversation.timestamp
            });
          }
        });
      }
    });
  }
  
  // Also create an alias for backward compatibility (in case any code references conversationMap)
  const conversationMap = conversationMapForAnalyzer;
  
  if (window.ConversationFlowAnalyzer && conversationMapForAnalyzer.size > 0) {
    try {
      const analyzer = new window.ConversationFlowAnalyzer();
      conversationAnalytics = analyzer.analyzeConversationFlow(conversationMapForAnalyzer);
      // Store analytics for use in rendering
      window._conversationAnalytics = conversationAnalytics;
    } catch (error) {
      console.warn('[TIMELINE] Conversation flow analysis failed:', error);
      window._conversationAnalytics = {};
    }
  } else {
    window._conversationAnalytics = {};
  }
  
  // Apply temporal threading to group items by time windows
  // Use shorter window for conversations to avoid grouping too many together
  const temporalThreads = groupIntoTemporalThreads(allItems, 5 * 60 * 1000); // 5 minute window (reduced from 15)
  
  // Store the sorted timeline items for sequence-based linking
  // This allows render functions to find related items by position in sequence
  window._currentTimelineItems = allItems;
  
  // Check if any items are commit groups (before temporal threading)
  const hasCommitGroups = allItems.some(item => item.itemType === 'commit-group');
  
  // If we have commit groups, handle them specially
  if (hasCommitGroups) {
    return `
      <div class="timeline-alternating">
        <div class="timeline-axis"></div>
        ${allItems.map(item => {
          if (item.itemType === 'commit-group') {
            return window.renderCommitGroup ? window.renderCommitGroup(item, allItems) : '';
          } else if (item.itemType === 'event') {
            return window.renderTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'terminal') {
            return window.renderTerminalTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'conversation') {
            return window.renderConversationThread(item.conversation, 'right');
          } else if (item.itemType === 'prompt') {
            return window.renderPromptTimelineItem(item, 'right', allItems);
          } else if (item.itemType === 'status') {
            return window.renderStatusMessageTimelineItem ? 
              window.renderStatusMessageTimelineItem(item, 'left') : '';
          }
          return '';
        }).join('')}
      </div>
    `;
  }
  
  // Render with two-column layout: events on left, prompts on right
  return `
    <div class="timeline-alternating">
      <div class="timeline-axis"></div>
      ${temporalThreads.map(thread => {
        // If thread has only one item, render it with appropriate side
        if (thread.items.length === 1) {
          const item = thread.items[0];
          if (item.itemType === 'event') {
            return window.renderTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'terminal') {
            return window.renderTerminalTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'conversation') {
            return window.renderConversationThread(item.conversation, 'right');
          } else if (item.itemType === 'prompt') {
            return window.renderPromptTimelineItem(item, 'right', allItems);
          } else if (item.itemType === 'status') {
            return window.renderStatusMessageTimelineItem ? 
              window.renderStatusMessageTimelineItem(item, 'left') : '';
          }
          return '';
        }
        
        // Multiple items: render events on left, prompts on right
        const events = thread.items.filter(i => i.itemType === 'event' || i.itemType === 'terminal' || i.itemType === 'status');
        const prompts = thread.items.filter(i => i.itemType === 'prompt' || i.itemType === 'conversation');
        
        let html = '';
        // Render events on left
        events.forEach(event => {
          if (event.itemType === 'event') {
            html += window.renderTimelineItem(event, 'left', allItems);
          } else if (event.itemType === 'terminal') {
            html += window.renderTerminalTimelineItem(event, 'left', allItems);
          } else if (event.itemType === 'status') {
            html += window.renderStatusMessageTimelineItem ? 
              window.renderStatusMessageTimelineItem(event, 'left') : '';
          }
        });
        // Render prompts on right
        prompts.forEach(prompt => {
          if (prompt.itemType === 'prompt') {
            html += window.renderPromptTimelineItem(prompt, 'right', allItems);
          } else if (prompt.itemType === 'conversation') {
            html += window.renderConversationThread(prompt.conversation, 'right');
          }
        });
        
        return html || window.renderTemporalThread(thread, allItems);
      }).join('')}
    </div>
  `;
}

/**
 * Extract conversation title for summary display
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
    const anyMsg = sorted.find(m => extractText(m).length > 5);
    if (anyMsg) {
      const text = extractText(anyMsg);
      if (text) return smartTitle(text);
    }
  }
  
  // Fallback with context
  const context = [];
  const workspace = thread?.workspaceName || thread?.workspace_path || messages.find(m => m.workspaceName)?.workspaceName;
  if (workspace) context.push(workspace.split('/').pop());
  if (messages.length > 0) context.push(`${messages.length} msg${messages.length !== 1 ? 's' : ''}`);
  return context.length > 0 ? context.join(' • ') : 'Conversation';
}

function renderConversationThread(conversation, side = 'right') {
  // Support both old structure (thread, messages) and new hierarchy structure
  const isHierarchy = conversation.workspace || conversation.tabs || conversation.rootPrompts;
  
  let thread, messages, workspace, tabs, rootPrompts, allPrompts;
  
  if (isHierarchy) {
    // New hierarchy structure
    workspace = conversation.workspace || {};
    tabs = conversation.tabs || [];
    rootPrompts = conversation.rootPrompts || [];
    allPrompts = conversation.allPrompts || [];
    messages = allPrompts;
    thread = rootPrompts[0] || allPrompts[0] || null;
  } else {
    // Old structure (backward compatibility)
    thread = conversation.thread;
    messages = conversation.messages || [];
    workspace = null;
    tabs = [];
    rootPrompts = [];
    allPrompts = messages;
  }
  
  /**
   * Extract meaningful text from a message/prompt object
   */
  function extractText(obj) {
    if (!obj) return '';
    const text = obj.text || obj.prompt || obj.preview || obj.content || '';
    if (!text) return '';
    
    // Remove JSON-like content
    if (text.startsWith('{') || text.startsWith('[')) return '';
    
    // Remove pure JSON delimiters/whitespace
    const cleaned = text.trim();
    if (cleaned.match(/^[\[\]{}",:\s]*$/)) return '';
    
    // Remove very short content (likely metadata)
    if (cleaned.length < 3) return '';
    
    return cleaned;
  }
  
  /**
   * Generate a smart title from text (extract first sentence or meaningful phrase)
   */
  function smartTitle(text, maxLength = 80) {
    if (!text) return '';
    
    // Clean up whitespace
    let cleaned = text.trim().replace(/\s+/g, ' ');
    
    // Try to extract first sentence
    const sentenceMatch = cleaned.match(/^[^.!?]+[.!?]/);
    if (sentenceMatch) {
      cleaned = sentenceMatch[0].trim();
    }
    
    // If still too long, truncate at word boundary
    if (cleaned.length > maxLength) {
      const truncated = cleaned.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.7) {
        cleaned = truncated.substring(0, lastSpace) + '...';
      } else {
        cleaned = truncated + '...';
      }
    }
    
    return cleaned;
  }
  
  /**
   * Extract context from conversation (workspace, files, etc.)
   */
  function extractContext() {
    const context = [];
    
    // Get workspace from thread or messages
    const workspace = thread?.workspaceName || thread?.workspace_path || 
                     messages.find(m => m.workspaceName || m.workspace_path)?.workspaceName ||
                     messages.find(m => m.workspaceName || m.workspace_path)?.workspace_path;
    if (workspace) {
      const workspaceName = typeof workspace === 'string' ? workspace.split('/').pop() : workspace;
      context.push(workspaceName);
    }
    
    // Get file paths from messages
    const filePaths = new Set();
    messages.forEach(m => {
      const filePath = m.file_path || m.context?.file_path;
      if (filePath) {
        const fileName = filePath.split('/').pop();
        if (fileName && !fileName.startsWith('.')) {
          filePaths.add(fileName);
        }
      }
    });
    if (filePaths.size > 0) {
      const files = Array.from(filePaths).slice(0, 2);
      context.push(files.join(', '));
    }
    
    // Get mode/type
    const mode = thread?.mode || messages.find(m => m.mode)?.mode;
    if (mode && mode !== 'chat') {
      context.push(mode);
    }
    
    return context.length > 0 ? context.join(' • ') : null;
  }
  
  // Build a better title from available properties
  let title = null;
  let contextInfo = extractContext();
  
  // Try multiple sources for title - check thread first
  if (thread?.conversationTitle) {
    title = thread.conversationTitle;
  } else if (thread) {
    const threadText = extractText(thread);
    if (threadText) {
      title = smartTitle(threadText);
    }
  }
  
  // If still no good title, check messages - sort by timestamp first
  if (!title && messages.length > 0) {
    // Sort messages by timestamp to get chronological order
    const sortedMessages = [...messages].sort((a, b) => {
      const aTime = a.sortTime || a.timestamp || 0;
      const bTime = b.sortTime || b.timestamp || 0;
      return aTime - bTime;
    });
    
    // Try to find first user message with actual text (check all fields)
    const firstUserMessage = sortedMessages.find(m => {
      const msgText = extractText(m);
      return (m.messageRole === 'user' || !m.messageRole) && msgText.length > 5;
    });
    
    if (firstUserMessage) {
      const msgText = extractText(firstUserMessage);
      if (msgText) {
        title = smartTitle(msgText);
      }
    }
    
    // If still no title, try any message (including assistant)
    if (!title) {
      const anyMessage = sortedMessages.find(m => {
        const msgText = extractText(m);
        return msgText.length > 5;
      });
      if (anyMessage) {
        const msgText = extractText(anyMessage);
        if (msgText) {
          title = smartTitle(msgText);
        }
      }
    }
  }
  
  // If we have a title, use it; otherwise build a descriptive fallback
  if (!title) {
    // Build informative fallback
    const parts = [];
    
    // Add context if available
    if (contextInfo) {
      parts.push(contextInfo);
    }
    
    // Add message count
    if (messages.length > 0) {
      parts.push(`${messages.length} message${messages.length !== 1 ? 's' : ''}`);
    }
    
    // Add composer ID as last resort
    if (thread?.composerId && parts.length === 0) {
      parts.push(`ID: ${thread.composerId.substring(0, 8)}`);
    }
    
    if (parts.length > 0) {
      title = parts.join(' • ');
    } else {
      title = 'Conversation';
    }
  } else if (contextInfo) {
    // Append context to title if we have it
    title = `${title} (${contextInfo})`;
  }
  
  const time = window.formatTimeAgo(thread?.timestamp || conversation.timestamp || conversation.metadata?.firstMessage);
  const messageCount = allPrompts.length || messages.length;
  const threadId = thread?.composerId || thread?.conversationId || conversation.id || `conv-${Date.now()}`;
  
  // Sort messages chronologically
  const sortedMessages = allPrompts.length > 0 
    ? [...allPrompts].sort((a, b) => (a.sortTime || a.timestamp || 0) - (b.sortTime || b.timestamp || 0))
    : [...messages].sort((a, b) => (a.sortTime || a.timestamp || 0) - (b.sortTime || b.timestamp || 0));
  
  // Get conversation analytics if available
  const conversationId = thread?.composerId || thread?.conversationId || conversation.timestamp;
  const analytics = window._conversationAnalytics?.[conversationId] || null;
  
  // Build flow indicators from analytics
  let flowIndicators = '';
  if (analytics) {
    const indicators = [];
    
    // Pattern badge
    if (analytics.turnPattern && analytics.turnPattern !== 'single') {
      const patternLabel = analytics.turnPattern.charAt(0).toUpperCase() + analytics.turnPattern.slice(1);
      const patternClass = window.ConversationFlowAnalyzer ? 
        (new window.ConversationFlowAnalyzer()).getPatternBadgeClass(analytics.turnPattern) : 
        'timeline-badge-muted';
      indicators.push(`<span class="timeline-badge ${patternClass}" title="Turn pattern: ${patternLabel}">${patternLabel}</span>`);
    }
    
    // Conversation type badge
    if (analytics.conversationType && analytics.conversationType !== 'linear') {
      const typeLabel = analytics.conversationType.charAt(0).toUpperCase() + analytics.conversationType.slice(1);
      const typeClass = window.ConversationFlowAnalyzer ? 
        (new window.ConversationFlowAnalyzer()).getTypeBadgeClass(analytics.conversationType) : 
        'timeline-badge-muted';
      indicators.push(`<span class="timeline-badge ${typeClass}" title="Conversation type: ${typeLabel}">${typeLabel}</span>`);
    }
    
    // Health status badge
    if (analytics.health && analytics.health.status) {
      const healthLabel = analytics.health.status.charAt(0).toUpperCase() + analytics.health.status.slice(1);
      const healthClass = window.ConversationFlowAnalyzer ? 
        (new window.ConversationFlowAnalyzer()).getHealthBadgeClass(analytics.health.status) : 
        'timeline-badge-muted';
      indicators.push(`<span class="timeline-badge ${healthClass}" title="Status: ${healthLabel}">${healthLabel}</span>`);
    }
    
    // Depth indicator
    if (analytics.depth > 0) {
      indicators.push(`<span class="timeline-badge timeline-badge-muted" title="Conversation depth: ${analytics.depth} levels">Depth: ${analytics.depth}</span>`);
    }
    
    // Branching indicator
    if (analytics.relationships && analytics.relationships.childCount > 0) {
      indicators.push(`<span class="timeline-badge timeline-badge-accent" title="${analytics.relationships.childCount} child conversation(s)">${analytics.relationships.childCount} branch${analytics.relationships.childCount !== 1 ? 'es' : ''}</span>`);
    }
    
    // Sibling indicator
    if (analytics.relationships && analytics.relationships.siblingCount > 0) {
      indicators.push(`<span class="timeline-badge timeline-badge-muted" title="${analytics.relationships.siblingCount} sibling conversation(s)">${analytics.relationships.siblingCount} sibling${analytics.relationships.siblingCount !== 1 ? 's' : ''}</span>`);
    }
    
    if (indicators.length > 0) {
      flowIndicators = `<div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-xs);">${indicators.join('')}</div>`;
    }
  }
  
  // Build metadata row with flow analytics
  let metadataRow = '';
  if (analytics) {
    const metadataItems = [];
    
    if (analytics.responseTime && analytics.responseTime.averageSeconds) {
      metadataItems.push(`<span class="timeline-metadata-item">Avg response: ${analytics.responseTime.averageSeconds}s</span>`);
    }
    
    if (analytics.messageRatio) {
      metadataItems.push(`<span class="timeline-metadata-item">Ratio: ${analytics.messageRatio}</span>`);
    }
    
    if (analytics.relationships && analytics.relationships.parentConversationId) {
      metadataItems.push(`<span class="timeline-metadata-item" title="Parent conversation">Part of thread</span>`);
    }
    
    if (metadataItems.length > 0) {
      metadataRow = `<div class="timeline-metadata-row">${metadataItems.join('<span class="timeline-metadata-separator">•</span>')}</div>`;
    }
  }
  
  return `
    <div class="timeline-item timeline-item-${side} conversation-timeline-item">
      <div class="timeline-content prompt-content">
        <div class="timeline-header clickable" onclick="toggleConversationMessages('${threadId}')">
          <div class="timeline-title">
            <span id="conv-icon-${threadId}" class="timeline-title-icon" style="transform: rotate(90deg); display: inline-block;">▶</span>
            <span class="timeline-title-text">${window.escapeHtml(title)}</span>
            ${messageCount > 0 ? `<span class="timeline-title-meta">(${messageCount} messages)</span>` : ''}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">Conversation</span>
          ${workspace?.name ? `<span class="badge" style="background: var(--color-success); color: white;" title="Workspace: ${window.escapeHtml(workspace.path || workspace.name)}">📁 ${window.escapeHtml(workspace.name)}</span>` : 
            (thread?.workspaceName ? `<span class="badge">${window.escapeHtml(thread.workspaceName)}</span>` : '')}
          ${thread?.mode ? `<span class="badge" style="background: var(--color-primary); color: white;">${window.escapeHtml(thread.mode)}</span>` : ''}
          ${tabs && tabs.length > 0 ? `<span class="badge" style="background: var(--color-accent); color: white;" title="${tabs.length} tab${tabs.length !== 1 ? 's' : ''} in this conversation">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</span>` : ''}
          ${allPrompts.length > 0 ? (() => {
            // Show file indicators if any messages reference files
            const filePaths = new Set();
            allPrompts.forEach(m => {
              const filePath = m.file_path || m.context?.file_path;
              if (filePath) {
                const fileName = filePath.split('/').pop();
                if (fileName && !fileName.startsWith('.')) filePaths.add(fileName);
              }
            });
            if (filePaths.size > 0) {
              const files = Array.from(filePaths).slice(0, 2);
              return `<span class="badge" style="background: var(--color-accent); color: white;">${window.escapeHtml(files.join(', '))}${filePaths.size > 2 ? '...' : ''}</span>`;
            }
            return '';
          })() : ''}
          ${flowIndicators}
        </div>
        
        <!-- Tabs/Threads (if any) -->
        ${tabs && tabs.length > 0 ? `
          <div class="conversation-tabs" style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-alt, #f5f5f5); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
              Tabs/Threads (${tabs.length})
            </div>
            ${tabs.slice(0, 5).map(tab => {
              const tabPrompts = tab.prompts || [];
              const tabTitle = tab.title || `Tab ${tab.id.substring(0, 8)}`;
              return `
                <div class="conversation-tab-item" style="margin-bottom: var(--space-xs); padding: var(--space-xs); background: var(--color-bg, #ffffff); border-radius: var(--radius-sm); cursor: pointer;"
                     onclick="event.stopPropagation(); toggleTabMessages('${threadId}-tab-${tab.id}')"
                     onmouseover="this.style.background='var(--color-bg-alt, #f5f5f5)'"
                     onmouseout="this.style.background='var(--color-bg, #ffffff)'">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: var(--text-xs); color: var(--color-text);">
                      <span id="tab-icon-${threadId}-tab-${tab.id}" style="display: inline-block; margin-right: 4px; transform: rotate(0deg);">▶</span>
                      ${window.escapeHtml(tabTitle)} 
                      <span style="color: var(--color-text-muted);">(${tabPrompts.length} messages)</span>
                    </span>
                  </div>
                  <div id="tab-messages-${threadId}-tab-${tab.id}" class="tab-messages" style="display: none; margin-top: var(--space-xs); padding-left: var(--space-md);">
                    ${tabPrompts.length > 0 ? tabPrompts
                      .sort((a, b) => (a.sortTime || a.timestamp || 0) - (b.sortTime || b.timestamp || 0))
                      .map(msg => window.renderConversationMessage(msg)).join('') : 
                      '<div style="font-size: var(--text-xs); color: var(--color-text-muted);">No messages in this tab</div>'}
                  </div>
                </div>
              `;
            }).join('')}
            ${tabs.length > 5 ? `<div style="font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic; margin-top: var(--space-xs);">+${tabs.length - 5} more tabs</div>` : ''}
          </div>
        ` : ''}
        
        <!-- Root Prompts (if any, and no tabs) -->
        ${rootPrompts && rootPrompts.length > 0 && (!tabs || tabs.length === 0) ? `
          <div class="conversation-root-prompts" style="margin-top: var(--space-sm);">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
              Root Messages (${rootPrompts.length})
            </div>
            ${rootPrompts
              .sort((a, b) => (a.sortTime || a.timestamp || 0) - (b.sortTime || b.timestamp || 0))
              .map(msg => window.renderConversationMessage(msg)).join('')}
          </div>
        ` : ''}
        
        <!-- Messages (expanded by default, or if no tabs/root prompts) -->
        <div id="conv-messages-${threadId}" class="conversation-messages ${tabs && tabs.length > 0 ? '' : 'visible'}" style="${tabs && tabs.length > 0 ? 'display: none;' : ''}">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => window.renderConversationMessage(msg)).join('') : '<div class="conversation-empty">No messages in this conversation yet</div>'}
        </div>
        ${metadataRow || ''}
      </div>
    </div>
  `;
}

function renderConversationMessage(message) {
  const isUser = message.messageRole === 'user';
  const time = window.formatTimeAgo(message.timestamp);
  const text = message.text || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  return `
    <div class="conversation-message ${isUser ? 'user' : 'ai'}">
      <div class="conversation-message-header">
        <span class="conversation-message-icon"></span>
        <span class="conversation-message-author">${isUser ? 'You' : 'AI Assistant'}</span>
        <span class="conversation-message-time">${time}</span>
        ${message.thinkingTimeSeconds ? `<span class="badge" style="background: var(--color-success); color: white;">Thinking ${message.thinkingTimeSeconds}s</span>` : ''}
      </div>
      <div class="conversation-message-content">${window.escapeHtml(displayText)}</div>
      ${text.length > 300 ? `<button class="conversation-message-read-more" onclick="showEventModal('${message.id}')">Read more</button>` : ''}
    </div>
  `;
}

function toggleConversationMessages(threadId) {
  const messagesDiv = document.getElementById(`conv-messages-${threadId}`);
  const icon = document.getElementById(`conv-icon-${threadId}`);
  
  if (messagesDiv && icon) {
    const isHidden = !messagesDiv.classList.contains('visible') || messagesDiv.style.display === 'none';
    if (isHidden) {
      messagesDiv.classList.add('visible');
      messagesDiv.style.display = 'block';
      icon.style.transform = 'rotate(90deg)';
    } else {
      messagesDiv.classList.remove('visible');
      messagesDiv.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

function toggleTabMessages(tabId) {
  const messagesDiv = document.getElementById(`tab-messages-${tabId}`);
  const icon = document.getElementById(`tab-icon-${tabId}`);
  
  if (messagesDiv && icon) {
    const isHidden = messagesDiv.style.display === 'none' || !messagesDiv.style.display;
    if (isHidden) {
      messagesDiv.style.display = 'block';
      icon.style.transform = 'rotate(90deg)';
    } else {
      messagesDiv.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

// Export for use in onclick handlers
window.toggleTabMessages = toggleTabMessages;

function toggleTemporalThread(threadId) {
  const itemsDiv = document.getElementById(`thread-items-${threadId}`);
  const icon = document.getElementById(`thread-icon-${threadId}`);
  
  if (itemsDiv && icon) {
    const isHidden = itemsDiv.style.display === 'none' || !itemsDiv.classList.contains('visible');
    if (isHidden) {
      itemsDiv.style.display = 'block';
      itemsDiv.classList.add('visible');
      icon.textContent = '▼';
    } else {
      itemsDiv.style.display = 'none';
      itemsDiv.classList.remove('visible');
      icon.textContent = '▶';
    }
  }
}

// Export for use in onclick handlers
window.toggleTemporalThread = toggleTemporalThread;
window.extractConversationTitle = extractConversationTitle;

function renderPromptTimelineItem(prompt, side = 'right', timelineItems = null, relatedEvents = null) {
  // Use sortTime if available (processed timestamp), otherwise fall back to timestamp
  const timestamp = prompt.sortTime && !isNaN(prompt.sortTime) ? prompt.sortTime : 
                    (prompt.timestamp ? new Date(prompt.timestamp).getTime() : Date.now());
  const time = window.formatTimeAgo(timestamp);
  
  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
  const displayText = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
  const isJsonLike = promptText.startsWith('{') || promptText.startsWith('[');
  
  // Skip JSON metadata entries
  if (isJsonLike && promptText.length > 200) {
    return '';
  }
  
  const icon = '';
  const source = prompt.source || 'cursor';
  
  // Find related events using sequence-based linking if timeline items available
  if (!relatedEvents) {
    if (timelineItems && window.findRelatedEventsBySequence) {
      relatedEvents = window.findRelatedEventsBySequence(prompt, timelineItems, 15);
    } else if (window.findRelatedEvents) {
      // Fallback to time-based
      relatedEvents = window.findRelatedEvents(prompt, 15);
    }
  }
  
  // Show related events indicator
  let relatedEventsIndicator = '';
  if (relatedEvents && relatedEvents.length > 0) {
    const topRelated = relatedEvents.slice(0, 3);
    const relevancePercent = Math.round(relatedEvents[0].relevanceScore * 100);
    relatedEventsIndicator = `
      <div class="prompt-related-events" style="margin-top: var(--space-xs); padding-top: var(--space-xs); border-top: 1px dashed var(--color-border);">
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
          <span style="color: var(--color-accent);">Related code changes (${relatedEvents.length})</span>
        </div>
        ${topRelated.map((event, idx) => {
          const eventDetails = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          const fileName = eventDetails?.file_path || event.file_path || 'Unknown';
          const linesAdded = eventDetails?.lines_added || eventDetails?.diff_stats?.lines_added || 0;
          const linesRemoved = eventDetails?.lines_removed || eventDetails?.diff_stats?.lines_removed || 0;
          const eventRelevance = Math.round(event.relevanceScore * 100);
          const timeAgo = event.timeDiffSeconds < 60 ? `${event.timeDiffSeconds}s` : `${Math.floor(event.timeDiffSeconds / 60)}m`;
          return `
            <div style="font-size: var(--text-xs); padding: var(--space-xs); background: rgba(59, 130, 246, 0.05); border-left: 2px solid var(--color-accent); border-radius: var(--radius-sm); margin-bottom: var(--space-xs); cursor: pointer;"
                 onclick="event.stopPropagation(); showEventModal('${event.id}')"
                 title="Click to view code change">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--color-text); font-weight: 500;">${window.escapeHtml(fileName.split('/').pop())}</span>
                <span style="color: var(--color-text-muted);">${eventRelevance}% • ${timeAgo}</span>
              </div>
              ${linesAdded > 0 || linesRemoved > 0 ? `
                <div style="margin-top: 2px; color: var(--color-text-muted);">
                  <span style="color: var(--color-success);">+${linesAdded}</span>
                  ${linesRemoved > 0 ? `<span style="color: var(--color-error);"> / -${linesRemoved}</span>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
        ${relatedEvents.length > 3 ? `
          <div style="text-align: center; font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
            +${relatedEvents.length - 3} more
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Check for explicit linked code change
  let linkedCodeIndicator = '';
  try {
    const linkedEntryId = prompt.linked_entry_id || prompt.linkedEntryId;
    if (linkedEntryId && window.state?.data?.events) {
      const linkedEntry = window.state.data.events.find(e => e.id === linkedEntryId || e.id === parseInt(linkedEntryId));
      if (linkedEntry) {
        const details = typeof linkedEntry.details === 'string' ? JSON.parse(linkedEntry.details) : linkedEntry.details;
        const hasDiff = details?.before_content || details?.after_content || details?.before_code || details?.after_code;
        if (hasDiff) {
          const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
          const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
          linkedCodeIndicator = `
            <span class="badge" style="background: var(--color-success); color: white; cursor: pointer;" 
                  title="View linked code change (${linesAdded > 0 ? '+' + linesAdded : ''}${linesAdded > 0 && linesRemoved > 0 ? '/' : ''}${linesRemoved > 0 ? '-' + linesRemoved : ''} lines)"
                  onclick="event.stopPropagation(); showEventModal('${linkedEntryId}')">
              Code
            </span>
          `;
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Add context change indicator if available
  let contextChangeIndicator = '';
  if (prompt.contextChange && window.renderContextChangeIndicator) {
    contextChangeIndicator = window.renderContextChangeIndicator(prompt.contextChange, true);
  } else if (prompt.contextChange) {
    // Fallback if function not loaded yet
    const change = prompt.contextChange;
    if (change.addedFiles?.length > 0 || change.removedFiles?.length > 0) {
      const netChange = change.netChange || 0;
      const changeText = netChange > 0 ? `+${netChange}` : netChange < 0 ? `${netChange}` : '±0';
      contextChangeIndicator = `<span class="context-change-badge" title="${change.addedFiles.length} added, ${change.removedFiles.length} removed">${changeText}</span>`;
    }
  }
  
  // Add context file count if available
  let contextFileCountBadge = '';
  if (prompt.contextAnalysis?.fileCount) {
    contextFileCountBadge = `<span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--color-primary);">${prompt.contextAnalysis.fileCount} files</span>`;
  } else if (prompt.contextChange?.currentFileCount) {
    contextFileCountBadge = `<span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--color-primary);">${prompt.contextChange.currentFileCount} files</span>`;
  }
  
  return `
    <div class="timeline-item timeline-item-${side} prompt-timeline-item" onclick="showEventModal('${prompt.id}')">
      <div class="timeline-content prompt-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span>${icon}</span>
            <span>${window.escapeHtml(displayText)}</span>
            ${contextChangeIndicator}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <span class="badge badge-prompt">${window.escapeHtml(source)}</span>
          ${prompt.workspaceName ? `<span class="badge">${window.escapeHtml(prompt.workspaceName)}</span>` : prompt.workspaceId ? `<span class="badge">${window.escapeHtml(prompt.workspaceId.substring(0, 8))}</span>` : ''}
          ${prompt.composerId ? `<span class="badge">Composer</span>` : ''}
          ${prompt.contextUsage > 0 ? `<span class="badge" style="background: var(--color-warning); color: white;">${prompt.contextUsage.toFixed(1)}% context</span>` : ''}
          ${contextFileCountBadge}
          ${linkedCodeIndicator}
        </div>
        ${relatedEventsIndicator}
      </div>
    </div>
  `;
}

/**
 * Render a temporal thread/session containing multiple events within a time window
 */
function renderTemporalThread(thread, timelineItems = null) {
  // Recalculate start/end times from actual items to ensure accuracy
  const itemTimes = thread.items
    .map(item => item.sortTime || (item.timestamp ? new Date(item.timestamp).getTime() : null))
    .filter(time => time !== null && !isNaN(time) && isFinite(time));
  
  const actualStartTime = itemTimes.length > 0 ? Math.min(...itemTimes) : 
    (thread.startTime && !isNaN(thread.startTime) ? thread.startTime : Date.now());
  const actualEndTime = itemTimes.length > 0 ? Math.max(...itemTimes) : 
    (thread.endTime && !isNaN(thread.endTime) ? thread.endTime : actualStartTime);
  
  const duration = actualEndTime - actualStartTime;
  
  // Format duration: show seconds if < 1 minute, otherwise show minutes
  let durationText = '';
  if (duration > 0) {
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) {
      durationText = `${seconds}s`;
    } else {
      const remainingSeconds = seconds % 60;
      if (remainingSeconds > 0 && minutes < 10) {
        // Show seconds if less than 10 minutes for precision
        durationText = `${minutes}m ${remainingSeconds}s`;
      } else {
        durationText = `${minutes} min`;
      }
    }
  } else {
    durationText = '<1s';
  }
  
  const startDate = new Date(actualStartTime);
  const endDate = new Date(actualEndTime);
  
  // Always show time range if times are different, otherwise show single time
  const timeRange = duration > 0
    ? `${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}`
    : startDate.toLocaleTimeString();
  
  const threadId = thread.id;
  
  // Count items by type and collect metadata
  const eventCounts = {
    events: 0,
    prompts: 0,
    terminals: 0,
    conversations: 0
  };
  
  // Track metadata for session summary
  const sessionMetadata = {
    filesChanged: new Set(),
    workspaces: new Set(),
    modelsUsed: new Set(),
    totalLinesAdded: 0,
    totalLinesRemoved: 0,
    totalCharsAdded: 0,
    linkedPairs: 0
  };
  
  thread.items.forEach(item => {
    if (item.itemType === 'event') {
      eventCounts.events++;
      // Extract file and diff info from events
      try {
        const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
        if (details?.file_path) {
          sessionMetadata.filesChanged.add(details.file_path);
        }
        if (item.file_path) {
          sessionMetadata.filesChanged.add(item.file_path);
        }
        if (item.workspace_path) {
          sessionMetadata.workspaces.add(item.workspace_path);
        }
        if (item.modelInfo) {
          const modelInfo = typeof item.modelInfo === 'string' ? JSON.parse(item.modelInfo) : item.modelInfo;
          const modelName = modelInfo?.model_name || modelInfo?.modelName;
          const modelType = modelInfo?.model_type || modelInfo?.modelType;
          if (modelName || modelType) {
            sessionMetadata.modelsUsed.add(modelType && modelName ? `${modelType}/${modelName}` : (modelName || modelType || 'Unknown'));
          }
        }
        // Track diff stats
        const diffStats = details?.diff_stats;
        if (diffStats) {
          sessionMetadata.totalLinesAdded += diffStats.lines_added || 0;
          sessionMetadata.totalLinesRemoved += diffStats.lines_removed || 0;
          sessionMetadata.totalCharsAdded += diffStats.chars_added || 0;
        } else {
          // Fallback to old format
          sessionMetadata.totalLinesAdded += details?.lines_added || 0;
          sessionMetadata.totalLinesRemoved += details?.lines_removed || 0;
          sessionMetadata.totalCharsAdded += details?.chars_added || 0;
        }
        // Track linked prompts
        if (item.prompt_id) {
          sessionMetadata.linkedPairs++;
        }
      } catch (e) {
        // Ignore parse errors
      }
    } else if (item.itemType === 'prompt') {
      eventCounts.prompts++;
      // Extract model and workspace info from prompts
      if (item.workspace_path) {
        sessionMetadata.workspaces.add(item.workspace_path);
      }
      if (item.model_name || item.modelName || item.model_type || item.modelType) {
        const modelName = item.model_name || item.modelName;
        const modelType = item.model_type || item.modelType;
        sessionMetadata.modelsUsed.add(modelType && modelName ? `${modelType}/${modelName}` : (modelName || modelType || 'Unknown'));
      }
      // Track linked code changes
      if (item.linked_entry_id || item.linkedEntryId) {
        sessionMetadata.linkedPairs++;
      }
    } else if (item.itemType === 'terminal') {
      eventCounts.terminals++;
      if (item.workspace) {
        sessionMetadata.workspaces.add(item.workspace);
      }
    } else if (item.itemType === 'conversation') {
      eventCounts.conversations++;
      // Extract metadata from conversation items
      if (item.conversation?.thread?.workspace_path) {
        sessionMetadata.workspaces.add(item.conversation.thread.workspace_path);
      }
      if (item.conversation?.messages) {
        item.conversation.messages.forEach(msg => {
          if (msg.workspace_path) {
            sessionMetadata.workspaces.add(msg.workspace_path);
          }
          if (msg.model_name || msg.modelName || msg.model_type || msg.modelType) {
            const modelName = msg.model_name || msg.modelName;
            const modelType = msg.model_type || msg.modelType;
            sessionMetadata.modelsUsed.add(modelType && modelName ? `${modelType}/${modelName}` : (modelName || modelType || 'Unknown'));
          }
        });
      }
    }
  });
  
  const totalItems = thread.items.length;
  
  // Build enhanced summary with metadata
  const summaryParts = [
    eventCounts.events > 0 ? `${eventCounts.events} file change${eventCounts.events !== 1 ? 's' : ''}` : '',
    eventCounts.prompts > 0 ? `${eventCounts.prompts} prompt${eventCounts.prompts !== 1 ? 's' : ''}` : '',
    eventCounts.terminals > 0 ? `${eventCounts.terminals} terminal command${eventCounts.terminals !== 1 ? 's' : ''}` : '',
    eventCounts.conversations > 0 ? `${eventCounts.conversations} conversation${eventCounts.conversations !== 1 ? 's' : ''}` : ''
  ].filter(Boolean);
  
  // Collect unique workspaces for this session
  const uniqueWorkspaces = Array.from(sessionMetadata.workspaces);
  
  // Add metadata badges if available
  const metadataBadges = [];
  
  // Add workspace badges (color-coded)
  if (uniqueWorkspaces.length > 0) {
    uniqueWorkspaces.forEach(workspacePath => {
      if (window.createWorkspaceBadge) {
        metadataBadges.push(window.createWorkspaceBadge(workspacePath, 'sm'));
      } else {
        const workspaceName = window.getWorkspaceName ? window.getWorkspaceName(workspacePath) : workspacePath.split('/').pop();
        metadataBadges.push(`<span class="badge" style="background: var(--color-primary); color: white;" title="${workspacePath}">${workspaceName}</span>`);
      }
    });
  }
  
  if (sessionMetadata.filesChanged.size > 0) {
    metadataBadges.push(`<span class="badge" style="background: var(--color-primary); color: white;" title="${Array.from(sessionMetadata.filesChanged).join(', ')}">${sessionMetadata.filesChanged.size} file${sessionMetadata.filesChanged.size !== 1 ? 's' : ''}</span>`);
  }
  if (sessionMetadata.modelsUsed.size > 0) {
    metadataBadges.push(`<span class="badge" style="background: var(--color-accent); color: white;" title="${Array.from(sessionMetadata.modelsUsed).join(', ')}">${sessionMetadata.modelsUsed.size} model${sessionMetadata.modelsUsed.size !== 1 ? 's' : ''}</span>`);
  }
  if (sessionMetadata.totalLinesAdded > 0 || sessionMetadata.totalLinesRemoved > 0) {
    metadataBadges.push(`<span class="badge" style="background: var(--color-success); color: white;">+${sessionMetadata.totalLinesAdded}${sessionMetadata.totalLinesRemoved > 0 ? `/-${sessionMetadata.totalLinesRemoved}` : ''} lines</span>`);
  }
  if (sessionMetadata.linkedPairs > 0) {
    metadataBadges.push(`<span class="badge" style="background: var(--color-warning); color: white;" title="Prompts linked to code changes">${sessionMetadata.linkedPairs} linked</span>`);
  }
  
  const summary = summaryParts.join(', ');
  
  // For sessions with many conversations, show a compact summary view
  const conversationCount = eventCounts.conversations;
  const isManyConversations = conversationCount > 10;
  
  // Build conversation summary for large sessions
  let conversationSummary = '';
  if (isManyConversations) {
    const conversations = thread.items.filter(i => i.itemType === 'conversation');
    const conversationTitles = new Map();
    
    conversations.forEach(conv => {
      const title = window.extractConversationTitle ? window.extractConversationTitle(conv.conversation) : 'Conversation';
      const count = conversationTitles.get(title) || 0;
      conversationTitles.set(title, count + 1);
    });
    
    // Show top 5 most common titles
    const topTitles = Array.from(conversationTitles.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => `${title}${count > 1 ? ` (×${count})` : ''}`);
    
    conversationSummary = `
      <div style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg); border-radius: var(--radius-sm); border-left: 3px solid var(--color-primary);">
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs); font-weight: 500;">
          ${conversationCount} conversations:
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs);">
          ${topTitles.map(title => `<span style="font-size: var(--text-xs); color: var(--color-text); padding: 2px 6px; background: rgba(59, 130, 246, 0.1); border-radius: 4px;" title="${window.escapeHtml ? window.escapeHtml(title) : title}">${window.escapeHtml ? window.escapeHtml(title) : title}</span>`).join('')}
          ${conversationTitles.size > 5 ? `<span style="font-size: var(--text-xs); color: var(--color-text-muted);">+${conversationTitles.size - 5} more</span>` : ''}
        </div>
      </div>
    `;
  }
  
  // Sort items within thread chronologically (oldest first within the thread)
  const sortedItems = [...thread.items].sort((a, b) => a.sortTime - b.sortTime);
  
  // Build workspace display - show primary workspace prominently
  let workspaceDisplay = '';
  if (uniqueWorkspaces.length > 0) {
    const primaryWorkspace = uniqueWorkspaces[0];
    const workspaceName = window.getWorkspaceName ? window.getWorkspaceName(primaryWorkspace) : primaryWorkspace.split('/').pop();
    const workspaceColor = window.getWorkspaceColor ? window.getWorkspaceColor(primaryWorkspace) : 'var(--color-primary)';
    
    workspaceDisplay = `
      <div style="display: flex; align-items: center; gap: var(--space-xs); margin-bottom: var(--space-xs);">
        ${window.createWorkspaceBadge ? window.createWorkspaceBadge(primaryWorkspace, 'md') : `
          <span class="badge" style="background: ${workspaceColor}; color: white; font-weight: 500;" title="${primaryWorkspace}">
            ${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}
          </span>
        `}
        ${uniqueWorkspaces.length > 1 ? `
          <span class="badge" style="background: var(--color-bg-alt); color: var(--color-text-muted);" title="${uniqueWorkspaces.slice(1).map(w => window.getWorkspaceName ? window.getWorkspaceName(w) : w.split('/').pop()).join(', ')}">
            +${uniqueWorkspaces.length - 1} more workspace${uniqueWorkspaces.length - 1 !== 1 ? 's' : ''}
          </span>
        ` : ''}
      </div>
    `;
  }
  
  // Build file summary - show unique files changed
  let fileSummary = '';
  if (sessionMetadata.filesChanged.size > 0) {
    const fileList = Array.from(sessionMetadata.filesChanged);
    const fileNames = fileList.map(f => f.split('/').pop()).filter(Boolean);
    const uniqueFileNames = [...new Set(fileNames)];
    
    if (uniqueFileNames.length <= 5) {
      fileSummary = `
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
          Files: ${uniqueFileNames.map(name => `<span style="color: var(--color-text);">${window.escapeHtml ? window.escapeHtml(name) : name}</span>`).join(', ')}
        </div>
      `;
    } else {
      fileSummary = `
        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
          Files: ${uniqueFileNames.slice(0, 3).map(name => `<span style="color: var(--color-text);">${window.escapeHtml ? window.escapeHtml(name) : name}</span>`).join(', ')} 
          <span style="color: var(--color-text-muted);">+${uniqueFileNames.length - 3} more</span>
        </div>
      `;
    }
  }
  
  return `
    <div class="timeline-item temporal-thread-item">
      <div class="timeline-content">
        <div class="timeline-header clickable" onclick="toggleTemporalThread('${threadId}')">
          <div class="timeline-title">
            <span id="thread-icon-${threadId}" class="timeline-title-icon">▼</span>
            <span class="timeline-title-text">Activity Session</span>
            <span class="timeline-title-meta">${totalItems} items • ${durationText}</span>
          </div>
          <div class="timeline-meta">${window.formatTimeAgo(actualStartTime)}</div>
        </div>
        <div class="timeline-description">
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm); align-items: center; margin-bottom: var(--space-sm);">
            ${workspaceDisplay}
            <span style="font-size: var(--text-sm); color: var(--color-text-muted);">${timeRange}</span>
            ${sessionMetadata.filesChanged.size > 0 ? `
              <span style="font-size: var(--text-sm); color: var(--color-text-muted);">
                ${sessionMetadata.filesChanged.size} file${sessionMetadata.filesChanged.size !== 1 ? 's' : ''}
              </span>
            ` : ''}
          </div>
          ${fileSummary}
        </div>
        
        <!-- Thread items (expanded by default) -->
        <div id="thread-items-${threadId}" class="temporal-thread-items visible" style="display: block;">
          ${sortedItems.map((item, index) => {
            // Add relationship indicators between items
            let relationshipIndicator = '';
            if (index > 0) {
              const prevItem = sortedItems[index - 1];
              // Check if this item is linked to previous item
              if (item.itemType === 'event' && item.prompt_id) {
                const linkedPrompt = sortedItems.find(i => i.itemType === 'prompt' && (i.id === item.prompt_id || i.id === parseInt(item.prompt_id)));
                if (linkedPrompt && Math.abs(item.sortTime - linkedPrompt.sortTime) < 300000) { // 5 min
                  // Calculate color based on file additions/deletions
                  let bgColor = 'rgba(59, 130, 246, 0.1)'; // Default blue
                  let borderColor = 'var(--color-primary)'; // Default blue
                  
                  try {
                    const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
                    const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
                    const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
                    const total = linesAdded + linesRemoved;
                    
                    if (total > 0) {
                      const addRatio = linesAdded / total;
                      const removeRatio = linesRemoved / total;
                      
                      // Warmer colors (orange/red) for more additions, cooler (blue/cyan) for more deletions
                      if (addRatio > 0.6) {
                        // Mostly additions - warm orange
                        bgColor = 'rgba(251, 146, 60, 0.1)';
                        borderColor = '#fb923c'; // orange-400
                      } else if (removeRatio > 0.6) {
                        // Mostly deletions - cool cyan
                        bgColor = 'rgba(34, 211, 238, 0.1)';
                        borderColor = '#22d3ee'; // cyan-400
                      } else if (addRatio > removeRatio) {
                        // More additions - warm yellow-orange
                        bgColor = 'rgba(251, 191, 36, 0.1)';
                        borderColor = '#fbbf24'; // amber-400
                      } else if (removeRatio > addRatio) {
                        // More deletions - cool blue
                        bgColor = 'rgba(96, 165, 250, 0.1)';
                        borderColor = '#60a5fa'; // blue-400
                      }
                      // Balanced changes keep default blue
                    }
                  } catch (e) {
                    // Keep default colors if parsing fails
                  }
                  
                  relationshipIndicator = `<div class="timeline-relationship-indicator" style="padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-xs); background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
                    <span style="color: ${borderColor};"></span> Linked to prompt above (${Math.round(Math.abs(item.sortTime - linkedPrompt.sortTime) / 1000)}s gap)
                  </div>`;
                }
              } else if (item.itemType === 'prompt' && (item.linked_entry_id || item.linkedEntryId)) {
                const linkedEntry = sortedItems.find(i => i.itemType === 'event' && (i.id === item.linked_entry_id || i.id === item.linkedEntryId || i.id === parseInt(item.linked_entry_id || item.linkedEntryId)));
                if (linkedEntry && Math.abs(item.sortTime - linkedEntry.sortTime) < 300000) {
                  // Calculate color based on file additions/deletions
                  let bgColor = 'rgba(34, 197, 94, 0.1)'; // Default green
                  let borderColor = 'var(--color-success)'; // Default green
                  
                  try {
                    const details = typeof linkedEntry.details === 'string' ? JSON.parse(linkedEntry.details) : linkedEntry.details;
                    const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
                    const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
                    const total = linesAdded + linesRemoved;
                    
                    if (total > 0) {
                      const addRatio = linesAdded / total;
                      const removeRatio = linesRemoved / total;
                      
                      // Warmer colors (orange/red) for more additions, cooler (blue/cyan) for more deletions
                      if (addRatio > 0.6) {
                        // Mostly additions - warm orange
                        bgColor = 'rgba(251, 146, 60, 0.1)';
                        borderColor = '#fb923c'; // orange-400
                      } else if (removeRatio > 0.6) {
                        // Mostly deletions - cool cyan
                        bgColor = 'rgba(34, 211, 238, 0.1)';
                        borderColor = '#22d3ee'; // cyan-400
                      } else if (addRatio > removeRatio) {
                        // More additions - warm yellow-orange
                        bgColor = 'rgba(251, 191, 36, 0.1)';
                        borderColor = '#fbbf24'; // amber-400
                      } else if (removeRatio > addRatio) {
                        // More deletions - cool blue
                        bgColor = 'rgba(96, 165, 250, 0.1)';
                        borderColor = '#60a5fa'; // blue-400
                      }
                      // Balanced changes keep default green
                    }
                  } catch (e) {
                    // Keep default colors if parsing fails
                  }
                  
                  relationshipIndicator = `<div class="timeline-relationship-indicator" style="padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-xs); background: ${bgColor}; border-left: 3px solid ${borderColor}; border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
                    <span style="color: ${borderColor};">[Code]</span> Generated code change below (${Math.round(Math.abs(item.sortTime - linkedEntry.sortTime) / 1000)}s gap)
                  </div>`;
                }
              }
            }
            
            let itemHtml = '';
            if (item.itemType === 'event') {
              itemHtml = window.renderTimelineItem(item, 'left', timelineItems);
          } else if (item.itemType === 'terminal') {
            itemHtml = window.renderTerminalTimelineItem(item, 'left', timelineItems);
            } else if (item.itemType === 'conversation') {
              itemHtml = window.renderConversationThread(item.conversation, 'right');
            } else if (item.itemType === 'prompt') {
              itemHtml = window.renderPromptTimelineItem(item, 'right', timelineItems);
            }
            
            return relationshipIndicator + itemHtml;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleTemporalThread(threadId) {
  const itemsDiv = document.getElementById(`thread-items-${threadId}`);
  const icon = document.getElementById(`thread-icon-${threadId}`);
  
  if (itemsDiv && icon) {
    const isHidden = !itemsDiv.classList.contains('visible');
    if (isHidden) {
      itemsDiv.classList.add('visible');
      icon.textContent = '▼';
    } else {
      itemsDiv.classList.remove('visible');
      icon.textContent = '▶';
    }
  }
}

function renderTerminalTimelineItem(cmd, side = 'left', timelineItems = null) {
  const timestamp = cmd.sortTime && !isNaN(cmd.sortTime) ? cmd.sortTime : 
                    (cmd.timestamp ? new Date(cmd.timestamp).getTime() : Date.now());
  const time = window.formatTimeAgo(timestamp);
  const commandText = cmd.command || 'Unknown command';
  const displayText = commandText.length > 100 ? commandText.substring(0, 100) + '...' : commandText;
  const isError = (cmd.exit_code !== null && cmd.exit_code !== undefined && cmd.exit_code !== 0);
  const icon = isError ? '[Error]' : '[Code]';
  const source = cmd.source || 'terminal';
  
  // Get workspace badge if available
  let workspaceBadge = '';
  if (cmd.workspace && window.createWorkspaceBadge) {
    workspaceBadge = window.createWorkspaceBadge(cmd.workspace, 'sm');
  }
  
  // Get source badge with color coding
  const sourceColors = {
    'history': '#6366f1',      // Indigo
    'process': '#8b5cf6',      // Purple
    'applescript': '#ec4899',  // Pink
    'terminal': '#10b981',     // Green
    'cursor': '#f59e0b'        // Orange
  };
  const sourceColor = sourceColors[source.toLowerCase()] || '#6366f1';
  
  // Format duration
  let durationBadge = '';
  if (cmd.duration) {
    const duration = cmd.duration;
    const durationText = duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`;
    durationBadge = `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: var(--color-info);">[Duration] ${durationText}</span>`;
  }
  
  // Exit code badge
  let exitCodeBadge = '';
  if (cmd.exit_code !== null && cmd.exit_code !== undefined) {
    exitCodeBadge = `<span class="badge" style="background: ${isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${isError ? 'var(--color-error)' : 'var(--color-success)'};">
      ${isError ? '[Error]' : '[OK]'} Exit ${cmd.exit_code}
    </span>`;
  }
  
  return `
    <div class="timeline-item timeline-item-${side} terminal-timeline-item ${isError ? 'terminal-error' : ''}" onclick="showTerminalModal('${cmd.id}')">
      <div class="timeline-content terminal-content">
        <div class="timeline-header">
          <div class="timeline-title">
            <span style="margin-right: var(--space-xs);">${icon}</span>
            <code class="terminal-command-code" style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px;">${window.escapeHtml(displayText)}</code>
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          <div style="display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap;">
            <span class="badge" style="background: ${sourceColor}20; color: ${sourceColor}; border: 1px solid ${sourceColor}40;">
              ${window.escapeHtml(source)}
            </span>
            ${cmd.shell ? `<span class="badge" style="background: rgba(139, 92, 246, 0.2); color: var(--color-primary);">${window.escapeHtml(cmd.shell)}</span>` : ''}
            ${workspaceBadge}
            ${exitCodeBadge}
            ${durationBadge}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderTimelineItem(event, side = 'left', timelineItems = null) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const title = window.getEventTitle(event);
  let desc = window.getEventDescription(event);
  
  // Get enhanced file information with workspace and directory
  const fileInfo = window.getEnhancedFileInfo ? window.getEnhancedFileInfo(event) : {
    fileName: title,
    workspacePath: event.workspace_path || '',
    badges: '',
    displayTitle: title
  };
  
  // Don't show description if it's just "Code modified" or similar generic text
  // and we already have a meaningful title
  if (desc && (desc === 'Code modified' || desc === 'File modification detected' || desc === title)) {
    desc = ''; // Hide redundant description
  }
  
  // Auto-tag the event
  let eventTags = [];
  if (window.autoTagEvent) {
    eventTags = window.autoTagEvent(event);
  }
  
  // Only render tags if we have actual tags (not empty)
  let tagsHtml = '';
  if (eventTags && eventTags.length > 0 && window.renderTags) {
    tagsHtml = window.renderTags(eventTags, true, event);
  } else if (event.workspace_path && window.renderWorkspaceBadge) {
    // If no tags but has workspace, show workspace badge
    tagsHtml = window.renderWorkspaceBadge(event.workspace_path, true);
  }
  
  // Find related prompts using improved algorithm
  let relatedPrompts = null;
  let relatedPromptsIndicator = '';
  let linkedPromptIndicator = '';
  let contextIndicators = '';
  let diffStats = '';
  
  try {
    // Check for explicit linked prompt (entry.prompt_id)
    if (event.prompt_id && window.state.data.prompts) {
      const linkedPrompt = window.state.data.prompts.find(p => 
        p.id === event.prompt_id || p.id === parseInt(event.prompt_id)
      );
      if (linkedPrompt) {
        const promptText = linkedPrompt.text || linkedPrompt.prompt || '';
        const shortPrompt = promptText.length > 50 ? promptText.substring(0, 50) + '...' : promptText;
        linkedPromptIndicator = `
          <span class="context-indicator ai" 
                style="cursor: pointer;" 
                title="From prompt: ${window.escapeHtml(shortPrompt)}"
                onclick="event.stopPropagation(); showEventModal('${linkedPrompt.id}')">
            Linked Prompt
          </span>
        `;
      }
    }
    
    // Find related prompts using sequence-based linking if timeline items available
    if ((event.type === 'file_change' || event.type === 'code_change')) {
      if (timelineItems && window.findRelatedPromptsBySequence) {
        relatedPrompts = window.findRelatedPromptsBySequence(event, timelineItems, { before: 20, after: 5 });
      } else if (window.findRelatedPrompts) {
        // Fallback to time-based
        relatedPrompts = window.findRelatedPrompts(event, 15);
      }
      
      if (relatedPrompts && relatedPrompts.length > 0) {
        const topRelated = relatedPrompts.slice(0, 3);
        const topRelevance = Math.round(relatedPrompts[0].relevanceScore * 100);
        relatedPromptsIndicator = `
          <div class="event-related-prompts" style="margin-top: var(--space-xs); padding-top: var(--space-xs); border-top: 1px dashed var(--color-border);">
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-xs);">
              <span style="color: var(--color-accent);">↑</span> Related prompts (${relatedPrompts.length})
            </div>
            ${topRelated.map((prompt, idx) => {
              const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || '';
              const displayText = promptText.length > 60 ? promptText.substring(0, 60) + '...' : promptText;
              const promptRelevance = Math.round(prompt.relevanceScore * 100);
              const timeAgo = prompt.timeDiffSeconds < 60 ? `${prompt.timeDiffSeconds}s` : `${Math.floor(prompt.timeDiffSeconds / 60)}m`;
              const direction = prompt.isBeforeInSequence !== undefined ? 
                (prompt.isBeforeInSequence ? 'before (seq)' : 'after (seq)') :
                (prompt.isBefore ? 'before' : 'after');
              return `
                <div style="font-size: var(--text-xs); padding: var(--space-xs); background: rgba(168, 85, 247, 0.05); border-left: 2px solid var(--color-primary); border-radius: var(--radius-sm); margin-bottom: var(--space-xs); cursor: pointer;"
                     onclick="event.stopPropagation(); showEventModal('${prompt.id}')"
                     title="Click to view prompt">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: var(--color-text);">${window.escapeHtml(displayText)}</span>
                    <span style="color: var(--color-text-muted);">${promptRelevance}% • ${timeAgo} ${direction}</span>
                  </div>
                </div>
              `;
            }).join('')}
            ${relatedPrompts.length > 3 ? `
              <div style="text-align: center; font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
                +${relatedPrompts.length - 3} more
              </div>
            ` : ''}
          </div>
        `;
      }
    }
    
    // Show diff stats if available
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
      const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
      const hasCodeDiff = details?.before_code || details?.after_code || details?.before_content || details?.after_content;
      
      if ((linesAdded > 0 || linesRemoved > 0) && hasCodeDiff) {
        diffStats = `
          <span style="font-size: var(--text-xs); color: var(--color-text-muted); margin-left: var(--space-xs);">
            <span style="color: var(--color-success);">+${linesAdded}</span>
            ${linesRemoved > 0 ? `<span style="color: var(--color-error);"> / -${linesRemoved}</span>` : ''}
          </span>
        `;
      }
    } catch (e) {
      // Ignore
    }
    
    // Extract context files from related prompts
    let contextFilesFromPrompts = [];
    let atFilesFromPrompts = [];
    
    // Collect context files from linked prompt
    if (event.prompt_id && window.state.data.prompts) {
      const linkedPrompt = window.state.data.prompts.find(p => 
        p.id === event.prompt_id || p.id === parseInt(event.prompt_id)
      );
      if (linkedPrompt) {
        contextFilesFromPrompts.push(...extractContextFiles(linkedPrompt));
        atFilesFromPrompts.push(...extractAtFiles(linkedPrompt));
      }
    }
    
    // Collect context files from related prompts
    if (relatedPrompts && relatedPrompts.length > 0) {
      relatedPrompts.forEach(prompt => {
        contextFilesFromPrompts.push(...extractContextFiles(prompt));
        atFilesFromPrompts.push(...extractAtFiles(prompt));
      });
    }
    
    // Deduplicate files
    const uniqueContextFiles = [...new Set(contextFilesFromPrompts)];
    const uniqueAtFiles = [...new Set(atFilesFromPrompts)];
    
    // Add context file indicators
    if (event.context) {
      const badges = [];
      
      // @ files indicator
      if (event.context.atFiles && event.context.atFiles.length > 0) {
        badges.push(`<span class="context-indicator files" title="${event.context.atFiles.length} @ referenced files">[FILE] ${event.context.atFiles.length}</span>`);
      }
      
      // Context files indicator
      const contextFileCount = (event.context.contextFiles?.attachedFiles?.length || 0) + 
                               (event.context.contextFiles?.codebaseFiles?.length || 0);
      if (contextFileCount > 0) {
        badges.push(`<span class="context-indicator context-files" title="${contextFileCount} context files">${contextFileCount} files</span>`);
      }
      
      // UI state indicator
      if (event.context.browserState && event.context.browserState.tabs && event.context.browserState.tabs.length > 0) {
        badges.push(`<span class="context-indicator system" title="${event.context.browserState.tabs.length} tabs open">[SYSTEM] ${event.context.browserState.tabs.length}</span>`);
      }
      
      contextIndicators = badges.join('');
    }
    
    // Add context files from prompts if available
    if (uniqueContextFiles.length > 0 || uniqueAtFiles.length > 0) {
      const contextFileId = `context-files-${event.id || event.timestamp}`;
      const totalFiles = uniqueContextFiles.length + uniqueAtFiles.length;
      
      contextIndicators += `
        <span class="context-indicator context-files" 
              style="cursor: pointer;"
              onclick="event.stopPropagation(); toggleContextFiles('${contextFileId}')"
              title="Click to view ${totalFiles} context files from related prompts">
          📁 ${totalFiles} context file${totalFiles !== 1 ? 's' : ''}
        </span>
      `;
      
      // Add expandable context files section
      const contextFilesHtml = `
        <div id="${contextFileId}" class="context-files-list" style="display: none; margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-alt, #f5f5f5); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
          ${uniqueContextFiles.length > 0 ? `
            <div style="margin-bottom: var(--space-xs);">
              <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
                Context Files (${uniqueContextFiles.length})
              </div>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                ${uniqueContextFiles.slice(0, 10).map(file => {
                  const fileName = file.split('/').pop() || file;
                  return `
                    <div style="font-size: var(--text-xs); color: var(--color-text); padding: 2px 4px; border-radius: 2px; cursor: pointer;"
                         onclick="event.stopPropagation(); highlightFileInGraph('${file.replace(/'/g, "\\'")}')"
                         onmouseover="this.style.background='var(--color-bg, #ffffff)'"
                         onmouseout="this.style.background='transparent'"
                         title="${file}">
                      📄 ${window.escapeHtml(fileName)}
                    </div>
                  `;
                }).join('')}
                ${uniqueContextFiles.length > 10 ? `
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic; margin-top: 2px;">
                    +${uniqueContextFiles.length - 10} more
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          ${uniqueAtFiles.length > 0 ? `
            <div>
              <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
                @ Referenced Files (${uniqueAtFiles.length})
              </div>
              <div style="display: flex; flex-direction: column; gap: 2px;">
                ${uniqueAtFiles.slice(0, 10).map(file => {
                  const fileName = file.split('/').pop() || file;
                  return `
                    <div style="font-size: var(--text-xs); color: var(--color-text); padding: 2px 4px; border-radius: 2px; cursor: pointer;"
                         onclick="event.stopPropagation(); highlightFileInGraph('${file.replace(/'/g, "\\'")}')"
                         onmouseover="this.style.background='var(--color-bg, #ffffff)'"
                         onmouseout="this.style.background='transparent'"
                         title="${file}">
                      @ ${window.escapeHtml(fileName)}
                    </div>
                  `;
                }).join('')}
                ${uniqueAtFiles.length > 10 ? `
                  <div style="font-size: var(--text-xs); color: var(--color-text-muted); font-style: italic; margin-top: 2px;">
                    +${uniqueAtFiles.length - 10} more
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
      
      // Store context files HTML to be inserted after related prompts
      event._contextFilesHtml = contextFilesHtml;
    }
  } catch (e) {
    // Ignore errors in badge display
  }
  
  // Check if this is a state transition event
  const isStateEvent = event.type === 'state_fork' || event.type === 'state_merge' || event.type === 'state_create' || event.type === 'state_switch';
  const stateEventLabel = isStateEvent ? (event.type === 'state_fork' ? '[Fork]' : event.type === 'state_merge' ? '[Merge]' : event.type === 'state_create' ? '[Create]' : '[Switch]') : '';
  const stateEventClass = isStateEvent ? 'state-transition-event' : '';
  const stateEventStyle = isStateEvent ? 'border-left: 3px solid var(--color-primary); background: var(--color-bg-alt);' : '';

  return `
    <div class="timeline-item timeline-item-left event-content ${stateEventClass}" onclick="showEventModal('${event.id || event.timestamp}')" style="${stateEventStyle}">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            ${stateEventLabel ? `<span style="margin-right: 4px; font-size: 0.85em; color: var(--color-text-muted);">${stateEventLabel}</span>` : ''}
            ${fileInfo.displayTitle || fileInfo.badges || title}
            ${fileInfo.badges ? ` ${fileInfo.badges}` : ''}
            ${diffStats}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          ${desc ? `<div style="color: var(--color-text-muted); font-size: var(--text-sm);">${window.escapeHtml ? window.escapeHtml(desc) : desc}</div>` : ''}
          ${event.annotation ? `<div class="ai-annotation" style="margin-top: 4px; font-style: italic; color: var(--color-text-secondary); font-size: 0.9em; display: flex; align-items: center; gap: 4px;">${window.renderAnnotationIcon ? window.renderAnnotationIcon(14, 'var(--color-text-secondary)') : '<span style="font-size: 0.85em; color: var(--color-text-muted);">[AI]</span>'} ${window.escapeHtml(event.annotation)}</div>` : ''}
          ${event.intent ? `<span class="timeline-badge timeline-badge-primary" style="margin-top: 4px; display: inline-block;">${window.escapeHtml(event.intent)}</span>` : ''}
          ${tagsHtml ? `<div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-xs); align-items: center;">${tagsHtml}</div>` : ''}
          ${linkedPromptIndicator || contextIndicators ? `
            <div style="display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: var(--space-xs); align-items: center;">
              ${linkedPromptIndicator}
              ${contextIndicators}
            </div>
          ` : ''}
        </div>
        ${relatedPromptsIndicator}
        ${event._contextFilesHtml || ''}
      </div>
    </div>
  `;
}

/**
 * Extract context files from a prompt
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
 * Toggle context files visibility
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

/**
 * Highlight file in file graph (if available)
 */
function highlightFileInGraph(filePath) {
  // Try to highlight in file graph if it's open
  if (window.highlightFileInGraph) {
    window.highlightFileInGraph(filePath);
  } else if (window.filterGraphNodes) {
    // Fallback: try to filter/search in graph
    const fileName = filePath.split('/').pop();
    window.filterGraphNodes(fileName);
  }
  // Could also navigate to file graph view
  if (window.switchView && window.switchView === 'function') {
    // Optionally switch to file graph view
    // window.switchView('file-graph');
  }
}

// Export functions
window.toggleContextFiles = toggleContextFiles;
window.highlightFileInGraph = highlightFileInGraph;

function getEventTitle(event) {
  if (event.type === 'file_change' || event.type === 'code_change') {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      const path = details?.file_path || event.file_path || event.path || '';
      
      // Skip if it looks like a Git object hash (40 hex chars)
      if (/^[a-f0-9]{40}$/i.test(path)) {
        return 'Git object change';
      }
      
      // Extract filename from path
      const fileName = path.split('/').pop() || '';
      
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

/**
 * Get enhanced file information with workspace and directory context
 * @param {Object} event - Event object
 * @returns {Object} Enhanced file info with title, directory, workspace, badges
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
        badges: workspacePath ? window.createWorkspaceBadge ? window.createWorkspaceBadge(workspacePath) : '' : '',
        displayTitle: event.type || 'Activity'
      };
    }
    
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
    
    // Format directory path (show last 2 segments for context)
    const pathParts = filePath.split('/').filter(p => p) || filePath.split('\\').filter(p => p);
    const directory = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
    const shortDirectory = directory ? (directory.split('/').slice(-2).join('/') || directory.split('\\').slice(-2).join('\\')) : '';
    
    // Create a cleaner display title: filename with optional directory context
    let displayTitle = fileName;
    if (shortDirectory && fileName) {
      displayTitle = `<span style="color: var(--color-text-muted); font-size: 0.9em;">${window.escapeHtml ? window.escapeHtml(shortDirectory) : shortDirectory}/</span>${window.escapeHtml ? window.escapeHtml(fileName) : fileName}`;
    } else if (fileName) {
      displayTitle = window.escapeHtml ? window.escapeHtml(fileName) : fileName;
    }
    
    // Create badges (workspace badge only, file path is in title)
    let badges = '';
    if (workspacePath && window.createWorkspaceBadge) {
      badges = window.createWorkspaceBadge(workspacePath, 'sm');
    }
    
    return {
      fileName,
      directory,
      workspacePath,
      fullPath: filePath,
      formattedPath: shortDirectory ? `${shortDirectory}/${fileName}` : fileName,
      badges,
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

function getEventDescription(event) {
  // Remove emojis helper
  const removeEmojis = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/🔄|✨|↗|⇄|→|📦/g, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .trim();
  };
  
  // Use AI annotation if available (preferred), but remove emojis
  if (event.annotation) {
    return removeEmojis(event.annotation);
  }
  
  // Fallback to improved logic
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

function renderActivityTimeline(events) {
  // Simple timeline for Overview view (not alternating layout)
  // Group events by state boundaries
  let currentStateId = null;
  let stateGroups = [];
  let currentGroup = [];

  events.forEach(event => {
    // Check if this is a state transition
    if (event.type === 'state_create' || event.type === 'state_fork' || event.type === 'state_switch') {
      // Start new state group
      if (currentGroup.length > 0) {
        stateGroups.push({ stateId: currentStateId, events: currentGroup });
      }
      currentGroup = [event];
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        currentStateId = details?.state_id || details?.forked_state_id || null;
      } catch (e) {
        currentStateId = null;
      }
    } else {
      currentGroup.push(event);
    }
  });
  
  // Add last group
  if (currentGroup.length > 0) {
    stateGroups.push({ stateId: currentStateId, events: currentGroup });
  }

  return `
    <div class="timeline-simple">
      ${stateGroups.map((group, groupIndex) => {
        const isStateBoundary = group.stateId !== null;
        const stateMarker = isStateBoundary ? `
          <div class="state-boundary-marker" style="
            background: var(--color-primary);
            color: white;
            padding: var(--space-xs) var(--space-sm);
            border-radius: var(--radius-sm);
            margin: var(--space-md) 0 var(--space-sm) 0;
            font-size: 0.85em;
            font-weight: 600;
            text-align: center;
          ">
            ${group.events[0]?.annotation || 'State Transition'}
          </div>
        ` : '';
        
        return stateMarker + group.events.map(event => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          const title = window.getEventTitle(event);
          const desc = window.getEventDescription(event);
          const isStateEvent = event.type === 'state_fork' || event.type === 'state_merge' || event.type === 'state_create' || event.type === 'state_switch';
          const stateEventLabel = isStateEvent ? (event.type === 'state_fork' ? '[Fork]' : event.type === 'state_merge' ? '[Merge]' : event.type === 'state_create' ? '[Create]' : '[Switch]') : '';
          
          return `
            <div class="timeline-simple-item ${isStateEvent ? 'state-transition-event' : ''}" onclick="showEventModal('${event.id || event.timestamp}')" style="${isStateEvent ? 'border-left: 3px solid var(--color-primary); background: var(--color-bg-alt);' : ''}">
              <div class="timeline-simple-content">
                <div class="timeline-simple-header">
                  <div class="timeline-simple-title">
                    ${stateEventLabel ? `<span style="margin-right: 4px; font-size: 0.85em; color: var(--color-text-muted);">${stateEventLabel}</span>` : ''}
                    ${window.escapeHtml(title)}
                  </div>
                  <div class="timeline-simple-meta">${time}</div>
                </div>
                <div class="timeline-simple-description">${window.escapeHtml(desc)}</div>
              </div>
            </div>
          `;
        }).join('');
      }).join('')}
    </div>
  `;
}

// Export to window for global access
window.groupIntoTemporalThreads = groupIntoTemporalThreads;
window.renderUnifiedTimeline = renderUnifiedTimeline;
window.renderActivityTimeline = renderActivityTimeline;
window.renderConversationThread = renderConversationThread;
window.renderConversationMessage = renderConversationMessage;
window.toggleConversationMessages = toggleConversationMessages;
/**
 * Render a commit group with nested events and prompts
 */
function renderCommitGroup(commitGroup, timelineItems = null) {
  const { commit, items, eventCount, promptCount } = commitGroup;
  const commitId = `commit-${commit.hash.substring(0, 7)}`;
  const commitTime = typeof commit.timestamp === 'number' 
    ? commit.timestamp 
    : new Date(commit.timestamp).getTime();
  const timeStr = new Date(commitTime).toLocaleString();
  const hashShort = commit.hash.substring(0, 7);
  
  // Escape commit message
  const message = window.escapeHtml ? window.escapeHtml(commit.message) : commit.message;
  
  // Render nested items
  const itemsHtml = items.map(item => {
    if (item.itemType === 'prompt') {
      return window.renderPromptTimelineItem ? 
        window.renderPromptTimelineItem(item, 'right', timelineItems) : '';
    } else if (item.itemType === 'event') {
      return window.renderTimelineItem ? 
        window.renderTimelineItem(item, 'left', timelineItems) : '';
    }
    return '';
  }).filter(html => html).join('');
  
  return `
    <div class="timeline-item commit-group" data-commit-id="${commitId}">
      <div class="commit-group-header" onclick="toggleCommitGroup('${commitId}')">
        <div class="commit-group-info">
          <div class="commit-group-details">
            <div class="commit-message">${message}</div>
            <div class="commit-meta">
              <span class="commit-hash">${hashShort}</span>
              <span class="commit-time">${timeStr}</span>
              <span class="commit-stats">${eventCount} event${eventCount !== 1 ? 's' : ''}, ${promptCount} prompt${promptCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <span class="commit-group-toggle" id="toggle-${commitId}">▼</span>
      </div>
      <div class="commit-group-items" id="items-${commitId}">
        ${itemsHtml}
      </div>
    </div>
  `;
}

// Toggle function for commit groups
window.toggleCommitGroup = function(commitId) {
  const itemsContainer = document.getElementById(`items-${commitId}`);
  const toggle = document.getElementById(`toggle-${commitId}`);
  if (itemsContainer && toggle) {
    const isExpanded = itemsContainer.style.display !== 'none';
    itemsContainer.style.display = isExpanded ? 'none' : 'block';
    toggle.textContent = isExpanded ? '▶' : '▼';
  }
};

window.renderPromptTimelineItem = renderPromptTimelineItem;
window.renderTerminalTimelineItem = renderTerminalTimelineItem;
window.renderTimelineItem = renderTimelineItem;
window.renderCommitGroup = renderCommitGroup;
window.renderTemporalThread = renderTemporalThread;
window.toggleTemporalThread = toggleTemporalThread;
window.getEventTitle = getEventTitle;
window.getEventDescription = getEventDescription;
window.getEnhancedFileInfo = getEnhancedFileInfo;
