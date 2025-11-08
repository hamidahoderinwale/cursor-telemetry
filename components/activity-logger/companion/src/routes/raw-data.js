/**
 * Raw data API routes
 */

function createRawDataRoutes(deps) {
  const { app, rawData } = deps;

  app.get('/raw-data/system-resources', (req, res) => {
    const { limit = 10000, since } = req.query;
    let data = rawData.systemResources;
    
    if (since) {
      const sinceTime = parseInt(since);
      data = data.filter(item => item.timestamp >= sinceTime);
    }
    
    data = data.slice(-parseInt(limit));
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      total: rawData.systemResources.length
    });
  });

  app.get('/raw-data/git', (req, res) => {
    const { limit = 50, since } = req.query;
    let data = rawData.gitData.status;
    
    if (since) {
      const sinceTime = parseInt(since);
      data = data.filter(item => item.timestamp >= sinceTime);
    }
    
    data = data.slice(-parseInt(limit));
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      total: rawData.gitData.status.length
    });
  });

  app.get('/raw-data/cursor-database', (req, res) => {
    const { limit = 20, since } = req.query;
    let data = rawData.cursorDatabase.conversations;
    
    if (since) {
      const sinceTime = parseInt(since);
      data = data.filter(item => item.timestamp >= sinceTime);
    }
    
    data = data.slice(-parseInt(limit));
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      total: rawData.cursorDatabase.conversations.length
    });
  });

  app.get('/raw-data/apple-script', (req, res) => {
    const { limit = 10000, since } = req.query;
    let data = rawData.appleScript.appState;
    
    if (since) {
      const sinceTime = parseInt(since);
      data = data.filter(item => item.timestamp >= sinceTime);
    }
    
    data = data.slice(-parseInt(limit));
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      total: rawData.appleScript.appState.length
    });
  });

  app.get('/raw-data/logs', (req, res) => {
    const { limit = 50, since } = req.query;
    let data = rawData.logs.cursor;
    
    if (since) {
      const sinceTime = parseInt(since);
      data = data.filter(item => item.timestamp >= sinceTime);
    }
    
    data = data.slice(-parseInt(limit));
    
    res.json({
      success: true,
      data: data,
      count: data.length,
      total: rawData.logs.cursor.length
    });
  });

  app.get('/raw-data/all', (req, res) => {
    const { limit = 50, since } = req.query;
    
    const allData = {
      systemResources: rawData.systemResources.slice(-parseInt(limit)),
      gitData: rawData.gitData.status.slice(-parseInt(limit)),
      cursorDatabase: rawData.cursorDatabase.conversations.slice(-parseInt(limit)),
      appleScript: rawData.appleScript.appState.slice(-parseInt(limit)),
      logs: rawData.logs.cursor.slice(-parseInt(limit))
    };
    
    res.json({
      success: true,
      data: allData,
      counts: {
        systemResources: rawData.systemResources.length,
        gitData: rawData.gitData.status.length,
        cursorDatabase: rawData.cursorDatabase.conversations.length,
        appleScript: rawData.appleScript.appState.length,
        logs: rawData.logs.cursor.length
      }
    });
  });
}

module.exports = createRawDataRoutes;

