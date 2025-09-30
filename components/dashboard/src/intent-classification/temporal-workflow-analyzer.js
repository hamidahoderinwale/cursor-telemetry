/**
 * Temporal Workflow Analysis System
 * Tracks intent evolution and workflow patterns over time
 */

class TemporalWorkflowAnalyzer {
    constructor() {
        this.workflowPatterns = this.initializeWorkflowPatterns();
        this.sessionHistory = new Map();
        this.userPatterns = new Map();
        this.workflowTransitions = new Map();
    }

    /**
     * Initialize common workflow patterns
     */
    initializeWorkflowPatterns() {
        return {
            'data_science_workflow': {
                name: 'Data Science Workflow',
                pattern: ['data_exploration', 'data_preprocessing', 'feature_engineering', 'model_training', 'evaluation', 'visualization'],
                description: 'Standard data science pipeline from exploration to visualization',
                frequency: 0.8,
                success_rate: 0.85
            },
            'exploratory_workflow': {
                name: 'Exploratory Workflow',
                pattern: ['data_exploration', 'visualization', 'analysis', 'insights'],
                description: 'Exploratory analysis focused on understanding data',
                frequency: 0.6,
                success_rate: 0.9
            },
            'implementation_workflow': {
                name: 'Implementation Workflow',
                pattern: ['planning', 'implementation', 'testing', 'debugging', 'optimization'],
                description: 'Software development lifecycle',
                frequency: 0.7,
                success_rate: 0.75
            },
            'debugging_workflow': {
                name: 'Debugging Workflow',
                pattern: ['error_analysis', 'debugging', 'testing', 'fix_verification'],
                description: 'Problem-solving and debugging process',
                frequency: 0.5,
                success_rate: 0.8
            },
            'research_workflow': {
                name: 'Research Workflow',
                pattern: ['research', 'experimentation', 'analysis', 'documentation'],
                description: 'Research and experimentation process',
                frequency: 0.4,
                success_rate: 0.7
            }
        };
    }

    /**
     * Analyze workflow progression for a session
     */
    analyzeWorkflowProgression(session, conversations = []) {
        const sessionId = session.id;
        const currentIntent = this.extractCurrentIntent(session, conversations);
        const sessionHistory = this.getSessionHistory(sessionId);
        const userPatterns = this.getUserPatterns(session.userId || 'anonymous');
        
        const analysis = {
            current_intent: currentIntent,
            workflow_type: this.identifyWorkflowType(sessionHistory, currentIntent),
            progression_pattern: this.analyzeProgressionPattern(sessionHistory),
            current_phase: this.determineCurrentPhase(sessionHistory, currentIntent),
            next_likely_intent: this.predictNextIntent(sessionHistory, currentIntent, userPatterns),
            workflow_complexity: this.assessWorkflowComplexity(sessionHistory),
            learning_indicators: this.identifyLearningIndicators(session, conversations),
            efficiency_metrics: this.calculateEfficiencyMetrics(sessionHistory),
            recommendations: this.generateRecommendations(sessionHistory, currentIntent, userPatterns)
        };

        // Update session history
        this.updateSessionHistory(sessionId, currentIntent, analysis);
        
        // Update user patterns
        this.updateUserPatterns(session.userId || 'anonymous', currentIntent, analysis);

        return analysis;
    }

    /**
     * Extract current intent from session
     */
    extractCurrentIntent(session, conversations) {
        // This would integrate with the intent classification systems
        const content = this.extractAllText(session, conversations);
        
        if (content.includes('explore') || content.includes('analyze')) {
            return 'data_exploration';
        }
        if (content.includes('implement') || content.includes('build')) {
            return 'implementation';
        }
        if (content.includes('debug') || content.includes('fix')) {
            return 'debugging';
        }
        if (content.includes('test') || content.includes('validate')) {
            return 'testing';
        }
        if (content.includes('visualize') || content.includes('plot')) {
            return 'visualization';
        }
        
        return 'general';
    }

    /**
     * Identify workflow type based on session history
     */
    identifyWorkflowType(sessionHistory, currentIntent) {
        if (!sessionHistory || sessionHistory.length === 0) {
            return 'unknown';
        }

        const intentSequence = sessionHistory.map(entry => entry.intent);
        let bestMatch = null;
        let bestScore = 0;

        for (const [workflowKey, workflow] of Object.entries(this.workflowPatterns)) {
            const score = this.calculateWorkflowMatch(intentSequence, workflow.pattern);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = workflowKey;
            }
        }

