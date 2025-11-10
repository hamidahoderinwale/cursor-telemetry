/**
 * Environment-based Configuration
 * This file can be generated at build time with your API URL
 * Or set via Netlify/Vercel environment variables
 */

// Check for environment variable (set by build process or Netlify/Vercel)
// This allows setting API_BASE_URL via environment variables
(function() {
  // Try to get from build-time injection (Netlify/Vercel)
  const apiBase = typeof process !== 'undefined' && process.env && process.env.API_BASE_URL
    ? process.env.API_BASE_URL
    : null;
  
  // Or use a global variable set by build script
  const buildTimeApiBase = typeof window !== 'undefined' && window.__API_BASE_URL__
    ? window.__API_BASE_URL__
    : null;
  
  // Set the API base URL if found
  if (apiBase || buildTimeApiBase) {
    if (!window.CONFIG) {
      window.CONFIG = {};
    }
    window.CONFIG.API_BASE_URL = apiBase || buildTimeApiBase;
    console.log('[CONFIG] Using API base URL from environment:', apiBase || buildTimeApiBase);
  }
})();

