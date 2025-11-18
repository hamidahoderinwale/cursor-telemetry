/**
 * Dashboard Configuration
 */

// Use external config (from config/config.js) if available, otherwise use defaults
const EXTERNAL_CONFIG = window.CONFIG || {};

// Render backend URL
// Store on window to avoid any redeclaration issues
if (!window._RENDER_BACKEND_URL) {
  window._RENDER_BACKEND_URL = 'https://cursor-telemetry.onrender.com';
}
// Use window property directly to avoid variable redeclaration
const RENDER_BACKEND_URL = window._RENDER_BACKEND_URL;

const DASHBOARD_CONFIG = {
  API_BASE: EXTERNAL_CONFIG.API_BASE_URL || RENDER_BACKEND_URL,
  WS_URL: EXTERNAL_CONFIG.WS_URL || RENDER_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://'),
  REFRESH_INTERVAL: 120000,  // 2 minutes to prevent request overload (down from 30s)
  ENABLE_TF_IDF: false, // Disable TF-IDF by default to save memory
  ENABLE_SEMANTIC_SEARCH: false, // Disable semantic analysis by default - MUST be false
  MAX_SEARCH_RESULTS: 50, // Limit search results to prevent memory issues
  CHART_COLORS: {
    primary: '#8B5CF6',
    secondary: '#6366F1',
    accent: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  }
};

// Merge external config values (from config/config.js) into DASHBOARD_CONFIG if they exist
// This allows config/config.js to override defaults, but ensures ENABLE_SEMANTIC_SEARCH stays false unless explicitly set to true
if (EXTERNAL_CONFIG.ENABLE_SEMANTIC_SEARCH === true) {
  DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH = true;
} else {
  DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH = false; // Explicitly set to false
}

// Use DASHBOARD_CONFIG as CONFIG for compatibility
const CONFIG = DASHBOARD_CONFIG;

// Export for use in other modules
window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;
// Only set window.CONFIG if it doesn't already exist (config/config.js will set it later)
if (!window.CONFIG || !window.CONFIG.ENABLE_SEMANTIC_SEARCH) {
  window.CONFIG = CONFIG;
}

// Load HF preference from localStorage if available (after a short delay to ensure localStorage is ready)
setTimeout(() => {
  if (window.loadHuggingFacePreference) {
    window.loadHuggingFacePreference();
  } else {
    // Fallback: check localStorage directly
    try {
      const stored = localStorage.getItem('ENABLE_SEMANTIC_SEARCH');
      if (stored) {
        const enabled = JSON.parse(stored) === true;
        if (window.CONFIG) {
          window.CONFIG.ENABLE_SEMANTIC_SEARCH = enabled;
        }
        if (window.DASHBOARD_CONFIG) {
          window.DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH = enabled;
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
}, 100);
