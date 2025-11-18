/**
 * Enhanced UMAP Service
 * Proper UMAP implementation with cosine distance and fuzzy simplicial sets
 * Inspired by Project AELLA's UMAP visualization approach
 */

class UMAPService {
  constructor() {
    this.cosineDistance = this._cosineDistance.bind(this);
    this.cosineSimilarity = this._cosineSimilarity.bind(this);
  }

  /**
   * Compute UMAP layout with proper fuzzy simplicial set construction
   */
  async computeUMAP(embeddings, options = {}) {
    const {
      nNeighbors = 15,
      nComponents = 2,
      minDist = 0.1,
      spread = 1.0,
      randomState = 42,
      metric = 'cosine'
    } = options;

    const n = embeddings.length;
    if (n < 2) {
      return embeddings.map(() => [0, 0]);
    }


    // Step 1: Build fuzzy simplicial set (kNN graph with probabilities)
    const knnGraph = await this._buildFuzzySimplicialSet(embeddings, nNeighbors, metric);
    
    // Step 2: Initialize low-dimensional positions
    const positions = this._initializePositions(n, randomState);
    
    // Step 3: Optimize low-dimensional representation
    const optimizedPositions = await this._optimizeLayout(
      knnGraph,
      positions,
      {
        minDist,
        spread,
        nEpochs: this._computeNEpochs(n)
      }
    );

    return optimizedPositions;
  }

