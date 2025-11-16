/**
 * Rung 4 API Routes
 * Endpoints for file-level abstraction (Rung 4) data
 */

function createRung4Routes(deps) {
  const { app, rung4Service } = deps;

  if (!rung4Service) {
    console.warn('[RUNG4] Rung 4 service not available, routes disabled');
    return;
  }

  console.log('[RUNG4] Registering Rung 4 routes...');

  /**
   * GET /api/rung4/graph
   * Get complete module graph
   */
  app.get('/api/rung4/graph', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;
      const forceRefresh = req.query.force_refresh === 'true';

      const graph = await rung4Service.getModuleGraph(workspace, { forceRefresh });

      res.json({
        success: true,
        graph,
        metadata: graph.metadata
      });
    } catch (error) {
      console.error('[RUNG4] Error getting module graph:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/rung4/nodes
   * Get module nodes with filters
   */
  app.get('/api/rung4/nodes', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;
      const filters = {
        type: req.query.type || null,
        lang: req.query.lang || null,
        minEdits: req.query.min_edits ? parseInt(req.query.min_edits) : undefined,
        hasModelContext: req.query.has_model_context === 'true'
      };

      const nodes = await rung4Service.getNodes(workspace, filters);

      res.json({
        success: true,
        nodes,
        count: nodes.length
      });
    } catch (error) {
      console.error('[RUNG4] Error getting nodes:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/rung4/edges
   * Get typed edges with filters
   */
  app.get('/api/rung4/edges', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;
      const filters = {
        edgeType: req.query.edge_type || null,
        source: req.query.source || null,
        target: req.query.target || null,
        minWeight: req.query.min_weight ? parseInt(req.query.min_weight) : undefined
      };

      const edges = await rung4Service.getEdges(workspace, filters);

      res.json({
        success: true,
        edges,
        count: edges.length
      });
    } catch (error) {
      console.error('[RUNG4] Error getting edges:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/rung4/events
   * Get structural events with filters
   */
  app.get('/api/rung4/events', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;
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

      const events = await rung4Service.getEvents(workspace, filters);

      res.json({
        success: true,
        events,
        count: events.length
      });
    } catch (error) {
      console.error('[RUNG4] Error getting events:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/rung4/hierarchy
   * Get directory hierarchy
   */
  app.get('/api/rung4/hierarchy', async (req, res) => {
    try {
      const workspace = req.query.workspace || req.query.workspace_path || null;

      const hierarchy = await rung4Service.getHierarchy(workspace);

      res.json({
        success: true,
        hierarchy
      });
    } catch (error) {
      console.error('[RUNG4] Error getting hierarchy:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/rung4/refresh
   * Force refresh cache
   */
  app.post('/api/rung4/refresh', async (req, res) => {
    try {
      const workspace = req.body.workspace || req.body.workspace_path || null;

      rung4Service.clearCache(workspace);

      res.json({
        success: true,
        message: 'Cache cleared'
      });
    } catch (error) {
      console.error('[RUNG4] Error refreshing cache:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = createRung4Routes;

