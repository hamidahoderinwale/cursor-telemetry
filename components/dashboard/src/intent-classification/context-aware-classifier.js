/**
 * Context-Aware Intent Classification System
 * Provides domain-specific and user-aware intent classification
 */

class ContextAwareClassifier {
    constructor() {
        this.domainPatterns = this.initializeDomainPatterns();
        this.expertiseLevels = this.initializeExpertiseLevels();
        this.projectPhases = this.initializeProjectPhases();
        this.contextWeights = {
            domain: 0.3,
            expertise: 0.25,
            phase: 0.2,
            temporal: 0.15,
            behavioral: 0.1
        };
    }

    /**
     * Initialize domain-specific patterns
     */
    initializeDomainPatterns() {
        return {
            'data_science': {
                name: 'Data Science',
                indicators: {
                    filePatterns: ['*.ipynb', '*.py', 'data/*', 'notebooks/*'],
                    keywords: ['pandas', 'numpy', 'matplotlib', 'seaborn', 'sklearn', 'jupyter'],
                    projectStructure: ['requirements.txt', 'environment.yml', 'data/', 'notebooks/'],
                    commonIntents: ['data_exploration', 'feature_engineering', 'model_training', 'visualization']
                },
                intentModifiers: {
                    'data_exploration': {
                        complexity: {
                            'beginner': ['basic_eda', 'data_profiling'],
                            'intermediate': ['statistical_analysis', 'correlation_analysis'],
                            'advanced': ['advanced_eda', 'multivariate_analysis']
                        }
                    },
                    'machine_learning': {
                        complexity: {
                            'beginner': ['simple_models', 'basic_training'],
                            'intermediate': ['model_selection', 'hyperparameter_tuning'],
                            'advanced': ['ensemble_methods', 'deep_learning', 'custom_architectures']
                        }
                    }
                }
            },
            'web_development': {
                name: 'Web Development',
                indicators: {
                    filePatterns: ['*.html', '*.css', '*.js', '*.ts', '*.jsx', '*.tsx'],
                    keywords: ['react', 'vue', 'angular', 'express', 'flask', 'django', 'api'],
                    projectStructure: ['package.json', 'src/', 'public/', 'components/'],
                    commonIntents: ['frontend_development', 'backend_development', 'api_development', 'testing']
                },
                intentModifiers: {
                    'frontend_development': {
                        complexity: {
                            'beginner': ['basic_components', 'simple_ui'],
                            'intermediate': ['state_management', 'routing'],
                            'advanced': ['performance_optimization', 'advanced_patterns']
                        }
                    }
                }
            },
            'machine_learning': {
                name: 'Machine Learning',
                indicators: {
                    filePatterns: ['*.py', 'models/*', 'experiments/*'],
                    keywords: ['tensorflow', 'pytorch', 'keras', 'xgboost', 'lightgbm', 'model'],
                    projectStructure: ['models/', 'experiments/', 'data/', 'configs/'],
                    commonIntents: ['model_development', 'experiment_tracking', 'model_deployment']
                }
            },
            'devops': {
                name: 'DevOps',
                indicators: {
                    filePatterns: ['Dockerfile', '*.yml', '*.yaml', '*.sh'],
                    keywords: ['docker', 'kubernetes', 'ci/cd', 'deployment', 'infrastructure'],
                    projectStructure: ['.github/', 'docker/', 'k8s/', 'scripts/'],
                    commonIntents: ['deployment', 'infrastructure', 'automation', 'monitoring']
                }
            }
        };
    }

