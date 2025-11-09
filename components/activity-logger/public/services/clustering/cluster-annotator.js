/**
 * Cluster Annotator Service
 * Generates meaningful names and descriptions for clusters using Hugging Face models
 */

class ClusterAnnotator {
  constructor() {
    this.transformers = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.cache = new Map(); // Cache annotations to avoid regenerating
    this.useOpenRouter = false; // Whether to use OpenRouter API
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
  }

  /**
   * Initialize Hugging Face Transformers.js
   */
  async initialize() {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize() {
    // First check if OpenRouter API is available (preferred - faster and more reliable)
    try {
      const statusResponse = await fetch(`${this.apiBase}/api/ai/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.available && status.hasApiKey) {
          this.useOpenRouter = true;
          this.isInitialized = true;
          console.log('[CLUSTER-ANNOTATOR] Using OpenRouter API for cluster annotation');
          console.log(`[CLUSTER-ANNOTATOR] Chat model: ${status.chatModel || 'microsoft/phi-3-mini-128k-instruct:free'}`);
          return;
        }
      }
    } catch (apiError) {
      console.log('[CLUSTER-ANNOTATOR] OpenRouter API not available, trying Transformers.js...');
    }

    // Fallback to Transformers.js
    try {
      // Check if Transformers.js is already loaded
      if (window.transformers || (typeof window !== 'undefined' && window._transformersLoaded)) {
        const transformers = window.transformers || await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        this.transformers = transformers;
        this.isInitialized = true;
        console.log('[CLUSTER-ANNOTATOR] Using existing Transformers.js');
        return;
      }

      // Try to load Transformers.js
      console.log('[CLUSTER-ANNOTATOR] Loading Transformers.js...');
      const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      this.transformers = transformers;
      this.isInitialized = true;
      console.log('[CLUSTER-ANNOTATOR] Transformers.js loaded successfully');
    } catch (error) {
      console.warn('[CLUSTER-ANNOTATOR] Failed to load Transformers.js:', error.message);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Generate annotation for a cluster
   * @param {Object} cluster - Cluster object with nodes
   * @param {Object} options - Options for annotation
   * @returns {Promise<Object>} Annotation with name and description
   */
  async annotateCluster(cluster, options = {}) {
    const {
      useLLM = true,
      useEmbeddings = true,
      modelName = 'Xenova/all-MiniLM-L6-v2', // Fast embedding model
      textModel = 'Xenova/gpt2', // Lightweight text generation
      maxNodes = 20 // Limit nodes analyzed for performance
    } = options;

    // Check cache
    const cacheKey = this._getCacheKey(cluster);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      await this.initialize();
    } catch (error) {
      // Fallback to rule-based annotation if Transformers.js fails
      return this._generateRuleBasedAnnotation(cluster);
    }

    // Extract cluster features
    const features = this._extractClusterFeatures(cluster, maxNodes);
    
    let annotation = {
      name: cluster.name || `Cluster ${cluster.id}`,
      description: '',
      keywords: [],
      category: 'unknown'
    };

    // Method 1: Use embeddings to find common themes
    if (useEmbeddings && this.isInitialized) {
      try {
        const embeddingAnnotation = await this._annotateWithEmbeddings(features, modelName);
        annotation = { ...annotation, ...embeddingAnnotation };
      } catch (error) {
        console.warn('[CLUSTER-ANNOTATOR] Embedding annotation failed:', error.message);
      }
    }

    // Method 2: Generate name using AI if available
    if (useLLM && this.isInitialized) {
      try {
        const aiName = await this._generateNameFromKeywords(
          annotation.keywords || [],
          annotation.category || 'unknown',
          features
        );
        if (aiName) {
          annotation.name = aiName;
        }
      } catch (error) {
        console.warn('[CLUSTER-ANNOTATOR] AI name generation failed:', error.message);
      }
    }

    // Method 3: Use text generation for description
    if (useLLM && this.isInitialized && annotation.name) {
      try {
        const llmDescription = await this._generateDescription(features, annotation.name, textModel);
        if (llmDescription) {
          annotation.description = llmDescription;
        }
      } catch (error) {
        console.warn('[CLUSTER-ANNOTATOR] LLM description generation failed:', error.message);
      }
    }

    // Fallback: Generate rule-based description if LLM failed
    if (!annotation.description) {
      const ruleBased = await this._generateRuleBasedAnnotation(cluster);
      annotation.description = ruleBased.description || annotation.description;
    }

    // Cache result
    this.cache.set(cacheKey, annotation);
    return annotation;
  }

  /**
   * Extract features from cluster for analysis
   */
  _extractClusterFeatures(cluster, maxNodes = 20) {
    const nodes = cluster.nodes || [];
    const sampleNodes = nodes.slice(0, maxNodes);

    const features = {
      fileNames: [],
      filePaths: [],
      fileExtensions: new Set(),
      directories: new Set(),
      workspaces: new Set(),
      codeSnippets: [],
      changeCounts: [],
      eventTypes: new Set()
    };

    sampleNodes.forEach(node => {
      // File names and paths
      if (node.name) features.fileNames.push(node.name);
      if (node.path) {
        features.filePaths.push(node.path);
        const dir = node.path.split('/').slice(0, -1).join('/');
        if (dir) features.directories.add(dir);
      }
      if (node.ext) features.fileExtensions.add(node.ext);
      if (node.workspace) features.workspaces.add(node.workspace);

      // Activity metrics
      if (node.changes) features.changeCounts.push(node.changes);
      if (node.events) {
        node.events.forEach(e => {
          if (e.type) features.eventTypes.add(e.type);
        });
      }

      // Code snippets (if available)
      if (node.content) {
        features.codeSnippets.push(node.content.substring(0, 200));
      }
    });

    return {
      ...features,
      fileExtensions: Array.from(features.fileExtensions),
      directories: Array.from(features.directories),
      workspaces: Array.from(features.workspaces),
      eventTypes: Array.from(features.eventTypes),
      nodeCount: nodes.length,
      avgChanges: features.changeCounts.length > 0
        ? features.changeCounts.reduce((a, b) => a + b, 0) / features.changeCounts.length
        : 0
    };
  }

  /**
   * Annotate cluster using embeddings to find common themes
   */
  async _annotateWithEmbeddings(features, modelName) {
    if (!this.transformers || !this.isInitialized) {
      throw new Error('Transformers.js not initialized');
    }

    const { pipeline } = this.transformers;
    
    // Create embeddings for file names and paths
    const texts = [
      ...features.fileNames.slice(0, 10),
      ...features.filePaths.slice(0, 10).map(p => p.split('/').pop())
    ].filter(Boolean);

    if (texts.length === 0) {
      return { name: 'Unknown Cluster', keywords: [] };
    }

    try {
      // Use feature-extraction pipeline for embeddings
      const extractor = await pipeline('feature-extraction', modelName, {
        quantized: true // Use quantized model for faster inference
      });

      // Generate embeddings
      const embeddings = await extractor(texts, { pooling: 'mean', normalize: true });
      
      // Find most common words/patterns
      const keywords = this._extractKeywordsFromTexts(texts);
      
      // Determine category based on file extensions and paths
      const category = this._categorizeCluster(features);
      
      // Generate name from keywords (async if using OpenRouter)
      const name = await this._generateNameFromKeywords(keywords, category, features);

      return {
        name,
        keywords: keywords.slice(0, 5),
        category
      };
    } catch (error) {
      console.warn('[CLUSTER-ANNOTATOR] Embedding extraction failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate description using text generation model
   */
  async _generateDescription(features, clusterName, modelName) {
    if (!this.isInitialized) {
      return null;
    }

    try {
      // Use OpenRouter API if available for better descriptions
      if (this.useOpenRouter) {
        try {
          const prompt = `Analyze this code cluster and generate a brief, descriptive label (2-4 words max) and a short description (1 sentence).

Cluster contains:
- ${features.nodeCount} files
- File types: ${features.fileExtensions.slice(0, 5).join(', ')}
- Main directories: ${features.directories.slice(0, 3).join(', ')}
- File names: ${features.fileNames.slice(0, 10).join(', ')}

Respond in JSON format:
{
  "label": "short label here",
  "description": "one sentence description"
}`;

          const response = await fetch(`${this.apiBase}/api/ai/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: [
                {
                  role: 'system',
                  content: 'You are a code analysis assistant. Generate concise, meaningful labels and descriptions for code clusters.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              temperature: 0.7,
              max_tokens: 150
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.content) {
              try {
                // Try to parse JSON from response
                const jsonMatch = data.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  return parsed.description || this._generateTemplateDescription(features, clusterName);
                }
              } catch (parseError) {
                // If JSON parsing fails, use the content as description
                return data.content.substring(0, 200);
              }
            }
          }
        } catch (apiError) {
          console.warn('[CLUSTER-ANNOTATOR] OpenRouter API error, using template:', apiError.message);
        }
      }

      // Fallback to template-based approach
      return this._generateTemplateDescription(features, clusterName);
    } catch (error) {
      console.warn('[CLUSTER-ANNOTATOR] Description generation failed:', error.message);
      return null;
    }
  }

  /**
   * Generate template-based description
   */
  _generateTemplateDescription(features, clusterName) {
    const parts = [];

    // Size and composition
    parts.push(`Contains ${features.nodeCount} file${features.nodeCount !== 1 ? 's' : ''}`);

    // File types
    if (features.fileExtensions.length > 0) {
      const topExtensions = features.fileExtensions.slice(0, 3).join(', ');
      parts.push(`primarily ${topExtensions} files`);
    }

    // Activity level
    if (features.avgChanges > 10) {
      parts.push('with high activity');
    } else if (features.avgChanges > 0) {
      parts.push('with moderate activity');
    }

    // Directory structure
    if (features.directories.length > 0 && features.directories.length <= 3) {
      const mainDir = features.directories[0].split('/').pop();
      parts.push(`in ${mainDir}`);
    }

    return parts.join(', ') + '.';
  }

  /**
   * Extract keywords from file names and paths
   */
  _extractKeywordsFromTexts(texts) {
    const wordFreq = new Map();
    
    texts.forEach(text => {
      // Extract meaningful words (camelCase, kebab-case, snake_case)
      const words = text
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
        .replace(/[-_]/g, ' ') // Split kebab-case and snake_case
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2 && !/^\d+$/.test(w)); // Filter short words and numbers

      words.forEach(word => {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      });
    });

    // Sort by frequency
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Categorize cluster based on features
   */
  _categorizeCluster(features) {
    const extensions = features.fileExtensions.map(ext => ext.toLowerCase());
    
    if (extensions.some(ext => ['js', 'ts', 'jsx', 'tsx'].includes(ext))) {
      return 'frontend';
    } else if (extensions.some(ext => ['py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext))) {
      return 'backend';
    } else if (extensions.some(ext => ['css', 'scss', 'sass', 'less'].includes(ext))) {
      return 'styling';
    } else if (extensions.some(ext => ['json', 'yaml', 'yml', 'toml'].includes(ext))) {
      return 'config';
    } else if (extensions.some(ext => ['md', 'txt', 'rst'].includes(ext))) {
      return 'documentation';
    } else if (extensions.some(ext => ['test', 'spec'].some(t => ext.includes(t)))) {
      return 'testing';
    } else {
      return 'mixed';
    }
  }

  /**
   * Generate cluster name from keywords and category
   * Can use OpenRouter API for better names
   */
  async _generateNameFromKeywords(keywords, category, features) {
    // If OpenRouter is available, use it to generate a better name
    if (this.useOpenRouter && this.isInitialized) {
      try {
        const prompt = `Generate a short, descriptive label (2-4 words max) for this code cluster:

- File types: ${features.fileExtensions.slice(0, 5).join(', ')}
- Keywords: ${keywords.slice(0, 5).join(', ')}
- Category: ${category}
- Sample files: ${features.fileNames.slice(0, 5).join(', ')}

Respond with ONLY the label, no explanation, no quotes, just the label.`;

        const response = await fetch(`${this.apiBase}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content: 'You are a code analysis assistant. Generate concise, meaningful labels for code clusters. Respond with only the label, nothing else.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 20
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.content) {
            const label = data.content.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
            if (label.length > 0 && label.length < 50) {
              return label;
            }
          }
        }
      } catch (apiError) {
        console.warn('[CLUSTER-ANNOTATOR] OpenRouter API error for name generation, using fallback:', apiError.message);
      }
    }

    // Fallback to keyword-based name
    if (keywords.length === 0) {
      return this._getCategoryName(category);
    }

    // Use top 2-3 keywords
    const topKeywords = keywords.slice(0, 2);
    const name = topKeywords
      .map(k => k.charAt(0).toUpperCase() + k.slice(1))
      .join(' ');

    // Add category suffix if helpful
    if (category !== 'mixed' && !name.toLowerCase().includes(category)) {
      return `${name} (${this._getCategoryName(category)})`;
    }

    return name || this._getCategoryName(category);
  }

  /**
   * Get human-readable category name
   */
  _getCategoryName(category) {
    const names = {
      frontend: 'Frontend',
      backend: 'Backend',
      styling: 'Styling',
      config: 'Configuration',
      documentation: 'Documentation',
      testing: 'Testing',
      mixed: 'Mixed',
      unknown: 'Unknown'
    };
    return names[category] || 'Unknown';
  }

  /**
   * Generate rule-based annotation (fallback)
   */
  async _generateRuleBasedAnnotation(cluster) {
    const features = this._extractClusterFeatures(cluster, 50);
    const category = this._categorizeCluster(features);
    const keywords = this._extractKeywordsFromTexts([
      ...features.fileNames,
      ...features.filePaths.map(p => p.split('/').pop())
    ]);

    return {
      name: await this._generateNameFromKeywords(keywords, category, features),
      description: this._generateTemplateDescription(features, ''),
      keywords: keywords.slice(0, 5),
      category
    };
  }

  /**
   * Get cache key for cluster
   */
  _getCacheKey(cluster) {
    const nodeIds = (cluster.nodes || []).map(n => n.id || n.path).sort().join(',');
    return `${cluster.id || 'unknown'}_${nodeIds.length}_${nodeIds.substring(0, 50)}`;
  }

  /**
   * Batch annotate multiple clusters
   */
  async annotateClusters(clusters, options = {}) {
    const annotations = [];
    
    for (const cluster of clusters) {
      try {
        const annotation = await this.annotateCluster(cluster, options);
        annotations.push({
          ...cluster,
          ...annotation,
          originalName: cluster.name
        });
        
        // Add small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`[CLUSTER-ANNOTATOR] Failed to annotate cluster ${cluster.id}:`, error.message);
        // Use fallback
        const fallback = await this._generateRuleBasedAnnotation(cluster);
        annotations.push({
          ...cluster,
          ...fallback,
          originalName: cluster.name
        });
      }
    }

    return annotations;
  }

  /**
   * Clear annotation cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export
if (typeof window !== 'undefined') {
  window.ClusterAnnotator = ClusterAnnotator;
  window.clusterAnnotator = new ClusterAnnotator();
}

