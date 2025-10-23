/**
 * Sophisticated Search Engine for Cursor Activity Dashboard
 * 
 * Features:
 * - Full-text search with Lunr.js
 * - Semantic search using TF-IDF
 * - Fuzzy matching for typo tolerance
 * - Advanced query parser (type:, workspace:, date:, etc.)
 * - Result ranking and clustering
 * - Search history and suggestions
 */

class SearchEngine {
  constructor() {
    this.lunrIndex = null;
    this.documents = [];
    this.tfidfVectors = new Map(); // For semantic search
    this.searchHistory = this.loadSearchHistory();
    this.initialized = false;
  }

  /**
   * Initialize search index with all searchable data
   */
  async initialize(data) {
    console.log('🔍 Initializing search engine...');
    
    this.documents = [];
    const docs = [];

    // Index events (file changes)
    if (data.events && Array.isArray(data.events)) {
      data.events.forEach((event, idx) => {
        try {
          const details = typeof event.details === 'string' ? JSON.parse(event.details) : event.details;
          const filePath = details?.file_path || event.file_path || '';
          const fileName = filePath.split('/').pop() || '';
          
          const doc = {
            id: `event-${event.id || idx}`,
            type: 'event',
            title: fileName || 'File Change',
            content: `${fileName} ${filePath} ${details?.before_content || ''} ${details?.after_content || ''}`,
            filePath: filePath,
            timestamp: event.timestamp,
            workspace: event.workspace || 'unknown',
            metadata: {
              linesAdded: details?.lines_added || 0,
              linesRemoved: details?.lines_removed || 0,
              changeType: event.type
            },
            raw: event
          };
          
          docs.push(doc);
          this.documents.push(doc);
        } catch (e) {
          // Skip malformed events
        }
      });
    }

    // Index prompts (AI interactions)
    if (data.prompts && Array.isArray(data.prompts)) {
      data.prompts.forEach((prompt, idx) => {
        const text = prompt.text || prompt.prompt || prompt.preview || prompt.content || '';
        const isJsonLike = text.startsWith('{') || text.startsWith('[');
        const isComposerConversation = prompt.source === 'composer' && prompt.type === 'conversation';
        
        // Include composer conversations for search (they're still useful to find)
        if (!isJsonLike && text.length > 5) {
          const doc = {
            id: `prompt-${prompt.id || idx}`,
            type: 'prompt',
            title: isComposerConversation ? `Conversation: ${text}` : text.substring(0, 100),
            content: text,
            timestamp: prompt.timestamp,
            workspace: prompt.workspaceName || prompt.workspaceId || 'unknown',
            metadata: {
              source: prompt.source || 'cursor',
              composerId: prompt.composerId,
              contextUsage: prompt.contextUsage || 0,
              mode: prompt.mode || 'unknown',
              isConversation: isComposerConversation
            },
            raw: prompt
          };
          
          docs.push(doc);
          this.documents.push(doc);
        }
      });
    }

    // Index workspaces
    if (data.workspaces && Array.isArray(data.workspaces)) {
      data.workspaces.forEach((ws, idx) => {
        const doc = {
          id: `workspace-${idx}`,
          type: 'workspace',
          title: ws.name || ws.path || 'Unknown Workspace',
          content: `${ws.name || ''} ${ws.path || ''} ${ws.description || ''}`,
          timestamp: ws.lastActivity || Date.now(),
          workspace: ws.name,
          metadata: {
            path: ws.path,
            entryCount: ws.entryCount || 0,
            eventCount: ws.eventCount || 0
          },
          raw: ws
        };
        
        docs.push(doc);
        this.documents.push(doc);
      });
    }

    // Build Lunr index for full-text search
    this.lunrIndex = lunr(function() {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('content');
      this.field('type', { boost: 5 });
      this.field('workspace', { boost: 3 });
      
      docs.forEach(doc => {
        this.add({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          type: doc.type,
          workspace: doc.workspace
        });
      });
    });

    // Build TF-IDF vectors for semantic search
    this.buildTFIDFVectors(docs);

    this.initialized = true;
    console.log(`✅ Search engine initialized with ${this.documents.length} documents`);
  }

