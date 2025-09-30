/**
 * Enhanced Event Type Classification System
 * Leverages embeddings, Kura analysis, and AST parsing for fine-grained event classification
 */

const EmbeddingsIntentClassifier = require('./embeddings-intent-classifier');
const ASTIntentClassifier = require('./ast-intent-classifier');
const CellStageClassifier = require('../web-interface/components/cell-stage-classifier');

class EnhancedEventTypeClassifier {
    constructor() {
        this.embeddingsClassifier = new EmbeddingsIntentClassifier();
        this.astClassifier = new ASTIntentClassifier();
        this.cellStageClassifier = new CellStageClassifier();
        
        // Fine-grained event type taxonomy
        this.eventTypeTaxonomy = {
            // Data Science & Analysis
            'data_exploration': {
                subtypes: [
                    'eda_initial', 'eda_descriptive', 'eda_correlation', 'eda_distribution',
                    'data_profiling', 'data_quality_check', 'outlier_detection', 'missing_data_analysis'
                ],
                embeddings: ['exploration', 'analysis', 'investigation', 'examination', 'profiling'],
                ast_patterns: ['pd.read_', 'df.head', 'df.describe', 'df.info', 'df.isnull'],
                kura_facets: ['DataScienceIntent', 'AnalysisType']
            },
            'data_visualization': {
                subtypes: [
                    'plot_creation', 'chart_generation', 'dashboard_building', 'interactive_viz',
                    'statistical_plot', 'geospatial_viz', 'time_series_plot', 'comparative_viz'
                ],
                embeddings: ['visualization', 'plotting', 'charting', 'graphing', 'dashboard'],
                ast_patterns: ['plt.', 'sns.', 'plotly.', 'altair.', 'bokeh.', 'matplotlib'],
                kura_facets: ['DataScienceIntent', 'VisualizationType']
            },
            'machine_learning': {
                subtypes: [
                    'model_training', 'model_evaluation', 'feature_engineering', 'hyperparameter_tuning',
                    'model_selection', 'cross_validation', 'ensemble_methods', 'deep_learning'
                ],
                embeddings: ['machine_learning', 'ml', 'training', 'model', 'prediction', 'classification'],
                ast_patterns: ['sklearn.', 'tensorflow.', 'torch.', 'keras.', 'xgboost', 'lightgbm'],
                kura_facets: ['DataScienceIntent', 'MLWorkflow']
            },
            
            // Software Development
            'implementation': {
                subtypes: [
                    'feature_development', 'api_implementation', 'algorithm_implementation', 'refactoring',
                    'architecture_design', 'design_pattern_application', 'integration_work', 'optimization'
                ],
                embeddings: ['implementation', 'development', 'coding', 'programming', 'building'],
                ast_patterns: ['def ', 'class ', 'import ', 'from ', 'function', 'async def'],
                kura_facets: ['SoftwareDevelopmentIntent', 'ImplementationType']
            },
            'debugging': {
                subtypes: [
                    'error_investigation', 'performance_debugging', 'logic_debugging', 'integration_debugging',
                    'memory_debugging', 'concurrency_debugging', 'api_debugging', 'test_debugging'
                ],
                embeddings: ['debugging', 'troubleshooting', 'fixing', 'error', 'bug', 'issue'],
                ast_patterns: ['print(', 'debugger', 'try:', 'except:', 'raise', 'logging'],
                kura_facets: ['SoftwareDevelopmentIntent', 'DebuggingType']
            },
            'testing': {
                subtypes: [
                    'unit_testing', 'integration_testing', 'test_development', 'test_automation',
                    'performance_testing', 'security_testing', 'ui_testing', 'api_testing'
                ],
                embeddings: ['testing', 'test', 'validation', 'verification', 'quality_assurance'],
                ast_patterns: ['pytest', 'unittest', 'test_', 'assert', 'mock', 'fixture'],
                kura_facets: ['SoftwareDevelopmentIntent', 'TestingType']
            },
            
            // Research & Documentation
            'research': {
                subtypes: [
                    'literature_review', 'hypothesis_formation', 'experimental_design', 'data_collection',
                    'statistical_analysis', 'result_interpretation', 'paper_writing', 'presentation_prep'
                ],
                embeddings: ['research', 'study', 'investigation', 'analysis', 'experiment'],
                ast_patterns: ['research', 'study', 'experiment', 'hypothesis', 'statistical'],
                kura_facets: ['ResearchIntent', 'ResearchType']
            },
            'documentation': {
                subtypes: [
                    'api_documentation', 'code_documentation', 'user_guide', 'technical_writing',
                    'tutorial_creation', 'readme_writing', 'specification_writing', 'knowledge_base'
                ],
                embeddings: ['documentation', 'writing', 'explaining', 'describing', 'tutorial'],
                ast_patterns: ['docstring', 'comment', 'markdown', 'rst', 'sphinx'],
                kura_facets: ['DocumentationIntent', 'DocumentationType']
            },
            
            // Infrastructure & DevOps
            'infrastructure': {
                subtypes: [
                    'deployment_setup', 'environment_configuration', 'scaling_work', 'monitoring_setup',
                    'security_configuration', 'backup_setup', 'disaster_recovery', 'performance_tuning'
                ],
                embeddings: ['infrastructure', 'deployment', 'configuration', 'scaling', 'monitoring'],
                ast_patterns: ['docker', 'kubernetes', 'terraform', 'ansible', 'deployment'],
                kura_facets: ['InfrastructureIntent', 'InfrastructureType']
            },
            'devops': {
                subtypes: [
                    'ci_cd_setup', 'automation_scripting', 'build_optimization', 'release_management',
                    'environment_management', 'tool_integration', 'workflow_optimization', 'process_improvement'
                ],
                embeddings: ['devops', 'automation', 'ci_cd', 'pipeline', 'workflow'],
                ast_patterns: ['github_actions', 'jenkins', 'gitlab_ci', 'pipeline', 'workflow'],
                kura_facets: ['DevOpsIntent', 'DevOpsType']
            },
            
            // Communication & Collaboration
            'communication': {
                subtypes: [
                    'team_meeting', 'code_review', 'mentoring', 'knowledge_sharing',
                    'stakeholder_communication', 'presentation', 'training', 'collaboration'
                ],
                embeddings: ['communication', 'meeting', 'discussion', 'collaboration', 'sharing'],
                ast_patterns: ['meeting', 'review', 'discussion', 'presentation', 'collaboration'],
                kura_facets: ['CommunicationIntent', 'CommunicationType']
            },
            
            // Learning & Exploration
            'learning': {
                subtypes: [
                    'tutorial_following', 'experimentation', 'skill_development', 'technology_exploration',
                    'concept_learning', 'best_practice_research', 'tool_evaluation', 'methodology_study'
                ],
                embeddings: ['learning', 'tutorial', 'experiment', 'exploration', 'study'],
                ast_patterns: ['tutorial', 'example', 'demo', 'experiment', 'learning'],
                kura_facets: ['LearningIntent', 'LearningType']
            }
        };
        
        // Context-aware classification weights
        this.classificationWeights = {
            embeddings: 0.35,      // Semantic understanding
            ast: 0.25,             // Code structure analysis
            kura: 0.20,            // Kura facet analysis
            temporal: 0.10,        // Temporal patterns
            file_context: 0.05,    // File type and project context
            behavioral: 0.05       // User behavior patterns
        };
    }

