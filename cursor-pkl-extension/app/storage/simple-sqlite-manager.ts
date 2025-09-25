import Database from 'better-sqlite3';
import path from 'path';
import { PKLSession, Annotation } from '../config/types';

/**
 * Simple SQLite manager for PKL Extension
 * Handles session storage and retrieval
 */
export class SimpleSQLiteManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'cursor_process_mining.db');
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.createTables();
      console.log('SQLite database initialized');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // Create sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        intent TEXT,
        phase TEXT,
        outcome TEXT,
        confidence REAL DEFAULT 0.5,
        current_file TEXT,
        cursor_position TEXT,
        selected_text TEXT,
        file_changes TEXT,
        code_deltas TEXT,
        linked_events TEXT,
        privacy_mode BOOLEAN DEFAULT 0,
        user_consent BOOLEAN DEFAULT 0,
        data_retention TEXT,
        annotations TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create annotations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `);
  }

  async saveSession(session: PKLSession): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        id, timestamp, intent, phase, outcome, confidence, current_file,
        cursor_position, selected_text, file_changes, code_deltas, linked_events,
        privacy_mode, user_consent, data_retention, annotations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.timestamp.toISOString(),
      session.intent,
      session.phase,
      session.outcome,
      session.confidence,
      session.currentFile,
      JSON.stringify(session.cursorPosition),
      session.selectedText,
      JSON.stringify(session.fileChanges),
      JSON.stringify(session.codeDeltas),
      JSON.stringify(session.linkedEvents),
      session.privacyMode,
      session.userConsent,
      session.dataRetention.toISOString(),
      JSON.stringify(session.annotations)
    );
  }

  async getSessions(): Promise<PKLSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM sessions ORDER BY timestamp DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      intent: row.intent,
      phase: row.phase,
      outcome: row.outcome,
      confidence: row.confidence || 0.5,
      currentFile: row.current_file,
      cursorPosition: row.cursor_position ? JSON.parse(row.cursor_position) : null,
      selectedText: row.selected_text,
      fileChanges: row.file_changes ? JSON.parse(row.file_changes) : [],
      codeDeltas: row.code_deltas ? JSON.parse(row.code_deltas) : [],
      linkedEvents: row.linked_events ? JSON.parse(row.linked_events) : [],
      privacyMode: row.privacy_mode || false,
      userConsent: row.user_consent || false,
      dataRetention: row.data_retention ? new Date(row.data_retention) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      annotations: row.annotations ? JSON.parse(row.annotations) : []
    }));
  }

  async getSessionById(id: string): Promise<PKLSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      intent: row.intent,
      phase: row.phase,
      outcome: row.outcome,
      confidence: row.confidence || 0.5,
      currentFile: row.current_file,
      cursorPosition: row.cursor_position ? JSON.parse(row.cursor_position) : null,
      selectedText: row.selected_text,
      fileChanges: row.file_changes ? JSON.parse(row.file_changes) : [],
      codeDeltas: row.code_deltas ? JSON.parse(row.code_deltas) : [],
      linkedEvents: row.linked_events ? JSON.parse(row.linked_events) : [],
      privacyMode: row.privacy_mode || false,
      userConsent: row.user_consent || false,
      dataRetention: row.data_retention ? new Date(row.data_retention) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      annotations: row.annotations ? JSON.parse(row.annotations) : []
    };
  }

  async searchSessions(query: string): Promise<PKLSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM sessions 
      WHERE intent LIKE ? OR phase LIKE ? OR outcome LIKE ? OR current_file LIKE ?
      ORDER BY timestamp DESC
    `);

    const searchTerm = `%${query}%`;
    const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm) as any[];

    return rows.map(row => ({
      id: row.id,
      timestamp: new Date(row.timestamp),
      intent: row.intent,
      phase: row.phase,
      outcome: row.outcome,
      confidence: row.confidence || 0.5,
      currentFile: row.current_file,
      cursorPosition: row.cursor_position ? JSON.parse(row.cursor_position) : null,
      selectedText: row.selected_text,
      fileChanges: row.file_changes ? JSON.parse(row.file_changes) : [],
      codeDeltas: row.code_deltas ? JSON.parse(row.code_deltas) : [],
      linkedEvents: row.linked_events ? JSON.parse(row.linked_events) : [],
      privacyMode: row.privacy_mode || false,
      userConsent: row.user_consent || false,
      dataRetention: row.data_retention ? new Date(row.data_retention) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      annotations: row.annotations ? JSON.parse(row.annotations) : []
    }));
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO annotations (id, session_id, content, tags)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      annotation.id,
      annotation.sessionId,
      annotation.content,
      JSON.stringify(annotation.tags)
    );
  }

  async getAnnotations(sessionId: string): Promise<Annotation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM annotations WHERE session_id = ? ORDER BY timestamp DESC');
    const rows = stmt.all(sessionId) as any[];

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      timestamp: new Date(row.timestamp)
    }));
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