  /**
   * Build TF-IDF vectors for semantic search
   */
  buildTFIDFVectors(docs) {
    // Simple TF-IDF implementation
    const termFrequency = new Map();
    const documentFrequency = new Map();
    
    // Calculate term frequencies
    docs.forEach(doc => {
      const tokens = this.tokenize(doc.content);
      const termCounts = new Map();
      
      tokens.forEach(token => {
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
        if (!documentFrequency.has(token)) {
          documentFrequency.set(token, 0);
        }
        if (termCounts.get(token) === 1) {
          documentFrequency.set(token, documentFrequency.get(token) + 1);
        }
      });
      
      termFrequency.set(doc.id, termCounts);
    });
    
    // Calculate TF-IDF vectors
    const numDocs = docs.length;
    docs.forEach(doc => {
      const vector = new Map();
      const termCounts = termFrequency.get(doc.id) || new Map();
      
      termCounts.forEach((count, term) => {
        const tf = count / Math.max(...Array.from(termCounts.values()));
        const idf = Math.log(numDocs / (documentFrequency.get(term) || 1));
        vector.set(term, tf * idf);
      });
      
      this.tfidfVectors.set(doc.id, vector);
    });
  }

  /**
   * Tokenize text for TF-IDF
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Parse advanced query syntax
   * Examples:
   * - "dashboard" -> simple search
   * - "type:prompt dashboard" -> filter by type
   * - "workspace:cursor-telemetry fix" -> filter by workspace
   * - "date:today dashboard" -> filter by date
   * - "mode:agent" -> filter by AI mode
   */
  parseQuery(queryString) {
    const filters = {
      type: null,
      workspace: null,
      date: null,
      mode: null,
      hasContext: null
    };
    
    let searchText = queryString;
    
    // Extract filters
    const filterPattern = /(\w+):(\S+)/g;
    let match;
    
    while ((match = filterPattern.exec(queryString)) !== null) {
      const [fullMatch, key, value] = match;
      searchText = searchText.replace(fullMatch, '').trim();
      
      switch (key.toLowerCase()) {
        case 'type':
          filters.type = value.toLowerCase();
          break;
        case 'workspace':
        case 'ws':
          filters.workspace = value.toLowerCase();
          break;
        case 'date':
          filters.date = this.parseDateFilter(value);
          break;
        case 'mode':
          filters.mode = value.toLowerCase();
          break;
        case 'context':
          filters.hasContext = value.toLowerCase() === 'true' || value === 'yes';
          break;
      }
    }
    
    return {
      searchText: searchText.trim(),
      filters
    };
  }