    /**
     * Classify event type with enhanced multi-modal analysis
     */
    async classifyEventType(session, conversations = [], context = {}) {
        try {
            console.log(`Enhanced event type classification for session: ${session.id}`);
            
            // Run parallel analyses
            const [embeddingsAnalysis, astAnalysis, kuraAnalysis, temporalAnalysis] = await Promise.all([
                this.analyzeWithEmbeddings(session, conversations),
                this.analyzeWithAST(session),
                this.analyzeWithKura(session, conversations),
                this.analyzeTemporalContext(session, context)
            ]);
            
            // Combine analyses with weighted scoring
            const classification = this.combineAnalyses({
                embeddings: embeddingsAnalysis,
                ast: astAnalysis,
                kura: kuraAnalysis,
                temporal: temporalAnalysis,
                session,
                conversations
            });
            
            // Add subtype classification
            const subtypeClassification = this.classifySubtype(classification, session, conversations);
            
            return {
                primary_type: classification.primary_type,
                subtype: subtypeClassification.subtype,
                confidence: classification.confidence,
                alternative_types: classification.alternatives,
                analysis_details: {
                    embeddings: embeddingsAnalysis,
                    ast: astAnalysis,
                    kura: kuraAnalysis,
                    temporal: temporalAnalysis
                },
                metadata: {
                    classification_method: 'enhanced_multi_modal',
                    timestamp: new Date().toISOString(),
                    session_id: session.id
                }
            };
            
        } catch (error) {
            console.error('Error in enhanced event type classification:', error);
            return this.getFallbackClassification(session);
        }
    }

