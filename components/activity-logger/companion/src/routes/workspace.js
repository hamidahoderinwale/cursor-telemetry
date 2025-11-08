/**
 * Workspace API routes
 */

function createWorkspaceRoutes(deps) {
  const {
    app,
    persistentDB,
    cursorDbParser,
    workspaceData,
    workspaceSessions,
    knownWorkspaces,
    entries
  } = deps;

  // Get conversations for a workspace
  app.get('/api/workspaces/:workspaceId/conversations', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      
      const conversations = await persistentDB.getConversationsByWorkspace(workspaceId, limit);
      
      res.json({
        success: true,
        data: conversations,
        count: conversations.length
      });
    } catch (error) {
      console.error('Error getting conversations:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get audit log
  app.get('/api/audit-log', async (req, res) => {
    try {
      const options = {
        workspaceId: req.query.workspaceId || null,
        operationType: req.query.operationType || null,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };
      
      const auditLog = await persistentDB.getAuditLog(options);
      
      res.json({
        success: true,
        data: auditLog,
        count: auditLog.length
      });
    } catch (error) {
      console.error('Error getting audit log:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  app.get('/api/workspaces', async (req, res) => {
    try {
      // Get ALL workspaces from Cursor (including old/stale ones)
      const allCursorWorkspaces = await cursorDbParser.getAllWorkspaces();
      
      // Get prompt data to enrich workspace info
      const cursorData = await cursorDbParser.getAllData();
      
      // Build workspace list from Cursor database first (this is the source of truth)
      const workspaces = allCursorWorkspaces.map(ws => {
        // Count prompts for this workspace
        const wsPrompts = cursorData.prompts.filter(p => p.workspaceId === ws.id);
        
        // Check if we have activity data for this workspace
        const activityData = workspaceData.get(ws.path);
        
        return {
          id: ws.id,
          path: ws.path || `Unknown (${ws.id.substring(0, 8)})`,
          name: ws.name,
          entries: activityData?.entries?.length || 0,
          events: activityData?.events?.length || 0,
          promptCount: wsPrompts.length,
          lastActivity: activityData?.lastActivity || ws.lastAccessed,
          lastAccessed: ws.lastAccessed,
          created: ws.created,
          sessionId: workspaceSessions.get(ws.path),
          active: activityData ? true : false,
          exists: ws.exists,
          fromCursorDb: true
        };
      });
      
      // Add any workspaces from knownWorkspaces that weren't in Cursor DB
      Array.from(knownWorkspaces).forEach(wsPath => {
        if (!workspaces.find(w => w.path === wsPath)) {
          const activityData = workspaceData.get(wsPath);
          workspaces.push({
            path: wsPath,
            name: wsPath.split('/').pop() || 'Unknown',
            entries: activityData?.entries?.length || 0,
            events: activityData?.events?.length || 0,
            promptCount: 0,
            lastActivity: activityData?.lastActivity || null,
            sessionId: workspaceSessions.get(wsPath),
            active: activityData ? true : false,
            exists: true,
            fromCursorDb: false
          });
        }
      });
      
      // Sort by lastActivity/lastAccessed (most recent first)
      workspaces.sort((a, b) => {
        const aTime = a.lastActivity || a.lastAccessed || 0;
        const bTime = b.lastActivity || b.lastAccessed || 0;
        return new Date(bTime) - new Date(aTime);
      });
      
      res.json(workspaces);
    } catch (error) {
      console.error('Error getting workspaces:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/workspace/:workspacePath/activity', (req, res) => {
    const { workspacePath } = req.params;
    const data = workspaceData.get(workspacePath);
    if (!data) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json({
      entries: data.entries,
      events: data.events,
      lastActivity: data.lastActivity
    });
  });

  app.get('/api/workspace/:workspacePath/sessions', (req, res) => {
    const { workspacePath } = req.params;
    const workspaceEntries = entries.filter(entry => entry.workspace_path === workspacePath);
    const sessionIds = [...new Set(workspaceEntries.map(entry => entry.session_id))];
    res.json(sessionIds);
  });
}

module.exports = createWorkspaceRoutes;

