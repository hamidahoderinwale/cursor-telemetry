/**
 * Hierarchical Intent Classification System
 * Provides more expressive and granular intent categorization
 */

class HierarchicalIntentClassifier {
    constructor() {
        this.intentHierarchy = this.initializeIntentHierarchy();
        this.contextWeights = {
            conversation: 0.4,
            codeContent: 0.3,
            fileContext: 0.15,
            temporal: 0.1,
            behavioral: 0.05
        };
    }

    /**
     * Initialize hierarchical intent structure
     */
    initializeIntentHierarchy() {
        return {
            'data_science': {
                name: 'Data Science',
                description: 'Data analysis, machine learning, and scientific computing workflows',
                weight: 1.0,
                subcategories: {
                    'exploratory_analysis': {
                        name: 'Exploratory Data Analysis',
                        description: 'Initial data exploration and understanding',
                        patterns: {
                            keywords: ['explore', 'analyze', 'investigate', 'examine', 'eda', 'data exploration'],
                            codePatterns: ['df.head()', 'df.describe()', 'df.info()', 'df.shape', 'df.columns', 'df.dtypes'],
                            libraries: ['pandas', 'numpy', 'matplotlib', 'seaborn'],
                            functions: ['read_csv', 'read_excel', 'head', 'tail', 'info', 'describe', 'value_counts']
                        },
                        subcategories: {
                            'data_profiling': {
                                name: 'Data Profiling',
                                description: 'Understanding data structure and quality',
                                patterns: {
                                    keywords: ['profile', 'structure', 'quality', 'missing', 'null', 'dtypes'],
                                    codePatterns: ['df.info()', 'df.describe()', 'df.isnull()', 'df.dtypes']
                                }
                            },
                            'correlation_analysis': {
                                name: 'Correlation Analysis',
                                description: 'Finding relationships between variables',
                                patterns: {
                                    keywords: ['correlation', 'corr', 'relationship', 'association'],
                                    codePatterns: ['df.corr()', 'correlation_matrix', 'heatmap']
                                }
                            },
                            'distribution_analysis': {
                                name: 'Distribution Analysis',
                                description: 'Analyzing data distributions and statistics',
                                patterns: {
                                    keywords: ['distribution', 'histogram', 'boxplot', 'statistics'],
                                    codePatterns: ['plt.hist()', 'sns.histplot()', 'df.describe()']
                                }
                            }
                        }
                    },
                    'feature_engineering': {
                        name: 'Feature Engineering',
                        description: 'Creating and transforming features for modeling',
                        patterns: {
                            keywords: ['feature', 'engineering', 'transform', 'encode', 'scale', 'normalize'],
                            codePatterns: ['LabelEncoder', 'OneHotEncoder', 'StandardScaler', 'MinMaxScaler'],
                            libraries: ['sklearn', 'pandas']
                        },
                        subcategories: {
                            'feature_creation': {
                                name: 'Feature Creation',
                                description: 'Creating new features from existing data',
                                patterns: {
                                    keywords: ['create', 'new feature', 'derive', 'combine'],
                                    codePatterns: ['df["new_feature"]', 'df.apply()', 'feature_engineering']
                                }
                            },
                            'feature_selection': {
                                name: 'Feature Selection',
                                description: 'Selecting relevant features for modeling',
                                patterns: {
                                    keywords: ['select', 'feature selection', 'importance', 'relevance'],
                                    codePatterns: ['SelectKBest', 'RFE', 'feature_importance']
                                }
                            }
                        }
                    },
                    'machine_learning': {
                        name: 'Machine Learning',
                        description: 'Building and training ML models',
                        patterns: {
                            keywords: ['model', 'train', 'fit', 'predict', 'machine learning', 'ml'],
                            codePatterns: ['fit()', 'predict()', 'score()', 'cross_val_score()'],
                            libraries: ['sklearn', 'tensorflow', 'pytorch', 'xgboost', 'lightgbm']
                        },
                        subcategories: {
                            'model_training': {
                                name: 'Model Training',
                                description: 'Training machine learning models',
                                patterns: {
                                    keywords: ['train', 'fit', 'training', 'model'],
                                    codePatterns: ['model.fit()', 'train_test_split', 'cross_validation']
                                }
                            },
                            'hyperparameter_tuning': {
                                name: 'Hyperparameter Tuning',
                                description: 'Optimizing model parameters',
                                patterns: {
                                    keywords: ['hyperparameter', 'tuning', 'optimization', 'grid search'],
                                    codePatterns: ['GridSearchCV', 'RandomizedSearchCV', 'hyperopt']
                                }
                            },
                            'model_evaluation': {
                                name: 'Model Evaluation',
                                description: 'Evaluating model performance',
                                patterns: {
                                    keywords: ['evaluate', 'accuracy', 'precision', 'recall', 'f1'],
                                    codePatterns: ['accuracy_score', 'classification_report', 'confusion_matrix']
                                }
                            }
                        }
                    },
                    'data_visualization': {
                        name: 'Data Visualization',
                        description: 'Creating charts and visual representations',
                        patterns: {
                            keywords: ['plot', 'chart', 'graph', 'visualize', 'visualization'],
                            codePatterns: ['plt.plot()', 'sns.plot()', 'plotly', 'matplotlib'],
                            libraries: ['matplotlib', 'seaborn', 'plotly', 'bokeh']
                        },
                        subcategories: {
                            'exploratory_plots': {
                                name: 'Exploratory Plots',
                                description: 'Quick plots for data exploration',
                                patterns: {
                                    keywords: ['explore', 'quick', 'overview'],
                                    codePatterns: ['df.plot()', 'plt.scatter()', 'sns.pairplot()']
                                }
                            },
                            'publication_ready': {
                                name: 'Publication Ready Charts',
                                description: 'Polished charts for presentations',
                                patterns: {
                                    keywords: ['publication', 'presentation', 'polish', 'final'],
                                    codePatterns: ['plt.style.use()', 'sns.set_style()', 'custom styling']
                                }
                            }
                        }
                    }
                }
            },
            'software_development': {
                name: 'Software Development',
                description: 'General software development and programming tasks',
                weight: 0.9,
                subcategories: {
                    'implementation': {
                        name: 'Implementation',
                        description: 'Writing and building code',
                        patterns: {
                            keywords: ['implement', 'build', 'create', 'develop', 'code', 'write'],
                            codePatterns: ['def ', 'class ', 'function', 'import ', 'from '],
                            fileTypes: ['.py', '.js', '.ts', '.java', '.cpp', '.go']
                        },
                        subcategories: {
                            'api_development': {
                                name: 'API Development',
                                description: 'Building APIs and web services',
                                patterns: {
                                    keywords: ['api', 'endpoint', 'rest', 'service'],
                                    codePatterns: ['@app.route', 'FastAPI', 'Flask', 'Express']
                                }
                            },
                            'database_operations': {
                                name: 'Database Operations',
                                description: 'Working with databases',
                                patterns: {
                                    keywords: ['database', 'sql', 'query', 'table'],
                                    codePatterns: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'sqlite3']
                                }
                            }
                        }
                    },
                    'debugging': {
                        name: 'Debugging',
                        description: 'Fixing errors and issues',
                        patterns: {
                            keywords: ['debug', 'fix', 'error', 'bug', 'issue', 'troubleshoot'],
                            codePatterns: ['print(', 'debugger', 'try:', 'except:', 'raise', 'assert']
                        },
                        subcategories: {
                            'error_analysis': {
                                name: 'Error Analysis',
                                description: 'Analyzing and understanding errors',
                                patterns: {
                                    keywords: ['error', 'exception', 'traceback', 'stack trace'],
                                    codePatterns: ['try:', 'except:', 'traceback.print_exc()']
                                }
                            },
                            'performance_debugging': {
                                name: 'Performance Debugging',
                                description: 'Optimizing code performance',
                                patterns: {
                                    keywords: ['performance', 'slow', 'optimize', 'profiling'],
                                    codePatterns: ['cProfile', 'timeit', 'memory_profiler']
                                }
                            }
                        }
                    },
                    'testing': {
                        name: 'Testing',
                        description: 'Writing and running tests',
                        patterns: {
                            keywords: ['test', 'testing', 'unit test', 'integration test'],
                            codePatterns: ['test_', 'assert', 'pytest', 'unittest', 'mock']
                        },
                        subcategories: {
                            'unit_testing': {
                                name: 'Unit Testing',
                                description: 'Testing individual components',
                                patterns: {
                                    keywords: ['unit test', 'component', 'function test'],
                                    codePatterns: ['test_', 'unittest', 'pytest']
                                }
                            },
                            'integration_testing': {
                                name: 'Integration Testing',
                                description: 'Testing component interactions',
                                patterns: {
                                    keywords: ['integration', 'end-to-end', 'system test'],
                                    codePatterns: ['selenium', 'requests', 'integration test']
                                }
                            }
                        }
                    }
                }
            },
            'research_analysis': {
                name: 'Research & Analysis',
                description: 'Research, documentation, and analytical tasks',
                weight: 0.8,
                subcategories: {
                    'documentation': {
                        name: 'Documentation',
                        description: 'Writing documentation and comments',
                        patterns: {
                            keywords: ['document', 'documentation', 'comment', 'explain', 'docstring'],
                            codePatterns: ['"""', "'''", '# ', 'markdown', 'README']
                        }
                    },
                    'research': {
                        name: 'Research',
                        description: 'Investigating and researching topics',
                        patterns: {
                            keywords: ['research', 'investigate', 'study', 'analyze', 'literature'],
                            codePatterns: ['search', 'find', 'investigate', 'study']
                        }
                    }
                }
            }
        };
    }

    /**
     * Classify intent with hierarchical structure
     */
    async classifyIntent(session, conversations = []) {
        const signals = this.extractSignals(session, conversations);
        const classification = this.performHierarchicalClassification(signals);
        
        return {
            primary_intent: classification.primary,
            secondary_intent: classification.secondary,
            tertiary_intent: classification.tertiary,
            confidence: classification.confidence,
            context: classification.context,
            hierarchy: classification.hierarchy,
            signals: signals,
            analysis: {
                method: 'hierarchical_classification',
                timestamp: new Date().toISOString(),
                weights: this.contextWeights
            }
        };
    }

    /**
     * Extract signals from session data
     */
    extractSignals(session, conversations) {
        return {
            conversation: this.analyzeConversationSignals(conversations),
            codeContent: this.analyzeCodeSignals(session),
            fileContext: this.analyzeFileContext(session),
            temporal: this.analyzeTemporalSignals(session),
            behavioral: this.analyzeBehavioralSignals(session)
        };
    }

    /**
     * Perform hierarchical classification
     */
    performHierarchicalClassification(signals) {
        const scores = {};
        let maxScore = 0;
        let bestMatch = null;

        // Calculate scores for each primary intent
        for (const [primaryKey, primaryIntent] of Object.entries(this.intentHierarchy)) {
            let primaryScore = 0;
            let bestSecondary = null;
            let bestTertiary = null;
            let secondaryScore = 0;
            let tertiaryScore = 0;

            // Calculate primary intent score
            for (const [signalType, weight] of Object.entries(this.contextWeights)) {
                const signalScore = this.calculateSignalScore(signals[signalType], primaryIntent);
                primaryScore += signalScore * weight;
            }

            // Find best secondary intent
            if (primaryIntent.subcategories) {
                for (const [secondaryKey, secondaryIntent] of Object.entries(primaryIntent.subcategories)) {
                    let currentSecondaryScore = 0;
                    let currentTertiary = null;
                    let currentTertiaryScore = 0;

                    for (const [signalType, weight] of Object.entries(this.contextWeights)) {
                        const signalScore = this.calculateSignalScore(signals[signalType], secondaryIntent);
                        currentSecondaryScore += signalScore * weight;
                    }

                    // Find best tertiary intent
                    if (secondaryIntent.subcategories) {
                        for (const [tertiaryKey, tertiaryIntent] of Object.entries(secondaryIntent.subcategories)) {
                            let currentTertiaryScore = 0;
                            for (const [signalType, weight] of Object.entries(this.contextWeights)) {
                                const signalScore = this.calculateSignalScore(signals[signalType], tertiaryIntent);
                                currentTertiaryScore += signalScore * weight;
                            }

                            if (currentTertiaryScore > tertiaryScore) {
                                tertiaryScore = currentTertiaryScore;
                                currentTertiary = tertiaryKey;
                            }
                        }
                    }

                    if (currentSecondaryScore > secondaryScore) {
                        secondaryScore = currentSecondaryScore;
                        bestSecondary = secondaryKey;
                        bestTertiary = currentTertiary;
                    }
                }
            }

            const totalScore = primaryScore + (secondaryScore * 0.7) + (tertiaryScore * 0.5);
            
            if (totalScore > maxScore) {
                maxScore = totalScore;
                bestMatch = {
                    primary: primaryKey,
                    secondary: bestSecondary,
                    tertiary: bestTertiary,
                    confidence: Math.min(totalScore, 1),
                    context: this.extractContext(session, primaryKey, bestSecondary, bestTertiary)
                };
            }
        }

        return {
            ...bestMatch,
            hierarchy: this.buildHierarchyPath(bestMatch.primary, bestMatch.secondary, bestMatch.tertiary)
        };
    }

    /**
     * Calculate signal score for an intent
     */
    calculateSignalScore(signal, intent) {
        if (!signal || !intent.patterns) return 0;

        let score = 0;
        const patterns = intent.patterns;

        // Check keywords
        if (patterns.keywords && signal.keywords) {
            score += this.calculateKeywordScore(signal.keywords, patterns.keywords);
        }

        // Check code patterns
        if (patterns.codePatterns && signal.codePatterns) {
            score += this.calculateCodePatternScore(signal.codePatterns, patterns.codePatterns);
        }

        // Check libraries
        if (patterns.libraries && signal.libraries) {
            score += this.calculateLibraryScore(signal.libraries, patterns.libraries);
        }

        // Check functions
        if (patterns.functions && signal.functions) {
            score += this.calculateFunctionScore(signal.functions, patterns.functions);
        }

        return Math.min(score, 1);
    }

    /**
     * Calculate keyword matching score
     */
    calculateKeywordScore(signalKeywords, patternKeywords) {
        let matches = 0;
        for (const keyword of patternKeywords) {
            if (signalKeywords.some(signal => 
                signal.toLowerCase().includes(keyword.toLowerCase()) ||
                keyword.toLowerCase().includes(signal.toLowerCase())
            )) {
                matches++;
            }
        }
        return matches / patternKeywords.length;
    }

    /**
     * Calculate code pattern matching score
     */
    calculateCodePatternScore(signalPatterns, patternPatterns) {
        let matches = 0;
        for (const pattern of patternPatterns) {
            if (signalPatterns.some(signal => 
                signal.includes(pattern) || pattern.includes(signal)
            )) {
                matches++;
            }
        }
        return matches / patternPatterns.length;
    }

    /**
     * Calculate library matching score
     */
    calculateLibraryScore(signalLibraries, patternLibraries) {
        let matches = 0;
        for (const library of patternLibraries) {
            if (signalLibraries.includes(library)) {
                matches++;
            }
        }
        return matches / patternLibraries.length;
    }

    /**
     * Calculate function matching score
     */
    calculateFunctionScore(signalFunctions, patternFunctions) {
        let matches = 0;
        for (const func of patternFunctions) {
            if (signalFunctions.some(signal => 
                signal.includes(func) || func.includes(signal)
            )) {
                matches++;
            }
        }
        return matches / patternFunctions.length;
    }

    /**
     * Extract context information
     */
    extractContext(session, primary, secondary, tertiary) {
        return {
            domain: this.detectDomain(session),
            complexity: this.assessComplexity(session),
            expertise: this.inferExpertiseLevel(session),
            project_phase: this.detectProjectPhase(session),
            collaboration_mode: this.detectCollaborationMode(session),
            workflow_pattern: this.identifyWorkflowPattern(session, primary, secondary)
        };
    }

    /**
     * Detect project domain
     */
    detectDomain(session) {
        const filePath = session.currentFile || '';
        const content = this.extractAllText(session).toLowerCase();

        if (filePath.includes('data') || filePath.includes('analysis') || content.includes('pandas') || content.includes('numpy')) {
            return 'data_science';
        }
        if (filePath.includes('web') || filePath.includes('api') || content.includes('flask') || content.includes('django')) {
            return 'web_development';
        }
        if (filePath.includes('ml') || filePath.includes('model') || content.includes('tensorflow') || content.includes('pytorch')) {
            return 'machine_learning';
        }
        if (filePath.includes('test') || content.includes('pytest') || content.includes('unittest')) {
            return 'testing';
        }
        
        return 'general';
    }

    /**
     * Assess code complexity
     */
    assessComplexity(session) {
        const content = this.extractAllText(session);
        let complexity = 0;

        // Count imports
        const imports = (content.match(/import\s+/g) || []).length;
        complexity += Math.min(imports * 0.1, 0.3);

        // Count functions/classes
        const functions = (content.match(/def\s+/g) || []).length;
        const classes = (content.match(/class\s+/g) || []).length;
        complexity += Math.min((functions + classes) * 0.1, 0.3);

        // Count lines of code
        const lines = content.split('\n').length;
        complexity += Math.min(lines * 0.001, 0.2);

        // Check for advanced patterns
        if (content.includes('async') || content.includes('await')) complexity += 0.1;
        if (content.includes('decorator') || content.includes('@')) complexity += 0.1;

        if (complexity < 0.3) return 'simple';
        if (complexity < 0.6) return 'intermediate';
        return 'complex';
    }

    /**
     * Infer user expertise level
     */
    inferExpertiseLevel(session) {
        const content = this.extractAllText(session);
        let expertise = 0;

        // Check for advanced patterns
        if (content.includes('async') || content.includes('await')) expertise += 0.2;
        if (content.includes('decorator') || content.includes('@')) expertise += 0.2;
        if (content.includes('lambda') || content.includes('map(') || content.includes('filter(')) expertise += 0.2;
        if (content.includes('generator') || content.includes('yield')) expertise += 0.2;
        if (content.includes('context manager') || content.includes('with ')) expertise += 0.1;
        if (content.includes('metaclass') || content.includes('__new__')) expertise += 0.1;

        if (expertise < 0.3) return 'beginner';
        if (expertise < 0.6) return 'intermediate';
        return 'advanced';
    }

    /**
     * Detect project phase
     */
    detectProjectPhase(session) {
        const content = this.extractAllText(session).toLowerCase();
        
        if (content.includes('setup') || content.includes('install') || content.includes('requirements')) {
            return 'initialization';
        }
        if (content.includes('test') || content.includes('debug') || content.includes('fix')) {
            return 'testing';
        }
        if (content.includes('optimize') || content.includes('refactor') || content.includes('clean')) {
            return 'optimization';
        }
        if (content.includes('deploy') || content.includes('production') || content.includes('release')) {
            return 'deployment';
        }
        
        return 'development';
    }

    /**
     * Detect collaboration mode
     */
    detectCollaborationMode(session) {
        // This would need to be enhanced with actual collaboration data
        return 'individual'; // Default for now
    }

    /**
     * Identify workflow pattern
     */
    identifyWorkflowPattern(session, primary, secondary) {
        const patterns = {
            'data_science.exploratory_analysis': 'explore_to_model',
            'data_science.feature_engineering': 'prepare_to_model',
            'data_science.machine_learning': 'model_development',
            'software_development.implementation': 'build_to_test',
            'software_development.debugging': 'debug_to_fix'
        };
        
        const key = `${primary}.${secondary}`;
        return patterns[key] || 'general_workflow';
    }

    /**
     * Build hierarchy path
     */
    buildHierarchyPath(primary, secondary, tertiary) {
        const path = [primary];
        if (secondary) path.push(secondary);
        if (tertiary) path.push(tertiary);
        return path;
    }

    /**
     * Extract all text from session
     */
    extractAllText(session) {
        let text = '';
        
        if (session.conversations) {
            text += session.conversations.map(c => c.content || c.prompt || c.response || '').join(' ');
        }
        
        if (session.codeDeltas) {
            text += session.codeDeltas.map(d => d.content || d.afterContent || '').join(' ');
        }
        
        return text;
    }

    // Signal analysis methods (simplified versions)
    analyzeConversationSignals(conversations) {
        const keywords = [];
        const codePatterns = [];
        
        conversations.forEach(conv => {
            const content = (conv.content || conv.prompt || conv.response || '').toLowerCase();
            keywords.push(...content.split(/\s+/));
            
            // Extract code patterns
            const codeMatches = content.match(/[a-zA-Z_][a-zA-Z0-9_]*\(\)/g) || [];
            codePatterns.push(...codeMatches);
        });
        
        return { keywords, codePatterns };
    }

    analyzeCodeSignals(session) {
        const codePatterns = [];
        const libraries = [];
        const functions = [];
        
        if (session.codeDeltas) {
            session.codeDeltas.forEach(delta => {
                const content = delta.content || delta.afterContent || '';
                
                // Extract function calls
                const funcMatches = content.match(/[a-zA-Z_][a-zA-Z0-9_]*\(/g) || [];
                functions.push(...funcMatches.map(f => f.slice(0, -1)));
                
                // Extract imports
                const importMatches = content.match(/import\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
                libraries.push(...importMatches.map(i => i.replace('import ', '')));
                
                codePatterns.push(content);
            });
        }
        
        return { codePatterns, libraries, functions };
    }

    analyzeFileContext(session) {
        return {
            fileTypes: this.extractFileTypes(session),
            projectStructure: this.analyzeProjectStructure(session)
        };
    }

    analyzeTemporalSignals(session) {
        return {
            duration: this.calculateSessionDuration(session),
            timeOfDay: this.getTimeOfDay(session),
            dayOfWeek: this.getDayOfWeek(session)
        };
    }

    analyzeBehavioralSignals(session) {
        return {
            keystrokePatterns: this.analyzeKeystrokePatterns(session),
            editPatterns: this.analyzeEditPatterns(session)
        };
    }

    // Helper methods
    extractFileTypes(session) {
        const files = session.files || [];
        return files.map(f => f.path || f.name || '').map(path => path.split('.').pop());
    }

    analyzeProjectStructure(session) {
        // Simplified project structure analysis
        return 'standard';
    }

    calculateSessionDuration(session) {
        if (session.startTime && session.endTime) {
            return new Date(session.endTime) - new Date(session.startTime);
        }
        return 0;
    }

    getTimeOfDay(session) {
        const hour = new Date(session.timestamp).getHours();
        if (hour < 6) return 'night';
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    getDayOfWeek(session) {
        return new Date(session.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
    }

    analyzeKeystrokePatterns(session) {
        // Simplified keystroke analysis
        return 'normal';
    }

    analyzeEditPatterns(session) {
        // Simplified edit pattern analysis
        return 'incremental';
    }
}

module.exports = HierarchicalIntentClassifier;
