const fs = require('fs');
const path = require('path');

/**
 * High-Dimensional Embeddings-Based Intent Classification System
 * Uses semantic embeddings and multi-faceted analysis to replace hardcoded intents
 * Integrates with Clio for sophisticated conversation analysis
 * Enhanced with procedural clustering capabilities
 */
class EmbeddingsIntentClassifier {
  constructor(clioIntentService = null) {
    this.clioIntentService = clioIntentService;
    this.embeddingDimensions = 512; // High-dimensional embeddings
    this.facetDimensions = 24; // Multi-faceted analysis
    this.proceduralDimensions = 128; // Procedural action embeddings
    
    // Initialize semantic intent facets (replaces hardcoded categories)
    this.semanticFacets = this.initializeSemanticFacets();
    
    // Initialize procedural facets for action clustering
    this.proceduralFacets = this.initializeProceduralFacets();
    
    // Initialize embeddings vocabulary
    this.embeddingsVocabulary = this.initializeEmbeddingsVocabulary();
    
    // Initialize procedural action vocabulary
    this.actionVocabulary = this.initializeActionVocabulary();
    
    // Initialize facet weights for multi-dimensional analysis
    this.facetWeights = this.initializeFacetWeights();
    
    // Initialize procedural weights
    this.proceduralWeights = this.initializeProceduralWeights();
  }

  /**
   * Initialize high-dimensional semantic facets
   */
  initializeSemanticFacets() {
    return {
      // Cognitive Load Facets
      cognitive_complexity: {
        name: 'Cognitive Complexity',
        dimensions: ['low', 'medium', 'high', 'expert'],
        indicators: ['simple_operations', 'multi_step_processes', 'complex_algorithms', 'research_level']
      },
      
      // Workflow Pattern Facets
      workflow_pattern: {
        name: 'Workflow Pattern',
        dimensions: ['exploratory', 'iterative', 'systematic', 'experimental'],
        indicators: ['data_exploration', 'model_development', 'testing_validation', 'research_inquiry']
      },
      
      // Domain Expertise Facets
      domain_expertise: {
        name: 'Domain Expertise',
        dimensions: ['beginner', 'intermediate', 'advanced', 'expert'],
        indicators: ['basic_operations', 'intermediate_concepts', 'advanced_techniques', 'cutting_edge']
      },
      
      // Problem-Solving Approach Facets
      problem_solving: {
        name: 'Problem-Solving Approach',
        dimensions: ['analytical', 'creative', 'systematic', 'experimental'],
        indicators: ['logical_analysis', 'creative_solutions', 'methodical_approach', 'hypothesis_testing']
      },
      
      // Data Interaction Facets
      data_interaction: {
        name: 'Data Interaction',
        dimensions: ['consumption', 'transformation', 'analysis', 'modeling'],
        indicators: ['data_reading', 'data_cleaning', 'statistical_analysis', 'ml_modeling']
      },
      
      // Communication Style Facets
      communication_style: {
        name: 'Communication Style',
        dimensions: ['technical', 'explanatory', 'collaborative', 'documentation'],
        indicators: ['code_focused', 'explanation_heavy', 'team_oriented', 'documentation_rich']
      },
      
      // Temporal Pattern Facets
      temporal_pattern: {
        name: 'Temporal Pattern',
        dimensions: ['burst', 'sustained', 'exploratory', 'focused'],
        indicators: ['short_intense', 'long_steady', 'open_ended', 'goal_directed']
      },
      
      // Tool Usage Facets
      tool_usage: {
        name: 'Tool Usage',
        dimensions: ['basic', 'intermediate', 'advanced', 'cutting_edge'],
        indicators: ['standard_libraries', 'specialized_tools', 'advanced_frameworks', 'research_tools']
      }
    };
  }

