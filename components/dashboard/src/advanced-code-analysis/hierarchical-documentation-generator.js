/**
 * Hierarchical Documentation Generator - Shadow-inspired Code Documentation
 * 
 * This module provides advanced hierarchical documentation generation inspired by Shadow's
 * "Shadow Wiki" system for creating comprehensive codebase understanding.
 * 
 * Features:
 * - Multi-level documentation (file, directory, repository)
 * - Intelligent codebase summarization
 * - Relationship mapping and visualization
 * - Context-aware documentation generation
 * - Integration with existing cursor-telemetry system
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class HierarchicalDocumentationGenerator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      maxFileSize: 1024 * 1024, // 1MB
      maxDirectoryDepth: 10,
      enableSymbolAnalysis: true,
      enableRelationshipMapping: true,
      enableContextualSummarization: true,
      documentationLevels: ['file', 'directory', 'repository'],
      ...options
    };
    
    this.documentationCache = new Map();
    this.symbolMap = new Map();
    this.relationshipGraph = new Map();
    this.contextCache = new Map();
    this.generationHistory = [];
    
    console.log('📚 Hierarchical Documentation Generator initialized');
  }
  
  /**
   * Generate hierarchical documentation for a codebase
   */
  async generateDocumentation(rootPath, options = {}) {
    try {
      const startTime = Date.now();
      
      // Scan codebase structure
      const codebaseStructure = await this.scanCodebase(rootPath);
      
      // Generate documentation at different levels
      const documentation = {
        repository: await this.generateRepositoryDocumentation(codebaseStructure, rootPath),
        directories: await this.generateDirectoryDocumentation(codebaseStructure, rootPath),
        files: await this.generateFileDocumentation(codebaseStructure, rootPath),
        relationships: await this.generateRelationshipDocumentation(codebaseStructure),
        metadata: {
          generatedAt: new Date().toISOString(),
          rootPath,
          totalFiles: codebaseStructure.files.length,
          totalDirectories: codebaseStructure.directories.length,
          generationTime: Date.now() - startTime
        }
      };
      
      // Cache documentation
      this.documentationCache.set(rootPath, documentation);
      
      // Store generation history
      this.generationHistory.push({
        rootPath,
        timestamp: Date.now(),
        files: codebaseStructure.files.length,
        directories: codebaseStructure.directories.length
      });
      
      this.emit('documentationGenerated', { rootPath, documentation });
      
      return documentation;
      
    } catch (error) {
      console.error(`Error generating documentation for ${rootPath}:`, error);
      this.emit('documentationError', { rootPath, error });
      throw error;
    }
  }
  
  /**
   * Scan codebase structure
   */
  async scanCodebase(rootPath) {
    const structure = {
      files: [],
      directories: [],
      relationships: [],
      metadata: {
        rootPath,
        scannedAt: Date.now()
      }
    };
    
    await this.scanDirectory(rootPath, structure, 0);
    
    return structure;
  }
  
  /**
   * Recursively scan directory
   */
  async scanDirectory(dirPath, structure, depth) {
    if (depth > this.options.maxDirectoryDepth) return;
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common non-code directories
          if (this.shouldSkipDirectory(entry.name)) continue;
          
          structure.directories.push({
            path: fullPath,
            name: entry.name,
            depth,
            parent: dirPath
          });
          
          // Recursively scan subdirectory
          await this.scanDirectory(fullPath, structure, depth + 1);
          
        } else if (entry.isFile()) {
          // Only process code files
          if (this.isCodeFile(entry.name)) {
            const fileInfo = await this.analyzeFile(fullPath);
            structure.files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      console.warn(`Error scanning directory ${dirPath}:`, error.message);
    }
  }
  
  /**
   * Check if directory should be skipped
   */
  shouldSkipDirectory(dirName) {
    const skipDirs = [
      'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'target',
      'coverage', '.nyc_output', 'logs', 'tmp', 'temp', '__pycache__',
      '.pytest_cache', '.mypy_cache', 'venv', 'env', '.env'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }
  
  /**
   * Check if file is a code file
   */
  isCodeFile(fileName) {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.r',
      '.m', '.mm', '.cs', '.vb', '.fs', '.clj', '.hs', '.ml', '.erl'
    ];
    
    const ext = path.extname(fileName).toLowerCase();
    return codeExtensions.includes(ext);
  }
  
  /**
   * Analyze individual file
   */
  async analyzeFile(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      return {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stats.size,
        modified: stats.mtime,
        language: this.detectLanguage(filePath),
        content: content.substring(0, this.options.maxFileSize), // Limit content size
        symbols: this.extractSymbols(content),
        relationships: this.extractFileRelationships(content, filePath),
        complexity: this.calculateFileComplexity(content),
        metadata: {
          lines: content.split('\n').length,
          characters: content.length,
          analyzedAt: Date.now()
        }
      };
    } catch (error) {
      console.warn(`Error analyzing file ${filePath}:`, error.message);
      return {
        path: filePath,
        name: path.basename(filePath),
        error: error.message,
        analyzedAt: Date.now()
      };
    }
  }
  
  /**
   * Detect programming language from file path
   */
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.r': 'r',
      '.m': 'objective-c',
      '.mm': 'objective-c',
      '.cs': 'csharp',
      '.vb': 'vb',
      '.fs': 'fsharp',
      '.clj': 'clojure',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.erl': 'erlang'
    };
    
    return languageMap[ext] || 'unknown';
  }
  
  /**
   * Extract symbols from file content
   */
  extractSymbols(content) {
    const symbols = [];
    
    // Extract functions
    const functionMatches = content.match(/function\s+(\w+)|def\s+(\w+)|public\s+(\w+)\s+(\w+)/g) || [];
    functionMatches.forEach(match => {
      const name = match.replace(/function\s+|def\s+|public\s+(\w+)\s+/, '');
      symbols.push({ type: 'function', name, line: this.findLineNumber(content, match) });
    });
    
    // Extract classes
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    classMatches.forEach(match => {
      const name = match.replace('class ', '');
      symbols.push({ type: 'class', name, line: this.findLineNumber(content, match) });
    });
    
    // Extract variables
    const variableMatches = content.match(/(?:const|let|var)\s+(\w+)/g) || [];
    variableMatches.forEach(match => {
      const name = match.replace(/(?:const|let|var)\s+/, '');
      symbols.push({ type: 'variable', name, line: this.findLineNumber(content, match) });
    });
    
    return symbols;
  }
  
  /**
   * Find line number for a match
   */
  findLineNumber(content, match) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) {
        return i + 1;
      }
    }
    return 0;
  }
  
  /**
   * Extract file relationships
   */
  extractFileRelationships(content, filePath) {
    const relationships = [];
    
    // Extract imports
    const importMatches = content.match(/import\s+.*?from\s+['"](.*?)['"]/g) || [];
    importMatches.forEach(match => {
      const source = match.match(/from\s+['"](.*?)['"]/)?.[1];
      if (source) {
        relationships.push({
          type: 'imports',
          target: source,
          strength: 0.9
        });
      }
    });
    
    // Extract function calls
    const functionCalls = content.match(/(\w+)\s*\(/g) || [];
    functionCalls.forEach(call => {
      const functionName = call.replace(/\s*\(/, '');
      relationships.push({
        type: 'calls',
        target: functionName,
        strength: 0.7
      });
    });
    
    return relationships;
  }
  
  /**
   * Calculate file complexity
   */
  calculateFileComplexity(content) {
    const lines = content.split('\n');
    let complexity = 0;
    
    // Count control structures
    const controlStructures = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch'];
    controlStructures.forEach(structure => {
      const matches = content.match(new RegExp(`\\b${structure}\\b`, 'g'));
      if (matches) complexity += matches.length;
    });
    
    // Count nested structures
    const nestedPatterns = ['{', '}', '(', ')', '[', ']'];
    nestedPatterns.forEach(pattern => {
      const matches = content.match(new RegExp(`\\${pattern}`, 'g'));
      if (matches) complexity += matches.length;
    });
    
    return {
      cyclomatic: complexity,
      lines: lines.length,
      characters: content.length,
      density: complexity / lines.length
    };
  }
  
  /**
   * Generate repository-level documentation
   */
  async generateRepositoryDocumentation(structure, rootPath) {
    const repoDoc = {
      name: path.basename(rootPath),
      path: rootPath,
      summary: this.generateRepositorySummary(structure),
      architecture: this.analyzeArchitecture(structure),
      technologies: this.identifyTechnologies(structure),
      patterns: this.identifyPatterns(structure),
      metrics: this.calculateRepositoryMetrics(structure),
      recommendations: this.generateRecommendations(structure)
    };
    
    return repoDoc;
  }
  
  /**
   * Generate repository summary
   */
  generateRepositorySummary(structure) {
    const totalFiles = structure.files.length;
    const totalDirectories = structure.directories.length;
    const languages = [...new Set(structure.files.map(f => f.language))];
    const totalSize = structure.files.reduce((sum, f) => sum + (f.size || 0), 0);
    
    return {
      overview: `This repository contains ${totalFiles} code files across ${totalDirectories} directories.`,
      languages: languages,
      size: totalSize,
      complexity: this.calculateOverallComplexity(structure),
      purpose: this.inferRepositoryPurpose(structure)
    };
  }
  
  /**
   * Calculate overall complexity
   */
  calculateOverallComplexity(structure) {
    const totalComplexity = structure.files.reduce((sum, f) => {
      return sum + (f.complexity?.cyclomatic || 0);
    }, 0);
    
    const averageComplexity = totalComplexity / structure.files.length;
    
    return {
      total: totalComplexity,
      average: averageComplexity,
      level: averageComplexity > 10 ? 'high' : averageComplexity > 5 ? 'medium' : 'low'
    };
  }
  
  /**
   * Infer repository purpose
   */
  inferRepositoryPurpose(structure) {
    const fileNames = structure.files.map(f => f.name.toLowerCase());
    const directoryNames = structure.directories.map(d => d.name.toLowerCase());
    
    // Check for common patterns
    if (fileNames.some(name => name.includes('test'))) return 'testing framework';
    if (fileNames.some(name => name.includes('api'))) return 'API service';
    if (fileNames.some(name => name.includes('web'))) return 'web application';
    if (fileNames.some(name => name.includes('mobile'))) return 'mobile application';
    if (fileNames.some(name => name.includes('data'))) return 'data processing';
    if (fileNames.some(name => name.includes('ml'))) return 'machine learning';
    
    return 'general purpose';
  }
  
  /**
   * Analyze architecture
   */
  analyzeArchitecture(structure) {
    const architecture = {
      patterns: [],
      layers: [],
      components: []
    };
    
    // Identify architectural patterns
    const patterns = this.identifyArchitecturalPatterns(structure);
    architecture.patterns = patterns;
    
    // Identify layers
    const layers = this.identifyLayers(structure);
    architecture.layers = layers;
    
    // Identify components
    const components = this.identifyComponents(structure);
    architecture.components = components;
    
    return architecture;
  }
  
  /**
   * Identify architectural patterns
   */
  identifyArchitecturalPatterns(structure) {
    const patterns = [];
    
    // Check for MVC pattern
    const hasModels = structure.files.some(f => f.name.toLowerCase().includes('model'));
    const hasViews = structure.files.some(f => f.name.toLowerCase().includes('view'));
    const hasControllers = structure.files.some(f => f.name.toLowerCase().includes('controller'));
    
    if (hasModels && hasViews && hasControllers) {
      patterns.push('MVC (Model-View-Controller)');
    }
    
    // Check for microservices pattern
    const hasServices = structure.directories.some(d => d.name.toLowerCase().includes('service'));
    if (hasServices) {
      patterns.push('Microservices');
    }
    
    // Check for layered architecture
    const hasLayers = structure.directories.some(d => 
      ['presentation', 'business', 'data', 'domain'].includes(d.name.toLowerCase())
    );
    if (hasLayers) {
      patterns.push('Layered Architecture');
    }
    
    return patterns;
  }
  
  /**
   * Identify layers
   */
  identifyLayers(structure) {
    const layers = [];
    
    // Common layer patterns
    const layerPatterns = {
      'presentation': ['ui', 'view', 'component', 'page'],
      'business': ['service', 'business', 'logic', 'domain'],
      'data': ['data', 'repository', 'dao', 'model'],
      'infrastructure': ['config', 'util', 'helper', 'common']
    };
    
    Object.entries(layerPatterns).forEach(([layer, keywords]) => {
      const hasLayer = structure.directories.some(d => 
        keywords.some(keyword => d.name.toLowerCase().includes(keyword))
      );
      if (hasLayer) {
        layers.push(layer);
      }
    });
    
    return layers;
  }
  
  /**
   * Identify components
   */
  identifyComponents(structure) {
    const components = [];
    
    // Group files by directory
    const directoryGroups = {};
    structure.files.forEach(file => {
      const dir = path.dirname(file.path);
      if (!directoryGroups[dir]) {
        directoryGroups[dir] = [];
      }
      directoryGroups[dir].push(file);
    });
    
    // Identify components based on directory structure
    Object.entries(directoryGroups).forEach(([dir, files]) => {
      if (files.length > 1) {
        components.push({
          name: path.basename(dir),
          path: dir,
          files: files.length,
          languages: [...new Set(files.map(f => f.language))],
          complexity: files.reduce((sum, f) => sum + (f.complexity?.cyclomatic || 0), 0)
        });
      }
    });
    
    return components;
  }
  
  /**
   * Identify technologies
   */
  identifyTechnologies(structure) {
    const technologies = {
      languages: [...new Set(structure.files.map(f => f.language))],
      frameworks: [],
      libraries: [],
      tools: []
    };
    
    // Identify frameworks and libraries from file patterns
    structure.files.forEach(file => {
      if (file.name.includes('package.json')) {
        technologies.tools.push('npm');
      }
      if (file.name.includes('requirements.txt')) {
        technologies.tools.push('pip');
      }
      if (file.name.includes('pom.xml')) {
        technologies.tools.push('maven');
      }
      if (file.name.includes('build.gradle')) {
        technologies.tools.push('gradle');
      }
    });
    
    return technologies;
  }
  
  /**
   * Identify patterns
   */
  identifyPatterns(structure) {
    const patterns = [];
    
    // Check for common design patterns
    const patternChecks = {
      'Singleton': structure.files.some(f => f.content?.includes('getInstance')),
      'Factory': structure.files.some(f => f.content?.includes('Factory')),
      'Observer': structure.files.some(f => f.content?.includes('addEventListener')),
      'Strategy': structure.files.some(f => f.content?.includes('Strategy')),
      'Decorator': structure.files.some(f => f.content?.includes('Decorator'))
    };
    
    Object.entries(patternChecks).forEach(([pattern, hasPattern]) => {
      if (hasPattern) {
        patterns.push(pattern);
      }
    });
    
    return patterns;
  }
  
  /**
   * Calculate repository metrics
   */
  calculateRepositoryMetrics(structure) {
    const totalFiles = structure.files.length;
    const totalDirectories = structure.directories.length;
    const totalSize = structure.files.reduce((sum, f) => sum + (f.size || 0), 0);
    const totalLines = structure.files.reduce((sum, f) => sum + (f.metadata?.lines || 0), 0);
    const totalComplexity = structure.files.reduce((sum, f) => sum + (f.complexity?.cyclomatic || 0), 0);
    
    return {
      files: totalFiles,
      directories: totalDirectories,
      size: totalSize,
      lines: totalLines,
      complexity: totalComplexity,
      averageFileSize: totalSize / totalFiles,
      averageLinesPerFile: totalLines / totalFiles,
      averageComplexity: totalComplexity / totalFiles
    };
  }
  
  /**
   * Generate recommendations
   */
  generateRecommendations(structure) {
    const recommendations = [];
    
    // Check for large files
    const largeFiles = structure.files.filter(f => f.size > 100000); // 100KB
    if (largeFiles.length > 0) {
      recommendations.push({
        type: 'performance',
        message: `Consider splitting large files: ${largeFiles.map(f => f.name).join(', ')}`,
        priority: 'medium'
      });
    }
    
    // Check for high complexity files
    const complexFiles = structure.files.filter(f => f.complexity?.cyclomatic > 20);
    if (complexFiles.length > 0) {
      recommendations.push({
        type: 'maintainability',
        message: `Consider refactoring complex files: ${complexFiles.map(f => f.name).join(', ')}`,
        priority: 'high'
      });
    }
    
    // Check for missing documentation
    const undocumentedFiles = structure.files.filter(f => !f.content?.includes('/*') && !f.content?.includes('//'));
    if (undocumentedFiles.length > structure.files.length * 0.5) {
      recommendations.push({
        type: 'documentation',
        message: 'Consider adding documentation to improve code maintainability',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Generate directory-level documentation
   */
  async generateDirectoryDocumentation(structure, rootPath) {
    const directoryDocs = [];
    
    for (const directory of structure.directories) {
      const dirDoc = {
        name: directory.name,
        path: directory.path,
        summary: this.generateDirectorySummary(directory, structure),
        files: structure.files.filter(f => f.path.startsWith(directory.path)),
        subdirectories: structure.directories.filter(d => d.parent === directory.path),
        metrics: this.calculateDirectoryMetrics(directory, structure),
        purpose: this.inferDirectoryPurpose(directory, structure)
      };
      
      directoryDocs.push(dirDoc);
    }
    
    return directoryDocs;
  }
  
  /**
   * Generate directory summary
   */
  generateDirectorySummary(directory, structure) {
    const files = structure.files.filter(f => f.path.startsWith(directory.path));
    const subdirs = structure.directories.filter(d => d.parent === directory.path);
    
    return {
      overview: `Directory ${directory.name} contains ${files.length} files and ${subdirs.length} subdirectories.`,
      fileTypes: [...new Set(files.map(f => f.extension))],
      languages: [...new Set(files.map(f => f.language))],
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0)
    };
  }
  
  /**
   * Calculate directory metrics
   */
  calculateDirectoryMetrics(directory, structure) {
    const files = structure.files.filter(f => f.path.startsWith(directory.path));
    
    return {
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + (f.size || 0), 0),
      totalLines: files.reduce((sum, f) => sum + (f.metadata?.lines || 0), 0),
      totalComplexity: files.reduce((sum, f) => sum + (f.complexity?.cyclomatic || 0), 0),
      averageFileSize: files.length > 0 ? files.reduce((sum, f) => sum + (f.size || 0), 0) / files.length : 0
    };
  }
  
  /**
   * Infer directory purpose
   */
  inferDirectoryPurpose(directory, structure) {
    const name = directory.name.toLowerCase();
    const files = structure.files.filter(f => f.path.startsWith(directory.path));
    
    if (name.includes('test')) return 'testing';
    if (name.includes('util')) return 'utilities';
    if (name.includes('service')) return 'services';
    if (name.includes('model')) return 'data models';
    if (name.includes('view')) return 'presentation layer';
    if (name.includes('controller')) return 'controllers';
    if (name.includes('config')) return 'configuration';
    if (name.includes('doc')) return 'documentation';
    
    return 'general purpose';
  }
  
  /**
   * Generate file-level documentation
   */
  async generateFileDocumentation(structure, rootPath) {
    const fileDocs = [];
    
    for (const file of structure.files) {
      const fileDoc = {
        name: file.name,
        path: file.path,
        summary: this.generateFileSummary(file),
        symbols: file.symbols,
        relationships: file.relationships,
        complexity: file.complexity,
        metrics: file.metadata,
        purpose: this.inferFilePurpose(file),
        recommendations: this.generateFileRecommendations(file)
      };
      
      fileDocs.push(fileDoc);
    }
    
    return fileDocs;
  }
  
  /**
   * Generate file summary
   */
  generateFileSummary(file) {
    return {
      overview: `File ${file.name} contains ${file.symbols.length} symbols and has complexity ${file.complexity?.cyclomatic || 0}.`,
      language: file.language,
      size: file.size,
      lines: file.metadata?.lines || 0,
      symbols: file.symbols.length,
      complexity: file.complexity?.cyclomatic || 0
    };
  }
  
  /**
   * Infer file purpose
   */
  inferFilePurpose(file) {
    const name = file.name.toLowerCase();
    const content = file.content || '';
    
    if (name.includes('test')) return 'testing';
    if (name.includes('util')) return 'utilities';
    if (name.includes('service')) return 'service';
    if (name.includes('controller')) return 'controller';
    if (name.includes('model')) return 'data model';
    if (name.includes('config')) return 'configuration';
    if (name.includes('index')) return 'entry point';
    if (content.includes('export default')) return 'module';
    if (content.includes('class ')) return 'class definition';
    if (content.includes('function ')) return 'function definition';
    
    return 'general purpose';
  }
  
  /**
   * Generate file recommendations
   */
  generateFileRecommendations(file) {
    const recommendations = [];
    
    if (file.complexity?.cyclomatic > 20) {
      recommendations.push({
        type: 'complexity',
        message: 'Consider refactoring to reduce complexity',
        priority: 'high'
      });
    }
    
    if (file.size > 100000) { // 100KB
      recommendations.push({
        type: 'size',
        message: 'Consider splitting into smaller files',
        priority: 'medium'
      });
    }
    
    if (!file.content?.includes('/*') && !file.content?.includes('//')) {
      recommendations.push({
        type: 'documentation',
        message: 'Consider adding documentation',
        priority: 'low'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Generate relationship documentation
   */
  async generateRelationshipDocumentation(structure) {
    const relationships = [];
    
    // Analyze relationships between files
    for (const file of structure.files) {
      if (file.relationships) {
        file.relationships.forEach(rel => {
          relationships.push({
            source: file.path,
            target: rel.target,
            type: rel.type,
            strength: rel.strength
          });
        });
      }
    }
    
    return relationships;
  }
  
  /**
   * Get documentation for a specific path
   */
  getDocumentation(rootPath) {
    return this.documentationCache.get(rootPath) || null;
  }
  
  /**
   * Get generation statistics
   */
  getStats() {
    return {
      cachedDocumentations: this.documentationCache.size,
      generationHistory: this.generationHistory.length,
      averageGenerationTime: this.generationHistory.length > 0 
        ? this.generationHistory.reduce((sum, h) => sum + h.files, 0) / this.generationHistory.length 
        : 0
    };
  }
  
  /**
   * Clear all data
   */
  clear() {
    this.documentationCache.clear();
    this.symbolMap.clear();
    this.relationshipGraph.clear();
    this.contextCache.clear();
    this.generationHistory = [];
    
    console.log('🧹 Hierarchical Documentation Generator cleared');
  }
}

module.exports = HierarchicalDocumentationGenerator;

