/**
 * Dashboard Configuration
 */

// Use external config (from config.js) if available, otherwise use defaults
const EXTERNAL_CONFIG = window.CONFIG || {};
const DASHBOARD_CONFIG = {
  API_BASE: EXTERNAL_CONFIG.API_BASE_URL || 'http://localhost:43917',
  WS_URL: EXTERNAL_CONFIG.WS_URL || 'ws://localhost:43917',
  REFRESH_INTERVAL: 120000,  // 2 minutes to prevent request overload (down from 30s)
  ENABLE_TF_IDF: false, // Disable TF-IDF by default to save memory
  ENABLE_SEMANTIC_SEARCH: false, // Disable semantic analysis by default
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

// Use DASHBOARD_CONFIG as CONFIG for compatibility
const CONFIG = DASHBOARD_CONFIG;

// Export for use in other modules
window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;
window.CONFIG = CONFIG;
