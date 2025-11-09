/**
 * Context-Aware Monitor
 * Links file changes to prompts and conversations at the point of context addition
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class ContextAwareMonitor extends EventEmitter {
    constructor() {
        super();
        this.isActive = false;
        this.fileContexts = new Map(); // Track file-prompt relationships
        this.activePrompts = new Map(); // Track active prompts/conversations
        this.contextHistory = [];
        this.monitorInterval = null;
        
        console.log('Context-Aware Monitor initialized');
    }

    async start() {
        if (this.isActive) return;
        
        this.isActive = true;
        console.log('Starting Context-Aware Monitor...');
        
        // Monitor for context additions
        this.monitorInterval = setInterval(() => {
            this.detectContextAdditions();
        }, 2000); // Check every 2 seconds
        
        this.emit('monitor-started');
    }

    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        console.log('Context-Aware Monitor stopped');
        this.emit('monitor-stopped');
    }

    detectContextAdditions() {
        // Monitor for active prompts/conversations
        this.detectActivePrompts();
        
        // Monitor for file changes with context
        this.detectFileChangesWithContext();
        
        // Link prompts to file changes
        this.linkPromptsToFileChanges();
    }

    detectActivePrompts() {
        // Check for active Cursor conversations
        this.checkCursorConversations();
        
        // Check for clipboard content that might be prompts
        this.checkClipboardForPrompts();
        
        // Check for recent file edits that might indicate active work
        this.checkRecentFileEdits();
    }

    checkCursorConversations() {
        try {
            // Check if Cursor is running and has active conversations
            const { exec } = require('child_process');
            
            exec('ps aux | grep -i cursor | grep -v grep', (error, stdout) => {
                if (!error && stdout.trim()) {
                    // Cursor is running, check for conversation context
                    this.emit('cursor-active', {
                        timestamp: Date.now(),
                        context: 'cursor_running'
                    });
                }
            });
        } catch (error) {
            // Cursor not available
        }
    }

    checkClipboardForPrompts() {
        try {
            const clipboard = require('clipboardy');
            const content = clipboard.readSync();
            
            if (this.isPromptContent(content)) {
                const promptId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                this.activePrompts.set(promptId, {
                    id: promptId,
                    content: content,
                    source: 'clipboard',
                    timestamp: Date.now(),
                    context: 'active_prompt'
                });
                
                this.emit('prompt-detected', {
                    id: promptId,
                    content: content,
                    source: 'clipboard',
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            // Clipboard access failed
        }
    }

    isPromptContent(content) {
        if (!content || content.length < 10) return false;
        
        const promptIndicators = [
            'change the categories', 'update the', 'modify the', 'fix the',
            'add to', 'remove from', 'create a', 'implement', 'write code',
            'categories', 'D, E, F', 'A, B, C', 'notebook', 'jupyter'
        ];
        
        const contentLower = content.toLowerCase();
        return promptIndicators.some(indicator => contentLower.includes(indicator));
    }

    checkRecentFileEdits() {
        // Check for recently modified files that might indicate active work
        const watchPaths = [
            path.join(process.env.HOME || '', 'Desktop'),
            path.join(process.env.HOME || '', 'Documents')
        ];
        
        for (const watchPath of watchPaths) {
            this.scanForRecentEdits(watchPath);
        }
    }

    scanForRecentEdits(dirPath) {
        try {
            const files = fs.readdirSync(dirPath);
            const now = Date.now();
            const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes ago
            
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime.getTime() > fiveMinutesAgo) {
                    this.emit('recent-file-edit', {
                        filePath: filePath,
                        lastModified: stats.mtime,
                        context: 'recent_edit'
                    });
                }
            }
        } catch (error) {
            // Directory access failed
        }
    }

    detectFileChangesWithContext() {
        // Monitor for file changes that happen in the context of active prompts
        this.fileContexts.forEach((context, filePath) => {
            if (this.isFileRecentlyModified(filePath)) {
                this.emit('file-change-with-context', {
                    filePath: filePath,
                    context: context,
                    timestamp: Date.now()
                });
            }
        });
    }

    isFileRecentlyModified(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const now = Date.now();
            const oneMinuteAgo = now - (60 * 1000); // 1 minute ago
            
            return stats.mtime.getTime() > oneMinuteAgo;
        } catch (error) {
            return false;
        }
    }

    linkPromptsToFileChanges() {
        // Link active prompts to file changes
        this.activePrompts.forEach((prompt, promptId) => {
            this.fileContexts.forEach((context, filePath) => {
                if (this.shouldLinkPromptToFile(prompt, filePath)) {
                    const link = {
                        promptId: promptId,
                        filePath: filePath,
                        prompt: prompt,
                        context: context,
                        timestamp: Date.now(),
                        linkType: 'context_addition'
                    };
                    
                    this.contextHistory.push(link);
                    
                    this.emit('prompt-file-linked', link);
                    
                    console.log(` Linked prompt to file: ${path.basename(filePath)}`);
                }
            });
        });
    }

    shouldLinkPromptToFile(prompt, filePath) {
        // Check if prompt content relates to the file
        const fileName = path.basename(filePath).toLowerCase();
        const promptContent = prompt.content.toLowerCase();
        
        // Check for direct file references
        if (promptContent.includes(fileName)) {
            return true;
        }
        
        // Check for content that might relate to the file
        const contentKeywords = ['notebook', 'jupyter', 'categories', 'data', 'test'];
        const fileKeywords = ['notebook', 'ipynb', 'test', 'data'];
        
        const hasContentKeyword = contentKeywords.some(keyword => 
            promptContent.includes(keyword)
        );
        const hasFileKeyword = fileKeywords.some(keyword => 
            fileName.includes(keyword)
        );
        
        return hasContentKeyword && hasFileKeyword;
    }

    // Method to manually add context when a file is being worked on
    addContext(filePath, prompt, contextType = 'manual') {
        const contextId = `context_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const context = {
            id: contextId,
            filePath: filePath,
            prompt: prompt,
            contextType: contextType,
            timestamp: Date.now()
        };
        
        this.fileContexts.set(filePath, context);
        
        this.emit('context-added', context);
        
        console.log(`Context added for ${path.basename(filePath)}: ${contextType}`);
        
        return contextId;
    }

    // Method to link a specific prompt to a file change
    linkPromptToFileChange(promptId, filePath, changeType = 'modification') {
        const link = {
            promptId: promptId,
            filePath: filePath,
            changeType: changeType,
            timestamp: Date.now(),
            linkType: 'explicit_link'
        };
        
        this.contextHistory.push(link);
        
        this.emit('explicit-prompt-file-link', link);
        
        console.log(` Explicit link created: ${promptId} -> ${path.basename(filePath)}`);
        
        return link;
    }

    // Get context history for a specific file
    getFileContext(filePath) {
        return this.fileContexts.get(filePath);
    }

    // Get all contexts
    getAllContexts() {
        return Array.from(this.fileContexts.values());
    }

    // Get context history
    getContextHistory() {
        return this.contextHistory;
    }

    // Get active prompts
    getActivePrompts() {
        return Array.from(this.activePrompts.values());
    }

    // Clear old contexts (cleanup)
    clearOldContexts(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const now = Date.now();
        const cutoff = now - maxAge;
        
        // Clear old file contexts
        for (const [filePath, context] of this.fileContexts) {
            if (context.timestamp < cutoff) {
                this.fileContexts.delete(filePath);
            }
        }
        
        // Clear old active prompts
        for (const [promptId, prompt] of this.activePrompts) {
            if (prompt.timestamp < cutoff) {
                this.activePrompts.delete(promptId);
            }
        }
        
        // Clear old context history
        this.contextHistory = this.contextHistory.filter(link => 
            link.timestamp > cutoff
        );
    }
}

module.exports = ContextAwareMonitor;
