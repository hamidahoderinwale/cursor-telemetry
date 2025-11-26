/**
 * Timeline Item Renderers
 * Individual item rendering functions for timeline
 * 
 * Dependencies:
 * - timeline-utils.js (extractContextFiles, extractAtFiles, getEventTitle, etc.)
 */

function renderConversationTurnTimelineItem(turn, side = 'left', timelineItems = null) {
  const isUser = turn.isUser || turn.role === 'user';
  const isAssistant = turn.isAssistant || turn.role === 'assistant';
  const time = window.formatTimeAgo ? window.formatTimeAgo(turn.timestamp || turn.created_at) : new Date(turn.timestamp || turn.created_at).toLocaleTimeString();
  const text = turn.content || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  // Extract timing metadata
  const thinkingTime = turn.thinkingTimeSeconds || turn.thinking_time_seconds || 0;
  const requestDuration = turn.request_duration_ms || turn.requestDurationMs;
  const timeToFirstToken = turn.time_to_first_token_ms || turn.timeToFirstTokenMs;
  const tokens = turn.total_tokens || turn.totalTokens || 0;
  const promptTokens = turn.prompt_tokens || 0;
  const completionTokens = turn.completion_tokens || 0;
  const modelName = turn.model_name || turn.modelName;
  const modelProvider = turn.model_provider;
  const streaming = turn.streaming;
  const codeBlocks = turn.code_blocks || [];
  const contextFiles = turn.context_files || [];
  const referencedFiles = turn.referenced_files || [];
  
  // Conversation metadata
  const conversationId = turn.conversationId;
  const conversationTitle = turn.conversationTitle || 'Conversation';
  const turnIndex = turn.turnIndex || 0;
  
  // Workspace badge (suppress if in a thread to avoid redundancy)
  const workspaceName = turn.workspace?.name || (turn.workspace_path ? turn.workspace_path.split('/').pop() : '');
  const workspaceBadge = (!turn._inThread && workspaceName) ? `<span class="badge" style="background: var(--color-success); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}</span>` : '';
  
  // Find related file changes and terminal commands (causal linking)
  let relatedFileChanges = [];
  let relatedTerminalCommands = [];
  if (timelineItems && isAssistant) {
    // Look for file changes and terminal commands that happened shortly after this assistant response
    const turnTime = turn.sortTime || new Date(turn.timestamp).getTime();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    relatedFileChanges = timelineItems.filter(item => {
      if (item.itemType !== 'event' || item.type !== 'file_change') return false;
      const itemTime = item.sortTime || new Date(item.timestamp).getTime();
      return itemTime > turnTime && itemTime <= turnTime + timeWindow;
    }).slice(0, 3); // Limit to 3 most recent
    
    relatedTerminalCommands = timelineItems.filter(item => {
      if (item.itemType !== 'terminal') return false;
      const itemTime = item.sortTime || (typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime());
      return itemTime > turnTime && itemTime <= turnTime + timeWindow;
    }).slice(0, 2); // Limit to 2 most recent
  }
  
  // Visual indicator for thinking time (before assistant responses)
  // This creates a visual gap showing the thinking period
  let thinkingTimeIndicator = '';
  if (isAssistant && thinkingTime > 0) {
    const thinkingTimeMs = thinkingTime * 1000;
    const thinkingTimeDisplay = thinkingTime > 1 ? `${thinkingTime.toFixed(1)}s` : `${(thinkingTimeMs).toFixed(0)}ms`;
    // Create a visual gap indicator before the response
    thinkingTimeIndicator = `
      <div class="thinking-time-gap" style="margin-bottom: var(--space-sm); padding: var(--space-xs) var(--space-sm); background: linear-gradient(90deg, transparent, var(--color-warning), transparent); opacity: 0.3; border-radius: var(--radius-sm); position: relative;">
        <div class="thinking-time-indicator" style="position: absolute; left: 50%; transform: translateX(-50%); padding: 0.25rem 0.5rem; background: var(--color-warning); color: var(--color-text); border-radius: var(--radius-sm); font-size: var(--text-xs); display: inline-flex; align-items: center; gap: var(--space-xs); white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <span></span>
          <span>Thinking: ${thinkingTimeDisplay}</span>
        </div>
      </div>
    `;
  }
  
  // Response duration bar (for assistant responses)
  let durationBar = '';
  if (isAssistant && requestDuration) {
    const durationSeconds = (requestDuration / 1000).toFixed(2);
    const ttfSeconds = timeToFirstToken ? (timeToFirstToken / 1000).toFixed(2) : null;
    
    durationBar = `
      <div class="response-duration-bar" style="margin-top: var(--space-sm); padding: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm);">
        <div style="display: flex; align-items: center; gap: var(--space-sm); font-size: var(--text-xs); color: var(--color-text-muted);">
          <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <span>[T]</span>
            <span>Total: ${durationSeconds}s</span>
          </span>
          ${ttfSeconds ? `
            <span style="display: inline-flex; align-items: center; gap: 0.25rem;">
              <span>[Fast]</span>
              <span>TTF: ${ttfSeconds}s</span>
            </span>
          ` : ''}
          ${streaming ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span></span><span>Streaming</span></span>` : ''}
        </div>
        ${requestDuration ? `
          <div style="margin-top: var(--space-xs); height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden; position: relative;">
            <div style="height: 100%; width: 100%; background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary-light) 100%); border-radius: 2px;"></div>
            ${timeToFirstToken ? `
              <div style="position: absolute; left: ${(timeToFirstToken / requestDuration) * 100}%; top: 0; bottom: 0; width: 2px; background: var(--color-warning);"></div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Context files indicator with snapshot
  let contextIndicator = '';
  if (contextFiles.length > 0 || referencedFiles.length > 0) {
    const contextCount = contextFiles.length;
    const referencedCount = referencedFiles.length;
    const totalContextTokens = promptTokens; // Use prompt tokens as proxy for context size
    
    // Calculate context window utilization (approximate)
    const contextWindowSize = 128000; // Default context window size (adjust based on model)
    const contextUtilization = totalContextTokens > 0 ? Math.min(100, (totalContextTokens / contextWindowSize) * 100) : 0;
    const utilizationColor = contextUtilization > 80 ? 'var(--color-error)' : contextUtilization > 60 ? 'var(--color-warning)' : 'var(--color-success)';
    
    contextIndicator = `
      <div class="context-snapshot-indicator" style="margin-top: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm); border-left: 2px solid var(--color-primary);">
        <div style="display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-xs);">
          <span style="font-size: var(--text-xs); font-weight: 600; color: var(--color-text);">Context Snapshot</span>
          ${contextCount > 0 ? `<span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); font-size: var(--text-xs);"> ${contextCount} file${contextCount !== 1 ? 's' : ''}</span>` : ''}
          ${referencedCount > 0 ? `<span class="badge" style="background: var(--color-accent); color: var(--badge-text-on-accent); font-size: var(--text-xs);">[Link] ${referencedCount} referenced</span>` : ''}
          ${totalContextTokens > 0 ? `<span class="badge" style="background: ${utilizationColor}; color: var(--badge-text-on-primary); font-size: var(--text-xs);">${totalContextTokens.toLocaleString()} tokens (${contextUtilization.toFixed(0)}%)</span>` : ''}
        </div>
        ${contextFiles.length > 0 ? `
          <div style="margin-top: var(--space-xs);">
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 500; cursor: pointer;" 
                  onclick="event.stopPropagation(); toggleContextFiles('${turn.id}')">
              ${contextFiles.length > 3 ? `Show ${contextFiles.length} context files ` : 'Context files:'}
            </span>
            <div id="context-files-${turn.id}" style="${contextFiles.length > 3 ? 'display: none;' : 'display: block;'} margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-surface); border-radius: var(--radius-sm); font-size: var(--text-xs); max-height: 200px; overflow-y: auto;">
              ${contextFiles.map(file => {
                const fileName = file.split('/').pop();
                return `
                  <div style="padding: 0.25rem 0; color: var(--color-text-muted); display: flex; align-items: center; gap: var(--space-xs);">
                    <span></span>
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.escapeHtml ? window.escapeHtml(file) : file}">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
        ${referencedFiles.length > 0 ? `
          <div style="margin-top: var(--space-xs);">
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 500;">Referenced files:</span>
            <div style="margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-surface); border-radius: var(--radius-sm); font-size: var(--text-xs); max-height: 150px; overflow-y: auto;">
              ${referencedFiles.slice(0, 5).map(file => {
                const fileName = file.split('/').pop();
                return `
                  <div style="padding: 0.25rem 0; color: var(--color-text-muted); display: flex; align-items: center; gap: var(--space-xs);">
                    <span>[Link]</span>
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${window.escapeHtml ? window.escapeHtml(file) : file}">${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</span>
                  </div>
                `;
              }).join('')}
              ${referencedFiles.length > 5 ? `<div style="padding: 0.25rem 0; color: var(--color-text-subtle); font-style: italic;">+${referencedFiles.length - 5} more</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // Related file changes and terminal commands
  let relatedItemsIndicator = '';
  if (relatedFileChanges.length > 0 || relatedTerminalCommands.length > 0) {
    relatedItemsIndicator = `
      <div class="related-items-indicator" style="margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
        ${relatedFileChanges.length > 0 ? `
          <div style="margin-bottom: var(--space-xs);">
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 500;">Related file changes:</span>
            ${relatedFileChanges.map(change => {
              const details = typeof change.details === 'string' ? JSON.parse(change.details) : change.details;
              const filePath = details?.file_path || change.file_path || '';
              const fileName = filePath ? filePath.split('/').pop() : 'Unknown file';
              return `
                <div style="margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm); cursor: pointer;"
                     onclick="event.stopPropagation(); showEventModal('${change.id}')">
                  <span style="font-size: var(--text-xs); color: var(--color-text);">[Note] ${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        ${relatedTerminalCommands.length > 0 ? `
          <div>
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 500;">Related commands:</span>
            ${relatedTerminalCommands.map(cmd => {
              const commandText = cmd.command || 'Unknown command';
              const shortCommand = commandText.length > 50 ? commandText.substring(0, 50) + '...' : commandText;
              return `
                <div style="margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm); cursor: pointer;"
                     onclick="event.stopPropagation(); showEventModal('${cmd.id}')">
                  <span style="font-size: var(--text-xs); color: var(--color-text); font-family: monospace;">[Code] ${window.escapeHtml ? window.escapeHtml(shortCommand) : shortCommand}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  const turnExpandId = `expand-${turn.id}`;
  const turnDetailsId = `details-${turn.id}`;
  
  // Use the same style as prompt timeline items for consistency
  const borderColor = isUser ? 'var(--color-primary, #3b82f6)' : 'var(--color-accent, #8b5cf6)';
  const bgColor = isUser ? 'var(--color-primary-alpha-05, rgba(59, 130, 246, 0.05))' : 'var(--color-secondary-alpha-05, rgba(139, 92, 246, 0.05))';
  
  return `
    <div class="timeline-card timeline-item-${side} prompt-timeline-item" style="border-left: 3px solid ${borderColor}; background: ${bgColor};">
      ${thinkingTimeIndicator}
      <div class="timeline-card-content">
        <div class="timeline-card-header" onclick="toggleEventDetails('${turnExpandId}', '${turnDetailsId}')" style="cursor: pointer;">
          <div class="timeline-card-title-section">
            <div class="timeline-card-title">
              <span class="timeline-file-name">${isUser ? 'You' : 'AI Assistant'}</span>
              ${conversationTitle && turnIndex === 0 ? `<span class="timeline-file-stats" style="margin-left: var(--space-xs); color: var(--color-text-muted); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(conversationTitle) : conversationTitle}</span>` : ''}
            </div>
          </div>
          <div class="timeline-card-meta" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span class="timeline-time">${time}</span>
            <button class="timeline-card-toggle" id="${turnExpandId}" onclick="event.stopPropagation(); toggleEventDetails('${turnExpandId}', '${turnDetailsId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle details">
              
            </button>
          </div>
        </div>
        <div class="timeline-card-body">
          <div class="timeline-card-description" style="line-height: 1.6; color: var(--color-text); white-space: pre-wrap; word-wrap: break-word;">${window.escapeHtml ? window.escapeHtml(displayText) : displayText}</div>
          
          ${codeBlocks.length > 0 ? `
            <div class="conversation-code-blocks" style="margin-top: var(--space-sm);">
              ${codeBlocks.slice(0, 2).map((block, idx) => `
                <div class="code-block" style="margin: 0.5rem 0; border: 1px solid var(--code-border); border-radius: 4px; overflow: hidden; background: var(--code-bg);">
                  ${block.file ? `<div style="padding: 0.25rem 0.5rem; background: var(--code-header-bg); font-size: 0.7rem; color: var(--code-text); font-family: monospace;">${window.escapeHtml ? window.escapeHtml(block.file) : block.file}</div>` : ''}
                  <pre style="margin: 0; padding: 0.75rem; overflow-x: auto; font-size: 0.8rem;"><code class="language-${block.language || 'text'}" style="color: var(--code-text);">${window.escapeHtml ? window.escapeHtml(block.code.substring(0, 200)) : block.code.substring(0, 200)}${block.code.length > 200 ? '...' : ''}</code></pre>
                </div>
              `).join('')}
              ${codeBlocks.length > 2 ? `<div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-xs);">+${codeBlocks.length - 2} more code blocks</div>` : ''}
            </div>
          ` : ''}
          
          <div class="timeline-card-tags" style="display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: center; margin-top: var(--space-sm);">
            ${workspaceBadge}
            ${modelName ? `<span class="badge" style="background: var(--color-primary); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(modelName) : modelName}</span>` : ''}
            ${tokens > 0 ? `<span class="badge" style="background: var(--color-accent); color: var(--badge-text-on-accent); font-size: var(--text-xs);">${tokens} tokens</span>` : ''}
          </div>
          
          ${durationBar}
          ${contextIndicator}
          ${relatedItemsIndicator}
          
          ${text.length > 300 ? `<button class="conversation-message-read-more" onclick="event.stopPropagation(); toggleEventDetails('${turnExpandId}', '${turnDetailsId}')" style="margin-top: var(--space-sm); padding: 0.25rem 0.5rem; background: transparent; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; font-size: 0.75rem; color: var(--color-primary);">Read more</button>` : ''}
        </div>
        <div class="timeline-card-details" id="${turnDetailsId}" style="display: none; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
          <div class="event-details-loading" style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
            Loading details...
          </div>
        </div>
      </div>
    </div>
  `;
}


function renderConversationMessage(message) {
  const isUser = message.messageRole === 'user' || message.role === 'user';
  const time = window.formatTimeAgo ? window.formatTimeAgo(message.timestamp || message.created_at) : new Date(message.timestamp || message.created_at).toLocaleTimeString();
  const text = message.text || message.content || 'No message text';
  const displayText = text.length > 300 ? text.substring(0, 300) + '...' : text;
  
  // Extract timing metadata
  const thinkingTime = message.thinkingTimeSeconds || message.thinking_time_seconds;
  const requestDuration = message.request_duration_ms || message.requestDurationMs;
  const timeToFirstToken = message.time_to_first_token_ms || message.timeToFirstTokenMs;
  const tokens = message.total_tokens || message.totalTokens;
  const promptTokens = message.prompt_tokens || 0;
  const completionTokens = message.completion_tokens || 0;
  const modelName = message.model_name || message.modelName;
  const codeBlocks = message.code_blocks ? (typeof message.code_blocks === 'string' ? JSON.parse(message.code_blocks) : message.code_blocks) : [];
  
  return `
    <div class="conversation-message ${isUser ? 'user' : 'ai'}" style="margin-bottom: 1rem; padding: 0.75rem; border-radius: 6px; background: ${isUser ? 'var(--color-primary-alpha-10)' : 'var(--color-secondary-alpha-10)'}; border-left: 3px solid ${isUser ? 'var(--color-primary)' : 'var(--color-secondary)'};">
      <div class="conversation-message-header" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
        <span class="conversation-message-icon" style="width: 8px; height: 8px; border-radius: 50%; background: ${isUser ? 'var(--color-primary)' : 'var(--color-secondary)'};"></span>
        <span class="conversation-message-author" style="font-weight: 600; color: var(--color-text);">${isUser ? 'You' : 'AI Assistant'}</span>
        <span class="conversation-message-time" style="font-size: 0.75rem; color: var(--color-text-muted);">${time}</span>
        ${modelName ? `<span class="badge" style="background: var(--color-primary); color: var(--badge-text-on-primary); font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 500;">${window.escapeHtml ? window.escapeHtml(modelName) : modelName}</span>` : ''}
        ${thinkingTime && thinkingTime > 0 ? `<span class="badge" style="background: var(--color-warning); color: var(--color-text); font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 500;"> ${thinkingTime.toFixed(2)}s</span>` : ''}
      </div>
      <div class="conversation-message-content" style="line-height: 1.6; color: var(--color-text); white-space: pre-wrap; word-wrap: break-word;">${window.escapeHtml ? window.escapeHtml(displayText) : displayText}</div>
      ${codeBlocks.length > 0 ? `
        <div class="conversation-code-blocks" style="margin-top: 0.75rem;">
          ${codeBlocks.map((block, idx) => `
            <div class="code-block" style="margin: 0.5rem 0; border: 1px solid var(--code-border); border-radius: 4px; overflow: hidden; background: var(--code-bg);">
              ${block.file ? `<div style="padding: 0.25rem 0.5rem; background: var(--code-header-bg); font-size: 0.7rem; color: var(--code-text); font-family: monospace;">${window.escapeHtml ? window.escapeHtml(block.file) : block.file}</div>` : ''}
              <pre style="margin: 0; padding: 0.75rem; overflow-x: auto;"><code class="language-${block.language || 'text'}" style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 0.8rem; color: var(--code-text);">${window.escapeHtml ? window.escapeHtml(block.code) : block.code}</code></pre>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${!isUser && (requestDuration || timeToFirstToken || tokens) ? `
        <div class="conversation-message-metadata" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-text-alpha-10); font-size: 0.75rem; color: var(--color-text-muted); display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
          ${requestDuration ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span>[T]</span> <span>${(requestDuration / 1000).toFixed(2)}s</span></span>` : ''}
          ${timeToFirstToken ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span>[Fast]</span> <span>TTF: ${(timeToFirstToken / 1000).toFixed(2)}s</span></span>` : ''}
          ${tokens ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span></span> <span>${tokens} tokens${promptTokens || completionTokens ? ` (${promptTokens}p + ${completionTokens}c)` : ''}</span></span>` : ''}
        </div>
      ` : ''}
      ${text.length > 300 ? `<button class="conversation-message-read-more" onclick="showEventModal('${message.id}')" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: transparent; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; font-size: 0.75rem; color: var(--color-primary);">Read more</button>` : ''}
    </div>
  `;
}


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
  // Suppress related events display if inside commit group to reduce nesting
  const isInCommitGroup = prompt._inCommitGroup;
  if (!relatedEvents && !isInCommitGroup) {
    if (timelineItems && window.findRelatedEventsBySequence) {
      relatedEvents = window.findRelatedEventsBySequence(prompt, timelineItems, 15);
    } else if (window.findRelatedEvents) {
      // Fallback to time-based
      relatedEvents = window.findRelatedEvents(prompt, 15);
    }
  }
  
  // Show related events indicator (only if not in commit group)
  let relatedEventsIndicator = '';
  if (relatedEvents && relatedEvents.length > 0 && !isInCommitGroup) {
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
            <div style="font-size: var(--text-xs); padding: var(--space-xs); background: var(--color-primary-alpha-05); border-left: 2px solid var(--color-accent); border-radius: var(--radius-sm); margin-bottom: var(--space-xs); cursor: pointer;"
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
    contextFileCountBadge = `<span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary);">${prompt.contextAnalysis.fileCount} files</span>`;
  } else if (prompt.contextChange?.currentFileCount) {
    contextFileCountBadge = `<span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary);">${prompt.contextChange.currentFileCount} files</span>`;
  }
  
  // Extract model and token information if available
  const modelName = prompt.model_name || prompt.modelName || prompt.model;
  const tokens = prompt.total_tokens || prompt.totalTokens || 0;
  const promptTokens = prompt.prompt_tokens || 0;
  const completionTokens = prompt.completion_tokens || 0;
  
  // Workspace badge
  const workspaceName = prompt.workspaceName || (prompt.workspace_path ? prompt.workspace_path.split('/').pop() : '') || (prompt.workspaceId ? prompt.workspaceId.substring(0, 8) : '');
  const workspaceBadge = workspaceName ? `<span class="badge" style="background: var(--color-success); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}</span>` : '';
  
  // Conversation context badge (if part of a conversation)
  let conversationBadge = '';
  if (prompt._inConversation && prompt.conversationTitle) {
    const conversationTitle = prompt.conversationTitle === 'Untitled Conversation' ? 'Conversation' : prompt.conversationTitle;
    conversationBadge = `<span class="badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); font-size: var(--text-xs);" title="Part of conversation: ${window.escapeHtml ? window.escapeHtml(conversationTitle) : conversationTitle}">${window.escapeHtml ? window.escapeHtml(conversationTitle.substring(0, 20)) : conversationTitle.substring(0, 20)}${conversationTitle.length > 20 ? '...' : ''}</span>`;
  }
  
  // Find related file changes and terminal commands (causal linking)
  let relatedFileChanges = [];
  let relatedTerminalCommands = [];
  if (timelineItems) {
    const promptTime = prompt.sortTime || new Date(prompt.timestamp).getTime();
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    relatedFileChanges = timelineItems.filter(item => {
      if (item.itemType !== 'event' || item.type !== 'file_change') return false;
      const itemTime = item.sortTime || new Date(item.timestamp).getTime();
      return itemTime > promptTime && itemTime <= promptTime + timeWindow;
    }).slice(0, 3);
    
    relatedTerminalCommands = timelineItems.filter(item => {
      if (item.itemType !== 'terminal') return false;
      const itemTime = item.sortTime || (typeof item.timestamp === 'number' ? item.timestamp : new Date(item.timestamp).getTime());
      return itemTime > promptTime && itemTime <= promptTime + timeWindow;
    }).slice(0, 2);
  }
  
  // Related items indicator
  let relatedItemsIndicator = '';
  if (relatedFileChanges.length > 0 || relatedTerminalCommands.length > 0) {
    relatedItemsIndicator = `
      <div class="related-items-indicator" style="margin-top: var(--space-sm); padding-top: var(--space-sm); border-top: 1px solid var(--color-border);">
        ${relatedFileChanges.length > 0 ? `
          <div style="margin-bottom: var(--space-xs);">
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 500;">Related file changes:</span>
            ${relatedFileChanges.map(change => {
              const details = typeof change.details === 'string' ? JSON.parse(change.details) : change.details;
              const filePath = details?.file_path || change.file_path || '';
              const fileName = filePath ? filePath.split('/').pop() : 'Unknown file';
              return `
                <div style="margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm); cursor: pointer;"
                     onclick="event.stopPropagation(); showEventModal('${change.id}')">
                  <span style="font-size: var(--text-xs); color: var(--color-text);">[Note] ${window.escapeHtml ? window.escapeHtml(fileName) : fileName}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
        ${relatedTerminalCommands.length > 0 ? `
          <div>
            <span style="font-size: var(--text-xs); color: var(--color-text-muted); font-weight: 500;">Related commands:</span>
            ${relatedTerminalCommands.map(cmd => {
              const commandText = cmd.command || 'Unknown command';
              const shortCommand = commandText.length > 50 ? commandText.substring(0, 50) + '...' : commandText;
              return `
                <div style="margin-top: var(--space-xs); padding: var(--space-xs); background: var(--color-bg-alt); border-radius: var(--radius-sm); cursor: pointer;"
                     onclick="event.stopPropagation(); showEventModal('${cmd.id}')">
                  <span style="font-size: var(--text-xs); color: var(--color-text); font-family: monospace;">[Code] ${window.escapeHtml ? window.escapeHtml(shortCommand) : shortCommand}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  const promptExpandId = `expand-${prompt.id}`;
  const promptDetailsId = `details-${prompt.id}`;
  
  return `
    <div class="timeline-card timeline-item-${side} prompt-timeline-item" style="border-left: 3px solid var(--color-accent); background: var(--color-secondary-alpha-05);">
      <div class="timeline-card-content">
        <div class="timeline-card-header" onclick="toggleEventDetails('${promptExpandId}', '${promptDetailsId}')" style="cursor: pointer;">
          <div class="timeline-card-title-section">
            <div class="timeline-card-title">
              <span class="prompt-icon" style="width: 10px; height: 10px; border-radius: 50%; background: var(--color-accent); display: inline-block; margin-right: var(--space-xs);"></span>
              <span class="timeline-file-name">AI Prompt</span>
              <span style="color: var(--color-text-muted); font-size: var(--text-xs); font-weight: normal; margin-left: var(--space-xs);">${promptText.length.toLocaleString()} chars</span>
            </div>
          </div>
          <div class="timeline-card-meta" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span class="timeline-time">${time}</span>
            <button class="timeline-card-toggle" id="${promptExpandId}" onclick="event.stopPropagation(); toggleEventDetails('${promptExpandId}', '${promptDetailsId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle details">
              
            </button>
          </div>
        </div>
        <div class="timeline-card-body">
          <div class="timeline-card-description" style="line-height: 1.6; color: var(--color-text); white-space: pre-wrap; word-wrap: break-word;">${window.escapeHtml ? window.escapeHtml(displayText) : displayText}</div>
          
          <div class="timeline-card-tags" style="display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: center; margin-top: var(--space-sm);">
            ${workspaceBadge}
            ${conversationBadge}
            <span class="badge badge-prompt" style="background: var(--color-accent); color: var(--badge-text-on-accent); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(source) : source}</span>
            ${modelName ? `<span class="badge" style="background: var(--color-primary); color: var(--badge-text-on-primary); font-size: var(--text-xs);">${window.escapeHtml ? window.escapeHtml(modelName) : modelName}</span>` : ''}
            ${tokens > 0 ? `<span class="badge" style="background: var(--color-accent); color: var(--badge-text-on-accent); font-size: var(--text-xs);">${tokens} tokens</span>` : ''}
            ${prompt.contextUsage > 0 ? `<span class="badge" style="background: var(--color-warning); color: var(--color-text); font-size: var(--text-xs);">${prompt.contextUsage.toFixed(1)}% context</span>` : ''}
            ${contextFileCountBadge}
            ${linkedCodeIndicator}
            ${contextChangeIndicator}
          </div>
          
          ${relatedEventsIndicator}
          ${relatedItemsIndicator}
          
          ${promptText.length > 300 ? `<button class="conversation-message-read-more" onclick="event.stopPropagation(); toggleEventDetails('${promptExpandId}', '${promptDetailsId}')" style="margin-top: var(--space-sm); padding: 0.25rem 0.5rem; background: transparent; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; font-size: 0.75rem; color: var(--color-primary);">Read more</button>` : ''}
        </div>
        <div class="timeline-card-details" id="${promptDetailsId}" style="display: none; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
          <div class="event-details-loading" style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
            Loading details...
          </div>
        </div>
      </div>
    </div>
  `;
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
  
  const terminalExpandId = `expand-${cmd.id}`;
  const terminalDetailsId = `details-${cmd.id}`;
  
  return `
    <div class="timeline-item timeline-item-${side} terminal-timeline-item ${isError ? 'terminal-error' : ''}">
      <div class="timeline-content terminal-content">
        <div class="timeline-header" onclick="toggleEventDetails('${terminalExpandId}', '${terminalDetailsId}')" style="cursor: pointer;">
          <div class="timeline-title">
            <span style="margin-right: var(--space-xs);">${icon}</span>
            <code class="terminal-command-code" style="font-family: var(--font-mono); font-size: var(--text-sm); color: var(--color-text); background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px;">${window.escapeHtml(displayText)}</code>
          </div>
          <div class="timeline-meta" style="display: flex; align-items: center; gap: var(--space-sm);">
            <span>${time}</span>
            <button class="timeline-card-toggle" id="${terminalExpandId}" onclick="event.stopPropagation(); toggleEventDetails('${terminalExpandId}', '${terminalDetailsId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle details">
              
            </button>
          </div>
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
        <div class="timeline-card-details" id="${terminalDetailsId}" style="display: none; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
          <div class="event-details-loading" style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
            Loading details...
          </div>
        </div>
      </div>
    </div>
  `;


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
  
  // Extract file path and format stats nicely
  let filePath = '';
  let fileStats = '';
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const path = details?.file_path || event.file_path || event.path || '';
    if (path) {
      filePath = path;
    }
    
    // Format stats nicely
    const charsAdded = details?.chars_added || 0;
    const charsRemoved = details?.chars_removed || 0;
    const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
    const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
    
    if (charsAdded > 0 || charsRemoved > 0) {
      const addedKB = (charsAdded / 1024).toFixed(1);
      const removedKB = (charsRemoved / 1024).toFixed(1);
      fileStats = `${charsAdded > 0 ? `+${addedKB}K` : ''}${charsRemoved > 0 ? (charsAdded > 0 ? ' / ' : '') + `-${removedKB}K` : ''} chars`;
    } else if (linesAdded > 0 || linesRemoved > 0) {
      fileStats = `${linesAdded > 0 ? `+${linesAdded}` : ''}${linesRemoved > 0 ? (linesAdded > 0 ? ' / ' : '') + `-${linesRemoved}` : ''} lines`;
    }
  } catch (e) {
    // Ignore
  }
  
  // Auto-tag the event using classifier
  let eventTags = [];
  if (window.eventClassifier && window.eventClassifier.classifyEvent) {
    eventTags = window.eventClassifier.classifyEvent(event);
  } else if (window.autoTagEvent) {
    eventTags = window.autoTagEvent(event);
  }
  
  // Generate summary using classifier
  if (!desc && window.eventClassifier && window.eventClassifier.generateSummary) {
    desc = window.eventClassifier.generateSummary(event);
  }
  
  // Only render tags if we have actual tags (not empty)
  // Don't show workspace badge here - it will be shown separately to avoid redundancy
  let tagsHtml = '';
  if (eventTags && eventTags.length > 0 && window.renderTags) {
    tagsHtml = window.renderTags(eventTags, true, event);
  }
  
  // Check for linked patterns (edit scripts, motifs)
  let patternBadges = '';
  try {
    const eventId = event.id || event.timestamp;
    // Check if this event is linked to an edit script (via diff_id)
    if (window.state?.data?.rung2EditScripts) {
      const linkedScript = window.state.data.rung2EditScripts.find(s => s.diffId === eventId);
      if (linkedScript) {
        patternBadges += `
          <span class="pattern-badge edit-script" 
                onclick="event.stopPropagation(); window.switchView('patterns-history'); setTimeout(() => { if(window.viewPatternDetails) window.viewPatternDetails('edit-script', '${linkedScript.id}'); }, 300);"
                title="Linked to Edit Script: ${linkedScript.operationCount || 0} operations">
            [Note] Edit Script
          </span>
        `;
      }
    }
  } catch (e) {
    // Ignore pattern linking errors
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
    // Only show related prompts if NOT inside a commit group (to reduce nesting)
    const isInCommitGroup = timelineItems && event._inCommitGroup;
    
    if ((event.type === 'file_change' || event.type === 'code_change') && !isInCommitGroup) {
      if (timelineItems && window.findRelatedPromptsBySequence) {
        relatedPrompts = window.findRelatedPromptsBySequence(event, timelineItems, { before: 20, after: 5 });
      } else if (window.findRelatedPrompts) {
        // Fallback to time-based
        relatedPrompts = window.findRelatedPrompts(event, 15);
      }
      
      // Store related prompts for use in expanded view
      event._relatedPrompts = relatedPrompts;
      
      // Don't show inline indicator - we'll show count in header and use tabs in expanded view
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
        if (window.extractContextFiles) contextFilesFromPrompts.push(...window.extractContextFiles(linkedPrompt));
        if (window.extractAtFiles) atFilesFromPrompts.push(...window.extractAtFiles(linkedPrompt));
      }
    }
    
    // Collect context files from related prompts
    if (relatedPrompts && relatedPrompts.length > 0) {
      relatedPrompts.forEach(prompt => {
        if (window.extractContextFiles) contextFilesFromPrompts.push(...window.extractContextFiles(prompt));
        if (window.extractAtFiles) atFilesFromPrompts.push(...window.extractAtFiles(prompt));
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
          ${totalFiles} context file${totalFiles !== 1 ? 's' : ''}
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
                      <span style="font-size: 0.85em; color: var(--color-text-muted); margin-right: 2px;">[File]</span>${window.escapeHtml(fileName)}
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

  // Format file path for display - show only filename in title, full path as tooltip
  const fileName = filePath ? filePath.split('/').pop() : (fileInfo.displayTitle || title);
  const displayFilePath = fileName;
  
  // Format file directory for context
  const fileDir = filePath ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
  
  // Format time more informatively
  const timeAgo = window.formatTimeAgo ? window.formatTimeAgo(event.timestamp || event.sortTime) : time;
  const fullTime = new Date(event.timestamp).toLocaleString();
  
  // Only show workspace badge if not inside a thread (threads show workspace in header)
  const isInThread = event._inThread || false;
  const isInCommitGroup = event._inCommitGroup || false;
  
  // Get workspace name - avoid redundancy
  const workspacePath = event.workspace_path || event.workspacePath || fileInfo.workspacePath || '';
  const workspaceName = workspacePath ? (workspacePath.split('/').pop() || workspacePath.split('\\').pop() || workspacePath) : '';
  
  // Only show workspace badge if not redundant (not in thread/commit group, and not already shown in fileInfo)
  const showWorkspaceBadge = !isInThread && !isInCommitGroup && workspaceName && !fileInfo.badges?.includes(workspaceName);
  const workspaceBadge = showWorkspaceBadge ? `<span class="timeline-badge timeline-badge-muted" title="${window.escapeHtml ? window.escapeHtml(workspacePath) : workspacePath}">${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}</span>` : '';
  
  // Extract model information if available
  let modelInfo = '';
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    const model = details?.model || details?.model_name || event.model_name || event.model;
    const mode = details?.mode || event.mode;
    const provider = details?.provider || event.provider;
    
    if (model && model !== 'Unknown' && model !== 'unknown') {
      modelInfo = `<span class="timeline-badge" style="background: var(--color-primary-alpha-10); color: var(--color-primary); font-size: 10px; padding: 2px 6px; border-radius: 4px;" title="Model: ${window.escapeHtml ? window.escapeHtml(model) : model}${mode ? ` (${mode})` : ''}">[AI] ${window.escapeHtml ? window.escapeHtml(model.split('/').pop() || model) : (model.split('/').pop() || model)}</span>`;
    }
  } catch (e) {
    // Ignore
  }
  
  // Build a more informative title section
  const titleSection = `
    <div class="timeline-card-title-section">
      ${stateEventLabel ? `<span class="timeline-state-label">${stateEventLabel}</span>` : ''}
      <div class="timeline-card-title">
        <div class="timeline-file-info">
          ${fileDir ? `<span class="timeline-file-dir" title="${window.escapeHtml ? window.escapeHtml(fileDir) : fileDir}">${window.escapeHtml ? window.escapeHtml(fileDir.split('/').slice(-2).join('/') + '/') : fileDir.split('/').slice(-2).join('/') + '/'}</span>` : ''}
          <span class="timeline-file-name" title="${filePath ? window.escapeHtml(filePath) : ''}">${window.escapeHtml ? window.escapeHtml(displayFilePath) : displayFilePath}</span>
        </div>
        ${fileStats ? `<span class="timeline-file-stats">${fileStats}</span>` : ''}
      </div>
    </div>
  `;
  
  const eventId = event.id || event.timestamp;
  const expandId = `expand-${eventId}`;
  const detailsId = `details-${eventId}`;
  
  // Get prompt count for display in header
  const promptCount = (relatedPrompts && relatedPrompts.length > 0) ? relatedPrompts.length : 0;
  const promptCountBadge = promptCount > 0 ? `
    <span class="timeline-badge" style="background: var(--color-accent-alpha-10, rgba(168, 85, 247, 0.1)); color: var(--color-accent, #a855f7); font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: var(--space-xs);" title="${promptCount} related prompt${promptCount !== 1 ? 's' : ''}">
      [Chat] ${promptCount}
    </span>
  ` : '';
  
  return `
    <div class="timeline-card timeline-item-left event-content ${stateEventClass}" style="${stateEventStyle}">
      <div class="timeline-card-content">
        <div class="timeline-card-header" onclick="toggleEventDetails('${expandId}', '${detailsId}')" style="cursor: pointer;">
          ${titleSection}
          <div class="timeline-card-meta" style="display: flex; align-items: center; gap: var(--space-sm);">
            ${promptCountBadge}
            <span class="timeline-time" title="${fullTime}">${timeAgo}</span>
            <button class="timeline-card-toggle" id="${expandId}" onclick="event.stopPropagation(); toggleEventDetails('${expandId}', '${detailsId}')" 
                    style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                    title="Toggle details">
              
            </button>
          </div>
        </div>
        <div class="timeline-card-body">
          ${desc ? `<div class="timeline-card-description">${window.escapeHtml ? window.escapeHtml(desc) : desc}</div>` : ''}
          ${event.annotation ? `<div class="timeline-card-annotation"><span class="ai-label">[AI]</span> ${window.escapeHtml(event.annotation)}</div>` : ''}
          ${event.intent ? `<span class="timeline-badge timeline-badge-primary">${window.escapeHtml(event.intent)}</span>` : ''}
          
          <!-- Badges and indicators - consolidated to avoid redundancy -->
          ${workspaceBadge || modelInfo || tagsHtml || linkedPromptIndicator || contextIndicators || patternBadges ? `
            <div class="timeline-card-indicators" style="display: flex; flex-wrap: wrap; gap: var(--space-xs); align-items: center; margin-top: var(--space-xs);">
              ${workspaceBadge}
              ${modelInfo}
              ${tagsHtml && !isInThread && !isInCommitGroup ? tagsHtml : ''}
              ${linkedPromptIndicator}
              ${contextIndicators}
              ${patternBadges}
            </div>
          ` : ''}
        </div>
        ${event._contextFilesHtml || ''}
        <div class="timeline-card-details" id="${detailsId}" style="display: none; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
          ${(() => {
            // Use tabs if we have related prompts
            if (promptCount > 0) {
              const tabsId = `tabs-${eventId}`;
              const eventTabId = `tab-event-${eventId}`;
              const promptsTabId = `tab-prompts-${eventId}`;
              const eventContentId = `content-event-${eventId}`;
              const promptsContentId = `content-prompts-${eventId}`;
              
              return `
                <div class="event-details-tabs" id="${tabsId}">
                  <div class="event-details-tab-header" style="display: flex; gap: var(--space-xs); border-bottom: 1px solid var(--color-border); margin-bottom: var(--space-md);">
                    <button class="event-details-tab-btn active" id="${eventTabId}" onclick="switchEventDetailTab('${eventId}', 'event')" 
                            style="padding: var(--space-xs) var(--space-sm); background: none; border: none; border-bottom: 2px solid var(--color-primary); color: var(--color-primary); font-weight: 500; cursor: pointer; font-size: var(--text-sm);">
                      Event Details
                    </button>
                    <button class="event-details-tab-btn" id="${promptsTabId}" onclick="switchEventDetailTab('${eventId}', 'prompts')" 
                            style="padding: var(--space-xs) var(--space-sm); background: none; border: none; border-bottom: 2px solid transparent; color: var(--color-text-muted); cursor: pointer; font-size: var(--text-sm); position: relative;">
                      Related Prompts
                      <span style="background: var(--color-accent); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left: 6px;">${promptCount}</span>
                    </button>
                  </div>
                  <div class="event-details-tab-content" id="${eventContentId}" style="display: block;">
                    <div class="event-details-loading" style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
                      Loading details...
                    </div>
                  </div>
                  <div class="event-details-tab-content" id="${promptsContentId}" style="display: none;">
                    ${(() => {
                      // Render related prompts with threading indicators
                      return `
                        <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-bottom: var(--space-md); padding: var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm);">
                          Prompts from the same workspace within 5 minutes before this event, ordered by relevance.
                        </div>
                        <div style="display: flex; flex-direction: column; gap: var(--space-sm); position: relative;">
                          ${relatedPrompts.map((prompt, idx) => {
                            const promptText = prompt.text || prompt.prompt || prompt.preview || prompt.content || 'No prompt text';
                            const displayText = promptText.length > 200 ? promptText.substring(0, 200) + '...' : promptText;
                            const timeDiffSeconds = (prompt.timeDiffSeconds && !isNaN(prompt.timeDiffSeconds)) ? prompt.timeDiffSeconds : 0;
                            const minutes = Math.floor(timeDiffSeconds / 60);
                            const seconds = timeDiffSeconds % 60;
                            const timeDiffText = timeDiffSeconds < 60 && timeDiffSeconds > 0 ? 
                              `${Math.floor(timeDiffSeconds)}s before` : 
                              timeDiffSeconds > 0
                              ? `${minutes}m ${seconds}s before`
                              : 'now';
                            const relevancePercent = (prompt.relevanceScore && !isNaN(prompt.relevanceScore)) ? Math.round(prompt.relevanceScore * 100) : 0;
                            
                            // Threading line indicator
                            const isLast = idx === relatedPrompts.length - 1;
                            const threadLine = idx < relatedPrompts.length - 1 ? `
                              <div style="position: absolute; left: 8px; top: 40px; bottom: -12px; width: 2px; background: var(--color-border); z-index: 0;"></div>
                            ` : '';
                            
                            return `
                              <div style="position: relative; padding-left: var(--space-lg);">
                                ${threadLine}
                                <div style="position: absolute; left: 0; top: 8px; width: 12px; height: 12px; border-radius: 50%; background: var(--color-accent); border: 2px solid var(--color-bg); z-index: 1;"></div>
                                <div style="padding: var(--space-md); background: var(--color-bg); border-left: 3px solid var(--color-accent); border-radius: var(--radius-md); cursor: pointer; transition: all 0.2s; position: relative; z-index: 1;" 
                                     onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';" 
                                     onmouseout="this.style.transform=''; this.style.boxShadow='';"
                                     onclick="closeEventModal(); setTimeout(() => showEventModal('${prompt.id}'), 100)">
                                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--space-xs);">
                                    <div style="display: flex; align-items: center; gap: var(--space-xs);">
                                      <span style="color: var(--color-primary); font-weight: 600; font-size: var(--text-xs);">
                                        #${idx + 1}
                                      </span>
                                      <span style="font-size: var(--text-xs); color: var(--color-text-muted);">
                                        ${timeDiffText}
                                      </span>
                                      <span style="font-size: var(--text-xs); color: var(--color-accent); font-weight: 500;">
                                        ${relevancePercent}% match
                                      </span>
                                    </div>
                                    <span class="badge badge-prompt" style="font-size: 10px; padding: 2px 6px;">
                                      ${prompt.source || 'cursor'}
                                    </span>
                                  </div>
                                  <div style="font-size: var(--text-sm); color: var(--color-text); line-height: 1.5;">
                                    ${window.escapeHtml ? window.escapeHtml(displayText) : displayText}
                                  </div>
                                </div>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      `;
                    })()}
                  </div>
                </div>
              `;
            } else {
              // No tabs if no related prompts - just show event details
              return `
                <div class="event-details-loading" style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
                  Loading details...
                </div>
              `;
            }
          })()}
        </div>
        <script>
          (function() {
            const eventData = ${JSON.stringify({
              id: event.id || event.timestamp,
              details: event.details,
              file_path: filePath
            })};
            window._eventDiffData = window._eventDiffData || {};
            window._eventDiffData['${eventId}'] = eventData;
          })();
        </script>
      </div>
    </div>
  `;
}}

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
        badges: '', // Don't include workspace badge here - it will be added separately to avoid redundancy
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
      badges: '', // Don't include workspace badge here - it will be added separately to avoid redundancy
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
  // Remove emojis helper - comprehensive emoji removal
  const removeEmojis = (text) => {
    if (!text || typeof text !== 'string') return text;
    return text
      // Remove common emojis
      .replace(/[Reload]||↗|⇄|→|||[Target]|[Note]|[Chat]|[Fast]|[Tool]|[Chart]|[Art]|||[Search]|[Settings]|[Launch]|[Idea]|[Locked]|[Up]|[Down]|[Mask]|[Circus]|[Film]|[Pin]|||||[Star]||[Fire]||[OK]|[X]|[Warning]|[Info]|[Bell]||||🟢|🟡||🟣|🟠|||🟤/g, '')
      // Remove emoji ranges
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Miscellaneous Symbols and Pictographs
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Miscellaneous Symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map Symbols
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
      .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
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


// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.renderConversationTurnTimelineItem = renderConversationTurnTimelineItem;
  window.renderConversationMessage = renderConversationMessage;
  window.renderPromptTimelineItem = renderPromptTimelineItem;
  window.renderTerminalTimelineItem = renderTerminalTimelineItem;
  window.renderTimelineItem = renderTimelineItem;
}
