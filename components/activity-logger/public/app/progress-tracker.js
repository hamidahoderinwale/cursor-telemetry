/**
 * Progress Tracker Module
 * Tracks initialization progress and updates UI
 */

function updateConnectionStatus(connected, message = null, progress = null) {
  const statusEl = document.getElementById('connectionStatus');
  if (!statusEl) return;

  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');
  const progressContainer = document.getElementById('connectionProgress');
  const progressBar = document.getElementById('connectionProgressBar');

  if (connected) {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
    text.textContent = message || 'Connected';
    text.title = message || 'Connected to companion service';
    
    // Hide progress bar when connected
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
  } else {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
    const displayMessage = message || 'Disconnected';
    text.textContent = displayMessage;
    
    // Show retry button when disconnected
    const retryBtn = document.getElementById('connectionRetryBtn');
    if (retryBtn) {
      retryBtn.style.display = 'flex';
      retryBtn.classList.add('visible');
    }
    
    // Add helpful tooltip for connection issues
    if (displayMessage.includes('not reachable') || displayMessage.includes('Offline')) {
      const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
      text.title = `Companion service not running. Make sure it's started at ${apiBase}. The dashboard will work with cached data. Click "Retry" to test the connection again.`;
    } else if (displayMessage.includes('Connection failed')) {
      const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
      text.title = `Failed to connect to companion service at ${apiBase}. Check if the service is running, then click "Retry" to test the connection again. The dashboard will work with cached data.`;
    } else {
      text.title = displayMessage;
    }
  }
  
  // Hide retry button when connected
  if (connected) {
    const retryBtn = document.getElementById('connectionRetryBtn');
    if (retryBtn) {
      retryBtn.style.display = 'none';
      retryBtn.classList.remove('visible');
    }
  }
  
  // Update progress bar if progress value provided
  if (progress !== null && progressBar && progressContainer) {
    progressContainer.classList.add('active');
    progressBar.style.width = `${progress}%`;
  }
}

const initProgress = {
  steps: [
    { id: 'cache', label: 'Loading cache', done: false },
    { id: 'server', label: 'Connecting to server', done: false },
    { id: 'data', label: 'Fetching data', done: false },
    { id: 'render', label: 'Rendering UI', done: false }
  ],
  current: 0,
  
  update(stepId, stepProgress = null) {
    const step = this.steps.find(s => s.id === stepId);
    if (!step) return;
    
    const wasDone = step.done;
    step.done = stepProgress === 100 || stepProgress === null;
    this.current = this.steps.findIndex(s => s.id === stepId);
    
    // Calculate overall progress accurately
    // Count steps that are fully completed (excluding current step)
    const completedSteps = this.steps.filter(s => s.done && s.id !== stepId).length;
    
    // Get current step's contribution (0-1)
    let currentStepPercent = 0;
    if (stepProgress !== null) {
      // Clamp stepProgress to 0-100 range
      const clampedProgress = Math.max(0, Math.min(100, stepProgress));
      currentStepPercent = clampedProgress / 100;
    } else if (step.done && !wasDone) {
      // If step just became done but no progress value, count as 1.0
      currentStepPercent = 1.0;
    } else if (step.done && wasDone) {
      // Step was already done, don't add to currentStepPercent (it's already in completedSteps)
      currentStepPercent = 0;
    }
    
    // Calculate overall: (completed steps + current step progress) / total steps
    const overallPercent = Math.round(((completedSteps + currentStepPercent) / this.steps.length) * 100);
    
    // Clamp overall percent to 0-100 range to prevent exceeding 100%
    const clampedOverallPercent = Math.max(0, Math.min(100, overallPercent));
    
    const label = stepProgress !== null ? `${step.label}... ${stepProgress}%` : step.label;
    
    updateConnectionStatus(false, label, clampedOverallPercent);
    console.log(`[PROGRESS] ${label} (${clampedOverallPercent}% overall)`);
  },
  
  complete(finalMessage = null) {
    const message = finalMessage || 'Connected';
    updateConnectionStatus(true, message, 100);
    // Hide progress bar after a short delay
    setTimeout(() => {
      const progressContainer = document.getElementById('connectionProgress');
      if (progressContainer) {
        progressContainer.classList.remove('active');
      }
    }, 500);
    console.log('[PROGRESS] Initialization complete');
  }
};

/**
 * Test connection to companion service
 */
async function testConnection() {
  const retryBtn = document.getElementById('connectionRetryBtn');
  if (retryBtn) {
    retryBtn.disabled = true;
    retryBtn.textContent = 'Testing...';
  }
  
  updateConnectionStatus(false, 'Testing connection...');
  
  try {
    const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
    
    // Create abort controller for timeout (compatible with older browsers)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${apiBase}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const health = await response.json();
      if (window.state) {
        window.state.connected = true;
        window.state.companionServiceOnline = true;
      }
      updateConnectionStatus(true, 'Connected to companion service');
      
      // Trigger data refresh
      if (window.fetchRecentData) {
        setTimeout(() => {
          window.fetchRecentData().catch(err => {
            console.warn('[CONNECTION] Data refresh failed:', err.message);
          });
        }, 500);
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const isNetworkError = window.APIClient?.isOfflineError(error) || 
                           error.message?.includes('CORS') || 
                           error.message?.includes('NetworkError') || 
                           error.message?.includes('Failed to fetch') ||
                           error.name === 'AbortError' ||
                           error.name === 'TypeError';
    
    const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
    let errorMessage;
    
    if (isNetworkError) {
      errorMessage = `Offline - using cached data (service at ${apiBase} not reachable)`;
    } else if (error.message?.includes('HTTP')) {
      // HTTP status errors
      const statusMatch = error.message.match(/HTTP (\d+)/);
      const status = statusMatch ? statusMatch[1] : 'unknown';
      errorMessage = `Connection failed (HTTP ${status}) - companion service may be starting up or experiencing issues`;
    } else {
      // Other errors - provide more helpful message
      const errorDetail = error.message || 'Unknown error';
      errorMessage = `Connection failed - ${errorDetail}. Make sure the companion service is running at ${apiBase}`;
    }
    
    updateConnectionStatus(false, errorMessage);
    
    if (window.state) {
      window.state.connected = false;
      window.state.companionServiceOnline = false;
    }
  } finally {
    if (retryBtn) {
      retryBtn.disabled = false;
      retryBtn.textContent = 'Retry';
    }
  }
}

// Export to window for global access
window.updateConnectionStatus = updateConnectionStatus;
window.initProgress = initProgress;
window.testConnection = testConnection;

