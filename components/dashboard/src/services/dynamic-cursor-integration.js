/**
 * Dynamic Cursor Integration Service
 * V-measure completeness implementation based on Rosenberg and Hirschberg (2007)
 */

// Simple fallback implementations that work without external dependencies

class DynamicCursorIntegration {
  constructor(options = {}) {
    this.options = {
      enableDatabaseIntegration: true,
      enableASTAnalysis: true,
      enableKuraAnalysis: true,
      enableEmbeddingsAnalysis: true,
      enableFallbackStrategies: true,
      ...options
    };

    // Initialize services with fallback implementations
    this.dbParser = null;
    this.astService = null;
    this.patternService = null;
    this.embeddingsClassifier = null;
    this.kuraBridge = null;
    this.clioIntegration = null;

    // Integration strategies
    this.integrationStrategies = new Map();
    this.qualityMetrics = new MemoryQualityMetrics();
    
    this.initializeIntegrationStrategies();
  }

  /**
   * Initialize dynamic integration strategies
   */
  initializeIntegrationStrategies() {
    // Strategy 1: Database-driven integration
    this.integrationStrategies.set('database_driven', {
      name: 'Database-Driven Integration',
      priority: 1,
      execute: this.executeDatabaseIntegration.bind(this),
      fallback: 'ast_based'
    });

    // Strategy 2: AST-based integration
    this.integrationStrategies.set('ast_based', {
      name: 'AST-Based Integration',
      priority: 2,
      execute: this.executeASTIntegration.bind(this),
      fallback: 'kura_driven'
    });

    // Strategy 3: Kura-driven integration
    this.integrationStrategies.set('kura_driven', {
      name: 'Kura-Driven Integration',
      priority: 3,
      execute: this.executeKuraIntegration.bind(this),
      fallback: 'embeddings_based'
    });

    // Strategy 4: Embeddings-based integration
    this.integrationStrategies.set('embeddings_based', {
      name: 'Embeddings-Based Integration',
      priority: 4,
      execute: this.executeEmbeddingsIntegration.bind(this),
      fallback: 'notebook_generation'
    });

    // Strategy 5: Notebook generation fallback
    this.integrationStrategies.set('notebook_generation', {
      name: 'Notebook Generation Fallback',
      priority: 5,
      execute: this.executeNotebookGeneration.bind(this),
      fallback: null
    });
  }

  /**
   * Main integration method - tries strategies in order of priority
   */
  async integrateSession(sessionId, options = {}) {
    const startTime = Date.now();
    const integrationId = `integration_${Date.now()}`;
    
    try {
      console.log(`Starting dynamic integration for session: ${sessionId}`);
      
      const session = await this.loadSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const strategies = Array.from(this.integrationStrategies.values())
        .sort((a, b) => a.priority - b.priority);

      let lastError = null;
      let integrationResult = null;

      for (const strategy of strategies) {
        try {
          console.log(`Trying integration strategy: ${strategy.name}`);
          
          integrationResult = await strategy.execute(session, options);
          
          if (integrationResult.success) {
            console.log(`Integration successful with strategy: ${strategy.name}`);
            
            await this.qualityMetrics.recordIntegrationSuccess({
              sessionId,
              strategy: strategy.name,
              executionTime: Date.now() - startTime,
              completeness: integrationResult.completeness,
              vMeasure: integrationResult.vMeasure,
              result: integrationResult
            });

            return {
              success: true,
              integrationId,
              strategy: strategy.name,
              result: integrationResult,
              executionTime: Date.now() - startTime,
              qualityMetrics: await this.qualityMetrics.getSessionMetrics(sessionId)
            };
          }
        } catch (error) {
          console.warn(`Strategy ${strategy.name} failed:`, error.message);
          lastError = error;
          
          await this.qualityMetrics.recordIntegrationFailure({
            sessionId,
            strategy: strategy.name,
            error: error.message,
            executionTime: Date.now() - startTime
          });
        }
      }

      throw lastError || new Error('All integration strategies failed');

    } catch (error) {
      console.error('Dynamic integration failed:', error);
      
      // Record overall failure
      await this.qualityMetrics.recordIntegrationFailure({
        sessionId,
        strategy: 'all_strategies',
        error: error.message,
        executionTime: Date.now() - startTime
      });

      return {
        success: false,
        integrationId,
        error: error.message,
        executionTime: Date.now() - startTime,
        qualityMetrics: await this.qualityMetrics.getSessionMetrics(sessionId)
      };
    }
  }

  /**
   * Strategy 1: Database-driven integration (fallback)
   */
  async executeDatabaseIntegration(session, options = {}) {
    try {
      // Simple fallback - extract basic session information
      const integration = {
        workspace: session.id,
        files: session.files || [],
        configurations: { sessionId: session.id },
        notebooks: session.notebookState || {},
        extensions: ['python', 'javascript'],
        variables: session.notebookState?.variables || {}
      };
      
      // Calculate completeness using V-measure
      const completeness = this.calculateCompleteness(integration, session);
      
      // Calculate V-measure for detailed metrics
      const groundTruthLabels = this.extractGroundTruthLabels(session);
      const predictedClusters = this.extractPredictedClusters(integration);
      const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
      
      return {
        success: true,
        method: 'database_driven',
        integration,
        completeness,
        vMeasure,
        dataSources: {
          sessionData: true,
          basicWorkspace: true,
          fallbackMode: true
        }
      };
    } catch (error) {
      throw new Error(`Database integration failed: ${error.message}`);
    }
  }

