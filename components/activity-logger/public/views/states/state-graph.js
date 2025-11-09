/**
 * State Graph Visualization
 * D3.js graph showing state relationships (like Git graph)
 */

class StateGraphVisualization {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.apiBase = window.CONFIG?.API_BASE || 'http://localhost:43917';
    this.states = [];
    this.currentStateId = null;
    this.options = {
      width: options.width || 1200,
      height: options.height || 600,
      nodeRadius: options.nodeRadius || 20,
      ...options
    };
    
    this.svg = null;
    this.simulation = null;
    this.nodes = [];
    this.links = [];
  }

  /**
   * Load states and render graph
   */
  async loadAndRender(workspacePath = null) {
    try {
      const url = new URL(`${this.apiBase}/api/states`);
      if (workspacePath) {
        url.searchParams.set('workspace_path', workspacePath);
      }

      const response = await fetch(url);
      if (response.ok) {
        try {
          const data = await response.json();
          this.states = data.states || [];
          this.render();
        } catch (parseError) {
          // Silently handle parse errors (404, etc.) - states feature is disabled
          this.states = [];
          this.render();
        }
      } else {
        // Handle non-OK responses silently (states feature is disabled)
        this.states = [];
        this.render();
      }
    } catch (error) {
      console.error('[STATE-GRAPH] Error loading states:', error);
    }
  }

  /**
   * Render the graph
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error('[STATE-GRAPH] Container not found:', this.containerId);
      return;
    }

    // Clear previous render
    container.innerHTML = '';

    if (this.states.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding: var(--space-lg); text-align: center; color: var(--color-text-secondary);">No states yet. Create your first state to see the graph.</div>';
      return;
    }

    // Prepare nodes and links
    this.prepareGraphData();

    // Create SVG
    this.svg = d3.select(`#${this.containerId}`)
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('viewBox', `0 0 ${this.options.width} ${this.options.height}`)
      .style('background', 'var(--color-bg)')
      .style('border-radius', 'var(--radius-md)');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        this.svg.select('g').attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Create main group for zoom
    const g = this.svg.append('g');

    // Draw links (edges)
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(this.links)
      .enter()
      .append('line')
      .attr('stroke', d => this.getLinkColor(d))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Add arrow markers
    this.svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--color-text-secondary)');

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(this.nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(this.drag());

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => d.isCurrent ? this.options.nodeRadius + 3 : this.options.nodeRadius)
      .attr('fill', d => this.getNodeColor(d))
      .attr('stroke', d => d.isCurrent ? 'var(--color-primary)' : 'var(--color-border)')
      .attr('stroke-width', d => d.isCurrent ? 3 : 2)
      .style('cursor', 'pointer');

    // Add labels
    node.append('text')
      .text(d => d.name)
      .attr('x', 0)
      .attr('y', this.options.nodeRadius + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text)')
      .attr('font-size', '12px')
      .style('pointer-events', 'none');

    // Add intent badges
    node.append('text')
      .text(d => d.intent || 'general')
      .attr('x', 0)
      .attr('y', this.options.nodeRadius + 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--color-text-secondary)')
      .attr('font-size', '10px')
      .style('pointer-events', 'none');

    // Add click handlers
    node.on('click', (event, d) => {
      this.handleNodeClick(d);
    });

    // Add double-click to switch
    node.on('dblclick', (event, d) => {
      this.handleNodeDoubleClick(d);
    });

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'state-graph-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'var(--color-bg)')
      .style('border', '1px solid var(--color-border)')
      .style('border-radius', 'var(--radius-sm)')
      .style('padding', 'var(--space-sm)')
      .style('pointer-events', 'none')
      .style('z-index', 10000);

    node.on('mouseover', (event, d) => {
      tooltip.transition().duration(200).style('opacity', 1);
      tooltip.html(this.getTooltipContent(d))
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(200).style('opacity', 0);
    });

    // Create force simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(this.options.width / 2, this.options.height / 2))
      .force('collision', d3.forceCollide().radius(this.options.nodeRadius + 10));

    // Update positions on tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  /**
   * Prepare graph data from states
   */
  prepareGraphData() {
    this.nodes = this.states.map(state => ({
      id: state.id,
      name: state.name,
      intent: state.metadata?.intent || 'general',
      description: state.description,
      created_at: state.created_at,
      parent_id: state.parent_id,
      isCurrent: state.id === this.currentStateId,
      ...state
    }));

    this.links = this.states
      .filter(state => state.parent_id)
      .map(state => ({
        source: state.parent_id,
        target: state.id,
        type: 'fork'
      }));
  }

  /**
   * Get node color based on intent
   */
  getNodeColor(node) {
    const colorMap = {
      'experiment': '#FF6B6B',
      'feature': '#4ECDC4',
      'bug-fix': '#FFE66D',
      'refactor': '#95E1D3',
      'optimization': '#F38181',
      'documentation': '#AA96DA',
      'test': '#FCBAD3',
      'general': '#C7CEEA'
    };
    return colorMap[node.intent] || colorMap.general;
  }

  /**
   * Get link color
   */
  getLinkColor(link) {
    return 'var(--color-text-secondary)';
  }

  /**
   * Get tooltip content
   */
  getTooltipContent(node) {
    const escapeHtml = window.escapeHtml || ((str) => {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    });

    let html = `<div style="font-weight: 600; margin-bottom: 4px;">${escapeHtml(node.name)}</div>`;
    if (node.description) {
      html += `<div style="font-size: 0.85em; color: var(--color-text-secondary); margin-bottom: 4px;">${escapeHtml(node.description)}</div>`;
    }
    html += `<div style="font-size: 0.8em; color: var(--color-text-muted);">Intent: ${escapeHtml(node.intent)}</div>`;
    if (node.created_at) {
      const date = new Date(node.created_at);
      html += `<div style="font-size: 0.8em; color: var(--color-text-muted);">Created: ${date.toLocaleDateString()}</div>`;
    }
    html += `<div style="font-size: 0.75em; color: var(--color-text-muted); margin-top: 4px;">Double-click to switch</div>`;
    return html;
  }

  /**
   * Handle node click
   */
  handleNodeClick(node) {
    console.log('[STATE-GRAPH] Clicked node:', node);
    // Highlight node
    this.svg.selectAll('.node circle')
      .attr('stroke-width', d => d.id === node.id ? 4 : 2);
  }

  /**
   * Handle node double-click (switch state)
   */
  async handleNodeDoubleClick(node) {
    if (!window.stateService) {
      console.warn('[STATE-GRAPH] State service not available');
      return;
    }

    try {
      const result = await window.stateService.executeCommand(`switch to ${node.name}`, {});
      if (result.success) {
        this.currentStateId = node.id;
        // Re-render to show current state
        await this.loadAndRender();
        alert(`Switched to state: ${node.name}`);
      }
    } catch (error) {
      console.error('[STATE-GRAPH] Error switching state:', error);
      alert(`Error: ${error.message}`);
    }
  }

  /**
   * Drag behavior
   */
  drag() {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) this.simulation.alphaTarget(0);
        // Check if dragged onto another node (merge)
        const targetNode = this.findNodeAtPosition(event.x, event.y);
        if (targetNode && targetNode.id !== d.id) {
          this.handleMergeDrag(d, targetNode);
        } else {
          d.fx = null;
          d.fy = null;
        }
      });
  }

  /**
   * Find node at position
   */
  findNodeAtPosition(x, y) {
    return this.nodes.find(node => {
      const dx = x - node.x;
      const dy = y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < this.options.nodeRadius * 2;
    });
  }

  /**
   * Handle merge drag (drag one node onto another)
   */
  async handleMergeDrag(sourceNode, targetNode) {
    if (!window.stateService) {
      console.warn('[STATE-GRAPH] State service not available');
      return;
    }

    const confirmed = confirm(`Merge "${sourceNode.name}" into "${targetNode.name}"?`);
    if (!confirmed) {
      // Reset position
      sourceNode.fx = null;
      sourceNode.fy = null;
      this.simulation.alpha(1).restart();
      return;
    }

    try {
      const result = await window.stateService.executeCommand(
        `merge ${sourceNode.name} into ${targetNode.name}`,
        {}
      );
      
      if (result.success) {
        alert(`Merge prepared! Check the merge plan.`);
        // Reload graph
        await this.loadAndRender();
      }
    } catch (error) {
      console.error('[STATE-GRAPH] Error merging states:', error);
      alert(`Error: ${error.message}`);
      // Reset position
      sourceNode.fx = null;
      sourceNode.fy = null;
      this.simulation.alpha(1).restart();
    }
  }

  /**
   * Set current state
   */
  setCurrentState(stateId) {
    this.currentStateId = stateId;
    if (this.states.length > 0) {
      this.render();
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.StateGraphVisualization = StateGraphVisualization;
}

