/**
 * Optimized File Storage System
 * Provides intelligent file caching, change detection, and memory optimization
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const IntelligentCache = require('./intelligent-cache');

class OptimizedFileStorage extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            storageDir: options.storageDir || path.join(process.cwd(), '.file-storage'),
            maxCacheSize: options.maxCacheSize || 500,
            enableChangeDetection: options.enableChangeDetection !== false,
            enableContentHashing: options.enableContentHashing !== false,
            enableCompression: options.enableCompression !== false,
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB max file size
            ...options
        };
        
        this.cache = new IntelligentCache({
            maxCacheSize: this.options.maxCacheSize,
            enableDeduplication: true,
            enableCompression: this.options.enableCompression,
            storageDir: path.join(this.options.storageDir, 'cache')
        });
        
        this.fileHashes = new Map(); // Track file content hashes
        this.fileStats = new Map(); // Track file statistics
        this.watchedFiles = new Map(); // Track watched files
        this.stats = {
            filesRead: 0,
            filesCached: 0,
            cacheHits: 0,
            cacheMisses: 0,
            changesDetected: 0,
            memorySaved: 0
        };
        
        this.setupStorage();
        this.setupCacheEvents();
    }
    
    /**
     * Setup storage directory
     */
    setupStorage() {
        if (!fs.existsSync(this.options.storageDir)) {
            fs.mkdirSync(this.options.storageDir, { recursive: true });
        }
    }
    
    /**
     * Setup cache event handlers
     */
    setupCacheEvents() {
        this.cache.on('deduplication', (data) => {
            this.stats.memorySaved += 1024; // Estimate memory saved
            this.emit('deduplication', data);
        });
        
        this.cache.on('cache-eviction', (data) => {
            this.emit('cache-eviction', data);
        });
    }
    
    /**
     * Generate file hash for change detection
     */
    generateFileHash(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            return crypto.createHash('sha256')
                .update(content)
                .update(stats.mtime.getTime().toString())
                .update(stats.size.toString())
                .digest('hex');
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Check if file has changed
     */
    hasFileChanged(filePath) {
        if (!this.options.enableChangeDetection) return true;
        
        const currentHash = this.generateFileHash(filePath);
        const cachedHash = this.fileHashes.get(filePath);
        
        return currentHash !== cachedHash;
    }
    
    /**
     * Get file content with intelligent caching
     */
    async getFileContent(filePath) {
        try {
            // Check if file exists and is readable
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const stats = fs.statSync(filePath);
            
            // Skip files that are too large
            if (stats.size > this.options.maxFileSize) {
                this.emit('file-skipped', {
                    filePath: filePath,
                    reason: 'file_too_large',
                    size: stats.size
                });
                return null;
            }
            
            // Check cache first
            const cacheKey = `file:${filePath}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && !this.hasFileChanged(filePath)) {
                this.stats.cacheHits++;
                this.emit('cache-hit', { filePath: filePath });
                return cached.content;
            }
            
            // Read file from disk
            const content = await fs.promises.readFile(filePath, 'utf8');
            this.stats.filesRead++;
            this.stats.cacheMisses++;
            
            // Update file hash
            if (this.options.enableContentHashing) {
                const hash = this.generateFileHash(filePath);
                this.fileHashes.set(filePath, hash);
            }
            
            // Cache the content
            this.cache.set(cacheKey, content, {
                filePath: filePath,
                size: stats.size,
                mtime: stats.mtime,
                timestamp: Date.now()
            });
            
            this.stats.filesCached++;
            
            this.emit('file-cached', {
                filePath: filePath,
                size: stats.size
            });
            
            return content;
            
        } catch (error) {
            this.emit('file-read-error', {
                filePath: filePath,
                error: error.message
            });
            return null;
        }
    }
    
    /**
     * Batch file operations for efficiency
     */
    async batchGetFileContent(filePaths) {
        const results = new Map();
        const uncachedFiles = [];
        
        // Check cache for all files first
        for (const filePath of filePaths) {
            const cacheKey = `file:${filePath}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && !this.hasFileChanged(filePath)) {
                results.set(filePath, cached.content);
                this.stats.cacheHits++;
            } else {
                uncachedFiles.push(filePath);
            }
        }
        
        // Read uncached files in parallel
        const readPromises = uncachedFiles.map(async (filePath) => {
            const content = await this.getFileContent(filePath);
            if (content) {
                results.set(filePath, content);
            }
        });
        
        await Promise.all(readPromises);
        
        return results;
    }
    
    /**
     * Watch file for changes
     */
    watchFile(filePath, callback) {
        if (this.watchedFiles.has(filePath)) {
            return; // Already watching
        }
        
        try {
            const watcher = fs.watch(filePath, (eventType) => {
                if (eventType === 'change') {
                    this.handleFileChange(filePath, callback);
                }
            });
            
            this.watchedFiles.set(filePath, watcher);
            
            this.emit('file-watched', { filePath: filePath });
            
        } catch (error) {
            this.emit('watch-error', {
                filePath: filePath,
                error: error.message
            });
        }
    }
    
    /**
     * Handle file change
     */
    async handleFileChange(filePath, callback) {
        try {
            // Invalidate cache for this file
            const cacheKey = `file:${filePath}`;
            this.cache.cache.delete(cacheKey);
            this.fileHashes.delete(filePath);
            
            this.stats.changesDetected++;
            
            // Get updated content
            const content = await this.getFileContent(filePath);
            
            if (callback) {
                callback(content, filePath);
            }
            
            this.emit('file-changed', {
                filePath: filePath,
                content: content
            });
            
        } catch (error) {
            this.emit('change-handler-error', {
                filePath: filePath,
                error: error.message
            });
        }
    }
    
    /**
     * Stop watching file
     */
    unwatchFile(filePath) {
        const watcher = this.watchedFiles.get(filePath);
        if (watcher) {
            watcher.close();
            this.watchedFiles.delete(filePath);
            
            this.emit('file-unwatched', { filePath: filePath });
        }
    }
    
    /**
     * Stop watching all files
     */
    unwatchAllFiles() {
        for (const [filePath, watcher] of this.watchedFiles) {
            watcher.close();
        }
        this.watchedFiles.clear();
        
        this.emit('all-files-unwatched');
    }
    
    /**
     * Get file statistics
     */
    getFileStats(filePath) {
        return this.fileStats.get(filePath) || null;
    }
    
    /**
     * Update file statistics
     */
    updateFileStats(filePath, stats) {
        this.fileStats.set(filePath, {
            ...stats,
            lastAccessed: Date.now()
        });
    }
    
    /**
     * Clear cache for specific file
     */
    clearFileCache(filePath) {
        const cacheKey = `file:${filePath}`;
        this.cache.cache.delete(cacheKey);
        this.fileHashes.delete(filePath);
        
        this.emit('file-cache-cleared', { filePath: filePath });
    }
    
    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.cache.clear();
        this.fileHashes.clear();
        this.fileStats.clear();
        
        this.emit('all-caches-cleared');
    }
    
    /**
     * Get storage statistics
     */
    getStats() {
        const cacheStats = this.cache.getStats();
        
        return {
            ...this.stats,
            cache: cacheStats,
            watchedFiles: this.watchedFiles.size,
            fileHashes: this.fileHashes.size,
            fileStats: this.fileStats.size,
            options: this.options
        };
    }
    
    /**
     * Optimize storage
     */
    async optimize() {
        // Cleanup expired cache entries
        this.cache.cleanup();
        
        // Remove old file statistics
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        for (const [filePath, stats] of this.fileStats) {
            if (now - stats.lastAccessed > maxAge) {
                this.fileStats.delete(filePath);
            }
        }
        
        // Persist cache to disk
        await this.cache.persist();
        
        this.emit('optimized', {
            cacheSize: this.cache.cache.size,
            fileStats: this.fileStats.size
        });
    }
    
    /**
     * Destroy storage and cleanup
     */
    destroy() {
        this.unwatchAllFiles();
        this.clearAllCaches();
        this.cache.destroy();
        this.removeAllListeners();
    }
}

module.exports = OptimizedFileStorage;