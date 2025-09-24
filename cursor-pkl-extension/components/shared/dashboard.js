// Dashboard JavaScript functionality
class Dashboard {
  constructor() {
    this.sessions = [];
    this.stats = null;
    this.visualizations = [];
    this.currentView = 'sessions';
    this.charts = {};
    this.liveDurations = {};
    this.durationUpdateInterval = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.render();
    // Delay chart rendering to ensure DOM is ready
    setTimeout(() => this.renderCharts(), 100);
    // Start live duration updates
    this.startLiveDurationUpdates();
    // Setup search functionality
    this.setupSearch();
  }

  async loadData() {
    try {
      console.log('Loading data...');
      
      // Load sessions and stats in parallel
      const [sessionsResponse, statsResponse] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/stats')
      ]);
      
      if (!sessionsResponse.ok || !statsResponse.ok) {
        throw new Error(`HTTP error! sessions: ${sessionsResponse.status}, stats: ${statsResponse.status}`);
      }
      
      const [sessionsData, statsData] = await Promise.all([
        sessionsResponse.json(),
        statsResponse.json()
      ]);
      
      console.log('Data loaded:', { sessions: sessionsData, stats: statsData });
      
      if (sessionsData.success && statsData.success) {
        this.sessions = sessionsData.sessions;
        this.stats = statsData.stats;
        console.log('Sessions loaded:', this.sessions.length);
        console.log('Stats loaded:', this.stats);
        this.updateStats();
      } else {
        console.error('Failed to load data:', { sessions: sessionsData.error, stats: statsData.error });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Show user-friendly message
      this.showError('Failed to load session data. Please check if the server is running.');
    }
  }

  updateStats() {
    // Use stats from API if available, otherwise calculate from sessions
    if (this.stats) {
      console.log('Updating stats from API:', this.stats);
      
      // Update compact stats
      this.updateStatCard('total-sessions', this.stats.totalSessions || 0);
      this.updateStatCard('total-changes', this.stats.totalChanges || 0);
      this.updateStatCard('avg-duration', this.formatDuration(this.stats.avgSessionDuration * 60 || 0));
      this.updateStatCard('active-sessions', this.stats.activeSessions || 0);
      this.updateStatCard('total-conversations', this.stats.totalConversations || 0);
    } else {
      // Fallback to calculating from sessions data
      const totalSessions = this.sessions.length;
      const activeSessions = this.sessions.filter(s => s.outcome === 'in-progress').length;
      const totalChanges = this.sessions.reduce((sum, s) => sum + (s.codeDeltas?.length || 0), 0);
      
      console.log('Updating stats from sessions:', {
        totalSessions,
        activeSessions,
        totalChanges
      });

      // Update compact stats
      this.updateStatCard('total-sessions', totalSessions);
      this.updateStatCard('total-changes', totalChanges);
      this.updateStatCard('avg-duration', '0m');
      this.updateStatCard('active-sessions', activeSessions);
      this.updateStatCard('total-conversations', 0);
    }
  }

  updateStatCard(id, value) {
    const element = document.getElementById(id);
    if (element) {
      // Format certain values for better display
      let displayValue = value;
      
      if (id === 'avg-prompt-length' && value > 1000) {
        displayValue = (value / 1000).toFixed(1) + 'k';
      } else if (id === 'total-changes' && value > 1000) {
        displayValue = (value / 1000).toFixed(1) + 'k';
      } else if (typeof value === 'number' && value !== Math.floor(value)) {
        displayValue = value.toFixed(1);
      }
      
      element.textContent = displayValue;
    }
  }

  showError(message) {
    const container = document.getElementById('sessions-list');
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <div class="error-icon">!</div>
          <h3>Error Loading Data</h3>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="window.dashboard?.refreshData()">Retry</button>
        </div>
      `;
    }
  }

  // Live Duration Methods
  startLiveDurationUpdates() {
    // Update durations every 5 seconds
    this.durationUpdateInterval = setInterval(async () => {
      await this.updateLiveDurations();
    }, 5000);
    
    // Initial load
    this.updateLiveDurations();
  }

  async updateLiveDurations() {
    try {
      const response = await fetch('/api/sessions/live-durations');
      const data = await response.json();
      
      if (data.success) {
        this.liveDurations = data.durations;
        this.updateDurationDisplays();
      }
    } catch (error) {
      console.error('Error updating live durations:', error);
    }
  }

  updateDurationDisplays() {
    // Update duration displays in session list
    document.querySelectorAll('[data-session-id]').forEach(element => {
      const sessionId = element.getAttribute('data-session-id');
      const durationElement = element.querySelector('.session-duration');
      
      if (durationElement && this.liveDurations[sessionId]) {
        const duration = this.liveDurations[sessionId];
        durationElement.textContent = duration.formatted;
        durationElement.setAttribute('title', `Started: ${new Date(duration.startTime).toLocaleString()}`);
        
        // Add visual indicator for active sessions
        if (duration.isActive) {
          durationElement.classList.add('live-duration');
        }
      }
    });

    // Update duration in session detail modal if open
    const modal = document.getElementById('sessionDetailModal');
    if (modal && modal.style.display === 'block') {
      const sessionId = modal.getAttribute('data-session-id');
      if (sessionId && this.liveDurations[sessionId]) {
        const durationElement = modal.querySelector('.modal-duration');
        if (durationElement) {
          durationElement.textContent = this.liveDurations[sessionId].formatted;
        }
      }
    }
  }

  formatDuration(durationMs) {
    if (!durationMs || durationMs < 0) return '0s';
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  stopLiveDurationUpdates() {
    if (this.durationUpdateInterval) {
      clearInterval(this.durationUpdateInterval);
      this.durationUpdateInterval = null;
    }
  }

  setupEventListeners() {
    // View toggle buttons
    const sessionsBtn = document.getElementById('sessions-view-btn');
    const notebooksBtn = document.getElementById('notebooks-view-btn');
    const visualizationsBtn = document.getElementById('visualizations-view-btn');
    const embeddingsBtn = document.getElementById('embeddings-view-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    
    if (sessionsBtn) {
      sessionsBtn.addEventListener('click', () => {
        console.log('Switching to sessions view');
        this.switchView('sessions');
      });
    }
    
    if (notebooksBtn) {
      notebooksBtn.addEventListener('click', () => {
        console.log('Switching to notebooks view');
        this.switchView('notebooks');
      });
    }

    if (visualizationsBtn) {
      visualizationsBtn.addEventListener('click', () => {
        console.log('Switching to visualizations view');
        this.switchView('visualizations');
      });
    }
    
    if (embeddingsBtn) {
      embeddingsBtn.addEventListener('click', () => {
        console.log('Switching to embeddings view');
        this.switchView('embeddings');
      });
    }
    
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        console.log('Refreshing data');
        this.refreshData();
      });
    }

    // Process notebooks button
    const processNotebooksBtn = document.getElementById('process-notebooks-btn');
    if (processNotebooksBtn) {
      processNotebooksBtn.addEventListener('click', async () => {
        await this.processExistingNotebooks();
      });
    }

    // Test intent classification button
    const testIntentBtn = document.getElementById('test-intent-btn');
    if (testIntentBtn) {
      testIntentBtn.addEventListener('click', async () => {
        await this.testIntentClassification();
      });
    }
  }

  switchView(view) {
    this.currentView = view;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${view}-view-btn`)?.classList.add('active');
    
    // Update content
    if (view === 'sessions') {
      this.renderSessionsView();
    } else if (view === 'notebooks') {
      this.renderNotebooksView();
    } else if (view === 'visualizations') {
      this.renderVisualizationsView();
    } else if (view === 'embeddings') {
      this.renderEmbeddingsView();
    }
  }

  render() {
    if (this.sessions.length === 0) {
      this.renderEmptyState();
    } else {
      // Switch to notebooks view by default as requested
      this.currentView = 'notebooks';
      this.renderNotebooksView();
    }
    
    // Mark dashboard as loaded to prevent FOUC
    setTimeout(() => {
      const dashboard = document.querySelector('.dashboard');
      if (dashboard) {
        dashboard.classList.add('loaded');
      }
    }, 100); // Small delay to ensure stylesheets are applied
  }

  renderEmptyState() {
    const container = document.getElementById('sessions-list');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
          </div>
          <h3 class="empty-state-title">No Active Sessions</h3>
          <p class="empty-state-description">
            Open a .ipynb file in Cursor IDE to start tracking your coding sessions and AI interactions.
          </p>
          <div class="empty-state-actions">
            <button class="btn btn-primary" onclick="refreshData()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
              </svg>
              Refresh
            </button>
            <button class="btn btn-secondary" onclick="openHelp()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Help
            </button>
          </div>
        </div>
      `;
    }
  }

  renderSessionsView() {
    const container = document.getElementById('sessions-list');
    if (!container) return;

    if (this.sessions.length === 0) {
      this.renderEmptyState();
      return;
    }

    const sessionsHtml = this.sessions.map(session => this.renderSessionItem(session)).join('');
    container.innerHTML = `
      <div class="sessions-header">
        <h2 class="sessions-title">Session History</h2>
        <p class="sessions-subtitle">${this.sessions.length} sessions found</p>
      </div>
      <div class="sessions-content">
        ${sessionsHtml}
      </div>
    `;
  }

  renderSessionItem(session) {
    const fileName = session.currentFile ? session.currentFile.split('/').pop() : 'Unknown file';
    const time = new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const changes = (session.codeDeltas?.length || 0) + (session.fileChanges?.length || 0);
    const intent = session.intent || 'explore';
    const outcome = session.outcome || 'in-progress';
    
    // Get live duration if available
    const liveDuration = this.liveDurations[session.id];
    const durationDisplay = liveDuration ? this.formatDuration(liveDuration.duration) : '0s';

    // Compact format matching plan wireframe: dot 12:30  debug  main.py   checkmark
    return `
      <div class="session-item" data-session-id="${session.id}" onclick="showSessionDetail('${session.id}')">
        <div class="session-main">
          <span class="session-time">${time}</span>
          <span class="session-intent ${intent}">${intent}</span>
          <span class="session-file">${fileName}</span>
        </div>
        <div class="session-status">
          <span class="session-outcome ${outcome}">${this.getOutcomeIcon(outcome)}</span>
          <span class="session-changes">${changes}</span>
        </div>
      </div>
    `;
  }

  getOutcomeIcon(outcome) {
    switch (outcome) {
      case 'success': return 'OK';
      case 'stuck': return 'X';
      case 'in-progress': return '*';
      default: return '?';
    }
  }

  renderNotebooksView() {
    const container = document.getElementById('sessions-list');
    if (!container) return;

    if (this.sessions.length === 0) {
      this.renderEmptyState();
      return;
    }

    const notebooks = this.groupSessionsByNotebook();
    const notebooksHtml = Object.entries(notebooks).map(([notebook, sessions]) => 
      this.renderNotebookCard(notebook, sessions)
    ).join('');

    container.innerHTML = `
      <div class="sessions-header">
        <h2 class="sessions-title">Notebook Grid</h2>
        <p class="sessions-subtitle">${Object.keys(notebooks).length} notebooks found</p>
      </div>
      <div class="notebooks-grid">
        ${notebooksHtml}
      </div>
    `;
  }

  groupSessionsByNotebook() {
    const groups = {};
    this.sessions.forEach(session => {
      const notebook = session.currentFile || 'Unknown';
      if (!groups[notebook]) {
        groups[notebook] = [];
      }
      groups[notebook].push(session);
    });
    return groups;
  }

  renderNotebookCard(notebook, sessions) {
    const totalChanges = sessions.reduce((sum, s) => sum + (s.codeDeltas?.length || 0) + (s.fileChanges?.length || 0), 0);
    const activeSessions = sessions.filter(s => s.outcome === 'IN_PROGRESS').length;
    const completedSessions = sessions.filter(s => s.outcome === 'COMPLETED').length;

    return `
      <div class="notebook-card">
        <div class="notebook-header">
          <h3 class="notebook-title">${notebook.split('/').pop()}</h3>
          <div class="notebook-stats">
            <span class="notebook-stat">${sessions.length} sessions</span>
            <span class="notebook-stat">${totalChanges} changes</span>
          </div>
        </div>
        <div class="notebook-content">
          <div class="notebook-sessions">
            <div class="session-summary">
              <span class="session-count active">${activeSessions} active</span>
              <span class="session-count completed">${completedSessions} completed</span>
            </div>
            <div class="recent-sessions">
              <h4>Recent Sessions</h4>
              ${sessions.slice(0, 3).map(s => `
                <div class="recent-session" onclick="showSessionDetail('${s.id}')">
                  <span class="recent-session-time">${new Date(s.timestamp).toLocaleTimeString()}</span>
                  <span class="recent-session-intent ${this.getIntentClass(s.intent)}">${this.getDisplayIntent(s.intent)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getIntentClass(intent) {
    const intentMap = {
      'EXPLORE': 'explore',
      'data_exploration': 'explore',
      'IMPLEMENT': 'implement',
      'implementation': 'implement',
      'DEBUG': 'debug',
      'debug': 'debug'
    };
    return intentMap[intent] || 'unknown';
  }

  getOutcomeClass(outcome) {
    const outcomeMap = {
      'COMPLETED': 'completed',
      'IN_PROGRESS': 'in-progress',
      'FAILED': 'failed'
    };
    return outcomeMap[outcome] || 'unknown';
  }

  getDisplayIntent(intent) {
    const intentMap = {
      'EXPLORE': 'Explore',
      'data_exploration': 'Explore',
      'IMPLEMENT': 'Implement',
      'implementation': 'Implement',
      'DEBUG': 'Debug',
      'debug': 'Debug'
    };
    return intentMap[intent] || 'Unknown';
  }

  getDisplayOutcome(outcome) {
    const outcomeMap = {
      'COMPLETED': 'Completed',
      'IN_PROGRESS': 'In Progress',
      'FAILED': 'Failed'
    };
    return outcomeMap[outcome] || 'Unknown';
  }

  async refreshData() {
    await this.loadData();
    this.render();
    this.renderCharts();
  }

  async processExistingNotebooks() {
    try {
      console.log('Processing existing notebooks...');
      
      // Show loading state
      const processBtn = document.getElementById('process-notebooks-btn');
      if (processBtn) {
        processBtn.disabled = true;
        processBtn.textContent = 'Processing...';
      }

      const response = await fetch('/api/process-existing-notebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Notebooks processed successfully:', result);
        
        // Show success message
        this.showNotification(`Processed ${result.sessionsCreated} sessions with ${result.totalCodeDeltas} code deltas`, 'success');
        
        // Refresh the data
        await this.refreshData();
      } else {
        console.error('Failed to process notebooks:', result.error);
        this.showNotification('Failed to process notebooks: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error processing notebooks:', error);
      this.showNotification('Error processing notebooks: ' + error.message, 'error');
    } finally {
      // Reset button state
      const processBtn = document.getElementById('process-notebooks-btn');
      if (processBtn) {
        processBtn.disabled = false;
        processBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
          Process Notebooks
        `;
      }
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 1000;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    
    // Set background color based on type
    if (type === 'success') {
      notification.style.backgroundColor = '#10B981';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#EF4444';
    } else {
      notification.style.backgroundColor = '#3B82F6';
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }

  async testIntentClassification() {
    try {
      console.log('Testing intent classification...');
      
      // Show loading state
      const testBtn = document.getElementById('test-intent-btn');
      if (testBtn) {
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
      }

      // Get the first session for testing
      if (this.sessions.length === 0) {
        this.showNotification('No sessions available for testing', 'error');
        return;
      }

      const testSession = this.sessions[0];
      console.log('Testing intent classification for session:', testSession.id);

      const response = await fetch(`/api/session/${testSession.id}/classify-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Intent classification result:', result);
        
        const classification = result.classification;
        const clioStatus = result.clioAvailable ? 'Available' : 'Not Available';
        
        // Show detailed results
        this.showIntentClassificationResults(classification, clioStatus);
        
        this.showNotification(`Intent classified as: ${classification.primary_intent} (${(classification.confidence * 100).toFixed(1)}% confidence)`, 'success');
      } else {
        console.error('Failed to classify intent:', result.error);
        this.showNotification('Failed to classify intent: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error testing intent classification:', error);
      this.showNotification('Error testing intent classification: ' + error.message, 'error');
    } finally {
      // Reset button state
      const testBtn = document.getElementById('test-intent-btn');
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 12l2 2 4-4"></path>
            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
            <path d="M13 12h3a2 2 0 0 1 2 2v1"></path>
            <path d="M13 12H9a2 2 0 0 0-2 2v1"></path>
          </svg>
          Test Intent Classification
        `;
      }
    }
  }

  showIntentClassificationResults(classification, clioStatus) {
    // Create modal for detailed results
    const modal = document.createElement('div');
    modal.className = 'intent-classification-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #1f2937;">Intent Classification Results</h2>
        <button onclick="this.closest('.intent-classification-modal').remove()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; margin-bottom: 10px;">Primary Intent</h3>
        <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
          <strong>${classification.primary_intent}</strong> (${(classification.confidence * 100).toFixed(1)}% confidence)
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; margin-bottom: 10px;">Analysis Sources</h3>
        <div style="background: #f3f4f6; padding: 12px; border-radius: 6px;">
          <div>Clio Status: <strong>${clioStatus}</strong></div>
          <div>Evidence: ${Object.keys(classification.evidence || {}).join(', ')}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; margin-bottom: 10px;">All Evidences</h3>
        <div style="max-height: 200px; overflow-y: auto;">
          ${(classification.all_evidences || []).map(evidence => `
            <div style="background: #f9fafb; padding: 8px; border-radius: 4px; margin-bottom: 8px; border-left: 3px solid #3b82f6;">
              <strong>${evidence.intent}</strong> (${(evidence.confidence * 100).toFixed(1)}%) - Source: ${evidence.source || 'unknown'}
            </div>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #374151; margin-bottom: 10px;">Intent Scores</h3>
        <div style="max-height: 200px; overflow-y: auto;">
          ${Object.entries(classification.intent_scores || {}).map(([intent, data]) => `
            <div style="background: #f9fafb; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
              <strong>${intent}</strong>: ${(data.total_score * 100).toFixed(1)}% (${data.evidence_count} evidences)
            </div>
          `).join('')}
        </div>
      </div>

      <div style="text-align: right;">
        <button onclick="this.closest('.intent-classification-modal').remove()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  renderCharts() {
    if (this.sessions.length === 0) {
      console.log('No sessions to render charts');
      return;
    }
    console.log('Rendering charts with', this.sessions.length, 'sessions');
    this.renderActivityChart();
    this.renderIntentChart();
  }

  renderActivityChart() {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.activity) {
      this.charts.activity.destroy();
      this.charts.activity = null;
    }

    // Group sessions by date
    const sessionsByDate = {};
    this.sessions.forEach(session => {
      const date = new Date(session.timestamp).toDateString();
      if (!sessionsByDate[date]) {
        sessionsByDate[date] = { sessions: 0, changes: 0 };
      }
      sessionsByDate[date].sessions++;
      sessionsByDate[date].changes += (session.codeDeltas?.length || 0) + (session.fileChanges?.length || 0);
    });

    const dates = Object.keys(sessionsByDate).sort();
    const sessionCounts = dates.map(date => sessionsByDate[date].sessions);
    const changeCounts = dates.map(date => sessionsByDate[date].changes);

    this.charts.activity = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Sessions',
          data: sessionCounts,
          borderColor: 'rgb(0, 122, 255)',
          backgroundColor: 'rgba(0, 122, 255, 0.1)',
          tension: 0.4,
          yAxisID: 'y'
        }, {
          label: 'Changes',
          data: changeCounts,
          borderColor: 'rgb(52, 199, 89)',
          backgroundColor: 'rgba(52, 199, 89, 0.1)',
          tension: 0.4,
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Sessions'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Changes'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    });
  }

  renderIntentChart() {
    const ctx = document.getElementById('intentChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.intent) {
      this.charts.intent.destroy();
      this.charts.intent = null;
    }

    // Count sessions by intent
    const intentCounts = {};
    this.sessions.forEach(session => {
      const intent = session.intent || 'Unknown';
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });

    const intents = Object.keys(intentCounts);
    const counts = Object.values(intentCounts);
    const colors = [
      'rgb(0, 122, 255)',    // Blue for EXPLORE
      'rgb(52, 199, 89)',    // Green for IMPLEMENT
      'rgb(255, 149, 0)',    // Orange for DEBUG
      'rgb(255, 59, 48)',    // Red for other
      'rgb(175, 82, 222)'    // Purple for other
    ];

    this.charts.intent = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: intents,
        datasets: [{
          data: counts,
          backgroundColor: colors.slice(0, intents.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom'
          }
        }
      }
    });
  }

  // Visualization methods
  async loadVisualizations() {
    try {
      console.log('Loading visualizations...');
      const response = await fetch('/api/visualizations');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        this.visualizations = data.sessions || [];
        console.log('Visualizations loaded:', this.visualizations.length, 'sessions with visualizations');
      } else {
        console.error('Failed to load visualizations:', data.error);
      }
    } catch (error) {
      console.error('Error loading visualizations:', error);
      this.showError('Failed to load visualizations. Please check if the server is running.');
    }
  }

  async renderVisualizationsView() {
    console.log('Rendering visualizations view');
    
    // Load visualizations if not already loaded
    if (this.visualizations.length === 0) {
      await this.loadVisualizations();
    }

    const container = document.getElementById('sessions-list');
    
    if (this.visualizations.length === 0) {
      container.innerHTML = `
        <div class="no-visualizations">
          <div class="no-visualizations-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21,15 16,10 5,21"></polyline>
            </svg>
          </div>
          <h3>No Visualizations Found</h3>
          <p>No charts or plots found in your notebook sessions. Create some visualizations in your Jupyter notebooks to see them here.</p>
          <button class="btn btn-primary" onclick="refreshData()">Refresh Data</button>
        </div>
      `;
      return;
    }

    const visualizationsHtml = this.visualizations.map(session => {
      const fileName = session.file.split('/').pop();
      const sessionTime = new Date(session.timestamp).toLocaleString();
      
      const visualizationsCards = session.visualizations.map((viz, index) => {
        const typeClass = viz.type;
        let previewHtml = '';
        
        if (viz.type === 'image' && viz.format === 'png') {
          previewHtml = `<img src="data:image/png;base64,${viz.data}" alt="Visualization ${index + 1}">`;
        } else if (viz.type === 'image' && viz.format === 'svg') {
          previewHtml = Array.isArray(viz.data) ? viz.data.join('') : viz.data;
        } else if (viz.type === 'html') {
          previewHtml = `<div class="html-content">${viz.data}</div>`;
        } else if (viz.type === 'plotly') {
          previewHtml = `<div class="html-content"><pre>${JSON.stringify(viz.data, null, 2).slice(0, 500)}...</pre></div>`;
        }
        
        return `
          <div class="visualization-card">
            <div class="visualization-header">
              <div class="visualization-title">
                Visualization ${index + 1}
                <span class="visualization-type-badge ${typeClass}">${viz.type.toUpperCase()}</span>
              </div>
              <div class="visualization-meta">
                <span>Cell ${viz.cellIndex + 1}</span>
                <span>Output ${viz.outputIndex + 1}</span>
              </div>
            </div>
            <div class="visualization-preview">
              ${previewHtml}
            </div>
            ${viz.source ? `
              <div class="visualization-source">
                <strong>Source Code:</strong>
                ${viz.source}
              </div>
            ` : ''}
            <div class="visualization-actions">
              <button class="btn btn-sm btn-secondary" onclick="showSessionDetail('${session.sessionId}')">
                View Session
              </button>
              <button class="btn btn-sm btn-secondary" onclick="returnToContext('${session.sessionId}')">
                Open in Cursor
              </button>
            </div>
          </div>
        `;
      }).join('');
      
      return `
        <div class="notebook-section">
          <div class="notebook-header">
            <h3 class="notebook-title">${fileName}</h3>
            <div class="notebook-meta">
              <span>${sessionTime}</span>
              <span>${session.total} visualizations</span>
            </div>
          </div>
          <div class="visualizations-grid">
            ${visualizationsCards}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = visualizationsHtml;
  }

  async renderEmbeddingsView() {
    console.log('Rendering embeddings view');
    
    const container = document.getElementById('sessions-list');
    
    // Create UMAP visualization container
    container.innerHTML = `
      <div class="embeddings-container">
        <div class="embeddings-header">
          <h2>Session Embeddings Visualization (UMAP)</h2>
          <p>Interactive visualization of session relationships using UMAP dimensionality reduction</p>
        </div>
        
        <div class="embeddings-controls">
          <div class="control-group">
            <label for="color-by-select">Color by:</label>
            <select id="color-by-select">
              <option value="intent">Intent</option>
              <option value="outcome">Outcome</option>
              <option value="duration">Duration</option>
              <option value="file-type">File Type</option>
            </select>
          </div>
          <div class="control-group">
            <label for="size-by-select">Size by:</label>
            <select id="size-by-select">
              <option value="uniform">Uniform</option>
              <option value="duration">Duration</option>
              <option value="changes">Code Changes</option>
              <option value="conversations">Conversations</option>
            </select>
          </div>
          <div class="control-group">
            <button class="btn btn-secondary btn-sm" id="reset-zoom-btn">Reset Zoom</button>
            <button class="btn btn-secondary btn-sm" id="fullscreen-btn">Fullscreen</button>
          </div>
        </div>
        
        <div class="umap-container">
          <div id="umap-plot" class="umap-plot"></div>
          <div class="umap-legend" id="umap-legend"></div>
        </div>
        
        <div class="selection-info" id="selection-info">
          <h3>Selection Details</h3>
          <div id="selection-content">
            <p>Click on points or draw a selection box to see session details</p>
          </div>
        </div>
      </div>
    `;
    
    // Load and render UMAP data
    await this.loadAndRenderUMAP();
    
    // Setup UMAP controls
    this.setupUMAPControls();
  }

  async loadAndRenderUMAP() {
    try {
      console.log('Loading UMAP data...');
      
      // Try to load from Kura/OpenClio analysis first
      let umapData = await this.loadUMAPFromAnalysis();
      
      // If no analysis data, generate mock UMAP data from sessions
      if (!umapData || umapData.length === 0) {
        console.log('No analysis data found, generating mock UMAP data');
        umapData = this.generateMockUMAPData();
      }
      
      this.renderUMAPPlot(umapData);
      
    } catch (error) {
      console.error('Error loading UMAP data:', error);
      this.showUMAPError('Failed to load UMAP data. Using mock data for demonstration.');
      const mockData = this.generateMockUMAPData();
      this.renderUMAPPlot(mockData);
    }
  }

  async loadUMAPFromAnalysis() {
    try {
      // Try to load from the analysis API
      const response = await fetch('/api/analysis/kura/clusters');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.umap_coordinates) {
          return data.umap_coordinates;
        }
      }
    } catch (error) {
      console.log('Analysis API not available, using mock data');
    }
    return null;
  }

  generateMockUMAPData() {
    const intents = ['explore', 'implement', 'debug', 'refactor'];
    const outcomes = ['completed', 'in-progress', 'failed'];
    const fileTypes = ['ipynb', 'py', 'js', 'md'];
    
    return this.sessions.map((session, index) => {
      // Generate UMAP-like coordinates (2D projection)
      const angle = (index / this.sessions.length) * 2 * Math.PI;
      const radius = Math.random() * 3 + 1;
      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.5;
      const y = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.5;
      
      return {
        id: session.id,
        x: x,
        y: y,
        intent: session.intent || intents[Math.floor(Math.random() * intents.length)],
        outcome: session.outcome || outcomes[Math.floor(Math.random() * outcomes.length)],
        duration: session.duration || Math.random() * 3600,
        changes: session.codeDeltas ? session.codeDeltas.length : Math.floor(Math.random() * 20),
        conversations: session.conversations ? session.conversations.length : Math.floor(Math.random() * 10),
        fileType: session.currentFile ? session.currentFile.split('.').pop() : fileTypes[Math.floor(Math.random() * fileTypes.length)],
        timestamp: session.timestamp,
        fileName: session.currentFile ? session.currentFile.split('/').pop() : 'Unknown'
      };
    });
  }

  renderUMAPPlot(data) {
    const container = document.getElementById('umap-plot');
    if (!container || !data || data.length === 0) {
      this.showUMAPError('No data available for UMAP visualization');
      return;
    }

    // Prepare traces for different intents
    const intentColors = {
      'explore': '#007AFF',
      'implement': '#34C759', 
      'debug': '#FF9500',
      'refactor': '#AF52DE'
    };

    const traces = {};
    
    // Group data by intent
    data.forEach(point => {
      const intent = point.intent || 'unknown';
      if (!traces[intent]) {
        traces[intent] = {
          x: [],
          y: [],
          text: [],
          mode: 'markers',
          type: 'scatter',
          name: intent.charAt(0).toUpperCase() + intent.slice(1),
          marker: {
            color: intentColors[intent] || '#8E8E93',
            size: this.calculatePointSize(point),
            opacity: 0.7,
            line: {
              width: 1,
              color: 'white'
            }
          },
          hovertemplate: 
            '<b>%{text}</b><br>' +
            'Intent: ' + intent + '<br>' +
            'Outcome: ' + (point.outcome || 'unknown') + '<br>' +
            'Duration: ' + this.formatDuration(point.duration) + '<br>' +
            'Changes: ' + (point.changes || 0) + '<br>' +
            'Conversations: ' + (point.conversations || 0) + '<br>' +
            '<extra></extra>'
        };
      }
      
      traces[intent].x.push(point.x);
      traces[intent].y.push(point.y);
      traces[intent].text.push(point.fileName || `Session ${point.id}`);
    });

    const plotData = Object.values(traces);

    const layout = {
      title: {
        text: 'Session Relationships (UMAP Projection)',
        font: { size: 18, color: '#1A1A1A' }
      },
      xaxis: {
        title: 'UMAP Dimension 1',
        showgrid: true,
        zeroline: false,
        gridcolor: '#E5E5EA'
      },
      yaxis: {
        title: 'UMAP Dimension 2',
        showgrid: true,
        zeroline: false,
        gridcolor: '#E5E5EA'
      },
      hovermode: 'closest',
      showlegend: true,
      legend: {
        x: 1,
        y: 1,
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: 'rgba(255,255,255,0.8)',
        bordercolor: '#E5E5EA',
        borderwidth: 1
      },
      margin: { t: 60, r: 150, b: 60, l: 60 },
      plot_bgcolor: '#F8F9FA',
      paper_bgcolor: 'white',
      dragmode: 'select'
    };

    const config = {
      displayModeBar: true,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
      displaylogo: false,
      responsive: true
    };

    Plotly.newPlot(container, plotData, layout, config);

    // Handle selection events
    container.on('plotly_selected', (eventData) => {
      this.handleUMAPSelection(eventData);
    });

    container.on('plotly_click', (eventData) => {
      this.handleUMAPClick(eventData);
    });

    this.umapPlot = container;
  }

  calculatePointSize(point) {
    const baseSize = 8;
    const maxSize = 20;
    
    // Size based on duration (normalized)
    const durationSize = Math.min(maxSize, baseSize + (point.duration / 3600) * 5);
    
    return durationSize;
  }

  formatDuration(seconds) {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  handleUMAPSelection(eventData) {
    const selectionInfo = document.getElementById('selection-content');
    if (!selectionInfo) return;

    if (eventData && eventData.points && eventData.points.length > 0) {
      const selectedPoints = eventData.points;
      let html = `<h4>Selected Sessions (${selectedPoints.length})</h4>`;
      
      selectedPoints.forEach((point, index) => {
        html += `
          <div class="selected-session">
            <strong>${point.text}</strong><br>
            Intent: ${point.data.name}<br>
            <button class="btn btn-sm btn-secondary" onclick="showSessionDetail('${point.pointIndex}')">
              View Details
            </button>
          </div>
        `;
      });
      
      selectionInfo.innerHTML = html;
    } else {
      selectionInfo.innerHTML = '<p>Click on points or draw a selection box to see session details</p>';
    }
  }

  handleUMAPClick(eventData) {
    if (eventData && eventData.points && eventData.points.length > 0) {
      const point = eventData.points[0];
      console.log('Clicked on session:', point.text);
      // You can add more detailed session view here
    }
  }

  setupUMAPControls() {
    const colorBySelect = document.getElementById('color-by-select');
    const sizeBySelect = document.getElementById('size-by-select');
    const resetZoomBtn = document.getElementById('reset-zoom-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    if (colorBySelect) {
      colorBySelect.addEventListener('change', () => {
        console.log('Color by changed to:', colorBySelect.value);
        // Re-render plot with new color scheme
        this.loadAndRenderUMAP();
      });
    }

    if (sizeBySelect) {
      sizeBySelect.addEventListener('change', () => {
        console.log('Size by changed to:', sizeBySelect.value);
        // Re-render plot with new size scheme
        this.loadAndRenderUMAP();
      });
    }

    if (resetZoomBtn) {
      resetZoomBtn.addEventListener('click', () => {
        if (this.umapPlot) {
          Plotly.relayout(this.umapPlot, {
            'xaxis.autorange': true,
            'yaxis.autorange': true
          });
        }
      });
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (this.umapPlot) {
          Plotly.Plots.resize(this.umapPlot);
        }
      });
    }
  }

  showUMAPError(message) {
    const container = document.getElementById('sessions-list');
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>UMAP Visualization Error</h3>
          <p>${message}</p>
          <button class="btn btn-primary" onclick="window.dashboard.loadAndRenderUMAP()">
            Retry
          </button>
        </div>
      `;
    }
  }

  setupSearch() {
    const searchInput = document.getElementById('search-input');
    const intentFilter = document.getElementById('intent-filter');
    const outcomeFilter = document.getElementById('outcome-filter');
    
    if (searchInput) {
      // Search input with debouncing
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.filterSessions();
        }, 300);
      });
      
      // Keyboard shortcut (Cmd+K)
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          searchInput.focus();
        }
      });
    }
    
    if (intentFilter) {
      intentFilter.addEventListener('change', () => this.filterSessions());
    }
    
    if (outcomeFilter) {
      outcomeFilter.addEventListener('change', () => this.filterSessions());
    }
  }

  filterSessions() {
    const searchInput = document.getElementById('search-input');
    const intentFilter = document.getElementById('intent-filter');
    const outcomeFilter = document.getElementById('outcome-filter');
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    const intentFilter_value = intentFilter?.value || '';
    const outcomeFilter_value = outcomeFilter?.value || '';
    
    let filteredSessions = this.sessions;
    
    // Apply text search
    if (searchTerm) {
      filteredSessions = filteredSessions.filter(session => {
        const fileName = session.currentFile ? session.currentFile.split('/').pop().toLowerCase() : '';
        const intent = (session.intent || '').toLowerCase();
        const sessionId = session.id.toLowerCase();
        
        return fileName.includes(searchTerm) || 
               intent.includes(searchTerm) || 
               sessionId.includes(searchTerm);
      });
    }
    
    // Apply intent filter
    if (intentFilter_value) {
      filteredSessions = filteredSessions.filter(session => session.intent === intentFilter_value);
    }
    
    // Apply outcome filter
    if (outcomeFilter_value) {
      filteredSessions = filteredSessions.filter(session => session.outcome === outcomeFilter_value);
    }
    
    // Re-render sessions with filtered results
    this.renderFilteredSessions(filteredSessions);
  }

  renderFilteredSessions(filteredSessions) {
    const container = document.getElementById('sessions-list');
    if (!container) return;
    
    if (filteredSessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </div>
          <h3>No sessions found</h3>
          <p>Try adjusting your search criteria or filters.</p>
          <button class="btn btn-secondary" onclick="clearSearch()">Clear Search</button>
        </div>
      `;
      return;
    }
    
    const sessionsHtml = filteredSessions.map(session => this.renderSessionItem(session)).join('');
    container.innerHTML = `
      <div class="sessions-header">
        <h2 class="sessions-title">Session History</h2>
        <p class="sessions-subtitle">${filteredSessions.length} of ${this.sessions.length} sessions</p>
      </div>
      <div class="sessions-content">
        ${sessionsHtml}
      </div>
    `;
  }
}

