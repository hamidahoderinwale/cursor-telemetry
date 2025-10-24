const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Persistent Database for Companion Service
 * Stores entries, events, and prompts to SQLite
 */
class PersistentDB {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, '../data/companion.db');
    this.db = null;
    this._initPromise = null;
  }

  /**
   * Initialize database and create tables
   */
  async init() {
    if (this._initPromise) return this._initPromise;
    
    this._initPromise = new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('❌ Failed to open database:', err);
          reject(err);
          return;
        }
        
        console.log(`💾 Connected to SQLite database: ${this.dbPath}`);
        
        // Create tables - wait for all to complete before resolving
        this.db.serialize(() => {
          const tables = [];
          
          // Entries table
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS entries (
                id INTEGER PRIMARY KEY,
                session_id TEXT,
                workspace_path TEXT,
                file_path TEXT,
                source TEXT,
                before_code TEXT,
                after_code TEXT,
                notes TEXT,
                timestamp TEXT,
                tags TEXT,
                prompt_id INTEGER,
                modelInfo TEXT,
                type TEXT
              )
            `, (err) => {
              if (err) {
                console.error('Error creating entries table:', err);
                rej(err);
              } else {
                res();
              }
            });
          }));

          // Prompts table with rich metadata
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY,
                timestamp TEXT,
                text TEXT,
                status TEXT,
                linked_entry_id INTEGER,
                source TEXT,
                workspace_id TEXT,
                workspace_path TEXT,
                workspace_name TEXT,
                composer_id TEXT,
                subtitle TEXT,
                lines_added INTEGER DEFAULT 0,
                lines_removed INTEGER DEFAULT 0,
                context_usage REAL DEFAULT 0,
                mode TEXT,
                model_type TEXT,
                model_name TEXT,
                force_mode TEXT,
                is_auto INTEGER DEFAULT 0,
                type TEXT,
                confidence TEXT,
                added_from_database INTEGER DEFAULT 0
              )
            `, (err) => {
              if (err) {
                console.error('Error creating prompts table:', err);
                rej(err);
              } else {
                // Add new columns to existing table if they don't exist
                const alterQueries = [
                  `ALTER TABLE prompts ADD COLUMN workspace_id TEXT`,
                  `ALTER TABLE prompts ADD COLUMN workspace_path TEXT`,
                  `ALTER TABLE prompts ADD COLUMN workspace_name TEXT`,
                  `ALTER TABLE prompts ADD COLUMN composer_id TEXT`,
                  `ALTER TABLE prompts ADD COLUMN subtitle TEXT`,
                  `ALTER TABLE prompts ADD COLUMN lines_added INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN lines_removed INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN context_usage REAL DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN mode TEXT`,
                  `ALTER TABLE prompts ADD COLUMN model_type TEXT`,
                  `ALTER TABLE prompts ADD COLUMN model_name TEXT`,
                  `ALTER TABLE prompts ADD COLUMN force_mode TEXT`,
                  `ALTER TABLE prompts ADD COLUMN is_auto INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN type TEXT`,
                  `ALTER TABLE prompts ADD COLUMN confidence TEXT`,
                  `ALTER TABLE prompts ADD COLUMN added_from_database INTEGER DEFAULT 0`
                ];
                
                // Try to add each column, ignore if already exists
                alterQueries.forEach(query => {
                  this.db.run(query, (alterErr) => {
                    // Silently ignore "duplicate column" errors
                    if (alterErr && !alterErr.message.includes('duplicate column')) {
                      console.warn('Column may already exist:', alterErr.message);
                    }
                  });
                });
                
                res();
              }
            });
          }));

          // Events table (for detailed event tracking)
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                workspace_path TEXT,
                timestamp TEXT,
                type TEXT,
                details TEXT
              )
            `, (err) => {
              if (err) {
                console.error('Error creating events table:', err);
                rej(err);
              } else {
                res();
              }
            });
          }));

          // Create indexes for better query performance
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_entries_workspace ON entries(workspace_path)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_timestamp ON prompts(timestamp)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
          
          // Wait for all tables to be created
          Promise.all(tables).then(() => {
            console.log('✅ Database tables initialized');
            resolve();
          }).catch(reject);
        });
      });
    });

    return this._initPromise;
  }

  /**
   * Save an entry to the database
   */
  async saveEntry(entry) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO entries 
        (id, session_id, workspace_path, file_path, source, before_code, after_code, notes, timestamp, tags, prompt_id, modelInfo, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        entry.id,
        entry.session_id,
        entry.workspace_path,
        entry.file_path,
        entry.source,
        entry.before_code || entry.before_content,
        entry.after_code || entry.after_content,
        entry.notes || entry.description,
        entry.timestamp,
        Array.isArray(entry.tags) ? JSON.stringify(entry.tags) : entry.tags,
        entry.prompt_id,
        typeof entry.modelInfo === 'object' ? JSON.stringify(entry.modelInfo) : entry.modelInfo,
        entry.type
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving entry:', err);
          reject(err);
        } else {
          resolve(entry);
        }
      });
    });
  }

  /**
   * Save a prompt to the database with full metadata
   */
  async savePrompt(prompt) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO prompts 
        (id, timestamp, text, status, linked_entry_id, source,
         workspace_id, workspace_path, workspace_name, composer_id, subtitle,
         lines_added, lines_removed, context_usage, mode, model_type, model_name,
         force_mode, is_auto, type, confidence, added_from_database)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        prompt.id,
        prompt.timestamp,
        prompt.text || prompt.prompt || prompt.preview,
        prompt.status || 'captured',
        prompt.linked_entry_id || prompt.linkedEntryId || null,
        prompt.source || 'unknown',
        prompt.workspaceId || null,
        prompt.workspacePath || null,
        prompt.workspaceName || null,
        prompt.composerId || null,
        prompt.subtitle || null,
        prompt.linesAdded || 0,
        prompt.linesRemoved || 0,
        prompt.contextUsage || 0,
        prompt.mode || null,
        prompt.modelType || null,
        prompt.modelName || null,
        prompt.forceMode || null,
        prompt.isAuto ? 1 : 0,
        prompt.type || null,
        prompt.confidence || null,
        prompt.added_from_database ? 1 : 0
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving prompt:', err);
          reject(err);
        } else {
          resolve(prompt);
        }
      });
    });
  }

  /**
   * Save an event to the database
   */
  async saveEvent(event) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO events 
        (id, session_id, workspace_path, timestamp, type, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        event.id,
        event.session_id,
        event.workspace_path,
        event.timestamp,
        event.type,
        typeof event.details === 'object' ? JSON.stringify(event.details) : event.details
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving event:', err);
          reject(err);
        } else {
          resolve(event);
        }
      });
    });
  }

  /**
   * Load all entries from the database
   */
  async getAllEntries() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM entries ORDER BY timestamp DESC`, (err, rows) => {
        if (err) {
          console.error('Error loading entries:', err);
          reject(err);
        } else {
          // Parse JSON fields
          const entries = rows.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            modelInfo: row.modelInfo ? JSON.parse(row.modelInfo) : null
          }));
          resolve(entries);
        }
      });
    });
  }

  /**
   * Load all prompts from the database
   */
  async getAllPrompts() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM prompts ORDER BY timestamp DESC`, (err, rows) => {
        if (err) {
          console.error('Error loading prompts:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Load all events from the database
   */
  async getAllEvents() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM events ORDER BY timestamp DESC`, (err, rows) => {
        if (err) {
          console.error('Error loading events:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Update an entry
   */
  async updateEntry(id, updates) {
    await this.init();
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE entries SET ${fields} WHERE id = ?`,
        [...values, id],
        (err) => {
          if (err) {
            console.error('Error updating entry:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Update a prompt
   */
  async updatePrompt(id, updates) {
    await this.init();
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE prompts SET ${fields} WHERE id = ?`,
        [...values, id],
        (err) => {
          if (err) {
            console.error('Error updating prompt:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get database statistics
   */
  async getStats() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          (SELECT COUNT(*) FROM entries) as entries,
          (SELECT COUNT(*) FROM prompts) as prompts,
          (SELECT COUNT(*) FROM events) as events
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('💾 Database connection closed');
        }
      });
    }
  }
}

module.exports = PersistentDB;