    /**
     * Analyze session using embeddings-based classification
     */
    async analyzeWithEmbeddings(session, conversations) {
        try {
            const embeddingsResult = await this.embeddingsClassifier.classifyIntent(session, conversations);
            
            // Map embeddings results to event types
            const eventTypeScores = {};
            for (const [eventType, config] of Object.entries(this.eventTypeTaxonomy)) {
                let score = 0;
                
                // Check embedding similarity
                if (embeddingsResult.embeddings) {
                    for (const keyword of config.embeddings) {
                        const similarity = this.calculateEmbeddingSimilarity(
                            embeddingsResult.embeddings.conversation,
                            keyword
                        );
                        score += similarity * 0.3;
                    }
                }
                
                // Use primary intent confidence
                if (embeddingsResult.primary_intent === eventType) {
                    score += embeddingsResult.confidence * 0.7;
                }
                
                eventTypeScores[eventType] = score;
            }
            
            return {
                method: 'embeddings',
                scores: eventTypeScores,
                primary_intent: embeddingsResult.primary_intent,
                confidence: embeddingsResult.confidence,
                embeddings: embeddingsResult.embeddings
            };
            
        } catch (error) {
            console.error('Embeddings analysis error:', error);
            return { method: 'embeddings', error: error.message };
        }
    }

    /**
     * Analyze session using AST-based classification
     */
    async analyzeWithAST(session) {
        try {
            const astResult = await this.astClassifier.classifyIntent(session);
            
            // Map AST patterns to event types
            const eventTypeScores = {};
            for (const [eventType, config] of Object.entries(this.eventTypeTaxonomy)) {
                let score = 0;
                
                // Check AST patterns
                if (astResult.patterns) {
                    for (const pattern of config.ast_patterns) {
                        const patternMatches = astResult.patterns.filter(p => 
                            p.includes(pattern.replace('_', '')) || 
                            p.includes(pattern.replace('.', ''))
                        ).length;
                        score += (patternMatches / Math.max(astResult.patterns.length, 1)) * 0.5;
                    }
                }
                
                // Use complexity as a factor
                if (astResult.complexity) {
                    const complexityScore = Math.min(astResult.complexity / 10, 1);
                    score += complexityScore * 0.3;
                }
                
                // Use primary classification
                if (astResult.primary_intent === eventType) {
                    score += 0.2;
                }
                
                eventTypeScores[eventType] = score;
            }
            
            return {
                method: 'ast',
                scores: eventTypeScores,
                patterns: astResult.patterns,
                complexity: astResult.complexity,
                primary_intent: astResult.primary_intent
            };
            
        } catch (error) {
            console.error('AST analysis error:', error);
            return { method: 'ast', error: error.message };
        }
    }