    /**
     * Initialize expertise level patterns
     */
    initializeExpertiseLevels() {
        return {
            'beginner': {
                indicators: {
                    codePatterns: ['print(', 'input(', 'basic loops', 'simple functions'],
                    keywords: ['help', 'how to', 'tutorial', 'example', 'simple'],
                    complexity: 'low',
                    patterns: ['copy-paste', 'tutorial-following', 'basic-syntax']
                },
                intentModifiers: {
                    'data_exploration': ['basic_eda', 'simple_visualization'],
                    'implementation': ['basic_functions', 'simple_scripts'],
                    'debugging': ['syntax_errors', 'basic_troubleshooting']
                }
            },
            'intermediate': {
                indicators: {
                    codePatterns: ['list comprehensions', 'decorators', 'classes', 'error handling'],
                    keywords: ['optimize', 'refactor', 'best practices', 'patterns'],
                    complexity: 'medium',
                    patterns: ['modular-code', 'error-handling', 'testing']
                },
                intentModifiers: {
                    'data_exploration': ['statistical_analysis', 'feature_engineering'],
                    'implementation': ['design_patterns', 'architecture'],
                    'debugging': ['performance_issues', 'complex_bugs']
                }
            },
            'advanced': {
                indicators: {
                    codePatterns: ['async/await', 'metaclasses', 'generators', 'context managers'],
                    keywords: ['architecture', 'scalability', 'performance', 'optimization'],
                    complexity: 'high',
                    patterns: ['advanced-patterns', 'performance-optimization', 'architecture-design']
                },
                intentModifiers: {
                    'data_exploration': ['advanced_analytics', 'custom_visualizations'],
                    'implementation': ['system_design', 'performance_optimization'],
                    'debugging': ['system_level', 'performance_profiling']
                }
            }
        };
    }

    /**
     * Initialize project phase patterns
     */
    initializeProjectPhases() {
        return {
            'initialization': {
                indicators: {
                    keywords: ['setup', 'install', 'initialize', 'create', 'new project'],
                    filePatterns: ['requirements.txt', 'package.json', 'setup.py', 'Dockerfile'],
                    activities: ['environment_setup', 'dependency_management', 'project_structure']
                },
                intentModifiers: {
                    'implementation': ['project_setup', 'initial_structure'],
                    'documentation': ['readme_creation', 'setup_instructions']
                }
            },
            'development': {
                indicators: {
                    keywords: ['implement', 'build', 'create', 'develop', 'add feature'],
                    activities: ['feature_development', 'core_functionality', 'integration']
                },
                intentModifiers: {
                    'implementation': ['feature_development', 'core_logic'],
                    'testing': ['unit_tests', 'integration_tests']
                }
            },
            'testing': {
                indicators: {
                    keywords: ['test', 'debug', 'fix', 'verify', 'validate'],
                    activities: ['bug_fixing', 'testing', 'validation', 'quality_assurance']
                },
                intentModifiers: {
                    'debugging': ['bug_fixing', 'issue_resolution'],
                    'testing': ['test_development', 'validation']
                }
            },
            'optimization': {
                indicators: {
                    keywords: ['optimize', 'refactor', 'improve', 'performance', 'clean'],
                    activities: ['code_optimization', 'refactoring', 'performance_tuning']
                },
                intentModifiers: {
                    'refactoring': ['code_cleanup', 'optimization'],
                    'implementation': ['performance_improvements']
                }
            },
            'deployment': {
                indicators: {
                    keywords: ['deploy', 'release', 'production', 'publish', 'ship'],
                    activities: ['deployment', 'release_management', 'production_setup']
                },
                intentModifiers: {
                    'implementation': ['deployment_scripts', 'production_config'],
                    'documentation': ['deployment_guides', 'release_notes']
                }
            }
        };
    }

    /**
     * Classify intent with context awareness
     */
    async classifyIntent(session, conversations = []) {
        const context = this.extractContext(session, conversations);
        const baseIntent = this.classifyBaseIntent(session, conversations);
        const contextualIntent = this.applyContextModifiers(baseIntent, context);
        
        return {
            primary_intent: contextualIntent.primary,
            secondary_intent: contextualIntent.secondary,
            context: context,
            confidence: contextualIntent.confidence,
            modifiers: contextualIntent.modifiers,
            analysis: {
                method: 'context_aware_classification',
                timestamp: new Date().toISOString(),
                context_weights: this.contextWeights
            }
        };
    }

    /**
     * Extract comprehensive context
     */
    extractContext(session, conversations) {
        return {
            domain: this.detectDomain(session),
            expertise: this.assessExpertiseLevel(session, conversations),
            phase: this.detectProjectPhase(session),
            temporal: this.analyzeTemporalContext(session),
            behavioral: this.analyzeBehavioralContext(session),
            technical: this.analyzeTechnicalContext(session)
        };
    }

