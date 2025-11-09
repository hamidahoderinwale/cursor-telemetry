/**
 * Clustering Algorithms
 * K-means, community detection, and various clustering methods
 */

/**
 * Apply clustering algorithm to nodes and links
 * @param {Array} nodes - Graph nodes
 * @param {Array} links - Graph links
 * @param {string} algorithm - Clustering algorithm ('none', 'fileType', 'workspace', 'directory', 'similarity', 'community')
 * @returns {Array} Clusters with metadata
 */
export function applyClustering(nodes, links, algorithm) {
  if (algorithm === 'none') {
    return [];
  }
  
  const clusters = [];
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
  ];
  
  if (algorithm === 'fileType') {
    const fileTypes = {};
    nodes.forEach(node => {
      if (!fileTypes[node.ext]) {
        fileTypes[node.ext] = [];
      }
      fileTypes[node.ext].push(node);
      node.cluster = node.ext;
    });
    
    Object.keys(fileTypes).forEach((type, i) => {
      clusters.push({
        id: type,
        name: type.toUpperCase(),
        nodes: fileTypes[type],
        color: clusterColors[i % clusterColors.length]
      });
    });
  } else if (algorithm === 'workspace') {
    const workspaces = {};
    nodes.forEach(node => {
      const ws = node.workspace || 'unknown';
      if (!workspaces[ws]) {
        workspaces[ws] = [];
      }
      workspaces[ws].push(node);
      node.cluster = ws;
    });
    
    Object.keys(workspaces).forEach((ws, i) => {
      clusters.push({
        id: ws,
        name: ws.split('/').pop() || ws,
        nodes: workspaces[ws],
        color: clusterColors[i % clusterColors.length]
      });
    });
  } else if (algorithm === 'directory') {
    const directories = {};
    nodes.forEach(node => {
      const dir = node.directory || node.path.split('/').slice(0, -1).join('/') || 'root';
      if (!directories[dir]) {
        directories[dir] = [];
      }
      directories[dir].push(node);
      node.cluster = dir;
    });
    
    Object.keys(directories).forEach((dir, i) => {
      clusters.push({
        id: dir,
        name: dir.split('/').pop() || dir,
        nodes: directories[dir],
        color: clusterColors[i % clusterColors.length]
      });
    });
  } else if (algorithm === 'similarity') {
    // K-means style clustering based on link similarity
    const k = Math.min(5, Math.ceil(nodes.length / 10));
    const assignments = kMeansClustering(nodes, links, k);
    
    for (let i = 0; i < k; i++) {
      const clusterNodes = nodes.filter((_, idx) => assignments[idx] === i);
      if (clusterNodes.length > 0) {
        clusterNodes.forEach(n => n.cluster = `cluster-${i}`);
        clusters.push({
          id: `cluster-${i}`,
          name: `Cluster ${i + 1}`, // Will be updated by annotator
          nodes: clusterNodes,
          color: clusterColors[i % clusterColors.length],
          description: '',
          keywords: [],
          category: 'unknown'
        });
      }
    }
  } else if (algorithm === 'community') {
    // Simple community detection using modularity
    const communities = detectCommunities(nodes, links);
    communities.forEach((community, i) => {
      community.forEach(n => n.cluster = `community-${i}`);
      clusters.push({
        id: `community-${i}`,
        name: `Community ${i + 1}`, // Will be updated by annotator
        nodes: community,
        color: clusterColors[i % clusterColors.length],
        description: '',
        keywords: [],
        category: 'unknown'
      });
    });
  }
  
  // Annotate clusters asynchronously (non-blocking)
  if (clusters.length > 0 && typeof window !== 'undefined' && window.clusterAnnotator) {
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
      
      // Dispatch event to notify listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('clusters-annotated', { detail: { clusters } }));
      }
    }).catch(err => {
      console.warn('[CLUSTER-ANNOTATOR] Annotation failed:', err.message);
    });
  }
  
  return clusters;
}

/**
 * K-means clustering based on graph connectivity
 * @param {Array} nodes - Graph nodes
 * @param {Array} links - Graph links
 * @param {number} k - Number of clusters
 * @returns {Array} Cluster assignments for each node
 */
