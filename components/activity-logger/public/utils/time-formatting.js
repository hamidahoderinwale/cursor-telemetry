/**
 * Time Formatting Utilities
 * Pure utility functions for time formatting (no HTML)
 */

function formatTimeAgo(timestamp) {
  if (!timestamp || isNaN(timestamp)) {
    return 'Unknown time';
  }
  
  const now = Date.now();
  let time;
  
  // Handle various timestamp formats
  if (typeof timestamp === 'string') {
    time = new Date(timestamp).getTime();
  } else if (typeof timestamp === 'number') {
    time = timestamp;
  } else {
    time = new Date(timestamp).getTime();
  }
  
  // Check if time is valid
  if (isNaN(time)) {
    return 'Unknown time';
  }
  
  const diff = now - time;
  
  if (diff < 0) return 'Just now'; // Future timestamps
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Export to window for global access
window.formatTimeAgo = formatTimeAgo;

