/**
 * File Relationship Graph Visualizer
 * Visualizes code relationships using D3.js force-directed graph
 */

class FileGraphVisualizer {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.svg = null;
    this.simulation = null;
    this.nodes = [];
    this.links = [];
    this.config = {
      vizMode: 'network',
      layout: 'force',
      metric: 'semantic',
      reduction: 'pca',
      clustering: 'none',
      similarityThreshold: 0.3,
      fileTypes: ['js', 'ts', 'py', 'html', 'css', 'json', 'md']
    };
    this.width = 0;
    this.height = 0;
    this.colorScale = null;
    this.tfidfData = null;
  }

  /**
   * Initialize the visualizer
   */
  async initialize() {
    if (!this.container) {
      console.error('Container not found:', this.containerId);
      return;
    }

    // Set dimensions
    this.width = this.container.clientWidth || 800;
    this.height = this.container.clientHeight || 600;

    // Create SVG
    this.svg = d3.select(`#${this.containerId}`)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'file-graph-svg');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        this.svg.select('.graph-container').attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Create container for graph elements
    this.svg.append('g')
      .attr('class', 'graph-container');

    // Create color scale
    this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Load data
    await this.loadData();

    // Render graph
    this.render();

    console.log('✅ File graph visualizer initialized');
  }

  /**
   * Load file data from storage
   */
  async loadData() {
    try {
      const sync = window.getSynchronizer();
      if (!sync) {
        console.warn('Data synchronizer not initialized');
        return;
      }

      // Get all events with file content
      const events = await sync.storage.getAllEvents(500);
      
      // Build file map
      const fileMap = new Map();
      
      events.forEach(event => {
        try {
          const details = typeof event.details === 'string' ? 
            JSON.parse(event.details) : event.details;
          
          const filePath = details?.file_path;
          if (!filePath) return;

          // Check file type filter
          const ext = filePath.split('.').pop()?.toLowerCase();
          if (!this.config.fileTypes.includes(ext)) return;

          if (!fileMap.has(filePath)) {
            fileMap.set(filePath, {
              path: filePath,
              name: filePath.split('/').pop(),
              ext: ext,
              content: '',
              changes: 0,
              lastModified: event.timestamp
            });
          }

          const file = fileMap.get(filePath);
          file.changes++;
          file.lastModified = Math.max(file.lastModified, event.timestamp);
          
          // Accumulate content for TF-IDF
          const content = details?.after_content || details?.content || '';
          if (content && content.length < 10000) {
            file.content += ' ' + content;
          }
        } catch (error) {
          // Skip malformed events
        }
      });

      // Convert to array
      const files = Array.from(fileMap.values())
        .filter(f => f.content.length > 50); // Only files with content

      console.log(`📁 Loaded ${files.length} files for graph`);

      if (files.length === 0) {
        this.showEmptyState();
        return;
      }

      // Compute TF-IDF and similarities
      this.computeTFIDF(files);
      this.buildGraph(files);

    } catch (error) {
      console.error('Error loading file data:', error);
      this.showEmptyState();
    }
  }

  /**
   * Compute TF-IDF for files
   */
  computeTFIDF(files) {
    // Tokenize all files
    files.forEach(file => {
      const tokens = this.tokenize(file.content);
      file.tokens = tokens;
      file.termFreq = this.computeTermFrequency(tokens);
    });

    // Compute IDF
    const documentFreq = new Map();
    files.forEach(file => {
      const uniqueTerms = new Set(file.tokens);
      uniqueTerms.forEach(term => {
        documentFreq.set(term, (documentFreq.get(term) || 0) + 1);
      });
    });

    const numDocs = files.length;
    const idf = new Map();
    documentFreq.forEach((freq, term) => {
      idf.set(term, Math.log(numDocs / freq));
    });

    // Compute TF-IDF vectors
    files.forEach(file => {
      file.tfidf = new Map();
      file.termFreq.forEach((tf, term) => {
        file.tfidf.set(term, tf * (idf.get(term) || 0));
      });
    });

    this.tfidfData = { files, idf };
  }

  /**
   * Tokenize text
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.isStopWord(token));
  }

  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
      'was', 'one', 'our', 'out', 'var', 'let', 'const', 'function', 'return',
      'this', 'that', 'from', 'import', 'export', 'class', 'def', 'null', 'undefined'
    ]);
    return stopWords.has(word);
  }

  /**
   * Compute term frequency
   */
  computeTermFrequency(tokens) {
    const freq = new Map();
    tokens.forEach(token => {
      freq.set(token, (freq.get(token) || 0) + 1);
    });
    
    // Normalize
    const total = tokens.length;
    freq.forEach((count, term) => {
      freq.set(term, count / total);
    });
    
    return freq;
  }

  /**
   * Build graph from files
   */
  buildGraph(files) {
    // Create nodes
    this.nodes = files.map((file, i) => ({
      id: i,
      name: file.name,
      path: file.path,
      ext: file.ext,
      changes: file.changes,
      size: Math.log(file.content.length + 1) * 5,
      tfidf: file.tfidf,
      x: this.width / 2,
      y: this.height / 2
    }));

    // Create links based on similarity
    this.links = [];
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const similarity = this.cosineSimilarity(
          this.nodes[i].tfidf,
          this.nodes[j].tfidf
        );
        
        if (similarity >= this.config.similarityThreshold) {
          this.links.push({
            source: i,
            target: j,
            similarity: similarity,
            strength: similarity
          });
        }
      }
    }

    console.log(`📊 Built graph: ${this.nodes.length} nodes, ${this.links.length} links`);
  }

  /**
   * Compute cosine similarity
   */
  cosineSimilarity(tfidf1, tfidf2) {
    const allTerms = new Set([...tfidf1.keys(), ...tfidf2.keys()]);
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    allTerms.forEach(term => {
      const v1 = tfidf1.get(term) || 0;
      const v2 = tfidf2.get(term) || 0;
      dotProduct += v1 * v2;
      mag1 += v1 * v1;
      mag2 += v2 * v2;
    });
    
    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Render the graph
   */
  render() {
    if (this.nodes.length === 0) {
      this.showEmptyState();
      return;
    }

    const container = this.svg.select('.graph-container');

    // Clear existing
    container.selectAll('*').remove();

    // Create link elements
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(this.links)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', d => d.similarity * 0.6)
      .attr('stroke-width', d => d.similarity * 3);

    // Create node elements
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(this.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', (event, d) => this.dragStarted(event, d))
        .on('drag', (event, d) => this.dragged(event, d))
        .on('end', (event, d) => this.dragEnded(event, d)));

    // Add circles
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => this.colorScale(d.ext))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add labels
    node.append('text')
      .text(d => d.name)
      .attr('x', d => d.size + 5)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', '#333');

    // Add tooltips
    node.append('title')
      .text(d => `${d.path}\nChanges: ${d.changes}\nConnections: ${this.links.filter(l => 
        l.source === d.id || l.target === d.id
      ).length}`);

    // Create force simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links)
        .id(d => d.id)
        .strength(d => d.strength)
        .distance(100))
      .force('charge', d3.forceManyBody()
        .strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => d.size + 10));

    // Update positions on tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => this.nodes[d.source].x || d.source.x)
        .attr('y1', d => this.nodes[d.source].y || d.source.y)
        .attr('x2', d => this.nodes[d.target].x || d.target.x)
        .attr('y2', d => this.nodes[d.target].y || d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  /**
   * Drag handlers
   */
  dragStarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragEnded(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  /**
   * Update config and re-render
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.loadData().then(() => this.render());
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const container = this.svg.select('.graph-container');
    container.selectAll('*').remove();
    
    container.append('text')
      .attr('x', this.width / 2)
      .attr('y', this.height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('fill', '#666')
      .text('No file data available. Start making code changes to see relationships.');
  }

  /**
   * Export graph data
   */
  exportData() {
    return {
      nodes: this.nodes,
      links: this.links,
      config: this.config
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.simulation) {
      this.simulation.stop();
    }
    if (this.svg) {
      this.svg.remove();
    }
  }
}

// Global instance
let fileGraphVisualizer = null;

async function initializeFileGraph(containerId = 'fileGraphContainer') {
  if (fileGraphVisualizer) {
    fileGraphVisualizer.destroy();
  }
  
  fileGraphVisualizer = new FileGraphVisualizer(containerId);
  await fileGraphVisualizer.initialize();
  
  return fileGraphVisualizer;
}

// Export
window.FileGraphVisualizer = FileGraphVisualizer;
window.initializeFileGraph = initializeFileGraph;
window.getFileGraphVisualizer = () => fileGraphVisualizer;


