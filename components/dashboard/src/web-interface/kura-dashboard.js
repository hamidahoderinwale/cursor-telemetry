/**
 * Enhanced Kura Dashboard JavaScript
 * Provides hierarchical clustering visualization, UMAP plots, and advanced analytics
 */

class KuraDashboard {
    constructor() {
        this.sessions = [];
        this.clusters = [];
        this.umapData = [];
        this.projects = [];
        this.selectedSessions = new Set();
        this.currentColorBy = 'intent';
        this.clusterTree = null;
        this.umapPlot = null;
        this.currentView = 'clusters'; // 'clusters' or 'projects'
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedProject = null;
        
        // Load configuration from localStorage or use defaults
        this.config = this.loadConfiguration();
        
        // Initialize modal handlers first
        initializeModalHandlers();
        
        // Load saved settings
        this.loadUserSettings();
        
        this.initializeEventListeners();
        this.initializeConfigurationUI();
        this.loadData();
    }

    // Configuration management
    loadConfiguration() {
        const defaultConfig = {
            // Clustering parameters
            clusterCount: 5,
            clusteringMethod: 'intent-based',
            
            // UMAP parameters
            umapNeighbors: 15,
            umapMinDist: 0.1,
            
            // Analysis thresholds
            thresholds: {
                shortDuration: 1800, // 30 minutes in seconds
                longDuration: 7200,  // 2 hours in seconds
                highConfidence: 0.8,
                minSessionsForPattern: 2,
                minSessionsForInsight: 5
            },
            
            // Feature extraction weights
            featureWeights: {
                durationNormalization: 3600, // Convert to hours
                codeDeltasNormalization: 10,
                fileChangesNormalization: 5
            },
            
            // Visualization settings
            visualization: {
                markerSize: {
                    default: 10,
                    selected: 15
                },
                markerLineWidth: {
                    default: 1,
                    selected: 3
                },
                maxDisplayItems: 5,
                plotMargins: { t: 50, r: 150, b: 50, l: 50 },
                maxFileExtensionLength: 5
            },
            
            // DBSCAN parameters
            dbscan: {
                eps: 0.5,
                minPts: 2
            },
            
            // t-SNE projection parameters
            tsne: {
                maxIterations: 100,
                learningRate: 0.1,
                perplexity: 15,
                initialScale: 4
            }
        };

        try {
            const savedConfig = localStorage.getItem('kura-dashboard-config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                return { ...defaultConfig, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load saved configuration, using defaults:', error);
        }
        
        return defaultConfig;
    }

    saveConfiguration() {
        try {
            localStorage.setItem('kura-dashboard-config', JSON.stringify(this.config));
        } catch (error) {
            console.warn('Failed to save configuration:', error);
        }
    }

