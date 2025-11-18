/**
 * Navigator Layout Module
 * Layout computation algorithms (physical, latent, UMAP)
 */

// Prevent redeclaration if script is loaded multiple times
if (!window._navigatorLayoutLoaded) {
  window._navigatorLayoutLoaded = true;

/**
 * Compute physical layout based on co-occurrence similarity
 * Enhanced with workspace and directory awareness
 */
function computePhysicalLayout(files) {
  // Use co-occurrence similarity (same as file graph)
  // Optimized: limit comparisons for large datasets
  const links = [];
  const threshold = 0.3;
  const MAX_FILES_FOR_FULL_COMPARISON = 300; // Only do full O(n²) for smaller sets
  
  // For large datasets, use sampling to reduce comparisons
  const filesToCompare = files.length > MAX_FILES_FOR_FULL_COMPARISON 
    ? files.slice(0, MAX_FILES_FOR_FULL_COMPARISON) 
    : files;
  
  for (let i = 0; i < filesToCompare.length; i++) {
    for (let j = i + 1; j < filesToCompare.length; j++) {
      const file1 = filesToCompare[i];
      const file2 = filesToCompare[j];
      
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
  // Optimized based on Barnes-Hut and large-scale graph techniques
  const width = 800, height = 700;
  const nodeCount = filesToCompare.length;
  
  // Adaptive force parameters based on graph size (inspired by ForceAtlas2 and Barnes-Hut)
  // For larger graphs, reduce repulsion strength and increase distance
  const baseCharge = -300;
  const adaptiveCharge = nodeCount > 100 
    ? baseCharge * Math.sqrt(100 / nodeCount) // Scale down for large graphs
    : baseCharge;
  
  const baseDistance = 100;
  const adaptiveDistance = nodeCount > 100
    ? baseDistance * Math.sqrt(nodeCount / 100) // Scale up for large graphs
    : baseDistance;
  
  // Barnes-Hut optimization: theta parameter controls approximation quality
  // Lower theta = more accurate but slower, higher theta = faster but less accurate
  // For large graphs, use higher theta (0.9) for speed
  const theta = nodeCount > 200 ? 0.9 : 0.7;
  
  const tempSimulation = d3.forceSimulation(filesToCompare)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => {
        // Adaptive distance based on similarity and graph size
        const baseDist = adaptiveDistance;
        const similarity = d.similarity || 0.5;
        // Closer for higher similarity
        return baseDist * (1.5 - similarity);
      })
      .strength(d => {
        // Stronger links for higher similarity
        return (d.similarity || 0.5) * 0.5;
      }))
    .force('charge', d3.forceManyBody()
      .strength(adaptiveCharge)
      .theta(theta) // Barnes-Hut approximation parameter
      .distanceMax(500)) // Limit interaction distance for performance
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))
    .force('collision', d3.forceCollide().radius(30))
    .alphaDecay(0.02) // Faster decay for quicker convergence
    .velocityDecay(0.4); // Higher friction for stability
  
  // Two-stage approach: fast initial layout, then refine
  // Stage 1: Quick layout with high alpha (fast movement)
  tempSimulation.alpha(1.0).restart();
  const quickIterations = Math.min(30, Math.max(10, Math.floor(nodeCount / 10)));
  for (let i = 0; i < quickIterations; i++) {
    tempSimulation.tick();
  }
  
  // Stage 2: Refinement with lower alpha (fine-tuning)
  if (nodeCount < 200) { // Only refine for smaller graphs
    tempSimulation.alpha(0.3).restart();
    const refineIterations = Math.min(20, Math.max(5, Math.floor(nodeCount / 20)));
    for (let i = 0; i < refineIterations; i++) {
      tempSimulation.tick();
    }
  }
  
  tempSimulation.stop();
  
  // Return all files but only computed positions for subset
  // Other files will use default positions
  return { nodes: files, links };
}

