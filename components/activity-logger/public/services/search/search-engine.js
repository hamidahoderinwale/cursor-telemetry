/**
 * Advanced Semantic Search Engine for Cursor Activity Dashboard
 * 
 * Features:
 * - Full-text search with Lunr.js
 * - BM25 ranking algorithm (superior to TF-IDF for search)
 * - Semantic search with query expansion
 * - Natural language query understanding
 * - Context-aware result boosting
 * - Fuzzy matching for typo tolerance
 * - Advanced query parser (type:, workspace:, date:, etc.)
 * - Result clustering and grouping
 * - Snippet extraction with context highlighting
 * - Search analytics and relevance feedback
 * - Query suggestions and autocomplete
 */

class SearchEngine {
  constructor() {
    this.lunrIndex = null;
    this.documents = [];
    this.tfidfVectors = new Map(); // For semantic search
    this.bm25Index = new Map(); // BM25 scores cache
    this.searchHistory = this.loadSearchHistory();
    this.searchAnalytics = this.loadSearchAnalytics();
    this.synonyms = this.buildSynonymMap();
    this.stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    this.initialized = false;
    
    // BM25 parameters
    this.k1 = 1.5; // Term frequency saturation parameter
    this.b = 0.75; // Length normalization parameter
    this.avgDocLength = 0;
  }

  /**
   * Build synonym map for query expansion
   */
  buildSynonymMap() {
    return new Map([
      // Programming concepts
      ['function', ['func', 'method', 'procedure', 'routine']],
      ['variable', ['var', 'const', 'let']],
      ['class', ['type', 'interface', 'struct']],
      ['bug', ['error', 'issue', 'problem', 'defect']],
      ['fix', ['repair', 'correct', 'resolve', 'patch']],
      ['refactor', ['restructure', 'reorganize', 'cleanup']],
      ['test', ['spec', 'unittest', 'check']],
      ['implement', ['add', 'create', 'build']],
      ['update', ['modify', 'change', 'edit']],
      ['delete', ['remove', 'drop', 'erase']],
      
      // AI/ML terms
      ['prompt', ['query', 'request', 'question']],
      ['ai', ['artificial intelligence', 'ml', 'machine learning']],
      ['model', ['llm', 'gpt', 'assistant']],
      ['context', ['scope', 'environment', 'state']],
      
      // File operations
      ['file', ['document', 'source', 'code']],
      ['folder', ['directory', 'dir', 'path']],
      ['import', ['require', 'include', 'load']],
      ['export', ['expose', 'publish', 'output']]
    ]);
  }

  /**
   * Initialize search index with all searchable data
   */
  async initialize(data) {
    console.log('[SEARCH] Initializing search engine...');
    
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
    
    // Build BM25 index
    this.buildBM25Index(docs);

    this.initialized = true;
    console.log(`[SUCCESS] Search engine initialized with ${this.documents.length} documents`);
  }

  /**
   * Build BM25 index for better ranking
   * BM25 is a probabilistic ranking function that improves upon TF-IDF
   */
  buildBM25Index(docs) {
    // Calculate average document length
    const totalLength = docs.reduce((sum, doc) => sum + this.tokenize(doc.content).length, 0);
    this.avgDocLength = totalLength / docs.length;
    
    // Calculate document frequencies
    const docFrequency = new Map();
    docs.forEach(doc => {
      const tokens = new Set(this.tokenize(doc.content));
      tokens.forEach(token => {
        docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
      });
    });
    
    // Store BM25 data for each document
    docs.forEach(doc => {
      const tokens = this.tokenize(doc.content);
      const tokenCounts = new Map();
      
      tokens.forEach(token => {
        tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
      });
      
      this.bm25Index.set(doc.id, {
        length: tokens.length,
        tokenCounts,
        docFrequency
      });
    });
  }

