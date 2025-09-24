const fs = require('fs');
const path = require('path');

/**
 * AST-based Intent Classification System
 * Uses Abstract Syntax Tree analysis to determine programming intent
 */
class ASTIntentClassifier {
  constructor() {
    this.intentPatterns = {
      // Data Exploration Patterns
      data_exploration: {
        imports: ['pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly', 'sklearn'],
        functions: ['read_csv', 'read_excel', 'head', 'tail', 'info', 'describe', 'plot', 'hist', 'scatter', 'boxplot'],
        variables: ['df', 'data', 'dataset'],
        keywords: ['explore', 'analyze', 'visualize', 'eda', 'exploratory']
      },
      
      // Implementation Patterns
      implementation: {
        imports: ['sklearn', 'tensorflow', 'torch', 'keras', 'xgboost', 'lightgbm'],
        functions: ['fit', 'predict', 'train', 'model', 'algorithm', 'pipeline'],
        constructs: ['def ', 'class ', 'function', 'async def'],
        keywords: ['implement', 'build', 'create', 'develop', 'train']
      },
      
      // Debug Patterns
      debug: {
        functions: ['print', 'debug', 'pdb', 'breakpoint', 'traceback', 'exception'],
        keywords: ['debug', 'fix', 'error', 'bug', 'issue', 'problem', 'troubleshoot'],
        patterns: ['try:', 'except:', 'finally:', 'raise', 'assert']
      },
      
      // Refactoring Patterns
      refactor: {
        functions: ['refactor', 'optimize', 'clean', 'restructure'],
        keywords: ['refactor', 'optimize', 'improve', 'clean', 'restructure', 'performance'],
        patterns: ['# TODO:', '# FIXME:', '# REFACTOR:']
      },
      
      // Documentation Patterns
      document: {
        functions: ['docstring', 'help', 'documentation'],
        keywords: ['document', 'explain', 'comment', 'describe', 'note'],
        patterns: ['"""', "'''", '# ', 'markdown']
      }
    };
    
    this.weights = {
      imports: 0.3,
      functions: 0.25,
      constructs: 0.2,
      keywords: 0.15,
      variables: 0.05,
      patterns: 0.05
    };
  }

  /**
   * Classify intent from code content using AST analysis
   */
  classifyIntent(codeContent, fileName = '') {
    if (!codeContent || typeof codeContent !== 'string') {
      return this.getDefaultIntent();
    }

    const analysis = this.analyzeCodeStructure(codeContent);
    const scores = this.calculateIntentScores(analysis, fileName);
    const primaryIntent = this.selectPrimaryIntent(scores);
    
    return {
      primary_intent: primaryIntent.intent,
      confidence: primaryIntent.confidence,
      evidence: analysis,
      signal_weights: this.weights,
      confidence_breakdown: {
        signal_agreement: this.calculateSignalAgreement(scores),
        evidence_strength: primaryIntent.confidence
      },
      all_evidences: this.formatEvidences(scores),
      intent_scores: this.formatIntentScores(scores),
      ast_analysis: analysis
    };
  }

