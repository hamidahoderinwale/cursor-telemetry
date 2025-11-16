/**
 * Rung 4 Graph Visualization
 * D3.js rendering for module graph (nodes, edges, ports)
 */

// Use path from Node.js path module (available in browser via polyfill or manual implementation)
const path = {
  basename: (p) => {
    const parts = p.split(/[/\\]/);
    return parts[parts.length - 1] || p;
  },
  dirname: (p) => {
    const parts = p.split(/[/\\]/);
    parts.pop();
    return parts.join('/') || '/';
  },
  extname: (p) => {
    const match = p.match(/\.[^.]*$/);
    return match ? match[0] : '';
  }
};

let rung4Simulation = null;
let rung4Svg = null;
let rung4Nodes = null;
let rung4Edges = null;
let rung4SelectedNode = null;

/**
 * Initialize D3.js visualization
 */
function initializeRung4Visualization() {
  const container = document.getElementById('rung4-graph');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Create SVG
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  rung4Svg = d3.select('#rung4-graph')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      rung4Svg.select('g').attr('transform', event.transform);
    });

  rung4Svg.call(zoom);

  // Create main group for zoom/pan
  const g = rung4Svg.append('g');

  // Create edge group (rendered first, behind nodes)
  rung4Edges = g.append('g').attr('class', 'edges');

  // Create node group
  rung4Nodes = g.append('g').attr('class', 'nodes');

  // Create port group (for connection points)
  const ports = g.append('g').attr('class', 'ports');

  // Initialize force simulation
  rung4Simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));

  // Handle window resize
  window.addEventListener('resize', () => {
    const newWidth = container.clientWidth || 800;
    const newHeight = container.clientHeight || 600;
    rung4Svg.attr('width', newWidth).attr('height', newHeight);
    if (rung4Simulation) {
      rung4Simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
      rung4Simulation.alpha(0.3).restart();
    }
  });
}

/**
 * Render module graph
 */
function renderRung4Graph(graphData) {
  if (!rung4Svg || !graphData) return;

  const { nodes, edges } = graphData;

  // Update stats
  updateRung4Stats(nodes.length, edges.length);

  // Filter nodes and edges based on current filters
  const filteredNodes = filterRung4Nodes(nodes);
  const filteredEdges = filterRung4Edges(edges, filteredNodes);

  // Render edges
  renderRung4Edges(filteredEdges);

  // Render nodes
  renderRung4Nodes(filteredNodes);

  // Update simulation
  if (rung4Simulation) {
    rung4Simulation.nodes(filteredNodes);
    rung4Simulation.force('link').links(filteredEdges);
    rung4Simulation.alpha(1).restart();
  } else {
    // Re-initialize if simulation was lost
    initializeRung4Visualization();
    if (rung4Simulation) {
      rung4Simulation.nodes(filteredNodes);
      rung4Simulation.force('link').links(filteredEdges);
      rung4Simulation.alpha(1).restart();
    }
  }
}

/**
 * Render nodes
 */