    /**
     * Detect project domain
     */
    detectDomain(session) {
        const indicators = this.collectDomainIndicators(session);
        let maxScore = 0;
        let detectedDomain = 'general';

        for (const [domainKey, domainConfig] of Object.entries(this.domainPatterns)) {
            let score = 0;
            const domainIndicators = domainConfig.indicators;

            // Check file patterns
            score += this.checkFilePatterns(indicators.files, domainIndicators.filePatterns) * 0.3;
            
            // Check keywords
            score += this.checkKeywords(indicators.keywords, domainIndicators.keywords) * 0.4;
            
            // Check project structure
            score += this.checkProjectStructure(indicators.structure, domainIndicators.projectStructure) * 0.3;

            if (score > maxScore) {
                maxScore = score;
                detectedDomain = domainKey;
            }
        }

        return {
            domain: detectedDomain,
            confidence: maxScore,
            indicators: indicators
        };
    }

    /**
     * Assess user expertise level
     */
    assessExpertiseLevel(session, conversations) {
        const indicators = this.collectExpertiseIndicators(session, conversations);
        let maxScore = 0;
        let detectedLevel = 'intermediate';

        for (const [levelKey, levelConfig] of Object.entries(this.expertiseLevels)) {
            let score = 0;
            const levelIndicators = levelConfig.indicators;

            // Check code patterns
            score += this.checkCodePatterns(indicators.codePatterns, levelIndicators.codePatterns) * 0.4;
            
            // Check keywords
            score += this.checkKeywords(indicators.keywords, levelIndicators.keywords) * 0.3;
            
            // Check complexity
            score += this.assessComplexityMatch(indicators.complexity, levelIndicators.complexity) * 0.3;

            if (score > maxScore) {
                maxScore = score;
                detectedLevel = levelKey;
            }
        }

        return {
            level: detectedLevel,
            confidence: maxScore,
            indicators: indicators
        };
    }

    /**
     * Detect project phase
     */
    detectProjectPhase(session) {
        const indicators = this.collectPhaseIndicators(session);
        let maxScore = 0;
        let detectedPhase = 'development';

        for (const [phaseKey, phaseConfig] of Object.entries(this.projectPhases)) {
            let score = 0;
            const phaseIndicators = phaseConfig.indicators;

            // Check keywords
            score += this.checkKeywords(indicators.keywords, phaseIndicators.keywords) * 0.5;
            
            // Check file patterns
            score += this.checkFilePatterns(indicators.files, phaseIndicators.filePatterns) * 0.3;
            
            // Check activities
            score += this.checkActivities(indicators.activities, phaseIndicators.activities) * 0.2;

            if (score > maxScore) {
                maxScore = score;
                detectedPhase = phaseKey;
            }
        }

        return {
            phase: detectedPhase,
            confidence: maxScore,
            indicators: indicators
        };
    }

    /**
     * Apply context modifiers to base intent
     */
    applyContextModifiers(baseIntent, context) {
        let modifiedIntent = { ...baseIntent };
        const modifiers = [];

        // Apply domain modifiers
        if (context.domain.confidence > 0.5) {
            const domainModifiers = this.domainPatterns[context.domain.domain]?.intentModifiers;
            if (domainModifiers && domainModifiers[baseIntent.primary]) {
                const complexityModifiers = domainModifiers[baseIntent.primary].complexity;
                if (complexityModifiers && complexityModifiers[context.expertise.level]) {
                    modifiedIntent.secondary = complexityModifiers[context.expertise.level][0];
                    modifiers.push(`domain_${context.domain.domain}`);
                }
            }
        }

        // Apply expertise modifiers
        if (context.expertise.confidence > 0.5) {
            const expertiseModifiers = this.expertiseLevels[context.expertise.level]?.intentModifiers;
            if (expertiseModifiers && expertiseModifiers[baseIntent.primary]) {
                const specificModifiers = expertiseModifiers[baseIntent.primary];
                if (specificModifiers.length > 0) {
                    modifiedIntent.tertiary = specificModifiers[0];
                    modifiers.push(`expertise_${context.expertise.level}`);
                }
            }
        }

        // Apply phase modifiers
        if (context.phase.confidence > 0.5) {
            const phaseModifiers = this.projectPhases[context.phase.phase]?.intentModifiers;
            if (phaseModifiers && phaseModifiers[baseIntent.primary]) {
                const specificModifiers = phaseModifiers[baseIntent.primary];
                if (specificModifiers.length > 0) {
                    modifiedIntent.phase_specific = specificModifiers[0];
                    modifiers.push(`phase_${context.phase.phase}`);
                }
            }
        }

        // Adjust confidence based on context alignment
        const contextAlignment = this.calculateContextAlignment(context);
        modifiedIntent.confidence = Math.min(baseIntent.confidence * contextAlignment, 1);

        return {
            ...modifiedIntent,
            modifiers: modifiers
        };
    }

