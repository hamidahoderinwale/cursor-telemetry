/**
 * Machine Learning-Based Intent Classification
 * Uses TF-IDF and simple ML models for intent classification
 */

class MLIntentClassifier {
    constructor() {
        this.model = null;
        this.vectorizer = null;
        this.isTrained = false;
        this.trainingData = [];
        this.featureExtractors = [
            this.extractTextFeatures,
            this.extractCodeFeatures,
            this.extractContextFeatures,
            this.extractTemporalFeatures
        ];
    }

    /**
     * Train the model with session data
     */
    async train(sessions) {
        console.log('Training ML intent classifier...');
        
        // Prepare training data
        const trainingFeatures = [];
        const trainingLabels = [];
        
        for (const session of sessions) {
            if (session.intent && session.conversations) {
                const features = this.extractFeatures(session);
                trainingFeatures.push(features);
                trainingLabels.push(session.intent);
            }
        }
        
        if (trainingFeatures.length === 0) {
            console.warn('No training data available');
            return;
        }
        
        // Simple TF-IDF vectorization
        this.vectorizer = this.createTFIDFVectorizer(trainingFeatures);
        const vectorizedFeatures = this.vectorizer.transform(trainingFeatures);
        
        // Train simple Naive Bayes-like classifier
        this.model = this.trainNaiveBayes(vectorizedFeatures, trainingLabels);
        this.isTrained = true;
        
        console.log(`Trained ML classifier with ${trainingFeatures.length} samples`);
    }

