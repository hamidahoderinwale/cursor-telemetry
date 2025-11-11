/**
 * Navigator Renderer Module
 * D3 rendering, visualization, and control functions
 */

/**
 * Render the main navigator visualization
 */
function renderNavigator(container, nodes, links) {
  if (!window.navigatorState) {
    console.error('[NAVIGATOR] navigatorState not available');
    return;
  }
  
  const navigatorState = window.navigatorState;
  container.innerHTML = '';
  
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 700;
  
  // Create SVG
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .style('background', 'var(--color-bg)');
  
  const g = svg.append('g');
  
  // Add zoom
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      window.updateMiniMapViewport();
    });
  
  svg.call(zoom);
  
  navigatorState.svg = svg;
  navigatorState.zoom = zoom;
  navigatorState.g = g;
  
  // Create links with workspace/directory awareness
  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => {
      // Color links based on workspace/directory relationships
      if (d.sameWorkspace && d.sameDirectory) {
        return '#10b981'; // Green for same workspace + directory
      } else if (d.sameWorkspace) {
        return '#3b82f6'; // Blue for same workspace
      } else if (d.sameDirectory) {
        return '#8b5cf6'; // Purple for same directory
      }
      return '#64748b'; // Gray for other links
    })
    .attr('stroke-opacity', d => {
      // Higher opacity for workspace/directory relationships
      if (d.sameWorkspace && d.sameDirectory) return 0.6;
      if (d.sameWorkspace || d.sameDirectory) return 0.4;
      return 0.3;
    })
    .attr('stroke-width', d => {
      // Thicker lines for workspace/directory relationships
      const baseWidth = Math.max(1, d.similarity * 2);
      if (d.sameWorkspace && d.sameDirectory) return baseWidth * 1.5;
      if (d.sameWorkspace || d.sameDirectory) return baseWidth * 1.2;
      return baseWidth;
    });
  
  // Create nodes
  const node = g.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'nav-node')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', (event, d) => {
      if (window.showFileInfo) {
        window.showFileInfo(d);
      }
    })
    .on('mouseenter', (event, d) => {
      // Show file details on hover
      showNavigatorFileTooltip(event, d);
    })
    .on('mouseleave', () => {
      hideNavigatorFileTooltip();
    })
    .style('cursor', 'pointer')
    .attr('title', d => {
      // Rich tooltip with file info
      const parts = [d.path || d.name];
      if (d.changes) parts.push(`${d.changes} changes`);
      if (d.size) parts.push(`${(d.size / 1024).toFixed(1)} KB`);
      if (d.cluster) {
        const cluster = navigatorState.clusters.find(c => c.id === d.cluster);
        if (cluster) parts.push(`Cluster: ${cluster.name}`);
      }
      return parts.join(' • ');
    });
  
  const getFileTypeColor = window.getFileTypeColor || (() => '#64748b');
  
  node.append('circle')
    .attr('r', d => Math.max(6, Math.min(15, Math.sqrt(d.changes) * 2)))
    .attr('fill', d => {
      if (d.cluster && navigatorState.clusters.length > 0) {
        const cluster = navigatorState.clusters.find(c => c.id === d.cluster);
        return cluster ? cluster.color : getFileTypeColor(d.ext);
      }
      return getFileTypeColor(d.ext);
    })
    .attr('stroke', d => {
      // Add workspace/directory indicator border
      if (d.workspace) return '#3b82f6'; // Blue border for workspace files
      return '#fff';
    })
    .attr('stroke-width', d => {
      // Thicker border for workspace files
      return d.workspace ? 2.5 : 2;
    })
    .attr('class', 'nav-node-circle')
    .attr('data-workspace', d => d.workspace || '')
    .attr('data-directory', d => d.topLevelDir || '');
  
  const labels = node.append('text')
    .text(d => d.name)
    .attr('x', 0)
    .attr('y', -20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', 'var(--color-text)')
    .attr('class', 'nav-node-label')
    .style('pointer-events', 'none')
    .style('opacity', 1) // Ensure labels are always visible
    .style('fill', 'var(--color-text)'); // Explicitly set fill to ensure visibility
  
  navigatorState.labels = labels;
  navigatorState.nodeElements = node;
  navigatorState.linkElements = link;
  
  // Update positions
  window.updateNodePositions();
  
  function dragstarted(event, d) {
    d.fx = d.x;
    d.fy = d.y;
  }
  
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    window.updateNodePositions();
  }
  
  function dragended(event, d) {
    d.fx = null;
    d.fy = null;
  }
}