        return bestMatch || 'custom_workflow';
    }

    /**
     * Analyze progression pattern
     */
    analyzeProgressionPattern(sessionHistory) {
        if (!sessionHistory || sessionHistory.length < 2) {
            return 'initial';
        }

        const intents = sessionHistory.map(entry => entry.intent);
        const transitions = this.analyzeTransitions(intents);
        
        return {
            sequence: intents,
            transitions: transitions,
            pattern_type: this.classifyPatternType(transitions),
            progression_quality: this.assessProgressionQuality(transitions)
        };
    }

    /**
     * Determine current phase in workflow
     */
    determineCurrentPhase(sessionHistory, currentIntent) {
        if (!sessionHistory || sessionHistory.length === 0) {
            return 'initialization';
        }

        const workflowType = this.identifyWorkflowType(sessionHistory, currentIntent);
        const workflow = this.workflowPatterns[workflowType];
        
        if (!workflow) {
            return 'development';
        }

        const currentIndex = workflow.pattern.indexOf(currentIntent);
        const totalPhases = workflow.pattern.length;
        
        if (currentIndex === -1) {
            return 'custom_phase';
        }

        const progress = (currentIndex + 1) / totalPhases;
        
        if (progress < 0.25) return 'initialization';
        if (progress < 0.5) return 'early_development';
        if (progress < 0.75) return 'development';
        if (progress < 1.0) return 'finalization';
        return 'completion';
    }

    /**
     * Predict next likely intent
     */
    predictNextIntent(sessionHistory, currentIntent, userPatterns) {
        const transitions = this.analyzeTransitions(sessionHistory.map(entry => entry.intent));
        const userTransitions = this.getUserTransitions(userPatterns);
        
        // Combine global and user-specific patterns
        const allTransitions = { ...transitions, ...userTransitions };
        
        const currentTransitions = allTransitions[currentIntent] || {};
        const sortedTransitions = Object.entries(currentTransitions)
            .sort(([,a], [,b]) => b - a);
        
        return sortedTransitions.length > 0 ? sortedTransitions[0][0] : null;
    }

    /**
     * Assess workflow complexity
     */
    assessWorkflowComplexity(sessionHistory) {
        if (!sessionHistory || sessionHistory.length === 0) {
            return 'simple';
        }

        const uniqueIntents = new Set(sessionHistory.map(entry => entry.intent));
        const intentCount = uniqueIntents.size;
        const sessionLength = sessionHistory.length;
        
        // Calculate complexity based on intent diversity and session length
        const diversity = intentCount / sessionLength;
        const length = sessionLength;
        
        let complexity = 0;
        complexity += diversity * 0.5; // Intent diversity
        complexity += Math.min(length / 20, 1) * 0.5; // Session length
        
        if (complexity < 0.3) return 'simple';
        if (complexity < 0.6) return 'moderate';
        return 'complex';
    }

    /**
     * Identify learning indicators
     */
    identifyLearningIndicators(session, conversations) {
        const indicators = [];
        const content = this.extractAllText(session, conversations);
        
        // Check for learning-related patterns
        if (content.includes('learn') || content.includes('understand') || content.includes('figure out')) {
            indicators.push('active_learning');
        }
        
        if (content.includes('tutorial') || content.includes('example') || content.includes('guide')) {
            indicators.push('tutorial_following');
        }
        
        if (content.includes('experiment') || content.includes('try') || content.includes('test')) {
            indicators.push('experimentation');
        }
        
        if (content.includes('documentation') || content.includes('read') || content.includes('research')) {
            indicators.push('research_activity');
        }
        
        // Check for new library usage
        const newLibraries = this.detectNewLibraries(session);
        if (newLibraries.length > 0) {
            indicators.push('new_library_adoption');
        }
        
        // Check for advanced patterns
        const advancedPatterns = this.detectAdvancedPatterns(content);
        if (advancedPatterns.length > 0) {
            indicators.push('advanced_pattern_usage');
        }
        
        return indicators;
    }

    /**
     * Calculate efficiency metrics
     */
    calculateEfficiencyMetrics(sessionHistory) {
        if (!sessionHistory || sessionHistory.length === 0) {
            return { efficiency: 0, productivity: 0, focus: 0 };
        }

        const totalTime = this.calculateTotalTime(sessionHistory);
        const productiveTime = this.calculateProductiveTime(sessionHistory);
        const focusTime = this.calculateFocusTime(sessionHistory);
        
        return {
            efficiency: productiveTime / totalTime,
            productivity: this.calculateProductivityScore(sessionHistory),
            focus: focusTime / totalTime,
            session_duration: totalTime,
            productive_duration: productiveTime
        };
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(sessionHistory, currentIntent, userPatterns) {
        const recommendations = [];
        
        // Workflow optimization recommendations
        const workflowType = this.identifyWorkflowType(sessionHistory, currentIntent);
        const workflow = this.workflowPatterns[workflowType];
        
        if (workflow && workflow.success_rate < 0.8) {
            recommendations.push({
                type: 'workflow_optimization',
                message: `Consider following the ${workflow.name} more closely for better results`,
                priority: 'medium'
            });
        }
        
        // Next step recommendations
        const nextIntent = this.predictNextIntent(sessionHistory, currentIntent, userPatterns);
        if (nextIntent) {
            recommendations.push({
                type: 'next_step',
                message: `Based on your workflow pattern, consider moving to ${nextIntent}`,
                priority: 'high'
            });
        }
        
        // Learning recommendations
        const learningIndicators = this.identifyLearningIndicators({}, []);
        if (learningIndicators.includes('active_learning')) {
            recommendations.push({
                type: 'learning',
                message: 'Great learning activity! Consider documenting your insights',
                priority: 'low'
            });
        }
        
        return recommendations;
    }

    /**
     * Calculate workflow match score
     */
    calculateWorkflowMatch(intentSequence, workflowPattern) {
        let matches = 0;
        let totalChecks = Math.min(intentSequence.length, workflowPattern.length);
        
        for (let i = 0; i < totalChecks; i++) {
            if (intentSequence[i] === workflowPattern[i]) {
                matches++;
            }
        }
        
        return totalChecks > 0 ? matches / totalChecks : 0;
    }

    /**
     * Analyze intent transitions
     */
    analyzeTransitions(intents) {
        const transitions = {};
        
        for (let i = 0; i < intents.length - 1; i++) {
            const from = intents[i];
            const to = intents[i + 1];
            
            if (!transitions[from]) {
                transitions[from] = {};
            }
            
            if (!transitions[from][to]) {
                transitions[from][to] = 0;
            }
            
            transitions[from][to]++;
        }
        
        // Normalize to probabilities
        for (const from in transitions) {
            const total = Object.values(transitions[from]).reduce((sum, count) => sum + count, 0);
            for (const to in transitions[from]) {
                transitions[from][to] = transitions[from][to] / total;
            }
        }
        
        return transitions;
    }

    /**
     * Classify pattern type
     */
    classifyPatternType(transitions) {
        const transitionCount = Object.keys(transitions).length;
        const avgTransitions = Object.values(transitions)
            .reduce((sum, toTransitions) => sum + Object.keys(toTransitions).length, 0) / transitionCount;
        
        if (avgTransitions < 1.5) return 'linear';
        if (avgTransitions < 3) return 'moderate_branching';
        return 'highly_branching';
    }

    /**
     * Assess progression quality
     */
    assessProgressionQuality(transitions) {
        // Analyze if transitions make logical sense
        const logicalTransitions = {
            'data_exploration': ['data_preprocessing', 'feature_engineering', 'visualization'],
            'implementation': ['testing', 'debugging', 'optimization'],
            'debugging': ['testing', 'implementation'],
            'testing': ['implementation', 'debugging']
        };
        
        let logicalScore = 0;
        let totalTransitions = 0;
        
        for (const [from, toTransitions] of Object.entries(transitions)) {
            const logicalTargets = logicalTransitions[from] || [];
            for (const [to, probability] of Object.entries(toTransitions)) {
                totalTransitions++;
                if (logicalTargets.includes(to)) {
                    logicalScore += probability;
                }
            }
        }
        
        return totalTransitions > 0 ? logicalScore / totalTransitions : 0;
    }

    /**
     * Get user-specific transitions
     */
    getUserTransitions(userPatterns) {
        if (!userPatterns || !userPatterns.transitions) {
            return {};
        }
        return userPatterns.transitions;
    }

    /**
     * Detect new libraries
     */
    detectNewLibraries(session) {
        const newLibraries = [];
        
        if (session.codeDeltas) {
            session.codeDeltas.forEach(delta => {
                const content = delta.content || delta.afterContent || '';
                const imports = content.match(/import\s+([a-zA-Z_][a-zA-Z0-9_]*)/g) || [];
                
                imports.forEach(imp => {
                    const library = imp.replace('import ', '');
                    if (!this.isKnownLibrary(library)) {
                        newLibraries.push(library);
                    }
                });
            });
        }
        
        return newLibraries;
    }

    /**
     * Detect advanced patterns
     */
    detectAdvancedPatterns(content) {
        const advancedPatterns = [];
        
        if (content.includes('async') || content.includes('await')) {
            advancedPatterns.push('async_programming');
        }
        if (content.includes('decorator') || content.includes('@')) {
            advancedPatterns.push('decorators');
        }
        if (content.includes('metaclass') || content.includes('__new__')) {
            advancedPatterns.push('metaclasses');
        }
        if (content.includes('generator') || content.includes('yield')) {
            advancedPatterns.push('generators');
        }
        
        return advancedPatterns;
    }

    /**
     * Calculate total session time
     */
    calculateTotalTime(sessionHistory) {
        if (sessionHistory.length === 0) return 0;
        
        const firstEntry = sessionHistory[0];
        const lastEntry = sessionHistory[sessionHistory.length - 1];
        
        return new Date(lastEntry.timestamp) - new Date(firstEntry.timestamp);
    }

    /**
     * Calculate productive time
     */
    calculateProductiveTime(sessionHistory) {
        const productiveIntents = ['implementation', 'data_exploration', 'feature_engineering', 'model_training'];
        let productiveTime = 0;
        
        for (let i = 0; i < sessionHistory.length - 1; i++) {
            const current = sessionHistory[i];
            const next = sessionHistory[i + 1];
            
            if (productiveIntents.includes(current.intent)) {
                productiveTime += new Date(next.timestamp) - new Date(current.timestamp);
            }
        }
        
        return productiveTime;
    }

    /**
     * Calculate focus time
     */
    calculateFocusTime(sessionHistory) {
        // Focus time is when user stays on the same intent for extended periods
        let focusTime = 0;
        let currentIntent = null;
        let intentStartTime = null;
        
        for (const entry of sessionHistory) {
            if (entry.intent !== currentIntent) {
                if (currentIntent && intentStartTime) {
                    const duration = new Date(entry.timestamp) - intentStartTime;
                    if (duration > 300000) { // 5 minutes
                        focusTime += duration;
                    }
                }
                currentIntent = entry.intent;
                intentStartTime = new Date(entry.timestamp);
            }
        }
        
        return focusTime;
    }

    /**
     * Calculate productivity score
     */
    calculateProductivityScore(sessionHistory) {
        const productiveIntents = ['implementation', 'data_exploration', 'feature_engineering'];
        const unproductiveIntents = ['debugging', 'error_analysis'];
        
        let productiveCount = 0;
        let unproductiveCount = 0;
        
        sessionHistory.forEach(entry => {
            if (productiveIntents.includes(entry.intent)) {
                productiveCount++;
            } else if (unproductiveIntents.includes(entry.intent)) {
                unproductiveCount++;
            }
        });
        
        const total = productiveCount + unproductiveCount;
        return total > 0 ? productiveCount / total : 0;
    }

    /**
     * Update session history
     */
    updateSessionHistory(sessionId, intent, analysis) {
        if (!this.sessionHistory.has(sessionId)) {
            this.sessionHistory.set(sessionId, []);
        }
        
        const history = this.sessionHistory.get(sessionId);
        history.push({
            intent,
            timestamp: new Date().toISOString(),
            analysis
        });
        
        // Keep only last 100 entries
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
    }

    /**
     * Update user patterns
     */
    updateUserPatterns(userId, intent, analysis) {
        if (!this.userPatterns.has(userId)) {
            this.userPatterns.set(userId, {
                transitions: {},
                preferences: {},
                patterns: []
            });
        }
        
        const userPattern = this.userPatterns.get(userId);
        
        // Update transitions
        if (userPattern.patterns.length > 0) {
            const lastIntent = userPattern.patterns[userPattern.patterns.length - 1].intent;
            
            if (!userPattern.transitions[lastIntent]) {
                userPattern.transitions[lastIntent] = {};
            }
            
            if (!userPattern.transitions[lastIntent][intent]) {
                userPattern.transitions[lastIntent][intent] = 0;
            }
            
            userPattern.transitions[lastIntent][intent]++;
        }
        
        // Update patterns
        userPattern.patterns.push({
            intent,
            timestamp: new Date().toISOString(),
            analysis
        });
        
        // Keep only last 50 entries
        if (userPattern.patterns.length > 50) {
            userPattern.patterns.splice(0, userPattern.patterns.length - 50);
        }
    }

    /**
     * Get session history
     */
    getSessionHistory(sessionId) {
        return this.sessionHistory.get(sessionId) || [];
    }

    /**
     * Get user patterns
     */
    getUserPatterns(userId) {
        return this.userPatterns.get(userId) || {};
    }

    /**
     * Extract all text from session
     */
    extractAllText(session, conversations = []) {
        let text = '';
        
        if (conversations) {
            text += conversations.map(c => c.content || c.prompt || c.response || '').join(' ');
        }
        
        if (session.codeDeltas) {
            text += session.codeDeltas.map(d => d.content || d.afterContent || '').join(' ');
        }
        
        return text;
    }

    /**
     * Check if library is known
     */
    isKnownLibrary(library) {
        const knownLibraries = [
            'pandas', 'numpy', 'matplotlib', 'seaborn', 'sklearn',
            'tensorflow', 'pytorch', 'requests', 'flask', 'django'
        ];
        return knownLibraries.includes(library);
    }
}

module.exports = TemporalWorkflowAnalyzer;