export function kMeansClustering(nodes, links, k) {
  // Simple k-means based on connectivity
  const n = nodes.length;
  const assignments = new Array(n).fill(0);
  
  // Initialize random centroids
  const centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push(Math.floor(Math.random() * n));
  }
  
  // Iterate a few times
  for (let iter = 0; iter < 10; iter++) {
    // Assign nodes to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      
      for (let c = 0; c < k; c++) {
        const centroidNode = nodes[centroids[c]];
        const link = links.find(l => 
          (l.source.id === nodes[i].id && l.target.id === centroidNode.id) ||
          (l.target.id === nodes[i].id && l.source.id === centroidNode.id)
        );
        
        const dist = link ? (1 - link.similarity) : 1;
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      
      assignments[i] = bestCluster;
    }
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterNodes = nodes.filter((_, i) => assignments[i] === c);
      if (clusterNodes.length > 0) {
        // Find most connected node in cluster
        let maxConnections = -1;
        let bestIdx = 0;
        clusterNodes.forEach(node => {
          const connections = links.filter(l => 
            l.source.id === node.id || l.target.id === node.id
          ).length;
          if (connections > maxConnections) {
            maxConnections = connections;
            bestIdx = nodes.indexOf(node);
          }
        });
        centroids[c] = bestIdx;
      }
    }
  }
  
  return assignments;
}

/**
 * Community detection using greedy modularity optimization
 * @param {Array} nodes - Graph nodes
 * @param {Array} links - Graph links
 * @returns {Array} Array of communities (each community is an array of nodes)
 */
export function detectCommunities(nodes, links) {
  // Simple greedy modularity-based community detection
  const communities = nodes.map(n => [n]);
  
  // Merge communities that increase modularity
  for (let iter = 0; iter < 5; iter++) {
    let bestMerge = null;
    let bestModularity = -Infinity;
    
    for (let i = 0; i < communities.length; i++) {
      for (let j = i + 1; j < communities.length; j++) {
        const modularity = calculateModularity(communities[i], communities[j], links);
        if (modularity > bestModularity) {
          bestModularity = modularity;
          bestMerge = [i, j];
        }
      }
    }
    
    if (bestMerge && bestModularity > 0) {
      const [i, j] = bestMerge;
      communities[i] = [...communities[i], ...communities[j]];
      communities.splice(j, 1);
    } else {
      break;
    }
  }
  
  return communities.filter(c => c.length > 0);
}

/**
 * Calculate modularity gain from merging two communities
 * @param {Array} community1 - First community
 * @param {Array} community2 - Second community
 * @param {Array} links - Graph links
 * @returns {number} Modularity gain
 */
export function calculateModularity(community1, community2, links) {
  // Calculate links within merged community vs expected
  const merged = [...community1, ...community2];
  const mergedIds = new Set(merged.map(n => n.id));
  
  const internalLinks = links.filter(l => 
    mergedIds.has(l.source.id) && mergedIds.has(l.target.id)
  ).length;
  
  const totalLinks = links.length;
  const expectedLinks = (merged.length * (merged.length - 1)) / (2 * totalLinks);
  
  return internalLinks - expectedLinks;
}

/**
 * Create a D3 force to pull nodes toward cluster centers
 * @param {Array} clusters - Clusters with nodes
 * @returns {Function} D3 force function
 */
export function forceCluster(clusters) {
  // Custom force to pull nodes toward cluster centers
  return (alpha) => {
    clusters.forEach(cluster => {
      if (cluster.nodes.length === 0) return;
      
      // Calculate cluster center
      const centerX = d3.mean(cluster.nodes, d => d.x);
      const centerY = d3.mean(cluster.nodes, d => d.y);
      
      // Pull nodes toward center
      cluster.nodes.forEach(node => {
        node.vx += (centerX - node.x) * alpha * 0.1;
        node.vy += (centerY - node.y) * alpha * 0.1;
      });
    });
  };
}

/**
 * Compute convex hull for cluster boundary visualization
 * @param {Array} points - Array of [x, y] coordinate pairs
 * @returns {string} SVG path string for convex hull
 */