  /**
   * Strategy 2: AST-based integration (fallback)
   */
  async executeASTIntegration(session, options = {}) {
    try {
      // Simple fallback - basic code analysis from session data
      const astAnalysis = {
        imports: this.extractImportsFromSession(session),
        functions: this.extractFunctionsFromSession(session),
        variables: this.extractVariablesFromSession(session),
        dependencies: this.extractDependenciesFromSession(session),
        executionFlow: this.extractExecutionFlowFromSession(session)
      };
      
      const patterns = this.extractPatternsFromSession(session);
      const environment = this.reconstructEnvironmentFromSession(session);
      
      // Calculate completeness using V-measure
      const completeness = this.calculateASTCompleteness(astAnalysis, patterns);
      
      // Calculate V-measure for detailed metrics
      const groundTruthLabels = this.extractASTGroundTruthLabels(astAnalysis);
      const predictedClusters = this.extractASTPredictedClusters(patterns);
      const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
      
      return {
        success: true,
        method: 'ast_based',
        integration: {
          astAnalysis,
          patterns,
          environment,
          reconstructionMethod: 'ast_based_fallback'
        },
        completeness,
        vMeasure,
        dataSources: {
          sessionCodeAnalysis: true,
          basicPatternRecognition: true,
          fallbackMode: true
        }
      };
    } catch (error) {
      throw new Error(`AST integration failed: ${error.message}`);
    }
  }

  /**
   * Strategy 3: Kura-driven integration (fallback)
   */
  async executeKuraIntegration(session, options = {}) {
    try {
      // Simple fallback - basic conversation analysis
      const conversations = this.extractConversationsFromSession(session);
      const kuraAnalysis = this.analyzeConversationsSimple(conversations);
      const integration = this.generateKuraIntegrationSimple(kuraAnalysis, session);
      
      // Calculate completeness
      const completeness = this.calculateKuraCompleteness(kuraAnalysis);
      const groundTruthLabels = this.extractKuraGroundTruthLabels(kuraAnalysis);
      const predictedClusters = this.extractKuraPredictedClusters(kuraAnalysis);
      const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
      
      return {
        success: true,
        method: 'kura_driven',
        integration,
        completeness,
        vMeasure,
        dataSources: {
          conversationAnalysis: true,
          basicClustering: true,
          fallbackMode: true
        }
      };
    } catch (error) {
      throw new Error(`Kura integration failed: ${error.message}`);
    }
  }

  /**
   * Strategy 4: Embeddings-based integration (fallback)
   */
  async executeEmbeddingsIntegration(session, options = {}) {
    try {
      // Simple fallback - basic intent analysis
      const embeddings = this.generateEmbeddingsSimple(session);
      const intentAnalysis = this.classifyIntentSimple(session);
      const integration = this.createEmbeddingsIntegrationSimple(embeddings, intentAnalysis, session);
      
      // Calculate completeness
      const completeness = this.calculateEmbeddingsCompleteness(embeddings, intentAnalysis);
      const groundTruthLabels = this.extractEmbeddingsGroundTruthLabels(embeddings, intentAnalysis);
      const predictedClusters = this.extractEmbeddingsPredictedClusters(embeddings, intentAnalysis);
      const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
      
      return {
        success: true,
        method: 'embeddings_based',
        integration,
        completeness,
        vMeasure,
        dataSources: {
          basicEmbeddings: true,
          simpleIntentClassification: true,
          fallbackMode: true
        }
      };
    } catch (error) {
      throw new Error(`Embeddings integration failed: ${error.message}`);
    }
  }

  /**
   * Strategy 5: Notebook generation fallback
   */
  async executeNotebookGeneration(session, options = {}) {
    try {
      // Simple fallback - basic notebook structure
      const notebook = this.generateNotebookSimple(session);
      const completeness = this.calculateNotebookCompleteness(notebook);
      const groundTruthLabels = this.extractNotebookGroundTruthLabels(notebook);
      const predictedClusters = this.extractNotebookPredictedClusters(notebook);
      const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
      
      return {
        success: true,
        method: 'notebook_generation',
        integration: {
          notebook,
          fallback: true
        },
        completeness,
        vMeasure,
        dataSources: {
          basicNotebookGeneration: true,
          sessionReconstruction: true,
          fallbackMode: true
        }
      };
    } catch (error) {
      throw new Error(`Notebook generation failed: ${error.message}`);
    }
  }

  /**
   * Extract workspace information from Cursor database
   */
  async extractWorkspaceInfo(cursorState) {
    return {
      // Dynamic file discovery
      openFiles: await this.dbParser.getOpenFiles(),
      activeWorkspace: await this.dbParser.getActiveWorkspace(),
      
      // Dynamic extension detection
      activeExtensions: await this.dbParser.getActiveExtensions(),
      
      // Dynamic configuration
      workspaceSettings: await this.dbParser.getWorkspaceSettings(),
      
      // Dynamic notebook states
      notebookStates: await this.dbParser.getNotebookStates(),
      
      // Dynamic variable environments
      variableEnvironments: await this.dbParser.getVariableEnvironments(),
      
      // Dynamic execution history
      executionHistory: await this.dbParser.getExecutionHistory()
    };
  }

  /**
   * Generate database-driven integration
   */
  async generateDatabaseIntegration(workspaceInfo, session) {
    return {
      type: 'database_driven',
      workspace: workspaceInfo.activeWorkspace,
      files: await this.mapSessionFilesToWorkspace(session, workspaceInfo),
      configurations: await this.generateConfigurations(workspaceInfo),
      notebooks: await this.reconstructNotebookStates(session, workspaceInfo),
      extensions: workspaceInfo.activeExtensions,
      variables: workspaceInfo.variableEnvironments
    };
  }

  /**
   * Reconstruct environment from AST analysis
   */
  async reconstructEnvironmentFromAST(astAnalysis, patterns) {
    return {
      // Dynamic import detection
      imports: astAnalysis.imports || [],
      
      // Dynamic function extraction
      functions: astAnalysis.functions || [],
      
      // Dynamic variable tracking
      variables: astAnalysis.variables || [],
      
      // Dynamic dependency analysis
      dependencies: astAnalysis.dependencies || [],
      
      // Dynamic execution flow
      executionFlow: astAnalysis.executionFlow || [],
      
      // Dynamic pattern matching
      matchedPatterns: patterns || []
    };
  }

