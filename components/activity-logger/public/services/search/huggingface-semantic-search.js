/**
 * Hugging Face Semantic Search Module
 * Uses Transformers.js to run embedding models in the browser, or OpenRouter API as fallback
 * 
 * Features:
 * - Natural language query understanding
 * - Semantic code search using embeddings
 * - Time-aware search (query about codebase over time)
 * - Works in browser (Transformers.js) or via OpenRouter API
 * - Automatic fallback from local model to API if local model fails
 */

class HuggingFaceSemanticSearch {
  constructor() {
    this.model = null;
    this.tokenizer = null;
    this.embeddings = new Map(); // documentId -> embedding vector
    this.isInitialized = false;
    this.useOpenRouter = false; // Whether to use OpenRouter API as fallback
    this.modelName = 'Xenova/all-MiniLM-L6-v2'; // Lightweight, fast model (384 dimensions)
    // Alternative models to try:
    // 'Xenova/multilingual-e5-base' - Multilingual support
    // 'Xenova/bge-small-en-v1.5' - Better for English
    // 'Xenova/codebert-base' - Code-specific (larger, slower)
    
    this.embeddingCache = new Map(); // Cache embeddings in IndexedDB
    this.maxCacheSize = 10000; // Max cached embeddings
    
    // API base URL (from config)
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
  }

