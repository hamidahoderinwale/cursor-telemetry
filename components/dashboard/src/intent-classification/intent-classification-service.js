/**
 * Unified Intent Classification Service
 * Orchestrates multiple classification methods for optimal results
 */

const EnhancedIntentClassifier = require('./enhanced-intent-classifier');
const MLIntentClassifier = require('./ml-intent-classifier');
const ASTIntentClassifier = require('./ast-intent-classifier');
const EmbeddingsIntentClassifier = require('./embeddings-intent-classifier');

class IntentClassificationService {
    constructor() {
        this.classifiers = {
            enhanced: new EnhancedIntentClassifier(),
            ml: new MLIntentClassifier(),
            ast: new ASTIntentClassifier(),
            embeddings: new EmbeddingsIntentClassifier()
        };
        
        this.methodWeights = {
            enhanced: 0.4,      // Primary method - multi-signal analysis
            ml: 0.3,           // Machine learning approach
            ast: 0.2,          // Code structure analysis
            embeddings: 0.1    // Semantic embeddings (fallback)
        };
        
        this.isMLTrained = false;
        this.classificationHistory = [];
    }

    /**
     * Initialize the service with training data
     */
    async initialize(sessions = []) {
        console.log('Initializing Intent Classification Service...');
        
        // Train ML classifier if we have enough data
        if (sessions.length > 10) {
            try {
                await this.classifiers.ml.train(sessions);
                this.isMLTrained = true;
                console.log('ML classifier trained successfully');
            } catch (error) {
                console.warn('Failed to train ML classifier:', error);
            }
        }
        
        console.log('Intent Classification Service initialized');
    }

    /**
     * Classify intent using ensemble method
     */
    async classifyIntent(session, conversations = []) {
        const results = {};
        const startTime = Date.now();
        
        try {
            // Run all available classifiers
            const promises = [];
            
            // Enhanced classifier (always available)
            promises.push(
                this.classifiers.enhanced.classifyIntent(session, conversations)
                    .then(result => ({ method: 'enhanced', result }))
                    .catch(error => ({ method: 'enhanced', error }))
            );
            
            // ML classifier (if trained)
            if (this.isMLTrained) {
                promises.push(
                    this.classifiers.ml.classifyIntent(session, conversations)
                        .then(result => ({ method: 'ml', result }))
                        .catch(error => ({ method: 'ml', error }))
                );
            }
            
            // AST classifier (if code content available)
            if (session.codeDeltas && session.codeDeltas.length > 0) {
                const codeContent = session.codeDeltas.map(d => d.afterContent).join('\n');
                promises.push(
                    Promise.resolve(this.classifiers.ast.classifyIntent(codeContent, session.currentFile))
                        .then(result => ({ method: 'ast', result }))
                        .catch(error => ({ method: 'ast', error }))
                );
            }
            
            // Embeddings classifier (fallback)
            promises.push(
                this.classifiers.embeddings.classifyIntent(session, conversations)
                    .then(result => ({ method: 'embeddings', result }))
                    .catch(error => ({ method: 'embeddings', error }))
            );
            
            // Wait for all classifiers
            const classifierResults = await Promise.all(promises);
            
            // Process results
            for (const { method, result, error } of classifierResults) {
                if (error) {
                    console.warn(`Classifier ${method} failed:`, error);
                    results[method] = { error: error.message };
                } else {
                    results[method] = result;
                }
            }
            
            // Combine results using weighted voting
            const finalResult = this.combineResults(results);
            
            // Record classification for learning
            this.recordClassification(session, finalResult, Date.now() - startTime);
            
            return finalResult;
            
        } catch (error) {
            console.error('Error in intent classification:', error);
            return this.getFallbackResult(session);
        }
    }