  /**
   * Calculate BM25 score for a document given a query
   * BM25 = Σ(IDF(qi) * (f(qi,D) * (k1 + 1)) / (f(qi,D) + k1 * (1 - b + b * |D| / avgdl)))
   */
  calculateBM25Score(query, docId) {
    const queryTokens = this.tokenize(query);
    const bm25Data = this.bm25Index.get(docId);
    
    if (!bm25Data) return 0;
    
    const { length, tokenCounts, docFrequency } = bm25Data;
    const N = this.documents.length;
    let score = 0;
    
    queryTokens.forEach(token => {
      const df = docFrequency.get(token) || 0;
      const tf = tokenCounts.get(token) || 0;
      
      if (tf === 0) return;
      
      // IDF component
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      
      // TF component with length normalization
      const lengthNorm = 1 - this.b + this.b * (length / this.avgDocLength);
      const tfComponent = (tf * (this.k1 + 1)) / (tf + this.k1 * lengthNorm);
      
      score += idf * tfComponent;
    });
    
    return score;
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
   * Main search function with advanced ranking
   * Combines full-text, BM25, semantic, and fuzzy search
   */
  search(queryString, options = {}) {
    if (!this.initialized || !queryString.trim()) {
      return [];
    }

    const startTime = performance.now();
    const { searchText, filters } = this.parseQuery(queryString);
    
    // Expand query with synonyms
    const expandedQuery = this.expandQuery(searchText);
    
    let results = [];
    const resultMap = new Map(); // To deduplicate and merge scores

    // 1. Full-text search with Lunr
    if (searchText) {
      try {
        const lunrResults = this.lunrIndex.search(expandedQuery);
        lunrResults.forEach(result => {
          const doc = this.documents.find(d => d.id === result.ref);
          if (doc) {
            resultMap.set(result.ref, {
              ...doc,
              lunrScore: result.score,
              searchMethods: ['fulltext']
            });
          }
        });
      } catch (e) {
        console.warn('Lunr search error:', e);
        // Fallback to original query
        try {
          const lunrResults = this.lunrIndex.search(searchText);
          lunrResults.forEach(result => {
            const doc = this.documents.find(d => d.id === result.ref);
            if (doc) {
              resultMap.set(result.ref, {
                ...doc,
                lunrScore: result.score,
                searchMethods: ['fulltext']
              });
            }
          });
        } catch (e2) {
          console.warn('Fallback search also failed:', e2);
        }
      }
    }

    // 2. BM25 ranking for all documents
    if (searchText && resultMap.size < 50) {
      this.documents.forEach(doc => {
        const bm25Score = this.calculateBM25Score(searchText, doc.id);
        if (bm25Score > 0.5) {
          if (resultMap.has(doc.id)) {
            resultMap.get(doc.id).bm25Score = bm25Score;
            if (!resultMap.get(doc.id).searchMethods.includes('bm25')) {
              resultMap.get(doc.id).searchMethods.push('bm25');
            }
          } else {
            resultMap.set(doc.id, {
              ...doc,
              bm25Score,
              searchMethods: ['bm25']
            });
          }
        }
      });
    }

    // 3. Semantic search (TF-IDF cosine similarity)
    if (searchText && resultMap.size < 30) {
      const semanticResults = this.semanticSearch(searchText, 15);
      semanticResults.forEach(sr => {
        if (resultMap.has(sr.id)) {
          resultMap.get(sr.id).semanticScore = sr.score;
          if (!resultMap.get(sr.id).searchMethods.includes('semantic')) {
            resultMap.get(sr.id).searchMethods.push('semantic');
          }
        } else {
          resultMap.set(sr.id, {
            ...sr,
            semanticScore: sr.score,
            searchMethods: ['semantic']
          });
        }
      });
    }

    // 4. Fuzzy search fallback
    if (searchText && resultMap.size < 10) {
      const fuzzyResults = this.fuzzySearch(searchText, 8);
      fuzzyResults.forEach(fr => {
        if (resultMap.has(fr.id)) {
          resultMap.get(fr.id).fuzzyScore = fr.score;
          if (!resultMap.get(fr.id).searchMethods.includes('fuzzy')) {
            resultMap.get(fr.id).searchMethods.push('fuzzy');
          }
        } else {
          resultMap.set(fr.id, {
            ...fr,
            fuzzyScore: fr.score,
            searchMethods: ['fuzzy']
          });
        }
      });
    }

    // Convert map to array
    results = Array.from(resultMap.values());

    // 5. Calculate combined score with weights
    results = results.map(result => {
      const lunrScore = result.lunrScore || 0;
      const bm25Score = result.bm25Score || 0;
      const semanticScore = result.semanticScore || 0;
      const fuzzyScore = result.fuzzyScore || 0;
      
      // Weighted combination (BM25 is most important)
      const combinedScore = (
        bm25Score * 0.45 +
        lunrScore * 0.30 +
        semanticScore * 0.20 +
        fuzzyScore * 0.05
      );
      
      // Context-aware boosting
      const boostedScore = this.applyContextBoost(result, searchText, combinedScore);
      
      return {
        ...result,
        score: boostedScore,
        _debug: { lunrScore, bm25Score, semanticScore, fuzzyScore, combinedScore, boostedScore }
      };
    });

    // 6. Apply filters
    results = this.applyFilters(results, filters);

    // 7. Sort by score and recency
    results.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // 8. Extract snippets with highlighting
    results = results.map(result => ({
      ...result,
      snippet: this.extractSnippet(result.content, searchText, 200),
      searchMethod: result.searchMethods.join('+')
    }));

    // 9. Add to search history and analytics
    if (searchText) {
      this.addToHistory(queryString);
      this.trackSearch(queryString, results.length, performance.now() - startTime);
    }

    return results.slice(0, options.limit || 50);
  }

  /**
   * Expand query with synonyms for better recall
   */
  expandQuery(query) {
    const tokens = this.tokenize(query);
    const expandedTokens = new Set(tokens);
    
    tokens.forEach(token => {
      if (this.synonyms.has(token)) {
        this.synonyms.get(token).forEach(syn => expandedTokens.add(syn));
      }
      // Also check reverse mapping
      this.synonyms.forEach((synonyms, key) => {
        if (synonyms.includes(token)) {
          expandedTokens.add(key);
        }
      });
    });
    
    return Array.from(expandedTokens).join(' ');
  }

  /**
   * Apply context-aware boosting to search results
   */
  applyContextBoost(result, query, baseScore) {
    let boost = 1.0;
    
    // Boost recent items
    const age = Date.now() - new Date(result.timestamp).getTime();
    const dayAge = age / (1000 * 60 * 60 * 24);
    if (dayAge < 1) boost *= 1.3;
    else if (dayAge < 7) boost *= 1.15;
    else if (dayAge < 30) boost *= 1.05;
    
    // Boost by type preference (learn from analytics)
    const typePreference = this.getTypePreference(result.type);
    boost *= (1 + typePreference * 0.2);
    
    // Boost exact title matches
    if (result.title.toLowerCase().includes(query.toLowerCase())) {
      boost *= 1.4;
    }
    
    // Boost by metadata relevance
    if (result.metadata) {
      // High context usage in prompts is important
      if (result.metadata.contextUsage > 50) boost *= 1.1;
      
      // Large changes are often important
      if (result.metadata.linesAdded > 100) boost *= 1.08;
      
      // Recent conversations are valuable
      if (result.metadata.isConversation) boost *= 1.05;
    }
    
    return baseScore * boost;
  }

  /**
   * Get user's type preference from search analytics
   */
  getTypePreference(type) {
    if (!this.searchAnalytics.clicks) return 0;
    
    const totalClicks = Object.values(this.searchAnalytics.clicks).reduce((sum, count) => sum + count, 0);
    const typeClicks = this.searchAnalytics.clicks[type] || 0;
    
    if (totalClicks === 0) return 0;
    
    // Return normalized preference (-0.5 to 0.5)
    const avgPreference = 1 / Object.keys(this.searchAnalytics.clicks).length;
    return (typeClicks / totalClicks) - avgPreference;
  }

  /**
   * Extract relevant snippet with context
   */
  extractSnippet(content, query, maxLength = 200) {
    if (!query || !content) return content.substring(0, maxLength);
    
    const queryTokens = this.tokenize(query);
    const sentences = content.split(/[.!?]\s+/);
    
    // Find sentence with most query tokens
    let bestSentence = sentences[0] || '';
    let bestScore = 0;
    
    sentences.forEach(sentence => {
      const sentenceTokens = this.tokenize(sentence);
      const score = queryTokens.filter(qt => sentenceTokens.includes(qt)).length;
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence;
      }
    });
    
    // Truncate if needed, keeping query terms in view
    if (bestSentence.length > maxLength) {
      const queryPos = bestSentence.toLowerCase().indexOf(queryTokens[0]);
      if (queryPos > maxLength / 2) {
        const start = Math.max(0, queryPos - maxLength / 2);
        bestSentence = '...' + bestSentence.substring(start, start + maxLength);
      } else {
        bestSentence = bestSentence.substring(0, maxLength) + '...';
      }
    }
    
    return bestSentence;
  }

