/**
 * Optimization Manager
 * Integrates all optimization services for comprehensive performance improvements
 */

const { EventEmitter } = require('events');
const path = require('path');

// Import all optimization services
const IntelligentCache = require('./intelligent-cache');
const OptimizedFileStorage = require('./optimized-file-storage');
const MemoryManager = require('./memory-manager');
const WebSocketManager = require('./websocket-manager');
const APIManager = require('./api-manager');
const LargeFileManager = require('./large-file-manager');
const ContentDeduplicator = require('./content-deduplicator');

class OptimizationManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            storageDir: options.storageDir || path.join(process.cwd(), '.optimizations'),
            enableAllOptimizations: options.enableAllOptimizations !== false,
            ...options
        };
        
        // Initialize all optimization services
        this.services = {
            cache: null,
            fileStorage: null,
            memory: null,
            websocket: null,
            api: null,
            largeFiles: null,
            deduplicator: null
        };
        
        this.isInitialized = false;
        this.stats = {
            servicesInitialized: 0,
            totalOptimizations: 0,
            performanceGains: 0,
            errors: 0
        };
        
        this.setupEventHandlers();
    }
    
    /**
     * Initialize all optimization services
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('Optimization manager already initialized');
            return;
        }
        
        try {
            console.log('Initializing optimization services...');
            
            // Initialize memory manager first
            await this.initializeMemoryManager();
            
            // Initialize cache system
            await this.initializeCache();
            
            // Initialize file storage
            await this.initializeFileStorage();
            
            // Initialize large file manager
            await this.initializeLargeFileManager();
            
            // Initialize content deduplicator
            await this.initializeContentDeduplicator();
            
            // Initialize API manager
            await this.initializeAPIManager();
            
            // Initialize WebSocket manager
            await this.initializeWebSocketManager();
            
            // Setup service integrations
            this.setupServiceIntegrations();
            
            this.isInitialized = true;
            this.stats.servicesInitialized = Object.keys(this.services).length;
            
            console.log('✅ All optimization services initialized');
            this.emit('initialized', this.getStats());
            
        } catch (error) {
            console.error('❌ Failed to initialize optimization services:', error);
            this.stats.errors++;
            this.emit('initialization-error', error);
            throw error;
        }
    }
    
    /**
     * Initialize memory manager
     */
    async initializeMemoryManager() {
        this.services.memory = new MemoryManager({
            maxMemoryUsage: 500 * 1024 * 1024, // 500MB
            enableAutoGC: true,
            monitoringInterval: 30000
        });
        
        this.services.memory.on('memory-warning', (data) => {
            this.emit('memory-warning', data);
        });
        
        this.services.memory.on('memory-critical', (data) => {
            this.emit('memory-critical', data);
            this.handleMemoryCritical();
        });
        
        console.log('✅ Memory manager initialized');
    }
    
    /**
     * Initialize cache system
     */
    async initializeCache() {
        this.services.cache = new IntelligentCache({
            maxCacheSize: 1000,
            enableDeduplication: true,
            enableCompression: true,
            storageDir: path.join(this.options.storageDir, 'cache')
        });
        
        this.services.cache.on('deduplication', (data) => {
            this.stats.performanceGains += 1024; // Estimate performance gain
            this.emit('cache-deduplication', data);
        });
        
        console.log('✅ Intelligent cache initialized');
    }
    
    /**
     * Initialize file storage
     */
    async initializeFileStorage() {
        this.services.fileStorage = new OptimizedFileStorage({
            storageDir: path.join(this.options.storageDir, 'files'),
            maxCacheSize: 500,
            enableChangeDetection: true,
            enableContentHashing: true
        });
        
        this.services.fileStorage.on('file-cached', (data) => {
            this.emit('file-cached', data);
        });
        
        console.log('✅ Optimized file storage initialized');
    }
    
    /**
     * Initialize large file manager
     */
    async initializeLargeFileManager() {
        this.services.largeFiles = new LargeFileManager({
            storageDir: path.join(this.options.storageDir, 'large-files'),
            largeFileThreshold: 10 * 1024 * 1024, // 10MB
            enableCompression: true,
            enableDeduplication: true
        });
        
        this.services.largeFiles.on('file-stored', (data) => {
            this.emit('large-file-stored', data);
        });
        
        console.log('✅ Large file manager initialized');
    }
    
    /**
     * Initialize content deduplicator
     */
    async initializeContentDeduplicator() {
        this.services.deduplicator = new ContentDeduplicator({
            storageDir: path.join(this.options.storageDir, 'deduplication'),
            enableSimilarityDetection: true,
            enableSemanticHashing: true,
            enableChunking: true
        });
        
        this.services.deduplicator.on('duplicate-found', (data) => {
            this.stats.performanceGains += data.size;
            this.emit('content-deduplicated', data);
        });
        
        console.log('✅ Content deduplicator initialized');
    }
    
    /**
     * Initialize API manager
     */
    async initializeAPIManager() {
        this.services.api = new APIManager({
            baseURL: 'http://localhost:3000',
            timeout: 30000,
            retries: 3,
            enableCircuitBreaker: true,
            enableRequestDeduplication: true
        });
        
        this.services.api.on('request-success', (data) => {
            this.emit('api-success', data);
        });
        
        this.services.api.on('request-failed', (data) => {
            this.emit('api-failed', data);
        });
        
        console.log('✅ API manager initialized');
    }
    
    /**
     * Initialize WebSocket manager
     */
    async initializeWebSocketManager() {
        this.services.websocket = new WebSocketManager({
            port: 3000,
            maxConnections: 1000,
            enableCompression: true,
            heartbeatInterval: 30000
        });
        
        this.services.websocket.on('client-connected', (data) => {
            this.emit('websocket-client-connected', data);
        });
        
        this.services.websocket.on('client-disconnected', (data) => {
            this.emit('websocket-client-disconnected', data);
        });
        
        console.log('✅ WebSocket manager initialized');
    }
    
    /**
     * Setup service integrations
     */
    setupServiceIntegrations() {
        // Memory manager integration
        if (this.services.memory) {
            // Add cleanup tasks for all services
            this.services.memory.addCleanupTask(() => {
                if (this.services.cache) {
                    this.services.cache.cleanup();
                }
            }, 1);
            
            this.services.memory.addCleanupTask(() => {
                if (this.services.fileStorage) {
                    this.services.fileStorage.optimize();
                }
            }, 2);
            
            this.services.memory.addCleanupTask(() => {
                if (this.services.deduplicator) {
                    this.services.deduplicator.cleanupOldContent();
                }
            }, 3);
        }
        
        // Cache integration with file storage
        if (this.services.cache && this.services.fileStorage) {
            this.services.fileStorage.cache = this.services.cache;
        }
        
        // Large file integration with deduplicator
        if (this.services.largeFiles && this.services.deduplicator) {
            this.services.largeFiles.deduplicator = this.services.deduplicator;
        }
    }
    
    /**
     * Handle memory critical situation
     */
    handleMemoryCritical() {
        console.log('🚨 Memory critical - triggering emergency optimizations');
        
        // Clear all caches
        if (this.services.cache) {
            this.services.cache.clear();
        }
        
        // Optimize file storage
        if (this.services.fileStorage) {
            this.services.fileStorage.optimize();
        }
        
        // Cleanup old content
        if (this.services.deduplicator) {
            this.services.deduplicator.cleanupOldContent();
        }
        
        // Force garbage collection
        if (this.services.memory) {
            this.services.memory.forceGarbageCollection();
        }
        
        this.emit('emergency-optimization', {
            timestamp: Date.now(),
            services: Object.keys(this.services)
        });
    }
    
    /**
     * Get optimization service
     */
    getService(serviceName) {
        return this.services[serviceName] || null;
    }
    
    /**
     * Get all services
     */
    getServices() {
        return this.services;
    }
    
    /**
     * Start WebSocket server
     */
    async startWebSocketServer(server) {
        if (!this.services.websocket) {
            throw new Error('WebSocket manager not initialized');
        }
        
        await this.services.websocket.start(server);
    }
    
    /**
     * Stop WebSocket server
     */
    async stopWebSocketServer() {
        if (this.services.websocket) {
            await this.services.websocket.stop();
        }
    }
    
    /**
     * Store content with full optimization
     */
    async storeContent(content, metadata = {}) {
        try {
            let contentId = null;
            
            // Check if content is large
            const contentSize = Buffer.byteLength(content, 'utf8');
            if (contentSize > 10 * 1024 * 1024) { // 10MB
                // Use large file manager
                if (this.services.largeFiles) {
                    contentId = await this.services.largeFiles.storeLargeFile(content, metadata);
                }
            } else {
                // Use content deduplicator
                if (this.services.deduplicator) {
                    contentId = await this.services.deduplicator.storeContent(content, metadata);
                }
            }
            
            // Cache the content
            if (this.services.cache && contentId) {
                this.services.cache.set(contentId, content, metadata);
            }
            
            this.stats.totalOptimizations++;
            
            return contentId;
            
        } catch (error) {
            this.stats.errors++;
            this.emit('storage-error', error);
            throw error;
        }
    }
    
    /**
     * Retrieve content with optimization
     */
    async retrieveContent(contentId) {
        try {
            // Try cache first
            if (this.services.cache) {
                const cached = this.services.cache.get(contentId);
                if (cached) {
                    return cached.content;
                }
            }
            
            // Try deduplicator
            if (this.services.deduplicator) {
                const content = this.services.deduplicator.retrieveContent(contentId);
                if (content) {
                    return content.content;
                }
            }
            
            // Try large file manager
            if (this.services.largeFiles) {
                const metadata = this.services.largeFiles.getFileMetadata(contentId);
                if (metadata) {
                    const tempPath = `/tmp/retrieved_${contentId}`;
                    await this.services.largeFiles.retrieveLargeFile(contentId, tempPath);
                    const content = require('fs').readFileSync(tempPath, 'utf8');
                    require('fs').unlinkSync(tempPath);
                    return content;
                }
            }
            
            return null;
            
        } catch (error) {
            this.stats.errors++;
            this.emit('retrieval-error', error);
            throw error;
        }
    }
    
    /**
     * Get file content with optimization
     */
    async getFileContent(filePath) {
        if (this.services.fileStorage) {
            return await this.services.fileStorage.getFileContent(filePath);
        }
        return null;
    }
    
    /**
     * Make API request with optimization
     */
    async makeAPIRequest(config) {
        if (this.services.api) {
            return await this.services.api.request(config);
        }
        return null;
    }
    
    /**
     * Broadcast WebSocket message
     */
    broadcast(event, data) {
        if (this.services.websocket) {
            this.services.websocket.broadcast(event, data);
        }
    }
    
    /**
     * Get comprehensive statistics
     */
    getStats() {
        const serviceStats = {};
        
        for (const [name, service] of Object.entries(this.services)) {
            if (service && typeof service.getStats === 'function') {
                serviceStats[name] = service.getStats();
            }
        }
        
        return {
            ...this.stats,
            services: serviceStats,
            isInitialized: this.isInitialized,
            options: this.options
        };
    }
    
    /**
     * Perform system optimization
     */
    async optimize() {
        console.log('Performing system optimization...');
        
        const optimizations = [];
        
        // Optimize cache
        if (this.services.cache) {
            this.services.cache.cleanup();
            optimizations.push('cache-cleanup');
        }
        
        // Optimize file storage
        if (this.services.fileStorage) {
            await this.services.fileStorage.optimize();
            optimizations.push('file-storage-optimization');
        }
        
        // Cleanup old content
        if (this.services.deduplicator) {
            await this.services.deduplicator.cleanupOldContent();
            optimizations.push('content-cleanup');
        }
        
        // Cleanup large files
        if (this.services.largeFiles) {
            await this.services.largeFiles.cleanupOrphanedFiles();
            optimizations.push('large-file-cleanup');
        }
        
        // Force garbage collection
        if (this.services.memory) {
            this.services.memory.forceGarbageCollection();
            optimizations.push('garbage-collection');
        }
        
        this.emit('optimization-completed', {
            optimizations: optimizations,
            timestamp: Date.now()
        });
        
        return optimizations;
    }
    
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Handle process events
        process.on('SIGINT', () => {
            this.shutdown();
        });
        
        process.on('SIGTERM', () => {
            this.shutdown();
        });
    }
    
    /**
     * Shutdown all services
     */
    async shutdown() {
        console.log('🛑 Shutting down optimization services...');
        
        try {
            // Stop WebSocket server
            if (this.services.websocket) {
                await this.services.websocket.stop();
            }
            
            // Stop memory monitoring
            if (this.services.memory) {
                this.services.memory.stopMonitoring();
            }
            
            // Destroy all services
            for (const [name, service] of Object.entries(this.services)) {
                if (service && typeof service.destroy === 'function') {
                    service.destroy();
                }
            }
            
            this.emit('shutdown-completed');
            console.log('✅ Optimization services shut down');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            this.emit('shutdown-error', error);
        }
    }
    
    /**
     * Destroy optimization manager
     */
    destroy() {
        this.shutdown();
        this.removeAllListeners();
    }
}

module.exports = OptimizationManager;
