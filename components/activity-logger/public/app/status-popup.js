/**
 * Status Popup Module
 * Handles status message popup display
 */

/**
 * Initialize status popup and console interceptor
 */
function initStatusPopup() {
  const originalConsoleLog = console.log;
  const statusPopupContent = document.getElementById('statusPopupContent');
  
  // Intercept console.log
  console.log = function(...args) {
    // Call original console.log
    originalConsoleLog.apply(console, args);
    
    // Extract message
    const message = args.map(arg => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'object') return JSON.stringify(arg);
      return String(arg);
    }).join(' ');
    
    // Filter for status-relevant messages
    const statusKeywords = ['Initializing', 'Loaded', 'Fetching', 'connected', 'ready', 'error', 'warning'];
    const hasStatusKeyword = statusKeywords.some(keyword => message.includes(keyword));
    
    if (hasStatusKeyword && statusPopupContent) {
      addStatusMessage(message);
    }
  };
  
  // Auto-hide after 10 seconds of last message
  let hideTimeout;
  window.addEventListener('statusMessageAdded', () => {
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      const popup = document.getElementById('statusPopup');
      if (popup && !popup.classList.contains('hidden')) {
        popup.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
          popup.classList.add('hidden');
        }, 300);
      }
    }, 10000);
  });
}

/**
 * Add a status message to the popup
 */
function addStatusMessage(message) {
  const statusPopupContent = document.getElementById('statusPopupContent');
  if (!statusPopupContent) return;
  
  // Determine message type based on content
  let messageClass = 'status-info';
  if (message.includes('Initializing') || message.includes('Fetching') || message.includes('Searching')) {
    messageClass = 'status-init';
  } else if (message.includes('connected') || message.includes('loaded') || message.includes('ready')) {
    messageClass = 'status-success';
  } else if (message.includes('WARNING') || message.includes('warning')) {
    messageClass = 'status-warning';
  } else if (message.includes('[ERROR]')) {
    messageClass = 'status-error';
  }
  
  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = `status-message ${messageClass}`;
  messageEl.textContent = message;
  
  // Add to popup (prepend for newest first)
  statusPopupContent.insertBefore(messageEl, statusPopupContent.firstChild);
  
  // Limit to 50 messages
  if (statusPopupContent.children.length > 50) {
    statusPopupContent.removeChild(statusPopupContent.lastChild);
  }
  
  // Show popup if hidden
  const popup = document.getElementById('statusPopup');
  if (popup && popup.classList.contains('hidden')) {
    popup.classList.remove('hidden');
    popup.style.animation = 'slideInFromTop 0.3s ease-out';
  }
  
  // Dispatch event for auto-hide timer
  window.dispatchEvent(new CustomEvent('statusMessageAdded'));
}

/**
 * Close status popup
 */
function closeStatusPopup() {
  const popup = document.getElementById('statusPopup');
  if (popup) {
    popup.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => {
      popup.classList.add('hidden');
    }, 300);
  }
}

// Export to window for global access
window.initStatusPopup = initStatusPopup;
window.addStatusMessage = addStatusMessage;
window.closeStatusPopup = closeStatusPopup;

