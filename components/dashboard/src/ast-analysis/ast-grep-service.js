/**
 * AST-Grep Service for JavaScript
 * 
 * This service provides direct AST parsing and pattern matching using ast-grep's
 * JavaScript API for module/function extraction and analysis.
 * 
 * Features:
 * - Direct AST parsing with ast-grep
 * - Module and function extraction
 * - Pattern-based code analysis
 * - Real-time code transformation
 * - Integration with existing PKL Extension
 */

const { parse, Lang, kind } = require('@ast-grep/napi');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ASTGrepService extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      supportedLanguages: [
        'JavaScript',
        'TypeScript', 
        'Python',
        'Java',
        'C',
        'C++',
        'Go',
        'Rust',
        'PHP',
        'Ruby'
      ],
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 1000,
      enableLearning: config.enableLearning !== false,
      ...config
    };
    
    this.cache = new Map();
    this.extractionPatterns = new Map();
    this.analysisHistory = [];
    
    // Initialize extraction patterns
    this.initializeExtractionPatterns();
    
    console.log('AST-Grep Service initialized');
  }
  
  /**
   * Initialize extraction patterns for different languages
   */
  initializeExtractionPatterns() {
    // JavaScript/TypeScript patterns
    this.extractionPatterns.set('javascript', {
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
      modules: [
        'import $NAME from $SOURCE',
        'import { $NAME } from $SOURCE',
        'import * as $NAME from $SOURCE',
        'export $NAME',
        'export default $NAME',
        'export { $NAME }',
        'module.exports = $NAME',
        'module.exports.$NAME = $VALUE'
      ],
      variables: [
        'const $NAME = $VALUE',
        'let $NAME = $VALUE',
        'var $NAME = $VALUE',
        'const { $NAME } = $VALUE',
        'const [ $NAME ] = $VALUE'
      ],
      imports: [
        'import $NAME from $SOURCE',
        'import { $NAME } from $SOURCE',
        'import * as $NAME from $SOURCE',
        'require($SOURCE)'
      ],
      exports: [
        'export $NAME',
        'export default $NAME',
        'export { $NAME }',
        'module.exports = $NAME',
        'module.exports.$NAME = $VALUE'
      ]
    });
    
    // Python patterns
    this.extractionPatterns.set('python', {
      functions: [
        'def $NAME($$$PARAMS):$$$',
        'async def $NAME($$$PARAMS):$$$',
        'lambda $PARAMS: $EXPR'
      ],
      classes: [
        'class $NAME:$$$',
        'class $NAME($PARENT):$$$'
      ],
      imports: [
        'import $NAME',
        'import $NAME as $ALIAS',
        'from $MODULE import $NAME',
        'from $MODULE import $NAME as $ALIAS'
      ],
      variables: [
        '$NAME = $VALUE',
        '$NAME, $NAME2 = $VALUE'
      ]
    });
    
    // Add more language patterns as needed
  }
  
  /**
   * Parse source code and return AST
   */
  parseSource(source, language = 'JavaScript') {
    try {
      const lang = this.getLanguageEnum(language);
      if (!lang) {
        throw new Error(`Unsupported language: ${language}`);
      }
      
      const ast = parse(lang, source);
      return ast;
    } catch (error) {
      console.error(`Error parsing ${language} source:`, error);
      throw error;
    }
  }
  
  /**
   * Get language enum from string
   */
  getLanguageEnum(language) {
    const langMap = {
      'JavaScript': Lang.JavaScript,
      'TypeScript': Lang.TypeScript,
      'Python': Lang.Python,
      'Java': Lang.Java,
      'C': Lang.C,
      'C++': Lang.Cpp,
      'Go': Lang.Go,
      'Rust': Lang.Rust,
      'PHP': Lang.Php,
      'Ruby': Lang.Ruby
    };
    
    return langMap[language] || null;
  }
  
  /**
   * Extract functions from source code
   */
  extractFunctions(source, language = 'JavaScript') {
    try {
      const ast = this.parseSource(source, language);
      const root = ast.root();
      const patterns = this.extractionPatterns.get(language.toLowerCase());
      
      if (!patterns || !patterns.functions) {
        throw new Error(`No function patterns defined for ${language}`);
      }
      
      const functions = [];
      
      for (const pattern of patterns.functions) {
        const nodes = root.findAll(pattern);
        
        for (const node of nodes) {
          const functionInfo = this.extractFunctionInfo(node, pattern);
          if (functionInfo) {
            functions.push(functionInfo);
          }
        }
      }
      
      return functions;
    } catch (error) {
      console.error('Error extracting functions:', error);
      return [];
    }
  }
  
  /**
   * Extract classes from source code
   */
  extractClasses(source, language = 'JavaScript') {
    try {
      const ast = this.parseSource(source, language);
      const root = ast.root();
      const patterns = this.extractionPatterns.get(language.toLowerCase());
      
      if (!patterns || !patterns.classes) {
        throw new Error(`No class patterns defined for ${language}`);
      }
      
      const classes = [];
      
      for (const pattern of patterns.classes) {
        const nodes = root.findAll(pattern);
        
        for (const node of nodes) {
          const classInfo = this.extractClassInfo(node, pattern);
          if (classInfo) {
            classes.push(classInfo);
          }
        }
      }
      
      return classes;
    } catch (error) {
      console.error('Error extracting classes:', error);
      return [];
    }
  }
  
  /**
   * Extract modules (imports/exports) from source code
   */
  extractModules(source, language = 'JavaScript') {
    try {
      const ast = this.parseSource(source, language);
      const root = ast.root();
      const patterns = this.extractionPatterns.get(language.toLowerCase());
      
      if (!patterns) {
        throw new Error(`No patterns defined for ${language}`);
      }
      
      const modules = {
        imports: [],
        exports: [],
        variables: []
      };
      
      // Extract imports
      if (patterns.imports) {
        for (const pattern of patterns.imports) {
          const nodes = root.findAll(pattern);
          for (const node of nodes) {
            const importInfo = this.extractImportInfo(node, pattern);
            if (importInfo) {
              modules.imports.push(importInfo);
            }
          }
        }
      }
      
      // Extract exports
      if (patterns.exports) {
        for (const pattern of patterns.exports) {
          const nodes = root.findAll(pattern);
          for (const node of nodes) {
            const exportInfo = this.extractExportInfo(node, pattern);
            if (exportInfo) {
              modules.exports.push(exportInfo);
            }
          }
        }
      }
      
      // Extract variables
      if (patterns.variables) {
        for (const pattern of patterns.variables) {
          const nodes = root.findAll(pattern);
          for (const node of nodes) {
            const variableInfo = this.extractVariableInfo(node, pattern);
            if (variableInfo) {
              modules.variables.push(variableInfo);
            }
          }
        }
      }
      
      return modules;
    } catch (error) {
      console.error('Error extracting modules:', error);
      return { imports: [], exports: [], variables: [] };
    }
  }
  
  /**
   * Extract function information from AST node
   */
  extractFunctionInfo(node, pattern) {
    try {
      const name = node.getMatch('NAME');
      const params = node.getMatch('PARAMS');
      const body = node.getMatch('BODY') || node;
      
      const range = node.range();
      const startPos = range.start;
      const endPos = range.end;
      
      return {
        name: name ? name.text() : 'anonymous',
        parameters: params ? this.extractParameters(params) : [],
        body: body ? body.text() : '',
        source: node.text(),
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        startColumn: startPos.column,
        endColumn: endPos.column,
        startIndex: startPos.index,
        endIndex: endPos.index,
        isAsync: pattern.includes('async'),
        isArrow: pattern.includes('=>'),
        isMethod: pattern.includes(':'),
        kind: node.kind(),
        pattern: pattern
      };
    } catch (error) {
      console.error('Error extracting function info:', error);
      return null;
    }
  }
  
  /**
   * Extract class information from AST node
   */
  extractClassInfo(node, pattern) {
    try {
      const name = node.getMatch('NAME');
      const parent = node.getMatch('PARENT');
      const body = node.getMatch('BODY') || node;
      
      const range = node.range();
      const startPos = range.start;
      const endPos = range.end;
      
      // Extract methods from class body
      const methods = this.extractMethodsFromClass(body);
      
      return {
        name: name ? name.text() : 'anonymous',
        parent: parent ? parent.text() : null,
        methods: methods,
        body: body ? body.text() : '',
        source: node.text(),
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        startColumn: startPos.column,
        endColumn: endPos.column,
        startIndex: startPos.index,
        endIndex: endPos.index,
        isExported: pattern.includes('export'),
        kind: node.kind(),
        pattern: pattern
      };
    } catch (error) {
      console.error('Error extracting class info:', error);
      return null;
    }
  }
  
  /**
   * Extract methods from class body
   */
  extractMethodsFromClass(classBody) {
    const methods = [];
    
    if (!classBody) return methods;
    
    // Look for method patterns in class body
    const methodPatterns = [
      '$NAME($$$PARAMS) {$$$}',
      '$NAME: function($$$PARAMS) {$$$}',
      'async $NAME($$$PARAMS) {$$$}',
      'get $NAME() {$$$}',
      'set $NAME($PARAM) {$$$}'
    ];
    
    for (const pattern of methodPatterns) {
      const nodes = classBody.findAll(pattern);
      for (const node of nodes) {
        const methodInfo = this.extractFunctionInfo(node, pattern);
        if (methodInfo) {
          methods.push(methodInfo);
        }
      }
    }
    
    return methods;
  }
  
  /**
   * Extract import information from AST node
   */
  extractImportInfo(node, pattern) {
    try {
      const name = node.getMatch('NAME');
      const source = node.getMatch('SOURCE');
      const alias = node.getMatch('ALIAS');
      
      const range = node.range();
      const startPos = range.start;
      const endPos = range.end;
      
      return {
        name: name ? name.text() : null,
        source: source ? source.text().replace(/['"]/g, '') : null,
        alias: alias ? alias.text() : null,
        source: node.text(),
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        startColumn: startPos.column,
        endColumn: endPos.column,
        startIndex: startPos.index,
        endIndex: endPos.index,
        isDefault: pattern.includes('import $NAME from'),
        isNamed: pattern.includes('import { $NAME }'),
        isNamespace: pattern.includes('import * as'),
        kind: node.kind(),
        pattern: pattern
      };
    } catch (error) {
      console.error('Error extracting import info:', error);
      return null;
    }
  }
  
  /**
   * Extract export information from AST node
   */
  extractExportInfo(node, pattern) {
    try {
      const name = node.getMatch('NAME');
      const value = node.getMatch('VALUE');
      
      const range = node.range();
      const startPos = range.start;
      const endPos = range.end;
      
      return {
        name: name ? name.text() : null,
        value: value ? value.text() : null,
        source: node.text(),
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        startColumn: startPos.column,
        endColumn: endPos.column,
        startIndex: startPos.index,
        endIndex: endPos.index,
        isDefault: pattern.includes('export default'),
        isNamed: pattern.includes('export { $NAME }'),
        isModule: pattern.includes('module.exports'),
        kind: node.kind(),
        pattern: pattern
      };
    } catch (error) {
      console.error('Error extracting export info:', error);
      return null;
    }
  }
  
  /**
   * Extract variable information from AST node
   */
  extractVariableInfo(node, pattern) {
    try {
      const name = node.getMatch('NAME');
      const value = node.getMatch('VALUE');
      
      const range = node.range();
      const startPos = range.start;
      const endPos = range.end;
      
      return {
        name: name ? name.text() : null,
        value: value ? value.text() : null,
        source: node.text(),
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        startColumn: startPos.column,
        endColumn: endPos.column,
        startIndex: startPos.index,
        endIndex: endPos.index,
        isConst: pattern.includes('const'),
        isLet: pattern.includes('let'),
        isVar: pattern.includes('var'),
        isDestructured: pattern.includes('{') || pattern.includes('['),
        kind: node.kind(),
        pattern: pattern
      };
    } catch (error) {
      console.error('Error extracting variable info:', error);
      return null;
    }
  }
  
  /**
   * Extract parameters from function parameter node
   */
  extractParameters(paramsNode) {
    const parameters = [];
    
    if (!paramsNode) return parameters;
    
    // Handle different parameter patterns
    const paramPatterns = [
      '$NAME',
      '$NAME = $DEFAULT',
      '...$NAME',
      '{ $NAME }',
      '[ $NAME ]'
    ];
    
    for (const pattern of paramPatterns) {
      const nodes = paramsNode.findAll(pattern);
      for (const node of nodes) {
        const name = node.getMatch('NAME');
        const defaultValue = node.getMatch('DEFAULT');
        
        if (name) {
          parameters.push({
            name: name.text(),
            defaultValue: defaultValue ? defaultValue.text() : null,
            isRest: pattern.includes('...'),
            isDestructured: pattern.includes('{') || pattern.includes('['),
            source: node.text()
          });
        }
      }
    }
    
    return parameters;
  }
  
  /**
   * Analyze source code and extract all components
   */
  analyzeSource(source, language = 'JavaScript') {
    try {
      const analysis = {
        language: language,
        timestamp: new Date().toISOString(),
        functions: this.extractFunctions(source, language),
        classes: this.extractClasses(source, language),
        modules: this.extractModules(source, language),
        statistics: this.calculateStatistics(source, language)
      };
      
      // Store in history
      this.analysisHistory.push(analysis);
      
      // Keep only recent history
      if (this.analysisHistory.length > 100) {
        this.analysisHistory = this.analysisHistory.slice(-100);
      }
      
      this.emit('analysisComplete', analysis);
      return analysis;
      
    } catch (error) {
      console.error('Error analyzing source:', error);
      this.emit('error', error);
      return null;
    }
  }
  
  /**
   * Calculate statistics for source code
   */
  calculateStatistics(source, language) {
    const lines = source.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    return {
      totalLines: lines.length,
      nonEmptyLines: nonEmptyLines.length,
      totalCharacters: source.length,
      averageLineLength: source.length / lines.length,
      language: language
    };
  }
  
  /**
   * Find specific patterns in source code
   */
  findPatterns(source, patterns, language = 'JavaScript') {
    try {
      const ast = this.parseSource(source, language);
      const root = ast.root();
      const results = [];
      
      for (const pattern of patterns) {
        const nodes = root.findAll(pattern);
        for (const node of nodes) {
          results.push({
            pattern: pattern,
            source: node.text(),
            range: node.range(),
            kind: node.kind(),
            matches: this.extractMatches(node, pattern)
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error finding patterns:', error);
      return [];
    }
  }
  
  /**
   * Extract matches from pattern
   */
  extractMatches(node, pattern) {
    const matches = {};
    const metaVars = pattern.match(/\$([A-Z_]+)/g);
    
    if (metaVars) {
      for (const metaVar of metaVars) {
        const varName = metaVar.substring(1);
        const match = node.getMatch(varName);
        if (match) {
          matches[varName] = {
            text: match.text(),
            range: match.range(),
            kind: match.kind()
          };
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Transform code using patterns
   */
  transformCode(source, transformations, language = 'JavaScript') {
    try {
      const ast = this.parseSource(source, language);
      const root = ast.root();
      const edits = [];
      
      for (const transformation of transformations) {
        const { pattern, replacement } = transformation;
        const nodes = root.findAll(pattern);
        
        for (const node of nodes) {
          const edit = node.replace(replacement);
          edits.push(edit);
        }
      }
      
      if (edits.length > 0) {
        const newSource = root.commitEdits(edits);
        return newSource;
      }
      
      return source;
    } catch (error) {
      console.error('Error transforming code:', error);
      return source;
    }
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
    let totalExports = 0;
    
    this.analysisHistory.forEach(analysis => {
      const lang = analysis.language;
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
      totalFunctions += analysis.functions.length;
      totalClasses += analysis.classes.length;
      totalImports += analysis.modules.imports.length;
      totalExports += analysis.modules.exports.length;
    });
    
    return {
      totalAnalyses,
      languageDistribution: languageCounts,
      totalFunctions,
      totalClasses,
      totalImports,
      totalExports,
      averageFunctionsPerAnalysis: totalFunctions / totalAnalyses,
      averageClassesPerAnalysis: totalClasses / totalAnalyses,
      recentAnalyses: this.analysisHistory.slice(-10)
    };
  }
  
  /**
   * Clear cache and history
   */
  clearCache() {
    this.cache.clear();
    this.analysisHistory = [];
    this.emit('cacheCleared');
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      supportedLanguages: this.config.supportedLanguages,
      cacheSize: this.cache.size,
      analysisCount: this.analysisHistory.length,
      extractionPatterns: Array.from(this.extractionPatterns.keys()),
      config: this.config
    };
  }
}

// Export the service
module.exports = ASTGrepService;
