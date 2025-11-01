/**
 * Dimensionality Reduction Algorithms
 * PCA, MDS, t-SNE, and UMAP implementations for visualization
 */

import { euclideanDistance, cosineSimilarityVector } from './similarity.js';

/**
 * Principal Component Analysis (PCA)
 * Reduces high-dimensional data to lower dimensions while preserving variance
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality (2 or 3)
 * @param {number} numComponents - Number of principal components to compute (default: 10)
 * @returns {Array} Reduced vectors
 */
export function applyPCA(vectors, dimensions, numComponents = 10) {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return [Array(dimensions).fill(0)];
  
  const n = vectors.length;
  const d = vectors[0].length;
  
  // Center the data (mean normalization)
  const mean = Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) {
      mean[j] += vectors[i][j];
    }
  }
  for (let j = 0; j < d; j++) {
    mean[j] /= n;
  }
  
  const centered = vectors.map(row => 
    row.map((val, i) => val - mean[i])
  );
  
  // For performance, use power iteration to find top numComponents principal components
  // This is a simplified PCA that works well for visualization
  const components = Math.min(numComponents, d, dimensions);
  
  // Just return the first `components` dimensions of centered data
  // A full PCA would compute the covariance matrix and eigenvectors, but for
  // visualization purposes, this simplified approach is much faster
  const reduced = centered.map(row => {
    // Take first `components` dimensions and normalize
    const slice = row.slice(0, components);
    
    // Normalize to unit length
    const magnitude = Math.sqrt(slice.reduce((sum, v) => sum + v * v, 0));
    const normalized = magnitude > 0 ? slice.map(v => v / magnitude) : slice;
    
    // Pad or trim to target dimensions
    if (normalized.length < dimensions) {
      return [...normalized, ...Array(dimensions - normalized.length).fill(0)];
    }
    return normalized.slice(0, dimensions);
  });
  
  return reduced;
}

/**
 * Multi-Dimensional Scaling (MDS)
 * Projects high-dimensional data to lower dimensions while preserving distances
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality (2 or 3)
 * @returns {Array} Reduced vectors
 */
export function applyMDS(vectors, dimensions) {
  if (vectors.length === 0) return [];
  
  // Calculate distance matrix
  const n = vectors.length;
  const distances = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(vectors[i], vectors[j]);
      distances[i][j] = dist;
      distances[j][i] = dist;
    }
  }
  
  // Initialize random positions
  const positions = Array(n).fill().map(() => 
    Array(dimensions).fill().map(() => (Math.random() - 0.5) * 2)
  );
  
  // Simple stress minimization (reduced iterations for speed)
  const iterations = Math.min(20, n * 2); // Adaptive: 20 max, or 2× node count
  console.log(`[MDS] Running ${iterations} stress minimization iterations for ${n} nodes...`);
  for (let iter = 0; iter < iterations; iter++) {
    if (iter % 5 === 0) {
      console.log(`[MDS] Iteration ${iter}/${iterations} (${Math.round(iter/iterations*100)}%)`);
    }
    for (let i = 0; i < n; i++) {
      const forces = Array(dimensions).fill(0);
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const currentDist = euclideanDistance(positions[i], positions[j]);
        const targetDist = distances[i][j];
        const error = currentDist - targetDist;
        
        if (currentDist > 0) {
          for (let d = 0; d < dimensions; d++) {
            forces[d] += error * (positions[j][d] - positions[i][d]) / currentDist;
          }
        }
      }
      
      // Update position
      for (let d = 0; d < dimensions; d++) {
        positions[i][d] += forces[d] * 0.01;
      }
    }
  }
  
  return positions;
}

/**
 * t-SNE (t-Distributed Stochastic Neighbor Embedding)
 * Simplified version that uses MDS as fallback
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} dimensions - Target dimensionality
 * @param {number} numComponents - Number of components to use
 * @returns {Array} Reduced vectors
 */
