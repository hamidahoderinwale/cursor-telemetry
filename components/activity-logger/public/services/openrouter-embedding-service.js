/**
 * OpenRouter Embedding Service
 * Centralized service for generating embeddings using OpenRouter API
 * Used throughout the project for semantic analysis, insights, and visualizations
 */

class OpenRouterEmbeddingService {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || window.DASHBOARD_CONFIG?.API_BASE || 'http://localhost:43917';
    this.embeddingCache = new Map(); // In-memory cache
    this.batchQueue = []; // Queue for batch processing
    this.batchTimeout = null;
    this.isAvailable = null; // Cache availability check
    this.availabilityCheckPromise = null;
  }

  /**
   * Check if OpenRouter API is available
   */
  async checkAvailability() {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    if (this.availabilityCheckPromise) {
      return this.availabilityCheckPromise;
    }

    this.availabilityCheckPromise = (async () => {
      try {
        const response = await fetch(`${this.apiBase}/api/ai/status`);
        if (response.ok) {
          const status = await response.json();
          this.isAvailable = status.available && status.hasApiKey;
          if (this.isAvailable) {
            console.log('[OPENROUTER-EMBEDDINGS] ✓ OpenRouter API available for embeddings');
            console.log(`[OPENROUTER-EMBEDDINGS]   Model: ${status.embeddingModel || 'openai/text-embedding-3-small'}`);
          }
          return this.isAvailable;
        }
      } catch (error) {
        console.debug('[OPENROUTER-EMBEDDINGS] OpenRouter API not available:', error.message);
      }
      this.isAvailable = false;
      return false;
    })();

    return this.availabilityCheckPromise;
  }

  /**
   * Generate embeddings for texts using OpenRouter API
   * @param {string[]} texts - Array of texts to embed
   * @param {Object} options - Options (batchSize, useCache)
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async generateEmbeddings(texts, options = {}) {
    if (!texts || texts.length === 0) {
      return [];
    }

    const { batchSize = 100, useCache = true } = options;

    // Check availability
    const available = await this.checkAvailability();
    if (!available) {
      throw new Error('OpenRouter API not available. Set OPENROUTER_API_KEY in environment.');
    }

    // Check cache for individual texts
    const uncachedTexts = [];
    const cachedEmbeddings = [];
    const textToIndex = new Map();

    if (useCache) {
      texts.forEach((text, index) => {
        const cacheKey = this._getCacheKey(text);
        if (this.embeddingCache.has(cacheKey)) {
          cachedEmbeddings[index] = this.embeddingCache.get(cacheKey);
        } else {
          uncachedTexts.push({ text, index });
          textToIndex.set(text, index);
        }
      });
    } else {
      texts.forEach((text, index) => {
        uncachedTexts.push({ text, index });
        textToIndex.set(text, index);
      });
    }

    // If all cached, return cached results
    if (uncachedTexts.length === 0) {
      return cachedEmbeddings;
    }

    // Process in batches
    const allEmbeddings = [...cachedEmbeddings];
    const batches = [];
    for (let i = 0; i < uncachedTexts.length; i += batchSize) {
      batches.push(uncachedTexts.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const batchTexts = batch.map(item => item.text);
      
      try {
        const response = await fetch(`${this.apiBase}/api/ai/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            texts: batchTexts
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`OpenRouter API error: ${response.status} - ${error.error || 'Unknown error'}`);
        }

        const data = await response.json();
        if (!data.success || !data.embeddings) {
          throw new Error('Invalid response from OpenRouter API');
        }

        // Store in cache and result array
        batch.forEach((item, batchIndex) => {
          const embedding = data.embeddings[batchIndex];
          if (embedding) {
            const cacheKey = this._getCacheKey(item.text);
            this.embeddingCache.set(cacheKey, embedding);
            allEmbeddings[item.index] = embedding;
          }
        });
      } catch (error) {
        console.error('[OPENROUTER-EMBEDDINGS] Error generating embeddings:', error);
        // Fill with null for failed batch
        batch.forEach(item => {
          allEmbeddings[item.index] = null;
        });
      }
    }

    return allEmbeddings;
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text) {
    const embeddings = await this.generateEmbeddings([text]);
    return embeddings[0] || null;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      mag1 += embedding1[i] * embedding1[i];
      mag2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Find most similar texts to a query
   */
  async findSimilar(queryText, candidateTexts, topK = 10) {
    const queryEmbedding = await this.generateEmbedding(queryText);
    if (!queryEmbedding) {
      return [];
    }

    const candidateEmbeddings = await this.generateEmbeddings(candidateTexts);
    
    const similarities = candidateEmbeddings
      .map((embedding, index) => ({
        text: candidateTexts[index],
        index,
        similarity: embedding ? this.cosineSimilarity(queryEmbedding, embedding) : 0
      }))
      .filter(item => item.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return similarities;
  }

  /**
   * Get cache key for text
   */
  _getCacheKey(text) {
    // Simple hash function
    let hash = 0;
    const str = String(text);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.embeddingCache.clear();
  }
}

// Export singleton instance
window.OpenRouterEmbeddingService = window.OpenRouterEmbeddingService || new OpenRouterEmbeddingService();