function renderRung4Nodes(nodes) {
  if (!rung4Nodes) return;

  const nodeSelection = rung4Nodes.selectAll('.node')
    .data(nodes, d => d.id);

  // Remove old nodes
  nodeSelection.exit().remove();

  // Add new nodes
  const nodeEnter = nodeSelection.enter()
    .append('g')
    .attr('class', d => `node node-${d.type}`)
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));

  // Add circle for file nodes
  nodeEnter.filter(d => d.type === 'file')
    .append('circle')
    .attr('r', d => getNodeRadius(d))
    .attr('fill', d => getNodeColor(d))
    .attr('stroke', d => d.interaction_counts?.ai_suggestions > 0 ? '#8b5cf6' : '#e5e7eb')
    .attr('stroke-width', d => d.interaction_counts?.ai_suggestions > 0 ? 2 : 1)
    .style('cursor', 'pointer');

  // Add rectangle for directory nodes
  nodeEnter.filter(d => d.type === 'directory')
    .append('rect')
    .attr('width', d => 60)
    .attr('height', d => 40)
    .attr('rx', 4)
    .attr('fill', '#f3f4f6')
    .attr('stroke', '#d1d5db')
    .attr('stroke-width', 1)
    .style('cursor', 'pointer');

  // Add labels
  nodeEnter.append('text')
    .attr('dy', d => d.type === 'file' ? 25 : 50)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#6b7280')
    .text(d => {
      if (d.type === 'file') {
        return path.basename(d.path);
      } else {
        return path.basename(d.path) || d.id;
      }
    });

  // Add hover effects
  nodeEnter
    .on('mouseenter', function(event, d) {
      highlightRung4Node(d);
      showRung4NodePorts(d);
    })
    .on('mouseleave', function(event, d) {
      unhighlightRung4Node();
      hideRung4NodePorts();
    })
    .on('click', function(event, d) {
      selectRung4Node(d);
    });

  // Merge and update positions
  const nodeUpdate = nodeSelection.merge(nodeEnter);
  
  // Store node selection for tick updates
  window.rung4NodeUpdate = nodeUpdate;
  
  if (rung4Simulation) {
    rung4Simulation.on('tick', () => {
      if (window.rung4NodeUpdate) {
        window.rung4NodeUpdate
          .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      }
      
      // Update edge positions
      updateRung4EdgePositions();
    });
  }
}

/**
 * Render edges
 */
function renderRung4Edges(edges) {
  if (!rung4Edges) return;

  const edgeSelection = rung4Edges.selectAll('.edge')
    .data(edges, d => d.id);

  // Remove old edges
  edgeSelection.exit().remove();

  // Add new edges
  const edgeEnter = edgeSelection.enter()
    .append('line')
    .attr('class', d => `edge edge-${d.type.toLowerCase()}`)
    .attr('stroke', d => getEdgeColor(d.type))
    .attr('stroke-width', d => Math.max(1, Math.min(5, d.weight)))
    .attr('stroke-dasharray', d => getEdgeDashArray(d.type))
    .attr('opacity', d => Math.min(1, 0.3 + (d.weight / 10)))
    .style('cursor', 'pointer');

  edgeEnter
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke-width', Math.max(2, d.weight + 2));
      showRung4EdgeDetails(d);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).attr('stroke-width', Math.max(1, Math.min(5, d.weight)));
      hideRung4EdgeDetails();
    })
    .on('click', function(event, d) {
      selectRung4Edge(d);
    });

  // Update edge positions
  updateRung4EdgePositions();
}

/**
 * Update edge positions (called on simulation tick)
 */
function updateRung4EdgePositions() {
  if (!rung4Edges) return;

  rung4Edges.selectAll('.edge')
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);
}

/**
 * Get node radius based on size/interactions
 */
function getNodeRadius(node) {
  if (node.type === 'directory') return 0;
  
  const baseRadius = 12;
  const sizeMultiplier = {
    small: 1,
    medium: 1.3,
    large: 1.6
  }[node.size_bucket] || 1;
  
  const interactionMultiplier = Math.min(1.5, 1 + (node.interaction_counts?.edits || 0) / 50);
  
  return baseRadius * sizeMultiplier * interactionMultiplier;
}

/**
 * Get node color based on language
 */
function getNodeColor(node) {
  const colorMap = {
    js: '#3b82f6',
    ts: '#2563eb',
    py: '#f59e0b',
    java: '#ef4444',
    go: '#10b981',
    rust: '#f97316',
    json: '#8b5cf6',
    html: '#ec4899',
    css: '#06b6d4',
    unknown: '#6b7280'
  };
  return colorMap[node.lang] || colorMap.unknown;
}

/**
 * Get edge color based on type
 */
function getEdgeColor(edgeType) {
  const colorMap = {
    IMPORT: '#3b82f6',
    CALL: '#10b981',
    MODEL_CONTEXT: '#8b5cf6',
    NAVIGATE: '#f59e0b',
    TOOL: '#ef4444'
  };
  return colorMap[edgeType] || '#6b7280';
}

/**
 * Get edge dash array based on type
 */
function getEdgeDashArray(edgeType) {
  const dashMap = {
    IMPORT: '0',
    CALL: '0',
    MODEL_CONTEXT: '5,5',
    NAVIGATE: '2,2',
    TOOL: '5,2,2,2'
  };
  return dashMap[edgeType] || '0';
}