export function convexHull(points) {
  // Simple convex hull for cluster boundaries
  if (points.length < 3) return '';
  
  // Sort points by x coordinate
  points.sort((a, b) => a[0] - b[0]);
  
  // Build upper hull
  const upper = [];
  for (let i = 0; i < points.length; i++) {
    while (upper.length >= 2) {
      const m = upper.length;
      const cross = (upper[m-1][0] - upper[m-2][0]) * (points[i][1] - upper[m-2][1]) -
                    (upper[m-1][1] - upper[m-2][1]) * (points[i][0] - upper[m-2][0]);
      if (cross <= 0) break;
      upper.pop();
    }
    upper.push(points[i]);
  }
  
  // Build lower hull
  const lower = [];
  for (let i = points.length - 1; i >= 0; i--) {
    while (lower.length >= 2) {
      const m = lower.length;
      const cross = (lower[m-1][0] - lower[m-2][0]) * (points[i][1] - lower[m-2][1]) -
                    (lower[m-1][1] - lower[m-2][1]) * (points[i][0] - lower[m-2][0]);
      if (cross <= 0) break;
      lower.pop();
    }
    lower.push(points[i]);
  }
  
  // Remove last point of each half because it's repeated
  upper.pop();
  lower.pop();
  
  const hull = upper.concat(lower);
  
  // Add padding
  const padding = 40;
  const centroid = [
    d3.mean(hull, d => d[0]),
    d3.mean(hull, d => d[1])
  ];
  
  const paddedHull = hull.map(p => {
    const dx = p[0] - centroid[0];
    const dy = p[1] - centroid[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const scale = (dist + padding) / dist;
    return [
      centroid[0] + dx * scale,
      centroid[1] + dy * scale
    ];
  });
  
  return 'M' + paddedHull.map(p => p.join(',')).join('L') + 'Z';
}

/**
 * Detect latent clusters using semantic similarity
 * @param {Array} nodes - Graph nodes with semantic features
 * @param {Array} links - Graph links
 * @returns {Array} Detected clusters
 */
export function detectLatentClusters(nodes, links) {
  // Use hierarchical clustering based on semantic similarity
  // This is a simplified version suitable for small to medium graphs
  
  if (nodes.length === 0) return [];
  
  // Start with each node in its own cluster
  let clusters = nodes.map((n, i) => ({
    id: i,
    nodes: [n],
    center: n
  }));
  
  const clusterColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', 
    '#10b981', '#3b82f6', '#ef4444', '#14b8a6'
  ];
  
  // Merge clusters that are highly connected
  while (clusters.length > 3 && clusters.length > nodes.length / 10) {
    let bestMerge = null;
    let bestSimilarity = 0;
    
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Calculate similarity between cluster i and j
        let totalSim = 0;
        let count = 0;
        
        clusters[i].nodes.forEach(ni => {
          clusters[j].nodes.forEach(nj => {
            const link = links.find(l =>
              (l.source.id === ni.id && l.target.id === nj.id) ||
              (l.target.id === ni.id && l.source.id === nj.id)
            );
            if (link) {
              totalSim += link.similarity || 0;
              count++;
            }
          });
        });
        
        const avgSim = count > 0 ? totalSim / count : 0;
        if (avgSim > bestSimilarity) {
          bestSimilarity = avgSim;
          bestMerge = [i, j];
        }
      }
    }
    
    if (bestMerge && bestSimilarity > 0.3) {
      const [i, j] = bestMerge;
      clusters[i].nodes = [...clusters[i].nodes, ...clusters[j].nodes];
      clusters.splice(j, 1);
    } else {
      break;
    }
  }
  
  // Assign cluster metadata
  return clusters.map((cluster, i) => {
    cluster.nodes.forEach(n => n.cluster = `latent-${i}`);
    return {
      id: `latent-${i}`,
      name: `Cluster ${i + 1}`,
      nodes: cluster.nodes,
      color: clusterColors[i % clusterColors.length],
      size: cluster.nodes.length
    };
  }).filter(c => c.nodes.length > 0);
}

// Export to window for backward compatibility
if (typeof window !== 'undefined') {
  window.applyClustering = applyClustering;
  window.kMeansClustering = kMeansClustering;
  window.detectCommunities = detectCommunities;
  window.calculateModularity = calculateModularity;
  window.forceCluster = forceCluster;
  window.convexHull = convexHull;
  window.detectLatentClusters = detectLatentClusters;
}


