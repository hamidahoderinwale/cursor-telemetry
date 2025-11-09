/**
 * Enhanced Cluster Map Visualization
 * Interactive UMAP-style visualization with detailed cluster analysis
 */

class EnhancedClusterMap {
    constructor() {
        this.sessions = [];
        this.clusters = [];
        this.umapData = [];
        this.selectedCluster = null;
        this.hoveredPoint = null;
        this.colorScheme = 'clusters';
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isLoading = false;
        this.lastUpdateTime = null;
        this.updateInterval = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        // NEW: Procedural clustering data
        this.proceduralData = {
            actions: [],
            sequences: [],
            goals: [],
            clusters: {
                by_action_type: {},
                by_sequence_pattern: {},
                by_goal_level: {},
                by_complexity: {},
                by_workflow_type: {}
            }
        };
        this.proceduralView = 'actions'; // 'actions', 'sequences', 'goals', 'clusters'
        this.proceduralLevel = 'action'; // 'action', 'task', 'process', 'procedure'
        
        // Color palettes
        this.colorPalettes = {
            clusters: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'],
            intent: {
                'explore': '#3B82F6',
                'data_exploration': '#10B981', 
                'EXPLORE': '#8B5CF6',
                'unknown': '#6B7280',
                'default': '#F59E0B'
            },
            outcome: {
                'success': '#10B981',
                'failure': '#EF4444',
                'in_progress': '#F59E0B',
                'IN_PROGRESS': '#F59E0B',
                'unknown': '#6B7280'
            },
            // NEW: Procedural color palettes
            action_types: {
                'create': '#10B981',
                'modify': '#3B82F6',
                'fix': '#EF4444',
                'test': '#F59E0B',
                'refactor': '#8B5CF6',
                'document': '#6B7280',
                'analyze': '#EC4899',
                'deploy': '#14B8A6',
                'unknown': '#9CA3AF'
            },
            sequence_patterns: {
                'create_then_test': '#10B981',
                'analyze_then_fix': '#EF4444',
                'create_modify_test': '#3B82F6',
                'iterative_modification': '#F59E0B',
                'plan_then_implement': '#8B5CF6',
                'debug_then_optimize': '#EC4899',
                'custom_sequence': '#6B7280'
            },
            goal_levels: {
                'immediate_task': '#F59E0B',
                'feature_development': '#3B82F6',
                'system_improvement': '#10B981',
                'project_goal': '#8B5CF6',
                'unknown': '#6B7280'
            },
            complexity_levels: {
                'low': '#10B981',
                'medium': '#F59E0B',
                'high': '#EF4444',
                'very_high': '#8B5CF6'
            },
            workflow_types: {
                'single_action': '#6B7280',
                'systematic': '#3B82F6',
                'iterative': '#F59E0B',
                'exploratory': '#EC4899'
            }
        };
    }

    /**
     * Initialize the enhanced cluster map
     */
    async initialize(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container not found:', containerId);
            return;
        }

