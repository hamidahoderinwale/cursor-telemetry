/**
 * Advanced Semantic Search Engine for Cursor Telemetry Dashboard
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
    this.bm25DocFrequency = new Map(); // Shared document frequency for BM25
    this.searchHistory = this.loadSearchHistory();
    this.searchAnalytics = this.loadSearchAnalytics();
    this.synonyms = this.buildSynonymMap();
    this.stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    this.initialized = false;
    
    // BM25 parameters
    this.k1 = 1.5; // Term frequency saturation parameter
    this.b = 0.75; // Length normalization parameter
    this.avgDocLength = 0;
    
    // Hugging Face semantic search (optional, lazy-loaded)
    this.hfSemanticSearch = null;
    this.useHuggingFace = false; // Enable/disable HF search
  }

  /**
   * Build Lunr index in chunks to prevent timeout
   * Uses async yielding to prevent browser script timeout
   */
  async buildLunrIndexChunked(docs) {
    const CHUNK_SIZE = 500; // Smaller chunks for better yielding
    const MAX_DOCS = 10000; // Limit total docs to prevent timeout
    
    // Limit total documents if too many
    const docsToIndex = docs.length > MAX_DOCS ? docs.slice(0, MAX_DOCS) : docs;
    if (docs.length > MAX_DOCS) {
      console.log(`[SEARCH] Limiting index to ${MAX_DOCS} most recent documents (out of ${docs.length} total)`);
    }
    
    const chunks = [];
    for (let i = 0; i < docsToIndex.length; i += CHUNK_SIZE) {
      chunks.push(docsToIndex.slice(i, i + CHUNK_SIZE));
    }
    
    console.log(`[SEARCH] Building index in ${chunks.length} chunks (${docsToIndex.length} total docs)...`);
    
    // Use Builder API for incremental building
    const builder = new lunr.Builder();
    builder.ref('id');
    builder.field('title', { boost: 10 });
    builder.field('content');
    builder.field('type', { boost: 5 });
    builder.field('workspace', { boost: 3 });
    
    // Add documents in chunks with yields
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Add chunk documents
      chunk.forEach(doc => {
        builder.add({
          id: doc.id,
          title: doc.title || '',
          content: (doc.content || '').substring(0, 5000), // Limit content length
          type: doc.type || '',
          workspace: doc.workspace || ''
        });
      });
      
      // Yield every chunk to prevent blocking
      if (i < chunks.length - 1) {
        await new Promise(resolve => {
          // Use requestIdleCallback if available, else setTimeout
          if (window.requestIdleCallback) {
            requestIdleCallback(resolve, { timeout: 50 });
          } else {
            setTimeout(resolve, 10);
          }
        });
      }
      
      if ((i + 1) % 5 === 0) {
        console.log(`[SEARCH] Index building progress: ${i + 1}/${chunks.length} chunks`);
      }
    }
    
    // Build final index
    return builder.build();
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
    // Skip Lunr for very large datasets (>3000 docs) to prevent browser timeout
    // Use BM25-based search instead which is more efficient for large datasets
    try {
      if (docs.length > 3000) {
        console.log(`[SEARCH] Large dataset (${docs.length} docs), skipping Lunr to prevent timeout`);
        console.log(`[SEARCH] Using BM25-based search instead (faster, no timeout risk)`);
        this.lunrIndex = null; // Skip Lunr, use BM25 only
      } else if (docs.length > 1000) {
        // For medium datasets, try building with timeout protection
        console.log(`[SEARCH] Medium dataset (${docs.length} docs), building Lunr index with timeout protection...`);
        try {
          const buildPromise = new Promise((resolve, reject) => {
            try {
              const index = lunr(function() {
                this.ref('id');
                this.field('title', { boost: 10 });
                this.field('content');
                this.field('type', { boost: 5 });
                this.field('workspace', { boost: 3 });
                
                docs.forEach(doc => {
                  this.add({
                    id: doc.id,
                    title: doc.title || '',
                    content: (doc.content || '').substring(0, 3000), // Limit content length
                    type: doc.type || '',
                    workspace: doc.workspace || ''
                  });
                });
              });
              resolve(index);
            } catch (err) {
              reject(err);
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Lunr build timeout')), 10000)
          );
          
          this.lunrIndex = await Promise.race([buildPromise, timeoutPromise]);
          console.log('[SEARCH] Lunr index built successfully');
        } catch (error) {
          console.warn('[SEARCH] Lunr build failed or timed out, using BM25 search:', error.message);
          this.lunrIndex = null;
        }
      } else {
        // For smaller datasets, build normally
        this.lunrIndex = lunr(function() {
          this.ref('id');
          this.field('title', { boost: 10 });
          this.field('content');
          this.field('type', { boost: 5 });
          this.field('workspace', { boost: 3 });
          
          docs.forEach(doc => {
            this.add({
              id: doc.id,
              title: doc.title || '',
              content: (doc.content || '').substring(0, 5000), // Limit content length
              type: doc.type || '',
              workspace: doc.workspace || ''
            });
          });
        });
        console.log('[SEARCH] Lunr index built successfully');
      }
    } catch (error) {
      console.warn('[SEARCH] Lunr index build failed, falling back to BM25 search:', error.message);
      // Create a minimal index or skip Lunr
      this.lunrIndex = null;
    }

    // Build TF-IDF vectors and BM25 index
    // If Lunr was skipped (large dataset), build BM25 immediately as primary search method
    // Otherwise, defer for very large datasets to prevent blocking
    if (!this.lunrIndex && docs.length > 0) {
      // Lunr was skipped, BM25 is primary - build it immediately
      console.log('[SEARCH] Building BM25 index (primary search method)...');
      try {
        this.buildBM25Index(docs);
        console.log('[SEARCH] BM25 index built successfully');
      } catch (error) {
        console.warn('[SEARCH] BM25 build failed:', error.message);
      }
    } else if (docs.length > 5000) {
      // Very large dataset with Lunr - defer TF-IDF/BM25 to prevent blocking
      setTimeout(() => {
        try {
          this.buildTFIDFVectors(docs);
          this.buildBM25Index(docs);
        } catch (error) {
          console.warn('[SEARCH] TF-IDF/BM25 build failed:', error.message);
        }
      }, 100);
    } else {
      // Normal case - build both
      try {
        this.buildTFIDFVectors(docs);
        this.buildBM25Index(docs);
      } catch (error) {
        console.warn('[SEARCH] TF-IDF/BM25 build failed:', error.message);
      }
    }

    // Initialize Hugging Face semantic search (in background, non-blocking)
    // Only if enabled in config - explicitly check for true (not just truthy)
    // Add debug logging to understand config state
    const configValue = window.CONFIG?.ENABLE_SEMANTIC_SEARCH;
    const dashboardConfigValue = window.DASHBOARD_CONFIG?.ENABLE_SEMANTIC_SEARCH;
    const enableSemantic = (window.CONFIG && window.CONFIG.ENABLE_SEMANTIC_SEARCH === true) || 
                          (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH === true) ||
                          false;
    
    console.log('[SEARCH] Config check for Hugging Face:', {
      'window.CONFIG?.ENABLE_SEMANTIC_SEARCH': configValue,
      'window.DASHBOARD_CONFIG?.ENABLE_SEMANTIC_SEARCH': dashboardConfigValue,
      'enableSemantic': enableSemantic,
      'window.CONFIG exists': !!window.CONFIG,
      'window.DASHBOARD_CONFIG exists': !!window.DASHBOARD_CONFIG
    });
    
    if (enableSemantic) {
      this.initializeHuggingFaceSearch(docs).catch(err => {
        console.warn('[SEARCH] Hugging Face search initialization failed:', err.message);
      });
    } else {
      console.log('[SEARCH] Hugging Face semantic search disabled in config - skipping initialization');
    }

    this.initialized = true;
    console.log(`[SUCCESS] Search engine initialized with ${this.documents.length} documents`);
  }

  /**
   * Initialize Hugging Face semantic search (optional enhancement)
   */
  async initializeHuggingFaceSearch(docs) {
    // Double-check config - this should have been checked before calling, but verify here too
    // Explicitly check for === true (not just truthy) to prevent accidental initialization
    const enableSemantic = (window.CONFIG && window.CONFIG.ENABLE_SEMANTIC_SEARCH === true) || 
                          (window.DASHBOARD_CONFIG && window.DASHBOARD_CONFIG.ENABLE_SEMANTIC_SEARCH === true) ||
                          false;
    if (!enableSemantic) {
      console.log('[SEARCH] Hugging Face semantic search disabled in config (skipping initialization)');
      return;
    }
    
    // Check if HuggingFaceSemanticSearch is available
    if (typeof window.HuggingFaceSemanticSearch === 'undefined') {
      console.log('[SEARCH] Hugging Face semantic search not available (module not loaded)');
      return;
    }

    try {
      console.log('[SEARCH] Initializing Hugging Face semantic search...');
      this.hfSemanticSearch = new window.HuggingFaceSemanticSearch();
      
      // Initialize model (this may take a few seconds)
      const initialized = await this.hfSemanticSearch.initialize();
      
      if (initialized) {
        this.useHuggingFace = true;
        console.log('[SEARCH] Hugging Face semantic search enabled');
        
        // Generate embeddings in background (non-blocking)
        // For large datasets, this can take a while - log progress
        setTimeout(() => {
          console.log(`[SEARCH] Starting embedding generation for ${docs.length} documents (this may take several minutes)...`);
          this.hfSemanticSearch.generateDocumentEmbeddings(docs).then(() => {
            console.log('[SEARCH] Embedding generation complete - semantic search is now fully functional');
          }).catch(err => {
            console.warn('[SEARCH] Error generating embeddings:', err.message);
            console.warn('[SEARCH] Semantic search will still work, but may be slower (generating embeddings on-the-fly)');
          });
        }, 2000); // Delay to let UI render first
      } else {
        console.log('[SEARCH] Hugging Face search unavailable, using TF-IDF semantic search');
      }
    } catch (error) {
      console.warn('[SEARCH] Hugging Face initialization error:', error.message);
      this.useHuggingFace = false;
    }
  }

  /**
   * Build BM25 index for better ranking
   * BM25 is a probabilistic ranking function that improves upon TF-IDF
   * Process in chunks to avoid blocking the main thread
   */
  buildBM25Index(docs) {
    if (!docs || docs.length === 0) {
      this.avgDocLength = 0;
      return;
    }
    
    // Process in chunks to avoid timeout
    const CHUNK_SIZE = 100;
    let currentIndex = 0;
    let totalLength = 0;
    const docFrequency = new Map();
    
    const processChunk = () => {
      const endIndex = Math.min(currentIndex + CHUNK_SIZE, docs.length);
      
      // Process chunk
      for (let i = currentIndex; i < endIndex; i++) {
        const doc = docs[i];
        if (!doc || !doc.content) continue;
        
        try {
          const tokens = this.tokenize(doc.content);
          totalLength += tokens.length;
          
          // Calculate document frequencies
          const uniqueTokens = new Set(tokens);
          uniqueTokens.forEach(token => {
            docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
          });
          
          // Store token counts for this document
          const tokenCounts = new Map();
          tokens.forEach(token => {
            tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
          });
          
          this.bm25Index.set(doc.id, {
            length: tokens.length,
            tokenCounts
          });
        } catch (error) {
          console.warn('[SEARCH] Error processing document for BM25:', error);
        }
      }
      
      currentIndex = endIndex;
      
      // Calculate average document length after first chunk
      if (currentIndex > 0) {
        this.avgDocLength = totalLength / currentIndex;
      }
      
      // Store shared docFrequency in a shared location (on the last document processed)
      if (currentIndex >= docs.length) {
        this.avgDocLength = totalLength / docs.length;
        // Store docFrequency globally for BM25 calculations
        this.bm25DocFrequency = docFrequency;
      }
      
      // Continue processing if there are more documents
      if (currentIndex < docs.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processChunk, { timeout: 50 });
        } else {
          setTimeout(processChunk, 0);
        }
      }
    };
    
    // Start processing
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(processChunk, { timeout: 50 });
    } else {
      setTimeout(processChunk, 0);
    }
  }

  /**
   * Calculate BM25 score for a document given a query
   * BM25 = Σ(IDF(qi) * (f(qi,D) * (k1 + 1)) / (f(qi,D) + k1 * (1 - b + b * |D| / avgdl)))
   */
  calculateBM25Score(query, docId) {
    const queryTokens = this.tokenize(query);
    const bm25Data = this.bm25Index.get(docId);
    
    if (!bm25Data) return 0;
    
    const { length, tokenCounts } = bm25Data;
    const docFrequency = this.bm25DocFrequency || new Map();
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
    // Simple TF-IDF implementation with chunked processing to avoid timeouts
    const termFrequency = new Map();
    const documentFrequency = new Map();
    
    // Process in chunks to avoid blocking the main thread
    const chunkSize = 100;
    let currentIndex = 0;
    
    const processChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, docs.length);
      
      // Calculate term frequencies for this chunk
      for (let i = currentIndex; i < endIndex; i++) {
        const doc = docs[i];
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
      }
      
      currentIndex = endIndex;
      
      if (currentIndex < docs.length) {
        // Process next chunk asynchronously
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processChunk, { timeout: 100 });
        } else {
          setTimeout(processChunk, 0);
        }
      } else {
        // All chunks processed, now calculate TF-IDF vectors
        this.calculateTFIDFVectors(docs, termFrequency, documentFrequency);
      }
    };
    
    // Start processing
    if (docs.length === 0) {
      return;
    }
    
    if (docs.length <= chunkSize) {
      // Small dataset, process synchronously
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
      this.calculateTFIDFVectors(docs, termFrequency, documentFrequency);
    } else {
      // Large dataset, process in chunks
      processChunk();
    }
  }
  
  calculateTFIDFVectors(docs, termFrequency, documentFrequency) {
    const numDocs = docs.length;
    const chunkSize = 100;
    let currentIndex = 0;
    
    const processVectorChunk = () => {
      const endIndex = Math.min(currentIndex + chunkSize, docs.length);
      
      for (let i = currentIndex; i < endIndex; i++) {
        const doc = docs[i];
        const vector = new Map();
        const termCounts = termFrequency.get(doc.id) || new Map();
        
        if (termCounts.size > 0) {
          const maxCount = Math.max(...Array.from(termCounts.values()));
          termCounts.forEach((count, term) => {
            const tf = count / maxCount;
            const idf = Math.log(numDocs / (documentFrequency.get(term) || 1));
            vector.set(term, tf * idf);
          });
        }
        
        this.tfidfVectors.set(doc.id, vector);
      }
      
      currentIndex = endIndex;
      
      if (currentIndex < docs.length) {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processVectorChunk, { timeout: 100 });
        } else {
          setTimeout(processVectorChunk, 0);
        }
      }
    };
    
    processVectorChunk();
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
   * Combines full-text, BM25, semantic (TF-IDF or Hugging Face), and fuzzy search
   */
  async search(queryString, options = {}) {
    if (!this.initialized || !queryString.trim()) {
      return [];
    }

    const startTime = performance.now();
    const { searchText, filters } = this.parseQuery(queryString);
    
    // Expand query with synonyms
    const expandedQuery = this.expandQuery(searchText);
    
    let results = [];
    const resultMap = new Map(); // To deduplicate and merge scores

    // 1. Full-text search with Lunr (if available)
    if (searchText && this.lunrIndex) {
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
    } else if (searchText && !this.lunrIndex) {
      // Lunr not available (large dataset), use BM25 only
      // This will be handled in step 2 below
    }

    // 2. BM25 ranking for all documents (primary method when Lunr is unavailable)
    if (searchText) {
      // If Lunr is not available, use BM25 as primary search method
      const bm25Threshold = this.lunrIndex ? 0.5 : 0.1; // Lower threshold when Lunr unavailable
      const maxResults = this.lunrIndex ? 50 : 100; // More results when Lunr unavailable
      
      if (resultMap.size < maxResults) {
        this.documents.forEach(doc => {
          const bm25Score = this.calculateBM25Score(searchText, doc.id);
          if (bm25Score > bm25Threshold) {
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
    }

    // 3. Semantic search (Hugging Face embeddings if available, otherwise TF-IDF)
    if (searchText && resultMap.size < 30) {
      if (this.useHuggingFace && this.hfSemanticSearch && this.hfSemanticSearch.isInitialized) {
        // Use Hugging Face semantic search
        try {
          const hfResults = await this.hfSemanticSearch.semanticSearch(searchText, this.documents, {
            limit: 15,
            minSimilarity: 0.3
          });
          
          hfResults.forEach(sr => {
            if (resultMap.has(sr.id)) {
              resultMap.get(sr.id).hfSemanticScore = sr.semanticScore;
              resultMap.get(sr.id).semanticScore = sr.semanticScore; // Also set for compatibility
              if (!resultMap.get(sr.id).searchMethods.includes('hf-semantic')) {
                resultMap.get(sr.id).searchMethods.push('hf-semantic');
              }
            } else {
              resultMap.set(sr.id, {
                ...sr,
                hfSemanticScore: sr.semanticScore,
                semanticScore: sr.semanticScore,
                searchMethods: ['hf-semantic']
              });
            }
          });
        } catch (error) {
          console.warn('[SEARCH] Hugging Face search error, falling back to TF-IDF:', error.message);
          // Fallback to TF-IDF
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
      } else {
        // Use TF-IDF semantic search (fallback)
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
      const hfSemanticScore = result.hfSemanticScore || 0;
      const fuzzyScore = result.fuzzyScore || 0;
      
      // Weighted combination
      // If Hugging Face semantic score is available, use it instead of TF-IDF semantic
      const effectiveSemanticScore = hfSemanticScore > 0 ? hfSemanticScore : semanticScore;
      
      // Adjust weights based on available methods
      let combinedScore;
      if (hfSemanticScore > 0) {
        // Hugging Face available: give it more weight
        combinedScore = (
          bm25Score * 0.35 +
          lunrScore * 0.25 +
          hfSemanticScore * 0.30 + // Higher weight for HF semantic
          fuzzyScore * 0.10
        );
      } else {
        // Standard weights
        combinedScore = (
          bm25Score * 0.45 +
          lunrScore * 0.30 +
          semanticScore * 0.20 +
          fuzzyScore * 0.05
        );
      }
      
      // Context-aware boosting
      const boostedScore = this.applyContextBoost(result, searchText, combinedScore);
      
      return {
        ...result,
        score: boostedScore,
        _debug: { 
          lunrScore, 
          bm25Score, 
          semanticScore: effectiveSemanticScore, 
          hfSemanticScore,
          fuzzyScore, 
          combinedScore, 
          boostedScore 
        }
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
   * Answer natural language questions about the codebase
   * Uses Hugging Face semantic search if available
   * Example: "What files did I modify when fixing the login bug?"
   */
  async answerQuestion(question, options = {}) {
    if (!this.initialized) {
      return {
        question,
        answer: 'Search engine not initialized yet.',
        relevantDocuments: [],
        confidence: 0
      };
    }

    // Try Hugging Face semantic search first
    if (this.useHuggingFace && this.hfSemanticSearch && this.hfSemanticSearch.isInitialized) {
      try {
        return await this.hfSemanticSearch.answerQuestion(question, this.documents, options);
      } catch (error) {
        console.warn('[SEARCH] HF question answering failed:', error.message);
      }
    }

    // Fallback to regular search
    const results = await this.search(question, { limit: options.limit || 10 });
    
    return {
      question,
      answer: `Found ${results.length} relevant result${results.length !== 1 ? 's' : ''} for your question.`,
      relevantDocuments: results,
      confidence: results.length > 0 ? results[0].score : 0
    };
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
   * Extract relevant snippet with context and query highlighting
   */
  extractSnippet(content, query, maxLength = 250) {
    if (!content) return '';
    if (!query) return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    
    const queryTokens = this.tokenize(query).filter(t => t.length > 2); // Only meaningful tokens
    if (queryTokens.length === 0) {
      return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }
    
    // Try to find the best context window around query terms
    const contentLower = content.toLowerCase();
    let bestStart = 0;
    let bestScore = 0;
    const windowSize = maxLength;
    
    // Find position with most query tokens
    for (let i = 0; i < Math.min(content.length, 5000); i += 50) {
      const window = content.substring(i, i + windowSize).toLowerCase();
      const score = queryTokens.reduce((sum, token) => {
        return sum + (window.includes(token) ? 1 : 0);
      }, 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestStart = i;
      }
    }
    
    // Extract snippet around best position
    let snippet = content.substring(bestStart, bestStart + windowSize);
    
    // Try to start at word boundary
    if (bestStart > 0) {
      const wordBoundary = snippet.search(/\s/);
      if (wordBoundary > 0 && wordBoundary < 30) {
        snippet = snippet.substring(wordBoundary + 1);
      }
      snippet = '...' + snippet;
    }
    
    // Try to end at word boundary
    if (snippet.length >= maxLength) {
      const lastSpace = snippet.lastIndexOf(' ', maxLength);
      if (lastSpace > maxLength * 0.8) {
        snippet = snippet.substring(0, lastSpace) + '...';
      } else {
        snippet = snippet.substring(0, maxLength) + '...';
      }
    }
    
    return snippet.trim();
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
    if (window.LocalStorageHelper) {
      return window.LocalStorageHelper.get('cursor-dashboard-search-history', []);
    }
    // Fallback
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
    if (window.LocalStorageHelper) {
      window.LocalStorageHelper.set('cursor-dashboard-search-history', this.searchHistory);
    } else {
      // Fallback
      try {
        localStorage.setItem('cursor-dashboard-search-history', JSON.stringify(this.searchHistory));
      } catch (e) {
        console.warn('Failed to save search history:', e);
      }
    }
  }

  /**
   * Clear search history
   */
  clearHistory() {
    this.searchHistory = [];
    if (window.LocalStorageHelper) {
      window.LocalStorageHelper.remove('cursor-dashboard-search-history');
    } else {
      localStorage.removeItem('cursor-dashboard-search-history');
    }
  }

  /**
   * Load search analytics from localStorage
   */
  loadSearchAnalytics() {
    if (window.LocalStorageHelper) {
      return window.LocalStorageHelper.get('cursor-dashboard-search-analytics', { searches: [], clicks: {} });
    }
    // Fallback
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
    if (window.LocalStorageHelper) {
      window.LocalStorageHelper.set('cursor-dashboard-search-analytics', this.searchAnalytics);
    } else {
      // Fallback
      try {
        localStorage.setItem('cursor-dashboard-search-analytics', JSON.stringify(this.searchAnalytics));
      } catch (e) {
        console.warn('Failed to save search analytics:', e);
      }
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


