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
        this.currentView = 'timeline'; // Track current view
        this.enhancedProjectSessionView = null; // Enhanced project/session view
        
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
        
        // Initialize real data visualizations
        this.initializeRealDataVisualizations();
        
        // Set default view to timeline
        this.switchView('timeline');
        
        // Set up auto-refresh every 30 seconds (fallback)
        this.startAutoRefresh();
        
        console.log('Live Dashboard initialized successfully');
    }

    setupEventListeners() {
        // Privacy Analysis Button
        const privacyBtn = document.getElementById('privacy-analysis-btn');
        if (privacyBtn) {
            privacyBtn.addEventListener('click', () => this.openPrivacyModal());
        }
        
        // Info Button
        const infoBtn = document.getElementById('info-btn');
        if (infoBtn) {
            infoBtn.addEventListener('click', () => this.openInfoModal());
        }
        
        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        console.log('Event listeners set up');
    }

    async initializeRealDataVisualizations() {
        try {
            // Load the real data visualizations component
            const script = document.createElement('script');
            script.src = 'components/real-data-visualizations.js';
            script.onload = async () => {
                if (typeof RealDataVisualizations !== 'undefined') {
                    this.realDataVisualizations = new RealDataVisualizations();
                    await this.realDataVisualizations.initialize();
                    console.log('Real data visualizations initialized');
                }
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error initializing real data visualizations:', error);
        }
    }

    initializeWebSocket() {
        try {
            // Check if Socket.IO is available
            if (typeof io === 'undefined') {
                console.warn('Socket.IO not available, skipping WebSocket initialization');
                return;
            }
            
            // Initialize Socket.IO client for main dashboard
            this.socket = io('http://localhost:3000', {
                timeout: 5000,
                forceNew: true
            });
            
            // Initialize companion service WebSocket for real-time file changes
            this.companionSocket = io('http://localhost:3000', {
                timeout: 5000,
                forceNew: true
            });
            
            // Main dashboard WebSocket
            this.socket.on('connect', () => {
                console.log('Connected to main WebSocket server');
                this.updateConnectionStatus(true);
                this.showNotification('Connected to server', 'success');
                
                // Request initial data
                this.socket.emit('request-sessions');
                this.socket.emit('request-live-durations');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from main WebSocket server');
                this.updateConnectionStatus(false);
                this.showNotification('Disconnected from server', 'warning');
            });
            
            this.socket.on('sessions-update', (sessions) => {
                console.log('Received sessions update:', sessions.length, 'sessions');
                const previousCount = this.sessions.length;
                this.sessions = sessions;
                
                // Show notification for new sessions
                if (sessions.length > previousCount) {
                    const newSessions = sessions.length - previousCount;
                    this.showNotification(`${newSessions} new session${newSessions > 1 ? 's' : ''} detected`, 'info');
                }
                
                this.renderCurrentView();
                this.updateStatistics();
            });
            
            this.socket.on('session-updated', (session) => {
                console.log('Session updated:', session.id);
                this.showNotification(`Session updated: ${session.intent || 'Unknown intent'}`, 'info');
                
                // Update specific session in the list
                const index = this.sessions.findIndex(s => s.id === session.id);
                if (index >= 0) {
                    this.sessions[index] = session;
                } else {
                    this.sessions.push(session);
                }
                this.renderCurrentView();
                this.updateStatistics();
            });

            this.socket.on('session-created', (session) => {
                console.log('New session created:', session);
                this.showNotification(`New session: ${session.intent || 'Unknown intent'}`, 'success');
                this.loadSessions(); // Refresh to get the new session
            });

            this.socket.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Connection error occurred', 'error');
            });
            
            this.socket.on('live-durations-update', (durations) => {
                this.liveDurations = durations;
                this.updateLiveDurations();
            });
            
            // Companion service WebSocket for real-time file changes
            this.companionSocket.on('connect', () => {
                console.log('Connected to companion service WebSocket');
                this.updateCompanionStatus(true);
                this.showNotification('Companion service connected', 'success');
            });
            
            this.companionSocket.on('disconnect', () => {
                console.log('Disconnected from companion service WebSocket');
                this.updateCompanionStatus(false);
                this.showNotification('Companion service disconnected', 'warning');
            });
            
            this.companionSocket.on('realtime-update', (update) => {
                console.log('Real-time update received:', update.type, update.data);
                this.handleRealtimeUpdate(update);
            });
            
            this.companionSocket.on('initial-data', (data) => {
                console.log('Received initial data from companion:', data.entries.length, 'entries');
                this.handleInitialCompanionData(data);
            });

            this.companionSocket.on('file-change', (change) => {
                console.log('File change detected:', change);
                this.showNotification(`File changed: ${change.file}`, 'info');
            });

            this.companionSocket.on('notebook-update', (update) => {
                console.log('Notebook update detected:', update);
                this.showNotification(`Notebook updated: ${update.file}`, 'info');
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
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        if (statusDot && statusText) {
            if (connected) {
                statusDot.className = 'status-dot connected';
                statusText.textContent = 'Connected';
            } else {
                statusDot.className = 'status-dot disconnected';
                statusText.textContent = 'Connecting...';
            }
        }
    }

    updateCompanionStatus(connected) {
        console.log('Companion service status:', connected ? 'connected' : 'disconnected');
        // You can add UI indicators for companion service status here
    }

    handleRealtimeUpdate(update) {
        switch (update.type) {
            case 'file-change':
                this.handleFileChange(update.data);
                break;
            case 'prompt-captured':
                this.handlePromptCaptured(update.data);
                break;
            default:
                console.log('Unknown real-time update type:', update.type);
        }
    }

    handleFileChange(data) {
        console.log('File change detected:', data.filePath);
        
        // Create a new session entry for this file change
        const newSession = {
            id: `realtime-${Date.now()}`,
            timestamp: data.timestamp,
            intent: 'file-edit',
            phase: 'success',
            outcome: 'success',
            confidence: 0.9,
            currentFile: data.filePath,
            fileChanges: [{
                id: data.id,
                sessionId: `realtime-${Date.now()}`,
                timestamp: data.timestamp,
                filePath: data.filePath,
                changeType: data.changeType,
                beforeSnippet: data.beforeContent,
                afterSnippet: data.afterContent,
                lineRange: { start: 1, end: 1 }
            }],
            codeDeltas: [{
                id: `delta-${data.id}`,
                sessionId: `realtime-${Date.now()}`,
                timestamp: data.timestamp,
                filePath: data.filePath,
                beforeContent: data.beforeContent,
                afterContent: data.afterContent,
                changeType: data.changeType,
                diff: data.diff
            }],
            linkedEvents: [],
            privacyMode: false,
            userConsent: true,
            dataRetention: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            annotations: []
        };

        // Add to sessions array and sort chronologically
        this.sessions.unshift(newSession);
        this.sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Re-render the dashboard
        this.renderCurrentView();
        this.updateStatistics();
        
        // Show notification
        this.showNotification(`File updated: ${data.filePath.split('/').pop()}`, 'info');
    }

    handlePromptCaptured(data) {
        console.log('Prompt captured:', data.text);
        this.showNotification('New prompt captured', 'success');
    }

    handleInitialCompanionData(data) {
        // Process initial data from companion service
        console.log('Processing initial companion data:', data);
        
        // You can merge this data with existing sessions or create new ones
        if (data.entries && data.entries.length > 0) {
            console.log(`Found ${data.entries.length} entries from companion service`);
        }
    }

    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = 'var(--success-color)';
                break;
            case 'error':
                notification.style.backgroundColor = 'var(--danger-color)';
                break;
            case 'warning':
                notification.style.backgroundColor = 'var(--warning-color)';
                break;
            default:
                notification.style.backgroundColor = 'var(--primary-color)';
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
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
                this.renderCurrentView();
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
            this.renderCurrentView();
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
                    <button class="btn btn-sm btn-primary" onclick="viewSession('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        View Details
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="returnToContext('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"></path>
                        </svg>
                        Return to Context
                    </button>
                    <button class="btn btn-sm btn-success" onclick="generateNotebook('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                        </svg>
                        Generate Notebook
                    </button>
                    <button class="btn btn-sm btn-info" onclick="createIntegrationPackage('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                        Create Package
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
            'totalSessions': totalSessions,
            'activeSessions': activeSessions,
            'completedSessions': completedSessions,
            'failedSessions': failedSessions,
            'totalChanges': totalChanges,
            'totalConversations': totalConversations,
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
            const projectName = this.extractProjectName(session.currentFile);
            const eventType = this.getEventType(session);
            const workflowMetrics = this.calculateWorkflowMetrics(session);
            
            title.textContent = `Work Session: ${session.intent || 'Temporal Actions'}`;
            body.innerHTML = `
                <div class="session-detail-content">
                    <div class="session-header">
                        <div class="session-title-section">
                            <h2 class="session-title">${session.intent || 'Work Session'}</h2>
                            <div class="session-badges">
                                <span class="event-type-badge ${eventType}">${eventType}</span>
                                <span class="project-badge">${projectName}</span>
                                <span class="status-badge ${session.outcome || 'in_progress'}">${session.outcome || 'In Progress'}</span>
                            </div>
                        </div>
                        <div class="session-actions">
                            <button class="btn btn-primary btn-sm" onclick="dashboard.returnToContext('${session.id}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                                </svg>
                                Return to Context
                            </button>
                        </div>
                    </div>
                    
                    <div class="session-metadata-grid">
                        <div class="metadata-card">
                            <div class="metadata-header">
                                <h4>Session Information</h4>
                            </div>
                            <div class="metadata-content">
                                <div class="metadata-item">
                                    <span class="metadata-label">Session ID</span>
                                    <span class="metadata-value">${session.id}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Start Time</span>
                                    <span class="metadata-value">${new Date(session.timestamp).toLocaleString()}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Duration</span>
                                    <span class="metadata-value">${session.duration ? this.formatDuration(session.duration) : 'N/A'}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Primary File</span>
                                    <span class="metadata-value">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="metadata-card">
                            <div class="metadata-header">
                                <h4>Workflow Metrics</h4>
                            </div>
                            <div class="metadata-content">
                                <div class="metadata-item">
                                    <span class="metadata-label">Code Changes</span>
                                    <span class="metadata-value">${workflowMetrics.totalChanges}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">AI Conversations</span>
                                    <span class="metadata-value">${workflowMetrics.totalConversations}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Files Modified</span>
                                    <span class="metadata-value">${workflowMetrics.filesModified}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Productivity Score</span>
                                    <span class="metadata-value">${workflowMetrics.productivityScore}/100</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="metadata-card">
                            <div class="metadata-header">
                                <h4>Technical Details</h4>
                            </div>
                            <div class="metadata-content">
                                <div class="metadata-item">
                                    <span class="metadata-label">Language</span>
                                    <span class="metadata-value">${session.language || 'Unknown'}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">File Type</span>
                                    <span class="metadata-value">${session.currentFile ? session.currentFile.split('.').pop() : 'Unknown'}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Workspace</span>
                                    <span class="metadata-value">${session.workspace || 'Unknown'}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Model Used</span>
                                    <span class="metadata-value">${session.model || 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${session.summary ? `
                    <div class="detail-section">
                        <h3>Session Summary</h3>
                        <div class="summary-content">
                            <p>${session.summary}</p>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="detail-tabs">
                        <div class="tab-buttons">
                            <button class="tab-btn active" onclick="dashboard.switchSessionTab('overview')">Overview</button>
                            <button class="tab-btn" onclick="dashboard.switchSessionTab('code')">Code Changes</button>
                            <button class="tab-btn" onclick="dashboard.switchSessionTab('files')">File Changes</button>
                            <button class="tab-btn" onclick="dashboard.switchSessionTab('conversations')">Conversations</button>
                        </div>
                        
                        <div class="tab-content">
                            <div id="session-tab-overview" class="tab-panel active">
                                <div class="overview-content">
                                    <h4>Session Overview</h4>
                                    <p>This session involved ${workflowMetrics.totalChanges} code changes across ${workflowMetrics.filesModified} files, with ${workflowMetrics.totalConversations} AI conversations.</p>
                                    ${session.intent ? `<p><strong>Intent:</strong> ${session.intent}</p>` : ''}
                                    ${session.outcome ? `<p><strong>Outcome:</strong> ${session.outcome}</p>` : ''}
                                </div>
                            </div>
                            
                            <div id="session-tab-code" class="tab-panel">
                                ${session.codeDeltas && session.codeDeltas.length > 0 ? this.generateCodeDeltasHTML(session) : '<p>No code changes recorded for this session.</p>'}
                            </div>
                            
                            <div id="session-tab-files" class="tab-panel">
                                ${session.fileChanges && session.fileChanges.length > 0 ? this.generateFileChangesHTML(session) : '<p>No file changes recorded for this session.</p>'}
                            </div>
                            
                            <div id="session-tab-conversations" class="tab-panel">
                                ${session.conversations && session.conversations.length > 0 ? this.generateConversationsHTML(session) : '<p>No conversations recorded for this session.</p>'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.add('active');
            
            // Add click-outside-to-close functionality (only if not already added)
            if (!modal.hasAttribute('data-click-listener-added')) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeSessionDetail();
                    }
                });
                modal.setAttribute('data-click-listener-added', 'true');
            }
            
            // Add ESC key to close functionality
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    this.closeSessionDetail();
                    document.removeEventListener('keydown', handleKeyDown);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
        }
    }

    closeSessionDetail() {
        const modal = document.getElementById('sessionDetailModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    switchSessionTab(tabName) {
        // Remove active class from all tab buttons and panels
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        // Add active class to selected tab button and panel
        const tabBtn = document.querySelector(`[onclick="dashboard.switchSessionTab('${tabName}')"]`);
        const tabPanel = document.getElementById(`session-tab-${tabName}`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabPanel) tabPanel.classList.add('active');
    }

    generateConversationsHTML(session) {
        if (!session.conversations || session.conversations.length === 0) {
            return '<p>No conversations recorded for this session.</p>';
        }

        return `
            <div class="conversations-list">
                ${session.conversations.map((conv, index) => `
                    <div class="conversation-item">
                        <div class="conversation-header">
                            <span class="conversation-index">#${index + 1}</span>
                            <span class="conversation-timestamp">${new Date(conv.timestamp || session.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="conversation-content">
                            <div class="conversation-prompt">
                                <strong>User:</strong> ${conv.prompt || conv.userMessage || 'No prompt recorded'}
                            </div>
                            <div class="conversation-response">
                                <strong>AI:</strong> ${conv.response || conv.aiMessage || 'No response recorded'}
                            </div>
                        </div>
                        ${conv.tokens ? `<div class="conversation-meta">Tokens: ${conv.tokens}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    async openPrivacyModal() {
        const modal = document.getElementById('privacyModal');
        const modalBody = document.getElementById('privacy-modal-body');
        
        if (modal && modalBody) {
            // Show loading state
            modalBody.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading privacy analysis...</p></div>';
            modal.classList.add('active');
            
            try {
                // Load privacy analysis content
                await this.loadPrivacyAnalysisContent(modalBody);
            } catch (error) {
                console.error('Error loading privacy analysis:', error);
                modalBody.innerHTML = '<div class="error-state">Error loading privacy analysis: ' + error.message + '</div>';
            }
        }
    }

    async openInfoModal() {
        const modal = document.getElementById('infoModal');
        const modalBody = document.getElementById('info-modal-body');
        
        if (modal && modalBody) {
            // Show loading state
            modalBody.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading information...</p></div>';
            modal.classList.add('active');
            
            try {
                // Load info content
                await this.loadInfoContent(modalBody);
            } catch (error) {
                console.error('Error loading info:', error);
                modalBody.innerHTML = '<div class="error-state">Error loading information: ' + error.message + '</div>';
            }
        }
    }

    closePrivacyModal() {
        const modal = document.getElementById('privacyModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    closeInfoModal() {
        const modal = document.getElementById('infoModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async loadPrivacyAnalysisContent(container) {
        try {
            // Get session data for privacy analysis
            const sessions = this.sessions || [];
            
            // Calculate privacy metrics
            const privacyMetrics = this.calculatePrivacyMetrics(sessions);
            
            // Generate privacy analysis content
            container.innerHTML = `
                <div class="privacy-analysis-container">
                    <div class="privacy-header">
                        <h3>Privacy Analysis Dashboard</h3>
                        <p>Analyze privacy implications and data transformations in your coding sessions</p>
                    </div>
                    
                    <div class="privacy-controls-grid">
                        <div class="config-item">
                            <div class="config-label">Data Sensitivity Level</div>
                            <select id="sensitivity-level" class="config-select">
                                <option value="low">Low - General Development</option>
                                <option value="medium" selected>Medium - Business Logic</option>
                                <option value="high">High - Sensitive Data</option>
                            </select>
                        </div>
                        
                        <div class="config-item">
                            <div class="config-label">Analysis Scope</div>
                            <select id="analysis-scope" class="config-select">
                                <option value="recent" selected>Recent Sessions (7 days)</option>
                                <option value="all">All Sessions</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>
                        
                        <div class="config-item">
                            <div class="config-label">Privacy Filters</div>
                            <div class="config-checkboxes">
                                <label><input type="checkbox" checked> Hide Personal Info</label>
                                <label><input type="checkbox" checked> Anonymize File Paths</label>
                                <label><input type="checkbox"> Include Code Analysis</label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="privacy-metrics-grid">
                        <div class="metric-card">
                            <div class="metric-header">
                                <h4>Data Exposure Risk</h4>
                                <span class="risk-level ${privacyMetrics.riskLevel}">${privacyMetrics.riskLevel.toUpperCase()}</span>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">${privacyMetrics.exposureScore}%</div>
                                <div class="metric-description">${privacyMetrics.exposureDescription}</div>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-header">
                                <h4>Sensitive Files</h4>
                                <span class="file-count">${privacyMetrics.sensitiveFiles}</span>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">${privacyMetrics.sensitiveFileTypes.join(', ')}</div>
                                <div class="metric-description">File types with potential sensitive data</div>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-header">
                                <h4>AI Interactions</h4>
                                <span class="interaction-count">${privacyMetrics.aiInteractions}</span>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">${privacyMetrics.aiTokens} tokens</div>
                                <div class="metric-description">Data shared with AI services</div>
                            </div>
                        </div>
                        
                        <div class="metric-card">
                            <div class="metric-header">
                                <h4>Privacy Score</h4>
                                <span class="privacy-score ${privacyMetrics.privacyScoreClass}">${privacyMetrics.privacyScore}/100</span>
                            </div>
                            <div class="metric-content">
                                <div class="metric-value">${privacyMetrics.privacyGrade}</div>
                                <div class="metric-description">Overall privacy compliance</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="privacy-recommendations">
                        <h4>Privacy Recommendations</h4>
                        <div class="recommendations-list">
                            ${privacyMetrics.recommendations.map(rec => `
                                <div class="recommendation-item ${rec.priority}">
                                    <div class="recommendation-icon">${rec.icon}</div>
                                    <div class="recommendation-content">
                                        <div class="recommendation-title">${rec.title}</div>
                                        <div class="recommendation-description">${rec.description}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="privacy-actions">
                        <button class="btn btn-primary" onclick="this.runPrivacyAnalysis()">Run Full Analysis</button>
                        <button class="btn btn-secondary" onclick="this.exportPrivacyReport()">Export Report</button>
                        <button class="btn btn-outline" onclick="this.configurePrivacySettings()">Configure Settings</button>
                    </div>
                </div>
            `;
            
            // Add event listeners for the new buttons
            this.setupPrivacyModalEventListeners();
            
        } catch (error) {
            console.error('Error loading privacy analysis content:', error);
            container.innerHTML = '<div class="error-state">Error loading privacy analysis content</div>';
        }
    }

    async loadInfoContent(container) {
        try {
            const sessions = this.sessions || [];
            const totalSessions = sessions.length;
            const activeSessions = sessions.filter(s => s.status === 'active').length;
            const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
            
            container.innerHTML = `
                <div class="info-content">
                    <div class="info-header">
                        <h3>PKL Extension Information</h3>
                        <p>Cursor Process Mining & Analytics Dashboard</p>
                    </div>
                    
                    <div class="info-stats">
                        <div class="stat-item">
                            <div class="stat-label">Total Sessions</div>
                            <div class="stat-value">${totalSessions}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Active Sessions</div>
                            <div class="stat-value">${activeSessions}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Duration</div>
                            <div class="stat-value">${this.formatDuration(totalDuration)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Database Size</div>
                            <div class="stat-value">223.83 MB</div>
                        </div>
                    </div>
                    
                    <div class="info-details">
                        <h4>Features</h4>
                        <ul>
                            <li>Real-time session monitoring</li>
                            <li>Privacy analysis and compliance</li>
                            <li>Workflow analytics with Clio & Kura</li>
                            <li>Session embeddings and clustering</li>
                            <li>Export and reporting capabilities</li>
                        </ul>
                        
                        <h4>Version Information</h4>
                        <p>PKL Extension v1.0.0</p>
                        <p>Last Updated: ${new Date().toLocaleDateString()}</p>
                        
                        <h4>Support</h4>
                        <p>For support and feature requests, please contact the development team.</p>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading info content:', error);
            container.innerHTML = '<div class="error-state">Error loading information</div>';
        }
    }

    calculatePrivacyMetrics(sessions) {
        // Calculate various privacy metrics from session data
        const totalSessions = sessions.length;
        const sensitiveFileTypes = ['config', 'env', 'key', 'secret', 'password', 'token'];
        const sensitiveFiles = sessions.filter(s => 
            s.currentFile && sensitiveFileTypes.some(type => 
                s.currentFile.toLowerCase().includes(type)
            )
        ).length;
        
        const aiInteractions = sessions.filter(s => 
            s.conversations && s.conversations.length > 0
        ).length;
        
        const aiTokens = sessions.reduce((sum, s) => {
            if (s.conversations) {
                return sum + s.conversations.reduce((convSum, conv) => 
                    convSum + (conv.tokens || 0), 0);
            }
            return sum;
        }, 0);
        
        // Calculate exposure score (0-100)
        const exposureScore = Math.min(100, Math.round(
            (sensitiveFiles * 20) + 
            (aiInteractions * 5) + 
            (aiTokens / 1000 * 2)
        ));
        
        // Determine risk level
        let riskLevel = 'low';
        let privacyScoreClass = 'good';
        if (exposureScore > 70) {
            riskLevel = 'high';
            privacyScoreClass = 'poor';
        } else if (exposureScore > 40) {
            riskLevel = 'medium';
            privacyScoreClass = 'fair';
        }
        
        // Calculate privacy score (inverse of exposure)
        const privacyScore = Math.max(0, 100 - exposureScore);
        const privacyGrade = privacyScore >= 80 ? 'A' : 
                           privacyScore >= 60 ? 'B' : 
                           privacyScore >= 40 ? 'C' : 
                           privacyScore >= 20 ? 'D' : 'F';
        
        // Generate recommendations
        const recommendations = [
            {
                priority: sensitiveFiles > 0 ? 'high' : 'low',
                icon: '🔒',
                title: 'Secure Sensitive Files',
                description: sensitiveFiles > 0 ? 
                    `Found ${sensitiveFiles} potentially sensitive files. Consider using environment variables or secure storage.` :
                    'No sensitive files detected in recent sessions.'
            },
            {
                priority: aiTokens > 1000 ? 'high' : 'medium',
                icon: '🤖',
                title: 'AI Data Sharing',
                description: aiTokens > 1000 ? 
                    `High AI token usage (${aiTokens} tokens). Review what data is being shared with AI services.` :
                    'AI usage appears reasonable. Continue monitoring data sharing.'
            },
            {
                priority: 'medium',
                icon: 'chart',
                title: 'Regular Privacy Audits',
                description: 'Schedule regular privacy reviews to ensure compliance with data protection policies.'
            },
            {
                priority: 'low',
                icon: 'settings',
                title: 'Privacy Settings',
                description: 'Configure privacy settings to automatically filter sensitive information.'
            }
        ];
        
        return {
            riskLevel,
            exposureScore,
            exposureDescription: riskLevel === 'high' ? 'High risk of data exposure' :
                               riskLevel === 'medium' ? 'Moderate risk of data exposure' :
                               'Low risk of data exposure',
            sensitiveFiles,
            sensitiveFileTypes: sensitiveFileTypes.filter(type => 
                sessions.some(s => s.currentFile && s.currentFile.toLowerCase().includes(type))
            ),
            aiInteractions,
            aiTokens,
            privacyScore,
            privacyScoreClass,
            privacyGrade,
            recommendations
        };
    }

    setupPrivacyModalEventListeners() {
        // Add event listeners for privacy modal buttons
        const runAnalysisBtn = document.querySelector('.privacy-actions .btn-primary');
        const exportBtn = document.querySelector('.privacy-actions .btn-secondary');
        const configBtn = document.querySelector('.privacy-actions .btn-outline');
        
        if (runAnalysisBtn) {
            runAnalysisBtn.addEventListener('click', () => this.runPrivacyAnalysis());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportPrivacyReport());
        }
        
        if (configBtn) {
            configBtn.addEventListener('click', () => this.configurePrivacySettings());
        }
    }

    calculatePrivacyMetrics(sessions) {
        const totalSessions = sessions.length;
        const totalConversations = sessions.reduce((sum, s) => sum + (s.conversations?.length || 0), 0);
        const totalTokens = sessions.reduce((sum, s) => 
            sum + (s.conversations?.reduce((convSum, c) => convSum + (c.tokens || 0), 0) || 0), 0);
        
        // Calculate sensitive file types
        const fileTypes = new Set();
        const sensitivePatterns = ['password', 'secret', 'key', 'token', 'auth', 'credential'];
        let sensitiveFiles = 0;
        
        sessions.forEach(session => {
            if (session.currentFile) {
                const ext = session.currentFile.split('.').pop()?.toLowerCase();
                if (ext) fileTypes.add(ext);
                
                // Check for sensitive content
                const hasSensitiveContent = session.conversations?.some(conv => 
                    sensitivePatterns.some(pattern => 
                        conv.content?.toLowerCase().includes(pattern)
                    )
                );
                if (hasSensitiveContent) sensitiveFiles++;
            }
        });
        
        // Calculate exposure score
        const exposureScore = Math.min(100, Math.round((sensitiveFiles / totalSessions) * 100));
        
        // Calculate privacy score
        let privacyScore = 100;
        if (exposureScore > 50) privacyScore -= 30;
        if (totalTokens > 10000) privacyScore -= 20;
        if (sensitiveFiles > 0) privacyScore -= 25;
        
        const privacyGrade = privacyScore >= 80 ? 'A' : privacyScore >= 60 ? 'B' : privacyScore >= 40 ? 'C' : 'D';
        const riskLevel = privacyScore >= 80 ? 'low' : privacyScore >= 60 ? 'medium' : 'high';
        
        return {
            riskLevel,
            exposureScore,
            exposureDescription: exposureScore < 30 ? 'Low risk of data exposure' : 
                               exposureScore < 60 ? 'Moderate risk of data exposure' : 
                               'High risk of data exposure',
            sensitiveFiles,
            sensitiveFileTypes: Array.from(fileTypes),
            aiInteractions: totalConversations,
            aiTokens: totalTokens,
            privacyScore,
            privacyGrade,
            privacyScoreClass: riskLevel,
            recommendations: this.generatePrivacyRecommendations(privacyScore, sensitiveFiles, totalTokens)
        };
    }

    generatePrivacyRecommendations(privacyScore, sensitiveFiles, totalTokens) {
        const recommendations = [];
        
        if (privacyScore < 60) {
            recommendations.push({
                priority: 'high',
                icon: '🔒',
                title: 'Enable Data Anonymization',
                description: 'Consider anonymizing sensitive data before analysis'
            });
        }
        
        if (sensitiveFiles > 0) {
            recommendations.push({
                priority: 'high',
                icon: 'warning',
                title: 'Review Sensitive Content',
                description: 'Remove or redact sensitive information from conversations'
            });
        }
        
        if (totalTokens > 10000) {
            recommendations.push({
                priority: 'medium',
                icon: 'chart',
                title: 'Limit Data Sharing',
                description: 'Consider reducing the amount of data shared with AI services'
            });
        }
        
        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'low',
                icon: 'check',
                title: 'Privacy Status Good',
                description: 'Your current privacy practices are adequate'
            });
        }
        
        return recommendations;
    }

    async runPrivacyAnalysis() {
        try {
            console.log('Running full privacy analysis...');
            
            // Call the privacy analysis API
            const response = await fetch('/api/privacy/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    config: {
                        epsilon: 1.0,
                        redactionLevel: 0.7,
                        anonymization: true,
                        dataRetention: '30 days'
                    }
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Privacy analysis completed:', data);
                alert('Privacy analysis completed successfully! Check the console for details.');
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error running privacy analysis:', error);
            alert('Error running privacy analysis: ' + error.message);
        }
    }

    async exportPrivacyReport() {
        try {
            console.log('Exporting privacy report...');
            
            const response = await fetch('/api/privacy/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    format: 'json',
                    options: {
                        includeWorkflows: true,
                        includeTransformed: true,
                        includeMetrics: true
                    }
                })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `privacy-report-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error exporting privacy report:', error);
            alert('Error exporting privacy report: ' + error.message);
        }
    }

    configurePrivacySettings() {
        alert('Privacy settings configuration would open here. This feature is under development.');
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

    formatStatus(status) {
        if (!status) return 'In Progress';
        
        const statusMap = {
            'in_progress': 'In Progress',
            'IN_PROGRESS': 'In Progress',
            'success': 'Completed',
            'SUCCESS': 'Completed',
            'completed': 'Completed',
            'COMPLETED': 'Completed',
            'failed': 'Failed',
            'FAILED': 'Failed',
            'error': 'Error',
            'ERROR': 'Error'
        };
        
        return statusMap[status] || status;
    }

    formatIntent(intent) {
        if (!intent) return 'Work Session';
        
        // Convert to lowercase for comparison
        const lowerIntent = intent.toLowerCase();
        
        // Map variations to standard names (consistent with visualizations)
        const intentMap = {
            'data_exploration': 'Data Exploration',
            'explore': 'Data Exploration',
            'exploration': 'Data Exploration',
            'implement': 'Implementation',
            'implementation': 'Implementation',
            'debug': 'Debugging',
            'debugging': 'Debugging',
            'refactor': 'Refactoring',
            'refactoring': 'Refactoring',
            'test': 'Testing',
            'testing': 'Testing',
            'analyze': 'Analysis',
            'analysis': 'Analysis',
            'optimize': 'Optimization',
            'optimization': 'Optimization',
            'document': 'Documentation',
            'documentation': 'Documentation',
            'unknown': 'Unknown',
            'work_session': 'Work Session',
            'session': 'Work Session'
        };
        
        return intentMap[lowerIntent] || intent.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Get cell stage analysis for a session
     */
    getSessionCellStages(session) {
        if (!window.CellStageClassifier) {
            return {
                primaryStage: this.formatIntent(session.intent),
                stages: [],
                stageDistribution: {}
            };
        }

        const classifier = new window.CellStageClassifier();
        const analysis = classifier.analyzeSessionStages(session);
        
        // If no stages were found, fall back to legacy intent
        if (analysis.totalCells === 0 || analysis.primaryStage === 'unknown') {
            return {
                primaryStage: this.formatIntent(session.intent),
                stages: [{
                    index: 0,
                    stage: 'legacy',
                    confidence: 1.0,
                    stageInfo: {
                        name: this.formatIntent(session.intent),
                        description: 'Legacy intent classification',
                        color: 'var(--text-tertiary)',
                        icon: 'file'
                    },
                    content: session.intent || 'Unknown',
                    timestamp: session.timestamp,
                    source: 'legacy'
                }],
                stageDistribution: { 'legacy': 1 },
                stageProgression: [{
                    step: 1,
                    stage: 'legacy',
                    confidence: 1.0
                }],
                totalCells: 1
            };
        }
        
        return analysis;
    }

    /**
     * Format cell stage for display
     */
    formatCellStage(stageKey) {
        if (!window.CellStageClassifier) {
            return stageKey;
        }

        const classifier = new window.CellStageClassifier();
        const stageInfo = classifier.getStageInfo(stageKey);
        return stageInfo.name;
    }

    formatCodeDelta(delta, index, isPreview = true) {
        const changeType = delta.afterContent && delta.beforeContent ? 'Modified' : 
                         delta.afterContent ? 'Added' : 
                         delta.beforeContent ? 'Removed' : 'Unknown';
        
        const timestamp = new Date(delta.timestamp).toLocaleTimeString();
        const filePath = delta.filePath && delta.filePath !== 'unknown' ? delta.filePath.split('/').pop() : 'Unknown File';
        
        // Get associated prompt if available
        const associatedPrompt = this.getAssociatedPrompt(delta);
        
        // Format content with syntax highlighting
        const content = delta.afterContent || delta.beforeContent || 'No content';
        const formattedContent = this.formatCodeContent(content, isPreview);
        
        // Create diff display if both before and after content exist
        const diffDisplay = delta.beforeContent && delta.afterContent ? 
            this.createDiffDisplay(delta.beforeContent, delta.afterContent, isPreview) : 
            formattedContent;
        
        return `
            <div class="code-delta-item">
                <div class="code-delta-header">
                    <div class="code-delta-meta">
                        <span class="change-type ${changeType.toLowerCase()}">${changeType}</span>
                        <span class="file-path">${filePath}</span>
                        <span class="timestamp">${timestamp}</span>
                        ${delta.cellIndex ? `<span class="cell-index">Cell ${delta.cellIndex}</span>` : ''}
                    </div>
                </div>
                ${associatedPrompt ? `
                    <div class="associated-prompt">
                        <div class="prompt-label">Associated Prompt:</div>
                        <div class="prompt-content">${this.escapeHtml(associatedPrompt)}</div>
                    </div>
                ` : ''}
                <div class="code-delta-content">
                    ${diffDisplay}
                </div>
            </div>
        `;
    }

    getAssociatedPrompt(delta) {
        // Try to find associated prompt from linked events or session data
        // This is a simplified version - you might want to enhance this based on your data structure
        if (delta.linkedPrompt) {
            return delta.linkedPrompt;
        }
        
        // Look for prompts in the session that might be related
        const session = this.sessions.find(s => s.id === delta.sessionId);
        if (session && session.linkedEvents) {
            const relatedEvent = session.linkedEvents.find(event => 
                event.type === 'conversation' && 
                Math.abs(new Date(event.timestamp) - new Date(delta.timestamp)) < 30000 // Within 30 seconds
            );
            if (relatedEvent && relatedEvent.content) {
                return relatedEvent.content;
            }
        }
        
        return null;
    }

    formatCodeContent(content, isPreview = true) {
        if (!content) return '<div class="no-content">No content</div>';
        
        const maxLength = isPreview ? 200 : 1000;
        const displayContent = content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
        
        // Basic syntax highlighting for common languages
        const highlightedContent = this.highlightSyntax(displayContent);
        
        return `
            <div class="code-content">
                <pre><code>${highlightedContent}</code></pre>
                ${content.length > maxLength ? `
                    <div class="content-truncated">
                        <span class="truncation-indicator">Content truncated (${content.length} chars total)</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    createDiffDisplay(beforeContent, afterContent, isPreview = true) {
        const maxLength = isPreview ? 150 : 500;
        
        const beforeDisplay = beforeContent.length > maxLength ? beforeContent.substring(0, maxLength) + '...' : beforeContent;
        const afterDisplay = afterContent.length > maxLength ? afterContent.substring(0, maxLength) + '...' : afterContent;
        
        return `
            <div class="diff-display">
                <div class="diff-section">
                    <div class="diff-label removed">Before:</div>
                    <pre class="diff-content removed"><code>${this.escapeHtml(beforeDisplay)}</code></pre>
                </div>
                <div class="diff-section">
                    <div class="diff-label added">After:</div>
                    <pre class="diff-content added"><code>${this.escapeHtml(afterDisplay)}</code></pre>
                </div>
            </div>
        `;
    }

    highlightSyntax(code) {
        // Basic syntax highlighting - you can enhance this with a proper syntax highlighter
        return this.escapeHtml(code)
            .replace(/\b(import|from|def|class|if|else|for|while|return|const|let|var|function)\b/g, '<span class="keyword">$1</span>')
            .replace(/(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, '<span class="string">$1$2$1</span>')
            .replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$1</span>')
            .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
            .replace(/(#.*$)/gm, '<span class="comment">$1</span>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatFileChange(change) {
        const timestamp = new Date(change.timestamp).toLocaleTimeString();
        const fileName = change.filePath ? change.filePath.split('/').pop() : 'Unknown File';
        const changeType = change.changeType || 'modified';
        
        return `
            <div class="file-change-item">
                <div class="file-change-header">
                    <div class="file-change-meta">
                        <span class="change-type ${changeType.toLowerCase()}">${changeType}</span>
                        <span class="file-name">${fileName}</span>
                        <span class="timestamp">${timestamp}</span>
                        ${change.gitHash ? `<span class="git-hash">${change.gitHash.substring(0, 8)}</span>` : ''}
                    </div>
                </div>
                <div class="file-change-content">
                    ${change.beforeSnippet && change.afterSnippet ? `
                        <div class="file-diff">
                            <div class="diff-section">
                                <div class="diff-label removed">Before:</div>
                                <pre class="diff-content removed"><code>${this.escapeHtml(change.beforeSnippet)}</code></pre>
                            </div>
                            <div class="diff-section">
                                <div class="diff-label added">After:</div>
                                <pre class="diff-content added"><code>${this.escapeHtml(change.afterSnippet)}</code></pre>
                            </div>
                        </div>
                    ` : `
                        <div class="file-snippet">
                            <pre><code>${this.escapeHtml(change.afterSnippet || change.beforeSnippet || 'No content')}</code></pre>
                        </div>
                    `}
                    ${change.lineRange ? `
                        <div class="line-range">
                            <span class="line-range-label">Lines:</span>
                            <span class="line-range-value">${change.lineRange.start}-${change.lineRange.end}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    switchView(viewType) {
        // Update current view
        this.currentView = viewType;
        
        // Remove active class from all view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        const activeBtn = document.getElementById(`${viewType}-view-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Render the selected view
        this.renderCurrentView();
    }

    renderCurrentView() {
        const sessionsList = document.getElementById('sessions-list');
        if (!sessionsList) return;
        
        switch(this.currentView) {
            case 'timeline':
                this.renderTimeline();
                break;
            case 'projects-sessions':
                this.renderProjectsSessions();
                break;
            case 'projects':
                this.renderProjects();
                break;
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
                this.renderTimeline();
        }
    }

    renderTimeline() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        console.log(`Rendering timeline with ${this.sessions.length} events`);

        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No events found</div>';
            return;
        }

        // Sort sessions by timestamp (most recent first)
        const sortedSessions = [...this.sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Group sessions by date
        const groupedByDate = this.groupSessionsByDate(sortedSessions);

        const timelineHtml = Object.entries(groupedByDate).map(([date, sessions]) => {
            const sessionHtml = sessions.map(session => this.renderTimelineEvent(session)).join('');
            return `
                <div class="timeline-day">
                    <div class="timeline-date-header">
                        <h3 class="timeline-date">${this.formatDateHeader(date)}</h3>
                        <span class="timeline-count">${sessions.length} events</span>
                    </div>
                    <div class="timeline-events">
                        ${sessionHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="timeline-container">
                <div class="timeline-header">
                    <h2>Work Sessions Timeline</h2>
                    <p class="timeline-description">Temporal chunks of development actions grouped by work sessions</p>
                    <div class="timeline-controls">
                        <select id="project-filter" onchange="filterByProject(this.value)">
                            <option value="">All Projects</option>
                            ${this.getProjectOptions()}
                        </select>
                        <select id="event-type-filter" onchange="filterByEventType(this.value)">
                            <option value="">All Session Types</option>
                            <option value="notebook">Notebook Sessions</option>
                            <option value="code">Code Sessions</option>
                            <option value="conversation">Chat Sessions</option>
                            <option value="session">General Sessions</option>
                        </select>
                    </div>
                </div>
                <div class="timeline-content">
                    ${timelineHtml}
                </div>
            </div>
        `;
    }

    async renderProjectsSessions() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        console.log('Rendering enhanced projects & sessions view');

        // Initialize the enhanced project/session view if not already done
        if (!this.enhancedProjectSessionView) {
            // Load the enhanced project session view component
            await this.loadEnhancedProjectSessionView();
        } else {
            // Re-render the existing view and refresh data
            await this.enhancedProjectSessionView.loadProjects();
        }
    }

    async loadEnhancedProjectSessionView() {
        try {
            // Dynamically load the enhanced project session view
            const script = document.createElement('script');
            script.src = 'components/enhanced-project-session-view.js';
            script.onload = async () => {
                // Initialize the enhanced view
                if (typeof EnhancedProjectSessionView !== 'undefined') {
                    this.enhancedProjectSessionView = new EnhancedProjectSessionView(this);
                    window.enhancedProjectSessionView = this.enhancedProjectSessionView;
                    
                    // Load projects data after initialization
                    await this.enhancedProjectSessionView.loadProjects();
                    console.log('Enhanced project session view initialized and data loaded');
                } else {
                    console.error('EnhancedProjectSessionView class not found');
                }
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error loading enhanced project session view:', error);
            // Fallback to regular projects view
            this.renderProjects();
        }
    }

    renderProjects() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        console.log(`Rendering projects view with ${this.sessions.length} events`);

        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No events found</div>';
            return;
        }

        // Group sessions by project
        const projects = this.groupSessionsByProject(this.sessions);

        const projectsHtml = Object.entries(projects).map(([projectName, sessions]) => `
            <div class="project-card">
                <div class="project-header">
                    <h3 class="project-name">${projectName}</h3>
                    <span class="project-stats">
                        ${sessions.length} events • 
                        ${this.getProjectDuration(sessions)} • 
                        ${this.getProjectStatus(sessions)}
                    </span>
                </div>
                <div class="project-events">
                    ${this.generateProjectEventsHTML(sessions, projectName)}
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="projects-container">
                <div class="projects-header">
                    <h2>Projects</h2>
                    <div class="projects-summary">
                        ${Object.keys(projects).length} projects • ${this.sessions.length} total events
                    </div>
                </div>
                <div class="projects-grid">
                    ${projectsHtml}
                </div>
            </div>
        `;
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
                    <button class="btn btn-sm btn-primary" onclick="viewSession('${session.id}')">View Details</button>
                    <button class="btn btn-sm btn-secondary" onclick="returnToContext('${session.id}')">Open in Cursor</button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = `<div class="notebooks-grid">${notebooksHtml}</div>`;
    }

    async renderVisualizations() {
        const container = document.getElementById('sessions-list');
        if (!container) return;
        
        console.log('Rendering workflow analysis...');
        
        try {
            // Show loading state
            container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Analyzing workflows with Clio & Kura...</p></div>';
            
            // Get both Kura and Clio analysis data
            const [kuraResponse, clioResponse] = await Promise.allSettled([
                fetch('/api/sessions/analyze-with-kura', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        test_mode: false,
                        include_dashboard_data: true
                    })
                }),
                fetch('/api/visualizations')
            ]);

            let kuraData = null;
            let clioData = null;

            if (kuraResponse.status === 'fulfilled' && kuraResponse.value.ok) {
                kuraData = await kuraResponse.value.json();
                console.log('Kura analysis data received:', kuraData);
            }

            if (clioResponse.status === 'fulfilled' && clioResponse.value.ok) {
                clioData = await clioResponse.value.json();
                console.log('Clio analysis data received:', clioData);
            }

            // Render comprehensive workflow analysis
            this.renderWorkflowAnalysis(kuraData, clioData);
            
            // Also initialize real data visualizations
            if (window.realDataVisualizations) {
                console.log('Re-initializing real data visualizations...');
                await window.realDataVisualizations.initialize();
            }
        } catch (error) {
            console.error('Error loading visualizations:', error);
            container.innerHTML = '<div class="no-sessions">Error loading visualizations: ' + error.message + '</div>';
        }
    }

    initializeAnalysisCharts(data) {
        // Note: Intent distribution chart is now handled by RealDataVisualizations
        // to avoid duplication and conflicts
        
        // Initialize session timeline chart
        this.createSessionTimelineChart(data.sessions);
    }

    createIntentDistributionChart(sessions) {
        const container = document.getElementById('intent-distribution-chart');
        if (!container) {
            console.warn('Intent distribution chart container not found');
            return;
        }

        if (!sessions || sessions.length === 0) {
            container.innerHTML = '<div class="no-data">No session data available</div>';
            return;
        }

        // Count cell stages
        const stageCounts = {};
        sessions.forEach(session => {
            const cellStages = this.getSessionCellStages(session);
            const primaryStage = cellStages.primaryStage;
            stageCounts[primaryStage] = (stageCounts[primaryStage] || 0) + 1;
        });

        const stageEntries = Object.entries(stageCounts);
        if (stageEntries.length === 0) {
            container.innerHTML = '<div class="no-data">No cell stage data available</div>';
            return;
        }

        // Create simple bar chart
        const maxCount = Math.max(...Object.values(stageCounts));
        const chartHtml = stageEntries.map(([stage, count]) => {
            const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return `
                <div class="intent-bar">
                    <div class="intent-label">${stage}</div>
                    <div class="intent-bar-container">
                        <div class="intent-bar-fill" style="width: ${percentage}%"></div>
                        <span class="intent-count">${count}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="intent-chart-content">${chartHtml}</div>`;
        console.log('Intent distribution chart created with', intentEntries.length, 'intents');
    }

    createSessionTimelineChart(sessions) {
        const container = document.getElementById('session-timeline-chart');
        if (!container) {
            console.warn('Session timeline chart container not found');
            return;
        }

        if (!sessions || sessions.length === 0) {
            container.innerHTML = '<div class="no-data">No session data available</div>';
            return;
        }

        // Sort sessions by timestamp
        const sortedSessions = sessions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Create timeline visualization
        const timelineHtml = sortedSessions.slice(-10).map(session => {
            const time = new Date(session.timestamp);
            const timeStr = time.toLocaleTimeString();
            return `
                <div class="timeline-item">
                    <div class="timeline-time">${timeStr}</div>
                    <div class="timeline-dot ${session.intent}"></div>
                    <div class="timeline-content">
                        <div class="timeline-intent">${session.intent}</div>
                        <div class="timeline-file">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown'}</div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="timeline-content">${timelineHtml}</div>`;
        console.log('Session timeline chart created with', sortedSessions.slice(-10).length, 'sessions');
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

    // Helper methods for timeline and projects views
    groupSessionsByDate(sessions) {
        const groups = {};
        sessions.forEach(session => {
            const date = new Date(session.timestamp).toDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(session);
        });
        return groups;
    }

    groupSessionsByProject(sessions) {
        const groups = {};
        sessions.forEach(session => {
            const projectName = this.extractProjectName(session.currentFile);
            if (!groups[projectName]) {
                groups[projectName] = [];
            }
            groups[projectName].push(session);
        });
        return groups;
    }

    extractProjectName(filePath) {
        if (!filePath) return 'Unknown Project';
        const pathParts = filePath.split('/');
        
        // Skip common directory names
        const skipDirs = ['src', 'app', 'components', 'public', 'assets', 'css', 'js', 'node_modules'];
        
        // Try to find a meaningful project name from the path
        for (let i = pathParts.length - 1; i >= 0; i--) {
            const part = pathParts[i];
            if (part && !skipDirs.includes(part) && !part.includes('.') && part.length > 1) {
                // Clean up the project name
                return part.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            }
        }
        return 'Root Project';
    }

    formatDateHeader(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }
    }

    renderTimelineEvent(session) {
        const time = new Date(session.timestamp).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        const projectName = this.extractProjectName(session.currentFile);
        const eventType = this.getEventType(session);
        const actionCount = this.getActionCount(session);
        
        return `
            <div class="timeline-event" onclick="viewSession('${session.id}')">
                <div class="timeline-event-time">${time}</div>
                <div class="timeline-event-dot ${eventType}"></div>
                <div class="timeline-event-content">
                    <div class="timeline-event-header">
                        <span class="timeline-event-type">${eventType}</span>
                        <span class="timeline-event-project">${projectName}</span>
                    </div>
                    <div class="timeline-event-title">${this.getSessionCellStages(session).primaryStage}</div>
                    <div class="timeline-event-file">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown File'}</div>
                    <div class="timeline-event-meta">
                        <span class="timeline-event-outcome ${session.outcome || 'in_progress'}">${session.outcome || 'In Progress'}</span>
                        ${session.codeDeltas && session.codeDeltas.length > 0 ? 
                            `<span class="timeline-event-changes">${session.codeDeltas.length} changes</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderProjectEvent(session) {
        const time = new Date(session.timestamp).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        const eventType = this.getEventType(session);
        const actionCount = this.getActionCount(session);
        
        return `
            <div class="project-event" onclick="viewSession('${session.id}')">
                <div class="project-event-time">${time}</div>
                <div class="project-event-type ${eventType}">${eventType}</div>
                <div class="project-event-content">
                    <div class="project-event-title">${this.getSessionCellStages(session).primaryStage}</div>
                    <div class="project-event-file">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown File'}</div>
                </div>
                <div class="project-event-status ${(session.outcome || 'in_progress').toLowerCase()}">${this.formatStatus(session.outcome)}</div>
            </div>
        `;
    }

    getEventType(session) {
        if (session.currentFile && session.currentFile.endsWith('.ipynb')) {
            return 'notebook';
        } else if (session.codeDeltas && session.codeDeltas.length > 0) {
            return 'code';
        } else if (session.conversations && session.conversations.length > 0) {
            return 'conversation';
        } else {
            return 'session';
        }
    }

    getActionCount(session) {
        let count = 0;
        
        // Count code deltas (file changes)
        if (session.codeDeltas && session.codeDeltas.length > 0) {
            count += session.codeDeltas.length;
        }
        
        // Count conversations
        if (session.conversations && session.conversations.length > 0) {
            count += session.conversations.length;
        }
        
        // Count file changes
        if (session.fileChanges && session.fileChanges.length > 0) {
            count += session.fileChanges.length;
        }
        
        // Count linked events
        if (session.linkedEvents && session.linkedEvents.length > 0) {
            count += session.linkedEvents.length;
        }
        
        // If no specific actions found, return 1 for the session itself
        return count > 0 ? count : 1;
    }

    generateCodeDeltasHTML(session) {
        const previewDeltas = session.codeDeltas.slice(0, 5).map((delta, index) => this.formatCodeDelta(delta, index, true)).join('');
        const fullDeltas = session.codeDeltas.map((delta, index) => this.formatCodeDelta(delta, index, false)).join('');
        const expandLink = session.codeDeltas.length > 5 ? `
            <p class="expandable-link" onclick="toggleCodeDeltas('${session.id}')" style="cursor: pointer; color: var(--primary-color); text-decoration: underline;">
                ... and ${session.codeDeltas.length - 5} more changes
            </p>
        ` : '';
        
        return `
            <div class="detail-section">
                <h3>Code Changes (${session.codeDeltas.length})</h3>
                <div class="code-deltas">
                    <div id="code-deltas-preview">
                        ${previewDeltas}
                    </div>
                    <div id="code-deltas-full" style="display: none;">
                        ${fullDeltas}
                    </div>
                    ${expandLink}
                </div>
            </div>
        `;
    }

    generateFileChangesHTML(session) {
        const fileChanges = session.fileChanges.slice(0, 3).map(change => this.formatFileChange(change)).join('');
        const moreIndicator = session.fileChanges.length > 3 ? `
            <div class="more-changes">
                <span class="more-indicator">... and ${session.fileChanges.length - 3} more file changes</span>
            </div>
        ` : '';
        
        return `
            <div class="detail-section">
                <h3>File Changes (${session.fileChanges.length})</h3>
                <div class="file-changes">
                    ${fileChanges}
                    ${moreIndicator}
                </div>
            </div>
        `;
    }

    generateProjectEventsHTML(sessions, projectName) {
        const events = sessions.slice(0, 5).map(session => this.renderProjectEvent(session)).join('');
        const moreButton = sessions.length > 5 ? `
            <div class="project-more">
                <button class="btn btn-sm btn-secondary" onclick="viewProjectDetails('${projectName}')">
                    View all ${sessions.length} events
                </button>
            </div>
        ` : '';
        
        return events + moreButton;
    }

    getProjectOptions() {
        const projects = new Set();
        this.sessions.forEach(session => {
            projects.add(this.extractProjectName(session.currentFile));
        });
        return Array.from(projects).map(project => 
            `<option value="${project}">${project}</option>`
        ).join('');
    }

    getProjectDuration(sessions) {
        const durations = sessions.filter(s => s.duration && s.duration > 0);
        if (durations.length === 0) return 'No duration data';
        
        const totalDuration = durations.reduce((sum, s) => sum + s.duration, 0);
        return this.formatDuration(totalDuration);
    }

    getProjectStatus(sessions) {
        const activeCount = sessions.filter(s => !s.outcome || s.outcome === 'in_progress').length;
        const completedCount = sessions.filter(s => s.outcome === 'success' || s.outcome === 'completed').length;
        
        if (activeCount > 0) return 'Active';
        if (completedCount === sessions.length) return 'Completed';
        return 'Mixed';
    }

    calculateWorkflowMetrics(session) {
        const totalChanges = session.codeDeltas ? session.codeDeltas.length : 0;
        const totalConversations = session.conversations ? session.conversations.length : 0;
        const filesModified = session.fileChanges ? new Set(session.fileChanges.map(fc => fc.fileName)).size : 0;
        
        // Calculate productivity score based on various factors
        let productivityScore = 0;
        if (totalChanges > 0) productivityScore += Math.min(totalChanges * 2, 50);
        if (totalConversations > 0) productivityScore += Math.min(totalConversations * 5, 30);
        if (filesModified > 0) productivityScore += Math.min(filesModified * 3, 20);
        if (session.outcome === 'success' || session.outcome === 'completed') productivityScore += 10;
        
        return {
            totalChanges,
            totalConversations,
            filesModified,
            productivityScore: Math.min(productivityScore, 100)
        };
    }

    filterByProject(projectName) {
        if (!projectName) {
            this.renderTimeline();
            return;
        }
        
        const filteredSessions = this.sessions.filter(session => 
            this.extractProjectName(session.currentFile) === projectName
        );
        
        this.renderFilteredTimeline(filteredSessions, `Project: ${projectName}`);
    }

    filterByEventType(eventType) {
        if (!eventType) {
            this.renderTimeline();
            return;
        }
        
        const filteredSessions = this.sessions.filter(session => 
            this.getEventType(session) === eventType
        );
        
        this.renderFilteredTimeline(filteredSessions, `Event Type: ${eventType}`);
    }

    renderFilteredTimeline(sessions, filterTitle) {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        if (sessions.length === 0) {
            container.innerHTML = `<div class="no-sessions">No events found for ${filterTitle}</div>`;
            return;
        }

        // Sort sessions by timestamp (most recent first)
        const sortedSessions = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Group sessions by date
        const groupedByDate = this.groupSessionsByDate(sortedSessions);

        const timelineHtml = Object.entries(groupedByDate).map(([date, dateSessions]) => {
            const eventsHtml = dateSessions.map(session => this.renderTimelineEvent(session)).join('');
            return `
                <div class="timeline-day">
                    <div class="timeline-date-header">
                        <h3 class="timeline-date">${this.formatDateHeader(date)}</h3>
                        <span class="timeline-count">${dateSessions.length} events</span>
                    </div>
                    <div class="timeline-events">
                        ${eventsHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="timeline-container">
                <div class="timeline-header">
                    <h2>Event Timeline - ${filterTitle}</h2>
                    <div class="timeline-controls">
                        <button class="btn btn-sm btn-secondary" onclick="switchView('timeline')">Clear Filters</button>
                    </div>
                </div>
                <div class="timeline-content">
                    ${timelineHtml}
                </div>
            </div>
        `;
    }

    viewProjectDetails(projectName) {
        const projectSessions = this.sessions.filter(session => 
            this.extractProjectName(session.currentFile) === projectName
        );
        
        this.renderFilteredTimeline(projectSessions, `Project: ${projectName}`);
    }

    renderWorkflowAnalysis(kuraData, clioData) {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        console.log('Rendering comprehensive workflow analysis...');

        // Calculate workflow insights from current sessions
        const workflowInsights = this.calculateWorkflowInsights();
        
        const analysisHtml = `
            <div class="workflow-analysis-container">
                <div class="workflow-header">
                    <h2>Workflow Analysis</h2>
                    <p>Comprehensive analysis of your development workflows using Clio & Kura</p>
                </div>
                
                <div class="workflow-grid">
                    <div class="workflow-section">
                        <h3>Session Patterns</h3>
                        <div class="pattern-metrics">
                            <div class="pattern-item">
                                <div class="pattern-value">${workflowInsights.avgSessionDuration}</div>
                                <div class="pattern-label">Avg Session Duration</div>
                            </div>
                            <div class="pattern-item">
                                <div class="pattern-value">${workflowInsights.mostActiveHour}</div>
                                <div class="pattern-label">Most Active Hour</div>
                            </div>
                            <div class="pattern-item">
                                <div class="pattern-value">${workflowInsights.productivityTrend}</div>
                                <div class="pattern-label">Productivity Trend</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="workflow-section">
                        <h3>Code Evolution</h3>
                        <div class="evolution-metrics">
                            <div class="evolution-item">
                                <div class="evolution-value">${workflowInsights.totalLinesChanged}</div>
                                <div class="evolution-label">Lines Changed</div>
                            </div>
                            <div class="evolution-item">
                                <div class="evolution-value">${workflowInsights.filesPerSession}</div>
                                <div class="evolution-label">Files per Session</div>
                            </div>
                            <div class="evolution-item">
                                <div class="evolution-value">${workflowInsights.refactoringRate}</div>
                                <div class="evolution-label">Refactoring Rate</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="workflow-section">
                        <h3>Project Distribution</h3>
                        <div class="project-breakdown">
                            ${workflowInsights.projectBreakdown.map(project => `
                                <div class="project-item">
                                    <div class="project-name">${project.name}</div>
                                    <div class="project-bar">
                                        <div class="project-fill" style="width: ${project.percentage}%"></div>
                                    </div>
                                    <div class="project-percentage">${project.percentage}%</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="workflow-section">
                        <h3>Intent Analysis</h3>
                        <div class="intent-breakdown">
                            ${workflowInsights.intentBreakdown.map(intent => `
                                <div class="intent-item">
                                    <div class="intent-name">${intent.name}</div>
                                    <div class="intent-count">${intent.count}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                ${kuraData && kuraData.success ? `
                    <div class="kura-integration">
                        <h3>Kura Clustering Analysis</h3>
                        <div class="kura-metrics">
                            <div class="kura-metric">
                                <div class="kura-value">${kuraData.clusters ? kuraData.clusters.length : 0}</div>
                                <div class="kura-label">Identified Clusters</div>
                            </div>
                            <div class="kura-metric">
                                <div class="kura-value">${kuraData.analysis ? kuraData.analysis.insights : 'N/A'}</div>
                                <div class="kura-label">Key Insights</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${clioData && clioData.success ? `
                    <div class="clio-integration">
                        <h3>Clio Notebook Analysis</h3>
                        <div class="clio-metrics">
                            <div class="clio-metric">
                                <div class="clio-value">${clioData.visualizations ? clioData.visualizations.length : 0}</div>
                                <div class="clio-label">Notebook Visualizations</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = analysisHtml;
    }

    calculateWorkflowInsights() {
        const sessions = this.sessions;
        if (sessions.length === 0) {
            return {
                avgSessionDuration: '0m',
                mostActiveHour: 'N/A',
                productivityTrend: 'N/A',
                totalLinesChanged: 0,
                filesPerSession: 0,
                refactoringRate: '0%',
                projectBreakdown: [],
                intentBreakdown: []
            };
        }

        // Calculate average session duration
        const sessionsWithDuration = sessions.filter(s => s.duration && s.duration > 0);
        const avgDuration = sessionsWithDuration.length > 0 
            ? sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0) / sessionsWithDuration.length
            : 0;

        // Calculate most active hour
        const hourCounts = {};
        sessions.forEach(session => {
            const hour = new Date(session.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        const mostActiveHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b, '0');

        // Calculate productivity trend (simplified)
        const recentSessions = sessions.slice(0, Math.min(10, sessions.length));
        const olderSessions = sessions.slice(10, Math.min(20, sessions.length));
        const recentProductivity = recentSessions.reduce((sum, s) => sum + (s.codeDeltas ? s.codeDeltas.length : 0), 0);
        const olderProductivity = olderSessions.reduce((sum, s) => sum + (s.codeDeltas ? s.codeDeltas.length : 0), 0);
        const productivityTrend = recentProductivity > olderProductivity ? '↗ Improving' : '↘ Declining';

        // Calculate total lines changed
        const totalLinesChanged = sessions.reduce((sum, s) => {
            return sum + (s.codeDeltas ? s.codeDeltas.length : 0);
        }, 0);

        // Calculate files per session
        const filesPerSession = sessions.length > 0 
            ? sessions.reduce((sum, s) => sum + (s.fileChanges ? s.fileChanges.length : 0), 0) / sessions.length
            : 0;

        // Calculate refactoring rate (simplified)
        const refactoringSessions = sessions.filter(s => s.intent && s.intent.toLowerCase().includes('refactor')).length;
        const refactoringRate = sessions.length > 0 ? Math.round((refactoringSessions / sessions.length) * 100) : 0;

        // Calculate project breakdown
        const projectGroups = this.groupSessionsByProject(sessions);
        const projectBreakdown = Object.entries(projectGroups).map(([name, projectSessions]) => ({
            name,
            count: projectSessions.length,
            percentage: Math.round((projectSessions.length / sessions.length) * 100)
        })).sort((a, b) => b.count - a.count);

        // Calculate intent breakdown
        const intentCounts = {};
        sessions.forEach(session => {
            const intent = this.formatIntent(session.intent || 'Unknown');
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
        });
        const intentBreakdown = Object.entries(intentCounts).map(([name, count]) => ({
            name,
            count
        })).sort((a, b) => b.count - a.count);

        return {
            avgSessionDuration: this.formatDuration(avgDuration),
            mostActiveHour: `${mostActiveHour}:00`,
            productivityTrend,
            totalLinesChanged,
            filesPerSession: Math.round(filesPerSession * 10) / 10,
            refactoringRate: `${refactoringRate}%`,
            projectBreakdown,
            intentBreakdown
        };
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

    /**
     * Search sessions by query
     */
    async searchSessions(query) {
        if (!query || query.trim().length === 0) {
            this.loadSessions(); // Reload all sessions
            return;
        }

        try {
            console.log(`Searching sessions for: "${query}"`);
            
            // Show loading state
            this.showNotification('Searching sessions...', 'info');
            
            // Search in current sessions first
            const filteredSessions = this.sessions.filter(session => {
                const searchTerm = query.toLowerCase();
                return (
                    (session.intent && session.intent.toLowerCase().includes(searchTerm)) ||
                    (session.currentFile && session.currentFile.toLowerCase().includes(searchTerm)) ||
                    (session.outcome && session.outcome.toLowerCase().includes(searchTerm)) ||
                    (session.id && session.id.toLowerCase().includes(searchTerm)) ||
                    (session.codeDeltas && session.codeDeltas.some(delta => 
                        delta.content && delta.content.toLowerCase().includes(searchTerm)
                    )) ||
                    (session.fileChanges && session.fileChanges.some(change => 
                        change.afterSnippet && change.afterSnippet.toLowerCase().includes(searchTerm)
                    ))
                );
            });

            if (filteredSessions.length > 0) {
                this.sessions = filteredSessions;
                this.renderCurrentView();
                this.showNotification(`Found ${filteredSessions.length} matching sessions`, 'success');
            } else {
                // If no local matches, try API search
                const response = await fetch(`/api/sessions/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const searchResults = await response.json();
                    this.sessions = searchResults.sessions || [];
                    this.renderCurrentView();
                    this.showNotification(`Found ${this.sessions.length} matching sessions`, 'success');
                } else {
                    this.showNotification('No sessions found matching your search', 'warning');
                }
            }
        } catch (error) {
            console.error('Error searching sessions:', error);
            this.showNotification('Error searching sessions', 'error');
        }
    }

    /**
     * Export dashboard data
     */
    async exportData() {
        try {
            console.log('Exporting dashboard data...');
            this.showNotification('Preparing export...', 'info');
            
            const exportData = {
                timestamp: new Date().toISOString(),
                sessions: this.sessions,
                statistics: this.calculateStatistics(),
                workflowInsights: this.calculateWorkflowInsights(),
                metadata: {
                    totalSessions: this.sessions.length,
                    exportVersion: '1.0',
                    dashboardVersion: '2.0'
                }
            };

            // Create and download file
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `pkl-dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            this.showNotification('Export completed successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Error exporting data', 'error');
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Set background color based on type
        switch (type) {
            case 'success':
                notification.style.backgroundColor = 'var(--success-color)';
                break;
            case 'error':
                notification.style.backgroundColor = 'var(--danger-color)';
                break;
            case 'warning':
                notification.style.backgroundColor = 'var(--warning-color)';
                break;
            default:
                notification.style.backgroundColor = 'var(--primary-color)';
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Filter sessions by criteria
     */
    filterSessions(filters = {}) {
        let filteredSessions = [...this.sessions];
        
        // Filter by status
        if (filters.status && filters.status !== 'all') {
            filteredSessions = filteredSessions.filter(session => 
                (session.outcome || 'in_progress').toLowerCase() === filters.status.toLowerCase()
            );
        }
        
        // Filter by intent
        if (filters.intent && filters.intent !== 'all') {
            filteredSessions = filteredSessions.filter(session => 
                session.intent && session.intent.toLowerCase().includes(filters.intent.toLowerCase())
            );
        }
        
        // Filter by date range
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            filteredSessions = filteredSessions.filter(session => 
                new Date(session.timestamp) >= fromDate
            );
        }
        
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            filteredSessions = filteredSessions.filter(session => 
                new Date(session.timestamp) <= toDate
            );
        }
        
        // Filter by project
        if (filters.project && filters.project !== 'all') {
            filteredSessions = filteredSessions.filter(session => 
                session.currentFile && session.currentFile.includes(filters.project)
            );
        }
        
        return filteredSessions;
    }

    /**
     * Sort sessions by criteria
     */
    sortSessions(sessions, sortBy = 'timestamp', sortOrder = 'desc') {
        return sessions.sort((a, b) => {
            let aValue, bValue;
            
            switch (sortBy) {
                case 'timestamp':
                    aValue = new Date(a.timestamp);
                    bValue = new Date(b.timestamp);
                    break;
                case 'intent':
                    aValue = (a.intent || '').toLowerCase();
                    bValue = (b.intent || '').toLowerCase();
                    break;
                case 'outcome':
                    aValue = (a.outcome || 'in_progress').toLowerCase();
                    bValue = (b.outcome || 'in_progress').toLowerCase();
                    break;
                case 'duration':
                    aValue = a.duration || 0;
                    bValue = b.duration || 0;
                    break;
                case 'changes':
                    aValue = (a.codeDeltas?.length || 0) + (a.fileChanges?.length || 0);
                    bValue = (b.codeDeltas?.length || 0) + (b.fileChanges?.length || 0);
                    break;
                default:
                    aValue = a[sortBy] || '';
                    bValue = b[sortBy] || '';
            }
            
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            } else {
                return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            }
        });
    }

    /**
     * Apply filters and sorting to sessions
     */
    applyFiltersAndSorting(filters = {}, sortBy = 'timestamp', sortOrder = 'desc') {
        const filteredSessions = this.filterSessions(filters);
        const sortedSessions = this.sortSessions(filteredSessions, sortBy, sortOrder);
        
        this.sessions = sortedSessions;
        this.renderCurrentView();
        
        this.showNotification(
            `Showing ${sortedSessions.length} sessions (filtered from ${this.allSessions?.length || 0} total)`,
            'info'
        );
    }

    /**
     * Clear all filters and show all sessions
     */
    clearFilters() {
        this.sessions = this.allSessions || this.sessions;
        this.renderCurrentView();
        this.showNotification('Filters cleared - showing all sessions', 'info');
    }

    /**
     * Generate notebook from session
     */
    async generateNotebook(sessionId) {
        try {
            console.log(`Generating notebook for session: ${sessionId}`);
            this.showNotification('Generating notebook...', 'info');
            
            const response = await fetch(`/api/session/${sessionId}/generate-notebook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Notebook generated successfully!', 'success');
                
                // Create download link
                const downloadLink = document.createElement('a');
                downloadLink.href = data.downloadUrl;
                downloadLink.download = data.notebook.filename;
                downloadLink.click();
                
                console.log('Notebook generated:', data.notebook);
            } else {
                throw new Error(data.error || 'Failed to generate notebook');
            }
        } catch (error) {
            console.error('Error generating notebook:', error);
            this.showNotification(`Error generating notebook: ${error.message}`, 'error');
        }
    }

    /**
     * Create integration package from session
     */
    async createIntegrationPackage(sessionId) {
        try {
            console.log(`Creating integration package for session: ${sessionId}`);
            this.showNotification('Creating integration package...', 'info');
            
            const response = await fetch(`/api/session/${sessionId}/create-integration-package`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Integration package created successfully!', 'success');
                
                // Show package details
                const packageInfo = `
                    <div class="integration-package-info">
                        <h4>Integration Package Created</h4>
                        <p><strong>Session File:</strong> ${data.sessionFile.filename}</p>
                        ${data.notebook ? `<p><strong>Notebook:</strong> ${data.notebook.filename}</p>` : ''}
                        <p><strong>Actions:</strong> ${data.package.actions.length} actions available</p>
                    </div>
                `;
                
                // Create a modal to show package info
                const modal = document.createElement('div');
                modal.className = 'modal active';
                modal.innerHTML = `
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>Integration Package</h2>
                            <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                        </div>
                        <div class="modal-body">
                            ${packageInfo}
                            <div class="package-actions">
                                <button class="btn btn-primary" onclick="window.open('${data.sessionFile.downloadUrl}')">Download Session File</button>
                                ${data.notebook ? `<button class="btn btn-success" onclick="window.open('${data.notebook.downloadUrl}')">Download Notebook</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                console.log('Integration package created:', data.package);
            } else {
                throw new Error(data.error || 'Failed to create integration package');
            }
        } catch (error) {
            console.error('Error creating integration package:', error);
            this.showNotification(`Error creating integration package: ${error.message}`, 'error');
        }
    }

    /**
     * Set up keyboard shortcuts for accessibility
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only trigger shortcuts when not typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
                return;
            }

            // Ctrl/Cmd + K: Focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('global-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Ctrl/Cmd + R: Refresh data
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.loadSessions();
                this.showNotification('Data refreshed', 'success');
            }

            // Ctrl/Cmd + E: Export data
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                this.exportData();
            }

            // Ctrl/Cmd + F: Focus search (alternative)
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const searchInput = document.getElementById('global-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Escape: Close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }

            // Number keys: Switch views
            if (e.key >= '1' && e.key <= '6') {
                const viewMap = {
                    '1': 'timeline',
                    '2': 'projects-sessions',
                    '3': 'notebooks',
                    '4': 'visualizations',
                    '5': 'embeddings',
                    '6': 'enhanced'
                };
                
                const viewType = viewMap[e.key];
                if (viewType && viewType !== 'enhanced') {
                    e.preventDefault();
                    this.switchView(viewType);
                    this.showNotification(`Switched to ${viewType} view`, 'info');
                } else if (viewType === 'enhanced') {
                    e.preventDefault();
                    window.location.href = '/dashboard/enhanced';
                }
            }

            // H: Show help
            if (e.key === 'h' || e.key === 'H') {
                e.preventDefault();
                this.showKeyboardShortcutsHelp();
            }
        });
    }

    /**
     * Close all open modals
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
    }

    /**
     * Show keyboard shortcuts help
     */
    showKeyboardShortcutsHelp() {
        const helpContent = `
            <div class="keyboard-shortcuts-help">
                <h3>Keyboard Shortcuts</h3>
                <div class="shortcuts-grid">
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + K</kbd>
                        <span>Focus search</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + R</kbd>
                        <span>Refresh data</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + E</kbd>
                        <span>Export data</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + F</kbd>
                        <span>Focus search (alt)</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Escape</kbd>
                        <span>Close modals</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>1-6</kbd>
                        <span>Switch views</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>H</kbd>
                        <span>Show this help</span>
                    </div>
                </div>
            </div>
        `;

        // Create modal for help
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Keyboard Shortcuts</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${helpContent}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
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
    
    // Add missing global functions for HTML onclick handlers
    window.switchView = function(viewType) {
        if (window.dashboard) {
            window.dashboard.switchView(viewType);
        }
    };
    
    window.viewSession = function(sessionId) {
        if (window.dashboard) {
            window.dashboard.viewSession(sessionId);
        }
    };
    
    window.returnToContext = function(sessionId) {
        if (window.dashboard) {
            window.dashboard.returnToContext(sessionId);
        }
    };
    
    window.generateNotebook = function(sessionId) {
        if (window.dashboard) {
            window.dashboard.generateNotebook(sessionId);
        }
    };
    
    window.createIntegrationPackage = function(sessionId) {
        if (window.dashboard) {
            window.dashboard.createIntegrationPackage(sessionId);
        }
    };
    
    // Add filtering functions
    window.filterByProject = function(projectName) {
        if (window.dashboard) {
            window.dashboard.filterByProject(projectName);
        }
    };
    
    window.filterByEventType = function(eventType) {
        if (window.dashboard) {
            window.dashboard.filterByEventType(eventType);
        }
    };
    
    window.viewProjectDetails = function(projectName) {
        if (window.dashboard) {
            window.dashboard.viewProjectDetails(projectName);
        }
    };
    
    // Add missing privacy modal functions
    window.openPrivacyModal = function() {
        if (window.dashboard) {
            window.dashboard.openPrivacyModal();
        }
    };
    
    window.closePrivacyModal = function() {
        if (window.dashboard) {
            window.dashboard.closePrivacyModal();
        }
    };
    
    window.runPrivacyAnalysis = function() {
        if (window.dashboard) {
            window.dashboard.runPrivacyAnalysis();
        }
    };
    
    window.exportPrivacyReport = function() {
        if (window.dashboard) {
            window.dashboard.exportPrivacyReport();
        }
    };
    
    window.configurePrivacySettings = function() {
        if (window.dashboard) {
            window.dashboard.configurePrivacySettings();
        }
    };
    
    // Add session tab switching
    window.switchSessionTab = function(tabName) {
        if (window.dashboard) {
            window.dashboard.switchSessionTab(tabName);
        }
    };
    
    // Debug function to check if dashboard is loaded
    window.checkDashboard = function() {
        console.log('Dashboard loaded:', !!window.dashboard);
        console.log('Dashboard instance:', window.dashboard);
        return window.dashboard;
    };
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (window.dashboard) {
        window.dashboard.stopAutoRefresh();
    }
});
