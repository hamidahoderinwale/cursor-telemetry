/**
 * Conversation Hierarchy Builder
 * Builds and maintains the full conversation hierarchy:
 * Workspace → Conversation → Tabs/Threads → Prompts
 */

class ConversationHierarchyBuilder {
  constructor() {
    this.hierarchyCache = null;
    this.lastBuildTime = 0;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Build complete conversation hierarchy from prompts and events
   * @param {Array} prompts - All prompts
   * @param {Array} events - All events (optional, for linking)
   * @param {Array} workspaces - All workspaces (optional)
   * @returns {Object} Hierarchical structure
   */
  buildHierarchy(prompts = [], events = [], workspaces = []) {
    const now = Date.now();
    
    // Use cache if available and fresh
    if (this.hierarchyCache && (now - this.lastBuildTime) < this.cacheTimeout) {
      return this.hierarchyCache;
    }

    console.log('[HIERARCHY] Building conversation hierarchy...');
    
    // Step 1: Group prompts by workspace
    const workspaceMap = new Map();
    
    prompts.forEach(prompt => {
      const workspaceId = prompt.workspace_id || prompt.workspaceId || 
                         prompt.workspace_path || prompt.workspacePath || 
                         'unknown';
      const workspaceName = prompt.workspace_name || prompt.workspaceName || 
                           this.extractWorkspaceName(workspaceId);
      
      if (!workspaceMap.has(workspaceId)) {
        workspaceMap.set(workspaceId, {
          id: workspaceId,
          name: workspaceName,
          path: prompt.workspace_path || prompt.workspacePath || workspaceId,
          conversations: new Map(),
          prompts: [],
          events: [],
          metadata: {
            totalPrompts: 0,
            totalConversations: 0,
            lastActivity: null
          }
        });
      }
      
      const workspace = workspaceMap.get(workspaceId);
      workspace.prompts.push(prompt);
      workspace.metadata.totalPrompts++;
      
      if (!workspace.metadata.lastActivity || 
          new Date(prompt.timestamp) > new Date(workspace.metadata.lastActivity)) {
        workspace.metadata.lastActivity = prompt.timestamp;
      }
    });

    // Step 2: Group prompts by conversation within each workspace
    workspaceMap.forEach((workspace, workspaceId) => {
      const conversationMap = new Map();
      
      workspace.prompts.forEach(prompt => {
        // Determine conversation ID - prefer explicit, then composerId, then generate
        const conversationId = prompt.conversation_id || 
                               prompt.conversationId || 
                               prompt.composer_id ||
                               prompt.composerId ||
                               this.generateConversationId(prompt);
        
        // Determine if this is a root conversation or a tab/thread
        const parentConversationId = prompt.parent_conversation_id || 
                                    prompt.parentConversationId || 
                                    null;
        
        // Get or create conversation
        if (!conversationMap.has(conversationId)) {
          conversationMap.set(conversationId, {
            id: conversationId,
            title: prompt.conversation_title || 
                   prompt.conversationTitle || 
                   this.extractConversationTitle(prompt),
            workspaceId: workspaceId,
            workspaceName: workspace.name,
            tabs: new Map(), // Tabs/threads within this conversation
            rootPrompts: [], // Prompts at conversation root level
            allPrompts: [],
            metadata: {
              messageCount: 0,
              userMessageCount: 0,
              assistantMessageCount: 0,
              firstMessage: null,
              lastMessage: null,
              duration: null,
              models: new Set(),
              contextFiles: new Set()
            }
          });
        }
        
        const conversation = conversationMap.get(conversationId);
        conversation.allPrompts.push(prompt);
        
        // Determine if this is a tab/thread or root prompt
        if (parentConversationId && parentConversationId !== conversationId) {
          // This is a tab/thread within the conversation
          if (!conversation.tabs.has(parentConversationId)) {
            conversation.tabs.set(parentConversationId, {
              id: parentConversationId,
              title: this.extractTabTitle(prompt, parentConversationId),
              prompts: [],
              metadata: {
                messageCount: 0,
                firstMessage: null,
                lastMessage: null
              }
            });
          }
          const tab = conversation.tabs.get(parentConversationId);
          tab.prompts.push(prompt);
          tab.metadata.messageCount++;
          
          if (!tab.metadata.firstMessage || 
              new Date(prompt.timestamp) < new Date(tab.metadata.firstMessage)) {
            tab.metadata.firstMessage = prompt.timestamp;
          }
          if (!tab.metadata.lastMessage || 
              new Date(prompt.timestamp) > new Date(tab.metadata.lastMessage)) {
            tab.metadata.lastMessage = prompt.timestamp;
          }
        } else {
          // Root level prompt in conversation
          conversation.rootPrompts.push(prompt);
        }
        
        // Update conversation metadata
        conversation.metadata.messageCount++;
        if (prompt.message_role === 'user' || !prompt.message_role) {
          conversation.metadata.userMessageCount++;
        } else if (prompt.message_role === 'assistant') {
          conversation.metadata.assistantMessageCount++;
        }
        
        if (!conversation.metadata.firstMessage || 
            new Date(prompt.timestamp) < new Date(conversation.metadata.firstMessage)) {
          conversation.metadata.firstMessage = prompt.timestamp;
        }
        if (!conversation.metadata.lastMessage || 
            new Date(prompt.timestamp) > new Date(conversation.metadata.lastMessage)) {
          conversation.metadata.lastMessage = prompt.timestamp;
        }
        
        if (prompt.model_name || prompt.modelName) {
          conversation.metadata.models.add(prompt.model_name || prompt.modelName);
        }
        
        // Extract context files
        if (prompt.context_files) {
          const contextFiles = typeof prompt.context_files === 'string' 
            ? JSON.parse(prompt.context_files) 
            : prompt.context_files;
          if (Array.isArray(contextFiles)) {
            contextFiles.forEach(cf => {
              const filePath = cf.path || cf.filePath || cf.file || cf;
              if (filePath) conversation.metadata.contextFiles.add(filePath);
            });
          }
        }
      });
      
      // Calculate duration for each conversation
      conversationMap.forEach(conv => {
        if (conv.metadata.firstMessage && conv.metadata.lastMessage) {
          const start = new Date(conv.metadata.firstMessage).getTime();
          const end = new Date(conv.metadata.lastMessage).getTime();
          conv.metadata.duration = end - start;
        }
      });
      
      // Convert Maps to arrays for serialization
      workspace.conversations = Array.from(conversationMap.values()).map(conv => ({
        ...conv,
        tabs: Array.from(conv.tabs.values()),
        metadata: {
          ...conv.metadata,
          models: Array.from(conv.metadata.models),
          contextFiles: Array.from(conv.metadata.contextFiles)
        }
      }));
      
      workspace.metadata.totalConversations = workspace.conversations.length;
    });

    // Step 3: Link events to conversations via prompts
    events.forEach(event => {
      if (event.prompt_id || event.promptId) {
        const promptId = event.prompt_id || event.promptId;
        // Find the prompt and add event to its conversation
        prompts.forEach(prompt => {
          if ((prompt.id === promptId) || (prompt.id?.toString() === promptId?.toString())) {
            const workspaceId = prompt.workspace_id || prompt.workspaceId || 'unknown';
            const workspace = workspaceMap.get(workspaceId);
            if (workspace) {
              const conversationId = prompt.conversation_id || prompt.conversationId || 
                                    prompt.composer_id || prompt.composerId;
              const conversation = workspace.conversations.find(c => c.id === conversationId);
              if (conversation) {
                if (!conversation.events) conversation.events = [];
                conversation.events.push(event);
              }
            }
          }
        });
      }
    });

    // Convert to final structure
    const hierarchy = {
      workspaces: Array.from(workspaceMap.values()).map(ws => ({
        ...ws,
        conversations: ws.conversations.map(conv => ({
          ...conv,
          // Ensure tabs are properly structured
          tabs: conv.tabs.map(tab => ({
            ...tab,
            prompts: tab.prompts.sort((a, b) => 
              new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
            )
          })),
          // Sort root prompts
          rootPrompts: conv.rootPrompts.sort((a, b) => 
            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
          ),
          // Sort all prompts
          allPrompts: conv.allPrompts.sort((a, b) => 
            new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
          )
        }))
      })),
      metadata: {
        totalWorkspaces: workspaceMap.size,
        totalConversations: Array.from(workspaceMap.values())
          .reduce((sum, ws) => sum + ws.metadata.totalConversations, 0),
        totalPrompts: prompts.length,
        totalTabs: Array.from(workspaceMap.values())
          .reduce((sum, ws) => sum + ws.conversations.reduce((s, c) => s + c.tabs.length, 0), 0),
        builtAt: new Date().toISOString()
      }
    };

    // Cache the result
    this.hierarchyCache = hierarchy;
    this.lastBuildTime = now;
    
    console.log(`[HIERARCHY] Built hierarchy: ${hierarchy.metadata.totalWorkspaces} workspaces, ` +
                `${hierarchy.metadata.totalConversations} conversations, ` +
                `${hierarchy.metadata.totalTabs} tabs, ` +
                `${hierarchy.metadata.totalPrompts} prompts`);
    
    return hierarchy;
  }

  /**
   * Extract workspace name from path
   */
  extractWorkspaceName(workspacePath) {
    if (!workspacePath) return 'Unknown';
    const parts = workspacePath.split('/').filter(p => p);
    return parts[parts.length - 1] || workspacePath;
  }

  /**
   * Extract conversation title from prompt
   */
  extractConversationTitle(prompt) {
    if (prompt.conversation_title || prompt.conversationTitle) {
      return prompt.conversation_title || prompt.conversationTitle;
    }
    
    const text = prompt.text || prompt.prompt || prompt.content || '';
    if (!text) return 'Untitled Conversation';
    
    // Extract first meaningful line
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length > 5 && firstLine.length < 100 && !firstLine.startsWith('{')) {
      return firstLine;
    }
    
    // Extract from action patterns
    const actionMatch = text.match(/^(fix|add|implement|create|update|refactor|remove|delete|improve|investigate|debug|test|write|build|design)\s+([^.!?]{10,80})/i);
    if (actionMatch) {
      return actionMatch[0].trim();
    }
    
    return 'Untitled Conversation';
  }