  /**
   * Analyze code structure using pattern matching (simplified AST)
   */
  analyzeCodeStructure(codeContent) {
    const lines = codeContent.split('\n');
    const analysis = {
      imports: [],
      functions: [],
      constructs: [],
      keywords: [],
      variables: [],
      patterns: [],
      complexity: this.calculateComplexity(codeContent),
      cellTypes: this.detectCellTypes(lines)
    };

    // Extract imports
    const importMatches = codeContent.match(/import\s+(\w+)|from\s+(\w+)/g) || [];
    analysis.imports = importMatches.map(match => {
      const parts = match.split(/\s+/);
      return parts[parts.length - 1];
    });

    // Extract function calls
    const functionMatches = codeContent.match(/(\w+)\s*\(/g) || [];
    analysis.functions = functionMatches.map(match => match.replace(/\s*\(/, ''));

    // Extract constructs
    if (codeContent.includes('def ')) analysis.constructs.push('def');
    if (codeContent.includes('class ')) analysis.constructs.push('class');
    if (codeContent.includes('async def')) analysis.constructs.push('async def');
    if (codeContent.includes('function')) analysis.constructs.push('function');

    // Extract keywords
    const keywordMatches = codeContent.match(/\b(explore|analyze|implement|debug|refactor|document|visualize|train|model|fix|error|optimize)\b/gi) || [];
    analysis.keywords = keywordMatches.map(k => k.toLowerCase());

    // Extract variable patterns
    const variableMatches = codeContent.match(/\b(df|data|dataset|model|result|output)\b/g) || [];
    analysis.variables = variableMatches.map(v => v.toLowerCase());

    // Extract patterns
    if (codeContent.includes('try:')) analysis.patterns.push('try');
    if (codeContent.includes('except:')) analysis.patterns.push('except');
    if (codeContent.includes('print(')) analysis.patterns.push('print');
    if (codeContent.includes('#')) analysis.patterns.push('comment');

    return analysis;
  }

  /**
   * Calculate intent scores based on analysis
   */
  calculateIntentScores(analysis, fileName) {
    const scores = {};
    
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      let score = 0;
      let evidenceCount = 0;

      // Check imports
      const importMatches = analysis.imports.filter(imp => 
        patterns.imports && patterns.imports.some(p => imp.toLowerCase().includes(p.toLowerCase()))
      );
      score += importMatches.length * this.weights.imports;
      evidenceCount += importMatches.length;

      // Check functions
      const functionMatches = analysis.functions.filter(func => 
        patterns.functions && patterns.functions.some(p => func.toLowerCase().includes(p.toLowerCase()))
      );
      score += functionMatches.length * this.weights.functions;
      evidenceCount += functionMatches.length;

      // Check constructs
      const constructMatches = analysis.constructs.filter(construct => 
        patterns.constructs && patterns.constructs.some(p => construct.toLowerCase().includes(p.toLowerCase()))
      );
      score += constructMatches.length * this.weights.constructs;
      evidenceCount += constructMatches.length;

      // Check keywords
      const keywordMatches = analysis.keywords.filter(keyword => 
        patterns.keywords && patterns.keywords.some(p => keyword.toLowerCase().includes(p.toLowerCase()))
      );
      score += keywordMatches.length * this.weights.keywords;
      evidenceCount += keywordMatches.length;

      // Check variables
      const variableMatches = analysis.variables.filter(variable => 
        patterns.variables && patterns.variables.some(p => variable.toLowerCase().includes(p.toLowerCase()))
      );
      score += variableMatches.length * this.weights.variables;
      evidenceCount += variableMatches.length;

      // Check patterns
      const patternMatches = analysis.patterns.filter(pattern => 
        patterns.patterns && patterns.patterns.some(p => pattern.toLowerCase().includes(p.toLowerCase()))
      );
      score += patternMatches.length * this.weights.patterns;
      evidenceCount += patternMatches.length;

      // File name bonus
      if (fileName.includes('.ipynb') && intent === 'data_exploration') {
        score += 0.1;
      }

      scores[intent] = {
        score: Math.min(score, 1.0), // Cap at 1.0
        evidenceCount,
        evidence: {
          imports: importMatches,
          functions: functionMatches,
          constructs: constructMatches,
          keywords: keywordMatches,
          variables: variableMatches,
          patterns: patternMatches
        }
      };
    }

    return scores;
  }

  /**
   * Select primary intent from scores
   */
  selectPrimaryIntent(scores) {
    let maxScore = 0;
    let primaryIntent = 'data_exploration';
    let maxConfidence = 0.5;

    for (const [intent, data] of Object.entries(scores)) {
      if (data.score > maxScore) {
        maxScore = data.score;
        primaryIntent = intent;
        maxConfidence = Math.min(data.score + 0.2, 0.95); // Boost confidence slightly
      }
    }

    // If no strong evidence, default to exploration for notebooks
    if (maxScore < 0.1) {
      primaryIntent = 'data_exploration';
      maxConfidence = 0.3;
    }

    return {
      intent: primaryIntent,
      confidence: maxConfidence,
      score: maxScore
    };
  }

  /**
   * Calculate code complexity
   */
  calculateComplexity(codeContent) {
    const lines = codeContent.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    let complexity = 0;
    
    // Basic complexity factors
    complexity += nonEmptyLines.length * 0.1; // Line count
    complexity += (codeContent.match(/if\s+/g) || []).length * 0.5; // Conditionals
    complexity += (codeContent.match(/for\s+/g) || []).length * 0.5; // Loops
    complexity += (codeContent.match(/while\s+/g) || []).length * 0.5; // While loops
    complexity += (codeContent.match(/def\s+/g) || []).length * 0.3; // Functions
    complexity += (codeContent.match(/class\s+/g) || []).length * 0.4; // Classes
    complexity += (codeContent.match(/try\s*:/g) || []).length * 0.3; // Try blocks
    
    return Math.min(complexity, 10); // Cap at 10
  }

  /**
   * Detect cell types in notebook
   */
  detectCellTypes(lines) {
    const types = {
      code: 0,
      markdown: 0,
      raw: 0
    };

    for (const line of lines) {
      if (line.trim().startsWith('#')) {
        types.markdown++;
      } else if (line.trim().length > 0) {
        types.code++;
      } else {
        types.raw++;
      }
    }

    return types;
  }

  /**
   * Calculate signal agreement between different evidence types
   */
  calculateSignalAgreement(scores) {
    const totalEvidence = Object.values(scores).reduce((sum, data) => sum + data.evidenceCount, 0);
    if (totalEvidence === 0) return 0;
    
    const maxEvidence = Math.max(...Object.values(scores).map(data => data.evidenceCount));
    return maxEvidence / totalEvidence;
  }

  /**
   * Format evidences for output
   */
  formatEvidences(scores) {
    const evidences = [];
    
    for (const [intent, data] of Object.entries(scores)) {
      if (data.score > 0) {
        evidences.push({
          intent,
          confidence: data.score,
          weight: data.evidenceCount / 10, // Normalize weight
          evidence: data.evidence
        });
      }
    }
    
    return evidences.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Format intent scores for output
   */
  formatIntentScores(scores) {
    const intentScores = {};
    
    for (const [intent, data] of Object.entries(scores)) {
      intentScores[intent] = {
        total_score: data.score,
        evidence_count: data.evidenceCount,
        evidence: data.evidence
      };
    }
    
    return intentScores;
  }

  /**
   * Get default intent when classification fails
   */
  getDefaultIntent() {
    return {
      primary_intent: 'data_exploration',
      confidence: 0.3,
      evidence: { default: true },
      signal_weights: this.weights,
      confidence_breakdown: { signal_agreement: 0, evidence_strength: 0.3 },
      all_evidences: [{ intent: 'data_exploration', confidence: 0.3, weight: 1.0 }],
      intent_scores: { data_exploration: { total_score: 0.3, evidence_count: 0 } },
      ast_analysis: { complexity: 0, cellTypes: { code: 0, markdown: 0, raw: 0 } }
    };
  }
}

module.exports = ASTIntentClassifier;
