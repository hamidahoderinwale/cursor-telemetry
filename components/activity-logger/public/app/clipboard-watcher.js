/**
 * Clipboard Watcher
 * Handles clipboard monitoring and auto-logging
 * Extracted from app.js for better organization
 */

let clipboardWatcherActive = false;
let lastClipboardContent = '';

/**
 * Start clipboard watcher
 */
async function startClipboardWatcher() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    console.error('Clipboard API not supported');
    if (window.showNotification) {
      window.showNotification('Clipboard API not supported in this browser', 'error');
    }
    return false;
  }

  try {
    // Test clipboard access
    await navigator.clipboard.readText();
    
    clipboardWatcherActive = true;
    if (window.logEvent) {
      await window.logEvent('clipboard_enabled');
    }
    updateClipboardStatus();
    if (window.showNotification) {
      window.showNotification('Clipboard watcher started - copy content to auto-log', 'success');
    }
    return true;
    
  } catch (error) {
    console.error('Clipboard permission denied:', error);
    
    if (error.name === 'NotAllowedError') {
      if (window.showNotification) {
        window.showNotification('Clipboard permission required. Click "Request Permission" button to enable.', 'warning');
      }
    } else {
      if (window.showNotification) {
        window.showNotification('Clipboard access failed. Please try again or check browser settings.', 'error');
      }
    }
    return false;
  }
}

/**
 * Stop clipboard watcher
 */
async function stopClipboardWatcher() {
  clipboardWatcherActive = false;
  if (window.logEvent) {
    await window.logEvent('clipboard_disabled');
  }
  if (window.showNotification) {
    window.showNotification('Clipboard watcher stopped', 'success');
  }
  updateClipboardStatus();
}

/**
 * Toggle clipboard watcher
 */
async function toggleClipboardWatcher() {
  if (clipboardWatcherActive) {
    await stopClipboardWatcher();
  } else {
    const currentSession = window.currentSession;
    if (!currentSession) {
      if (window.showNotification) {
        window.showNotification('Please start a session first', 'error');
      }
      return;
    }
    await startClipboardWatcher();
  }
}

/**
 * Update clipboard status display
 */
function updateClipboardStatus() {
  const companionAvailable = window.companionAvailable || false;
  const domWatcherActive = window.domWatcherActive || false;
  const diffPollerActive = window.diffPollerActive || false;
  const fileDetectorActive = window.fileDetectorActive || false;
  
  // Check if any telemetry system is active
  const anySystemActive = companionAvailable || clipboardWatcherActive || domWatcherActive || diffPollerActive || fileDetectorActive;
  
  const telemetryStatus = document.getElementById('telemetryStatus');
  if (telemetryStatus) {
    if (companionAvailable) {
      telemetryStatus.textContent = 'Telemetry ON (Companion)';
    } else {
      telemetryStatus.textContent = anySystemActive ? 'Telemetry ON (Browser)' : 'Telemetry OFF';
    }
    telemetryStatus.className = anySystemActive ? 'status-indicator telemetry-on' : 'status-indicator';
  }
  
  const activeSession = document.getElementById('activeSession');
  const currentSession = window.currentSession;
  if (activeSession && currentSession) {
    activeSession.textContent = `Active Session: ${currentSession.name}`;
  } else if (activeSession) {
    activeSession.textContent = 'No active session';
  }
  
  // Update system status
  if (window.updateSystemStatus) {
    window.updateSystemStatus();
  }
}

/**
 * Handle clipboard copy event
 */
async function handleClipboardCopy(testData = null) {
  if (!clipboardWatcherActive) {
    return;
  }
  
  const currentSession = window.currentSession;
  if (!currentSession) {
    return;
  }

  try {
    const clipboardText = testData || await navigator.clipboard.readText();
    
    // Avoid duplicate entries
    if (clipboardText === lastClipboardContent) {
      return;
    }
    lastClipboardContent = clipboardText;
    
    // Update activity time
    if (window.updateActivityTime) {
      window.updateActivityTime();
    }

    // Parse the copied text
    if (window.parseCopiedText) {
      const parsed = window.parseCopiedText(clipboardText);
      
      if (!parsed.prompt && !parsed.response) {
        return;
      }

      // Create entry automatically
      const entry = {
        session_id: currentSession.id,
        timestamp: new Date().toISOString(),
        source: 'clipboard',
        file_path: parsed.file_path || null,
        prompt: parsed.prompt || null,
        response: parsed.response || null,
        notes: '',
        tags: []
      };
      
      if (window.db && window.db.entries) {
        await window.db.entries.add(entry);
        if (window.logEvent) {
          await window.logEvent('entry_created', { file_path: entry.file_path });
        }
        if (window.renderFeed) {
          await window.renderFeed();
        }
      }
    }
  } catch (error) {
    console.error('Error handling clipboard copy:', error);
  }
}

// Export to window for global access
window.clipboardWatcherActive = clipboardWatcherActive;
window.startClipboardWatcher = startClipboardWatcher;
window.stopClipboardWatcher = stopClipboardWatcher;
window.toggleClipboardWatcher = toggleClipboardWatcher;
window.updateClipboardStatus = updateClipboardStatus;
window.handleClipboardCopy = handleClipboardCopy;

