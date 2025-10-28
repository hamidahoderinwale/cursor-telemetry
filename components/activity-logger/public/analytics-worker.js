/**
 * Analytics Web Worker
 * Offloads heavy computation (TF-IDF, clustering, large JSON parsing) to background thread
 */

// Task handlers
const taskHandlers = {
  'tfidf': computeTFIDF,
  'cluster': computeClusters,
  'parseJson': parseJsonLarge,
  'semantic': computeSemanticAnalysis,
  'scoring': computeScoring
};

// Main message handler
self.onmessage = async function(e) {
  const { taskId, task, payload } = e.data;
  
  try {
    const handler = taskHandlers[task];
    if (!handler) {
      throw new Error(`Unknown task: ${task}`);
    }
    
    const startTime = performance.now();
    const result = await handler(payload);
    const duration = performance.now() - startTime;
    
    self.postMessage({
      taskId,
      success: true,
      result,
      stats: { duration, task }
    });
  } catch (error) {
    self.postMessage({
      taskId,
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * TF-IDF Computation
 */
function computeTFIDF(payload) {
  const { documents } = payload;
  
  if (!documents || documents.length === 0) {
    return { terms: [], documents: [] };
  }
  
  // Build vocabulary
  const vocabulary = new Map();
  const docFrequency = new Map();
  
  // Tokenize and count
  documents.forEach((doc, docIdx) => {
    const tokens = tokenize(doc.content || doc.text || '');
    const uniqueTokens = new Set(tokens);
    
    tokens.forEach(token => {
      if (!vocabulary.has(token)) {
        vocabulary.set(token, []);
      }
      vocabulary.get(token).push(docIdx);
    });
    
    uniqueTokens.forEach(token => {
      docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
    });
  });
  
  // Compute TF-IDF
  const N = documents.length;
  const tfidfScores = [];
  
  documents.forEach((doc, docIdx) => {
    const tokens = tokenize(doc.content || doc.text || '');
    const termFreq = new Map();
    
    tokens.forEach(token => {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    });
    
    const docScores = [];
    termFreq.forEach((tf, term) => {
      const df = docFrequency.get(term) || 1;
      const idf = Math.log(N / df);
      const tfidf = tf * idf;
      
      docScores.push({ term, tfidf, tf, df, idf });
    });
    
    // Sort by TF-IDF score
    docScores.sort((a, b) => b.tfidf - a.tfidf);
    
    tfidfScores.push({
      docId: doc.id || docIdx,
      scores: docScores.slice(0, 20) // Top 20 terms
    });
  });
  
  return {
    documents: tfidfScores,
    vocabulary: Array.from(vocabulary.keys()),
    totalDocs: N
  };
}

/**
 * Clustering (simple k-means)
 */
function computeClusters(payload) {
  const { points, k = 5, maxIterations = 10 } = payload;
  
  if (!points || points.length === 0) {
    return { clusters: [], centroids: [] };
  }
  
  // Initialize centroids randomly
  const centroids = [];
  const used = new Set();
  
  while (centroids.length < Math.min(k, points.length)) {
    const idx = Math.floor(Math.random() * points.length);
    if (!used.has(idx)) {
      centroids.push([...points[idx]]);
      used.add(idx);
    }
  }
  
  let assignments = new Array(points.length).fill(0);
  
  // K-means iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to nearest centroid
    let changed = false;
    
    for (let i = 0; i < points.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let j = 0; j < centroids.length; j++) {
        const dist = euclideanDistance(points[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }
      
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }
    
    if (!changed) break;
    
    // Update centroids
    const clusterSums = Array(centroids.length).fill(0).map(() => 
      new Array(points[0].length).fill(0)
    );
    const clusterCounts = new Array(centroids.length).fill(0);
    
    for (let i = 0; i < points.length; i++) {
      const cluster = assignments[i];
      clusterCounts[cluster]++;
      for (let d = 0; d < points[i].length; d++) {
        clusterSums[cluster][d] += points[i][d];
      }
    }
    
    for (let j = 0; j < centroids.length; j++) {
      if (clusterCounts[j] > 0) {
        for (let d = 0; d < centroids[j].length; d++) {
          centroids[j][d] = clusterSums[j][d] / clusterCounts[j];
        }
      }
    }
  }
  
  return {
    assignments,
    centroids,
    clusterSizes: centroids.map((_, i) => 
      assignments.filter(a => a === i).length
    )
  };
}

/**
 * Parse large JSON safely
 */
function parseJsonLarge(payload) {
  const { json } = payload;
  
  try {
    if (typeof json === 'string') {
      return JSON.parse(json);
    }
    return json;
  } catch (error) {
    throw new Error(`JSON parse error: ${error.message}`);
  }
}

/**
 * Semantic analysis
 */
function computeSemanticAnalysis(payload) {
  const { documents } = payload;
  
  if (!documents || documents.length === 0) {
    return { similarities: [], embeddings: [] };
  }
  
  // Simple cosine similarity between documents
  const embeddings = documents.map(doc => {
    const tokens = tokenize(doc.content || doc.text || '');
    return createEmbedding(tokens);
  });
  
  const similarities = [];
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity > 0.1) { // Only keep significant similarities
        similarities.push({
          doc1: i,
          doc2: j,
          similarity
        });
      }
    }
  }
  
  return { similarities, embeddings };
}

/**
 * Scoring computation
 */
function computeScoring(payload) {
  const { items, criteria } = payload;
  
  return items.map(item => {
    let score = 0;
    let weights = 0;
    
    Object.entries(criteria).forEach(([key, weight]) => {
      if (item[key] !== undefined) {
        score += item[key] * weight;
        weights += weight;
      }
    });
    
    return {
      ...item,
      score: weights > 0 ? score / weights : 0
    };
  });
}

// Helper functions

function tokenize(text) {
  if (!text) return [];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2);
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function createEmbedding(tokens) {
  // Simple bag-of-words embedding
  const embedding = new Map();
  tokens.forEach(token => {
    embedding.set(token, (embedding.get(token) || 0) + 1);
  });
  return embedding;
}

function cosineSimilarity(emb1, emb2) {
  const allKeys = new Set([...emb1.keys(), ...emb2.keys()]);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  allKeys.forEach(key => {
    const v1 = emb1.get(key) || 0;
    const v2 = emb2.get(key) || 0;
    
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  });
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

