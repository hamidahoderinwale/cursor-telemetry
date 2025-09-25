import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { PKLSession, FileChangeEvent, Annotation } from '../config/types';
import { IntentType } from '../config/constants';

/**
 * Jupyter Notebook Session Parser
 * Extracts session data from .ipynb files including code execution, outputs, and patterns
 */
export class JupyterSessionParser {
  private watchedDirectories: string[] = [];
  private fileWatchers: Map<string, fs.FSWatcher> = new Map();
  private sessionCallbacks: ((sessions: PKLSession[]) => void)[] = [];

  constructor() {
    this.setupDefaultDirectories();
  }

  private setupDefaultDirectories(): void {
    // Add common Jupyter notebook locations
    const homeDir = process.env.HOME || '';
    this.watchedDirectories = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Documents'),
      path.join(homeDir, 'Downloads'),
      path.join(homeDir, 'Projects'),
      path.join(homeDir, 'Workspace'),
      // Additional common dev locations (from prior RealMonitor impl)
      path.join(homeDir, 'Code'),
      path.join(homeDir, 'Desktop/Projects'),
      path.join(homeDir, 'Documents/Code'),
      path.join(homeDir, 'updated_notebooks_for_cursor'),
      process.cwd(), // Current working directory
    ].filter(dir => fs.existsSync(dir));
  }

  /**
   * Add a directory to watch for .ipynb files
   */
  addWatchDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath) && !this.watchedDirectories.includes(dirPath)) {
      this.watchedDirectories.push(dirPath);
      this.startWatchingDirectory(dirPath);
    }
  }

  /**
   * Start monitoring all configured directories
   */
  startMonitoring(): void {
    console.log('Starting Jupyter notebook monitoring...');
    this.watchedDirectories.forEach(dir => this.startWatchingDirectory(dir));
    console.log(`Monitoring ${this.watchedDirectories.length} directories for .ipynb files`);
  }

  /**
   * Stop monitoring all directories
   */
  stopMonitoring(): void {
    this.fileWatchers.forEach(watcher => watcher.close());
    this.fileWatchers.clear();
    console.log('Stopped Jupyter notebook monitoring');
  }

  private startWatchingDirectory(dirPath: string): void {
    if (this.fileWatchers.has(dirPath)) return;

    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.ipynb')) {
          const fullPath = path.join(dirPath, filename);
          this.handleNotebookChange(eventType, fullPath);
        }
      });

      this.fileWatchers.set(dirPath, watcher);
      console.log(`Started watching: ${dirPath}`);
    } catch (error) {
      console.error(`Failed to watch directory ${dirPath}:`, error);
    }
  }

  private async handleNotebookChange(eventType: string, filePath: string): Promise<void> {
    try {
      if (eventType === 'change' && fs.existsSync(filePath)) {
        const sessions = await this.parseNotebookFile(filePath);
        if (sessions.length > 0) {
          this.notifySessionCallbacks(sessions);
        }
      }
    } catch (error) {
      console.error(`Error handling notebook change for ${filePath}:`, error);
    }
  }

  /**
   * Parse a single .ipynb file and extract sessions
   */
  async parseNotebookFile(filePath: string): Promise<PKLSession[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file is empty or too small to be a valid notebook
      if (!content.trim() || content.trim().length < 10) {
        console.log(`Skipping empty or too small notebook: ${filePath}`);
        return [];
      }
      
      // Check for basic JSON structure
      if (!content.trim().startsWith('{') || !content.trim().endsWith('}')) {
        console.log(`Skipping invalid JSON structure in notebook: ${filePath}`);
        return [];
      }
      
      let notebook;
      try {
        notebook = JSON.parse(content);
      } catch (parseError) {
        console.log(`Skipping notebook with JSON parse error: ${filePath} - ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        return [];
      }
      
      // Validate notebook structure
      if (!notebook || typeof notebook !== 'object' || !Array.isArray(notebook.cells)) {
        console.log(`Skipping notebook with invalid structure: ${filePath}`);
        return [];
      }
      
      return this.extractSessionsFromNotebook(notebook, filePath);
    } catch (error) {
      console.error(`Error parsing notebook ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extract sessions from a parsed notebook
   */
  private extractSessionsFromNotebook(notebook: any, filePath: string): PKLSession[] {
    const sessions: PKLSession[] = [];
    
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return sessions;
    }

    // Group cells into logical sessions based on execution patterns
    const cellGroups = this.groupCellsIntoSessions(notebook.cells);
    
    cellGroups.forEach((cellGroup, index) => {
      const session = this.createSessionFromCellGroup(cellGroup, filePath, index);
      if (session) {
        sessions.push(session);
      }
    });

    return sessions;
  }

  /**
   * Group notebook cells into logical sessions
   */
  private groupCellsIntoSessions(cells: any[]): any[][] {
    const groups: any[][] = [];
    let currentGroup: any[] = [];
    let lastExecutionTime: number | null = null;

    for (const cell of cells) {
      const executionTime = this.getCellExecutionTime(cell);
      
      // Start a new group if:
      // 1. This is the first cell
      // 2. There's a significant time gap (> 5 minutes)
      // 3. The cell type changes significantly (e.g., markdown to code)
      if (currentGroup.length === 0 || 
          (lastExecutionTime && executionTime && (executionTime - lastExecutionTime) > 300000) ||
          this.shouldStartNewGroup(currentGroup, cell)) {
        
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [cell];
      } else {
        currentGroup.push(cell);
      }
      
      lastExecutionTime = executionTime;
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  private getCellExecutionTime(cell: any): number | null {
    if (cell.execution_count && cell.metadata?.execution?.iopub?.timestamp) {
      return new Date(cell.metadata.execution.iopub.timestamp).getTime();
    }
    return null;
  }

  private shouldStartNewGroup(currentGroup: any[], newCell: any): boolean {
    if (currentGroup.length === 0) return false;
    
    const lastCell = currentGroup[currentGroup.length - 1];
    
    // Start new group if switching from markdown to code
    if (lastCell.cell_type === 'markdown' && newCell.cell_type === 'code') {
      return true;
    }
    
    // Start new group if there's a significant change in execution pattern
    if (newCell.cell_type === 'code' && newCell.execution_count && 
        lastCell.cell_type === 'code' && lastCell.execution_count) {
      const gap = newCell.execution_count - lastCell.execution_count;
      return gap > 10; // Large execution count gap
    }
    
    return false;
  }

  /**
   * Create a PKL session from a group of cells
   */
  private createSessionFromCellGroup(cellGroup: any[], filePath: string, groupIndex: number): PKLSession | null {
    if (cellGroup.length === 0) return null;

    const sessionId = nanoid();
    const firstCell = cellGroup[0];
    const lastCell = cellGroup[cellGroup.length - 1];
    
    // Determine session timestamp
    const timestamp = this.getCellExecutionTime(firstCell) || 
                     this.getCellExecutionTime(lastCell) || 
                     Date.now();

    // Analyze the session for intent and patterns
    const analysis = this.analyzeCellGroup(cellGroup);
    
    // Extract file changes and code deltas
    const fileChanges = this.extractFileChangesFromCells(cellGroup, sessionId);
    
    const session: PKLSession = {
      id: sessionId,
      timestamp: new Date(timestamp),
      intent: analysis.intent,
      phase: analysis.phase,
      outcome: analysis.outcome,
      confidence: analysis.confidence,
      currentFile: filePath,
      cursorPosition: this.extractCursorPosition(cellGroup),
      selectedText: this.extractSelectedText(cellGroup),
      fileChanges,
      codeDeltas: this.extractCodeDeltas(cellGroup, sessionId),
      linkedEvents: this.extractLinkedEvents(cellGroup, sessionId),
      privacyMode: false,
      userConsent: true,
      dataRetention: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      annotations: this.extractAnnotations(cellGroup)
    };

    return session;
  }

  /**
   * Analyze a group of cells to determine intent, phase, and outcome
   */
  private analyzeCellGroup(cellGroup: any[]): {
    intent: IntentType;
    phase: 'start' | 'middle' | 'success' | 'stuck';
    outcome?: 'success' | 'stuck' | 'in-progress';
    confidence: number;
  } {
    const allContent = cellGroup.map(cell => 
      cell.source ? (Array.isArray(cell.source) ? cell.source.join('') : cell.source) : ''
    ).join(' ').toLowerCase();

    // Enhanced intent classification for data science workflows
    let intent: IntentType = 'explore';
    let maxScore = 0;
    
    const dataScienceKeywords = {
      explore: [
        'import pandas', 'import numpy', 'import matplotlib', 'import seaborn',
        'df.head()', 'df.info()', 'df.describe()', 'df.shape', 'df.columns',
        'plot', 'chart', 'graph', 'visualize', 'eda', 'exploratory',
        'correlation', 'distribution', 'histogram', 'scatter', 'heatmap'
      ],
      implement: [
        'def ', 'class ', 'function', 'model', 'train', 'fit', 'predict',
        'sklearn', 'tensorflow', 'pytorch', 'keras', 'xgboost', 'lightgbm',
        'pipeline', 'preprocessing', 'feature', 'engineering'
      ],
      debug: [
        'error', 'exception', 'traceback', 'debug', 'print(', 'type(',
        'isinstance', 'try:', 'except:', 'raise', 'assert'
      ],
      refactor: [
        'refactor', 'optimize', 'performance', 'memory', 'efficient',
        'clean', 'restructure', 'reorganize'
      ],
      document: [
        '# ', '"""', "'''", 'markdown', 'explain', 'comment', 'docstring'
      ]
    };
    
    for (const [intentType, keywords] of Object.entries(dataScienceKeywords)) {
      const score = keywords.reduce((acc, keyword) => 
        acc + (allContent.includes(keyword.toLowerCase()) ? 1 : 0), 0
      );
      
      if (score > maxScore) {
        maxScore = score;
        intent = intentType as IntentType;
      }
    }

    // Determine outcome based on execution results
    let outcome: 'success' | 'stuck' | 'in-progress' | undefined;
    const hasErrors = cellGroup.some(cell => 
      cell.outputs && cell.outputs.some((output: any) => 
        output.output_type === 'error' || 
        (output.text && output.text.some((text: any) => 
          typeof text === 'string' && (
            text.includes('Error') || 
            text.includes('Exception') || 
            text.includes('Traceback')
          )
        ))
      )
    );

    const hasSuccess = cellGroup.some(cell => 
      cell.outputs && cell.outputs.some((output: any) => 
        output.output_type === 'execute_result' || 
        output.output_type === 'display_data'
      )
    );

    if (hasErrors && !hasSuccess) {
      outcome = 'stuck';
    } else if (hasSuccess && !hasErrors) {
      outcome = 'success';
    } else if (hasSuccess && hasErrors) {
      outcome = 'in-progress';
    }

    // Determine phase
    let phase: 'start' | 'middle' | 'success' | 'stuck' = 'start';
    if (cellGroup.length > 3) {
      phase = 'middle';
    }
    if (outcome === 'success') {
      phase = 'success';
    } else if (outcome === 'stuck') {
      phase = 'stuck';
    }

    return {
      intent,
      phase,
      outcome,
      confidence: Math.min(maxScore / 5, 1) // Normalize to 0-1
    };
  }

  private extractFileChangesFromCells(cellGroup: any[], sessionId: string): FileChangeEvent[] {
    const changes: FileChangeEvent[] = [];
    
    cellGroup.forEach((cell, index) => {
      if (cell.cell_type === 'code' && cell.source) {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        
        // Look for file operations
        const fileOps = this.extractFileOperations(source);
        fileOps.forEach(op => {
          changes.push({
            id: nanoid(),
            sessionId,
            timestamp: new Date(this.getCellExecutionTime(cell) || Date.now()),
            filePath: op.filePath,
            changeType: op.operation === 'read' ? 'created' : 'modified',
            beforeSnippet: '',
            afterSnippet: source,
            lineRange: { start: 0, end: 0 },
            gitHash: undefined
          });
        });
      }
    });

    return changes;
  }

  private extractFileOperations(source: string): Array<{filePath: string, operation: string}> {
    const operations: Array<{filePath: string, operation: string}> = [];
    
    // Look for common file operations
    const patterns = [
      { regex: /pd\.read_csv\(['"]([^'"]+)['"]/, operation: 'read' },
      { regex: /pd\.read_excel\(['"]([^'"]+)['"]/, operation: 'read' },
      { regex: /\.to_csv\(['"]([^'"]+)['"]/, operation: 'write' },
      { regex: /\.to_excel\(['"]([^'"]+)['"]/, operation: 'write' },
      { regex: /open\(['"]([^'"]+)['"]/, operation: 'read' },
      { regex: /with open\(['"]([^'"]+)['"]/, operation: 'read' }
    ];

    patterns.forEach(pattern => {
      const matches = source.match(pattern.regex);
      if (matches) {
        operations.push({
          filePath: matches[1],
          operation: pattern.operation
        });
      }
    });

    return operations;
  }

  private extractCodeDeltas(cellGroup: any[], sessionId: string): any[] {
    // Extract code changes between cells
    const deltas: any[] = [];
    
    for (let i = 1; i < cellGroup.length; i++) {
      const prevCell = cellGroup[i - 1];
      const currentCell = cellGroup[i];
      
      if (prevCell.cell_type === 'code' && currentCell.cell_type === 'code') {
        const prevSource = Array.isArray(prevCell.source) ? prevCell.source.join('') : prevCell.source;
        const currentSource = Array.isArray(currentCell.source) ? currentCell.source.join('') : currentCell.source;
        
        if (prevSource !== currentSource) {
          deltas.push({
            id: nanoid(),
            sessionId,
            timestamp: new Date(this.getCellExecutionTime(currentCell) || Date.now()),
            type: 'code_change',
            before: prevSource,
            after: currentSource,
            cellIndex: i
          });
        }
      }
    }

    return deltas;
  }

  private extractLinkedEvents(cellGroup: any[], sessionId: string): any[] {
    const events: any[] = [];
    
    cellGroup.forEach((cell, index) => {
      if (cell.outputs) {
        cell.outputs.forEach((output: any) => {
          if (output.output_type === 'error') {
            events.push({
              id: nanoid(),
              sessionId,
              timestamp: new Date(this.getCellExecutionTime(cell) || Date.now()),
              type: 'error',
              output: output.ename + ': ' + output.evalue,
              tag: 'execution_error',
              classification: 'negative_outcome',
              cellIndex: index
            });
          } else if (output.output_type === 'execute_result') {
            events.push({
              id: nanoid(),
              sessionId,
              timestamp: new Date(this.getCellExecutionTime(cell) || Date.now()),
              type: 'success',
              output: 'Cell executed successfully',
              tag: 'execution_success',
              classification: 'positive_outcome',
              cellIndex: index
            });
          }
        });
      }
    });

    return events;
  }

  private extractCursorPosition(cellGroup: any[]): { line: number; character: number } | undefined {
    // Extract cursor position from the last executed cell
    const lastExecutedCell = cellGroup
      .filter(cell => cell.execution_count)
      .pop();
    
    if (lastExecutedCell) {
      return {
        line: lastExecutedCell.execution_count || 0,
        character: 0
      };
    }
    
    return undefined;
  }

  private extractSelectedText(cellGroup: any[]): string | undefined {
    // Look for selected text patterns in cell sources
    for (const cell of cellGroup) {
      if (cell.source) {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        // Simple heuristic: if cell is very short, it might be selected text
        if (source.length < 100 && source.trim().length > 0) {
          return source.trim();
        }
      }
    }
    return undefined;
  }

  private extractAnnotations(cellGroup: any[]): Annotation[] {
    const annotations: Annotation[] = [];
    
    cellGroup.forEach(cell => {
      if (cell.cell_type === 'markdown' && cell.source) {
        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
        // Extract markdown headers as annotations
        const headers = source.match(/^#+\s+(.+)$/gm);
        if (headers) {
          headers.forEach(header => {
            annotations.push({
              id: nanoid(),
              sessionId: '', // Will be set by caller
              timestamp: new Date(),
              content: header.replace(/^#+\s+/, ''),
              tags: ['markdown', 'header']
            });
          });
        }
      }
    });

    return annotations;
  }

  /**
   * Register a callback for new sessions
   */
  onNewSessions(callback: (sessions: PKLSession[]) => void): void {
    this.sessionCallbacks.push(callback);
  }

  private notifySessionCallbacks(sessions: PKLSession[]): void {
    this.sessionCallbacks.forEach(callback => {
      try {
        callback(sessions);
      } catch (error) {
        console.error('Error in session callback:', error);
      }
    });
  }

  /**
   * Scan existing .ipynb files in watched directories
   */
  async scanExistingNotebooks(): Promise<PKLSession[]> {
    const allSessions: PKLSession[] = [];
    
    for (const dir of this.watchedDirectories) {
      const sessions = await this.scanDirectoryForNotebooks(dir);
      allSessions.push(...sessions);
    }
    
    return allSessions;
  }

  private async scanDirectoryForNotebooks(dirPath: string): Promise<PKLSession[]> {
    const sessions: PKLSession[] = [];
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subSessions = await this.scanDirectoryForNotebooks(fullPath);
          sessions.push(...subSessions);
        } else if (entry.isFile() && entry.name.endsWith('.ipynb')) {
          const fileSessions = await this.parseNotebookFile(fullPath);
          sessions.push(...fileSessions);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
    
    return sessions;
  }
}
