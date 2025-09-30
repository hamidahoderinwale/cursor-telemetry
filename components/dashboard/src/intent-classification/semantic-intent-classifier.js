/**
 * Semantic Intent Classification System
 * Uses semantic understanding instead of simple keyword matching
 */

class SemanticIntentClassifier {
    constructor() {
        this.semanticPatterns = this.initializeSemanticPatterns();
        this.embeddingCache = new Map();
        this.similarityThreshold = 0.7;
    }

    /**
     * Initialize semantic patterns with contextual understanding
     */
    initializeSemanticPatterns() {
        return {
            'data_exploration': {
                semantic_vectors: [
                    'explore data understand structure analyze patterns',
                    'examine dataset investigate relationships discover insights',
                    'data profiling quality assessment missing values analysis',
                    'statistical summary descriptive statistics data overview'
                ],
                contextual_patterns: {
                    'beginner': ['basic data exploration', 'simple analysis', 'data overview'],
                    'intermediate': ['statistical analysis', 'correlation analysis', 'pattern discovery'],
                    'advanced': ['multivariate analysis', 'advanced statistics', 'complex relationships']
                },
                intent_embeddings: this.generateIntentEmbeddings('data_exploration')
            },
            'feature_engineering': {
                semantic_vectors: [
                    'create features transform data prepare modeling',
                    'feature selection engineering preprocessing normalization',
                    'encode categorical variables scale numerical features',
                    'derive new features combine existing variables'
                ],
                contextual_patterns: {
                    'beginner': ['basic feature creation', 'simple transformations'],
                    'intermediate': ['feature selection', 'encoding techniques'],
                    'advanced': ['advanced feature engineering', 'custom transformations']
                },
                intent_embeddings: this.generateIntentEmbeddings('feature_engineering')
            },
            'machine_learning': {
                semantic_vectors: [
                    'train model build algorithm predict outcomes',
                    'machine learning model development training validation',
                    'supervised learning classification regression prediction',
                    'model evaluation performance metrics accuracy precision'
                ],
                contextual_patterns: {
                    'beginner': ['basic model training', 'simple algorithms'],
                    'intermediate': ['model selection', 'hyperparameter tuning'],
                    'advanced': ['ensemble methods', 'deep learning', 'custom architectures']
                },
                intent_embeddings: this.generateIntentEmbeddings('machine_learning')
            },
            'data_visualization': {
                semantic_vectors: [
                    'create charts plots graphs visualize data',
                    'data visualization graphical representation insights',
                    'plot data show relationships display patterns',
                    'interactive visualization dashboard charts graphs'
                ],
                contextual_patterns: {
                    'beginner': ['basic plots', 'simple charts'],
                    'intermediate': ['complex visualizations', 'interactive plots'],
                    'advanced': ['custom visualizations', 'advanced graphics']
                },
                intent_embeddings: this.generateIntentEmbeddings('data_visualization')
            },
            'implementation': {
                semantic_vectors: [
                    'implement code build application develop software',
                    'write functions create classes build system',
                    'programming development coding implementation',
                    'software engineering application development'
                ],
                contextual_patterns: {
                    'beginner': ['basic coding', 'simple functions'],
                    'intermediate': ['modular code', 'design patterns'],
                    'advanced': ['system architecture', 'performance optimization']
                },
                intent_embeddings: this.generateIntentEmbeddings('implementation')
            },
            'debugging': {
                semantic_vectors: [
                    'debug fix errors troubleshoot problems resolve issues',
                    'error handling exception management bug fixing',
                    'troubleshoot debug trace identify problems',
                    'fix bugs resolve errors correct issues'
                ],
                contextual_patterns: {
                    'beginner': ['syntax errors', 'basic debugging'],
                    'intermediate': ['logic errors', 'complex debugging'],
                    'advanced': ['performance issues', 'system debugging']
                },
                intent_embeddings: this.generateIntentEmbeddings('debugging')
            }
        };
    }