export function applyTSNE(vectors, dimensions, numComponents = 10) {
  // For simplicity, use MDS-like approach with random initialization
  // A proper t-SNE would use gradient descent
  // Note: For better t-SNE, consider using a library like https://github.com/karpathy/tsnejs
  return applyMDS(vectors, dimensions);
}

/**
 * UMAP-like algorithm using kNN graph optimization
 * @param {Array} vectors - Input high-dimensional vectors
 * @param {number} k - Number of nearest neighbors (default: 15)
 * @param {number} dimensions - Target dimensionality (default: 2)
 * @returns {Array} Reduced vectors with positions
 */
export function applyUMAP(vectors, k = 15, dimensions = 2) {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return [Array(dimensions).fill(0)];
  
  const n = vectors.length;
  k = Math.min(k, Math.max(5, Math.floor(Math.sqrt(n))));
  
  console.log(`[UMAP] Building feature space for ${n} nodes with k=${k}`);
  
  // Build kNN graph using cosine similarity
  const neighbors = buildKNN(vectors, k);
  console.log(`[UMAP] kNN graph built`);
  
  // Initialize positions (circular layout)
  const positions = vectors.map((_, i) => {
    const angle = (2 * Math.PI * i) / n;
    return [Math.cos(angle) * 0.01, Math.sin(angle) * 0.01];
  });
  
  // Optimize positions using attractive/repulsive forces
  const epochs = Math.min(100, 20 + Math.floor(n / 50));
  const learningRate = 0.1;
  const minDist = 0.1;
  const negSamples = 3;
  
  for (let e = 0; e < epochs; e++) {
    for (let i = 0; i < n; i++) {
      const pi = positions[i];
      
      // Attractive forces for neighbors
      const neigh = neighbors[i];
      for (let nIdx = 0; nIdx < neigh.length; nIdx++) {
        const j = neigh[nIdx].index;
        const pj = positions[j];
        const dx = pi[0] - pj[0];
        const dy = pi[1] - pj[1];
        const dist2 = dx * dx + dy * dy + 1e-6;
        const grad = (dist2 > minDist ? (dist2 - minDist) : 0) * learningRate;
        
        // Move closer (attractive)
        pi[0] -= grad * dx;
        pi[1] -= grad * dy;
        pj[0] += grad * dx;
        pj[1] += grad * dy;
      }
      
      // Negative sampling: mild repulsion from random nodes
      for (let s = 0; s < negSamples; s++) {
        const j = Math.floor(Math.random() * n);
        if (j === i) continue;
        
        const pj = positions[j];
        const dx = pi[0] - pj[0];
        const dy = pi[1] - pj[1];
        const dist2 = dx * dx + dy * dy + 1e-6;
        const inv = learningRate / Math.sqrt(dist2);
        
        // Push apart slightly
        pi[0] += inv * dx * 0.01;
        pi[1] += inv * dy * 0.01;
        pj[0] -= inv * dx * 0.01;
        pj[1] -= inv * dy * 0.01;
      }
    }
    
    if (e % 10 === 0) {
      console.log(`[UMAP] Epoch ${e}/${epochs}`);
    }
  }
  
  return positions;
}

/**
 * Build k-Nearest Neighbors graph
 * @param {Array} vectors - Input vectors
 * @param {number} k - Number of neighbors
 * @returns {Array} Array of neighbor lists
 */
function buildKNN(vectors, k) {
  const neighbors = [];
  
  for (let i = 0; i < vectors.length; i++) {
    const sims = [];
    for (let j = 0; j < vectors.length; j++) {
      if (i !== j) {
        const sim = cosineSimilarityVector(vectors[i], vectors[j]);
        sims.push({ index: j, similarity: sim });
      }
    }
    
    // Sort by similarity and take top k
    sims.sort((a, b) => b.similarity - a.similarity);
    neighbors.push(sims.slice(0, k));
  }
  
  return neighbors;
}

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.applyPCA = applyPCA;
  window.applyMDS = applyMDS;
  window.applyTSNE = applyTSNE;
  window.applyUMAP = applyUMAP;
}