  /**
   * Extract tab/thread title
   */
  extractTabTitle(prompt, tabId) {
    const text = prompt.text || prompt.prompt || prompt.content || '';
    if (text && text.length > 5 && text.length < 100) {
      return text.split('\n')[0].trim();
    }
    return `Tab ${tabId.substring(0, 8)}`;
  }

  /**
   * Generate conversation ID from prompt
   */
  generateConversationId(prompt) {
    const workspaceId = prompt.workspace_id || prompt.workspaceId || 'unknown';
    const text = prompt.text || prompt.prompt || prompt.content || '';
    
    // Browser-compatible hash function (replaces require('crypto'))
    let hash = 0;
    const str = text.substring(0, 100);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const hashHex = Math.abs(hash).toString(16).substring(0, 8);
    return `${workspaceId}_${hashHex}`;
  }

  /**
   * Get conversation for a prompt
   */
  getConversationForPrompt(prompt, hierarchy) {
    if (!hierarchy) hierarchy = this.hierarchyCache;
    if (!hierarchy) return null;
    
    const workspaceId = prompt.workspace_id || prompt.workspaceId || 'unknown';
    const conversationId = prompt.conversation_id || prompt.conversationId || 
                           prompt.composer_id || prompt.composerId;
    
    const workspace = hierarchy.workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) return null;
    