// Global functions for backward compatibility
function refreshData() {
  if (window.dashboard) {
    window.dashboard.refreshData();
  }
}

function openHelp() {
  alert('Help: Open a .ipynb file in Cursor IDE to start tracking sessions.');
}

function clearSearch() {
  const searchInput = document.getElementById('search-input');
  const intentFilter = document.getElementById('intent-filter');
  const outcomeFilter = document.getElementById('outcome-filter');
  
  if (searchInput) searchInput.value = '';
  if (intentFilter) intentFilter.value = '';
  if (outcomeFilter) outcomeFilter.value = '';
  
  if (window.dashboard) {
    window.dashboard.filterSessions();
  }
}

function showSessionDetail(sessionId) {
  if (!window.dashboard) return;
  
  const session = window.dashboard.sessions.find(s => s.id === sessionId);
  if (!session) {
    console.error('Session not found:', sessionId);
    return;
  }
  
  // Show session detail modal
  const modal = document.getElementById('sessionDetailModal');
  const title = document.getElementById('session-detail-title');
  const body = document.getElementById('session-detail-body');
  
  if (!modal || !title || !body) {
    console.error('Modal elements not found');
    return;
  }
  
  const time = new Date(session.timestamp).toLocaleString();
  const changes = (session.codeDeltas?.length || 0) + (session.fileChanges?.length || 0);
  const fileName = session.currentFile ? session.currentFile.split('/').pop() : 'Unknown';
  
  title.textContent = `Session: ${fileName} - ${time}`;
  
  // Fetch conversations for this session
  let conversationsHtml = '<div class="loading">Loading conversations...</div>';
  
  body.innerHTML = `
    <div class="session-detail-section">
      <h4>Overview</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <label>Session ID:</label>
          <span>${session.id}</span>
        </div>
        <div class="detail-item">
          <label>File:</label>
          <span>${session.currentFile || 'Unknown'}</span>
        </div>
        <div class="detail-item">
          <label>Intent:</label>
          <span class="session-intent ${session.intent?.toLowerCase()}">${window.dashboard.getDisplayIntent(session.intent)}</span>
        </div>
        <div class="detail-item">
          <label>Outcome:</label>
          <span class="session-outcome ${window.dashboard.getOutcomeClass(session.outcome || session.phase)}">${window.dashboard.getDisplayOutcome(session.outcome || session.phase)}</span>
        </div>
        <div class="detail-item">
          <label>Duration:</label>
          <span class="modal-duration">${session.duration ? this.formatDuration(session.duration) : 'Calculating...'}</span>
        </div>
      </div>
    </div>
    
    <div class="session-detail-section">
      <h4>Statistics</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${changes}</div>
          <div class="stat-label">Total Changes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${session.codeDeltas?.length || 0}</div>
          <div class="stat-label">Code Deltas</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${session.fileChanges?.length || 0}</div>
          <div class="stat-label">File Changes</div>
        </div>
      </div>
    </div>
    
    <div class="session-detail-section">
      <h4>Conversations</h4>
      <div id="session-conversations">
        ${conversationsHtml}
      </div>
    </div>
    
    <div class="session-detail-section">
      <h4>Code Changes</h4>
      <div class="code-changes">
        ${session.codeDeltas?.slice(0, 5).map(delta => `
          <div class="code-delta">
            <div class="delta-header">
              <span class="delta-type">${delta.changeType}</span>
              <span class="delta-lines">${delta.lineCount} lines</span>
            </div>
            <pre class="delta-content">${delta.afterContent.slice(0, 200)}${delta.afterContent.length > 200 ? '...' : ''}</pre>
          </div>
        `).join('') || '<p>No code changes recorded</p>'}
        ${(session.codeDeltas?.length || 0) > 5 ? `<p class="more-changes">... and ${(session.codeDeltas?.length || 0) - 5} more changes</p>` : ''}
      </div>
    </div>
    
    <div class="session-actions">
      <button class="btn btn-primary" onclick="returnToContext('${session.id}')">Return to Context</button>
      <button class="btn btn-secondary" onclick="exportSession('${session.id}')">Export Session</button>
      <button class="btn btn-secondary" onclick="closeSessionDetail()">Close</button>
    </div>
  `;
  
  modal.setAttribute('data-session-id', sessionId);
  modal.style.display = 'block';
  
  // Load conversations asynchronously
  loadSessionConversations(sessionId);
}

