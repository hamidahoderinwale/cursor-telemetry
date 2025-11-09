/**
 * Export/Import API routes
 */

function createExportImportRoutes(deps) {
  const {
    app,
    persistentDB,
    db,
    abstractionEngine,
    schemaMigrations
  } = deps;

  // Streaming export handler for large datasets
  async function handleStreamingExport(req, res, options) {
    const {
      limit, includeAllFields, since, until,
      excludeEvents, excludePrompts, excludeTerminal, excludeContext,
      noCodeDiffs, noLinkedData, noTemporalChunks,
      abstractionLevel, abstractPrompts, extractPatterns
    } = options;
    
    try {
      // Set headers for streaming
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Helper function to filter by date range
      const filterByDateRange = (items) => {
        if (!since && !until) return items;
        return items.filter(item => {
          const itemTime = new Date(item.timestamp).getTime();
          if (since && itemTime < since) return false;
          if (until && itemTime > until) return false;
          return true;
        });
      };
      
      // Helper to write JSON chunk
      const writeChunk = (chunk) => {
        res.write(chunk);
      };
      
      // Helper to abstract entry if needed
      const processEntry = (entry) => {
        if (abstractionLevel > 0 && abstractionEngine) {
          return abstractionEngine.abstractEntry(entry, abstractionLevel);
        }
        return entry;
      };
      
      // Helper to abstract prompt if needed
      const processPrompt = (prompt) => {
        if (abstractionLevel > 0 && abstractionEngine) {
          return abstractionEngine.abstractPrompt(prompt, abstractionLevel);
        }
        return prompt;
      };
      
      // Calculate diff stats
      const calculateDiff = (before, after) => {
        if (!before && !after) return { linesAdded: 0, linesRemoved: 0, charsAdded: 0, charsDeleted: 0 };
        const beforeLines = (before || '').split('\n');
        const afterLines = (after || '').split('\n');
        const charsAdded = (after || '').length;
        const charsDeleted = (before || '').length;
        const linesAdded = Math.max(0, afterLines.length - beforeLines.length);
        const linesRemoved = Math.max(0, beforeLines.length - afterLines.length);
        return { linesAdded, linesRemoved, charsAdded, charsDeleted };
      };
      
      // Start writing JSON structure
      writeChunk('{\n  "success": true,\n  "data": {\n');
      
      // Get current schema version
      let schemaVersion = '1.0.0';
      try {
        const schema = await persistentDB.getSchema();
        schemaVersion = schema.version || '1.0.0';
      } catch (err) {
        console.warn('[EXPORT] Could not get schema version:', err.message);
      }

      // Write metadata first (small, can load all at once)
      const metadata = {
        exportedAt: new Date().toISOString(),
        version: '2.5',
        schema_version: schemaVersion,
        exportFormat: 'structured',
        exportLimit: limit,
        fullExport: includeAllFields,
        dateRange: {
          since: since ? new Date(since).toISOString() : null,
          until: until ? new Date(until).toISOString() : null
        },
        filters: {
          excludeEvents, excludePrompts, excludeTerminal, excludeContext,
          noCodeDiffs, noLinkedData, noTemporalChunks
        },
        streaming: true,
        organization: 'Structured format with clear sections'
      };
      writeChunk(`    "metadata": ${JSON.stringify(metadata, null, 2).split('\n').join('\n    ')},\n`);
      
      // Stream entries in batches
      if (!excludeEvents) {
        writeChunk('    "entries": [\n');
        const batchSize = 100; // Process 100 entries at a time
        let processedCount = 0;
        let firstEntry = true;
        
        // Get entries - use time range filtering if dates are provided
        let allEntries = [];
        if (since || until) {
          // Get all entries in time range at once (more efficient for date filtering)
          allEntries = await persistentDB.getEntriesInTimeRange(since || 0, until || Date.now(), null, limit);
        } else {
          // Get entries in batches
          for (let offset = 0; offset < limit; offset += batchSize) {
            const batchLimit = Math.min(batchSize, limit - offset);
            const batch = await persistentDB.getEntriesWithCode(batchLimit);
            allEntries.push(...batch);
            if (allEntries.length >= limit) break;
          }
          allEntries = allEntries.slice(0, limit);
        }
        
        // Process entries
        for (const entry of allEntries) {
          if (processedCount >= limit) break;
          
          // Apply date range filter (in case database query didn't filter perfectly)
          const itemTime = new Date(entry.timestamp).getTime();
          if (since && itemTime < since) continue;
          if (until && itemTime > until) continue;
          
          if (!firstEntry) writeChunk(',\n');
          firstEntry = false;
          
          // Enrich entry
          const diff = calculateDiff(entry.before_code || entry.before_content, entry.after_code || entry.after_content);
          const enriched = {
            ...entry,
            diff_stats: {
              lines_added: diff.linesAdded,
              lines_removed: diff.linesRemoved,
              chars_added: diff.charsAdded,
              chars_deleted: diff.charsDeleted,
              has_diff: !!(entry.before_code || entry.after_code)
            }
          };
          
          // Only include code diffs if requested
          if (noCodeDiffs) {
            enriched.before_code = '';
            enriched.after_code = '';
            enriched.before_content = '';
            enriched.after_content = '';
          }
          
          // Apply abstraction
          const processed = processEntry(enriched);
          writeChunk('      ' + JSON.stringify(processed).split('\n').join('\n      '));
          processedCount++;
          
          // Flush periodically
          if (processedCount % (batchSize * 10) === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
        
        writeChunk('\n    ],\n');
      } else {
        writeChunk('    "entries": [],\n');
      }
      
      // Stream prompts in batches
      if (!excludePrompts) {
        writeChunk('    "prompts": [\n');
        const batchSize = 100;
        let processedCount = 0;
        let firstPrompt = true;
        
        // Use time range filtering if dates are provided
        let allPrompts = [];
        if (since || until) {
          // Get all prompts in time range at once (more efficient for date filtering)
          allPrompts = await persistentDB.getPromptsInTimeRange(since || 0, until || Date.now(), limit);
        } else {
          // Get recent prompts in batches
          for (let offset = 0; offset < limit; offset += batchSize) {
            const batchLimit = Math.min(batchSize, limit - offset);
            const batch = await persistentDB.getRecentPrompts(batchLimit);
            allPrompts.push(...batch);
            if (allPrompts.length >= limit) break;
          }
          allPrompts = allPrompts.slice(0, limit);
        }
        
        // Process prompts
        for (const prompt of allPrompts) {
          if (processedCount >= limit) break;
          
          // Apply date range filter (in case database query didn't filter perfectly)
          const itemTime = new Date(prompt.timestamp).getTime();
          if (since && itemTime < since) continue;
          if (until && itemTime > until) continue;
          
          if (!firstPrompt) writeChunk(',\n');
          firstPrompt = false;
          
          const processed = processPrompt(prompt);
          writeChunk('      ' + JSON.stringify(processed).split('\n').join('\n      '));
          processedCount++;
          
          // Flush periodically
          if (processedCount % (batchSize * 10) === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        }
        
        writeChunk('\n    ],\n');
      } else {
        writeChunk('    "prompts": [],\n');
      }
      
      // Stream terminal commands (smaller, can batch)
      if (!excludeTerminal) {
        writeChunk('    "terminal_commands": [\n');
        const commands = await persistentDB.getAllTerminalCommands(Math.min(limit, 10000));
        const filteredCommands = filterByDateRange(commands);
        let firstCmd = true;
        
        for (const cmd of filteredCommands.slice(0, limit)) {
          if (!firstCmd) writeChunk(',\n');
          firstCmd = false;
          writeChunk('      ' + JSON.stringify(cmd).split('\n').join('\n      '));
        }
        
        writeChunk('\n    ],\n');
      } else {
        writeChunk('    "terminal_commands": [],\n');
      }
      
      // Context snapshots (smaller dataset)
      if (!excludeContext) {
        writeChunk('    "context_snapshots": [\n');
        const snapshots = await persistentDB.getContextSnapshots({ since: since || 0, limit: Math.min(limit, 10000) });
        const filteredSnapshots = filterByDateRange(snapshots);
        let firstSnapshot = true;
        
        for (const snapshot of filteredSnapshots.slice(0, limit)) {
          if (!firstSnapshot) writeChunk(',\n');
          firstSnapshot = false;
          writeChunk('      ' + JSON.stringify(snapshot).split('\n').join('\n      '));
        }
        
        writeChunk('\n    ],\n');
      } else {
        writeChunk('    "context_snapshots": [],\n');
      }
      
      // Context analytics (small, can load all)
      const contextAnalytics = await persistentDB.getContextAnalytics();
      writeChunk(`    "context_analytics": ${JSON.stringify(contextAnalytics).split('\n').join('\n    ')},\n`);
      
      // Workspaces (small)
      writeChunk(`    "workspaces": ${JSON.stringify(db.workspaces || []).split('\n').join('\n    ')},\n`);
      
      // Stats (computed)
      const stats = {
        sessions: 0, // Would need to compute
        fileChanges: 0,
        aiInteractions: 0,
        totalActivities: 0,
        terminalCommands: 0,
        avgContextUsage: contextAnalytics.avgContextUtilization || 0
      };
      writeChunk(`    "stats": ${JSON.stringify(stats).split('\n').join('\n    ')}\n`);
      
      // Close JSON
      writeChunk('\n  }\n}');
      
      res.end();
      console.log(`[STREAM] Streaming export completed`);
      
    } catch (error) {
      console.error('Error in streaming export:', error);
      // Try to close JSON properly on error
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message });
      } else {
        res.write(`\n  "error": "${error.message.replace(/"/g, '\\"')}"\n}`);
        res.end();
      }
    }
  }

  // Database export with streaming support
  app.get('/api/export/database', async (req, res) => {
    try {
      console.log(' Export request received');
      
      // Check if streaming is requested
      const useStreaming = req.query.stream === 'true' || req.query.streaming === 'true';
      const streamThreshold = parseInt(req.query.stream_threshold) || 5000; // Stream if > 5000 items
      
      // Parse query parameters
      const limit = parseInt(req.query.limit) || 1000;
      const includeAllFields = req.query.full === 'true';
      
      // Parse date strings - handle both ISO date strings (YYYY-MM-DD) and timestamps
      let since = null;
      let until = null;
      if (req.query.since) {
        // If it's a number, treat as timestamp; otherwise parse as date string
        if (!isNaN(req.query.since) && req.query.since.length > 10) {
          since = parseInt(req.query.since);
        } else {
          // ISO date string (YYYY-MM-DD) - convert to timestamp
          const date = new Date(req.query.since);
          since = date.getTime();
        }
      }
      if (req.query.until) {
        // If it's a number, treat as timestamp; otherwise parse as date string
        if (!isNaN(req.query.until) && req.query.until.length > 10) {
          until = parseInt(req.query.until);
        } else {
          // ISO date string (YYYY-MM-DD) - add end of day
          const date = new Date(req.query.until + 'T23:59:59.999Z');
          until = date.getTime();
        }
      }
      
      // Type filters
      const excludeEvents = req.query.exclude_events === 'true';
      const excludePrompts = req.query.exclude_prompts === 'true';
      const excludeTerminal = req.query.exclude_terminal === 'true';
      const excludeContext = req.query.exclude_context === 'true';
      
      // Options
      const noCodeDiffs = req.query.no_code_diffs === 'true';
      const noLinkedData = req.query.no_linked_data === 'true';
      const noTemporalChunks = req.query.no_temporal_chunks === 'true';
      
      // Abstraction level (new)
      const abstractionLevel = parseInt(req.query.abstraction_level || req.query.abstractionLevel || '0');
      const abstractPrompts = req.query.abstract_prompts === 'true' || req.query.abstractPrompts === 'true';
      const extractPatterns = req.query.extract_patterns === 'true' || req.query.extractPatterns === 'true';
      
      console.log(`[EXPORT] Limit: ${limit}, Since: ${since ? new Date(since).toISOString() : 'all'}, Until: ${until ? new Date(until).toISOString() : 'all'}`);
      console.log(`[EXPORT] Exclude: events=${excludeEvents}, prompts=${excludePrompts}, terminal=${excludeTerminal}, context=${excludeContext}`);
      console.log(`[EXPORT] Abstraction Level: ${abstractionLevel}, Abstract Prompts: ${abstractPrompts}, Extract Patterns: ${extractPatterns}`);
      console.log(`[EXPORT] Streaming: ${useStreaming || limit > streamThreshold} (threshold: ${streamThreshold})`);
      
      // Use streaming for large exports or if explicitly requested
      if (useStreaming || limit > streamThreshold) {
        return handleStreamingExport(req, res, {
          limit, includeAllFields, since, until,
          excludeEvents, excludePrompts, excludeTerminal, excludeContext,
          noCodeDiffs, noLinkedData, noTemporalChunks,
          abstractionLevel, abstractPrompts, extractPatterns
        });
      }
      
      // Helper function to filter by date range
      const filterByDateRange = (items) => {
        if (!since && !until) return items;
        return items.filter(item => {
          const itemTime = new Date(item.timestamp).getTime();
          if (since && itemTime < since) return false;
          if (until && itemTime > until) return false;
          return true;
        });
      };
      
      // Gather data from database with limits and filters
      const promises = [];
      
      if (!excludeEvents) {
        // Use time range filtering if dates are provided, otherwise get entries with code
        if (since || until) {
          promises.push(persistentDB.getEntriesInTimeRange(since || 0, until || Date.now(), null, Math.min(limit, 10000)));
        } else {
          promises.push(persistentDB.getEntriesWithCode(Math.min(limit, 10000)));
        }
      } else {
        promises.push(Promise.resolve([]));
      }
      
      if (!excludePrompts) {
        // Use time range filtering if dates are provided, otherwise get recent prompts
        if (since || until) {
          promises.push(persistentDB.getPromptsInTimeRange(since || 0, until || Date.now(), Math.min(limit, 10000)));
        } else {
          promises.push(persistentDB.getRecentPrompts(Math.min(limit, 10000)));
        }
      } else {
        promises.push(Promise.resolve([]));
      }
      
      if (!excludeEvents) {
        promises.push(persistentDB.getAllEvents());
      } else {
        promises.push(Promise.resolve([]));
      }
      
      if (!excludeTerminal) {
        promises.push(persistentDB.getAllTerminalCommands(Math.min(limit, 10000)));
      } else {
        promises.push(Promise.resolve([]));
      }
      
      if (!excludeContext) {
        promises.push(persistentDB.getContextSnapshots({ since: since || 0, limit: Math.min(limit, 10000) }));
      } else {
        promises.push(Promise.resolve([]));
      }
      
      promises.push(persistentDB.getContextAnalytics());
      
      const [entries, prompts, events, terminalCommands, contextSnapshots, contextAnalytics] = await Promise.all(promises);
      
      // Apply date range filtering
      const filteredEntries = filterByDateRange(entries);
      const filteredPrompts = filterByDateRange(prompts);
      const filteredEvents = filterByDateRange(events);
      const filteredTerminalCommands = filterByDateRange(terminalCommands);
      const filteredContextSnapshots = filterByDateRange(contextSnapshots);
      
      // Calculate diff stats for entries with code
      const calculateDiff = (before, after) => {
        if (!before && !after) return { linesAdded: 0, linesRemoved: 0, charsAdded: 0, charsDeleted: 0 };
        const beforeLines = (before || '').split('\n');
        const afterLines = (after || '').split('\n');
        const charsAdded = (after || '').length;
        const charsDeleted = (before || '').length;
        // Simple diff: compare line counts
        const linesAdded = Math.max(0, afterLines.length - beforeLines.length);
        const linesRemoved = Math.max(0, beforeLines.length - afterLines.length);
        return { linesAdded, linesRemoved, charsAdded, charsDeleted };
      };
      
      // Enrich entries with diff stats and ensure code diffs are included
      const enrichedEntries = filteredEntries.map(entry => {
        const diff = calculateDiff(entry.before_code || entry.before_content, entry.after_code || entry.after_content);
        const enriched = {
          ...entry,
          // Add computed diff stats
          diff_stats: {
            lines_added: diff.linesAdded,
            lines_removed: diff.linesRemoved,
            chars_added: diff.charsAdded,
            chars_deleted: diff.charsDeleted,
            has_diff: !!(entry.before_code || entry.after_code)
          }
        };
        
        // Only include code diffs if requested
        if (!noCodeDiffs) {
          enriched.before_code = entry.before_code || entry.before_content || '';
          enriched.after_code = entry.after_code || entry.after_content || '';
          enriched.before_content = entry.before_code || entry.before_content || '';
          enriched.after_content = entry.after_code || entry.after_content || '';
        } else {
          // Remove code content but keep metadata
          enriched.before_code = '';
          enriched.after_code = '';
          enriched.before_content = '';
          enriched.after_content = '';
        }
        
        return enriched;
      });
      
      // Create linked data structure: group prompts with their code changes
      const linkedData = [];
      const unlinkedEntries = [];
      const unlinkedPrompts = [];
      
      // Build lookup maps for fast access
      const promptMap = new Map(filteredPrompts.map(p => [p.id, p]));
      const entryMap = new Map(enrichedEntries.map(e => [e.id, e]));
      
      // Only build linked data if requested
      if (!noLinkedData) {
        // Group linked prompts and entries
        enrichedEntries.forEach(entry => {
          if (entry.prompt_id) {
            const prompt = promptMap.get(entry.prompt_id);
            if (prompt) {
              linkedData.push({
                type: 'prompt_with_code_change',
                prompt: prompt,
                code_change: entry,
                linked_at: entry.timestamp,
                relationship: {
                  prompt_id: prompt.id,
                  entry_id: entry.id,
                  link_type: 'entry_to_prompt'
                }
              });
            } else {
              unlinkedEntries.push(entry);
            }
          } else {
            unlinkedEntries.push(entry);
          }
        });
        
        // Add prompts that link to entries (reverse direction)
        filteredPrompts.forEach(prompt => {
          if (prompt.linked_entry_id || prompt.linkedEntryId) {
            const entryId = prompt.linked_entry_id || prompt.linkedEntryId;
            const entry = entryMap.get(entryId);
            // Only add if not already in linkedData
            const alreadyLinked = linkedData.some(link => 
              link.prompt.id === prompt.id && link.code_change.id === entryId
            );
            if (entry && !alreadyLinked) {
              linkedData.push({
                type: 'prompt_with_code_change',
                prompt: prompt,
                code_change: entry,
                linked_at: prompt.timestamp,
                relationship: {
                  prompt_id: prompt.id,
                  entry_id: entry.id,
                  link_type: 'prompt_to_entry'
                }
              });
            }
          } else if (!linkedData.some(link => link.prompt.id === prompt.id)) {
            unlinkedPrompts.push(prompt);
          }
        });
      } else {
        // If no linked data requested, mark all as unlinked
        enrichedEntries.forEach(entry => {
          if (!entry.prompt_id) {
            unlinkedEntries.push(entry);
          }
        });
        filteredPrompts.forEach(prompt => {
          if (!prompt.linked_entry_id && !prompt.linkedEntryId) {
            unlinkedPrompts.push(prompt);
          }
        });
      }
      
      // Sort linked data by timestamp
      linkedData.sort((a, b) => new Date(b.linked_at) - new Date(a.linked_at));
      
      // ============================================
      // NEW: Create temporal chunks/sessions
      // Groups prompts, code changes, and metadata by time proximity
      // ============================================
      const temporalChunks = [];
      const timeWindowMs = 5 * 60 * 1000; // 5 minutes
      
      // Combine all items with timestamps for temporal grouping
      const allTemporalItems = [
        ...enrichedEntries.map(e => ({
          type: 'code_change',
          item: e,
          timestamp: new Date(e.timestamp).getTime(),
          file_path: e.file_path,
          workspace_path: e.workspace_path,
          model_info: e.modelInfo || null,
          diff_stats: e.diff_stats,
          before_code: e.before_code,
          after_code: e.after_code,
          prompt_id: e.prompt_id,
          metadata: {
            source: e.source,
            session_id: e.session_id,
            tags: e.tags || [],
            notes: e.notes,
            type: e.type
          }
        })),
        ...filteredPrompts.map(p => ({
          type: 'prompt',
          item: p,
          timestamp: new Date(p.timestamp).getTime(),
          file_path: null, // Prompts don't have file_path directly
          workspace_path: p.workspace_path,
          model_info: {
            model_type: p.model_type || p.modelType,
            model_name: p.model_name || p.modelName
          },
          diff_stats: null,
          before_code: null,
          after_code: null,
          prompt_id: p.id,
          metadata: {
            source: p.source,
            mode: p.mode,
            workspace_id: p.workspace_id,
            workspace_name: p.workspace_name,
            composer_id: p.composer_id,
            context_usage: p.context_usage || p.contextUsage,
            context_file_count: p.context_file_count || p.contextFileCount,
            lines_added: p.lines_added || p.linesAdded,
            lines_removed: p.lines_removed || p.linesRemoved,
            conversation_title: p.conversation_title || p.conversationTitle,
            message_role: p.message_role || p.messageRole,
            thinking_time: p.thinking_time || p.thinkingTime
          }
        })),
        ...filteredTerminalCommands.map(cmd => ({
          type: 'terminal_command',
          item: cmd,
          timestamp: new Date(cmd.timestamp).getTime(),
          file_path: null,
          workspace_path: cmd.workspace,
          model_info: null,
          diff_stats: null,
          before_code: null,
          after_code: null,
          prompt_id: null,
          metadata: {
            command: cmd.command,
            exit_code: cmd.exit_code,
            shell: cmd.shell,
            source: cmd.source,
            duration: cmd.duration,
            linked_entry_id: cmd.linked_entry_id,
            linked_prompt_id: cmd.linked_prompt_id
          }
        }))
      ].filter(item => item.timestamp > 0); // Filter invalid timestamps
      
      // Sort by timestamp
      allTemporalItems.sort((a, b) => a.timestamp - b.timestamp);
      
      // Group into temporal chunks
      let currentChunk = null;
      allTemporalItems.forEach(item => {
        if (!currentChunk || (item.timestamp - currentChunk.end_time) > timeWindowMs) {
          // Start new chunk
          if (currentChunk) {
            temporalChunks.push(currentChunk);
          }
          currentChunk = {
            id: `chunk-${item.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            start_time: item.timestamp,
            end_time: item.timestamp,
            duration_seconds: 0,
            workspace_paths: new Set(),
            files_changed: new Set(),
            models_used: new Set(),
            items: [],
            summary: {
              prompts: 0,
              code_changes: 0,
              terminal_commands: 0,
              total_lines_added: 0,
              total_lines_removed: 0,
              total_chars_added: 0,
              total_chars_deleted: 0
            }
          };
        }
        
        // Add item to current chunk
        currentChunk.items.push(item);
        currentChunk.end_time = Math.max(currentChunk.end_time, item.timestamp);
        currentChunk.duration_seconds = Math.round((currentChunk.end_time - currentChunk.start_time) / 1000);
        
        // Track workspace
        if (item.workspace_path) {
          currentChunk.workspace_paths.add(item.workspace_path);
        }
        
        // Track files
        if (item.file_path) {
          currentChunk.files_changed.add(item.file_path);
        }
        
        // Track models
        if (item.model_info) {
          const modelName = item.model_info.model_name || item.model_info.modelName;
          const modelType = item.model_info.model_type || item.model_info.modelType;
          if (modelName || modelType) {
            currentChunk.models_used.add(modelType && modelName ? `${modelType}/${modelName}` : (modelName || modelType || 'Unknown'));
          }
        }
        
        // Update summary
        if (item.type === 'prompt') currentChunk.summary.prompts++;
        if (item.type === 'code_change') {
          currentChunk.summary.code_changes++;
          if (item.diff_stats) {
            currentChunk.summary.total_lines_added += item.diff_stats.lines_added || 0;
            currentChunk.summary.total_lines_removed += item.diff_stats.lines_removed || 0;
            currentChunk.summary.total_chars_added += item.diff_stats.chars_added || 0;
            currentChunk.summary.total_chars_deleted += item.diff_stats.chars_deleted || 0;
          }
        }
        if (item.type === 'terminal_command') currentChunk.summary.terminal_commands++;
      });
      
      // Add final chunk
      if (currentChunk) {
        temporalChunks.push(currentChunk);
      }
      
      // Convert Sets to Arrays for JSON serialization and add linked relationships
      const enrichedChunks = temporalChunks.map(chunk => {
        // Find linked relationships within this chunk
        const relationships = [];
        chunk.items.forEach(item => {
          if (item.type === 'code_change' && item.prompt_id) {
            const linkedPrompt = chunk.items.find(i => i.type === 'prompt' && i.prompt_id === item.prompt_id);
            if (linkedPrompt) {
              relationships.push({
                type: 'prompt_to_code',
                prompt_id: item.prompt_id,
                code_change_id: item.item.id,
                time_gap_seconds: Math.abs((item.timestamp - linkedPrompt.timestamp) / 1000)
              });
            }
          }
        });
        
        return {
          ...chunk,
          start_time: new Date(chunk.start_time).toISOString(),
          end_time: new Date(chunk.end_time).toISOString(),
          workspace_paths: Array.from(chunk.workspace_paths),
          files_changed: Array.from(chunk.files_changed),
          models_used: Array.from(chunk.models_used),
          relationships: relationships,
          // Include full items with all metadata
          items: chunk.items.map(i => ({
            type: i.type,
            id: i.item.id,
            timestamp: new Date(i.timestamp).toISOString(),
            // Code change metadata
            ...(i.type === 'code_change' ? {
              file_path: i.file_path,
              before_code: i.before_code,
              after_code: i.after_code,
              diff_stats: i.diff_stats,
              model_info: i.model_info,
              prompt_id: i.prompt_id,
              metadata: i.metadata
            } : {}),
            // Prompt metadata
            ...(i.type === 'prompt' ? {
              text: i.item.text || i.item.prompt || i.item.content,
              workspace_path: i.workspace_path,
              model_info: i.model_info,
              metadata: i.metadata
            } : {}),
            // Terminal command metadata
            ...(i.type === 'terminal_command' ? {
              command: i.metadata.command,
              workspace_path: i.workspace_path,
              exit_code: i.metadata.exit_code,
              metadata: i.metadata
            } : {})
          }))
        };
      });
      
      // Get current schema version
      let schemaVersion = '1.0.0';
      try {
        const schema = await persistentDB.getSchema();
        schemaVersion = schema.version || '1.0.0';
      } catch (err) {
        console.warn('[EXPORT] Could not get schema version:', err.message);
      }

      // Get in-memory data with improved, organized structure
      const exportData = {
        // ============================================
        // METADATA SECTION - Export information and configuration
        // ============================================
        metadata: {
          // Export identification
          exportedAt: new Date().toISOString(),
          version: '2.5',  // Bumped for better organization
          schema_version: schemaVersion,
          exportFormat: 'structured', // 'structured' or 'flat' (for backward compatibility)
          
          // Export configuration
          exportLimit: limit,
          fullExport: includeAllFields,
          dateRange: {
            since: since ? new Date(since).toISOString() : null,
            until: until ? new Date(until).toISOString() : null
          },
          filters: {
            excludeEvents,
            excludePrompts,
            excludeTerminal,
            excludeContext,
            noCodeDiffs,
            noLinkedData,
            noTemporalChunks
          },
          
          // Data counts (quick reference)
          counts: {
            entries: enrichedEntries.length,
            prompts: filteredPrompts.length,
            events: filteredEvents.length,
            terminalCommands: filteredTerminalCommands.length,
            contextSnapshots: filteredContextSnapshots.length,
            linkedPairs: linkedData.length,
            temporalChunks: noTemporalChunks ? 0 : enrichedChunks.length,
            workspaces: (db.workspaces || []).length
          },
          
          // Export notes
          note: limit < 10000 ? 'Limited export - use ?limit=10000 for more data' : 'Full export',
          organization: 'Structured format with clear sections for easy navigation'
        },
        
        // ============================================
        // CORE DATA SECTION - Primary data arrays
        // Organized by data type for easy access
        // ============================================
        data: {
          // File/Code changes (entries)
          codeChanges: enrichedEntries.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            file_path: e.file_path || e.filePath,
            workspace_path: e.workspace_path || e.workspacePath,
            type: e.type || 'file_change',
            source: e.source,
            session_id: e.session_id || e.sessionId,
            prompt_id: e.prompt_id || e.promptId, // Link to prompt if available
            diff_stats: e.diff_stats,
            // Code content (only if not excluded)
            ...(noCodeDiffs ? {} : {
              before_code: e.before_code || e.before_content || '',
              after_code: e.after_code || e.after_content || ''
            }),
            // Additional metadata
            tags: e.tags || [],
            notes: e.notes,
            modelInfo: e.modelInfo || e.model_info
          })),
          
          // AI Prompts
          prompts: filteredPrompts.map(p => ({
            id: p.id,
            timestamp: p.timestamp,
            text: p.text || p.prompt || p.content || p.preview || '',
            workspace_path: p.workspace_path || p.workspacePath,
            workspace_id: p.workspace_id || p.workspaceId,
            source: p.source || 'cursor',
            mode: p.mode,
            linked_entry_id: p.linked_entry_id || p.linkedEntryId, // Link to code change if available
            // Model information
            model_type: p.model_type || p.modelType,
            model_name: p.model_name || p.modelName,
            // Context information
            context_usage: p.context_usage || p.contextUsage || 0,
            context_file_count: p.context_file_count || p.contextFileCount || 0,
            // Conversation metadata
            conversation_id: p.conversation_id || p.conversationId,
            conversation_title: p.conversation_title || p.conversationTitle,
            message_role: p.message_role || p.messageRole,
            // Additional metadata
            lines_added: p.lines_added || p.linesAdded || 0,
            lines_removed: p.lines_removed || p.linesRemoved || 0,
            thinking_time: p.thinking_time || p.thinkingTime,
            composer_id: p.composer_id || p.composerId
          })),
          
          // Activity Events (general activity tracking)
          events: filteredEvents.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            type: e.type || 'activity',
            workspace_path: e.workspace_path || e.workspacePath,
            session_id: e.session_id || e.sessionId,
            details: e.details || {}
          })),
          
          // Terminal Commands
          terminalCommands: filteredTerminalCommands.map(cmd => ({
            id: cmd.id,
            timestamp: cmd.timestamp,
            command: cmd.command,
            workspace: cmd.workspace || cmd.workspace_path,
            shell: cmd.shell,
            source: cmd.source,
            exit_code: cmd.exit_code || cmd.exitCode,
            duration: cmd.duration,
            output: cmd.output,
            error: cmd.error,
            linked_entry_id: cmd.linked_entry_id || cmd.linkedEntryId,
            linked_prompt_id: cmd.linked_prompt_id || cmd.linkedPromptId
          })),
          
          // Context Snapshots
          contextSnapshots: filteredContextSnapshots.map(snapshot => ({
            id: snapshot.id,
            timestamp: snapshot.timestamp,
            prompt_id: snapshot.prompt_id || snapshot.promptId,
            file_count: snapshot.current_file_count || snapshot.currentFileCount || 0,
            added_files: snapshot.addedFiles || [],
            removed_files: snapshot.removedFiles || [],
            net_change: snapshot.netChange || 0
          }))
        },
        
        // ============================================
        // RELATIONSHIPS SECTION - How data connects
        // ============================================
        relationships: {
          // Explicit prompt-to-code links (when prompt_id is set)
          linkedPairs: noLinkedData ? [] : linkedData.map(link => ({
            prompt_id: link.prompt.id,
            code_change_id: link.code_change.id,
            linked_at: link.linked_at,
            relationship_type: link.relationship.link_type,
            // Quick reference (not full objects to avoid duplication)
            prompt_timestamp: link.prompt.timestamp,
            code_change_timestamp: link.code_change.timestamp,
            time_gap_seconds: Math.abs(
              (new Date(link.code_change.timestamp).getTime() - 
               new Date(link.prompt.timestamp).getTime()) / 1000
            )
          })),
          
          // Items without explicit links (for analysis)
          unlinked: {
            codeChanges: unlinkedEntries.filter(e => !e.prompt_id).map(e => e.id),
            prompts: unlinkedPrompts.map(p => p.id),
            note: 'These items have no explicit prompt_id/linked_entry_id links. They may be related by timestamp proximity in temporal_chunks.'
          }
        },
        
        // ============================================
        // TEMPORAL ORGANIZATION - Time-grouped activity
        // Groups related activity by time windows
        // ============================================
        ...(noTemporalChunks ? {} : {
          temporalChunks: enrichedChunks.map(chunk => ({
            id: chunk.id,
            start_time: chunk.start_time,
            end_time: chunk.end_time,
            duration_seconds: chunk.duration_seconds,
            // Summary statistics
            summary: chunk.summary,
            // Workspaces involved
            workspaces: chunk.workspace_paths,
            // Files changed
            files_changed: chunk.files_changed,
            // Models used
            models_used: chunk.models_used,
            // Relationships within chunk
            relationships: chunk.relationships,
            // Item references (IDs only to avoid duplication)
            item_ids: chunk.items.map(i => ({
              type: i.type,
              id: i.id,
              timestamp: i.timestamp
            }))
          }))
        }),
        
        // ============================================
        // ANALYTICS & STATISTICS SECTION
        // ============================================
        analytics: {
          // Context analytics
          context: contextAnalytics,
          
          // Overall statistics
          statistics: {
            totalSessions: enrichedEntries.length,
            totalFileChanges: enrichedEntries.length,
            totalAIPrompts: filteredPrompts.length,
            totalEvents: filteredEvents.length,
            totalTerminalCommands: filteredTerminalCommands.length,
            avgContextUsage: contextAnalytics.avgContextUtilization || 0,
            linkingRate: enrichedEntries.length > 0 
              ? ((linkedData.length / enrichedEntries.length) * 100).toFixed(1) + '%'
              : '0%',
            linkedPairs: linkedData.length
          },
          
          // Workspace information
          workspaces: (db.workspaces || []).map(ws => ({
            path: ws,
            name: ws.split('/').pop() || ws
          }))
        },
        
        // ============================================
        // BACKWARD COMPATIBILITY SECTION
        // Flat arrays for legacy code that expects them
        // ============================================
        _legacy: {
          entries: enrichedEntries,
          prompts: filteredPrompts,
          events: filteredEvents,
          terminal_commands: filteredTerminalCommands,
          context_snapshots: filteredContextSnapshots,
          linked_data: noLinkedData ? [] : linkedData,
          temporal_chunks: noTemporalChunks ? [] : enrichedChunks,
          workspaces: db.workspaces || [],
          context_analytics: contextAnalytics,
          unlinked: {
            entries: unlinkedEntries.filter(e => !e.prompt_id),
            prompts: unlinkedPrompts
          },
          stats: {
            sessions: enrichedEntries.length,
            fileChanges: enrichedEntries.length,
            aiInteractions: filteredPrompts.length,
            totalActivities: filteredEvents.length,
            terminalCommands: filteredTerminalCommands.length,
            avgContextUsage: contextAnalytics.avgContextUtilization || 0,
            linkedPairs: linkedData.length,
            linkingRate: enrichedEntries.length > 0 
              ? ((linkedData.length / enrichedEntries.length) * 100).toFixed(1) + '%'
              : '0%'
          }
        }
      };
      
      // Apply abstraction if level > 0
      let finalExportData = exportData;
      if (abstractionLevel > 0) {
        console.log(`[ABSTRACTION] Applying level ${abstractionLevel} abstraction...`);
        finalExportData = abstractionEngine.abstractExportData(exportData, abstractionLevel, {
          abstractPrompts: abstractPrompts || abstractionLevel >= 2,
          extractPatterns: extractPatterns || abstractionLevel >= 3
        });
        console.log(`[ABSTRACTION] Abstraction applied successfully`);
      }
      
      console.log(`[SUCCESS] Exported ${enrichedEntries.length} entries (${linkedData.length} linked to prompts), ${filteredPrompts.length} prompts, ${filteredEvents.length} events, ${filteredTerminalCommands.length} terminal commands, ${filteredContextSnapshots.length} context snapshots`);
      
      res.json({
        success: true,
        schema_version: schemaVersion,
        data: finalExportData
      });
      
    } catch (error) {
      console.error('Error exporting database:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Database import/redeploy endpoint - restore exported data
  app.post('/api/import/database', async (req, res) => {
    try {
      console.log('[IMPORT] Import request received');
      
      const importData = req.body;
      
      // Validate import data structure
      if (!importData || !importData.data) {
        return res.status(400).json({
          success: false,
          error: 'Invalid import data: missing "data" field'
        });
      }
      
      const data = importData.data;
      const options = req.body.options || {};
      const {
        overwrite = false,  // If true, overwrite existing records; if false, skip duplicates
        skipLinkedData = false,  // Skip linked_data and temporal_chunks if present
        dryRun = false,  // If true, validate but don't import
        workspaceFilter = null,  // If set, only import data for this workspace
        mergeStrategy = 'skip',  // 'skip', 'overwrite', 'merge', 'append'
        workspaceMappings = {}  // Map imported workspace paths to local paths
      } = options;
      
      // Normalize data structure - handle both new structured format and legacy format
      let normalizedData = data;
      if (data.data && data.metadata) {
        // New structured format (v2.5+)
        console.log('[IMPORT] Detected structured export format');
        normalizedData = {
          // Use structured data section
          entries: data.data.codeChanges || [],
          prompts: data.data.prompts || [],
          events: data.data.events || [],
          terminal_commands: data.data.terminalCommands || [],
          context_snapshots: data.data.contextSnapshots || [],
          // Fall back to legacy if structured is empty
          ...(data._legacy || {}),
          // Preserve other sections
          workspaces: data.analytics?.workspaces?.map(w => w.path) || data.workspaces || [],
          context_analytics: data.analytics?.context || data.context_analytics
        };
      } else if (data.entries || data.prompts) {
        // Legacy format (v2.4 and earlier) - use as-is
        console.log('[IMPORT] Detected legacy export format');
        normalizedData = data;
      }
      
      // Helper to apply workspace mappings
      const mapWorkspace = (workspacePath) => {
        if (!workspacePath) return workspacePath;
        return workspaceMappings[workspacePath] || workspacePath;
      };

      // Get current schema for schema version comparison
      let currentSchema = null;
      let currentSchemaVersion = '1.0.0';
      try {
        currentSchema = await persistentDB.getSchema();
        currentSchemaVersion = currentSchema.version || '1.0.0';
      } catch (err) {
        console.warn('[IMPORT] Could not load current schema:', err.message);
      }

      // Detect import schema version
      const importSchemaVersion = 
        importData.schema_version || 
        importData.metadata?.schema_version || 
        data.metadata?.schema_version || 
        '1.0.0';
      
      console.log(`[IMPORT] Schema versions - Import: ${importSchemaVersion}, Current: ${currentSchemaVersion}`);
      
      // Schema compatibility check and migration
      const schemaCompatible = importSchemaVersion === currentSchemaVersion;
      if (!schemaCompatible) {
        console.log(`[IMPORT] Schema version mismatch detected - will normalize data during import`);
        
        // Run migrations if needed (migrate to current version)
        if (!dryRun) {
          try {
            const migrationResult = await schemaMigrations.migrate();
            if (migrationResult.migrations.length > 0) {
              console.log(`[IMPORT] Schema migrations completed: ${migrationResult.migrations.length} migration(s) applied`);
            }
          } catch (migrationErr) {
            console.warn(`[IMPORT] Schema migration warning:`, migrationErr.message);
          }
        }
        
        // Normalize data structure
        try {
          const normalizedData = await schemaMigrations.normalizeData(data, importSchemaVersion, currentSchemaVersion);
          Object.assign(data, normalizedData);
        } catch (normalizeErr) {
          console.warn(`[IMPORT] Data normalization warning:`, normalizeErr.message);
        }
      }
      
      // Log audit event for import start
      if (!dryRun) {
        await persistentDB.logAuditEvent('Import started', 'import', {
          workspaceId: workspaceFilter,
          importVersion: importSchemaVersion,
          currentVersion: currentSchemaVersion,
          mergeStrategy,
          overwrite,
          status: 'in_progress'
        }).catch(err => console.warn('[IMPORT] Could not log audit event:', err.message));
      }
      
      const stats = {
        entries: { imported: 0, skipped: 0, errors: 0 },
        prompts: { imported: 0, skipped: 0, errors: 0 },
        events: { imported: 0, skipped: 0, errors: 0 },
        terminalCommands: { imported: 0, skipped: 0, errors: 0 },
        contextSnapshots: { imported: 0, skipped: 0, errors: 0 },
        workspaces: { imported: 0, skipped: 0, errors: 0 }
      };
      
      // Helper to check if record exists and apply merge strategy
      const shouldImport = async (table, item) => {
        if (mergeStrategy === 'append') return true; // Always import with append
        
        // Filter by workspace if specified
        if (workspaceFilter) {
          const itemWorkspace = item.workspaceId || item.workspace_id || item.workspace_path || item.workspacePath;
          if (itemWorkspace && !itemWorkspace.includes(workspaceFilter) && !workspaceFilter.includes(itemWorkspace)) {
            return false; // Skip items not matching workspace filter
          }
        }
        
        try {
          let existing = null;
          if (table === 'entries') {
            existing = await persistentDB.getEntryById(item.id);
          } else if (table === 'prompts') {
            existing = await persistentDB.getPromptById(item.id);
          }
          
          if (!existing) return true; // New item, import it
          
          // Item exists, apply merge strategy
          if (mergeStrategy === 'skip' || (!overwrite && mergeStrategy !== 'overwrite' && mergeStrategy !== 'merge')) {
            return false; // Skip existing
          } else if (mergeStrategy === 'overwrite' || overwrite) {
            return true; // Overwrite existing
          } else if (mergeStrategy === 'merge') {
            // Merge: combine data, prefer existing for conflicts
            Object.assign(item, existing, item);
            return true;
          }
          
          return false;
        } catch (err) {
          return true; // On error, try to import
        }
      };
      
      // Import entries
      if (data.entries && Array.isArray(data.entries)) {
        console.log(`[IMPORT] Processing ${data.entries.length} entries...`);
        
        for (const entry of data.entries) {
          try {
            if (!dryRun) {
              const shouldImportEntry = await shouldImport('entries', entry);
              if (!shouldImportEntry) {
                stats.entries.skipped++;
                continue;
              }
              
              // Normalize entry data
              const originalWorkspace = entry.workspace_path || entry.workspacePath;
              const normalizedEntry = {
                id: entry.id,
                session_id: entry.session_id || entry.sessionId,
                workspace_path: mapWorkspace(originalWorkspace),
                file_path: entry.file_path || entry.filePath,
                source: entry.source || 'imported',
                before_code: entry.before_code || entry.beforeCode || entry.before_content,
                after_code: entry.after_code || entry.afterCode || entry.after_content,
                notes: entry.notes || entry.description,
                timestamp: entry.timestamp,
                tags: entry.tags,
                prompt_id: entry.prompt_id || entry.promptId,
                modelInfo: entry.modelInfo || entry.model_info,
                type: entry.type || 'file_change'
              };
              
              await persistentDB.saveEntry(normalizedEntry);
              stats.entries.imported++;
            } else {
              stats.entries.imported++; // Count in dry run
            }
          } catch (error) {
            console.error(`[IMPORT] Error importing entry ${entry.id}:`, error.message);
            stats.entries.errors++;
          }
        }
      }
      
      // Import prompts
      if (data.prompts && Array.isArray(data.prompts)) {
        console.log(`[IMPORT] Processing ${data.prompts.length} prompts...`);
        
        for (const prompt of data.prompts) {
          try {
            if (!dryRun) {
              const shouldImportPrompt = await shouldImport('prompts', prompt);
              if (!shouldImportPrompt) {
                stats.prompts.skipped++;
                continue;
              }
              
              // Normalize prompt data
              const originalPromptWorkspace = prompt.workspace_path || prompt.workspacePath || prompt.workspaceId;
              const normalizedPrompt = {
                id: prompt.id,
                timestamp: prompt.timestamp,
                text: prompt.text || prompt.prompt || prompt.preview || prompt.content,
                status: prompt.status || 'captured',
                workspace_path: mapWorkspace(originalPromptWorkspace),
                workspace_id: mapWorkspace(originalPromptWorkspace),
                linked_entry_id: prompt.linked_entry_id || prompt.linkedEntryId,
                source: prompt.source || 'imported',
                workspaceId: prompt.workspaceId || prompt.workspace_id,
                workspacePath: prompt.workspacePath || prompt.workspace_path,
                workspaceName: prompt.workspaceName || prompt.workspace_name,
                composerId: prompt.composerId || prompt.composer_id,
                subtitle: prompt.subtitle,
                linesAdded: prompt.linesAdded || prompt.lines_added || 0,
                linesRemoved: prompt.linesRemoved || prompt.lines_removed || 0,
                contextUsage: prompt.contextUsage || prompt.context_usage || 0,
                mode: prompt.mode,
                modelType: prompt.modelType || prompt.model_type,
                modelName: prompt.modelName || prompt.model_name,
                forceMode: prompt.forceMode || prompt.force_mode,
                isAuto: prompt.isAuto || prompt.is_auto || false,
                type: prompt.type,
                confidence: prompt.confidence,
                added_from_database: false, // Mark as imported, not from Cursor DB
                contextFiles: prompt.contextFiles || prompt.context_files,
                terminalBlocks: prompt.terminalBlocks || prompt.terminal_blocks,
                thinkingTime: prompt.thinkingTime || prompt.thinking_time,
                thinkingTimeSeconds: prompt.thinkingTimeSeconds || prompt.thinking_time_seconds,
                hasAttachments: prompt.hasAttachments || prompt.has_attachments || false,
                attachmentCount: prompt.attachmentCount || prompt.attachment_count || 0,
                conversationTitle: prompt.conversationTitle || prompt.conversation_title,
                messageRole: prompt.messageRole || prompt.message_role,
                parentConversationId: prompt.parentConversationId || prompt.parent_conversation_id,
                conversationId: prompt.conversationId || prompt.composerId || prompt.parentConversationId,
                conversationIndex: prompt.conversationIndex || prompt.conversation_index
              };
              
              // Update conversation metadata if conversation_id is set
              if (normalizedPrompt.conversationId && normalizedPrompt.workspaceId) {
                await persistentDB.updateConversationMetadata(
                  normalizedPrompt.conversationId,
                  normalizedPrompt.workspaceId,
                  normalizedPrompt.workspacePath,
                  normalizedPrompt.conversationTitle
                ).catch(err => console.warn('[IMPORT] Could not update conversation:', err.message));
              }
              
              await persistentDB.savePrompt(normalizedPrompt);
              stats.prompts.imported++;
            } else {
              stats.prompts.imported++;
            }
          } catch (error) {
            console.error(`[IMPORT] Error importing prompt ${prompt.id}:`, error.message);
            stats.prompts.errors++;
          }
        }
      }
      
      // Import events
      if (data.events && Array.isArray(data.events)) {
        console.log(`[IMPORT] Processing ${data.events.length} events...`);
        
        for (const event of data.events) {
          try {
            if (!dryRun) {
              const normalizedEvent = {
                id: event.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                session_id: event.session_id || event.sessionId,
                workspace_path: event.workspace_path || event.workspacePath,
                timestamp: event.timestamp,
                type: event.type || 'activity',
                details: event.details || event.metadata || {}
              };
              
              await persistentDB.saveEvent(normalizedEvent);
              stats.events.imported++;
            } else {
              stats.events.imported++;
            }
          } catch (error) {
            console.error(`[IMPORT] Error importing event:`, error.message);
            stats.events.errors++;
          }
        }
      }
      
      // Import terminal commands
      if (data.terminal_commands && Array.isArray(data.terminal_commands)) {
        console.log(`[IMPORT] Processing ${data.terminal_commands.length} terminal commands...`);
        
        for (const cmd of data.terminal_commands) {
          try {
            if (!dryRun) {
              const normalizedCmd = {
                id: cmd.id || `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                command: cmd.command,
                shell: cmd.shell || cmd.metadata?.shell,
                source: cmd.source || cmd.metadata?.source || 'imported',
                timestamp: cmd.timestamp || cmd.metadata?.timestamp,
                workspace: cmd.workspace || cmd.workspace_path || cmd.metadata?.workspace,
                output: cmd.output || cmd.metadata?.output,
                exitCode: cmd.exit_code || cmd.exitCode || cmd.metadata?.exit_code,
                duration: cmd.duration || cmd.metadata?.duration,
                error: cmd.error || cmd.metadata?.error,
                linkedEntryId: cmd.linked_entry_id || cmd.linkedEntryId,
                linkedPromptId: cmd.linked_prompt_id || cmd.linkedPromptId,
                sessionId: cmd.session_id || cmd.sessionId
              };
              
              await persistentDB.saveTerminalCommand(normalizedCmd);
              stats.terminalCommands.imported++;
            } else {
              stats.terminalCommands.imported++;
            }
          } catch (error) {
            console.error(`[IMPORT] Error importing terminal command:`, error.message);
            stats.terminalCommands.errors++;
          }
        }
      }
      
      // Import context snapshots (if present)
      if (data.context_snapshots && Array.isArray(data.context_snapshots)) {
        console.log(`[IMPORT] Processing ${data.context_snapshots.length} context snapshots...`);
        // Context snapshots are typically derived from prompts, so we'll skip explicit import
        // unless there's a dedicated table for them
        stats.contextSnapshots.skipped = data.context_snapshots.length;
      }
      
      // Import workspaces (add to in-memory db.workspaces)
      if (data.workspaces && Array.isArray(data.workspaces)) {
        console.log(`[IMPORT] Processing ${data.workspaces.length} workspaces...`);
        
        if (!dryRun) {
          for (const workspace of data.workspaces) {
            try {
              const workspacePath = workspace.path || workspace.workspace_path || workspace;
              if (workspacePath && !db.workspaces.includes(workspacePath)) {
                db.workspaces.push(workspacePath);
                stats.workspaces.imported++;
              } else {
                stats.workspaces.skipped++;
              }
            } catch (error) {
              console.error(`[IMPORT] Error importing workspace:`, error.message);
              stats.workspaces.errors++;
            }
          }
        } else {
          stats.workspaces.imported = data.workspaces.length;
        }
      }
      
      // Reload in-memory data from database after import
      if (!dryRun) {
        console.log('[IMPORT] Reloading in-memory data from database...');
        const recentEntries = await persistentDB.getRecentEntries(1000);
        const recentPrompts = await persistentDB.getRecentPrompts(1000);
        db.entries = recentEntries;
        db.prompts = recentPrompts;
      }
      
      const totalImported = 
        stats.entries.imported +
        stats.prompts.imported +
        stats.events.imported +
        stats.terminalCommands.imported +
        stats.contextSnapshots.imported +
        stats.workspaces.imported;
      
      const totalSkipped = 
        stats.entries.skipped +
        stats.prompts.skipped +
        stats.events.skipped +
        stats.terminalCommands.skipped +
        stats.contextSnapshots.skipped +
        stats.workspaces.skipped;
      
      const totalErrors = 
        stats.entries.errors +
        stats.prompts.errors +
        stats.events.errors +
        stats.terminalCommands.errors +
        stats.contextSnapshots.errors +
        stats.workspaces.errors;
      
      console.log(`[SUCCESS] Import completed: ${totalImported} imported, ${totalSkipped} skipped, ${totalErrors} errors`);
      
      // Log audit event for import completion
      if (!dryRun) {
        await persistentDB.logAuditEvent('Import completed', 'import', {
          workspaceId: workspaceFilter,
          importVersion: importSchemaVersion,
          currentVersion: currentSchemaVersion,
          mergeStrategy,
          overwrite,
          totalImported,
          totalSkipped,
          totalErrors,
          status: totalErrors > 0 ? 'partial' : 'success'
        }).catch(err => console.warn('[IMPORT] Could not log audit event:', err.message));
      }
      
      res.json({
        success: true,
        dryRun,
        stats,
        summary: {
          totalImported,
          totalSkipped,
          totalErrors,
          overwrite,
          mergeStrategy,
          workspaceFilter,
          timestamp: new Date().toISOString()
        },
        schema: {
          importVersion: importSchemaVersion,
          currentVersion: currentSchemaVersion,
          compatible: schemaCompatible
        },
        message: dryRun 
          ? `Dry run: Would import ${totalImported} items (${totalSkipped} would be skipped)`
          : `Successfully imported ${totalImported} items (${totalSkipped} skipped, ${totalErrors} errors)`
      });
      
    } catch (error) {
      console.error('Error importing database:', error);
      
      // Log audit event for import failure
      if (!req.body.options?.dryRun) {
        await persistentDB.logAuditEvent('Import failed', 'import', {
          workspaceId: req.body.options?.workspaceFilter,
          error: error.message,
          status: 'error'
        }).catch(err => console.warn('[IMPORT] Could not log audit event:', err.message));
      }
      
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}

module.exports = createExportImportRoutes;