/**
 * Update node positions based on interpolation
 */
function updateNodePositions() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  if (!navigatorState.nodeElements || !navigatorState.linkElements) return;
  
  const t = navigatorState.interpolation;
  
  // Interpolate positions
  navigatorState.nodes.forEach(node => {
    const phys = navigatorState.physicalPositions.get(node.id);
    const lat = navigatorState.latentPositions.get(node.id);
    
    if (phys && lat) {
      node.x = phys.x * (1 - t) + lat.x * t;
      node.y = phys.y * (1 - t) + lat.y * t;
    }
  });
  
  // Update D3 elements
  navigatorState.nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
  
  navigatorState.linkElements
    .attr('x1', d => {
      const source = navigatorState.nodes.find(n => n.id === d.source || n.id === d.source.id);
      return source ? source.x : 0;
    })
    .attr('y1', d => {
      const source = navigatorState.nodes.find(n => n.id === d.source || n.id === d.source.id);
      return source ? source.y : 0;
    })
    .attr('x2', d => {
      const target = navigatorState.nodes.find(n => n.id === d.target || n.id === d.target.id);
      return target ? target.x : 0;
    })
    .attr('y2', d => {
      const target = navigatorState.nodes.find(n => n.id === d.target || n.id === d.target.id);
      return target ? target.y : 0;
    });
  
  // Update mini-map
  window.updateMiniMapViewport();
}

/**
 * Set navigator view mode (physical, hybrid, latent)
 */
