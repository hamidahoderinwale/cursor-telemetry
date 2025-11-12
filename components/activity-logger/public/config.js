// Configuration for Cursor Telemetry Dashboard
// When deployed to Netlify, connects to Render backend by default
// Users can override with localStorage to use local companion service

// Render backend URL (default for deployed dashboard)
const RENDER_BACKEND_URL = 'https://cursor-telemetry.onrender.com';

// Determine API base URL
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const customApiUrl = (window.LocalStorageHelper?.get('COMPANION_API_URL', null, false)) || localStorage.getItem('COMPANION_API_URL');
const defaultApiUrl = isLocal ? 'http://localhost:43917' : RENDER_BACKEND_URL;
const apiBaseUrl = customApiUrl || defaultApiUrl;

window.CONFIG = {
  // API Configuration
  // When running locally, uses localhost
  // When deployed, uses Render backend by default (can be overridden via localStorage)
  API_BASE: apiBaseUrl,
  
  // Legacy alias for backward compatibility
  API_BASE_URL: apiBaseUrl,
  
  // WebSocket Configuration
  WS_URL: (() => {
    const customWsUrl = (window.LocalStorageHelper?.get('COMPANION_WS_URL', null, false)) || localStorage.getItem('COMPANION_WS_URL');
    if (customWsUrl) return customWsUrl;
    if (isLocal) return 'ws://localhost:43917';
    // Convert Render HTTPS URL to WSS
    return RENDER_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  })(),
  
  // App Configuration
  APP_NAME: 'Cursor Telemetry Dashboard',
  VERSION: '2.0.0',
  
  // Feature Flags
  FEATURES: {
    SCREENSHOTS: true,
    ANALYTICS: true,
    FILE_GRAPH: true,
    TERMINAL_CAPTURE: true
  },
  
  // Search Configuration
  ENABLE_SEMANTIC_SEARCH: true, // Enable semantic search by default (uses OpenRouter API if available, falls back to Transformers.js)
  ENABLE_TF_IDF: false // Disable TF-IDF by default to save memory
};

// Allow users to configure their companion service URL
window.configureCompanionURL = function(apiUrl, wsUrl) {
  if (apiUrl) {
    if (window.LocalStorageHelper) {
      // Store as string (not JSON) for URL values
      window.LocalStorageHelper.set('COMPANION_API_URL', apiUrl, false);
    } else {
      localStorage.setItem('COMPANION_API_URL', apiUrl);
    }
    window.CONFIG.API_BASE = apiUrl;
    window.CONFIG.API_BASE_URL = apiUrl; // Legacy alias
  }
  if (wsUrl) {
    if (window.LocalStorageHelper) {
      // Store as string (not JSON) for URL values
      window.LocalStorageHelper.set('COMPANION_WS_URL', wsUrl, false);
    } else {
      localStorage.setItem('COMPANION_WS_URL', wsUrl);
    }
    window.CONFIG.WS_URL = wsUrl;
  }
  console.log('Companion URLs configured:', { api: window.CONFIG.API_BASE, ws: window.CONFIG.WS_URL });
  console.log('Reload the page to apply changes');
};

