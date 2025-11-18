/**
 * TF-IDF Analysis Utilities
 * Extracted from dashboard.js for file graph view
 */

/**
 * Tokenize code content
 */
function tokenizeCode(code) {
  // Remove comments
  const noComments = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Extract identifiers (camelCase, snake_case, etc.)
  const tokens = noComments
    .match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];
  
  // Filter out common keywords and short tokens
  const stopWords = new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'true', 'false', 'null', 'undefined', 'this', 'new', 'typeof', 'instanceof', 'in', 'of', 'class', 'extends', 'import', 'export', 'from', 'as', 'default', 'async', 'await', 'try', 'catch', 'throw', 'finally']);
  
  return tokens
    .filter(t => t.length > 2 && !stopWords.has(t.toLowerCase()))
    .map(t => t.toLowerCase());
}

/**
 * Cosine similarity between two TF-IDF vectors
 */
function cosineSimilarity(vec1, vec2) {
  const terms = new Set([...vec1.keys(), ...vec2.keys()]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  terms.forEach(term => {
    const v1 = vec1.get(term) || 0;
    const v2 = vec2.get(term) || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Compute TF-IDF analysis for files
 * Optimized to handle large datasets by limiting computation
 * Uses Web Worker for computation and persistent caching
 */
// OPTIMIZATION: Make TF-IDF computation async to allow yielding
async function computeTFIDFAnalysis(files) {
  // Check cache first
  if (window.performanceCache) {
    try {
      const cached = await window.performanceCache.getTFIDF(files, 24 * 60 * 60 * 1000);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // Cache check failed
    }
  }

  // Try Web Worker for computation (non-blocking)
  if (typeof Worker !== 'undefined') {
    try {
      return await computeTFIDFWithWorker(files);
    } catch (e) {
      // Web Worker failed, falling back to main thread
    }
  }

  // Fallback to main thread computation
  return await computeTFIDFMainThread(files);
}

/**
 * Compute TF-IDF using Web Worker (non-blocking)
 */
async function computeTFIDFWithWorker(files) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/workers/tfidf-worker.js');
    const messageId = Date.now() + Math.random();

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('TF-IDF computation timeout'));
    }, 60000); // 60 second timeout

    worker.onmessage = (e) => {
      const { type, id, result, error } = e.data;
      if (id === messageId) {
        clearTimeout(timeout);
        worker.terminate();
        
        if (type === 'result') {
          // Cache result (async)
          if (window.performanceCache) {
            window.performanceCache.storeTFIDF(files, result).catch(e => {
              // Failed to cache results
            });
          }
          resolve(result);
        } else {
          reject(new Error(error || 'TF-IDF computation failed'));
        }
      }
    };

    worker.onerror = (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    };

    worker.postMessage({
      type: 'computeTFIDF',
      id: messageId,
      payload: {
        files: files.map(f => ({
          path: f.path,
          name: f.name,
          content: (f.content || '').substring(0, 50000), // Limit content size
          changes: f.changes || 0,
          lastModified: f.lastModified,
          size: f.size || (f.content || '').length
        })),
        options: {
          maxFiles: 500,
          maxSimilarities: 3000,
          similarityThreshold: 0.1
        }
      }
    });
  });
}

/**
 * Compute TF-IDF on main thread (fallback)
 */