    /**
     * Analyze session using Kura facet analysis
     */
    async analyzeWithKura(session, conversations) {
        try {
            // Use cell stage classifier for Kura-like analysis
            const kuraResult = await this.cellStageClassifier.classifyCellStage(
                session.codeDeltas?.[0]?.afterContent || '',
                { session, conversations }
            );
            
            // Map Kura facets to event types
            const eventTypeScores = {};
            for (const [eventType, config] of Object.entries(this.eventTypeTaxonomy)) {
                let score = 0;
                
                // Check Kura facets
                if (kuraResult.clioAnalysis && kuraResult.clioAnalysis.facetScores) {
                    for (const facet of config.kura_facets) {
                        const facetScore = kuraResult.clioAnalysis.facetScores[facet]?.score || 0;
                        score += facetScore * 0.4;
                    }
                }
                
                // Use stage classification
                if (kuraResult.stage === eventType) {
                    score += kuraResult.confidence * 0.6;
                }
                
                eventTypeScores[eventType] = score;
            }
            
            return {
                method: 'kura',
                scores: eventTypeScores,
                stage: kuraResult.stage,
                confidence: kuraResult.confidence,
                clioAnalysis: kuraResult.clioAnalysis
            };
            
        } catch (error) {
            console.error('Kura analysis error:', error);
            return { method: 'kura', error: error.message };
        }
    }

    /**
     * Analyze temporal context and patterns
     */
    analyzeTemporalContext(session, context) {
        try {
            const eventTypeScores = {};
            
            // Time-based patterns
            const hour = new Date(session.timestamp).getHours();
            const dayOfWeek = new Date(session.timestamp).getDay();
            
            // Session duration patterns
            const duration = session.duration || 0;
            const isLongSession = duration > 3600; // > 1 hour
            const isShortSession = duration < 300; // < 5 minutes
            
            // Code change patterns
            const codeChanges = session.codeDeltas?.length || 0;
            const isHighActivity = codeChanges > 20;
            const isLowActivity = codeChanges < 3;
            
            // Apply temporal scoring
            for (const [eventType, config] of Object.entries(this.eventTypeTaxonomy)) {
                let score = 0;
                
                // Time-based scoring
                if (eventType === 'research' && (hour >= 9 && hour <= 17)) {
                    score += 0.1; // Research more likely during work hours
                }
                if (eventType === 'learning' && (hour >= 19 || hour <= 7)) {
                    score += 0.1; // Learning more likely in evening/night
                }
                
                // Duration-based scoring
                if (eventType === 'implementation' && isLongSession) {
                    score += 0.1; // Implementation often takes time
                }
                if (eventType === 'debugging' && isShortSession) {
                    score += 0.1; // Quick debugging sessions
                }
                
                // Activity-based scoring
                if (eventType === 'data_exploration' && isHighActivity) {
                    score += 0.1; // EDA often involves many changes
                }
                if (eventType === 'documentation' && isLowActivity) {
                    score += 0.1; // Documentation often has fewer changes
                }
                
                eventTypeScores[eventType] = score;
            }
            
            return {
                method: 'temporal',
                scores: eventTypeScores,
                context: {
                    hour,
                    dayOfWeek,
                    duration,
                    codeChanges,
                    isLongSession,
                    isShortSession,
                    isHighActivity,
                    isLowActivity
                }
            };
            
        } catch (error) {
            console.error('Temporal analysis error:', error);
            return { method: 'temporal', error: error.message };
        }
    }