    updateConfiguration(key, value) {
        try {
            // Validate the value before updating
            if (!this.validateConfigurationValue(key, value)) {
                console.warn(`Invalid configuration value for ${key}:`, value);
                return false;
            }

            if (key.includes('.')) {
                const keys = key.split('.');
                let current = this.config;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!current[keys[i]]) {
                        current[keys[i]] = {};
                    }
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
            } else {
                this.config[key] = value;
            }
            this.saveConfiguration();
            return true;
        } catch (error) {
            console.error('Error updating configuration:', error);
            return false;
        }
    }

    validateConfigurationValue(key, value) {
        const validations = {
            clusterCount: (v) => Number.isInteger(v) && v >= 2 && v <= 20,
            umapNeighbors: (v) => Number.isInteger(v) && v >= 5 && v <= 50,
            umapMinDist: (v) => typeof v === 'number' && v >= 0.01 && v <= 1.0,
            clusteringMethod: (v) => ['intent-based', 'kmeans', 'hierarchical', 'dbscan'].includes(v),
            'thresholds.shortDuration': (v) => Number.isInteger(v) && v > 0,
            'thresholds.longDuration': (v) => Number.isInteger(v) && v > 0,
            'thresholds.highConfidence': (v) => typeof v === 'number' && v >= 0 && v <= 1,
            'thresholds.minSessionsForPattern': (v) => Number.isInteger(v) && v >= 1,
            'thresholds.minSessionsForInsight': (v) => Number.isInteger(v) && v >= 1
        };

        const validator = validations[key];
        return validator ? validator(value) : true;
    }

    initializeConfigurationUI() {
        // Set initial values for configuration controls
        const clusterCountSlider = document.getElementById('cluster-count');
        const umapNeighborsSlider = document.getElementById('umap-n-neighbors');
        const umapMinDistSlider = document.getElementById('umap-min-dist');
        const clusteringMethodSelect = document.getElementById('clustering-method');

        if (clusterCountSlider) {
            clusterCountSlider.value = this.config.clusterCount;
            document.getElementById('cluster-count-value').textContent = this.config.clusterCount;
        }

        if (umapNeighborsSlider) {
            umapNeighborsSlider.value = this.config.umapNeighbors;
            document.getElementById('umap-n-neighbors-value').textContent = this.config.umapNeighbors;
        }

        if (umapMinDistSlider) {
            umapMinDistSlider.value = this.config.umapMinDist;
            document.getElementById('umap-min-dist-value').textContent = this.config.umapMinDist;
        }

        if (clusteringMethodSelect) {
            clusteringMethodSelect.value = this.config.clusteringMethod;
        }
    }

    initializeEventListeners() {
        try {
            // Header controls
            const refreshBtn = document.getElementById('refresh-btn');
            const exportBtn = document.getElementById('export-btn');
            const searchBtn = document.getElementById('search-btn');
            const globalSearch = document.getElementById('global-search');

            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => this.loadData());
            } else {
                console.warn('Refresh button not found');
            }

            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportData());
            } else {
                console.warn('Export button not found');
            }

            if (searchBtn) {
                searchBtn.addEventListener('click', () => this.performSearch());
            } else {
                console.warn('Search button not found');
            }

            if (globalSearch) {
                globalSearch.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.performSearch();
                });
            } else {
                console.warn('Global search input not found');
            }
        } catch (error) {
            console.error('Error initializing header event listeners:', error);
        }

        try {
            // Cluster tree controls
            const expandAllBtn = document.getElementById('expand-all-btn');
            const collapseAllBtn = document.getElementById('collapse-all-btn');

            if (expandAllBtn) {
                expandAllBtn.addEventListener('click', () => this.expandAllClusters());
            }

            if (collapseAllBtn) {
                collapseAllBtn.addEventListener('click', () => this.collapseAllClusters());
            }

            // UMAP controls
            const colorBySelect = document.getElementById('color-by-select');
            const resetZoomBtn = document.getElementById('reset-zoom-btn');
            const fullscreenBtn = document.getElementById('fullscreen-btn');

            if (colorBySelect) {
                colorBySelect.addEventListener('change', (e) => {
                    this.currentColorBy = e.target.value;
                    this.updateUMAPColors();
                });
            }

            if (resetZoomBtn) {
                resetZoomBtn.addEventListener('click', () => this.resetUMAPZoom());
            }

            if (fullscreenBtn) {
                fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
            }

            // Pattern insights
            const insightTypeSelect = document.getElementById('insight-type-select');
            if (insightTypeSelect) {
                insightTypeSelect.addEventListener('change', (e) => {
                    this.updatePatternInsights(e.target.value);
                });
            }
        } catch (error) {
            console.error('Error initializing visualization event listeners:', error);
        }

        try {
            // Configuration controls
            const clusterCountSlider = document.getElementById('cluster-count');
            const umapNeighborsSlider = document.getElementById('umap-n-neighbors');
            const umapMinDistSlider = document.getElementById('umap-min-dist');
            const clusteringMethodSelect = document.getElementById('clustering-method');
            const recomputeBtn = document.getElementById('recompute-clusters-btn');

            if (clusterCountSlider) {
                clusterCountSlider.addEventListener('input', (e) => {
                    this.updateConfiguration('clusterCount', parseInt(e.target.value));
                    const valueDisplay = document.getElementById('cluster-count-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = e.target.value;
                    }
                });
            }

            if (umapNeighborsSlider) {
                umapNeighborsSlider.addEventListener('input', (e) => {
                    this.updateConfiguration('umapNeighbors', parseInt(e.target.value));
                    const valueDisplay = document.getElementById('umap-n-neighbors-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = e.target.value;
                    }
                });
            }

            if (umapMinDistSlider) {
                umapMinDistSlider.addEventListener('input', (e) => {
                    this.updateConfiguration('umapMinDist', parseFloat(e.target.value));
                    const valueDisplay = document.getElementById('umap-min-dist-value');
                    if (valueDisplay) {
                        valueDisplay.textContent = e.target.value;
                    }
                });
            }

            if (clusteringMethodSelect) {
                clusteringMethodSelect.addEventListener('change', (e) => {
                    this.updateConfiguration('clusteringMethod', e.target.value);
                });
            }

            if (recomputeBtn) {
                recomputeBtn.addEventListener('click', () => this.recomputeClusters());
            }
        } catch (error) {
            console.error('Error initializing configuration event listeners:', error);
        }

        try {
            // Quick actions
            const generateNotebookBtn = document.getElementById('generate-notebook-btn');
            const exportClusterBtn = document.getElementById('export-cluster-btn');
            const createProcedureBtn = document.getElementById('create-procedure-btn');
            const shareInsightsBtn = document.getElementById('share-insights-btn');
            const analyzePatternsBtn = document.getElementById('analyze-patterns-btn');
            const exportUmapBtn = document.getElementById('export-umap-btn');
            const infoBtn = document.getElementById('info-btn');
            const closeDetailsBtn = document.getElementById('close-details-btn');

            if (generateNotebookBtn) {
                generateNotebookBtn.addEventListener('click', () => this.generateAnalysisNotebook());
            }

            if (exportClusterBtn) {
                exportClusterBtn.addEventListener('click', () => this.exportSelectedCluster());
            }

            if (createProcedureBtn) {
                createProcedureBtn.addEventListener('click', () => this.showProcedureModal());
            }

            if (shareInsightsBtn) {
                shareInsightsBtn.addEventListener('click', () => this.shareInsights());
            }

            if (analyzePatternsBtn) {
                analyzePatternsBtn.addEventListener('click', () => this.analyzePatterns());
            }

            if (exportUmapBtn) {
                exportUmapBtn.addEventListener('click', () => this.exportUMAPData());
            }

            if (infoBtn) {
                infoBtn.addEventListener('click', () => openModal('info-modal'));
            }

            const settingsBtn = document.getElementById('settings-btn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', () => openModal('settings-modal'));
            }

            if (closeDetailsBtn) {
                closeDetailsBtn.addEventListener('click', () => this.closeSessionDetails());
            }

            // View toggle event listeners
            const clustersViewBtn = document.getElementById('clusters-view-btn');
            const projectsViewBtn = document.getElementById('projects-view-btn');

            if (clustersViewBtn) {
                clustersViewBtn.addEventListener('click', () => this.switchView('clusters'));
            }
            if (projectsViewBtn) {
                projectsViewBtn.addEventListener('click', () => this.switchView('projects'));
            }

            // Pagination event listeners
            const prevPageBtn = document.getElementById('prev-page-btn');
            const nextPageBtn = document.getElementById('next-page-btn');

            if (prevPageBtn) {
                prevPageBtn.addEventListener('click', () => this.previousPage());
            }
            if (nextPageBtn) {
                nextPageBtn.addEventListener('click', () => this.nextPage());
            }

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        } catch (error) {
            console.error('Error initializing event listeners:', error);
        }
    }

    async loadData() {
        this.showLoading(true);
        
        try {
            console.log('Loading session data...');
            
            // First try to load real sessions data
            const sessionsResponse = await fetch('/api/sessions');
            let sessionsData = { sessions: [] };
            
            if (sessionsResponse.ok) {
                sessionsData = await sessionsResponse.json();
                console.log(`Loaded ${sessionsData.sessions?.length || 0} sessions from API`);
            } else {
                console.warn('Failed to load sessions from API:', sessionsResponse.status);
            }
            
            // Load PKL sessions and run Kura analysis
            const response = await fetch('/api/sessions/analyze-with-kura', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    test_mode: false, // Use real data
                    include_dashboard_data: true
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to load Kura analysis: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Kura analysis response:', data);
            
            if (data.success) {
                console.log('Raw data received:', data);
                
                this.sessions = this.validateAndSanitizeSessions(data.sessions || []);
                this.clusters = data.clusters || [];
                this.umapData = data.umap_coordinates || [];
                
                console.log(`Processed ${this.sessions.length} sessions, ${this.clusters.length} clusters, ${this.umapData.length} UMAP points`);
                console.log('Sessions:', this.sessions);
                console.log('Clusters:', this.clusters);
                console.log('UMAP Data:', this.umapData);
                
                // If we have real sessions but no clusters, create basic clusters
                if (this.sessions.length > 0 && this.clusters.length === 0) {
                    console.log('Creating basic clusters...');
                    this.clusters = this.createBasicClusters();
                    console.log('Created basic clusters:', this.clusters);
                }
                
                // If we have sessions but no UMAP data, create basic coordinates
                if (this.sessions.length > 0 && this.umapData.length === 0) {
                    console.log('Creating basic UMAP data...');
                    this.umapData = this.createBasicUMAPData();
                    console.log('Created basic UMAP data:', this.umapData);
                }
                
                console.log('About to render visualizations...');
                this.renderClusterTree();
                this.renderUMAPPlot();
                this.updateStatistics();
                this.updatePatternInsights('success_patterns');
                this.updateStatusBar();
                
                // Load projects data
                await this.loadProjects();
                
                // Show empty state if no sessions
                if (this.sessions.length === 0) {
                    console.log('No sessions found, creating test data for demonstration...');
                    this.createTestData();
                    this.renderClusterTree();
                    this.renderUMAPPlot();
                    this.updateStatistics();
                    this.updatePatternInsights('success_patterns');
                    this.updateStatusBar();
                }
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load Kura analysis data: ' + error.message);
            
            // Fallback to basic session data if available
            try {
                const fallbackResponse = await fetch('/api/sessions');
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData.success && fallbackData.sessions.length > 0) {
                        this.sessions = fallbackData.sessions;
                        this.clusters = this.createBasicClusters();
                        this.umapData = this.createBasicUMAPData();
                        
                        this.renderClusterTree();
                        this.renderUMAPPlot();
                        this.updateStatistics();
                        this.updatePatternInsights('success_patterns');
                        this.updateStatusBar();
                        
                        console.log('Using fallback session data');
                        return;
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback data loading failed:', fallbackError);
            }
            
            // If no real data available, create test data for demonstration
            console.log('No real data available, creating test data for demonstration...');
            this.createTestData();
            this.renderClusterTree();
            this.renderUMAPPlot();
            this.updateStatistics();
            this.updatePatternInsights('success_patterns');
            this.updateStatusBar();
        } finally {
            this.showLoading(false);
        }
    }

    validateAndSanitizeSessions(sessions) {
        if (!Array.isArray(sessions)) {
            console.warn('Sessions data is not an array, returning empty array');
            return [];
        }

        return sessions.filter(session => {
            // Basic validation
            if (!session || typeof session !== 'object') {
                return false;
            }

            // Ensure required fields exist with defaults
            session.id = session.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            session.intent = session.intent || 'unknown';
            session.outcome = session.outcome || 'in-progress';
            session.timestamp = session.timestamp || new Date().toISOString();
            session.duration = typeof session.duration === 'number' ? session.duration : 0;
            session.confidence = typeof session.confidence === 'number' ? Math.max(0, Math.min(1, session.confidence)) : 0.5;
            session.currentFile = session.currentFile || 'unknown';
            session.summary = session.summary || `${session.intent} session on ${session.currentFile}`;
            session.codeDeltas = Array.isArray(session.codeDeltas) ? session.codeDeltas : [];
            session.fileChanges = Array.isArray(session.fileChanges) ? session.fileChanges : [];
            session.conversations = Array.isArray(session.conversations) ? session.conversations : [];
            session.prompts = Array.isArray(session.prompts) ? session.prompts : [];
            session.messages = Array.isArray(session.messages) ? session.messages : [];

            return true;
        });
    }

    renderClusterTree() {
        const container = document.getElementById('cluster-tree');
        if (!container) return;

        // Apply pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedClusters = this.clusters.slice(startIndex, endIndex);

        if (paginatedClusters.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No clusters found</p></div>';
            return;
        }

        // Create hierarchical structure for paginated clusters
        const hierarchicalClusters = this.buildHierarchy(paginatedClusters);
        
        // Render tree
        const treeHtml = this.renderClusterNode(hierarchicalClusters, 0);
        container.innerHTML = treeHtml;

        // Add event listeners
        container.querySelectorAll('.cluster-node').forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectCluster(node.dataset.clusterId);
            });
        });

        container.querySelectorAll('.cluster-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCluster(toggle.parentElement);
            });
        });
    }

    createBasicClusters() {
        return this.createClusters(this.config.clusteringMethod);
    }

    createClusters(method = 'intent-based') {
        switch (method) {
            case 'kmeans':
                return this.createKMeansClusters();
            case 'hierarchical':
                return this.createHierarchicalClusters();
            case 'dbscan':
                return this.createDBSCANClusters();
            case 'intent-based':
            default:
                return this.createIntentBasedClusters();
        }
    }

    createIntentBasedClusters() {
        // Group sessions by intent to create basic clusters
        const intentGroups = {};
        this.sessions.forEach(session => {
            const intent = session.intent || 'unknown';
            if (!intentGroups[intent]) {
                intentGroups[intent] = [];
            }
            intentGroups[intent].push(session.id);
        });

        return Object.entries(intentGroups).map(([intent, sessionIds], index) => {
            const sessionsInCluster = this.sessions.filter(s => sessionIds.includes(s.id));
            const successCount = sessionsInCluster.filter(s => s.outcome === 'success' || s.outcome === 'completed').length;
            
            return {
                id: `cluster_${intent}_${index}`,
                name: `${intent.charAt(0).toUpperCase() + intent.slice(1)} Tasks`,
                sessions: sessionIds,
                size: sessionIds.length,
                success_rate: sessionIds.length > 0 ? successCount / sessionIds.length : 0,
                avg_duration: this.calculateAverageDuration(sessionsInCluster),
                intent: intent
            };
        });
    }

    createKMeansClusters() {
        // Simple K-means clustering based on session features
        const features = this.sessions.map(session => this.extractSessionFeatures(session));
        const k = Math.min(this.config.clusterCount, this.sessions.length);
        
        if (k <= 1) {
            return [{
                id: 'cluster_all',
                name: 'All Sessions',
                size: this.sessions.length,
                sessions: this.sessions.map(s => s.id),
                success_rate: this.sessions.filter(s => s.outcome === 'success').length / this.sessions.length,
                avg_duration: this.calculateAverageDuration(this.sessions)
            }];
        }

        // Simple K-means implementation
        const centroids = this.initializeCentroids(features, k);
        const clusters = this.performKMeans(features, centroids, k);
        
        return clusters.map((clusterSessions, index) => ({
            id: `cluster_kmeans_${index}`,
            name: `Cluster ${index + 1}`,
            size: clusterSessions.length,
            sessions: clusterSessions.map(i => this.sessions[i].id),
            success_rate: clusterSessions.length > 0 ? 
                clusterSessions.filter(i => this.sessions[i].outcome === 'success').length / clusterSessions.length : 0,
            avg_duration: clusterSessions.length > 0 ? 
                this.calculateAverageDuration(clusterSessions.map(i => this.sessions[i])) : 0
        }));
    }

    createHierarchicalClusters() {
        // Hierarchical clustering based on session similarity
        const features = this.sessions.map(session => this.extractSessionFeatures(session));
        const k = Math.min(this.config.clusterCount, this.sessions.length);
        
        if (k <= 1) {
            return [{
                id: 'cluster_all',
                name: 'All Sessions',
                size: this.sessions.length,
                sessions: this.sessions.map(s => s.id),
                success_rate: this.sessions.filter(s => s.outcome === 'success').length / this.sessions.length,
                avg_duration: this.calculateAverageDuration(this.sessions)
            }];
        }

        // Simple hierarchical clustering
        const clusters = this.performHierarchicalClustering(features, k);
        
        return clusters.map((clusterSessions, index) => ({
            id: `cluster_hierarchical_${index}`,
            name: `Cluster ${index + 1}`,
            size: clusterSessions.length,
            sessions: clusterSessions.map(i => this.sessions[i].id),
            success_rate: clusterSessions.length > 0 ? 
                clusterSessions.filter(i => this.sessions[i].outcome === 'success').length / clusterSessions.length : 0,
            avg_duration: clusterSessions.length > 0 ? 
                this.calculateAverageDuration(clusterSessions.map(i => this.sessions[i])) : 0
        }));
    }

    createDBSCANClusters() {
        // DBSCAN clustering for density-based grouping
        const features = this.sessions.map(session => this.extractSessionFeatures(session));
        const clusters = this.performDBSCAN(features);
        
        return clusters.map((clusterSessions, index) => ({
            id: `cluster_dbscan_${index}`,
            name: `Cluster ${index + 1}`,
            size: clusterSessions.length,
            sessions: clusterSessions.map(i => this.sessions[i].id),
            success_rate: clusterSessions.length > 0 ? 
                clusterSessions.filter(i => this.sessions[i].outcome === 'success').length / clusterSessions.length : 0,
            avg_duration: clusterSessions.length > 0 ? 
                this.calculateAverageDuration(clusterSessions.map(i => this.sessions[i])) : 0
        }));
    }

    createBasicUMAPData() {
        // Create basic UMAP coordinates based on session characteristics
        return this.sessions.map((session, index) => {
            const intentHash = session.intent ? session.intent.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
            const outcomeHash = session.outcome ? session.outcome.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0;
            const sessionHash = (intentHash + outcomeHash + index) % 1000;
            
            return {
                session_id: session.id,
                x: Math.cos(sessionHash * 2 * Math.PI / 1000) * (0.3 + (sessionHash % 100) / 200),
                y: Math.sin(sessionHash * 2 * Math.PI / 1000) * (0.3 + (sessionHash % 100) / 200),
                intent: session.intent || 'unknown',
                outcome: session.outcome || 'in_progress',
                confidence: session.confidence || 0.5
            };
        });
    }

    createTestData() {
        console.log('Creating test data for demonstration...');
        
        // Create sample sessions
        this.sessions = [
            {
                id: 'test-session-1',
                intent: 'explore',
                outcome: 'success',
                timestamp: new Date().toISOString(),
                duration: 1200,
                confidence: 0.85,
                currentFile: 'test-notebook.ipynb',
                summary: 'Data exploration session',
                codeDeltas: [],
                fileChanges: [],
                conversations: [
                    {
                        user_message: 'How can I analyze this dataset?',
                        assistant_message: 'You can start by loading the data and examining its structure...',
                        timestamp: new Date().toISOString()
                    }
                ]
            },
            {
                id: 'test-session-2',
                intent: 'implement',
                outcome: 'in_progress',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                duration: 800,
                confidence: 0.72,
                currentFile: 'model-training.py',
                summary: 'Model implementation session',
                codeDeltas: [],
                fileChanges: [],
                conversations: [
                    {
                        user_message: 'Help me implement a neural network',
                        assistant_message: 'I\'ll help you create a neural network implementation...',
                        timestamp: new Date(Date.now() - 3600000).toISOString()
                    }
                ]
            },
            {
                id: 'test-session-3',
                intent: 'debug',
                outcome: 'success',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                duration: 600,
                confidence: 0.91,
                currentFile: 'debug-script.py',
                summary: 'Debugging session',
                codeDeltas: [],
                fileChanges: [],
                conversations: [
                    {
                        user_message: 'This code is throwing an error',
                        assistant_message: 'Let me help you debug this issue...',
                        timestamp: new Date(Date.now() - 7200000).toISOString()
                    }
                ]
            }
        ];

        // Create basic clusters
        this.clusters = this.createBasicClusters();
        
        // Create UMAP data
        this.umapData = this.createBasicUMAPData();
        
        console.log('Test data created:', {
            sessions: this.sessions.length,
            clusters: this.clusters.length,
            umapData: this.umapData.length
        });
    }

    calculateAverageDuration(sessions) {
        if (sessions.length === 0) return 0;
        const totalDuration = sessions.reduce((sum, session) => {
            return sum + (session.duration || 0);
        }, 0);
        return totalDuration / sessions.length;
    }

    // Feature extraction for clustering
    extractSessionFeatures(session) {
        const intentMap = { 'explore': 0, 'implement': 1, 'debug': 2, 'refactor': 3, 'unknown': 4 };
        const outcomeMap = { 'success': 0, 'in-progress': 1, 'stuck': 2, 'failed': 3 };
        
        return [
            intentMap[session.intent] || 4,
            outcomeMap[session.outcome] || 1,
            (session.duration || 0) / this.config.featureWeights.durationNormalization,
            (session.confidence || 0.5),
            (session.codeDeltas?.length || 0) / this.config.featureWeights.codeDeltasNormalization,
            (session.fileChanges?.length || 0) / this.config.featureWeights.fileChangesNormalization
        ];
    }

    // K-means clustering implementation
    initializeCentroids(features, k) {
        const centroids = [];
        const featureCount = features[0].length;
        
        for (let i = 0; i < k; i++) {
            const centroid = [];
            for (let j = 0; j < featureCount; j++) {
                centroid.push(Math.random());
            }
            centroids.push(centroid);
        }
        
        return centroids;
    }

    calculateDistance(point1, point2) {
        let sum = 0;
        for (let i = 0; i < point1.length; i++) {
            sum += Math.pow(point1[i] - point2[i], 2);
        }
        return Math.sqrt(sum);
    }

    performKMeans(features, centroids, k, maxIterations = 100) {
        let clusters = Array(k).fill().map(() => []);
        let iterations = 0;
        
        while (iterations < maxIterations) {
            // Assign points to clusters
            const newClusters = Array(k).fill().map(() => []);
            
            features.forEach((point, index) => {
                let minDistance = Infinity;
                let closestCentroid = 0;
                
                centroids.forEach((centroid, centroidIndex) => {
                    const distance = this.calculateDistance(point, centroid);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCentroid = centroidIndex;
                    }
                });
                
                newClusters[closestCentroid].push(index);
            });
            
            // Check for convergence
            let converged = true;
            for (let i = 0; i < k; i++) {
                if (newClusters[i].length !== clusters[i].length) {
                    converged = false;
                    break;
                }
            }
            
            clusters = newClusters;
            
            if (converged) break;
            
            // Update centroids
            centroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[clusters.indexOf(cluster)];
                
                const centroid = Array(features[0].length).fill(0);
                cluster.forEach(pointIndex => {
                    features[pointIndex].forEach((value, featureIndex) => {
                        centroid[featureIndex] += value;
                    });
                });
                
                return centroid.map(value => value / cluster.length);
            });
            
            iterations++;
        }
        
        return clusters;
    }

    // Hierarchical clustering implementation
    performHierarchicalClustering(features, k) {
        // Simple hierarchical clustering using single linkage
        const n = features.length;
        const clusters = features.map((_, index) => [index]);
        
        while (clusters.length > k) {
            let minDistance = Infinity;
            let mergeIndex1 = 0;
            let mergeIndex2 = 1;
            
            // Find closest clusters
            for (let i = 0; i < clusters.length; i++) {
                for (let j = i + 1; j < clusters.length; j++) {
                    const distance = this.calculateClusterDistance(clusters[i], clusters[j], features);
                    if (distance < minDistance) {
                        minDistance = distance;
                        mergeIndex1 = i;
                        mergeIndex2 = j;
                    }
                }
            }
            
            // Merge clusters
            clusters[mergeIndex1] = clusters[mergeIndex1].concat(clusters[mergeIndex2]);
            clusters.splice(mergeIndex2, 1);
        }
        
        return clusters;
    }

    calculateClusterDistance(cluster1, cluster2, features) {
        let minDistance = Infinity;
        
        cluster1.forEach(point1 => {
            cluster2.forEach(point2 => {
                const distance = this.calculateDistance(features[point1], features[point2]);
                if (distance < minDistance) {
                    minDistance = distance;
                }
            });
        });
        
        return minDistance;
    }

    // DBSCAN clustering implementation
    performDBSCAN(features, eps = null, minPts = null) {
        eps = eps || this.config.dbscan.eps;
        minPts = minPts || this.config.dbscan.minPts;
        const n = features.length;
        const visited = Array(n).fill(false);
        const clusters = [];
        let clusterId = 0;
        
        for (let i = 0; i < n; i++) {
            if (visited[i]) continue;
            
            visited[i] = true;
            const neighbors = this.getNeighbors(i, features, eps);
            
            if (neighbors.length < minPts) {
                // Noise point
                continue;
            }
            
            // Start new cluster
            const cluster = [i];
            let j = 0;
            
            while (j < neighbors.length) {
                const neighbor = neighbors[j];
                
                if (!visited[neighbor]) {
                    visited[neighbor] = true;
                    const neighborNeighbors = this.getNeighbors(neighbor, features, eps);
                    
                    if (neighborNeighbors.length >= minPts) {
                        neighbors.push(...neighborNeighbors);
                    }
                }
                
                if (!cluster.includes(neighbor)) {
                    cluster.push(neighbor);
                }
                
                j++;
            }
            
            clusters.push(cluster);
            clusterId++;
        }
        
        return clusters;
    }

    getNeighbors(pointIndex, features, eps) {
        const neighbors = [];
        
        features.forEach((feature, index) => {
            if (index !== pointIndex) {
                const distance = this.calculateDistance(features[pointIndex], feature);
                if (distance <= eps) {
                    neighbors.push(index);
                }
            }
        });
        
        return neighbors;
    }

    buildHierarchy(clusters = null) {
        // Build hierarchical cluster structure from real data
        const intentGroups = {};
        const sessionsToUse = clusters ? clusters.flatMap(c => c.sessions || []) : this.sessions;
        
        sessionsToUse.forEach(session => {
            const intent = session.intent || 'unknown';
            if (!intentGroups[intent]) {
                intentGroups[intent] = [];
            }
            intentGroups[intent].push(session);
        });

        const children = Object.entries(intentGroups).map(([intent, sessions]) => {
            const successCount = sessions.filter(s => s.outcome === 'success' || s.outcome === 'completed').length;
            const avgDuration = this.calculateAverageDuration(sessions);
            
            return {
                id: `cluster_${intent}`,
                name: `${intent.charAt(0).toUpperCase() + intent.slice(1)} Tasks`,
                size: sessions.length,
                success_rate: sessions.length > 0 ? successCount / sessions.length : 0,
                avg_duration: avgDuration,
                sessions: sessions.map(s => s.id)
            };
        });

        return {
            id: 'root',
            name: 'All Sessions',
            size: this.sessions.length,
            children: children
        };
    }

    renderClusterNode(node, depth) {
        const indent = '  '.repeat(depth);
        const hasChildren = node.children && node.children.length > 0;
        const icon = hasChildren ? '[DIR]' : '[FILE]';
        const toggle = hasChildren ? '[-]' : '';
        
        let html = `
            <div class="cluster-node" data-cluster-id="${node.id}" data-depth="${depth}">
                <span class="cluster-toggle">${toggle}</span>
                <span class="cluster-icon">${icon}</span>
                <span class="cluster-label">${node.name}</span>
                <span class="cluster-count">(${node.size})</span>
            </div>
        `;

        if (hasChildren) {
            html += `<div class="cluster-children" data-cluster-id="${node.id}">`;
            for (const child of node.children) {
                html += this.renderClusterNode(child, depth + 1);
            }
            html += '</div>';
        }

        return html;
    }

    renderUMAPPlot() {
        const container = document.getElementById('umap-plot');
        
        if (!container) {
            console.error('UMAP plot container not found');
            return;
        }

        // Check if Plotly is available
        if (typeof Plotly === 'undefined') {
            console.error('Plotly library not loaded');
            container.innerHTML = '<div class="error-message">Plotly library not loaded. Please refresh the page.</div>';
            return;
        }

        // Check if we have data
        if (!this.umapData || this.umapData.length === 0) {
            console.warn('No UMAP data available');
            container.innerHTML = '<div class="no-data-message">No session data available for visualization</div>';
            return;
        }

        console.log('Rendering UMAP plot with', this.umapData.length, 'data points');
        
        try {
            // Prepare data for Plotly
            const traces = this.prepareUMAPTraces();
            
            if (!traces || traces.length === 0) {
                console.warn('No traces generated for UMAP plot');
                container.innerHTML = '<div class="no-data-message">No data traces available for visualization</div>';
                return;
            }

            console.log('Generated', traces.length, 'traces for UMAP plot');
            
            const layout = {
                title: {
                    text: 'Session Relationships (UMAP Projection)',
                    font: { size: 16 }
                },
                xaxis: {
                    title: 'UMAP Dimension 1',
                    showgrid: true,
                    zeroline: false
                },
                yaxis: {
                    title: 'UMAP Dimension 2', 
                    showgrid: true,
                    zeroline: false
                },
                hovermode: 'closest',
                showlegend: true,
                legend: {
                    x: 1,
                    y: 1,
                    xanchor: 'left',
                    yanchor: 'top'
                },
                margin: this.config.visualization.plotMargins,
                dragmode: 'select'
            };

            const config = {
                displayModeBar: true,
                modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
                displaylogo: false,
                responsive: true
            };

            Plotly.newPlot(container, traces, layout, config).then(() => {
                console.log('UMAP plot rendered successfully');
                
                // Handle selection events
                container.on('plotly_selected', (eventData) => {
                    this.handleUMAPSelection(eventData);
                });

                container.on('plotly_click', (eventData) => {
                    this.handleUMAPClick(eventData);
                });

                this.umapPlot = container;
            }).catch(error => {
                console.error('Error rendering UMAP plot:', error);
                container.innerHTML = '<div class="error-message">Error rendering visualization: ' + error.message + '</div>';
            });
            
        } catch (error) {
            console.error('Error in renderUMAPPlot:', error);
            container.innerHTML = '<div class="error-message">Error preparing visualization: ' + error.message + '</div>';
        }
    }

    prepareUMAPTraces() {
        console.log('Preparing UMAP traces...');
        console.log('UMAP data:', this.umapData);
        console.log('Current color by:', this.currentColorBy);
        
        const colorMap = this.getColorMap();
        console.log('Color map:', colorMap);
        
        const groupedData = {};

        // Group data by the current color-by attribute
        this.umapData.forEach((point, index) => {
            const groupKey = point[this.currentColorBy] || 'unknown';
            console.log(`Point ${index}:`, point, 'Group key:', groupKey);
            
            if (!groupedData[groupKey]) {
                groupedData[groupKey] = {
                    x: [],
                    y: [],
                    text: [],
                    ids: [],
                    color: colorMap[groupKey] || 'var(--text-tertiary)'
                };
            }

            groupedData[groupKey].x.push(point.x);
            groupedData[groupKey].y.push(point.y);
            groupedData[groupKey].text.push(this.formatHoverText(point));
            groupedData[groupKey].ids.push(point.session_id || point.id);
        });

        console.log('Grouped data:', groupedData);

        // Create traces
        const traces = [];
        Object.entries(groupedData).forEach(([groupKey, data]) => {
            console.log(`Creating trace for group: ${groupKey}`, data);
            traces.push({
                x: data.x,
                y: data.y,
                mode: 'markers',
                type: 'scatter',
                name: groupKey,
                text: data.text,
                ids: data.ids,
                hovertemplate: '%{text}<extra></extra>',
                marker: {
                    color: data.color,
                    size: this.config.visualization.markerSize.default,
                    opacity: 0.7,
                    line: {
                        width: this.config.visualization.markerLineWidth.default,
                        color: 'white'
                    }
                }
            });
        });

        console.log('Final traces:', traces);
        return traces;
    }

    getColorMap() {
        const colorMaps = {
            intent: {
                'explore': 'var(--success-color)',
                'debug': 'var(--danger-color)', 
                'implement': 'var(--primary-color)',
                'refactor': 'var(--warning-color)'
            },
            outcome: {
                'success': 'var(--success-color)',
                'stuck': 'var(--danger-color)',
                'in-progress': 'var(--warning-color)'
            },
            file_type: {
                '.ipynb': 'var(--warning-color)',
                '.py': 'var(--primary-color)',
                '.js': 'var(--warning-color)',
                '.ts': 'var(--info-color)'
            },
            cluster: {
                'explore': 'var(--success-color)',
                'debug': 'var(--danger-color)',
                'implement': 'var(--primary-color)'
            }
        };

        return colorMaps[this.currentColorBy] || {};
    }

    formatHoverText(point) {
        const sessionId = point.session_id || point.id;
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return sessionId;

        return `
            <b>${session.id}</b><br>
            Intent: ${session.intent || 'unknown'}<br>
            Outcome: ${session.outcome || 'in_progress'}<br>
            File: ${session.currentFile || 'unknown'}<br>
            Confidence: ${((session.confidence || 0.5) * 100).toFixed(1)}%<br>
            ${session.summary || ''}
        `.trim();
    }

    updateStatistics() {
        // Update status bar
        document.getElementById('session-count').textContent = `${this.sessions.length} sessions loaded`;
        document.getElementById('cluster-count').textContent = `${this.clusters.length} clusters`;
        document.getElementById('selected-count').textContent = `${this.selectedSessions.size} selected`;
        document.getElementById('last-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;

        // Update cluster statistics
        const statsContainer = document.getElementById('cluster-stats-content');
        const stats = this.calculateStatistics();
        
        statsContainer.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Success Rate</span>
                <span class="stat-value">${(stats.successRate * 100).toFixed(1)}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Avg Duration</span>
                <span class="stat-value">${stats.avgDuration}min</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Most Common</span>
                <span class="stat-value">${stats.mostCommonIntent}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">File Types</span>
                <span class="stat-value">${stats.fileTypes}</span>
            </div>
        `;
    }

    updateStatusBar() {
        // Update status bar elements if they exist
        const sessionCountEl = document.getElementById('session-count');
        const clusterCountEl = document.getElementById('cluster-count');
        const selectedCountEl = document.getElementById('selected-count');
        const lastUpdatedEl = document.getElementById('last-updated');
        const analysisModeEl = document.getElementById('analysis-mode');

        if (sessionCountEl) {
            sessionCountEl.textContent = `${this.sessions.length} sessions loaded`;
        }
        if (clusterCountEl) {
            clusterCountEl.textContent = `${this.clusters.length} clusters`;
        }
        if (selectedCountEl) {
            selectedCountEl.textContent = `${this.selectedSessions.size} selected`;
        }
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
        }
        if (analysisModeEl) {
            analysisModeEl.textContent = 'Live Mode';
        }
    }

    calculateStatistics() {
        if (!this.sessions || this.sessions.length === 0) {
            return {
                successRate: 0,
                avgDuration: 0,
                mostCommonIntent: 'none',
                fileTypes: 0
            };
        }

        // Calculate success rate - consider multiple success indicators
        const successful = this.sessions.filter(s => 
            s.outcome === 'success' || 
            s.outcome === 'completed' || 
            s.outcome === 'SUCCESS' ||
            s.outcome === 'COMPLETED' ||
            (s.phase && s.phase === 'COMPLETED')
        ).length;
        const successRate = this.sessions.length > 0 ? successful / this.sessions.length : 0;
        
        // Calculate average duration with better logic
        const sessionsWithDuration = this.sessions.filter(s => {
            // Check if session has duration field
            if (s.duration && typeof s.duration === 'number' && s.duration > 0) {
                return true;
            }
            // Check if session has start and end times
            if (s.endTime && s.timestamp) {
                const start = new Date(s.timestamp);
                const end = new Date(s.endTime);
                return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
            }
            return false;
        });

        let totalDuration = 0;
        sessionsWithDuration.forEach(s => {
            if (s.duration && typeof s.duration === 'number') {
                // Duration is already in seconds
                totalDuration += s.duration;
            } else if (s.endTime && s.timestamp) {
                const start = new Date(s.timestamp);
                const end = new Date(s.endTime);
                totalDuration += (end.getTime() - start.getTime()) / 1000; // Convert to seconds
            }
        });
        
        const avgDuration = sessionsWithDuration.length > 0 ? 
            Math.round(totalDuration / sessionsWithDuration.length / 60) : 0; // Convert to minutes
        
        const intentCounts = {};
        const fileTypes = new Set();
        
        this.sessions.forEach(session => {
            const intent = session.intent || 'unknown';
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
            
            if (session.currentFile) {
                const ext = session.currentFile.split('.').pop()?.toLowerCase();
                if (ext && ext.length <= this.config.visualization.maxFileExtensionLength) {
                    fileTypes.add(ext);
                }
            }
            
            // Also check codeDeltas for file types
            if (session.codeDeltas) {
                session.codeDeltas.forEach(delta => {
                    if (delta.filePath) {
                        const ext = delta.filePath.split('.').pop()?.toLowerCase();
                        if (ext && ext.length <= this.config.visualization.maxFileExtensionLength) {
                            fileTypes.add(ext);
                        }
                    }
                });
            }
        });

        const mostCommonIntent = Object.entries(intentCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

        return {
            successRate,
            avgDuration,
            mostCommonIntent,
            fileTypes: fileTypes.size
        };
    }

    updatePatternInsights(type) {
        const container = document.getElementById('pattern-insights');
        
        const insights = this.generateInsights(type);
        
        container.innerHTML = insights.map(insight => `
            <div class="insight-card">
                <div class="insight-title">${insight.title}</div>
                <div class="insight-description">${insight.description}</div>
                <div class="insight-metrics">
                    ${insight.metrics.map(metric => `
                        <div class="metric">
                            <div class="metric-value">${metric.value}</div>
                            <div class="metric-label">${metric.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    generateInsights(type) {
        if (this.sessions.length === 0) {
            return [{
                title: 'No Data Available',
                description: 'No sessions found. Start using Cursor IDE to see insights.',
                metrics: [
                    { value: '0', label: 'Sessions' },
                    { value: '0%', label: 'Success Rate' },
                    { value: '0min', label: 'Avg Duration' }
                ]
            }];
        }

        switch (type) {
            case 'success_patterns':
                return this.generateSuccessPatterns();
            case 'failure_patterns':
                return this.generateFailurePatterns();
            case 'temporal_patterns':
                return this.generateTemporalPatterns();
            case 'file_patterns':
                return this.generateFilePatterns();
            default:
                return this.generateSuccessPatterns();
        }
    }

    generateSuccessPatterns() {
        const insights = [];
        
        // Calculate overall statistics
        const totalSessions = this.sessions.length;
        const successfulSessions = this.sessions.filter(s => 
            s.outcome === 'success' || 
            s.outcome === 'completed' || 
            s.outcome === 'SUCCESS' ||
            s.outcome === 'COMPLETED' ||
            (s.phase && s.phase === 'COMPLETED')
        );
        
        const overallSuccessRate = totalSessions > 0 ? (successfulSessions.length / totalSessions) : 0;
        
        // Find the most successful intent
        const intentStats = {};
        this.sessions.forEach(session => {
            const intent = session.intent || 'unknown';
            if (!intentStats[intent]) {
                intentStats[intent] = { total: 0, successful: 0, durations: [] };
            }
            intentStats[intent].total++;
            if (session.outcome === 'success' || 
                session.outcome === 'completed' || 
                session.outcome === 'SUCCESS' ||
                session.outcome === 'COMPLETED' ||
                (session.phase && session.phase === 'COMPLETED')) {
                intentStats[intent].successful++;
            }
            if (session.duration) {
                intentStats[intent].durations.push(session.duration);
            }
        });

        // Always provide overall insights first
        insights.push({
            title: 'Overall Performance',
            description: `Analysis of ${totalSessions} sessions across all intents`,
            metrics: [
                { value: `${(overallSuccessRate * 100).toFixed(1)}%`, label: 'Success Rate' },
                { value: totalSessions.toString(), label: 'Total Sessions' },
                { value: successfulSessions.length.toString(), label: 'Successful' }
            ]
        });

        // Find the intent with highest success rate
        let bestIntent = null;
        let bestSuccessRate = 0;
        
        Object.entries(intentStats).forEach(([intent, stats]) => {
            const successRate = stats.total > 0 ? stats.successful / stats.total : 0;
            if (successRate > bestSuccessRate && stats.total >= this.config.thresholds.minSessionsForPattern) {
                bestSuccessRate = successRate;
                bestIntent = intent;
            }
        });

        if (bestIntent && intentStats[bestIntent]) {
            const stats = intentStats[bestIntent];
            const avgDuration = stats.durations.length > 0 ? 
                Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length / 60) : 0;
            
            insights.push({
                title: 'Best Performing Intent',
                description: `${bestIntent.charAt(0).toUpperCase() + bestIntent.slice(1)} tasks show highest success rate`,
                metrics: [
                    { value: `${(bestSuccessRate * 100).toFixed(1)}%`, label: 'Success Rate' },
                    { value: stats.total.toString(), label: 'Sessions' },
                    { value: `${avgDuration}min`, label: 'Avg Duration' }
                ]
            });
        }

        // Find the most efficient sessions (shortest duration with success)
        if (successfulSessions.length > 0) {
            const avgSuccessfulDuration = successfulSessions.reduce((sum, s) => {
                if (s.duration) {
                    return sum + s.duration;
                } else if (s.endTime && s.timestamp) {
                    const start = new Date(s.timestamp);
                    const end = new Date(s.endTime);
                    return sum + (end.getTime() - start.getTime()) / 1000;
                }
                return sum;
            }, 0) / successfulSessions.length;
            
            insights.push({
                title: 'Efficiency Insights',
                description: 'Successful sessions show consistent patterns',
                metrics: [
                    { value: `${(successfulSessions.length / this.sessions.length * 100).toFixed(1)}%`, label: 'Success Rate' },
                    { value: successfulSessions.length.toString(), label: 'Successful' },
                    { value: `${Math.round(avgSuccessfulDuration / 60)}min`, label: 'Avg Duration' }
                ]
            });
        }

        // If we have very few sessions, provide encouraging insights
        if (totalSessions < this.config.thresholds.minSessionsForInsight) {
            insights.push({
                title: 'Getting Started',
                description: 'Continue using Cursor IDE to build more comprehensive patterns',
                metrics: [
                    { value: `${totalSessions}`, label: 'Sessions Tracked' },
                    { value: 'Growing', label: 'Data Collection' },
                    { value: 'Active', label: 'Monitoring' }
                ]
            });
        }

        return insights;
    }

    generateFailurePatterns() {
        const stuckSessions = this.sessions.filter(s => s.outcome === 'stuck' || s.outcome === 'failed');
        
        if (stuckSessions.length === 0) {
            return [{
                title: 'No Failure Patterns',
                description: 'No stuck or failed sessions found',
                metrics: [
                    { value: '0%', label: 'Stuck Rate' },
                    { value: '0', label: 'Sessions' },
                    { value: '0min', label: 'Avg Duration' }
                ]
            }];
        }

        const avgStuckDuration = stuckSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / stuckSessions.length;
        
        return [{
            title: 'Debugging Challenges',
            description: 'Some sessions encounter difficulties',
            metrics: [
                { value: `${(stuckSessions.length / this.sessions.length * 100).toFixed(0)}%`, label: 'Stuck Rate' },
                { value: stuckSessions.length.toString(), label: 'Sessions' },
                { value: `${Math.round(avgStuckDuration)}min`, label: 'Avg Duration' }
            ]
        }];
    }

    generateTemporalPatterns() {
        // Group sessions by hour of day
        const hourlyStats = {};
        this.sessions.forEach(session => {
            const hour = new Date(session.timestamp).getHours();
            if (!hourlyStats[hour]) {
                hourlyStats[hour] = { count: 0, successful: 0 };
            }
            hourlyStats[hour].count++;
            if (session.outcome === 'success' || session.outcome === 'completed') {
                hourlyStats[hour].successful++;
            }
        });

        // Find peak hour
        let peakHour = null;
        let maxSessions = 0;
        Object.entries(hourlyStats).forEach(([hour, stats]) => {
            if (stats.count > maxSessions) {
                maxSessions = stats.count;
                peakHour = hour;
            }
        });

        if (peakHour && hourlyStats[peakHour]) {
            const stats = hourlyStats[peakHour];
            const successRate = stats.count > 0 ? stats.successful / stats.count : 0;
            
            return [{
                title: 'Peak Activity Hours',
                description: `Most sessions occur around ${peakHour}:00`,
                metrics: [
                    { value: `${peakHour}:00`, label: 'Peak Hour' },
                    { value: stats.count.toString(), label: 'Sessions' },
                    { value: `${(successRate * 100).toFixed(0)}%`, label: 'Success Rate' }
                ]
            }];
        }

        return [{
            title: 'No Temporal Patterns',
            description: 'Insufficient data to identify temporal patterns',
            metrics: [
                { value: 'N/A', label: 'Peak Hour' },
                { value: '0', label: 'Sessions' },
                { value: '0%', label: 'Success Rate' }
            ]
        }];
    }

    generateFilePatterns() {
        const fileTypeStats = {};
        this.sessions.forEach(session => {
            if (session.currentFile) {
                const ext = session.currentFile.split('.').pop() || 'unknown';
                if (!fileTypeStats[ext]) {
                    fileTypeStats[ext] = 0;
                }
                fileTypeStats[ext]++;
            }
        });

        const totalFiles = Object.values(fileTypeStats).reduce((sum, count) => sum + count, 0);
        
        if (totalFiles === 0) {
            return [{
                title: 'No File Patterns',
                description: 'No file type data available',
                metrics: [
                    { value: '0%', label: 'Python Files' },
                    { value: '0%', label: 'Jupyter Notebooks' },
                    { value: '0%', label: 'Other' }
                ]
            }];
        }

        const pythonCount = fileTypeStats['py'] || 0;
        const notebookCount = fileTypeStats['ipynb'] || 0;
        const otherCount = totalFiles - pythonCount - notebookCount;

        return [{
            title: 'File Type Distribution',
            description: 'Distribution of file types in sessions',
            metrics: [
                { value: `${(pythonCount / totalFiles * 100).toFixed(0)}%`, label: 'Python Files' },
                { value: `${(notebookCount / totalFiles * 100).toFixed(0)}%`, label: 'Jupyter Notebooks' },
                { value: `${(otherCount / totalFiles * 100).toFixed(0)}%`, label: 'Other' }
            ]
        }];
    }

    // Event Handlers
    selectCluster(clusterId) {
        // Update UI selection
        document.querySelectorAll('.cluster-node').forEach(node => {
            node.classList.remove('selected');
        });
        
        const selectedNode = document.querySelector(`[data-cluster-id="${clusterId}"]`);
        if (selectedNode) {
            selectedNode.classList.add('selected');
        }

        // Update selected sessions
        const cluster = this.clusters.find(c => c.id === clusterId);
        if (cluster) {
            this.selectedSessions.clear();
            cluster.sessions.forEach(sessionId => {
                this.selectedSessions.add(sessionId);
            });
            this.updateStatistics();
            this.highlightSelectedSessions();
        }
    }

    toggleCluster(node) {
        const children = node.nextElementSibling;
        const toggle = node.querySelector('.cluster-toggle');
        
        if (children && children.classList.contains('cluster-children')) {
            const isExpanded = !children.classList.contains('hidden');
            if (isExpanded) {
                children.classList.add('hidden');
                toggle.textContent = '>';
            } else {
                children.classList.remove('hidden');
                toggle.textContent = '[-]';
            }
        }
    }

    handleUMAPSelection(eventData) {
        if (!eventData || !eventData.points) return;

        this.selectedSessions.clear();
        eventData.points.forEach(point => {
            this.selectedSessions.add(point.id);
        });

        this.updateStatistics();
        this.showSelectionInfo(eventData.points);
    }

    handleUMAPClick(eventData) {
        if (!eventData || !eventData.points || eventData.points.length === 0) return;

        const sessionId = eventData.points[0].id;
        this.showSessionDetails(sessionId);
    }

    showSessionDetails(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) {
            console.warn(`Session ${sessionId} not found`);
            return;
        }

        const container = document.getElementById('session-details');
        if (!container) {
            console.warn('Session details container not found');
            return;
        }

        // Get prompt information from various possible sources
        const prompts = session.prompts || session.conversations || session.messages || [];
        const codeChanges = session.codeDeltas ? session.codeDeltas.length : 0;
        const fileChanges = session.fileChanges ? session.fileChanges.length : 0;
        const totalChanges = codeChanges + fileChanges;
        const duration = this.formatDuration(session.duration);
        const confidence = session.confidence ? Math.round(session.confidence * 100) : 0;
        const filePath = session.currentFile || 'Unknown';
        const fileName = filePath.split('/').pop();

        container.innerHTML = `
            <div class="session-details-card">
                <div class="session-details-header">
                    <div class="session-title">
                        <h3>Session: ${session.intent ? session.intent.replace(/_/g, ' ') : 'Unknown Intent'}</h3>
                        <span class="session-id">${session.id}</span>
                    </div>
                    <div class="session-status-badge">
                        <span class="status-badge status-${session.outcome || 'IN_PROGRESS'}">${session.outcome || 'IN_PROGRESS'}</span>
                    </div>
                </div>

                <div class="session-overview-grid">
                    <div class="overview-item">
                        <div class="overview-label">Confidence</div>
                        <div class="overview-value">${confidence}%</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-label">Duration</div>
                        <div class="overview-value">${duration}</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-label">Total Changes</div>
                        <div class="overview-value">${totalChanges}</div>
                    </div>
                    <div class="overview-item">
                        <div class="overview-label">Prompts</div>
                        <div class="overview-value">${prompts.length}</div>
                    </div>
                </div>

                <div class="session-file-section">
                    <h4>File Information</h4>
                    <div class="file-detail">
                        <span class="file-icon">📄</span>
                        <div class="file-info">
                            <div class="file-name">${fileName}</div>
                            <div class="file-path">${filePath}</div>
                        </div>
                    </div>
                </div>

                ${prompts.length > 0 ? `
                <div class="session-prompts-section">
                    <h4>Prompts & Conversations (${prompts.length})</h4>
                    <div class="prompts-list">
                        ${prompts.slice(0, 5).map((prompt, index) => this.renderPromptItem(prompt, index)).join('')}
                        ${prompts.length > 5 ? `<div class="more-prompts">+${prompts.length - 5} more prompts</div>` : ''}
                    </div>
                </div>
                ` : ''}

                ${session.codeDeltas && session.codeDeltas.length > 0 ? `
                <div class="session-changes-section">
                    <h4>Code Changes (${session.codeDeltas.length})</h4>
                    <div class="changes-list">
                        ${session.codeDeltas.slice(0, 3).map((delta, index) => `
                            <div class="change-item">
                                <div class="change-header">
                                    <span class="change-type">${delta.type || 'modification'}</span>
                                    <span class="change-time">${this.formatTimestamp(delta.timestamp)}</span>
                                </div>
                                <div class="change-content">
                                    <pre class="code-preview">${this.truncateCode(delta.content || delta.after || '', 150)}</pre>
                                </div>
                            </div>
                        `).join('')}
                        ${session.codeDeltas.length > 3 ? `<div class="more-changes">+${session.codeDeltas.length - 3} more changes</div>` : ''}
                    </div>
                </div>
                ` : ''}

                <div class="session-timeline-section">
                    <h4>Session Timeline</h4>
                    <div class="timeline">
                        <div class="timeline-item">
                            <div class="timeline-marker start"></div>
                            <div class="timeline-content">
                                <div class="timeline-title">Session Started</div>
                                <div class="timeline-time">${this.formatTimestamp(session.timestamp)}</div>
                            </div>
                        </div>
                        ${session.lastActivity ? `
                        <div class="timeline-item">
                            <div class="timeline-marker activity"></div>
                            <div class="timeline-content">
                                <div class="timeline-title">Last Activity</div>
                                <div class="timeline-time">${this.formatTimestamp(session.lastActivity)}</div>
                            </div>
                        </div>
                        ` : ''}
                        <div class="timeline-item">
                            <div class="timeline-marker end"></div>
                            <div class="timeline-content">
                                <div class="timeline-title">Session Duration</div>
                                <div class="timeline-time">${duration}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="session-summary-section">
                    <h4>Summary</h4>
                    <div class="summary-content">
                        ${session.summary || this.generateSessionSummary(session)}
                    </div>
                </div>
            </div>
        `;
    }

    renderPromptItem(prompt, index) {
        // Handle different prompt data formats
        let promptText = '';
        let responseText = '';
        let timestamp = '';
        let promptType = 'user';

        if (typeof prompt === 'string') {
            promptText = prompt;
        } else if (prompt.prompt || prompt.user_message || prompt.user_input) {
            promptText = prompt.prompt || prompt.user_message || prompt.user_input || '';
            responseText = prompt.response || prompt.assistant_message || prompt.assistant_response || '';
            timestamp = prompt.timestamp || prompt.time || '';
            promptType = prompt.type || 'user';
        } else if (prompt.content) {
            promptText = prompt.content;
            timestamp = prompt.timestamp || prompt.time || '';
        } else if (prompt.message) {
            promptText = prompt.message;
            timestamp = prompt.timestamp || prompt.time || '';
        }

        return `
            <div class="prompt-item">
                <div class="prompt-header">
                    <span class="prompt-type">${promptType}</span>
                    <span class="prompt-time">${this.formatTimestamp(timestamp)}</span>
                </div>
                <div class="prompt-content">
                    <div class="prompt-text">${this.truncateText(promptText, 200)}</div>
                    ${responseText ? `<div class="response-text">${this.truncateText(responseText, 150)}</div>` : ''}
                </div>
            </div>
        `;
    }

    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0s';
        
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

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return `${diffDays}d ago`;
        } else if (diffHours > 0) {
            return `${diffHours}h ago`;
        } else {
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            return diffMinutes > 0 ? `${diffMinutes}m ago` : 'Just now';
        }
    }

    truncateCode(code, maxLength) {
        if (!code || code.length <= maxLength) return code;
        return code.substring(0, maxLength) + '...';
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    generateSessionSummary(session) {
        const intent = session.intent ? session.intent.replace(/_/g, ' ') : 'unknown';
        const fileName = session.currentFile ? session.currentFile.split('/').pop() : 'unknown file';
        const changes = (session.codeDeltas ? session.codeDeltas.length : 0) + (session.fileChanges ? session.fileChanges.length : 0);
        const prompts = session.prompts ? session.prompts.length : 0;
        
        if (changes > 0 && prompts > 0) {
            return `${intent} session on ${fileName} with ${prompts} prompts and ${changes} changes`;
        } else if (changes > 0) {
            return `${intent} session on ${fileName} with ${changes} changes`;
        } else if (prompts > 0) {
            return `${intent} session on ${fileName} with ${prompts} prompts`;
        } else {
            return `${intent} session on ${fileName}`;
        }
    }

    loadUserSettings() {
        const savedSettings = localStorage.getItem('pkl-dashboard-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.applySettings(settings);
        }
    }

    applySettings(settings) {
        // Apply items per page
        if (settings.itemsPerPage) {
            this.itemsPerPage = parseInt(settings.itemsPerPage);
        }
        
        // Apply default view
        if (settings.defaultView && settings.defaultView !== this.currentView) {
            this.currentView = settings.defaultView;
            this.updateViewToggle();
        }
        
        // Apply color scheme
        if (settings.defaultColorScheme) {
            this.currentColorBy = settings.defaultColorScheme;
            const colorSelect = document.getElementById('color-by-select');
            if (colorSelect) {
                colorSelect.value = settings.defaultColorScheme;
            }
        }
        
        // Apply other settings as needed
        this.settings = settings;
    }

    renderConversations(session) {
        // Check for conversation data in various possible formats
        const conversations = session.conversations || session.prompts || session.messages || [];
        
        if (!conversations || conversations.length === 0) {
            return '';
        }

        return `
            <div class="conversation-section">
                <h4 class="conversation-title">Conversation History</h4>
                <div class="conversation-list">
                    ${conversations.map((conv, index) => this.renderConversationItem(conv, index)).join('')}
                </div>
            </div>
        `;
    }

    renderConversationItem(conversation, index) {
        // Handle different conversation data formats
        let userMessage = '';
        let assistantMessage = '';
        let timestamp = '';

        if (typeof conversation === 'string') {
            // Simple string format
            userMessage = conversation;
        } else if (conversation.user_message || conversation.user_input || conversation.prompt) {
            // Structured format with user message
            userMessage = conversation.user_message || conversation.user_input || conversation.prompt || '';
            assistantMessage = conversation.assistant_message || conversation.assistant_response || conversation.response || '';
            timestamp = conversation.timestamp || conversation.time || '';
        } else if (conversation.message) {
            // Single message format
            userMessage = conversation.message;
            timestamp = conversation.timestamp || conversation.time || '';
        } else if (conversation.content) {
            // Content-based format
            userMessage = conversation.content;
            timestamp = conversation.timestamp || conversation.time || '';
        }

        if (!userMessage && !assistantMessage) {
            return '';
        }

        return `
            <div class="conversation-item" data-index="${index}">
                ${timestamp ? `<div class="conversation-timestamp">${new Date(timestamp).toLocaleString()}</div>` : ''}
                ${userMessage ? `
                    <div class="conversation-user">
                        <div class="conversation-label">User:</div>
                        <div class="conversation-content">${this.formatConversationText(userMessage)}</div>
                    </div>
                ` : ''}
                ${assistantMessage ? `
                    <div class="conversation-assistant">
                        <div class="conversation-label">Assistant:</div>
                        <div class="conversation-content">${this.formatConversationText(assistantMessage)}</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatConversationText(text) {
        if (!text) return '';
        
        // Handle different text formats
        let formattedText = text;
        
        // If it's an array, join it
        if (Array.isArray(text)) {
            formattedText = text.join('\n');
        }
        
        // Convert to string if it's not already
        formattedText = String(formattedText);
        
        // Escape HTML and preserve line breaks
        formattedText = formattedText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
        
        // Truncate very long messages
        if (formattedText.length > 1000) {
            formattedText = formattedText.substring(0, 1000) + '... <span class="conversation-truncated">(truncated)</span>';
        }
        
        return formattedText;
    }

    showSelectionInfo(points) {
        const container = document.getElementById('selection-content');
        if (!container) {
            console.warn('Selection content container not found');
            return;
        }

        if (!points || points.length === 0) {
            container.innerHTML = '<p>No sessions selected</p>';
            return;
        }

        container.innerHTML = `
            <p><strong>${points.length} sessions selected</strong></p>
            <ul>
                <div id="selection-preview">
                    ${points.slice(0, this.config.visualization.maxDisplayItems).map(point => `
                        <li>${point.id} (${point.data.name || 'Unknown'})</li>
                    `).join('')}
                </div>
                <div id="selection-full" style="display: none;">
                    ${points.map(point => `
                        <li>${point.id} (${point.data.name || 'Unknown'})</li>
                    `).join('')}
                </div>
                ${points.length > this.config.visualization.maxDisplayItems ? `
                    <li class="expandable-link" onclick="toggleSelectionItems()" style="cursor: pointer; color: var(--primary-color); text-decoration: underline;">
                        ... and ${points.length - this.config.visualization.maxDisplayItems} more
                    </li>
                ` : ''}
            </ul>
        `;
    }

    showEmptyState() {
        const sessionDetailsContainer = document.getElementById('session-details');
        const selectionContainer = document.getElementById('selection-content');
        
        if (sessionDetailsContainer) {
            sessionDetailsContainer.innerHTML = `
                <div class="empty-state">
                    <p>No sessions available</p>
                    <p>Click "Refresh Data" to load sessions</p>
                </div>
            `;
        }
        
        if (selectionContainer) {
            selectionContainer.innerHTML = '<p>No sessions selected</p>';
        }
    }

    // View switching methods
    async switchView(viewType) {
        this.currentView = viewType;
        this.currentPage = 1;
        
        // Update button states
        const clustersBtn = document.getElementById('clusters-view-btn');
        const projectsBtn = document.getElementById('projects-view-btn');
        
        if (clustersBtn && projectsBtn) {
            clustersBtn.classList.toggle('active', viewType === 'clusters');
            projectsBtn.classList.toggle('active', viewType === 'projects');
        }
        
        // Show/hide appropriate containers
        const clusterTree = document.getElementById('cluster-tree');
        const projectsTree = document.getElementById('projects-tree');
        
        if (clusterTree && projectsTree) {
            if (viewType === 'clusters') {
                clusterTree.style.display = 'block';
                projectsTree.style.display = 'none';
                this.renderClusterTree();
            } else {
                clusterTree.style.display = 'none';
                projectsTree.style.display = 'block';
                this.renderProjectsTree();
            }
        }
        
        this.updatePagination();
    }

    // Project management methods
    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.projects = data.projects || [];
                    console.log(`Loaded ${this.projects.length} projects`);
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = [];
        }
    }

    renderProjectsTree() {
        const container = document.getElementById('projects-list');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No projects found</p></div>';
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedProjects = this.projects.slice(startIndex, endIndex);

        container.innerHTML = paginatedProjects.map(project => `
            <div class="project-node" data-project-id="${project.id}">
                <div class="project-header">
                    <span class="project-name">${project.name}</span>
                    <span class="project-count">${project.sessions.length}</span>
                </div>
                <div class="project-stats">
                    ${project.category} • ${Math.round(project.stats.totalDuration / 3600)}h total
                </div>
            </div>
        `).join('');

        // Add event listeners
        container.querySelectorAll('.project-node').forEach(node => {
            node.addEventListener('click', (e) => {
                e.stopPropagation();
                const projectId = node.dataset.projectId;
                this.selectProject(projectId);
            });
        });
    }

    async selectProject(projectId) {
        this.selectedProject = projectId;
        
        // Update selection
        document.querySelectorAll('.project-node').forEach(node => {
            node.classList.toggle('selected', node.dataset.projectId === projectId);
        });

        try {
            // Load project sessions
            const response = await fetch(`/api/projects/${projectId}/sessions`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Filter UMAP data to show only project sessions
                    const projectSessionIds = new Set(data.sessions.map(s => s.id));
                    this.filterUMAPByProject(projectSessionIds);
                    
                    // Update statistics
                    this.updateProjectStatistics(data.sessions);
                }
            }
        } catch (error) {
            console.error('Error loading project sessions:', error);
        }
    }

    filterUMAPByProject(sessionIds) {
        // Update UMAP plot to highlight project sessions
        if (this.umapPlot) {
            const filteredData = this.umapData.filter(point => sessionIds.has(point.id));
            this.renderUMAPPlot(filteredData);
        }
    }

    updateProjectStatistics(sessions) {
        const container = document.getElementById('cluster-stats-content');
        if (!container) return;

        const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
        const intentCounts = {};
        const outcomeCounts = {};

        sessions.forEach(session => {
            intentCounts[session.intent] = (intentCounts[session.intent] || 0) + 1;
            outcomeCounts[session.outcome] = (outcomeCounts[session.outcome] || 0) + 1;
        });

        container.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">Sessions</div>
                <div class="stat-value">${sessions.length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Duration</div>
                <div class="stat-value">${Math.round(totalDuration / 3600)}h</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Top Intent</div>
                <div class="stat-value">${Object.keys(intentCounts).reduce((a, b) => intentCounts[a] > intentCounts[b] ? a : b, 'unknown')}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Success Rate</div>
                <div class="stat-value">${Math.round((outcomeCounts.successful || 0) / sessions.length * 100)}%</div>
            </div>
        `;
    }

    // Pagination methods
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateCurrentView();
            this.updatePagination();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.getTotalItems() / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateCurrentView();
            this.updatePagination();
        }
    }

    updateCurrentView() {
        if (this.currentView === 'clusters') {
            this.renderClusterTree();
        } else {
            this.renderProjectsTree();
        }
    }

    updatePagination() {
        const totalItems = this.getTotalItems();
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        const pageInfo = document.getElementById('page-info');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }
    }

    getTotalItems() {
        return this.currentView === 'clusters' ? this.clusters.length : this.projects.length;
    }

    // Modal Functions
    showNotebookModal() {
        const modal = document.getElementById('notebook-modal');
        modal.classList.add('active');
    }

    showProcedureModal() {
        const modal = document.getElementById('procedure-modal');
        const sessionsList = document.getElementById('selected-sessions-list');
        
        // Populate selected sessions
        sessionsList.innerHTML = Array.from(this.selectedSessions).map(sessionId => {
            const session = this.sessions.find(s => s.id === sessionId);
            return `<div class="selected-session-item">${sessionId}: ${session?.summary || 'No summary'}</div>`;
        }).join('') || '<div class="selected-session-item">No sessions selected</div>';
        
        modal.classList.add('active');
    }

    showInfoModal() {
        const modal = document.getElementById('info-modal');
        modal.classList.add('active');
    }

    // Utility Functions
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        } else {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        alert('Error: ' + message);
    }

    performSearch() {
        const query = document.getElementById('global-search').value.toLowerCase();
        if (!query) return;

        // Filter sessions based on search query
        const filteredSessions = this.sessions.filter(session => 
            session.id.toLowerCase().includes(query) ||
            session.intent.toLowerCase().includes(query) ||
            session.currentFile.toLowerCase().includes(query) ||
            (session.summary && session.summary.toLowerCase().includes(query))
        );

        // Update UI to show filtered results
        this.selectedSessions.clear();
        filteredSessions.forEach(session => {
            this.selectedSessions.add(session.id);
        });

        this.updateStatistics();
        this.highlightSelectedSessions();
    }

    highlightSelectedSessions() {
        // Update UMAP plot to highlight selected sessions
        if (this.umapPlot) {
            const update = {
                'marker.size': this.umapData.map(point => 
                    this.selectedSessions.has(point.id) ? 
                        this.config.visualization.markerSize.selected : 
                        this.config.visualization.markerSize.default
                ),
                'marker.line.width': this.umapData.map(point =>
                    this.selectedSessions.has(point.id) ? 
                        this.config.visualization.markerLineWidth.selected : 
                        this.config.visualization.markerLineWidth.default
                )
            };

            Plotly.restyle(this.umapPlot, update);
        }
    }

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    document.getElementById('global-search').focus();
                    break;
                case 'r':
                    e.preventDefault();
                    this.loadData();
                    break;
                case 'e':
                    e.preventDefault();
                    this.exportData();
                    break;
            }
        }
    }

    // Additional methods would go here...
    updateUMAPColors() {
        this.renderUMAPPlot();
    }

    resetUMAPZoom() {
        if (this.umapPlot) {
            Plotly.relayout(this.umapPlot, {
                'xaxis.autorange': true,
                'yaxis.autorange': true
            });
        }
    }

    toggleFullscreen() {
        const container = document.getElementById('umap-plot');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }

    expandAllClusters() {
        document.querySelectorAll('.cluster-children').forEach(children => {
            children.classList.remove('hidden');
        });
        document.querySelectorAll('.cluster-toggle').forEach(toggle => {
            toggle.textContent = '[-]';
        });
    }

    collapseAllClusters() {
        document.querySelectorAll('.cluster-children').forEach(children => {
            children.classList.add('hidden');
        });
        document.querySelectorAll('.cluster-toggle').forEach(toggle => {
            toggle.textContent = '>';
        });
    }

    closeSessionDetails() {
        document.getElementById('session-details').innerHTML = '<p>Select a session to view details</p>';
    }

    exportData() {
        // Export current analysis data
        const data = {
            sessions: this.sessions,
            clusters: this.clusters,
            umapData: this.umapData,
            selectedSessions: Array.from(this.selectedSessions),
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kura-analysis-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    exportSelectedCluster() {
        // Export selected cluster data
        console.log('Exporting selected cluster...');
    }

    shareInsights() {
        // Generate shareable URL with current state
        const state = {
            colorBy: this.currentColorBy,
            selectedSessions: Array.from(this.selectedSessions),
            config: this.config
        };
        
        const url = new URL(window.location);
        url.hash = btoa(JSON.stringify(state));
        
        navigator.clipboard.writeText(url.toString()).then(() => {
            alert('Shareable URL copied to clipboard!');
        });
    }

    // New enhanced quick action methods
    recomputeClusters() {
        this.showLoading(true);
        
        try {
            // Recompute clusters with new configuration
            this.clusters = this.createClusters(this.config.clusteringMethod);
            
            // Update UMAP data with new parameters
            this.umapData = this.createEnhancedUMAPData();
            
            // Re-render visualizations
            this.renderClusterTree();
            this.renderUMAPPlot();
            this.updateStatistics();
            this.updatePatternInsights('success_patterns');
            this.updateStatusBar();
            
            console.log('Clusters recomputed successfully');
        } catch (error) {
            console.error('Error recomputing clusters:', error);
            this.showError('Failed to recompute clusters: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    generateAnalysisNotebook() {
        const selectedSessions = Array.from(this.selectedSessions);
        if (selectedSessions.length === 0) {
            alert('Please select sessions first by clicking on them in the UMAP plot or cluster tree.');
            return;
        }

        const notebookData = {
            title: `Session Analysis - ${new Date().toLocaleDateString()}`,
            sessions: selectedSessions.map(id => this.sessions.find(s => s.id === id)).filter(Boolean),
            clusters: this.clusters,
            config: this.config,
            analysis: this.generateSessionAnalysis(selectedSessions)
        };

        // Create and download notebook
        const notebookContent = this.createJupyterNotebook(notebookData);
        const blob = new Blob([notebookContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-analysis-${new Date().toISOString().slice(0, 10)}.ipynb`;
        a.click();
        URL.revokeObjectURL(url);
    }

    analyzePatterns() {
        try {
            const patterns = this.identifyPatterns();
            const insights = this.generatePatternInsights(patterns);
            
            // Update pattern insights display
            const insightsContainer = document.getElementById('pattern-insights');
            if (insightsContainer) {
                insightsContainer.innerHTML = `
                    <div class="insight-section">
                        <h4>Pattern Analysis Results</h4>
                        <div class="insight-metrics">
                            <div class="insight-metric">
                                <div class="insight-metric-label">Success Patterns</div>
                                <div class="insight-metric-value">${patterns?.successPatterns?.length || 0}</div>
                            </div>
                            <div class="insight-metric">
                                <div class="insight-metric-label">Efficiency Patterns</div>
                                <div class="insight-metric-value">${patterns?.efficiencyPatterns?.length || 0}</div>
                            </div>
                            <div class="insight-metric">
                                <div class="insight-metric-label">Risk Patterns</div>
                                <div class="insight-metric-value">${patterns?.riskPatterns?.length || 0}</div>
                            </div>
                        </div>
                        <div class="insight-list">
                            ${insights.map(insight => `<li>${insight}</li>`).join('')}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error in analyzePatterns:', error);
            const insightsContainer = document.getElementById('pattern-insights');
            if (insightsContainer) {
                insightsContainer.innerHTML = `
                    <div class="insight-section">
                        <h4>Pattern Analysis Error</h4>
                        <p>Unable to analyze patterns at this time. Please try again later.</p>
                    </div>
                `;
            }
        }
    }

    exportUMAPData() {
        const umapExport = {
            sessions: this.sessions,
            umapData: this.umapData,
            clusters: this.clusters,
            config: this.config,
            exportTime: new Date().toISOString(),
            metadata: {
                totalSessions: this.sessions.length,
                clusterCount: this.clusters.length,
                selectedSessions: Array.from(this.selectedSessions)
            }
        };

        const blob = new Blob([JSON.stringify(umapExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `umap-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Enhanced UMAP data creation
    createEnhancedUMAPData() {
        if (this.sessions.length === 0) return [];
        
        // Use configuration parameters for better UMAP projection
        const features = this.sessions.map(session => this.extractSessionFeatures(session));
        
        // Simple UMAP-like projection using t-SNE approximation
        return this.performTSNEProjection(features, this.config.umapNeighbors, this.config.umapMinDist);
    }

    performTSNEProjection(features, perplexity = null, learningRate = null) {
        // Simplified t-SNE-like projection for UMAP visualization
        perplexity = perplexity || this.config.tsne.perplexity;
        learningRate = learningRate || this.config.tsne.learningRate;
        
        const n = features.length;
        const result = [];
        
        // Initialize with random positions
        for (let i = 0; i < n; i++) {
            result.push({
                session_id: this.sessions[i].id,
                x: (Math.random() - 0.5) * this.config.tsne.initialScale,
                y: (Math.random() - 0.5) * this.config.tsne.initialScale,
                intent: this.sessions[i].intent || 'unknown',
                outcome: this.sessions[i].outcome || 'in-progress',
                confidence: this.sessions[i].confidence || 0.5
            });
        }
        
        // Simple optimization to separate similar points
        for (let iter = 0; iter < this.config.tsne.maxIterations; iter++) {
            for (let i = 0; i < n; i++) {
                let forceX = 0, forceY = 0;
                
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    
                    const dx = result[i].x - result[j].x;
                    const dy = result[i].y - result[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        const featureDistance = this.calculateDistance(features[i], features[j]);
                        const attraction = featureDistance < 0.5 ? -0.01 : 0.01;
                        
                        forceX += (dx / distance) * attraction;
                        forceY += (dy / distance) * attraction;
                    }
                }
                
                result[i].x += forceX * learningRate;
                result[i].y += forceY * learningRate;
            }
        }
        
        return result;
    }

    // Pattern analysis methods
    identifyPatterns() {
        const patterns = {
            successPatterns: [],
            efficiencyPatterns: [],
            riskPatterns: []
        };
        
        try {
            // Analyze success patterns
            const successfulSessions = this.sessions.filter(s => s.outcome === 'success');
            if (successfulSessions.length > 0) {
                patterns.successPatterns = this.analyzeSuccessPatterns(successfulSessions) || [];
            }
            
            // Analyze efficiency patterns
            patterns.efficiencyPatterns = this.analyzeEfficiencyPatterns() || [];
            
            // Analyze risk patterns
            patterns.riskPatterns = this.analyzeRiskPatterns() || [];
        } catch (error) {
            console.error('Error analyzing patterns:', error);
            // Return empty patterns object on error
        }
        
        return patterns;
    }

    analyzeSuccessPatterns(sessions) {
        const patterns = [];
        
        // Pattern: Short duration with high confidence
        const shortHighConf = sessions.filter(s => 
            s.duration < this.config.thresholds.shortDuration && 
            s.confidence > this.config.thresholds.highConfidence
        );
        if (shortHighConf.length > 0) {
            patterns.push({
                type: 'Quick Success',
                description: 'Sessions with short duration and high confidence tend to succeed',
                count: shortHighConf.length,
                successRate: 1.0
            });
        }
        
        return patterns;
    }

    analyzeEfficiencyPatterns() {
        const patterns = [];
        
        // Calculate efficiency metrics
        const avgDuration = this.sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / this.sessions.length;
        const efficientSessions = this.sessions.filter(s => s.duration < avgDuration && s.outcome === 'success');
        
        if (efficientSessions.length > 0) {
            patterns.push({
                type: 'Efficient Sessions',
                description: 'Sessions that complete successfully in below-average time',
                count: efficientSessions.length,
                efficiency: efficientSessions.length / this.sessions.length
            });
        }
        
        return patterns;
    }

    analyzeRiskPatterns() {
        const patterns = [];
        
        // Pattern: Long duration sessions
        const longSessions = this.sessions.filter(s => s.duration > this.config.thresholds.longDuration);
        if (longSessions.length > 0) {
            const stuckRate = longSessions.filter(s => s.outcome === 'stuck').length / longSessions.length;
            patterns.push({
                type: 'Long Duration Risk',
                description: 'Sessions longer than 2 hours have higher risk of getting stuck',
                count: longSessions.length,
                riskLevel: stuckRate
            });
        }
        
        return patterns;
    }

    generatePatternInsights(patterns) {
        const insights = [];
        
        // Add null checks and fallbacks
        const successPatterns = patterns?.successPatterns || [];
        const efficiencyPatterns = patterns?.efficiencyPatterns || [];
        const riskPatterns = patterns?.riskPatterns || [];
        
        successPatterns.forEach(pattern => {
            insights.push(`Success: ${pattern.description} (${pattern.count} sessions)`);
        });
        
        efficiencyPatterns.forEach(pattern => {
            insights.push(`Efficiency: ${pattern.description} (${(pattern.efficiency * 100).toFixed(1)}% of sessions)`);
        });
        
        riskPatterns.forEach(pattern => {
            insights.push(`Risk: ${pattern.description} (${(pattern.riskLevel * 100).toFixed(1)}% risk)`);
        });
        
        return insights;
    }

    generateSessionAnalysis(sessionIds) {
        const sessions = sessionIds.map(id => this.sessions.find(s => s.id === id)).filter(Boolean);
        
        return {
            totalSessions: sessions.length,
            successRate: sessions.filter(s => s.outcome === 'success').length / sessions.length,
            avgDuration: sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length,
            intentDistribution: this.getIntentDistribution(sessions),
            outcomeDistribution: this.getOutcomeDistribution(sessions)
        };
    }

    getIntentDistribution(sessions) {
        const distribution = {};
        sessions.forEach(session => {
            const intent = session.intent || 'unknown';
            distribution[intent] = (distribution[intent] || 0) + 1;
        });
        return distribution;
    }

    getOutcomeDistribution(sessions) {
        const distribution = {};
        sessions.forEach(session => {
            const outcome = session.outcome || 'unknown';
            distribution[outcome] = (distribution[outcome] || 0) + 1;
        });
        return distribution;
    }

    createJupyterNotebook(data) {
        const notebook = {
            cells: [
                {
                    cell_type: "markdown",
                    metadata: {},
                    source: [
                        `# ${data.title}\n`,
                        `\n`,
                        `## Session Analysis Report\n`,
                        `\n`,
                        `Generated on: ${new Date().toLocaleString()}\n`,
                        `Total Sessions: ${data.analysis.totalSessions}\n`,
                        `Success Rate: ${(data.analysis.successRate * 100).toFixed(1)}%\n`,
                        `Average Duration: ${Math.round(data.analysis.avgDuration / 60)} minutes`
                    ]
                },
                {
                    cell_type: "code",
                    execution_count: null,
                    metadata: {},
                    output_type: "execute_result",
                    source: [
                        "import pandas as pd\n",
                        "import matplotlib.pyplot as plt\n",
                        "import seaborn as sns\n",
                        "\n",
                        "# Load session data\n",
                        "sessions_data = " + JSON.stringify(data.sessions, null, 2) + "\n",
                        "df = pd.DataFrame(sessions_data)\n",
                        "print(f'Loaded {len(df)} sessions')"
                    ]
                }
            ],
            metadata: {
                kernelspec: {
                    display_name: "Python 3",
                    language: "python",
                    name: "python3"
                },
                language_info: {
                    name: "python",
                    version: "3.8.0"
                }
            },
            nbformat: 4,
            nbformat_minor: 4
        };
        
        return JSON.stringify(notebook, null, 2);
    }
}

// Global functions for modal handling
// Global modal state management
window.modalState = {
    activeModal: null,
    isInitialized: false
};

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.style.display = 'none';
        window.modalState.activeModal = null;
        
        // Remove body scroll lock
        document.body.classList.remove('modal-open');
    }
}

function openModal(modalId) {
    // Close any existing modal first
    if (window.modalState.activeModal && window.modalState.activeModal !== modalId) {
        closeModal(window.modalState.activeModal);
    }
    
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('active');
        modal.style.display = 'flex';
        window.modalState.activeModal = modalId;
        
        // Add body scroll lock
        document.body.classList.add('modal-open');
        
        // Focus the modal for accessibility
        const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }
}