    /**
     * Combine results from multiple classifiers
     */
    combineResults(results) {
        const intentScores = {};
        const totalWeight = Object.values(this.methodWeights).reduce((a, b) => a + b, 0);
        
        // Collect scores from all successful classifiers
        for (const [method, result] of Object.entries(results)) {
            if (result.error || !result.primary_intent) continue;
            
            const weight = this.methodWeights[method] || 0;
            const intent = result.primary_intent;
            const confidence = result.confidence || 0.5;
            
            if (!intentScores[intent]) {
                intentScores[intent] = 0;
            }
            
            intentScores[intent] += confidence * weight;
        }
        
        // Find the intent with highest weighted score
        const primaryIntent = Object.entries(intentScores)
            .sort(([,a], [,b]) => b - a)[0];
        
        // Calculate overall confidence
        const maxScore = primaryIntent ? primaryIntent[1] : 0;
        const overallConfidence = Math.min(maxScore / totalWeight, 1.0);
        
        return {
            primary_intent: primaryIntent ? primaryIntent[0] : 'unknown',
            confidence: overallConfidence,
            method: 'ensemble',
            individual_results: results,
            intent_scores: intentScores,
            analysis: {
                classifiers_used: Object.keys(results).filter(k => !results[k].error),
                total_weight: totalWeight,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Record classification for learning and improvement
     */
    recordClassification(session, result, processingTime) {
        const record = {
            session_id: session.id,
            timestamp: new Date().toISOString(),
            result: result,
            processing_time: processingTime,
            session_metadata: {
                has_code: !!(session.codeDeltas && session.codeDeltas.length > 0),
                has_conversations: !!(session.conversations && session.conversations.length > 0),
                file_type: session.currentFile ? session.currentFile.split('.').pop() : 'unknown',
                duration: session.duration || 0
            }
        };
        
        this.classificationHistory.push(record);
        
        // Keep only last 1000 records
        if (this.classificationHistory.length > 1000) {
            this.classificationHistory = this.classificationHistory.slice(-1000);
        }
    }

    /**
     * Get fallback result when all classifiers fail
     */
    getFallbackResult(session) {
        // Simple heuristic fallback
        let intent = 'unknown';
        let confidence = 0.1;
        
        if (session.currentFile && session.currentFile.endsWith('.ipynb')) {
            intent = 'data_exploration';
            confidence = 0.3;
        } else if (session.codeDeltas && session.codeDeltas.length > 0) {
            intent = 'implementation';
            confidence = 0.2;
        }
        
        return {
            primary_intent: intent,
            confidence: confidence,
            method: 'fallback',
            error: 'All classifiers failed',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get classification statistics
     */
    getStatistics() {
        const stats = {
            total_classifications: this.classificationHistory.length,
            method_usage: {},
            confidence_distribution: { high: 0, medium: 0, low: 0 },
            processing_times: [],
            intent_distribution: {}
        };
        
        for (const record of this.classificationHistory) {
            // Method usage
            const method = record.result.method || 'unknown';
            stats.method_usage[method] = (stats.method_usage[method] || 0) + 1;
            
            // Confidence distribution
            const confidence = record.result.confidence || 0;
            if (confidence > 0.7) stats.confidence_distribution.high++;
            else if (confidence > 0.4) stats.confidence_distribution.medium++;
            else stats.confidence_distribution.low++;
            
            // Processing times
            stats.processing_times.push(record.processing_time);
            
            // Intent distribution
            const intent = record.result.primary_intent || 'unknown';
            stats.intent_distribution[intent] = (stats.intent_distribution[intent] || 0) + 1;
        }
        
        // Calculate average processing time
        if (stats.processing_times.length > 0) {
            stats.average_processing_time = stats.processing_times.reduce((a, b) => a + b, 0) / stats.processing_times.length;
        }
        
        return stats;
    }

    /**
     * Retrain ML classifier with new data
     */
    async retrainMLClassifier(sessions) {
        try {
            await this.classifiers.ml.train(sessions);
            this.isMLTrained = true;
            console.log('ML classifier retrained successfully');
            return true;
        } catch (error) {
            console.error('Failed to retrain ML classifier:', error);
            return false;
        }
    }

    /**
     * Update method weights based on performance
     */
    updateMethodWeights(performanceData) {
        // Simple performance-based weight adjustment
        const totalPerformance = Object.values(performanceData).reduce((a, b) => a + b, 0);
        
        if (totalPerformance > 0) {
            for (const [method, performance] of Object.entries(performanceData)) {
                if (this.methodWeights[method] !== undefined) {
                    this.methodWeights[method] = performance / totalPerformance;
                }
            }
            
            console.log('Updated method weights:', this.methodWeights);
        }
    }
}

module.exports = IntentClassificationService;
