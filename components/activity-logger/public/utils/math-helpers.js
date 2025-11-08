/**
 * Mathematical helper functions for vector operations and dimensionality reduction
 */

function cosineSimilarity(vec1, vec2) {
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

function cosineSimilarityVector(a, b) {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

function applyPCA(vectors, dimensions, numComponents = 10) {
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
  
  const components = Math.min(numComponents, d, dimensions);
  
  const reduced = centered.map(row => {
    const slice = row.slice(0, components);
    const magnitude = Math.sqrt(slice.reduce((sum, v) => sum + v * v, 0));
    const normalized = magnitude > 0 ? slice.map(v => v / magnitude) : slice;
    
    if (normalized.length < dimensions) {
      return [...normalized, ...Array(dimensions - normalized.length).fill(0)];
    }
    return normalized.slice(0, dimensions);
  });
  
  return reduced;
}

function applyTSNE(vectors, dimensions, numComponents = 10) {
  // Simplified t-SNE using MDS approach
  return applyMDS(vectors, dimensions);
}

function applyMDS(vectors, dimensions) {
  if (vectors.length === 0) return [];
  
  const n = vectors.length;
  const distances = Array(n).fill().map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(vectors[i], vectors[j]);
      distances[i][j] = dist;
      distances[j][i] = dist;
    }
  }
  
  const positions = Array(n).fill().map(() => 
    Array(dimensions).fill().map(() => (Math.random() - 0.5) * 2)
  );
  
  const iterations = Math.min(20, n * 2);
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
      
      for (let d = 0; d < dimensions; d++) {
        positions[i][d] += forces[d] * 0.01;
      }
    }
  }
  
  return positions;
}

// Export to window for global access
window.cosineSimilarity = cosineSimilarity;
window.cosineSimilarityVector = cosineSimilarityVector;
window.euclideanDistance = euclideanDistance;
window.applyPCA = applyPCA;
window.applyTSNE = applyTSNE;
window.applyMDS = applyMDS;

