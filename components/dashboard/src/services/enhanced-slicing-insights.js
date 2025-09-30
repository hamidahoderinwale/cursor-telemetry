/**
 * Enhanced Slicing Insights Service
 * Extends program slicing to provide valuable dashboard improvements and memory creation
 */

class EnhancedSlicingInsights {
    constructor(programSlicingService) {
        this.slicingService = programSlicingService;
        this.patternRegistry = new Map();
        this.memoryTemplates = new Map();
        this.dashboardInsights = new Map();
        this.initializePatterns();
    }

    /**
     * Initialize common patterns and memory templates
     */
    initializePatterns() {
        // Common function patterns that can become memories
        this.patternRegistry.set('data_loading', {
            patterns: [
                'pd.read_csv', 'pd.read_excel', 'pd.read_json', 'pd.read_parquet',
                'np.load', 'pickle.load', 'joblib.load', 'h5py.File'
            ],
            memoryTemplate: {
                type: 'data_loading',
                title: 'Data Loading Pattern',
                description: 'Common data loading operations',
                category: 'data_processing',
                tags: ['pandas', 'data-loading', 'file-io']
            }
        });

        this.patternRegistry.set('visualization', {
            patterns: [
                'plt.figure', 'plt.subplot', 'plt.plot', 'plt.scatter', 'plt.hist',
                'sns.heatmap', 'sns.pairplot', 'sns.boxplot', 'sns.violinplot',
                'fig.write_html', 'plt.savefig', 'sns.savefig'
            ],
            memoryTemplate: {
                type: 'visualization',
                title: 'Visualization Pattern',
                description: 'Common visualization operations',
                category: 'visualization',
                tags: ['matplotlib', 'seaborn', 'plotly', 'charts']
            }
        });

        this.patternRegistry.set('ml_pipeline', {
            patterns: [
                'train_test_split', 'StandardScaler', 'fit_transform', 'predict',
                'cross_val_score', 'GridSearchCV', 'RandomForestClassifier'
            ],
            memoryTemplate: {
                type: 'ml_pipeline',
                title: 'ML Pipeline Pattern',
                description: 'Machine learning pipeline operations',
                category: 'machine_learning',
                tags: ['sklearn', 'ml', 'pipeline', 'modeling']
            }
        });

        this.patternRegistry.set('error_handling', {
            patterns: [
                'try:', 'except', 'finally', 'raise', 'assert', 'logging.error'
            ],
            memoryTemplate: {
                type: 'error_handling',
                title: 'Error Handling Pattern',
                description: 'Robust error handling practices',
                category: 'best_practices',
                tags: ['error-handling', 'logging', 'debugging']
            }
        });

        this.patternRegistry.set('performance_optimization', {
            patterns: [
                'vectorize', 'apply', 'map', 'list comprehension', 'numba',
                'multiprocessing', 'concurrent.futures', 'asyncio'
            ],
            memoryTemplate: {
                type: 'performance_optimization',
                title: 'Performance Optimization Pattern',
                description: 'Code optimization techniques',
                category: 'optimization',
                tags: ['performance', 'optimization', 'parallelization']
            }
        });
    }

    /**
     * Analyze session for dashboard improvements
     */
    async analyzeForDashboardImprovements(session) {
        const insights = {
            sessionId: session.id,
            timestamp: Date.now(),
            dashboardSuggestions: [],
            memoryCandidates: [],
            workflowInsights: [],
            performanceInsights: [],
            bestPractices: []
        };

        // Get program slicing analysis
        const slicingAnalysis = await this.slicingService.analyzeSession(session.id, session);
        
        // Analyze each code delta
        for (const delta of slicingAnalysis.codeDeltas || []) {
            const deltaInsights = await this.analyzeCodeDeltaForInsights(delta, session);
            
            insights.dashboardSuggestions.push(...deltaInsights.dashboardSuggestions);
            insights.memoryCandidates.push(...deltaInsights.memoryCandidates);
            insights.workflowInsights.push(...deltaInsights.workflowInsights);
            insights.performanceInsights.push(...deltaInsights.performanceInsights);
            insights.bestPractices.push(...deltaInsights.bestPractices);
        }

        // Generate cross-session insights
        insights.crossSessionInsights = await this.generateCrossSessionInsights(session, slicingAnalysis);
        
        return insights;
    }

