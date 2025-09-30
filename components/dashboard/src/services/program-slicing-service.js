/**
 * Program Slicing Service
 * Provides enhanced code change analysis using program slicing techniques
 * Simplified implementation that doesn't require full DG library build
 */

// Browser-compatible version - no Node.js dependencies
// const fs = require('fs').promises;
// const path = require('path');
// const { exec } = require('child_process');
// const { promisify } = require('util');

// const execAsync = promisify(exec);

class ProgramSlicingService {
    constructor(options = {}) {
        this.options = {
            tempDir: options.tempDir || './temp/slicing-analysis',
            enableLLVM: options.enableLLVM || false,
            enableAST: options.enableAST || true,
            enableSemantic: options.enableSemantic || true,
            cacheSize: options.cacheSize || 100,
            maxAnalysisTime: options.maxAnalysisTime || 30000, // 30 seconds
            ...options
        };
        
        this.analysisCache = new Map();
        this.dependencyGraph = new Map();
        this.functionRegistry = new Map();
        this.analysisQueue = new Set();
        
        this.initializeTempDirectory();
        this.startCacheCleanup();
    }

    /**
     * Initialize temporary directory for analysis
     */
    async initializeTempDirectory() {
        try {
            // Browser-compatible: no file system access needed
            console.log(`Program slicing service initialized (browser mode)`);
        } catch (error) {
            console.error('Failed to initialize temp directory:', error);
        }
    }

    /**
     * Start cache cleanup to prevent memory leaks
     */
    startCacheCleanup() {
        setInterval(() => {
            this.cleanupCache();
        }, 300000); // Clean up every 5 minutes
    }

    /**
     * Clean up old cache entries
     */
    cleanupCache() {
        const maxAge = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        
        for (const [key, value] of this.analysisCache.entries()) {
            if (now - value.timestamp > maxAge) {
                this.analysisCache.delete(key);
            }
        }
        
        // Limit cache size
        if (this.analysisCache.size > this.options.cacheSize) {
            const entries = Array.from(this.analysisCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            
            const toDelete = entries.slice(0, entries.length - this.options.cacheSize);
            toDelete.forEach(([key]) => this.analysisCache.delete(key));
        }
    }

    /**
     * Analyze a session's code changes with program slicing
     */
    async analyzeSession(sessionId, sessionData) {
        try {
            // Check if analysis is already in progress
            if (this.analysisQueue.has(sessionId)) {
                console.log(`Analysis already in progress for session: ${sessionId}`);
                return this.analysisCache.get(sessionId) || this.createErrorResult(sessionId, new Error('Analysis in progress'));
            }

            // Check cache first
            const cached = this.analysisCache.get(sessionId);
            if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                console.log(`Using cached analysis for session: ${sessionId}`);
                return cached;
            }

            this.analysisQueue.add(sessionId);
            console.log(`Starting program slicing analysis for session: ${sessionId}`);
            
            // Set up timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Analysis timeout')), this.options.maxAnalysisTime);
            });

            const analysisPromise = this.performAnalysis(sessionId, sessionData);
            
            const analysisResults = await Promise.race([analysisPromise, timeoutPromise]);
            
            // Cache the results
            this.analysisCache.set(sessionId, analysisResults);
            this.analysisQueue.delete(sessionId);
            
