/**
 * Enhanced Cell Stage Classifier - Intra-file cell-based activity classification
 * Integrates with Clio analysis for comprehensive facet-based insights
 * Replaces high-level intent classification with granular cell-level tracking
 */

class CellStageClassifier {
    constructor() {
        // Initialize Clio integration
        this.clioFacets = this.initializeClioFacets();
        this.clioAvailable = false;
        
        // Initialize AST analysis capabilities
        this.astPatterns = this.initializeASTPatterns();
        this.astAvailable = this.checkASTAvailability();
        
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
     * Initialize Clio facets for enhanced analysis
     */
    initializeClioFacets() {
        return {
            'DataScienceIntent': {
                name: 'Data Science Intent',
                description: 'Primary data science goal and objective',
                keywords: ['analyze', 'explore', 'model', 'predict', 'classify', 'cluster', 'visualize'],
                weight: 1.0
            },
            'AnalysisType': {
                name: 'Analysis Type',
                description: 'Type of analysis being performed',
                keywords: ['exploratory', 'statistical', 'machine_learning', 'visualization', 'preprocessing'],
                weight: 0.9
            },
            'TechnicalApproach': {
                name: 'Technical Approach',
                description: 'Technical methods and libraries used',
                keywords: ['pandas', 'numpy', 'sklearn', 'tensorflow', 'matplotlib', 'seaborn'],
                weight: 0.8
            },
            'DataContext': {
                name: 'Data Context',
                description: 'Domain and type of data being analyzed',
                keywords: ['csv', 'json', 'database', 'api', 'time_series', 'image', 'text'],
                weight: 0.7
            },
            'SessionOutcome': {
                name: 'Session Outcome',
                description: 'Results and outcomes achieved',
                keywords: ['success', 'error', 'insight', 'model', 'visualization', 'report'],
                weight: 0.6
            },
            'ProcedureComplexity': {
                name: 'Procedure Complexity',
                description: 'Complexity level of the analysis',
                keywords: ['simple', 'intermediate', 'complex', 'advanced', 'sophisticated'],
                weight: 0.5
            }
        };
    }

    /**
     * Generate AST-based analysis for holistic inference
     */
    generateASTAnalysis(content) {
        if (!content || typeof content !== 'string') {
            return { astFeatures: {}, complexity: 0, patterns: [] };
        }

        const astFeatures = {
            imports: this.extractImports(content),
            functions: this.extractFunctions(content),
            classes: this.extractClasses(content),
            variables: this.extractVariables(content),
            loops: this.extractLoops(content),
            conditionals: this.extractConditionals(content),
            dataStructures: this.extractDataStructures(content),
            apiCalls: this.extractAPICalls(content)
        };

        const complexity = this.calculateComplexity(astFeatures);
        const patterns = this.identifyPatterns(astFeatures);

        return { astFeatures, complexity, patterns };
    }

    /**
     * Extract imports from code content
     */
    extractImports(content) {
        const importRegex = /^(import|from)\s+([^\s]+)/gm;
        const imports = [];
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
            imports.push({
                type: match[1],
                module: match[2],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return imports;
    }

    /**
     * Extract function definitions
     */
    extractFunctions(content) {
        const functionRegex = /def\s+(\w+)\s*\([^)]*\)/g;
        const functions = [];
        let match;
        
        while ((match = functionRegex.exec(content)) !== null) {
            functions.push({
                name: match[1],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return functions;
    }

    /**
     * Extract class definitions
     */
    extractClasses(content) {
        const classRegex = /class\s+(\w+)/g;
        const classes = [];
        let match;
        
        while ((match = classRegex.exec(content)) !== null) {
            classes.push({
                name: match[1],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return classes;
    }

    /**
     * Extract variable assignments
     */
    extractVariables(content) {
        const variableRegex = /(\w+)\s*=\s*[^=\n]+/g;
        const variables = [];
        let match;
        
        while ((match = variableRegex.exec(content)) !== null) {
            variables.push({
                name: match[1],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return variables;
    }

    /**
     * Extract loop constructs
     */
    extractLoops(content) {
        const loopRegex = /(for|while)\s+[^:]+:/g;
        const loops = [];
        let match;
        
        while ((match = loopRegex.exec(content)) !== null) {
            loops.push({
                type: match[1],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return loops;
    }

    /**
     * Extract conditional statements
     */
    extractConditionals(content) {
        const conditionalRegex = /(if|elif|else)\s+[^:]+:/g;
        const conditionals = [];
        let match;
        
        while ((match = conditionalRegex.exec(content)) !== null) {
            conditionals.push({
                type: match[1],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return conditionals;
    }

    /**
     * Extract data structure usage
     */
    extractDataStructures(content) {
        const structures = {
            lists: (content.match(/\[[^\]]*\]/g) || []).length,
            dictionaries: (content.match(/\{[^}]*\}/g) || []).length,
            tuples: (content.match(/\([^)]*\)/g) || []).length,
            sets: (content.match(/set\(/g) || []).length
        };
        
        return structures;
    }

    /**
     * Extract API calls and method invocations
     */
    extractAPICalls(content) {
        const apiRegex = /(\w+)\.(\w+)\s*\(/g;
        const apiCalls = [];
        let match;
        
        while ((match = apiRegex.exec(content)) !== null) {
            apiCalls.push({
                object: match[1],
                method: match[2],
                line: content.substring(0, match.index).split('\n').length
            });
        }
        
        return apiCalls;
    }

    /**
     * Calculate code complexity based on AST features
     */
    calculateComplexity(astFeatures) {
        let complexity = 0;
        
        // Base complexity from structure
        complexity += astFeatures.functions.length * 2;
        complexity += astFeatures.classes.length * 3;
        complexity += astFeatures.loops.length * 2;
        complexity += astFeatures.conditionals.length * 1.5;
        
        // Data structure complexity
        complexity += astFeatures.dataStructures.lists * 0.5;
        complexity += astFeatures.dataStructures.dictionaries * 1;
        complexity += astFeatures.dataStructures.sets * 0.8;
        
        // API call complexity
        complexity += astFeatures.apiCalls.length * 0.3;
        
        return Math.min(complexity, 10); // Cap at 10
    }

    /**
     * Identify patterns from AST features
     */
    identifyPatterns(astFeatures) {
        const patterns = [];
        
        // Data analysis patterns
        if (astFeatures.imports.some(imp => imp.module.includes('pandas'))) {
            patterns.push('data_analysis');
        }
        if (astFeatures.imports.some(imp => imp.module.includes('matplotlib') || imp.module.includes('seaborn'))) {
            patterns.push('visualization');
        }
        if (astFeatures.imports.some(imp => imp.module.includes('sklearn') || imp.module.includes('tensorflow'))) {
            patterns.push('machine_learning');
        }
        
        // Control flow patterns
        if (astFeatures.loops.length > 2) {
            patterns.push('iterative_processing');
        }
        if (astFeatures.conditionals.length > 3) {
            patterns.push('conditional_logic');
        }
        
        // Function patterns
        if (astFeatures.functions.length > 0) {
            patterns.push('modular_code');
        }
        if (astFeatures.classes.length > 0) {
            patterns.push('object_oriented');
        }
        
        return patterns;
    }

    /**
     * Enhanced cell classification with Clio and AST integration
     */
    classifyCellEnhanced(content, cellType = 'code', clioContext = null) {
        // Basic classification
        const basicClassification = this.classifyCell(content, cellType);
        
        // AST analysis
        const astAnalysis = this.generateASTAnalysis(content);
        
        // Clio facet analysis
        const clioAnalysis = this.analyzeClioFacets(content, clioContext);
        
        // Combine analyses for holistic inference
        const enhancedClassification = this.combineAnalyses(
            basicClassification, 
            astAnalysis, 
            clioAnalysis
        );
        
        return enhancedClassification;
    }

    /**
     * Analyze content against Clio facets
     */
    analyzeClioFacets(content, clioContext = null) {
        const facetScores = {};
        const normalizedContent = content.toLowerCase();
        
        Object.entries(this.clioFacets).forEach(([facetKey, facetInfo]) => {
            let score = 0;
            let matches = 0;
            
            facetInfo.keywords.forEach(keyword => {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const keywordMatches = (normalizedContent.match(regex) || []).length;
                matches += keywordMatches;
                score += keywordMatches * facetInfo.weight;
            });
            
            facetScores[facetKey] = {
                score: Math.min(score, 1),
                matches,
                facet: facetInfo
            };
        });
        
        // Find dominant facet
        const dominantFacet = Object.entries(facetScores)
            .sort((a, b) => b[1].score - a[1].score)[0];
        
        return {
            facetScores,
            dominantFacet: dominantFacet ? dominantFacet[0] : null,
            confidence: dominantFacet ? dominantFacet[1].score : 0
        };
    }

    /**
     * Combine basic, AST, and Clio analyses for holistic inference
     */
    combineAnalyses(basicClassification, astAnalysis, clioAnalysis) {
        // Weight the different analyses
        const weights = {
            basic: 0.4,
            ast: 0.3,
            clio: 0.3
        };
        
        // Calculate combined confidence
        const combinedConfidence = (
            basicClassification.confidence * weights.basic +
            Math.min(astAnalysis.complexity / 10, 1) * weights.ast +
            clioAnalysis.confidence * weights.clio
        );
        
        // Determine final stage with context
        let finalStage = basicClassification.stage;
        let stageInfo = basicClassification.stageInfo;
        
        // Override based on AST patterns
        if (astAnalysis.patterns.includes('machine_learning') && basicClassification.stage !== 'machine_learning') {
            finalStage = 'machine_learning';
            stageInfo = this.cellStages.machine_learning;
        } else if (astAnalysis.patterns.includes('visualization') && basicClassification.stage !== 'data_visualization') {
            finalStage = 'data_visualization';
            stageInfo = this.cellStages.data_visualization;
        }
        
        // Override based on Clio dominant facet
        if (clioAnalysis.dominantFacet === 'DataScienceIntent' && clioAnalysis.confidence > 0.7) {
            // Use Clio insight to refine stage
            if (clioAnalysis.facetScores.AnalysisType?.score > 0.6) {
                const analysisType = clioAnalysis.facetScores.AnalysisType.facet.name;
                if (analysisType.includes('machine_learning')) {
                    finalStage = 'machine_learning';
                    stageInfo = this.cellStages.machine_learning;
                } else if (analysisType.includes('visualization')) {
                    finalStage = 'data_visualization';
                    stageInfo = this.cellStages.data_visualization;
                }
            }
        }
        
        return {
            stage: finalStage,
            confidence: combinedConfidence,
            stageInfo: stageInfo,
            analyses: {
                basic: basicClassification,
                ast: astAnalysis,
                clio: clioAnalysis
            },
            holisticInsights: this.generateHolisticInsights(basicClassification, astAnalysis, clioAnalysis)
        };
    }

    /**
     * Generate holistic insights from combined analyses
     */
    generateHolisticInsights(basicClassification, astAnalysis, clioAnalysis) {
        const insights = [];
        
        // Complexity insights
        if (astAnalysis.complexity > 7) {
            insights.push({
                type: 'complexity',
                message: 'High complexity detected - consider breaking into smaller functions',
                severity: 'warning'
            });
        } else if (astAnalysis.complexity < 2) {
            insights.push({
                type: 'complexity',
                message: 'Simple code structure - good for readability',
                severity: 'info'
            });
        }
        
        // Pattern insights
        if (astAnalysis.patterns.includes('modular_code')) {
            insights.push({
                type: 'structure',
                message: 'Well-structured code with functions',
                severity: 'success'
            });
        }
        
        if (astAnalysis.patterns.includes('iterative_processing')) {
            insights.push({
                type: 'performance',
                message: 'Multiple loops detected - consider vectorization',
                severity: 'warning'
            });
        }
        
        // Clio insights
        if (clioAnalysis.confidence > 0.8) {
            insights.push({
                type: 'intent',
                message: `Clear data science intent: ${clioAnalysis.dominantFacet}`,
                severity: 'success'
            });
        }
        
        return insights;
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
     * Enhanced with Clio and AST analysis
     */
    analyzeSessionStages(session) {
        const stageCounts = {};
        const stageProgression = [];
        const cellStages = [];
        const clioContext = this.extractClioContext(session);

        // Analyze code deltas if available
        if (session.codeDeltas && Array.isArray(session.codeDeltas)) {
            session.codeDeltas.forEach((delta, index) => {
                if (delta.content && delta.content.length > 0) {
                    const classification = this.classifyCellEnhanced(delta.content, delta.type || 'code', clioContext);
                    
                    cellStages.push({
                        index,
                        stage: classification.stage,
                        confidence: classification.confidence,
                        stageInfo: classification.stageInfo,
                        content: delta.content.substring(0, 100) + '...',
                        timestamp: delta.timestamp || session.timestamp,
                        source: 'codeDelta',
                        analyses: classification.analyses,
                        holisticInsights: classification.holisticInsights
                    });

                    // Count stages
                    stageCounts[classification.stage] = (stageCounts[classification.stage] || 0) + 1;
                    
                    // Track progression
                    stageProgression.push({
                        step: index + 1,
                        stage: classification.stage,
                        confidence: classification.confidence,
                        complexity: classification.analyses.ast.complexity,
                        patterns: classification.analyses.ast.patterns
                    });
                }
            });
        }

        // Analyze file changes if code deltas are empty
        if (cellStages.length === 0 && session.fileChanges && Array.isArray(session.fileChanges)) {
            session.fileChanges.forEach((change, index) => {
                if (change.afterSnippet && change.afterSnippet.length > 0) {
                    const classification = this.classifyCellEnhanced(change.afterSnippet, 'code', clioContext);
                    
                    cellStages.push({
                        index,
                        stage: classification.stage,
                        confidence: classification.confidence,
                        stageInfo: classification.stageInfo,
                        content: change.afterSnippet.substring(0, 100) + '...',
                        timestamp: change.timestamp || session.timestamp,
                        source: 'fileChange',
                        analyses: classification.analyses,
                        holisticInsights: classification.holisticInsights
                    });

                    // Count stages
                    stageCounts[classification.stage] = (stageCounts[classification.stage] || 0) + 1;
                    
                    // Track progression
                    stageProgression.push({
                        step: index + 1,
                        stage: classification.stage,
                        confidence: classification.confidence,
                        complexity: classification.analyses.ast.complexity,
                        patterns: classification.analyses.ast.patterns
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

        // Generate session-level insights
        const sessionInsights = this.generateSessionInsights(cellStages, stageProgression, clioContext);

        return {
            stages: cellStages,
            stageDistribution: stageCounts,
            primaryStage,
            stageProgression,
            totalCells: cellStages.length,
            clioContext: clioContext,
            sessionInsights: sessionInsights,
            complexityMetrics: this.calculateSessionComplexity(cellStages),
            facetAnalysis: this.analyzeSessionFacets(cellStages)
        };
    }

    /**
     * Extract Clio context from session data
     */
    extractClioContext(session) {
        const context = {
            sessionId: session.id,
            intent: session.intent,
            outcome: session.outcome,
            currentFile: session.currentFile,
            timestamp: session.timestamp
        };

        // Add semantic analysis if available
        if (session.semanticAnalysis) {
            context.semanticAnalysis = session.semanticAnalysis;
        }

        // Add conversation context if available
        if (session.conversations && Array.isArray(session.conversations)) {
            context.conversations = session.conversations.map(conv => ({
                role: conv.role,
                content: conv.content?.substring(0, 200) + '...'
            }));
        }

        return context;
    }

    /**
     * Generate session-level insights
     */
    generateSessionInsights(cellStages, stageProgression, clioContext) {
        const insights = [];

        // Workflow insights
        const uniqueStages = [...new Set(cellStages.map(cell => cell.stage))];
        if (uniqueStages.length > 5) {
            insights.push({
                type: 'workflow',
                message: 'Complex workflow with multiple analysis stages',
                severity: 'info'
            });
        }

        // Complexity insights
        const avgComplexity = cellStages.reduce((sum, cell) => 
            sum + (cell.analyses?.ast?.complexity || 0), 0) / cellStages.length;
        
        if (avgComplexity > 6) {
            insights.push({
                type: 'complexity',
                message: 'High average complexity - consider refactoring',
                severity: 'warning'
            });
        }

        // Pattern insights
        const allPatterns = cellStages.flatMap(cell => cell.analyses?.ast?.patterns || []);
        const patternCounts = allPatterns.reduce((acc, pattern) => {
            acc[pattern] = (acc[pattern] || 0) + 1;
            return acc;
        }, {});

        if (patternCounts.iterative_processing > 3) {
            insights.push({
                type: 'performance',
                message: 'Multiple iterative processing patterns detected',
                severity: 'warning'
            });
        }

        if (patternCounts.modular_code > 0) {
            insights.push({
                type: 'structure',
                message: 'Good modular code structure',
                severity: 'success'
            });
        }

        return insights;
    }

    /**
     * Calculate session-level complexity metrics
     */
    calculateSessionComplexity(cellStages) {
        const complexities = cellStages.map(cell => cell.analyses?.ast?.complexity || 0);
        
        return {
            average: complexities.reduce((sum, c) => sum + c, 0) / complexities.length || 0,
            max: Math.max(...complexities, 0),
            min: Math.min(...complexities, 0),
            total: complexities.reduce((sum, c) => sum + c, 0)
        };
    }

    /**
     * Analyze session-level facets
     */
    analyzeSessionFacets(cellStages) {
        const facetScores = {};
        
        // Aggregate facet scores from all cells
        cellStages.forEach(cell => {
            if (cell.analyses?.clio?.facetScores) {
                Object.entries(cell.analyses.clio.facetScores).forEach(([facet, score]) => {
                    if (!facetScores[facet]) {
                        facetScores[facet] = { total: 0, count: 0 };
                    }
                    facetScores[facet].total += score.score;
                    facetScores[facet].count += 1;
                });
            }
        });

        // Calculate average scores
        const avgScores = {};
        Object.entries(facetScores).forEach(([facet, data]) => {
            avgScores[facet] = data.total / data.count;
        });

        return {
            facetScores: avgScores,
            dominantFacet: Object.entries(avgScores)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || null
        };
    }

    /**
     * Generate enhanced stage distribution for multiple sessions
     */
    generateStageDistribution(sessions) {
        const globalStageCounts = {};
        const sessionStageBreakdowns = [];
        const globalInsights = [];
        const complexityMetrics = { total: 0, sessions: 0, average: 0 };
        const facetAnalysis = {};

        sessions.forEach(session => {
            const analysis = this.analyzeSessionStages(session);
            sessionStageBreakdowns.push({
                sessionId: session.id,
                sessionFile: session.currentFile,
                stages: analysis.stages,
                primaryStage: analysis.primaryStage,
                stageDistribution: analysis.stageDistribution,
                sessionInsights: analysis.sessionInsights,
                complexityMetrics: analysis.complexityMetrics,
                facetAnalysis: analysis.facetAnalysis
            });

            // Aggregate global counts
            Object.entries(analysis.stageDistribution).forEach(([stage, count]) => {
                globalStageCounts[stage] = (globalStageCounts[stage] || 0) + count;
            });

            // Aggregate complexity metrics
            complexityMetrics.total += analysis.complexityMetrics.total;
            complexityMetrics.sessions += 1;
            complexityMetrics.average = complexityMetrics.total / complexityMetrics.sessions;

            // Aggregate facet analysis
            if (analysis.facetAnalysis.facetScores) {
                Object.entries(analysis.facetAnalysis.facetScores).forEach(([facet, score]) => {
                    if (!facetAnalysis[facet]) {
                        facetAnalysis[facet] = { total: 0, count: 0 };
                    }
                    facetAnalysis[facet].total += score;
                    facetAnalysis[facet].count += 1;
                });
            }

            // Collect insights
            globalInsights.push(...analysis.sessionInsights);
        });

        // Calculate average facet scores
        const avgFacetScores = {};
        Object.entries(facetAnalysis).forEach(([facet, data]) => {
            avgFacetScores[facet] = data.total / data.count;
        });

        // Generate global insights
        const globalInsightsSummary = this.generateGlobalInsights(globalInsights, complexityMetrics, avgFacetScores);

        return {
            globalDistribution: globalStageCounts,
            sessionBreakdowns: sessionStageBreakdowns,
            totalCells: Object.values(globalStageCounts).reduce((sum, count) => sum + count, 0),
            globalInsights: globalInsightsSummary,
            complexityMetrics: complexityMetrics,
            facetAnalysis: {
                facetScores: avgFacetScores,
                dominantFacet: Object.entries(avgFacetScores)
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || null
            }
        };
    }

    /**
     * Generate global insights from all sessions
     */
    generateGlobalInsights(globalInsights, complexityMetrics, facetScores) {
        const insights = [];

        // Complexity insights
        if (complexityMetrics.average > 5) {
            insights.push({
                type: 'complexity',
                message: `High average complexity across sessions (${complexityMetrics.average.toFixed(1)})`,
                severity: 'warning'
            });
        } else if (complexityMetrics.average < 2) {
            insights.push({
                type: 'complexity',
                message: 'Low complexity - sessions are well-structured',
                severity: 'success'
            });
        }

        // Facet insights
        const dominantFacet = Object.entries(facetScores)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (dominantFacet && dominantFacet[1] > 0.7) {
            insights.push({
                type: 'intent',
                message: `Strong focus on ${dominantFacet[0]} across sessions`,
                severity: 'info'
            });
        }

        // Pattern insights
        const insightTypes = globalInsights.map(insight => insight.type);
        const typeCounts = insightTypes.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        if (typeCounts.warning > 5) {
            insights.push({
                type: 'quality',
                message: 'Multiple quality warnings detected across sessions',
                severity: 'warning'
            });
        }

        if (typeCounts.success > 3) {
            insights.push({
                type: 'quality',
                message: 'Good code quality patterns observed',
                severity: 'success'
            });
        }

        return insights;
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
