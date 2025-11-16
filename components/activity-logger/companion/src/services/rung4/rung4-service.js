/**
 * Rung 4 Service
 * Main orchestration service for Rung 4 file-level abstraction
 */

const Rung4Extractor = require('./rung4-extractor');
const Rung4GraphBuilder = require('./rung4-graph-builder');

class Rung4Service {
  constructor(cursorDbParser = null) {
    this.extractor = new Rung4Extractor(cursorDbParser);
    this.graphBuilder = new Rung4GraphBuilder();
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get module graph for a workspace
   */
  async getModuleGraph(workspacePath = null, options = {}) {
    const cacheKey = workspacePath || 'global';
    const cached = this.cache.get(cacheKey);

    // Check cache
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout && !options.forceRefresh) {
      return cached.graph;
    }

    // Extract data
    const extractedData = await this.extractor.extractAll(workspacePath);

    // Build graph
    const graph = this.graphBuilder.buildGraph(extractedData);

    // Cache result
    this.cache.set(cacheKey, {
      graph,
      timestamp: Date.now()
    });

    return graph;
  }

  /**
   * Get nodes with filters
   */
  async getNodes(workspacePath = null, filters = {}) {
    const graph = await this.getModuleGraph(workspacePath);
    let nodes = graph.nodes;

    // Apply filters
    if (filters.type) {
      nodes = nodes.filter(n => n.type === filters.type);
    }

    if (filters.lang) {
      nodes = nodes.filter(n => n.lang === filters.lang);
    }

    if (filters.minEdits !== undefined) {
      nodes = nodes.filter(n => 
        n.interaction_counts?.edits >= filters.minEdits
      );
    }

    if (filters.hasModelContext) {
      // Filter to files that have MODEL_CONTEXT edges
      const contextFileIds = new Set(
        graph.edges
          .filter(e => e.type === 'MODEL_CONTEXT')
          .map(e => e.source)
      );
      nodes = nodes.filter(n => contextFileIds.has(n.id));
    }

    return nodes;
  }

  /**
   * Get edges with filters
   */
  async getEdges(workspacePath = null, filters = {}) {
    const graph = await this.getModuleGraph(workspacePath);
    let edges = graph.edges;

    // Apply filters
    if (filters.edgeType) {
      edges = edges.filter(e => e.type === filters.edgeType);
    }

    if (filters.source) {
      edges = edges.filter(e => e.source === filters.source);
    }

    if (filters.target) {
      edges = edges.filter(e => e.target === filters.target);
    }

    if (filters.minWeight !== undefined) {
      edges = edges.filter(e => e.weight >= filters.minWeight);
    }

    return edges;
  }

  /**
   * Get structural events
   */
  async getEvents(workspacePath = null, filters = {}) {
    const graph = await this.getModuleGraph(workspacePath);
    let events = graph.events;

    // Apply filters
    if (filters.timeRange) {
      const { since, until } = filters.timeRange;
      events = events.filter(e => {
        const ts = e.timestamp;
        if (since && ts < since) return false;
        if (until && ts > until) return false;
        return true;
      });
    }

    if (filters.eventType) {
      events = events.filter(e => e.event_type === filters.eventType);
    }

    if (filters.file) {
      events = events.filter(e => e.file === filters.file);
    }

    return events;
  }

  /**
   * Get directory hierarchy
   */
  async getHierarchy(workspacePath = null) {
    const graph = await this.getModuleGraph(workspacePath);
    return graph.hierarchy;
  }

  /**
   * Clear cache
   */
  clearCache(workspacePath = null) {
    if (workspacePath) {
      this.cache.delete(workspacePath);
    } else {
      this.cache.clear();
    }
  }
}

module.exports = Rung4Service;