    /**
     * Classify intent using trained model
     */
    async classifyIntent(session, conversations = []) {
        if (!this.isTrained) {
            return this.getDefaultClassification();
        }
        
        const features = this.extractFeatures(session);
        const vectorizedFeatures = this.vectorizer.transform([features]);
        const prediction = this.model.predict(vectorizedFeatures[0]);
        
        return {
            primary_intent: prediction.label,
            confidence: prediction.confidence,
            method: 'ml_classification',
            features: features,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Extract comprehensive features from session
     */
    extractFeatures(session) {
        const features = {};
        
        for (const extractor of this.featureExtractors) {
            Object.assign(features, extractor.call(this, session));
        }
        
        return features;
    }

    /**
     * Extract text-based features from conversations
     */
    extractTextFeatures(session) {
        const conversations = session.conversations || [];
        const allText = conversations.map(c => 
            (c.userMessage || '') + ' ' + (c.assistantResponse || '')
        ).join(' ').toLowerCase();
        
        return {
            // Word counts
            word_count: allText.split(' ').length,
            char_count: allText.length,
            
            // Question indicators
            has_questions: /[?]/.test(allText),
            question_count: (allText.match(/[?]/g) || []).length,
            
            // Technical terms
            has_code_terms: /function|class|import|def|var|let|const/.test(allText),
            has_data_terms: /data|dataset|analysis|plot|chart|graph/.test(allText),
            has_debug_terms: /error|bug|fix|debug|exception/.test(allText),
            
            // Sentiment indicators
            has_positive_words: /good|great|excellent|perfect|success/.test(allText),
            has_negative_words: /bad|wrong|error|failed|problem/.test(allText),
            
            // Action words
            has_action_words: /create|build|implement|develop|make/.test(allText),
            has_exploration_words: /explore|analyze|investigate|examine/.test(allText)
        };
    }

    /**
     * Extract code-based features
     */
    extractCodeFeatures(session) {
        const codeDeltas = session.codeDeltas || [];
        const codeContent = codeDeltas.map(d => d.afterContent).join('\n');
        
        return {
            // Code metrics
            code_length: codeContent.length,
            line_count: codeContent.split('\n').length,
            change_count: codeDeltas.length,
            
            // Language features
            has_imports: /import\s+\w+|from\s+\w+\s+import/.test(codeContent),
            has_functions: /def\s+\w+|function\s+\w+/.test(codeContent),
            has_classes: /class\s+\w+/.test(codeContent),
            has_comments: /#.*|\/\/.*|\/\*.*\*\//.test(codeContent),
            
            // Library usage
            has_pandas: /pandas|pd\./.test(codeContent),
            has_numpy: /numpy|np\./.test(codeContent),
            has_matplotlib: /matplotlib|plt\./.test(codeContent),
            has_sklearn: /sklearn|from sklearn/.test(codeContent),
            
            // Code patterns
            has_loops: /for\s+\w+|while\s+/.test(codeContent),
            has_conditionals: /if\s+.*:|elif\s+.*:|else:/.test(codeContent),
            has_try_catch: /try:|except:|finally:/.test(codeContent),
            has_assertions: /assert\s+/.test(codeContent)
        };
    }

    /**
     * Extract context-based features
     */
    extractContextFeatures(session) {
        const fileName = session.currentFile || '';
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        
        return {
            // File context
            file_extension: fileExt,
            is_notebook: fileExt === 'ipynb',
            is_python: fileExt === 'py',
            is_javascript: fileExt === 'js' || fileExt === 'ts',
            is_markdown: fileExt === 'md',
            
            // File name patterns
            has_test_in_name: /test/i.test(fileName),
            has_demo_in_name: /demo/i.test(fileName),
            has_example_in_name: /example/i.test(fileName),
            
            // Project context
            is_data_science: /data|analysis|ml|ai|notebook/.test(fileName.toLowerCase()),
            is_web_dev: /web|html|css|js|react|vue/.test(fileName.toLowerCase()),
            is_backend: /api|server|backend|service/.test(fileName.toLowerCase())
        };
    }

    /**
     * Extract temporal features
     */
    extractTemporalFeatures(session) {
        const duration = session.duration || 0;
        const timestamp = new Date(session.timestamp);
        
        return {
            // Duration features
            session_duration: duration,
            is_short_session: duration < 300, // 5 minutes
            is_medium_session: duration >= 300 && duration < 1800, // 30 minutes
            is_long_session: duration >= 1800,
            
            // Time features
            hour_of_day: timestamp.getHours(),
            day_of_week: timestamp.getDay(),
            is_weekend: timestamp.getDay() === 0 || timestamp.getDay() === 6,
            is_business_hours: timestamp.getHours() >= 9 && timestamp.getHours() <= 17,
            
            // Activity patterns
            conversation_count: (session.conversations || []).length,
            change_frequency: duration > 0 ? (session.codeDeltas?.length || 0) / duration : 0
        };
    }

    /**
     * Create TF-IDF vectorizer
     */
    createTFIDFVectorizer(features) {
        const vocabulary = new Set();
        const documents = [];
        
        // Build vocabulary from all features
        for (const featureSet of features) {
            const doc = [];
            for (const [key, value] of Object.entries(featureSet)) {
                if (typeof value === 'string') {
                    vocabulary.add(key + '_' + value);
                    doc.push(key + '_' + value);
                } else if (typeof value === 'boolean' && value) {
                    vocabulary.add(key);
                    doc.push(key);
                } else if (typeof value === 'number') {
                    // Discretize numeric values
                    const discretized = this.discretizeNumeric(key, value);
                    vocabulary.add(key + '_' + discretized);
                    doc.push(key + '_' + discretized);
                }
            }
            documents.push(doc);
        }
        
        const vocabArray = Array.from(vocabulary);
        
        return {
            vocabulary: vocabArray,
            transform: (newFeatures) => {
                return newFeatures.map(featureSet => {
                    const vector = new Array(vocabArray.length).fill(0);
                    const doc = [];
                    
                    for (const [key, value] of Object.entries(featureSet)) {
                        if (typeof value === 'string') {
                            doc.push(key + '_' + value);
                        } else if (typeof value === 'boolean' && value) {
                            doc.push(key);
                        } else if (typeof value === 'number') {
                            const discretized = this.discretizeNumeric(key, value);
                            doc.push(key + '_' + discretized);
                        }
                    }
                    
                    // Calculate TF-IDF
                    for (let i = 0; i < vocabArray.length; i++) {
                        const term = vocabArray[i];
                        const tf = (doc.filter(d => d === term).length) / doc.length;
                        const df = documents.filter(d => d.includes(term)).length;
                        const idf = Math.log(documents.length / (df + 1));
                        vector[i] = tf * idf;
                    }
                    
                    return vector;
                });
            }
        };
    }

    /**
     * Discretize numeric values for categorical features
     */
    discretizeNumeric(key, value) {
        if (key.includes('count') || key.includes('length')) {
            if (value === 0) return 'zero';
            if (value < 5) return 'low';
            if (value < 20) return 'medium';
            return 'high';
        }
        
        if (key.includes('duration')) {
            if (value < 300) return 'short';
            if (value < 1800) return 'medium';
            return 'long';
        }
        
        if (key.includes('hour')) {
            if (value < 6) return 'night';
            if (value < 12) return 'morning';
            if (value < 18) return 'afternoon';
            return 'evening';
        }
        
        return 'default';
    }

    /**
     * Train simple Naive Bayes classifier
     */
    trainNaiveBayes(features, labels) {
        const classes = [...new Set(labels)];
        const classStats = {};
        
        // Calculate class priors and feature likelihoods
        for (const className of classes) {
            const classFeatures = features.filter((_, i) => labels[i] === className);
            const classPrior = classFeatures.length / features.length;
            
            // Calculate mean and variance for each feature
            const featureStats = [];
            for (let i = 0; i < features[0].length; i++) {
                const values = classFeatures.map(f => f[i]);
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
                featureStats.push({ mean, variance: Math.max(variance, 0.01) });
            }
            
            classStats[className] = {
                prior: classPrior,
                features: featureStats
            };
        }
        
        return {
            classes,
            stats: classStats,
            predict: (features) => {
                let bestClass = classes[0];
                let bestScore = -Infinity;
                
                for (const className of classes) {
                    const stats = classStats[className];
                    let score = Math.log(stats.prior);
                    
                    for (let i = 0; i < features.length; i++) {
                        const feature = features[i];
                        const featureStat = stats.features[i];
                        // Gaussian likelihood
                        const likelihood = Math.exp(-Math.pow(feature - featureStat.mean, 2) / (2 * featureStat.variance)) / Math.sqrt(2 * Math.PI * featureStat.variance);
                        score += Math.log(likelihood + 1e-10);
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestClass = className;
                    }
                }
                
                // Convert to probability
                const totalScore = classes.reduce((sum, className) => {
                    const stats = classStats[className];
                    let score = Math.log(stats.prior);
                    for (let i = 0; i < features.length; i++) {
                        const feature = features[i];
                        const featureStat = stats.features[i];
                        const likelihood = Math.exp(-Math.pow(feature - featureStat.mean, 2) / (2 * featureStat.variance)) / Math.sqrt(2 * Math.PI * featureStat.variance);
                        score += Math.log(likelihood + 1e-10);
                    }
                    return sum + Math.exp(score);
                }, 0);
                
                return {
                    label: bestClass,
                    confidence: Math.exp(bestScore) / totalScore
                };
            }
        };
    }

    /**
     * Get default classification when model is not trained
     */
    getDefaultClassification() {
        return {
            primary_intent: 'unknown',
            confidence: 0.1,
            method: 'default',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = MLIntentClassifier;
