/**
 * Semantic Search Engine - Shadow-inspired Code Search
 * 
 * This module provides advanced semantic search capabilities inspired by Shadow's
 * sophisticated codebase indexing and retrieval system.
 * 
 * Features:
 * - Vector-based semantic search
 * - Code relationship mapping
 * - Contextual code understanding
 * - Multi-dimensional scoring
 * - Integration with existing cursor-telemetry system
 */

const { EventEmitter } = require('events');

class SemanticSearchEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      embeddingDimensions: 384,
      maxResults: 50,
      similarityThreshold: 0.3,
      enableContextualSearch: true,
      enableRelationshipSearch: true,
      enableSemanticClustering: true,
      ...options
    };
    
    this.embeddings = new Map();
    this.semanticIndex = new Map();
    this.relationshipGraph = new Map();
    this.contextCache = new Map();
    this.searchHistory = [];
    
    console.log(' Semantic Search Engine initialized');
  }
  
  /**
   * Index code content for semantic search
   */
  async indexCode(filePath, codeContent, metadata = {}) {
    try {
      const embedding = await this.generateEmbedding(codeContent);
      const semanticData = {
        filePath,
        content: codeContent,
        embedding,
        metadata: {
          language: metadata.language || 'javascript',
          size: codeContent.length,
          lines: codeContent.split('\n').length,
          timestamp: Date.now(),
          ...metadata
        },
        relationships: [],
        context: this.extractContext(codeContent)
      };
      
      // Store embedding
      this.embeddings.set(filePath, embedding);
      
      // Store semantic data
      this.semanticIndex.set(filePath, semanticData);
      
      // Extract and store relationships
      const relationships = this.extractRelationships(codeContent, filePath);
      relationships.forEach(rel => {
        this.relationshipGraph.set(`${filePath}:${rel.from}:${rel.to}`, rel);
      });
      
      this.emit('indexed', { filePath, metadata: semanticData.metadata });
      
      return semanticData;
      
    } catch (error) {
      console.error(`Error indexing code for ${filePath}:`, error);
      this.emit('indexError', { filePath, error });
      throw error;
    }
  }
  
  /**
   * Generate embedding for code content
   */
  async generateEmbedding(codeContent) {
    // Simplified embedding generation
    // In production, use actual embedding models like OpenAI's text-embedding-ada-002
    const tokens = this.tokenizeCode(codeContent);
    const embedding = new Array(this.options.embeddingDimensions).fill(0);
    
    // Simple bag-of-words approach with TF-IDF-like weighting
    const tokenCounts = this.countTokens(tokens);
    const totalTokens = tokens.length;
    
    Object.entries(tokenCounts).forEach(([token, count]) => {
      const index = this.hashToken(token) % this.options.embeddingDimensions;
      const tf = count / totalTokens;
      const idf = this.calculateIDF(token);
      embedding[index] = tf * idf;
    });
    
    return embedding;
  }
  
  /**
   * Tokenize code content
   */
  tokenizeCode(codeContent) {
    // Remove comments and strings for better tokenization
    const cleaned = codeContent
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/"[^"]*"/g, '') // Remove double-quoted strings
      .replace(/'[^']*'/g, '') // Remove single-quoted strings
      .replace(/`[^`]*`/g, ''); // Remove template literals
    
    // Extract tokens
    const tokens = cleaned
      .split(/[\s\n\r\t\(\)\[\]\{\}\.,;:]/)
      .filter(token => token.length > 0)
      .map(token => token.toLowerCase());
    
    return tokens;
  }
  
  /**
   * Count token frequencies
   */
  countTokens(tokens) {
    const counts = {};
    tokens.forEach(token => {
      counts[token] = (counts[token] || 0) + 1;
    });
    return counts;
  }
  
  /**
   * Hash token to get embedding index
   */
  hashToken(token) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Calculate IDF (Inverse Document Frequency) for a token
   */
  calculateIDF(token) {
    let documentCount = 0;
    let tokenDocumentCount = 0;
    
    this.semanticIndex.forEach(data => {
      documentCount++;
      if (data.content.toLowerCase().includes(token.toLowerCase())) {
        tokenDocumentCount++;
      }
    });
    
    if (tokenDocumentCount === 0) return 0;
    return Math.log(documentCount / tokenDocumentCount);
  }
  
  /**
   * Extract context from code content
   */
  extractContext(codeContent) {
    const context = {
      imports: this.extractImports(codeContent),
      functions: this.extractFunctions(codeContent),
      classes: this.extractClasses(codeContent),
      variables: this.extractVariables(codeContent),
      comments: this.extractComments(codeContent),
      patterns: this.extractPatterns(codeContent)
    };
    
    return context;
  }
  
  /**
   * Extract import statements
   */
  extractImports(codeContent) {
    const imports = [];
    
    // JavaScript/TypeScript imports
    const jsImports = codeContent.match(/import\s+.*?from\s+['"](.*?)['"]/g) || [];
    jsImports.forEach(imp => {
      const source = imp.match(/from\s+['"](.*?)['"]/)?.[1];
      if (source) imports.push({ type: 'import', source, language: 'javascript' });
    });
    
    // Python imports
    const pyImports = codeContent.match(/import\s+(\w+)|from\s+(\w+)\s+import/g) || [];
    pyImports.forEach(imp => {
      const source = imp.replace(/import\s+|from\s+|\s+import/g, '');
      if (source) imports.push({ type: 'import', source, language: 'python' });
    });
    
    return imports;
  }
  
  /**
   * Extract function definitions
   */
  extractFunctions(codeContent) {
    const functions = [];
    
    // JavaScript/TypeScript functions
    const jsFunctions = codeContent.match(/function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?\(/g) || [];
    jsFunctions.forEach(func => {
      const name = func.replace(/function\s+|\s*=\s*(?:async\s+)?\(/, '');
      functions.push({ type: 'function', name, language: 'javascript' });
    });
    
    // Python functions
    const pyFunctions = codeContent.match(/def\s+(\w+)/g) || [];
    pyFunctions.forEach(func => {
      const name = func.replace('def ', '');
      functions.push({ type: 'function', name, language: 'python' });
    });
    
    return functions;
  }
  
  /**
   * Extract class definitions
   */
  extractClasses(codeContent) {
    const classes = [];
    
    // JavaScript/TypeScript classes
    const jsClasses = codeContent.match(/class\s+(\w+)/g) || [];
    jsClasses.forEach(cls => {
      const name = cls.replace('class ', '');
      classes.push({ type: 'class', name, language: 'javascript' });
    });
    
    // Python classes
    const pyClasses = codeContent.match(/class\s+(\w+)/g) || [];
    pyClasses.forEach(cls => {
      const name = cls.replace('class ', '');
      classes.push({ type: 'class', name, language: 'python' });
    });
    
    return classes;
  }
  
  /**
   * Extract variable declarations
   */
  extractVariables(codeContent) {
    const variables = [];
    
    // JavaScript/TypeScript variables
    const jsVars = codeContent.match(/(?:const|let|var)\s+(\w+)/g) || [];
    jsVars.forEach(variable => {
      const name = variable.replace(/(?:const|let|var)\s+/, '');
      variables.push({ type: 'variable', name, language: 'javascript' });
    });
    
    return variables;
  }
  
  /**
   * Extract comments
   */
  extractComments(codeContent) {
    const comments = [];
    
    // Single-line comments
    const singleLineComments = codeContent.match(/\/\/.*$/gm) || [];
    singleLineComments.forEach(comment => {
      comments.push({ type: 'comment', content: comment.trim(), style: 'single-line' });
    });
    
    // Multi-line comments
    const multiLineComments = codeContent.match(/\/\*[\s\S]*?\*\//g) || [];
    multiLineComments.forEach(comment => {
      comments.push({ type: 'comment', content: comment.trim(), style: 'multi-line' });
    });
    
    return comments;
  }
  
  /**
   * Extract code patterns
   */
  extractPatterns(codeContent) {
    const patterns = [];
    
    // Common patterns
    if (codeContent.includes('try:') || codeContent.includes('try {')) {
      patterns.push({ type: 'error-handling', pattern: 'try-catch' });
    }
    
    if (codeContent.includes('async') || codeContent.includes('await')) {
      patterns.push({ type: 'asynchronous', pattern: 'async-await' });
    }
    
    if (codeContent.includes('Promise')) {
      patterns.push({ type: 'asynchronous', pattern: 'promise' });
    }
    
    if (codeContent.includes('callback') || codeContent.includes('cb')) {
      patterns.push({ type: 'asynchronous', pattern: 'callback' });
    }
    
    return patterns;
  }
  
  /**
   * Extract relationships from code
   */
  extractRelationships(codeContent, filePath) {
    const relationships = [];
    
    // Function calls
    const functionCalls = codeContent.match(/(\w+)\s*\(/g) || [];
    functionCalls.forEach(call => {
      const functionName = call.replace(/\s*\(/, '');
      relationships.push({
        type: 'calls',
        from: filePath,
        to: functionName,
        strength: 0.8
      });
    });
    
    // Import relationships
    const imports = this.extractImports(codeContent);
    imports.forEach(imp => {
      relationships.push({
        type: 'imports',
        from: filePath,
        to: imp.source,
        strength: 0.9
      });
    });
    
    return relationships;
  }
  
  /**
   * Perform semantic search
   */
  async search(query, options = {}) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const results = [];
      
      // Search through all indexed content
      this.semanticIndex.forEach((data, filePath) => {
        const similarity = this.calculateSimilarity(queryEmbedding, data.embedding);
        
        if (similarity > (options.threshold || this.options.similarityThreshold)) {
          results.push({
            filePath,
            similarity,
            content: data.content,
            metadata: data.metadata,
            context: data.context,
            relationships: this.getFileRelationships(filePath)
          });
        }
      });
      
      // Sort by similarity
      results.sort((a, b) => b.similarity - a.similarity);
      
      // Limit results
      const maxResults = options.maxResults || this.options.maxResults;
      const limitedResults = results.slice(0, maxResults);
      
      // Store search history
      this.searchHistory.push({
        query,
        results: limitedResults.length,
        timestamp: Date.now()
      });
      
      this.emit('searchComplete', { query, results: limitedResults });
      
      return limitedResults;
      
    } catch (error) {
      console.error('Error performing semantic search:', error);
      this.emit('searchError', { query, error });
      throw error;
    }
  }
  
  /**
   * Calculate similarity between two embeddings
   */
  calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
  
  /**
   * Get relationships for a specific file
   */
  getFileRelationships(filePath) {
    const relationships = [];
    
    this.relationshipGraph.forEach((rel, key) => {
      if (key.startsWith(filePath)) {
        relationships.push(rel);
      }
    });
    
    return relationships;
  }
  
  /**
   * Perform contextual search with relationship awareness
   */
  async contextualSearch(query, context, options = {}) {
    try {
      const baseResults = await this.search(query, options);
      const contextualResults = [];
      
      for (const result of baseResults) {
        // Find related files through relationships
        const relatedFiles = this.findRelatedFiles(result.filePath);
        
        // Calculate contextual score
        const contextualScore = this.calculateContextualScore(result, context, relatedFiles);
        
        contextualResults.push({
          ...result,
          contextualScore,
          relatedFiles,
          contextRelevance: this.assessContextRelevance(result, context)
        });
      }
      
      // Sort by contextual score
      contextualResults.sort((a, b) => b.contextualScore - a.contextualScore);
      
      return contextualResults;
      
    } catch (error) {
      console.error('Error performing contextual search:', error);
      throw error;
    }
  }
  
  /**
   * Find related files through relationship graph
   */
  findRelatedFiles(filePath) {
    const relatedFiles = new Set();
    
    this.relationshipGraph.forEach((rel, key) => {
      if (key.startsWith(filePath)) {
        // Find files that import or are imported by this file
        const otherFiles = this.semanticIndex.keys();
        for (const otherFile of otherFiles) {
          if (otherFile !== filePath && this.hasRelationship(filePath, otherFile)) {
            relatedFiles.add(otherFile);
          }
        }
      }
    });
    
    return Array.from(relatedFiles);
  }
  
  /**
   * Check if two files have a relationship
   */
  hasRelationship(file1, file2) {
    let hasRel = false;
    
    this.relationshipGraph.forEach((rel, key) => {
      if (key.includes(file1) && key.includes(file2)) {
        hasRel = true;
      }
    });
    
    return hasRel;
  }
  
  /**
   * Calculate contextual score for a result
   */
  calculateContextualScore(result, context, relatedFiles) {
    let score = result.similarity;
    
    // Boost score based on context relevance
    if (context.filePath && result.filePath === context.filePath) {
      score += 0.2;
    }
    
    // Boost score based on related files
    if (relatedFiles.length > 0) {
      score += 0.1;
    }
    
    // Boost score based on language match
    if (context.language && result.metadata.language === context.language) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Assess context relevance
   */
  assessContextRelevance(result, context) {
    const relevance = {
      fileMatch: result.filePath === context.filePath,
      languageMatch: result.metadata.language === context.language,
      sizeMatch: Math.abs(result.metadata.size - context.size) < 1000,
      timestampMatch: Math.abs(result.metadata.timestamp - context.timestamp) < 3600000 // 1 hour
    };
    
    return relevance;
  }
  
  /**
   * Perform semantic clustering
   */
  async semanticClustering(options = {}) {
    if (!this.options.enableSemanticClustering) {
      return [];
    }
    
    try {
      const clusters = [];
      const processed = new Set();
      
      this.semanticIndex.forEach((data, filePath) => {
        if (processed.has(filePath)) return;
        
        const cluster = {
          id: `cluster_${clusters.length}`,
          files: [filePath],
          centroid: data.embedding,
          similarity: 1.0
        };
        
        // Find similar files
        this.semanticIndex.forEach((otherData, otherFilePath) => {
          if (otherFilePath === filePath || processed.has(otherFilePath)) return;
          
          const similarity = this.calculateSimilarity(data.embedding, otherData.embedding);
          
          if (similarity > (options.clusterThreshold || 0.7)) {
            cluster.files.push(otherFilePath);
            processed.add(otherFilePath);
          }
        });
        
        if (cluster.files.length > 1) {
          clusters.push(cluster);
          cluster.files.forEach(file => processed.add(file));
        }
      });
      
      return clusters;
      
    } catch (error) {
      console.error('Error performing semantic clustering:', error);
      throw error;
    }
  }
  
  /**
   * Get search statistics
   */
  getStats() {
    return {
      indexedFiles: this.semanticIndex.size,
      embeddings: this.embeddings.size,
      relationships: this.relationshipGraph.size,
      searchHistory: this.searchHistory.length,
      averageResults: this.searchHistory.length > 0 
        ? this.searchHistory.reduce((sum, search) => sum + search.results, 0) / this.searchHistory.length 
        : 0
    };
  }
  
  /**
   * Clear all data
   */
  clear() {
    this.embeddings.clear();
    this.semanticIndex.clear();
    this.relationshipGraph.clear();
    this.contextCache.clear();
    this.searchHistory = [];
    
    console.log(' Semantic Search Engine cleared');
  }
}

module.exports = SemanticSearchEngine;