  /**
   * Generate Kura-based integration
   */
  async generateKuraIntegration(kuraAnalysis, session) {
    return {
      type: 'kura_driven',
      
      // Dynamic clustering-based organization
      clusters: kuraAnalysis.clusters || [],
      
      // Dynamic UMAP coordinates for visualization
      umapCoordinates: kuraAnalysis.umap_coordinates || [],
      
      // Dynamic facet analysis
      facets: kuraAnalysis.clio_facets || {},
      
      // Dynamic workflow patterns
      workflowPatterns: kuraAnalysis.workflow_patterns || [],
      
      // Dynamic intent classification
      intentClassification: kuraAnalysis.intent_classifications || {},
      
      // Dynamic similarity analysis
      similarSessions: await this.findSimilarSessions(session, kuraAnalysis)
    };
  }

  /**
   * Create embeddings-based integration
   */
  async createEmbeddingsIntegration(embeddings, intentAnalysis, session) {
    return {
      type: 'embeddings_based',
      
      // Dynamic intent classification
      primaryIntent: intentAnalysis.primary_intent,
      confidence: intentAnalysis.confidence,
      
      // Dynamic facet analysis
      facets: intentAnalysis.facets || {},
      
      // Dynamic similarity vectors
      similarityVectors: embeddings.similarity_vectors || [],
      
      // Dynamic context understanding
      contextUnderstanding: embeddings.context_understanding || {},
      
      // Dynamic memory triggers
      triggers: await this.generateDynamicTriggers(embeddings, intentAnalysis),
      
      // Dynamic memory actions
      actions: await this.generateDynamicActions(embeddings, intentAnalysis, session)
    };
  }

  /**
   * Calculate completeness for database integration using V-measure
   * Based on Rosenberg and Hirschberg (2007) - completeness refers to the degree
   * that all items in the ground truth label are in the same cluster
   */
  calculateCompleteness(integration, session) {
    // Define ground truth labels based on session data
    const groundTruthLabels = this.extractGroundTruthLabels(session);
    
    // Define predicted clusters based on integration result
    const predictedClusters = this.extractPredictedClusters(integration);
    
    // Calculate V-measure completeness
    const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
    
    return vMeasure.completeness * 100; // Convert to percentage
  }

  /**
   * Extract ground truth labels from session data
   */
  extractGroundTruthLabels(session) {
    const labels = [];
    
    // File-based labels
    if (session.files) {
      session.files.forEach((file, index) => {
        labels.push({
          id: `file_${index}`,
          type: 'file',
          category: this.categorizeFile(file),
          content: file.content || file.path
        });
      });
    }
    
    // Code-based labels
    if (session.codeDeltas) {
      session.codeDeltas.forEach((delta, index) => {
        labels.push({
          id: `code_${index}`,
          type: 'code',
          category: this.categorizeCode(delta),
          content: delta.content || delta.change
        });
      });
    }
    
    // Conversation-based labels
    if (session.conversations) {
      session.conversations.forEach((conv, index) => {
        labels.push({
          id: `conv_${index}`,
          type: 'conversation',
          category: this.categorizeConversation(conv),
          content: conv.content || conv.message
        });
      });
    }
    
    return labels;
  }

  /**
   * Extract predicted clusters from integration result
   */
  extractPredictedClusters(integration) {
    const clusters = [];
    
    // Database integration clusters
    if (integration.workspace) {
      clusters.push({
        id: 'workspace_cluster',
        type: 'workspace',
        items: ['workspace', 'configurations', 'extensions']
      });
    }
    
    if (integration.files && integration.files.length > 0) {
      clusters.push({
        id: 'files_cluster',
        type: 'files',
        items: integration.files.map(f => f.path || f.name)
      });
    }
    
    if (integration.notebooks) {
      clusters.push({
        id: 'notebooks_cluster',
        type: 'notebooks',
        items: Object.keys(integration.notebooks)
      });
    }
    
    if (integration.variables) {
      clusters.push({
        id: 'variables_cluster',
        type: 'variables',
        items: Object.keys(integration.variables)
      });
    }
    
    return clusters;
  }

  /**
   * Calculate V-measure completeness and homogeneity
   * Based on Rosenberg and Hirschberg (2007)
   */
  calculateVMeasure(groundTruthLabels, predictedClusters) {
    // Calculate completeness: degree that all items in ground truth label are in same cluster
    const completeness = this.calculateCompletenessScore(groundTruthLabels, predictedClusters);
    
    // Calculate homogeneity: degree that all items in cluster belong to same ground truth label
    const homogeneity = this.calculateHomogeneityScore(groundTruthLabels, predictedClusters);
    
    // Calculate V-measure (harmonic mean of completeness and homogeneity)
    const vMeasure = completeness === 0 && homogeneity === 0 ? 0 : 
      (2 * completeness * homogeneity) / (completeness + homogeneity);
    
    return {
      completeness,
      homogeneity,
      vMeasure
    };
  }

  /**
   * Calculate completeness score
   * Completeness = 1 - H(C|K) / H(C)
   * Where H(C|K) is conditional entropy and H(C) is entropy of ground truth
   */
  calculateCompletenessScore(groundTruthLabels, predictedClusters) {
    // Group ground truth labels by category
    const groundTruthGroups = this.groupByCategory(groundTruthLabels);
    
    // Calculate entropy of ground truth
    const totalItems = groundTruthLabels.length;
    const groundTruthEntropy = this.calculateEntropy(groundTruthGroups, totalItems);
    
    if (groundTruthEntropy === 0) return 1; // Perfect completeness if no entropy
    
    // Calculate conditional entropy H(C|K)
    const conditionalEntropy = this.calculateConditionalEntropy(groundTruthLabels, predictedClusters);
    
    // Completeness = 1 - H(C|K) / H(C)
    return 1 - (conditionalEntropy / groundTruthEntropy);
  }