  /**
   * Initialize procedural facets for action clustering
   */
  initializeProceduralFacets() {
    return {
      // Action Type Facets
      action_type: {
        name: 'Action Type',
        dimensions: ['create', 'modify', 'analyze', 'test', 'debug', 'refactor', 'document', 'optimize'],
        indicators: ['add_new_code', 'change_existing', 'examine_data', 'validate_functionality', 'fix_issues', 'improve_structure', 'explain_code', 'enhance_performance']
      },
      
      // Procedural Complexity Facets
      procedural_complexity: {
        name: 'Procedural Complexity',
        dimensions: ['single_action', 'action_sequence', 'multi_step_process', 'complex_workflow'],
        indicators: ['one_step', 'few_steps', 'many_steps', 'orchestrated_workflow']
      },
      
      // Goal Hierarchy Facets
      goal_hierarchy: {
        name: 'Goal Hierarchy',
        dimensions: ['immediate_task', 'feature_development', 'system_improvement', 'project_goal'],
        indicators: ['quick_fix', 'new_feature', 'architecture_change', 'long_term_objective']
      },
      
      // Temporal Pattern Facets
      temporal_pattern: {
        name: 'Temporal Pattern',
        dimensions: ['immediate', 'iterative', 'sequential', 'parallel'],
        indicators: ['instant_result', 'repeated_actions', 'step_by_step', 'concurrent_work']
      },
      
      // Workflow Stage Facets
      workflow_stage: {
        name: 'Workflow Stage',
        dimensions: ['planning', 'implementation', 'testing', 'deployment', 'maintenance'],
        indicators: ['design_phase', 'coding_phase', 'validation_phase', 'release_phase', 'support_phase']
      }
    };
  }

  /**
   * Initialize action vocabulary for procedural analysis
   */
  initializeActionVocabulary() {
    return {
      // Common action verbs in programming contexts
      action_verbs: [
        'add', 'create', 'implement', 'build', 'develop',
        'modify', 'change', 'update', 'edit', 'adjust',
        'fix', 'debug', 'resolve', 'correct', 'repair',
        'test', 'validate', 'verify', 'check', 'examine',
        'refactor', 'optimize', 'improve', 'enhance', 'restructure',
        'document', 'explain', 'describe', 'comment', 'annotate',
        'analyze', 'investigate', 'explore', 'research', 'study',
        'deploy', 'release', 'publish', 'distribute', 'ship',
        'configure', 'setup', 'install', 'initialize', 'prepare'
      ],
      
      // Common objects/targets of actions
      action_objects: [
        'function', 'class', 'method', 'variable', 'constant',
        'file', 'directory', 'module', 'package', 'library',
        'database', 'table', 'query', 'schema', 'migration',
        'api', 'endpoint', 'route', 'controller', 'service',
        'test', 'spec', 'case', 'suite', 'framework',
        'config', 'settings', 'environment', 'deployment', 'infrastructure',
        'documentation', 'readme', 'guide', 'tutorial', 'example',
        'error', 'bug', 'issue', 'exception', 'warning'
      ],
      
      // Procedural patterns
      procedural_patterns: [
        'create_then_test', 'analyze_then_fix', 'plan_then_implement',
        'iterate_and_improve', 'explore_then_build', 'debug_then_optimize',
        'document_then_deploy', 'validate_then_release', 'refactor_then_enhance'
      ]
    };
  }

  /**
   * Initialize procedural weights for multi-dimensional analysis
   */
  initializeProceduralWeights() {
    return {
      action_type: 0.25,
      procedural_complexity: 0.20,
      goal_hierarchy: 0.20,
      temporal_pattern: 0.15,
      workflow_stage: 0.20
    };
  }

  /**
   * Initialize embeddings vocabulary for semantic analysis
   */
  initializeEmbeddingsVocabulary() {
    return {
      // Code semantic embeddings
      code_semantics: {
        data_operations: ['pandas', 'numpy', 'dataframe', 'array', 'matrix', 'tensor'],
        visualization: ['matplotlib', 'seaborn', 'plotly', 'chart', 'graph', 'plot'],
        machine_learning: ['sklearn', 'tensorflow', 'pytorch', 'model', 'algorithm', 'training'],
        analysis: ['statistics', 'correlation', 'regression', 'classification', 'clustering'],
        debugging: ['error', 'exception', 'traceback', 'debug', 'fix', 'troubleshoot'],
        optimization: ['performance', 'efficiency', 'speed', 'memory', 'optimize', 'refactor']
      },
      
      // Conversation semantic embeddings
      conversation_semantics: {
        exploration: ['explore', 'investigate', 'analyze', 'understand', 'discover', 'examine'],
        implementation: ['implement', 'build', 'create', 'develop', 'construct', 'design'],
        problem_solving: ['solve', 'fix', 'resolve', 'address', 'tackle', 'handle'],
        learning: ['learn', 'understand', 'study', 'research', 'investigate', 'explore'],
        collaboration: ['help', 'assist', 'support', 'guide', 'explain', 'clarify'],
        documentation: ['document', 'explain', 'describe', 'note', 'comment', 'record']
      },
      
      // Context semantic embeddings
      context_semantics: {
        urgency: ['urgent', 'asap', 'quickly', 'immediately', 'deadline', 'priority'],
        complexity: ['complex', 'complicated', 'difficult', 'challenging', 'advanced', 'sophisticated'],
        scope: ['small', 'large', 'comprehensive', 'detailed', 'overview', 'summary'],
        domain: ['data_science', 'machine_learning', 'statistics', 'research', 'business', 'academic']
      }
    };
  }

