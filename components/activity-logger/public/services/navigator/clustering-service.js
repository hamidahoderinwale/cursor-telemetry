/**
 * Enhanced Clustering Service
 * Auto-optimized K-means with silhouette scores
 * Inspired by Project AELLA's clustering approach
 */

class ClusteringService {
  constructor() {
    this.cosineSimilarity = this._cosineSimilarity.bind(this);
  }

  /**
   * Auto-optimize K-means clustering
   * Tests multiple K values and selects optimal based on silhouette score
   */
  autoOptimizeKMeans(embeddings, options = {}) {
    const {
      minK = 20,
      maxK = 60,
      step = 5,
      maxIterations = 10
    } = options;

    if (embeddings.length < minK) {
      // Too few points, use simple clustering
      return {
        k: Math.max(1, Math.floor(embeddings.length / 2)),
        clusters: this._simpleKMeans(embeddings, Math.max(1, Math.floor(embeddings.length / 2))),
        scores: [],
        silhouette: 0
      };
    }

    let bestK = minK;
    let bestScore = -1;
    let bestClusters = null;
    const scores = [];

    // Try different K values
    for (let k = minK; k <= maxK; k += step) {
      const clusters = this._kMeans(embeddings, k, maxIterations);
      const silhouette = this._computeSilhouetteScore(embeddings, clusters);
      
      scores.push({ k, score: silhouette });
      
      if (silhouette > bestScore) {
        bestScore = silhouette;
        bestK = k;
        bestClusters = clusters;
      }
    }

    return {
      k: bestK,
      clusters: bestClusters,
      scores: scores,
      silhouette: bestScore
    };
  }

  /**
   * K-means clustering implementation
   */
  _kMeans(embeddings, k, maxIterations = 10) {
    if (embeddings.length === 0 || k <= 0) {
      return embeddings.map(() => 0);
    }
    if (k >= embeddings.length) {
      return embeddings.map((_, i) => i);
    }

    const n = embeddings.length;
    const dim = embeddings[0].length;

    // Initialize centroids using k-means++ initialization
    const centroids = this._kMeansPlusPlus(embeddings, k, dim);
    const assignments = new Array(n).fill(0);

    // Iterate
    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to nearest centroid
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let bestCluster = 0;
        
        for (let c = 0; c < k; c++) {
          const dist = this._euclideanDistance(embeddings[i], centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }
        assignments[i] = bestCluster;
      }

      // Update centroids
      const clusterSizes = new Array(k).fill(0);
      const newCentroids = centroids.map(() => new Array(dim).fill(0));

      for (let i = 0; i < n; i++) {
        const cluster = assignments[i];
        clusterSizes[cluster]++;
        for (let d = 0; d < dim; d++) {
          newCentroids[cluster][d] += embeddings[i][d];
        }
      }

      // Check for convergence
      let converged = true;
      for (let c = 0; c < k; c++) {
        if (clusterSizes[c] === 0) continue;
        
        for (let d = 0; d < dim; d++) {
          newCentroids[c][d] /= clusterSizes[c];
        }
        
        // Check if centroid moved significantly
        const dist = this._euclideanDistance(centroids[c], newCentroids[c]);
        if (dist > 0.001) {
          converged = false;
        }
      }

      if (converged) {
        break;
      }

      // Update centroids
      for (let c = 0; c < k; c++) {
        centroids[c] = newCentroids[c];
      }
    }

