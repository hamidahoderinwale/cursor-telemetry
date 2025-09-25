/**
 * Memory API
 * Dynamic memory-based integration solutions
 */

const { DynamicCursorIntegration, MemoryQualityMetrics } = require('../services/dynamic-cursor-integration');

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
    this.dynamicIntegration = new DynamicCursorIntegration();
    this.qualityMetrics = new MemoryQualityMetrics();
    
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
        
        const result = await this.dynamicIntegration.integrateSession(sessionId, options);
        
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
        const integrationResult = await this.dynamicIntegration.integrateSession(sessionId, options);
        
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
        console.error('Get memories API error:', error);
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
        const metrics = await this.qualityMetrics.getSystemMetrics();
        
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
        const metrics = await this.qualityMetrics.getSessionMetrics(sessionId);
        
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

    // Replace the broken "return-to-context" endpoint
    app.post('/api/session/:id/return-to-context', async (req, res) => {
      try {
        const sessionId = req.params.id;
        const options = req.body;
        
        console.log(`Return to context requested for session: ${sessionId}`);
        console.log('WARNING: Using enhanced dynamic integration instead of broken AppleScript');
        
        // Use dynamic integration instead of AppleScript
        const integrationResult = await this.dynamicIntegration.integrateSession(sessionId, options);
        
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
      
      const result = await this.dynamicIntegration.integrateSession(sessionId, options);
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
      
      const integrationResult = await this.dynamicIntegration.integrateSession(sessionId, options);
      
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
      const metrics = await this.qualityMetrics.getSystemMetrics();
      
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
      const metrics = await this.qualityMetrics.getSessionMetrics(sessionId);
      
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
    await this.storeMemory(memory);
    
    return memory;
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
    // Implementation depends on your memory storage system
    return [];
  }

  async executeMemory(memoryId, context) {
    // Implementation depends on your memory execution system
    return { success: true, memoryId, context };
  }

  async storeMemory(memory) {
    // Implementation depends on your memory storage system
    console.log('Storing memory:', memory.id);
  }
}

module.exports = { MemoryAPI };
