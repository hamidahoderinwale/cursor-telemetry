/**
 * Cell Stage Classifier - Intra-file cell-based activity classification
 * Replaces high-level intent classification with granular cell-level tracking
 */

class CellStageClassifier {
    constructor() {
        // Define cell stages based on typical notebook workflow
        this.cellStages = {
            // Data preparation stages
            'import': {
                name: 'Import Dependencies',
                description: 'Loading libraries, modules, and external dependencies',
                keywords: ['import', 'from', 'require', 'include', 'using'],
                color: 'var(--primary-color)',
                icon: 'package'
            },
            'data_loading': {
                name: 'Data Loading',
                description: 'Loading datasets, files, and external data sources',
                keywords: ['read_csv', 'read_json', 'load', 'fetch', 'download', 'pd.read', 'np.load'],
                color: 'var(--success-color)',
                icon: 'database'
            },
            'data_preprocessing': {
                name: 'Data Preprocessing',
                description: 'Cleaning, transforming, and preparing data for analysis',
                keywords: ['clean', 'preprocess', 'transform', 'fillna', 'dropna', 'encode', 'normalize'],
                color: 'var(--warning-color)',
                icon: 'settings'
            },
            
            // Analysis stages
            'exploratory_analysis': {
                name: 'Exploratory Analysis',
                description: 'Initial data exploration, summary statistics, and data understanding',
                keywords: ['describe', 'info', 'head', 'tail', 'shape', 'dtypes', 'value_counts', 'corr'],
                color: 'var(--accent-color)',
                icon: 'search'
            },
            'statistical_analysis': {
                name: 'Statistical Analysis',
                description: 'Statistical tests, hypothesis testing, and quantitative analysis',
                keywords: ['ttest', 'anova', 'chi2', 'regression', 'correlation', 'pvalue', 'statistical'],
                color: 'var(--danger-color)',
                icon: 'bar-chart'
            },
            'machine_learning': {
                name: 'Machine Learning',
                description: 'Model training, validation, and machine learning workflows',
                keywords: ['fit', 'predict', 'train', 'model', 'sklearn', 'tensorflow', 'pytorch', 'xgboost'],
                color: 'var(--info-color)',
                icon: 'cpu'
            },
            
            // Visualization stages
            'data_visualization': {
                name: 'Data Visualization',
                description: 'Creating charts, plots, and visual representations of data',
                keywords: ['plot', 'chart', 'graph', 'visualize', 'matplotlib', 'seaborn', 'plotly', 'show'],
                color: 'var(--success-color)',
                icon: 'bar-chart-2'
            },
            'interactive_viz': {
                name: 'Interactive Visualization',
                description: 'Creating interactive dashboards and dynamic visualizations',
                keywords: ['interactive', 'dashboard', 'widget', 'streamlit', 'dash', 'bokeh', 'plotly_dash'],
                color: 'var(--warning-color)',
                icon: 'monitor'
            },
            
            // Output and documentation stages
            'results_interpretation': {
                name: 'Results Interpretation',
                description: 'Analyzing results, drawing conclusions, and interpreting findings',
                keywords: ['conclusion', 'interpret', 'result', 'finding', 'insight', 'summary'],
                color: 'var(--primary-color)',
                icon: 'lightbulb'
            },
            'documentation': {
                name: 'Documentation',
                description: 'Adding comments, markdown cells, and documentation',
                keywords: ['comment', 'docstring', 'markdown', 'explain', 'note', 'todo'],
                color: 'var(--text-secondary)',
                icon: 'file-text'
            },
            'testing': {
                name: 'Testing & Validation',
                description: 'Unit tests, validation checks, and quality assurance',
                keywords: ['test', 'assert', 'validate', 'check', 'verify', 'unittest', 'pytest'],
                color: 'var(--danger-color)',
                icon: 'check-circle'
            },
            
            // Utility stages
            'utility': {
                name: 'Utility Functions',
                description: 'Helper functions, utilities, and reusable code',
                keywords: ['function', 'def', 'helper', 'utility', 'tool', 'method'],
                color: 'var(--text-tertiary)',
                icon: 'tool'
            },
            'configuration': {
                name: 'Configuration',
                description: 'Setting up parameters, configurations, and environment variables',
                keywords: ['config', 'setting', 'parameter', 'env', 'constant', 'variable'],
                color: 'var(--text-secondary)',
                icon: 'settings-2'
            }
        };
    }