    return assignments;
  }

  /**
   * K-means++ initialization (better than random)
   */
  _kMeansPlusPlus(embeddings, k, dim) {
    const n = embeddings.length;
    const centroids = [];
    const used = new Set();

    // First centroid: random
    let firstIdx = Math.floor(Math.random() * n);
    centroids.push([...embeddings[firstIdx]]);
    used.add(firstIdx);

    // Subsequent centroids: choose farthest from existing centroids
    for (let c = 1; c < k; c++) {
      const distances = new Array(n).fill(Infinity);
      
      for (let i = 0; i < n; i++) {
        if (used.has(i)) continue;
        
        // Distance to nearest existing centroid
        let minDist = Infinity;
        for (let j = 0; j < centroids.length; j++) {
          const dist = this._euclideanDistance(embeddings[i], centroids[j]);
          if (dist < minDist) {
            minDist = dist;
          }
        }
        distances[i] = minDist;
      }

      // Choose point with maximum distance (weighted by distance squared)
      const squaredDistances = distances.map(d => d * d);
      const sum = squaredDistances.reduce((a, b) => a + b, 0);
      
      let random = Math.random() * sum;
      let chosenIdx = 0;
      for (let i = 0; i < n; i++) {
        random -= squaredDistances[i];
        if (random <= 0) {
          chosenIdx = i;
          break;
        }
      }

      centroids.push([...embeddings[chosenIdx]]);
      used.add(chosenIdx);
    }

    return centroids;
  }

  /**
   * Simple K-means (for small datasets)
   */
  _simpleKMeans(embeddings, k) {
    return this._kMeans(embeddings, k, 5);
  }

  /**
   * Compute silhouette score for clustering quality
   * Higher score = better clustering (range: -1 to 1)
   */
  _computeSilhouetteScore(embeddings, assignments) {
    const n = embeddings.length;
    if (n < 2) return 0;

    const k = Math.max(...assignments) + 1;
    if (k === 1) return 0; // All in one cluster

    let totalSilhouette = 0;
    const sampleSize = Math.min(n, 200); // Sample for performance
    const sampled = new Set();

    // Sample points for silhouette calculation
    while (sampled.size < sampleSize) {
      const idx = Math.floor(Math.random() * n);
      sampled.add(idx);
    }

    for (const i of sampled) {
      const cluster = assignments[i];
      
      // Average distance to points in same cluster (a_i)
      let a_i = 0;
      let sameClusterCount = 0;
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (assignments[j] === cluster) {
          a_i += this._euclideanDistance(embeddings[i], embeddings[j]);
          sameClusterCount++;
        }
      }
      a_i = sameClusterCount > 0 ? a_i / sameClusterCount : 0;

      // Minimum average distance to other clusters (b_i)
      let b_i = Infinity;
      for (let c = 0; c < k; c++) {
        if (c === cluster) continue;
        
        let avgDist = 0;
        let otherClusterCount = 0;
        for (let j = 0; j < n; j++) {
          if (assignments[j] === c) {
            avgDist += this._euclideanDistance(embeddings[i], embeddings[j]);
            otherClusterCount++;
          }
        }
        
        if (otherClusterCount > 0) {
          avgDist = avgDist / otherClusterCount;
          if (avgDist < b_i) {
            b_i = avgDist;
          }
        }
      }

      // Silhouette for this point
      const s_i = b_i === Infinity ? 0 : (b_i - a_i) / Math.max(a_i, b_i);
      totalSilhouette += s_i;
    }

    return totalSilhouette / sampleSize;
  }

  /**
   * Compute cluster quality metrics
   */
  computeQualityMetrics(embeddings, assignments) {
    const k = Math.max(...assignments) + 1;
    const clusters = [];
    
    // Group points by cluster
    for (let c = 0; c < k; c++) {
      clusters.push(embeddings.filter((_, i) => assignments[i] === c));
    }

    // Cohesion: average intra-cluster distance
    let cohesion = 0;
    let cohesionCount = 0;
    clusters.forEach(cluster => {
      if (cluster.length < 2) return;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          cohesion += this._euclideanDistance(cluster[i], cluster[j]);
          cohesionCount++;
        }
      }
    });
    cohesion = cohesionCount > 0 ? cohesion / cohesionCount : 0;

    // Separation: average inter-cluster distance
    let separation = 0;
    let separationCount = 0;
    for (let c1 = 0; c1 < k; c1++) {
      for (let c2 = c1 + 1; c2 < k; c2++) {
        if (clusters[c1].length === 0 || clusters[c2].length === 0) continue;
        
        // Distance between cluster centroids
        const centroid1 = this._computeCentroid(clusters[c1]);
        const centroid2 = this._computeCentroid(clusters[c2]);
        separation += this._euclideanDistance(centroid1, centroid2);
        separationCount++;
      }
    }
    separation = separationCount > 0 ? separation / separationCount : 0;

    // Silhouette score
    const silhouette = this._computeSilhouetteScore(embeddings, assignments);

    // Balance: size distribution (lower std dev = more balanced)
    const sizes = clusters.map(c => c.length);
    const meanSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - meanSize, 2), 0) / sizes.length;
    const balance = 1 / (1 + Math.sqrt(variance)); // Normalized to 0-1

    return {
      cohesion,
      separation,
      silhouette,
      balance,
      clusterSizes: sizes
    };
  }

  /**
   * Compute centroid of points
   */
  _computeCentroid(points) {
    if (points.length === 0) return [];
    
    const dim = points[0].length;
    const centroid = new Array(dim).fill(0);
    
    points.forEach(point => {
      for (let d = 0; d < dim; d++) {
        centroid[d] += point[d];
      }
    });
    
    for (let d = 0; d < dim; d++) {
      centroid[d] /= points.length;
    }
    
    return centroid;
  }

  /**
   * Euclidean distance
   */
  _euclideanDistance(vec1, vec2) {
    let sum = 0;
    const minLen = Math.min(vec1.length, vec2.length);
    for (let i = 0; i < minLen; i++) {
      const diff = vec1[i] - vec2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Cosine similarity
   */
  _cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    const minLen = Math.min(vec1.length, vec2.length);
    
    for (let i = 0; i < minLen; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}

// Export to window
window.ClusteringService = ClusteringService;

// Create global instance
if (!window.clusteringService) {
  window.clusteringService = new ClusteringService();
}

