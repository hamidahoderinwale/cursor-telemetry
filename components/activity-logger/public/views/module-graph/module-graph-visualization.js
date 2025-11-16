/**
 * Module Graph Visualization
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

let moduleGraphSimulation = null;
let moduleGraphSvg = null;
let moduleGraphNodes = null;
let moduleGraphEdges = null;
let moduleGraphSelectedNode = null;

/**
 * Initialize D3.js visualization
 */
function initializeModuleGraphVisualization() {
  const container = document.getElementById('module-graph-graph');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Create SVG
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  moduleGraphSvg = d3.select('#module-graph-graph')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      moduleGraphSvg.select('g').attr('transform', event.transform);
    });

  moduleGraphSvg.call(zoom);

  // Create main group for zoom/pan
  const g = moduleGraphSvg.append('g');

  // Create edge group (rendered first, behind nodes)
  moduleGraphEdges = g.append('g').attr('class', 'edges');

  // Create node group
  moduleGraphNodes = g.append('g').attr('class', 'nodes');

  // Create port group (for connection points)
  const ports = g.append('g').attr('class', 'ports');

  // Initialize force simulation
  moduleGraphSimulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(30));

  // Handle window resize
  window.addEventListener('resize', () => {
    const newWidth = container.clientWidth || 800;
    const newHeight = container.clientHeight || 600;
    moduleGraphSvg.attr('width', newWidth).attr('height', newHeight);
    if (moduleGraphSimulation) {
      moduleGraphSimulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
      moduleGraphSimulation.alpha(0.3).restart();
    }
  });
}

/**
 * Render module graph
 */
function renderModuleGraph(graphData) {
  if (!moduleGraphSvg || !graphData) return;

  const { nodes, edges } = graphData;

  // Update stats
  updateModuleGraphStats(nodes.length, edges.length);

  // Filter nodes and edges based on current filters
  const filteredNodes = filterModuleGraphNodes(nodes);
  const filteredEdges = filterModuleGraphEdges(edges, filteredNodes);

  // Render edges
  renderModuleGraphEdges(filteredEdges);

  // Render nodes
  renderModuleGraphNodes(filteredNodes);

  // Update simulation
  if (moduleGraphSimulation) {
    moduleGraphSimulation.nodes(filteredNodes);
    moduleGraphSimulation.force('link').links(filteredEdges);
    moduleGraphSimulation.alpha(1).restart();
  } else {
    // Re-initialize if simulation was lost
    initializeModuleGraphVisualization();
    if (moduleGraphSimulation) {
      moduleGraphSimulation.nodes(filteredNodes);
      moduleGraphSimulation.force('link').links(filteredEdges);
      moduleGraphSimulation.alpha(1).restart();
    }
  }
}

/**
 * Render nodes
 */
function renderModuleGraphNodes(nodes) {
  if (!moduleGraphNodes) return;

  const nodeSelection = moduleGraphNodes.selectAll('.node')
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
      highlightModuleGraphNode(d);
      showModuleGraphNodePorts(d);
    })
    .on('mouseleave', function(event, d) {
      unhighlightModuleGraphNode();
      hideModuleGraphNodePorts();
    })
    .on('click', function(event, d) {
      selectModuleGraphNode(d);
    });

  // Merge and update positions
  const nodeUpdate = nodeSelection.merge(nodeEnter);
  
  // Store node selection for tick updates
  window.moduleGraphNodeUpdate = nodeUpdate;
  
  if (moduleGraphSimulation) {
    moduleGraphSimulation.on('tick', () => {
      if (window.moduleGraphNodeUpdate) {
        window.moduleGraphNodeUpdate
          .attr('transform', d => `translate(${d.x || 0},${d.y || 0})`);
      }
      
      // Update edge positions
      updateModuleGraphEdgePositions();
    });
  }
}

/**
 * Render edges
 */
