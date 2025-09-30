/**
 * Enhanced Unified Intent Classification Service
 * Orchestrates multiple advanced classification methods for optimal results
 */

const EnhancedIntentClassifier = require('./enhanced-intent-classifier');
const HierarchicalIntentClassifier = require('./hierarchical-intent-classifier');
const ContextAwareClassifier = require('./context-aware-classifier');
const SemanticIntentClassifier = require('./semantic-intent-classifier');
const TemporalWorkflowAnalyzer = require('./temporal-workflow-analyzer');
const MLIntentClassifier = require('./ml-intent-classifier');
const ASTIntentClassifier = require('./ast-intent-classifier');
const EmbeddingsIntentClassifier = require('./embeddings-intent-classifier');

class IntentClassificationService {
    constructor() {
        this.classifiers = {
            hierarchical: new HierarchicalIntentClassifier(),
            contextAware: new ContextAwareClassifier(),
            semantic: new SemanticIntentClassifier(),
            temporal: new TemporalWorkflowAnalyzer(),
            enhanced: new EnhancedIntentClassifier(),
            ml: new MLIntentClassifier(),
            ast: new ASTIntentClassifier(),
            embeddings: new EmbeddingsIntentClassifier()
        };
        
        this.methodWeights = {
            hierarchical: 0.25,    // Hierarchical intent structure
            contextAware: 0.2,     // Context-aware classification
            semantic: 0.2,         // Semantic understanding
            temporal: 0.15,        // Temporal workflow analysis
            enhanced: 0.1,         // Legacy enhanced method
            ml: 0.05,             // Machine learning (when trained)
            ast: 0.03,            // Code structure analysis
            embeddings: 0.02      // Semantic embeddings (fallback)
        };
        
        this.isMLTrained = false;
        this.classificationHistory = [];
        this.userProfiles = new Map();
        this.workflowPatterns = new Map();
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
     * Enhanced classify intent using advanced ensemble method
     */
    async classifyIntent(session, conversations = []) {
        const results = {};
        const startTime = Date.now();
        
        try {
            // Run all available classifiers
            const promises = [];
            
            // Hierarchical classifier (primary)
            promises.push(
                this.classifiers.hierarchical.classifyIntent(session, conversations)
                    .then(result => ({ method: 'hierarchical', result }))
                    .catch(error => ({ method: 'hierarchical', error }))
            );
            
            // Context-aware classifier
            promises.push(
                this.classifiers.contextAware.classifyIntent(session, conversations)
                    .then(result => ({ method: 'contextAware', result }))
                    .catch(error => ({ method: 'contextAware', error }))
            );
            
            // Semantic classifier
            promises.push(
                this.classifiers.semantic.classifyIntent(session, conversations)
                    .then(result => ({ method: 'semantic', result }))
                    .catch(error => ({ method: 'semantic', error }))
            );
            
            // Temporal workflow analyzer
            promises.push(
                Promise.resolve(this.classifiers.temporal.analyzeWorkflowProgression(session, conversations))
                    .then(result => ({ method: 'temporal', result }))
                    .catch(error => ({ method: 'temporal', error }))
            );
            
            // Enhanced classifier (legacy)
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
            
            // Process results and create enhanced classification
            const enhancedResult = this.createEnhancedClassification(classifierResults, session, conversations);
            
            // Store classification history
            this.storeClassificationHistory(session.id, enhancedResult);
            
            // Update user profiles
            this.updateUserProfile(session, enhancedResult);
            
            return enhancedResult;
            
        } catch (error) {
            console.error('Error in enhanced intent classification:', error);
            return this.getFallbackClassification(session, conversations);
        }
    } { method, result, error } of classifierResults) {
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

    /**
     * Create enhanced classification from multiple classifier results
     */
    createEnhancedClassification(classifierResults, session, conversations) {
        const validResults = classifierResults.filter(r => !r.error);
        const errors = classifierResults.filter(r => r.error);
        
        // Extract primary intents from each classifier
        const intentVotes = {};
        const contextFactors = {};
        let workflowAnalysis = null;
        let totalConfidence = 0;
        let totalWeight = 0;
        
        for (const { method, result } of validResults) {
            const weight = this.methodWeights[method] || 0;
            
            if (method === 'temporal') {
                // Temporal analysis provides workflow context
                workflowAnalysis = result;
            } else {
                // Standard intent classification
                const primaryIntent = result.primary_intent || result.primary;
                const confidence = result.confidence || 0;
                
                if (primaryIntent) {
                    if (!intentVotes[primaryIntent]) {
                        intentVotes[primaryIntent] = 0;
                    }
                    intentVotes[primaryIntent] += confidence * weight;
                }
                
                // Collect context factors
                if (result.context) {
                    Object.assign(contextFactors, result.context);
                }
                
                totalConfidence += confidence * weight;
                totalWeight += weight;
            }
        }
        
        // Determine primary intent
        const sortedIntents = Object.entries(intentVotes)
            .sort(([,a], [,b]) => b - a);
        
        const primaryIntent = sortedIntents[0]?.[0] || 'general';
        const secondaryIntent = sortedIntents[1]?.[0] || null;
        const tertiaryIntent = sortedIntents[2]?.[0] || null;
        
        // Calculate final confidence
        const finalConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;
        
        // Create comprehensive result
        return {
            primary_intent: primaryIntent,
            secondary_intent: secondaryIntent,
            tertiary_intent: tertiaryIntent,
            confidence: finalConfidence,
            context: this.mergeContextFactors(contextFactors),
            workflow_analysis: workflowAnalysis,
            classification_details: {
                method: 'enhanced_ensemble',
                timestamp: new Date().toISOString(),
                classifiers_used: validResults.map(r => r.method),
                errors: errors.map(e => ({ method: e.method, error: e.error.message })),
                intent_votes: intentVotes,
                weights_used: this.methodWeights
            },
            recommendations: this.generateRecommendations(primaryIntent, contextFactors, workflowAnalysis),
            expressiveness_score: this.calculateExpressivenessScore(primaryIntent, secondaryIntent, tertiaryIntent, contextFactors)
        };
    }

    /**
     * Merge context factors from different classifiers
     */
    mergeContextFactors(contextFactors) {
        const merged = {
            domain: null,
            expertise: null,
            complexity: null,
            phase: null,
            temporal: null,
            technical: null
        };
        
        // Merge domain information
        if (contextFactors.domain) {
            merged.domain = typeof contextFactors.domain === 'string' 
                ? { domain: contextFactors.domain, confidence: 0.8 }
                : contextFactors.domain;
        }
        
        // Merge expertise information
        if (contextFactors.expertise) {
            merged.expertise = typeof contextFactors.expertise === 'string'
                ? { level: contextFactors.expertise, confidence: 0.8 }
                : contextFactors.expertise;
        }
        
        // Merge complexity information
        if (contextFactors.complexity) {
            merged.complexity = typeof contextFactors.complexity === 'string'
                ? { level: contextFactors.complexity, confidence: 0.8 }
                : contextFactors.complexity;
        }
        
        // Merge phase information
        if (contextFactors.phase) {
            merged.phase = typeof contextFactors.phase === 'string'
                ? { phase: contextFactors.phase, confidence: 0.8 }
                : contextFactors.phase;
        }
        
        // Merge temporal information
        if (contextFactors.temporal) {
            merged.temporal = contextFactors.temporal;
        }
        
        // Merge technical information
        if (contextFactors.technical) {
            merged.technical = contextFactors.technical;
        }
        
        return merged;
    }

    /**
     * Generate recommendations based on classification
     */
    generateRecommendations(primaryIntent, contextFactors, workflowAnalysis) {
        const recommendations = [];
        
        // Workflow-based recommendations
        if (workflowAnalysis && workflowAnalysis.recommendations) {
            recommendations.push(...workflowAnalysis.recommendations);
        }
        
        // Context-based recommendations
        if (contextFactors.expertise && contextFactors.expertise.level === 'beginner') {
            recommendations.push({
                type: 'learning',
                message: 'Consider following tutorials or examples for this type of work',
                priority: 'medium'
            });
        }
        
        if (contextFactors.complexity && contextFactors.complexity.level === 'complex') {
            recommendations.push({
                type: 'complexity',
                message: 'This is a complex task - consider breaking it into smaller steps',
                priority: 'high'
            });
        }
        
        // Intent-specific recommendations
        const intentRecommendations = {
            'data_exploration': [{
                type: 'workflow',
                message: 'Consider starting with data profiling and basic statistics',
                priority: 'low'
            }],
            'implementation': [{
                type: 'workflow',
                message: 'Remember to write tests as you implement',
                priority: 'medium'
            }],
            'debugging': [{
                type: 'workflow',
                message: 'Use systematic debugging approaches and logging',
                priority: 'high'
            }]
        };
        
        if (intentRecommendations[primaryIntent]) {
            recommendations.push(...intentRecommendations[primaryIntent]);
        }
        
        return recommendations;
    }

    /**
     * Calculate expressiveness score
     */
    calculateExpressivenessScore(primary, secondary, tertiary, context) {
        let score = 0;
        
        // Base score for having primary intent
        score += 0.3;
        
        // Bonus for secondary intent
        if (secondary) score += 0.2;
        
        // Bonus for tertiary intent
        if (tertiary) score += 0.1;
        
        // Bonus for context information
        if (context.domain) score += 0.1;
        if (context.expertise) score += 0.1;
        if (context.complexity) score += 0.1;
        if (context.phase) score += 0.1;
        
        return Math.min(score, 1.0);
    }

    /**
     * Store classification history
     */
    storeClassificationHistory(sessionId, result) {
        this.classificationHistory.push({
            sessionId,
            timestamp: new Date().toISOString(),
            result
        });
        
        // Keep only last 1000 classifications
        if (this.classificationHistory.length > 1000) {
            this.classificationHistory.splice(0, this.classificationHistory.length - 1000);
        }
    }

    /**
     * Update user profile
     */
    updateUserProfile(session, result) {
        const userId = session.userId || 'anonymous';
        
        if (!this.userProfiles.has(userId)) {
            this.userProfiles.set(userId, {
                intentPreferences: {},
                contextPatterns: {},
                workflowPatterns: [],
                lastUpdated: new Date().toISOString()
            });
        }
        
        const profile = this.userProfiles.get(userId);
        
        // Update intent preferences
        const primary = result.primary_intent;
        if (!profile.intentPreferences[primary]) {
            profile.intentPreferences[primary] = 0;
        }
        profile.intentPreferences[primary]++;
        
        // Update context patterns
        if (result.context) {
            Object.assign(profile.contextPatterns, result.context);
        }
        
        // Update workflow patterns
        if (result.workflow_analysis) {
            profile.workflowPatterns.push(result.workflow_analysis);
            
            // Keep only last 50 workflow patterns
            if (profile.workflowPatterns.length > 50) {
                profile.workflowPatterns.splice(0, profile.workflowPatterns.length - 50);
            }
        }
        
        profile.lastUpdated = new Date().toISOString();
    }

    /**
     * Get fallback classification
     */
    getFallbackClassification(session, conversations) {
        return {
            primary_intent: 'general',
            secondary_intent: null,
            tertiary_intent: null,
            confidence: 0.1,
            context: {},
            workflow_analysis: null,
            classification_details: {
                method: 'fallback',
                timestamp: new Date().toISOString(),
                classifiers_used: [],
                errors: ['All classifiers failed'],
                intent_votes: {},
                weights_used: {}
            },
            recommendations: [{
                type: 'system',
                message: 'Classification system encountered errors - using fallback',
                priority: 'high'
            }],
            expressiveness_score: 0.1
        };
    }

    /**
     * Get user profile
     */
    getUserProfile(userId) {
        return this.userProfiles.get(userId) || null;
    }

    /**
     * Get classification statistics
     */
    getClassificationStats() {
        const stats = {
            total_classifications: this.classificationHistory.length,
            unique_users: this.userProfiles.size,
            method_usage: {},
            intent_distribution: {},
            average_confidence: 0,
            average_expressiveness: 0
        };
        
        let totalConfidence = 0;
        let totalExpressiveness = 0;
        
        this.classificationHistory.forEach(entry => {
            const result = entry.result;
            
            // Method usage
            const method = result.classification_details?.method || 'unknown';
            stats.method_usage[method] = (stats.method_usage[method] || 0) + 1;
            
            // Intent distribution
            const intent = result.primary_intent;
            stats.intent_distribution[intent] = (stats.intent_distribution[intent] || 0) + 1;
            
            // Confidence and expressiveness
            totalConfidence += result.confidence || 0;
            totalExpressiveness += result.expressiveness_score || 0;
        });
        
        if (this.classificationHistory.length > 0) {
            stats.average_confidence = totalConfidence / this.classificationHistory.length;
            stats.average_expressiveness = totalExpressiveness / this.classificationHistory.length;
        }
        
        return stats;
    }
}

module.exports = IntentClassificationService;
