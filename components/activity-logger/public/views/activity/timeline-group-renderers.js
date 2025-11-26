/**
 * Timeline Group Renderers
 * Group rendering functions for timeline
 * 
 * Dependencies:
 * - timeline-utils.js (getFilePathFromEvent, extractConversationTitle)
 * - timeline-item-renderers.js (renderPromptTimelineItem, renderConversationMessage, etc.)
 */

function renderIntegratedChunk(chunk, timelineItems = null) {
  const { prompt, events } = chunk;
  if (!prompt) return '';
  
  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
  const displayText = promptText.length > 200 ? promptText.substring(0, 200) + '...' : promptText;
  const timeAgo = window.formatTimeAgo ? window.formatTimeAgo(new Date(prompt.timestamp)) : 
                  new Date(prompt.timestamp).toLocaleTimeString();
  const fullTime = new Date(prompt.timestamp).toLocaleString();
  
  // Calculate total changes from all events
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;
  let totalCharsAdded = 0;
  let totalCharsDeleted = 0;
  const filesChanged = new Set();
  
  events.forEach(event => {
    try {
      const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
      totalLinesAdded += details?.lines_added || details?.diff_stats?.lines_added || 0;
      totalLinesRemoved += details?.lines_removed || details?.diff_stats?.lines_removed || 0;
      totalCharsAdded += details?.chars_added || details?.diff_stats?.chars_added || 0;
      totalCharsDeleted += details?.chars_deleted || details?.diff_stats?.chars_deleted || 0;
      
      const filePath = details?.file_path || event.file_path || event.path || '';
      if (filePath) filesChanged.add(filePath);
    } catch (e) {
      // Ignore
    }
  });
  
  const chunkId = `chunk-${prompt.id || prompt.timestamp}`;
  const expandId = `expand-${chunkId}`;
  const detailsId = `details-${chunkId}`;
  
  return `
    <div class="timeline-card timeline-item-left integrated-chunk" style="border-left: 3px solid var(--color-primary, #3b82f6);">
      <div class="timeline-card-content">
        <div class="timeline-card-header" onclick="toggleEventDetails('${expandId}', '${detailsId}')" style="cursor: pointer;">
          <div style="display: flex; flex-direction: column; gap: var(--space-sm, 0.75rem); flex: 1;">
            <!-- Prompt Section -->
            <div style="display: flex; align-items: start; gap: var(--space-sm, 0.75rem);">
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: var(--color-text, #333); margin-bottom: var(--space-xs, 0.5rem); line-height: 1.4;">
                  ${window.escapeHtml ? window.escapeHtml(displayText) : displayText}
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-sm, 0.75rem); flex-wrap: wrap; font-size: var(--text-xs, 0.75rem); color: var(--color-text-muted, #666);">
                  ${prompt.source ? `<span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); padding: 2px 6px; border-radius: 4px; font-size: 10px;">${window.escapeHtml ? window.escapeHtml(prompt.source) : prompt.source}</span>` : ''}
                  ${prompt.workspace_path ? `<span style="font-family: var(--font-mono);">${window.escapeHtml ? window.escapeHtml(prompt.workspace_path.split('/').pop()) : prompt.workspace_path.split('/').pop()}</span>` : ''}
                </div>
              </div>
            </div>
            
            <!-- Code Changes Summary -->
            ${events.length > 0 ? `
              <div style="display: flex; align-items: center; gap: var(--space-sm, 0.75rem); padding: var(--space-sm, 0.75rem); background: var(--color-bg-alt, #f5f5f5); border-radius: var(--radius-sm, 4px); border-left: 2px solid var(--color-success, #10b981);">
                <div style="flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: var(--color-success, #10b981); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">
                  [Note]
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; color: var(--color-text, #333); margin-bottom: 2px; font-size: var(--text-sm, 0.875rem);">
                    ${events.length} file change${events.length !== 1 ? 's' : ''}
                    ${totalLinesAdded > 0 || totalLinesRemoved > 0 ? ` • ${totalLinesAdded > 0 ? `+${totalLinesAdded}` : ''}${totalLinesAdded > 0 && totalLinesRemoved > 0 ? '/' : ''}${totalLinesRemoved > 0 ? `-${totalLinesRemoved}` : ''} lines` : ''}
                  </div>
                  ${filesChanged.size > 0 ? `
                    <div style="font-size: var(--text-xs, 0.75rem); color: var(--color-text-muted, #666); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      ${Array.from(filesChanged).slice(0, 3).map(f => f.split('/').pop()).join(', ')}${filesChanged.size > 3 ? ` +${filesChanged.size - 3} more` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            ` : ''}
          </div>
          <div class="timeline-card-meta" style="display: flex; align-items: center; gap: var(--space-sm, 0.75rem); flex-shrink: 0;">
            <span class="timeline-time" title="${fullTime}">${timeAgo}</span>
            <button class="timeline-card-toggle" id="${expandId}" onclick="event.stopPropagation(); toggleEventDetails('${expandId}', '${detailsId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle details">
              
            </button>
          </div>
        </div>
        <div class="timeline-card-body">
          <div id="${detailsId}" style="display: none; margin-top: var(--space-md, 1rem); padding-top: var(--space-md, 1rem); border-top: 1px solid var(--color-border, rgba(0,0,0,0.1));">
            <!-- Full Prompt Text -->
            <div style="margin-bottom: var(--space-md, 1rem);">
              <div style="font-size: var(--text-xs, 0.75rem); font-weight: 600; color: var(--color-text-muted, #666); margin-bottom: var(--space-xs, 0.5rem);">Full Prompt:</div>
              <div style="padding: var(--space-sm, 0.75rem); background: var(--color-bg, #fff); border-radius: var(--radius-sm, 4px); border: 1px solid var(--color-border, rgba(0,0,0,0.1)); font-size: var(--text-sm, 0.875rem); line-height: 1.6; white-space: pre-wrap; max-height: 300px; overflow-y: auto;">
                ${window.escapeHtml ? window.escapeHtml(promptText) : promptText}
              </div>
            </div>
            
            <!-- Code Changes Details -->
            ${events.length > 0 ? `
              <div>
                <div style="font-size: var(--text-xs, 0.75rem); font-weight: 600; color: var(--color-text-muted, #666); margin-bottom: var(--space-sm, 0.75rem);">Code Changes:</div>
                <div style="display: flex; flex-direction: column; gap: var(--space-sm, 0.75rem);">
                  ${events.map((event, idx) => {
                    const eventDetails = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
                    const filePath = eventDetails?.file_path || event.file_path || 'Unknown file';
                    const fileName = filePath.split('/').pop();
                    const linesAdded = eventDetails?.lines_added || eventDetails?.diff_stats?.lines_added || 0;
                    const linesRemoved = eventDetails?.lines_removed || eventDetails?.diff_stats?.lines_removed || 0;
                    const charsAdded = eventDetails?.chars_added || eventDetails?.diff_stats?.chars_added || 0;
                    
                    return `
                      <div style="padding: var(--space-sm, 0.75rem); background: var(--color-bg-alt, #f5f5f5); border-radius: var(--radius-sm, 4px); border-left: 2px solid var(--color-success, #10b981); cursor: pointer;" onclick="showEventModal('${event.id || event.timestamp}')">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs, 0.5rem);">
                          <div style="font-weight: 600; color: var(--color-text, #333); font-size: var(--text-sm, 0.875rem);">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</div>
                          ${(linesAdded > 0 || linesRemoved > 0) ? `
                            <div style="font-size: var(--text-xs, 0.75rem); color: var(--color-text-muted, #666);">
                              ${linesAdded > 0 ? `<span style="color: var(--color-success, #10b981);">+${linesAdded}</span>` : ''}
                              ${linesAdded > 0 && linesRemoved > 0 ? ' / ' : ''}
                              ${linesRemoved > 0 ? `<span style="color: var(--color-error, #ef4444);">-${linesRemoved}</span>` : ''}
                            </div>
                          ` : ''}
                        </div>
                        <div style="font-size: var(--text-xs, 0.75rem); color: var(--color-text-muted, #666); font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                          ${window.escapeHtml ? window.escapeHtml(filePath) : filePath}
                        </div>
                        ${charsAdded > 0 ? `
                          <div style="font-size: var(--text-xs, 0.75rem); color: var(--color-text-muted, #666); margin-top: 4px;">
                            +${(charsAdded / 1024).toFixed(1)}K chars
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;


function renderFileChangeGroup(group, side = 'left', timelineItems = null) {
  if (!group.items || group.items.length === 0) return '';
  
  const firstItem = group.items[0];
  const lastItem = group.items[group.items.length - 1];
  const filePath = group.filePath || (window.getFilePathFromEvent ? window.getFilePathFromEvent(firstItem) : '');
  const fileName = filePath ? filePath.split('/').pop() : 'Unknown file';
  const directory = filePath ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
  
  // Calculate totals
  let totalCharsAdded = 0;
  let totalCharsRemoved = 0;
  let totalLinesAdded = 0;
  let totalLinesRemoved = 0;
  
  group.items.forEach(item => {
    try {
      const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
      totalCharsAdded += details?.chars_added || 0;
      totalCharsRemoved += details?.chars_removed || 0;
      totalLinesAdded += details?.lines_added || details?.diff_stats?.lines_added || 0;
      totalLinesRemoved += details?.lines_removed || details?.diff_stats?.lines_removed || 0;
    } catch (e) {
      // Ignore
    }
  });
  
  const timeAgo = window.formatTimeAgo ? window.formatTimeAgo(new Date(firstItem.timestamp)) : 
                  new Date(firstItem.timestamp).toLocaleTimeString();
  const fullTime = new Date(firstItem.timestamp).toLocaleString();
  
  const groupId = `file-group-${firstItem.id || firstItem.timestamp}`;
  const expandId = `expand-${groupId}`;
  const detailsId = `details-${groupId}`;
  
  // Find related prompts for the group
  let groupPromptCount = 0;
  if (timelineItems && (window.findRelatedPromptsBySequence || window.findRelatedPrompts)) {
    // Find prompts related to any item in the group
    const allRelatedPrompts = new Set();
    group.items.forEach(item => {
      let relatedPrompts = [];
      if (window.findRelatedPromptsBySequence) {
        relatedPrompts = window.findRelatedPromptsBySequence(item, timelineItems, { before: 20, after: 5 });
      } else if (window.findRelatedPrompts) {
        relatedPrompts = window.findRelatedPrompts(item, 15);
      }
      relatedPrompts.forEach(p => allRelatedPrompts.add(p.id || p.timestamp));
    });
    groupPromptCount = allRelatedPrompts.size;
  }
  
  // Format stats
  let statsText = '';
  if (totalCharsAdded > 0 || totalCharsRemoved > 0) {
    const addedKB = (totalCharsAdded / 1024).toFixed(1);
    const removedKB = (totalCharsRemoved / 1024).toFixed(1);
    statsText = `${totalCharsAdded > 0 ? `+${addedKB}K` : ''}${totalCharsRemoved > 0 ? (totalCharsAdded > 0 ? ' / ' : '') + `-${removedKB}K` : ''} chars`;
  } else if (totalLinesAdded > 0 || totalLinesRemoved > 0) {
    statsText = `${totalLinesAdded > 0 ? `+${totalLinesAdded}` : ''}${totalLinesRemoved > 0 ? (totalLinesAdded > 0 ? ' / ' : '') + `-${totalLinesRemoved}` : ''} lines`;
  }
  
  const workspaceBadge = group.workspace ? 
    (window.renderWorkspaceBadge ? window.renderWorkspaceBadge(group.workspace, true) : '') : '';
  
  // Prompt count badge
  const promptCountBadge = groupPromptCount > 0 ? `
    <span class="timeline-badge" style="background: var(--color-accent-alpha-10, rgba(168, 85, 247, 0.1)); color: var(--color-accent, #a855f7); font-size: 10px; padding: 2px 6px; border-radius: 4px;" title="${groupPromptCount} related prompt${groupPromptCount !== 1 ? 's' : ''}">
      [Chat] ${groupPromptCount}
    </span>
  ` : '';
  
  return `
    <div class="timeline-card timeline-item-left file-change-group" style="border-left: 3px solid var(--color-primary, #3b82f6);">
      <div class="timeline-card-content">
        <div class="timeline-card-header" onclick="toggleEventDetails('${expandId}', '${detailsId}')" style="cursor: pointer;">
          <div style="display: flex; flex-direction: column; gap: var(--space-xs, 0.5rem); flex: 1;">
            <div style="display: flex; align-items: center; gap: var(--space-sm, 0.75rem); flex-wrap: wrap;">
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: var(--color-text, #333); display: flex; align-items: center; gap: var(--space-xs, 0.5rem);">
                  <span style="font-size: 0.875rem; opacity: 0.7; margin-right: 4px;">[Note]</span>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</span>
                  <span class="timeline-badge" style="background: var(--color-primary, #3b82f6); color: white; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">
                    ${group.items.length} save${group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                ${directory ? `<div style="font-size: 0.75rem; color: var(--color-text-muted, #666); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${window.escapeHtml ? window.escapeHtml(directory) : directory}</div>` : ''}
              </div>
            </div>
            ${statsText ? `<div style="font-size: 0.875rem; color: var(--color-text-muted, #666); margin-top: 4px;">${statsText}</div>` : ''}
          </div>
          <div class="timeline-card-meta" style="display: flex; align-items: center; gap: var(--space-sm, 0.75rem); flex-shrink: 0;">
            ${promptCountBadge}
            <span class="timeline-time" title="${fullTime}">${timeAgo}</span>
            <button class="timeline-card-toggle" id="${expandId}" onclick="event.stopPropagation(); toggleEventDetails('${expandId}', '${detailsId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle details">
              
            </button>
          </div>
        </div>
        <div class="timeline-card-body">
          ${workspaceBadge ? `<div class="timeline-card-indicators">${workspaceBadge}</div>` : ''}
          <div id="${detailsId}" style="display: none; margin-top: var(--space-md, 1rem); padding-top: var(--space-md, 1rem); border-top: 1px solid var(--color-border, rgba(0,0,0,0.1));">
            <div style="font-size: 0.875rem; color: var(--color-text-muted, #666); margin-bottom: var(--space-sm, 0.75rem);">
              ${group.items.length} file save${group.items.length !== 1 ? 's' : ''} within ${Math.round((new Date(lastItem.timestamp) - new Date(firstItem.timestamp)) / 1000 / 60)} minutes
            </div>
            <div style="display: flex; flex-direction: column; gap: var(--space-sm, 0.75rem); max-height: 400px; overflow-y: auto;">
              ${group.items.map((item, idx) => {
                const itemTime = new Date(item.timestamp).toLocaleTimeString();
                let itemStats = '';
                try {
                  const details = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
                  const charsAdded = details?.chars_added || 0;
                  const charsRemoved = details?.chars_removed || 0;
                  if (charsAdded > 0 || charsRemoved > 0) {
                    const addedKB = (charsAdded / 1024).toFixed(1);
                    const removedKB = (charsRemoved / 1024).toFixed(1);
                    itemStats = `${charsAdded > 0 ? `+${addedKB}K` : ''}${charsRemoved > 0 ? (charsAdded > 0 ? ' / ' : '') + `-${removedKB}K` : ''} chars`;
                  }
                } catch (e) {}
                return `
                  <div style="padding: var(--space-sm, 0.75rem); background: var(--color-bg-alt, #f5f5f5); border-radius: var(--radius-sm, 4px); border-left: 2px solid var(--color-primary, #3b82f6);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 0.75rem; color: var(--color-text-muted, #666); font-weight: 500;">Save #${idx + 1}</span>
                      <span style="font-size: 0.75rem; color: var(--color-text-muted, #666);">${itemTime}</span>
                    </div>
                    ${itemStats ? `<div style="font-size: 0.875rem; color: var(--color-text, #333);">${itemStats}</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;


function renderConversationThread(conversation, side = 'right') {
  // Support multiple formats:
  // 1. New format: conversation with turns array
  // 2. Hierarchy structure: workspace, tabs, rootPrompts
  // 3. Old structure: thread, messages (backward compatibility)
  
  const hasTurns = conversation.turns && Array.isArray(conversation.turns) && conversation.turns.length > 0;
  const isHierarchy = conversation.workspace || conversation.tabs || conversation.rootPrompts;
  
  let thread, messages, workspace, tabs, rootPrompts, allPrompts;
  
  if (hasTurns) {
    // New format with conversation_turns
    workspace = {
      id: conversation.workspace_id,
      path: conversation.workspace_path,
      name: conversation.workspace_path ? conversation.workspace_path.split('/').pop() : null
    };
    tabs = [];
    rootPrompts = [];
    allPrompts = conversation.turns.map(turn => ({
      id: turn.id,
      messageRole: turn.role,
      role: turn.role,
      text: turn.content,
      content: turn.content,
      timestamp: turn.created_at,
      created_at: turn.created_at,
      sortTime: new Date(turn.created_at).getTime(),
      turn_index: turn.turn_index,
      // Include all timing metadata
      thinkingTimeSeconds: turn.thinking_time_seconds,
      thinking_time_seconds: turn.thinking_time_seconds,
      request_duration_ms: turn.request_duration_ms,
      requestDurationMs: turn.request_duration_ms,
      time_to_first_token_ms: turn.time_to_first_token_ms,
      timeToFirstTokenMs: turn.time_to_first_token_ms,
      total_tokens: turn.total_tokens,
      totalTokens: turn.total_tokens,
      prompt_tokens: turn.prompt_tokens,
      completion_tokens: turn.completion_tokens,
      model_name: turn.model_name,
      modelName: turn.model_name,
      model_provider: turn.model_provider,
      code_blocks: turn.code_blocks,
      context_files: turn.context_files,
      referenced_files: turn.referenced_files
    }));
    messages = allPrompts;
    thread = {
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      workspaceName: workspace.name,
      workspace_path: conversation.workspace_path,
      timestamp: conversation.created_at,
      mode: 'chat'
    };
  } else if (isHierarchy) {
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
  
  // Try conversation title first (new format)
  if (conversation.title) {
    title = conversation.title;
  } else if (thread?.conversationTitle) {
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
  
  const time = window.formatTimeAgo ? 
    window.formatTimeAgo(thread?.timestamp || conversation.timestamp || conversation.created_at || conversation.metadata?.firstMessage) :
    new Date(thread?.timestamp || conversation.timestamp || conversation.created_at || conversation.metadata?.firstMessage).toLocaleString();
  const messageCount = allPrompts.length || messages.length || conversation.message_count || 0;
  const threadId = thread?.composerId || thread?.conversationId || conversation.id || `conv-${Date.now()}`;
  
  // Sort messages chronologically
  const sortedMessages = allPrompts.length > 0 
    ? [...allPrompts].sort((a, b) => (a.sortTime || a.timestamp || 0) - (b.sortTime || b.timestamp || 0))
    : [...messages].sort((a, b) => (a.sortTime || a.timestamp || 0) - (b.sortTime || b.timestamp || 0));
  
  // Filter out empty messages and check if we have valid content
  const validMessages = sortedMessages.filter(m => {
    const text = extractText(m);
    return text && text.length > 0;
  });
  
  // If no valid messages and no title, don't render this conversation
  if (validMessages.length === 0 && !title) {
    return '';
  }
  
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
  
  // Determine conversation status
  const isActive = conversation.status === 'active' || conversation.active === true;
  const statusBadge = isActive ? '<span class="badge" style="background: var(--color-success); color: var(--badge-text-on-primary); font-size: var(--text-xs);">active</span>' : '';
  
  // Get workspace name for display
  const workspaceName = workspace?.name || thread?.workspaceName || conversation.workspace_path?.split('/').pop() || '';
  
  return `
    <div class="timeline-card timeline-item-${side} conversation-timeline-item" style="border-left: 3px solid var(--color-primary); background: var(--color-primary-alpha-05);">
      <div class="timeline-card-content">
        <div class="timeline-card-header">
          <div class="timeline-card-title-section">
            <div class="timeline-card-title">
              <span class="timeline-file-name" style="cursor: pointer;" onclick="toggleConversationMessages('${threadId}')" title="Click to expand/collapse">
                <span id="conv-icon-${threadId}" class="timeline-title-icon" style="transform: rotate(90deg); display: inline-block; transition: transform 0.2s; margin-right: 4px; font-size: 0.75rem;"></span>
                ${window.escapeHtml(title)}
              </span>
              ${messageCount > 1 ? `<span class="timeline-file-stats" style="margin-left: var(--space-xs); color: var(--color-text-muted);">${messageCount} messages</span>` : ''}
            </div>
          </div>
          <div class="timeline-card-meta">
            <span class="timeline-time">${time}</span>
          </div>
        </div>
        <div class="timeline-card-body">
          <div class="timeline-card-tags" style="display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: center;">
            ${statusBadge}
            ${workspaceName ? `<span class="badge" style="background: var(--color-success); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml(workspaceName)}</span>` : ''}
            ${thread?.mode && thread.mode !== 'chat' ? `<span class="badge" style="background: var(--color-primary); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml(thread.mode)}</span>` : ''}
            ${tabs && tabs.length > 0 ? `<span class="badge" style="background: var(--color-accent); color: var(--badge-text-on-accent); font-size: var(--text-xs);" title="${tabs.length} tab${tabs.length !== 1 ? 's' : ''}">${tabs.length} tab${tabs.length !== 1 ? 's' : ''}</span>` : ''}
          ${allPrompts.length > 0 ? (() => {
            // Show file indicators if any messages reference files
            const filePaths = new Set();
            allPrompts.forEach(m => {
              const filePath = m.file_path || m.context?.file_path;
              const contextFiles = m.context_files ? (typeof m.context_files === 'string' ? JSON.parse(m.context_files) : m.context_files) : [];
              const referencedFiles = m.referenced_files ? (typeof m.referenced_files === 'string' ? JSON.parse(m.referenced_files) : m.referenced_files) : [];
              [filePath, ...contextFiles, ...referencedFiles].forEach(fp => {
                if (fp) {
                  const fileName = fp.split('/').pop();
                  if (fileName && !fileName.startsWith('.')) filePaths.add(fileName);
                }
              });
            });
            if (filePaths.size > 0) {
              const files = Array.from(filePaths).slice(0, 2);
              return `<span class="badge" style="background: var(--color-accent); color: var(--badge-text-on-accent);"> ${window.escapeHtml(files.join(', '))}${filePaths.size > 2 ? '...' : ''}</span>`;
            }
            return '';
          })() : ''}
          ${(() => {
            // Show conversation statistics if available
            const assistantTurns = allPrompts.filter(m => (m.role || m.messageRole) === 'assistant');
            if (assistantTurns.length > 0) {
              const totalTokens = assistantTurns.reduce((sum, t) => sum + (t.total_tokens || t.totalTokens || 0), 0);
              const avgDuration = assistantTurns
                .filter(t => t.request_duration_ms || t.requestDurationMs)
                .reduce((sum, t, _, arr) => sum + (t.request_duration_ms || t.requestDurationMs) / arr.length, 0);
              const avgThinking = assistantTurns
                .filter(t => (t.thinking_time_seconds || t.thinkingTimeSeconds) > 0)
                .reduce((sum, t, _, arr) => sum + (t.thinking_time_seconds || t.thinkingTimeSeconds) / arr.length, 0);
              
              const stats = [];
              if (totalTokens > 0) stats.push(` ${totalTokens} tokens`);
              if (avgDuration > 0) stats.push(`${(avgDuration / 1000).toFixed(1)}s avg`);
              if (avgThinking > 0) stats.push(` ${avgThinking.toFixed(1)}s thinking`);
              
              if (stats.length > 0) {
                    return `<span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); border: 1px solid var(--color-primary);">${stats.join(' • ')}</span>`;
              }
            }
            return '';
          })()}
            ${flowIndicators}
          </div>
          
          <!-- Compact stats row -->
          ${(() => {
            const assistantTurns = allPrompts.filter(m => (m.role || m.messageRole) === 'assistant');
            if (assistantTurns.length > 0) {
              const totalTokens = assistantTurns.reduce((sum, t) => sum + (t.total_tokens || t.totalTokens || 0), 0);
              const avgDuration = assistantTurns
                .filter(t => t.request_duration_ms || t.requestDurationMs)
                .reduce((sum, t, _, arr) => sum + (t.request_duration_ms || t.requestDurationMs) / arr.length, 0);
              const avgThinking = assistantTurns
                .filter(t => (t.thinking_time_seconds || t.thinkingTimeSeconds) > 0)
                .reduce((sum, t, _, arr) => sum + (t.thinking_time_seconds || t.thinkingTimeSeconds) / arr.length, 0);
              
              const stats = [];
              if (totalTokens > 0) stats.push(`${totalTokens} tokens`);
              if (avgDuration > 0) stats.push(`${(avgDuration / 1000).toFixed(1)}s avg`);
              if (avgThinking > 0) stats.push(`${avgThinking.toFixed(1)}s thinking`);
              
              if (stats.length > 0) {
                return `<div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs); padding-top: var(--space-xs); border-top: 1px solid var(--color-border);">${stats.join(' • ')}</div>`;
              }
            }
            return '';
          })()}
        </div>
        
        <!-- Tabs/Threads (if any) - Collapsed by default -->
        ${tabs && tabs.length > 0 ? `
          <div id="conversation-tabs-${threadId}" class="conversation-tabs" style="display: none; margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--color-accent);">
            <div style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text); margin-bottom: var(--space-xs);">
              Tabs (${tabs.length})
            </div>
            ${tabs.slice(0, 5).map(tab => {
              const tabPrompts = tab.prompts || [];
              const tabTitle = tab.title || `Tab ${tab.id.substring(0, 8)}`;
              return `
                <div class="conversation-tab-item" style="margin-bottom: var(--space-xs); padding: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm); cursor: pointer;"
                     onclick="event.stopPropagation(); toggleTabMessages('${threadId}-tab-${tab.id}')"
                     onmouseover="this.style.background='var(--color-bg-alt)'"
                     onmouseout="this.style.background='var(--color-bg)'">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: var(--text-xs); color: var(--color-text);">
                      <span id="tab-icon-${threadId}-tab-${tab.id}" style="display: inline-block; margin-right: 4px; transform: rotate(0deg);"></span>
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
        
        <!-- Messages (if no tabs, show messages directly) - Collapsed by default -->
        ${!tabs || tabs.length === 0 ? `
          <div id="conversation-messages-${threadId}" class="conversation-messages" style="display: none; margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 3px solid var(--color-primary);">
            ${validMessages.length > 0 ? validMessages
              .map(msg => window.renderConversationMessage(msg)).join('') : ''}
          </div>
        ` : ''}
        ${metadataRow || ''}
      </div>
    </div>
  `;


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
      const convData = conv.conversation || conv;
      const title = convData.title || 
                   (window.extractConversationTitle ? window.extractConversationTitle(convData) : null) ||
                   'Conversation';
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
          ${topTitles.map(title => `<span style="font-size: var(--text-xs); color: var(--color-text); padding: 2px 6px; background: var(--color-primary-alpha-10); border-radius: 4px;" title="${window.escapeHtml ? window.escapeHtml(title) : title}">${window.escapeHtml ? window.escapeHtml(title) : title}</span>`).join('')}
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
  
  // Build clearer item count summary
  const itemTypeCounts = [];
  if (eventCounts.events > 0) itemTypeCounts.push(`${eventCounts.events} file change${eventCounts.events !== 1 ? 's' : ''}`);
  if (eventCounts.prompts > 0) itemTypeCounts.push(`${eventCounts.prompts} prompt${eventCounts.prompts !== 1 ? 's' : ''}`);
  if (eventCounts.conversations > 0) itemTypeCounts.push(`${eventCounts.conversations} conversation${eventCounts.conversations !== 1 ? 's' : ''}`);
  if (eventCounts.terminals > 0) itemTypeCounts.push(`${eventCounts.terminals} command${eventCounts.terminals !== 1 ? 's' : ''}`);
  
  const itemSummary = itemTypeCounts.length > 0 
    ? `${totalItems} items (${itemTypeCounts.join(', ')})`
    : `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
  
  return `
    <div class="timeline-item temporal-thread-item">
      <div class="timeline-content">
        <div class="timeline-header clickable" onclick="toggleTemporalThread('${threadId}')">
          <div class="timeline-title">
            <span id="thread-icon-${threadId}" class="timeline-title-icon"></span>
            <span class="timeline-title-text">Activity Session</span>
            <span class="timeline-title-meta">${itemSummary} • ${durationText}</span>
          </div>
          <div class="timeline-meta">${window.formatTimeAgo(actualStartTime)}</div>
        </div>
        <div class="timeline-description">
          <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm); align-items: center; margin-bottom: var(--space-sm);">
            ${workspaceDisplay}
            <span style="font-size: var(--text-sm); color: var(--color-text-muted);">${timeRange}</span>
            ${sessionMetadata.filesChanged.size > 0 ? `
              <span style="font-size: var(--text-sm); color: var(--color-text-muted);">
                ${sessionMetadata.filesChanged.size} file${sessionMetadata.filesChanged.size !== 1 ? 's' : ''} modified
              </span>
            ` : ''}
          </div>
          ${fileSummary}
        </div>
        
        <!-- Thread items (expanded by default) -->
        <div id="thread-items-${threadId}" class="temporal-thread-items visible" style="display: block;">
          ${sortedItems.map((item, index) => {
            // Mark item as being in a thread to suppress workspace badges
            item._inThread = true;
            
            // Add relationship indicators between items
            let relationshipIndicator = '';
            if (index > 0) {
              const prevItem = sortedItems[index - 1];
              // Check if this item is linked to previous item
              if (item.itemType === 'event' && item.prompt_id) {
                const linkedPrompt = sortedItems.find(i => i.itemType === 'prompt' && (i.id === item.prompt_id || i.id === parseInt(item.prompt_id)));
                if (linkedPrompt && Math.abs(item.sortTime - linkedPrompt.sortTime) < 300000) { // 5 min
                  // Calculate color based on file additions/deletions
                  let bgColor = 'var(--color-primary-alpha-10)';
                  let borderColor = 'var(--color-primary)';
                  
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
                        bgColor = 'var(--file-change-add-bg)';
                        borderColor = 'var(--file-change-add-border)';
                      } else if (removeRatio > 0.6) {
                        // Mostly deletions - cool cyan
                        bgColor = 'var(--file-change-remove-bg)';
                        borderColor = 'var(--file-change-remove-border)';
                      } else if (addRatio > removeRatio) {
                        // More additions - warm yellow-orange
                        bgColor = 'var(--file-change-mixed-add-bg)';
                        borderColor = 'var(--file-change-mixed-add-border)';
                      } else if (removeRatio > addRatio) {
                        // More deletions - cool blue
                        bgColor = 'var(--file-change-mixed-remove-bg)';
                        borderColor = 'var(--file-change-mixed-remove-border)';
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
            } else if (item.itemType === 'conversation-turn') {
              itemHtml = window.renderConversationTurnTimelineItem ? window.renderConversationTurnTimelineItem(item, 'left', timelineItems) : '';
            } else if (item.itemType === 'conversation') {
              itemHtml = window.renderConversationThread(item.conversation, 'left');
            } else if (item.itemType === 'prompt') {
              itemHtml = window.renderPromptTimelineItem(item, 'left', timelineItems);
            }
            
            return relationshipIndicator + itemHtml;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}


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
  
  // Flatten structure - show events directly under commit (no file/type subgroups)
  let itemsHtml = '';
  
  // Separate prompts and events for better organization
  const prompts = items.filter(item => item.itemType === 'prompt');
  const events = items.filter(item => item.itemType !== 'prompt');
  
  // Mark prompts as being in commit group to reduce nesting
  prompts.forEach(p => p._inCommitGroup = true);
  
  // Render prompts in compact format if there are many
  let promptsHtml = '';
  if (prompts.length > 0) {
    if (prompts.length > 10) {
      // Collapsible prompt section for many prompts
      const promptSubgroupId = `prompts-${commitId}`;
      const visiblePrompts = prompts.slice(0, 5);
      const hiddenCount = prompts.length - visiblePrompts.length;
      
      const promptsHtmlContent = visiblePrompts.map(prompt => {
        const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
        const displayText = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
        const timestamp = prompt.sortTime || new Date(prompt.timestamp).getTime();
        const time = window.formatTimeAgo(timestamp);
        
        return `
          <div class="commit-prompt-item" onclick="toggleEventDetails('expand-${prompt.id}', 'details-${prompt.id}')" style="padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-xs); background: var(--color-bg); border-left: 2px solid var(--color-accent); border-radius: var(--radius-sm); cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: start; gap: var(--space-sm);">
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.4;">${window.escapeHtml ? window.escapeHtml(displayText) : displayText}</div>
              </div>
              <div style="flex-shrink: 0; font-size: var(--text-xs); color: var(--color-text-muted);">${time}</div>
            </div>
            <div class="timeline-card-details" id="details-${prompt.id}" style="display: none; margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
              <div class="event-details-loading" style="text-align: center; padding: var(--space-md); color: var(--color-text-muted);">Loading details...</div>
            </div>
          </div>
        `;
      }).join('');
      
      promptsHtml = `
        <div class="commit-prompt-section" style="margin-bottom: var(--space-md);">
          <div class="commit-subgroup-header" onclick="toggleCommitSubgroup('${promptSubgroupId}')" style="cursor: pointer; margin-bottom: var(--space-sm);">
            <span class="commit-subgroup-label">AI Prompts</span>
            <span class="commit-subgroup-count">${prompts.length}</span>
            <span class="commit-subgroup-toggle" id="toggle-${promptSubgroupId}"></span>
          </div>
          <div class="commit-subgroup-items" id="items-${promptSubgroupId}" style="display: block;">
            ${promptsHtmlContent}
            ${hiddenCount > 0 ? `
              <div class="prompt-group-more" onclick="event.stopPropagation(); toggleCommitSubgroup('${promptSubgroupId}-more')" 
                   style="padding: var(--space-xs); text-align: center; color: var(--color-primary); cursor: pointer; font-size: var(--text-xs); font-weight: 500; border-top: 1px dashed var(--color-border); margin-top: var(--space-xs);">
                Show ${hiddenCount} more prompt${hiddenCount !== 1 ? 's' : ''} 
              </div>
              <div id="items-${promptSubgroupId}-more" style="display: none;">
                ${prompts.slice(5).map(prompt => {
                  const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
                  const displayText = promptText.length > 100 ? promptText.substring(0, 100) + '...' : promptText;
                  const timestamp = prompt.sortTime || new Date(prompt.timestamp).getTime();
                  const time = window.formatTimeAgo(timestamp);
                  return `
                    <div class="commit-prompt-item" onclick="toggleEventDetails('expand-${prompt.id}', 'details-${prompt.id}')" style="padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-xs); background: var(--color-bg); border-left: 2px solid var(--color-accent); border-radius: var(--radius-sm); cursor: pointer;">
                      <div style="display: flex; justify-content: space-between; align-items: start; gap: var(--space-sm);">
                        <div style="flex: 1; min-width: 0;">
                          <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.4;">${window.escapeHtml ? window.escapeHtml(displayText) : displayText}</div>
                        </div>
                        <div style="flex-shrink: 0; font-size: var(--text-xs); color: var(--color-text-muted);">${time}</div>
                      </div>
                      <div class="timeline-card-details" id="details-${prompt.id}" style="display: none; margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
                        <div class="event-details-loading" style="text-align: center; padding: var(--space-md); color: var(--color-text-muted);">Loading details...</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      // Show all prompts directly for small counts
      promptsHtml = prompts.map(prompt => {
        if (window.renderPromptTimelineItem) {
          return window.renderPromptTimelineItem(prompt, 'left', timelineItems);
        }
        return '';
      }).filter(html => html).join('');
      if (promptsHtml) {
        promptsHtml = `<div class="commit-prompt-section" style="margin-bottom: var(--space-md);">${promptsHtml}</div>`;
      }
    }
  }
  
  // Render events directly (no file/type grouping)
  // Mark items as being in commit group to reduce nesting
  const eventsHtml = events.map(item => {
    item._inCommitGroup = true; // Mark to suppress related prompts display
    if (item.itemType === 'event' || item.itemType === 'code_change' || item.itemType === 'file_change') {
      return window.renderTimelineItem ? 
        window.renderTimelineItem(item, 'left', timelineItems) : '';
    } else if (item.itemType === 'terminal') {
      return window.renderTerminalTimelineItem ? 
        window.renderTerminalTimelineItem(item, 'left', timelineItems) : '';
    } else if (item.itemType === 'status') {
      return window.renderStatusMessageTimelineItem ? 
        window.renderStatusMessageTimelineItem(item, 'left') : '';
    }
    return window.renderTimelineItem ? 
      window.renderTimelineItem(item, 'left', timelineItems) : '';
  }).filter(html => html).join('');
  
  itemsHtml = promptsHtml + eventsHtml;
  
  // Start expanded by default for better visibility
  const startCollapsed = false;
  
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
        <span class="commit-group-toggle" id="toggle-${commitId}">${startCollapsed ? '' : ''}</span>
      </div>
      <div class="commit-group-items" id="items-${commitId}" style="display: ${startCollapsed ? 'none' : 'block'};">
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
    toggle.textContent = isExpanded ? '' : '';
  }
};

// Toggle function for commit subgroups (file/type groups)
window.toggleCommitSubgroup = function(subgroupId) {
  const itemsContainer = document.getElementById(`items-${subgroupId}`);
  const toggle = document.getElementById(`toggle-${subgroupId}`);
  if (itemsContainer && toggle) {
    const isExpanded = itemsContainer.style.display !== 'none';
    itemsContainer.style.display = isExpanded ? 'none' : 'block';
    toggle.textContent = isExpanded ? '' : '';
  }
};

// Toggle function for prompt groups (show/hide additional prompts)
window.togglePromptGroup = function(groupId) {
  const hiddenContainer = document.getElementById(`prompt-group-${groupId}`);
  if (!hiddenContainer) return;
  
  const moreButton = hiddenContainer.previousElementSibling;
  if (!moreButton || !moreButton.classList.contains('prompt-group-more')) return;
  
  const isExpanded = hiddenContainer.style.display !== 'none';
  hiddenContainer.style.display = isExpanded ? 'none' : 'block';
  const hiddenCount = hiddenContainer.querySelectorAll('.commit-prompt-item').length;
  moreButton.textContent = isExpanded 
    ? `Show ${hiddenCount} more prompt${hiddenCount !== 1 ? 's' : ''} `
    : `Hide ${hiddenCount} prompt${hiddenCount !== 1 ? 's' : ''} `;
};

// Toggle function for event details (inline expansion)
window.toggleEventDetails = async function(toggleId, detailsId) {
  const toggle = document.getElementById(toggleId);
  const detailsContainer = document.getElementById(detailsId);
  
  if (!toggle || !detailsContainer) return;
  
  const isExpanded = detailsContainer.style.display !== 'none';
  
  if (isExpanded) {
    // Collapse
    detailsContainer.style.display = 'none';
    toggle.textContent = '';
    toggle.style.transform = 'rotate(0deg)';
  } else {
    // Expand - load details if not already loaded
    detailsContainer.style.display = 'block';
    toggle.textContent = '';
    toggle.style.transform = 'rotate(180deg)';
    
    // Check if details are already loaded
    const loadingEl = detailsContainer.querySelector('.event-details-loading');
    if (loadingEl) {
      // Extract event ID from detailsId (format: details-{eventId})
      const eventId = detailsId.replace('details-', '');
      
      // Load event details using modal manager's logic
      if (window.modalManager) {
        try {
          // Try to find as event first
          let event = window.state?.data?.events?.find(e => 
            String(e.id) === String(eventId) || 
            String(e.timestamp) === String(eventId)
          );
          
          // If not found as event, try as prompt
          let prompt = null;
          if (!event) {
            prompt = window.state?.data?.prompts?.find(p => 
              String(p.id) === String(eventId) || 
              String(p.timestamp) === String(eventId)
            );
            if (prompt) {
              // Treat prompt as event for display purposes
              event = prompt;
            }
          }
          
          // If still not found, try as terminal command
          let terminalCmd = null;
          if (!event && !prompt) {
            const terminalCommands = window.state.data?.terminalCommands || window.state.data?.terminals || [];
            terminalCmd = terminalCommands.find(c => 
              String(c.id) === String(eventId) || 
              String(c.timestamp) === String(eventId)
            );
            if (terminalCmd) {
              event = terminalCmd;
            }
          }
          
          // If still not found, try as conversation turn
          let conversationTurn = null;
          if (!event && !prompt && !terminalCmd) {
            const conversations = window.state.data?.cursorConversations || [];
            for (const conv of conversations) {
              if (conv.messages) {
                conversationTurn = conv.messages.find(m => 
                  String(m.id) === String(eventId) || 
                  String(m.timestamp) === String(eventId)
                );
                if (conversationTurn) break;
              }
            }
            if (conversationTurn) {
              event = conversationTurn;
            }
          }
          
            if (event) {
            // Check if this is a file change event with diff data
            const eventDetails = typeof event.details === 'string' ? JSON.parse(event.details || '{}') : (event.details || {});
            const beforeContent = eventDetails.before_content || eventDetails.before_code || '';
            const afterContent = eventDetails.after_content || eventDetails.after_code || '';
            const hasDiff = beforeContent || afterContent;
            
            // If it's a terminal command, use terminal modal HTML builder
            if (terminalCmd) {
              const isError = (terminalCmd.exit_code !== null && terminalCmd.exit_code !== undefined && terminalCmd.exit_code !== 0);
              const terminalHTML = window.modalManager._buildTerminalModalHTML ? 
                window.modalManager._buildTerminalModalHTML(terminalCmd, isError) :
                `<div style="padding: var(--space-lg);">
                  <h4>Terminal Command</h4>
                  <pre style="background: var(--color-bg); padding: var(--space-md); border-radius: var(--radius-md); font-family: var(--font-mono);">${(window.escapeHtml || ((s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')))(terminalCmd.command || terminalCmd.text || '')}</pre>
                  ${terminalCmd.exit_code !== undefined ? `<div>Exit Code: ${terminalCmd.exit_code}</div>` : ''}
                  ${terminalCmd.cwd ? `<div>Working Directory: ${terminalCmd.cwd}</div>` : ''}
                </div>`;
              
              detailsContainer.innerHTML = terminalHTML;
              return;
            }
            
            // If it's a file change with diff, render Git-style diff
            if (hasDiff && (event.type === 'file_change' || event.type === 'code_change')) {
              try {
                const diffHTML = window.renderGitDiff ? window.renderGitDiff(
                  beforeContent,
                  afterContent,
                  {
                    maxLines: 100,
                    showLineNumbers: true,
                    collapseUnchanged: true,
                    filePath: eventDetails.file_path || event.file_path || '',
                    escapeHtml: window.escapeHtml || ((text) => {
                      const div = document.createElement('div');
                      div.textContent = text;
                      return div.innerHTML;
                    })
                  }
                ) : '';
                
                detailsContainer.innerHTML = `
                  <div style="padding: var(--space-md);">
                    <h4 style="margin-bottom: var(--space-md); color: var(--color-text); font-size: var(--text-base);">Code Changes</h4>
                    ${diffHTML}
                  </div>
                `;
                return;
              } catch (error) {
                console.error('Error rendering diff:', error);
                // Fall through to default rendering
              }
            }
            
            // If it's a conversation turn, build simple HTML
            if (conversationTurn) {
              const turnHTML = `
                <div style="padding: var(--space-lg);">
                  <h4>Conversation Message</h4>
                  <div style="padding: var(--space-md); background: var(--color-bg); border-radius: var(--radius-md);">
                    <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.6; white-space: pre-wrap;">
                      ${(window.escapeHtml || ((s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')))(conversationTurn.text || conversationTurn.content || conversationTurn.prompt || '')}
                    </div>
                  </div>
                  <div style="margin-top: var(--space-md); font-size: var(--text-xs); color: var(--color-text-muted);">
                    Time: ${new Date(conversationTurn.timestamp).toLocaleString()}
                  </div>
                </div>
              `;
              detailsContainer.innerHTML = turnHTML;
              return;
            }
            
            // If it's a prompt, use prompt modal HTML builder
            if (prompt) {
              const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || '';
              
              // Find linked code change
              let linkedCodeChange = null;
              let codeDetails = null;
              if (prompt.linked_entry_id && window.state.data.events) {
                linkedCodeChange = window.state.data.events.find(e => 
                  e.id === prompt.linked_entry_id || e.id === parseInt(prompt.linked_entry_id)
                );
                if (linkedCodeChange) {
                  codeDetails = typeof linkedCodeChange.details === 'string' 
                    ? JSON.parse(linkedCodeChange.details) 
                    : linkedCodeChange.details;
                }
              }
              
              const promptHTML = window.modalManager._buildPromptModalHTML(
                prompt,
                promptText,
                linkedCodeChange,
                codeDetails
              );
              
              detailsContainer.innerHTML = promptHTML;
              
              // Initialize lazy loading
              if (window.modalManager._initializeLazyLoading) {
                window.modalManager._initializeLazyLoading(detailsContainer);
              }
              
              return;
            }
            
            // Otherwise, handle as regular event
            // Use modal manager to build the HTML (but don't show modal)
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            
            // Fetch related data
            let relatedScreenshots = [];
            try {
              const screenshotsResponse = await fetch(`http://localhost:43917/api/screenshots/near/${event.timestamp}`);
              if (screenshotsResponse.ok) {
                const screenshotsData = await screenshotsResponse.json();
                if (screenshotsData.success) {
                  relatedScreenshots = screenshotsData.screenshots;
                }
              }
            } catch (e) {
              // Ignore screenshot errors
            }
            
            // Find related prompts
            const relatedPrompts = window.findRelatedPrompts ? window.findRelatedPrompts(event) : [];
            
            // Find related conversations
            const conversationsArray = Array.isArray(window.state.data.cursorConversations) ? window.state.data.cursorConversations : [];
            const eventTime = new Date(event.timestamp).getTime();
            const relatedConversations = conversationsArray.filter(c => {
              if (!c || !c.timestamp) return false;
              if (c.id && (
                c.id.includes('backgroundComposer.persistentData') ||
                c.id.includes('backgroundComposer.windowBcMapping') ||
                c.id.includes('workbench.backgroundComposer')
              )) {
                return false;
              }
              const convTime = new Date(c.timestamp).getTime();
              const diff = Math.abs(eventTime - convTime);
              return diff < 10 * 60 * 1000;
            });
            
            // Find linked prompt
            let linkedPrompt = null;
            if (event.prompt_id && window.state.data.prompts) {
              linkedPrompt = window.state.data.prompts.find(p => 
                p.id === event.prompt_id || p.id === parseInt(event.prompt_id)
              );
            }
            
            // Find related terminal commands
            const terminalCommands = window.state.data?.terminalCommands || window.state.data?.terminals || [];
            const filePath = details?.file_path || event.file_path || '';
            const relatedTerminalCommands = terminalCommands.filter(cmd => {
              if (!cmd || !cmd.timestamp) return false;
              const cmdTime = new Date(cmd.timestamp).getTime();
              const timeDiff = Math.abs(eventTime - cmdTime);
              if (timeDiff > 5 * 60 * 1000) return false;
              if (filePath) {
                const cmdText = (cmd.command || cmd.text || '').toLowerCase();
                const fileName = filePath.split('/').pop().toLowerCase();
                const dirName = filePath.split('/').slice(-2, -1)[0]?.toLowerCase() || '';
                if (cmdText.includes(fileName) || (dirName && cmdText.includes(dirName))) {
                  return true;
                }
                if (cmd.cwd && filePath.includes(cmd.cwd)) {
                  return true;
                }
              }
              return true;
            }).slice(0, 10);
            
            // Build HTML using modal manager
            const detailsHTML = window.modalManager._buildEventModalHTML(
              event, 
              details, 
              relatedScreenshots, 
              relatedPrompts, 
              relatedConversations, 
              linkedPrompt, 
              relatedTerminalCommands
            );
            
            // Check if we have tabs - if so, insert into event tab content, otherwise replace entire container
            const eventContentId = `content-event-${event.id || event.timestamp}`;
            const eventContentContainer = document.getElementById(eventContentId);
            if (eventContentContainer) {
              // Insert into event tab content
              eventContentContainer.innerHTML = detailsHTML;
            } else {
              // No tabs, replace entire container
              detailsContainer.innerHTML = detailsHTML;
            }
            
            // Initialize lazy loading for images
            if (window.modalManager._initializeLazyLoading) {
              window.modalManager._initializeLazyLoading(detailsContainer);
            }
          } else {
            detailsContainer.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">Event not found</div>';
          }
        } catch (error) {
          console.error('[TOGGLE] Error loading event details:', error);
          detailsContainer.innerHTML = `<div style="padding: var(--space-lg); text-align: center; color: var(--color-error);">Error loading details: ${error.message}</div>`;
        }
      } else {
        detailsContainer.innerHTML = '<div style="padding: var(--space-lg); text-align: center; color: var(--color-text-muted);">Details not available</div>';
      }
    }
  }
};

/**
 * Switch between event detail tabs
 */
window.switchEventDetailTab = function(eventId, tabName) {
  const eventTabId = `tab-event-${eventId}`;
  const promptsTabId = `tab-prompts-${eventId}`;
  const eventContentId = `content-event-${eventId}`;
  const promptsContentId = `content-prompts-${eventId}`;
  
  const eventTab = document.getElementById(eventTabId);
  const promptsTab = document.getElementById(promptsTabId);
  const eventContent = document.getElementById(eventContentId);
  const promptsContent = document.getElementById(promptsContentId);
  
  if (!eventTab || !promptsTab || !eventContent || !promptsContent) return;
  
  if (tabName === 'event') {
    // Show event tab
    eventTab.classList.add('active');
    eventTab.style.borderBottom = '2px solid var(--color-primary)';
    eventTab.style.color = 'var(--color-primary)';
    eventTab.style.fontWeight = '500';
    eventContent.style.display = 'block';
    
    // Hide prompts tab
    promptsTab.classList.remove('active');
    promptsTab.style.borderBottom = '2px solid transparent';
    promptsTab.style.color = 'var(--color-text-muted)';
    promptsTab.style.fontWeight = 'normal';
    promptsContent.style.display = 'none';
    
    // Load event details if not already loaded
    if (eventContent.innerHTML.includes('Loading details...')) {
      const detailsId = `details-${eventId}`;
      const expandId = `expand-${eventId}`;
      // Trigger details load
      setTimeout(() => {
        if (window.toggleEventDetails) {
          // Get the event from state
          const event = window.state?.data?.events?.find(e => (e.id || e.timestamp) == eventId);
          if (event) {
            // Manually trigger details load
            const detailsContainer = document.getElementById(detailsId);
            if (detailsContainer) {
              // Find the event content container within details
              const eventContentContainer = document.getElementById(eventContentId);
              if (eventContentContainer) {
                // Load details into event tab
                loadEventDetailsIntoContainer(event, eventContentContainer);
              }
            }
          }
        }
      }, 100);
    }
  } else if (tabName === 'prompts') {
    // Show prompts tab
    promptsTab.classList.add('active');
    promptsTab.style.borderBottom = '2px solid var(--color-primary)';
    promptsTab.style.color = 'var(--color-primary)';
    promptsTab.style.fontWeight = '500';
    promptsContent.style.display = 'block';
    
    // Hide event tab
    eventTab.classList.remove('active');
    eventTab.style.borderBottom = '2px solid transparent';
    eventTab.style.color = 'var(--color-text-muted)';
    eventTab.style.fontWeight = 'normal';
    eventContent.style.display = 'none';
  }
};

/**
 * Helper to load event details into a specific container
 */
async function loadEventDetailsIntoContainer(event, container) {
  if (!event || !container) return;
  
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    
    // Fetch related data
    let relatedScreenshots = [];
    try {
      const screenshotsResponse = await fetch(`http://localhost:43917/api/screenshots/near/${event.timestamp}`);
      if (screenshotsResponse.ok) {
        const screenshotsData = await screenshotsResponse.json();
        if (screenshotsData.success) {
          relatedScreenshots = screenshotsData.screenshots;
        }
      }
    } catch (e) {
      // Ignore screenshot errors
    }
    
    // Find related prompts
    const relatedPrompts = window.findRelatedPrompts ? window.findRelatedPrompts(event) : [];
    
    // Find related conversations
    const conversationsArray = Array.isArray(window.state.data.cursorConversations) ? window.state.data.cursorConversations : [];
    const eventTime = new Date(event.timestamp).getTime();
    const relatedConversations = conversationsArray.filter(c => {
      if (!c || !c.timestamp) return false;
      const convTime = new Date(c.timestamp).getTime();
      const diff = Math.abs(eventTime - convTime);
      return diff < 10 * 60 * 1000;
    });
    
    // Find linked prompt
    let linkedPrompt = null;
    if (event.prompt_id && window.state.data.prompts) {
      linkedPrompt = window.state.data.prompts.find(p => 
        p.id === event.prompt_id || p.id === parseInt(event.prompt_id)
      );
    }
    
    // Find related terminal commands
    const terminalCommands = window.state.data?.terminalCommands || window.state.data?.terminals || [];
    const filePath = details?.file_path || event.file_path || '';
    const relatedTerminalCommands = terminalCommands.filter(cmd => {
      if (!cmd || !cmd.timestamp) return false;
      const cmdTime = new Date(cmd.timestamp).getTime();
      const timeDiff = Math.abs(eventTime - cmdTime);
      if (timeDiff > 5 * 60 * 1000) return false;
      if (filePath) {
        const cmdText = (cmd.command || cmd.text || '').toLowerCase();
        const fileName = filePath.split('/').pop().toLowerCase();
        const dirName = filePath.split('/').slice(-2, -1)[0]?.toLowerCase() || '';
        if (cmdText.includes(fileName) || (dirName && cmdText.includes(dirName))) {
          return true;
        }
        if (cmd.cwd && filePath.includes(cmd.cwd)) {
          return true;
        }
      }
      return true;
    }).slice(0, 10);
    
    // Build HTML using modal manager
    const detailsHTML = window.modalManager._buildEventModalHTML(
      event, 
      details, 
      relatedScreenshots, 
      relatedPrompts, 
      relatedConversations, 
      linkedPrompt, 
      relatedTerminalCommands
    );
    
    container.innerHTML = detailsHTML;
    
    // Initialize lazy loading for images
    if (window.modalManager._initializeLazyLoading) {
      window.modalManager._initializeLazyLoading(container);
    }
  } catch (error) {
    console.error('[LOAD-DETAILS] Error loading event details:', error);
    container.innerHTML = `<div style="padding: var(--space-lg); text-align: center; color: var(--color-error);">Error loading details: ${error.message}</div>`;
  }
}

/**
 * Render a consolidated prompt group
 */
function renderPromptGroup(group, side = 'left', timelineItems = null) {
  const groupId = `prompt-group-${group.sortTime || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const workspaceName = group.workspace ? (group.workspace.split('/').pop() || group.workspace) : '';
  const time = window.formatTimeAgo ? window.formatTimeAgo(group.sortTime || new Date(group.timestamp).getTime()) : 
               new Date(group.timestamp).toLocaleTimeString();
  
  // Get first few prompts for preview
  const previewPrompts = group.items.slice(0, 3);
  const remainingCount = group.items.length - previewPrompts.length;
  
  // Determine group title
  let groupTitle = 'Multiple Prompts';
  if (group.isUntitled) {
    groupTitle = 'Untitled Conversations';
  } else if (group.items[0]?.conversationTitle) {
    groupTitle = group.items[0].conversationTitle;
  }
  
  return `
    <div class="timeline-card timeline-item-${side} prompt-group-card" data-group-id="${groupId}">
      <div class="timeline-card-content">
        <div class="timeline-card-header" onclick="togglePromptGroup('${groupId}')" style="cursor: pointer;">
          <div class="timeline-card-title">
            <span style="font-weight: 600; color: var(--color-text);">${window.escapeHtml ? window.escapeHtml(groupTitle) : groupTitle}</span>
            <span class="badge" style="background: var(--color-primary); color: white; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: var(--space-xs);">
              ${group.items.length} prompts
            </span>
          </div>
          <div class="timeline-meta" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span>${time}</span>
            ${workspaceName ? `<span class="badge" style="background: var(--color-success); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}</span>` : ''}
            <button class="timeline-card-toggle" id="toggle-${groupId}" 
                    onclick="event.stopPropagation(); togglePromptGroup('${groupId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle group">
              
            </button>
          </div>
        </div>
        <div class="prompt-group-preview" id="preview-${groupId}">
          ${previewPrompts.map((prompt, idx) => {
            const promptText = (prompt.text || prompt.prompt || prompt.content || '').substring(0, 100);
            return `
              <div style="padding: var(--space-xs); margin-top: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 2px solid var(--color-primary);">
                <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.4;">
                  ${window.escapeHtml ? window.escapeHtml(promptText) : promptText}${promptText.length >= 100 ? '...' : ''}
                </div>
              </div>
            `;
          }).join('')}
          ${remainingCount > 0 ? `
            <div style="text-align: center; font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs); padding: var(--space-xs);">
              +${remainingCount} more prompt${remainingCount !== 1 ? 's' : ''}
            </div>
          ` : ''}
        </div>
        <div class="prompt-group-items" id="items-${groupId}" style="display: none;">
          ${group.items.map(prompt => {
            return window.renderPromptTimelineItem ? window.renderPromptTimelineItem(prompt, 'left', timelineItems) : '';
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.renderIntegratedChunk = renderIntegratedChunk;
  window.renderFileChangeGroup = renderFileChangeGroup;
  window.renderConversationThread = renderConversationThread;
  window.renderTemporalThread = renderTemporalThread;
  window.renderCommitGroup = renderCommitGroup;
  window.renderPromptGroup = renderPromptGroup;
}
}
}
}
}