  /**
   * Track search for analytics
   */
  trackSearch(query, resultCount, duration) {
    if (!this.searchAnalytics.searches) {
      this.searchAnalytics.searches = [];
    }
    
    this.searchAnalytics.searches.push({
      query,
      resultCount,
      duration,
      timestamp: Date.now()
    });
    
    // Keep only last 100 searches
    if (this.searchAnalytics.searches.length > 100) {
      this.searchAnalytics.searches = this.searchAnalytics.searches.slice(-100);
    }
    
    this.saveSearchAnalytics();
  }

  /**
   * Track result click for relevance feedback
   */
  trackClick(resultType, resultId) {
    if (!this.searchAnalytics.clicks) {
      this.searchAnalytics.clicks = {};
    }
    
    this.searchAnalytics.clicks[resultType] = (this.searchAnalytics.clicks[resultType] || 0) + 1;
    this.saveSearchAnalytics();
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
   * Get enhanced search suggestions with grouping
   */
  getSuggestions(partialQuery) {
    const suggestions = {
      history: [],
      filters: [],
      completions: [],
      popular: []
    };

    if (!partialQuery) {
      // Show recent history and popular searches
      suggestions.history = this.searchHistory.slice(0, 5);
      suggestions.popular = this.getPopularSearches().slice(0, 3);
      suggestions.filters = [
        { text: 'type:prompt', description: 'Search AI prompts only' },
        { text: 'type:event', description: 'Search file changes only' },
        { text: 'date:today', description: 'Today\'s activity' },
        { text: 'date:week', description: 'This week\'s activity' }
      ];
      return suggestions;
    }

    const lower = partialQuery.toLowerCase();

    // Add matching history items
    this.searchHistory.forEach(query => {
      if (query.toLowerCase().includes(lower)) {
        suggestions.history.push(query);
      }
    });
    suggestions.history = suggestions.history.slice(0, 5);

    // Add filter suggestions
    const allFilters = [
      { text: 'type:prompt', description: 'Search AI prompts only' },
      { text: 'type:event', description: 'Search file changes only' },
      { text: 'type:workspace', description: 'Search workspaces' },
      { text: 'date:today', description: 'Today\'s activity' },
      { text: 'date:yesterday', description: 'Yesterday\'s activity' },
      { text: 'date:week', description: 'This week\'s activity' },
      { text: 'date:month', description: 'This month\'s activity' },
      { text: 'mode:agent', description: 'Agent mode prompts' },
      { text: 'mode:chat', description: 'Chat mode prompts' },
      { text: 'mode:composer', description: 'Composer prompts' },
      { text: 'context:true', description: 'Prompts with context' }
    ];

    allFilters.forEach(filter => {
      if (filter.text.includes(lower) || filter.description.toLowerCase().includes(lower)) {
        suggestions.filters.push(filter);
      }
    });
    suggestions.filters = suggestions.filters.slice(0, 4);

    // Add term completions from document corpus
    if (lower.length >= 2) {
      const completions = this.getTermCompletions(lower);
      suggestions.completions = completions.slice(0, 5);
    }

    // Add synonym suggestions
    if (this.synonyms.has(lower)) {
      suggestions.synonyms = this.synonyms.get(lower).slice(0, 3);
    }

    return suggestions;
  }

  /**
   * Get popular searches from analytics
   */
  getPopularSearches() {
    if (!this.searchAnalytics.searches || this.searchAnalytics.searches.length === 0) {
      return [];
    }

    // Count query frequencies
    const queryCounts = new Map();
    this.searchAnalytics.searches.forEach(search => {
      queryCounts.set(search.query, (queryCounts.get(search.query) || 0) + 1);
    });

    // Sort by frequency
    return Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([query]) => query)
      .slice(0, 5);
  }