  /**
   * Initialize the model (lazy loading - only when needed)
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    // Check config before initializing - this is a safety check
    // Add debug logging to understand why it might be initializing
    const configValue = window.CONFIG?.ENABLE_SEMANTIC_SEARCH;
    const dashboardConfigValue = window.DASHBOARD_CONFIG?.ENABLE_SEMANTIC_SEARCH;
    const enableSemantic = (window.CONFIG && window.CONFIG.ENABLE_SEMANTIC_SEARCH === true) || 
                          (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH === true) ||
                          false;
    
    console.log('[HF-SEARCH] Config check before initialization:', {
      'window.CONFIG?.ENABLE_SEMANTIC_SEARCH': configValue,
      'window.DASHBOARD_CONFIG?.ENABLE_SEMANTIC_SEARCH': dashboardConfigValue,
      'enableSemantic': enableSemantic,
      'window.CONFIG exists': !!window.CONFIG,
      'window.DASHBOARD_CONFIG exists': !!window.DASHBOARD_CONFIG
    });
    
    if (!enableSemantic) {
      console.log('[HF-SEARCH] Hugging Face semantic search disabled in config - skipping model initialization');
      return false;
    }

    // First check if OpenRouter API is available (faster than loading Transformers.js)
    try {
      const statusResponse = await fetch(`${this.apiBase}/api/ai/status`);
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.available && status.hasApiKey) {
          this.useOpenRouter = true;
          this.isInitialized = true;
          console.log('[HF-SEARCH] Using OpenRouter API for embeddings (skipping local model load)');
          console.log(`[HF-SEARCH] Embedding model: ${status.embeddingModel || 'openai/text-embedding-3-small'}`);
          return true;
        }
      }
    } catch (apiError) {
      console.log('[HF-SEARCH] OpenRouter API check failed, trying local Transformers.js model...');
    }

    // Fallback to Transformers.js if OpenRouter not available
    try {
      console.log('[HF-SEARCH] Initializing local Transformers.js model...');
      console.log('[HF-SEARCH] Loading model:', this.modelName);
      
      // Load Transformers.js dynamically
      let pipeline;
      try {
        // Try to use ES module import with timeout
        const importPromise = import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Import timeout')), 15000)
        );
        
        const transformers = await Promise.race([importPromise, timeoutPromise]);
        pipeline = transformers.pipeline;
        console.log('[HF-SEARCH] Transformers.js loaded via ES module import');
      } catch (importError) {
        // If import fails, try loading via script tag
        console.log('[HF-SEARCH] ES module import failed, trying script tag fallback...', importError.message);
        try {
          await this.loadTransformersJS();
          if (window.pipeline) {
            pipeline = window.pipeline;
            console.log('[HF-SEARCH] Transformers.js loaded via script tag');
          } else {
            throw new Error('Transformers.js not available after script tag load');
          }
        } catch (scriptError) {
          throw new Error(`Failed to load Transformers.js: ${scriptError.message}`);
        }
      }

      // Initialize the embedding pipeline with timeout
      console.log(`[HF-SEARCH] Loading model: ${this.modelName} (this may take 30-60 seconds on first load)...`);
      
      const modelLoadPromise = pipeline(
        'feature-extraction',
        this.modelName,
        {
          quantized: true, // Use quantized model for faster loading
          progress_callback: (progress) => {
            if (progress.status === 'progress') {
              console.log(`[HF-SEARCH] Model loading: ${Math.round(progress.progress * 100)}%`);
            }
          }
        }
      );
      
      const modelTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model loading timeout (60s)')), 60000)
      );
      
      this.model = await Promise.race([modelLoadPromise, modelTimeoutPromise]);

      this.isInitialized = true;
      console.log('[HF-SEARCH] Local Transformers.js model loaded successfully');
      return true;
    } catch (error) {
      console.warn('[HF-SEARCH] Failed to initialize Transformers.js model:', error.message);
      console.log('[HF-SEARCH] Attempting to use OpenRouter API as fallback...');
      
      // Try to check if OpenRouter API is available as fallback
      try {
        const statusResponse = await fetch(`${this.apiBase}/api/ai/status`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          if (status.available && status.hasApiKey) {
            this.useOpenRouter = true;
            this.isInitialized = true;
            console.log('[HF-SEARCH] Using OpenRouter API for embeddings (fallback)');
            return true;
          }
        }
      } catch (apiError) {
        console.warn('[HF-SEARCH] OpenRouter API not available:', apiError.message);
      }
      
      console.warn('[HF-SEARCH] Both local model and OpenRouter API unavailable');
      console.warn('[HF-SEARCH] Common issues:');
      console.warn('  - Network/CORS: Transformers.js CDN may be blocked');
      console.warn('  - Timeout: Model download may be too slow');
      console.warn('  - Memory: Browser may not have enough memory');
      console.warn('  - API Key: Set OPENROUTER_API_KEY in .env to use API fallback');
      console.warn('[HF-SEARCH] Falling back to TF-IDF/BM25 semantic search');
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Load Transformers.js from CDN if not available
   */
  async loadTransformersJS() {
    return new Promise((resolve, reject) => {
      if (window.pipeline) {
        resolve();
        return;
      }

      // Check if already loading
      if (window._transformersLoading) {
        window.addEventListener('transformers-loaded', resolve, { once: true });
        window.addEventListener('transformers-error', reject, { once: true });
        return;
      }

      window._transformersLoading = true;

      // Set timeout for loading (30 seconds)
      const timeout = setTimeout(() => {
        window._transformersLoading = false;
        reject(new Error('Transformers.js loading timeout (30s)'));
      }, 30000);

      // Store timeout ID in window for cleanup
      window._transformersTimeout = timeout;
      
      // Load via script tag (for browsers that don't support dynamic imports)
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        try {
          import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2').then(module => {
            window.pipeline = module.pipeline;
            window._transformersLoading = false;
            if (window._transformersTimeout) {
              clearTimeout(window._transformersTimeout);
              window._transformersTimeout = null;
            }
            window.dispatchEvent(new Event('transformers-loaded'));
          }).catch(err => {
            window._transformersLoading = false;
            if (window._transformersTimeout) {
              clearTimeout(window._transformersTimeout);
              window._transformersTimeout = null;
            }
            window.dispatchEvent(new CustomEvent('transformers-error', { detail: err }));
          });
        } catch (err) {
          window._transformersLoading = false;
          if (window._transformersTimeout) {
            clearTimeout(window._transformersTimeout);
            window._transformersTimeout = null;
          }
          window.dispatchEvent(new CustomEvent('transformers-error', { detail: err }));
        }
      `;
      script.onerror = () => {
        window._transformersLoading = false;
        clearTimeout(timeout);
        reject(new Error('Failed to load Transformers.js script'));
      };
      document.head.appendChild(script);
      
      window.addEventListener('transformers-loaded', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      
      window.addEventListener('transformers-error', (event) => {
        clearTimeout(timeout);
        reject(event.detail || new Error('Transformers.js loading failed'));
      }, { once: true });
    });
  }

  /**
   * Generate embedding for a text
   */
  async generateEmbedding(text) {
    if (!this.isInitialized) {
      await this.initialize();
      if (!this.isInitialized) {
        return null;
      }
    }

    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(text);
      if (this.embeddingCache.has(cacheKey)) {
        return this.embeddingCache.get(cacheKey);
      }

      let embedding;

      // Use OpenRouter API if available
      if (this.useOpenRouter) {
        try {
          const response = await fetch(`${this.apiBase}/api/ai/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              texts: [text]
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.embeddings && data.embeddings.length > 0) {
              embedding = data.embeddings[0];
            } else {
              throw new Error('Invalid response from OpenRouter API');
            }
          } else {
            throw new Error(`OpenRouter API error: ${response.status}`);
          }
        } catch (apiError) {
          console.warn('[HF-SEARCH] OpenRouter API error, falling back to local model:', apiError.message);
          // Fallback to local model if available
          if (this.model) {
            this.useOpenRouter = false;
            return this.generateEmbedding(text); // Retry with local model
          }
          return null;
        }
      } else {
        // Use local Transformers.js model
        // The model returns a tensor, we need to extract the data
        const output = await this.model(text, {
          pooling: 'mean',
          normalize: true
        });

        // Convert tensor to array (handle different output formats)
        if (output.data) {
          embedding = Array.from(output.data);
        } else if (Array.isArray(output)) {
          embedding = output;
        } else if (output instanceof Float32Array || output instanceof Float64Array) {
          embedding = Array.from(output);
        } else {
          // Try to extract from tensor
          embedding = Array.from(output);
        }
      }

      // Cache it
      if (embedding && this.embeddingCache.size < this.maxCacheSize) {
        this.embeddingCache.set(cacheKey, embedding);
      }

      return embedding;
    } catch (error) {
      console.warn('[HF-SEARCH] Error generating embedding:', error.message);
      return null;
    }
  }

  /**
   * Generate cache key for text
   */
  getCacheKey(text) {
    // Simple hash for cache key
    let hash = 0;
    const str = text.substring(0, 200); // Use first 200 chars for key
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  /**
   * Generate embeddings for all documents
   */
  async generateDocumentEmbeddings(documents) {
    if (!this.isInitialized) {
      await this.initialize();
      if (!this.isInitialized) {
        console.warn('[HF-SEARCH] Model not available, skipping embeddings');
        return;
      }
    }

    console.log(`[HF-SEARCH] Generating embeddings for ${documents.length} documents...`);
    const startTime = Date.now();

    // Process in batches to avoid memory issues
    // Use larger batches for API calls, smaller for local model
    const batchSize = this.useOpenRouter ? 50 : 10;
    let processed = 0;

    // If using OpenRouter, batch API calls for efficiency
    if (this.useOpenRouter) {
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        try {
          // Create searchable texts for batch
          const texts = batch.map(doc => this.createSearchableText(doc));
          
          // Generate embeddings in batch via API
          const response = await fetch(`${this.apiBase}/api/ai/embeddings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ texts })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.embeddings) {
              // Store embeddings
              batch.forEach((doc, idx) => {
                if (data.embeddings[idx]) {
                  this.embeddings.set(doc.id, data.embeddings[idx]);
                  processed++;
                }
              });
            }
          }
        } catch (error) {
          console.warn(`[HF-SEARCH] Error processing batch ${i}-${i + batchSize}:`, error.message);
        }

        // Log progress
        if (processed % 50 === 0) {
          console.log(`[HF-SEARCH] Processed ${processed}/${documents.length} documents...`);
        }
      }
    } else {
      // Use local model (original logic)
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (doc) => {
          try {
            // Create searchable text from document
            const searchableText = this.createSearchableText(doc);
            
            // Generate embedding
            const embedding = await this.generateEmbedding(searchableText);
            
            if (embedding) {
              this.embeddings.set(doc.id, embedding);
              processed++;
            }
          } catch (error) {
            console.warn(`[HF-SEARCH] Error processing document ${doc.id}:`, error.message);
          }
        }));

        // Log progress
        if (processed % 50 === 0) {
          console.log(`[HF-SEARCH] Processed ${processed}/${documents.length} documents...`);
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HF-SEARCH] Generated ${processed} embeddings in ${elapsed}s using ${this.useOpenRouter ? 'OpenRouter API' : 'local model'}`);
  }

  /**
   * Create searchable text from document
   */
  createSearchableText(doc) {
    const parts = [];
    
    // Add title (high importance)
    if (doc.title) {
      parts.push(doc.title);
    }
    
    // Add content (truncated for performance)
    if (doc.content) {
      const content = doc.content.length > 500 
        ? doc.content.substring(0, 500) + '...'
        : doc.content;
      parts.push(content);
    }
    
    // Add metadata context
    if (doc.metadata) {
      if (doc.metadata.source) parts.push(`source: ${doc.metadata.source}`);
      if (doc.metadata.mode) parts.push(`mode: ${doc.metadata.mode}`);
      if (doc.type) parts.push(`type: ${doc.type}`);
    }
    
    // Add workspace context
    if (doc.workspace && doc.workspace !== 'unknown') {
      parts.push(`workspace: ${doc.workspace}`);
    }

    return parts.join(' ');
  }

  /**
   * Search documents using semantic similarity
   */
  async semanticSearch(query, documents, options = {}) {
    const {
      limit = 20,
      minSimilarity = 0.3,
      includeTimeContext = true
    } = options;

    if (!this.isInitialized) {
      await this.initialize();
      if (!this.isInitialized) {
        // Fallback to empty results if model not available
        return [];
      }
    }

    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return [];
      }

      // Calculate similarity scores
      const results = [];
      
      for (const doc of documents) {
        const docEmbedding = this.embeddings.get(doc.id);
        if (!docEmbedding) {
          // Generate embedding on-the-fly if not cached
          const searchableText = this.createSearchableText(doc);
          const embedding = await this.generateEmbedding(searchableText);
          if (embedding) {
            this.embeddings.set(doc.id, embedding);
            docEmbedding = embedding;
          } else {
            continue;
          }
        }

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
        
        if (similarity >= minSimilarity) {
          // Apply time-based boosting if enabled
          let finalScore = similarity;
          if (includeTimeContext) {
            finalScore = this.applyTimeBoost(finalScore, doc.timestamp);
          }

          results.push({
            ...doc,
            semanticScore: similarity,
            score: finalScore,
            searchMethod: 'huggingface-semantic'
          });
        }
      }

      // Sort by score and return top results
      results.sort((a, b) => b.score - a.score);
      return results.slice(0, limit);

    } catch (error) {
      console.error('[HF-SEARCH] Semantic search error:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Apply time-based boosting to search results
   * Recent items get a small boost, but semantic relevance is primary
   */
  applyTimeBoost(baseScore, timestamp) {
    if (!timestamp) return baseScore;

    const age = Date.now() - new Date(timestamp).getTime();
    const daysAgo = age / (1000 * 60 * 60 * 24);

    // Small boost for recent items (max 10% boost)
    let timeBoost = 1.0;
    if (daysAgo < 1) {
      timeBoost = 1.1; // 10% boost for today
    } else if (daysAgo < 7) {
      timeBoost = 1.05; // 5% boost for this week
    } else if (daysAgo < 30) {
      timeBoost = 1.02; // 2% boost for this month
    }

    return baseScore * timeBoost;
  }

  /**
   * Answer natural language questions about the codebase
   * Example: "What files did I modify when fixing the login bug?"
   */
  async answerQuestion(question, documents, options = {}) {
    const {
      limit = 10,
      includeContext = true
    } = options;

    // Use semantic search to find relevant documents
    const relevantDocs = await this.semanticSearch(question, documents, {
      limit: limit * 2, // Get more candidates
      minSimilarity: 0.25
    });

    // Group by type and time for better answers
    const grouped = {
      events: [],
      prompts: [],
      recent: [],
      older: []
    };

    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    relevantDocs.forEach(doc => {
      if (doc.type === 'event') grouped.events.push(doc);
      if (doc.type === 'prompt') grouped.prompts.push(doc);
      
      const docTime = new Date(doc.timestamp).getTime();
      if (docTime > oneWeekAgo) {
        grouped.recent.push(doc);
      } else {
        grouped.older.push(doc);
      }
    });

    // Return structured answer
    return {
      question,
      answer: this.generateAnswer(question, grouped),
      relevantDocuments: relevantDocs.slice(0, limit),
      grouped,
      confidence: relevantDocs.length > 0 ? relevantDocs[0].semanticScore : 0
    };
  }

  /**
   * Generate natural language answer from search results
   */
  generateAnswer(question, grouped) {
    const parts = [];
    
    if (grouped.events.length > 0) {
      parts.push(`Found ${grouped.events.length} related file change${grouped.events.length !== 1 ? 's' : ''}`);
    }
    
    if (grouped.prompts.length > 0) {
      parts.push(`${grouped.prompts.length} related AI interaction${grouped.prompts.length !== 1 ? 's' : ''}`);
    }
    
    if (grouped.recent.length > 0) {
      parts.push(`${grouped.recent.length} from the past week`);
    }

    if (parts.length === 0) {
      return 'No relevant results found for your question.';
    }

    return parts.join(', ') + '.';
  }

  /**
   * Clear embeddings cache
   */
  clearCache() {
    this.embeddings.clear();
    this.embeddingCache.clear();
    console.log('[HF-SEARCH] Cache cleared');
  }

  /**
   * Get statistics about embeddings
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      modelName: this.modelName,
      embeddingsCount: this.embeddings.size,
      cacheSize: this.embeddingCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }
}

// Export for use in search engine
window.HuggingFaceSemanticSearch = HuggingFaceSemanticSearch;