// Enhanced modal functionality with proper state management
function initializeModalHandlers() {
    if (window.modalState.isInitialized) {
        return; // Prevent duplicate initialization
    }
    
    // ESC key to close modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && window.modalState.activeModal) {
            closeModal(window.modalState.activeModal);
        }
    });

    // Click outside modal to close
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal') && window.modalState.activeModal) {
            closeModal(window.modalState.activeModal);
        }
    });

    // Prevent modal content clicks from closing modal
    document.addEventListener('click', function(event) {
        if (event.target.closest('.modal-content')) {
            event.stopPropagation();
        }
    });
    
    // Close modal buttons
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal-close') || 
            event.target.closest('.modal-close')) {
            const modal = event.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        }
    });
    
    window.modalState.isInitialized = true;
}

function generateNotebook() {
    console.log('Generating notebook...');
    closeModal('notebook-modal');
}

function saveSettings() {
    const settings = {
        itemsPerPage: document.getElementById('items-per-page').value,
        defaultView: document.getElementById('default-view').value,
        autoRefresh: document.getElementById('auto-refresh').value,
        showTimestamps: document.getElementById('show-timestamps').checked,
        defaultColorScheme: document.getElementById('default-color-scheme').value,
        animationSpeed: document.getElementById('animation-speed').value
    };
    
    // Save to localStorage
    localStorage.setItem('pkl-dashboard-settings', JSON.stringify(settings));
    
    // Apply settings to current dashboard instance
    if (window.kuraDashboard) {
        window.kuraDashboard.applySettings(settings);
    }
    
    closeModal('settings-modal');
    
    // Show success message
    console.log('Settings saved successfully');
}

