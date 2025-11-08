// Integration layer to connect SPA with Companion Service
// This replaces the direct DOM detection with companion service polling

class CompanionIntegration {
  constructor() {
    this.companionUrl = 'http://127.0.0.1:43917';
    this.pollingInterval = 2000; // 2 seconds
    this.lastCursor = null;
    this.isPolling = false;
    this.pollingTimer = null;
  }

  async start() {
    console.log('🔌 Starting companion service integration...');
    
    // Check if companion is available
    const isAvailable = await this.checkCompanionHealth();
    if (!isAvailable) {
      console.warn('Companion service not available, falling back to direct detection');
      return false;
    }

    // Start polling
    this.isPolling = true;
    this.pollingTimer = setInterval(() => {
      this.pollForUpdates();
    }, this.pollingInterval);

    console.log('Companion integration started');
    return true;
  }

  stop() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.isPolling = false;
    console.log('Companion integration stopped');
  }

  async checkCompanionHealth() {
    try {
      const response = await fetch(`${this.companionUrl}/health`);
      const data = await response.json();
      console.log('Companion health:', data);
      return response.ok;
    } catch (error) {
        console.error('Companion health check failed:', error);
      return false;
    }
  }

  async pollForUpdates() {
    if (!this.isPolling) return;

    try {
      const since = this.lastCursor || new Date(0).toISOString();
      const response = await fetch(`${this.companionUrl}/queue?since=${encodeURIComponent(since)}`);
      
      if (!response.ok) {
        console.error('Failed to fetch queue:', response.status);
        return;
      }

      const data = await response.json();
      
      if (data.entries && data.entries.length > 0) {
        console.log(`Received ${data.entries.length} entries from companion`);
        await this.processEntries(data.entries);
      }

      if (data.events && data.events.length > 0) {
        console.log(`Received ${data.events.length} events from companion`);
        await this.processEvents(data.events);
      }

      // Update cursor and acknowledge
      if (data.cursor) {
        this.lastCursor = data.cursor;
        await this.acknowledgeCursor(data.cursor);
      }

    } catch (error) {
      console.error('Error polling companion:', error);
    }
  }

  async processEntries(entries) {
    for (const entry of entries) {
      try {
        // Convert companion entry format to our database format
        const dbEntry = {
          session_id: entry.session_id || await this.getCurrentSessionId(),
          timestamp: entry.timestamp,
          file_path: entry.file_path || '',
          prompt: entry.prompt || '',
          response: entry.response || '',
          notes: entry.notes || '',
          before_code: entry.before_code || '',
          after_code: entry.after_code || '',
          tags: this.getTagsForSource(entry.source)
        };

        // Add to database
        const entryId = await db.entries.add(dbEntry);
        console.log(`Added entry from companion: ${entryId}`);

        // Update search index
        if (window.searchIndex) {
          window.searchIndex.add(dbEntry);
        }

      } catch (error) {
        console.error('Error processing entry:', error);
      }
    }

    // Re-render UI
    if (window.renderFeed) {
      await window.renderFeed();
    }
    if (window.updateStatusDashboard) {
      await window.updateStatusDashboard();
    }
  }

  async processEvents(events) {
    for (const event of events) {
      try {
        // Convert companion event format to our database format
        const dbEvent = {
          session_id: event.session_id || await this.getCurrentSessionId(),
          timestamp: event.timestamp,
          type: event.type,
          details: JSON.stringify(event.details || {})
        };

        // Add to database
        const eventId = await db.events.add(dbEvent);
        console.log(`Added event from companion: ${eventId}`);

      } catch (error) {
        console.error('Error processing event:', error);
      }
    }

    // Re-render UI
    if (window.renderFeed) {
      await window.renderFeed();
    }
    if (window.updateStatusDashboard) {
      await window.updateStatusDashboard();
    }
  }

  getTagsForSource(source) {
    const tags = [];
    
    switch (source) {
      case 'filewatcher':
        tags.push('auto-detected', 'code-change');
        break;
      case 'mcp':
        tags.push('mcp-detected');
        break;
      case 'clipboard':
        tags.push('clipboard-detected');
        break;
      case 'preload':
        tags.push('preload-detected');
        break;
    }
    
    return tags;
  }

  async acknowledgeCursor(cursor) {
    try {
      await fetch(`${this.companionUrl}/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cursor })
      });
    } catch (error) {
      console.error('Error acknowledging cursor:', error);
    }
  }

  async getCurrentSessionId() {
    // Get or create current session
    if (window.currentSession) {
      return window.currentSession.id;
    }
    
    // Create new session if none exists
    const sessionId = 'session-' + Date.now();
    const session = {
      id: sessionId,
      name: `Session ${new Date().toLocaleDateString()}`,
      created_at: new Date().toISOString()
    };
    
    await db.sessions.add(session);
    window.currentSession = session;
    
    return sessionId;
  }

  async updateCompanionConfig(config) {
    try {
      const response = await fetch(`${this.companionUrl}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        console.log('Companion config updated');
      } else {
        console.error('Failed to update companion config');
      }
    } catch (error) {
      console.error('Error updating companion config:', error);
    }
  }
}

// Export for use in the main app
window.CompanionIntegration = CompanionIntegration;