async function loadSessionConversations(sessionId) {
  try {
    const response = await fetch(`/api/session/${sessionId}/conversations`);
    const data = await response.json();
    
    const conversationsContainer = document.getElementById('session-conversations');
    if (!conversationsContainer) return;
    
    if (data.success && data.conversations.length > 0) {
      const conversationsHtml = data.conversations.map(conv => `
        <div class="conversation-item">
          <div class="conversation-header">
            <span class="conversation-role ${conv.role}">${conv.role === 'user' ? 'User' : 'Assistant'}</span>
            <span class="conversation-time">${new Date(conv.timestamp).toLocaleString()}</span>
          </div>
          <div class="conversation-content">${conv.content}</div>
          ${conv.codeBlocks && conv.codeBlocks.length > 0 ? `
            <div class="conversation-code-blocks">
              ${conv.codeBlocks.map(code => `
                <pre class="code-block"><code>${code}</code></pre>
              `).join('')}
            </div>
          ` : ''}
          ${conv.referencedFiles && conv.referencedFiles.length > 0 ? `
            <div class="conversation-files">
              <small>Referenced files: ${conv.referencedFiles.map(f => f.split('/').pop()).join(', ')}</small>
            </div>
          ` : ''}
        </div>
      `).join('');
      
      conversationsContainer.innerHTML = conversationsHtml;
    } else {
      conversationsContainer.innerHTML = '<div class="no-conversations">No conversations found for this session.</div>';
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
    const conversationsContainer = document.getElementById('session-conversations');
    if (conversationsContainer) {
      conversationsContainer.innerHTML = '<div class="error">Failed to load conversations.</div>';
    }
  }
}

function switchView(view) {
  if (window.dashboard) {
    window.dashboard.switchView(view);
  }
}

function closeSessionDetail() {
  const modal = document.getElementById('sessionDetailModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function returnToContext(sessionId) {
  try {
    console.log('Return to context for session:', sessionId);
    
    // Show loading state
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = 'Opening...';
    button.disabled = true;
    
    // Make API call to restore context
    const response = await fetch(`/api/session/${sessionId}/return-to-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('Session context restored successfully');
      
      // Show success feedback
      button.textContent = 'Opened in Cursor';
      button.classList.add('btn-success');
      
      // Reset button after delay
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.classList.remove('btn-success');
      }, 2000);
      
      // Optionally close the modal
      setTimeout(() => {
        closeSessionDetail();
      }, 1500);
      
    } else {
      console.error('Failed to restore context:', result.error);
      
      // Show error feedback
      button.textContent = 'Failed to Open';
      button.classList.add('btn-error');
      
      // Reset button after delay
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        button.classList.remove('btn-error');
      }, 2000);
      
      // Show user-friendly error message
      alert(`Failed to open in Cursor IDE: ${result.error}`);
    }
  } catch (error) {
    console.error('Error calling return to context API:', error);
    
    // Reset button
    const button = event.target;
    button.textContent = 'Return to Context';
    button.disabled = false;
    button.classList.remove('btn-success', 'btn-error', 'btn-loading');
    
    alert('Error: Could not connect to the server. Please ensure the PKL server is running.');
  }
}

function exportSession(sessionId) {
  // Export specific session
  fetch(`/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      options: { sessionId: sessionId }
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      window.open(data.export.downloadUrl, '_blank');
    } else {
      alert('Export failed: ' + data.error);
    }
  })
  .catch(error => {
    console.error('Export error:', error);
    alert('Export failed');
  });
}

function formatDuration(duration) {
  if (typeof duration === 'number') {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  return duration;
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Prevent duplicate initialization
  if (window.dashboard) {
    console.log('Dashboard already initialized');
    return;
  }
  
  console.log('DOM loaded, initializing dashboard...');
  window.dashboard = new Dashboard();
  console.log('Dashboard initialized:', window.dashboard);
});
