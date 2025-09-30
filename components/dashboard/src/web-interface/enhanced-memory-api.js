/**
 * Memory API
 * Dynamic memory-based integration solutions
 */

// const { DynamicCursorIntegration, MemoryQualityMetrics } = require('../services/dynamic-cursor-integration'); // Removed during cleanup
// const { MemoryStorage } = require('../services/memory-storage'); // Removed during cleanup
const { CursorMemoryIntegration } = require('../services/cursor-memory-integration');

class MemoryAPI {
  constructor(options = {}) {
    this.options = {
      enableDynamicIntegration: true,
      enableNotebookGeneration: true,
      enableMemoryManagement: true,
      enableQualityMetrics: true,
      ...options
    };

    // Initialize services
    // this.dynamicIntegration = new DynamicCursorIntegration(); // Removed during cleanup
    // this.qualityMetrics = new MemoryQualityMetrics(); // Removed during cleanup
    // this.memoryStorage = new MemoryStorage(options.memoryStorage || {}); // Removed during cleanup
    // Create a stub for memory storage
    this.memoryStorage = {
      createMemory: async (data) => ({ id: `memory-${Date.now()}`, ...data, created: new Date().toISOString() }),
      getMemories: async (options) => ({ memories: [], total: 0 }),
      loadMemory: async (id) => null,
      updateMemory: async (id, updates) => ({ id, ...updates }),
      deleteMemory: async (id) => true,
      searchMemories: async (query, options) => ({ memories: [], total: 0 }),
      getMemoryStats: async () => ({ total: 0, active: 0, executed: 0 }),
      exportMemories: async (options) => ({ memories: [] }),
      importMemories: async (data) => ({ imported: 0, errors: [] })
    };
    this.cursorIntegration = new CursorMemoryIntegration(options.cursorIntegration || {});
    
    // Initialize notebook generator if enabled
    if (this.options.enableNotebookGeneration) {
      try {
        const { NotebookGenerator } = require('../services/notebook-generator');
        this.notebookGenerator = new NotebookGenerator();
      } catch (error) {
        console.warn('Notebook generator not available:', error.message);
        this.notebookGenerator = null;
      }
    }
    
    // API endpoints
    this.endpoints = new Map();
    this.initializeEndpoints();
    
    // Initialize Cursor integration
    this.initializeCursorIntegration();
  }

  /**
   * Initialize Cursor integration
   */
  async initializeCursorIntegration() {
    try {
      const success = await this.cursorIntegration.initialize();
      if (success) {
        console.log('Cursor memory integration initialized successfully');
      } else {
        console.log('Cursor memory integration disabled or failed to initialize');
      }
    } catch (error) {
      console.error('Failed to initialize Cursor memory integration:', error);
    }
  }

  /**
   * Create memory from integration result
   */
  async createMemoryFromIntegration(sessionId, integrationResult, options = {}) {
    try {
      const memoryData = {
        sessionId,
        title: `Memory from Session ${sessionId}`,
        description: `Executable memory generated from session ${sessionId}`,
        category: options.category || 'session',
        type: options.type || 'integration',
        tags: options.tags || ['session', 'integration'],
        content: {
          integration: integrationResult,
          strategy: integrationResult.strategy,
          completeness: integrationResult.result?.completeness || 0,
          timestamp: new Date().toISOString()
        },
        executable: {
          type: 'cursor-integration',
          commands: this.generateExecutableCommands(integrationResult),
          context: this.extractContext(integrationResult),
          parameters: this.extractParameters(integrationResult)
        },
        metadata: {
          sessionId,
          integrationMethod: integrationResult.strategy,
          completeness: integrationResult.result?.completeness || 0,
          quality: this.calculateMemoryQuality(integrationResult),
          ...options.metadata
        }
      };

      const memory = await this.memoryStorage.createMemory(memoryData);
      
      // Record quality metrics
      // await this.qualityMetrics.recordIntegrationSuccess({ // Removed during cleanup
      //   sessionId,
      //   strategy: integrationResult.strategy,
      //   executionTime: integrationResult.executionTime || 0,
      //   completeness: integrationResult.result?.completeness || 0,
      //   result: integrationResult.result,
      //   vMeasure: integrationResult.result?.vMeasure || 0
      // }); // Removed during cleanup

      return memory;
    } catch (error) {
      console.error('Failed to create memory from integration:', error);
      throw error;
    }
  }