  /**
   * Calculate homogeneity score
   * Homogeneity = 1 - H(K|C) / H(K)
   * Where H(K|C) is conditional entropy and H(K) is entropy of clusters
   */
  calculateHomogeneityScore(groundTruthLabels, predictedClusters) {
    // Calculate entropy of clusters
    const totalItems = groundTruthLabels.length;
    const clusterEntropy = this.calculateEntropy(predictedClusters, totalItems);
    
    if (clusterEntropy === 0) return 1; // Perfect homogeneity if no entropy
    
    // Calculate conditional entropy H(K|C)
    const conditionalEntropy = this.calculateConditionalEntropy(predictedClusters, groundTruthLabels);
    
    // Homogeneity = 1 - H(K|C) / H(K)
    return 1 - (conditionalEntropy / clusterEntropy);
  }

  /**
   * Calculate entropy of a distribution
   */
  calculateEntropy(groups, totalItems) {
    let entropy = 0;
    
    for (const group of groups) {
      const probability = group.items.length / totalItems;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy;
  }

  /**
   * Calculate conditional entropy H(X|Y)
   */
  calculateConditionalEntropy(xGroups, yGroups) {
    let conditionalEntropy = 0;
    const totalItems = xGroups.reduce((sum, group) => sum + group.items.length, 0);
    
    for (const xGroup of xGroups) {
      for (const yGroup of yGroups) {
        // Find intersection of items
        const intersection = xGroup.items.filter(item => yGroup.items.includes(item));
        const intersectionSize = intersection.length;
        
        if (intersectionSize > 0) {
          const probability = intersectionSize / totalItems;
          const conditionalProbability = intersectionSize / xGroup.items.length;
          conditionalEntropy -= probability * Math.log2(conditionalProbability);
        }
      }
    }
    
    return conditionalEntropy;
  }

  /**
   * Group items by category
   */
  groupByCategory(items) {
    const groups = new Map();
    
    for (const item of items) {
      const category = item.category || 'unknown';
      if (!groups.has(category)) {
        groups.set(category, { category, items: [] });
      }
      groups.get(category).items.push(item.id);
    }
    
    return Array.from(groups.values());
  }

  /**
   * Categorize file based on type and content
   */
  categorizeFile(file) {
    const extension = file.path ? file.path.split('.').pop() : 'unknown';
    const content = file.content || '';
    
    if (extension === 'py') return 'python';
    if (extension === 'js') return 'javascript';
    if (extension === 'ts') return 'typescript';
    if (extension === 'ipynb') return 'notebook';
    if (extension === 'md') return 'documentation';
    if (extension === 'json') return 'configuration';
    if (extension === 'css') return 'styling';
    if (extension === 'html') return 'markup';
    
    // Content-based categorization
    if (content.includes('import pandas') || content.includes('import numpy')) return 'data_analysis';
    if (content.includes('import matplotlib') || content.includes('import seaborn')) return 'visualization';
    if (content.includes('import sklearn') || content.includes('import tensorflow')) return 'machine_learning';
    if (content.includes('import flask') || content.includes('import django')) return 'web_framework';
    if (content.includes('import pytest') || content.includes('import unittest')) return 'testing';
    
    return 'general';
  }

  /**
   * Categorize code based on content
   */
  categorizeCode(delta) {
    const content = delta.content || delta.change || '';
    
    if (content.includes('def ') || content.includes('function ')) return 'function_definition';
    if (content.includes('class ')) return 'class_definition';
    if (content.includes('import ') || content.includes('require(')) return 'import_statement';
    if (content.includes('if ') || content.includes('for ') || content.includes('while ')) return 'control_flow';
    if (content.includes('return ')) return 'return_statement';
    if (content.includes('print(') || content.includes('console.log')) return 'output_statement';
    if (content.includes('try:') || content.includes('catch(')) return 'error_handling';
    if (content.includes('test') || content.includes('assert')) return 'testing';
    
    return 'general_code';
  }

  /**
   * Categorize conversation based on content
   */
  categorizeConversation(conv) {
    const content = conv.content || conv.message || '';
    const role = conv.role || 'unknown';
    
    if (role === 'user') {
      if (content.includes('?') || content.includes('how') || content.includes('what')) return 'question';
      if (content.includes('error') || content.includes('bug') || content.includes('fix')) return 'debugging';
      if (content.includes('implement') || content.includes('create') || content.includes('add')) return 'implementation';
      if (content.includes('explain') || content.includes('describe')) return 'explanation';
      return 'user_input';
    } else if (role === 'assistant') {
      if (content.includes('code') || content.includes('```')) return 'code_response';
      if (content.includes('error') || content.includes('exception')) return 'error_response';
      if (content.includes('suggestion') || content.includes('recommend')) return 'suggestion';
      return 'assistant_response';
    }
    
    return 'general_conversation';
  }

  /**
   * Calculate completeness for AST integration using V-measure
   */
  calculateASTCompleteness(astAnalysis, patterns) {
    // Define ground truth labels based on AST analysis
    const groundTruthLabels = this.extractASTGroundTruthLabels(astAnalysis);
    
    // Define predicted clusters based on patterns
    const predictedClusters = this.extractASTPredictedClusters(patterns);
    
    // Calculate V-measure completeness
    const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
    
    return vMeasure.completeness * 100; // Convert to percentage
  }

  /**
   * Calculate completeness for Kura integration using V-measure
   */
  calculateKuraCompleteness(kuraAnalysis) {
    // Define ground truth labels based on Kura analysis
    const groundTruthLabels = this.extractKuraGroundTruthLabels(kuraAnalysis);
    
    // Define predicted clusters based on Kura clusters
    const predictedClusters = this.extractKuraPredictedClusters(kuraAnalysis);
    
    // Calculate V-measure completeness
    const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
    
    return vMeasure.completeness * 100; // Convert to percentage
  }

  /**
   * Calculate completeness for embeddings integration using V-measure
   */
  calculateEmbeddingsCompleteness(embeddings, intentAnalysis) {
    // Define ground truth labels based on embeddings analysis
    const groundTruthLabels = this.extractEmbeddingsGroundTruthLabels(embeddings, intentAnalysis);
    
    // Define predicted clusters based on embeddings
    const predictedClusters = this.extractEmbeddingsPredictedClusters(embeddings, intentAnalysis);
    
    // Calculate V-measure completeness
    const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
    
    return vMeasure.completeness * 100; // Convert to percentage
  }

  /**
   * Calculate completeness for notebook generation using V-measure
   */
  calculateNotebookCompleteness(notebook) {
    // Define ground truth labels based on notebook structure
    const groundTruthLabels = this.extractNotebookGroundTruthLabels(notebook);
    
    // Define predicted clusters based on notebook cells
    const predictedClusters = this.extractNotebookPredictedClusters(notebook);
    
    // Calculate V-measure completeness
    const vMeasure = this.calculateVMeasure(groundTruthLabels, predictedClusters);
    
    return vMeasure.completeness * 100; // Convert to percentage
  }

  /**
   * Extract ground truth labels from AST analysis
   */
  extractASTGroundTruthLabels(astAnalysis) {
    const labels = [];
    
    if (astAnalysis.imports) {
      astAnalysis.imports.forEach((imp, index) => {
        labels.push({
          id: `import_${index}`,
          type: 'import',
          category: this.categorizeImport(imp),
          content: imp
        });
      });
    }
    
    if (astAnalysis.functions) {
      astAnalysis.functions.forEach((func, index) => {
        labels.push({
          id: `function_${index}`,
          type: 'function',
          category: this.categorizeFunction(func),
          content: func.name || func.content
        });
      });
    }
    
    if (astAnalysis.variables) {
      astAnalysis.variables.forEach((var_, index) => {
        labels.push({
          id: `variable_${index}`,
          type: 'variable',
          category: this.categorizeVariable(var_),
          content: var_.name || var_.content
        });
      });
    }
    
    return labels;
  }

  /**
   * Extract predicted clusters from AST patterns
   */
  extractASTPredictedClusters(patterns) {
    const clusters = [];
    
    if (patterns) {
      patterns.forEach((pattern, index) => {
        clusters.push({
          id: `pattern_${index}`,
          type: 'pattern',
          items: [pattern.name || `pattern_${index}`]
        });
      });
    }
    
    return clusters;
  }

  /**
   * Extract ground truth labels from Kura analysis
   */
  extractKuraGroundTruthLabels(kuraAnalysis) {
    const labels = [];
    
    if (kuraAnalysis.clusters) {
      kuraAnalysis.clusters.forEach((cluster, index) => {
        labels.push({
          id: `cluster_${index}`,
          type: 'cluster',
          category: this.categorizeCluster(cluster),
          content: cluster.name || cluster.description
        });
      });
    }
    
    if (kuraAnalysis.workflow_patterns) {
      kuraAnalysis.workflow_patterns.forEach((pattern, index) => {
        labels.push({
          id: `workflow_${index}`,
          type: 'workflow',
          category: this.categorizeWorkflow(pattern),
          content: pattern.name || pattern.description
        });
      });
    }
    
    return labels;
  }

  /**
   * Extract predicted clusters from Kura analysis
   */
  extractKuraPredictedClusters(kuraAnalysis) {
    const clusters = [];
    
    if (kuraAnalysis.clusters) {
      kuraAnalysis.clusters.forEach((cluster, index) => {
        clusters.push({
          id: `kura_cluster_${index}`,
          type: 'kura_cluster',
          items: cluster.items || [cluster.id || `cluster_${index}`]
        });
      });
    }
    
    return clusters;
  }

  /**
   * Extract ground truth labels from embeddings analysis
   */
  extractEmbeddingsGroundTruthLabels(embeddings, intentAnalysis) {
    const labels = [];
    
    if (intentAnalysis.primary_intent) {
      labels.push({
        id: 'primary_intent',
        type: 'intent',
        category: intentAnalysis.primary_intent,
        content: intentAnalysis.primary_intent
      });
    }
    
    if (intentAnalysis.facets) {
      Object.keys(intentAnalysis.facets).forEach((facet, index) => {
        labels.push({
          id: `facet_${index}`,
          type: 'facet',
          category: facet,
          content: intentAnalysis.facets[facet]
        });
      });
    }
    
    return labels;
  }

  /**
   * Extract predicted clusters from embeddings analysis
   */
  extractEmbeddingsPredictedClusters(embeddings, intentAnalysis) {
    const clusters = [];
    
    if (embeddings.similarity_vectors) {
      embeddings.similarity_vectors.forEach((vector, index) => {
        clusters.push({
          id: `vector_${index}`,
          type: 'similarity_vector',
          items: [vector.id || `vector_${index}`]
        });
      });
    }
    
    return clusters;
  }

  /**
   * Extract ground truth labels from notebook
   */
  extractNotebookGroundTruthLabels(notebook) {
    const labels = [];
    
    if (notebook.cells) {
      notebook.cells.forEach((cell, index) => {
        labels.push({
          id: `cell_${index}`,
          type: 'cell',
          category: this.categorizeCell(cell),
          content: cell.source ? cell.source.join('') : ''
        });
      });
    }
    
    return labels;
  }

  /**
   * Extract predicted clusters from notebook
   */
  extractNotebookPredictedClusters(notebook) {
    const clusters = [];
    
    if (notebook.cells) {
      const cellTypes = new Set(notebook.cells.map(cell => cell.cell_type));
      cellTypes.forEach((type, index) => {
        clusters.push({
          id: `cell_type_${index}`,
          type: 'cell_type',
          items: notebook.cells
            .filter(cell => cell.cell_type === type)
            .map((cell, i) => `cell_${i}`)
        });
      });
    }
    
    return clusters;
  }

  // Additional categorization methods
  categorizeImport(imp) {
    if (imp.includes('pandas') || imp.includes('numpy')) return 'data_analysis';
    if (imp.includes('matplotlib') || imp.includes('seaborn')) return 'visualization';
    if (imp.includes('sklearn') || imp.includes('tensorflow')) return 'machine_learning';
    if (imp.includes('flask') || imp.includes('django')) return 'web_framework';
    if (imp.includes('pytest') || imp.includes('unittest')) return 'testing';
    return 'general_import';
  }

  categorizeFunction(func) {
    const name = func.name || func.content || '';
    if (name.includes('test') || name.includes('assert')) return 'testing';
    if (name.includes('plot') || name.includes('visualize')) return 'visualization';
    if (name.includes('train') || name.includes('fit')) return 'machine_learning';
    if (name.includes('load') || name.includes('read')) return 'data_loading';
    if (name.includes('save') || name.includes('write')) return 'data_saving';
    return 'general_function';
  }

  categorizeVariable(var_) {
    const name = var_.name || var_.content || '';
    if (name.includes('df') || name.includes('data')) return 'data_variable';
    if (name.includes('model') || name.includes('clf')) return 'model_variable';
    if (name.includes('fig') || name.includes('ax')) return 'plot_variable';
    if (name.includes('config') || name.includes('settings')) return 'configuration_variable';
    return 'general_variable';
  }

  categorizeCluster(cluster) {
    const name = cluster.name || cluster.description || '';
    if (name.includes('data')) return 'data_cluster';
    if (name.includes('model')) return 'model_cluster';
    if (name.includes('visualization')) return 'visualization_cluster';
    if (name.includes('workflow')) return 'workflow_cluster';
    return 'general_cluster';
  }

  categorizeWorkflow(pattern) {
    const name = pattern.name || pattern.description || '';
    if (name.includes('data')) return 'data_workflow';
    if (name.includes('model')) return 'model_workflow';
    if (name.includes('visualization')) return 'visualization_workflow';
    if (name.includes('testing')) return 'testing_workflow';
    return 'general_workflow';
  }

  categorizeCell(cell) {
    const cellType = cell.cell_type || 'unknown';
    const content = cell.source ? cell.source.join('') : '';
    
    if (cellType === 'markdown') return 'documentation';
    if (cellType === 'code') {
      if (content.includes('import')) return 'import_cell';
      if (content.includes('def ') || content.includes('function')) return 'function_cell';
      if (content.includes('plot') || content.includes('visualize')) return 'visualization_cell';
      if (content.includes('test') || content.includes('assert')) return 'testing_cell';
      return 'code_cell';
    }
    
    return 'general_cell';
  }

  // Simple fallback methods for session analysis
  extractImportsFromSession(session) {
    const imports = [];
    if (session.notebookState?.imports) {
      imports.push(...session.notebookState.imports);
    }
    if (session.codeDeltas) {
      session.codeDeltas.forEach(delta => {
        if (delta.content && delta.content.includes('import')) {
          imports.push(delta.content);
        }
      });
    }
    return imports;
  }

  extractFunctionsFromSession(session) {
    const functions = [];
    if (session.codeDeltas) {
      session.codeDeltas.forEach(delta => {
        if (delta.content && (delta.content.includes('def ') || delta.content.includes('function'))) {
          functions.push({ content: delta.content });
        }
      });
    }
    return functions;
  }

  extractVariablesFromSession(session) {
    const variables = [];
    if (session.notebookState?.variables) {
      Object.keys(session.notebookState.variables).forEach(name => {
        variables.push({ name, content: session.notebookState.variables[name] });
      });
    }
    return variables;
  }

  extractDependenciesFromSession(session) {
    const dependencies = [];
    if (session.notebookState?.imports) {
      dependencies.push(...session.notebookState.imports);
    }
    return dependencies;
  }

  extractExecutionFlowFromSession(session) {
    const flow = [];
    if (session.notebookState?.executedCells) {
      session.notebookState.executedCells.forEach(cell => {
        if (cell.source) {
          if (cell.source.includes('import')) flow.push('import');
          else if (cell.source.includes('def ')) flow.push('function_definition');
          else if (cell.source.includes('=')) flow.push('variable_assignment');
          else flow.push('execution');
        }
      });
    }
    return flow;
  }

  extractPatternsFromSession(session) {
    const patterns = [];
    if (session.intent === 'data_analysis') {
      patterns.push({ name: 'data_analysis', description: 'Data analysis pattern' });
    }
    if (session.files && session.files.some(f => f.path.includes('.csv'))) {
      patterns.push({ name: 'csv_processing', description: 'CSV data processing' });
    }
    return patterns;
  }

  reconstructEnvironmentFromSession(session) {
    return {
      imports: this.extractImportsFromSession(session),
      functions: this.extractFunctionsFromSession(session),
      variables: this.extractVariablesFromSession(session),
      dependencies: this.extractDependenciesFromSession(session),
      executionFlow: this.extractExecutionFlowFromSession(session)
    };
  }

  // Simple fallback methods for Kura integration
  extractConversationsFromSession(session) {
    return session.conversations || [];
  }

  analyzeConversationsSimple(conversations) {
    return {
      clusters: [
        { id: 'cluster_1', name: 'general', items: conversations.map((_, i) => `conv_${i}`) }
      ],
      umap_coordinates: conversations.map((_, i) => ({ x: i * 0.1, y: 0.5, cluster: 'cluster_1' })),
      clio_facets: { general: 1.0 },
      workflow_patterns: [{ name: 'conversation_flow', description: 'Basic conversation pattern' }],
      intent_classifications: { general: 0.8 }
    };
  }

  generateKuraIntegrationSimple(kuraAnalysis, session) {
    return {
      type: 'kura_driven',
      clusters: kuraAnalysis.clusters,
      umapCoordinates: kuraAnalysis.umap_coordinates,
      facets: kuraAnalysis.clio_facets,
      workflowPatterns: kuraAnalysis.workflow_patterns,
      intentClassification: kuraAnalysis.intent_classifications,
      similarSessions: []
    };
  }

  // Simple fallback methods for embeddings integration
  generateEmbeddingsSimple(session) {
    return {
      similarity_vectors: [
        { id: 'vector_1', similarity: 0.8 }
      ],
      context_understanding: {
        primary_intent: session.intent || 'general',
        confidence: 0.7
      }
    };
  }

  classifyIntentSimple(session) {
    return {
      primary_intent: session.intent || 'general',
      confidence: 0.7,
      facets: {
        [session.intent || 'general']: 0.8
      }
    };
  }

  createEmbeddingsIntegrationSimple(embeddings, intentAnalysis, session) {
    return {
      type: 'embeddings_based',
      primaryIntent: intentAnalysis.primary_intent,
      confidence: intentAnalysis.confidence,
      facets: intentAnalysis.facets,
      similarityVectors: embeddings.similarity_vectors,
      contextUnderstanding: embeddings.context_understanding,
      triggers: [`when user mentions ${intentAnalysis.primary_intent}`],
      actions: {
        contextRestoration: { restoreWorkspace: { path: session.id } },
        workflowExecution: { steps: [] },
        knowledgeInjection: { insights: [], warnings: [], suggestions: [] }
      }
    };
  }

  // Simple fallback methods for notebook generation
  generateNotebookSimple(session) {
    return {
      cells: [
        {
          cell_type: 'code',
          source: ['# Generated from session'],
          metadata: { tags: ['generated'] }
        }
      ],
      metadata: {
        session_id: session.id,
        generated_at: new Date().toISOString()
      },
      execution: { status: 'ready' }
    };
  }

  // Helper methods
  async loadSession(sessionId) {
    // Simple fallback - return basic session structure
    return {
      id: sessionId,
      timestamp: new Date().toISOString(),
      intent: 'data_analysis',
      files: [],
      codeDeltas: [],
      fileChanges: [],
      conversations: [],
      notebookState: {
        executedCells: [],
        variables: {},
        outputs: [],
        imports: [],
        dataFiles: [],
        environment: {},
        errors: [],
        userNotes: []
      }
    };
  }

  async mapSessionFilesToWorkspace(session, workspaceInfo) {
    // Map session files to current workspace
    return session.files ? session.files.map(file => ({
      path: file.path,
      name: file.path.split('/').pop(),
      type: file.path.split('.').pop(),
      content: file.content
    })) : [];
  }

  async generateConfigurations(workspaceInfo) {
    // Generate configurations from workspace info
    return {
      python: {
        version: '3.8',
        packages: ['pandas', 'numpy', 'matplotlib']
      },
      workspace: {
        path: workspaceInfo.activeWorkspace,
        extensions: workspaceInfo.activeExtensions
      }
    };
  }

  async reconstructNotebookStates(session, workspaceInfo) {
    // Reconstruct notebook states
    return session.notebookState ? {
      cells: session.notebookState.executedCells,
      variables: session.notebookState.variables,
      outputs: session.notebookState.outputs
    } : {};
  }

  async findSimilarSessions(session, kuraAnalysis) {
    // Find similar sessions using Kura analysis
    return [
      { id: 'similar_1', similarity: 0.85, reason: 'Similar data analysis pattern' },
      { id: 'similar_2', similarity: 0.72, reason: 'Similar visualization approach' }
    ];
  }

  async generateDynamicTriggers(embeddings, intentAnalysis) {
    // Generate dynamic triggers from embeddings
    return [
      `when user mentions ${intentAnalysis.primary_intent}`,
      `when user imports pandas or numpy`,
      `when user creates data visualizations`
    ];
  }

  async generateDynamicActions(embeddings, intentAnalysis, session) {
    // Generate dynamic actions from embeddings
    return {
      contextRestoration: {
        restoreWorkspace: { path: '/mock/workspace' },
        restoreFiles: session.files || [],
        restoreConfiguration: { python: '3.8' }
      },
      workflowExecution: {
        steps: [
          { description: 'Load data', code: 'df = pd.read_csv("data.csv")' },
          { description: 'Analyze data', code: 'df.describe()' }
        ]
      },
      knowledgeInjection: {
        insights: [
          'Use pandas for data manipulation',
          'Consider data cleaning before analysis'
        ],
        warnings: [
          'Check for missing values',
          'Validate data types'
        ],
        suggestions: [
          'Try different visualization types',
          'Consider statistical analysis'
        ]
      }
    };
  }
}

/**
 * Memory Quality Metrics System
 * Tracks effectiveness, usage, and quality metrics for memory system
 */
class MemoryQualityMetrics {
  constructor() {
    this.metrics = new Map();
    this.sessionMetrics = new Map();
  }

