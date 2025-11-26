/**
 * Core API routes - health, queue, debug
 */

function createCoreRoutes(deps) {
  const { app, db, queue, sequence, rawData, queueSystem, clipboardMonitor, queryCache, dataAccessControl } = deps;

  // Health check
  app.get('/health', (req, res) => {
    const queueStats = queueSystem.getStats();
    const clipboardStats = clipboardMonitor.getStats();
    const cacheStats = queryCache.getStats();

    // No caching for health check
    res.set('Cache-Control', 'no-cache');

    res.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      entries: db.entries.length,
      prompts: db.prompts.length,
      queue_length: queue.length,
      sequence: sequence,
      queue_stats: queueStats,
      clipboard_stats: clipboardStats,
      raw_data_stats: {
        systemResources: rawData.systemResources.length,
        gitData: rawData.gitData.status.length,
        cursorDatabase: rawData.cursorDatabase.conversations.length,
        appleScript: rawData.appleScript.appState.length,
        logs: rawData.logs.cursor.length,
      },
      cache_stats: {
        keys: queryCache.keys().length,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
      },
    });
  });

  // Get queue
  app.get('/queue', (req, res) => {
    const since = Number(req.query.since || 0);

    console.log(`[QUEUE] Queue request: since=${since}, queue_length=${queue.length}`);

    const newItems = queue.filter((item) => item.seq > since);
    const newEntries = newItems.filter((item) => item.kind === 'entry').map((item) => item.payload);
    const newEvents = newItems.filter((item) => item.kind === 'event').map((item) => item.payload);

    console.log(
      `[QUEUE] Queue response: ${newEntries.length} entries, ${newEvents.length} events since seq ${since}`
    );

    // Use all available data for comprehensive analysis
    const limitedEntries = newEntries; // No limit - use all entries
    const limitedEvents = newEvents; // No limit - use all events

    // Use full content for comprehensive analysis
    const cleanedEntries = limitedEntries.map((entry) => ({
      ...entry,
      content: entry.content || '', // Use full content
      before_code: entry.before_code || '',
      after_code: entry.after_code || '',
    }));

    const cleanedEvents = limitedEvents.map((event) => ({
      ...event,
      details: event.details ? JSON.stringify(JSON.parse(event.details || '{}')) : '{}',
    }));

    res.json({
      entries: cleanedEntries,
      events: cleanedEvents,
      cursor: sequence,
    });
  });

  // Debug endpoint to check companion service data
  app.get('/api/debug', (req, res) => {
    res.json({
      status: 'companion service running',
      timestamp: new Date().toISOString(),
      database: {
        entries: db.entries.length,
        prompts: db.prompts.length,
        sampleEntry: db.entries[0] || null,
        samplePrompt: db.prompts[0] || null,
      },
      queue: {
        length: queue.length,
        sample: queue[0] || null,
      },
    });
  });

  // Access control status endpoint
  app.get('/api/access-control/status', (req, res) => {
    if (dataAccessControl) {
      res.json({
        success: true,
        ...dataAccessControl.getStatus(),
      });
    } else {
      res.json({
        success: true,
        enabled: false,
        message: 'Data access control not initialized',
      });
    }
  });

  // Diagnostic endpoint to check capture mechanisms
  // Note: This endpoint needs to be enhanced with proper dependency injection
  // For now, it provides basic diagnostics
  app.get('/api/diagnostic/capture-status', async (req, res) => {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        capture_mechanisms: {
          file_watcher: {
            status: 'checking',
            note: 'Check file watcher service status via /health endpoint',
          },
          prompt_sync: {
            status: 'checking',
            note: 'Prompt sync runs every 30s. Check logs for sync status.',
          },
          terminal_monitor: {
            status: 'checking',
            note: 'Check terminal monitor status via /health endpoint',
          },
          clipboard_monitor: {
            status: clipboardMonitor ? (clipboardMonitor.isMonitoring ? 'active' : 'inactive') : 'not_initialized',
            enabled_in_config: clipboardMonitor?.isMonitoring || false,
          },
        },
        data_counts: {
          entries: db.entries.length,
          prompts: db.prompts.length,
          events: queue.filter(item => item.kind === 'event').length,
          queue_length: queue.length,
          sequence: sequence,
        },
        recommendations: [],
      };

      // Add recommendations based on data counts
      if (diagnostics.data_counts.prompts === 0) {
        diagnostics.recommendations.push({
          type: 'warning',
          message: 'No prompts found. Ensure Cursor database is accessible and prompt sync is running.',
          action: 'Check /api/cursor-database endpoint to verify Cursor DB access',
        });
      }

      if (diagnostics.data_counts.entries === 0) {
        diagnostics.recommendations.push({
          type: 'warning',
          message: 'No file changes captured. Ensure file watcher is running.',
          action: 'Check file watcher service status',
        });
      }

      res.json({
        success: true,
        diagnostics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack,
      });
    }
  });
}

module.exports = createCoreRoutes;
