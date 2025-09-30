/**
 * Enhanced Conversation Monitor
 * Monitors conversations from multiple sources including Cursor DB, file system, and live events
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const OptimizedFileStorage = require('./optimized-file-storage');

class EnhancedConversationMonitor extends EventEmitter {
    constructor() {
        super();
        this.isMonitoring = false;
        this.cursorDbPath = null;
        this.conversations = [];
        this.lastCheckTime = Date.now();
        this.monitorInterval = 300000; // 5 minutes instead of 60 seconds to reduce spam
        this.fileWatchers = new Map();
        this.cursorProcessMonitor = null;
        
        // Enhanced data collection
        this.conversationSources = {
            cursorDb: false,
            fileSystem: false,
            processMonitor: false,
            clipboard: false
        };
        
        // Initialize optimized storage
        this.storage = new OptimizedFileStorage({
            storageDir: path.join(process.cwd(), '.conversation-storage'),
            maxCacheSize: 500
        });
        
        console.log('Enhanced Conversation Monitor initialized');
    }

    async initialize() {
        console.log('Initializing Enhanced Conversation Monitor...');
        
        // Try multiple data sources
        await this.initializeCursorDatabase();
        await this.initializeFileSystemMonitoring();
        await this.initializeProcessMonitoring();
        await this.initializeClipboardMonitoring();
        
        console.log('✅ Enhanced Conversation Monitor initialized with sources:', this.conversationSources);
    }

    async initializeCursorDatabase() {
        try {
            const possiblePaths = [
                path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/workspaceStorage'),
                path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/globalStorage'),
                path.join(process.env.HOME || '', 'Library/Application Support/Cursor/logs'),
                path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/History'),
                path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/Local Storage'),
                path.join(process.env.HOME || '', 'Library/Application Support/Cursor')
            ];

            for (const basePath of possiblePaths) {
                if (fs.existsSync(basePath)) {
                    const dbFiles = this.findSQLiteFiles(basePath);
                    if (dbFiles.length > 0) {
                        this.cursorDbPath = dbFiles[0];
                        console.log(`✅ Found Cursor database: ${this.cursorDbPath}`);
                        this.conversationSources.cursorDb = true;
                        
                        // Try to read from database
                        await this.readFromCursorDatabase();
                        break;
                    }
                }
            }

            if (!this.cursorDbPath) {
                console.log('No Cursor database found - will use alternative sources');
            }
        } catch (error) {
            console.log('Cursor database initialization failed:', error.message);
        }
    }

    findSQLiteFiles(dir) {
        const files = [];
        
        const scanDir = (currentDir) => {
            try {
                const entries = fs.readdirSync(currentDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    
                    if (entry.isDirectory()) {
                        scanDir(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        const name = entry.name.toLowerCase();
                        if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3' || name.includes('.vscdb')) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };

        scanDir(dir);
        return files;
    }

    async readFromCursorDatabase() {
        if (!this.cursorDbPath) return;

        try {
            const Database = require('better-sqlite3');
            const db = new Database(this.cursorDbPath, { readonly: true });
            
            // Get all tables
            const tables = db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table'
            `).all();

            console.log('Available tables in Cursor database:', tables.map(t => t.name));

            // Try to extract data from various table structures
            for (const table of tables) {
                try {
                    const tableName = table.name;
                    const sampleData = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
                    
                    if (sampleData.length > 0) {
                        console.log(`Table ${tableName} sample data:`, sampleData[0]);
                        
                        // Look for conversation-like data
                        if (this.isConversationTable(tableName, sampleData[0])) {
                            const conversations = db.prepare(`SELECT * FROM ${tableName}`).all();
                            this.processConversationData(conversations, 'cursor_db');
                        }
                    }
                } catch (error) {
                    // Skip tables we can't read
                }
            }
            
            db.close();
        } catch (error) {
            console.log('Error reading from Cursor database:', error.message);
        }
    }

    isConversationTable(tableName, sampleRow) {
        const conversationIndicators = [
            'message', 'content', 'text', 'prompt', 'response', 'conversation',
            'chat', 'ai', 'assistant', 'user', 'query', 'answer'
        ];
        
        const tableNameLower = tableName.toLowerCase();
        const hasConversationName = conversationIndicators.some(indicator => 
            tableNameLower.includes(indicator)
        );
        
        if (hasConversationName) return true;
        
        // Check column names
        const columns = Object.keys(sampleRow);
        const hasConversationColumns = conversationIndicators.some(indicator =>
            columns.some(col => col.toLowerCase().includes(indicator))
        );
        
        return hasConversationColumns;
    }

    processConversationData(data, source) {
        console.log(`Processing ${data.length} conversations from ${source}`);
        
        for (const item of data) {
            const conversation = this.extractConversationFromData(item, source);
            if (conversation) {
                this.conversations.push(conversation);
                this.emit('conversation-detected', conversation);
            }
        }
    }

    extractConversationFromData(data, source) {
        try {
            // Try to extract conversation data from various formats
            const conversation = {
                id: data.id || data.key || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: data.timestamp || data.created_at || data.time || new Date().toISOString(),
                source: source,
                rawData: data
            };

            // Extract user message
            conversation.userMessage = data.user_message || data.userMessage || data.prompt || 
                                    data.query || data.question || data.input || 
                                    data.message || data.content || '';

            // Extract assistant response
            conversation.assistantResponse = data.assistant_response || data.assistantResponse || 
                                          data.response || data.answer || data.output || 
                                          data.reply || '';

            // Extract metadata
            conversation.metadata = {
                file: data.file || data.filePath || data.context || '',
                language: data.language || data.lang || '',
                intent: data.intent || '',
                confidence: data.confidence || 0,
                sessionId: data.sessionId || data.session_id || '',
                workspace: data.workspace || data.workspaceId || ''
            };

            return conversation;
        } catch (error) {
            console.log('Error extracting conversation:', error);
            return null;
        }
    }

    async initializeFileSystemMonitoring() {
        try {
            const cursorDir = path.join(process.env.HOME || '', 'Library/Application Support/Cursor');
            if (!fs.existsSync(cursorDir)) {
                console.log('Cursor directory not found for file monitoring');
                return;
            }

            // Monitor conversation files
            const conversationFiles = this.findConversationFiles(cursorDir);
            
            for (const file of conversationFiles) {
                this.monitorConversationFile(file);
            }

            this.conversationSources.fileSystem = true;
            console.log('✅ File system monitoring initialized');
        } catch (error) {
            console.log('File system monitoring initialization failed:', error.message);
        }
    }

    findConversationFiles(dir) {
        const files = [];
        
        const scanDir = (currentDir) => {
            try {
                const entries = fs.readdirSync(currentDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    
                    if (entry.isDirectory()) {
                        scanDir(fullPath);
                    } else if (entry.isFile()) {
                        const name = entry.name.toLowerCase();
                        if (name.includes('conversation') || name.includes('chat') || 
                            name.includes('ai') || name.endsWith('.json') || 
                            name.endsWith('.log')) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };

        scanDir(dir);
        return files;
    }

    monitorConversationFile(filePath) {
        try {
            const watcher = fs.watch(filePath, async (eventType) => {
                if (eventType === 'change') {
                    await this.readConversationFile(filePath);
                }
            });
            
            this.fileWatchers.set(filePath, watcher);
            
            // Read initial content
            this.readConversationFile(filePath);
        } catch (error) {
            console.log(`Error monitoring file ${filePath}:`, error.message);
        }
    }

    async readConversationFile(filePath) {
        try {
            // Skip if file is too large to prevent memory issues
            const stats = fs.statSync(filePath);
            if (stats.size > 1024 * 1024) { // Skip files larger than 1MB
                return;
            }
            
            // Use optimized storage for content retrieval
            const content = await this.storage.getFileContent(filePath);
            if (!content) {
                return;
            }
            
            // Only process if content contains relevant keywords
            if (!this.isRelevantContent(content)) {
                return;
            }
            
            // Try to parse as JSON
            try {
                const data = JSON.parse(content);
                if (Array.isArray(data)) {
                    this.processConversationData(data.slice(0, 10), 'file_system'); // Limit to 10 items
                } else if (typeof data === 'object') {
                    this.processConversationData([data], 'file_system');
                }
            } catch (jsonError) {
                // Try to parse as log format
                this.parseLogFormat(content, filePath);
            }
        } catch (error) {
            console.log(`Error reading conversation file ${filePath}:`, error.message);
        }
    }
    
    isRelevantContent(content) {
        const relevantKeywords = [
            'conversation', 'chat', 'prompt', 'response', 'ai', 'assistant',
            'categories', 'D', 'E', 'F', 'A', 'B', 'C', 'notebook', 'jupyter'
        ];
        
        const contentLower = content.toLowerCase();
        return relevantKeywords.some(keyword => contentLower.includes(keyword));
    }

    parseLogFormat(content, filePath) {
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.includes('conversation') || line.includes('chat') || 
                line.includes('prompt') || line.includes('response')) {
                
                const conversation = {
                    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    timestamp: new Date().toISOString(),
                    source: 'file_system',
                    content: line,
                    file: filePath
                };
                
                this.conversations.push(conversation);
                this.emit('conversation-detected', conversation);
            }
        }
    }

    async initializeProcessMonitoring() {
        try {
            // Monitor Cursor process for conversation data
            this.cursorProcessMonitor = setInterval(() => {
                this.checkCursorProcess();
            }, 60000); // Check every 60 seconds instead of 5 to reduce spam
            
            this.conversationSources.processMonitor = true;
            console.log('✅ Process monitoring initialized');
        } catch (error) {
            console.log('Process monitoring initialization failed:', error.message);
        }
    }

    checkCursorProcess() {
        try {
            const { exec } = require('child_process');
            
            // Check if Cursor is running
            exec('ps aux | grep -i cursor | grep -v grep', (error, stdout) => {
                if (!error && stdout.trim()) {
                    // Cursor is running, try to extract conversation data
                    this.extractFromCursorProcess();
                }
            });
        } catch (error) {
            // Process monitoring failed
        }
    }

    extractFromCursorProcess() {
        // This would require more sophisticated process monitoring
        // For now, we'll emit a heartbeat event
        this.emit('cursor-process-active', {
            timestamp: new Date().toISOString(),
            source: 'process_monitor'
        });
    }

    async initializeClipboardMonitoring() {
        try {
            // Monitor clipboard for conversation snippets
            const clipboard = require('clipboardy');
            
            let lastClipboard = '';
            
            setInterval(() => {
                try {
                    const currentClipboard = clipboard.readSync();
                    
                    if (currentClipboard !== lastClipboard && 
                        this.isConversationContent(currentClipboard)) {
                        
                        const conversation = {
                            id: `clipboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            timestamp: new Date().toISOString(),
                            source: 'clipboard',
                            content: currentClipboard
                        };
                        
                        this.conversations.push(conversation);
                        this.emit('conversation-detected', conversation);
                        
                        lastClipboard = currentClipboard;
                    }
                } catch (error) {
                    // Clipboard access failed
                }
            }, 10000); // Check every 10 seconds instead of 2 to reduce spam
            
            this.conversationSources.clipboard = true;
            console.log('✅ Clipboard monitoring initialized');
        } catch (error) {
            console.log('Clipboard monitoring initialization failed:', error.message);
        }
    }

    isConversationContent(content) {
        if (!content || content.length < 10) return false;
        
        const conversationIndicators = [
            'prompt:', 'response:', 'user:', 'assistant:', 'ai:', 'chat:',
            'question:', 'answer:', 'help me', 'can you', 'how do i',
            'explain', 'write code', 'debug', 'fix error'
        ];
        
        const contentLower = content.toLowerCase();
        return conversationIndicators.some(indicator => contentLower.includes(indicator));
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        console.log('Starting enhanced conversation monitoring...');
        
        // Start periodic checks with longer interval to reduce memory usage
        this.monitorInterval = setInterval(() => {
            this.performPeriodicCheck();
        }, 300000); // Check every 5 minutes instead of 30 seconds to reduce spam
        
        this.emit('monitoring-started');
    }

    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        // Stop file watchers
        for (const [filePath, watcher] of this.fileWatchers) {
            watcher.close();
        }
        this.fileWatchers.clear();
        
        // Stop process monitoring
        if (this.cursorProcessMonitor) {
            clearInterval(this.cursorProcessMonitor);
            this.cursorProcessMonitor = null;
        }
        
        console.log('Enhanced conversation monitoring stopped');
        this.emit('monitoring-stopped');
    }

    performPeriodicCheck() {
        // Check for new conversations from all sources
        this.emit('periodic-check', {
            timestamp: new Date().toISOString(),
            conversationCount: this.conversations.length,
            sources: this.conversationSources
        });
    }

    getConversations() {
        return this.conversations;
    }
    
    getStorageStats() {
        return this.storage.getStats();
    }
    
    async optimizeStorage() {
        return await this.storage.optimize();
    }

    getConversationStats() {
        return {
            totalConversations: this.conversations.length,
            sources: this.conversationSources,
            lastCheck: this.lastCheckTime,
            isMonitoring: this.isMonitoring
        };
    }
}

module.exports = EnhancedConversationMonitor;