    /**
     * Calculate context alignment score
     */
    calculateContextAlignment(context) {
        let alignment = 1.0;

        // Domain-expertise alignment
        if (context.domain.confidence > 0.7 && context.expertise.confidence > 0.7) {
            alignment += 0.1;
        }

        // Phase-expertise alignment
        if (context.phase.confidence > 0.7 && context.expertise.confidence > 0.7) {
            alignment += 0.1;
        }

        // Temporal consistency
        if (context.temporal.consistency > 0.8) {
            alignment += 0.1;
        }

        return Math.min(alignment, 1.2);
    }

    /**
     * Classify base intent (simplified version)
     */
    classifyBaseIntent(session, conversations) {
        // This would integrate with existing intent classification
        const content = this.extractAllText(session, conversations);
        
        if (content.includes('explore') || content.includes('analyze')) {
            return { primary: 'data_exploration', confidence: 0.8 };
        }
        if (content.includes('implement') || content.includes('build')) {
            return { primary: 'implementation', confidence: 0.8 };
        }
        if (content.includes('debug') || content.includes('fix')) {
            return { primary: 'debugging', confidence: 0.8 };
        }
        
        return { primary: 'general', confidence: 0.5 };
    }

    // Helper methods for indicator collection
    collectDomainIndicators(session) {
        return {
            files: this.extractFilePaths(session),
            keywords: this.extractKeywords(session),
            structure: this.extractProjectStructure(session)
        };
    }

    collectExpertiseIndicators(session, conversations) {
        return {
            codePatterns: this.extractCodePatterns(session),
            keywords: this.extractKeywords(session, conversations),
            complexity: this.assessCodeComplexity(session)
        };
    }

    collectPhaseIndicators(session) {
        return {
            keywords: this.extractKeywords(session),
            files: this.extractFilePaths(session),
            activities: this.extractActivities(session)
        };
    }

    // Pattern matching methods
    checkFilePatterns(files, patterns) {
        let matches = 0;
        for (const file of files) {
            for (const pattern of patterns) {
                if (this.matchesPattern(file, pattern)) {
                    matches++;
                    break;
                }
            }
        }
        return files.length > 0 ? matches / files.length : 0;
    }

    checkKeywords(keywords, targetKeywords) {
        let matches = 0;
        for (const keyword of keywords) {
            for (const target of targetKeywords) {
                if (keyword.toLowerCase().includes(target.toLowerCase())) {
                    matches++;
                    break;
                }
            }
        }
        return targetKeywords.length > 0 ? matches / targetKeywords.length : 0;
    }

    checkCodePatterns(patterns, targetPatterns) {
        let matches = 0;
        for (const pattern of patterns) {
            for (const target of targetPatterns) {
                if (pattern.includes(target)) {
                    matches++;
                    break;
                }
            }
        }
        return targetPatterns.length > 0 ? matches / targetPatterns.length : 0;
    }

    checkProjectStructure(structure, targetStructure) {
        let matches = 0;
        for (const item of structure) {
            for (const target of targetStructure) {
                if (item.includes(target)) {
                    matches++;
                    break;
                }
            }
        }
        return targetStructure.length > 0 ? matches / targetStructure.length : 0;
    }

    checkActivities(activities, targetActivities) {
        let matches = 0;
        for (const activity of activities) {
            for (const target of targetActivities) {
                if (activity.includes(target)) {
                    matches++;
                    break;
                }
            }
        }
        return targetActivities.length > 0 ? matches / targetActivities.length : 0;
    }

    assessComplexityMatch(complexity, targetComplexity) {
        const complexityMap = { 'low': 1, 'medium': 2, 'high': 3 };
        const current = complexityMap[complexity] || 2;
        const target = complexityMap[targetComplexity] || 2;
        return 1 - Math.abs(current - target) / 2;
    }

    // Utility methods
    extractAllText(session, conversations = []) {
        let text = '';
        
        if (conversations) {
            text += conversations.map(c => c.content || c.prompt || c.response || '').join(' ');
        }
        
        if (session.codeDeltas) {
            text += session.codeDeltas.map(d => d.content || d.afterContent || '').join(' ');
        }
        
        return text.toLowerCase();
    }