        await this.loadData();
        this.render();
        this.startAutoRefresh();
        this.setupWebSocketListeners();
    }

    /**
     * Load session data and generate clusters including procedural analysis
     */
    async loadData() {
        if (this.isLoading) {
            console.log('Data loading already in progress, skipping...');
            return;
        }

        this.isLoading = true;
        this.showLoadingState();

        try {
            // Load both semantic and procedural data
            const [kuraResponse, proceduralResponse] = await Promise.allSettled([
                fetch('/api/sessions/analyze-with-kura', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(30000) // 30 second timeout
                }),
                fetch('/api/sessions/analyze-procedural', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(30000) // 30 second timeout
                })
            ]);

            // Process Kura data
            if (kuraResponse.status === 'fulfilled' && kuraResponse.value.ok) {
                const kuraData = await kuraResponse.value.json();
                if (kuraData.success) {
                    this.sessions = kuraData.sessions || [];
                    this.clusters = kuraData.clusters || [];
                    this.umapData = kuraData.umap_coordinates || [];
                }
            }

            // Process procedural data
            if (proceduralResponse.status === 'fulfilled' && proceduralResponse.value.ok) {
                const proceduralData = await proceduralResponse.value.json();
                if (proceduralData.success) {
                    this.proceduralData = {
                        actions: proceduralData.data.procedural_analyses || [],
                        sequences: this.extractSequences(proceduralData.data.procedural_analyses || []),
                        goals: this.extractGoals(proceduralData.data.procedural_analyses || []),
                        clusters: proceduralData.data.procedural_clusters || {},
                        aggregated_patterns: proceduralData.data.aggregated_patterns || {}
                    };
                }
            }

            let data;
            if (kuraResponse.status === 'fulfilled') {
                const response = kuraResponse.value;
                data = await response.json();
            } else {
                data = { success: false };
            }
            
            if (data.success) {
                this.sessions = data.sessions || [];
                this.umapData = data.umap_coordinates || [];
                this.clusters = data.clusters || [];
                this.lastUpdateTime = new Date();
                this.retryCount = 0; // Reset retry count on success
                
                // Enhance cluster data with detailed analysis
                this.enhanceClusterData();
                
                console.log(`✅ Loaded ${this.sessions.length} sessions, ${this.clusters.length} clusters`);
            } else {
                throw new Error(data.error || 'Failed to load cluster data');
            }
        } catch (error) {
            console.error('Error loading cluster data:', error);
            this.handleLoadError(error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle loading errors with retry logic
     */
    handleLoadError(error) {
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            console.log(`Retrying data load (${this.retryCount}/${this.maxRetries})...`);
            setTimeout(() => {
                this.loadData();
            }, Math.pow(2, this.retryCount) * 1000); // Exponential backoff
        } else {
            this.showErrorState(error.message);
            console.error('Max retries exceeded, stopping auto-refresh');
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        if (this.container) {
            const loadingHtml = `
                <div class="cluster-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading cluster analysis...</p>
                    <small>Analyzing ${this.sessions.length} sessions</small>
                </div>
            `;
            this.container.innerHTML = loadingHtml;
        }
    }

    /**
     * Show error state
     */
    showErrorState(message = 'Failed to load cluster data') {
        if (this.container) {
            const errorHtml = `
                <div class="cluster-empty">
                    <div class="cluster-empty-icon"></div>
                    <h3>Unable to Load Cluster Analysis</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.enhancedClusterMap.loadData()">
                        Retry
                    </button>
                </div>
            `;
            this.container.innerHTML = errorHtml;
        }
    }

    /**
     * Enhance cluster data with detailed analysis
     */
    enhanceClusterData() {
        this.clusters = this.clusters.map((cluster, index) => {
            const clusterSessions = this.sessions.filter(s => 
                cluster.sessions && cluster.sessions.includes(s.id)
            );
            
            // Analyze session patterns
            const patterns = this.analyzeSessionPatterns(clusterSessions);
            const subTasks = this.extractSubTasks(clusterSessions);
            const metrics = this.calculateClusterMetrics(clusterSessions);
            
            return {
                ...cluster,
                index,
                sessions: clusterSessions,
                patterns,
                subTasks,
                metrics,
                color: this.colorPalettes.clusters[index % this.colorPalettes.clusters.length],
                description: this.generateClusterDescription(clusterSessions, patterns)
            };
        });
    }

    /**
     * Analyze patterns within cluster sessions
     */
    analyzeSessionPatterns(sessions) {
        const patterns = {
            commonFiles: {},
            commonIntents: {},
            timePatterns: {},
            outcomePatterns: {}
        };

        sessions.forEach(session => {
            // File patterns
            if (session.primaryFile) {
                patterns.commonFiles[session.primaryFile] = (patterns.commonFiles[session.primaryFile] || 0) + 1;
            }
            
            // Intent patterns
            if (session.intent) {
                patterns.commonIntents[session.intent] = (patterns.commonIntents[session.intent] || 0) + 1;
            }
            
            // Time patterns
            if (session.timestamp) {
                const hour = new Date(session.timestamp).getHours();
                patterns.timePatterns[hour] = (patterns.timePatterns[hour] || 0) + 1;
            }
            
            // Outcome patterns
            if (session.outcome) {
                patterns.outcomePatterns[session.outcome] = (patterns.outcomePatterns[session.outcome] || 0) + 1;
            }
        });

        return patterns;
    }

    /**
     * Extract sub-tasks from session data
     */
    extractSubTasks(sessions) {
        const subTasks = [];
        
        // Group by file type
        const fileTypes = {};
        sessions.forEach(session => {
            if (session.primaryFile) {
                const ext = session.primaryFile.split('.').pop();
                if (!fileTypes[ext]) fileTypes[ext] = [];
                fileTypes[ext].push(session);
            }
        });

        // Create sub-tasks based on file types and intents
        Object.entries(fileTypes).forEach(([ext, fileSessions]) => {
            const intent = fileSessions[0]?.intent || 'unknown';
            subTasks.push({
                name: `Work with ${ext.toUpperCase()} files (${fileSessions.length})`,
                count: fileSessions.length,
                type: 'file_type',
                sessions: fileSessions
            });
        });

        // Group by intent
        const intentGroups = {};
        sessions.forEach(session => {
            const intent = session.intent || 'unknown';
            if (!intentGroups[intent]) intentGroups[intent] = [];
            intentGroups[intent].push(session);
        });

        Object.entries(intentGroups).forEach(([intent, intentSessions]) => {
            subTasks.push({
                name: `${intent.charAt(0).toUpperCase() + intent.slice(1)} tasks (${intentSessions.length})`,
                count: intentSessions.length,
                type: 'intent',
                sessions: intentSessions
            });
        });

        return subTasks.slice(0, 8); // Limit to top 8 sub-tasks
    }

    /**
     * Calculate cluster metrics with correlation analysis
     */
    calculateClusterMetrics(sessions) {
        const totalSessions = sessions.length;
        const successCount = sessions.filter(s => s.outcome === 'success').length;
        const avgDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / totalSessions;
        
        // Calculate correlation metrics
        const correlations = this.calculateCorrelations(sessions);
        
        // Calculate classification-based metrics
        const classificationMetrics = this.calculateClassificationMetrics(sessions);
        
        return {
            totalSessions,
            successRate: totalSessions > 0 ? (successCount / totalSessions * 100).toFixed(1) : 0,
            avgDuration: this.formatDuration(avgDuration),
            organizations: new Set(sessions.map(s => s.workspace || 'Unknown')).size,
            correlations,
            classificationMetrics
        };
    }

    /**
     * Calculate correlation metrics between different session attributes
     */
    calculateCorrelations(sessions) {
        if (sessions.length < 2) return {};

        // Extract numerical data for correlation analysis
        const durations = sessions.map(s => s.duration || 0);
        const codeChanges = sessions.map(s => (s.codeDeltas ? s.codeDeltas.length : 0) + (s.fileChanges ? s.fileChanges.length : 0));
        const conversations = sessions.map(s => s.conversations ? s.conversations.length : 0);
        const successRates = sessions.map(s => s.outcome === 'success' ? 1 : 0);

        return {
            durationVsSuccess: this.calculatePearsonCorrelation(durations, successRates),
            codeChangesVsDuration: this.calculatePearsonCorrelation(codeChanges, durations),
            conversationsVsSuccess: this.calculatePearsonCorrelation(conversations, successRates),
            codeChangesVsConversations: this.calculatePearsonCorrelation(codeChanges, conversations)
        };
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    calculatePearsonCorrelation(x, y) {
        const n = x.length;
        if (n === 0) return 0;

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
        const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Calculate classification-based metrics
     */
    calculateClassificationMetrics(sessions) {
        // Simulate classification scores based on session characteristics
        const metrics = {
            complexityScore: 0,
            riskScore: 0,
            productivityScore: 0,
            qualityScore: 0,
            flaggedSessions: 0
        };

        sessions.forEach(session => {
            // Complexity score based on code changes and file types
            const codeComplexity = (session.codeDeltas ? session.codeDeltas.length : 0) * 0.1;
            const fileComplexity = (session.fileChanges ? session.fileChanges.length : 0) * 0.05;
            metrics.complexityScore += codeComplexity + fileComplexity;

            // Risk score based on outcome and duration
            const riskFactor = session.outcome === 'failure' ? 0.3 : 0.1;
            const durationRisk = (session.duration || 0) > 3600 ? 0.2 : 0.1; // Long sessions are riskier
            metrics.riskScore += riskFactor + durationRisk;

            // Productivity score based on success rate and efficiency
            const productivityFactor = session.outcome === 'success' ? 0.4 : 0.1;
            const efficiencyFactor = (session.duration || 0) < 1800 ? 0.3 : 0.1; // Short successful sessions
            metrics.productivityScore += productivityFactor + efficiencyFactor;

            // Quality score based on conversations and outcomes
            const qualityFactor = session.outcome === 'success' ? 0.5 : 0.2;
            const conversationQuality = (session.conversations ? session.conversations.length : 0) * 0.1;
            metrics.qualityScore += qualityFactor + conversationQuality;

            // Flagged sessions (simulate based on risk factors)
            if (metrics.riskScore > 0.5 || session.outcome === 'failure') {
                metrics.flaggedSessions++;
            }
        });

        // Normalize scores
        const totalSessions = sessions.length;
        metrics.complexityScore = (metrics.complexityScore / totalSessions).toFixed(2);
        metrics.riskScore = (metrics.riskScore / totalSessions).toFixed(2);
        metrics.productivityScore = (metrics.productivityScore / totalSessions).toFixed(2);
        metrics.qualityScore = (metrics.qualityScore / totalSessions).toFixed(2);
        metrics.flaggedFraction = totalSessions > 0 ? (metrics.flaggedSessions / totalSessions).toFixed(2) : 0;

        return metrics;
    }

    /**
     * Generate cluster description
     */
    generateClusterDescription(sessions, patterns) {
        const topIntent = Object.entries(patterns.commonIntents)
            .sort(([,a], [,b]) => b - a)[0];
        const topFile = Object.entries(patterns.commonFiles)
            .sort(([,a], [,b]) => b - a)[0];
        
        let description = `This cluster contains ${sessions.length} sessions focused on `;
        
        if (topIntent) {
            description += `${topIntent[0]} tasks`;
        }
        
        if (topFile) {
            description += `, primarily working with ${topFile[0]} files`;
        }
        
        description += `. The sessions show a success rate of ${this.calculateClusterMetrics(sessions).successRate}% and represent `;
        description += `${this.calculateClusterMetrics(sessions).organizations} different workspaces.`;
        
        return description;
    }

    /**
     * Render the enhanced cluster map
     */
    render() {
        this.container.innerHTML = `
            <div class="enhanced-cluster-map">
                <div class="cluster-map-header">
                    <div class="cluster-header-left">
                        <h2>Session Cluster Analysis</h2>
                        ${this.lastUpdateTime ? `<small class="last-update">Last updated: ${this.lastUpdateTime.toLocaleTimeString()}</small>` : ''}
                    </div>
                    <div class="cluster-controls">
                        <select id="color-scheme" onchange="window.enhancedClusterMap.setColorScheme(this.value)">
                            <option value="clusters">Color by Clusters</option>
                            <option value="intent">Color by Intent</option>
                            <option value="outcome">Color by Outcome</option>
                            <option value="action_types">Color by Action Types</option>
                            <option value="sequence_patterns">Color by Sequence Patterns</option>
                            <option value="goal_levels">Color by Goal Levels</option>
                            <option value="complexity_levels">Color by Complexity</option>
                            <option value="workflow_types">Color by Workflow Types</option>
                        </select>
                        <select id="procedural-view" onchange="window.enhancedClusterMap.setProceduralView(this.value)">
                            <option value="actions">Action Level</option>
                            <option value="sequences">Sequence Level</option>
                            <option value="goals">Goal Level</option>
                            <option value="clusters">Procedural Clusters</option>
                        </select>
                        <button class="btn btn-sm" onclick="window.enhancedClusterMap.refresh()" title="Refresh data">
                            <span class="refresh-icon"></span> Refresh
                        </button>
                        <button class="btn btn-sm" onclick="window.enhancedClusterMap.resetView()" title="Reset zoom and pan">Reset View</button>
                    </div>
                </div>
                
                <div class="cluster-map-content">
                    <div class="cluster-sidebar">
                        <div class="cluster-list">
                            <h3>Clusters (${this.clusters.length})</h3>
                            <div class="cluster-items">
                                ${this.renderClusterList()}
                            </div>
                        </div>
                        
                        <!-- NEW: Procedural Analysis Sidebar -->
                        <div class="procedural-sidebar">
                            <h3>Procedural Analysis</h3>
                            <div class="procedural-stats">
                                <div class="procedural-stat">
                                    <div class="stat-value">${this.proceduralData.actions.length}</div>
                                    <div class="stat-label">Total Actions</div>
                                </div>
                                <div class="procedural-stat">
                                    <div class="stat-value">${this.proceduralData.sequences.length}</div>
                                    <div class="stat-label">Sequences</div>
                                </div>
                                <div class="procedural-stat">
                                    <div class="stat-value">${this.proceduralData.goals.length}</div>
                                    <div class="stat-label">Goals</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="cluster-visualization">
                        <div class="visualization-container">
                            <svg id="cluster-svg" width="100%" height="600"></svg>
                        </div>
                        
                        <!-- NEW: Procedural Visualization Container -->
                        <div class="procedural-visualization-container">
                            ${this.renderProceduralVisualizationContent()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.renderVisualization();
        this.setupEventListeners();
    }

    /**
     * Render cluster list in sidebar with correlation and classification metrics
     */
    renderClusterList() {
        return this.clusters.map((cluster, index) => `
            <div class="cluster-item ${this.selectedCluster === index ? 'selected' : ''}" 
                 onclick="window.enhancedClusterMap.selectCluster(${index})">
                <div class="cluster-header">
                    <div class="cluster-color" style="background-color: ${cluster.color}"></div>
                    <div class="cluster-info">
                        <div class="cluster-name">${cluster.name}</div>
                        <div class="cluster-stats">${cluster.metrics.totalSessions} sessions (${cluster.metrics.successRate}% success)</div>
                    </div>
                </div>
                <div class="cluster-description">${cluster.description}</div>
                
                <!-- Correlation Metrics -->
                <div class="cluster-metrics">
                    <div class="metric-group">
                        <div class="metric-label">Correlations (r-scores):</div>
                        <div class="correlation-metrics">
                            ${this.renderCorrelationMetrics(cluster.metrics.correlations)}
                        </div>
                    </div>
                    
                    <div class="metric-group">
                        <div class="metric-label">Classification Scores:</div>
                        <div class="classification-metrics">
                            ${this.renderClassificationMetrics(cluster.metrics.classificationMetrics)}
                        </div>
                    </div>
                </div>
                
                <div class="cluster-subtasks">
                    ${cluster.subTasks.slice(0, 3).map(task => `
                        <div class="subtask">${task.name}</div>
                    `).join('')}
                    ${cluster.subTasks.length > 3 ? `<div class="more-tasks">+${cluster.subTasks.length - 3} more</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Render correlation metrics
     */
    renderCorrelationMetrics(correlations) {
        if (!correlations || Object.keys(correlations).length === 0) {
            return '<div class="no-metrics">No correlation data</div>';
        }

        const metrics = [
            { key: 'durationVsSuccess', label: 'Duration vs Success', value: correlations.durationVsSuccess },
            { key: 'codeChangesVsDuration', label: 'Code Changes vs Duration', value: correlations.codeChangesVsDuration },
            { key: 'conversationsVsSuccess', label: 'Conversations vs Success', value: correlations.conversationsVsSuccess },
            { key: 'codeChangesVsConversations', label: 'Code Changes vs Conversations', value: correlations.codeChangesVsConversations }
        ];

        return metrics.map(metric => `
            <div class="correlation-metric">
                <span class="correlation-label">${metric.label}:</span>
                <span class="correlation-value ${this.getCorrelationStrength(metric.value)}">${metric.value.toFixed(2)}</span>
            </div>
        `).join('');
    }

    /**
     * Render classification metrics
     */
    renderClassificationMetrics(metrics) {
        if (!metrics) {
            return '<div class="no-metrics">No classification data</div>';
        }

        return `
            <div class="classification-metric">
                <span class="classification-label">Complexity:</span>
                <span class="classification-value">${metrics.complexityScore}</span>
            </div>
            <div class="classification-metric">
                <span class="classification-label">Risk:</span>
                <span class="classification-value risk-${this.getRiskLevel(metrics.riskScore)}">${metrics.riskScore}</span>
            </div>
            <div class="classification-metric">
                <span class="classification-label">Productivity:</span>
                <span class="classification-value">${metrics.productivityScore}</span>
            </div>
            <div class="classification-metric">
                <span class="classification-label">Quality:</span>
                <span class="classification-value">${metrics.qualityScore}</span>
            </div>
            <div class="classification-metric">
                <span class="classification-label">Flagged:</span>
                <span class="classification-value flagged-${this.getFlaggedLevel(metrics.flaggedFraction)}">${(metrics.flaggedFraction * 100).toFixed(1)}%</span>
            </div>
        `;
    }

    /**
     * Get correlation strength class
     */
    getCorrelationStrength(value) {
        const abs = Math.abs(value);
        if (abs >= 0.7) return 'strong';
        if (abs >= 0.4) return 'moderate';
        if (abs >= 0.2) return 'weak';
        return 'negligible';
    }

    /**
     * Get risk level class
     */
    getRiskLevel(value) {
        const num = parseFloat(value);
        if (num >= 0.3) return 'high';
        if (num >= 0.2) return 'medium';
        return 'low';
    }

    /**
     * Get flagged level class
     */
    getFlaggedLevel(value) {
        const num = parseFloat(value);
        if (num >= 0.3) return 'high';
        if (num >= 0.1) return 'medium';
        return 'low';
    }

    /**
     * Render the main visualization
     */
    renderVisualization() {
        const svg = d3.select('#cluster-svg');
        svg.selectAll('*').remove();

        const width = 800;
        const height = 600;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };

        // Create scales
        const xExtent = d3.extent(this.umapData, d => d.x);
        const yExtent = d3.extent(this.umapData, d => d.y);
        
        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([margin.left, width - margin.right]);
            
        const yScale = d3.scaleLinear()
            .domain(yExtent)
            .range([height - margin.bottom, margin.top]);

        // Create main group
        const g = svg.append('g')
            .attr('transform', `translate(${this.panOffset.x}, ${this.panOffset.y}) scale(${this.zoomLevel})`);

        // Add axes
        const xAxis = d3.axisBottom(xScale).tickSize(0).tickFormat('');
        const yAxis = d3.axisLeft(yScale).tickSize(0).tickFormat('');

        g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${height - margin.bottom})`)
            .call(xAxis)
            .style('color', '#666');

        g.append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(yAxis)
            .style('color', '#666');

        // Add axis labels
        g.append('text')
            .attr('class', 'x-label')
            .attr('x', width / 2)
            .attr('y', height - 5)
            .style('text-anchor', 'middle')
            .style('fill', '#666')
            .style('font-size', '12px')
            .text('UMAP Dimension 1');

        g.append('text')
            .attr('class', 'y-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', 15)
            .style('text-anchor', 'middle')
            .style('fill', '#666')
            .style('font-size', '12px')
            .text('UMAP Dimension 2');

        // Render points
        const points = g.selectAll('.data-point')
            .data(this.umapData)
            .enter()
            .append('circle')
            .attr('class', 'data-point')
            .attr('cx', d => xScale(d.x))
            .attr('cy', d => yScale(d.y))
            .attr('r', 4)
            .attr('fill', d => this.getPointColor(d))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => this.handlePointHover(event, d))
            .on('mouseout', () => this.handlePointLeave())
            .on('click', (event, d) => this.handlePointClick(event, d));

        // Add cluster labels
        this.renderClusterLabels(g, xScale, yScale);
    }

    /**
     * Get color for a data point based on current color scheme
     */
    getPointColor(d) {
        switch (this.colorScheme) {
            case 'intent':
                return this.colorPalettes.intent[d.intent] || this.colorPalettes.intent.default;
            case 'outcome':
                return this.colorPalettes.outcome[d.outcome] || this.colorPalettes.outcome.unknown;
            case 'clusters':
            default:
                const cluster = this.clusters.find(c => c.sessions && c.sessions.includes(d.session_id));
                return cluster ? cluster.color : '#ccc';
        }
    }

    /**
     * Render cluster labels
     */
    renderClusterLabels(g, xScale, yScale) {
        this.clusters.forEach(cluster => {
            if (cluster.sessions && cluster.sessions.length > 0) {
                // Calculate cluster center
                const clusterPoints = this.umapData.filter(d => 
                    cluster.sessions.includes(d.session_id)
                );
                
                if (clusterPoints.length > 0) {
                    const centerX = d3.mean(clusterPoints, d => d.x);
                    const centerY = d3.mean(clusterPoints, d => d.y);
                    
                    // Add cluster label
                    g.append('text')
                        .attr('class', 'cluster-label')
                        .attr('x', xScale(centerX))
                        .attr('y', yScale(centerY) - 10)
                        .style('text-anchor', 'middle')
                        .style('font-size', '12px')
                        .style('font-weight', 'bold')
                        .style('fill', cluster.color)
                        .style('pointer-events', 'none')
                        .text(cluster.name);
                }
            }
        });
    }

    /**
     * Handle point hover
     */
    handlePointHover(event, d) {
        this.hoveredPoint = d;
        
        // Highlight point
        d3.select(event.target)
            .attr('r', 6)
            .attr('stroke-width', 2);
        
        // Show tooltip
        this.showTooltip(event, d);
    }

    /**
     * Handle point leave
     */
    handlePointLeave() {
        this.hoveredPoint = null;
        
        // Reset point
        d3.selectAll('.data-point')
            .attr('r', 4)
            .attr('stroke-width', 1);
        
        // Hide tooltip
        this.hideTooltip();
    }

    /**
     * Handle point click
     */
    handlePointClick(event, d) {
        // Find which cluster this point belongs to
        const clusterIndex = this.clusters.findIndex(c => 
            c.sessions && c.sessions.includes(d.session_id)
        );
        
        if (clusterIndex !== -1) {
            this.selectCluster(clusterIndex);
        }
    }

    /**
     * Show tooltip
     */
    showTooltip(event, d) {
        const session = this.sessions.find(s => s.id === d.session_id);
        if (!session) return;

        const tooltip = d3.select('body').append('div')
            .attr('class', 'cluster-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');

        tooltip.html(`
            <div><strong>Session:</strong> ${session.id}</div>
            <div><strong>Intent:</strong> ${session.intent || 'Unknown'}</div>
            <div><strong>Outcome:</strong> ${session.outcome || 'Unknown'}</div>
            <div><strong>File:</strong> ${session.primaryFile || 'None'}</div>
            <div><strong>Duration:</strong> ${this.formatDuration(session.duration || 0)}</div>
        `);

        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 10) + 'px');
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        d3.selectAll('.cluster-tooltip').remove();
    }

    /**
     * Select a cluster
     */
    selectCluster(index) {
        this.selectedCluster = index;
        this.render(); // Re-render to update selection
    }

    /**
     * Set color scheme
     */
    setColorScheme(scheme) {
        this.colorScheme = scheme;
        this.renderVisualization();
    }

    /**
     * Reset view
     */
    resetView() {
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.renderVisualization();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add zoom and pan functionality
        const svg = d3.select('#cluster-svg');
        
        const zoom = d3.zoom()
            .scaleExtent([0.5, 3])
            .on('zoom', (event) => {
                this.zoomLevel = event.transform.k;
                this.panOffset = { x: event.transform.x, y: event.transform.y };
                this.renderVisualization();
            });

        svg.call(zoom);
    }

    /**
     * Start automatic refresh of cluster data
     */
    startAutoRefresh() {
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Refresh every 30 seconds
        this.updateInterval = setInterval(() => {
            if (!this.isLoading) {
                console.log(' Auto-refreshing cluster data...');
                this.loadData();
            }
        }, 30000);

        console.log('✅ Auto-refresh started (30s interval)');
    }

    /**
     * Stop automatic refresh
     */
    stopAutoRefresh() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('Auto-refresh stopped');
        }
    }

    /**
     * Setup WebSocket listeners for real-time updates
     */
    setupWebSocketListeners() {
        // Check if Socket.IO is available
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not available, skipping WebSocket setup');
            return;
        }

        // Listen for session updates
        if (window.dashboard && window.dashboard.socket) {
            window.dashboard.socket.on('sessions-update', (sessions) => {
                console.log('📡 Received real-time session update:', sessions.length, 'sessions');
                this.handleSessionUpdate(sessions);
            });

            window.dashboard.socket.on('live-durations-update', (durations) => {
                console.log('📡 Received live duration update');
                this.handleDurationUpdate(durations);
            });
        }
    }

    /**
     * Handle real-time session updates
     */
    handleSessionUpdate(sessions) {
        const previousCount = this.sessions.length;
        
        if (sessions.length !== previousCount) {
            console.log(`Session count changed: ${previousCount} → ${sessions.length}`);
            
            // Debounce updates to avoid excessive refreshes
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this.loadData();
            }, 2000);
        }
    }

    /**
     * Handle live duration updates
     */
    handleDurationUpdate(durations) {
        // Update session durations in real-time without full reload
        Object.entries(durations).forEach(([sessionId, durationData]) => {
            const session = this.sessions.find(s => s.id === sessionId);
            if (session) {
                session.duration = durationData.duration;
                session.formattedDuration = durationData.formatted;
            }
        });

        // Re-render visualization to show updated durations
        if (this.sessions.length > 0) {
            this.renderVisualization();
        }
    }

    /**
     * Manual refresh method
     */
    async refresh() {
        console.log(' Manual refresh triggered');
        await this.loadData();
        this.render();
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.stopAutoRefresh();
        
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        // Remove WebSocket listeners
        if (window.dashboard && window.dashboard.socket) {
            window.dashboard.socket.off('sessions-update');
            window.dashboard.socket.off('live-durations-update');
        }

        console.log(' Enhanced cluster map cleaned up');
    }

    /**
     * Format duration
     */
    formatDuration(seconds) {
        if (!seconds) return '0s';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    /**
     * NEW: Extract sequences from procedural analyses
     */
    extractSequences(proceduralAnalyses) {
        const allSequences = [];
        proceduralAnalyses.forEach(analysis => {
            if (analysis.procedural_analysis && analysis.procedural_analysis.sequences) {
                analysis.procedural_analysis.sequences.forEach(sequence => {
                    allSequences.push({
                        ...sequence,
                        sessionId: analysis.sessionId,
                        session: analysis.session
                    });
                });
            }
        });
        return allSequences;
    }

    /**
     * NEW: Extract goals from procedural analyses
     */
    extractGoals(proceduralAnalyses) {
        const allGoals = [];
        proceduralAnalyses.forEach(analysis => {
            if (analysis.procedural_analysis && analysis.procedural_analysis.goals) {
                analysis.procedural_analysis.goals.forEach(goal => {
                    allGoals.push({
                        ...goal,
                        sessionId: analysis.sessionId,
                        session: analysis.session
                    });
                });
            }
        });
        return allGoals;
    }

    /**
     * NEW: Render procedural visualization
     */
    renderProceduralVisualization() {
        const container = this.container.querySelector('.cluster-map-content');
        if (!container) return;

        // Create procedural visualization container
        let proceduralContainer = container.querySelector('.procedural-visualization');
        if (!proceduralContainer) {
            proceduralContainer = document.createElement('div');
            proceduralContainer.className = 'procedural-visualization';
            container.appendChild(proceduralContainer);
        }

        // Render based on current procedural view
        switch (this.proceduralView) {
            case 'actions':
                this.renderActionLevel(proceduralContainer);
                break;
            case 'sequences':
                this.renderSequenceLevel(proceduralContainer);
                break;
            case 'goals':
                this.renderGoalLevel(proceduralContainer);
                break;
            case 'clusters':
                this.renderProceduralClusters(proceduralContainer);
                break;
        }
    }

    /**
     * NEW: Set procedural view
     */
    setProceduralView(view, subview = null) {
        this.proceduralView = view;
        if (subview) {
            this.proceduralView = subview;
        }
        this.renderProceduralVisualization();
    }

    /**
     * NEW: Set procedural level
     */
    setProceduralLevel(level) {
        this.proceduralLevel = level;
        this.renderProceduralVisualization();
    }

    /**
     * NEW: Render procedural visualization content
     */
    renderProceduralVisualizationContent() {
        const actions = this.proceduralData.actions.flatMap(analysis => 
            analysis.procedural_analysis?.actions || []
        );
        const sequences = this.proceduralData.sequences;
        const goals = this.proceduralData.goals;

        return `
            <div class="procedural-content">
                <div class="procedural-tabs">
                    <button class="procedural-tab ${this.proceduralView === 'actions' ? 'active' : ''}" 
                            onclick="window.enhancedClusterMap.setProceduralView('actions')">
                        Actions (${actions.length})
                    </button>
                    <button class="procedural-tab ${this.proceduralView === 'sequences' ? 'active' : ''}" 
                            onclick="window.enhancedClusterMap.setProceduralView('sequences')">
                        Sequences (${sequences.length})
                    </button>
                    <button class="procedural-tab ${this.proceduralView === 'goals' ? 'active' : ''}" 
                            onclick="window.enhancedClusterMap.setProceduralView('goals')">
                        Goals (${goals.length})
                    </button>
                    <button class="procedural-tab ${this.proceduralView === 'clusters' ? 'active' : ''}" 
                            onclick="window.enhancedClusterMap.setProceduralView('clusters')">
                        Clusters
                    </button>
                </div>
                
                <div class="procedural-content-area">
                    ${this.renderCurrentProceduralView()}
                </div>
            </div>
        `;
    }

    /**
     * NEW: Render current procedural view
     */
    renderCurrentProceduralView() {
        switch (this.proceduralView) {
            case 'actions':
                return this.renderActionView();
            case 'sequences':
                return this.renderSequenceView();
            case 'goals':
                return this.renderGoalView();
            case 'clusters':
                return this.renderProceduralClusterView();
            default:
                return this.renderActionView();
        }
    }

    /**
     * NEW: Render action view
     */
    renderActionView() {
        const actions = this.proceduralData.actions.flatMap(analysis => 
            analysis.procedural_analysis?.actions || []
        );
        
        const actionTypes = {};
        actions.forEach(action => {
            actionTypes[action.action] = (actionTypes[action.action] || 0) + 1;
        });

        return `
            <div class="action-view">
                <h4>Action Distribution</h4>
                <div class="action-bars">
                    ${Object.entries(actionTypes).map(([type, count]) => `
                        <div class="action-bar">
                            <div class="action-label" style="color: ${this.colorPalettes.action_types[type] || '#6B7280'}">
                                ${type}
                            </div>
                            <div class="action-count">${count}</div>
                            <div class="action-bar-fill" style="width: ${(count / Math.max(...Object.values(actionTypes))) * 100}%; background-color: ${this.colorPalettes.action_types[type] || '#6B7280'}"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * NEW: Render sequence view
     */
    renderSequenceView() {
        const sequences = this.proceduralData.sequences;
        
        const patterns = {};
        sequences.forEach(sequence => {
            patterns[sequence.pattern] = (patterns[sequence.pattern] || 0) + 1;
        });

        return `
            <div class="sequence-view">
                <h4>Sequence Patterns</h4>
                <div class="sequence-grid">
                    ${Object.entries(patterns).map(([pattern, count]) => `
                        <div class="sequence-card" style="border-color: ${this.colorPalettes.sequence_patterns[pattern] || '#6B7280'}">
                            <div class="sequence-pattern">${pattern.replace(/_/g, ' ')}</div>
                            <div class="sequence-count">${count}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * NEW: Render goal view
     */
    renderGoalView() {
        const goals = this.proceduralData.goals;
        
        const levels = {};
        goals.forEach(goal => {
            levels[goal.level] = (levels[goal.level] || 0) + 1;
        });

        return `
            <div class="goal-view">
                <h4>Goal Hierarchy</h4>
                <div class="hierarchy-tree">
                    ${Object.entries(levels).map(([level, count]) => `
                        <div class="hierarchy-node" style="border-left-color: ${this.colorPalettes.goal_levels[level] || '#6B7280'}">
                            <div class="hierarchy-level">${level.replace(/_/g, ' ')}</div>
                            <div class="hierarchy-count">${count} goals</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * NEW: Render procedural cluster view
     */
    renderProceduralClusterView() {
        const clusters = this.proceduralData.clusters;
        const clusterType = 'by_action_type';
        const clusterData = clusters[clusterType] || {};

        return `
            <div class="procedural-cluster-view">
                <h4>Procedural Clusters</h4>
                <div class="cluster-grid">
                    ${Object.entries(clusterData).map(([key, sessionIds]) => `
                        <div class="cluster-card">
                            <div class="cluster-header">
                                <div class="cluster-name">${key}</div>
                                <div class="cluster-size">${sessionIds.length} sessions</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// Make it globally available
window.EnhancedClusterMap = EnhancedClusterMap;
