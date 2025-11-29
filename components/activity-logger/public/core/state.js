/**
 * Global State Management
 * Enhanced with reactive updates and state change listeners
 */

const state = {
  connected: false,
  currentView: 'dashboard-home',
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
  charts: {}, // Track active Chart.js instances
  loading: {
    events: false,
    prompts: false,
    analytics: false,
    system: false
  },
  errors: {
    events: null,
    prompts: null,
    analytics: null,
    system: null
  }
};

// State change listeners
const stateListeners = {
  view: [],
  data: [],
  stats: [],
  loading: [],
  errors: []
};

/**
 * Subscribe to state changes
 * @param {string} type - Type of state change ('view', 'data', 'stats', 'loading', 'errors')
 * @param {Function} callback - Callback function to call when state changes
 * @returns {Function} Unsubscribe function
 */
function subscribe(type, callback) {
  if (!stateListeners[type]) {
    stateListeners[type] = [];
  }
  stateListeners[type].push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = stateListeners[type].indexOf(callback);
    if (index > -1) {
      stateListeners[type].splice(index, 1);
    }
  };
}

/**
 * Notify listeners of state changes
 * @param {string} type - Type of state change
 * @param {*} oldValue - Previous value
 * @param {*} newValue - New value
 */
function notify(type, oldValue, newValue) {
  if (stateListeners[type]) {
    stateListeners[type].forEach(callback => {
      try {
        callback(newValue, oldValue, state);
      } catch (error) {
        console.error(`[STATE] Error in state listener for ${type}:`, error);
      }
    });
  }
}

/**
 * Safe deep clone that handles circular references
 */
function safeDeepClone(obj) {
  const seen = new WeakSet();
  
  function clone(value) {
    // Handle primitives
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // Handle circular references
    if (seen.has(value)) {
      return undefined; // Skip circular references
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      seen.add(value);
      const cloned = value.map(item => clone(item));
      seen.delete(value);
      return cloned;
    }
    
    // Handle objects
    seen.add(value);
    const cloned = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        try {
          cloned[key] = clone(value[key]);
        } catch (e) {
          // Skip properties that can't be cloned (functions, DOM elements, etc.)
          continue;
        }
      }
    }
    seen.delete(value);
    return cloned;
  }
  
  return clone(obj);
}

/**
 * Update state with reactive notifications
 * @param {Object} updates - State updates
 * @param {boolean} silent - If true, don't notify listeners
 */
function updateState(updates, silent = false) {
  const oldState = safeDeepClone(state);
  
  // Deep merge updates
  Object.keys(updates).forEach(key => {
    if (key === 'data' && typeof updates[key] === 'object') {
      // Merge data objects
      state[key] = { ...state[key], ...updates[key] };
    } else if (key === 'stats' && typeof updates[key] === 'object') {
      // Merge stats objects
      state[key] = { ...state[key], ...updates[key] };
    } else if (key === 'loading' && typeof updates[key] === 'object') {
      // Merge loading objects
      state[key] = { ...state[key], ...updates[key] };
    } else if (key === 'errors' && typeof updates[key] === 'object') {
      // Merge errors objects
      state[key] = { ...state[key], ...updates[key] };
    } else {
      state[key] = updates[key];
    }
  });
  
  // Notify listeners
  if (!silent) {
    Object.keys(updates).forEach(key => {
      if (stateListeners[key]) {
        notify(key, oldState[key], state[key]);
      }
      // Also notify 'data' listeners for data changes
      if (key === 'data' && stateListeners.data) {
        notify('data', oldState.data, state.data);
      }
    });
  }
}

/**
 * Get state value safely
 * @param {string} path - Dot-separated path to state value (e.g., 'data.events')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} State value or default
 */
function getState(path, defaultValue = null) {
  const keys = path.split('.');
  let value = state;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
}

/**
 * Set loading state
 * @param {string} key - Loading key (e.g., 'events', 'prompts')
 * @param {boolean} isLoading - Loading state
 */
function setLoading(key, isLoading) {
  updateState({
    loading: {
      ...state.loading,
      [key]: isLoading
    }
  });
}

/**
 * Set error state
 * @param {string} key - Error key (e.g., 'events', 'prompts')
 * @param {Error|null} error - Error object or null to clear
 */
function setError(key, error) {
  updateState({
    errors: {
      ...state.errors,
      [key]: error ? { message: error.message, stack: error.stack } : null
    }
  });
}

// Export for use in other modules
window.state = state;
window.updateState = updateState;
window.getState = getState;
window.subscribeState = subscribe;
window.setLoading = setLoading;
window.setError = setError;