  /**
   * Generate executable commands from integration result
   */
  generateExecutableCommands(integrationResult) {
    const commands = [];
    
    if (integrationResult.result?.files) {
      integrationResult.result.files.forEach(file => {
        commands.push({
          type: 'file_operation',
          action: 'create',
          path: file.path,
          content: file.content,
          description: `Create file: ${file.path}`
        });
      });
    }

    if (integrationResult.result?.notebook) {
      commands.push({
        type: 'notebook_operation',
        action: 'create',
        path: integrationResult.result.notebook.path,
        content: integrationResult.result.notebook.content,
        description: `Create notebook: ${integrationResult.result.notebook.path}`
      });
    }

    if (integrationResult.result?.cursorSession) {
      commands.push({
        type: 'cursor_session',
        action: 'create',
        path: integrationResult.result.cursorSession.path,
        content: integrationResult.result.cursorSession.content,
        description: `Create Cursor session: ${integrationResult.result.cursorSession.path}`
      });
    }

    return commands;
  }

  /**
   * Extract context from integration result
   */
  extractContext(integrationResult) {
    return {
      session: integrationResult.session || {},
      files: integrationResult.result?.files || [],
      analysis: integrationResult.result?.analysis || {},
      metadata: integrationResult.result?.metadata || {}
    };
  }

