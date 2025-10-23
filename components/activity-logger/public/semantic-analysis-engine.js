/**
 * Semantic Analysis Engine
 * Advanced code analysis with AST parsing, embeddings, and pattern detection
 */

class SemanticAnalysisEngine {
  constructor() {
    this.codePatterns = new Map();
    this.fileRelationships = new Map();
    this.embeddings = new Map();
    this.tfidfData = null;
    this.astCache = new Map();
    this.semanticGraph = null;
  }

  /**
   * Analyze code patterns from events
   */
  analyzeCodePatterns(events, entries) {
    const patterns = {
      refactoring: [],
      bugFixes: [],
      features: [],
      documentation: [],
      testing: [],
      configuration: [],
      dependencies: [],
      apiChanges: []
    };

    const allItems = [...events, ...entries];

    allItems.forEach(item => {
      try {
        const details = this.parseDetails(item);
        const fileContent = details.after_code || details.content || '';
        const beforeContent = details.before_code || details.before_content || '';
        const filePath = details.file_path || item.file_path || '';

        if (!fileContent && !beforeContent) return;

        // Detect pattern types
        const pattern = this.detectPattern(fileContent, beforeContent, filePath, item);
        
        if (pattern) {
          patterns[pattern.type].push(pattern);
          this.codePatterns.set(item.id, pattern);
        }
      } catch (error) {
        console.error('Error analyzing pattern:', error);
      }
    });

    return patterns;
  }

  /**
   * Detect specific code patterns
   */
  detectPattern(afterCode, beforeCode, filePath, item) {
    const fileName = filePath.split('/').pop() || '';
    const diff = this.calculateDiff(beforeCode, afterCode);

    // Refactoring detection
    if (this.isRefactoring(afterCode, beforeCode, diff)) {
      return {
        type: 'refactoring',
        file: filePath,
        description: this.getRefactoringDescription(afterCode, beforeCode),
        complexity: this.calculateComplexity(afterCode),
        timestamp: item.timestamp,
        impact: 'medium'
      };
    }

    // Bug fix detection
    if (this.isBugFix(afterCode, beforeCode, filePath)) {
      return {
        type: 'bugFixes',
        file: filePath,
        description: 'Bug fix detected',
        linesChanged: Math.abs(afterCode.length - beforeCode.length),
        timestamp: item.timestamp,
        impact: 'high'
      };
    }

    // Feature addition detection
    if (this.isFeatureAddition(afterCode, beforeCode, diff)) {
      return {
        type: 'features',
        file: filePath,
        description: this.getFeatureDescription(afterCode, beforeCode),
        linesAdded: diff.additions,
        timestamp: item.timestamp,
        impact: 'high'
      };
    }

    // Documentation detection
    if (fileName.includes('README') || fileName.endsWith('.md') || this.hasDocumentationChanges(afterCode, beforeCode)) {
      return {
        type: 'documentation',
        file: filePath,
        description: 'Documentation update',
        timestamp: item.timestamp,
        impact: 'low'
      };
    }

    // Test detection
    if (fileName.includes('test') || fileName.includes('.spec.') || fileName.includes('.test.')) {
      return {
        type: 'testing',
        file: filePath,
        description: 'Test update',
        coverage: this.estimateTestCoverage(afterCode),
        timestamp: item.timestamp,
        impact: 'medium'
      };
    }

    // Configuration detection
    if (fileName.endsWith('.json') || fileName.endsWith('.yaml') || fileName.endsWith('.yml') || fileName.endsWith('.config.js')) {
      return {
        type: 'configuration',
        file: filePath,
        description: 'Configuration change',
        timestamp: item.timestamp,
        impact: 'medium'
      };
    }

    // Default: code change
    return {
      type: 'features',
      file: filePath,
      description: 'Code modification',
      linesChanged: diff.total,
      timestamp: item.timestamp,
      impact: 'medium'
    };
  }

  /**
   * Calculate code complexity
   */
  calculateComplexity(code) {
    if (!code) return 0;

    let complexity = 1;

    // Cyclomatic complexity indicators
    const ifStatements = (code.match(/\bif\b/g) || []).length;
    const forLoops = (code.match(/\bfor\b/g) || []).length;
    const whileLoops = (code.match(/\bwhile\b/g) || []).length;
    const switchCases = (code.match(/\bcase\b/g) || []).length;
    const ternary = (code.match(/\?.*:/g) || []).length;
    const catches = (code.match(/\bcatch\b/g) || []).length;
    const andOr = (code.match(/&&|\|\|/g) || []).length;

    complexity += ifStatements;
    complexity += forLoops;
    complexity += whileLoops;
    complexity += switchCases;
    complexity += ternary;
    complexity += catches;
    complexity += Math.floor(andOr / 2);

    return complexity;
  }

