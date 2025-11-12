/**
 * Semantic Search Service for Navigator
 * Enables semantic search using code embeddings
 */

class SemanticSearchService {
  constructor() {
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.searchResults = [];
    this.currentQuery = null;
  }

  /**
   * Perform semantic search across files
   */
  async search(query, files, options = {}) {
    const {
      limit = 20,
      threshold = 0.3
    } = options;

    if (!query || query.trim().length === 0) {
      return [];
    }

    this.currentQuery = query.trim();

    // Check if embedding service is available
    if (!window.codeEmbeddingService) {
      // Fallback to keyword search
      return this._keywordSearch(query, files, limit);
    }

    try {
      await window.codeEmbeddingService.initialize();
      
      if (!window.codeEmbeddingService.isInitialized) {
        return this._keywordSearch(query, files, limit);
      }

      // Generate query embedding
      const queryEmbedding = await window.codeEmbeddingService.generateEmbedding({
        content: query,
        path: 'search-query',
        name: 'search-query'
      });

      if (!queryEmbedding) {
        return this._keywordSearch(query, files, limit);
      }

      // Compute similarities with all files
      const similarities = [];
      const filesWithEmbeddings = files.filter(f => f.embedding || f.featureVector);

      for (const file of filesWithEmbeddings) {
        const fileEmbedding = file.embedding || file.featureVector;
        if (!fileEmbedding) continue;

        const similarity = this._cosineSimilarity(queryEmbedding, fileEmbedding);
        
        if (similarity >= threshold) {
          similarities.push({
            file: file,
            similarity: similarity,
            score: similarity
          });
        }
      }

      // Sort by similarity
      similarities.sort((a, b) => b.similarity - a.similarity);

      // Return top results
      const results = similarities.slice(0, limit).map(item => ({
        ...item.file,
        searchScore: item.similarity,
        searchMatch: true
      }));

      this.searchResults = results;
      return results;

    } catch (error) {
      console.warn('[SEMANTIC-SEARCH] Semantic search failed, using keyword search:', error.message);
      return this._keywordSearch(query, files, limit);
    }
  }

  /**
   * Fallback keyword search
   */
  _keywordSearch(query, files, limit) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scores = files.map(file => {
      let score = 0;
      const content = ((file.content || '') + ' ' + (file.path || '') + ' ' + (file.name || '')).toLowerCase();
      
      // Exact phrase match
      if (content.includes(queryLower)) {
        score += 10;
      }
      
      // Word matches
      queryWords.forEach(word => {
        const count = (content.match(new RegExp(word, 'g')) || []).length;
        score += count * 2;
      });
      
      // Path/name matches (higher weight)
      const pathName = ((file.path || '') + ' ' + (file.name || '')).toLowerCase();
      if (pathName.includes(queryLower)) {
        score += 5;
      }
      
      return { file, score };
    });

    scores.sort((a, b) => b.score - a.score);
    
    const results = scores
      .filter(item => item.score > 0)
      .slice(0, limit)
      .map(item => ({
        ...item.file,
        searchScore: item.score / 20, // Normalize to 0-1
        searchMatch: true
      }));

    this.searchResults = results;
    return results;
  }

  /**
   * Cosine similarity
   */
  _cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Clear search results
   */
  clear() {
    this.searchResults = [];
    this.currentQuery = null;
  }

  /**
   * Get current search results
   */
  getResults() {
    return this.searchResults;
  }
}

// Export to window
window.SemanticSearchService = SemanticSearchService;

// Create global instance
if (!window.semanticSearchService) {
  window.semanticSearchService = new SemanticSearchService();
}