    return workspace.conversations.find(conv => conv.id === conversationId);
  }

  /**
   * Get tab/thread for a prompt
   */
  getTabForPrompt(prompt, hierarchy) {
    const conversation = this.getConversationForPrompt(prompt, hierarchy);
    if (!conversation) return null;
    
    const parentId = prompt.parent_conversation_id || prompt.parentConversationId;
    if (!parentId || parentId === conversation.id) return null;
    
    return conversation.tabs.find(tab => tab.id === parentId);
  }

  /**
   * Get all prompts in a conversation (including all tabs)
   */
  getAllPromptsInConversation(conversationId, workspaceId, hierarchy) {
    if (!hierarchy) hierarchy = this.hierarchyCache;
    if (!hierarchy) return [];
    
    const workspace = hierarchy.workspaces.find(ws => ws.id === workspaceId);
    if (!workspace) return [];
    
    const conversation = workspace.conversations.find(conv => conv.id === conversationId);
    if (!conversation) return [];
    
    return conversation.allPrompts;
  }

  /**
   * Get files associated with a conversation
   */
  getConversationFiles(conversation, includeTabs = true) {
    const files = new Set();
    
    // Add files from root prompts
    conversation.rootPrompts.forEach(prompt => {
      if (prompt.context_files) {
        const contextFiles = typeof prompt.context_files === 'string' 
          ? JSON.parse(prompt.context_files) 
          : prompt.context_files;
        if (Array.isArray(contextFiles)) {
          contextFiles.forEach(cf => {
            const filePath = cf.path || cf.filePath || cf.file || cf;
            if (filePath) files.add(filePath);
          });
        }
      }
      if (prompt.file_path || prompt.filePath) {
        files.add(prompt.file_path || prompt.filePath);
      }
    });
    
    // Add files from tabs if requested
    if (includeTabs) {
      conversation.tabs.forEach(tab => {
        tab.prompts.forEach(prompt => {
          if (prompt.context_files) {
            const contextFiles = typeof prompt.context_files === 'string' 
              ? JSON.parse(prompt.context_files) 
              : prompt.context_files;
            if (Array.isArray(contextFiles)) {
              contextFiles.forEach(cf => {
                const filePath = cf.path || cf.filePath || cf.file || cf;
                if (filePath) files.add(filePath);
              });
            }
          }
          if (prompt.file_path || prompt.filePath) {
            files.add(prompt.file_path || prompt.filePath);
          }
        });
      });
    }
    
    return Array.from(files);
  }
}

// Export to window for global access
window.ConversationHierarchyBuilder = ConversationHierarchyBuilder;

