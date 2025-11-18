/**
 * Shared utility functions
 */

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) {
    return 'No data';
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
  if (isNaN(time) || time <= 0) {
    return 'No data';
  }
  
  const diff = now - time;
  
  if (diff < 0) return 'Just now'; // Future timestamps
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function cosineSimilarityVector(a, b) {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

// Export to window for global access
window.escapeHtml = escapeHtml;
window.truncate = truncate;
window.formatTimeAgo = formatTimeAgo;
window.cosineSimilarityVector = cosineSimilarityVector;