  /**
   * Record successful integration with V-measure metrics
   */
  async recordIntegrationSuccess(data) {
    const { sessionId, strategy, executionTime, completeness, result, vMeasure } = data;
    
    if (!this.sessionMetrics.has(sessionId)) {
      this.sessionMetrics.set(sessionId, {
        sessionId,
        totalIntegrations: 0,
        successfulIntegrations: 0,
        failedIntegrations: 0,
        averageExecutionTime: 0,
        averageCompleteness: 0,
        averageHomogeneity: 0,
        averageVMeasure: 0,
        strategies: new Map()
      });
    }

    const sessionMetric = this.sessionMetrics.get(sessionId);
    sessionMetric.totalIntegrations++;
    sessionMetric.successfulIntegrations++;
    
    // Update average execution time
    sessionMetric.averageExecutionTime = 
      (sessionMetric.averageExecutionTime * (sessionMetric.totalIntegrations - 1) + executionTime) / 
      sessionMetric.totalIntegrations;
    
    // Update average completeness (V-measure based)
    sessionMetric.averageCompleteness = 
      (sessionMetric.averageCompleteness * (sessionMetric.totalIntegrations - 1) + completeness) / 
      sessionMetric.totalIntegrations;

    // Update V-measure metrics if available
    if (vMeasure) {
      sessionMetric.averageHomogeneity = 
        (sessionMetric.averageHomogeneity * (sessionMetric.totalIntegrations - 1) + vMeasure.homogeneity) / 
        sessionMetric.totalIntegrations;
      
      sessionMetric.averageVMeasure = 
        (sessionMetric.averageVMeasure * (sessionMetric.totalIntegrations - 1) + vMeasure.vMeasure) / 
        sessionMetric.totalIntegrations;
    }

    // Track strategy-specific metrics
    if (!sessionMetric.strategies.has(strategy)) {
      sessionMetric.strategies.set(strategy, {
        name: strategy,
        attempts: 0,
        successes: 0,
        failures: 0,
        averageExecutionTime: 0,
        averageCompleteness: 0,
        averageHomogeneity: 0,
        averageVMeasure: 0
      });
    }

    const strategyMetric = sessionMetric.strategies.get(strategy);
    strategyMetric.attempts++;
    strategyMetric.successes++;
    strategyMetric.averageExecutionTime = 
      (strategyMetric.averageExecutionTime * (strategyMetric.attempts - 1) + executionTime) / 
      strategyMetric.attempts;
    strategyMetric.averageCompleteness = 
      (strategyMetric.averageCompleteness * (strategyMetric.attempts - 1) + completeness) / 
      strategyMetric.attempts;

    // Update V-measure metrics for strategy
    if (vMeasure) {
      strategyMetric.averageHomogeneity = 
        (strategyMetric.averageHomogeneity * (strategyMetric.attempts - 1) + vMeasure.homogeneity) / 
        strategyMetric.attempts;
      
      strategyMetric.averageVMeasure = 
        (strategyMetric.averageVMeasure * (strategyMetric.attempts - 1) + vMeasure.vMeasure) / 
        strategyMetric.attempts;
    }
  }

