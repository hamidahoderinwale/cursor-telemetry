/**
 * Companion Database Reader
 * Provides read-only access to companion service data
 * Falls back to IndexedDB cache when companion service is offline
 * 
 * This enables the hybrid architecture:
 * - Primary: Companion Service API (real-time, processed data)
 * - Fallback: IndexedDB cache (historical data when offline)
 */

class CompanionDBReader {
  constructor(persistentStorage = null) {
    this.storage = persistentStorage || window.persistentStorage;
    this.companionDbPath = null; // For future Electron/file access support
    this.isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';
  }

  /**
   * Check if companion database is accessible
   */
  async isCompanionDbAvailable() {
    // For web: always use IndexedDB cache
    // For Electron: could check if companion.db file exists
    if (this.isElectron && this.companionDbPath) {
      // Future: check if file exists
      return false; // Not implemented yet
    }
    
    // For web, check if IndexedDB has data
    if (this.storage) {
      try {
        await this.storage.init();
        const stats = await this.getStats();
        return stats.totalEvents > 0 || stats.totalPrompts > 0;
      } catch (error) {
        return false;
      }
    }
    
    return false;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    if (!this.storage) {
      return { totalEvents: 0, totalPrompts: 0, totalEntries: 0 };
    }

    try {
      await this.storage.init();
      
      const events = await this.storage.getAllEvents();
      const prompts = await this.storage.getAllPrompts();
      
      return {
        totalEvents: events.length,
        totalPrompts: prompts.length,
        totalEntries: events.length + prompts.length,
        lastUpdate: await this.storage.getLastSyncTime()
      };
    } catch (error) {
      console.warn('[DB-READER] Error getting stats:', error);
      return { totalEvents: 0, totalPrompts: 0, totalEntries: 0 };
    }
  }

  /**
   * Get events from cache
   */
  async getEvents(options = {}) {
    if (!this.storage) {
      return [];
    }

    try {
      await this.storage.init();
      
      const { limit, offset = 0, since, until, workspacePath } = options;
      let events = await this.storage.getAllEvents();
      
      // Apply filters
      if (since) {
        events = events.filter(e => new Date(e.timestamp) >= new Date(since));
      }
      if (until) {
        events = events.filter(e => new Date(e.timestamp) <= new Date(until));
      }
      if (workspacePath) {
        events = events.filter(e => e.workspace_path === workspacePath);
      }
      
      // Sort by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply pagination
      if (offset > 0) {
        events = events.slice(offset);
      }
      if (limit) {
        events = events.slice(0, limit);
      }
      
      return events;
    } catch (error) {
      console.warn('[DB-READER] Error getting events:', error);
      return [];
    }
  }

  /**
   * Get prompts from cache
   */
  async getPrompts(options = {}) {
    if (!this.storage) {
      return [];
    }

    try {
      await this.storage.init();
      
      const { limit, offset = 0, since, until, workspacePath, conversationId } = options;
      let prompts = await this.storage.getAllPrompts();
      
      // Apply filters
      if (since) {
        prompts = prompts.filter(p => new Date(p.timestamp) >= new Date(since));
      }
      if (until) {
        prompts = prompts.filter(p => new Date(p.timestamp) <= new Date(until));
      }
      if (workspacePath) {
        prompts = prompts.filter(p => p.workspace_path === workspacePath);
      }
      if (conversationId) {
        prompts = prompts.filter(p => p.conversation_id === conversationId);
      }
      
      // Sort by timestamp (newest first)
      prompts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply pagination
      if (offset > 0) {
        prompts = prompts.slice(offset);
      }
      if (limit) {
        prompts = prompts.slice(0, limit);
      }
      
      return prompts;
    } catch (error) {
      console.warn('[DB-READER] Error getting prompts:', error);
      return [];
    }
  }

  /**
   * Get entries from cache
   */
  async getEntries(options = {}) {
    // Entries are stored as events with type 'file_change' or similar
    const events = await this.getEvents({
      ...options,
      type: options.type || undefined
    });
    
    // Convert events to entry format if needed
    return events.map(event => ({
      id: event.id,
      session_id: event.session_id,
      workspace_path: event.workspace_path,
      file_path: event.details?.file_path || event.file_path,
      timestamp: event.timestamp,
      type: event.type,
      before_code: event.details?.before_code,
      after_code: event.details?.after_code,
      ...event
    }));
  }

  /**
   * Get activity data (combined events and prompts)
   */
  async getActivity(options = {}) {
    const [events, prompts] = await Promise.all([
      this.getEvents(options),
      this.getPrompts(options)
    ]);
    
    // Combine and sort by timestamp
    const activity = [
      ...events.map(e => ({ ...e, _type: 'event' })),
      ...prompts.map(p => ({ ...p, _type: 'prompt' }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit if specified
    if (options.limit) {
      return activity.slice(0, options.limit);
    }
    
    return activity;
  }

  /**
   * Get workspaces from cache
   */
  async getWorkspaces() {
    const events = await this.getEvents({ limit: 10000 }); // Get enough to find all workspaces
    const prompts = await this.getPrompts({ limit: 10000 });
    
    const workspaceSet = new Set();
    
    events.forEach(e => {
      if (e.workspace_path) workspaceSet.add(e.workspace_path);
    });
    
    prompts.forEach(p => {
      if (p.workspace_path) workspaceSet.add(p.workspace_path);
    });
    
    return Array.from(workspaceSet).map(path => ({
      path,
      name: path.split('/').pop() || path,
      eventCount: events.filter(e => e.workspace_path === path).length,
      promptCount: prompts.filter(p => p.workspace_path === path).length
    }));
  }

  /**
   * Get conversations from cache
   */
  async getConversations(options = {}) {
    const prompts = await this.getPrompts({ limit: 10000 });
    const conversations = new Map();
    
    prompts.forEach(prompt => {
      if (!prompt.conversation_id) return;
      
      if (!conversations.has(prompt.conversation_id)) {
        conversations.set(prompt.conversation_id, {
          id: prompt.conversation_id,
          title: prompt.conversation_title || `Conversation ${prompt.conversation_id.slice(0, 8)}`,
          workspace_path: prompt.workspace_path,
          created_at: prompt.timestamp,
          updated_at: prompt.timestamp,
          message_count: 0,
          messages: []
        });
      }
      
      const conv = conversations.get(prompt.conversation_id);
      conv.messages.push(prompt);
      conv.message_count = conv.messages.length;
      
      // Update updated_at if this message is newer
      if (new Date(prompt.timestamp) > new Date(conv.updated_at)) {
        conv.updated_at = prompt.timestamp;
      }
    });
    
    // Sort messages within each conversation
    conversations.forEach(conv => {
      conv.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });
    
    let result = Array.from(conversations.values());
    
    // Sort conversations by updated_at
    result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    
    // Apply filters
    if (options.workspacePath) {
      result = result.filter(c => c.workspace_path === options.workspacePath);
    }
    
    if (options.limit) {
      result = result.slice(0, options.limit);
    }
    
    return result;
  }
}

// Export for use in other modules
window.CompanionDBReader = CompanionDBReader;






