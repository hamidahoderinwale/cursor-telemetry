/**
 * Enhanced Intent Classification System
 * Combines multiple signals for more accurate intent detection
 */

class EnhancedIntentClassifier {
    constructor() {
        this.weights = {
            conversation: 0.4,    // User messages and AI responses
            codeContent: 0.3,     // Code changes and structure
            fileContext: 0.15,    // File types and project context
            temporal: 0.1,        // Time patterns and session flow
            behavioral: 0.05      // User behavior patterns
        };
        
        this.intentCategories = {
            'data_exploration': {
                name: 'Data Exploration',
                synonyms: ['explore', 'analyze', 'investigate', 'examine', 'eda'],
                codePatterns: ['pd.read_', 'df.head', 'df.describe', 'plt.', 'sns.'],
                fileTypes: ['.ipynb', '.py'],
                conversationPatterns: ['show me', 'what does', 'explore', 'analyze data']
            },
            'implementation': {
                name: 'Implementation',
                synonyms: ['implement', 'build', 'create', 'develop', 'code'],
                codePatterns: ['def ', 'class ', 'import ', 'from ', 'function'],
                fileTypes: ['.py', '.js', '.ts', '.java'],
                conversationPatterns: ['implement', 'build', 'create a', 'write code']
            },
            'debugging': {
                name: 'Debugging',
                synonyms: ['debug', 'fix', 'error', 'bug', 'troubleshoot'],
                codePatterns: ['print(', 'debugger', 'try:', 'except:', 'raise'],
                fileTypes: ['.py', '.js', '.ts'],
                conversationPatterns: ['error', 'not working', 'fix this', 'debug']
            },
            'refactoring': {
                name: 'Refactoring',
                synonyms: ['refactor', 'optimize', 'improve', 'clean', 'restructure'],
                codePatterns: ['# TODO:', '# FIXME:', 'refactor', 'optimize'],
                fileTypes: ['.py', '.js', '.ts', '.java'],
                conversationPatterns: ['refactor', 'optimize', 'improve', 'clean up']
            },
            'testing': {
                name: 'Testing',
                synonyms: ['test', 'validate', 'verify', 'check'],
                codePatterns: ['test_', 'assert', 'pytest', 'unittest', 'mock'],
                fileTypes: ['.py', '.js', '.ts'],
                conversationPatterns: ['test', 'validate', 'check if', 'verify']
            },
            'documentation': {
                name: 'Documentation',
                synonyms: ['document', 'explain', 'comment', 'describe'],
                codePatterns: ['"""', "'''", '# ', 'docstring', 'markdown'],
                fileTypes: ['.md', '.rst', '.py', '.js'],
                conversationPatterns: ['explain', 'document', 'comment', 'describe']
            }
        };
    }

    /**
     * Enhanced intent classification with multiple signals
     */
    async classifyIntent(session, conversations = []) {
        const signals = {
            conversation: this.analyzeConversationSignals(conversations),
            codeContent: this.analyzeCodeSignals(session),
            fileContext: this.analyzeFileContext(session),
            temporal: this.analyzeTemporalSignals(session),
            behavioral: this.analyzeBehavioralSignals(session)
        };

        // Calculate weighted scores for each intent
        const intentScores = {};
        for (const [intent, config] of Object.entries(this.intentCategories)) {
            intentScores[intent] = 0;
            
            for (const [signalType, weight] of Object.entries(this.weights)) {
                const signalScore = signals[signalType][intent] || 0;
                intentScores[intent] += signalScore * weight;
            }
        }

        // Find primary intent
        const primaryIntent = Object.entries(intentScores)
            .sort(([,a], [,b]) => b - a)[0];

        return {
            primary_intent: primaryIntent[0],
            confidence: primaryIntent[1],
            scores: intentScores,
            signals: signals,
            analysis: {
                method: 'enhanced_multi_signal',
                timestamp: new Date().toISOString(),
                weights: this.weights
            }
        };
    }

