/**
 * Sharing API routes
 * Handles workspace sharing via shareable links
 */

function createSharingRoutes(deps) {
  const {
    app,
    sharingService,
    persistentDB
  } = deps;

  /**
   * Create a shareable link for workspace data
   * POST /api/share/create
   */
  app.post('/api/share/create', async (req, res) => {
    try {
      const {
        workspaces = [],
        abstractionLevel = 1,
        filters = {},
        expirationDays = 7
      } = req.body;

      if (!workspaces || workspaces.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'At least one workspace must be specified'
        });
      }

      const shareLink = await sharingService.createShareLink({
        workspaces,
        abstractionLevel,
        filters,
        expirationDays
      });

      res.json({
        success: true,
        ...shareLink
      });
    } catch (error) {
      console.error('[SHARING] Error creating share link:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get workspace data via share link
   * GET /api/share/:shareId
   */
  app.get('/api/share/:shareId', async (req, res) => {
    try {
      const { shareId } = req.params;
      
      const shareData = await sharingService.getShareLink(shareId);
      
      if (!shareData) {
        return res.status(404).json({
          success: false,
          error: 'Share link not found or expired'
        });
      }

      // Use the export functionality to generate the data
      // Import the export handler logic (we'll need to refactor this)
      // For now, use a simplified approach - call the export endpoint internally
      const exportUrl = new URL(`${req.protocol}://${req.get('host')}/api/export/database`);
      
      // Add workspace filters
      shareData.workspaces.forEach(ws => {
        exportUrl.searchParams.append('workspace', ws);
      });

      // Add abstraction level
      if (shareData.abstractionLevel > 0) {
        exportUrl.searchParams.set('abstraction_level', shareData.abstractionLevel.toString());
      }

      // Add other filters
      if (shareData.filters.dateFrom) {
        exportUrl.searchParams.set('since', shareData.filters.dateFrom);
      }
      if (shareData.filters.dateTo) {
        exportUrl.searchParams.set('until', shareData.filters.dateTo);
      }
      if (shareData.filters.limit) {
        exportUrl.searchParams.set('limit', shareData.filters.limit.toString());
      }

      // Make internal request to export endpoint
      const http = require('http');
      const exportPath = exportUrl.pathname + exportUrl.search;
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: req.get('host').split(':')[0],
          port: req.get('host').split(':')[1] || 43917,
          path: exportPath,
          method: 'GET',
          headers: {
            'Host': req.get('host')
          }
        };
        
        const exportReq = http.request(options, (exportRes) => {
          let data = '';
          exportRes.on('data', (chunk) => { data += chunk; });
          exportRes.on('end', () => {
            try {
              const exportData = JSON.parse(data);
              res.json(exportData);
            } catch (err) {
              res.status(500).json({
                success: false,
                error: 'Failed to parse export data'
              });
            }
          });
        });
        
        exportReq.on('error', (err) => {
          res.status(500).json({
            success: false,
            error: 'Failed to fetch shared data'
          });
        });
        
        exportReq.end();
      });
      
    } catch (error) {
      console.error('[SHARING] Error getting share link:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Get share link metadata (without exporting data)
   * GET /api/share/:shareId/info
   */
  app.get('/api/share/:shareId/info', async (req, res) => {
    try {
      const { shareId } = req.params;
      
      const shareData = await sharingService.getShareLink(shareId);
      
      if (!shareData) {
        return res.status(404).json({
          success: false,
          error: 'Share link not found or expired'
        });
      }

      // Return metadata only (no access count update)
      res.json({
        success: true,
        shareId: shareData.shareId,
        workspaces: shareData.workspaces,
        abstractionLevel: shareData.abstractionLevel,
        createdAt: new Date(shareData.createdAt).toISOString(),
        expiresAt: new Date(shareData.expiresAt).toISOString(),
        isExpired: Date.now() > shareData.expiresAt
      });
    } catch (error) {
      console.error('[SHARING] Error getting share link info:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * Delete a share link
   * DELETE /api/share/:shareId
   */
  app.delete('/api/share/:shareId', async (req, res) => {
    try {
      const { shareId } = req.params;
      
      await sharingService.deleteShareLink(shareId);
      
      res.json({
        success: true,
        message: 'Share link deleted'
      });
    } catch (error) {
      console.error('[SHARING] Error deleting share link:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * List all share links (for management)
   * GET /api/share
   */
  app.get('/api/share', async (req, res) => {
    try {
      const links = await sharingService.listShareLinks();
      
      res.json({
        success: true,
        links: links.map(link => ({
          shareId: link.shareId,
          workspaces: link.workspaces,
          abstractionLevel: link.abstractionLevel,
          createdAt: new Date(link.createdAt).toISOString(),
          expiresAt: new Date(link.expiresAt).toISOString(),
          accessCount: link.accessCount,
          lastAccessed: link.lastAccessed ? new Date(link.lastAccessed).toISOString() : null,
          isExpired: Date.now() > link.expiresAt
        }))
      });
    } catch (error) {
      console.error('[SHARING] Error listing share links:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = createSharingRoutes;

