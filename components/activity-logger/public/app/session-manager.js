/**
 * Session Manager
 * Handles session creation, management, and display
 * Extracted from app.js for better organization
 */

/**
 * Generate a session name based on current date/time
 */
function generateSessionName() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  return `Session ${dateStr} ${timeStr}`;
}

/**
 * Create a new session
 */
async function createNewSession(sessionName = null) {
  const name = sessionName || generateSessionName();
  
  const session = {
    id: generateId(),
    name: name,
    created_at: new Date().toISOString()
  };
  
  try {
    await db.sessions.add(session);
    currentSession = session;
    await logEvent('session_start', { name: session.name });
    updateCurrentSessionDisplay();
    await renderFeed();
    return session;
  } catch (error) {
    console.error('Error creating session:', error);
    showNotification('Failed to create session', 'error');
    return null;
  }
}

/**
 * Create session manually with user input
 */
async function createSessionManually() {
  const name = prompt('Enter session name:', generateSessionName());
  if (name) {
    await createNewSession(name);
  }
}

/**
 * Ensure there's an active session
 */
async function ensureActiveSession() {
  if (!currentSession) {
    await createNewSession();
  }
  return currentSession;
}

/**
 * Update current session display
 */
function updateCurrentSessionDisplay() {
  if (elements.currentSessionInfo) {
    if (currentSession) {
      elements.currentSessionInfo.style.display = 'block';
      if (elements.currentSessionName) {
        elements.currentSessionName.textContent = currentSession.name;
      }
    } else {
      elements.currentSessionInfo.style.display = 'none';
    }
  }
  
  if (elements.activeSession) {
    if (currentSession) {
      elements.activeSession.textContent = `Active Session: ${currentSession.name}`;
    } else {
      elements.activeSession.textContent = 'No active session';
    }
  }
}

// Helper function (should be in utils/helpers.js)
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Export to window for global access
window.generateSessionName = generateSessionName;
window.createNewSession = createNewSession;
window.createSessionManually = createSessionManually;
window.ensureActiveSession = ensureActiveSession;
window.updateCurrentSessionDisplay = updateCurrentSessionDisplay;