            console.log(`Program slicing analysis completed for session: ${sessionId}`);
            return analysisResults;
            
        } catch (error) {
            this.analysisQueue.delete(sessionId);
            console.error(`Error analyzing session ${sessionId}:`, error);
            return this.createErrorResult(sessionId, error);
        }
    }

    /**
     * Perform the actual analysis
     */
    async performAnalysis(sessionId, sessionData) {
        const analysisResults = {
            sessionId,
            timestamp: Date.now(),
            codeDeltas: [],
            impactAnalysis: {
                totalImpact: 0,
                highImpactChanges: 0,
                mediumImpactChanges: 0,
                lowImpactChanges: 0,
                affectedFunctions: new Set(),
                affectedVariables: new Set(),
                dependencyChains: []
            },
            slicingResults: []
        };

        // Analyze each code delta
        for (const delta of sessionData.codeDeltas || []) {
            const deltaAnalysis = await this.analyzeCodeDelta(delta, sessionData);
            analysisResults.codeDeltas.push(deltaAnalysis);
            analysisResults.slicingResults.push(deltaAnalysis.slicing);
            
            // Update impact analysis
            this.updateImpactAnalysis(analysisResults.impactAnalysis, deltaAnalysis);
        }

        // Perform cross-delta analysis
        analysisResults.crossDeltaAnalysis = await this.performCrossDeltaAnalysis(analysisResults.codeDeltas);
        
        // Calculate overall impact score
        analysisResults.impactScore = this.calculateImpactScore(analysisResults.impactAnalysis);
        
        return analysisResults;
    }

    /**
     * Analyze a single code delta
     */
    async analyzeCodeDelta(delta, sessionData) {
        const deltaId = `${delta.timestamp}-${delta.cellIndex || 'unknown'}`;
        
        try {
            const analysis = {
                deltaId,
                originalDelta: delta,
                slicing: {
                    dataDependencies: [],
                    controlDependencies: [],
                    pointerDependencies: [],
                    functionCalls: [],
                    variableUsage: [],
                    impactLevel: 'low',
                    affectedScope: 'local',
                    complexity: 0
                },
                semanticAnalysis: {
                    intent: 'unknown',
                    category: 'general',
                    riskLevel: 'low',
                    testability: 'high'
                },
                astAnalysis: null,
                llvmAnalysis: null
            };

            // Perform AST-based analysis
            if (this.options.enableAST) {
                analysis.astAnalysis = await this.performASTAnalysis(delta);
            }

            // Perform semantic analysis
            if (this.options.enableSemantic) {
                analysis.semanticAnalysis = await this.performSemanticAnalysis(delta, sessionData);
            }

            // Perform LLVM-based analysis if available
            if (this.options.enableLLVM) {
                analysis.llvmAnalysis = await this.performLLVMAnalysis(delta);
            }

            // Extract dependencies from the code
            analysis.slicing = await this.extractDependencies(delta, analysis);
            
            // Calculate complexity and impact
            analysis.slicing.complexity = this.calculateComplexity(analysis);
            analysis.slicing.impactLevel = this.determineImpactLevel(analysis);
            analysis.slicing.affectedScope = this.determineAffectedScope(analysis);

            return analysis;
            
        } catch (error) {
            console.error(`Error analyzing code delta ${deltaId}:`, error);
            return this.createErrorDeltaAnalysis(deltaId, delta, error);
        }
    }

    /**
     * Perform AST-based analysis
     */
    async performASTAnalysis(delta) {
        try {
            const code = delta.afterContent || delta.content || delta.code || '';
            const language = this.detectLanguage(code);
            
            const astAnalysis = {
                language,
                functions: [],
                variables: [],
                imports: [],
                classes: [],
                complexity: 0,
                nesting: 0
            };

            // Extract functions
            astAnalysis.functions = this.extractFunctions(code, language);
            
            // Extract variables
            astAnalysis.variables = this.extractVariables(code, language);
            
            // Extract imports
            astAnalysis.imports = this.extractImports(code, language);
            
            // Extract classes
            astAnalysis.classes = this.extractClasses(code, language);
            
            // Calculate complexity metrics
            astAnalysis.complexity = this.calculateASTComplexity(code, language);
            astAnalysis.nesting = this.calculateNestingDepth(code, language);

            return astAnalysis;
            
        } catch (error) {
            console.error('Error in AST analysis:', error);
            return null;
        }
    }

    /**
     * Perform semantic analysis
     */
    async performSemanticAnalysis(delta, sessionData) {
        try {
            const code = delta.afterContent || delta.content || delta.code || '';
            
            const semanticAnalysis = {
                intent: this.detectIntent(code),
                category: this.categorizeCode(code),
                riskLevel: this.assessRiskLevel(code),
                testability: this.assessTestability(code),
                patterns: this.detectPatterns(code),
                keywords: this.extractKeywords(code)
            };

            return semanticAnalysis;
            
        } catch (error) {
            console.error('Error in semantic analysis:', error);
            return {
                intent: 'unknown',
                category: 'general',
                riskLevel: 'low',
                testability: 'high',
                patterns: [],
                keywords: []
            };
        }
    }

    /**
     * Extract dependencies from code analysis
     */
    async extractDependencies(delta, analysis) {
        const slicing = {
            dataDependencies: [],
            controlDependencies: [],
            pointerDependencies: [],
            functionCalls: [],
            variableUsage: [],
            impactLevel: 'low',
            affectedScope: 'local',
            complexity: 0
        };

        try {
            const code = delta.afterContent || delta.content || delta.code || '';
            
            // Extract function calls
            slicing.functionCalls = this.extractFunctionCalls(code);
            
            // Extract variable usage
            slicing.variableUsage = this.extractVariableUsage(code);
            
            // Extract data dependencies
            slicing.dataDependencies = this.extractDataDependencies(code, analysis);
            
            // Extract control dependencies
            slicing.controlDependencies = this.extractControlDependencies(code, analysis);
            
            // Extract pointer dependencies (for languages that support them)
            slicing.pointerDependencies = this.extractPointerDependencies(code, analysis);

            return slicing;
            
        } catch (error) {
            console.error('Error extracting dependencies:', error);
            return slicing;
        }
    }

    /**
     * Perform cross-delta analysis
     */
    async performCrossDeltaAnalysis(codeDeltas) {
        try {
            const crossAnalysis = {
                sharedFunctions: new Set(),
                sharedVariables: new Set(),
                dependencyChains: [],
                potentialConflicts: [],
                optimizationOpportunities: []
            };

            // Find shared functions and variables across deltas
            for (let i = 0; i < codeDeltas.length; i++) {
                for (let j = i + 1; j < codeDeltas.length; j++) {
                    const delta1 = codeDeltas[i];
                    const delta2 = codeDeltas[j];
                    
                    // Find shared functions
                    const sharedFuncs = this.findSharedFunctions(delta1, delta2);
                    sharedFuncs.forEach(func => crossAnalysis.sharedFunctions.add(func));
                    
                    // Find shared variables
                    const sharedVars = this.findSharedVariables(delta1, delta2);
                    sharedVars.forEach(variable => crossAnalysis.sharedVariables.add(variable));
                    
                    // Detect potential conflicts
                    const conflicts = this.detectConflicts(delta1, delta2);
                    crossAnalysis.potentialConflicts.push(...conflicts);
                }
            }

            // Build dependency chains
            crossAnalysis.dependencyChains = this.buildDependencyChains(codeDeltas);
            
            // Find optimization opportunities
            crossAnalysis.optimizationOpportunities = this.findOptimizationOpportunities(codeDeltas);

            return crossAnalysis;
            
        } catch (error) {
            console.error('Error in cross-delta analysis:', error);
            return {
                sharedFunctions: new Set(),
                sharedVariables: new Set(),
                dependencyChains: [],
                potentialConflicts: [],
                optimizationOpportunities: []
            };
        }
    }

    // Helper methods for code analysis

    detectLanguage(code) {
        if (code.includes('import pandas') || code.includes('import numpy') || code.includes('def ')) {
            return 'python';
        } else if (code.includes('function') || code.includes('const ') || code.includes('let ')) {
            return 'javascript';
        } else if (code.includes('#include') || code.includes('int main')) {
            return 'cpp';
        } else if (code.includes('package ') || code.includes('import java')) {
            return 'java';
        }
        return 'unknown';
    }

    /**
     * Extract function parameters from function signature
     */
    extractFunctionParameters(functionSignature) {
        try {
            // Extract parameters from function signature
            const paramMatch = functionSignature.match(/\(([^)]*)\)/);
            if (!paramMatch) return [];
            
            const params = paramMatch[1].split(',').map(param => {
                return param.trim().split('=')[0].trim();
            }).filter(param => param.length > 0);
            
            return params;
        } catch (error) {
            console.warn('Error extracting function parameters:', error);
            return [];
        }
    }

    extractFunctions(code, language) {
        const functions = [];
        
        if (language === 'python') {
            const functionRegex = /def\s+(\w+)\s*\([^)]*\)\s*:/g;
            let match;
            while ((match = functionRegex.exec(code)) !== null) {
                functions.push({
                    name: match[1],
                    line: code.substring(0, match.index).split('\n').length,
                    parameters: this.extractFunctionParameters(match[0])
                });
            }
        } else if (language === 'javascript') {
            const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function))/g;
            let match;
            while ((match = functionRegex.exec(code)) !== null) {
                const name = match[1] || match[2];
                if (name) {
                    functions.push({
                        name,
                        line: code.substring(0, match.index).split('\n').length,
                        type: match[1] ? 'function' : 'arrow'
                    });
                }
            }
        }
        
        return functions;
    }

    extractVariables(code, language) {
        const variables = [];
        
        if (language === 'python') {
            const variableRegex = /(\w+)\s*=\s*[^=\n]+/g;
            let match;
            while ((match = variableRegex.exec(code)) !== null) {
                variables.push({
                    name: match[1],
                    line: code.substring(0, match.index).split('\n').length,
                    type: 'assignment'
                });
            }
        } else if (language === 'javascript') {
            const variableRegex = /(?:const|let|var)\s+(\w+)/g;
            let match;
            while ((match = variableRegex.exec(code)) !== null) {
                variables.push({
                    name: match[1],
                    line: code.substring(0, match.index).split('\n').length,
                    type: 'declaration'
                });
            }
        }
        
        return variables;
    }

    extractImports(code, language) {
        const imports = [];
        
        if (language === 'python') {
            const importRegex = /(?:import\s+(\w+)|from\s+(\w+)\s+import)/g;
            let match;
            while ((match = importRegex.exec(code)) !== null) {
                imports.push({
                    module: match[1] || match[2],
                    line: code.substring(0, match.index).split('\n').length
                });
            }
        } else if (language === 'javascript') {
            const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(code)) !== null) {
                imports.push({
                    module: match[1],
                    line: code.substring(0, match.index).split('\n').length
                });
            }
        }
        
        return imports;
    }

    extractClasses(code, language) {
        const classes = [];
        
        if (language === 'python') {
            const classRegex = /class\s+(\w+)(?:\([^)]*\))?\s*:/g;
            let match;
            while ((match = classRegex.exec(code)) !== null) {
                classes.push({
                    name: match[1],
                    line: code.substring(0, match.index).split('\n').length
                });
            }
        } else if (language === 'javascript') {
            const classRegex = /class\s+(\w+)/g;
            let match;
            while ((match = classRegex.exec(code)) !== null) {
                classes.push({
                    name: match[1],
                    line: code.substring(0, match.index).split('\n').length
                });
            }
        }
        
        return classes;
    }

    calculateASTComplexity(code, language) {
        let complexity = 0;
        
        // Count control structures
        const controlStructures = ['if', 'for', 'while', 'try', 'except', 'switch', 'case'];
        controlStructures.forEach(structure => {
            const regex = new RegExp(`\\b${structure}\\b`, 'g');
            const matches = code.match(regex);
            if (matches) complexity += matches.length;
        });
        
        // Count nested structures
        const nesting = this.calculateNestingDepth(code, language);
        complexity += nesting * 2;
        
        return complexity;
    }

    calculateNestingDepth(code, language) {
        let maxDepth = 0;
        let currentDepth = 0;
        
        for (const line of code.split('\n')) {
            const trimmed = line.trim();
            
            // Increase depth for opening structures
            if (trimmed.includes('{') || trimmed.includes(':')) {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            }
            
            // Decrease depth for closing structures
            if (trimmed.includes('}') || (trimmed === '' && currentDepth > 0)) {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }
        
        return maxDepth;
    }

    detectIntent(code) {
        const lowerCode = code.toLowerCase();
        
        if (lowerCode.includes('test') || lowerCode.includes('assert')) {
            return 'testing';
        } else if (lowerCode.includes('plot') || lowerCode.includes('visualize') || lowerCode.includes('chart')) {
            return 'visualization';
        } else if (lowerCode.includes('import') || lowerCode.includes('load')) {
            return 'data_loading';
        } else if (lowerCode.includes('transform') || lowerCode.includes('process')) {
            return 'data_processing';
        } else if (lowerCode.includes('model') || lowerCode.includes('fit') || lowerCode.includes('train')) {
            return 'modeling';
        } else if (lowerCode.includes('predict') || lowerCode.includes('inference')) {
            return 'prediction';
        } else if (lowerCode.includes('save') || lowerCode.includes('export')) {
            return 'data_export';
        }
        
        return 'general';
    }

    categorizeCode(code) {
        const lowerCode = code.toLowerCase();
        
        if (lowerCode.includes('pandas') || lowerCode.includes('numpy')) {
            return 'data_analysis';
        } else if (lowerCode.includes('matplotlib') || lowerCode.includes('seaborn') || lowerCode.includes('plotly')) {
            return 'visualization';
        } else if (lowerCode.includes('sklearn') || lowerCode.includes('tensorflow') || lowerCode.includes('pytorch')) {
            return 'machine_learning';
        } else if (lowerCode.includes('requests') || lowerCode.includes('urllib')) {
            return 'web_scraping';
        } else if (lowerCode.includes('sql') || lowerCode.includes('database')) {
            return 'database';
        }
        
        return 'general';
    }

    assessRiskLevel(code) {
        const lowerCode = code.toLowerCase();
        let riskScore = 0;
        
        // High-risk patterns
        if (lowerCode.includes('eval(') || lowerCode.includes('exec(')) riskScore += 10;
        if (lowerCode.includes('os.system') || lowerCode.includes('subprocess')) riskScore += 8;
        if (lowerCode.includes('pickle') || lowerCode.includes('marshal')) riskScore += 6;
        if (lowerCode.includes('shell=True')) riskScore += 7;
        
        // Medium-risk patterns
        if (lowerCode.includes('file(') || lowerCode.includes('open(')) riskScore += 3;
        if (lowerCode.includes('input(') || lowerCode.includes('raw_input')) riskScore += 2;
        if (lowerCode.includes('eval') || lowerCode.includes('exec')) riskScore += 4;
        
        if (riskScore >= 8) return 'high';
        if (riskScore >= 4) return 'medium';
        return 'low';
    }

    assessTestability(code) {
        const lowerCode = code.toLowerCase();
        
        // Factors that make code hard to test
        if (lowerCode.includes('global ') || lowerCode.includes('nonlocal')) return 'low';
        if (lowerCode.includes('input(') || lowerCode.includes('raw_input')) return 'low';
        if (lowerCode.includes('random') || lowerCode.includes('time.time')) return 'medium';
        if (lowerCode.includes('os.environ') || lowerCode.includes('sys.argv')) return 'low';
        
        // Factors that make code easy to test
        if (lowerCode.includes('def ') && !lowerCode.includes('global')) return 'high';
        if (lowerCode.includes('class ') && lowerCode.includes('__init__')) return 'high';
        
        return 'medium';
    }

    detectPatterns(code) {
        const patterns = [];
        const lowerCode = code.toLowerCase();
        
        if (lowerCode.includes('for ') && lowerCode.includes('in ')) patterns.push('iteration');
        if (lowerCode.includes('if ') && lowerCode.includes('else')) patterns.push('conditional');
        if (lowerCode.includes('try:') && lowerCode.includes('except')) patterns.push('exception_handling');
        if (lowerCode.includes('with ')) patterns.push('context_manager');
        if (lowerCode.includes('lambda ')) patterns.push('lambda_function');
        if (lowerCode.includes('yield ')) patterns.push('generator');
        if (lowerCode.includes('decorator') || lowerCode.includes('@')) patterns.push('decorator');
        
        return patterns;
    }

    extractKeywords(code) {
        const keywords = [];
        const lowerCode = code.toLowerCase();
        
        const keywordPatterns = [
            'import', 'from', 'def', 'class', 'if', 'else', 'elif', 'for', 'while',
            'try', 'except', 'finally', 'with', 'as', 'return', 'yield', 'lambda',
            'global', 'nonlocal', 'assert', 'break', 'continue', 'pass'
        ];
        
        keywordPatterns.forEach(keyword => {
            if (lowerCode.includes(keyword)) {
                keywords.push(keyword);
            }
        });
        
        return [...new Set(keywords)]; // Remove duplicates
    }

    extractFunctionCalls(code) {
        const functionCalls = [];
        
        // Python function calls
        const pythonRegex = /(\w+)\s*\(/g;
        let match;
        while ((match = pythonRegex.exec(code)) !== null) {
            const functionName = match[1];
            if (!['if', 'for', 'while', 'def', 'class', 'import', 'from', 'return', 'yield'].includes(functionName)) {
                functionCalls.push({
                    name: functionName,
                    line: code.substring(0, match.index).split('\n').length
                });
            }
        }
        
        return functionCalls;
    }

    extractVariableUsage(code) {
        const variables = [];
        
        // Extract variable assignments and usage
        const variableRegex = /(\w+)\s*[=+\-*/]/g;
        let match;
        while ((match = variableRegex.exec(code)) !== null) {
            variables.push({
                name: match[1],
                line: code.substring(0, match.index).split('\n').length,
                type: 'assignment'
            });
        }
        
        return variables;
    }

    extractDataDependencies(code, analysis) {
        const dependencies = [];
        
        if (analysis.astAnalysis) {
            const variables = analysis.astAnalysis.variables;
            const functions = analysis.astAnalysis.functions;
            
            // Find variable dependencies
            variables.forEach(variable => {
                const usage = this.findVariableUsage(code, variable.name);
                if (usage.length > 1) {
                    dependencies.push({
                        type: 'data',
                        variable: variable.name,
                        usage: usage,
                        scope: 'local'
                    });
                }
            });
        }
        
        return dependencies;
    }

    extractControlDependencies(code, analysis) {
        const dependencies = [];
        
        // Find control flow dependencies
        const controlStructures = ['if', 'for', 'while', 'try', 'except'];
        controlStructures.forEach(structure => {
            const regex = new RegExp(`\\b${structure}\\b`, 'g');
            const matches = code.match(regex);
            if (matches && matches.length > 0) {
                dependencies.push({
                    type: 'control',
                    structure: structure,
                    count: matches.length,
                    scope: 'local'
                });
            }
        });
        
        return dependencies;
    }

    extractPointerDependencies(code, analysis) {
        // This would be more relevant for C/C++ code
        // For Python/JavaScript, we'll look for object references
        const dependencies = [];
        
        const objectRegex = /(\w+)\.(\w+)/g;
        let match;
        while ((match = objectRegex.exec(code)) !== null) {
            dependencies.push({
                type: 'pointer',
                object: match[1],
                property: match[2],
                line: code.substring(0, match.index).split('\n').length
            });
        }
        
        return dependencies;
    }

    findVariableUsage(code, variableName) {
        const usage = [];
        const regex = new RegExp(`\\b${variableName}\\b`, 'g');
        let match;
        
        while ((match = regex.exec(code)) !== null) {
            usage.push({
                line: code.substring(0, match.index).split('\n').length,
                position: match.index
            });
        }
        
        return usage;
    }

    findSharedFunctions(delta1, delta2) {
        const functions1 = delta1.slicing?.functionCalls || [];
        const functions2 = delta2.slicing?.functionCalls || [];
        
        const shared = [];
        functions1.forEach(func1 => {
            functions2.forEach(func2 => {
                if (func1.name === func2.name) {
                    shared.push(func1.name);
                }
            });
        });
        
        return [...new Set(shared)];
    }

    findSharedVariables(delta1, delta2) {
        const vars1 = delta1.slicing?.variableUsage || [];
        const vars2 = delta2.slicing?.variableUsage || [];
        
        const shared = [];
        vars1.forEach(variable1 => {
            vars2.forEach(variable2 => {
                if (variable1.name === variable2.name) {
                    shared.push(variable1.name);
                }
            });
        });
        
        return [...new Set(shared)];
    }

    detectConflicts(delta1, delta2) {
        const conflicts = [];
        
        // Check for variable name conflicts
        const sharedVars = this.findSharedVariables(delta1, delta2);
        sharedVars.forEach(variableName => {
            conflicts.push({
                type: 'variable_conflict',
                variable: variableName,
                deltas: [delta1.deltaId, delta2.deltaId],
                severity: 'medium'
            });
        });
        
        // Check for function name conflicts
        const sharedFuncs = this.findSharedFunctions(delta1, delta2);
        sharedFuncs.forEach(funcName => {
            conflicts.push({
                type: 'function_conflict',
                function: funcName,
                deltas: [delta1.deltaId, delta2.deltaId],
                severity: 'high'
            });
        });
        
        return conflicts;
    }

    buildDependencyChains(codeDeltas) {
        const chains = [];
        
        // Build dependency chains based on shared variables and functions
        for (let i = 0; i < codeDeltas.length - 1; i++) {
            const current = codeDeltas[i];
            const next = codeDeltas[i + 1];
            
            const sharedVars = this.findSharedVariables(current, next);
            const sharedFuncs = this.findSharedFunctions(current, next);
            
            if (sharedVars.length > 0 || sharedFuncs.length > 0) {
                chains.push({
                    from: current.deltaId,
                    to: next.deltaId,
                    dependencies: {
                        variables: sharedVars,
                        functions: sharedFuncs
                    },
                    strength: sharedVars.length + sharedFuncs.length
                });
            }
        }
        
        return chains;
    }

    findOptimizationOpportunities(codeDeltas) {
        const opportunities = [];
        
        // Find repeated code patterns
        const patterns = new Map();
        codeDeltas.forEach(delta => {
            const functions = delta.slicing?.functionCalls || [];
            functions.forEach(func => {
                if (patterns.has(func.name)) {
                    patterns.get(func.name).push(delta.deltaId);
                } else {
                    patterns.set(func.name, [delta.deltaId]);
                }
            });
        });
        
        // Identify opportunities
        patterns.forEach((deltas, functionName) => {
            if (deltas.length > 2) {
                opportunities.push({
                    type: 'function_extraction',
                    function: functionName,
                    occurrences: deltas.length,
                    deltas: deltas,
                    potential_savings: 'medium'
                });
            }
        });
        
        return opportunities;
    }

    calculateComplexity(analysis) {
        let complexity = 0;
        
        if (analysis.astAnalysis) {
            complexity += analysis.astAnalysis.complexity;
            complexity += analysis.astAnalysis.nesting * 2;
        }
        
        if (analysis.slicing) {
            complexity += analysis.slicing.functionCalls.length;
            complexity += analysis.slicing.variableUsage.length;
            complexity += analysis.slicing.dataDependencies.length;
            complexity += analysis.slicing.controlDependencies.length;
        }
        
        return complexity;
    }

    determineImpactLevel(analysis) {
        const complexity = this.calculateComplexity(analysis);
        const riskLevel = analysis.semanticAnalysis?.riskLevel || 'low';
        
        if (complexity > 20 || riskLevel === 'high') return 'high';
        if (complexity > 10 || riskLevel === 'medium') return 'medium';
        return 'low';
    }

    determineAffectedScope(analysis) {
        const functions = analysis.slicing?.functionCalls || [];
        const imports = analysis.astAnalysis?.imports || [];
        
        if (functions.length > 5 || imports.length > 3) return 'global';
        if (functions.length > 2 || imports.length > 1) return 'module';
        return 'local';
    }

    updateImpactAnalysis(impactAnalysis, deltaAnalysis) {
        const impactLevel = deltaAnalysis.slicing.impactLevel;
        
        if (impactLevel === 'high') {
            impactAnalysis.highImpactChanges++;
            impactAnalysis.totalImpact += 10;
        } else if (impactLevel === 'medium') {
            impactAnalysis.mediumImpactChanges++;
            impactAnalysis.totalImpact += 5;
        } else {
            impactAnalysis.lowImpactChanges++;
            impactAnalysis.totalImpact += 1;
        }
        
        // Add affected functions and variables
        deltaAnalysis.slicing.functionCalls.forEach(func => {
            impactAnalysis.affectedFunctions.add(func.name);
        });
        
        deltaAnalysis.slicing.variableUsage.forEach(variable => {
            impactAnalysis.affectedVariables.add(variable.name);
        });
    }

    calculateImpactScore(impactAnalysis) {
        const totalChanges = impactAnalysis.highImpactChanges + 
                           impactAnalysis.mediumImpactChanges + 
                           impactAnalysis.lowImpactChanges;
        
        if (totalChanges === 0) return 0;
        
        const weightedScore = (impactAnalysis.highImpactChanges * 10) +
                            (impactAnalysis.mediumImpactChanges * 5) +
                            (impactAnalysis.lowImpactChanges * 1);
        
        return Math.min(100, Math.round((weightedScore / totalChanges) * 10));
    }

    createErrorResult(sessionId, error) {
        return {
            sessionId,
            timestamp: Date.now(),
            error: error.message,
            codeDeltas: [],
            impactAnalysis: {
                totalImpact: 0,
                highImpactChanges: 0,
                mediumImpactChanges: 0,
                lowImpactChanges: 0,
                affectedFunctions: new Set(),
                affectedVariables: new Set(),
                dependencyChains: []
            },
            slicingResults: [],
            impactScore: 0
        };
    }

    createErrorDeltaAnalysis(deltaId, delta, error) {
        return {
            deltaId,
            originalDelta: delta,
            error: error.message,
            slicing: {
                dataDependencies: [],
                controlDependencies: [],
                pointerDependencies: [],
                functionCalls: [],
                variableUsage: [],
                impactLevel: 'low',
                affectedScope: 'local',
                complexity: 0
            },
            semanticAnalysis: {
                intent: 'unknown',
                category: 'general',
                riskLevel: 'low',
                testability: 'high'
            }
        };
    }

    /**
     * Get cached analysis results
     */
    getCachedAnalysis(sessionId) {
        return this.analysisCache.get(sessionId);
    }

    /**
     * Clear analysis cache
     */
    clearCache() {
        this.analysisCache.clear();
        this.dependencyGraph.clear();
        this.functionRegistry.clear();
    }

    /**
     * Get analysis statistics
     */
    getAnalysisStats() {
        return {
            cacheSize: this.analysisCache.size,
            dependencyGraphSize: this.dependencyGraph.size,
            functionRegistrySize: this.functionRegistry.size,
            tempDir: this.options.tempDir
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProgramSlicingService };
} else if (typeof window !== 'undefined') {
    window.ProgramSlicingService = ProgramSlicingService;
}
