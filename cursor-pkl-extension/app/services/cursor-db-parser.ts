import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CONFIG, IntentType } from '../config/constants';
import { PKLSession, ConversationEvent, FileChangeEvent, CodeBlock, Position } from '../config/types';
import { nanoid } from 'nanoid';

/**
 * Cursor VCSB database parser
 * Extracts conversation data, file changes, and context from Cursor's database
 */
export class CursorDBParser {
  private db: Database.Database | null = null;
  private dbPath: string | null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || this.findCursorDB();
  }

  private findCursorDB(): string | null {
    const possiblePaths = [
      // Standard Cursor database locations
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/globalStorage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/workspaceStorage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/logs'),
      // Additional potential locations
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/History'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/Local Storage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/Session Storage'),
      // Check for any .db files in Cursor directory
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor')
    ];

    for (const basePath of possiblePaths) {
      if (fs.existsSync(basePath)) {
        const dbFiles = this.findSQLiteFiles(basePath);
        if (dbFiles.length > 0) {
          return dbFiles[0]; // Use the first found database
        }
      }
    }
    
    // No Cursor database found
    console.log('No Cursor database found. PKL Extension will run without Cursor integration.');
    return null;
  }

  private findSQLiteFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scanDir = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            scanDir(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.db')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    scanDir(dir);
    return files;
  }

  async connect(): Promise<void> {
    if (!this.dbPath) {
      console.log('No Cursor database path available. Skipping database connection.');
      // Try alternative conversation capture methods
      await this.initializeAlternativeCapture();
      return;
    }

    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file not found: ${this.dbPath}`);
    }

    try {
      this.db = new Database(this.dbPath, { readonly: true });
      this.validateSchema();
    } catch (error) {
      throw new Error(`Failed to connect to Cursor database: ${error}`);
    }
  }

  private validateSchema(): void {
    if (!this.db) throw new Error('Database not connected');

    try {
      // Check for common Cursor database tables
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('conversations', 'messages', 'file_contexts', 'sessions')
      `).all() as { name: string }[];

      if (tables.length === 0) {
        throw new Error('No recognized Cursor database tables found');
      }
    } catch (error) {
      throw new Error(`Database schema validation failed: ${error}`);
    }
  }

  async parseAllSessions(): Promise<PKLSession[]> {
    if (!this.db) {
      console.log('No Cursor database available. Returning empty sessions list.');
      return [];
    }

    const sessions: PKLSession[] = [];
    
    try {
      // Get conversations
      const conversations = this.getConversations();
      
      for (const conversation of conversations) {
        const session = await this.parseConversationToSession(conversation);
        if (session) {
          sessions.push(session);
        }
      }
    } catch (error) {
      console.error('Error parsing sessions:', error);
      throw error;
    }

    return sessions;
  }

  private getConversations(): any[] {
    if (!this.db) throw new Error('Database not connected');

    try {
      // Try different table structures
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE '%conversation%'
      `).all() as { name: string }[];

      if (tables.length === 0) {
        throw new Error('No conversation tables found');
      }

      const tableName = tables[0].name;
      return this.db.prepare(`SELECT * FROM ${tableName} ORDER BY created_at DESC`).all();
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  private async parseConversationToSession(conversation: any): Promise<PKLSession | null> {
    if (!this.db) return null;

    try {
      const sessionId = nanoid();
      const timestamp = new Date(conversation.created_at || conversation.timestamp || Date.now());
      
      // Get messages for this conversation
      const messages = this.getMessagesForConversation(conversation.id);
      
      if (messages.length === 0) return null;

      // Analyze conversation for intent and context
      const analysis = this.analyzeConversation(messages);
      
      // Create session
      const session: PKLSession = {
        id: sessionId,
        timestamp,
        intent: analysis.intent,
        phase: analysis.phase,
        outcome: analysis.outcome,
        confidence: analysis.confidence,
        currentFile: analysis.currentFile,
        cursorPosition: analysis.cursorPosition,
        selectedText: analysis.selectedText,
        fileChanges: [],
        codeDeltas: [],
        linkedEvents: [],
        privacyMode: false, // Will be determined by Cursor settings
        userConsent: true, // Assumed for existing data
        dataRetention: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        annotations: []
      };

      // Parse events and file changes
      session.fileChanges = this.parseFileChanges(messages, sessionId);
      session.linkedEvents = this.parseLinkedEvents(messages, sessionId);

      return session;
    } catch (error) {
      console.error('Error parsing conversation to session:', error);
      return null;
    }
  }

  private getMessagesForConversation(conversationId: string): any[] {
    if (!this.db) return [];

    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name LIKE '%message%'
      `).all() as { name: string }[];

      if (tables.length === 0) return [];

      const tableName = tables[0].name;
      return this.db.prepare(`
        SELECT * FROM ${tableName} 
        WHERE conversation_id = ? OR session_id = ?
        ORDER BY timestamp ASC
      `).all(conversationId, conversationId);
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  private analyzeConversation(messages: any[]): {
    intent: IntentType;
    phase: 'start' | 'middle' | 'success' | 'stuck';
    outcome?: 'success' | 'stuck' | 'in-progress';
    confidence: number;
    currentFile?: string;
    cursorPosition?: Position;
    selectedText?: string;
  } {
    const allText = messages.map(m => m.content || m.text || '').join(' ').toLowerCase();
    
    // Enhanced intent classification for data science workflows
    let intent: IntentType = 'explore';
    let maxScore = 0;
    
    // Extended keywords for Jupyter notebook workflows
    const dataScienceKeywords = {
      explore: ['explore', 'analyze', 'investigate', 'examine', 'visualize', 'plot', 'chart', 'graph', 'eda', 'exploratory', 'data analysis', 'explore data'],
      implement: ['implement', 'build', 'create', 'develop', 'train', 'model', 'algorithm', 'pipeline', 'function', 'class', 'def ', 'import ', 'from '],
      debug: ['debug', 'fix', 'error', 'traceback', 'exception', 'bug', 'issue', 'problem', 'troubleshoot', 'why is', 'not working'],
      refactor: ['refactor', 'optimize', 'improve', 'clean', 'restructure', 'reorganize', 'refactor', 'optimize', 'performance'],
      document: ['document', 'explain', 'comment', 'describe', 'docstring', 'markdown', 'note', 'what does', 'how does']
    };
    
    for (const [intentType, keywords] of Object.entries(dataScienceKeywords)) {
      const score = keywords.reduce((acc, keyword) => 
        acc + (allText.includes(keyword.toLowerCase()) ? 1 : 0), 0
      );
      
      if (score > maxScore) {
        maxScore = score;
        intent = intentType as IntentType;
      }
    }

    // Enhanced outcome detection for data science workflows
    let outcome: 'success' | 'stuck' | 'in-progress' | undefined;
    
    // Data science specific success patterns
    const dataScienceSuccessPatterns = [
      'success', 'completed', 'finished', 'done', 'no errors',
      'test passed', 'all tests passed', 'model trained', 'accuracy',
      'plot created', 'visualization complete', 'data loaded',
      'model saved', 'prediction complete', 'analysis complete',
      'chart generated', 'graph created', 'insights found'
    ];
    
    // Data science specific stuck patterns
    const dataScienceStuckPatterns = [
      'error', 'exception', 'traceback', 'failed', 'failed to',
      'not found', 'undefined', 'keyerror', 'valueerror',
      'timeout', 'memory error', 'kernel died', 'out of memory',
      'convergence failed', 'training failed', 'model failed'
    ];
    
    const hasSuccess = dataScienceSuccessPatterns.some(pattern => 
      allText.includes(pattern.toLowerCase())
    );
    const hasStuck = dataScienceStuckPatterns.some(pattern => 
      allText.includes(pattern.toLowerCase())
    );

    if (hasSuccess && !hasStuck) {
      outcome = 'success';
    } else if (hasStuck && !hasSuccess) {
      outcome = 'stuck';
    } else if (hasSuccess && hasStuck) {
      outcome = 'in-progress';
    }

    // Phase detection
    let phase: 'start' | 'middle' | 'success' | 'stuck' = 'start';
    if (messages.length > 3) {
      phase = 'middle';
    }
    if (outcome === 'success') {
      phase = 'success';
    } else if (outcome === 'stuck') {
      phase = 'stuck';
    }

    // Extract file context
    const fileMatch = allText.match(/([a-zA-Z0-9_\-/]+\.(py|js|ts|jsx|tsx|ipynb|md|json|yaml|yml))/);
    const currentFile = fileMatch ? fileMatch[1] : undefined;

    // Extract cursor position (if available in metadata)
    let cursorPosition: Position | undefined;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.metadata?.cursor) {
      cursorPosition = {
        line: lastMessage.metadata.cursor.line || 0,
        character: lastMessage.metadata.cursor.character || 0
      };
    }

    // Extract selected text
    const selectedText = lastMessage?.metadata?.selectedText || 
                        lastMessage?.metadata?.selection ||
                        undefined;

    return {
      intent,
      phase,
      outcome,
      confidence: Math.min(maxScore / 3, 1), // Normalize to 0-1
      currentFile,
      cursorPosition,
      selectedText
    };
  }

  private parseFileChanges(messages: any[], sessionId: string): FileChangeEvent[] {
    const changes: FileChangeEvent[] = [];
    
    for (const message of messages) {
      if (message.metadata?.fileChanges) {
        for (const change of message.metadata.fileChanges) {
          changes.push({
            id: nanoid(),
            sessionId,
            timestamp: new Date(message.timestamp || Date.now()),
            filePath: change.filePath || change.path,
            changeType: change.type || 'modified',
            beforeSnippet: change.before,
            afterSnippet: change.after,
            lineRange: {
              start: change.startLine || 0,
              end: change.endLine || 0
            },
            gitHash: change.gitHash
          });
        }
      }
    }

    return changes;
  }

  private parseLinkedEvents(messages: any[], sessionId: string): any[] {
    const events: any[] = [];
    
    for (const message of messages) {
      // Parse terminal output for events
      if (message.content) {
        const content = message.content.toLowerCase();
        
        // Check for code execution
        if (content.includes('>>>') || content.includes('$') || content.includes('>')) {
          events.push({
            id: nanoid(),
            sessionId,
            timestamp: new Date(message.timestamp || Date.now()),
            type: 'code_run',
            output: message.content,
            tag: 'code_execution',
            classification: 'terminal_output'
          });
        }

        // Check for test results
        if (CONFIG.SUCCESS_PATTERNS.some(p => content.includes(p.toLowerCase()))) {
          events.push({
            id: nanoid(),
            sessionId,
            timestamp: new Date(message.timestamp || Date.now()),
            type: 'success',
            output: message.content,
            tag: 'test_success',
            classification: 'positive_outcome'
          });
        }

        if (CONFIG.STUCK_PATTERNS.some(p => content.includes(p.toLowerCase()))) {
          events.push({
            id: nanoid(),
            sessionId,
            timestamp: new Date(message.timestamp || Date.now()),
            type: 'error',
            output: message.content,
            tag: 'test_failure',
            classification: 'negative_outcome'
          });
        }
      }
    }

    return events;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Monitor Cursor database for new conversations in real-time
   */
  async startConversationMonitoring(callback: (conversations: ConversationEvent[]) => void): Promise<void> {
    if (!this.db) {
      console.log('Cursor database not available for conversation monitoring');
      return;
    }

    try {
      // Check for new conversations every 5 seconds
      setInterval(async () => {
        try {
          const newConversations = await this.getNewConversations();
          if (newConversations.length > 0) {
            console.log(`Found ${newConversations.length} new conversations`);
            callback(newConversations);
          }
        } catch (error) {
          console.error('Error monitoring conversations:', error);
        }
      }, 5000);

      console.log('Started conversation monitoring');
    } catch (error) {
      console.error('Failed to start conversation monitoring:', error);
    }
  }

  /**
   * Get conversations that haven't been processed yet
   */
  private async getNewConversations(): Promise<ConversationEvent[]> {
    if (!this.db) return [];

    try {
      // Get the latest conversation timestamp we've seen
      const lastProcessed = this.getLastProcessedTimestamp();
      
      // Query for new conversations since last check
      const conversations = this.db.prepare(`
        SELECT * FROM conversations 
        WHERE created_at > ? 
        ORDER BY created_at ASC
      `).all(lastProcessed);

      const conversationEvents: ConversationEvent[] = [];

      for (const conversation of conversations) {
        const conv = conversation as any;
        const messages = this.getMessagesForConversation(conv.id);
        
        // Convert each message to a ConversationEvent
        for (const message of messages) {
          const msg = message as any;
          const event: ConversationEvent = {
            id: msg.id || nanoid(),
            sessionId: conv.id,
            timestamp: new Date(msg.timestamp || msg.created_at || Date.now()),
            role: this.determineMessageRole(msg),
            content: msg.content || msg.text || msg.message || '',
            metadata: {
              conversationId: conv.id,
              messageId: msg.id,
              fileContext: this.extractFileContext(msg),
              cellIndex: this.extractCellIndex(msg)
            },
            referencedFiles: this.extractReferencedFiles(msg.content || msg.text || ''),
            codeBlocks: this.extractCodeBlocks(msg.content || msg.text || '')
          };
          
          conversationEvents.push(event);
        }
      }

      // Update last processed timestamp
      if (conversations.length > 0) {
        const lastConv = conversations[conversations.length - 1] as any;
        this.updateLastProcessedTimestamp(lastConv.created_at);
      }

      return conversationEvents;
    } catch (error) {
      console.error('Error getting new conversations:', error);
      return [];
    }
  }

  private determineMessageRole(message: any): 'user' | 'assistant' {
    // Determine if message is from user or assistant based on Cursor's structure
    if (message.role) {
      return message.role === 'user' ? 'user' : 'assistant';
    }
    
    // Fallback: check content patterns
    const content = (message.content || message.text || '').toLowerCase();
    if (content.includes('assistant:') || content.includes('ai:')) {
      return 'assistant';
    }
    
    return 'user';
  }

  private extractFileContext(message: any): string | undefined {
    // Extract file context from message metadata
    return message.file_path || message.fileContext || message.current_file;
  }

  private extractCellIndex(message: any): number | undefined {
    // Extract cell index if available
    return message.cell_index || message.cellIndex;
  }

  private getLastProcessedTimestamp(): string {
    // Get last processed timestamp from a simple file
    try {
      const fs = require('fs');
      const path = require('path');
      const timestampFile = path.join(process.env.HOME || '', '.pkl', 'last_conversation_timestamp.txt');
      
      if (fs.existsSync(timestampFile)) {
        return fs.readFileSync(timestampFile, 'utf8').trim();
      }
    } catch (error) {
      console.error('Error reading last processed timestamp:', error);
    }
    
    // Default to 1 hour ago
    return new Date(Date.now() - 60 * 60 * 1000).toISOString();
  }

  private updateLastProcessedTimestamp(timestamp: string): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const timestampFile = path.join(process.env.HOME || '', '.pkl', 'last_conversation_timestamp.txt');
      const dir = path.dirname(timestampFile);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(timestampFile, timestamp);
    } catch (error) {
      console.error('Error updating last processed timestamp:', error);
    }
  }

  private extractReferencedFiles(content: string): string[] {
    // Extract file references from content
    const filePattern = /\/[^\s]+\.[a-zA-Z0-9]+/g;
    const matches = content.match(filePattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  private extractCodeBlocks(content: string): CodeBlock[] {
    // Extract code blocks from content
    const codePattern = /```[\s\S]*?```/g;
    const matches = content.match(codePattern) || [];
    return matches.map((block, index) => ({
      id: `code-${index}`,
      language: this.detectLanguage(block),
      content: block.replace(/```/g, '').trim(),
      lineRange: { start: 0, end: 0 }
    }));
  }

  private detectLanguage(codeBlock: string): string {
    const match = codeBlock.match(/```(\w+)/);
    return match ? match[1] : 'text';
  }

  /**
   * Initialize alternative conversation capture methods when Cursor DB is not available
   */
  private async initializeAlternativeCapture(): Promise<void> {
    console.log('Initializing alternative conversation capture methods...');
    
    // Method 1: Monitor Cursor logs for conversation patterns
    await this.monitorCursorLogs();
    
    // Method 2: Set up file system monitoring for conversation files
    await this.monitorConversationFiles();
    
    // Method 3: Enable manual conversation input via API
    this.enableManualConversationCapture();
  }

  /**
   * Monitor Cursor logs for conversation patterns
   */
  private async monitorCursorLogs(): Promise<void> {
    const logPath = path.join(process.env.HOME || '', 'Library/Application Support/Cursor/logs');
    if (!fs.existsSync(logPath)) return;

    try {
      const logFiles = fs.readdirSync(logPath)
        .filter(file => file.endsWith('.log'))
        .sort()
        .slice(-3); // Monitor last 3 log files

      for (const logFile of logFiles) {
        const fullPath = path.join(logPath, logFile);
        this.monitorLogFile(fullPath);
      }
    } catch (error) {
      console.log('Could not monitor Cursor logs:', error);
    }
  }

  /**
   * Monitor a specific log file for conversation patterns
   */
  private monitorLogFile(logPath: string): void {
    try {
      // Watch for changes to the log file
      fs.watchFile(logPath, { interval: 5000 }, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          this.parseLogForConversations(logPath);
        }
      });
    } catch (error) {
      console.log(`Could not watch log file ${logPath}:`, error);
    }
  }

  /**
   * Parse log file for conversation patterns
   */
  private parseLogForConversations(logPath: string): void {
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      const lines = content.split('\n');
      
      // Look for conversation patterns in recent lines
      const recentLines = lines.slice(-100); // Last 100 lines
      
      for (const line of recentLines) {
        if (this.isConversationLine(line)) {
          this.extractConversationFromLogLine(line);
        }
      }
    } catch (error) {
      // Log file might be locked or inaccessible
    }
  }

  /**
   * Check if a log line contains conversation data
   */
  private isConversationLine(line: string): boolean {
    const conversationPatterns = [
      /user.*prompt/i,
      /assistant.*response/i,
      /chat.*message/i,
      /ai.*reply/i,
      /conversation.*start/i,
      /cursor.*ai/i
    ];
    
    return conversationPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Extract conversation data from a log line
   */
  private extractConversationFromLogLine(line: string): void {
    // This would parse the log line and create conversation events
    // Implementation depends on Cursor's actual log format
    console.log('Found potential conversation in log:', line.substring(0, 100));
  }

  /**
   * Monitor conversation files in Cursor directory
   */
  private async monitorConversationFiles(): Promise<void> {
    const cursorDir = path.join(process.env.HOME || '', 'Library/Application Support/Cursor');
    if (!fs.existsSync(cursorDir)) return;

    try {
      // Look for any files that might contain conversation data
      const files = fs.readdirSync(cursorDir, { recursive: true })
        .filter((file: any) => 
          typeof file === 'string' && (
            file.includes('conversation') || 
            file.includes('chat') || 
            file.includes('ai') ||
            file.endsWith('.json')
          )
        );

      for (const file of files) {
        if (typeof file === 'string') {
          const fullPath = path.join(cursorDir, file);
          this.monitorConversationFile(fullPath);
        }
      }
    } catch (error) {
      console.log('Could not monitor conversation files:', error);
    }
  }

  /**
   * Monitor a specific conversation file
   */
  private monitorConversationFile(filePath: string): void {
    try {
      fs.watchFile(filePath, { interval: 2000 }, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          this.parseConversationFile(filePath);
        }
      });
    } catch (error) {
      console.log(`Could not watch conversation file ${filePath}:`, error);
    }
  }

  /**
   * Parse a conversation file for data
   */
  private parseConversationFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Look for conversation-like structures
      if (this.isConversationData(data)) {
        this.processConversationData(data, filePath);
      }
    } catch (error) {
      // File might not be JSON or might be locked
    }
  }

  /**
   * Check if data looks like conversation data
   */
  private isConversationData(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    
    // Look for conversation-like properties
    const conversationKeys = ['messages', 'conversations', 'chat', 'prompts', 'responses'];
    return conversationKeys.some(key => key in data);
  }

  /**
   * Process conversation data
   */
  private processConversationData(data: any, filePath: string): void {
    console.log('Found conversation data in:', filePath);
    // This would process the conversation data and create conversation events
  }

  /**
   * Enable manual conversation capture via API
   */
  private enableManualConversationCapture(): void {
    console.log('Manual conversation capture enabled via API endpoints');
    console.log('Use POST /api/conversations to manually add conversation data');
  }
}
