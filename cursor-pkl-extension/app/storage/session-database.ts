import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { PKLSession, FileChangeEvent } from '../config/types';

/**
 * Session Database Manager
 * Handles storage and retrieval of PKL sessions in a local SQLite database
 */
export class SessionDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || this.getDefaultDbPath();
    this.ensureDatabaseDirectory();
  }

  private getDefaultDbPath(): string {
    const homeDir = process.env.HOME || '';
    const pklDir = path.join(homeDir, '.pkl');
    return path.join(pklDir, 'sessions.db');
  }

  private ensureDatabaseDirectory(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.createTables();
      console.log(`Session database initialized at: ${this.dbPath}`);
    } catch (error) {
      throw new Error(`Failed to initialize session database: ${error}`);
    }
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        intent TEXT NOT NULL,
        phase TEXT NOT NULL,
        outcome TEXT,
        confidence REAL NOT NULL,
        current_file TEXT,
        cursor_line INTEGER,
        cursor_character INTEGER,
        selected_text TEXT,
        privacy_mode INTEGER NOT NULL DEFAULT 0,
        user_consent INTEGER NOT NULL DEFAULT 1,
        data_retention INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      )
    `);

    // File changes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_changes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        before_snippet TEXT,
        after_snippet TEXT,
        start_line INTEGER NOT NULL DEFAULT 0,
        end_line INTEGER NOT NULL DEFAULT 0,
        git_hash TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      )
    `);

    // Code deltas table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_deltas (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        before_content TEXT,
        after_content TEXT,
        cell_index INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      )
    `);

    // Linked events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS linked_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        output TEXT,
        tag TEXT,
        classification TEXT,
        cell_index INTEGER,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      )
    `);

    // Annotations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        annotation TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions (timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessions_intent ON sessions (intent);
      CREATE INDEX IF NOT EXISTS idx_sessions_outcome ON sessions (outcome);
      CREATE INDEX IF NOT EXISTS idx_sessions_current_file ON sessions (current_file);
      CREATE INDEX IF NOT EXISTS idx_file_changes_session_id ON file_changes (session_id);
      CREATE INDEX IF NOT EXISTS idx_code_deltas_session_id ON code_deltas (session_id);
      CREATE INDEX IF NOT EXISTS idx_linked_events_session_id ON linked_events (session_id);
      CREATE INDEX IF NOT EXISTS idx_annotations_session_id ON annotations (session_id);
    `);
  }

  /**
   * Store a session in the database
   */
  async storeSession(session: PKLSession): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(() => {
      // Insert session
      this.db!.prepare(`
        INSERT OR REPLACE INTO sessions (
          id, timestamp, intent, phase, outcome, confidence, current_file,
          cursor_line, cursor_character, selected_text, privacy_mode,
          user_consent, data_retention, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      `).run(
        session.id,
        session.timestamp.getTime(),
        session.intent,
        session.phase,
        session.outcome || null,
        session.confidence,
        session.currentFile || null,
        session.cursorPosition?.line || null,
        session.cursorPosition?.character || null,
        session.selectedText || null,
        session.privacyMode ? 1 : 0,
        session.userConsent ? 1 : 0,
        session.dataRetention.getTime()
      );

      // Insert file changes
      for (const change of session.fileChanges) {
        this.db!.prepare(`
          INSERT OR REPLACE INTO file_changes (
            id, session_id, timestamp, file_path, change_type,
            before_snippet, after_snippet, start_line, end_line, git_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          change.id,
          change.sessionId,
          change.timestamp.getTime(),
          change.filePath,
          change.changeType,
          change.beforeSnippet || null,
          change.afterSnippet || null,
          change.lineRange.start,
          change.lineRange.end,
          change.gitHash || null
        );
      }

      // Insert code deltas
      for (const delta of session.codeDeltas) {
        this.db!.prepare(`
          INSERT OR REPLACE INTO code_deltas (
            id, session_id, timestamp, type, before_content, after_content, cell_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          delta.id,
          delta.sessionId,
          delta.timestamp.getTime(),
          delta.changeType,
          delta.beforeContent || null,
          delta.afterContent || null,
          null // cell_index not available in CodeDelta interface
        );
      }

      // Insert linked events
      for (const event of session.linkedEvents) {
        this.db!.prepare(`
          INSERT OR REPLACE INTO linked_events (
            id, session_id, timestamp, type, output, tag, classification, cell_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          event.id,
          event.sessionId,
          event.timestamp.getTime(),
          event.type,
          event.output || null,
          event.tag || null,
          event.classification || null,
          null // cell_index not available in LinkedEvent interface
        );
      }

      // Insert annotations
      for (const annotation of session.annotations) {
        this.db!.prepare(`
          INSERT OR REPLACE INTO annotations (id, session_id, annotation)
          VALUES (?, ?, ?)
        `).run(
          `annotation-${Date.now()}-${Math.random()}`,
          session.id,
          annotation
        );
      }
    });

    transaction();
  }

  /**
   * Store multiple sessions
   */
  async storeSessions(sessions: PKLSession[]): Promise<void> {
    for (const session of sessions) {
      await this.storeSession(session);
    }
  }

  /**
   * Retrieve all sessions
   */
  async getAllSessions(): Promise<PKLSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const sessions = this.db.prepare(`
      SELECT * FROM sessions 
      ORDER BY timestamp DESC
    `).all() as any[];

    return Promise.all(sessions.map(session => this.buildSessionFromDb(session)));
  }

  /**
   * Retrieve sessions with filters
   */
  async getSessions(filters: {
    intent?: string;
    outcome?: string;
    phase?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): Promise<PKLSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM sessions WHERE 1=1';
    const params: any[] = [];

    if (filters.intent) {
      query += ' AND intent = ?';
      params.push(filters.intent);
    }

    if (filters.outcome) {
      query += ' AND outcome = ?';
      params.push(filters.outcome);
    }

    if (filters.phase) {
      query += ' AND phase = ?';
      params.push(filters.phase);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate.getTime());
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate.getTime());
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const sessions = this.db.prepare(query).all(...params) as any[];
    return Promise.all(sessions.map(session => this.buildSessionFromDb(session)));
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    total: number;
    byIntent: Record<string, number>;
    byOutcome: Record<string, number>;
    byPhase: Record<string, number>;
    recentCount: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const total = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get() as { count: number };
    
    const byIntent = this.db.prepare(`
      SELECT intent, COUNT(*) as count 
      FROM sessions 
      GROUP BY intent
    `).all() as Array<{ intent: string; count: number }>;

    const byOutcome = this.db.prepare(`
      SELECT outcome, COUNT(*) as count 
      FROM sessions 
      WHERE outcome IS NOT NULL
      GROUP BY outcome
    `).all() as Array<{ outcome: string; count: number }>;

    const byPhase = this.db.prepare(`
      SELECT phase, COUNT(*) as count 
      FROM sessions 
      GROUP BY phase
    `).all() as Array<{ phase: string; count: number }>;

    const recentCount = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM sessions 
      WHERE timestamp >= ?
    `).get(Date.now() - 24 * 60 * 60 * 1000) as { count: number }; // Last 24 hours

    return {
      total: total.count,
      byIntent: Object.fromEntries(byIntent.map(item => [item.intent, item.count])),
      byOutcome: Object.fromEntries(byOutcome.map(item => [item.outcome, item.count])),
      byPhase: Object.fromEntries(byPhase.map(item => [item.phase, item.count])),
      recentCount: recentCount.count
    };
  }

  /**
   * Build a complete PKLSession from database records
   */
  private async buildSessionFromDb(dbSession: any): Promise<PKLSession> {
    if (!this.db) throw new Error('Database not initialized');

    // Get file changes
    const fileChanges = this.db.prepare(`
      SELECT * FROM file_changes WHERE session_id = ?
    `).all(dbSession.id) as any[];

    // Get code deltas
    const codeDeltas = this.db.prepare(`
      SELECT * FROM code_deltas WHERE session_id = ?
    `).all(dbSession.id) as any[];

    // Get linked events
    const linkedEvents = this.db.prepare(`
      SELECT * FROM linked_events WHERE session_id = ?
    `).all(dbSession.id) as any[];

    // Get annotations
    const annotations = this.db.prepare(`
      SELECT annotation FROM annotations WHERE session_id = ?
    `).all(dbSession.id) as Array<{ annotation: string }>;

    return {
      id: dbSession.id,
      timestamp: new Date(dbSession.timestamp),
      intent: dbSession.intent as any,
      phase: dbSession.phase as any,
      outcome: dbSession.outcome as any,
      confidence: dbSession.confidence,
      currentFile: dbSession.current_file,
      cursorPosition: dbSession.cursor_line !== null ? {
        line: dbSession.cursor_line,
        character: dbSession.cursor_character || 0
      } : undefined,
      selectedText: dbSession.selected_text,
      fileChanges: fileChanges.map(change => ({
        id: change.id,
        sessionId: change.session_id,
        timestamp: new Date(change.timestamp),
        filePath: change.file_path,
        changeType: change.change_type,
        beforeSnippet: change.before_snippet,
        afterSnippet: change.after_snippet,
        lineRange: {
          start: change.start_line,
          end: change.end_line
        },
        gitHash: change.git_hash
      })),
      codeDeltas: codeDeltas.map(delta => ({
        id: delta.id,
        sessionId: delta.session_id,
        timestamp: new Date(delta.timestamp),
        filePath: '', // Not available in database
        beforeContent: delta.before_content || '',
        afterContent: delta.after_content || '',
        diff: '', // Not available in database
        changeType: delta.type as 'added' | 'modified' | 'deleted',
        lineCount: 0 // Not available in database
      })),
      linkedEvents: linkedEvents.map(event => ({
        id: event.id,
        sessionId: event.session_id,
        timestamp: new Date(event.timestamp),
        type: event.type,
        output: event.output,
        tag: event.tag,
        classification: event.classification,
        filePath: event.file_path || undefined
      })),
      privacyMode: dbSession.privacy_mode === 1,
      userConsent: dbSession.user_consent === 1,
      dataRetention: new Date(dbSession.data_retention),
      annotations: annotations.map(a => ({
        id: nanoid(),
        sessionId: dbSession.id,
        timestamp: new Date(),
        content: a.annotation,
        tags: []
      }))
    };
  }

  /**
   * Delete old sessions based on data retention policy
   */
  async cleanupOldSessions(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.prepare(`
      DELETE FROM sessions 
      WHERE data_retention < ?
    `).run(Date.now());

    return result.changes;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    totalSessions: number;
    totalFileChanges: number;
    totalCodeDeltas: number;
    totalLinkedEvents: number;
    totalAnnotations: number;
    databaseSize: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM file_changes) as total_file_changes,
        (SELECT COUNT(*) FROM code_deltas) as total_code_deltas,
        (SELECT COUNT(*) FROM linked_events) as total_linked_events,
        (SELECT COUNT(*) FROM annotations) as total_annotations
    `).get() as any;

    const dbStats = fs.statSync(this.dbPath);

    return {
      totalSessions: stats.total_sessions,
      totalFileChanges: stats.total_file_changes,
      totalCodeDeltas: stats.total_code_deltas,
      totalLinkedEvents: stats.total_linked_events,
      totalAnnotations: stats.total_annotations,
      databaseSize: dbStats.size
    };
  }
}
