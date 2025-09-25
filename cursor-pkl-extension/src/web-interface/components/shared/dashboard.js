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
            // Initialize Socket.IO client for main dashboard
            this.socket = io('http://localhost:3000');
            
            // Initialize companion service WebSocket for real-time file changes
            this.companionSocket = io('http://localhost:43918');
            
            // Main dashboard WebSocket
            this.socket.on('connect', () => {
                console.log('Connected to main WebSocket server');
                this.updateConnectionStatus(true);
                
                // Request initial data
                this.socket.emit('request-sessions');
                this.socket.emit('request-live-durations');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from main WebSocket server');
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
            
            // Companion service WebSocket for real-time file changes
            this.companionSocket.on('connect', () => {
                console.log('Connected to companion service WebSocket');
                this.updateCompanionStatus(true);
            });
            
            this.companionSocket.on('disconnect', () => {
                console.log('Disconnected from companion service WebSocket');
                this.updateCompanionStatus(false);
            });
            
            this.companionSocket.on('realtime-update', (update) => {
                console.log('Real-time update received:', update.type, update.data);
                this.handleRealtimeUpdate(update);
            });
            
            this.companionSocket.on('initial-data', (data) => {
                console.log('Received initial data from companion:', data.entries.length, 'entries');
                this.handleInitialCompanionData(data);
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
        this.renderSessions();
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
                notification.style.backgroundColor = '#10b981';
                break;
            case 'error':
                notification.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                notification.style.backgroundColor = '#f59e0b';
                break;
            default:
                notification.style.backgroundColor = '#3b82f6';
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
                                ${session.codeDeltas.slice(0, 5).map((delta, index) => this.formatCodeDelta(delta, index, true)).join('')}
                            </div>
                            <div id="code-deltas-full" style="display: none;">
                                ${session.codeDeltas.map((delta, index) => this.formatCodeDelta(delta, index, false)).join('')}
                            </div>
                            ${session.codeDeltas.length > 5 ? `
                                <p class="expandable-link" onclick="toggleCodeDeltas('${session.id}')" style="cursor: pointer; color: var(--primary-color); text-decoration: underline;">
                                    ... and ${session.codeDeltas.length - 5} more changes
                                </p>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    ${session.fileChanges && session.fileChanges.length > 0 ? `
                    <div class="detail-section">
                        <h3>File Changes (${session.fileChanges.length})</h3>
                        <div class="file-changes">
                            ${session.fileChanges.slice(0, 3).map(change => this.formatFileChange(change)).join('')}
                            ${session.fileChanges.length > 3 ? `
                                <div class="more-changes">
                                    <span class="more-indicator">... and ${session.fileChanges.length - 3} more file changes</span>
                                </div>
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
            // Load session analysis data from Kura
            const response = await fetch('/api/sessions/analyze-with-kura', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    test_mode: false,
                    include_dashboard_data: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load session analysis: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.sessions && data.sessions.length > 0) {
                // Create session analysis visualizations
                const visualizationsHtml = `
                    <div class="analysis-dashboard">
                        <div class="analysis-stats">
                            <div class="stat-card">
                                <h3>Total Sessions</h3>
                                <div class="stat-value">${data.total_sessions || data.sessions.length}</div>
                            </div>
                            <div class="stat-card">
                                <h3>Active Sessions</h3>
                                <div class="stat-value">${data.sessions.filter(s => s.phase === 'IN_PROGRESS').length}</div>
                            </div>
                            <div class="stat-card">
                                <h3>Intent Clusters</h3>
                                <div class="stat-value">${data.clusters ? data.clusters.length : 0}</div>
                            </div>
                        </div>
                        
                        <div class="analysis-charts">
                            <div class="chart-container">
                                <h3>Intent Distribution</h3>
                                <div class="intent-chart" id="intent-distribution-chart"></div>
                            </div>
                            <div class="chart-container">
                                <h3>Session Timeline</h3>
                                <div class="timeline-chart" id="session-timeline-chart"></div>
                            </div>
                        </div>
                        
                        <div class="recent-sessions">
                            <h3>Recent Sessions</h3>
                            <div class="sessions-preview">
                                ${data.sessions.slice(0, 5).map(session => `
                                    <div class="session-preview-card">
                                        <div class="session-intent-badge ${session.intent}">${session.intent}</div>
                                        <div class="session-info">
                                            <div class="session-file">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown'}</div>
                                            <div class="session-time">${new Date(session.timestamp).toLocaleString()}</div>
                                        </div>
                                        <div class="session-status ${session.phase}">${session.phase}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
                
                container.innerHTML = visualizationsHtml;
                
                // Initialize charts after DOM is updated
                this.initializeAnalysisCharts(data);
            } else {
                container.innerHTML = '<div class="no-sessions">No session data available for analysis</div>';
            }
        } catch (error) {
            console.error('Error loading session analysis:', error);
            container.innerHTML = '<div class="no-sessions">Error loading session analysis</div>';
        }
    }

    initializeAnalysisCharts(data) {
        // Initialize intent distribution chart
        this.createIntentDistributionChart(data.sessions);
        
        // Initialize session timeline chart
        this.createSessionTimelineChart(data.sessions);
    }

    createIntentDistributionChart(sessions) {
        const container = document.getElementById('intent-distribution-chart');
        if (!container) return;

        // Count intents
        const intentCounts = {};
        sessions.forEach(session => {
            const intent = session.intent || 'unknown';
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
        });

        // Create simple bar chart
        const maxCount = Math.max(...Object.values(intentCounts));
        const chartHtml = Object.entries(intentCounts).map(([intent, count]) => {
            const percentage = (count / maxCount) * 100;
            return `
                <div class="intent-bar">
                    <div class="intent-label">${intent}</div>
                    <div class="intent-bar-container">
                        <div class="intent-bar-fill" style="width: ${percentage}%"></div>
                        <span class="intent-count">${count}</span>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="intent-chart-content">${chartHtml}</div>`;
    }

    createSessionTimelineChart(sessions) {
        const container = document.getElementById('session-timeline-chart');
        if (!container) return;

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