  /**
   * Parse date filter (today, yesterday, week, month, YYYY-MM-DD)
   */
  parseDateFilter(value) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (value.toLowerCase()) {
      case 'today':
        return { start: today.getTime(), end: Date.now() };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday.getTime(), end: today.getTime() };
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: weekAgo.getTime(), end: Date.now() };
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { start: monthAgo.getTime(), end: Date.now() };
      default:
        // Try parsing as YYYY-MM-DD
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          const dayEnd = new Date(parsed);
          dayEnd.setDate(dayEnd.getDate() + 1);
          return { start: parsed.getTime(), end: dayEnd.getTime() };
        }
        return null;
    }
  }

  /**
   * Main search function
   * Combines full-text, semantic, and fuzzy search
   */
  search(queryString, options = {}) {
    if (!this.initialized || !queryString.trim()) {
      return [];
    }

    const { searchText, filters } = this.parseQuery(queryString);
    let results = [];

    // 1. Full-text search with Lunr
    if (searchText) {
      try {
        const lunrResults = this.lunrIndex.search(searchText);
        results = lunrResults.map(result => {
          const doc = this.documents.find(d => d.id === result.ref);
          return {
            ...doc,
            score: result.score,
            searchMethod: 'fulltext'
          };
        });
      } catch (e) {
        console.warn('Lunr search error:', e);
      }
    }

    // 2. Semantic search (if no full-text results or low scores)
    if (results.length === 0 || (results[0] && results[0].score < 0.5)) {
      const semanticResults = this.semanticSearch(searchText, 10);
      semanticResults.forEach(sr => {
        if (!results.find(r => r.id === sr.id)) {
          results.push(sr);
        }
      });
    }

    // 3. Fuzzy search fallback
    if (results.length < 3 && searchText) {
      const fuzzyResults = this.fuzzySearch(searchText, 5);
      fuzzyResults.forEach(fr => {
        if (!results.find(r => r.id === fr.id)) {
          results.push(fr);
        }
      });
    }

    // 4. Apply filters
    results = this.applyFilters(results, filters);

    // 5. Sort by score and recency
    results.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // 6. Add to search history
    if (searchText) {
      this.addToHistory(queryString);
    }

    return results.slice(0, options.limit || 50);
  }

  /**
   * Semantic search using TF-IDF cosine similarity
   */
  semanticSearch(query, limit = 10) {
    if (!query) return [];

    const queryTokens = this.tokenize(query);
    const queryVector = new Map();
    
    queryTokens.forEach(token => {
      queryVector.set(token, (queryVector.get(token) || 0) + 1);
    });

    const results = [];
    
    this.documents.forEach(doc => {
      const docVector = this.tfidfVectors.get(doc.id);
      if (!docVector) return;
      
      const similarity = this.cosineSimilarity(queryVector, docVector);
      if (similarity > 0.1) {
        results.push({
          ...doc,
          score: similarity,
          searchMethod: 'semantic'
        });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(v1, v2) {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    const allKeys = new Set([...v1.keys(), ...v2.keys()]);
    
    allKeys.forEach(key => {
      const val1 = v1.get(key) || 0;
      const val2 = v2.get(key) || 0;
      dotProduct += val1 * val2;
      mag1 += val1 * val1;
      mag2 += val2 * val2;
    });

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Fuzzy search using Levenshtein distance
   */
  fuzzySearch(query, limit = 5) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    this.documents.forEach(doc => {
      const titleLower = doc.title.toLowerCase();
      const distance = this.levenshteinDistance(queryLower, titleLower);
      const maxLen = Math.max(queryLower.length, titleLower.length);
      const similarity = 1 - (distance / maxLen);
      
      if (similarity > 0.6) {
        results.push({
          ...doc,
          score: similarity,
          searchMethod: 'fuzzy'
        });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Calculate Levenshtein distance (edit distance)
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Apply filters to search results
   */
  applyFilters(results, filters) {
    return results.filter(result => {
      // Type filter
      if (filters.type && result.type !== filters.type) {
        return false;
      }

      // Workspace filter
      if (filters.workspace) {
        const wsLower = result.workspace.toLowerCase();
        if (!wsLower.includes(filters.workspace)) {
          return false;
        }
      }

      // Date filter
      if (filters.date) {
        const timestamp = new Date(result.timestamp).getTime();
        if (timestamp < filters.date.start || timestamp > filters.date.end) {
          return false;
        }
      }

      // Mode filter (for prompts)
      if (filters.mode && result.metadata?.mode) {
        if (result.metadata.mode.toLowerCase() !== filters.mode) {
          return false;
        }
      }

      // Context filter (for prompts with context usage)
      if (filters.hasContext !== null && result.metadata?.contextUsage !== undefined) {
        const hasContext = result.metadata.contextUsage > 0;
        if (hasContext !== filters.hasContext) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get search suggestions based on history and current query
   */
  getSuggestions(partialQuery) {
    if (!partialQuery) {
      return this.searchHistory.slice(0, 5);
    }

    const lower = partialQuery.toLowerCase();
    const suggestions = [];

    // Add matching history items
    this.searchHistory.forEach(query => {
      if (query.toLowerCase().includes(lower)) {
        suggestions.push(query);
      }
    });

    // Add common filters as suggestions
    if (lower.length < 5) {
      const filters = [
        'type:prompt',
        'type:event',
        'type:workspace',
        'date:today',
        'date:week',
        'date:month',
        'mode:agent',
        'mode:chat',
        'workspace:'
      ];

      filters.forEach(filter => {
        if (filter.startsWith(lower)) {
          suggestions.push(filter);
        }
      });
    }

    return suggestions.slice(0, 8);
  }

  /**
   * Add query to search history
   */
  addToHistory(query) {
    if (!query || query.length < 2) return;

    this.searchHistory = this.searchHistory.filter(q => q !== query);
    this.searchHistory.unshift(query);
    this.searchHistory = this.searchHistory.slice(0, 20);
    
    this.saveSearchHistory();
  }

  /**
   * Load search history from localStorage
   */
  loadSearchHistory() {
    try {
      const history = localStorage.getItem('cursor-dashboard-search-history');
      return history ? JSON.parse(history) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Save search history to localStorage
   */
  saveSearchHistory() {
    try {
      localStorage.setItem('cursor-dashboard-search-history', JSON.stringify(this.searchHistory));
    } catch (e) {
      console.warn('Failed to save search history:', e);
    }
  }

  /**
   * Clear search history
   */
  clearHistory() {
    this.searchHistory = [];
    localStorage.removeItem('cursor-dashboard-search-history');
  }
}

// Export for use in dashboard
window.SearchEngine = SearchEngine;

