/**
 * Enhanced Context Restoration Service
 * Provides comprehensive context restoration with multiple strategies and fallbacks
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class EnhancedContextRestoration {
    constructor() {
        this.restorationStrategies = [
            'applescript',
            'cursor_api',
            'file_system',
            'workspace_state',
            'git_state'
        ];
        this.contextCache = new Map();
        this.restorationHistory = [];
    }

    /**
     * Main context restoration method with multiple fallback strategies
     */
    async restoreContext(sessionId, options = {}) {
        const {
            preferredStrategy = 'auto',
            includeWorkspaceState = true,
            includeGitState = true,
            validateRestoration = true,
            timeout = 30000
        } = options;

        console.log(`Starting context restoration for session: ${sessionId}`);

        try {
            // Get session data
            const session = await this.getSessionData(sessionId);
            if (!session) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Build comprehensive context
            const context = await this.buildContext(session, {
                includeWorkspaceState,
                includeGitState
            });

            // Try restoration strategies in order of preference
            const strategies = this.getStrategyOrder(preferredStrategy);
            let lastError = null;

            for (const strategy of strategies) {
                try {
                    console.log(`Attempting restoration with strategy: ${strategy}`);
                    const result = await this.executeStrategy(strategy, context, timeout);
                    
                    if (result.success) {
                        await this.recordRestorationSuccess(sessionId, strategy, result);
                        
                        if (validateRestoration) {
                            const validation = await this.validateRestoration(context, result);
                            if (validation.success) {
                                return {
                                    success: true,
                                    strategy: strategy,
                                    context: context,
                                    result: result,
                                    validation: validation
                                };
                            } else {
                                console.warn(`Restoration validation failed for strategy ${strategy}:`, validation.error);
                                lastError = new Error(`Validation failed: ${validation.error}`);
                            }
                        } else {
                            return {
                                success: true,
                                strategy: strategy,
                                context: context,
                                result: result
                            };
                        }
                    }
                } catch (error) {
                    console.warn(`Strategy ${strategy} failed:`, error.message);
                    lastError = error;
                }
            }

            throw lastError || new Error('All restoration strategies failed');

        } catch (error) {
            console.error('Context restoration failed:', error);
            await this.recordRestorationFailure(sessionId, error);
            return {
                success: false,
                error: error.message,
                strategies: strategies,
                lastError: lastError?.message
            };
        }
    }

    /**
     * Build comprehensive context from session data
     */
    async buildContext(session, options = {}) {
        const context = {
            // Basic session info
            sessionId: session.id,
            timestamp: session.timestamp,
            intent: session.intent,
            
            // File context
            currentFile: session.currentFile,
            cursorPosition: session.cursorPosition,
            selectedText: session.selectedText,
            
            // Code context
            codeDeltas: session.codeDeltas || [],
            fileChanges: session.fileChanges || [],
            
            // Workspace context
            workspacePath: session.workspacePath,
            projectRoot: null,
            
            // Additional context
            linkedEvents: session.linkedEvents || [],
            conversations: session.conversations || [],
            
            // Restoration metadata
            restorationTimestamp: new Date().toISOString(),
            contextVersion: '2.0'
        };

        // Add workspace state if requested
        if (options.includeWorkspaceState && session.currentFile) {
            context.workspaceState = await this.getWorkspaceState(session.currentFile);
        }

        // Add git state if requested
        if (options.includeGitState && session.currentFile) {
            context.gitState = await this.getGitState(session.currentFile);
        }

        // Determine project root
        context.projectRoot = this.determineProjectRoot(session.currentFile);

        return context;
    }

    /**
     * Get workspace state information
     */
    async getWorkspaceState(filePath) {
        try {
            const workspacePath = this.determineProjectRoot(filePath);
            if (!workspacePath) return null;

            const state = {
                workspacePath: workspacePath,
                openFiles: [],
                recentFiles: [],
                workspaceSettings: null
            };

            // Try to get Cursor workspace state
            try {
                const cursorStatePath = path.join(workspacePath, '.cursor');
                if (await this.pathExists(cursorStatePath)) {
                    const stateFiles = await fs.readdir(cursorStatePath);
                    state.cursorStateFiles = stateFiles;
                }
            } catch (error) {
                console.warn('Could not read Cursor workspace state:', error.message);
            }

            // Try to get VS Code workspace state as fallback
            try {
                const vscodeStatePath = path.join(workspacePath, '.vscode');
                if (await this.pathExists(vscodeStatePath)) {
                    const settingsPath = path.join(vscodeStatePath, 'settings.json');
                    if (await this.pathExists(settingsPath)) {
                        const settings = await fs.readFile(settingsPath, 'utf8');
                        state.workspaceSettings = JSON.parse(settings);
                    }
                }
            } catch (error) {
                console.warn('Could not read VS Code workspace state:', error.message);
            }

            return state;
        } catch (error) {
            console.warn('Failed to get workspace state:', error.message);
            return null;
        }
    }

    /**
     * Get git state information
     */
    async getGitState(filePath) {
        try {
            const projectRoot = this.determineProjectRoot(filePath);
            if (!projectRoot) return null;

            const gitState = {
                repositoryPath: projectRoot,
                currentBranch: null,
                lastCommit: null,
                uncommittedChanges: [],
                stashEntries: []
            };

            // Get current branch
            try {
                const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: projectRoot });
                gitState.currentBranch = branch.trim();
            } catch (error) {
                console.warn('Could not get git branch:', error.message);
            }

            // Get last commit
            try {
                const { stdout: commit } = await execAsync('git log -1 --pretty=format:"%H|%s|%an|%ad"', { cwd: projectRoot });
                const [hash, message, author, date] = commit.split('|');
                gitState.lastCommit = { hash, message, author, date };
            } catch (error) {
                console.warn('Could not get last commit:', error.message);
            }

            // Get uncommitted changes
            try {
                const { stdout: status } = await execAsync('git status --porcelain', { cwd: projectRoot });
                gitState.uncommittedChanges = status.trim().split('\n').filter(line => line.length > 0);
            } catch (error) {
                console.warn('Could not get git status:', error.message);
            }

            return gitState;
        } catch (error) {
            console.warn('Failed to get git state:', error.message);
            return null;
        }
    }

    /**
     * Execute restoration strategy
     */
    async executeStrategy(strategy, context, timeout) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Strategy execution timeout')), timeout);
        });

        const strategyPromise = this[`execute${strategy.charAt(0).toUpperCase() + strategy.slice(1)}Strategy`](context);
        
        return Promise.race([strategyPromise, timeoutPromise]);
    }

    /**
     * AppleScript restoration strategy
     */
    async executeApplescriptStrategy(context) {
        try {
            if (!context.currentFile) {
                throw new Error('No file to restore');
            }

            // Open file in Cursor
            const openScript = `tell application "Cursor" to open POSIX file "${context.currentFile}"`;
            await this.executeAppleScript(openScript);
            
            // Wait for file to open
            await this.delay(1000);
            
            // Restore cursor position
            if (context.cursorPosition) {
                await this.restoreCursorPosition(context.cursorPosition);
            }
            
            // Restore selected text
            if (context.selectedText) {
                await this.restoreSelectedText(context.selectedText);
            }

            return {
                success: true,
                method: 'AppleScript',
                restoredFile: context.currentFile,
                restoredPosition: context.cursorPosition
            };
        } catch (error) {
            throw new Error(`AppleScript strategy failed: ${error.message}`);
        }
    }

    /**
     * Cursor API restoration strategy
     */
    async executeCursor_apiStrategy(context) {
        try {
            // This would use Cursor's extension API if available
            // For now, fall back to AppleScript
            console.log('Cursor API strategy not yet implemented, falling back to AppleScript');
            return await this.executeApplescriptStrategy(context);
        } catch (error) {
            throw new Error(`Cursor API strategy failed: ${error.message}`);
        }
    }

    /**
     * File system restoration strategy
     */
    async executeFile_systemStrategy(context) {
        try {
            if (!context.currentFile || !await this.pathExists(context.currentFile)) {
                throw new Error('File does not exist');
            }

            // Create a temporary script to open the file
            const scriptPath = path.join(process.env.TMPDIR || '/tmp', `restore_context_${Date.now()}.sh`);
            const script = `#!/bin/bash
open -a "Cursor" "${context.currentFile}"
`;

            await fs.writeFile(scriptPath, script);
            await fs.chmod(scriptPath, '755');
            
            // Execute the script
            await execAsync(`"${scriptPath}"`);
            
            // Clean up
            await fs.unlink(scriptPath);

            return {
                success: true,
                method: 'File System',
                restoredFile: context.currentFile
            };
        } catch (error) {
            throw new Error(`File system strategy failed: ${error.message}`);
        }
    }

    /**
     * Workspace state restoration strategy
     */
    async executeWorkspace_stateStrategy(context) {
        try {
            if (!context.workspaceState) {
                throw new Error('No workspace state available');
            }

            // Try to restore workspace state
            const workspacePath = context.workspaceState.workspacePath;
            
            // Open workspace in Cursor
            const openScript = `tell application "Cursor" to open POSIX file "${workspacePath}"`;
            await this.executeAppleScript(openScript);
            
            // Wait for workspace to open
            await this.delay(2000);
            
            // Open the specific file
            if (context.currentFile) {
                const openFileScript = `tell application "Cursor" to open POSIX file "${context.currentFile}"`;
                await this.executeAppleScript(openFileScript);
                await this.delay(1000);
            }

            return {
                success: true,
                method: 'Workspace State',
                restoredWorkspace: workspacePath,
                restoredFile: context.currentFile
            };
        } catch (error) {
            throw new Error(`Workspace state strategy failed: ${error.message}`);
        }
    }

    /**
     * Git state restoration strategy
     */
    async executeGit_stateStrategy(context) {
        try {
            if (!context.gitState) {
                throw new Error('No git state available');
            }

            const gitState = context.gitState;
            
            // Check if we need to switch branches or restore stash
            if (gitState.currentBranch) {
                // This is a simplified approach - in practice, you'd want to be more careful
                console.log(`Current git branch: ${gitState.currentBranch}`);
            }

            // Open the file (this strategy focuses on git context)
            if (context.currentFile) {
                const openScript = `tell application "Cursor" to open POSIX file "${context.currentFile}"`;
                await this.executeAppleScript(openScript);
                await this.delay(1000);
            }

            return {
                success: true,
                method: 'Git State',
                restoredFile: context.currentFile,
                gitBranch: gitState.currentBranch
            };
        } catch (error) {
            throw new Error(`Git state strategy failed: ${error.message}`);
        }
    }

    /**
     * Validate restoration success
     */
    async validateRestoration(context, result) {
        try {
            // Check if file is open in Cursor
            const isFileOpen = await this.isFileOpenInCursor(context.currentFile);
            
            if (!isFileOpen) {
                return {
                    success: false,
                    error: 'File is not open in Cursor'
                };
            }

            // Additional validation could include:
            // - Checking cursor position
            // - Verifying selected text
            // - Confirming workspace state

            return {
                success: true,
                validated: true,
                fileOpen: isFileOpen
            };
        } catch (error) {
            return {
                success: false,
                error: `Validation failed: ${error.message}`
            };
        }
    }

    /**
     * Helper methods
     */
    async getSessionData(sessionId) {
        // This would integrate with your existing session storage
        // For now, return a mock session
        return {
            id: sessionId,
            currentFile: '/path/to/file.js',
            cursorPosition: { line: 10, character: 5 },
            selectedText: 'some selected text',
            timestamp: new Date().toISOString(),
            intent: 'debug',
            workspacePath: '/path/to/workspace'
        };
    }

    getStrategyOrder(preferredStrategy) {
        if (preferredStrategy === 'auto') {
            return this.restorationStrategies;
        }
        
        const preferredIndex = this.restorationStrategies.indexOf(preferredStrategy);
        if (preferredIndex === -1) {
            return this.restorationStrategies;
        }
        
        const strategies = [...this.restorationStrategies];
        const preferred = strategies.splice(preferredIndex, 1)[0];
        return [preferred, ...strategies];
    }

    async executeAppleScript(script) {
        return new Promise((resolve, reject) => {
            exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async restoreCursorPosition(position) {
        if (!position) return;
        
        const script = `
            tell application "Cursor"
                activate
                tell application "System Events"
                    key code 36 -- Enter key
                    delay 0.5
                    repeat ${position.line || 1} times
                        key code 125 -- Down arrow
                    end repeat
                    repeat ${position.character || 0} times
                        key code 124 -- Right arrow
                    end repeat
                end tell
            end tell
        `;
        
        await this.executeAppleScript(script);
    }

    async restoreSelectedText(selectedText) {
        if (!selectedText) return;
        
        // This is a simplified approach - in practice, you'd want to be more sophisticated
        const script = `
            tell application "Cursor"
                activate
                tell application "System Events"
                    set the clipboard to "${selectedText}"
                    key code 9 using command down -- Cmd+V
                end tell
            end tell
        `;
        
        await this.executeAppleScript(script);
    }

    async isFileOpenInCursor(filePath) {
        try {
            const script = `
                tell application "Cursor"
                    set openFiles to {}
                    repeat with doc in documents
                        set end of openFiles to path of doc
                    end repeat
                    return openFiles
                end tell
            `;
            
            const result = await this.executeAppleScript(script);
            return result.includes(filePath);
        } catch (error) {
            console.warn('Could not check if file is open:', error.message);
            return false;
        }
    }

    determineProjectRoot(filePath) {
        if (!filePath) return null;
        
        const pathParts = filePath.split('/');
        for (let i = pathParts.length - 1; i >= 0; i--) {
            const testPath = pathParts.slice(0, i + 1).join('/');
            if (this.pathExists(path.join(testPath, 'package.json')) ||
                this.pathExists(path.join(testPath, '.git')) ||
                this.pathExists(path.join(testPath, 'pyproject.toml'))) {
                return testPath;
            }
        }
        
        return path.dirname(filePath);
    }

    async pathExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async recordRestorationSuccess(sessionId, strategy, result) {
        this.restorationHistory.push({
            sessionId,
            strategy,
            result,
            timestamp: new Date().toISOString(),
            success: true
        });
    }

    async recordRestorationFailure(sessionId, error) {
        this.restorationHistory.push({
            sessionId,
            error: error.message,
            timestamp: new Date().toISOString(),
            success: false
        });
    }

    /**
     * Get restoration history for analytics
     */
    getRestorationHistory() {
        return this.restorationHistory;
    }

    /**
     * Clear restoration history
     */
    clearRestorationHistory() {
        this.restorationHistory = [];
    }
}

module.exports = EnhancedContextRestoration;