/**
 * Drag handlers
 */
function dragStarted(event, d) {
  if (!event.active) rung4Simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) rung4Simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

/**
 * Highlight node
 */
function highlightRung4Node(node) {
  rung4Nodes.selectAll('.node')
    .filter(d => d.id === node.id)
    .select('circle, rect')
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 3);

  // Highlight connected edges
  rung4Edges.selectAll('.edge')
    .attr('opacity', d => 
      (d.source.id === node.id || d.target.id === node.id) ? 1 : 0.1
    );
}

/**
 * Unhighlight node
 */
function unhighlightRung4Node() {
  rung4Nodes.selectAll('.node')
    .select('circle, rect')
    .attr('stroke', d => d.interaction_counts?.ai_suggestions > 0 ? '#8b5cf6' : '#e5e7eb')
    .attr('stroke-width', d => d.interaction_counts?.ai_suggestions > 0 ? 2 : 1);

  rung4Edges.selectAll('.edge')
    .attr('opacity', d => Math.min(1, 0.3 + (d.weight / 10)));
}

/**
 * Show node ports
 */
function showRung4NodePorts(node) {
  // Port visualization would go here
  // For now, just highlight the node
}

/**
 * Hide node ports
 */
function hideRung4NodePorts() {
  // Hide port visualization
}

/**
 * Select node
 */
function selectRung4Node(node) {
  rung4SelectedNode = node;
  showRung4NodeDetails(node);
}

/**
 * Select edge
 */
function selectRung4Edge(edge) {
  showRung4EdgeDetails(edge);
}

/**
 * Show node details
 */
