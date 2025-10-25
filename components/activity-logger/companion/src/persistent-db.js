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
        
        // Enable foreign key constraints
        this.db.run('PRAGMA foreign_keys = ON');
        
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

          // Context snapshots table for persistent context analytics
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS context_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id TEXT,
                timestamp INTEGER,
                file_count INTEGER DEFAULT 0,
                token_estimate INTEGER DEFAULT 0,
                truncated INTEGER DEFAULT 0,
                utilization_percent REAL DEFAULT 0,
                context_files TEXT,
                at_mentions TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) {
                console.error('Error creating context_snapshots table:', err);
                rej(err);
              } else {
                res();
              }
            });
          }));

          // Terminal commands table
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS terminal_commands (
                id TEXT PRIMARY KEY,
                command TEXT NOT NULL,
                shell TEXT,
                source TEXT,
                timestamp INTEGER NOT NULL,
                workspace TEXT,
                output TEXT,
                exit_code INTEGER,
                duration INTEGER,
                error TEXT,
                linked_entry_id INTEGER,
                linked_prompt_id INTEGER,
                session_id TEXT
              )
            `, (err) => {
              if (err) {
                console.error('Error creating terminal_commands table:', err);
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
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_entries_prompt_id ON entries(prompt_id)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_entries_file_path ON entries(file_path)`);
          
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_timestamp ON prompts(timestamp)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_linked_entry ON prompts(linked_entry_id)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_workspace ON prompts(workspace_path)`);
          
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_type ON events(type)`);
          
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_terminal_timestamp ON terminal_commands(timestamp)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_terminal_workspace ON terminal_commands(workspace)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_terminal_exit_code ON terminal_commands(exit_code)`);
          this.db.run(`CREATE INDEX IF NOT EXISTS idx_terminal_session ON terminal_commands(session_id)`);
          
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
   * Save a terminal command to the database
   */
  async saveTerminalCommand(command) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO terminal_commands 
        (id, command, shell, source, timestamp, workspace, output, exit_code, duration, error, linked_entry_id, linked_prompt_id, session_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        command.id,
        command.command,
        command.shell,
        command.source,
        command.timestamp,
        command.workspace,
        command.output,
        command.exitCode,
        command.duration,
        command.error,
        command.linkedEntryId || null,
        command.linkedPromptId || null,
        command.sessionId || null
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving terminal command:', err);
          reject(err);
        } else {
          resolve(command);
        }
      });
    });
  }

  /**
   * Get all terminal commands
   */
  async getAllTerminalCommands(limit = 500) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM terminal_commands ORDER BY timestamp DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            console.error('Error loading terminal commands:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  /**
   * Get terminal commands with filters
   */
  async getTerminalCommands(options = {}) {
    await this.init();
    
    const { limit = 100, source, since, workspace, exitCode } = options;
    let query = 'SELECT * FROM terminal_commands WHERE 1=1';
    const params = [];
    
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    if (since) {
      query += ' AND timestamp >= ?';
      params.push(since);
    }
    
    if (workspace) {
      query += ' AND workspace = ?';
      params.push(workspace);
    }
    
    if (exitCode !== undefined) {
      query += ' AND exit_code = ?';
      params.push(exitCode);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error querying terminal commands:', err);
          reject(err);
        } else {
          resolve(rows);
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
   * Get database statistics with linking information
   */
  async getStats() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          (SELECT COUNT(*) FROM entries) as entries,
          (SELECT COUNT(*) FROM prompts) as prompts,
          (SELECT COUNT(*) FROM events) as events,
          (SELECT COUNT(*) FROM entries WHERE prompt_id IS NOT NULL) as linked_entries,
          (SELECT COUNT(*) FROM prompts WHERE linked_entry_id IS NOT NULL) as linked_prompts,
          (SELECT COUNT(DISTINCT session_id) FROM entries WHERE session_id IS NOT NULL) as unique_sessions
      `, (err, row) => {
        if (err) {
          reject(err);
        } else {
          // Calculate percentages
          row.linked_entries_percent = row.entries > 0 ? (row.linked_entries / row.entries * 100).toFixed(2) : 0;
          row.linked_prompts_percent = row.prompts > 0 ? (row.linked_prompts / row.prompts * 100).toFixed(2) : 0;
          resolve(row);
        }
      });
    });
  }
  
  /**
   * Get entries with their linked prompts
   */
  async getEntriesWithPrompts(limit = 100) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          e.*,
          p.text as prompt_text,
          p.status as prompt_status,
          p.mode as prompt_mode,
          p.model_name as prompt_model,
          p.lines_added as prompt_lines_added,
          p.lines_removed as prompt_lines_removed
        FROM entries e
        LEFT JOIN prompts p ON e.prompt_id = p.id
        ORDER BY e.timestamp DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  /**
   * Get prompts with their linked entries
   */
  async getPromptsWithEntries(limit = 100) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          p.*,
          e.file_path as entry_file_path,
          e.timestamp as entry_timestamp,
          e.source as entry_source
        FROM prompts p
        LEFT JOIN entries e ON p.linked_entry_id = e.id
        ORDER BY p.timestamp DESC
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  /**
   * Validate database integrity
   */
  async validateIntegrity() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const checks = {
        orphaned_entry_prompts: 0,
        orphaned_prompt_entries: 0,
        null_timestamps: 0,
        duplicate_ids: 0
      };
      
      // Check for orphaned references
      this.db.get(`
        SELECT COUNT(*) as count 
        FROM entries 
        WHERE prompt_id IS NOT NULL 
          AND prompt_id NOT IN (SELECT id FROM prompts)
      `, (err, row) => {
        if (err) return reject(err);
        checks.orphaned_entry_prompts = row.count;
        
        this.db.get(`
          SELECT COUNT(*) as count 
          FROM prompts 
          WHERE linked_entry_id IS NOT NULL 
            AND linked_entry_id NOT IN (SELECT id FROM entries)
        `, (err2, row2) => {
          if (err2) return reject(err2);
          checks.orphaned_prompt_entries = row2.count;
          
          // Check for null timestamps
          this.db.get(`
            SELECT 
              (SELECT COUNT(*) FROM entries WHERE timestamp IS NULL) +
              (SELECT COUNT(*) FROM prompts WHERE timestamp IS NULL) +
              (SELECT COUNT(*) FROM events WHERE timestamp IS NULL) as count
          `, (err3, row3) => {
            if (err3) return reject(err3);
            checks.null_timestamps = row3.count;
            
            resolve({
              valid: checks.orphaned_entry_prompts === 0 && 
                     checks.orphaned_prompt_entries === 0 && 
                     checks.null_timestamps === 0,
              checks
            });
          });
        });
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
  /**
   * Save a context snapshot to the database
   */
  async saveContextSnapshot(snapshot) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO context_snapshots 
        (prompt_id, timestamp, file_count, token_estimate, truncated, utilization_percent, context_files, at_mentions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        snapshot.promptId || null,
        snapshot.timestamp,
        snapshot.fileCount || 0,
        snapshot.tokenEstimate || 0,
        snapshot.truncated ? 1 : 0,
        snapshot.utilizationPercent || 0,
        JSON.stringify(snapshot.contextFiles || []),
        JSON.stringify(snapshot.atMentions || [])
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving context snapshot:', err);
          reject(err);
        } else {
          resolve(snapshot);
        }
      });
    });
  }

  /**
   * Get context snapshots with optional filtering
   */
  async getContextSnapshots(options = {}) {
    await this.init();
    
    const { limit = 100, since = 0 } = options;
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM context_snapshots 
         WHERE timestamp >= ? 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [since, limit],
        (err, rows) => {
          if (err) {
            console.error('Error fetching context snapshots:', err);
            reject(err);
          } else {
            const snapshots = rows.map(row => ({
              id: row.id,
              promptId: row.prompt_id,
              timestamp: row.timestamp,
              fileCount: row.file_count,
              tokenEstimate: row.token_estimate,
              truncated: row.truncated === 1,
              utilizationPercent: row.utilization_percent,
              contextFiles: JSON.parse(row.context_files || '[]'),
              atMentions: JSON.parse(row.at_mentions || '[]'),
              createdAt: row.created_at
            }));
            resolve(snapshots);
          }
        }
      );
    });
  }

  /**
   * Get context analytics from stored snapshots
   */
  async getContextAnalytics() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          COUNT(*) as total_snapshots,
          AVG(file_count) as avg_files,
          AVG(token_estimate) as avg_tokens,
          AVG(utilization_percent) as avg_utilization,
          SUM(CASE WHEN truncated = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as truncation_rate
         FROM context_snapshots`,
        (err, row) => {
          if (err) {
            console.error('Error fetching context analytics:', err);
            reject(err);
          } else {
            resolve({
              totalSnapshots: row.total_snapshots || 0,
              avgFilesPerPrompt: row.avg_files || 0,
              avgTokensPerPrompt: Math.round(row.avg_tokens || 0),
              avgContextUtilization: row.avg_utilization || 0,
              truncationRate: row.truncation_rate || 0
            });
          }
        }
      );
    });
  }
}

module.exports = PersistentDB;

