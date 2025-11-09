/**
 * Navigator Layout Module
 * Layout computation algorithms (physical, latent, UMAP)
 */

/**
 * Compute physical layout based on co-occurrence similarity
 * Enhanced with workspace and directory awareness
 */
function computePhysicalLayout(files) {
  // Use co-occurrence similarity (same as file graph)
  const links = [];
  const threshold = 0.3;
  
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];
      
      const sessions1 = new Set((file1.events || []).map(e => e.session_id).filter(Boolean));
      const sessions2 = new Set((file2.events || []).map(e => e.session_id).filter(Boolean));
      
      const intersection = new Set([...sessions1].filter(x => sessions2.has(x)));
      const union = new Set([...sessions1, ...sessions2]);
      
      let similarity = union.size > 0 ? intersection.size / union.size : 0;
      
      // Boost similarity for files in same workspace
      if (file1.workspace && file2.workspace && file1.workspace === file2.workspace) {
        similarity *= 1.3; // 30% boost
      }
      
      // Boost similarity for files in same directory
      if (file1.directory && file2.directory) {
        const dir1Parts = file1.directory.split('/').filter(p => p);
        const dir2Parts = file2.directory.split('/').filter(p => p);
        const commonDepth = Math.min(dir1Parts.length, dir2Parts.length);
        let commonParts = 0;
        for (let d = 0; d < commonDepth; d++) {
          if (dir1Parts[d] === dir2Parts[d]) {
            commonParts++;
          } else {
            break;
          }
        }
        if (commonParts > 0) {
          // Boost based on directory depth similarity
          const dirBoost = 1 + (commonParts / Math.max(dir1Parts.length, dir2Parts.length)) * 0.2;
          similarity *= dirBoost;
        }
      }
      
      if (similarity > threshold) {
        links.push({
          source: file1.id,
          target: file2.id,
          similarity: similarity,
          sameWorkspace: file1.workspace === file2.workspace,
          sameDirectory: file1.directory === file2.directory
        });
      }
    }
  }
  
  // Use force simulation to compute positions
  const width = 800, height = 700;
  const tempSimulation = d3.forceSimulation(files)
    .force('link', d3.forceLink(links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));
  
  // Run simulation to completion (reduced iterations for speed)
  const simIterations = Math.min(100, files.length * 2); // Adaptive
  console.log(`[LAYOUT] Running force simulation for ${simIterations} ticks...`);
  for (let i = 0; i < simIterations; i++) {
    tempSimulation.tick();
  }
  console.log(`[LAYOUT] Physical layout complete`);
  
  tempSimulation.stop();
  
  return { nodes: files, links };
}

/**
 * Build kNN graph for UMAP-like layout (optimized with sampling)
 */
async function buildKNN(vectors, k) {
  const sims = (a, b) => window.cosineSimilarityVector ? window.cosineSimilarityVector(a, b) : 0;
  const neighbors = [];
  const n = vectors.length;
  
  // For large datasets, use sampling to speed up kNN
  const useSampling = n > 500;
  const sampleSize = useSampling ? Math.min(300, Math.floor(n * 0.3)) : n;
  
  for (let i = 0; i < n; i++) {
    const scores = [];
    
    if (useSampling) {
      // Sample random indices for comparison (much faster)
      const sampled = new Set();
      while (sampled.size < sampleSize) {
        const idx = Math.floor(Math.random() * n);
        if (idx !== i) sampled.add(idx);
      }
      sampled.forEach(j => {
        scores.push({ index: j, score: sims(vectors[i], vectors[j]) });
      });
    } else {
      // Full comparison for small datasets
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        scores.push({ index: j, score: sims(vectors[i], vectors[j]) });
      }
    }
    
    scores.sort((a, b) => b.score - a.score);
    neighbors.push(scores.slice(0, k));
    
    // Yield every 50 files to prevent blocking
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
  return neighbors;
}

/**
 * Create feature vector from file for semantic analysis (optimized)
 */