    /**
     * Analyze individual code delta for insights
     */
    async analyzeCodeDeltaForInsights(delta, session) {
        const insights = {
            dashboardSuggestions: [],
            memoryCandidates: [],
            workflowInsights: [],
            performanceInsights: [],
            bestPractices: []
        };

        const code = delta.afterContent || delta.content || delta.code || '';
        const semantic = delta.semanticAnalysis || {};

        // Dashboard suggestions based on patterns
        if (semantic.intent === 'visualization') {
            insights.dashboardSuggestions.push({
                type: 'visualization_enhancement',
                suggestion: 'Add visualization preview in session modal',
                priority: 'medium',
                implementation: 'Show thumbnail of generated plots in session details'
            });
        }

        if (semantic.intent === 'data_loading') {
            insights.dashboardSuggestions.push({
                type: 'data_insights',
                suggestion: 'Track data loading patterns across sessions',
                priority: 'high',
                implementation: 'Create data source tracking and file dependency mapping'
            });
        }

        // Memory candidates
        const memoryCandidates = this.identifyMemoryCandidates(code, semantic);
        insights.memoryCandidates.push(...memoryCandidates);

        // Workflow insights
        const workflowInsights = this.identifyWorkflowPatterns(code, session);
        insights.workflowInsights.push(...workflowInsights);

        // Performance insights
        const performanceInsights = this.identifyPerformanceOpportunities(code, semantic);
        insights.performanceInsights.push(...performanceInsights);

        // Best practices
        const bestPractices = this.identifyBestPractices(code, semantic);
        insights.bestPractices.push(...bestPractices);

        return insights;
    }

    /**
     * Identify memory candidates from code patterns
     */
    identifyMemoryCandidates(code, semantic) {
        const candidates = [];
        const lowerCode = code.toLowerCase();

        // Check each pattern registry
        for (const [patternType, patternData] of this.patternRegistry) {
            const matches = patternData.patterns.filter(pattern => 
                lowerCode.includes(pattern.toLowerCase())
            );

            if (matches.length > 0) {
                const memory = {
                    ...patternData.memoryTemplate,
                    id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    content: this.extractRelevantCode(code, matches),
                    patterns: matches,
                    frequency: matches.length,
                    created: new Date().toISOString(),
                    metadata: {
                        sessionId: semantic.sessionId,
                        filePath: semantic.filePath,
                        intent: semantic.intent,
                        category: semantic.category
                    }
                };

                candidates.push(memory);
            }
        }

        return candidates;
    }

    /**
     * Identify workflow patterns
     */
    identifyWorkflowPatterns(code, session) {
        const insights = [];
        const lowerCode = code.toLowerCase();

        // EDA workflow detection
        if (lowerCode.includes('describe()') && lowerCode.includes('info()')) {
            insights.push({
                type: 'eda_workflow',
                description: 'Exploratory Data Analysis workflow detected',
                steps: ['data_loading', 'data_inspection', 'statistical_summary'],
                suggestion: 'Create EDA template notebook',
                confidence: this.calculateConfidence(code, ['describe', 'info', 'head', 'tail'])
            });
        }

        // ML workflow detection
        if (lowerCode.includes('train_test_split') && lowerCode.includes('fit(')) {
            insights.push({
                type: 'ml_workflow',
                description: 'Machine Learning pipeline detected',
                steps: ['data_preprocessing', 'train_test_split', 'model_training', 'evaluation'],
                suggestion: 'Create ML pipeline template',
                confidence: this.calculateConfidence(code, ['train_test_split', 'fit', 'predict', 'score'])
            });
        }

        // Visualization workflow detection
        if (lowerCode.includes('plt.figure') && lowerCode.includes('plt.savefig')) {
            insights.push({
                type: 'viz_workflow',
                description: 'Visualization workflow detected',
                steps: ['figure_creation', 'plotting', 'customization', 'saving'],
                suggestion: 'Create visualization template',
                confidence: this.calculateConfidence(code, ['plt.figure', 'plt.plot', 'plt.savefig'])
            });
        }

        return insights;
    }

    /**
     * Calculate confidence score for pattern detection
     */
    calculateConfidence(code, patterns) {
        const matches = patterns.filter(pattern => code.toLowerCase().includes(pattern.toLowerCase())).length;
        return Math.min(matches / patterns.length, 1.0);
    }

    /**
     * Identify performance optimization opportunities
     */
    identifyPerformanceOpportunities(code, semantic) {
        const opportunities = [];
        const lowerCode = code.toLowerCase();

        // Loop optimization
        if (lowerCode.includes('for ') && lowerCode.includes('append(')) {
            opportunities.push({
                type: 'loop_optimization',
                description: 'List comprehension or vectorization opportunity',
                currentPattern: 'for loop with append',
                suggestedPattern: 'list comprehension or pandas vectorization',
                impact: 'medium'
            });
        }

        // Memory optimization
        if (lowerCode.includes('pd.read_csv') && !lowerCode.includes('chunksize')) {
            opportunities.push({
                type: 'memory_optimization',
                description: 'Large file reading without chunking',
                currentPattern: 'full file load',
                suggestedPattern: 'chunked reading for large files',
                impact: 'high'
            });
        }

        // Parallel processing opportunity
        if (lowerCode.includes('apply(') && lowerCode.includes('lambda')) {
            opportunities.push({
                type: 'parallel_processing',
                description: 'Parallel processing opportunity',
                currentPattern: 'sequential apply',
                suggestedPattern: 'multiprocessing or vectorization',
                impact: 'high'
            });
        }

        return opportunities;
    }

