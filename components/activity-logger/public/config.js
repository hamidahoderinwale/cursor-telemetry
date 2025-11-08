// Configuration for Cursor Telemetry Dashboard
// This allows the frontend (hosted on Netlify) to connect to local companion service

window.CONFIG = {
  // API Configuration
  // When deployed to Netlify, users will connect to their local companion service
  // When running locally, it uses localhost
  API_BASE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:43917'
    : ((window.LocalStorageHelper?.get('COMPANION_API_URL', null, false)) || localStorage.getItem('COMPANION_API_URL') || 'http://127.0.0.1:43917'),
  
  // Legacy alias for backward compatibility
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:43917'
    : ((window.LocalStorageHelper?.get('COMPANION_API_URL', null, false)) || localStorage.getItem('COMPANION_API_URL') || 'http://127.0.0.1:43917'),
  
  // WebSocket Configuration
  WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'ws://127.0.0.1:43917'
    : ((window.LocalStorageHelper?.get('COMPANION_WS_URL', null, false)) || localStorage.getItem('COMPANION_WS_URL') || 'ws://127.0.0.1:43917'),
  
  // App Configuration
  APP_NAME: 'Cursor Telemetry Dashboard',
  VERSION: '2.0.0',
  
  // Feature Flags
  FEATURES: {
    SCREENSHOTS: true,
    ANALYTICS: true,
    FILE_GRAPH: true,
    TERMINAL_CAPTURE: true
  }
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