    extractFilePaths(session) {
        const files = [];
        if (session.files) {
            files.push(...session.files.map(f => f.path || f.name || ''));
        }
        if (session.currentFile) {
            files.push(session.currentFile);
        }
        return files;
    }

    extractKeywords(session, conversations = []) {
        const text = this.extractAllText(session, conversations);
        return text.split(/\s+/).filter(word => word.length > 3);
    }

    extractProjectStructure(session) {
        // Simplified - would need actual project structure analysis
        return [];
    }

    extractCodePatterns(session) {
        const patterns = [];
        if (session.codeDeltas) {
            session.codeDeltas.forEach(delta => {
                const content = delta.content || delta.afterContent || '';
                patterns.push(content);
            });
        }
        return patterns;
    }

    assessCodeComplexity(session) {
        const content = this.extractAllText(session);
        let complexity = 0;

        if (content.includes('async') || content.includes('await')) complexity += 0.3;
        if (content.includes('class ') || content.includes('def ')) complexity += 0.2;
        if (content.includes('import ') || content.includes('from ')) complexity += 0.1;
        if (content.includes('try:') || content.includes('except:')) complexity += 0.1;
        if (content.includes('lambda') || content.includes('map(')) complexity += 0.1;

        if (complexity < 0.3) return 'low';
        if (complexity < 0.6) return 'medium';
        return 'high';
    }

    extractActivities(session) {
        // Simplified activity extraction
        const text = this.extractAllText(session);
        const activities = [];
        
        if (text.includes('test')) activities.push('testing');
        if (text.includes('debug')) activities.push('debugging');
        if (text.includes('implement')) activities.push('implementation');
        if (text.includes('deploy')) activities.push('deployment');
        
        return activities;
    }

    matchesPattern(file, pattern) {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(file);
        }
        return file.includes(pattern);
    }

    // Context analysis methods
    analyzeTemporalContext(session) {
        return {
            timeOfDay: this.getTimeOfDay(session),
            dayOfWeek: this.getDayOfWeek(session),
            sessionDuration: this.getSessionDuration(session),
            consistency: this.calculateTemporalConsistency(session)
        };
    }

    analyzeBehavioralContext(session) {
        return {
            editPatterns: this.analyzeEditPatterns(session),
            keystrokePatterns: this.analyzeKeystrokePatterns(session),
            focusPatterns: this.analyzeFocusPatterns(session)
        };
    }

    analyzeTechnicalContext(session) {
        return {
            technologies: this.extractTechnologies(session),
            frameworks: this.extractFrameworks(session),
            tools: this.extractTools(session)
        };
    }

    // Additional helper methods
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

    getSessionDuration(session) {
        if (session.startTime && session.endTime) {
            return new Date(session.endTime) - new Date(session.startTime);
        }
        return 0;
    }

    calculateTemporalConsistency(session) {
        // Simplified temporal consistency calculation
        return 0.8; // Default value
    }

    analyzeEditPatterns(session) {
        return 'incremental'; // Simplified
    }

    analyzeKeystrokePatterns(session) {
        return 'normal'; // Simplified
    }

    analyzeFocusPatterns(session) {
        return 'focused'; // Simplified
    }

    extractTechnologies(session) {
        const text = this.extractAllText(session);
        const technologies = [];
        
        const techPatterns = {
            'python': ['python', 'pandas', 'numpy', 'matplotlib'],
            'javascript': ['javascript', 'node', 'react', 'vue'],
            'java': ['java', 'spring', 'maven'],
            'go': ['go', 'golang', 'goroutine']
        };

        for (const [tech, patterns] of Object.entries(techPatterns)) {
            if (patterns.some(pattern => text.includes(pattern))) {
                technologies.push(tech);
            }
        }

        return technologies;
    }

    extractFrameworks(session) {
        const text = this.extractAllText(session);
        const frameworks = [];
        
        const frameworkPatterns = ['django', 'flask', 'react', 'vue', 'angular', 'express', 'spring'];
        
        for (const framework of frameworkPatterns) {
            if (text.includes(framework)) {
                frameworks.push(framework);
            }
        }

        return frameworks;
    }

    extractTools(session) {
        const text = this.extractAllText(session);
        const tools = [];
        
        const toolPatterns = ['docker', 'kubernetes', 'git', 'jenkins', 'travis'];
        
        for (const tool of toolPatterns) {
            if (text.includes(tool)) {
                tools.push(tool);
            }
        }

        return tools;
    }
}

module.exports = ContextAwareClassifier;
