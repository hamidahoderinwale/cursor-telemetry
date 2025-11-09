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
          console.error('Failed to open database:', err);
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
                  `ALTER TABLE prompts ADD COLUMN attachment_count INTEGER DEFAULT 0`,
                  // NEW: Conversation tracking
                  `ALTER TABLE prompts ADD COLUMN conversation_id TEXT`,
                  `ALTER TABLE prompts ADD COLUMN conversation_index INTEGER`,
                  `ALTER TABLE prompts ADD COLUMN conversation_title TEXT`,
                  // NEW: Message role and parent conversation
                  `ALTER TABLE prompts ADD COLUMN message_role TEXT`,
                  `ALTER TABLE prompts ADD COLUMN parent_conversation_id TEXT`
                ];
                
                // Try to add each column, ignore if already exists
                Promise.all(alterQueries.map(query => {
                  return new Promise((resolve) => {
                    this.db.run(query, (alterErr) => {
                      // Silently ignore "duplicate column" errors
                      if (alterErr && !alterErr.message.includes('duplicate column')) {
                        console.warn('Column may already exist:', alterErr.message);
                      }
                      resolve();
                    });
                  });
                })).then(() => {
                  // Create indexes for conversation queries after columns are added
                  this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_conversation ON prompts(conversation_id)`, (idxErr) => {
                    if (idxErr && !idxErr.message.includes('already exists')) {
                      console.warn('Error creating prompts conversation index:', idxErr);
                    }
                  });
                  this.db.run(`CREATE INDEX IF NOT EXISTS idx_prompts_workspace_conversation ON prompts(workspace_id, conversation_id)`, (idxErr) => {
                    if (idxErr && !idxErr.message.includes('already exists')) {
                      console.warn('Error creating prompts workspace_conversation index:', idxErr);
                    }
                  });
                });
                
                res();
              }
            });
          }));

          // Conversations table (explicit conversation entity)
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                workspace_path TEXT,
                title TEXT,
                status TEXT DEFAULT 'active',
                tags TEXT,
                metadata TEXT,
                created_at TEXT,
                updated_at TEXT,
                last_message_at TEXT,
                message_count INTEGER DEFAULT 0
              )
            `, (err) => {
              if (err) {
                console.error('Error creating conversations table:', err);
                rej(err);
              } else {
                // Create indexes
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id)`, (idxErr) => {
                  if (idxErr) console.warn('Error creating conversations workspace index:', idxErr);
                });
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`, (idxErr) => {
                  if (idxErr) console.warn('Error creating conversations status index:', idxErr);
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

          // Context changes table for tracking file additions/removals
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS context_changes (
                id TEXT PRIMARY KEY,
                prompt_id TEXT,
                event_id TEXT,
                task_id TEXT,
                session_id TEXT,
                timestamp INTEGER NOT NULL,
                previous_file_count INTEGER DEFAULT 0,
                current_file_count INTEGER DEFAULT 0,
                added_files TEXT,
                removed_files TEXT,
                unchanged_files TEXT,
                net_change INTEGER DEFAULT 0,
                metadata TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) {
                console.error('Error creating context_changes table:', err);
                rej(err);
              } else {
                // Create indexes for faster queries
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_context_changes_prompt ON context_changes(prompt_id)`, () => {});
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_context_changes_event ON context_changes(event_id)`, () => {});
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_context_changes_task ON context_changes(task_id)`, () => {});
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_context_changes_timestamp ON context_changes(timestamp)`, () => {});
                res();
              }
            });
          }));

          // Audit log table for import/export history
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                target_type TEXT,
                target_id TEXT,
                workspace_id TEXT,
                user_id TEXT,
                details TEXT,
                status TEXT,
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `, (err) => {
              if (err) {
                console.error('Error creating audit_log table:', err);
                rej(err);
              } else {
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_operation ON audit_log(operation_type)`, () => {});
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id)`, () => {});
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)`, () => {});
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

          // Share links table for workspace sharing
          tables.push(new Promise((res, rej) => {
            this.db.run(`
              CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                share_id TEXT UNIQUE NOT NULL,
                workspaces TEXT,
                abstraction_level INTEGER DEFAULT 1,
                filters TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                access_count INTEGER DEFAULT 0,
                last_accessed INTEGER,
                metadata TEXT
              )
            `, (err) => {
              if (err) {
                console.error('Error creating share_links table:', err);
                rej(err);
              } else {
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_share_links_expires ON share_links(expires_at)`, () => {});
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_share_links_created ON share_links(created_at)`, () => {});
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
         conversation_title, message_role, parent_conversation_id,
         conversation_id, conversation_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Ensure conversation_id is set (use composerId or parentConversationId as fallback)
      const conversationId = prompt.conversationId || prompt.composerId || prompt.parentConversationId || null;
      
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
        prompt.parentConversationId || null,
        conversationId,
        prompt.conversationIndex || null
      );
      
      // Update conversation if conversation_id is set
      if (conversationId && prompt.workspaceId) {
        this.updateConversationMetadata(conversationId, prompt.workspaceId, prompt.workspacePath, prompt.conversationTitle).catch(err => {
          console.warn('[DB] Could not update conversation metadata:', err.message);
        });
      }
      
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
        // Exclude large fields (before_code, after_code) for performance
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
   * Get entries within a time range (optionally filtered by workspace)
   */
  async getEntriesInTimeRange(since, until, workspacePath = null, limit = 100) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      // Convert timestamps to ISO strings for TEXT column comparison
      const sinceISO = since ? new Date(since).toISOString() : null;
      const untilISO = until ? new Date(until).toISOString() : null;
      
      let query = `
        SELECT * FROM entries 
        WHERE 1=1
      `;
      const params = [];
      
      if (sinceISO) {
        query += ` AND timestamp >= ?`;
        params.push(sinceISO);
      }
      if (untilISO) {
        query += ` AND timestamp <= ?`;
        params.push(untilISO);
      }
      
      if (workspacePath) {
        query += ` AND workspace_path = ?`;
        params.push(workspacePath);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error loading entries in time range:', err);
          reject(err);
        } else {
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
   * Get prompts within a time range (for linking)
   */
  async getPromptsInTimeRange(since, until, limit = 100) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      // Convert timestamps to ISO strings for TEXT column comparison
      const sinceISO = since ? new Date(since).toISOString() : null;
      const untilISO = until ? new Date(until).toISOString() : null;
      
      let query = `
        SELECT * FROM prompts 
        WHERE 1=1
      `;
      const params = [];
      
      if (sinceISO) {
        query += ` AND timestamp >= ?`;
        params.push(sinceISO);
      }
      if (untilISO) {
        query += ` AND timestamp <= ?`;
        params.push(untilISO);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error loading prompts in time range:', err);
          reject(err);
        } else {
          const mapped = rows.map(row => this._mapPromptRow(row));
          resolve(mapped);
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
   * Get prompts that have linked_entry_id (for repair function)
   */
  async getPromptsWithLinkedEntries() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM prompts 
        WHERE linked_entry_id IS NOT NULL
        ORDER BY timestamp DESC
      `, (err, rows) => {
        if (err) {
          console.error('Error loading prompts with linked entries:', err);
          reject(err);
        } else {
          const mapped = rows.map(row => this._mapPromptRow(row));
          resolve(mapped);
        }
      });
    });
  }

  /**
   * Get entry by ID (handles both numeric and UUID string IDs)
   */
  async getEntryById(entryId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      // Try both numeric ID and string ID (UUID)
      const query = typeof entryId === 'number' 
        ? `SELECT * FROM entries WHERE id = ?`
        : `SELECT * FROM entries WHERE id = ? OR CAST(id AS TEXT) = ?`;
      const params = typeof entryId === 'number' 
        ? [entryId]
        : [entryId, entryId];
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error loading entry by ID:', err);
          reject(err);
        } else {
          if (!row) {
            resolve(null);
            return;
          }
          // Parse JSON fields
          const entry = {
            ...row,
            tags: row.tags ? JSON.parse(row.tags) : [],
            modelInfo: row.modelInfo ? JSON.parse(row.modelInfo) : null
          };
          resolve(entry);
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

  /**
   * Save a context change record to the database
   */
  async saveContextChange(changeRecord) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO context_changes 
        (id, prompt_id, event_id, task_id, session_id, timestamp, 
         previous_file_count, current_file_count, added_files, removed_files, 
         unchanged_files, net_change, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        changeRecord.id,
        changeRecord.promptId || null,
        changeRecord.eventId || null,
        changeRecord.taskId || null,
        changeRecord.sessionId || null,
        changeRecord.timestamp,
        changeRecord.previousFileCount || 0,
        changeRecord.currentFileCount || 0,
        JSON.stringify(changeRecord.addedFiles || []),
        JSON.stringify(changeRecord.removedFiles || []),
        JSON.stringify(changeRecord.unchangedFiles || []),
        changeRecord.netChange || 0,
        JSON.stringify(changeRecord.metadata || {})
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error saving context change:', err);
          reject(err);
        } else {
          resolve(changeRecord);
        }
      });
    });
  }

  /**
   * Get context changes with optional filtering
   */
  async getContextChanges(options = {}) {
    await this.init();
    
    const {
      promptId = null,
      eventId = null,
      taskId = null,
      sessionId = null,
      startTime = null,
      endTime = null,
      limit = 100
    } = options;
    
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM context_changes WHERE 1=1';
      const params = [];
      
      if (promptId) {
        query += ' AND prompt_id = ?';
        params.push(promptId);
      }
      
      if (eventId) {
        query += ' AND event_id = ?';
        params.push(eventId);
      }
      
      if (taskId) {
        query += ' AND task_id = ?';
        params.push(taskId);
      }
      
      if (sessionId) {
        query += ' AND session_id = ?';
        params.push(sessionId);
      }
      
      if (startTime) {
        query += ' AND timestamp >= ?';
        params.push(startTime);
      }
      
      if (endTime) {
        query += ' AND timestamp <= ?';
        params.push(endTime);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching context changes:', err);
          reject(err);
        } else {
          const changes = rows.map(row => ({
            id: row.id,
            promptId: row.prompt_id,
            eventId: row.event_id,
            taskId: row.task_id,
            sessionId: row.session_id,
            timestamp: row.timestamp,
            previousFileCount: row.previous_file_count,
            currentFileCount: row.current_file_count,
            addedFiles: JSON.parse(row.added_files || '[]'),
            removedFiles: JSON.parse(row.removed_files || '[]'),
            unchangedFiles: JSON.parse(row.unchanged_files || '[]'),
            netChange: row.net_change,
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: row.created_at
          }));
          resolve(changes);
        }
      });
    });
  }

  // ===================================
  // SCHEMA MANAGEMENT METHODS
  // ===================================

  /**
   * Get database schema information
   */
  async getSchema() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
        (err, tables) => {
          if (err) {
            console.error('Error fetching schema:', err);
            reject(err);
            return;
          }
          
          const schema = {
            tables: [],
            version: '1.0.0',
            timestamp: Date.now()
          };
          
          // Get details for each table
          const tablePromises = tables.map(table => {
            return new Promise((res, rej) => {
              this.db.all(
                `PRAGMA table_info(${table.name})`,
                (tableErr, columns) => {
                  if (tableErr) {
                    rej(tableErr);
                  } else {
                    res({
                      name: table.name,
                      columns: columns.map(col => ({
                        name: col.name,
                        type: col.type,
                        notnull: col.notnull === 1,
                        defaultValue: col.dflt_value,
                        primaryKey: col.pk === 1
                      }))
                    });
                  }
                }
              );
            });
          });
          
          Promise.all(tablePromises)
            .then(tableDetails => {
              schema.tables = tableDetails;
              resolve(schema);
            })
            .catch(reject);
        }
      );
    });
  }

  /**
   * Get table schema
   */
  async getTableSchema(tableName) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `PRAGMA table_info(${tableName})`,
        (err, columns) => {
          if (err) {
            console.error(`Error fetching table schema for ${tableName}:`, err);
            reject(err);
          } else {
            resolve({
              name: tableName,
              columns: columns.map(col => ({
                name: col.name,
                type: col.type,
                notnull: col.notnull === 1,
                defaultValue: col.dflt_value,
                primaryKey: col.pk === 1
              }))
            });
          }
        }
      );
    });
  }

  /**
   * Add a column to an existing table
   */
  async addColumn(tableName, columnDef) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const { name, type, notnull = false, defaultValue = null } = columnDef;
      
      let sql = `ALTER TABLE ${tableName} ADD COLUMN ${name} ${type}`;
      
      if (notnull) {
        sql += ' NOT NULL';
      }
      
      if (defaultValue !== null) {
        sql += ` DEFAULT ${defaultValue}`;
      }
      
      this.db.run(sql, (err) => {
        if (err) {
          console.error(`Error adding column ${name} to ${tableName}:`, err);
          reject(err);
        } else {
          console.log(`Added column ${name} to ${tableName}`);
          resolve({ success: true, table: tableName, column: name });
        }
      });
    });
  }

  /**
   * Create a custom field configuration
   * This stores metadata about custom fields without modifying the schema
   * Supports workspace scoping: workspace_id can be null for global configs
   */
  async saveCustomFieldConfig(config) {
    await this.init();
    
    // Create a table to store custom field configurations if it doesn't exist
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS schema_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          field_name TEXT NOT NULL,
          field_type TEXT NOT NULL,
          display_name TEXT,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          config_json TEXT,
          workspace_id TEXT,
          workspace_path TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(table_name, field_name, workspace_id)
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Add workspace columns to existing table if they don't exist (migration)
        const alterQueries = [
          `ALTER TABLE schema_config ADD COLUMN workspace_id TEXT`,
          `ALTER TABLE schema_config ADD COLUMN workspace_path TEXT`
        ];
        
        Promise.all(alterQueries.map(query => {
          return new Promise((resolveAlter) => {
            this.db.run(query, (alterErr) => {
              // Silently ignore "duplicate column" errors
              if (alterErr && !alterErr.message.includes('duplicate column') && !alterErr.message.includes('already exists')) {
                console.warn('Error adding workspace column:', alterErr.message);
              }
              resolveAlter();
            });
          });
        })).then(() => {
          // Handle uniqueness: SQLite UNIQUE constraint allows multiple NULLs,
          // so we need to explicitly delete existing configs before inserting
          // This ensures only one config exists per (table_name, field_name, workspace_id) combination
          const workspaceId = config.workspaceId || null;
          
          // Delete existing config with same table, field, and workspace (including NULL for global)
          let deleteQuery = 'DELETE FROM schema_config WHERE table_name = ? AND field_name = ?';
          const deleteParams = [config.tableName, config.fieldName];
          
          if (workspaceId === null) {
            // Delete global configs (workspace_id IS NULL)
            deleteQuery += ' AND workspace_id IS NULL';
          } else {
            // Delete workspace-specific config
            deleteQuery += ' AND workspace_id = ?';
            deleteParams.push(workspaceId);
          }
          
          this.db.run(deleteQuery, deleteParams, (deleteErr) => {
            if (deleteErr) {
              console.warn('Error deleting existing config before insert:', deleteErr);
              // Continue anyway - INSERT OR REPLACE will handle it
            }
            
            // Now insert the new configuration
            const insertStmt = this.db.prepare(`
              INSERT INTO schema_config 
              (table_name, field_name, field_type, display_name, description, enabled, config_json, workspace_id, workspace_path, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            
            insertStmt.run(
              config.tableName,
              config.fieldName,
              config.fieldType,
              config.displayName || config.fieldName,
              config.description || '',
              config.enabled !== false ? 1 : 0,
              JSON.stringify(config.config || {}),
              workspaceId,
              config.workspacePath || null,
              (insertErr) => {
                if (insertErr) {
                  reject(insertErr);
                } else {
                  insertStmt.finalize((finalizeErr) => {
                    if (finalizeErr) {
                      reject(finalizeErr);
                    } else {
                      resolve({ success: true, config });
                    }
                  });
                }
              }
            );
          });
        });
      });
    });
  }

  /**
   * Get custom field configurations
   * Returns workspace-specific configs first, then falls back to global (workspace_id IS NULL) configs
   * @param {string|null} tableName - Optional table name filter
   * @param {string|null} workspaceId - Optional workspace ID to filter by
   * @param {boolean} includeGlobal - Whether to include global configs when workspaceId is provided (default: true)
   */
  async getCustomFieldConfigs(tableName = null, workspaceId = null, includeGlobal = true) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      // Build query with workspace-aware logic
      // Priority: workspace-specific configs override global configs
      let query = `
        SELECT * FROM schema_config
        WHERE 1=1
      `;
      const params = [];
      
      if (tableName) {
        query += ' AND table_name = ?';
        params.push(tableName);
      }
      
      if (workspaceId) {
        if (includeGlobal) {
          // Get workspace-specific OR global (NULL) configs
          query += ' AND (workspace_id = ? OR workspace_id IS NULL)';
          params.push(workspaceId);
        } else {
          // Only workspace-specific configs
          query += ' AND workspace_id = ?';
          params.push(workspaceId);
        }
      } else {
        // If no workspace specified, get all configs (workspace-specific + global)
        // This maintains backward compatibility
      }
      
      query += ' ORDER BY table_name, field_name, workspace_id IS NULL, workspace_id';
      // This ordering ensures workspace-specific configs come before global ones
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching custom field configs:', err);
          reject(err);
        } else {
          // Deduplicate: if both workspace-specific and global configs exist for same table+field,
          // prefer workspace-specific
          const configMap = new Map();
          
          rows.forEach(row => {
            const key = `${row.table_name}:${row.field_name}`;
            const existing = configMap.get(key);
            
            // Prefer workspace-specific over global
            if (!existing || (row.workspace_id && !existing.workspaceId)) {
              configMap.set(key, {
                id: row.id,
                tableName: row.table_name,
                fieldName: row.field_name,
                fieldType: row.field_type,
                displayName: row.display_name,
                description: row.description,
                enabled: row.enabled === 1,
                config: JSON.parse(row.config_json || '{}'),
                workspaceId: row.workspace_id || null,
                workspacePath: row.workspace_path || null,
                createdAt: row.created_at,
                updatedAt: row.updated_at
              });
            }
          });
          
          const configs = Array.from(configMap.values());
          resolve(configs);
        }
      });
    });
  }

  /**
   * Delete a custom field configuration
   * @param {string} tableName - Table name
   * @param {string} fieldName - Field name
   * @param {string|null} workspaceId - Optional workspace ID. If provided, only deletes workspace-specific config.
   *                                    If null, deletes global config or all matching configs if workspaceId not specified.
   */
  async deleteCustomFieldConfig(tableName, fieldName, workspaceId = null) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      let query = 'DELETE FROM schema_config WHERE table_name = ? AND field_name = ?';
      const params = [tableName, fieldName];
      
      if (workspaceId !== null && workspaceId !== undefined) {
        // Delete only workspace-specific config
        query += ' AND workspace_id = ?';
        params.push(workspaceId);
      } else {
        // If workspaceId is null, delete global config (workspace_id IS NULL)
        // This allows deleting global configs explicitly
        query += ' AND workspace_id IS NULL';
      }
      
      this.db.run(query, params, (err) => {
        if (err) {
          console.error('Error deleting custom field config:', err);
          reject(err);
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  // ===================================
  // STATUS MESSAGE TRACKING METHODS
  // ===================================

  /**
   * Save a status message record
   */
  async saveStatusMessage(statusRecord) {
    await this.init();
    
    // Create status_messages table if it doesn't exist
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS status_messages (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          message TEXT NOT NULL,
          type TEXT,
          action TEXT,
          file_path TEXT,
          file_name TEXT,
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          reject(err);
          return;
        }
        
        // Insert status message
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO status_messages 
          (id, timestamp, message, type, action, file_path, file_name, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          statusRecord.id,
          statusRecord.timestamp,
          statusRecord.message,
          statusRecord.type || null,
          statusRecord.action || null,
          statusRecord.filePath || null,
          statusRecord.fileName || null,
          JSON.stringify(statusRecord.metadata || {})
        );
        
        stmt.finalize((finalizeErr) => {
          if (finalizeErr) {
            reject(finalizeErr);
          } else {
            resolve({ success: true, statusRecord });
          }
        });
      });
    });
  }

  /**
   * Get status messages with optional filtering
   */
  async getStatusMessages(options = {}) {
    await this.init();
    
    const {
      startTime = null,
      endTime = null,
      type = null,
      action = null,
      limit = 100
    } = options;
    
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM status_messages WHERE 1=1';
      const params = [];
      
      if (startTime) {
        query += ' AND timestamp >= ?';
        params.push(startTime);
      }
      
      if (endTime) {
        query += ' AND timestamp <= ?';
        params.push(endTime);
      }
      
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }
      
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Error fetching status messages:', err);
          reject(err);
        } else {
          const messages = rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            message: row.message,
            type: row.type,
            action: row.action,
            filePath: row.file_path,
            fileName: row.file_name,
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: row.created_at
          }));
          resolve(messages);
        }
      });
    });
  }

  /**
   * Link status message to context change
   */
  async linkStatusToContextChange(statusId, contextChangeId) {
    await this.init();
    
    // Create linking table if it doesn't exist
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS status_context_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          status_id TEXT NOT NULL,
          context_change_id TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(status_id, context_change_id)
        )
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          reject(err);
          return;
        }
        
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO status_context_links (status_id, context_change_id)
          VALUES (?, ?)
        `);
        
        stmt.run(statusId, contextChangeId, (runErr) => {
          if (runErr) {
            reject(runErr);
          } else {
            resolve({ success: true });
          }
        });
        
        stmt.finalize();
      });
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

  /**
   * Save or update a conversation
   */
  async saveConversation(conversation) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO conversations 
        (id, workspace_id, workspace_path, title, status, tags, metadata, 
         created_at, updated_at, last_message_at, message_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, 
                COALESCE(?, ?), ?, ?, ?)
      `);
      
      // If updating, preserve original created_at
      this.db.get(`SELECT created_at FROM conversations WHERE id = ?`, [conversation.id], (err, row) => {
        const createdAt = row ? row.created_at : now;
        
        stmt.run(
          conversation.id,
          conversation.workspaceId || conversation.workspace_id,
          conversation.workspacePath || conversation.workspace_path,
          conversation.title,
          conversation.status || 'active',
          conversation.tags ? JSON.stringify(conversation.tags) : null,
          conversation.metadata ? JSON.stringify(conversation.metadata) : null,
          createdAt,
          now,
          conversation.lastMessageAt || conversation.last_message_at || now,
          conversation.messageCount || conversation.message_count || 0
        );
        
        stmt.finalize((finalErr) => {
          if (finalErr) {
            console.error('Error saving conversation:', finalErr);
            reject(finalErr);
          } else {
            resolve(conversation);
          }
        });
      });
    });
  }

  /**
   * Update conversation metadata (title, last message time, message count)
   */
  async updateConversationMetadata(conversationId, workspaceId, workspacePath, title) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      // Get current message count
      this.db.get(
        `SELECT COUNT(*) as count FROM prompts WHERE conversation_id = ?`,
        [conversationId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          const messageCount = row ? row.count : 0;
          const now = new Date().toISOString();
          
          // Get or create conversation
          this.db.get(
            `SELECT * FROM conversations WHERE id = ?`,
            [conversationId],
            (getErr, existing) => {
              if (getErr) {
                reject(getErr);
                return;
              }
              
              if (existing) {
                // Update existing
                this.db.run(
                  `UPDATE conversations SET 
                   title = COALESCE(?, title),
                   workspace_path = COALESCE(?, workspace_path),
                   last_message_at = ?,
                   message_count = ?,
                   updated_at = ?
                   WHERE id = ?`,
                  [title, workspacePath, now, messageCount, now, conversationId],
                  (updateErr) => {
                    if (updateErr) reject(updateErr);
                    else resolve();
                  }
                );
              } else {
                // Create new conversation
                this.db.run(
                  `INSERT INTO conversations 
                   (id, workspace_id, workspace_path, title, status, created_at, updated_at, last_message_at, message_count)
                   VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
                  [conversationId, workspaceId, workspacePath, title, now, now, now, messageCount],
                  (insertErr) => {
                    if (insertErr) reject(insertErr);
                    else resolve();
                  }
                );
              }
            }
          );
        }
      );
    });
  }

  /**
   * Get conversations for a workspace
   */
  async getConversationsByWorkspace(workspaceId, limit = 100) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM conversations 
         WHERE workspace_id = ? 
         ORDER BY last_message_at DESC 
         LIMIT ?`,
        [workspaceId, limit],
        (err, rows) => {
          if (err) {
            console.error('Error getting conversations:', err);
            reject(err);
          } else {
            resolve(rows.map(row => ({
              id: row.id,
              workspaceId: row.workspace_id,
              workspacePath: row.workspace_path,
              title: row.title,
              status: row.status,
              tags: row.tags ? JSON.parse(row.tags) : [],
              metadata: row.metadata ? JSON.parse(row.metadata) : {},
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              lastMessageAt: row.last_message_at,
              messageCount: row.message_count
            })));
          }
        }
      );
    });
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM conversations WHERE id = ?`,
        [conversationId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              workspaceId: row.workspace_id,
              workspacePath: row.workspace_path,
              title: row.title,
              status: row.status,
              tags: row.tags ? JSON.parse(row.tags) : [],
              metadata: row.metadata ? JSON.parse(row.metadata) : {},
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              lastMessageAt: row.last_message_at,
              messageCount: row.message_count
            });
          }
        }
      );
    });
  }

  /**
   * Log an audit event
   */
  async logAuditEvent(operation, operationType, details = {}) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO audit_log 
        (operation, operation_type, target_type, target_id, workspace_id, user_id, details, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        operation,
        operationType, // 'import', 'export', 'delete', 'update', etc.
        details.targetType || null,
        details.targetId || null,
        details.workspaceId || null,
        details.userId || null,
        JSON.stringify(details),
        details.status || 'success',
        details.errorMessage || null
      );
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error logging audit event:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get audit log entries
   */
  async getAuditLog(options = {}) {
    await this.init();
    
    const { workspaceId, operationType, limit = 100, offset = 0 } = options;
    
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM audit_log WHERE 1=1`;
      const params = [];
      
      if (workspaceId) {
        query += ` AND workspace_id = ?`;
        params.push(workspaceId);
      }
      
      if (operationType) {
        query += ` AND operation_type = ?`;
        params.push(operationType);
      }
      
      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            operation: row.operation,
            operationType: row.operation_type,
            targetType: row.target_type,
            targetId: row.target_id,
            workspaceId: row.workspace_id,
            userId: row.user_id,
            details: row.details ? JSON.parse(row.details) : {},
            status: row.status,
            errorMessage: row.error_message,
            createdAt: row.created_at
          })));
        }
      });
    });
  }

  /**
   * Save a share link
   */
  async saveShareLink(shareData) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO share_links 
        (id, share_id, workspaces, abstraction_level, filters, created_at, expires_at, access_count, last_accessed, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        shareData.id || shareData.shareId,
        shareData.shareId,
        JSON.stringify(shareData.workspaces || []),
        shareData.abstractionLevel || 1,
        JSON.stringify(shareData.filters || {}),
        shareData.createdAt,
        shareData.expiresAt,
        shareData.accessCount || 0,
        shareData.lastAccessed || null,
        JSON.stringify(shareData.metadata || {})
      , (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(shareData);
        }
      });
      
      stmt.finalize();
    });
  }

  /**
   * Get a share link by ID
   */
  async getShareLink(shareId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM share_links WHERE share_id = ?`,
        [shareId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              shareId: row.share_id,
              workspaces: JSON.parse(row.workspaces || '[]'),
              abstractionLevel: row.abstraction_level,
              filters: JSON.parse(row.filters || '{}'),
              createdAt: row.created_at,
              expiresAt: row.expires_at,
              accessCount: row.access_count,
              lastAccessed: row.last_accessed,
              metadata: JSON.parse(row.metadata || '{}')
            });
          }
        }
      );
    });
  }

  /**
   * Update a share link
   */
  async updateShareLink(shareId, updates) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      if (updates.accessCount !== undefined) {
        fields.push('access_count = ?');
        values.push(updates.accessCount);
      }
      if (updates.lastAccessed !== undefined) {
        fields.push('last_accessed = ?');
        values.push(updates.lastAccessed);
      }
      if (updates.workspaces !== undefined) {
        fields.push('workspaces = ?');
        values.push(JSON.stringify(updates.workspaces));
      }
      if (updates.filters !== undefined) {
        fields.push('filters = ?');
        values.push(JSON.stringify(updates.filters));
      }
      
      if (fields.length === 0) {
        resolve();
        return;
      }
      
      values.push(shareId);
      
      this.db.run(
        `UPDATE share_links SET ${fields.join(', ')} WHERE share_id = ?`,
        values,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Delete a share link
   */
  async deleteShareLink(shareId) {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM share_links WHERE share_id = ?`,
        [shareId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get all share links
   */
  async getAllShareLinks() {
    await this.init();
    
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM share_links ORDER BY created_at DESC`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              id: row.id,
              shareId: row.share_id,
              workspaces: JSON.parse(row.workspaces || '[]'),
              abstractionLevel: row.abstraction_level,
              filters: JSON.parse(row.filters || '{}'),
              createdAt: row.created_at,
              expiresAt: row.expires_at,
              accessCount: row.access_count,
              lastAccessed: row.last_accessed,
              metadata: JSON.parse(row.metadata || '{}')
            })));
          }
        }
      );
    });
  }
}

module.exports = PersistentDB;

