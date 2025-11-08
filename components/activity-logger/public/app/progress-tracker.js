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
    
    // Hide progress bar when connected
    if (progressContainer) {
      progressContainer.classList.remove('active');
    }
  } else {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
    text.textContent = message || 'Disconnected';
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
    console.log('[PROGRESS] ✅ Initialization complete');
  }
};

// Export to window for global access
window.updateConnectionStatus = updateConnectionStatus;
window.initProgress = initProgress;

