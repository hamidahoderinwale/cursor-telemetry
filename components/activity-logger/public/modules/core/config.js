/**
 * Configuration Module
 * Centralized configuration management for the dashboard
 */

export const CONFIG = {
  // API Configuration (merged from external config)
  API_BASE: (window.CONFIG?.API_BASE_URL) || 'http://localhost:43917',
  WS_URL: (window.CONFIG?.WS_URL) || 'ws://localhost:43917',
  
  // Performance & Refresh
  REFRESH_INTERVAL: 5000,
  MIN_REFRESH_INTERVAL: 10000,
  
  // Feature Flags
  ENABLE_TF_IDF: false, // Disable TF-IDF by default to save memory
  ENABLE_SEMANTIC_SEARCH: false, // Disable semantic analysis by default
  MAX_SEARCH_RESULTS: 50, // Limit search results to prevent memory issues
  
  // Chart Colors
  CHART_COLORS: {
    primary: '#8B5CF6',
    secondary: '#6366F1',
    accent: '#EC4899',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  
  // App Metadata
  APP_NAME: window.CONFIG?.APP_NAME || 'Cursor Telemetry Dashboard',
  VERSION: window.CONFIG?.VERSION || '2.0.0',
  
  // Features from external config
  FEATURES: window.CONFIG?.FEATURES || {
    SCREENSHOTS: true,
    ANALYTICS: true,
    FILE_GRAPH: true,
    TERMINAL_CAPTURE: true
  }
};

export default CONFIG;