    /**
     * Identify best practices
     */
    identifyBestPractices(code, semantic) {
        const practices = [];
        const lowerCode = code.toLowerCase();

        // Error handling
        if (lowerCode.includes('pd.read_csv') && !lowerCode.includes('try:')) {
            practices.push({
                type: 'error_handling',
                description: 'Add error handling for file operations',
                practice: 'Wrap file I/O in try-except blocks',
                priority: 'high'
            });
        }

        // Documentation
        if (lowerCode.includes('def ') && !lowerCode.includes('"""') && !lowerCode.includes("'''")) {
            practices.push({
                type: 'documentation',
                description: 'Add docstrings to functions',
                practice: 'Include docstrings for all function definitions',
                priority: 'medium'
            });
        }

        // Type hints
        if (lowerCode.includes('def ') && !lowerCode.includes('->')) {
            practices.push({
                type: 'type_hints',
                description: 'Add type hints to function parameters',
                practice: 'Use type hints for better code clarity',
                priority: 'low'
            });
        }

        return practices;
    }

    /**
     * Generate cross-session insights
     */
    async generateCrossSessionInsights(session, slicingAnalysis) {
        const insights = {
            commonPatterns: [],
            workflowEvolution: [],
            skillProgression: [],
            collaborationInsights: []
        };

        // Analyze common patterns across sessions
        const allPatterns = [];
        for (const delta of slicingAnalysis.codeDeltas || []) {
            allPatterns.push(...(delta.semanticAnalysis?.patterns || []));
        }

        const patternFrequency = {};
        allPatterns.forEach(pattern => {
            patternFrequency[pattern] = (patternFrequency[pattern] || 0) + 1;
        });

        insights.commonPatterns = Object.entries(patternFrequency)
            .filter(([_, count]) => count > 1)
            .map(([pattern, count]) => ({
                pattern,
                frequency: count,
                suggestion: `Create reusable template for ${pattern} pattern`
            }));

        return insights;
    }

    /**
     * Extract relevant code for memory creation
     */
    extractRelevantCode(code, patterns) {
        const lines = code.split('\n');
        const relevantLines = [];

        for (const line of lines) {
            for (const pattern of patterns) {
                if (line.toLowerCase().includes(pattern.toLowerCase())) {
                    relevantLines.push(line.trim());
                    break;
                }
            }
        }

        return relevantLines.join('\n');
    }

    /**
     * Auto-create memories from detected patterns
     */
    async autoCreateMemoriesFromPatterns(insights) {
        const createdMemories = [];
        
        for (const candidate of insights.memoryCandidates || []) {
            try {
                // Create memory via API
                const response = await fetch('/api/memories', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: candidate.title,
                        description: candidate.description,
                        category: candidate.category,
                        type: candidate.type,
                        content: candidate.content,
                        tags: candidate.tags,
                        priority: 'medium',
                        autoExecute: false,
                        metadata: {
                            ...candidate.metadata,
                            autoGenerated: true,
                            source: 'enhanced_insights',
                            patternFrequency: candidate.frequency
                        }
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    createdMemories.push(result.memory);
                    console.log(`Auto-created memory: ${candidate.title}`);
                }
            } catch (error) {
                console.error(`Failed to auto-create memory for ${candidate.title}:`, error);
            }
        }
        
        return createdMemories;
    }

    /**
     * Generate dashboard enhancement recommendations
     */
    generateDashboardRecommendations(insights) {
        const recommendations = [];

        // Memory-based recommendations
        if (insights.memoryCandidates.length > 0) {
            recommendations.push({
                type: 'memory_integration',
                title: 'Auto-Create Memories from Patterns',
                description: `Found ${insights.memoryCandidates.length} code patterns that could become reusable memories`,
                implementation: 'Add "Create Memory" button to session details',
                priority: 'high'
            });
        }

        // Workflow-based recommendations
        if (insights.workflowInsights.length > 0) {
            recommendations.push({
                type: 'workflow_templates',
                title: 'Workflow Template Generation',
                description: 'Detected common workflow patterns that could be templated',
                implementation: 'Generate notebook templates from detected workflows',
                priority: 'medium'
            });
        }

        // Performance-based recommendations
        if (insights.performanceInsights.length > 0) {
            recommendations.push({
                type: 'performance_monitoring',
                title: 'Performance Optimization Suggestions',
                description: `Found ${insights.performanceInsights.length} optimization opportunities`,
                implementation: 'Add performance suggestions panel to session details',
                priority: 'medium'
            });
        }

        return recommendations;
    }
}

module.exports = { EnhancedSlicingInsights };