function showRung4NodeDetails(node) {
  const detailsPanel = document.getElementById('rung4-details-content');
  if (!detailsPanel) return;

  // Get connected files
  const graphData = window.rung4GraphData;
  if (!graphData) return;

  const connectedFiles = (graphData.edges || [])
    .filter(e => {
      const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
      const targetId = typeof e.target === 'object' ? e.target.id : e.target;
      return sourceId === node.id || targetId === node.id;
    })
    .map(e => {
      const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
      const targetId = typeof e.target === 'object' ? e.target.id : e.target;
      const otherId = sourceId === node.id ? targetId : sourceId;
      const otherNode = (graphData.nodes || []).find(n => n.id === otherId);
      return {
        node: otherNode,
        edge: e,
        direction: sourceId === node.id ? 'out' : 'in'
      };
    })
    .filter(cf => cf.node); // Filter out edges to non-existent nodes

  const connectedByType = {};
  connectedFiles.forEach(cf => {
    const type = cf.edge.type;
    if (!connectedByType[type]) {
      connectedByType[type] = [];
    }
    connectedByType[type].push(cf);
  });

  const connectedHTML = Object.entries(connectedByType)
    .map(([type, files]) => {
      const filesHTML = files.map(cf => `
        <div class="rung4-connected-file">
          <span class="rung4-detail-path">${path.basename(cf.node.path)}</span>
          <span class="rung4-edge-type-badge ${type.toLowerCase()}">${type}</span>
        </div>
      `).join('');
      return `
        <div class="rung4-detail-section">
          <div class="rung4-detail-label">${type} (${files.length})</div>
          <div class="rung4-connected-files">${filesHTML}</div>
        </div>
      `;
    }).join('');

  detailsPanel.innerHTML = `
    <div class="rung4-node-details">
      <div class="rung4-detail-section">
        <div class="rung4-detail-label">File</div>
        <div class="rung4-detail-value">${path.basename(node.path)}</div>
        <div class="rung4-detail-path">${node.path}</div>
      </div>

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Type</div>
        <div class="rung4-detail-value">${node.type}</div>
      </div>

      ${node.lang ? `
      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Language</div>
        <div class="rung4-detail-value">${node.lang.toUpperCase()}</div>
      </div>
      ` : ''}

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Size</div>
        <div class="rung4-detail-value">${node.size_bucket} (${node.metadata?.num_original_lines || 0} lines)</div>
      </div>

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Interactions</div>
        <div class="rung4-detail-value">
          Edits: ${node.interaction_counts?.edits || 0}<br>
          Navigations: ${node.interaction_counts?.navs || 0}<br>
          AI Suggestions: ${node.interaction_counts?.ai_suggestions || 0}<br>
          Model Context Uses: ${node.interaction_counts?.model_context_uses || 0}
        </div>
      </div>

      ${connectedHTML ? `
      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Connected Files</div>
        ${connectedHTML}
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Show edge details
 */
function showRung4EdgeDetails(edge) {
  const detailsPanel = document.getElementById('rung4-details-content');
  if (!detailsPanel) return;

  const graphData = window.rung4GraphData;
  if (!graphData) return;

  const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
  const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
  const sourceNode = (graphData.nodes || []).find(n => n.id === sourceId);
  const targetNode = (graphData.nodes || []).find(n => n.id === targetId);

  detailsPanel.innerHTML = `
    <div class="rung4-node-details">
      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Edge Type</div>
        <div class="rung4-detail-value">
          <span class="rung4-edge-type-badge ${edge.type.toLowerCase()}">${edge.type}</span>
        </div>
      </div>

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Source</div>
        <div class="rung4-detail-value">${sourceNode ? path.basename(sourceNode.path) : edge.source}</div>
        <div class="rung4-detail-path">${sourceNode ? sourceNode.path : ''}</div>
      </div>

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Target</div>
        <div class="rung4-detail-value">${targetNode ? path.basename(targetNode.path) : edge.target}</div>
        <div class="rung4-detail-path">${targetNode ? targetNode.path : ''}</div>
      </div>

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Weight</div>
        <div class="rung4-detail-value">${edge.weight} (frequency)</div>
      </div>

      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Occurrences</div>
        <div class="rung4-detail-value">${edge.timestamps?.length || 0} times</div>
      </div>

      ${edge.metadata ? `
      <div class="rung4-detail-section">
        <div class="rung4-detail-label">Metadata</div>
        <div class="rung4-detail-value">
          ${Object.entries(edge.metadata).map(([key, value]) => 
            `${key}: ${value}`
          ).join('<br>')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Hide edge details
 */
function hideRung4EdgeDetails() {
  // Keep details if node is selected
  if (rung4SelectedNode) {
    showRung4NodeDetails(rung4SelectedNode);
  }
}

/**
 * Update stats
 */
function updateRung4Stats(nodeCount, edgeCount) {
  const nodeCountEl = document.getElementById('rung4-node-count');
  const edgeCountEl = document.getElementById('rung4-edge-count');
  
  if (nodeCountEl) nodeCountEl.textContent = `${nodeCount} nodes`;
  if (edgeCountEl) edgeCountEl.textContent = `${edgeCount} edges`;
}

/**
 * Filter nodes based on current filters
 */
function filterRung4Nodes(nodes) {
  const typeFilter = document.getElementById('rung4-filter-type')?.value;
  const langFilter = document.getElementById('rung4-filter-lang')?.value;

  return nodes.filter(node => {
    if (typeFilter && node.type !== typeFilter) return false;
    if (langFilter && node.lang !== langFilter) return false;
    return true;
  });
}

/**
 * Filter edges based on current filters
 */
function filterRung4Edges(edges, filteredNodes) {
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  
  // Check edge type filters
  const edgeTypeFilters = {
    IMPORT: document.getElementById('rung4-edge-import')?.checked !== false,
    CALL: document.getElementById('rung4-edge-call')?.checked !== false,
    MODEL_CONTEXT: document.getElementById('rung4-edge-context')?.checked !== false,
    NAVIGATE: document.getElementById('rung4-edge-nav')?.checked !== false,
    TOOL: document.getElementById('rung4-edge-tool')?.checked !== false
  };

  return edges.filter(edge => {
    // Filter by edge type
    if (!edgeTypeFilters[edge.type]) return false;
    
    // Filter by node visibility
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
    
    return true;
  });
}

// Export functions to window
window.initializeRung4Visualization = initializeRung4Visualization;
window.renderRung4Graph = renderRung4Graph;
window.selectRung4Node = selectRung4Node;
window.selectRung4Edge = selectRung4Edge;

