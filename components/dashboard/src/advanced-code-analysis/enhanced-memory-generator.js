/**
 * Enhanced Memory Generator - Shadow-inspired Memory System
 * 
 * This module provides advanced memory generation capabilities inspired by Shadow's
 * hierarchical summarization approach for creating intelligent, executable memories.
 * 
 * Features:
 * - Hierarchical memory generation
 * - Context-aware memory creation
 * - Executable memory artifacts
 * - Memory relationship mapping
 * - Integration with existing cursor-telemetry system
 */

const { EventEmitter } = require('events');

class EnhancedMemoryGenerator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      enableHierarchicalGeneration: true,
      enableContextualMemory: true,
      enableExecutableMemories: true,
      enableMemoryRelationships: true,
      maxMemorySize: 10000, // 10KB
      memoryLevels: ['session', 'file', 'function', 'concept'],
      ...options
    };
    
    this.memoryCache = new Map();
    this.memoryRelationships = new Map();
    this.contextCache = new Map();
    this.generationHistory = [];
    
    console.log('🧠 Enhanced Memory Generator initialized');
  }
  
  /**
   * Generate hierarchical memories from session data
   */
  async generateMemories(sessionData, options = {}) {
    try {
      const startTime = Date.now();
      
      // Generate memories at different levels
      const memories = {
        session: await this.generateSessionMemory(sessionData),
        files: await this.generateFileMemories(sessionData),
        functions: await this.generateFunctionMemories(sessionData),
        concepts: await this.generateConceptMemories(sessionData),
        relationships: await this.generateMemoryRelationships(sessionData),
        metadata: {
          generatedAt: new Date().toISOString(),
          sessionId: sessionData.sessionId,
          generationTime: Date.now() - startTime,
          totalMemories: 0
        }
      };
      
      // Calculate total memories
      memories.metadata.totalMemories = 
        (memories.session ? 1 : 0) +
        memories.files.length +
        memories.functions.length +
        memories.concepts.length;
      
      // Cache memories
      this.memoryCache.set(sessionData.sessionId, memories);
      
      // Store generation history
      this.generationHistory.push({
        sessionId: sessionData.sessionId,
        timestamp: Date.now(),
        totalMemories: memories.metadata.totalMemories,
        generationTime: memories.metadata.generationTime
      });
      
      this.emit('memoriesGenerated', { sessionId: sessionData.sessionId, memories });
      
      return memories;
      
    } catch (error) {
      console.error(`Error generating memories for session ${sessionData.sessionId}:`, error);
      this.emit('memoryGenerationError', { sessionId: sessionData.sessionId, error });
      throw error;
    }
  }
  
  /**
   * Generate session-level memory
   */
  async generateSessionMemory(sessionData) {
    const sessionMemory = {
      id: `session_${sessionData.sessionId}`,
      type: 'session',
      level: 'session',
      title: this.generateSessionTitle(sessionData),
      summary: this.generateSessionSummary(sessionData),
      content: this.generateSessionContent(sessionData),
      context: this.extractSessionContext(sessionData),
      patterns: this.identifySessionPatterns(sessionData),
      insights: this.generateSessionInsights(sessionData),
      actions: this.generateSessionActions(sessionData),
      metadata: {
        sessionId: sessionData.sessionId,
        duration: sessionData.duration || 0,
        fileCount: sessionData.files?.length || 0,
        changeCount: sessionData.changes?.length || 0,
        complexity: this.calculateSessionComplexity(sessionData),
        generatedAt: new Date().toISOString()
      }
    };
    
    return sessionMemory;
  }
  
  /**
   * Generate session title
   */
  generateSessionTitle(sessionData) {
    const patterns = this.identifySessionPatterns(sessionData);
    const mainPattern = patterns[0] || 'general';
    
    const titles = {
      'data_analysis': 'Data Analysis Session',
      'debugging': 'Debugging Session',
      'feature_development': 'Feature Development Session',
      'refactoring': 'Refactoring Session',
      'testing': 'Testing Session',
      'documentation': 'Documentation Session',
      'general': 'Development Session'
    };
    
    return titles[mainPattern] || 'Development Session';
  }
  
  /**
   * Generate session summary
   */
  generateSessionSummary(sessionData) {
    const fileCount = sessionData.files?.length || 0;
    const changeCount = sessionData.changes?.length || 0;
    const duration = sessionData.duration || 0;
    
    return {
      overview: `Session involved ${fileCount} files with ${changeCount} changes over ${duration} minutes.`,
      mainActivities: this.identifyMainActivities(sessionData),
      keyFiles: this.identifyKeyFiles(sessionData),
      complexity: this.calculateSessionComplexity(sessionData)
    };
  }
  
  /**
   * Generate session content
   */
  generateSessionContent(sessionData) {
    const content = {
      description: this.generateSessionDescription(sessionData),
      workflow: this.generateWorkflowDescription(sessionData),
      decisions: this.identifyKeyDecisions(sessionData),
      challenges: this.identifyChallenges(sessionData),
      solutions: this.identifySolutions(sessionData),
      outcomes: this.identifyOutcomes(sessionData)
    };
    
    return content;
  }
  
  /**
   * Extract session context
   */
  extractSessionContext(sessionData) {
    return {
      environment: sessionData.environment || {},
      tools: sessionData.tools || [],
      languages: sessionData.languages || [],
      frameworks: sessionData.frameworks || [],
      dependencies: sessionData.dependencies || [],
      configuration: sessionData.configuration || {}
    };
  }
  
  /**
   * Identify session patterns
   */
  identifySessionPatterns(sessionData) {
    const patterns = [];
    
    // Analyze session data for patterns
    if (sessionData.changes?.some(c => c.type === 'data_analysis')) {
      patterns.push('data_analysis');
    }
    
    if (sessionData.changes?.some(c => c.type === 'debugging')) {
      patterns.push('debugging');
    }
    
    if (sessionData.changes?.some(c => c.type === 'feature_development')) {
      patterns.push('feature_development');
    }
    
    if (sessionData.changes?.some(c => c.type === 'refactoring')) {
      patterns.push('refactoring');
    }
    
    if (sessionData.changes?.some(c => c.type === 'testing')) {
      patterns.push('testing');
    }
    
    if (sessionData.changes?.some(c => c.type === 'documentation')) {
      patterns.push('documentation');
    }
    
    return patterns.length > 0 ? patterns : ['general'];
  }
  
  /**
   * Generate session insights
   */
  generateSessionInsights(sessionData) {
    const insights = [];
    
    // Analyze session for insights
    const complexity = this.calculateSessionComplexity(sessionData);
    if (complexity > 0.7) {
      insights.push({
        type: 'complexity',
        message: 'Session involved high complexity tasks',
        recommendation: 'Consider breaking down complex tasks into smaller steps'
      });
    }
    
    const fileCount = sessionData.files?.length || 0;
    if (fileCount > 10) {
      insights.push({
        type: 'scope',
        message: 'Session involved many files',
        recommendation: 'Consider focusing on fewer files for better concentration'
      });
    }
    
    const changeCount = sessionData.changes?.length || 0;
    if (changeCount > 50) {
      insights.push({
        type: 'activity',
        message: 'Session had high activity level',
        recommendation: 'Consider taking breaks to maintain focus'
      });
    }
    
    return insights;
  }
  
  /**
   * Generate session actions
   */
  generateSessionActions(sessionData) {
    const actions = [];
    
    // Generate executable actions based on session data
    if (sessionData.files?.length > 0) {
      actions.push({
        type: 'file_restoration',
        description: 'Restore file states from session',
        executable: true,
        parameters: {
          files: sessionData.files.map(f => f.path)
        }
      });
    }
    
    if (sessionData.changes?.length > 0) {
      actions.push({
        type: 'change_replay',
        description: 'Replay changes from session',
        executable: true,
        parameters: {
          changes: sessionData.changes
        }
      });
    }
    
    if (sessionData.context?.length > 0) {
      actions.push({
        type: 'context_restoration',
        description: 'Restore development context',
        executable: true,
        parameters: {
          context: sessionData.context
        }
      });
    }
    
    return actions;
  }
  
  /**
   * Calculate session complexity
   */
  calculateSessionComplexity(sessionData) {
    let complexity = 0;
    
    // Factor in number of files
    const fileCount = sessionData.files?.length || 0;
    complexity += fileCount * 0.1;
    
    // Factor in number of changes
    const changeCount = sessionData.changes?.length || 0;
    complexity += changeCount * 0.05;
    
    // Factor in session duration
    const duration = sessionData.duration || 0;
    complexity += duration * 0.01;
    
    // Normalize to 0-1 range
    return Math.min(complexity, 1.0);
  }
  
  /**
   * Generate file-level memories
   */
  async generateFileMemories(sessionData) {
    const fileMemories = [];
    
    if (sessionData.files) {
      for (const file of sessionData.files) {
        const fileMemory = {
          id: `file_${file.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'file',
          level: 'file',
          title: this.generateFileTitle(file),
          summary: this.generateFileSummary(file),
          content: this.generateFileContent(file),
          context: this.extractFileContext(file),
          patterns: this.identifyFilePatterns(file),
          insights: this.generateFileInsights(file),
          actions: this.generateFileActions(file),
          metadata: {
            filePath: file.path,
            size: file.size || 0,
            lines: file.lines || 0,
            complexity: file.complexity || 0,
            generatedAt: new Date().toISOString()
          }
        };
        
        fileMemories.push(fileMemory);
      }
    }
    
    return fileMemories;
  }
  
  /**
   * Generate file title
   */
  generateFileTitle(file) {
    const name = file.name || file.path.split('/').pop();
    const purpose = this.inferFilePurpose(file);
    
    return `${name} - ${purpose}`;
  }
  
  /**
   * Generate file summary
   */
  generateFileSummary(file) {
    return {
      overview: `File ${file.name} with ${file.lines || 0} lines and complexity ${file.complexity || 0}.`,
      purpose: this.inferFilePurpose(file),
      keyFeatures: this.identifyKeyFeatures(file),
      relationships: this.identifyFileRelationships(file)
    };
  }
  
  /**
   * Generate file content
   */
  generateFileContent(file) {
    return {
      description: this.generateFileDescription(file),
      structure: this.analyzeFileStructure(file),
      patterns: this.identifyFilePatterns(file),
      dependencies: this.identifyFileDependencies(file),
      usage: this.identifyFileUsage(file)
    };
  }
  
  /**
   * Extract file context
   */
  extractFileContext(file) {
    return {
      language: file.language || 'unknown',
      framework: file.framework || null,
      dependencies: file.dependencies || [],
      imports: file.imports || [],
      exports: file.exports || []
    };
  }
  
  /**
   * Identify file patterns
   */
  identifyFilePatterns(file) {
    const patterns = [];
    const content = file.content || '';
    
    if (content.includes('class ')) patterns.push('object-oriented');
    if (content.includes('function ')) patterns.push('functional');
    if (content.includes('async ')) patterns.push('asynchronous');
    if (content.includes('export ')) patterns.push('modular');
    if (content.includes('import ')) patterns.push('imported');
    
    return patterns;
  }
  
  /**
   * Generate file insights
   */
  generateFileInsights(file) {
    const insights = [];
    
    if (file.complexity > 20) {
      insights.push({
        type: 'complexity',
        message: 'File has high complexity',
        recommendation: 'Consider refactoring to reduce complexity'
      });
    }
    
    if (file.size > 100000) { // 100KB
      insights.push({
        type: 'size',
        message: 'File is large',
        recommendation: 'Consider splitting into smaller files'
      });
    }
    
    if (!file.content?.includes('/*') && !file.content?.includes('//')) {
      insights.push({
        type: 'documentation',
        message: 'File lacks documentation',
        recommendation: 'Consider adding comments and documentation'
      });
    }
    
    return insights;
  }
  
  /**
   * Generate file actions
   */
  generateFileActions(file) {
    const actions = [];
    
    actions.push({
      type: 'file_restoration',
      description: 'Restore file to session state',
      executable: true,
      parameters: {
        filePath: file.path,
        content: file.content
      }
    });
    
    if (file.dependencies?.length > 0) {
      actions.push({
        type: 'dependency_restoration',
        description: 'Restore file dependencies',
        executable: true,
        parameters: {
          dependencies: file.dependencies
        }
      });
    }
    
    return actions;
  }
  
  /**
   * Generate function-level memories
   */
  async generateFunctionMemories(sessionData) {
    const functionMemories = [];
    
    if (sessionData.functions) {
      for (const func of sessionData.functions) {
        const functionMemory = {
          id: `function_${func.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          type: 'function',
          level: 'function',
          title: this.generateFunctionTitle(func),
          summary: this.generateFunctionSummary(func),
          content: this.generateFunctionContent(func),
          context: this.extractFunctionContext(func),
          patterns: this.identifyFunctionPatterns(func),
          insights: this.generateFunctionInsights(func),
          actions: this.generateFunctionActions(func),
          metadata: {
            functionName: func.name,
            filePath: func.filePath,
            lineNumber: func.lineNumber,
            complexity: func.complexity || 0,
            generatedAt: new Date().toISOString()
          }
        };
        
        functionMemories.push(functionMemory);
      }
    }
    
    return functionMemories;
  }
  
  /**
   * Generate function title
   */
  generateFunctionTitle(func) {
    return `Function: ${func.name}`;
  }
  
  /**
   * Generate function summary
   */
  generateFunctionSummary(func) {
    return {
      overview: `Function ${func.name} with complexity ${func.complexity || 0}.`,
      purpose: this.inferFunctionPurpose(func),
      parameters: func.parameters || [],
      returnType: func.returnType || 'unknown',
      complexity: func.complexity || 0
    };
  }
  
  /**
   * Generate function content
   */
  generateFunctionContent(func) {
    return {
      description: this.generateFunctionDescription(func),
      implementation: func.implementation || '',
      parameters: func.parameters || [],
      returnValue: func.returnValue || null,
      usage: this.identifyFunctionUsage(func)
    };
  }
  
  /**
   * Extract function context
   */
  extractFunctionContext(func) {
    return {
      filePath: func.filePath,
      lineNumber: func.lineNumber,
      language: func.language || 'unknown',
      scope: func.scope || 'global',
      visibility: func.visibility || 'public'
    };
  }
  
  /**
   * Identify function patterns
   */
  identifyFunctionPatterns(func) {
    const patterns = [];
    const implementation = func.implementation || '';
    
    if (implementation.includes('async ')) patterns.push('asynchronous');
    if (implementation.includes('return ')) patterns.push('returning');
    if (implementation.includes('throw ')) patterns.push('error-handling');
    if (implementation.includes('try ')) patterns.push('error-handling');
    if (implementation.includes('callback')) patterns.push('callback-based');
    if (implementation.includes('Promise')) patterns.push('promise-based');
    
    return patterns;
  }
  
  /**
   * Generate function insights
   */
  generateFunctionInsights(func) {
    const insights = [];
    
    if (func.complexity > 10) {
      insights.push({
        type: 'complexity',
        message: 'Function has high complexity',
        recommendation: 'Consider refactoring to reduce complexity'
      });
    }
    
    if (func.parameters?.length > 5) {
      insights.push({
        type: 'parameters',
        message: 'Function has many parameters',
        recommendation: 'Consider using an options object or destructuring'
      });
    }
    
    if (!func.implementation?.includes('/*') && !func.implementation?.includes('//')) {
      insights.push({
        type: 'documentation',
        message: 'Function lacks documentation',
        recommendation: 'Consider adding JSDoc or similar documentation'
      });
    }
    
    return insights;
  }
  
  /**
   * Generate function actions
   */
  generateFunctionActions(func) {
    const actions = [];
    
    actions.push({
      type: 'function_restoration',
      description: 'Restore function to session state',
      executable: true,
      parameters: {
        functionName: func.name,
        filePath: func.filePath,
        implementation: func.implementation
      }
    });
    
    if (func.dependencies?.length > 0) {
      actions.push({
        type: 'dependency_restoration',
        description: 'Restore function dependencies',
        executable: true,
        parameters: {
          dependencies: func.dependencies
        }
      });
    }
    
    return actions;
  }
  
  /**
   * Generate concept-level memories
   */
  async generateConceptMemories(sessionData) {
    const conceptMemories = [];
    
    // Extract concepts from session data
    const concepts = this.extractConcepts(sessionData);
    
    for (const concept of concepts) {
      const conceptMemory = {
        id: `concept_${concept.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        type: 'concept',
        level: 'concept',
        title: this.generateConceptTitle(concept),
        summary: this.generateConceptSummary(concept),
        content: this.generateConceptContent(concept),
        context: this.extractConceptContext(concept),
        patterns: this.identifyConceptPatterns(concept),
        insights: this.generateConceptInsights(concept),
        actions: this.generateConceptActions(concept),
        metadata: {
          conceptName: concept.name,
          category: concept.category,
          complexity: concept.complexity || 0,
          generatedAt: new Date().toISOString()
        }
      };
      
      conceptMemories.push(conceptMemory);
    }
    
    return conceptMemories;
  }
  
  /**
   * Extract concepts from session data
   */
  extractConcepts(sessionData) {
    const concepts = [];
    
    // Extract concepts from files
    if (sessionData.files) {
      sessionData.files.forEach(file => {
        const fileConcepts = this.extractFileConcepts(file);
        concepts.push(...fileConcepts);
      });
    }
    
    // Extract concepts from changes
    if (sessionData.changes) {
      sessionData.changes.forEach(change => {
        const changeConcepts = this.extractChangeConcepts(change);
        concepts.push(...changeConcepts);
      });
    }
    
    return concepts;
  }
  
  /**
   * Extract concepts from file
   */
  extractFileConcepts(file) {
    const concepts = [];
    const content = file.content || '';
    
    // Extract domain concepts
    const domainConcepts = this.extractDomainConcepts(content);
    concepts.push(...domainConcepts);
    
    // Extract technical concepts
    const technicalConcepts = this.extractTechnicalConcepts(content);
    concepts.push(...technicalConcepts);
    
    return concepts;
  }
  
  /**
   * Extract domain concepts
   */
  extractDomainConcepts(content) {
    const concepts = [];
    
    // Look for domain-specific terms
    const domainTerms = [
      'user', 'customer', 'order', 'product', 'payment', 'invoice',
      'authentication', 'authorization', 'session', 'token',
      'database', 'query', 'mutation', 'subscription',
      'api', 'endpoint', 'request', 'response'
    ];
    
    domainTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        concepts.push({
          name: term,
          category: 'domain',
          complexity: 0.5
        });
      }
    });
    
    return concepts;
  }
  
  /**
   * Extract technical concepts
   */
  extractTechnicalConcepts(content) {
    const concepts = [];
    
    // Look for technical terms
    const technicalTerms = [
      'async', 'await', 'promise', 'callback', 'generator',
      'class', 'inheritance', 'polymorphism', 'encapsulation',
      'function', 'closure', 'scope', 'hoisting',
      'module', 'import', 'export', 'namespace'
    ];
    
    technicalTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        concepts.push({
          name: term,
          category: 'technical',
          complexity: 0.7
        });
      }
    });
    
    return concepts;
  }
  
  /**
   * Extract concepts from change
   */
  extractChangeConcepts(change) {
    const concepts = [];
    
    // Analyze change type for concepts
    if (change.type === 'data_analysis') {
      concepts.push({
        name: 'data_analysis',
        category: 'process',
        complexity: 0.6
      });
    }
    
    if (change.type === 'debugging') {
      concepts.push({
        name: 'debugging',
        category: 'process',
        complexity: 0.4
      });
    }
    
    if (change.type === 'refactoring') {
      concepts.push({
        name: 'refactoring',
        category: 'process',
        complexity: 0.8
      });
    }
    
    return concepts;
  }
  
  /**
   * Generate concept title
   */
  generateConceptTitle(concept) {
    return `Concept: ${concept.name}`;
  }
  
  /**
   * Generate concept summary
   */
  generateConceptSummary(concept) {
    return {
      overview: `Concept ${concept.name} in category ${concept.category}.`,
      category: concept.category,
      complexity: concept.complexity,
      relevance: this.calculateConceptRelevance(concept)
    };
  }
  
  /**
   * Generate concept content
   */
  generateConceptContent(concept) {
    return {
      description: this.generateConceptDescription(concept),
      examples: this.generateConceptExamples(concept),
      patterns: this.identifyConceptPatterns(concept),
      relationships: this.identifyConceptRelationships(concept)
    };
  }
  
  /**
   * Extract concept context
   */
  extractConceptContext(concept) {
    return {
      category: concept.category,
      complexity: concept.complexity,
      relevance: this.calculateConceptRelevance(concept),
      usage: this.identifyConceptUsage(concept)
    };
  }
  
  /**
   * Identify concept patterns
   */
  identifyConceptPatterns(concept) {
    const patterns = [];
    
    if (concept.category === 'domain') {
      patterns.push('business-logic');
    }
    
    if (concept.category === 'technical') {
      patterns.push('implementation');
    }
    
    if (concept.category === 'process') {
      patterns.push('workflow');
    }
    
    return patterns;
  }
  
  /**
   * Generate concept insights
   */
  generateConceptInsights(concept) {
    const insights = [];
    
    if (concept.complexity > 0.7) {
      insights.push({
        type: 'complexity',
        message: 'Concept has high complexity',
        recommendation: 'Consider breaking down into simpler concepts'
      });
    }
    
    if (concept.relevance < 0.3) {
      insights.push({
        type: 'relevance',
        message: 'Concept has low relevance',
        recommendation: 'Consider focusing on more relevant concepts'
      });
    }
    
    return insights;
  }
  
  /**
   * Generate concept actions
   */
  generateConceptActions(concept) {
    const actions = [];
    
    actions.push({
      type: 'concept_application',
      description: 'Apply concept in new context',
      executable: true,
      parameters: {
        conceptName: concept.name,
        context: concept.context
      }
    });
    
    if (concept.examples?.length > 0) {
      actions.push({
        type: 'example_creation',
        description: 'Create new examples of concept',
        executable: true,
        parameters: {
          conceptName: concept.name,
          examples: concept.examples
        }
      });
    }
    
    return actions;
  }
  
  /**
   * Generate memory relationships
   */
  async generateMemoryRelationships(sessionData) {
    const relationships = [];
    
    // Analyze relationships between memories
    const memories = await this.getAllMemories(sessionData);
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const relationship = this.analyzeMemoryRelationship(memories[i], memories[j]);
        if (relationship.strength > 0.3) {
          relationships.push(relationship);
        }
      }
    }
    
    return relationships;
  }
  
  /**
   * Get all memories for a session
   */
  async getAllMemories(sessionData) {
    const memories = [];
    
    // Add session memory
    const sessionMemory = await this.generateSessionMemory(sessionData);
    memories.push(sessionMemory);
    
    // Add file memories
    const fileMemories = await this.generateFileMemories(sessionData);
    memories.push(...fileMemories);
    
    // Add function memories
    const functionMemories = await this.generateFunctionMemories(sessionData);
    memories.push(...functionMemories);
    
    // Add concept memories
    const conceptMemories = await this.generateConceptMemories(sessionData);
    memories.push(...conceptMemories);
    
    return memories;
  }
  
  /**
   * Analyze relationship between two memories
   */
  analyzeMemoryRelationship(memory1, memory2) {
    let strength = 0;
    let type = 'general';
    
    // Check for direct relationships
    if (memory1.type === 'session' && memory2.type === 'file') {
      strength = 0.8;
      type = 'contains';
    }
    
    if (memory1.type === 'file' && memory2.type === 'function') {
      strength = 0.9;
      type = 'contains';
    }
    
    if (memory1.type === 'concept' && memory2.type === 'concept') {
      strength = 0.5;
      type = 'related';
    }
    
    return {
      from: memory1.id,
      to: memory2.id,
      type,
      strength,
      description: `${memory1.title} ${type} ${memory2.title}`
    };
  }
  
  /**
   * Get memories for a specific session
   */
  getMemories(sessionId) {
    return this.memoryCache.get(sessionId) || null;
  }
  
  /**
   * Get generation statistics
   */
  getStats() {
    return {
      cachedMemories: this.memoryCache.size,
      generationHistory: this.generationHistory.length,
      averageGenerationTime: this.generationHistory.length > 0 
        ? this.generationHistory.reduce((sum, h) => sum + h.generationTime, 0) / this.generationHistory.length 
        : 0
    };
  }
  
  /**
   * Clear all data
   */
  clear() {
    this.memoryCache.clear();
    this.memoryRelationships.clear();
    this.contextCache.clear();
    this.generationHistory = [];
    
    console.log('🧹 Enhanced Memory Generator cleared');
  }
}

module.exports = EnhancedMemoryGenerator;