function renderModuleGraphEdges(edges) {
  if (!moduleGraphEdges) return;

  const edgeSelection = moduleGraphEdges.selectAll('.edge')
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
      showModuleGraphEdgeDetails(d);
    })
    .on('mouseleave', function(event, d) {
      d3.select(this).attr('stroke-width', Math.max(1, Math.min(5, d.weight)));
      hideModuleGraphEdgeDetails();
    })
    .on('click', function(event, d) {
      selectModuleGraphEdge(d);
    });

  // Update edge positions
  updateModuleGraphEdgePositions();
}

/**
 * Update edge positions (called on simulation tick)
 */
function updateModuleGraphEdgePositions() {
  if (!moduleGraphEdges) return;

  moduleGraphEdges.selectAll('.edge')
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
  if (!event.active) moduleGraphSimulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) moduleGraphSimulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

/**
 * Highlight node
 */
function highlightModuleGraphNode(node) {
  moduleGraphNodes.selectAll('.node')
    .filter(d => d.id === node.id)
    .select('circle, rect')
    .attr('stroke', '#3b82f6')
    .attr('stroke-width', 3);

  // Highlight connected edges
  moduleGraphEdges.selectAll('.edge')
    .attr('opacity', d => 
      (d.source.id === node.id || d.target.id === node.id) ? 1 : 0.1
    );
}

/**
 * Unhighlight node
 */
function unhighlightModuleGraphNode() {
  moduleGraphNodes.selectAll('.node')
    .select('circle, rect')
    .attr('stroke', d => d.interaction_counts?.ai_suggestions > 0 ? '#8b5cf6' : '#e5e7eb')
    .attr('stroke-width', d => d.interaction_counts?.ai_suggestions > 0 ? 2 : 1);

  moduleGraphEdges.selectAll('.edge')
    .attr('opacity', d => Math.min(1, 0.3 + (d.weight / 10)));
}

/**
 * Show node ports
 */
function showModuleGraphNodePorts(node) {
  // Port visualization would go here
  // For now, just highlight the node
}

/**
 * Hide node ports
 */
function hideModuleGraphNodePorts() {
  // Hide port visualization
}

/**
 * Select node
 */
function selectModuleGraphNode(node) {
  moduleGraphSelectedNode = node;
  showModuleGraphNodeDetails(node);
}

/**
 * Select edge
 */
function selectModuleGraphEdge(edge) {
  showModuleGraphEdgeDetails(edge);
}

/**
 * Show node details
 */