    /**
     * Combine all analyses with weighted scoring
     */
    combineAnalyses(analyses) {
        const { embeddings, ast, kura, temporal, session } = analyses;
        
        // Initialize combined scores
        const combinedScores = {};
        for (const eventType of Object.keys(this.eventTypeTaxonomy)) {
            combinedScores[eventType] = 0;
        }
        
        // Weight and combine scores from each method
        const methods = [
            { analysis: embeddings, weight: this.classificationWeights.embeddings },
            { analysis: ast, weight: this.classificationWeights.ast },
            { analysis: kura, weight: this.classificationWeights.kura },
            { analysis: temporal, weight: this.classificationWeights.temporal }
        ];
        
        for (const { analysis, weight } of methods) {
            if (analysis && analysis.scores && !analysis.error) {
                for (const [eventType, score] of Object.entries(analysis.scores)) {
                    combinedScores[eventType] += score * weight;
                }
            }
        }
        
        // Add file context scoring
        const fileContextScore = this.getFileContextScore(session);
        for (const [eventType, score] of Object.entries(fileContextScore)) {
            combinedScores[eventType] += score * this.classificationWeights.file_context;
        }
        
        // Sort by score and determine primary type
        const sortedTypes = Object.entries(combinedScores)
            .sort(([,a], [,b]) => b - a);
        
        const primaryType = sortedTypes[0][0];
        const primaryScore = sortedTypes[0][1];
        const alternatives = sortedTypes.slice(1, 4).map(([type, score]) => ({
            type,
            score,
            confidence: score / primaryScore
        }));
        
        // Calculate overall confidence
        const confidence = Math.min(primaryScore * 2, 1); // Normalize to 0-1
        
        return {
            primary_type: primaryType,
            confidence,
            alternatives,
            combined_scores: combinedScores
        };
    }

    /**
     * Classify subtype based on primary type and session details
     */
    classifySubtype(classification, session, conversations) {
        const primaryType = classification.primary_type;
        const typeConfig = this.eventTypeTaxonomy[primaryType];
        
        if (!typeConfig || !typeConfig.subtypes) {
            return { subtype: null, confidence: 0 };
        }
        
        // Analyze session content for subtype indicators
        const content = this.extractSessionContent(session, conversations);
        const subtypeScores = {};
        
        for (const subtype of typeConfig.subtypes) {
            let score = 0;
            
            // Check for subtype-specific patterns
            const patterns = this.getSubtypePatterns(subtype);
            for (const pattern of patterns) {
                if (content.includes(pattern)) {
                    score += 0.3;
                }
            }
            
            // Check for subtype-specific keywords
            const keywords = this.getSubtypeKeywords(subtype);
            for (const keyword of keywords) {
                if (content.toLowerCase().includes(keyword.toLowerCase())) {
                    score += 0.2;
                }
            }
            
            subtypeScores[subtype] = score;
        }
        
        // Find best subtype
        const sortedSubtypes = Object.entries(subtypeScores)
            .sort(([,a], [,b]) => b - a);
        
        const bestSubtype = sortedSubtypes[0][0];
        const bestScore = sortedSubtypes[0][1];
        
        return {
            subtype: bestSubtype,
            confidence: bestScore,
            alternatives: sortedSubtypes.slice(1, 3).map(([subtype, score]) => ({
                subtype,
                score
            }))
        };
    }

    /**
     * Get file context scoring
     */
    getFileContextScore(session) {
        const scores = {};
        const filePath = session.currentFile || '';
        const fileExtension = filePath.split('.').pop()?.toLowerCase();
        
        // Initialize all scores
        for (const eventType of Object.keys(this.eventTypeTaxonomy)) {
            scores[eventType] = 0;
        }
        
        // File extension based scoring
        if (fileExtension === 'ipynb') {
            scores['data_exploration'] += 0.3;
            scores['data_visualization'] += 0.3;
            scores['machine_learning'] += 0.2;
            scores['research'] += 0.2;
        } else if (['py', 'js', 'ts', 'java', 'cpp', 'c'].includes(fileExtension)) {
            scores['implementation'] += 0.4;
            scores['debugging'] += 0.3;
            scores['testing'] += 0.2;
        } else if (['md', 'rst', 'txt'].includes(fileExtension)) {
            scores['documentation'] += 0.5;
            scores['research'] += 0.3;
        } else if (['yml', 'yaml', 'json', 'toml'].includes(fileExtension)) {
            scores['infrastructure'] += 0.4;
            scores['devops'] += 0.3;
        }
        
        // Project context scoring
        if (filePath.includes('test') || filePath.includes('spec')) {
            scores['testing'] += 0.4;
        }
        if (filePath.includes('docs') || filePath.includes('documentation')) {
            scores['documentation'] += 0.4;
        }
        if (filePath.includes('config') || filePath.includes('deploy')) {
            scores['infrastructure'] += 0.3;
            scores['devops'] += 0.3;
        }
        
        return scores;
    }

