/**
 * Live Dashboard JavaScript
 * Handles session loading and display for the main dashboard
 */

class LiveDashboard {
    constructor() {
        this.sessions = [];
        this.isLoading = false;
        this.refreshInterval = null;
        this.socket = null;
        this.liveDurations = {};
        
        this.initializeDashboard();
    }

    async initializeDashboard() {
        console.log('Initializing Live Dashboard...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize WebSocket connection
        this.initializeWebSocket();
        
        // Load initial data
        await this.loadSessions();
        
        // Set default view to sessions
        this.switchView('sessions');
        
        // Set up auto-refresh every 30 seconds (fallback)
        this.startAutoRefresh();
        
        console.log('Live Dashboard initialized successfully');
    }

    setupEventListeners() {
        // Add any event listeners here
        console.log('Event listeners set up');
    }

    initializeWebSocket() {
        try {
            // Initialize Socket.IO client
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to WebSocket server');
                this.updateConnectionStatus(true);
                
                // Request initial data
                this.socket.emit('request-sessions');
                this.socket.emit('request-live-durations');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from WebSocket server');
                this.updateConnectionStatus(false);
            });
            
            this.socket.on('sessions-update', (sessions) => {
                console.log('Received sessions update:', sessions.length, 'sessions');
                this.sessions = sessions;
                this.renderSessions();
                this.updateStatistics();
            });
            
            this.socket.on('session-updated', (session) => {
                console.log('Session updated:', session.id);
                // Update specific session in the list
                const index = this.sessions.findIndex(s => s.id === session.id);
                if (index >= 0) {
                    this.sessions[index] = session;
                } else {
                    this.sessions.push(session);
                }
                this.renderSessions();
                this.updateStatistics();
            });
            
            this.socket.on('live-durations-update', (durations) => {
                this.liveDurations = durations;
                this.updateLiveDurations();
            });
            
            this.socket.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.showError('WebSocket error: ' + error.message);
            });
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.showError('Failed to connect to real-time updates');
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        if (statusDot && statusText) {
            if (connected) {
                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Real-time monitoring active';
            } else {
                statusDot.className = 'status-dot disconnected';
                statusText.textContent = 'Connection lost - using fallback';
            }
        }
    }

    updateLiveDurations() {
        // Update live duration displays in the UI
        Object.entries(this.liveDurations).forEach(([sessionId, durationData]) => {
            const durationElement = document.querySelector(`[data-session-id="${sessionId}"] .session-duration`);
            if (durationElement) {
                durationElement.textContent = durationData.formatted;
                durationElement.className = `session-duration ${durationData.isActive ? 'active' : 'inactive'}`;
            }
        });
    }

    async loadSessions() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading(true);
        
        try {
            console.log('Loading sessions...');
            
            // Add timeout to prevent hanging requests
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch('/api/sessions', {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.sessions = data.sessions || [];
                console.log(`Loaded ${this.sessions.length} sessions`);
                this.renderSessions();
                this.updateStatistics();
            } else {
                throw new Error(data.error || 'Failed to load sessions');
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            if (error.name === 'AbortError') {
                this.showError('Request timed out. Please try again.');
            } else {
                this.showError('Failed to load sessions: ' + error.message);
            }
            this.sessions = [];
            this.renderSessions();
            this.updateStatistics();
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    }

    renderSessions() {
        const container = document.getElementById('sessions-list');
        if (!container) {
            console.warn('Sessions container not found');
            return;
        }

        console.log(`Rendering ${this.sessions.length} sessions`);

        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No sessions found</div>';
            return;
        }

        // Clear the container completely
        container.innerHTML = '';

        const sessionsHtml = this.sessions.map(session => `
            <div class="session-card" data-session-id="${session.id}">
                <div class="session-header">
                    <div class="session-title-section">
                        <h3 class="session-title">${session.intent || 'Unknown Intent'}</h3>
                        <div class="session-badges">
                            <span class="session-status ${session.outcome || 'in_progress'}">${session.outcome || 'In Progress'}</span>
                            ${session.confidence ? `<span class="confidence-badge">${Math.round(session.confidence * 100)}%</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="session-details">
                    <div class="session-info">
                        <div class="info-item">
                            <span class="info-icon">File:</span>
                            <span class="info-text">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown File'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">Time:</span>
                            <span class="info-text">${new Date(session.timestamp).toLocaleString()}</span>
                        </div>
                        ${session.duration ? `
                        <div class="info-item">
                            <span class="info-icon">Duration:</span>
                            <span class="info-text">${this.formatDuration(session.duration)}</span>
                        </div>
                        ` : ''}
                        ${session.codeDeltas && session.codeDeltas.length > 0 ? `
                        <div class="info-item">
                            <span class="info-icon">Changes:</span>
                            <span class="info-text">${session.codeDeltas.length} changes</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="session-actions">
                    <button class="btn btn-sm btn-primary" onclick="dashboard.viewSession('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        View Details
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="dashboard.returnToContext('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"></path>
                        </svg>
                        Return to Context
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = sessionsHtml;
    }

    updateStatistics() {
        const totalSessions = this.sessions.length;
        const activeSessions = this.sessions.filter(s => 
            s.outcome === 'in_progress' || 
            s.outcome === 'IN_PROGRESS' || 
            !s.outcome
        ).length;
        const completedSessions = this.sessions.filter(s => 
            s.outcome === 'success' || 
            s.outcome === 'SUCCESS' ||
            s.outcome === 'completed' ||
            s.outcome === 'COMPLETED'
        ).length;
        const failedSessions = this.sessions.filter(s => 
            s.outcome === 'failed' || 
            s.outcome === 'FAILED' ||
            s.outcome === 'error' ||
            s.outcome === 'ERROR'
        ).length;

        // Calculate additional statistics
        const totalChanges = this.sessions.reduce((sum, session) => {
            return sum + (session.codeDeltas ? session.codeDeltas.length : 0);
        }, 0);

        const totalConversations = this.sessions.reduce((sum, session) => {
            return sum + (session.conversations ? session.conversations.length : 0);
        }, 0);

        const sessionsWithDuration = this.sessions.filter(s => s.duration && s.duration > 0);
        const avgDuration = sessionsWithDuration.length > 0 
            ? sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0) / sessionsWithDuration.length
            : 0;

        // Update statistics display if elements exist
        const statsElements = {
            'total-sessions': totalSessions,
            'active-sessions': activeSessions,
            'completed-sessions': completedSessions,
            'failed-sessions': failedSessions,
            'total-changes': totalChanges,
            'total-conversations': totalConversations,
            'avg-duration': avgDuration > 0 ? this.formatDuration(avgDuration) : '-'
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        console.log(`Statistics updated: ${totalSessions} total, ${activeSessions} active, ${completedSessions} completed, ${failedSessions} failed, ${totalChanges} changes, ${totalConversations} conversations`);
    }

    async viewSession(sessionId) {
        try {
            console.log(`Viewing session: ${sessionId}`);
            
            const response = await fetch(`/api/session/${sessionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Display session details in a modal or new page
                this.showSessionDetails(data.session);
            } else {
                throw new Error(data.error || 'Failed to load session details');
            }
        } catch (error) {
            console.error('Error viewing session:', error);
            this.showError('Failed to load session details: ' + error.message);
        }
    }

    async returnToContext(sessionId) {
        try {
            console.log(`Returning to context for session: ${sessionId}`);
            
            const response = await fetch(`/api/session/${sessionId}/return-to-context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showSuccess('Session context restored in Cursor IDE');
            } else {
                throw new Error(data.error || 'Failed to restore context');
            }
        } catch (error) {
            console.error('Error returning to context:', error);
            this.showError('Failed to restore context: ' + error.message);
        }
    }


    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.classList.remove('hidden');
                loadingOverlay.classList.add('show-flex');
            } else {
                loadingOverlay.classList.remove('show-flex');
                loadingOverlay.classList.add('hidden');
            }
        }
        
        // Also show loading state in the sessions list
        const sessionsList = document.getElementById('sessions-list');
        if (sessionsList && show) {
            sessionsList.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>Loading sessions...</p>
                </div>
            `;
        }
    }

    showError(message) {
        console.error(message);
        // You could implement a proper error display here
        alert('Error: ' + message);
    }

    showSuccess(message) {
        console.log(message);
        // You could implement a proper success display here
        alert('Success: ' + message);
    }

    showSessionDetails(session) {
        const modal = document.getElementById('sessionDetailModal');
        const title = document.getElementById('session-detail-title');
        const body = document.getElementById('session-detail-body');
        
        if (modal && title && body) {
            title.textContent = `Session: ${session.intent || 'Unknown Intent'}`;
            body.innerHTML = `
                <div class="session-detail-content">
                    <div class="detail-section">
                        <h3>Session Information</h3>
                        <p><strong>ID:</strong> ${session.id}</p>
                        <p><strong>Intent:</strong> ${session.intent || 'Unknown'}</p>
                        <p><strong>Outcome:</strong> ${session.outcome || 'In Progress'}</p>
                        <p><strong>File:</strong> ${session.currentFile || 'Unknown'}</p>
                        <p><strong>Timestamp:</strong> ${new Date(session.timestamp).toLocaleString()}</p>
                    </div>
                    ${session.summary ? `
                    <div class="detail-section">
                        <h3>Summary</h3>
                        <p>${session.summary}</p>
                    </div>
                    ` : ''}
                    ${session.codeDeltas && session.codeDeltas.length > 0 ? `
                    <div class="detail-section">
                        <h3>Code Changes (${session.codeDeltas.length})</h3>
                        <div class="code-deltas">
                            <div id="code-deltas-preview">
                                ${session.codeDeltas.slice(0, 5).map(delta => {
                                    const changeType = delta.afterContent && delta.beforeContent ? 'Modified' : 
                                                     delta.afterContent ? 'Added' : 
                                                     delta.beforeContent ? 'Removed' : 'Unknown';
                                    const content = delta.afterContent || delta.beforeContent || 'No content';
                                    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
                                    return `
                                        <div class="code-delta">
                                            <strong>${changeType}:</strong> ${preview}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div id="code-deltas-full" style="display: none;">
                                ${session.codeDeltas.map(delta => {
                                    const changeType = delta.afterContent && delta.beforeContent ? 'Modified' : 
                                                     delta.afterContent ? 'Added' : 
                                                     delta.beforeContent ? 'Removed' : 'Unknown';
                                    const content = delta.afterContent || delta.beforeContent || 'No content';
                                    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
                                    return `
                                        <div class="code-delta">
                                            <strong>${changeType}:</strong> ${preview}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            ${session.codeDeltas.length > 5 ? `
                                <p class="expandable-link" onclick="toggleCodeDeltas('${session.id}')" style="cursor: pointer; color: var(--primary-color); text-decoration: underline;">
                                    ... and ${session.codeDeltas.length - 5} more changes
                                </p>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            modal.classList.remove('hidden');
            modal.classList.add('show-block');
        }
    }

    closeSessionDetail() {
        const modal = document.getElementById('sessionDetailModal');
        if (modal) {
            modal.classList.remove('show-block');
            modal.classList.add('hidden');
        }
    }

    toggleCodeDeltas(sessionId) {
        const preview = document.getElementById('code-deltas-preview');
        const full = document.getElementById('code-deltas-full');
        const expandLink = document.querySelector('.expandable-link');
        
        if (preview && full && expandLink) {
            if (full.style.display === 'none') {
                // Show full list
                preview.style.display = 'none';
                full.style.display = 'block';
                expandLink.textContent = 'Show less';
            } else {
                // Show preview
                preview.style.display = 'block';
                full.style.display = 'none';
                expandLink.textContent = expandLink.textContent.replace('Show less', '... and ' + (full.children.length - 5) + ' more changes');
            }
        }
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

    switchView(viewType) {
        // Remove active class from all view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        const activeBtn = document.getElementById(`${viewType}-view-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Handle view switching logic
        const sessionsList = document.getElementById('sessions-list');
        if (!sessionsList) return;
        
        switch(viewType) {
            case 'sessions':
                this.renderSessions();
                break;
            case 'notebooks':
                this.renderNotebooks();
                break;
            case 'visualizations':
                this.renderVisualizations();
                break;
            case 'embeddings':
                this.renderEmbeddings();
                break;
            default:
                this.renderSessions();
        }
    }

    async renderNotebooks() {
        const container = document.getElementById('sessions-list');
        if (!container) return;
        
        const notebookSessions = this.sessions.filter(s => s.currentFile && s.currentFile.endsWith('.ipynb'));
        
        if (notebookSessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No notebook sessions found</div>';
            return;
        }
        
        const notebooksHtml = notebookSessions.map(session => `
            <div class="notebook-card" data-session-id="${session.id}">
                <div class="notebook-header">
                    <h3 class="notebook-title">${session.currentFile.split('/').pop()}</h3>
                    <span class="notebook-status ${session.outcome || 'in_progress'}">${session.outcome || 'In Progress'}</span>
                </div>
                <div class="notebook-info">
                    <p class="notebook-intent">Intent: ${session.intent || 'Unknown Intent'}</p>
                    <p class="notebook-time">Time: ${new Date(session.timestamp).toLocaleString()}</p>
                    ${session.codeDeltas && session.codeDeltas.length > 0 ? 
                        `<p class="notebook-changes">${session.codeDeltas.length} changes</p>` : ''}
                </div>
                <div class="notebook-actions">
                    <button class="btn btn-sm btn-primary" onclick="dashboard.viewSession('${session.id}')">View Details</button>
                    <button class="btn btn-sm btn-secondary" onclick="dashboard.returnToContext('${session.id}')">Open in Cursor</button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = `<div class="notebooks-grid">${notebooksHtml}</div>`;
    }

    async renderVisualizations() {
        const container = document.getElementById('sessions-list');
        if (!container) return;
        
        try {
            const response = await fetch('/api/visualizations');
            const data = await response.json();
            
            if (data.success && data.sessions.length > 0) {
                const visualizationsHtml = data.sessions.map(session => `
                    <div class="visualization-card">
                        <div class="viz-header">
                            <h3 class="viz-title">${session.file.split('/').pop()}</h3>
                            <span class="viz-count">${session.total} visualizations</span>
                        </div>
                        <div class="viz-preview">
                            <p>Contains ${session.total} visualization(s)</p>
                            <p>Last modified: ${new Date(session.timestamp).toLocaleString()}</p>
                        </div>
                        <div class="viz-actions">
                            <button class="btn btn-sm btn-primary" onclick="dashboard.viewSession('${session.sessionId}')">View Session</button>
                        </div>
                    </div>
                `).join('');
                
                container.innerHTML = `<div class="visualizations-grid">${visualizationsHtml}</div>`;
            } else {
                container.innerHTML = '<div class="no-sessions">No visualizations found</div>';
            }
        } catch (error) {
            console.error('Error loading visualizations:', error);
            container.innerHTML = '<div class="no-sessions">Error loading visualizations</div>';
        }
    }

    async renderEmbeddings() {
        const container = document.getElementById('sessions-list');
        if (!container) return;
        
        try {
            const response = await fetch('/api/sessions/analyze-with-kura');
            const data = await response.json();
            
            if (data.success && data.umap_coordinates) {
                container.innerHTML = `
                    <div class="embeddings-container">
                        <div class="embeddings-info">
                            <h3>UMAP Embeddings</h3>
                            <p>${data.total_sessions} sessions mapped to 2D space</p>
                            <p>Click "Enhanced Kura View" to see the interactive UMAP visualization</p>
                        </div>
                        <div class="embeddings-preview">
                            <div class="embedding-stats">
                                <div class="stat">
                                    <span class="stat-value">${data.total_sessions}</span>
                                    <span class="stat-label">Total Sessions</span>
                                </div>
                                <div class="stat">
                                    <span class="stat-value">${data.clusters.length}</span>
                                    <span class="stat-label">Clusters</span>
                                </div>
                            </div>
                        </div>
                        <div class="embeddings-actions">
                            <button class="btn btn-primary" onclick="window.location.href='/dashboard/enhanced'">
                                View Interactive UMAP
                            </button>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = '<div class="no-sessions">No embedding data available</div>';
            }
        } catch (error) {
            console.error('Error loading embeddings:', error);
            container.innerHTML = '<div class="no-sessions">Error loading embeddings</div>';
        }
    }

    startAutoRefresh() {
        // Refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadSessions();
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    window.dashboard = new LiveDashboard();
    
    // Make functions globally available for HTML onclick handlers
    window.closeSessionDetail = function() {
        if (window.dashboard) {
            window.dashboard.closeSessionDetail();
        }
    };
    
    window.refreshData = function() {
        if (window.dashboard) {
            window.dashboard.loadSessions();
        }
    };
    
    window.openHelp = function() {
        // Simple help implementation - could be expanded
        alert('PKL Dashboard Help:\n\n' +
              '• The dashboard shows your Cursor IDE sessions and notebook changes\n' +
              '• Use the search bar to find specific sessions\n' +
              '• Click on sessions to view details\n' +
              '• Use the Enhanced View for advanced analytics\n' +
              '• Sessions are automatically tracked when you work with .ipynb files');
    };
    
    window.toggleCodeDeltas = function(sessionId) {
        if (window.dashboard) {
            window.dashboard.toggleCodeDeltas(sessionId);
        }
    };
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (window.dashboard) {
        window.dashboard.stopAutoRefresh();
    }
});