    /**
     * Classify a cell's content into appropriate stages
     */
    classifyCell(content, cellType = 'code') {
        if (!content || typeof content !== 'string') {
            return { stage: 'unknown', confidence: 0 };
        }

        const normalizedContent = content.toLowerCase();
        const stageScores = {};

        // Special handling for notebook update messages
        if (normalizedContent.includes('notebook updated') || normalizedContent.includes('cells')) {
            return {
                stage: 'data_visualization',
                confidence: 0.8,
                matches: 1,
                stageInfo: this.cellStages.data_visualization
            };
        }

        // Score each stage based on keyword matches
        Object.entries(this.cellStages).forEach(([stageKey, stageInfo]) => {
            let score = 0;
            let matches = 0;

            stageInfo.keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches_found = (normalizedContent.match(regex) || []).length;
                matches += matches_found;
                score += matches_found * (1 / stageInfo.keywords.length);
            });

            // Boost score for markdown cells with documentation keywords
            if (cellType === 'markdown' && stageInfo.keywords.some(k => 
                ['comment', 'docstring', 'markdown', 'explain', 'note'].includes(k))) {
                score *= 1.5;
            }

            // Boost score for import statements
            if (stageKey === 'import' && normalizedContent.includes('import')) {
                score *= 2;
            }

            // Boost score for data exploration keywords
            if (stageKey === 'exploratory_analysis' && (
                normalizedContent.includes('explore') || 
                normalizedContent.includes('analysis') ||
                normalizedContent.includes('data')
            )) {
                score *= 1.5;
            }

            stageScores[stageKey] = {
                score,
                matches,
                stage: stageKey,
                stageInfo
            };
        });

        // Find the stage with highest score
        const bestMatch = Object.entries(stageScores)
            .sort((a, b) => b[1].score - a[1].score)[0];

        if (!bestMatch || bestMatch[1].score === 0) {
            // Default to exploratory analysis for notebook content
            if (normalizedContent.includes('notebook') || normalizedContent.includes('cell')) {
                return {
                    stage: 'exploratory_analysis',
                    confidence: 0.6,
                    matches: 1,
                    stageInfo: this.cellStages.exploratory_analysis
                };
            }
            
            return { 
                stage: 'unknown', 
                confidence: 0,
                stageInfo: {
                    name: 'Unknown Stage',
                    description: 'Unable to classify cell content',
                    color: 'var(--text-tertiary)',
                    icon: 'help-circle'
                }
            };
        }

        return {
            stage: bestMatch[0],
            confidence: Math.min(bestMatch[1].score, 1),
            matches: bestMatch[1].matches,
            stageInfo: bestMatch[1].stageInfo
        };
    }

    /**
     * Analyze a session's code deltas and file changes to extract cell-level stages
     */
    analyzeSessionStages(session) {
        const stageCounts = {};
        const stageProgression = [];
        const cellStages = [];

        // Analyze code deltas if available
        if (session.codeDeltas && Array.isArray(session.codeDeltas)) {
            session.codeDeltas.forEach((delta, index) => {
                if (delta.content && delta.content.length > 0) {
                    const classification = this.classifyCell(delta.content, delta.type || 'code');
                    
                    cellStages.push({
                        index,
                        stage: classification.stage,
                        confidence: classification.confidence,
                        stageInfo: classification.stageInfo,
                        content: delta.content.substring(0, 100) + '...',
                        timestamp: delta.timestamp || session.timestamp,
                        source: 'codeDelta'
                    });

                    // Count stages
                    stageCounts[classification.stage] = (stageCounts[classification.stage] || 0) + 1;
                    
                    // Track progression
                    stageProgression.push({
                        step: index + 1,
                        stage: classification.stage,
                        confidence: classification.confidence
                    });
                }
            });
        }

        // Analyze file changes if code deltas are empty
        if (cellStages.length === 0 && session.fileChanges && Array.isArray(session.fileChanges)) {
            session.fileChanges.forEach((change, index) => {
                if (change.afterSnippet && change.afterSnippet.length > 0) {
                    const classification = this.classifyCell(change.afterSnippet, 'code');
                    
                    cellStages.push({
                        index,
                        stage: classification.stage,
                        confidence: classification.confidence,
                        stageInfo: classification.stageInfo,
                        content: change.afterSnippet.substring(0, 100) + '...',
                        timestamp: change.timestamp || session.timestamp,
                        source: 'fileChange'
                    });

                    // Count stages
                    stageCounts[classification.stage] = (stageCounts[classification.stage] || 0) + 1;
                    
                    // Track progression
                    stageProgression.push({
                        step: index + 1,
                        stage: classification.stage,
                        confidence: classification.confidence
                    });
                }
            });
        }

        // Fallback to semantic analysis if no content found
        if (cellStages.length === 0 && session.semanticAnalysis && session.semanticAnalysis.primary_intent) {
            const intent = session.semanticAnalysis.primary_intent;
            const classification = this.classifyCell(intent, 'markdown');
            
            cellStages.push({
                index: 0,
                stage: classification.stage,
                confidence: classification.confidence,
                stageInfo: classification.stageInfo,
                content: intent,
                timestamp: session.timestamp,
                source: 'semanticAnalysis'
            });

            stageCounts[classification.stage] = 1;
            stageProgression.push({
                step: 1,
                stage: classification.stage,
                confidence: classification.confidence
            });
        }

        // Find primary stage (most frequent)
        const primaryStage = Object.entries(stageCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        return {
            stages: cellStages,
            stageDistribution: stageCounts,
            primaryStage,
            stageProgression,
            totalCells: cellStages.length
        };
    }

    /**
     * Generate stage distribution for multiple sessions
     */
    generateStageDistribution(sessions) {
        const globalStageCounts = {};
        const sessionStageBreakdowns = [];

        sessions.forEach(session => {
            const analysis = this.analyzeSessionStages(session);
            sessionStageBreakdowns.push({
                sessionId: session.id,
                sessionFile: session.currentFile,
                stages: analysis.stages,
                primaryStage: analysis.primaryStage,
                stageDistribution: analysis.stageDistribution
            });

            // Aggregate global counts
            Object.entries(analysis.stageDistribution).forEach(([stage, count]) => {
                globalStageCounts[stage] = (globalStageCounts[stage] || 0) + count;
            });
        });

        return {
            globalDistribution: globalStageCounts,
            sessionBreakdowns: sessionStageBreakdowns,
            totalCells: Object.values(globalStageCounts).reduce((sum, count) => sum + count, 0)
        };
    }

    /**
     * Get stage information by key
     */
    getStageInfo(stageKey) {
        return this.cellStages[stageKey] || {
            name: 'Unknown Stage',
            description: 'Unclassified cell activity',
            color: 'var(--text-tertiary)',
            icon: 'help-circle'
        };
    }

    /**
     * Get all available stages
     */
    getAllStages() {
        return Object.entries(this.cellStages).map(([key, info]) => ({
            key,
            ...info
        }));
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.CellStageClassifier = CellStageClassifier;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CellStageClassifier;
}
