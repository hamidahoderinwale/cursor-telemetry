/**
 * Timeline rendering helper functions
 * All HTML template functions for timeline rendering
 */

/**
 * Group items into temporal threads/sessions based on time proximity
 * Default time window: 10 minutes (600000ms) - better for development sessions
 */
function groupIntoTemporalThreads(items, timeWindowMs = 10 * 60 * 1000) {
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
 * Groups items by default using temporal threads (15 minute windows)
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
  
  // Flatten conversations into individual prompt items for chronological integration
  // This allows conversations to be threaded and grouped with other timeline items
  const conversationPromptItems = [];
  workspaceMap.forEach((workspace, workspaceId) => {
    workspace.conversations.forEach((conversation, conversationId) => {
      // Flatten all prompts from the conversation into individual timeline items
      const allConversationPrompts = conversation.allPrompts || conversation.rootPrompts || [];
      
      allConversationPrompts.forEach((prompt, index) => {
        // Mark as part of a conversation for context
        conversationPromptItems.push({
          ...prompt,
          itemType: 'prompt',
          sortTime: prompt.sortTime || prompt.timestamp || conversation.timestamp,
          workspaceId: workspaceId,
          workspaceName: workspace.name,
          conversationId: conversationId,
          conversationTitle: conversation.title,
          _inConversation: true,
          _conversationIndex: index,
          _conversationTotal: allConversationPrompts.length
        });
      });
    });
  });
  
  // Merge all items (flattened conversation prompts, standalone prompts, and other items)
  // Sort by sequence index if available (sequence-based ordering), otherwise by timestamp
  const allItems = [...conversationPromptItems, ...standalonePrompts, ...nonPromptItems]
    .sort((a, b) => {
      // Prefer sequence-based ordering if available
      if (a.sequenceIndex !== undefined && b.sequenceIndex !== undefined) {
        return b.sequenceIndex - a.sequenceIndex; // Higher sequence = more recent
      }
      // Fallback to timestamp-based ordering
      const aTime = a.sortTime || 0;
      const bTime = b.sortTime || 0;
      return bTime - aTime;
    });
  
  // Ensure all items have sequence indices for sequence-based linking
  allItems.forEach((item, index) => {
    if (item.sequenceIndex === undefined) {
      item.sequenceIndex = allItems.length - index;
      item.sequencePosition = index;
    }
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
  
  // Apply temporal threading to group items by time windows (enabled by default)
  // Use 15 minute window to create natural groupings of related activities
  const temporalThreads = groupIntoTemporalThreads(allItems, 10 * 60 * 1000); // 10 minute window for better session grouping
  
  // Store the sorted timeline items for sequence-based linking
  // This allows render functions to find related items by position in sequence
  window._currentTimelineItems = allItems;
  
  // Check if any items are commit groups (before temporal threading)
  const hasCommitGroups = allItems.some(item => item.itemType === 'commit-group');
  
  // If we have commit groups, handle them specially
  if (hasCommitGroups) {
    return `
      <div class="timeline-alternating">
        ${allItems.map(item => {
          if (item.itemType === 'commit-group') {
            return window.renderCommitGroup ? window.renderCommitGroup(item, allItems) : '';
          } else if (item.itemType === 'file-change-group') {
            return renderFileChangeGroup(item, 'left', allItems);
          } else if (item.itemType === 'event') {
            return window.renderTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'terminal') {
            return window.renderTerminalTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'conversation-turn') {
            return window.renderConversationTurnTimelineItem ? window.renderConversationTurnTimelineItem(item, 'left', allItems) : '';
          } else if (item.itemType === 'prompt') {
            return window.renderPromptTimelineItem(item, 'left', allItems);
          } else if (item.itemType === 'status') {
            return window.renderStatusMessageTimelineItem ? 
              window.renderStatusMessageTimelineItem(item, 'left') : '';
          }
          return '';
        }).join('')}
      </div>
    `;
  }
  
  // Build integrated chunks: group prompts with their related code changes
  const chunks = buildIntegratedChunks(allItems);
  
  // Check if we're already in a grouped context (e.g., from renderGroupedTimeline)
  // If so, don't apply workspace side-by-side grouping to avoid double-grouping
  const isInGroupedContext = window._isRenderingGroupedTimeline || false;
  
  // Only apply workspace side-by-side if not already grouped and we have multiple workspaces
  if (!isInGroupedContext) {
    // Group chunks by workspace for side-by-side display
    const workspaceGroups = new Map();
    const getWorkspaceKey = (item) => {
      const workspace = item.workspace || item.workspace_path || item.workspacePath || 
                       item.workspaceName || item.workspace_name || 'unknown';
      return workspace || 'unknown';
    };
    
    const getWorkspaceName = (workspace) => {
      if (!workspace || workspace === 'unknown') return 'Unknown Workspace';
      if (window.getWorkspaceName) {
        return window.getWorkspaceName(workspace);
      }
      return workspace.split('/').pop() || workspace.split('\\').pop() || workspace;
    };
    
    // Group items by workspace
    chunks.forEach(chunk => {
      let workspaceKey = 'unknown';
      
      if (chunk.itemType === 'integrated-chunk') {
        workspaceKey = getWorkspaceKey(chunk.prompt);
      } else if (chunk.itemType === 'file-change-group') {
        workspaceKey = getWorkspaceKey(chunk.items?.[0] || chunk);
      } else {
        workspaceKey = getWorkspaceKey(chunk);
      }
      
      if (!workspaceGroups.has(workspaceKey)) {
        workspaceGroups.set(workspaceKey, {
          workspace: workspaceKey,
          workspaceName: getWorkspaceName(workspaceKey),
          items: []
        });
      }
      
      workspaceGroups.get(workspaceKey).items.push(chunk);
    });
    
    // Sort workspaces by most recent activity
    const workspaceArray = Array.from(workspaceGroups.values()).sort((a, b) => {
      // Get the most recent timestamp from all items in each workspace
      const getMaxTime = (items) => {
        return Math.max(...items.map(item => {
          if (item.itemType === 'integrated-chunk') {
            return item.prompt?.sortTime || new Date(item.prompt?.timestamp || 0).getTime() || 0;
          }
          return item.sortTime || new Date(item.timestamp || 0).getTime() || 0;
        }).filter(t => t > 0), 0);
      };
      const aTime = getMaxTime(a.items);
      const bTime = getMaxTime(b.items);
      return bTime - aTime;
    });
    
    // If multiple workspaces, render side-by-side
    if (workspaceArray.length > 1) {
      return `
        <div class="workspace-timeline-grid">
          ${workspaceArray.map(wsGroup => {
            const workspaceName = wsGroup.workspaceName;
            const itemCount = wsGroup.items.length;
            const workspaceShortName = wsGroup.workspace !== 'unknown' ? 
              (wsGroup.workspace.split('/').pop() || wsGroup.workspace.split('\\').pop() || wsGroup.workspace) : 
              null;
            
            return `
              <div class="workspace-timeline-column">
                <div class="workspace-column-header">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm);">
                    <div>
                      <h4 style="margin: 0; font-size: var(--text-base); font-weight: 600; color: var(--color-text);">
                        ${window.escapeHtml ? window.escapeHtml(workspaceName) : workspaceName}
                      </h4>
                      <div style="font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;">
                        ${itemCount} item${itemCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                    ${workspaceShortName ? `
                      <span class="badge" style="padding: 4px 8px; background: var(--color-primary-alpha-10); color: var(--color-primary); border-radius: 4px; font-size: 11px; font-weight: 500;">
                        ${window.escapeHtml ? window.escapeHtml(workspaceShortName) : workspaceShortName}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <div class="timeline-alternating workspace-timeline-content">
                  ${wsGroup.items.map((chunk, chunkIndex) => {
                    if (chunk.itemType === 'integrated-chunk') {
                      return renderIntegratedChunk(chunk, allItems);
                    } else if (chunk.itemType === 'file-change-group') {
                      return renderFileChangeGroup(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'event') {
                      return window.renderTimelineItem(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'terminal') {
                      return window.renderTerminalTimelineItem(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'conversation-turn') {
                      return window.renderConversationTurnTimelineItem ? window.renderConversationTurnTimelineItem(chunk, 'left', allItems) : '';
                    } else if (chunk.itemType === 'prompt-group') {
                      return renderPromptGroup(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'prompt') {
                      return window.renderPromptTimelineItem(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'status') {
                      return window.renderStatusMessageTimelineItem ? 
                        window.renderStatusMessageTimelineItem(chunk, 'left') : '';
                    }
                    return '';
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }
  }
  
  // Render normally (single column) - either single workspace or already grouped
  return `
    <div class="timeline-alternating">
      ${chunks.map((chunk, chunkIndex) => {
        if (chunk.itemType === 'integrated-chunk') {
          return renderIntegratedChunk(chunk, allItems);
        } else if (chunk.itemType === 'file-change-group') {
          return renderFileChangeGroup(chunk, 'left', allItems);
        } else if (chunk.itemType === 'event') {
          return window.renderTimelineItem(chunk, 'left', allItems);
        } else if (chunk.itemType === 'terminal') {
          return window.renderTerminalTimelineItem(chunk, 'left', allItems);
        } else if (chunk.itemType === 'conversation-turn') {
          return window.renderConversationTurnTimelineItem ? window.renderConversationTurnTimelineItem(chunk, 'left', allItems) : '';
        } else if (chunk.itemType === 'prompt-group') {
          return renderPromptGroup(chunk, 'left', allItems);
        } else if (chunk.itemType === 'prompt') {
          return window.renderPromptTimelineItem(chunk, 'left', allItems);
        } else if (chunk.itemType === 'status') {
          return window.renderStatusMessageTimelineItem ? 
            window.renderStatusMessageTimelineItem(chunk, 'left') : '';
        }
        return '';
      }).join('')}
    </div>
  `;
}

/**
 * Consolidate consecutive similar prompts into groups
 * Groups prompts from same workspace/conversation that are close in time
 */
function consolidateSimilarPrompts(items) {
  const consolidated = [];
  let currentGroup = null;
  const CONSOLIDATION_TIME_WINDOW = 2 * 60 * 1000; // 2 minutes - group prompts within 2 minutes
  const MIN_GROUP_SIZE = 3; // Only group if 3+ items
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Only consolidate prompts
    if (item.itemType === 'prompt') {
      const workspace = item.workspace_path || item.workspacePath || item.workspaceName || '';
      const conversationId = item.conversation_id || item.conversationId || '';
      const isUntitled = !item.conversationTitle || 
                        item.conversationTitle === 'Untitled Conversation' ||
                        item.conversationTitle === 'Untitled';
      
      // Check if this prompt should be grouped with the current group
      if (currentGroup && 
          currentGroup.workspace === workspace &&
          (currentGroup.isUntitled && isUntitled || conversationId && currentGroup.conversationId === conversationId)) {
        const itemTime = item.sortTime || new Date(item.timestamp).getTime();
        const lastItemTime = currentGroup.items[currentGroup.items.length - 1].sortTime || 
                            new Date(currentGroup.items[currentGroup.items.length - 1].timestamp).getTime();
        const timeDiff = Math.abs(itemTime - lastItemTime);
        
        // Add to current group if within time window
        if (timeDiff < CONSOLIDATION_TIME_WINDOW) {
          currentGroup.items.push(item);
          continue;
        }
      }
      
      // Save previous group if it has enough items
      if (currentGroup && currentGroup.items.length >= MIN_GROUP_SIZE) {
        consolidated.push({
          itemType: 'prompt-group',
          items: currentGroup.items,
          workspace: currentGroup.workspace,
          conversationId: currentGroup.conversationId,
          isUntitled: currentGroup.isUntitled,
          timestamp: currentGroup.items[0].timestamp,
          sortTime: currentGroup.items[0].sortTime,
          _isConsolidated: true
        });
        currentGroup = null;
      } else if (currentGroup && currentGroup.items.length < MIN_GROUP_SIZE) {
        // Add individual items if group is too small
        currentGroup.items.forEach(prompt => consolidated.push(prompt));
        currentGroup = null;
      }
      
      // Start new group
      currentGroup = {
        items: [item],
        workspace: workspace,
        conversationId: conversationId,
        isUntitled: isUntitled
      };
    } else {
      // Non-prompt item: save current group and add this item
      if (currentGroup) {
        if (currentGroup.items.length >= MIN_GROUP_SIZE) {
          consolidated.push({
            itemType: 'prompt-group',
            items: currentGroup.items,
            workspace: currentGroup.workspace,
            conversationId: currentGroup.conversationId,
            isUntitled: currentGroup.isUntitled,
            timestamp: currentGroup.items[0].timestamp,
            sortTime: currentGroup.items[0].sortTime,
            _isConsolidated: true
          });
        } else {
          // Add individual items if group is too small
          currentGroup.items.forEach(prompt => consolidated.push(prompt));
        }
        currentGroup = null;
      }
      consolidated.push(item);
    }
  }
  
  // Don't forget the last group
  if (currentGroup) {
    if (currentGroup.items.length >= MIN_GROUP_SIZE) {
      consolidated.push({
        itemType: 'prompt-group',
        items: currentGroup.items,
        workspace: currentGroup.workspace,
        conversationId: currentGroup.conversationId,
        isUntitled: currentGroup.isUntitled,
        timestamp: currentGroup.items[0].timestamp,
        sortTime: currentGroup.items[0].sortTime,
        _isConsolidated: true
      });
    } else {
      currentGroup.items.forEach(prompt => consolidated.push(prompt));
    }
  }
  
  return consolidated;
}

/**
 * Build integrated chunks: group prompts with their related code changes
 * Each chunk represents a prompt and its resulting code changes as a single unit
 * Note: Timeline is reverse chronological (most recent first), so code changes appear before prompts
 */
function buildIntegratedChunks(items) {
  // First consolidate similar prompts
  const consolidatedItems = consolidateSimilarPrompts(items);
  
  const chunks = [];
  const processed = new Set();
  const SEQUENCE_WINDOW = 15; // Look 15 items ahead/behind for related items
  
  for (let i = 0; i < consolidatedItems.length; i++) {
    const item = consolidatedItems[i];
    
    // Handle prompt groups (consolidated prompts) - add them directly
    if (item.itemType === 'prompt-group' && item._isConsolidated) {
      chunks.push(item);
      continue;
    }
    
    // Skip if already processed as part of another chunk
    if (processed.has(i)) continue;
    
    // If it's a prompt, try to find related code changes that come AFTER it chronologically
    // In reverse-chronological timeline, these appear BEFORE the prompt (earlier in array)
    if (item.itemType === 'prompt') {
      const relatedEvents = [];
      const promptTime = item.sortTime || new Date(item.timestamp).getTime();
      
      // Look backwards in array for code changes that happened after this prompt
      // (they appear earlier because timeline is reverse chronological)
      for (let j = Math.max(0, i - SEQUENCE_WINDOW); j < i; j++) {
        const candidate = consolidatedItems[j];
        
        // Skip if already processed
        if (processed.has(j)) continue;
        
        // Only group file_change/code_change events
        if (candidate.itemType === 'event' && 
            (candidate.type === 'file_change' || candidate.type === 'code_change')) {
          
          const candidateTime = candidate.sortTime || new Date(candidate.timestamp).getTime();
          const timeDiff = candidateTime - promptTime;
          
          // Code changes should come after prompts chronologically (positive time diff)
          // And within a reasonable time window (5 minutes)
          if (timeDiff >= 0 && timeDiff < 5 * 60 * 1000) {
            // Check if this event is linked to the prompt or in same workspace
            const isLinked = candidate.prompt_id === item.id || 
                           candidate.prompt_id === item.timestamp ||
                           String(candidate.prompt_id) === String(item.id) ||
                           (candidate.workspace_path && item.workspace_path && 
                            candidate.workspace_path === item.workspace_path);
            
            if (isLinked || timeDiff < 2 * 60 * 1000) { // 2 minutes for automatic linking
              relatedEvents.push(candidate);
              processed.add(j);
            }
          }
        }
      }
      
      // Also check for explicitly linked events via prompt_id
      if (item.id || item.timestamp) {
        items.forEach((candidate, j) => {
          if (processed.has(j) || j === i) return;
          if (candidate.itemType === 'event' && 
              (candidate.type === 'file_change' || candidate.type === 'code_change')) {
            const candidatePromptId = candidate.prompt_id;
            if (candidatePromptId && (
              candidatePromptId === item.id || 
              candidatePromptId === item.timestamp ||
              String(candidatePromptId) === String(item.id) ||
              String(candidatePromptId) === String(item.timestamp)
            )) {
              if (!relatedEvents.find(e => e.id === candidate.id)) {
                relatedEvents.push(candidate);
                processed.add(j);
              }
            }
          }
        });
      }
      
      // Create integrated chunk if we found related events
      if (relatedEvents.length > 0) {
        chunks.push({
          itemType: 'integrated-chunk',
          prompt: item,
          events: relatedEvents,
          timestamp: item.timestamp,
          sortTime: item.sortTime || new Date(item.timestamp).getTime(),
          sequenceIndex: item.sequenceIndex
        });
        processed.add(i);
        continue;
      }
    }
    
    // If it's a file_change event that wasn't linked to a prompt, check if it has a linked prompt
    if (item.itemType === 'event' && 
        (item.type === 'file_change' || item.type === 'code_change') &&
        item.prompt_id) {
      // Find the linked prompt (could be before or after in the array)
      const linkedPromptIndex = items.findIndex((p, idx) => 
        !processed.has(idx) &&
        p.itemType === 'prompt' && 
        (p.id === item.prompt_id || 
         p.id === parseInt(item.prompt_id) || 
         p.timestamp === item.prompt_id ||
         String(p.id) === String(item.prompt_id) ||
         String(p.timestamp) === String(item.prompt_id))
      );
      
      if (linkedPromptIndex >= 0) {
        const linkedPrompt = items[linkedPromptIndex];
        // Check if this prompt already has a chunk
        const existingChunkIndex = chunks.findIndex(c => 
          c.itemType === 'integrated-chunk' && 
          (c.prompt.id === linkedPrompt.id || c.prompt.timestamp === linkedPrompt.timestamp)
        );
        
        if (existingChunkIndex >= 0) {
          // Add this event to existing chunk
          chunks[existingChunkIndex].events.push(item);
          processed.add(i);
        } else {
          // Create new chunk
          chunks.push({
            itemType: 'integrated-chunk',
            prompt: linkedPrompt,
            events: [item],
            timestamp: linkedPrompt.timestamp,
            sortTime: linkedPrompt.sortTime || new Date(linkedPrompt.timestamp).getTime(),
            sequenceIndex: linkedPrompt.sequenceIndex
          });
          processed.add(linkedPromptIndex);
          processed.add(i);
        }
        continue;
      }
    }
    
    // If not part of a chunk, add as standalone item
    if (!processed.has(i)) {
      chunks.push(item);
      processed.add(i);
    }
  }
  
  // Sort chunks by sequence index (most recent first)
  return chunks.sort((a, b) => {
    const aSeq = a.sequenceIndex !== undefined ? a.sequenceIndex : (a.sortTime || 0);
    const bSeq = b.sequenceIndex !== undefined ? b.sequenceIndex : (b.sortTime || 0);
    return bSeq - aSeq;
  });
}

/**
 * Render an integrated chunk: prompt with its related code changes
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
}

/**
 * Render a group of consecutive file changes to the same file
 */
function renderFileChangeGroup(group, side = 'left', timelineItems = null) {
  if (!group.items || group.items.length === 0) return '';
  
  const firstItem = group.items[0];
  const lastItem = group.items[group.items.length - 1];
  const filePath = group.filePath || getFilePathFromEvent(firstItem);
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
}

/**
 * Helper to extract file path from event
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
              if (avgDuration > 0) stats.push(`⏱ ${(avgDuration / 1000).toFixed(1)}s avg`);
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
}

/**
 * Render a single conversation turn as a timeline item
 * This allows interleaving conversation turns with file changes and terminal commands
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
            <span>⏱</span>
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

// Toggle function for context files
window.toggleContextFiles = function(turnId) {
  const contextDiv = document.getElementById(`context-files-${turnId}`);
  if (contextDiv) {
    contextDiv.style.display = contextDiv.style.display === 'none' ? 'block' : 'none';
  }
};

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
          ${requestDuration ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span>⏱</span> <span>${(requestDuration / 1000).toFixed(2)}s</span></span>` : ''}
          ${timeToFirstToken ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span>[Fast]</span> <span>TTF: ${(timeToFirstToken / 1000).toFixed(2)}s</span></span>` : ''}
          ${tokens ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;"><span></span> <span>${tokens} tokens${promptTokens || completionTokens ? ` (${promptTokens}p + ${completionTokens}c)` : ''}</span></span>` : ''}
        </div>
      ` : ''}
      ${text.length > 300 ? `<button class="conversation-message-read-more" onclick="showEventModal('${message.id}')" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: transparent; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; font-size: 0.75rem; color: var(--color-primary);">Read more</button>` : ''}
    </div>
  `;
}

function toggleConversationMessages(threadId) {
  const messagesDiv = document.getElementById(`conversation-messages-${threadId}`);
  const tabsDiv = document.getElementById(`conversation-tabs-${threadId}`);
  const icon = document.getElementById(`conv-icon-${threadId}`);
  
  // Toggle messages or tabs (whichever exists)
  const contentDiv = messagesDiv || tabsDiv;
  
  if (contentDiv && icon) {
    const isHidden = contentDiv.style.display === 'none' || (!contentDiv.classList.contains('visible') && contentDiv.style.display !== 'block');
    if (isHidden) {
      contentDiv.classList.add('visible');
      contentDiv.style.display = 'block';
      icon.style.transform = 'rotate(90deg)';
    } else {
      contentDiv.classList.remove('visible');
      contentDiv.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
}

// Export for global access
window.renderConversationMessage = renderConversationMessage;
window.toggleConversationMessages = toggleConversationMessages;

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
      icon.textContent = '';
    } else {
      itemsDiv.style.display = 'none';
      itemsDiv.classList.remove('visible');
      icon.textContent = '';
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

function toggleTemporalThread(threadId) {
  const itemsDiv = document.getElementById(`thread-items-${threadId}`);
  const icon = document.getElementById(`thread-icon-${threadId}`);
  
  if (itemsDiv && icon) {
    const isHidden = !itemsDiv.classList.contains('visible');
    if (isHidden) {
      itemsDiv.classList.add('visible');
      icon.textContent = '';
    } else {
      itemsDiv.classList.remove('visible');
      icon.textContent = '';
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
          
          // Extract file stats for simple timeline
          let simpleFileStats = '';
          try {
            const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
            const linesAdded = details?.lines_added || details?.diff_stats?.lines_added || 0;
            const linesRemoved = details?.lines_removed || details?.diff_stats?.lines_removed || 0;
            if (linesAdded > 0 || linesRemoved > 0) {
              simpleFileStats = ` <span style="font-size: 0.85em; color: var(--color-text-muted); font-weight: 500;">(${linesAdded > 0 ? `+${linesAdded}` : ''}${linesAdded > 0 && linesRemoved > 0 ? '/' : ''}${linesRemoved > 0 ? `-${linesRemoved}` : ''} lines)</span>`;
            }
          } catch (e) {
            // Ignore
          }
          
          const simpleExpandId = `expand-${event.id || event.timestamp}`;
          const simpleDetailsId = `details-${event.id || event.timestamp}`;
          
          return `
            <div class="timeline-simple-item ${isStateEvent ? 'state-transition-event' : ''}" style="${isStateEvent ? 'border-left: 3px solid var(--color-primary); background: var(--color-bg-alt);' : ''}">
              <div class="timeline-simple-content">
                <div class="timeline-simple-header" onclick="toggleEventDetails('${simpleExpandId}', '${simpleDetailsId}')" style="cursor: pointer;">
                  <div class="timeline-simple-title">
                    ${stateEventLabel ? `<span style="margin-right: 4px; font-size: 0.85em; color: var(--color-text-muted); font-weight: 500;">${stateEventLabel}</span>` : ''}
                    ${window.escapeHtml(title)}${simpleFileStats}
                  </div>
                  <div class="timeline-simple-meta" style="display: flex; align-items: center; gap: var(--space-sm);">
                    <span>${time}</span>
                    <button class="timeline-card-toggle" id="${simpleExpandId}" onclick="event.stopPropagation(); toggleEventDetails('${simpleExpandId}', '${simpleDetailsId}')" 
                            style="background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; font-size: 12px; transition: transform 0.2s;"
                            title="Toggle details">
                      
                    </button>
                  </div>
                </div>
                ${desc ? `<div class="timeline-simple-description">${window.escapeHtml(desc)}</div>` : ''}
                <div class="timeline-card-details" id="${simpleDetailsId}" style="display: none; margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border);">
                  <div class="event-details-loading" style="text-align: center; padding: var(--space-lg); color: var(--color-text-muted);">
                    Loading details...
                  </div>
                </div>
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
 * Uses intelligent grouping by file and type for better visual hierarchy
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

/**
 * Toggle prompt group expansion
 */
function togglePromptGroup(groupId) {
  const itemsContainer = document.getElementById(`items-${groupId}`);
  const previewContainer = document.getElementById(`preview-${groupId}`);
  const toggleButton = document.getElementById(`toggle-${groupId}`);
  
  if (itemsContainer && previewContainer && toggleButton) {
    const isExpanded = itemsContainer.style.display !== 'none';
    itemsContainer.style.display = isExpanded ? 'none' : 'block';
    previewContainer.style.display = isExpanded ? 'block' : 'none';
    toggleButton.textContent = isExpanded ? '' : '';
  }
}

window.renderPromptTimelineItem = renderPromptTimelineItem;
window.renderTerminalTimelineItem = renderTerminalTimelineItem;
window.renderTimelineItem = renderTimelineItem;
window.renderConversationTurnTimelineItem = renderConversationTurnTimelineItem;
window.renderPromptGroup = renderPromptGroup;
window.togglePromptGroup = togglePromptGroup;
window.renderCommitGroup = renderCommitGroup;
window.renderFileChangeGroup = renderFileChangeGroup;
window.renderIntegratedChunk = renderIntegratedChunk;
window.renderTemporalThread = renderTemporalThread;
window.toggleTemporalThread = toggleTemporalThread;
window.getEventTitle = getEventTitle;
window.getEventDescription = getEventDescription;
window.getEnhancedFileInfo = getEnhancedFileInfo;
