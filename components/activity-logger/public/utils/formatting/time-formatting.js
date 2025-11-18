/**
 * Time Formatting Utilities
 * Pure utility functions for time formatting (no HTML)
 * 
 * NOTE: formatTimeAgo is now in utils/helpers.js to avoid duplication
 * This file can be extended with additional time formatting functions
 */

// Re-export formatTimeAgo from helpers for backward compatibility
// The actual implementation is in utils/helpers.js
if (window.formatTimeAgo) {
  // Already available from helpers.js
} else {
  // Fallback if helpers.js not loaded
  window.formatTimeAgo = function(timestamp) {
    if (!timestamp) return 'No data';
    const now = Date.now();
    const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    if (isNaN(time) || time <= 0) return 'No data';
    const diff = now - time;
    if (diff < 0) return 'Just now';
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };
}

