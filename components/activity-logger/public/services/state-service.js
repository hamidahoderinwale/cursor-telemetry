/**
 * Frontend State Service
 * Handles natural language commands and state management from the frontend
 */

class StateService {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.currentStateId = null;
  }

  /**
   * Parse a natural language command
   */
  async parseCommand(command) {
    try {
      const response = await fetch(`${this.apiBase}/api/states/parse-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command })
      });

      if (response.ok) {
        try {
          const data = await response.json();
          return data.parsed;
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return { action: 'unknown' };
        }
      }
    } catch (error) {
      console.warn('[STATE-SERVICE] Error parsing command:', error.message);
    }
    return { action: 'unknown' };
  }

  /**
   * Execute a natural language command
   */
  async executeCommand(command, context = {}) {
    try {
      const response = await fetch(`${this.apiBase}/api/states/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command,
          context: {
            ...context,
            currentStateId: this.currentStateId,
            workspace_path: context.workspace_path || window.state?.currentWorkspace
          }
        })
      });

      if (response.ok) {
        try {
          const data = await response.json();
          if (data.success) {
            // Update current state if switched
            if (data.action === 'switch' && data.result?.state) {
              this.currentStateId = data.result.state.id;
            }
            return data;
          }
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return { success: false, error: 'Invalid response format' };
        }
      }
    } catch (error) {
      console.error('[STATE-SERVICE] Error executing command:', error);
      throw error;
    }
    return { success: false, error: 'Command execution failed' };
  }

  /**
   * Semantic search states
   */
  async searchStates(query, filters = {}) {
    try {
      const response = await fetch(`${this.apiBase}/api/states/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          workspace_path: filters.workspace_path || window.state?.currentWorkspace,
          filters
        })
      });

      if (response.ok) {
        try {
          const data = await response.json();
          return data.states || [];
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return [];
        }
      }
    } catch (error) {
      console.warn('[STATE-SERVICE] Error searching states:', error.message);
    }
    return [];
  }

  /**
   * Get state recommendations
   */
  async getRecommendations(workspacePath = null) {
    try {
      const url = new URL(`${this.apiBase}/api/states/recommendations`);
      if (workspacePath) {
        url.searchParams.set('workspace_path', workspacePath);
      }

      const response = await fetch(url);
      if (response.ok) {
        try {
          const data = await response.json();
          return data.recommendations || [];
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return [];
        }
      }
    } catch (error) {
      console.warn('[STATE-SERVICE] Error getting recommendations:', error.message);
    }
    return [];
  }

  /**
   * List all states
   */
  async listStates(filters = {}) {
    try {
      const url = new URL(`${this.apiBase}/api/states`);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });

      const response = await fetch(url);
      if (response.ok) {
        try {
          const data = await response.json();
          return data.states || [];
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return [];
        }
      }
    } catch (error) {
      console.warn('[STATE-SERVICE] Error listing states:', error.message);
    }
    return [];
  }

  /**
   * Create a new state
   */
  async createState(name, description, metadata = {}) {
    try {
      // Get current events for context
      const events = window.state?.data?.events || [];
      const fileChanges = events.filter(e => e.type === 'file_change' || e.type === 'code_change');

      const response = await fetch(`${this.apiBase}/api/states`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          metadata: {
            ...metadata,
            workspace_path: metadata.workspace_path || window.state?.currentWorkspace
          },
          events: events.slice(-20), // Recent events
          fileChanges: fileChanges.slice(-10)
        })
      });

      if (response.ok) {
        try {
          const data = await response.json();
          return data.state;
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return null;
        }
      }
    } catch (error) {
      console.error('[STATE-SERVICE] Error creating state:', error);
      throw error;
    }
    return null;
  }

  /**
   * Fork a state
   */
  async forkState(stateId, name, description, metadata = {}) {
    try {
      const events = window.state?.data?.events || [];
      const fileChanges = events.filter(e => e.type === 'file_change' || e.type === 'code_change');

      const response = await fetch(`${this.apiBase}/api/states/${stateId}/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description,
          metadata,
          events: events.slice(-20),
          fileChanges: fileChanges.slice(-10)
        })
      });

      if (response.ok) {
        try {
          const data = await response.json();
          return data.state;
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return null;
        }
      }
    } catch (error) {
      console.error('[STATE-SERVICE] Error forking state:', error);
      throw error;
    }
    return null;
  }

  /**
   * Get state diff
   */
  async getStateDiff(stateId1, stateId2) {
    try {
      const response = await fetch(`${this.apiBase}/api/states/${stateId1}/diff/${stateId2}`);
      if (response.ok) {
        try {
          const data = await response.json();
          return data.diff;
        } catch (parseError) {
          console.warn('[STATE-SERVICE] Error parsing JSON response:', parseError);
          return null;
        }
      }
    } catch (error) {
      console.warn('[STATE-SERVICE] Error getting state diff:', error.message);
    }
    return null;
  }
}

// Export singleton - DISABLED: States feature removed from UI
if (typeof window !== 'undefined') {
  window.StateService = StateService;
  // Don't create stateService instance - states feature is disabled
  // window.stateService = new StateService();
}

