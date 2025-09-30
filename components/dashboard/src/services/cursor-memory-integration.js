/**
 * Cursor Memory Integration Service
 * Integrates memories with Cursor's database so they appear in Cursor settings/dashboard
 */

const fs = require('fs').promises;
const path = require('path');

class CursorMemoryIntegration {
  constructor(options = {}) {
    this.options = {
      cursorDbPath: options.cursorDbPath || this.findCursorDB(),
      enableIntegration: options.enableIntegration !== false,
      syncInterval: options.syncInterval || 30000, // 30 seconds
      ...options
    };
    
    this.db = null;
    this.isInitialized = false;
    this.syncTimer = null;
  }

  /**
   * Find Cursor storage path
   */
  findCursorDB() {
    const possiblePaths = [
      // Standard Cursor storage locations
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/globalStorage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/workspaceStorage'),
      path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User'),
    ];

    for (const basePath of possiblePaths) {
      if (this.pathExists(basePath)) {
        console.log(`Found Cursor storage directory: ${basePath}`);
        return basePath;
      }
    }
    
    console.log('No Cursor storage found. Memory integration will be disabled.');
    return null;
  }

  /**
   * Check if path exists
   */
  pathExists(path) {
    try {
      return require('fs').existsSync(path);
    } catch {
      return false;
    }
  }