    /**
     * Analyze conversation signals
     */
    analyzeConversationSignals(conversations) {
        const signals = {};
        const allText = conversations.map(c => 
            (c.userMessage || '') + ' ' + (c.assistantResponse || '')
        ).join(' ').toLowerCase();

        for (const [intent, config] of Object.entries(this.intentCategories)) {
            let score = 0;
            
            // Check synonyms
            score += config.synonyms.reduce((acc, synonym) => 
                acc + (allText.includes(synonym) ? 1 : 0), 0) * 0.3;
            
            // Check conversation patterns
            score += config.conversationPatterns.reduce((acc, pattern) => 
                acc + (allText.includes(pattern) ? 1 : 0), 0) * 0.4;
            
            // Check for question patterns
            if (intent === 'data_exploration' && this.hasQuestionPattern(allText)) {
                score += 0.3;
            }
            
            signals[intent] = Math.min(score, 1.0);
        }

        return signals;
    }

    /**
     * Analyze code content signals
     */
    analyzeCodeSignals(session) {
        const signals = {};
        const codeContent = session.codeDeltas ? 
            session.codeDeltas.map(d => d.afterContent).join('\n') : '';

        for (const [intent, config] of Object.entries(this.intentCategories)) {
            let score = 0;
            
            // Check code patterns
            score += config.codePatterns.reduce((acc, pattern) => 
                acc + (codeContent.includes(pattern) ? 1 : 0), 0) * 0.4;
            
            // Check for specific imports
            if (intent === 'data_exploration' && this.hasDataScienceImports(codeContent)) {
                score += 0.3;
            }
            
            // Check for function definitions
            if (intent === 'implementation' && this.hasFunctionDefinitions(codeContent)) {
                score += 0.3;
            }
            
            signals[intent] = Math.min(score, 1.0);
        }

        return signals;
    }

    /**
     * Analyze file context signals
     */
    analyzeFileContext(session) {
        const signals = {};
        const fileName = session.currentFile || '';
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

        for (const [intent, config] of Object.entries(this.intentCategories)) {
            let score = 0;
            
            // Check file types
            if (config.fileTypes.includes(`.${fileExt}`)) {
                score += 0.5;
            }
            
            // Check file name patterns
            if (intent === 'testing' && fileName.includes('test')) {
                score += 0.3;
            }
            
            if (intent === 'documentation' && fileName.includes('readme')) {
                score += 0.3;
            }
            
            signals[intent] = Math.min(score, 1.0);
        }

        return signals;
    }

    /**
     * Analyze temporal signals
     */
    analyzeTemporalSignals(session) {
        const signals = {};
        
        // Session duration patterns
        const duration = session.duration || 0;
        
        // Short sessions might be debugging
        if (duration < 300) { // 5 minutes
            signals.debugging = 0.3;
        }
        
        // Long sessions might be implementation
        if (duration > 1800) { // 30 minutes
            signals.implementation = 0.3;
        }
        
        // Check for rapid changes (debugging pattern)
        if (session.codeDeltas && session.codeDeltas.length > 10) {
            signals.debugging = (signals.debugging || 0) + 0.2;
        }
        
        return signals;
    }

    /**
     * Analyze behavioral signals
     */
    analyzeBehavioralSignals(session) {
        const signals = {};
        
        // Check for error patterns
        if (session.outcome === 'failed' || session.outcome === 'error') {
            signals.debugging = 0.4;
        }
        
        // Check for success patterns
        if (session.outcome === 'success' || session.outcome === 'completed') {
            signals.implementation = 0.2;
        }
        
        // Check for high conversation count (might be exploration)
        if (session.conversations && session.conversations.length > 5) {
            signals.data_exploration = 0.2;
        }
        
        return signals;
    }

    /**
     * Helper methods
     */
    hasQuestionPattern(text) {
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'];
        return questionWords.some(word => text.includes(word));
    }

    hasDataScienceImports(code) {
        const dataScienceImports = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'sklearn'];
        return dataScienceImports.some(imp => code.includes(imp));
    }

    hasFunctionDefinitions(code) {
        return code.includes('def ') || code.includes('function ') || code.includes('class ');
    }
}

module.exports = EnhancedIntentClassifier;
