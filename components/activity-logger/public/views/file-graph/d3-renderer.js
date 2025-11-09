/**
 * D3 File Graph Renderer
 * D3.js rendering functions for file graph visualization
 * Part of views/file-graph/ - keeps all file graph code together
 */

// Dependencies: d3, window.getFileTypeColor, window.showFileInfo, window.escapeHtml

/**
 * Render D3 file graph visualization
 */
function renderD3FileGraph(container, nodes, links) {
  // Clear container
  container.innerHTML = '';
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;
  
  // Get clustering algorithm
  const clusterAlgorithm = document.getElementById('clusteringAlgorithm')?.value || 'none';
  
  // Apply clustering
  let clusters = applyClustering(nodes, links, clusterAlgorithm);
  
  // Annotate clusters with AI-generated labels if cluster annotator is available
  if (clusters.length > 0 && window.clusterAnnotator && (clusterAlgorithm === 'similarity' || clusterAlgorithm === 'community')) {
    try {
      // Annotate clusters asynchronously
      window.clusterAnnotator.annotateClusters(clusters, { useLLM: true, useEmbeddings: true })
        .then(annotatedClusters => {
          // Update cluster names in the visualization
          if (window.graphG) {
            const clusterLabels = window.graphG.selectAll('.cluster-labels text');
            clusterLabels.data(annotatedClusters)
              .text(d => `${d.name || d.originalName || `Cluster ${d.id}`} (${d.nodes.length})`);
          }
          // Update clusters array
          clusters = annotatedClusters;
        })
        .catch(err => {
          console.warn('[FILE-GRAPH] Failed to annotate clusters:', err.message);
        });
    } catch (error) {
      console.warn('[FILE-GRAPH] Cluster annotation not available:', error.message);
    }
  }
  
  // Create SVG with zoom support
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'var(--color-bg)');
  
  // Add zoom behavior
  const g = svg.append('g');
  
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Store zoom behavior for external access
  window.graphZoom = zoom;
  window.graphSvg = svg;
  window.graphG = g;
  
  // Create cluster hulls if clustering is enabled
  if (clusters.length > 0) {
    const hull = g.append('g')
      .attr('class', 'cluster-hulls')
      .selectAll('path')
      .data(clusters)
      .join('path')
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5');
    
    // Add cluster labels
    const clusterLabels = g.append('g')
      .attr('class', 'cluster-labels')
      .selectAll('text')
      .data(clusters)
      .join('text')
      .text(d => `${d.name} (${d.nodes.length})`)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', d => d.color)
      .attr('text-anchor', 'middle')
      .style('pointer-events', 'none');
  }
  
  // Get layout algorithm
  const layoutAlgorithm = document.getElementById('layoutAlgorithm')?.value || 'force';
  
  // Create simulation based on layout
  let simulation;
  if (layoutAlgorithm === 'force') {
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
        // Shorter links for same cluster
        if (d.source.cluster === d.target.cluster) return 50;
        return 150;
      }))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(35))
      .force('cluster', forceCluster(clusters));
  } else if (layoutAlgorithm === 'circular') {
    // Circular layout
    const radius = Math.min(width, height) / 2 - 100;
    nodes.forEach((d, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      d.x = width / 2 + radius * Math.cos(angle);
      d.y = height / 2 + radius * Math.sin(angle);
    });
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('collision', d3.forceCollide().radius(35));
  } else if (layoutAlgorithm === 'radial') {
    // Radial layout - cluster-based
    const angleStep = (2 * Math.PI) / Math.max(clusters.length, 1);
    clusters.forEach((cluster, i) => {
      const angle = i * angleStep;
      const clusterRadius = Math.min(width, height) / 3;
      const centerX = width / 2 + clusterRadius * Math.cos(angle);
      const centerY = height / 2 + clusterRadius * Math.sin(angle);
      
      cluster.nodes.forEach((node, j) => {
        const nodeAngle = (j / cluster.nodes.length) * 2 * Math.PI;
        const nodeRadius = 50;
        node.x = centerX + nodeRadius * Math.cos(nodeAngle);
        node.y = centerY + nodeRadius * Math.sin(nodeAngle);
      });
    });
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(80))
      .force('collision', d3.forceCollide().radius(35));
  }
  
  // Create links
  const link = g.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => {
      // Highlight intra-cluster links
      if (d.source.cluster === d.target.cluster) {
        const cluster = clusters.find(c => c.id === d.source.cluster);
        return cluster ? cluster.color : '#64748b';
      }
      return '#64748b';
    })
    .attr('stroke-opacity', d => d.similarity * 0.6)
    .attr('stroke-width', d => Math.max(1, d.similarity * 3));
  
  // Create nodes
  const node = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => {
      event.stopPropagation();
      highlightConnections(d, node, link);
      if (window.showFileInfo) window.showFileInfo(d);
    })
    .on('mouseenter', (event, d) => {
      highlightConnections(d, node, link);
    })
    .on('mouseleave', () => {
      clearHighlights(node, link);
    })
    .style('cursor', 'pointer');
  
  // Add circles to nodes
  node.append('circle')
    .attr('r', d => {
      const baseSize = Math.max(8, Math.min(20, Math.sqrt(d.changes) * 3));
      return baseSize;
    })
    .attr('fill', d => {
      // Use cluster color if clustered
      if (d.cluster && clusters.length > 0) {
        const cluster = clusters.find(c => c.id === d.cluster);
        return cluster ? cluster.color : (window.getFileTypeColor ? window.getFileTypeColor(d.ext) : '#64748b');
      }
      return window.getFileTypeColor ? window.getFileTypeColor(d.ext) : '#64748b';
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('class', 'node-circle');
  
  // Add labels to nodes
  const labels = node.append('text')
    .text(d => d.name)
    .attr('x', 0)
    .attr('y', -25)
    .attr('text-anchor', 'middle')
    .attr('font-size', '11px')
    .attr('fill', 'var(--color-text)')
    .attr('class', 'node-label')
    .style('pointer-events', 'none')
    .style('opacity', 1) // Ensure labels are always visible
    .style('fill', 'var(--color-text)'); // Explicitly set fill to ensure visibility
  
  // Add change count badge
  node.append('text')
    .text(d => d.changes)
    .attr('x', 0)
    .attr('y', 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', 'bold')
    .attr('fill', '#fff')
    .attr('class', 'node-badge')
    .style('pointer-events', 'none');
  
  // Store for toggle function
  window.graphLabels = labels;
  window.labelsVisible = true;
  
  // Update positions on tick
  simulation.on('tick', () => {
    // Update cluster hulls
    if (clusters.length > 0) {
      g.selectAll('.cluster-hulls path')
        .attr('d', d => {
          const points = d.nodes.map(n => [n.x || 0, n.y || 0]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));
          return convexHull(points);
        });
      
      g.selectAll('.cluster-labels text')
        .attr('x', d => {
          const xs = d.nodes.map(n => n.x).filter(x => !isNaN(x));
          return xs.length > 0 ? d3.mean(xs) : width / 2;
        })
        .attr('y', d => {
          const ys = d.nodes.map(n => n.y).filter(y => !isNaN(y));
          return ys.length > 0 ? d3.min(ys) - 30 : height / 2;
        });
    }
    
    link
      .attr('x1', d => d.source.x || 0)
      .attr('y1', d => d.source.y || 0)
      .attr('x2', d => d.target.x || 0)
      .attr('y2', d => d.target.y || 0);
    
    node.attr('transform', d => {
      const x = d.x || 0;
      const y = d.y || 0;
      // Only update if values are valid numbers
      if (isNaN(x) || isNaN(y)) return 'translate(0,0)';
      return `translate(${x},${y})`;
    });
  });
  
  // Store nodes and links for external access
  window.graphNodes = node;
  window.graphLinks = link;
  window.graphSimulation = simulation;
  
  // Drag functions
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    // Keep node pinned on release
    // d.fx = null;
    // d.fy = null;
  }
  
  // Highlight connected nodes
  function highlightConnections(d, nodes, links) {
    const connectedIds = new Set();
    links.each(function(l) {
      if (l.source.id === d.id) connectedIds.add(l.target.id);
      if (l.target.id === d.id) connectedIds.add(l.source.id);
    });
    
    nodes.selectAll('.node-circle')
      .attr('opacity', n => n.id === d.id || connectedIds.has(n.id) ? 1 : 0.2);
    
    // Ensure labels remain visible during hover
    nodes.selectAll('.node-label')
      .style('opacity', 1)
      .style('fill', 'var(--color-text)');
    
    // Ensure badges remain visible
    nodes.selectAll('.node-badge')
      .style('opacity', 1)
      .style('fill', '#fff');
    
    links
      .attr('opacity', l => l.source.id === d.id || l.target.id === d.id ? 1 : 0.1)
      .attr('stroke-width', l => {
        if (l.source.id === d.id || l.target.id === d.id) {
          return Math.max(2, l.similarity * 5);
        }
        return Math.max(1, l.similarity * 3);
      });
  }
  
  function clearHighlights(nodes, links) {
    nodes.selectAll('.node-circle').attr('opacity', 1);
    links
      .attr('opacity', 1)
      .attr('stroke-width', d => Math.max(1, d.similarity * 3));
  }
}

