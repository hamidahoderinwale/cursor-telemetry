/**
 * Enhanced Search Service
 * Semantic search with advanced filters and better results
 */

class EnhancedSearchService {
  constructor() {
    this.searchEngine = null;
    this.embeddingService = null;
    this.filters = {
      type: [],
      workspace: [],
      dateRange: null,
      cpRange: null
    };
  }
  
  async initialize() {
    // Initialize search engine if available
    if (window.SearchEngine) {
      this.searchEngine = new window.SearchEngine();
      const state = window.state || {};
      await this.searchEngine.initialize({
        events: state.data?.events || [],
        prompts: state.data?.prompts || [],
        conversations: state.data?.conversations || []
      });
    }
    
    // Initialize embedding service for semantic search
    if (window.embeddingService) {
      this.embeddingService = window.embeddingService;
    }
  }
  
  /**
   * Perform semantic search
   */
  async search(query, options = {}) {
    const {
      limit = 50,
      useSemantic = true,
      filters = {}
    } = options;
    
    // Merge filters
    const activeFilters = { ...this.filters, ...filters };
    
    // Get base results
    let results = [];
    
    if (useSemantic && this.embeddingService) {
      // Semantic search using embeddings
      results = await this.semanticSearch(query, limit);
    } else if (this.searchEngine) {
      // Full-text search
      results = this.searchEngine.search(query, limit);
    } else {
      // Fallback: simple text matching
      results = this.simpleSearch(query, limit);
    }
    
    // Apply filters
    results = this.applyFilters(results, activeFilters);
    
    // Rank and sort
    results = this.rankResults(results, query);
    
    return results.slice(0, limit);
  }
  
  /**
   * Semantic search using embeddings
   */
  async semanticSearch(query, limit) {
    try {
      // Get query embedding
      const queryEmbedding = await this.embeddingService.embedText(query);
      if (!queryEmbedding) {
        return this.simpleSearch(query, limit);
      }
      
      // Get all items with embeddings
      const state = window.state || {};
      const allItems = [
        ...(state.data?.events || []).map(e => ({ ...e, itemType: 'event' })),
        ...(state.data?.prompts || []).map(p => ({ ...p, itemType: 'prompt' })),
        ...(state.data?.conversations || []).map(c => ({ ...c, itemType: 'conversation' }))
      ];
      
      // Calculate similarities
      const itemsWithSimilarity = [];
      for (const item of allItems) {
        const itemText = this.extractSearchableText(item);
        if (itemText) {
          const itemEmbedding = await this.embeddingService.embedText(itemText);
          if (itemEmbedding) {
            const similarity = this.cosineSimilarity(queryEmbedding, itemEmbedding);
            itemsWithSimilarity.push({
              ...item,
              similarity,
              searchScore: similarity
            });
          }
        }
      }
      
      // Sort by similarity
      itemsWithSimilarity.sort((a, b) => b.similarity - a.similarity);
      
      return itemsWithSimilarity.slice(0, limit);
    } catch (error) {
      console.error('[SEARCH] Semantic search failed:', error);
      return this.simpleSearch(query, limit);
    }
  }
  
  /**
   * Simple text-based search
   */
  simpleSearch(query, limit) {
    const state = window.state || {};
    const queryLower = query.toLowerCase();
    const results = [];
    
    // Search events
    (state.data?.events || []).forEach(event => {
      const text = `${event.type} ${event.file_path || ''} ${JSON.stringify(event.details || {})}`.toLowerCase();
      if (text.includes(queryLower)) {
        results.push({
          ...event,
          itemType: 'event',
          searchScore: this.calculateRelevance(text, queryLower)
        });
      }
    });
    
    // Search prompts
    (state.data?.prompts || []).forEach(prompt => {
      const text = `${prompt.text || ''} ${prompt.workspace_path || ''}`.toLowerCase();
      if (text.includes(queryLower)) {
        results.push({
          ...prompt,
          itemType: 'prompt',
          searchScore: this.calculateRelevance(text, queryLower)
        });
      }
    });
    
    // Sort by relevance
    results.sort((a, b) => b.searchScore - a.searchScore);
    
    return results.slice(0, limit);
  }
  
  /**
   * Extract searchable text from item
   */
  extractSearchableText(item) {
    if (item.itemType === 'event') {
      return `${item.type} ${item.file_path || ''} ${JSON.stringify(item.details || {})}`;
    } else if (item.itemType === 'prompt') {
      return item.text || '';
    } else if (item.itemType === 'conversation') {
      return item.title || '';
    }
    return '';
  }
  
  /**
   * Calculate cosine similarity
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Calculate text relevance score
   */
  calculateRelevance(text, query) {
    const words = query.split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      const matches = (text.match(new RegExp(word, 'gi')) || []).length;
      score += matches;
    });
    
    // Boost exact phrase matches
    if (text.includes(query)) {
      score += 10;
    }
    
    return score;
  }
  
  /**
   * Apply filters to results
   */
  applyFilters(results, filters) {
    return results.filter(item => {
      // Type filter
      if (filters.type && filters.type.length > 0) {
        const itemType = item.itemType || (item.type ? 'event' : 'prompt');
        if (!filters.type.includes(itemType)) {
          return false;
        }
      }
      
      // Workspace filter
      if (filters.workspace && filters.workspace.length > 0) {
        const workspace = item.workspace_path || item.workspacePath;
        if (!filters.workspace.includes(workspace)) {
          return false;
        }
      }
      
      // Date range filter
      if (filters.dateRange) {
        const itemDate = new Date(item.timestamp || item.id);
        const { start, end } = filters.dateRange;
        if (start && itemDate < start) return false;
        if (end && itemDate > end) return false;
      }
      
      // CP range filter
      if (filters.cpRange) {
        const cp = item.context_precision || item.cp;
        if (cp === undefined || cp < filters.cpRange.min || cp > filters.cpRange.max) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Rank results by relevance
   */
  rankResults(results, query) {
    return results.sort((a, b) => {
      // Primary: search score
      if (b.searchScore !== a.searchScore) {
        return b.searchScore - a.searchScore;
      }
      
      // Secondary: recency
      const timeA = new Date(a.timestamp || a.id).getTime();
      const timeB = new Date(b.timestamp || b.id).getTime();
      return timeB - timeA;
    });
  }
  
  /**
   * Get search suggestions
   */
  getSuggestions(query) {
    const suggestions = [];
    const queryLower = query.toLowerCase();
    
    // Common search patterns
    const patterns = [
      'authentication',
      'refactoring',
      'bug fix',
      'api endpoint',
      'database',
      'test',
      'component'
    ];
    
    patterns.forEach(pattern => {
      if (pattern.toLowerCase().includes(queryLower) || queryLower.includes(pattern.toLowerCase())) {
        suggestions.push({
          text: pattern,
          type: 'pattern'
        });
      }
    });
    
    return suggestions.slice(0, 5);
  }
}

// Export
if (typeof window !== 'undefined') {
  window.EnhancedSearchService = EnhancedSearchService;
}

