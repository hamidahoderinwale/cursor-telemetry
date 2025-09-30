/**
 * Enhanced Monitoring Service
 * Integrates file watching with real-time dashboard updates
 */

const EnhancedFileWatcher = require('./enhanced-file-watcher');
const { EventEmitter } = require('events');

class EnhancedMonitoringService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            // Dashboard integration
            dashboardPort: options.dashboardPort || 3000,
            updateInterval: options.updateInterval || 5000,
            
            // File watching
            watchPaths: options.watchPaths || [
                process.cwd(),
                require('path').join(process.env.HOME || '', 'Desktop'),
                require('path').join(process.env.HOME || '', 'Documents')
            ],
            
            // Data processing
            enableRealTimeUpdates: options.enableRealTimeUpdates !== false,
            enableFileAnalysis: options.enableFileAnalysis !== false,
            enableSessionTracking: options.enableSessionTracking !== false
        };
        
        this.fileWatcher = null;
        this.isRunning = false;
        this.stats = {
            startTime: Date.now(),
            filesProcessed: 0,
            changesDetected: 0,
            sessionsTracked: 0,
            errors: 0
        };
        
        this.setupFileWatcher();
        this.setupEventHandlers();
    }
    
    /**
     * Setup file watcher
     */
    setupFileWatcher() {
        this.fileWatcher = new EnhancedFileWatcher({
            watchPaths: this.options.watchPaths,
            debounceDelay: 1000,
            realTimeProcessing: true
        });
        
        // Forward file watcher events
        this.fileWatcher.on('fileChanged', (event) => {
            this.handleFileChange(event);
        });
        
        this.fileWatcher.on('fileAdded', (event) => {
            this.handleFileAdded(event);
        });
        
        this.fileWatcher.on('fileDeleted', (event) => {
            this.handleFileDeleted(event);
        });
        
        this.fileWatcher.on('error', (error) => {
            this.handleError(error);
        });
    }
    
    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Handle dashboard requests
        this.on('request-stats', () => {
            this.emit('stats-update', this.getStats());
        });
        
        this.on('request-file-changes', () => {
            this.emit('file-changes-update', this.getRecentFileChanges());
        });
    }
    
    /**
     * Start monitoring service
     */
    async start() {
        if (this.isRunning) {
            console.log('Monitoring service already running');
            return;
        }
        
        console.log('Starting Enhanced Monitoring Service...');
        
        try {
            // Start file watcher
            await this.fileWatcher.startWatching();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            this.isRunning = true;
            console.log('✅ Enhanced Monitoring Service started');
            
            this.emit('started', this.getStats());
            
        } catch (error) {
            console.error('❌ Failed to start monitoring service:', error);
            this.stats.errors++;
            throw error;
        }
    }
    
    /**
     * Stop monitoring service
     */
    async stop() {
        if (!this.isRunning) {
            console.log('Monitoring service not running');
            return;
        }
        
        console.log('🛑 Stopping Enhanced Monitoring Service...');
        
        try {
            // Stop file watcher
            await this.fileWatcher.stopWatching();
            
            // Stop periodic updates
            this.stopPeriodicUpdates();
            
            this.isRunning = false;
            console.log('✅ Enhanced Monitoring Service stopped');
            
            this.emit('stopped');
            
        } catch (error) {
            console.error('❌ Error stopping monitoring service:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * Handle file change
     */
    async handleFileChange(event) {
        try {
            console.log(`Processing file change: ${event.relativePath}`);
            
            // Analyze the change
            const analysis = await this.analyzeFileChange(event);
            
            // Create change record
            const changeRecord = {
                id: event.id,
                type: 'file_change',
                filePath: event.filePath,
                relativePath: event.relativePath,
                timestamp: event.timestamp,
                fileExtension: event.fileExtension,
                fileName: event.fileName,
                size: event.size,
                content: event.content,
                analysis: analysis
            };
            
            // Store the change
            await this.storeChange(changeRecord);
            
            // Emit real-time update
            if (this.options.enableRealTimeUpdates) {
                this.emit('file-change-detected', changeRecord);
            }
            
            this.stats.filesProcessed++;
            this.stats.changesDetected++;
            
        } catch (error) {
            console.error('❌ Error handling file change:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * Handle file added
     */
    async handleFileAdded(event) {
        try {
            console.log(`➕ Processing file added: ${event.relativePath}`);
            
            const analysis = await this.analyzeFileChange(event);
            
            const changeRecord = {
                id: event.id,
                type: 'file_added',
                filePath: event.filePath,
                relativePath: event.relativePath,
                timestamp: event.timestamp,
                fileExtension: event.fileExtension,
                fileName: event.fileName,
                size: event.size,
                content: event.content,
                analysis: analysis
            };
            
            await this.storeChange(changeRecord);
            
            if (this.options.enableRealTimeUpdates) {
                this.emit('file-added-detected', changeRecord);
            }
            
            this.stats.filesProcessed++;
            
        } catch (error) {
            console.error('❌ Error handling file added:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * Handle file deleted
     */
    async handleFileDeleted(event) {
        try {
            console.log(`Processing file deleted: ${event.relativePath}`);
            
            const changeRecord = {
                id: event.id,
                type: 'file_deleted',
                filePath: event.filePath,
                relativePath: event.relativePath,
                timestamp: event.timestamp,
                fileExtension: event.fileExtension,
                fileName: event.fileName,
                analysis: { type: 'file_deleted' }
            };
            
            await this.storeChange(changeRecord);
            
            if (this.options.enableRealTimeUpdates) {
                this.emit('file-deleted-detected', changeRecord);
            }
            
        } catch (error) {
            console.error('❌ Error handling file deleted:', error);
            this.stats.errors++;
        }
    }
    
    /**
     * Analyze file change
     */
    async analyzeFileChange(event) {
        const analysis = {
            type: 'unknown',
            language: this.detectLanguage(event.fileExtension),
            complexity: 0,
            lines: 0,
            hasImports: false,
            hasFunctions: false,
            hasClasses: false,
            isNotebook: false
        };
        
        if (event.content) {
            const lines = event.content.split('\n');
            analysis.lines = lines.length;
            
            // Detect file type and patterns
            if (event.fileExtension === '.ipynb') {
                analysis.isNotebook = true;
                analysis.type = 'notebook';
            } else if (['.py', '.js', '.ts', '.jsx', '.tsx'].includes(event.fileExtension)) {
                analysis.type = 'code';
                analysis.hasImports = /^(import|from|require|include)/m.test(event.content);
                analysis.hasFunctions = /(def\s+\w+|function\s+\w+|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\()/m.test(event.content);
                analysis.hasClasses = /(class\s+\w+)/m.test(event.content);
                
                // Calculate complexity (simple heuristic)
                analysis.complexity = this.calculateComplexity(event.content);
            } else if (['.md', '.txt'].includes(event.fileExtension)) {
                analysis.type = 'documentation';
            } else if (['.json', '.yaml', '.yml'].includes(event.fileExtension)) {
                analysis.type = 'configuration';
            }
        }
        
        return analysis;
    }
    
    /**
     * Detect programming language
     */
    detectLanguage(extension) {
        const languageMap = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.go': 'go',
            '.rs': 'rust',
            '.php': 'php',
            '.rb': 'ruby',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'bash',
            '.fish': 'bash',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.xml': 'xml',
            '.md': 'markdown',
            '.txt': 'text',
            '.csv': 'csv',
            '.ipynb': 'jupyter'
        };
        
        return languageMap[extension.toLowerCase()] || 'unknown';
    }
    
    /**
     * Calculate code complexity
     */
    calculateComplexity(content) {
        let complexity = 0;
        
        // Count functions
        const functions = (content.match(/(def\s+\w+|function\s+\w+|const\s+\w+\s*=\s*\(|let\s+\w+\s*=\s*\()/g) || []).length;
        complexity += functions * 2;
        
        // Count classes
        const classes = (content.match(/class\s+\w+/g) || []).length;
        complexity += classes * 3;
        
        // Count loops
        const loops = (content.match(/(for\s+|while\s+|foreach\s+)/g) || []).length;
        complexity += loops * 2;
        
        // Count conditionals
        const conditionals = (content.match(/(if\s+|elif\s+|else\s+|switch\s+|case\s+)/g) || []).length;
        complexity += conditionals * 1;
        
        // Count try-catch blocks
        const tryCatch = (content.match(/(try\s*\{|catch\s*\(|except\s+)/g) || []).length;
        complexity += tryCatch * 2;
        
        return Math.min(complexity, 100); // Cap at 100
    }
    
    /**
     * Store change record
     */
    async storeChange(changeRecord) {
        // In a real implementation, this would store to a database
        // For now, we'll just emit the event
        this.emit('change-stored', changeRecord);
    }
    
    /**
     * Get recent file changes
     */
    getRecentFileChanges() {
        // In a real implementation, this would query the database
        // For now, return empty array
        return [];
    }
    
    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        this.updateInterval = setInterval(() => {
            this.emit('periodic-update', this.getStats());
        }, this.options.updateInterval);
    }
    
    /**
     * Stop periodic updates
     */
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    /**
     * Handle errors
     */
    handleError(error) {
        console.error('❌ Monitoring service error:', error);
        this.stats.errors++;
        this.emit('error', error);
    }
    
    /**
     * Get current statistics
     */
    getStats() {
        const fileWatcherStats = this.fileWatcher ? this.fileWatcher.getStats() : {};
        
        return {
            ...this.stats,
            ...fileWatcherStats,
            uptime: Date.now() - this.stats.startTime,
            isRunning: this.isRunning,
            options: this.options
        };
    }
    
    /**
     * Get monitoring status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            uptime: Date.now() - this.stats.startTime,
            stats: this.getStats(),
            watchPaths: this.options.watchPaths,
            lastUpdate: new Date().toISOString()
        };
    }
}

module.exports = EnhancedMonitoringService;