function showModuleGraphNodeDetails(node) {
  const detailsPanel = document.getElementById('module-graph-details-content');
  if (!detailsPanel) return;

  // Get connected files
  const graphData = window.moduleGraphData;
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
        <div class="module-graph-connected-file">
          <span class="module-graph-detail-path">${path.basename(cf.node.path)}</span>
          <span class="module-graph-edge-type-badge ${type.toLowerCase()}">${type}</span>
        </div>
      `).join('');
      return `
        <div class="module-graph-detail-section">
          <div class="module-graph-detail-label">${type} (${files.length})</div>
          <div class="module-graph-connected-files">${filesHTML}</div>
        </div>
      `;
    }).join('');

  detailsPanel.innerHTML = `
    <div class="module-graph-node-details">
      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">File</div>
        <div class="module-graph-detail-value">${path.basename(node.path)}</div>
        <div class="module-graph-detail-path">${node.path}</div>
      </div>

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Type</div>
        <div class="module-graph-detail-value">${node.type}</div>
      </div>

      ${node.lang ? `
      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Language</div>
        <div class="module-graph-detail-value">${node.lang.toUpperCase()}</div>
      </div>
      ` : ''}

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Size</div>
        <div class="module-graph-detail-value">${node.size_bucket} (${node.metadata?.num_original_lines || 0} lines)</div>
      </div>

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Interactions</div>
        <div class="module-graph-detail-value">
          Edits: ${node.interaction_counts?.edits || 0}<br>
          Navigations: ${node.interaction_counts?.navs || 0}<br>
          AI Suggestions: ${node.interaction_counts?.ai_suggestions || 0}<br>
          Model Context Uses: ${node.interaction_counts?.model_context_uses || 0}
        </div>
      </div>

      ${connectedHTML ? `
      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Connected Files</div>
        ${connectedHTML}
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Show edge details
 */
function showModuleGraphEdgeDetails(edge) {
  const detailsPanel = document.getElementById('module-graph-details-content');
  if (!detailsPanel) return;

  const graphData = window.moduleGraphData;
  if (!graphData) return;

  const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
  const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;
  const sourceNode = (graphData.nodes || []).find(n => n.id === sourceId);
  const targetNode = (graphData.nodes || []).find(n => n.id === targetId);

  detailsPanel.innerHTML = `
    <div class="module-graph-node-details">
      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Edge Type</div>
        <div class="module-graph-detail-value">
          <span class="module-graph-edge-type-badge ${edge.type.toLowerCase()}">${edge.type}</span>
        </div>
      </div>

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Source</div>
        <div class="module-graph-detail-value">${sourceNode ? path.basename(sourceNode.path) : edge.source}</div>
        <div class="module-graph-detail-path">${sourceNode ? sourceNode.path : ''}</div>
      </div>

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Target</div>
        <div class="module-graph-detail-value">${targetNode ? path.basename(targetNode.path) : edge.target}</div>
        <div class="module-graph-detail-path">${targetNode ? targetNode.path : ''}</div>
      </div>

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Weight</div>
        <div class="module-graph-detail-value">${edge.weight} (frequency)</div>
      </div>

      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Occurrences</div>
        <div class="module-graph-detail-value">${edge.timestamps?.length || 0} times</div>
      </div>

      ${edge.metadata ? `
      <div class="module-graph-detail-section">
        <div class="module-graph-detail-label">Metadata</div>
        <div class="module-graph-detail-value">
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
function hideModuleGraphEdgeDetails() {
  // Keep details if node is selected
  if (moduleGraphSelectedNode) {
    showModuleGraphNodeDetails(moduleGraphSelectedNode);
  }
}

/**
 * Update stats
 */
function updateModuleGraphStats(nodeCount, edgeCount) {
  const nodeCountEl = document.getElementById('module-graph-node-count');
  const edgeCountEl = document.getElementById('module-graph-edge-count');
  
  if (nodeCountEl) nodeCountEl.textContent = `${nodeCount} nodes`;
  if (edgeCountEl) edgeCountEl.textContent = `${edgeCount} edges`;
}

/**
 * Filter nodes based on current filters
 */
function filterModuleGraphNodes(nodes) {
  const typeFilter = document.getElementById('module-graph-filter-type')?.value;
  const langFilter = document.getElementById('module-graph-filter-lang')?.value;

  return nodes.filter(node => {
    if (typeFilter && node.type !== typeFilter) return false;
    if (langFilter && node.lang !== langFilter) return false;
    return true;
  });
}

/**
 * Filter edges based on current filters
 */
function filterModuleGraphEdges(edges, filteredNodes) {
  const nodeIds = new Set(filteredNodes.map(n => n.id));
  
  // Check edge type filters
  const edgeTypeFilters = {
    IMPORT: document.getElementById('module-graph-edge-import')?.checked !== false,
    CALL: document.getElementById('module-graph-edge-call')?.checked !== false,
    MODEL_CONTEXT: document.getElementById('module-graph-edge-context')?.checked !== false,
    NAVIGATE: document.getElementById('module-graph-edge-nav')?.checked !== false,
    TOOL: document.getElementById('module-graph-edge-tool')?.checked !== false
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
window.initializeModuleGraphVisualization = initializeModuleGraphVisualization;
window.renderModuleGraph = renderModuleGraph;
window.selectModuleGraphNode = selectModuleGraphNode;
window.selectModuleGraphEdge = selectModuleGraphEdge;

