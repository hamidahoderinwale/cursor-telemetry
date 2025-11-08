/**
 * Similarity Algorithms
 * Various distance and similarity metrics for vector comparison
 */

/**
 * Cosine Similarity between two vectors
 * @param {Array} vec1 - First vector
 * @param {Array} vec2 - Second vector
 * @returns {number} Similarity score between -1 and 1 (1 = identical direction)
 */
export function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  const minLength = Math.min(vec1.length, vec2.length);
  for (let i = 0; i < minLength; i++) {
    const v1 = vec1[i] || 0;
    const v2 = vec2[i] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }
  
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude > 0 ? dotProduct / magnitude : 0;
}

/**
 * Cosine Similarity between two vectors (alternative name for consistency)
 */
export function cosineSimilarityVector(a, b) {
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

/**
 * Euclidean Distance between two vectors
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} Euclidean distance
 */
export function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

/**
 * Manhattan Distance between two vectors
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} Manhattan distance
 */
export function manhattanDistance(a, b) {
  return a.reduce((sum, val, i) => sum + Math.abs(val - b[i]), 0);
}

/**
 * Jaccard Similarity for sets
 * @param {Set} set1 - First set
 * @param {Set} set2 - Second set
 * @returns {number} Jaccard similarity (0 to 1)
 */
export function jaccardSimilarity(set1, set2) {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.cosineSimilarity = cosineSimilarity;
  window.cosineSimilarityVector = cosineSimilarityVector;
  window.euclideanDistance = euclideanDistance;
  window.manhattanDistance = manhattanDistance;
  window.jaccardSimilarity = jaccardSimilarity;
}