    /**
     * Extract content from session for analysis
     */
    extractSessionContent(session, conversations) {
        let content = '';
        
        // Add code content
        if (session.codeDeltas) {
            content += session.codeDeltas.map(delta => 
                delta.afterContent || delta.beforeContent || ''
            ).join(' ');
        }
        
        // Add conversation content
        if (conversations) {
            content += conversations.map(conv => 
                conv.content || conv.message || ''
            ).join(' ');
        }
        
        // Add file path context
        if (session.currentFile) {
            content += ' ' + session.currentFile;
        }
        
        return content;
    }

    /**
     * Get subtype-specific patterns
     */
    getSubtypePatterns(subtype) {
        const patterns = {
            'eda_initial': ['df.head()', 'df.info()', 'df.shape', 'df.columns'],
            'eda_descriptive': ['df.describe()', 'df.mean()', 'df.std()', 'df.median()'],
            'plot_creation': ['plt.figure()', 'plt.plot()', 'plt.scatter()', 'plt.bar()'],
            'model_training': ['fit(', 'train_test_split', 'cross_val_score', 'GridSearchCV'],
            'unit_testing': ['test_', 'assert', 'unittest', 'pytest'],
            'api_documentation': ['@api', 'endpoint', 'swagger', 'openapi'],
            'deployment_setup': ['docker', 'kubernetes', 'deploy', 'production'],
            'ci_cd_setup': ['github_actions', 'jenkins', 'pipeline', 'workflow']
        };
        
        return patterns[subtype] || [];
    }

    /**
     * Get subtype-specific keywords
     */
    getSubtypeKeywords(subtype) {
        const keywords = {
            'eda_initial': ['initial', 'first look', 'overview', 'explore'],
            'eda_descriptive': ['descriptive', 'statistics', 'summary', 'describe'],
            'plot_creation': ['plot', 'chart', 'graph', 'visualize'],
            'model_training': ['train', 'fit', 'model', 'learning'],
            'unit_testing': ['test', 'unit', 'assert', 'verify'],
            'api_documentation': ['api', 'endpoint', 'documentation', 'swagger'],
            'deployment_setup': ['deploy', 'production', 'infrastructure', 'setup'],
            'ci_cd_setup': ['ci', 'cd', 'pipeline', 'automation']
        };
        
        return keywords[subtype] || [];
    }

    /**
     * Calculate embedding similarity (simplified)
     */
    calculateEmbeddingSimilarity(embedding, keyword) {
        // Simplified similarity calculation
        // In a real implementation, this would use proper embedding similarity
        return Math.random() * 0.5 + 0.3; // Placeholder
    }

    /**
     * Get fallback classification when analysis fails
     */
    getFallbackClassification(session) {
        const filePath = session.currentFile || '';
        
        if (filePath.endsWith('.ipynb')) {
            return {
                primary_type: 'data_exploration',
                subtype: 'eda_initial',
                confidence: 0.5,
                alternative_types: [],
                analysis_details: { error: 'Fallback classification' },
                metadata: { classification_method: 'fallback' }
            };
        } else if (session.codeDeltas && session.codeDeltas.length > 0) {
            return {
                primary_type: 'implementation',
                subtype: 'feature_development',
                confidence: 0.5,
                alternative_types: [],
                analysis_details: { error: 'Fallback classification' },
                metadata: { classification_method: 'fallback' }
            };
        } else {
            return {
                primary_type: 'communication',
                subtype: 'team_meeting',
                confidence: 0.3,
                alternative_types: [],
                analysis_details: { error: 'Fallback classification' },
                metadata: { classification_method: 'fallback' }
            };
        }
    }
}

module.exports = EnhancedEventTypeClassifier;
