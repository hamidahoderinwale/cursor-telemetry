/**
 * File-Based Integration Service
 * Creates .cursor-session files for context restoration
 */

const fs = require('fs').promises;
const path = require('path');

class FileBasedIntegration {
  constructor(options = {}) {
    this.options = {
      sessionFilesDir: options.sessionFilesDir || path.join(process.cwd(), 'cursor-sessions'),
      notebookDir: options.notebookDir || path.join(process.cwd(), 'generated-notebooks'),
      ...options
    };
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    try {
      await fs.mkdir(this.options.sessionFilesDir, { recursive: true });
      await fs.mkdir(this.options.notebookDir, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  /**
   * Create .cursor-session file from session data
   */
  async createCursorSessionFile(sessionId, sessionData = null) {
    try {
      // Load session data if not provided
      if (!sessionData) {
        sessionData = await this.loadSessionData(sessionId);
      }

      if (!sessionData) {
        throw new Error(`Session ${sessionId} not found`);
      }

      console.log(`Creating .cursor-session file for session: ${sessionId}`);
      
      // Build session context
      const sessionContext = await this.buildSessionContext(sessionData);
      
      // Create .cursor-session file content
      const sessionFile = {
        version: '1.0',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        context: sessionContext,
        actions: this.generateActions(sessionData),
        metadata: {
          intent: sessionData.intent,
          outcome: sessionData.outcome,
          currentFile: sessionData.currentFile,
          generatedAt: new Date().toISOString()
        }
      };
      
      // Save to file
      const filename = `.cursor-session-${sessionId}.json`;
      const filepath = path.join(this.options.sessionFilesDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(sessionFile, null, 2));
      
      console.log(`Cursor session file created: ${filepath}`);
      
      return {
        success: true,
        filepath: filepath,
        filename: filename,
        sessionContext: sessionContext,
        sessionId: sessionId
      };
    } catch (error) {
      console.error('Error creating cursor session file:', error);
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
   * Build session context from session data
   */
  async buildSessionContext(sessionData) {
    const context = {
      workspace: this.extractWorkspace(sessionData),
      files: this.extractFiles(sessionData),
      cursorPosition: this.extractCursorPosition(sessionData),
      selectedText: this.extractSelectedText(sessionData),
      variables: this.extractVariables(sessionData),
      environment: this.extractEnvironment(sessionData),
      imports: this.extractImports(sessionData),
      dataFiles: this.extractDataFiles(sessionData)
    };
    
    return context;
  }

  /**
   * Extract workspace information
   */
  extractWorkspace(sessionData) {
    if (sessionData.currentFile) {
      return path.dirname(sessionData.currentFile);
    }
    
    // Try to extract from file changes
    if (sessionData.fileChanges && Array.isArray(sessionData.fileChanges)) {
      const firstFile = sessionData.fileChanges[0];
      if (firstFile && firstFile.file) {
        return path.dirname(firstFile.file);
      }
    }
    
    return process.cwd();
  }

  /**
   * Extract file information
   */
  extractFiles(sessionData) {
    const files = new Set();
    
    // Add current file
    if (sessionData.currentFile) {
      files.add(sessionData.currentFile);
    }
    
    // Add files from file changes
    if (sessionData.fileChanges && Array.isArray(sessionData.fileChanges)) {
      sessionData.fileChanges.forEach(change => {
        if (change.file) {
          files.add(change.file);
        }
      });
    }
    
    return Array.from(files);
  }

  /**
   * Extract cursor position
   */
  extractCursorPosition(sessionData) {
    // Try to extract from code deltas or file changes
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      const lastDelta = sessionData.codeDeltas[sessionData.codeDeltas.length - 1];
      if (lastDelta && lastDelta.position) {
        return lastDelta.position;
      }
    }
    
    // Default position
    return {
      line: 1,
      column: 1,
      file: sessionData.currentFile || ''
    };
  }

  /**
   * Extract selected text
   */
  extractSelectedText(sessionData) {
    // Look for recent code changes that might indicate selection
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      const lastDelta = sessionData.codeDeltas[sessionData.codeDeltas.length - 1];
      if (lastDelta && lastDelta.content) {
        // Return first few lines as potential selection
        const lines = lastDelta.content.split('\n');
        if (lines.length > 0) {
          return lines[0].trim();
        }
      }
    }
    
    return '';
  }

  /**
   * Extract variables from session data
   */
  extractVariables(sessionData) {
    const variables = {};
    
    // Look for variable assignments in code
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      sessionData.codeDeltas.forEach(delta => {
        if (delta.content) {
          const assignments = delta.content.match(/(\w+)\s*=\s*[^=\n]+/g);
          if (assignments) {
            assignments.forEach(assignment => {
              const match = assignment.match(/(\w+)\s*=\s*(.+)/);
              if (match) {
                variables[match[1]] = match[2].trim();
              }
            });
          }
        }
      });
    }
    
    return variables;
  }

  /**
   * Extract environment information
   */
  extractEnvironment(sessionData) {
    const environment = {
      python: '3.8',
      platform: process.platform,
      node: process.version
    };
    
    // Look for environment-specific code
    if (sessionData.codeDeltas && Array.isArray(sessionData.codeDeltas)) {
      const allCode = sessionData.codeDeltas.map(d => d.content).join('\n');
      
      if (allCode.includes('tensorflow') || allCode.includes('tf.')) {
        environment.tensorflow = true;
      }
      if (allCode.includes('torch') || allCode.includes('pytorch')) {
        environment.pytorch = true;
      }
      if (allCode.includes('sklearn') || allCode.includes('sklearn.')) {
        environment.sklearn = true;
      }
    }
    
    return environment;
  }

  /**
   * Extract imports from session data
   */
  extractImports(sessionData) {
    const imports = new Set();
    
    // Extract from code deltas
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
    
    // Extract from file changes
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
    
    return Array.from(imports);
  }

  /**
   * Extract data files from session data
   */
  extractDataFiles(sessionData) {
    const dataFiles = [];
    
    if (sessionData.fileChanges && Array.isArray(sessionData.fileChanges)) {
      sessionData.fileChanges.forEach(change => {
        if (change.file && this.isDataFile(change.file)) {
          dataFiles.push({
            path: change.file,
            type: path.extname(change.file).toLowerCase(),
            timestamp: change.timestamp
          });
        }
      });
    }
    
    return dataFiles;
  }

  /**
   * Generate actions for the session
   */
  generateActions(sessionData) {
    const actions = [];
    
    // Add file opening actions
    const files = this.extractFiles(sessionData);
    files.forEach(file => {
      actions.push({
        type: 'openFile',
        path: file,
        description: `Open file: ${path.basename(file)}`
      });
    });
    
    // Add cursor positioning action
    const cursorPos = this.extractCursorPosition(sessionData);
    if (cursorPos.file) {
      actions.push({
        type: 'setCursor',
        position: cursorPos,
        description: `Set cursor to line ${cursorPos.line}, column ${cursorPos.column}`
      });
    }
    
    // Add text selection action
    const selectedText = this.extractSelectedText(sessionData);
    if (selectedText) {
      actions.push({
        type: 'selectText',
        text: selectedText,
        description: `Select text: ${selectedText.substring(0, 50)}...`
      });
    }
    
    // Add import actions
    const imports = this.extractImports(sessionData);
    imports.forEach(imp => {
      actions.push({
        type: 'insertText',
        text: imp + '\n',
        description: `Add import: ${imp}`
      });
    });
    
    return actions;
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
   * Read and parse .cursor-session file
   */
  async readCursorSessionFile(sessionId) {
    try {
      const filename = `.cursor-session-${sessionId}.json`;
      const filepath = path.join(this.options.sessionFilesDir, filename);
      
      const content = await fs.readFile(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading cursor session file:', error);
      return null;
    }
  }

  /**
   * List all .cursor-session files
   */
  async listCursorSessionFiles() {
    try {
      const files = await fs.readdir(this.options.sessionFilesDir);
      return files.filter(file => file.startsWith('.cursor-session-') && file.endsWith('.json'));
    } catch (error) {
      console.error('Error listing cursor session files:', error);
      return [];
    }
  }

  /**
   * Delete .cursor-session file
   */
  async deleteCursorSessionFile(sessionId) {
    try {
      const filename = `.cursor-session-${sessionId}.json`;
      const filepath = path.join(this.options.sessionFilesDir, filename);
      
      await fs.unlink(filepath);
      console.log(`Deleted cursor session file: ${filename}`);
      return true;
    } catch (error) {
      console.error('Error deleting cursor session file:', error);
      return false;
    }
  }

  /**
   * Clean up old .cursor-session files
   */
  async cleanupOldSessionFiles(daysOld = 30) {
    try {
      const files = await this.listCursorSessionFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      for (const file of files) {
        const filepath = path.join(this.options.sessionFilesDir, file);
        const stats = await fs.stat(filepath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filepath);
          console.log(`Deleted old session file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old session files:', error);
    }
  }

  /**
   * Create comprehensive integration package
   */
  async createIntegrationPackage(sessionId, sessionData = null) {
    try {
      // Create .cursor-session file
      const sessionResult = await this.createCursorSessionFile(sessionId, sessionData);
      
      if (!sessionResult.success) {
        throw new Error(`Failed to create session file: ${sessionResult.error}`);
      }
      
      // Generate notebook (if NotebookGenerator is available)
      let notebookResult = null;
      try {
        const { NotebookGenerator } = require('./notebook-generator');
        const notebookGenerator = new NotebookGenerator({
          outputDir: this.options.notebookDir
        });
        notebookResult = await notebookGenerator.generateNotebook(sessionId, sessionData);
      } catch (error) {
        console.warn('Notebook generation not available:', error.message);
      }
      
      return {
        success: true,
        sessionId: sessionId,
        sessionFile: sessionResult,
        notebook: notebookResult,
        package: {
          sessionFile: sessionResult.filepath,
          notebook: notebookResult ? notebookResult.filepath : null,
          actions: sessionResult.sessionContext.actions || []
        }
      };
    } catch (error) {
      console.error('Error creating integration package:', error);
      return {
        success: false,
        error: error.message,
        sessionId: sessionId
      };
    }
  }
}

module.exports = { FileBasedIntegration };