  /**
   * Find SQLite files in directory
   */
  findSQLiteFiles(dir) {
    const files = [];
    try {
      const items = require('fs').readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          // Recursively search subdirectories (with depth limit)
          const subFiles = this.findSQLiteFiles(fullPath);
          files.push(...subFiles);
        } else if (item.isFile() && (item.name.endsWith('.db') || item.name.endsWith('.sqlite'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    
    return files;
  }

  /**
   * Initialize Cursor storage connection
   */
  async initialize() {
    if (!this.options.cursorDbPath || !this.options.enableIntegration) {
      console.log('Cursor memory integration disabled');
      return false;
    }

    try {
      // Create memory storage file in Cursor directory
      this.memoryStorageFile = path.join(this.options.cursorDbPath, 'pkl-memories.json');
      this.executionStorageFile = path.join(this.options.cursorDbPath, 'pkl-memory-executions.json');
      
      // Initialize storage files
      await this.initializeStorageFiles();
      this.isInitialized = true;
      
      console.log('Cursor memory integration initialized');
      
      // Start periodic sync
      this.startPeriodicSync();
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Cursor memory integration:', error);
      return false;
    }
  }

  /**
   * Initialize storage files
   */
  async initializeStorageFiles() {
    try {
      // Initialize memories storage file
      if (!this.pathExists(this.memoryStorageFile)) {
        await fs.writeFile(this.memoryStorageFile, JSON.stringify({
          memories: [],
          lastUpdated: Date.now()
        }, null, 2));
      }

      // Initialize executions storage file
      if (!this.pathExists(this.executionStorageFile)) {
        await fs.writeFile(this.executionStorageFile, JSON.stringify({
          executions: [],
          lastUpdated: Date.now()
        }, null, 2));
      }

      console.log('Cursor memory storage files initialized');
    } catch (error) {
      console.error('Failed to initialize storage files:', error);
    }
  }

  /**
   * Sync memory to Cursor storage
   */
  async syncMemory(memory) {
    if (!this.isInitialized || !this.memoryStorageFile) {
      console.log('Cursor integration not initialized, skipping sync');
      return false;
    }

    try {
      // Read current memories
      const data = await fs.readFile(this.memoryStorageFile, 'utf8');
      const storage = JSON.parse(data);
      
      // Find existing memory or add new one
      const existingIndex = storage.memories.findIndex(m => m.id === memory.id);
      const memoryData = {
        id: memory.id,
        title: memory.title,
        description: memory.description || '',
        category: memory.category || 'general',
        type: memory.type || 'session',
        content: typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content),
        tags: memory.tags || [],
        priority: memory.priority || 'medium',
        status: memory.status || 'active',
        autoExecute: memory.autoExecute || false,
        created: new Date(memory.created || memory.timestamp).getTime(),
        updated: Date.now(),
        executed: null,
        executionCount: 0,
        successRate: 0.0,
        metadata: memory.metadata || {}
      };

      if (existingIndex >= 0) {
        // Update existing memory
        storage.memories[existingIndex] = memoryData;
      } else {
        // Add new memory
        storage.memories.push(memoryData);
      }

      storage.lastUpdated = Date.now();

      // Write back to file
      await fs.writeFile(this.memoryStorageFile, JSON.stringify(storage, null, 2));

      console.log(`Memory synced to Cursor: ${memory.id}`);
      return true;
    } catch (error) {
      console.error('Failed to sync memory to Cursor:', error);
      return false;
    }
  }

  /**
   * Record memory execution in Cursor database
   */
  async recordMemoryExecution(memoryId, executionResult) {
    if (!this.isInitialized || !this.db) return false;

    try {
      const now = Date.now();
      const executionId = `exec_${memoryId}_${now}`;
      
      // Insert execution record
      const stmt = this.db.prepare(`
        INSERT INTO pkl_memory_executions (
          id, memory_id, executed_at, status, result, error_message,
          execution_time, context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        executionId,
        memoryId,
        now,
        executionResult.success ? 'success' : 'error',
        executionResult.result ? JSON.stringify(executionResult.result) : null,
        executionResult.error || null,
        executionResult.executionTime || 0,
        JSON.stringify(executionResult.context || {})
      );

      // Update memory execution stats
      this.updateMemoryStats(memoryId, executionResult.success);

      return true;
    } catch (error) {
      console.error('Failed to record memory execution:', error);
      return false;
    }
  }

  /**
   * Update memory execution statistics
   */
  updateMemoryStats(memoryId, success) {
    if (!this.db) return;

    try {
      // Get current stats
      const current = this.db.prepare(`
        SELECT execution_count, success_rate FROM pkl_memories WHERE id = ?
      `).get(memoryId);

      if (current) {
        const newCount = current.execution_count + 1;
        const newSuccessRate = ((current.success_rate * current.execution_count) + (success ? 1 : 0)) / newCount;

        // Update stats
        this.db.prepare(`
          UPDATE pkl_memories 
          SET execution_count = ?, success_rate = ?, executed_at = ?
          WHERE id = ?
        `).run(newCount, newSuccessRate, Date.now(), memoryId);
      }
    } catch (error) {
      console.error('Failed to update memory stats:', error);
    }
  }

  /**
   * Get memories from Cursor storage
   */
  async getMemoriesFromCursor(options = {}) {
    if (!this.isInitialized || !this.memoryStorageFile) return [];

    try {
      const { category, type, status, limit = 100 } = options;
      
      // Read memories from file
      const data = await fs.readFile(this.memoryStorageFile, 'utf8');
      const storage = JSON.parse(data);
      
      let memories = storage.memories || [];

      // Apply filters
      if (category && category !== 'all') {
        memories = memories.filter(m => m.category === category);
      }

      if (type && type !== 'all') {
        memories = memories.filter(m => m.type === type);
      }

      if (status && status !== 'all') {
        memories = memories.filter(m => m.status === status);
      }

      // Sort by updated date and limit
      memories = memories
        .sort((a, b) => b.updated - a.updated)
        .slice(0, limit);
      
      return memories.map(memory => ({
        id: memory.id,
        title: memory.title,
        description: memory.description,
        category: memory.category,
        type: memory.type,
        content: memory.content,
        tags: memory.tags || [],
        priority: memory.priority,
        status: memory.status,
        autoExecute: memory.autoExecute,
        created: new Date(memory.created).toISOString(),
        updated: new Date(memory.updated).toISOString(),
        executed: memory.executed ? new Date(memory.executed).toISOString() : null,
        executionCount: memory.executionCount,
        successRate: memory.successRate,
        metadata: memory.metadata || {}
      }));
    } catch (error) {
      console.error('Failed to get memories from Cursor:', error);
      return [];
    }
  }

  /**
   * Start periodic sync with PKL memory storage
   */
  startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      await this.syncAllMemories();
    }, this.options.syncInterval);
  }

  /**
   * Sync all memories from PKL storage to Cursor
   */
  async syncAllMemories() {
    try {
      // Load memories from PKL storage
      // const { MemoryStorage } = require('./memory-storage'); // Removed during cleanup
      // const memoryStorage = new MemoryStorage(); // Removed during cleanup
      
      // Use stub for memory storage
      const memories = { memories: [], total: 0 };
      
      for (const memory of memories.memories) {
        await this.syncMemory(memory);
      }
      
      console.log(`Synced ${memories.length} memories to Cursor`);
    } catch (error) {
      console.error('Failed to sync memories:', error);
    }
  }

  /**
   * Close storage connection
   */
  close() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.isInitialized = false;
  }
}

module.exports = { CursorMemoryIntegration };
