/**
 * Backup Service
 * Handles automated backups and data export
 */

class BackupService {
  constructor(persistentDB, options = {}) {
    this.db = persistentDB;
    this.options = {
      enabled: process.env.BACKUP_ENABLED !== 'false',
      interval: parseInt(process.env.BACKUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
      backupDir: process.env.BACKUP_DIR || './backups',
      ...options
    };
    this.backupInterval = null;
  }

  /**
   * Start automatic backups
   */
  async start() {
    if (!this.options.enabled) {
      console.log('[BACKUP] Automatic backups disabled');
      return;
    }

    // Ensure backup directory exists
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(this.options.backupDir)) {
      fs.mkdirSync(this.options.backupDir, { recursive: true });
    }

    console.log(`[BACKUP] Starting automatic backups (interval: ${this.options.interval / 1000 / 60} minutes)`);

    // Initial backup
    await this.createBackup();

    // Schedule periodic backups
    this.backupInterval = setInterval(() => {
      this.createBackup().catch(error => {
        console.error('[BACKUP] Error creating scheduled backup:', error.message);
      });
    }, this.options.interval);

    // Cleanup old backups
    this.cleanupOldBackups();
  }

  /**
   * Stop automatic backups
   */
  stop() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log('[BACKUP] Automatic backups stopped');
    }
  }

  /**
   * Create a backup
   */
  async createBackup() {
    try {
      const fs = require('fs');
      const path = require('path');
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.options.backupDir, `backup_${timestamp}.json`);

      console.log(`[BACKUP] Creating backup: ${backupFile}`);

      // Export data via API (if available) or directly from database
      const stats = await this.db.getStats();
      
      // For PostgreSQL, use pg_dump if available
      if (process.env.DATABASE_URL && process.env.USE_PG_DUMP === 'true') {
        try {
          const pgDumpFile = backupFile.replace('.json', '.sql');
          await execAsync(`pg_dump "${process.env.DATABASE_URL}" > "${pgDumpFile}"`);
          console.log(`[BACKUP] PostgreSQL dump created: ${pgDumpFile}`);
        } catch (error) {
          console.warn('[BACKUP] pg_dump not available, using JSON export');
        }
      }

      // Export as JSON (works for both SQLite and PostgreSQL)
      const exportData = await this.exportToJSON();
      fs.writeFileSync(backupFile, JSON.stringify(exportData, null, 2));

      const fileSize = fs.statSync(backupFile).size;
      console.log(`[BACKUP] Backup created: ${backupFile} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

      return {
        success: true,
        file: backupFile,
        size: fileSize,
        timestamp: new Date().toISOString(),
        stats: stats
      };
    } catch (error) {
      console.error('[BACKUP] Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Export database to JSON
   */
  async exportToJSON() {
    const [entries, prompts, events] = await Promise.all([
      this.db.getRecentEntries(100000),
      this.db.getRecentPrompts(100000),
      this.db.getRecentEvents(100000)
    ]);

    return {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        databaseType: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
      },
      data: {
        entries,
        prompts,
        events,
      },
      stats: await this.db.getStats()
    };
  }

  /**
   * Cleanup old backups
   */
  cleanupOldBackups() {
    try {
      const fs = require('fs');
      const path = require('path');
      const files = fs.readdirSync(this.options.backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => ({
          name: f,
          path: path.join(this.options.backupDir, f),
          time: fs.statSync(path.join(this.options.backupDir, f)).mtime
        }))
        .sort((a, b) => b.time - a.time);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);

      let deleted = 0;
      files.forEach(file => {
        if (file.time < cutoffDate) {
          fs.unlinkSync(file.path);
          deleted++;
        }
      });

      if (deleted > 0) {
        console.log(`[BACKUP] Cleaned up ${deleted} old backup(s)`);
      }
    } catch (error) {
      console.warn('[BACKUP] Error cleaning up old backups:', error.message);
    }
  }

  /**
   * List available backups
   */
  listBackups() {
    try {
      const fs = require('fs');
      const path = require('path');
      const files = fs.readdirSync(this.options.backupDir)
        .filter(f => f.startsWith('backup_'))
        .map(f => {
          const filePath = path.join(this.options.backupDir, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.modified - a.modified);

      return files;
    } catch (error) {
      console.error('[BACKUP] Error listing backups:', error);
      return [];
    }
  }
}

module.exports = BackupService;




