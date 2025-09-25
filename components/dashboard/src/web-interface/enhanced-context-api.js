/**
 * Enhanced Context Restoration API
 * Provides API endpoints for the enhanced context restoration system
 */

const ContextRestorationIntegration = require('../services/context-restoration-integration');

class EnhancedContextAPI {
    constructor(options = {}) {
        this.integration = new ContextRestorationIntegration(options);
        this.initialized = false;
    }

    /**
     * Initialize the API
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.integration.initializeIntegration();
            this.initialized = true;
            console.log('Enhanced Context API initialized');
        } catch (error) {
            console.error('Failed to initialize Enhanced Context API:', error);
            throw error;
        }
    }

    /**
     * Setup API routes for Express app
     */
    setupRoutes(app) {
        // Ensure API is initialized
        app.use('/api/context/*', async (req, res, next) => {
            if (!this.initialized) {
                try {
                    await this.initialize();
                } catch (error) {
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to initialize context restoration API'
                    });
                }
            }
            next();
        });

        // Context restoration endpoint
        app.post('/api/context/restore', async (req, res) => {
            try {
                const { sessionId, strategy, options = {} } = req.body;
                
                if (!sessionId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Session ID is required'
                    });
                }

                console.log(`Context restoration requested for session: ${sessionId}`);
                
                const result = await this.integration.restoreContext(sessionId, {
                    strategy,
                    ...options
                });

                res.json(result);
            } catch (error) {
                console.error('Context restoration API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Context validation endpoint
        app.post('/api/context/validate', async (req, res) => {
            try {
                const { sessionId, context } = req.body;
                
                if (!context) {
                    return res.status(400).json({
                        success: false,
                        error: 'Context is required'
                    });
                }

                const validationResult = await this.integration.validateContext(context, {
                    includeWarnings: true,
                    includeInfo: false,
                    runFallbacks: false
                });

                res.json(validationResult);
            } catch (error) {
                console.error('Context validation API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get restoration history
        app.get('/api/context/history', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 50;
                const history = this.integration.getRestorationHistory(limit);
                
                res.json({
                    success: true,
                    history: history,
                    total: history.length
                });
            } catch (error) {
                console.error('Get restoration history API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get active restorations
        app.get('/api/context/active', async (req, res) => {
            try {
                const activeRestorations = this.integration.getActiveRestorations();
                
                res.json({
                    success: true,
                    activeRestorations: activeRestorations,
                    count: activeRestorations.length
                });
            } catch (error) {
                console.error('Get active restorations API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get restoration statistics
        app.get('/api/context/statistics', async (req, res) => {
            try {
                const statistics = this.integration.getRestorationStatistics();
                
                res.json({
                    success: true,
                    statistics: statistics
                });
            } catch (error) {
                console.error('Get restoration statistics API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Create session checkpoint
        app.post('/api/context/checkpoint/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { metadata = {} } = req.body;
                
                if (!this.integration.statePersistence) {
                    return res.status(400).json({
                        success: false,
                        error: 'State persistence not enabled'
                    });
                }

                const result = await this.integration.statePersistence.createCheckpoint(sessionId, metadata);
                res.json(result);
            } catch (error) {
                console.error('Create checkpoint API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get session state history
        app.get('/api/context/state-history/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const limit = parseInt(req.query.limit) || 50;
                
                if (!this.integration.statePersistence) {
                    return res.status(400).json({
                        success: false,
                        error: 'State persistence not enabled'
                    });
                }

                const history = await this.integration.statePersistence.getSessionStateHistory(sessionId, {
                    limit,
                    includeCheckpoints: req.query.includeCheckpoints !== 'false',
                    includeSnapshots: req.query.includeSnapshots !== 'false'
                });
                
                res.json({
                    success: true,
                    history: history,
                    sessionId: sessionId
                });
            } catch (error) {
                console.error('Get session state history API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Restore from checkpoint
        app.post('/api/context/restore-checkpoint/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { checkpointId, createBackup = true } = req.body;
                
                if (!this.integration.statePersistence) {
                    return res.status(400).json({
                        success: false,
                        error: 'State persistence not enabled'
                    });
                }

                const result = await this.integration.statePersistence.restoreSessionState(sessionId, {
                    type: 'checkpoint',
                    id: checkpointId
                }, {
                    createBackup,
                    validateState: true
                });
                
                res.json(result);
            } catch (error) {
                console.error('Restore from checkpoint API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get validation statistics
        app.get('/api/context/validation-statistics', async (req, res) => {
            try {
                if (!this.integration.validation) {
                    return res.status(400).json({
                        success: false,
                        error: 'Validation not enabled'
                    });
                }

                const statistics = this.integration.validation.getValidationStatistics();
                res.json({
                    success: true,
                    statistics: statistics
                });
            } catch (error) {
                console.error('Get validation statistics API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get validation history
        app.get('/api/context/validation-history', async (req, res) => {
            try {
                if (!this.integration.validation) {
                    return res.status(400).json({
                        success: false,
                        error: 'Validation not enabled'
                    });
                }

                const limit = parseInt(req.query.limit) || 50;
                const history = this.integration.validation.getValidationHistory(limit);
                
                res.json({
                    success: true,
                    history: history,
                    total: history.length
                });
            } catch (error) {
                console.error('Get validation history API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Health check endpoint
        app.get('/api/context/health', async (req, res) => {
            try {
                const health = {
                    initialized: this.initialized,
                    services: {
                        contextRestoration: !!this.integration.contextRestoration,
                        statePersistence: !!this.integration.statePersistence,
                        validation: !!this.integration.validation
                    },
                    activeRestorations: this.integration.activeRestorations.size,
                    restorationHistory: this.integration.restorationHistory.length
                };
                
                res.json({
                    success: true,
                    health: health,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Health check API error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        console.log('Enhanced Context API routes registered');
    }

    /**
     * Get integration instance
     */
    getIntegration() {
        return this.integration;
    }

    /**
     * Cleanup method
     */
    async cleanup() {
        try {
            if (this.integration) {
                await this.integration.cleanup();
            }
            console.log('Enhanced Context API cleaned up');
        } catch (error) {
            console.error('Error during API cleanup:', error);
        }
    }
}

module.exports = EnhancedContextAPI;
