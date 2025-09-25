/**
 * AST-Grep Integration Module
 * 
 * This module integrates the AST-Grep service with the existing PKL Extension
 * system, providing enhanced code analysis and pattern matching capabilities.
 * 
 * Features:
 * - Integration with existing services
 * - Real-time code analysis
 * - Pattern-based extraction
 * - Learning from user interactions
 * - Configuration management
 */

const ASTGrepService = require('./ast-grep-service');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ASTGrepIntegration extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      configPath: config.configPath || './ast-grep-config.json',
      enableCaching: config.enableCaching !== false,
      enableLearning: config.enableLearning !== false,
      enablePatternMatching: config.enablePatternMatching !== false,
      ...config
    };
    
    this.astGrepService = new ASTGrepService(this.config);
    this.analysisHistory = [];
    this.userPreferences = {};
    this.patternCache = new Map();
    
    // Initialize integration
    this.initialize();
  }
  
  /**
   * Initialize the integration
   */
  async initialize() {
    try {
      // Load configuration
      await this.loadConfiguration();
      
      // Load user preferences
      await this.loadUserPreferences();
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('AST-Grep Integration initialized');
      this.emit('initialized');
      
    } catch (error) {
      console.error('Failed to initialize AST-Grep Integration:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Load configuration from file
   */
  async loadConfiguration() {
    try {
      if (fs.existsSync(this.config.configPath)) {
        const configData = fs.readFileSync(this.config.configPath, 'utf8');
        this.configuration = JSON.parse(configData);
        console.log('Configuration loaded from', this.config.configPath);
      } else {
        // Use default configuration
        this.configuration = this.getDefaultConfiguration();
        console.log('Using default configuration');
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      this.configuration = this.getDefaultConfiguration();
    }
  }
  
  /**
   * Get default configuration
   */
  getDefaultConfiguration() {
    return {
      extractionPatterns: {
        javascript: {
          functions: [
            'function $NAME($$$PARAMS) {$$$}',
            'const $NAME = ($$$PARAMS) => {$$$}',
            'let $NAME = ($$$PARAMS) => {$$$}',
            'var $NAME = ($$$PARAMS) => {$$$}',
            '$NAME: function($$$PARAMS) {$$$}',
            '$NAME($$$PARAMS) {$$$}',
            'async function $NAME($$$PARAMS) {$$$}',
            'async $NAME($$$PARAMS) => {$$$}'
          ],
          classes: [
            'class $NAME {$$$}',
            'class $NAME extends $PARENT {$$$}',
            'export class $NAME {$$$}'
          ],
          modules: {
            imports: [
              'import $NAME from $SOURCE',
              'import { $NAME } from $SOURCE',
              'import * as $NAME from $SOURCE'
            ],
            exports: [
              'export $NAME',
              'export default $NAME',
              'export { $NAME }',
              'module.exports = $NAME'
            ]
          }
        }
      },
      analysisConfig: {
        enableCaching: true,
        cacheSize: 1000,
        enableLearning: true,
        maxHistorySize: 100
      }
    };
  }
  
  /**
   * Load user preferences
   */
  async loadUserPreferences() {
    try {
      const prefsPath = path.join(process.cwd(), 'user_preferences.json');
      if (fs.existsSync(prefsPath)) {
        const data = fs.readFileSync(prefsPath, 'utf8');
        this.userPreferences = JSON.parse(data);
        console.log('User preferences loaded');
      } else {
        this.userPreferences = {
          preferredLanguages: ['JavaScript', 'TypeScript', 'Python'],
          extractionPreferences: {
            includeComments: true,
            includeImports: true,
            includeExports: true,
            includeVariables: true
          },
          learningEnabled: true
        };
      }
    } catch (error) {
      console.warn('Could not load user preferences:', error);
      this.userPreferences = {
        preferredLanguages: ['JavaScript', 'TypeScript', 'Python'],
        extractionPreferences: {
          includeComments: true,
          includeImports: true,
          includeExports: true,
          includeVariables: true
        },
        learningEnabled: true
      };
    }
  }
  
  /**
   * Save user preferences
   */
  async saveUserPreferences() {
    try {
      const prefsPath = path.join(process.cwd(), 'user_preferences.json');
      fs.writeFileSync(prefsPath, JSON.stringify(this.userPreferences, null, 2));
      console.log('User preferences saved');
    } catch (error) {
      console.error('Could not save user preferences:', error);
    }
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.astGrepService.on('analysisComplete', (analysis) => {
      this.handleAnalysisComplete(analysis);
    });
    
    this.astGrepService.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  /**
   * Handle analysis completion
   */
  handleAnalysisComplete(analysis) {
    // Store in history
    this.analysisHistory.push(analysis);
    
    // Keep only recent history
    if (this.analysisHistory.length > this.configuration.analysisConfig.maxHistorySize) {
      this.analysisHistory = this.analysisHistory.slice(-this.configuration.analysisConfig.maxHistorySize);
    }
    
    // Learn from analysis if enabled
    if (this.config.enableLearning && this.userPreferences.learningEnabled) {
      this.learnFromAnalysis(analysis);
    }
    
    this.emit('analysisComplete', analysis);
  }
  
  /**
   * Learn from analysis
   */
  learnFromAnalysis(analysis) {
    try {
      // Update user preferences based on analysis
      if (analysis.functions.length > 0) {
        this.updateFunctionPreferences(analysis);
      }
      
      if (analysis.classes.length > 0) {
        this.updateClassPreferences(analysis);
      }
      
      if (analysis.modules.imports.length > 0) {
        this.updateImportPreferences(analysis);
      }
      
      // Save updated preferences
      this.saveUserPreferences();
      
    } catch (error) {
      console.error('Error learning from analysis:', error);
    }
  }
  
  /**
   * Update function preferences
   */
  updateFunctionPreferences(analysis) {
    if (!this.userPreferences.functionPreferences) {
      this.userPreferences.functionPreferences = {};
    }
    
    analysis.functions.forEach(func => {
      const key = `${func.name}_${func.parameters.length}`;
      if (!this.userPreferences.functionPreferences[key]) {
        this.userPreferences.functionPreferences[key] = {
          count: 0,
          isAsync: func.isAsync,
          isArrow: func.isArrow,
          isMethod: func.isMethod
        };
      }
      this.userPreferences.functionPreferences[key].count++;
    });
  }
  
  /**
   * Update class preferences
   */
  updateClassPreferences(analysis) {
    if (!this.userPreferences.classPreferences) {
      this.userPreferences.classPreferences = {};
    }
    
    analysis.classes.forEach(cls => {
      if (!this.userPreferences.classPreferences[cls.name]) {
        this.userPreferences.classPreferences[cls.name] = {
          count: 0,
          methodCount: cls.methods.length,
          hasParent: !!cls.parent,
          isExported: cls.isExported
        };
      }
      this.userPreferences.classPreferences[cls.name].count++;
    });
  }
  
  /**
   * Update import preferences
   */
  updateImportPreferences(analysis) {
    if (!this.userPreferences.importPreferences) {
      this.userPreferences.importPreferences = {};
    }
    
    analysis.modules.imports.forEach(imp => {
      if (imp.source) {
        if (!this.userPreferences.importPreferences[imp.source]) {
          this.userPreferences.importPreferences[imp.source] = {
            count: 0,
            isDefault: imp.isDefault,
            isNamed: imp.isNamed,
            isNamespace: imp.isNamespace
          };
        }
        this.userPreferences.importPreferences[imp.source].count++;
      }
    });
  }
  
  /**
   * Analyze source code with enhanced features
   */
  async analyzeSource(source, language = 'JavaScript', options = {}) {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(source, language, options);
      if (this.config.enableCaching && this.patternCache.has(cacheKey)) {
        const cached = this.patternCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes
          return cached.result;
        }
      }
      
      // Perform analysis
      const analysis = this.astGrepService.analyzeSource(source, language);
      
      if (!analysis) {
        throw new Error('Analysis failed');
      }
      
      // Enhance with integration features
      const enhancedAnalysis = await this.enhanceAnalysis(analysis, options);
      
      // Cache the result
      if (this.config.enableCaching) {
        this.patternCache.set(cacheKey, {
          result: enhancedAnalysis,
          timestamp: Date.now()
        });
      }
      
      return enhancedAnalysis;
      
    } catch (error) {
      console.error('Error in source analysis:', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Enhance analysis with integration features
   */
  async enhanceAnalysis(analysis, options = {}) {
    const enhanced = {
      ...analysis,
      integration: {
        userPreferences: this.userPreferences,
        recommendations: this.generateRecommendations(analysis),
        relatedPatterns: this.findRelatedPatterns(analysis),
        complexityAnalysis: this.analyzeComplexity(analysis),
        patternMatching: this.performPatternMatching(analysis),
        learningInsights: this.getLearningInsights(analysis)
      }
    };
    
    return enhanced;
  }
  
  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    // Function recommendations
    if (analysis.functions.length > 0) {
      const asyncFunctions = analysis.functions.filter(f => f.isAsync);
      if (asyncFunctions.length > 0) {
        recommendations.push({
          type: 'function',
          category: 'async',
          message: `Found ${asyncFunctions.length} async functions. Consider using Promise.all() for parallel execution.`,
          confidence: 0.8
        });
      }
      
      const arrowFunctions = analysis.functions.filter(f => f.isArrow);
      if (arrowFunctions.length > analysis.functions.length * 0.7) {
        recommendations.push({
          type: 'function',
          category: 'style',
          message: 'Most functions are arrow functions. Consider using regular functions for better readability.',
          confidence: 0.6
        });
      }
    }
    
    // Class recommendations
    if (analysis.classes.length > 0) {
      const classesWithManyMethods = analysis.classes.filter(c => c.methods.length > 10);
      if (classesWithManyMethods.length > 0) {
        recommendations.push({
          type: 'class',
          category: 'design',
          message: 'Some classes have many methods. Consider breaking them into smaller classes.',
          confidence: 0.7
        });
      }
    }
    
    // Import recommendations
    if (analysis.modules.imports.length > 0) {
      const duplicateImports = this.findDuplicateImports(analysis.modules.imports);
      if (duplicateImports.length > 0) {
        recommendations.push({
          type: 'import',
          category: 'optimization',
          message: `Found ${duplicateImports.length} duplicate imports. Consider consolidating them.`,
          confidence: 0.9
        });
      }
    }
    
    return recommendations;
  }
  
  /**
   * Find related patterns from history
   */
  findRelatedPatterns(analysis) {
    const relatedPatterns = [];
    
    // Find similar analyses in history
    for (const historicalAnalysis of this.analysisHistory.slice(-20)) {
      if (historicalAnalysis.language === analysis.language) {
        const similarity = this.calculateSimilarity(analysis, historicalAnalysis);
        if (similarity > 0.5) {
          relatedPatterns.push({
            timestamp: historicalAnalysis.timestamp,
            similarity: similarity,
            functions: historicalAnalysis.functions.length,
            classes: historicalAnalysis.classes.length,
            imports: historicalAnalysis.modules.imports.length
          });
        }
      }
    }
    
    return relatedPatterns.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }
  
  /**
   * Calculate similarity between analyses
   */
  calculateSimilarity(analysis1, analysis2) {
    let similarity = 0;
    let totalWeight = 0;
    
    // Function similarity
    const funcSimilarity = this.calculateFunctionSimilarity(analysis1.functions, analysis2.functions);
    similarity += funcSimilarity * 0.4;
    totalWeight += 0.4;
    
    // Class similarity
    const classSimilarity = this.calculateClassSimilarity(analysis1.classes, analysis2.classes);
    similarity += classSimilarity * 0.3;
    totalWeight += 0.3;
    
    // Import similarity
    const importSimilarity = this.calculateImportSimilarity(analysis1.modules.imports, analysis2.modules.imports);
    similarity += importSimilarity * 0.3;
    totalWeight += 0.3;
    
    return totalWeight > 0 ? similarity / totalWeight : 0;
  }
  
  /**
   * Calculate function similarity
   */
  calculateFunctionSimilarity(functions1, functions2) {
    if (functions1.length === 0 && functions2.length === 0) return 1;
    if (functions1.length === 0 || functions2.length === 0) return 0;
    
    const names1 = new Set(functions1.map(f => f.name));
    const names2 = new Set(functions2.map(f => f.name));
    
    const intersection = new Set([...names1].filter(x => names2.has(x)));
    const union = new Set([...names1, ...names2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Calculate class similarity
   */
  calculateClassSimilarity(classes1, classes2) {
    if (classes1.length === 0 && classes2.length === 0) return 1;
    if (classes1.length === 0 || classes2.length === 0) return 0;
    
    const names1 = new Set(classes1.map(c => c.name));
    const names2 = new Set(classes2.map(c => c.name));
    
    const intersection = new Set([...names1].filter(x => names2.has(x)));
    const union = new Set([...names1, ...names2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Calculate import similarity
   */
  calculateImportSimilarity(imports1, imports2) {
    if (imports1.length === 0 && imports2.length === 0) return 1;
    if (imports1.length === 0 || imports2.length === 0) return 0;
    
    const sources1 = new Set(imports1.map(i => i.source).filter(Boolean));
    const sources2 = new Set(imports2.map(i => i.source).filter(Boolean));
    
    const intersection = new Set([...sources1].filter(x => sources2.has(x)));
    const union = new Set([...sources1, ...sources2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Analyze code complexity
   */
  analyzeComplexity(analysis) {
    const complexity = {
      functionComplexity: 0,
      classComplexity: 0,
      importComplexity: 0,
      overallComplexity: 0
    };
    
    // Function complexity
    if (analysis.functions.length > 0) {
      const avgParams = analysis.functions.reduce((sum, f) => sum + f.parameters.length, 0) / analysis.functions.length;
      const asyncRatio = analysis.functions.filter(f => f.isAsync).length / analysis.functions.length;
      complexity.functionComplexity = (avgParams * 0.5) + (asyncRatio * 0.5);
    }
    
    // Class complexity
    if (analysis.classes.length > 0) {
      const avgMethods = analysis.classes.reduce((sum, c) => sum + c.methods.length, 0) / analysis.classes.length;
      const inheritanceRatio = analysis.classes.filter(c => c.parent).length / analysis.classes.length;
      complexity.classComplexity = (avgMethods * 0.3) + (inheritanceRatio * 0.7);
    }
    
    // Import complexity
    if (analysis.modules.imports.length > 0) {
      const namespaceImports = analysis.modules.imports.filter(i => i.isNamespace).length;
      const namedImports = analysis.modules.imports.filter(i => i.isNamed).length;
      complexity.importComplexity = (namespaceImports * 0.6) + (namedImports * 0.4);
    }
    
    // Overall complexity
    complexity.overallComplexity = (
      complexity.functionComplexity * 0.4 +
      complexity.classComplexity * 0.3 +
      complexity.importComplexity * 0.3
    );
    
    return complexity;
  }
  
  /**
   * Perform pattern matching
   */
  performPatternMatching(analysis) {
    const patterns = this.configuration.patternMatching || {};
    const matches = {};
    
    // Data science patterns
    if (patterns.dataScience) {
      matches.dataScience = this.matchDataSciencePatterns(analysis);
    }
    
    // Web development patterns
    if (patterns.webDevelopment) {
      matches.webDevelopment = this.matchWebDevelopmentPatterns(analysis);
    }
    
    // Testing patterns
    if (patterns.testing) {
      matches.testing = this.matchTestingPatterns(analysis);
    }
    
    return matches;
  }
  
  /**
   * Match data science patterns
   */
  matchDataSciencePatterns(analysis) {
    const dataScienceLibraries = ['pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'sklearn'];
    const matches = [];
    
    analysis.modules.imports.forEach(imp => {
      if (imp.source && dataScienceLibraries.some(lib => imp.source.includes(lib))) {
        matches.push({
          type: 'library',
          name: imp.source,
          confidence: 0.9
        });
      }
    });
    
    return matches;
  }
  
  /**
   * Match web development patterns
   */
  matchWebDevelopmentPatterns(analysis) {
    const webFrameworks = ['react', 'vue', 'angular', 'express', 'fastapi', 'django'];
    const matches = [];
    
    analysis.modules.imports.forEach(imp => {
      if (imp.source && webFrameworks.some(framework => imp.source.includes(framework))) {
        matches.push({
          type: 'framework',
          name: imp.source,
          confidence: 0.9
        });
      }
    });
    
    return matches;
  }
  
  /**
   * Match testing patterns
   */
  matchTestingPatterns(analysis) {
    const testingFrameworks = ['jest', 'mocha', 'pytest', 'unittest', 'jasmine'];
    const matches = [];
    
    analysis.modules.imports.forEach(imp => {
      if (imp.source && testingFrameworks.some(framework => imp.source.includes(framework))) {
        matches.push({
          type: 'testing',
          name: imp.source,
          confidence: 0.9
        });
      }
    });
    
    return matches;
  }
  
  /**
   * Get learning insights
   */
  getLearningInsights(analysis) {
    const insights = {
      totalAnalyses: this.analysisHistory.length,
      languageDistribution: {},
      functionPatterns: {},
      classPatterns: {},
      importPatterns: {}
    };
    
    // Calculate language distribution
    this.analysisHistory.forEach(hist => {
      insights.languageDistribution[hist.language] = 
        (insights.languageDistribution[hist.language] || 0) + 1;
    });
    
    // Calculate function patterns
    this.analysisHistory.forEach(hist => {
      hist.functions.forEach(func => {
        const key = `${func.name}_${func.parameters.length}`;
        insights.functionPatterns[key] = (insights.functionPatterns[key] || 0) + 1;
      });
    });
    
    // Calculate class patterns
    this.analysisHistory.forEach(hist => {
      hist.classes.forEach(cls => {
        insights.classPatterns[cls.name] = (insights.classPatterns[cls.name] || 0) + 1;
      });
    });
    
    // Calculate import patterns
    this.analysisHistory.forEach(hist => {
      hist.modules.imports.forEach(imp => {
        if (imp.source) {
          insights.importPatterns[imp.source] = (insights.importPatterns[imp.source] || 0) + 1;
        }
      });
    });
    
    return insights;
  }
  
  /**
   * Find duplicate imports
   */
  findDuplicateImports(imports) {
    const duplicates = [];
    const seen = new Map();
    
    imports.forEach(imp => {
      if (imp.source) {
        if (seen.has(imp.source)) {
          duplicates.push(imp);
        } else {
          seen.set(imp.source, imp);
        }
      }
    });
    
    return duplicates;
  }
  
  /**
   * Generate cache key
   */
  generateCacheKey(source, language, options) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(source + language + JSON.stringify(options));
    return hash.digest('hex');
  }
  
  /**
   * Get analysis summary
   */
  getAnalysisSummary() {
    if (this.analysisHistory.length === 0) {
      return { message: 'No analysis data available' };
    }
    
    const totalAnalyses = this.analysisHistory.length;
    const languageCounts = {};
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalImports = 0;
    
    this.analysisHistory.forEach(analysis => {
      const lang = analysis.language;
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      totalFunctions += analysis.functions.length;
      totalClasses += analysis.classes.length;
      totalImports += analysis.modules.imports.length;
    });
    
    return {
      totalAnalyses,
      languageDistribution: languageCounts,
      totalFunctions,
      totalClasses,
      totalImports,
      averageFunctionsPerAnalysis: totalFunctions / totalAnalyses,
      averageClassesPerAnalysis: totalClasses / totalAnalyses,
      userPreferences: this.userPreferences,
      recentAnalyses: this.analysisHistory.slice(-10)
    };
  }
  
  /**
   * Clear cache and history
   */
  clearCache() {
    this.patternCache.clear();
    this.analysisHistory = [];
    this.emit('cacheCleared');
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: true,
      config: this.config,
      analysisCount: this.analysisHistory.length,
      cacheSize: this.patternCache.size,
      userPreferences: this.userPreferences,
      astGrepService: this.astGrepService.getStatus()
    };
  }
}

// Export the integration
module.exports = ASTGrepIntegration;

// Example usage
if (require.main === module) {
  async function testIntegration() {
    const integration = new ASTGrepIntegration();
    
    // Wait for initialization
    await new Promise(resolve => {
      integration.on('initialized', resolve);
      integration.on('error', (error) => {
        console.error('Initialization failed:', error);
        process.exit(1);
      });
    });
    
    // Test code analysis
    const testCode = `
import { parse, Lang } from '@ast-grep/napi';
import fs from 'fs';

class ASTGrepService {
  constructor(config = {}) {
    this.config = config;
  }
  
  async parseSource(source, language = 'JavaScript') {
    const lang = this.getLanguageEnum(language);
    return parse(lang, source);
  }
  
  extractFunctions(source, language = 'JavaScript') {
    const ast = this.parseSource(source, language);
    const root = ast.root();
    return root.findAll('function $NAME($$$PARAMS) {$$$}');
  }
}

export default ASTGrepService;
`;

    try {
      console.log('Testing AST-Grep Integration...');
      
      // Analyze the code
      const result = await integration.analyzeSource(testCode, 'JavaScript');
      
      console.log('Enhanced Analysis Result:');
      console.log(`Functions found: ${result.functions.length}`);
      console.log(`Classes found: ${result.classes.length}`);
      console.log(`Imports found: ${result.modules.imports.length}`);
      console.log(`Recommendations: ${result.integration.recommendations.length}`);
      console.log(`Related patterns: ${result.integration.relatedPatterns.length}`);
      
      // Show recommendations
      result.integration.recommendations.forEach((rec, index) => {
        console.log(`\nRecommendation ${index + 1}:`);
        console.log(`  Type: ${rec.type}`);
        console.log(`  Category: ${rec.category}`);
        console.log(`  Message: ${rec.message}`);
        console.log(`  Confidence: ${rec.confidence}`);
      });
      
      // Get summary
      const summary = integration.getAnalysisSummary();
      console.log('\nAnalysis Summary:', summary);
      
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
  
  testIntegration();
}
