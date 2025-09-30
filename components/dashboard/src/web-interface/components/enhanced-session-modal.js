/**
 * Enhanced Session Modal with Program Slicing Integration
 * Provides detailed code change analysis with dependency visualization
 */

class EnhancedSessionModal {
    constructor() {
        this.programSlicingService = null;
        this.currentSession = null;
        this.slicingAnalysis = null;
        this.dependencyVisualization = null;
    }

    /**
     * Initialize the enhanced session modal
     */
    async initialize() {
        try {
            // Use the global ProgramSlicingService if available
            if (window.ProgramSlicingService) {
                this.programSlicingService = new window.ProgramSlicingService({
                    enableAST: true,
                    enableSemantic: true,
                    enableLLVM: false // Disabled due to compatibility issues
                });
            } else {
                // Fallback: try dynamic import
                const { ProgramSlicingService } = await import('../../services/program-slicing-service.js');
                this.programSlicingService = new ProgramSlicingService({
                    enableAST: true,
                    enableSemantic: true,
                    enableLLVM: false // Disabled due to compatibility issues
                });
            }
            
            console.log('Enhanced Session Modal initialized with program slicing');
        } catch (error) {
            console.error('Failed to initialize enhanced session modal:', error);
        }
    }

    /**
     * Show enhanced session details with program slicing analysis
     */
    async showEnhancedSessionDetails(session) {
        this.currentSession = session;
        
        try {
            // Show loading modal first
            const loadingContent = this.generateLoadingModalContent(session);
            this.displayModal(loadingContent);
            
            // Perform program slicing analysis with progress updates
            this.slicingAnalysis = await this.performAnalysisWithProgress(session.id, session);
            
            // Create enhanced modal content
            const modalContent = this.generateEnhancedModalContent(session, this.slicingAnalysis);
            
            // Update the modal with the analysis results
            this.updateModalContent(modalContent);
            
            // Initialize dependency visualization
            this.initializeDependencyVisualization();
            
        } catch (error) {
            console.error('Error showing enhanced session details:', error);
            // Show error modal
            const errorContent = this.generateErrorModalContent(session, error);
            this.updateModalContent(errorContent);
        }
    }