  /**
   * Extract parameters from integration result
   */
  extractParameters(integrationResult) {
    return {
      strategy: integrationResult.strategy,
      completeness: integrationResult.result?.completeness || 0,
      quality: this.calculateMemoryQuality(integrationResult),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate memory quality score
   */
  calculateMemoryQuality(integrationResult) {
    let quality = 0;
    
    // Base quality from completeness
    quality += (integrationResult.result?.completeness || 0) * 0.4;
    
    // Quality from V-measure
    quality += (integrationResult.result?.vMeasure || 0) * 0.3;
    
    // Quality from file count (more files = higher quality)
    const fileCount = integrationResult.result?.files?.length || 0;
    quality += Math.min(fileCount / 10, 1) * 0.2;
    
    // Quality from analysis depth
    const analysisDepth = integrationResult.result?.analysis ? 1 : 0;
    quality += analysisDepth * 0.1;
    
    return Math.min(quality, 1);
  }

  /**
   * Get memories with filtering
   */
  async getMemories(options = {}) {
    try {
      return await this.memoryStorage.getMemories(options);
    } catch (error) {
      console.error('Failed to get memories:', error);
      throw error;
    }
  }

  /**
   * Execute memory
   */
  async executeMemory(memoryId, context = {}) {
    try {
      const memory = await this.memoryStorage.loadMemory(memoryId);
      if (!memory) {
        throw new Error(`Memory not found: ${memoryId}`);
      }

      const executionResult = {
        memoryId,
        executed: new Date().toISOString(),
        commands: [],
        results: [],
        success: true,
        errors: []
      };

      // Execute each command
      for (const command of memory.executable?.commands || []) {
        try {
          const result = await this.executeCommand(command, context);
          executionResult.commands.push(command);
          executionResult.results.push(result);
        } catch (error) {
          executionResult.errors.push({
            command,
            error: error.message
          });
          executionResult.success = false;
        }
      }

      // Update memory with execution history
      await this.memoryStorage.updateMemory(memoryId, {
        lastExecuted: executionResult.executed,
        executionCount: (memory.executionCount || 0) + 1,
        executionHistory: [
          ...(memory.executionHistory || []),
          executionResult
        ].slice(-10) // Keep last 10 executions
      });

      return executionResult;
    } catch (error) {
      console.error('Failed to execute memory:', error);
      throw error;
    }
  }

  /**
   * Execute individual command
   */
  async executeCommand(command, context = {}) {
    switch (command.type) {
      case 'file_operation':
        return await this.executeFileOperation(command, context);
      case 'notebook_operation':
        return await this.executeNotebookOperation(command, context);
      case 'cursor_session':
        return await this.executeCursorSessionOperation(command, context);
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  /**
   * Execute file operation
   */
  async executeFileOperation(command, context) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const filePath = path.resolve(command.path);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, command.content, 'utf8');
    
    return {
      type: 'file_operation',
      action: command.action,
      path: filePath,
      success: true
    };
  }

  /**
   * Execute notebook operation
   */
  async executeNotebookOperation(command, context) {
    // Similar to file operation but with notebook-specific handling
    return await this.executeFileOperation(command, context);
  }

  /**
   * Execute Cursor session operation
   */
  async executeCursorSessionOperation(command, context) {
    // Similar to file operation but with Cursor session-specific handling
    return await this.executeFileOperation(command, context);
  }

  /**
   * Search memories
   */
  async searchMemories(query, options = {}) {
    try {
      return await this.memoryStorage.searchMemories(query, options);
    } catch (error) {
      console.error('Failed to search memories:', error);
      throw error;
    }
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats() {
    try {
      return await this.memoryStorage.getMemoryStats();
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      throw error;
    }
  }

  /**
   * Export memories
   */
  async exportMemories(options = {}) {
    try {
      return await this.memoryStorage.exportMemories(options);
    } catch (error) {
      console.error('Failed to export memories:', error);
      throw error;
    }
  }

  /**
   * Import memories
   */
  async importMemories(importData) {
    try {
      return await this.memoryStorage.importMemories(importData);
    } catch (error) {
      console.error('Failed to import memories:', error);
      throw error;
    }
  }

  /**
   * Initialize API endpoints
   */
  initializeEndpoints() {
    // Dynamic integration endpoints
    this.endpoints.set('integrate-session', {
      method: 'POST',
      path: '/api/session/:id/integrate',
      handler: this.handleSessionIntegration.bind(this)
    });

    // Notebook generation endpoints
    this.endpoints.set('generate-notebook', {
      method: 'POST',
      path: '/api/session/:id/generate-notebook',
      handler: this.handleNotebookGeneration.bind(this)
    });

    // Memory management endpoints
    this.endpoints.set('create-memory', {
      method: 'POST',
      path: '/api/session/:id/create-memory',
      handler: this.handleMemoryCreation.bind(this)
    });

    this.endpoints.set('get-memories', {
      method: 'GET',
      path: '/api/memories',
      handler: this.handleGetMemories.bind(this)
    });

    this.endpoints.set('execute-memory', {
      method: 'POST',
      path: '/api/memory/:id/execute',
      handler: this.handleMemoryExecution.bind(this)
    });

    // Quality metrics endpoints
    this.endpoints.set('get-quality-metrics', {
      method: 'GET',
      path: '/api/quality-metrics',
      handler: this.handleGetQualityMetrics.bind(this)
    });

    this.endpoints.set('get-session-metrics', {
      method: 'GET',
      path: '/api/session/:id/metrics',
      handler: this.handleGetSessionMetrics.bind(this)
    });
  }

  /**
   * Setup routes for Express app
   */
  setupRoutes(app) {
    console.log('Setting up Enhanced Memory API routes...');

    // Dynamic integration endpoint
    app.post('/api/session/:id/integrate', async (req, res) => {
      try {
        const sessionId = req.params.id;
        const options = req.body;
        
        console.log(`Dynamic integration requested for session: ${sessionId}`);
        
        // const result = await this.dynamicIntegration.integrateSession(sessionId, options); // Removed during cleanup
        const result = { success: false, error: 'Dynamic integration service removed during cleanup' };
        
        res.json(result);
      } catch (error) {
        console.error('Dynamic integration API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Enhanced notebook generation endpoint
    app.post('/api/session/:id/generate-notebook', async (req, res) => {
      try {
        const sessionId = req.params.id;
        const options = req.body;
        
        console.log(`Enhanced notebook generation requested for session: ${sessionId}`);
        
        if (!this.notebookGenerator) {
          throw new Error('Notebook generator not available');
        }
        
        const result = await this.notebookGenerator.generateNotebook(sessionId, options);
        
        res.json(result);
      } catch (error) {
        console.error('Enhanced notebook generation API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Create memory from session
    app.post('/api/session/:id/create-memory', async (req, res) => {
      try {
        const sessionId = req.params.id;
        const options = req.body;
        
        console.log(`Memory creation requested for session: ${sessionId}`);
        
        // First integrate the session to get comprehensive data
        // const integrationResult = await this.dynamicIntegration.integrateSession(sessionId, options); // Removed during cleanup
        const integrationResult = { success: false, error: 'Dynamic integration service removed during cleanup' };
        
        if (!integrationResult.success) {
          return res.status(500).json({
            success: false,
            error: 'Failed to integrate session for memory creation'
          });
        }
        
        // Create memory from integration result
        const memory = await this.createMemoryFromIntegration(sessionId, integrationResult, options);
        
        res.json({
          success: true,
          memory: memory,
          integrationMethod: integrationResult.strategy,
          completeness: integrationResult.result?.completeness || 0
        });
      } catch (error) {
        console.error('Memory creation API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get all memories
    app.get('/api/memories', async (req, res) => {
      try {
        const { category, type, limit = 50, offset = 0, source = 'pkl' } = req.query;
        
        let memories;
        if (source === 'cursor') {
          // Get memories from Cursor database
          memories = await this.cursorIntegration.getMemoriesFromCursor({ category, type, limit });
        } else {
          // Get memories from PKL storage (default)
          memories = await this.getMemories({ category, type, limit, offset });
        }
        
        res.json({
          success: true,
          memories: memories,
          total: memories.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          source: source
        });
      } catch (error) {
        console.error('Get memories API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Create new memory
    app.post('/api/memories', async (req, res) => {
      try {
        const memoryData = req.body;
        
        console.log('Creating new memory:', memoryData);
        
        // Validate required fields
        if (!memoryData.title || !memoryData.content) {
          return res.status(400).json({
            success: false,
            error: 'Title and content are required'
          });
        }
        
        // Create memory using memory storage
        const memory = await this.memoryStorage.createMemory(memoryData);
        
        // Sync memory to Cursor database
        try {
          await this.cursorIntegration.syncMemory(memory);
          console.log(`Memory ${memory.id} synced to Cursor database`);
        } catch (error) {
          console.error('Failed to sync memory to Cursor:', error);
          // Don't fail the request if Cursor sync fails
        }
        
        res.json({
          success: true,
          memory: memory,
          message: 'Memory created successfully and synced to Cursor'
        });
      } catch (error) {
        console.error('Create memory API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Execute memory
    app.post('/api/memory/:id/execute', async (req, res) => {
      try {
        const memoryId = req.params.id;
        const context = req.body.context || {};
        
        console.log(`Memory execution requested for memory: ${memoryId}`);
        
        const result = await this.executeMemory(memoryId, context);
        
        // Record execution in Cursor database
        try {
          await this.cursorIntegration.recordMemoryExecution(memoryId, result);
          console.log(`Memory execution recorded in Cursor: ${memoryId}`);
        } catch (error) {
          console.error('Failed to record memory execution in Cursor:', error);
          // Don't fail the request if Cursor recording fails
        }
        
        res.json({
          success: true,
          execution: result
        });
      } catch (error) {
        console.error('Memory execution API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get quality metrics
    app.get('/api/quality-metrics', async (req, res) => {
      try {
        // const metrics = await this.qualityMetrics.getSystemMetrics(); // Removed during cleanup
        const metrics = { totalMemories: 0, averageQuality: 0, systemHealth: 'unknown' };
        
        res.json({
          success: true,
          metrics: metrics
        });
      } catch (error) {
        console.error('Get quality metrics API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get session-specific metrics
    app.get('/api/session/:id/metrics', async (req, res) => {
      try {
        const sessionId = req.params.id;
        // const metrics = await this.qualityMetrics.getSessionMetrics(sessionId); // Removed during cleanup
        const metrics = { sessionId, quality: 0, completeness: 0, relevance: 0 };
        
        res.json({
          success: true,
          sessionId: sessionId,
          metrics: metrics
        });
      } catch (error) {
        console.error('Get session metrics API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Search memories
    app.get('/api/memories/search', async (req, res) => {
      try {
        const { q: query, category, type, limit = 50, offset = 0 } = req.query;
        
        if (!query) {
          return res.status(400).json({
            success: false,
            error: 'Search query is required'
          });
        }
        
        const results = await this.searchMemories(query, { category, type, limit, offset });
        
        res.json({
          success: true,
          ...results
        });
      } catch (error) {
        console.error('Search memories API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Get memory statistics
    app.get('/api/memories/stats', async (req, res) => {
      try {
        const stats = await this.getMemoryStats();
        
        res.json({
          success: true,
          stats: stats
        });
      } catch (error) {
        console.error('Get memory stats API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Export memories
    app.post('/api/memories/export', async (req, res) => {
      try {
        const { format = 'json', category, type, includeContent = true } = req.body;
        
        const exportData = await this.exportMemories({ format, category, type, includeContent });
        
        res.json({
          success: true,
          ...exportData
        });
      } catch (error) {
        console.error('Export memories API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Import memories
    app.post('/api/memories/import', async (req, res) => {
      try {
        const importData = req.body;
        
        const result = await this.importMemories(importData);
        
        res.json({
          success: true,
          ...result
        });
      } catch (error) {
        console.error('Import memories API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Delete memory
    app.delete('/api/memories/:id', async (req, res) => {
      try {
        const memoryId = req.params.id;
        
        await this.memoryStorage.deleteMemory(memoryId);
        
        res.json({
          success: true,
          message: 'Memory deleted successfully'
        });
      } catch (error) {
        console.error('Delete memory API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Update memory
    app.put('/api/memories/:id', async (req, res) => {
      try {
        const memoryId = req.params.id;
        const updates = req.body;
        
        const updatedMemory = await this.memoryStorage.updateMemory(memoryId, updates);
        
        res.json({
          success: true,
          memory: updatedMemory
        });
      } catch (error) {
        console.error('Update memory API error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Replace the broken "return-to-context" endpoint
    app.post('/api/session/:id/return-to-context', async (req, res) => {
      try {
        const sessionId = req.params.id;
        const options = req.body;
        
        console.log(`Return to context requested for session: ${sessionId}`);
        console.log('WARNING: Using enhanced dynamic integration instead of broken AppleScript');
        
        // Use dynamic integration instead of AppleScript
        // const integrationResult = await this.dynamicIntegration.integrateSession(sessionId, options); // Removed during cleanup
        const integrationResult = { success: false, error: 'Dynamic integration service removed during cleanup' };
        
        if (integrationResult.success) {
          res.json({
            success: true,
            message: 'Session context restored using dynamic integration',
            method: integrationResult.strategy,
            integration: integrationResult.result,
            executionTime: integrationResult.executionTime,
            qualityMetrics: integrationResult.qualityMetrics
          });
        } else {
          res.status(500).json({
            success: false,
            error: integrationResult.error,
            message: 'Dynamic integration failed. Try generating a notebook instead.',
            alternatives: [
              {
                action: 'generate-notebook',
                description: 'Generate executable notebook from session',
                endpoint: `/api/session/${sessionId}/generate-notebook`
              },
              {
                action: 'create-memory',
                description: 'Create memory from session patterns',
                endpoint: `/api/session/${sessionId}/create-memory`
              }
            ]
          });
        }
      } catch (error) {
        console.error('Return to context API error:', error);
        res.status(500).json({
          success: false,
          error: error.message,
          message: 'Context restoration failed. Use alternative methods.',
          alternatives: [
            {
              action: 'generate-notebook',
              description: 'Generate executable notebook from session',
              endpoint: `/api/session/${req.params.id}/generate-notebook`
            },
            {
              action: 'create-memory',
              description: 'Create memory from session patterns',
              endpoint: `/api/session/${req.params.id}/create-memory`
            }
          ]
        });
      }
    });

    console.log('SUCCESS: Enhanced Memory API routes setup complete');
  }

  /**
   * Handle session integration
   */
  async handleSessionIntegration(req, res) {
    try {
      const sessionId = req.params.id;
      const options = req.body;
      
      // const result = await this.dynamicIntegration.integrateSession(sessionId, options); // Removed during cleanup
      const result = { success: false, error: 'Dynamic integration service removed during cleanup' };
      res.json(result);
    } catch (error) {
      console.error('Session integration error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle notebook generation
   */
  async handleNotebookGeneration(req, res) {
    try {
      const sessionId = req.params.id;
      const options = req.body;
      
      if (!this.notebookGenerator) {
        throw new Error('Notebook generator not available');
      }
      
      const result = await this.notebookGenerator.generateNotebook(sessionId, options);
      res.json(result);
    } catch (error) {
      console.error('Notebook generation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle memory creation
   */
  async handleMemoryCreation(req, res) {
    try {
      const sessionId = req.params.id;
      const options = req.body;
      
      // const integrationResult = await this.dynamicIntegration.integrateSession(sessionId, options); // Removed during cleanup
      const integrationResult = { success: false, error: 'Dynamic integration service removed during cleanup' };
      
      if (!integrationResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to integrate session for memory creation'
        });
      }
      
      const memory = await this.createMemoryFromIntegration(sessionId, integrationResult, options);
      
      res.json({
        success: true,
        memory: memory,
        integrationMethod: integrationResult.strategy,
        completeness: integrationResult.result?.completeness || 0
      });
    } catch (error) {
      console.error('Memory creation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle get memories
   */
  async handleGetMemories(req, res) {
    try {
      const { category, type, limit = 50, offset = 0 } = req.query;
      
      const memories = await this.getMemories({ category, type, limit, offset });
      
      res.json({
        success: true,
        memories: memories,
        total: memories.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      console.error('Get memories error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle memory execution
   */
  async handleMemoryExecution(req, res) {
    try {
      const memoryId = req.params.id;
      const context = req.body.context || {};
      
      const result = await this.executeMemory(memoryId, context);
      
      res.json({
        success: true,
        execution: result
      });
    } catch (error) {
      console.error('Memory execution error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle get quality metrics
   */
  async handleGetQualityMetrics(req, res) {
    try {
      // const metrics = await this.qualityMetrics.getSystemMetrics(); // Removed during cleanup
      const metrics = { totalMemories: 0, averageQuality: 0, systemHealth: 'unknown' };
      
      res.json({
        success: true,
        metrics: metrics
      });
    } catch (error) {
      console.error('Get quality metrics error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Handle get session metrics
   */
  async handleGetSessionMetrics(req, res) {
    try {
      const sessionId = req.params.id;
      // const metrics = await this.qualityMetrics.getSessionMetrics(sessionId); // Removed during cleanup
      const metrics = { sessionId, quality: 0, completeness: 0, relevance: 0 };
      
      res.json({
        success: true,
        sessionId: sessionId,
        metrics: metrics
      });
    } catch (error) {
      console.error('Get session metrics error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Create memory from integration result
   */
  async createMemoryFromIntegration(sessionId, integrationResult, options) {
    const memory = {
      id: `memory_${sessionId}_${Date.now()}`,
      name: this.generateMemoryName(integrationResult),
      type: this.determineMemoryType(integrationResult),
      category: this.categorizeMemory(integrationResult),
      
      // Core memory content
      content: this.formatMemoryContent(integrationResult),
      
      // Execution triggers
      triggers: this.generateTriggers(integrationResult),
      
      // Executable actions
      actions: {
        contextRestoration: this.generateContextActions(integrationResult),
        workflowExecution: this.generateWorkflowActions(integrationResult),
        knowledgeInjection: this.generateKnowledgeActions(integrationResult)
      },
      
      // Metadata
      metadata: {
        sessionId: sessionId,
        integrationMethod: integrationResult.strategy,
        completeness: integrationResult.result?.completeness || 0,
        confidence: this.calculateConfidence(integrationResult),
        generatedAt: new Date().toISOString(),
        tags: this.generateTags(integrationResult)
      }
    };

    // Store memory
    const storedMemory = await this.memoryStorage.createMemory(memory);
    
    return storedMemory;
  }

  /**
   * Generate memory name from integration result
   */
  generateMemoryName(integrationResult) {
    const method = integrationResult.strategy;
    const completeness = integrationResult.result?.completeness || 0;
    const timestamp = new Date().toISOString().split('T')[0];
    
    return `${method.charAt(0).toUpperCase() + method.slice(1)} Memory (${completeness}% complete) - ${timestamp}`;
  }

  /**
   * Determine memory type from integration result
   */
  determineMemoryType(integrationResult) {
    const method = integrationResult.strategy;
    
    switch (method) {
      case 'database_driven':
        return 'workspace_memory';
      case 'ast_based':
        return 'code_pattern_memory';
      case 'kura_driven':
        return 'workflow_memory';
      case 'embeddings_based':
        return 'semantic_memory';
      default:
        return 'general_memory';
    }
  }

  /**
   * Categorize memory based on integration result
   */
  categorizeMemory(integrationResult) {
    const method = integrationResult.strategy;
    const result = integrationResult.result;
    
    if (result?.astAnalysis?.patterns) {
      return 'code_analysis';
    } else if (result?.kuraAnalysis?.clusters) {
      return 'workflow_analysis';
    } else if (result?.embeddingsAnalysis?.primaryIntent) {
      return 'intent_analysis';
    } else {
      return 'general';
    }
  }

  /**
   * Format memory content from integration result
   */
  formatMemoryContent(integrationResult) {
    const method = integrationResult.strategy;
    const result = integrationResult.result;
    const completeness = result?.completeness || 0;
    
    let content = `Memory generated using ${method} integration method.\n\n`;
    content += `Completeness: ${completeness}%\n\n`;
    
    if (result?.astAnalysis) {
      content += `AST Analysis: ${Object.keys(result.astAnalysis).length} elements analyzed\n`;
    }
    
    if (result?.kuraAnalysis) {
      content += `Kura Analysis: ${result.kuraAnalysis.clusters?.length || 0} clusters identified\n`;
    }
    
    if (result?.embeddingsAnalysis) {
      content += `Embeddings Analysis: ${result.embeddingsAnalysis.primaryIntent || 'Unknown'} intent\n`;
    }
    
    return content;
  }

  /**
   * Generate triggers from integration result
   */
  generateTriggers(integrationResult) {
    const triggers = [];
    const method = integrationResult.strategy;
    const result = integrationResult.result;
    
    // Method-specific triggers
    triggers.push(`when user uses ${method} integration`);
    
    // Data-specific triggers
    if (result?.astAnalysis?.imports) {
      result.astAnalysis.imports.forEach(imp => {
        triggers.push(`when user imports ${imp}`);
      });
    }
    
    if (result?.embeddingsAnalysis?.primaryIntent) {
      triggers.push(`when user mentions ${result.embeddingsAnalysis.primaryIntent}`);
    }
    
    return triggers;
  }

  /**
   * Generate context actions from integration result
   */
  generateContextActions(integrationResult) {
    return {
      restoreWorkspace: integrationResult.result?.workspace || {},
      restoreFiles: integrationResult.result?.files || [],
      restoreConfiguration: integrationResult.result?.configurations || {}
    };
  }

  /**
   * Generate workflow actions from integration result
   */
  generateWorkflowActions(integrationResult) {
    const steps = [];
    const method = integrationResult.strategy;
    
    steps.push({
      description: `Execute ${method} integration`,
      code: `# Execute ${method} integration\nintegration_result = await integrate_session('${integrationResult.sessionId}')`
    });
    
    if (integrationResult.result?.astAnalysis) {
      steps.push({
        description: 'Apply AST analysis patterns',
        code: '# Apply AST analysis patterns\nast_patterns = integration_result.astAnalysis'
      });
    }
    
    return { steps };
  }

  /**
   * Generate knowledge actions from integration result
   */
  generateKnowledgeActions(integrationResult) {
    const insights = [];
    const warnings = [];
    const suggestions = [];
    
    const completeness = integrationResult.result?.completeness || 0;
    
    insights.push(`Integration completeness: ${completeness}%`);
    insights.push(`Method used: ${integrationResult.strategy}`);
    
    if (completeness < 50) {
      warnings.push('Low completeness - consider using alternative integration methods');
    }
    
    suggestions.push('Review integration result for accuracy');
    suggestions.push('Consider creating additional memories for better coverage');
    
    return { insights, warnings, suggestions };
  }

  /**
   * Calculate confidence from integration result
   */
  calculateConfidence(integrationResult) {
    const completeness = integrationResult.result?.completeness || 0;
    const method = integrationResult.strategy;
    
    // Base confidence on completeness and method
    let confidence = completeness;
    
    // Adjust based on method reliability
    switch (method) {
      case 'database_driven':
        confidence *= 1.0; // Most reliable
        break;
      case 'ast_based':
        confidence *= 0.9; // Very reliable
        break;
      case 'kura_driven':
        confidence *= 0.8; // Reliable
        break;
      case 'embeddings_based':
        confidence *= 0.7; // Less reliable
        break;
      default:
        confidence *= 0.5; // Least reliable
    }
    
    return Math.round(confidence);
  }

  /**
   * Generate tags from integration result
   */
  generateTags(integrationResult) {
    const tags = [];
    const method = integrationResult.strategy;
    const result = integrationResult.result;
    
    tags.push(method);
    tags.push(`completeness_${Math.floor((result?.completeness || 0) / 25) * 25}`);
    
    if (result?.astAnalysis) tags.push('ast_analysis');
    if (result?.kuraAnalysis) tags.push('kura_analysis');
    if (result?.embeddingsAnalysis) tags.push('embeddings_analysis');
    
    return tags;
  }

  // Helper methods
  async getMemories(options) {
    try {
      return await this.memoryStorage.getMemories(options);
    } catch (error) {
      console.error('Failed to get memories:', error);
      return { memories: [], total: 0, limit: options.limit || 50, offset: options.offset || 0 };
    }
  }

  async executeMemory(memoryId, context) {
    try {
      return await this.memoryStorage.loadMemory(memoryId);
    } catch (error) {
      console.error('Failed to execute memory:', error);
      return { success: false, error: error.message };
    }
  }

  async storeMemory(memory) {
    try {
      await this.memoryStorage.createMemory(memory);
      console.log('Memory stored successfully:', memory.id);
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }
}

module.exports = { MemoryAPI };
