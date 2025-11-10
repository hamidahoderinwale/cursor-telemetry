/**
 * Activity API routes
 */

function createActivityRoutes(deps) {
  const {
    app,
    persistentDB,
    sequence,
    queryCache,
    calculateDiff,
    cursorDbParser
  } = deps;

  async function withCache(key, ttl, asyncFn) {
    const cached = queryCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const result = await asyncFn();
    queryCache.set(key, result, ttl || 30);
    return result;
  }

  // API endpoint for activity data (used by dashboard) with pagination - OPTIMIZED with caching
  app.get('/api/activity', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Max 500 at a time
      const offset = parseInt(req.query.offset) || 0;
      
      // Enhanced cache control headers for cloud/CDN optimization
      // Use stale-while-revalidate pattern for better performance
      res.set('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
      res.set('ETag', `W/"activity-${sequence}-${limit}-${offset}"`);
      res.set('Vary', 'Accept-Encoding'); // Cache different versions for different encodings
      
      // Cache key based on params
      const cacheKey = `activity_${limit}_${offset}_${sequence}`;
      
      // Try to get from cache first
      const cached = await withCache(cacheKey, 30, async () => {
        //  Get total count and limited entries separately
        const totalCount = await persistentDB.getTotalEntriesCount();
        const allEntries = await persistentDB.getRecentEntries(limit + offset);
        const allPrompts = await persistentDB.getRecentPrompts(limit);
        
        // Already sorted by database query (ORDER BY timestamp DESC)
        // Apply offset/limit
        const paginatedEntries = allEntries.slice(offset, Math.min(offset + limit, allEntries.length));
        
        return { totalCount, allEntries, allPrompts, paginatedEntries };
      });
      
      const { totalCount, allEntries, allPrompts, paginatedEntries } = cached;
      
      // Convert entries to events format for dashboard compatibility
      const events = paginatedEntries.map(entry => {
        // Extract diff stats from notes field (e.g., "Diff: +172 chars")
        let diffStats = {};
        
        if (entry.notes) {
          const charsMatch = entry.notes.match(/Diff: \+(\d+) chars/);
          if (charsMatch) {
            const chars = parseInt(charsMatch[1]);
            diffStats = {
              chars_added: chars,
              chars_deleted: 0  // Notes format doesn't distinguish add/delete, just total change
            };
          }
        }
        
        // If we have full content (not loaded by default), calculate precise stats
        if (entry.before_code && entry.after_code) {
          const diff = calculateDiff(entry.before_code, entry.after_code);
          diffStats = {
            lines_added: diff.linesAdded,
            lines_removed: diff.linesRemoved,
            chars_added: diff.charsAdded,
            chars_deleted: diff.charsDeleted,
            // Truncate large content to prevent memory issues
            before_content: diff.beforeContent.length > 5000 ? diff.beforeContent.substring(0, 5000) + '\n... (truncated)' : diff.beforeContent,
            after_content: diff.afterContent.length > 5000 ? diff.afterContent.substring(0, 5000) + '\n... (truncated)' : diff.afterContent
          };
        }
        
        return {
          id: entry.id,
          type: entry.type || 'file_change',
          timestamp: entry.timestamp,
          session_id: entry.session_id || 'default',
          workspace_path: entry.workspace_path || entry.file_path || '/unknown',
          file_path: entry.file_path,
          details: JSON.stringify({
            content: entry.content ? (entry.content.length > 5000 ? entry.content.substring(0, 5000) + '\n... (truncated)' : entry.content) : null,
            before_content: entry.before_content || entry.before_code,
            after_content: entry.after_content || entry.after_code,
            diff: entry.diff,
            file_path: entry.file_path,
            workspace_path: entry.workspace_path,
            ...diffStats
          }),
          title: entry.title || `File Change: ${entry.file_path ? entry.file_path.split('/').pop() : 'Unknown'}`,
          description: entry.description || entry.notes || 'File change detected',
          // Include metadata fields for modal display
          modelInfo: entry.modelInfo,  // Model information (parsed from JSON)
          tags: entry.tags || [],  // Tags array
          prompt_id: entry.prompt_id,  // Linked prompt ID
          notes: entry.notes,  // User notes
          source: entry.source  // Source of the entry
        };
      });
      
      console.log(`[API] Returning ${events.length} of ${totalCount} activity events (offset: ${offset})`);
      res.json({
        data: events,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + events.length < totalCount
        }
      });
    } catch (error) {
      console.error('Error fetching activity data:', error);
      res.status(500).json({ error: 'Failed to fetch activity data' });
    }
  });

  // Streaming endpoint for large datasets - returns data progressively
  app.get('/api/activity/stream', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Allow more for streaming
      const offset = parseInt(req.query.offset) || 0;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.write('{"data":[');
      
      const entries = await persistentDB.getRecentEntries(limit + offset);
      const paginatedEntries = entries.slice(offset, offset + limit);
      
      let first = true;
      for (const entry of paginatedEntries) {
        if (!first) res.write(',');
        
        const event = {
          id: entry.id,
          type: entry.type || 'file_change',
          timestamp: entry.timestamp,
          session_id: entry.session_id || 'default',
          workspace_path: entry.workspace_path || entry.file_path || '/unknown',
          file_path: entry.file_path,
          title: entry.title || `File Change: ${entry.file_path ? entry.file_path.split('/').pop() : 'Unknown'}`,
          description: entry.description || entry.notes || 'File change detected',
          modelInfo: entry.modelInfo,
          tags: entry.tags || [],
          prompt_id: entry.prompt_id,
          source: entry.source
        };
        
        res.write(JSON.stringify(event));
        first = false;
        
        // Flush every 10 items for progressive loading
        if (paginatedEntries.indexOf(entry) % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      res.write('],"pagination":{');
      res.write(`"total":${entries.length},`);
      res.write(`"limit":${limit},`);
      res.write(`"offset":${offset},`);
      res.write(`"hasMore":${offset + paginatedEntries.length < entries.length}`);
      res.write('}}');
      res.end();
      
      console.log(`[STREAM] Streamed ${paginatedEntries.length} events`);
    } catch (error) {
      console.error('Error streaming activity data:', error);
      res.status(500).json({ error: 'Failed to stream activity data' });
    }
  });

  // Get entries with prompts
  app.get('/entries', async (req, res) => {
    try {
      // Use pagination - don't load everything
      const limit = Math.min(parseInt(req.query.limit) || 200, 500);
      const allPrompts = await persistentDB.getRecentPrompts(limit);
      
      // Also get prompts from Cursor database
      try {
        const cursorData = await cursorDbParser.getAllData();
        const cursorPrompts = cursorData.prompts || [];
        
        // Add Cursor database prompts to response
        const combined = [
          ...allPrompts,
          ...cursorPrompts.map(p => ({
            id: `cursor_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            timestamp: p.timestamp || new Date().toISOString(),
            text: p.text,
            status: p.status || 'captured',
            source: 'cursor-database',
            method: 'database-extraction',
            confidence: p.confidence || 'medium',
            // Include context and code change metadata
            contextUsage: p.contextUsage || 0,
            linesAdded: p.linesAdded || 0,
            linesRemoved: p.linesRemoved || 0,
            mode: p.mode,
            modelName: p.modelName,
            modelType: p.modelType,
            isAuto: p.isAuto,
            workspaceName: p.workspaceName,
            workspacePath: p.workspacePath,
            composerId: p.composerId,
            subtitle: p.subtitle,
            contextFiles: p.contextFiles
          }))
        ];
        
        res.json({ entries: combined });
      } catch (dbError) {
        console.warn('Could not extract Cursor database prompts:', dbError.message);
        res.json({ entries: allPrompts });
      }
    } catch (error) {
      console.error('Error fetching entries with prompts:', error);
      res.status(500).json({ error: 'Failed to fetch entries' });
    }
  });

  // New endpoint specifically for Cursor database data
  // Supports incremental sync via ?since=timestamp query param
  app.get('/api/cursor-database', async (req, res) => {
    try {
      const since = req.query.since ? parseInt(req.query.since) : null;
      
      // If since is provided, try to return only new data (if parser supports it)
      // For now, we'll use the cache which is updated every 5 minutes
      // This means incremental sync will work if last sync was > 5 min ago
      const data = await cursorDbParser.getAllData();
      
      // Filter prompts by timestamp if since is provided (basic incremental support)
      let filteredData = data;
      if (since && data.prompts) {
        filteredData = {
          ...data,
          prompts: data.prompts.filter(p => {
            const promptTime = p.timestamp ? new Date(p.timestamp).getTime() : 0;
            return promptTime > since;
          })
        };
        
        // If no new prompts, return early with empty result
        if (filteredData.prompts.length === 0) {
          return res.json({
            success: true,
            data: {
              conversations: [],
              prompts: [],
              stats: { totalPrompts: 0, totalConversations: 0 }
            },
            timestamp: Date.now(),
            incremental: true,
            newItems: 0
          });
        }
      }
      
      res.json({
        success: true,
        data: filteredData,
        timestamp: Date.now(),
        incremental: !!since,
        newItems: since ? filteredData.prompts.length : data.prompts.length
      });
    } catch (error) {
      console.error('Error fetching Cursor database:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
}

module.exports = createActivityRoutes;

