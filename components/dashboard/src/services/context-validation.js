/**
 * Context Validation Service
 * Provides comprehensive validation and fallback mechanisms for context restoration
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ContextValidation {
    constructor(options = {}) {
        this.validationRules = new Map();
        this.fallbackStrategies = new Map();
        this.validationHistory = [];
        this.maxHistorySize = options.maxHistorySize || 1000;
        
        this.initializeValidationRules();
        this.initializeFallbackStrategies();
    }

    /**
     * Initialize validation rules
     */
    initializeValidationRules() {
        // File existence validation
        this.validationRules.set('file_exists', {
            name: 'File Exists',
            validate: async (context) => {
                if (!context.currentFile) {
                    return { valid: false, error: 'No file specified' };
                }
                
                try {
                    await fs.access(context.currentFile);
                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: `File does not exist: ${context.currentFile}` };
                }
            },
            severity: 'critical'
        });

        // File accessibility validation
        this.validationRules.set('file_accessible', {
            name: 'File Accessible',
            validate: async (context) => {
                if (!context.currentFile) {
                    return { valid: false, error: 'No file specified' };
                }
                
                try {
                    const stat = await fs.stat(context.currentFile);
                    if (!stat.isFile()) {
                        return { valid: false, error: 'Path is not a file' };
                    }
                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: `File not accessible: ${error.message}` };
                }
            },
            severity: 'critical'
        });

        // Cursor position validation
        this.validationRules.set('cursor_position', {
            name: 'Cursor Position Valid',
            validate: async (context) => {
                if (!context.cursorPosition) {
                    return { valid: true }; // Optional validation
                }
                
                const { line, character } = context.cursorPosition;
                if (typeof line !== 'number' || typeof character !== 'number') {
                    return { valid: false, error: 'Invalid cursor position format' };
                }
                
                if (line < 1 || character < 0) {
                    return { valid: false, error: 'Cursor position out of bounds' };
                }
                
                // Check if position is within file bounds
                if (context.currentFile) {
                    try {
                        const content = await fs.readFile(context.currentFile, 'utf8');
                        const lines = content.split('\n');
                        if (line > lines.length) {
                            return { valid: false, error: 'Line number exceeds file length' };
                        }
                        if (character > lines[line - 1].length) {
                            return { valid: false, error: 'Character position exceeds line length' };
                        }
                    } catch (error) {
                        return { valid: false, error: `Could not validate cursor position: ${error.message}` };
                    }
                }
                
                return { valid: true };
            },
            severity: 'warning'
        });

        // Workspace validation
        this.validationRules.set('workspace_valid', {
            name: 'Workspace Valid',
            validate: async (context) => {
                if (!context.workspacePath) {
                    return { valid: false, error: 'No workspace path specified' };
                }
                
                try {
                    const stat = await fs.stat(context.workspacePath);
                    if (!stat.isDirectory()) {
                        return { valid: false, error: 'Workspace path is not a directory' };
                    }
                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: `Workspace not accessible: ${error.message}` };
                }
            },
            severity: 'warning'
        });

        // Git repository validation
        this.validationRules.set('git_repository', {
            name: 'Git Repository',
            validate: async (context) => {
                if (!context.workspacePath) {
                    return { valid: true }; // Optional validation
                }
                
                try {
                    const gitDir = path.join(context.workspacePath, '.git');
                    await fs.access(gitDir);
                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: 'Not a git repository' };
                }
            },
            severity: 'info'
        });

        // Cursor application validation
        this.validationRules.set('cursor_running', {
            name: 'Cursor Application Running',
            validate: async (context) => {
                try {
                    const { stdout } = await execAsync('pgrep -f "Cursor"');
                    if (stdout.trim()) {
                        return { valid: true };
                    } else {
                        return { valid: false, error: 'Cursor application is not running' };
                    }
                } catch (error) {
                    return { valid: false, error: 'Could not check if Cursor is running' };
                }
            },
            severity: 'critical'
        });

        // File permissions validation
        this.validationRules.set('file_permissions', {
            name: 'File Permissions',
            validate: async (context) => {
                if (!context.currentFile) {
                    return { valid: true };
                }
                
                try {
                    await fs.access(context.currentFile, fs.constants.R_OK);
                    return { valid: true };
                } catch (error) {
                    return { valid: false, error: 'File is not readable' };
                }
            },
            severity: 'critical'
        });

        // Project structure validation
        this.validationRules.set('project_structure', {
            name: 'Project Structure',
            validate: async (context) => {
                if (!context.workspacePath) {
                    return { valid: true };
                }
                
                try {
                    const files = await fs.readdir(context.workspacePath);
                    const hasPackageJson = files.includes('package.json');
                    const hasGit = files.includes('.git');
                    const hasSrc = files.includes('src') || files.includes('app');
                    
                    if (hasPackageJson || hasGit || hasSrc) {
                        return { valid: true };
                    } else {
                        return { valid: false, error: 'Directory does not appear to be a project' };
                    }
                } catch (error) {
                    return { valid: false, error: `Could not validate project structure: ${error.message}` };
                }
            },
            severity: 'info'
        });
    }

    /**
     * Initialize fallback strategies
     */
    initializeFallbackStrategies() {
        // File not found fallback
        this.fallbackStrategies.set('file_not_found', {
            name: 'File Not Found Fallback',
            execute: async (context, validationResult) => {
                if (validationResult.rule === 'file_exists' || validationResult.rule === 'file_accessible') {
                    // Try to find the file in common locations
                    const possiblePaths = this.generatePossiblePaths(context.currentFile, context.workspacePath);
                    
                    for (const possiblePath of possiblePaths) {
                        try {
                            await fs.access(possiblePath);
                            return {
                                success: true,
                                fallback: 'file_path_correction',
                                correctedPath: possiblePath,
                                message: `Found file at: ${possiblePath}`
                            };
                        } catch (error) {
                            continue;
                        }
                    }
                    
                    return {
                        success: false,
                        error: 'Could not find file in any common locations'
                    };
                }
                
                return { success: false, error: 'No applicable fallback strategy' };
            }
        });

        // Cursor not running fallback
        this.fallbackStrategies.set('cursor_not_running', {
            name: 'Cursor Not Running Fallback',
            execute: async (context, validationResult) => {
                if (validationResult.rule === 'cursor_running') {
                    try {
                        // Try to start Cursor
                        await execAsync('open -a "Cursor"');
                        await this.delay(3000); // Wait for Cursor to start
                        
                        // Verify it's running
                        const { stdout } = await execAsync('pgrep -f "Cursor"');
                        if (stdout.trim()) {
                            return {
                                success: true,
                                fallback: 'cursor_started',
                                message: 'Cursor application started successfully'
                            };
                        } else {
                            return {
                                success: false,
                                error: 'Failed to start Cursor application'
                            };
                        }
                    } catch (error) {
                        return {
                            success: false,
                            error: `Failed to start Cursor: ${error.message}`
                        };
                    }
                }
                
                return { success: false, error: 'No applicable fallback strategy' };
            }
        });

        // Workspace fallback
        this.fallbackStrategies.set('workspace_fallback', {
            name: 'Workspace Fallback',
            execute: async (context, validationResult) => {
                if (validationResult.rule === 'workspace_valid') {
                    // Try to find a valid workspace
                    const possibleWorkspaces = this.generatePossibleWorkspaces(context.currentFile);
                    
                    for (const workspace of possibleWorkspaces) {
                        try {
                            const stat = await fs.stat(workspace);
                            if (stat.isDirectory()) {
                                return {
                                    success: true,
                                    fallback: 'workspace_correction',
                                    correctedWorkspace: workspace,
                                    message: `Found valid workspace at: ${workspace}`
                                };
                            }
                        } catch (error) {
                            continue;
                        }
                    }
                    
                    return {
                        success: false,
                        error: 'Could not find a valid workspace'
                    };
                }
                
                return { success: false, error: 'No applicable fallback strategy' };
            }
        });

        // Cursor position fallback
        this.fallbackStrategies.set('cursor_position_fallback', {
            name: 'Cursor Position Fallback',
            execute: async (context, validationResult) => {
                if (validationResult.rule === 'cursor_position') {
                    // Reset to beginning of file
                    return {
                        success: true,
                        fallback: 'position_reset',
                        correctedPosition: { line: 1, character: 0 },
                        message: 'Reset cursor position to beginning of file'
                    };
                }
                
                return { success: false, error: 'No applicable fallback strategy' };
            }
        });
    }

    /**
     * Validate context comprehensively
     */
    async validateContext(context, options = {}) {
        const {
            includeWarnings = true,
            includeInfo = false,
            runFallbacks = true,
            severityFilter = ['critical', 'warning', 'info']
        } = options;

        const validationResults = {
            valid: true,
            results: [],
            fallbacks: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0,
                critical: 0
            }
        };

        try {
            // Run all validation rules
            for (const [ruleId, rule] of this.validationRules) {
                if (!severityFilter.includes(rule.severity)) {
                    continue;
                }

                validationResults.summary.total++;
                
                try {
                    const result = await rule.validate(context);
                    const validationResult = {
                        rule: ruleId,
                        name: rule.name,
                        severity: rule.severity,
                        valid: result.valid,
                        error: result.error,
                        timestamp: new Date().toISOString()
                    };

                    validationResults.results.push(validationResult);

                    if (result.valid) {
                        validationResults.summary.passed++;
                    } else {
                        validationResults.summary.failed++;
                        
                        if (rule.severity === 'critical') {
                            validationResults.valid = false;
                            validationResults.summary.critical++;
                        } else if (rule.severity === 'warning') {
                            validationResults.summary.warnings++;
                        }

                        // Try fallback if enabled
                        if (runFallbacks) {
                            const fallbackResult = await this.tryFallback(ruleId, context, validationResult);
                            if (fallbackResult.success) {
                                validationResults.fallbacks.push(fallbackResult);
                                
                                // Update context with fallback corrections
                                this.applyFallbackCorrections(context, fallbackResult);
                                
                                // Re-validate if critical issue was fixed
                                if (rule.severity === 'critical') {
                                    const revalidation = await rule.validate(context);
                                    if (revalidation.valid) {
                                        validationResult.valid = true;
                                        validationResult.fallbackApplied = true;
                                        validationResults.valid = true;
                                        validationResults.summary.critical--;
                                        validationResults.summary.passed++;
                                        validationResults.summary.failed--;
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    validationResults.results.push({
                        rule: ruleId,
                        name: rule.name,
                        severity: rule.severity,
                        valid: false,
                        error: `Validation error: ${error.message}`,
                        timestamp: new Date().toISOString()
                    });
                    validationResults.summary.failed++;
                    if (rule.severity === 'critical') {
                        validationResults.valid = false;
                        validationResults.summary.critical++;
                    }
                }
            }

            // Record validation in history
            this.recordValidation(validationResults);

            return validationResults;
        } catch (error) {
            console.error('Context validation failed:', error);
            return {
                valid: false,
                error: error.message,
                results: [],
                fallbacks: [],
                summary: { total: 0, passed: 0, failed: 1, warnings: 0, critical: 1 }
            };
        }
    }

    /**
     * Try fallback strategy for a validation failure
     */
    async tryFallback(ruleId, context, validationResult) {
        const fallbackKey = this.getFallbackKey(ruleId, validationResult);
        const fallback = this.fallbackStrategies.get(fallbackKey);
        
        if (!fallback) {
            return { success: false, error: 'No fallback strategy available' };
        }

        try {
            return await fallback.execute(context, validationResult);
        } catch (error) {
            return { success: false, error: `Fallback execution failed: ${error.message}` };
        }
    }

    /**
     * Apply fallback corrections to context
     */
    applyFallbackCorrections(context, fallbackResult) {
        switch (fallbackResult.fallback) {
            case 'file_path_correction':
                context.currentFile = fallbackResult.correctedPath;
                break;
            case 'workspace_correction':
                context.workspacePath = fallbackResult.correctedWorkspace;
                break;
            case 'position_reset':
                context.cursorPosition = fallbackResult.correctedPosition;
                break;
            case 'cursor_started':
                // No context changes needed
                break;
        }
    }

    /**
     * Get fallback key for a rule
     */
    getFallbackKey(ruleId, validationResult) {
        switch (ruleId) {
            case 'file_exists':
            case 'file_accessible':
                return 'file_not_found';
            case 'cursor_running':
                return 'cursor_not_running';
            case 'workspace_valid':
                return 'workspace_fallback';
            case 'cursor_position':
                return 'cursor_position_fallback';
            default:
                return null;
        }
    }

    /**
     * Generate possible file paths for fallback
     */
    generatePossiblePaths(originalPath, workspacePath) {
        const possiblePaths = [];
        
        if (!originalPath) return possiblePaths;
        
        const fileName = path.basename(originalPath);
        const originalDir = path.dirname(originalPath);
        
        // Original path
        possiblePaths.push(originalPath);
        
        // Same directory with different case
        possiblePaths.push(path.join(originalDir, fileName.toLowerCase()));
        possiblePaths.push(path.join(originalDir, fileName.toUpperCase()));
        
        // Common alternative directories
        if (workspacePath) {
            const commonDirs = ['src', 'app', 'lib', 'components', 'pages', 'scripts'];
            for (const dir of commonDirs) {
                possiblePaths.push(path.join(workspacePath, dir, fileName));
                possiblePaths.push(path.join(workspacePath, dir, '**', fileName));
            }
        }
        
        // Search in parent directories
        let currentDir = originalDir;
        for (let i = 0; i < 3; i++) {
            currentDir = path.dirname(currentDir);
            if (currentDir === '/' || currentDir === originalDir) break;
            possiblePaths.push(path.join(currentDir, fileName));
        }
        
        return possiblePaths;
    }

    /**
     * Generate possible workspace paths
     */
    generatePossibleWorkspaces(filePath) {
        const possibleWorkspaces = [];
        
        if (!filePath) return possibleWorkspaces;
        
        let currentDir = path.dirname(filePath);
        
        // Walk up the directory tree
        for (let i = 0; i < 5; i++) {
            possibleWorkspaces.push(currentDir);
            
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir || parentDir === '/') break;
            currentDir = parentDir;
        }
        
        return possibleWorkspaces;
    }

    /**
     * Record validation in history
     */
    recordValidation(validationResults) {
        this.validationHistory.push({
            timestamp: new Date().toISOString(),
            results: validationResults,
            summary: validationResults.summary
        });
        
        // Keep history size manageable
        if (this.validationHistory.length > this.maxHistorySize) {
            this.validationHistory = this.validationHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Get validation history
     */
    getValidationHistory(limit = 50) {
        return this.validationHistory.slice(-limit);
    }

    /**
     * Get validation statistics
     */
    getValidationStatistics() {
        const stats = {
            totalValidations: this.validationHistory.length,
            successRate: 0,
            commonFailures: {},
            averageValidationTime: 0
        };
        
        if (this.validationHistory.length === 0) {
            return stats;
        }
        
        let totalPassed = 0;
        let totalFailed = 0;
        const failureCounts = {};
        
        for (const validation of this.validationHistory) {
            totalPassed += validation.summary.passed;
            totalFailed += validation.summary.failed;
            
            // Count common failures
            for (const result of validation.results.results || []) {
                if (!result.valid) {
                    failureCounts[result.rule] = (failureCounts[result.rule] || 0) + 1;
                }
            }
        }
        
        stats.successRate = totalPassed / (totalPassed + totalFailed);
        stats.commonFailures = Object.entries(failureCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [rule, count]) => {
                obj[rule] = count;
                return obj;
            }, {});
        
        return stats;
    }

    /**
     * Clear validation history
     */
    clearValidationHistory() {
        this.validationHistory = [];
    }

    /**
     * Helper method for delays
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ContextValidation;
