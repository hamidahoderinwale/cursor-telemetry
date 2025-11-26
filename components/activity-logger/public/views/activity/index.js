/**
 * Activity View
 */

// Store current filters in module scope
let currentWorkspaceFilter = 'all';
let currentTimeRangeFilter = window.state?.activityTimeRangeFilter || 'week'; // Default to "This Week" for better UX
let currentViewMode = window.state?.activityViewMode || 'timeline'; // 'timeline' or 'storyboard'

async function renderActivityView(container) {
  let events = window.state?.data?.events || [];
  let prompts = window.state?.data?.prompts || [];
  let terminalCommands = window.state?.data?.terminalCommands || [];
  let conversations = [];
  
  // OPTIMIZATION: Use ActivityOptimizer for better conversation fetching
  try {
    if (window.APIClient) {
      // Only add workspaceId if filtering by a specific workspace
      const workspaceParam = currentWorkspaceFilter !== 'all' ? `?workspaceId=${encodeURIComponent(currentWorkspaceFilter)}` : '';
      const conversationsResponse = await window.APIClient.get(`/api/conversations${workspaceParam}`, { silent: true, cacheTTL: 2 * 60 * 1000 });
      if (conversationsResponse && conversationsResponse.success && conversationsResponse.data) {
        // OPTIMIZATION: Limit initial fetch and use optimized batching
        const conversationsToFetch = conversationsResponse.data.slice(0, 50);
        const conversationIds = conversationsToFetch.map(c => c.id).filter(Boolean);
        
        // Use ActivityOptimizer if available for better batching and caching
        if (window.activityOptimizer && conversationIds.length > 0) {
          const conversationMap = await window.activityOptimizer.fetchConversationsBatch(conversationIds, 10);
          conversations = conversationsToFetch.map(conv => {
            const detailed = conversationMap.get(conv.id);
            return detailed || conv;
          });
        } else if (window.batchRequestManager) {
          // Fallback to batch request manager
          conversations = await Promise.all(
            conversationsToFetch.map((conv, index) => 
              window.batchRequestManager.batchRequest(
                'conversation-details',
                () => window.APIClient.get(`/api/conversations/${conv.id}`, { silent: true, cacheTTL: 5 * 60 * 1000 }),
                conversationsToFetch.length - index
              ).then(response => {
                if (response && response.success && response.data) {
                  return response.data;
                }
                return conv;
              }).catch(() => conv)
            )
          );
          await window.batchRequestManager.flush();
        } else {
          // Fallback: Parallel requests with concurrency limit
          const CONCURRENCY_LIMIT = 10;
          conversations = [];
          for (let i = 0; i < conversationsToFetch.length; i += CONCURRENCY_LIMIT) {
            const batch = conversationsToFetch.slice(i, i + CONCURRENCY_LIMIT);
            const batchResults = await Promise.allSettled(
              batch.map(conv => 
                window.APIClient.get(`/api/conversations/${conv.id}`, { silent: true, cacheTTL: 5 * 60 * 1000 })
                  .then(response => {
                    if (response && response.success && response.data) {
                      return response.data;
                    }
                    return conv;
                  })
                  .catch(() => conv)
              )
            );
            conversations.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : conversationsToFetch[i + batchResults.indexOf(r)]));
            
            // Yield to browser between batches
            if (i + CONCURRENCY_LIMIT < conversationsToFetch.length) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }
          }
        }
      }
    }
  } catch (error) {
    console.debug('[ACTIVITY] Failed to fetch conversations, continuing without them:', error);
  }
  
  // Sync with global workspace selector if available
  const globalWorkspace = window.state?.currentWorkspace;
  if (globalWorkspace && globalWorkspace !== 'all') {
    currentWorkspaceFilter = globalWorkspace;
  }
  
  // OPTIMIZATION: Use ActivityOptimizer for workspace filtering with memoization
  const normalizeWorkspacePath = window.normalizeWorkspacePath || ((path) => {
    if (!path) return '';
    return path.toLowerCase().replace(/\/$/, '').trim();
  });
  
  if (currentWorkspaceFilter !== 'all' && window.activityOptimizer) {
    events = window.activityOptimizer.filterByWorkspace(events, currentWorkspaceFilter, normalizeWorkspacePath);
    prompts = window.activityOptimizer.filterByWorkspace(prompts, currentWorkspaceFilter, normalizeWorkspacePath);
    terminalCommands = window.activityOptimizer.filterByWorkspace(terminalCommands, currentWorkspaceFilter, normalizeWorkspacePath);
    conversations = window.activityOptimizer.filterByWorkspace(conversations, currentWorkspaceFilter, normalizeWorkspacePath);
  } else if (currentWorkspaceFilter !== 'all') {
    // Fallback to original filtering logic
    const normalizedFilter = normalizeWorkspacePath(currentWorkspaceFilter);
    
    events = events.filter(event => {
      const eventWorkspace = event.workspace_path || event.workspacePath || event.workspace || event.workspaceName || '';
      const details = typeof event.details === 'string' ? 
        (() => { try { return JSON.parse(event.details); } catch(e) { return {}; } })() : 
        event.details || {};
      const detailsWorkspace = details.workspace_path || details.workspacePath || details.workspace || details.workspaceName || '';
      const userWorkspace = event.user || details.user || '';
      const fullWorkspace = eventWorkspace || detailsWorkspace || userWorkspace;
      const normalizedEventWorkspace = normalizeWorkspacePath(fullWorkspace);
      return normalizedEventWorkspace === normalizedFilter || 
             normalizedEventWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedEventWorkspace);
    });
    
    prompts = prompts.filter(prompt => {
      const promptWorkspace = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId || prompt.workspace || '';
      const normalizedPromptWorkspace = normalizeWorkspacePath(promptWorkspace);
      return normalizedPromptWorkspace === normalizedFilter || 
             normalizedPromptWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedPromptWorkspace);
    });
    
    terminalCommands = terminalCommands.filter(cmd => {
      const cmdWorkspace = cmd.workspace_path || cmd.workspacePath || cmd.workspace || cmd.cwd || cmd.user || '';
      const normalizedCmdWorkspace = normalizeWorkspacePath(cmdWorkspace);
      return normalizedCmdWorkspace === normalizedFilter || 
             normalizedCmdWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedCmdWorkspace);
    });
    
    conversations = conversations.filter(conv => {
      const convWorkspace = conv.workspace_id || conv.workspace_path || '';
      const normalizedConvWorkspace = normalizeWorkspacePath(convWorkspace);
      return normalizedConvWorkspace === normalizedFilter || 
             normalizedConvWorkspace.includes(normalizedFilter) ||
             normalizedFilter.includes(normalizedConvWorkspace);
    });
  }
  
  // OPTIMIZATION: Lazy load context only for visible prompts (defer enhancement)
  // Context will be loaded on-demand when prompts are displayed
  // This significantly speeds up initial render
  const enhancePromptsLazy = window.activityOptimizer && prompts.length > 20;
  if (!enhancePromptsLazy) {
    // For small datasets, enhance immediately
    prompts = await Promise.all(
      prompts.map(async (prompt) => {
        if (window.enhancePromptWithContext) {
          try {
            return await window.enhancePromptWithContext(prompt);
          } catch (error) {
            console.warn('Error enhancing prompt with context:', error);
            return prompt;
          }
        }
        return prompt;
      })
    );
  }
  // For large datasets, prompts will be enhanced lazily when rendered
  
  // OPTIMIZATION: Use ActivityOptimizer for time range filtering
  if (currentTimeRangeFilter !== 'all' && window.activityOptimizer) {
    events = window.activityOptimizer.filterByTimeRange(events, currentTimeRangeFilter);
    prompts = window.activityOptimizer.filterByTimeRange(prompts, currentTimeRangeFilter);
    conversations = window.activityOptimizer.filterByTimeRange(conversations, currentTimeRangeFilter);
  } else if (currentTimeRangeFilter !== 'all') {
    // Fallback to original filtering logic
    const now = Date.now();
    let cutoffTime = 0;
    
    switch (currentTimeRangeFilter) {
      case 'today':
        cutoffTime = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    events = events.filter(event => new Date(event.timestamp).getTime() >= cutoffTime);
    prompts = prompts.filter(prompt => new Date(prompt.timestamp).getTime() >= cutoffTime);
    conversations = conversations.filter(conv => {
      const convTime = new Date(conv.created_at || conv.last_message_at || conv.updated_at).getTime();
      return convTime >= cutoffTime;
    });
  }
  
  // Filter out git internal files from events
  const isGitInternalFile = window.isGitInternalFile || ((path) => {
    if (!path) return false;
    if (path.includes('/.git/') || path.includes('\\.git\\')) return true;
    if (path.startsWith('.git/') || path.startsWith('.git\\')) return true;
    if (/^[a-f0-9]{40}$/i.test(path)) return true;
    if (/objects\/[a-f0-9]{2}\/[a-f0-9]{38}/i.test(path)) return true;
    const fileName = path.split('/').pop() || path.split('\\').pop() || '';
    if (/^[a-f0-9]{32,}$/i.test(fileName) && (path.includes('objects/') || path.includes('objects\\'))) return true;
    return false;
  });
  
  // Filter events to exclude git internal files
  const filteredEvents = events.filter(event => {
    if (event.type === 'file_change' || event.type === 'code_change') {
      try {
        const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
        const path = details?.file_path || event.file_path || event.path || '';
        return !isGitInternalFile(path);
      } catch {
        return true; // Keep if we can't parse
      }
    }
    return true; // Keep non-file-change events
  });
  
  // Convert conversations to individual timeline items - one per turn
  // This allows interleaving conversation turns with file changes and terminal commands
  const conversationTurnItems = [];
  const conversationTurnIds = new Set(); // Track turn IDs to avoid duplicates
  const conversationPromptIds = new Set(); // Track prompt IDs that are part of conversations
  
  conversations.forEach(conv => {
    const turns = conv.turns || [];
    const conversationId = conv.id;
    const conversationTitle = conv.title || 'Conversation';
    const workspace = {
      id: conv.workspace_id,
      path: conv.workspace_path,
      name: conv.workspace_path ? conv.workspace_path.split('/').pop() : null
    };
    
    // Create individual timeline items for each turn
    turns.forEach((turn, turnIndex) => {
      const turnId = turn.id || `turn-${conversationId}-${turnIndex}`;
      conversationTurnIds.add(turnId);
      
      // If this turn has a prompt_id, mark it so we don't show it as a standalone prompt
      if (turn.prompt_id) {
        conversationPromptIds.add(turn.prompt_id);
      }
      const turnTimestamp = turn.created_at;
      const sortTime = new Date(turnTimestamp).getTime();
      const isUser = turn.role === 'user';
      const isAssistant = turn.role === 'assistant';
      
      // Parse context and referenced files
      let contextFiles = [];
      let referencedFiles = [];
      try {
        contextFiles = turn.context_files ? 
          (typeof turn.context_files === 'string' ? JSON.parse(turn.context_files) : turn.context_files) : [];
        referencedFiles = turn.referenced_files ? 
          (typeof turn.referenced_files === 'string' ? JSON.parse(turn.referenced_files) : turn.referenced_files) : [];
      } catch (e) {
        // Ignore parse errors
      }
      
      // Parse code blocks
      let codeBlocks = [];
      try {
        codeBlocks = turn.code_blocks ? 
          (typeof turn.code_blocks === 'string' ? JSON.parse(turn.code_blocks) : turn.code_blocks) : [];
      } catch (e) {
        // Ignore parse errors
      }
      
      conversationTurnItems.push({
        id: turn.id || `turn-${conversationId}-${turnIndex}`,
        itemType: 'conversation-turn',
        sortTime: sortTime,
        originalTimestamp: sortTime,
        conversationId: conversationId,
        conversationTitle: conversationTitle,
        turnIndex: turn.turn_index || turnIndex,
        role: turn.role,
        isUser: isUser,
        isAssistant: isAssistant,
        content: turn.content,
        timestamp: turnTimestamp,
        created_at: turnTimestamp,
        // Timing metadata
        thinkingTimeSeconds: turn.thinking_time_seconds || 0,
        thinking_time_seconds: turn.thinking_time_seconds || 0,
        request_duration_ms: turn.request_duration_ms || null,
        requestDurationMs: turn.request_duration_ms || null,
        time_to_first_token_ms: turn.time_to_first_token_ms || null,
        timeToFirstTokenMs: turn.time_to_first_token_ms || null,
        // Token usage
        total_tokens: turn.total_tokens || 0,
        totalTokens: turn.total_tokens || 0,
        prompt_tokens: turn.prompt_tokens || 0,
        completion_tokens: turn.completion_tokens || 0,
        // Model info
        model_name: turn.model_name || null,
        modelName: turn.model_name || null,
        model_provider: turn.model_provider || null,
        streaming: turn.streaming || false,
        // Context and files
        context_files: contextFiles,
        referenced_files: referencedFiles,
        code_blocks: codeBlocks,
        // Workspace
        workspace: workspace,
        workspace_path: conv.workspace_path,
        workspace_id: conv.workspace_id,
        // Conversation metadata
        conversation_status: conv.status,
        conversation_created_at: conv.created_at,
        conversation_updated_at: conv.updated_at
      });
    });
  });
  
  // Filter out prompts that are already part of conversations (to avoid duplicates)
  // Only show standalone prompts that aren't part of any conversation
  const standalonePrompts = prompts.filter(prompt => {
    const promptId = prompt.id || prompt.prompt_id;
    // Exclude if this prompt is already part of a conversation
    if (promptId && conversationPromptIds.has(promptId)) {
      return false;
    }
    // Exclude if this prompt is linked to a conversation turn
    if (prompt.conversation_id || prompt.conversationId) {
      return false;
    }
    return true; // Keep standalone prompts
  });
  
  // OPTIMIZATION: Use Web Worker for sorting/filtering large datasets
  // Interleave all items chronologically: events, prompts, terminal commands, and conversation turns
  const allItems = [
    ...filteredEvents.map(event => ({
      ...event,
      itemType: 'event',
      sortTime: new Date(event.timestamp).getTime(),
      originalTimestamp: new Date(event.timestamp).getTime()
    })),
    ...standalonePrompts.map(prompt => ({
      ...prompt,
      itemType: 'prompt',
      sortTime: new Date(prompt.timestamp).getTime(),
      originalTimestamp: new Date(prompt.timestamp).getTime(),
      id: prompt.id || `prompt-${prompt.timestamp}`
    })),
    ...terminalCommands.map(cmd => ({
      ...cmd,
      itemType: 'terminal',
      sortTime: typeof cmd.timestamp === 'number' ? cmd.timestamp : new Date(cmd.timestamp).getTime(),
      originalTimestamp: typeof cmd.timestamp === 'number' ? cmd.timestamp : new Date(cmd.timestamp).getTime(),
      id: cmd.id || `terminal-${cmd.timestamp}`
    })),
    ...conversationTurnItems // Individual conversation turns, not collapsed blocks
  ];
  
  // OPTIMIZATION: Use Web Worker for sorting if available and dataset is large
  let timelineItems;
  if (allItems.length > 1000 && window.dataWorkerHelper) {
    try {
      timelineItems = await window.dataWorkerHelper.processTimeline(allItems, {
        sortBy: 'sortTime',
        sortOrder: 'desc',
        limit: null
      });
    } catch (error) {
      // Fallback to main thread sorting
      timelineItems = [...allItems].sort((a, b) => b.sortTime - a.sortTime);
    }
  } else {
    // For smaller datasets, sort directly on main thread
    timelineItems = [...allItems].sort((a, b) => b.sortTime - a.sortTime);
  }
  
  // Assign sequence indices based on position in timeline (reverse chronological)
  // Higher sequence number = appears earlier in timeline = happened more recently
  timelineItems = timelineItems.map((item, index) => ({
    ...item,
    sequenceIndex: timelineItems.length - index, // Higher number = more recent
    sequencePosition: index // Position in sorted array
  }));
  
  // Enhance timeline with status messages if available
  if (window.enhanceTimelineWithStatusMessages) {
    try {
      timelineItems = await window.enhanceTimelineWithStatusMessages(timelineItems);
    } catch (error) {
      // Silently fail - status messages are optional
      // Don't log errors here as they're expected when service is offline
    }
  }
  
  // Limit to 100 items after enhancement
  timelineItems = timelineItems.slice(0, 100);
  
  // Group by commits if available (lightweight, non-blocking)
  if (window.groupByCommits) {
    try {
      timelineItems = await window.groupByCommits(timelineItems);
    } catch (error) {
      console.debug('[ACTIVITY] Commit grouping failed, using regular timeline:', error.message);
      // Continue with ungrouped items
    }
  }
  
  // Extract unique workspaces for filter dropdown
  // Reuse normalizeWorkspacePath from earlier in the function (line 90)
  const workspaceMap = new Map();
  
  // Extract from events
  (window.state?.data?.events || []).forEach(event => {
    const eventWs = event.workspace_path || event.workspacePath || event.workspace || event.workspaceName || '';
    const details = typeof event.details === 'string' ? 
      (() => { try { return JSON.parse(event.details); } catch(e) { return {}; } })() : 
      event.details || {};
    const detailsWs = details.workspace_path || details.workspacePath || details.workspace || details.workspaceName || '';
    const userWs = event.user || details.user || '';
    
    const wsPath = eventWs || detailsWs || userWs;
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Extract from prompts
  (window.state?.data?.prompts || []).forEach(prompt => {
    const wsPath = prompt.workspace_path || prompt.workspacePath || prompt.workspaceName || prompt.workspaceId || prompt.workspace || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Extract from terminal commands
  (window.state?.data?.terminalCommands || []).forEach(cmd => {
    const wsPath = cmd.workspace_path || cmd.workspacePath || cmd.workspace || cmd.cwd || cmd.user || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Extract from conversations
  conversations.forEach(conv => {
    const wsPath = conv.workspace_id || conv.workspace_path || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = wsPath.split('/').pop() || wsPath.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  // Also use workspaces from state if available
  (window.state?.data?.workspaces || []).forEach(ws => {
    const wsPath = ws.path || ws.id || ws.name || '';
    if (wsPath) {
      const normalized = normalizeWorkspacePath(wsPath);
      if (normalized) {
        const displayName = ws.name || ws.path?.split('/').pop() || ws.path?.split('\\').pop() || wsPath;
        workspaceMap.set(normalized, displayName);
      }
    }
  });
  
  const uniqueWorkspaces = Array.from(workspaceMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  
  // Smart grouping: Auto-group consecutive file changes to same file
  // This reduces clutter when there are many rapid changes
  const shouldAutoGroup = !window.currentGrouping || window.currentGrouping === 'none';
  if (shouldAutoGroup && timelineItems.length > 10) {
    displayItems = groupConsecutiveFileChanges(timelineItems);
  } else {
    displayItems = timelineItems;
  }
  
  // Apply explicit grouping if enabled
  let isGrouped = false;
  if (window.currentGrouping && window.currentGrouping !== 'none') {
    displayItems = window.groupTimelineItems ? window.groupTimelineItems(displayItems, window.currentGrouping) : displayItems;
    isGrouped = true;
  }
  
  // Debug logging
  console.log('[ACTIVITY] Rendering timeline:', {
    timelineItemsCount: timelineItems.length,
    displayItemsCount: displayItems.length,
    eventsCount: events.length,
    promptsCount: prompts.length,
    terminalCommandsCount: terminalCommands.length,
    conversationsCount: conversations.length,
    hasRenderUnifiedTimeline: !!window.renderUnifiedTimeline,
    hasRenderGroupedTimeline: !!window.renderGroupedTimeline,
    isGrouped: isGrouped,
    stateDataEvents: window.state?.data?.events?.length || 0,
    stateDataPrompts: window.state?.data?.prompts?.length || 0
  });
  
  // Calculate accurate counts from displayed items (after grouping/limiting)
  const countDisplayedItems = (items) => {
    let events = 0, prompts = 0, terminals = 0, conversations = 0, threads = 0;
    
    items.forEach(item => {
      if (item.itemType === 'temporal-thread') {
        threads++;
        // Count items within threads
        if (item.items) {
          item.items.forEach(subItem => {
            if (subItem.itemType === 'event') events++;
            else if (subItem.itemType === 'prompt') prompts++;
            else if (subItem.itemType === 'terminal') terminals++;
            else if (subItem.itemType === 'conversation-turn') conversations++;
          });
        }
      } else {
        if (item.itemType === 'event') events++;
        else if (item.itemType === 'prompt') prompts++;
        else if (item.itemType === 'terminal') terminals++;
        else if (item.itemType === 'conversation-turn') conversations++;
      }
    });
    
    return { events, prompts, terminals, conversations, threads, total: items.length };
  };
  
  const displayedCounts = countDisplayedItems(displayItems);
  
  // Build clearer subtitle
  const subtitleParts = [];
  if (displayedCounts.threads > 0) {
    subtitleParts.push(`${displayedCounts.threads} session${displayedCounts.threads !== 1 ? 's' : ''}`);
  }
  if (displayedCounts.events > 0) {
    subtitleParts.push(`${displayedCounts.events} file change${displayedCounts.events !== 1 ? 's' : ''}`);
  }
  if (displayedCounts.prompts > 0) {
    subtitleParts.push(`${displayedCounts.prompts} prompt${displayedCounts.prompts !== 1 ? 's' : ''}`);
  }
  if (displayedCounts.conversations > 0) {
    subtitleParts.push(`${displayedCounts.conversations} conversation turn${displayedCounts.conversations !== 1 ? 's' : ''}`);
  }
  if (displayedCounts.terminals > 0) {
    subtitleParts.push(`${displayedCounts.terminals} command${displayedCounts.terminals !== 1 ? 's' : ''}`);
  }
  
  const subtitle = subtitleParts.length > 0 
    ? `Showing ${displayedCounts.total} item${displayedCounts.total !== 1 ? 's' : ''} (${subtitleParts.join(', ')})`
    : `Showing ${displayedCounts.total} item${displayedCounts.total !== 1 ? 's' : ''}`;
  
  container.innerHTML = `
    <div class="activity-view">
      
      <!-- Unified Activity Timeline -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title" title="Chronological timeline of all your development activity including file changes, AI prompts, and terminal commands. Items are displayed in chronological order with the most recent first. Use filters to narrow down by workspace, time range, or grouping">Activity Timeline</h3>
            <p class="card-subtitle">${subtitle}</p>
          </div>
          <div class="activity-header-controls" style="display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap;">
            <!-- View Toggle -->
            <div class="view-toggle">
              <button class="${currentViewMode === 'timeline' ? 'active' : ''}" onclick="switchActivityView('timeline')" title="Timeline View">
                Timeline
              </button>
              <button class="${currentViewMode === 'storyboard' ? 'active' : ''}" onclick="switchActivityView('storyboard')" title="Storyboard View - Visual narrative of your development history">
                Storyboard
              </button>
            </div>
            ${currentViewMode === 'storyboard' ? `
              <div style="font-size: var(--text-xs); color: var(--color-text-muted); padding: var(--space-xs) var(--space-sm); background: var(--color-bg-alt); border-radius: var(--radius-sm);">
                Visual narrative of your development story
              </div>
            ` : ''}
            ${currentWorkspaceFilter !== 'all' ? `
              <button class="btn btn-sm" onclick="if(window.showShareModal) window.showShareModal(['${window.escapeHtml ? window.escapeHtml(currentWorkspaceFilter) : currentWorkspaceFilter}']); else alert('Sharing feature not available');" title="Share this workspace view" style="padding: 6px 12px;">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="vertical-align: middle; margin-right: 4px;">
                  <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z"/>
                </svg>
                Share Workspace
              </button>
            ` : ''}
            <select class="select-input" id="workspaceFilter" onchange="filterActivityByWorkspace(this.value)" style="min-width: 180px;">
              <option value="all" ${currentWorkspaceFilter === 'all' ? 'selected' : ''}>All Workspaces</option>
              ${uniqueWorkspaces.map(([normalizedPath, displayName]) => {
                // Compare normalized paths for selection (reuse normalizeWorkspacePath from outer scope)
                const normalizedCurrent = normalizeWorkspacePath(currentWorkspaceFilter);
                const isSelected = normalizedCurrent === normalizedPath;
                return `
                  <option value="${window.escapeHtml ? window.escapeHtml(normalizedPath) : normalizedPath}" ${isSelected ? 'selected' : ''}>
                    ${window.escapeHtml ? window.escapeHtml(displayName) : displayName}
                  </option>
                `;
              }).join('')}
            </select>
            <select class="select-input" id="timeRangeFilter" onchange="filterActivityByTimeRange(this.value)">
              <option value="today" ${currentTimeRangeFilter === 'today' ? 'selected' : ''}>Today</option>
              <option value="week" ${currentTimeRangeFilter === 'week' ? 'selected' : ''}>This Week</option>
              <option value="month" ${currentTimeRangeFilter === 'month' ? 'selected' : ''}>This Month</option>
              <option value="all" ${currentTimeRangeFilter === 'all' ? 'selected' : ''}>All Time</option>
            </select>
            ${currentViewMode === 'timeline' ? `
              <select class="select-input" id="groupingFilter" onchange="updateGrouping(this.value)" style="min-width: 150px;">
                <option value="none" ${(window.currentGrouping || 'none') === 'none' ? 'selected' : ''}>No Grouping</option>
                <option value="file" ${(window.currentGrouping || 'none') === 'file' ? 'selected' : ''}>Group by File</option>
                <option value="session" ${(window.currentGrouping || 'none') === 'session' ? 'selected' : ''}>Group by Session</option>
                <option value="conversation" ${(window.currentGrouping || 'none') === 'conversation' ? 'selected' : ''}>Group by Conversation</option>
                <option value="workflow" ${(window.currentGrouping || 'none') === 'workflow' ? 'selected' : ''}>Group by Workflow</option>
                <option value="workspace" ${(window.currentGrouping || 'none') === 'workspace' ? 'selected' : ''}>Group by Workspace</option>
                <option value="model" ${(window.currentGrouping || 'none') === 'model' ? 'selected' : ''}>Group by Model</option>
              </select>
            ` : ''}
            ${currentViewMode === 'storyboard' ? `
              <!-- Storyboard view doesn't need grouping options - it groups automatically by sessions and scenes -->
            ` : ''}
            <select class="select-input" id="densityFilter" onchange="updateDensity(this.value)" style="min-width: 120px;" title="Control visual density of timeline items">
              <option value="normal" ${(window.currentDensity || 'normal') === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="compact" ${(window.currentDensity || 'normal') === 'compact' ? 'selected' : ''}>Compact</option>
              <option value="spacious" ${(window.currentDensity || 'normal') === 'spacious' ? 'selected' : ''}>Spacious</option>
            </select>
          </div>
        </div>
        <div class="card-body">
          <!-- Search Container -->
          <div class="activity-search-container">
            <div class="activity-search-wrapper">
              <svg class="activity-search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                <circle cx="8" cy="8" r="6" stroke-width="2"/>
                <path d="M13 13l4 4" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <input type="text" 
                     id="activitySearchInput" 
                     class="activity-search-input" 
                     placeholder="Search timeline (Cmd+F)..."
                     autocomplete="off">
            </div>
            <div id="activitySearchResults" class="activity-search-results"></div>
          </div>
          
          <!-- Timeline or Storyboard Content -->
          ${(() => {
            if (timelineItems.length === 0) {
              return '<div class="empty-state"><div class="empty-state-text">No activity recorded</div><div class="empty-state-hint">Activity will appear as you work in Cursor</div></div>';
            }
            
            // Storyboard view
            if (currentViewMode === 'storyboard' && window.renderStoryboardTimeline) {
              try {
                // For storyboard, use all timeline items (not grouped/limited)
                return window.renderStoryboardTimeline(timelineItems);
              } catch (error) {
                console.error('[ACTIVITY] Error rendering storyboard:', error);
                return '<div class="empty-state"><div class="empty-state-text">Error rendering storyboard</div><div class="empty-state-hint">' + error.message + '</div></div>';
              }
            }
            
            // Timeline view
            if (isGrouped && window.renderGroupedTimeline) {
              try {
                return window.renderGroupedTimeline(displayItems);
              } catch (error) {
                console.error('[ACTIVITY] Error rendering grouped timeline:', error);
                return '<div class="empty-state"><div class="empty-state-text">Error rendering timeline</div><div class="empty-state-hint">' + error.message + '</div></div>';
              }
            }
            
            if (window.renderUnifiedTimeline) {
              try {
                return window.renderUnifiedTimeline(displayItems);
              } catch (error) {
                console.error('[ACTIVITY] Error rendering unified timeline:', error);
                return '<div class="empty-state"><div class="empty-state-text">Error rendering timeline</div><div class="empty-state-hint">' + error.message + '</div></div>';
              }
            }
            
            // Fallback if render function not available
            console.warn('[ACTIVITY] renderUnifiedTimeline not available, showing fallback');
            return '<div class="empty-state"><div class="empty-state-text">Timeline renderer not loaded</div><div class="empty-state-hint">Please refresh the page</div></div>';
          })()}
        </div>
      </div>

    </div>
  `;
  
  // Initialize search after DOM is ready
  setTimeout(() => {
    if (window.initializeActivitySearch) {
      window.initializeActivitySearch();
    }
  }, 100);
}

function filterActivityByTimeRange(range) {
  currentTimeRangeFilter = range;
  const container = document.getElementById('viewContainer');
  if (container) {
    // OPTIMIZATION: Debounce filter changes to prevent excessive re-renders
    if (window.activityOptimizer) {
      window.activityOptimizer.debounceFilterChange(() => {
        renderActivityView(container);
      }, 300);
    } else {
      renderActivityView(container);
    }
  }
}

function filterActivityByWorkspace(workspace) {
  currentWorkspaceFilter = workspace;
  const container = document.getElementById('viewContainer');
  if (container) {
    // OPTIMIZATION: Debounce filter changes to prevent excessive re-renders
    if (window.activityOptimizer) {
      window.activityOptimizer.debounceFilterChange(() => {
        renderActivityView(container);
      }, 300);
    } else {
      renderActivityView(container);
    }
  }
}

function updateGrouping(grouping) {
  window.currentGrouping = grouping;
  const container = document.getElementById('viewContainer');
  if (container) {
    renderActivityView(container);
  }
}

function updateDensity(density) {
  window.currentDensity = density;
  document.body.setAttribute('data-timeline-density', density);
  // Apply density styles via CSS custom properties
  const root = document.documentElement;
  if (density === 'compact') {
    root.style.setProperty('--timeline-item-spacing', 'var(--space-xs)');
    root.style.setProperty('--timeline-card-padding', 'var(--space-sm)');
  } else if (density === 'spacious') {
    root.style.setProperty('--timeline-item-spacing', 'var(--space-lg)');
    root.style.setProperty('--timeline-card-padding', 'var(--space-lg)');
  } else {
    root.style.setProperty('--timeline-item-spacing', 'var(--space-md)');
    root.style.setProperty('--timeline-card-padding', 'var(--space-md)');
  }
}

function switchActivityView(mode) {
  if (mode !== 'timeline' && mode !== 'storyboard') {
    console.warn('[ACTIVITY] Invalid view mode:', mode);
    return;
  }
  currentViewMode = mode;
  // Persist to state if available
  if (window.state) {
    window.state.activityViewMode = mode;
  }
  // Re-render the view
  const container = document.getElementById('viewContainer');
  if (container) {
    renderActivityView(container);
  }
}


/**
 * Group consecutive file changes to the same file
 * This reduces visual clutter when there are many rapid edits
 */
function groupConsecutiveFileChanges(items) {
  const grouped = [];
  let currentGroup = null;
  const GROUP_TIME_WINDOW = 5 * 60 * 1000; // 5 minutes
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Only group file_change events
    if (item.itemType === 'event' && (item.type === 'file_change' || item.type === 'code_change')) {
      const filePath = getFilePathFromEvent(item);
      
      if (filePath && currentGroup && 
          currentGroup.filePath === filePath &&
          currentGroup.items.length > 0) {
        const lastItem = currentGroup.items[currentGroup.items.length - 1];
        const timeDiff = Math.abs(new Date(item.timestamp) - new Date(lastItem.timestamp));
        
        // Group if same file and within time window
        if (timeDiff < GROUP_TIME_WINDOW) {
          currentGroup.items.push(item);
          continue;
        }
      }
      
      // Start new group or add to existing if same file
      if (currentGroup && currentGroup.filePath === filePath) {
        currentGroup.items.push(item);
      } else {
        // Save previous group if it has multiple items
        if (currentGroup && currentGroup.items.length > 1) {
          grouped.push({
            itemType: 'file-change-group',
            filePath: currentGroup.filePath,
            items: currentGroup.items,
            timestamp: currentGroup.items[0].timestamp,
            sortTime: currentGroup.items[0].sortTime,
            workspace: currentGroup.items[0].workspace_path || currentGroup.items[0].workspacePath
          });
        } else if (currentGroup && currentGroup.items.length === 1) {
          // Single item, add it directly
          grouped.push(currentGroup.items[0]);
        }
        
        // Start new group
        if (filePath) {
          currentGroup = {
            filePath: filePath,
            items: [item]
          };
        } else {
          // No file path, add directly
          grouped.push(item);
          currentGroup = null;
        }
      }
    } else {
      // Non-file-change item: save current group and add this item
      if (currentGroup) {
        if (currentGroup.items.length > 1) {
          grouped.push({
            itemType: 'file-change-group',
            filePath: currentGroup.filePath,
            items: currentGroup.items,
            timestamp: currentGroup.items[0].timestamp,
            sortTime: currentGroup.items[0].sortTime,
            workspace: currentGroup.items[0].workspace_path || currentGroup.items[0].workspacePath
          });
        } else if (currentGroup.items.length === 1) {
          grouped.push(currentGroup.items[0]);
        }
        currentGroup = null;
      }
      grouped.push(item);
    }
  }
  
  // Don't forget the last group
  if (currentGroup) {
    if (currentGroup.items.length > 1) {
      grouped.push({
        itemType: 'file-change-group',
        filePath: currentGroup.filePath,
        items: currentGroup.items,
        timestamp: currentGroup.items[0].timestamp,
        sortTime: currentGroup.items[0].sortTime,
        workspace: currentGroup.items[0].workspace_path || currentGroup.items[0].workspacePath
      });
    } else if (currentGroup.items.length === 1) {
      grouped.push(currentGroup.items[0]);
    }
  }
  
  return grouped;
}

/**
 * Extract file path from event
 */
function getFilePathFromEvent(event) {
  try {
    const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
    return details?.file_path || event.file_path || event.path || '';
  } catch (e) {
    return event.file_path || event.path || '';
  }
}

// Export to window for global access
window.renderActivityView = renderActivityView;
window.filterActivityByTimeRange = filterActivityByTimeRange;
window.filterActivityByWorkspace = filterActivityByWorkspace;
window.updateGrouping = updateGrouping;
window.updateDensity = updateDensity;
window.switchActivityView = switchActivityView;