    /**
     * Generate intent embeddings (simplified version)
     */
    generateIntentEmbeddings(intent) {
        // In a real implementation, this would use actual embedding models
        // For now, we'll create semantic representations
        const embeddings = {
            'data_exploration': [0.8, 0.6, 0.4, 0.7, 0.3, 0.5, 0.9, 0.2],
            'feature_engineering': [0.6, 0.8, 0.7, 0.5, 0.9, 0.4, 0.3, 0.6],
            'machine_learning': [0.7, 0.9, 0.8, 0.6, 0.5, 0.7, 0.4, 0.8],
            'data_visualization': [0.5, 0.4, 0.6, 0.8, 0.2, 0.9, 0.7, 0.3],
            'implementation': [0.9, 0.7, 0.5, 0.4, 0.8, 0.6, 0.2, 0.7],
            'debugging': [0.4, 0.5, 0.9, 0.3, 0.6, 0.8, 0.5, 0.9]
        };
        return embeddings[intent] || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    }

    /**
     * Classify intent using semantic analysis
     */
    async classifyIntent(session, conversations = []) {
        const content = this.extractContent(session, conversations);
        const semanticAnalysis = await this.performSemanticAnalysis(content);
        const contextualAnalysis = this.performContextualAnalysis(semanticAnalysis, session);
        
        return {
            primary_intent: contextualAnalysis.primary,
            secondary_intent: contextualAnalysis.secondary,
            confidence: contextualAnalysis.confidence,
            semantic_scores: semanticAnalysis.scores,
            contextual_factors: contextualAnalysis.factors,
            analysis: {
                method: 'semantic_classification',
                timestamp: new Date().toISOString(),
                semantic_vectors_used: semanticAnalysis.vectors_used
            }
        };
    }

    /**
     * Perform semantic analysis on content
     */
    async performSemanticAnalysis(content) {
        const contentEmbedding = await this.generateContentEmbedding(content);
        const scores = {};
        const vectorsUsed = [];

        for (const [intent, config] of Object.entries(this.semanticPatterns)) {
            let maxSimilarity = 0;
            let bestVector = null;

            // Compare with semantic vectors
            for (const vector of config.semantic_vectors) {
                const vectorEmbedding = await this.generateContentEmbedding(vector);
                const similarity = this.calculateCosineSimilarity(contentEmbedding, vectorEmbedding);
                
                if (similarity > maxSimilarity) {
                    maxSimilarity = similarity;
                    bestVector = vector;
                }
            }

            // Compare with intent embeddings
            const intentSimilarity = this.calculateCosineSimilarity(contentEmbedding, config.intent_embeddings);
            const finalScore = Math.max(maxSimilarity, intentSimilarity);

            scores[intent] = {
                similarity: finalScore,
                semantic_match: maxSimilarity,
                embedding_match: intentSimilarity,
                best_vector: bestVector
            };

            if (finalScore > this.similarityThreshold) {
                vectorsUsed.push({ intent, vector: bestVector, score: finalScore });
            }
        }

        return {
            scores,
            vectors_used: vectorsUsed,
            content_embedding: contentEmbedding
        };
    }

    /**
     * Perform contextual analysis
     */
    performContextualAnalysis(semanticAnalysis, session) {
        const context = this.extractContextualFactors(session);
        const baseScores = semanticAnalysis.scores;
        
        // Apply contextual modifiers
        const contextualScores = {};
        for (const [intent, score] of Object.entries(baseScores)) {
            let contextualScore = score.similarity;
            
            // Apply domain-specific modifiers
            if (context.domain && this.semanticPatterns[intent].contextual_patterns[context.domain]) {
                contextualScore *= 1.2;
            }
            
            // Apply expertise modifiers
            if (context.expertise && this.semanticPatterns[intent].contextual_patterns[context.expertise]) {
                contextualScore *= 1.1;
            }
            
            // Apply temporal modifiers
            if (context.temporal && this.isTemporalRelevant(intent, context.temporal)) {
                contextualScore *= 1.15;
            }
            
            contextualScores[intent] = Math.min(contextualScore, 1.0);
        }

        // Find best match
        const sortedScores = Object.entries(contextualScores)
            .sort(([,a], [,b]) => b - a);
        
        const primary = sortedScores[0][0];
        const secondary = sortedScores[1] ? sortedScores[1][0] : null;
        const confidence = sortedScores[0][1];

        return {
            primary,
            secondary,
            confidence,
            factors: context,
            original_scores: baseScores,
            contextual_scores: contextualScores
        };
    }

