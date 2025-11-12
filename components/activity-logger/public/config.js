// Configuration for Cursor Telemetry Dashboard
// When deployed to Netlify, connects to Render backend by default
// Users can override with localStorage to use local companion service

// Render backend URL (default for deployed dashboard)
// Use var to allow redeclaration (core/config.js may have already declared it)
var RENDER_BACKEND_URL = window._RENDER_BACKEND_URL || 'https://cursor-telemetry.onrender.com';
window._RENDER_BACKEND_URL = RENDER_BACKEND_URL;

// Determine API base URL
// Check for local development in multiple ways:
// 1. hostname is localhost or 127.0.0.1
// 2. protocol is file:// (opened as local file)
// 3. port is a common development port (3000-9999)
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isFileProtocol = window.location.protocol === 'file:';
const isDevPort = window.location.port && parseInt(window.location.port) >= 3000 && parseInt(window.location.port) <= 9999;
const isLocal = isLocalhost || isFileProtocol || isDevPort;

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