  /**
   * Get term completions from document corpus
   */
  getTermCompletions(prefix) {
    const completions = new Set();
    const prefixLower = prefix.toLowerCase();

    // Search through all tokenized terms
    this.documents.forEach(doc => {
      const tokens = this.tokenize(doc.content);
      tokens.forEach(token => {
        if (token.startsWith(prefixLower) && token.length > prefixLower.length && !this.stopWords.has(token)) {
          completions.add(token);
        }
      });
    });

    return Array.from(completions).slice(0, 10);
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

  /**
   * Load search analytics from localStorage
   */
  loadSearchAnalytics() {
    try {
      const analytics = localStorage.getItem('cursor-dashboard-search-analytics');
      return analytics ? JSON.parse(analytics) : { searches: [], clicks: {} };
    } catch (e) {
      return { searches: [], clicks: {} };
    }
  }

  /**
   * Save search analytics to localStorage
   */
  saveSearchAnalytics() {
    try {
      localStorage.setItem('cursor-dashboard-search-analytics', JSON.stringify(this.searchAnalytics));
    } catch (e) {
      console.warn('Failed to save search analytics:', e);
    }
  }

  /**
   * Get search analytics summary
   */
  getAnalyticsSummary() {
    const searches = this.searchAnalytics.searches || [];
    const clicks = this.searchAnalytics.clicks || {};

    return {
      totalSearches: searches.length,
      avgResultCount: searches.length > 0 
        ? searches.reduce((sum, s) => sum + s.resultCount, 0) / searches.length 
        : 0,
      avgDuration: searches.length > 0
        ? searches.reduce((sum, s) => sum + s.duration, 0) / searches.length
        : 0,
      popularSearches: this.getPopularSearches(),
      typePreferences: clicks,
      totalClicks: Object.values(clicks).reduce((sum, count) => sum + count, 0),
      recentSearches: searches.slice(-10).reverse()
    };
  }

  /**
   * Group search results by category
   */
  groupResults(results) {
    const grouped = {
      prompts: [],
      events: [],
      workspaces: [],
      other: []
    };

    results.forEach(result => {
      const category = result.type === 'prompt' ? 'prompts'
        : result.type === 'event' ? 'events'
        : result.type === 'workspace' ? 'workspaces'
        : 'other';
      
      grouped[category].push(result);
    });

    return grouped;
  }

  /**
   * Cluster similar results
   */
  clusterResults(results, maxClusters = 5) {
    if (results.length === 0) return [];

    // Simple clustering by file path similarity for events
    const clusters = [];
    const used = new Set();

    results.forEach((result, idx) => {
      if (used.has(idx)) return;

      const cluster = {
        representative: result,
        members: [result],
        score: result.score
      };

      // Find similar results
      for (let i = idx + 1; i < results.length && cluster.members.length < 5; i++) {
        if (used.has(i)) continue;

        const other = results[i];
        
        // Check similarity
        const isSimilar = this.areResultsSimilar(result, other);
        
        if (isSimilar) {
          cluster.members.push(other);
          cluster.score = Math.max(cluster.score, other.score);
          used.add(i);
        }
      }

      clusters.push(cluster);
      used.add(idx);

      if (clusters.length >= maxClusters) return;
    });

    return clusters;
  }

  /**
   * Check if two results are similar (for clustering)
   */
  areResultsSimilar(r1, r2) {
    // Same type
    if (r1.type !== r2.type) return false;

    // For events: same file or nearby in path
    if (r1.type === 'event' && r1.filePath && r2.filePath) {
      const path1Parts = r1.filePath.split('/');
      const path2Parts = r2.filePath.split('/');
      
      // Same directory or file
      if (path1Parts.slice(0, -1).join('/') === path2Parts.slice(0, -1).join('/')) {
        return true;
      }
    }

    // For prompts: same workspace or conversation
    if (r1.type === 'prompt') {
      if (r1.workspace === r2.workspace && Math.abs(new Date(r1.timestamp) - new Date(r2.timestamp)) < 3600000) {
        return true;
      }
      
      if (r1.metadata?.composerId && r1.metadata?.composerId === r2.metadata?.composerId) {
        return true;
      }
    }

    return false;
  }
}

// Export for use in dashboard
window.SearchEngine = SearchEngine;


