/**
 * Module Graph API Routes
 * Endpoints for file-level abstraction (module graph) data
 */

function createModuleGraphRoutes(deps) {
  const { app, moduleGraphService } = deps;

  if (!moduleGraphService) {
    console.warn('[MODULE-GRAPH] Module graph service not available, routes disabled');
    return;
  }

  console.log('[MODULE-GRAPH] Registering module graph routes...');

  /**
   * GET /api/module-graph/graph
   * Get complete module graph
   */
  app.get('/api/module-graph/graph', async (req, res) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'Request timeout - module graph extraction is taking too long. Try a specific workspace or use /api/module-graph/nodes for faster results.'
        });
      }
    }, 30000); // 30 second timeout

    try {
      if (!moduleGraphService) {
        clearTimeout(timeout);
        return res.status(503).json({
          success: false,
          error: 'Module graph service not available'
        });
      }

      const workspace = req.query.workspace || req.query.workspace_path || null;
      // Normalize "all" to null for global extraction
      const normalizedWorkspace = workspace === 'all' ? null : workspace;
      const forceRefresh = req.query.force_refresh === 'true';

      const graph = await moduleGraphService.getModuleGraph(normalizedWorkspace, { forceRefresh });

      clearTimeout(timeout);
      res.json({
        success: true,
        graph,
        metadata: graph.metadata
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error('[MODULE-GRAPH] Error getting module graph:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error occurred'
      });
    }
  });

  /**
   * GET /api/module-graph/nodes
   * Get module nodes with filters
   */
  app.get('/api/module-graph/nodes', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;
      const filters = {
        type: req.query.type || null,
        lang: req.query.lang || null,
        minEdits: req.query.min_edits ? parseInt(req.query.min_edits) : undefined,
        hasModelContext: req.query.has_model_context === 'true'
      };

      const nodes = await moduleGraphService.getNodes(workspace, filters);

      res.json({
        success: true,
        nodes,
        count: nodes.length
      });
    } catch (error) {
      console.error('[MODULE-GRAPH] Error getting nodes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/module-graph/edges
   * Get typed edges with filters
   */
  app.get('/api/module-graph/edges', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;
      const filters = {
        edgeType: req.query.edge_type || null,
        source: req.query.source || null,
        target: req.query.target || null,
        minWeight: req.query.min_weight ? parseInt(req.query.min_weight) : undefined
      };

      const edges = await moduleGraphService.getEdges(workspace, filters);

      res.json({
        success: true,
        edges,
        count: edges.length
      });
    } catch (error) {
      console.error('[MODULE-GRAPH] Error getting edges:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/module-graph/events
   * Get structural events with filters
   */
  app.get('/api/module-graph/events', async (req, res) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: 'Request timeout'
        });
      }
    }, 30000);

    try {
      if (!moduleGraphService) {
        clearTimeout(timeout);
        return res.status(503).json({
          success: false,
          error: 'Module graph service not available'
        });
      }

      const workspace = req.query.workspace || req.query.workspace_path || null;
      const normalizedWorkspace = workspace === 'all' ? null : workspace;
      const filters = {
        timeRange: null,
        eventType: req.query.event_type || null,
        file: req.query.file || null
      };

      if (req.query.since || req.query.until) {
        filters.timeRange = {
          since: req.query.since ? parseInt(req.query.since) : null,
          until: req.query.until ? parseInt(req.query.until) : null
        };
      }

      const events = await moduleGraphService.getEvents(normalizedWorkspace, filters);

      clearTimeout(timeout);
      res.json({
        success: true,
        events,
        count: events.length
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error('[MODULE-GRAPH] Error getting events:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error occurred'
      });
    }
  });

  /**
   * GET /api/module-graph/hierarchy
   * Get directory hierarchy
   */
  app.get('/api/module-graph/hierarchy', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;

      const hierarchy = await moduleGraphService.getHierarchy(workspace);

      res.json({
        success: true,
        hierarchy
      });
    } catch (error) {
      console.error('[MODULE-GRAPH] Error getting hierarchy:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/module-graph/refresh
   * Force refresh cache
   */
  app.post('/api/module-graph/refresh', async (req, res) => {
    try {
      const workspace = req.body.workspace || req.body.workspace_path || null;

      moduleGraphService.clearCache(workspace);

      res.json({
        success: true,
        message: 'Cache cleared'
      });
    } catch (error) {
      console.error('[MODULE-GRAPH] Error refreshing cache:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = createModuleGraphRoutes;