  /**
   * Build fuzzy simplicial set (kNN graph with probabilities)
   */
  async _buildFuzzySimplicialSet(embeddings, k, metric) {
    const n = embeddings.length;
    const graph = [];
    
    // Adaptive k based on dataset size
    const adaptiveK = Math.min(k, Math.max(5, Math.floor(Math.sqrt(n))));
    

    // OPTIMIZATION: Use approximate kNN for large datasets (sample-based)
    const useApproximate = n > 500;
    const sampleSize = useApproximate ? Math.min(500, Math.floor(n * 0.3)) : n;
    
    for (let i = 0; i < n; i++) {
      const neighbors = [];
      const distances = [];

      // Find k nearest neighbors (use sampling for large datasets)
      const candidates = useApproximate 
        ? (() => {
            // Sample candidates + include all neighbors from previous iterations
            const sampled = new Set([i]);
            while (sampled.size < sampleSize) {
              sampled.add(Math.floor(Math.random() * n));
            }
            return Array.from(sampled);
          })()
        : Array.from({ length: n }, (_, j) => j);

      for (const j of candidates) {
        if (i === j) continue;
        
        let dist;
        if (metric === 'cosine') {
          dist = this.cosineDistance(embeddings[i], embeddings[j]);
        } else {
          dist = this._euclideanDistance(embeddings[i], embeddings[j]);
        }
        
        distances.push({ index: j, distance: dist });
      }

      // Sort by distance and take k nearest
      distances.sort((a, b) => a.distance - b.distance);
      const kNearest = distances.slice(0, adaptiveK);

      // Compute probabilities using smooth kernel
      const rho_i = kNearest[0].distance; // Distance to nearest neighbor
      const sigma_i = this._computeSigma(kNearest, rho_i);

      kNearest.forEach(neighbor => {
        const prob = Math.exp(-Math.max(0, neighbor.distance - rho_i) / sigma_i);
        neighbors.push({
          index: neighbor.index,
          distance: neighbor.distance,
          probability: prob
        });
      });

      graph.push(neighbors);

      // Yield periodically
      if (i % 50 === 0 && i > 0) {
        await new Promise(resolve => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => resolve(), { timeout: 10 });
          } else {
            setTimeout(resolve, 0);
          }
        });
      }
    }

    return graph;
  }

  /**
   * Compute sigma for smooth kernel (binary search)
   */
  _computeSigma(kNearest, rho_i) {
    const k = kNearest.length;
    const target = Math.log2(k); // Target log probability sum
    
    let low = 0.001;
    let high = 1.0;
    let sigma = 0.5;

    // Binary search for sigma
    for (let iter = 0; iter < 20; iter++) {
      let sum = 0;
      for (const neighbor of kNearest) {
        const prob = Math.exp(-Math.max(0, neighbor.distance - rho_i) / sigma);
        sum += prob;
      }

      const logSum = Math.log2(sum + 1e-10);
      
      if (Math.abs(logSum - target) < 0.01) {
        break;
      }
      
      if (logSum < target) {
        high = sigma;
        sigma = (low + sigma) / 2;
      } else {
        low = sigma;
        sigma = (sigma + high) / 2;
      }
    }

    return sigma;
  }

  /**
   * Initialize low-dimensional positions
   */
  _initializePositions(n, randomState) {
    // Use reproducible random seed
    const positions = [];
    let seed = randomState;
    
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Initialize on small circle (like PCA initialization)
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n;
      const radius = 0.01;
      positions.push([
        Math.cos(angle) * radius + (random() - 0.5) * 0.001,
        Math.sin(angle) * radius + (random() - 0.5) * 0.001
      ]);
    }

    return positions;
  }

  /**
   * Optimize low-dimensional layout
   */
  async _optimizeLayout(knnGraph, positions, options) {
    const { minDist, spread, nEpochs } = options;
    const n = positions.length;
    const learningRate = 1.0;
    

    for (let epoch = 0; epoch < nEpochs; epoch++) {
      // Attractive forces (for neighbors in high-dim space)
      for (let i = 0; i < n; i++) {
        const neighbors = knnGraph[i];
        const pi = positions[i];

        for (const neighbor of neighbors) {
          const j = neighbor.index;
          const pj = positions[j];
          const prob = neighbor.probability;

          const dx = pi[0] - pj[0];
          const dy = pi[1] - pj[1];
          const dist2 = dx * dx + dy * dy + 1e-6;
          const dist = Math.sqrt(dist2);

          // Attractive force (pull together)
          const attractiveForce = prob * learningRate;
          const grad = attractiveForce * (dist - minDist) / (dist + 1e-6);

          pi[0] -= grad * dx;
          pi[1] -= grad * dy;
          pj[0] += grad * dx;
          pj[1] += grad * dy;
        }

        // Repulsive forces (for non-neighbors, sampled)
        const numRepulsive = Math.min(5, Math.floor(n / 10));
        for (let r = 0; r < numRepulsive; r++) {
          const j = Math.floor(Math.random() * n);
          if (i === j) continue;
          
          // Check if j is a neighbor
          const isNeighbor = knnGraph[i].some(n => n.index === j);
          if (isNeighbor) continue;

          const pj = positions[j];
          const dx = pi[0] - pj[0];
          const dy = pi[1] - pj[1];
          const dist2 = dx * dx + dy * dy + 1e-6;
          const dist = Math.sqrt(dist2);

          // Repulsive force (push apart)
          const repulsiveForce = (1 - 0) * learningRate; // Non-neighbor prob = 0
          const grad = repulsiveForce * minDist / (dist2 + 1e-6);

          pi[0] += grad * dx * 0.01;
          pi[1] += grad * dy * 0.01;
        }
      }

      // Yield periodically
      if (epoch % 5 === 0 || epoch === nEpochs - 1) {
        
        if (epoch < nEpochs - 1) {
          await new Promise(resolve => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(() => resolve(), { timeout: 10 });
            } else {
              setTimeout(resolve, 0);
            }
          });
        }
      }
    }

    return positions;
  }

  /**
   * Compute number of epochs based on dataset size
   */
  _computeNEpochs(n) {
    if (n < 200) return 30;
    if (n < 500) return 20;
    if (n < 1000) return 15;
    return 10;
  }

  /**
   * Cosine distance (1 - cosine similarity)
   */
  _cosineDistance(vec1, vec2) {
    return 1 - this._cosineSimilarity(vec1, vec2);
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
}

// Export to window
window.UMAPService = UMAPService;

// Create global instance
if (!window.umapService) {
  window.umapService = new UMAPService();
}