/**
 * Build kNN graph for UMAP-like layout (optimized with sampling)
 * Improved based on large-scale graph techniques: better sampling, spatial hashing
 */
async function buildKNN(vectors, k) {
  const sims = (a, b) => window.cosineSimilarityVector ? window.cosineSimilarityVector(a, b) : 0;
  const neighbors = [];
  const n = vectors.length;
  
  // Adaptive sampling strategy based on graph size
  // For very large graphs, use spatial hashing or locality-sensitive hashing
  const useSampling = n > 200;
  
  // Improved sampling: use more samples for better quality, but still fast
  // Sample size scales logarithmically with n (like Barnes-Hut)
  const sampleSize = useSampling 
    ? Math.min(300, Math.max(100, Math.floor(n * Math.log2(n) / 50)))
    : n;
  
  // For very large graphs, use two-stage approach:
  // 1. Quick approximate kNN with sampling
  // 2. Refine top candidates with full comparison
  const useTwoStage = n > 500;
  const candidateSize = useTwoStage ? k * 3 : sampleSize; // Get more candidates, then refine
  
  for (let i = 0; i < n; i++) {
    const scores = [];
    
    if (useSampling) {
      // Improved sampling: prefer nearby vectors in embedding space
      // For first pass, use random sampling (fast)
      const sampled = new Set();
      const targetSize = useTwoStage ? candidateSize : sampleSize;
      
      while (sampled.size < targetSize) {
        const idx = Math.floor(Math.random() * n);
        if (idx !== i) sampled.add(idx);
      }
      
      // Compute similarities for sampled candidates
      sampled.forEach(j => {
        const score = sims(vectors[i], vectors[j]);
        scores.push({ index: j, score: score });
      });
      
      // Sort and take top candidates
      scores.sort((a, b) => b.score - a.score);
      
      // Two-stage: refine top candidates with full comparison to their neighbors
      if (useTwoStage && scores.length > k) {
        const topCandidates = scores.slice(0, candidateSize);
        const refined = [];
        
        // For each top candidate, check its neighbors too
        for (const candidate of topCandidates.slice(0, k * 2)) {
          refined.push(candidate);
          // Check a few random neighbors of this candidate
          for (let neighborCheck = 0; neighborCheck < 3; neighborCheck++) {
            const neighborIdx = Math.floor(Math.random() * n);
            if (neighborIdx !== i && neighborIdx !== candidate.index) {
              const neighborScore = sims(vectors[i], vectors[neighborIdx]);
              if (neighborScore > candidate.score * 0.8) { // Only if promising
                refined.push({ index: neighborIdx, score: neighborScore });
              }
            }
          }
        }
        
        // Sort refined candidates and take top k
        refined.sort((a, b) => b.score - a.score);
        neighbors.push(refined.slice(0, k));
      } else {
        neighbors.push(scores.slice(0, k));
      }
    } else {
      // Full comparison for small datasets
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        scores.push({ index: j, score: sims(vectors[i], vectors[j]) });
      }
      scores.sort((a, b) => b.score - a.score);
      neighbors.push(scores.slice(0, k));
    }
    
    // Progressive yielding: more frequent for large graphs
    const yieldInterval = n > 1000 ? 25 : 50;
    if (i % yieldInterval === 0 && i > 0) {
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
  // Build conversation hierarchy if available for context
  let conversationContext = null;
  if (window.ConversationHierarchyBuilder && window.state?.data?.prompts) {
    try {
      const hierarchyBuilder = new window.ConversationHierarchyBuilder();
      const hierarchy = hierarchyBuilder.buildHierarchy(window.state.data.prompts, []);
      
      // Find conversations that reference this file
      const fileConversations = [];
      hierarchy.workspaces.forEach(workspace => {
        workspace.conversations.forEach(conv => {
          const convFiles = hierarchyBuilder.getConversationFiles(conv, true);
          if (convFiles.includes(file.path || file.id)) {
            fileConversations.push({
              id: conv.id,
              title: conv.title,
              workspace: workspace.name,
              messageCount: conv.metadata.messageCount
            });
          }
        });
      });
      
      if (fileConversations.length > 0) {
        conversationContext = fileConversations;
      }
    } catch (error) {
      // Failed to build conversation context
    }
  }
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
  
  // Add conversation context features (if available)
  // This helps cluster files that are discussed together in the same conversations
  if (conversationContext && conversationContext.length > 0) {
    // Add features based on conversation IDs (hashed for privacy)
    // Use multiple hash positions to create richer features
    conversationContext.forEach((conv, idx) => {
      const hash = conv.id.substring(0, 8);
      // Add multiple features from hash to capture conversation relationships
      for (let i = 0; i < Math.min(3, hash.length); i++) {
        vector.push((hash.charCodeAt(i) % 10) / 10); // Normalize to 0-1
      }
      // Add conversation size feature (larger conversations = more important)
      vector.push(Math.min(conv.messageCount / 50, 1)); // Normalize to 0-1
    });
  }
  
  return vector;
}

/**
 * Enhanced UMAP latent layout using proper UMAP algorithm
 * Uses code embeddings and proper fuzzy simplicial sets
 */
async function computeLatentLayoutUMAP(files) {
  const width = 800, height = 700;
  const padding = 100;
  
  // Check for cached UMAP layout first
  if (window.performanceCache) {
    try {
      const cachedPositions = await window.performanceCache.getUMAP(files, 24 * 60 * 60 * 1000);
      if (cachedPositions && cachedPositions.length === files.length) {
        return files.map((file, i) => ({
          ...file,
          x: cachedPositions[i][0],
          y: cachedPositions[i][1]
        }));
      }
    } catch (e) {
      // Cache check failed
    }
  }
  
  // Step 1: Generate embeddings (use enhanced embedding service if available)
  let embeddings = [];
  let useEnhancedEmbeddings = false;
  
  if (window.codeEmbeddingService) {
    try {
      await window.codeEmbeddingService.initialize();
      
      if (window.codeEmbeddingService.isInitialized) {
        embeddings = await window.codeEmbeddingService.generateEmbeddingsBatch(files, {
          batchSize: 32
        });
        useEnhancedEmbeddings = true;
      }
    } catch (error) {
      console.warn('[UMAP] Enhanced embeddings failed, using fallback:', error.message);
    }
  }
  
  // Fallback: Use feature vectors
  if (!useEnhancedEmbeddings || embeddings.length === 0) {
    for (let i = 0; i < files.length; i++) {
      const vector = createFeatureVector(files[i]);
      embeddings.push(vector);
      files[i].featureVector = vector;
      
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
  } else {
    // Cache embeddings on files
    files.forEach((file, i) => {
      file.featureVector = embeddings[i];
      file.embedding = embeddings[i]; // Store full embedding
    });
  }
  
  // Step 2: Use enhanced UMAP service if available
  let positions;
  if (window.umapService && useEnhancedEmbeddings) {
    try {
      positions = await window.umapService.computeUMAP(embeddings, {
        nNeighbors: Math.min(15, Math.max(5, Math.floor(Math.sqrt(files.length)))),
        nComponents: 2,
        minDist: 0.1,
        spread: 1.0,
        metric: 'cosine',
        randomState: 42
      });
    } catch (error) {
      console.warn('[UMAP] Enhanced UMAP failed, using fallback:', error.message);
      positions = null;
    }
  }
  
  // Fallback: Use original UMAP-like algorithm
  if (!positions) {
    const k = Math.min(15, Math.max(5, Math.floor(Math.sqrt(files.length))));
    const neighbors = await buildKNN(embeddings, k);
    
    positions = embeddings.map((_, i) => {
      const angle = (2 * Math.PI * i) / embeddings.length;
      return [Math.cos(angle) * 0.01, Math.sin(angle) * 0.01];
    });
    
    const baseEpochs = files.length < 200 ? 30 : files.length < 500 ? 20 : 15;
    const epochs = Math.min(baseEpochs, 10 + Math.floor(files.length / 100));
    const learningRate = 0.15;
    const minDist = 0.1;
    const negSamples = 2;
    
    for (let e = 0; e < epochs; e++) {
      for (let i = 0; i < embeddings.length; i++) {
        const pi = positions[i];
        const neigh = neighbors[i];
        for (let n = 0; n < neigh.length; n++) {
          const j = neigh[n].index;
          const pj = positions[j];
          const dx = pi[0] - pj[0];
          const dy = pi[1] - pj[1];
          const dist2 = dx * dx + dy * dy + 1e-6;
          const grad = (dist2 > minDist ? (dist2 - minDist) : 0) * learningRate;
          pi[0] -= grad * dx;
          pi[1] -= grad * dy;
          pj[0] += grad * dx;
          pj[1] += grad * dy;
        }
        for (let s = 0; s < negSamples; s++) {
          const j = Math.floor(Math.random() * embeddings.length);
          if (j === i) continue;
          const pj = positions[j];
          const dx = pi[0] - pj[0];
          const dy = pi[1] - pj[1];
          const dist2 = dx * dx + dy * dy + 1e-6;
          const inv = learningRate / Math.sqrt(dist2);
          pi[0] += inv * dx * 0.01;
          pi[1] += inv * dy * 0.01;
          pj[0] -= inv * dx * 0.01;
          pj[1] -= inv * dy * 0.01;
        }
      }
      if (files.length > 300 && e < epochs - 1) {
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
  
  // Scale to canvas
  const xs = positions.map(p => p[0]);
  const ys = positions.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (width - 2 * padding) / (maxX - minX || 1);
  const scaleY = (height - 2 * padding) / (maxY - minY || 1);

  const scaledPositions = positions.map(p => [
    padding + (p[0] - minX) * scaleX,
    padding + (p[1] - minY) * scaleY
  ]);

  // Cache UMAP layout (async, don't wait)
  if (window.performanceCache) {
    window.performanceCache.storeUMAP(files, positions).catch(() => {});
  }

  return files.map((file, i) => ({
    ...file,
    x: scaledPositions[i][0],
    y: scaledPositions[i][1]
  }));
}

/**
 * Enhanced cluster detection with auto-optimization
 * Uses auto-optimized K-means with silhouette scores
 */
async function detectLatentClusters(nodes, links) {
  // Helper function for semantic k-means sub-clustering using content similarity
  function kMeansClustering(nodes, links, k) {
    if (nodes.length === 0 || k <= 0) return nodes.map(() => 0);
    if (k >= nodes.length) return nodes.map((_, i) => i);
    
    // Create feature vectors from file content for semantic clustering
    const vectors = nodes.map(node => {
      if (node.featureVector) {
        return node.featureVector; // Use cached vector if available
      }
      // Create feature vector from file content
      return createFeatureVector(node);
    });
    
    // Compute cosine similarity helper
    const cosineSimilarity = (vec1, vec2) => {
      let dotProduct = 0;
      let mag1 = 0;
      let mag2 = 0;
      for (let i = 0; i < Math.min(vec1.length, vec2.length); i++) {
        dotProduct += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
      }
      const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
      return magnitude > 0 ? dotProduct / magnitude : 0;
    };
    
    // Initialize centroids using feature vectors (not just spatial positions)
    const centroids = [];
    const used = new Set();
    for (let i = 0; i < k; i++) {
      let idx;
      do {
        idx = Math.floor(Math.random() * nodes.length);
      } while (used.has(idx) && used.size < nodes.length);
      used.add(idx);
      // Store both feature vector and spatial position for centroid
      centroids.push({
        vector: [...vectors[idx]], // Copy feature vector
        x: nodes[idx].x,
        y: nodes[idx].y
      });
    }
    
    // Run k-means with content-based similarity
    for (let iter = 0; iter < 5; iter++) {
      const assignments = nodes.map((node, idx) => {
        let maxSimilarity = -Infinity;
        let cluster = 0;
        centroids.forEach((c, i) => {
          // Use both content similarity (70%) and spatial proximity (30%)
          const contentSim = cosineSimilarity(vectors[idx], c.vector);
          const spatialDist = Math.sqrt((node.x - c.x) ** 2 + (node.y - c.y) ** 2);
          const spatialSim = 1 / (1 + spatialDist); // Convert distance to similarity
          const combined = 0.7 * contentSim + 0.3 * spatialSim;
          if (combined > maxSimilarity) {
            maxSimilarity = combined;
            cluster = i;
          }
        });
        return cluster;
      });
      
      // Update centroids (average feature vectors and positions)
      for (let i = 0; i < k; i++) {
        const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
        if (clusterNodes.length > 0) {
          // Average feature vectors
          const avgVector = new Array(vectors[0].length).fill(0);
          clusterNodes.forEach((node, idx) => {
            const nodeIdx = nodes.indexOf(node);
            vectors[nodeIdx].forEach((val, j) => {
              avgVector[j] += val;
            });
          });
          avgVector.forEach((val, j) => {
            avgVector[j] = val / clusterNodes.length;
          });
          
          centroids[i] = {
            vector: avgVector,
            x: d3.mean(clusterNodes, d => d.x),
            y: d3.mean(clusterNodes, d => d.y)
          };
        }
      }
    }
    
    // Final assignment using content + spatial similarity
    return nodes.map((node, idx) => {
      let maxSimilarity = -Infinity;
      let cluster = 0;
      centroids.forEach((c, i) => {
        const contentSim = cosineSimilarity(vectors[idx], c.vector);
        const spatialDist = Math.sqrt((node.x - c.x) ** 2 + (node.y - c.y) ** 2);
        const spatialSim = 1 / (1 + spatialDist);
        const combined = 0.7 * contentSim + 0.3 * spatialSim;
        if (combined > maxSimilarity) {
          maxSimilarity = combined;
          cluster = i;
        }
      });
      return cluster;
    });
  }
  
  // Create hierarchical clusters: Workspace -> Directory -> Semantic sub-clusters
  const workspaceClusters = new Map();
  
  // First pass: Group nodes by workspace
  nodes.forEach(node => {
    const workspace = node.workspace || 'unknown';
    if (!workspaceClusters.has(workspace)) {
      workspaceClusters.set(workspace, new Map());
    }
    
    // Group by directory within workspace
    const directory = node.topLevelDir || node.path?.split('/').slice(0, -1).join('/') || 'root';
    if (!workspaceClusters.get(workspace).has(directory)) {
      workspaceClusters.get(workspace).set(directory, []);
    }
    workspaceClusters.get(workspace).get(directory).push(node);
  });
  
  // Build hierarchical cluster structure
  const clusters = [];
  // Define cluster colors at function scope to avoid redeclaration
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4'
  ];
  const subClusterColors = [
    '#a78bfa', '#c084fc', '#f472b6', '#fb923c',
    '#34d399', '#60a5fa', '#f87171', '#22d3ee'
  ];
  
  let colorIndex = 0;
  workspaceClusters.forEach((directoryMap, workspace) => {
    const workspaceNodes = [];
    const subClusters = [];
    
    directoryMap.forEach((dirNodes, directory) => {
      if (dirNodes.length > 0) {
        workspaceNodes.push(...dirNodes);
        
        // For directories with many files, create semantic sub-clusters
        if (dirNodes.length > 5) {
          const subK = Math.min(3, Math.max(2, Math.ceil(dirNodes.length / 8)));
          const subAssignments = kMeansClustering(dirNodes, links, subK);
          
          for (let i = 0; i < subK; i++) {
            const subClusterNodes = dirNodes.filter((_, idx) => subAssignments[idx] === i);
            if (subClusterNodes.length > 0) {
              subClusterNodes.forEach(n => {
                n.cluster = `workspace-${workspace}`;
                n.subCluster = `dir-${directory}-sub-${i}`;
              });
              subClusters.push({
                id: `dir-${directory}-sub-${i}`,
                name: `${directory.split('/').pop() || 'root'} - Sub ${i + 1}`,
                nodes: subClusterNodes,
                color: subClusterColors[i % subClusterColors.length],
                parent: `workspace-${workspace}`,
                type: 'sub-cluster',
                directory: directory
              });
            }
          }
        } else {
          // Small directories: assign all nodes directly
          dirNodes.forEach(n => {
            n.cluster = `workspace-${workspace}`;
            n.subCluster = `dir-${directory}`;
          });
          subClusters.push({
            id: `dir-${directory}`,
            name: directory.split('/').pop() || 'root',
            nodes: dirNodes,
            color: subClusterColors[0],
            parent: `workspace-${workspace}`,
            type: 'directory',
            directory: directory
          });
        }
      }
    });
    
    if (workspaceNodes.length > 0) {
      workspaceNodes.forEach(n => n.cluster = `workspace-${workspace}`);
      const centroid = {
        x: d3.mean(workspaceNodes, d => d.x),
        y: d3.mean(workspaceNodes, d => d.y)
      };
      
      clusters.push({
        id: `workspace-${workspace}`,
        name: `Workspace: ${workspace.split('/').pop() || workspace}`,
        nodes: workspaceNodes,
        color: clusterColors[colorIndex % clusterColors.length],
        centroid: centroid,
        type: 'workspace',
        workspace: workspace,
        children: subClusters,
        expanded: true
      });
      colorIndex++;
    }
  });
  
  if (clusters.length > 0) {
    return clusters;
  }
  
  // Enhanced clustering: Use auto-optimized K-means if available
  const fallbackClusters = [];
  
  if (nodes.length === 0) return fallbackClusters;
  
  // Try to use enhanced clustering service
  if (window.clusteringService && nodes.length > 20) {
    try {
      
      // Get embeddings from nodes (use cached embeddings if available)
      const embeddings = nodes.map(node => {
        if (node.embedding) {
          return node.embedding; // Use cached embedding
        }
        if (node.featureVector) {
          return node.featureVector; // Use feature vector
        }
        return createFeatureVector(node); // Generate fallback
      });
      
      // Auto-optimize K
      const result = window.clusteringService.autoOptimizeKMeans(embeddings, {
        minK: Math.max(20, Math.floor(nodes.length / 40)),
        maxK: Math.min(60, Math.floor(nodes.length / 10)),
        step: 5
      });
      
      const assignments = result.clusters;
      const k = result.k;
      const quality = window.clusteringService.computeQualityMetrics(embeddings, assignments);
      
      
      // Create cluster objects with quality metrics
      for (let i = 0; i < k; i++) {
        const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
        if (clusterNodes.length > 0) {
          clusterNodes.forEach(n => n.cluster = `latent-${i}`);
          
          const cluster = {
            id: `latent-${i}`,
            name: `Cluster ${i + 1}`, // Will be updated by annotator
            nodes: clusterNodes,
            color: clusterColors[i % clusterColors.length],
            centroid: {
              x: d3.mean(clusterNodes, d => d.x),
              y: d3.mean(clusterNodes, d => d.y)
            },
            description: '',
            keywords: [],
            category: 'unknown',
            quality: {
              size: clusterNodes.length,
              cohesion: quality.cohesion,
              silhouette: result.silhouette
            }
          };
          
          fallbackClusters.push(cluster);
        }
      }
      
      // Store quality metrics globally
      window.navigatorState.clusterQuality = quality;
      window.navigatorState.optimalK = k;
      window.navigatorState.kScores = result.scores;
      
    } catch (error) {
      console.warn('[CLUSTER] Enhanced clustering failed, using fallback:', error.message);
    }
  }
  
  // Fallback: Use simple k-means on spatial positions
  if (fallbackClusters.length === 0) {
    let k;
    if (nodes.length < 6) {
      k = Math.max(1, Math.floor(nodes.length / 2));
    } else if (nodes.length < 20) {
      k = Math.min(5, Math.max(3, Math.ceil(nodes.length / 4)));
    } else {
      k = Math.min(8, Math.max(4, Math.ceil(nodes.length / 8)));
    }
    
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
    
    for (let iter = 0; iter < 10; iter++) {
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
    
    const finalAssignments = nodes.map(node => {
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
    
    for (let i = 0; i < k; i++) {
      const clusterNodes = nodes.filter((_, idx) => finalAssignments[idx] === i);
      if (clusterNodes.length > 0) {
        clusterNodes.forEach(n => n.cluster = `latent-${i}`);
        fallbackClusters.push({
          id: `latent-${i}`,
          name: `Cluster ${i + 1}`,
          nodes: clusterNodes,
          color: clusterColors[i % clusterColors.length],
          centroid: centroids[i],
          description: '',
          keywords: [],
          category: 'unknown'
        });
      }
    }
  }
  
  // Enhanced annotation using new labeling service
  if (window.enhancedClusterLabeling && fallbackClusters.length > 0) {
    // Annotate clusters asynchronously
    Promise.all(
      fallbackClusters.map(cluster => 
        window.enhancedClusterLabeling.generateLabels(cluster, {
          useLLM: window.CONFIG?.ENABLE_SEMANTIC_SEARCH === true,
          useTFIDF: true
        }).then(label => {
          cluster.name = label.name;
          cluster.description = label.description;
          cluster.keywords = label.keywords;
          cluster.category = label.category;
          cluster.technologies = label.technologies || [];
          cluster.labelStage = label.stage;
          return cluster;
        })
      )
    ).then(annotatedClusters => {
      // Update navigator state
      if (window.navigatorState) {
        window.navigatorState.clusters = annotatedClusters;
        window.dispatchEvent(new CustomEvent('clusters-annotated', { 
          detail: { clusters: annotatedClusters } 
        }));
      }
    }).catch(err => {
      console.warn('[CLUSTER-LABEL] Enhanced labeling failed:', err.message);
    });
  } else if (window.clusterAnnotator && fallbackClusters.length > 0) {
    // Fallback to original annotator
    window.clusterAnnotator.annotateClusters(fallbackClusters, {
      useLLM: window.CONFIG?.ENABLE_SEMANTIC_SEARCH === true,
      useEmbeddings: window.CONFIG?.ENABLE_SEMANTIC_SEARCH === true
    }).then(annotatedClusters => {
      annotatedClusters.forEach((annotated, idx) => {
        if (fallbackClusters[idx]) {
          fallbackClusters[idx].name = annotated.name;
          fallbackClusters[idx].description = annotated.description;
          fallbackClusters[idx].keywords = annotated.keywords;
          fallbackClusters[idx].category = annotated.category;
        }
      });
      
      if (window.navigatorState && window.navigatorState.clusters) {
        window.navigatorState.clusters = fallbackClusters;
        window.dispatchEvent(new CustomEvent('clusters-annotated', { 
          detail: { clusters: fallbackClusters } 
        }));
      }
    }).catch(err => {
      console.warn('[CLUSTER-ANNOTATOR] Annotation failed:', err.message);
    });
  }
  
  return fallbackClusters;
}

// Export to window
window.computePhysicalLayout = computePhysicalLayout;
window.computeLatentLayoutUMAP = computeLatentLayoutUMAP;
window.buildKNN = buildKNN;
window.createFeatureVector = createFeatureVector;
window.detectLatentClusters = detectLatentClusters;

} // End of _navigatorLayoutLoaded check

