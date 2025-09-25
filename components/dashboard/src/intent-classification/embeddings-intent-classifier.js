const fs = require('fs');
const path = require('path');

/**
 * High-Dimensional Embeddings-Based Intent Classification System
 * Uses semantic embeddings and multi-faceted analysis to replace hardcoded intents
 * Integrates with Clio for sophisticated conversation analysis
 */
class EmbeddingsIntentClassifier {
  constructor(clioIntentService = null) {
    this.clioIntentService = clioIntentService;
    this.embeddingDimensions = 512; // High-dimensional embeddings
    this.facetDimensions = 24; // Multi-faceted analysis
    
    // Initialize semantic intent facets (replaces hardcoded categories)
    this.semanticFacets = this.initializeSemanticFacets();
    
    // Initialize embeddings vocabulary
    this.embeddingsVocabulary = this.initializeEmbeddingsVocabulary();
    
    // Initialize facet weights for multi-dimensional analysis
    this.facetWeights = this.initializeFacetWeights();
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
   * Generate comprehensive intent classification
   */
  async classifyIntent(session, conversations = []) {
    try {
      // Generate embeddings
      const codeContent = session.codeDeltas ? 
        session.codeDeltas.map(d => d.afterContent).join('\n') : '';
      const codeEmbeddings = this.generateCodeEmbeddings(codeContent, session.currentFile);
      const conversationEmbeddings = this.generateConversationEmbeddings(conversations);
      
      // Calculate faceted scores
      const facetScores = this.calculateFacetedIntentScores(codeEmbeddings, conversationEmbeddings, session);
      
      // Generate overall intent profile
      const intentProfile = this.generateIntentProfile(facetScores);
      
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
          dimensions: this.embeddingDimensions
        },
        facets: facetScores,
        profile: intentProfile,
        clio_enhancement: clioEnhancement,
        analysis_timestamp: new Date().toISOString(),
        methodology: 'embeddings_based_multi_faceted'
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
}

module.exports = EmbeddingsIntentClassifier;