/**
 * Apply clustering algorithm to nodes
 */
function applyClustering(nodes, links, algorithm) {
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
          name: `Cluster ${i + 1}`,
          nodes: clusterNodes,
          color: clusterColors[i % clusterColors.length]
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
        name: `Community ${i + 1}`,
        nodes: community,
        color: clusterColors[i % clusterColors.length]
      });
    });
  }
  
  return clusters;
}

function kMeansClustering(nodes, links, k) {
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

function detectCommunities(nodes, links) {
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

function calculateModularity(community1, community2, links) {
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

function forceCluster(clusters) {
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

function convexHull(points) {
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

// Navigation functions
function zoomToFit() {
  if (!window.graphSvg || !window.graphG || !window.graphNodes) return;
  
  const svg = window.graphSvg;
  const zoom = window.graphZoom;
  
  // Get bounds of all nodes
  const nodes = window.graphNodes.data();
  if (nodes.length === 0) return;
  
  const xs = nodes.map(d => d.x);
  const ys = nodes.map(d => d.y);
  
  const minX = Math.min(...xs) - 50;
  const maxX = Math.max(...xs) + 50;
  const minY = Math.min(...ys) - 50;
  const maxY = Math.max(...ys) + 50;
  
  const width = parseFloat(svg.attr('width'));
  const height = parseFloat(svg.attr('height'));
  
  const scale = 0.9 * Math.min(width / (maxX - minX), height / (maxY - minY));
  const translateX = width / 2 - scale * (minX + maxX) / 2;
  const translateY = height / 2 - scale * (minY + maxY) / 2;
  
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

function toggleLabels() {
  if (!window.graphLabels) return;
  
  window.labelsVisible = !window.labelsVisible;
  const button = document.getElementById('labelToggle');
  
  if (window.labelsVisible) {
    window.graphLabels.attr('opacity', 1);
    if (button) button.textContent = 'Hide Labels';
  } else {
    window.graphLabels.attr('opacity', 0);
    if (button) button.textContent = 'Show Labels';
  }
}

function filterGraphNodes(searchTerm) {
  const resultsDiv = document.getElementById('fileSearchResults');
  if (!resultsDiv || !window.fileGraphData) return;
  
  if (!searchTerm || searchTerm.trim() === '') {
    resultsDiv.innerHTML = '';
    // Reset all node highlighting
    if (window.graphNodes) {
      window.graphNodes.selectAll('.node-circle').attr('opacity', 1);
    }
    return;
  }
  
  const term = searchTerm.toLowerCase();
  const matches = window.fileGraphData.nodes.filter(n => 
    n.name.toLowerCase().includes(term) || 
    n.path.toLowerCase().includes(term)
  );
  
  if (matches.length === 0) {
    resultsDiv.innerHTML = '<div style="color: var(--color-text-muted); font-size: 12px; padding: var(--space-sm);">No matches found</div>';
    return;
  }
  
  // Highlight matching nodes
  if (window.graphNodes) {
    const matchIds = new Set(matches.map(m => m.id));
    window.graphNodes.selectAll('.node-circle')
      .attr('opacity', n => matchIds.has(n.id) ? 1 : 0.2);
  }
  
  // Show results
  const escapeHtml = window.escapeHtml || ((s) => s);
  resultsDiv.innerHTML = matches.slice(0, 10).map(match => `
    <div onclick="focusOnNode('${match.id}')" 
         style="padding: var(--space-xs); background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: var(--space-xs); cursor: pointer; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-family: var(--font-mono); color: var(--color-text);">${escapeHtml(match.name)}</span>
      <span style="color: var(--color-text-muted); font-size: 11px;">${match.changes} changes</span>
    </div>
  `).join('') + (matches.length > 10 ? `<div style="color: var(--color-text-muted); font-size: 11px; padding: var(--space-xs);">+${matches.length - 10} more</div>` : '');
}

function focusOnNode(nodeId) {
  if (!window.graphSvg || !window.graphG || !window.graphNodes) return;
  
  const node = window.graphNodes.data().find(n => n.id === nodeId);
  if (!node) return;
  
  const svg = window.graphSvg;
  const zoom = window.graphZoom;
  const width = parseFloat(svg.attr('width'));
  const height = parseFloat(svg.attr('height'));
  
  // Zoom to node
  const scale = 1.5;
  const translateX = width / 2 - scale * node.x;
  const translateY = height / 2 - scale * node.y;
  
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
  
  // Show node info
  if (window.showFileInfo) window.showFileInfo(node);
}

// Most Similar File Pairs functionality
function renderSimilarFilePairs(links, files) {
  const container = document.getElementById('similarFilePairs');
  if (!container) return;
  
  // Get top count from dropdown
  const count = parseInt(document.getElementById('similarPairsCount')?.value || '10');
  
  // Sort links by similarity and get top pairs
  const sortedLinks = [...links].sort((a, b) => b.similarity - a.similarity).slice(0, count);
  
  if (sortedLinks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-text" style="font-size: var(--text-md); margin-bottom: var(--space-sm);">No Similar Pairs Found</div>
        <div class="empty-state-hint">Modify some files together to see relationships</div>
      </div>
    `;
    return;
  }
  
  // Store for highlighting
  window.topSimilarPairs = sortedLinks;
  
  // Render each pair
  const escapeHtml = window.escapeHtml || ((s) => s);
  const getFileTypeColor = window.getFileTypeColor || (() => '#64748b');
  
  container.innerHTML = sortedLinks.map((link, index) => {
    const source = typeof link.source === 'object' ? link.source : files.find(f => f.id === link.source);
    const target = typeof link.target === 'object' ? link.target : files.find(f => f.id === link.target);
    
    if (!source || !target) return '';
    
    const sourceName = source.name || source.id.split('/').pop();
    const targetName = target.name || target.id.split('/').pop();
    const similarityPercent = (link.similarity * 100).toFixed(1);
    
    // Calculate co-modification count and shared prompts
    const sourceSessions = new Set((source.events || []).map(e => e.session_id).filter(Boolean));
    const targetSessions = new Set((target.events || []).map(e => e.session_id).filter(Boolean));
    const sharedSessions = [...sourceSessions].filter(s => targetSessions.has(s)).length;
    
    // Show shared prompts count from link data (if available)
    const sharedPrompts = link.sharedPrompts || 0;
    
    // Get file type colors
    const sourceColor = getFileTypeColor(source.ext);
    const targetColor = getFileTypeColor(target.ext);
    
    return `
      <div class="similar-pair-item" data-source="${source.id}" data-target="${target.id}" 
           onmouseenter="highlightPairInGraph('${source.id}', '${target.id}')"
           onmouseleave="clearGraphHighlights()"
           onclick="focusOnPair('${source.id}', '${target.id}')"
           title="Click to focus on this pair in the graph">
        
        <!-- Rank Badge -->
        <div class="similar-pair-rank">${index + 1}</div>
        
        <!-- File Pair Info -->
        <div class="similar-pair-info">
          <div class="similar-pair-files-row">
            <div class="similar-pair-file">
              <span class="similar-pair-file-dot" style="background: ${sourceColor};"></span>
              <span class="similar-pair-file-name" title="${escapeHtml(source.path)}">${escapeHtml(sourceName)}</span>
            </div>
            <span class="similar-pair-file-arrow">↔</span>
            <div class="similar-pair-file">
              <span class="similar-pair-file-dot" style="background: ${targetColor};"></span>
              <span class="similar-pair-file-name" title="${escapeHtml(target.path)}">${escapeHtml(targetName)}</span>
            </div>
          </div>
          
          <div class="similar-pair-meta">
            ${sharedPrompts > 0 ? `<span title="Number of AI prompts that referenced both files">${sharedPrompts} shared prompts</span>` : ''}
            ${sharedPrompts > 0 && sharedSessions > 0 ? '<span>•</span>' : ''}
            ${sharedSessions > 0 ? `<span title="Number of coding sessions where both files were modified">${sharedSessions} shared sessions</span>` : ''}
            ${(sharedPrompts > 0 || sharedSessions > 0) ? '<span>•</span>' : ''}
            <span>${(source.changes || 0) + (target.changes || 0)} total changes</span>
          </div>
        </div>
        
        <!-- Similarity Score -->
        <div class="similar-pair-score">
          <div class="similar-pair-score-value" title="Jaccard similarity coefficient based on prompt and session co-occurrence">
            ${similarityPercent}%
          </div>
          <div class="similar-pair-score-label">similarity</div>
        </div>
      </div>
    `;
  }).join('');
}

function updateSimilarPairs() {
  if (!window.fileGraphData) return;
  renderSimilarFilePairs(window.fileGraphData.links, window.fileGraphData.nodes);
}

function highlightPairInGraph(sourceId, targetId) {
  if (!window.graphNodes || !window.graphLinks) return;
  
  // Highlight the two nodes
  window.graphNodes.selectAll('.node-circle')
    .attr('opacity', n => n.id === sourceId || n.id === targetId ? 1 : 0.2)
    .attr('stroke-width', n => n.id === sourceId || n.id === targetId ? 4 : 2);
  
  // Highlight the link between them
  window.graphLinks
    .attr('opacity', l => {
      const isTargetLink = (l.source.id === sourceId && l.target.id === targetId) ||
                           (l.source.id === targetId && l.target.id === sourceId);
      return isTargetLink ? 1 : 0.1;
    })
    .attr('stroke-width', l => {
      const isTargetLink = (l.source.id === sourceId && l.target.id === targetId) ||
                           (l.source.id === targetId && l.target.id === sourceId);
      return isTargetLink ? 6 : Math.max(1, l.similarity * 3);
    })
    .attr('stroke', l => {
      const isTargetLink = (l.source.id === sourceId && l.target.id === targetId) ||
                           (l.source.id === targetId && l.target.id === sourceId);
      return isTargetLink ? '#10b981' : '#64748b';
    });
}

function clearGraphHighlights() {
  if (!window.graphNodes || !window.graphLinks) return;
  
  window.graphNodes.selectAll('.node-circle')
    .attr('opacity', 1)
    .attr('stroke-width', 2);
  
  window.graphLinks
    .attr('opacity', 1)
    .attr('stroke-width', d => Math.max(1, d.similarity * 3))
    .attr('stroke', d => {
      if (d.source.cluster === d.target.cluster) {
        const clusters = window.fileGraphData?.clusters || [];
        const cluster = clusters.find(c => c.id === d.source.cluster);
        return cluster ? cluster.color : '#64748b';
      }
      return '#64748b';
    });
}

function focusOnPair(sourceId, targetId) {
  if (!window.graphSvg || !window.graphNodes) return;
  
  const source = window.graphNodes.data().find(n => n.id === sourceId);
  const target = window.graphNodes.data().find(n => n.id === targetId);
  
  if (!source || !target) return;
  
  const svg = window.graphSvg;
  const zoom = window.graphZoom;
  const width = parseFloat(svg.attr('width'));
  const height = parseFloat(svg.attr('height'));
  
  // Calculate center point between the two nodes
  const centerX = (source.x + target.x) / 2;
  const centerY = (source.y + target.y) / 2;
  
  // Calculate distance between nodes
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Scale to fit both nodes with some padding
  const scale = Math.min(2, (Math.min(width, height) * 0.6) / distance);
  const translateX = width / 2 - scale * centerX;
  const translateY = height / 2 - scale * centerY;
  
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
  
  // Keep highlight active
  highlightPairInGraph(sourceId, targetId);
}

function highlightSimilarPairs() {
  if (!window.topSimilarPairs || window.topSimilarPairs.length === 0) {
    alert('No similar pairs to highlight. Generate the graph first.');
    return;
  }
  
  // Collect all IDs from top pairs
  const pairIds = new Set();
  window.topSimilarPairs.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    pairIds.add(sourceId);
    pairIds.add(targetId);
  });
  
  // Highlight nodes in pairs
  if (window.graphNodes) {
    window.graphNodes.selectAll('.node-circle')
      .transition()
      .duration(300)
      .attr('opacity', n => pairIds.has(n.id) ? 1 : 0.15)
      .attr('stroke-width', n => pairIds.has(n.id) ? 4 : 2)
      .attr('stroke', n => pairIds.has(n.id) ? '#10b981' : '#fff');
  }
  
  // Highlight links in top pairs
  if (window.graphLinks) {
    window.graphLinks
      .transition()
      .duration(300)
      .attr('opacity', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const isTopPair = window.topSimilarPairs.some(pair => {
          const pairSourceId = typeof pair.source === 'object' ? pair.source.id : pair.source;
          const pairTargetId = typeof pair.target === 'object' ? pair.target.id : pair.target;
          return (sourceId === pairSourceId && targetId === pairTargetId) ||
                 (sourceId === pairTargetId && targetId === pairSourceId);
        });
        return isTopPair ? 1 : 0.1;
      })
      .attr('stroke-width', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const isTopPair = window.topSimilarPairs.some(pair => {
          const pairSourceId = typeof pair.source === 'object' ? pair.source.id : pair.source;
          const pairTargetId = typeof pair.target === 'object' ? pair.target.id : pair.target;
          return (sourceId === pairSourceId && targetId === pairTargetId) ||
                 (sourceId === pairTargetId && targetId === pairSourceId);
        });
        return isTopPair ? 6 : Math.max(1, l.similarity * 3);
      })
      .attr('stroke', l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        const isTopPair = window.topSimilarPairs.some(pair => {
          const pairSourceId = typeof pair.source === 'object' ? pair.source.id : pair.source;
          const pairTargetId = typeof pair.target === 'object' ? pair.target.id : pair.target;
          return (sourceId === pairSourceId && targetId === pairTargetId) ||
                 (sourceId === pairTargetId && targetId === pairSourceId);
        });
        return isTopPair ? '#10b981' : '#64748b';
      });
  }
  
  // Zoom to fit highlighted nodes
  setTimeout(() => {
    if (window.graphSvg && window.graphNodes) {
      const highlightedNodes = window.graphNodes.data().filter(n => pairIds.has(n.id));
      if (highlightedNodes.length > 0) {
        const xs = highlightedNodes.map(d => d.x);
        const ys = highlightedNodes.map(d => d.y);
        
        const minX = Math.min(...xs) - 100;
        const maxX = Math.max(...xs) + 100;
        const minY = Math.min(...ys) - 100;
        const maxY = Math.max(...ys) + 100;
        
        const svg = window.graphSvg;
        const zoom = window.graphZoom;
        const width = parseFloat(svg.attr('width'));
        const height = parseFloat(svg.attr('height'));
        
        const scale = 0.8 * Math.min(width / (maxX - minX), height / (maxY - minY));
        const translateX = width / 2 - scale * (minX + maxX) / 2;
        const translateY = height / 2 - scale * (minY + maxY) / 2;
        
        svg.transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
      }
    }
  }, 350);
}

// Export to window for global access
window.renderD3FileGraph = renderD3FileGraph;
window.applyClustering = applyClustering;
window.zoomToFit = zoomToFit;
window.toggleLabels = toggleLabels;
window.filterGraphNodes = filterGraphNodes;
window.focusOnNode = focusOnNode;
window.renderSimilarFilePairs = renderSimilarFilePairs;
window.updateSimilarPairs = updateSimilarPairs;
window.highlightPairInGraph = highlightPairInGraph;
window.clearGraphHighlights = clearGraphHighlights;
window.focusOnPair = focusOnPair;
window.highlightSimilarPairs = highlightSimilarPairs;
