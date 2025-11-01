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
        
        console.log(`[SAVE] Connected to SQLite database: ${this.dbPath}`);
        
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
                  `ALTER TABLE prompts ADD COLUMN added_from_database INTEGER DEFAULT 0`,
                  // NEW: Context files tracking
                  `ALTER TABLE prompts ADD COLUMN context_files_json TEXT`,
                  `ALTER TABLE prompts ADD COLUMN context_file_count INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN context_file_count_explicit INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN context_file_count_tabs INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN context_file_count_auto INTEGER DEFAULT 0`,
                  // NEW: Enhanced context tracking
                  `ALTER TABLE prompts ADD COLUMN thinking_time INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN thinking_time_seconds REAL DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN terminal_blocks_json TEXT`,
                  `ALTER TABLE prompts ADD COLUMN terminal_block_count INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN has_attachments INTEGER DEFAULT 0`,
                  `ALTER TABLE prompts ADD COLUMN attachment_count INTEGER DEFAULT 0`
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

          // NEW: Attachments table (for images and files)
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS prompt_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prompt_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                format TEXT,
                filename TEXT,
                data BLOB,
                thumbnail BLOB,
                size INTEGER,
                width INTEGER,
                height INTEGER,
                timestamp INTEGER,
                FOREIGN KEY (prompt_id) REFERENCES prompts(id)
              )
            `, (err) => {
              if (err) {
                console.error('Error creating attachments table:', err);
                rej(err);
              } else {
                // Create index for faster lookups
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_prompt_id ON prompt_attachments(prompt_id)`, () => {
                  res();
                });
              }
            });
          }));

          // TODO tracking tables
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at INTEGER NOT NULL,
                started_at INTEGER,
                completed_at INTEGER,
                order_index INTEGER DEFAULT 0,
                session_id TEXT,
                prompts_while_active TEXT,
                files_modified TEXT
              )
            `, (err) => {
              if (err) {
                console.error('Error creating todos table:', err);
                rej(err);
              } else {
                res();
              }
            });
          }));

          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS todo_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                todo_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                event_id INTEGER,
                timestamp INTEGER NOT NULL,
                FOREIGN KEY (todo_id) REFERENCES todos(id)
              )
            `, (err) => {
              if (err) {
                console.error('Error creating todo_events table:', err);
                rej(err);
              } else {
                // Create indexes
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_todo_events_todo_id ON todo_events(todo_id)`, () => {
                  this.db.run(`CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)`, () => {
                    this.db.run(`CREATE INDEX IF NOT EXISTS idx_todos_session ON todos(session_id)`, () => {
                      res();
                    });
                  });
                });
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
            console.log('[SUCCESS] Database tables initialized');
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
      // Extract context files data
      const contextFiles = prompt.contextFiles || { files: [], count: 0, countBySource: { explicit: 0, tabs: 0, auto: 0 } };
      const contextFilesJson = JSON.stringify(contextFiles.files || []);
      
      // Extract terminal blocks
      const terminalBlocks = prompt.terminalBlocks || [];
      const terminalBlocksJson = JSON.stringify(terminalBlocks);
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO prompts 
        (id, timestamp, text, status, linked_entry_id, source,
         workspace_id, workspace_path, workspace_name, composer_id, subtitle,
         lines_added, lines_removed, context_usage, mode, model_type, model_name,
         force_mode, is_auto, type, confidence, added_from_database,
         context_files_json, context_file_count, context_file_count_explicit,
         context_file_count_tabs, context_file_count_auto,
         thinking_time, thinking_time_seconds, terminal_blocks_json, 
         terminal_block_count, has_attachments, attachment_count,
         conversation_title, message_role, parent_conversation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        prompt.added_from_database ? 1 : 0,
        contextFilesJson,
        contextFiles.count || 0,
        contextFiles.countBySource?.explicit || 0,
        contextFiles.countBySource?.tabs || 0,
        contextFiles.countBySource?.auto || 0,
        prompt.thinkingTime || 0,
        prompt.thinkingTimeSeconds || 0,
        terminalBlocksJson,
        terminalBlocks.length || 0,
        prompt.hasAttachments ? 1 : 0,
        prompt.attachmentCount || 0,
        prompt.conversationTitle || null,
        prompt.messageRole || null,
        prompt.parentConversationId || null
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
   * Get total count of entries in database
   */
  async getTotalEntriesCount() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT COUNT(*) as count FROM entries`, [], (err, row) => {
        if (err) {
          console.error('Error counting entries:', err);
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  /**
   * Load recent entries from the database (with limit for performance)
   */
  async getRecentEntries(limit = 500, entryId = null) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      let query, params;
      
      if (entryId !== null) {
        // Fetch specific entry by ID (used for TODO events)
        query = `
          SELECT 
            id, session_id, workspace_path, file_path, source, 
            notes, timestamp, tags, prompt_id, modelInfo, type
          FROM entries 
          WHERE id = ?
        `;
        params = [entryId];
      } else {
        // ✅ Exclude large fields (before_code, after_code) for performance
        // Only include metadata needed for activity list view
        query = `
          SELECT 
            id, session_id, workspace_path, file_path, source, 
            notes, timestamp, tags, prompt_id, modelInfo, type
          FROM entries 
          ORDER BY timestamp DESC 
          LIMIT ?
        `;
        params = [limit];
      }
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error loading recent entries:', err);
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
   * Get entries with full code content (includes before_code and after_code)
   * Used for exports where structural edits are needed
   */
  async getEntriesWithCode(limit = 1000) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          id, session_id, workspace_path, file_path, source, 
          before_code, after_code, notes, timestamp, tags, prompt_id, modelInfo, type
        FROM entries 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          console.error('Error loading entries with code:', err);
          reject(err);
        } else {
          // Parse JSON fields
          const entries = rows.map(row => ({
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            modelInfo: row.modelInfo ? JSON.parse(row.modelInfo) : null,
            before_content: row.before_code,  // Alias for compatibility
            after_content: row.after_code     // Alias for compatibility
          }));
          resolve(entries);
        }
      });
    });
  }

  /**
   * Get file contents for semantic analysis (includes after_code)
   */
  async getFileContents(limit = 500) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          id, file_path, after_code, timestamp
        FROM entries 
        WHERE after_code IS NOT NULL 
          AND after_code != ''
          AND file_path NOT LIKE '%.git/%'
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          console.error('Error loading file contents:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Load recent prompts from the database (with limit for performance)
   */
  async getRecentPrompts(limit = 200) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT * FROM prompts ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) {
          console.error('Error loading recent prompts:', err);
          reject(err);
        } else {
          // Map database column names (snake_case) to camelCase
          const mapped = rows.map(row => this._mapPromptRow(row));
          resolve(mapped);
        }
      });
    });
  }
  
  /**
   * Map database row (snake_case) to camelCase object
   */
  _mapPromptRow(row) {
    return {
      ...row,
      // Map snake_case to camelCase
      linesAdded: row.lines_added,
      linesRemoved: row.lines_removed,
      contextUsage: row.context_usage,
      workspaceId: row.workspace_id,
      workspacePath: row.workspace_path,
      workspaceName: row.workspace_name,
      composerId: row.composer_id,
      modelType: row.model_type,
      modelName: row.model_name,
      forceMode: row.force_mode,
      isAuto: row.is_auto === 1 || row.is_auto === true,
      linkedEntryId: row.linked_entry_id,
      addedFromDatabase: row.added_from_database === 1 || row.added_from_database === true,
      // Context files
      contextFilesJson: row.context_files_json,
      contextFileCount: row.context_file_count,
      contextFileCountExplicit: row.context_file_count_explicit,
      contextFileCountTabs: row.context_file_count_tabs,
      contextFileCountAuto: row.context_file_count_auto,
      // Thinking time
      thinkingTime: row.thinking_time,
      thinkingTimeSeconds: row.thinking_time_seconds,
      // Terminal blocks
      terminalBlocksJson: row.terminal_blocks_json,
      terminalBlockCount: row.terminal_block_count,
      // Attachments
      hasAttachments: row.has_attachments === 1 || row.has_attachments === true,
      attachmentCount: row.attachment_count,
      // Threading
      conversationTitle: row.conversation_title,
      messageRole: row.message_role,
      parentConversationId: row.parent_conversation_id,
      // Parse JSON fields if present
      contextFiles: row.context_files_json ? JSON.parse(row.context_files_json) : [],
      terminalBlocks: row.terminal_blocks_json ? JSON.parse(row.terminal_blocks_json) : []
    };
  }

  /**
   * Get maximum IDs from tables (for setting nextId without loading all data)
   */
  async getMaxIds() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          (SELECT COALESCE(MAX(id), 0) FROM entries) as entryId,
          (SELECT COALESCE(MAX(id), 0) FROM prompts) as promptId
      `, (err, row) => {
        if (err) {
          console.error('Error getting max IDs:', err);
          reject(err);
        } else {
          resolve(row || { entryId: 0, promptId: 0 });
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
          // Map database column names (snake_case) to camelCase
          const mapped = rows.map(row => this._mapPromptRow(row));
          resolve(mapped);
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
          console.log('[SAVE] Database connection closed');
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
      // Get all context snapshots with actual data
      this.db.all(
        `SELECT context_files, at_mentions FROM context_snapshots 
         WHERE (context_files IS NOT NULL AND context_files != '[]') 
            OR (at_mentions IS NOT NULL AND at_mentions != '[]')`,
        (err, rows) => {
          if (err) {
            console.error('Error fetching context analytics:', err);
            reject(err);
            return;
          }
          
          let totalAtFiles = 0;
          let totalContextFiles = 0;
          let totalUIStates = 0;
          const atFileSet = new Set();
          
          rows.forEach(row => {
            try {
              // Count @ mentions
              if (row.at_mentions) {
                const mentions = JSON.parse(row.at_mentions);
                if (Array.isArray(mentions)) {
                  totalAtFiles += mentions.length;
                  mentions.forEach(m => atFileSet.add(m));
                }
              }
              
              // Count context files
              if (row.context_files) {
                const files = JSON.parse(row.context_files);
                if (Array.isArray(files)) {
                  totalContextFiles += files.length;
                } else if (files.attachedFiles || files.codebaseFiles) {
                  totalContextFiles += (files.attachedFiles?.length || 0) + (files.codebaseFiles?.length || 0);
                }
              }
            } catch (e) {
              // Skip malformed JSON
            }
          });
          
          resolve({
            totalAtFiles,
            totalContextFiles,
            totalUIStates,
            withContext: rows.length,
            uniqueAtFiles: atFileSet.size,
            totalSnapshots: rows.length
          });
        }
      );
    });
  }

  // ===================================
  // TODO TRACKING METHODS
  // ===================================

  /**
   * Save a new TODO
   */
  async saveTodo(todo) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO todos (
          content, status, created_at, order_index, session_id,
          prompts_while_active, files_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        todo.content,
        todo.status || 'pending',
        todo.created_at || Date.now(),
        todo.order_index || 0,
        todo.session_id || this._getCurrentSessionId(),
        JSON.stringify(todo.prompts_while_active || []),
        JSON.stringify(todo.files_modified || []),
        function(err) {
          if (err) {
            console.error('Error saving todo:', err);
            reject(err);
          } else {
            console.log(`[TODO] Saved: "${todo.content}" (ID: ${this.lastID})`);
            resolve(this.lastID);
          }
        }
      );
      stmt.finalize();
    });
  }

  /**
   * Update TODO status
   */
  async updateTodoStatus(todoId, status) {
    await this.init();
    
    const updates = { status };
    const now = Date.now();
    
    // Get current todo to check if started_at exists
    const todo = await this._getTodo(todoId);
    
    if (status === 'in_progress' && !todo.started_at) {
      updates.started_at = now;
    } else if (status === 'completed' && !todo.completed_at) {
      updates.completed_at = now;
    }
    
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = Object.values(updates);
      
      this.db.run(
        `UPDATE todos SET ${fields} WHERE id = ?`,
        [...values, todoId],
        (err) => {
          if (err) {
            console.error('Error updating todo status:', err);
            reject(err);
          } else {
            console.log(`[TODO] Updated status for ID ${todoId}: ${status}`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get active TODO (in_progress)
   */
  async getActiveTodo() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM todos WHERE status = 'in_progress' ORDER BY started_at DESC LIMIT 1`,
        (err, row) => {
          if (err) {
            console.error('Error getting active todo:', err);
            reject(err);
          } else {
            resolve(row ? this._mapTodoRow(row) : null);
          }
        }
      );
    });
  }

  /**
   * Get all TODOs for current session
   */
  async getCurrentSessionTodos() {
    await this.init();
    
    const sessionId = this._getCurrentSessionId();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM todos WHERE session_id = ? ORDER BY order_index ASC, created_at ASC`,
        [sessionId],
        (err, rows) => {
          if (err) {
            console.error('Error getting session todos:', err);
            reject(err);
          } else {
            resolve(rows ? rows.map(r => this._mapTodoRow(r)) : []);
          }
        }
      );
    });
  }

  /**
   * Link event to active TODO
   */
  async linkEventToTodo(eventType, eventId) {
    await this.init();
    
    const activeTodo = await this.getActiveTodo();
    if (!activeTodo) return null;
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO todo_events (todo_id, event_type, event_id, timestamp) VALUES (?, ?, ?, ?)`,
        [activeTodo.id, eventType, eventId, Date.now()],
        function(err) {
          if (err) {
            console.error('Error linking event to todo:', err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Add prompt to TODO's active prompts list
   */
  async addPromptToTodo(todoId, promptId) {
    await this.init();
    
    const todo = await this._getTodo(todoId);
    if (!todo) return;
    
    const prompts = JSON.parse(todo.prompts_while_active || '[]');
    if (!prompts.includes(promptId)) {
      prompts.push(promptId);
      
      return new Promise((resolve, reject) => {
        this.db.run(
          `UPDATE todos SET prompts_while_active = ? WHERE id = ?`,
          [JSON.stringify(prompts), todoId],
          (err) => {
            if (err) {
              console.error('Error adding prompt to todo:', err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    }
  }

  /**
   * Add file to TODO's modified files list
   */
  async addFileToTodo(todoId, filePath) {
    await this.init();
    
    const todo = await this._getTodo(todoId);
    if (!todo) return;
    
    const files = JSON.parse(todo.files_modified || '[]');
    if (!files.includes(filePath)) {
      files.push(filePath);
      
      return new Promise((resolve, reject) => {
        this.db.run(
          `UPDATE todos SET files_modified = ? WHERE id = ?`,
          [JSON.stringify(files), todoId],
          (err) => {
            if (err) {
              console.error('Error adding file to todo:', err);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    }
  }

  /**
   * Get events for a TODO
   */
  async getTodoEvents(todoId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM todo_events WHERE todo_id = ? ORDER BY timestamp ASC`,
        [todoId],
        (err, rows) => {
          if (err) {
            console.error('Error getting todo events:', err);
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get TODO by ID
   */
  async getTodoById(todoId) {
    await this.init();
    
    const todo = await this._getTodo(todoId);
    return todo ? this._mapTodoRow(todo) : null;
  }

  /**
   * Get prompt by ID (helper for enriching todo events)
   */
  async getPromptById(promptId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM prompts WHERE id = ?`,
        [promptId],
        (err, row) => {
          if (err) {
            console.error('Error getting prompt by ID:', err);
            reject(err);
          } else {
            resolve(row ? this._mapPromptRow(row) : null);
          }
        }
      );
    });
  }

  /**
   * Helper: Map TODO row to camelCase object
   */
  _mapTodoRow(row) {
    return {
      id: row.id,
      content: row.content,
      status: row.status,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      orderIndex: row.order_index,
      sessionId: row.session_id,
      promptsWhileActive: JSON.parse(row.prompts_while_active || '[]'),
      filesModified: JSON.parse(row.files_modified || '[]')
    };
  }

  /**
   * Helper: Get TODO from database
   */
  _getTodo(todoId) {
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT * FROM todos WHERE id = ?`, [todoId], (err, row) => {
        if (err) {
          console.error('Error getting todo:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Helper: Get current session ID (date-based)
   */
  _getCurrentSessionId() {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  }
}

module.exports = PersistentDB;