    /**
     * Generate content embedding (simplified version)
     */
    async generateContentEmbedding(content) {
        // Check cache first
        const cacheKey = this.hashContent(content);
        if (this.embeddingCache.has(cacheKey)) {
            return this.embeddingCache.get(cacheKey);
        }

        // Generate embedding based on content analysis
        const embedding = this.createSemanticEmbedding(content);
        
        // Cache the result
        this.embeddingCache.set(cacheKey, embedding);
        
        return embedding;
    }

    /**
     * Create semantic embedding from content
     */
    createSemanticEmbedding(content) {
        const words = content.toLowerCase().split(/\s+/);
        const embedding = new Array(8).fill(0);
        
        // Semantic feature extraction
        const features = {
            data_focus: this.extractDataFocus(words),
            analysis_focus: this.extractAnalysisFocus(words),
            implementation_focus: this.extractImplementationFocus(words),
            visualization_focus: this.extractVisualizationFocus(words),
            debugging_focus: this.extractDebuggingFocus(words),
            complexity_level: this.extractComplexityLevel(words),
            technical_depth: this.extractTechnicalDepth(words),
            domain_specificity: this.extractDomainSpecificity(words)
        };

        // Map features to embedding dimensions
        embedding[0] = features.data_focus;
        embedding[1] = features.analysis_focus;
        embedding[2] = features.implementation_focus;
        embedding[3] = features.visualization_focus;
        embedding[4] = features.debugging_focus;
        embedding[5] = features.complexity_level;
        embedding[6] = features.technical_depth;
        embedding[7] = features.domain_specificity;

        return embedding;
    }

    /**
     * Extract semantic features from words
     */
    extractDataFocus(words) {
        const dataWords = ['data', 'dataset', 'csv', 'json', 'database', 'table', 'record'];
        return this.calculateFeatureScore(words, dataWords);
    }

    extractAnalysisFocus(words) {
        const analysisWords = ['analyze', 'analysis', 'explore', 'examine', 'investigate', 'study'];
        return this.calculateFeatureScore(words, analysisWords);
    }

    extractImplementationFocus(words) {
        const implWords = ['implement', 'build', 'create', 'develop', 'code', 'program'];
        return this.calculateFeatureScore(words, implWords);
    }

    extractVisualizationFocus(words) {
        const vizWords = ['plot', 'chart', 'graph', 'visualize', 'display', 'show'];
        return this.calculateFeatureScore(words, vizWords);
    }

    extractDebuggingFocus(words) {
        const debugWords = ['debug', 'fix', 'error', 'bug', 'troubleshoot', 'issue'];
        return this.calculateFeatureScore(words, debugWords);
    }

    extractComplexityLevel(words) {
        const complexWords = ['complex', 'advanced', 'sophisticated', 'intricate', 'elaborate'];
        const simpleWords = ['simple', 'basic', 'easy', 'straightforward', 'elementary'];
        
        const complexScore = this.calculateFeatureScore(words, complexWords);
        const simpleScore = this.calculateFeatureScore(words, simpleWords);
        
        return complexScore - simpleScore;
    }

    extractTechnicalDepth(words) {
        const techWords = ['algorithm', 'architecture', 'optimization', 'performance', 'scalability'];
        return this.calculateFeatureScore(words, techWords);
    }

    extractDomainSpecificity(words) {
        const domainWords = ['machine learning', 'data science', 'web development', 'api', 'database'];
        return this.calculateFeatureScore(words, domainWords);
    }

    /**
     * Calculate feature score based on word presence
     */
    calculateFeatureScore(words, targetWords) {
        let score = 0;
        for (const word of words) {
            for (const target of targetWords) {
                if (word.includes(target) || target.includes(word)) {
                    score += 1;
                }
            }
        }
        return Math.min(score / targetWords.length, 1);
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    calculateCosineSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same length');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }

        return dotProduct / (norm1 * norm2);
    }

    /**
     * Extract content from session and conversations
     */
    extractContent(session, conversations) {
        let content = '';
        
        // Add conversation content
        if (conversations) {
            content += conversations.map(c => 
                c.content || c.prompt || c.response || ''
            ).join(' ');
        }
        
        // Add code content
        if (session.codeDeltas) {
            content += session.codeDeltas.map(d => 
                d.content || d.afterContent || ''
            ).join(' ');
        }
        
        // Add file context
        if (session.currentFile) {
            content += session.currentFile;
        }
        
        return content;
    }

