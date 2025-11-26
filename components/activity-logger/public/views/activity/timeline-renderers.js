/**
 * Timeline Main Renderers
 * Main rendering functions for timeline views
 * 
 * Dependencies:
 * - timeline-grouping.js (groupIntoTemporalThreads, buildIntegratedChunks)
 * - timeline-group-renderers.js (renderIntegratedChunk, renderFileChangeGroup, renderPromptGroup)
 * - timeline-item-renderers.js (renderTimelineItem, renderTerminalTimelineItem, renderPromptTimelineItem, renderConversationTurnTimelineItem)
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
  const temporalThreads = window.groupIntoTemporalThreads ? window.groupIntoTemporalThreads(allItems, 10 * 60 * 1000) : allItems; // 10 minute window for better session grouping
  
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
            return window.renderFileChangeGroup ? window.renderFileChangeGroup(item, 'left', allItems) : '';
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
  const chunks = window.buildIntegratedChunks ? window.buildIntegratedChunks(allItems) : allItems;
  
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
                      return window.renderIntegratedChunk ? window.renderIntegratedChunk(chunk, allItems) : '';
                    } else if (chunk.itemType === 'file-change-group') {
                      return window.renderFileChangeGroup ? window.renderFileChangeGroup(chunk, 'left', allItems) : '';
                    } else if (chunk.itemType === 'event') {
                      return window.renderTimelineItem(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'terminal') {
                      return window.renderTerminalTimelineItem(chunk, 'left', allItems);
                    } else if (chunk.itemType === 'conversation-turn') {
                      return window.renderConversationTurnTimelineItem ? window.renderConversationTurnTimelineItem(chunk, 'left', allItems) : '';
                    } else if (chunk.itemType === 'prompt-group') {
                      return window.renderPromptGroup ? window.renderPromptGroup(chunk, 'left', allItems) : '';
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
          return window.renderIntegratedChunk ? window.renderIntegratedChunk(chunk, allItems) : '';
        } else if (chunk.itemType === 'file-change-group') {
          return window.renderFileChangeGroup ? window.renderFileChangeGroup(chunk, 'left', allItems) : '';
        } else if (chunk.itemType === 'event') {
          return window.renderTimelineItem(chunk, 'left', allItems);
        } else if (chunk.itemType === 'terminal') {
          return window.renderTerminalTimelineItem(chunk, 'left', allItems);
        } else if (chunk.itemType === 'conversation-turn') {
          return window.renderConversationTurnTimelineItem ? window.renderConversationTurnTimelineItem(chunk, 'left', allItems) : '';
        } else if (chunk.itemType === 'prompt-group') {
          return window.renderPromptGroup ? window.renderPromptGroup(chunk, 'left', allItems) : '';
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

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.renderUnifiedTimeline = renderUnifiedTimeline;
  window.renderActivityTimeline = renderActivityTimeline;
}
