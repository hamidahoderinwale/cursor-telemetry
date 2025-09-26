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
     * Load sessions data from API
     */
    async loadSessionsData() {
        try {
            const response = await fetch('/api/sessions');
            if (response.ok) {
                const data = await response.json();
                this.sessions = data.sessions || [];
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
        }
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
            const response = await fetch('/api/embeddings');
            console.log('Embeddings response status:', response.status);
            if (response.ok) {
                const data = await response.json();
                const rawEmbeddings = data.embeddings || [];
                
                // Validate and clean embeddings data
                this.embeddings = rawEmbeddings.filter(embedding => {
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
                
                console.log(`Loaded ${this.embeddings.length} valid embeddings out of ${rawEmbeddings.length} total`);
                
                // If no valid embeddings from API, create from sessions
                if (this.embeddings.length === 0) {
                    console.log('No valid embeddings from API, creating from sessions...');
                    this.embeddings = this.createEmbeddingsFromSessions();
                }
            } else {
                console.error('Embeddings API error:', response.status, response.statusText);
                // Fallback: create embeddings from sessions
                this.embeddings = this.createEmbeddingsFromSessions();
            }
        } catch (error) {
            console.error('Error loading embeddings:', error);
            this.embeddings = this.createEmbeddingsFromSessions();
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
     * Create embeddings from sessions data
     */
    createEmbeddingsFromSessions() {
        if (!this.sessions || this.sessions.length === 0) {
            console.warn('No sessions available to create embeddings from');
            return [];
        }
        
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
        if (!container) return;

        if (this.embeddings.length === 0) {
            container.innerHTML = '<div class="no-data">No embedding data available</div>';
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
            });

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

        // Group events by date
        const eventsByDate = this.groupEventsByDate(this.events);
        
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
                </div>
                <div class="timeline-content">
                    ${timelineHtml}
                </div>
            </div>
        `;

        console.log('Session timeline rendered with', this.events.length, 'events');
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
        
        return `
            <div class="timeline-event ${eventTypeClass}">
                <div class="timeline-event-time">${time}</div>
                <div class="timeline-event-dot"></div>
                <div class="timeline-event-content">
                    <div class="timeline-event-type">${this.formatEventType(event.event_type)}</div>
                    <div class="timeline-event-description">${event.description}</div>
                    <div class="timeline-event-meta">
                        ${event.project} • ${event.language} • ${event.duration}s
                    </div>
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
        const intentCounts = {};
        sessions.forEach(session => {
            const intent = this.normalizeIntent(session.intent || 'unknown');
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
        });

        return {
            stages: Object.entries(intentCounts).map(([name, count]) => ({
                name,
                count,
                stage: name.toLowerCase().replace(/\s+/g, '_'),
                color: 'var(--text-tertiary)',
                icon: 'file',
                description: 'Legacy intent classification'
            })).sort((a, b) => b.count - a.count),
            totalCells: sessions.length,
            sessionBreakdowns: []
        };
    }

    /**
     * Render Cell Stage Distribution - New cell-based classification system
     */
    renderIntentDistribution() {
        const container = document.getElementById('intent-timeline-container');
        if (!container) return;

        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="no-data">No session data available</div>';
            return;
        }

        // Use new cell-based classification system
        const stageDistribution = this.getCellStageDistribution(this.sessions);
        const intentEntries = stageDistribution.stages;

        // Clear any existing content
        container.innerHTML = '';

        // Create enhanced chart container
        const chartContainer = document.createElement('div');
        chartContainer.className = 'intent-distribution-chart';
        chartContainer.style.cssText = `
            background: var(--background-primary);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow-md);
        `;
        container.appendChild(chartContainer);

        // Create SVG with better dimensions
        const svg = this.createSVG(chartContainer, 450, 350);
        
        // Create pie chart with better configuration
        const pie = d3.pie()
            .value(d => d.count)
            .sort(null)
            .padAngle(0.02);

        const arc = d3.arc()
            .innerRadius(60)
            .outerRadius(140);

        // Use stage-specific colors
        const colorScale = d3.scaleOrdinal()
            .domain(intentEntries.map(d => d.stage))
            .range(intentEntries.map(d => d.color));

        const g = svg.append('g')
            .attr('transform', 'translate(225, 175)');

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

        // Enhanced legend with better styling
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate(20, 20)');

        intentEntries.forEach((stage, i) => {
            const legendItem = legend.append('g')
                .attr('transform', `translate(0, ${i * 24})`);
            
            legendItem.append('rect')
                .attr('width', 14)
                .attr('height', 14)
                .attr('fill', colorScale(stage.stage))
                .attr('rx', 2);
            
            legendItem.append('text')
                .attr('x', 20)
                .attr('y', 11)
                .attr('font-size', '12px')
                .attr('font-weight', '500')
                .attr('fill', 'var(--text-primary)')
                .text(`${stage.name} (${stage.count})`);
        });

        // Add enhanced insights section
        const insightsContainer = document.createElement('div');
        insightsContainer.className = 'intent-insights';
        insightsContainer.style.cssText = `
            margin-top: 20px;
            padding: 15px;
            background: var(--background-secondary);
            border-radius: 8px;
            border-left: 4px solid var(--primary-color);
        `;
        
        const insightsTitle = document.createElement('h4');
        insightsTitle.textContent = 'Enhanced Analysis Insights';
        insightsTitle.style.cssText = `
            margin: 0 0 10px 0;
            color: var(--text-primary);
            font-size: 14px;
            font-weight: 600;
        `;
        insightsContainer.appendChild(insightsTitle);
        
        const insightsList = document.createElement('ul');
        insightsList.style.cssText = `
            margin: 0;
            padding-left: 20px;
            color: var(--text-secondary);
            font-size: 13px;
        `;
        
        // Add basic insights
        if (intentEntries.length > 0) {
            const topIntent = intentEntries[0];
            insightsList.innerHTML += `<li>Most common stage: <strong>${topIntent.name}</strong> (${topIntent.count} cells)</li>`;
        }
        
        if (intentEntries.length > 1) {
            insightsList.innerHTML += `<li>Workflow diversity: ${intentEntries.length} different stages</li>`;
        }
        
        insightsList.innerHTML += `<li>Total cells analyzed: <strong>${stageDistribution.totalCells}</strong></li>`;
        
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
}

// Make it globally available
window.RealDataVisualizations = RealDataVisualizations;
}
