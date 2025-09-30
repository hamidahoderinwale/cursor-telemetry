/**
 * Real Data Visualizations
 * Creates actual visualizations using real session data from the database
 */

if (typeof RealDataVisualizations === 'undefined') {
class RealDataVisualizations {
    constructor() {
        this.sessions = [];
        this.events = [];
        this.embeddings = [];
        this.charts = {};
        
        // Pagination settings
        this.currentPage = 1;
        this.eventsPerPage = 10;
        this.totalPages = 1;
        this.filteredEvents = [];
    }

    /**
     * Initialize visualizations with real data
     */
    async initialize() {
        try {
            console.log('Loading real data for visualizations...');
            
            // Load data from multiple sources
            await Promise.all([
                this.loadSessionsData(),
                this.loadEventsData(),
                this.loadEmbeddingsData()
            ]);
            
            console.log(`Loaded ${this.sessions.length} sessions, ${this.events.length} events, ${this.embeddings.length} embeddings`);
            
            // Render all visualizations
            this.renderSessionEmbeddingsMap();
            this.renderSessionTimeline();
            this.renderIntentDistribution();
            
        } catch (error) {
            console.error('Error initializing visualizations:', error);
            this.showErrorState();
        }
    }

    /**
     * Refresh visualizations with updated data
     */
    async refresh() {
        try {
            console.log('Refreshing visualizations...');
            
            // Re-load data
            await Promise.all([
                this.loadSessionsData(),
                this.loadEventsData(),
                this.loadEmbeddingsData()
            ]);
            
            console.log(`Refreshed: ${this.sessions.length} sessions, ${this.events.length} events, ${this.embeddings.length} embeddings`);
            
            // Re-render all visualizations
            this.renderSessionEmbeddingsMap();
            this.renderSessionTimeline();
            this.renderIntentDistribution();
            
        } catch (error) {
            console.error('Error refreshing visualizations:', error);
            this.showErrorState();
        }
    }

    /**
     * Load sessions data from API with comprehensive error handling
     */
    async loadSessionsData() {
        try {
            console.log('Loading sessions data...');
            
            // Try multiple data sources in order of preference
            const dataSources = [
                '/api/sessions',
                '/api/sessions/analyze-with-kura',
                '/api/visualizations',
                '/api/events'
            ];
            
            let sessionsLoaded = false;
            
            for (const source of dataSources) {
                try {
                    console.log(`Trying data source: ${source}`);
                    const response = await fetch(source, {
                        method: source.includes('analyze-with-kura') ? 'POST' : 'GET',
                        headers: source.includes('analyze-with-kura') ? { 'Content-Type': 'application/json' } : {},
                        body: source.includes('analyze-with-kura') ? JSON.stringify({
                            test_mode: false,
                            include_dashboard_data: true
                        }) : undefined
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log(`Data from ${source}:`, data);
                        
                        // Extract sessions from different response formats
                        let sessions = [];
                        if (data.sessions) {
                            sessions = data.sessions;
                        } else if (data.data && data.data.sessions) {
                            sessions = data.data.sessions;
                        } else if (data.analysis && data.analysis.sessions) {
                            sessions = data.analysis.sessions;
                        } else if (Array.isArray(data)) {
                            sessions = data;
                        }
                        
                        if (sessions && sessions.length > 0) {
                            this.sessions = this.validateAndSanitizeSessions(sessions);
                            console.log(`Successfully loaded ${this.sessions.length} sessions from ${source}`);
                            sessionsLoaded = true;
                            break;
                        }
                    } else {
                        console.warn(`Failed to load from ${source}:`, response.status, response.statusText);
                    }
                } catch (sourceError) {
                    console.warn(`Error loading from ${source}:`, sourceError);
                }
            }
            
            if (!sessionsLoaded) {
                console.warn('No valid session data found from any source');
                this.sessions = [];
            }
            
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.sessions = [];
        }
    }

    /**
     * Validate and sanitize session data
     */
    validateAndSanitizeSessions(sessions) {
        if (!Array.isArray(sessions)) {
            console.warn('Sessions data is not an array:', typeof sessions);
            return [];
        }
        
        return sessions.filter(session => {
            // Basic validation
            if (!session || typeof session !== 'object') {
                return false;
            }
            
            // Ensure required fields exist
            if (!session.id && !session.session_id) {
                console.warn('Session missing ID:', session);
                return false;
            }
            
            // Add default values for missing fields
            if (!session.id) session.id = session.session_id;
            if (!session.timestamp) session.timestamp = new Date().toISOString();
            if (!session.intent) session.intent = 'unknown';
            if (!session.outcome) session.outcome = 'unknown';
            if (!session.currentFile) session.currentFile = 'unknown';
            
            return true;
        }).map(session => ({
            ...session,
            // Ensure numeric fields are properly typed
            duration: typeof session.duration === 'string' ? parseFloat(session.duration) || 0 : session.duration || 0,
            // Ensure arrays exist
            codeDeltas: Array.isArray(session.codeDeltas) ? session.codeDeltas : [],
            fileChanges: Array.isArray(session.fileChanges) ? session.fileChanges : [],
            conversations: Array.isArray(session.conversations) ? session.conversations : [],
            visualizations: Array.isArray(session.visualizations) ? session.visualizations : [],
            annotations: Array.isArray(session.annotations) ? session.annotations : []
        }));
    }

    /**
     * Load events data from database
     */
    async loadEventsData() {
        try {
            console.log('Loading events data...');
            const response = await fetch('/api/events');
            console.log('Events response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                this.events = data.events || [];
                console.log('Loaded events:', this.events.length);
            } else {
                console.error('Events API error:', response.status, response.statusText);
                // Fallback: create sample events from sessions
                this.events = this.createEventsFromSessions();
            }
        } catch (error) {
            console.error('Error loading events:', error);
            this.events = this.createEventsFromSessions();
        }
    }

    /**
     * Load embeddings data from database
     */
    async loadEmbeddingsData() {
        try {
            console.log('Loading embeddings data...');
            
            // Try multiple API endpoints for embeddings
            const apiEndpoints = [
                '/api/embeddings',
                '/api/sessions/embeddings',
                '/api/visualizations/embeddings'
            ];
            
            let embeddingsLoaded = false;
            
            for (const endpoint of apiEndpoints) {
                try {
                    console.log(`Trying embeddings endpoint: ${endpoint}`);
                    const response = await fetch(endpoint);
                    console.log(`Embeddings response status for ${endpoint}:`, response.status);
                    
            if (response.ok) {
                const data = await response.json();
                        const rawEmbeddings = data.embeddings || data.data || [];
                
                // Validate and clean embeddings data
                        const validEmbeddings = rawEmbeddings.filter(embedding => {
                    if (!embedding || !embedding.session_id) {
                        console.warn('Invalid embedding: missing session_id');
                        return false;
                    }
                    
                    if (!embedding.embedding || !Array.isArray(embedding.embedding)) {
                        console.warn(`Invalid embedding vector for session ${embedding.session_id}`);
                        return false;
                    }
                    
                    // Ensure metadata exists
                    if (!embedding.metadata) {
                        embedding.metadata = {};
                    }
                    
                    return true;
                }).map(embedding => ({
                    ...embedding,
                    metadata: {
                        intent: embedding.metadata.intent || 'unknown',
                        outcome: embedding.metadata.outcome || 'unknown',
                        project: embedding.metadata.project || 'unknown',
                        timestamp: embedding.metadata.timestamp || new Date().toISOString()
                    }
                }));
                
                        if (validEmbeddings.length > 0) {
                            this.embeddings = validEmbeddings;
                            console.log(`Loaded ${this.embeddings.length} valid embeddings from ${endpoint}`);
                            embeddingsLoaded = true;
                            break;
                }
            } else {
                        console.warn(`Failed to load embeddings from ${endpoint}:`, response.status, response.statusText);
                    }
                } catch (endpointError) {
                    console.warn(`Error loading embeddings from ${endpoint}:`, endpointError.message);
                }
            }
            
            // If no valid embeddings from any API, create from sessions
            if (!embeddingsLoaded || this.embeddings.length === 0) {
                console.log('No valid embeddings from API endpoints, creating from sessions...');
                this.embeddings = await this.createEmbeddingsFromSessions();
            }
            
            console.log(`Final embeddings count: ${this.embeddings.length}`);
            
        } catch (error) {
            console.error('Error loading embeddings:', error);
            // Fallback: create embeddings from sessions
            this.embeddings = await this.createEmbeddingsFromSessions();
        }
    }

    /**
     * Create events from sessions data
     */
    createEventsFromSessions() {
        const events = [];
        this.sessions.forEach((session, index) => {
            // Create multiple events per session
            const sessionEvents = [
                {
                    id: `event_${session.id}_1`,
                    timestamp: session.timestamp,
                    event_type: 'ai_interaction',
                    workspace_id: this.extractWorkspace(session.currentFile),
                    description: session.intent || 'AI interaction',
                    duration: session.duration || 0,
                    project: this.extractProject(session.currentFile),
                    file: session.currentFile ? session.currentFile.split('/').pop() : null,
                    language: this.detectLanguage(session.currentFile),
                    metadata: {
                        session_id: session.id,
                        intent: session.intent,
                        outcome: session.outcome
                    }
                }
            ];

            // Add code change events if session has file changes
            if (session.fileChanges && session.fileChanges.length > 0) {
                session.fileChanges.forEach((change, changeIndex) => {
                    events.push({
                        id: `event_${session.id}_change_${changeIndex}`,
                        timestamp: new Date(new Date(session.timestamp).getTime() + (changeIndex + 1) * 60000).toISOString(),
                        event_type: 'code_change',
                        workspace_id: this.extractWorkspace(session.currentFile),
                        description: `Modified ${change.fileName}`,
                        duration: 2.0,
                        project: this.extractProject(session.currentFile),
                        file: change.fileName,
                        language: this.detectLanguage(change.fileName),
                        metadata: {
                            session_id: session.id,
                            change_type: change.changeType,
                            lines_changed: change.lineRange ? change.lineRange.end - change.lineRange.start : 0
                        }
                    });
                });
            }

            events.push(...sessionEvents);
        });

        return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Create embeddings from sessions data using enhanced intent classification
     */
    async createEmbeddingsFromSessions() {
        if (!this.sessions || this.sessions.length === 0) {
            console.warn('No sessions available to create embeddings from');
            return [];
        }

        console.log(`Creating embeddings from ${this.sessions.length} sessions...`);
        
        // Use the enhanced cell stage classifier if available
        if (typeof CellStageClassifier !== 'undefined') {
            try {
                const classifier = new CellStageClassifier();
                const enhancedEmbeddings = [];
                
                for (const session of this.sessions) {
                    // Analyze session stages using the enhanced classifier
                    const stageAnalysis = classifier.analyzeSessionStages(session);
                    
                    // Create embedding based on stage analysis
                    const embedding = this.generateEnhancedSessionEmbedding(session, stageAnalysis);
                    
                    enhancedEmbeddings.push({
                        id: `embedding_${session.id}`,
                        session_id: session.id,
                        embedding: embedding,
                        metadata: {
                            intent: this.normalizeIntent(session.intent),
                            outcome: session.outcome || 'in_progress',
                            project: this.extractProject(session.currentFile),
                            timestamp: session.timestamp,
                            primaryStage: stageAnalysis.primaryStage,
                            stageDistribution: stageAnalysis.stageDistribution,
                            complexity: stageAnalysis.complexityMetrics?.average || 0
                        }
                    });
                }
                
                console.log(`Generated ${enhancedEmbeddings.length} enhanced embeddings with cell stage classification`);
            return enhancedEmbeddings;
            
        } catch (error) {
                console.warn('Enhanced cell stage classification failed, falling back to basic embeddings:', error.message);
            return this.createBasicEmbeddingsFromSessions();
        }
        } else {
            console.log('Cell stage classifier not available, using basic embeddings');
            return this.createBasicEmbeddingsFromSessions();
        }
    }

    /**
     * Generate enhanced session embedding using stage analysis
     */
    generateEnhancedSessionEmbedding(session, stageAnalysis) {
        const embedding = new Array(128).fill(0); // Increased dimensionality for more features
        
        // Intent-based features (first 32 dimensions)
        const intent = this.normalizeIntent(session.intent);
        const intentHash = this.hashString(intent) % 32;
        embedding[intentHash] = 1.0;
        
        // Stage-based features (next 32 dimensions)
        const primaryStage = stageAnalysis.primaryStage || 'unknown';
        const stageHash = this.hashString(primaryStage) % 32;
        embedding[32 + stageHash] = 1.0;
        
        // Complexity features (next 16 dimensions)
        const complexity = Math.min(stageAnalysis.complexityMetrics?.average || 0, 10) / 10;
        for (let i = 0; i < 16; i++) {
            embedding[64 + i] = complexity * (i + 1) / 16;
        }
        
        // Project-based features (next 16 dimensions)
        const project = this.extractProject(session.currentFile);
        const projectHash = this.hashString(project) % 16;
        embedding[80 + projectHash] = 1.0;
        
        // Language-based features (next 16 dimensions)
        const language = this.detectLanguage(session.currentFile);
        const languageHash = this.hashString(language) % 16;
        embedding[96 + languageHash] = 1.0;
        
        // Outcome-based features (next 16 dimensions)
        const outcome = session.outcome || 'in_progress';
        const outcomeHash = this.hashString(outcome) % 16;
        embedding[112 + outcomeHash] = 1.0;
        
        // Add some noise for better clustering
        for (let i = 0; i < embedding.length; i++) {
            embedding[i] += (Math.random() - 0.5) * 0.1;
        }
        
        return embedding;
    }
    
    /**
     * Simple hash function for string to number conversion
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Create basic embeddings as fallback
     */
    createBasicEmbeddingsFromSessions() {
        return this.sessions.map((session, index) => {
            // Ensure session has required fields
            const safeSession = {
                id: session.id || `session_${index}`,
                intent: session.intent || 'unknown',
                outcome: session.outcome || 'unknown',
                currentFile: session.currentFile || 'unknown',
                timestamp: session.timestamp || new Date().toISOString(),
                duration: session.duration || 0,
                ...session
            };
            
            // Create a simple embedding based on session characteristics
            const embedding = this.generateSessionEmbedding(safeSession);
            
            return {
                id: `embedding_${safeSession.id}`,
                session_id: safeSession.id,
                embedding: embedding,
                metadata: {
                    intent: this.normalizeIntent(safeSession.intent),
                    outcome: safeSession.outcome,
                    project: this.extractProject(safeSession.currentFile),
                    timestamp: safeSession.timestamp
                }
            };
        });
    }

    /**
     * Generate a more meaningful embedding for a session
     */
    generateSessionEmbedding(session) {
        const embedding = new Array(64).fill(0); // Reduced dimensionality for less sparsity
        
        // Use session characteristics to create meaningful embeddings
        const intent = session.intent || 'unknown';
        const outcome = session.outcome || 'in_progress';
        const project = this.extractProject(session.currentFile);
        const language = this.detectLanguage(session.currentFile);
        const duration = session.duration || 0;
        
        // Create more structured embeddings based on session features
        const features = {
            intent: this.normalizeIntent(intent),
            outcome: outcome,
            project: project,
            language: language,
            duration: duration
        };
        
        // Intent-based features (0-15)
        const intentIndex = this.simpleHash(features.intent) % 16;
        embedding[intentIndex] = 0.9;
        embedding[intentIndex + 1] = 0.7;
        embedding[intentIndex + 2] = 0.5;
        
        // Outcome-based features (16-23)
        const outcomeIndex = 16 + (this.simpleHash(features.outcome) % 8);
        embedding[outcomeIndex] = 0.8;
        embedding[outcomeIndex + 1] = 0.6;
        
        // Project-based features (24-31)
        const projectIndex = 24 + (this.simpleHash(features.project) % 8);
        embedding[projectIndex] = 0.7;
        embedding[projectIndex + 1] = 0.5;
        
        // Language-based features (32-39)
        const languageIndex = 32 + (this.simpleHash(features.language) % 8);
        embedding[languageIndex] = 0.6;
        embedding[languageIndex + 1] = 0.4;
        
        // Duration-based features (40-47)
        const durationCategory = this.categorizeDuration(features.duration);
        const durationIndex = 40 + (this.simpleHash(durationCategory) % 8);
        embedding[durationIndex] = 0.5;
        embedding[durationIndex + 1] = 0.3;
        
        // Add contextual noise for variation (48-63)
        for (let i = 48; i < 64; i++) {
            embedding[i] = Math.random() * 0.2;
        }
        
        // Normalize the embedding
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / magnitude);
    }
    
    /**
     * Categorize duration into meaningful groups
     */
    categorizeDuration(duration) {
        if (duration < 60) return 'short';
        if (duration < 300) return 'medium';
        if (duration < 900) return 'long';
        return 'very_long';
    }

    /**
     * Simple hash function
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Extract workspace from file path
     */
    extractWorkspace(filePath) {
        if (!filePath) return 'unknown';
        const parts = filePath.split('/');
        const homeIndex = parts.findIndex(part => part === 'hamidaho');
        if (homeIndex >= 0 && parts[homeIndex + 1]) {
            return parts[homeIndex + 1];
        }
        return 'unknown';
    }

    /**
     * Extract project from file path
     */
    extractProject(filePath) {
        if (!filePath) return 'unknown';
        const parts = filePath.split('/');
        const homeIndex = parts.findIndex(part => part === 'hamidaho');
        if (homeIndex >= 0 && parts[homeIndex + 2]) {
            return parts[homeIndex + 2];
        }
        return 'unknown';
    }

    /**
     * Detect language from file extension
     */
    detectLanguage(filePath) {
        if (!filePath) return 'unknown';
        const ext = filePath.split('.').pop().toLowerCase();
        const languageMap = {
            'py': 'python',
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'html': 'html',
            'css': 'css',
            'json': 'json',
            'md': 'markdown',
            'ipynb': 'python'
        };
        return languageMap[ext] || 'unknown';
    }

    /**
     * Render Session Embeddings Map - Enhanced with better clustering and visualization
     */
    renderSessionEmbeddingsMap() {
        const container = document.getElementById('embeddings-container');
        if (!container) {
            console.warn('Embeddings container not found');
            return;
        }

        if (this.embeddings.length === 0) {
            container.innerHTML = `
                <div class="no-data" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 1rem;"></div>
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">No Embedding Data Available</div>
                    <div style="font-size: 0.9rem;">Loading session data to generate embeddings...</div>
                </div>
            `;
            return;
        }

        // Clear any existing content
        container.innerHTML = '';

        // Create enhanced chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'embeddings-chart';
        chartContainer.style.cssText = `
            background: var(--background-primary);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-md);
        `;
        container.appendChild(chartContainer);

        // Create 2D projection of embeddings using improved t-SNE-like approach
        const projectedPoints = this.projectEmbeddingsTo2D(this.embeddings);
        
        if (projectedPoints.length === 0) {
            chartContainer.innerHTML = '<div class="no-data">No valid embedding data to display</div>';
            return;
        }
        
        const svg = this.createSVG(chartContainer, 450, 350);
        
        // Create scales with padding
        const xScale = d3.scaleLinear()
            .domain(d3.extent(projectedPoints, d => d.x))
            .range([60, 390]);
            
        const yScale = d3.scaleLinear()
            .domain(d3.extent(projectedPoints, d => d.y))
            .range([290, 60]);

        // Enhanced color scale based on intent
        const intentList = [...new Set(projectedPoints.map(d => d.intent))].filter(intent => intent && intent !== 'undefined');
        const colorScale = d3.scaleOrdinal()
            .domain(intentList)
            .range([
                'var(--primary-color)', 'var(--success-color)', 'var(--warning-color)', 'var(--danger-color)', 
                'var(--accent-color)', 'var(--info-color)', 'var(--success-color)', 'var(--warning-color)',
                'var(--accent-color)', 'var(--primary-color)'
            ]);

        // Add background grid
        const gridSize = 20;
        for (let i = 0; i <= 450; i += gridSize) {
            svg.append('line')
                .attr('x1', i)
                .attr('x2', i)
                .attr('y1', 0)
                .attr('y2', 350)
                .attr('stroke', 'var(--border-color)')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.3);
        }
        for (let i = 0; i <= 350; i += gridSize) {
            svg.append('line')
                .attr('x1', 0)
                .attr('x2', 450)
                .attr('y1', i)
                .attr('y2', i)
                .attr('stroke', 'var(--border-color)')
                .attr('stroke-width', 0.5)
                .attr('opacity', 0.3);
        }

        // Add points with better styling
        svg.selectAll('.embedding-point')
            .data(projectedPoints)
            .enter()
            .append('circle')
            .attr('class', 'embedding-point')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 8)
            .attr('fill', d => colorScale(d.intent))
            .attr('opacity', 0.8)
            .attr('stroke', 'var(--text-inverse)')
            .attr('stroke-width', 2)
            .attr('filter', 'drop-shadow(var(--shadow-sm))')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('r', 12).attr('opacity', 1);
                
                // Enhanced tooltip
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'embedding-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'var(--background-modal)')
                    .style('color', 'white')
                    .style('padding', '12px')
                    .style('border-radius', '8px')
                    .style('font-size', '13px')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                    .style('box-shadow', 'var(--shadow-lg)');
                
                tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 4px;">Session ${d.session_id}</div>
                    <div>Intent: <strong>${d.intent}</strong></div>
                    <div>Outcome: <strong>${d.outcome}</strong></div>
                    <div>Project: <strong>${d.project}</strong></div>
                `);
            })
            .on('mousemove', function(event) {
                d3.select('.embedding-tooltip')
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('r', 8).attr('opacity', 0.8);
                d3.select('.embedding-tooltip').remove();
            })
             .on('click', (event, d) => {
                 // Show detailed session information
                 if (window.showSessionDetails) {
                     window.showSessionDetails(d);
                 } else {
                     console.warn('showSessionDetails function not available');
                 }
             })
            .style('cursor', 'pointer');

        // Enhanced legend with better styling
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate(20, 20)');

        const legendItems = intentList;
        legendItems.forEach((intent, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 24})`);
            
            legendItem.append('circle')
                .attr('r', 6)
                .attr('fill', colorScale(intent))
                .attr('stroke', 'var(--text-inverse)')
                .attr('stroke-width', 1);
            
            legendItem.append('text')
                .attr('x', 12)
                .attr('y', 4)
                .attr('font-size', '11px')
                .attr('font-weight', '500')
                .attr('fill', 'var(--text-primary)')
                .text(intent);
        });

        // Add title
        svg.append('text')
            .attr('x', 225)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', '600')
            .attr('fill', 'var(--text-primary)')
            .text('Session Clustering Map');

        console.log('Enhanced session embeddings map rendered with', this.embeddings.length, 'points');
    }

    /**
     * Project high-dimensional embeddings to 2D using improved algorithm
     */
    projectEmbeddingsTo2D(embeddings) {
        if (embeddings.length === 0) return [];
        
        // Filter out invalid embeddings and add validation
        const validEmbeddings = embeddings.filter(embedding => {
            return embedding && 
                   embedding.embedding && 
                   Array.isArray(embedding.embedding) && 
                   embedding.embedding.length > 0 &&
                   embedding.session_id;
        });
        
        if (validEmbeddings.length === 0) {
            console.warn('No valid embeddings found for projection');
            return [];
        }
        
        // Group embeddings by intent for better clustering
        const intentGroups = {};
        validEmbeddings.forEach(embedding => {
            // Ensure metadata exists and has proper defaults
            if (!embedding.metadata) {
                embedding.metadata = {};
            }
            
            const intent = this.normalizeIntent(embedding.metadata.intent || 'unknown');
            if (!intentGroups[intent]) {
                intentGroups[intent] = [];
            }
            intentGroups[intent].push(embedding);
        });
        
        const projectedPoints = [];
        const intentCenters = {};
        
        // Calculate centers for each intent group
        Object.keys(intentGroups).forEach(intent => {
            const group = intentGroups[intent];
            const center = this.calculateGroupCenter(group);
            intentCenters[intent] = center;
        });
        
        // Project each embedding with intent-based positioning
        validEmbeddings.forEach((embedding, index) => {
            const embeddingVector = embedding.embedding;
            const intent = this.normalizeIntent(embedding.metadata.intent || 'unknown');
            
            // Validate embedding vector
            if (!Array.isArray(embeddingVector) || embeddingVector.length === 0) {
                console.warn(`Invalid embedding vector for session ${embedding.session_id}`);
                return;
            }
            
            // Calculate base position from embedding vector
            let pc1 = 0, pc2 = 0;
            for (let i = 0; i < embeddingVector.length; i++) {
                const value = typeof embeddingVector[i] === 'number' ? embeddingVector[i] : 0;
                pc1 += value * Math.cos(i * 0.15);
                pc2 += value * Math.sin(i * 0.15);
            }
            
            // Get intent center
            const center = intentCenters[intent];
            
            // Add variation around the center
            const variation = 0.3;
            const x = center.x + (pc1 * variation) + (Math.random() - 0.5) * 0.2;
            const y = center.y + (pc2 * variation) + (Math.random() - 0.5) * 0.2;
            
            projectedPoints.push({
                x: x,
                y: y,
                session_id: embedding.session_id || `session_${index}`,
                intent: intent,
                outcome: embedding.metadata.outcome || 'unknown',
                project: embedding.metadata.project || 'unknown'
            });
        });
        
        console.log(`Projected ${projectedPoints.length} valid embeddings out of ${embeddings.length} total`);
        return projectedPoints;
    }
    
    /**
     * Calculate center position for an intent group
     */
    calculateGroupCenter(group) {
        const intent = group[0].metadata.intent || 'unknown';
        
        // Create a grid of positions for different intents
        const intentPositions = {
            'Data Exploration': { x: -2, y: 1 },
            'Implementation': { x: 2, y: 1 },
            'Debugging': { x: -2, y: -1 },
            'Refactoring': { x: 2, y: -1 },
            'Testing': { x: 0, y: 2 },
            'Analysis': { x: 0, y: -2 },
            'Optimization': { x: 1, y: 0 },
            'Documentation': { x: -1, y: 0 },
            'Unknown': { x: 0, y: 0 }
        };
        
        return intentPositions[intent] || intentPositions['Unknown'];
    }

    /**
     * Render Session Timeline
     */
    renderSessionTimeline() {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        if (this.events.length === 0) {
            container.innerHTML = '<div class="no-data">No timeline data available</div>';
            return;
        }

        // Update filtered events and pagination
        this.updateFilteredEvents();
        this.updatePagination();

        // Get events for current page
        const startIndex = (this.currentPage - 1) * this.eventsPerPage;
        const endIndex = startIndex + this.eventsPerPage;
        const pageEvents = this.filteredEvents.slice(startIndex, endIndex);

        // Group events by date
        const eventsByDate = this.groupEventsByDate(pageEvents);
        
        const timelineHtml = Object.entries(eventsByDate).map(([date, events]) => `
            <div class="timeline-day">
                <div class="timeline-date-header">
                    <h4 class="timeline-date">${this.formatDate(date)}</h4>
                    <span class="timeline-count">${events.length} events</span>
                </div>
                <div class="timeline-events">
                    ${events.map(event => this.renderTimelineEvent(event)).join('')}
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="session-timeline">
                <div class="timeline-header">
                    <h4>Development Activity Timeline</h4>
                    <p>Real-time view of coding sessions and activities</p>
                    <div class="timeline-controls">
                        <select id="project-filter" onchange="realDataVisualizations.filterByProject(this.value)">
                            <option value="">All Projects</option>
                            ${this.getProjectOptions()}
                        </select>
                        <select id="event-type-filter" onchange="realDataVisualizations.filterByEventType(this.value)">
                            <option value="">All Session Types</option>
                            <option value="notebook">Notebook Sessions</option>
                            <option value="code">Code Sessions</option>
                            <option value="conversation">Chat Sessions</option>
                            <option value="session">General Sessions</option>
                        </select>
                </div>
                </div>
                <div class="timeline-scroll-container">
                <div class="timeline-content">
                    ${timelineHtml}
                    </div>
                </div>
                <div class="timeline-pagination">
                    ${this.renderPagination()}
                </div>
            </div>
        `;

        console.log('Session timeline rendered with', this.filteredEvents.length, 'filtered events, page', this.currentPage, 'of', this.totalPages);
    }

    /**
     * Update filtered events based on current filters
     */
    updateFilteredEvents() {
        this.filteredEvents = [...this.events];
        
        // Apply project filter
        const projectFilter = document.getElementById('project-filter')?.value;
        if (projectFilter) {
            this.filteredEvents = this.filteredEvents.filter(event => 
                event.project === projectFilter
            );
        }
        
        // Apply event type filter
        const eventTypeFilter = document.getElementById('event-type-filter')?.value;
        if (eventTypeFilter) {
            this.filteredEvents = this.filteredEvents.filter(event => 
                event.event_type === eventTypeFilter
            );
        }
    }

    /**
     * Update pagination calculations
     */
    updatePagination() {
        this.totalPages = Math.ceil(this.filteredEvents.length / this.eventsPerPage);
        if (this.currentPage > this.totalPages) {
            this.currentPage = Math.max(1, this.totalPages);
        }
    }

    /**
     * Render pagination controls
     */
    renderPagination() {
        if (this.totalPages <= 1) {
            return '<div class="pagination-info">Showing all events</div>';
        }

        const startEvent = (this.currentPage - 1) * this.eventsPerPage + 1;
        const endEvent = Math.min(this.currentPage * this.eventsPerPage, this.filteredEvents.length);
        
        let paginationHtml = `
            <div class="pagination-info">
                Showing ${startEvent}-${endEvent} of ${this.filteredEvents.length} events
            </div>
            <div class="pagination-controls">
        `;

        // Previous button
        if (this.currentPage > 1) {
            paginationHtml += `
                <button class="pagination-btn" onclick="realDataVisualizations.goToPage(${this.currentPage - 1})">
                    ← Previous
                </button>
            `;
        }

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHtml += `<button class="pagination-btn" onclick="realDataVisualizations.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === this.currentPage ? 'active' : '';
            paginationHtml += `
                <button class="pagination-btn ${isActive}" onclick="realDataVisualizations.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHtml += `<button class="pagination-btn" onclick="realDataVisualizations.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }

        // Next button
        if (this.currentPage < this.totalPages) {
            paginationHtml += `
                <button class="pagination-btn" onclick="realDataVisualizations.goToPage(${this.currentPage + 1})">
                    Next →
                </button>
            `;
        }

        paginationHtml += '</div>';
        return paginationHtml;
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.renderSessionTimeline();
        }
    }

    /**
     * Filter by project
     */
    filterByProject(project) {
        this.currentPage = 1; // Reset to first page
        this.renderSessionTimeline();
    }

    /**
     * Filter by event type
     */
    filterByEventType(eventType) {
        this.currentPage = 1; // Reset to first page
        this.renderSessionTimeline();
    }

    /**
     * Get project options for filter dropdown
     */
    getProjectOptions() {
        const projects = [...new Set(this.events.map(event => event.project).filter(Boolean))];
        return projects.map(project => `<option value="${project}">${project}</option>`).join('');
    }

    /**
     * Group events by date
     */
    groupEventsByDate(events) {
        const grouped = {};
        events.forEach(event => {
            const date = new Date(event.timestamp).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(event);
        });
        return grouped;
    }

    /**
     * Render individual timeline event
     */
    renderTimelineEvent(event) {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const eventTypeClass = event.event_type.replace('_', '-');
        const eventId = event.id || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        return `
            <div class="timeline-event ${eventTypeClass}" 
                 data-event-id="${eventId}"
                 onclick="realDataVisualizations.showEventDetail('${eventId}')"
                 onmouseover="realDataVisualizations.highlightEvent('${eventId}')"
                 onmouseout="realDataVisualizations.unhighlightEvent('${eventId}')">
                <div class="timeline-event-marker ${eventTypeClass}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
                    </svg>
                </div>
                <div class="timeline-event-content">
                    <div class="timeline-event-header">
                        <span class="timeline-event-type">${this.formatEventType(event.event_type)}</span>
                        <span class="timeline-event-time">${time}</span>
                    </div>
                    <div class="timeline-event-description">${event.description}</div>
                </div>
            </div>
        `;
    }

    /**
     * Format event type for display
     */
    formatEventType(eventType) {
        return eventType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Show detailed view of a timeline event
     */
    showEventDetail(eventId) {
        const event = this.events.find(e => (e.id || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`) === eventId);
        if (!event) {
            console.warn('Event not found:', eventId);
            return;
        }

        // Remove any existing modals
        const existingModals = document.querySelectorAll('.event-detail-modal-overlay');
        existingModals.forEach(modal => {
            try {
                document.body.removeChild(modal);
            } catch (e) {
                console.warn('Error removing existing modal:', e);
            }
        });

        // Create a modal to show event details
        const modal = document.createElement('div');
        modal.className = 'event-detail-modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'event-detail-modal-content';
        modalContent.style.cssText = `
            background: var(--background-primary);
            border: 1px solid var(--border-color);
            border-radius: 0;
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            box-shadow: var(--shadow-xl);
        `;

        modalContent.innerHTML = `
            <div class="event-detail-header" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--space-3);
                border-bottom: 1px solid var(--border-color);
                flex-shrink: 0;
            ">
                <h3 style="margin: 0; color: var(--text-primary); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);">
                    Event Details
                </h3>
                <button class="event-detail-close" style="
                    background: none;
                    border: none;
                    font-size: var(--font-size-lg);
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: var(--space-1);
                ">&times;</button>
                </div>
            
            <div class="event-detail-body" style="
                flex: 1;
                overflow-y: auto;
                padding: var(--space-3);
            ">
                    <div class="event-detail-content">
                    <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                        <div class="event-detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);">
                            <div class="event-detail-item" style="display: flex; flex-direction: column; gap: var(--space-1);">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs);">Type:</label>
                                <span style="color: var(--text-primary); font-size: var(--font-size-sm);">${this.formatEventType(event.event_type)}</span>
                                </div>
                            <div class="event-detail-item" style="display: flex; flex-direction: column; gap: var(--space-1);">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs);">Time:</label>
                                <span style="color: var(--text-primary); font-size: var(--font-size-sm);">${new Date(event.timestamp).toLocaleString()}</span>
                                </div>
                            <div class="event-detail-item" style="display: flex; flex-direction: column; gap: var(--space-1);">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs);">Duration:</label>
                                <span style="color: var(--text-primary); font-size: var(--font-size-sm);">${event.duration || 'N/A'}s</span>
                                </div>
                            <div class="event-detail-item" style="display: flex; flex-direction: column; gap: var(--space-1);">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs);">Project:</label>
                                <span style="color: var(--text-primary); font-size: var(--font-size-sm);">${event.project || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        
                    <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                        <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs); margin-bottom: var(--space-1); display: block;">Description:</label>
                        <div class="event-description" style="
                            background: var(--background-secondary);
                            padding: var(--space-2);
                            border: 1px solid var(--border-color);
                            border-radius: 0;
                            color: var(--text-primary);
                            line-height: 1.4;
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            font-size: var(--font-size-sm);
                            max-height: 120px;
                            overflow-y: auto;
                        ">${event.description || 'No description available'}</div>
                        </div>
                        
                        ${event.code_delta ? `
                    <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                        <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs); margin-bottom: var(--space-1); display: block;">Code Changes:</label>
                        <div class="event-code-delta" style="
                            background: var(--background-secondary);
                            padding: var(--space-2);
                            border: 1px solid var(--border-color);
                            border-radius: 0;
                            max-height: 150px;
                            overflow-y: auto;
                        ">
                            <pre style="margin: 0; font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--text-primary);"><code>${event.code_delta}</code></pre>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${event.file_path ? `
                    <div class="event-detail-section" style="margin-bottom: var(--space-3);">
                        <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-xs); margin-bottom: var(--space-1); display: block;">File Path:</label>
                        <div style="
                            background: var(--background-secondary);
                            padding: var(--space-2);
                            border: 1px solid var(--border-color);
                            border-radius: 0;
                            color: var(--text-primary);
                            font-family: var(--font-family-mono);
                            font-size: var(--font-size-xs);
                            word-break: break-all;
                        ">${event.file_path}</div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
            
            <div class="event-detail-footer" style="
                display: flex;
                gap: var(--space-2);
                justify-content: flex-end;
                padding: var(--space-3);
                border-top: 1px solid var(--border-color);
                flex-shrink: 0;
            ">
                <button class="btn btn-primary" onclick="realDataVisualizations.copyEventData('${eventId}')" style="
                    padding: var(--space-2) var(--space-3);
                    border: 1px solid var(--primary-color);
                    background: var(--primary-color);
                    color: var(--text-inverse);
                    border-radius: 0;
                    cursor: pointer;
                    font-size: var(--font-size-sm);
                ">Copy</button>
                <button class="btn btn-secondary event-detail-close-btn" style="
                    padding: var(--space-2) var(--space-3);
                    border: 1px solid var(--border-color);
                    background: var(--background-secondary);
                    color: var(--text-primary);
                    border-radius: 0;
                    cursor: pointer;
                    font-size: var(--font-size-sm);
                ">Close</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Add close functionality
        const closeModal = () => {
            try {
                if (modal && modal.parentNode) {
                    document.body.removeChild(modal);
                }
            } catch (error) {
                console.warn('Error closing modal:', error);
            }
        };

        const closeBtn = modalContent.querySelector('.event-detail-close');
        const closeBtnFooter = modalContent.querySelector('.event-detail-close-btn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        if (closeBtnFooter) {
            closeBtnFooter.addEventListener('click', closeModal);
        }
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Add escape key functionality
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Highlight a timeline event on hover
     */
    highlightEvent(eventId) {
        const eventElement = document.querySelector(`[data-event-id="${eventId}"]`);
        if (eventElement) {
            eventElement.classList.add('timeline-event-highlighted');
        }
    }

    /**
     * Remove highlight from timeline event
     */
    unhighlightEvent(eventId) {
        const eventElement = document.querySelector(`[data-event-id="${eventId}"]`);
        if (eventElement) {
            eventElement.classList.remove('timeline-event-highlighted');
        }
    }

    /**
     * Copy event data to clipboard
     */
    copyEventData(eventId) {
        const event = this.events.find(e => (e.id || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`) === eventId);
        if (!event) {
            console.warn('Event not found:', eventId);
            return;
        }

        const text = `Event: ${this.formatEventType(event.event_type)}
Timestamp: ${new Date(event.timestamp).toLocaleString()}
Description: ${event.description || 'No description'}
Project: ${event.project || 'N/A'}
Language: ${event.language || 'N/A'}
Duration: ${event.duration || 'N/A'}s
${event.file_path ? `File: ${event.file_path}` : ''}
${event.code_delta ? `Code Changes:\n${event.code_delta}` : ''}`;

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Event data copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy event data:', err);
            this.showNotification('Failed to copy event data', 'error');
        });
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * Normalize intent names to consolidate duplicates
     */
    normalizeIntent(intent) {
        if (!intent) return 'Unknown';
        
        // Convert to lowercase for comparison
        const lowerIntent = intent.toLowerCase();
        
        // Map variations to standard names
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
        
        return intentMap[lowerIntent] || intent.charAt(0).toUpperCase() + intent.slice(1).toLowerCase();
    }

    /**
     * Get cell stage distribution using the new classifier
     */
    getCellStageDistribution(sessions) {
        console.log('getCellStageDistribution called with', sessions.length, 'sessions');
        
        if (!window.CellStageClassifier) {
            console.warn('CellStageClassifier not available, falling back to legacy intent system');
            return this.getLegacyIntentDistribution(sessions);
        }

        const classifier = new window.CellStageClassifier();
        const distribution = classifier.generateStageDistribution(sessions);
        
        console.log('Cell stage distribution result:', distribution);
        
        // If no stages were found, fall back to legacy intent
        if (distribution.totalCells === 0 || Object.keys(distribution.globalDistribution).length === 0) {
            console.warn('No cell stages found, falling back to legacy intent system');
            return this.getLegacyIntentDistribution(sessions);
        }
        
        return {
            stages: Object.entries(distribution.globalDistribution).map(([stageKey, count]) => {
                const stageInfo = classifier.getStageInfo(stageKey);
                return {
                    name: stageInfo.name,
                    count: count,
                    stage: stageKey,
                    color: stageInfo.color,
                    icon: stageInfo.icon,
                    description: stageInfo.description
                };
            }).sort((a, b) => b.count - a.count),
            totalCells: distribution.totalCells,
            sessionBreakdowns: distribution.sessionBreakdowns,
            insights: distribution.globalInsights || [],
            complexity: distribution.complexityMetrics || null,
            facets: distribution.facetAnalysis || null
        };
    }

    /**
     * Legacy intent distribution for backward compatibility
     */
    getLegacyIntentDistribution(sessions) {
        if (!sessions || sessions.length === 0) {
            return {
                stages: [],
                totalCells: 0,
                sessionBreakdowns: [],
                insights: [{
                    severity: 'warning',
                    message: 'No session data available for analysis'
                }],
                complexity: { total: 0, sessions: 0, average: 0 },
                facets: null
            };
        }

        const intentCounts = {};
        const sessionBreakdowns = [];
        const insights = [];
        let totalComplexity = 0;
        
        sessions.forEach((session, index) => {
            const intent = this.normalizeIntent(session.intent || 'unknown');
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
            
            // Calculate session complexity based on available data
            const sessionComplexity = this.calculateSessionComplexity(session);
            totalComplexity += sessionComplexity;
            
            sessionBreakdowns.push({
                sessionId: session.id || `session-${index}`,
                sessionFile: session.currentFile || 'unknown',
                stages: [{
                    stage: intent,
                    count: 1,
                    confidence: 1.0
                }],
                primaryStage: intent,
                stageDistribution: { [intent]: 1 },
                complexity: sessionComplexity
            });
        });

        // Generate insights based on real data
        const totalSessions = sessions.length;
        const uniqueIntents = Object.keys(intentCounts).length;
        const avgComplexity = totalSessions > 0 ? totalComplexity / totalSessions : 0;
        
        if (uniqueIntents === 1) {
            insights.push({
                severity: 'info',
                message: `All ${totalSessions} sessions focus on ${Object.keys(intentCounts)[0]} - consider exploring different analysis approaches`
            });
        } else if (uniqueIntents < 3) {
            insights.push({
                severity: 'warning',
                message: `Limited diversity: only ${uniqueIntents} different analysis types detected across ${totalSessions} sessions`
            });
        } else {
            insights.push({
                severity: 'success',
                message: `Good analysis diversity: ${uniqueIntents} different analysis types across ${totalSessions} sessions`
            });
        }
        
        if (avgComplexity < 0.1) {
            insights.push({
                severity: 'warning',
                message: 'Low complexity detected - sessions may benefit from more detailed analysis'
            });
        }

        return {
            stages: Object.entries(intentCounts).map(([name, count]) => ({
                name: this.formatIntentName(name),
                count,
                stage: name.toLowerCase().replace(/\s+/g, '_'),
                color: this.getIntentColor(name),
                icon: this.getIntentIcon(name),
                description: this.getIntentDescription(name)
            })).sort((a, b) => b.count - a.count),
            totalCells: totalSessions,
            sessionBreakdowns,
            insights,
            complexity: { 
                total: totalComplexity, 
                sessions: totalSessions, 
                average: avgComplexity 
            },
            facets: this.analyzeFacets(sessions)
        };
    }

    /**
     * Calculate session complexity based on available data
     */
    calculateSessionComplexity(session) {
        let complexity = 0;
        
        // Base complexity from session data
        if (session.codeDeltas && session.codeDeltas.length > 0) {
            complexity += Math.min(session.codeDeltas.length * 0.1, 0.5);
        }
        
        if (session.fileChanges && session.fileChanges.length > 0) {
            complexity += Math.min(session.fileChanges.length * 0.05, 0.3);
        }
        
        if (session.conversations && session.conversations.length > 0) {
            complexity += Math.min(session.conversations.length * 0.02, 0.2);
        }
        
        if (session.visualizations && session.visualizations.length > 0) {
            complexity += Math.min(session.visualizations.length * 0.1, 0.4);
        }
        
        // File type complexity
        if (session.currentFile) {
            if (session.currentFile.endsWith('.ipynb')) {
                complexity += 0.3;
            } else if (session.currentFile.endsWith('.py')) {
                complexity += 0.2;
            }
        }
        
        // Duration complexity
        if (session.duration && session.duration > 0) {
            complexity += Math.min(session.duration / 60, 0.5); // Max 0.5 for duration
        }
        
        return Math.min(complexity, 1.0); // Cap at 1.0
    }

    /**
     * Format intent name for display
     */
    formatIntentName(intent) {
        return intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Get intent color
     */
    getIntentColor(intent) {
        const colors = {
            'data_visualization': 'var(--success-color)',
            'data_analysis': 'var(--info-color)',
            'data_exploration': 'var(--warning-color)',
            'model_training': 'var(--accent-color)',
            'data_preprocessing': 'var(--secondary-color)',
            'unknown': 'var(--text-tertiary)'
        };
        return colors[intent.toLowerCase()] || 'var(--text-tertiary)';
    }

    /**
     * Get intent icon
     */
    getIntentIcon(intent) {
        const icons = {
            'data_visualization': 'chart-bar',
            'data_analysis': 'chart-line',
            'data_exploration': 'search',
            'model_training': 'cpu',
            'data_preprocessing': 'cog',
            'unknown': 'file'
        };
        return icons[intent.toLowerCase()] || 'file';
    }

    /**
     * Get intent description
     */
    getIntentDescription(intent) {
        const descriptions = {
            'data_visualization': 'Creating charts, graphs, and visual representations of data',
            'data_analysis': 'Statistical analysis and data interpretation',
            'data_exploration': 'Initial data investigation and pattern discovery',
            'model_training': 'Machine learning model development and training',
            'data_preprocessing': 'Data cleaning and preparation for analysis',
            'unknown': 'Unclassified session activity'
        };
        return descriptions[intent.toLowerCase()] || 'Unclassified session activity';
    }

    /**
     * Analyze facets from sessions
     */
    analyzeFacets(sessions) {
        const facetCounts = {};
        const totalSessions = sessions.length;
        
        sessions.forEach(session => {
            // Analyze based on file types
            if (session.currentFile) {
                if (session.currentFile.endsWith('.ipynb')) {
                    facetCounts['notebook'] = (facetCounts['notebook'] || 0) + 1;
                } else if (session.currentFile.endsWith('.py')) {
                    facetCounts['python'] = (facetCounts['python'] || 0) + 1;
                } else if (session.currentFile.endsWith('.js')) {
                    facetCounts['javascript'] = (facetCounts['javascript'] || 0) + 1;
                }
            }
            
            // Analyze based on intent
            const intent = session.intent?.toLowerCase();
            if (intent) {
                facetCounts[intent] = (facetCounts[intent] || 0) + 1;
            }
        });
        
        const dominantFacet = Object.entries(facetCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
        
        return {
            facetCounts,
            dominantFacet,
            totalSessions,
            facetDistribution: Object.fromEntries(
                Object.entries(facetCounts).map(([facet, count]) => [
                    facet, 
                    totalSessions > 0 ? (count / totalSessions * 100).toFixed(1) : 0
                ])
            )
        };
    }

    /**
     * Add zoom and configuration controls to visualization container
     */
    addVisualizationControls(container) {
        // Zoom controls
        const controls = document.createElement('div');
        controls.className = 'viz-controls';
        controls.innerHTML = `
            <button class="viz-control-btn" onclick="this.zoomOut()" title="Zoom Out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </button>
            <button class="viz-control-btn" onclick="this.zoomIn()" title="Zoom In">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                    <line x1="11" y1="8" x2="11" y2="14"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </button>
            <button class="viz-control-btn" onclick="this.resetZoom()" title="Reset Zoom">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M3 21v-5h5"></path>
                </svg>
            </button>
            <button class="viz-control-btn" onclick="this.toggleFullscreen()" title="Toggle Fullscreen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </button>
            <button class="viz-control-btn" onclick="this.toggleConfig()" title="Configuration">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>
        `;
        container.appendChild(controls);

        // Configuration panel
        const configPanel = document.createElement('div');
        configPanel.className = 'viz-config-panel';
        configPanel.innerHTML = `
            <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);">
                Visualization Settings
            </h4>
            <div class="config-group">
                <label>Zoom Level</label>
                <input type="range" class="config-slider" min="50" max="200" value="100" 
                       onchange="this.updateZoom(this.value)" step="25">
                <span class="zoom-level">100%</span>
            </div>
            <div class="config-group">
                <label>Show Insights</label>
                <input type="checkbox" class="config-checkbox" checked 
                       onchange="this.toggleInsights(this.checked)">
            </div>
            <div class="config-group">
                <label>Show Metrics</label>
                <input type="checkbox" class="config-checkbox" checked 
                       onchange="this.toggleMetrics(this.checked)">
            </div>
            <div class="config-group">
                <label>Chart Type</label>
                <select class="config-select" onchange="this.changeChartType(this.value)">
                    <option value="pie">Pie Chart</option>
                    <option value="bar">Bar Chart</option>
                    <option value="donut">Donut Chart</option>
                </select>
            </div>
            <div class="config-group">
                <label>Color Scheme</label>
                <select class="config-select" onchange="this.changeColorScheme(this.value)">
                    <option value="default">Default</option>
                    <option value="pastel">Pastel</option>
                    <option value="dark">Dark</option>
                    <option value="colorful">Colorful</option>
                </select>
            </div>
        `;
        container.appendChild(configPanel);

        // Add control methods to the container
        container.zoomOut = () => this.zoomOut(container);
        container.zoomIn = () => this.zoomIn(container);
        container.resetZoom = () => this.resetZoom(container);
        container.toggleFullscreen = () => this.toggleFullscreen(container);
        container.toggleConfig = () => this.toggleConfig(container);
        container.updateZoom = (value) => this.updateZoom(container, value);
        container.toggleInsights = (show) => this.toggleInsights(container, show);
        container.toggleMetrics = (show) => this.toggleMetrics(container, show);
        container.changeChartType = (type) => this.changeChartType(container, type);
        container.changeColorScheme = (scheme) => this.changeColorScheme(container, scheme);
    }

    /**
     * Zoom out visualization
     */
    zoomOut(container) {
        const content = container.querySelector('.viz-content, .cell-stage-analysis-container');
        if (content) {
            const currentZoom = this.getCurrentZoom(content);
            const newZoom = Math.max(50, currentZoom - 25);
            this.setZoom(content, newZoom);
        }
    }

    /**
     * Zoom in visualization
     */
    zoomIn(container) {
        const content = container.querySelector('.viz-content, .cell-stage-analysis-container');
        if (content) {
            const currentZoom = this.getCurrentZoom(content);
            const newZoom = Math.min(200, currentZoom + 25);
            this.setZoom(content, newZoom);
        }
    }

    /**
     * Reset zoom to 100%
     */
    resetZoom(container) {
        const content = container.querySelector('.viz-content, .cell-stage-analysis-container');
        if (content) {
            this.setZoom(content, 100);
        }
    }

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen(container) {
        container.classList.toggle('fullscreen');
        const btn = container.querySelector('.viz-control-btn:last-child');
        if (btn) {
            btn.classList.toggle('active');
        }
    }

    /**
     * Toggle configuration panel
     */
    toggleConfig(container) {
        const configPanel = container.querySelector('.viz-config-panel');
        if (configPanel) {
            configPanel.classList.toggle('show');
        }
    }

    /**
     * Update zoom level
     */
    updateZoom(container, value) {
        const content = container.querySelector('.viz-content, .cell-stage-analysis-container');
        if (content) {
            this.setZoom(content, parseInt(value));
            const zoomLevel = container.querySelector('.zoom-level');
            if (zoomLevel) {
                zoomLevel.textContent = value + '%';
            }
        }
    }

    /**
     * Toggle insights panel
     */
    toggleInsights(container, show) {
        const insightsPanel = container.querySelector('.insights-panel');
        if (insightsPanel) {
            insightsPanel.style.display = show ? 'block' : 'none';
        }
    }

    /**
     * Toggle metrics panel
     */
    toggleMetrics(container, show) {
        const metricsPanel = container.querySelector('.complexity-panel');
        if (metricsPanel) {
            metricsPanel.style.display = show ? 'grid' : 'none';
        }
    }

    /**
     * Change chart type
     */
    changeChartType(container, type) {
        // This would trigger a re-render with the new chart type
        console.log('Changing chart type to:', type);
        // Implementation would depend on the specific chart library being used
    }

    /**
     * Change color scheme
     */
    changeColorScheme(container, scheme) {
        // This would update the color scheme
        console.log('Changing color scheme to:', scheme);
        // Implementation would depend on the specific chart library being used
    }

    /**
     * Get current zoom level
     */
    getCurrentZoom(element) {
        const transform = element.style.transform;
        if (transform && transform.includes('scale')) {
            const match = transform.match(/scale\(([0-9.]+)\)/);
            return match ? parseFloat(match[1]) * 100 : 100;
        }
        return 100;
    }

    /**
     * Set zoom level
     */
    setZoom(element, zoomLevel) {
        const scale = zoomLevel / 100;
        element.style.transform = `scale(${scale})`;
        element.style.transformOrigin = 'top left';
    }

    /**
     * Render bar chart for single category data
     */
    renderBarChart(container, intentEntries, stageDistribution) {
        const svg = this.createSVG(container, 400, 300);
        
        // Create horizontal bar chart
        const maxCount = Math.max(...intentEntries.map(d => d.count));
        const barHeight = 40;
        const barSpacing = 15;
        const chartWidth = 350;
        const chartHeight = intentEntries.length * (barHeight + barSpacing);
        
        const g = svg.append('g')
            .attr('transform', `translate(25, ${(300 - chartHeight) / 2})`);
        
        intentEntries.forEach((entry, i) => {
            const barGroup = g.append('g')
                .attr('transform', `translate(0, ${i * (barHeight + barSpacing)})`);
            
            // Bar background
            barGroup.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', chartWidth)
                .attr('height', barHeight)
                .attr('fill', 'var(--background-secondary)')
                .attr('rx', 4);
            
            // Bar fill
            const barWidth = (entry.count / maxCount) * chartWidth;
            barGroup.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', barWidth)
                .attr('height', barHeight)
                .attr('fill', entry.color)
                .attr('rx', 4);
            
            // Label
            barGroup.append('text')
                .attr('x', 5)
                .attr('y', barHeight / 2)
                .attr('dy', '0.35em')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .attr('fill', 'white')
                .text(entry.name);
            
            // Count
            barGroup.append('text')
                .attr('x', chartWidth - 5)
                .attr('y', barHeight / 2)
                .attr('dy', '0.35em')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .attr('fill', 'var(--text-primary)')
                .attr('text-anchor', 'end')
                .text(entry.count);
        });
        
        // Chart title removed - using header instead
    }

    /**
     * Render Enhanced Cell Stage Distribution - Comprehensive analysis across all notebooks
     */
    renderIntentDistribution() {
        const container = document.getElementById('intent-timeline-container');
        if (!container) {
            console.warn('Intent timeline container not found');
            return;
        }

        if (this.sessions.length === 0) {
            container.innerHTML = `
                <div class="no-data" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 2rem; margin-bottom: 1rem;"></div>
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">No Session Data Available</div>
                    <div style="font-size: 0.9rem;">Loading session data for cell stage analysis...</div>
                </div>
            `;
            return;
        }

        // Use enhanced cell-based classification system
        const stageDistribution = this.getCellStageDistribution(this.sessions);
        const intentEntries = stageDistribution.stages;

        // Clear any existing content
        container.innerHTML = '';

        // Create comprehensive analysis container
        const analysisContainer = document.createElement('div');
        analysisContainer.className = 'cell-stage-analysis-container';
        analysisContainer.style.cssText = `
            background: var(--background-primary);
            border-radius: 0;
            padding: var(--space-4);
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-md);
            margin-bottom: var(--space-4);
            min-height: 400px;
            max-height: 600px;
            overflow-y: auto;
            position: relative;
        `;

        // Add zoom and configuration controls
        this.addVisualizationControls(analysisContainer);
        
        // Add header with insights
        const header = document.createElement('div');
        header.className = 'analysis-header';
        header.style.cssText = `
            margin-bottom: var(--space-4);
            padding-bottom: var(--space-3);
            border-bottom: 1px solid var(--border-color);
        `;
        header.innerHTML = `
            <h3 style="margin: 0 0 var(--space-2) 0; color: var(--text-primary); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);">
                Cell Stage Distribution
            </h3>
            <p style="margin: 0; color: var(--text-secondary); font-size: var(--font-size-sm);">
                Aggregated analysis across ${this.sessions.length} sessions • ${stageDistribution.totalCells} total cells analyzed
            </p>
        `;
        analysisContainer.appendChild(header);

        // Add insights panel
        if (stageDistribution.insights && stageDistribution.insights.length > 0) {
            const insightsPanel = document.createElement('div');
            insightsPanel.className = 'insights-panel';
            insightsPanel.style.cssText = `
                background: var(--background-secondary);
                border-radius: 0;
                padding: var(--space-3);
                margin-bottom: var(--space-3);
                border-left: 4px solid var(--primary-color);
                max-height: 120px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
            `;
            
            const insightsHtml = stageDistribution.insights.map(insight => `
                <div class="insight-item" style="margin-bottom: var(--space-2); font-size: var(--font-size-sm); display: flex; align-items: flex-start; gap: var(--space-2);">
                    <div class="insight-indicator" style="
                        width: 8px; 
                        height: 8px; 
                        border-radius: 0; 
                        background: var(--${insight.severity === 'warning' ? 'warning' : insight.severity === 'success' ? 'success' : 'info'}-color);
                        flex-shrink: 0;
                        margin-top: 4px;
                    "></div>
                    <span style="color: var(--text-primary); line-height: var(--line-height-relaxed);">${insight.message}</span>
                </div>
            `).join('');
            
            insightsPanel.innerHTML = `
                <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);">
                    Key Insights
                </h4>
                ${insightsHtml}
            `;
            analysisContainer.appendChild(insightsPanel);
        }

        // Add complexity metrics
        if (stageDistribution.complexity) {
            const complexityPanel = document.createElement('div');
            complexityPanel.className = 'complexity-panel';
            complexityPanel.style.cssText = `
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: var(--space-2);
                margin-bottom: var(--space-3);
            `;
            
            const metrics = [
                { label: 'Avg Complexity', value: stageDistribution.complexity.average?.toFixed(1) || '0.0' },
                { label: 'Total Cells', value: stageDistribution.totalCells || 0 },
                { label: 'Sessions', value: stageDistribution.complexity.sessions || 0 },
                { label: 'Dominant Facet', value: stageDistribution.facets?.dominantFacet || 'N/A' }
            ];
            
            complexityPanel.innerHTML = metrics.map(metric => `
                <div class="metric-card" style="
                    background: var(--background-secondary);
                    padding: var(--space-3);
                    border-radius: 0;
                    text-align: center;
                    border: 1px solid var(--border-color);
                    transition: all var(--transition-fast);
                ">
                    <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--text-primary); margin-bottom: var(--space-1);">
                        ${metric.value}
                    </div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-secondary); font-weight: var(--font-weight-medium);">
                        ${metric.label}
                    </div>
                </div>
            `).join('');
            
            analysisContainer.appendChild(complexityPanel);
        }

        container.appendChild(analysisContainer);

        // Create enhanced chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'intent-distribution-chart';
        chartContainer.style.cssText = `
            background: var(--background-primary);
            border-radius: 0;
            padding: var(--space-3);
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-md);
            min-height: 300px;
            max-height: 500px;
            overflow: hidden;
            position: relative;
        `;
        container.appendChild(chartContainer);

        // Add controls to chart container
        this.addVisualizationControls(chartContainer);

        // Create SVG with responsive dimensions
        const svg = this.createSVG(chartContainer, 400, 300);
        
        // Only create pie chart if we have multiple categories
        if (intentEntries.length <= 1) {
            // Show bar chart instead of pie chart for single category
            this.renderBarChart(chartContainer, intentEntries, stageDistribution);
            return;
        }

        // Create pie chart with better configuration
        const pie = d3.pie()
            .value(d => d.count)
            .sort(null)
            .padAngle(0.02);

        const arc = d3.arc()
            .innerRadius(40)
            .outerRadius(100);

        // Use stage-specific colors
        const colorScale = d3.scaleOrdinal()
            .domain(intentEntries.map(d => d.stage))
            .range(intentEntries.map(d => d.color));

        const g = svg.append('g')
            .attr('transform', 'translate(200, 150)');

        const arcs = g.selectAll('.arc')
            .data(pie(intentEntries))
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => colorScale(d.data.stage))
            .attr('opacity', 0.8)
            .attr('stroke', 'var(--text-inverse)')
            .attr('stroke-width', 2)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1);
                
                // Enhanced tooltip
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'intent-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'var(--background-modal)')
                    .style('color', 'white')
                    .style('padding', '12px')
                    .style('border-radius', '8px')
                    .style('font-size', '13px')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                    .style('box-shadow', 'var(--shadow-lg)');
                
                const percentage = ((d.data.count / stageDistribution.totalCells) * 100).toFixed(1);
                tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 4px;">${d.data.name}</div>
                    <div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 6px;">${d.data.description}</div>
                    <div>Cells: <strong>${d.data.count}</strong></div>
                    <div>Percentage: <strong>${percentage}%</strong></div>
                `);
            })
            .on('mousemove', function(event) {
                d3.select('.intent-tooltip')
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 15) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.8);
                d3.select('.intent-tooltip').remove();
            });

        // Add labels with better positioning
        arcs.append('text')
            .attr('transform', d => {
                const centroid = arc.centroid(d);
                return `translate(${centroid[0]}, ${centroid[1]})`;
            })
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('fill', 'white')
            .attr('text-shadow', '1px 1px 2px var(--background-modal)')
            .text(d => d.data.count > 1 ? d.data.name : '');

        // Compact legend with better styling
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate(20, 20)');

        intentEntries.slice(0, 4).forEach((stage, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 16})`);
            
            legendItem.append('rect')
                .attr('width', 10)
                .attr('height', 10)
                .attr('fill', colorScale(stage.stage))
                .attr('rx', 2);
            
            legendItem.append('text')
                .attr('x', 14)
                .attr('y', 8)
                .attr('font-size', '10px')
                .attr('font-weight', '500')
                .attr('fill', 'var(--text-primary)')
                .text(`${stage.name} (${stage.count})`);
        });

        // Skip workflow progression to save space

        // Add compact insights section
        const insightsContainer = document.createElement('div');
        insightsContainer.className = 'intent-insights';
        insightsContainer.style.cssText = `
            margin-top: 12px;
            padding: 8px;
            background: var(--background-secondary);
            border-radius: 6px;
            border-left: 3px solid var(--primary-color);
            max-height: 100px;
            overflow-y: auto;
        `;
        
        const insightsTitle = document.createElement('h4');
        insightsTitle.textContent = 'Key Insights';
        insightsTitle.style.cssText = `
            margin: 0 0 6px 0;
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 600;
        `;
        insightsContainer.appendChild(insightsTitle);
        
        const insightsList = document.createElement('ul');
        insightsList.style.cssText = `
            margin: 0;
            padding-left: 16px;
            color: var(--text-secondary);
            font-size: 11px;
        `;
        
        // Add comprehensive insights
        if (intentEntries.length > 0) {
            const topIntent = intentEntries[0];
            const percentage = ((topIntent.count / stageDistribution.totalCells) * 100).toFixed(1);
            insightsList.innerHTML += `<li>Most common stage: <strong>${topIntent.name}</strong> (${topIntent.count} cells, ${percentage}%)</li>`;
        }
        
        if (intentEntries.length > 1) {
            const diversity = intentEntries.length;
            insightsList.innerHTML += `<li>Workflow diversity: <strong>${diversity}</strong> different stages identified</li>`;
        }
        
        // Add complexity insights
        if (stageDistribution.complexityMetrics) {
            const complexity = stageDistribution.complexityMetrics.average;
            if (complexity > 5) {
                insightsList.innerHTML += `<li>High complexity detected: Average ${complexity.toFixed(1)} - consider refactoring</li>`;
            } else if (complexity < 2) {
                insightsList.innerHTML += `<li>Well-structured workflows: Low complexity (${complexity.toFixed(1)})</li>`;
            }
        }
        
        // Add facet analysis insights
        if (stageDistribution.facetAnalysis && stageDistribution.facetAnalysis.dominantFacet) {
            insightsList.innerHTML += `<li>Dominant analysis facet: <strong>${stageDistribution.facetAnalysis.dominantFacet}</strong></li>`;
        }
        
        insightsList.innerHTML += `<li>Total cells analyzed: <strong>${stageDistribution.totalCells}</strong> across <strong>${this.sessions.length}</strong> sessions</li>`;
        
        // Add complexity insights
        if (stageDistribution.complexity && stageDistribution.complexity.average !== undefined) {
            const complexity = stageDistribution.complexity;
            const avg = complexity.average || 0;
            const max = complexity.max || 0;
            const min = complexity.min || 0;
            insightsList.innerHTML += `<li>Average complexity: <strong>${avg.toFixed(1)}</strong> (max: ${max}, min: ${min})</li>`;
        } else {
            insightsList.innerHTML += `<li>Complexity analysis: <strong>Not available</strong></li>`;
        }
        
        // Add facet insights
        if (stageDistribution.facets && stageDistribution.facets.dominantFacet) {
            insightsList.innerHTML += `<li>Dominant analysis focus: <strong>${stageDistribution.facets.dominantFacet}</strong></li>`;
        }
        
        // Add holistic insights
        if (stageDistribution.insights && stageDistribution.insights.length > 0) {
            insightsList.innerHTML += `<li>Quality insights: ${stageDistribution.insights.length} recommendations</li>`;
        }
        
        insightsContainer.appendChild(insightsList);
        
        // Add detailed insights if available
        if (stageDistribution.insights && stageDistribution.insights.length > 0) {
            const detailedInsights = document.createElement('div');
            detailedInsights.className = 'detailed-insights';
            detailedInsights.style.cssText = `
                margin-top: 15px;
                padding: 10px;
                background: var(--background-primary);
                border-radius: 6px;
                border: 1px solid var(--border-color);
            `;
            
            const detailedTitle = document.createElement('h5');
            detailedTitle.textContent = 'Detailed Insights';
            detailedTitle.style.cssText = `
                margin: 0 0 8px 0;
                color: var(--text-primary);
                font-size: 12px;
                font-weight: 600;
            `;
            detailedInsights.appendChild(detailedTitle);
            
            const detailedList = document.createElement('ul');
            detailedList.style.cssText = `
                margin: 0;
                padding-left: 15px;
                color: var(--text-secondary);
                font-size: 11px;
            `;
            
            stageDistribution.insights.forEach(insight => {
                const severityColor = insight.severity === 'warning' ? 'var(--warning-color)' : 
                                    insight.severity === 'success' ? 'var(--success-color)' : 
                                    'var(--info-color)';
                
                detailedList.innerHTML += `
                    <li style="color: ${severityColor};">
                        <strong>${insight.type}:</strong> ${insight.message}
                    </li>
                `;
            });
            
            detailedInsights.appendChild(detailedList);
            insightsContainer.appendChild(detailedInsights);
        }
        
        chartContainer.appendChild(insightsContainer);

        console.log('Enhanced cell stage distribution rendered with', intentEntries.length, 'stages');
    }

    /**
     * Create workflow progression visualization
     */
    createWorkflowProgression(stageDistribution) {
        const container = document.createElement('div');
        container.className = 'workflow-stages';
        
        // Define typical workflow progression
        const workflowOrder = [
            'import', 'data_loading', 'data_preprocessing', 
            'exploratory_analysis', 'statistical_analysis', 'machine_learning',
            'data_visualization', 'interactive_viz', 'results_interpretation',
            'documentation', 'testing'
        ];
        
        // Get stage counts
        const stageCounts = {};
        stageDistribution.stages.forEach(stage => {
            stageCounts[stage.stage] = stage.count;
        });
        
        // Create workflow visualization
        const workflowHtml = workflowOrder.map((stageKey, index) => {
            const count = stageCounts[stageKey] || 0;
            const percentage = stageDistribution.totalCells > 0 ? 
                ((count / stageDistribution.totalCells) * 100).toFixed(1) : 0;
            
            // Get stage info
            const stageInfo = this.getStageInfo(stageKey);
            const isActive = count > 0;
            
            return `
                <div class="workflow-stage ${isActive ? 'active' : 'inactive'}" 
                     style="
                         display: flex;
                         align-items: center;
                         padding: 12px;
                         margin-bottom: 8px;
                         border-radius: 6px;
                         background: ${isActive ? 'var(--background-primary)' : 'var(--background-tertiary)'};
                         border: 1px solid ${isActive ? 'var(--border-color)' : 'var(--border-color-light)'};
                         opacity: ${isActive ? '1' : '0.6'};
                         transition: all 0.2s ease;
                     ">
                    <div class="stage-icon" style="
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        background: ${isActive ? stageInfo.color : 'var(--text-tertiary)'};
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 12px;
                        color: white;
                        font-weight: 600;
                        font-size: 12px;
                    ">
                        ${index + 1}
                    </div>
                    <div class="stage-content" style="flex: 1;">
                        <div style="
                            font-weight: 600;
                            color: var(--text-primary);
                            margin-bottom: 2px;
                            font-size: 14px;
                        ">
                            ${stageInfo.name}
                        </div>
                        <div style="
                            color: var(--text-secondary);
                            font-size: 12px;
                            margin-bottom: 4px;
                        ">
                            ${stageInfo.description}
                        </div>
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <span style="
                                background: var(--background-secondary);
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: 11px;
                                font-weight: 600;
                                color: var(--text-primary);
                            ">
                                ${count} cells
                            </span>
                            <span style="
                                background: var(--primary-color);
                                color: white;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: 11px;
                                font-weight: 600;
                            ">
                                ${percentage}%
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div style="
                display: grid;
                grid-template-columns: 1fr;
                gap: 8px;
                max-height: 400px;
                overflow-y: auto;
            ">
                ${workflowHtml}
            </div>
        `;
        
        return container;
    }

    /**
     * Get stage information for workflow progression
     */
    getStageInfo(stageKey) {
        const stageMap = {
            'import': { name: 'Import Dependencies', description: 'Loading libraries and modules', color: 'var(--primary-color)' },
            'data_loading': { name: 'Data Loading', description: 'Loading datasets and files', color: 'var(--success-color)' },
            'data_preprocessing': { name: 'Data Preprocessing', description: 'Cleaning and transforming data', color: 'var(--warning-color)' },
            'exploratory_analysis': { name: 'Exploratory Analysis', description: 'Initial data exploration', color: 'var(--accent-color)' },
            'statistical_analysis': { name: 'Statistical Analysis', description: 'Statistical tests and analysis', color: 'var(--danger-color)' },
            'machine_learning': { name: 'Machine Learning', description: 'Model training and validation', color: 'var(--info-color)' },
            'data_visualization': { name: 'Data Visualization', description: 'Creating charts and plots', color: 'var(--success-color)' },
            'interactive_viz': { name: 'Interactive Visualization', description: 'Creating interactive dashboards', color: 'var(--warning-color)' },
            'results_interpretation': { name: 'Results Interpretation', description: 'Analyzing and interpreting results', color: 'var(--primary-color)' },
            'documentation': { name: 'Documentation', description: 'Adding comments and documentation', color: 'var(--text-secondary)' },
            'testing': { name: 'Testing & Validation', description: 'Unit tests and validation', color: 'var(--danger-color)' }
        };
        
        return stageMap[stageKey] || { 
            name: stageKey, 
            description: 'Unknown stage', 
            color: 'var(--text-tertiary)' 
        };
    }

    /**
     * Create SVG element
     */
    createSVG(container, width, height) {
        // Clear container
        container.innerHTML = '';
        
        return d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('background', 'var(--background-secondary)')
            .style('border-radius', '8px');
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'Today';
        if (diffDays === 2) return 'Yesterday';
        if (diffDays < 7) return `${diffDays - 1} days ago`;
        return date.toLocaleDateString();
    }

    /**
     * Show error state
     */
    showErrorState() {
        const containers = [
            'embeddings-container',
            'timeline-container', 
            'intent-timeline-container'
        ];
        
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '<div class="error-state">Error loading visualization data</div>';
            }
        });
    }

     /**
      * Show detailed session information when embedding point is clicked
      */
     showSessionDetails(sessionData) {
         try {
             if (!sessionData) {
                 console.warn('No session data provided to showSessionDetails');
                 return;
             }

             // Remove any existing modals
             const existingModals = document.querySelectorAll('.session-details-modal');
             existingModals.forEach(modal => {
                 try {
                     document.body.removeChild(modal);
                 } catch (e) {
                     console.warn('Error removing existing modal:', e);
                 }
             });

             // Create modal for session details
             const modal = document.createElement('div');
        modal.className = 'session-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--background-modal);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-4);
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'session-details-content';
        modalContent.style.cssText = `
            background: var(--background-primary);
            border: 1px solid var(--border-color);
            border-radius: 0;
            padding: var(--space-6);
            max-width: 600px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: var(--shadow-xl);
        `;

        // Get the full session data
        const session = this.sessions.find(s => s.id === sessionData.session_id);
        
        modalContent.innerHTML = `
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-color);">
                <h3 style="margin: 0; color: var(--text-primary); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);">
                    Session Details
                </h3>
                <button class="close-btn" style="background: none; border: none; font-size: var(--font-size-xl); color: var(--text-secondary); cursor: pointer; padding: var(--space-1);">
                    ×
                </button>
            </div>
            
            <div class="session-info">
                <div class="info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4);">
                    <div class="info-item">
                        <label style="font-weight: var(--font-weight-semibold); color: var(--text-secondary); font-size: var(--font-size-sm);">Session ID</label>
                        <div style="color: var(--text-primary); font-family: var(--font-family-mono);">${sessionData.session_id}</div>
                    </div>
                    <div class="info-item">
                        <label style="font-weight: var(--font-weight-semibold); color: var(--text-secondary); font-size: var(--font-size-sm);">Intent</label>
                        <div style="color: var(--text-primary);">${sessionData.intent}</div>
                    </div>
                    <div class="info-item">
                        <label style="font-weight: var(--font-weight-semibold); color: var(--text-secondary); font-size: var(--font-size-sm);">Outcome</label>
                        <div style="color: var(--text-primary);">${sessionData.outcome}</div>
                    </div>
                    <div class="info-item">
                        <label style="font-weight: var(--font-weight-semibold); color: var(--text-secondary); font-size: var(--font-size-sm);">Project</label>
                        <div style="color: var(--text-primary);">${sessionData.project}</div>
                    </div>
                </div>

                ${session ? `
                    <div class="session-details" style="margin-top: var(--space-4);">
                        <h4 style="margin: 0 0 var(--space-3) 0; color: var(--text-primary); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold);">
                            Additional Information
                        </h4>
                        
                        <div class="details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                            <div class="detail-item">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-sm);">Timestamp</label>
                                <div style="color: var(--text-primary); font-size: var(--font-size-sm);">${new Date(session.timestamp).toLocaleString()}</div>
                            </div>
                            <div class="detail-item">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-sm);">Duration</label>
                                <div style="color: var(--text-primary); font-size: var(--font-size-sm);">${session.duration ? `${Math.round(session.duration / 1000)}s` : 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-sm);">Current File</label>
                                <div style="color: var(--text-primary); font-size: var(--font-size-sm); font-family: var(--font-family-mono);">${session.currentFile || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <label style="font-weight: var(--font-weight-medium); color: var(--text-secondary); font-size: var(--font-size-sm);">Code Changes</label>
                                <div style="color: var(--text-primary); font-size: var(--font-size-sm);">${session.codeDeltas ? session.codeDeltas.length : 0}</div>
                            </div>
                        </div>

                        ${this.renderEnhancedConversationsSection(session)}
                    </div>
                ` : ''}

                <div class="modal-actions" style="margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--border-color); display: flex; gap: var(--space-3); justify-content: flex-end;">
                 <button class="btn btn-secondary" onclick="closeSessionModal()" style="padding: var(--space-2) var(--space-4); border: 1px solid var(--border-color); background: var(--background-secondary); color: var(--text-primary); border-radius: 0; cursor: pointer;">
                     Close
                 </button>
                     <button class="btn btn-primary" onclick="viewSessionDetails('${sessionData.session_id}')" style="padding: var(--space-2) var(--space-4); border: 1px solid var(--primary-color); background: var(--primary-color); color: var(--text-inverse); border-radius: 0; cursor: pointer;">
                         View Full Details
                     </button>
                </div>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

         // Add close functionality
         const closeBtn = modalContent.querySelector('.close-btn');
         const closeModal = () => {
             try {
                 if (modal && modal.parentNode) {
                     document.body.removeChild(modal);
                 }
                 // Remove escape key listener
                 document.removeEventListener('keydown', handleEscape);
             } catch (error) {
                 console.warn('Error closing modal:', error);
             }
         };

         // Make closeModal globally available
         window.closeSessionModal = closeModal;

         if (closeBtn) {
             closeBtn.addEventListener('click', closeModal);
         }
         
         modal.addEventListener('click', (e) => {
             if (e.target === modal) {
                 closeModal();
             }
         });

         // Add escape key functionality
         const handleEscape = (e) => {
             if (e.key === 'Escape') {
                 closeModal();
             }
         };
         document.addEventListener('keydown', handleEscape);

         } catch (error) {
             console.error('Error showing session details:', error);
             // Show a simple fallback notification
             if (window.dashboard && window.dashboard.showNotification) {
                 window.dashboard.showNotification('Error loading session details', 'error');
             } else {
                 alert('Error loading session details: ' + error.message);
             }
         }
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
     * Render session timeline visualization
     */
    async renderSessionTimeline() {
        try {
            console.log('Rendering session timeline...');
            
            // Find or create timeline container
            let timelineContainer = document.getElementById('timeline-container');
            if (!timelineContainer) {
                // Create timeline container if it doesn't exist
                timelineContainer = document.createElement('div');
                timelineContainer.id = 'timeline-container';
                timelineContainer.className = 'timeline-view';
                timelineContainer.style.display = 'none'; // Initially hidden
                
                // Insert after the main dashboard content
                const dashboardContent = document.getElementById('dashboardContent');
                if (dashboardContent && dashboardContent.parentNode) {
                    dashboardContent.parentNode.insertBefore(timelineContainer, dashboardContent.nextSibling);
                }
            }

            // Group sessions by date
            const sessionsByDate = this.groupSessionsByDate(this.sessions);
            
            let timelineHTML = `
                <div class="timeline-header">
                    <h3>Work Sessions Timeline</h3>
                    <p>Temporal chunks of development actions grouped by work sessions</p>
                    <button class="btn btn-secondary" onclick="hideTimelineView()" style="margin-top: 10px;">
                        ← Back to Dashboard
                    </button>
                </div>
                <div class="timeline-events">
            `;

            // Sort dates in descending order (most recent first)
            const sortedDates = Object.keys(sessionsByDate).sort((a, b) => new Date(b) - new Date(a));

            for (const date of sortedDates) {
                const sessions = sessionsByDate[date];
                const formattedDate = this.formatDate(date);
                
                timelineHTML += `
                    <div class="timeline-date-group">
                        <h4>${formattedDate}</h4>
                        <div class="timeline-date-events">
                            <span class="event-count">${sessions.length} events</span>
                `;

                // Sort sessions by timestamp (most recent first)
                const sortedSessions = sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                for (const session of sortedSessions) {
                    // Format time directly without async issues
                    const timeString = new Date(session.timestamp).toLocaleTimeString('en-US', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                    });
                    
                    const projectName = this.extractProjectName(session.currentFile);
                    const fileName = this.extractFileName(session.currentFile);
                    const changeCount = (session.codeDeltas && session.codeDeltas.length) || 0;
                    
                    timelineHTML += `
                        <div class="timeline-event-enhanced" onclick="viewSessionDetails('${session.id}')">
                            <div class="event-time">${timeString}</div>
                            <div class="event-details">
                                <div class="event-file">${fileName} • ${projectName}</div>
                                ${changeCount > 0 ? `<div class="event-changes"> • ${changeCount} changes</div>` : ''}
                            </div>
                        </div>
                    `;
                }

                timelineHTML += `
                        </div>
                    </div>
                `;
            }

            timelineHTML += `</div>`;

            // Update the timeline container
            timelineContainer.innerHTML = timelineHTML;

            console.log('Session timeline rendered successfully');

        } catch (error) {
            console.error('Error rendering session timeline:', error);
        }
    }

    /**
     * Group sessions by date
     */
    groupSessionsByDate(sessions) {
        const grouped = {};
        
        sessions.forEach(session => {
            const date = new Date(session.timestamp).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(session);
        });

        return grouped;
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
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

    /**
     * Format time for display
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }

    /**
     * Extract project name from file path
     */
    extractProjectName(filePath) {
        if (!filePath) return 'Unknown Project';
        
        const parts = filePath.split('/');
        // Find a meaningful project name (not generic folder names)
        const meaningfulParts = parts.filter(part => 
            part && 
            !['Users', 'Desktop', 'Documents', 'Downloads'].includes(part) &&
            !part.startsWith('.')
        );
        
        return meaningfulParts.length > 0 ? meaningfulParts[meaningfulParts.length - 2] || meaningfulParts[meaningfulParts.length - 1] : 'Unknown Project';
    }

    /**
     * Extract file name from file path
     */
    extractFileName(filePath) {
        if (!filePath) return 'unknown file';
        return filePath.split('/').pop() || 'unknown file';
    }

    /**
     * Format intent for display
     */
    formatIntent(intent) {
        return intent.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}

// Make it globally available
window.RealDataVisualizations = RealDataVisualizations;
}

// Make showSessionDetails globally available
window.showSessionDetails = function(sessionData) {
    if (window.realDataVisualizations) {
        window.realDataVisualizations.showSessionDetails(sessionData);
    }
};

// Make viewSessionDetails globally available
window.viewSessionDetails = function(sessionId) {
    try {
        // Close the current modal first
        if (window.closeSessionModal) {
            window.closeSessionModal();
        }
        
        // Use the dashboard's viewSession function if available
        if (window.dashboard && window.dashboard.viewSession) {
            window.dashboard.viewSession(sessionId);
        } else if (window.switchView) {
            // Fallback to switching to sessions view
            window.switchView('sessions');
        } else {
            console.warn('No session viewing functionality available');
            alert('Session viewing not available');
        }
    } catch (error) {
        console.error('Error viewing session details:', error);
        alert('Error viewing session: ' + error.message);
    }
};
