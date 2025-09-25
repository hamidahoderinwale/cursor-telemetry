/**
 * Context Restoration Integration Service
 * Integrates all context restoration components and provides a unified API
 */

const EnhancedContextRestoration = require('./enhanced-context-restoration');
const SessionStatePersistence = require('./session-state-persistence');
const ContextValidation = require('./context-validation');

class ContextRestorationIntegration {
    constructor(options = {}) {
        this.options = {
            dataDir: options.dataDir || process.env.HOME + '/.pkl',
            enablePersistence: options.enablePersistence !== false,
            enableValidation: options.enableValidation !== false,
            enableFallbacks: options.enableFallbacks !== false,
            ...options
        };

        // Initialize services
        this.contextRestoration = new EnhancedContextRestoration();
        this.statePersistence = this.options.enablePersistence ? 
            new SessionStatePersistence({ dataDir: this.options.dataDir }) : null;
        this.validation = this.options.enableValidation ? 
            new ContextValidation() : null;

        this.restorationHistory = [];
        this.activeRestorations = new Map();
        
        this.initializeIntegration();
    }

    /**
     * Initialize the integration service
     */
    async initializeIntegration() {
        try {
            console.log('Initializing Context Restoration Integration...');
            
            // Initialize persistence if enabled
            if (this.statePersistence) {
                await this.statePersistence.initializeStorage();
                console.log('Session state persistence initialized');
            }

            console.log('Context Restoration Integration initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Context Restoration Integration:', error);
            throw error;
        }
    }

