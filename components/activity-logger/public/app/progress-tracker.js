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
      text.title = `Companion service not running. Make sure it's started at ${apiBase}. The dashboard will work with cached data.`;
    } else if (displayMessage.includes('Connection failed')) {
      text.title = 'Failed to connect to companion service. Check if the service is running and the API endpoint is correct.';
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
    
    step.done = stepProgress === 100 || stepProgress === null;
    this.current = this.steps.findIndex(s => s.id === stepId);
    
    // Calculate overall progress: (completed steps + current step progress) / total steps
    const completedSteps = this.steps.filter(s => s.done).length;
    const currentStepPercent = stepProgress !== null ? stepProgress / 100 : 0;
    const overallPercent = Math.round(((completedSteps + currentStepPercent) / this.steps.length) * 100);
    
    const label = stepProgress !== null ? `${step.label}... ${stepProgress}%` : step.label;
    
    updateConnectionStatus(false, label, overallPercent);
    console.log(`[PROGRESS] ${label} (${overallPercent}% overall)`);
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
                           error.message?.includes('Failed to fetch');
    
    const apiBase = window.APIClient?.getApiBase() || window.CONFIG?.API_BASE || 'http://localhost:43917';
    const errorMessage = isNetworkError
      ? `Offline - using cached data (service at ${apiBase} not reachable)`
      : `Connection failed - ${error.message || 'Unknown error'}`;
    
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

