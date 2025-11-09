/**
 * Enhanced File Watcher with Real-time Monitoring
 * Implements comprehensive file-watching methodology for the Cursor Telemetry Dashboard
 */

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

class EnhancedFileWatcher extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Default watch paths
            watchPaths: options.watchPaths || [
                process.cwd(),
                path.join(process.env.HOME || '', 'Desktop'),
                path.join(process.env.HOME || '', 'Documents')
            ],
            
            // File patterns to watch
            includePatterns: options.includePatterns || [
                '**/*.py',
                '**/*.js',
                '**/*.ts',
                '**/*.jsx',
                '**/*.tsx',
                '**/*.ipynb',
                '**/*.md',
                '**/*.json',
                '**/*.yaml',
                '**/*.yml'
            ],
            
            // Patterns to ignore
            ignorePatterns: options.ignorePatterns || [
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
                '**/.next/**',
                '**/coverage/**',
                '**/.pytest_cache/**',
                '**/__pycache__/**',
                '**/.DS_Store',
                '**/Thumbs.db',
                '**/*.log',
                '**/.cursor/**',
                '**/.vscode/**',
                '**/*.pdf',
                '**/*.doc',
                '**/*.docx',
                '**/*.ppt',
                '**/*.pptx',
                '**/*.xls',
                '**/*.xlsx',
                '**/*.zip',
                '**/*.tar',
                '**/*.gz',
                '**/*.rar',
                '**/*.7z',
                '**/*.dmg',
                '**/*.iso',
                '**/*.img',
                '**/*.bin',
                '**/*.exe',
                '**/*.app',
                '**/*.pkg',
                '**/*.deb',
                '**/*.rpm',
                // Exclude dashboard files to prevent infinite loops
                '**/components/dashboard/**',
                '**/cursor_dashboard/**',
                '**/web-interface/**',
                '**/enhanced-file-watcher.js',
                '**/enhanced-monitoring-service.js',
                // Exclude virtual environments and package directories
                '**/venv/**',
                '**/env/**',
                '**/site-packages/**',
                '**/lib/python*/**',
                '**/__pycache__/**',
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/snapshots/**',
                // Exclude HF Project virtual environments specifically
                '**/HF Project/**/venv/**',
                '**/HF Project/**/site-packages/**',
                '**/HF Project/**/lib/**',
                '**/HF Project/**/bin/**',
                '**/HF Project/**/include/**',
                '**/HF Project/**/share/**',
                // Exclude all virtual environment patterns
                '**/*/venv/**',
                '**/*/env/**',
                '**/*/site-packages/**',
                '**/*/lib/python*/**',
                '**/*/__pycache__/**'
            ],
            
            // Debounce settings
            debounceDelay: options.debounceDelay || 10000,
            
            // File size limits
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
            
            // Enable deep watching
            deepWatch: options.deepWatch !== false,
            
            // Enable real-time processing
            realTimeProcessing: options.realTimeProcessing !== false
        };
        
        this.watchers = new Map();
        this.changeBuffer = new Map();
        this.processingQueue = [];
        this.isProcessing = false;
        this.recentEvents = new Map(); // Track recent events to prevent duplicates
        this.maxRecentEvents = 100; // Limit recent events cache to prevent memory issues
        this.stats = {
            filesWatched: 0,
            changesDetected: 0,
            changesProcessed: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        this.setupEventHandlers();
    }
    
    /**
     * Setup event handlers for the file watcher
     */
    setupEventHandlers() {
        this.on('fileChanged', this.handleFileChange.bind(this));
        this.on('fileAdded', this.handleFileAdded.bind(this));
        this.on('fileDeleted', this.handleFileDeleted.bind(this));
        this.on('error', this.handleError.bind(this));
    }
    
    /**
     * Start watching files
     */
    async startWatching() {
        console.log('Starting Enhanced File Watcher...');
        console.log(`📁 Watch paths: ${this.options.watchPaths.join(', ')}`);
        console.log(`Include patterns: ${this.options.includePatterns.join(', ')}`);
        console.log(`🚫 Ignore patterns: ${this.options.ignorePatterns.join(', ')}`);
        
        for (const watchPath of this.options.watchPaths) {
            if (fs.existsSync(watchPath)) {
                await this.startWatchingPath(watchPath);
            } else {
                console.warn(`Watch path does not exist: ${watchPath}`);
            }
        }
        
        // Start processing queue
        this.startProcessingQueue();
        
        // Start memory cleanup
        this.startMemoryCleanup();
        
        console.log(`✅ File watcher started. Watching ${this.stats.filesWatched} files.`);
        this.emit('started', this.stats);
    }
    
    /**
     * Start watching a specific path
     */
    async startWatchingPath(watchPath) {
        const normalizedPath = path.resolve(watchPath);
        
        if (this.watchers.has(normalizedPath)) {
            console.log(`📁 Already watching: ${normalizedPath}`);
            return;
        }
        
        console.log(`📁 Starting to watch: ${normalizedPath}`);
        
        const watcher = chokidar.watch(normalizedPath, {
            ignored: this.options.ignorePatterns,
            persistent: true,
            ignoreInitial: true,
            followSymlinks: false,
            depth: this.options.deepWatch ? undefined : 1,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            }
        });
        
        // Set up event listeners
        watcher
            .on('add', (filePath) => this.handleFileEvent('add', filePath))
            .on('change', (filePath) => this.handleFileEvent('change', filePath))
            .on('unlink', (filePath) => this.handleFileEvent('unlink', filePath))
            .on('error', (error) => this.handleError(error))
            .on('ready', () => {
                console.log(`✅ Ready watching: ${normalizedPath}`);
                this.stats.filesWatched += watcher.getWatched()[normalizedPath]?.length || 0;
            });
        
        this.watchers.set(normalizedPath, watcher);
    }
    
    /**
     * Handle file events with debouncing and deduplication
     */
    handleFileEvent(eventType, filePath) {
        const normalizedPath = path.resolve(filePath);
        const now = Date.now();
        
        // Create event key for deduplication
        const eventKey = `${eventType}:${normalizedPath}`;
        
        // Check if we've seen this exact event recently (within 5 seconds)
        if (this.recentEvents.has(eventKey)) {
            const lastSeen = this.recentEvents.get(eventKey);
            if (now - lastSeen < 5000) {
                // Skip duplicate event
                return;
            }
        }
        
        // Update recent events cache
        this.recentEvents.set(eventKey, now);
        
        // Clean up old events from cache
        if (this.recentEvents.size > this.maxRecentEvents) {
            const oldestKey = this.recentEvents.keys().next().value;
            this.recentEvents.delete(oldestKey);
        }
        
        // Check file size
        try {
            const stats = fs.statSync(normalizedPath);
            if (stats.size > this.options.maxFileSize) {
                console.log(`Skipping large file: ${normalizedPath} (${stats.size} bytes)`);
                return;
            }
        } catch (error) {
            // File might have been deleted
            if (eventType !== 'unlink') {
                console.warn(`Could not stat file: ${normalizedPath}`);
            }
        }
        
        // Create change event
        const changeEvent = {
            id: this.generateEventId(),
            type: eventType,
            filePath: normalizedPath,
            timestamp: new Date().toISOString(),
            relativePath: path.relative(process.cwd(), normalizedPath),
            fileExtension: path.extname(normalizedPath),
            fileName: path.basename(normalizedPath)
        };
        
        // Debounce changes
        this.debounceChange(normalizedPath, changeEvent);
        
        this.stats.changesDetected++;
    }
    
    /**
     * Debounce file changes to avoid excessive processing
     */
    debounceChange(filePath, changeEvent) {
        // Clear existing timeout
        if (this.changeBuffer.has(filePath)) {
            clearTimeout(this.changeBuffer.get(filePath).timeout);
        }
        
        // Set new timeout
        const timeout = setTimeout(() => {
            this.processChangeEvent(changeEvent);
            this.changeBuffer.delete(filePath);
        }, this.options.debounceDelay);
        
        this.changeBuffer.set(filePath, {
            event: changeEvent,
            timeout: timeout
        });
    }
    
    /**
     * Process a change event
     */
    async processChangeEvent(changeEvent) {
        try {
            // Add to processing queue
            this.processingQueue.push(changeEvent);
            
            // Process immediately if not already processing
            if (!this.isProcessing) {
                await this.processQueue();
            }
            
        } catch (error) {
            console.error(`❌ Error processing change event:`, error);
            this.stats.errors++;
        }
    }
    
    /**
     * Process the change queue
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.processingQueue.length > 0) {
            const changeEvent = this.processingQueue.shift();
            await this.processChange(changeEvent);
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Process a single change
     */
    async processChange(changeEvent) {
        try {
            const { type, filePath } = changeEvent;
            
            switch (type) {
                case 'add':
                    await this.handleFileAdded(changeEvent);
                    break;
                case 'change':
                    await this.handleFileChange(changeEvent);
                    break;
                case 'unlink':
                    await this.handleFileDeleted(changeEvent);
                    break;
            }
            
            this.stats.changesProcessed++;
            
        } catch (error) {
            console.error(`❌ Error processing change:`, error);
            this.stats.errors++;
        }
    }
    
    /**
     * Handle file added event
     */
    async handleFileAdded(changeEvent) {
        console.log(`➕ File added: ${changeEvent.relativePath}`);
        
        // Read file content if it's a text file
        const content = await this.readFileContent(changeEvent.filePath);
        
        const enhancedEvent = {
            ...changeEvent,
            content: content,
            size: content ? content.length : 0,
            isTextFile: this.isTextFile(changeEvent.fileExtension)
        };
        
        this.emit('fileAdded', enhancedEvent);
    }
    
    /**
     * Handle file change event
     */
    async handleFileChange(changeEvent) {
        console.log(`File changed: ${changeEvent.relativePath}`);
        
        // Read file content
        const content = await this.readFileContent(changeEvent.filePath);
        
        const enhancedEvent = {
            ...changeEvent,
            content: content,
            size: content ? content.length : 0,
            isTextFile: this.isTextFile(changeEvent.fileExtension)
        };
        
        this.emit('fileChanged', enhancedEvent);
    }
    
    /**
     * Handle file deleted event
     */
    async handleFileDeleted(changeEvent) {
        console.log(`File deleted: ${changeEvent.relativePath}`);
        
        this.emit('fileDeleted', changeEvent);
    }
    
    /**
     * Handle errors
     */
    handleError(error) {
        console.error(`❌ File watcher error:`, error);
        this.stats.errors++;
        this.emit('error', error);
    }
    
    /**
     * Read file content safely
     */
    async readFileContent(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                return null;
            }
            
            // Only read text files
            if (!this.isTextFile(path.extname(filePath))) {
                return null;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            return content;
            
        } catch (error) {
            console.warn(`Could not read file: ${filePath}`, error.message);
            return null;
        }
    }
    
    /**
     * Check if file is a text file
     */
    isTextFile(extension) {
        const textExtensions = [
            '.py', '.js', '.ts', '.jsx', '.tsx', '.html', '.css', '.scss', '.sass',
            '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.csv', '.ipynb',
            '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.php', '.rb',
            '.swift', '.kt', '.scala', '.sh', '.bash', '.zsh', '.fish'
        ];
        
        return textExtensions.includes(extension.toLowerCase());
    }
    
    /**
     * Generate unique event ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Start processing queue
     */
    startProcessingQueue() {
        setInterval(() => {
            if (!this.isProcessing && this.processingQueue.length > 0) {
                this.processQueue();
            }
        }, 1000);
    }
    
    /**
     * Start memory cleanup
     */
    startMemoryCleanup() {
        setInterval(() => {
            this.cleanupMemory();
        }, 30000); // Clean up every 30 seconds
    }
    
    /**
     * Clean up memory to prevent leaks
     */
    cleanupMemory() {
        const now = Date.now();
        
        // Clean up old recent events (older than 1 minute)
        for (const [key, timestamp] of this.recentEvents) {
            if (now - timestamp > 60000) {
                this.recentEvents.delete(key);
            }
        }
        
        // Limit processing queue size
        if (this.processingQueue.length > 100) {
            this.processingQueue = this.processingQueue.slice(-50); // Keep only last 50
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
    
    /**
     * Stop watching
     */
    async stopWatching() {
        console.log(' Stopping file watcher...');
        
        // Clear all timeouts
        for (const [filePath, buffer] of this.changeBuffer) {
            clearTimeout(buffer.timeout);
        }
        this.changeBuffer.clear();
        
        // Close all watchers
        for (const [path, watcher] of this.watchers) {
            await watcher.close();
        }
        this.watchers.clear();
        
        console.log('✅ File watcher stopped');
        this.emit('stopped');
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            queueLength: this.processingQueue.length,
            bufferSize: this.changeBuffer.size,
            watchersCount: this.watchers.size
        };
    }
    
    /**
     * Add new watch path
     */
    async addWatchPath(watchPath) {
        if (!this.options.watchPaths.includes(watchPath)) {
            this.options.watchPaths.push(watchPath);
        }
        
        if (fs.existsSync(watchPath)) {
            await this.startWatchingPath(watchPath);
        }
    }
    
    /**
     * Remove watch path
     */
    async removeWatchPath(watchPath) {
        const normalizedPath = path.resolve(watchPath);
        
        if (this.watchers.has(normalizedPath)) {
            await this.watchers.get(normalizedPath).close();
            this.watchers.delete(normalizedPath);
        }
        
        const index = this.options.watchPaths.indexOf(watchPath);
        if (index > -1) {
            this.options.watchPaths.splice(index, 1);
        }
    }
}

module.exports = EnhancedFileWatcher;