async function computeTFIDFMainThread(files) {
  const MAX_FILES_FOR_TFIDF = 500; // Reduced from 1000 for faster computation
  const MAX_SIMILARITIES = 3000; // Reduced from 5000 for faster computation
  
  // For very large datasets, limit to most active files
  let filesToProcess = files;
  if (files.length > MAX_FILES_FOR_TFIDF) {
    // Sort by activity (changes, recency, size) and take top N
    filesToProcess = [...files]
      .sort((a, b) => {
        // Prioritize files with more changes
        const changesDiff = (b.changes || 0) - (a.changes || 0);
        if (changesDiff !== 0) return changesDiff;
        // Then by recency
        const recencyDiff = (new Date(b.lastModified || 0).getTime()) - (new Date(a.lastModified || 0).getTime());
        if (recencyDiff !== 0) return recencyDiff;
        // Then by size (larger files may be more important)
        return (b.size || 0) - (a.size || 0);
      })
      .slice(0, MAX_FILES_FOR_TFIDF);
  }
  
  // Tokenize files (with progress for large datasets)
  const documents = [];
  const tokenizeStart = performance.now();
  
  // OPTIMIZATION: Tokenize in batches with yield points
  const TOKENIZE_BATCH_SIZE = 50; // Process 50 files at a time
  for (let i = 0; i < filesToProcess.length; i += TOKENIZE_BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + TOKENIZE_BATCH_SIZE);
    
    batch.forEach(file => {
      // Limit content size to prevent memory issues
      const content = (file.content || '').substring(0, 50000); // Max 50KB per file
      const tokens = tokenizeCode(content);
      documents.push({ file, tokens });
    });
    
    // Yield to browser after each batch to prevent blocking
    if (i + TOKENIZE_BATCH_SIZE < filesToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  
  // Calculate term frequencies
  const termFreqs = new Map();
  const docFreqs = new Map();
  let totalTerms = 0;
  
  documents.forEach(doc => {
    const termCounts = new Map();
    doc.tokens.forEach(term => {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
      totalTerms++;
    });
    
    doc.termFreq = termCounts;
    
    // Document frequency
    const uniqueTerms = new Set(doc.tokens);
    uniqueTerms.forEach(term => {
      docFreqs.set(term, (docFreqs.get(term) || 0) + 1);
      termFreqs.set(term, (termFreqs.get(term) || 0) + termCounts.get(term));
    });
  });
  
  // Calculate TF-IDF
  const numDocs = documents.length;
  const tfidfVectors = documents.map(doc => {
    const vector = new Map();
    doc.termFreq.forEach((tf, term) => {
      const df = docFreqs.get(term) || 1;
      const idf = Math.log(numDocs / df);
      vector.set(term, tf * idf);
    });
    return { file: doc.file, vector };
  });
  
  // Calculate pairwise similarities (limited to prevent timeout)
  const similarities = [];
  const totalPairs = (tfidfVectors.length * (tfidfVectors.length - 1)) / 2;
  const shouldLimit = totalPairs > MAX_SIMILARITIES;
  
  if (shouldLimit) {
    // For large datasets, use a smarter approach:
    // 1. Compute similarities for files that share common terms (faster)
    // 2. Limit total computations to prevent timeout
    
    let computed = 0;
    const similarityThreshold = 0.1; // Only store meaningful similarities
    
    // OPTIMIZATION: Process in chunks with yield points
    const SIMILARITY_CHUNK_SIZE = 25;
    for (let chunkStart = 0; chunkStart < tfidfVectors.length && computed < MAX_SIMILARITIES; chunkStart += SIMILARITY_CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + SIMILARITY_CHUNK_SIZE, tfidfVectors.length);
      
      for (let i = chunkStart; i < chunkEnd && computed < MAX_SIMILARITIES; i++) {
        for (let j = i + 1; j < tfidfVectors.length && computed < MAX_SIMILARITIES; j++) {
          // Quick check: do they share any terms?
          const vec1 = tfidfVectors[i].vector;
          const vec2 = tfidfVectors[j].vector;
          let hasCommonTerms = false;
          
          // Quick overlap check before expensive cosine similarity
          for (const term of vec1.keys()) {
            if (vec2.has(term)) {
              hasCommonTerms = true;
              break;
            }
          }
          
          // Only compute similarity if they share terms (optimization)
          if (hasCommonTerms || computed < 500) { // Reduced from 1000 to 500
            const sim = cosineSimilarity(vec1, vec2);
            if (sim > similarityThreshold) {
              similarities.push({
                file1: tfidfVectors[i].file.name,
                file2: tfidfVectors[j].file.name,
                similarity: sim
              });
            }
            computed++;
          }
        }
      }
      
      // Yield to event loop after each chunk
      if (chunkStart + SIMILARITY_CHUNK_SIZE < tfidfVectors.length && computed < MAX_SIMILARITIES) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } else {
    // Normal computation for smaller datasets
    for (let i = 0; i < tfidfVectors.length; i++) {
      for (let j = i + 1; j < tfidfVectors.length; j++) {
        const sim = cosineSimilarity(tfidfVectors[i].vector, tfidfVectors[j].vector);
        if (sim > 0.1) { // Only store meaningful similarities
          similarities.push({
            file1: tfidfVectors[i].file.name,
            file2: tfidfVectors[j].file.name,
            similarity: sim
          });
        }
      }
    }
  }
  
  // Sort by similarity
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  // Get top terms by TF-IDF
  const allTermTFIDF = new Map();
  tfidfVectors.forEach(doc => {
    doc.vector.forEach((tfidf, term) => {
      allTermTFIDF.set(term, (allTermTFIDF.get(term) || 0) + tfidf);
    });
  });
  
  const topTerms = Array.from(allTermTFIDF.entries())
    .map(([term, tfidf]) => ({ term, tfidf, freq: termFreqs.get(term) }))
    .sort((a, b) => b.tfidf - a.tfidf)
    .slice(0, 50);
  
  
  const result = {
    tfidfStats: {
      totalTerms,
      uniqueTerms: docFreqs.size,
      avgFrequency: docFreqs.size > 0 ? totalTerms / docFreqs.size : 0,
      avgSimilarity: similarities.length > 0 ? 
        similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length : 0,
      topTerms,
      filesAnalyzed: documents.length,
      totalFiles: files.length
    },
    similarities
  };

  // Cache result (async, don't wait)
  if (window.performanceCache) {
    window.performanceCache.storeTFIDF(files, result).catch(e => {
      // Failed to cache results
    });
  }

  return result;
}

// Export to window for global access
window.tokenizeCode = tokenizeCode;
window.cosineSimilarity = cosineSimilarity;
window.computeTFIDFAnalysis = computeTFIDFAnalysis;

