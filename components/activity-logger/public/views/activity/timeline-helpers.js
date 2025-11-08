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
  // First: Group prompts by conversation for threading
  const conversationMap = new Map();
  const standalonePrompts = [];
  const nonPromptItems = [];
  
  items.forEach(item => {
    if (item.itemType === 'prompt') {
      // Check if this is a conversation thread or a message
      const isThread = item.type === 'conversation-thread' && !item.parentConversationId;
      const conversationId = isThread ? item.composerId : (item.parentConversationId || item.composerId);
      
      // Only group prompts that are part of conversations
      // Standalone prompts (no conversationId) should be rendered individually
      if (conversationId) {
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            thread: isThread ? item : null,
            messages: [],
            timestamp: item.sortTime
          });
        }
        
        const conv = conversationMap.get(conversationId);
        if (isThread) {
          conv.thread = item;
        } else {
          conv.messages.push(item);
        }
        conv.timestamp = Math.max(conv.timestamp, item.sortTime);
        
        // If no thread set yet but this item has a title, use it as thread
        if (!conv.thread && (item.conversationTitle || item.text || item.prompt || item.content)) {
          conv.thread = item;
        }
      } else {
        // This is a standalone prompt, not part of a conversation
        standalonePrompts.push(item);
      }
    } else if (item.itemType === 'status') {
      // Status messages go on the left side
      nonPromptItems.push(item);
    } else {
      nonPromptItems.push(item);
    }
  });
  
  // Convert conversations to timeline items
  // If a conversation has only 1 message, treat it as a standalone prompt instead
  const conversationItems = Array.from(conversationMap.values())
    .filter(conv => conv.messages.length > 0 || conv.thread) // Only include if has messages or thread
    .map(conv => {
      // If only 1 message and no thread, render as standalone prompt
      if (conv.messages.length === 1 && !conv.thread) {
        return {
          ...conv.messages[0],
          itemType: 'prompt',
          sortTime: conv.messages[0].sortTime || conv.timestamp
        };
      }
      // Otherwise, render as conversation
      return {
        itemType: 'conversation',
        conversation: conv,
        sortTime: conv.timestamp
      };
    });
  
  // Merge all items (conversations, standalone prompts, and other items)
  const allItems = [...conversationItems, ...standalonePrompts, ...nonPromptItems]
    .sort((a, b) => {
      const aTime = a.sortTime || 0;
      const bTime = b.sortTime || 0;
      return bTime - aTime;
    });
  
  // Apply temporal threading to group items by time windows
  // Use shorter window for conversations to avoid grouping too many together
  const temporalThreads = groupIntoTemporalThreads(allItems, 5 * 60 * 1000); // 5 minute window (reduced from 15)
  
  // Store the sorted timeline items for sequence-based linking
  // This allows render functions to find related items by position in sequence
  window._currentTimelineItems = allItems;
  
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
        
        // Multiple items: render as a temporal thread/session with mixed content
        return window.renderTemporalThread(thread, allItems);
      }).join('')}
    </div>
  `;
}

/**
 * Extract conversation title for summary display
 */
function extractConversationTitle(conversation) {
  const { thread, messages } = conversation;
  
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
  if (messages.length > 0) {
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
  const { thread, messages } = conversation;
  
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
  
  const time = window.formatTimeAgo(thread?.timestamp || conversation.timestamp);
  const messageCount = messages.length;
  const threadId = thread?.composerId || `conv-${Date.now()}`;
  
  // Sort messages chronologically
  const sortedMessages = messages.sort((a, b) => a.sortTime - b.sortTime);
  
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
          ${thread?.workspaceName ? `<span class="badge">${window.escapeHtml(thread.workspaceName)}</span>` : ''}
          ${thread?.mode ? `<span class="badge" style="background: var(--color-primary); color: white;">${window.escapeHtml(thread.mode)}</span>` : ''}
          ${messages.length > 0 ? (() => {
            // Show file indicators if any messages reference files
            const filePaths = new Set();
            messages.forEach(m => {
              const filePath = m.file_path || m.context?.file_path;
              if (filePath) {
                const fileName = filePath.split('/').pop();
                if (fileName && !fileName.startsWith('.')) filePaths.add(fileName);
              }
            });
            if (filePaths.size > 0) {
              const files = Array.from(filePaths).slice(0, 2);
              return `<span class="badge" style="background: var(--color-accent); color: white;" title="${Array.from(filePaths).join(', ')}">[File] ${files.join(', ')}${filePaths.size > 2 ? '...' : ''}</span>`;
            }
            return '';
          })() : ''}
        </div>
        
        <!-- Messages (expanded by default) -->
        <div id="conv-messages-${threadId}" class="conversation-messages visible">
          ${sortedMessages.length > 0 ? sortedMessages.map(msg => window.renderConversationMessage(msg)).join('') : '<div class="conversation-empty">No messages in this conversation yet</div>'}
        </div>
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
    const isHidden = !messagesDiv.classList.contains('visible');
    if (isHidden) {
      messagesDiv.classList.add('visible');
      icon.style.transform = 'rotate(90deg)';
    } else {
      messagesDiv.classList.remove('visible');
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

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
  
  const icon = '🤖';
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
          <span style="color: var(--color-accent);">↓</span> Related code changes (${relatedEvents.length})
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
      contextChangeIndicator = `<span class="context-change-badge" title="${change.addedFiles.length} added, ${change.removedFiles.length} removed">📁 ${changeText}</span>`;
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
        metadataBadges.push(`<span class="badge" style="background: var(--color-primary); color: white;" title="${workspacePath}">📁 ${workspaceName}</span>`);
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
            📁 ${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}
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
            <span class="timeline-title-meta">(${totalItems} items • ${durationText})</span>
          </div>
          <div class="timeline-meta">${window.formatTimeAgo(actualStartTime)}</div>
        </div>
        <div class="timeline-description">
          ${workspaceDisplay}
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-xs); align-items: center; margin-bottom: var(--space-xs);">
            <span class="badge badge-prompt" title="Start: ${startDate.toLocaleString()}, End: ${endDate.toLocaleString()}">${timeRange}</span>
            <span class="badge">${summary}</span>
            ${sessionMetadata.totalLinesAdded > 0 || sessionMetadata.totalLinesRemoved > 0 ? `
              <span class="badge" style="background: var(--color-success); color: white;">
                +${sessionMetadata.totalLinesAdded}${sessionMetadata.totalLinesRemoved > 0 ? `/-${sessionMetadata.totalLinesRemoved}` : ''} lines
              </span>
            ` : ''}
            ${sessionMetadata.linkedPairs > 0 ? `
              <span class="badge" style="background: var(--color-warning); color: white;" title="Prompts linked to code changes">
                ${sessionMetadata.linkedPairs} linked
              </span>
            ` : ''}
          </div>
          ${fileSummary}
          ${sessionMetadata.modelsUsed.size > 0 ? `
            <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">
              Models: ${Array.from(sessionMetadata.modelsUsed).slice(0, 2).join(', ')}${sessionMetadata.modelsUsed.size > 2 ? ` +${sessionMetadata.modelsUsed.size - 2} more` : ''}
            </div>
          ` : ''}
          ${conversationSummary}
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
                  relationshipIndicator = `<div class="timeline-relationship-indicator" style="padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-xs); background: rgba(59, 130, 246, 0.1); border-left: 3px solid var(--color-primary); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
                    <span style="color: var(--color-primary);">🔗</span> Linked to prompt above (${Math.round(Math.abs(item.sortTime - linkedPrompt.sortTime) / 1000)}s gap)
                  </div>`;
                }
              } else if (item.itemType === 'prompt' && (item.linked_entry_id || item.linkedEntryId)) {
                const linkedEntry = sortedItems.find(i => i.itemType === 'event' && (i.id === item.linked_entry_id || i.id === item.linkedEntryId || i.id === parseInt(item.linked_entry_id || item.linkedEntryId)));
                if (linkedEntry && Math.abs(item.sortTime - linkedEntry.sortTime) < 300000) {
                  relationshipIndicator = `<div class="timeline-relationship-indicator" style="padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-xs); background: rgba(34, 197, 94, 0.1); border-left: 3px solid var(--color-success); border-radius: var(--radius-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
                    <span style="color: var(--color-success);">[Code]</span> Generated code change below (${Math.round(Math.abs(item.sortTime - linkedEntry.sortTime) / 1000)}s gap)
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
  const desc = window.getEventDescription(event);
  
  // Get enhanced file information with workspace and directory
  const fileInfo = window.getEnhancedFileInfo ? window.getEnhancedFileInfo(event) : {
    fileName: title,
    workspacePath: event.workspace_path || '',
    badges: ''
  };
  
  // Auto-tag the event
  let eventTags = [];
  if (window.autoTagEvent) {
    eventTags = window.autoTagEvent(event);
  }
  
  // Render tags (including workspace)
  let tagsHtml = '';
  if (window.renderTags) {
    tagsHtml = `<div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px;">${window.renderTags(eventTags, true, event)}</div>`;
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
  } catch (e) {
    // Ignore errors in badge display
  }
  
  return `
    <div class="timeline-item timeline-item-left event-content" onclick="showEventModal('${event.id || event.timestamp}')">
      <div class="timeline-content">
        <div class="timeline-header">
          <div class="timeline-title">
            ${fileInfo.badges || title}
            ${linkedPromptIndicator}
            ${contextIndicators}
            ${diffStats}
          </div>
          <div class="timeline-meta">${time}</div>
        </div>
        <div class="timeline-description">
          ${desc}
          ${tagsHtml}
        </div>
        ${relatedPromptsIndicator}
      </div>
    </div>
  `;
}

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
        badges: workspacePath ? window.createWorkspaceBadge ? window.createWorkspaceBadge(workspacePath) : '' : ''
      };
    }
    
    const fileName = filePath.split('/').pop() || '';
    const directory = window.getDirectoryPath ? window.getDirectoryPath(filePath) : '';
    const formattedPath = window.formatFilePathWithDirectory ? window.formatFilePathWithDirectory(filePath, 2) : fileName;
    
    // Create badges
    let badges = '';
    if (window.createFilePathBadge) {
      badges = window.createFilePathBadge(filePath, workspacePath);
    } else if (workspacePath && window.createWorkspaceBadge) {
      badges = window.createWorkspaceBadge(workspacePath);
    }
    
    return {
      fileName,
      directory,
      workspacePath,
      fullPath: filePath,
      formattedPath,
      badges
    };
  } catch (e) {
    return {
      fileName: event.type || 'Activity',
      directory: '',
      workspacePath: '',
      fullPath: '',
      badges: ''
    };
  }
}

