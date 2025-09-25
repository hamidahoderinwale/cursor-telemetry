/**
 * Notebook Generator Service
 * Creates executable Jupyter notebooks from session data
 */

const fs = require('fs').promises;
const path = require('path');

class NotebookGenerator {
  constructor(options = {}) {
    this.options = {
      outputDir: options.outputDir || path.join(process.cwd(), 'generated-notebooks'),
      includeMetadata: options.includeMetadata !== false,
      includeConversations: options.includeConversations !== false,
      includeFileChanges: options.includeFileChanges !== false,
      ...options
    };
    
    // Ensure output directory exists
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.options.outputDir, { recursive: true });
    } catch (error) {
      console.error('Error creating output directory:', error);
    }
  }

  /**
   * Generate executable notebook from session
   */
  async generateNotebook(sessionId, sessionData = null) {
    try {
      // Load session data if not provided
      if (!sessionData) {
        sessionData = await this.loadSessionData(sessionId);
      }

      if (!sessionData) {
        throw new Error(`Session ${sessionId} not found`);
      }

      console.log(`Generating notebook for session: ${sessionId}`);
      
      // Generate notebook cells from session data
      const cells = await this.generateCells(sessionData);
      
      // Build notebook structure
      const notebook = this.buildNotebook(cells, sessionData);
      
      // Save notebook to file
      const filename = `session-${sessionId}-${new Date().toISOString().split('T')[0]}.ipynb`;
      const filepath = path.join(this.options.outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(notebook, null, 2));
      
      console.log(`Notebook generated: ${filepath}`);
      
      return {
        success: true,
        filepath: filepath,
        filename: filename,
        notebook: notebook,
        sessionId: sessionId,
        cellCount: cells.length
      };
    } catch (error) {
      console.error('Error generating notebook:', error);
      return {
        success: false,
        error: error.message,
        sessionId: sessionId
      };
    }
  }

  /**
   * Load session data from database
   */
  async loadSessionData(sessionId) {
    try {
      // Use the data storage service directly instead of fetch
      const DataStorage = require('../data-processing/data-storage');
      const dataStorage = new DataStorage();
      const sessions = await dataStorage.loadSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (session) {
        return session;
      }
      
      // Fallback to API if not found in local storage
      const response = await fetch(`http://localhost:3000/api/session/${sessionId}`);
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.status}`);
      }
      
      const data = await response.json();
      return data.success ? data.session : null;
    } catch (error) {
      console.error('Error loading session data:', error);
      return null;
    }
  }

  /**
   * Generate cells from session data
   */
  async generateCells(sessionData) {
    const cells = [];
    
    // 1. Import cell
    const importCell = this.createImportCell(sessionData);
    if (importCell) cells.push(importCell);
    
    // 2. Data loading cells
    const dataCells = this.createDataCells(sessionData);
    cells.push(...dataCells);
    
    // 3. Analysis cells from code deltas
    const analysisCells = this.createAnalysisCells(sessionData);
    cells.push(...analysisCells);
    
    // 4. Visualization cells
    const vizCells = this.createVisualizationCells(sessionData);
    cells.push(...vizCells);
    
    // 5. Documentation cell
    const docCell = this.createDocumentationCell(sessionData);
    if (docCell) cells.push(docCell);
    
    // 6. Memory/insights cell
    const memoryCell = this.createMemoryCell(sessionData);
    if (memoryCell) cells.push(memoryCell);
    
    return cells;
  }

  /**
   * Create import cell from session data
   */
  createImportCell(sessionData) {
    const imports = new Set();
    
    // Extract imports from code deltas
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      sessionData.codeDeltas.forEach(delta => {
        if (delta.content) {
          const importMatches = delta.content.match(/^(import|from)\s+[\w\s,\.]+/gm);
          if (importMatches) {
            importMatches.forEach(imp => imports.add(imp));
          }
        }
      });
    }
    
    // Extract imports from file changes
    if (sessionData.fileChanges && Array.isArray(sessionData.fileChanges)) {
      sessionData.fileChanges.forEach(change => {
        if (change.afterSnippet) {
          const importMatches = change.afterSnippet.match(/^(import|from)\s+[\w\s,\.]+/gm);
          if (importMatches) {
            importMatches.forEach(imp => imports.add(imp));
          }
        }
      });
    }
    
    // Add common imports if none found
    if (imports.size === 0) {
      imports.add('import pandas as pd');
      imports.add('import numpy as np');
      imports.add('import matplotlib.pyplot as plt');
      imports.add('import seaborn as sns');
    }
    
    const importCode = Array.from(imports).join('\n');
    
    return {
      cell_type: 'code',
      execution_count: null,
      metadata: {},
      outputs: [],
      source: [importCode + '\n']
    };
  }

  /**
   * Create data loading cells
   */
  createDataCells(sessionData) {
    const cells = [];
    
    // Look for data files in file changes
    if (sessionData.fileChanges && Array.isArray(sessionData.fileChanges)) {
      const dataFiles = new Set();
      
      sessionData.fileChanges.forEach(change => {
        if (change.file && this.isDataFile(change.file)) {
          dataFiles.add(change.file);
        }
      });
      
      // Create data loading cells
      dataFiles.forEach(file => {
        const extension = path.extname(file).toLowerCase();
        let loadCode = '';
        
        switch (extension) {
          case '.csv':
            loadCode = `# Load CSV data\n${path.basename(file, '.csv')} = pd.read_csv('${file}')\nprint(f"Loaded {${path.basename(file, '.csv')}.shape[0]} rows, {${path.basename(file, '.csv')}.shape[1]} columns")`;
            break;
          case '.json':
            loadCode = `# Load JSON data\n${path.basename(file, '.json')} = pd.read_json('${file}')\nprint(f"Loaded {${path.basename(file, '.json')}.shape[0]} rows, {${path.basename(file, '.json')}.shape[1]} columns")`;
            break;
          case '.xlsx':
          case '.xls':
            loadCode = `# Load Excel data\n${path.basename(file, extension)} = pd.read_excel('${file}')\nprint(f"Loaded {${path.basename(file, extension)}.shape[0]} rows, {${path.basename(file, extension)}.shape[1]} columns")`;
            break;
          default:
            loadCode = `# Load data file\n# File: ${file}\n# Add appropriate loading code for ${extension} files`;
        }
        
        cells.push({
          cell_type: 'code',
          execution_count: null,
          metadata: {},
          outputs: [],
          source: [loadCode + '\n']
        });
      });
    }
    
    return cells;
  }

  /**
   * Create analysis cells from code deltas
   */
  createAnalysisCells(sessionData) {
    const cells = [];
    
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      sessionData.codeDeltas.forEach((delta, index) => {
        if (delta.content && delta.content.trim()) {
          // Add markdown cell with context
          const contextCell = {
            cell_type: 'markdown',
            metadata: {},
            source: [`## Analysis Step ${index + 1}\n\n**Timestamp:** ${delta.timestamp || 'Unknown'}\n**Type:** ${delta.type || 'code'}\n\n`]
          };
          cells.push(contextCell);
          
          // Add code cell
          const codeCell = {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            outputs: [],
            source: [delta.content + '\n']
          };
          cells.push(codeCell);
        }
      });
    }
    
    // If no code deltas, create cells from file changes
    if (cells.length === 0 && sessionData.fileChanges && Array.isArray(sessionData.fileChanges)) {
      sessionData.fileChanges.forEach((change, index) => {
        if (change.afterSnippet && change.afterSnippet.trim()) {
          const contextCell = {
            cell_type: 'markdown',
            metadata: {},
            source: [`## File Change ${index + 1}\n\n**File:** ${change.file || 'Unknown'}\n**Timestamp:** ${change.timestamp || 'Unknown'}\n\n`]
          };
          cells.push(contextCell);
          
          const codeCell = {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            outputs: [],
            source: [change.afterSnippet + '\n']
          };
          cells.push(codeCell);
        }
      });
    }
    
    return cells;
  }

  /**
   * Create visualization cells
   */
  createVisualizationCells(sessionData) {
    const cells = [];
    
    // Look for visualization-related code
    const vizKeywords = ['plot', 'chart', 'graph', 'visualize', 'histogram', 'scatter', 'bar', 'line'];
    
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      sessionData.codeDeltas.forEach((delta, index) => {
        if (delta.content && vizKeywords.some(keyword => delta.content.toLowerCase().includes(keyword))) {
          const contextCell = {
            cell_type: 'markdown',
            metadata: {},
            source: [`## Visualization ${index + 1}\n\n**Type:** Data Visualization\n**Timestamp:** ${delta.timestamp || 'Unknown'}\n\n`]
          };
          cells.push(contextCell);
          
          const codeCell = {
            cell_type: 'code',
            execution_count: null,
            metadata: {},
            outputs: [],
            source: [delta.content + '\n']
          };
          cells.push(codeCell);
        }
      });
    }
    
    return cells;
  }

  /**
   * Create documentation cell
   */
  createDocumentationCell(sessionData) {
    const docContent = [];
    
    docContent.push('# Session Documentation');
    docContent.push('');
    docContent.push(`**Session ID:** ${sessionData.id}`);
    docContent.push(`**Intent:** ${sessionData.intent || 'Unknown'}`);
    docContent.push(`**Outcome:** ${sessionData.outcome || 'Unknown'}`);
    docContent.push(`**Timestamp:** ${sessionData.timestamp || 'Unknown'}`);
    docContent.push(`**Current File:** ${sessionData.currentFile || 'Unknown'}`);
    docContent.push('');
    
    if (sessionData.semanticAnalysis && sessionData.semanticAnalysis.primary_intent) {
      docContent.push('## Semantic Analysis');
      docContent.push(`**Primary Intent:** ${sessionData.semanticAnalysis.primary_intent}`);
      if (sessionData.semanticAnalysis.confidence) {
        docContent.push(`**Confidence:** ${(sessionData.semanticAnalysis.confidence * 100).toFixed(1)}%`);
      }
      docContent.push('');
    }
    
    if (sessionData.codeDeltas && sessionData.codeDeltas.length > 0) {
      docContent.push(`## Code Changes (${sessionData.codeDeltas.length} deltas)`);
      sessionData.codeDeltas.forEach((delta, index) => {
        docContent.push(`${index + 1}. **${delta.type || 'code'}** - ${delta.timestamp || 'Unknown'}`);
      });
      docContent.push('');
    }
    
    if (sessionData.fileChanges && sessionData.fileChanges.length > 0) {
      docContent.push(`## File Changes (${sessionData.fileChanges.length} files)`);
      sessionData.fileChanges.forEach((change, index) => {
        docContent.push(`${index + 1}. **${change.file || 'Unknown'}** - ${change.timestamp || 'Unknown'}`);
      });
      docContent.push('');
    }
    
    return {
      cell_type: 'markdown',
      metadata: {},
      source: docContent.map(line => line + '\n')
    };
  }

  /**
   * Create memory/insights cell
   */
  createMemoryCell(sessionData) {
    const insights = [];
    
    insights.push('# Session Insights & Memory');
    insights.push('');
    insights.push('## Key Patterns');
    
    // Extract patterns from code
    const patterns = this.extractPatterns(sessionData);
    patterns.forEach(pattern => {
      insights.push(`- ${pattern}`);
    });
    
    insights.push('');
    insights.push('## Recommendations');
    
    // Generate recommendations based on session data
    const recommendations = this.generateRecommendations(sessionData);
    recommendations.forEach(rec => {
      insights.push(`- ${rec}`);
    });
    
    insights.push('');
    insights.push('## Next Steps');
    insights.push('- Review the generated code above');
    insights.push('- Adapt imports and file paths as needed');
    insights.push('- Run cells sequentially to reproduce the analysis');
    insights.push('- Modify and extend the code for your specific needs');
    
    return {
      cell_type: 'markdown',
      metadata: {},
      source: insights.map(line => line + '\n')
    };
  }

  /**
   * Extract patterns from session data
   */
  extractPatterns(sessionData) {
    const patterns = [];
    
    // Look for common patterns in code
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      const allCode = sessionData.codeDeltas.map(d => d.content).join('\n');
      
      if (allCode.includes('pd.read_')) {
        patterns.push('Data loading with pandas');
      }
      if (allCode.includes('.describe()')) {
        patterns.push('Data exploration with describe()');
      }
      if (allCode.includes('plt.') || allCode.includes('sns.')) {
        patterns.push('Data visualization with matplotlib/seaborn');
      }
      if (allCode.includes('def ') || allCode.includes('class ')) {
        patterns.push('Function/class definition');
      }
      if (allCode.includes('try:') || allCode.includes('except:')) {
        patterns.push('Error handling with try/except');
      }
    }
    
    return patterns;
  }

  /**
   * Generate recommendations based on session data
   */
  generateRecommendations(sessionData) {
    const recommendations = [];
    
    // Check for missing imports
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      const allCode = sessionData.codeDeltas.map(d => d.content).join('\n');
      
      if (allCode.includes('pd.') && !allCode.includes('import pandas')) {
        recommendations.push('Add pandas import: import pandas as pd');
      }
      if (allCode.includes('np.') && !allCode.includes('import numpy')) {
        recommendations.push('Add numpy import: import numpy as np');
      }
      if (allCode.includes('plt.') && !allCode.includes('import matplotlib')) {
        recommendations.push('Add matplotlib import: import matplotlib.pyplot as plt');
      }
    }
    
    // General recommendations
    recommendations.push('Verify file paths are correct for your environment');
    recommendations.push('Check data file availability before running cells');
    recommendations.push('Consider adding error handling for data loading');
    
    return recommendations;
  }

  /**
   * Build notebook structure
   */
  buildNotebook(cells, sessionData) {
    return {
      cells: cells,
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3'
        },
        language_info: {
          name: 'python',
          version: '3.8.0'
        },
        session_info: {
          sessionId: sessionData.id,
          intent: sessionData.intent,
          outcome: sessionData.outcome,
          timestamp: sessionData.timestamp,
          generatedAt: new Date().toISOString()
        }
      },
      nbformat: 4,
      nbformat_minor: 4
    };
  }

  /**
   * Check if file is a data file
   */
  isDataFile(filename) {
    const dataExtensions = ['.csv', '.json', '.xlsx', '.xls', '.parquet', '.feather', '.h5', '.hdf5'];
    const ext = path.extname(filename).toLowerCase();
    return dataExtensions.includes(ext);
  }

  /**
   * Generate multiple notebooks from session list
   */
  async generateMultipleNotebooks(sessionIds) {
    const results = [];
    
    for (const sessionId of sessionIds) {
      try {
        const result = await this.generateNotebook(sessionId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          sessionId: sessionId
        });
      }
    }
    
    return results;
  }

  /**
   * Clean up old notebooks
   */
  async cleanupOldNotebooks(daysOld = 30) {
    try {
      const files = await fs.readdir(this.options.outputDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      for (const file of files) {
        if (file.endsWith('.ipynb')) {
          const filepath = path.join(this.options.outputDir, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            console.log(`Deleted old notebook: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up old notebooks:', error);
    }
  }
}

module.exports = { NotebookGenerator };