function setNavigatorViewMode(mode) {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  navigatorState.viewMode = mode;
  
  // Update button states
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.view-mode-btn[data-mode="${mode}"]`)?.classList.add('active');
  
  // Set interpolation
  const targetInterpolation = {
    'physical': 0.0,
    'hybrid': 0.5,
    'latent': 1.0
  }[mode];
  
  // Animate transition
  window.animateInterpolation(navigatorState.interpolation, targetInterpolation);
}

/**
 * Animate interpolation between physical and latent positions
 */
function animateInterpolation(from, to) {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  const duration = 1000 / navigatorState.transitionSpeed;
  const startTime = Date.now();
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad
    
    navigatorState.interpolation = from + (to - from) * eased;
    
    // Update visualization
    window.updateNodePositions();
    window.updateInterpolationDisplay();
    
    if (t < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  animate();
}

/**
 * Update interpolation display percentage
 */
function updateInterpolationDisplay() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  const percent = Math.round(navigatorState.interpolation * 100);
  const el = document.getElementById('interpolationValue');
  if (el) {
    el.textContent = `${percent}%`;
  }
}

/**
 * Update transition speed
 */
function updateTransitionSpeed(value) {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  navigatorState.transitionSpeed = parseFloat(value);
  const el = document.getElementById('speedLabel');
  if (el) {
    el.textContent = `${value}x`;
  }
}

/**
 * Initialize transition speed on page load
 */
function initializeTransitionSpeed() {
  const speedSlider = document.getElementById('transitionSpeed');
  const speedLabel = document.getElementById('speedLabel');
  if (speedSlider && speedLabel && window.navigatorState) {
    speedSlider.value = window.navigatorState.transitionSpeed;
    speedLabel.textContent = `${window.navigatorState.transitionSpeed.toFixed(1)}x`;
  }
}

/**
 * Render mini-map
 */
function renderMiniMap() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  const container = document.getElementById('miniMapCanvas');
  if (!container) return;
  
  container.innerHTML = '';
  
  const width = container.clientWidth;
  const height = 180;
  const scale = 0.2;
  
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // Render simplified nodes
  svg.selectAll('circle')
    .data(navigatorState.nodes)
    .join('circle')
    .attr('cx', d => d.x * scale)
    .attr('cy', d => d.y * scale)
    .attr('r', 1.5)
    .attr('fill', d => {
      if (d.cluster) {
        const cluster = navigatorState.clusters.find(c => c.id === d.cluster);
        return cluster ? cluster.color : '#999';
      }
      return '#999';
    })
    .attr('opacity', 0.8);
  
  // Viewport rectangle
  const viewportRect = svg.append('rect')
    .attr('class', 'minimap-viewport')
    .attr('fill', 'none')
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 1.5);
  
  navigatorState.miniMapSvg = svg;
  navigatorState.miniMapViewport = viewportRect;
  navigatorState.miniMapScale = scale;
  
  // Click to navigate
  svg.on('click', (event) => {
    const [x, y] = d3.pointer(event);
    window.navigateToMiniMapPosition(x / scale, y / scale);
  });
  
  window.updateMiniMapViewport();
}

/**
 * Update mini-map viewport rectangle
 */
function updateMiniMapViewport() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  if (!navigatorState.miniMapViewport || !navigatorState.svg) return;
  
  const transform = d3.zoomTransform(navigatorState.svg.node());
  const scale = navigatorState.miniMapScale;
  
  const width = 800 / transform.k;
  const height = 700 / transform.k;
  const x = -transform.x / transform.k;
  const y = -transform.y / transform.k;
  
  navigatorState.miniMapViewport
    .attr('x', x * scale)
    .attr('y', y * scale)
    .attr('width', width * scale)
    .attr('height', height * scale);
}

/**
 * Navigate to position in mini-map
 */
function navigateToMiniMapPosition(x, y) {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  if (!navigatorState.svg || !navigatorState.zoom) return;
  
  const width = 800;
  const height = 700;
  const scale = 1.5;
  
  const translateX = width / 2 - scale * x;
  const translateY = height / 2 - scale * y;
  
  navigatorState.svg.transition()
    .duration(500)
    .call(navigatorState.zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

/**
 * Update navigator statistics
 */
function updateNavigatorStats() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  const fileCountEl = document.getElementById('navFileCount');
  const clusterCountEl = document.getElementById('navClusterCount');
  
  if (!fileCountEl || !clusterCountEl) {
    console.warn('[NAVIGATOR] Stats elements not found, skipping update');
    return;
  }
  
  fileCountEl.textContent = navigatorState.nodes.length;
  clusterCountEl.textContent = navigatorState.clusters.length;
  
  // Calculate coherence (average intra-cluster distance vs inter-cluster distance)
  let coherence = 0;
  if (navigatorState.clusters.length > 1) {
    const intraDistances = [];
    const interDistances = [];
    
    navigatorState.clusters.forEach(cluster => {
      if (!cluster.nodes || cluster.nodes.length === 0) return;
      cluster.nodes.forEach((n1, i) => {
        if (!n1 || typeof n1.x !== 'number' || typeof n1.y !== 'number') return;
        cluster.nodes.forEach((n2, j) => {
          if (i < j && n2 && typeof n2.x === 'number' && typeof n2.y === 'number') {
            const dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
            intraDistances.push(dist);
          }
        });
      });
    });
    
    navigatorState.clusters.forEach((c1, i) => {
      navigatorState.clusters.forEach((c2, j) => {
        if (i < j && c1.nodes && c1.nodes.length > 0 && c2.nodes && c2.nodes.length > 0) {
          c1.nodes.forEach(n1 => {
            if (!n1 || typeof n1.x !== 'number' || typeof n1.y !== 'number') return;
            c2.nodes.forEach(n2 => {
              if (!n2 || typeof n2.x !== 'number' || typeof n2.y !== 'number') return;
              const dist = Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
              interDistances.push(dist);
            });
          });
        }
      });
    });
    
    const avgIntra = d3.mean(intraDistances) || 1;
    const avgInter = d3.mean(interDistances) || 1;
    coherence = Math.max(0, Math.min(100, (1 - avgIntra / avgInter) * 100));
  }
  
  const coherenceEl = document.getElementById('navCoherence');
  if (coherenceEl) {
    coherenceEl.textContent = `${coherence.toFixed(0)}%`;
  }
  
  // Update cluster legend with hierarchical support
  const legend = document.getElementById('clusterLegend');
  if (legend) {
    const escapeHtml = window.escapeHtml || ((str) => {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    });
    
    // Recursive function to render hierarchical clusters
    const renderCluster = (cluster, level = 0) => {
      const indent = level * 16;
      const hasChildren = cluster.children && cluster.children.length > 0;
      const isExpanded = cluster.expanded !== false;
      const clusterId = `cluster-${cluster.id}`;
      
      const tooltipParts = [cluster.description || cluster.name || `Cluster ${cluster.id}`];
      if (cluster.keywords && cluster.keywords.length > 0) {
        tooltipParts.push(`Keywords: ${cluster.keywords.slice(0, 5).join(', ')}`);
      }
      if (cluster.category && cluster.category !== 'unknown') {
        tooltipParts.push(`Category: ${cluster.category}`);
      }
      const tooltip = escapeHtml(tooltipParts.join('\n'));
      
      let html = `
      <div class="cluster-legend-item" data-cluster-id="${cluster.id}" style="margin-left: ${indent}px; ${level > 0 ? 'margin-top: 4px;' : ''}">
        <div style="display: flex; align-items: center; gap: 6px;">
          ${hasChildren ? `
            <button class="cluster-expand-btn" onclick="toggleClusterExpand('${cluster.id}')" 
                    style="background: none; border: none; cursor: pointer; padding: 2px 4px; color: var(--color-text-muted); font-size: 10px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
              ${isExpanded ? '▼' : '▶'}
            </button>
          ` : '<span style="width: 16px;"></span>'}
          <div class="cluster-legend-color" style="background: ${cluster.color}; width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;"></div>
          <span class="cluster-legend-label" title="${tooltip}" style="cursor: help; flex: 1;">
            ${escapeHtml(cluster.name || `Cluster ${cluster.id}`)} 
            <span style="color: var(--color-text-muted); font-size: 11px;">(${cluster.nodes.length})</span>
          </span>
        </div>
        ${cluster.description && level === 0 ? `<div class="cluster-description" style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px; margin-left: 24px; line-height: 1.3;">${escapeHtml(cluster.description.substring(0, 80))}${cluster.description.length > 80 ? '...' : ''}</div>` : ''}
        ${hasChildren && isExpanded ? `
          <div class="cluster-children" id="children-${cluster.id}" style="margin-top: 4px;">
            ${cluster.children.map(child => renderCluster(child, level + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
      return html;
    };
    
    legend.innerHTML = navigatorState.clusters.map(cluster => renderCluster(cluster)).join('');
  }
  
  // Add toggle function to window if not exists
  if (!window.toggleClusterExpand) {
    window.toggleClusterExpand = function(clusterId) {
      if (!window.navigatorState || !window.navigatorState.clusters) return;
      
      const cluster = window.navigatorState.clusters.find(c => c.id === clusterId);
      if (cluster) {
        cluster.expanded = !cluster.expanded;
        window.updateNavigatorStats(); // Re-render
      }
    };
  }
}

// Listen for cluster annotation updates
if (typeof window !== 'undefined') {
  window.addEventListener('clusters-annotated', (event) => {
    // Update cluster legend when annotations are ready
    if (window.navigatorState && event.detail && event.detail.clusters) {
      window.navigatorState.clusters = event.detail.clusters;
      // Re-render cluster legend
      const legend = document.getElementById('clusterLegend');
      if (legend && window.navigatorState) {
        const navigatorState = window.navigatorState;
        const escapeHtml = window.escapeHtml || ((str) => {
          const div = document.createElement('div');
          div.textContent = str;
          return div.innerHTML;
        });
        // Recursive function to render hierarchical clusters
        const renderCluster = (cluster, level = 0) => {
          const indent = level * 16;
          const hasChildren = cluster.children && cluster.children.length > 0;
          const isExpanded = cluster.expanded !== false;
          
          const tooltipParts = [cluster.description || cluster.name || `Cluster ${cluster.id}`];
          if (cluster.keywords && cluster.keywords.length > 0) {
            tooltipParts.push(`Keywords: ${cluster.keywords.slice(0, 5).join(', ')}`);
          }
          if (cluster.category && cluster.category !== 'unknown') {
            tooltipParts.push(`Category: ${cluster.category}`);
          }
          const tooltip = escapeHtml(tooltipParts.join('\n'));
          
          return `
          <div class="cluster-legend-item" data-cluster-id="${cluster.id}" style="margin-left: ${indent}px; ${level > 0 ? 'margin-top: 4px;' : ''}">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${hasChildren ? `
                <button class="cluster-expand-btn" onclick="toggleClusterExpand('${cluster.id}')" 
                        style="background: none; border: none; cursor: pointer; padding: 2px 4px; color: var(--color-text-muted); font-size: 10px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
                  ${isExpanded ? '▼' : '▶'}
                </button>
              ` : '<span style="width: 16px;"></span>'}
              <div class="cluster-legend-color" style="background: ${cluster.color}; width: 12px; height: 12px; border-radius: 2px; flex-shrink: 0;"></div>
              <span class="cluster-legend-label" title="${tooltip}" style="cursor: help; flex: 1;">
                ${escapeHtml(cluster.name || `Cluster ${cluster.id}`)} 
                <span style="color: var(--color-text-muted); font-size: 11px;">(${cluster.nodes.length})</span>
              </span>
            </div>
            ${cluster.description && level === 0 ? `<div class="cluster-description" style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px; margin-left: 24px; line-height: 1.3;">${escapeHtml(cluster.description.substring(0, 80))}${cluster.description.length > 80 ? '...' : ''}</div>` : ''}
            ${hasChildren && isExpanded ? `
              <div class="cluster-children" id="children-${cluster.id}" style="margin-top: 4px;">
                ${cluster.children.map(child => renderCluster(child, level + 1)).join('')}
              </div>
            ` : ''}
          </div>
        `;
        };
        
        legend.innerHTML = navigatorState.clusters.map(cluster => renderCluster(cluster)).join('');
      }
    }
  });
}

/**
 * Generate semantic insights
 */
function generateSemanticInsights() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  const container = document.getElementById('semanticInsights');
  if (!container || navigatorState.clusters.length === 0) return;
  
  const insights = [];
  
  // Find most isolated cluster
  const clusterCenters = navigatorState.clusters
    .map(c => c.centroid)
    .filter(centroid => centroid && typeof centroid.x === 'number' && typeof centroid.y === 'number');
  
  if (clusterCenters.length === 0) return; // No valid centroids
  
  let maxDist = 0;
  let isolatedCluster = null;
  
  navigatorState.clusters.forEach((cluster, i) => {
    if (!cluster.centroid || typeof cluster.centroid.x !== 'number' || typeof cluster.centroid.y !== 'number') {
      return; // Skip clusters without valid centroids
    }
    
    const distances = clusterCenters.map((center, j) => {
      if (i === j || !center || typeof center.x !== 'number' || typeof center.y !== 'number') return 0;
      return Math.sqrt((cluster.centroid.x - center.x) ** 2 + (cluster.centroid.y - center.y) ** 2);
    });
    const validDistances = distances.filter(d => d > 0);
    if (validDistances.length === 0) return;
    
    const minDist = Math.min(...validDistances);
    if (minDist > maxDist) {
      maxDist = minDist;
      isolatedCluster = cluster;
    }
  });
  
  if (isolatedCluster) {
    insights.push({
      title: 'Most Isolated Module',
      description: `${isolatedCluster.name} has minimal semantic overlap with other parts of your codebase.`,
      cluster: isolatedCluster,
      type: 'isolation',
      priority: 1
    });
  }
  
  // Find largest cluster
  const largestCluster = navigatorState.clusters.reduce((max, c) => 
    c.nodes.length > max.nodes.length ? c : max
  );
  
  insights.push({
    title: 'Core Module',
    description: `${largestCluster.name} contains ${largestCluster.nodes.length} files (${((largestCluster.nodes.length / navigatorState.nodes.length) * 100).toFixed(0)}% of codebase).`,
    cluster: largestCluster,
    type: 'core',
    priority: 1
  });
  
  // Find most active cluster (by changes and events)
  const mostActiveCluster = navigatorState.clusters.map(cluster => {
    const totalChanges = cluster.nodes.reduce((sum, node) => sum + (node.changes || 0), 0);
    const totalEvents = cluster.nodes.reduce((sum, node) => sum + (node.events?.length || 0), 0);
    const activityScore = totalChanges + (totalEvents * 10); // Weight events more
    return { cluster, activityScore, totalChanges, totalEvents };
  }).reduce((max, curr) => curr.activityScore > max.activityScore ? curr : max);
  
  if (mostActiveCluster.activityScore > 0) {
    insights.push({
      title: 'Most Active Module',
      description: `${mostActiveCluster.cluster.name} has ${mostActiveCluster.totalChanges} changes and ${mostActiveCluster.totalEvents} events - highest activity in the codebase.`,
      cluster: mostActiveCluster.cluster,
      type: 'activity',
      priority: 2
    });
  }
  
  // Find most cohesive cluster (high intra-cluster similarity)
  const cohesiveClusters = navigatorState.clusters.map(cluster => {
    if (!cluster.nodes || cluster.nodes.length < 2) return { cluster, cohesion: 0 };
    
    // Calculate average similarity of links within cluster
    const clusterNodeIds = new Set(cluster.nodes.map(n => n.id));
    const intraClusterLinks = navigatorState.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return clusterNodeIds.has(sourceId) && clusterNodeIds.has(targetId);
    });
    
    const avgSimilarity = intraClusterLinks.length > 0
      ? intraClusterLinks.reduce((sum, link) => sum + (link.similarity || 0), 0) / intraClusterLinks.length
      : 0;
    
    return { cluster, cohesion: avgSimilarity, linkCount: intraClusterLinks.length };
  }).filter(c => c.cohesion > 0);
  
  if (cohesiveClusters.length > 0) {
    const mostCohesive = cohesiveClusters.reduce((max, curr) => 
      curr.cohesion > max.cohesion ? curr : max
    );
    insights.push({
      title: 'Most Cohesive Module',
      description: `${mostCohesive.cluster.name} has ${mostCohesive.linkCount} internal connections with ${(mostCohesive.cohesion * 100).toFixed(0)}% average similarity - tightly integrated.`,
      cluster: mostCohesive.cluster,
      type: 'cohesion',
      priority: 2
    });
  }
  
  // Find bridge cluster (connects to most other clusters)
  const bridgeClusters = navigatorState.clusters.map(cluster => {
    const clusterNodeIds = new Set(cluster.nodes.map(n => n.id));
    const connectedClusters = new Set();
    
    navigatorState.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      const sourceInCluster = clusterNodeIds.has(sourceId);
      const targetInCluster = clusterNodeIds.has(targetId);
      
      if (sourceInCluster && !targetInCluster) {
        // Find which cluster target belongs to
        const targetCluster = navigatorState.clusters.find(c => 
          c.nodes.some(n => n.id === targetId)
        );
        if (targetCluster) connectedClusters.add(targetCluster.id);
      } else if (!sourceInCluster && targetInCluster) {
        // Find which cluster source belongs to
        const sourceCluster = navigatorState.clusters.find(c => 
          c.nodes.some(n => n.id === sourceId)
        );
        if (sourceCluster) connectedClusters.add(sourceCluster.id);
      }
    });
    
    return { cluster, bridgeCount: connectedClusters.size };
  });
  
  const bestBridge = bridgeClusters.reduce((max, curr) => 
    curr.bridgeCount > max.bridgeCount ? curr : max
  );
  
  if (bestBridge.bridgeCount > 0) {
    insights.push({
      title: 'Bridge Module',
      description: `${bestBridge.cluster.name} connects to ${bestBridge.bridgeCount} other module${bestBridge.bridgeCount !== 1 ? 's' : ''} - acts as a hub between different parts of your codebase.`,
      cluster: bestBridge.cluster,
      type: 'bridge',
      priority: 2
    });
  }
  
  // Find file type dominance
  const typeDominance = navigatorState.clusters.map(cluster => {
    const fileTypes = {};
    cluster.nodes.forEach(node => {
      const ext = node.ext || 'other';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });
    
    const total = cluster.nodes.length;
    const dominantType = Object.entries(fileTypes)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (dominantType && dominantType[1] / total > 0.5) {
      return {
        cluster,
        type: dominantType[0],
        percentage: (dominantType[1] / total * 100).toFixed(0),
        count: dominantType[1]
      };
    }
    return null;
  }).filter(Boolean);
  
  if (typeDominance.length > 0) {
    const mostDominant = typeDominance.reduce((max, curr) => 
      parseFloat(curr.percentage) > parseFloat(max.percentage) ? curr : max
    );
    insights.push({
      title: 'File Type Dominance',
      description: `${mostDominant.cluster.name} is ${mostDominant.percentage}% ${mostDominant.type === 'other' ? 'other files' : `.${mostDominant.type} files`} (${mostDominant.count} of ${mostDominant.cluster.nodes.length} files).`,
      cluster: mostDominant.cluster,
      type: 'filetype',
      priority: 3
    });
  }
  
  // Find high connectivity hub (files with most links)
  const nodeConnectivity = navigatorState.nodes.map(node => {
    const linkCount = navigatorState.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return sourceId === node.id || targetId === node.id;
    }).length;
    return { node, linkCount };
  }).sort((a, b) => b.linkCount - a.linkCount);
  
  if (nodeConnectivity.length > 0 && nodeConnectivity[0].linkCount > 5) {
    const hubNode = nodeConnectivity[0];
    const hubCluster = navigatorState.clusters.find(c => 
      c.nodes.some(n => n.id === hubNode.node.id)
    );
    if (hubCluster) {
      insights.push({
        title: 'High Connectivity Hub',
        description: `${hubNode.node.name} in ${hubCluster.name} has ${hubNode.linkCount} connections - central to codebase structure.`,
        cluster: hubCluster,
        type: 'hub',
        priority: 3,
        node: hubNode.node
      });
    }
  }
  
  // Find recently modified cluster (temporal activity)
  const now = Date.now();
  const recentThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
  const temporalClusters = navigatorState.clusters.map(cluster => {
    const recentNodes = cluster.nodes.filter(node => {
      if (!node.lastModified) return false;
      const modified = new Date(node.lastModified).getTime();
      return (now - modified) < recentThreshold;
    });
    return { cluster, recentCount: recentNodes.length, total: cluster.nodes.length };
  }).filter(c => c.recentCount > 0);
  
  if (temporalClusters.length > 0) {
    const mostRecent = temporalClusters.reduce((max, curr) => 
      curr.recentCount > max.recentCount ? curr : max
    );
    const recentPct = ((mostRecent.recentCount / mostRecent.total) * 100).toFixed(0);
    insights.push({
      title: 'Recently Modified Module',
      description: `${mostRecent.cluster.name} has ${mostRecent.recentCount} files modified in the last 7 days (${recentPct}% of module) - active development area.`,
      cluster: mostRecent.cluster,
      type: 'temporal',
      priority: 3
    });
  }
  
  // Sort insights by priority and limit to top 6
  insights.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const topInsights = insights.slice(0, 6);
  
  // Render insights
  const escapeHtml = window.escapeHtml || ((str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  });
  
  container.innerHTML = topInsights.map(insight => `
    <div class="semantic-insight-item" style="border-left-color: ${insight.cluster.color};">
      <h4 class="semantic-insight-title">${escapeHtml(insight.title)}</h4>
      <p class="semantic-insight-description">${escapeHtml(insight.description)}</p>
    </div>
  `).join('');
}

/**
 * Zoom to fit all nodes
 */
function zoomToFitNavigator() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  if (!navigatorState.svg || !navigatorState.zoom || navigatorState.nodes.length === 0) return;
  
  const xs = navigatorState.nodes.map(d => d.x);
  const ys = navigatorState.nodes.map(d => d.y);
  
  const minX = Math.min(...xs) - 50;
  const maxX = Math.max(...xs) + 50;
  const minY = Math.min(...ys) - 50;
  const maxY = Math.max(...ys) + 50;
  
  const width = 800;
  const height = 700;
  
  const scale = 0.9 * Math.min(width / (maxX - minX), height / (maxY - minY));
  const translateX = width / 2 - scale * (minX + maxX) / 2;
  const translateY = height / 2 - scale * (minY + maxY) / 2;
  
  navigatorState.svg.transition()
    .duration(750)
    .call(navigatorState.zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
}

/**
 * Reset navigator view
 */
function resetNavigatorView() {
  window.setNavigatorViewMode('physical');
  window.zoomToFitNavigator();
}

/**
 * Show file tooltip in navigator
 */
function showNavigatorFileTooltip(event, file) {
  hideNavigatorFileTooltip();
  
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'navigator-file-tooltip')
    .style('position', 'absolute')
    .style('background', 'var(--color-bg)')
    .style('border', '1px solid var(--color-border)')
    .style('border-radius', 'var(--radius-md)')
    .style('padding', 'var(--space-sm)')
    .style('box-shadow', '0 4px 12px rgba(0,0,0,0.15)')
    .style('z-index', '10000')
    .style('pointer-events', 'none')
    .style('max-width', '300px')
    .style('font-size', '12px');
  
  const parts = [
    `<strong style="color: var(--color-primary);">${file.path || file.name}</strong>`,
    file.ext ? `Type: <code>${file.ext}</code>` : '',
    file.changes ? `Changes: ${file.changes}` : '',
    file.size ? `Size: ${(file.size / 1024).toFixed(1)} KB` : '',
  ].filter(Boolean);
  
  if (file.cluster && window.navigatorState) {
    const cluster = window.navigatorState.clusters.find(c => c.id === file.cluster);
    if (cluster) {
      parts.push(`Cluster: <strong>${cluster.name}</strong>`);
      if (cluster.description) {
        parts.push(`<div style="margin-top: 4px; color: var(--color-text-muted); font-size: 11px;">${cluster.description.substring(0, 100)}${cluster.description.length > 100 ? '...' : ''}</div>`);
      }
    }
  }
  
  tooltip.html(parts.join('<br>'));
  
  const [x, y] = d3.pointer(event);
  tooltip
    .style('left', `${x + 10}px`)
    .style('top', `${y + 10}px`);
  
  window.navigatorFileTooltip = tooltip;
}

/**
 * Hide file tooltip in navigator
 */
function hideNavigatorFileTooltip() {
  if (window.navigatorFileTooltip) {
    window.navigatorFileTooltip.remove();
    window.navigatorFileTooltip = null;
  }
}

/**
 * Toggle navigator labels visibility
 */
function toggleNavigatorLabels() {
  if (!window.navigatorState) return;
  const navigatorState = window.navigatorState;
  
  if (!navigatorState.labels) return;
  
  navigatorState.labelsVisible = !navigatorState.labelsVisible;
  const button = document.getElementById('navigatorLabelToggle');
  
  if (navigatorState.labelsVisible) {
    navigatorState.labels.attr('opacity', 1);
    if (button) button.textContent = 'Hide Labels';
  } else {
    navigatorState.labels.attr('opacity', 0);
    if (button) button.textContent = 'Show Labels';
  }
}

// Export to window
window.renderNavigator = renderNavigator;
window.updateNodePositions = updateNodePositions;
window.setNavigatorViewMode = setNavigatorViewMode;
window.animateInterpolation = animateInterpolation;
window.updateInterpolationDisplay = updateInterpolationDisplay;
window.updateTransitionSpeed = updateTransitionSpeed;
window.initializeTransitionSpeed = initializeTransitionSpeed;
window.renderMiniMap = renderMiniMap;
window.updateMiniMapViewport = updateMiniMapViewport;
window.navigateToMiniMapPosition = navigateToMiniMapPosition;
window.updateNavigatorStats = updateNavigatorStats;
window.generateSemanticInsights = generateSemanticInsights;
window.zoomToFitNavigator = zoomToFitNavigator;
window.resetNavigatorView = resetNavigatorView;
window.toggleNavigatorLabels = toggleNavigatorLabels;