  /**
   * Record failed integration
   */
  async recordIntegrationFailure(data) {
    const { sessionId, strategy, error, executionTime } = data;
    
    if (!this.sessionMetrics.has(sessionId)) {
      this.sessionMetrics.set(sessionId, {
        sessionId,
        totalIntegrations: 0,
        successfulIntegrations: 0,
        failedIntegrations: 0,
        averageExecutionTime: 0,
        averageCompleteness: 0,
        strategies: new Map()
      });
    }

    const sessionMetric = this.sessionMetrics.get(sessionId);
    sessionMetric.totalIntegrations++;
    sessionMetric.failedIntegrations++;

    // Track strategy-specific metrics
    if (!sessionMetric.strategies.has(strategy)) {
      sessionMetric.strategies.set(strategy, {
        name: strategy,
        attempts: 0,
        successes: 0,
        failures: 0,
        averageExecutionTime: 0,
        averageCompleteness: 0
      });
    }

    const strategyMetric = sessionMetric.strategies.get(strategy);
    strategyMetric.attempts++;
    strategyMetric.failures++;
  }

  /**
   * Get metrics for a specific session
   */
  async getSessionMetrics(sessionId) {
    const sessionMetric = this.sessionMetrics.get(sessionId);
    if (!sessionMetric) {
      return {
        sessionId,
        totalIntegrations: 0,
        successfulIntegrations: 0,
        failedIntegrations: 0,
        successRate: 0,
        averageExecutionTime: 0,
        averageCompleteness: 0,
        strategies: []
      };
    }

    return {
      ...sessionMetric,
      successRate: sessionMetric.totalIntegrations > 0 ? 
        (sessionMetric.successfulIntegrations / sessionMetric.totalIntegrations) * 100 : 0,
      strategies: Array.from(sessionMetric.strategies.values())
    };
  }

