/**
 * Live Conversation Monitor
 * Monitors conversations from multiple sources including Cursor DB and live chat
 */

const fs = require('fs');
const path = require('path');

class LiveConversationMonitor {
    constructor() {
        this.isMonitoring = false;
        this.cursorDbPath = null;
        this.conversations = [];
        this.lastCheckTime = Date.now();
        this.monitorInterval = null;
        
        this.findCursorDatabase();
        console.log('Live Conversation Monitor initialized');
    }

    findCursorDatabase() {
        const possiblePaths = [
            // Standard Cursor database locations
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
                    console.log(`Found Cursor database: ${this.cursorDbPath}`);
                    break;
                }
            }
        }

        if (!this.cursorDbPath) {
            console.log('No Cursor database found - will monitor other sources');
        }
    }

    findSQLiteFiles(dir) {
        const files = [];
        const scanDir = (currentDir) => {
            try {
                const items = fs.readdirSync(currentDir);
                for (const item of items) {
                    const fullPath = path.join(currentDir, item);
                    const stat = fs.statSync(fullPath);
                    
                    if (stat.isDirectory()) {
                        // Skip certain directories to avoid infinite loops
                        if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
                            scanDir(fullPath);
                        }
                    } else if (item.endsWith('.db') || item.endsWith('.sqlite') || item.endsWith('.sqlite3')) {
                        files.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        };
        
        scanDir(dir);
        return files;
    }

    startMonitoring() {
        if (this.isMonitoring) {
            console.log('Live conversation monitoring already active');
            return;
        }

        this.isMonitoring = true;
        console.log('Starting live conversation monitoring...');

        // Monitor Cursor database every 10 seconds
        this.monitorInterval = setInterval(() => {
            this.checkCursorDatabase();
            this.checkFileSystemChanges();
        }, 10000);

        console.log('✅ Live conversation monitoring started');
    }

    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        console.log(' Live conversation monitoring stopped');
    }

    async checkCursorDatabase() {
        if (!this.cursorDbPath) {
            return;
        }

        try {
            // Try to read the database file
            const stats = fs.statSync(this.cursorDbPath);
            const lastModified = stats.mtime.getTime();
            
            if (lastModified > this.lastCheckTime) {
                console.log(`Cursor database updated: ${this.cursorDbPath}`);
                await this.parseCursorDatabase();
                this.lastCheckTime = lastModified;
            }
        } catch (error) {
            // Database might be locked by Cursor
            console.log(`Could not access Cursor database: ${error.message}`);
        }
    }

    async parseCursorDatabase() {
        try {
            // Simple database parsing without better-sqlite3 dependency
            // This is a fallback approach that reads the file directly
            const dbBuffer = fs.readFileSync(this.cursorDbPath);
            
            // Look for conversation patterns in the database
            const dbContent = dbBuffer.toString('utf8', 0, Math.min(dbBuffer.length, 10000));
            
            // Extract potential conversation data
            const conversations = this.extractConversationsFromDB(dbContent);
            
            if (conversations.length > 0) {
                console.log(`Found ${conversations.length} conversations in Cursor database`);
                this.conversations.push(...conversations);
            }
        } catch (error) {
            console.log(`Error parsing Cursor database: ${error.message}`);
        }
    }

    extractConversationsFromDB(dbContent) {
        const conversations = [];
        
        // Look for common conversation patterns in the database content
        const patterns = [
            /"content":\s*"([^"]+)"/g,
            /"message":\s*"([^"]+)"/g,
            /"text":\s*"([^"]+)"/g,
            /"prompt":\s*"([^"]+)"/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(dbContent)) !== null) {
                const content = match[1];
                if (content && content.length > 10 && content.length < 1000) {
                    conversations.push({
                        id: `cursor-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        timestamp: new Date().toISOString(),
                        role: 'user',
                        content: content,
                        source: 'cursor_database',
                        metadata: {
                            source: 'cursor_database',
                            captureType: 'database_scan',
                            dbPath: this.cursorDbPath
                        }
                    });
                }
            }
        }

        return conversations;
    }

    checkFileSystemChanges() {
        // Monitor for new conversation files
        const conversationPaths = [
            path.join(process.env.HOME || '', 'Library/Application Support/Cursor/User/globalStorage'),
            path.join(process.env.HOME || '', 'Library/Application Support/Cursor/logs')
        ];

        for (const basePath of conversationPaths) {
            if (fs.existsSync(basePath)) {
                this.scanForConversationFiles(basePath);
            }
        }
    }

    scanForConversationFiles(dir) {
        try {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                if (item.includes('conversation') || item.includes('chat') || item.includes('history')) {
                    const filePath = path.join(dir, item);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime.getTime() > this.lastCheckTime) {
                        console.log(`Found updated conversation file: ${filePath}`);
                        this.parseConversationFile(filePath);
                    }
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
    }

    parseConversationFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const conversations = this.extractConversationsFromFile(content, filePath);
            
            if (conversations.length > 0) {
                console.log(`Extracted ${conversations.length} conversations from ${filePath}`);
                this.conversations.push(...conversations);
            }
        } catch (error) {
            console.log(`Error parsing conversation file ${filePath}: ${error.message}`);
        }
    }

    extractConversationsFromFile(content, filePath) {
        const conversations = [];
        
        try {
            // Try to parse as JSON
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                data.forEach((item, index) => {
                    if (item.content || item.message || item.text) {
                        conversations.push({
                            id: `file-${Date.now()}-${index}`,
                            timestamp: new Date().toISOString(),
                            role: 'user',
                            content: item.content || item.message || item.text,
                            source: 'conversation_file',
                            metadata: {
                                source: 'conversation_file',
                                captureType: 'file_scan',
                                filePath: filePath,
                                originalData: item
                            }
                        });
                    }
                });
            }
        } catch (error) {
            // Not JSON, try text parsing
            const lines = content.split('\n');
            lines.forEach((line, index) => {
                if (line.trim().length > 10 && line.trim().length < 500) {
                    conversations.push({
                        id: `file-text-${Date.now()}-${index}`,
                        timestamp: new Date().toISOString(),
                        role: 'user',
                        content: line.trim(),
                        source: 'conversation_file',
                        metadata: {
                            source: 'conversation_file',
                            captureType: 'text_scan',
                            filePath: filePath
                        }
                    });
                }
            });
        }

        return conversations;
    }

    getAllConversations() {
        return this.conversations;
    }

    getRecentConversations(limit = 10) {
        return this.conversations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    getStats() {
        return {
            totalConversations: this.conversations.length,
            isMonitoring: this.isMonitoring,
            cursorDbPath: this.cursorDbPath,
            lastCheckTime: this.lastCheckTime,
            sources: [...new Set(this.conversations.map(c => c.source))]
        };
    }

    clearConversations() {
        this.conversations = [];
        console.log('Conversations cleared');
    }
}

module.exports = { LiveConversationMonitor };
