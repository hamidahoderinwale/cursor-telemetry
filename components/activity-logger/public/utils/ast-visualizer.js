/**
 * AST Visualizer using D3.js
 * Renders AST graphs from DOT format or AST objects
 */

class ASTVisualizer {
  constructor(containerId) {
    this.containerId = containerId;
    this.width = 800;
    this.height = 600;
    this.margin = { top: 20, right: 20, bottom: 20, left: 20 };
  }

  /**
   * Render AST as a tree graph
   */
  renderAST(ast, options = {}) {
    if (!ast) return;

    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn('AST Visualizer: Container not found:', this.containerId);
      return;
    }

    // Clear previous content
    container.innerHTML = '';
    
    // Set dimensions
    this.width = options.width || container.clientWidth || 800;
    this.height = options.height || 400;

    // Create SVG
    const svg = d3.select(container)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .style('background', 'var(--color-bg, #0F172A)')
      .style('border-radius', 'var(--radius-md, 8px)');

    // Create zoom behavior
    const g = svg.append('g');
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Convert AST to hierarchical data for D3
    const root = this._astToHierarchy(ast);
    const treeLayout = d3.tree()
      .size([this.height - 100, this.width - 200]);

    const rootNode = d3.hierarchy(root);
    treeLayout(rootNode);

    // Color scheme based on node type and diff status
    const getNodeColor = (node) => {
      if (node.data._diff === 'added') return '#10B981'; // Green
      if (node.data._diff === 'removed') return '#EF4444'; // Red
      if (node.data._diff === 'modified') return '#F59E0B'; // Orange
      
      const typeColors = {
        'Program': '#6366F1',
        'FunctionDeclaration': '#8B5CF6',
        'ClassDeclaration': '#EC4899',
        'VariableDeclaration': '#3B82F6',
        'ControlStatement': '#F59E0B',
        'Statement': '#94A3B8'
      };
      return typeColors[node.data.type] || '#64748B';
    };

    // Draw links
    const links = g.selectAll('.link')
      .data(rootNode.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x))
      .attr('stroke', '#475569')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(rootNode.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`);

    // Add circles for nodes
    nodes.append('circle')
      .attr('r', d => d.children ? 8 : 5)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#1E293B')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', d => (d.children ? 8 : 5) + 2);
        
        // Show tooltip
        const tooltip = d3.select('body').append('div')
          .attr('class', 'ast-tooltip')
          .style('position', 'absolute')
          .style('background', 'var(--color-surface, #1E293B)')
          .style('color', 'var(--color-text, #F8FAFC)')
          .style('padding', '8px 12px')
          .style('border-radius', '6px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '10000')
          .style('box-shadow', '0 4px 12px rgba(0,0,0,0.3)')
          .html(`
            <div><strong>${d.data.type}</strong></div>
            ${d.data.name ? `<div>${d.data.name}</div>` : ''}
            ${d.data.startLine ? `<div>Lines: ${d.data.startLine}-${d.data.endLine}</div>` : ''}
            ${d.data._diff ? `<div>Status: ${d.data._diff}</div>` : ''}
          `);
        
        tooltip.style('left', (event.pageX + 10) + 'px')
               .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this).attr('r', d => d.children ? 8 : 5);
        d3.selectAll('.ast-tooltip').remove();
      });

    // Add labels
    nodes.append('text')
      .attr('dy', '0.35em')
      .attr('x', d => d.children ? -12 : 12)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .attr('fill', 'var(--color-text, #F8FAFC)')
      .attr('font-size', '11px')
      .text(d => {
        const name = d.data.name || d.data.type;
        return name.length > 20 ? name.substring(0, 20) + '...' : name;
      })
      .style('pointer-events', 'none');

    // Center the tree
    const bounds = g.node().getBBox();
    const fullWidth = bounds.width;
    const fullHeight = bounds.height;
    const midX = bounds.x + fullWidth / 2;
    const midY = bounds.y + fullHeight / 2;

    svg.call(zoom.transform, d3.zoomIdentity
      .translate(this.width / 2 - midX, this.height / 2 - midY)
      .scale(Math.min(0.8, (this.width - 100) / fullWidth, (this.height - 100) / fullHeight))
    );
  }

  /**
   * Convert AST to D3 hierarchy format
   */
  _astToHierarchy(ast) {
    if (!ast) return null;

    const node = {
      name: ast.name || ast.type,
      type: ast.type,
      _diff: ast._diff,
      startLine: ast.startLine,
      endLine: ast.endLine
    };

    if (ast.children && ast.children.length > 0) {
      node.children = ast.children.map(child => this._astToHierarchy(child));
    }

    return node;
  }

  /**
   * Render AST comparison (before/after side by side)
   */
  renderComparison(beforeAST, afterAST, options = {}) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = '1fr 1fr';
    container.style.gap = '20px';

    // Render before AST
    const beforeContainer = document.createElement('div');
    beforeContainer.id = this.containerId + '_before';
    container.appendChild(beforeContainer);

    const beforeViz = new ASTVisualizer(this.containerId + '_before');
    beforeViz.width = (this.width - 40) / 2;
    beforeViz.renderAST(beforeAST, { ...options, width: beforeViz.width });

    // Render after AST
    const afterContainer = document.createElement('div');
    afterContainer.id = this.containerId + '_after';
    container.appendChild(afterContainer);

    const afterViz = new ASTVisualizer(this.containerId + '_after');
    afterViz.width = (this.width - 40) / 2;
    afterViz.renderAST(afterAST, { ...options, width: afterViz.width });
  }
}

// Export for use in other modules
window.ASTVisualizer = ASTVisualizer;


