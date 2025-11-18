/**
 * State Management Module
 * Centralized application state
 */

export const state = {
  // Connection Status
  connected: false,
  
  // UI State
  currentView: 'activity',
  currentWorkspace: 'all',
  
  // Data Store
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
  
  // Statistics
  stats: {
    sessions: 0,
    fileChanges: 0,
    aiInteractions: 0,
    codeChanged: 0,
    terminalCommands: 0
  },
  
  // Real-time
  sequence: 0,
  socket: null,
  
  // UI References
  charts: {} // Track active Chart.js instances
};

/**
 * State update helpers
 */
export function updateState(updates) {
  Object.assign(state, updates);
}

export function updateData(dataUpdates) {
  Object.assign(state.data, dataUpdates);
}

export function updateStats(statsUpdates) {
  Object.assign(state.stats, statsUpdates);
}

export function resetState() {
  state.data = {
    events: [],
    entries: [],
    threads: [],
    prompts: [],
    terminalCommands: [],
    workspaces: [],
    systemResources: [],
    gitData: [],
    ideState: null
  };
  state.stats = {
    sessions: 0,
    fileChanges: 0,
    aiInteractions: 0,
    codeChanged: 0,
    terminalCommands: 0
  };
}

export default state;

