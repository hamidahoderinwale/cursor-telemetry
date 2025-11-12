/**
 * Code Embedding Service
 * Generates semantic embeddings for code files using transformer models
 * Inspired by Project AELLA's SPECTER2 approach
 */

class CodeEmbeddingService {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.embeddings = new Map(); // Cache embeddings
    this.transformers = null;
    this.isInitialized = false;
    this.initializationPromise = null;
    this.embeddingDimension = 768; // Default dimension
    this.modelName = null;
    this.useOpenRouter = false;
  }

  /**
   * Initialize embedding service
   */
  async initialize() {
    if (this.isInitialized) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this._doInitialize();
    return this.initializationPromise;
  }

  async _doInitialize() {
    // Try OpenRouter API first (better quality, code-specific models)
    try {
      const statusResponse = await fetch(`${this.apiBase}/api/ai/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.available && status.hasApiKey) {
          this.useOpenRouter = true;
          this.embeddingDimension = 768; // OpenRouter embeddings are typically 768D
          this.modelName = status.embeddingModel || 'openai/text-embedding-3-small';
          this.isInitialized = true;
          console.log('[EMBEDDING] ✓ Using OpenRouter API for code embeddings');
          console.log(`[EMBEDDING]   Model: ${this.modelName}`);
          return;
        }
      }
    } catch (apiError) {
      console.debug('[EMBEDDING] OpenRouter API check failed, will use local models:', apiError.message);
    }

    // Fallback: Use Transformers.js with code-specific models
    try {
      if (window.transformers || (typeof window !== 'undefined' && window._transformersLoaded)) {
        const transformers = window.transformers || await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        this.transformers = transformers;
        this.embeddingDimension = 384; // Local models typically 384D
        this.modelName = 'Xenova/all-MiniLM-L6-v2';
        this.isInitialized = true;
        console.log('[EMBEDDING] ✓ Using Transformers.js (local, free)');
        return;
      }

      console.log('[EMBEDDING] Loading Transformers.js...');
      const transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
      this.transformers = transformers;
      this.embeddingDimension = 384;
      this.modelName = 'Xenova/all-MiniLM-L6-v2';
      this.isInitialized = true;
      console.log('[EMBEDDING] ✓ Transformers.js loaded successfully');
    } catch (error) {
      console.warn('[EMBEDDING] Failed to load Transformers.js:', error.message);
      this.isInitialized = false;
    }
  }

  /**
   * Generate embedding for a file
   * @param {Object} file - File object with content, path, metadata
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(file) {
    await this.initialize();
    if (!this.isInitialized) {
      // Fallback to feature vector
      return this._createFallbackVector(file);
    }

    // Check cache
    const cacheKey = this._getCacheKey(file);
    if (this.embeddings.has(cacheKey)) {
      return this.embeddings.get(cacheKey);
    }

    try {
      let embedding;

      if (this.useOpenRouter) {
        embedding = await this._generateOpenRouterEmbedding(file);
      } else {
        embedding = await this._generateLocalEmbedding(file);
      }

      if (embedding) {
        this.embeddings.set(cacheKey, embedding);
        return embedding;
      }
    } catch (error) {
      console.warn('[EMBEDDING] Error generating embedding:', error.message);
    }

    // Fallback to feature vector
    return this._createFallbackVector(file);
  }

  /**
   * Generate embedding using OpenRouter API
   */
  async _generateOpenRouterEmbedding(file) {
    const text = this._createEmbeddingText(file);
    
    try {
      const response = await fetch(`${this.apiBase}/api/ai/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.embedding && Array.isArray(data.embedding)) {
          return data.embedding;
        }
      }
    } catch (error) {
      console.warn('[EMBEDDING] OpenRouter embedding failed:', error.message);
    }

    return null;
  }

  /**
   * Generate embedding using local Transformers.js
   */
  async _generateLocalEmbedding(file) {
    if (!this.transformers) return null;

    const text = this._createEmbeddingText(file);
    
    try {
      const { pipeline } = this.transformers;
      const extractor = await pipeline('feature-extraction', this.modelName);
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      
      // Convert tensor to array
      const embedding = Array.from(output.data);
      return embedding;
    } catch (error) {
      console.warn('[EMBEDDING] Local embedding failed:', error.message);
      return null;
    }
  }

  /**
   * Create text representation for embedding
   * Combines file content, path, metadata, and context
   */
  _createEmbeddingText(file) {
    const parts = [];

    // File path and name (important for semantic understanding)
    if (file.path) {
      parts.push(`File: ${file.path}`);
    }
    if (file.name) {
      parts.push(`Name: ${file.name}`);
    }

    // File extension/type
    if (file.ext) {
      parts.push(`Type: ${file.ext}`);
    }

    // Code content (limited to prevent token limits)
    const content = (file.content || '').substring(0, 8000); // Limit content
    if (content) {
      // Extract key patterns: function names, class names, imports
      const functions = content.match(/(?:function|const|let|var)\s+(\w+)/g) || [];
      const classes = content.match(/class\s+(\w+)/g) || [];
      const imports = content.match(/(?:import|require|from)\s+['"]([^'"]+)['"]/g) || [];
      
      parts.push(`Functions: ${functions.slice(0, 10).join(', ')}`);
      parts.push(`Classes: ${classes.slice(0, 10).join(', ')}`);
      parts.push(`Imports: ${imports.slice(0, 10).join(', ')}`);
      
      // Add code snippet (first 2000 chars)
      parts.push(`Code: ${content.substring(0, 2000)}`);
    }

    // Metadata
    if (file.changes) {
      parts.push(`Changes: ${file.changes}`);
    }
    if (file.workspace) {
      parts.push(`Workspace: ${file.workspace}`);
    }
    if (file.directory) {
      parts.push(`Directory: ${file.directory}`);
    }

    return parts.join('\n');
  }

  /**
   * Create fallback feature vector (when embeddings unavailable)
   */
  _createFallbackVector(file) {
    // Use existing createFeatureVector logic as fallback
    if (window.createFeatureVector) {
      return window.createFeatureVector(file);
    }
    
    // Simple fallback
    const vector = [];
    const content = (file.content || '').substring(0, 5000);
    const words = content.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const wordCounts = {};
    words.forEach(w => wordCounts[w] = (wordCounts[w] || 0) + 1);
    
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
    
    topWords.forEach(([word, count]) => {
      vector.push(count / Math.max(words.length, 1));
    });
    
    while (vector.length < 50) {
      vector.push(0);
    }
    
    return vector;
  }

  /**
   * Generate embeddings for multiple files (batch processing)
   */
  async generateEmbeddingsBatch(files, options = {}) {
    const {
      batchSize = 32,
      onProgress = null
    } = options;

    await this.initialize();
    
    const embeddings = [];
    const total = files.length;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchEmbeddings = await Promise.all(
        batch.map(file => this.generateEmbedding(file))
      );
      
      embeddings.push(...batchEmbeddings);
      
      // Progress callback
      if (onProgress) {
        onProgress(i + batch.length, total);
      }
      
      // Yield to browser
      if (i + batchSize < files.length) {
        await new Promise(resolve => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => resolve(), { timeout: 10 });
          } else {
            setTimeout(resolve, 0);
          }
        });
      }
    }

    return embeddings;
  }

  /**
   * Get cache key for file
   */
  _getCacheKey(file) {
    const key = `${file.id || file.path}_${file.lastModified || ''}_${(file.content || '').length}`;
    // Simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.embeddings.clear();
  }

  /**
   * Get embedding dimension
   */
  getDimension() {
    return this.embeddingDimension;
  }
}

// Export to window
window.CodeEmbeddingService = CodeEmbeddingService;

// Create global instance
if (!window.codeEmbeddingService) {
  window.codeEmbeddingService = new CodeEmbeddingService();
}