    /**
     * Main restoration method with full integration
     */
    async restoreContext(sessionId, options = {}) {
        const restorationId = this.generateRestorationId();
        
        try {
            console.log(`Starting integrated context restoration: ${restorationId} for session: ${sessionId}`);
            
            // Track active restoration
            this.activeRestorations.set(restorationId, {
                sessionId,
                startTime: new Date(),
                status: 'initializing'
            });

            // Step 1: Load session data
            const sessionData = await this.loadSessionData(sessionId);
            if (!sessionData) {
                throw new Error(`Session ${sessionId} not found`);
            }

            // Step 2: Build comprehensive context
            const context = await this.buildComprehensiveContext(sessionData, options);
            
            // Step 3: Validate context if enabled
            let validationResults = null;
            if (this.validation && options.validate !== false) {
                validationResults = await this.validateContext(context, options);
                
                // Apply fallbacks if validation fails and fallbacks are enabled
                if (this.options.enableFallbacks && !validationResults.valid) {
                    const fallbackResult = await this.applyFallbacks(context, validationResults);
                    if (fallbackResult.success) {
                        context.fallbackApplied = true;
                        context.fallbackCorrections = fallbackResult.corrections;
                    }
                }
            }

            // Step 4: Save state checkpoint if enabled
            if (this.statePersistence && options.createCheckpoint !== false) {
                await this.createStateCheckpoint(sessionId, context);
            }

            // Step 5: Execute restoration
            const restorationResult = await this.executeRestoration(context, options);
            
            // Step 6: Validate restoration if enabled
            let restorationValidation = null;
            if (this.validation && options.validateRestoration !== false) {
                restorationValidation = await this.validateRestoration(context, restorationResult);
            }

            // Step 7: Record restoration
            const finalResult = {
                success: restorationResult.success,
                restorationId,
                sessionId,
                strategy: restorationResult.strategy,
                context: context,
                validation: validationResults,
                restorationValidation: restorationValidation,
                fallbackApplied: context.fallbackApplied || false,
                timestamp: new Date().toISOString(),
                duration: Date.now() - this.activeRestorations.get(restorationId).startTime
            };

            // Save restoration history
            this.recordRestoration(finalResult);
            
            // Clean up active restoration
            this.activeRestorations.delete(restorationId);

            return finalResult;

        } catch (error) {
            console.error(`Context restoration failed: ${restorationId}`, error);
            
            // Record failed restoration
            this.recordRestoration({
                success: false,
                restorationId,
                sessionId,
                error: error.message,
                timestamp: new Date().toISOString(),
                duration: Date.now() - (this.activeRestorations.get(restorationId)?.startTime || Date.now())
            });

            // Clean up active restoration
            this.activeRestorations.delete(restorationId);

            return {
                success: false,
                restorationId,
                sessionId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Load session data from multiple sources
     */
    async loadSessionData(sessionId) {
        try {
            // Try to get from active sessions first
            if (typeof realMonitor !== 'undefined' && realMonitor.getSession) {
                const activeSession = realMonitor.getSession(sessionId);
                if (activeSession) {
                    return activeSession;
                }
            }

            // Try to get from persistence
            if (this.statePersistence) {
                const persistedState = await this.statePersistence.loadSessionState(sessionId);
                if (persistedState.success) {
                    return persistedState.state;
                }
            }

            // Try to get from API
            try {
                const response = await fetch(`/api/session/${sessionId}`);
                if (response.ok) {
                    const data = await response.json();
                    return data.session;
                }
            } catch (apiError) {
                console.warn('API session load failed:', apiError.message);
            }

            return null;
        } catch (error) {
            console.error('Failed to load session data:', error);
            return null;
        }
    }

    /**
     * Build comprehensive context from session data
     */
    async buildComprehensiveContext(sessionData, options = {}) {
        const context = {
            // Basic session info
            sessionId: sessionData.id,
            timestamp: sessionData.timestamp,
            intent: sessionData.intent,
            
            // File context
            currentFile: sessionData.currentFile,
            cursorPosition: sessionData.cursorPosition,
            selectedText: sessionData.selectedText,
            
            // Code context
            codeDeltas: sessionData.codeDeltas || [],
            fileChanges: sessionData.fileChanges || [],
            
            // Workspace context
            workspacePath: sessionData.workspacePath,
            projectRoot: null,
            
            // Additional context
            linkedEvents: sessionData.linkedEvents || [],
            conversations: sessionData.conversations || [],
            
            // Restoration metadata
            restorationTimestamp: new Date().toISOString(),
            contextVersion: '2.0',
            integrationVersion: '1.0'
        };

        // Add workspace state if requested
        if (options.includeWorkspaceState !== false) {
            context.workspaceState = await this.getWorkspaceState(sessionData.currentFile);
        }

        // Add git state if requested
        if (options.includeGitState !== false) {
            context.gitState = await this.getGitState(sessionData.currentFile);
        }

        // Determine project root
        context.projectRoot = this.determineProjectRoot(sessionData.currentFile);

        return context;
    }

    /**
     * Validate context using the validation service
     */
    async validateContext(context, options = {}) {
        if (!this.validation) {
            return { valid: true, message: 'Validation disabled' };
        }

        return await this.validation.validateContext(context, {
            includeWarnings: options.includeWarnings !== false,
            includeInfo: options.includeInfo || false,
            runFallbacks: this.options.enableFallbacks
        });
    }

    /**
     * Apply fallbacks based on validation results
     */
    async applyFallbacks(context, validationResults) {
        if (!this.validation || !this.options.enableFallbacks) {
            return { success: false, error: 'Fallbacks disabled' };
        }

        const corrections = [];
        let hasCorrections = false;

        // Apply fallbacks for failed validations
        for (const result of validationResults.results) {
            if (!result.valid && result.severity === 'critical') {
                const fallbackKey = this.validation.getFallbackKey(result.rule, result);
                const fallback = this.validation.fallbackStrategies.get(fallbackKey);
                
                if (fallback) {
                    try {
                        const fallbackResult = await fallback.execute(context, result);
                        if (fallbackResult.success) {
                            corrections.push(fallbackResult);
                            this.validation.applyFallbackCorrections(context, fallbackResult);
                            hasCorrections = true;
                        }
                    } catch (error) {
                        console.warn(`Fallback failed for ${result.rule}:`, error.message);
                    }
                }
            }
        }

        return {
            success: hasCorrections,
            corrections: corrections
        };
    }

    /**
     * Create state checkpoint
     */
    async createStateCheckpoint(sessionId, context) {
        if (!this.statePersistence) return;

        try {
            await this.statePersistence.createCheckpoint(sessionId, {
                restorationContext: context,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.warn('Failed to create checkpoint:', error.message);
        }
    }

    /**
     * Execute restoration using the enhanced context restoration service
     */
    async executeRestoration(context, options = {}) {
        return await this.contextRestoration.restoreContext(context.sessionId, {
            preferredStrategy: options.strategy || 'auto',
            includeWorkspaceState: options.includeWorkspaceState !== false,
            includeGitState: options.includeGitState !== false,
            validateRestoration: options.validateRestoration !== false,
            timeout: options.timeout || 30000
        });
    }

    /**
     * Validate restoration result
     */
    async validateRestoration(context, restorationResult) {
        if (!this.validation) {
            return { success: true, message: 'Validation disabled' };
        }

        return await this.contextRestoration.validateRestoration(context, restorationResult);
    }

    /**
     * Get restoration history
     */
    getRestorationHistory(limit = 50) {
        return this.restorationHistory.slice(-limit);
    }

    /**
     * Get active restorations
     */
    getActiveRestorations() {
        return Array.from(this.activeRestorations.values());
    }

    /**
     * Get restoration statistics
     */
    getRestorationStatistics() {
        const stats = {
            totalRestorations: this.restorationHistory.length,
            successfulRestorations: 0,
            failedRestorations: 0,
            averageDuration: 0,
            strategyUsage: {},
            commonErrors: {},
            activeRestorations: this.activeRestorations.size
        };

        if (this.restorationHistory.length === 0) {
            return stats;
        }

        let totalDuration = 0;
        const errorCounts = {};
        const strategyCounts = {};

        for (const restoration of this.restorationHistory) {
            if (restoration.success) {
                stats.successfulRestorations++;
            } else {
                stats.failedRestorations++;
                const error = restoration.error || 'Unknown error';
                errorCounts[error] = (errorCounts[error] || 0) + 1;
            }

            if (restoration.duration) {
                totalDuration += restoration.duration;
            }

            if (restoration.strategy) {
                strategyCounts[restoration.strategy] = (strategyCounts[restoration.strategy] || 0) + 1;
            }
        }

        stats.averageDuration = totalDuration / this.restorationHistory.length;
        stats.strategyUsage = strategyCounts;
        stats.commonErrors = Object.entries(errorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .reduce((obj, [error, count]) => {
                obj[error] = count;
                return obj;
            }, {});

        return stats;
    }

    /**
     * Record restoration in history
     */
    recordRestoration(restoration) {
        this.restorationHistory.push(restoration);
        
        // Keep history size manageable
        const maxHistory = 1000;
        if (this.restorationHistory.length > maxHistory) {
            this.restorationHistory = this.restorationHistory.slice(-maxHistory);
        }
    }

    /**
     * Generate unique restoration ID
     */
    generateRestorationId() {
        return `restoration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Helper methods (delegated to context restoration service)
     */
    async getWorkspaceState(filePath) {
        return await this.contextRestoration.getWorkspaceState(filePath);
    }

    async getGitState(filePath) {
        return await this.contextRestoration.getGitState(filePath);
    }

    determineProjectRoot(filePath) {
        return this.contextRestoration.determineProjectRoot(filePath);
    }

    /**
     * Cleanup method
     */
    async cleanup() {
        try {
            // Cancel any active restorations
            this.activeRestorations.clear();
            
            // Cleanup services if they have cleanup methods
            if (this.statePersistence && typeof this.statePersistence.cleanup === 'function') {
                await this.statePersistence.cleanup();
            }
            
            console.log('Context Restoration Integration cleaned up');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

module.exports = ContextRestorationIntegration;