  /**
   * Initialize facet weights for multi-dimensional analysis
   */
  initializeFacetWeights() {
    return {
      cognitive_complexity: 0.15,
      workflow_pattern: 0.20,
      domain_expertise: 0.12,
      problem_solving: 0.18,
      data_interaction: 0.15,
      communication_style: 0.08,
      temporal_pattern: 0.07,
      tool_usage: 0.05
    };
  }

  /**
   * Generate high-dimensional embeddings for code content
   */
  generateCodeEmbeddings(codeContent, fileName = '') {
    if (!codeContent || typeof codeContent !== 'string') {
      return this.getDefaultEmbeddings();
    }

    const embeddings = new Array(this.embeddingDimensions).fill(0);
    const words = codeContent.toLowerCase().split(/\s+/);
    
    // Semantic analysis of code content
    Object.entries(this.embeddingsVocabulary.code_semantics).forEach(([category, terms], categoryIndex) => {
      const categoryWeight = 1.0 / Object.keys(this.embeddingsVocabulary.code_semantics).length;
      
      terms.forEach(term => {
        const termCount = words.filter(word => word.includes(term)).length;
        if (termCount > 0) {
          const embeddingIndex = (categoryIndex * 64 + term.length) % this.embeddingDimensions;
          embeddings[embeddingIndex] += termCount * categoryWeight;
        }
      });
    });

    // File extension analysis
    const ext = path.extname(fileName).toLowerCase();
    const extEmbeddingIndex = ext.charCodeAt(0) % this.embeddingDimensions;
    embeddings[extEmbeddingIndex] += 0.5;

    // Normalize embeddings
    const magnitude = Math.sqrt(embeddings.reduce((sum, val) => sum + val * val, 0));
    return embeddings.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Generate high-dimensional embeddings for conversation content
   */
  generateConversationEmbeddings(conversations) {
    if (!conversations || conversations.length === 0) {
      return this.getDefaultEmbeddings();
    }

    const embeddings = new Array(this.embeddingDimensions).fill(0);
    
    conversations.forEach(conversation => {
      const userMessage = (conversation.userMessage || '').toLowerCase();
      const assistantResponse = (conversation.assistantResponse || '').toLowerCase();
      const combinedText = `${userMessage} ${assistantResponse}`;
      const words = combinedText.split(/\s+/);

      // Semantic analysis of conversation content
      Object.entries(this.embeddingsVocabulary.conversation_semantics).forEach(([category, terms], categoryIndex) => {
        const categoryWeight = 1.0 / Object.keys(this.embeddingsVocabulary.conversation_semantics).length;
        
        terms.forEach(term => {
          const termCount = words.filter(word => word.includes(term)).length;
          if (termCount > 0) {
            const embeddingIndex = (categoryIndex * 64 + term.length + 256) % this.embeddingDimensions;
            embeddings[embeddingIndex] += termCount * categoryWeight;
          }
        });
      });
    });

    // Normalize embeddings
    const magnitude = Math.sqrt(embeddings.reduce((sum, val) => sum + val * val, 0));
    return embeddings.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Calculate multi-faceted intent scores
   */
  calculateFacetedIntentScores(codeEmbeddings, conversationEmbeddings, session) {
    const facetScores = {};
    
    Object.entries(this.semanticFacets).forEach(([facetName, facet]) => {
      const scores = {};
      
      facet.dimensions.forEach((dimension, index) => {
        // Calculate dimension score based on embeddings similarity
        const dimensionEmbedding = this.generateDimensionEmbedding(facetName, dimension);
        const codeSimilarity = this.calculateCosineSimilarity(codeEmbeddings, dimensionEmbedding);
        const conversationSimilarity = this.calculateCosineSimilarity(conversationEmbeddings, dimensionEmbedding);
        
        // Weighted combination of code and conversation similarities
        const combinedSimilarity = (codeSimilarity * 0.6) + (conversationSimilarity * 0.4);
        
        // Apply session-specific adjustments
        const adjustedScore = this.applySessionAdjustments(combinedSimilarity, session, facetName, dimension);
        
        scores[dimension] = Math.max(0, Math.min(1, adjustedScore));
      });
      
      facetScores[facetName] = {
        scores: scores,
        primary: this.selectPrimaryDimension(scores),
        confidence: this.calculateFacetConfidence(scores),
        weight: this.facetWeights[facetName] || 0.1
      };
    });
    
    return facetScores;
  }

  /**
   * Generate embedding for a specific dimension
   */
  generateDimensionEmbedding(facetName, dimension) {
    const embedding = new Array(this.embeddingDimensions).fill(0);
    
    // Create deterministic embedding based on facet and dimension
    const hash = this.hashString(`${facetName}_${dimension}`);
    
    // Distribute hash across embedding dimensions
    for (let i = 0; i < this.embeddingDimensions; i++) {
      const hashComponent = (hash + i * 31) % 1000;
      embedding[i] = Math.sin(hashComponent * 0.01) * 0.5;
    }
    
    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  calculateCosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) return 0;
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Apply session-specific adjustments to scores
   */
  applySessionAdjustments(baseScore, session, facetName, dimension) {
    let adjustment = 0;
    
    // Adjust based on session characteristics
    if (session.codeDeltas && session.codeDeltas.length > 0) {
      const codeComplexity = session.codeDeltas.length;
      if (facetName === 'cognitive_complexity') {
        adjustment += (codeComplexity - 5) * 0.05; // More changes = higher complexity
      }
    }
    
    if (session.duration) {
      const durationHours = session.duration / (1000 * 60 * 60);
      if (facetName === 'temporal_pattern') {
        if (durationHours < 1) adjustment += 0.2; // Short = burst
        else if (durationHours > 4) adjustment += 0.1; // Long = sustained
      }
    }
    
    return baseScore + adjustment;
  }

  /**
   * Select primary dimension from scores
   */
  selectPrimaryDimension(scores) {
    return Object.entries(scores).reduce((max, [dimension, score]) => 
      score > max.score ? { dimension, score } : max, 
      { dimension: 'unknown', score: 0 }
    );
  }

  /**
   * Calculate confidence for a facet
   */
  calculateFacetConfidence(scores) {
    const values = Object.values(scores);
    const max = Math.max(...values);
    const secondMax = values.sort((a, b) => b - a)[1] || 0;
    return max - secondMax; // Higher difference = higher confidence
  }

  /**
   * Generate comprehensive intent classification with procedural analysis
   */
  async classifyIntent(session, conversations = []) {
    try {
      // Generate semantic embeddings
      const codeContent = session.codeDeltas ? 
        session.codeDeltas.map(d => d.afterContent).join('\n') : '';
      const codeEmbeddings = this.generateCodeEmbeddings(codeContent, session.currentFile);
      const conversationEmbeddings = this.generateConversationEmbeddings(conversations);
      
      // Calculate semantic faceted scores
      const facetScores = this.calculateFacetedIntentScores(codeEmbeddings, conversationEmbeddings, session);
      
      // NEW: Generate procedural analysis
      const proceduralAnalysis = await this.analyzeProceduralPatterns(session, conversations);
      
      // Generate overall intent profile
      const intentProfile = this.generateIntentProfile(facetScores);
      
      // Generate procedural profile
      const proceduralProfile = this.generateProceduralProfile(proceduralAnalysis);
      
      // Integrate with Clio if available
      let clioEnhancement = null;
      if (this.clioIntentService) {
        clioEnhancement = await this.clioIntentService.classifyIntentWithClio(session, conversations);
      }
      
      return {
        primary_intent: intentProfile.primary,
        confidence: intentProfile.confidence,
        embeddings: {
          code: codeEmbeddings,
          conversation: conversationEmbeddings,
          actions: proceduralAnalysis.actionEmbeddings,
          procedures: proceduralAnalysis.procedureEmbeddings,
          goals: proceduralAnalysis.goalEmbeddings,
          dimensions: this.embeddingDimensions,
          procedural_dimensions: this.proceduralDimensions
        },
        facets: facetScores,
        procedural_facets: proceduralAnalysis.proceduralFacets,
        profile: intentProfile,
        procedural_profile: proceduralProfile,
        procedural_analysis: proceduralAnalysis,
        clio_enhancement: clioEnhancement,
        analysis_timestamp: new Date().toISOString(),
        methodology: 'embeddings_based_multi_faceted_with_procedural_clustering'
      };
      
    } catch (error) {
      console.error('Error in embeddings-based intent classification:', error);
      return this.getDefaultIntent();
    }
  }

  /**
   * Generate overall intent profile from facet scores
   */
  generateIntentProfile(facetScores) {
    const profile = {
      primary: 'unknown',
      confidence: 0,
      characteristics: [],
      complexity_level: 'medium',
      workflow_type: 'mixed',
      expertise_level: 'intermediate'
    };
    
    // Determine primary characteristics
    Object.entries(facetScores).forEach(([facetName, facet]) => {
      if (facet.confidence > 0.3) {
        profile.characteristics.push({
          facet: facetName,
          dimension: facet.primary.dimension,
          confidence: facet.confidence,
          weight: facet.weight
        });
      }
    });
    
    // Determine overall profile
    if (facetScores.cognitive_complexity) {
      profile.complexity_level = facetScores.cognitive_complexity.primary.dimension;
    }
    
    if (facetScores.workflow_pattern) {
      profile.workflow_type = facetScores.workflow_pattern.primary.dimension;
    }
    
    if (facetScores.domain_expertise) {
      profile.expertise_level = facetScores.domain_expertise.primary.dimension;
    }
    
    // Generate primary intent from characteristics
    profile.primary = this.generatePrimaryIntentFromCharacteristics(profile.characteristics);
    profile.confidence = this.calculateOverallConfidence(facetScores);
    
    return profile;
  }

  /**
   * Generate primary intent from characteristics
   */
  generatePrimaryIntentFromCharacteristics(characteristics) {
    const intentMap = {
      'exploratory': 'data_exploration',
      'iterative': 'model_development',
      'systematic': 'analysis_workflow',
      'experimental': 'research_inquiry',
      'analytical': 'statistical_analysis',
      'creative': 'solution_design',
      'consumption': 'data_ingestion',
      'transformation': 'data_processing',
      'analysis': 'data_analysis',
      'modeling': 'ml_modeling'
    };
    
    // Find the most confident characteristic
    const primaryCharacteristic = characteristics.reduce((max, char) => 
      char.confidence > max.confidence ? char : max, 
      { confidence: 0, dimension: 'unknown' }
    );
    
    return intentMap[primaryCharacteristic.dimension] || 'general_development';
  }

  /**
   * Calculate overall confidence
   */
  calculateOverallConfidence(facetScores) {
    const weightedConfidence = Object.entries(facetScores).reduce((sum, [facetName, facet]) => {
      return sum + (facet.confidence * facet.weight);
    }, 0);
    
    const totalWeight = Object.values(this.facetWeights).reduce((sum, weight) => sum + weight, 0);
    return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
  }

  /**
   * Get default embeddings
   */
  getDefaultEmbeddings() {
    return new Array(this.embeddingDimensions).fill(0);
  }

  /**
   * Get default intent
   */
  getDefaultIntent() {
    return {
      primary_intent: 'unknown',
      confidence: 0,
      embeddings: {
        code: this.getDefaultEmbeddings(),
        conversation: this.getDefaultEmbeddings(),
        dimensions: this.embeddingDimensions
      },
      facets: {},
      profile: {
        primary: 'unknown',
        confidence: 0,
        characteristics: [],
        complexity_level: 'medium',
        workflow_type: 'mixed',
        expertise_level: 'intermediate'
      },
      clio_enhancement: null,
      analysis_timestamp: new Date().toISOString(),
      methodology: 'embeddings_based_multi_faceted'
    };
  }

  /**
   * Hash string for deterministic embedding generation
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Analyze procedural patterns in session and conversations
   */
  async analyzeProceduralPatterns(session, conversations) {
    try {
      // Extract actions from prompts and code changes
      const actions = this.extractActions(session, conversations);
      
      // Identify action sequences
      const sequences = this.identifyActionSequences(actions);
      
      // Infer higher-level goals
      const goals = this.inferGoals(sequences, session);
      
      // Generate procedural embeddings
      const actionEmbeddings = this.generateActionEmbeddings(actions);
      const procedureEmbeddings = this.generateProcedureEmbeddings(sequences);
      const goalEmbeddings = this.generateGoalEmbeddings(goals);
      
      // Calculate procedural facet scores
      const proceduralFacets = this.calculateProceduralFacetScores(actions, sequences, goals);
      
      return {
        actions,
        sequences,
        goals,
        actionEmbeddings,
        procedureEmbeddings,
        goalEmbeddings,
        proceduralFacets
      };
    } catch (error) {
      console.error('Error in procedural pattern analysis:', error);
      return this.getDefaultProceduralAnalysis();
    }
  }

  /**
   * Extract actions from session and conversations
   */
  extractActions(session, conversations) {
    const actions = [];
    
    // Extract actions from conversations
    conversations.forEach(conversation => {
      if (conversation.messages) {
        conversation.messages.forEach(message => {
          if (message.role === 'user' && message.content) {
            const extractedActions = this.parseActionsFromPrompt(message.content);
            actions.push(...extractedActions);
          }
        });
      }
    });
    
    // Extract actions from code changes
    if (session.codeDeltas) {
      session.codeDeltas.forEach(delta => {
        const codeActions = this.parseActionsFromCodeChange(delta);
        actions.push(...codeActions);
      });
    }
    
    // Extract actions from file changes
    if (session.fileChanges) {
      session.fileChanges.forEach(change => {
        const fileActions = this.parseActionsFromFileChange(change);
        actions.push(...fileActions);
      });
    }
    
    return actions;
  }

  /**
   * Parse actions from user prompts
   */
  parseActionsFromPrompt(promptContent) {
    const actions = [];
    const content = promptContent.toLowerCase();
    
    // Action verb patterns
    const actionPatterns = [
      { pattern: /(add|create|implement)\s+(\w+)/g, type: 'create' },
      { pattern: /(fix|debug|resolve)\s+(\w+)/g, type: 'fix' },
      { pattern: /(refactor|optimize|improve)\s+(\w+)/g, type: 'refactor' },
      { pattern: /(test|validate|verify)\s+(\w+)/g, type: 'test' },
      { pattern: /(document|explain|describe)\s+(\w+)/g, type: 'document' },
      { pattern: /(analyze|investigate|examine)\s+(\w+)/g, type: 'analyze' },
      { pattern: /(deploy|release|publish)\s+(\w+)/g, type: 'deploy' }
    ];
    
    actionPatterns.forEach(({ pattern, type }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        actions.push({
          action: type,
          object: match[2],
          context: promptContent,
          timestamp: new Date().toISOString(),
          source: 'prompt'
        });
      }
    });
    
    return actions;
  }

  /**
   * Parse actions from code changes
   */
  parseActionsFromCodeChange(delta) {
    const actions = [];
    
    if (delta.afterContent && !delta.beforeContent) {
      actions.push({
        action: 'create',
        object: 'code',
        context: delta.afterContent.substring(0, 100),
        timestamp: delta.timestamp || new Date().toISOString(),
        source: 'code_change'
      });
    } else if (delta.beforeContent && delta.afterContent) {
      actions.push({
        action: 'modify',
        object: 'code',
        context: delta.afterContent.substring(0, 100),
        timestamp: delta.timestamp || new Date().toISOString(),
        source: 'code_change'
      });
    }
    
    return actions;
  }

  /**
   * Parse actions from file changes
   */
  parseActionsFromFileChange(change) {
    const actions = [];
    
    if (change.type === 'added') {
      actions.push({
        action: 'create',
        object: 'file',
        context: change.filePath,
        timestamp: change.timestamp || new Date().toISOString(),
        source: 'file_change'
      });
    } else if (change.type === 'modified') {
      actions.push({
        action: 'modify',
        object: 'file',
        context: change.filePath,
        timestamp: change.timestamp || new Date().toISOString(),
        source: 'file_change'
      });
    }
    
    return actions;
  }

  /**
   * Identify action sequences from extracted actions
   */
  identifyActionSequences(actions) {
    const sequences = [];
    
    // Group actions by time proximity (within 5 minutes)
    const timeGroups = this.groupActionsByTime(actions, 5 * 60 * 1000);
    
    timeGroups.forEach(group => {
      if (group.length > 1) {
        sequences.push({
          actions: group,
          pattern: this.identifySequencePattern(group),
          duration: this.calculateSequenceDuration(group),
          complexity: this.calculateSequenceComplexity(group)
        });
      }
    });
    
    return sequences;
  }

  /**
   * Group actions by time proximity
   */
  groupActionsByTime(actions, timeWindow) {
    const groups = [];
    const sortedActions = actions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let currentGroup = [];
    let lastTimestamp = null;
    
    sortedActions.forEach(action => {
      const actionTime = new Date(action.timestamp);
      
      if (lastTimestamp === null || (actionTime - lastTimestamp) <= timeWindow) {
        currentGroup.push(action);
      } else {
        if (currentGroup.length > 0) {
          groups.push([...currentGroup]);
        }
        currentGroup = [action];
      }
      
      lastTimestamp = actionTime;
    });
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * Identify sequence patterns
   */
  identifySequencePattern(actions) {
    const actionTypes = actions.map(a => a.action);
    
    // Check for common patterns
    if (this.matchesPattern(actionTypes, ['create', 'test'])) {
      return 'create_then_test';
    } else if (this.matchesPattern(actionTypes, ['analyze', 'fix'])) {
      return 'analyze_then_fix';
    } else if (this.matchesPattern(actionTypes, ['create', 'modify', 'test'])) {
      return 'create_modify_test';
    } else if (actionTypes.every(type => type === 'modify')) {
      return 'iterative_modification';
    } else {
      return 'custom_sequence';
    }
  }

  /**
   * Check if action types match a pattern
   */
  matchesPattern(actionTypes, pattern) {
    if (actionTypes.length !== pattern.length) return false;
    return actionTypes.every((type, index) => type === pattern[index]);
  }

  /**
   * Calculate sequence duration
   */
  calculateSequenceDuration(actions) {
    if (actions.length < 2) return 0;
    
    const startTime = new Date(actions[0].timestamp);
    const endTime = new Date(actions[actions.length - 1].timestamp);
    
    return endTime - startTime;
  }

  /**
   * Calculate sequence complexity
   */
  calculateSequenceComplexity(actions) {
    const uniqueActions = new Set(actions.map(a => a.action));
    const uniqueObjects = new Set(actions.map(a => a.object));
    
    return {
      actionDiversity: uniqueActions.size,
      objectDiversity: uniqueObjects.size,
      totalActions: actions.length,
      complexityScore: (uniqueActions.size * 0.4) + (uniqueObjects.size * 0.3) + (actions.length * 0.3)
    };
  }

  /**
   * Infer higher-level goals from sequences
   */
  inferGoals(sequences, session) {
    const goals = [];
    
    sequences.forEach(sequence => {
      const goal = this.inferGoalFromSequence(sequence, session);
      if (goal) {
        goals.push(goal);
      }
    });
    
    return goals;
  }

  /**
   * Infer goal from sequence
   */
  inferGoalFromSequence(sequence, session) {
    const { pattern, actions } = sequence;
    
    switch (pattern) {
      case 'create_then_test':
        return {
          level: 'feature_development',
          description: 'Develop and validate new functionality',
          confidence: 0.8
        };
      case 'analyze_then_fix':
        return {
          level: 'system_improvement',
          description: 'Identify and resolve issues',
          confidence: 0.9
        };
      case 'create_modify_test':
        return {
          level: 'feature_development',
          description: 'Iterative feature development',
          confidence: 0.7
        };
      case 'iterative_modification':
        return {
          level: 'immediate_task',
          description: 'Refinement and optimization',
          confidence: 0.6
        };
      default:
        return {
          level: 'immediate_task',
          description: 'Custom workflow execution',
          confidence: 0.5
        };
    }
  }

  /**
   * Generate action embeddings
   */
  generateActionEmbeddings(actions) {
    const embedding = new Array(this.proceduralDimensions).fill(0);
    
    actions.forEach(action => {
      const actionIndex = this.actionVocabulary.action_verbs.indexOf(action.action);
      const objectIndex = this.actionVocabulary.action_objects.indexOf(action.object);
      
      if (actionIndex >= 0) {
        embedding[actionIndex % this.proceduralDimensions] += 0.1;
      }
      if (objectIndex >= 0) {
        embedding[(objectIndex + 50) % this.proceduralDimensions] += 0.1;
      }
    });
    
    return embedding;
  }

  /**
   * Generate procedure embeddings
   */
  generateProcedureEmbeddings(sequences) {
    const embedding = new Array(this.proceduralDimensions).fill(0);
    
    sequences.forEach(sequence => {
      const patternIndex = this.actionVocabulary.procedural_patterns.indexOf(sequence.pattern);
      if (patternIndex >= 0) {
        embedding[(patternIndex + 100) % this.proceduralDimensions] += 0.2;
      }
      
      // Add complexity features
      embedding[110] = Math.min(sequence.complexity.complexityScore, 1.0);
      embedding[111] = sequence.complexity.actionDiversity / 10.0;
    });
    
    return embedding;
  }

  /**
   * Generate goal embeddings
   */
  generateGoalEmbeddings(goals) {
    const embedding = new Array(this.proceduralDimensions).fill(0);
    
    goals.forEach(goal => {
      const levelIndex = ['immediate_task', 'feature_development', 'system_improvement', 'project_goal'].indexOf(goal.level);
      if (levelIndex >= 0) {
        embedding[(levelIndex + 120) % this.proceduralDimensions] += goal.confidence;
      }
    });
    
    return embedding;
  }

  /**
   * Calculate procedural facet scores
   */
  calculateProceduralFacetScores(actions, sequences, goals) {
    const scores = {};
    
    // Action type scores
    const actionTypes = actions.map(a => a.action);
    const actionTypeCounts = {};
    actionTypes.forEach(type => {
      actionTypeCounts[type] = (actionTypeCounts[type] || 0) + 1;
    });
    
    scores.action_type = actionTypeCounts;
    
    // Procedural complexity scores
    const avgComplexity = sequences.length > 0 ? 
      sequences.reduce((sum, seq) => sum + seq.complexity.complexityScore, 0) / sequences.length : 0;
    
    scores.procedural_complexity = {
      single_action: actions.length === 1 ? 1.0 : 0.0,
      action_sequence: sequences.length > 0 ? 1.0 : 0.0,
      multi_step_process: avgComplexity > 0.5 ? 1.0 : 0.0,
      complex_workflow: avgComplexity > 0.8 ? 1.0 : 0.0
    };
    
    // Goal hierarchy scores
    const goalLevels = goals.map(g => g.level);
    const goalLevelCounts = {};
    goalLevels.forEach(level => {
      goalLevelCounts[level] = (goalLevelCounts[level] || 0) + 1;
    });
    
    scores.goal_hierarchy = goalLevelCounts;
    
    return scores;
  }

  /**
   * Generate procedural profile
   */
  generateProceduralProfile(proceduralAnalysis) {
    const { actions, sequences, goals } = proceduralAnalysis;
    
    return {
      primary_action_type: this.getMostFrequentAction(actions),
      sequence_count: sequences.length,
      goal_level: this.getPrimaryGoalLevel(goals),
      complexity_level: this.calculateOverallComplexity(sequences),
      workflow_type: this.identifyWorkflowType(sequences),
      procedural_confidence: this.calculateProceduralConfidence(proceduralAnalysis)
    };
  }

  /**
   * Get most frequent action type
   */
  getMostFrequentAction(actions) {
    const counts = {};
    actions.forEach(action => {
      counts[action.action] = (counts[action.action] || 0) + 1;
    });
    
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'unknown');
  }

  /**
   * Get primary goal level
   */
  getPrimaryGoalLevel(goals) {
    if (goals.length === 0) return 'immediate_task';
    
    const levelCounts = {};
    goals.forEach(goal => {
      levelCounts[goal.level] = (levelCounts[goal.level] || 0) + 1;
    });
    
    return Object.keys(levelCounts).reduce((a, b) => levelCounts[a] > levelCounts[b] ? a : b, 'immediate_task');
  }

  /**
   * Calculate overall complexity
   */
  calculateOverallComplexity(sequences) {
    if (sequences.length === 0) return 'low';
    
    const avgComplexity = sequences.reduce((sum, seq) => sum + seq.complexity.complexityScore, 0) / sequences.length;
    
    if (avgComplexity < 0.3) return 'low';
    if (avgComplexity < 0.6) return 'medium';
    if (avgComplexity < 0.8) return 'high';
    return 'very_high';
  }

  /**
   * Identify workflow type
   */
  identifyWorkflowType(sequences) {
    if (sequences.length === 0) return 'single_action';
    
    const patterns = sequences.map(s => s.pattern);
    const uniquePatterns = new Set(patterns);
    
    if (uniquePatterns.size === 1) return 'systematic';
    if (uniquePatterns.size <= 3) return 'iterative';
    return 'exploratory';
  }

  /**
   * Calculate procedural confidence
   */
  calculateProceduralConfidence(proceduralAnalysis) {
    const { actions, sequences, goals } = proceduralAnalysis;
    
    let confidence = 0.0;
    
    if (actions.length > 0) confidence += 0.3;
    if (sequences.length > 0) confidence += 0.4;
    if (goals.length > 0) confidence += 0.3;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Get default procedural analysis
   */
  getDefaultProceduralAnalysis() {
    return {
      actions: [],
      sequences: [],
      goals: [],
      actionEmbeddings: new Array(this.proceduralDimensions).fill(0),
      procedureEmbeddings: new Array(this.proceduralDimensions).fill(0),
      goalEmbeddings: new Array(this.proceduralDimensions).fill(0),
      proceduralFacets: {}
    };
  }
}

module.exports = EmbeddingsIntentClassifier;