function getEventDescription(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const added = details?.chars_added || 0;
    const deleted = details?.chars_deleted || 0;
    if (added || deleted) {
      return `+${added} / -${deleted} characters`;
    }
  } catch {}
  return 'File modification detected';
}

function renderActivityTimeline(events) {
  // Simple timeline for Overview view (not alternating layout)
  return `
    <div class="timeline-simple">
      ${events.map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const title = window.getEventTitle(event);
        const desc = window.getEventDescription(event);
        
        return `
          <div class="timeline-simple-item" onclick="showEventModal('${event.id || event.timestamp}')">
            <div class="timeline-simple-content">
              <div class="timeline-simple-header">
                <div class="timeline-simple-title">${window.escapeHtml(title)}</div>
                <div class="timeline-simple-meta">${time}</div>
              </div>
              <div class="timeline-simple-description">${window.escapeHtml(desc)}</div>
            </div>
          </div>
        `;
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
window.renderPromptTimelineItem = renderPromptTimelineItem;
window.renderTerminalTimelineItem = renderTerminalTimelineItem;
window.renderTimelineItem = renderTimelineItem;
window.renderTemporalThread = renderTemporalThread;
window.toggleTemporalThread = toggleTemporalThread;
window.getEventTitle = getEventTitle;
window.getEventDescription = getEventDescription;
window.getEnhancedFileInfo = getEnhancedFileInfo;