function createFeatureVector(file) {
  // Create a simple feature vector based on file characteristics
  const vector = [];
  
  // Content-based features (simplified TF-IDF - reduced for speed)
  const content = (file.content || '').substring(0, 10000); // Limit content size
  const words = content.toLowerCase().match(/\b\w{3,}\b/g) || []; // Only words 3+ chars
  const wordCounts = {};
  words.forEach(w => wordCounts[w] = (wordCounts[w] || 0) + 1);
  
  // Take top 50 words as features (reduced from 100)
  const topWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);
  
  topWords.forEach(([word, count]) => {
    vector.push(count / Math.max(words.length, 1)); // Normalized frequency
  });
  
  // Pad to fixed size for consistency
  while (vector.length < 50) {
    vector.push(0);
  }
  
  // Structural features
  vector.push(Math.min(file.changes / 100, 1)); // Normalized changes (capped)
  vector.push(Math.min(file.events.length / 50, 1)); // Normalized event count (capped)
  
  // Extension one-hot (simplified)
  const exts = ['js', 'ts', 'py', 'html', 'css', 'json', 'md', 'tsx', 'jsx'];
  exts.forEach(ext => {
    vector.push(file.ext === ext ? 1 : 0);
  });
  
  return vector;
}

/**
 * UMAP-like latent layout: kNN graph + attractive/repulsive optimization (optimized)
 */
async function computeLatentLayoutUMAP(files) {
  const width = 800, height = 700;
  const padding = 100;
  
  // Create feature vectors with progress updates
  const vectors = [];
  for (let i = 0; i < files.length; i++) {
    vectors.push(createFeatureVector(files[i]));
    // Yield every 100 files
    if (i % 100 === 0 && i > 0) {
      await new Promise(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve(), { timeout: 10 });
        } else {
          setTimeout(resolve, 0);
        }
      });
    }
  }
  console.log(`[UMAP] Building feature space for ${vectors.length} nodes`);

  // Build kNN graph using cosine similarity (now async)
  const k = Math.min(15, Math.max(5, Math.floor(Math.sqrt(files.length))));
  const neighbors = await buildKNN(vectors, k);
  console.log(`[UMAP] kNN graph built with k=${k}`);

  // Initialize positions (PCA-lite via random small circle)
  const positions = vectors.map((_, i) => {
    const angle = (2 * Math.PI * i) / vectors.length;
    return [Math.cos(angle) * 0.01, Math.sin(angle) * 0.01];
  });

  // Optimize (epochs) - significantly reduced for speed
  // Adaptive epochs: fewer for larger datasets
  const baseEpochs = files.length < 200 ? 30 : files.length < 500 ? 20 : 15;
  const epochs = Math.min(baseEpochs, 10 + Math.floor(files.length / 100));
  const learningRate = 0.15; // Slightly higher for faster convergence
  const minDist = 0.1;
  const negSamples = 2; // Reduced from 3
  
  console.log(`[UMAP] Running ${epochs} optimization epochs...`);
  
  for (let e = 0; e < epochs; e++) {
    for (let i = 0; i < vectors.length; i++) {
      const pi = positions[i];
      // Attractive forces for neighbors
      const neigh = neighbors[i];
      for (let n = 0; n < neigh.length; n++) {
        const j = neigh[n].index;
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
      // Negative sampling: mild repulsion from random nodes (reduced)
      for (let s = 0; s < negSamples; s++) {
        const j = Math.floor(Math.random() * vectors.length);
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
    
    // Yield to browser every epoch for large datasets
    if (files.length > 300 && e < epochs - 1) {
      await new Promise(resolve => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => resolve(), { timeout: 10 });
        } else {
          setTimeout(resolve, 0);
        }
      });
    }
    
    if (e % 5 === 0 || e === epochs - 1) {
      console.log(`[UMAP] Epoch ${e + 1}/${epochs}`);
    }
  }

  // Scale to canvas
  const xs = positions.map(p => p[0]);
  const ys = positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (width - 2 * padding) / (maxX - minX || 1);
  const scaleY = (height - 2 * padding) / (maxY - minY || 1);
  console.log(`[UMAP] Latent layout complete for ${files.length} nodes`);

  return files.map((file, i) => ({
    ...file,
    x: padding + (positions[i][0] - minX) * scaleX,
    y: padding + (positions[i][1] - minY) * scaleY
  }));
}

/**
 * Detect latent clusters using k-means on latent positions
 */
