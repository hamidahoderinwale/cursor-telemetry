/**
 * Status message API routes
 */

function createStatusRoutes(deps) {
  const { app, persistentDB } = deps;

  app.get('/api/status-messages', async (req, res) => {
    try {
      const {
        startTime = null,
        endTime = null,
        type = null,
        action = null,
        limit = parseInt(req.query.limit) || 100
      } = req.query;

      const options = {
        startTime: startTime ? parseInt(startTime) : null,
        endTime: endTime ? parseInt(endTime) : null,
        type: type || null,
        action: action || null,
        limit: parseInt(limit)
      };

      const messages = await persistentDB.getStatusMessages(options);
      
      res.json({
        success: true,
        data: messages,
        count: messages.length,
        filters: options
      });
    } catch (error) {
      console.error('Error getting status messages:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

module.exports = createStatusRoutes;