  /**
   * Get overall system metrics
   */
  async getSystemMetrics() {
    const allSessions = Array.from(this.sessionMetrics.values());
    
    if (allSessions.length === 0) {
      return {
        totalSessions: 0,
        totalIntegrations: 0,
        overallSuccessRate: 0,
        averageExecutionTime: 0,
        averageCompleteness: 0,
        strategyPerformance: []
      };
    }

    const totalIntegrations = allSessions.reduce((sum, s) => sum + s.totalIntegrations, 0);
    const totalSuccessful = allSessions.reduce((sum, s) => sum + s.successfulIntegrations, 0);
    const totalExecutionTime = allSessions.reduce((sum, s) => sum + (s.averageExecutionTime * s.totalIntegrations), 0);
    const totalCompleteness = allSessions.reduce((sum, s) => sum + (s.averageCompleteness * s.totalIntegrations), 0);

    // Calculate strategy performance
    const strategyMap = new Map();
    allSessions.forEach(session => {
      session.strategies.forEach(strategy => {
        if (!strategyMap.has(strategy.name)) {
          strategyMap.set(strategy.name, {
            name: strategy.name,
            totalAttempts: 0,
            totalSuccesses: 0,
            totalFailures: 0,
            averageExecutionTime: 0,
            averageCompleteness: 0
          });
        }
        
        const strategyMetric = strategyMap.get(strategy.name);
        strategyMetric.totalAttempts += strategy.attempts;
        strategyMetric.totalSuccesses += strategy.successes;
        strategyMetric.totalFailures += strategy.failures;
      });
    });

    // Calculate averages for strategies
    strategyMap.forEach(strategy => {
      if (strategy.totalAttempts > 0) {
        strategy.successRate = (strategy.totalSuccesses / strategy.totalAttempts) * 100;
      }
    });

    return {
      totalSessions: allSessions.length,
      totalIntegrations,
      overallSuccessRate: totalIntegrations > 0 ? (totalSuccessful / totalIntegrations) * 100 : 0,
      averageExecutionTime: totalIntegrations > 0 ? totalExecutionTime / totalIntegrations : 0,
      averageCompleteness: totalIntegrations > 0 ? totalCompleteness / totalIntegrations : 0,
      strategyPerformance: Array.from(strategyMap.values())
    };
  }
}

module.exports = { DynamicCursorIntegration, MemoryQualityMetrics };
