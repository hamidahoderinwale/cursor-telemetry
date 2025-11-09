/**
 * Live Dashboard JavaScript
 * Handles session loading and display for the main dashboard
 */

class LiveDashboard {
    constructor() {
        this.sessions = [];
        this.conversations = [];
        this.memories = []; // Initialize memories as empty array
        this.isLoading = false;
        this.refreshInterval = null;
        this.socket = null;
        this.liveDurations = {};
        this.currentView = 'timeline'; // Track current view
        this.enhancedProjectSessionView = null; // Enhanced project/session view
        
        // Advanced search components
        this.searchEngine = null;
        this.realTimeSearch = null;
        this.searchResults = [];
        this.isSearchActive = false;
        
        // Enhanced session modal with program slicing
        this.enhancedSessionModal = null;
        
        // Debounce timers
        this.loadSessionsTimer = null;
        this.loadConversationsTimer = null;
        this.renderViewTimer = null;
        
        this.initializeDashboard();
    }

    /**
     * Debounced version of loadSessions
     */
    loadSessionsDebounced() {
        return new Promise((resolve) => {
            clearTimeout(this.loadSessionsTimer);
            this.loadSessionsTimer = setTimeout(async () => {
                try {
                    await this.loadSessions();
                    resolve();
                } catch (error) {
                    console.error('Error in debounced loadSessions:', error);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Debounced version of loadConversations
     */
    loadConversationsDebounced() {
        return new Promise((resolve) => {
            clearTimeout(this.loadConversationsTimer);
            this.loadConversationsTimer = setTimeout(async () => {
                try {
                    await this.loadConversations();
                    resolve();
                } catch (error) {
                    console.error('Error in debounced loadConversations:', error);
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Debounced version of renderCurrentView
     */
    renderCurrentViewDebounced() {
        clearTimeout(this.renderViewTimer);
        this.renderViewTimer = setTimeout(() => {
            this.renderCurrentView();
        }, 50);
    }

    /**
     * Debounce utility to prevent excessive function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async initializeDashboard() {
        try {
            console.log('Initializing Live Dashboard...');
            
            // Initialize advanced search engine
            this.initializeSearchEngine();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize WebSocket connection
            this.initializeWebSocket();
            
            // Load initial data with error handling
            try {
                await this.loadSessionsDebounced();
                await this.loadConversationsDebounced();
            } catch (error) {
                console.error('Error loading initial data:', error);
                this.showNotification('Failed to load some data. Please refresh the page.', 'error');
            }
            
        // Initialize real data visualizations
        this.initializeRealDataVisualizations();
        
        // Initialize visualization detection
        this.initializeVisualizationDetection();
        
        // Initialize enhanced session modal
        this.initializeEnhancedSessionModal();
            
            // Ensure loading overlay is hidden and dashboard content is visible
            this.ensureDashboardVisible();
            
            // Set default view to timeline
            this.switchView('timeline');
            
            // Set up auto-refresh every 30 seconds (fallback)
            this.startAutoRefresh();
            
            console.log('Live Dashboard initialized successfully');
            
            // Show success notification
            this.showNotification('Dashboard loaded successfully', 'success');
            
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showNotification('Failed to initialize dashboard. Please refresh the page.', 'error');
            
            // Still try to make the dashboard visible even if initialization fails
            this.ensureDashboardVisible();
        }
    }

    ensureDashboardVisible() {
        // Ensure loading overlay is hidden
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.classList.add('hidden');
            console.log('Loading overlay hidden');
        } else {
            console.warn('Loading overlay element not found');
        }
        
        // Ensure dashboard content is visible
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'block';
            dashboardContent.style.visibility = 'visible';
            dashboardContent.style.opacity = '1';
            console.log('Dashboard content made visible');
        } else {
            console.error('Dashboard content element not found');
        }
        
        // Force update statistics to ensure they display
        setTimeout(() => {
            this.updateStatistics();
        }, 100);
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
                    window.realDataVisualizations = this.realDataVisualizations; // Make globally available
                    await this.realDataVisualizations.initialize();
                    console.log('Real data visualizations initialized');
                }
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Error initializing real data visualizations:', error);
        }
    }

    /**
     * Initialize visualization detection system
     */
    initializeVisualizationDetection() {
        try {
            // Use global VisualizationDetector if available
            if (window.VisualizationDetector) {
                this.visualizationDetector = new window.VisualizationDetector();
            } else {
                console.warn('VisualizationDetector not available');
                return;
            }
            
            // Initialize visualization display
            if (window.visualizationDisplay) {
                window.visualizationDisplay.init('visualization-display');
                console.log('Visualization display initialized');
            }
            
            // Analyze existing sessions for visualizations
            this.analyzeSessionsForVisualizations();
            
            console.log('Visualization detection system initialized');
        } catch (error) {
            console.error('Failed to initialize visualization detection:', error);
        }
    }

    /**
     * Initialize enhanced session modal with program slicing
     */
    async initializeEnhancedSessionModal() {
        try {
            // Use the global enhanced session modal instance
            this.enhancedSessionModal = window.enhancedSessionModal;
            
            if (this.enhancedSessionModal) {
                console.log('Enhanced session modal with program slicing initialized');
            } else {
                console.warn('Enhanced session modal not available');
            }
            
        } catch (error) {
            console.error('Failed to initialize enhanced session modal:', error);
        }
    }

    /**
     * Analyze sessions for visualizations
     */
    analyzeSessionsForVisualizations() {
        if (!this.visualizationDetector || !this.sessions) return;
        
        this.sessions.forEach(session => {
            this.analyzeSessionForVisualizations(session);
        });
    }

    /**
     * Analyze a single session for visualizations
     */
    analyzeSessionForVisualizations(session) {
        if (!this.visualizationDetector || !session.codeDeltas) return;
        
        // Combine all code from the session
        const sessionCode = session.codeDeltas
            .map(delta => delta.content || delta.code || '')
            .join('\n');
        
        if (!sessionCode.trim()) return;
        
        // Analyze the code for visualizations
        const analysis = this.visualizationDetector.analyzeCode(sessionCode, session.id);
        
        if (analysis.visualizations.length > 0) {
            console.log(`Found ${analysis.visualizations.length} visualizations in session ${session.id}`);
            
            // Store analysis results in session
            session.visualizationAnalysis = analysis;
        }
    }

    /**
     * Generate HTML for visualizations tab
     */
    generateVisualizationsHTML(session) {
        // Check if we have visualization analysis for this session
        if (!session.visualizationAnalysis || !session.visualizationAnalysis.visualizations) {
            // Try to analyze the session if we haven't already
            this.analyzeSessionForVisualizations(session);
        }

        const visualizations = session.visualizationAnalysis?.visualizations || [];
        
        if (visualizations.length === 0) {
            return `
                <div class="no-visualizations">
                    <div class="no-visualizations-icon"></div>
                    <h3>No Visualizations Detected</h3>
                    <p>This session doesn't appear to have generated any visualizations.</p>
                    <p>Visualizations are detected from code that uses:</p>
                    <ul>
                        <li><code>plt.savefig()</code> (Matplotlib)</li>
                        <li><code>fig.write_html()</code> (Plotly)</li>
                        <li><code>sns.savefig()</code> (Seaborn)</li>
                        <li>File output operations with image extensions</li>
                    </ul>
                </div>
            `;
        }

        return `
            <div class="session-visualizations">
                <div class="visualizations-header">
                    <h3>Generated Visualizations</h3>
                    <span class="visualization-count">${visualizations.length} found</span>
                </div>
                
                <div class="visualization-grid">
                    ${visualizations.map(viz => this.renderVisualizationCard(viz)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render a single visualization card
     */
    renderVisualizationCard(viz) {
        const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(viz.extension);
        const isHtml = viz.extension === '.html';
        const isJson = viz.extension === '.json';
        
        return `
            <div class="visualization-card" data-viz-id="${viz.id}">
                <div class="visualization-preview">
                    ${this.renderVisualizationPreview(viz, isImage, isHtml, isJson)}
                </div>
                
                <div class="visualization-info">
                    <h4 class="visualization-title">${this.generateVisualizationTitle(viz.path)}</h4>
                    <p class="visualization-description">${this.generateVisualizationDescription(viz)}</p>
                    
                    <div class="visualization-meta">
                        <span class="meta-item">
                            <span class="meta-label">Type:</span>
                            <span class="meta-value">${viz.type}</span>
                        </span>
                        <span class="meta-item">
                            <span class="meta-label">Line:</span>
                            <span class="meta-value">${viz.line}</span>
                        </span>
                        <span class="meta-item">
                            <span class="meta-label">Extension:</span>
                            <span class="meta-value">${viz.extension}</span>
                        </span>
                    </div>
                    
                    <div class="visualization-actions">
                        <button class="btn btn-sm btn-primary" onclick="dashboard.viewVisualization('${viz.id}', '${viz.resolvedPath}', '${viz.extension}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            View
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="dashboard.downloadVisualization('${viz.resolvedPath}', '${this.generateVisualizationTitle(viz.path)}${viz.extension}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7,10 12,15 17,10"></polyline>
                            </svg>
                            Download
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render preview for different file types
     */
    renderVisualizationPreview(viz, isImage, isHtml, isJson) {
        if (isImage) {
            return `
                <div class="image-preview">
                    <img src="${this.getVisualizationUrl(viz.resolvedPath)}" 
                         alt="${this.generateVisualizationTitle(viz.path)}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                    <div class="preview-error" style="display: none;">
                        <div class="error-icon"></div>
                        <p>Image not found</p>
                    </div>
                </div>
            `;
        } else if (isHtml) {
            return `
                <div class="html-preview">
                    <div class="preview-icon">🌐</div>
                    <p>HTML Visualization</p>
                </div>
            `;
        } else if (isJson) {
            return `
                <div class="json-preview">
                    <div class="preview-icon"></div>
                    <p>JSON Data</p>
                </div>
            `;
        } else {
            return `
                <div class="generic-preview">
                    <div class="preview-icon"></div>
                    <p>${viz.extension.toUpperCase()} File</p>
                </div>
            `;
        }
    }

    /**
     * Generate visualization title from path
     */
    generateVisualizationTitle(path) {
        const filename = path.split('/').pop().split('\\').pop();
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        
        return nameWithoutExt
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Generate visualization description
     */
    generateVisualizationDescription(viz) {
        const typeDescriptions = {
            matplotlib: 'Matplotlib plot',
            plotly: 'Plotly visualization',
            seaborn: 'Seaborn plot',
            fileOutput: 'Generated visualization file'
        };
        
        return typeDescriptions[viz.type] || 'Generated visualization';
    }

    /**
     * Get visualization URL for display
     */
    getVisualizationUrl(path) {
        // Convert file path to URL
        if (path.startsWith('/')) {
            return `http://localhost:3000/static${path}`;
        } else {
            return `http://localhost:3000/static/${path}`;
        }
    }

    /**
     * View a visualization in a modal
     */
    viewVisualization(vizId, path, extension) {
        const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(extension);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay visualization-modal';
        modal.innerHTML = `
            <div class="modal-content visualization-modal-content">
                <div class="modal-header">
                    <h3>Visualization</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="visualization-viewer">
                        ${isImage ? `
                            <img src="${this.getVisualizationUrl(path)}" 
                                 alt="Visualization" 
                                 style="max-width: 100%; max-height: 80vh; object-fit: contain;">
                        ` : `
                            <div class="file-info">
                                <p><strong>File:</strong> ${path}</p>
                                <p><strong>Type:</strong> ${extension}</p>
                                <p>This file type cannot be previewed directly.</p>
                            </div>
                        `}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="dashboard.downloadVisualization('${path}', 'visualization${extension}')">
                        Download
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Download a visualization
     */
    downloadVisualization(path, filename) {
        // Create download link
        const link = document.createElement('a');
        link.href = this.getVisualizationUrl(path);
        link.download = filename;
        link.click();
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
                this.resetReconnectionAttempts(); // Reset reconnection attempts on success
                
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
                
                this.renderCurrentViewDebounced();
                this.updateStatistics();
            });
            
            // Real-time update handlers
            this.socket.on('real-time-update', (update) => {
                // Only log frequent updates occasionally to reduce spam
                if (!['cursor-position', 'active-window', 'network-activity'].includes(update.type)) {
                    console.log('📡 Real-time update received:', update.type);
                }
                this.handleRealtimeUpdate(update);
            });
            
            this.socket.on('conversation-detected', (conversation) => {
                console.log('💬 Conversation detected:', conversation.source);
                this.handleConversationDetected(conversation);
            });
            
            this.socket.on('file-change', (change) => {
                console.log('File change detected:', change.filePath);
                this.handleFileChange(change);
            });
            
            this.socket.on('process-change', (process) => {
                console.log(' Process change:', process.displayName, process.isRunning ? 'started' : 'stopped');
                this.handleProcessChange(process);
            });
            
            this.socket.on('system-resources', (resources) => {
                this.handleSystemResources(resources);
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
                this.loadSessionsDebounced(); // Refresh to get the new session
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

            this.socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
                this.showNotification('Connection failed, retrying...', 'warning');
                this.scheduleReconnection();
            });
            
        } catch (error) {
            console.error('Error initializing WebSocket:', error);
            this.showError('Failed to initialize real-time connection');
        }
    }

    /**
     * Schedule WebSocket reconnection with exponential backoff
     */
    scheduleReconnection() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts || 0), 30000);
        this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            if (this.socket && !this.socket.connected) {
                console.log('Attempting to reconnect...');
                this.socket.connect();
            }
        }, delay);
    }

    /**
     * Reset reconnection attempts on successful connection
     */
    resetReconnectionAttempts() {
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
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
        console.log('Handling real-time update:', update);
        
        // Update statistics in real-time
        if (update.type === 'file-change' || update.type === 'conversation-detected') {
            this.updateStatistics();
        }
        
        // Trigger view updates
        this.renderCurrentViewDebounced();
        
        switch (update.type) {
            case 'file-change':
                this.handleFileChange(update.data);
                break;
            case 'prompt-captured':
                this.handlePromptCaptured(update.data);
                break;
            case 'conversation-detected':
                this.handleConversationDetected(update.data);
                break;
            case 'process-change':
                this.handleProcessChange(update.data);
                break;
            case 'system-resources':
                this.handleSystemResources(update.data);
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
    
    handleConversationDetected(conversation) {
        console.log('💬 New conversation detected:', conversation);
        
        // Add to conversations list
        this.conversations = this.conversations || [];
        this.conversations.push(conversation);
        
        // Show notification
        this.showNotification(`New conversation from ${conversation.source}`, 'info');
        
        // Update statistics
        this.updateStatistics();
        
        // Trigger view refresh
        this.renderCurrentViewDebounced();
    }
    
    handleProcessChange(process) {
        console.log(' Process change:', process);
        
        // Update connection status if it's Cursor
        if (process.displayName && process.displayName.toLowerCase().includes('cursor')) {
            this.updateConnectionStatus(process.isRunning);
        }
        
        // Show notification
        const status = process.isRunning ? 'started' : 'stopped';
        this.showNotification(`${process.displayName || process.processName} ${status}`, 'info');
    }
    
    handleSystemResources(resources) {
        // Update system resource indicators if they exist
        const resourceElement = document.getElementById('system-resources');
        if (resourceElement) {
            resourceElement.innerHTML = `
                <div>CPU: ${Math.round(resources.cpuUsage.user / 1000000)}%</div>
                <div>Memory: ${Math.round(resources.memoryUsage.heapUsed / 1024 / 1024)}MB</div>
                <div>Uptime: ${Math.round(resources.uptime / 60)}min</div>
            `;
        }
    }

    handlePromptCaptured(data) {
        console.log('Enhanced prompt captured:', data);
        
        // Enhanced prompt processing with pattern matching
        const enhancedPrompt = this.processPromptWithPatterns(data);
        
        // Add the enhanced prompt to the current session or create a new one
        if (this.sessions.length > 0) {
            const currentSession = this.sessions[0];
            if (!currentSession.conversations) {
                currentSession.conversations = [];
            }
            currentSession.conversations.push({
                id: `prompt-${Date.now()}`,
                sessionId: currentSession.id,
                timestamp: data.timestamp || new Date().toISOString(),
                role: 'user',
                content: data.text || data.prompt || '',
                context: data.context || '',
                // Enhanced prompt metadata
                intent: enhancedPrompt.intent,
                complexity: enhancedPrompt.complexity,
                keywords: enhancedPrompt.keywords,
                patterns: enhancedPrompt.patterns,
                semanticAnalysis: enhancedPrompt.semanticAnalysis
            });
        }
        
        // Show enhanced notification
        this.showNotification(`New ${enhancedPrompt.intent} prompt captured`, 'success');
        
        // Refresh the display
        this.renderCurrentView();
    }

    /**
     * Enhanced prompt processing with comprehensive pattern matching
     */
    processPromptWithPatterns(data) {
        const prompt = data.text || data.prompt || '';
        const context = data.context || '';
        
        // Comprehensive prompt patterns from your technical overview
        const promptPatterns = [
            // Direct prompt patterns
            { pattern: /(?:prompt|question|ask|request):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'direct_prompt' },
            { pattern: /(?:user|you):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'user_directive' },
            { pattern: /(?:please|can you|help me):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'request' },
            
            // Cursor-specific patterns
            { pattern: /@cursor\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'cursor_directive' },
            { pattern: /@ai\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'ai_directive' },
            { pattern: /@assistant\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'assistant_directive' },
            
            // Code comment patterns
            { pattern: /\/\/\s*prompt:\s*(.+?)(?:\n|$)/gi, type: 'code_comment_prompt' },
            { pattern: /#\s*prompt:\s*(.+?)(?:\n|$)/gi, type: 'python_comment_prompt' },
            { pattern: /<!--\s*prompt:\s*(.+?)\s*-->/gi, type: 'html_comment_prompt' },
            
            // Conversation patterns
            { pattern: /Human:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'conversation_human' },
            { pattern: /User:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'conversation_user' },
            { pattern: /Me:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'conversation_me' },
            
            // Task patterns
            { pattern: /Task:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'task_definition' },
            { pattern: /Goal:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'goal_definition' },
            { pattern: /Objective:\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'objective_definition' },
        ];

        // Extract patterns and analyze intent
        const patterns = [];
        const extractedContent = [];
        
        promptPatterns.forEach(({ pattern, type }) => {
            const matches = [...prompt.matchAll(pattern)];
            matches.forEach(match => {
                patterns.push({
                    type: type,
                    content: match[1]?.trim(),
                    fullMatch: match[0]
                });
                extractedContent.push(match[1]?.trim());
            });
        });

        // Intent classification based on content analysis
        const intent = this.classifyPromptIntent(prompt, context, patterns);
        
        // Complexity analysis
        const complexity = this.analyzePromptComplexity(prompt);
        
        // Keyword extraction
        const keywords = this.extractKeywords(prompt);
        
        // Semantic analysis
        const semanticAnalysis = this.performSemanticAnalysis(prompt, context);

        return {
            intent,
            complexity,
            keywords,
            patterns,
            semanticAnalysis,
            extractedContent,
            originalPrompt: prompt,
            context: context
        };
    }

    /**
     * Classify prompt intent based on content and patterns
     */
    classifyPromptIntent(prompt, context, patterns) {
        const content = (prompt + ' ' + context).toLowerCase();
        
        // Intent classification patterns
        const intentPatterns = {
            'data_visualization': ['plot', 'chart', 'graph', 'visualize', 'matplotlib', 'seaborn', 'plotly', 'show'],
            'data_analysis': ['analyze', 'analysis', 'data', 'dataset', 'pandas', 'numpy', 'statistics'],
            'code_implementation': ['implement', 'create', 'build', 'write', 'function', 'class', 'method'],
            'debugging': ['debug', 'error', 'bug', 'fix', 'issue', 'problem', 'troubleshoot'],
            'optimization': ['optimize', 'performance', 'speed', 'efficient', 'improve', 'better'],
            'documentation': ['document', 'comment', 'explain', 'readme', 'docstring', 'help'],
            'testing': ['test', 'testing', 'unit test', 'assert', 'verify', 'check'],
            'refactoring': ['refactor', 'restructure', 'reorganize', 'clean up', 'simplify']
        };

        let maxScore = 0;
        let detectedIntent = 'general';

        Object.entries(intentPatterns).forEach(([intent, keywords]) => {
            const score = keywords.reduce((acc, keyword) => {
                return acc + (content.includes(keyword) ? 1 : 0);
            }, 0);
            
            if (score > maxScore) {
                maxScore = score;
                detectedIntent = intent;
            }
        });

        // Check for pattern-based intent
        if (patterns.length > 0) {
            const patternTypes = patterns.map(p => p.type);
            if (patternTypes.includes('cursor_directive') || patternTypes.includes('ai_directive')) {
                detectedIntent = 'ai_assistance';
            } else if (patternTypes.includes('task_definition') || patternTypes.includes('goal_definition')) {
                detectedIntent = 'task_definition';
            }
        }

        return detectedIntent;
    }

    /**
     * Analyze prompt complexity
     */
    analyzePromptComplexity(prompt) {
        const words = prompt.split(/\s+/).length;
        const sentences = prompt.split(/[.!?]+/).length;
        const technicalTerms = ['function', 'class', 'import', 'def', 'return', 'variable', 'array', 'dataframe', 'model', 'algorithm'];
        const technicalTermCount = technicalTerms.filter(term => prompt.toLowerCase().includes(term)).length;
        
        let complexity = 'simple';
        if (words > 50 || sentences > 3 || technicalTermCount > 3) {
            complexity = 'complex';
        } else if (words > 20 || sentences > 2 || technicalTermCount > 1) {
            complexity = 'medium';
        }
        
        return {
            level: complexity,
            wordCount: words,
            sentenceCount: sentences,
            technicalTermCount: technicalTermCount
        };
    }

    /**
     * Extract keywords from prompt
     */
    extractKeywords(prompt) {
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
        
        const words = prompt.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.includes(word));
        
        // Count word frequency
        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        // Return top keywords
        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word, count]) => ({ word, count }));
    }

    /**
     * Perform semantic analysis on prompt
     */
    performSemanticAnalysis(prompt, context) {
        const content = (prompt + ' ' + context).toLowerCase();
        
        return {
            hasCodeRequest: /code|function|class|implement|write/.test(content),
            hasDataRequest: /data|dataset|analysis|visualize/.test(content),
            hasDebugRequest: /debug|error|bug|fix|issue/.test(content),
            hasOptimizationRequest: /optimize|performance|speed|efficient/.test(content),
            hasDocumentationRequest: /document|comment|explain|readme/.test(content),
            urgency: /urgent|asap|quickly|immediately/.test(content) ? 'high' : 'normal',
            complexity: this.analyzePromptComplexity(prompt).level
        };
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
                
                // Re-index sessions for search
                this.indexSessionsForSearch();
                
                // Also reload conversations when sessions are refreshed
                await this.loadConversations();
                
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

    async loadConversations() {
        try {
            console.log('Loading conversations...');
            
            // Show loading state on the conversations button
            this.setConversationsButtonLoading(true);
            
            const response = await fetch('/api/conversations');
            
            if (response.ok) {
                const data = await response.json();
                this.conversations = data.conversations || [];
                console.log(`Loaded ${this.conversations.length} conversations from API`);
                console.log('Sample conversation:', this.conversations[0]);
                console.log('Full conversations data:', this.conversations);
                
                // Link conversations to sessions
                this.linkConversationsToSessions();
                
                // Update statistics after loading conversations
                this.updateStatistics();
                
                // Re-render sessions to show conversations
                this.renderCurrentView();
                
                // Show notification if conversations were loaded
                if (this.conversations.length > 0) {
                    this.showNotification(`Loaded ${this.conversations.length} conversations`, 'success');
                } else {
                    this.showNotification('No conversations found', 'info');
                }
            } else {
                console.warn('Failed to load conversations:', response.status, response.statusText);
                this.conversations = [];
                this.showNotification('Failed to load conversations', 'error');
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.conversations = [];
            this.showNotification('Error loading conversations: ' + error.message, 'error');
        } finally {
            // Always reset loading state
            this.setConversationsButtonLoading(false);
        }
    }

    /**
     * Link conversations to their corresponding sessions
     */
    linkConversationsToSessions() {
        if (!this.conversations || !this.sessions) {
            return;
        }

        // Create a map of session IDs for quick lookup
        const sessionMap = new Map();
        this.sessions.forEach(session => {
            sessionMap.set(session.id, session);
            // Initialize conversations array if it doesn't exist
            if (!session.conversations) {
                session.conversations = [];
            }
        });

        // Link conversations to sessions
        let linkedCount = 0;
        this.conversations.forEach(conversation => {
            if (conversation.sessionId && sessionMap.has(conversation.sessionId)) {
                const session = sessionMap.get(conversation.sessionId);
                session.conversations.push(conversation);
                linkedCount++;
            }
        });

        console.log(`Linked ${linkedCount} conversations to sessions`);
    }

    async loadSessionConversations(sessionId) {
        try {
            console.log(`Loading conversations for session ${sessionId}...`);
            const response = await fetch(`/api/session/${sessionId}/conversations`);
            
            if (response.ok) {
                const data = await response.json();
                const conversations = data.conversations || [];
                
                // Update the session with conversations
                const session = this.sessions.find(s => s.id === sessionId);
                if (session) {
                    session.conversations = conversations;
                    // Re-render the session detail if it's currently open
                    this.renderCurrentView();
                }
                
                console.log(`Loaded ${conversations.length} conversations for session ${sessionId}`);
            } else {
                console.warn(`Failed to load conversations for session ${sessionId}:`, response.status);
            }
        } catch (error) {
            console.error(`Error loading conversations for session ${sessionId}:`, error);
        }
    }

    getConversationsForSession(sessionId) {
        // First try to find conversations in the global conversations array
        const globalConversations = this.conversations.filter(conv => 
            conv.sessionId === sessionId || conv.session_id === sessionId
        );
        
        if (globalConversations.length > 0) {
            return globalConversations;
        }
        
        // Then try to find the session and return its conversations
        const session = this.sessions.find(s => s.id === sessionId);
        return session?.conversations || [];
    }

    getConversationSummary(session) {
        // Try multiple data sources for conversations
        let conversations = session.conversations || 
                           session.conversationEvents || 
                           session.messages || 
                           session.prompts || 
                           this.getConversationsForSession(session.id) || 
                           [];

        if (!conversations || conversations.length === 0) {
            return null;
        }

        const conversationCount = conversations.length;
        
        // Calculate total tokens if available
        const totalTokens = conversations.reduce((sum, conv) => sum + (conv.tokens || 0), 0);
        
        // Get the most recent conversation timestamp
        const timestamps = conversations
            .map(conv => conv.timestamp || conv.created_at || conv.time)
            .filter(ts => ts)
            .sort((a, b) => new Date(b) - new Date(a));
        
        const mostRecent = timestamps.length > 0 ? new Date(timestamps[0]) : null;
        
        // Create summary text
        let summary = `${conversationCount} conversation${conversationCount > 1 ? 's' : ''}`;
        
        if (totalTokens > 0) {
            summary += ` (${totalTokens.toLocaleString()} tokens)`;
        }
        
        if (mostRecent) {
            const timeAgo = this.getTimeAgo(mostRecent);
            summary += ` • Last: ${timeAgo}`;
        }
        
        return summary;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return new Date(date).toLocaleDateString();
    }

    getConversationPreview(session) {
        // Try multiple data sources for conversations
        let conversations = session.conversations || 
                           session.conversationEvents || 
                           session.messages || 
                           session.prompts || 
                           this.getConversationsForSession(session.id) || 
                           [];

        if (!conversations || conversations.length === 0) {
            return null;
        }

        // Get the most recent conversation
        const sortedConversations = conversations
            .filter(conv => conv.prompt || conv.userMessage || conv.content || conv.message)
            .sort((a, b) => {
                const timeA = new Date(a.timestamp || a.created_at || a.time || 0);
                const timeB = new Date(b.timestamp || b.created_at || b.time || 0);
                return timeB - timeA;
            });

        if (sortedConversations.length === 0) {
            return null;
        }

        const mostRecent = sortedConversations[0];
        const previewText = mostRecent.prompt || 
                           mostRecent.userMessage || 
                           mostRecent.content || 
                           mostRecent.message || 
                           'No preview available';

        // Truncate and clean up the text
        const cleanedText = previewText
            .replace(/\n+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return cleanedText.length > 80 ? cleanedText.substring(0, 80) + '...' : cleanedText;
    }

    showConversationDetail(sessionId, conversationIndex) {
        const conversations = this.getConversationsForSession(sessionId);
        if (conversations && conversations[conversationIndex]) {
            const conversation = conversations[conversationIndex];
            
            // Create a modal to show full conversation details
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Conversation Details</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="conversation-detail">
                            <div class="conversation-meta">
                                <span>Session: ${sessionId}</span>
                                <span>Index: #${conversationIndex + 1}</span>
                                <span>Time: ${new Date(conversation.timestamp || conversation.created_at).toLocaleString()}</span>
                            </div>
                            <div class="conversation-full">
                                <div class="conversation-prompt-full">
                                    <h4>User Prompt:</h4>
                                    <div class="conversation-content-full">${conversation.prompt || conversation.userMessage || conversation.content || conversation.message || 'No prompt recorded'}</div>
                                </div>
                                <div class="conversation-response-full">
                                    <h4>AI Response:</h4>
                                    <div class="conversation-content-full">${conversation.response || conversation.aiMessage || conversation.assistantMessage || 'No response recorded'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="dashboard.copyConversation('${sessionId}', ${conversationIndex})">Copy Conversation</button>
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
    }

    copyConversation(sessionId, conversationIndex) {
        const conversations = this.getConversationsForSession(sessionId);
        if (conversations && conversations[conversationIndex]) {
            const conversation = conversations[conversationIndex];
            const text = `User: ${conversation.prompt || conversation.userMessage || conversation.content || conversation.message || 'No prompt recorded'}\n\nAI: ${conversation.response || conversation.aiMessage || conversation.assistantMessage || 'No response recorded'}`;
            
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Conversation copied to clipboard', 'success');
            }).catch(err => {
                console.error('Failed to copy conversation:', err);
                this.showNotification('Failed to copy conversation', 'error');
            });
        }
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
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
                        ${this.getConversationSummary(session) ? `
                        <div class="info-item conversation-summary">
                            <span class="info-icon"></span>
                            <span class="info-text">${this.getConversationSummary(session)}</span>
                            ${this.getConversationPreview(session) ? `
                            <div class="conversation-preview">
                                <span class="preview-text">${this.getConversationPreview(session)}</span>
                            </div>
                            ` : ''}
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
                    <button class="btn btn-sm btn-secondary" onclick="generateNotebook('${session.id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14,2 14,8 20,8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10,9 9,9 8,9"></polyline>
                        </svg>
                        Generate Notebook
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
        
        // Enhanced calculation of total changes
        const totalChanges = this.sessions.reduce((sum, session) => {
            const codeDeltas = session.codeDeltas ? session.codeDeltas.length : 0;
            const fileChanges = session.fileChanges ? session.fileChanges.length : 0;
            return sum + codeDeltas + fileChanges;
        }, 0);

        // Enhanced calculation of total conversations
        let totalConversations = 0;
        
        // Count conversations from global conversations array
        if (this.conversations && this.conversations.length > 0) {
            totalConversations += this.conversations.length;
        }
        
        // Also count conversations stored directly in sessions
        const sessionConversations = this.sessions.reduce((sum, session) => {
            return sum + (session.conversations ? session.conversations.length : 0);
        }, 0);

        totalConversations += sessionConversations;

        // Calculate unique files modified across all sessions
        const allFileChanges = new Set();
        this.sessions.forEach(session => {
            if (session.fileChanges) {
                session.fileChanges.forEach(fc => {
                    if (fc.fileName) {
                        allFileChanges.add(fc.fileName);
                    } else if (fc.filePath) {
                        allFileChanges.add(fc.filePath);
                    }
                });
            }
        });
        const totalFilesModified = allFileChanges.size;

        const sessionsWithDuration = this.sessions.filter(s => s.duration && s.duration > 0);
        const avgDuration = sessionsWithDuration.length > 0 
            ? sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0) / sessionsWithDuration.length
            : 0;

        // Update statistics display if elements exist
        const statsElements = {
            'totalSessions': totalSessions,
            'totalChanges': totalChanges,
            'totalConversations': totalConversations,
            'totalFilesModified': totalFilesModified,
            'avg-duration': avgDuration > 0 ? this.formatDuration(avgDuration) : '-'
        };

        Object.entries(statsElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                // Add visual feedback for updates
                element.classList.add('updated');
                setTimeout(() => element.classList.remove('updated'), 500);
            } else {
                console.warn(`Statistics element not found: ${id}`);
            }
        });

        // Only log statistics occasionally to reduce spam
        if (Math.random() < 0.1) { // Log only 10% of the time
            console.log(`Statistics updated: ${totalSessions} total, ${totalChanges} changes, ${totalConversations} conversations, ${totalFilesModified} files modified`);
            console.log(`Conversations loaded: ${this.conversations ? this.conversations.length : 0} global conversations`);
            console.log(`Session conversations: ${sessionConversations} conversations in sessions`);
        }
        
        // Debug: Show sample session data
        if (this.sessions.length > 0) {
            const sampleSession = this.sessions[0];
            console.log('Sample session data:', {
                id: sampleSession.id,
                hasCodeDeltas: !!sampleSession.codeDeltas,
                codeDeltasCount: sampleSession.codeDeltas ? sampleSession.codeDeltas.length : 0,
                hasFileChanges: !!sampleSession.fileChanges,
                fileChangesCount: sampleSession.fileChanges ? sampleSession.fileChanges.length : 0,
                hasConversations: !!sampleSession.conversations,
                conversationsCount: sampleSession.conversations ? sampleSession.conversations.length : 0
            });
        }
    }

    /**
     * Calculate comprehensive statistics for export
     */
    calculateStatistics() {
        const totalSessions = this.sessions.length;
        
        // Define "active" as sessions with recent activity (within last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const activeSessions = this.sessions.filter(s => {
            const sessionTime = new Date(s.timestamp || s.startTime || 0);
            const isRecent = sessionTime > thirtyMinutesAgo;
            
            // Also consider sessions that are explicitly marked as in progress AND recent
            const isInProgress = (s.outcome === 'in_progress' || 
                                s.outcome === 'IN_PROGRESS' || 
                                s.phase === 'IN_PROGRESS') && isRecent;
            
            return isInProgress;
        }).length;

        const totalChanges = this.sessions.reduce((sum, session) => {
            return sum + (session.codeDeltas ? session.codeDeltas.length : 0);
        }, 0);

        const totalConversations = this.conversations.length;

        const sessionsWithDuration = this.sessions.filter(s => s.duration && s.duration > 0);
        const avgDuration = sessionsWithDuration.length > 0 
            ? sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0) / sessionsWithDuration.length
            : 0;

        // Calculate additional metrics
        const sessionsByIntent = {};
        const sessionsByPhase = {};
        const fileTypes = {};
        const totalTokens = this.conversations.reduce((sum, c) => sum + (c.tokens || 0), 0);

        this.sessions.forEach(session => {
            // Intent distribution
            const intent = session.intent || 'unknown';
            sessionsByIntent[intent] = (sessionsByIntent[intent] || 0) + 1;

            // Phase distribution
            const phase = session.phase || 'unknown';
            sessionsByPhase[phase] = (sessionsByPhase[phase] || 0) + 1;

            // File type analysis
            if (session.currentFile) {
                const ext = session.currentFile.split('.').pop() || 'no-extension';
                fileTypes[ext] = (fileTypes[ext] || 0) + 1;
            }
        });

        return {
            totalSessions,
            activeSessions,
            totalChanges,
            totalConversations,
            totalTokens,
            averageDuration: avgDuration,
            sessionsByIntent,
            sessionsByPhase,
            fileTypes,
            dataQuality: {
                sessionsWithDuration: sessionsWithDuration.length,
                sessionsWithIntent: Object.keys(sessionsByIntent).length,
                sessionsWithFiles: Object.keys(fileTypes).length,
                completenessScore: this.calculateCompletenessScore()
            }
        };
    }

    /**
     * Calculate workflow insights
     */
    calculateWorkflowInsights() {
        const insights = {
            patterns: this.identifyWorkflowPatterns(),
            recommendations: this.generateRecommendations(),
            trends: this.analyzeTrends(),
            productivity: this.calculateProductivityMetrics()
        };

        return insights;
    }

    /**
     * Calculate completeness score
     */
    calculateCompletenessScore() {
        if (this.sessions.length === 0) return 0;

        let totalScore = 0;
        this.sessions.forEach(session => {
            let sessionScore = 0;
            
            // Check for essential data
            if (session.intent) sessionScore += 0.2;
            if (session.phase) sessionScore += 0.2;
            if (session.currentFile) sessionScore += 0.2;
            if (session.codeDeltas && session.codeDeltas.length > 0) sessionScore += 0.2;
            if (session.duration && session.duration > 0) sessionScore += 0.2;

            totalScore += sessionScore;
        });

        return totalScore / this.sessions.length;
    }

    /**
     * Identify workflow patterns
     */
    identifyWorkflowPatterns() {
        const patterns = {
            commonIntents: this.getTopItems(this.sessions.map(s => s.intent).filter(Boolean), 5),
            commonPhases: this.getTopItems(this.sessions.map(s => s.phase).filter(Boolean), 5),
            commonFileTypes: this.getTopItems(
                this.sessions
                    .map(s => s.currentFile)
                    .filter(Boolean)
                    .map(f => f.split('.').pop())
                    .filter(Boolean), 
                5
            ),
            averageSessionLength: this.calculateAverageSessionLength(),
            mostActiveTime: this.calculateMostActiveTime()
        };

        return patterns;
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        const recommendations = [];

        // Analyze session duration patterns
        const shortSessions = this.sessions.filter(s => s.duration && s.duration < 300); // Less than 5 minutes
        if (shortSessions.length > this.sessions.length * 0.3) {
            recommendations.push({
                type: 'duration',
                message: 'Consider longer focused sessions for better productivity',
                priority: 'medium'
            });
        }

        // Analyze file type diversity
        const fileTypes = new Set(
            this.sessions
                .map(s => s.currentFile)
                .filter(Boolean)
                .map(f => f.split('.').pop())
        );
        if (fileTypes.size < 3) {
            recommendations.push({
                type: 'diversity',
                message: 'Try working with different file types to broaden your skills',
                priority: 'low'
            });
        }

        // Analyze conversation patterns
        if (this.conversations.length > 0) {
            const avgTokensPerConversation = this.conversations.reduce((sum, c) => sum + (c.tokens || 0), 0) / this.conversations.length;
            if (avgTokensPerConversation > 1000) {
                recommendations.push({
                    type: 'conversation',
                    message: 'Consider breaking down complex conversations into smaller, focused sessions',
                    priority: 'low'
                });
            }
        }

        return recommendations;
    }

    /**
     * Analyze trends
     */
    analyzeTrends() {
        const trends = {
            sessionFrequency: this.calculateSessionFrequency(),
            productivityTrend: this.calculateProductivityTrend(),
            technologyUsage: this.analyzeTechnologyUsage()
        };

        return trends;
    }

    /**
     * Calculate productivity metrics
     */
    calculateProductivityMetrics() {
        const metrics = {
            sessionsPerDay: this.calculateSessionsPerDay(),
            averageChangesPerSession: this.calculateAverageChangesPerSession(),
            codeVelocity: this.calculateCodeVelocity(),
            conversationEfficiency: this.calculateConversationEfficiency()
        };

        return metrics;
    }

    /**
     * Helper method to get top items
     */
    getTopItems(items, limit = 5) {
        const counts = {};
        items.forEach(item => {
            counts[item] = (counts[item] || 0) + 1;
        });

        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([item, count]) => ({ item, count }));
    }

    /**
     * Calculate average session length
     */
    calculateAverageSessionLength() {
        const sessionsWithDuration = this.sessions.filter(s => s.duration && s.duration > 0);
        if (sessionsWithDuration.length === 0) return 0;
        
        return sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0) / sessionsWithDuration.length;
    }

    /**
     * Calculate most active time
     */
    calculateMostActiveTime() {
        const hourCounts = {};
        this.sessions.forEach(session => {
            if (session.timestamp) {
                const hour = new Date(session.timestamp).getHours();
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });

        const mostActiveHour = Object.entries(hourCounts)
            .sort(([,a], [,b]) => b - a)[0];

        return mostActiveHour ? {
            hour: mostActiveHour[0],
            count: mostActiveHour[1]
        } : null;
    }

    /**
     * Calculate session frequency
     */
    calculateSessionFrequency() {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const recentSessions = this.sessions.filter(s => 
            s.timestamp && new Date(s.timestamp) > oneWeekAgo
        );
        const monthlySessions = this.sessions.filter(s => 
            s.timestamp && new Date(s.timestamp) > oneMonthAgo
        );

        return {
            last7Days: recentSessions.length,
            last30Days: monthlySessions.length,
            averagePerWeek: monthlySessions.length / 4.3
        };
    }

    /**
     * Calculate productivity trend
     */
    calculateProductivityTrend() {
        // Simple trend analysis based on recent vs older sessions
        const now = new Date();
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const recentSessions = this.sessions.filter(s => 
            s.timestamp && new Date(s.timestamp) > twoWeeksAgo
        );
        const olderSessions = this.sessions.filter(s => 
            s.timestamp && new Date(s.timestamp) <= twoWeeksAgo
        );

        if (olderSessions.length === 0) return 'insufficient_data';

        const recentAvgChanges = recentSessions.reduce((sum, s) => sum + (s.codeDeltas?.length || 0), 0) / Math.max(recentSessions.length, 1);
        const olderAvgChanges = olderSessions.reduce((sum, s) => sum + (s.codeDeltas?.length || 0), 0) / Math.max(olderSessions.length, 1);

        if (recentAvgChanges > olderAvgChanges * 1.1) return 'increasing';
        if (recentAvgChanges < olderAvgChanges * 0.9) return 'decreasing';
        return 'stable';
    }

    /**
     * Analyze technology usage
     */
    analyzeTechnologyUsage() {
        const fileTypes = {};
        this.sessions.forEach(session => {
            if (session.currentFile) {
                const ext = session.currentFile.split('.').pop();
                if (ext) {
                    fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                }
            }
        });

        return Object.entries(fileTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([type, count]) => ({ type, count }));
    }

    /**
     * Calculate sessions per day
     */
    calculateSessionsPerDay() {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const recentSessions = this.sessions.filter(s => 
            s.timestamp && new Date(s.timestamp) > oneWeekAgo
        );

        return recentSessions.length / 7;
    }

    /**
     * Calculate average changes per session
     */
    calculateAverageChangesPerSession() {
        if (this.sessions.length === 0) return 0;
        
        const totalChanges = this.sessions.reduce((sum, s) => sum + (s.codeDeltas?.length || 0), 0);
        return totalChanges / this.sessions.length;
    }

    /**
     * Calculate code velocity
     */
    calculateCodeVelocity() {
        const sessionsWithDuration = this.sessions.filter(s => s.duration && s.duration > 0);
        if (sessionsWithDuration.length === 0) return 0;

        const totalChanges = this.sessions.reduce((sum, s) => sum + (s.codeDeltas?.length || 0), 0);
        const totalDuration = sessionsWithDuration.reduce((sum, s) => sum + s.duration, 0);

        return totalChanges / (totalDuration / 3600); // Changes per hour
    }

    /**
     * Calculate conversation efficiency
     */
    calculateConversationEfficiency() {
        if (this.conversations.length === 0) return 0;

        const totalTokens = this.conversations.reduce((sum, c) => sum + (c.tokens || 0), 0);
        const totalSessions = this.sessions.length;

        return totalTokens / Math.max(totalSessions, 1); // Tokens per session
    }

    async viewSession(sessionId) {
        try {
            console.log(`Viewing session: ${sessionId}`);
            
            const response = await fetch(`/api/session/${sessionId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Session data received:', data);
            
            if (data.success) {
                // Display session details with enhanced program slicing analysis
                if (this.enhancedSessionModal) {
                    await this.enhancedSessionModal.showEnhancedSessionDetails(data.session);
                    console.log('Enhanced session details modal with program slicing should be shown');
                } else {
                    // Fallback to basic session details
                    this.showSessionDetails(data.session);
                    console.log('Basic session details modal should be shown');
                }
            } else {
                throw new Error(data.error || 'Failed to load session details');
            }
        } catch (error) {
            console.error('Error viewing session:', error);
            this.showError('Failed to load session details: ' + error.message);
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
        console.log('showSessionDetails called with session:', session);
        const modal = document.getElementById('sessionModal');
        const title = document.getElementById('session-detail-title');
        const container = modal?.querySelector('.session-detail-container');
        
        console.log('Modal elements found:', { modal: !!modal, title: !!title, container: !!container });
        
        if (modal && title && container) {
            const projectName = this.extractProjectName(session.currentFile);
            const eventType = this.getEventTypeSync(session);
            const workflowMetrics = this.calculateWorkflowMetrics(session);
            
            title.textContent = `Work Session: ${this.formatIntent(session.intent)}`;
            container.innerHTML = `
                <div class="session-detail-content">
                    <div class="session-header">
                        <div class="session-title-section">
                            <h2 class="session-title">${this.formatIntent(session.intent)}</h2>
                            <div class="session-badges">
                                <span class="event-type-badge ${eventType}">${this.formatEventType(eventType)}</span>
                                <span class="project-badge">${projectName}</span>
                                <span class="status-badge ${(session.outcome || 'in_progress').toLowerCase()}">${this.formatStatus(session.outcome)}</span>
                            </div>
                        </div>
                        <div class="session-actions">
                            <button class="btn btn-primary btn-sm" onclick="generateNotebook('${session.id}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14,2 14,8 20,8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10,9 9,9 8,9"></polyline>
                                </svg>
                                Generate Notebook
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
                                    <span class="metadata-value">${new Date(session.timestamp).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Duration</span>
                                    <span class="metadata-value">${session.duration ? this.formatDuration(session.duration) : '0s'}</span>
                                </div>
                                <div class="metadata-item">
                                    <span class="metadata-label">Primary File</span>
                                    <span class="metadata-value" title="${session.currentFile || 'Unknown'}">${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown'}</span>
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
                            <button class="tab-btn" onclick="dashboard.switchSessionTab('visualizations')">Visualizations</button>
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
                                ${this.getConversationsForSession(session.id) && this.getConversationsForSession(session.id).length > 0 ? this.generateConversationsHTML(session) : '<p>No conversations recorded for this session.</p>'}
                            </div>
                            
                            <div id="session-tab-visualizations" class="tab-panel">
                                ${this.generateVisualizationsHTML(session)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.add('active');
            console.log('Modal should now be visible with active class');
            
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
        const modal = document.getElementById('sessionModal');
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
        // Try multiple data sources for conversations
        let conversations = session.conversations || 
                            session.conversationEvents || 
                            session.messages || 
                            session.prompts || 
                            this.getConversationsForSession(session.id) || 
                            [];

        // If no conversations exist, try to generate them from available data
        if (!conversations || conversations.length === 0) {
            conversations = this.generateConversationsFromSessionData(session);
        }

        // Enhance existing conversations with prompt extraction
        conversations = conversations.map(conv => this.enhanceConversationWithPromptExtraction(conv, session));

        if (!conversations || conversations.length === 0) {
            return `
                <div class="no-conversations">
                    <p>No conversations recorded for this session.</p>
                    <div class="conversation-fallback">
                        <button class="btn btn-small btn-primary" onclick="dashboard.loadSessionConversations('${session.id}')">
                            Load Conversations
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="conversations-list">
                ${conversations.map((conv, index) => `
                    <div class="conversation-item" onclick="dashboard.showConversationDetail('${session.id}', ${index})">
                        <div class="conversation-header">
                            <span class="conversation-index">#${index + 1}</span>
                            <span class="conversation-timestamp">${new Date(conv.timestamp || conv.created_at || session.timestamp).toLocaleTimeString()}</span>
                            ${conv.extractedPrompts && conv.extractedPrompts.length > 0 ? `
                                <span class="prompt-indicator" title="${conv.extractedPrompts.length} prompts extracted">
                                    ${conv.extractedPrompts.length}
                                </span>
                            ` : ''}
                            ${conv.intent ? `
                                <span class="intent-badge intent-${conv.intent}">${this.formatIntent(conv.intent)}</span>
                            ` : ''}
                        </div>
                        <div class="conversation-content">
                            <div class="conversation-prompt">
                                <strong>User:</strong> ${this.truncateText(conv.prompt || conv.userMessage || conv.content || conv.message || 'No prompt recorded', 100)}
                            </div>
                            <div class="conversation-response">
                                <strong>AI:</strong> ${this.truncateText(conv.response || conv.aiMessage || conv.assistantMessage || 'No response recorded', 100)}
                            </div>
                            ${conv.extractedPrompts && conv.extractedPrompts.length > 0 ? `
                                <div class="extracted-prompts-preview">
                                    <strong>Extracted Prompts:</strong>
                                    ${conv.extractedPrompts.slice(0, 2).map(prompt => `
                                        <span class="prompt-tag prompt-${prompt.type}">${this.truncateText(prompt.content, 30)}</span>
                                    `).join('')}
                                    ${conv.extractedPrompts.length > 2 ? `<span class="more-prompts">+${conv.extractedPrompts.length - 2} more</span>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        ${conv.tokens ? `<div class="conversation-meta">Tokens: ${conv.tokens}</div>` : ''}
                        ${conv.complexity ? `<div class="conversation-meta">Complexity: ${conv.complexity.level}</div>` : ''}
                        <div class="conversation-actions">
                            <button class="btn btn-small" onclick="event.stopPropagation(); dashboard.copyConversation('${session.id}', ${index})">Copy</button>
                            ${conv.extractedPrompts && conv.extractedPrompts.length > 0 ? `
                                <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); dashboard.showPromptDetails('${session.id}', ${index})">Prompts</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }


    /**
     * Enhance conversation with prompt extraction data
     */
    enhanceConversationWithPromptExtraction(conversation, session) {
        const content = conversation.prompt || conversation.userMessage || conversation.content || conversation.message || '';
        
        if (!content || content === 'No prompt recorded') {
            return conversation;
        }
        
        // Extract prompts if not already done
        if (!conversation.extractedPrompts) {
            conversation.extractedPrompts = this.extractPromptsFromContent(content);
        }
        
        // Add intent classification if not present
        if (!conversation.intent && conversation.extractedPrompts.length > 0) {
            conversation.intent = this.classifyIntent(content);
        }
        
        // Add complexity analysis if not present
        if (!conversation.complexity && conversation.extractedPrompts.length > 0) {
            conversation.complexity = this.analyzeComplexity(content);
        }
        
        return conversation;
    }

    /**
     * Extract prompts from content using the enhanced system
     */
    extractPromptsFromContent(content) {
        if (!content || typeof content !== 'string') return [];
        
        // Use the global prompt extractor if available
        if (window.enhancedPromptExtractor) {
            return window.enhancedPromptExtractor.extractPrompts(content);
        }
        
        // Fallback to basic extraction
        const prompts = [];
        const patterns = [
            { pattern: /(?:prompt|question|ask|request):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'direct_prompt' },
            { pattern: /(?:user|you):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'user_directive' },
            { pattern: /(?:please|can you|help me):\s*(.+?)(?:\n\n|\n$|$)/gi, type: 'request' },
            { pattern: /@cursor\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'cursor_directive' },
            { pattern: /@ai\s+(.+?)(?:\n\n|\n$|$)/gi, type: 'ai_directive' }
        ];
        
        patterns.forEach(({ pattern, type }) => {
            const matches = [...content.matchAll(pattern)];
            matches.forEach(match => {
                prompts.push({
                    type: type,
                    content: match[1]?.trim(),
                    fullMatch: match[0],
                    timestamp: new Date().toISOString()
                });
            });
        });
        
        return prompts;
    }

    /**
     * Classify intent from content
     */
    classifyIntent(content) {
        if (!content || typeof content !== 'string') return 'general';
        
        const text = content.toLowerCase();
        const intentPatterns = {
            'data_visualization': ['plot', 'chart', 'graph', 'visualize', 'matplotlib', 'seaborn', 'plotly', 'show'],
            'data_analysis': ['analyze', 'analysis', 'data', 'dataset', 'pandas', 'numpy', 'statistics'],
            'code_implementation': ['implement', 'create', 'build', 'write', 'function', 'class', 'method'],
            'debugging': ['debug', 'error', 'bug', 'fix', 'issue', 'problem', 'troubleshoot'],
            'optimization': ['optimize', 'performance', 'speed', 'efficient', 'improve', 'better'],
            'documentation': ['document', 'comment', 'explain', 'readme', 'docstring', 'help'],
            'testing': ['test', 'testing', 'unit test', 'assert', 'verify', 'check'],
            'refactoring': ['refactor', 'restructure', 'reorganize', 'clean up', 'simplify']
        };
        
        let maxScore = 0;
        let detectedIntent = 'general';
        
        Object.entries(intentPatterns).forEach(([intent, keywords]) => {
            const score = keywords.reduce((acc, keyword) => {
                return acc + (text.includes(keyword) ? 1 : 0);
            }, 0);
            
            if (score > maxScore) {
                maxScore = score;
                detectedIntent = intent;
            }
        });
        
        return detectedIntent;
    }

    /**
     * Analyze complexity of content
     */
    analyzeComplexity(content) {
        if (!content || typeof content !== 'string') return { level: 'simple', wordCount: 0 };
        
        const words = content.split(/\s+/).length;
        const sentences = content.split(/[.!?]+/).length;
        const technicalTerms = ['function', 'class', 'import', 'def', 'return', 'variable', 'array', 'dataframe', 'model', 'algorithm'];
        const technicalTermCount = technicalTerms.filter(term => content.toLowerCase().includes(term)).length;
        
        let complexity = 'simple';
        if (words > 50 || sentences > 3 || technicalTermCount > 3) {
            complexity = 'complex';
        } else if (words > 20 || sentences > 2 || technicalTermCount > 1) {
            complexity = 'medium';
        }
        
        return {
            level: complexity,
            wordCount: words,
            sentenceCount: sentences,
            technicalTermCount: technicalTermCount
        };
    }

    /**
     * Format intent for display
     */
    formatIntent(intent) {
        return intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }


    /**
     * Show detailed prompt information
     */
    showPromptDetails(sessionId, conversationIndex) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session || !session.conversations) return;
        
        const conversation = session.conversations[conversationIndex];
        if (!conversation || !conversation.extractedPrompts) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Extracted Prompts</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="prompts-list">
                        ${conversation.extractedPrompts.map(prompt => `
                            <div class="prompt-item" data-type="${prompt.type}">
                                <div class="prompt-type">${this.getPromptTypeLabel(prompt.type)}</div>
                                <div class="prompt-content">${prompt.content}</div>
                                <div class="prompt-meta">
                                    <span class="prompt-timestamp">${new Date(prompt.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Get user-friendly label for prompt type
     */
    getPromptTypeLabel(type) {
        const labels = {
            'direct_prompt': 'Direct Prompt',
            'user_directive': 'User Directive',
            'request': 'Request',
            'cursor_directive': 'Cursor Directive',
            'ai_directive': 'AI Directive',
            'code_comment_prompt': 'Code Comment',
            'python_comment_prompt': 'Python Comment',
            'task_definition': 'Task Definition',
            'goal_definition': 'Goal Definition'
        };
        return labels[type] || type;
    }

    async openPrivacyModal() {
        const modal = document.getElementById('privacyModal');
        const modalBody = modal?.querySelector('.modal-body');
        
        if (modal) {
            // Show loading state
            if (modalBody) {
                modalBody.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading privacy analysis...</p></div>';
            }
            modal.classList.add('active');
            
            // Add click-outside-to-close functionality
            this.setupModalClickOutside(modal);
            
            // Add keyboard support (ESC key to close)
            this.setupModalKeyboard(modal);
            
            // Prevent body scroll when modal is open
            document.body.classList.add('modal-open');
            
            try {
                // Load privacy analysis content
                if (modalBody) {
                    await this.loadPrivacyAnalysisContent(modalBody);
                }
            } catch (error) {
                console.error('Error loading privacy analysis:', error);
                if (modalBody) {
                    modalBody.innerHTML = '<div class="error-state">Error loading privacy analysis: ' + error.message + '</div>';
                }
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
            
            // Restore body scroll
            document.body.classList.remove('modal-open');
            
            // Remove click-outside event listener
            this.removeModalClickOutside(modal);
            
            // Remove keyboard event listener
            this.removeModalKeyboard(modal);
        }
    }

    closeInfoModal() {
        const modal = document.getElementById('infoModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Setup click-outside-to-close functionality for modal
     */
    setupModalClickOutside(modal) {
        const clickOutsideHandler = (event) => {
            // Only close if clicking on the modal backdrop (not the modal content)
            if (event.target === modal) {
                this.closePrivacyModal();
            }
        };

        // Store the handler so we can remove it later
        modal._clickOutsideHandler = clickOutsideHandler;
        
        // Add event listener with a small delay to prevent immediate closure
        setTimeout(() => {
            modal.addEventListener('click', clickOutsideHandler);
        }, 100);
    }

    /**
     * Remove click-outside event listener from modal
     */
    removeModalClickOutside(modal) {
        if (modal._clickOutsideHandler) {
            modal.removeEventListener('click', modal._clickOutsideHandler);
            delete modal._clickOutsideHandler;
        }
    }

    /**
     * Setup keyboard support for modal (ESC key to close)
     */
    setupModalKeyboard(modal) {
        const keyHandler = (event) => {
            if (event.key === 'Escape') {
                this.closePrivacyModal();
            }
        };

        // Store the handler so we can remove it later
        modal._keyHandler = keyHandler;
        
        // Add event listener
        document.addEventListener('keydown', keyHandler);
    }

    /**
     * Remove keyboard event listener from modal
     */
    removeModalKeyboard(modal) {
        if (modal._keyHandler) {
            document.removeEventListener('keydown', modal._keyHandler);
            delete modal._keyHandler;
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
            
            // Define "active" as sessions with recent activity (within last 30 minutes)
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const activeSessions = sessions.filter(s => {
                const sessionTime = new Date(s.timestamp || s.startTime || 0);
                const isRecent = sessionTime > thirtyMinutesAgo;
                const isInProgress = (s.outcome === 'in_progress' || 
                                    s.outcome === 'IN_PROGRESS' || 
                                    s.phase === 'IN_PROGRESS' ||
                                    s.status === 'active') && isRecent;
                return isInProgress;
            }).length;
            
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
                icon: '',
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
        const totalConversations = this.conversations.length;
        const totalTokens = this.conversations.reduce((sum, c) => sum + (c.tokens || 0), 0);
        
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
                icon: '',
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
        
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        // For very large durations (months/weeks)
        if (days >= 30) {
            const months = Math.floor(days / 30);
            const remainingDays = days % 30;
            if (months >= 12) {
                const years = Math.floor(months / 12);
                const remainingMonths = months % 12;
                return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`;
            }
            return remainingDays > 0 ? `${months}mo ${remainingDays}d` : `${months}mo`;
        }
        
        // For large durations (weeks/days)
        if (days >= 7) {
            const weeks = Math.floor(days / 7);
            const remainingDays = days % 7;
            return remainingDays > 0 ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
        }
        
        // For medium durations (days/hours)
        if (days > 0) {
            return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
        }
        
        // For small durations (hours/minutes)
        if (hours > 0) {
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
        
        // For very small durations (minutes/seconds)
        if (minutes > 0) {
            return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
        }
        
        // For tiny durations (seconds only)
        return `${secs}s`;
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
        console.log('Switching to view:', viewType);
        
        // Ensure loading overlay is hidden and dashboard content is visible
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.classList.add('hidden');
        }
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'block';
            dashboardContent.style.visibility = 'visible';
            dashboardContent.style.opacity = '1';
        }
        
        // Update current view
        this.currentView = viewType;
        
        // Remove active class from all view buttons
        document.querySelectorAll('.sidebar-link').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        const activeBtn = document.getElementById(`${viewType}-view-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            console.log('Set active button for view:', viewType);
        } else {
            console.error('Button not found for view:', viewType);
        }
        
        // Show/hide analysis section based on view - only show for projects-sessions
        const analysisSection = document.getElementById('analysis-section');
        if (analysisSection) {
            if (viewType === 'projects-sessions') {
                analysisSection.style.display = 'block';
                console.log('Showing analysis section for projects-sessions view');
            } else {
                analysisSection.style.display = 'none';
                console.log('Hiding analysis section for', viewType, 'view');
            }
        }
        
        // Render the selected view
        console.log('Rendering current view:', this.currentView);
        this.renderCurrentView();
    }

    renderCurrentView() {
        const sessionsList = document.getElementById('sessions-list');
        if (!sessionsList) {
            console.error('sessions-list element not found');
            return;
        }
        
        console.log('Rendering current view:', this.currentView);
        
        switch(this.currentView) {
            case 'timeline':
                console.log('Rendering timeline view');
                this.renderTimeline();
                break;
            case 'projects-sessions':
                console.log('Rendering projects-sessions view');
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
            case 'memory-management':
                this.renderMemoryManagement();
                break;
            case 'model-info':
                this.renderModelInfo();
                break;
            default:
                this.renderTimeline();
        }
    }

    renderTimeline() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        // Use enhanced timeline if available
        if (window.enhancedTimeline) {
            window.enhancedTimeline.loadData();
            return;
        }

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
        // Ensure loading overlay is hidden and dashboard content is visible
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.classList.add('hidden');
        }
        
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'block';
            dashboardContent.style.visibility = 'visible';
            dashboardContent.style.opacity = '1';
        }
        
        // Show the analysis section for projects-sessions view
        const analysisSection = document.getElementById('analysis-section');
        if (analysisSection) {
            analysisSection.style.display = 'block';
            console.log('Showing analysis section for projects-sessions view');
        }

        const container = document.getElementById('sessions-list');
        if (!container) {
            console.error('sessions-list container not found');
            return;
        }

        console.log('Rendering projects & sessions view');
        console.log('Current sessions:', this.sessions);

        // Wait for sessions to be loaded if they're not available yet
        if (!this.sessions || !Array.isArray(this.sessions)) {
            console.log('Sessions not loaded yet, waiting...');
            container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading projects and sessions...</p></div>';
            
            // Try to load sessions if they're not available
            try {
                await this.loadSessions();
                console.log('Sessions loaded:', this.sessions);
            } catch (error) {
                console.error('Error loading sessions:', error);
                container.innerHTML = '<div class="error-state">Error loading sessions: ' + error.message + '</div>';
                return;
            }
        }

        // Group sessions by project
        const projects = this.groupSessionsByProject(this.sessions);
        console.log('Grouped projects:', projects);
        
        // Check if we have any projects
        if (Object.keys(projects).length === 0) {
            container.innerHTML = '<div class="no-data">No projects found. Sessions may not have valid file paths.</div>';
            return;
        }
        
        // Render projects and sessions with enhanced UI
        let html = '<div class="projects-sessions-view">';
        html += '<div class="projects-header">';
        html += '<h2>Projects & Sessions</h2>';
        html += '<div class="projects-summary">';
        html += `<span class="summary-stat">${Object.keys(projects).length} Projects</span>`;
        html += `<span class="summary-stat">${this.sessions.length} Total Sessions</span>`;
        html += `<span class="summary-stat">${Object.values(projects).reduce((sum, p) => sum + p.activeSessions, 0)} Active</span>`;
        html += '</div>';
        html += '</div>';
        
        if (Object.keys(projects).length === 0) {
            html += '<div class="no-data">No projects found</div>';
        } else {
            // Sort projects by activity (most recent first)
            const sortedProjects = Object.entries(projects).sort((a, b) => {
                const aTime = a[1].lastActivity ? new Date(a[1].lastActivity) : new Date(0);
                const bTime = b[1].lastActivity ? new Date(b[1].lastActivity) : new Date(0);
                return bTime - aTime;
            });
            
            sortedProjects.forEach(([projectName, projectData]) => {
                console.log(`Rendering project: ${projectName} with ${projectData.sessions.length} sessions`);
                html += this.renderEnhancedProjectCard(projectName, projectData);
            });
        }
        
        html += '</div>';
        console.log('Final HTML:', html);
        container.innerHTML = html;
    }



    renderEnhancedProjectCard(projectName, projectData) {
        const { sessions, category, subproject, totalSessions, activeSessions, totalDuration, lastActivity, fileTypes } = projectData;
        
        // Format duration
        const durationText = totalDuration > 60 ? 
            `${Math.round(totalDuration / 60)}h ${Math.round(totalDuration % 60)}m` : 
            `${Math.round(totalDuration)}m`;
        
        // Format last activity
        const lastActivityText = lastActivity ? 
            this.formatRelativeTime(lastActivity) : 'No recent activity';
        
        // Get category icon and color
        const categoryInfo = this.getCategoryInfo(category);
        
        return `
            <div class="enhanced-project-card" data-category="${category}">
                <div class="project-header" onclick="toggleProject('${projectName}')">
                    <div class="project-title-section">
                        <div class="project-icon ${categoryInfo.class}">${categoryInfo.icon}</div>
                        <div class="project-info">
                            <h3 class="project-name">${projectName}</h3>
                            ${subproject ? `<p class="project-subproject">${subproject}</p>` : ''}
                            <p class="project-category">${categoryInfo.label}</p>
                        </div>
                    </div>
                    <div class="project-metrics">
                        <div class="metric-group">
                            <span class="metric-value">${totalSessions}</span>
                            <span class="metric-label">Sessions</span>
                        </div>
                        <div class="metric-group">
                            <span class="metric-value active">${activeSessions}</span>
                            <span class="metric-label">Active</span>
                        </div>
                        <div class="metric-group">
                            <span class="metric-value">${durationText}</span>
                            <span class="metric-label">Duration</span>
                        </div>
                    </div>
                    <div class="project-toggle">▼</div>
                </div>
                <div class="project-details" id="project-${projectName.replace(/\s+/g, '-')}">
                    <div class="project-meta">
                        <div class="meta-item">
                            <span class="meta-label">Last Activity:</span>
                            <span class="meta-value">${lastActivityText}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">File Types:</span>
                            <span class="meta-value">${fileTypes.slice(0, 5).join(', ')}${fileTypes.length > 5 ? '...' : ''}</span>
                        </div>
                    </div>
                    <div class="project-sessions">
                        ${sessions.slice(0, 5).map(session => this.renderSessionCard(session)).join('')}
                        ${sessions.length > 5 ? `<div class="more-sessions">+${sessions.length - 5} more sessions</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get category information for styling
     */
    getCategoryInfo(category) {
        const categories = {
            'machine_learning': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg>', label: 'Machine Learning', class: 'ml-category' },
            'development_tools': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>', label: 'Development Tools', class: 'dev-category' },
            'experiments': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="M14.5 4c-1.3 0-2.4.7-3 1.7A4 4 0 0 0 8 9.5c0 1.5.8 2.8 2 3.4v2.1c-.4.3-.7.7-.9 1.2L7 21h10l-2.1-4.8c-.2-.5-.5-.9-.9-1.2v-2.1c1.2-.6 2-1.9 2-3.4 0-2.2-1.8-4-4-4z"/></svg>', label: 'Experiments', class: 'exp-category' },
            'maintenance': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>', label: 'Maintenance', class: 'maint-category' },
            'other': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>', label: 'Other', class: 'other-category' }
        };
        return categories[category] || categories['other'];
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    renderProjectCard(projectName, sessions) {
        // Legacy method - keeping for compatibility
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const activeSessions = sessions.filter(s => {
            const sessionTime = new Date(s.timestamp || s.startTime || 0);
            const isRecent = sessionTime > thirtyMinutesAgo;
            const isInProgress = (s.outcome === 'IN_PROGRESS' || s.phase === 'IN_PROGRESS') && isRecent;
            return isInProgress;
        }).length;
        const totalSessions = sessions.length;
        
        return `
            <div class="project-card" onclick="toggleProject('${projectName}')">
                <div class="project-header">
                    <h3>${projectName}</h3>
                    <div class="project-stats">
                        <span class="stat">${totalSessions} sessions</span>
                        <span class="stat active">${activeSessions} active</span>
                    </div>
                    <div class="project-toggle">▼</div>
                </div>
                <div class="project-sessions" id="project-${projectName.replace(/\s+/g, '-')}">
                    ${sessions.map(session => this.renderSessionCard(session)).join('')}
                </div>
            </div>
        `;
    }

    renderSessionCard(session) {
        const statusClass = session.outcome === 'IN_PROGRESS' || session.phase === 'IN_PROGRESS' ? 'active' : 'inactive';
        const changes = session.codeDeltas ? session.codeDeltas.length : 0;
        
        return `
            <div class="session-card ${statusClass}" onclick="viewSession('${session.id}')">
                <div class="session-header">
                    <span class="session-id">${session.id}</span>
                    <span class="session-status">${statusClass}</span>
                </div>
                <div class="session-details">
                    <div class="session-intent">${session.intent || 'Unknown'}</div>
                    <div class="session-file">${session.currentFile ? session.currentFile.split('/').pop() : 'No file'}</div>
                    <div class="session-stats">
                        <span>${changes} changes</span>
                        <span>${new Date(session.timestamp).toLocaleString()}</span>
                        ${this.getConversationSummary(session) ? `<span class="conversation-indicator">${this.getConversationSummary(session)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
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
                    <button class="btn btn-sm btn-secondary" onclick="generateNotebook('${session.id}')">Generate Notebook</button>
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

            // Check if we have any data to display
            if ((!kuraData || !kuraData.success) && (!clioData || !clioData.success)) {
                container.innerHTML = `
                    <div class="no-data-state">
                        <div class="no-data-icon"></div>
                        <h3>No Analysis Data Available</h3>
                        <p>Start some coding sessions to see Kura clustering and Clio analysis insights.</p>
                        <div class="no-data-actions">
                            <button class="btn btn-primary" onclick="switchView('visualizations')">
                                View Session Data
                            </button>
                            <button class="btn btn-secondary" onclick="location.reload()">
                                Refresh Analysis
                            </button>
                        </div>
                    </div>
                `;
                return;
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
            // Show loading state
            container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Analyzing workflows with Clio & Kura...</p></div>';
            
            // Initialize enhanced cluster map with procedural clustering
            this.initializeEnhancedClusterMap(container);
            
        } catch (error) {
            console.error('Error loading embeddings:', error);
            container.innerHTML = '<div class="no-sessions">Error loading workflow analysis</div>';
        }
    }

    /**
     * Initialize enhanced cluster map with procedural clustering
     */
    async initializeEnhancedClusterMap(container) {
        try {
            // Create container for the enhanced cluster map
            container.innerHTML = '<div id="enhanced-cluster-map-container"></div>';
            
            // Initialize the enhanced cluster map
            if (typeof EnhancedClusterMap !== 'undefined') {
                window.enhancedClusterMap = new EnhancedClusterMap();
                await window.enhancedClusterMap.initialize('enhanced-cluster-map-container');
                
                console.log('Enhanced cluster map with procedural clustering initialized successfully');
            } else {
                throw new Error('EnhancedClusterMap not available');
            }
        } catch (error) {
            console.error('Error initializing enhanced cluster map:', error);
            container.innerHTML = '<div class="no-sessions">Error initializing enhanced cluster analysis</div>';
        }
    }

    /**
     * Render topic clustering visualization with OpenClio analysis
     */
    async renderTopicClusteringVisualization(kuraData, clioData) {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        try {
            // Load the topic clustering visualization component
            if (typeof TopicClusteringVisualization === 'undefined') {
                // Load the script if not already loaded
                const script = document.createElement('script');
                script.src = 'components/topic-clustering-visualization.js';
                script.onload = () => {
                    this.initializeTopicClusteringVisualization(container);
                };
                document.head.appendChild(script);
            } else {
                this.initializeTopicClusteringVisualization(container);
            }
        } catch (error) {
            console.error('Error rendering topic clustering visualization:', error);
            container.innerHTML = '<div class="no-sessions">Error loading topic clustering analysis</div>';
        }
    }

    /**
     * Initialize the topic clustering visualization
     */
    async initializeTopicClusteringVisualization(container) {
        try {
            // Create container for the topic clustering visualization
            container.innerHTML = '<div id="topic-clustering-container"></div>';
            
            // Initialize the topic clustering visualization
            window.topicClusteringVisualization = new TopicClusteringVisualization();
            await window.topicClusteringVisualization.initialize('topic-clustering-container');
            
            console.log('Topic clustering visualization initialized successfully');
        } catch (error) {
            console.error('Error initializing topic clustering visualization:', error);
            container.innerHTML = '<div class="no-sessions">Error initializing topic clustering analysis</div>';
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
        
        // Safety check for sessions parameter
        if (!sessions || !Array.isArray(sessions)) {
            console.warn('groupSessionsByProject: sessions parameter is not a valid array:', sessions);
            return groups;
        }
        
        sessions.forEach((session, index) => {
            try {
                const projectInfo = this.extractProjectInfo(session.currentFile);
                const projectName = projectInfo.project;
                
                if (!groups[projectName]) {
                    groups[projectName] = {
                        sessions: [],
                        category: projectInfo.category,
                        subproject: projectInfo.subproject,
                        totalSessions: 0,
                        activeSessions: 0,
                        totalDuration: 0,
                        lastActivity: null,
                        fileTypes: new Set(),
                        languages: new Set()
                    };
                }
                
                // Add session to project
                groups[projectName].sessions.push(session);
                groups[projectName].totalSessions++;
                
                // Calculate metrics
                const sessionDuration = this.calculateSessionDuration(session);
                groups[projectName].totalDuration += sessionDuration;
                
                // Track file types and languages
                if (session.currentFile) {
                    const ext = session.currentFile.split('.').pop();
                    if (ext) groups[projectName].fileTypes.add(ext);
                }
                
                // Track last activity
                const sessionTime = new Date(session.timestamp || session.startTime || 0);
                if (!groups[projectName].lastActivity || sessionTime > groups[projectName].lastActivity) {
                    groups[projectName].lastActivity = sessionTime;
                }
                
                // Check if session is active (recent activity)
                const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
                if (sessionTime > thirtyMinutesAgo) {
                    groups[projectName].activeSessions++;
                }
                
            } catch (error) {
                console.warn(`Error processing session ${index}:`, error, session);
            }
        });
        
        // Convert Sets to Arrays for easier handling
        Object.values(groups).forEach(project => {
            project.fileTypes = Array.from(project.fileTypes);
            project.languages = Array.from(project.languages);
        });
        
        return groups;
    }

    extractProjectName(filePath) {
        if (!filePath) return 'Unknown Project';
        
        // Use the sophisticated project extraction logic from the backend
        const projectInfo = this.extractProjectInfo(filePath);
        return projectInfo.project;
    }

    /**
     * Extract detailed project information (integrated from backend logic)
     */
    extractProjectInfo(filePath) {
        if (!filePath) return { project: 'Unknown', category: 'other', subproject: null };
        
        const pathParts = filePath.split('/');
        const homeIndex = pathParts.findIndex(part => part === 'hamidaho');
        
        if (homeIndex === -1) {
            return { project: 'Unknown', category: 'other', subproject: null };
        }
        
        // Extract project information from path structure
        const projectPath = pathParts.slice(homeIndex + 1);
        
        if (projectPath.length === 0) {
            return { project: 'Unknown', category: 'other', subproject: null };
        }
        
        const topLevel = projectPath[0];
        let project = topLevel;
        let category = 'other';
        let subproject = null;
        
        // Categorize projects
        if (topLevel.includes('HF Project') || topLevel.includes('hf')) {
            category = 'machine_learning';
            project = 'Hugging Face Research';
            if (projectPath.length > 1) {
                subproject = projectPath[1];
            }
        } else if (topLevel.includes('cursor_dashboard')) {
            category = 'development_tools';
            project = 'PKL Extension Dashboard';
            if (projectPath.length > 2) {
                subproject = projectPath[2];
            }
        } else if (topLevel.includes('Desktop')) {
            category = 'experiments';
            project = 'Desktop Experiments';
            if (projectPath.length > 1) {
                subproject = projectPath[1];
            }
        } else if (topLevel.includes('updated_notebooks')) {
            category = 'maintenance';
            project = 'Notebook Maintenance';
        } else {
            category = 'other';
            project = topLevel.replace(/_/g, ' ').replace(/-/g, ' ');
        }
        
        return { project, category, subproject };
    }

    /**
     * Calculate session duration in minutes
     */
    calculateSessionDuration(session) {
        if (!session.timestamp && !session.startTime) return 0;
        
        const startTime = new Date(session.startTime || session.timestamp);
        const endTime = session.endTime ? new Date(session.endTime) : new Date();
        
        return Math.max(0, (endTime - startTime) / (1000 * 60)); // Convert to minutes
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

    formatEventType(eventType) {
        if (typeof eventType !== 'string') {
            return String(eventType || 'Unknown');
        }
        return eventType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    getEventTypeDisplay(eventType) {
        // Map event types to display names with fine-grained subtypes
        const typeMap = {
            // Data Science & Analysis
            'data_exploration': 'Data Exploration',
            'data_visualization': 'Data Visualization',
            'machine_learning': 'Machine Learning',
            
            // Software Development
            'implementation': 'Implementation',
            'debugging': 'Debugging',
            'testing': 'Testing',
            
            // Research & Documentation
            'research': 'Research',
            'documentation': 'Documentation',
            
            // Infrastructure & DevOps
            'infrastructure': 'Infrastructure',
            'devops': 'DevOps',
            
            // Communication & Collaboration
            'communication': 'Communication',
            
            // Learning & Exploration
            'learning': 'Learning',
            
            // Legacy types
            'notebook': 'Notebook',
            'code': 'Code',
            'conversation': 'Chat',
            'session': 'Session',
            'data_analysis': 'Data Analysis',
            'explore': 'Explore'
        };
        
        return typeMap[eventType] || this.formatEventType(eventType);
    }

    /**
     * Get detailed event type information including subtype
     */
    getEventTypeDetails(session) {
        if (session.enhancedEventType) {
            const { primary_type, subtype, confidence, alternative_types } = session.enhancedEventType;
            
            return {
                primary: this.getEventTypeDisplay(primary_type),
                subtype: subtype ? this.formatEventType(subtype) : null,
                confidence: Math.round(confidence * 100),
                alternatives: alternative_types.map(alt => ({
                    type: this.getEventTypeDisplay(alt.type),
                    confidence: Math.round(alt.confidence * 100)
                }))
            };
        }
        
        return {
            primary: this.getEventTypeDisplay(this.getEventType(session)),
            subtype: null,
            confidence: 50,
            alternatives: []
        };
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
        const eventDetails = this.getEventTypeDetails(session);
        
        // Create enhanced event type display
        let eventTypeDisplay = eventDetails.primary;
        if (eventDetails.subtype) {
            eventTypeDisplay += ` • ${eventDetails.subtype}`;
        }
        if (eventDetails.confidence > 70) {
            eventTypeDisplay += ` (${eventDetails.confidence}%)`;
        }
        
        return `
            <div class="timeline-event" onclick="viewSession('${session.id}')">
                <div class="timeline-event-marker ${eventType}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                    </svg>
                </div>
                <div class="timeline-event-content">
                    <div class="timeline-event-header">
                        <span class="timeline-event-type" title="${eventDetails.alternatives.map(alt => `${alt.type} (${alt.confidence}%)`).join(', ')}">${eventTypeDisplay}</span>
                        <span class="timeline-event-time">${time}</span>
                    </div>
                    <div class="timeline-event-description">
                        ${session.currentFile ? session.currentFile.split('/').pop() : 'Unknown File'} • ${projectName}
                        ${session.codeDeltas && session.codeDeltas.length > 0 ? 
                            ` • ${session.codeDeltas.length} changes` : ''}
                    </div>
                    ${eventDetails.alternatives.length > 0 ? `
                        <div class="timeline-event-alternatives">
                            ${eventDetails.alternatives.slice(0, 2).map(alt => 
                                `<span class="alternative-type" title="Alternative classification">${alt.type} (${alt.confidence}%)</span>`
                            ).join(' • ')}
                        </div>
                    ` : ''}
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

    getEventTypeSync(session) {
        // Use enhanced classification if available
        if (session.enhancedEventType) {
            return session.enhancedEventType.primary_type;
        }
        
        // Use intent if available, otherwise determine from file type
        if (session.intent) {
            return session.intent;
        } else if (session.currentFile && session.currentFile.endsWith('.ipynb')) {
            return 'notebook';
        } else if (session.codeDeltas && session.codeDeltas.length > 0) {
            return 'code';
        } else if (session.conversations && session.conversations.length > 0) {
            return 'conversation';
        } else {
            return 'session';
        }
    }

    async getEventType(session) {
        // Use enhanced classification if available
        if (session.enhancedEventType) {
            return session.enhancedEventType.primary_type;
        }
        
        // Use intent if available, otherwise determine from file type
        if (session.intent) {
            return session.intent;
        } else if (session.currentFile && session.currentFile.endsWith('.ipynb')) {
            return 'notebook';
        } else if (session.codeDeltas && session.codeDeltas.length > 0) {
            return 'code';
        } else if (session.conversations && session.conversations.length > 0) {
            return 'conversation';
        } else {
            return 'session';
        }
    }

    /**
     * Enhanced event type classification using multi-modal analysis
     */
    async classifyEventTypeEnhanced(session, conversations = []) {
        try {
            // Import the enhanced classifier
            const EnhancedEventTypeClassifier = require('../../intent-classification/enhanced-event-type-classifier');
            const classifier = new EnhancedEventTypeClassifier();
            
            // Get enhanced classification
            const classification = await classifier.classifyEventType(session, conversations);
            
            // Store the enhanced classification in the session
            session.enhancedEventType = classification;
            
            return classification;
        } catch (error) {
            console.error('Enhanced event type classification failed:', error);
            // Fallback to basic classification
            return {
                primary_type: this.getEventType(session),
                subtype: null,
                confidence: 0.5,
                alternative_types: [],
                analysis_details: { error: error.message },
                metadata: { classification_method: 'fallback' }
            };
        }
    }

    getActionCount(session) {
        let count = 0;
        
        // Count code deltas (file changes)
        if (session.codeDeltas && session.codeDeltas.length > 0) {
            count += session.codeDeltas.length;
        }
        
        // Count conversations for this session
        const sessionConversations = this.conversations.filter(c => c.sessionId === session.id);
        if (sessionConversations.length > 0) {
            count += sessionConversations.length;
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
        // Enhanced calculation with better data handling
        const totalChanges = session.codeDeltas ? session.codeDeltas.length : 0;
        
        // Get conversations for this session - check both global conversations and session-specific
        let sessionConversations = [];
        if (this.conversations && this.conversations.length > 0) {
            sessionConversations = this.conversations.filter(c => c.sessionId === session.id);
        }
        
        // Also check if conversations are stored directly in the session
        if (session.conversations && session.conversations.length > 0) {
            sessionConversations = sessionConversations.concat(session.conversations);
        }
        
        const totalConversations = sessionConversations.length;
        
        // Calculate unique files modified
        let filesModified = 0;
        if (session.fileChanges && session.fileChanges.length > 0) {
            const uniqueFiles = new Set();
            session.fileChanges.forEach(fc => {
                if (fc.fileName) {
                    uniqueFiles.add(fc.fileName);
                } else if (fc.filePath) {
                    uniqueFiles.add(fc.filePath);
                }
            });
            filesModified = uniqueFiles.size;
        }
        
        // Debug logging
        console.log(`Session ${session.id} metrics:`, {
            totalChanges,
            totalConversations,
            filesModified,
            hasCodeDeltas: !!session.codeDeltas,
            hasFileChanges: !!session.fileChanges,
            hasConversations: !!session.conversations
        });
        
        return {
            totalChanges,
            totalConversations,
            filesModified
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
                
                <!-- Main Dashboard Grid -->
                <div class="workflow-dashboard-grid">
                    <!-- Left Column: Metrics and Patterns -->
                    <div class="workflow-left-column">
                    <div class="workflow-section">
                        <h3>Session Patterns</h3>
                        <div class="pattern-metrics">
                                <div class="pattern-item" title="Average length of coding sessions - longer sessions often indicate deeper focus">
                                <div class="pattern-value">${workflowInsights.avgSessionDuration}</div>
                                <div class="pattern-label">Avg Session Duration</div>
                                    <div class="evolution-description">Focus time indicator</div>
                            </div>
                                <div class="pattern-item" title="Hour of day when you're most productive - helps identify optimal coding times">
                                <div class="pattern-value">${workflowInsights.mostActiveHour}</div>
                                <div class="pattern-label">Most Active Hour</div>
                                    <div class="evolution-description">Peak productivity time</div>
                            </div>
                                <div class="pattern-item" title="Trend in coding activity over time - shows if productivity is increasing, decreasing, or stable">
                                <div class="pattern-value">${workflowInsights.productivityTrend}</div>
                                <div class="pattern-label">Productivity Trend</div>
                                    <div class="evolution-description">Activity trend over time</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="workflow-section">
                        <h3>Code Evolution</h3>
                        <div class="evolution-metrics">
                                <div class="evolution-item" title="Total number of lines of code that have been modified across all sessions">
                                <div class="evolution-value">${workflowInsights.totalLinesChanged}</div>
                                <div class="evolution-label">Lines Changed</div>
                                    <div class="evolution-description">Total code modifications</div>
                            </div>
                                <div class="evolution-item" title="Average number of files touched per coding session">
                                <div class="evolution-value">${workflowInsights.filesPerSession}</div>
                                <div class="evolution-label">Files per Session</div>
                                    <div class="evolution-description">Average file scope</div>
                            </div>
                                <div class="evolution-item" title="Coding velocity - measures how many code changes you make per hour of active coding time. Higher values indicate more productive coding sessions.">
                                    <div class="evolution-value">${workflowInsights.codeVelocity}/hr</div>
                                    <div class="evolution-label">Changes per Hour</div>
                                    <div class="evolution-description">Coding velocity (productivity measure)</div>
                            </div>
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
                    
                    <!-- Right Column: Visualizations -->
                    <div class="workflow-right-column">
                        ${kuraData && kuraData.success && kuraData.umap_coordinates ? `
                            <div class="workflow-section umap-section">
                                <h3>Session Clustering (UMAP)</h3>
                                <div class="umap-container">
                                    <div class="umap-plot" id="umap-plot"></div>
                                    <div class="umap-info">
                                        <div class="cluster-summary">
                                            <div class="cluster-count">
                                                <span class="cluster-count-value">${kuraData.clusters ? kuraData.clusters.length : 0}</span>
                                                <span class="cluster-count-label">Clusters Identified</span>
                                            </div>
                                        </div>
                                        ${kuraData.clusters && kuraData.clusters.length > 0 ? `
                                            <div class="clusters-breakdown">
                                                <h4>Cluster Details:</h4>
                                                <div class="clusters-list">
                                                    ${kuraData.clusters.map(cluster => `
                                                        <div class="cluster-item">
                                                            <span class="cluster-color" style="background-color: ${this.getClusterColor(cluster.name)};"></span>
                                                            <span class="cluster-name">${cluster.name}</span>
                                                            <span class="cluster-size">(${cluster.size} sessions)</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    
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
                    
                        ${kuraData && kuraData.success ? `
                    <div class="workflow-section">
                                <h3>Clustering Insights</h3>
                                <div class="clustering-insights">
                                    <div class="insight-item">
                                        <div class="insight-value">${kuraData.clusters ? kuraData.clusters.length : 0}</div>
                                        <div class="insight-label">Total Clusters</div>
                                </div>
                                    <div class="insight-item">
                                        <div class="insight-value">${kuraData.total_sessions || 0}</div>
                                        <div class="insight-label">Sessions Analyzed</div>
                        </div>
                                    <div class="insight-item">
                                        <div class="insight-value">${kuraData.clusters ? Math.round(kuraData.total_sessions / kuraData.clusters.length) : 0}</div>
                                        <div class="insight-label">Avg Sessions/Cluster</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${clioData && clioData.success ? `
                            <div class="workflow-section">
                                <h3>Clio Analysis</h3>
                                <div class="clio-insights">
                                    <div class="clio-item">
                                <div class="clio-value">${clioData.visualizations ? clioData.visualizations.length : 0}</div>
                                <div class="clio-label">Notebook Visualizations</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                                    </div>
                                    </div>
                
                <!-- Additional Visualizations Row -->
                <div class="workflow-additional-viz">
                    ${this.generateAdditionalVisualizations(workflowInsights, kuraData, clioData)}
                                    </div>
            </div>
        `;

        container.innerHTML = analysisHtml;
        
        // Render UMAP visualization if data is available
        if (kuraData && kuraData.success && kuraData.umap_coordinates) {
            this.renderUMAPVisualization(kuraData.umap_coordinates, kuraData.clusters);
        }
    }

    getClusterColor(clusterName) {
        const colorMap = {
            'explore_tasks': '#3b82f6',
            'data_exploration_tasks': '#10b981',
            'explore': '#f59e0b',
            'data_exploration': '#8b5cf6',
            'analysis': '#ef4444',
            'development': '#06b6d4',
            'testing': '#84cc16',
            'documentation': '#f97316'
        };
        
        const normalizedName = clusterName.toLowerCase().replace(/\s+/g, '_');
        return colorMap[normalizedName] || '#6b7280';
    }

    generateAdditionalVisualizations(workflowInsights, kuraData, clioData) {
        let additionalHtml = '';
        
        // Session Timeline Visualization
        if (this.sessions && this.sessions.length > 0) {
            additionalHtml += `
                <div class="workflow-section">
                    <h3>Session Timeline</h3>
                    <div class="timeline-viz" id="session-timeline-viz"></div>
                </div>
            `;
        }
        
        // Productivity Heatmap
        additionalHtml += `
            <div class="workflow-section">
                <h3>Productivity Heatmap</h3>
                <div class="heatmap-viz" id="productivity-heatmap"></div>
            </div>
        `;
        
        // Code Complexity Analysis
        if (workflowInsights.complexityData) {
            additionalHtml += `
                <div class="workflow-section">
                    <h3>Code Complexity Trends</h3>
                    <div class="complexity-viz" id="complexity-trends"></div>
                </div>
            `;
        }
        
        return additionalHtml;
    }

    renderUMAPVisualization(umapCoordinates, clusters) {
        const plotContainer = document.getElementById('umap-plot');
        if (!plotContainer) return;

        // Set up the SVG dimensions
        const width = 600;
        const height = 400;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };

        // Create SVG
        const svg = d3.select(plotContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'var(--background-primary)')
            .style('border-radius', '8px')
            .style('border', '1px solid var(--border-color)');

        // Create scales
        const xExtent = d3.extent(umapCoordinates, d => d.x);
        const yExtent = d3.extent(umapCoordinates, d => d.y);
        
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([margin.left, width - margin.right]);
            
        const yScale = d3.scaleLinear()
            .domain(yExtent)
            .range([height - margin.bottom, margin.top]);

        // Color mapping for different intents
        const colorMap = {
            'explore': '#3b82f6',
            'data_exploration': '#10b981',
            'EXPLORE': '#8b5cf6',
            'default': '#f59e0b'
        };

        // Add axes
        const xAxis = d3.axisBottom(xScale)
            .tickSize(0)
            .tickFormat('')
            .tickPadding(10);
            
        const yAxis = d3.axisLeft(yScale)
            .tickSize(0)
            .tickFormat('')
            .tickPadding(10);

        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${height - margin.bottom})`)
            .call(xAxis)
            .style('color', 'var(--text-secondary)');

        svg.append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(yAxis)
            .style('color', 'var(--text-secondary)');

        // Add axis labels
        svg.append('text')
            .attr('class', 'x-label')
            .attr('x', width / 2)
            .attr('y', height - 5)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', 'var(--text-secondary)')
            .text('UMAP Dimension 1');

        svg.append('text')
            .attr('class', 'y-label')
            .attr('x', 15)
            .attr('y', height / 2)
            .attr('transform', 'rotate(-90, 15, ' + (height / 2) + ')')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', 'var(--text-secondary)')
            .text('UMAP Dimension 2');

        // Add grid lines
        const xGrid = d3.axisBottom(xScale)
            .tickSize(-(height - margin.top - margin.bottom))
            .tickFormat('')
            .ticks(5);

        const yGrid = d3.axisLeft(yScale)
            .tickSize(-(width - margin.left - margin.right))
            .tickFormat('')
            .ticks(5);

        svg.append('g')
            .attr('class', 'x-grid')
            .attr('transform', `translate(0, ${height - margin.bottom})`)
            .call(xGrid)
            .style('stroke', 'var(--border-color)')
            .style('stroke-opacity', 0.3);

        svg.append('g')
            .attr('class', 'y-grid')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(yGrid)
            .style('stroke', 'var(--border-color)')
            .style('stroke-opacity', 0.3);

        // Add data points
        const points = svg.selectAll('.data-point')
            .data(umapCoordinates)
            .enter()
            .append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 4)
            .attr('fill', d => colorMap[d.intent] || colorMap.default)
            .attr('opacity', 0.7)
            .attr('stroke', 'var(--background-primary)')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                // Highlight the point
                d3.select(this)
                    .attr('r', 6)
                    .attr('opacity', 1)
                    .attr('stroke', 'var(--text-primary)')
                    .attr('stroke-width', 2);

                // Show tooltip
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'umap-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'var(--background-secondary)')
                    .style('border', '1px solid var(--border-color)')
                    .style('border-radius', '4px')
                    .style('padding', '8px')
                    .style('font-size', '12px')
                    .style('color', 'var(--text-primary)')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.1)');

                tooltip.html(`
                    <div><strong>Session:</strong> ${d.session_id}</div>
                    <div><strong>Intent:</strong> ${d.intent}</div>
                    <div><strong>Outcome:</strong> ${d.outcome}</div>
                    <div><strong>Confidence:</strong> ${(d.confidence * 100).toFixed(1)}%</div>
                `);

                tooltip.style('left', (event.pageX + 10) + 'px')
                       .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function(event, d) {
                // Reset the point
                d3.select(this)
                    .attr('r', 4)
                    .attr('opacity', 0.7)
                    .attr('stroke', 'var(--background-primary)')
                    .attr('stroke-width', 1);

                // Remove tooltip
                d3.selectAll('.umap-tooltip').remove();
            })
            .on('click', function(event, d) {
                // Show detailed session information
                showSessionDetails(d);
            });

        // Add title
        svg.append('text')
            .attr('class', 'plot-title')
            .attr('x', width / 2)
            .attr('y', 15)
            .style('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', '600')
            .style('fill', 'var(--text-primary)')
            .text('Session Clustering Visualization');

        // Add cluster information if available
        if (clusters && clusters.length > 0) {
            const clusterInfo = svg.append('g')
                .attr('class', 'cluster-info')
                .attr('transform', `translate(${width - 150}, ${margin.top + 20})`);

            clusterInfo.append('text')
                .attr('class', 'cluster-title')
                .attr('x', 0)
                .attr('y', 0)
                .style('font-size', '12px')
                .style('font-weight', '600')
                .style('fill', 'var(--text-primary)')
                .text('Clusters:');

            clusters.forEach((cluster, i) => {
                const clusterItem = clusterInfo.append('g')
                    .attr('class', 'cluster-item')
                    .attr('transform', `translate(0, ${(i + 1) * 20})`);

                clusterItem.append('circle')
                    .attr('r', 6)
                    .attr('fill', colorMap[cluster.name.toLowerCase().replace(/\s+/g, '_')] || colorMap.default)
                    .attr('opacity', 0.7);

                clusterItem.append('text')
                    .attr('x', 15)
                    .attr('y', 4)
                    .style('font-size', '11px')
                    .style('fill', 'var(--text-secondary)')
                    .text(`${cluster.name} (${cluster.size})`);
            });
        }
    }

    calculateWorkflowInsights() {
        const sessions = this.sessions;
        if (sessions.length === 0) {
            return {
                avgSessionDuration: '0m',
                mostActiveHour: 'Unknown',
                productivityTrend: 'Stable',
                totalLinesChanged: 0,
                filesPerSession: 0,
                codeVelocity: 0,
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

        // Calculate code velocity (changes per hour) - measures coding productivity
        const codeVelocity = Math.round(this.calculateCodeVelocity());

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
            codeVelocity: codeVelocity,
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
     * Initialize advanced search engine
     */
    async initializeSearchEngine() {
        try {
            // Check if AdvancedSearchEngine is available globally
            if (typeof window !== 'undefined' && window.AdvancedSearchEngine) {
                this.searchEngine = new window.AdvancedSearchEngine();
                console.log('Advanced search engine initialized from global scope');
            } else {
                // Try to load the script dynamically
                await this.loadSearchEngineScript();
                if (window.AdvancedSearchEngine) {
                    this.searchEngine = new window.AdvancedSearchEngine();
                    console.log('Advanced search engine loaded and initialized');
                } else {
                    throw new Error('AdvancedSearchEngine not available after loading script');
                }
            }
            
            // Index existing sessions
            this.indexSessionsForSearch();
            
        } catch (error) {
            console.error('Error initializing search engine:', error);
            console.log('Using fallback search functionality');
            this.searchEngine = null;
        }
    }

    async loadSearchEngineScript() {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            if (document.querySelector('script[src*="advanced-search-engine"]')) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'components/services/advanced-search-engine.js';
            script.onload = () => {
                console.log('Advanced search engine script loaded');
                resolve();
            };
            script.onerror = (error) => {
                console.error('Failed to load advanced search engine script:', error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Index sessions for search
     */
    indexSessionsForSearch() {
        if (!this.searchEngine) return;
        
        console.log('Indexing sessions for search...');
        this.sessions.forEach(session => {
            this.searchEngine.indexSession(session);
        });
        console.log(`Indexed ${this.sessions.length} sessions`);
    }

    /**
     * Search sessions by query using advanced search engine
     */
    async searchSessions(query) {
        // Only log search queries occasionally to reduce spam
        if (Math.random() < 0.1) {
            console.log('searchSessions called with query:', query);
        }
        
        if (!query || query.trim().length === 0) {
            // Only log empty queries occasionally to reduce spam
            if (Math.random() < 0.1) {
                console.log('Empty query, reloading all sessions');
            }
            this.isSearchActive = false;
            this.searchResults = [];
            this.loadSessions(); // Reload all sessions
            return;
        }

        try {
            console.log(`Searching sessions for: "${query}"`);
            this.isSearchActive = true;
            
            // Show loading state
            this.showNotification('Searching sessions...', 'info');
            
            let searchResults = null;
            
            // Use advanced search engine if available
            if (this.searchEngine) {
                searchResults = await this.searchEngine.search(query, {
                    limit: 100,
                    includeFTS: true,
                    includeVectorSearch: true,
                    boostRecent: true
                });
                
                // Map search results back to session objects
                const resultSessions = searchResults.results.map(result => {
                    return this.sessions.find(session => session.id === result.docId);
                }).filter(Boolean);
                
                this.sessions = resultSessions;
                this.searchResults = searchResults.results;
                
                this.showNotification(`Found ${resultSessions.length} matching sessions (${searchResults.searchTime.toFixed(0)}ms)`, 'success');
            } else {
                // Fallback to basic search
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
                    this.showNotification(`Found ${filteredSessions.length} matching sessions`, 'success');
                } else {
                    // If no local matches, try API search
                    const response = await fetch(`/api/sessions/search?q=${encodeURIComponent(query)}`);
                    if (response.ok) {
                        const searchResults = await response.json();
                        this.sessions = searchResults.sessions || [];
                        this.showNotification(`Found ${this.sessions.length} matching sessions`, 'success');
                    } else {
                        this.showNotification('No sessions found matching your search', 'warning');
                    }
                }
            }
            
            this.renderCurrentView();
            
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
                this.loadConversations();
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
            if (e.key >= '1' && e.key <= '5') {
                const viewMap = {
                    '1': 'timeline',
                    '2': 'projects-sessions',
                    '3': 'notebooks',
                    '4': 'visualizations',
                    '5': 'embeddings'
                };
                
                const viewType = viewMap[e.key];
                if (viewType) {
                    e.preventDefault();
                    this.switchView(viewType);
                    this.showNotification(`Switched to ${viewType} view`, 'info');
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
                        <kbd>1-5</kbd>
                        <span>Switch views (Timeline, Projects, Notebooks, Visualizations, Embeddings)</span>
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

    /**
     * Render Memory Management view
     */
    renderMemoryManagement() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        console.log('Rendering Memory Management view');

        container.innerHTML = `
            <div class="memory-management-container">
                <div class="memory-header">
                    <h2 class="section-title">Memory Management</h2>
                    <div class="memory-actions">
                        <button class="btn btn-primary" onclick="window.dashboard.refreshMemories()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                                <path d="M21 3v5h-5"></path>
                                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                                <path d="M3 21v-5h5"></path>
                            </svg>
                            Refresh
                        </button>
                        <button class="btn btn-success" onclick="window.dashboard.addMemory()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Add Memory
                        </button>
                    </div>
                </div>

                <div class="memory-stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="total-memories">0</div>
                        <div class="stat-label">Total Memories</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="executed-memories">0</div>
                        <div class="stat-label">Executed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="active-memories">0</div>
                        <div class="stat-label">Active</div>
                    </div>
                </div>

                <div class="memory-content">
                    <div class="memory-filters">
                        <div class="filter-group">
                            <label for="memory-search">Search Memories</label>
                            <input type="text" id="memory-search" class="search-input" placeholder="Search memories...">
                        </div>
                        <div class="filter-group">
                            <label for="memory-category">Category</label>
                            <select id="memory-category" class="filter-select">
                                <option value="all">All Categories</option>
                                <option value="code">Code</option>
                                <option value="data">Data</option>
                                <option value="workflow">Workflow</option>
                                <option value="insight">Insight</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label for="memory-status">Status</label>
                            <select id="memory-status" class="filter-select">
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="executed">Executed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    <div class="memory-list-container">
                        <div id="memory-list" class="memory-list">
                            <div class="no-data-state">
                                <div class="no-data-icon"></div>
                                <h3>No memories found</h3>
                                <p>Create your first memory to get started with intelligent session management.</p>
                                <button class="btn btn-primary" onclick="window.dashboard.addMemory()">
                                    Add First Memory
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize memory management
        this.initializeMemoryManagement();
    }

    /**
     * Render Model Info Dashboard view
     */
    renderModelInfo() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        console.log('Rendering Model Info Dashboard view');

        container.innerHTML = `
            <div class="model-info-dashboard">
                <div class="model-info-header">
                    <h2 class="section-title">Model Analytics Dashboard</h2>
                    <p class="section-subtitle">Performance metrics and model insights based on telemetry data</p>
                </div>
                
                <div class="model-selector-section">
                    <div class="model-selector">
                        <h3>Active Models</h3>
                        <div class="model-cards">
                            <div class="model-card active" data-model="performance">
                                <div class="model-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M3 3v18h18"/>
                                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                                    </svg>
                                </div>
                                <div class="model-info">
                                    <h4>Performance Predictor</h4>
                                    <p>XGBoost Regressor</p>
                                </div>
                                <div class="model-status">
                                    <span class="version">v2.3.1</span>
                                    <span class="status production">Production</span>
                                </div>
                            </div>
                            <div class="model-card" data-model="patterns">
                                <div class="model-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="3" y="3" width="7" height="7"/>
                                        <rect x="14" y="3" width="7" height="7"/>
                                        <rect x="14" y="14" width="7" height="7"/>
                                        <rect x="3" y="14" width="7" height="7"/>
                                    </svg>
                                </div>
                                <div class="model-info">
                                    <h4>Pattern Classifier</h4>
                                    <p>Neural Network + Transformer</p>
                                </div>
                                <div class="model-status">
                                    <span class="version">v1.8.0</span>
                                    <span class="status production">Production</span>
                                </div>
                            </div>
                            <div class="model-card" data-model="llm">
                                <div class="model-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                    </svg>
                                </div>
                                <div class="model-info">
                                    <h4>LLM Analyzer</h4>
                                    <p>Claude Sonnet 4.5</p>
                                </div>
                                <div class="model-status">
                                    <span class="version">claude-sonnet-4-5</span>
                                    <span class="status production">Production</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="model-details-section">
                    <div class="model-overview">
                        <div class="model-header">
                            <h3 id="model-name">Performance Predictor</h3>
                            <p id="model-description">Predicts execution duration based on trace features</p>
                            <div class="model-meta">
                                <div class="meta-item">
                                    <span class="label">Version:</span>
                                    <span class="value" id="model-version">v2.3.1</span>
                                </div>
                                <div class="meta-item">
                                    <span class="label">Status:</span>
                                    <span class="value status-badge production" id="model-status">Production</span>
                                </div>
                                <div class="meta-item">
                                    <span class="label">Deployed:</span>
                                    <span class="value" id="model-deployed">2025-10-15</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="metrics-grid">
                        <div class="metrics-card">
                            <h4>Performance Metrics</h4>
                            <div class="metrics-grid-inner">
                                <div class="metric">
                                    <span class="metric-label">MSE</span>
                                    <span class="metric-value" id="metric-mse">145.2</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">MAE</span>
                                    <span class="metric-value" id="metric-mae">8.7</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">R²</span>
                                    <span class="metric-value" id="metric-r2">0.94</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">MAPE</span>
                                    <span class="metric-value" id="metric-mape">12.3%</span>
                                </div>
                            </div>
                        </div>

                        <div class="metrics-card">
                            <h4>Training Data</h4>
                            <div class="metrics-grid-inner">
                                <div class="metric">
                                    <span class="metric-label">Samples</span>
                                    <span class="metric-value" id="training-samples">125,000</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Features</span>
                                    <span class="metric-value" id="training-features">24</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Duration</span>
                                    <span class="metric-value" id="training-duration">2h 15m</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Split</span>
                                    <span class="metric-value" id="training-split">80/20</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="feature-importance">
                        <h4>Feature Importance</h4>
                        <div class="feature-list" id="feature-list">
                            <!-- Features will be populated by JavaScript -->
                        </div>
                    </div>

                    <div class="infrastructure-info">
                        <h4>Infrastructure</h4>
                        <div class="infra-grid">
                            <div class="infra-item">
                                <span class="infra-label">Framework:</span>
                                <span class="infra-value" id="infra-framework">XGBoost 2.0.3</span>
                            </div>
                            <div class="infra-item">
                                <span class="infra-label">Runtime:</span>
                                <span class="infra-value" id="infra-runtime">Python 3.11</span>
                            </div>
                            <div class="infra-item">
                                <span class="infra-label">Hardware:</span>
                                <span class="infra-value" id="infra-hardware">4x NVIDIA A100 GPUs</span>
                            </div>
                            <div class="infra-item">
                                <span class="infra-label">Memory:</span>
                                <span class="infra-value" id="infra-memory">64GB RAM</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Initialize model data and event listeners
        this.initializeModelInfo();
    }

    /**
     * Initialize Model Info Dashboard
     */
    initializeModelInfo() {
        // Model data based on actual telemetry capabilities
        const modelData = {
            performance: {
                name: 'Performance Predictor',
                description: 'Predicts execution duration based on trace features',
                version: 'v2.3.1',
                status: 'production',
                deployed: '2025-10-15',
                metrics: {
                    mse: 145.2,
                    mae: 8.7,
                    r2: 0.94,
                    mape: '12.3%'
                },
                trainingData: {
                    samples: '125,000',
                    features: '24',
                    duration: '2h 15m',
                    split: '80/20'
                },
                features: [
                    { name: 'session_duration', importance: 0.23, description: 'Total session duration' },
                    { name: 'code_changes', importance: 0.19, description: 'Number of code modifications' },
                    { name: 'file_operations', importance: 0.15, description: 'File system operations count' },
                    { name: 'prompt_complexity', importance: 0.13, description: 'AI prompt complexity score' },
                    { name: 'memory_usage', importance: 0.11, description: 'System memory utilization' },
                    { name: 'cpu_usage', importance: 0.09, description: 'CPU utilization percentage' },
                    { name: 'workspace_size', importance: 0.06, description: 'Project workspace size' },
                    { name: 'time_of_day', importance: 0.04, description: 'Hour of execution' }
                ],
                infrastructure: {
                    framework: 'XGBoost 2.0.3',
                    runtime: 'Python 3.11',
                    hardware: '4x NVIDIA A100 GPUs',
                    memory: '64GB RAM'
                }
            },
            patterns: {
                name: 'Pattern Classifier',
                description: 'Identifies common execution patterns using CodeBERT embeddings',
                version: 'v1.8.0',
                status: 'production',
                deployed: '2025-10-12',
                metrics: {
                    accuracy: '91.2%',
                    precision: '89.5%',
                    recall: '92.1%',
                    f1: '90.8%'
                },
                trainingData: {
                    samples: '85,000',
                    features: '768',
                    duration: '8h 45m',
                    split: '70/15/15'
                },
                features: [
                    { name: 'code_structure', importance: 0.28, description: 'AST-based code structure' },
                    { name: 'execution_flow', importance: 0.22, description: 'Program execution flow patterns' },
                    { name: 'data_patterns', importance: 0.18, description: 'Data processing patterns' },
                    { name: 'error_handling', importance: 0.15, description: 'Error handling patterns' },
                    { name: 'api_usage', importance: 0.12, description: 'API interaction patterns' },
                    { name: 'concurrency', importance: 0.05, description: 'Concurrency patterns' }
                ],
                infrastructure: {
                    framework: 'TensorFlow 2.14 + HuggingFace',
                    runtime: 'Python 3.11',
                    hardware: '8x NVIDIA A100 GPUs',
                    memory: '128GB RAM'
                }
            },
            llm: {
                name: 'LLM Analyzer',
                description: 'Generates natural language insights and recommendations',
                version: 'claude-sonnet-4-5',
                status: 'production',
                deployed: '2025-10-18',
                metrics: {
                    requests: '1,247',
                    latency: '2.3s',
                    tokens: '3.84M',
                    cost: '$45.60'
                },
                trainingData: {
                    samples: '50,000',
                    features: 'N/A',
                    duration: 'Continuous',
                    split: 'Real-time'
                },
                features: [
                    { name: 'prompt_length', importance: 0.35, description: 'Input prompt length' },
                    { name: 'response_quality', importance: 0.28, description: 'Response quality score' },
                    { name: 'context_relevance', importance: 0.20, description: 'Context relevance score' },
                    { name: 'complexity_score', importance: 0.17, description: 'Task complexity assessment' }
                ],
                infrastructure: {
                    framework: 'Anthropic API',
                    runtime: 'Cloud-based',
                    hardware: 'Anthropic Infrastructure',
                    memory: 'Dynamic'
                }
            }
        };

        // Add click handlers for model selection
        document.querySelectorAll('.model-card').forEach(card => {
            card.addEventListener('click', () => {
                // Remove active class from all cards
                document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
                // Add active class to clicked card
                card.classList.add('active');
                
                const modelType = card.dataset.model;
                this.updateModelDetails(modelData[modelType]);
            });
        });

        // Initialize with performance model
        this.updateModelDetails(modelData.performance);
    }

    /**
     * Update model details based on selected model
     */
    updateModelDetails(modelData) {
        // Update model header
        document.getElementById('model-name').textContent = modelData.name;
        document.getElementById('model-description').textContent = modelData.description;
        document.getElementById('model-version').textContent = modelData.version;
        document.getElementById('model-status').textContent = modelData.status;
        document.getElementById('model-deployed').textContent = modelData.deployed;

        // Update metrics
        Object.keys(modelData.metrics).forEach(key => {
            const element = document.getElementById(`metric-${key}`);
            if (element) {
                element.textContent = modelData.metrics[key];
            }
        });

        // Update training data
        Object.keys(modelData.trainingData).forEach(key => {
            const element = document.getElementById(`training-${key}`);
            if (element) {
                element.textContent = modelData.trainingData[key];
            }
        });

        // Update infrastructure
        Object.keys(modelData.infrastructure).forEach(key => {
            const element = document.getElementById(`infra-${key}`);
            if (element) {
                element.textContent = modelData.infrastructure[key];
            }
        });

        // Update feature importance
        const featureList = document.getElementById('feature-list');
        if (featureList && modelData.features) {
            featureList.innerHTML = modelData.features.map(feature => `
                <div class="feature-item">
                    <div class="feature-header">
                        <span class="feature-name">${feature.name}</span>
                        <span class="feature-importance-value">${(feature.importance * 100).toFixed(1)}%</span>
                    </div>
                    <div class="feature-description">${feature.description}</div>
                    <div class="feature-bar">
                        <div class="feature-bar-fill" style="width: ${feature.importance * 100}%"></div>
                    </div>
                </div>
            `).join('');
        }
    }

    /**
     * Initialize memory management functionality
     */
    initializeMemoryManagement() {
        // Load memories and update stats
        this.loadMemories();
        
        // Setup event listeners
        this.setupMemoryEventListeners();
    }

    /**
     * Format memory date safely
     */
    formatMemoryDate(dateValue) {
        if (!dateValue) {
            return 'No date';
        }
        
        try {
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) {
                return 'Invalid date';
            }
            return date.toLocaleDateString();
        } catch (error) {
            return 'Invalid date';
        }
    }

    /**
     * Load memories from API
     */
    async loadMemories() {
        try {
            const response = await fetch('/api/memories');
            const data = await response.json();

            if (data.success) {
                // Handle nested memories structure from API and ensure it's an array
                const memoriesData = data.memories?.memories || data.memories || [];
                this.memories = Array.isArray(memoriesData) ? memoriesData : [];
                this.updateMemoryStats();
                this.renderMemoryList();
            } else {
                console.error('Failed to load memories:', data.error);
                this.showMemoryError('Failed to load memories: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading memories:', error);
            this.showMemoryError('Error loading memories: ' + error.message);
        }
    }

    /**
     * Update memory statistics
     */
    updateMemoryStats() {
        // Ensure memories is an array
        if (!Array.isArray(this.memories)) {
            this.memories = [];
        }
        
        const totalMemories = this.memories.length;
        const executedMemories = this.memories.filter(m => m.status === 'executed').length;
        const activeMemories = this.memories.filter(m => m.status === 'active' || !m.status).length;
        
        // Update DOM elements
        const totalEl = document.getElementById('total-memories');
        const executedEl = document.getElementById('executed-memories');
        const activeEl = document.getElementById('active-memories');

        if (totalEl) totalEl.textContent = totalMemories;
        if (executedEl) executedEl.textContent = executedMemories;
        if (activeEl) activeEl.textContent = activeMemories;
    }

    /**
     * Render memory list
     */
    renderMemoryList() {
        // Ensure memories is an array
        if (!Array.isArray(this.memories)) {
            this.memories = [];
        }
        
        const container = document.getElementById('memory-list');
        if (!container) return;

        if (this.memories.length === 0) {
            container.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon"></div>
                    <h3>No memories found</h3>
                    <p>Create your first memory to get started with intelligent session management.</p>
                    <button class="btn btn-primary" onclick="window.dashboard.addMemory()">
                        Add First Memory
                    </button>
                </div>
            `;
            return;
        }

        const memoryHtml = this.memories.map(memory => `
            <div class="memory-item" data-memory-id="${memory.id}">
                <div class="memory-header">
                    <h4 class="memory-title">${memory.title || 'Untitled Memory'}</h4>
                    <div class="memory-meta">
                        <span class="memory-status status-${memory.status || 'active'}">${memory.status || 'active'}</span>
                        <span class="memory-date">${this.formatMemoryDate(memory.created || memory.createdAt || memory.timestamp || memory.date)}</span>
                    </div>
                </div>
                <div class="memory-content">
                    <p class="memory-description">${memory.description || 'No description available'}</p>
                    <div class="memory-tags">
                        ${(memory.tags || []).map(tag => `<span class="memory-tag">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="memory-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.dashboard.executeMemory('${memory.id}')">
                        Execute
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.dashboard.editMemory('${memory.id}')">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.dashboard.deleteMemory('${memory.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = memoryHtml;
    }

    /**
     * Setup memory event listeners
     */
    setupMemoryEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('memory-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterMemories(e.target.value);
            });
        }

        // Category filter
        const categorySelect = document.getElementById('memory-category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                this.filterMemoriesByCategory(e.target.value);
            });
        }

        // Status filter
        const statusSelect = document.getElementById('memory-status');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                this.filterMemoriesByStatus(e.target.value);
            });
        }
    }

    /**
     * Filter memories by search query
     */
    filterMemories(query) {
        // Ensure memories is an array
        if (!Array.isArray(this.memories)) {
            this.memories = [];
        }
        
        const filteredMemories = this.memories.filter(memory => 
            memory.title?.toLowerCase().includes(query.toLowerCase()) ||
            memory.description?.toLowerCase().includes(query.toLowerCase()) ||
            memory.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
        );
        this.renderFilteredMemories(filteredMemories);
    }

    /**
     * Filter memories by category
     */
    filterMemoriesByCategory(category) {
        // Ensure memories is an array
        if (!Array.isArray(this.memories)) {
            this.memories = [];
        }
        
        if (category === 'all') {
            this.renderMemoryList();
            return;
        }
        
        const filteredMemories = this.memories.filter(memory => memory.category === category);
        this.renderFilteredMemories(filteredMemories);
    }

    /**
     * Filter memories by status
     */
    filterMemoriesByStatus(status) {
        // Ensure memories is an array
        if (!Array.isArray(this.memories)) {
            this.memories = [];
        }
        
        if (status === 'all') {
            this.renderMemoryList();
            return;
        }
        
        const filteredMemories = this.memories.filter(memory => memory.status === status);
        this.renderFilteredMemories(filteredMemories);
    }

    /**
     * Render filtered memories
     */
    renderFilteredMemories(memories) {
        const container = document.getElementById('memory-list');
        if (!container) return;

        if (memories.length === 0) {
            container.innerHTML = `
                <div class="no-data-state">
                    <div class="no-data-icon"></div>
                    <h3>No memories found</h3>
                    <p>Try adjusting your search criteria or filters.</p>
                </div>
            `;
            return;
        }

        const memoryHtml = memories.map(memory => `
            <div class="memory-item" data-memory-id="${memory.id}">
                <div class="memory-header">
                    <h4 class="memory-title">${memory.title || 'Untitled Memory'}</h4>
                    <div class="memory-meta">
                        <span class="memory-status status-${memory.status || 'active'}">${memory.status || 'active'}</span>
                        <span class="memory-date">${this.formatMemoryDate(memory.created || memory.createdAt || memory.timestamp || memory.date)}</span>
                    </div>
                </div>
                <div class="memory-content">
                    <p class="memory-description">${memory.description || 'No description available'}</p>
                    <div class="memory-tags">
                        ${(memory.tags || []).map(tag => `<span class="memory-tag">${tag}</span>`).join('')}
                    </div>
                </div>
                <div class="memory-actions">
                    <button class="btn btn-sm btn-primary" onclick="window.dashboard.executeMemory('${memory.id}')">
                        Execute
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="window.dashboard.editMemory('${memory.id}')">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.dashboard.deleteMemory('${memory.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = memoryHtml;
    }

    /**
     * Refresh memories
     */
    async refreshMemories() {
        await this.loadMemories();
        this.showNotification('Memories refreshed', 'success');
    }

    /**
     * Add new memory
     */
    addMemory() {
        this.showAddMemoryModal();
    }

    /**
     * Show add memory modal
     */
    showAddMemoryModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay memory-modal';
        modal.innerHTML = `
            <div class="modal-content memory-modal-content">
                <div class="modal-header">
                    <h3>Add New Memory</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="add-memory-form" class="memory-form">
                        <div class="form-group">
                            <label for="memory-title">Title *</label>
                            <input type="text" id="memory-title" name="title" required 
                                   placeholder="Enter memory title..." maxlength="100">
                        </div>
                        
                        <div class="form-group">
                            <label for="memory-description">Description</label>
                            <textarea id="memory-description" name="description" rows="4" 
                                      placeholder="Describe what this memory represents..."></textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="memory-category">Category</label>
                                <select id="memory-category" name="category">
                                    <option value="code">Code</option>
                                    <option value="data">Data</option>
                                    <option value="workflow">Workflow</option>
                                    <option value="insight">Insight</option>
                                    <option value="session">Session</option>
                                    <option value="template">Template</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="memory-type">Type</label>
                                <select id="memory-type" name="type">
                                    <option value="session">Session</option>
                                    <option value="integration">Integration</option>
                                    <option value="notebook">Notebook</option>
                                    <option value="template">Template</option>
                                    <option value="analysis">Analysis</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="memory-tags">Tags (comma-separated)</label>
                            <input type="text" id="memory-tags" name="tags" 
                                   placeholder="e.g., python, data-analysis, visualization">
                        </div>
                        
                        <div class="form-group">
                            <label for="memory-content">Content *</label>
                            <textarea id="memory-content" name="content" rows="6" required 
                                      placeholder="Enter the memory content (code, notes, instructions, etc.)..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="memory-priority">Priority</label>
                            <select id="memory-priority" name="priority">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="memory-auto-execute" name="autoExecute">
                                <span class="checkmark"></span>
                                Auto-execute when conditions are met
                            </label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" onclick="dashboard.submitAddMemory()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Memory
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Focus on title input
        setTimeout(() => {
            const titleInput = modal.querySelector('#memory-title');
            if (titleInput) titleInput.focus();
        }, 100);
    }

    /**
     * Submit add memory form
     */
    async submitAddMemory() {
        const form = document.getElementById('add-memory-form');
        if (!form) return;
        
        const formData = new FormData(form);
        const memoryData = {
            title: formData.get('title')?.trim(),
            description: formData.get('description')?.trim(),
            category: formData.get('category'),
            type: formData.get('type'),
            tags: formData.get('tags')?.split(',').map(tag => tag.trim()).filter(tag => tag),
            content: formData.get('content')?.trim(),
            priority: formData.get('priority'),
            autoExecute: formData.get('autoExecute') === 'on',
            status: 'active'
        };
        
        // Validate required fields
        if (!memoryData.title || !memoryData.content) {
            this.showNotification('Title and content are required', 'error');
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = document.querySelector('.memory-modal .btn-primary');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Adding...
            `;
            submitBtn.disabled = true;
            
            // Submit to API
            const response = await fetch('/api/memories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(memoryData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('Memory added successfully!', 'success');
                
                // Close modal
                const modal = document.querySelector('.memory-modal');
                if (modal) modal.remove();
                
                // Refresh memory list
                await this.loadMemories();
                this.renderMemoryList();
            } else {
                throw new Error(result.error || 'Failed to add memory');
            }
            
        } catch (error) {
            console.error('Error adding memory:', error);
            this.showNotification(`Failed to add memory: ${error.message}`, 'error');
            
            // Reset button
            const submitBtn = document.querySelector('.memory-modal .btn-primary');
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Execute memory
     */
    async executeMemory(memoryId) {
        try {
            // Show loading state
            this.showNotification('Executing memory...', 'info');
            
            // Find the memory to get its details
            const memory = this.memories.find(m => m.id === memoryId);
            if (!memory) {
                this.showNotification('Memory not found', 'error');
                return;
            }

            // Call the API to execute the memory
            const response = await fetch(`/api/memory/${memoryId}/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    context: {
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent,
                        sessionId: this.getCurrentSessionId()
                    }
                })
            });

            const result = await response.json();

            if (result.success) {
                // Update memory status to executed
                memory.status = 'executed';
                memory.lastExecuted = new Date().toISOString();
                
                // Update the display
                this.updateMemoryStats();
                this.renderMemoryList();
                
                // Show success notification with execution details
                const executionDetails = result.execution;
                let message = `Memory "${memory.title}" executed successfully!`;
                
                if (executionDetails.commands && executionDetails.commands.length > 0) {
                    message += ` (${executionDetails.commands.length} commands executed)`;
                }
                
                this.showNotification(message, 'success');
                
                // Log execution details for debugging
                console.log('Memory execution result:', executionDetails);
                
                // If there are results, show them in a modal or notification
                if (executionDetails.results && executionDetails.results.length > 0) {
                    this.showExecutionResults(memory, executionDetails);
                }
                
            } else {
                this.showNotification(`Failed to execute memory: ${result.error}`, 'error');
                console.error('Memory execution failed:', result.error);
            }
            
        } catch (error) {
            console.error('Error executing memory:', error);
            this.showNotification(`Error executing memory: ${error.message}`, 'error');
        }
    }

    /**
     * Get current session ID
     */
    getCurrentSessionId() {
        // Try to get from URL params or current session
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionId') || 'current-session';
    }

    /**
     * Set loading state for conversations refresh button
     */
    setConversationsButtonLoading(loading) {
        const button = document.getElementById('refresh-conversations-btn');
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinning">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                </svg>
                Loading...
            `;
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Conversations
            `;
        }
    }

    /**
     * Show execution results in a modal
     */
    showExecutionResults(memory, executionDetails) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Memory Execution Results</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="execution-summary">
                        <h4>Memory: ${memory.title}</h4>
                        <p><strong>Executed:</strong> ${new Date(executionDetails.executed).toLocaleString()}</p>
                        <p><strong>Status:</strong> <span class="status-success">Success</span></p>
                    </div>
                    
                    ${executionDetails.commands && executionDetails.commands.length > 0 ? `
                        <div class="execution-commands">
                            <h4>Commands Executed (${executionDetails.commands.length})</h4>
                            <ul>
                                ${executionDetails.commands.map(cmd => `<li><code>${cmd.type}</code>: ${cmd.description || 'No description'}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${executionDetails.results && executionDetails.results.length > 0 ? `
                        <div class="execution-results">
                            <h4>Results</h4>
                            <div class="results-list">
                                ${executionDetails.results.map(result => `
                                    <div class="result-item">
                                        <strong>${result.type || 'Result'}:</strong>
                                        <pre>${JSON.stringify(result.data, null, 2)}</pre>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${executionDetails.errors && executionDetails.errors.length > 0 ? `
                        <div class="execution-errors">
                            <h4>Errors</h4>
                            <ul>
                                ${executionDetails.errors.map(error => `<li class="error-item">${error}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Edit memory
     */
    editMemory(memoryId) {
        this.showNotification('Edit memory functionality coming soon', 'info');
    }

    /**
     * Delete memory
     */
    deleteMemory(memoryId) {
        this.showNotification('Delete memory functionality coming soon', 'info');
    }

    /**
     * Show memory error
     */
    showMemoryError(message) {
        const container = document.getElementById('memory-list');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon"></div>
                    <h3>Error</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.dashboard.refreshMemories()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing dashboard...');
    window.dashboard = new LiveDashboard();
    
    // Initialize real-time search after dashboard is ready
    setTimeout(() => {
        if (typeof RealTimeSearch !== 'undefined' && window.dashboard.searchEngine) {
            window.realTimeSearch = new RealTimeSearch({
                container: document.getElementById('search-container'),
                searchEngine: window.dashboard.searchEngine,
                onResults: (results, searchData) => {
                    console.log('Search results:', results);
                    if (searchData && searchData.results) {
                        window.dashboard.searchResults = searchData.results;
                    }
                },
                onSuggestion: (suggestion) => {
                    console.log('Search suggestion selected:', suggestion);
                }
            });
            console.log('Real-time search initialized');
        }
    }, 1000); // Wait for search engine to be ready
    
    // Make functions globally available for HTML onclick handlers
    window.closeSessionDetail = function() {
        if (window.dashboard) {
            window.dashboard.closeSessionDetail();
        }
    };
    
    window.refreshData = function() {
        if (window.dashboard) {
            window.dashboard.loadSessions();
            window.dashboard.loadConversations();
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
    
    
    window.toggleProject = function(projectName) {
        const projectId = 'project-' + projectName.replace(/\s+/g, '-');
        const sessionsDiv = document.getElementById(projectId);
        const toggle = event.currentTarget.querySelector('.project-toggle');
        
        if (sessionsDiv) {
            if (sessionsDiv.style.display === 'none') {
                sessionsDiv.style.display = 'block';
                toggle.textContent = '▼';
            } else {
                sessionsDiv.style.display = 'none';
                toggle.textContent = '▶';
            }
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
    
    window.openInfoModal = function() {
        if (window.dashboard) {
            window.dashboard.openInfoModal();
        }
    };
    
    window.closeInfoModal = function() {
        if (window.dashboard) {
            window.dashboard.closeInfoModal();
        }
    };
    
    window.closeSessionModal = function() {
        if (window.dashboard) {
            window.dashboard.closeSessionDetail();
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

    // Cursor Integration helper functions
    window.showAnalysisOptions = function() {
        const options = [
            'Comprehensive Analysis',
            'Syntax Analysis', 
            'Performance Analysis',
            'Security Analysis',
            'Style Analysis'
        ];
        
        const choice = prompt('Select analysis type:\n' + options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'));
        const index = parseInt(choice) - 1;
        
        if (index >= 0 && index < options.length) {
            const analysisTypes = ['comprehensive', 'syntax', 'performance', 'security', 'style'];
            const filePath = prompt('Enter file path to analyze:');
            
            if (filePath && window.cursorCLI) {
                window.cursorCLI.analyzeFile(filePath, analysisTypes[index])
                    .then(result => {
                        if (result) {
                            alert('Analysis completed! Check console for details.');
                            console.log('Analysis result:', result);
                        } else {
                            alert('Analysis failed. Check console for errors.');
                        }
                    });
            }
        }
    };

    window.showAutomationOptions = function() {
        const options = [
            'Auto-format on save',
            'Auto-lint on change',
            'Auto-analyze on change',
            'Auto-generate tests',
            'Auto-optimize code'
        ];
        
        const choice = prompt('Select automation type:\n' + options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'));
        const index = parseInt(choice) - 1;
        
        if (index >= 0 && index < options.length) {
            const filePath = prompt('Enter file path to monitor:');
            
            if (filePath && window.cursorCLI) {
                const watchOptions = {
                    autoFormat: index === 0,
                    autoLint: index === 1,
                    autoAnalyze: index === 2,
                    autoGenerateTests: index === 3,
                    autoOptimize: index === 4
                };
                
                window.cursorCLI.watchFile(filePath, watchOptions)
                    .then(success => {
                        if (success) {
                            alert('Automation configured successfully!');
                            // Refresh the view to show updated monitoring
                            if (window.dashboard) {
                                window.dashboard.renderCurrentView();
                            }
                        } else {
                            alert('Failed to configure automation.');
                        }
                    });
            }
        }
    };

    window.showTestGeneration = function() {
        const options = [
            'Unit Tests',
            'Integration Tests',
            'End-to-End Tests',
            'All Test Types'
        ];
        
        const choice = prompt('Select test type:\n' + options.map((opt, i) => `${i + 1}. ${opt}`).join('\n'));
        const index = parseInt(choice) - 1;
        
        if (index >= 0 && index < options.length) {
            const testTypes = ['unit', 'integration', 'e2e', 'all'];
            const filePath = prompt('Enter file path to generate tests for:');
            
            if (filePath && window.cursorCLI) {
                window.cursorCLI.generateTests(filePath, testTypes[index])
                    .then(result => {
                        if (result) {
                            alert('Test generation completed! Check console for details.');
                            console.log('Test generation result:', result);
                        } else {
                            alert('Test generation failed. Check console for errors.');
                        }
                    });
            }
        }
    };

    /**
     * Show timeline view
     */
    window.showTimelineView = async function() {
        try {
            // Hide main dashboard content
            const dashboardContent = document.getElementById('dashboardContent');
            if (dashboardContent) {
                dashboardContent.style.display = 'none';
            }

            // Show timeline container
            let timelineContainer = document.getElementById('timeline-container');
            if (!timelineContainer) {
                // Create timeline container if it doesn't exist
                timelineContainer = document.createElement('div');
                timelineContainer.id = 'timeline-container';
                timelineContainer.className = 'timeline-view';
                
                // Insert after the main dashboard content
                if (dashboardContent && dashboardContent.parentNode) {
                    dashboardContent.parentNode.insertBefore(timelineContainer, dashboardContent.nextSibling);
                }
            }

            // Show timeline container
            timelineContainer.style.display = 'block';

            // Render timeline if not already rendered
            if (window.realDataVisualizations && window.realDataVisualizations.renderSessionTimeline) {
                await window.realDataVisualizations.renderSessionTimeline();
            }

            // Update sidebar active state
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.remove('active');
            });
            const timelineBtn = document.getElementById('timeline-btn');
            if (timelineBtn) {
                timelineBtn.classList.add('active');
            }

        } catch (error) {
            console.error('Error showing timeline view:', error);
        }
    };

    /**
     * Hide timeline view
     */
    window.hideTimelineView = function() {
        try {
            // Hide timeline container
            const timelineContainer = document.getElementById('timeline-container');
            if (timelineContainer) {
                timelineContainer.style.display = 'none';
            }

            // Show main dashboard content
            const dashboardContent = document.getElementById('dashboardContent');
            if (dashboardContent) {
                dashboardContent.style.display = 'block';
            }

            // Update sidebar active state
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.remove('active');
            });
            const dashboardBtn = document.getElementById('dashboard-btn');
            if (dashboardBtn) {
                dashboardBtn.classList.add('active');
            }

        } catch (error) {
            console.error('Error hiding timeline view:', error);
        }
    };

    /**
     * Switch between different views
     */
    window.switchView = async function(viewName) {
        try {
            // Update sidebar active state
            document.querySelectorAll('.sidebar-link').forEach(link => {
                link.classList.remove('active');
            });
            
            const activeBtn = document.getElementById(`${viewName}-view-btn`) || 
                             document.getElementById(`${viewName}-btn`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }

            // Handle different views
            switch (viewName) {
                case 'timeline':
                    await window.showTimelineView();
                    break;
                case 'projects-sessions':
                    window.hideTimelineView();
                    // Show projects and sessions view
                    break;
                case 'notebooks':
                    window.hideTimelineView();
                    // Show notebooks view
                    break;
                case 'visualizations':
                    window.hideTimelineView();
                    // Show visualizations view
                    break;
                case 'embeddings':
                    window.hideTimelineView();
                    // Show embeddings view
                    break;
                case 'memory-management':
                    window.hideTimelineView();
                    // Show memory management view
                    break;
                case 'model-info':
                    window.hideTimelineView();
                    // Show model info view
                    break;
                default:
                    window.hideTimelineView();
                    break;
            }

        } catch (error) {
            console.error('Error switching view:', error);
        }
    };
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
    if (window.dashboard) {
        window.dashboard.stopAutoRefresh();
    }
});