function loadSettings() {
    const savedSettings = localStorage.getItem('pkl-dashboard-settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Apply settings to form
        if (document.getElementById('items-per-page')) document.getElementById('items-per-page').value = settings.itemsPerPage || '10';
        if (document.getElementById('default-view')) document.getElementById('default-view').value = settings.defaultView || 'clusters';
        if (document.getElementById('auto-refresh')) document.getElementById('auto-refresh').value = settings.autoRefresh || '30';
        if (document.getElementById('show-timestamps')) document.getElementById('show-timestamps').checked = settings.showTimestamps !== false;
        if (document.getElementById('default-color-scheme')) document.getElementById('default-color-scheme').value = settings.defaultColorScheme || 'intent';
        if (document.getElementById('animation-speed')) document.getElementById('animation-speed').value = settings.animationSpeed || 'normal';
        
        return settings;
    }
    return null;
}

function createProcedure() {
    console.log('Creating procedure...');
    closeModal('procedure-modal');
}

function toggleSelectionItems() {
    const preview = document.getElementById('selection-preview');
    const full = document.getElementById('selection-full');
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
            const totalItems = full.children.length;
            const maxDisplay = window.kuraDashboard?.config?.visualization?.maxDisplayItems || 5;
            expandLink.textContent = `... and ${totalItems - maxDisplay} more`;
        }
    }
}

// Initialize dashboard
function initializeKuraDashboard() {
    window.kuraDashboard = new KuraDashboard();
    initializeModalHandlers();
}