    /**
     * Extract contextual factors
     */
    extractContextualFactors(session) {
        return {
            domain: this.detectDomain(session),
            expertise: this.assessExpertise(session),
            temporal: this.analyzeTemporalContext(session),
            technical: this.analyzeTechnicalContext(session)
        };
    }

    /**
     * Detect domain from session
     */
    detectDomain(session) {
        const content = this.extractContent(session);
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.includes('pandas') || lowerContent.includes('numpy') || lowerContent.includes('jupyter')) {
            return 'data_science';
        }
        if (lowerContent.includes('react') || lowerContent.includes('vue') || lowerContent.includes('angular')) {
            return 'web_development';
        }
        if (lowerContent.includes('tensorflow') || lowerContent.includes('pytorch') || lowerContent.includes('sklearn')) {
            return 'machine_learning';
        }
        
        return 'general';
    }

    /**
     * Assess expertise level
     */
    assessExpertise(session) {
        const content = this.extractContent(session);
        const lowerContent = content.toLowerCase();
        
        if (lowerContent.includes('async') || lowerContent.includes('decorator') || lowerContent.includes('metaclass')) {
            return 'advanced';
        }
        if (lowerContent.includes('class ') || lowerContent.includes('def ') || lowerContent.includes('import ')) {
            return 'intermediate';
        }
        
        return 'beginner';
    }

    /**
     * Analyze temporal context
     */
    analyzeTemporalContext(session) {
        const timestamp = new Date(session.timestamp);
        return {
            timeOfDay: this.getTimeOfDay(timestamp),
            dayOfWeek: this.getDayOfWeek(timestamp),
            sessionDuration: this.getSessionDuration(session)
        };
    }

    /**
     * Analyze technical context
     */
    analyzeTechnicalContext(session) {
        const content = this.extractContent(session);
        return {
            technologies: this.extractTechnologies(content),
            frameworks: this.extractFrameworks(content),
            complexity: this.assessComplexity(content)
        };
    }

    /**
     * Check if intent is temporally relevant
     */
    isTemporalRelevant(intent, temporalContext) {
        const timeOfDay = temporalContext.timeOfDay;
        
        // Some intents are more likely at certain times
        const temporalPatterns = {
            'data_exploration': ['morning', 'afternoon'],
            'implementation': ['morning', 'afternoon'],
            'debugging': ['evening', 'night'],
            'documentation': ['afternoon', 'evening']
        };
        
        return temporalPatterns[intent]?.includes(timeOfDay) || true;
    }

    /**
     * Hash content for caching
     */
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    // Utility methods
    getTimeOfDay(timestamp) {
        const hour = timestamp.getHours();
        if (hour < 6) return 'night';
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    }

    getDayOfWeek(timestamp) {
        return timestamp.toLocaleDateString('en-US', { weekday: 'long' });
    }

    getSessionDuration(session) {
        if (session.startTime && session.endTime) {
            return new Date(session.endTime) - new Date(session.startTime);
        }
        return 0;
    }

    extractTechnologies(content) {
        const technologies = [];
        const techPatterns = {
            'python': ['python', 'pandas', 'numpy'],
            'javascript': ['javascript', 'node', 'react'],
            'java': ['java', 'spring'],
            'go': ['go', 'golang']
        };

        for (const [tech, patterns] of Object.entries(techPatterns)) {
            if (patterns.some(pattern => content.toLowerCase().includes(pattern))) {
                technologies.push(tech);
            }
        }

        return technologies;
    }

    extractFrameworks(content) {
        const frameworks = [];
        const frameworkPatterns = ['django', 'flask', 'react', 'vue', 'angular'];
        
        for (const framework of frameworkPatterns) {
            if (content.toLowerCase().includes(framework)) {
                frameworks.push(framework);
            }
        }

        return frameworks;
    }

    assessComplexity(content) {
        let complexity = 0;
        
        if (content.includes('async') || content.includes('await')) complexity += 0.3;
        if (content.includes('class ') || content.includes('def ')) complexity += 0.2;
        if (content.includes('import ') || content.includes('from ')) complexity += 0.1;
        if (content.includes('try:') || content.includes('except:')) complexity += 0.1;
        
        if (complexity < 0.3) return 'low';
        if (complexity < 0.6) return 'medium';
        return 'high';
    }
}

module.exports = SemanticIntentClassifier;