  /**
   * Check if change is a refactoring
   */
  isRefactoring(afterCode, beforeCode, diff) {
    if (!afterCode || !beforeCode) return false;

    // Similar line count but different structure suggests refactoring
    const lineDiff = Math.abs(afterCode.split('\n').length - beforeCode.split('\n').length);
    const charDiff = Math.abs(afterCode.length - beforeCode.length);

    // Check for function/variable renames
    const hasRenames = this.detectRenames(afterCode, beforeCode);
    
    // Check for structure changes
    const structureChanged = charDiff > 100 && lineDiff < 10;

    return hasRenames || structureChanged;
  }

  /**
   * Check if change is a bug fix
   */
  isBugFix(afterCode, beforeCode, filePath) {
    if (!afterCode || !beforeCode) return false;

    const bugFixKeywords = ['fix', 'bug', 'issue', 'error', 'problem', 'correct', 'repair'];
    const lowerPath = filePath.toLowerCase();
    
    return bugFixKeywords.some(keyword => lowerPath.includes(keyword));
  }

  /**
   * Check if change is a feature addition
   */
  isFeatureAddition(afterCode, beforeCode, diff) {
    // Significant additions suggest new features
    return diff.additions > diff.deletions * 2 && diff.additions > 10;
  }

  /**
   * Check for documentation changes
   */
  hasDocumentationChanges(afterCode, beforeCode) {
    const commentPattern = /(\/\*\*|\/\/|\#|<!--|"""|''')/g;
    const afterComments = (afterCode.match(commentPattern) || []).length;
    const beforeComments = (beforeCode.match(commentPattern) || []).length;

    return afterComments > beforeComments;
  }

  /**
   * Detect renames in code
   */
  detectRenames(afterCode, beforeCode) {
    // Extract identifiers (simplified)
    const extractIdentifiers = (code) => {
      const matches = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g) || [];
      return new Set(matches);
    };

    const beforeIds = extractIdentifiers(beforeCode);
    const afterIds = extractIdentifiers(afterCode);

    // Check if many identifiers were replaced
    const removed = [...beforeIds].filter(id => !afterIds.has(id)).length;
    const added = [...afterIds].filter(id => !beforeIds.has(id)).length;

    return removed > 3 && added > 3;
  }

  /**
   * Get refactoring description
   */
  getRefactoringDescription(afterCode, beforeCode) {
    const descriptions = [];

    if (this.detectRenames(afterCode, beforeCode)) {
      descriptions.push('Variable/function rename');
    }

    const beforeFunctions = (beforeCode.match(/function\s+\w+/g) || []).length;
    const afterFunctions = (afterCode.match(/function\s+\w+/g) || []).length;
    
    if (afterFunctions > beforeFunctions) {
      descriptions.push('Function extraction');
    } else if (afterFunctions < beforeFunctions) {
      descriptions.push('Function inlining');
    }

    return descriptions.length > 0 ? descriptions.join(', ') : 'Code refactoring';
  }

  /**
   * Get feature description
   */
  getFeatureDescription(afterCode, beforeCode) {
    const newFunctions = (afterCode.match(/function\s+\w+/g) || []).length - (beforeCode.match(/function\s+\w+/g) || []).length;
    const newClasses = (afterCode.match(/class\s+\w+/g) || []).length - (beforeCode.match(/class\s+\w+/g) || []).length;

    if (newClasses > 0) return `Added ${newClasses} new class(es)`;
    if (newFunctions > 0) return `Added ${newFunctions} new function(s)`;
    
    return 'New feature implementation';
  }

