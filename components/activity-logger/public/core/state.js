/**
 * Global State Management
 */

const state = {
  connected: false,
  currentView: 'overview',
  currentWorkspace: 'all',
  data: {
    events: [],
    entries: [],
    threads: [],
    prompts: [],
    terminalCommands: [],
    workspaces: [],
    systemResources: [],
    gitData: [],
    ideState: null
  },
  stats: {
    sessions: 0,
    fileChanges: 0,
    aiInteractions: 0,
    codeChanged: 0,
    avgContext: 0,
    terminalCommands: 0
  },
  sequence: 0,
  socket: null,
  charts: {} // Track active Chart.js instances
};

// Export for use in other modules
window.state = state;
