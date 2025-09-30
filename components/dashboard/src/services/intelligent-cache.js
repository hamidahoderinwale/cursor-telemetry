/**
 * Intelligent Caching System
 * Provides content-based deduplication, intelligent caching, and memory optimization
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class IntelligentCache extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            maxCacheSize: options.maxCacheSize || 1000, // Maximum number of cached items
            maxMemoryUsage: options.maxMemoryUsage || 100 * 1024 * 1024, // 100MB max memory
            cacheExpiry: options.cacheExpiry || 3600000, // 1 hour cache expiry
            enableDeduplication: options.enableDeduplication !== false,
            enableCompression: options.enableCompression !== false,
            storageDir: options.storageDir || path.join(process.cwd(), '.intelligent-cache'),
            ...options
        };
        
        this.cache = new Map();
        this.contentHashes = new Map(); // For deduplication
        this.accessTimes = new Map(); // For LRU eviction
        this.memoryUsage = 0;
        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            deduplications: 0,
            compressions: 0
        };
        
        this.setupStorage();
        this.startCleanupInterval();
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
     * Generate content hash for deduplication
     */
    generateContentHash(content) {
        if (typeof content === 'object') {
            content = JSON.stringify(content);
        }
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    /**
     * Compress content if enabled
     */
    compressContent(content) {
        if (!this.options.enableCompression) return content;
        
        try {
            const zlib = require('zlib');
            const compressed = zlib.gzipSync(content);
            this.stats.compressions++;
            return compressed;
        } catch (error) {
            console.warn('Compression failed, using original content:', error.message);
            return content;
        }
    }
    
    /**
     * Decompress content if compressed
     */
    decompressContent(content) {
        if (!this.options.enableCompression) return content;
        
        try {
            const zlib = require('zlib');
            return zlib.gunzipSync(content);
        } catch (error) {
            // Not compressed, return as is
            return content;
        }
    }
    
    /**
     * Calculate memory usage of content
     */
    calculateMemoryUsage(content) {
        if (Buffer.isBuffer(content)) {
            return content.length;
        }
        return Buffer.byteLength(JSON.stringify(content), 'utf8');
    }
    
    /**
     * Get cache entry
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        
        // Check expiry
        if (Date.now() - entry.timestamp > this.options.cacheExpiry) {
            this.cache.delete(key);
            this.accessTimes.delete(key);
            this.stats.misses++;
            return null;
        }
        
        // Update access time for LRU
        this.accessTimes.set(key, Date.now());
        this.stats.hits++;
        
        // Decompress if needed
        const content = this.decompressContent(entry.content);
        
        return {
            content: content,
            metadata: entry.metadata,
            timestamp: entry.timestamp,
            hash: entry.hash
        };
    }
    
    /**
     * Set cache entry with intelligent deduplication
     */
    set(key, content, metadata = {}) {
        const contentHash = this.generateContentHash(content);
        
        // Check for deduplication
        if (this.options.enableDeduplication && this.contentHashes.has(contentHash)) {
            const existingKey = this.contentHashes.get(contentHash);
            const existingEntry = this.cache.get(existingKey);
            
            if (existingEntry) {
                // Update metadata and access time
                existingEntry.metadata = { ...existingEntry.metadata, ...metadata };
                this.accessTimes.set(existingKey, Date.now());
                this.stats.deduplications++;
                
                this.emit('deduplication', {
                    originalKey: existingKey,
                    duplicateKey: key,
                    hash: contentHash
                });
                
                return existingKey;
            }
        }
        
        // Compress content
        const compressedContent = this.compressContent(content);
        const memoryUsage = this.calculateMemoryUsage(compressedContent);
        
        // Check memory limits
        if (this.memoryUsage + memoryUsage > this.options.maxMemoryUsage) {
            this.evictLRU();
        }
        
        // Check cache size limits
        if (this.cache.size >= this.options.maxCacheSize) {
            this.evictLRU();
        }
        
        // Create cache entry
        const entry = {
            content: compressedContent,
            metadata: metadata,
            timestamp: Date.now(),
            hash: contentHash,
            memoryUsage: memoryUsage
        };
        
        this.cache.set(key, entry);
        this.contentHashes.set(contentHash, key);
        this.accessTimes.set(key, Date.now());
        this.memoryUsage += memoryUsage;
        
        this.emit('cache-set', {
            key: key,
            hash: contentHash,
            memoryUsage: memoryUsage
        });
        
        return key;
    }
    
    /**
     * Evict least recently used entry
     */
    evictLRU() {
        if (this.cache.size === 0) return;
        
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, accessTime] of this.accessTimes) {
            if (accessTime < oldestTime) {
                oldestTime = accessTime;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            const entry = this.cache.get(oldestKey);
            if (entry) {
                this.memoryUsage -= entry.memoryUsage;
                this.contentHashes.delete(entry.hash);
            }
            
            this.cache.delete(oldestKey);
            this.accessTimes.delete(oldestKey);
            this.stats.evictions++;
            
            this.emit('cache-eviction', {
                key: oldestKey,
                reason: 'LRU'
            });
        }
    }
    
    /**
     * Check if content has changed
     */
    hasChanged(key, newContent) {
        const entry = this.cache.get(key);
        if (!entry) return true;
        
        const newHash = this.generateContentHash(newContent);
        return entry.hash !== newHash;
    }
    
    /**
     * Get or set with change detection
     */
    getOrSet(key, content, metadata = {}) {
        const existing = this.get(key);
        
        if (existing && !this.hasChanged(key, content)) {
            return existing;
        }
        
        return this.set(key, content, metadata);
    }
    
    /**
     * Batch operations for efficiency
     */
    batchSet(entries) {
        const results = [];
        
        for (const { key, content, metadata } of entries) {
            results.push(this.set(key, content, metadata));
        }
        
        return results;
    }
    
    /**
     * Batch get operations
     */
    batchGet(keys) {
        const results = new Map();
        
        for (const key of keys) {
            const value = this.get(key);
            if (value) {
                results.set(key, value);
            }
        }
        
        return results;
    }
    
    /**
     * Clear cache
     */
    clear() {
        this.cache.clear();
        this.contentHashes.clear();
        this.accessTimes.clear();
        this.memoryUsage = 0;
        
        this.emit('cache-cleared');
    }
    
    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
            : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.options.maxCacheSize,
            memoryUsage: this.memoryUsage,
            maxMemoryUsage: this.options.maxMemoryUsage,
            hitRate: hitRate.toFixed(2) + '%',
            stats: { ...this.stats },
            options: this.options
        };
    }
    
    /**
     * Start cleanup interval
     */
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000); // Cleanup every 5 minutes
    }
    
    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.cache) {
            if (now - entry.timestamp > this.options.cacheExpiry) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            const entry = this.cache.get(key);
            if (entry) {
                this.memoryUsage -= entry.memoryUsage;
                this.contentHashes.delete(entry.hash);
            }
            
            this.cache.delete(key);
            this.accessTimes.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            this.emit('cleanup', {
                expiredCount: expiredKeys.length,
                remainingSize: this.cache.size
            });
        }
    }
    
    /**
     * Persist cache to disk
     */
    async persist() {
        const cacheFile = path.join(this.options.storageDir, 'cache.json');
        const data = {
            cache: Array.from(this.cache.entries()),
            contentHashes: Array.from(this.contentHashes.entries()),
            accessTimes: Array.from(this.accessTimes.entries()),
            stats: this.stats,
            timestamp: Date.now()
        };
        
        try {
            await fs.promises.writeFile(cacheFile, JSON.stringify(data, null, 2));
            this.emit('persisted', { file: cacheFile });
        } catch (error) {
            this.emit('persist-error', error);
        }
    }
    
    /**
     * Load cache from disk
     */
    async load() {
        const cacheFile = path.join(this.options.storageDir, 'cache.json');
        
        try {
            const data = JSON.parse(await fs.promises.readFile(cacheFile, 'utf8'));
            
            this.cache = new Map(data.cache);
            this.contentHashes = new Map(data.contentHashes);
            this.accessTimes = new Map(data.accessTimes);
            this.stats = data.stats;
            
            // Recalculate memory usage
            this.memoryUsage = 0;
            for (const [key, entry] of this.cache) {
                this.memoryUsage += entry.memoryUsage || 0;
            }
            
            this.emit('loaded', { file: cacheFile, size: this.cache.size });
        } catch (error) {
            // Cache file doesn't exist or is corrupted, start fresh
            this.emit('load-error', error);
        }
    }
    
    /**
     * Destroy cache and cleanup
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.clear();
        this.removeAllListeners();
    }
}

module.exports = IntelligentCache;