  /**
   * Estimate test coverage
   */
  estimateTestCoverage(code) {
    const tests = (code.match(/\b(test|it|describe)\s*\(/g) || []).length;
    const assertions = (code.match(/\b(expect|assert|should)\s*\(/g) || []).length;

    return {
      testCount: tests,
      assertionCount: assertions,
      estimatedCoverage: Math.min(100, (assertions / (tests || 1)) * 20)
    };
  }

  /**
   * Calculate diff statistics
   */
  calculateDiff(beforeCode, afterCode) {
    const beforeLines = beforeCode.split('\n');
    const afterLines = afterCode.split('\n');

    let additions = 0;
    let deletions = 0;

    if (afterLines.length > beforeLines.length) {
      additions = afterLines.length - beforeLines.length;
    } else {
      deletions = beforeLines.length - afterLines.length;
    }

    return {
      additions,
      deletions,
      total: additions + deletions
    };
  }

  /**
   * Parse details from various formats
   */
  parseDetails(item) {
    if (typeof item.details === 'string') {
      try {
        return JSON.parse(item.details);
      } catch {
        return {};
      }
    }
    return item.details || item || {};
  }

  /**
   * Build file relationship graph
   */
  buildFileRelationshipGraph(events, entries) {
    const graph = {
      nodes: new Map(),
      edges: []
    };

    const allItems = [...events, ...entries];
    const fileChanges = new Map(); // file -> changes

    // Collect file changes
    allItems.forEach(item => {
      const details = this.parseDetails(item);
      const filePath = details.file_path || item.file_path;
      
      if (filePath) {
        if (!fileChanges.has(filePath)) {
          fileChanges.set(filePath, []);
        }
        fileChanges.get(filePath).push({
          timestamp: item.timestamp,
          content: details.after_code || details.content || '',
          sessionId: item.session_id
        });
      }
    });

    // Create nodes
    fileChanges.forEach((changes, filePath) => {
      const fileExt = filePath.split('.').pop();
      const changeCount = changes.length;
      
      graph.nodes.set(filePath, {
        id: filePath,
        label: filePath.split('/').pop(),
        fullPath: filePath,
        type: fileExt,
        changeCount,
        lastModified: changes[changes.length - 1]?.timestamp,
        size: changes.reduce((sum, c) => sum + (c.content?.length || 0), 0) / changes.length
      });
    });

    // Create edges based on session proximity and imports
    const sessions = new Map(); // sessionId -> files
    
    allItems.forEach(item => {
      const details = this.parseDetails(item);
      const filePath = details.file_path || item.file_path;
      const sessionId = item.session_id;
      
      if (filePath && sessionId) {
        if (!sessions.has(sessionId)) {
          sessions.set(sessionId, new Set());
        }
        sessions.get(sessionId).add(filePath);
      }
    });

    // Connect files modified in the same session
    sessions.forEach((files, sessionId) => {
      const fileArray = Array.from(files);
      for (let i = 0; i < fileArray.length; i++) {
        for (let j = i + 1; j < fileArray.length; j++) {
          graph.edges.push({
            source: fileArray[i],
            target: fileArray[j],
            weight: 1,
            type: 'session',
            sessionId
          });
        }
      }
    });

    // Detect import relationships
    fileChanges.forEach((changes, filePath) => {
      const latestContent = changes[changes.length - 1]?.content || '';
      const imports = this.extractImports(latestContent);
      
      imports.forEach(importPath => {
        // Try to match import to actual files
        const matchedFile = Array.from(fileChanges.keys()).find(f => 
          f.includes(importPath) || importPath.includes(f.split('/').pop())
        );
        
        if (matchedFile && matchedFile !== filePath) {
          graph.edges.push({
            source: filePath,
            target: matchedFile,
            weight: 2,
            type: 'import'
          });
        }
      });
    });

    this.semanticGraph = graph;
    return graph;
  }

  /**
   * Extract imports from code
   */
  extractImports(code) {
    const imports = [];
    
    // JavaScript/TypeScript imports
    const esImports = code.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
    esImports.forEach(imp => {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (match) imports.push(match[1]);
    });

    // Require statements
    const requires = code.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g) || [];
    requires.forEach(req => {
      const match = req.match(/['"]([^'"]+)['"]/);
      if (match) imports.push(match[1]);
    });

    // Python imports
    const pyImports = code.match(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm) || [];
    pyImports.forEach(imp => {
      const match = imp.match(/from\s+(\S+)/);
      if (match) imports.push(match[1]);
    });

    return imports;
  }

  /**
   * Calculate TF-IDF for code analysis
   */
  calculateTFIDF(events, entries, topN = 20) {
    const documents = [];
    const allItems = [...events, ...entries];

    // Extract documents (code files)
    allItems.forEach(item => {
      const details = this.parseDetails(item);
      const content = details.after_code || details.content || '';
      const filePath = details.file_path || item.file_path;
      
      if (content && filePath) {
        documents.push({
          path: filePath,
          content,
          terms: this.extractTerms(content)
        });
      }
    });

    // Calculate TF-IDF
    const tfidf = this.computeTFIDF(documents);
    
    // Get top terms
    const topTerms = Array.from(tfidf.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, topN)
      .map(([term, data]) => ({
        term,
        score: data.score,
        frequency: data.frequency,
        documents: data.documents
      }));

    this.tfidfData = topTerms;
    return topTerms;
  }

  /**
   * Extract terms from code
   */
  extractTerms(code) {
    // Remove comments and strings
    let cleanCode = code
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/"(?:\\.|[^"\\])*"/g, '')
      .replace(/'(?:\\.|[^'\\])*'/g, '');

    // Extract identifiers
    const identifiers = cleanCode.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]+\b/g) || [];
    
    // Filter out common keywords
    const keywords = new Set(['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class', 'import', 'export', 'from', 'async', 'await']);
    
    return identifiers.filter(id => !keywords.has(id) && id.length > 2);
  }

  /**
   * Compute TF-IDF scores
   */
  computeTFIDF(documents) {
    const termData = new Map();
    const docCount = documents.length;

    // Calculate term frequency
    documents.forEach(doc => {
      const termCounts = new Map();
      
      doc.terms.forEach(term => {
        termCounts.set(term, (termCounts.get(term) || 0) + 1);
      });

      termCounts.forEach((count, term) => {
        if (!termData.has(term)) {
          termData.set(term, {
            frequency: 0,
            documents: 0,
            score: 0
          });
        }
        
        const data = termData.get(term);
        data.frequency += count;
        data.documents += 1;
      });
    });

    // Calculate TF-IDF scores
    termData.forEach((data, term) => {
      const tf = data.frequency;
      const idf = Math.log(docCount / (data.documents + 1));
      data.score = tf * idf;
    });

    return termData;
  }

  /**
   * Generate semantic insights
   */
  generateSemanticInsights(events, entries, patterns) {
    const insights = [];

    // Analyze coding velocity
    const velocityInsight = this.analyzeVelocity(events, entries);
    if (velocityInsight) insights.push(velocityInsight);

    // Analyze complexity trends
    const complexityInsight = this.analyzeComplexityTrends(events, entries);
    if (complexityInsight) insights.push(complexityInsight);

    // Analyze refactoring patterns
    if (patterns.refactoring && patterns.refactoring.length > 0) {
      insights.push({
        type: 'refactoring',
        title: 'Active Refactoring',
        description: `Detected ${patterns.refactoring.length} refactoring operations`,
        impact: 'positive',
        details: patterns.refactoring.slice(0, 3).map(p => p.description).join(', ')
      });
    }

    // Analyze test coverage
    const testInsight = this.analyzeTestCoverage(patterns);
    if (testInsight) insights.push(testInsight);

    // Analyze file relationships
    if (this.semanticGraph) {
      const graphInsight = this.analyzeGraphStructure(this.semanticGraph);
      if (graphInsight) insights.push(graphInsight);
    }

    return insights;
  }

  /**
   * Analyze coding velocity
   */
  analyzeVelocity(events, entries) {
    const allItems = [...events, ...entries];
    const now = Date.now();
    const last24h = allItems.filter(item => 
      now - new Date(item.timestamp).getTime() < 24 * 60 * 60 * 1000
    );

    if (last24h.length === 0) return null;

    const changesPerHour = (last24h.length / 24).toFixed(1);

    return {
      type: 'velocity',
      title: 'Coding Velocity',
      description: `${changesPerHour} changes per hour in the last 24 hours`,
      impact: changesPerHour > 5 ? 'high' : 'normal',
      metric: changesPerHour
    };
  }

  /**
   * Analyze complexity trends
   */
  analyzeComplexityTrends(events, entries) {
    const complexities = [];
    
    [...events, ...entries].forEach(item => {
      const details = this.parseDetails(item);
      const content = details.after_code || details.content || '';
      if (content) {
        complexities.push({
          timestamp: item.timestamp,
          complexity: this.calculateComplexity(content)
        });
      }
    });

    if (complexities.length < 2) return null;

    const avgComplexity = complexities.reduce((sum, c) => sum + c.complexity, 0) / complexities.length;
    
    return {
      type: 'complexity',
      title: 'Code Complexity',
      description: `Average complexity: ${avgComplexity.toFixed(1)}`,
      impact: avgComplexity > 10 ? 'warning' : 'normal',
      metric: avgComplexity
    };
  }

  /**
   * Analyze test coverage from patterns
   */
  analyzeTestCoverage(patterns) {
    if (!patterns.testing || patterns.testing.length === 0) return null;

    const totalTests = patterns.testing.reduce((sum, t) => 
      sum + (t.coverage?.testCount || 0), 0
    );

    return {
      type: 'testing',
      title: 'Test Coverage',
      description: `${totalTests} test cases across ${patterns.testing.length} test files`,
      impact: 'positive',
      metric: totalTests
    };
  }

  /**
   * Analyze graph structure
   */
  analyzeGraphStructure(graph) {
    const nodeCount = graph.nodes.size;
    const edgeCount = graph.edges.length;
    
    if (nodeCount === 0) return null;

    const density = (edgeCount / (nodeCount * (nodeCount - 1))).toFixed(3);
    
    return {
      type: 'graph',
      title: 'File Dependencies',
      description: `${nodeCount} files with ${edgeCount} relationships (density: ${density})`,
      impact: density > 0.3 ? 'warning' : 'normal',
      metric: density
    };
  }
}

// Export for use in dashboard
window.SemanticAnalysisEngine = SemanticAnalysisEngine;