function detectLatentClusters(nodes, links) {
  // Use k-means clustering on latent positions
  // More aggressive clustering: aim for 3-8 clusters based on file count
  let k;
  if (nodes.length < 6) {
    k = Math.max(1, Math.floor(nodes.length / 2)); // 2-3 nodes per cluster for small sets
  } else if (nodes.length < 20) {
    k = Math.min(5, Math.max(3, Math.ceil(nodes.length / 4))); // 3-5 clusters
  } else {
    k = Math.min(8, Math.max(4, Math.ceil(nodes.length / 8))); // 4-8 clusters for larger sets
  }
  
  const clusters = [];
  
  if (nodes.length === 0) return clusters;
  
  console.log(`[TARGET] Detecting ${k} latent clusters from ${nodes.length} files`);
  
  // Initialize centroids randomly
  const centroids = [];
  const used = new Set();
  for (let i = 0; i < k; i++) {
    let idx;
    do {
      idx = Math.floor(Math.random() * nodes.length);
    } while (used.has(idx) && used.size < nodes.length);
    used.add(idx);
    centroids.push({ x: nodes[idx].x, y: nodes[idx].y });
  }
  
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
  ];
  
  // Run k-means iterations
  for (let iter = 0; iter < 10; iter++) {
    // Assign nodes to nearest centroid
    const assignments = nodes.map(node => {
      let minDist = Infinity;
      let cluster = 0;
      centroids.forEach((c, i) => {
        const dist = Math.sqrt((node.x - c.x) ** 2 + (node.y - c.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          cluster = i;
        }
      });
      return cluster;
    });
    
    // Update centroids
    for (let i = 0; i < k; i++) {
      const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
      if (clusterNodes.length > 0) {
        centroids[i] = {
          x: d3.mean(clusterNodes, d => d.x),
          y: d3.mean(clusterNodes, d => d.y)
        };
      }
    }
  }
  
  // Final assignment
  const assignments = nodes.map(node => {
    let minDist = Infinity;
    let cluster = 0;
    centroids.forEach((c, i) => {
      const dist = Math.sqrt((node.x - c.x) ** 2 + (node.y - c.y) ** 2);
      if (dist < minDist) {
        minDist = dist;
        cluster = i;
      }
    });
    return cluster;
  });
  
  // Create cluster objects
  for (let i = 0; i < k; i++) {
    const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
    if (clusterNodes.length > 0) {
      clusterNodes.forEach(n => n.cluster = `latent-${i}`);
      clusters.push({
        id: `latent-${i}`,
        name: `Cluster ${i + 1}`, // Will be updated by annotator
        nodes: clusterNodes,
        color: clusterColors[i % clusterColors.length],
        centroid: centroids[i],
        description: '', // Will be populated by annotator
        keywords: [],
        category: 'unknown'
      });
    }
  }
  
  // Annotate clusters asynchronously (non-blocking)
  if (window.clusterAnnotator && clusters.length > 0) {
    window.clusterAnnotator.annotateClusters(clusters, {
      useLLM: window.CONFIG?.ENABLE_SEMANTIC_SEARCH === true,
      useEmbeddings: window.CONFIG?.ENABLE_SEMANTIC_SEARCH === true
    }).then(annotatedClusters => {
      // Update clusters with annotations
      annotatedClusters.forEach((annotated, idx) => {
        if (clusters[idx]) {
          clusters[idx].name = annotated.name;
          clusters[idx].description = annotated.description;
          clusters[idx].keywords = annotated.keywords;
          clusters[idx].category = annotated.category;
        }
      });
      
      // Trigger re-render if navigator is active
      if (window.navigatorState && window.navigatorState.clusters) {
        window.navigatorState.clusters = clusters;
        // Dispatch event to update UI
        window.dispatchEvent(new CustomEvent('clusters-annotated', { detail: { clusters } }));
      }
    }).catch(err => {
      console.warn('[CLUSTER-ANNOTATOR] Annotation failed, using default names:', err.message);
    });
  }
  
  return clusters;
}

// Export to window
window.computePhysicalLayout = computePhysicalLayout;
window.computeLatentLayoutUMAP = computeLatentLayoutUMAP;
window.buildKNN = buildKNN;
window.createFeatureVector = createFeatureVector;
window.detectLatentClusters = detectLatentClusters;


