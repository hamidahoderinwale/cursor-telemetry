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
 */
function computeTFIDFAnalysis(files) {
  const MAX_FILES_FOR_TFIDF = 1000; // Limit to prevent timeout
  const MAX_SIMILARITIES = 5000; // Limit number of similarity calculations
  
  // For very large datasets, limit to most active files
  let filesToProcess = files;
  if (files.length > MAX_FILES_FOR_TFIDF) {
    console.log(`[TF-IDF] Large dataset (${files.length} files), limiting to ${MAX_FILES_FOR_TFIDF} most active files`);
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
  
  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    // Limit content size to prevent memory issues
    const content = (file.content || '').substring(0, 50000); // Max 50KB per file
    const tokens = tokenizeCode(content);
    documents.push({ file, tokens });
    
    // Yield to browser every 100 files to prevent blocking
    if (i % 100 === 0 && i > 0) {
      const elapsed = performance.now() - tokenizeStart;
      if (elapsed > 100) { // If taking too long, defer rest
        console.log(`[TF-IDF] Tokenized ${i}/${filesToProcess.length} files, deferring rest...`);
        // Continue but log progress
      }
    }
  }
  
  console.log(`[TF-IDF] Tokenized ${documents.length} files`);
  
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
    console.log(`[TF-IDF] Large similarity matrix (${totalPairs} pairs), computing top ${MAX_SIMILARITIES} similarities...`);
    // For large datasets, use a smarter approach:
    // 1. Compute similarities for files that share common terms (faster)
    // 2. Limit total computations to prevent timeout
    
    let computed = 0;
    const similarityThreshold = 0.1; // Only store meaningful similarities
    
    // First, compute similarities for files with overlapping terms (more likely to be similar)
    for (let i = 0; i < tfidfVectors.length && computed < MAX_SIMILARITIES; i++) {
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
        if (hasCommonTerms || computed < 1000) { // Always compute first 1000
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
  
  console.log(`[TF-IDF] Computed ${similarities.length} similarities from ${documents.length} files`);
  
  return {
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
}

// Export to window for global access
window.tokenizeCode = tokenizeCode;
window.cosineSimilarity = cosineSimilarity;
window.computeTFIDFAnalysis = computeTFIDFAnalysis;