    /**
     * Generate loading modal content
     */
    generateLoadingModalContent(session) {
        return `
            <div class="modal-overlay enhanced-session-modal" id="enhancedSessionModal">
                <div class="modal-content enhanced-modal-content">
                    <div class="modal-header">
                        <h3 class="enhanced-session-title">
                            <span class="session-icon"></span>
                            Enhanced Analysis: ${this.formatIntent(session.intent)}
                        </h3>
                        <button class="modal-close" onclick="window.enhancedSessionModal.closeEnhancedModal()">×</button>
                    </div>
                    
                    <div class="modal-body enhanced-modal-body">
                        <div class="loading-container">
                            <div class="loading-spinner"></div>
                            <h4>Analyzing Code Dependencies...</h4>
                            <p>Performing program slicing analysis to identify code relationships and impact.</p>
                            <div class="loading-steps">
                                <div class="loading-step active">Parsing code structure</div>
                                <div class="loading-step">Analyzing dependencies</div>
                                <div class="loading-step">Calculating impact scores</div>
                                <div class="loading-step">Generating insights</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate error modal content
     */
    generateErrorModalContent(session, error) {
        return `
            <div class="modal-overlay enhanced-session-modal" id="enhancedSessionModal">
                <div class="modal-content enhanced-modal-content">
                    <div class="modal-header">
                        <h3 class="enhanced-session-title">
                            <span class="session-icon"></span>
                            Analysis Error: ${this.formatIntent(session.intent)}
                        </h3>
                        <button class="modal-close" onclick="window.enhancedSessionModal.closeEnhancedModal()">×</button>
                    </div>
                    
                    <div class="modal-body enhanced-modal-body">
                        <div class="error-container">
                            <div class="error-icon"></div>
                            <h4>Analysis Failed</h4>
                            <p>Unable to perform program slicing analysis for this session.</p>
                            <div class="error-details">
                                <strong>Error:</strong> ${error.message || 'Unknown error occurred'}
                            </div>
                            <div class="error-actions">
                                <button class="btn btn-primary" onclick="window.enhancedSessionModal.retryAnalysis()">
                                    Retry Analysis
                                </button>
                                <button class="btn btn-secondary" onclick="window.enhancedSessionModal.showBasicSessionDetails()">
                                    Show Basic Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate enhanced modal content with slicing analysis
     */
    generateEnhancedModalContent(session, slicingAnalysis) {
        return `
            <div class="modal-overlay enhanced-session-modal" id="enhancedSessionModal">
                <div class="modal-content enhanced-modal-content">
                    <div class="modal-header">
                        <h3 class="enhanced-session-title">
                            <span class="session-icon"></span>
                            Enhanced Analysis: ${this.formatIntent(session.intent)}
                        </h3>
                        <button class="modal-close" onclick="window.enhancedSessionModal.closeEnhancedModal()">×</button>
                    </div>
                    
                    <div class="modal-body enhanced-modal-body">
                        ${this.generateSessionOverview(session, slicingAnalysis)}
                        ${this.generateImpactAnalysis(slicingAnalysis)}
                        ${this.generateEnhancedTabs(session, slicingAnalysis)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate session overview with slicing insights
     */
    generateSessionOverview(session, slicingAnalysis) {
        const impactScore = slicingAnalysis.impactScore || 0;
        const totalChanges = slicingAnalysis.codeDeltas?.length || 0;
        const highImpactChanges = slicingAnalysis.impactAnalysis?.highImpactChanges || 0;
        
        return `
            <div class="session-overview enhanced-overview">
                <div class="overview-header">
                    <div class="session-basic-info">
                        <h2 class="session-title">${this.formatIntent(session.intent)}</h2>
                        <div class="session-badges">
                            <span class="event-type-badge ${this.getEventTypeClass(session.intent)}">${this.formatEventType(session.intent)}</span>
                            <span class="project-badge">${session.workspace || 'Unknown Workspace'}</span>
                            <span class="status-badge ${this.getStatusClass(session.outcome)}">${this.formatStatus(session.outcome)}</span>
                        </div>
                    </div>
                    
                    <div class="impact-score-display">
                        <div class="impact-score ${this.getImpactScoreClass(impactScore)}">
                            <div class="score-value">${impactScore}</div>
                            <div class="score-label">Impact Score</div>
                        </div>
                    </div>
                </div>
                
                <div class="overview-metrics">
                    <div class="metric-card">
                        <div class="metric-value">${totalChanges}</div>
                        <div class="metric-label">Code Changes</div>
                        <div class="metric-detail">${highImpactChanges} high impact</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${slicingAnalysis.impactAnalysis?.affectedFunctions?.size || 0}</div>
                        <div class="metric-label">Functions Affected</div>
                        <div class="metric-detail">${slicingAnalysis.impactAnalysis?.affectedVariables?.size || 0} variables</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">${slicingAnalysis.crossDeltaAnalysis?.dependencyChains?.length || 0}</div>
                        <div class="metric-label">Dependency Chains</div>
                        <div class="metric-detail">${slicingAnalysis.crossDeltaAnalysis?.potentialConflicts?.length || 0} conflicts</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate impact analysis section
     */
    generateImpactAnalysis(slicingAnalysis) {
        const impactAnalysis = slicingAnalysis.impactAnalysis;
        const crossAnalysis = slicingAnalysis.crossDeltaAnalysis;
        
        return `
            <div class="impact-analysis-section">
                <h3 class="section-title">
                    <span class="section-icon"></span>
                    Impact Analysis
                </h3>
                
                <div class="impact-score">
                    <div class="score-display">
                        <span class="score-label">Impact Score:</span>
                        <span class="score-value">${impactAnalysis.highImpactChanges + impactAnalysis.mediumImpactChanges + impactAnalysis.lowImpactChanges}</span>
                    </div>
                </div>
                
                ${crossAnalysis?.potentialConflicts?.length > 0 ? `
                    <div class="conflicts-warning">
                        <div class="warning-header">
                            <span class="warning-icon"></span>
                            <span class="warning-title">Potential Conflicts Detected</span>
                        </div>
                        <div class="conflicts-list">
                            ${crossAnalysis.potentialConflicts.map(conflict => `
                                <div class="conflict-item ${conflict.severity}">
                                    <span class="conflict-type">${conflict.type.replace('_', ' ')}</span>
                                    <span class="conflict-details">${conflict.variable || conflict.function}</span>
                                    <span class="conflict-severity">${conflict.severity}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Generate enhanced tabs with slicing information
     */
    generateEnhancedTabs(session, slicingAnalysis) {
        return `
            <div class="enhanced-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" onclick="window.enhancedSessionModal.switchEnhancedTab('overview')">Overview</button>
                    <button class="tab-btn" onclick="window.enhancedSessionModal.switchEnhancedTab('slicing')">Program Slicing</button>
                    <button class="tab-btn" onclick="window.enhancedSessionModal.switchEnhancedTab('dependencies')">Dependencies</button>
                    <button class="tab-btn" onclick="window.enhancedSessionModal.switchEnhancedTab('code')">Code Changes</button>
                    <button class="tab-btn" onclick="window.enhancedSessionModal.switchEnhancedTab('semantic')">Semantic Analysis</button>
                    <button class="tab-btn" onclick="window.enhancedSessionModal.switchEnhancedTab('insights')">AI Insights</button>
                </div>
                
                <div class="tab-content">
                    <div id="enhanced-tab-overview" class="tab-panel active">
                        ${this.generateOverviewTab(session, slicingAnalysis)}
                    </div>
                    
                    <div id="enhanced-tab-slicing" class="tab-panel">
                        ${this.generateSlicingTab(slicingAnalysis)}
                    </div>
                    
                    <div id="enhanced-tab-dependencies" class="tab-panel">
                        ${this.generateDependenciesTab(slicingAnalysis)}
                    </div>
                    
                    <div id="enhanced-tab-code" class="tab-panel">
                        ${this.generateEnhancedCodeTab(session, slicingAnalysis)}
                    </div>
                    
                    <div id="enhanced-tab-semantic" class="tab-panel">
                        ${this.generateSemanticTab(slicingAnalysis)}
                    </div>
                    
                    <div id="enhanced-tab-insights" class="tab-panel">
                        ${this.generateInsightsTab(session)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate overview tab content
     */
    generateOverviewTab(session, slicingAnalysis) {
        return `
            <div class="overview-tab-content">
                <div class="session-summary">
                    <h4>Session Summary</h4>
                    <p>This session involved <strong>${slicingAnalysis.codeDeltas?.length || 0} code changes</strong> with an impact score of <strong>${slicingAnalysis.impactScore || 0}/100</strong>.</p>
                    <p><strong>Intent:</strong> ${this.formatIntent(session.intent)}</p>
                    <p><strong>Outcome:</strong> ${this.formatStatus(session.outcome)}</p>
                    <p><strong>Duration:</strong> ${this.formatDuration(session.duration)}</p>
                </div>
                
                <div class="key-insights">
                    <h4>Key Insights</h4>
                    <ul class="insights-list">
                        ${this.generateKeyInsights(slicingAnalysis)}
                    </ul>
                </div>
                
                <div class="recommendations">
                    <h4>Recommendations</h4>
                    <ul class="recommendations-list">
                        ${this.generateRecommendations(slicingAnalysis)}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Generate program slicing tab content
     */
    generateSlicingTab(slicingAnalysis) {
        return `
            <div class="slicing-tab-content">
                <div class="slicing-overview">
                    <h4>Program Slicing Analysis</h4>
                    <p>Analysis of code dependencies and data flow relationships.</p>
                </div>
                
                <div class="slicing-results">
                    ${slicingAnalysis.codeDeltas?.map(delta => `
                        <div class="slicing-delta">
                            <div class="delta-header">
                                <h5>Code Delta ${delta.deltaId}</h5>
                                <div class="delta-metrics">
                                    <span class="metric">Complexity: ${delta.slicing?.complexity || 0}</span>
                                    <span class="metric">Impact: ${delta.slicing?.impactLevel || 'low'}</span>
                                    <span class="metric">Scope: ${delta.slicing?.affectedScope || 'local'}</span>
                                </div>
                            </div>
                            
                            <div class="delta-dependencies">
                                <div class="dependency-section">
                                    <h6>Data Dependencies</h6>
                                    <div class="dependency-list">
                                        ${delta.slicing?.dataDependencies?.map(dep => `
                                            <div class="dependency-item">
                                                <span class="dep-type">${dep.type}</span>
                                                <span class="dep-details">${dep.variable || dep.object}</span>
                                            </div>
                                        `).join('') || '<span class="no-deps">No data dependencies</span>'}
                                    </div>
                                </div>
                                
                                <div class="dependency-section">
                                    <h6>Control Dependencies</h6>
                                    <div class="dependency-list">
                                        ${delta.slicing?.controlDependencies?.map(dep => `
                                            <div class="dependency-item">
                                                <span class="dep-type">${dep.type}</span>
                                                <span class="dep-details">${dep.structure} (${dep.count})</span>
                                            </div>
                                        `).join('') || '<span class="no-deps">No control dependencies</span>'}
                                    </div>
                                </div>
                                
                                <div class="dependency-section">
                                    <h6>Function Calls</h6>
                                    <div class="dependency-list">
                                        ${delta.slicing?.functionCalls?.map(func => `
                                            <div class="dependency-item">
                                                <span class="dep-type">function</span>
                                                <span class="dep-details">${func.name}</span>
                                            </div>
                                        `).join('') || '<span class="no-deps">No function calls</span>'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('') || '<p>No slicing analysis available</p>'}
                </div>
            </div>
        `;
    }

    /**
     * Generate dependencies tab content
     */
    generateDependenciesTab(slicingAnalysis) {
        const crossAnalysis = slicingAnalysis.crossDeltaAnalysis;
        
        return `
            <div class="dependencies-tab-content">
                <div class="dependencies-overview">
                    <h4>Cross-Delta Dependencies</h4>
                    <p>Analysis of relationships between different code changes in this session.</p>
                </div>
                
                <div class="dependency-chains">
                    <h5>Dependency Chains</h5>
                    <div class="chains-list">
                        ${crossAnalysis?.dependencyChains?.map(chain => `
                            <div class="dependency-chain">
                                <div class="chain-header">
                                    <span class="chain-from">${chain.from}</span>
                                    <span class="chain-arrow">→</span>
                                    <span class="chain-to">${chain.to}</span>
                                    <span class="chain-strength">Strength: ${chain.strength}</span>
                                </div>
                                <div class="chain-dependencies">
                                    <div class="chain-vars">
                                        <strong>Variables:</strong> ${chain.dependencies.variables.join(', ') || 'None'}
                                    </div>
                                    <div class="chain-funcs">
                                        <strong>Functions:</strong> ${chain.dependencies.functions.join(', ') || 'None'}
                                    </div>
                                </div>
                            </div>
                        `).join('') || '<p>No dependency chains found</p>'}
                    </div>
                </div>
                
                <div class="shared-resources">
                    <h5>Shared Resources</h5>
                    <div class="shared-functions">
                        <h6>Shared Functions</h6>
                        <div class="shared-list">
                            ${Array.from(crossAnalysis?.sharedFunctions || []).map(func => `
                                <span class="shared-item">${func}</span>
                            `).join('') || '<span class="no-shared">No shared functions</span>'}
                        </div>
                    </div>
                    
                    <div class="shared-variables">
                        <h6>Shared Variables</h6>
                        <div class="shared-list">
                            ${Array.from(crossAnalysis?.sharedVariables || []).map(variable => `
                                <span class="shared-item">${variable}</span>
                            `).join('') || '<span class="no-shared">No shared variables</span>'}
                        </div>
                    </div>
                </div>
                
            </div>
        `;
    }

    /**
     * Generate enhanced code tab content
     */
    generateEnhancedCodeTab(session, slicingAnalysis) {
        return `
            <div class="enhanced-code-tab-content">
                <div class="code-analysis-header">
                    <h4>Enhanced Code Analysis</h4>
                    <p>Code changes with program slicing insights and dependency information.</p>
                </div>
                
                <div class="code-deltas-enhanced">
                    ${slicingAnalysis.codeDeltas?.map(delta => `
                        <div class="code-delta-enhanced">
                            <div class="delta-slicing-header">
                                <div class="slicing-metrics">
                                    <span class="slicing-metric complexity-${this.getComplexityClass(delta.slicing?.complexity || 0)}">
                                        Complexity: ${delta.slicing?.complexity || 0}
                                    </span>
                                    <span class="slicing-metric impact-${delta.slicing?.impactLevel || 'low'}">
                                        Impact: ${delta.slicing?.impactLevel || 'low'}
                                    </span>
                                    <span class="slicing-metric scope-${delta.slicing?.affectedScope || 'local'}">
                                        Scope: ${delta.slicing?.affectedScope || 'local'}
                                    </span>
                                </div>
                                <div class="slicing-actions">
                                    <button class="btn btn-sm btn-outline" onclick="window.enhancedSessionModal.showSlicingDetails('${delta.deltaId}')">
                                        View Dependencies
                                    </button>
                                </div>
                            </div>
                            
                            <div class="code-delta-content">
                                <div class="code-delta-header">
                                    <div class="code-delta-meta">
                                        <span class="change-type added">Added</span>
                                        <span class="file-path">${delta.originalDelta?.filePath || 'Unknown File'}</span>
                                        <span class="timestamp">${this.formatTimestamp(delta.originalDelta?.timestamp)}</span>
                                        <span class="cell-index">Cell ${delta.originalDelta?.cellIndex || 'Unknown'}</span>
                                    </div>
                                </div>
                                
                                <div class="code-delta-content">
                                    <div class="code-content">
                                        <pre><code>${this.highlightCodeWithDependencies(delta.originalDelta?.content || '', delta.slicing)}</code></pre>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="slicing-details-collapsed" id="slicing-details-${delta.deltaId}" style="display: none;">
                                ${this.generateSlicingDetails(delta.slicing)}
                            </div>
                        </div>
                    `).join('') || '<p>No code analysis available</p>'}
                </div>
            </div>
        `;
    }

    /**
     * Generate insights tab content
     */
    async generateInsightsTab(session) {
        try {
            // Fetch enhanced insights
            const response = await fetch(`/api/session/${session.id}/insights`);
            const data = await response.json();
            
            if (!data.success) {
                return `<div class="error-message">Failed to load insights: ${data.error}</div>`;
            }
            
            const insights = data.insights;
            
            return `
                <div class="insights-container">
                    <div class="insights-header">
                        <h3>AI-Powered Insights & Recommendations</h3>
                        <div class="insights-actions">
                            ${insights.memoryCandidates && insights.memoryCandidates.length > 0 ? `
                                <button class="btn btn-primary" onclick="window.enhancedSessionModal.autoCreateMemories('${session.id}')">
                                    <span class="btn-icon"></span>
                                    Auto-Create ${insights.memoryCandidates.length} Memories
                                </button>
                            ` : ''}
                            <button class="btn btn-secondary" onclick="window.enhancedSessionModal.refreshInsights('${session.id}')">
                                <span class="btn-icon"></span>
                                Refresh Insights
                            </button>
                        </div>
                    </div>
                    
                    <div class="insights-grid">
                        ${this.renderMemoryCandidates(insights.memoryCandidates)}
                        ${this.renderWorkflowInsights(insights.workflowInsights)}
                        ${this.renderPerformanceInsights(insights.performanceInsights)}
                        ${this.renderBestPractices(insights.bestPractices)}
                        ${this.renderDashboardSuggestions(insights.dashboardSuggestions)}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error generating insights tab:', error);
            return `<div class="error-message">Error loading insights: ${error.message}</div>`;
        }
    }

    /**
     * Render memory candidates
     */
    renderMemoryCandidates(candidates) {
        if (!candidates || candidates.length === 0) {
            return `
                <div class="insight-section">
                    <h4> Memory Candidates</h4>
                    <p class="no-insights">No reusable code patterns detected in this session.</p>
                </div>
            `;
        }

        // Show only top 3 most frequent patterns
        const topCandidates = candidates
            .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
            .slice(0, 3);

        return `
            <div class="insight-section">
                <h4>Memory Candidates (${candidates.length})</h4>
                <div class="memory-candidates">
                    ${topCandidates.map(candidate => `
                        <div class="memory-candidate">
                            <div class="memory-header">
                                <span class="memory-type">${candidate.type}</span>
                                <span class="memory-frequency">${candidate.frequency || 1}x</span>
                            </div>
                            <h5>${candidate.title}</h5>
                            <p>${candidate.description}</p>
                            <div class="memory-tags">
                                ${candidate.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                    ${candidates.length > 3 ? `<p class="more-info">+${candidates.length - 3} more patterns detected</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render workflow insights
     */
    renderWorkflowInsights(insights) {
        if (!insights || insights.length === 0) {
            return `
                <div class="insight-section">
                    <h4> Workflow Patterns</h4>
                    <p class="no-insights">No workflow patterns detected.</p>
                </div>
            `;
        }

        // Show only top 2 most confident patterns
        const topInsights = insights
            .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
            .slice(0, 2);

        return `
            <div class="insight-section">
                <h4>Workflow Patterns (${insights.length})</h4>
                <div class="workflow-insights">
                    ${topInsights.map(insight => `
                        <div class="workflow-insight">
                            <h5>${insight.description}</h5>
                            <div class="workflow-steps">
                                ${insight.steps.slice(0, 3).map(step => `<span class="step">${step}</span>`).join(' → ')}
                            </div>
                            <p class="suggestion">${insight.suggestion}</p>
                        </div>
                    `).join('')}
                    ${insights.length > 2 ? `<p class="more-info">+${insights.length - 2} more patterns detected</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render performance insights
     */
    renderPerformanceInsights(insights) {
        if (!insights || insights.length === 0) {
            return `
                <div class="insight-section">
                    <h4> Performance Opportunities</h4>
                    <p class="no-insights">No performance optimization opportunities detected.</p>
                </div>
            `;
        }

        // Show only high and medium impact opportunities
        const importantInsights = insights
            .filter(insight => insight.impact === 'high' || insight.impact === 'medium')
            .slice(0, 2);

        return `
            <div class="insight-section">
                <h4>Performance Opportunities (${insights.length})</h4>
                <div class="performance-insights">
                    ${importantInsights.map(insight => `
                        <div class="performance-insight impact-${insight.impact}">
                            <h5>${insight.description}</h5>
                            <div class="current-pattern">Current: ${insight.currentPattern}</div>
                            <div class="suggested-pattern">Suggested: ${insight.suggestedPattern}</div>
                            <span class="impact-badge">${insight.impact.toUpperCase()} IMPACT</span>
                        </div>
                    `).join('')}
                    ${insights.length > importantInsights.length ? `<p class="more-info">+${insights.length - importantInsights.length} more opportunities detected</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render best practices
     */
    renderBestPractices(practices) {
        if (!practices || practices.length === 0) {
            return `
                <div class="insight-section">
                    <h4> Best Practices</h4>
                    <p class="no-insights">All code follows best practices! </p>
                </div>
            `;
        }

        // Show only high priority practices
        const importantPractices = practices
            .filter(practice => practice.priority === 'high')
            .slice(0, 2);

        return `
            <div class="insight-section">
                <h4>Best Practices (${practices.length})</h4>
                <div class="best-practices">
                    ${importantPractices.map(practice => `
                        <div class="best-practice priority-${practice.priority}">
                            <h5>${practice.description}</h5>
                            <p>${practice.practice}</p>
                            <span class="priority-badge">${practice.priority.toUpperCase()} PRIORITY</span>
                        </div>
                    `).join('')}
                    ${practices.length > importantPractices.length ? `<p class="more-info">+${practices.length - importantPractices.length} more practices detected</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render dashboard suggestions
     */
    renderDashboardSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            return `
                <div class="insight-section">
                    <h4> Dashboard Enhancements</h4>
                    <p class="no-insights">No dashboard improvements suggested.</p>
                </div>
            `;
        }

        // Show only high priority suggestions
        const importantSuggestions = suggestions
            .filter(suggestion => suggestion.priority === 'high')
            .slice(0, 2);

        return `
            <div class="insight-section">
                <h4>Dashboard Enhancements (${suggestions.length})</h4>
                <div class="dashboard-suggestions">
                    ${importantSuggestions.map(suggestion => `
                        <div class="dashboard-suggestion priority-${suggestion.priority}">
                            <h5>${suggestion.suggestion}</h5>
                            <p>${suggestion.implementation}</p>
                            <span class="priority-badge">${suggestion.priority.toUpperCase()} PRIORITY</span>
                        </div>
                    `).join('')}
                    ${suggestions.length > importantSuggestions.length ? `<p class="more-info">+${suggestions.length - importantSuggestions.length} more suggestions available</p>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Generate semantic analysis tab content
     */
    generateSemanticTab(slicingAnalysis) {
        return `
            <div class="semantic-tab-content">
                <div class="semantic-overview">
                    <h4>Semantic Analysis</h4>
                    <p>Analysis of code intent, patterns, and semantic relationships.</p>
                </div>
                
                <div class="semantic-results">
                    ${slicingAnalysis.codeDeltas?.map(delta => `
                        <div class="semantic-delta">
                            <div class="semantic-header">
                                <h5>Code Delta ${delta.deltaId}</h5>
                            </div>
                            
                            <div class="semantic-analysis">
                                <div class="semantic-category">
                                    <h6>Intent Analysis</h6>
                                    <div class="semantic-details">
                                        <div class="detail-item">
                                            <span class="detail-label">Intent:</span>
                                            <span class="detail-value intent-${delta.semanticAnalysis?.intent || 'unknown'}">${delta.semanticAnalysis?.intent || 'unknown'}</span>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Category:</span>
                                            <span class="detail-value">${delta.semanticAnalysis?.category || 'general'}</span>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Risk Level:</span>
                                            <span class="detail-value risk-${delta.semanticAnalysis?.riskLevel || 'low'}">${delta.semanticAnalysis?.riskLevel || 'low'}</span>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Testability:</span>
                                            <span class="detail-value testability-${delta.semanticAnalysis?.testability || 'high'}">${delta.semanticAnalysis?.testability || 'high'}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="semantic-category">
                                    <h6>Patterns & Keywords</h6>
                                    <div class="semantic-details">
                                        <div class="detail-item">
                                            <span class="detail-label">Patterns:</span>
                                            <div class="patterns-list">
                                                ${delta.semanticAnalysis?.patterns?.map(pattern => `
                                                    <span class="pattern-tag">${pattern}</span>
                                                `).join('') || '<span class="no-patterns">No patterns detected</span>'}
                                            </div>
                                        </div>
                                        <div class="detail-item">
                                            <span class="detail-label">Keywords:</span>
                                            <div class="keywords-list">
                                                ${delta.semanticAnalysis?.keywords?.map(keyword => `
                                                    <span class="keyword-tag">${keyword}</span>
                                                `).join('') || '<span class="no-keywords">No keywords</span>'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                ${delta.astAnalysis ? `
                                    <div class="semantic-category">
                                        <h6>AST Analysis</h6>
                                        <div class="semantic-details">
                                            <div class="detail-item">
                                                <span class="detail-label">Language:</span>
                                                <span class="detail-value">${delta.astAnalysis.language}</span>
                                            </div>
                                            <div class="detail-item">
                                                <span class="detail-label">Functions:</span>
                                                <span class="detail-value">${delta.astAnalysis.functions.length}</span>
                                            </div>
                                            <div class="detail-item">
                                                <span class="detail-label">Variables:</span>
                                                <span class="detail-value">${delta.astAnalysis.variables.length}</span>
                                            </div>
                                            <div class="detail-item">
                                                <span class="detail-label">Imports:</span>
                                                <span class="detail-value">${delta.astAnalysis.imports.length}</span>
                                            </div>
                                            <div class="detail-item">
                                                <span class="detail-label">Complexity:</span>
                                                <span class="detail-value">${delta.astAnalysis.complexity}</span>
                                            </div>
                                            <div class="detail-item">
                                                <span class="detail-label">Nesting:</span>
                                                <span class="detail-value">${delta.astAnalysis.nesting}</span>
                                            </div>
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('') || '<p>No semantic analysis available</p>'}
                </div>
            </div>
        `;
    }

    // Helper methods

    generateKeyInsights(slicingAnalysis) {
        const insights = [];
        
        if (slicingAnalysis.impactScore > 70) {
            insights.push('<li>High impact changes detected - consider thorough testing</li>');
        }
        
        if (slicingAnalysis.impactAnalysis?.affectedFunctions?.size > 5) {
            insights.push('<li>Multiple functions affected - potential for side effects</li>');
        }
        
        if (slicingAnalysis.crossDeltaAnalysis?.potentialConflicts?.length > 0) {
            insights.push('<li>Potential conflicts detected between code changes</li>');
        }
        
        if (slicingAnalysis.crossDeltaAnalysis?.optimizationOpportunities?.length > 0) {
            insights.push('<li>Code optimization opportunities identified</li>');
        }
        
        if (insights.length === 0) {
            insights.push('<li>Low complexity changes with minimal impact</li>');
        }
        
        return insights.join('');
    }

    generateRecommendations(slicingAnalysis) {
        const recommendations = [];
        
        if (slicingAnalysis.impactScore > 70) {
            recommendations.push('<li>Consider breaking down high-impact changes into smaller, testable units</li>');
        }
        
        if (slicingAnalysis.crossDeltaAnalysis?.potentialConflicts?.length > 0) {
            recommendations.push('<li>Review and resolve potential conflicts before merging</li>');
        }
        
        if (slicingAnalysis.crossDeltaAnalysis?.optimizationOpportunities?.length > 0) {
            recommendations.push('<li>Consider refactoring to reduce code duplication</li>');
        }
        
        if (slicingAnalysis.impactAnalysis?.affectedFunctions?.size > 3) {
            recommendations.push('<li>Add comprehensive unit tests for affected functions</li>');
        }
        
        if (recommendations.length === 0) {
            recommendations.push('<li>Changes look good - minimal risk detected</li>');
        }
        
        return recommendations.join('');
    }

    generateSlicingDetails(slicing) {
        if (!slicing) return '<p>No slicing details available</p>';
        
        return `
            <div class="slicing-details-content">
                <div class="slicing-section">
                    <h6>Data Dependencies</h6>
                    <div class="dependency-list">
                        ${slicing.dataDependencies?.map(dep => `
                            <div class="dependency-item">
                                <span class="dep-type">${dep.type}</span>
                                <span class="dep-details">${dep.variable || dep.object}</span>
                            </div>
                        `).join('') || '<span class="no-deps">No data dependencies</span>'}
                    </div>
                </div>
                
                <div class="slicing-section">
                    <h6>Control Dependencies</h6>
                    <div class="dependency-list">
                        ${slicing.controlDependencies?.map(dep => `
                            <div class="dependency-item">
                                <span class="dep-type">${dep.type}</span>
                                <span class="dep-details">${dep.structure} (${dep.count})</span>
                            </div>
                        `).join('') || '<span class="no-deps">No control dependencies</span>'}
                    </div>
                </div>
                
                <div class="slicing-section">
                    <h6>Function Calls</h6>
                    <div class="dependency-list">
                        ${slicing.functionCalls?.map(func => `
                            <div class="dependency-item">
                                <span class="dep-type">function</span>
                                <span class="dep-details">${func.name}</span>
                            </div>
                        `).join('') || '<span class="no-deps">No function calls</span>'}
                    </div>
                </div>
            </div>
        `;
    }

    highlightCodeWithDependencies(code, slicing) {
        if (!slicing) return this.escapeHtml(code);
        
        let highlightedCode = this.escapeHtml(code);
        
        // Highlight function calls
        slicing.functionCalls?.forEach(func => {
            const regex = new RegExp(`\\b${func.name}\\b`, 'g');
            highlightedCode = highlightedCode.replace(regex, `<span class="highlight-function">${func.name}</span>`);
        });
        
        // Highlight variables
        slicing.variableUsage?.forEach(variable => {
            const regex = new RegExp(`\\b${variable.name}\\b`, 'g');
            highlightedCode = highlightedCode.replace(regex, `<span class="highlight-variable">${variable.name}</span>`);
        });
        
        return highlightedCode;
    }

    // Utility methods
    formatIntent(intent) {
        return intent ? intent.charAt(0).toUpperCase() + intent.slice(1) : 'Unknown';
    }

    formatEventType(eventType) {
        if (typeof eventType !== 'string') return 'Unknown';
        return eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }

    formatStatus(status) {
        return status ? status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown';
    }

    formatDuration(duration) {
        if (!duration) return 'Unknown';
        return typeof duration === 'number' ? `${duration}ms` : duration;
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        return new Date(timestamp).toLocaleTimeString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getEventTypeClass(eventType) {
        const type = eventType?.toLowerCase() || 'unknown';
        if (type.includes('explore')) return 'explore';
        if (type.includes('data')) return 'data';
        if (type.includes('model')) return 'model';
        return 'general';
    }

    getStatusClass(status) {
        const stat = status?.toLowerCase() || 'unknown';
        if (stat.includes('progress')) return 'in-progress';
        if (stat.includes('complete')) return 'completed';
        if (stat.includes('error')) return 'error';
        return 'unknown';
    }

    getImpactScoreClass(score) {
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    getComplexityClass(complexity) {
        if (complexity >= 15) return 'high';
        if (complexity >= 8) return 'medium';
        return 'low';
    }

    // Modal management methods
    displayModal(content) {
        // Remove existing modal if present
        const existingModal = document.getElementById('enhancedSessionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal to DOM
        document.body.insertAdjacentHTML('beforeend', content);
        
        // Add event listeners
        this.addModalEventListeners();
    }

    updateModalContent(content) {
        const modal = document.getElementById('enhancedSessionModal');
        if (modal) {
            modal.outerHTML = content;
            this.addModalEventListeners();
        }
    }

    retryAnalysis() {
        if (this.currentSession) {
            this.showEnhancedSessionDetails(this.currentSession);
        }
    }

    /**
     * Perform analysis with progress updates
     */
    async performAnalysisWithProgress(sessionId, session) {
        const steps = [
            'Parsing code structure',
            'Analyzing dependencies', 
            'Calculating impact scores',
            'Generating insights'
        ];

        // Update progress for each step
        for (let i = 0; i < steps.length; i++) {
            this.updateLoadingProgress(i);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate progress
        }

        // Perform the actual analysis
        return await this.programSlicingService.analyzeSession(sessionId, session);
    }

    /**
     * Update loading progress
     */
    updateLoadingProgress(activeStepIndex) {
        const modal = document.getElementById('enhancedSessionModal');
        if (!modal) return;

        const steps = modal.querySelectorAll('.loading-step');
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === activeStepIndex);
        });
    }

    /**
     * Auto-create memories from detected patterns
     */
    async autoCreateMemories(sessionId) {
        try {
            const response = await fetch(`/api/session/${sessionId}/auto-create-memories`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (result.success) {
                // Show success message
                this.showNotification(`Successfully created ${result.totalCreated} memories!`, 'success');
                
                // Refresh the insights tab
                await this.refreshInsights(sessionId);
            } else {
                this.showNotification(`Failed to create memories: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error auto-creating memories:', error);
            this.showNotification(`Error creating memories: ${error.message}`, 'error');
        }
    }

    /**
     * Refresh insights for a session
     */
    async refreshInsights(sessionId) {
        if (!this.currentSession) return;
        
        // Switch to insights tab and refresh content
        this.switchEnhancedTab('insights');
        
        // Regenerate the insights tab content
        const insightsContent = await this.generateInsightsTab(this.currentSession);
        const insightsPanel = document.getElementById('enhanced-tab-insights');
        if (insightsPanel) {
            insightsPanel.innerHTML = insightsContent;
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: 'white',
            fontWeight: '500',
            zIndex: '10001',
            maxWidth: '400px',
            wordWrap: 'break-word',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-out'
        });

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to DOM
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

    addModalEventListeners() {
        const modal = document.getElementById('enhancedSessionModal');
        if (!modal) return;
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeEnhancedModal();
            }
        });
        
        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeEnhancedModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeEnhancedModal() {
        const modal = document.getElementById('enhancedSessionModal');
        if (modal) {
            modal.remove();
        }
    }

    switchEnhancedTab(tabName) {
        // Hide all tab panels
        document.querySelectorAll('#enhancedSessionModal .tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('#enhancedSessionModal .tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab panel
        const targetPanel = document.getElementById(`enhanced-tab-${tabName}`);
        if (targetPanel) {
            targetPanel.classList.add('active');
        }
        
        // Add active class to clicked button
        const targetButton = document.querySelector(`#enhancedSessionModal .tab-btn[onclick*="${tabName}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }

    showSlicingDetails(deltaId) {
        const detailsElement = document.getElementById(`slicing-details-${deltaId}`);
        if (detailsElement) {
            detailsElement.style.display = detailsElement.style.display === 'none' ? 'block' : 'none';
        }
    }

    initializeDependencyVisualization() {
        // Initialize dependency graph visualization
        // This would integrate with D3.js or similar library
        console.log('Initializing dependency visualization...');
    }

    showBasicSessionDetails(session) {
        // Fallback to basic session details if enhanced analysis fails
        console.log('Falling back to basic session details');
        // This would call the original session modal implementation
    }
}

// Make the class available globally
window.EnhancedSessionModal = EnhancedSessionModal;

// Create a global instance
window.enhancedSessionModal = new EnhancedSessionModal();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.enhancedSessionModal.initialize();
    });
} else {
    window.enhancedSessionModal.initialize();
}
